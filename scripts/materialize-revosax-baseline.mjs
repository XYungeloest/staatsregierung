#!/usr/bin/env node --experimental-strip-types

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
import { adaptParsedRevosaxSnapshot, auditAdaptedRevosaxSnapshot } from './lib/revosax-ost-adapter.mjs';
import { parseRevosaxSnapshot } from './lib/revosax-parser.mjs';

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
const SUNSET_DECISIONS_PATH = join(ROOT, 'data', 'recht', 'revosax-sunset-decisions.json');
const POST_CUTOFF_DECISIONS_PATH = join(ROOT, 'data', 'recht', 'revosax-post-cutoff-decisions.json');
const POST_CUTOFF_RESOLUTIONS = ['discard', 'adopted', 'open'];

const USAGE = `Verwendung: node --experimental-strip-types scripts/materialize-revosax-baseline.mjs [Optionen]

Optionen:
  --plan <Pfad>       Materialisierungsplan (Standard: .cache/revosax-baseline/2023-11-01/materialization-plan.json)
  --report <Pfad>     Stagingbericht (Standard: .cache/revosax-baseline/2023-11-01/report.json)
  --write             Dateien tatsächlich schreiben (sonst nur Prüfung)
  --limit <n>         nur die ersten n CREATE-Einträge
  --law-id <id>       nur diese lawId (mehrfach möglich)
  --regenerate        MATCH-Einträge, deren Norm ausschließlich aus der Baseline besteht
                      (eine Fassung 2023-11-01 mit R2-Quelle derselben lawId), deterministisch
                      aus dem Staging neu schreiben; Normen mit weiteren Fassungen bleiben unberührt
  --prune-baseline    zusammen mit --regenerate --write: ausschließlich aus der Baseline bestehende
                      Normen entfernen, deren Quelle im Plan nicht mehr CREATE oder MATCH ist
                      (z. B. nach neuer Einordnung als Alias oder Reviewfall)
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
/**
 * Befristung aus data/recht/revosax-sunset-decisions.json anwenden (resolution sunset-applies):
 * das Außerkrafttreten steht im übernommenen Text und gilt in Ostdeutschland fort. Modelliert
 * als expiryDate, validTo der Ausgangsfassung, Status (repealed, sobald das Datum verstrichen
 * ist; sonst in-force mit künftigem Ende) und Historieneintrag mit dem wörtlichen Beleg.
 */
export function applySunsetDecision({ meta, history, version }, sunset, { citation }) {
  if (!sunset || sunset.resolution !== 'sunset-applies') return { meta, history, version };
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(sunset.expiryDate ?? '')) throw new Error(`${meta.slug}: Befristungsentscheidung ohne gültiges expiryDate`);
  if (!['repealed', 'in-force'].includes(sunset.status)) throw new Error(`${meta.slug}: Befristungsentscheidung mit unzulässigem Status ${sunset.status}`);
  if (sunset.expiryDate < version.validFrom) throw new Error(`${meta.slug}: Befristung ${sunset.expiryDate} liegt vor dem Beginn der Ausgangsfassung`);
  const repealed = sunset.status === 'repealed';
  return {
    meta: { ...meta, status: sunset.status, expiryDate: sunset.expiryDate },
    history: {
      ...history,
      entries: [
        ...history.entries,
        {
          date: sunset.expiryDate,
          type: 'repeal',
          title: repealed
            ? 'Außer Kraft getreten durch Befristung im übernommenen Text.'
            : 'Tritt durch Befristung im übernommenen Text außer Kraft.',
          citation,
          affectingVersionId: null,
          note: `Befristung nach ${sunset.basisLocation ?? 'Schlussbestimmung'} der übernommenen Fassung: „${sunset.basis}“ Entscheidung dokumentiert in data/recht/revosax-sunset-decisions.json.`,
        },
      ],
    },
    version: { ...version, validTo: sunset.expiryDate, isCurrent: !repealed },
  };
}

export function buildBaselineRecord({ entry, parsed, slug, objectRecord, baselineDate = BASELINE_DATE, sunset = null }) {
  // Die Anpassung wird immer aus dem unveränderten Parse (original) mit dem aktuellen
  // Adapter berechnet; ein im Staging gespeichertes „adapted“ könnte von einem
  // älteren Adapterstand stammen.
  const { original } = parsed;
  const adapted = adaptParsedRevosaxSnapshot(original);
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
  // Historisches Ursprungsorgan der sächsischen Quelle: Provenienz, kein Erlassorgan
  // der ostdeutschen Norm (originEnactingBody statt enactingBody).
  const originEnactingBody = inferEnactingBody({ category: entry.category, sourceTitle: original.sourceTitle });
  // Erlassdatum: aus der Fassungsseite, ersatzweise aus der amtlichen REVOSax-Trefferliste
  // (Spalte Erlassdatum); nie geschätzt.
  const documentDate = original.documentDate ?? entry.listing?.documentDate ?? null;
  const meta = {
    id: slug,
    slug,
    title,
    shortTitle,
    ...(abbr ? { abbr } : {}),
    shortTitleSource: 'official',
    type: normType,
    ...(originEnactingBody ? { originEnactingBody } : {}),
    subjects: inferSubjects({ sourceTitle: original.sourceTitle, label: entry.listing?.label, category: entry.category }),
    keywords: inferKeywords({ abbr, shortTitle, title }),
    initialCitation: citation,
    predecessor: null,
    successor: null,
    summary: inferSummary({ normType, shortTitle }),
    status: isAmendment ? 'one-time-act' : 'in-force',
    ...(documentDate ? { documentDate } : {}),
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
    changeNote: `Ausgangsfassung zum Rechtsüberleitungsstichtag ${baselineDate}: übernommener Rechtsstand dieses Tages.`,
    sourceReferences: [reference],
    ...(original.sourceNotes?.length ? { sourceNotes: original.sourceNotes } : {}),
    body: adapted.body,
  };

  const sunsetApplied = applySunsetDecision({ meta, history, version }, sunset, { citation });
  // Schema- und Reststellenprüfung vor jedem Schreibvorgang.
  const parsedMeta = parseNormMeta(sunsetApplied.meta, `${slug}/meta.json`);
  const parsedHistory = parseNormHistory(sunsetApplied.history, `${slug}/history.json`);
  const parsedVersion = parseNormVersion(sunsetApplied.version, `${slug}/versions/${baselineDate}.json`);
  const record = validateNormRecord({ meta: parsedMeta, history: parsedHistory, versions: [parsedVersion] }, slug);
  validateVersionIntervals(record);
  checkSummary(meta.summary, context);
  const residuals = auditAdaptedRevosaxSnapshot({ sourceTitle: title, shortTitle, abbr, fullCitation: citation, body: version.body });
  const { originEnactingBody: _origin, sourceReferences: _sources, ...normativeMeta } = meta;
  const metaResiduals = auditAdaptedRevosaxSnapshot({ ...normativeMeta, body: [] })
    .concat(auditAdaptedRevosaxSnapshot({ sourceTitle: version.changeNote, shortTitle: history.entries[0].title, fullCitation: '', body: [] }));
  if (residuals.length > 0 || metaResiduals.length > 0) {
    throw new Error(`${context}: Sachsen-Reststellen: ${[...residuals, ...metaResiduals].slice(0, 3).map((item) => item.path).join(', ')}`);
  }
  return { slug, meta: sunsetApplied.meta, history: sunsetApplied.history, version: sunsetApplied.version };
}

function blockAtPath(body, path) {
  let blocks = body;
  let block = null;
  for (const index of path) {
    block = blocks?.[index] ?? null;
    if (!block) return null;
    blocks = block.children ?? [];
  }
  return block;
}

/**
 * Baut aus einem als „Bestandteil der Vorschrift“ geführten REVOSax-Treffer eine
 * eigene Änderungsvorschrift: Kopfdaten von der Komponentenseite (Titel, eigenes
 * Vollzitat, Trefferliste), Text aus dem zugeordneten Artikel der Mantelvorschrift.
 * Beide amtlichen Seiten sind als R2-Quellen belegt (official-snapshot der
 * Komponente, envelope-snapshot der Mantelvorschrift mit Anker).
 */
/**
 * Normkörper eines Mantelbestandteils. Verweist der Pfad auf einen verschachtelten Block
 * (Absatz eines Folgeänderungsartikels, Nummer eines Paragraphen), bleibt die
 * Vorfahrenkette als Rahmen erhalten – ohne die übrigen Geschwister –, damit die
 * Fundstelle innerhalb der Mantelvorschrift (Artikel 2 Absatz 3) im Text lesbar bleibt.
 */
export function componentBodyAtPath(envelopeBody, path) {
  if (path.length <= 1) return [blockAtPath(envelopeBody, path)];
  let blocks = envelopeBody;
  const chain = [];
  for (const index of path) {
    const block = blocks[index];
    if (!block) throw new Error(`Blockpfad ${JSON.stringify(path)} nicht in der Mantelvorschrift`);
    chain.push(block);
    blocks = block.children ?? [];
  }
  let current = chain.at(-1);
  for (const ancestor of chain.slice(0, -1).reverse()) {
    const { children, text, ...frame } = ancestor;
    current = { ...frame, children: [current] };
  }
  return [current];
}

export function buildEnvelopeComponentRecord({ entry, component, envelopeSource, envelopeBody, slug, containedIn, objectRecords, baselineDate = BASELINE_DATE }) {
  const context = `${entry.sourceId} (${slug})`;
  const componentKey = objectKeyFor(baselineDate, entry.sourceId);
  const componentObject = objectRecords[componentKey];
  const envelopeObject = objectRecords[envelopeSource.objectKey];
  if (!componentObject) throw new Error(`${context}: Komponentenseite ${componentKey} ist nicht im R2-Manifest archiviert`);
  if (componentObject.sha256 !== entry.sourceSha256) throw new Error(`${context}: SHA-256 der Komponentenseite weicht vom Stagingbericht ab`);
  if (!envelopeObject) throw new Error(`${context}: Mantelvorschrift ${envelopeSource.objectKey} ist nicht im R2-Manifest archiviert`);
  if (envelopeObject.sha256 !== envelopeSource.sha256) throw new Error(`${context}: SHA-256 der Mantelvorschrift weicht von der Klassifizierung ab`);
  const block = blockAtPath(envelopeBody, component.articleBlockPath ?? []);
  if (!block) throw new Error(`${context}: Artikelblock ${JSON.stringify(component.articleBlockPath)} nicht in der Mantelvorschrift gefunden`);
  const adapted = adaptParsedRevosaxSnapshot({
    sourceTitle: component.sourceTitle ?? entry.listing?.title ?? '',
    shortTitle: entry.listing?.label ?? component.sourceTitle ?? '',
    fullCitation: component.sourceCitation ?? entry.listing?.citation ?? '',
    body: componentBodyAtPath(envelopeBody, component.articleBlockPath ?? []),
  });
  const title = adapted.sourceTitle;
  const shortTitle = adapted.shortTitle || title;
  const citation = historicalBaselineCitation({
    pageFullCitation: adapted.fullCitation,
    sourceValidTo: null,
    citationValidAt: baselineDate,
    context,
  });
  const validFrom = entry.listing?.validFrom ?? envelopeSource.sourceValidFrom;
  if (!validFrom) throw new Error(`${context}: kein Gültigkeitsbeginn (Trefferliste/Mantelvorschrift)`);
  const componentReference = {
    kind: 'revosax-snapshot',
    label: `Amtliche REVOSax-Vorschriftenseite ${entry.sourceId} (Bestandteil der Vorschrift ${component.envelopeLawId})`,
    availability: 'r2-archived',
    objectKey: componentKey,
    url: entry.sourceUrl,
    retrievedAt: String(entry.retrievedAt).slice(0, 10),
    sha256: entry.sourceSha256,
    lawId: String(entry.revosaxLawId),
    sourceValidFrom: validFrom,
    sourceRole: 'official-snapshot',
    mediaType: 'text/html',
  };
  const envelopeReference = {
    kind: 'revosax-snapshot',
    label: `Mantelvorschrift ${component.envelopeLawId}, ${component.articleLabel} (${component.envelopeTitle})`,
    availability: 'r2-archived',
    objectKey: envelopeSource.objectKey,
    url: `${envelopeSource.url}#${component.anchor}`,
    retrievedAt: String(envelopeSource.retrievedAt).slice(0, 10),
    sha256: envelopeSource.sha256,
    lawId: String(component.envelopeLawId),
    sourceValidFrom: envelopeSource.sourceValidFrom ?? validFrom,
    ...(envelopeSource.sourceValidTo ? { sourceValidTo: envelopeSource.sourceValidTo } : {}),
    sourceRole: 'envelope-snapshot',
    mediaType: 'text/html',
  };
  const originEnactingBody = inferEnactingBody({ category: entry.category, sourceTitle: component.sourceTitle ?? '' });
  const documentDate = entry.listing?.documentDate ?? null;
  const meta = {
    id: slug,
    slug,
    title,
    shortTitle,
    shortTitleSource: 'official',
    type: 'aenderungsvorschrift',
    ...(originEnactingBody ? { originEnactingBody } : {}),
    subjects: inferSubjects({ sourceTitle: component.sourceTitle, label: entry.listing?.label, category: entry.category }),
    keywords: inferKeywords({ abbr: undefined, shortTitle, title }),
    initialCitation: citation,
    predecessor: null,
    successor: null,
    ...(containedIn ? { containedIn } : {}),
    summary: inferSummary({ normType: 'aenderungsvorschrift', shortTitle }),
    status: 'one-time-act',
    ...(documentDate ? { documentDate } : {}),
    effectiveDate: validFrom,
    sourceReferences: [componentReference, envelopeReference],
  };
  const history = {
    initialVersionId: baselineDate,
    entries: [{
      date: baselineDate,
      type: 'initial',
      title: `Vollständige Ausgangsfassung zum Rechtsüberleitungsstichtag (${component.articleLabel} der Mantelvorschrift).`,
      citation,
      affectingVersionId: baselineDate,
    }],
  };
  const version = {
    versionId: baselineDate,
    title,
    shortTitle,
    validFrom: baselineDate,
    validTo: null,
    isCurrent: true,
    citation,
    changeNote: `Ausgangsfassung zum Rechtsüberleitungsstichtag ${baselineDate}: ${component.articleLabel} der Mantelvorschrift ${component.envelopeLawId}, übernommener Rechtsstand dieses Tages.`,
    sourceReferences: [componentReference, envelopeReference],
    body: adapted.body,
  };
  const parsedMeta = parseNormMeta(meta, `${slug}/meta.json`);
  const parsedHistory = parseNormHistory(history, `${slug}/history.json`);
  const parsedVersion = parseNormVersion(version, `${slug}/versions/${baselineDate}.json`);
  const record = validateNormRecord({ meta: parsedMeta, history: parsedHistory, versions: [parsedVersion] }, slug);
  validateVersionIntervals(record);
  checkSummary(meta.summary, context);
  const { originEnactingBody: _origin, sourceReferences: _sources, ...normativeMeta } = meta;
  const residuals = auditAdaptedRevosaxSnapshot({ sourceTitle: title, shortTitle, fullCitation: citation, body: version.body })
    .concat(auditAdaptedRevosaxSnapshot({ ...normativeMeta, body: [] }));
  if (residuals.length > 0) throw new Error(`${context}: Sachsen-Reststellen: ${residuals.slice(0, 3).map((item) => item.path).join(', ')}`);
  return { slug, meta, history, version };
}

/**
 * Eine bestehende Norm darf nur dann aus dem Staging neu geschrieben werden, wenn
 * sie ausschließlich aus der Baseline besteht: genau eine Fassung zum Stichtag mit
 * R2-archivierter REVOSax-Quelle derselben lawId. Alles andere ist geschützt.
 */
function reportEntriesSlug(report, sourceId) {
  return report.entries.find((entry) => entry.sourceId === sourceId)?.proposedSlug ?? null;
}

export async function isRegenerableBaselineNorm(directory, { lawId, baselineDate }) {
  const metaPath = join(directory, 'meta.json');
  if (!(await exists(metaPath))) return { ok: false, reason: 'meta.json fehlt' };
  const meta = await readJson(metaPath);
  const versionFiles = (await readdir(join(directory, 'versions'))).filter((file) => file.endsWith('.json'));
  if (versionFiles.length !== 1 || versionFiles[0] !== `${baselineDate}.json`) {
    return { ok: false, reason: `Norm hat weitere Fassungen (${versionFiles.join(', ')}); geschützt` };
  }
  const version = await readJson(join(directory, 'versions', versionFiles[0]));
  const references = [...(meta.sourceReferences ?? []), ...(version.sourceReferences ?? [])];
  // Eigene Fassungsseite (official-snapshot) derselben lawId; bei Artikeln von
  // Mantelvorschriften zusätzlich die Mantelvorschrift (envelope-snapshot, andere lawId).
  const own = references.filter((reference) => reference.sourceRole !== 'envelope-snapshot');
  const baselineOnly = references.length > 0
    && references.every((reference) => reference.kind === 'revosax-snapshot' && reference.availability === 'r2-archived')
    && own.length > 0
    && own.every((reference) => String(reference.lawId) === String(lawId));
  if (!baselineOnly) {
    return { ok: false, reason: 'Quellenreferenzen sind nicht ausschließlich die R2-Baseline dieser lawId; geschützt' };
  }
  return { ok: true };
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
  const regenerate = args.includes('--regenerate');
  const limit = valueAfter(args, '--limit') ? Number.parseInt(valueAfter(args, '--limit'), 10) : null;
  const lawIds = valuesAfter(args, '--law-id');
  const [plan, report] = await Promise.all([readJson(planPath), readJson(reportPath)]);
  if (plan.baselineDate !== report.baselineDate) throw new Error('Plan und Stagingbericht gehören zu verschiedenen Stichtagen');
  const baselineDate = plan.baselineDate;
  const envelopesPath = resolve(valueAfter(args, '--envelopes') ?? planPath.replace(/materialization-plan\.json$/u, 'envelope-components.json'));
  const envelopes = (await exists(envelopesPath)) ? await readJson(envelopesPath) : null;
  const fetchedEnvelopes = new Map((envelopes?.fetchedEnvelopes ?? []).map((source) => [source.sourceId, source]));
  const r2Manifest = (await exists(R2_MANIFEST_PATH)) ? await readJson(R2_MANIFEST_PATH) : { objects: {} };
  const sunsetDecisions = (await exists(SUNSET_DECISIONS_PATH)) ? await readJson(SUNSET_DECISIONS_PATH) : { decisions: {} };
  // Rechtsakte nach dem Rechtsüberleitungsstichtag: Der Plan führt sie nur dann als CREATE oder
  // MATCH, wenn eine ostdeutsche Änderungsvorschrift sie übernimmt („adopted“) oder der Fall
  // begründet offen bleibt („open“). Hier wird nur geprüft, dass jede Entscheidung zum Plan passt.
  const postCutoffDecisions = (await exists(POST_CUTOFF_DECISIONS_PATH)) ? await readJson(POST_CUTOFF_DECISIONS_PATH) : { decisions: {} };
  for (const [slug, decision] of Object.entries(postCutoffDecisions.decisions ?? {})) {
    if (!POST_CUTOFF_RESOLUTIONS.includes(decision.resolution)) {
      throw new Error(`Entscheidung zu ${slug} nennt keine gültige Auflösung (${decision.resolution ?? '?'})`);
    }
    if (decision.resolution === 'adopted' && !decision.adoptingNorm) {
      throw new Error(`Entscheidung zu ${slug} weist die Quelle als übernommen aus, nennt aber keine ostdeutsche Änderungsvorschrift`);
    }
    if (decision.slug !== slug) throw new Error(`Entscheidung zu ${slug} nennt den abweichenden Slug ${decision.slug}`);
  }
  const postCutoffSkipped = plan.entries.filter((entry) => entry.postCutoffResolution && entry.action === 'SKIP');
  for (const [sourceId, decision] of Object.entries(sunsetDecisions.decisions ?? {})) {
    const planned = plan.entries.find((candidate) => candidate.sourceId === sourceId);
    if (planned && decision.slug && planned.canonicalSlug !== decision.slug && reportEntriesSlug(report, sourceId) !== decision.slug) {
      throw new Error(`Befristungsentscheidung ${sourceId} nennt Slug ${decision.slug}, der Plan ${planned.canonicalSlug}`);
    }
  }
  if (!plan.writable) {
    const message = `${plan.counts.REVIEW - (plan.counts.DEFERRED ?? 0)} offene REVIEW-Fälle im Materialisierungsplan; Schreiben ist blockiert, bis sie über data/recht/revosax-baseline-decisions.json geklärt oder zurückgestellt sind`;
    if (write) throw new Error(message);
    console.error(`Hinweis: ${message}`);
  }

  const reportEntries = new Map(report.entries.map((entry) => [entry.sourceId, entry]));
  let creates = plan.entries.filter((entry) => entry.action === (regenerate ? 'MATCH' : 'CREATE'));
  if (lawIds.length > 0) creates = creates.filter((entry) => lawIds.includes(String(entry.revosaxLawId)));
  if (limit !== null) creates = creates.slice(0, limit);

  const prepared = [];
  const problems = [];
  const skipped = [];
  for (const planned of creates) {
    const entry = reportEntries.get(planned.sourceId);
    try {
      if (!entry) throw new Error(`${planned.sourceId}: fehlt im Stagingbericht`);
      const directory = join(CONTENT_ROOT, planned.canonicalSlug);
      let targetSlug = planned.canonicalSlug;
      let replacesSlug = null;
      if (regenerate) {
        const check = await isRegenerableBaselineNorm(directory, { lawId: entry.revosaxLawId, baselineDate });
        if (!check.ok) {
          skipped.push({ sourceId: planned.sourceId, slug: planned.canonicalSlug, reason: check.reason });
          continue;
        }
        // Der Slug folgt der aktuellen Anpassung; ein aus einem älteren Adapterstand
        // stammender Slug (z. B. aend-saechsverfghg) wird ersetzt, solange die Norm
        // ausschließlich aus der Baseline besteht und der neue Slug frei ist.
        if (entry.proposedSlug && entry.proposedSlug !== planned.canonicalSlug) {
          if (await exists(join(CONTENT_ROOT, entry.proposedSlug))) {
            throw new Error(`${planned.sourceId}: neuer Slug ${entry.proposedSlug} ist bereits belegt; alter Slug ${planned.canonicalSlug} bleibt`);
          }
          targetSlug = entry.proposedSlug;
          replacesSlug = planned.canonicalSlug;
        }
      }
      let record;
      if (planned.envelope) {
        const component = planned.envelope;
        let envelopeSource;
        let envelopeBody;
        if (fetchedEnvelopes.has(component.envelopeSourceId)) {
          const fetched = fetchedEnvelopes.get(component.envelopeSourceId);
          const html = await readFile(resolve(ROOT, fetched.rawCacheFile), 'utf8');
          envelopeBody = parseRevosaxSnapshot(html, { url: fetched.url }).body;
          envelopeSource = { objectKey: fetched.objectKey, sha256: fetched.sha256, url: fetched.url, retrievedAt: fetched.retrievedAt, sourceValidFrom: fetched.sourceValidFrom, sourceValidTo: fetched.sourceValidTo };
        } else {
          const envelopeEntry = reportEntries.get(component.envelopeSourceId);
          if (!envelopeEntry?.parsedCacheFile) throw new Error(`${planned.sourceId}: Mantelvorschrift ${component.envelopeSourceId} nicht im Stagingbericht`);
          envelopeBody = (await readJson(resolve(ROOT, envelopeEntry.parsedCacheFile))).original.body;
          envelopeSource = { objectKey: objectKeyFor(baselineDate, envelopeEntry.sourceId), sha256: envelopeEntry.sourceSha256, url: envelopeEntry.sourceUrl, retrievedAt: envelopeEntry.retrievedAt, sourceValidFrom: envelopeEntry.sourceValidFrom, sourceValidTo: envelopeEntry.sourceValidTo ?? null };
        }
        record = buildEnvelopeComponentRecord({
          entry,
          component,
          envelopeSource,
          envelopeBody,
          slug: targetSlug,
          containedIn: planned.containedIn ?? null,
          objectRecords: r2Manifest.objects ?? {},
          baselineDate,
        });
      } else {
        const parsed = await readJson(resolve(ROOT, entry.parsedCacheFile));
        record = buildBaselineRecord({
          entry,
          parsed,
          slug: targetSlug,
          objectRecord: r2Manifest.objects?.[objectKeyFor(baselineDate, entry.sourceId)],
          baselineDate,
          sunset: sunsetDecisions.decisions?.[entry.sourceId] ?? null,
        });
      }
      if (!regenerate && (await exists(directory))) {
        throw new Error(`${planned.sourceId}: content/normen/${record.slug} existiert bereits; CREATE darf keine bestehende Norm berühren`);
      }
      prepared.push({ ...record, replacesSlug });
    } catch (error) {
      problems.push({ sourceId: planned.sourceId, slug: planned.canonicalSlug, error: error.message });
    }
  }
  if (regenerate) console.log(`${skipped.length} MATCH-Einträge geschützt (nicht ausschließlich Baseline), ${prepared.length} regenerierbar.`);

  // Baseline-Normen, deren Quelle nach neuer Einordnung nicht mehr übernommen wird.
  const pruned = [];
  if (regenerate && args.includes('--prune-baseline')) {
    const keep = new Set(plan.entries.filter((entry) => ['CREATE', 'MATCH'].includes(entry.action)).map((entry) => String(entry.revosaxLawId)));
    for (const name of (await readdir(CONTENT_ROOT, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
      const metaPath = join(CONTENT_ROOT, name, 'meta.json');
      if (!(await exists(metaPath))) continue;
      const meta = await readJson(metaPath);
      const own = (meta.sourceReferences ?? []).find((reference) => reference.kind === 'revosax-snapshot' && reference.sourceRole === 'official-snapshot' && reference.availability === 'r2-archived');
      if (!own || keep.has(String(own.lawId))) continue;
      const check = await isRegenerableBaselineNorm(join(CONTENT_ROOT, name), { lawId: own.lawId, baselineDate });
      if (!check.ok) {
        problems.push({ sourceId: own.lawId, slug: name, error: `nicht mehr übernommen, aber geschützt: ${check.reason}` });
        continue;
      }
      pruned.push({ slug: name, lawId: String(own.lawId), action: plan.entries.find((entry) => String(entry.revosaxLawId) === String(own.lawId))?.action ?? 'unbekannt' });
    }
    console.log(`${pruned.length} Baseline-Normen ohne übernommene Quelle werden entfernt.`);
  }

  const summary = {
    schemaVersion: 1,
    baselineDate,
    generatedAt: new Date().toISOString(),
    plan: planPath.replace(`${ROOT}/`, ''),
    write,
    regenerate,
    planned: plan.counts,
    prepared: prepared.length,
    problems: problems.length,
    protectedCount: skipped.length,
    written: 0,
    entries: prepared.map((record) => ({ slug: record.slug, lawId: record.meta.sourceReferences[0].lawId, type: record.meta.type, ...(record.replacesSlug ? { replacesSlug: record.replacesSlug } : {}) })),
    renamed: prepared.filter((record) => record.replacesSlug).length,
    problemDetails: problems,
    protectedDetails: skipped,
    pruned,
    postCutoff: {
      skipped: postCutoffSkipped.length,
      decisions: Object.values(postCutoffDecisions.decisions ?? {})
        .reduce((acc, decision) => ({ ...acc, [decision.resolution]: (acc[decision.resolution] ?? 0) + 1 }), {}),
    },
  };

  if (problems.length > 0) {
    for (const problem of problems.slice(0, 40)) console.error(`FEHLER ${problem.sourceId}: ${problem.error}`);
    console.error(`${problems.length} von ${creates.length} CREATE-Einträgen sind nicht schreibbar; es wird nichts geschrieben.`);
    process.exitCode = 1;
  } else if (write) {
    for (const entry of pruned) {
      await rm(join(CONTENT_ROOT, entry.slug), { recursive: true, force: true });
      console.log(`entfernt: ${entry.slug} (lawId ${entry.lawId}, jetzt ${entry.action})`);
    }
    for (const record of prepared) {
      const directory = join(CONTENT_ROOT, record.slug);
      if (record.replacesSlug) await rm(join(CONTENT_ROOT, record.replacesSlug), { recursive: true, force: true });
      await writeJson(join(directory, 'meta.json'), record.meta);
      await writeJson(join(directory, 'history.json'), record.history);
      await writeJson(join(directory, 'versions', `${baselineDate}.json`), record.version);
    }
    summary.written = prepared.length;
    console.log(`${prepared.length} Normen nach content/normen ${regenerate ? 'neu ' : ''}geschrieben.`);
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
