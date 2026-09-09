import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { getNormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';
import { EDITORIAL_REFERENCE_DATE } from '@ostrecht/shared/lib/norms/versions.ts';
import { formatSearchResultLabel } from '@ostrecht/recht-search/search-query.ts';

import { formatShortDate } from '../apps/recht/src/lib/dates.ts';
import { buildNormHeadModel, normKicker, type NormHeadModel } from '../apps/recht/src/lib/norm-head.ts';
import { formatSourceLabel } from '../apps/recht/src/lib/source-labels.ts';
import { referenceDateLabel } from '../apps/recht/src/lib/vocabulary.ts';
import { buildFixtureNorms, FIXTURE_REFERENCE_DATE } from './helpers/fixture-corpus.ts';

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
    citation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)',
    changeNote: versionId,
    body: [],
  };
}

function norm(options: {
  versions: NormVersion[];
  initialVersionId?: string;
  effectiveDate?: string;
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
      initialCitation: 'Gesetz vom 1. Januar 2024 (OGVBl. 2024 Nr. 1)',
      predecessor: null,
      successor: null,
      ...(options.effectiveDate ? { effectiveDate: options.effectiveDate } : {}),
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
