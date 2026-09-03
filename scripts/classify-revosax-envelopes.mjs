#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

import { parse } from 'parse5';

import { extractEnvelopeComponentPage, requestWithRetry, REVOSAX_ORIGIN } from './lib/revosax-discovery.mjs';
import { parseRevosaxSnapshot } from './lib/revosax-parser.mjs';
import { adaptSaxonText } from './lib/revosax-ost-adapter.mjs';
import { slugBasis, slugify } from './revosax-stage-baseline.mjs';

/**
 * Klassifiziert die als „Bestandteil der Vorschrift“ geführten REVOSax-Treffer
 * (Artikel einer Mantelvorschrift mit eigener lawId) für die Materialisierung.
 *
 *   A  eigenständiger Änderungsakt mit eigenem Rechtsinhalt: der Artikel der
 *      Mantelvorschrift ist eindeutig zuzuordnen → eigene OstRecht-Norm
 *      (aenderungsvorschrift, part-of Mantelvorschrift)
 *   B  technische Alias-Seite: die Mantelvorschrift besteht nur aus diesem einen
 *      Artikel und trägt dasselbe Vollzitat → kein eigener Rechtsinhalt, SKIP
 *   C  Artikel besteht ausschließlich aus Verweisen auf Anlagen (PDF) → Anlagen-
 *      Workflow, SKIP mit Anlagenverweisen
 *   D  unklare Identität (Anker nicht auflösbar, Mantelvorschrift nicht ladbar,
 *      mehrere Kandidaten) → REVIEW
 *
 * Mantelvorschriften, die selbst nicht zum Stichtag gelistet sind, werden einmalig
 * abgerufen (Rohseite in den Cache, für die R2-Archivierung vorgemerkt), damit
 * der Artikeltext aus derselben unveränderten Quelle stammt.
 *
 * Aufruf: node scripts/classify-revosax-envelopes.mjs [--report <Pfad>] [--output <Pfad>] [--offline]
 */

const ROOT = resolve(process.cwd());
const CACHE_ROOT = join(ROOT, '.cache', 'revosax-baseline', '2023-11-01');
const CONTENT_ROOT = join(ROOT, 'content', 'normen');

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeLabel(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

const ROMAN_ANCHOR = /^roem([IVXLC]+)$/u;

function sectionFromAttributes(attributes) {
  const title = normalizeLabel(attributes.title ?? '');
  const match = title.match(/^((?:Artikel|Art\.|§)\s*\d+[a-z]?|[IVXLC]+\.)\s*(.*)$/u);
  return {
    title,
    label: match ? normalizeLabel(match[1]) : null,
    heading: match ? normalizeLabel(match[2]) : title,
    dataAnchor: attributes['data-anchor'] ?? null,
    level: attributes['data-level'] ?? null,
  };
}

/**
 * Abschnittsüberschrift („Artikel 44  Änderung des …“, „III.  …“) des Ankers aus dem
 * Mantel-HTML. REVOSax setzt die Anker je nach Seitenvariante als id="a44" bzw.
 * data-anchor="44" (Artikel) oder id="roemIII" (römisch gegliederte
 * Verwaltungsvorschriften); alle Varianten werden geprüft.
 */
export function findAnchorSection(html, anchor) {
  const document = parse(html);
  const numeric = anchor.match(/^a(\d+)$/u)?.[1] ?? null;
  const roman = anchor.match(ROMAN_ANCHOR)?.[1] ?? null;
  const stack = [document];
  let byDataAnchor = null;
  while (stack.length > 0) {
    const node = stack.pop();
    const attributes = Object.fromEntries((node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]));
    // REVOSax verlinkt römisch gegliederte Abschnitte als #roemII, setzt die id aber als romII.
    const aliases = roman ? [anchor, `rom${roman}`] : [anchor];
    if (aliases.includes(attributes.id) || aliases.includes(attributes['data-link'])) return sectionFromAttributes(attributes);
    if (!byDataAnchor && numeric && attributes['data-anchor'] === numeric && attributes.title) byDataAnchor = sectionFromAttributes(attributes);
    if (!byDataAnchor && roman && attributes.title && new RegExp(`^${roman}\\.\\s`, 'u').test(normalizeLabel(attributes.title))) byDataAnchor = sectionFromAttributes(attributes);
    for (const child of node.childNodes ?? []) stack.push(child);
  }
  return byDataAnchor;
}

function labelKey(value) {
  return normalizeLabel(value).toLocaleLowerCase('de').replace(/^art\.\s*/u, 'artikel ').replace(/\s+/gu, ' ');
}

function walkBlocks(blocks, visit, path = []) {
  blocks.forEach((block, index) => {
    visit(block, [...path, index]);
    if (Array.isArray(block.children)) walkBlocks(block.children, visit, [...path, index]);
  });
}

/**
 * Sucht den Artikelblock der Mantelvorschrift zum Anker in beliebiger Tiefe
 * (Mantelvorschriften sind oft in einen Abschnitt „Staatsvertrag“ o. Ä. gehüllt);
 * genau ein Treffer ist Bedingung.
 */
export function locateArticleBlocks(body, section) {
  if (!section?.label) return { blocks: [], reason: 'Anker ohne Artikelkennzeichen' };
  const wanted = labelKey(section.label);
  const matches = [];
  walkBlocks(body, (block, path) => {
    if (labelKey(block.label) === wanted) matches.push({ block, path });
  });
  if (matches.length === 1) return { blocks: matches, reason: null };
  if (matches.length === 0) return { blocks: [], reason: `kein Block mit Kennzeichen „${section.label}“ im Parse der Mantelvorschrift` };
  return { blocks: matches, reason: `${matches.length} Blöcke mit Kennzeichen „${section.label}“` };
}

function titleKey(value) {
  return normalizeLabel(value).toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const STOPWORDS = new Set(['des', 'der', 'die', 'das', 'den', 'dem', 'für', 'zur', 'zum', 'und', 'über', 'von', 'im', 'in', 'am', 'an', 'auf', 'mit', 'bei', 'nach', 'aus', 'zu', 'ein', 'eine', 'einer', 'eines', 'einem', 'sowie', 'dieses', 'dieser']);

/**
 * Vergleichbare Wortstämme einer Überschrift: Klammerzusätze entfernt, in der
 * Quelle umbrochene Wörter („Steuerberater- versorgung“) zusammengefügt,
 * Flexionsendungen gekappt, Stoppwörter entfernt.
 */
const SYNONYMS = new Map([['vwv', 'verwaltungsvorschrift'], ['vo', 'verordnung'], ['rl', 'richtlinie'], ['frl', 'förderrichtlinie'], ['stv', 'staatsvertrag']]);

export function headingStems(value) {
  const text = String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('de')
    .replace(/\([^)]*\)/gu, ' ')
    .replace(/(\p{L})-\s*(\p{L})/gu, '$1$2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  const stems = new Set();
  for (const raw of text.split(' ')) {
    const word = SYNONYMS.get(raw) ?? raw;
    if (!word || STOPWORDS.has(word)) continue;
    const stem = word.length >= 6 ? word.replace(/(?:es|en|er|em|s|e|n)$/u, '') : word;
    stems.add(stem);
  }
  return stems;
}

/** Anteil gemeinsamer Wortstämme (0–1), bezogen auf die längere Überschrift. */
export function headingSimilarity(left, right) {
  const a = headingStems(left);
  const b = headingStems(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const stem of a) if (b.has(stem)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

export const ANCHOR_MIN_SIMILARITY = 0.6;
export const TITLE_MIN_SIMILARITY = 0.6;
export const TITLE_MIN_MARGIN = 0.2;

/**
 * Block, dessen Überschrift dem eigenen Titel der Komponentenseite entspricht:
 * eindeutig bester Kandidat mit hoher Übereinstimmung und deutlichem Abstand zum
 * zweitbesten; alles andere bleibt unaufgelöst.
 */
export function locateBlocksByTitle(body, title, aliases = []) {
  if (!titleKey(title)) return { blocks: [], reason: 'Komponentenseite ohne Titel' };
  const names = [title, ...aliases].filter((name) => titleKey(name));
  const candidates = [];
  walkBlocks(body, (block, path) => {
    if (!block.title || !block.label) return;
    candidates.push({ block, path, similarity: Math.max(...names.map((name) => headingSimilarity(name, block.title))) });
  });
  candidates.sort((left, right) => right.similarity - left.similarity);
  const [best, second] = candidates;
  if (best && best.similarity >= TITLE_MIN_SIMILARITY && (!second || best.similarity - second.similarity >= TITLE_MIN_MARGIN)) {
    return { blocks: [best], reason: null, similarity: best.similarity };
  }
  if (best && best.similarity >= TITLE_MIN_SIMILARITY) {
    return { blocks: [], reason: `mehrere Artikelüberschriften ähneln „${normalizeLabel(title)}“ (${best.block.label}: ${best.similarity.toFixed(2)}, ${second.block.label}: ${second.similarity.toFixed(2)})` };
  }
  return { blocks: [], reason: `keine Artikelüberschrift entspricht „${normalizeLabel(title)}“ (beste Übereinstimmung ${best ? `${best.block.label}: ${best.similarity.toFixed(2)}` : 'keine'})` };
}

function bodyTextLength(blocks) {
  return (blocks ?? []).reduce((sum, block) => sum + String(block.text ?? '').length + String(block.title ?? '').length + bodyTextLength(block.children), 0);
}

function attachmentOnly(block) {
  const text = JSON.stringify(block);
  return bodyTextLength([block]) < 300 && /attachments\/\d+/u.test(text);
}

async function fetchEnvelope(lawId, { offline, delayMs, state }) {
  const rawPath = join(CACHE_ROOT, 'raw', `envelope-${lawId}.html`);
  const metaPath = join(CACHE_ROOT, 'raw', `envelope-${lawId}.meta.json`);
  try {
    const [bytes, meta] = await Promise.all([readFile(rawPath), readJson(metaPath)]);
    if (sha256(bytes) !== meta.sha256) throw new Error(`Cache ${rawPath} passt nicht zum SHA-256`);
    return { bytes, meta, rawPath };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (offline) throw new Error(`Mantelvorschrift ${lawId} fehlt im Cache (--offline)`);
  if (state.fetched > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  state.fetched += 1;
  const url = `${REVOSAX_ORIGIN}/vorschrift/${lawId}`;
  const response = await requestWithRetry(url, { binary: true, log: (message) => console.error(`  ${message}`) });
  const meta = { requestedUrl: url, url: response.url, retrievedAt: new Date().toISOString(), sha256: sha256(response.bytes), byteLength: response.bytes.length, contentType: response.contentType };
  await mkdir(dirname(rawPath), { recursive: true });
  await writeFile(rawPath, response.bytes);
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  return { bytes: response.bytes, meta, rawPath };
}

export async function classifyEnvelopeComponents(report, { offline = false, delayMs = 400, existingSlugs = new Set(), log = () => {} } = {}) {
  const bySource = new Map(report.entries.map((entry) => [entry.sourceId, entry]));
  const byLawId = new Map();
  for (const entry of report.entries) {
    if (entry.skipReason || !entry.parsedCacheFile) continue;
    const list = byLawId.get(String(entry.revosaxLawId)) ?? [];
    list.push(entry);
    byLawId.set(String(entry.revosaxLawId), list);
  }
  const components = report.entries.filter((entry) => entry.skipReason?.startsWith('part-of-envelope:'));
  const envelopeCache = new Map();
  const extraSources = new Map();
  const state = { fetched: 0 };

  const loadEnvelope = async (lawId) => {
    if (envelopeCache.has(lawId)) return envelopeCache.get(lawId);
    let loaded;
    const staged = (byLawId.get(lawId) ?? []).find((entry) => !entry.versionSuffix) ?? (byLawId.get(lawId) ?? [])[0];
    if (staged) {
      const html = await readFile(join(ROOT, staged.rawCacheFile), 'utf8');
      const parsed = await readJson(join(ROOT, staged.parsedCacheFile));
      loaded = { html, body: parsed.original.body, citation: parsed.original.fullCitation, title: parsed.original.sourceTitle, sourceId: staged.sourceId, entry: staged, materialized: true, objectKey: `revosax/2023-11-01/${staged.sourceId}.html`, sha256: staged.sourceSha256, url: staged.sourceUrl, retrievedAt: staged.retrievedAt, sourceValidFrom: staged.sourceValidFrom, sourceValidTo: staged.sourceValidTo ?? null };
    } else {
      const fetched = await fetchEnvelope(lawId, { offline, delayMs, state });
      const html = fetched.bytes.toString('utf8');
      let parsed = null;
      let parseError = null;
      const finalLawId = fetched.meta.url.match(/\/vorschrift\/(\d+)/u)?.[1] ?? null;
      if (finalLawId && finalLawId !== String(lawId)) {
        // Die Mantelvorschrift leitet auf eine Nachfolgevorschrift weiter; deren Text ist
        // nicht der historische Artikel der Komponente.
        parseError = `Mantelvorschrift ${lawId} leitet auf die Vorschrift ${finalLawId} weiter (${fetched.meta.url})`;
      } else {
        try {
          parsed = parseRevosaxSnapshot(html, { url: fetched.meta.url });
        } catch (error) {
          parseError = error.message;
        }
      }
      loaded = { html, body: parsed?.body ?? [], citation: parsed?.fullCitation ?? null, title: parsed?.sourceTitle ?? null, sourceId: `envelope-${lawId}`, entry: null, materialized: false, parseError, objectKey: `revosax/2023-11-01/envelope-${lawId}.html`, sha256: fetched.meta.sha256, url: fetched.meta.url, retrievedAt: fetched.meta.retrievedAt, sourceValidFrom: parsed?.sourceValidFrom ?? null, sourceValidTo: parsed?.sourceValidTo ?? null, rawCacheFile: fetched.rawPath.replace(`${ROOT}/`, ''), byteLength: fetched.meta.byteLength };
      extraSources.set(lawId, loaded);
    }
    envelopeCache.set(lawId, loaded);
    return loaded;
  };

  const results = [];
  const slugCounts = new Map();
  for (const [index, entry] of components.entries()) {
    const envelopeLawId = String(entry.envelope.envelopeLawId);
    const anchor = entry.envelope.envelopeAnchor;
    const componentHtml = await readFile(join(ROOT, entry.rawCacheFile), 'utf8');
    const page = extractEnvelopeComponentPage(componentHtml) ?? {};
    const record = {
      sourceId: entry.sourceId,
      lawId: String(entry.revosaxLawId),
      category: entry.category,
      normType: entry.inferredType,
      sourceTitle: page.title ?? entry.listing?.title ?? null,
      sourceCitation: page.fullCitation ?? entry.listing?.citation ?? null,
      listing: { label: entry.listing?.label ?? null, title: entry.listing?.title ?? null, citation: entry.listing?.citation ?? null, documentDate: entry.listing?.documentDate ?? null, validFrom: entry.listing?.validFrom ?? null },
      sourceUrl: entry.sourceUrl,
      rawCacheFile: entry.rawCacheFile,
      sourceSha256: entry.sourceSha256,
      byteLength: entry.byteLength,
      retrievedAt: entry.retrievedAt,
      envelopeLawId,
      envelopeUrl: entry.envelope.envelopeUrl,
      envelopeTitle: entry.envelope.envelopeTitle,
      anchor,
      class: 'D',
      reason: null,
    };
    try {
      if (!anchor) throw new Error('Komponentenseite ohne Anker auf die Mantelvorschrift');
      const envelope = await loadEnvelope(envelopeLawId);
      record.envelopeSourceId = envelope.sourceId;
      record.envelopeObjectKey = envelope.objectKey;
      record.envelopeMaterialized = envelope.materialized;
      if (envelope.parseError) throw new Error(`Mantelvorschrift nicht parsebar: ${envelope.parseError}`);
      let section = findAnchorSection(envelope.html, anchor);
      let located = section ? locateArticleBlocks(envelope.body, section) : null;
      record.anchorResolution = section ? 'anchor' : null;
      // Der Anker der Komponentenseite ist nicht verlässlich: manche Mantelvorschriften
      // verlinken alle Bestandteile auf #a1. Ein Anker gilt nur, wenn die Überschrift des
      // angesprungenen Artikels zum eigenen Titel der Komponente passt.
      const componentNames = [record.sourceTitle, entry.listing?.label, entry.listing?.title].filter(Boolean);
      const paragraphAnchor = anchor.match(/^p(\d+[a-z]?)$/u)?.[1] ?? null;
      if (section && !located.reason && paragraphAnchor) {
        // Paragraphenanker (#p21 → „§ 21“) verweisen auf die ändernde Vorschrift innerhalb einer
        // Stammnorm; die Paragraphenüberschrift ist naturgemäß nicht der Komponententitel. Der
        // Anker gilt, wenn das Kennzeichen des Blocks zur Nummer passt.
        const label = normalizeLabel(located.blocks[0].block.label);
        if (!new RegExp(`^§\\s*${paragraphAnchor}\\b`, 'u').test(label)) {
          record.anchorMismatch = { anchorHeading: section.heading, componentTitle: record.sourceTitle, similarity: 0 };
          section = null;
          located = null;
        } else {
          record.anchorResolution = 'paragraph-anchor';
          record.headingUnverified = true;
        }
      } else if (section && !located.reason && record.sourceTitle) {
        const heading = section.heading || located.blocks[0].block.title || '';
        const similarity = Math.max(...componentNames.map((name) => headingSimilarity(name, heading)));
        record.anchorSimilarity = Number(similarity.toFixed(2));
        if (similarity < ANCHOR_MIN_SIMILARITY) {
          record.anchorMismatch = { anchorHeading: section.heading, componentTitle: record.sourceTitle, similarity: record.anchorSimilarity };
          section = null;
          located = null;
        }
      }
      if (!section || located.reason) {
        // Ersatzweise, deterministisch und nur bei genau einem Treffer: Artikelüberschrift
        // der Mantelvorschrift gleich dem eigenen Titel der Komponentenseite, sonst
        // Artikelnummer aus dem Anker (#a2 → „Artikel 2“) bei Seiten ohne Ankermarkup.
        const byTitle = locateBlocksByTitle(envelope.body, record.sourceTitle, componentNames.slice(1));
        // Die Artikelnummer aus dem Anker (#a2 → „Artikel 2“) gilt nur, wenn die Seite
        // das a-Schema gar nicht verwendet (kein Ankermarkup oder abweichende ids wie x2).
        const numeric = anchor.match(/^a(\d+)$/u)?.[1] ?? null;
        const usesAnchorScheme = /\sid="a\d+"/u.test(envelope.html);
        const byNumber = numeric && !usesAnchorScheme
          ? locateArticleBlocks(envelope.body, { label: `Artikel ${numeric}` })
          : { blocks: [], reason: null };
        if (byTitle.blocks.length === 1) {
          located = byTitle;
          section = { label: normalizeLabel(byTitle.blocks[0].block.label), heading: normalizeLabel(byTitle.blocks[0].block.title) };
          record.anchorResolution = 'article-title';
          record.titleSimilarity = Number(byTitle.similarity.toFixed(2));
        } else if (byNumber.blocks.length === 1) {
          located = byNumber;
          section = { label: `Artikel ${numeric}`, heading: normalizeLabel(byNumber.blocks[0].block.title) };
          record.anchorResolution = 'article-number';
        } else if (record.anchorMismatch) {
          throw new Error(`Anker #${anchor} zeigt auf „${record.anchorMismatch.anchorHeading}“, die Komponente heißt „${record.sourceTitle}“; ${byTitle.reason}`);
        } else if (!section) {
          throw new Error(`Anker #${anchor} nicht in der Mantelvorschrift gefunden${byTitle.reason ? `; ${byTitle.reason}` : ''}`);
        } else {
          throw new Error(located.reason);
        }
      }
      record.articleLabel = section.label;
      record.articleHeading = section.heading;
      const { block, path: blockPath } = located.blocks[0];
      record.articleBlockPath = blockPath;
      let articleCount = 0;
      walkBlocks(envelope.body, (candidate) => {
        if (/^(?:Artikel|Art\.)\s*\d+|^[IVXLC]+\.$/u.test(normalizeLabel(candidate.label))) articleCount += 1;
      });
      // Alias-Prüfung über Titel und Erlassdatum der Zitierung (vor der Fundstellenklammer);
      // Seitenangaben unterscheiden sich zwischen Artikel und Mantelvorschrift regelmäßig.
      const citationHead = (value) => normalizeLabel(String(value ?? '').split('(')[0]).toLocaleLowerCase('de');
      const sameCitation = record.sourceCitation && envelope.citation && citationHead(record.sourceCitation) === citationHead(envelope.citation);
      if (attachmentOnly(block)) {
        record.class = 'C';
        record.reason = 'Artikel besteht nur aus Anlagenverweisen (PDF)';
      } else if (articleCount <= 1 && sameCitation) {
        record.class = 'B';
        record.reason = 'Mantelvorschrift besteht nur aus diesem Artikel und trägt dasselbe Vollzitat; Komponentenseite ist ein technischer Alias';
      } else {
        record.class = 'A';
        record.reason = `Artikel ${section.label} der Mantelvorschrift ${envelopeLawId} eindeutig zugeordnet`;
        const adaptedLabel = adaptSaxonText(entry.listing?.label ?? '');
        const adaptedTitle = adaptSaxonText(record.sourceTitle ?? '');
        const base = slugify(slugBasis({ label: adaptedLabel, title: adaptedTitle }));
        const count = (slugCounts.get(base) ?? 0) + 1;
        slugCounts.set(base, count);
        record.proposedSlug = count === 1 && !existingSlugs.has(base) ? base : `${base}-${record.lawId}`;
        record.adaptedTitle = adaptedTitle;
        record.adaptedShortTitle = adaptedLabel || adaptedTitle;
      }
    } catch (error) {
      record.class = 'D';
      record.reason = error.message;
    }
    results.push(record);
    if ((index + 1) % 200 === 0 || index === components.length - 1) log(`[${index + 1}/${components.length}] ${entry.sourceId}: Klasse ${record.class}`);
  }
  // Zwei REVOSax-Vorschriften auf denselben Artikel derselben Mantelvorschrift sind eine
  // Doppelerfassung: nur die niedrigere lawId bleibt eigenständig, die andere ist Alias.
  const byArticle = new Map();
  for (const record of results) {
    if (record.class !== 'A') continue;
    const key = `${record.envelopeSourceId}|${JSON.stringify(record.articleBlockPath)}`;
    const list = byArticle.get(key) ?? [];
    list.push(record);
    byArticle.set(key, list);
  }
  for (const group of byArticle.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((left, right) => Number(left.lawId) - Number(right.lawId));
    for (const record of sorted.slice(1)) {
      record.class = 'B';
      record.reason = `gleicher Artikel ${record.articleLabel} der Mantelvorschrift ${record.envelopeLawId} wie Vorschrift ${sorted[0].lawId} (REVOSax-Doppelerfassung)`;
      delete record.proposedSlug;
    }
  }
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const record of results) counts[record.class] += 1;
  return {
    schemaVersion: 1,
    baselineDate: report.baselineDate,
    generatedAt: new Date().toISOString(),
    componentCount: results.length,
    counts,
    envelopeCount: envelopeCache.size,
    fetchedEnvelopes: [...extraSources.entries()].map(([requestedLawId, envelope]) => ({
      lawId: String(requestedLawId),
      finalLawId: envelope.url.match(/vorschrift\/(\d+)/u)?.[1] ?? null,
      sourceId: envelope.sourceId,
      url: envelope.url,
      rawCacheFile: envelope.rawCacheFile,
      sha256: envelope.sha256,
      byteLength: envelope.byteLength,
      retrievedAt: envelope.retrievedAt,
      objectKey: envelope.objectKey,
      title: envelope.title,
      sourceValidFrom: envelope.sourceValidFrom,
      sourceValidTo: envelope.sourceValidTo,
      parseError: envelope.parseError ?? null,
    })),
    components: results,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const reportPath = resolve(valueAfter(args, '--report') ?? join(CACHE_ROOT, 'report.json'));
  const outputPath = resolve(valueAfter(args, '--output') ?? join(CACHE_ROOT, 'envelope-components.json'));
  const report = await readJson(reportPath);
  const { readdir } = await import('node:fs/promises');
  const existingSlugs = new Set((await readdir(CONTENT_ROOT, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const result = await classifyEnvelopeComponents(report, { offline: args.includes('--offline'), existingSlugs, log: (message) => console.log(message) });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Komponenten: ${result.componentCount} (A=${result.counts.A}, B=${result.counts.B}, C=${result.counts.C}, D=${result.counts.D}); nachgeladene Mantelvorschriften: ${result.fetchedEnvelopes.length}`);
  console.log(`Ergebnis: ${outputPath.replace(`${ROOT}/`, '')}`);
  for (const record of result.components.filter((entry) => entry.class === 'D').slice(0, 20)) console.log(`REVIEW ${record.sourceId}: ${record.reason}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
