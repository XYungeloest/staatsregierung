/**
 * Einzelplannummern des abgeschlossenen Doppelhaushalts 2025/2026 (context/Staatshaushalt
 * 2025_2026 - Zusammenfassung.csv; tests/legacy-routes.test.ts gleicht die Liste ab).
 */
export const LEGACY_EINZELPLAENE_2025_2026 = Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0'));

export const legacyRoutes = [
  {
    source: '/uebersicht/',
    target: '/service/uebersicht/',
    label: 'Seitenübersicht',
  },
  {
    source: '/karriere/',
    target: '/service/karriere/',
    label: 'Karriere und Stellenangebote',
  },
  {
    source: '/karriere/stellen/',
    target: '/service/karriere/',
  },
  {
    source: '/karriere/stellen/[slug]',
    target: '/service/karriere/[slug]',
  },
  {
    source: '/ministerien/',
    target: '/staatsregierung/kabinett/',
    label: 'Staatsrat und Geschäftsbereiche',
  },
  {
    source: '/ministerien/[ressort]',
    target: '/staatsregierung/kabinett/[ressort]',
  },
  // Gesamtplan und Einzelpläne des Doppelhaushalts 2025/2026 liegen unter der Adresse ihrer
  // Haushaltsperiode; /haushalt/ ist der periodenübergreifende Einstieg.
  {
    source: '/haushalt/gesamtplan/',
    target: '/haushalt/2025-2026/gesamtplan/',
  },
  {
    source: '/haushalt/einzelplaene/',
    target: '/haushalt/2025-2026/einzelplaene/',
  },
  // Einzelpläne statisch je Nummer: Astro erzeugt für statische Quellen die Form mit und ohne
  // Schrägstrich, beide direkt auf die Zieladresse. Eine dynamische Quelle (:plan) greift im
  // Cloudflare-Asset-Worker nicht für die bisher kanonische Form mit Schrägstrich.
  ...LEGACY_EINZELPLAENE_2025_2026.map((plan) => ({
    source: `/haushalt/einzelplaene/${plan}/`,
    target: `/haushalt/2025-2026/einzelplaene/${plan}/`,
  })),
  {
    source: '/presse/termine/einbringung-kreis-und-bezirksreform-2027/',
    target: '/presse/termine/einbringung-kreis-und-bezirksreform-2026/',
  },
];

export const legacyRedirects = Object.fromEntries(
  legacyRoutes.map(({ source, target }) => [source, target]),
);

export const legacyRouteHelpLinks = legacyRoutes.filter((route) => route.label);
