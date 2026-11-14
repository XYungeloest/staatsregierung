#!/usr/bin/env node
// Der Portal-Testserver muss auch On-demand-Seiten tatsächlich im Worker ausliefern.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const i = args.indexOf('--port');
const port = i < 0 ? '4321' : args[i + 1];
const child = spawn(resolve('node_modules/.bin/wrangler'), [
  'dev', '--local', '--config', resolve('apps/portal/dist/server/wrangler.json'),
  '--ip', '127.0.0.1', '--port', port, '--inspector-port', '0',
  '--persist-to', resolve('.cache/portal-worker'), '--show-interactive-dev-session=false',
], { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => process.exit(code ?? 0));
