import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyChangeScope } from '../scripts/classify-change-scope.mjs';

test('Änderungsscope wird anhand der zentralen Pfadzuordnung parametrisiert bestimmt', () => {
  const cases = [
    { paths: ['README.md'], scope: 'docs-only', targets: [] },
    { paths: ['apps/portal/src/pages/index.astro'], scope: 'portal', targets: ['portal'] },
    { paths: ['apps/recht/src/pages/norm/[slug]/index.astro'], scope: 'law', targets: ['law'] },
    { paths: ['apps/redaktion/src/index.ts'], scope: 'shared', targets: ['portal', 'law'] },
    { paths: ['packages/portal-search/src/index.ts'], scope: 'portal', targets: ['portal'] },
    { paths: ['packages/recht-search/src/index.ts'], scope: 'law', targets: ['law'] },
    { paths: ['packages/shared/src/components/portal/SectionHero.astro'], scope: 'shared', targets: ['portal', 'law'] },
    { paths: ['content/normen/sero-verordnung/meta.json'], scope: 'shared', targets: ['portal', 'law'] },
    { paths: ['Gesetze/SERO-Verordnung.html'], scope: 'shared', targets: ['portal', 'law'] },
    { paths: ['knowledge/README.md'], scope: 'shared', targets: ['portal', 'law'] },
    { paths: ['package-lock.json'], scope: 'shared', targets: ['portal', 'law'] },
    { paths: ['scripts/prepare-site-public.mjs'], scope: 'shared', targets: ['portal', 'law'] },
    { paths: ['.github/workflows/deploy.yml'], scope: 'shared', targets: ['portal', 'law'] },
  ];

  for (const entry of cases) {
    const result = classifyChangeScope(entry.paths);
    assert.equal(result.scope, entry.scope, entry.paths.join(', '));
    assert.deepEqual(result.targets, entry.targets, entry.paths.join(', '));
  }
});
