#!/usr/bin/env node --experimental-strip-types

import { appendFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import {
  DEFAULT_PERSIST_DIR,
  DEFAULT_SEED_CACHE_DIR,
  buildSeedSnapshot,
  ensureLocalSeed,
  installSeedSnapshot,
  runtimeSeedIdentity,
  seedFileName,
  verifySeedSnapshot,
} from './lib/d1-runtime-seed.mjs';

/**
 * CLI für den lokalen D1-Seed von OstRecht (scripts/lib/d1-runtime-seed.mjs).
 *
 *   node --experimental-strip-types scripts/d1-runtime-seed.mjs fingerprint [--json] [--ref <Git-Ref>]
 *   node --experimental-strip-types scripts/d1-runtime-seed.mjs build   [--out <Datei>]
 *   node --experimental-strip-types scripts/d1-runtime-seed.mjs verify  [--snapshot <Datei>]
 *   node --experimental-strip-types scripts/d1-runtime-seed.mjs install [--snapshot <Datei>] [--persist-to <Verzeichnis>]
 *   node --experimental-strip-types scripts/d1-runtime-seed.mjs ensure  [--persist-to <Verzeichnis>] [--force]
 *
 * Gemeinsame Optionen: --fixture <Datei> (oder OSTRECHT_D1_FIXTURE) für das Testfixture,
 * --cache-dir <Verzeichnis> (oder OSTRECHT_D1_SEED_CACHE, Standard .cache/d1-seed),
 * --persist-to (oder OSTRECHT_D1_PERSIST_TO, Standard .cache/wrangler-local).
 * `fingerprint` gibt ohne --json nur den Seed-Fingerabdruck aus (maschinenlesbar für Cache-Keys);
 * `--ref` bestimmt ihn für einen Git-Ref (Vollbestand, ohne Checkout – Cache-Schlüssel der Basis
 * eines Äquivalenznachweises), `--json` nennt daneben den Fingerabdruck der früheren Berechnung.
 * `ensure` schreibt Status und Dauern zusätzlich nach GITHUB_OUTPUT/GITHUB_STEP_SUMMARY, wenn gesetzt.
 */

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const command = args[0];

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const fixture = valueAfter('--fixture') ?? (process.env.OSTRECHT_D1_FIXTURE || null);
const cacheDir = valueAfter('--cache-dir') ?? process.env.OSTRECHT_D1_SEED_CACHE ?? DEFAULT_SEED_CACHE_DIR;
const persistTo = valueAfter('--persist-to') ?? process.env.OSTRECHT_D1_PERSIST_TO ?? DEFAULT_PERSIST_DIR;
const json = args.includes('--json');
const force = args.includes('--force');

async function defaultSnapshotPath() {
  const identity = await runtimeSeedIdentity({ root: ROOT, fixture });
  return { identity, path: join(resolve(ROOT, cacheDir), seedFileName(identity)) };
}

async function reportEnsure(result) {
  const summary = {
    seed_status: result.status,
    seed_fingerprint: result.identity.fingerprint,
    seed_scope: result.identity.scope,
    seed_fingerprint_seconds: result.timings.fingerprintSeconds,
    seed_build_seconds: result.timings.buildSeconds,
    seed_verify_seconds: result.timings.verifySeconds,
    seed_install_seconds: result.timings.installSeconds,
    seed_total_seconds: result.totalSeconds,
  };
  console.log(`D1-Seed: ${JSON.stringify(summary)}`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${Object.entries(summary).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, 'utf8');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const label = { current: 'bereits eingesetzt', restored: 'aus Cache wiederhergestellt (keine Projektion)', built: 'neu gebaut (genau eine Projektion)' }[result.status] ?? result.status;
    await appendFile(process.env.GITHUB_STEP_SUMMARY, [
      `### D1-Seed (${result.identity.scope})`,
      '',
      '| Schritt | Wert |',
      '| --- | --- |',
      `| Status | ${label} |`,
      `| Seed-Fingerabdruck | \`${result.identity.fingerprint.slice(0, 16)}…\` |`,
      `| Fingerabdruck | ${result.timings.fingerprintSeconds} s |`,
      `| Projektion (Build) | ${result.timings.buildSeconds} s |`,
      `| Verifikation | ${result.timings.verifySeconds} s |`,
      `| Einsetzen in Miniflare | ${result.timings.installSeconds} s |`,
      `| Gesamt | ${result.totalSeconds} s |`,
      '',
    ].join('\n'), 'utf8');
  }
}

switch (command) {
  case 'fingerprint': {
    const ref = valueAfter('--ref') ?? null;
    const identity = await runtimeSeedIdentity({ root: ROOT, fixture: ref ? null : fixture, ref });
    if (json) {
      console.log(JSON.stringify({
        fingerprint: identity.fingerprint,
        legacyFingerprint: identity.legacyFingerprint,
        ref: identity.ref,
        format: identity.format,
        scope: identity.scope,
        mode: identity.mode,
        projectionFingerprint: identity.projection.fingerprint,
        projectionLogicHash: identity.projection.logic,
        corpusContentHash: identity.projection.corpus,
        portalContentHash: identity.projection.portal,
        seedToolHash: identity.seedToolHash,
        toolVersions: identity.toolVersions,
        snapshot: relative(ROOT, join(resolve(ROOT, cacheDir), seedFileName(identity))),
      }, null, 2));
    } else {
      console.log(identity.fingerprint);
    }
    break;
  }
  case 'build': {
    const { identity, path } = await defaultSnapshotPath();
    const out = valueAfter('--out') ?? path;
    await buildSeedSnapshot({ root: ROOT, fixture, out, identity });
    break;
  }
  case 'verify': {
    const { identity, path } = await defaultSnapshotPath();
    await verifySeedSnapshot({ root: ROOT, fixture, snapshot: valueAfter('--snapshot') ?? path, identity });
    break;
  }
  case 'install': {
    const { identity, path } = await defaultSnapshotPath();
    const snapshot = valueAfter('--snapshot') ?? path;
    await verifySeedSnapshot({ root: ROOT, fixture, snapshot, identity });
    await installSeedSnapshot({ root: ROOT, snapshot, persistTo, identity, fixture });
    break;
  }
  case 'ensure': {
    const result = await ensureLocalSeed({ root: ROOT, fixture, persistTo, cacheDir, force });
    await reportEnsure(result);
    break;
  }
  default:
    console.error('Verwendung: d1-runtime-seed.mjs fingerprint [--json] | build [--out <Datei>] | verify [--snapshot <Datei>] | install [--snapshot <Datei>] [--persist-to <Verzeichnis>] | ensure [--persist-to <Verzeichnis>] [--force]  (jeweils optional --fixture <Datei>, --cache-dir <Verzeichnis>)');
    process.exit(2);
}
