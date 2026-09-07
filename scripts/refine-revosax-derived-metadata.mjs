#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { adaptSaxonText, hasSaxonResidual } from './lib/revosax-ost-adapter.mjs';
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
 *                „Baubeschränkungsgebieten“ nicht. Sie werden entfernt; hinzu kommt die amtliche
 *                Bezeichnung der REVOSax-Trefferliste, soweit sie sich von Titel, Kurztitel und
 *                Abkürzung unterscheidet — eine belegte Zweitbezeichnung, unter der die Vorschrift
 *                amtlich geführt wird. Die Bürgerbegriffe stehen weiterhin allein im
 *                redaktionellen Stichwortregister (`content/stichwortregister.json`).
 *
 * Zwei Regeln, die sich aus Fehlern des ersten Laufs ergeben:
 *
 *   1. Die Stichwortarbeit hängt **nicht** an der Kurzfassung. Der erste Lauf sprang bei Normen mit
 *      redaktioneller Kurzfassung vor der Stichwortneubewertung ab; bei ihnen blieben die alten
 *      Titelwörter stehen. Maßgeblich ist die Herkunft: Vorschriften mit REVOSax-Provenienz
 *      (`sourceReferences[].lawId`) werden bereinigt, eigene ostdeutsche Normen nicht — deren
 *      Schlagwörter sind redaktioneller Inhalt.
 *   2. Vorhandene Schlagwörter werden **ergänzt, nicht ersetzt**. Der erste Lauf überschrieb die
 *      Liste und verlor dabei redaktionell gesetzte Begriffe, die nirgends sonst stehen. Entfernt
 *      wird nur, was das Muster des Massenimports trägt: ein Wort ab fünf Zeichen aus dem eigenen
 *      Titel oder Kurztitel, oder eine Bezeichnung, die mit Titel, Kurztitel oder Abkürzung
 *      wortgleich ist.
 *
 * Herkunft der Schlagwörter im Ergebnis, vier Kategorien (der Bericht zählt sie einzeln):
 *
 *   manifest   – amtliche Bezeichnung der REVOSax-Trefferliste (belegt),
 *   fassung    – fassungsspezifische Abkürzung oder Kurzbezeichnung aus `versions/*.json` (belegt),
 *   bestand    – vorhandenes Schlagwort des Repositoriums, das kein Titelwort ist. **Nicht** amtlich
 *                belegt: es stammt aus redaktioneller Arbeit oder aus einem früheren Import und
 *                bleibt erhalten, weil es sonst ersatzlos verschwände.
 *   ohne       – keine zweite Bezeichnung; die Vorschrift trägt danach kein Schlagwort.
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
export function loadOfficialLabels() {
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
 * Genau die Wörter, die der Massenimport als Schlagwort erzeugt hätte: Titel und Kurztitel an
 * Nicht-Wortzeichen zerlegt, mindestens fünf Zeichen, ohne die Füll- und Gattungswörter der
 * Stoppliste. Die Regel ist die des früheren `inferKeywords` (scripts/lib/revosax-metadata.mjs vor
 * dieser Änderung) und die des Kurztitel-Zweigs in scripts/import-normen.mjs — wer entfernt, muss
 * dasselbe Muster treffen, das erzeugt wurde, sonst verschwinden redaktionelle Begriffe mit.
 */
const MASS_IMPORT_MIN_WORD_LENGTH = 5;

function designationNames(meta) {
  return new Set([meta.title, meta.shortTitle, meta.abbr]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean));
}

function massImportTitleWords(meta) {
  const words = new Set();
  for (const source of [meta.title, meta.shortTitle]) {
    const text = String(source ?? '');
    // Beide Zerlegungen der beiden Erzeuger: an Nicht-Wortzeichen unter Erhalt des Bindestrichs
    // (REVOSax-Massenimport) und an Leerzeichen (Kurztitel-Zweig des HTML-Importers). Die
    // Stoppliste des Erzeugers bleibt hier außen vor: ein Titelbestandteil ist ein
    // Titelbestandteil, gleich ob der Erzeuger ihn seinerzeit übersprungen hätte.
    for (const raw of [...text.split(/[^\p{L}\p{N}-]+/u), ...text.split(/\s+/u)]) {
      const value = raw.trim().replace(/^-+|-+$/gu, '');
      if (value.length >= MASS_IMPORT_MIN_WORD_LENGTH) words.add(value);
    }
  }
  return words;
}

/**
 * Trägt eine Bezeichnung eine sächsische Reststelle? Bezeichnungen mit `Sächs`- oder
 * `Sachsen`-Bestandteil sind keine Schlagwörter des ostdeutschen Bestands — das war schon die Regel
 * des Massenimports. Einzige Ausnahme ist „Sachsen-Anhalt“: ein echter Fremdbezug, den die
 * Rechtsüberleitung ausdrücklich stehen lässt (scripts/lib/revosax-ost-adapter.mjs). Die frühere
 * Eigenregel dieses Werkzeugs kannte diese Ausnahme nicht und verwarf die Staatsverträge mit
 * Sachsen-Anhalt; `hasSaxonResidual` allein wiederum übersieht das abgekürzte „Sächs“ vor einem
 * Bindestrich („Änd. Sächs-AufbauG“), weil es auf Fließtext zielt. Beide Regeln zusammen.
 */
const SAXON_DESIGNATION = /(?:^|[^\p{L}])(?:Sächs|Sachsen)/u;
function isSaxonDesignation(value) {
  const ohneFremdbezug = String(value ?? '').replaceAll('Sachsen-Anhalt', 'Anhalt');
  return SAXON_DESIGNATION.test(ohneFremdbezug) || hasSaxonResidual(ohneFremdbezug);
}

/** Amtliche Bezeichnungen der REVOSax-Trefferliste zu den Kennungen einer Norm. */
function manifestDesignations(meta, labels) {
  const names = designationNames(meta);
  const found = [];
  for (const lawId of lawIdsOf(meta)) {
    const label = labels.get(lawId);
    if (!label || names.has(label) || found.includes(label) || isSaxonDesignation(label)) continue;
    found.push(label);
  }
  return found;
}

/**
 * Fassungsspezifische Bezeichnungen: trägt eine gespeicherte Fassung eine eigene Abkürzung oder
 * Kurzbezeichnung, bleibt sie als Zweitbezeichnung auffindbar (Regel in
 * scripts/audit-norm-metadata.mjs).
 */
function versionDesignationsOf(slug, meta) {
  const names = designationNames(meta);
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

/**
 * Schlagwörter einer übernommenen Vorschrift mit ihrer Herkunft. Vorhandene Werte bleiben, sofern
 * sie nicht dem Muster des Massenimports folgen; amtliche und fassungsspezifische Bezeichnungen
 * kommen hinzu. Die Reihenfolge ist stabil: amtlich, fassungsspezifisch, Bestand.
 */
export function keywordsWithProvenance(slug, meta, labels) {
  const names = designationNames(meta);
  const titleWords = massImportTitleWords(meta);
  // Verglichen wird die randbereinigte Form: „Abendgymnasien-“ ist derselbe Titelbestandteil wie
  // „Abendgymnasien“, nur mit dem Bindestrich einer aufgetrennten Wortverbindung.
  const kern = (value) => value.replace(/^-+|-+$/gu, '');
  const kept = (meta.keywords ?? [])
    .map((value) => String(value ?? '').trim())
    // Ein Wert mit Bindestrich am Rand ist die Hälfte einer aufgetrennten Wortverbindung
    // („Land- und Forstwirtschaft“ → „Land-“) und nie eine Bezeichnung, unter der jemand sucht.
    .filter((value) => value && !names.has(value) && !titleWords.has(kern(value)) && !/^-|-$/u.test(value));
  const manifest = manifestDesignations(meta, labels);
  const versions = versionDesignationsOf(slug, meta);
  const seen = new Set();
  const keywords = [];
  const provenance = { manifest: 0, fassung: 0, bestand: 0 };
  for (const [kind, values] of [['manifest', manifest], ['fassung', versions], ['bestand', kept]]) {
    for (const value of values) {
      if (seen.has(value)) continue;
      seen.add(value);
      keywords.push(value);
      provenance[kind] += 1;
    }
  }
  return { keywords, provenance };
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
    revosaxNorms: 0,
    derivedSummaries: 0,
    removedSummaries: 0,
    keptEditorialSummaries: 0,
    withoutSummary: 0,
    keywordsBefore: 0,
    keywordsAfter: 0,
    removedTitleWords: 0,
    provenance: { manifest: 0, fassung: 0, bestand: 0 },
    normsWithoutKeyword: 0,
    changedFiles: 0,
  };
  const review = [];

  for (const slug of slugs) {
    const path = join(NORMS_DIR, slug, 'meta.json');
    const meta = readJson(path);
    const before = JSON.stringify(meta);
    stats.keywordsBefore += (meta.keywords ?? []).length;

    // (A) Kurzfassung: die beiden Formeln des Massenimports verschwinden, redaktionell geprüfte
    // Kurzfassungen bleiben unberührt.
    const derivedSummary = meta.summarySource === 'derived'
      || DERIVED_SUMMARY_PATTERNS.some((pattern) => pattern.test(String(meta.summary ?? '')));
    if (derivedSummary) {
      stats.derivedSummaries += 1;
      delete meta.summary;
      delete meta.summarySource;
      stats.removedSummaries += 1;
    } else if (String(meta.summary ?? '').trim()) {
      stats.keptEditorialSummaries += 1;
    }

    // (B) Schlagwörter: unabhängig von der Kurzfassung, aber nur für Vorschriften mit
    // REVOSax-Provenienz. Bei eigenen ostdeutschen Normen sind die Schlagwörter redaktioneller
    // Inhalt und werden von diesem Werkzeug nicht angefasst.
    if (lawIdsOf(meta).length > 0) {
      stats.revosaxNorms += 1;
      const { keywords, provenance } = keywordsWithProvenance(slug, meta, labels);
      const vorher = (meta.keywords ?? []).map((value) => String(value ?? '').trim()).filter(Boolean);
      stats.removedTitleWords += vorher.filter((value) => !keywords.includes(value)).length;
      meta.keywords = keywords;
      for (const kind of Object.keys(stats.provenance)) stats.provenance[kind] += provenance[kind];
      if (keywords.length === 0) stats.normsWithoutKeyword += 1;
    }
    stats.keywordsAfter += (meta.keywords ?? []).length;

    // (C) Arbeitsvorrat: jede Vorschrift ohne redaktionelle Kurzfassung, unabhängig davon, ob
    // dieser Lauf sie entfernt hat. Damit liefert ein zweiter Lauf dieselbe Liste.
    if (!String(meta.summary ?? '').trim()) {
      stats.withoutSummary += 1;
      review.push({ slug, type: meta.type, primarySubject: meta.primarySubject ?? null });
    }

    const after = JSON.stringify(meta);
    if (after !== before) {
      stats.changedFiles += 1;
      if (write) writeFileSync(path, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    }
  }

  review.sort((left, right) => left.slug.localeCompare(right.slug, 'de'));
  const reviewFile = {
    schemaVersion: 1,
    // Kein Zeitstempel: die Datei soll aus dem Bestand reproduzierbar sein, damit ein zweiter Lauf
    // keinen Unterschied erzeugt, den niemand entschieden hat.
    what: 'Vorschriften ohne redaktionell geprüfte Kurzfassung. Die Oberfläche zeigt dort keine Beschreibung; die Liste ist der Arbeitsvorrat der Redaktion.',
    total: review.length,
    byType: Object.fromEntries(
      Object.entries(review.reduce((counts, entry) => ({ ...counts, [entry.type]: (counts[entry.type] ?? 0) + 1 }), {}))
        .sort(([left], [right]) => left.localeCompare(right, 'de')),
    ),
    entries: review,
  };
  if (write) writeFileSync(reviewPath, `${JSON.stringify(reviewFile, null, 2)}\n`, 'utf8');

  console.log(`Normen: ${stats.norms}`);
  console.log(`davon mit REVOSax-Provenienz: ${stats.revosaxNorms}`);
  console.log(`Kurzfassungen des Massenimports: ${stats.derivedSummaries} (entfernt: ${stats.removedSummaries})`);
  console.log(`redaktionell geprüfte Kurzfassungen: ${stats.keptEditorialSummaries}`);
  console.log(`ohne Kurzfassung (Arbeitsvorrat): ${stats.withoutSummary}`);
  console.log(`Schlagwörter: ${stats.keywordsBefore} → ${stats.keywordsAfter} (entfernte Titelwörter und Dubletten: ${stats.removedTitleWords})`);
  console.log(`  amtliche Bezeichnung der Trefferliste (belegt): ${stats.provenance.manifest}`);
  console.log(`  fassungsspezifische Bezeichnung (belegt): ${stats.provenance.fassung}`);
  console.log(`  aus dem Bestand übernommen (nicht amtlich belegt): ${stats.provenance.bestand}`);
  console.log(`  Vorschriften ohne zweite Bezeichnung: ${stats.normsWithoutKeyword}`);
  console.log(`geänderte Dateien: ${stats.changedFiles}${write ? '' : ' (Probelauf, nichts geschrieben)'}`);
  console.log(`Reviewliste: ${reviewFile.total} Vorschriften ohne Kurzfassung → ${write ? reviewPath : '(nicht geschrieben)'}`);
}

// Beim Einbinden als Modul (Korrekturwerkzeuge, Tests) läuft nichts von selbst.
if (process.argv[1] && process.argv[1].endsWith('refine-revosax-derived-metadata.mjs')) await main();
