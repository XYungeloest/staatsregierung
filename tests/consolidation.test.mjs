import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  applyPatchRecipe,
  sha256,
} from '../scripts/lib/consolidation-engine.mjs';
import { parseRevosaxSnapshot } from '../scripts/lib/revosax-parser.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

function flatten(blocks, result = []) {
  for (const block of blocks ?? []) {
    result.push(block);
    flatten(block.children, result);
  }
  return result;
}

test('amtlicher REVOSax-Snapshot des Feiertagsgesetzes bleibt unverändert und vollständig parsierbar', async () => {
  const config = await readJson('data/recht/consolidation-sources.json');
  const source = config.targets['ostdeutsches-feiertagsgesetz'];
  const bytes = await readFile(source.snapshot);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sourceSha256);

  const parsed = parseRevosaxSnapshot(bytes.toString('utf8'), { url: source.baselineUrl });
  assert.equal(parsed.sourceTitle, 'Gesetz über Sonn- und Feiertage im Freistaat Sachsen');
  assert.equal(parsed.sourceValidFrom, '2013-02-10');
  assert.equal(parsed.sourceValidTo, '2025-05-06');
  const labels = flatten(parsed.body).filter((block) => block.type === 'paragraph').map((block) => block.label);
  for (let number = 1; number <= 11; number += 1) {
    assert.ok(labels.includes(`§ ${number}`), `§ ${number} fehlt`);
  }
  const fullText = JSON.stringify(parsed.body);
  assert.doesNotMatch(fullText, /REVOSax-Suche|Normenhistorie|Dresden,\s+den/iu);
});

test('Feiertagsgesetz entsteht deterministisch als drei vollständige Fassungen', async () => {
  const parsed = await readJson('data/recht/parsed/revosax/ostdeutsches-feiertagsgesetz.json');
  const recipes = await Promise.all([
    readJson('data/recht/amendments/gesetz-zur-anderung-des-gesetzes-uber-sonn-und-feiertage-im-freistaat-ostdeutschland/ostdeutsches-feiertagsgesetz.json'),
    readJson('data/recht/amendments/gesetz-zur-reform-gesetzlicher-feiertage-im-freistaat-ostdeutschland/ostdeutsches-feiertagsgesetz.json'),
  ]);
  const stored = await Promise.all([
    readJson('content/normen/ostdeutsches-feiertagsgesetz/versions/2023-11-01.json'),
    readJson('content/normen/ostdeutsches-feiertagsgesetz/versions/2024-03-07.json'),
    readJson('content/normen/ostdeutsches-feiertagsgesetz/versions/2026-03-23.json'),
  ]);

  let state = { title: parsed.sourceTitle, body: parsed.body };
  assert.deepEqual(state.body, stored[0].body);
  for (const [index, recipe] of recipes.entries()) {
    state = applyPatchRecipe(state, recipe);
    assert.deepEqual(state.body, stored[index + 1].body);
  }

  assert.deepEqual(stored.map(({ validFrom, validTo }) => ({ validFrom, validTo })), [
    { validFrom: '2023-11-01', validTo: '2024-03-07' },
    { validFrom: '2024-03-08', validTo: '2026-03-23' },
    { validFrom: '2026-03-24', validTo: null },
  ]);
  for (const version of stored) {
    const labels = flatten(version.body).filter((block) => block.type === 'paragraph').map((block) => block.label);
    for (let number = 1; number <= 11; number += 1) {
      assert.ok(labels.includes(`§ ${number}`), `${version.versionId}: § ${number} fehlt`);
    }
    assert.doesNotMatch(JSON.stringify(version.body), /u\s*n\s*v\s*e\s*r\s*ä\s*n\s*d\s*e\s*r\s*t/iu);
  }

  const history = await readJson('content/normen/ostdeutsches-feiertagsgesetz/history.json');
  assert.equal(history.initialVersionId, '2023-11-01');
  assert.deepEqual(
    history.entries.filter((entry) => entry.type === 'amendment').map((entry) => entry.relatedNorm),
    recipes.map((recipe) => recipe.amendmentAct),
  );
});

test('Patch-Rezepte brechen bei fehlendem Ziel oder verändertem Ausgangstext ab', () => {
  const state = {
    title: 'Testgesetz',
    body: [{ type: 'paragraph', label: '§ 1', title: 'Test', children: [] }],
  };
  const contract = {
    amendmentAct: 'test-aenderung',
    effectiveDate: '2026-01-02',
    operations: [{
      op: 'replaceProvision',
      target: { type: 'paragraph', label: '§ 2' },
      expectedHash: sha256(state.body[0]),
      expectedMatches: 1,
      value: state.body[0],
      source: 'Gesetze/Test.html',
      sourceProvision: 'Artikel 1',
      effectiveDate: '2026-01-02',
    }],
  };
  assert.throws(() => applyPatchRecipe(state, contract), /0 statt genau einem Treffer/u);
  contract.operations[0].target.label = '§ 1';
  contract.operations[0].expectedHash = '0'.repeat(64);
  assert.throws(() => applyPatchRecipe(state, contract), /Zielhash weicht ab/u);
});

test('Wappenverordnung besitzt den vollständigen Ausgangstext und eine belegte Aufhebung', async () => {
  const version = await readJson('content/normen/wappenverordnung/versions/2023-11-01.json');
  const meta = await readJson('content/normen/wappenverordnung/meta.json');
  const history = await readJson('content/normen/wappenverordnung/history.json');
  assert.equal(meta.status, 'repealed');
  assert.equal(meta.expiryDate, '2026-03-23');
  assert.equal(version.validFrom, '2023-11-01');
  assert.equal(version.validTo, '2026-03-23');
  assert.deepEqual(
    flatten(version.body).filter((block) => block.type === 'paragraph').map((block) => block.label),
    ['§ 1', '§ 2', '§ 3', '§ 4', '§ 5', '§ 6', '§ 7', '§ 8', '§ 9'],
  );
  const repeal = history.entries.find((entry) => entry.type === 'repeal');
  assert.equal(repeal?.date, '2026-03-24');
  assert.equal(repeal?.relatedNorm, 'gesetz-zur-einfuhrung-eines-hoheitszeichengesetzes');
});

test('Ladenöffnungsgesetz erhält Ausgangs- und vollständige Folgefassung ohne Platzhalter', async () => {
  const parsed = await readJson('data/recht/parsed/revosax/saechsisches-ladenoeffnungsgesetz.json');
  const recipe = await readJson(
    'data/recht/amendments/viertes-gesetz-zur-anderung-des-ladenoffnungsgesetzes/saechsisches-ladenoeffnungsgesetz.json',
  );
  const [baseline, current] = await Promise.all([
    readJson('content/normen/saechsisches-ladenoeffnungsgesetz/versions/2023-11-01.json'),
    readJson('content/normen/saechsisches-ladenoeffnungsgesetz/versions/2026-02-01.json'),
  ]);
  assert.deepEqual(baseline.body, parsed.body);
  const result = applyPatchRecipe({ title: parsed.sourceTitle, body: parsed.body }, recipe);
  assert.equal(result.title, 'Ostdeutsches Ladenöffnungsgesetz');
  assert.deepEqual(result.body, current.body);
  assert.deepEqual(
    flatten(current.body).filter((block) => block.type === 'paragraph').map((block) => block.label),
    ['§ 1', '§ 2', '§ 3', '§ 3a', '§ 3b', '§ 4', '§ 5', '§ 6', '§ 7', '§ 8', '§ 8a', '§ 9', '§ 10', '§ 11'],
  );
  const paragraph3 = flatten(current.body).find((block) => block.type === 'paragraph' && block.label === '§ 3');
  const paragraph8 = flatten(current.body).find((block) => block.type === 'paragraph' && block.label === '§ 8');
  assert.match(JSON.stringify(paragraph3), /Montags bis Samstags.*5 bis 23 Uhr/u);
  assert.doesNotMatch(JSON.stringify(paragraph3), /Satz 1 findet keine Anwendung/u);
  assert.match(JSON.stringify(paragraph8), /bis zu fünf Sonntagen wie an einem Werktag/u);
  assert.doesNotMatch(JSON.stringify(current.body), /u\s*n\s*v\s*e\s*r\s*ä\s*n\s*d\s*e\s*r\s*t/iu);
  const history = await readJson('content/normen/saechsisches-ladenoeffnungsgesetz/history.json');
  assert.equal(history.entries.at(-1).relatedNorm, 'viertes-gesetz-zur-anderung-des-ladenoffnungsgesetzes');
});

test('umfangreiche REVOSax-Fassungen schließen Bekanntmachung und Präsentationsüberschriften aus', async () => {
  for (const slug of [
    'saechsische-bauordnung',
    'saechsische-gemeindeordnung',
    'saechsische-haushaltsordnung',
  ]) {
    const parsed = await readJson(`data/recht/parsed/revosax/${slug}.json`);
    const fullText = JSON.stringify(parsed.body);
    assert.doesNotMatch(fullText, /Bekanntmachung der Neufassung|Rechtsbereinigt mit Stand|Inhaltsübersicht/iu, slug);
    assert.ok(flatten(parsed.body).some((block) => block.type === 'paragraph'), `${slug}: Paragraphen fehlen`);
  }
});

test('Verwaltungskosten-, Flüchtlingsaufnahme- und Abschiebungshaftrecht sind vollständig konsolidiert', async () => {
  const cases = [
    {
      slug: 'saechsisches-verwaltungskostengesetz',
      dates: ['2023-11-01', '2026-01-27'],
      expected: ['§ 3a'],
    },
    {
      slug: 'fluechtlingsaufnahmegesetz',
      dates: ['2023-11-01', '2026-03-24'],
      expected: ['§ 3', '§ 4', '§ 11', '§ 11a'],
    },
    {
      slug: 'abschiebungshaftvollzugsgesetz',
      dates: ['2023-11-01', '2026-03-24'],
      expected: ['§ 2a', '§ 6a'],
    },
  ];
  for (const entry of cases) {
    const versions = await Promise.all(entry.dates.map((date) =>
      readJson(`content/normen/${entry.slug}/versions/${date}.json`)
    ));
    assert.deepEqual(versions.map((version) => version.validFrom), entry.dates, entry.slug);
    const labels = flatten(versions.at(-1).body).map((block) => block.label).filter(Boolean);
    for (const expected of entry.expected) assert.ok(labels.includes(expected), `${entry.slug}: ${expected} fehlt`);
    assert.doesNotMatch(JSON.stringify(versions), /u\s*n\s*v\s*e\s*r\s*ä\s*n\s*d\s*e\s*r\s*t/iu, entry.slug);
  }
});

test('Bauordnung führt zwei Änderungen desselben Tages in genau einer Folgefassung zusammen', async () => {
  const dates = ['2023-11-01', '2024-03-19', '2026-03-24'];
  const versions = await Promise.all(dates.map((date) =>
    readJson(`content/normen/saechsische-bauordnung/versions/${date}.json`)
  ));
  assert.deepEqual(versions.map((version) => version.validFrom), dates);
  const paragraph8 = flatten(versions.at(-1).body).find((block) => block.label === '§ 8');
  assert.match(JSON.stringify(paragraph8), /Schotter- und Kiesgärten/iu);

  const history = await readJson('content/normen/saechsische-bauordnung/history.json');
  const sameDayChanges = history.entries.filter((entry) =>
    entry.date === '2026-03-24' && entry.type === 'amendment'
  );
  assert.equal(sameDayChanges.length, 2);
  assert.deepEqual([...new Set(sameDayChanges.map((entry) => entry.affectingVersionId))], ['2026-03-24']);
});

test('Gemeindeordnung bewahrt Zwischenstand, gleichzeitige Änderungen und künftige Kreisreformfassung', async () => {
  const dates = ['2023-11-01', '2023-12-31', '2026-03-25', '2026-08-01'];
  const versions = await Promise.all(dates.map((date) =>
    readJson(`content/normen/saechsische-gemeindeordnung/versions/${date}.json`)
  ));
  assert.deepEqual(versions.map((version) => version.validFrom), dates);
  const marchBlocks = flatten(versions[2].body);
  assert.ok(marchBlocks.some((block) => block.label === '§ 71b'));
  assert.ok(marchBlocks.some((block) => block.label === '§ 71f'));
  assert.match(JSON.stringify(marchBlocks.find((block) => block.label === '§ 90')), /beherrschenden Einfluss/u);
  const augustBlocks = flatten(versions[3].body);
  assert.ok(augustBlocks.some((block) => block.label === '§ 71g'));
  assert.match(JSON.stringify(augustBlocks.find((block) => block.label === '§ 3')), /kreisfreie Städte/u);

  const history = await readJson('content/normen/saechsische-gemeindeordnung/history.json');
  const sameDayChanges = history.entries.filter((entry) =>
    entry.date === '2026-03-25' && entry.type === 'amendment'
  );
  assert.deepEqual(
    sameDayChanges.map((entry) => entry.relatedNorm),
    [
      'gesetz-uber-die-einfuhrung-einer-kommunalen-privatisierungsb-zue3jo',
      'gesetz-zur-einfuhrung-besonderer-regelungen-fur-die-bundesha-1fmrybb',
    ],
  );
  assert.deepEqual([...new Set(sameDayChanges.map((entry) => entry.affectingVersionId))], ['2026-03-25']);
});

test('Haushaltsordnung übernimmt nur den ausdrücklich bezeichneten Zwischenstand und § 112', async () => {
  const dates = ['2023-11-01', '2025-07-10', '2026-01-27'];
  const versions = await Promise.all(dates.map((date) =>
    readJson(`content/normen/saechsische-haushaltsordnung/versions/${date}.json`)
  ));
  assert.deepEqual(versions.map((version) => version.validFrom), dates);
  const paragraph112 = flatten(versions.at(-1).body).find((block) => block.label === '§ 112');
  assert.match(JSON.stringify(paragraph112), /die Landesbank an der Elbe/u);
  const meta = await readJson('content/normen/saechsische-haushaltsordnung/meta.json');
  assert.equal(meta.title, 'Haushaltsordnung des Ostdeutschen Freistaates');
  assert.equal(meta.abbr, 'LHO');
});

test('Archivgesetz bewahrt den Snapshot und löst dessen doppelte §-Kennzeichnung transparent auf', async () => {
  const config = await readJson('data/recht/consolidation-sources.json');
  const source = config.targets.archivgesetz;
  const bytes = await readFile(source.snapshot);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sourceSha256);
  const parsed = await readJson('data/recht/parsed/revosax/archivgesetz.json');
  assert.deepEqual(
    parsed.body.filter((block) => block.type === 'section').map((block) => block.label),
    ['Erster Abschnitt', 'Zweiter Abschnitt', 'Dritter Abschnitt', 'Vierter Abschnitt'],
  );
  assert.deepEqual(
    flatten(parsed.body).filter((block) => block.type === 'paragraph').slice(-3).map((block) => block.label),
    ['§ 17', '§ 18', '§ 17'],
  );
  const [meta, baseline] = await Promise.all([
    readJson('content/normen/archivgesetz/meta.json'),
    readJson('content/normen/archivgesetz/versions/2023-11-01.json'),
  ]);
  assert.equal(meta.editorialResolutions[0].status, 'resolved-source-conflict');
  assert.deepEqual(
    flatten(baseline.body).filter((block) => block.type === 'paragraph').slice(-3).map((block) => block.label),
    ['§ 17', '§ 18', '§ 19'],
  );
});

test('Patch-Ziele können gleich bezeichnete Absätze über ihre Elternvorschrift unterscheiden', () => {
  const state = {
    title: 'Testgesetz',
    body: [
      { type: 'paragraph', label: '§ 1', children: [{ type: 'subparagraph', label: '(2)', text: 'eins', children: [] }] },
      { type: 'paragraph', label: '§ 2', children: [{ type: 'subparagraph', label: '(2)', text: 'zwei', children: [] }] },
    ],
  };
  const recipe = {
    amendmentAct: 'test-aenderung',
    effectiveDate: '2026-01-02',
    operations: [{
      op: 'replaceText',
      target: { type: 'subparagraph', label: '(2)', parentType: 'paragraph', parentLabel: '§ 2' },
      expectedOld: 'zwei',
      expectedMatches: 1,
      value: 'geändert',
      source: 'Gesetze/Test.html',
      sourceProvision: 'Artikel 1',
      effectiveDate: '2026-01-02',
    }],
  };
  const result = applyPatchRecipe(state, recipe);
  assert.equal(result.body[0].children[0].text, 'eins');
  assert.equal(result.body[1].children[0].text, 'geändert');
});

test('REVOSax-Tabellenparser erhält leere Zellen und die Spaltenzahl', () => {
  const html = `<!doctype html><html><body>
    <div id="content"><div class="law_show">
      <h1>Tabellenverordnung</h1>
      <p>Vollzitat: Tabellenverordnung vom 1. November 2023 (SächsGVBl. S. 1)</p>
      <h2>Fassung vom 01.11.2023 bis 31.12.2023</h2>
      <article id="lesetext">
        <header><h3>Verordnung (TabVO)</h3><p>Vom 1. November 2023</p></header>
        <div class="sections"><section title="§ 1 Tabelle"><h4>§ 1 Tabelle</h4>
          <table><tr><th scope="col">A</th><th scope="col">B</th></tr>
          <tr><td></td><td>längerer Inhalt</td></tr></table>
        </section></div>
      </article>
    </div></div>
  </body></html>`;
  const parsed = parseRevosaxSnapshot(html);
  const table = flatten(parsed.body).find((block) => block.type === 'table');
  assert.equal(table.columns, 2);
  assert.equal(table.children[0].children[0].type, 'tableHeaderCell');
  assert.deepEqual(table.children.map((row) => row.children.map((cell) => cell.text)), [
    ['A', 'B'],
    ['', 'längerer Inhalt'],
  ]);
});

test('Konsolidierungsmanifest ist aktuell und trennt aufgelöste von blockierten Quellenkonflikten', async () => {
  const result = spawnSync(process.execPath, ['scripts/audit-consolidation.mjs', '--check'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const manifest = await readJson('data/recht/consolidation-manifest.json');
  assert.equal(manifest.targets.find((target) => target.canonicalSlug === 'ostdeutsches-feiertagsgesetz')?.status, 'complete');
  assert.equal(manifest.targets.find((target) => target.canonicalSlug === 'wappenverordnung')?.status, 'complete');
  assert.equal(manifest.targets.find((target) => target.canonicalSlug === 'archivgesetz')?.status, 'complete');
  assert.equal(manifest.targets.find((target) => target.canonicalSlug === 'archivgesetz')?.editorialResolutions[0].status, 'resolved-source-conflict');
  assert.equal(manifest.targets.find((target) => target.canonicalSlug === 'ostdeutsches-polizeivollzugsdienstgesetz')?.status, 'complete');
  const district = manifest.targets.find((target) => target.canonicalSlug === 'ostdeutsche-bezirksordnung');
  assert.equal(district?.status, 'complete');
  assert.deepEqual(district?.effectiveDates, ['2026-08-01']);
  assert.equal(manifest.targets.find((target) => target.canonicalSlug === 'saechsische-landkreisordnung')?.status, 'complete');
  assert.equal(manifest.counts.blockedSourceConflicts, 0);
});
