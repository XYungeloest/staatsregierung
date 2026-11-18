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
  publicationPdfFileName,
  publicationPdfPublicPath,
  retainUnrelatedPublicationSourceReferences,
  resolvePublicationPdf,
} from '../scripts/lib/publication-pdf.mjs';

const pdfFiles = [
  'StAnzO 2026 Nr 905.pdf',
  'OGVBl. 2026 Nr. 968.pdf',
  'historischer-name.pdf',
];

test('alte HTML-Ausgabe findet punktabweichendes Original-PDF über die Ausgabenidentität', () => {
  const result = resolvePublicationPdf({
    publication: 'StAnzO.', year: 2026, issue: '905',
    htmlFileName: 'StAnzO. 2026 Nr. 905.html', pdfFileNames: pdfFiles,
  });
  assert.deepEqual(result, { fileName: 'StAnzO 2026 Nr 905.pdf', strategy: 'publication-identity' });
  assert.equal(publicationIdentityFromPdfFileName(result.fileName), 'StAnzO.|2026|905');
});

test('neue Ausgabe behält das PDF mit identischem Basename', () => {
  assert.deepEqual(resolvePublicationPdf({
    publication: 'OGVBl.', year: 2026, issue: '968',
    htmlFileName: 'OGVBl. 2026 Nr. 968.html', pdfFileNames: pdfFiles,
  }), { fileName: 'OGVBl. 2026 Nr. 968.pdf', strategy: 'exact-basename' });
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
    publication: 'StAnzO.', year: 2026, issue: '902',
    htmlFileName: 'StAnzO. 2026 Nr. 902.html', pdfFileNames: pdfFiles,
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
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 901.html' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 901.pdf' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 968.pdf', sourceRole: 'correction-evidence' },
    { kind: 'amendment-source', localSource: 'Gesetze/OGVBl. 2026 Nr. 967.html' },
    { kind: 'original', availability: 'not-versioned', label: 'Amtliches Original-PDF' },
  ];
  assert.deepEqual(retainUnrelatedPublicationSourceReferences(references, {
    htmlFileName: 'OGVBl. 2026 Nr. 901.html',
    pdfFileName: 'OGVBl. 2026 Nr. 901.pdf',
  }), [
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 968.pdf', sourceRole: 'correction-evidence' },
    { kind: 'amendment-source', localSource: 'Gesetze/OGVBl. 2026 Nr. 967.html' },
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
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 973.html', sha256: 'abc', verifiedAt: '2026-09-02' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 973.pdf', sha256: 'def', verifiedAt: '2026-09-02' },
  ];
  const rebuilt = preserveVerifiedAt([
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 973.html', sha256: 'abc', verifiedAt: '2026-08-28' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 973.pdf', sha256: 'def', verifiedAt: '2026-09-04' },
    { kind: 'primary-pdf', localSource: 'Gesetze/OGVBl. 2026 Nr. 974.pdf', sha256: 'ghi', verifiedAt: '2026-08-28' },
    { kind: 'structured-html-transcription', localSource: 'Gesetze/OGVBl. 2026 Nr. 973.html', sha256: 'geaendert', verifiedAt: '2026-08-28' },
  ], existing);
  assert.equal(rebuilt[0].verifiedAt, '2026-09-02', 'älteres Datum wird auf den dokumentierten Stand gehoben');
  assert.equal(rebuilt[1].verifiedAt, '2026-09-04', 'ein späteres neues Datum bleibt');
  assert.equal(rebuilt[2].verifiedAt, '2026-08-28', 'fremde Dateien bleiben unberührt');
  assert.equal(rebuilt[3].verifiedAt, '2026-08-28', 'geänderter Hash übernimmt kein altes Prüfdatum');
  assert.deepEqual(preserveVerifiedAt([{ kind: 'original', label: 'ohne Datei' }], existing), [{ kind: 'original', label: 'ohne Datei' }]);
});

test('der öffentliche Name eines Ausgaben-PDFs ist der Slug der Ausgabe', () => {
  assert.equal(publicationPdfFileName('testblatt-2026-01'), 'testblatt-2026-01.pdf');
  assert.equal(publicationPdfPublicPath('testblatt-2026-01'), '/assets/recht/testblatt-2026-01.pdf');
  // Slugs enthalten weder Leerzeichen noch Punkte: die Adresse braucht keine Kodierung.
  const path = publicationPdfPublicPath('einzelverkuendung-2026-03-01');
  assert.equal(path, encodeURI(path));
  assert.equal(/[ .]/u.test(path.replace(/\.pdf$/u, '')), false);
});

test('jede Verkündung im Bestand verweist auf ihren eigenen Slug-Namen', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const root = new URL('../content/verkuendungen/', import.meta.url);
  const files = (await readdir(root)).filter((name) => name.endsWith('.json'));
  assert.ok(files.length > 0, 'Verkündungen vorhanden');
  for (const file of files) {
    const publication = JSON.parse(await readFile(new URL(file, root), 'utf8'));
    if (!publication.pdf) continue;
    assert.equal(publication.pdf, publicationPdfPublicPath(publication.slug), file);
  }
});

test('einziges PDF ohne Transkription ist die strukturtragende Quelle', async () => {
  const { publicationSourceReferences, hasPublicationTranscription } = await import('../scripts/lib/publication-pdf.mjs');
  const pdfBytes = Buffer.from('%PDF-1.7\n1 0 obj <</Type /Page>> endobj\n2 0 obj <</Type /Page>> endobj');
  assert.equal(hasPublicationTranscription([{ kind: 'primary-pdf' }, { kind: 'index' }], null), false);
  assert.equal(hasPublicationTranscription([{ kind: 'legacy-markdown-transcription' }], null), true);
  assert.equal(hasPublicationTranscription([], 'Blatt 2026 Nr. 1.html'), true);
  const [sole] = publicationSourceReferences({
    pdfFileName: 'Blatt 2026 Nr. 1.pdf', pdfBytes, pageRange: '2', verifiedAt: '2026-11-13', soleSource: true,
  });
  assert.equal(sole.sourceRole, 'structure-bearing');
  assert.equal(sole.label, 'Amtliche Veröffentlichungsfassung');
  assert.equal(sole.derivedSource, undefined);
  assert.equal(sole.pageCount, 2);
  const [, control] = publicationSourceReferences({
    htmlFileName: 'Blatt 2026 Nr. 1.html', htmlBytes: Buffer.from('<html>'),
    pdfFileName: 'Blatt 2026 Nr. 1.pdf', pdfBytes, pageRange: '2', verifiedAt: '2026-11-13',
  });
  assert.equal(control.sourceRole, 'visual-control');
  assert.equal(control.derivedSource, 'Gesetze/Blatt 2026 Nr. 1.html');
  assert.throws(() => publicationSourceReferences({
    htmlFileName: 'Blatt 2026 Nr. 1.html', htmlBytes: Buffer.from('<html>'),
    pdfFileName: 'Blatt 2026 Nr. 1.pdf', pdfBytes, soleSource: true,
  }), /einzige Quelle trotz HTML-Fassung/u);
});

test('PDF-only-Ausgabe wird über die Ausgabenidentität ohne HTML gefunden', () => {
  assert.deepEqual(resolvePublicationPdf({
    publication: 'StAnzO.', year: 2031, issue: '7',
    htmlFileName: null, pdfFileNames: ['StAnzO. 2031 Nr. 7.pdf', 'StAnzO. 2031 Nr. 6.pdf'],
  }), { fileName: 'StAnzO. 2031 Nr. 7.pdf', strategy: 'publication-identity' });
});
