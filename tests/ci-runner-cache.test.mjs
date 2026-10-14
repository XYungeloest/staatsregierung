import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const action = readFileSync(new URL('../.github/actions/setup-node-modules/action.yml', import.meta.url), 'utf8');
const block = action.match(/id: platform\n[\s\S]*?run: \|\n([\s\S]*?)(?=    - name:)/)?.[1];
assert.ok(block, 'Plattform-Schritt der tatsächlich verwendeten Cache-Action');
const script = block.replace(/^        /gm, '');

function platform(release, runnerOS = 'Linux') {
  const dir = mkdtempSync(join(tmpdir(), 'runner-cache-'));
  const input = join(dir, 'os-release');
  const output = join(dir, 'output');
  writeFileSync(input, release);
  try {
    const run = spawnSync('bash', ['-e', '-c', script.replaceAll('/etc/os-release', input)], {
      env: { ...process.env, RUNNER_OS: runnerOS, RUNNER_ARCH: 'X64', GITHUB_OUTPUT: output },
      encoding: 'utf8',
    });
    return { status: run.status, output: run.status === 0 ? readFileSync(output, 'utf8').trim() : '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('native Cache-Plattform unterscheidet Ubuntu-Versionen und verwendet die Container-Distribution', () => {
  assert.deepEqual(platform('ID=ubuntu\nVERSION_ID="24.04"\n'), { status: 0, output: 'key=Linux-X64-ubuntu-24.04' });
  assert.deepEqual(platform('ID=ubuntu\nVERSION_ID="26.04"\n'), { status: 0, output: 'key=Linux-X64-ubuntu-26.04' });
  assert.deepEqual(platform('ID=debian\nVERSION_ID="13"\n'), { status: 0, output: 'key=Linux-X64-debian-13' });
});

test('eine unvollständige Linux-Identität wird nicht als gemeinsamer Cache-Schlüssel akzeptiert', () => {
  assert.notEqual(platform('ID=ubuntu\n').status, 0);
});

test('nicht-Linux-Runner benötigen keine os-release-Datei', () => {
  assert.deepEqual(platform('', 'macOS'), { status: 0, output: 'key=macOS-X64' });
});
