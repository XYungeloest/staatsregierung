import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContext, validateCurrentNormReference, validateCurrentNormRefs } from '../scripts/knowledge.mjs';

const section = {
  id: 'state-current-constitution',
  normSlug: 'fixture-grundordnung',
  versionId: '2030-02-01',
  validFrom: '2030-02-01',
  validTo: null,
  summary: 'Die Neufassung führt einen zusätzlichen Abschnitt ein.',
  sourceRefs: [{ sourceId: 'fixture-source', role: 'primary' }],
};
const version = { versionId: section.versionId, validFrom: section.validFrom, validTo: null };
const sources = new Map([['fixture-source', {
  path: `content/normen/${section.normSlug}/versions/${section.versionId}.json`,
}]]);

test('aktuelle Normverweise gelten ab dem ersten und bis einschließlich zum letzten Gültigkeitstag', () => {
  assert.deepEqual(validateCurrentNormReference(section, version, sources, '2030-02-01'), []);
  const end = { validTo: '2030-02-28' };
  assert.deepEqual(validateCurrentNormReference({ ...section, ...end }, { ...version, ...end }, sources, '2030-02-28'), []);
});

test('zukünftige und abgelaufene Fassungen sind kein aktueller Rechtsstand, unabhängig von isCurrent', () => {
  assert.match(validateCurrentNormReference(section, { ...version, isCurrent: true }, sources, '2030-01-31').join(), /gilt nicht/);
  assert.match(validateCurrentNormReference(section, { ...version, validTo: '2030-02-28', isCurrent: true }, sources, '2030-03-01').join(), /gilt nicht/);
});

test('aktuelle Normverweise benötigen die passende gespeicherte Fassung und ihr Gültigkeitsintervall', () => {
  assert.match(validateCurrentNormReference(section, null, sources, '2030-02-01').join(), /fehlt/);
  assert.match(validateCurrentNormReference(section, { ...version, versionId: '2030-01-01' }, sources, '2030-02-01').join(), /fehlt/);
  assert.match(validateCurrentNormReference({ ...section, validFrom: '2030-01-01' }, version, sources, '2030-02-01').join(), /Gültigkeitsintervall/);
});

test('ein aktueller Normverweis muss genau diese Fassung als Primärquelle belegen', () => {
  const stale = new Map([['fixture-source', { path: `content/normen/${section.normSlug}/versions/2030-01-01.json` }]]);
  assert.match(validateCurrentNormReference(section, version, stale, '2030-02-01').join(), /Primärquelle/);
  assert.match(validateCurrentNormReference({ ...section, sourceRefs: [{ sourceId: 'fixture-source', role: 'context' }] }, version, sources, '2030-02-01').join(), /Primärquelle/);
});

test('auch zusätzliche Normverweise eines aktuellen Abschnitts müssen am Stichtag gelten', () => {
  const stored = new Map([
    ['fixture-grundordnung/2030-02-01', { versionId: '2030-02-01', validFrom: '2030-02-01', validTo: null }],
    ['fixture-grundordnung/2029-06-01', { versionId: '2029-06-01', validFrom: '2029-06-01', validTo: '2030-01-31' }],
    ['fixture-errichtungsgesetz/2030-04-01', { versionId: '2030-04-01', validFrom: '2030-04-01', validTo: null }],
  ]);
  const load = (normSlug, versionId) => stored.get(`${normSlug}/${versionId}`) ?? null;
  const withRefs = (normRefs) => ({ id: 'state-current-fixture', normRefs });
  assert.deepEqual(validateCurrentNormRefs(withRefs([{ normSlug: 'fixture-grundordnung', versionId: '2030-02-01' }]), load, '2030-02-10'), []);
  assert.deepEqual(validateCurrentNormRefs({ id: 'state-current-fixture' }, load, '2030-02-10'), []);
  assert.match(validateCurrentNormRefs(withRefs([{ normSlug: 'fixture-grundordnung', versionId: '2029-06-01' }]), load, '2030-02-10').join(), /normRefs\[0\].*gilt nicht/);
  assert.match(validateCurrentNormRefs(withRefs([{ normSlug: 'fixture-errichtungsgesetz', versionId: '2030-04-01' }]), load, '2030-02-10').join(), /gilt nicht/);
  assert.match(validateCurrentNormRefs(withRefs([{ normSlug: 'fixture-grundordnung', versionId: '2031-01-01' }]), load, '2030-02-10').join(), /fehlt/);
  assert.match(validateCurrentNormRefs(withRefs([{ normSlug: '../fremd', versionId: '2030-02-01' }]), load, '2030-02-10').join(), /gültige Kennungen/);
});

test('der Gesamtkontext übernimmt Fassung, Gültigkeitsbeginn und Zusammenfassung aus den redaktionellen Daten', () => {
  const organs = { id: 'state-current-organs', summary: 'Aktueller Organkern.', notes: ['Eine Neuordnung ist bereits verkündet.'] };
  const model = {
    editorial: { referenceDate: '2030-02-10' },
    byType: new Map([['current-state', [section, organs]]]),
    holdingPositions: { totals: {} },
  };
  const context = buildContext(model);
  assert.ok(context.includes(`Version \`${section.versionId}\`, gültig seit ${section.validFrom}.`));
  assert.ok(context.includes(section.summary));
  assert.ok(context.includes(organs.summary));
  assert.ok(context.includes(organs.notes[0]));
  const updated = { ...section, versionId: '2030-03-01', validFrom: '2030-03-01', summary: 'Eine weitere Reform ist berücksichtigt.' };
  model.byType.set('current-state', [updated, organs]);
  const next = buildContext(model);
  assert.ok(next.includes(updated.summary));
  assert.ok(next.includes(`Version \`${updated.versionId}\`, gültig seit ${updated.validFrom}.`));
  assert.ok(!next.includes(section.summary));
});
