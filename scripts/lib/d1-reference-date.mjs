/**
 * Stichtagsabhängiger Umfang der D1-Projektion.
 *
 * Der redaktionelle Stichtag (packages/shared/src/config/editorial.json) bestimmt, welche
 * gespeicherte Fassung als geltend, zukünftig oder historisch ausgewiesen wird. Ändert sich nur
 * der Stichtag, ändert sich die Projektion ausschließlich bei Normen, deren Fassungseinordnung
 * (temporal_kind je Fassung) oder deren geltende Fassung (current_version_id, Suchindex der
 * geltenden Fassung, Bezeichnungen) zwischen altem und neuem Stichtag verschieden ist. Alle
 * anderen Zeilen dieser Normen sind stichtagsunabhängig. Abgeleitete Daten anderer Normen
 * (Fassungslinks, Bezeichnungen der geltenden Fassung) werden vom Sync zusätzlich für alle
 * Normen neu geschrieben (Derived-Rebuild), weil sie auf die geltende Fassung der betroffenen
 * Normen verweisen können.
 *
 * Reine Funktionen; der Vergleich mit einer frischen Vollprojektion steht in
 * tests/recht-d1-reference-date.test.mjs.
 */

import { classifyNormVersion, getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';

export const REFERENCE_DATE_CONFIG_PATH = 'packages/shared/src/config/editorial.json';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function assertIsoDate(value, label = 'Stichtag') {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) throw new Error(`${label} muss ein ISO-Datum (YYYY-MM-DD) sein, erhalten: ${String(value)}`);
  return value;
}

/** Stichtagsabhängige Signatur einer Norm: geltende Fassung und Einordnung jeder Fassung. */
export function referenceDateSignature(norm, asOf) {
  const current = getApplicableVersion(norm, asOf);
  return [
    `current:${current.versionId}`,
    ...norm.versions.map((version) => `${version.versionId}:${classifyNormVersion(norm, version, asOf)}`),
  ].join('|');
}

/**
 * Normen, deren Projektion sich zwischen zwei Stichtagen unterscheidet (sortierte Slugs) –
 * unabhängig davon, ob der Stichtag vor- oder zurückgeht.
 */
export function referenceDateAffectedSlugs(norms, fromDate, toDate) {
  assertIsoDate(fromDate, 'Ausgangsstichtag');
  assertIsoDate(toDate, 'Zielstichtag');
  if (fromDate === toDate) return [];
  return norms
    .filter((norm) => referenceDateSignature(norm, fromDate) !== referenceDateSignature(norm, toDate))
    .map((norm) => norm.meta.slug)
    .sort();
}
