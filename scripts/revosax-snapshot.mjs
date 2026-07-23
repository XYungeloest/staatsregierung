#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { parseRevosaxSnapshot } from './lib/revosax-parser.mjs';

const ROOT = process.cwd();
const CONFIG_PATH = resolve(ROOT, 'data/recht/consolidation-sources.json');
const args = process.argv.slice(2);
const command = args[0] ?? 'audit';
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = valueAfter('--target');
const urlArgument = valueAfter('--url');
const snapshotId = valueAfter('--snapshot-id');

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readConfig() {
  return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function requireTarget(config) {
  if (!target) throw new Error(`${command}: --target <slug> fehlt`);
  const configured = config.targets[target];
  if (!configured && command !== 'fetch') throw new Error(`${command}: unbekanntes Ziel ${target}`);
  return configured;
}

function requireConfiguredSource(configuredTarget) {
  if (!snapshotId) return configuredTarget;
  const source = configuredTarget?.adoptedSources?.find((entry) => entry.id === snapshotId);
  if (!source) throw new Error(`${command}: unbekannte Zusatzquelle ${target}/${snapshotId}`);
  return source;
}

async function fetchSnapshot() {
  const config = await readConfig();
  const configuredTarget = config.targets[target] ?? {};
  const configured = requireConfiguredSource(configuredTarget);
  if (!target || !urlArgument) throw new Error('fetch: --target <slug> und --url <historische-url> sind erforderlich');
  const url = new URL(urlArgument);
  if (url.protocol !== 'https:' || url.hostname !== 'www.revosax.sachsen.de' || !/^\/vorschrift\/\d+(?:\.\d+)?$/u.test(url.pathname)) {
    throw new Error(`fetch: nur amtliche historische REVOSax-URLs sind zulässig: ${urlArgument}`);
  }
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-encoding': 'identity',
      'user-agent': 'Ostrecht-Portal Quellenarchiv/1.0',
    },
  });
  if (!response.ok) throw new Error(`fetch: REVOSax antwortet mit HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const html = bytes.toString('utf8');
  const parsed = parseRevosaxSnapshot(html, { url: url.toString() });
  if (!(configuredTarget.aliases ?? [configuredTarget.title]).filter(Boolean).some((alias) =>
    parsed.sourceTitle.toLocaleLowerCase('de').includes(alias.toLocaleLowerCase('de').replace(/^gesetz\s+/iu, ''))
  )) {
    throw new Error(`fetch: Quelltitel „${parsed.sourceTitle}“ passt nicht zum Ziel ${target}`);
  }
  const snapshotDate = snapshotId ? configured.versionDate : config.baselineSnapshotDate;
  if (!parsed.sourceValidFrom ||
      !snapshotDate ||
      snapshotDate < parsed.sourceValidFrom ||
      (parsed.sourceValidTo && snapshotDate > parsed.sourceValidTo)) {
    throw new Error(`fetch: Fassung ${parsed.sourceValidFrom ?? '?'} bis ${parsed.sourceValidTo ?? '?'} galt nicht am ${snapshotDate ?? '?'}`);
  }
  const versionPart = basename(url.pathname);
  const snapshot = configured.snapshot ??
    `data/recht/sources/revosax/${target}/${versionPart}.html`;
  const snapshotPath = resolve(ROOT, snapshot);
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, bytes);
  const updatedSource = {
    ...configured,
    revosaxLawId: configured.revosaxLawId ?? configuredTarget.revosaxLawId ?? versionPart.split('.')[0],
    baselineUrl: url.toString(),
    sourceValidFrom: parsed.sourceValidFrom,
    sourceValidTo: parsed.sourceValidTo,
    snapshot,
    retrievedAt: new Date().toISOString().slice(0, 10),
    sourceSha256: hash(bytes),
  };
  if (snapshotId) {
    configuredTarget.adoptedSources = configuredTarget.adoptedSources.map((entry) =>
      entry.id === snapshotId ? updatedSource : entry
    );
    config.targets[target] = configuredTarget;
  } else {
    config.targets[target] = {
      ...configuredTarget,
      ...updatedSource,
      title: configuredTarget.title ?? parsed.sourceTitle,
      aliases: configuredTarget.aliases ?? [parsed.sourceTitle],
      baselineSnapshotDate: config.baselineSnapshotDate,
    };
  }
  await writeJson(CONFIG_PATH, config);
  console.log(`${target}${snapshotId ? `/${snapshotId}` : ''}: ${bytes.length} Byte gespeichert, SHA-256 ${hash(bytes)}`);
}

async function parseSnapshot() {
  const config = await readConfig();
  const configuredTarget = requireTarget(config);
  const configured = requireConfiguredSource(configuredTarget);
  const bytes = await readFile(resolve(ROOT, configured.snapshot));
  if (hash(bytes) !== configured.sourceSha256) throw new Error(`${target}: Snapshot-Hash weicht von der Quellenkonfiguration ab`);
  const parsed = parseRevosaxSnapshot(bytes.toString('utf8'), { url: configured.baselineUrl });
  const output = resolve(ROOT, `data/recht/parsed/revosax/${target}${snapshotId ? `--${snapshotId}` : ''}.json`);
  await writeJson(output, parsed);
  console.log(`${target}${snapshotId ? `/${snapshotId}` : ''}: ${parsed.body.length} äußere Blöcke nach ${output.replace(`${ROOT}/`, '')} geschrieben`);
}

async function auditSnapshots() {
  const config = await readConfig();
  const targets = target ? [[target, requireTarget(config)]] : Object.entries(config.targets);
  const failures = [];
  for (const [slug, configuredTarget] of targets) {
    const sources = snapshotId
      ? [[snapshotId, requireConfiguredSource(configuredTarget)]]
      : [['baseline', configuredTarget], ...(configuredTarget.adoptedSources ?? []).map((entry) => [entry.id, entry])];
    for (const [sourceId, configured] of sources) {
    try {
      await access(resolve(ROOT, configured.snapshot));
      const bytes = await readFile(resolve(ROOT, configured.snapshot));
      if (hash(bytes) !== configured.sourceSha256) throw new Error('SHA-256 stimmt nicht');
      const parsed = parseRevosaxSnapshot(bytes.toString('utf8'), { url: configured.baselineUrl });
      if (parsed.sourceValidFrom !== configured.sourceValidFrom || parsed.sourceValidTo !== configured.sourceValidTo) {
        throw new Error('Quellgültigkeit weicht von der Konfiguration ab');
      }
      const snapshotDate = sourceId === 'baseline' ? config.baselineSnapshotDate : configured.versionDate;
      if (snapshotDate < parsed.sourceValidFrom ||
          (parsed.sourceValidTo && snapshotDate > parsed.sourceValidTo)) {
        throw new Error(`Fassung galt nicht am ${snapshotDate}`);
      }
      console.log(`${slug}${sourceId === 'baseline' ? '' : `/${sourceId}`}: Snapshot und Provenienz gültig`);
    } catch (error) {
      failures.push(`${slug}${sourceId === 'baseline' ? '' : `/${sourceId}`}: ${error.message}`);
    }
    }
  }
  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
  }
}

if (command === 'fetch') await fetchSnapshot();
else if (command === 'parse') await parseSnapshot();
else if (command === 'audit') await auditSnapshots();
else throw new Error(`Unbekannter Befehl ${command}; erwartet: audit, fetch oder parse`);
