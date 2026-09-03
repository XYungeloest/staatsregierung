import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { attachmentIdFor, fileNameFromHeaders, objectKeyForAttachment, safeFileName } from '../scripts/archive-revosax-attachments.mjs';

test('Anlagen-Dateinamen stammen aus Content-Disposition und sind auf sichere Zeichen reduziert', () => {
  const headers = new Headers({ 'content-disposition': 'inline; filename="01_93_1160a_UEK.pdf"' });
  assert.equal(fileNameFromHeaders(headers, 'https://www.revosax.sachsen.de/attachments/12287'), '01_93_1160a_UEK.pdf');
  const encoded = new Headers({ 'content-disposition': "attachment; filename*=UTF-8''Anlage%201%20%C3%84nderung.pdf" });
  assert.equal(fileNameFromHeaders(encoded, 'https://www.revosax.sachsen.de/attachments/1'), 'Anlage_1_Änderung.pdf');
  assert.equal(fileNameFromHeaders(new Headers(), 'https://www.revosax.sachsen.de/attachments/99'), '99');
  assert.equal(safeFileName('../böse/name?.pdf', 'x'), 'böse_name.pdf');
  assert.equal(attachmentIdFor('https://www.revosax.sachsen.de/attachments/12285'), '12285');
  assert.equal(objectKeyForAttachment('2023-11-01', '1018', '12285', 'a.pdf'), 'revosax/2023-11-01/attachments/1018/12285-a.pdf');
});

test('das Anlagenmanifest ist vollständig, hashverifiziert und eindeutig', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/recht/revosax-attachments.json', import.meta.url), 'utf8'));
  assert.equal(manifest.baselineDate, '2023-11-01');
  const records = Object.values(manifest.attachments);
  assert.ok(records.length > 0);
  const keys = new Set();
  for (const record of records) {
    assert.match(record.sha256, /^[0-9a-f]{64}$/u, record.attachmentId);
    assert.ok(record.size > 0, record.attachmentId);
    assert.equal(record.verified, true, `${record.attachmentId} nicht verifiziert`);
    assert.ok(record.objectKey.startsWith(`revosax/2023-11-01/attachments/${record.lawId}/${record.attachmentId}-`), record.objectKey);
    assert.ok(['pdf', 'word', 'spreadsheet', 'image', 'other'].includes(record.kind), record.kind);
    assert.match(record.url, /^https:\/\/www\.revosax\.sachsen\.de\/attachments\/\d+$/u);
    assert.equal(keys.has(record.objectKey), false, `doppelter Objektschlüssel ${record.objectKey}`);
    keys.add(record.objectKey);
  }
  // Jede Anlage, die eine Norm im Bestand referenziert, hängt an einer bekannten Quellkennung.
  assert.ok(records.every((record) => /^\d+(?:\.\d+)?$/u.test(record.sourceId)));
});
