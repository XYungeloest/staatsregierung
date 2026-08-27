#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { applyCorrectionToRecord, loadCorrectionBundles } from './lib/correction-engine.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const write = args.includes('--write');
const all = args.includes('--all');
const correctionIndex = args.indexOf('--correction');
const correction = correctionIndex >= 0 ? args[correctionIndex + 1] : null;

if ((all ? 1 : 0) + (correction ? 1 : 0) !== 1) {
  throw new Error('Genau eines von --all oder --correction <slug> ist erforderlich.');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function applyRecipe({ recipe, correctionMeta, path }) {
  const correctionDirectory = resolve(ROOT, 'content/normen', recipe.correctionAct);
  const targetDirectory = resolve(ROOT, 'content/normen', recipe.targetSlug);
  const [targetMeta, targetHistory, targetVersion] = await Promise.all([
    readJson(join(targetDirectory, 'meta.json')),
    readJson(join(targetDirectory, 'history.json')),
    readJson(join(targetDirectory, 'versions', `${recipe.targetVersionId}.json`)),
  ]);
  const result = applyCorrectionToRecord({
    meta: targetMeta,
    history: targetHistory,
    versions: [targetVersion],
  }, recipe, correctionMeta);
  if (!result.applied) {
    throw new Error(`${recipe.targetSlug}: Berichtigungswert fehlt und es sind keine anwendbaren Patch-Operationen hinterlegt`);
  }
  const [updatedVersion] = result.record.versions;
  const updatedCorrectionMeta = {
    ...correctionMeta,
    affectedNorms: [...new Set([...(correctionMeta.affectedNorms ?? []), recipe.targetSlug])],
  };

  console.log(`${recipe.targetSlug}/${recipe.targetVersionId}: ${result.alreadyCorrect ? 'Wortlaut bereits richtig; Provenienz ergänzt' : 'Wortlaut berichtigt'} (${path.replace(`${ROOT}/`, '')})`);
  if (!write) return;
  await Promise.all([
    writeJson(join(targetDirectory, 'meta.json'), result.record.meta),
    writeJson(join(targetDirectory, 'history.json'), result.record.history),
    writeJson(join(targetDirectory, 'versions', `${recipe.targetVersionId}.json`), updatedVersion),
    writeJson(join(correctionDirectory, 'meta.json'), updatedCorrectionMeta),
  ]);
}

const bundles = await loadCorrectionBundles(ROOT, all ? null : correction);
for (const bundle of bundles) await applyRecipe(bundle);
