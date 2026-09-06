import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPagination, pageUrl } from '../apps/recht/src/lib/runtime/pagination.ts';
import { normalizePage, normalizeQueryText } from '../apps/recht/src/lib/runtime/store.ts';

test('Seiten-URLs tragen alle Filter, lassen leere Werte und seite=1 weg', () => {
  assert.equal(pageUrl('/recht/archiv/', { buchstabe: 'A', seite: 1 }), '/recht/archiv/?buchstabe=A');
  assert.equal(pageUrl('/recht/archiv/', { buchstabe: 'A', seite: 2 }), '/recht/archiv/?buchstabe=A&seite=2');
  assert.equal(pageUrl('/recht/rechtsentwicklung/', { q: '', origin: 'inherited-amended', type: undefined, seite: '3' }), '/recht/rechtsentwicklung/?origin=inherited-amended&seite=3');
  assert.equal(pageUrl('/x/', { q: 'Gemeinde ordnung & mehr' }), '/x/?q=Gemeinde+ordnung+%26+mehr');
});

test('die Seitenliste zeigt erste, letzte und benachbarte Seiten mit Auslassungen sowie Vor/Zurück', () => {
  const pagination = buildPagination({ page: 7, pageCount: 20, basePath: '/x/', params: { buchstabe: 'A' } });
  assert.deepEqual(pagination.pages.map((entry) => (entry.kind === 'gap' ? '…' : entry.page)), [1, '…', 5, 6, 7, 8, 9, '…', 20]);
  assert.equal(pagination.pages.find((entry) => entry.current)?.page, 7);
  assert.equal(pagination.prev, '/x/?buchstabe=A&seite=6');
  assert.equal(pagination.next, '/x/?buchstabe=A&seite=8');
  const first = buildPagination({ page: 1, pageCount: 3, basePath: '/x/' });
  assert.equal(first.prev, undefined);
  assert.equal(first.next, '/x/?seite=2');
  assert.deepEqual(first.pages.map((entry) => entry.href), ['/x/', '/x/?seite=2', '/x/?seite=3']);
  const single = buildPagination({ page: 5, pageCount: 1, basePath: '/x/' });
  assert.equal(single.page, 1);
  assert.equal(single.pages.length, 1);
  assert.equal(single.next, undefined);
});

test('Seitenparameter und Freitext werden abgesichert', () => {
  assert.deepEqual(normalizePage('3', '50'), { page: 3, pageSize: 50 });
  assert.deepEqual(normalizePage('abc', '-5'), { page: 1, pageSize: 50 });
  assert.deepEqual(normalizePage('0', '10000'), { page: 1, pageSize: 100 });
  assert.deepEqual(normalizePage(null), { page: 1, pageSize: 50 });
  assert.equal(normalizeQueryText('  Gemeinde   Ordnung '), 'gemeinde ordnung');
  assert.equal(normalizeQueryText(undefined), '');
});

test('Norm- und Stichwortpaginierung derselben Seite behalten ihren jeweils anderen Seitenparameter', () => {
  // A–Z: `seite` blättert die Normen, `stichwortseite` den Stichwortindex – unabhängig voneinander.
  const norms = buildPagination({ page: 3, pageCount: 5, basePath: '/archiv/', params: { buchstabe: 'A', stichwortseite: '2', herkunft: 'inherited-unchanged' }, pageParam: 'seite' });
  assert.equal(norms.next, '/archiv/?buchstabe=A&stichwortseite=2&herkunft=inherited-unchanged&seite=4');
  assert.equal(norms.prev, '/archiv/?buchstabe=A&stichwortseite=2&herkunft=inherited-unchanged&seite=2');
  assert.ok(norms.pages.every((entry) => entry.href.includes('stichwortseite=2')), 'die Stichwortseite bleibt in jedem Normseitenlink erhalten');

  const keywords = buildPagination({ page: 2, pageCount: 4, basePath: '/archiv/', params: { buchstabe: 'A', seite: '3', stichwort: 'Kultur' }, pageParam: 'stichwortseite' });
  assert.equal(keywords.next, '/archiv/?buchstabe=A&seite=3&stichwort=Kultur&stichwortseite=3');
  assert.equal(keywords.prev, '/archiv/?buchstabe=A&seite=3&stichwort=Kultur');
  assert.ok(keywords.pages.every((entry) => entry.href.includes('seite=3')), 'die Normseite bleibt in jedem Stichwortseitenlink erhalten');
  assert.ok(keywords.pages.every((entry) => !/stichwortseite=1\b/u.test(entry.href)), 'die erste Stichwortseite wird nicht geschrieben');
  assert.equal(keywords.pages.find((entry) => entry.current)?.href, '/archiv/?buchstabe=A&seite=3&stichwort=Kultur&stichwortseite=2');

  // Ohne expliziten Parameter bleibt das bisherige Verhalten (`seite`).
  assert.equal(buildPagination({ page: 1, pageCount: 2, basePath: '/x/' }).next, '/x/?seite=2');
  assert.equal(pageUrl('/archiv/', { buchstabe: 'A', seite: 1, stichwortseite: 1, abkuerzungsseite: 1 }), '/archiv/?buchstabe=A');
  assert.equal(pageUrl('/a-z/', { buchstabe: 'A', abkuerzungsseite: 2 }), '/a-z/?buchstabe=A&abkuerzungsseite=2');
});
