// apps/recht/src/lib/history-labels.ts – Bezeichnungen der Änderungseinträge in Nutzersprache
// (reine Darstellung, außerhalb der D1-Projektion).
import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { LEGAL_BASELINE_DATE } from '@ostrecht/shared/lib/norms/origin.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';

/**
 * Die Änderungseinträge des übernommenen Rechts tragen aus dem Import zwei Wortlaute, die keine
 * Auskunft geben: einen Platzhalter („Verkündung.“) und die Herkunftsformel mit dem
 * maschinennahen Wort „Rechtsüberleitungsstichtag“ und einem ISO-Datum. Beides wird hier zur
 * Anzeige abgebildet; der Bestand bleibt unangetastet, bis die Metadaten redaktionell
 * nachgeschärft sind. Neue Wortlaute des Imports müssen die Muster treffen oder von vornherein
 * Nutzersprache liefern.
 */

/** Titel, die nur die Art des Eintrags wiederholen und deshalb nichts erklären. */
const PLACEHOLDER_TITLE = /^(?:Verkündung|Stammfassung(?: verkündet)?|Erlass|Ausgangsfassung|Verkündete Fassung|Eingeführte Stammfassung)\.?$/u;

/** „Vollständige Ausgangsfassung zum Rechtsüberleitungsstichtag (Artikel 2 der Mantelvorschrift).“ */
const BASELINE_TITLE = /^Vollständige Ausgangsfassung zum (?:Rechtsüberleitungsstichtag|verbindlichen Stichtag)(?:\s\((.+?)\))?\.?$/u;

/** „Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01: übernommener Rechtsstand dieses Tages.“ */
const BASELINE_NOTE = /^Ausgangsfassung zum Rechtsüberleitungsstichtag (\d{4}-\d{2}-\d{2}):\s*(.*)$/u;

/** Übernommene Ausgangsfassung: ein Satz mit ausgeschriebenem Datum, ohne Systemwort. */
function baselineWording(date: string, addition?: string): string {
  const scope = addition ? ` (${addition})` : '';
  return `Übernommene Ausgangsfassung mit Rechtsstand vom ${formatDate(date)}${scope}`;
}

/** Ein Platzhaltertitel trägt keine Aussage und wird durch das Vollzitat ersetzt. */
export function isPlaceholderHistoryTitle(title: string | null | undefined): boolean {
  return PLACEHOLDER_TITLE.test(toDisplayText(title ?? '').trim());
}

/**
 * Titel eines Änderungseintrags für die Anzeige: Platzhalter liefern `undefined` (die Aufrufer
 * setzen dann das Vollzitat), die Herkunftsformel wird ausgeschrieben, alles andere bleibt.
 */
export function displayHistoryTitle(title: string | null | undefined): string | undefined {
  const text = toDisplayText(title ?? '').trim();
  if (!text) return undefined;
  if (PLACEHOLDER_TITLE.test(text)) return undefined;
  const baseline = text.match(BASELINE_TITLE);
  if (baseline) return baselineWording(LEGAL_BASELINE_DATE, baseline[1]);
  return text;
}

/**
 * Änderungsstand einer Fassung für die Anzeige: die Herkunftsformel wird ausgeschrieben,
 * das nachgestellte „übernommener Rechtsstand dieses Tages“ entfällt als Wiederholung.
 */
export function displayChangeNote(note: string | null | undefined): string {
  const text = toDisplayText(note ?? '').trim();
  const baseline = text.match(BASELINE_NOTE);
  if (!baseline) return text;
  const rest = baseline[2].replace(/^übernommener Rechtsstand dieses Tages\.?$/u, '').trim();
  return rest ? `${baselineWording(baseline[1])}: ${rest}` : `${baselineWording(baseline[1])}.`;
}

/**
 * Wirksamkeitstag einer Protokollzeile: Stammfassung und Änderung wirken ab dem Geltungsbeginn
 * der entstandenen Fassung (Inkrafttreten), nicht ab dem Datum der Vorschrift, das als
 * Eintragsdatum gespeichert ist (Ausfertigung, Unterzeichnung). Ein Hinweis (Berichtigung,
 * späterer übernommener Zwischenstand) behält sein Eintragsdatum; ohne Fassung bleibt ebenfalls
 * das Eintragsdatum.
 */
export function historyEffectiveDate(
  entry: { date: string; type: string },
  version: { validFrom: string } | null | undefined,
): string {
  if (entry.type === 'notice' || !version?.validFrom) return entry.date;
  return version.validFrom;
}

/**
 * Klammerinhalt, der eine Fundstelle bezeichnet: ein Blattkürzel („…Bl.“ wie GVBl., ABl., MBl.,
 * OVertrBl., oder StAnz…), eine Seiten- oder Nummernangabe oder die amtliche Einzelverkündung.
 * Klammern mit Titel, Kurzbezeichnung oder Gliederungsangabe („Testgesetz“, „TGB IX“, „Achter
 * Abschnitt“) sind keine Fundstelle.
 */
const CITATION_REFERENCE = /\p{L}Bl\.|\bStAnz|\bS\.\s*\S|\bNr\.\s*\d|Einzelverkündung/u;

/** Klammerinhalte eines Vollzitats in Leserichtung, ohne Klammern innerhalb zitierter Titel („…“). */
function citationBrackets(text: string): string[] {
  const quoted = [...text.matchAll(/„[^„“”]*[“”]/gu)].map((match) => [match.index, match.index + match[0].length]);
  return [...text.matchAll(/\(([^()]*)\)/gu)]
    .filter((match) => !quoted.some(([start, end]) => match.index > start && match.index < end))
    .map((match) => match[1].trim());
}

/**
 * Fundstelle aus einem Vollzitat: die erste (`first`, Stammfundstelle) oder letzte (`last`,
 * Fundstelle der ändernden Vorschrift) Klammer, die eine Fundstelle bezeichnet. Ein Vollzitat
 * ohne Klammer gilt unverändert; trägt es nur Klammern mit Titel oder Kurzbezeichnung, gibt es
 * keine Fundstelle (leere Zeichenkette). Gemeinsame Regel für Protokoll, Kopf und
 * Vorschriftendaten (`shortCitation`, `amendingCitation` in norm-head.ts).
 */
export function citationReference(citation: string | null | undefined, position: 'first' | 'last' = 'first'): string {
  const text = toDisplayText(citation ?? '').trim();
  if (!/\([^()]*\)/u.test(text)) return text;
  const references = citationBrackets(text).filter((inner) => CITATION_REFERENCE.test(inner));
  return (position === 'first' ? references[0] : references.at(-1)) ?? '';
}

/**
 * Fundstelle einer Protokollzeile ohne Verkündungsbezug: Die Stammfassung (und eine Aufhebung,
 * deren Vollzitat die aufgehobene Vorschrift bezeichnet) nennt die erste Fundstelle, also die
 * Stammfundstelle; Änderungen und Hinweise nennen die letzte, also die Fundstelle der ändernden
 * Vorschrift („… (TBl. S. 1), das zuletzt durch Artikel 2 des Gesetzes vom … (TBl. S. 9)
 * geändert worden ist“ → „TBl. S. 9“). Klammern mit Titel oder Kurzbezeichnung zählen nicht.
 */
export function historyCitationLabel(entry: { type: string; citation?: string | null }): string {
  return citationReference(entry.citation, entry.type === 'initial' || entry.type === 'repeal' ? 'first' : 'last');
}

/**
 * Außerkrafttreten durch Befristung: ein Aufhebungseintrag ohne aufhebende Vorschrift im Bestand,
 * dessen Titel oder Hinweis die Befristung nennt. Es gibt keine Aufhebungsvorschrift; die Fundstelle ist die der
 * Vorschrift, die die Befristung enthält – bei einer Befristung im eigenen (übernommenen) Text die
 * Stammfundstelle der Vorschrift selbst, sonst die der befristenden Vorschrift. Beides ist die erste
 * Fundstelle des Vollzitats (historyCitationLabel), nie die Fundstelle einer späteren Änderung.
 */
export function isSunsetEntry(entry: { type: string; title?: string | null; note?: string | null; relatedNorm?: string | null }): boolean {
  return entry.type === 'repeal' && !entry.relatedNorm && /\bBefristung\b/u.test(`${entry.title ?? ''} ${entry.note ?? ''}`);
}

const HISTORY_TYPE_LABELS: Record<string, string> = { initial: 'Stammfassung', amendment: 'Änderung', repeal: 'Aufhebung', notice: 'Hinweis' };

/**
 * Art eines Historieneintrags in Nutzersprache (Spalte „Art“ des Protokolls, Änderungsvorschriften
 * der Vorschriftendaten). Eine Befristung ist keine Aufhebung durch eine andere Vorschrift.
 */
export function historyTypeLabel(entry: { type: string; title?: string | null; note?: string | null; relatedNorm?: string | null }): string {
  if (isSunsetEntry(entry)) return 'Befristung';
  return HISTORY_TYPE_LABELS[entry.type] ?? entry.type;
}

/**
 * Art eines künftigen Historieneintrags (nach dem Stichtag wirksam): Stammfassung und Änderung
 * sind „Noch nicht in Kraft“; eine Befristung tritt nicht in Kraft, sondern läuft ab und bleibt
 * deshalb als Befristung bezeichnet, mit dem Zusatz der Künftigkeit.
 */
export function futureHistoryTypeLabel(entry: { type: string; title?: string | null; note?: string | null; relatedNorm?: string | null }): string {
  return isSunsetEntry(entry) ? 'Befristung (künftig)' : 'Noch nicht in Kraft';
}

/**
 * Bestandsschlüssel einer Vorschrift am Anfang eines Hinweises: „gesetz-zur-…, Artikel 1“ oder
 * ein Schlüssel aus einem Wort („testgesetz, Artikel 11“). Ein Wort ohne Bindestrich gilt nur als
 * Schlüssel, wenn es eine vorhandene Vorschrift bezeichnet (siehe `displayHistoryNote`).
 */
const NOTE_SLUG_REFERENCE = /^([a-z0-9]+(?:-[a-z0-9]+)*),\s*(.+)$/u;

/** Nachsatz mit dem Ablageort einer Redaktionsentscheidung; er gehört nicht in die Anzeige. */
const NOTE_DECISION_FILE = /\s*Entscheidung dokumentiert in [^\s]+\.(?:json|md)\.?\s*$/u;

export interface HistoryNoteDisplay {
  /** Angezeigter Text ohne Bestandsschlüssel und Ablageorte. */
  text: string;
  /** Bezeichnete Vorschrift, wenn der Hinweis eine im Bestand vorhandene Vorschrift nennt. */
  relatedSlug?: string;
  relatedLabel?: string;
  /** Fundort in der bezeichneten Vorschrift („Artikel 1 Einleitungssatz“). */
  provision?: string;
}

/**
 * Hinweis einer Protokollzeile für die Anzeige. Der Import belegt übernommene Zwischenstände mit
 * „<Bestandsschlüssel>, <Fundort>“; angezeigt werden die Bezeichnung der Vorschrift (über
 * `labelOf`) und der Fundort, nie der Schlüssel. Ist ein Schlüssel mit Bindestrich nicht
 * auflösbar, bleibt nur der Fundort; ein nicht auflösbares einzelnes Wort ist kein Schlüssel, der
 * Hinweis bleibt dann unverändert. Nachsätze mit Ablageorten von Redaktionsentscheidungen entfallen.
 */
export function displayHistoryNote(
  note: string | null | undefined,
  labelOf: (slug: string) => string | undefined,
): HistoryNoteDisplay | undefined {
  // Der Schlüssel wird vor der Anzeigeaufbereitung erkannt, die einzelne Wortteile umschreibt.
  const raw = (note ?? '').replace(NOTE_DECISION_FILE, '').trim();
  if (!raw) return undefined;
  const reference = raw.match(NOTE_SLUG_REFERENCE);
  if (!reference) return { text: toDisplayText(raw) };
  const [, slug, rest] = reference;
  const provision = toDisplayText(rest).trim();
  const label = labelOf(slug);
  if (!label && !slug.includes('-')) return { text: toDisplayText(raw) };
  if (!label) return { text: `Beleg in der ändernden Vorschrift: ${provision}` };
  return { text: `Beleg: ${label}, ${provision}`, relatedSlug: slug, relatedLabel: label, provision };
}

/**
 * Bestandsschlüssel, den ein Hinweis bezeichnen kann (für das Nachladen der Bezeichnung); ob ein
 * einzelnes Wort tatsächlich eine Vorschrift bezeichnet, entscheidet erst die geladene Bezeichnung.
 */
export function historyNoteSlug(note: string | null | undefined): string | undefined {
  return (note ?? '').trim().match(NOTE_SLUG_REFERENCE)?.[1];
}

/** Anfang eines Vollzitats ohne Fundstellenklammer: „Gesetz vom 2. September 2026“. */
function citationOpening(citation: string | null | undefined): string {
  const text = toDisplayText(citation ?? '').trim();
  if (!text) return '';
  return text.split('(')[0].replace(/[,;]\s*$/u, '').trim();
}

/**
 * Ein Änderungseintrag in einem Satz (Startseite, Kurzverläufe): der Titel, wenn er etwas sagt,
 * sonst der Anfang des Vollzitats.
 */
export function describeChange(change: { title?: string | null; citation?: string | null }): string {
  const title = displayHistoryTitle(change.title);
  if (title) return title;
  return citationOpening(change.citation) || toDisplayText(change.citation ?? '').trim();
}

/** Führendes Ereigniswort eines Eintragstitels: „Änderung durch …“, „Aufhebung durch …“. */
const CAUSE_PREFIX = /^(?:Änderung|Aufhebung|Neufassung|Berichtigung|Erlass|Einführung)\s+(?=durch\s)/u;

/**
 * Ursache eines Änderungseintrags für Listen, die das Ereignis schon in eigenen Worten nennen
 * (Änderungsdienst der Startseite): Der Titel ohne das führende Ereigniswort, damit die Zeile
 * „geändert“ nicht als „Änderung durch …“ wiederholt. Platzhaltertitel liefern nichts; die
 * Fundstelle steht in solchen Fällen für sich.
 */
export function describeChangeCause(change: { title?: string | null }): string {
  const title = displayHistoryTitle(change.title);
  return title ? title.replace(CAUSE_PREFIX, '') : '';
}

/**
 * Ein Eintragstitel, der einen Satz oder eine Änderungsnotiz trägt („… wurde neu gefasst.“,
 * „… berücksichtigt.“), bezeichnet keine Vorschrift. Er bleibt als Ursache lesbar, taugt aber
 * nicht als Einschub in „zuletzt geändert durch …“.
 */
function isSentence(text: string): boolean {
  return /\b(?:wurde|wurden|wird|werden|ist|sind|berücksichtigt|gefasst|ergänzt|gestrichen|aufgehoben|eingefügt)\b/u.test(text) || /[.;]\s*\S/u.test(text);
}

/**
 * Verursachende Vorschrift für Zeilen, die das Wort „durch“ selbst tragen („zuletzt geändert
 * durch …“, „abgelöst durch …“): der Titel ohne Ereigniswort und ohne „durch“, ohne Schlusspunkt.
 * Ist der Titel ein Satz, steht stattdessen der Anfang des Vollzitats („Gesetz vom …“); fehlt
 * auch der, bleibt die Angabe leer, und die Zeile nennt nur das Datum.
 */
export function describeChangeAgent(change: { title?: string | null; citation?: string | null }): string {
  const cause = describeChangeCause(change).replace(/^durch\s+/u, '').replace(/\.\s*$/u, '').trim();
  if (cause && !isSentence(cause)) return cause;
  return citationOpening(change.citation);
}
