import assert from 'node:assert/strict';
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
