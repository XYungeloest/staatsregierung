#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { extractVersionLinks } from './lib/revosax-discovery.mjs';

/**
 * Erzeugt den versionierten Import-Audit des REVOSax-Ausgangsbestands unter
 * data/recht/revosax-import-audit/ deterministisch aus den Stagingartefakten
 * (.cache/revosax-baseline/<Stichtag>/report.json, materialization-plan.json,
 * envelope-components.json, materialization-report.json), den Entscheidungen
 * (data/recht/revosax-baseline-decisions.json) und den R2-Manifesten. Wird der
 * Cache gelöscht, behalten die offenen redaktionellen Aufgaben damit ihre Identität
 * (lawId, sourceId, URL, Titel, Slug, Grund).
 *
 * Dateien:
 *   summary.json        Discovery-Zähler, Vollständigkeitsbilanz, Materialisierung, R2
 *   skips.json          alle SKIP-Fälle nach Grund (Mantelbestandteile, Aliasse, Doppelerfassungen …)
 *   envelopes.json      Klassifizierung der Mantelbestandteile (A/B/C/D) je Komponente
 *   review-flags.json   Prüfmarken je Fassung (Anlagen, PDF-only, fehlendes Erlassdatum,
 *                       Quelle endet ohne Nachfolger mit Typ-A/B-Einordnung, Titelabweichungen …)
 *
 * Aufruf: node scripts/build-revosax-import-audit.mjs [--cache <Verzeichnis>] [--check]
 */

const ROOT = resolve(process.cwd());
const OUTPUT_DIR = join(ROOT, 'data', 'recht', 'revosax-import-audit');

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonIfExists(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function compactEntry(entry, plan) {
  return {
    lawId: String(entry.revosaxLawId),
    sourceId: entry.sourceId,
    versionSuffix: entry.versionSuffix ?? null,
    category: entry.category ?? null,
    normType: entry.inferredType ?? null,
    title: entry.adaptedTitle || entry.sourceTitle || entry.listing?.title || null,
    shortTitle: entry.adaptedShortTitle || entry.listing?.label || null,
    sourceUrl: entry.sourceUrl,
    canonicalVersionUrl: entry.canonicalVersionUrl ?? null,
    slug: plan?.canonicalSlug ?? entry.proposedSlug ?? null,
    action: plan?.action ?? null,
  };
}

const DATE_SOURCE = String.raw`(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})`;
const MONTHS = { Januar: 1, Februar: 2, März: 3, April: 4, Mai: 5, Juni: 6, Juli: 7, August: 8, September: 9, Oktober: 10, November: 11, Dezember: 12 };

function isoDate(day, month, year) {
  return `${year}-${String(MONTHS[month]).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function bodyText(blocks, out = []) {
  for (const block of blocks ?? []) {
    for (const field of ['label', 'title', 'text']) if (block[field]) out.push(block[field]);
    if (block.children) bodyText(block.children, out);
  }
  return out;
}

/**
 * Befristung im übernommenen Text: „tritt am 31. Dezember 2025 außer Kraft“ bzw.
 * „… außer Kraft“ mit ausgeschriebenem Datum im selben Satz. Liefert die Daten.
 */
export function sunsetDatesFromBody(body) {
  const dates = new Set();
  const pattern = new RegExp(String.raw`(?:tritt|treten)[^.]{0,120}?(?:mit\s+Ablauf\s+des\s+|am\s+|zum\s+)${DATE_SOURCE}[^.]{0,60}?außer\s+Kraft|außer\s+Kraft[^.]{0,80}?${DATE_SOURCE}`, 'gu');
  for (const text of bodyText(body)) {
    for (const match of text.matchAll(pattern)) {
      const [day, month, year] = match[1] ? [match[1], match[2], match[3]] : [match[4], match[5], match[6]];
      if (day && month && year) dates.add(isoDate(day, month, year));
    }
  }
  return [...dates].sort();
}

function nextDay(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

/**
 * Einordnung einer zum Stichtag geltenden Fassung, deren REVOSax-Gültigkeit endet:
 *   A  spätere sächsische Rechtsänderung (Nachfolgefassung im Fassungsmenü) – für
 *      Ostdeutschland ohne Wirkung
 *   B  im übernommenen Text angelegte Befristung, die mit dem Gültigkeitsende
 *      übereinstimmt – möglicherweise auch ostdeutsch wirksam (Review)
 *   unclear  weder Nachfolgefassung noch erkennbare Befristung (Review)
 */
export function classifySourceEnding({ sourceValidTo, laterVersions, sunsetDates, baselineDate = '2023-11-01' }) {
  if (!sourceValidTo) return { type: null, basis: null };
  const matching = sunsetDates.filter((date) => date === sourceValidTo || date === nextDay(sourceValidTo));
  if (matching.length > 0) return { type: 'B', basis: `Befristung im übernommenen Text auf ${matching[0]}` };
  if (laterVersions.length > 0) return { type: 'A', basis: `Nachfolgefassung ab ${laterVersions[0]}` };
  if (sunsetDates.length > 0) {
    return { type: 'unclear', basis: `Befristungsdaten im Text (${sunsetDates.join(', ')}) passen nicht zum Gültigkeitsende ${sourceValidTo}` };
  }
  if (sourceValidTo > baselineDate) {
    // Die Fassung galt am Stichtag und endet später ohne Befristung im eigenen Text: eine
    // spätere sächsische Aufhebung oder Änderung, die für Ostdeutschland ohne Wirkung ist.
    return { type: 'A', basis: `Gültigkeitsende ${sourceValidTo} nach dem Stichtag ohne Befristung im Text (spätere sächsische Rechtsänderung)` };
  }
  return { type: 'unclear', basis: 'weder Nachfolgefassung noch Befristung im Text erkennbar' };
}

/** MATCH-Einträge, deren Norm nicht aus dieser Baseline stammt (redaktionell vorhandene Normen). */
async function countPreexistingMatches(plan, contentRoot) {
  let count = 0;
  for (const entry of plan.entries.filter((candidate) => candidate.action === 'MATCH' && candidate.canonicalSlug)) {
    try {
      const { readdir } = await import('node:fs/promises');
      const versionFiles = (await readdir(join(contentRoot, entry.canonicalSlug, 'versions'))).filter((file) => file.endsWith('.json'));
      const meta = await readJson(join(contentRoot, entry.canonicalSlug, 'meta.json'));
      const baselineOnly = versionFiles.length === 1 && versionFiles[0] === `${plan.baselineDate}.json`
        && (meta.sourceReferences ?? []).some((reference) => reference.availability === 'r2-archived');
      if (!baselineOnly) count += 1;
    } catch {
      count += 1;
    }
  }
  return count;
}

export async function buildImportAudit({ cacheDir, manifest, report, plan, envelopes, decisions, sunsetDecisions = null, r2Manifest, attachmentsManifest, materializationReport, residualBacklog, contentRoot = join(ROOT, 'content', 'normen'), preexistingMatches = null }) {
  const planBySource = new Map(plan.entries.map((entry) => [entry.sourceId, entry]));
  const existingMatched = preexistingMatches ?? await countPreexistingMatches(plan, contentRoot);
  const envelopeBySource = new Map((envelopes?.components ?? []).map((component) => [component.sourceId, component]));

  // --- SKIP-Fälle ---
  const skipGroups = {};
  for (const planned of plan.entries.filter((entry) => entry.action === 'SKIP')) {
    const entry = report.entries.find((candidate) => candidate.sourceId === planned.sourceId);
    const reason = planned.reason ?? '';
    const category = reason.startsWith('envelope-alias-of')
      ? 'envelope-alias'
      : reason.startsWith('envelope-attachment-only')
        ? 'envelope-attachment-only'
        : reason.includes('same-version-alias')
          ? 'same-version-alias'
          : reason.includes('identical-text-superseded-by')
            ? 'identical-text-alias'
            : reason.includes('no-text-in-revosax')
              ? 'no-text-in-revosax'
              : reason.includes('Doppelerfassung')
                ? 'duplicate-source'
                : reason.startsWith('Entscheidung:')
                  ? 'manual-decision'
                  : reason.startsWith('Staging: part-of-envelope')
                    ? 'part-of-envelope-unclassified'
                    : 'other';
    const list = skipGroups[category] ?? [];
    list.push({ ...compactEntry(entry, planned), reason, ...(entry.envelope ? { envelopeLawId: String(entry.envelope.envelopeLawId), envelopeUrl: entry.envelope.envelopeUrl } : {}) });
    skipGroups[category] = list;
  }
  const skips = {
    schemaVersion: 1,
    baselineDate: report.baselineDate,
    total: plan.counts.SKIP,
    byCategory: Object.fromEntries(Object.entries(skipGroups).map(([category, list]) => [category, list.length])),
    entries: skipGroups,
  };

  // --- Mantelbestandteile ---
  const envelopeEntries = (envelopes?.components ?? []).map((component) => {
    const planned = planBySource.get(component.sourceId);
    return {
      lawId: component.lawId,
      sourceId: component.sourceId,
      category: component.category,
      normType: component.normType,
      title: component.adaptedTitle ?? component.sourceTitle,
      sourceTitle: component.sourceTitle,
      sourceCitation: component.sourceCitation,
      sourceUrl: component.sourceUrl,
      envelopeLawId: component.envelopeLawId,
      envelopeUrl: component.envelopeUrl,
      envelopeMaterialized: component.envelopeMaterialized ?? null,
      anchor: component.anchor,
      articleLabel: component.articleLabel ?? null,
      articleBlockPath: component.articleBlockPath ?? null,
      anchorResolution: component.anchorResolution ?? null,
      // Zweite Stufe (data/recht/revosax-envelope-decisions.json): Entscheidung, historische
      // Mantelfassung, textführende Vorschrift und ursprüngliche Mantelvorschrift.
      ...(component.decision ? { decision: component.decision } : {}),
      ...(component.envelopeVersion ? { envelopeVersion: component.envelopeVersion } : {}),
      ...(component.envelopeParentLawId ? { envelopeParentLawId: component.envelopeParentLawId } : {}),
      ...(component.heuristicReason ? { heuristicReason: component.heuristicReason } : {}),
      class: component.class,
      reason: component.reason,
      slug: planned?.canonicalSlug ?? component.proposedSlug ?? null,
      action: planned?.action ?? null,
      ...(planned?.deferred ? { deferred: true } : {}),
      ...(planned?.containedIn ? { containedIn: planned.containedIn } : {}),
    };
  });
  const envelopeAudit = {
    schemaVersion: 1,
    baselineDate: report.baselineDate,
    componentCount: envelopeEntries.length,
    classes: envelopes?.counts ?? null,
    byAction: envelopeEntries.reduce((acc, entry) => ({ ...acc, [entry.action ?? 'none']: (acc[entry.action ?? 'none'] ?? 0) + 1 }), {}),
    fetchedEnvelopes: (envelopes?.fetchedEnvelopes ?? []).map((source) => ({ lawId: source.lawId, sourceId: source.sourceId, url: source.url, title: source.title, objectKey: source.objectKey, sha256: source.sha256 })),
    components: envelopeEntries,
  };

  // --- Prüfmarken ---
  const flagged = report.entries.filter((entry) => !entry.skipReason && (entry.reviewFlags?.length || entry.attachments?.length));
  const attachmentsByLaw = new Map();
  for (const record of Object.values(attachmentsManifest?.attachments ?? {})) {
    const list = attachmentsByLaw.get(record.sourceId) ?? [];
    list.push(record);
    attachmentsByLaw.set(record.sourceId, list);
  }
  const flagEntries = [];
  const flagCounts = {};
  for (const entry of flagged) {
    const planned = planBySource.get(entry.sourceId);
    const base = compactEntry(entry, planned);
    const flags = [...(entry.reviewFlags ?? [])];
    const details = {};
    if (entry.attachments?.length) {
      flags.push('attachments');
      const archived = attachmentsByLaw.get(entry.sourceId) ?? [];
      details.attachments = entry.attachments.map((attachment) => {
        const record = archived.find((candidate) => candidate.url === attachment.url);
        return { url: attachment.url, label: attachment.label ?? null, objectKey: record?.objectKey ?? null, verified: record?.verified ?? false, fileName: record?.fileName ?? null };
      });
    }
    if (flags.includes('missing-document-date')) {
      details.documentDate = entry.listing?.documentDate ? { value: entry.listing.documentDate, source: 'listing' } : { value: null, source: null };
    }
    if (flags.includes('document-date-mismatch')) {
      details.documentDateMismatch = { page: entry.documentDate ?? null, listing: entry.listing?.documentDate ?? null };
    }
    if (flags.includes('source-ended-without-successor')) {
      let laterVersions = [];
      let sunsetDates = [];
      try {
        const html = await readFile(resolve(ROOT, entry.rawCacheFile), 'utf8');
        laterVersions = extractVersionLinks(html, entry.sourceUrl).map((version) => version.validFrom).filter((date) => date && date > entry.sourceValidTo).sort();
        const parsed = await readJson(resolve(ROOT, entry.parsedCacheFile));
        sunsetDates = sunsetDatesFromBody(parsed.original.body);
      } catch {
        // ohne Cache bleibt die Einordnung leer
      }
      details.sourceEnding = { sourceValidFrom: entry.sourceValidFrom, sourceValidTo: entry.sourceValidTo, laterVersions, sunsetDates, ...classifySourceEnding({ sourceValidTo: entry.sourceValidTo, laterVersions, sunsetDates }) };
      // Dokumentierte Entscheidung (data/recht/revosax-sunset-decisions.json): Befristung im
      // übernommenen Text gilt in Ostdeutschland fort (Typ B) bzw. ein unklarer Fall bleibt
      // begründet offen; der Materialisierer modelliert die Entscheidung (expiryDate, validTo, Status).
      const sunset = sunsetDecisions?.decisions?.[entry.sourceId] ?? null;
      if (sunset) details.sunsetDecision = { resolution: sunset.resolution, expiryDate: sunset.expiryDate ?? null, status: sunset.status ?? null, basis: sunset.basis ?? null, reason: sunset.reason };
    }
    if (flags.includes('listing-title-mismatch')) details.listingTitle = { listing: entry.listing?.title ?? null, source: entry.sourceTitle ?? null };
    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
    flagEntries.push({ ...base, flags, ...details });
  }
  const sourceEndingTypes = flagEntries.filter((entry) => entry.sourceEnding).reduce((acc, entry) => ({ ...acc, [entry.sourceEnding.type]: (acc[entry.sourceEnding.type] ?? 0) + 1 }), {});
  const sourceEndingResolutions = flagEntries.filter((entry) => entry.sourceEnding && entry.sourceEnding.type !== 'A').reduce((acc, entry) => {
    const key = entry.sunsetDecision?.resolution ?? 'undecided';
    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});
  const reviewFlags = {
    schemaVersion: 1,
    baselineDate: report.baselineDate,
    flagCounts,
    sourceEndingTypes,
    sourceEndingResolutions,
    documentDateFromListing: flagEntries.filter((entry) => entry.documentDate?.source === 'listing').length,
    documentDateMissing: flagEntries.filter((entry) => entry.documentDate && !entry.documentDate.value).length,
    entries: flagEntries.sort((left, right) => Number(left.lawId) - Number(right.lawId) || left.sourceId.localeCompare(right.sourceId)),
  };

  // --- Bilanz ---
  const actions = plan.counts;
  const skipTotal = actions.SKIP;
  const attachmentsAll = Object.values(attachmentsManifest?.attachments ?? {});
  const summary = {
    schemaVersion: 1,
    baselineDate: report.baselineDate,
    generatedFrom: { report: report.generatedAt, plan: plan.generatedAt, envelopes: envelopes?.generatedAt ?? null },
    discovery: {
      reportedRows: manifest.reportedCount ?? null,
      uniqueHits: manifest.hits.length,
      duplicateListings: manifest.duplicateListings ?? null,
      passes: manifest.passes ?? null,
      manifestDiscoveredAt: manifest.discoveredAt ?? null,
    },
    staging: { total: report.total, successful: report.successful, failed: report.failed, reviewCases: report.reviewCases, failureCounts: report.failureCounts },
    plan: { ...actions, writable: plan.writable },
    balance: {
      uniqueHits: manifest.hits.length,
      materializedOwnNorms: actions.CREATE + actions.MATCH - existingMatched,
      existingMatched,
      protectedExisting: actions.PROTECT,
      review: actions.REVIEW,
      reviewDeferred: actions.DEFERRED ?? 0,
      skipped: skipTotal,
      skippedByCategory: skips.byCategory,
      sums: actions.CREATE + actions.MATCH + actions.PROTECT + actions.REVIEW + skipTotal,
    },
    envelopes: { componentCount: envelopeAudit.componentCount, classes: envelopeAudit.classes, byAction: envelopeAudit.byAction, fetchedEnvelopes: envelopeAudit.fetchedEnvelopes.length },
    attachments: {
      referenced: [...new Set(report.entries.flatMap((entry) => (entry.attachments ?? []).map((attachment) => attachment.url)))].length,
      archived: attachmentsAll.length,
      verified: attachmentsAll.filter((record) => record.verified).length,
      byKind: attachmentsAll.reduce((acc, record) => ({ ...acc, [record.kind]: (acc[record.kind] ?? 0) + 1 }), {}),
    },
    r2: { htmlObjects: Object.keys(r2Manifest?.objects ?? {}).length, htmlVerified: Object.values(r2Manifest?.objects ?? {}).filter((record) => record.verified).length },
    reviewFlags: { counts: flagCounts, sourceEndingTypes, sourceEndingResolutions, documentDateFromListing: reviewFlags.documentDateFromListing, documentDateMissing: reviewFlags.documentDateMissing },
    decisions: Object.fromEntries(Object.entries(decisions?.decisions ?? {}).map(([key, decision]) => [key, { action: decision.action, reason: decision.reason }])),
    sunsetDecisions: Object.fromEntries(Object.entries(sunsetDecisions?.decisions ?? {}).map(([key, decision]) => [key, { slug: decision.slug, resolution: decision.resolution, expiryDate: decision.expiryDate ?? null, status: decision.status ?? null }])),
    // Metadaten der übernommenen Normen, die nicht aus der amtlichen Quelle stammen, sondern
    // automatisch abgeleitet sind (scripts/lib/revosax-metadata.mjs): Sachgebiete aus Typ,
    // Ressortkürzel und Titel, Schlagwörter aus Abkürzung/Kurzbezeichnung/Titel, Kurzfassung
    // aus Typ und Kurzbezeichnung. Sie sind Erschließungshilfen, keine amtlichen Angaben.
    derivedMetadata: {
      norms: actions.CREATE + actions.MATCH - existingMatched,
      fields: ['subjects', 'keywords', 'summary'],
      source: 'automatisch abgeleitet (scripts/lib/revosax-metadata.mjs: inferSubjects, inferKeywords, inferSummary); Erlassorgan der Quelle als originEnactingBody (Provenienz)',
    },
    residualBacklog: residualBacklog ? { norms: residualBacklog.normCount, residuals: residualBacklog.residualCount } : null,
  };
  return { summary, skips, envelopes: envelopeAudit, reviewFlags };
}

async function main() {
  const args = process.argv.slice(2);
  const cacheDir = resolve(valueAfter(args, '--cache') ?? '.cache/revosax-baseline/2023-11-01');
  const check = args.includes('--check');
  const [manifest, report, plan, envelopes, decisions, r2Manifest, attachmentsManifest, materializationReport, residualBacklog, sunsetDecisions] = await Promise.all([
    readJson(join(ROOT, 'data', 'recht', 'revosax-baseline-2023-11-01.json')),
    readJson(join(cacheDir, 'report.json')),
    readJson(join(cacheDir, 'materialization-plan.json')),
    readJsonIfExists(join(cacheDir, 'envelope-components.json')),
    readJsonIfExists(join(ROOT, 'data', 'recht', 'revosax-baseline-decisions.json')),
    readJsonIfExists(join(ROOT, 'data', 'recht', 'revosax-r2-manifest.json')),
    readJsonIfExists(join(ROOT, 'data', 'recht', 'revosax-attachments.json')),
    readJsonIfExists(join(cacheDir, 'materialization-report.json')),
    readJsonIfExists(join(ROOT, 'data', 'recht', 'ost-residual-backlog.json')),
    readJsonIfExists(join(ROOT, 'data', 'recht', 'revosax-sunset-decisions.json')),
  ]);
  const audit = await buildImportAudit({ cacheDir, manifest, report, plan, envelopes, decisions, sunsetDecisions, r2Manifest, attachmentsManifest, materializationReport, residualBacklog });
  await mkdir(OUTPUT_DIR, { recursive: true });
  let changed = 0;
  for (const [name, value] of Object.entries({ 'summary.json': audit.summary, 'skips.json': audit.skips, 'envelopes.json': audit.envelopes, 'review-flags.json': audit.reviewFlags })) {
    const path = join(OUTPUT_DIR, name);
    const next = `${JSON.stringify(value, null, 2)}\n`;
    const previous = await readFile(path, 'utf8').catch(() => null);
    // generatedFrom-Zeitstempel ändern sich mit jedem Staginglauf; für --check zählt der Inhalt.
    const strip = (text) => text?.replace(/"generatedFrom": \{[^}]*\}/u, '');
    if (strip(previous) !== strip(next)) {
      changed += 1;
      if (!check) await writeFile(path, next, 'utf8');
    }
  }
  const { balance } = audit.summary;
  console.log(`Bilanz: ${balance.uniqueHits} eindeutige Treffer = ${balance.materializedOwnNorms} eigene Normen + ${balance.existingMatched} vorhandene (MATCH) + ${balance.protectedExisting} geschützte + ${balance.review} REVIEW (${balance.reviewDeferred} zurückgestellt) + ${balance.skipped} SKIP ⇒ Summe ${balance.sums}`);
  if (balance.sums !== balance.uniqueHits) {
    console.error('Bilanz geht nicht auf.');
    process.exitCode = 1;
  }
  if (check && changed > 0) {
    console.error(`${changed} Auditdatei(en) sind nicht aktuell; node scripts/build-revosax-import-audit.mjs ausführen.`);
    process.exitCode = 1;
  } else if (!check) {
    console.log(`Import-Audit unter ${OUTPUT_DIR.replace(`${ROOT}/`, '')} geschrieben (${changed} Datei(en) geändert).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
