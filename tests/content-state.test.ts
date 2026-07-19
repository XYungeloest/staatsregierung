import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAllNorms } from '../src/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '../src/lib/norms/publications.ts';
import { loadLegislativeProcedures } from '../src/lib/portal/legislation.ts';
import {
  loadCurrentGovernmentMembers,
  loadEvents,
  loadMinistries,
} from '../src/lib/portal/content.ts';

const cutoff = '2026-07-19';

test('die zwölf Verfahren bleiben am Stichtag bei der angesetzten Beratung', async () => {
  const procedures = await loadLegislativeProcedures();
  assert.equal(procedures.length, 12);
  assert.equal(new Set(procedures.map((entry) => entry.documentNumber)).size, 12);
  assert.ok(procedures.every((entry) => entry.confirmedAsOf === cutoff));
  assert.ok(procedures.every((entry) => entry.nextScheduledReading.date === '2026-07-20'));
  assert.ok(procedures.every((entry) => ['erste-lesung-angesetzt', 'zweite-lesung-angesetzt'].includes(entry.stage)));
  assert.ok(procedures.every((entry) => entry.sources.filter((source) => source.kind === 'tagesordnung').length === 1));
  assert.ok(procedures.every((entry) => entry.sources
    .filter((source) => source.kind === 'tagesordnung')
    .every((source) => source.availability === 'missing')));
  assert.ok(procedures.every((entry) => entry.sources
    .filter((source) => source.localSource)
    .every((source) => source.availability === 'local')));

  const recommendations = procedures.filter((entry) => entry.recommendation);
  assert.equal(recommendations.length, 5);
  assert.ok(recommendations.every((entry) => entry.stage === 'zweite-lesung-angesetzt'));
  assert.equal(procedures.filter((entry) => entry.stage === 'erste-lesung-angesetzt').length, 7);
});

test('der Plenartermin verweist auf alle zwölf Verfahren', async () => {
  const event = (await loadEvents()).find((entry) => entry.slug === 'dritte-plenarsitzung-7-landtag');
  assert.ok(event);
  assert.equal(event.date, '2026-07-20');
  assert.equal(event.relatedLegislationSlugs?.length, 12);
  const procedureSlugs = new Set((await loadLegislativeProcedures()).map((entry) => entry.slug));
  assert.deepEqual(new Set(event.relatedLegislationSlugs), procedureSlugs);
});

test('das Kabinett besitzt elf aktive Staatsminister und eindeutige Ressortleitungen', async () => {
  const [members, ministries] = await Promise.all([
    loadCurrentGovernmentMembers(),
    loadMinistries(),
  ]);
  const stateMinisters = members.filter((entry) => entry.slug !== 'emma-mueller');
  assert.equal(stateMinisters.length, 11);
  assert.ok(!members.some((entry) => entry.slug === 'mia-wollrath'));
  assert.equal(members.find((entry) => entry.slug === 'emma-mueller')?.amt, 'Chefin der Staatskanzlei');

  const leaders = new Map(ministries.map((entry) => [entry.slug, entry.leitung]));
  assert.match(leaders.get('inneres-bau-und-kommunale-angelegenheiten') ?? '', /Volker Bagdadi/u);
  assert.match(leaders.get('umwelt-energie-und-klimaschutz') ?? '', /Yannik Schmäle/u);
  assert.match(leaders.get('grenzschutz-faschismusbekaempfung-und-bewaffnete-organe') ?? '', /Thomas Henry Barlow/u);
});

test('befristete und künftig wirksame Normen werden zeitlich korrekt eingeordnet', async () => {
  const norms = new Map((await loadAllNorms()).map((entry) => [entry.meta.slug, entry.meta]));
  const earthquake = norms.get('verordnung-der-staatsregierung-zur-bewaltigung-der-folgen-des-erdbebens-im-raum-rosenheim-und-zum-schutz-vor-n');
  const worldCup = norms.get('verordnung-der-staatsregierung-des-freistaates-ostdeutschland-uber-den-larmschutz-bei-offentlichen-fernsehdarb');
  const schedules = norms.get('verwaltungsvorschrift-des-staatsministeriums-fur-volksbildung-und-wissenschaft-uber-lehrplane-und-stundentafel');
  assert.equal(earthquake?.status, 'repealed');
  assert.equal(earthquake?.expiryDate, '2026-05-27');
  assert.equal(worldCup?.status, 'in-force');
  assert.equal(worldCup?.expiryDate, '2026-07-31');
  assert.equal(schedules?.status, 'future-effective');
  assert.equal(schedules?.effectiveDate, '2026-08-01');
  const schoolSystem = norms.get('gesetz-zur-neuordnung-des-ostdeutschen-schulsystems');
  assert.equal(schoolSystem?.status, 'future-effective');
  assert.equal(schoolSystem?.effectiveDate, '2026-08-01');

  const polishAgreement = norms.get('zwischen-dem-freistaat-ostdeutschland-und-der-republik-polen-1p4h4x1');
  assert.equal(polishAgreement?.status, 'pending-effective');
  assert.equal(polishAgreement?.effectiveDate, undefined);
});

test('vollständige Normzitate behalten Normart und Dokumentdatum', async () => {
  const norms = await loadAllNorms();
  const familyLoan = norms.find((entry) => entry.meta.slug === 'forderrichtlinie-des-staatsministeriums-fur-soziale-und-gesu-17lqyb5');
  assert.equal(
    familyLoan?.meta.initialCitation,
    'Förderrichtlinie vom 6. März 2026 (StAnzO. 2026 Nr. 4)',
  );
});

test('Verkündungen unterscheiden versionierte und nicht mitversionierte Quellen ehrlich', async () => {
  const publications = await loadAllVerkuendungen();
  assert.equal(publications.length, 81);
  assert.ok(publications.every((publication) => !publication.sourceFiles?.length));
  assert.ok(publications.every((publication) => publication.sourceReferences?.some(
    (source) => source.kind === 'original' && source.availability === 'not-versioned',
  )));
  assert.ok(publications.flatMap((publication) => publication.entries).every(
    (entry) => !/^(?:OGVBl|StAnzO|OABl|OVertrBl)\./u.test(entry.citation),
  ));
});

test('Einführungsgesetze und eingeführte Stammnormen bleiben getrennt und wechselseitig verknüpft', async () => {
  const norms = new Map((await loadAllNorms()).map((entry) => [entry.meta.slug, entry.meta]));
  const outer = norms.get('gesetz-uber-den-kulturpass-fur-junge-erwachsene-im-freistaat-ostdeutschland');
  const stem = norms.get('ostdeutsches-kulturpassgesetz');
  assert.equal(outer?.enactedNorm, stem?.slug);
  assert.equal(stem?.enactingNorm, outer?.slug);
  assert.notEqual(outer?.summary, stem?.summary);
});
