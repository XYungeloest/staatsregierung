import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyChangeScope, classifyManualDeploy } from '../scripts/classify-change-scope.mjs';

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
      paths: ['content/normen/sero-verordnung/meta.json'],
      scope: 'portal',
      targets: ['portal'],
      content: true,
      d1Sync: true,
    },
    {
      label: 'J2: Verkündungen laufen über D1',
      paths: ['content/verkuendungen/2024/sero-verordnung.json'],
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
      label: 'J4: Sync-Skript allein schreibt die Projektion neu',
      paths: ['scripts/sync-recht-d1.mjs'],
      scope: 'ci-only',
      targets: [],
      content: true,
      d1Sync: true,
    },
    {
      label: 'J5: Normbibliothek ist Laufzeit beider Websites und D1-Projektion',
      paths: ['packages/shared/src/lib/norms/derived.ts'],
      scope: 'shared',
      targets: ['portal', 'law'],
      d1Sync: true,
    },
    {
      label: 'J6: D1-Migrationen werden bewusst manuell eingespielt',
      paths: ['data/recht/d1/0005_beispiel.sql'],
      scope: 'ci-only',
      targets: [],
      content: true,
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
      paths: ['Gesetze/SERO-Verordnung.html'],
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
      : classifyChangeScope(entry.paths);
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
  }
});
