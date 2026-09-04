#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * `npm audit --audit-level=high` mit begrenzter Wiederholung ausschließlich bei Registry- und
 * Netzfehlern (HTTP 5xx, 429, Verbindungsabbruch, DNS). Ein echter Auditbefund (hohe oder
 * kritische Schwachstelle) schlägt sofort und ohne Wiederholung fehl; unbekannte Fehler ebenso.
 * Der Lauf ist kein `|| true`: jeder Ausgang außer „keine Befunde“ beendet den Prozess mit 1.
 *
 * Aufruf: node scripts/npm-audit-retry.mjs [--attempts 3] [--audit-level high]
 * Umgebung: npm-eigene Wiederholungen werden je Versuch kurz gehalten (fetch-retries=1), damit
 * ein Registryausfall nicht minutenlang blockiert, bevor dieser Wrapper erneut versucht.
 */

export const TRANSIENT_AUDIT_PATTERN = /\bE(?:502|503|504|429)\b|\b(?:502|503|504|429)\b|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|socket hang up|FETCH_ERROR|ERR_SOCKET|network (?:error|timeout|request)|request to https?:\/\/[^\s]+ failed|Bad Gateway|Service Unavailable|Gateway Time-?out/iu;

const DEFAULT_DELAYS_MS = [15_000, 45_000];

function parseJson(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

/**
 * Ordnet den Ausgang eines `npm audit --json`-Laufs ein:
 *   clean      – Exitcode 0, keine Befunde auf oder über dem Audit-Level
 *   vulnerable – npm meldet Schwachstellen (Bericht mit metadata.vulnerabilities); nie wiederholen
 *   transient  – Registry-/Netzfehler; darf wiederholt werden
 *   error      – anderer Fehler (Konfiguration, Lockfile, unbekannt); nie wiederholen
 */
export function classifyAuditOutcome({ code, stdout = '', stderr = '' }) {
  const report = parseJson(stdout);
  if (code === 0) {
    return { outcome: 'clean', report };
  }
  if (report?.metadata?.vulnerabilities && !report.error) {
    return { outcome: 'vulnerable', report };
  }
  const combined = `${stdout}\n${stderr}`;
  const errorCode = report?.error?.code ?? '';
  if (TRANSIENT_AUDIT_PATTERN.test(errorCode) || TRANSIENT_AUDIT_PATTERN.test(combined)) {
    return { outcome: 'transient', report, reason: errorCode || combined.trim().split('\n').find((line) => TRANSIENT_AUDIT_PATTERN.test(line))?.trim() };
  }
  return { outcome: 'error', report, reason: errorCode || combined.trim().slice(-400) };
}

export function summarizeVulnerabilities(report) {
  const counts = report?.metadata?.vulnerabilities ?? {};
  return ['critical', 'high', 'moderate', 'low', 'info'].map((level) => `${level} ${counts[level] ?? 0}`).join(', ');
}

function runAudit(auditLevel) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('npm', ['audit', `--audit-level=${auditLevel}`, '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        npm_config_fetch_retries: process.env.npm_config_fetch_retries ?? '1',
        npm_config_fetch_retry_mintimeout: process.env.npm_config_fetch_retry_mintimeout ?? '5000',
        npm_config_fetch_retry_maxtimeout: process.env.npm_config_fetch_retry_maxtimeout ?? '15000',
        npm_config_fetch_timeout: process.env.npm_config_fetch_timeout ?? '60000',
      },
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }));
  });
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

export async function auditWithRetry({ attempts = 3, auditLevel = 'high', delays = DEFAULT_DELAYS_MS, run = runAudit, log = console.log, wait = sleep } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await run(auditLevel);
    const classified = classifyAuditOutcome(result);
    if (classified.outcome === 'clean') {
      log(`npm audit: keine Befunde ab Stufe ${auditLevel} (${summarizeVulnerabilities(classified.report)}).`);
      return { ok: true, attempts: attempt, ...classified };
    }
    if (classified.outcome === 'vulnerable') {
      log(`npm audit: Befund ab Stufe ${auditLevel} – ${summarizeVulnerabilities(classified.report)}. Der Lauf schlägt fehl; keine Wiederholung.`);
      log(result.stdout.trim().slice(0, 4000));
      return { ok: false, attempts: attempt, ...classified };
    }
    if (classified.outcome === 'transient' && attempt < attempts) {
      const delay = delays[Math.min(attempt - 1, delays.length - 1)];
      log(`npm audit: Registry/Netz vorübergehend nicht erreichbar (${classified.reason ?? 'unbekannt'}); Versuch ${attempt}/${attempts}, neuer Versuch in ${Math.round(delay / 1000)} s.`);
      await wait(delay);
      continue;
    }
    log(`npm audit: ${classified.outcome === 'transient' ? `Registry nach ${attempt} Versuchen nicht erreichbar` : 'Fehler'} – ${classified.reason ?? ''}`.trim());
    log((result.stderr || result.stdout).trim().slice(-2000));
    return { ok: false, attempts: attempt, ...classified };
  }
  return { ok: false, attempts, outcome: 'error' };
}

async function main() {
  const args = process.argv.slice(2);
  const valueAfter = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const attempts = Number.parseInt(valueAfter('--attempts') ?? '3', 10);
  const auditLevel = valueAfter('--audit-level') ?? 'high';
  const result = await auditWithRetry({ attempts, auditLevel });
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
