#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { adaptSaxonText } from './lib/revosax-ost-adapter.mjs';
import { resolveRepositoryRoot } from '../packages/shared/src/lib/repository-root.ts';

/**
 * Schärft die abgeleiteten Metadaten des REVOSax-Ausgangsbestands nach.
 *
 * Der Massenimport hatte zwei Felder ohne Quelle gefüllt:
 *
 *   `summary`  – zwei Formeln („Enthält die Regelungen der am 1. November 2023 übernommenen
 *                Ausgangsfassung …“, „Übernommene Änderungsvorschrift des Rechtsbestands …“).
 *                Sie beschreiben keinen Regelungsgegenstand, sondern wiederholen den Titel; die
 *                Oberfläche spielt sie nach `DESIGN.md` ohnehin nirgends aus
 *                (`getPublicNormSummary`). Sie werden entfernt: eine leere Zeile ist ehrlicher als
 *                eine Formel, die wie eine Kurzfassung aussieht. Redaktionell geprüfte
 *                Kurzfassungen (`summarySource` fehlt oder ist nicht „derived“) bleiben unberührt.
 *
 *   `keywords` – jedes Titelwort ab fünf Zeichen. Titel, Kurztitel und Abkürzung stehen im
 *                Volltextindex bereits als eigene Spalten (`law_search`), Titelwörter waren dort
 *                also doppelt; als Nutzerbegriffe taugen „Erste“, „Oberbergamtes“ oder
 *                „Baubeschränkungsgebieten“ nicht. Übrig bleibt die amtliche Bezeichnung der
 *                REVOSax-Trefferliste, soweit sie sich von Titel, Kurztitel und Abkürzung
 *                unterscheidet — eine belegte Zweitbezeichnung, unter der die Vorschrift amtlich
 *                geführt wird. Die Bürgerbegriffe stehen weiterhin allein im redaktionellen
 *                Stichwortregister (`content/stichwortregister.json`).
 *
 * Ohne `--write` schreibt das Werkzeug nichts und meldet nur den Bestand.
 *
 *   node scripts/refine-revosax-derived-metadata.mjs [--write] [--review <Datei>]
 */

const ROOT = resolveRepositoryRoot();
const NORMS_DIR = join(ROOT, 'content', 'normen');
const MANIFEST = join(ROOT, 'data', 'recht', 'revosax-baseline-2023-11-01.json');
const DEFAULT_REVIEW = join(ROOT, 'data', 'recht', 'norm-summary-review.json');

const DERIVED_SUMMARY_PATTERNS = [
  /^Enthält die Regelungen der am .+ übernommenen Ausgangsfassung/u,
  /^Übernommene Änderungsvorschrift des Rechtsbestands/u,
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Amtliche Bezeichnung der Trefferliste je REVOSax-Vorschrift, in der Ostfassung. */
function loadOfficialLabels() {
  const labels = new Map();
  for (const hit of readJson(MANIFEST).hits) {
    if (!hit.lawId || !hit.label) continue;
    labels.set(String(hit.lawId), adaptSaxonText(hit.label).trim());
  }
  return labels;
}

/** REVOSax-Kennungen einer Norm aus ihren Quellenangaben. */
function lawIdsOf(meta) {
  return (meta.sourceReferences ?? [])
    .map((reference) => (typeof reference?.lawId === 'string' ? reference.lawId : ''))
    .filter(Boolean);
}

/**
 * Zweitbezeichnungen einer Norm: die amtliche Bezeichnung der Trefferliste, sonst – wenn das
 * Manifest sie nicht führt – die vorhandene mehrteilige Bezeichnung aus den alten Schlagwörtern.
 * Einzelne Titelwörter (ein Wort ohne Punkt) zählen nicht als Bezeichnung.
 */
function designationsOf(meta, labels) {
  const names = new Set(
    [meta.title, meta.shortTitle, meta.abbr]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean),
  );
  const candidates = [];
  for (const lawId of lawIdsOf(meta)) {
    const label = labels.get(lawId);
    if (label) candidates.push(label);
  }
  if (candidates.length === 0) {
    for (const keyword of meta.keywords ?? []) {
      const value = String(keyword).trim();
      if (/[\s.]/u.test(value)) candidates.push(value);
    }
  }
  const seen = new Set();
  return candidates.filter((value) => {
    if (!value || names.has(value) || seen.has(value)) return false;
    // Sächsische Restbezeichnungen sind keine Schlagwörter des ostdeutschen Bestands.
    if (/(?:^|\s)(?:Sächs|Sachsen)/u.test(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * Fassungsspezifische Bezeichnungen: trägt eine gespeicherte Fassung eine eigene Abkürzung oder
 * Kurzbezeichnung, bleibt sie als Zweitbezeichnung auffindbar (Regel in
 * scripts/audit-norm-metadata.mjs).
 */
function versionDesignationsOf(slug, meta) {
  const names = new Set(
    [meta.title, meta.shortTitle, meta.abbr]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean),
  );
  const found = [];
  const dir = join(NORMS_DIR, slug, 'versions');
  let files = [];
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return found;
  }
  for (const file of files) {
    const version = readJson(join(dir, file));
    for (const value of [version.abbr, version.shortTitle]) {
      const designation = typeof value === 'string' ? value.trim() : '';
      if (designation && !names.has(designation) && !found.includes(designation)) found.push(designation);
    }
  }
  return found;
}

async function main() {
  const write = process.argv.includes('--write');
  const reviewIndex = process.argv.indexOf('--review');
  const reviewPath = reviewIndex >= 0 ? process.argv[reviewIndex + 1] : DEFAULT_REVIEW;
  const labels = loadOfficialLabels();

  const slugs = (await readdir(NORMS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const stats = {
    norms: slugs.length,
    derivedSummaries: 0,
    removedSummaries: 0,
    keptEditorialSummaries: 0,
    keywordsBefore: 0,
    keywordsAfter: 0,
    designationFromManifest: 0,
    designationFromKeywords: 0,
    withoutDesignation: 0,
    changedFiles: 0,
  };
  const review = [];

  for (const slug of slugs) {
    const path = join(NORMS_DIR, slug, 'meta.json');
    const meta = readJson(path);
    const before = JSON.stringify(meta);
    const derived = meta.summarySource === 'derived'
      || DERIVED_SUMMARY_PATTERNS.some((pattern) => pattern.test(String(meta.summary ?? '')));

    stats.keywordsBefore += (meta.keywords ?? []).length;

    if (!derived) {
      if (String(meta.summary ?? '').trim()) stats.keptEditorialSummaries += 1;
      else review.push({ slug, type: meta.type, primarySubject: meta.primarySubject ?? null, reason: 'ohne Kurzfassung' });
      stats.keywordsAfter += (meta.keywords ?? []).length;
      continue;
    }

    stats.derivedSummaries += 1;
    delete meta.summary;
    delete meta.summarySource;
    stats.removedSummaries += 1;

    const fromManifest = lawIdsOf(meta).some((lawId) => labels.has(lawId));
    const designations = [...designationsOf(meta, labels), ...versionDesignationsOf(slug, meta)];
    if (designations.length === 0) stats.withoutDesignation += 1;
    else if (fromManifest) stats.designationFromManifest += 1;
    else stats.designationFromKeywords += 1;
    meta.keywords = designations;
    stats.keywordsAfter += designations.length;

    review.push({
      slug,
      type: meta.type,
      primarySubject: meta.primarySubject ?? null,
      reason: 'Kurzfassung des Massenimports entfernt',
    });

    const after = JSON.stringify(meta);
    if (after !== before) {
      stats.changedFiles += 1;
      if (write) writeFileSync(path, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    }
  }

  const reviewFile = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    what: 'Vorschriften ohne redaktionell geprüfte Kurzfassung. Die Oberfläche zeigt dort keine Beschreibung; die Liste ist der Arbeitsvorrat der Redaktion.',
    total: review.length,
    byType: review.reduce((counts, entry) => ({ ...counts, [entry.type]: (counts[entry.type] ?? 0) + 1 }), {}),
    entries: review,
  };
  if (write) writeFileSync(reviewPath, `${JSON.stringify(reviewFile, null, 2)}\n`, 'utf8');

  console.log(`Normen: ${stats.norms}`);
  console.log(`Kurzfassungen des Massenimports: ${stats.derivedSummaries} (entfernt: ${stats.removedSummaries})`);
  console.log(`redaktionell geprüfte Kurzfassungen: ${stats.keptEditorialSummaries}`);
  console.log(`Schlagwörter: ${stats.keywordsBefore} → ${stats.keywordsAfter}`);
  console.log(`  Zweitbezeichnung aus dem amtlichen Manifest: ${stats.designationFromManifest}`);
  console.log(`  Zweitbezeichnung aus dem Bestand rekonstruiert: ${stats.designationFromKeywords}`);
  console.log(`  ohne belegte Zweitbezeichnung: ${stats.withoutDesignation}`);
  console.log(`geänderte Dateien: ${stats.changedFiles}${write ? '' : ' (Probelauf, nichts geschrieben)'}`);
  console.log(`Reviewliste: ${reviewFile.total} Vorschriften ohne Kurzfassung → ${write ? reviewPath : '(nicht geschrieben)'}`);
}

await main();
