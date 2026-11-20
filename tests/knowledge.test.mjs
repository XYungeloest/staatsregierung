import { bodyDigest, planningIndex, recentEvents, validatePlanning } from '../scripts/lib/knowledge-planning.mjs';
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

const gazette = { sourceId: 'quelle', role: 'primary', locator: 'Artikel 2' };
const planVersion = { versionId: '2031-01-01', validFrom: '2031-01-01', validTo: null, body: [{ text: 'Vorschrift' }] };

function planningFixture() {
  const agenda = { asOf: '2030-11-19', stageDefinitions: { concept: 'Konzept' },
    first100Days: [], additionalLaws: [], majorProjects: [{ id: 'plan', title: 'Plan A', summary: 'Konzept', stage: 'concept', sourceRefs: [gazette] }] };
  const mandate = { id: 'auftrag', tier: 'fristgebunden', normSlug: 'testnorm', versionId: planVersion.versionId, norm: 'TestG',
    provision: '§ 1', instrument: 'plan', obligation: 'muss', subject: 'Plan aufstellen', addressee: 'Träger',
    status: 'offen', asOf: '2030-11-19', validFrom: '2031-01-01', deadline: 'bis Ende Januar', deadlineDate: '2031-01-31',
    evidence: ['quelle'], sourceRefs: [gazette] };
  const duplicate = { id: 'mantel', duplicateOf: 'auftrag', tier: 'fristgebunden', normSlug: 'testnorm', provision: 'Artikel 1' };
  const mandates = { asOf: '2030-11-19', mandates: [mandate, duplicate], versionEvidence: { 'testnorm/2031-01-01': bodyDigest(planVersion) },
    totals: { open: 2, duplicates: 1, listedByTier: { fristgebunden: 1 } } };
  return { agenda, mandates, referenceDate: '2030-11-19', sources: new Map([['quelle', { type: 'official-gazette' }]]),
    ids: [], hasNorm: (slug) => slug === 'testnorm', loadVersion: (slug, version) => slug === 'testnorm' && version === planVersion.versionId ? planVersion : null };
}

test('Planungsindex trennt Entwurf, künftigen Vollzug und Mantelverweis', () => {
  const model = planningFixture();
  assert.deepEqual(validatePlanning(model), []);
  const index = planningIndex(model.agenda, model.mandates);
  assert.equal(index.length, 2);
  assert.equal(index[0].stage, 'concept');
  assert.equal(index[1].validFrom, '2031-01-01');
  assert.ok(index[1].aliases.includes('mantel'));
  assert.equal(index[1].deadlineDate, '2031-01-31');
});

test('Planungsprüfung verwirft unbekannte Quellen, Stufen, Fristen, Duplikate und veränderte Normkörper', () => {
  for (const [change, diagnostic] of [
    [(m) => { m.agenda.majorProjects[0].stage = 'geltend'; }, /Planungsstufe/],
    [(m) => { m.agenda.majorProjects[0].sourceRefs = []; }, /Quellenbeleg/],
    [(m) => { m.agenda.majorProjects[0].id = 'auftrag'; }, /doppelte ID/],
    [(m) => { m.mandates.mandates[0].sourceRefs = [{ ...gazette, sourceId: 'fremd' }]; }, /Quellenverweis/],
    [(m) => { m.mandates.mandates[0].deadlineDate = '2031-02-30'; }, /Frist/],
    [(m) => { m.mandates.mandates[0].normSlug = 'fehlt'; }, /unbekannte Norm/],
    [(m) => { m.mandates.mandates[1].duplicateOf = 'mantel'; }, /duplicateOf/],
    [(m) => { m.mandates.mandates[1].duplicateOf = 'unbekannt'; }, /duplicateOf/],
    [(m) => { m.loadVersion = () => null; }, /erneut prüfen/],
    [(m) => { m.loadVersion = () => ({ ...planVersion, body: [] }); }, /erneut prüfen/],
    [(m) => { m.referenceDate = '2031-02-01'; }, /Friststufe/],
  ]) {
    const model = planningFixture();
    change(model);
    assert.match(validatePlanning(model).join('\n'), diagnostic);
  }
});

test('Vollzugsbelege prüfen explizite Fassungspfade auch im Altbestand', () => {
  const model = planningFixture();
  const [row] = model.mandates.mandates;
  row.evidence = ['Aktenvermerk', 'Test (content/normen/testnorm/versions/2031-01-01.json, § 1)'];
  assert.deepEqual(validatePlanning(model), []);
  row.evidence.push('testnorm/versions/2030-01-01.json');
  assert.match(validatePlanning(model).join('\n'), /auftrag: Normfassung aus evidence fehlt: testnorm\/2030-01-01/u);
});

test('Zeitüberblick lässt ein Gesetzespaket andere Themen nicht verdrängen und zeigt nur eingetretene Ereignisse', () => {
  const events = Array.from({ length: 15 }, (_, i) => ({ id: 'norm-' + i, date: '2030-11-12', tags: ['law'] }));
  events.push({ id: 'wettbewerb', date: '2030-11-12', eventType: 'communication' },
    { id: 'haushalt', date: '2030-11-11', eventType: 'budget' },
    { id: 'spaeter', date: '2031-01-01', eventType: 'budget' });
  const selected = recentEvents(events, '2030-11-19');
  assert.equal(selected.length, 4);
  assert.ok(selected.some((x) => x.id === 'haushalt') && selected.some((x) => x.id === 'wettbewerb'));
  assert.ok(!selected.some((x) => x.id === 'spaeter'));
});
