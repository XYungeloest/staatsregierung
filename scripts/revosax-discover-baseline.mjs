#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  DEFAULT_BASELINE_DATE,
  RevosaxDiscoveryError,
  RevosaxHttpError,
  assertIsoDate,
  discoverBaseline,
} from './lib/revosax-discovery.mjs';

/**
 * Ermittelt den vollständigen REVOSax-Bestand zu einem Geltungstag über die
 * echte erweiterte Suche (`GET /suche?search_request=<JSON>` mit Session-
 * Pagination). Der Ablauf, das reale Requestformat und die fail-closed-Regeln
 * sind in `scripts/lib/revosax-discovery.mjs` und docs/REVOSAX_BULK_IMPORT.md
 * dokumentiert. Ohne exakt konsistenten Trefferbestand wird kein Manifest
 * geschrieben.
 */

const USAGE = `Verwendung: node scripts/revosax-discover-baseline.mjs [Optionen]

Optionen:
  --date <YYYY-MM-DD>   Geltungstag der REVOSax-Suche (Standard: ${DEFAULT_BASELINE_DATE})
  --output <Pfad>       Zielmanifest (Standard: data/recht/revosax-baseline-<Datum>.json)
  --delay-ms <ms>       Pause zwischen Ergebnisseiten (Standard: 250)
  --max-pages <n>       Obergrenze der Ergebnisseiten (Standard: 2000)
  --max-passes <n>      vollständige Durchläufe bei instabiler Pagination (Standard: 3)
  --help                Diese Hilfe`;

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function integerOption(args, flag, fallback) {
  const raw = valueAfter(args, flag);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) throw new RevosaxDiscoveryError(`${flag} erwartet eine nichtnegative ganze Zahl, erhalten: ${raw}`);
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const isoDate = assertIsoDate(valueAfter(args, '--date') ?? DEFAULT_BASELINE_DATE);
  const output = resolve(valueAfter(args, '--output') ?? `data/recht/revosax-baseline-${isoDate}.json`);
  const delayMs = integerOption(args, '--delay-ms', 250);
  const maxPages = integerOption(args, '--max-pages', 2000);
  const maxPasses = integerOption(args, '--max-passes', 3);
  const startedAt = Date.now();

  let manifest;
  try {
    manifest = await discoverBaseline({
      date: isoDate,
      delayMs,
      maxPages,
      maxPasses,
      log: (message) => console.error(message),
    });
  } catch (error) {
    if (error?.details) {
      // Diagnosedaten bewusst nur unter .cache/, nie als Manifest unter data/.
      const rejectedPath = resolve(`.cache/revosax-baseline/${isoDate}/discovery-rejected.json`);
      await mkdir(dirname(rejectedPath), { recursive: true });
      await writeFile(rejectedPath, `${JSON.stringify({ rejectedAt: new Date().toISOString(), reason: error.message, ...error.details }, null, 2)}\n`, 'utf8');
      console.error(`Abgelehnter Trefferbestand zur Diagnose: ${rejectedPath}`);
    }
    throw error;
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`${manifest.discoveredCount} REVOSax-Treffer für ${isoDate} (${manifest.pageCount} Seiten, ${manifest.passes.length} Durchlauf/-läufe, ${seconds} s) nach ${output} geschrieben.`);
  const multiVersion = Object.keys(manifest.multiVersionLawIds).length;
  if (multiVersion > 0) console.log(`${multiVersion} lawId(s) mit mehreren Fassungen am Stichtag; Auflösung im Staging.`);
  console.log(Object.entries(manifest.categoryCounts).map(([category, count]) => `${category}=${count}`).join(', '));
}

try {
  await main();
} catch (error) {
  if (error instanceof RevosaxDiscoveryError || error instanceof RevosaxHttpError) {
    console.error(`Discovery abgebrochen: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
