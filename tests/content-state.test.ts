import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAllNorms } from '../src/lib/norms/loader.ts';
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
  assert.ok(procedures.every((entry) => !['beschlossen', 'verkuendet', 'in-kraft'].includes(entry.stage)));

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
});

test('vollständige Normzitate behalten Normart und Dokumentdatum', async () => {
  const norms = await loadAllNorms();
  const familyLoan = norms.find((entry) => entry.meta.slug === 'forderrichtlinie-des-staatsministeriums-fur-soziale-und-gesu-17lqyb5');
  assert.equal(
    familyLoan?.meta.initialCitation,
    'Förderrichtlinie vom 6. März 2026 (StAnzO. 2026 Nr. 4)',
  );
});
