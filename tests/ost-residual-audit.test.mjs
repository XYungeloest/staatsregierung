import assert from 'node:assert/strict';
import test from 'node:test';

import { auditCorpus, auditNormRecord, isBaselineImport, isInheritedNorm, isSourceBacked, lettersOnly, sourceTextOf } from '../scripts/audit-ost-residuals.mjs';
import { adaptParsedRevosaxSnapshot } from '../scripts/lib/revosax-ost-adapter.mjs';

/**
 * Reststellen-Audit auf synthetischen Datensätzen: was als Sachsen-Reststelle zählt, was
 * geschützt ist (Fundstellen, Adressen, Sachsen-Anhalt) und wie eigene Erlasse quellenbelegt
 * werden. Ob der reale Bestand reststellenfrei ist, prüft scripts/audit-ost-residuals.mjs
 * in content:check.
 */

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
    'testnorm.versions[0].body[0].text',
  ]);
  assert.deepEqual(findings.filter((finding) => finding.path.endsWith('.text')).map((finding) => finding.token), ['SächsV', 'Sächsi']);
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

test('jede Fundstelle je String wird einzeln mit Index und Kontext gemeldet', () => {
  const findings = auditNormRecord({ slug: 'n', meta: { title: 'Gesetz über die Sächsische Aufbaubank und die sächsischen Sparkassen' }, versions: [] });
  assert.deepEqual(findings.map((finding) => [finding.token, finding.index]), [['Sächsi', 16], ['sächsi', 46]]);
  assert.ok(findings.every((finding) => finding.path === 'n.meta.title' && finding.context.length > 0 && finding.window.length > 0));
});

test('quellenbelegt gilt je Fundstelle: erste belegt, zweite unbelegt; beide belegt', async () => {
  const meta = { title: 'X', sourceReferences: [{ kind: 'ostrecht-transcription', localSource: 'Gesetze/x.html' }] };
  const findings = auditNormRecord({ slug: 'x', meta, versions: [{ body: [{ type: 'paragraphText', text: 'Das Sächsische Beamtengesetz wird in Ostdeutsches Beamtengesetz umbenannt; das Sächsische Richtergesetz bleibt unberührt.' }] }] });
  assert.equal(findings.length, 2);
  const loadSource = async () => lettersOnly('Das Sächsische Beamtengesetz wird in Ostdeutsches Beamtengesetz umbenannt; das Thüringer Richtergesetz bleibt unberührt.');
  assert.equal(await isSourceBacked(findings[0], ['Gesetze/x.html'], loadSource), true);
  assert.equal(await isSourceBacked(findings[1], ['Gesetze/x.html'], loadSource), false);
  const text = 'Das Sächsische Beamtengesetz und das Sächsische Richtergesetz gelten fort.';
  const both = auditNormRecord({ slug: 'y', meta: { title: 'Y' }, versions: [{ body: [{ type: 'paragraphText', text }] }] });
  assert.equal(both.length, 2);
  for (const finding of both) assert.equal(await isSourceBacked(finding, ['Gesetze/y.html'], async () => lettersOnly(text)), true);
});

test('geschützte Fundstellenkürzel, Sachsen-Anhalt und Adressen sind keine Reststellen; SächsVerfGHG und Adapterartefakte schon', () => {
  const citation = auditNormRecord({ slug: 'z', meta: { title: 'Z' }, versions: [{ citation: 'Vom 1. Januar 2020 (SächsGVBl. S. 1), geändert durch Verordnung vom 2. Februar 2021 (SächsGVBl. S. 2, SächsABl. S. 3) und das Sächsische Ausführungsgesetz' }] });
  assert.deepEqual(citation.map((finding) => finding.token), ['Sächsi']);
  assert.ok(citation[0].index > 100);
  assert.deepEqual(auditNormRecord({ slug: 'a', meta: { title: 'Staatsvertrag mit Sachsen-Anhalt', summary: 'Siehe https://www.sachsen.de/x und post@sachsen.de.' }, versions: [] }), []);
  const findings = auditNormRecord({ slug: 'b', meta: { title: 'Gesetz nach § 7 SächsVerfGHG (SächsGVBl. S. 9)' }, versions: [{ body: [{ type: 'paragraphText', text: 'Die Niederostdeutsche Landesbank ist beteiligt.' }] }] });
  assert.deepEqual(findings.map((finding) => [finding.token, finding.artefact === true]), [['SächsV', false], ['Niederostdeutsche', true]]);
});
