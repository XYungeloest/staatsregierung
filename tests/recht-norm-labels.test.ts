import assert from 'node:assert/strict';
import test from 'node:test';

import { dayAfterLastValidDay, formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { getNormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';
import { EDITORIAL_REFERENCE_DATE } from '@ostrecht/shared/lib/norms/versions.ts';
import { formatSearchResultLabel } from '@ostrecht/recht-search/search-query.ts';

import { formatShortDate } from '../apps/recht/src/lib/dates.ts';
import { amendingCitation, buildNormHeadModel, factsCitation, normKicker, outOfForceSince, versionListCitation, type NormHeadModel } from '../apps/recht/src/lib/norm-head.ts';
import { formatSourceLabel } from '../apps/recht/src/lib/source-labels.ts';
import { referenceDateLabel } from '../apps/recht/src/lib/vocabulary.ts';
import { buildFixtureNorms, FIXTURE_REFERENCE_DATE } from './helpers/fixture-corpus.ts';

import type { NormPublicationReference } from '@ostrecht/shared/lib/norms/publications.ts';
import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Beschriftungen der Normseite: Statuszeile des Kopfs (Befund E5) und der Wortlaut des
 * redaktionellen Rechtsstands (Befund H1). Die Oberfläche beschreibt die geltende Fassung als
 * „Rechtsstand vom <Datum>“ – eine Aussage, die an jedem Aufruftag zutrifft; „Geltend am“ und
 * das Wort „Stichtag“ kommen außerhalb der Hilfe nicht mehr vor. Seit Richtung E bildet
 * `buildNormHeadModel` den Kopf; die Statuszeile ist die erste Angabe plus die weiteren Teile in
 * Leserichtung, Daten stehen im Kopf numerisch (dd.mm.yyyy).
 */

/** Statuszeile des Kopfs, wie sie die Normseite in Leserichtung zeigt. */
function statusLine(model: NormHeadModel): string {
  return [model.primary, ...model.parts.map((part) => part.text)].join(' · ');
}

function headModel(record: NormRecord, entry: NormVersion, records: NormRecord[] = [record]): NormHeadModel {
  return buildNormHeadModel(record, entry, { origin: getNormOriginInfo(record, records) });
}

function version(versionId: string, validFrom: string, validTo: string | null = null): NormVersion {
  return {
    versionId,
    validFrom,
    validTo,
    isCurrent: false,
    citation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 901)',
    changeNote: versionId,
    body: [],
  };
}

function norm(options: {
  versions: NormVersion[];
  initialVersionId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  status?: NormRecord['meta']['status'];
}): NormRecord {
  return {
    meta: {
      id: 'testnorm',
      slug: 'testnorm',
      title: 'Testvorschrift',
      type: 'gesetz',
      status: options.status ?? 'in-force',
      subjects: ['Testsachgebiet'],
      keywords: [],
      initialCitation: 'Gesetz vom 1. Januar 2024 (OGVBl. 2024 Nr. 901)',
      predecessor: null,
      successor: null,
      ...(options.effectiveDate ? { effectiveDate: options.effectiveDate } : {}),
      ...(options.expiryDate ? { expiryDate: options.expiryDate } : {}),
    } as NormRecord['meta'],
    history: {
      ...(options.initialVersionId ? { initialVersionId: options.initialVersionId } : {}),
      entries: [],
    } as NormRecord['history'],
    versions: options.versions,
  };
}

test('Statuszeile beschreibt zuerst die Fassung und danach die Vorschrift', () => {
  const initial = version('2024-10-15', '2024-10-15', '2026-07-20');
  const current = version('2026-07-21', '2026-07-21');
  const record = norm({ versions: [initial, current], initialVersionId: initial.versionId, effectiveDate: '2024-10-15' });

  const status = statusLine(headModel(record, current));
  assert.equal(status, `Geltende Fassung seit ${formatShortDate('2026-07-21')} · Vorschrift in Kraft seit ${formatShortDate('2024-10-15')}`);
  assert.ok(!status.includes('Aktuelle Fassung'));
});

test('ohne belegtes Inkrafttreten trägt die Statuszeile die Stammfassung, bei Gleichheit nur ein Datum', () => {
  const initial = version('2023-11-01', '2023-11-01', '2026-03-24');
  const current = version('2026-03-25', '2026-03-25');
  const withoutEffectiveDate = norm({ versions: [initial, current], initialVersionId: initial.versionId });
  assert.equal(
    statusLine(headModel(withoutEffectiveDate, current)),
    `Geltende Fassung seit ${formatShortDate('2026-03-25')} · Vorschrift in Kraft seit ${formatShortDate('2023-11-01')}`,
  );

  const single = version('2023-11-01', '2023-11-01');
  const oneVersion = norm({ versions: [single], initialVersionId: single.versionId });
  assert.equal(statusLine(headModel(oneVersion, single)), `Geltende Fassung · in Kraft seit ${formatShortDate('2023-11-01')}`);

  // Ohne Stammfassung und ohne Inkrafttreten behauptet die Zeile kein Datum der Vorschrift.
  const unknown = norm({ versions: [single] });
  assert.equal(statusLine(headModel(unknown, single)), `Geltende Fassung · in Kraft seit ${formatShortDate('2023-11-01')}`);
});

test('der Normkopf ist auf Fassung, Historie und Vergleich derselbe', () => {
  const initial = version('2024-10-15', '2024-10-15', '2026-07-20');
  const current = version('2026-07-21', '2026-07-21');
  const record = norm({ versions: [initial, current], initialVersionId: initial.versionId, effectiveDate: '2024-10-15' });
  // Normseite, Historie und Vergleich bauen den Kopf aus demselben Modell derselben Fassung.
  const states = [headModel(record, current), headModel(record, current), headModel(record, current)];
  assert.equal(new Set(states.map((entry) => `${normKicker(record).initialCitation}|${entry.mark.status}|${statusLine(entry)}`)).size, 1);
  assert.equal(states[0].band, undefined);

  // Die Einzelfassungsseite trägt das Statusband und nennt zusätzlich das Inkrafttreten der Vorschrift.
  const historical = headModel(record, initial);
  assert.equal(historical.band?.kind, 'historical');
  assert.equal(historical.band?.title, 'Historische Fassung');
  assert.match(historical.band?.text ?? '', /^gültig vom /u);
  assert.match(historical.primary, /^Angezeigt: historische Fassung /u);
  assert.ok(statusLine(historical).includes(`Vorschrift in Kraft seit ${formatShortDate('2024-10-15')}`));
  assert.equal(historical.mark.label, 'Vorschrift in Kraft');
});

test('kein Normkopf des Fixture-Bestands nennt „Geltend am“ oder das Wort „Stichtag“', () => {
  const records = buildFixtureNorms();
  for (const record of records) {
    for (const entry of record.versions) {
      const model = headModel(record, entry, records);
      const text = [statusLine(model), model.band?.title, model.band?.text, model.origin.text].join(' ');
      assert.ok(!/Geltend am|Stichtag/u.test(text), `${record.meta.slug}/${entry.versionId}: ${text}`);
    }
  }
});

test('geltende Fassungen heißen überall „Rechtsstand vom <Datum>“', () => {
  assert.equal(referenceDateLabel('2026-09-04'), 'Rechtsstand vom 4. September 2026');
  assert.equal(referenceDateLabel(), `Rechtsstand vom ${formatDate(EDITORIAL_REFERENCE_DATE)}`);
  assert.equal(EDITORIAL_REFERENCE_DATE, FIXTURE_REFERENCE_DATE);

  // Die Trefferliste bildet den Text im Browser selbst; der Wortlaut muss gleich bleiben.
  const label = formatSearchResultLabel({ versionKind: 'current', validFrom: '2026-03-25' }, FIXTURE_REFERENCE_DATE);
  assert.equal(label, `Geltende Fassung, ${referenceDateLabel(FIXTURE_REFERENCE_DATE)}`);
  assert.ok(!label.includes('Stichtag'));
  assert.ok(!label.includes('zum '));
});

test('Quellenbezeichnungen schreiben maschinenlesbare Daten aus', () => {
  assert.equal(
    formatSourceLabel('Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01'),
    'Ausgangsfassung zum Rechtsüberleitungsstichtag 1. November 2023',
  );
  assert.equal(formatSourceLabel('Amtliche Ausgabe ohne Datum'), 'Amtliche Ausgabe ohne Datum');
  assert.equal(formatSourceLabel(undefined), '');
});

test('Quellenbezeichnungen nennen keine Dateiformate der Transkription', () => {
  assert.equal(formatSourceLabel('Vollständige strukturtragende HTML-Fassung der amtlichen Ausgabe'), 'Vollständige Textfassung der amtlichen Ausgabe');
  assert.equal(formatSourceLabel('Historische Markdown-Transkription (Altbestand)'), 'Historische Abschrift (Altbestand)');
  assert.equal(formatSourceLabel('Zusätzliche Markdown-Transkription der amtlichen Ausgabe'), 'Zusätzliche Abschrift der amtlichen Ausgabe');
  assert.equal(formatSourceLabel('Redaktionell geprüfte HTML-Fassung der Quelle'), 'Redaktionell geprüfte Textfassung der Quelle');
  assert.equal(formatSourceLabel('Redaktionell geprüfte strukturierte Transkription der Ausgabe'), 'Redaktionell geprüfte Abschrift der Ausgabe');
  assert.equal(formatSourceLabel('Strukturtragende DOCX-Quelle des Testgesetzes'), 'Textvorlage des Testgesetzes');
  assert.equal(
    formatSourceLabel('Vollständige strukturtragende HTML-Fassung der amtlichen Ausgabe – Berichtigung Berichtigung vom 3. März 2026 (Testblatt 2026 Nr. 901 S. 2)'),
    'Vollständige Textfassung der amtlichen Ausgabe – Berichtigung vom 3. März 2026 (Testblatt 2026 Nr. 901 S. 2)',
  );
  for (const label of ['Vollständige strukturtragende HTML-Fassung der amtlichen Ausgabe', 'Historische Markdown-Transkription (Altbestand)', 'Strukturtragende DOCX-Quelle des Testgesetzes']) {
    assert.doesNotMatch(formatSourceLabel(label), /HTML|Markdown|DOCX|Transkription/u, label);
  }
});

test('Historischer Kopf aufgehobener Normen behauptet keine fortdauernde Geltung', () => {
  const records = buildFixtureNorms();
  for (const record of records.filter((entry) => ['repealed', 'historical'].includes(entry.meta.status))) {
    for (const entry of record.versions) {
      const line = statusLine(headModel(record, entry, records));
      assert.doesNotMatch(line, /weiterhin in Kraft/u);
      assert.match(line, /außer Kraft/u);
    }
  }
});

test('„außer Kraft seit“ nennt den Folgetag des letzten Geltungstags', () => {
  // expiryDate und validTo sind letzte Geltungstage; der Folgetag ist der erste Tag ohne Geltung.
  assert.equal(dayAfterLastValidDay('2026-04-30'), '2026-05-01');
  assert.equal(dayAfterLastValidDay('2025-12-31'), '2026-01-01');
  assert.equal(dayAfterLastValidDay('2028-02-28'), '2028-02-29');
  assert.equal(dayAfterLastValidDay('2027-02-28'), '2027-03-01');
  assert.equal(dayAfterLastValidDay('kein Datum'), 'kein Datum');

  const only = version('2024-01-01', '2024-01-01', '2026-04-30');
  for (const status of ['repealed', 'historical'] as const) {
    const record = norm({ versions: [only], initialVersionId: only.versionId, effectiveDate: '2024-01-01', expiryDate: '2026-04-30', status });
    assert.equal(outOfForceSince(record), '2026-05-01');
    // Der Kopf nennt den letzten Geltungstag nur als Ende eines Zeitraums („– …“), nie als „seit …“.
    const line = statusLine(headModel(record, only));
    assert.ok(!line.includes(`seit ${formatShortDate('2026-04-30')}`), line);
  }

  // Befristete, noch geltende oder künftige Vorschriften nennen kein „seit“ ihres Ablaufs.
  for (const status of ['in-force', 'future-effective', 'one-time-act'] as const) {
    assert.equal(outOfForceSince(norm({ versions: [only], expiryDate: '2026-04-30', status })), undefined);
  }
  assert.equal(outOfForceSince(norm({ versions: [only], status: 'repealed' })), undefined);
});

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

test('der Kopf aufgehobener Vorschriften nennt „außer Kraft seit“ den Folgetag, nie „in Kraft seit“', () => {
  const first = version('2023-11-01', '2023-11-01', '2025-06-30');
  const last = version('2025-07-01', '2025-07-01', '2026-04-30');
  for (const status of ['repealed', 'historical'] as const) {
    const record = norm({ versions: [first, last], initialVersionId: first.versionId, effectiveDate: '2023-11-01', expiryDate: '2026-04-30', status });
    for (const entry of [first, last]) {
      const model = headModel(record, entry);
      const line = statusLine(model);
      assert.equal(model.temporalKind, 'historical');
      assert.ok(line.includes(`Vorschrift außer Kraft seit ${formatShortDate('2026-05-01')}`), line);
      assert.doesNotMatch(line, /(?<!außer )in Kraft seit/u, line);
      assert.equal(model.mark.label, 'Vorschrift außer Kraft');
    }
  }

  // Ohne belegtes Ende nennt der Kopf kein Datum, behauptet aber auch keine Geltung.
  const single = version('1996-01-15', '1996-01-15', '2008-07-31');
  const undated = norm({ versions: [single], effectiveDate: '1996-01-15', status: 'repealed' });
  const line = statusLine(headModel(undated, single));
  assert.match(line, /Die Vorschrift ist außer Kraft/u);
  assert.doesNotMatch(line, /(?<!außer )in Kraft seit/u, line);
});

test('der Kopf noch nicht wirksamer Vorschriften nennt das künftige Inkrafttreten, nicht „in Kraft seit“', () => {
  const start = shiftDays(FIXTURE_REFERENCE_DATE, 1);
  const later = shiftDays(FIXTURE_REFERENCE_DATE, 40);
  const first = version(start, start, shiftDays(later, -1));
  const second = version(later, later);
  for (const status of ['future-effective', 'one-time-act'] as const) {
    const record = norm({ versions: [first, second], initialVersionId: first.versionId, effectiveDate: start, status });
    for (const entry of [first, second]) {
      const model = headModel(record, entry);
      const line = statusLine(model);
      assert.equal(model.temporalKind, 'future');
      assert.ok(line.includes(`Vorschrift tritt am ${formatShortDate(start)} in Kraft`), line);
      assert.doesNotMatch(line, /in Kraft seit/u, line);
    }
  }

  // Ungeklärtes Inkrafttreten: weder „in Kraft seit“ noch ein Datum des Inkrafttretens.
  const pendingVersion = version('2026-01-01', '2026-01-01');
  const pending = norm({ versions: [pendingVersion], initialVersionId: pendingVersion.versionId, status: 'pending-effective' });
  const line = statusLine(headModel(pending, pendingVersion));
  assert.doesNotMatch(line, /in Kraft seit|tritt am/u, line);
});

test('die Fassungsliste nennt bei Folgefassungen die Fundstelle der Änderung, bei der Stammfassung die Stammfundstelle', () => {
  const initial = { ...version('2023-11-01', '2023-11-01', '2026-06-30'), citation: 'Synthetisches Prüfgesetz vom 5. Mai 2015 (Testblatt A S. 901)' };
  const amended = { ...version('2026-07-01', '2026-07-01'), citation: 'Synthetisches Prüfgesetz vom 5. Mai 2015 (Testblatt A S. 901), zuletzt geändert durch Artikel 9 des Gesetzes vom 9. Februar 2026 (OGVBl. 2026 Nr. 932)' };
  const record = norm({ versions: [initial, amended], initialVersionId: initial.versionId });
  assert.equal(versionListCitation(record, initial, initial.versionId), 'Testblatt A S. 901');
  assert.equal(versionListCitation(record, amended, initial.versionId), 'OGVBl. 2026 Nr. 932');

  // Ohne benannte Stammfassung gilt die früheste Fassung als Stammfassung.
  const unnamed = norm({ versions: [amended, initial] });
  assert.equal(versionListCitation(unnamed, initial), 'Testblatt A S. 901');
  assert.equal(versionListCitation(unnamed, amended), 'OGVBl. 2026 Nr. 932');
});

test('die Vorschriftendaten nennen dieselbe Fundstelle wie die Fassungsliste und die abweichende Stammfundstelle', () => {
  const initial = { ...version('2023-11-01', '2023-11-01', '2026-06-30'), citation: 'Synthetisches Prüfgesetz vom 5. Mai 2015 (Testblatt A S. 901)' };
  const amended = { ...version('2026-07-01', '2026-07-01'), citation: 'Synthetisches Prüfgesetz vom 5. Mai 2015 (Testblatt A S. 901), zuletzt geändert durch Artikel 9 des Gesetzes vom 9. Februar 2026 (OGVBl. 2026 Nr. 932)' };
  const record = norm({ versions: [initial, amended], initialVersionId: initial.versionId });
  record.meta.initialCitation = initial.citation;

  // Folgefassung mit konsolidiertem Vollzitat: Fundstelle der Änderung, Stammfundstelle zusätzlich.
  assert.deepEqual(factsCitation(record, amended, { baselineVersionId: initial.versionId }), { citation: 'OGVBl. 2026 Nr. 932', initialCitation: 'Testblatt A S. 901' });
  assert.equal(factsCitation(record, amended, { baselineVersionId: initial.versionId }).citation, versionListCitation(record, amended, initial.versionId));
  // Stammfassung: keine doppelte Stammfundstelle.
  assert.deepEqual(factsCitation(record, initial, { baselineVersionId: initial.versionId }), { citation: 'Testblatt A S. 901' });
  // Verkündungsbezug, der die Stammfundstelle bezeichnet, wiederholt sie nicht.
  const publicationReference = { publicationSlug: 'testblatt-a', publicationTitle: 'Testblatt A', publicationDate: '2015-05-05', startPage: '901' } as NormPublicationReference;
  assert.equal(factsCitation(record, initial, { baselineVersionId: initial.versionId, publicationReference }).initialCitation, undefined);

  // Der Verkündungsbezug trägt den ausgeschriebenen Ausgabentitel, die Stammfundstelle die Kurzform:
  // verglichen werden Blattkürzel, Jahrgang, Nummer und Seite, nicht der Titel.
  const issued = { ...version('2024-10-15', '2024-10-15'), citation: 'Synthetisches Prüfgesetz vom 15. Oktober 2024 (TBl. 2024 Nr. II S. 5)' };
  const issuedRecord = norm({ versions: [issued], initialVersionId: issued.versionId });
  issuedRecord.meta.initialCitation = issued.citation;
  const issueReference = {
    publicationSlug: 'tbl-2024-ii',
    publicationTitle: 'Synthetisches Testblatt für Verordnungen 2024 Nr. II',
    publicationDate: '2024-10-15',
    publication: 'TBl.',
    issue: 'II',
    citation: 'Gesetz vom 15. Oktober 2024 (TBl. 2024 Nr. II S. 5)',
    startPage: '5',
  } as NormPublicationReference;
  assert.equal(factsCitation(issuedRecord, issued, { baselineVersionId: issued.versionId, publicationReference: issueReference }).initialCitation, undefined);
  // Schreibvarianten (Punkt, Leerraum) ändern die Fundstelle nicht; die Ausgabe ohne Seitenangabe auch nicht.
  issuedRecord.meta.initialCitation = 'Synthetisches Prüfgesetz vom 15. Oktober 2024 (TBl.  2024 Nr. II, S. 5)';
  assert.equal(factsCitation(issuedRecord, issued, { publicationReference: { ...issueReference, citation: 'Gesetz' } }).initialCitation, undefined);
  issuedRecord.meta.initialCitation = 'Synthetisches Prüfgesetz vom 15. Oktober 2024 (TBl. 2024 Nr. II)';
  assert.equal(factsCitation(issuedRecord, { ...issued, citation: 'Synthetisches Prüfgesetz' }, { publicationReference: issueReference }).initialCitation, undefined);
  // Eine andere Seite derselben Ausgabe oder eine andere Ausgabe bleibt eine eigene Stammfundstelle.
  issuedRecord.meta.initialCitation = 'Synthetisches Prüfgesetz vom 1. März 2024 (TBl. 2024 Nr. II S. 9)';
  assert.equal(factsCitation(issuedRecord, issued, { publicationReference: issueReference }).initialCitation, 'TBl. 2024 Nr. II S. 9');
  issuedRecord.meta.initialCitation = 'Synthetisches Prüfgesetz vom 1. März 2024 (TBl. 2024 Nr. III S. 5)';
  assert.equal(factsCitation(issuedRecord, issued, { publicationReference: issueReference }).initialCitation, 'TBl. 2024 Nr. III S. 5');

  // Ohne erkennbare Fundstelle bleibt die Angabe leer wie in der Fassungsliste.
  const untitled = { ...amended, citation: 'Synthetisches Prüfgesetz (SynPG)' };
  const bare = norm({ versions: [initial, untitled], initialVersionId: initial.versionId });
  bare.meta.initialCitation = initial.citation;
  assert.equal(factsCitation(bare, untitled, { baselineVersionId: initial.versionId }).citation, versionListCitation(bare, untitled, initial.versionId));
});

test('die verkündete künftige Änderung nennt die Fundstelle der Änderungsvorschrift, nicht die Stammfundstelle', () => {
  // Konsolidiertes Vollzitat: erste Klammer Stammfundstelle, letzte Klammer die ändernde Vorschrift.
  const consolidated = 'Synthetisches Prüfgesetz in der Fassung der Bekanntmachung vom 9. März 2018 (Testblatt A S. 99), die zuletzt durch Artikel 3 des Gesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2) geändert worden ist';
  assert.equal(amendingCitation(consolidated), 'OGVBl. 2026 Nr. 946 S. 2');
  assert.equal(amendingCitation('Gesetz vom 3. September 2026 (OGVBl. 2026 Nr. 970 S. 2)'), 'OGVBl. 2026 Nr. 970 S. 2', 'mit einer Klammer sind beide Fundstellen dieselbe');
  assert.equal(amendingCitation('Gesetz ohne Klammer'), 'Gesetz ohne Klammer');

  const next = new Date(`${FIXTURE_REFERENCE_DATE}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 30);
  const futureDate = next.toISOString().slice(0, 10);
  next.setUTCDate(next.getUTCDate() - 1);
  const current = version('2018-03-09', '2018-03-09', next.toISOString().slice(0, 10));
  current.citation = 'Synthetisches Prüfgesetz in der Fassung der Bekanntmachung vom 9. März 2018 (Testblatt A S. 99)';
  const future = version(futureDate, futureDate);
  future.citation = consolidated;
  const record = norm({ versions: [current, future], initialVersionId: current.versionId, effectiveDate: '2018-03-09' });
  const model = headModel(record, current);
  const futurePart = model.parts.find((part) => part.tone === 'future');
  assert.ok(futurePart, 'die Statuszeile kündigt die verkündete Änderung an');
  assert.equal(futurePart?.text, `Änderung zum ${formatShortDate(futureDate)} verkündet (OGVBl. 2026 Nr. 946 S. 2)`);
  assert.ok(!statusLine(model).includes('Testblatt A S. 99'), 'die Stammfundstelle steht nur in der Kopfzeile');

  // Liegt die Verkündung der künftigen Fassung vor, geht ihre Fundstelle vor.
  const withReference = buildNormHeadModel(record, current, {
    origin: getNormOriginInfo(record, [record]),
    nextFutureReference: { publicationSlug: 'ogvbl-2026-972', publicationTitle: 'OGVBl. 2026 Nr. 972', publicationDate: '2026-09-15', publication: 'OGVBl.', issue: '972', entryId: 'x', entryTitle: 'Gesetz', citation: 'Gesetz vom 11. September 2026 (OGVBl. 2026 Nr. 972 S. 2)' },
  });
  assert.equal(withReference.parts.find((part) => part.tone === 'future')?.text, `Änderung zum ${formatShortDate(futureDate)} verkündet (OGVBl. 2026 Nr. 972 S. 2)`);
});
