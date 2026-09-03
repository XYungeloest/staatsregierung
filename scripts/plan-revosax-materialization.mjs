#!/usr/bin/env node

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const CONTENT_ROOT = join(ROOT, 'content', 'normen');

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function normalizeIdentity(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('de')
    .replace(/\b(?:freistaat(?:es)?\s+)?(?:sachsen|ostdeutschland)\b/gu, ' ')
    .replace(/\b(?:saechsisch|sächsisch|ostdeutsch)(?:e|er|es|en|em)?\b/gu, ' ')
    .replace(/[^a-z0-9äöüß]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizedAbbr(value) {
  return String(value ?? '')
    .replace(/^Sächs/iu, '')
    .replace(/^Saechs/iu, '')
    .replace(/^Ost/iu, '')
    .replace(/[^A-Za-z0-9]/gu, '')
    .toLocaleLowerCase('de');
}

function sourceLawIds(meta, versions) {
  const ids = new Set();
  for (const source of meta.sourceReferences ?? []) {
    if (source.lawId) ids.add(String(source.lawId));
  }
  for (const version of versions) {
    for (const source of version.sourceReferences ?? []) {
      if (source.lawId) ids.add(String(source.lawId));
    }
  }
  return [...ids];
}

async function loadExistingNorm(slug) {
  const directory = join(CONTENT_ROOT, slug);
  const [meta, versionEntries] = await Promise.all([
    readJson(join(directory, 'meta.json')),
    readdir(join(directory, 'versions'), { withFileTypes: true }),
  ]);
  const versions = [];
  for (const entry of versionEntries.filter((item) => item.isFile() && item.name.endsWith('.json'))) {
    versions.push(await readJson(join(directory, 'versions', entry.name)));
  }
  versions.sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  const current = versions.find((version) => version.isCurrent) ?? versions.at(-1) ?? null;
  const titles = new Set([
    meta.title,
    meta.shortTitle,
    current?.title,
    current?.shortTitle,
  ].filter(Boolean).map(normalizeIdentity).filter(Boolean));
  const abbreviations = new Set([
    meta.abbr,
    current?.abbr,
  ].filter(Boolean).map(normalizedAbbr).filter(Boolean));
  return {
    slug,
    meta,
    versions,
    current,
    lawIds: sourceLawIds(meta, versions),
    titles: [...titles],
    abbreviations: [...abbreviations],
  };
}

async function loadExistingNorms() {
  const entries = await readdir(CONTENT_ROOT, { withFileTypes: true });
  const norms = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    norms.push(await loadExistingNorm(entry.name));
  }
  return norms;
}

function buildIndexes(norms) {
  const byLawId = new Map();
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
    for (const title of norm.titles) add(byTitle, title, norm);
    for (const abbr of norm.abbreviations) add(byAbbr, abbr, norm);
  }
  return { byLawId, byTitle, byAbbr, bySlug };
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

function planEntry(entry, baselineDate, indexes) {
  const lawIdMatches = indexes.byLawId.get(String(entry.revosaxLawId)) ?? [];
  if (lawIdMatches.length > 1) {
    return {
      action: 'REVIEW',
      reason: `REVOSax-lawId ${entry.revosaxLawId} ist mehreren bestehenden Normen zugeordnet`,
      candidates: lawIdMatches.map((norm) => norm.slug),
    };
  }

  let candidates = lawIdMatches;
  let matchBasis = lawIdMatches.length === 1 ? 'lawId' : null;
  if (candidates.length === 0) {
    const titleKeys = [entry.adaptedTitle, entry.adaptedShortTitle]
      .map(normalizeIdentity)
      .filter(Boolean);
    const titleMatches = titleKeys.flatMap((key) => indexes.byTitle.get(key) ?? []);
    const abbrKey = normalizedAbbr(entry.adaptedAbbr);
    const abbrMatches = abbrKey ? (indexes.byAbbr.get(abbrKey) ?? []) : [];
    candidates = uniqueCandidates([...titleMatches, ...abbrMatches]);
    if (candidates.length === 1) {
      const candidate = candidates[0];
      matchBasis = candidate.abbreviations.includes(abbrKey) && abbrKey ? 'title/abbr' : 'title';
    }
  }

  if (candidates.length > 1) {
    return {
      action: 'REVIEW',
      reason: 'Titel/Kurzbezeichnung/Abkürzung passen zu mehreren bestehenden Normen',
      candidates: candidates.map((norm) => norm.slug),
    };
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
    return {
      action: 'MATCH',
      reason: baseline ? 'Ausgangsfassung ist bereits vorhanden' : 'bestehende Norm eindeutig zugeordnet; Ausgangsfassung kann ergänzt werden',
      canonicalSlug: norm.slug,
      matchBasis,
      baselinePresent: Boolean(baseline),
    };
  }

  const slugCollision = indexes.bySlug.get(entry.proposedSlug);
  if (slugCollision) {
    return {
      action: 'REVIEW',
      reason: `vorgeschlagener Slug ${entry.proposedSlug} ist bereits durch eine andere Norm belegt`,
      candidates: [slugCollision.slug],
    };
  }

  return {
    action: 'CREATE',
    reason: 'keine bestehende Norm mit gleicher REVOSax-ID oder eindeutiger Ost-Identität gefunden',
    canonicalSlug: entry.proposedSlug,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const reportPath = resolve(valueAfter(args, '--report') ?? '.cache/revosax-baseline/2023-11-01/report.json');
  const outputPath = resolve(valueAfter(args, '--output') ?? reportPath.replace(/report\.json$/u, 'materialization-plan.json'));
  const strict = args.includes('--strict');
  const report = await readJson(reportPath);
  if (report.failed > 0) {
    throw new Error(`${reportPath}: enthält ${report.failed} Stagingfehler; Materialisierungsplanung abgebrochen`);
  }
  if (!report.baselineDate) throw new Error(`${reportPath}: baselineDate fehlt`);

  const existing = await loadExistingNorms();
  const indexes = buildIndexes(existing);
  const entries = report.entries.map((entry) => ({
    revosaxLawId: entry.revosaxLawId,
    versionSuffix: entry.versionSuffix,
    sourceUrl: entry.sourceUrl,
    adaptedTitle: entry.adaptedTitle,
    adaptedShortTitle: entry.adaptedShortTitle,
    adaptedAbbr: entry.adaptedAbbr,
    inferredType: entry.inferredType,
    proposedSlug: entry.proposedSlug,
    ...planEntry(entry, report.baselineDate, indexes),
  }));

  const counts = Object.fromEntries(
    ['CREATE', 'MATCH', 'PROTECT', 'REVIEW', 'SKIP'].map((action) => [
      action,
      entries.filter((entry) => entry.action === action).length,
    ]),
  );
  const plan = {
    schemaVersion: 1,
    baselineDate: report.baselineDate,
    generatedAt: new Date().toISOString(),
    sourceReport: reportPath.replace(`${ROOT}/`, ''),
    existingNormCount: existing.length,
    stagedNormCount: entries.length,
    counts,
    entries,
  };
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(`Materialisierungsplan: ${outputPath}`);
  console.log(Object.entries(counts).map(([action, count]) => `${action}=${count}`).join(', '));
  if (strict && counts.REVIEW > 0) process.exitCode = 1;
}

await main();
