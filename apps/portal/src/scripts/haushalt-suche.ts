/**
 * Haushaltssuche einer Periode (/haushalt/<periode>/suche/).
 *
 * Der schlanke Suchindex (/haushalt/<periode>/daten/suchindex.json) wird erst bei Fokus oder
 * Eingabe geladen, sofort nur, wenn die Adresse bereits eine Anfrage (?q=) trägt. Gesucht wird
 * nach Wortanfängen und Wortteilen über Vorhaben, Einzelpläne, Kapitel, Titel und Übersichtsseiten,
 * mit deutscher Normalisierung (Umlaute, ß, Groß- und Kleinschreibung), mehreren Wörtern (alle
 * müssen passen) und den redaktionellen Alltagsbegriffen aus content/haushalt/<periode>/suchbegriffe.json.
 * Technische Anfragen („Einzelplan 04“ oder kurz „04“, „Kapitel 04 07“, „Titel 633 61“, „Gruppe 422“, „TG 61“,
 * „Funktion 114“) liefern die genauen Treffer zuerst.
 *
 * Die Trefferliste ist gruppiert, nennt Beträge (gerundet sichtbar, exakt in <data value>) und
 * verlinkt Titel mit dem Sprungziel #titel-<nummer> der Kapitelseite. Die Anfrage steht per
 * history.replaceState in ?q=. Ohne Skript bleibt das Formular ein gewöhnliches GET-Formular, und
 * die Seite verweist auf die Einzelpläne.
 */
import { formatEuroExact, formatEuroRounded, normalizeSearch } from '../components/haushalt/format.ts';

// ---------------------------------------------------------------------------------------------
// Format des Suchindex (erzeugt von pages/haushalt/[periode]/daten/suchindex.json.ts)

/** Ziel einer redaktionellen Zuordnung: p:<projekt>, e:<ep>, k:<kapitel>, t:<kapitel>/<titel>, g:<gruppe>[@<kapitel>,…]. */
export type Suchziel = `${'p' | 'e' | 'k' | 't' | 'g'}:${string}`;

/** Titel: Kapitel, Titelnummer, Titelgruppe, Zweckbestimmung, Gruppe, Funktion, Projektindex (−1 = keins), Seite, Beträge je Jahr. */
export type SuchindexTitel = [string, string, string, string, string, string, number, 'E' | 'A', ...number[]];

export interface SuchindexDatei {
  schema: 'haushalt-suchindex/1';
  periode: string;
  bezeichnung: string;
  jahre: string[];
  /** n Nummer, t Kurztitel, a amtliche Bezeichnung (falls abweichend), k Kategorie, u Adresse, x Ausgaben, e Einnahmen. */
  einzelplaene: Array<{ n: string; t: string; a?: string; k?: string; u: string; x: number[]; e: number[] }>;
  /** n Nummer, t Bezeichnung, f Funktion, u Adresse, x Ausgaben, e Einnahmen. */
  kapitel: Array<{ n: string; t: string; f: string; u: string; x: number[]; e: number[] }>;
  /** Gruppe → [Bezeichnung, Beträge je Jahr]. */
  gruppen: Record<string, [string, ...number[]]>;
  /** Funktion → [Bezeichnung, Ausgaben je Jahr]. */
  funktionen: Record<string, [string, ...number[]]>;
  /** i Kennung, t Titel, u Adresse, s Status, f Fachbereich, ep Einzelplan, w Suchbegriffe, x Ausgaben (null = ohne Betrag), h Betragshinweis. */
  projekte: Array<{ i: string; t: string; u: string; s: string; f: string; ep: string; w: string[]; x: number[] | null; h?: string }>;
  titel: SuchindexTitel[];
  synonyme: Array<{ w: string[]; z: Suchziel[] }>;
  /** Übersichtsseiten der Periode: t Titel, u Adresse, d Beschreibung, w Suchwörter. */
  seiten: Array<{ t: string; u: string; d: string; w: string }>;
}

// ---------------------------------------------------------------------------------------------
// Normalisierung und Abgleich

export type Gruppe = 'projekte' | 'einzelplaene' | 'kapitel' | 'seiten' | 'titel';

export interface Treffer {
  gruppe: Gruppe;
  schluessel: string;
  score: number;
  /** Absoluter Betrag für die Reihung bei gleicher Relevanz. */
  gewicht: number;
}

interface Eintrag {
  gruppe: Gruppe;
  schluessel: string;
  basis: number;
  gewicht: number;
  primaer: string[];
  sekundaer: string[];
  /** Normalisierter Haupttext für Phrasenbonus. */
  text: string;
}

/** Suchnormalisierung: Kleinbuchstaben, Umlaute ausgeschrieben, ß → ss, Satzzeichen als Leerraum. */
export function normalisiere(value: string): string {
  return normalizeSearch(value.replace(/[–—‑-]/gu, ' '))
    .replace(/[^a-z0-9 ]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function woerter(value: string): string[] {
  const text = normalisiere(value);
  return text === '' ? [] : text.split(' ');
}

const ENDUNGEN = ['ern', 'en', 'er', 'es', 'e', 'n', 's'];

/** Suchwort und vorsichtig gekürzte Formen (Mehrzahl, Fugen), mindestens fünf Zeichen. */
export function varianten(token: string): string[] {
  const result = [token];
  for (const endung of ENDUNGEN) {
    if (token.endsWith(endung) && token.length - endung.length >= 5) result.push(token.slice(0, -endung.length));
  }
  return result;
}

/** Güte eines Suchworts in einer Wortliste: 3 gleich, 2 Wortanfang, 1 Wortteil, 0 kein Treffer. */
function guete(token: string, liste: string[]): number {
  // Kurze Wörter („HO“, „IT“) zählen nur als ganzes Wort.
  if (token.length < 3) return liste.includes(token) ? 3 : 0;
  const formen = varianten(token);
  let best = 0;
  for (const wort of liste) {
    for (const form of formen) {
      if (wort === form) return 3;
      if (wort.startsWith(form)) best = Math.max(best, form === token ? 2 : 1.8);
      else if (form.length >= 4 && wort.includes(form)) best = Math.max(best, 1);
    }
  }
  return best;
}

const BASIS: Record<Gruppe, number> = { projekte: 3000, einzelplaene: 2500, kapitel: 2000, titel: 1000, seiten: 500 };
const TECHNISCH = 10_000;
const TECHNISCH_FOLGE = 9_000;
const SYNONYM_BONUS = 400;

export interface TechnischeAnfrage {
  art: 'einzelplan' | 'kapitel' | 'titel' | 'kapiteltitel' | 'gruppe' | 'titelgruppe' | 'funktion';
  wert: string;
  kapitel?: string;
}

/** Erkennt technische Anfragen in amtlicher und verkürzter Schreibweise. */
export function technischeAnfrage(query: string): TechnischeAnfrage | null {
  const q = normalizeSearch(query).replace(/[.,:;]+/gu, ' ').replace(/\s*\/\s*/gu, ' / ').replace(/\s+/gu, ' ').trim();
  let match = /^(?:einzelplan|epl|ep)\s?(\d{1,2})$/u.exec(q);
  if (match) return { art: 'einzelplan', wert: match[1].padStart(2, '0') };
  // Bloße zweistellige Nummer („04“): Einzelplan, sofern es ihn gibt; sonst gewöhnliche Suche.
  match = /^(\d{2})$/u.exec(q);
  if (match) return { art: 'einzelplan', wert: match[1] };
  match = /^(?:(?:kapitel|kap)\s?)?(\d{2})\s?(\d{2})\s?(?:\/\s?)?(?:(?:titel|tit)\s?)?(\d{3})\s?(\d{2})$/u.exec(q);
  if (match) return { art: 'kapiteltitel', wert: `${match[3]}${match[4]}`, kapitel: `${match[1]}${match[2]}` };
  match = /^(?:kapitel|kap)\s?(\d{2})\s?(\d{2})$/u.exec(q) ?? /^(\d{2})(?: |)(\d{2})$/u.exec(q);
  if (match) return { art: 'kapitel', wert: `${match[1]}${match[2]}` };
  match = /^(?:titel|tit)\s?(\d{3})\s?(\d{2})$/u.exec(q) ?? /^(\d{3})(?: |)(\d{2})$/u.exec(q);
  if (match) return { art: 'titel', wert: `${match[1]}${match[2]}` };
  match = /^(?:gruppierung|gruppierungsnummer|gruppe|grp|gr)\s?(\d{3})$/u.exec(q);
  if (match) return { art: 'gruppe', wert: match[1] };
  match = /^(?:titelgruppe|tgr|tg)\s?(\d{2})$/u.exec(q);
  if (match) return { art: 'titelgruppe', wert: match[1] };
  match = /^(?:funktion|funktionskennziffer|fkz|fkt|fu)\s?(\d{3})$/u.exec(q);
  if (match) return { art: 'funktion', wert: match[1] };
  return null;
}

export const titelSchluessel = (eintrag: SuchindexTitel): string => `${eintrag[0]}/${eintrag[1]}`;

/** Suchmaschine über einen geladenen Index (rein, ohne DOM; testbar). */
export function erstelleSuche(index: SuchindexDatei) {
  const eintraege: Eintrag[] = [];
  const projektNamen = index.projekte.map((projekt) => projekt.t);
  const summe = (werte: number[] | null | undefined) => (werte ?? []).reduce((acc, wert) => acc + Math.abs(wert), 0);

  for (const projekt of index.projekte) {
    eintraege.push({
      gruppe: 'projekte',
      schluessel: projekt.i,
      basis: BASIS.projekte,
      gewicht: summe(projekt.x),
      primaer: woerter(projekt.t),
      sekundaer: woerter(`${projekt.w.join(' ')} ${projekt.f}`),
      text: normalisiere(projekt.t),
    });
  }
  for (const plan of index.einzelplaene) {
    eintraege.push({
      gruppe: 'einzelplaene',
      schluessel: plan.n,
      basis: BASIS.einzelplaene,
      gewicht: summe(plan.x),
      primaer: woerter(plan.t),
      sekundaer: woerter(`${plan.a ?? ''} ${plan.k ?? ''}`),
      text: normalisiere(plan.t),
    });
  }
  for (const kapitel of index.kapitel) {
    eintraege.push({
      gruppe: 'kapitel',
      schluessel: kapitel.n,
      basis: BASIS.kapitel,
      gewicht: summe(kapitel.x) || summe(kapitel.e),
      primaer: woerter(kapitel.t),
      sekundaer: [],
      text: normalisiere(kapitel.t),
    });
  }
  for (const seite of index.seiten) {
    eintraege.push({
      gruppe: 'seiten',
      schluessel: seite.u,
      basis: BASIS.seiten,
      gewicht: 0,
      primaer: woerter(seite.t),
      sekundaer: woerter(`${seite.w} ${seite.d}`),
      text: normalisiere(seite.t),
    });
  }
  for (const titel of index.titel) {
    const projekt = titel[6] >= 0 ? projektNamen[titel[6]] ?? '' : '';
    const gruppe = index.gruppen[titel[4]]?.[0] ?? '';
    eintraege.push({
      gruppe: 'titel',
      schluessel: titelSchluessel(titel),
      basis: BASIS.titel,
      gewicht: summe(titel.slice(8) as number[]),
      primaer: woerter(titel[3]),
      sekundaer: woerter(`${projekt} ${gruppe}`),
      text: normalisiere(titel[3]),
    });
  }

  // Redaktionelle Zuordnungen: normalisierte Wörter → Ziele (als Eintragsschlüssel).
  const synonyme = index.synonyme.map((eintrag) => ({
    woerter: eintrag.w.map(normalisiere),
    ziele: eintrag.z.flatMap((ziel): Array<{ gruppe: Gruppe; schluessel: string }> => {
      const [art, rest] = [ziel.slice(0, 1), ziel.slice(2)];
      if (art === 'p') return [{ gruppe: 'projekte', schluessel: rest }];
      if (art === 'e') return [{ gruppe: 'einzelplaene', schluessel: rest }];
      if (art === 'k') return [{ gruppe: 'kapitel', schluessel: rest }];
      if (art === 't') return [{ gruppe: 'titel', schluessel: rest }];
      const [gruppe, kapitelListe] = rest.split('@');
      const kapitel = kapitelListe ? new Set(kapitelListe.split(',')) : null;
      return index.titel
        .filter((titel) => titel[4] === gruppe && (!kapitel || kapitel.has(titel[0])))
        .map((titel) => ({ gruppe: 'titel' as const, schluessel: titelSchluessel(titel) }));
    }),
  }));

  /** Ziele der Zuordnungen, deren Wort zur Anfrage passt: gleich (1) oder Wortanfang ab drei Zeichen (0,6). */
  function synonymZiele(phrase: string): Map<string, number> {
    const result = new Map<string, number>();
    if (phrase.length < 2) return result;
    const formen = varianten(phrase);
    for (const eintrag of synonyme) {
      let staerke = 0;
      for (const wort of eintrag.woerter) {
        const wortFormen = varianten(wort);
        if (formen.some((form) => wortFormen.includes(form))) staerke = Math.max(staerke, 1);
        else if (phrase.length >= 3 && wort.startsWith(phrase)) staerke = Math.max(staerke, 0.6);
      }
      if (staerke === 0) continue;
      for (const ziel of eintrag.ziele) {
        const key = `${ziel.gruppe}|${ziel.schluessel}`;
        result.set(key, Math.max(result.get(key) ?? 0, staerke));
      }
    }
    return result;
  }

  function technisch(anfrage: TechnischeAnfrage): Treffer[] {
    const treffer: Treffer[] = [];
    const add = (gruppe: Gruppe, schluessel: string, score: number, gewicht = 0) => treffer.push({ gruppe, schluessel, score, gewicht });
    switch (anfrage.art) {
      case 'einzelplan': {
        const plan = index.einzelplaene.find((entry) => entry.n === anfrage.wert);
        if (plan) add('einzelplaene', plan.n, TECHNISCH);
        index.kapitel
          .filter((kapitel) => kapitel.n.startsWith(anfrage.wert))
          .forEach((kapitel, position) => add('kapitel', kapitel.n, TECHNISCH_FOLGE - position));
        break;
      }
      case 'kapitel': {
        const kapitel = index.kapitel.find((entry) => entry.n === anfrage.wert);
        if (kapitel) add('kapitel', kapitel.n, TECHNISCH);
        index.titel
          .filter((titel) => titel[0] === anfrage.wert)
          .forEach((titel, position) => add('titel', titelSchluessel(titel), TECHNISCH_FOLGE - position));
        break;
      }
      case 'kapiteltitel':
        index.titel
          .filter((titel) => titel[0] === anfrage.kapitel && titel[1] === anfrage.wert)
          .forEach((titel) => add('titel', titelSchluessel(titel), TECHNISCH));
        break;
      case 'titel':
        index.titel
          .filter((titel) => titel[1] === anfrage.wert)
          .forEach((titel) => add('titel', titelSchluessel(titel), TECHNISCH, summe(titel.slice(8) as number[])));
        break;
      case 'gruppe':
        index.titel
          .filter((titel) => titel[4] === anfrage.wert)
          .forEach((titel) => add('titel', titelSchluessel(titel), TECHNISCH, summe(titel.slice(8) as number[])));
        break;
      case 'titelgruppe':
        index.titel
          .filter((titel) => titel[2] === anfrage.wert)
          .forEach((titel) => add('titel', titelSchluessel(titel), TECHNISCH, summe(titel.slice(8) as number[])));
        break;
      case 'funktion':
        index.kapitel
          .filter((kapitel) => kapitel.f === anfrage.wert)
          .forEach((kapitel) => add('kapitel', kapitel.n, TECHNISCH, summe(kapitel.x)));
        index.titel
          .filter((titel) => titel[5] === anfrage.wert)
          .forEach((titel) => add('titel', titelSchluessel(titel), TECHNISCH_FOLGE, summe(titel.slice(8) as number[])));
        break;
    }
    return treffer;
  }

  function suche(query: string): { treffer: Treffer[]; technisch: TechnischeAnfrage | null; woerter: string[] } {
    const phrase = normalisiere(query);
    if (phrase === '') return { treffer: [], technisch: null, woerter: [] };
    const anfrage = technischeAnfrage(query);
    const exakt = anfrage ? technisch(anfrage) : [];
    if (anfrage && exakt.length > 0) return { treffer: sortiere(exakt), technisch: anfrage, woerter: [] };

    // Eine mehrwortige Zuordnung („Gemeingut Wohnen“) gilt für die ganze Anfrage.
    const ganzeAnfrage = synonymZiele(phrase);
    const tokens = phrase.split(' ').filter((token) => token.length > 0);
    const jeWort = tokens.map((token) => synonymZiele(token));
    const treffer: Treffer[] = [];
    for (const eintrag of eintraege) {
      const key = `${eintrag.gruppe}|${eintrag.schluessel}`;
      const ganz = tokens.length > 1 ? ganzeAnfrage.get(key) ?? 0 : 0;
      let score = 0;
      let synonym = ganz;
      let passt = true;
      if (ganz === 0) {
        for (let position = 0; position < tokens.length; position += 1) {
          const token = tokens[position];
          const primaer = guete(token, eintrag.primaer);
          const sekundaer = primaer > 0 ? 0 : guete(token, eintrag.sekundaer) * 0.6;
          const syn = jeWort[position].get(key) ?? 0;
          if (primaer === 0 && sekundaer === 0 && syn === 0) {
            passt = false;
            break;
          }
          score += Math.max(primaer, sekundaer) * 10;
          synonym = Math.max(synonym, syn);
        }
      }
      if (!passt) continue;
      if (eintrag.text === phrase) score += 60;
      else if (eintrag.text.startsWith(phrase)) score += 25;
      else if (tokens.length > 1 && eintrag.text.includes(phrase)) score += 15;
      score += synonym * SYNONYM_BONUS;
      treffer.push({ gruppe: eintrag.gruppe, schluessel: eintrag.schluessel, score: eintrag.basis + score, gewicht: eintrag.gewicht });
    }
    return { treffer: sortiere(treffer), technisch: anfrage, woerter: tokens };
  }

  return { suche };
}

function sortiere(treffer: Treffer[]): Treffer[] {
  return [...treffer].sort((left, right) => right.score - left.score || right.gewicht - left.gewicht || left.schluessel.localeCompare(right.schluessel, 'de'));
}

// ---------------------------------------------------------------------------------------------
// Darstellung

const GRUPPEN_TITEL: Record<Gruppe, { titel: string; einzahl: string; mehrzahl: string; anfang: number; schritt: number }> = {
  projekte: { titel: 'Vorhaben', einzahl: 'Vorhaben', mehrzahl: 'Vorhaben', anfang: 5, schritt: 10 },
  einzelplaene: { titel: 'Einzelpläne', einzahl: 'Einzelplan', mehrzahl: 'Einzelpläne', anfang: 5, schritt: 10 },
  kapitel: { titel: 'Kapitel', einzahl: 'Kapitel', mehrzahl: 'Kapitel', anfang: 6, schritt: 10 },
  seiten: { titel: 'Übersichtsseiten', einzahl: 'Übersichtsseite', mehrzahl: 'Übersichtsseiten', anfang: 3, schritt: 10 },
  titel: { titel: 'Titel', einzahl: 'Titel', mehrzahl: 'Titel', anfang: 8, schritt: 20 },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (zeichen) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[zeichen] ?? zeichen);
}

/** Markiert Wortanfänge und Wortteile der Suchwörter im Originaltext (Normalisierung zeichengenau abgebildet). */
export function markiere(text: string, tokens: string[]): string {
  if (tokens.length === 0) return escapeHtml(text);
  let normal = '';
  const herkunft: number[] = [];
  let offset = 0;
  for (const zeichen of text) {
    const form = normalizeSearch(zeichen).replace(/[^a-z0-9]/gu, ' ') || ' ';
    for (const teil of form) {
      normal += teil;
      herkunft.push(offset);
    }
    offset += zeichen.length;
  }
  const bereiche: Array<[number, number]> = [];
  for (const token of tokens) {
    const formen = varianten(token).filter((form) => form.length >= 2);
    for (const form of formen) {
      let start = normal.indexOf(form);
      while (start >= 0) {
        const wortanfang = start === 0 || normal[start - 1] === ' ';
        if (wortanfang || form.length >= 4) {
          const ende = start + form.length;
          const originalEnde = ende < herkunft.length ? herkunft[ende] : text.length;
          bereiche.push([herkunft[start], originalEnde]);
        }
        start = normal.indexOf(form, start + 1);
      }
    }
  }
  if (bereiche.length === 0) return escapeHtml(text);
  bereiche.sort((left, right) => left[0] - right[0] || right[1] - left[1]);
  const zusammen: Array<[number, number]> = [];
  for (const bereich of bereiche) {
    const letzter = zusammen[zusammen.length - 1];
    if (letzter && bereich[0] <= letzter[1]) letzter[1] = Math.max(letzter[1], bereich[1]);
    else zusammen.push([...bereich]);
  }
  let html = '';
  let cursor = 0;
  for (const [start, ende] of zusammen) {
    html += `${escapeHtml(text.slice(cursor, start))}<mark>${escapeHtml(text.slice(start, ende))}</mark>`;
    cursor = ende;
  }
  return html + escapeHtml(text.slice(cursor));
}

const kapitelnummer = (code: string) => (/^\d{4}$/u.test(code) ? `${code.slice(0, 2)} ${code.slice(2)}` : code);
const titelnummer = (code: string) => (/^\d{5}$/u.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

function betrag(value: number): string {
  const gerundet = formatEuroRounded(value);
  const exakt = formatEuroExact(value);
  const title = gerundet === exakt ? '' : ` title="${escapeHtml(exakt)}"`;
  return `<data class="hh-betrag${value < 0 ? ' hh-betrag--negativ' : ''}" value="${Math.trunc(value)}"${title}>${escapeHtml(gerundet)}</data>`;
}

function betragszeile(label: string, jahre: string[], werte: number[]): string {
  const teile = jahre.map((jahr, position) => `<span class="hh-suche__betrag"><span class="hh-suche__jahr">${escapeHtml(label)} ${escapeHtml(jahr)}</span> ${betrag(werte[position] ?? 0)}</span>`);
  return `<p class="hh-suche__betraege">${teile.join('')}</p>`;
}

function initialisiere(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('[data-haushalt-suchfeld]');
  const input = root.querySelector<HTMLInputElement>('[data-haushalt-suche-eingabe]');
  const status = root.querySelector<HTMLElement>('[data-haushalt-suche-status]');
  const ergebnis = root.querySelector<HTMLElement>('[data-haushalt-suche-ergebnis]');
  const ohneSkript = root.querySelectorAll<HTMLElement>('[data-haushalt-suche-ohne-skript]');
  const indexUrl = root.dataset.indexUrl;
  if (!form || !input || !status || !ergebnis || !indexUrl) return;
  ohneSkript.forEach((element) => {
    element.hidden = true;
  });
  root.dataset.haushaltSucheBereit = 'true';

  let index: SuchindexDatei | null = null;
  let engine: ReturnType<typeof erstelleSuche> | null = null;
  let laden: Promise<void> | null = null;
  let fehler = false;
  let sichtbar: Partial<Record<Gruppe, number>> = {};
  let timer: number | undefined;
  const nachSchluessel = new Map<string, unknown>();

  const ladeIndex = (): Promise<void> => {
    laden ??= fetch(indexUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Suchindex nicht erreichbar (${response.status})`);
        index = (await response.json()) as SuchindexDatei;
        engine = erstelleSuche(index);
        index.projekte.forEach((projekt) => nachSchluessel.set(`projekte|${projekt.i}`, projekt));
        index.einzelplaene.forEach((plan) => nachSchluessel.set(`einzelplaene|${plan.n}`, plan));
        index.kapitel.forEach((kapitel) => nachSchluessel.set(`kapitel|${kapitel.n}`, kapitel));
        index.seiten.forEach((seite) => nachSchluessel.set(`seiten|${seite.u}`, seite));
        index.titel.forEach((titel) => nachSchluessel.set(`titel|${titelSchluessel(titel)}`, titel));
      })
      .catch(() => {
        fehler = true;
      });
    return laden;
  };

  const kapitelVon = (code: string) => index?.kapitel.find((kapitel) => kapitel.n === code);
  const planVon = (code: string) => index?.einzelplaene.find((plan) => plan.n === code);

  const renderTreffer = (treffer: Treffer, tokens: string[]): string => {
    if (!index) return '';
    const jahre = index.jahre;
    const eintrag = nachSchluessel.get(`${treffer.gruppe}|${treffer.schluessel}`);
    switch (treffer.gruppe) {
      case 'projekte': {
        const projekt = eintrag as SuchindexDatei['projekte'][number];
        const plan = planVon(projekt.ep);
        const meta = [projekt.f, projekt.s, plan ? `Einzelplan ${plan.n}` : ''].filter(Boolean);
        return `<li class="hh-suche__treffer">
          <p class="hh-suche__titel"><a class="inline-link" href="${escapeHtml(projekt.u)}">${markiere(projekt.t, tokens)}</a></p>
          <p class="hh-suche__meta">${meta.map((teil) => `<span>${escapeHtml(teil)}</span>`).join('')}</p>
          ${projekt.x ? betragszeile('Ausgaben', jahre, projekt.x) : ''}
          ${projekt.x && projekt.h ? `<p class="hh-suche__hinweis">${escapeHtml(projekt.h)}</p>` : ''}
        </li>`;
      }
      case 'einzelplaene': {
        const plan = eintrag as SuchindexDatei['einzelplaene'][number];
        const meta = [plan.k ?? '', plan.a ? `Amtliche Bezeichnung: ${plan.a}` : ''].filter(Boolean);
        return `<li class="hh-suche__treffer">
          <p class="hh-suche__titel"><a class="inline-link" href="${escapeHtml(plan.u)}"><span class="hh-kennung">Einzelplan ${escapeHtml(plan.n)}</span>: ${markiere(plan.t, tokens)}</a></p>
          ${meta.length > 0 ? `<p class="hh-suche__meta">${meta.map((teil) => `<span>${escapeHtml(teil)}</span>`).join('')}</p>` : ''}
          ${betragszeile('Ausgaben', jahre, plan.x)}
        </li>`;
      }
      case 'kapitel': {
        const kapitel = eintrag as SuchindexDatei['kapitel'][number];
        const plan = planVon(kapitel.n.slice(0, 2));
        const einnahmenStattAusgaben = kapitel.x.every((wert) => wert === 0);
        return `<li class="hh-suche__treffer">
          <p class="hh-suche__titel"><a class="inline-link" href="${escapeHtml(kapitel.u)}"><span class="hh-kennung">Kapitel ${kapitelnummer(kapitel.n)}</span>: ${markiere(kapitel.t, tokens)}</a></p>
          ${plan ? `<p class="hh-suche__meta"><span>Einzelplan ${escapeHtml(plan.n)}: ${escapeHtml(plan.t)}</span></p>` : ''}
          ${einnahmenStattAusgaben ? betragszeile('Einnahmen', jahre, kapitel.e) : betragszeile('Ausgaben', jahre, kapitel.x)}
        </li>`;
      }
      case 'seiten': {
        const seite = eintrag as SuchindexDatei['seiten'][number];
        return `<li class="hh-suche__treffer">
          <p class="hh-suche__titel"><a class="inline-link" href="${escapeHtml(seite.u)}">${markiere(seite.t, tokens)}</a></p>
          <p class="hh-suche__meta"><span>${escapeHtml(seite.d)}</span></p>
        </li>`;
      }
      case 'titel': {
        const titel = eintrag as SuchindexTitel;
        const kapitel = kapitelVon(titel[0]);
        const href = `${kapitel?.u ?? ''}#titel-${titel[1]}`;
        const projekt = titel[6] >= 0 ? index.projekte[titel[6]] : undefined;
        const meta = [
          titel[7] === 'E' ? 'Einnahmetitel' : 'Ausgabetitel',
          `Kapitel ${kapitelnummer(titel[0])}${kapitel ? `: ${kapitel.t}` : ''}`,
          `Gruppe ${titel[4]}`,
          titel[2] ? `Titelgruppe ${titel[2]}` : '',
          titel[5] ? `Funktion ${titel[5]}` : '',
        ].filter(Boolean);
        return `<li class="hh-suche__treffer">
          <p class="hh-suche__titel"><a class="inline-link" href="${escapeHtml(href)}"><span class="hh-kennung">Titel ${titelnummer(titel[1])}</span>: ${markiere(titel[3], tokens)}</a></p>
          <p class="hh-suche__meta">${meta.map((teil) => `<span>${escapeHtml(teil)}</span>`).join('')}</p>
          ${projekt ? `<p class="hh-suche__meta"><span>Vorhaben: <a class="inline-link" href="${escapeHtml(projekt.u)}">${escapeHtml(projekt.t)}</a></span></p>` : ''}
          ${betragszeile('Ansatz', jahre, titel.slice(8) as number[])}
        </li>`;
      }
    }
  };

  const zusammenfassung = (anfrage: TechnischeAnfrage | null): string => {
    if (!index || !anfrage) return '';
    if (anfrage.art === 'gruppe' && index.gruppen[anfrage.wert]) {
      const [bezeichnung, ...werte] = index.gruppen[anfrage.wert];
      return `<div class="hh-suche__kennung"><p><strong>Gruppe ${escapeHtml(anfrage.wert)}: ${escapeHtml(bezeichnung)}</strong></p>${betragszeile('Summe aller Einzelpläne', index.jahre, werte)}</div>`;
    }
    if (anfrage.art === 'funktion' && index.funktionen[anfrage.wert]) {
      const [bezeichnung, ...werte] = index.funktionen[anfrage.wert];
      return `<div class="hh-suche__kennung"><p><strong>Funktion ${escapeHtml(anfrage.wert)}: ${escapeHtml(bezeichnung)}</strong></p>${betragszeile('Ausgaben aller Einzelpläne', index.jahre, werte)}</div>`;
    }
    if (anfrage.art === 'titelgruppe') {
      return `<div class="hh-suche__kennung"><p><strong>Titelgruppe ${escapeHtml(anfrage.wert)}</strong></p><p class="hh-suche__meta"><span>Titelgruppen fassen zusammengehörige Titel innerhalb eines Kapitels zusammen.</span></p></div>`;
    }
    return '';
  };

  const zaehle = (anzahl: number, gruppe: Gruppe) => `${anzahl} ${anzahl === 1 ? GRUPPEN_TITEL[gruppe].einzahl : GRUPPEN_TITEL[gruppe].mehrzahl}`;

  const aktualisiere = (fokusGruppe?: Gruppe, fokusAb?: number) => {
    const query = input.value.trim();
    const params = new URLSearchParams(window.location.search);
    if (query) params.set('q', query);
    else params.delete('q');
    const suchteil = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${suchteil ? `?${suchteil}` : ''}${window.location.hash}`);

    if (!query) {
      ergebnis.innerHTML = '';
      status.textContent = 'Geben Sie einen Suchbegriff ein, zum Beispiel ein Vorhaben, eine Einrichtung oder eine Titelnummer.';
      return;
    }
    if (fehler) {
      ergebnis.innerHTML = '';
      status.textContent = 'Die Haushaltssuche ist derzeit nicht erreichbar. Alle Ansätze finden Sie über die Einzelpläne.';
      ohneSkript.forEach((element) => {
        element.hidden = false;
      });
      return;
    }
    if (!engine || !index) {
      status.textContent = `Suche nach „${query}“ wird vorbereitet …`;
      return;
    }
    const { treffer, technisch, woerter: tokens } = engine.suche(query);
    const gruppen = new Map<Gruppe, Treffer[]>();
    for (const eintrag of treffer) {
      const liste = gruppen.get(eintrag.gruppe) ?? [];
      liste.push(eintrag);
      gruppen.set(eintrag.gruppe, liste);
    }
    const reihenfolge = [...gruppen.entries()].sort((left, right) => right[1][0].score - left[1][0].score);
    if (treffer.length === 0) {
      status.textContent = `Keine Treffer für „${query}“.`;
      ergebnis.innerHTML = `<p class="search-feedback search-feedback--warning">Keine Treffer für „${escapeHtml(query)}“. Prüfen Sie die Schreibweise, verwenden Sie einen allgemeineren Begriff oder suchen Sie nach einer Einzelplan-, Kapitel- oder Titelnummer.</p>`;
      return;
    }
    const teile = reihenfolge.map(([gruppe, liste]) => zaehle(liste.length, gruppe));
    status.textContent = `${treffer.length} Treffer für „${query}“: ${teile.join(', ')}.`;
    const html = reihenfolge
      .map(([gruppe, liste]) => {
        const info = GRUPPEN_TITEL[gruppe];
        const anzahl = Math.min(liste.length, sichtbar[gruppe] ?? info.anfang);
        const rest = liste.length - anzahl;
        const naechste = Math.min(rest, info.schritt);
        return `<section class="hh-suche__gruppe" aria-labelledby="hh-suche-gruppe-${gruppe}">
          <div class="hh-suche__gruppenkopf">
            <h2 id="hh-suche-gruppe-${gruppe}">${info.titel}</h2>
            <p>${anzahl < liste.length ? `${anzahl} von ${zaehle(liste.length, gruppe)}` : zaehle(liste.length, gruppe)}</p>
          </div>
          <ol class="hh-suche__liste" id="hh-suche-liste-${gruppe}">${liste.slice(0, anzahl).map((eintrag) => renderTreffer(eintrag, tokens)).join('')}</ol>
          ${rest > 0 ? `<p class="hh-suche__mehr"><button class="button-link button-link--secondary" type="button" data-haushalt-suche-mehr="${gruppe}" aria-controls="hh-suche-liste-${gruppe}">Weitere ${naechste} ${naechste === 1 ? info.einzahl : info.mehrzahl} anzeigen</button></p>` : ''}
        </section>`;
      })
      .join('');
    ergebnis.innerHTML = `${zusammenfassung(technisch)}${html}`;
    if (fokusGruppe !== undefined && fokusAb !== undefined) {
      const ziel = ergebnis.querySelectorAll<HTMLAnchorElement>(`#hh-suche-liste-${fokusGruppe} > li .hh-suche__titel a`)[fokusAb];
      ziel?.focus();
    }
  };

  const starte = () => {
    if (!engine && !fehler && input.value.trim()) status.textContent = `Suche nach „${input.value.trim()}“ wird vorbereitet …`;
    void ladeIndex().then(() => aktualisiere());
  };

  input.addEventListener('focus', () => void ladeIndex(), { once: true });
  input.addEventListener('input', () => {
    sichtbar = {};
    window.clearTimeout(timer);
    timer = window.setTimeout(starte, 180);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      const erster = ergebnis.querySelector<HTMLAnchorElement>('.hh-suche__titel a');
      if (erster) {
        event.preventDefault();
        erster.focus();
      }
    } else if (event.key === 'Escape' && input.value !== '') {
      event.preventDefault();
      input.value = '';
      sichtbar = {};
      aktualisiere();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    sichtbar = {};
    starte();
  });
  ergebnis.addEventListener('click', (event) => {
    const knopf = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-haushalt-suche-mehr]');
    if (!knopf) return;
    const gruppe = knopf.dataset.haushaltSucheMehr as Gruppe;
    const info = GRUPPEN_TITEL[gruppe];
    const bisher = sichtbar[gruppe] ?? info.anfang;
    sichtbar = { ...sichtbar, [gruppe]: bisher + info.schritt };
    aktualisiere(gruppe, bisher);
  });
  root.querySelectorAll<HTMLAnchorElement>('[data-haushalt-suche-beispiel]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      input.value = link.dataset.haushaltSucheBeispiel ?? link.textContent ?? '';
      sichtbar = {};
      input.focus();
      starte();
    });
  });

  const anfangsQuery = new URLSearchParams(window.location.search).get('q') ?? '';
  if (anfangsQuery.trim() !== '') {
    input.value = anfangsQuery;
    starte();
  }
}

if (typeof document !== 'undefined') document.querySelectorAll<HTMLElement>('[data-haushalt-suche]').forEach(initialisiere);
