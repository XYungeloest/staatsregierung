import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const amendmentByStem = {
  'saechsische-klassenbildungsverordnung': 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026',
  'schulnetzplanungsverordnung': 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026',
  'freie-trager-schulverordnung': 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026',
  'pruefungsverordnung-waldorfschulen': 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026',
  'vwv-schulformulare': 'aendvwv-schulformulare-2026',
  'vwv-beratungslehrer': 'aendvwv-beratungslehrer-2026',
  'vwv-radfahrausbildung': 'aendvwv-radfahrausbildung-2026',
};

const repealedSchoolOrders = [
  'schulordnung-grundschulen',
  'schulordnung-ober-und-abendoberschulen',
  'schulordnung-gemeinschaftsschulen',
  'schulordnung-gymnasien-abiturpruefung',
];

test('alle 25 Ausgaben sind mit amtlicher PDF- und strukturierter HTML-Quelle verbunden', async () => {
  const issues = [
    ...Array.from({ length: 9 }, (_, index) => ({ publication: 'ogvbl', number: index + 59 })),
    ...Array.from({ length: 16 }, (_, index) => ({ publication: 'stanzo', number: index + 16 })),
  ];

  for (const { publication, number } of issues) {
    const label = publication === 'ogvbl' ? 'OGVBl.' : 'StAnzO.';
    const record = await readJson(`content/verkuendungen/${publication}-2026-${number}.json`);
    assert.equal(record.issue, String(number));
    assert.equal(record.date, number === 59 ? '2026-08-09' : publication === 'ogvbl' && number < 62 ? '2026-08-14' : publication === 'ogvbl' && number < 67 ? '2026-08-15' : '2026-08-16');
    assert.equal(record.pdf, `/assets/recht/${label} 2026 Nr. ${number}.pdf`);
    assert.ok(record.entries.length > 0, `${label} 2026 Nr. ${number}: kein Normverweis`);
    await access(`Gesetze/${label} 2026 Nr. ${number}.html`);
    await access(`public${record.pdf}`);
  }
});

test('geänderte Stammnormen behalten die alte und erhalten eine vollständige Folgefassung', async () => {
  for (const [slug, amendment] of Object.entries(amendmentByStem)) {
    const [meta, history, oldVersion, newVersion] = await Promise.all([
      readJson(`content/normen/${slug}/meta.json`),
      readJson(`content/normen/${slug}/history.json`),
      readJson(`content/normen/${slug}/versions/2023-11-01.json`),
      readJson(`content/normen/${slug}/versions/2026-09-01.json`),
    ]);
    assert.deepEqual(
      [oldVersion.validFrom, oldVersion.validTo, newVersion.validFrom, newVersion.validTo],
      ['2023-11-01', '2026-08-31', '2026-09-01', null],
      slug,
    );
    assert.ok(oldVersion.body.length > 0, `${slug}: historische Fassung ist leer`);
    assert.ok(newVersion.body.length > 0, `${slug}: Folgefassung ist leer`);
    assert.ok(meta.affectedByNorms.includes(amendment), `${slug}: Änderungsbeziehung fehlt`);
    const historyEntry = history.entries.find((entry) => entry.relatedNorm === amendment);
    assert.equal(historyEntry?.type, 'amendment', `${slug}: Änderungshistorie fehlt`);
    assert.equal(historyEntry?.affectingVersionId, '2026-09-01', `${slug}: Folgefassung nicht verknüpft`);
  }
});

test('aufgehobene Schulordnungen bleiben bis zum Stichtag gültig und historisch vollständig erhalten', async () => {
  for (const slug of repealedSchoolOrders) {
    const [meta, history, version] = await Promise.all([
      readJson(`content/normen/${slug}/meta.json`),
      readJson(`content/normen/${slug}/history.json`),
      readJson(`content/normen/${slug}/versions/2023-11-01.json`),
    ]);
    assert.equal(meta.status, 'in-force', `${slug}: am 16. August 2026 noch geltend`);
    assert.equal(meta.expiryDate, '2026-08-31');
    assert.equal(version.validTo, '2026-08-31');
    assert.ok(version.body.length > 0, `${slug}: letzte gültige Fassung ist leer`);
    const repeal = history.entries.find((entry) => entry.type === 'repeal');
    assert.equal(repeal?.date, '2026-09-01');
    assert.equal(repeal?.relatedNorm, 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026');
    assert.equal(repeal?.affectingVersionId, null);
  }
});

test('nicht eindeutig konsolidierbare Änderungsbefehle bleiben explizit gesperrt', async () => {
  const config = await readJson('data/recht/consolidation-sources.json');
  for (const slug of [
    'schulordnung-foerderschulen',
    'schulordnung-berufsschule',
    'schulordnung-berufliche-gymnasien',
  ]) {
    assert.match(config.blockedTargets[slug]?.reason ?? '', /Quellenkonflikt/u, slug);
  }
});
