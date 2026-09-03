#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { findSaxonResidual } from './lib/revosax-ost-adapter.mjs';

/**
 * Korpusweiter End-Audit der Rechtsüberleitung über den materialisierten
 * Rechtsbestand unter content/normen/.
 *
 * Geprüft werden alle sichtbaren normativen Felder: Titel, Kurzbezeichnung,
 * Abkürzung, Kurzfassung, Schlagwörter, Fassungstitel/-kurzbezeichnungen/
 * -abkürzungen, Änderungsvermerke, Zitierungen (nach Entfernen der geschützten
 * Fundstellenkürzel), Historieneinträge sowie der gesamte Normkörper (Labels,
 * Überschriften, Texte, Anlagen). Ausgenommen sind ausschließlich Provenienz-
 * felder: sourceReferences (URLs, R2-Schlüssel, Hashes, historische Bezeichnungen),
 * sourceNotes (Beschreibung der amtlichen Quelle), editorialResolutions (dokumentierte
 * Quellenbefunde), enactingBody/originEnactingBody (historisches Ursprungsorgan,
 * dokumentierte Semantik) sowie E-Mail-/Web-Adressen.
 *
 * Zwei Provenienzklassen:
 *   - Übergeleitetes Recht (mindestens eine REVOSax-Quelle: Baseline-Import aus R2 oder
 *     versionierter Snapshot der redaktionellen Konsolidierung): muss reststellenfrei
 *     sein – in allen Fassungen, auch in den späteren ostdeutschen Folgefassungen.
 *   - Eigene Erlasse des Freistaates Ostdeutschland (nur amtliche ostdeutsche Quellen
 *     unter Gesetze/: HTML-/Markdown-Transkriptionen, Änderungsquellen): ihre Texte
 *     werden quellentreu wiedergegeben (scripts/import-normen.mjs --strict). Ein
 *     Sachsen-Bezug ist dort kein Überleitungsrest, sondern ein bewusster Fremd- oder
 *     Altbezug des ostdeutschen Normgebers (zitierte sächsische Ausgangsfassung,
 *     Ersetzungsbefehl „Sächsisch“ → „Ostdeutsch“, historischer Verweis) – er gilt
 *     nur, wenn die Stelle wörtlich in der amtlichen Quelle belegt ist; jeder
 *     unbelegte Sachsen-Bezug ist eine Reststelle.
 *
 * Quellen ohne Textebene (nur PDF): ein Sachsen-Bezug kann dann nur durch eine
 * dokumentierte Prüfung belegt werden – data/recht/ost-residual-backlog.json führt sie
 * unter pdfVerifications (Slug, Feldpfad, PDF-Quelle mit SHA-256, wörtliches Zitat,
 * Prüfdatum, Werkzeug). Der Beleg gilt nur, solange das PDF hashidentisch ist.
 *
 * Reststellen (übergeleitet oder unbelegt) werden nicht still geduldet: der Audit
 * schlägt fehl, sofern sie nicht als bewusster Rückstand in
 * data/recht/ost-residual-backlog.json verzeichnet sind; --update-backlog schreibt den
 * Stand nach einer redaktionellen Entscheidung neu. Zielzustand ist ein leerer Rückstand.
 */

const ROOT = resolve(process.cwd());
const CONTENT_ROOT = join(ROOT, 'content', 'normen');
const BACKLOG_PATH = join(ROOT, 'data', 'recht', 'ost-residual-backlog.json');

// editorialResolutions dokumentieren Befunde der amtlichen Quelle (z. B. abweichende Bezeichnungen
// in der sächsischen Ausgangsfassung) und sind wie sourceNotes Provenienz, kein Normtext.
const PROVENANCE_KEYS = new Set(['sourceReferences', 'sourceNotes', 'enactingBody', 'originEnactingBody', 'editorialResolutions']);
const ADDRESS_PATTERN = /(?:https?:\/\/|www\.)[^\s"“”)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu;
const TEXT_SOURCE_EXTENSIONS = new Set(['.html', '.htm', '.md', '.txt']);
const WINDOW_LETTERS = 24;

function collectNormativeStrings(value, path, output) {
  if (typeof value === 'string') {
    output.push({ path, value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectNormativeStrings(entry, `${path}[${index}]`, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, entry] of Object.entries(value)) {
    if (PROVENANCE_KEYS.has(key)) continue;
    collectNormativeStrings(entry, `${path}.${key}`, output);
  }
  return output;
}

/** Wörter, die nur durch eine fehlerhafte Anpassung entstehen können (z. B. aus „Niedersächsisch“). */
const ADAPTER_ARTEFACT_PATTERN = /\b[Nn]iederostdeutsch\p{L}*/u;

/** Buchstaben-/Ziffernfolge ohne Satzzeichen und Leerraum (Vergleich mit der Quelle). */
export function lettersOnly(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu, '');
}

function windowAround(value, index, length) {
  const before = lettersOnly(value.slice(0, index)).slice(-WINDOW_LETTERS);
  const after = lettersOnly(value.slice(index + length)).slice(0, WINDOW_LETTERS);
  return `${before}${lettersOnly(value.slice(index, index + length))}${after}`;
}

export function auditNormRecord({ slug, meta, versions }) {
  const strings = collectNormativeStrings({ meta, versions }, slug, []);
  const findings = [];
  for (const { path, value } of strings) {
    if (/\.(?:id|slug)$/u.test(path)) continue; // Identifikatoren, keine normativen Texte
    const cleaned = value.replace(ADDRESS_PATTERN, ' ');
    const residual = findSaxonResidual(cleaned);
    if (residual) {
      const index = cleaned.indexOf(residual.token);
      findings.push({ path, token: residual.token, context: residual.context, window: windowAround(cleaned, Math.max(index, 0), residual.token.length) });
    }
    const artefact = cleaned.match(ADAPTER_ARTEFACT_PATTERN);
    if (artefact) findings.push({ path, token: artefact[0], context: cleaned.slice(Math.max(0, artefact.index - 40), artefact.index + artefact[0].length + 40).replace(/\s+/gu, ' '), window: windowAround(cleaned, artefact.index, artefact[0].length), artefact: true });
  }
  return findings;
}

/** Baseline-Import aus dem R2-Archiv (Vollbestand zum Stichtag). */
export function isBaselineImport(meta, versions) {
  const references = [...(meta.sourceReferences ?? []), ...versions.flatMap((version) => version.sourceReferences ?? [])];
  return references.some((reference) => reference.kind === 'revosax-snapshot' && reference.availability === 'r2-archived');
}

/** Übergeleitetes sächsisches Recht: irgendeine REVOSax-Quelle (Baseline oder versionierter Snapshot). */
export function isInheritedNorm(meta, versions) {
  const references = [...(meta.sourceReferences ?? []), ...versions.flatMap((version) => version.sourceReferences ?? [])];
  return references.some((reference) => reference.kind === 'revosax-snapshot');
}

/** Lokale amtliche Textquellen (Gesetze/*.html, *.md) einer eigenen ostdeutschen Norm. */
export function localTextSources(meta, versions) {
  const references = [...(meta.sourceReferences ?? []), ...versions.flatMap((version) => version.sourceReferences ?? [])];
  return [...new Set(references.map((reference) => reference.localSource).filter((path) => path && TEXT_SOURCE_EXTENSIONS.has(extname(path).toLowerCase())))];
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', sect: '§', ndash: '–', mdash: '—', bdquo: '„', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', euro: '€' };

/** Text einer HTML-/Markdown-Quelle für den wörtlichen Vergleich. */
export function sourceTextOf(raw, path) {
  const text = ['.html', '.htm'].includes(extname(path).toLowerCase())
    ? raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, ' ').replace(/<[^>]+>/gu, ' ')
    : raw;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (match, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(Number.parseInt(entity[1] === 'x' || entity[1] === 'X' ? entity.slice(2) : entity.slice(1), entity[1] === 'x' || entity[1] === 'X' ? 16 : 10));
    return ENTITIES[entity] ?? match;
  });
}

export function createSourceTextLoader(root = ROOT) {
  const cache = new Map();
  return async (path) => {
    if (cache.has(path)) return cache.get(path);
    let letters = null;
    try {
      letters = lettersOnly(sourceTextOf(await readFile(resolve(root, path), 'utf8'), path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    cache.set(path, letters);
    return letters;
  };
}

/** Eine Fundstelle gilt als amtlich belegt, wenn ihr Buchstabenfenster wörtlich in einer Quelle vorkommt. */
export async function isSourceBacked(finding, sources, loadSource) {
  if (finding.artefact) return false;
  for (const path of sources) {
    const letters = await loadSource(path);
    if (letters && letters.includes(finding.window)) return true;
  }
  return false;
}

/**
 * Dokumentierte PDF-Prüfung: gilt für genau dieses Feld dieser Norm, solange das PDF
 * hashidentisch ist und das dokumentierte Zitat den Buchstabenkontext der Fundstelle enthält.
 */
export async function isPdfVerified(slug, finding, verifications, hashFile) {
  for (const entry of verifications ?? []) {
    if (entry.slug !== slug || entry.path !== finding.path || finding.artefact) continue;
    if (!lettersOnly(entry.quote).includes(lettersOnly(finding.token))) continue;
    const digest = await hashFile(entry.localSource);
    if (digest && digest === entry.sha256) return true;
  }
  return false;
}

export function createFileHasher(root = ROOT) {
  const cache = new Map();
  return async (path) => {
    if (cache.has(path)) return cache.get(path);
    let digest = null;
    try {
      digest = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    cache.set(path, digest);
    return digest;
  };
}

export async function loadCorpus(contentRoot = CONTENT_ROOT) {
  const entries = (await readdir(contentRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const norms = [];
  for (const slug of entries) {
    const directory = join(contentRoot, slug);
    const meta = JSON.parse(await readFile(join(directory, 'meta.json'), 'utf8'));
    const versionFiles = (await readdir(join(directory, 'versions'))).filter((file) => file.endsWith('.json')).sort();
    const versions = [];
    for (const file of versionFiles) versions.push(JSON.parse(await readFile(join(directory, 'versions', file), 'utf8')));
    norms.push({ slug, meta, versions });
  }
  return norms;
}

/**
 * Prüft den gesamten Bestand. Liefert je Norm die Reststellen des übergeleiteten Rechts
 * (müssen leer sein), unbelegte Sachsen-Bezüge eigener Erlasse (Rückstand) und die
 * quellenbelegten Bezüge eigener Erlasse (nachrichtlich).
 */
export async function auditCorpus(norms, backlog, { loadSource = createSourceTextLoader(), hashFile = createFileHasher() } = {}) {
  const inherited = [];
  const legacy = new Map();
  const backed = new Map();
  for (const norm of norms) {
    const findings = auditNormRecord(norm);
    if (findings.length === 0) continue;
    if (isInheritedNorm(norm.meta, norm.versions)) {
      inherited.push({ slug: norm.slug, findings });
      continue;
    }
    const sources = localTextSources(norm.meta, norm.versions);
    const unbacked = [];
    const documented = [];
    for (const finding of findings) {
      if (await isSourceBacked(finding, sources, loadSource) || await isPdfVerified(norm.slug, finding, backlog?.pdfVerifications, hashFile)) documented.push(finding);
      else unbacked.push(finding);
    }
    if (documented.length > 0) backed.set(norm.slug, documented);
    if (unbacked.length > 0) legacy.set(norm.slug, unbacked);
  }
  const recorded = new Map(Object.entries(backlog?.norms ?? {}).map(([slug, entry]) => [slug, entry.residuals]));
  const problems = [];
  for (const { slug, findings } of inherited) {
    problems.push(`${slug}: ${findings.length} Sachsen-Reststelle(n) in übergeleitetem Recht, z. B. ${findings[0].path}: „${findings[0].context}“`);
  }
  for (const [slug, findings] of legacy) {
    const expected = recorded.get(slug);
    if (expected === undefined) {
      problems.push(`${slug}: ${findings.length} unbelegte(r) Sachsen-Bezug/Bezüge im eigenen Erlass, nicht im Rückstand data/recht/ost-residual-backlog.json verzeichnet (z. B. ${findings[0].path}: „${findings[0].context}“)`);
    } else if (expected !== findings.length) {
      problems.push(`${slug}: ${findings.length} unbelegte(r) Sachsen-Bezug/Bezüge, Rückstand verzeichnet ${expected}; nach redaktioneller Änderung mit --update-backlog fortschreiben`);
    }
  }
  for (const slug of recorded.keys()) {
    if (!legacy.has(slug)) problems.push(`${slug}: im Rückstand verzeichnet, aber ohne unbelegte Reststellen oder nicht mehr vorhanden; mit --update-backlog fortschreiben`);
  }
  return { baseline: inherited, inherited, legacy, backed, problems };
}

export function buildBacklog(legacy, previous = {}) {
  const norms = {};
  for (const slug of [...legacy.keys()].sort()) {
    const findings = legacy.get(slug);
    const tokens = [...new Set(findings.map((finding) => finding.token))].sort();
    norms[slug] = {
      residuals: findings.length,
      tokens,
      note: previous.norms?.[slug]?.note ?? 'Unbelegter Sachsen-Bezug; redaktionell zu klären (Quelle fehlt oder Wortlaut weicht ab).',
    };
  }
  return {
    ...(previous.pdfVerifications?.length ? { pdfVerifications: previous.pdfVerifications } : {}),
    schemaVersion: 2,
    description: 'Sachsen-Reststellen, die der Audit scripts/audit-ost-residuals.mjs nicht als übergeleitet (Adapter) und nicht als amtlich belegt (eigener ostdeutscher Erlass, wörtlich in Gesetze/) einordnen kann. Der Audit verlangt exakt diese Zähler; jede Änderung ist eine bewusste redaktionelle Entscheidung und wird mit --update-backlog fortgeschrieben. Zielzustand: leer.',
    updatedAt: new Date().toISOString().slice(0, 10),
    normCount: Object.keys(norms).length,
    residualCount: Object.values(norms).reduce((sum, entry) => sum + entry.residuals, 0),
    norms,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update-backlog');
  const quiet = args.includes('--quiet');
  let backlog = null;
  try {
    backlog = JSON.parse(await readFile(BACKLOG_PATH, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const norms = await loadCorpus();
  const { inherited, legacy, backed, problems } = await auditCorpus(norms, backlog);
  const legacyResiduals = [...legacy.values()].reduce((sum, findings) => sum + findings.length, 0);
  const backedReferences = [...backed.values()].reduce((sum, findings) => sum + findings.length, 0);
  if (update) {
    await writeFile(BACKLOG_PATH, `${JSON.stringify(buildBacklog(legacy, backlog ?? {}), null, 2)}\n`, 'utf8');
    console.log(`Rückstand fortgeschrieben: ${legacy.size} Normen mit ${legacyResiduals} unbelegten Reststellen.`);
  }
  if (inherited.length > 0 || (!update && problems.length > 0)) {
    for (const problem of problems.slice(0, 60)) console.error(`- ${problem}`);
    console.error(`Rechtsüberleitungs-Audit fehlgeschlagen: ${inherited.length} übergeleitete Norm(en) mit Reststellen, ${problems.length} Problem(e) insgesamt.`);
    process.exitCode = 1;
    return;
  }
  if (!quiet) {
    console.log(`Rechtsüberleitungs-Audit erfolgreich: ${norms.length} Normen geprüft, 0 Reststellen im übergeleiteten Recht, ${legacy.size} Normen / ${legacyResiduals} unbelegte Stellen im Rückstand; ${backed.size} eigene Erlasse mit ${backedReferences} amtlich belegten Sachsen-Bezügen (nachrichtlich).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
