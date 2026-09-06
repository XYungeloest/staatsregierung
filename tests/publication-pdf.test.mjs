import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { findMissingPublicationPdfAssets } from '../scripts/check-deploy-assets.mjs';
import {
  pdfPageCount,
  preserveVerifiedAt,
  publicationIdentityKey,
  publicationIdentityFromPdfFileName,
  retainUnrelatedPublicationSourceReferences,
  resolvePublicationPdf,
} from '../scripts/lib/publication-pdf.mjs';

const pdfFiles = [
  'StAnzO 2026 Nr 5.pdf',
  'OGVBl. 2026 Nr. 68.pdf',
  'historischer-name.pdf',
];

test('alte HTML-Ausgabe findet punktabweichendes Original-PDF über die Ausgabenidentität', () => {
  const result = resolvePublicationPdf({
    publication: 'StAnzO.', year: 2026, issue: '5',
    htmlFileName: 'StAnzO. 2026 Nr. 5.html', pdfFileNames: pdfFiles,
  });
  assert.deepEqual(result, { fileName: 'StAnzO 2026 Nr 5.pdf', strategy: 'publication-identity' });
  assert.equal(publicationIdentityFromPdfFileName(result.fileName), 'StAnzO.|2026|5');
});

test('neue Ausgabe behält das PDF mit identischem Basename', () => {
  assert.deepEqual(resolvePublicationPdf({
    publication: 'OGVBl.', year: 2026, issue: '68',
    htmlFileName: 'OGVBl. 2026 Nr. 68.html', pdfFileNames: pdfFiles,
  }), { fileName: 'OGVBl. 2026 Nr. 68.pdf', strategy: 'exact-basename' });
});

test('OABl.-Alias der Ausgabe 2026 Nr. 2 bleibt auf die eine StAnzO-Identität begrenzt', () => {
  assert.notEqual(publicationIdentityKey('OABl.', 2025, '2'), publicationIdentityKey('StAnzO.', 2026, '2'));
  assert.notEqual(publicationIdentityKey('OABl.', 2026, '1'), publicationIdentityKey('StAnzO.', 2026, '1'));
  assert.equal(publicationIdentityKey('OABl.', 2026, '2'), publicationIdentityKey('StAnzO.', 2026, '2'));
  assert.deepEqual(resolvePublicationPdf({
    publication: 'StAnzO.', year: 2026, issue: '2',
    htmlFileName: 'StAnzO. 2026 Nr. 2.html',
    pdfFileNames: ['OABl 2026 Nr 2.pdf'],
  }), { fileName: 'OABl 2026 Nr 2.pdf', strategy: 'publication-identity' });
});

test('tatsächlich fehlendes PDF erzeugt keinen Link', () => {
  assert.deepEqual(resolvePublicationPdf({
    publication: 'StAnzO.', year: 2026, issue: '2',
    htmlFileName: 'StAnzO. 2026 Nr. 2.html', pdfFileNames: pdfFiles,
  }), { fileName: null, strategy: 'missing', candidates: [] });
});

test('explizit überlieferter historischer Dateiname wird eindeutig aufgelöst', () => {
  assert.deepEqual(resolvePublicationPdf({
    publication: 'OGVBl.', year: 2024, issue: 'I',
    htmlFileName: 'OGVBl I-24.html', configuredPdfFileName: 'historischer-name.pdf', pdfFileNames: pdfFiles,
  }), { fileName: 'historischer-name.pdf', strategy: 'explicit' });
});

test('PDF-Synchronisierung ersetzt nur Quellen derselben Ausgabe und bewahrt Berichtigungsbelege', () => {
  const references = [
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 1.html' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 1.pdf' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 68.pdf', sourceRole: 'correction-evidence' },
    { kind: 'amendment-source', localSource: 'Gesetze/OGVBl. 2026 Nr. 67.html' },
    { kind: 'original', availability: 'not-versioned', label: 'Amtliches Original-PDF' },
  ];
  assert.deepEqual(retainUnrelatedPublicationSourceReferences(references, {
    htmlFileName: 'OGVBl. 2026 Nr. 1.html',
    pdfFileName: 'OGVBl. 2026 Nr. 1.pdf',
  }), [
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 68.pdf', sourceRole: 'correction-evidence' },
    { kind: 'amendment-source', localSource: 'Gesetze/OGVBl. 2026 Nr. 67.html' },
  ]);
});

test('PDF-Seitenobjekte liefern eine geprüfte Seitenzahl', () => {
  const bytes = Buffer.from('%PDF-1.7\n1 0 obj <</Type /Pages>> endobj\n2 0 obj <</Type /Page>> endobj\n3 0 obj <</Type /Page >> endobj');
  assert.equal(pdfPageCount(bytes), 2);
});

test('Deployment-Audit findet einen fehlenden und bestätigt einen vorhandenen PDF-Link', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recht-pdf-audit-'));
  const publications = join(root, 'content/verkuendungen');
  const assets = join(root, 'apps/recht/dist/client');
  await mkdir(join(assets, 'assets/recht'), { recursive: true });
  await mkdir(publications, { recursive: true });
  await writeFile(join(assets, 'assets/recht/vorhanden.pdf'), '%PDF-', 'utf8');
  await writeFile(join(publications, 'a.json'), JSON.stringify({ slug: 'a', pdf: '/assets/recht/vorhanden.pdf' }), 'utf8');
  await writeFile(join(publications, 'b.json'), JSON.stringify({ slug: 'b', pdf: '/assets/recht/fehlt.pdf' }), 'utf8');
  const result = await findMissingPublicationPdfAssets({ publicationRoot: publications, assetRoot: assets });
  assert.equal(result.linkedPdfs, 2);
  assert.deepEqual(result.missing.map((entry) => entry.publication), ['b']);
  await rm(root, { recursive: true, force: true });
});

test('Neuableitung setzt ein dokumentiertes Prüfdatum derselben Datei nie zurück', () => {
  const existing = [
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 73.html', sha256: 'abc', verifiedAt: '2026-09-02' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 73.pdf', sha256: 'def', verifiedAt: '2026-09-02' },
  ];
  const rebuilt = preserveVerifiedAt([
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 73.html', sha256: 'abc', verifiedAt: '2026-08-28' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 73.pdf', sha256: 'def', verifiedAt: '2026-09-04' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 74.pdf', sha256: 'ghi', verifiedAt: '2026-08-28' },
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 73.html', sha256: 'geaendert', verifiedAt: '2026-08-28' },
  ], existing);
  assert.equal(rebuilt[0].verifiedAt, '2026-09-02', 'älteres Datum wird auf den dokumentierten Stand gehoben');
  assert.equal(rebuilt[1].verifiedAt, '2026-09-04', 'ein späteres neues Datum bleibt');
  assert.equal(rebuilt[2].verifiedAt, '2026-08-28', 'fremde Dateien bleiben unberührt');
  assert.equal(rebuilt[3].verifiedAt, '2026-08-28', 'geänderter Hash übernimmt kein altes Prüfdatum');
  assert.deepEqual(preserveVerifiedAt([{ kind: 'original', label: 'ohne Datei' }], existing), [{ kind: 'original', label: 'ohne Datei' }]);
});
