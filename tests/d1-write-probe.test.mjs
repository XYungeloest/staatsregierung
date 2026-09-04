import assert from 'node:assert/strict';
import test from 'node:test';

import { assertProbeResults, PROBE_TABLE, probeStatements } from '../scripts/d1-write-probe.mjs';

test('die D1-Schreibprobe berührt nur ihre eigene Probetabelle und beweist Schreiben, Lesen und Löschen', () => {
  const statements = probeStatements('ci-probe-test', '2026-09-04T00:00:00.000Z');
  assert.equal(statements.length, 5);
  assert.ok(statements.every((statement) => statement.sql.includes(PROBE_TABLE)));
  const protectedTables = ['law_norms', 'law_versions', 'law_search', 'law_search_units', 'law_search_documents', 'law_publications', 'law_runtime_meta'];
  for (const statement of statements) {
    for (const table of protectedTables) assert.ok(!new RegExp(`\\b${table}\\b`, 'u').test(statement.sql), `${statement.sql} berührt ${table}`);
  }
  assert.doesNotThrow(() => assertProbeResults('ci-probe-test', [[], [], [{ probe_id: 'ci-probe-test' }], [], [{ remaining: 0 }]]));
  assert.throws(() => assertProbeResults('ci-probe-test', [[], [], [], [], [{ remaining: 0 }]]), /nicht gelesen/u);
  assert.throws(() => assertProbeResults('ci-probe-test', [[], [], [{ probe_id: 'ci-probe-test' }], [], [{ remaining: 1 }]]), /noch vorhanden/u);
});
