#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { applyPatchRecipe, previousIsoDate } from './lib/consolidation-engine.mjs';
import { parseRevosaxSnapshot } from './lib/revosax-parser.mjs';

const ROOT = process.cwd();
const editorialConfig = await readJson(resolve(ROOT, 'src/config/editorial.json'));
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

async function amendmentActText(slug) {
  const versionsDirectory = resolve(ROOT, 'content/normen', slug, 'versions');
  const files = (await readdir(versionsDirectory)).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) throw new Error(`${slug}: gespeicherte Änderungsvorschrift besitzt keine Fassung`);
  return (await Promise.all(files.map((file) => readFile(join(versionsDirectory, file), 'utf8')))).join('\n');
}

async function parseAdoptedSource(slug, source) {
  if (!source.id || !source.versionDate || !source.citation || !source.changeNote) {
    throw new Error(`${slug}: Zusatzquelle benötigt id, versionDate, citation und changeNote`);
  }
  const evidence = source.adoptionEvidence;
  if (!evidence?.amendmentAct || !evidence.sourceProvision || !evidence.text) {
    throw new Error(`${slug}/${source.id}: überprüfbare adoptionEvidence fehlt`);
  }
  const actText = await amendmentActText(evidence.amendmentAct);
  if (!actText.includes(evidence.text)) {
    throw new Error(`${slug}/${source.id}: Adoptionsbeleg stimmt nicht mit ${evidence.amendmentAct} überein`);
  }
  const snapshot = await readFile(resolve(ROOT, source.snapshot), 'utf8');
  const parsed = parseRevosaxSnapshot(snapshot, { url: source.baselineUrl });
  if (parsed.sourceValidFrom !== source.sourceValidFrom || parsed.sourceValidTo !== source.sourceValidTo) {
    throw new Error(`${slug}/${source.id}: Gültigkeitsintervall weicht vom Snapshot ab`);
  }
  if (source.versionDate < parsed.sourceValidFrom ||
      (parsed.sourceValidTo && source.versionDate > parsed.sourceValidTo)) {
    throw new Error(`${slug}/${source.id}: Snapshot galt nicht am angegebenen Versionsdatum`);
  }
  return { source, parsed };
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

function applyEditorialSourceResolutions(slug, parsed, resolutions = []) {
  const body = structuredClone(parsed.body);
  const walk = (blocks, visitor) => {
    for (const block of blocks) {
      visitor(block);
      if (block.children) walk(block.children, visitor);
    }
  };
  for (const resolution of resolutions) {
    if (resolution.operation !== 'relabelProvision') {
      throw new Error(`${slug}: unbekannte redaktionelle Quellenauflösung ${resolution.operation}`);
    }
    const matches = [];
    walk(body, (block) => {
      if (block.type === resolution.target.type &&
          block.label === resolution.target.label &&
          block.title === resolution.target.title) matches.push(block);
    });
    if (matches.length !== 1) {
      throw new Error(`${slug}/${resolution.id}: ${matches.length} statt genau einer Quelleneinheit gefunden`);
    }
    matches[0].label = resolution.resolvedLabel;
  }
  return { ...parsed, body };
}

function publicEditorialResolutions(source) {
  return [...(source.editorialResolutions ?? []), ...(source.editorialSourceResolutions ?? [])]
    .map(({ id, status, decisionDate, issue, publishedText, resolvedApplication, rationale, evidence }) => ({
      id,
      status,
      decisionDate,
      issue,
      publishedText,
      resolvedApplication,
      rationale,
      evidence,
    }));
}

async function consolidate(slug, config) {
  const source = config.targets[slug];
  if (!source?.snapshot || !source.sourceSha256) throw new Error(`${slug}: geprüfter REVOSax-Snapshot fehlt`);
  const snapshot = await readFile(resolve(ROOT, source.snapshot), 'utf8');
  const rawParsed = parseRevosaxSnapshot(snapshot, { url: source.baselineUrl });
  const parsed = applyEditorialSourceResolutions(slug, rawParsed, source.editorialSourceResolutions);
  const baselineCitation = source.baselineCitation ?? parsed.fullCitation;
  const recipes = await Promise.all((await recipeFiles(slug)).map(async (path) => ({
    ...await readJson(path),
    __file: path.replace(`${ROOT}/`, ''),
  })));
  recipes.sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate) ||
    (left.sameDayOrder ?? 0) - (right.sameDayOrder ?? 0) ||
    left.__file.localeCompare(right.__file)
  );
  if (recipes.length === 0) throw new Error(`${slug}: keine redaktionell geprüften Patch-Rezepte vorhanden`);
  const recipeGroups = Object.values(Object.groupBy(recipes, (recipe) => recipe.effectiveDate));
  for (const group of recipeGroups) {
    if (group.length < 2) continue;
    const orders = group.map((recipe) => recipe.sameDayOrder);
    if (orders.some((order) => !Number.isInteger(order)) || new Set(orders).size !== orders.length) {
      throw new Error(
        `${slug}: mehrere Änderungen am ${group[0].effectiveDate} benötigen eindeutige ganzzahlige sameDayOrder-Werte`,
      );
    }
  }

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
      documentDate: source.documentDate ?? parsed.documentDate,
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
  const adoptedSources = await Promise.all(
    (source.adoptedSources ?? [])
      .sort((left, right) => left.versionDate.localeCompare(right.versionDate))
      .map((entry) => parseAdoptedSource(slug, entry)),
  );
  for (const adopted of adoptedSources) {
    if (adopted.source.versionDate <= versions.at(-1).validFrom) {
      throw new Error(`${slug}/${adopted.source.id}: Zusatzquelle liegt nicht nach der vorherigen Fassung`);
    }
    if (recipes[0] && adopted.source.versionDate >= recipes[0].effectiveDate) {
      throw new Error(`${slug}/${adopted.source.id}: Zusatzquelle liegt nicht vor der ersten ostdeutschen Änderung`);
    }
    state = { title: adopted.parsed.sourceTitle, body: adopted.parsed.body };
    versions.push({
      versionId: adopted.source.id,
      validFrom: adopted.source.versionDate,
      validTo: null,
      isCurrent: false,
      citation: adopted.source.citation,
      changeNote: adopted.source.changeNote,
      sourceReferences: [snapshotReference(adopted.source)],
      sourceNotes: adopted.parsed.sourceNotes,
      body: state.body,
    });
    historyEntries.push({
      date: adopted.source.versionDate,
      type: 'notice',
      title: adopted.source.changeNote,
      citation: adopted.source.citation,
      note: `${adopted.source.adoptionEvidence.amendmentAct}, ${adopted.source.adoptionEvidence.sourceProvision}`,
      affectingVersionId: adopted.source.id,
    });
  }
  let repealRecipe = null;

  for (const group of recipeGroups) {
    const effectiveDate = group[0].effectiveDate;
    const versionIds = new Set(group.map((recipe) => recipe.versionId ?? effectiveDate));
    if (versionIds.size !== 1) {
      throw new Error(`${slug}: Änderungen am ${effectiveDate} verweisen auf verschiedene Folgefassungen`);
    }
    const versionId = [...versionIds][0];
    if (group.some((recipe) => recipe.repealsLaw) && group.length !== 1) {
      throw new Error(`${slug}: vollständige Aufhebung am ${effectiveDate} darf nicht mit weiteren Änderungen gruppiert werden`);
    }

    for (const recipe of group) {
      state = applyPatchRecipe(state, recipe);
      if (recipe.repealsLaw) {
        if (!state.repealed) throw new Error(`${slug}: Aufhebungsrezept markiert die Norm nicht als aufgehoben`);
        if (repealRecipe) throw new Error(`${slug}: mehr als eine vollständige Aufhebung konfiguriert`);
        repealRecipe = recipe;
      } else if (repealRecipe) {
        throw new Error(`${slug}: Änderung nach vollständiger Aufhebung ist unzulässig`);
      }
      historyEntries.push({
        date: effectiveDate,
        type: recipe.repealsLaw ? 'repeal' : 'amendment',
        title: recipe.changeNote,
        citation: recipe.amendmentCitation,
        affectingVersionId: recipe.repealsLaw ? null : versionId,
        relatedNorm: recipe.amendmentAct,
      });
    }

    if (!group[0].repealsLaw) {
      versions.push({
        versionId,
        validFrom: effectiveDate,
        validTo: null,
        isCurrent: false,
        citation: group.at(-1).resultCitation,
        changeNote: group.map((recipe) => recipe.changeNote).join(' '),
        sourceReferences: group.flatMap((recipe) => recipe.sourceReferences ?? []),
        body: state.body,
      });
    }
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
    ...(source.resultAbbr ? { abbr: source.resultAbbr } : {}),
    initialCitation: baselineCitation,
    documentDate: source.documentDate ?? parsed.documentDate,
    type: meta.type,
    status: repealRecipe
      ? previousIsoDate(repealRecipe.effectiveDate) <= editorialConfig.referenceDate
        ? 'repealed'
        : 'in-force'
      : meta.status,
    ...(repealRecipe ? { expiryDate: previousIsoDate(repealRecipe.effectiveDate) } : {}),
    affectedByNorms: recipes.map((recipe) => recipe.amendmentAct),
    sourceReferences: [
      snapshotReference(source),
      ...adoptedSources.map(({ source: adoptedSource }) => snapshotReference(adoptedSource)),
      ...recipes.flatMap((recipe) => recipe.sourceReferences ?? []),
    ],
    editorialResolutions: publicEditorialResolutions(source).length
      ? publicEditorialResolutions(source)
      : meta.editorialResolutions,
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
if (target && config.blockedTargets?.[target]) {
  throw new Error(`${target}: Konsolidierung gesperrt – ${config.blockedTargets[target].reason}`);
}
const targets = all
  ? Object.keys(config.targets).filter((slug) => !config.blockedTargets?.[slug])
  : [target];
if (all) {
  const blocked = Object.keys(config.targets).filter((slug) => config.blockedTargets?.[slug]);
  if (blocked.length) console.error(`Gesperrte Ziele übersprungen: ${blocked.join(', ')}`);
}
for (const slug of targets) await consolidate(slug, config);
