#!/usr/bin/env node --experimental-strip-types

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  parseNormHistory,
  parseNormMeta,
  parseNormVersion,
  validateNormRecord,
} from '@ostrecht/shared/lib/norms/schema.ts';
import { validateVersionIntervals } from '@ostrecht/shared/lib/norms/versions.ts';

import { historicalBaselineCitation } from './lib/revosax-citation.mjs';
import {
  BASELINE_DATE,
  inferEnactingBody,
  inferKeywords,
  inferSubjects,
  inferSummary,
  sourceReferenceLabel,
} from './lib/revosax-metadata.mjs';
import { auditAdaptedRevosaxSnapshot } from './lib/revosax-ost-adapter.mjs';

/**
 * Materialisiert den geprüften REVOSax-Ausgangsbestand nach content/normen/.
 *
 * Voraussetzungen (alle fail-closed):
 *   - Materialisierungsplan ohne REVIEW-Fälle (scripts/plan-revosax-materialization.mjs)
 *   - Stagingbericht mit den geparsten und angepassten Fassungen
 *   - R2-Manifest data/recht/revosax-r2-manifest.json, das jede Rohquelle
 *     hashidentisch verzeichnet (Provenienz `availability: "r2-archived"`)
 *
 * Es werden ausschließlich CREATE-Einträge geschrieben. MATCH, PROTECT und
 * SKIP verändern nie bestehende Normen. Jeder erzeugte Datensatz wird vor dem
 * Schreiben mit dem gemeinsamen Normschema validiert und erneut auf
 * Sachsen-Reststellen geprüft; ein einziger Fehler verhindert den gesamten
 * Schreiblauf. Ohne --write bleibt der Lauf eine Prüfung.
 */

const ROOT = resolve(process.cwd());
const CONTENT_ROOT = join(ROOT, 'content', 'normen');
const R2_MANIFEST_PATH = join(ROOT, 'data', 'recht', 'revosax-r2-manifest.json');

const USAGE = `Verwendung: node --experimental-strip-types scripts/materialize-revosax-baseline.mjs [Optionen]

Optionen:
  --plan <Pfad>       Materialisierungsplan (Standard: .cache/revosax-baseline/2023-11-01/materialization-plan.json)
  --report <Pfad>     Stagingbericht (Standard: .cache/revosax-baseline/2023-11-01/report.json)
  --write             Dateien tatsächlich schreiben (sonst nur Prüfung)
  --limit <n>         nur die ersten n CREATE-Einträge
  --law-id <id>       nur diese lawId (mehrfach möglich)
  --help              Diese Hilfe`;

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesAfter(args, flag) {
  return args.flatMap((entry, index) => (entry === flag && args[index + 1] ? [args[index + 1]] : []));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function objectKeyFor(baselineDate, sourceId) {
  return `revosax/${baselineDate}/${sourceId}.html`;
}

function checkSummary(summary, context) {
  const trimmed = String(summary ?? '').trim();
  if (trimmed.length < 24) throw new Error(`${context}: summary ist zu kurz`);
  if (/^(?:§|Abschnitt\b|Artikel\b|OABl\.|OGVBl\.|StAnzO\.|GVBl\.|Aufgrund\b|Auf Grund\b|\d+\.)/u.test(trimmed)) {
    throw new Error(`${context}: summary beginnt mit einem Normtextfragment`);
  }
}

/**
 * Baut aus einem gestagten Treffer den vollständigen Normdatensatz.
 * `parsed` ist die Datei aus parsed/<sourceId>.json (original + adapted).
 */
export function buildBaselineRecord({ entry, parsed, slug, objectRecord, baselineDate = BASELINE_DATE }) {
  const { adapted, original } = parsed;
  const context = `${entry.sourceId} (${slug})`;
  const objectKey = objectKeyFor(baselineDate, entry.sourceId);
  if (!objectRecord) throw new Error(`${context}: Rohquelle ${objectKey} ist nicht im R2-Manifest archiviert`);
  if (objectRecord.sha256 !== entry.sourceSha256) throw new Error(`${context}: SHA-256 im R2-Manifest weicht vom Stagingbericht ab`);
  if (objectRecord.url !== entry.sourceUrl) throw new Error(`${context}: amtliche URL im R2-Manifest weicht vom Stagingbericht ab`);
  if (!original.sourceValidFrom) throw new Error(`${context}: Quelle ohne Gültigkeitsbeginn`);

  // REVOSax pflegt das Seiten-Vollzitat auch auf historischen Fassungsseiten
  // weiter. Änderungen, die nach dem Rechtsüberleitungsstichtag datieren, gehören
  // nicht zur übernommenen Ausgangsfassung und werden aus der Zitierung entfernt.
  const citation = historicalBaselineCitation({
    pageFullCitation: adapted.pageFullCitation ?? adapted.fullCitation,
    sourceValidTo: original.sourceValidTo,
    citationValidAt: baselineDate,
    context,
  });
  const title = adapted.sourceTitle;
  const shortTitle = adapted.shortTitle || title;
  const abbr = adapted.abbr;
  const normType = entry.inferredType;
  const isAmendment = normType === 'aenderungsvorschrift';
  const reference = {
    kind: 'revosax-snapshot',
    label: sourceReferenceLabel({
      lawId: entry.revosaxLawId,
      versionNumber: entry.versionNumber,
      sourceValidFrom: original.sourceValidFrom,
      sourceValidTo: original.sourceValidTo,
    }),
    availability: 'r2-archived',
    objectKey,
    url: entry.sourceUrl,
    retrievedAt: String(entry.retrievedAt).slice(0, 10),
    sha256: entry.sourceSha256,
    lawId: String(entry.revosaxLawId),
    sourceValidFrom: original.sourceValidFrom,
    ...(original.sourceValidTo ? { sourceValidTo: original.sourceValidTo } : {}),
    sourceRole: 'official-snapshot',
    mediaType: 'text/html',
  };
  const enactingBody = inferEnactingBody({ category: entry.category, sourceTitle: original.sourceTitle });
  const meta = {
    id: slug,
    slug,
    title,
    shortTitle,
    ...(abbr ? { abbr } : {}),
    shortTitleSource: 'official',
    type: normType,
    ...(enactingBody ? { enactingBody } : {}),
    subjects: inferSubjects({ sourceTitle: original.sourceTitle, label: entry.listing?.label, category: entry.category }),
    keywords: inferKeywords({ abbr, shortTitle, title }),
    initialCitation: citation,
    predecessor: null,
    successor: null,
    summary: inferSummary({ normType, shortTitle }),
    status: isAmendment ? 'one-time-act' : 'in-force',
    ...(original.documentDate ? { documentDate: original.documentDate } : {}),
    ...(isAmendment ? { effectiveDate: original.sourceValidFrom } : {}),
    sourceReferences: [reference],
  };
  const history = {
    initialVersionId: baselineDate,
    entries: [{
      date: baselineDate,
      type: 'initial',
      title: 'Vollständige Ausgangsfassung zum Rechtsüberleitungsstichtag.',
      citation,
      affectingVersionId: baselineDate,
    }],
  };
  const version = {
    versionId: baselineDate,
    title,
    shortTitle,
    ...(abbr ? { abbr } : {}),
    validFrom: baselineDate,
    validTo: null,
    isCurrent: true,
    citation,
    changeNote: `Ausgangsfassung nach dem am ${baselineDate} geltenden sächsischen Rechtsstand.`,
    sourceReferences: [reference],
    ...(original.sourceNotes?.length ? { sourceNotes: original.sourceNotes } : {}),
    body: adapted.body,
  };

  // Schema- und Reststellenprüfung vor jedem Schreibvorgang.
  const parsedMeta = parseNormMeta(meta, `${slug}/meta.json`);
  const parsedHistory = parseNormHistory(history, `${slug}/history.json`);
  const parsedVersion = parseNormVersion(version, `${slug}/versions/${baselineDate}.json`);
  const record = validateNormRecord({ meta: parsedMeta, history: parsedHistory, versions: [parsedVersion] }, slug);
  validateVersionIntervals(record);
  checkSummary(meta.summary, context);
  const residuals = auditAdaptedRevosaxSnapshot({ sourceTitle: title, shortTitle, abbr, fullCitation: citation, body: version.body });
  if (residuals.length > 0) {
    throw new Error(`${context}: Sachsen-Reststellen: ${residuals.slice(0, 3).map((item) => item.path).join(', ')}`);
  }
  return { slug, meta, history, version };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const planPath = resolve(valueAfter(args, '--plan') ?? '.cache/revosax-baseline/2023-11-01/materialization-plan.json');
  const reportPath = resolve(valueAfter(args, '--report') ?? '.cache/revosax-baseline/2023-11-01/report.json');
  const write = args.includes('--write');
  const limit = valueAfter(args, '--limit') ? Number.parseInt(valueAfter(args, '--limit'), 10) : null;
  const lawIds = valuesAfter(args, '--law-id');
  const [plan, report] = await Promise.all([readJson(planPath), readJson(reportPath)]);
  if (plan.baselineDate !== report.baselineDate) throw new Error('Plan und Stagingbericht gehören zu verschiedenen Stichtagen');
  const baselineDate = plan.baselineDate;
  const r2Manifest = (await exists(R2_MANIFEST_PATH)) ? await readJson(R2_MANIFEST_PATH) : { objects: {} };
  if (plan.counts.REVIEW > 0) {
    const message = `${plan.counts.REVIEW} REVIEW-Fall/-Fälle im Materialisierungsplan; Schreiben ist blockiert, bis sie über data/recht/revosax-baseline-decisions.json geklärt sind`;
    if (write) throw new Error(message);
    console.error(`Hinweis: ${message}`);
  }

  const reportEntries = new Map(report.entries.map((entry) => [entry.sourceId, entry]));
  let creates = plan.entries.filter((entry) => entry.action === 'CREATE');
  if (lawIds.length > 0) creates = creates.filter((entry) => lawIds.includes(String(entry.revosaxLawId)));
  if (limit !== null) creates = creates.slice(0, limit);

  const prepared = [];
  const problems = [];
  for (const planned of creates) {
    const entry = reportEntries.get(planned.sourceId);
    try {
      if (!entry) throw new Error(`${planned.sourceId}: fehlt im Stagingbericht`);
      const parsed = await readJson(resolve(ROOT, entry.parsedCacheFile));
      const record = buildBaselineRecord({
        entry,
        parsed,
        slug: planned.canonicalSlug,
        objectRecord: r2Manifest.objects?.[objectKeyFor(baselineDate, entry.sourceId)],
        baselineDate,
      });
      if (await exists(join(CONTENT_ROOT, record.slug))) {
        throw new Error(`${planned.sourceId}: content/normen/${record.slug} existiert bereits; CREATE darf keine bestehende Norm berühren`);
      }
      prepared.push(record);
    } catch (error) {
      problems.push({ sourceId: planned.sourceId, slug: planned.canonicalSlug, error: error.message });
    }
  }

  const summary = {
    schemaVersion: 1,
    baselineDate,
    generatedAt: new Date().toISOString(),
    plan: planPath.replace(`${ROOT}/`, ''),
    write,
    planned: plan.counts,
    prepared: prepared.length,
    problems: problems.length,
    written: 0,
    entries: prepared.map((record) => ({ slug: record.slug, lawId: record.meta.sourceReferences[0].lawId, type: record.meta.type })),
    problemDetails: problems,
  };

  if (problems.length > 0) {
    for (const problem of problems.slice(0, 40)) console.error(`FEHLER ${problem.sourceId}: ${problem.error}`);
    console.error(`${problems.length} von ${creates.length} CREATE-Einträgen sind nicht schreibbar; es wird nichts geschrieben.`);
    process.exitCode = 1;
  } else if (write) {
    for (const record of prepared) {
      const directory = join(CONTENT_ROOT, record.slug);
      await writeJson(join(directory, 'meta.json'), record.meta);
      await writeJson(join(directory, 'history.json'), record.history);
      await writeJson(join(directory, 'versions', `${baselineDate}.json`), record.version);
    }
    summary.written = prepared.length;
    console.log(`${prepared.length} Normen nach content/normen geschrieben.`);
  } else {
    console.log(`${prepared.length} CREATE-Einträge geprüft und schreibbar (Prüflauf ohne --write).`);
  }
  const summaryPath = planPath.replace(/materialization-plan\.json$/u, 'materialization-report.json');
  await writeJson(summaryPath, summary);
  console.log(`Materialisierungsbericht: ${summaryPath.replace(`${ROOT}/`, '')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
