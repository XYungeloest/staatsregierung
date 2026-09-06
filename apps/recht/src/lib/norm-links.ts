import { getNormVersionUrl } from '@ostrecht/shared/lib/norms/routes.ts';

/**
 * Adresse der Portalfassung als PDF: eine je gespeicherter Fassung, unveränderlich wie der
 * Fassungslink selbst (`/norm/<slug>/version/<versionId>/fassung.pdf`). Die Route erzeugt das
 * PDF aus dem Normtext; die amtliche Ausgabe bleibt das verlinkte Original-PDF der Verkündung.
 */
export function getNormVersionPdfPath(slug: string, versionId: string): string {
  return `${getNormVersionUrl(slug, versionId)}fassung.pdf`;
}
