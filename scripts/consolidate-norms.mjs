#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { applyPatchRecipe, previousIsoDate } from './lib/consolidation-engine.mjs';
import { parseRevosaxSnapshot } from './lib/revosax-parser.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = valueAfter('--target');
const all = args.includes('--all');
const write = args.includes('--write');
if ((target ? 1 : 0) + (all ? 1 : 0) !== 1) {
  throw new Error('Genau eines von --target <slug> oder --all ist erforderlich.');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function recipeFiles(slug) {
  const directory = resolve(ROOT, 'data/recht/amendments');
  const files = [];
  for (const act of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (!act.isDirectory()) continue;
    const candidate = join(directory, act.name, `${slug}.json`);
    try {
      await readFile(candidate);
      files.push(candidate);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return files;
}

function snapshotReference(source) {
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
  };
}

async function consolidate(slug, config) {
  const source = config.targets[slug];
  if (!source?.snapshot || !source.sourceSha256) throw new Error(`${slug}: geprüfter REVOSax-Snapshot fehlt`);
  const snapshot = await readFile(resolve(ROOT, source.snapshot), 'utf8');
  const parsed = parseRevosaxSnapshot(snapshot, { url: source.baselineUrl });
  const baselineCitation = source.baselineCitation ?? parsed.fullCitation;
  const recipes = await Promise.all((await recipeFiles(slug)).map(readJson));
  recipes.sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  if (recipes.length === 0) throw new Error(`${slug}: keine redaktionell geprüften Patch-Rezepte vorhanden`);

  const normDirectory = resolve(ROOT, 'content/normen', slug);
  let meta;
  let existingHistory;
  try {
    [meta, existingHistory] = await Promise.all([
      readJson(join(normDirectory, 'meta.json')),
      readJson(join(normDirectory, 'history.json')),
    ]);
  } catch (error) {
    if (error.code !== 'ENOENT' || !source.createMeta) throw error;
    meta = {
      id: slug,
      slug,
      title: parsed.sourceTitle,
      shortTitle: parsed.shortTitle,
      ...(parsed.abbr ? { abbr: parsed.abbr } : {}),
      shortTitleSource: 'official',
      ...source.createMeta,
      keywords: [...new Set([...(source.createMeta.keywords ?? []), parsed.sourceTitle, parsed.abbr].filter(Boolean))],
      initialCitation: baselineCitation,
      predecessor: null,
      successor: null,
      status: 'in-force',
      documentDate: parsed.documentDate,
      ...(source.createMeta.effectiveDate ? { effectiveDate: source.createMeta.effectiveDate } : {}),
      sourceReferences: [snapshotReference(source)],
    };
    existingHistory = { initialVersionId: null, entries: [] };
  }
  let state = { title: parsed.sourceTitle, body: parsed.body };
  const versions = [{
    versionId: config.baselineSnapshotDate,
    validFrom: config.baselineSnapshotDate,
    validTo: null,
    isCurrent: false,
    citation: baselineCitation,
    changeNote: `Ausgangsfassung nach dem am ${config.baselineSnapshotDate} geltenden sächsischen Rechtsstand.`,
    sourceReferences: [snapshotReference(source)],
    sourceNotes: parsed.sourceNotes,
    body: state.body,
  }];
  const historyEntries = [{
    date: config.baselineSnapshotDate,
    type: 'initial',
    title: 'Vollständige Ausgangsfassung zum verbindlichen Stichtag.',
    citation: baselineCitation,
    affectingVersionId: config.baselineSnapshotDate,
  }];
  let repealRecipe = null;

  for (const recipe of recipes) {
    state = applyPatchRecipe(state, recipe);
    if (recipe.repealsLaw) {
      if (!state.repealed) throw new Error(`${slug}: Aufhebungsrezept markiert die Norm nicht als aufgehoben`);
      if (repealRecipe) throw new Error(`${slug}: mehr als eine vollständige Aufhebung konfiguriert`);
      repealRecipe = recipe;
    } else {
      if (repealRecipe) throw new Error(`${slug}: Änderung nach vollständiger Aufhebung ist unzulässig`);
      versions.push({
        versionId: recipe.versionId ?? recipe.effectiveDate,
        validFrom: recipe.effectiveDate,
        validTo: null,
        isCurrent: false,
        citation: recipe.resultCitation,
        changeNote: recipe.changeNote,
        sourceReferences: recipe.sourceReferences,
        body: state.body,
      });
    }
    historyEntries.push({
      date: recipe.effectiveDate,
      type: recipe.repealsLaw ? 'repeal' : 'amendment',
      title: recipe.changeNote,
      citation: recipe.amendmentCitation,
      affectingVersionId: recipe.repealsLaw ? null : (recipe.versionId ?? recipe.effectiveDate),
      relatedNorm: recipe.amendmentAct,
    });
  }
  versions.forEach((version, index) => {
    const next = versions[index + 1];
    version.validTo = next
      ? previousIsoDate(next.validFrom)
      : repealRecipe
        ? previousIsoDate(repealRecipe.effectiveDate)
        : null;
    version.isCurrent = !next && !repealRecipe;
  });

  const updatedMeta = {
    ...meta,
    title: state.title,
    ...(source.resultShortTitle ? { shortTitle: source.resultShortTitle } : {}),
    initialCitation: baselineCitation,
    documentDate: parsed.documentDate,
    type: meta.type,
    status: repealRecipe ? 'repealed' : meta.status,
    ...(repealRecipe ? { expiryDate: previousIsoDate(repealRecipe.effectiveDate) } : {}),
    affectedByNorms: recipes.map((recipe) => recipe.amendmentAct),
    sourceReferences: [
      snapshotReference(source),
      ...recipes.flatMap((recipe) => recipe.sourceReferences ?? []),
    ],
  };
  const history = {
    ...existingHistory,
    initialVersionId: config.baselineSnapshotDate,
    entries: [
      ...existingHistory.entries.filter((entry) =>
        entry.type !== 'initial' && !recipes.some((recipe) => recipe.amendmentAct === entry.relatedNorm)
      ),
      ...historyEntries,
    ].sort((left, right) => left.date.localeCompare(right.date)),
  };

  const affectedActs = [];
  for (const recipe of recipes) {
    const actPath = resolve(ROOT, 'content/normen', recipe.amendmentAct, 'meta.json');
    const act = await readJson(actPath);
    affectedActs.push({
      path: actPath,
      value: {
        ...act,
        type: 'aenderungsvorschrift',
        affectedNorms: [...new Set([...(act.affectedNorms ?? []), slug])],
      },
    });
  }

  console.log(`${slug}: ${versions.length} vollständige Fassungen (${versions.map((version) => version.validFrom).join(', ')})`);
  if (!write) {
    console.error('Prüflauf: Schreiben erfordert --write.');
    return;
  }
  await Promise.all([
    writeJson(join(normDirectory, 'meta.json'), updatedMeta),
    writeJson(join(normDirectory, 'history.json'), history),
    ...versions.map((version) => writeJson(join(normDirectory, 'versions', `${version.versionId}.json`), version)),
    ...affectedActs.map(({ path, value }) => writeJson(path, value)),
  ]);
}

const config = await readJson(resolve(ROOT, 'data/recht/consolidation-sources.json'));
const targets = all ? Object.keys(config.targets) : [target];
for (const slug of targets) await consolidate(slug, config);
