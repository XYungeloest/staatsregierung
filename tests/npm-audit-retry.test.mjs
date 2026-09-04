import assert from 'node:assert/strict';
import test from 'node:test';

import { auditWithRetry, classifyAuditOutcome } from '../scripts/npm-audit-retry.mjs';

const cleanReport = JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } });
const vulnerableReport = JSON.stringify({ auditReportVersion: 2, vulnerabilities: { x: { severity: 'high' } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } } });
const registryError = JSON.stringify({ error: { code: 'E503', summary: '503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', detail: '' } });

test('npm-audit-Ausgänge: sauber, Befund, Registryausfall, sonstiger Fehler', () => {
  assert.equal(classifyAuditOutcome({ code: 0, stdout: cleanReport }).outcome, 'clean');
  assert.equal(classifyAuditOutcome({ code: 1, stdout: vulnerableReport }).outcome, 'vulnerable');
  assert.equal(classifyAuditOutcome({ code: 1, stdout: registryError, stderr: 'npm ERR! code E503' }).outcome, 'transient');
  assert.equal(classifyAuditOutcome({ code: 1, stdout: '', stderr: 'npm ERR! code ECONNRESET\nnpm ERR! network socket hang up' }).outcome, 'transient');
  assert.equal(classifyAuditOutcome({ code: 1, stdout: '', stderr: 'npm ERR! request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org' }).outcome, 'transient');
  assert.equal(classifyAuditOutcome({ code: 1, stdout: JSON.stringify({ error: { code: 'ENOLOCK', summary: 'This command requires an existing lockfile.' } }), stderr: 'npm ERR! code ENOLOCK' }).outcome, 'error');
  assert.equal(classifyAuditOutcome({ code: 1, stdout: '', stderr: 'npm ERR! code EAUDITNOPJSON' }).outcome, 'error');
});

test('Wiederholung nur bei Registryfehlern; echte Befunde bleiben ein hartes Fehlschlagen', async () => {
  const waits = [];
  const wait = async (ms) => { waits.push(ms); };
  const log = () => {};

  const flaky = [
    { code: 1, stdout: registryError, stderr: 'npm ERR! code E503' },
    { code: 1, stdout: '', stderr: 'npm ERR! network ETIMEDOUT' },
    { code: 0, stdout: cleanReport, stderr: '' },
  ];
  const recovered = await auditWithRetry({ attempts: 3, run: async () => flaky.shift(), log, wait });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.attempts, 3);
  assert.deepEqual(waits, [15_000, 45_000]);

  let vulnerableRuns = 0;
  const vulnerable = await auditWithRetry({ attempts: 3, run: async () => { vulnerableRuns += 1; return { code: 1, stdout: vulnerableReport, stderr: '' }; }, log, wait });
  assert.equal(vulnerable.ok, false);
  assert.equal(vulnerable.outcome, 'vulnerable');
  assert.equal(vulnerableRuns, 1, 'ein Auditbefund wird nicht wiederholt');

  let downRuns = 0;
  const down = await auditWithRetry({ attempts: 3, run: async () => { downRuns += 1; return { code: 1, stdout: registryError, stderr: 'npm ERR! code E503' }; }, log, wait });
  assert.equal(down.ok, false);
  assert.equal(down.outcome, 'transient');
  assert.equal(downRuns, 3, 'nach den Versuchen schlägt der Lauf fehl statt durchzuwinken');

  let configRuns = 0;
  const config = await auditWithRetry({ attempts: 3, run: async () => { configRuns += 1; return { code: 1, stdout: '', stderr: 'npm ERR! code ENOLOCK' }; }, log, wait });
  assert.equal(config.ok, false);
  assert.equal(configRuns, 1, 'unbekannte Fehler werden nicht wiederholt');
});
