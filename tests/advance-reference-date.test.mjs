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

test('Stichtagsfortschreibung ist fail-closed nur vorwärts: gleicher Stichtag erlaubt, späterer erlaubt, früherer abgelehnt', async () => {
  const { mkdtemp, mkdir, readFile, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { assertForwardOnly, main, ReferenceDateRegressionError } = await import('../scripts/advance-reference-date.mjs');

  assert.doesNotThrow(() => assertForwardOnly('2026-09-04', '2026-09-04'));
  assert.doesNotThrow(() => assertForwardOnly('2026-09-04', '2026-09-05'));
  assert.throws(() => assertForwardOnly('2026-09-04', '2026-09-01'), ReferenceDateRegressionError);
  assert.throws(() => planReferenceDateAdvance({ norms: [], from: '2026-09-04', to: '2026-09-01' }), /Rückdatierung abgelehnt/u);

  // Bei Ablehnung wird auch mit --write nichts geschrieben.
  const root = await mkdtemp(join(tmpdir(), 'reference-date-'));
  const normDir = join(root, 'content', 'normen', 'zukunft');
  await mkdir(join(normDir, 'versions'), { recursive: true });
  await mkdir(join(root, 'content', 'themen'), { recursive: true });
  await mkdir(join(root, 'content', 'organisation', 'snapshots'), { recursive: true });
  await mkdir(join(root, 'packages', 'shared', 'src', 'config'), { recursive: true });
  const meta = `${JSON.stringify({ slug: 'zukunft', status: 'future-effective', effectiveDate: '2026-09-02' }, null, 2)}\n`;
  const editorial = `${JSON.stringify({ referenceDate: '2026-09-04' }, null, 2)}\n`;
  await writeFile(join(normDir, 'meta.json'), meta);
  await writeFile(join(normDir, 'versions', '2026-09-02.json'), `${JSON.stringify({ versionId: '2026-09-02', validFrom: '2026-09-02', validTo: null })}\n`);
  await writeFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), editorial);
  await assert.rejects(main(['--to', '2026-09-01', '--write'], root), ReferenceDateRegressionError);
  assert.equal(await readFile(join(normDir, 'meta.json'), 'utf8'), meta, 'meta.json unverändert');
  assert.equal(await readFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), 'utf8'), editorial, 'editorial.json unverändert');
  // Gleicher Stichtag: No-op ohne Änderung, späterer Stichtag: schreibt.
  const same = await main(['--to', '2026-09-04', '--write', '--json'], root);
  assert.equal(same.statusChanges.length, 0);
  assert.equal(await readFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), 'utf8'), editorial);
  const later = await main(['--to', '2026-09-05', '--write', '--json'], root);
  assert.equal(later.written, true);
  assert.match(await readFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), 'utf8'), /2026-09-05/u);
});
