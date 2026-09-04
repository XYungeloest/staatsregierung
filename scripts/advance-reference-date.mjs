#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Fortschreibung des redaktionellen Stichtags (packages/shared/src/config/editorial.json).
 *
 * Der Stichtag entscheidet, welche gespeicherte Fassung als geltend ausgewiesen wird und welchen
 * Status eine Norm im Gitbestand trägt: `future-effective` gilt nur bis zum Inkrafttreten,
 * `in-force` nur bis zum Außerkrafttreten. Beim Fortschreiben müssen deshalb die Statusfelder
 * der betroffenen Normen mitgezogen werden, sonst erscheinen bereits geltende Vorschriften weiter
 * als „zukünftig“ (scripts/check-content.mjs lehnt den Widerspruch ab).
 *
 * Aufruf:
 *   node scripts/advance-reference-date.mjs --to 2026-09-04            # Audit (schreibt nichts)
 *   node scripts/advance-reference-date.mjs --to 2026-09-04 --write    # Stichtag und Status schreiben
 *   Optionen: --from <Datum> (Standard: bisheriger Stichtag), --json (maschinenlesbarer Bericht)
 *
 * Es werden ausschließlich `status` in meta.json und `referenceDate` in editorial.json
 * geschrieben; Quellen, Fassungen, Historie und Verkündungen bleiben unverändert. Themen mit
 * ablaufender Hervorhebung werden gemeldet; die Content-Prüfung verlangt weiterhin mindestens
 * eine laufende Hervorhebung am neuen Stichtag.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export const EDITORIAL_CONFIG_PATH = 'packages/shared/src/config/editorial.json';

function assertIsoDate(value, label) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) throw new Error(`${label} muss ein ISO-Datum (YYYY-MM-DD) sein, erhalten: ${String(value)}`);
  return value;
}

/** Status einer Norm zu einem Stichtag – dieselben Regeln wie scripts/check-content.mjs und der Importer. */
export function statusAt(meta, asOf) {
  const status = meta.status;
  if (status === 'future-effective') {
    if (meta.effectiveDate && meta.effectiveDate <= asOf) {
      return meta.expiryDate && meta.expiryDate < asOf ? 'repealed' : 'in-force';
    }
    return status;
  }
  if (status === 'in-force' && meta.expiryDate && meta.expiryDate < asOf) return 'repealed';
  return status;
}

/** Zeitliche Einordnung einer Fassung (vereinfacht wie classifyNormVersion, ohne Statusfälle). */
function versionKindAt(version, asOf) {
  if (version.validFrom > asOf) return 'future';
  if (version.validTo !== null && version.validTo !== undefined && version.validTo < asOf) return 'historical';
  return 'current';
}

/**
 * Reiner Plan der Fortschreibung: Statuswechsel je Norm und Fassungsübergänge (informativ).
 * @param {{ norms: Array<{ slug: string, meta: object, versions: Array<{ versionId: string, validFrom: string, validTo: string | null }> }>, from: string, to: string }} input
 */
export function planReferenceDateAdvance({ norms, from, to }) {
  assertIsoDate(from, 'Ausgangsstichtag');
  assertIsoDate(to, 'Zielstichtag');
  const statusChanges = [];
  const versionChanges = [];
  for (const norm of [...norms].sort((left, right) => left.slug.localeCompare(right.slug))) {
    const before = statusAt(norm.meta, from);
    const after = statusAt(norm.meta, to);
    if (before !== after) {
      statusChanges.push({ slug: norm.slug, from: before, to: after, effectiveDate: norm.meta.effectiveDate ?? null, expiryDate: norm.meta.expiryDate ?? null });
    }
    for (const version of norm.versions) {
      const kindBefore = versionKindAt(version, from);
      const kindAfter = versionKindAt(version, to);
      if (kindBefore !== kindAfter) {
        versionChanges.push({ slug: norm.slug, versionId: version.versionId, from: kindBefore, to: kindAfter, validFrom: version.validFrom, validTo: version.validTo ?? null });
      }
    }
  }
  return { from, to, statusChanges, versionChanges };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadNormsForPlan(root) {
  const normRoot = join(root, 'content', 'normen');
  const norms = [];
  for (const entry of await readdir(normRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(normRoot, entry.name);
    const meta = await readJson(join(directory, 'meta.json'));
    const versionFiles = (await readdir(join(directory, 'versions'))).filter((file) => file.endsWith('.json')).sort();
    const versions = [];
    for (const file of versionFiles) {
      const version = await readJson(join(directory, 'versions', file));
      versions.push({ versionId: version.versionId, validFrom: version.validFrom, validTo: version.validTo ?? null });
    }
    norms.push({ slug: entry.name, meta, versions, metaPath: join(directory, 'meta.json') });
  }
  return norms;
}

async function loadTopicHighlights(root) {
  const topicRoot = join(root, 'content', 'themen');
  const topics = [];
  for (const file of (await readdir(topicRoot)).filter((name) => name.endsWith('.json')).sort()) {
    const topic = await readJson(join(topicRoot, file));
    if (topic.highlightFrom || topic.highlightUntil) topics.push({ slug: topic.slug, highlightFrom: topic.highlightFrom ?? null, highlightUntil: topic.highlightUntil ?? null });
  }
  return topics;
}

function highlightActive(topic, asOf) {
  return Boolean(topic.highlightFrom) && topic.highlightFrom <= asOf && (!topic.highlightUntil || topic.highlightUntil >= asOf);
}

export async function main(argv = process.argv.slice(2), root = resolve(process.cwd())) {
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const write = argv.includes('--write');
  const json = argv.includes('--json');
  const editorialPath = join(root, EDITORIAL_CONFIG_PATH);
  const editorial = await readJson(editorialPath);
  const from = assertIsoDate(valueAfter('--from') ?? editorial.referenceDate, '--from');
  const to = valueAfter('--to');
  if (!to) throw new Error('Verwendung: node scripts/advance-reference-date.mjs --to <YYYY-MM-DD> [--from <YYYY-MM-DD>] [--write] [--json]');
  assertIsoDate(to, '--to');

  const norms = await loadNormsForPlan(root);
  const plan = planReferenceDateAdvance({ norms, from, to });
  const topics = await loadTopicHighlights(root);
  const expiringHighlights = topics.filter((topic) => highlightActive(topic, from) && !highlightActive(topic, to));
  const activeHighlightsAtTarget = topics.filter((topic) => highlightActive(topic, to));
  // scripts/check-organization.ts erwartet zum Stichtag einen datierten Organisations-Snapshot.
  const snapshotPath = join(root, 'content', 'organisation', 'snapshots', `${to}.json`);
  const organisationSnapshotExists = await readFile(snapshotPath, 'utf8').then(() => true, () => false);
  const report = {
    ...plan,
    editorialReferenceDate: editorial.referenceDate,
    expiringHighlights,
    activeHighlightsAtTarget: activeHighlightsAtTarget.map((topic) => topic.slug),
    organisationSnapshotExists,
    written: false,
  };

  if (write) {
    for (const change of plan.statusChanges) {
      const norm = norms.find((entry) => entry.slug === change.slug);
      const meta = { ...norm.meta, status: change.to };
      await writeFile(norm.metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    }
    if (editorial.referenceDate !== to) {
      await writeFile(editorialPath, `${JSON.stringify({ ...editorial, referenceDate: to }, null, 2)}\n`, 'utf8');
    }
    report.written = true;
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
  console.log(`Stichtag ${from} → ${to}${write ? ' (geschrieben)' : ' (Audit, nichts geschrieben)'}`);
  console.log(`Statuswechsel: ${plan.statusChanges.length}`);
  for (const change of plan.statusChanges) {
    console.log(`  ${change.slug}: ${change.from} → ${change.to} (Inkrafttreten ${change.effectiveDate ?? '–'}${change.expiryDate ? `, Außerkrafttreten ${change.expiryDate}` : ''})`);
  }
  console.log(`Fassungsübergänge: ${plan.versionChanges.length}`);
  for (const change of plan.versionChanges) {
    console.log(`  ${change.slug}/${change.versionId}: ${change.from} → ${change.to} (gültig ab ${change.validFrom}${change.validTo ? ` bis ${change.validTo}` : ''})`);
  }
  if (expiringHighlights.length > 0) {
    console.log(`Ablaufende Themen-Hervorhebungen: ${expiringHighlights.map((topic) => `${topic.slug} (bis ${topic.highlightUntil})`).join(', ')}`);
  }
  console.log(`Laufende Hervorhebungen am ${to}: ${activeHighlightsAtTarget.map((topic) => topic.slug).join(', ') || 'keine – content:check verlangt mindestens eine'}`);
  if (!organisationSnapshotExists) console.log(`Hinweis: content/organisation/snapshots/${to}.json fehlt; content:check erwartet einen datierten Organisations-Snapshot zum Stichtag (bei unveränderter Regierung den vorherigen Snapshot mit neuem asOf übernehmen).`);
  if (!write) console.log('Mit --write werden nur status (meta.json) und referenceDate (editorial.json) geschrieben; danach npm run content:check und npm run knowledge:build ausführen.');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
