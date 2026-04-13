import type { NormBodyBlock, NormStatus, NormType } from './schema.ts';

export interface NormOutlineItem {
  anchor: string;
  label?: string;
  title: string;
  level: number;
  children: NormOutlineItem[];
}

const DISPLAY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAbkuerzung\b/g, 'Abkürzung'],
  [/\bAenderungsvorschrift\b/g, 'Änderungsvorschrift'],
  [/\bAenderungsgesetz\b/g, 'Änderungsgesetz'],
  [/\bAenderung\b/g, 'Änderung'],
  [/\bAenderungsrecht\b/g, 'Änderungsrecht'],
  [/\bAenderungsbezuegen\b/g, 'Änderungsbezügen'],
  [/\bAendert\b/g, 'Ändert'],
  [/\bFoerderrichtlinie\b/g, 'Förderrichtlinie'],
  [/\bFoerderfaehige\b/g, 'Förderfähige'],
  [/\bFoerderung\b/g, 'Förderung'],
  [/\bFoerderwesen\b/g, 'Förderwesen'],
  [/\bFoerdert\b/g, 'Fördert'],
  [/\bFuehrung\b/g, 'Führung'],
  [/\bFuehrt\b/g, 'Führt'],
  [/\bfuehrt\b/g, 'führt'],
  [/\bfuer\b/g, 'für'],
  [/\bUebersicht\b/g, 'Übersicht'],
  [/\bUeber\b/g, 'Über'],
  [/\bueber\b/g, 'über'],
  [/\bOeffent/g, 'Öffent'],
  [/\boeffent/g, 'öffent'],
  [/\bguelt/g, 'gült'],
  [/\bGuelt/g, 'Gült'],
  [/\bVerkuendung\b/g, 'Verkündung'],
  [/\bverkuend/g, 'verkünd'],
  [/\bVerkuend/g, 'Verkünd'],
  [/\bverkuerz/g, 'verkürz'],
  [/\bVerkuerz/g, 'Verkürz'],
  [/verkuerz/g, 'verkürz'],
  [/Verkuerz/g, 'Verkürz'],
  [/\bRueck/g, 'Rück'],
  [/\brueck/g, 'rück'],
  [/\bMaerz\b/g, 'März'],
  [/\bjaehr/g, 'jähr'],
  [/\bJaehr/g, 'Jähr'],
  [/\bZustaend/g, 'Zuständ'],
  [/\bzustaend/g, 'zuständ'],
  [/\bVerhaeltn/g, 'Verhältn'],
  [/\bverhaeltn/g, 'verhältn'],
  [/\bgefaehr/g, 'gefähr'],
  [/\bGefaehr/g, 'Gefähr'],
  [/\bgewaehr/g, 'gewähr'],
  [/\bGewaehr/g, 'Gewähr'],
  [/\bLaender\b/g, 'Länder'],
  [/\blaender\b/g, 'länder'],
  [/\blaenderuebergreifend/g, 'länderübergreifend'],
  [/\bLaenderuebergreifend/g, 'Länderübergreifend'],
  [/\bLaendliche\b/g, 'Ländliche'],
  [/\bLaendlichen\b/g, 'Ländlichen'],
  [/\blaendliche\b/g, 'ländliche'],
  [/\blaendlichen\b/g, 'ländlichen'],
  [/\bGespraech\b/g, 'Gespräch'],
  [/\bgespraech\b/g, 'gespräch'],
  [/\bKoordinierungsgespraech\b/g, 'Koordinierungsgespräch'],
  [/\bKoordinierungsgespraeche\b/g, 'Koordinierungsgespräche'],
  [/\bBehoerde\b/g, 'Behörde'],
  [/\bBehoerden\b/g, 'Behörden'],
  [/\bspaetestens\b/g, 'spätestens'],
  [/\bSpaetestens\b/g, 'Spätestens'],
  [/\bTraeger\b/g, 'Träger'],
  [/\btraeger\b/g, 'träger'],
  [/\bTraegern\b/g, 'Trägern'],
  [/\btraegern\b/g, 'trägern'],
  [/\bgeaend/g, 'geänd'],
  [/\bGeaend/g, 'Geänd'],
  [/\bergaenz/g, 'ergänz'],
  [/\bErgaenz/g, 'Ergänz'],
  [/\beingefuegt\b/g, 'eingefügt'],
  [/\bEingefuegt\b/g, 'Eingefügt'],
  [/\bkoennen\b/g, 'können'],
  [/\bKoennen\b/g, 'Können'],
  [/\bArbeitsplaetze\b/g, 'Arbeitsplätze'],
  [/arbeitsplaetz/g, 'arbeitsplätz'],
  [/Arbeitsplaetz/g, 'Arbeitsplätz'],
  [/\bDorfhaeusern\b/g, 'Dorfhäusern'],
  [/schliessend/g, 'schließend'],
  [/Schliessend/g, 'Schließend'],
  [/\bschliess/g, 'schließ'],
  [/\bSchliess/g, 'Schließ'],
  [/\bMassgabe\b/g, 'Maßgabe'],
  [/\bmassgabe\b/g, 'maßgabe'],
  [/\bVeroeffentlich/g, 'Veröffentlich'],
  [/\bveroeffentlich/g, 'veröffentlich'],
  [/\bEinfuehrung\b/g, 'Einführung'],
  [/\bErstveroeffentlichung\b/g, 'Erstveröffentlichung'],
  [/\bVorgaenger\b/g, 'Vorgänger'],
  [/\bvorgaenger\b/g, 'vorgänger'],
  [/\bRaeume\b/g, 'Räume'],
  [/\braeume\b/g, 'räume'],
  [/\bStaatsvertraege\b/g, 'Staatsverträge'],
  [/\bAnzeigefrist\b/g, 'Anzeigefrist'],
  [/\bAnzeige\b/g, 'Anzeige'],
];

const NORM_TYPE_LABELS: Record<NormType, string> = {
  gesetz: 'Gesetz',
  verordnung: 'Verordnung',
  verwaltungsvorschrift: 'Verwaltungsvorschrift',
  foerderrichtlinie: 'Förderrichtlinie',
  staatsvertrag: 'Staatsvertrag',
  zustimmungsgesetz: 'Zustimmungsgesetz',
  aenderungsvorschrift: 'Änderungsvorschrift',
};

const NORM_STATUS_LABELS: Record<NormStatus, string> = {
  'in-force': 'in Kraft',
  repealed: 'außer Kraft',
  planned: 'geplant',
};

export function toDisplayText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return DISPLAY_REPLACEMENTS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value,
  );
}

export function formatNormType(value: NormType): string {
  return NORM_TYPE_LABELS[value];
}

export function formatNormStatus(value: NormStatus): string {
  return NORM_STATUS_LABELS[value];
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map((entry) => Number.parseInt(entry, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function getBlockAnchorId(path: number[], block: NormBodyBlock): string {
  const base = block.label ?? block.title ?? block.type;
  const slug = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `block-${path.join('-')}-${slug || block.type}`;
}

export function getHeadingTag(block: NormBodyBlock): 'h2' | 'h3' | 'h4' | 'h5' {
  if (block.type === 'part' || block.type === 'chapter') {
    return 'h2';
  }

  if (block.type === 'section' || block.type === 'subsection' || block.type === 'annex') {
    return 'h3';
  }

  return 'h4';
}

export function buildNormOutline(
  blocks: NormBodyBlock[],
  path: number[] = [],
  level = 0,
): NormOutlineItem[] {
  return blocks.flatMap((block, index) => {
    const currentPath = [...path, index];
    const shouldInclude =
      block.type === 'part' ||
      block.type === 'chapter' ||
      block.type === 'section' ||
      block.type === 'subsection' ||
      block.type === 'paragraph' ||
      block.type === 'article' ||
      block.type === 'annex';

    const children = block.children ? buildNormOutline(block.children, currentPath, level + 1) : [];

    if (!shouldInclude) {
      return children;
    }

    return [
      {
        anchor: getBlockAnchorId(currentPath, block),
        label: block.label ? toDisplayText(block.label) : undefined,
        title: toDisplayText(block.title ?? block.label ?? 'Unbenannt'),
        level,
        children,
      },
    ];
  });
}
