#!/usr/bin/env node

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Materialisierungsplan für den REVOSax-Ausgangsbestand.
 *
 * Vor jedem Schreibvorgang wird jeder gestagte Treffer genau einer Kategorie
 * zugeordnet:
 *
 *   CREATE   neue übernommene Norm; kein bestehender Datensatz passt
 *   MATCH    bestehende Norm eindeutig erkannt und Ausgangsfassung vorhanden;
 *            es wird nichts überschrieben
 *   PROTECT  bestehende Norm besitzt spätere ostdeutsche Fassungen; wird nie
 *            von der Baseline berührt
 *   REVIEW   Identität nicht eindeutig oder Sachlage ungeklärt; Schreiben verboten
 *   SKIP     fachlich bewusst nicht zu importieren (Mehrfachfassungs-Alias,
 *            identische Zweitfassung oder dokumentierte Entscheidung)
 *
 * Identität wird in dieser Reihenfolge geprüft: REVOSax-lawId, vorhandene
 * Quellenreferenz (URL), exakter Titel, exakte Kurzbezeichnung, exakte
 * Abkürzung. Es gibt keine unscharfen Auto-Merges; Mehrdeutigkeit ergibt REVIEW.
 * Dokumentierte Entscheidungen aus data/recht/revosax-baseline-decisions.json
 * lösen REVIEW-Fälle auf oder erzwingen SKIP; jede Entscheidung braucht eine
 * Begründung.
 */

const ROOT = resolve(process.cwd());
const CONTENT_ROOT = join(ROOT, 'content', 'normen');
const DECISIONS_PATH = join(ROOT, 'data', 'recht', 'revosax-baseline-decisions.json');
export const PLAN_ACTIONS = ['CREATE', 'MATCH', 'PROTECT', 'REVIEW', 'SKIP'];

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function normalizeIdentity(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('de')
    .replace(/\b(?:freistaat(?:es)?\s+)?(?:sachsen|ostdeutschland)\b/gu, ' ')
    .replace(/\b(?:saechsisch|sachsisch|ostdeutsch)(?:e|er|es|en|em)?\b/gu, ' ')
    .replace(/[^a-z0-9äöüß]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function normalizedAbbr(value) {
  return String(value ?? '')
    .replace(/^Sächs/iu, '')
    .replace(/^Saechs/iu, '')
    .replace(/^Ost/iu, '')
    .replace(/[^A-Za-z0-9]/gu, '')
    .toLocaleLowerCase('de');
}

function sourceReferencesOf(meta, versions) {
  return [
    ...(meta.sourceReferences ?? []),
    ...versions.flatMap((version) => version.sourceReferences ?? []),
  ];
}

export async function loadExistingNorm(slug, contentRoot = CONTENT_ROOT) {
  const directory = join(contentRoot, slug);
  const [meta, versionEntries] = await Promise.all([
    readJson(join(directory, 'meta.json')),
    readdir(join(directory, 'versions'), { withFileTypes: true }),
  ]);
  const versions = [];
  for (const entry of versionEntries.filter((item) => item.isFile() && item.name.endsWith('.json'))) {
    versions.push(await readJson(join(directory, 'versions', entry.name)));
  }
  versions.sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  return summarizeExistingNorm(slug, meta, versions);
}

export function summarizeExistingNorm(slug, meta, versions) {
  const current = versions.find((version) => version.isCurrent) ?? versions.at(-1) ?? null;
  const references = sourceReferencesOf(meta, versions);
  const titles = new Set([
    meta.title,
    meta.shortTitle,
    ...versions.flatMap((version) => [version.title, version.shortTitle]),
  ].filter(Boolean).map(normalizeIdentity).filter(Boolean));
  const abbreviations = new Set([
    meta.abbr,
    ...versions.map((version) => version.abbr),
  ].filter(Boolean).map(normalizedAbbr).filter(Boolean));
  return {
    slug,
    meta,
    versions,
    current,
    lawIds: [...new Set(references.map((source) => source.lawId).filter(Boolean).map(String))],
    sourceUrls: [...new Set(references.map((source) => source.url).filter(Boolean))],
    titles: [...titles],
    abbreviations: [...abbreviations],
  };
}

async function loadExistingNorms(contentRoot = CONTENT_ROOT) {
  const entries = await readdir(contentRoot, { withFileTypes: true });
  const norms = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    norms.push(await loadExistingNorm(entry.name, contentRoot));
  }
  return norms;
}

export function buildIndexes(norms) {
  const byLawId = new Map();
  const byUrl = new Map();
  const byTitle = new Map();
  const byAbbr = new Map();
  const bySlug = new Map(norms.map((norm) => [norm.slug, norm]));

  const add = (map, key, norm) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    if (!list.some((candidate) => candidate.slug === norm.slug)) list.push(norm);
    map.set(key, list);
  };

  for (const norm of norms) {
    for (const lawId of norm.lawIds) add(byLawId, lawId, norm);
    for (const url of norm.sourceUrls) add(byUrl, url, norm);
    for (const title of norm.titles) add(byTitle, title, norm);
    for (const abbr of norm.abbreviations) add(byAbbr, abbr, norm);
  }
  return { byLawId, byUrl, byTitle, byAbbr, bySlug };
}

function uniqueCandidates(candidates) {
  const bySlug = new Map();
  for (const candidate of candidates) bySlug.set(candidate.slug, candidate);
  return [...bySlug.values()];
}

function laterOstVersions(norm, baselineDate) {
  return norm.versions.filter((version) => version.validFrom > baselineDate);
}

function exactBaselineVersion(norm, baselineDate) {
  return norm.versions.find((version) => version.versionId === baselineDate || version.validFrom === baselineDate) ?? null;
}

function review(reason, extra = {}) {
  return { action: 'REVIEW', reason, ...extra };
}

export function planEntry(entry, baselineDate, indexes) {
  if (entry.skipReason) {
    return { action: 'SKIP', reason: `Staging: ${entry.skipReason}` };
  }
  const blockingFlags = (entry.reviewFlags ?? []).filter((flag) =>
    ['multi-version-text-differs', 'multi-version-sibling-not-staged', 'attachment-only-content'].includes(flag));
  if (blockingFlags.length > 0) {
    return review(`Staging-Reviewfall: ${blockingFlags.join(', ')}`);
  }

  const lawIdMatches = indexes.byLawId.get(String(entry.revosaxLawId)) ?? [];
  if (lawIdMatches.length > 1) {
    return review(`REVOSax-lawId ${entry.revosaxLawId} ist mehreren bestehenden Normen zugeordnet`, {
      candidates: lawIdMatches.map((norm) => norm.slug),
    });
  }

  let candidates = lawIdMatches;
  let matchBasis = lawIdMatches.length === 1 ? 'lawId' : null;
  if (candidates.length === 0) {
    const urlMatches = uniqueCandidates([entry.sourceUrl, entry.canonicalVersionUrl, entry.requestedUrl]
      .filter(Boolean)
      .flatMap((url) => indexes.byUrl.get(url) ?? []));
    if (urlMatches.length > 0) {
      candidates = urlMatches;
      matchBasis = 'sourceUrl';
    }
  }
  if (candidates.length === 0) {
    const titleKeys = [...new Set([entry.adaptedTitle, entry.adaptedShortTitle, entry.sourceTitle, entry.listing?.label]
      .map(normalizeIdentity)
      .filter(Boolean))];
    const titleMatches = titleKeys.flatMap((key) => indexes.byTitle.get(key) ?? []);
    const abbrKey = normalizedAbbr(entry.adaptedAbbr ?? entry.sourceAbbr);
    const abbrMatches = abbrKey ? (indexes.byAbbr.get(abbrKey) ?? []) : [];
    candidates = uniqueCandidates([...titleMatches, ...abbrMatches]);
    if (candidates.length === 1) {
      const candidate = candidates[0];
      const titleMatched = titleMatches.some((norm) => norm.slug === candidate.slug);
      const abbrMatched = abbrKey && candidate.abbreviations.includes(abbrKey);
      matchBasis = titleMatched && abbrMatched ? 'title/abbr' : titleMatched ? 'title' : 'abbr';
      if (matchBasis === 'abbr') {
        // Eine Abkürzung allein ist kein sicherer Identitätsnachweis.
        return review(`Abkürzung ${entry.adaptedAbbr ?? entry.sourceAbbr} passt zu ${candidate.slug}, Titel und Kurzbezeichnung jedoch nicht`, {
          candidates: [candidate.slug],
        });
      }
    }
  }

  if (candidates.length > 1) {
    return review('Titel/Kurzbezeichnung/Abkürzung passen zu mehreren bestehenden Normen', {
      candidates: candidates.map((norm) => norm.slug),
    });
  }

  if (candidates.length === 1) {
    const norm = candidates[0];
    const laterVersions = laterOstVersions(norm, baselineDate);
    const baseline = exactBaselineVersion(norm, baselineDate);
    if (laterVersions.length > 0) {
      return {
        action: 'PROTECT',
        reason: `bestehende Norm besitzt ${laterVersions.length} Fassung(en) nach dem Rechtsüberleitungsstichtag`,
        canonicalSlug: norm.slug,
        matchBasis,
        baselinePresent: Boolean(baseline),
        laterVersionIds: laterVersions.map((version) => version.versionId),
      };
    }
    if (!baseline) {
      return review(`bestehende Norm ${norm.slug} (${matchBasis}) besitzt keine Ausgangsfassung ${baselineDate}; Ergänzung erfordert redaktionelle Entscheidung`, {
        candidates: [norm.slug],
        matchBasis,
      });
    }
    return {
      action: 'MATCH',
      reason: 'bestehende Norm eindeutig zugeordnet; Ausgangsfassung ist bereits vorhanden',
      canonicalSlug: norm.slug,
      matchBasis,
      baselinePresent: true,
    };
  }

  const slugCollision = indexes.bySlug.get(entry.proposedSlug);
  if (slugCollision) {
    return review(`vorgeschlagener Slug ${entry.proposedSlug} ist bereits durch eine andere Norm belegt`, {
      candidates: [slugCollision.slug],
    });
  }

  return {
    action: 'CREATE',
    reason: 'keine bestehende Norm mit gleicher REVOSax-ID, Quellen-URL oder eindeutiger Ost-Identität gefunden',
    canonicalSlug: entry.proposedSlug,
  };
}

export function applyDecision(planned, entry, decisions, baselineDate) {
  const key = entry.sourceId ?? `${entry.revosaxLawId}${entry.versionSuffix ? `.${entry.versionSuffix}` : ''}`;
  const decision = decisions?.[key] ?? decisions?.[String(entry.revosaxLawId)];
  if (!decision) return planned;
  if (!PLAN_ACTIONS.includes(decision.action) || decision.action === 'REVIEW') {
    return review(`Entscheidung für ${key} nennt keine gültige Aktion (${decision.action ?? '?'})`);
  }
  if (typeof decision.reason !== 'string' || decision.reason.trim().length < 12) {
    return review(`Entscheidung für ${key} ohne ausreichende Begründung`);
  }
  if (planned.action !== 'REVIEW' && decision.action !== 'SKIP') {
    return review(`Entscheidung für ${key} (${decision.action}) widerspricht der automatischen Zuordnung ${planned.action}`);
  }
  if (decision.action === 'CREATE') {
    return {
      action: 'CREATE',
      reason: `Entscheidung: ${decision.reason}`,
      canonicalSlug: decision.canonicalSlug ?? entry.proposedSlug,
      decided: true,
    };
  }
  if (decision.action === 'MATCH' || decision.action === 'PROTECT') {
    if (!decision.canonicalSlug) return review(`Entscheidung für ${key} (${decision.action}) nennt keinen canonicalSlug`);
    return {
      action: decision.action,
      reason: `Entscheidung: ${decision.reason}`,
      canonicalSlug: decision.canonicalSlug,
      matchBasis: 'decision',
      baselinePresent: undefined,
      decided: true,
    };
  }
  return { action: 'SKIP', reason: `Entscheidung: ${decision.reason}`, decided: true };
}

export function buildPlan({ report, existing, decisions = {}, baselineDate = report.baselineDate }) {
  const indexes = buildIndexes(existing);
  const entries = report.entries.map((entry) => ({
    revosaxLawId: String(entry.revosaxLawId),
    versionSuffix: entry.versionSuffix ?? null,
    sourceId: entry.sourceId,
    category: entry.category ?? null,
    sourceUrl: entry.sourceUrl,
    canonicalVersionUrl: entry.canonicalVersionUrl ?? null,
    adaptedTitle: entry.adaptedTitle,
    adaptedShortTitle: entry.adaptedShortTitle,
    adaptedAbbr: entry.adaptedAbbr ?? null,
    inferredType: entry.inferredType,
    proposedSlug: entry.proposedSlug,
    reviewFlags: entry.reviewFlags ?? [],
    ...applyDecision(planEntry(entry, baselineDate, indexes), entry, decisions, baselineDate),
  }));

  // Zwei CREATE-Einträge dürfen nie denselben Slug erhalten.
  const slugOwners = new Map();
  for (const planned of entries) {
    if (planned.action !== 'CREATE') continue;
    const owners = slugOwners.get(planned.canonicalSlug) ?? [];
    owners.push(planned);
    slugOwners.set(planned.canonicalSlug, owners);
  }
  for (const [slug, owners] of slugOwners) {
    if (owners.length < 2) continue;
    for (const planned of owners) {
      planned.action = 'REVIEW';
      planned.reason = `Slug ${slug} würde von ${owners.length} neuen Normen belegt: ${owners.map((owner) => owner.sourceId).join(', ')}`;
    }
  }

  const counts = Object.fromEntries(PLAN_ACTIONS.map((action) => [action, entries.filter((entry) => entry.action === action).length]));
  return {
    schemaVersion: 2,
    baselineDate,
    generatedAt: new Date().toISOString(),
    sourceReport: report.sourceReport ?? null,
    existingNormCount: existing.length,
    stagedNormCount: entries.length,
    counts,
    writable: counts.REVIEW === 0,
    entries,
  };
}

async function loadDecisions() {
  try {
    const file = await readJson(DECISIONS_PATH);
    return file.decisions ?? {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const reportPath = resolve(valueAfter(args, '--report') ?? '.cache/revosax-baseline/2023-11-01/report.json');
  const outputPath = resolve(valueAfter(args, '--output') ?? reportPath.replace(/report\.json$/u, 'materialization-plan.json'));
  const strict = args.includes('--strict');
  const allowFailures = args.includes('--allow-failures');
  const report = await readJson(reportPath);
  if (report.failed > 0 && !allowFailures) {
    throw new Error(`${reportPath}: enthält ${report.failed} Stagingfehler; Materialisierungsplanung abgebrochen (--allow-failures nur für Stichproben)`);
  }
  if (!report.baselineDate) throw new Error(`${reportPath}: baselineDate fehlt`);

  const [existing, decisions] = await Promise.all([loadExistingNorms(), loadDecisions()]);
  const plan = buildPlan({ report: { ...report, sourceReport: reportPath.replace(`${ROOT}/`, '') }, existing, decisions });
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(`Materialisierungsplan: ${outputPath}`);
  console.log(Object.entries(plan.counts).map(([action, count]) => `${action}=${count}`).join(', '));
  for (const entry of plan.entries.filter((candidate) => candidate.action === 'REVIEW').slice(0, 30)) {
    console.log(`REVIEW ${entry.sourceId}: ${entry.reason}${entry.candidates ? ` [${entry.candidates.join(', ')}]` : ''}`);
  }
  if (strict && plan.counts.REVIEW > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
