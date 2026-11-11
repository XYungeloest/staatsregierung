import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync, deflateSync } from 'node:zlib';

import { ARTEFAKT_KENNUNGSMUSTER, artefaktZusatzmarken, freitextSperrmarken, scanArtifact, waehleArtefakte } from '../scripts/lib/haushalt/artefakte.mjs';
import { parseCsv, parseCsvRows } from '../scripts/lib/haushalt/csv.mjs';
import { validateEditorial } from '../scripts/lib/haushalt/editorial.mjs';
import { METABEGRIFFE } from '../apps/portal/src/lib/haushalt/oeffentlich.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'tests', 'fixtures', 'haushalt', 'quelle');
const syncScript = join(root, 'scripts', 'haushalt-sync.mjs');
const checkScript = join(root, 'scripts', 'haushalt-check.mjs');
const aktiv = join('haushalt', '2027-2028');
const lokalerPfad = ['', 'Users', 'beispiel', 'arbeit', ''].join('/');

const gitEnv = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_AUTHOR_DATE: '2026-11-01T12:00:00+01:00',
  GIT_COMMITTER_DATE: '2026-11-01T12:00:00+01:00',
};

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    env: gitEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Legt aus der Fixture ein echtes Git-Repo in einem temporären Verzeichnis an. */
function createSourceRepo() {
  const base = mkdtempSync(join(tmpdir(), 'haushalt-sync-'));
  const repo = join(base, 'osthaushalt-fixture');
  cpSync(fixture, repo, { recursive: true });
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'Testbestand');
  return { base, repo, ziel: join(base, 'ziel'), cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function commitAll(repo, message) {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
}

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

function sync(repo, ziel, ...extra) {
  return runNode(syncScript, ['--source', repo, '--ziel', ziel, ...extra]);
}

function check(ziel) {
  return runNode(checkScript, ['--ziel', ziel, '--nur-snapshot']);
}

/** SHA-256 aller Dateien eines Verzeichnisses (relativer Pfad → Hash). */
function treeHashes(directory) {
  const result = {};
  if (!existsSync(directory)) return result;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else result[relative(directory, path)] = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
  };
  walk(directory);
  return result;
}

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Schreibt die Quellmanifeste nach einer gezielten Datenänderung neu (wie der Haushaltsbuild). */
function rehash(repo) {
  const base = join(repo, aktiv);
  const datenPath = join(base, 'daten', 'manifest.json');
  const daten = JSON.parse(readFileSync(datenPath, 'utf8'));
  for (const name of Object.keys(daten.dateien)) daten.dateien[name] = sha(join(base, 'daten', name));
  writeFileSync(datenPath, `${JSON.stringify(daten, null, 1)}\n`);
  const manifestPath = join(base, 'MANIFEST.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const path of Object.keys(manifest.dateien)) manifest.dateien[path] = sha(join(base, path));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
}

function csvField(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/u.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** Ändert Titel konsistent in titel.json und titel.csv. */
function updateTitles(repo, mutate) {
  const jsonPath = join(repo, aktiv, 'daten', 'titel.json');
  const csvPath = join(repo, aktiv, 'daten', 'titel.csv');
  const rows = JSON.parse(readFileSync(jsonPath, 'utf8'));
  mutate(rows);
  writeFileSync(jsonPath, `${JSON.stringify(rows, null, 1)}\n`);
  const header = Object.keys(rows[0]);
  writeFileSync(csvPath, `${[header.join(','), ...rows.map((row) => header.map((key) => csvField(row[key])).join(','))].join('\r\n')}\r\n`);
}

function updateJson(path, mutate) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  mutate(value);
  writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`);
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const data = Buffer.from(text, 'utf8');
    const compressed = deflateRawSync(data);
    const nameBuffer = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, compressed);
    centrals.push(central, nameBuffer);
    offset += 30 + nameBuffer.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

// ---------------------------------------------------------------------------------------------

test('CSV-Parser: Quotierung, mehrzeilige Felder, CRLF und Fehler', () => {
  const rows = parseCsvRows('a,b,c\r\n"x, y","mehr\nzeilig","sagt ""ja"""\n1,,3\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'mehr\nzeilig', 'sagt "ja"'], ['1', '', '3']]);
  assert.deepEqual(parseCsv('﻿k,v\n1,2').records, [{ k: '1', v: '2' }]);
  assert.throws(() => parseCsv('a,b\n"offen,2\n'), /nicht geschlossenes Anführungszeichen/u);
  assert.throws(() => parseCsv('a,b\n1,2,3\n'), /3 statt 2 Felder/u);
  assert.throws(() => parseCsv('a,a\n1,2\n'), /doppelter Spaltenname/u);
  assert.throws(() => parseCsv('a\nx"y\n'), /Anführungszeichen mitten/u);
});

test('Artefaktprüfung erkennt lokale Pfade in kodierten PDF-Strömen und XLSX-Einträgen', () => {
  const ascii85 = (buffer) => {
    let out = '';
    for (let index = 0; index < buffer.length; index += 4) {
      const chunk = buffer.subarray(index, index + 4);
      let value = Buffer.concat([chunk, Buffer.alloc(4 - chunk.length)]).readUInt32BE(0);
      const digits = [];
      for (let digit = 0; digit < 5; digit += 1) {
        digits.unshift(String.fromCharCode((value % 85) + 33));
        value = Math.floor(value / 85);
      }
      out += digits.slice(0, chunk.length + 1).join('');
    }
    return `${out}~>`;
  };
  const pdf = (text) => {
    const stream = ascii85(deflateSync(Buffer.from(text, 'latin1')));
    return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Filter [ /ASCII85Decode /FlateDecode ] /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n%%EOF\n`, 'latin1');
  };
  assert.equal(scanArtifact('a.pdf', pdf('BT (sauber) Tj ET')).ok, true);
  const belastet = scanArtifact('a.pdf', pdf(`BT (${lokalerPfad}datei.csv) Tj ET`));
  assert.equal(belastet.ok, false);
  assert.match(belastet.findings.join(' '), /macOS-Benutzerpfad/u);
  assert.equal(scanArtifact('a.xlsx', zip([['xl/a.xml', '<a/>']])).ok, true);
  const xlsx = scanArtifact('a.xlsx', zip([['xl/worksheets/_rels/sheet1.xml.rels', `<Relationship Target="../..${lokalerPfad}x.xlsx"/>`]]));
  assert.equal(xlsx.ok, false);
  assert.match(xlsx.findings[0], /sheet1\.xml\.rels/u);
});

test('Import: Erfolg, deterministische Ausgabe und prüfbarer Snapshot', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);

  const first = sync(source.repo, source.ziel);
  assert.equal(first.status, 0, first.stderr);
  const target = join(source.ziel, '2027-2028');
  const before = treeHashes(target);
  assert.ok(Object.keys(before).includes('import-manifest.json'));
  assert.ok(Object.keys(before).some((path) => path.startsWith('titel')));

  const second = sync(source.repo, source.ziel);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(treeHashes(target), before, 'zweiter Lauf muss byte-identisch sein');

  const other = join(source.base, 'ziel-zwei');
  assert.equal(sync(source.repo, other).status, 0);
  assert.deepEqual(treeHashes(join(other, '2027-2028')), before, 'Ausgabe hängt nicht vom Zielort ab');

  const checked = check(source.ziel);
  assert.equal(checked.status, 0, checked.stderr);

  const manifest = JSON.parse(readFileSync(join(target, 'import-manifest.json'), 'utf8'));
  const commit = git(source.repo, 'rev-parse', 'HEAD').trim();
  assert.equal(manifest.schema, 'haushalt-snapshot/1');
  assert.equal(manifest.quelle.commit, commit);
  assert.equal(manifest.quelle.commit_kurz, commit.slice(0, 7));
  assert.equal(manifest.quelle.repository, 'osthaushalt-2027-2028', 'feste Quellkennung statt lokalem Verzeichnisnamen');
  assert.match(first.stdout, /WARNUNG: Der lokale Klon heißt „osthaushalt-fixture“/u);
  const manifestText = readFileSync(join(target, 'import-manifest.json'), 'utf8');
  assert.equal(manifestText.includes(source.base), false, 'kein lokaler Pfad im Manifest');
  assert.equal(/https?:\/\//u.test(manifestText), false, 'keine Netzadresse im Manifest');

  // Interne Felder und Dateien entfallen; Titel beider Jahre sind zusammengeführt.
  const titel = JSON.parse(readFileSync(join(target, 'titel', '01.json'), 'utf8'));
  const allTitel = [...titel.titel, ...JSON.parse(readFileSync(join(target, 'titel', '02.json'), 'utf8')).titel];
  const source0101 = JSON.parse(readFileSync(join(source.repo, aktiv, 'daten', 'titel.json'), 'utf8'));
  assert.equal(allTitel.length * 2, source0101.length);
  for (const entry of allTitel) {
    for (const field of ['ursprung_id', 'ursprung_konzept', 'ursprung_betrag_eur', 'sn_vorbild', 'kennung', 'betrag_eur']) {
      assert.equal(field in entry, false, `${field} darf nicht übernommen werden`);
    }
    assert.deepEqual(Object.keys(entry.jahre), ['2027', '2028']);
  }
  const quellBetraege = Object.fromEntries(source0101.map((row) => [row.id, row.betrag_eur]));
  for (const entry of allTitel) {
    for (const [year, values] of Object.entries(entry.jahre)) assert.equal(values.betrag, quellBetraege[`${entry.konzept_id}@${year}`]);
  }
  assert.ok(titel.jahresfelder.includes('erlaeuterung'), 'zwischen den Jahren variierende Felder stehen unter jahre');
  assert.equal(JSON.stringify(allTitel).includes('berechnungsmethode'), false, 'interne Berechnungsnotizen entfallen');
  const mengeTitel = allTitel.find((entry) => Object.values(entry.jahre).some((values) => values.menge !== undefined && !values.menge.includes('.')));
  assert.ok(mengeTitel, 'jahresbezogene Mengenangaben werden je Jahr aufgelöst');

  const finanzierung = readFileSync(join(target, 'finanzierung.json'), 'utf8');
  for (const forbidden of ['"risiko"', '"bruecke"', '"vergleich"', '"entscheidungen"']) assert.equal(finanzierung.includes(forbidden), false);
  const ruecklagen = readFileSync(join(target, 'ruecklagen.json'), 'utf8');
  for (const forbidden of ['"lose"', '"statistik"', '"certificate"']) assert.equal(ruecklagen.includes(forbidden), false);
  const gesetze = JSON.parse(readFileSync(join(target, 'gesetze.json'), 'utf8'));
  assert.deepEqual(gesetze.dokumente.map((entry) => entry.art), ['gesetzentwurf'], 'interne Vorlagen werden ausgeschlossen');
  const personal = JSON.parse(readFileSync(join(target, 'personal.json'), 'utf8'));
  assert.equal(personal.stellen.art, 'modellierte-planaequivalente');
  assert.equal('reform_2027_f2' in personal.besoldungstabellen, false);
  assert.equal(JSON.stringify(personal).includes('quellen'), false);
});

test('Import bricht bei Hash-Abweichung ab und lässt den Snapshot unverändert', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  const before = treeHashes(join(source.ziel, '2027-2028'));

  const path = join(source.repo, aktiv, 'daten', 'pruefungen.csv');
  writeFileSync(path, `${readFileSync(path, 'utf8')}Nachtrag ohne Manifest,True,,,\r\n`);
  commitAll(source.repo, 'Manipulation ohne Manifest');

  const result = sync(source.repo, source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /daten\/pruefungen\.csv: SHA-256 [0-9a-f]+ weicht vom Quellmanifest ab \(daten\/manifest\.json: [0-9a-f]+\)/u);
  assert.match(result.stderr, /bestehende Snapshot wurde nicht verändert/u);
  assert.deepEqual(treeHashes(join(source.ziel, '2027-2028')), before);
  assert.deepEqual(readdirSync(source.ziel), ['2027-2028'], 'keine temporären Reste');
});

test('Import bricht bei Widerspruch zwischen meta.json und gesamtplan.json ab', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  const before = treeHashes(join(source.ziel, '2027-2028'));

  updateJson(join(source.repo, aktiv, 'daten', 'meta.json'), (meta) => {
    meta.haushaltsvolumen['2027'] += 1;
  });
  rehash(source.repo);
  commitAll(source.repo, 'Widerspruch');

  const result = sync(source.repo, source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Haushaltsvolumen 2027: .*daten\/gesamtplan\.json.*daten\/meta\.json|Haushaltsvolumen 2027: .*daten\/meta\.json.*daten\/gesamtplan\.json/u);
  assert.deepEqual(treeHashes(join(source.ziel, '2027-2028')), before);
});

test('Import bricht ab, wenn die Titelsumme nicht dem Kapitel entspricht', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  const before = treeHashes(join(source.ziel, '2027-2028'));

  let kapitel;
  updateTitles(source.repo, (rows) => {
    const row = rows.find((entry) => entry.seite === 'Ausgabe' && entry.jahr === 2027 && !entry.projekt_id);
    kapitel = row.kapitel;
    row.betrag_eur += 7;
  });
  rehash(source.repo);
  commitAll(source.repo, 'Titelbetrag ohne Kapitel');

  const result = sync(source.repo, source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`Kapitel ${kapitel} 2027 Ausgaben: Summe der Ausgabetitel`, 'u'));
  assert.deepEqual(treeHashes(join(source.ziel, '2027-2028')), before);
});

test('Import verweigert uncommittete Änderungen in der aktiven Fassung', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);

  const path = join(source.repo, aktiv, 'daten', 'meta.json');
  writeFileSync(path, readFileSync(path, 'utf8').replace('Testbestand', 'Testbestand geändert'));
  let result = sync(source.repo, source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /uncommittete Änderungen in haushalt\/2027-2028/u);
  assert.equal(existsSync(source.ziel), false, 'ohne sauberen Stand wird nichts geschrieben');

  git(source.repo, 'checkout', '--', '.');
  writeFileSync(join(source.repo, aktiv, 'daten', 'zusatz.csv'), 'a\n1\n');
  result = sync(source.repo, source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /uncommittete Änderungen/u);

  rmSync(join(source.repo, aktiv, 'daten', 'zusatz.csv'));
  result = sync(source.repo, source.ziel, '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Prüflauf bestanden/u);
  assert.equal(existsSync(join(source.ziel, '2027-2028')), false, 'Prüflauf schreibt nichts');
});

test('Artefakte mit lokalen Pfaden werden gesperrt und nicht übernommen', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  writeFileSync(
    join(source.repo, aktiv, 'ausgabe', 'Haushalt_2027_2028.xlsx'),
    zip([['xl/worksheets/_rels/sheet1.xml.rels', `<Relationship Target="../../..${lokalerPfad}Haushalt.xlsx"/>`]]),
  );
  rehash(source.repo);
  commitAll(source.repo, 'Arbeitsmappe mit Pfad');

  const result = sync(source.repo, source.ziel);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WARNUNG: ausgabe\/Haushalt_2027_2028\.xlsx wird nicht übernommen/u);
  const target = join(source.ziel, '2027-2028');
  assert.equal(existsSync(join(target, 'ausgabe', 'Haushalt_2027_2028.xlsx')), false);
  assert.equal(existsSync(join(target, 'ausgabe', 'Haushalt_2027_2028.pdf')), true);
  const manifestText = readFileSync(join(target, 'import-manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.artefakte.find((entry) => entry.quelldatei === 'Haushalt_2027_2028.xlsx').status, 'gesperrt');
  assert.equal(manifest.artefakte.find((entry) => entry.quelldatei === 'Haushalt_2027_2028.pdf').datei, 'Haushalt_2027_2028.pdf', 'ohne öffentliche Fassung wird die befundfreie Standardausgabe übernommen');
  assert.equal(manifestText.includes(lokalerPfad), false);
  assert.equal(check(source.ziel).status, 0);
});

test('haushalt:check erkennt manipulierte und zusätzliche Snapshot-Dateien', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  const target = join(source.ziel, '2027-2028');

  const titelPath = join(target, 'titel', '01.json');
  const original = readFileSync(titelPath, 'utf8');
  const titel = JSON.parse(original);
  titel.titel[0].jahre['2027'].betrag += 1;
  writeFileSync(titelPath, `${JSON.stringify(titel, null, 2)}\n`);
  let result = check(source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /titel\/01\.json: SHA-256 [0-9a-f]+ weicht vom import-manifest\.json ab/u);
  assert.match(result.stderr, /Summe der/u, 'auch die Summeninvariante schlägt an');

  writeFileSync(titelPath, original);
  assert.equal(check(source.ziel).status, 0);
  writeFileSync(join(target, 'zusatz.json'), '{}\n');
  result = check(source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /zusatz\.json: Datei ist nicht im import-manifest\.json verzeichnet/u);
});

test('Periodenregister und Overlays: Verweise müssen auf vorhandene Ressorts, Themen und Normen zeigen', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'haushalt-overlay-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const content = join(base, 'content');
  const data = join(base, 'data');
  mkdirSync(join(content, 'ressorts'), { recursive: true });
  mkdirSync(join(content, 'themen'), { recursive: true });
  mkdirSync(join(content, 'normen', 'testgesetz'), { recursive: true });
  mkdirSync(join(content, 'haushalt', '2027-2028'), { recursive: true });
  mkdirSync(data, { recursive: true });
  writeFileSync(join(content, 'ressorts', 'finanzen.json'), JSON.stringify({ slug: 'finanzen' }));
  writeFileSync(join(content, 'themen', 'haushalt.json'), JSON.stringify({ slug: 'haushalt' }));
  writeFileSync(join(content, 'normen', 'testgesetz', 'meta.json'), JSON.stringify({ slug: 'testgesetz' }));
  writeFileSync(join(content, 'haushalt', 'perioden.json'), JSON.stringify({
    perioden: [
      { id: '2025-2026', bezeichnung: 'Doppelhaushalt 2025/2026', jahre: [2025, 2026], status: 'verkuendet', datenquelle: 'legacy-2025-2026', freigabe: { oeffentlich: true, datum: '2026-03-24', grundlage: 'Testgesetz' }, rechtsgrundlage: { normSlug: 'testgesetz' } },
      { id: '2027-2028', bezeichnung: 'Doppelhaushalt 2027/2028', jahre: [2027, 2028], status: 'regierungsentwurf', datenquelle: 'legacy-2025-2026', freigabe: { oeffentlich: false, datum: null, grundlage: null } },
    ],
  }));
  const overlayPath = join(content, 'haushalt', '2027-2028', 'einzelplaene.json');
  writeFileSync(overlayPath, JSON.stringify({ einzelplaene: [{ ep: '06', ministrySlugs: ['finanzen'], topicSlugs: ['haushalt'], rechtsbezuege: [{ normSlug: 'testgesetz', label: 'Test', art: 'geltend' }] }] }));
  assert.deepEqual(validateEditorial({ contentRoot: content, dataRoot: data }).problems, []);

  writeFileSync(overlayPath, JSON.stringify({ einzelplaene: [{ ep: '06', ministrySlugs: ['gibt-es-nicht'], topicSlugs: ['fehlt'], rechtsbezuege: [{ normSlug: 'keine-norm', label: 'Test', art: 'erfunden' }], betrag: 5 }] }));
  const problems = validateEditorial({ contentRoot: content, dataRoot: data }).problems.join('\n');
  assert.match(problems, /„gibt-es-nicht“ ist kein Ressort/u);
  assert.match(problems, /„fehlt“ ist kein Thema/u);
  assert.match(problems, /„keine-norm“ verweist auf keine Norm/u);
  assert.match(problems, /„erfunden“ ist keine zulässige Art/u);
  assert.match(problems, /Overlays dürfen keine Beträge tragen/u);
});

/** Zieht nach einer gezielten Snapshot-Änderung die Hashes im import-manifest.json nach. */
function rehashSnapshot(target) {
  const manifestPath = join(target, 'import-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const entry of manifest.snapshotdateien) {
    const buffer = readFileSync(join(target, entry.pfad));
    entry.sha256 = createHash('sha256').update(buffer).digest('hex');
    entry.bytes = buffer.length;
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function updateSnapshotJson(target, file, mutate) {
  const path = join(target, file);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  mutate(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  rehashSnapshot(target);
}

test('haushalt:check prüft Querbezüge allein aus dem Snapshot, auch bei nachgezogenen Hashes', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  const target = join(source.ziel, '2027-2028');
  const original = new Map(['finanzierung.json', 'projekte.json', 'personal.json', 'ruecklagen.json', 'gesetze.json', 'import-manifest.json']
    .map((file) => [file, readFileSync(join(target, file), 'utf8')]));
  const restore = () => {
    for (const [file, text] of original) writeFileSync(join(target, file), text);
  };

  const faelle = [
    ['finanzierung.json', (value) => { value.finanzplan[0].einnahmen += 1; }, /Finanzplan 2027: finanzierung\.json finanzplan einnahmen = .*gesamtplan\.json einnahmen/u],
    ['finanzierung.json', (value) => { value.kreditfinanzierungsplan[0].schuldenstand_ende += 1; }, /Schuldenstand 2027: finanzierung\.json finanzplan schuldenstand/u],
    ['finanzierung.json', (value) => { value.massnahmen[0].jahre['2027'].nettoentlastung += 1; }, /Finanzierungsmaßnahme F01 2027: Einnahmen \+ Einsparungen − Kosten/u],
    ['projekte.json', (value) => { value.projekte.find((entry) => entry.titel.length > 0).jahre['2027'].kernhaushalt += 1; }, /Befund „projektsummen“/u],
    ['personal.json', (value) => { value.reformwirkung.jahre[0].netto += 1; }, /Personalreform 2027/u],
    ['personal.json', (value) => { value.stellen.kapitel[0].jahre['2027'].summe += 1; }, /Planäquivalente Kapitel 0101 2027/u],
    ['ruecklagen.json', (value) => { value.allgemeine_ruecklage[0].ende += 1; }, /Allgemeine Rücklage 2027/u],
    ['gesetze.json', (value) => { value.dokumente[0].titel += ' C:\\Users\\beispiel\\haushalt.xlsx'; }, /gesetze\.json: enthält lokale Pfade \(Windows-Laufwerkspfad\)/u],
  ];
  for (const [file, mutate, expected] of faelle) {
    updateSnapshotJson(target, file, mutate);
    const result = check(source.ziel);
    assert.notEqual(result.status, 0, `${file}: Manipulation muss erkannt werden`);
    assert.match(result.stderr, expected);
    restore();
  }
  assert.equal(check(source.ziel).status, 0);
});

test('haushalt:check ignoriert Betriebssystemdateien und meldet nur echte Importreste', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  writeFileSync(join(source.ziel, '.DS_Store'), 'x');
  writeFileSync(join(source.ziel, '2027-2028', 'ausgabe', '.DS_Store'), 'x');
  let result = check(source.ziel);
  assert.equal(result.status, 0, result.stderr);
  mkdirSync(join(source.ziel, '.2027-2028.neu-123-abcd'));
  result = check(source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Rest eines abgebrochenen Imports/u);
});

test('Import bricht ab, wenn rechnerische Identitäten der Quelle verletzt sind', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  const csvPath = join(source.repo, aktiv, 'daten', 'massnahmen.csv');
  updateJson(join(source.repo, aktiv, 'daten', 'finanzierung.json'), (value) => {
    value.massnahmen[0].nettoentlastung += 1;
  });
  const lines = readFileSync(csvPath, 'utf8').split('\r\n');
  const header = lines[0].split(',');
  const cells = lines[1].split(',');
  const column = header.indexOf('nettoentlastung');
  cells[column] = String(Number(cells[column]) + 1);
  lines[1] = cells.join(',');
  writeFileSync(csvPath, lines.join('\r\n'));
  rehash(source.repo);
  commitAll(source.repo, 'Widersprüchliche Nettoentlastung');

  const result = sync(source.repo, source.ziel, '--dry-run');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Rechnerische Identitäten/u);
  assert.match(result.stderr, /Finanzierungsmaßnahme F01 2027: Einnahmen \+ Einsparungen − Kosten = .*daten\/massnahmen\.csv nettoentlastung/u);
});

test('Import verweigert einen Rückschritt auf einen älteren Quellstand', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  const alt = git(source.repo, 'rev-parse', 'HEAD').trim();
  writeFileSync(join(source.repo, 'README.md'), '# Synthetisches Haushaltsrepo (Testfixture, Folgestand)\n');
  commitAll(source.repo, 'Folgestand');
  assert.equal(sync(source.repo, source.ziel).status, 0);
  const before = treeHashes(join(source.ziel, '2027-2028'));

  git(source.repo, 'checkout', '-q', '--detach', alt);
  let result = sync(source.repo, source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /kein Vorfahr des aktuellen Stands/u);
  assert.deepEqual(treeHashes(join(source.ziel, '2027-2028')), before);

  result = sync(source.repo, source.ziel, '--rueckschritt-erlauben');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Rückschritt ausdrücklich zugelassen/u);
  assert.match(result.stdout, /losgelöster HEAD/u);
  const manifest = JSON.parse(readFileSync(join(source.ziel, '2027-2028', 'import-manifest.json'), 'utf8'));
  assert.equal(manifest.quelle.commit, alt);
});

test('Import liest nur den committeten Stand, auch wenn skip-worktree Änderungen verbirgt', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  updateJson(join(source.repo, aktiv, 'daten', 'projekte.json'), (value) => {
    value[0].beschreibung = 'NICHT-IM-COMMIT';
  });
  rehash(source.repo);
  for (const file of ['daten/projekte.json', 'daten/manifest.json', 'MANIFEST.json']) {
    git(source.repo, 'update-index', '--skip-worktree', `${aktiv}/${file}`.split('\\').join('/'));
  }
  assert.equal(git(source.repo, 'status', '--porcelain').trim(), '', 'git status verbirgt die Änderung');
  const result = sync(source.repo, source.ziel);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /weicht vom Commit HEAD ab/u);
  assert.equal(existsSync(source.ziel), false);
});

test('Fondsgegenposten mit nicht auflösbarem Einnahmetitel werden als Befund verzeichnet', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  const manifest = JSON.parse(readFileSync(join(source.ziel, '2027-2028', 'import-manifest.json'), 'utf8'));
  const befund = manifest.befunde.find((entry) => entry.kennung === 'fonds-einnahmetitel');
  assert.ok(befund, 'Befund fonds-einnahmetitel fehlt');
  assert.deepEqual(befund.abweichungen.map((entry) => [entry.jahr, entry.einnahmetitel, entry.zeilen]), [[2027, '35930', 1]]);
  const personal = JSON.parse(readFileSync(join(source.ziel, '2027-2028', 'personal.json'), 'utf8'));
  assert.deepEqual(personal.rechtsstaende.map((entry) => entry.code), ['R0', 'C']);
  assert.ok(personal.kapitelwirkung.length > 0);
  assert.equal(personal.versorgung.barwerte.rechnungszins, '0.025');
});

test('Artefaktprüfung entmaskiert PDF-Zeichenketten, prüft Bildströme und erkennt nicht öffentliche Abschnitte', () => {
  const pdfMitObjekt = (body) => Buffer.from(`%PDF-1.4\n1 0 obj\n${body}\nendobj\n%%EOF\n`, 'latin1');
  const oktal = (text) => [...text].map((char) => `\\${char.charCodeAt(0).toString(8).padStart(3, '0')}`).join('');
  // Oktal maskierter macOS-Pfad in den Metadaten
  let scan = scanArtifact('a.pdf', pdfMitObjekt(`<< /Author (${oktal(lokalerPfad)}x) >>`));
  assert.equal(scan.ok, false);
  assert.match(scan.findings.join(' '), /macOS-Benutzerpfad/u);
  // UTF-16BE mit Bytefolgemarke
  const utf16 = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(`${lokalerPfad}a`, 'utf16le').swap16()]);
  scan = scanArtifact('a.pdf', pdfMitObjekt(`<< /Title (${[...utf16].map((byte) => `\\${byte.toString(8).padStart(3, '0')}`).join('')}) >>`));
  assert.equal(scan.ok, false);
  // Windows-Pfad mit maskierten Backslashes in einem Literal-String
  scan = scanArtifact('a.pdf', pdfMitObjekt('<< /Author (C:\\\\Users\\\\beispiel\\\\a.xlsx) >>'));
  assert.equal(scan.ok, false);
  assert.match(scan.findings.join(' '), /Windows-Laufwerkspfad/u);
  // Bildstrom mit eingebetteten Metadaten wird nicht übersprungen
  const bild = `\xff\xd8\xff\xe1Exif ${lokalerPfad}foto.jpg \xff\xd9`;
  scan = scanArtifact('a.pdf', pdfMitObjekt(`<< /Filter /DCTDecode /Length ${bild.length} >>\nstream\n${bild}\nendstream`));
  assert.equal(scan.ok, false);
  assert.match(scan.findings.join(' '), /PDF-Bildstrom/u);
  // Nicht öffentliche Abschnitte (Inhaltsprüfung)
  scan = scanArtifact('a.pdf', pdfMitObjekt(`<< /Length 40 >>\nstream\nBT (Risiko- und Sensitivit\\344tsanalyse) Tj ET\nendstream`));
  assert.equal(scan.ok, false);
  assert.deepEqual(scan.inhaltsbefunde, ['Risiko- und Sensitivitätsanalyse']);
  assert.equal(scanArtifact('a.pdf', pdfMitObjekt('<< /Length 20 >>\nstream\nBT (Gesamtplan) Tj ET\nendstream')).ok, true);
});

test('Ausgabedateien mit nicht öffentlichen Abschnitten werden gesperrt', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  writeFileSync(
    join(source.repo, aktiv, 'ausgabe', 'Haushalt_2027_2028.xlsx'),
    zip([['xl/sharedStrings.xml', '<sst><si><t>Vollzugs- und Beschlussmatrix</t></si></sst>']]),
  );
  rehash(source.repo);
  commitAll(source.repo, 'Arbeitsmappe mit internem Abschnitt');
  const result = sync(source.repo, source.ziel);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(join(source.ziel, '2027-2028', 'import-manifest.json'), 'utf8'));
  const artefakt = manifest.artefakte.find((entry) => entry.quelldatei === 'Haushalt_2027_2028.xlsx');
  assert.equal(artefakt.status, 'gesperrt');
  assert.match(artefakt.grund, /nicht öffentliche Abschnitte: Vollzugs- und Beschlussmatrix/u);
  assert.equal(check(source.ziel).status, 0);
});

/** Legt öffentliche Ausgabefassungen neben den Standardausgaben an und verzeichnet sie im MANIFEST.json. */
function addAusgabedateien(repo, dateien) {
  const manifestPath = join(repo, aktiv, 'MANIFEST.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const [name, inhalt] of Object.entries(dateien)) {
    writeFileSync(join(repo, aktiv, 'ausgabe', name), inhalt);
    manifest.dateien[`ausgabe/${name}`] = '';
  }
  manifest.dateien = Object.fromEntries(Object.entries(manifest.dateien).sort(([left], [right]) => (left < right ? -1 : 1)));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  rehash(repo);
}

const neutralesPdf = (text) => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${text.length + 14} >>\nstream\nBT (${text}) Tj ET\nendstream\nendobj\n%%EOF\n`, 'latin1');

test('Öffentliche Ausgabefassung: geprüft, unter neutralem Namen übernommen, interne Fassung bleibt draußen', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  const internXlsx = zip([['xl/sharedStrings.xml', '<sst><si><t>Vollzugs- und Beschlussmatrix</t></si></sst>']]);
  writeFileSync(join(source.repo, aktiv, 'ausgabe', 'Haushalt_2027_2028.xlsx'), internXlsx);
  const oeffentlichPdf = neutralesPdf('Gesamtplan - oeffentliche Ausgabe');
  const oeffentlichXlsx = zip([['xl/sharedStrings.xml', '<sst><si><t>Gesamtplan</t></si></sst>']]);
  addAusgabedateien(source.repo, { 'Haushalt_2027_2028_oeffentlich.pdf': oeffentlichPdf, 'Haushalt_2027_2028_oeffentlich.xlsx': oeffentlichXlsx });
  commitAll(source.repo, 'Öffentliche Ausgabefassungen');
  const standardPdfHash = sha(join(source.repo, aktiv, 'ausgabe', 'Haushalt_2027_2028.pdf'));
  const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

  const result = sync(source.repo, source.ziel);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Hinweis: ausgabe\/Haushalt_2027_2028\.xlsx wird nicht übernommen \(enthält nicht öffentliche Abschnitte: Vollzugs- und Beschlussmatrix\); veröffentlicht wird die öffentliche Ausgabefassung ausgabe\/Haushalt_2027_2028_oeffentlich\.xlsx/u);
  assert.doesNotMatch(result.stdout, /WARNUNG: ausgabe\//u, 'eine ersetzte interne Fassung ist keine Warnung');
  const target = join(source.ziel, '2027-2028');
  assert.deepEqual(readdirSync(join(target, 'ausgabe')).sort(), ['Haushalt_2027_2028.pdf', 'Haushalt_2027_2028.xlsx'], 'nur veröffentlichte Namen');
  assert.equal(sha(join(target, 'ausgabe', 'Haushalt_2027_2028.pdf')), hash(oeffentlichPdf), 'PDF ist die unveränderte öffentliche Fassung');
  assert.equal(sha(join(target, 'ausgabe', 'Haushalt_2027_2028.xlsx')), hash(oeffentlichXlsx), 'XLSX ist die unveränderte öffentliche Fassung');
  const manifestPath = join(target, 'import-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(manifest.artefakte.map((entry) => [entry.quelldatei, entry.status, entry.datei ?? null]), [
    ['Haushalt_2027_2028.pdf', 'ersetzt', null],
    ['Haushalt_2027_2028.xlsx', 'gesperrt', null],
    ['Haushalt_2027_2028_oeffentlich.pdf', 'uebernommen', 'Haushalt_2027_2028.pdf'],
    ['Haushalt_2027_2028_oeffentlich.xlsx', 'uebernommen', 'Haushalt_2027_2028.xlsx'],
  ]);
  assert.equal(manifest.artefakte[0].sha256, standardPdfHash);
  for (const entry of manifest.artefakte) {
    assert.equal(manifest.quelldateien.find((datei) => datei.pfad === `haushalt/2027-2028/ausgabe/${entry.quelldatei}`)?.sha256, entry.sha256, `${entry.quelldatei}: Hash gegen Quellmanifest`);
  }
  let checked = check(source.ziel);
  assert.equal(checked.status, 0, checked.stderr);
  const before = treeHashes(target);
  assert.equal(sync(source.repo, source.ziel).status, 0);
  assert.deepEqual(treeHashes(target), before, 'zweiter Lauf muss byte-identisch sein');

  // haushalt:check sichert Herkunft, Vorrang und Sperre allein aus dem Snapshot ab.
  const original = readFileSync(manifestPath);
  const xlsxPath = join(target, 'ausgabe', 'Haushalt_2027_2028.xlsx');
  const faelle = [
    [
      'interne Arbeitsmappe unter neutralem Namen, Hashes nachgezogen',
      (value) => {
        writeFileSync(xlsxPath, internXlsx);
        const datei = value.snapshotdateien.find((entry) => entry.pfad === 'ausgabe/Haushalt_2027_2028.xlsx');
        datei.sha256 = hash(internXlsx);
        datei.bytes = internXlsx.length;
        const artefakt = value.artefakte.find((entry) => entry.datei === 'Haushalt_2027_2028.xlsx');
        artefakt.sha256 = hash(internXlsx);
        artefakt.bytes = internXlsx.length;
      },
      /Inhalt des gesperrten Artefakts Haushalt_2027_2028\.xlsx liegt im Snapshot/u,
    ],
    [
      'Standardausgabe statt öffentlicher Fassung',
      (value) => {
        Object.assign(value.artefakte[0], { datei: 'Haushalt_2027_2028.pdf', status: 'uebernommen', bytes: 1 });
        delete value.artefakte[0].grund;
      },
      /Standardausgabe Haushalt_2027_2028\.pdf übernommen, obwohl die öffentliche Ausgabefassung Haushalt_2027_2028_oeffentlich\.pdf vorliegt/u,
    ],
    ['Herkunftsdatei fehlt', (value) => delete value.artefakte[2].quelldatei, /ohne gültige Herkunftsdatei/u],
    ['Herkunftsname als Zieldatei', (value) => { value.artefakte[2].datei = 'Haushalt_2027_2028_oeffentlich.pdf'; }, /veröffentlicht wird es als Haushalt_2027_2028\.pdf/u],
    ['Artefakteintrag fehlt', (value) => value.artefakte.splice(1, 1), /Ausgabedatei haushalt\/2027-2028\/ausgabe\/Haushalt_2027_2028\.xlsx der Quelle ohne Artefakteintrag/u],
  ];
  for (const [name, mutate, expected] of faelle) {
    const value = JSON.parse(original.toString('utf8'));
    mutate(value);
    writeFileSync(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
    checked = check(source.ziel);
    assert.notEqual(checked.status, 0, `${name}: muss erkannt werden`);
    assert.match(checked.stderr, expected, name);
    writeFileSync(manifestPath, original);
    writeFileSync(xlsxPath, oeffentlichXlsx);
  }
  assert.equal(check(source.ziel).status, 0);
});

test('Öffentliche Ausgabefassung mit Befund: gesperrt, kein Rückgriff auf die Standardausgabe', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  addAusgabedateien(source.repo, {
    'Haushalt_2027_2028_oeffentlich.pdf': neutralesPdf('Risiko- und Sensitivit\\344tsanalyse'),
    'Haushalt_2027_2028_oeffentlich.xlsx': zip([['xl/worksheets/_rels/sheet1.xml.rels', `<Relationship Target="../../..${lokalerPfad}Haushalt.xlsx"/>`]]),
  });
  commitAll(source.repo, 'Fehlerhafte öffentliche Ausgabefassungen');

  const result = sync(source.repo, source.ziel);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WARNUNG: ausgabe\/Haushalt_2027_2028_oeffentlich\.pdf wird nicht übernommen \(enthält nicht öffentliche Abschnitte: Risiko- und Sensitivitätsanalyse\)\. Für Haushalt_2027_2028\.pdf wird keine Datei veröffentlicht/u);
  const target = join(source.ziel, '2027-2028');
  assert.equal(existsSync(join(target, 'ausgabe')), false, 'weder öffentliche noch Standardausgabe im Snapshot');
  const manifestText = readFileSync(join(target, 'import-manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.deepEqual(manifest.artefakte.map((entry) => [entry.quelldatei, entry.status]), [
    ['Haushalt_2027_2028.pdf', 'ersetzt'],
    ['Haushalt_2027_2028.xlsx', 'ersetzt'],
    ['Haushalt_2027_2028_oeffentlich.pdf', 'gesperrt'],
    ['Haushalt_2027_2028_oeffentlich.xlsx', 'gesperrt'],
  ]);
  assert.equal(manifestText.includes(lokalerPfad), false);
  const checked = check(source.ziel);
  assert.equal(checked.status, 0, checked.stderr);
});

test('Ausgabedateien: Titeltexte ohne Freigabe und interne Kennungen sperren PDF und Arbeitsmappe', () => {
  const intern = 'Bestandsschutz bis 2031 ist Verhandlungsposition gegenüber dem Bund und keine zugesagte Leistung';
  const oeffentlichRoh = 'Zuweisungen an die Bezirke für Kreisaufgaben nach Einwohnerzahl und Fläche';
  const texte = { erlaeuterung: new Set([intern, oeffentlichRoh]), rechtsgrundlage: new Set(['Kurz']) };
  const freitexte = { erlaeuterung: { [intern]: { anzeige: null }, [oeffentlichRoh]: { anzeige: oeffentlichRoh } } };
  const marken = artefaktZusatzmarken({ texte, freitexte });
  // Nur der nicht freigegebene Text wird zur Textmarke; zu kurze Texte entfallen.
  assert.equal(freitextSperrmarken({ texte, freitexte }).length, 1);

  const pdfMitText = (...zeilen) => {
    const inhalt = zeilen.map((zeile, index) => `BT 0 ${700 - index * 12} Td (${zeile}) Tj ET`).join('\n');
    return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream\nendobj\n%%EOF\n`, 'latin1');
  };
  const xlsxMitText = (text) => zip([['xl/sharedStrings.xml', `<sst><si><r><t>${text.slice(0, 20)}</t></r><r><t xml:space="preserve">${text.slice(20).replaceAll('&', '&amp;')}</t></r></si></sst>`]]);

  // Zeilenumbruch mit Silbentrennung mitten im nicht freigegebenen Text
  let scan = scanArtifact('a.pdf', pdfMitText('Bestandsschutz bis 2031 ist Verhandlungs-', 'position gegen\\374ber dem Bund und keine zugesagte Leistung'), marken);
  assert.equal(scan.ok, false);
  assert.match(scan.inhaltsbefunde.join(' '), /nicht freigegebener Titeltext \(erlaeuterung\)/u);
  // In der Arbeitsmappe über mehrere Textläufe verteilt
  scan = scanArtifact('a.xlsx', xlsxMitText(intern), marken);
  assert.equal(scan.ok, false);
  // Interne Kennungen
  for (const text of ['Ansatz gegenüber C0 v2 aufgelöst', 'Sonder-BEZ (D-57)', 'Finanzrahmen c0-20261108-v2', 'nach dem Vorbild der sächsischen Zuschüsse', 'Zahlungsstand bis 2026 nicht belegt']) {
    assert.equal(scanArtifact('a.xlsx', xlsxMitText(text), marken).ok, false, text);
  }
  // Name eines realen Handelsunternehmens sperrt PDF und Arbeitsmappe (fail-closed)
  for (const text of ['insbesondere ein Erwerb von tegut-Filialen, bedarf eines gesonderten Beschlusses', 'Eine etwaige Tegut-Übernahme ist nicht veranschlagt']) {
    const xlsx = scanArtifact('a.xlsx', xlsxMitText(text), marken);
    assert.equal(xlsx.ok, false, text);
    assert.match(xlsx.inhaltsbefunde.join(' '), /realen Handelsunternehmens/u);
    assert.equal(scanArtifact('a.pdf', pdfMitText(text.replace('Ü', '\\334')), marken).ok, false, text);
  }
  assert.equal(scanArtifact('a.pdf', pdfMitText('insbesondere ein Erwerb bestehender Filialen eines Handelsunternehmens'), marken).ok, true);
  // Zulässig: Simulationshinweis, Herkunftsländer, freigegebener Text, Paarformen
  for (const text of ['Regierungsentwurf (Simulation)', 'Simulation: fiktives Staatswesen', 'Ansprüche der Herkunftsländer', oeffentlichRoh, 'Schülerinnen und Schüler']) {
    const ergebnis = scanArtifact('a.xlsx', xlsxMitText(text), marken);
    assert.equal(ergebnis.ok, true, `${text}: ${ergebnis.inhaltsbefunde.join(', ')}`);
    assert.equal(scanArtifact('a.pdf', pdfMitText(text.replace('ü', '\\374')), marken).ok, true, text);
  }
  // Ohne Klassifikation gilt kein Titeltext als freigegeben (fail-closed).
  assert.equal(scanArtifact('a.xlsx', xlsxMitText(oeffentlichRoh), artefaktZusatzmarken({ texte, freitexte: null })).ok, false);

  // Auswahl: gesperrte öffentliche Fassung → keine Datei, kein Rückgriff auf die Standardausgabe
  const kandidat = (datei, buffer) => ({ datei, buffer, sha256: createHash('sha256').update(buffer).digest('hex') });
  const auswahl = waehleArtefakte([
    kandidat('Haushalt_2027_2028.xlsx', xlsxMitText('Gesamtplan')),
    kandidat('Haushalt_2027_2028_oeffentlich.xlsx', xlsxMitText(intern)),
  ], marken);
  assert.deepEqual(auswahl.artefakte.map((entry) => [entry.quelldatei, entry.status]), [
    ['Haushalt_2027_2028.xlsx', 'ersetzt'],
    ['Haushalt_2027_2028_oeffentlich.xlsx', 'gesperrt'],
  ]);
  assert.equal(auswahl.dateien.size, 0);
});

test('Artefaktprüfung sperrt den Unternehmensnamen mit demselben Muster wie die öffentlichen Seiten', () => {
  const metabegriff = METABEGRIFFE.find((begriff) => begriff.id === 'unternehmensname');
  assert.ok(metabegriff, 'METABEGRIFFE enthält unternehmensname');
  const kennung = ARTEFAKT_KENNUNGSMUSTER.find((eintrag) => eintrag.bezeichnung === 'Name eines realen Handelsunternehmens');
  assert.ok(kennung, 'ARTEFAKT_KENNUNGSMUSTER enthält den Unternehmensnamen');
  assert.equal(kennung.muster.source, metabegriff.muster.source);
  assert.equal(kennung.muster.flags, metabegriff.muster.flags);
});

test('haushalt:check sperrt einen Snapshot, dessen übernommene Ausgabedatei nicht freigegebene Titeltexte enthält', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  const target = join(source.ziel, '2027-2028');
  const contentRoot = join(source.base, 'content');
  mkdirSync(join(contentRoot, 'haushalt', '2027-2028'), { recursive: true });
  // Nach dem ersten Import: einen Titeltext der Fixture als nicht anzuzeigen einstufen
  assert.equal(sync(source.repo, source.ziel, '--content', contentRoot).status, 0);
  const titel = readdirSync(join(target, 'titel')).filter((name) => name.endsWith('.json')).flatMap((name) => JSON.parse(readFileSync(join(target, 'titel', name), 'utf8')).titel);
  const felder = ['rechtsgrundlage', 'finanzierung', 'erlaeuterung', 'vermerk'];
  const kandidaten = titel.flatMap((entry) => felder.map((feldname) => [feldname, entry[feldname]]));
  const [feld, rohtext] = kandidaten.find(([, text]) => typeof text === 'string' && text.replace(/[^\p{L}\p{N}]/gu, '').length >= 20) ?? [];
  assert.ok(rohtext, 'Fixture braucht einen Titeltext');
  writeFileSync(join(contentRoot, 'haushalt', '2027-2028', 'freitexte.json'), JSON.stringify({ [feld]: { [rohtext]: { anzeige: null } } }));

  // Öffentliche Arbeitsmappe mit genau diesem Text: der Import sperrt sie.
  addAusgabedateien(source.repo, { 'Haushalt_2027_2028_oeffentlich.xlsx': zip([['xl/sharedStrings.xml', `<sst><si><t>${rohtext.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</t></si></sst>`]]) });
  commitAll(source.repo, 'Arbeitsmappe mit nicht freigegebenem Titeltext');
  const result = sync(source.repo, source.ziel, '--content', contentRoot);
  assert.equal(result.status, 0, result.stderr);
  const manifestPath = join(target, 'import-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const artefakt = manifest.artefakte.find((entry) => entry.quelldatei === 'Haushalt_2027_2028_oeffentlich.xlsx');
  assert.equal(artefakt.status, 'gesperrt');
  assert.match(artefakt.grund, /1 nicht freigegebene Titeltexte/u);
  assert.equal(existsSync(join(target, 'ausgabe', 'Haushalt_2027_2028.xlsx')), false);

  // Manuell eingespielt: haushalt:check erkennt die Datei trotz nachgezogener Hashes.
  const buffer = readFileSync(join(source.repo, aktiv, 'ausgabe', 'Haushalt_2027_2028_oeffentlich.xlsx'));
  mkdirSync(join(target, 'ausgabe'), { recursive: true });
  writeFileSync(join(target, 'ausgabe', 'Haushalt_2027_2028.xlsx'), buffer);
  Object.assign(artefakt, { datei: 'Haushalt_2027_2028.xlsx', status: 'uebernommen', bytes: buffer.length });
  delete artefakt.grund;
  manifest.snapshotdateien.push({ pfad: 'ausgabe/Haushalt_2027_2028.xlsx', sha256: artefakt.sha256, bytes: buffer.length });
  manifest.snapshotdateien.sort((left, right) => (left.pfad < right.pfad ? -1 : 1));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const checked = runNode(checkScript, ['--ziel', source.ziel, '--content', contentRoot, '--nur-snapshot']);
  assert.notEqual(checked.status, 0);
  assert.match(checked.stderr, /ausgabe\/Haushalt_2027_2028\.xlsx ist als übernommen verzeichnet, enthält aber nicht öffentliche Inhalte: nicht freigegebener Titeltext/u);
});

test('Import warnt, wenn die Ausgabefassung auf einer anderen Fassung der Freitexte beruht', (t) => {
  const source = createSourceRepo();
  t.after(source.cleanup);
  const content = join(source.base, 'content');
  mkdirSync(join(content, 'haushalt', '2027-2028'), { recursive: true });
  const freitexte = Buffer.from('{"rechtsgrundlage":{},"finanzierung":{},"erlaeuterung":{},"vermerk":{},"bezeichnungen":{}}\n', 'utf8');
  writeFileSync(join(content, 'haushalt', '2027-2028', 'freitexte.json'), freitexte);
  const manifestPath = join(source.repo, aktiv, 'MANIFEST.json');
  const setzeKopie = (hash) => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.oeffentliche_freitexte = { datei: 'oeffentlich/freitexte.json', sha256: hash };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  };

  setzeKopie('0'.repeat(64));
  commitAll(source.repo, 'Ausgabe aus älterer Freitextfassung');
  const veraltet = sync(source.repo, source.ziel, '--content', content, '--dry-run');
  assert.equal(veraltet.status, 0, veraltet.stderr);
  assert.match(veraltet.stdout, /WARNUNG: Die Ausgabefassung im Haushaltsrepo beruht auf einer anderen Fassung von content\/haushalt\/2027-2028\/freitexte\.json/u);

  setzeKopie(createHash('sha256').update(freitexte).digest('hex'));
  commitAll(source.repo, 'Ausgabe aus aktueller Freitextfassung');
  const aktuell = sync(source.repo, source.ziel, '--content', content, '--dry-run');
  assert.equal(aktuell.status, 0, aktuell.stderr);
  assert.doesNotMatch(aktuell.stdout, /anderen Fassung von content/u);
});
