import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { siteConfig } from '../src/config/site.ts';
import { loadAllNorms } from '../src/lib/norms/loader.ts';
import { getApplicableVersion } from '../src/lib/norms/versions.ts';
import {
  loadCurrentGovernmentMembers,
  loadCurrentGovernment,
  loadFreestatePages,
  loadTopics,
} from '../src/lib/portal/content.ts';
import { PORTAL_REFERENCE_DATE } from '../src/lib/portal/dates.ts';
import { buildPortalSearchEntries } from '../src/lib/portal/search.ts';

const referenceDate = '2026-08-16';
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

test('der öffentliche Gegenwartsstand verwendet den 16. August 2026', async () => {
  assert.equal(PORTAL_REFERENCE_DATE, referenceDate);
  const currentGovernment = await loadCurrentGovernment();
  assert.equal(currentGovernment.coalition, 'Volksfront und Bündnis Demokratie Europa (DEMOS)');
  assert.ok(!currentGovernment.coalition.includes('Das Bündnis'));
  assert.ok(!currentGovernment.coalition.includes('DEMOS an der Elbe'));
});

test('vierzehn Bezirke sind aktuell und die aufgehobenen Flächenbezirke historisch', () => {
  const currentState = readJson<{
    sections: Array<{
      id: string;
      currentDistrictIds?: string[];
      historicalDistrictIds?: string[];
      futureDistrictIds?: string[];
    }>;
  }>('knowledge/current-state.json');
  const territories = readJson<{
    territories: Array<{ id: string; effectiveStatus?: string; validTo?: string | null }>;
  }>('knowledge/entities/territories.json');
  const territoryState = currentState.sections.find((entry) => entry.id === 'state-current-territory');

  assert.equal(territoryState?.currentDistrictIds?.length, 14);
  assert.equal(territoryState?.historicalDistrictIds?.length, 7);
  assert.equal(territoryState?.futureDistrictIds, undefined);
  assert.ok(territoryState?.currentDistrictIds?.every((id) =>
    territories.territories.find((entry) => entry.id === id)?.effectiveStatus === 'current'));
  assert.ok(territoryState?.historicalDistrictIds?.every((id) => {
    const territory = territories.territories.find((entry) => entry.id === id);
    return territory?.effectiveStatus === 'historical' && territory.validTo === '2026-07-31';
  }));
});

test('Kreisreform ist in Kraft, während organisatorische Übergangsarbeit weiterläuft', () => {
  const projects = readJson<{ projects: Array<{ id: string; projectStage: string }> }>('knowledge/projects.json');
  const proceedings = readJson<{ proceedings: Array<{ id: string; stage: string; nextAction?: string }> }>('knowledge/proceedings.json');
  assert.equal(projects.projects.find((entry) => entry.id === 'project-kreisreform')?.projectStage, 'in-implementation');
  const transition = proceedings.proceedings.find((entry) => entry.id === 'proceeding-kreisreform-transition');
  assert.equal(transition?.stage, 'implementation');
  assert.match(transition?.nextAction ?? '', /Rechtsnachfolge/u);
});

test('am 1. August beginnende Fassungen sind am Stichtag im Rechtsportal anwendbar', async () => {
  const norms = new Map((await loadAllNorms()).map((entry) => [entry.meta.slug, entry]));
  for (const slug of [
    'ostdeutsche-bezirksordnung',
    'saechsische-gemeindeordnung',
    'ostdeutsches-polizeivollzugsdienstgesetz',
  ]) {
    const norm = norms.get(slug);
    assert.ok(norm, slug);
    assert.equal(getApplicableVersion(norm, referenceDate)?.validFrom, '2026-08-01', slug);
  }
  assert.equal(norms.get('gesetz-zur-neuordnung-des-ostdeutschen-schulsystems')?.meta.status, 'in-force');
});

test('Berlin-Seite ist strukturiert, verlinkt und über die Suche auffindbar', async () => {
  const pages = await loadFreestatePages();
  const berlin = pages.find((entry) => entry.slug === 'berlin');
  assert.ok(berlin);
  assert.match(berlin.body.join(' '), /Bezirksversammlungen/u);
  assert.match(berlin.body.join(' '), /Polizeidirektion Berlin/u);
  const searchEntries = await buildPortalSearchEntries();
  assert.ok(searchEntries.some((entry) => entry.title === 'Berlin im Freistaat' && entry.url === '/freistaat/berlin/'));

  const routes = [
    readFileSync('src/pages/freistaat/[slug].astro', 'utf8'),
    readFileSync('src/pages/themen/[slug].astro', 'utf8'),
    readFileSync('src/pages/kreisreform/index.astro', 'utf8'),
  ].join('\n');
  assert.match(routes, /getFreestatePageUrl\('berlin'\)/u);
});

test('Grenzpolizei trennt geltendes Recht, geschlossenes Verwaltungsabkommen und praktische Umsetzung', async () => {
  const topic = (await loadTopics()).find((entry) => entry.slug === 'demokratie-und-sicherheit');
  assert.ok(topic);
  const implemented = topic.umgesetzt.join(' ');
  const nextSteps = topic.naechsteSchritte.join(' ');
  const faq = topic.faq.map((entry) => `${entry.question} ${entry.answer}`).join(' ');
  assert.match(implemented, /gesetzlich als Landesbehörde errichtet/u);
  assert.match(implemented, /organisatorische Aufbau/u);
  assert.doesNotMatch(`${implemented} ${nextSteps} ${faq}`, /in Ausarbeitung|nicht unterzeichnet|nicht wirksam/u);
  assert.match(implemented, /Verwaltungsabkommen/u);
  assert.match(nextSteps, /System- und Registerzugänge/u);
  assert.match(faq, /28\. Juli 2026/u);
  assert.match(faq, /29\. Juli 2026/u);
  assert.match(faq, /keinen ausdrücklichen Inkrafttretenssatz/u);
  assert.ok(topic.rechtsgrundlagen.some((entry) => entry.normSlug === 'kasernierte-grenzpolizei-errichtungsgesetz'));
  assert.ok(topic.rechtsgrundlagen.some((entry) => entry.normSlug === 'kasernierte-grenzpolizei-gesetz'));
  assert.ok(topic.rechtsgrundlagen.some((entry) => entry.normSlug === 'verwaltungsabkommen-kasernierte-grenzpolizei'));
  assert.ok(topic.rechtsgrundlagen.some((entry) => entry.normSlug === 'ostdeutsches-polizeivollzugsdienstgesetz'));
});

test('Verträge sind in Kraft und die Volkskammerwahl hat kein erfundenes Tagesdatum', async () => {
  const norms = new Map((await loadAllNorms()).map((entry) => [entry.meta.slug, entry.meta]));
  for (const slug of [
    'staatsvertrag-zur-anderung-des-staatsvertrages-uber-den-nord-122dpnt',
    'zwischen-dem-freistaat-ostdeutschland-und-der-republik-polen-1p4h4x1',
    'zwischen-dem-freistaat-ostdeutschland-und-der-tschechischen-nmd9np',
  ]) {
    assert.equal(norms.get(slug)?.status, 'in-force', slug);
    assert.equal(norms.get(slug)?.effectiveDate, '2026-03-24', slug);
  }

  const publicState = [
    JSON.stringify(siteConfig),
    JSON.stringify(await loadCurrentGovernmentMembers()),
    JSON.stringify(await loadTopics()),
  ].join('\n');
  assert.doesNotMatch(publicState, /(?:Volkskammerwahl|Wahl zur achten Volkskammer)[^}]{0,240}2026-08-(?:30|31)/u);
  assert.doesNotMatch(publicState, /(?:Volkskammerwahl|Wahl zur achten Volkskammer)[^}]{0,240}(?:30|31)\. August 2026/u);
});
