import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUnitHistory, type AffectedVersionEntry } from '../apps/recht/src/lib/unit-history.ts';

/** Änderungsvermerk je Einheit über alle Fassungen: „neu“ in der Fassung des ersten Auftretens, „geändert“ je Fassung mit anderem Wortlaut. */
test('der Verlauf einer Einheit über drei Fassungen: neu in der zweiten, geändert in der dritten', () => {
  const versions: AffectedVersionEntry[] = [
    { versionId: 'v3', validFrom: '2026-09-12', previousVersionId: 'v2', amendments: ['Sozialistische Verfassungsnovelle'], changed: [{ anchor: 'artikel-7a', label: 'Artikel 7a' }, { anchor: 'artikel-1', label: 'Artikel 1' }], added: [{ anchor: 'artikel-3a', label: 'Artikel 3a' }], removed: [] },
    { versionId: 'v2', validFrom: '2026-07-21', previousVersionId: 'v1', amendments: ['Erstes Gesetz zur Großen Staatsreform', 'Zweites Gesetz'], changed: [], added: [{ anchor: 'artikel-7a', label: 'Artikel 7a' }], removed: [] },
  ];
  assert.deepEqual(buildUnitHistory(versions, 'artikel-7a'), [
    { kind: 'added', versionId: 'v2', previousVersionId: 'v1', validFrom: '2026-07-21', amendments: ['Erstes Gesetz zur Großen Staatsreform', 'Zweites Gesetz'] },
    { kind: 'changed', versionId: 'v3', previousVersionId: 'v2', validFrom: '2026-09-12', amendments: ['Sozialistische Verfassungsnovelle'] },
  ]);
  assert.deepEqual(buildUnitHistory(versions, 'artikel-1').map((entry) => entry.kind), ['changed']);
  assert.deepEqual(buildUnitHistory(versions, 'artikel-2'), []);
});

