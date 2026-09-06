/**
 * Typ und Zitierbezeichnung eines Verkündungseintrags folgen dem Typ der verkündeten Norm.
 *
 * Die Werkzeuge unter `scripts/` laufen ohne Typenauflösung; die verbindliche Fassung für
 * Laufzeit und Oberfläche steht in `packages/shared/src/lib/norms/publications.ts`
 * (`publicationEntryTypeForNormType`, `isCompatiblePublicationEntryType`). Beide Tabellen
 * werden in `tests/norm-publications.test.ts` gegeneinander geprüft.
 */

export const PUBLICATION_ENTRY_TYPES = [
  'gesetz',
  'verordnung',
  'verwaltungsvorschrift',
  'foerderrichtlinie',
  'allgemeinverfuegung',
  'bekanntmachung',
  'berichtigung',
  'staatsvertrag',
  'verwaltungsabkommen',
  'sonstiges',
];

/** Bezeichnung, mit der ein Rechtsakt dieses Normtyps zitiert wird. */
export const NORM_TYPE_CITATION_LABELS = {
  gesetz: 'Gesetz',
  verordnung: 'Verordnung',
  verwaltungsvorschrift: 'Verwaltungsvorschrift',
  foerderrichtlinie: 'Förderrichtlinie',
  allgemeinverfuegung: 'Allgemeinverfügung',
  bekanntmachung: 'Bekanntmachung',
  berichtigung: 'Berichtigung',
  staatsvertrag: 'Staatsvertrag',
  verwaltungsabkommen: 'Verwaltungsabkommen',
  zustimmungsgesetz: 'Gesetz',
  aenderungsvorschrift: 'Gesetz',
};

const COMPATIBLE_NORM_TYPES = {
  gesetz: ['gesetz', 'zustimmungsgesetz', 'aenderungsvorschrift'],
  verordnung: ['verordnung', 'aenderungsvorschrift'],
  verwaltungsvorschrift: ['verwaltungsvorschrift', 'aenderungsvorschrift'],
};

export function publicationEntryTypeForNormType(normType, publication = {}) {
  if (normType === 'zustimmungsgesetz') return 'gesetz';
  if (normType === 'aenderungsvorschrift') {
    if (publication.publication === 'StAnzO.') return 'verwaltungsvorschrift';
    return /^Verordnung\b/u.test(publication.initialCitation ?? '') ? 'verordnung' : 'gesetz';
  }
  return normType;
}

export function isCompatiblePublicationEntryType(entryType, normType) {
  const compatible = COMPATIBLE_NORM_TYPES[entryType];
  return compatible ? compatible.includes(normType) : entryType === normType;
}

/**
 * Zitierbezeichnungen, die zu einem Normtyp passen. Verwaltungsvorschriften erscheinen
 * amtlich auch als Anordnung, Erlass, Organisationserlass oder Dienstanordnung;
 * Änderungsvorschriften tragen die Bezeichnung des ändernden Rechtsakts.
 */
const CITATION_LABELS_BY_NORM_TYPE = {
  gesetz: ['Gesetz'],
  verordnung: ['Verordnung'],
  verwaltungsvorschrift: ['Verwaltungsvorschrift', 'Anordnung', 'Erlass', 'Organisationserlass', 'Dienstanordnung'],
  foerderrichtlinie: ['Förderrichtlinie', 'Richtlinie'],
  allgemeinverfuegung: ['Allgemeinverfügung'],
  bekanntmachung: ['Bekanntmachung'],
  berichtigung: ['Berichtigung'],
  staatsvertrag: ['Staatsvertrag', 'Übereinkommen', 'Abkommen', 'Vertrag'],
  verwaltungsabkommen: ['Verwaltungsabkommen', 'Abkommen'],
  zustimmungsgesetz: ['Gesetz'],
  aenderungsvorschrift: ['Gesetz', 'Verordnung', 'Verwaltungsvorschrift'],
};

export function citationLabelsForNormType(normType) {
  return CITATION_LABELS_BY_NORM_TYPE[normType] ?? [];
}

/**
 * Trägt die Zitierung die Bezeichnung eines zum Normtyp passenden Rechtsakts?
 * Geprüft wird der Teil vor „vom <Datum>“; einleitende Zusätze („Geändert durch
 * Abschnitt I der Bekanntmachung vom …“) bleiben zulässig.
 */
export function citationLabelMatchesNormType(citation, normType) {
  const lead = String(citation ?? '').split(/\s+vom\s+/u)[0].trim();
  if (!lead) return false;
  return citationLabelsForNormType(normType).some((label) => lead === label || lead.endsWith(` ${label}`));
}
