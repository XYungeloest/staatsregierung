import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { applyPatchRecipe, patchAssertionsMatch } from './consolidation-engine.mjs';

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function applyMetaPatch(meta, patch, targetSlug) {
  const result = structuredClone(meta);
  for (const [field, instruction] of Object.entries(patch ?? {})) {
    if (result[field] !== instruction.expectedOld && result[field] !== instruction.value) {
      throw new Error(`${targetSlug}: Metadatenfeld ${field} entspricht weder Ausgangs- noch Berichtigungswert`);
    }
    result[field] = instruction.value;
  }
  return result;
}

export async function loadCorrectionBundles(root, correctionSlug = null) {
  const correctionRoot = join(root, 'data/recht/corrections');
  const correctionSlugs = correctionSlug
    ? [correctionSlug]
    : (await readdir(correctionRoot, { withFileTypes: true }).catch(() => []))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
  const bundles = [];
  for (const slug of correctionSlugs) {
    const directory = join(correctionRoot, slug);
    const correctionMeta = JSON.parse(await readFile(join(root, 'content/normen', slug, 'meta.json'), 'utf8'));
    const files = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort();
    for (const file of files) {
      const recipe = JSON.parse(await readFile(join(directory, file), 'utf8'));
      if (recipe.legalEffect !== 'declaratory-correction') {
        throw new Error(`${join(directory, file)}: legalEffect muss declaratory-correction sein`);
      }
      bundles.push({ recipe, correctionMeta, path: join(directory, file) });
    }
  }
  return bundles;
}

export function applyCorrectionToRecord(record, recipe, correctionMeta) {
  const correctedRecord = structuredClone(record);
  const version = correctedRecord.versions.find((entry) => entry.versionId === recipe.targetVersionId);
  if (!version) return { record: correctedRecord, applied: false, alreadyCorrect: false };
  if (version.validFrom !== recipe.effectiveDate) {
    throw new Error(`${recipe.targetSlug}: Berichtigung darf keinen neuen Wirksamkeitszeitpunkt erzeugen`);
  }

  const state = { title: version.title ?? correctedRecord.meta.title, body: version.body };
  const alreadyCorrect = patchAssertionsMatch(state, recipe.resultAssertions);
  if (!alreadyCorrect && !recipe.operations?.length) {
    return { record: correctedRecord, applied: false, alreadyCorrect: false };
  }
  const corrected = alreadyCorrect ? state : applyPatchRecipe(state, recipe);
  if (!patchAssertionsMatch(corrected, recipe.resultAssertions)) {
    throw new Error(`${recipe.targetSlug}: Ergebnisprüfung der Berichtigung fehlgeschlagen`);
  }

  const correctionSources = (correctionMeta.sourceReferences ?? []).map((source) => ({
    ...source,
    kind: source.kind === 'structured-html-transcription' ? 'amendment-source' : source.kind,
    label: `${source.label} – Berichtigung ${recipe.correctionCitation}`,
    sourceRole: source.kind === 'primary-pdf' ? 'visual-control' : 'amendment-evidence',
  }));
  const correctionSourcePaths = new Set(correctionSources.map((source) => source.localSource));
  correctedRecord.meta = applyMetaPatch(correctedRecord.meta, recipe.metaPatch, recipe.targetSlug);
  correctedRecord.meta.affectedByNorms = [...new Set([
    ...(correctedRecord.meta.affectedByNorms ?? []),
    recipe.correctionAct,
  ])];
  correctedRecord.meta.sourceReferences = uniqueBy(
    [
      ...(correctedRecord.meta.sourceReferences ?? []).filter((source) => !correctionSourcePaths.has(source.localSource)),
      ...correctionSources,
    ],
    (source) => `${source.kind}|${source.localSource}`,
  );
  if (recipe.removeEditorialResolutionIds?.length) {
    correctedRecord.meta.editorialResolutions = (correctedRecord.meta.editorialResolutions ?? [])
      .filter((entry) => !recipe.removeEditorialResolutionIds.includes(entry.id));
    if (correctedRecord.meta.editorialResolutions.length === 0) delete correctedRecord.meta.editorialResolutions;
  }

  if (version.title !== undefined || corrected.title !== correctedRecord.meta.title) version.title = corrected.title;
  else delete version.title;
  version.body = corrected.body;
  version.sourceReferences = uniqueBy(
    [
      ...(version.sourceReferences ?? []).filter((source) => !correctionSourcePaths.has(source.localSource)),
      ...correctionSources,
    ],
    (source) => `${source.kind}|${source.localSource}`,
  );
  version.sourceNotes = uniqueBy([
    ...(version.sourceNotes ?? []),
    {
      label: 'Amtliche Berichtigung',
      text: `${recipe.correctionCitation}: ${recipe.changeNote} Die Gültigkeit dieser Fassung beginnt unverändert am ${version.validFrom}.`,
    },
  ], (note) => `${note.label}|${note.text}`);

  const notice = {
    date: recipe.correctionPublicationDate,
    type: 'notice',
    title: recipe.changeNote,
    citation: recipe.correctionCitation,
    note: 'Deklaratorische Berichtigung der Verkündungsfassung; kein materieller Fassungswechsel.',
    affectingVersionId: recipe.targetVersionId,
    relatedNorm: recipe.correctionAct,
  };
  correctedRecord.history.entries = uniqueBy(
    [...correctedRecord.history.entries, notice],
    (entry) => JSON.stringify([
      entry.date,
      entry.type,
      entry.title,
      entry.citation,
      entry.affectingVersionId,
      entry.relatedNorm,
    ]),
  ).sort((left, right) => left.date.localeCompare(right.date));

  return { record: correctedRecord, applied: true, alreadyCorrect };
}

export function applyCorrectionsToRecord(record, bundles) {
  let corrected = structuredClone(record);
  const applied = [];
  for (const bundle of bundles.filter(({ recipe }) => recipe.targetSlug === corrected.meta.slug)) {
    const result = applyCorrectionToRecord(corrected, bundle.recipe, bundle.correctionMeta);
    corrected = result.record;
    if (result.applied) applied.push({ ...bundle, alreadyCorrect: result.alreadyCorrect });
  }
  return { record: corrected, applied };
}
