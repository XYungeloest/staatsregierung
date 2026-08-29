import { createHash } from 'node:crypto';

export const PDF_AUDIT_VERIFIED_AT = '2026-08-28';

// Historische Originale, deren intern überlieferter Dateiname die amtliche
// Reihenbezeichnung verkürzt. Die Zuordnung bleibt klein, explizit und wird
// nur akzeptiert, wenn genau diese Datei tatsächlich im Quellenbestand liegt.
export const HISTORICAL_PDF_FILE_MAP = {
  'OGVBl.|2025|8': 'GVBl. 2025 Nr. 8.pdf',
  'OGVBl.|2026|12': 'GVBl. 2026 Nr. 12.pdf',
};

export const HISTORICAL_PUBLICATION_PAGE_RANGE_MAP = {
  // Das Altmetadatum „1-7“ widersprach dem sechsseitigen Original. Inhalts-
  // verzeichnis und Druckseiten des PDFs weisen die Richtlinie auf S. 2–6 aus.
  'StAnzO.|2026|5': '2–6',
};

export function publicationIdentityKey(publication, year, issue) {
  return `${publication}|${year}|${String(issue).replace(/^0+(?=\d)/u, '')}`;
}

export function publicationIdentityFromPdfFileName(fileName) {
  const normalized = String(fileName).normalize('NFC');
  const standard = normalized.match(/^(OABl|OGVBl|OVertrBl|StAnzO)\.?\s*(\d{4})\s*Nr\.?\s*(\d+)\.pdf$/iu);
  if (standard) {
    const publication = {
      oabl: 'OABl.', ogvbl: 'OGVBl.', overtrbl: 'OVertrBl.', stanzo: 'StAnzO.',
    }[standard[1].toLocaleLowerCase('de')];
    return publicationIdentityKey(publication, Number(standard[2]), standard[3]);
  }
  const gmbl = normalized.match(/^GMBl[-.\s]*(\d+)[-.\s]*(\d{4})\.pdf$/iu);
  return gmbl ? publicationIdentityKey('GMBl.', Number(gmbl[2]), gmbl[1]) : null;
}

export function pdfPageCount(bytes) {
  const count = (Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page\b/gu) ?? []).length;
  if (count < 1) throw new Error('PDF-Seitenzahl konnte nicht aus den Seitenobjekten ermittelt werden');
  return count;
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function resolvePublicationPdf({
  publication,
  year,
  issue,
  htmlFileName,
  configuredPdfFileName,
  pdfFileNames,
  sourceReferences = [],
}) {
  const available = new Set(pdfFileNames);
  const identity = publicationIdentityKey(publication, year, issue);
  const explicit = [
    configuredPdfFileName,
    HISTORICAL_PDF_FILE_MAP[identity],
    ...sourceReferences
      .map((reference) => reference.localSource)
      .filter((source) => /\.pdf$/iu.test(String(source ?? '')))
      .map((source) => String(source).split('/').at(-1)),
  ].filter((fileName) => fileName && available.has(fileName));
  if (explicit.length > 0) return { fileName: [...new Set(explicit)][0], strategy: 'explicit' };

  const exact = String(htmlFileName ?? '').replace(/\.html$/iu, '.pdf');
  if (exact && available.has(exact)) return { fileName: exact, strategy: 'exact-basename' };

  const candidates = pdfFileNames.filter((fileName) => publicationIdentityFromPdfFileName(fileName) === identity);
  if (candidates.length === 1) return { fileName: candidates[0], strategy: 'publication-identity' };
  if (candidates.length > 1) return { fileName: null, strategy: 'ambiguous', candidates };
  return { fileName: null, strategy: 'missing', candidates: [] };
}

export function pageRangeForPublication(publication, pageCount) {
  const starts = (publication.entries ?? []).flatMap((entry) => {
    const value = entry.pages ?? entry.startPage;
    const first = String(value ?? '').match(/^\d+/u)?.[0];
    return first ? [Number(first)] : [];
  });
  const start = starts.length > 0 ? Math.min(...starts) : 1;
  return `${start}${start === pageCount ? '' : `–${pageCount}`}`;
}

export function publicationSourceReferences({
  htmlFileName,
  htmlBytes,
  pdfFileName,
  pdfBytes,
  pageRange,
  verifiedAt = PDF_AUDIT_VERIFIED_AT,
}) {
  const htmlSource = htmlFileName ? `Gesetze/${htmlFileName}` : null;
  const references = [];
  if (htmlSource && htmlBytes) {
    references.push({
      kind: 'structured-html-transcription',
      label: 'Vollständige strukturtragende HTML-Fassung der amtlichen Ausgabe',
      availability: 'versioned',
      localSource: htmlSource,
      sha256: sha256(htmlBytes),
      mediaType: 'text/html',
      ...(pageRange ? { pageRange } : {}),
      verifiedAt,
      sourceRole: 'structure-bearing',
    });
  }
  if (pdfFileName && pdfBytes) {
    references.push({
      kind: 'primary-pdf',
      label: 'Amtliche visuelle Veröffentlichungsfassung',
      availability: 'versioned',
      localSource: `Gesetze/${pdfFileName}`,
      sha256: sha256(pdfBytes),
      mediaType: 'application/pdf',
      pageCount: pdfPageCount(pdfBytes),
      ...(pageRange ? { pageRange } : {}),
      verifiedAt,
      sourceRole: 'visual-control',
      ...(htmlSource ? { derivedSource: htmlSource } : {}),
    });
  }
  return references;
}

export function retainUnrelatedPublicationSourceReferences(references, {
  htmlFileName,
  pdfFileName,
  retainLegacyMarkdown = false,
} = {}) {
  return (references ?? []).filter((reference) => {
    const sourceFileName = reference.localSource ? reference.localSource.split('/').at(-1) : null;
    if (reference.kind === 'primary-pdf' && sourceFileName === pdfFileName) return false;
    if (reference.kind === 'structured-html-transcription' && sourceFileName === htmlFileName) return false;
    if (reference.kind === 'legacy-markdown-transcription' && !retainLegacyMarkdown) return false;
    return !(
      reference.kind === 'original' &&
      reference.availability === 'not-versioned' &&
      /(?:Original|PDF)/iu.test(reference.label ?? '')
    );
  });
}
