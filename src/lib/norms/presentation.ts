import type { NormBodyBlock, NormStatus, NormType } from './schema.ts';

export interface NormOutlineItem {
  anchor: string;
  label?: string;
  title: string;
  level: number;
  children: NormOutlineItem[];
}

export type NormAnchorMap = ReadonlyMap<string, string>;

export interface ParsedCitation {
  source: string;
  year: string;
  part?: string;
  issue: string;
  page?: string;
}

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

export function parseCitation(value: string): ParsedCitation | undefined {
  const displayValue = toDisplayText(value);
  const match = displayValue.match(
    /\b(OGVBl\.|OABl\.|StAnzO\.|OVertrBl\.|GMBl\.|SächsGVBl\.|BGBl\.)\s+(\d{4})(?:\s+([IVX]+))?\s+Nr\.\s+([\p{L}\p{N}]+(?:[./\-–—][\p{L}\p{N}]+)*)(?:\s+S\.\s+([\p{L}\p{N}]+(?:[./\-–—][\p{L}\p{N}]+)*))?/u,
  );

  if (!match) {
    return undefined;
  }

  return {
    source: match[1],
    year: match[2],
    ...(match[3] ? { part: match[3] } : {}),
    issue: match[4],
    ...(match[5] ? { page: match[5] } : {}),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isWordCharacter(value: string): boolean {
  return /[\p{L}\p{N}_-]/u.test(value);
}

function isDelimited(value: string, start: number, length: number): boolean {
  const before = value[start - 1];
  const after = value[start + length];

  return (!before || !isWordCharacter(before)) && (!after || !isWordCharacter(after));
}

export function renderLinkedDisplayText(
  value: string | null | undefined,
  references: TextLinkReference[] = [],
): string {
  const text = toDisplayText(value);
  if (!text || references.length === 0) {
    return escapeHtml(text);
  }

  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    const match = references.find((reference) => {
      if (!text.startsWith(reference.label, index)) {
        return false;
      }

      return isDelimited(text, index, reference.label.length);
    });

    if (!match) {
      chunks.push(escapeHtml(text[index]));
      index += 1;
      continue;
    }

    chunks.push(
      `<a class="inline-link" href="${escapeHtml(match.url)}"${match.external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${escapeHtml(match.label)}</a>`,
    );
    index += match.label.length;
  }

  return chunks.join('');
}

function anchorSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/§§?/g, 'paragraph')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getLegacyBlockAnchorId(path: number[], block: NormBodyBlock): string {
  const base = block.label ?? block.title ?? block.type;
  const slug = anchorSlug(base);

  return `block-${path.join('-')}-${slug || block.type}`;
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

function isAnchoredBlock(block: NormBodyBlock): boolean {
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

export function getHeadingTag(parentLevel: number): 'h3' | 'h4' | 'h5' | 'h6' {
  const level = Math.min(Math.max(parentLevel + 1, 3), 6);
  return `h${level}` as 'h3' | 'h4' | 'h5' | 'h6';
}

export function buildNormOutline(
  blocks: NormBodyBlock[],
): NormOutlineItem[] {
  const anchors = buildNormAnchorMap(blocks);

  function visit(entries: NormBodyBlock[], path: number[] = [], level = 0): NormOutlineItem[] {
    return entries.flatMap((block, index) => {
      const currentPath = [...path, index];
      if (block.type === 'quotedProvision') return [];
      const shouldInclude = isAnchoredBlock(block);
      const children = block.children
        ? visit(block.children, currentPath, shouldInclude ? level + 1 : level)
        : [];

      if (!shouldInclude) {
        return children;
      }

      return [
        {
          anchor: getResolvedBlockAnchorId(anchors, currentPath, block),
          label: block.label ? toDisplayText(block.label) : undefined,
          title: toDisplayText(block.title ?? block.label ?? 'Unbenannt'),
          level,
          children,
        },
      ];
    });
  }

  return visit(blocks);
}
