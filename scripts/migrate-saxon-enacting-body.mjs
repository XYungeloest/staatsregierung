#!/usr/bin/env node --experimental-strip-types

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { getNormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';

/**
 * Migriert Altmetadaten übernommener Normen: Das Feld `enactingBody` bezeichnet das erlassende
 * Organ im ostdeutschen Rechtsbestand; ein sächsisches Organ gehört als historisches
 * Ursprungsorgan der übernommenen Quelle in `originEnactingBody`.
 *
 * Sichere Regel: Eine Norm wird nur migriert, wenn ihre sächsische Herkunft unabhängig belegt
 * ist (REVOSax-Snapshot in den Quellenreferenzen von meta.json oder einer Fassung). Fehlt der
 * Beleg, wird der Fall gemeldet und nicht geschrieben. Vor und nach der Migration muss die
 * Herkunftsklasse (getNormOriginInfo(record).kind) identisch bleiben; sonst wird die Norm
 * ebenfalls nicht geschrieben.
 *
 * Aufruf: node --experimental-strip-types scripts/migrate-saxon-enacting-body.mjs [--write] [--json]
 */

const ROOT = resolve(process.cwd());
export const SAXON_BODY_PATTERN = /Sächs|Sachsen/u;

function hasRevosaxProvenance(record) {
  return [
    ...(record.meta.sourceReferences ?? []),
    ...record.versions.flatMap((version) => version.sourceReferences ?? []),
  ].some((source) => source.kind === 'revosax-snapshot');
}

/** Reiner Migrationsplan über den vollständigen Bestand (Herkunft wird korpusweit berechnet). */
export function planSaxonEnactingBodyMigration(records) {
  const candidates = records.filter((record) => SAXON_BODY_PATTERN.test(record.meta.enactingBody ?? ''));
  const plan = [];
  for (const record of candidates) {
    const before = getNormOriginInfo(record, records).kind;
    const entry = { slug: record.meta.slug, enactingBody: record.meta.enactingBody, originEnactingBody: record.meta.originEnactingBody ?? null, originBefore: before, originAfter: before, action: 'migrate', reason: '' };
    if (!hasRevosaxProvenance(record)) {
      entry.action = 'manual';
      entry.reason = 'kein REVOSax-Snapshot als Herkunftsbeleg';
      plan.push(entry);
      continue;
    }
    if (record.meta.originEnactingBody && record.meta.originEnactingBody !== record.meta.enactingBody) {
      entry.action = 'manual';
      entry.reason = `originEnactingBody bereits abweichend gesetzt (${record.meta.originEnactingBody})`;
      plan.push(entry);
      continue;
    }
    const { enactingBody, ...rest } = record.meta;
    const migratedRecord = { ...record, meta: { ...rest, originEnactingBody: enactingBody } };
    const migratedRecords = records.map((entry2) => (entry2 === record ? migratedRecord : entry2));
    entry.originAfter = getNormOriginInfo(migratedRecord, migratedRecords).kind;
    if (entry.originAfter !== before) {
      entry.action = 'manual';
      entry.reason = `Herkunftsklasse würde sich ändern (${before} → ${entry.originAfter})`;
    }
    plan.push(entry);
  }
  return plan.sort((left, right) => left.slug.localeCompare(right.slug));
}

/** Schreibt meta.json mit originEnactingBody an der Stelle von enactingBody (Feldreihenfolge bleibt lesbar). */
function migrateMetaJson(meta) {
  const migrated = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key === 'enactingBody') {
      migrated.originEnactingBody = value;
      continue;
    }
    if (key === 'originEnactingBody') continue;
    migrated[key] = value;
  }
  return migrated;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const records = await loadAllNorms();
  const plan = planSaxonEnactingBodyMigration(records);
  const migratable = plan.filter((entry) => entry.action === 'migrate');
  const manual = plan.filter((entry) => entry.action === 'manual');
  if (args.includes('--json')) {
    console.log(JSON.stringify({ candidates: plan.length, migratable: migratable.length, manual: manual.length, plan }, null, 2));
  } else {
    console.log(`Kandidaten mit sächsischem enactingBody: ${plan.length}; migrierbar: ${migratable.length}; manuell zu klären: ${manual.length}`);
    for (const entry of plan) {
      console.log(`  ${entry.action === 'migrate' ? 'MIGRATE' : 'MANUAL '} ${entry.slug}: ${entry.enactingBody} → originEnactingBody (${entry.originBefore}${entry.originAfter !== entry.originBefore ? ` → ${entry.originAfter}` : ''})${entry.reason ? ` – ${entry.reason}` : ''}`);
    }
  }
  if (!write) return;
  for (const entry of migratable) {
    const path = join(ROOT, 'content', 'normen', entry.slug, 'meta.json');
    const meta = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(path, `${JSON.stringify(migrateMetaJson(meta), null, 2)}\n`, 'utf8');
  }
  console.log(`${migratable.length} meta.json-Dateien geschrieben.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
