import type { NormBodyBlock, NormStatus, NormType } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Projizierte Anzeigetexte und Anker: Umlautkorrektur (`toDisplayText`), Bezeichnungen von
 * Normtyp und Rechtsstand sowie die Blockanker der Fassungen. Teil der D1-Projektion
 * (Code-Abschluss von scripts/sync-recht-d1.mjs über search.ts, citation.ts und references.ts):
 * Titel, Schlagwörter, Vollzitate, Filterbezeichnungen und Suchprovisionen werden damit in D1
 * geschrieben. Reine Darstellung für die Oberfläche (Datumsformat, Fundstellenparser,
 * verlinkter Text, Gliederung, alte Anker) steht in display.ts; dieses Modul importiert
 * display.ts nie.
 */

export type NormAnchorMap = ReadonlyMap<string, string>;

export interface TextLinkReference {
  label: string;
  url: string;
  external?: boolean;
}

const DISPLAY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\-/g, '-'],
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
  [/\bPlaene\b/g, 'Pläne'],
  [/\bplaene\b/g, 'pläne'],
  [/Plaen/g, 'Plän'],
  [/plaen/g, 'plän'],
  [/\bStaatsvertraege\b/g, 'Staatsverträge'],
  [/\bAnzeigefrist\b/g, 'Anzeigefrist'],
  [/\bAnzeige\b/g, 'Anzeige'],
];

const NORM_TYPE_LABELS: Record<NormType, string> = {
  gesetz: 'Gesetz',
  verordnung: 'Verordnung',
  verwaltungsvorschrift: 'Verwaltungsvorschrift',
  foerderrichtlinie: 'Förderrichtlinie',
  allgemeinverfuegung: 'Allgemeinverfügung',
  bekanntmachung: 'Bekanntmachung',
  berichtigung: 'Berichtigung',
  staatsvertrag: 'Staatsvertrag',
  verwaltungsabkommen: 'Verwaltungsabkommen',
  zustimmungsgesetz: 'Zustimmungsgesetz',
  aenderungsvorschrift: 'Änderungsvorschrift',
};

const NORM_STATUS_LABELS: Record<NormStatus, string> = {
  'in-force': 'in Kraft',
  'future-effective': 'verkündet, tritt künftig in Kraft',
  'pending-effective': 'verkündet, Inkrafttreten nicht belegt',
  repealed: 'außer Kraft',
  historical: 'historische Fassung',
  'one-time-act': 'einmaliger Rechtsakt',
  planned: 'nicht verkündet',
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

export function anchorSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/§§?/g, 'paragraph')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getBlockAnchorId(
  path: number[],
  block: NormBodyBlock,
  namespace = '',
): string {
  const semanticBase = anchorSlug(block.label ?? block.title ?? '');
  const typePrefix: Partial<Record<NormBodyBlock['type'], string>> = {
    paragraph: 'paragraph',
    article: 'artikel',
    section: 'abschnitt',
    subsection: 'unterabschnitt',
    part: 'teil',
    chapter: 'kapitel',
    annex: 'anlage',
  };
  const prefix = typePrefix[block.type] ?? block.type.toLowerCase();
  const semantic = semanticBase
    ? semanticBase.startsWith(prefix)
      ? semanticBase
      : `${prefix}-${semanticBase}`
    : `${prefix}-${path.join('-')}`;

  return namespace ? `${namespace}-${semantic}` : semantic;
}

function getBlockPathKey(path: number[]): string {
  return path.join('.');
}

export function isAnchoredBlock(block: NormBodyBlock): boolean {
  return (
    block.type === 'part' ||
    block.type === 'chapter' ||
    block.type === 'section' ||
    block.type === 'subsection' ||
    block.type === 'paragraph' ||
    block.type === 'article' ||
    block.type === 'annex'
  );
}

export function buildNormAnchorMap(blocks: NormBodyBlock[]): NormAnchorMap {
  const anchors = new Map<string, string>();
  const usedAnchors = new Set<string>();

  function visit(entries: NormBodyBlock[], path: number[] = [], quoted = false): void {
    entries.forEach((block, index) => {
      const currentPath = [...path, index];
      const isQuoted = quoted || block.type === 'quotedProvision';

      if (isAnchoredBlock(block)) {
        const baseAnchor = getBlockAnchorId(currentPath, block, isQuoted ? 'zitat' : '');
        let anchor = baseAnchor;

        if (usedAnchors.has(anchor)) {
          anchor = `${baseAnchor}--${currentPath.join('-')}`;
          let collisionIndex = 2;
          while (usedAnchors.has(anchor)) {
            anchor = `${baseAnchor}--${currentPath.join('-')}-${collisionIndex}`;
            collisionIndex += 1;
          }
        }

        usedAnchors.add(anchor);
        anchors.set(getBlockPathKey(currentPath), anchor);
      }

      if (block.children) {
        visit(block.children, currentPath, isQuoted);
      }
    });
  }

  visit(blocks);
  return anchors;
}

export function getResolvedBlockAnchorId(
  anchors: NormAnchorMap,
  path: number[],
  block: NormBodyBlock,
  namespace = '',
): string {
  return anchors.get(getBlockPathKey(path)) ?? getBlockAnchorId(path, block, namespace);
}
