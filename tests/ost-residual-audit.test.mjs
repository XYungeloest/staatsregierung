import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { auditCorpus, auditNormRecord, isBaselineImport, isInheritedNorm, lettersOnly, loadCorpus, sourceTextOf } from '../scripts/audit-ost-residuals.mjs';
import { adaptParsedRevosaxSnapshot } from '../scripts/lib/revosax-ost-adapter.mjs';

const r2Reference = {
  kind: 'revosax-snapshot',
  label: 'Amtliche REVOSax-Fassung 1.1',
  availability: 'r2-archived',
  objectKey: 'revosax/2023-11-01/1.html',
  url: 'https://www.revosax.sachsen.de/vorschrift/1',
  retrievedAt: '2026-09-03',
  sha256: 'a'.repeat(64),
  lawId: '1',
  sourceValidFrom: '2000-01-01',
  sourceRole: 'official-snapshot',
  mediaType: 'text/html',
};

function record(overrides = {}) {
  return {
    slug: 'testnorm',
    meta: {
      id: 'testnorm',
      slug: 'testnorm',
      title: 'Ostdeutsches Testgesetz',
      shortTitle: 'Testgesetz',
      abbr: 'OstTestG',
      keywords: ['OstTestG'],
      summary: 'Enthält die Regelungen der übernommenen Ausgangsfassung.',
      initialCitation: 'Ostdeutsches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1)',
      originEnactingBody: 'Sächsischer Landtag',
      sourceReferences: [r2Reference],
      ...overrides.meta,
    },
    versions: [{
      versionId: '2023-11-01',
      title: 'Ostdeutsches Testgesetz',
      changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01: übernommener Rechtsstand dieses Tages.',
      sourceReferences: [r2Reference],
      sourceNotes: [{ label: 'Quelle', text: 'Sächsisches Staatsministerium, SächsGVBl.' }],
      body: [{ type: 'paragraph', label: '§ 1', title: 'Geltung', children: [{ type: 'paragraphText', text: 'Dieses Gesetz gilt im Freistaat Ostdeutschland; Sachsen-Anhalt bleibt unberührt (SächsGVBl. S. 1).' }] }],
      ...overrides.version,
    }],
  };
}

test('ein sauber übergeleiteter Datensatz ist reststellenfrei; Provenienzfelder zählen nicht', () => {
  assert.deepEqual(auditNormRecord(record()), []);
  assert.equal(isBaselineImport(record().meta, record().versions), true);
});

test('absichtlich verbliebene Sachsen-Bezüge in normativen Feldern werden gefunden', () => {
  const stale = record({
    meta: { shortTitle: 'Änd. SächsVerfGHG', keywords: ['SächsVerfGHG'], summary: 'Übernommene Änderungsvorschrift: „Änd. SächsVerfGHG“.' },
    version: { body: [{ type: 'paragraphText', text: 'Das SächsVerfGHG wird wie folgt geändert: Der Sächsische Landtag beschließt.' }] },
  });
  const findings = auditNormRecord(stale);
  assert.deepEqual(findings.map((finding) => finding.path).sort(), [
    'testnorm.meta.keywords[0]',
    'testnorm.meta.shortTitle',
    'testnorm.meta.summary',
    'testnorm.versions[0].body[0].text',
  ]);
  // Nach der Anpassung durch den Adapter ist der Körper reststellenfrei.
  const adapted = adaptParsedRevosaxSnapshot({ sourceTitle: 'x', shortTitle: 'x', fullCitation: 'x', body: stale.versions[0].body });
  assert.deepEqual(auditNormRecord(record({ version: { body: adapted.body } })), []);
});

test('Adapterartefakte (Niederostdeutsch) und zusammengesetzte Kürzel werden erkannt, Webadressen nicht', () => {
  const artefact = record({ version: { body: [{ type: 'paragraphText', text: 'Die Niederostdeutsche Staatskanzlei und die DVOSächsBO.' }] } });
  assert.deepEqual(auditNormRecord(artefact).map((finding) => finding.token).sort(), ['Niederostdeutsche', 'Sächs']);
  const address = record({ version: { body: [{ type: 'paragraphText', text: 'Siehe https://www.revosax.sachsen.de/vorschrift/1 und post@smk.sachsen.de.' }] } });
  assert.deepEqual(auditNormRecord(address), []);
});

test('übergeleitetes Recht (auch konsolidierte Altbestandsnormen mit versioniertem Snapshot) muss reststellenfrei sein', async () => {
  const consolidated = {
    ...record({ meta: { title: 'Sächsisches Altgesetz' } }),
    slug: 'altgesetz',
    versions: [{ ...record().versions[0], sourceReferences: [{ kind: 'revosax-snapshot', availability: 'versioned', localSource: 'data/recht/sources/revosax/x.html', label: 'x' }] }],
  };
  consolidated.meta.sourceReferences = [];
  assert.equal(isInheritedNorm(consolidated.meta, consolidated.versions), true);
  assert.equal(isBaselineImport(consolidated.meta, consolidated.versions), false);
  const result = await auditCorpus([record(), consolidated], { norms: {} });
  assert.equal(result.inherited.length, 1);
  assert.match(result.problems[0], /altgesetz: 1 Sachsen-Reststelle\(n\) in übergeleitetem Recht/u);
  const baselineResidual = await auditCorpus([record({ meta: { title: 'Sächsisches Testgesetz' } })], { norms: {} });
  assert.equal(baselineResidual.inherited.length, 1);
});

test('eigene ostdeutsche Erlasse: Sachsen-Bezüge gelten nur, wenn sie wörtlich in der amtlichen Quelle stehen', async () => {
  const own = (text) => ({
    ...record({ version: { body: [{ type: 'paragraphText', text }], sourceReferences: [{ kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/Erlass.html', label: 'x' }] } }),
    slug: 'eigener-erlass',
  });
  own('x').meta.sourceReferences = [];
  const cited = own('Das Sächsische Bestattungsgesetz vom 8. Juli 1994 (SächsGVBl. S. 1321) wird wie folgt geändert:');
  cited.meta.sourceReferences = [];
  const sourceHtml = '<p>Das S&auml;chsische Bestattungsgesetz vom 8.&nbsp;Juli 1994 (S&auml;chsGVBl. S.&nbsp;1321) wird wie folgt ge&auml;ndert:</p>';
  assert.equal(lettersOnly(sourceTextOf(sourceHtml, 'Gesetze/Erlass.html')).includes('sächsischebestattungsgesetz'), true);
  const loader = async () => lettersOnly(sourceTextOf(sourceHtml, 'Gesetze/Erlass.html'));
  const backed = await auditCorpus([cited], { norms: {} }, { loadSource: loader });
  assert.deepEqual(backed.problems, []);
  assert.equal(backed.backed.get('eigener-erlass')?.length, 1);
  assert.equal(backed.legacy.size, 0);
  // Weicht der Wortlaut von der Quelle ab, bleibt die Stelle eine Reststelle und braucht einen Rückstandseintrag.
  const deviating = own('Das Sächsische Bestattungsrecht vom 8. Juli 1994 (SächsGVBl. S. 1321) wird wie folgt geändert:');
  deviating.meta.sourceReferences = [];
  const unbacked = await auditCorpus([deviating], { norms: {} }, { loadSource: loader });
  assert.match(unbacked.problems[0], /unbelegte/u);
  const recorded = await auditCorpus([deviating], { norms: { 'eigener-erlass': { residuals: 1 } } }, { loadSource: loader });
  assert.deepEqual(recorded.problems, []);
  const drift = await auditCorpus([deviating], { norms: { 'eigener-erlass': { residuals: 3 } } }, { loadSource: loader });
  assert.equal(drift.problems.length, 1);
  // Adapterartefakte sind nie quellenbelegt.
  const artefact = own('Die Niederostdeutsche Staatskanzlei.');
  artefact.meta.sourceReferences = [];
  const artefactResult = await auditCorpus([artefact], { norms: {} }, { loadSource: async () => lettersOnly('Die Niederostdeutsche Staatskanzlei.') });
  assert.equal(artefactResult.legacy.size, 1);
});

test('der materialisierte Rechtsbestand enthält im übergeleiteten Recht keine Reststellen; eigene Erlasse sind belegt oder verzeichnet', async () => {
  const backlog = JSON.parse(await readFile(new URL('../data/recht/ost-residual-backlog.json', import.meta.url), 'utf8'));
  const norms = await loadCorpus();
  const result = await auditCorpus(norms, backlog);
  assert.deepEqual(result.inherited.map((entry) => `${entry.slug}: ${entry.findings[0]?.context}`), []);
  assert.deepEqual(result.problems, []);
  assert.equal(backlog.normCount, 0, 'Zielzustand: leerer Rückstand');
});
