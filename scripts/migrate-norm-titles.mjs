#!/usr/bin/env node

/**
 * Einmalige Bestandsbereinigung des Titelmodells und der Zusammenfassungen.
 *
 * Zielmodell (scripts/lib/norm-title-rules.mjs):
 * - `title` ist der amtliche Langtitel. Für übernommene Vorschriften stammt er aus der
 *   versionierten REVOSax-Trefferliste data/recht/revosax-baseline-2023-11-01.json.
 * - `shortTitle` bleibt nur als echte Kurzbezeichnung erhalten; abkürzungsartige
 *   REVOSax-Bezeichnungen („Änd. OstSFG“) wandern in die Stichwörter.
 * - `abbr` bleibt nur als echte Abkürzung erhalten; alles andere wird Kurzbezeichnung
 *   oder Stichwort, nichts wird stillschweigend verworfen.
 * - Formelhafte Zusammenfassungen erhalten `summarySource: "derived"`; die eigenen
 *   „Regelt …“-Formeln werden durch redaktionelle Kurzbeschreibungen ersetzt.
 *
 * Aufruf:
 *   node scripts/migrate-norm-titles.mjs                       # nur Prüfbericht
 *   node scripts/migrate-norm-titles.mjs --write               # schreibt content/normen
 *   node scripts/migrate-norm-titles.mjs --write --summaries <datei.json>
 *
 * Die Migration ist deterministisch und arbeitet ohne Netzwerkzugriff. Titel von Normen
 * ohne REVOSax-Herkunft werden nicht verändert (Ausnahme: Klammerform „… (Kurztitel – Abk)“).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  abbreviationProblem,
  isAbbreviationLikeLabel,
  isDerivedSummary,
  isTitleFormulaSummary,
  isTitleInitialism,
  splitParentheticalTitle,
} from './lib/norm-title-rules.mjs';
import { ADAPTER_ARTEFACT_PATTERN, adaptSaxonText, hasSaxonResidual } from './lib/revosax-ost-adapter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NORMS_DIR = join(ROOT, 'content/normen');
const BASELINE_LISTING = join(ROOT, 'data/recht/revosax-baseline-2023-11-01.json');

/** Ankerfelder für neu eingefügte Schlüssel, damit die Dateien lesbar sortiert bleiben. */
const FIELD_ANCHORS = {
  shortTitle: ['title', 'slug', 'versionId'],
  shortTitleSource: ['shortTitle', 'title'],
  abbr: ['shortTitleSource', 'shortTitle', 'title'],
  summarySource: ['summary'],
};

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function collapseWhitespace(value) {
  return text(value).replace(/\s+/gu, ' ');
}

/**
 * Setzt Feldänderungen um und hält die Schlüsselreihenfolge stabil: vorhandene Schlüssel
 * behalten ihre Position, entfernte Felder verschwinden, neue folgen ihrem Ankerfeld.
 */
export function applyFieldChanges(original, changes) {
  const entries = Object.entries(changes);
  const removed = new Set(entries.filter(([, value]) => value === undefined).map(([key]) => key));
  const added = entries
    .filter(([key, value]) => value !== undefined && !(key in original))
    .map(([key]) => key);
  const anchorOf = (key) => (FIELD_ANCHORS[key] ?? []).find((anchor) =>
    (anchor in original && !removed.has(anchor)) || added.includes(anchor));
  const followers = new Map();
  for (const key of added) {
    const anchor = anchorOf(key);
    if (!anchor) continue;
    if (!followers.has(anchor)) followers.set(anchor, []);
    followers.get(anchor).push(key);
  }
  const result = {};
  const place = (key, value) => {
    result[key] = value;
    for (const follower of followers.get(key) ?? []) {
      if (!(follower in result)) place(follower, changes[follower]);
    }
  };
  for (const [key, value] of Object.entries(original)) {
    if (removed.has(key)) continue;
    place(key, key in changes ? changes[key] : value);
  }
  for (const key of added) if (!(key in result)) result[key] = changes[key];
  return result;
}

/** Trefferliste nach Vorschriftennummer und Fassungsnummer erschließen. */
function buildListingIndex(listing) {
  const byKey = new Map();
  for (const hit of listing.hits ?? []) {
    const lawId = String(hit.lawId);
    if (hit.versionSuffix) byKey.set(`${lawId}.${hit.versionSuffix}`, hit);
    if (!byKey.has(lawId)) byKey.set(lawId, hit);
  }
  return byKey;
}

function listingHitFor(byKey, references) {
  const candidates = references.flatMap((reference) => {
    const source = reference.objectKey ?? reference.localSource ?? reference.url ?? '';
    const identifier = source.match(/(\d+(?:\.\d+)?)(?:\.html)?$/u)?.[1] ?? null;
    const lawId = reference.lawId ? String(reference.lawId) : (identifier?.split('.')[0] ?? null);
    return [identifier, lawId].filter(Boolean);
  });
  const key = candidates.find((candidate) => byKey.has(candidate));
  return key ? byKey.get(key) : null;
}

/** Übergeleiteter Text der Trefferliste; Reststellen führen zum Abbruch der Wiederherstellung. */
function adaptedListingText(value) {
  const adapted = adaptSaxonText(text(value));
  if (!adapted) return null;
  if (hasSaxonResidual(adapted) || ADAPTER_ARTEFACT_PATTERN.test(adapted)) return null;
  return adapted;
}

/**
 * Eine abgelegte Abkürzung ist als Kurzbezeichnung brauchbar, wenn sie ein echtes Wort
 * enthält, groß beginnt (abgeschnittene Titelbruchstücke beginnen klein) und keine
 * Initialenfolge oder abkürzungsartige Bezeichnung ist.
 */
function isShortTitleCandidate(value, title) {
  const candidate = collapseWhitespace(value);
  if (!candidate || candidate === text(title)) return false;
  if (!/^[\p{Lu}\p{N}§]/u.test(candidate)) return false;
  if (!/\p{L}{4,}/u.test(candidate)) return false;
  if (isTitleInitialism(candidate, title)) return false;
  return !isAbbreviationLikeLabel(candidate);
}

function addKeyword(keywords, value) {
  const keyword = collapseWhitespace(value);
  if (!keyword || keyword.length < 2) return keywords;
  return keywords.includes(keyword) ? keywords : [...keywords, keyword];
}

function removeKeyword(keywords, value) {
  const keyword = text(value);
  return keyword ? keywords.filter((entry) => entry !== keyword) : keywords;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Plant alle Änderungen einer Norm; schreibt nichts. */
export function planNorm({ meta, versions, listingHit, hasRevosax = Boolean(listingHit), editorialSummary }) {
  const notes = [];
  const stats = new Set();
  const metaChanges = {};
  const versionChanges = new Map();
  let keywords = [...(meta.keywords ?? [])];
  const originalTitle = text(meta.title);
  let title = originalTitle;
  let shortTitle = text(meta.shortTitle) || undefined;
  let abbr = text(meta.abbr) || undefined;

  // (1) Langtitel aus der amtlichen Trefferliste wiederherstellen.
  if (listingHit) {
    const label = adaptedListingText(listingHit.label);
    const longTitle = adaptedListingText(listingHit.title);
    if (label && longTitle && title === label && longTitle !== title) {
      title = longTitle;
      shortTitle = label;
      stats.add('langtitel');
      notes.push({ kind: 'langtitel', from: originalTitle, to: longTitle });
    } else if (listingHit.title && !longTitle && title === adaptSaxonText(text(listingHit.label))) {
      notes.push({ kind: 'langtitel-abgelehnt', from: originalTitle, to: text(listingHit.title) });
      stats.add('langtitel-abgelehnt');
    }
  }

  // (2) Klammerform „Langtitel (Kurzbezeichnung – Abkürzung)“ auflösen.
  const split = splitParentheticalTitle(title);
  if (split.separator === 'dash' && split.title !== title) {
    const previousAbbr = abbr;
    title = split.title;
    if (split.shortTitle && (!shortTitle || shortTitle === originalTitle)) shortTitle = split.shortTitle;
    if (split.abbr) {
      // Eine bereits gepflegte, regelkonforme Abkürzung hat Vorrang vor der Klammerangabe.
      const keepExisting = previousAbbr
        && abbreviationProblem(previousAbbr, { title, shortTitle }) === null;
      if (!keepExisting) abbr = split.abbr;
      if (previousAbbr && !keepExisting) notes.push({ kind: 'klammer-abkuerzung', from: previousAbbr, to: abbr });
    }
    stats.add('klammertitel');
    notes.push({ kind: 'klammertitel', from: split.title, to: JSON.stringify({ shortTitle: split.shortTitle, abbr: split.abbr }) });
  }

  // (3) Kurzbezeichnung prüfen: Titelwiederholungen entfallen, Abkürzungsformen werden Stichwort.
  if (shortTitle && shortTitle === title) {
    shortTitle = undefined;
    stats.add('kurztitel-gleich-titel');
  } else if (shortTitle && isAbbreviationLikeLabel(shortTitle)) {
    keywords = addKeyword(keywords, shortTitle);
    stats.add('kurztitel-zu-stichwort');
    notes.push({ kind: 'kurztitel-zu-stichwort', from: shortTitle, to: 'abkürzungsartige Bezeichnung' });
    shortTitle = undefined;
  }

  // (4) Abkürzung prüfen: echte Abkürzung behalten, sonst Kurzbezeichnung oder Stichwort.
  if (abbr) {
    const reason = abbreviationProblem(abbr, { title, shortTitle });
    if (reason) {
      // Initialenfolgen, unbelegte Kürzel und abgeschnittene Titelbruchstücke sind Importartefakte:
      // sie bezeichnen die Vorschrift nicht und bleiben auch als Stichwort unbrauchbar.
      const fragment = !/^[\p{Lu}\p{N}§]/u.test(collapseWhitespace(abbr));
      const artificial = reason === 'ist nur die Initialenfolge des Titels'
        || reason === 'ist nicht durch die Primärquelle belegt'
        || fragment;
      if (artificial) {
        keywords = removeKeyword(keywords, abbr);
        stats.add('abkuerzung-verworfen');
        notes.push({ kind: 'abkuerzung-verworfen', from: abbr, to: fragment ? 'abgeschnittenes Titelbruchstück' : reason });
      } else if (reason === 'wiederholt den Titel' || reason === 'wiederholt den Kurztitel') {
        stats.add('abkuerzung-doppelt');
        notes.push({ kind: 'abkuerzung-doppelt', from: abbr, to: reason });
      } else if (!shortTitle && isShortTitleCandidate(abbr, title)) {
        shortTitle = collapseWhitespace(abbr);
        stats.add('abkuerzung-zu-kurztitel');
        notes.push({ kind: 'abkuerzung-zu-kurztitel', from: abbr, to: shortTitle });
      } else {
        keywords = addKeyword(keywords, abbr);
        stats.add('abkuerzung-zu-stichwort');
        notes.push({ kind: 'abkuerzung-zu-stichwort', from: abbr, to: reason });
      }
      abbr = undefined;
    }
  }

  // (5) Nachlauf: eine aus der Abkürzung gewonnene Kurzbezeichnung darf den Titel nicht wiederholen.
  if (shortTitle && shortTitle === title) {
    shortTitle = undefined;
    stats.add('kurztitel-gleich-titel');
  }

  if (title !== originalTitle) metaChanges.title = title;
  if (shortTitle !== (text(meta.shortTitle) || undefined)) metaChanges.shortTitle = shortTitle;
  if (abbr !== (text(meta.abbr) || undefined)) metaChanges.abbr = abbr;
  if (!shortTitle && meta.shortTitleSource !== undefined) metaChanges.shortTitleSource = undefined;

  // (6) Zusammenfassung: Formeln kennzeichnen, eigene „Regelt …“-Formeln redaktionell ersetzen.
  const summary = text(meta.summary);
  if (editorialSummary) {
    metaChanges.summary = editorialSummary;
    if (meta.summarySource !== undefined) metaChanges.summarySource = undefined;
    stats.add('zusammenfassung-redaktionell');
  } else if (isDerivedSummary(summary) && hasRevosax) {
    if (meta.summarySource !== 'derived') {
      metaChanges.summarySource = 'derived';
      stats.add('zusammenfassung-abgeleitet');
    }
  } else if (isTitleFormulaSummary(summary, originalTitle) || isTitleFormulaSummary(summary, title)) {
    notes.push({ kind: 'zusammenfassung-formel-offen', from: summary, to: 'ohne redaktionelle Kurzbeschreibung' });
    stats.add('zusammenfassung-formel-offen');
  } else if (meta.summarySource === 'derived') {
    metaChanges.summarySource = undefined;
    stats.add('zusammenfassung-kennzeichnung-entfernt');
  }

  // (7) Fassungen spiegeln die Bezeichnungen der Norm; historische Titel bleiben historisch.
  for (const { versionId, version } of versions) {
    const changes = {};
    const versionTitle = text(version.title) || undefined;
    let nextTitle = versionTitle;
    if (versionTitle && versionTitle === originalTitle && title !== originalTitle) {
      nextTitle = title;
      changes.title = title;
      stats.add('fassungstitel');
    }
    const effectiveTitle = nextTitle ?? title;
    let nextShortTitle = text(version.shortTitle) || undefined;
    if (nextTitle && effectiveTitle === title) {
      // Die Fassung trägt den Titel der Norm: die Kurzbezeichnung folgt der Norm.
      nextShortTitle = shortTitle;
    } else if (nextShortTitle && nextShortTitle === effectiveTitle) {
      nextShortTitle = undefined;
    } else if (nextShortTitle && isAbbreviationLikeLabel(nextShortTitle)) {
      keywords = addKeyword(keywords, nextShortTitle);
      nextShortTitle = undefined;
    }
    if (nextShortTitle !== (text(version.shortTitle) || undefined)) {
      changes.shortTitle = nextShortTitle;
      stats.add('fassungskurztitel');
    }
    const versionAbbr = text(version.abbr) || undefined;
    if (versionAbbr) {
      const reason = abbreviationProblem(versionAbbr, { title: effectiveTitle, shortTitle: nextShortTitle });
      if (reason) {
        if (versionAbbr !== abbr) keywords = removeKeyword(keywords, versionAbbr);
        changes.abbr = undefined;
        stats.add('fassungsabkuerzung');
        notes.push({ kind: 'fassungsabkuerzung', from: `${versionId}: ${versionAbbr}`, to: reason });
      }
    }
    if (Object.keys(changes).length > 0) versionChanges.set(versionId, changes);
  }

  const originalKeywords = meta.keywords ?? [];
  if (keywords.length !== originalKeywords.length
    || keywords.some((keyword, index) => keyword !== originalKeywords[index])) {
    metaChanges.keywords = keywords;
  }

  return { metaChanges, versionChanges, notes, stats: [...stats] };
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const summariesPath = valueAfter(args, '--summaries');
  const verbose = args.includes('--verbose');

  const listing = await readJson(BASELINE_LISTING);
  const byKey = buildListingIndex(listing);
  const editorialSummaries = summariesPath ? await readJson(resolve(ROOT, summariesPath)) : {};
  const usedSummaries = new Set();

  const slugs = (await readdir(NORMS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const counters = new Map();
  const bump = (key, amount = 1) => counters.set(key, (counters.get(key) ?? 0) + amount);
  const before = { abbr: 0, abbrEqualsTitle: 0, abbrTooLong: 0, shortTitleEqualsTitle: 0, summaryFormula: 0 };
  const after = { abbr: 0, abbrEqualsTitle: 0, abbrTooLong: 0, shortTitleEqualsTitle: 0, summaryDerived: 0 };
  const parentheticals = [];
  const rejected = [];
  const openFormulas = [];
  let changedNorms = 0;
  let changedFiles = 0;

  for (const slug of slugs) {
    const normDir = join(NORMS_DIR, slug);
    const metaPath = join(normDir, 'meta.json');
    const meta = await readJson(metaPath);
    let versionFiles = [];
    try {
      versionFiles = (await readdir(join(normDir, 'versions'))).filter((file) => file.endsWith('.json')).sort();
    } catch { /* Norm ohne Fassungsverzeichnis */ }
    const versions = [];
    for (const file of versionFiles) {
      const version = await readJson(join(normDir, 'versions', file));
      versions.push({ file, versionId: version.versionId ?? file.replace(/\.json$/u, ''), version });
    }

    if (meta.abbr) {
      before.abbr += 1;
      if (meta.abbr === meta.title) before.abbrEqualsTitle += 1;
      if ([...meta.abbr].length > 20) before.abbrTooLong += 1;
    }
    if (meta.shortTitle === meta.title) before.shortTitleEqualsTitle += 1;
    if (isDerivedSummary(meta.summary) || isTitleFormulaSummary(meta.summary, meta.title)) before.summaryFormula += 1;

    const references = [
      ...(meta.sourceReferences ?? []),
      ...versions.flatMap(({ version }) => version.sourceReferences ?? []),
    ].filter((reference) => reference.kind === 'revosax-snapshot');
    const listingHit = references.length > 0 ? listingHitFor(byKey, references) : null;
    const editorialSummary = editorialSummaries[slug];
    if (editorialSummary) usedSummaries.add(slug);

    const plan = planNorm({ meta, versions, listingHit, hasRevosax: references.length > 0, editorialSummary });
    for (const key of plan.stats) bump(key);
    for (const note of plan.notes) {
      if (note.kind === 'klammertitel') parentheticals.push([slug, note.from, note.to]);
      if (note.kind === 'langtitel-abgelehnt') rejected.push([slug, note.from, note.to]);
      if (note.kind === 'zusammenfassung-formel-offen') openFormulas.push([slug, note.from]);
      if (verbose) console.log(`${slug}: ${note.kind}: ${note.from} → ${note.to}`);
    }

    const nextMeta = Object.keys(plan.metaChanges).length > 0
      ? applyFieldChanges(meta, plan.metaChanges)
      : meta;
    if (nextMeta !== meta) {
      changedNorms += 1;
      changedFiles += 1;
      if (write) await writeJson(metaPath, nextMeta);
    }
    for (const { file, versionId, version } of versions) {
      const changes = plan.versionChanges.get(versionId);
      if (!changes || Object.keys(changes).length === 0) continue;
      changedFiles += 1;
      if (write) await writeJson(join(normDir, 'versions', file), applyFieldChanges(version, changes));
    }

    if (nextMeta.abbr) {
      after.abbr += 1;
      if (nextMeta.abbr === nextMeta.title) after.abbrEqualsTitle += 1;
      if ([...nextMeta.abbr].length > 20) after.abbrTooLong += 1;
    }
    if (nextMeta.shortTitle && nextMeta.shortTitle === nextMeta.title) after.shortTitleEqualsTitle += 1;
    if (nextMeta.summarySource === 'derived') after.summaryDerived += 1;
  }

  const unknownSummaries = Object.keys(editorialSummaries).filter((slug) => !usedSummaries.has(slug));

  console.log(`Normen: ${slugs.length}${write ? '' : ' (Prüflauf, keine Datei geschrieben)'}`);
  console.log(`Geänderte Normen: ${changedNorms}, geänderte Dateien: ${changedFiles}`);
  console.log('Regeln:');
  for (const [key, value] of [...counters.entries()].sort((left, right) => right[1] - left[1])) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('Vorher: '
    + `abbr ${before.abbr}, abbr = title ${before.abbrEqualsTitle}, abbr > 20 Zeichen ${before.abbrTooLong}, `
    + `shortTitle = title ${before.shortTitleEqualsTitle}, Formel-Zusammenfassungen ${before.summaryFormula}`);
  console.log('Nachher: '
    + `abbr ${after.abbr}, abbr = title ${after.abbrEqualsTitle}, abbr > 20 Zeichen ${after.abbrTooLong}, `
    + `shortTitle = title ${after.shortTitleEqualsTitle}, summarySource derived ${after.summaryDerived}`);

  console.log(`Klammertitel aufgeteilt: ${parentheticals.length}`);
  for (const [slug, title, parts] of parentheticals) console.log(`  ${slug}: ${title} ${parts}`);
  if (rejected.length > 0) {
    console.log(`Langtitel wegen Reststellen nicht übernommen: ${rejected.length}`);
    for (const [slug, from, to] of rejected) console.log(`  ${slug}: ${from} → ${to}`);
  }
  if (openFormulas.length > 0) {
    console.log(`Formel-Zusammenfassungen ohne redaktionellen Ersatz: ${openFormulas.length}`);
    for (const [slug] of openFormulas) console.log(`  ${slug}`);
  }
  if (unknownSummaries.length > 0) {
    console.log(`Zusammenfassungen ohne passende Norm: ${unknownSummaries.length}`);
    for (const slug of unknownSummaries) console.log(`  ${slug}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
