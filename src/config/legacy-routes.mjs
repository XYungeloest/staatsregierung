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
  {
    source: '/presse/termine/einbringung-kreis-und-bezirksreform-2027/',
    target: '/presse/termine/einbringung-kreis-und-bezirksreform-2026/',
  },
  {
    source: '/recht/norm/sachsische-landkreisordnung/',
    target: '/recht/norm/saechsische-landkreisordnung/',
  },
];

export const legacyRedirects = Object.fromEntries(
  legacyRoutes.map(({ source, target }) => [source, target]),
);

export const legacyRouteHelpLinks = legacyRoutes.filter((route) => route.label);
