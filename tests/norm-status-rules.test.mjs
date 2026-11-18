import assert from 'node:assert/strict';
import test from 'node:test';

import { normStatusProblems } from '../scripts/lib/norm-status-rules.mjs';

const referenceDate = '2030-06-15';

test('repealed verlangt einen letzten Geltungstag vor dem Stichtag', () => {
  assert.deepEqual(normStatusProblems({ status: 'repealed', expiryDate: '2030-06-14' }, referenceDate), []);
  assert.equal(normStatusProblems({ status: 'repealed', expiryDate: '2030-06-15' }, referenceDate).length, 1);
  assert.equal(normStatusProblems({ status: 'repealed', expiryDate: '2030-06-16' }, referenceDate).length, 1);
  assert.equal(normStatusProblems({ status: 'repealed' }, referenceDate).length, 1);
});

test('in-force und future-effective folgen dem Inkrafttreten', () => {
  assert.deepEqual(normStatusProblems({ status: 'in-force', effectiveDate: '2030-06-15' }, referenceDate), []);
  assert.equal(normStatusProblems({ status: 'in-force', effectiveDate: '2030-06-16' }, referenceDate).length, 1);
  assert.deepEqual(normStatusProblems({ status: 'future-effective', effectiveDate: '2030-06-16' }, referenceDate), []);
  assert.equal(normStatusProblems({ status: 'future-effective', effectiveDate: '2030-06-15' }, referenceDate).length, 1);
  assert.equal(normStatusProblems({ status: 'pending-effective', effectiveDate: '2030-07-01' }, referenceDate).length, 1);
});
