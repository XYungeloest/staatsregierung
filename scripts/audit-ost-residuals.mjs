#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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
 * sourceNotes (Beschreibung der amtlichen Quelle), enactingBody/originEnactingBody
 * (historisches Ursprungsorgan, dokumentierte Semantik) sowie E-Mail-/Web-Adressen.
 *
 * Normen mit revosax-baseline-Provenienz müssen reststellenfrei sein. Der
 * redaktionelle Altbestand, der vor dem Rechtsüberleitungsadapter aus den
 * HTML-Quellen unter Gesetze/ übernommen wurde, wird nicht still geduldet, sondern
 * als versionierter Rückstand in data/recht/ost-residual-backlog.json geführt:
 * jede Abweichung von den dort verzeichneten Zählern (nach oben oder unten) lässt
 * den Audit fehlschlagen; --update-backlog schreibt den Stand nach einer
 * bewussten redaktionellen Änderung neu.
 */

const ROOT = resolve(process.cwd());
const CONTENT_ROOT = join(ROOT, 'content', 'normen');
const BACKLOG_PATH = join(ROOT, 'data', 'recht', 'ost-residual-backlog.json');

const PROVENANCE_KEYS = new Set(['sourceReferences', 'sourceNotes', 'enactingBody', 'originEnactingBody']);
const ADDRESS_PATTERN = /(?:https?:\/\/|www\.)[^\s"“”)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu;

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

export function auditNormRecord({ slug, meta, versions }) {
  const strings = collectNormativeStrings({ meta, versions }, slug, []);
  const findings = [];
  for (const { path, value } of strings) {
    if (/\.(?:id|slug)$/u.test(path)) continue; // Identifikatoren, keine normativen Texte
    const cleaned = value.replace(ADDRESS_PATTERN, ' ');
    const residual = findSaxonResidual(cleaned);
    if (residual) findings.push({ path, token: residual.token, context: residual.context });
    const artefact = cleaned.match(ADAPTER_ARTEFACT_PATTERN);
    if (artefact) findings.push({ path, token: artefact[0], context: cleaned.slice(Math.max(0, artefact.index - 40), artefact.index + artefact[0].length + 40).replace(/\s+/gu, ' ') });
  }
  return findings;
}

export function isBaselineImport(meta, versions) {
  const references = [...(meta.sourceReferences ?? []), ...versions.flatMap((version) => version.sourceReferences ?? [])];
  return references.some((reference) => reference.kind === 'revosax-snapshot' && reference.availability === 'r2-archived');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function loadCorpus(contentRoot = CONTENT_ROOT) {
  const entries = (await readdir(contentRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const norms = [];
  for (const slug of entries) {
    const directory = join(contentRoot, slug);
    const meta = await readJson(join(directory, 'meta.json'));
    const versionFiles = (await readdir(join(directory, 'versions'))).filter((file) => file.endsWith('.json')).sort();
    const versions = [];
    for (const file of versionFiles) versions.push(await readJson(join(directory, 'versions', file)));
    norms.push({ slug, meta, versions });
  }
  return norms;
}

/**
 * Prüft den gesamten Bestand. Liefert Befunde je Norm, getrennt nach
 * Baseline-Import (muss leer sein) und redaktionellem Altbestand (Backlog).
 */
export function auditCorpus(norms, backlog) {
  const baseline = [];
  const legacy = new Map();
  for (const norm of norms) {
    const findings = auditNormRecord(norm);
    if (findings.length === 0) continue;
    if (isBaselineImport(norm.meta, norm.versions)) baseline.push({ slug: norm.slug, findings });
    else legacy.set(norm.slug, findings);
  }
  const recorded = new Map(Object.entries(backlog?.norms ?? {}).map(([slug, entry]) => [slug, entry.residuals]));
  const problems = [];
  for (const { slug, findings } of baseline) {
    problems.push(`${slug}: ${findings.length} Sachsen-Reststelle(n) in übernommenem Recht, z. B. ${findings[0].path}: „${findings[0].context}“`);
  }
  for (const [slug, findings] of legacy) {
    const expected = recorded.get(slug);
    if (expected === undefined) {
      problems.push(`${slug}: ${findings.length} Sachsen-Reststelle(n) im Altbestand, nicht im Rückstand data/recht/ost-residual-backlog.json verzeichnet (z. B. ${findings[0].path}: „${findings[0].context}“)`);
    } else if (expected !== findings.length) {
      problems.push(`${slug}: ${findings.length} Sachsen-Reststelle(n) im Altbestand, Rückstand verzeichnet ${expected}; nach redaktioneller Änderung mit --update-backlog fortschreiben`);
    }
  }
  for (const slug of recorded.keys()) {
    if (!legacy.has(slug)) problems.push(`${slug}: im Rückstand verzeichnet, aber ohne Reststellen oder nicht mehr vorhanden; mit --update-backlog fortschreiben`);
  }
  return { baseline, legacy, problems };
}

export function buildBacklog(legacy, previous = {}) {
  const norms = {};
  for (const slug of [...legacy.keys()].sort()) {
    const findings = legacy.get(slug);
    const tokens = [...new Set(findings.map((finding) => finding.token))].sort();
    norms[slug] = {
      residuals: findings.length,
      tokens,
      note: previous.norms?.[slug]?.note ?? 'Redaktioneller Altbestand vor dem Rechtsüberleitungsadapter; Bezeichnungen sind über die Konsolidierung aus Gesetze/ nachzuziehen.',
    };
  }
  return {
    schemaVersion: 1,
    description: 'Sachsen-Reststellen im redaktionellen Altbestand (keine Baseline-Importe). Der Audit scripts/audit-ost-residuals.mjs verlangt exakt diese Zähler; jede Änderung ist eine bewusste redaktionelle Entscheidung und wird mit --update-backlog fortgeschrieben.',
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
    backlog = await readJson(BACKLOG_PATH);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const norms = await loadCorpus();
  const { baseline, legacy, problems } = auditCorpus(norms, backlog);
  const legacyResiduals = [...legacy.values()].reduce((sum, findings) => sum + findings.length, 0);
  if (update) {
    await writeFile(BACKLOG_PATH, `${JSON.stringify(buildBacklog(legacy, backlog ?? {}), null, 2)}\n`, 'utf8');
    console.log(`Rückstand fortgeschrieben: ${legacy.size} Altbestandsnormen mit ${legacyResiduals} Reststellen.`);
  }
  if (baseline.length > 0 || (!update && problems.length > 0)) {
    for (const problem of problems.slice(0, 60)) console.error(`- ${problem}`);
    console.error(`Rechtsüberleitungs-Audit fehlgeschlagen: ${baseline.length} übernommene Norm(en) mit Reststellen, ${problems.length} Problem(e) insgesamt.`);
    process.exitCode = 1;
    return;
  }
  if (!quiet) {
    console.log(`Rechtsüberleitungs-Audit erfolgreich: ${norms.length} Normen geprüft, 0 Reststellen im übernommenen Recht; Altbestand-Rückstand ${legacy.size} Normen / ${legacyResiduals} Stellen wie verzeichnet.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
