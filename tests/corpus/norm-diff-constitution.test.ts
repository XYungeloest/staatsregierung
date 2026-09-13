import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildNormChangeMarks } from '@ostrecht/shared/lib/norms/change-marks.ts';
import { buildVersionComparison } from '@ostrecht/shared/lib/norms/diff.ts';
import type { NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Korpustest zu N11: Die Sozialistische Verfassungsnovelle (Fassung 12.09.2026) hat die Abschnitte
 * der Verfassung neu gegliedert. Der Vergleich 21.07.2026 → 12.09.2026 muss genau die 13 neuen
 * Artikel nennen (147 − 134 Einheiten), keinen entfallenen, und nur Artikel mit anderem Wortlaut
 * als geändert; Artikel 7a (seit 21.07.2026) steht in keiner Liste.
 */
const dir = new URL('../../content/normen/staatsverfassung-des-freistaates-ostdeutschland/versions/', import.meta.url);
const load = (versionId: string): NormVersion => JSON.parse(readFileSync(new URL(`${versionId}.json`, dir), 'utf8')) as NormVersion;

test('Verfassung 21.07.2026 → 12.09.2026: 13 neue Artikel, keiner entfallen, Artikel 7a weder neu noch entfallen', () => {
  const before = load('2026-07-21');
  const after = load('2026-09-12');
  const comparison = buildVersionComparison(before, after);
  const units = comparison.provisions.filter((entry) => entry.type === 'article' && !entry.headingOnly);
  const labels = (kind: string) => units.filter((entry) => entry.kind === kind).map((entry) => (entry.after ?? entry.before)?.label ?? '');
  assert.deepEqual(labels('added'), ['Artikel 3a', 'Artikel 7c', 'Artikel 7d', 'Artikel 7e', 'Artikel 13a', 'Artikel 13b', 'Artikel 13c', 'Artikel 13d', 'Artikel 13e', 'Artikel 13f', 'Artikel 35a', 'Artikel 76a', 'Artikel 77a']);
  assert.deepEqual(labels('removed'), []);
  const changed = labels('changed');
  for (const label of ['Artikel 1', 'Artikel 3', 'Artikel 4', 'Artikel 6']) assert.ok(changed.includes(label), `${label} geändert`);
  for (const label of ['Artikel 2', 'Artikel 5']) assert.ok(!changed.includes(label), `${label} unverändert`);
  // Artikel 7a gilt seit 21.07.2026: nie „neu“ oder „entfallen“; die Novelle hat seinen Wortlaut
  // geändert, deshalb steht er – richtig – unter den geänderten Artikeln.
  assert.ok(!labels('added').includes('Artikel 7a') && !labels('removed').includes('Artikel 7a'));
  assert.ok(changed.includes('Artikel 7a'));
  assert.ok(comparison.movedUnits > 0, 'Einheiten sind in andere Abschnitte gewandert');
  assert.ok(comparison.renamedDivisions >= 10, `umbenannte Abschnitte: ${comparison.renamedDivisions}`);

  const marks = buildNormChangeMarks(before, after);
  assert.equal(marks.get('artikel-3a')?.kind, 'added');
  assert.equal(marks.get('artikel-1')?.kind, 'changed');
  assert.equal(marks.get('artikel-7a')?.kind, 'changed');
  assert.equal([...marks.values()].filter((mark) => mark.kind === 'added').length, 13);
  assert.equal([...marks.values()].filter((mark) => mark.kind === 'changed').length, changed.length);
});
