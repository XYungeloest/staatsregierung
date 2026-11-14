#!/usr/bin/env node
// Interner Workflow: Cloudflare-Zugang bzw. lokale Arbeitskopie, kein öffentlicher Admin-Endpunkt.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const command = args[0];
const option = key => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : undefined; };
const localConfig = resolve(root, option('--local-config') ?? '.cache/fresswuerfel/wrangler.json');
const persist = resolve(root, option('--persist-to') ?? '.cache/fresswuerfel/state');
const publicFile = resolve(root, option('--public-file') ?? '.cache/fresswuerfel/freigabe-lokal.json');
const remote = args.includes('--remote');
const workerEnv = option('--env') ?? '';
const config = remote ? option('--config') : localConfig;
if (remote && !config) throw new Error('--remote benötigt --config mit der freigegebenen Wrangler-Konfiguration.');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
function wrangler(extra, capture = false) {
  const child = spawnSync(resolve(root, 'node_modules/.bin/wrangler'), extra, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  if (child.status !== 0) throw new Error(capture ? child.stderr : 'Wrangler fehlgeschlagen');
  return child.stdout;
}
function sql(query, capture = false) {
  return wrangler(['d1', 'execute', 'FRESSWUERFEL_DB', '--config', config, '--env', workerEnv, remote ? '--remote' : '--local', ...(!remote ? ['--persist-to', persist] : []), '--command', query, ...(capture ? ['--json'] : [])], capture);
}
function objectPath(key) {
  if (!/^originals\/[0-9a-f-]{36}$/.test(key)) throw new Error('Ungültiger privater Objektschlüssel');
  return `${remote ? option('--bucket') ?? (workerEnv === 'staging' ? 'ostrecht-fresswuerfel-skizzen-staging' : 'ostrecht-fresswuerfel-skizzen') : 'fresswuerfel-local-sketches'}/${key}`;
}
async function downloadOriginal(key) {
  const output = resolve(root, '.cache/fresswuerfel/sichtung', key.slice('originals/'.length));
  await mkdir(dirname(output), { recursive: true });
  wrangler(['r2', 'object', 'get', objectPath(key), '--config', config, '--env', workerEnv, remote ? '--remote' : '--local', ...(!remote ? ['--persist-to', persist] : []), '--file', output]);
  console.log(`Privates Original: ${output}`);
  return readFile(output);
}
function deleteOriginal(key) {
  wrangler(['r2', 'object', 'delete', objectPath(key), '--config', config, '--env', workerEnv, remote ? '--remote' : '--local', ...(!remote ? ['--persist-to', persist] : [])]);
}
if (command === 'preview') {
  if (remote) throw new Error('Vorschau läuft ausschließlich lokal');
  const phase = option('--phase') ?? 'einreichung';
  if (!['vorbereitet', 'einreichung', 'sichtung', 'ergebnis'].includes(phase)) throw new Error('Ungültige Phase');
  const builtPath = resolve(root, 'apps/portal/dist/server/wrangler.json');
  const built = JSON.parse(await readFile(builtPath, 'utf8'));
  let approved = null;
  try { approved = JSON.parse(await readFile(publicFile, 'utf8')); } catch {}
  if (approved?.candidates?.some(entry => entry.image)) {
    const { cp } = await import('node:fs/promises');
    await mkdir(resolve(root, 'apps/portal/dist/client/images/fresswuerfel/auswahl'), { recursive: true });
    await cp(resolve(root, '.cache/fresswuerfel/auswahl'), resolve(root, 'apps/portal/dist/client/images/fresswuerfel/auswahl'), { recursive: true });
  }
  const preview = { ...built, name: 'fresswuerfel-local', main: resolve(dirname(builtPath), built.main), assets: { ...built.assets, directory: resolve(dirname(builtPath), built.assets.directory) }, vars: { APP_ENV: 'local', FRESSWUERFEL_ENABLED: 'true', FRESSWUERFEL_UPLOADS_ENABLED: 'true', FRESSWUERFEL_RATE_SALT: 'local-preview-salt-never-use-in-production', FRESSWUERFEL_PREVIEW_PHASE: phase, ...(approved ? { FRESSWUERFEL_PREVIEW_PUBLIC_JSON: JSON.stringify(approved) } : {}) }, d1_databases: [{ binding: 'FRESSWUERFEL_DB', database_name: 'fresswuerfel-local', database_id: '00000000-0000-4000-8000-000000000001' }], r2_buckets: [{ binding: 'FRESSWUERFEL_SKETCHES', bucket_name: 'fresswuerfel-local-sketches' }] };
  delete preview.configPath; delete preview.userConfigPath;
  await mkdir(dirname(localConfig), { recursive: true });
  await writeFile(localConfig, JSON.stringify(preview, null, 2));
  wrangler(['d1', 'execute', 'FRESSWUERFEL_DB', '--local', '--config', localConfig, '--persist-to', persist, '--file', resolve(root, 'data/fresswuerfel/schema.sql')]);
  const columns = JSON.parse(sql('PRAGMA table_info(submissions)', true));
  if (!columns.some(r => r.results?.some(column => column.name === 'sketch_key'))) wrangler(['d1', 'execute', 'FRESSWUERFEL_DB', '--local', '--config', localConfig, '--persist-to', persist, '--file', resolve(root, 'data/fresswuerfel/002-skizzen.sql')]);
  const child = spawn(resolve(root, 'node_modules/.bin/wrangler'), ['dev', '--local', '--config', localConfig, '--persist-to', persist, '--ip', '127.0.0.1', '--port', option('--port') ?? '4330', '--inspector-port', '0', '--show-interactive-dev-session=false'], { cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => process.exit(code ?? 0));
} else if (command === 'list') {
  sql('SELECT number, name, description, email, sketch_key, sketch_type, sketch_size, created_at, expires_at FROM submissions WHERE expires_at > ' + Date.now() + ' ORDER BY created_at DESC LIMIT 100');
} else if (command === 'approve') {
  const number = option('--number'), title = option('--title'), description = option('--description');
  if (!number || !title?.trim() || !description?.trim() || title.length > 100 || description.length > 1000) throw new Error('Benötigt: --number FW-… --title "…" --description "freigegebene Kurzbeschreibung" (max. 100/1.000 Zeichen)');
  const response = JSON.parse(sql(`SELECT number, sketch_key FROM submissions WHERE number = ${quote(number)} AND expires_at > ${Date.now()}`, true));
  if (!response.some(r => r.results?.length)) throw new Error('Keine gültige Einreichung mit dieser Nummer');
  const output = remote ? resolve(root, 'content/kampagnen/fresswuerfel.json') : publicFile;
  let current;
  try { current = JSON.parse(await readFile(output, 'utf8')); } catch { current = JSON.parse(await readFile(resolve(root, 'content/kampagnen/fresswuerfel.json'), 'utf8')); }
  const slug = number.replace(/^FW-/, '').toLowerCase();
  const entry = { slug, title, description };
  if (args.includes('--image')) {
    const alt = option('--alt');
    const row = response.flatMap(r => r.results ?? [])[0];
    if (!row.sketch_key || !alt?.trim()) throw new Error('Für die Bildfreigabe sind ein eingereichtes Bild und --alt erforderlich.');
    const input = await downloadOriginal(row.sketch_key);
    const sharp = (await import('sharp')).default;
    // Neu codieren, verkleinern, automatisch ausrichten; sharp entfernt standardmäßig alle Metadaten.
    const outputBytes = await sharp(input, { limitInputPixels: 4_194_304 }).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const outputDir = resolve(root, remote ? 'public/images/fresswuerfel/auswahl' : '.cache/fresswuerfel/auswahl');
    await mkdir(outputDir, { recursive: true });
    await writeFile(resolve(outputDir, `${slug}.webp`), outputBytes);
    entry.image = { src: `/images/fresswuerfel/auswahl/${slug}.webp`, alt };
  }
  current.candidates = [...current.candidates.filter(x => x.slug !== slug), entry];
  await writeFile(output, JSON.stringify(current, null, 2) + '\n');
  console.log(`Freigegebener öffentlicher Text: ${output}. Vor Veröffentlichung im PR prüfen. Die lokale Freigabe wird nicht produktiv übernommen.`);
} else if (command === 'inspect') {
  const number = option('--number');
  if (!number) throw new Error('--number fehlt');
  const response = JSON.parse(sql(`SELECT sketch_key FROM submissions WHERE number = ${quote(number)} AND expires_at > ${Date.now()}`, true));
  const row = response.flatMap(r => r.results ?? [])[0];
  if (!row?.sketch_key) throw new Error('Kein gültiges Originalbild gefunden');
  await downloadOriginal(row.sketch_key);
} else if (command === 'purge') {
  const rows = JSON.parse(sql(`SELECT number, sketch_key FROM submissions WHERE expires_at <= ${Date.now()} LIMIT 1000`, true)).flatMap(r => r.results ?? []);
  for (const row of rows) {
    if (row.sketch_key) deleteOriginal(row.sketch_key);
    sql(`DELETE FROM submissions WHERE number = ${quote(row.number)}`);
  }
  sql(`DELETE FROM rate_limits WHERE expires_at <= ${Date.now()};`);
} else if (command === 'delete') {
  const number = option('--number');
  if (!number) throw new Error('--number fehlt');
  const rows = JSON.parse(sql(`SELECT sketch_key FROM submissions WHERE number = ${quote(number)}`, true)).flatMap(r => r.results ?? []);
  for (const row of rows) if (row.sketch_key) deleteOriginal(row.sketch_key);
  sql(`DELETE FROM submissions WHERE number = ${quote(number)}`);
} else {
  console.log('Aufruf: node scripts/fresswuerfel.mjs preview [--phase einreichung|sichtung|ergebnis|vorbereitet] [--port 4330]\nSichtung: list | approve --number FW-… --title "…" --description "…" | purge | delete --number FW-…\nStandard: nur lokal. Produktion explizit mit --remote --config apps/portal/wrangler.jsonc');
  process.exitCode = 1;
}
