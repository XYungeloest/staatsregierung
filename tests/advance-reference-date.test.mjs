import assert from 'node:assert/strict';
import test from 'node:test';

import { planReferenceDateAdvance, statusAt } from '../scripts/advance-reference-date.mjs';

function norm(slug, meta, versions = []) {
  return { slug, meta: { status: 'in-force', ...meta }, versions };
}

test('Stichtagsfortschreibung: am Stichtag geltende Vorschriften werden nicht mehr als zukünftig geführt', () => {
  const norms = [
    norm('am-zweiten', { status: 'future-effective', effectiveDate: '2026-09-02' }, [{ versionId: '2026-09-02', validFrom: '2026-09-02', validTo: null }]),
    norm('am-dritten', { status: 'future-effective', effectiveDate: '2026-09-03' }, [{ versionId: '2026-09-03', validFrom: '2026-09-03', validTo: null }]),
    norm('am-stichtag', { status: 'future-effective', effectiveDate: '2026-09-04' }, [{ versionId: '2026-09-04', validFrom: '2026-09-04', validTo: null }]),
    norm('spaeter', { status: 'future-effective', effectiveDate: '2026-10-01' }, [{ versionId: '2026-10-01', validFrom: '2026-10-01', validTo: null }]),
    norm('abgelaufen', { status: 'in-force', effectiveDate: '2025-01-01', expiryDate: '2026-09-02' }, [{ versionId: '2025-01-01', validFrom: '2025-01-01', validTo: '2026-09-02' }]),
    norm('laeuft-am-stichtag-aus', { status: 'in-force', effectiveDate: '2025-01-01', expiryDate: '2026-09-04' }, [{ versionId: '2025-01-01', validFrom: '2025-01-01', validTo: '2026-09-04' }]),
    norm('unveraendert', { status: 'in-force', effectiveDate: '2024-01-01' }, [{ versionId: '2024-01-01', validFrom: '2024-01-01', validTo: null }]),
    norm('einmalig', { status: 'one-time-act', effectiveDate: '2026-09-02' }, [{ versionId: '2026-09-02', validFrom: '2026-09-02', validTo: null }]),
    norm('offen', { status: 'pending-effective' }, [{ versionId: 'offen', validFrom: '2026-09-02', validTo: null }]),
  ];
  const plan = planReferenceDateAdvance({ norms, from: '2026-09-01', to: '2026-09-04' });
  assert.deepEqual(plan.statusChanges.map((entry) => [entry.slug, entry.from, entry.to]), [
    ['abgelaufen', 'in-force', 'repealed'],
    ['am-dritten', 'future-effective', 'in-force'],
    ['am-stichtag', 'future-effective', 'in-force'],
    ['am-zweiten', 'future-effective', 'in-force'],
  ]);
  // Eine erst nach dem Stichtag wirksame Vorschrift bleibt zukünftig; eine am Stichtag auslaufende gilt noch.
  assert.equal(statusAt(norms[3].meta, '2026-09-04'), 'future-effective');
  assert.equal(statusAt(norms[5].meta, '2026-09-04'), 'in-force');
  assert.equal(statusAt(norms[7].meta, '2026-09-04'), 'one-time-act');
  assert.equal(statusAt(norms[8].meta, '2026-09-04'), 'pending-effective');
  assert.deepEqual(plan.versionChanges.map((entry) => `${entry.slug}:${entry.from}>${entry.to}`), [
    'abgelaufen:current>historical',
    'am-dritten:future>current',
    'am-stichtag:future>current',
    'am-zweiten:future>current',
    'einmalig:future>current',
    'offen:future>current',
  ]);
});

test('Stichtagsfortschreibung ohne Datumswechsel oder mit ungültigem Datum', () => {
  assert.deepEqual(planReferenceDateAdvance({ norms: [], from: '2026-09-04', to: '2026-09-04' }), { from: '2026-09-04', to: '2026-09-04', statusChanges: [], versionChanges: [] });
  assert.throws(() => planReferenceDateAdvance({ norms: [], from: '2026-09-01', to: '4.9.2026' }), /ISO-Datum/u);
});
