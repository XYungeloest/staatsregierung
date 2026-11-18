import { citationLabelMatchesNormType, NORM_TYPE_CITATION_LABELS } from './publication-entry-types.mjs';

/**
 * Seitenangaben der Einträge einer Verkündungsausgabe.
 *
 * Eine Ausgabe mit Mantelvorschrift verkündet im ersten Eintrag die Mantelvorschrift selbst;
 * die weiteren Einträge sind die durch ihre Artikel eingeführten Stammnormen. Der Seitenbereich
 * der ganzen Ausgabe gehört nur der Mantelvorschrift. Eine eingeführte Stammnorm erhält
 * ausschließlich einen eigens belegten Bereich ihres Artikels (CONTENT.md, Verkündungen);
 * ohne Beleg entfällt die Seitenangabe.
 */

export function publicationEntryPages(index, { issuePageRange, configuredPages } = {}) {
  if (configuredPages) return configuredPages;
  return index === 0 ? issuePageRange : undefined;
}

function isMultiPageRange(value) {
  return /^\d+\s*[–-]\s*\d+$/u.test(String(value ?? '').trim());
}

/**
 * Prüft die Seitenangaben der Einträge einer Ausgabe. Der erste Eintrag kann als
 * Mantelvorschrift denselben Bereich wie sein erster Artikel belegen. Die übrigen Einträge
 * sind aufeinanderfolgende, verschiedene Rechtsvorschriften und können nicht denselben
 * mehrseitigen Bereich belegen; tritt ein solcher Bereich bei mehreren von ihnen auf, wurde
 * er pauschal übertragen.
 */
export function publicationEntryPageProblems(entries) {
  const owners = new Map();
  for (const [index, entry] of (entries ?? []).entries()) {
    if (index === 0 || !isMultiPageRange(entry?.pages)) continue;
    const key = String(entry.pages).replace(/\s+/gu, '').replace('-', '–');
    owners.set(key, [...(owners.get(key) ?? []), index]);
  }
  return [...owners]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([pages, indexes]) =>
      `Seitenbereich ${pages} ist pauschal mehreren Einträgen zugeordnet (entries[${indexes.join('], entries[')}])`);
}

function formatGermanDate(isoDate) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`));
}

/**
 * Dokumentdatum eines bereits gepflegten Verkündungseintrags beim erneuten Import. Gepflegte
 * Werte gehen dem Quelltext vor. Ein redaktionell offengelassenes Dokumentdatum (Eintrag und
 * Norm ohne documentDate, etwa bei widersprüchlichen Datumsangaben der Quelle) bleibt offen.
 */
export function legacyEntryDocumentDate(previous, metaDocumentDate, ...sourceDocumentDates) {
  if (previous && !previous.documentDate && !metaDocumentDate) return undefined;
  return previous?.documentDate ?? metaDocumentDate ?? sourceDocumentDates.find(Boolean);
}

/**
 * Die Bezeichnung des Eintrags folgt der Norm, nicht dem Altbestand: Eine bereits
 * vorhandene Zitierung wird nur übernommen, wenn sie einen zum Normtyp passenden
 * Rechtsakt nennt (amtliche Sonderformen wie Anordnung oder Organisationserlass
 * bleiben damit erhalten) und das Dokumentdatum trägt, sofern eines feststeht; sonst
 * wird sie aus Normtyp, Datum und Fundstelle gebildet.
 */
export function legacyEntryCitation(previous, meta, publication, documentDate) {
  if (
    previous?.citation &&
    (!documentDate || /\bvom\s+\d{1,2}\.\s+[A-ZÄÖÜa-zäöüß]+\s+\d{4}/u.test(previous.citation)) &&
    citationLabelMatchesNormType(previous.citation, meta.type)
  ) return previous.citation;
  const page = previous?.startPage ?? previous?.pages?.match(/\d+/u)?.[0];
  const label = citationLabelMatchesNormType(meta.initialCitation, meta.type)
    ? String(meta.initialCitation).split(/\s+vom\s+|\s+\(/u)[0].trim()
    : NORM_TYPE_CITATION_LABELS[meta.type] ?? 'Veröffentlichung';
  const dated = documentDate ? ` vom ${formatGermanDate(documentDate)}` : '';
  return `${label}${dated} (${publication.publication} ${publication.year} Nr. ${publication.issue}${page ? ` S. ${page}` : ''})`;
}

const TRANSCRIPTION_KINDS = ['structured-html-transcription', 'legacy-markdown-transcription'];

/**
 * Verweisen eine Ausgabe und die verknüpfte Normfassung auf dieselbe amtliche Quelle? Das ist
 * der Fall, wenn die Norm die strukturtragende Transkription der Ausgabe nennt oder eine eigene
 * Transkription, die aus dem Original-PDF derselben Ausgabe abgeleitet ist (etwa eine gesondert
 * strukturierte Ursprungsfassung eines Stammgesetzes).
 */
export function entrySharesIssueSource(issueReferences, normReferences) {
  const issueSources = issueReferences ?? [];
  const structuredSource = issueSources.find((source) => TRANSCRIPTION_KINDS.includes(source.kind))?.localSource;
  const issuePdf = issueSources.find((source) => source.kind === 'primary-pdf')?.localSource;
  return (normReferences ?? []).some((source) =>
    (structuredSource && source.localSource === structuredSource) ||
    (issuePdf && TRANSCRIPTION_KINDS.includes(source.kind) && source.derivedSource === issuePdf));
}
