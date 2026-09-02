import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

test('Normschema erhält leere Tabellenzellen und unterscheidet Kopfzellen', () => {
  const version = parseNormVersion({
    versionId: '2026-07-21',
    validFrom: '2026-07-21',
    validTo: null,
    isCurrent: true,
    citation: 'Testgesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 99)',
    changeNote: 'Testfassung.',
    body: [{
      type: 'table',
      children: [
        { type: 'tableRow', children: [
          { type: 'tableHeaderCell', text: 'Bezeichnung', scope: 'row' },
          { type: 'tableHeaderCell', text: '', scope: 'colgroup' },
        ] },
        { type: 'tableRow', children: [
          { type: 'tableCell', text: 'A' },
          { type: 'tableCell', text: '' },
        ] },
      ],
    }],
  });
  assert.equal(version.body[0].children?.[0].children?.[1].type, 'tableHeaderCell');
  assert.equal(version.body[0].children?.[0].children?.[0].scope, 'row');
  assert.equal(version.body[0].children?.[0].children?.[1].scope, 'colgroup');
  assert.equal(version.body[0].children?.[1].children?.[1].text, '');
});

test('Normschema begrenzt scope auf unterstützte Tabellenkopfzellen', () => {
  const base = {
    versionId: '2026-07-22',
    validFrom: '2026-07-22',
    validTo: null,
    isCurrent: true,
    citation: 'Testgesetz vom 22. Juli 2026 (OGVBl. 2026 Nr. 99)',
    changeNote: 'Testfassung.',
  };
  assert.throws(() => parseNormVersion({
    ...base,
    body: [{ type: 'table', children: [{ type: 'tableRow', children: [{ type: 'tableCell', text: 'A', scope: 'row' }] }] }],
  }), /nur an Tabellenkopfzellen/u);
  assert.throws(() => parseNormVersion({
    ...base,
    body: [{ type: 'table', children: [{ type: 'tableRow', children: [{ type: 'tableHeaderCell', text: 'A', scope: 'auto' }] }] }],
  }), /col, row, colgroup, rowgroup/u);
});

test('Normschema erlaubt quellentreue textlose Gliederungspunkte mit sichtbarem Zeichen', () => {
  const version = parseNormVersion({
    versionId: '2026-07-22',
    validFrom: '2026-07-22',
    validTo: null,
    isCurrent: true,
    citation: 'Testgesetz vom 22. Juli 2026 (OGVBl. 2026 Nr. 99)',
    changeNote: 'Testfassung.',
    body: [
      {
        type: 'item',
        label: '4.',
        text: '',
        children: [{ type: 'item', label: 'a.', text: 'Unterpunkt', children: [] }],
      },
      { type: 'subparagraph', label: '(5)', text: '', children: [] },
    ],
  }, 'test/version.json');

  assert.equal(version.body[0].text, '');
  assert.equal(version.body[0].children?.[0].label, 'a.');
  assert.equal(version.body[1].label, '(5)');
});
