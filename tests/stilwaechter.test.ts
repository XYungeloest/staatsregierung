import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import postcss, { type AtRule, type ChildNode, type Container, type Document, type Root, type Rule } from 'postcss';

/**
 * Stilwächter: hält die Kennzahlen der Designprüfung (September 2026) fest, damit sie nicht wieder
 * wegdriften. Die Obergrenzen sind keine Zielwerte, sondern der mit measureStylesheets() über alle
 * acht Stylesheets in packages/shared/src/styles gemessene Bestand nach der Designprüfung des
 * Staatsportals vom 6. September 2026. Der verbliebene rawRem-Rest liegt in foundation.css, und
 * zwar in Regeln, die auch OstRecht anfassen; sie bleiben roh, bis dieselbe Stufe dort geprüft
 * ist. Wer eine Grenze anheben muss, hebt sie genau
 * um die neuen Fälle an und begründet im Commit, warum diese Fälle kein Token, keine gemeinsame
 * Regel oder keinen vorhandenen Breakpoint verwenden können; die Meldung des Tests nennt jeden Fall
 * mit Datei und Zeile. Eine Grenze zu entfernen ist keine Option, sie zu senken jederzeit erwünscht.
 */
const LIMITS = {
  breakpoints: 4, // 30, 48, 64 und 80rem – die vier Stufen aus DESIGN.md
  hexInBorderBackground: 0, // Rahmen- und Flächenfarben kommen ausnahmslos aus Farbrollen
  rawRem: 98, // foundation 90, law-portal 8; die fünf Portal-Stylesheets tragen keinen mehr
  duplicateProperties: 64, // dateiübergreifend; 19 davon innerhalb einer Datei
};

const STYLES_DIR = fileURLToPath(new URL('../packages/shared/src/styles/', import.meta.url));
/** Stylesheets des OstRecht-Redesigns (Richtung E); hier steht seit dem Umbau die Inhaltsübersicht. */
const RECHT_STYLES_DIR = fileURLToPath(new URL('../apps/recht/src/styles/', import.meta.url));
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
  /** Schriftgrößen der Inhaltsübersicht (Einträge und Gliederungszeichen) mit Fundstelle. */
  outlineFontSizes: Finding[];
}

/**
 * Typoskala aus foundation.css in aufsteigender Reihenfolge; der Vergleich läuft über den Index,
 * damit „mindestens diese Stufe“ prüfbar ist.
 */
const TEXT_SCALE = ['--text-2xs', '--text-xs', '--text-sm', '--text-base', '--text-base-plus', '--text-md', '--text-lg', '--text-lg-plus', '--text-xl'];
/** Typoskala aus apps/recht/src/styles/tokens.css (Richtung E), ebenfalls aufsteigend. */
const RECHT_TEXT_SCALE = ['--fs-micro', '--fs-caption', '--fs-meta', '--fs-ui', '--fs-ui-lg', '--fs-body', '--fs-h4', '--fs-h3', '--fs-h2', '--fs-h1', '--fs-display-lg'];
const SCALES = [TEXT_SCALE, RECHT_TEXT_SCALE];

/**
 * Untergrenzen der Inhaltsübersicht (Befund E9): Listeneinträge und Gliederungszeichen. Die
 * Inhaltsübersicht der Normseite (Richtung E, P3) steht in der Metaskala des Boards: Einträge
 * mindestens --fs-meta (13 px), Kopf- und Fußzeilen der Spalte mindestens --fs-caption (12 px).
 */
const OUTLINE_MINIMUMS: Array<{ match: RegExp; minimum: string; what: string }> = [
  { match: /\.outline-list\s+a$/u, minimum: '--text-sm', what: 'Einträge der Inhaltsübersicht' },
  { match: /\.outline-label$/u, minimum: '--text-xs', what: 'Gliederungszeichen der Inhaltsübersicht' },
  { match: /^\.norm-outline(?:--desktop|--sheet|__list(?:\s+a)?)$/u, minimum: '--fs-meta', what: 'Einträge der Inhaltsübersicht' },
  { match: /^\.norm-outline__(?:summary|filter)$/u, minimum: '--fs-caption', what: 'Kopf- und Fußzeile der Inhaltsübersicht' },
];

/** Stufe einer Schriftgrößen-Variable innerhalb ihrer Skala; -1, wenn keine Skala sie kennt. */
function scaleRank(token: string | undefined): { scale: string[]; index: number } | undefined {
  if (!token) return undefined;
  for (const scale of SCALES) {
    const index = scale.indexOf(token);
    if (index >= 0) return { scale, index };
  }
  return undefined;
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
  const outlineFontSizes: Finding[] = [];
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
      if (decl.prop === 'font-size' && rule && rule.type === 'rule' && !insideAtRule(decl, ['print'])) {
        const selectors = (rule as Rule).selectors.map((entry) => entry.replace(/\s+/gu, ' ').trim());
        if (selectors.some((entry) => OUTLINE_MINIMUMS.some(({ match }) => match.test(entry)))) outlineFontSizes.push(finding);
      }
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
    outlineFontSizes,
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

test('Stilwächter: die Inhaltsübersicht bleibt lesbar (Einträge mindestens --fs-meta, Kopf- und Fußzeilen --fs-caption)', () => {
  // Die Inhaltsübersicht der Normseite liegt seit Richtung E in apps/recht/src/styles; die
  // Portal-Stylesheets kennen keine mehr. Beide Bestände werden geprüft, gefunden werden muss sie einmal.
  const outlineFontSizes = [...metrics.outlineFontSizes, ...measureStylesheets(RECHT_STYLES_DIR).outlineFontSizes];
  assert.ok(outlineFontSizes.length > 0, 'Die Schriftgröße der Inhaltsübersicht muss ausdrücklich gesetzt sein.');
  const problems = outlineFontSizes.flatMap((entry) => {
    const rule = OUTLINE_MINIMUMS.find(({ match }) => entry.selector.split(',').map((part) => part.replace(/\s+/gu, ' ').trim()).some((part) => match.test(part)));
    if (!rule) return [];
    const rank = scaleRank(entry.value.match(/--(?:text|fs)-[a-z0-9-]+/u)?.[0]);
    const minimum = scaleRank(rule.minimum);
    if (rank && minimum && rank.scale === minimum.scale && rank.index >= minimum.index) return [];
    return [`  ${entry.file}:${entry.line} ${entry.selector} { font-size: ${entry.value} } – ${rule.what} brauchen mindestens var(${rule.minimum})`];
  });
  assert.deepEqual(problems, [], `Navigations- und Listeneinträge stehen nie unter der Lesegrenze:\n${problems.join('\n')}`);
});

/**
 * OstRecht (apps/recht/src/styles) hat seit Richtung E einen eigenen Grenzensatz. Die Stufen sind
 * die fünf aus tokens.css (29.99, 39.99, 47.99, 59.99, 79.99 rem) plus die begründete Ausnahme des
 * Amtsbands (80rem); Hexfarben sind nur den Druckregeln erlaubt (print.css setzt Schwarz und Grau
 * für Papier); rohe rem-Werte bleiben bei den drei gemessenen Fällen; keine Regel setzt eine
 * Eigenschaft zweimal; der Fokusring ist mindestens 3 px breit (gleiche Stärke wie das Staatsportal).
 */
const RECHT_LIMITS = {
  breakpoints: ['29.99rem', '39.99rem', '47.99rem', '59.99rem', '79.99rem', '80rem'],
  hexOutsidePrint: 0,
  rawRem: 3,
  duplicateProperties: 0,
  focusWidthPx: 3,
};
const rechtMetrics = measureStylesheets(RECHT_STYLES_DIR);

test('Stilwächter OstRecht: nur die geplanten Stufen als max-width-Grenzen', () => {
  const unplanned = rechtMetrics.breakpoints.filter((entry) => !RECHT_LIMITS.breakpoints.includes(entry));
  assert.deepEqual(unplanned, [], `Ungeplante Stufen: ${unplanned.join(', ')}. Neue Stufen brauchen einen Platz in tokens.css und DESIGN.md (Responsives Verhalten).`);
});

test('Stilwächter OstRecht: Hexfarben in border*- und background*-Deklarationen nur in print.css', () => {
  const outsidePrint = rechtMetrics.hexInBorderBackground.filter((entry) => entry.file !== 'print.css');
  assert.ok(outsidePrint.length <= RECHT_LIMITS.hexOutsidePrint, `Gemessen ${outsidePrint.length}, erlaubt ${RECHT_LIMITS.hexOutsidePrint}. Farben kommen aus tokens.css:\n${describeFindings(outsidePrint)}`);
});

test('Stilwächter OstRecht: keine wachsende Zahl roher rem-Werte in Abstands- und Schriftgrößen-Deklarationen', () => {
  assert.ok(rechtMetrics.rawRem.length <= RECHT_LIMITS.rawRem, `Gemessen ${rechtMetrics.rawRem.length}, erlaubt ${RECHT_LIMITS.rawRem}. Abstände kommen aus var(--space-*), Schriftgrößen aus var(--fs-*):\n${describeFindings(rechtMetrics.rawRem)}`);
});

test('Stilwächter OstRecht: kein Selektor setzt dieselbe Eigenschaft zweimal mit unterschiedlichem Wert', () => {
  assert.ok(rechtMetrics.duplicateProperties.length <= RECHT_LIMITS.duplicateProperties, `Gemessen ${rechtMetrics.duplicateProperties.length}, erlaubt ${RECHT_LIMITS.duplicateProperties}:\n${describeDuplicates(rechtMetrics.duplicateProperties)}`);
});

test('Stilwächter OstRecht: der Fokusring ist mindestens 3 px breit', () => {
  const tokens = readFileSync(`${RECHT_STYLES_DIR}tokens.css`, 'utf8');
  const width = Number.parseFloat(tokens.match(/--focus-width:\s*([\d.]+)px/u)?.[1] ?? '0');
  assert.ok(width >= RECHT_LIMITS.focusWidthPx, `--focus-width ist ${width}px, mindestens ${RECHT_LIMITS.focusWidthPx}px (Fokusstärke beider Portale).`);
});

test('Stilwächter: kein Selektor setzt dieselbe Eigenschaft außerhalb von Media Queries zweimal mit unterschiedlichem Wert', () => {
  assert.ok(metrics.duplicateProperties.length <= LIMITS.duplicateProperties, `Gemessen ${metrics.duplicateProperties.length} Selektor/Eigenschaft-Paare mit mehreren Werten, erlaubt ${LIMITS.duplicateProperties}. Eine Eigenschaft je Selektor genau einmal setzen (spätere Regel gewinnt sonst still):\n${describeDuplicates(metrics.duplicateProperties)}`);
});

/**
 * Überschriftenelemente stehen nie in --fs-micro: Rubriken der Seitenspalten und des Fußes bleiben
 * Etiketten (.r-label), aber ein h1/h2/h3 setzt mindestens --fs-caption (base.css `h2.r-label`).
 * Geprüft werden alle font-size-Deklarationen, deren Selektor ein Überschriftenelement nennt.
 */
test('Stilwächter OstRecht: kein Überschriftenselektor setzt --fs-micro', () => {
  const findings: string[] = [];
  for (const file of readdirSync(RECHT_STYLES_DIR).filter((name) => name.endsWith('.css')).sort()) {
    const root = postcss.parse(readFileSync(`${RECHT_STYLES_DIR}${file}`, 'utf8'), { from: file }) as Root;
    root.walkDecls('font-size', (decl) => {
      const rule = decl.parent;
      if (!rule || rule.type !== 'rule' || !decl.value.includes('--fs-micro')) return;
      const heading = (rule as Rule).selectors.filter((selector) => /(^|[\s>+~,])h[1-3](?![\w-])/u.test(selector));
      if (heading.length > 0) findings.push(`${file}:${decl.source?.start?.line ?? 0} ${heading.join(', ')}`);
    });
  }
  assert.deepEqual(findings, [], `Überschriften stehen mindestens in --fs-caption:\n${findings.join('\n')}`);
});
