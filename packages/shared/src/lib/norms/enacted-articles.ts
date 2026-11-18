import { toDisplayText } from './presentation.ts';
import type { NormRelationView } from './relations.ts';
import { getNormUrl } from './routes.ts';
import type { NormBodyBlock } from './schema.ts';

/**
 * Artikel eines Einführungs- oder Mantelgesetzes, die ein eigenes, als eigene Vorschrift geführtes
 * Gesetz einführen, erscheinen wie in REVOSax nicht als Zitat des ganzen Gesetzes, sondern mit der
 * Bezeichnung des eingeführten Gesetzes als Verweis auf dessen Stammeintrag (allgemeiner,
 * dynamischer Normlink). Artikel mit Änderungsbefehlen bleiben unverändert.
 *
 * Reine Darstellung zur Laufzeit: Grundlage sind der gespeicherte Normkörper und die Beziehungen
 * „führt ein“ der abgeleiteten Daten (meta.enactedNorm/enactedNorms am Einführungsgesetz,
 * meta.enactingNorm an der Stammnorm). Nicht Teil der D1-Projektion; der Sync importiert dieses
 * Modul nicht.
 *
 * Die Zuordnung ist fail-closed: Ein Artikel gehört zu einer eingeführten Vorschrift, wenn er
 * (nach höchstens zwei Einleitungszeilen) aus genau einem Zitat mit Gliederungseinheiten besteht
 * und sein Titel, eine Einleitungszeile oder die Kopfzeile des Zitats mit dem Titel genau einer
 * eingeführten Vorschrift beginnt. Führt das Gesetz genau eine Vorschrift ein und hat es genau
 * einen Artikel mit einem solchen Zitat, gilt diese eindeutige Zuordnung auch ohne Titeltreffer.
 * Alles andere bleibt Volltext.
 *
 * Wie in REVOSax steht im zugeordneten Artikel nur noch die Bezeichnung des eingeführten Gesetzes;
 * Einleitungszeilen („Das nachstehende wird Gesetz:“) entfallen mit dem Zitat. Die Ankertabelle
 * bildet die Normseite aus dem gespeicherten Körper: Die Indexpfade aller verbleibenden verankerten
 * Blöcke bleiben gleich, eingekürzte Artikel haben keine verankerten Kinder mehr.
 */

export interface EnactedNormReference {
  slug: string;
  title: string;
  shortTitle?: string;
}

export interface EnactedArticle {
  /** Pfad des Artikels im Normkörper (Indizes je Ebene). */
  path: number[];
  slug: string;
  /** Bezeichnung des eingeführten Gesetzes: Wortlaut der Vorschrift, sonst Titel und Kurztitel. */
  text: string;
  /** `heading`: Bezeichnung als Artikeltitel; `body`: Artikeltitel bleibt, Bezeichnung darunter. */
  placement: 'heading' | 'body';
}

export interface EnactedArticlePresentation {
  /** Normkörper mit eingekürzten Artikeln (unverändert dasselbe Objekt, wenn nichts zutrifft). */
  body: NormBodyBlock[];
  /** Block, der die Bezeichnung trägt (Artikel oder Textzeile), → allgemeiner Normlink. */
  links: ReadonlyMap<NormBodyBlock, string>;
  articles: EnactedArticle[];
}

const STRUCTURAL_TYPES = new Set<NormBodyBlock['type']>(['part', 'chapter', 'section', 'subsection', 'paragraph', 'article', 'annex']);
/** Nur für den Vergleich: Zitatzeichen an beiden Enden. */
const QUOTE_MARKS = /^[\s„“”‚‘’"'«»,]+|[\s„“”‚‘’"'«»]+$/gu;
/** Anführungszeichen je Familie (doppelt, einfach, Guillemets) für die Anzeige. */
const QUOTE_FAMILIES = ['„“”"', '‚‘’\'', '«»‹›'];
const OPENING_QUOTES = '„‚«‹“‘"\'';
const INNER_OPENING = '„‚«‹';
const INNER_CLOSING = '“”‘’»›';

/** Eingeführte Vorschriften aus den Beziehungen der abgeleiteten Daten (je Slug einmal). */
export function enactedNormReferences(relations: readonly Pick<NormRelationView, 'kind' | 'slug' | 'title' | 'shortTitle'>[] | undefined): EnactedNormReference[] {
  const seen = new Set<string>();
  const result: EnactedNormReference[] = [];
  for (const relation of relations ?? []) {
    if (relation.kind !== 'enacts' || seen.has(relation.slug)) continue;
    seen.add(relation.slug);
    result.push({ slug: relation.slug, title: relation.title, ...(relation.shortTitle ? { shortTitle: relation.shortTitle } : {}) });
  }
  return result;
}

function plainText(value: string | undefined): string {
  return toDisplayText(value ?? '').replace(/­/gu, '').replace(/\s+/gu, ' ').trim();
}

const countIn = (text: string, family: string): number => [...text].filter((character) => family.includes(character)).length;

/** Umschließt ein Anführungszeichenpaar den ganzen Text (innere Zitate vollständig geschlossen)? */
function isEnclosed(text: string): boolean {
  if (text.length < 2 || !OPENING_QUOTES.includes(text.charAt(0)) || !INNER_CLOSING.includes(text.charAt(text.length - 1))) return false;
  let depth = 0;
  for (const character of text.slice(1, -1)) {
    if (INNER_OPENING.includes(character)) depth += 1;
    else if (INNER_CLOSING.includes(character)) {
      if (depth === 0) return false;
      depth -= 1;
    }
  }
  return depth === 0;
}

/**
 * Bezeichnung für die Anzeige: Zitatzeichen am Rand entfallen nur, wenn sie den ganzen Text
 * umschließen oder im Text kein Gegenstück haben (Anfang oder Ende des umgebenden Zitats). Ein
 * Titel, der mit einem geschlossenen Zitat endet (… Anstalt „Muster Anstalt“), behält sein
 * schließendes Zeichen.
 */
function displayLine(value: string | undefined): string {
  let text = plainText(value).replace(/^[\s,]+/u, '');
  for (let changed = true; changed && text;) {
    changed = false;
    if (isEnclosed(text)) {
      text = text.slice(1, -1).trim();
      changed = true;
      continue;
    }
    for (const family of QUOTE_FAMILIES) {
      if (countIn(text, family) % 2 === 0) continue;
      if (family.includes(text.charAt(0))) text = text.slice(1).replace(/^[\s,]+/u, '');
      else if (family.includes(text.charAt(text.length - 1))) text = text.slice(0, -1).trimEnd();
      else continue;
      changed = true;
      break;
    }
  }
  return text;
}

/** Vergleichsform: Zitatzeichen an beiden Enden entfernt, Bindestriche vereinheitlicht, klein. */
function normalize(value: string | undefined): string {
  return plainText(value).replace(QUOTE_MARKS, '').replace(/\s+/gu, ' ').trim().replace(/[‐‑‒–—]/gu, '-').toLocaleLowerCase('de-DE');
}

/** Titelvarianten für den Vergleich: vollständiger Titel und Titel ohne Klammer am Ende. */
function titleKeys(title: string): string[] {
  const full = normalize(title);
  const withoutParenthesis = full.replace(/\s*\([^()]*\)$/u, '').trim();
  return [...new Set([full, withoutParenthesis])].filter((key) => key.length >= 12);
}

/** Beginnt der Text mit dem Titel, und zwar an einer Wortgrenze? */
function startsWithTitle(text: string | undefined, keys: string[]): boolean {
  const value = normalize(text);
  return keys.some((key) => value.startsWith(key) && !/[\p{L}\p{N}]/u.test(value.charAt(key.length)));
}

const isPlainLine = (block: NormBodyBlock): boolean =>
  block.type === 'paragraphText' && !block.label && !block.title && !(block.children?.length) && Boolean(plainText(block.text));

/** Gliederungseinheiten unmittelbar im Zitat. */
const quotedUnitCount = (quote: NormBodyBlock): number => (quote.children ?? []).filter((child) => STRUCTURAL_TYPES.has(child.type)).length;

interface ArticleShape {
  intro: NormBodyBlock[];
  quote: NormBodyBlock;
  /** Kopfzeile des Zitats (Titel des Gesetzes vor der ersten Einheit), falls vorhanden. */
  quoteHead?: NormBodyBlock;
  units: number;
}

/** Artikel aus höchstens zwei Einleitungszeilen und genau einem Zitat mit Gliederungseinheiten. */
function articleShape(block: NormBodyBlock): ArticleShape | undefined {
  if (block.type !== 'article') return undefined;
  const children = block.children ?? [];
  const quote = children.at(-1);
  if (!quote || quote.type !== 'quotedProvision') return undefined;
  const intro = children.slice(0, -1);
  if (intro.length > 2 || !intro.every(isPlainLine)) return undefined;
  const units = quotedUnitCount(quote);
  if (units === 0) return undefined;
  const first = quote.children?.[0];
  return { intro, quote, ...(first && isPlainLine(first) ? { quoteHead: first } : {}), units };
}

/** Artikel mit einem unmittelbaren Zitat, das Gliederungseinheiten enthält (Neufassungen eingeschlossen). */
function quotesUnits(block: NormBodyBlock): boolean {
  return block.type === 'article' && (block.children ?? []).some((child) => child.type === 'quotedProvision' && quotedUnitCount(child) > 0);
}

function fallbackText(norm: EnactedNormReference): string {
  const title = displayLine(norm.title);
  const shortTitle = displayLine(norm.shortTitle);
  return shortTitle && !normalize(title).includes(normalize(shortTitle)) ? `${title} (${shortTitle})` : title;
}

interface Located {
  path: number[];
  block: NormBodyBlock;
}

/** Artikel außerhalb von Zitaten in Dokumentreihenfolge. */
function locateArticles(blocks: NormBodyBlock[], path: number[] = [], found: Located[] = []): Located[] {
  blocks.forEach((block, index) => {
    if (block.type === 'quotedProvision') return;
    const currentPath = [...path, index];
    if (block.type === 'article') {
      found.push({ path: currentPath, block });
      return;
    }
    if (block.children) locateArticles(block.children, currentPath, found);
  });
  return found;
}

/** Ermittelt die Artikel, die ein eingeführtes Gesetz vollständig wiedergeben (fail-closed). */
export function findEnactedArticles(body: NormBodyBlock[], enacted: readonly EnactedNormReference[]): EnactedArticle[] {
  if (enacted.length === 0 || body.length === 0) return [];
  const keys = enacted.map((norm) => ({ norm, keys: titleKeys(norm.title) }));
  const articles = locateArticles(body);
  const matches: EnactedArticle[] = [];

  for (const { path, block } of articles) {
    const shape = articleShape(block);
    if (!shape) continue;
    const lines = [...shape.intro, ...(shape.quoteHead ? [shape.quoteHead] : [])];
    const hits = keys.flatMap(({ norm, keys: titleKey }): Array<{ norm: EnactedNormReference; line: NormBodyBlock | undefined }> => {
      const line = lines.find((entry) => startsWithTitle(entry.text, titleKey));
      if (line) return [{ norm, line }];
      if (block.title && startsWithTitle(block.title, titleKey)) return [{ norm, line: undefined }];
      return [];
    });
    if (hits.length !== 1) continue;
    const [{ norm, line }] = hits;
    const ownTitle = displayLine(block.title);
    // Der Artikeltitel ist selbst der Gesetzestitel; sonst trägt die Zeile mit dem Titel die Bezeichnung.
    if (!line) matches.push({ path, slug: norm.slug, text: ownTitle, placement: 'heading' });
    else matches.push({ path, slug: norm.slug, text: displayLine(line.text), placement: ownTitle ? 'body' : 'heading' });
  }

  // Eine eingeführte Vorschrift gehört zu genau einem Artikel; Mehrfachtreffer bleiben Volltext.
  const perSlug = new Map<string, number>();
  for (const match of matches) perSlug.set(match.slug, (perSlug.get(match.slug) ?? 0) + 1);
  const unique = matches.filter((match) => perSlug.get(match.slug) === 1);
  if (unique.length > 0 || enacted.length !== 1) return unique;

  // Eindeutige Zuordnung: genau eine eingeführte Vorschrift und genau ein Artikel mit Zitat ganzer Gliederungseinheiten.
  const candidates = articles.filter(({ block }) => quotesUnits(block));
  if (candidates.length !== 1) return [];
  const [{ path, block }] = candidates;
  const shape = articleShape(block);
  if (!shape || shape.units < 2) return [];
  const ownTitle = displayLine(block.title);
  const text = shape.quoteHead ? displayLine(shape.quoteHead.text) : fallbackText(enacted[0]);
  // Ohne Einleitung ist der eigene Artikeltitel die Bezeichnung des eingeführten Gesetzes.
  if (ownTitle && shape.intro.length === 0 && !shape.quoteHead) return [{ path, slug: enacted[0].slug, text: ownTitle, placement: 'heading' }];
  return [{ path, slug: enacted[0].slug, text, placement: ownTitle ? 'body' : 'heading' }];
}

export interface EnactedPresentationOptions {
  /** Verweisziel je eingeführter Vorschrift; Standard ist der allgemeine Normlink. */
  hrefFor?: (slug: string) => string;
  /**
   * Für die PDF-Ausgabe, die keine Verweise kennt: Unter der Bezeichnung steht die Adresse des
   * Stammeintrags (`hrefFor` liefert dann eine absolute Adresse).
   */
  addressLine?: boolean;
}

/**
 * Normkörper für Bildschirm, PDF und Fassungsvergleich: Die zugeordneten Artikel behalten
 * Bezeichnung und Anker; statt Einleitungssatz und Zitat tragen sie nur die Bezeichnung des
 * eingeführten Gesetzes – als Artikeltitel (`heading`) oder als Textzeile unter dem eigenen
 * Artikeltitel (`body`). Alle anderen Blöcke bleiben dieselben Objekte an denselben Indexpfaden.
 */
export function presentEnactedArticles(
  body: NormBodyBlock[],
  enacted: readonly EnactedNormReference[],
  options: EnactedPresentationOptions = {},
): EnactedArticlePresentation {
  const { hrefFor = getNormUrl, addressLine = false } = options;
  const articles = findEnactedArticles(body, enacted);
  const links = new Map<NormBodyBlock, string>();
  if (articles.length === 0) return { body, links, articles };

  const byPath = new Map(articles.map((article) => [article.path.join('.'), article]));
  const rewrite = (blocks: NormBodyBlock[], path: number[]): NormBodyBlock[] => blocks.map((block, index) => {
    const currentPath = [...path, index];
    const article = byPath.get(currentPath.join('.'));
    if (article) {
      const href = hrefFor(article.slug);
      const address: NormBodyBlock[] = addressLine ? [{ type: 'paragraphText', text: href }] : [];
      if (article.placement === 'heading') {
        const collapsed: NormBodyBlock = { ...block, title: article.text, children: address };
        links.set(collapsed, href);
        return collapsed;
      }
      const line: NormBodyBlock = { type: 'paragraphText', text: article.text };
      links.set(line, href);
      return { ...block, children: [line, ...address] };
    }
    if (block.type === 'quotedProvision' || !block.children?.length) return block;
    const isAncestor = articles.some((entry) => entry.path.length > currentPath.length && currentPath.every((value, position) => entry.path[position] === value));
    return isAncestor ? { ...block, children: rewrite(block.children, currentPath) } : block;
  });

  return { body: rewrite(body, []), links, articles };
}

/** Fassungen mit dargestelltem Normkörper (Fassungsvergleich); unveränderte Fassungen bleiben dieselben Objekte. */
export function presentEnactedVersions<T extends { body: NormBodyBlock[] }>(versions: readonly T[], enacted: readonly EnactedNormReference[]): T[] {
  return versions.map((version) => {
    const { body } = presentEnactedArticles(version.body, enacted);
    return body === version.body ? version : { ...version, body };
  });
}
