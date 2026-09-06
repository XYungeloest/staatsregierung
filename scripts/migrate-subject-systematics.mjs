#!/usr/bin/env node --experimental-strip-types

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSubjectByTitle } from '@ostrecht/shared/config/law-subjects.ts';

import {
  inferSubjectAssignment,
  normalizeSubjectMatchKey,
  stemTitleKeyOf,
} from './lib/revosax-metadata.mjs';

/**
 * Einmalige Umstellung der Sachgebiete auf die amtliche zweistufige Systematik
 * (packages/shared/src/config/law-subjects.json).
 *
 * Die Zuordnung folgt der verbindlichen Reihenfolge aus scripts/lib/revosax-metadata.mjs:
 * amtliche Fundstellennummer der eigenen Fassungsseite, Fundstellennummer einer anderen
 * Fassung derselben Vorschrift, verbundene Norm, Titeltreffer auf die Stammnorm, Regel aus
 * der Dokumentart, frühere redaktionelle Zuordnung, Titelschlüsselwort, Prüfliste.
 *
 * Geschrieben werden ausschließlich `subjects`, `primarySubject`, `fundingArea`,
 * `sourceReferences[].fsnNumber` und – für übernommene Änderungsvorschriften ohne jede
 * Beziehung – `affectedNorms` aus einem eindeutigen Stammnormtreffer. Titel, Kurztitel,
 * Abkürzungen, Zusammenfassungen und Verlaufseinträge bleiben unberührt.
 *
 * Ohne `--write` ist der Lauf eine Prüfung, die nur Kennzahlen ausgibt.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NORMS_DIR = join(ROOT, 'content', 'normen');
const REVIEW_PATH = join(ROOT, 'data', 'recht', 'subject-assignment-review.json');
const DEFAULT_RAW_CACHE = join(ROOT, '.cache', 'revosax-baseline', '2023-11-01', 'raw');
const FSN_PATTERN = /Fsn-Nr\.:\s*([^<\n]+?)\s*(?:<|$)/u;

function parseArgs(argv) {
  const args = { write: false, rawCache: DEFAULT_RAW_CACHE, limitReview: 40 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--write') args.write = true;
    else if (value === '--raw-cache') args.rawCache = resolve(argv[index + 1] ?? '');
    else if (value.startsWith('--raw-cache=')) args.rawCache = resolve(value.slice('--raw-cache='.length));
    else if (value === '--help') args.help = true;
  }
  return args;
}

async function directoryExists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Fundstellennummern aus dem lokalen Rohcache; Schlüssel ist der Dateiname ohne Endung. */
async function loadRawFsnIndex(rawCache) {
  const byFile = new Map();
  const byLawId = new Map();
  if (!(await directoryExists(rawCache))) return { byFile, byLawId, files: 0 };
  const files = (await readdir(rawCache)).filter((name) => name.endsWith('.html'));
  for (const name of files) {
    const html = await readFile(join(rawCache, name), 'utf8');
    const match = html.match(FSN_PATTERN);
    if (!match) continue;
    const fsn = match[1].trim();
    const key = name.slice(0, -'.html'.length);
    byFile.set(key, fsn);
    const lawId = key.split('.')[0];
    if (!byLawId.has(lawId)) byLawId.set(lawId, fsn);
  }
  return { byFile, byLawId, files: files.length };
}

async function loadNorms() {
  const slugs = (await readdir(NORMS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const norms = [];
  for (const slug of slugs) {
    const path = join(NORMS_DIR, slug, 'meta.json');
    norms.push({ slug, path, meta: JSON.parse(await readFile(path, 'utf8')) });
  }
  return norms;
}

function revosaxReferences(meta) {
  return (meta.sourceReferences ?? []).filter((reference) => reference.kind === 'revosax-snapshot');
}

/** Fundstellennummer einer Norm: bereits gespeichert, sonst aus dem Rohcache. */
function resolveFsn(meta, index) {
  const references = revosaxReferences(meta);
  const ordered = [
    ...references.filter((reference) => reference.sourceRole === 'official-snapshot'),
    ...references.filter((reference) => reference.sourceRole !== 'official-snapshot'),
  ];
  for (const reference of ordered) {
    if (reference.fsnNumber) return { fsnNumber: reference.fsnNumber, source: 'page', reference };
  }
  for (const reference of ordered) {
    const key = String(reference.objectKey ?? '').split('/').at(-1)?.replace(/\.html$/u, '');
    if (key && index.byFile.has(key)) return { fsnNumber: index.byFile.get(key), source: 'page', reference };
  }
  for (const reference of ordered) {
    const lawId = reference.lawId ? String(reference.lawId) : null;
    if (lawId && index.byLawId.has(lawId)) return { fsnNumber: index.byLawId.get(lawId), source: 'sibling', reference };
  }
  return { fsnNumber: null, source: null, reference: ordered[0] ?? null };
}

function subjectNumbersOf(subjects) {
  return subjects.map((subject) => getSubjectByTitle(subject)?.number).filter(Boolean);
}

/** Bezeichner, unter denen eine Stammnorm über ihren Titel gefunden werden kann. */
function stemKeysOf(meta) {
  return [...new Set([meta.title, meta.shortTitle, meta.abbr]
    .filter(Boolean)
    .map((value) => normalizeSubjectMatchKey(value))
    .filter((key) => key.length >= 6))];
}

function isInheritedAmendmentMeta(meta) {
  return meta.type === 'aenderungsvorschrift' && revosaxReferences(meta).length > 0;
}

function hasRelation(meta) {
  return Boolean(meta.containedIn)
    || (meta.affectedNorms?.length ?? 0) > 0
    || (meta.relatedNorms?.length ?? 0) > 0
    || Boolean(meta.enactedNorm)
    || (meta.enactedNorms?.length ?? 0) > 0;
}

/** Fügt einen Schlüssel unmittelbar hinter `afterKey` ein und erhält sonst die Reihenfolge. */
function withKeyAfter(object, afterKey, key, value) {
  const next = {};
  let inserted = false;
  for (const [name, entry] of Object.entries(object)) {
    if (name === key) continue;
    next[name] = entry;
    if (name === afterKey) {
      if (value !== undefined) next[key] = value;
      inserted = true;
    }
  }
  if (!inserted && value !== undefined) next[key] = value;
  return next;
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Aufruf: node --experimental-strip-types scripts/migrate-subject-systematics.mjs [--write] [--raw-cache <Verzeichnis>]');
    return;
  }

  const index = await loadRawFsnIndex(args.rawCache);
  const norms = await loadNorms();
  console.log(`Rohcache ${args.rawCache}: ${index.files} Seiten, ${index.byFile.size} mit Fundstellennummer.`);
  console.log(`Normen: ${norms.length}.`);

  // 1. Fundstellennummern auflösen und die amtlich belegten Zuordnungen bilden.
  const assignments = new Map();
  const fsnBySlug = new Map();
  for (const norm of norms) {
    const resolved = resolveFsn(norm.meta, index);
    if (!resolved.fsnNumber) continue;
    fsnBySlug.set(norm.slug, resolved);
    const assignment = inferSubjectAssignment({
      fsnNumber: resolved.fsnNumber,
      fsnSource: resolved.source,
      category: undefined,
      normType: norm.meta.type,
      sourceTitle: norm.meta.title,
      label: norm.meta.shortTitle,
    });
    if (assignment.basis === 'fsn' || assignment.basis === 'fsn-sibling') {
      assignments.set(norm.slug, { ...assignment, numbers: subjectNumbersOf(assignment.subjects) });
    }
  }

  // 2. Stammnormverzeichnis aus den amtlich belegten Vorschriften.
  const stemIndex = new Map();
  for (const norm of norms) {
    if (norm.meta.type === 'aenderungsvorschrift') continue;
    const assignment = assignments.get(norm.slug);
    if (!assignment) continue;
    for (const key of stemKeysOf(norm.meta)) {
      const entry = stemIndex.get(key) ?? { numbers: new Set(), slugs: new Set() };
      entry.numbers.add(assignment.numbers[0]);
      entry.slugs.add(norm.slug);
      stemIndex.set(key, entry);
    }
  }
  const stemLookup = new Map();
  for (const [key, entry] of stemIndex) {
    if (entry.numbers.size === 1) stemLookup.set(key, { numbers: [...entry.numbers] });
  }

  // 3. Alle übrigen Normen in der verbindlichen Reihenfolge zuordnen.
  const review = [];
  const derivedAffected = [];
  for (const norm of norms) {
    if (assignments.has(norm.slug)) continue;
    const relatedSlug = [norm.meta.containedIn, ...(norm.meta.affectedNorms ?? []), norm.meta.enactedNorm, ...(norm.meta.enactedNorms ?? [])]
      .filter(Boolean)
      .find((slug) => assignments.get(slug)?.basis === 'fsn' || assignments.get(slug)?.basis === 'fsn-sibling');
    const related = relatedSlug ? assignments.get(relatedSlug) : undefined;
    const legacySubjects = (norm.meta.subjects ?? []).filter((subject) => subject !== 'Landesrecht');
    const assignment = inferSubjectAssignment({
      fsnNumber: null,
      normType: norm.meta.type,
      sourceTitle: norm.meta.title,
      label: norm.meta.shortTitle,
      legacySubjects,
      relatedAssignment: related ? { numbers: related.numbers } : undefined,
      stemLookup,
    });
    assignments.set(norm.slug, { ...assignment, numbers: subjectNumbersOf(assignment.subjects) });

    if (assignment.basis === 'review') {
      review.push({
        slug: norm.slug,
        title: norm.meta.title,
        type: norm.meta.type,
        assignedSubject: assignment.primarySubject,
        previousSubjects: norm.meta.subjects ?? [],
      });
    }
  }

  // 4. Geänderte Vorschriften aus einem eindeutigen Stammnormtreffer.
  const stemSlugLookup = new Map();
  for (const [key, entry] of stemIndex) {
    if (entry.slugs.size === 1) stemSlugLookup.set(key, [...entry.slugs][0]);
  }
  for (const norm of norms) {
    if (!isInheritedAmendmentMeta(norm.meta) || hasRelation(norm.meta)) continue;
    const key = stemTitleKeyOf(norm.meta.title);
    const stemSlug = key ? stemSlugLookup.get(key) : undefined;
    if (stemSlug && stemSlug !== norm.slug) derivedAffected.push({ slug: norm.slug, stemSlug });
  }
  const affectedBySlug = new Map(derivedAffected.map((entry) => [entry.slug, entry.stemSlug]));

  // 5. Kennzahlen.
  const bases = countBy([...assignments.values()].map((assignment) => assignment.basis));
  console.log('\nHerkunft der Zuordnung:');
  for (const [basis, count] of bases) console.log(`  ${basis.padEnd(13)} ${count}`);
  const primaryCounts = countBy([...assignments.values()].map((assignment) => assignment.primarySubject));
  console.log(`\nBelegte Sachgebiete: ${primaryCounts.length} (Hauptsachgebiet), Prüfliste ${review.length}, abgeleitete Änderungsbeziehungen ${derivedAffected.length}.`);
  for (const [subject, count] of primaryCounts.slice(0, 12)) {
    console.log(`  ${String(getSubjectByTitle(subject)?.number ?? '–').padEnd(3)} ${subject}: ${count}`);
  }
  const fundingCounts = countBy([...assignments.values()].map((assignment) => assignment.fundingArea).filter(Boolean));
  console.log(`\nFörderbereiche: ${fundingCounts.map(([area, count]) => `${area}: ${count}`).join(', ') || 'keine'}`);
  const withoutFunding = norms.filter((norm) => norm.meta.type === 'foerderrichtlinie' && !assignments.get(norm.slug)?.fundingArea).length;
  console.log(`Förderrichtlinien ohne Förderbereich: ${withoutFunding}`);

  if (!args.write) {
    console.log('\nPrüflauf ohne Schreibvorgang. Mit --write werden meta.json und die Prüfliste geschrieben.');
    return;
  }

  // 6. Schreiben.
  let changedNorms = 0;
  let writtenFsn = 0;
  for (const norm of norms) {
    const assignment = assignments.get(norm.slug);
    if (!assignment) throw new Error(`${norm.slug}: keine Sachgebietszuordnung ermittelt`);
    const before = JSON.stringify(norm.meta);
    let meta = { ...norm.meta, subjects: assignment.subjects };
    meta = withKeyAfter(meta, 'subjects', 'primarySubject', assignment.primarySubject);
    meta = withKeyAfter(meta, 'primarySubject', 'fundingArea', norm.meta.type === 'foerderrichtlinie' ? assignment.fundingArea : undefined);

    const stemSlug = affectedBySlug.get(norm.slug);
    // Geänderte Stammnorm als letztes Feld, wie in den übrigen Änderungsvorschriften.
    if (stemSlug) meta.affectedNorms = [stemSlug];

    const resolved = fsnBySlug.get(norm.slug);
    if (resolved?.reference && resolved.fsnNumber && !resolved.reference.fsnNumber) {
      meta.sourceReferences = meta.sourceReferences.map((reference) => (reference === resolved.reference
        ? withKeyAfter(reference, 'sourceValidTo' in reference ? 'sourceValidTo' : 'sourceValidFrom', 'fsnNumber', resolved.fsnNumber)
        : reference));
      writtenFsn += 1;
    }

    if (JSON.stringify(meta) === before) continue;
    await writeFile(norm.path, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    changedNorms += 1;
  }

  const reviewFile = {
    description: 'Vorschriften ohne amtlichen Anhaltspunkt für die Sachgebietszuordnung. Der eingetragene Wert ist eine Ersatzzuordnung nach Dokumentart und ersetzt keine redaktionelle Entscheidung.',
    generatedBy: 'scripts/migrate-subject-systematics.mjs',
    count: review.length,
    norms: review.sort((left, right) => left.slug.localeCompare(right.slug)),
  };
  await writeFile(REVIEW_PATH, `${JSON.stringify(reviewFile, null, 2)}\n`, 'utf8');

  console.log(`\nGeschrieben: ${changedNorms} meta.json, davon ${writtenFsn} mit Fundstellennummer; Prüfliste ${REVIEW_PATH} mit ${review.length} Einträgen.`);
}

await main();
