import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { auditCorpus, auditNormRecord, isBaselineImport, loadCorpus } from '../scripts/audit-ost-residuals.mjs';
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

test('der Bestandsaudit trennt übernommenes Recht (muss leer sein) und verzeichneten Altbestand', () => {
  const legacy = {
    ...record({ meta: { title: 'Sächsisches Altgesetz' } }),
    slug: 'altgesetz',
    versions: [{ ...record().versions[0], sourceReferences: [{ kind: 'revosax-snapshot', availability: 'versioned', localSource: 'Gesetze/x.html', label: 'x' }] }],
  };
  legacy.meta.sourceReferences = [];
  const clean = record();
  const okResult = auditCorpus([clean, legacy], { norms: { altgesetz: { residuals: 1 } } });
  assert.deepEqual(okResult.problems, []);
  const drift = auditCorpus([clean, legacy], { norms: { altgesetz: { residuals: 3 } } });
  assert.equal(drift.problems.length, 1);
  const unknown = auditCorpus([clean, legacy], { norms: {} });
  assert.match(unknown.problems[0], /nicht im Rückstand/u);
  const baselineResidual = auditCorpus([record({ meta: { title: 'Sächsisches Testgesetz' } })], { norms: {} });
  assert.equal(baselineResidual.baseline.length, 1);
});

test('der materialisierte Rechtsbestand enthält im übernommenen Recht keine Reststellen und entspricht dem Rückstand', async () => {
  const backlog = JSON.parse(await readFile(new URL('../data/recht/ost-residual-backlog.json', import.meta.url), 'utf8'));
  const norms = await loadCorpus();
  const result = auditCorpus(norms, backlog);
  assert.deepEqual(result.baseline.map((entry) => `${entry.slug}: ${entry.findings[0]?.context}`), []);
  assert.deepEqual(result.problems, []);
});
