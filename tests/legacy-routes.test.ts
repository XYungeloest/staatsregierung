import assert from 'node:assert/strict';
import test from 'node:test';

import { legacyRoutes } from '../apps/portal/src/config/legacy-routes.mjs';

test('belegte Altadressen sind eindeutig und führen nur auf interne Portalpfade', () => {
  const sources = legacyRoutes.map((route) => route.source);
  assert.equal(new Set(sources).size, sources.length);
  for (const route of legacyRoutes) {
    assert.ok(route.source.startsWith('/'));
    assert.ok(route.target.startsWith('/'));
    assert.equal(/[\s?#]/u.test(route.source), false);
    assert.equal(/[\s?#]/u.test(route.target), false);
    assert.notEqual(route.source, route.target);
  }
});
