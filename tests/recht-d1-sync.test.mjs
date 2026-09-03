import assert from 'node:assert/strict';
import test from 'node:test';

import { groupStatementFiles, renderStatement, sqlLiteral } from '../scripts/sync-recht-d1.mjs';

test('D1-SQL-Literale und Anweisungen werden sicher gerendert', () => {
  assert.equal(sqlLiteral(null), 'NULL');
  assert.equal(sqlLiteral(undefined), 'NULL');
  assert.equal(sqlLiteral(3), '3');
  assert.equal(sqlLiteral(true), '1');
  assert.equal(sqlLiteral("O'Brien; DROP TABLE x; -- ?"), "'O''Brien; DROP TABLE x; -- ?'");
  assert.equal(
    renderStatement({ sql: 'INSERT INTO t (a, b) VALUES (?, ?)', params: ['x?y', null] }),
    "INSERT INTO t (a, b) VALUES ('x?y', NULL);",
  );
  assert.throws(() => renderStatement({ sql: 'SELECT ?, ?', params: ['a'] }), /mehr Platzhalter/u);
  assert.throws(() => renderStatement({ sql: 'SELECT ?', params: ['a', 'b'] }), /weniger Platzhalter/u);
});

test('SQL-Dateien fassen Normen zusammen, ohne eine Norm zu zerteilen', () => {
  const norms = [
    { slug: 'a', statements: ['A1;', 'A2;'] },
    { slug: 'b', statements: ['B1;', 'B2;', 'B3;'] },
    { slug: 'c', statements: ['C1;'] },
  ];
  const files = groupStatementFiles(norms, { maxStatements: 4 });
  assert.deepEqual(files.map((file) => file.slugs), [['a'], ['b', 'c']]);
  const large = groupStatementFiles(norms, { maxBytes: 8 });
  assert.deepEqual(large.map((file) => file.slugs), [['a'], ['b'], ['c']]);
  assert.deepEqual(groupStatementFiles(norms).map((file) => file.slugs), [['a', 'b', 'c']]);
});
