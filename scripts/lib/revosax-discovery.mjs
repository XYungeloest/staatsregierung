import { parse } from 'parse5';

import { parseGermanDate } from './norm-html-parser.mjs';

/**
 * REVOSax-Stichtagssuche (Discovery des Ausgangsbestands).
 *
 * Reales, im Browser (Network-Tab) und per curl verifiziertes Verhalten der
 * REVOSax-„Erweiterten Suche“ (Stand 3. September 2026):
 *
 * 1. Das sichtbare Formular `/vorschriftensuche` ist ein Rails-Formular
 *    (`POST /suche`, Felder `search_request[...]`, CSRF-`authenticity_token`).
 *    Ein POST ohne die zugehörige Session (Cookie) wird mit HTTP 422
 *    „The change you wanted was rejected“ abgewiesen – das war die Ursache
 *    des früheren Discovery-Fehlers.
 * 2. Dieselbe Suche existiert stateless als
 *    `GET /suche?search_request=<URL-kodiertes JSON>` mit den Feldern
 *    `valid_day` (ISO-Datum), `categories` (Array der Typkürzel),
 *    `include_envelopes` ("1"/"0") und `mode` ("fullsearch" für die
 *    erweiterte Suche; Schnellsuche verwendet "quicksearch").
 * 3. Änderungstypen sind eigene Kategorien im selben Array:
 *    G/ÄG, VO/ÄVO, VwV/ÄVwV, FRL/ÄFRL, StV/ÄStV, ZuG/ÄZuG. Die
 *    Änderungstypen sind im Formular standardmäßig NICHT angehakt.
 * 4. „zugleich Mantelvorschriften“ = `include_envelopes: "1"` (im Formular
 *    standardmäßig aktiv). Für den vollständigen Bestand bleibt es aktiv.
 * 5. Pagination: REVOSax hält die Suche in der Session. Die Trefferliste
 *    zeigt „Seite N von M“ mit 5 Treffern je Seite; die Seitenknöpfe sind
 *    `POST /suche?seite=N`. Ein `GET /suche?seite=N` mit dem Session-Cookie
 *    liefert dieselbe Seite. Ein `page`-Feld im JSON antwortet mit HTTP 500.
 * 6. Treffer verlinken entweder die konkrete historische Fassung
 *    (`/vorschrift/<lawId>.<n>`) oder – wenn die am Geltungstag geltende
 *    Fassung die aktuelle ist – die dynamische Stammnorm-URL
 *    (`/vorschrift/<lawId>-<slug>`). Jeder Treffer nennt „Fassung gültig ab“.
 * 7. REVOSax zählt Trefferzeilen, nicht eindeutige Vorschriften: Einzelne
 *    Vorschriften erscheinen reproduzierbar zweimal in der Liste (3. September
 *    2026: 5092 gemeldete Zeilen, 5089 eindeutige URLs; eine enge Titelsuche
 *    zeigt dieselbe URL zweimal auf einer Seite). Zusätzlich kann die
 *    Reihenfolge zwischen Seitenabrufen schwanken. Die Discovery führt deshalb
 *    bei Abweichung weitere vollständige Durchläufe aus, vereinigt nach URL
 *    und akzeptiert Duplikate nur, wenn zwei aufeinanderfolgende Durchläufe
 *    dieselben doppelten URLs liefern, keine neuen Treffer mehr auftauchen
 *    und eindeutige Treffer plus Duplikatzeilen exakt der Trefferzahl
 *    entsprechen.
 * 8. REVOSax kann für dieselbe lawId zwei Fassungen mit identischem
 *    „Fassung gültig ab“ liefern (nachträglich eingestellte Fassung ohne
 *    Enddatum neben der befristeten). Solche Mehrfachfassungen bleiben im
 *    Manifest erhalten und werden im Staging inhaltlich verglichen; sie werden
 *    nicht still auf eine Fassung reduziert.
 *
 * Alle Prüfungen sind fail-closed: Ohne exakte Übereinstimmung von gemeldeter
 * Trefferzahl, Seitenzahl, Typfacetten und eindeutigen Treffern entsteht kein
 * Manifest.
 */

export const REVOSAX_ORIGIN = 'https://www.revosax.sachsen.de';
export const SEARCH_FORM_URL = `${REVOSAX_ORIGIN}/vorschriftensuche`;
export const SEARCH_URL = `${REVOSAX_ORIGIN}/suche`;
export const DEFAULT_BASELINE_DATE = '2023-11-01';
export const USER_AGENT = 'OstRecht REVOSax-Baseline-Importer/1.1';
export const MANIFEST_SCHEMA_VERSION = 2;

export const STEM_CATEGORIES = ['G', 'VO', 'VwV', 'FRL', 'StV', 'ZuG'];
export const AMENDMENT_CATEGORIES = ['ÄG', 'ÄVO', 'ÄVwV', 'ÄFRL', 'ÄStV', 'ÄZuG'];
export const ALL_CATEGORIES = ['G', 'ÄG', 'VO', 'ÄVO', 'VwV', 'ÄVwV', 'FRL', 'ÄFRL', 'StV', 'ÄStV', 'ZuG', 'ÄZuG'];

/** REVOSax-„Vorschriftentyp“ der Trefferliste → Kategorie und OstRecht-Normtyp. */
export const DOCUMENT_TYPE_CATEGORIES = Object.freeze({
  Gesetz: { category: 'G', normType: 'gesetz' },
  Änderungsgesetz: { category: 'ÄG', normType: 'aenderungsvorschrift' },
  Verordnung: { category: 'VO', normType: 'verordnung' },
  Änderungsverordnung: { category: 'ÄVO', normType: 'aenderungsvorschrift' },
  Verwaltungsvorschrift: { category: 'VwV', normType: 'verwaltungsvorschrift' },
  // REVOSax schreibt die Facette tatsächlich ohne Fugen-s.
  Änderungsverwaltungvorschrift: { category: 'ÄVwV', normType: 'aenderungsvorschrift' },
  Änderungsverwaltungsvorschrift: { category: 'ÄVwV', normType: 'aenderungsvorschrift' },
  Förderrichtlinie: { category: 'FRL', normType: 'foerderrichtlinie' },
  Änderungsförderrichtlinie: { category: 'ÄFRL', normType: 'aenderungsvorschrift' },
  Staatsvertrag: { category: 'StV', normType: 'staatsvertrag' },
  Änderungsstaatsvertrag: { category: 'ÄStV', normType: 'aenderungsvorschrift' },
  Zustimmungsgesetz: { category: 'ZuG', normType: 'zustimmungsgesetz' },
  Änderungszustimmungsgesetz: { category: 'ÄZuG', normType: 'aenderungsvorschrift' },
});

const VORSCHRIFT_PATH = /^\/vorschrift\/(\d+)(?:\.(\d+))?(?:-[^/]*)?$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export class RevosaxDiscoveryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RevosaxDiscoveryError';
  }
}

export class RevosaxHttpError extends Error {
  constructor({ status, method, url, bodyExcerpt }) {
    super(describeHttpFailure({ status, method, url, body: bodyExcerpt }));
    this.name = 'RevosaxHttpError';
    this.status = status;
    this.method = method;
    this.url = url;
    this.bodyExcerpt = bodyExcerpt;
  }
}

// ---------------------------------------------------------------------------
// parse5-Hilfen
// ---------------------------------------------------------------------------

function attrs(node) {
  return Object.fromEntries((node?.attrs ?? []).map(({ name, value }) => [name, value]));
}

function classes(node) {
  return String(attrs(node).class ?? '').split(/\s+/u).filter(Boolean);
}

function hasClass(node, className) {
  return classes(node).includes(className);
}

function walk(node, predicate, output = []) {
  for (const child of node?.childNodes ?? []) {
    if (child.tagName && predicate(child)) output.push(child);
    walk(child, predicate, output);
  }
  return output;
}

function first(node, predicate) {
  return walk(node, predicate)[0] ?? null;
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/[\u00a0\u202f]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function text(node, { skip = () => false } = {}) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  if (node.tagName === 'br') return ' ';
  if (skip(node)) return '';
  return (node.childNodes ?? []).map((child) => text(child, { skip })).join('');
}

function cleanText(node, options) {
  return normalizeWhitespace(text(node, options));
}

/** Zerlegt den Text eines Knotens an `<br>`-Umbrüchen in bereinigte Segmente. */
function segments(node, { skip = () => false } = {}) {
  const parts = [''];
  const visit = (current) => {
    if (!current) return;
    if (current.nodeName === '#text') {
      parts[parts.length - 1] += current.value ?? '';
      return;
    }
    if (current.tagName === 'br') {
      parts.push('');
      return;
    }
    if (skip(current)) return;
    for (const child of current.childNodes ?? []) visit(child);
  };
  visit(node);
  return parts.map(normalizeWhitespace).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Formularinspektion (Strukturänderungen erkennen)
// ---------------------------------------------------------------------------

export function inspectSearchForm(html, { formUrl = SEARCH_FORM_URL } = {}) {
  const document = parse(html);
  const forms = walk(document, (node) => node.tagName === 'form');
  const form = forms.find((candidate) =>
    walk(candidate, (node) => node.tagName === 'input' && attrs(node).name === 'search_request[mode]').length > 0,
  );
  if (!form) {
    throw new RevosaxDiscoveryError('REVOSax-Suchformular mit search_request[mode] nicht gefunden; Formularstruktur prüfen');
  }
  const formAttributes = attrs(form);
  const inputs = walk(form, (node) => node.tagName === 'input');
  const named = (name) => inputs.filter((node) => attrs(node).name === name);

  const modeInput = named('search_request[mode]')[0];
  const mode = attrs(modeInput).value;
  const categoryInputs = named('search_request[categories][]').filter((node) => (attrs(node).type ?? '').toLowerCase() === 'checkbox');
  const categories = categoryInputs.map((node) => attrs(node).value).filter(Boolean);
  const validDayInput = named('search_request[valid_day_de]')[0];
  const envelopeInput = named('search_request[include_envelopes]').find((node) => (attrs(node).type ?? '').toLowerCase() === 'checkbox');
  const tokenInput = named('authenticity_token')[0];

  const problems = [];
  if (!mode) problems.push('search_request[mode] ohne Wert');
  if (!validDayInput) problems.push('Feld search_request[valid_day_de] (Geltungstag) fehlt');
  if (!envelopeInput) problems.push('Feld search_request[include_envelopes] (zugleich Mantelvorschriften) fehlt');
  const missing = ALL_CATEGORIES.filter((category) => !categories.includes(category));
  if (missing.length > 0) problems.push(`Vorschriftentypen fehlen im Formular: ${missing.join(', ')}`);
  const unexpected = categories.filter((category) => !ALL_CATEGORIES.includes(category));
  if (unexpected.length > 0) problems.push(`unbekannte Vorschriftentypen im Formular: ${unexpected.join(', ')}`);
  if (!/\/suche\/?$/u.test(formAttributes.action ?? '')) problems.push(`Formular-Action ist ${formAttributes.action ?? '(leer)'} statt /suche`);
  if (problems.length > 0) {
    throw new RevosaxDiscoveryError(`REVOSax-Suchformular hat sich strukturell verändert: ${problems.join('; ')}`);
  }

  const checkedCategories = categoryInputs.filter((node) => attrs(node).checked !== undefined).map((node) => attrs(node).value);
  return {
    action: new URL(formAttributes.action, formUrl).toString(),
    method: (formAttributes.method ?? 'get').toUpperCase(),
    mode,
    categories,
    defaultCategories: checkedCategories,
    validDayField: attrs(validDayInput).name,
    envelopesField: attrs(envelopeInput).name,
    envelopesDefault: attrs(envelopeInput).checked !== undefined,
    hasAuthenticityToken: Boolean(tokenInput),
  };
}

// ---------------------------------------------------------------------------
// Request-Aufbau
// ---------------------------------------------------------------------------

export function assertIsoDate(value, label = '--date') {
  if (!ISO_DATE.test(String(value ?? ''))) {
    throw new RevosaxDiscoveryError(`Ungültiger ${label}-Wert ${value}; erwartet YYYY-MM-DD`);
  }
  const [year, month, day] = String(value).split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new RevosaxDiscoveryError(`Ungültiger ${label}-Wert ${value}; kein gültiges Kalenderdatum`);
  }
  return value;
}

export function germanDate(isoDate) {
  const [year, month, day] = assertIsoDate(isoDate).split('-');
  return `${day}.${month}.${year}`;
}

export function buildSearchRequest(isoDate, categories = ALL_CATEGORIES, { includeEnvelopes = true, mode = 'fullsearch' } = {}) {
  assertIsoDate(isoDate);
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new RevosaxDiscoveryError('search_request.categories darf nicht leer sein');
  }
  return {
    valid_day: isoDate,
    categories: [...categories],
    include_envelopes: includeEnvelopes ? '1' : '0',
    mode,
  };
}

export function buildSearchUrl(searchRequest) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('search_request', JSON.stringify(searchRequest));
  return url.toString();
}

export function buildResultPageUrl(page) {
  if (!Number.isInteger(page) || page < 1) throw new RevosaxDiscoveryError(`Ungültige Ergebnisseite ${page}`);
  const url = new URL(SEARCH_URL);
  url.searchParams.set('seite', String(page));
  return url.toString();
}

// ---------------------------------------------------------------------------
// HTTP mit Session-Cookie, Retry/Backoff und Diagnose
// ---------------------------------------------------------------------------

export class CookieJar {
  #cookies = new Map();

  absorb(headers) {
    const values = typeof headers?.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [];
    for (const value of values) {
      const pair = String(value).split(';')[0];
      const separator = pair.indexOf('=');
      if (separator <= 0) continue;
      const name = pair.slice(0, separator).trim();
      this.#cookies.set(name, pair.slice(separator + 1).trim());
    }
  }

  get size() {
    return this.#cookies.size;
  }

  header() {
    return [...this.#cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

export function bodyExcerpt(body, limit = 300) {
  const stripped = String(body ?? '')
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ');
  const collapsed = normalizeWhitespace(stripped);
  return collapsed.length > limit ? `${collapsed.slice(0, limit)}…` : collapsed;
}

export function describeHttpFailure({ status, method = 'GET', url, body }) {
  const excerpt = bodyExcerpt(body);
  return `HTTP ${status} bei ${method} ${url}${excerpt ? ` – Antwortauszug: ${excerpt}` : ''}`;
}

function defaultSleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function retryDelay(attempt, baseDelayMs, headers) {
  const retryAfter = Number.parseInt(headers?.get?.('retry-after') ?? '', 10);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 120) * 1000;
  return baseDelayMs * 2 ** attempt;
}

/**
 * Führt einen Request mit Session-Cookie aus. 429 und 5xx werden mit
 * exponentiellem Backoff wiederholt; andere Fehler enthalten Status, Methode,
 * finale URL und einen begrenzten Antwortauszug – nie Header oder Cookies.
 * Mit `binary: true` werden die unveränderten Antwortbytes (für SHA-256) geliefert.
 */
export async function requestWithRetry(url, {
  fetchImpl = globalThis.fetch,
  method = 'GET',
  headers = {},
  body,
  jar,
  retries = 5,
  baseDelayMs = 1000,
  sleep = defaultSleep,
  log = () => {},
  binary = false,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        redirect: 'follow',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
          ...(jar && jar.size > 0 ? { cookie: jar.header() } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body }),
      });
    } catch (error) {
      lastError = new RevosaxDiscoveryError(`Netzwerkfehler bei ${method} ${url}: ${error.message}`);
      if (attempt === retries) break;
      const delay = retryDelay(attempt, baseDelayMs);
      log(`Netzwerkfehler (${error.message}); neuer Versuch in ${delay} ms`);
      await sleep(delay);
      continue;
    }
    jar?.absorb(response.headers);
    const finalUrl = response.url || url;
    if (response.status === 429 || response.status >= 500) {
      const excerpt = bodyExcerpt(await response.text());
      lastError = new RevosaxHttpError({ status: response.status, method, url: finalUrl, bodyExcerpt: excerpt });
      if (attempt === retries) break;
      const delay = retryDelay(attempt, baseDelayMs, response.headers);
      log(`HTTP ${response.status} bei ${method} ${finalUrl}; neuer Versuch in ${delay} ms`);
      await sleep(delay);
      continue;
    }
    if (!response.ok) {
      throw new RevosaxHttpError({ status: response.status, method, url: finalUrl, bodyExcerpt: bodyExcerpt(await response.text()) });
    }
    if (binary) {
      const bytes = Buffer.from(await response.arrayBuffer());
      return { status: response.status, url: finalUrl, bytes, contentType: response.headers.get('content-type') ?? null };
    }
    return { status: response.status, url: finalUrl, text: await response.text() };
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Trefferseiten
// ---------------------------------------------------------------------------

function parseCount(value) {
  const match = String(value ?? '').match(/(\d[\d.]*)\s+Treffer\b/u);
  return match ? Number.parseInt(match[1].replace(/\./gu, ''), 10) : null;
}

function parseHitLink(anchor, pageUrl) {
  const href = attrs(anchor).href;
  if (!href) return null;
  let url;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return null;
  }
  if (!['www.revosax.sachsen.de', 'revosax.sachsen.de'].includes(url.hostname)) return null;
  const match = url.pathname.match(VORSCHRIFT_PATH);
  if (!match) return null;
  return {
    url: url.toString(),
    lawId: match[1],
    versionSuffix: match[2] ?? null,
    urlKind: match[2] ? 'version' : 'dynamic',
  };
}

function fieldAfter(segment, label) {
  const index = segment.indexOf(label);
  if (index < 0) return null;
  return normalizeWhitespace(segment.slice(index + label.length)) || null;
}

export function classifyDocumentType(documentType) {
  const entry = DOCUMENT_TYPE_CATEGORIES[normalizeWhitespace(documentType)];
  return entry ? { ...entry } : { category: null, normType: null };
}

function parseResultHit(node, pageUrl) {
  const anchor = first(node, (candidate) => candidate.tagName === 'a' && VORSCHRIFT_PATH.test(
    (() => {
      try {
        return new URL(attrs(candidate).href ?? '', pageUrl).pathname;
      } catch {
        return '';
      }
    })(),
  ));
  if (!anchor) throw new RevosaxDiscoveryError('REVOSax-Treffer ohne Vorschriftenlink; Trefferlistenstruktur prüfen');
  const link = parseHitLink(anchor, pageUrl);
  const label = cleanText(anchor);
  const paragraphs = (node.childNodes ?? []).filter((child) => child.tagName === 'p' && !hasClass(child, 'einzug'));
  const info = paragraphs.find((paragraph) => /Vorschriftentyp:/u.test(cleanText(paragraph))) ?? paragraphs.at(-1) ?? null;
  const fsnNode = info ? first(info, (candidate) => candidate.tagName === 'span' && hasClass(candidate, 'fsn-nr')) : null;
  const fsnNumber = fsnNode ? fieldAfter(cleanText(fsnNode), 'Fsn-Nr.:') : null;
  const infoSegments = info ? segments(info, { skip: (candidate) => candidate === fsnNode }) : [];

  let documentType = null;
  let documentDate = null;
  let validFrom = null;
  let validTo = null;
  const descriptive = [];
  for (const segment of infoSegments) {
    if (segment.startsWith('Vorschriftentyp:')) documentType = fieldAfter(segment, 'Vorschriftentyp:');
    else if (segment.startsWith('Erlassdatum:')) documentDate = parseGermanDate(fieldAfter(segment, 'Erlassdatum:'));
    else if (segment.startsWith('Fassung gültig ab:')) validFrom = parseGermanDate(fieldAfter(segment, 'Fassung gültig ab:'));
    else if (segment.startsWith('Fassung gültig bis:')) validTo = parseGermanDate(fieldAfter(segment, 'Fassung gültig bis:'));
    else descriptive.push(segment);
  }
  const [title = null, ...citationParts] = descriptive;
  const classification = classifyDocumentType(documentType ?? '');

  return {
    ...link,
    label,
    title,
    citation: citationParts.length > 0 ? citationParts.join(' ') : null,
    documentType,
    category: classification.category,
    normType: classification.normType,
    fsnNumber,
    documentDate,
    validFrom,
    validTo,
    context: cleanText(node),
  };
}

function parseTypeFacet(document) {
  const quickbar = first(document, (node) => attrs(node).id === 'quickbar') ?? document;
  const box = walk(quickbar, (node) => hasClass(node, 'box')).find((candidate) => {
    const heading = first(candidate, (node) => node.tagName === 'h3');
    return heading && cleanText(heading) === 'Typ';
  });
  if (!box) return null;
  const facet = {};
  for (const button of walk(box, (node) => node.tagName === 'button')) {
    const name = cleanText(first(button, (node) => hasClass(node, 'name')));
    const countText = cleanText(first(button, (node) => hasClass(node, 'txt_right')));
    const count = Number.parseInt(countText.replace(/[^\d]/gu, ''), 10);
    if (name && Number.isFinite(count)) facet[name] = count;
  }
  return facet;
}

function parseEcho(document) {
  const lines = walk(document, (node) => node.tagName === 'div' && hasClass(node, 'line'));
  const echo = { types: [], envelopes: false, validDay: null };
  for (const line of lines) {
    for (const span of walk(line, (node) => node.tagName === 'span' && hasClass(node, 'pright_m'))) {
      const key = cleanText(first(span, (node) => hasClass(node, 'pright_s')));
      const value = cleanText(first(span, (node) => node.tagName === 'strong'));
      if (key === 'Typ:') echo.types = value.split(',').map((entry) => entry.trim()).filter(Boolean);
      else if (key === 'Geltungstag:') echo.validDay = value;
      else if (/Mantelvorschrift/u.test(value)) echo.envelopes = true;
    }
  }
  return echo;
}

export function extractResultPage(html, pageUrl = SEARCH_URL) {
  const document = parse(html);
  const headings = walk(document, (node) => node.tagName === 'h2');
  const countHeading = headings.map(cleanText).find((value) => parseCount(value) !== null);
  const reportedCount = countHeading ? parseCount(countHeading) : null;
  const pager = first(document, (node) => hasClass(node, 'aktuell'));
  const pagerMatch = cleanText(pager).match(/Seite\s+(\d+)\s+von\s+(\d+)/u);
  const hits = walk(document, (node) => hasClass(node, 'result_hit')).map((node) => parseResultHit(node, pageUrl));
  const isResultList = /Trefferliste/u.test(cleanText(first(document, (node) => node.tagName === 'title')))
    || Boolean(first(document, (node) => hasClass(node, 'search_result')));
  if (!isResultList && reportedCount === null) {
    throw new RevosaxDiscoveryError('REVOSax hat keine Trefferliste geliefert; Suche/Session prüfen');
  }
  return {
    reportedCount,
    currentPage: pagerMatch ? Number.parseInt(pagerMatch[1], 10) : (reportedCount === 0 ? 0 : hits.length > 0 ? 1 : null),
    pageCount: pagerMatch ? Number.parseInt(pagerMatch[2], 10) : (reportedCount === 0 ? 0 : hits.length > 0 ? 1 : null),
    hits,
    typeFacet: parseTypeFacet(document),
    echo: parseEcho(document),
  };
}

// ---------------------------------------------------------------------------
// Fassungsmenü einer Vorschriftenseite
// ---------------------------------------------------------------------------

/**
 * Liest das Fassungsmenü einer REVOSax-Vorschriftenseite. Jede Seite – auch die
 * dynamische Stammnorm-URL – markiert die angezeigte konkrete Fassung als
 * `a.law_version_link.linkactive` (z. B. /vorschrift/20247.1); die Liste
 * „Historische Fassungen“ nennt je Fassung den Gültigkeitszeitraum.
 */
export function extractVersionLinks(html, pageUrl = REVOSAX_ORIGIN) {
  const document = parse(html);
  const links = [];
  for (const anchor of walk(document, (node) => node.tagName === 'a' && hasClass(node, 'law_version_link'))) {
    const link = parseHitLink(anchor, pageUrl);
    if (!link || !link.versionSuffix) continue;
    const label = cleanText(anchor);
    const dates = [...label.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/gu)]
      .map((match) => `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
    const active = hasClass(anchor, 'linkactive');
    const existing = links.find((entry) => entry.url === link.url);
    if (existing) {
      existing.active = existing.active || active;
      if (dates.length > 0 && !existing.validFrom) {
        existing.validFrom = dates[0];
        existing.validTo = dates[1] ?? null;
        existing.label = label;
      }
      continue;
    }
    links.push({ ...link, label, validFrom: dates[0] ?? null, validTo: dates[1] ?? null, active });
  }
  return links.sort((left, right) => Number(left.versionSuffix) - Number(right.versionSuffix));
}

export function extractActiveVersion(html, pageUrl = REVOSAX_ORIGIN) {
  return extractVersionLinks(html, pageUrl).find((link) => link.active) ?? null;
}

/**
 * Erkennt Seiten, die keinen eigenen Lesetext besitzen, weil die Vorschrift
 * Bestandteil einer Mantelvorschrift ist („Bestandteil der Vorschrift …“ mit
 * Link auf den Artikel der Mantelvorschrift). Solche Treffer sind keine
 * eigenständigen Textquellen; der Text liegt in der verlinkten Vorschrift.
 */
export function detectEnvelopeComponent(html, pageUrl = REVOSAX_ORIGIN) {
  const document = parse(html);
  const lawShow = first(document, (node) => hasClass(node, 'law_show'));
  if (!lawShow) return null;
  if (first(lawShow, (node) => node.tagName === 'article' && attrs(node).id === 'lesetext')) return null;
  const text = cleanText(lawShow);
  if (!/Bestandteil der Vorschrift/u.test(text)) return null;
  const anchor = walk(lawShow, (node) => node.tagName === 'a').map((node) => ({ node, link: parseHitLink(node, pageUrl) }))
    .find(({ link }) => link);
  if (!anchor) return null;
  let fragment = null;
  try {
    fragment = new URL(attrs(anchor.node).href ?? '', pageUrl).hash.replace(/^#/u, '') || null;
  } catch {
    fragment = null;
  }
  return {
    envelopeLawId: anchor.link.lawId,
    envelopeUrl: anchor.link.url,
    envelopeTitle: cleanText(anchor.node),
    envelopeAnchor: fragment,
  };
}

/** Seiten, für die REVOSax ausdrücklich keinen Text vorhält („Datei nicht im Datenbestand“). */
export function detectMissingText(html) {
  const document = parse(html);
  const lawShow = first(document, (node) => hasClass(node, 'law_show'));
  if (!lawShow) return false;
  if (first(lawShow, (node) => node.tagName === 'article' && attrs(node).id === 'lesetext')) return false;
  return /Datei nicht im Datenbestand/u.test(cleanText(lawShow));
}

/** Anlagenverweise (PDF-Anhänge) innerhalb des Lesetexts. */
export function extractAttachmentLinks(html, pageUrl = REVOSAX_ORIGIN) {
  const document = parse(html);
  const article = first(document, (node) => node.tagName === 'article' && attrs(node).id === 'lesetext') ?? document;
  const links = new Map();
  for (const anchor of walk(article, (node) => node.tagName === 'a')) {
    let url;
    try {
      url = new URL(attrs(anchor).href ?? '', pageUrl);
    } catch {
      continue;
    }
    if (!/^\/attachments\/\d+/u.test(url.pathname)) continue;
    if (!links.has(url.toString())) links.set(url.toString(), { url: url.toString(), label: cleanText(anchor) });
  }
  return [...links.values()];
}

// ---------------------------------------------------------------------------
// Integritätsprüfung und Manifest
// ---------------------------------------------------------------------------

export function verifySearchEcho(echo, { date, categories, includeEnvelopes = true }) {
  const problems = [];
  const expectedTypes = [...categories].sort();
  const actualTypes = [...(echo?.types ?? [])].sort();
  if (JSON.stringify(expectedTypes) !== JSON.stringify(actualTypes)) {
    problems.push(`REVOSax bestätigt Typen ${actualTypes.join(', ') || '(keine)'} statt ${expectedTypes.join(', ')}`);
  }
  if (Boolean(echo?.envelopes) !== includeEnvelopes) {
    problems.push(`Mantelvorschriften-Einstellung wurde nicht wie angefordert (${includeEnvelopes ? 'ein' : 'aus'}) bestätigt`);
  }
  if (echo?.validDay !== germanDate(date)) {
    problems.push(`Geltungstag ${echo?.validDay ?? '(keiner)'} bestätigt statt ${germanDate(date)}`);
  }
  if (problems.length > 0) {
    throw new RevosaxDiscoveryError(`Suchparameter wurden von REVOSax nicht wie angefordert übernommen: ${problems.join('; ')}`);
  }
}

function duplicateOccurrences(pass) {
  return (pass?.duplicateUrls ?? []).reduce((sum, entry) => sum + (entry.occurrences - 1), 0);
}

function sameDuplicates(left, right) {
  return JSON.stringify(left?.duplicateUrls ?? []) === JSON.stringify(right?.duplicateUrls ?? []);
}

/**
 * Prüft die Facettenzahlen der Marginalspalte gegen die Treffer. REVOSax
 * dokumentiert nicht, ob die Facette Zeilen (mit Duplikaten) oder eindeutige
 * Vorschriften zählt; akzeptiert wird nur eine über alle Typen konsistente
 * Lesart.
 */
export function matchTypeFacet(typeFacet, hits, lastPass) {
  const entries = Object.entries(typeFacet ?? {});
  if (entries.length === 0) return { basis: null, problems: [] };
  const duplicateByUrl = new Map((lastPass?.duplicateUrls ?? []).map((entry) => [entry.url, entry.occurrences]));
  const uniqueCounts = {};
  const rowCounts = {};
  for (const hit of hits) {
    const type = hit.documentType;
    uniqueCounts[type] = (uniqueCounts[type] ?? 0) + 1;
    rowCounts[type] = (rowCounts[type] ?? 0) + (duplicateByUrl.get(hit.url) ?? 1);
  }
  const mismatches = (counts) => entries
    .filter(([label, count]) => (counts[label] ?? 0) !== count)
    .map(([label, count]) => `Typfacette „${label}“ meldet ${count}, gefunden wurden ${counts[label] ?? 0}`);
  const uniqueProblems = mismatches(uniqueCounts);
  if (uniqueProblems.length === 0) return { basis: 'unique', problems: [] };
  const rowProblems = mismatches(rowCounts);
  if (rowProblems.length === 0) return { basis: 'rows', problems: [] };
  return { basis: null, problems: uniqueProblems };
}

export function verifyDiscovery({ reportedCount, pageCount, hitsPerPage, pagesVisited, hits, typeFacet, passes = [] }) {
  const problems = [];
  if (reportedCount === null || reportedCount === undefined) problems.push('REVOSax hat keine Trefferzahl gemeldet');
  if (reportedCount === 0 || hits.length === 0) problems.push('REVOSax-Suche lieferte keine Treffer');

  const byUrl = new Map();
  for (const hit of hits) byUrl.set(hit.url, (byUrl.get(hit.url) ?? 0) + 1);
  const repeated = [...byUrl.entries()].filter(([, count]) => count > 1).map(([url]) => url);
  if (repeated.length > 0) {
    problems.push(`Trefferliste enthält ${repeated.length} nicht vereinigte Duplikat-URL(s): ${repeated.slice(0, 5).join(', ')}`);
  }

  const lastPass = passes.at(-1) ?? null;
  const previousPass = passes.at(-2) ?? null;
  if (reportedCount !== null && reportedCount !== undefined && byUrl.size !== reportedCount) {
    const duplicates = duplicateOccurrences(lastPass);
    if (!lastPass || duplicates === 0 || byUrl.size + duplicates !== reportedCount) {
      problems.push(`REVOSax meldet ${reportedCount} Treffer, der Crawler hat aber ${byUrl.size} eindeutige Vorschriftenlinks gefunden`);
    } else if (!previousPass || lastPass.newHits !== 0 || !sameDuplicates(previousPass, lastPass)) {
      problems.push(
        `REVOSax meldet ${reportedCount} Treffer; ${byUrl.size} eindeutige Links und ${duplicates} Duplikatzeile(n) sind erst nach zwei ` +
        'übereinstimmenden vollständigen Durchläufen belastbar',
      );
    }
  }
  if (lastPass && reportedCount && lastPass.rows !== undefined && lastPass.rows !== reportedCount) {
    problems.push(`letzter Durchlauf lieferte ${lastPass.rows} Trefferzeilen statt ${reportedCount}`);
  }

  if (pageCount !== null && pageCount !== undefined && pagesVisited !== pageCount) {
    problems.push(`${pagesVisited} von ${pageCount} Ergebnisseiten abgerufen`);
  }
  if (hitsPerPage > 0 && pageCount && reportedCount && Math.ceil(reportedCount / hitsPerPage) !== pageCount) {
    problems.push(`${reportedCount} Treffer bei ${hitsPerPage} je Seite passen nicht zu ${pageCount} Seiten`);
  }

  const unknownTypes = [...new Set(hits.filter((hit) => !hit.category).map((hit) => hit.documentType ?? '(ohne Vorschriftentyp)'))];
  if (unknownTypes.length > 0) {
    problems.push(`unbekannte Vorschriftentypen in der Trefferliste: ${unknownTypes.join(', ')}`);
  }
  const missingValidity = hits.filter((hit) => !hit.validFrom).length;
  if (missingValidity > 0) problems.push(`${missingValidity} Treffer ohne „Fassung gültig ab“`);

  const facet = matchTypeFacet(typeFacet, hits, lastPass);
  problems.push(...facet.problems);

  if (problems.length > 0) {
    throw new RevosaxDiscoveryError(`Discovery unvollständig oder inkonsistent; Manifest wird nicht geschrieben:\n- ${problems.join('\n- ')}`);
  }
  return { facetBasis: facet.basis, duplicateListings: lastPass?.duplicateUrls ?? [] };
}

export function compareHits(left, right) {
  const lawDifference = Number(left.lawId) - Number(right.lawId);
  if (lawDifference !== 0) return lawDifference;
  const leftVersion = left.versionSuffix === null ? -1 : Number(left.versionSuffix);
  const rightVersion = right.versionSuffix === null ? -1 : Number(right.versionSuffix);
  if (leftVersion !== rightVersion) return leftVersion - rightVersion;
  return left.url.localeCompare(right.url);
}

export function groupVersionsByLawId(hits) {
  const byLawId = new Map();
  for (const hit of hits) {
    const urls = byLawId.get(hit.lawId) ?? [];
    urls.push(hit.url);
    byLawId.set(hit.lawId, urls);
  }
  return Object.fromEntries(
    [...byLawId.entries()]
      .filter(([, urls]) => urls.length > 1)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([lawId, urls]) => [lawId, [...urls].sort()]),
  );
}

export function buildManifest({
  date,
  searchRequest,
  searchUrl,
  hits,
  reportedCount,
  pageCount,
  hitsPerPage,
  typeFacet,
  passes = [],
  duplicateListings = [],
  facetBasis = null,
  discoveredAt = new Date().toISOString(),
}) {
  const multiVersionLawIds = groupVersionsByLawId(hits);
  // Der vollständige Trefferlistentext ist für die Extraktion nützlich, aber im
  // versionierten Manifest redundant (Titel, Fundstelle, Typ und Daten sind Felder).
  const sortedHits = [...hits].sort(compareHits).map(({ context, ...hit }) => (
    multiVersionLawIds[hit.lawId]
      ? { ...hit, alternativeVersionUrls: multiVersionLawIds[hit.lawId].filter((url) => url !== hit.url) }
      : hit
  ));
  const categoryCounts = {};
  for (const category of searchRequest.categories) categoryCounts[category] = 0;
  for (const hit of sortedHits) categoryCounts[hit.category] = (categoryCounts[hit.category] ?? 0) + 1;
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    source: 'REVOSax erweiterte Vorschriftensuche (Geltungstag, alle Stamm- und Änderungstypen, zugleich Mantelvorschriften)',
    sourceUrl: SEARCH_URL,
    searchUrl,
    query: {
      geltungstag: date,
      searchRequest,
      includeTypes: [...searchRequest.categories],
      includeEnvelopes: searchRequest.include_envelopes === '1',
      pagination: 'GET /suche?seite=<n> mit Session-Cookie der Suche',
    },
    discoveredAt,
    reportedCount,
    discoveredCount: sortedHits.length,
    duplicateListings,
    pageCount,
    hitsPerPage,
    pagesVisited: pageCount,
    passes,
    typeCounts: typeFacet ?? {},
    typeCountBasis: facetBasis,
    categoryCounts,
    lawIdCount: new Set(sortedHits.map((hit) => hit.lawId)).size,
    multiVersionLawIds,
    hits: sortedHits,
  };
}

// ---------------------------------------------------------------------------
// Orchestrierung
// ---------------------------------------------------------------------------

export async function discoverBaseline({
  date = DEFAULT_BASELINE_DATE,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  delayMs = 250,
  maxPages = 2000,
  maxPasses = 3,
  log = () => {},
  now = () => new Date(),
} = {}) {
  assertIsoDate(date);
  if (!Number.isInteger(maxPasses) || maxPasses < 1) throw new RevosaxDiscoveryError(`Ungültiger Wert für maxPasses: ${maxPasses}`);
  const jar = new CookieJar();
  const requestOptions = { fetchImpl, jar, sleep, log };

  const formResponse = await requestWithRetry(SEARCH_FORM_URL, requestOptions);
  const form = inspectSearchForm(formResponse.text, { formUrl: formResponse.url });
  const searchRequest = buildSearchRequest(date, form.categories, { includeEnvelopes: true, mode: form.mode });
  const searchUrl = buildSearchUrl(searchRequest);
  log(`Suche: ${searchUrl}`);

  const collected = new Map();
  const passes = [];
  let reportedCount = null;
  let pageCount = null;
  let hitsPerPage = 0;
  let typeFacet = null;

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const firstResponse = await requestWithRetry(searchUrl, requestOptions);
    const firstPage = extractResultPage(firstResponse.text, firstResponse.url);
    verifySearchEcho(firstPage.echo, { date, categories: form.categories, includeEnvelopes: true });
    if (pass === 1) {
      if (!firstPage.reportedCount) {
        throw new RevosaxDiscoveryError(`REVOSax meldet ${firstPage.reportedCount ?? 'keine'} Treffer für ${date}; Abbruch`);
      }
      reportedCount = firstPage.reportedCount;
      pageCount = firstPage.pageCount ?? 1;
      hitsPerPage = firstPage.hits.length;
      typeFacet = firstPage.typeFacet;
      if (pageCount > maxPages) {
        throw new RevosaxDiscoveryError(`${pageCount} Ergebnisseiten überschreiten --max-pages ${maxPages}; Abbruch statt unkontrolliertem Crawl`);
      }
      log(`${reportedCount} Treffer auf ${pageCount} Seiten (${hitsPerPage} je Seite)`);
    } else if (firstPage.reportedCount !== reportedCount || (firstPage.pageCount ?? 1) !== pageCount) {
      throw new RevosaxDiscoveryError(
        `Trefferbestand hat sich zwischen den Durchläufen geändert (Durchlauf ${pass}: ${firstPage.reportedCount} Treffer, ${firstPage.pageCount} Seiten)`,
      );
    }

    const summary = { pass, pagesVisited: 1, rows: 0, newHits: 0, repeatedHits: 0, duplicateUrls: [] };
    const seenInPass = new Map();
    const absorb = (hits) => {
      for (const hit of hits) {
        summary.rows += 1;
        seenInPass.set(hit.url, (seenInPass.get(hit.url) ?? 0) + 1);
        if (collected.has(hit.url)) summary.repeatedHits += 1;
        else {
          collected.set(hit.url, hit);
          summary.newHits += 1;
        }
      }
    };
    absorb(firstPage.hits);
    for (let page = 2; page <= pageCount; page += 1) {
      await sleep(delayMs);
      const response = await requestWithRetry(buildResultPageUrl(page), requestOptions);
      const extracted = extractResultPage(response.text, response.url);
      if (extracted.currentPage !== page) {
        throw new RevosaxDiscoveryError(`Seite ${page} angefordert, REVOSax lieferte ${extracted.currentPage ?? 'keine Seitenangabe'} (Session verloren?)`);
      }
      if (extracted.reportedCount !== reportedCount || extracted.pageCount !== pageCount) {
        throw new RevosaxDiscoveryError(`Trefferbestand hat sich während des Crawls geändert (Seite ${page}: ${extracted.reportedCount} Treffer, ${extracted.pageCount} Seiten)`);
      }
      if (extracted.hits.length === 0) throw new RevosaxDiscoveryError(`Seite ${page} enthält keine Treffer`);
      absorb(extracted.hits);
      summary.pagesVisited = page;
      if (page % 50 === 0 || page === pageCount) log(`Durchlauf ${pass}, Seite ${page}/${pageCount}: ${collected.size} eindeutige Treffer`);
    }
    summary.duplicateUrls = [...seenInPass.entries()]
      .filter(([, occurrences]) => occurrences > 1)
      .map(([url, occurrences]) => ({ url, occurrences }))
      .sort((left, right) => left.url.localeCompare(right.url));
    summary.uniqueTotal = collected.size;
    passes.push(summary);
    log(
      `Durchlauf ${pass}: ${summary.rows} Zeilen, ${summary.newHits} neue Treffer, ${summary.duplicateUrls.length} doppelt gelistete URL(s); ` +
      `${collected.size} von ${reportedCount} eindeutig`,
    );
    if (collected.size >= reportedCount) break;
    const previous = passes.at(-2);
    if (previous && summary.newHits === 0 && sameDuplicates(previous, summary)) {
      log('Duplikate sind über zwei Durchläufe stabil und stammen aus der REVOSax-Trefferliste selbst');
      break;
    }
    if (pass < maxPasses) log('Trefferbestand noch nicht bestätigt; weiterer vollständiger Durchlauf');
  }

  const hits = [...collected.values()];
  let verification;
  try {
    verification = verifyDiscovery({ reportedCount, pageCount, hitsPerPage, pagesVisited: pageCount, hits, typeFacet, passes });
  } catch (error) {
    if (error instanceof RevosaxDiscoveryError) {
      error.details = { date, searchRequest, reportedCount, pageCount, hitsPerPage, passes, typeFacet, hits: [...hits].sort(compareHits) };
    }
    throw error;
  }

  return buildManifest({
    date,
    searchRequest,
    searchUrl,
    hits,
    reportedCount,
    pageCount,
    hitsPerPage,
    typeFacet,
    passes,
    duplicateListings: verification.duplicateListings,
    facetBasis: verification.facetBasis,
    discoveredAt: now().toISOString(),
  });
}
