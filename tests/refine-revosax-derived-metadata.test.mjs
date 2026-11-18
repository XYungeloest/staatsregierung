import assert from 'node:assert/strict';
import test from 'node:test';

import { isSaxonDesignation } from '../scripts/refine-revosax-derived-metadata.mjs';

test('Bezeichnungen mit geschütztem Eigennamen gelten nicht als sächsische Reststelle', () => {
  assert.equal(isSaxonDesignation('VO Musterschutzgebiet „Sächsische Schweiz“'), false);
  assert.equal(isSaxonDesignation('Änd. VO Region Sächsische Schweiz-Osterzgebirge'), false);
  assert.equal(isSaxonDesignation('Abkommen mit Sachsen-Anhalt'), false);
});

test('Bezeichnungen mit Landesbezug bleiben sächsische Reststellen', () => {
  assert.equal(isSaxonDesignation('SächsMusterG'), true);
  assert.equal(isSaxonDesignation('Änd. Sächs-MusterG'), true);
  assert.equal(isSaxonDesignation('Mustergesetz des Freistaates Sachsen'), true);
  assert.equal(isSaxonDesignation('Sächsisches Mustergesetz und Sächsische Schweiz'), true);
});

test('geschützte Fundstellenkürzel machen eine Bezeichnung nicht zum Schlagwort', () => {
  assert.equal(isSaxonDesignation('VwV SächsGVBl.'), true);
});
