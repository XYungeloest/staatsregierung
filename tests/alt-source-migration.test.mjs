import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

function flatten(blocks, result = []) {
  for (const block of blocks ?? []) {
    result.push(block);
    flatten(block.children, result);
  }
  return result;
}

test('OGVBl. I/2025 enthält die sieben belegten Einträge und korrigierten Fundstellen', async () => {
  const issue = await readJson('content/verkuendungen/ogvbl-2025-01-07.json');
  assert.equal(issue.entries.length, 7);
  assert.equal(issue.originalIssueDesignation, 'Ausgabe 1 · GVBl Nr. I/25');
  assert.equal(issue.alternativeIssueDesignation, 'OGVBl. 2025 Nr. 1–7');
  assert.doesNotMatch(JSON.stringify(issue), /zur zur/iu);

  const districts = issue.entries.find((entry) => entry.normSlug === 'ostdeutsches-bezirkseinfuehrungsgesetz');
  assert.equal(districts?.pages, '7-14');
  assert.match(districts?.citation ?? '', /S\. 7–14/u);

  const constitution = issue.entries.find((entry) => entry.normSlug === 'gesetz-zur-aenderung-der-landesverfassung-2025');
  assert.equal(constitution?.pages, '15');
  assert.match(constitution?.citation ?? '', /S\. 15/u);
});

test('OGVBl. II/2024 bleibt eine Ausgabe und verknüpft alle vier Einzelakte', async () => {
  const issue = await readJson('content/verkuendungen/ogvbl-2024-ii.json');
  assert.equal(issue.entries.length, 4);
  assert.equal(issue.originalIssueDesignation, 'OGVBl Nr. II/24');
  assert.ok(issue.entries.every((entry) => entry.normSlug && entry.versionId));
  assert.notEqual(issue.originalIssueDesignation, 'Ausgabe X');
  assert.equal(issue.entries.at(-1)?.pages, '5-32');
});

test('die Ursprungsverfassung und der Stand von 2025 sind vollständige, getrennte Fassungen', async () => {
  const [meta, history, original, amended] = await Promise.all([
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/meta.json'),
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/history.json'),
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/versions/2024-10-15.json'),
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/versions/2025-03-12.json'),
  ]);
  assert.equal(history.initialVersionId, '2024-10-15');
  assert.equal(meta.enactingNorm, 'gesetz-zur-einsetzung-einer-neuen-landesverfassung');

  for (const version of [original, amended]) {
    const articles = flatten(version.body).filter((block) => block.type === 'article');
    assert.equal(articles.length, 122);
    assert.equal(articles[0].label, 'Artikel 1');
    assert.equal(articles.at(-1).label, 'Artikel 122');
  }

  const original114 = flatten(original.body).find((block) => block.label === 'Artikel 114');
  assert.equal(original114?.title, 'Widerstandsrecht');
  assert.match(JSON.stringify(original114), /Recht zum Widerstand/u);

  const amended114 = flatten(amended.body).find((block) => block.label === 'Artikel 114');
  assert.equal(amended114?.title, 'Demokratiegebot');
  assert.deepEqual(
    amended114?.children.map((block) => block.label),
    ['(1)', '(2)', '(3)'],
  );
});

test('Verfassungsänderung von 2025 ist mit Änderungsgesetz, Folgefassung und Ausgabe verknüpft', async () => {
  const [constitution, amendment, history, issue] = await Promise.all([
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/meta.json'),
    readJson('content/normen/gesetz-zur-aenderung-der-landesverfassung-2025/meta.json'),
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/history.json'),
    readJson('content/verkuendungen/ogvbl-2025-01-07.json'),
  ]);
  assert.ok(constitution.affectedByNorms.includes(amendment.slug));
  assert.deepEqual(amendment.affectedNorms, [constitution.slug]);
  assert.equal(
    history.entries.find((entry) => entry.relatedNorm === amendment.slug)?.affectingVersionId,
    '2025-03-12',
  );
  assert.equal(
    issue.entries.find((entry) => entry.normSlug === amendment.slug)?.versionId,
    '2025-03-06',
  );
});

test('Hoheitszeichenänderung erhält eine vollständige Folgefassung mit dokumentierter Zielankerauslegung', async () => {
  const [version, history, amendment] = await Promise.all([
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/versions/2026-03-24.json'),
    readJson('content/normen/staatsverfassung-des-freistaates-ostdeutschland/history.json'),
    readJson('content/normen/gesetz-zur-einfuhrung-eines-hoheitszeichengesetzes/versions/2026-03-23.json'),
  ]);
  const article2 = flatten(version.body).find((block) => block.label === 'Artikel 2');
  const paragraph2 = article2?.children.find((block) => block.label === '(2)');
  assert.equal(paragraph2?.text, 'Die Landesfarben sind Blau, Weiß und Grün.');
  assert.match(version.sourceNotes?.[0]?.text ?? '', /vor dem Wort „Weiß“/u);
  assert.equal(
    history.entries.find((entry) => entry.relatedNorm === 'gesetz-zur-einfuhrung-eines-hoheitszeichengesetzes')?.affectingVersionId,
    '2026-03-24',
  );
  assert.match(JSON.stringify(amendment.body), /nach dem Wort ,,nach” die Angabe ,,Blau, “/u);
});

test('Bezirksordnung besitzt die belegte Ursprungsfassung und die vollständige Ablösungsfassung', async () => {
  const [meta, history, original, replacement] = await Promise.all([
    readJson('content/normen/ostdeutsche-bezirksordnung/meta.json'),
    readJson('content/normen/ostdeutsche-bezirksordnung/history.json'),
    readJson('content/normen/ostdeutsche-bezirksordnung/versions/2025-03-12.json'),
    readJson('content/normen/ostdeutsche-bezirksordnung/versions/2026-08-01.json'),
  ]);
  assert.equal(meta.enactingNorm, 'ostdeutsches-bezirkseinfuehrungsgesetz');
  assert.equal(history.initialVersionId, '2025-03-12');
  assert.equal(original.validFrom, '2025-03-12');
  assert.equal(original.validTo, '2026-07-31');
  assert.equal(replacement.validFrom, '2026-08-01');
  assert.equal(replacement.validTo, null);
  assert.deepEqual(
    flatten(original.body).filter((block) => block.type === 'paragraph').map((block) => block.label),
    Array.from({ length: 29 }, (_, index) => `§ ${index + 1}`),
  );
  assert.match(replacement.changeNote, /Vollständige Ablösung/u);
  assert.equal(
    history.entries.find((entry) => entry.relatedNorm === 'kreis-und-bezirksneuordnungsgesetz')?.affectingVersionId,
    '2026-08-01',
  );
});

test('Sportänderung gilt ab 1. August für die neue Bezirksordnung', async () => {
  const [history, manifest] = await Promise.all([
    readJson('content/normen/ostdeutsche-bezirksordnung/history.json'),
    readJson('data/recht/consolidation-manifest.json'),
  ]);
  const version = await readJson('content/normen/ostdeutsche-bezirksordnung/versions/2026-08-01.json');
  const paragraph13 = flatten(version.body).find((block) => block.label === '§ 13');
  const paragraph13a = flatten(version.body).find((block) => block.label === '§ 13a');
  assert.deepEqual(
    paragraph13?.children.filter((block) => block.type === 'item').map((block) => block.label),
    Array.from({ length: 11 }, (_, index) => `${index + 1}.`),
  );
  assert.match(
    paragraph13?.children.find((block) => block.label === '10.')?.text ?? '',
    /Sportentwicklung und Sportkoordination/u,
  );
  assert.deepEqual(paragraph13a?.children.map((block) => block.label), ['(1)', '(2)']);

  const sportEntry = history.entries.find((entry) => entry.relatedNorm === 'sportneuordnungsgesetz');
  assert.equal(sportEntry?.type, 'amendment');
  assert.equal(sportEntry?.date, '2026-08-01');
  assert.equal(sportEntry?.affectingVersionId, '2026-08-01');
  const target = manifest.targets.find((entry) => entry.canonicalSlug === 'ostdeutsche-bezirksordnung');
  assert.equal(target?.status, 'complete');
  assert.deepEqual(target?.effectiveDates, ['2026-08-01']);
  assert.equal(
    target?.amendmentActs.find((act) => act.slug === 'sportneuordnungsgesetz')?.targetEffectiveDate,
    '2026-08-01',
  );
});

test('Landkreis-, Archiv- und Polizeikonflikte bleiben quellengebunden blockiert', async () => {
  const [manifest, countyBaseline] = await Promise.all([
    readJson('data/recht/consolidation-manifest.json'),
    readJson('data/recht/parsed/revosax/saechsische-landkreisordnung.json'),
  ]);
  const bySlug = new Map(manifest.targets.map((entry) => [entry.canonicalSlug, entry]));
  assert.equal(bySlug.get('saechsische-landkreisordnung')?.status, 'blocked-source-conflict');
  assert.match(bySlug.get('saechsische-landkreisordnung')?.problems.join(' ') ?? '', /§ 75/u);
  assert.equal(flatten(countyBaseline.body).some((block) => block.label === '§ 75'), false);
  assert.equal(bySlug.get('archivgesetz')?.status, 'blocked-source-conflict');
  assert.equal(bySlug.get('saechsisches-polizeigesetz')?.status, 'blocked-source-conflict');
  assert.notEqual(bySlug.get('ostdeutsche-bezirksordnung')?.status, 'blocked-source-conflict');
});

test('alle drei neuen Binärquellen stimmen mit dem versionierten Quelleninventar überein', async () => {
  const inventory = await readJson('data/recht/alt-source-inventory.json');
  for (const source of inventory.sources.filter((entry) =>
    ['ogvbl-ii-2024', 'ogvbl-i-2025', 'staatsverfassung-docx'].includes(entry.id))) {
    const bytes = await readFile(source.localSource);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(source.verifiedAt, '2026-07-23');
  }
});

test('wiederholte Altquellen-Migrationen hinterlassen keine doppelten Quellenreferenzen', async () => {
  for (const path of [
    'content/normen/staatsverfassung-des-freistaates-ostdeutschland/meta.json',
    'content/normen/staatsverfassung-des-freistaates-ostdeutschland/versions/2026-07-21.json',
    'content/normen/ostdeutsche-bezirksordnung/meta.json',
  ]) {
    const record = await readJson(path);
    const references = record.sourceReferences ?? [];
    const keys = references.map((reference) => JSON.stringify([
      reference.kind ?? null,
      reference.localSource ?? null,
      reference.url ?? null,
      reference.pageRange ?? null,
      reference.label ?? null,
    ]));
    assert.equal(new Set(keys).size, keys.length, `${path} enthält doppelte Quellenreferenzen`);
  }
});

test('die elf Alt-Dokumente enthalten keine Seiten-, Bild- oder Signaturartefakte im Normkörper', async () => {
  const issues = await Promise.all([
    readJson('content/verkuendungen/ogvbl-2024-ii.json'),
    readJson('content/verkuendungen/ogvbl-2025-01-07.json'),
  ]);
  assert.equal(issues.flatMap((issue) => issue.entries).length, 11);
  for (const entry of issues.flatMap((issue) => issue.entries)) {
    const version = await readJson(`content/normen/${entry.normSlug}/versions/${entry.versionId}.json`);
    const text = JSON.stringify(version.body);
    assert.doesNotMatch(text, /data:image|;base64,|Inhaltsverzeichnis|Ausgabe X|Seite \d+|D e r M I N I S T E R/iu);
  }
});

test('befristete Dienstanordnungen behalten Wortlaut und belegtes Geltungsende', async () => {
  const [refugee, silvester, silvesterVersion] = await Promise.all([
    readJson('content/normen/dienstanordnung-schutz-gefluechtetenunterkuenfte-2024/meta.json'),
    readJson('content/normen/dienstanordnung-silvesternacht-2024/meta.json'),
    readJson('content/normen/dienstanordnung-silvesternacht-2024/versions/2024-12-31.json'),
  ]);
  assert.equal(refugee.expiryDate, '2025-01-20');
  assert.equal(silvester.expiryDate, '2025-01-01');
  assert.match(JSON.stringify(silvesterVersion.body), /01\.01\.2025 um 08:00 Uhr in Kraft/u);
  assert.match(silvester.dateNote, /Außerkrafttretenszeitpunkt/u);
});
