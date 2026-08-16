import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const pagePath = 'src/pages/themen/bildung-und-schule/schulsystem/index.astro';
const dataPath = 'src/data/school-system.ts';
const chartPath = 'src/components/portal/SchoolSystemChart.astro';
const svgPath = 'public/images/ui/schulsystem.svg';
const siteConfigPath = 'src/config/site.ts';

test('die Schulsystemseite beschreibt die einheitliche POS und die EOS rechtsstandsgerecht', async () => {
  const [page, data, chart, svg] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(dataPath, 'utf8'),
    readFile(chartPath, 'utf8'),
    readFile(svgPath, 'utf8'),
  ]);
  const publicContent = `${page}\n${data}\n${chart}\n${svg}`;

  for (const text of [
    'Klassenstufen 1 bis 10',
    'Übergang von Klasse 4 nach 5 ist deshalb kein Schulartwechsel',
    'Jahrgangsstufen 11 und 12',
    'Klasse 10 als Brücke zur EOS',
    'Abschluss der Polytechnischen Oberschule nach Klassenstufe 9',
    'Abschluss der Polytechnischen Oberschule nach Klassenstufe 10',
    'wissenschaftlich-praktische Arbeit',
    'Ethik ist Pflichtfach',
  ]) {
    assert.match(publicContent, new RegExp(text, 'u'), `Inhalt fehlt: ${text}`);
  }

  assert.doesNotMatch(publicContent, /FOS\+|DUBAS|Religion oder Ethik|Note 6/u);
  assert.doesNotMatch(data, /id: '(?:grundschule|gemeinschaftsschule|gymnasium)-card'/u);
});

test('die Seite trennt geltende Struktur und bevorstehenden schulordnungsrechtlichen Fassungswechsel', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /Schulstruktur seit 1\. August 2026/u);
  assert.match(page, /treten überwiegend am 1\. September 2026\s+in Kraft/u);
  assert.match(page, /Bis zum 31\. August gelten die jeweiligen Übergangsbestimmungen/u);
});

test('alle verlinkten aktuellen Schulrechtsnormen sind vorhanden', async () => {
  const page = await readFile(pagePath, 'utf8');
  const slugs = [...page.matchAll(/getNormUrl\('([^']+)'\)/gu)].map((match) => match[1]);

  assert.ok(slugs.length >= 8, 'zu wenige aktuelle Rechtsgrundlagen verknüpft');
  assert.equal(new Set(slugs).size, slugs.length, 'Rechtsgrundlage mehrfach verknüpft');
  for (const slug of slugs) {
    await access(`content/normen/${slug}/meta.json`);
  }
});

test('das Schulsystem ist über die zentrale Hauptnavigation erreichbar', async () => {
  const siteConfig = await readFile(siteConfigPath, 'utf8');

  assert.match(siteConfig, /\{ label: 'Schulsystem', pathKey: 'schoolSystem' \}/u);
  assert.match(siteConfig, /schoolSystem: '\/themen\/bildung-und-schule\/schulsystem\/'/u);
});
