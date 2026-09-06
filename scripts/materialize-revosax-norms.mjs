#!/usr/bin/env node --experimental-strip-types

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { historicalBaselineCitation } from './lib/revosax-citation.mjs';
import { abbreviationProblem, isAbbreviationLikeLabel } from './lib/norm-title-rules.mjs';
import { inferSubjectAssignment } from './lib/revosax-metadata.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const write = args.includes('--write');
const all = args.includes('--all');
const updateExisting = args.includes('--update-existing');
const targetIndex = args.indexOf('--target');
const target = targetIndex >= 0 ? args[targetIndex + 1] : null;

if ((all ? 1 : 0) + (target ? 1 : 0) !== 1) {
  throw new Error('Genau eines von --all oder --target <slug> ist erforderlich.');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sourceReference(source) {
  return {
    kind: 'revosax-snapshot',
    label: source.sourceValidTo
      ? `Amtliche REVOSax-Fassung, gültig ${source.sourceValidFrom} bis ${source.sourceValidTo}`
      : `Amtliche REVOSax-Fassung, gültig ab ${source.sourceValidFrom}`,
    availability: 'versioned',
    localSource: source.snapshot,
    url: source.baselineUrl,
    retrievedAt: source.retrievedAt,
    sha256: source.sourceSha256,
    lawId: source.revosaxLawId,
    sourceValidFrom: source.sourceValidFrom,
    ...(source.sourceValidTo ? { sourceValidTo: source.sourceValidTo } : {}),
    sourceRole: 'official-snapshot',
  };
}

function inferType(title) {
  if (/\b(?:Verwaltungsvorschrift|VwV|Anweisung)\b/iu.test(title)) return 'verwaltungsvorschrift';
  if (/\bVerordnung\b/iu.test(title)) return 'verordnung';
  return 'gesetz';
}

function inferEnactingBody(title, type) {
  if (type === 'gesetz') return 'Sächsischer Landtag';
  if (/Staatsministerium(?:s)?\s+(?:des\s+Innern|für\s+Inneres)/iu.test(title)) return 'Sächsisches Staatsministerium des Innern';
  if (/Staatsministerium(?:s)?\s+(?:der\s+Finanzen|für\s+Finanzen)/iu.test(title)) return 'Sächsisches Staatsministerium der Finanzen';
  if (/Staatsministerium(?:s)?\s+für\s+Kultus/iu.test(title) || /\b(?:Schule|Stundentafel)\b/iu.test(title)) {
    return 'Sächsisches Staatsministerium für Kultus';
  }
  return 'Sächsische Staatsregierung';
}

function inferSummary(title) {
  const subject = title.match(/\b(?:über|zur|zum)\s+(.+)$/iu)?.[1]?.replace(/\.$/u, '');
  if (subject) return `Regelt ${subject.charAt(0).toLocaleLowerCase('de')}${subject.slice(1)}.`;
  return `Enthält die Regelungen der amtlichen Ausgangsfassung „${title}“.`;
}

/**
 * Titelmodell (scripts/lib/norm-title-rules.mjs): Kurzbezeichnung nur, wenn sie sich vom Titel
 * unterscheidet und keine Abkürzungsform ist; Abkürzung nur, wenn sie die gemeinsame Regel besteht.
 */
function identityFields(parsed, configured, title) {
  const candidate = (configured.resultShortTitle ?? parsed.shortTitle ?? '').trim();
  const shortTitle = candidate && candidate !== title && !isAbbreviationLikeLabel(candidate)
    ? candidate
    : undefined;
  const candidateAbbr = configured.resultAbbr ?? parsed.abbr;
  const abbr = abbreviationProblem(candidateAbbr, { title, shortTitle }) === null ? candidateAbbr : undefined;
  return { shortTitle, abbr };
}

function inferredMeta(parsed, configured, slug, initialCitation) {
  const title = configured.title ?? parsed.sourceTitle;
  const type = configured.createMeta?.type ?? inferType(parsed.sourceTitle);
  const { shortTitle, abbr } = identityFields(parsed, configured, title);
  // Sachgebiete nach der amtlichen Systematik: Fundstellennummer der Quellseite,
  // sonst die gemeinsame Ableitungskette aus scripts/lib/revosax-metadata.mjs.
  const assignment = inferSubjectAssignment({
    fsnNumber: parsed.fsnNumber,
    normType: type,
    sourceTitle: parsed.sourceTitle,
    label: parsed.shortTitle,
    legacySubjects: configured.createMeta?.subjects ?? [],
  });
  return {
    id: slug,
    slug,
    title,
    ...(shortTitle ? { shortTitle } : {}),
    ...(abbr ? { abbr } : {}),
    ...(shortTitle ? { shortTitleSource: 'official' } : {}),
    type,
    enactingBody: configured.createMeta?.enactingBody ?? inferEnactingBody(parsed.sourceTitle, type),
    ...(configured.createMeta?.responsibleMinistry ? { responsibleMinistry: configured.createMeta.responsibleMinistry } : {}),
    subjects: assignment.subjects,
    primarySubject: assignment.primarySubject,
    ...(type === 'foerderrichtlinie' && assignment.fundingArea ? { fundingArea: assignment.fundingArea } : {}),
    keywords: [...new Set([
      ...(configured.createMeta?.keywords ?? []),
      abbr,
      shortTitle,
      // Die Kurzbezeichnung der Quelle bleibt auch dann auffindbar, wenn sie als
      // Abkürzungsform nicht in shortTitle gehört.
      parsed.shortTitle,
      ...parsed.sourceTitle.split(/[^\p{L}\d]+/u).filter((word) => word.length >= 5),
    ].filter(Boolean))].slice(0, 16),
    initialCitation,
    predecessor: null,
    successor: null,
    summary: configured.createMeta?.summary ?? inferSummary(parsed.sourceTitle),
    // Ohne redaktionelle Kurzbeschreibung bleibt nur die aus dem Titel gebildete Formel;
    // sie wird gekennzeichnet und öffentlich nicht ausgespielt.
    ...(configured.createMeta?.summary ? {} : { summarySource: 'derived' }),
    status: 'in-force',
    ...((configured.documentDate ?? parsed.documentDate)
      ? { documentDate: configured.documentDate ?? parsed.documentDate }
      : {}),
    ...(configured.createMeta?.effectiveDate ? { effectiveDate: configured.createMeta.effectiveDate } : {}),
  };
}

async function sourceFor(slug, configured, config) {
  if (configured.snapshot) {
    return {
      source: configured,
      parsedPath: resolve(ROOT, `data/recht/parsed/revosax/${slug}.json`),
      versionId: configured.baselineSnapshotDate ?? config.baselineSnapshotDate,
      historyTitle: 'Vollständige Ausgangsfassung zum verbindlichen Stichtag.',
      changeNote: `Ausgangsfassung nach dem am ${configured.baselineSnapshotDate ?? config.baselineSnapshotDate} geltenden sächsischen Rechtsstand.`,
    };
  }
  const adopted = [...(configured.adoptedSources ?? [])].sort((left, right) => left.versionDate.localeCompare(right.versionDate))[0];
  if (!adopted?.snapshot) throw new Error(`${slug}: weder Ausgangssnapshot noch ausdrückliche spätere Adoptionsquelle vorhanden`);
  return {
    source: adopted,
    parsedPath: resolve(ROOT, `data/recht/parsed/revosax/${slug}--${adopted.id}.json`),
    versionId: adopted.versionDate,
    historyTitle: adopted.changeNote,
    changeNote: adopted.changeNote,
  };
}

async function materialize(slug, configured, config) {
  const normDirectory = resolve(ROOT, 'content/normen', slug);
  const seed = await sourceFor(slug, configured, config);
  const parsed = await readJson(seed.parsedPath);
  if (parsed.sourceValidFrom !== seed.source.sourceValidFrom || parsed.sourceValidTo !== seed.source.sourceValidTo) {
    throw new Error(`${slug}: geparstes Gültigkeitsintervall weicht von der Quellenkonfiguration ab`);
  }
  const citation = historicalBaselineCitation({
    pageFullCitation: parsed.pageFullCitation ?? parsed.fullCitation,
    sourceValidTo: seed.source.sourceValidTo,
    baselineCitation: configured.baselineCitation,
    sourceCitation: seed.source.citation,
    context: slug,
  });
  const reference = sourceReference(seed.source);
  let existingMeta = null;
  let existingHistory = null;
  let existingVersion = null;
  try {
    const metaPath = join(normDirectory, 'meta.json');
    await access(metaPath);
    existingMeta = await readJson(metaPath);
    const normalizedMeta = structuredClone(existingMeta);
    for (const field of ['documentDate', 'publicationDate', 'effectiveDate', 'expiryDate']) {
      if (normalizedMeta[field] === null) delete normalizedMeta[field];
    }
    if (!updateExisting && JSON.stringify(normalizedMeta) !== JSON.stringify(existingMeta)) {
      console.log(`${slug}: unzulässige null-Datumsfelder im materialisierten Stammnormdatensatz bereinigt`);
      if (write) await writeJson(metaPath, normalizedMeta);
    } else if (!updateExisting) {
      console.log(`${slug}: Stammnormdatensatz bereits vorhanden`);
    }
    if (!updateExisting) return 'existing';
    [existingHistory, existingVersion] = await Promise.all([
      readJson(join(normDirectory, 'history.json')),
      readJson(join(normDirectory, 'versions', `${seed.versionId}.json`)),
    ]);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const inferred = inferredMeta(parsed, configured, slug, citation);
  const retainedMetaReferences = (existingMeta?.sourceReferences ?? [])
    .filter((entry) => entry.kind !== 'revosax-snapshot');
  const meta = existingMeta ? {
    ...existingMeta,
    initialCitation: citation,
    sourceReferences: [reference, ...retainedMetaReferences],
  } : {
    ...inferred,
    sourceReferences: [reference],
  };
  for (const field of ['documentDate', 'publicationDate', 'effectiveDate', 'expiryDate']) {
    if (meta[field] === null) delete meta[field];
  }
  const initialEntry = {
    date: seed.versionId,
    type: 'initial',
    title: seed.historyTitle,
    citation,
    affectingVersionId: seed.versionId,
  };
  const history = existingHistory ? {
    ...existingHistory,
    initialVersionId: seed.versionId,
    entries: [
      initialEntry,
      ...(existingHistory.entries ?? []).filter((entry) =>
        entry.type !== 'initial' && entry.affectingVersionId !== seed.versionId),
    ],
  } : {
    initialVersionId: seed.versionId,
    entries: [initialEntry],
  };
  // Die Fassung spiegelt die Bezeichnungen der Norm (Titelmodell: shortTitle und abbr optional).
  const versionIdentity = identityFields(parsed, configured, meta.title);
  const version = {
    versionId: seed.versionId,
    title: meta.title,
    ...(meta.shortTitle ?? versionIdentity.shortTitle ? { shortTitle: meta.shortTitle ?? versionIdentity.shortTitle } : {}),
    ...(meta.abbr ?? versionIdentity.abbr ? { abbr: meta.abbr ?? versionIdentity.abbr } : {}),
    validFrom: seed.versionId,
    validTo: existingVersion?.validTo ?? null,
    isCurrent: existingVersion?.isCurrent ?? true,
    citation,
    changeNote: seed.changeNote,
    sourceReferences: [reference],
    sourceNotes: parsed.sourceNotes,
    body: parsed.body,
  };
  const action = existingMeta ? 'regeneriert' : 'materialisiert';
  console.log(`${slug}: ${parsed.body.length} äußere Blöcke aus ${seed.parsedPath.replace(`${ROOT}/`, '')} ${action}`);
  if (!write) return existingMeta ? 'would-update' : 'would-create';
  await Promise.all([
    writeJson(join(normDirectory, 'meta.json'), meta),
    writeJson(join(normDirectory, 'history.json'), history),
    writeJson(join(normDirectory, 'versions', `${seed.versionId}.json`), version),
  ]);
  return existingMeta ? 'updated' : 'created';
}

const [config, manifest] = await Promise.all([
  readJson(resolve(ROOT, 'data/recht/consolidation-sources.json')),
  readJson(resolve(ROOT, 'data/recht/consolidation-manifest.json')),
]);
const openSlugs = manifest.targets
  .filter((entry) => entry.status === 'missing-stem-record')
  .map((entry) => entry.canonicalSlug);
const regenerableSlugs = [];
for (const [slug, configured] of Object.entries(config.targets)) {
  const hasRevosaxSource =
    (configured.snapshot && (!configured.sourceFormat || configured.sourceFormat === 'revosax-html')) ||
    configured.adoptedSources?.some((entry) => entry.snapshot && (!entry.sourceFormat || entry.sourceFormat === 'revosax-html'));
  if (!hasRevosaxSource) continue;
  regenerableSlugs.push(slug);
}
regenerableSlugs.sort();
const slugs = all ? (updateExisting ? regenerableSlugs : openSlugs) : [target];
for (const slug of slugs) {
  const configured = config.targets[slug];
  if (!configured) throw new Error(`${slug}: Quellenkonfiguration fehlt`);
  await materialize(slug, configured, config);
}
console.log(`${slugs.length} REVOSax-Zielnormen geprüft${write ? ` und ${updateExisting ? 'regeneriert' : 'materialisiert'}` : ''}.`);
