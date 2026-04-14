export interface PortalCollectionDescriptor {
  key: string;
  label: string;
  directorySegments: string[];
}

export const portalCollections = {
  regierungMitglied: {
    key: 'regierungMitglied',
    label: 'Regierungsmitglieder',
    directorySegments: ['regierung', 'mitglieder'],
  },
  ressort: {
    key: 'ressort',
    label: 'Ressorts',
    directorySegments: ['ressorts'],
  },
  themenseite: {
    key: 'themenseite',
    label: 'Themenseiten',
    directorySegments: ['themen'],
  },
  pressemitteilung: {
    key: 'pressemitteilung',
    label: 'Pressemitteilungen',
    directorySegments: ['presse', 'mitteilungen'],
  },
  rede: {
    key: 'rede',
    label: 'Reden',
    directorySegments: ['presse', 'reden'],
  },
  termin: {
    key: 'termin',
    label: 'Termine',
    directorySegments: ['presse', 'termine'],
  },
  haushaltsseite: {
    key: 'haushaltsseite',
    label: 'Haushaltsseiten',
    directorySegments: ['haushalt'],
  },
  stellenangebot: {
    key: 'stellenangebot',
    label: 'Stellenangebote',
    directorySegments: ['service', 'stellen'],
  },
  statischeSeite: {
    key: 'statischeSeite',
    label: 'Statische Seiten',
    directorySegments: ['service', 'seiten'],
  },
  norm: {
    key: 'norm',
    label: 'Normen',
    directorySegments: ['normen'],
  },
} as const satisfies Record<string, PortalCollectionDescriptor>;

export type PortalCollectionKey = keyof typeof portalCollections;
