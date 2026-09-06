import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDate } from '@ostrecht/shared/lib/norms/display.ts';
import { EDITORIAL_REFERENCE_DATE } from '@ostrecht/shared/lib/norms/versions.ts';
import { formatSearchResultLabel } from '@ostrecht/recht-search/search-query.ts';

import { normHeaderState, versionHeaderState } from '../apps/recht/src/lib/norm-header.ts';
import { formatSourceLabel } from '../apps/recht/src/lib/source-labels.ts';
import { referenceDateLabel } from '../apps/recht/src/lib/vocabulary.ts';
import { buildFixtureNorms, FIXTURE_REFERENCE_DATE } from './helpers/fixture-corpus.ts';

import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Beschriftungen der Normseite: Statuszeile des Kopfs (Befund E5) und der Wortlaut des
 * redaktionellen Rechtsstands (Befund H1). Die Oberfläche beschreibt die geltende Fassung als
 * „Rechtsstand vom <Datum>“ – eine Aussage, die an jedem Aufruftag zutrifft; „Geltend am“ und
 * das Wort „Stichtag“ kommen außerhalb der Hilfe nicht mehr vor.
 */

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

  const { status } = normHeaderState(record, current);
  assert.equal(status, `Geltende Fassung seit ${formatDate('2026-07-21')} · Vorschrift in Kraft seit ${formatDate('2024-10-15')}`);
  assert.ok(!status.includes('Aktuelle Fassung'));
});

test('ohne belegtes Inkrafttreten trägt die Statuszeile die Stammfassung, bei Gleichheit nur ein Datum', () => {
  const initial = version('2023-11-01', '2023-11-01', '2026-03-24');
  const current = version('2026-03-25', '2026-03-25');
  const withoutEffectiveDate = norm({ versions: [initial, current], initialVersionId: initial.versionId });
  assert.equal(
    normHeaderState(withoutEffectiveDate, current).status,
    `Geltende Fassung seit ${formatDate('2026-03-25')} · Vorschrift in Kraft seit ${formatDate('2023-11-01')}`,
  );

  const single = version('2023-11-01', '2023-11-01');
  const oneVersion = norm({ versions: [single], initialVersionId: single.versionId });
  assert.equal(normHeaderState(oneVersion, single).status, `Geltende Fassung · in Kraft seit ${formatDate('2023-11-01')}`);

  // Ohne Stammfassung und ohne Inkrafttreten behauptet die Zeile kein Datum der Vorschrift.
  const unknown = norm({ versions: [single] });
  assert.equal(normHeaderState(unknown, single).status, `Geltende Fassung · in Kraft seit ${formatDate('2023-11-01')}`);
});

test('der Normkopf ist auf Fassung, Historie und Vergleich derselbe', () => {
  const initial = version('2024-10-15', '2024-10-15', '2026-07-20');
  const current = version('2026-07-21', '2026-07-21');
  const record = norm({ versions: [initial, current], initialVersionId: initial.versionId, effectiveDate: '2024-10-15' });
  const states = [normHeaderState(record, current), normHeaderState(record, current), normHeaderState(record, current)];
  assert.equal(new Set(states.map((entry) => `${entry.eyebrow}|${entry.status}`)).size, 1);

  // Die Einzelfassungsseite nennt zusätzlich das Inkrafttreten der Vorschrift.
  const historical = versionHeaderState(record, initial);
  assert.match(historical.status, /^Historische Fassung · gültig ab /u);
  assert.ok(historical.status.includes(`Vorschrift in Kraft seit ${formatDate('2024-10-15')}`));
  assert.equal(historical.eyebrow, 'Vorschrift');
});

test('kein Normkopf des Fixture-Bestands nennt „Geltend am“ oder das Wort „Stichtag“', () => {
  for (const record of buildFixtureNorms()) {
    for (const entry of record.versions) {
      for (const state of [normHeaderState(record, entry), versionHeaderState(record, entry)]) {
        assert.ok(!/Geltend am|Stichtag/u.test(state.status), `${record.meta.slug}/${entry.versionId}: ${state.status}`);
      }
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
