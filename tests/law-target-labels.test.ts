import assert from 'node:assert/strict';
import test from 'node:test';
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';

test('Hauptnavigation des Rechtsportals verwendet die gemeinsamen Zielbezeichnungen', () => {
  for (const entry of lawSiteConfig.mainNavigation) {
    assert.equal(entry.label, lawSiteConfig.targetLabels[entry.pathKey], `Navigationspunkt ${entry.pathKey}`);
  }
});

test('jedes Ziel des Rechtsportals hat genau eine Bezeichnung', () => {
  for (const key of Object.keys(lawSiteConfig.paths) as Array<keyof typeof lawSiteConfig.paths>) {
    assert.ok(lawSiteConfig.targetLabels[key], `Bezeichnung für ${key}`);
  }
  const labels = Object.values(lawSiteConfig.targetLabels);
  assert.equal(new Set(labels).size, labels.length, 'Bezeichnungen sind eindeutig');
});
