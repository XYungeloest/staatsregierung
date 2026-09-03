#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { parseRevosaxSnapshot } from './lib/revosax-parser.mjs';
import {
  adaptParsedRevosaxSnapshot,
  auditAdaptedRevosaxSnapshot,
} from './lib/revosax-ost-adapter.mjs';

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/ß/gu, 'ss')
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 96) || 'revosax-norm';
}

function inferType(title, context = '') {
  const source = `${title} ${context}`;
  if (/\b(?:Änderung|zur Änderung|aenderung)\b/iu.test(source)) return 'aenderungsvorschrift';
  if (/\bZustimmungsgesetz\b/iu.test(source)) return 'zustimmungsgesetz';
  if (/\bStaatsvertrag\b/iu.test(source)) return 'staatsvertrag';
  if (/\b(?:Förderrichtlinie|Foerderrichtlinie|FRL|FöRL)\b/iu.test(source)) return 'foerderrichtlinie';
  if (/\b(?:Verwaltungsvorschrift|VwV)\b/iu.test(source)) return 'verwaltungsvorschrift';
  if (/\bVerordnung\b/iu.test(source)) return 'verordnung';
  return 'gesetz';
}

function validityCovers(parsed, date, type) {
  // Änderungsvorschriften sind punktuelle Rechtsetzungsakte und können in REVOSax
  // anders datiert sein als konsolidierte Stammfassungen. Ihre Aufnahme wird bereits
  // durch die Stichtagssuche bestimmt; fehlende/abweichende Intervalle sind deshalb
  // ein Audit-Hinweis, kein automatischer Ausschluss.
  if (type === 'aenderungsvorschrift') return true;
  if (!parsed.sourceValidFrom) return false;
  return date >= parsed.sourceValidFrom && (!parsed.sourceValidTo || date <= parsed.sourceValidTo);
}

async function sleep(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchWithRetry(url, retries = 4) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-encoding': 'identity',
          'user-agent': 'OstRecht REVOSax-Baseline-Importer/1.0',
        },
      });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === retries) throw new Error(`HTTP ${response.status}`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = resolve(valueAfter(args, '--manifest') ?? 'data/recht/revosax-baseline-2023-11-01.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const date = manifest.query?.geltungstag;
  if (!date) throw new Error(`${manifestPath}: query.geltungstag fehlt`);
  const cacheRoot = resolve(valueAfter(args, '--cache-dir') ?? `.cache/revosax-baseline/${date}`);
  const delayMs = Number.parseInt(valueAfter(args, '--delay-ms') ?? '150', 10);
  const limit = valueAfter(args, '--limit') ? Number.parseInt(valueAfter(args, '--limit'), 10) : null;
  const startAt = valueAfter(args, '--start-at') ? Number.parseInt(valueAfter(args, '--start-at'), 10) : 0;
  const selected = manifest.hits.slice(startAt, limit ? startAt + limit : undefined);
  const entries = [];
  const failures = [];
  const slugCounts = new Map();

  await mkdir(cacheRoot, { recursive: true });

  for (const [offset, hit] of selected.entries()) {
    const absoluteIndex = startAt + offset;
    try {
      const url = new URL(hit.url);
      if (!['www.revosax.sachsen.de', 'revosax.sachsen.de'].includes(url.hostname) ||
          !/^\/vorschrift\/\d+(?:\.\d+)?(?:-[^/]*)?$/u.test(url.pathname)) {
        throw new Error(`unzulässige REVOSax-URL ${hit.url}`);
      }
      const response = await fetchWithRetry(url);
      const bytes = Buffer.from(await response.arrayBuffer());
      const rawHtml = bytes.toString('utf8');
      const original = parseRevosaxSnapshot(rawHtml, { url: response.url });
      const adapted = adaptParsedRevosaxSnapshot(original);
      const type = inferType(adapted.sourceTitle, hit.context);
      const residuals = auditAdaptedRevosaxSnapshot(adapted);
      if (residuals.length > 0) {
        throw new Error(`nicht angepasste Sachsen-Bezüge: ${residuals.slice(0, 5).map((entry) => entry.path).join(', ')}`);
      }
      if (!validityCovers(original, date, type)) {
        throw new Error(
          `Stichtag ${date} liegt nicht im erkannten Gültigkeitsintervall ` +
          `${original.sourceValidFrom ?? '?'} bis ${original.sourceValidTo ?? '?'}`,
        );
      }

      const baseSlug = slugify(adapted.shortTitle || adapted.sourceTitle);
      const count = (slugCounts.get(baseSlug) ?? 0) + 1;
      slugCounts.set(baseSlug, count);
      const slug = count === 1 ? baseSlug : `${baseSlug}-${hit.lawId}${hit.versionSuffix ? `-${hit.versionSuffix}` : ''}`;
      const sourceId = `${hit.lawId}${hit.versionSuffix ? `.${hit.versionSuffix}` : ''}`;
      const rawPath = resolve(cacheRoot, 'raw', `${sourceId}.html`);
      const parsedPath = resolve(cacheRoot, 'parsed', `${sourceId}.json`);
      await mkdir(dirname(rawPath), { recursive: true });
      await mkdir(dirname(parsedPath), { recursive: true });
      await writeFile(rawPath, bytes);
      await writeFile(parsedPath, `${JSON.stringify({ original, adapted }, null, 2)}\n`, 'utf8');

      entries.push({
        index: absoluteIndex,
        revosaxLawId: hit.lawId,
        versionSuffix: hit.versionSuffix,
        sourceUrl: response.url,
        sourceSha256: hash(bytes),
        byteLength: bytes.length,
        sourceValidFrom: original.sourceValidFrom,
        sourceValidTo: original.sourceValidTo,
        documentDate: original.documentDate,
        sourceTitle: original.sourceTitle,
        adaptedTitle: adapted.sourceTitle,
        adaptedShortTitle: adapted.shortTitle,
        adaptedAbbr: adapted.abbr ?? null,
        inferredType: type,
        proposedSlug: slug,
        rawCacheFile: rawPath.replace(`${resolve('.')}/`, ''),
        parsedCacheFile: parsedPath.replace(`${resolve('.')}/`, ''),
      });
      console.log(`[${absoluteIndex + 1}/${manifest.hits.length}] ${sourceId}: ${adapted.sourceTitle}`);
    } catch (error) {
      failures.push({ index: absoluteIndex, hit, error: error.message });
      console.error(`[${absoluteIndex + 1}/${manifest.hits.length}] FEHLER ${hit.url}: ${error.message}`);
    }
    if (offset < selected.length - 1) await sleep(delayMs);
  }

  const report = {
    schemaVersion: 1,
    baselineDate: date,
    sourceManifest: manifestPath.replace(`${resolve('.')}/`, ''),
    generatedAt: new Date().toISOString(),
    range: { startAt, processed: selected.length },
    successful: entries.length,
    failed: failures.length,
    entries,
    failures,
  };
  const reportPath = resolve(cacheRoot, 'report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`${entries.length} erfolgreich, ${failures.length} fehlgeschlagen. Bericht: ${reportPath}`);
  if (failures.length > 0) process.exitCode = 1;
}

await main();
