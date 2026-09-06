import assert from 'node:assert/strict';
import test from 'node:test';

import { CONTENT_PIPELINE_SCRIPTS, LARGE_CORPUS_CHANGE_THRESHOLD, changedNormSlugs, classifyChangeScope, classifyManualDeploy, isFullCorpusPath, scriptsReferencedBy } from '../scripts/classify-change-scope.mjs';
import { projectionClosure } from '../scripts/lib/d1-projection-closure.mjs';

// Realer Code-Abschluss der Projektion (Arbeitsbaum); die Fälle unten hängen von ihm ab.
const closure = await projectionClosure({ root: process.cwd() });
assert.equal(closure.uncertain, false, closure.reasons.join('; '));
const logicPaths = new Set(closure.files);
const classify = (paths, options = {}) => classifyChangeScope(paths, { logicPaths, ...options });

test('Änderungsscope trennt Runtime-Deployment und Verifikationsumfang parametrisiert', () => {
  const cases = [
    {
      label: 'Dokumentation bleibt leichtgewichtig',
      paths: ['README.md'],
      scope: 'docs-only',
      targets: [],
      unit: false,
    },
    {
      label: 'A: OstRecht-Seite',
      paths: ['apps/recht/src/pages/index.astro'],
      scope: 'law',
      targets: ['law'],
    },
    {
      label: 'B: OstRecht-Seite mit Law-Test',
      paths: ['apps/recht/src/pages/index.astro', 'tests/law-portal.test.ts'],
      scope: 'law',
      targets: ['law'],
    },
    {
      label: 'C: realer Such-Fix mit Content-Validator',
      paths: ['apps/recht/src/pages/index.astro', 'scripts/check-content.mjs'],
      scope: 'law',
      targets: ['law'],
      content: true,
    },
    {
      label: 'D: Portal-Seite mit Browser-Smoke-Test',
      paths: ['apps/portal/src/pages/index.astro', 'tests/browser-smoke.spec.ts'],
      scope: 'portal',
      targets: ['portal'],
      buildTargets: ['portal', 'law'],
      uiTargets: ['portal', 'law'],
    },
    {
      label: 'E: einzelner Law-Unit-Test',
      paths: ['tests/law-portal.test.ts'],
      scope: 'ci-only',
      targets: [],
    },
    {
      label: 'F: Content-Validator allein',
      paths: ['scripts/check-content.mjs'],
      scope: 'ci-only',
      targets: [],
      content: true,
    },
    {
      label: 'G: Workflow allein',
      paths: ['.github/workflows/deploy.yml'],
      scope: 'ci-only',
      targets: [],
    },
    {
      label: 'H: OstRecht-Suchpaket bestimmt auch die D1-Suchdokumente',
      paths: ['packages/recht-search/src/search.ts'],
      scope: 'law',
      targets: ['law'],
      d1Sync: true,
    },
    {
      label: 'I: gemeinsame Laufzeitkomponente',
      paths: ['packages/shared/src/components/PageHead.astro'],
      scope: 'shared',
      targets: ['portal', 'law'],
    },
    {
      label: 'J: Normdaten laufen über D1, nicht über ein OstRecht-Deployment',
      paths: ['content/normen/beispielnorm/meta.json'],
      scope: 'portal',
      targets: ['portal'],
      content: true,
      d1Sync: true,
    },
    {
      label: 'J2: Verkündungen laufen über D1',
      paths: ['content/verkuendungen/2024/testblatt-2024-1.json'],
      scope: 'portal',
      targets: ['portal'],
      content: true,
      d1Sync: true,
    },
    {
      label: 'J3: Themenseiten speisen die abgeleiteten D1-Daten',
      paths: ['content/themen/bildung.json'],
      scope: 'portal',
      targets: ['portal'],
      content: true,
      d1Sync: true,
    },
    {
      label: 'J4: Sync-Skript allein schreibt die Projektion neu; der Vollbestand-Smoke beweist sie mit dem OstRecht-Build',
      paths: ['scripts/sync-recht-d1.mjs'],
      scope: 'ci-only',
      targets: [],
      buildTargets: ['law'],
      uiTargets: ['law'],
      content: true,
      d1Sync: true,
      fullCorpus: true,
    },
    {
      label: 'J5: Normbibliothek ist Laufzeit beider Websites und D1-Projektion',
      paths: ['packages/shared/src/lib/norms/derived.ts'],
      scope: 'shared',
      targets: ['portal', 'law'],
      d1Sync: true,
    },
    {
      label: 'J6: D1-Migrationen werden bewusst manuell eingespielt; der Vollbestand-Smoke beweist sie',
      paths: ['data/recht/d1/0005_beispiel.sql'],
      scope: 'ci-only',
      targets: [],
      buildTargets: ['law'],
      uiTargets: ['law'],
      content: true,
      fullCorpus: true,
    },
    {
      label: 'interne Knowledge-Dokumentation',
      paths: ['knowledge/AUDIT.md'],
      scope: 'docs-only',
      targets: [],
      unit: false,
    },
    {
      label: 'Knowledge-README bleibt interne Dokumentation',
      paths: ['knowledge/README.md'],
      scope: 'docs-only',
      targets: [],
      unit: false,
    },
    {
      label: 'Rechtsquellen-Auditdaten',
      paths: ['data/recht/consolidation-manifest.json'],
      scope: 'ci-only',
      targets: [],
      content: true,
    },
    {
      label: 'amtliche Quell-HTML ohne aktualisierte Normdaten',
      paths: ['Gesetze/Testverordnung.html'],
      scope: 'ci-only',
      targets: [],
      content: true,
    },
    {
      label: 'gemeinsame Public-Vorbereitung',
      paths: ['scripts/prepare-site-public.mjs'],
      scope: 'shared',
      targets: ['portal', 'law'],
    },
    {
      label: 'unbekannter Laufzeitpfad bleibt konservativ',
      paths: ['runtime-config-neu.json'],
      scope: 'shared',
      targets: ['portal', 'law'],
      content: true,
    },
    {
      label: 'manuelles Portal-Deployment',
      manualTarget: 'portal',
      scope: 'portal',
      targets: ['portal'],
      content: true,
    },
    {
      label: 'manuelles OstRecht-Deployment',
      manualTarget: 'law',
      scope: 'law',
      targets: ['law'],
      content: true,
    },
    {
      label: 'manuelles Deployment beider Websites',
      manualTarget: 'both',
      scope: 'shared',
      targets: ['portal', 'law'],
      content: true,
    },
  ];

  for (const entry of cases) {
    const result = entry.manualTarget
      ? classifyManualDeploy(entry.manualTarget)
      : classify(entry.paths);
    assert.equal(result.scope, entry.scope, entry.label);
    assert.deepEqual(result.targets, entry.targets, entry.label);
    assert.deepEqual(result.deployTargets, entry.targets, entry.label);
    assert.deepEqual(result.buildTargets, entry.buildTargets ?? entry.targets, entry.label);
    assert.deepEqual(result.uiTargets, entry.uiTargets ?? entry.targets, entry.label);
    assert.equal(result.deployPortal, entry.targets.includes('portal'), entry.label);
    assert.equal(result.deployLaw, entry.targets.includes('law'), entry.label);
    assert.equal(result.runContentCheck, entry.content ?? false, entry.label);
    assert.equal(result.runUnitTests, entry.unit ?? true, entry.label);
    assert.equal(result.runD1Sync, entry.d1Sync ?? false, entry.label);
    if (entry.fullCorpus !== undefined) assert.equal(result.runFullCorpusSmoke, entry.fullCorpus, `${entry.label}: Vollbestand-Smoke`);
    if (entry.visual !== undefined) assert.equal(result.runVisual, entry.visual, `${entry.label}: Screenshot-Suite`);
  }
});

test('Vollbestand-Smoke nur bei Laufzeit-, Projektions- oder umfangreichen Bestandsänderungen; Screenshot-Suite nur bei Oberflächenänderungen', () => {
  const cases = [
    { label: 'reines CSS: Fixture genügt, Screenshots laufen', paths: ['packages/shared/src/styles/home.css'], scope: 'shared', fullCorpus: false, visual: true, uiTargets: ['portal', 'law'] },
    { label: 'OstRecht-Komponente: Fixture genügt', paths: ['apps/recht/src/components/norms/NormOriginBadge.astro'], scope: 'law', fullCorpus: false, visual: true },
    { label: 'OstRecht-Layout und Browserskript: Fixture genügt', paths: ['apps/recht/src/layouts/LawLayout.astro', 'apps/recht/src/scripts/search-page.ts'], scope: 'law', fullCorpus: false, visual: true },
    { label: 'statische Hilfe- und Fehlerseite: Fixture genügt', paths: ['apps/recht/src/pages/hilfe/index.astro', 'apps/recht/src/pages/404.astro'], scope: 'law', fullCorpus: false, visual: true },
    { label: 'Runtime-Store: Vollbestand', paths: ['apps/recht/src/lib/runtime/store.ts'], scope: 'law', fullCorpus: true, visual: true },
    { label: 'Runtime-Route mit Datenbankzugriff: Vollbestand', paths: ['apps/recht/src/pages/api/suche.json.ts'], scope: 'law', fullCorpus: true },
    { label: 'Normseite: Vollbestand', paths: ['apps/recht/src/pages/norm/[slug]/index.astro'], scope: 'law', fullCorpus: true },
    { label: 'D1-Migration: Vollbestand mit OstRecht-Build, kein Deployment', paths: ['data/recht/d1/0007_beispiel.sql'], scope: 'ci-only', fullCorpus: true, visual: false, buildTargets: ['law'], uiTargets: ['law'], content: true },
    { label: 'Sync-Skript: Vollbestand', paths: ['scripts/sync-recht-d1.mjs'], scope: 'ci-only', fullCorpus: true, d1Sync: true, content: true },
    { label: 'Seed-Werkzeug: Vollbestand mit beiden Builds', paths: ['scripts/lib/d1-runtime-seed.mjs'], scope: 'ci-only', fullCorpus: true, buildTargets: ['portal', 'law'], uiTargets: ['portal', 'law'] },
    { label: 'Worker-Start: Vollbestand', paths: ['scripts/serve-law-worker.mjs'], scope: 'ci-only', fullCorpus: true, buildTargets: ['portal', 'law'], uiTargets: ['portal', 'law'] },
    { label: 'Normbibliothek (Herkunft): Vollbestand', paths: ['packages/shared/src/lib/norms/origin.ts'], scope: 'shared', fullCorpus: true, d1Sync: true },
    { label: 'Kandidatenabfragen der Suche: Vollbestand, aber keine Projektionslogik', paths: ['packages/recht-search/src/search-query.ts'], scope: 'law', fullCorpus: true, d1Sync: false },
    { label: 'Stichtag: Vollbestand und D1-Projektion (im Abschluss)', paths: ['packages/shared/src/config/editorial.json'], scope: 'shared', fullCorpus: true, d1Sync: true },
    { label: 'Abhängigkeiten: Vollbestand', paths: ['package-lock.json'], scope: 'shared', fullCorpus: true },
    { label: 'wenige Normen: Fixture genügt, keine Screenshots, Content-Audits und D1-Sync statt Korpus-Tests', paths: ['content/normen/a/meta.json', 'content/normen/b/versions/2026-01-01.json', 'content/verkuendungen/x.json'], scope: 'portal', fullCorpus: false, visual: false, content: true, d1Sync: true, corpus: false },
    { label: 'Themenseite: Screenshots, kein Vollbestand', paths: ['content/themen/bildung.json'], scope: 'portal', fullCorpus: false, visual: true, content: true, d1Sync: true },
    { label: 'Dokumentation: weder Vollbestand noch Screenshots', paths: ['README.md', 'docs/DEPLOYMENT_RUNBOOK.md'], scope: 'docs-only', fullCorpus: false, visual: false, unit: false },
    { label: 'Workflow: weder Vollbestand noch Screenshots', paths: ['.github/workflows/deploy.yml'], scope: 'ci-only', fullCorpus: false, visual: false },
    { label: 'Screenshot-Suite selbst: Screenshots mit beiden Builds, kein UI-Smoke', paths: ['tests/visual.spec.ts'], scope: 'ci-only', fullCorpus: false, visual: true, buildTargets: ['portal', 'law'], uiTargets: [] },
    { label: 'Screenshot-Baseline: Screenshots', paths: ['tests/visual.spec.ts-snapshots/ostrecht-desktop-wide-linux.png'], scope: 'ci-only', fullCorpus: false, visual: true, buildTargets: ['portal', 'law'], uiTargets: [] },
  ];
  for (const entry of cases) {
    const result = classify(entry.paths);
    assert.equal(result.scope, entry.scope, entry.label);
    assert.equal(result.runFullCorpusSmoke, entry.fullCorpus, `${entry.label}: Vollbestand-Smoke`);
    if (entry.visual !== undefined) assert.equal(result.runVisual, entry.visual, `${entry.label}: Screenshot-Suite`);
    if (entry.buildTargets) assert.deepEqual(result.buildTargets, entry.buildTargets, `${entry.label}: Build-Ziele`);
    if (entry.uiTargets) assert.deepEqual(result.uiTargets, entry.uiTargets, `${entry.label}: UI-Ziele`);
    if (entry.content !== undefined) assert.equal(result.runContentCheck, entry.content, `${entry.label}: Content-Prüfung`);
    if (entry.d1Sync !== undefined) assert.equal(result.runD1Sync, entry.d1Sync, `${entry.label}: D1-Sync`);
    if (entry.unit !== undefined) assert.equal(result.runUnitTests, entry.unit, `${entry.label}: Unit-Tests`);
    if (entry.corpus !== undefined) assert.equal(result.runCorpusTests, entry.corpus, `${entry.label}: Korpus-Tests`);
  }

  // Umfangreiche Bestandsänderung: ab LARGE_CORPUS_CHANGE_THRESHOLD Normen läuft der Vollbestand
  // zusätzlich zum Fixture, und dafür wird OstRecht gebaut – ohne OstRecht-Deployment.
  const many = Array.from({ length: LARGE_CORPUS_CHANGE_THRESHOLD }, (_, index) => `content/normen/norm-${index}/meta.json`);
  const bulk = classify(many);
  assert.equal(bulk.runFullCorpusSmoke, true);
  assert.equal(bulk.largeCorpusChange, true);
  assert.deepEqual(bulk.deployTargets, ['portal']);
  assert.deepEqual(bulk.buildTargets, ['portal', 'law']);
  assert.deepEqual(bulk.uiTargets, ['portal', 'law']);
  const few = classify(many.slice(0, LARGE_CORPUS_CHANGE_THRESHOLD - 1));
  assert.equal(few.runFullCorpusSmoke, false);
  assert.deepEqual(few.buildTargets, ['portal']);
  assert.deepEqual(changedNormSlugs(['content/normen/a/meta.json', 'content/normen/a/versions/x.json', 'content/verkuendungen/b.json']), ['a']);

  // Ohne Änderungsliste (erster Commit) und beim manuellen OstRecht-Release bleibt der Vollbestand Pflicht.
  assert.equal(classify([]).runFullCorpusSmoke, true);
  assert.equal(classifyManualDeploy('law').runFullCorpusSmoke, true);
  assert.equal(classifyManualDeploy('portal').runFullCorpusSmoke, false);
  assert.equal(isFullCorpusPath('apps/recht/src/pages/sitemap.xml.ts', logicPaths), true);
  assert.equal(isFullCorpusPath('apps/recht/src/components/norms/NormBody.astro', logicPaths), false);
});

test('Testscope: D1 und Vollbestand folgen dem Code-Abschluss, Darstellung nur der Oberfläche; ohne Abschluss fail-closed', () => {
  const cases = [
    { label: 'CSS Portal: kein OstRecht, kein D1', paths: ['apps/portal/src/styles/home.css'], scope: 'portal', targets: ['portal'], d1Sync: false, fullCorpus: false, visual: true, corpus: false, content: false },
    { label: 'CSS OstRecht: Fixture genügt, kein Vollbestand-D1', paths: ['apps/recht/src/styles/law-portal.css'], scope: 'law', targets: ['law'], d1Sync: false, fullCorpus: false, visual: true, corpus: false },
    { label: 'origin.ts: die Datei ist Projektionscode – der Nachweis entscheidet erst im Sync', paths: ['packages/shared/src/lib/norms/origin.ts'], scope: 'shared', d1Sync: true, fullCorpus: true, corpus: true },
    { label: 'diff-render.ts reine Darstellung: kein D1, kein Vollbestand', paths: ['packages/shared/src/lib/norms/diff-render.ts'], scope: 'shared', d1Sync: false, fullCorpus: false, visual: true, corpus: false },
    { label: 'site.ts: im Abschluss (Portalbezüge), also D1-relevant – der Nachweis belegt targetLabels als datenneutral', paths: ['packages/shared/src/config/site.ts'], scope: 'shared', d1Sync: true, fullCorpus: true },
    { label: 'Search-Projektor: D1', paths: ['packages/recht-search/src/search.ts'], scope: 'law', d1Sync: true, fullCorpus: true, corpus: true },
    { label: 'D1-Schema: Vollbestand, Content, kein Deployment', paths: ['data/recht/d1/0008_neu.sql'], scope: 'ci-only', d1Sync: false, fullCorpus: true, content: true, buildTargets: ['law'], uiTargets: ['law'] },
    { label: 'Docs: docs-only', paths: ['docs/DEPLOYMENT_RUNBOOK.md', 'README.md'], scope: 'docs-only', unit: false, d1Sync: false, fullCorpus: false, visual: false },
    { label: 'Visual-Test: Screenshot-Suite, keine Smokes', paths: ['tests/visual.spec.ts'], scope: 'ci-only', visual: true, buildTargets: ['portal', 'law'], uiTargets: [] },
    { label: 'Baseline: Screenshot-Suite', paths: ['tests/visual.spec.ts-snapshots/ostrecht-desktop-wide-linux.png'], scope: 'ci-only', visual: true, buildTargets: ['portal', 'law'] },
    { label: 'Korpus-Test: nur Korpus-Tests', paths: ['tests/corpus/d1-projection-equivalence.test.mjs'], scope: 'ci-only', corpus: true, d1Sync: false, fullCorpus: false, content: false },
    { label: 'Testfixture: Smokes, Screenshots und Korpus-Tests, kein Deployment', paths: ['data/recht/runtime-fixture.json'], scope: 'ci-only', corpus: true, content: true, visual: true, buildTargets: ['portal', 'law'], uiTargets: ['portal', 'law'] },
    { label: 'schneller Unit-Test: keine Korpus-Tests', paths: ['tests/norm-sections.test.ts'], scope: 'ci-only', corpus: false },
    { label: 'Font-Messwerkzeug ohne npm-Skript: nur Unit-Tests', paths: ['scripts/measure-font-fallbacks.mjs'], scope: 'ci-only', content: false, corpus: false, buildTargets: [], uiTargets: [] },
    { label: 'Content-Validator aus package.json: Content-Prüfung, keine Korpus-Tests', paths: ['scripts/check-content.mjs'], scope: 'ci-only', content: true, corpus: false },
    { label: 'Importer aus package.json: Content-Prüfung', paths: ['scripts/import-normen.mjs'], scope: 'ci-only', content: true },
    { label: 'Bibliothek unter scripts/lib: konservativ Content-Prüfung', paths: ['scripts/lib/revosax-parser.mjs'], scope: 'ci-only', content: true },
    { label: 'Nachweiswerkzeug: Vollbestand mit OstRecht-Build (Seed-Werkzeug)', paths: ['scripts/d1-projection-snapshot.mjs'], scope: 'ci-only', fullCorpus: true, d1Sync: false },
    { label: 'Abschlussbibliothek: im Abschluss, D1', paths: ['scripts/lib/d1-projection-closure.mjs'], scope: 'ci-only', d1Sync: true, fullCorpus: true },
    { label: 'Abhängigkeiten: Vollbestand und Korpus-Tests', paths: ['package-lock.json'], scope: 'shared', fullCorpus: true, corpus: true },

    // Synthetisches Testfixture: Builder und Lader zählen wie das Manifest data/recht/runtime-fixture.json.
    { label: 'Fixture-Builder: Smokes, Screenshots und Korpus-Tests, kein Deployment', paths: ['tests/helpers/fixture-corpus.ts'], scope: 'ci-only', corpus: true, content: true, visual: true, d1Sync: false, fullCorpus: false, buildTargets: ['portal', 'law'], uiTargets: ['portal', 'law'] },
    { label: 'Fixture-Lader: wie das Manifest', paths: ['scripts/lib/runtime-fixture.mjs'], scope: 'ci-only', corpus: true, content: true, visual: true, d1Sync: false, fullCorpus: false, buildTargets: ['portal', 'law'], uiTargets: ['portal', 'law'] },
    { label: 'anderer Test-Helfer: weiterhin nur Korpus-Tests', paths: ['tests/helpers/law-runtime.ts'], scope: 'ci-only', corpus: true, visual: false, uiTargets: [] },
  ];
  for (const entry of cases) {
    const result = classify(entry.paths);
    assert.equal(result.scope, entry.scope, entry.label);
    if (entry.targets) assert.deepEqual(result.deployTargets, entry.targets, `${entry.label}: Deployment`);
    if (entry.d1Sync !== undefined) assert.equal(result.runD1Sync, entry.d1Sync, `${entry.label}: D1-Sync`);
    if (entry.fullCorpus !== undefined) assert.equal(result.runFullCorpusSmoke, entry.fullCorpus, `${entry.label}: Vollbestand-Smoke`);
    if (entry.visual !== undefined) assert.equal(result.runVisual, entry.visual, `${entry.label}: Screenshot-Suite`);
    if (entry.corpus !== undefined) assert.equal(result.runCorpusTests, entry.corpus, `${entry.label}: Korpus-Tests`);
    if (entry.content !== undefined) assert.equal(result.runContentCheck, entry.content, `${entry.label}: Content-Prüfung`);
    if (entry.unit !== undefined) assert.equal(result.runUnitTests, entry.unit, `${entry.label}: Unit-Tests`);
    if (entry.buildTargets) assert.deepEqual(result.buildTargets, entry.buildTargets, `${entry.label}: Build-Ziele`);
    if (entry.uiTargets) assert.deepEqual(result.uiTargets, entry.uiTargets, `${entry.label}: UI-Ziele`);
    assert.equal(result.closureKnown, true);
  }

  // Unbekannte Datei im Projektionspfad: mit sicherem Abschluss keine Logik (nicht erreicht),
  // ohne Abschluss fail-closed Projektionslogik – ebenso reine Darstellung.
  const unknown = 'packages/shared/src/lib/norms/neue-datei.ts';
  assert.equal(classify([unknown]).runD1Sync, false);
  const conservative = classifyChangeScope([unknown], { logicPaths: null });
  assert.equal(conservative.runD1Sync, true);
  assert.equal(conservative.runFullCorpusSmoke, true);
  assert.equal(conservative.closureKnown, false);
  assert.equal(classifyChangeScope(['packages/shared/src/lib/norms/diff-render.ts'], { logicPaths: null }).runD1Sync, true);
  assert.equal(classifyChangeScope(['packages/recht-search/src/search-query.ts'], { logicPaths: null }).runD1Sync, true);

  // Content-Pipeline aus package.json: Importer, Audits und Validatoren, nicht die Testskripte.
  assert.ok(CONTENT_PIPELINE_SCRIPTS.has('scripts/import-normen.mjs'));
  assert.ok(CONTENT_PIPELINE_SCRIPTS.has('scripts/knowledge.mjs'));
  assert.ok(!CONTENT_PIPELINE_SCRIPTS.has('scripts/measure-font-fallbacks.mjs'));
  assert.deepEqual([...scriptsReferencedBy(['x:'], { 'x:a': 'node scripts/a.mjs --flag && node --experimental-strip-types scripts/lib/b.ts', 'y:b': 'node scripts/c.mjs' })].sort(), ['scripts/a.mjs', 'scripts/lib/b.ts']);
});
