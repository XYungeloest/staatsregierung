import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const persons = readJson('knowledge/entities/persons.json').persons;
const timeline = readJson('knowledge/timeline.json').events;
const proceedings = readJson('knowledge/proceedings.json').proceedings;
const questions = readJson('knowledge/open-questions.json').questions;

test('Amtszeit, Wahl und Amtsantritt Manuela Dreyers sind getrennt modelliert', () => {
  const dreyer = persons.find((entry: { id: string }) => entry.id === 'person-manuela-dreyer');
  const office = dreyer.roles.find((entry: { officeTitle: string }) => entry.officeTitle === 'Bundespräsidentin');
  assert.deepEqual([office.validFrom, office.validTo], ['2026-05-18', '2026-07-16']);
  const election = timeline.find((entry: { id: string }) => entry.id === 'event-dreyer-election-2026');
  const inauguration = timeline.find((entry: { id: string }) => entry.id === 'event-dreyer-inauguration-2026');
  assert.deepEqual([election.startDate, election.endDate], ['2026-05-16', '2026-05-17']);
  assert.equal(inauguration.date, '2026-05-18');
});

test('Karl Honeckers Vertretung hat zwei Gründe und kein erfundenes Enddatum', () => {
  const honecker = persons.find((entry: { id: string }) => entry.id === 'person-karl-honecker');
  const phases = honecker.roles.filter((entry: { institutionId: string }) => entry.institutionId === 'inst-bundespraesident');
  assert.equal(phases.length, 2);
  assert.deepEqual([phases[0].validFrom, phases[0].validTo, phases[0].representationReason], ['2026-06-01', '2026-07-15', 'Verhinderung der Bundespräsidentin']);
  assert.deepEqual([phases[1].validFrom, phases[1].validTo, phases[1].representationReason], ['2026-07-16', null, 'Vorzeitige Erledigung des Amtes durch Rücktritt']);
  assert.doesNotMatch(JSON.stringify(phases), /Gegenzeichnung durch Karl Honecker/u);
});

test('Präsidentenanklage ist datiert und ihr formeller Ausgang bleibt offen', () => {
  const proceeding = proceedings.find((entry: { id: string }) => entry.id === 'proceeding-federal-president-dreyer-impeachment');
  assert.deepEqual([proceeding.motionDate, proceeding.parliamentaryDecisionDate, proceeding.indictmentFiledDate, proceeding.resignationDate], ['2026-07-09', '2026-07-12', '2026-07-12', '2026-07-16']);
  assert.equal(proceeding.hearingOriginallyScheduledOn, '2026-07-16');
  assert.equal(proceeding.hearingStatus, 'postponed');
  assert.equal(proceeding.stage, 'formal-outcome-unresolved');
  const question = questions.find((entry: { id: string }) => entry.id === 'question-dreyer-impeachment-final-disposition');
  assert.equal(question.questionStatus, 'open');
});

test('Wahl zur achten Volkskammer ist für den 5. und 6. September angesetzt', () => {
  const election = timeline.find((entry: { id: string }) => entry.id === 'event-volkskammer-election-2026');
  assert.deepEqual([election.eventType, election.startDate, election.endDate, election.eventStatus], ['election', '2026-09-05', '2026-09-06', 'scheduled']);
  const publicEvent = readJson('content/presse/termine/wahl-achte-volkskammer-2026.json');
  assert.match(`${publicEvent.teaser} ${publicEvent.body.join(' ')}`, /5\. und 6\. September 2026/u);
});

test('aktuelle strukturierte und öffentliche Inhalte führen keinen offenen August-Wahltermin', () => {
  const election = timeline.find((entry: { id: string }) => entry.id === 'event-volkskammer-election-2026');
  assert.doesNotMatch(JSON.stringify(election), /Ende August|30\.\/31\.|30\. August|31\. August/u);

  const currentPaths = [
    'knowledge/current-state.json', 'knowledge/proceedings.json', 'knowledge/open-questions.json',
    'content/freistaat/staatsaufbau.json', 'content/regierung/mitglieder/karl-honecker.json',
    'content/presse/termine/wahl-achte-volkskammer-2026.json', 'src/pages/recht/verfassung/index.astro',
  ];
  for (const path of currentPaths) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      text,
      /(?:Volkskammerwahl|Wahl zur achten Volkskammer|Wahltermin)[^}\n]{0,240}(?:Ende August|30\.\/31\.|30\. August|31\. August)/u,
      path,
    );
  }
});
