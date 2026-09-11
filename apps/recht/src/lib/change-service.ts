import { EDITORIAL_REFERENCE_DATE, LEGAL_CHANGE_ENTRY_TYPES } from '@ostrecht/shared/lib/norms/versions.ts';
import { getLawPortalUrl, getNormHistoryUrl, toDisplayText } from '@ostrecht/shared/lib/norms/index.ts';

import { describeChange, describeChangeCause } from './history-labels.ts';
import { shortCitation } from './norm-head.ts';
import type { NormChange, NormStore } from './runtime/store.ts';
import { referenceDateLabel } from './vocabulary.ts';

/**
 * Änderungsdienst (P1): drei Spalten der Rechtswirkung – „Neu in Kraft getreten“, „Verkündet,
 * noch nicht in Kraft“, „Außer Kraft getreten“ – aus der D1-Projektion, ohne den Normenbestand zu
 * laden. Startseite und RSS-Feed lesen dieselben Spalten und dieselben Wörter.
 */
export const CHANGE_SERVICE_LIMIT = 5;
export const CHANGE_SERVICE_CANDIDATE_LIMIT = 12;

export type ChangeServiceColumnKey = 'current' | 'future' | 'repealed';

export interface ChangeServiceColumn {
  key: ChangeServiceColumnKey;
  heading: string;
  tone: 'in-force' | 'future' | 'repealed';
  entries: NormChange[];
  empty: string;
}

/**
 * Ereigniswort einer Zeile: die Rechtswirkung, nicht die Art der Vorschrift. Eingetretene und
 * künftige Wirkung bilden ein Wortpaar („erstmals in Kraft“ / „tritt in Kraft“), damit die
 * Spalten dieselbe Aussage in derselben Reihenfolge treffen.
 */
export function eventLabel(change: NormChange): string {
  if (change.changeType === 'repeal') return 'aufgehoben';
  return change.changeType === 'initial' ? 'erstmals in Kraft' : 'geändert';
}

export function futureEventLabel(change: NormChange): string {
  if (change.changeType === 'repeal') return 'tritt außer Kraft';
  return change.changeType === 'initial' ? 'tritt in Kraft' : 'wird geändert';
}

/** Ereigniswort je Spalte: künftige Spalte in der Zukunftsform. */
export function columnEventLabel(column: ChangeServiceColumnKey, change: NormChange): string {
  return column === 'future' ? futureEventLabel(change) : eventLabel(change);
}

/**
 * Detailzeile: die Ursache ohne das Ereigniswort und die Fundstelle. Auf der Startseite steht
 * die Fundstelle allein, wo der Eintragstitel nur das Vollzitat wiederholt; der vollständige
 * Wortlaut steht im Änderungsverlauf der Vorschrift.
 */
export function changeDetail(change: NormChange): string[] {
  const cause = describeChangeCause(change);
  const reference = shortCitation(change.citation);
  if (cause && reference && !cause.includes(reference)) return [cause, reference];
  return [cause || reference || describeChange(change)];
}

export async function loadChangeService(store: NormStore, referenceDate: string = EDITORIAL_REFERENCE_DATE): Promise<ChangeServiceColumn[]> {
  const changeTypes = [...LEGAL_CHANGE_ENTRY_TYPES];
  const inForceTypes = changeTypes.filter((type) => type !== 'repeal');
  const [inForce, future, repealed] = await Promise.all([
    // Neu in Kraft getreten: Erlass und Änderung bis zum Stichtag, je Norm das jüngste Ereignis.
    store.listChanges({ changeTypes: inForceTypes, until: referenceDate, order: 'desc', limit: CHANGE_SERVICE_CANDIDATE_LIMIT, distinctNorms: true }),
    // Verkündet, noch nicht in Kraft: alle Rechtsereignisse nach dem Stichtag, nächstes zuerst.
    store.listChanges({ changeTypes, after: referenceDate, order: 'asc', limit: CHANGE_SERVICE_CANDIDATE_LIMIT, distinctNorms: true }),
    // Außer Kraft getreten: Aufhebungen bis zum Stichtag.
    store.listChanges({ changeTypes: ['repeal'], until: referenceDate, order: 'desc', limit: CHANGE_SERVICE_CANDIDATE_LIMIT, distinctNorms: true }),
  ]);
  return [
    { key: 'current', heading: 'Neu in Kraft getreten', tone: 'in-force', entries: inForce, empty: 'Im Bestand ist keine neu in Kraft getretene Vorschrift verzeichnet.' },
    { key: 'future', heading: 'Verkündet, noch nicht in Kraft', tone: 'future', entries: future, empty: 'Derzeit ist keine künftige Änderung verkündet.' },
    { key: 'repealed', heading: 'Außer Kraft getreten', tone: 'repealed', entries: repealed, empty: 'Im Bestand ist keine Aufhebung verzeichnet.' },
  ];
}

function escapeXml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/'/gu, '&apos;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

/** RFC-822-Datum der Rechtswirkung (Mittag UTC, wie der Pressefeed des Staatsportals). */
function rfc822(date: string): string {
  return new Date(`${date}T12:00:00Z`).toUTCString();
}

export const CHANGE_FEED_PATH = '/aenderungsdienst/rss.xml';
export const CHANGE_FEED_TITLE = 'OstRecht – Änderungsdienst';

/**
 * RSS 2.0 des gesamten Änderungsdiensts (E38): je Spalte höchstens fünf Einträge, jeder mit
 * Titel „<Kurztitel> <Ereigniswort>“, Ursache und Fundstelle, Kategorie der Spalte, Link auf den
 * Änderungsverlauf der Vorschrift, Datum der Rechtswirkung und stabiler Kennung aus Slug, Datum
 * und Ereignisart. Keine Feeds je Vorschrift, keine E-Mail.
 */
export function buildChangeFeed(columns: ChangeServiceColumn[], options: { baseUrl: URL; referenceDate?: string }): string {
  const referenceDate = options.referenceDate ?? EDITORIAL_REFERENCE_DATE;
  const absolute = (path: string): string => new URL(path, options.baseUrl).toString();
  const items = columns.flatMap((column) => column.entries.slice(0, CHANGE_SERVICE_LIMIT).map((change) => {
    const link = absolute(getNormHistoryUrl(change.slug));
    const title = `${toDisplayText(change.normShortTitle || change.normTitle)} ${columnEventLabel(column.key, change)}`;
    return [
      '<item>',
      `<title>${escapeXml(title)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid isPermaLink="false">${escapeXml(`${change.slug}:${change.date}:${change.changeType}`)}</guid>`,
      `<category>${escapeXml(column.heading)}</category>`,
      `<pubDate>${rfc822(change.date)}</pubDate>`,
      `<description>${escapeXml(changeDetail(change).join(' · '))}</description>`,
      '</item>',
    ].join('');
  }));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${escapeXml(CHANGE_FEED_TITLE)}</title>`,
    `<link>${escapeXml(absolute(`${getLawPortalUrl()}#aenderungsdienst`))}</link>`,
    `<atom:link href="${escapeXml(absolute(CHANGE_FEED_PATH))}" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeXml(`Neu in Kraft getretene, verkündete und außer Kraft getretene Vorschriften des Ostdeutschen Freistaates, ${referenceDateLabel(referenceDate)}.`)}</description>`,
    '<language>de</language>',
    `<lastBuildDate>${rfc822(referenceDate)}</lastBuildDate>`,
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n');
}
