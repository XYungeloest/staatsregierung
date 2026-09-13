import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Einheitenart einer Vorschrift und ihre Benennung für Schalter und Zähler. Reine Darstellung:
 * der D1-Sync erreicht dieses Modul nicht (tests/d1-projection-closure.test.mjs führt es in der
 * Negativliste), es wird nur von der Oberfläche und vom Vergleichsrenderer verwendet.
 *
 * Der Bestand kennt Vorschriften mit Artikeln, mit Paragraphen, mit beidem und ohne beides
 * (Bekanntmachungen und andere Texte aus reinen Absätzen); deshalb darf keine Beschriftung
 * „Paragraphen“ fest verdrahtet sein.
 */
export type NormUnitKind = 'article' | 'paragraph' | 'mixed' | 'none';

interface UnitWords {
  /** Einzahl mit Genus, damit „1 geänderter Artikel“ und „1 geänderte Textstelle“ stimmen. */
  one: string;
  many: string;
  genus: 'maskulin' | 'feminin';
}

const UNIT_WORDS: Record<NormUnitKind, UnitWords> = {
  article: { one: 'Artikel', many: 'Artikel', genus: 'maskulin' },
  paragraph: { one: 'Paragraph', many: 'Paragraphen', genus: 'maskulin' },
  mixed: { one: 'Artikel oder Paragraph', many: 'Artikel und Paragraphen', genus: 'maskulin' },
  none: { one: 'Textstelle', many: 'Textstellen', genus: 'feminin' },
};

/**
 * Einheitenart aus dem Normkörper: Artikel und Paragraphen zählen auf jeder Gliederungsebene,
 * zitierte Vorschriften bleiben außen vor (sie gehören zum wiedergegebenen fremden Text).
 */
export function getNormUnitKind(blocks: NormBodyBlock[]): NormUnitKind {
  let hasArticle = false;
  let hasParagraph = false;

  function visit(entries: NormBodyBlock[]): void {
    for (const block of entries) {
      if (block.type === 'quotedProvision') continue;
      if (block.type === 'article') hasArticle = true;
      if (block.type === 'paragraph') hasParagraph = true;
      if (block.children && block.children.length > 0) visit(block.children);
    }
  }

  visit(blocks);
  if (hasArticle && hasParagraph) return 'mixed';
  if (hasArticle) return 'article';
  if (hasParagraph) return 'paragraph';
  return 'none';
}

/** Benennung der Einheiten: `'all'` und jede Anzahl außer eins ergeben die Mehrzahl. */
export function formatNormUnitKind(kind: NormUnitKind, count: number | 'all'): string {
  const words = UNIT_WORDS[kind];
  return count === 1 ? words.one : words.many;
}

/** Zähler des Fassungsvergleichs: „1 geänderter Artikel“, „132 geänderte Artikel“, „1 geänderte Textstelle“. */
export function formatChangedUnitCount(count: number, kind: NormUnitKind = 'none'): string {
  const adjective = count === 1 && UNIT_WORDS[kind].genus === 'maskulin' ? 'geänderter' : 'geänderte';
  return `${count} ${adjective} ${formatNormUnitKind(kind, count)}`;
}

export type NormUnitChange = 'changed' | 'added' | 'removed';

const CHANGE_ADJECTIVES: Record<NormUnitChange, { plural: string; maskulin: string; feminin: string }> = {
  changed: { plural: 'geänderte', maskulin: 'geänderter', feminin: 'geänderte' },
  added: { plural: 'neue', maskulin: 'neuer', feminin: 'neue' },
  removed: { plural: 'entfallene', maskulin: 'entfallener', feminin: 'entfallene' },
};

/** Zähler je Art der Änderung: „13 neue Artikel“, „1 entfallener Paragraph“, „2 geänderte Textstellen“. */
export function formatUnitChangeCount(count: number, change: NormUnitChange, kind: NormUnitKind = 'none'): string {
  const words = CHANGE_ADJECTIVES[change];
  const adjective = count === 1 ? words[UNIT_WORDS[kind].genus] : words.plural;
  return `${count} ${adjective} ${formatNormUnitKind(kind, count)}`;
}

/** Zähler der Umgliederung: „128 Artikel neu gegliedert“, „3 Einheiten neu gegliedert“ (ohne bekannte Einheitenart). */
export function formatRegroupedUnitCount(count: number, kind: NormUnitKind = 'none'): string {
  const noun = kind === 'none' ? (count === 1 ? 'Einheit' : 'Einheiten') : formatNormUnitKind(kind, count);
  return `${count} ${noun} neu gegliedert`;
}
