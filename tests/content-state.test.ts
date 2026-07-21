import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAllNorms } from '../src/lib/norms/loader.ts';
import { loadAllVerkuendungen } from '../src/lib/norms/publications.ts';
import { loadLegislativeProcedures } from '../src/lib/portal/legislation.ts';
import { siteConfig } from '../src/config/site.ts';
import { PORTAL_REFERENCE_DATE } from '../src/lib/portal/dates.ts';
import { buildPortalSearchEntries } from '../src/lib/portal/search.ts';
import {
  loadCurrentGovernmentMembers,
  loadEvents,
  loadMinistries,
} from '../src/lib/portal/content.ts';

const cutoff = '2026-07-21';

test('Stichtag und aktuelle Staatsorganisation sind zentral auf den 21. Juli gesetzt', async () => {
  assert.equal(PORTAL_REFERENCE_DATE, cutoff);
  assert.equal(siteConfig.currentGovernment.legislature, '7. Volkskammer');
  assert.equal(siteConfig.currentGovernment.cabinetName, 'Erster Staatsrat');
  assert.match(siteConfig.authorityName, /Staatsrat/u);
  const searchEntries = await buildPortalSearchEntries();
  assert.ok(searchEntries.filter((entry) => entry.type === 'government' && !['Thomas Henry Barlow', 'Mia Wollrath'].includes(entry.title)).every((entry) => entry.typeLabel === 'Staatsrat'));
  assert.ok(searchEntries.some((entry) => entry.title === 'Yannik Schmäle' && /Staats- und Grenzsicherheit/u.test(entry.description)));
  assert.equal(searchEntries.find((entry) => entry.title === 'Thomas Henry Barlow')?.typeLabel, 'Regierungsarchiv');
});

test('die zwölf Verfahren sind durch die lokalen Verkündungen belegt und in Kraft', async () => {
  const procedures = await loadLegislativeProcedures();
  assert.equal(procedures.length, 12);
  assert.equal(new Set(procedures.map((entry) => entry.documentNumber)).size, 12);
  assert.ok(procedures.every((entry) => entry.confirmedAsOf === cutoff));
  assert.ok(procedures.every((entry) => entry.nextScheduledReading === undefined));
  assert.ok(procedures.every((entry) => entry.stage === 'in-kraft'));
  assert.ok(procedures.every((entry) => entry.decidedOn === '2026-07-20'));
  assert.ok(procedures.every((entry) => entry.promulgatedOn === '2026-07-20'));
  assert.ok(procedures.every((entry) => entry.sources.filter((source) => source.kind === 'verkuendung').length === 1));
  assert.ok(procedures.every((entry) => entry.sources
    .filter((source) => source.localSource)
    .every((source) => source.availability === 'local')));

  const recommendations = procedures.filter((entry) => entry.recommendation);
  assert.equal(recommendations.length, 5);
  assert.ok(recommendations.every((entry) => entry.stage === 'in-kraft'));
});

test('der Plenartermin verweist auf alle zwölf Verfahren', async () => {
  const event = (await loadEvents()).find((entry) => entry.slug === 'dritte-plenarsitzung-7-landtag');
  assert.ok(event);
  assert.equal(event.date, '2026-07-20');
  assert.equal(event.relatedLegislationSlugs?.length, 12);
  const procedureSlugs = new Set((await loadLegislativeProcedures()).map((entry) => entry.slug));
  assert.deepEqual(new Set(event.relatedLegislationSlugs), procedureSlugs);
});

test('der erste Staatsrat besitzt zehn aktive Mitglieder und eindeutige Staatssekretariatsleitungen', async () => {
  const [members, ministries] = await Promise.all([
    loadCurrentGovernmentMembers(),
    loadMinistries(),
  ]);
  const stateCouncilMembers = members.filter((entry) => entry.currentOffices.some((office) => /Staatsrat|Staatsrätin|Staatspräsident/u.test(office.title)));
  assert.equal(stateCouncilMembers.length, 10);
  assert.ok(!members.some((entry) => entry.slug === 'mia-wollrath'));
  assert.ok(!members.some((entry) => entry.slug === 'thomas-henry-barlow'));
  assert.equal(members.find((entry) => entry.slug === 'emma-mueller')?.amt, 'Chefin der Staatskanzlei');

  const leaders = new Map(ministries.map((entry) => [entry.slug, entry.leitung]));
  assert.match(leaders.get('inneres-bau-und-kommunale-angelegenheiten') ?? '', /Volker Bagdadi/u);
  assert.match(leaders.get('umwelt-energie-und-klimaschutz') ?? '', /Yannik Schmäle/u);
  assert.match(leaders.get('grenzschutz-faschismusbekaempfung-und-bewaffnete-organe') ?? '', /Yannik Schmäle/u);
  const schmaele = members.find((entry) => entry.slug === 'yannik-schmaele');
  assert.equal(schmaele?.currentOffices.length, 2);
  assert.ok(schmaele?.currentOffices.every((office) => office.ministry?.startsWith('Staatssekretariat')));
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
  assert.equal(publications.length, 94);
  assert.ok(publications.every((publication) => !publication.sourceFiles?.length));
  const newPublications = publications.filter((publication) => Number(publication.issue) >= 46 && Number(publication.issue) <= 58 && publication.year === 2026);
  assert.equal(newPublications.length, 13);
  assert.ok(newPublications.every((publication) => publication.sourceReferences?.some(
    (source) => source.kind === 'transcription' && source.availability === 'versioned' && source.localSource?.endsWith('.md'),
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

test('Staatsreform, Verfassung und Verkündungen sind zum 21. Juli verknüpft', async () => {
  const [norms, publications] = await Promise.all([loadAllNorms(), loadAllVerkuendungen()]);
  const normMap = new Map(norms.map((entry) => [entry.meta.slug, entry]));
  const constitution = normMap.get('staatsverfassung-des-freistaates-ostdeutschland');
  assert.ok(constitution);
  assert.equal(constitution.meta.status, 'in-force');
  assert.match(JSON.stringify(constitution.versions[0].body), /Siebte Volkskammer ist der siebte Landtag/u);
  for (const issue of [53, 54, 55, 56]) {
    const publication = publications.find((entry) => entry.slug === `ogvbl-2026-${issue}`);
    assert.ok(publication);
    assert.equal(publication.date, '2026-07-20');
    assert.ok(publication.entries.every((entry) => entry.normSlug && entry.versionId));
  }
  const sero = normMap.get('sero-verordnung');
  assert.equal(sero?.meta.documentDate, '2026-07-20');
  assert.equal(sero?.meta.publicationDate, '2026-07-21');
  assert.equal(sero?.meta.effectiveDate, '2026-07-21');
});
