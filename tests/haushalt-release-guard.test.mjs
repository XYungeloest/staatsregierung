import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkHaushaltRelease, nichtFreigegebenePerioden, readVorschauMarker } from '../scripts/check-haushalt-release.mjs';
import {
  VORSCHAU_MARKER,
  haushaltVorschauIntegration,
  noindexHeaderPfade,
  parseHaushaltVorschau,
  schreibeVorschauArtefakte,
} from '../scripts/lib/haushalt/vorschau.mjs';

/**
 * Freigabe-Guard und Vorschau-Integration gegen synthetische Build-Bäume in os.tmpdir(): ohne
 * Vorschau keine Spur nicht freigegebener Perioden (Adressen, Dateinamen, Snapshotdaten), mit
 * Vorschau überall noindex (Seiten und _headers) und keine Sitemap-Einträge; Produktions- und
 * Staging-Deploy verweigern Vorschau-Builds.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts', 'check-haushalt-release.mjs');
const OFFEN = '2091-2092';
const GESPERRT = '2093-2094';
const VOLUMEN = 123456789012;

const seite = ({ robots = 'index, follow', body = '', vorschauHinweis = false } = {}) =>
  `<!doctype html><html><head><meta name="robots" content="${robots}" /></head>`
  + `<body>${vorschauHinweis ? '<div data-haushalt-vorschau>Vorschau</div>' : ''}${body}</body></html>`;

const NOINDEX = 'noindex, follow';

function fixture(t, { vorschau = false, perioden } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'haushalt-release-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const dist = join(base, 'dist');
  const client = join(dist, 'client');
  const content = join(base, 'content');
  const data = join(base, 'data', 'haushalt');
  mkdirSync(join(content, 'haushalt'), { recursive: true });
  mkdirSync(join(data, GESPERRT), { recursive: true });
  writeFileSync(join(content, 'haushalt', 'perioden.json'), JSON.stringify({
    perioden: perioden ?? [
      { id: OFFEN, status: 'verkuendet', freigabe: { oeffentlich: true } },
      { id: GESPERRT, status: 'regierungsentwurf', freigabe: { oeffentlich: false } },
    ],
  }));
  writeFileSync(join(data, GESPERRT, 'gesamtplan.json'), JSON.stringify({
    jahre: { 2093: { einnahmen: VOLUMEN, ausgaben: VOLUMEN, haushaltsvolumen: VOLUMEN, tilgung: 45, hauptgruppen: { 0: 99999999999 } } },
  }));
  writeFileSync(join(data, GESPERRT, 'import-manifest.json'), JSON.stringify({ quelle: { commit: 'a'.repeat(40) } }));
  const write = (path, text) => {
    const file = join(client, ...path.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  write('index.html', seite({ body: `<a href="/haushalt/${OFFEN}/">Haushalt</a>` }));
  write(`haushalt/${OFFEN}/index.html`, seite());
  write('sitemap.xml', `<urlset><url><loc>https://example.invalid/haushalt/${OFFEN}/</loc></url></urlset>`);
  write('search-index.json', JSON.stringify({ entries: [{ url: `/haushalt/${OFFEN}/` }] }));
  write('_headers', '/*\n  X-Content-Type-Options: nosniff\n');
  if (vorschau) {
    writeFileSync(join(dist, VORSCHAU_MARKER), JSON.stringify({ schema: 'haushalt-vorschau/1', vorschau: true }));
    write('_headers', `/*\n  X-Content-Type-Options: nosniff\n\n/haushalt/${GESPERRT}/*\n  X-Robots-Tag: noindex\n`);
  }
  const check = (options = {}) => checkHaushaltRelease({ distRoot: dist, contentRoot: content, dataRoot: data, ...options });
  const run = (args = [], env = {}) => spawnSync(process.execPath, [script, '--dist', dist, '--content', content, '--data', data, ...args], {
    encoding: 'utf8',
    env: { ...process.env, DEPLOY_TARGETS: '', ...env },
  });
  return { base, dist, client, content, data, write, check, run };
}

test('ohne Vorschau: ein sauberer Build besteht', (t) => {
  const { check } = fixture(t);
  const result = check();
  assert.equal(result.modus, 'freigabe');
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.perioden, [GESPERRT]);
});

test('ohne Vorschau: Seiten, Daten, Verweise, Sitemap- und Sucheinträge der gesperrten Periode sind Leaks', (t) => {
  const { write, check } = fixture(t);
  write(`haushalt/${GESPERRT}/index.html`, seite({ robots: NOINDEX }));
  write(`haushalt/${GESPERRT}/daten/titel.csv`, 'kapitel;titel\n');
  write('ausgabe/Haushalt_2093_2094.pdf', '%PDF-1.7');
  write('themen/muster/index.html', seite({ body: `<a href="/haushalt/${GESPERRT}/einzelplaene/04/">Entwurf</a>` }));
  write('sitemap.xml', `<urlset><url><loc>https://example.invalid/haushalt/${GESPERRT}/</loc></url></urlset>`);
  write('search-index.json', JSON.stringify({ entries: [{ url: `/haushalt/${GESPERRT}/` }] }));
  write('_redirects', `/haushalt/entwurf/ /haushalt/${GESPERRT}/ 301\n`);
  write('termine/kalender.ics', `BEGIN:VCALENDAR\nURL:https://example.invalid/haushalt/${GESPERRT}/\nEND:VCALENDAR\n`);
  write('haushalt/baukasten/index.html', seite({ robots: NOINDEX, vorschauHinweis: true }));
  const problems = check().problems.join('\n');
  assert.match(problems, /enthält aber 2 Datei\(en\) unter \/haushalt\/2093-2094\//u);
  assert.match(problems, /Ausgabedatei \/ausgabe\/Haushalt_2093_2094\.pdf/u);
  assert.match(problems, /\/themen\/muster\/index\.html verweist aber auf \/haushalt\/2093-2094\//u);
  assert.match(problems, /\/sitemap\.xml verweist/u);
  assert.match(problems, /\/search-index\.json verweist/u);
  assert.match(problems, /\/_redirects verweist/u);
  assert.match(problems, /\/termine\/kalender\.ics verweist/u);
  assert.match(problems, /\/haushalt\/baukasten\/index\.html trägt einen Vorschauhinweis/u);
});

test('ohne Vorschau: Dateinamen und Snapshotdaten der gesperrten Periode sind Leaks', (t) => {
  const { write, check } = fixture(t);
  write('downloads/doppelhaushalt-2093-2094.xlsx', 'PK');
  write('images/haushalt-2093-2094-eckwerte.png', 'PNG');
  write('presse/meldung/index.html', seite({ body: '<p>Ausgaben 123.456.789.012 Euro</p>' }));
  write('_astro/daten.Ab12.js', `const d={ausgaben:${VOLUMEN}};`);
  write('_astro/export.Cd34.js', 'const name="titel-ep04-2093-2094.csv";');
  write('_astro/quelle.Ef56.js.map', `{"sources":["${'a'.repeat(40)}"]}`);
  const result = check();
  const problems = result.problems.join('\n');
  assert.match(problems, /Ausgabedatei \/downloads\/doppelhaushalt-2093-2094\.xlsx/u);
  assert.match(problems, /Ausgabedatei \/images\/haushalt-2093-2094-eckwerte\.png/u);
  assert.match(problems, /\/presse\/meldung\/index\.html enthält aber Daten ihres Snapshots \(123\.456\.789\.012\)/u);
  assert.match(problems, /\/_astro\/daten\.Ab12\.js enthält aber Daten ihres Snapshots \(123456789012\)/u);
  assert.match(problems, /\/_astro\/export\.Cd34\.js nennt aber eine Datei der Periode \(titel-ep04-2093-2094\.csv\)/u);
  assert.match(problems, /\/_astro\/quelle\.Ef56\.js\.map enthält aber Daten ihres Snapshots/u);
  assert.match(result.hinweise.join('\n'), /nicht referenzierte Client-Bundles/u);

  // Kleine Beträge und Hauptgruppenwerte sind keine Fingerabdrücke; freie Erwähnungen der Jahre bleiben zulässig.
  const sauber = fixture(t);
  sauber.write('presse/meldung/index.html', seite({ body: '<p>Die Aufstellung des Doppelhaushalts 2093/2094 beginnt; 45 Stellen.</p>' }));
  assert.deepEqual(sauber.check().problems, []);
});

test('mit Vorschau: fehlende Seiten sind kein Fehler, vorhandene brauchen noindex und _headers die noindex-Regel', (t) => {
  const { write, check } = fixture(t, { vorschau: true });
  let result = check();
  assert.equal(result.modus, 'vorschau');
  assert.deepEqual(result.problems, [], 'Vorschau ohne gebaute Seiten');

  write(`haushalt/${GESPERRT}/index.html`, seite({ robots: NOINDEX, vorschauHinweis: true }));
  write(`haushalt/${GESPERRT}/daten/titel.csv`, 'kapitel;titel\n');
  write('index.html', seite({ body: `<a href="/haushalt/${GESPERRT}/">Entwurf</a>` }));
  result = check();
  assert.deepEqual(result.problems, [], 'Verweise und Daten sind in der Vorschau zulässig; Daten deckt die _headers-Regel ab');
  assert.match(result.hinweise.join('\n'), /1 Vorschauseite/u);

  write(`haushalt/${GESPERRT}/gesamtplan/index.html`, seite());
  write(`haushalt/${GESPERRT}/projekte/index.html`, seite({ robots: 'nofollow' }));
  write('haushalt/baukasten/index.html', seite({ vorschauHinweis: true }));
  write('sitemap.xml', `<urlset><url><loc>https://example.invalid/haushalt/${GESPERRT}/</loc></url></urlset>`);
  write('_headers', '/*\n  X-Content-Type-Options: nosniff\n');
  const problems = check().problems.join('\n');
  assert.match(problems, /\/haushalt\/2093-2094\/gesamtplan\/index\.html: Vorschauseite der Periode 2093-2094 ohne noindex/u);
  assert.match(problems, /\/haushalt\/2093-2094\/projekte\/index\.html: Vorschauseite der Periode 2093-2094 ohne noindex/u, 'nofollow ist kein noindex');
  assert.match(problems, /\/haushalt\/baukasten\/index\.html: Seite mit Vorschauhinweis ohne noindex/u);
  assert.match(problems, /sitemap\.xml enthält Adressen der nicht freigegebenen Periode 2093-2094/u);
  assert.match(problems, /_headers setzt für \/haushalt\/2093-2094\/\* kein „X-Robots-Tag: noindex“/u);
});

test('Produktions- und Staging-Deploy verweigern Vorschau-Builds und prüfen zusätzlich auf Leaks', (t) => {
  const { write, run } = fixture(t, { vorschau: true });
  const pruefung = run();
  assert.equal(pruefung.status, 0, pruefung.stderr);
  assert.match(pruefung.stdout, /Vorschau-Build/u);
  write('themen/muster/index.html', seite({ body: `<a href="/haushalt/${GESPERRT}/">Entwurf</a>` }));
  for (const [flag, ziel] of [['--produktion', 'die Produktion'], ['--staging', 'das öffentlich erreichbare Staging']]) {
    const result = run([flag]);
    assert.notEqual(result.status, 0, flag);
    assert.match(result.stderr, new RegExp(`darf nicht in ${ziel}`, 'u'), flag);
    assert.match(result.stderr, /\/themen\/muster\/index\.html verweist aber/u, `${flag}: Leakprüfung trotz Ablehnung`);
    // Ein explizites Deploy-Ziel wird nie übersprungen, auch wenn DEPLOY_TARGETS das Portal nicht nennt.
    const ohnePortal = run([flag], { DEPLOY_TARGETS: 'law' });
    assert.notEqual(ohnePortal.status, 0, `${flag} mit DEPLOY_TARGETS=law`);
    assert.doesNotMatch(ohnePortal.stdout, /übersprungen/u);
  }
  assert.notEqual(run(['--produktion', '--staging']).status, 0);
});

test('Marker und Register: ungültige Marker und fehlendes Register brechen ab, Arbeitsentwürfe sind nie frei', (t) => {
  const { dist, content, check, run } = fixture(t);
  writeFileSync(join(dist, VORSCHAU_MARKER), '{kein json');
  assert.throws(() => readVorschauMarker(dist), /ungültiges JSON/u);
  assert.notEqual(run().status, 0);
  writeFileSync(join(dist, VORSCHAU_MARKER), JSON.stringify({ schema: 'haushalt-vorschau/1', vorschau: false }));
  assert.throws(() => check(), /ungültiger Marker/u);
  writeFileSync(join(dist, VORSCHAU_MARKER), JSON.stringify({ vorschau: true }));
  assert.throws(() => check(), /ungültiger Marker/u);
  rmSync(join(dist, VORSCHAU_MARKER));

  rmSync(join(content, 'haushalt', 'perioden.json'));
  assert.throws(() => check(), /perioden\.json fehlt/u);
  const fehlt = run();
  assert.notEqual(fehlt.status, 0);
  assert.match(fehlt.stderr, /abgebrochen: content\/haushalt\/perioden\.json fehlt/u);

  writeFileSync(join(content, 'haushalt', 'perioden.json'), JSON.stringify({
    perioden: [
      { id: OFFEN, status: 'verkuendet', freigabe: { oeffentlich: true } },
      { id: GESPERRT, status: 'arbeitsentwurf', freigabe: { oeffentlich: true } },
    ],
  }));
  assert.deepEqual(nichtFreigegebenePerioden(content), [GESPERRT], 'ein Arbeitsentwurf ist trotz oeffentlich:true gesperrt');
});

test('ohne Portal im Deploy-Ziel wird die Standardprüfung übersprungen; ohne Build bricht sie ab', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'haushalt-release-leer-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const skip = spawnSync(process.execPath, [script, '--dist', join(base, 'fehlt')], {
    encoding: 'utf8',
    env: { ...process.env, DEPLOY_TARGETS: 'law' },
  });
  assert.equal(skip.status, 0);
  assert.match(skip.stdout, /übersprungen/u);
  const fehlt = spawnSync(process.execPath, [script, '--dist', join(base, 'fehlt')], {
    encoding: 'utf8',
    env: { ...process.env, DEPLOY_TARGETS: 'portal' },
  });
  assert.notEqual(fehlt.status, 0);
  assert.match(fehlt.stderr, /Portal-Build fehlt/u);
});

test('Vorschauschalter: nur 1/true schalten ein, unbekannte Werte brechen ab', () => {
  for (const wert of ['1', 'true', ' TRUE ', true]) assert.equal(parseHaushaltVorschau(wert), true, String(wert));
  for (const wert of [undefined, '', '0', 'false', ' False ', false]) assert.equal(parseHaushaltVorschau(wert), false, String(wert));
  for (const wert of ['yes', 'ja', '2', 'on']) assert.throws(() => parseHaushaltVorschau(wert), /HAUSHALT_VORSCHAU="/u, wert);
});

test('Vorschau-Integration schreibt Marker und noindex-Regel und entfernt den Marker ohne Vorschau', async (t) => {
  const { dist, client, content, check } = fixture(t);
  const logs = [];
  const logger = { info: (message) => logs.push(message) };
  const integration = haushaltVorschauIntegration({ vorschau: true, contentRoot: content });
  assert.equal(integration.name, 'haushalt-vorschau-marker');
  integration.hooks['astro:config:done']({ config: { outDir: pathToFileURL(`${dist}/`), build: { client: pathToFileURL(`${client}/`) } } });
  await integration.hooks['astro:build:done']({ logger });
  assert.deepEqual(readVorschauMarker(dist), { schema: 'haushalt-vorschau/1', vorschau: true, perioden: [GESPERRT] });
  const headers = readFileSync(join(client, '_headers'), 'utf8');
  assert.ok(headers.startsWith('/*\n  X-Content-Type-Options: nosniff\n'), 'bestehende Regeln bleiben erhalten');
  assert.ok(noindexHeaderPfade(headers).has(`/haushalt/${GESPERRT}/*`));
  assert.match(logs.join('\n'), /Vorschau-Build/u);
  assert.equal(check().modus, 'vorschau');
  assert.deepEqual(check().problems, []);

  // Wiederholter Lauf ergänzt die Regel nicht doppelt.
  await schreibeVorschauArtefakte({ outDir: dist, clientDir: client, vorschau: true, contentRoot: content });
  assert.equal(readFileSync(join(client, '_headers'), 'utf8').split(`/haushalt/${GESPERRT}/*`).length, 2);

  const ohne = haushaltVorschauIntegration({ vorschau: false, contentRoot: content });
  ohne.hooks['astro:config:done']({ config: { outDir: pathToFileURL(`${dist}/`), build: { client: pathToFileURL(`${client}/`) } } });
  await ohne.hooks['astro:build:done']({ logger });
  assert.equal(existsSync(join(dist, VORSCHAU_MARKER)), false);
  assert.equal(check().modus, 'freigabe');
});

test('Vorschau-Build ohne nicht freigegebene Periode schreibt keinen Marker und besteht die Produktionsprüfung', async (t) => {
  const { dist, client, content, check } = fixture(t, { perioden: [{ id: OFFEN, status: 'verkuendet', freigabe: { oeffentlich: true } }] });
  // Ein alter Marker aus einem früheren Vorschau-Build wird entfernt.
  writeFileSync(join(dist, VORSCHAU_MARKER), JSON.stringify({ schema: 'haushalt-vorschau/1', vorschau: true, perioden: [GESPERRT] }));
  const ergebnis = await schreibeVorschauArtefakte({ outDir: dist, clientDir: client, vorschau: true, contentRoot: content });
  assert.deepEqual(ergebnis, { marker: false, perioden: [] });
  assert.equal(existsSync(join(dist, VORSCHAU_MARKER)), false);
  assert.equal(noindexHeaderPfade(readFileSync(join(client, '_headers'), 'utf8')).size, 0, 'keine noindex-Regel ohne gesperrte Periode');
  assert.equal(check().modus, 'freigabe');
  assert.deepEqual(check({ produktion: true }).problems, []);
});
