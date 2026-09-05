import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import postcss, { type AtRule, type ChildNode, type Container, type Document, type Root, type Rule } from 'postcss';

/**
 * Stilwächter: hält die Kennzahlen der Designprüfung (September 2026) fest, damit sie nicht wieder
 * wegdriften. Die Obergrenzen sind keine Zielwerte, sondern die am 5. September 2026 auf main
 * (84481acdc) mit measureStylesheets() über alle acht Stylesheets in packages/shared/src/styles
 * gemessenen Bestände (law-portal.css allein hatte in der Prüfung 4 Breakpoints und 0 Rahmen- und
 * Flächenfarben; die übrigen Dateien tragen den Rest). Wer eine Grenze anheben muss, hebt sie genau
 * um die neuen Fälle an und begründet im Commit, warum diese Fälle kein Token, keine gemeinsame
 * Regel oder keinen vorhandenen Breakpoint verwenden können; die Meldung des Tests nennt jeden Fall
 * mit Datei und Zeile. Eine Grenze zu entfernen ist keine Option, sie zu senken jederzeit erwünscht.
 */
const LIMITS = {
  breakpoints: 4, // 30, 48, 64 und 80rem – die vier Stufen aus DESIGN.md
  hexInBorderBackground: 47, // foundation 14, holdings 3, home 21, portal-shell 6, section-system 3; law-portal 0
  rawRem: 638, // foundation 284, section-system 135, home 90, holdings 70, portal-shell 44, law-portal 9, content-layout 6
  duplicateProperties: 69, // dateiübergreifend; 22 davon innerhalb einer Datei
};

const STYLES_DIR = fileURLToPath(new URL('../packages/shared/src/styles/', import.meta.url));
const SPACING_OR_TEXT_PROP = /^(?:(?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap|font-size)$/u;
const HEX_COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])/iu;
const RAW_REM = /(?<![\w.-])\d*\.?\d+rem(?![\w-])/u;

export interface Finding {
  file: string;
  line: number;
  selector: string;
  prop: string;
  value: string;
}

export interface DuplicateFinding {
  selector: string;
  prop: string;
  values: string[];
  where: string[];
}

export interface StylesheetMetrics {
  files: string[];
  breakpoints: string[];
  hexInBorderBackground: Finding[];
  rawRem: Finding[];
  duplicateProperties: DuplicateFinding[];
  duplicatePropertiesWithinFile: number;
}

function insideAtRule(node: ChildNode, names: string[]): boolean {
  let parent: Container | Document | undefined = node.parent;
  while (parent && parent.type !== 'root' && parent.type !== 'document') {
    if (parent.type === 'atrule' && names.includes((parent as AtRule).name)) return true;
    parent = parent.parent as Container | Document | undefined;
  }
  return false;
}

/** var(...)-Aufrufe entfernen (auch verschachtelte), damit nur rohe Werte übrig bleiben. */
function withoutVar(value: string): string {
  let current = value;
  for (let previous = ''; previous !== current;) {
    previous = current;
    current = current.replace(/var\([^()]*\)/gu, '');
  }
  return current;
}

function selectorLabel(rule: Rule): string {
  return rule.selector.replace(/\s+/gu, ' ').trim();
}

export function measureStylesheets(directory = STYLES_DIR): StylesheetMetrics {
  const files = readdirSync(directory).filter((name) => name.endsWith('.css')).sort();
  const roots = files.map((file) => ({ file, root: postcss.parse(readFileSync(`${directory}${file}`, 'utf8'), { from: file }) as Root }));
  const breakpoints = new Set<string>();
  const hexInBorderBackground: Finding[] = [];
  const rawRem: Finding[] = [];
  // Selektor → Eigenschaft → Wert → Fundstellen (nur außerhalb von Media Queries und Keyframes).
  const bySelector = new Map<string, Map<string, Map<string, string[]>>>();
  const bySelectorAndFile = new Map<string, Map<string, Set<string>>>();

  for (const { file, root } of roots) {
    root.walkAtRules('media', (atRule) => {
      for (const match of atRule.params.matchAll(/max-width\s*:\s*([^\s)]+)/gu)) breakpoints.add(match[1]);
      for (const match of atRule.params.matchAll(/width\s*<=\s*([^\s)]+)/gu)) breakpoints.add(match[1]);
    });
    root.walkDecls((decl) => {
      const rule = decl.parent;
      const selector = rule && rule.type === 'rule' ? selectorLabel(rule as Rule) : `@${(rule as AtRule | undefined)?.name ?? '?'}`;
      const finding: Finding = { file, line: decl.source?.start?.line ?? 0, selector, prop: decl.prop, value: decl.value };
      if ((decl.prop.startsWith('border') || decl.prop.startsWith('background')) && HEX_COLOR.test(decl.value)) hexInBorderBackground.push(finding);
      if (SPACING_OR_TEXT_PROP.test(decl.prop) && RAW_REM.test(withoutVar(decl.value))) rawRem.push(finding);
      if (!rule || rule.type !== 'rule' || decl.prop.startsWith('--') || insideAtRule(decl, ['media', 'keyframes'])) return;
      const value = `${decl.value.replace(/\s+/gu, ' ').trim()}${decl.important ? ' !important' : ''}`;
      for (const single of (rule as Rule).selectors.map((entry) => entry.replace(/\s+/gu, ' ').trim())) {
        const props = bySelector.get(single) ?? new Map<string, Map<string, string[]>>();
        const values = props.get(decl.prop) ?? new Map<string, string[]>();
        values.set(value, [...(values.get(value) ?? []), `${file}:${finding.line}`]);
        props.set(decl.prop, values);
        bySelector.set(single, props);
        const fileProps = bySelectorAndFile.get(`${file} ${single}`) ?? new Map<string, Set<string>>();
        fileProps.set(decl.prop, new Set([...(fileProps.get(decl.prop) ?? []), value]));
        bySelectorAndFile.set(`${file} ${single}`, fileProps);
      }
    });
  }

  const duplicateProperties: DuplicateFinding[] = [];
  for (const [selector, props] of bySelector) {
    for (const [prop, values] of props) {
      if (values.size < 2) continue;
      duplicateProperties.push({ selector, prop, values: [...values.keys()], where: [...values.values()].flat() });
    }
  }
  let duplicatePropertiesWithinFile = 0;
  for (const props of bySelectorAndFile.values()) for (const values of props.values()) if (values.size >= 2) duplicatePropertiesWithinFile += 1;

  return {
    files,
    breakpoints: [...breakpoints].sort((a, b) => parseFloat(a) - parseFloat(b)),
    hexInBorderBackground,
    rawRem,
    duplicateProperties,
    duplicatePropertiesWithinFile,
  };
}

const describeFindings = (findings: Finding[]): string => findings.slice(0, 40).map((entry) => `  ${entry.file}:${entry.line} ${entry.selector} { ${entry.prop}: ${entry.value} }`).join('\n');
const describeDuplicates = (findings: DuplicateFinding[]): string => findings.slice(0, 40).map((entry) => `  ${entry.selector} { ${entry.prop} } → ${entry.values.map((value) => `„${value}“`).join(' / ')} (${entry.where.join(', ')})`).join('\n');

const metrics = measureStylesheets();

test('Stilwächter: höchstens vier verschiedene max-width-Grenzen in Media Queries', () => {
  assert.ok(metrics.breakpoints.length <= LIMITS.breakpoints, `Gemessen ${metrics.breakpoints.length} Grenzen (${metrics.breakpoints.join(', ')}), erlaubt ${LIMITS.breakpoints}. Neue Grenzen brauchen einen Platz in DESIGN.md (Responsives Verhalten) oder gehören auf einen vorhandenen Breakpoint.`);
});

test('Stilwächter: keine neuen fest verdrahteten Hexfarben in border*- und background*-Deklarationen', () => {
  assert.ok(metrics.hexInBorderBackground.length <= LIMITS.hexInBorderBackground, `Gemessen ${metrics.hexInBorderBackground.length}, erlaubt ${LIMITS.hexInBorderBackground}. Rahmen- und Flächenfarben kommen aus Farbrollen (var(--color-*)):\n${describeFindings(metrics.hexInBorderBackground)}`);
});

test('Stilwächter: keine neuen rohen rem-Werte in Abstands- und Schriftgrößen-Deklarationen', () => {
  assert.ok(metrics.rawRem.length <= LIMITS.rawRem, `Gemessen ${metrics.rawRem.length}, erlaubt ${LIMITS.rawRem}. Abstände kommen aus var(--space-*), Schriftgrößen aus var(--text-*):\n${describeFindings(metrics.rawRem)}`);
});

test('Stilwächter: kein Selektor setzt dieselbe Eigenschaft außerhalb von Media Queries zweimal mit unterschiedlichem Wert', () => {
  assert.ok(metrics.duplicateProperties.length <= LIMITS.duplicateProperties, `Gemessen ${metrics.duplicateProperties.length} Selektor/Eigenschaft-Paare mit mehreren Werten, erlaubt ${LIMITS.duplicateProperties}. Eine Eigenschaft je Selektor genau einmal setzen (spätere Regel gewinnt sonst still):\n${describeDuplicates(metrics.duplicateProperties)}`);
});
