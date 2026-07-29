import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNormFullCitation,
  buildNormRecordLookup,
} from '../src/lib/norms/citation.ts';
import { loadAllNorms } from '../src/lib/norms/loader.ts';
import { buildSearchIndexPayload } from '../src/lib/norms/search.ts';
import { getApplicableVersion } from '../src/lib/norms/versions.ts';

const genericCitationLead =
  /^(?:Gesetz|Verordnung|Verfassung|Staatsvertrag|Verwaltungsabkommen|Verwaltungsvorschrift|Bekanntmachung|Organisationserlass|Dienstanordnung|Anordnung|Richtlinie|Allgemeinverfügung|Übereinkommen|Vereinbarung|Erlass)\s+vom\b/u;

test('Vollzitate nennen die Vorschrift statt nur die abstrakte Normart', async () => {
  const norms = await loadAllNorms();
  const lookup = buildNormRecordLookup(norms);
  const norm = lookup.get('ostdeutsches-bezirkseinfuehrungsgesetz');

  assert.ok(norm);
  assert.equal(
    buildNormFullCitation(norm, getApplicableVersion(norm), lookup),
    'Gesetz zur Einführung von Bezirken vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–14)',
  );
});

test('Vollzitate verwenden die letzte Änderung der ausgewählten Fassung', async () => {
  const norms = await loadAllNorms();
  const lookup = buildNormRecordLookup(norms);
  const municipality = lookup.get('saechsische-gemeindeordnung');

  assert.ok(municipality);
  const historical = municipality.versions.find((version) => version.versionId === '2026-03-25');
  const current = municipality.versions.find((version) => version.versionId === '2026-08-01');
  assert.ok(historical);
  assert.ok(current);

  assert.match(
    buildNormFullCitation(municipality, historical, lookup),
    /zuletzt geändert durch das Gesetz zur Einführung besonderer Regelungen für die Bundeshauptstadt Berlin .* vom 23\. März 2026 \(OGVBl\. 2026 Nr\. 26 S\. 2\)$/u,
  );
  assert.match(
    buildNormFullCitation(municipality, current, lookup),
    /zuletzt geändert durch das Gesetz zur Neuordnung der Kreise und Bezirke .* vom 20\. Juli 2026 \(OGVBl\. 2026 Nr\. 46 S\. 2\)$/u,
  );
});

test('Artikelbezüge der letzten Änderung bleiben im Vollzitat erhalten', async () => {
  const norms = await loadAllNorms();
  const lookup = buildNormRecordLookup(norms);
  const districts = lookup.get('ostdeutsche-bezirksordnung');

  assert.ok(districts);
  assert.equal(
    buildNormFullCitation(districts, getApplicableVersion(districts), lookup),
    'Ostdeutsche Bezirksordnung vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–13), zuletzt geändert durch Artikel 8 des Gesetzes zur Neuordnung der Sportförderung im Freistaat Ostdeutschland vom 20. Juli 2026 (OGVBl. 2026 Nr. 52 S. 2)',
  );
});

test('alle gespeicherten Fassungen erhalten ein ausgeschriebenes und anzeigefähiges Vollzitat', async () => {
  const norms = await loadAllNorms();
  const lookup = buildNormRecordLookup(norms);

  for (const norm of norms) {
    for (const version of norm.versions) {
      const citation = buildNormFullCitation(norm, version, lookup);
      assert.doesNotMatch(citation, genericCitationLead, `${norm.meta.slug}:${version.versionId}`);
      assert.doesNotMatch(citation, /\\-/u, `${norm.meta.slug}:${version.versionId}`);
    }
  }

  const disputedDate = lookup.get(
    'verwaltungsvorschrift-der-staatsregierung-des-freistaates-ostdeutschland-uber-den-einsatz-von-stroboskoplicht',
  );
  assert.ok(disputedDate);
  assert.equal(
    buildNormFullCitation(disputedDate, getApplicableVersion(disputedDate), lookup),
    `${disputedDate.meta.title} (StAnzO. 2026 Nr. 13)`,
  );
});

test('Rechtssuche gibt das Vollzitat statt der generischen Fundstellenform aus', async () => {
  const payload = await buildSearchIndexPayload();
  const documentEntry = payload.documents.find((entry) =>
    entry.slug === 'ostdeutsches-bezirkseinfuehrungsgesetz'
    && entry.versionKind === 'current',
  );

  assert.ok(documentEntry);
  assert.equal(
    documentEntry.citation,
    'Gesetz zur Einführung von Bezirken vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–14)',
  );
});
