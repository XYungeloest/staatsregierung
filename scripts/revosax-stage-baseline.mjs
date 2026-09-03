#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  ALL_CATEGORIES,
  REVOSAX_ORIGIN,
  RevosaxHttpError,
  classifyDocumentType,
  detectEnvelopeComponent,
  detectMissingText,
  extractAttachmentLinks,
  extractVersionLinks,
  requestWithRetry,
} from './lib/revosax-discovery.mjs';
import { RevosaxParseError, parseRevosaxSnapshot } from './lib/revosax-parser.mjs';
import {
  adaptParsedRevosaxSnapshot,
  adaptSaxonText,
  auditAdaptedRevosaxSnapshot,
} from './lib/revosax-ost-adapter.mjs';

/**
 * Staging des REVOSax-Ausgangsbestands: lädt jede im Discovery-Manifest
 * genannte Fassung genau einmal, sichert die unveränderte Rohquelle samt
 * SHA-256 unter .cache/, parst sie mit parseRevosaxSnapshot(), wendet die
 * Sachsen→Ostdeutschland-Anpassung an und schreibt einen maschinenlesbaren
 * Bericht. Jeder Fehler wird klassifiziert (http, parser, adapter, residual,
 * validity, manifest, other); es gibt keine stillen Fallbacks.
 *
 * Fassungslogik: Dynamische Treffer werden über die numerische Stammnorm-URL
 * `/vorschrift/<lawId>` geladen; jede Seite nennt die tatsächlich angezeigte
 * konkrete Fassung (`law_version_link linkactive`). Zeigt eine dynamische Seite
 * nicht die im Treffer genannte Fassung, wird die passende historische Fassung
 * aus dem Fassungsmenü geladen. Liefert REVOSax für eine lawId mehrere
 * Fassungen zum Stichtag, werden sie inhaltlich verglichen: gleiche Fassung
 * (Alias) oder identischer Text werden deterministisch aufgelöst, abweichender
 * Text wird als Reviewfall gemeldet.
 */

const ROOT = resolve(process.cwd());
const VORSCHRIFT_PATH = /^\/vorschrift\/\d+(?:\.\d+)?(?:-[^/]*)?$/u;
const FAILURE_KINDS = ['http', 'parser', 'adapter', 'residual', 'validity', 'manifest', 'other'];
const REPORT_SCHEMA_VERSION = 2;

const USAGE = `Verwendung: node scripts/revosax-stage-baseline.mjs [Optionen]

Optionen:
  --manifest <Pfad>     Discovery-Manifest (Standard: data/recht/revosax-baseline-2023-11-01.json)
  --cache-dir <Pfad>    Staging-Verzeichnis (Standard: .cache/revosax-baseline/<Geltungstag>)
  --limit <n>           nur die ersten n Treffer ab --start-at
  --start-at <n>        Startindex im Manifest (Standard: 0)
  --stratified <n>      n Treffer gleichmäßig über alle Vorschriftentypen verteilt
  --law-id <id>         nur diese REVOSax-lawId (mehrfach möglich)
  --delay-ms <ms>       Pause zwischen Netzabrufen (Standard: 250)
  --refetch             vorhandene Rohquellen im Cache erneut laden
  --offline             keine Netzabrufe; fehlende Rohquellen gelten als Fehler
  --help                Diese Hilfe`;

class StageFailure extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'StageFailure';
    this.kind = FAILURE_KINDS.includes(kind) ? kind : 'other';
  }
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesAfter(args, flag) {
  return args.flatMap((entry, index) => (entry === flag && args[index + 1] ? [args[index + 1]] : []));
}

function integerOption(args, flag, fallback) {
  const raw = valueAfter(args, flag);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${flag} erwartet eine nichtnegative ganze Zahl, erhalten: ${raw}`);
  return value;
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function cutAtWordBoundary(value, maximum = 96) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum);
  return shortened.includes('-') ? shortened.replace(/-[^-]*$/u, '') : shortened;
}

export function slugify(value) {
  return cutAtWordBoundary(String(value ?? '')
    .replace(/[Ää]/gu, (match) => (match === 'Ä' ? 'Ae' : 'ae'))
    .replace(/[Öö]/gu, (match) => (match === 'Ö' ? 'Oe' : 'oe'))
    .replace(/[Üü]/gu, (match) => (match === 'Ü' ? 'Ue' : 'ue'))
    .replace(/ß/gu, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, ''))
    .replace(/-+$/gu, '') || 'revosax-norm';
}

function comparableTitle(value) {
  return String(value ?? '')
    .toLocaleLowerCase('de')
    .replace(/[\u00a0\u202f]/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function relative(path) {
  return path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readIfExists(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

export function selectHits(hits, { lawIds = [], stratified = null, startAt = 0, limit = null } = {}) {
  const indexed = hits.map((hit, index) => ({ hit, index }));
  let selected = lawIds.length > 0 ? indexed.filter(({ hit }) => lawIds.includes(String(hit.lawId))) : indexed;
  if (stratified) {
    const buckets = new Map(ALL_CATEGORIES.map((category) => [category, []]));
    for (const entry of selected) {
      const bucket = buckets.get(entry.hit.category) ?? buckets.set(entry.hit.category, []).get(entry.hit.category);
      bucket.push(entry);
    }
    const picked = [];
    while (picked.length < stratified && [...buckets.values()].some((bucket) => bucket.length > 0)) {
      for (const bucket of buckets.values()) {
        if (picked.length >= stratified) break;
        const next = bucket.shift();
        if (next) picked.push(next);
      }
    }
    return picked.sort((left, right) => left.index - right.index);
  }
  return selected.slice(startAt, limit === null ? undefined : startAt + limit);
}

function sourceIdOf(hit) {
  return `${hit.lawId}${hit.versionSuffix ? `.${hit.versionSuffix}` : ''}`;
}

/** Dynamische Treffer werden über die numerische Stammnorm-URL geladen (ohne Slug). */
function fetchUrlFor(hit) {
  return hit.versionSuffix ? hit.url : `${REVOSAX_ORIGIN}/vorschrift/${hit.lawId}`;
}

function validateHit(hit) {
  if (!hit?.url || !hit.lawId) throw new StageFailure('manifest', 'Treffer ohne URL oder lawId');
  const url = new URL(hit.url);
  if (!['www.revosax.sachsen.de', 'revosax.sachsen.de'].includes(url.hostname) || !VORSCHRIFT_PATH.test(url.pathname)) {
    throw new StageFailure('manifest', `unzulässige REVOSax-URL ${hit.url}`);
  }
  const classification = hit.category && hit.normType
    ? { category: hit.category, normType: hit.normType }
    : classifyDocumentType(hit.documentType ?? '');
  if (!classification.category || !classification.normType) {
    throw new StageFailure('manifest', `Vorschriftentyp „${hit.documentType ?? '?'}“ ist keiner Kategorie zugeordnet`);
  }
  return classification;
}

function validityProblem(hit, original, date) {
  if (!original.sourceValidFrom) return 'Quelle nennt kein „Fassung gültig ab“';
  if (hit.validFrom && hit.validFrom !== original.sourceValidFrom) {
    return `Trefferliste nennt Fassung gültig ab ${hit.validFrom}, die geladene Quelle ${original.sourceValidFrom}`;
  }
  if (date < original.sourceValidFrom || (original.sourceValidTo && date > original.sourceValidTo)) {
    return `Stichtag ${date} liegt nicht im Gültigkeitsintervall ${original.sourceValidFrom} bis ${original.sourceValidTo ?? 'offen'}`;
  }
  return null;
}

function bodyTextLength(blocks) {
  return (blocks ?? []).reduce((sum, block) => sum + String(block.text ?? '').length + String(block.title ?? '').length + bodyTextLength(block.children), 0);
}

function reviewFlags(hit, original, { resolvedTitle = false } = {}) {
  const flags = [];
  if (!resolvedTitle && hit.title && comparableTitle(hit.title) !== comparableTitle(original.sourceTitle)) flags.push('listing-title-mismatch');
  if (!original.documentDate) flags.push('missing-document-date');
  else if (hit.documentDate && hit.documentDate !== original.documentDate) flags.push('document-date-mismatch');
  return flags;
}

async function obtainSource(url, sourceId, options) {
  const { cacheRoot, refetch, offline, delayMs, state } = options;
  const rawPath = resolve(cacheRoot, 'raw', `${sourceId}.html`);
  const metaPath = resolve(cacheRoot, 'raw', `${sourceId}.meta.json`);
  if (!refetch) {
    const [bytes, metaRaw] = await Promise.all([readIfExists(rawPath), readIfExists(metaPath)]);
    if (bytes && metaRaw) {
      const meta = JSON.parse(metaRaw.toString('utf8'));
      if (meta.sha256 !== hash(bytes)) throw new StageFailure('other', `Cache ${relative(rawPath)} passt nicht zum gespeicherten SHA-256`);
      return { bytes, meta, rawPath, fromCache: true };
    }
  }
  if (offline) throw new StageFailure('http', `Rohquelle ${relative(rawPath)} fehlt im Cache (--offline)`);
  if (state.fetched > 0) await sleep(delayMs);
  state.fetched += 1;
  const response = await requestWithRetry(url, { binary: true, log: (message) => console.error(`  ${message}`) });
  const meta = {
    requestedUrl: url,
    url: response.url,
    retrievedAt: new Date().toISOString(),
    sha256: hash(response.bytes),
    byteLength: response.bytes.length,
    contentType: response.contentType,
  };
  await mkdir(dirname(rawPath), { recursive: true });
  await writeFile(rawPath, response.bytes);
  await writeJson(metaPath, meta);
  return { bytes: response.bytes, meta, rawPath, fromCache: false };
}

async function loadVersion(hit, url, sourceId, options, { allowRedirect = false, deferParseError = false } = {}) {
  const source = await obtainSource(url, sourceId, options);
  const rawHtml = source.bytes.toString('utf8');
  const envelope = detectEnvelopeComponent(rawHtml, source.meta.url);
  if (envelope) return { ...source, sourceId, envelope, original: null, versions: [], active: null };
  if (detectMissingText(rawHtml)) return { ...source, sourceId, missingText: true, original: null, versions: [], active: null };
  const versions = extractVersionLinks(rawHtml, source.meta.url);
  const attachments = extractAttachmentLinks(rawHtml, source.meta.url);
  const active = versions.find((version) => version.active) ?? null;
  if (!active) throw new StageFailure('validity', 'konkrete Fassungskennung (law_version_link linkactive) nicht erkannt');
  if (active.lawId !== String(hit.lawId)) {
    if (allowRedirect) return { ...source, sourceId, redirectedTo: active.lawId, original: null, versions: [], active: null };
    throw new StageFailure('validity', `Seite gehört zu lawId ${active.lawId} statt ${hit.lawId} (Weiterleitung auf eine andere Vorschrift?)`);
  }
  let original = null;
  let parseError = null;
  try {
    original = parseRevosaxSnapshot(rawHtml, { url: source.meta.url });
  } catch (error) {
    if (!(error instanceof RevosaxParseError)) throw error;
    parseError = new StageFailure('parser', error.message);
    // Zeigt eine dynamische Seite eine spätere, anders aufgebaute Fassung, entscheidet
    // erst das Fassungsmenü, ob die Stichtagsfassung noch geladen werden kann.
    if (!deferParseError) throw parseError;
  }
  return { ...source, sourceId, original, parseError, versions, attachments, active };
}

async function loadMatchingVersion(hit, options) {
  let requested = await loadVersion(hit, fetchUrlFor(hit), sourceIdOf(hit), options, { allowRedirect: !hit.versionSuffix, deferParseError: !hit.versionSuffix });
  if (requested.envelope || requested.missingText) return { ...requested, resolvedFrom: null };
  let redirectedFrom = null;
  if (requested.redirectedTo) {
    // Die Stammnorm-URL leitet auf eine Nachfolgevorschrift weiter; die erste
    // konkrete Fassung der ursprünglichen lawId trägt deren vollständiges Fassungsmenü.
    redirectedFrom = `${requested.meta.url} → lawId ${requested.redirectedTo}`;
    requested = await loadVersion(hit, `${REVOSAX_ORIGIN}/vorschrift/${hit.lawId}.1`, `${hit.lawId}.1`, options, { deferParseError: true });
  }
  if (hit.versionSuffix && requested.active.versionSuffix !== hit.versionSuffix) {
    throw new StageFailure('validity', `Seite zeigt Fassung ${requested.active.versionSuffix} statt der angeforderten ${hit.versionSuffix}`);
  }
  const activeMatchesListing = !hit.validFrom || requested.active.validFrom === hit.validFrom;
  if (requested.parseError && activeMatchesListing) throw requested.parseError;
  const problem = requested.parseError
    ? `angezeigte Fassung ${requested.active.versionSuffix} (gültig ab ${requested.active.validFrom ?? '?'}) ist nicht die Stichtagsfassung`
    : validityProblem(hit, requested.original, options.date);
  if (!problem) return { ...requested, resolvedFrom: redirectedFrom };
  if (hit.versionSuffix) throw new StageFailure('validity', problem);

  // Dynamische Seite zeigt eine spätere Fassung: passende historische Fassung aus dem Menü laden.
  const candidates = requested.versions.filter((version) =>
    !version.active && version.validFrom && (hit.validFrom ? version.validFrom === hit.validFrom
      : (version.validFrom <= options.date && (!version.validTo || options.date <= version.validTo))));
  if (candidates.length !== 1) {
    throw new StageFailure(
      'validity',
      `${problem}; im Fassungsmenü ${candidates.length === 0 ? 'keine' : `${candidates.length}`} passende historische Fassung(en) ` +
      `(${requested.versions.map((version) => `${version.versionSuffix}: ${version.label}`).join('; ')})`,
    );
  }
  const [candidate] = candidates;
  const fallback = await loadVersion(hit, candidate.url, `${hit.lawId}.${candidate.versionSuffix}`, options);
  if (fallback.active.versionSuffix !== candidate.versionSuffix) {
    throw new StageFailure('validity', `Fassung ${candidate.versionSuffix} angefordert, Seite zeigt ${fallback.active.versionSuffix}`);
  }
  const fallbackProblem = validityProblem(hit, fallback.original, options.date);
  if (fallbackProblem) throw new StageFailure('validity', `historische Fassung ${candidate.versionSuffix}: ${fallbackProblem}`);
  return { ...fallback, resolvedFrom: redirectedFrom ?? requested.meta.url };
}

/** Kurzbezeichnungen, die nur aus einem Kürzel bestehen, ergeben keinen lesbaren Slug. */
export function slugBasis({ label, title }) {
  const words = String(label ?? '').trim().split(/\s+/u).filter(Boolean);
  const readable = words.length >= 2 && String(label).length >= 10;
  return readable ? label : (title || label);
}

function envelopeEntry({ hit, index, loaded, classification, manifestLawIds }) {
  const { envelope, meta, sourceId } = loaded;
  const flags = [];
  if (!manifestLawIds.has(envelope.envelopeLawId)) flags.push('envelope-not-in-manifest');
  console.log(`[${index + 1}] ${sourceId}: Bestandteil der Mantelvorschrift ${envelope.envelopeLawId} (${envelope.envelopeTitle})${flags.length ? ` [review: ${flags.join(', ')}]` : ''}`);
  return {
    index,
    revosaxLawId: String(hit.lawId),
    versionSuffix: hit.versionSuffix ?? null,
    sourceId,
    urlKind: hit.urlKind ?? (hit.versionSuffix ? 'version' : 'dynamic'),
    category: classification.category,
    documentType: hit.documentType ?? null,
    inferredType: classification.normType,
    listing: { url: hit.url, label: hit.label ?? null, title: hit.title ?? null, citation: hit.citation ?? null, fsnNumber: hit.fsnNumber ?? null, documentDate: hit.documentDate ?? null, validFrom: hit.validFrom ?? null, validTo: hit.validTo ?? null, alternativeVersionUrls: hit.alternativeVersionUrls ?? [] },
    requestedUrl: meta.requestedUrl,
    sourceUrl: meta.url,
    canonicalVersionUrl: null,
    versionNumber: null,
    resolvedFrom: null,
    retrievedAt: meta.retrievedAt,
    sourceSha256: meta.sha256,
    byteLength: meta.byteLength,
    envelope,
    sourceTitle: hit.title ?? hit.label ?? null,
    adaptedTitle: adaptSaxonText(hit.title ?? hit.label ?? ''),
    adaptedShortTitle: adaptSaxonText(hit.label ?? ''),
    adaptedAbbr: null,
    proposedSlug: null,
    blockCount: 0,
    reviewFlags: flags,
    skipReason: `part-of-envelope:${envelope.envelopeLawId}`,
    rawCacheFile: relative(loaded.rawPath),
    parsedCacheFile: null,
  };
}

function missingTextEntry({ hit, index, loaded, classification }) {
  const { meta, sourceId } = loaded;
  console.log(`[${index + 1}] ${sourceId}: REVOSax hält keinen Text vor („Datei nicht im Datenbestand“)`);
  return {
    index,
    revosaxLawId: String(hit.lawId),
    versionSuffix: hit.versionSuffix ?? null,
    sourceId,
    urlKind: hit.urlKind ?? (hit.versionSuffix ? 'version' : 'dynamic'),
    category: classification.category,
    documentType: hit.documentType ?? null,
    inferredType: classification.normType,
    listing: { url: hit.url, label: hit.label ?? null, title: hit.title ?? null, citation: hit.citation ?? null, fsnNumber: hit.fsnNumber ?? null, documentDate: hit.documentDate ?? null, validFrom: hit.validFrom ?? null, validTo: hit.validTo ?? null, alternativeVersionUrls: hit.alternativeVersionUrls ?? [] },
    requestedUrl: meta.requestedUrl,
    sourceUrl: meta.url,
    canonicalVersionUrl: null,
    versionNumber: null,
    resolvedFrom: null,
    retrievedAt: meta.retrievedAt,
    sourceSha256: meta.sha256,
    byteLength: meta.byteLength,
    sourceTitle: hit.title ?? hit.label ?? null,
    adaptedTitle: adaptSaxonText(hit.title ?? hit.label ?? ''),
    adaptedShortTitle: adaptSaxonText(hit.label ?? ''),
    adaptedAbbr: null,
    proposedSlug: null,
    blockCount: 0,
    reviewFlags: [],
    skipReason: 'no-text-in-revosax',
    rawCacheFile: relative(loaded.rawPath),
    parsedCacheFile: null,
  };
}

async function stageHit({ hit, index, total }, options) {
  const { cacheRoot, slugCounts, manifestLawIds } = options;
  const classification = validateHit(hit);
  const loaded = await loadMatchingVersion(hit, options);
  if (loaded.envelope) return envelopeEntry({ hit, index, loaded, classification, manifestLawIds });
  if (loaded.missingText) return missingTextEntry({ hit, index, loaded, classification });
  const { original, meta, active, sourceId } = loaded;
  const parsedPath = resolve(cacheRoot, 'parsed', `${sourceId}.json`);

  let adapted;
  let adaptedLabel;
  try {
    adapted = adaptParsedRevosaxSnapshot(original);
    adaptedLabel = adaptSaxonText(hit.label) || adapted.sourceTitle;
    // Auf manchen Seiten ist die H1 nur die Kurzbezeichnung; der vollständige Titel
    // steht dann ausschließlich in der Trefferliste.
    const listingTitle = hit.title && hit.label && original.sourceTitle === hit.label && hit.title !== hit.label
      ? adaptSaxonText(hit.title)
      : null;
    adapted = { ...adapted, shortTitle: adaptedLabel, ...(listingTitle ? { sourceTitle: listingTitle } : {}) };
    loaded.resolvedTitle = Boolean(listingTitle);
  } catch (error) {
    throw new StageFailure('adapter', error.message);
  }
  const residuals = auditAdaptedRevosaxSnapshot(adapted);
  if (residuals.length > 0) {
    throw new StageFailure(
      'residual',
      `nicht angepasste Sachsen-Bezüge in ${residuals.length} Feld(ern): ${residuals.slice(0, 5).map((entry) => `${entry.path} („${entry.value.slice(0, 80)}“)`).join(', ')}`,
    );
  }

  const baseSlug = slugify(slugBasis({ label: adaptedLabel, title: adapted.sourceTitle }));
  const count = (slugCounts.get(baseSlug) ?? 0) + 1;
  slugCounts.set(baseSlug, count);
  const slug = count === 1 ? baseSlug : `${baseSlug}-${hit.lawId}${active.versionSuffix ? `-${active.versionSuffix}` : ''}`;
  const flags = reviewFlags(hit, original, { resolvedTitle: loaded.resolvedTitle });
  if (loaded.resolvedFrom) flags.push('resolved-historical-version');
  if (loaded.attachments.length > 0 && bodyTextLength(adapted.body) < 300) {
    // Der Lesetext besteht praktisch nur aus Verweisen auf PDF-Anhänge; der Normtext liegt in den Anlagen.
    flags.push('attachment-only-content');
  }
  if (original.sourceValidTo && !loaded.versions.some((version) => version.validFrom > original.sourceValidTo)) {
    // Die Fassung endet, ohne dass REVOSax eine Nachfolgefassung kennt: Befristung oder Aufhebung nach dem Stichtag.
    flags.push('source-ended-without-successor');
  }
  const structureNotes = original.structureNotes ?? [];
  for (const kind of ['no-provisions', 'legacy-layout']) {
    if (structureNotes.some((note) => note.kind === kind)) flags.push(kind);
  }

  await writeJson(parsedPath, {
    listing: { ...hit, context: undefined },
    source: { ...meta, canonicalVersionUrl: active.url, versionNumber: active.versionSuffix },
    original,
    adapted,
  });

  console.log(`[${index + 1}/${total}] ${sourceId}${loaded.fromCache ? ' (Cache)' : ''}: ${adaptedLabel}${flags.length ? ` [review: ${flags.join(', ')}]` : ''}`);
  return {
    index,
    revosaxLawId: String(hit.lawId),
    versionSuffix: hit.versionSuffix ?? null,
    sourceId,
    urlKind: hit.urlKind ?? (hit.versionSuffix ? 'version' : 'dynamic'),
    category: classification.category,
    documentType: hit.documentType ?? null,
    inferredType: classification.normType,
    listing: {
      url: hit.url,
      label: hit.label ?? null,
      title: hit.title ?? null,
      citation: hit.citation ?? null,
      fsnNumber: hit.fsnNumber ?? null,
      documentDate: hit.documentDate ?? null,
      validFrom: hit.validFrom ?? null,
      validTo: hit.validTo ?? null,
      alternativeVersionUrls: hit.alternativeVersionUrls ?? [],
    },
    requestedUrl: meta.requestedUrl,
    sourceUrl: meta.url,
    canonicalVersionUrl: active.url,
    versionNumber: active.versionSuffix,
    resolvedFrom: loaded.resolvedFrom,
    retrievedAt: meta.retrievedAt,
    sourceSha256: meta.sha256,
    byteLength: meta.byteLength,
    sourceValidFrom: original.sourceValidFrom,
    sourceValidTo: original.sourceValidTo,
    // Das strukturierte Erlassdatum der Trefferliste ist verlässlicher als die
    // heuristische Datumserkennung im Seitenkopf.
    documentDate: hit.documentDate ?? original.documentDate,
    sourceTitle: original.sourceTitle,
    sourceAbbr: original.abbr ?? null,
    fullCitation: original.fullCitation,
    adaptedTitle: adapted.sourceTitle,
    adaptedShortTitle: adaptedLabel,
    adaptedAbbr: adapted.abbr ?? null,
    proposedSlug: slug,
    blockCount: original.body.length,
    sourceNoteCount: original.sourceNotes?.length ?? 0,
    structureNotes,
    attachments: loaded.attachments,
    adaptedBodyHash: hash(JSON.stringify(adapted.body)),
    reviewFlags: flags,
    skipReason: null,
    rawCacheFile: relative(loaded.rawPath),
    parsedCacheFile: relative(parsedPath),
  };
}

/**
 * Löst mehrere Treffer derselben lawId auf: gleiche konkrete Fassung → Alias;
 * identischer angepasster Text → höchste Fassungsnummer bleibt; abweichender
 * Text → Reviewfall. Nicht gestagte Geschwisterfassungen werden markiert.
 */
export function resolveMultiVersionEntries(entries) {
  const byLawId = new Map();
  for (const entry of entries) {
    const list = byLawId.get(entry.revosaxLawId) ?? [];
    list.push(entry);
    byLawId.set(entry.revosaxLawId, list);
  }
  const resolutions = [];
  for (const entry of entries) {
    const siblings = byLawId.get(entry.revosaxLawId) ?? [];
    const stagedUrls = new Set(siblings.map((sibling) => sibling.listing.url));
    if ((entry.listing.alternativeVersionUrls ?? []).some((url) => !stagedUrls.has(url))) {
      if (!entry.reviewFlags.includes('multi-version-sibling-not-staged')) entry.reviewFlags.push('multi-version-sibling-not-staged');
    }
  }
  for (const [lawId, group] of byLawId) {
    if (group.length < 2 || group.some((entry) => !entry.canonicalVersionUrl)) continue;
    const byVersion = new Map();
    for (const entry of group) {
      const list = byVersion.get(entry.canonicalVersionUrl) ?? [];
      list.push(entry);
      byVersion.set(entry.canonicalVersionUrl, list);
    }
    const representatives = [];
    for (const [, aliases] of byVersion) {
      const sorted = [...aliases].sort((left, right) => (left.versionSuffix ? 0 : 1) - (right.versionSuffix ? 0 : 1) || left.sourceId.localeCompare(right.sourceId));
      const [kept, ...others] = sorted;
      for (const alias of others) {
        alias.skipReason = `same-version-alias:${kept.sourceId}`;
        resolutions.push({ lawId, resolution: 'same-version-alias', kept: kept.sourceId, skipped: alias.sourceId });
      }
      representatives.push(kept);
    }
    if (representatives.length < 2) continue;
    const texts = new Set(representatives.map((entry) => `${entry.adaptedBodyHash}|${entry.adaptedTitle}|${entry.adaptedAbbr ?? ''}`));
    if (texts.size === 1) {
      const sorted = [...representatives].sort((left, right) => Number(right.versionNumber) - Number(left.versionNumber));
      const [kept, ...others] = sorted;
      for (const other of others) {
        other.skipReason = `identical-text-superseded-by:${kept.sourceId}`;
        resolutions.push({ lawId, resolution: 'identical-text', kept: kept.sourceId, skipped: other.sourceId });
      }
      if (!kept.reviewFlags.includes('multi-version-identical-text')) kept.reviewFlags.push('multi-version-identical-text');
    } else {
      for (const entry of representatives) {
        if (!entry.reviewFlags.includes('multi-version-text-differs')) entry.reviewFlags.push('multi-version-text-differs');
      }
      resolutions.push({ lawId, resolution: 'review', kept: null, candidates: representatives.map((entry) => entry.sourceId) });
    }
  }
  return resolutions;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const manifestPath = resolve(valueAfter(args, '--manifest') ?? 'data/recht/revosax-baseline-2023-11-01.json');
  const manifest = await readJson(manifestPath);
  if ((manifest.schemaVersion ?? 0) < 2) {
    throw new Error(`${relative(manifestPath)}: Manifest-Schema ${manifest.schemaVersion ?? '?'} ist veraltet; Discovery erneut ausführen`);
  }
  const date = manifest.query?.geltungstag;
  if (!date) throw new Error(`${relative(manifestPath)}: query.geltungstag fehlt`);
  if (!Array.isArray(manifest.hits) || manifest.hits.length === 0) throw new Error(`${relative(manifestPath)}: keine Treffer`);

  const cacheRoot = resolve(valueAfter(args, '--cache-dir') ?? `.cache/revosax-baseline/${date}`);
  const selection = {
    lawIds: valuesAfter(args, '--law-id'),
    stratified: integerOption(args, '--stratified', null),
    startAt: integerOption(args, '--start-at', 0),
    limit: integerOption(args, '--limit', null),
  };
  const selected = selectHits(manifest.hits, selection);
  if (selected.length === 0) throw new Error('Auswahl enthält keine Treffer');
  const options = {
    date,
    cacheRoot,
    delayMs: integerOption(args, '--delay-ms', 250),
    refetch: args.includes('--refetch'),
    offline: args.includes('--offline'),
    slugCounts: new Map(),
    manifestLawIds: new Set(manifest.hits.map((hit) => String(hit.lawId))),
    state: { fetched: 0 },
  };

  await mkdir(cacheRoot, { recursive: true });
  const entries = [];
  const failures = [];
  for (const { hit, index } of selected) {
    try {
      entries.push(await stageHit({ hit, index, total: manifest.hits.length }, options));
    } catch (error) {
      const kind = error instanceof StageFailure
        ? error.kind
        : error instanceof RevosaxHttpError
          ? 'http'
          : error instanceof RevosaxParseError
            ? 'parser'
            : 'other';
      failures.push({
        index,
        revosaxLawId: String(hit.lawId),
        versionSuffix: hit.versionSuffix ?? null,
        sourceId: sourceIdOf(hit),
        category: hit.category ?? null,
        url: hit.url,
        label: hit.label ?? null,
        kind,
        error: error.message,
      });
      console.error(`[${index + 1}/${manifest.hits.length}] FEHLER (${kind}) ${hit.url}: ${error.message}`);
    }
  }

  const multiVersionResolutions = resolveMultiVersionEntries(entries);
  const failureCounts = Object.fromEntries(FAILURE_KINDS.map((kind) => [kind, failures.filter((failure) => failure.kind === kind).length]));
  const categoryCounts = Object.fromEntries(ALL_CATEGORIES.map((category) => [category, entries.filter((entry) => entry.category === category).length]));
  const reviewEntries = entries.filter((entry) => entry.reviewFlags.length > 0);
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    baselineDate: date,
    sourceManifest: relative(manifestPath),
    manifestDiscoveredAt: manifest.discoveredAt ?? null,
    manifestHitCount: manifest.hits.length,
    generatedAt: new Date().toISOString(),
    selection: { ...selection, processed: selected.length },
    total: selected.length,
    successful: entries.length,
    failed: failures.length,
    failureCounts,
    parserErrors: failureCounts.parser,
    adapterErrors: failureCounts.adapter,
    residualErrors: failureCounts.residual,
    validityErrors: failureCounts.validity,
    httpErrors: failureCounts.http,
    reviewCases: reviewEntries.length,
    reviewFlagCounts: reviewEntries.flatMap((entry) => entry.reviewFlags).reduce((counts, flag) => ({ ...counts, [flag]: (counts[flag] ?? 0) + 1 }), {}),
    skipped: entries.filter((entry) => entry.skipReason).length,
    envelopeComponents: entries.filter((entry) => entry.envelope).length,
    missingTextEntries: entries.filter((entry) => entry.skipReason === 'no-text-in-revosax').length,
    entriesWithAttachments: entries.filter((entry) => entry.attachments?.length).length,
    structureNoteCounts: entries.flatMap((entry) => entry.structureNotes ?? []).reduce((counts, note) => ({ ...counts, [note.kind]: (counts[note.kind] ?? 0) + 1 }), {}),
    genericSectionTitles: [...new Set(entries.flatMap((entry) => (entry.structureNotes ?? []).filter((note) => note.kind === 'generic-section').map((note) => note.title)))].sort().slice(0, 200),
    multiVersionResolutions,
    categoryCounts,
    fetched: options.state.fetched,
    entries,
    failures,
  };
  const reportPath = resolve(cacheRoot, 'report.json');
  await writeJson(reportPath, report);
  console.log(
    `${entries.length} erfolgreich, ${failures.length} fehlgeschlagen (${FAILURE_KINDS.map((kind) => `${kind}=${failureCounts[kind]}`).join(', ')}), ` +
    `${reviewEntries.length} Reviewfälle, ${report.skipped} übersprungene Mehrfachfassungen. Bericht: ${relative(reportPath)}`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
