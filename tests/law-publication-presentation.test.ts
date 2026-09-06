import assert from 'node:assert/strict';
import test from 'node:test';

import { getPublicationLabel, hasNumberedIssue, type Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';

import { citationShortForm, directoryDescription } from '../apps/recht/src/lib/norm-summary.ts';
import {
  formatIssueHeadline,
  formatPublisherLine,
  formatVersionDateLabel,
  publicationSourceLinks,
} from '../apps/recht/src/lib/publication-presentation.ts';
import type { NormSummary } from '../apps/recht/src/lib/runtime/store.ts';

/**
 * Darstellung der Verkündungen und der Verzeichnisbeschreibungen. Alle Daten sind erfunden;
 * kein Bestandstitel, keine Bestandsabkürzung, kein Bestandsslug und keine echte Fundstelle.
 */
function issue(overrides: Partial<Verkuendung> = {}): Verkuendung {
  return {
    slug: 'testblatt-2026-01',
    title: 'Testblatt 2026 Nr. 1',
    year: 2026,
    issue: '1',
    date: '2026-03-01',
    publication: 'TBl.',
    entries: [],
    ...overrides,
  } as Verkuendung;
}

test('nummerierte Ausgaben behalten ihr Kurzzitat, Einzelverkündungen tragen das Ausgabedatum', () => {
  assert.equal(getPublicationLabel(issue()), 'TBl. 2026 Nr. 1');
  assert.equal(getPublicationLabel(issue({ issue: 'II' })), 'TBl. 2026 Nr. II');
  assert.equal(getPublicationLabel(issue({ issue: '1–7' })), 'TBl. 2026 Nr. 1–7');
  assert.equal(
    getPublicationLabel(issue({ publication: 'Amtliche Testverkündung', issue: '1. März 2026' })),
    'Amtliche Testverkündung vom 1. März 2026',
  );
});

test('die Nummernprüfung trennt Zahlen, römische Zahlen und Spannen von Datumsangaben', () => {
  for (const value of ['1', '73', 'II', 'IV', '1–7', '1/2', '2.3']) {
    assert.equal(hasNumberedIssue({ issue: value }), true, value);
  }
  for (const value of ['1. März 2026', 'Sonderausgabe', 'Ausgabe A']) {
    assert.equal(hasNumberedIssue({ issue: value }), false, value);
  }
});

test('die Kopfzeile einer Ausgabe nennt das Datum genau einmal', () => {
  assert.equal(formatIssueHeadline(issue()), 'TBl. 2026 Nr. 1 vom 1. März 2026');
  assert.equal(
    formatIssueHeadline(issue({ publication: 'Amtliche Testverkündung', issue: '1. März 2026' })),
    'Amtliche Testverkündung vom 1. März 2026',
  );
});

test('die Herausgeberzeile beugt nach dem Kopfnomen und weicht sonst auf die neutrale Form aus', () => {
  assert.equal(formatPublisherLine('Freistaat Ostdeutschland'), 'Herausgegeben vom Freistaat Ostdeutschland.');
  assert.equal(
    formatPublisherLine('Ministerium für freistaatliche Sicherheit'),
    'Herausgegeben vom Ministerium für freistaatliche Sicherheit.',
  );
  assert.equal(
    formatPublisherLine('Bundesministerium des Innern und für Heimat'),
    'Herausgegeben vom Bundesministerium des Innern und für Heimat.',
  );
  assert.equal(formatPublisherLine('Teststaatskanzlei'), 'Herausgeber: Teststaatskanzlei.');
  assert.equal(formatPublisherLine('Staatskanzlei des Testlandes'), 'Herausgegeben von der Staatskanzlei des Testlandes.');
  assert.equal(formatPublisherLine(''), undefined);
  assert.equal(formatPublisherLine(undefined), undefined);
});

test('der Fassungszusatz nennt ein Datum oder entfällt; eine Fassungskennung wird nie ausgegeben', () => {
  assert.equal(formatVersionDateLabel('2026-09-03', '2026-09-03'), 'Fassung vom 3. September 2026');
  assert.equal(formatVersionDateLabel('2026-09-03'), 'Fassung vom 3. September 2026');
  assert.equal(formatVersionDateLabel('erstfassung', undefined), undefined);
  assert.equal(formatVersionDateLabel('erstfassung', '2026-01-02'), 'Fassung vom 2. Januar 2026');
  assert.equal(formatVersionDateLabel(undefined), undefined);
});

test('die Quellenliste einer Ausgabe führt nur Verweise mit Ziel', () => {
  const publication = issue({
    sourceReferences: [
      { kind: 'primary-pdf', label: 'Ohne Ziel', availability: 'versioned', localSource: 'Testquelle/test.pdf' },
      { kind: 'original', label: 'Mit Ziel', availability: 'external', url: 'https://beispiel.invalid/test.pdf', pageRange: '2–6' },
    ],
  } as Partial<Verkuendung>);
  assert.deepEqual(publicationSourceLinks(publication), [
    { label: 'Mit Ziel', url: 'https://beispiel.invalid/test.pdf', pageRange: '2–6' },
  ]);
  assert.deepEqual(publicationSourceLinks(issue()), []);
});

function summary(overrides: Partial<NormSummary> = {}): NormSummary {
  return {
    id: 'testvorschrift',
    slug: 'testvorschrift',
    title: 'Testvorschrift über Prüfzwecke',
    shortTitle: 'Testvorschrift',
    summary: '',
    type: 'verordnung',
    status: 'in-force',
    subjects: [],
    keywords: [],
    aliases: [],
    currentVersionId: '2026-01-01',
    currentValidFrom: '2026-01-01',
    versionCount: 1,
    ...overrides,
  } as NormSummary;
}

test('die Kurzform des Vollzitats nennt Ausfertigung und Fundstelle ohne den Titel und ohne Änderungszusatz', () => {
  assert.equal(
    citationShortForm('Testvorschrift über Prüfzwecke vom 4. Dezember 1997 (TBl. S. 684)'),
    'Vom 4. Dezember 1997 (TBl. S. 684)',
  );
  assert.equal(
    citationShortForm('Testvorschrift vom 19. Oktober 1998 (TBl. S. 505), die zuletzt durch die Verordnung vom 28. Juni 2002 (TBl. S. 205) geändert worden ist'),
    'Vom 19. Oktober 1998 (TBl. S. 505)',
  );
  assert.equal(citationShortForm('Testvorschrift ohne Ausfertigungsformel'), 'Testvorschrift ohne Ausfertigungsformel');
  assert.equal(citationShortForm(''), '');
  assert.equal(citationShortForm(undefined), '');
});

test('die Beschreibung eines Verzeichniseintrags nimmt die Zusammenfassung, sonst die Kurzform des Vollzitats', () => {
  assert.equal(directoryDescription({ ...summary({ summary: 'Regelt die Prüfzwecke.' }) }), 'Regelt die Prüfzwecke.');
  assert.equal(
    directoryDescription({ ...summary(), initialCitation: 'Testvorschrift vom 4. Dezember 1997 (TBl. S. 684)' }),
    'Vom 4. Dezember 1997 (TBl. S. 684)',
  );
  assert.equal(directoryDescription(summary()), '');
});
