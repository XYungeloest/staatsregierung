import assert from 'node:assert/strict';
import test from 'node:test';

import { withBuildCommitHeader } from '../scripts/lib/build-commit.mjs';

test('Buildkennung wird vollständig und idempotent in die globale Headerregel eingetragen', () => {
  const commit = '0123456789abcdef0123456789abcdef01234567';
  const initial = '/*\n  X-Content-Type-Options: nosniff\n';
  const stamped = withBuildCommitHeader(initial, commit);
  assert.match(stamped, new RegExp(`^  X-Portal-Commit: ${commit}$`, 'mu'));
  assert.equal(withBuildCommitHeader(stamped, commit), stamped);
});

test('verkürzte oder ungültige Buildkennungen werden abgewiesen', () => {
  assert.throws(() => withBuildCommitHeader('/*\n', '6bc1b61'), /vollständigen Git-Commit/u);
});
