import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareSubjects,
  formatSubjectLabel,
  fundingAreaFromFsn,
  getFundingAreaByNumber,
  getSubjectByNumber,
  getSubjectByTitle,
  getSubjectGroupOf,
  lawFundingAreas,
  lawSubjectGroups,
  lawSubjects,
  legacySubjectMapping,
  subjectNumberFromFsn,
} from '@ostrecht/shared/config/law-subjects.ts';

test('die amtliche Systematik ist zweistufig, eindeutig und aufsteigend nummeriert', () => {
  assert.equal(lawSubjectGroups.length, 8);
  assert.deepEqual(lawSubjectGroups.map((group) => group.number), ['1', '2', '3', '4', '5', '6', '7', '8']);

  const numbers = lawSubjects.map((subject) => subject.number);
  assert.equal(new Set(numbers).size, numbers.length, 'Untergruppennummern sind eindeutig');
  assert.deepEqual([...numbers].sort(), numbers, 'Untergruppen stehen in aufsteigender Nummernfolge');

  const titles = lawSubjects.map((subject) => subject.title);
  assert.equal(new Set(titles).size, titles.length, 'Untergruppentitel sind eindeutig');

  for (const group of lawSubjectGroups) {
    assert.ok(group.title.length > 0 && group.description.length > 0, `Hauptgruppe ${group.number} ist beschrieben`);
    assert.ok(group.subjects.length > 0, `Hauptgruppe ${group.number} hat Untergruppen`);
    for (const subject of group.subjects) {
      assert.equal(subject.number[0], group.number, `${subject.number} beginnt mit der Nummer der Hauptgruppe`);
      assert.equal(subject.number.length, 2, `${subject.number} ist zweistellig`);
      assert.equal(getSubjectGroupOf(subject.title)?.number, group.number, `${subject.title} gehört zu genau einer Hauptgruppe`);
    }
  }
});

test('Nachschlagen funktioniert über Titel und Nummer', () => {
  const subject = getSubjectByNumber('71');
  assert.ok(subject);
  assert.equal(getSubjectByTitle(subject.title)?.number, '71');
  assert.equal(getSubjectByNumber('99'), undefined);
  assert.equal(getSubjectByTitle('Landesrecht'), undefined);
  assert.equal(getSubjectGroupOf('Landesrecht'), undefined);
});

test('Fundstellennummern ergeben die Untergruppe der amtlichen Gliederungsnummer', () => {
  const cases: Array<[string | null | undefined, string | null]> = [
    ['612-3.10/2', '61'],
    ['110', '11'],
    ['11', '11'],
    ['5563-V20.1', '55'],
    ['5500', '55'],
    ['2300', '23'],
    ['2421', '24'],
    ['3021', '30'],
    ['8', '80'],
    ['36-1', null],
    ['', null],
    [null, null],
    [undefined, null],
    ['V02.2', null],
  ];
  for (const [fsn, expected] of cases) {
    assert.equal(subjectNumberFromFsn(fsn), expected, `Fsn ${String(fsn)}`);
  }
});

test('Förderbereiche stammen aus vierstelligen Förderkennungen', () => {
  assert.deepEqual(lawFundingAreas.map((area) => area.number), ['550', '551', '552', '553', '554', '555', '556', '557', '558', '559']);
  for (const area of lawFundingAreas) {
    assert.equal(getFundingAreaByNumber(area.number)?.title, area.title);
  }
  assert.equal(fundingAreaFromFsn('5563-V20.1'), '556');
  assert.equal(fundingAreaFromFsn('5500'), '550');
  assert.equal(fundingAreaFromFsn('55'), null);
  assert.equal(fundingAreaFromFsn('612-3.10/2'), null);
  assert.equal(fundingAreaFromFsn(null), null);
  assert.equal(getFundingAreaByNumber('560'), undefined);
});

test('jede frühere Zuordnung zeigt auf eine bestehende Untergruppe', () => {
  assert.equal(legacySubjectMapping.Landesrecht, undefined, 'die alte Auffangbezeichnung wird nicht zugeordnet');
  for (const [legacy, number] of Object.entries(legacySubjectMapping)) {
    assert.ok(getSubjectByNumber(number), `${legacy} zeigt auf die vorhandene Untergruppe ${number}`);
    assert.equal(getSubjectByTitle(legacy), undefined, `${legacy} ist selbst keine amtliche Untergruppe`);
  }
});

test('Sortierung und Beschriftung folgen der Systematik', () => {
  const verfassung = getSubjectByNumber('10')!.title;
  const bildung = getSubjectByNumber('71')!.title;
  assert.ok(compareSubjects(verfassung, bildung) < 0);
  assert.ok(compareSubjects(bildung, verfassung) > 0);
  assert.equal(compareSubjects(bildung, bildung), 0);
  assert.ok(compareSubjects(bildung, 'Unbekanntes Sachgebiet') < 0, 'unbekannte Bezeichnungen stehen hinten');
  assert.ok(compareSubjects('Unbekanntes Sachgebiet', bildung) > 0);
  assert.ok(compareSubjects('Alpha', 'Beta') < 0, 'unbekannte Bezeichnungen alphabetisch');

  assert.equal(formatSubjectLabel(bildung, { withNumber: true }), `71 ${bildung}`);
  assert.equal(formatSubjectLabel(bildung), bildung);
  const agreements = getSubjectByNumber('14')!;
  assert.equal(formatSubjectLabel(agreements.title, { short: true }), agreements.shortTitle);
  assert.equal(formatSubjectLabel(agreements.title, { withNumber: true, short: true }), `14 ${agreements.shortTitle}`);
  assert.equal(formatSubjectLabel('Unbekanntes Sachgebiet', { withNumber: true }), 'Unbekanntes Sachgebiet');
});
