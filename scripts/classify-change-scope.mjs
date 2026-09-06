#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { isProjectionLogicPath } from './lib/d1-sync-scope.mjs';

/**
 * Änderungsscope: bestimmt aus geänderten Pfaden, was gebaut, geprüft und veröffentlicht wird.
 *
 * `scope` remains the compact deployment-facing value used by the workflows.
 * Verification-only changes use `ci-only`; their checks are described by the
 * separate flags below and must never imply a production deployment.
 *
 * D1-Relevanz wird nicht aus Verzeichnissen geraten: Mit `logicPaths` (transitiver Code-Abschluss
 * der Projektion, scripts/lib/d1-projection-closure.mjs, im Workflow über die CLI berechnet)
 * zählt genau eine geänderte Datei dieses Abschlusses – oder das Schema – als Projektionscode.
 * Reine Darstellung in denselben Verzeichnissen (z. B. norms/diff-render.ts) löst weder D1-Sync
 * noch Vollbestand-Smoke aus. Ohne Abschluss (esbuild fehlt, unsicherer Abschluss) gilt
 * fail-closed die konservative Obermenge aus scripts/lib/d1-sync-scope.mjs.
 *
 * Content-Pipeline-Skripte (Importer, Audits, Validatoren) werden aus package.json abgeleitet:
 * jedes Skript, das ein content:-, knowledge:-, holdings:-, norms:-, kreisreform:- oder
 * images:-Kommando aufruft, verlangt die Content-Prüfung; Bibliotheken unter scripts/lib/
 * ebenfalls (konservativ). Ein Werkzeug, das kein npm-Skript aufruft, kann Build, Inhalte oder
 * Laufzeit nicht beeinflussen und braucht nur die Unit-Tests.
 */
export const CHANGE_SCOPES = ['docs-only', 'ci-only', 'portal', 'law', 'shared'];

const SITE_TARGETS = ['portal', 'law'];
const PACKAGE_SCRIPTS = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts ?? {};
const CONTENT_PIPELINE_PREFIXES = ['content:', 'knowledge:', 'holdings:', 'norms:', 'kreisreform:', 'images:'];

/** Skripte, die ein npm-Kommando mit einem der Präfixe aufruft. */
export function scriptsReferencedBy(prefixes, scripts = PACKAGE_SCRIPTS) {
  const referenced = new Set();
  for (const [name, command] of Object.entries(scripts)) {
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;
    for (const match of String(command).matchAll(/scripts\/[\w./-]+\.(?:mjs|ts|js)/gu)) referenced.add(match[0]);
  }
  return referenced;
}

export const CONTENT_PIPELINE_SCRIPTS = scriptsReferencedBy(CONTENT_PIPELINE_PREFIXES);

const RUNTIME_BUILD_SCRIPTS = new Set([
  'scripts/prepare-site-public.mjs',
  'scripts/stamp-build.mjs',
  'scripts/lib/build-commit.mjs',
]);

const UI_TEST_SUPPORT_SCRIPTS = new Set([
  'scripts/serve-site.mjs',
  'scripts/serve-law-worker.mjs',
  'scripts/lib/site-targets.mjs',
]);

const RELEASE_VALIDATOR_SCRIPTS = new Set([
  'scripts/check-deploy-assets.mjs',
  'scripts/check-links.mjs',
  'scripts/check-seo.mjs',
]);

const CI_ONLY_SCRIPTS = new Set([
  'scripts/classify-change-scope.mjs',
  'scripts/check-deployment.mjs',
  'scripts/check-docs.mjs',
  'scripts/d1-write-probe.mjs',
  'scripts/npm-audit-retry.mjs',
  'scripts/visual-baselines.mjs',
]);

/**
 * Skripte der lokalen D1-Laufzeit (Seed, Verifikation, Worker-Start): eine Änderung wird
 * nur mit dem gesamten Rechtsbestand bewiesen, nicht mit dem Testfixture.
 */
const RUNTIME_CORPUS_SCRIPTS = new Set([
  'scripts/sync-recht-d1.mjs',
  'scripts/d1-projection-snapshot.mjs',
  'scripts/d1-runtime-seed.mjs',
  'scripts/serve-law-worker.mjs',
  'scripts/verify-recht-d1.mjs',
]);

/**
 * Ab dieser Zahl geänderter Normen gilt eine Bestandsänderung als umfangreich: der
 * Vollbestand-Smoke läuft dann zusätzlich zum Fixture, weil das Fixture eine so breite
 * Änderung nicht mehr repräsentativ abdeckt (Bulk-Import, Massenkorrektur).
 */
export const LARGE_CORPUS_CHANGE_THRESHOLD = 25;

function targets(...values) {
  const selected = new Set(values.flat(Infinity));
  return SITE_TARGETS.filter((target) => selected.has(target));
}

function documentationImpact() {
  return {
    documentation: true,
    runtimeTargets: [],
    checkTargets: [],
    buildTargets: [],
    uiTargets: [],
    runContentCheck: false,
    runKnowledgeCheck: false,
    runUnitTests: false,
    runD1Sync: false,
    fullCorpus: false,
    corpusTests: false,
    visual: false,
  };
}

function verificationImpact({
  content = false,
  knowledge = false,
  unit = true,
  build = [],
  ui = [],
  d1Sync = false,
  fullCorpus = false,
  corpusTests = false,
  visual = false,
} = {}) {
  return {
    documentation: false,
    runtimeTargets: [],
    checkTargets: [],
    buildTargets: targets(build),
    uiTargets: targets(ui),
    runContentCheck: content,
    runKnowledgeCheck: knowledge,
    runUnitTests: unit,
    runD1Sync: d1Sync,
    fullCorpus,
    corpusTests: corpusTests || fullCorpus,
    visual,
  };
}

function runtimeImpact(runtimeTargets, { content = false, d1Sync = false, fullCorpus = false, corpusTests = false, visual = true } = {}) {
  const selectedTargets = targets(runtimeTargets);
  return {
    documentation: false,
    runtimeTargets: selectedTargets,
    checkTargets: selectedTargets,
    buildTargets: selectedTargets,
    uiTargets: selectedTargets,
    runContentCheck: content,
    runKnowledgeCheck: false,
    runUnitTests: true,
    runD1Sync: d1Sync,
    fullCorpus,
    corpusTests: corpusTests || fullCorpus,
    visual,
  };
}

/**
 * Rechtsdaten, die OstRecht zur Laufzeit aus der D1-Projektion liest. Eine
 * Änderung braucht Content-Prüfung und D1-Sync, aber kein OstRecht-Deployment;
 * das Staatsportal rendert aus denselben Dateien weiterhin statisch.
 */
function isLawContentPath(path) {
  return path.startsWith('content/normen/')
    || path.startsWith('content/verkuendungen/');
}

/**
 * Portalinhalte, die in die abgeleiteten D1-Daten einfließen (Themen- und
 * Presseempfehlungen der Normen).
 */
function isDerivedPortalContentPath(path) {
  return path.startsWith('content/themen/')
    || path.startsWith('content/presse/');
}

/**
 * Code, der die D1-Projektion bestimmt: genau der Code-Abschluss des Syncs (mit Schema); ohne
 * bekannten Abschluss die konservative Obermenge. Nach einer Änderung muss die Projektion neu
 * geschrieben oder ihre Äquivalenz nachgewiesen werden.
 */
export function isD1ProjectionCodePath(path, logicPaths = null) {
  return isProjectionLogicPath(path, logicPaths);
}

/**
 * Laufzeitlogik von OstRecht, die keine Projektionslogik ist, aber gegen die Datenbank rechnet
 * (Kandidatenabfragen der Suche). Ihre Wirkung zeigt sich erst im Vollbestand.
 */
const LAW_RUNTIME_QUERY_PATHS = new Set(['packages/recht-search/src/search-query.ts']);

/**
 * Änderungen, deren Wirkung auf die OstRecht-Laufzeit nur mit dem gesamten Rechtsbestand
 * bewiesen werden kann (D1-Schema, Projektionscode, Runtime-Store und Routen mit
 * Datenbankzugriff, Kandidatenabfragen der Suche, Seed-Werkzeuge, Laufzeitkonfiguration und
 * Abhängigkeiten). Rein visuelle Änderungen (Komponenten, Layouts, Styles, Browserskripte,
 * Darstellungslogik außerhalb des Abschlusses, statische Hilfe- und Fehlerseite) genügen dem
 * Fixture.
 */
export function isFullCorpusPath(path, logicPaths = null) {
  if (path.startsWith('data/recht/d1/')) return true;
  if (RUNTIME_CORPUS_SCRIPTS.has(path) || path.startsWith('scripts/lib/d1-')) return true;
  if (path.startsWith('apps/recht/src/lib/runtime/') || path === 'apps/recht/src/middleware.ts') return true;
  if (path.startsWith('apps/recht/src/pages/')) {
    return !(path.startsWith('apps/recht/src/pages/hilfe/')
      || path === 'apps/recht/src/pages/404.astro'
      || path === 'apps/recht/src/pages/robots.txt.ts');
  }
  if (isProjectionLogicPath(path, logicPaths) || LAW_RUNTIME_QUERY_PATHS.has(path)) return true;
  return path === 'apps/recht/wrangler.jsonc'
    || path === 'apps/recht/astro.config.mjs'
    || path === 'apps/recht/package.json'
    || path === 'package-lock.json';
}

/** Rein visuelle Oberflächen- und Testdateien, für die die Screenshot-Suite läuft. */
function isVisualTestPath(path) {
  return path === 'tests/visual.spec.ts'
    || path.startsWith('tests/visual.spec.ts-snapshots/')
    || path === 'playwright.config.ts';
}

function isRootDocumentation(path) {
  return /^[^/]+\.md$/u.test(path) || path.startsWith('docs/');
}

function isKnowledgeDocumentation(path) {
  return path.startsWith('knowledge/')
    && path.endsWith('.md')
    && !path.startsWith('knowledge/generated/');
}

function isLawRuntimePath(path) {
  return path.startsWith('apps/recht/')
    || path.startsWith('packages/recht-')
    || path.startsWith('public/assets/recht/');
}

function isPortalRuntimePath(path) {
  return path.startsWith('apps/portal/')
    || path.startsWith('packages/portal-')
    || path.startsWith('content/dashboard/')
    || path.startsWith('content/freistaat/')
    || path.startsWith('content/gesetzgebung/')
    || path.startsWith('content/haushalt/')
    || path.startsWith('content/organisation/')
    || path.startsWith('content/portal/')
    || path.startsWith('content/presse/')
    || path.startsWith('content/regierung/')
    || path.startsWith('content/ressorts/')
    || path.startsWith('content/service/')
    || path.startsWith('content/themen/')
    || path.startsWith('public/data/');
}

function isSharedRuntimePath(path) {
  return path.startsWith('packages/')
    || RUNTIME_BUILD_SCRIPTS.has(path)
    || path === 'public/_headers'
    || path === 'public/favicon.ico'
    || path === 'public/favicon.svg'
    // These assets are copied into both app-local public directories.
    || path === 'public/images/ui/ost-flagge.png'
    || path === 'public/images/generated/ui/ost-flagge-480.webp'
    || path === 'public/images/social/recht-preview.png'
    || /^(?:package(?:-lock)?\.json|tsconfig[^/]*|astro\.config\.[^/]+)$/u.test(path);
}

function isPortalPublicAsset(path) {
  return path.startsWith('public/');
}

function isContentVerificationPath(path) {
  return path.startsWith('Gesetze/')
    || path.startsWith('data/recht/')
    || path.startsWith('context/')
    || path.startsWith('knowledge/');
}

function isUiSmokeSpec(path) {
  return path === 'tests/accessibility.spec.ts' || path === 'tests/browser-smoke.spec.ts';
}

function isCiOnlyRootPath(path) {
  return path === '.editorconfig'
    || path === '.gitattributes'
    || path === '.gitignore'
    || path === '.npmrc'
    || /^playwright[^/]*\.[^/]+$/u.test(path);
}

function scriptImpact(path, logicPaths) {
  if (RUNTIME_BUILD_SCRIPTS.has(path)) return runtimeImpact(SITE_TARGETS);
  if (isD1ProjectionCodePath(path, logicPaths)) return verificationImpact({ content: true, d1Sync: true, fullCorpus: true });
  if (isFullCorpusPath(path, logicPaths)) {
    // Seed-, Verifikations- und Worker-Werkzeuge: der Vollbestand-Smoke beweist sie.
    return verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS, fullCorpus: true });
  }
  if (UI_TEST_SUPPORT_SCRIPTS.has(path)) {
    return verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS });
  }
  if (RELEASE_VALIDATOR_SCRIPTS.has(path)) {
    // Link-, SEO- and asset validators need generated output, but changing one
    // of them must not publish an otherwise unchanged site.
    return verificationImpact({ build: SITE_TARGETS });
  }
  if (CI_ONLY_SCRIPTS.has(path)) return verificationImpact();

  // Importer, Generatoren, Audits und Content-Validatoren (aus package.json abgeleitet) sowie
  // ihre Bibliotheken unter scripts/lib/ sind verification-only mit Content-Prüfung; ihre
  // generierten kanonischen Dateien bestimmen die Deploymentwirkung, wenn sie im selben Commit
  // geändert sind. Ein Werkzeug, das kein npm-Skript aufruft, braucht nur die Unit-Tests.
  if (CONTENT_PIPELINE_SCRIPTS.has(path) || path.startsWith('scripts/lib/')) return verificationImpact({ content: true });
  return verificationImpact();
}

function pathImpact(path, logicPaths = null) {
  if (isRootDocumentation(path) || isKnowledgeDocumentation(path)) {
    return documentationImpact();
  }

  // Rechtsinhalte laufen über D1; die Screenshot-Suite arbeitet mit dem Fixture und wird
  // von reinem Normcontent nicht angestoßen.
  if (isLawContentPath(path)) return runtimeImpact(['portal'], { content: true, d1Sync: true, visual: false });
  if (isLawRuntimePath(path)) return runtimeImpact(['law'], { d1Sync: isD1ProjectionCodePath(path, logicPaths), fullCorpus: isFullCorpusPath(path, logicPaths) });
  if (isPortalRuntimePath(path)) {
    return runtimeImpact(['portal'], {
      content: path.startsWith('content/'),
      d1Sync: isDerivedPortalContentPath(path),
    });
  }
  if (isSharedRuntimePath(path)) {
    return runtimeImpact(SITE_TARGETS, {
      content: path.startsWith('content/'),
      d1Sync: isD1ProjectionCodePath(path, logicPaths),
      fullCorpus: isFullCorpusPath(path, logicPaths),
      corpusTests: path === 'package.json' || path === 'package-lock.json',
    });
  }

  if (isPortalPublicAsset(path)) return runtimeImpact(['portal']);

  if (path.startsWith('tests/')) {
    if (isUiSmokeSpec(path)) return verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS });
    if (isVisualTestPath(path)) return verificationImpact({ build: SITE_TARGETS, visual: true });
    if (path.startsWith('tests/corpus/') || path.startsWith('tests/helpers/') || path.startsWith('tests/fixtures/')) return verificationImpact({ corpusTests: true });
    return verificationImpact();
  }

  if (path.startsWith('scripts/')) return scriptImpact(path, logicPaths);

  if (path.startsWith('.github/')) return verificationImpact();
  if (isCiOnlyRootPath(path)) {
    if (path === 'playwright.config.ts') return verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS, visual: true });
    return /^playwright[^/]*\.[^/]+$/u.test(path)
      ? verificationImpact({ build: SITE_TARGETS, ui: SITE_TARGETS })
      : verificationImpact();
  }

  if (path.startsWith('knowledge/')) {
    return verificationImpact({ content: true, knowledge: true });
  }
  if (path.startsWith('data/recht/d1/')) {
    // Migrationen werden manuell eingespielt; ihre Wirkung beweist der Vollbestand-Smoke.
    return verificationImpact({ content: true, build: ['law'], ui: ['law'], fullCorpus: true });
  }
  // Das Testfixture bestimmt, was Browser-, Barrierefreiheits- und Screenshot-Tests sehen.
  if (path === 'data/recht/runtime-fixture.json') return verificationImpact({ content: true, build: SITE_TARGETS, ui: SITE_TARGETS, corpusTests: true, visual: true });
  if (isContentVerificationPath(path)) return verificationImpact({ content: true });

  if (path.startsWith('temp-neu/')) return verificationImpact();

  // An unrecognised path may still be picked up by a runtime import or build
  // configuration. Keep the fallback conservative rather than dropping it.
  return runtimeImpact(SITE_TARGETS, { content: true });
}

function scopeForTargets(runtimeTargets, documentation = false) {
  if (runtimeTargets.length === 2) return 'shared';
  if (runtimeTargets[0] === 'portal') return 'portal';
  if (runtimeTargets[0] === 'law') return 'law';
  return documentation ? 'docs-only' : 'ci-only';
}

/** Zahl der Normen, deren Verzeichnis unter content/normen berührt ist. */
export function changedNormSlugs(paths) {
  const slugs = new Set();
  for (const path of paths) {
    const match = normalizeChangedPath(path).match(/^content\/normen\/([^/]+)\//u);
    if (match) slugs.add(match[1]);
  }
  return [...slugs].sort();
}

function resultFor(impacts, paths, { forceFullCorpus = false, closureKnown = true } = {}) {
  const runtimeTargets = targets(impacts.map((impact) => impact.runtimeTargets));
  const checkTargets = targets(impacts.map((impact) => impact.checkTargets));
  const largeCorpusChange = changedNormSlugs(paths).length >= LARGE_CORPUS_CHANGE_THRESHOLD;
  const runFullCorpusSmoke = forceFullCorpus || largeCorpusChange || impacts.some((impact) => impact.fullCorpus);
  // Der Vollbestand-Smoke braucht den gebauten OstRecht-Worker, auch wenn die Änderung selbst
  // (z. B. ein Bulk-Import unter content/normen) kein OstRecht-Deployment auslöst.
  const buildTargets = targets(impacts.map((impact) => impact.buildTargets), runFullCorpusSmoke ? ['law'] : []);
  const uiTargets = targets(impacts.map((impact) => impact.uiTargets), runFullCorpusSmoke ? ['law'] : []);
  const documentationOnly = impacts.length > 0 && impacts.every((impact) => impact.documentation);
  const scope = scopeForTargets(runtimeTargets, documentationOnly);

  return {
    scope,
    paths,
    // `targets` is retained for callers of the original helper.
    targets: runtimeTargets,
    deployTargets: runtimeTargets,
    buildTargets,
    uiTargets,
    deployPortal: runtimeTargets.includes('portal'),
    deployLaw: runtimeTargets.includes('law'),
    checkPortal: checkTargets.includes('portal'),
    checkLaw: checkTargets.includes('law'),
    runContentCheck: impacts.some((impact) => impact.runContentCheck),
    runKnowledgeCheck: impacts.some((impact) => impact.runKnowledgeCheck),
    runUnitTests: impacts.some((impact) => impact.runUnitTests),
    // Korpus-Tests (tests/corpus/: Projektionsnachweis, Seed, Referenzindex) nur bei Projektions-,
    // Laufzeit- oder Schemaänderungen und bei Änderungen der Tests selbst. Reine Inhaltsänderungen
    // prüfen die Content-Audits (content:check) und der D1-Sync; die schnellen Unit-Tests laufen immer.
    runCorpusTests: impacts.some((impact) => impact.corpusTests) || runFullCorpusSmoke,
    runD1Sync: impacts.some((impact) => impact.runD1Sync),
    closureKnown,
    runUiSmoke: uiTargets.length > 0,
    runFullUiSmoke: uiTargets.length === SITE_TARGETS.length,
    // Vollbestand-Smoke (Seed aus dem Cache) statt Fixture: Laufzeit-, Projektions- oder
    // umfangreiche Bestandsänderung. Alles andere prüft das repräsentative Fixture.
    runFullCorpusSmoke,
    largeCorpusChange,
    // Screenshot-Suite nur bei Oberflächen-, Layout-, Style- oder Portalinhaltsänderungen.
    runVisual: buildTargets.length > 0 && impacts.some((impact) => impact.visual),
  };
}

export function normalizeChangedPath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//u, '');
}

export function classifyChangedPath(value, { logicPaths = null } = {}) {
  const path = normalizeChangedPath(value);
  const impact = pathImpact(path, logicPaths);
  return scopeForTargets(impact.runtimeTargets, impact.documentation);
}

/**
 * @param {string[]} values geänderte Pfade
 * @param {{ logicPaths?: Set<string> | null }} options Code-Abschluss der Projektion (null = unbekannt, fail-closed Obermenge)
 */
export function classifyChangeScope(values = [], { logicPaths = null } = {}) {
  const paths = values.map(normalizeChangedPath).filter(Boolean);
  // Ohne bekannte Änderungsliste (z. B. erster Commit) konservativ: alles einschließlich Vollbestand.
  if (paths.length === 0) return resultFor([runtimeImpact(SITE_TARGETS, { content: true, d1Sync: true, fullCorpus: true })], paths, { closureKnown: Boolean(logicPaths) });
  return resultFor(paths.map((path) => pathImpact(path, logicPaths)), paths, { closureKnown: Boolean(logicPaths) });
}

/**
 * Code-Abschluss der Projektion für die CLI: Arbeitsbaum (bzw. --closure-ref <Ref>); bei jedem
 * Problem null (konservative Obermenge) mit Hinweis auf stderr.
 */
export async function resolveLogicPaths({ ref = null, root = process.cwd() } = {}) {
  try {
    const { projectionClosure } = await import('./lib/d1-projection-closure.mjs');
    const closure = await projectionClosure({ root, ref });
    if (closure.uncertain) {
      console.error(`Code-Abschluss der Projektion unsicher (${closure.reasons.join('; ')}); D1-Relevanz über die konservative Obermenge.`);
      return null;
    }
    return new Set(closure.files);
  } catch (error) {
    console.error(`Code-Abschluss der Projektion nicht bestimmbar (${error instanceof Error ? error.message : String(error)}); D1-Relevanz über die konservative Obermenge.`);
    return null;
  }
}

export function classifyManualDeploy(target = 'both') {
  const runtimeTargets = target === 'portal'
    ? ['portal']
    : target === 'law'
      ? ['law']
      : target === 'both'
        ? SITE_TARGETS
        : null;
  if (!runtimeTargets) {
    throw new Error('Manuelles Ziel muss portal, law oder both sein.');
  }
  // A manual deployment remains a normal release: content, type and browser
  // checks still run for exactly the selected target(s), and a manual OstRecht
  // release is verified against the full corpus. The D1 projection is not
  // rewritten by a manual release; run `npm run norms:runtime:d1-sync`
  // deliberately when the legal data changed.
  return resultFor([runtimeImpact(runtimeTargets, { content: true })], [], { forceFullCorpus: runtimeTargets.includes('law') });
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readInput(args) {
  if (args.includes('--stdin')) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').split(/\r?\n/u);
  }
  const outputIndex = args.indexOf('--github-output');
  const manualTargetIndex = args.indexOf('--manual-target');
  const closureRefIndex = args.indexOf('--closure-ref');
  return args.filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    return (outputIndex < 0 || index !== outputIndex + 1)
      && (manualTargetIndex < 0 || index !== manualTargetIndex + 1)
      && (closureRefIndex < 0 || index !== closureRefIndex + 1);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const manualTarget = argumentValue(args, '--manual-target') ?? (args.includes('--manual') ? 'both' : undefined);
  // --no-closure: bewusst ohne Abschluss (konservativ); --closure-ref <Ref>: Abschluss eines Refs statt des Arbeitsbaums.
  const logicPaths = manualTarget || args.includes('--no-closure') ? null : await resolveLogicPaths({ ref: argumentValue(args, '--closure-ref') ?? null });
  const result = manualTarget
    ? classifyManualDeploy(manualTarget)
    : classifyChangeScope(await readInput(args), { logicPaths });
  const outputPath = argumentValue(args, '--github-output') ?? process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const lines = [
      `scope=${result.scope}`,
      `deploy_portal=${result.deployPortal}`,
      `deploy_law=${result.deployLaw}`,
      `deploy_targets=${result.deployTargets.join(',')}`,
      `check_portal=${result.checkPortal}`,
      `check_law=${result.checkLaw}`,
      `build_targets=${result.buildTargets.join(',')}`,
      `ui_targets=${result.uiTargets.join(',')}`,
      `run_content_check=${result.runContentCheck}`,
      `run_knowledge_check=${result.runKnowledgeCheck}`,
      `run_unit_tests=${result.runUnitTests}`,
      `run_corpus_tests=${result.runCorpusTests}`,
      `run_d1_sync=${result.runD1Sync}`,
      `run_ui_smoke=${result.runUiSmoke}`,
      `run_full_ui_smoke=${result.runFullUiSmoke}`,
      `run_full_corpus_smoke=${result.runFullCorpusSmoke}`,
      `run_visual=${result.runVisual}`,
    ];
    await appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
