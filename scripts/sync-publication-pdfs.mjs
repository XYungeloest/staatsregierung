#!/usr/bin/env node

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import {
  HISTORICAL_PUBLICATION_PAGE_RANGE_MAP,
  pageRangeForPublication,
  pdfPageCount,
  publicationIdentityKey,
  publicationSourceReferences,
  retainUnrelatedPublicationSourceReferences,
  resolvePublicationPdf,
} from './lib/publication-pdf.mjs';

const ROOT = process.cwd();
const write = process.argv.includes('--write');
const publicationRoot = resolve(ROOT, 'content/verkuendungen');
const normRoot = resolve(ROOT, 'content/normen');
const sourceRoot = resolve(ROOT, 'Gesetze');
const publicRoot = resolve(ROOT, 'public/assets/recht');

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isCorrectlyLinked(publication, pdfFileNames) {
  const reference = (publication.sourceReferences ?? []).find((entry) =>
    entry.kind === 'primary-pdf' && entry.availability === 'versioned');
  if (!reference?.localSource || !publication.pdf) return false;
  const fileName = basename(reference.localSource);
  return pdfFileNames.includes(fileName) && publication.pdf === `/assets/recht/${fileName}`;
}

const [publicationFiles, sourceFiles] = await Promise.all([
  readdir(publicationRoot),
  readdir(sourceRoot),
]);
const pdfFileNames = sourceFiles.filter((fileName) => /\.pdf$/iu.test(fileName));
const htmlFileNames = new Set(sourceFiles.filter((fileName) => /\.html$/iu.test(fileName)));
const statistics = {
  publications: 0,
  withHtml: 0,
  withPdfInSource: 0,
  correctlyLinkedBefore: 0,
  newlyLinked: 0,
  stillWithoutPdf: 0,
  ambiguous: [],
  newlyLinkedFiles: [],
  missing: [],
};

for (const fileName of publicationFiles.filter((name) => name.endsWith('.json')).sort()) {
  const path = join(publicationRoot, fileName);
  const publication = JSON.parse(await readFile(path, 'utf8'));
  statistics.publications += 1;
  const existingHtmlSource = (publication.sourceReferences ?? [])
    .map((reference) => reference.localSource)
    .find((source) => /\.html$/iu.test(String(source ?? '')) && htmlFileNames.has(basename(source)));
  const conventionalHtml = `${publication.title}.html`;
  const htmlFileName = existingHtmlSource
    ? basename(existingHtmlSource)
    : htmlFileNames.has(conventionalHtml) ? conventionalHtml : null;
  if (htmlFileName) statistics.withHtml += 1;
  const resolved = resolvePublicationPdf({
    publication: publication.publication,
    year: publication.year,
    issue: publication.issue,
    htmlFileName,
    pdfFileNames,
    sourceReferences: publication.sourceReferences,
  });
  const correctBefore = isCorrectlyLinked(publication, pdfFileNames);
  if (correctBefore) statistics.correctlyLinkedBefore += 1;
  if (!resolved.fileName) {
    statistics.stillWithoutPdf += 1;
    if (resolved.strategy === 'ambiguous') statistics.ambiguous.push({ slug: publication.slug, candidates: resolved.candidates });
    else statistics.missing.push(publication.slug);
    continue;
  }
  statistics.withPdfInSource += 1;
  const [pdfBytes, htmlBytes] = await Promise.all([
    readFile(join(sourceRoot, resolved.fileName)),
    htmlFileName ? readFile(join(sourceRoot, htmlFileName)) : null,
  ]);
  const pageCount = pdfPageCount(pdfBytes);
  const identity = publicationIdentityKey(publication.publication, publication.year, publication.issue);
  const correctedEntryRange = HISTORICAL_PUBLICATION_PAGE_RANGE_MAP[identity];
  const correctedEntries = correctedEntryRange && publication.entries?.length === 1
    ? publication.entries.map((entry) => ({ ...entry, pages: correctedEntryRange, startPage: undefined }))
    : publication.entries;
  const publicationWithCorrectedEntries = { ...publication, entries: correctedEntries };
  const hasEntryPage = (publicationWithCorrectedEntries.entries ?? []).some((entry) =>
    entry.pages ?? entry.startPage
  );
  const existingPageRange = (publication.sourceReferences ?? []).find((reference) =>
    ['structured-html-transcription', 'legacy-markdown-transcription', 'primary-pdf'].includes(reference.kind) &&
    reference.pageRange
  )?.pageRange;
  const pageRange = hasEntryPage
    ? pageRangeForPublication(publicationWithCorrectedEntries, pageCount)
    : existingPageRange ?? pageRangeForPublication(publicationWithCorrectedEntries, pageCount);
  const verifiedAt = (publication.sourceReferences ?? [])
    .find((reference) =>
      ['structured-html-transcription', 'primary-pdf'].includes(reference.kind) &&
      reference.verifiedAt
    )?.verifiedAt;
  const modernReferences = publicationSourceReferences({
    htmlFileName,
    htmlBytes,
    pdfFileName: resolved.fileName,
    pdfBytes,
    pageRange,
    ...(verifiedAt ? { verifiedAt } : {}),
  });
  const updated = {
    ...publicationWithCorrectedEntries,
    pdf: `/assets/recht/${resolved.fileName}`,
    sourceReferences: [
      ...modernReferences,
      ...retainUnrelatedPublicationSourceReferences(publication.sourceReferences, {
        htmlFileName,
        pdfFileName: resolved.fileName,
        retainLegacyMarkdown: !htmlFileName,
      }),
    ],
  };
  if (!correctBefore) {
    statistics.newlyLinked += 1;
    statistics.newlyLinkedFiles.push({ slug: publication.slug, pdf: resolved.fileName, strategy: resolved.strategy });
  }
  if (write) {
    await writeJson(path, updated);
    await mkdir(publicRoot, { recursive: true });
    await copyFile(join(sourceRoot, resolved.fileName), join(publicRoot, resolved.fileName));
    for (const entry of correctedEntries ?? []) {
      if (!entry.normSlug) continue;
      const metaPath = join(normRoot, entry.normSlug, 'meta.json');
      try {
        const meta = JSON.parse(await readFile(metaPath, 'utf8'));
        const entryRange = entry.pages ?? entry.startPage ?? pageRange;
        const normReferences = publicationSourceReferences({
          htmlFileName,
          htmlBytes,
          pdfFileName: resolved.fileName,
          pdfBytes,
          pageRange: entryRange,
        });
        await writeJson(metaPath, {
          ...meta,
          sourceReferences: [
            ...normReferences,
            ...retainUnrelatedPublicationSourceReferences(meta.sourceReferences, {
              htmlFileName,
              pdfFileName: resolved.fileName,
              retainLegacyMarkdown: !htmlFileName,
            }),
          ],
        });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
}

console.log(JSON.stringify(statistics, null, 2));
if (!write) console.error('Prüflauf: Schreiben mit --write.');
