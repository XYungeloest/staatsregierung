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

// ---------------------------------------------------------------------------
// Ordnungswort (alphabetische Einordnung)
// ---------------------------------------------------------------------------

/**
 * Amtliche Titel beginnen fast immer mit der Rechtsform („Gesetz“, „Verordnung“,
 * „Verwaltungsvorschrift“) und oft mit der erlassenden Stelle. Das Ordnungswort ist das erste
 * inhaltstragende Wort einer Vorschrift: der Begriff, unter dem sie in einem alphabetischen
 * Verzeichnis steht. Die Regeln arbeiten nur auf dem Text der Bezeichnung; sie lesen keine
 * anderen Felder und treffen keine fachliche Entscheidung.
 */
const SORT_ORDINAL = /^(?:(?:erste|zweite|dritte|vierte|fünfte|sechste|siebte|siebente|achte|neunte|zehnte|elfte|zwölfte)[snmr]?|\d+\.)\s+/iu;
/** Führende Abkürzung der Rechtsform („VwV Meldewesen“, „VwV-Fischereirechte“, „FRL Bus“). */
const SORT_ABBREVIATION = /^(?:OstVwV|SächsVwV|VwV|FRL|RL|VO|G)(?:\s+|\s*[-–]\s*)/u;
/** Führende Gattungsbezeichnung der Rechtsform. */
const SORT_GENUS = /^(?:Gesetzes|Gesetz|Rechtsverordnungen|Rechtsverordnung|Polizeiverordnungen|Polizeiverordnung|Verordnungen|Verordnung|(?:Gemeinsame|Allgemeine)\s+Verwaltungsvorschriften?|Verwaltungsvorschriften|Verwaltungsvorschrift|Förderrichtlinien|Förderrichtlinie|Richtlinien|Richtlinie|Bekanntmachungen|Bekanntmachung|Allgemeinverfügungen|Allgemeinverfügung|Staatsverträge|Staatsvertrag|Verwaltungsabkommen|Abkommen|Verwaltungsvereinbarung|Vereinbarung|Rahmenvereinbarung|Erlass|Satzung|Beschluss|Grundsätze|Hinweise|Empfehlungen|Leitlinien|Vertrag|Übereinkommen|Programm|Anordnung)\b[\s,]*/u;
/** Erlassende Stelle: „des Ostdeutschen Staatsministeriums …“, „der Staatsregierung …“. */
const SORT_ISSUER = /^(?:des|der|dem|vom|von\s+(?:der|dem)|beim|bei\s+der)\s+(?:(?:Ostdeutsch|Sächsisch|Freistaat)\w*\s+)*(?:Staatsministeriums|Staatsministerien|Staatsministerium|Staatsregierung|Staatskanzlei|Regierungspräsidiums|Regierungspräsidium|Landesdirektion|Staatsrates|Staatsrats|Staatsrat|Staatssekretariats|Staatssekretariat|Landesamtes|Landesamts|Landesamt|Landtages|Landtags|Landtag|Ministerpräsidenten|Landesregierung|Obersten\s+Landesbehörden|Staatspräsidenten|Volkskammer)\b/u;
/** Ende der Erlasserangabe: hier beginnt der Regelungsgegenstand. */
const SORT_ISSUER_END = /(?<=\s)(?:über|zur|zum|zu|betreffend|hinsichtlich|für\s+(?:den|die|das|ein\w*))\s+/iu;
/** Führende Präposition und führender Artikel vor dem Regelungsgegenstand. */
const SORT_PREPOSITION = /^(?:über|zur|zum|zu|betreffend|hinsichtlich|für|gegen|von|vom|mit|nach|auf|bei|wegen)\s+/iu;
const SORT_ARTICLE = /^(?:der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/iu;
/** Landesbezogene Adjektive vor der Rechtsform oder dem Gegenstand (nur als eigenes Wort). */
const SORT_ADJECTIVE = /^(?:Ostdeutsch|Sächsisch)\w*\s+/u;
const SORT_LEADING_MARKS = /^[\s"„“”‚‘’'«»(\[{–—-]+/u;

/** Führende Anführungszeichen, Klammern und Striche entfernen. */
function stripLeadingMarks(value: string): string {
  return value.replace(SORT_LEADING_MARKS, '').trimStart();
}

/** Erlasserangabe bis zum Regelungsgegenstand abschneiden; ohne Fügewort hilft der Gedankenstrich. */
function stripIssuerSegment(value: string): string {
  if (!SORT_ISSUER.test(value)) return value;
  const end = SORT_ISSUER_END.exec(value);
  if (end && end.index > 0) return value.slice(end.index);
  const dash = value.lastIndexOf(' – ');
  return dash > 0 ? value.slice(dash + 3) : value;
}

/**
 * Ordnungswort einer Vorschrift: der Anfang ihrer Bezeichnung ohne Ordnungszahl, Rechtsform,
 * erlassende Stelle, Präposition und Artikel. Bleibt nichts übrig, gilt der Titel selbst.
 * Reine Textlogik – Teil der D1-Projektion (der Sync schreibt Sortierschlüssel und
 * Buchstabengruppe damit).
 */
export function getNormSortWord(identity: { title: string; shortTitle?: string | null }): string {
  const title = (identity.title ?? '').trim();
  const shortTitle = (identity.shortTitle ?? '').trim();
  let value = stripLeadingMarks(shortTitle && shortTitle !== title ? shortTitle : title);
  // Die Rechtsform wird einmal entfernt und nur nach einem Landesadjektiv ein zweites Mal
  // („Ostdeutsches Gesetz zur Ausführung …“). Sonst verlöre ein Zustimmungsgesetz auch den
  // Vertragsnamen, unter dem es gesucht wird.
  let genusRemoved = false;
  for (let round = 0; round < 8; round += 1) {
    const before = value;
    let next = value.replace(SORT_ORDINAL, '').replace(SORT_ABBREVIATION, '');
    const withoutAdjective = next.replace(SORT_ADJECTIVE, '');
    const adjectiveRemoved = withoutAdjective !== next;
    next = withoutAdjective.replace(SORT_ARTICLE, '');
    if ((!genusRemoved || adjectiveRemoved) && SORT_GENUS.test(next)) {
      next = stripIssuerSegment(next.replace(SORT_GENUS, ''));
      genusRemoved = true;
    }
    next = stripLeadingMarks(next.replace(SORT_PREPOSITION, '').replace(SORT_ARTICLE, ''));
    // Ein Schritt, der nichts übrig lässt, wird verworfen: die Bezeichnung besteht dann nur aus
    // Rechtsform und Fügewörtern.
    if (!next) break;
    value = next;
    if (value === before) break;
  }
  return value || title;
}

/**
 * Sortier- und Vergleichsschlüssel des Ordnungsworts: Kleinschreibung, Umlaute und Akzente
 * aufgelöst, ß als ss, Anführungszeichen entfernt. SQLite sortiert binär – die Projektion legt
 * deshalb genau diesen Schlüssel als `law_norms.sort_word` ab, damit „Ärzte“ unter A steht.
 */
export function getNormSortKey(identity: { title: string; shortTitle?: string | null }): string {
  return getNormSortWord(identity)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/ß/gu, 'ss')
    .replace(/[„“”‚‘’"'«»]/gu, '')
    .toLocaleLowerCase('de')
    .replace(/\s+/gu, ' ')
    .trim();
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
