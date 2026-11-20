import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { loadNormVersions } from '@ostrecht/shared/lib/norms/loader.ts';
import { consolidationFindings } from './lib/consolidation-findings.mjs';
import { inspectSource, renderSourcePreview } from './lib/norm-source-preview.mjs';
import { resolvePublicationPdf, sha256 } from './lib/publication-pdf.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
async function run() {
  const { values: { file } } = parseArgs({ options: { file: { type: 'string' } } });
  if (!file || file !== basename(file) || /[\\\u0000-\u001f]/u.test(file) || !/\.html$/iu.test(file)) {
    throw new TypeError('Eine HTML-Datei aus Gesetze/ mit --file <Dateiname.html> angeben.');
  }
  const sourceDir = join(root, 'Gesetze');
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const input = entries.find((entry) => entry.isFile() && entry.name.normalize('NFC') === file.normalize('NFC'));
  if (!input) throw new Error('Reguläre Quelldatei fehlt: ' + file);
  const bytes = await readFile(join(sourceDir, input.name));
  const digest = sha256(bytes);
  const review = inspectSource(file, bytes.toString('utf8'));
  const publications = (await loadAllVerkuendungen()).filter((p) =>
    p.sourceReferences?.some((ref) => ref.localSource?.normalize('NFC') === ('Gesetze/' + file).normalize('NFC')));
  const warnings = [];
  const saved = [];
  if (!publications.length) warnings.push('Die HTML-Datei ist noch keiner gespeicherten Verkündung zugeordnet.');
  for (const publication of publications) {
    for (const ref of publication.sourceReferences ?? []) {
      if (ref.localSource?.normalize('NFC') === ('Gesetze/' + file).normalize('NFC') && ref.sha256 && ref.sha256 !== digest) {
        warnings.push(publication.slug + ' · HTML-Prüfsumme weicht vom Quellenbeleg ab.');
      }
    }
    for (const entry of publication.entries.filter((entry) => entry.normSlug && entry.versionId)) {
      const versions = await loadNormVersions(entry.normSlug);
      saved.push({ entry, version: versions.find((v) => v.versionId === entry.versionId) });
    }
  }
  const issue = publications.length === 1 ? publications[0] : review.parsed;
  let pdf;
  if (publications.length > 1) warnings.push('Mehrere Verkündungen verweisen auf diese Quelle. PDF-Zuordnung einzeln prüfen.');
  else {
    const candidates = entries.filter((entry) => entry.isFile() && /\.pdf$/iu.test(entry.name)).map((entry) => entry.name);
    const result = resolvePublicationPdf({ ...issue, htmlFileName: file, pdfFileNames: candidates });
    if (result.fileName) {
      const path = join(sourceDir, result.fileName);
      const ref = issue?.sourceReferences?.find((ref) => ref.kind === 'primary-pdf' && ref.localSource === 'Gesetze/' + result.fileName);
      const checked = ref?.sha256 && sha256(await readFile(path)) === ref.sha256;
      if (ref?.sha256 && !checked) warnings.push('PDF-Prüfsumme weicht vom Quellenbeleg ab.');
      pdf = { name: result.fileName, url: pathToFileURL(path).href, label: checked ? 'Quellprüfsumme stimmt überein' : 'lokale Vergleichsdatei' };
    } else warnings.push(result.strategy === 'ambiguous' ? 'PDF-Zuordnung ist mehrdeutig.' : 'Keine passende Vergleichs-PDF im Quellenbestand.');
  }
  const slugs = new Set(saved.map(({ entry }) => entry.normSlug));
  const manifest = JSON.parse(await readFile(join(root, 'data/recht/consolidation-manifest.json'), 'utf8'));
  const conflicts = consolidationFindings(manifest, slugs, slugs).filter((row) => row.confidence === 'candidate');
  const html = renderSourcePreview({ name: file, digest, review, pdf, saved, warnings, conflicts });
  const dir = join(root, '.cache/norm-preview');
  await mkdir(dir, { recursive: true });
  if (await realpath(dir) !== dir) throw new Error('Vorschauverzeichnis verweist aus dem lokalen Cache.');
  const output = join(dir, file);
  const temporary = join(dir, randomUUID() + '.tmp');
  try {
    await writeFile(temporary, html, { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(output);
}

try { await run(); }
catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof TypeError || error.code?.startsWith('ERR_PARSE_ARGS') ? 2 : 1;
}
