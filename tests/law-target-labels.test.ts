import assert from 'node:assert/strict';
import test from 'node:test';
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';
import type { NormStatus } from '@ostrecht/shared/lib/norms/schema.ts';

import { DIRECTORY_STATUS_OPTIONS } from '../apps/recht/src/lib/runtime/directory.ts';
import {
  VALIDITY_FIELD_LABEL,
  VERSION_FIELD_LABEL,
  VERSION_SCOPE_OPTIONS,
  validityLabel,
  validityOptions,
} from '../apps/recht/src/lib/vocabulary.ts';

const NORM_STATUSES = Object.keys(lawSiteConfig.vocabulary.validity.byStatus) as NormStatus[];

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

test('aufgelöste Bereiche sind keine eigenen Ziele mehr', () => {
  // Fundstellen sind eine Ansicht der Verkündungen, die Rechtsentwicklung eine Sicht der Suche.
  assert.equal(Object.hasOwn(lawSiteConfig.paths, 'references'), false);
  assert.equal(Object.hasOwn(lawSiteConfig.paths, 'development'), false);
  assert.equal(Object.hasOwn(lawSiteConfig.targetLabels, 'references'), false);
  assert.equal(Object.hasOwn(lawSiteConfig.targetLabels, 'development'), false);
});

/**
 * Eine Wortliste für Geltung und Fassung: die drei Auswahlfelder des Portals (Verzeichnisfilter,
 * Geltungsfacette der Suche, Fassungsauswahl der Suche) führen keine eigenen Wörter.
 */
test('die Optionen des Verzeichnisfilters stammen aus der Wortliste', () => {
  const words = new Set<string>(Object.values(lawSiteConfig.vocabulary.validity.byStatus));
  assert.ok(DIRECTORY_STATUS_OPTIONS.length > 0, 'Auswahl ist belegt');
  for (const option of DIRECTORY_STATUS_OPTIONS) {
    assert.ok(words.has(option.label), `Geltungswort „${option.label}“`);
    assert.ok(option.statuses.length > 0, `Rechtsstände zu „${option.label}“`);
    for (const status of option.statuses) {
      assert.equal(validityLabel(status as NormStatus), option.label, `Rechtsstand ${status}`);
    }
  }
  const labels = DIRECTORY_STATUS_OPTIONS.map((option) => option.label);
  assert.equal(new Set(labels).size, labels.length, 'kein Wort steht zweimal zur Wahl');
});

test('validityOptions fasst gleich benannte Rechtsstände zu einer Auswahl zusammen', () => {
  const options = validityOptions(NORM_STATUSES);
  const labels = options.map((option) => option.label);
  assert.equal(new Set(labels).size, labels.length, 'keine Doppelung');
  assert.deepEqual(
    [...new Set(NORM_STATUSES.map((status) => validityLabel(status)))].sort(),
    [...labels].sort(),
    'jedes Wort der Wortliste ist genau einmal wählbar',
  );
  assert.ok(labels.includes(lawSiteConfig.vocabulary.validity.byStatus['one-time-act']), 'einmaliger Rechtsakt ist wählbar');
  // „Außer Kraft“ steht für zwei Rechtsstände; die Auswahl führt beide.
  const repealed = options.find((option) => option.label === lawSiteConfig.vocabulary.validity.byStatus.repealed);
  assert.deepEqual(repealed?.statuses.slice().sort(), ['historical', 'repealed']);
});

test('die Fassungsauswahl der Suche nennt die Fassungsarten der Wortliste', () => {
  const version = lawSiteConfig.vocabulary.version;
  assert.deepEqual(
    VERSION_SCOPE_OPTIONS.map((option) => option.label),
    [
      version.byKind.current.many,
      version.byKind.future.many,
      version.byKind.historical.many,
      version.byKind['unknown-effective'].many,
      version.any,
    ],
  );
});

test('die Auswahlfelder beschriften ihr Feld mit dem Wort der Wortliste', () => {
  assert.equal(VALIDITY_FIELD_LABEL, lawSiteConfig.vocabulary.validity.label);
  assert.equal(VERSION_FIELD_LABEL, lawSiteConfig.vocabulary.version.label);
  assert.equal(lawSiteConfig.vocabulary.validity.label, 'Geltung');
});
