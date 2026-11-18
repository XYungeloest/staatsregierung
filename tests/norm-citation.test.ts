import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSearchDocument } from '@ostrecht/recht-search/search.ts';
import { buildNormFullCitation, buildNormRecordLookup } from '@ostrecht/shared/lib/norms/citation.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { formatNormType, toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import { NORM_TYPES, type NormRecord } from '@ostrecht/shared/lib/norms/schema.ts';
import { getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';

import { fixtureCorpus, normOfType } from './helpers/fixture-corpus.ts';

/**
 * Vollzitat-Regeln auf dem synthetischen Bestand. Ob jedes Vollzitat des realen Bestands
 * ausgeschrieben ist, prüft scripts/audit-norm-derivations.ts in content:check.
 */
const { norms } = fixtureCorpus();
const lookup = buildNormRecordLookup(norms);
const genericCitationLead =
  /^(?:Gesetz|Verordnung|Verfassung|Staatsvertrag|Verwaltungsabkommen|Verwaltungsvorschrift|Bekanntmachung|Organisationserlass|Dienstanordnung|Anordnung|Richtlinie|Allgemeinverfügung|Übereinkommen|Vereinbarung|Erlass)\s+vom\b/u;

function fixtureNorm(slug: string): NormRecord {
  const record = lookup.get(slug);
  assert.ok(record, slug);
  return record;
}

test('Vollzitate nennen die Vorschrift statt nur die abstrakte Normart – für jeden Normtyp', () => {
  const amendment = fixtureNorm('aenderungsgesetz-testgesetz');
  assert.equal(buildNormFullCitation(amendment, getApplicableVersion(amendment), lookup), 'Gesetz zur Änderung des Testgesetzes vom 23. März 2026 (OGVBl. 2026 Nr. 1 S. 2)');
  for (const type of NORM_TYPES) {
    const norm = normOfType(type);
    const version = { ...norm.versions[0], versionId: `citation-test-${type}`, citation: `${formatNormType(type)} vom 1. Januar 2026 (OGVBl. 2026 Nr. 1 S. 1)` };
    assert.equal(
      buildNormFullCitation(norm, version, lookup),
      `${toDisplayText(getNormVersionIdentity(norm, version).title)} vom 1. Januar 2026 (OGVBl. 2026 Nr. 1 S. 1)`,
      type,
    );
  }
});

test('Vollzitate nennen die letzte Änderung der ausgewählten Fassung mit Artikelbezug und amtlichem Satzbau', () => {
  const law = fixtureNorm('testgesetz');
  assert.equal(buildNormFullCitation(law, law.versions[0], lookup), 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1)', 'die Ausgangsfassung trägt keine Änderungsklausel');
  assert.equal(
    buildNormFullCitation(law, law.versions[1], lookup),
    'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1), das zuletzt durch Artikel 1 des Gesetzes vom 23. März 2026 (OGVBl. 2026 Nr. 1 S. 2) geändert worden ist',
  );
  const budget = fixtureNorm('stichtagsgesetz');
  assert.equal(
    buildNormFullCitation(budget, budget.versions[1], lookup),
    'Sächsisches Haushaltsgesetz vom 10. April 2001 (SächsGVBl. S. 153), das zuletzt durch das Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2) geändert worden ist',
  );
  // Relativpronomen folgt der Bezeichnung: Verordnungen „die“, Verträge „der“.
  const regulation = structuredClone(fixtureNorm('testverordnung'));
  regulation.versions[0].citation = 'Sächsische Testverordnung vom 3. März 2003 (SächsGVBl. S. 9030), zuletzt geändert durch Artikel 2 des Gesetzes vom 23. März 2026 (OGVBl. 2026 Nr. 1 S. 2)';
  regulation.history.entries.push({ date: '2026-03-25', type: 'amendment', title: 'Änderung', citation: 'Gesetz vom 23. März 2026 (OGVBl. 2026 Nr. 1 S. 2)', affectingVersionId: '2023-11-01', relatedNorm: 'aenderungsgesetz-testgesetz' });
  assert.match(buildNormFullCitation(regulation, regulation.versions[0], lookup), /\(SächsGVBl\. S\. 9030\), die zuletzt durch Artikel 2 des Gesetzes vom 23\. März 2026 \(OGVBl\. 2026 Nr\. 1 S\. 2\) geändert worden ist$/u);
});

test('die letzte Änderung wird auch bei unsortierter Historie chronologisch bestimmt', () => {
  const law = structuredClone(fixtureNorm('testgesetz'));
  const secondAmendment = normOfType('aenderungsvorschrift', { title: 'Zweites Gesetz zur Änderung des Testgesetzes', shortTitle: 'Zweites Änderungsgesetz', initialCitation: 'Zweites Gesetz zur Änderung des Testgesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2)' });
  const extendedLookup = new Map([...lookup, [secondAmendment.meta.slug, secondAmendment]]);
  law.versions[1].citation = 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1), zuletzt geändert durch Artikel 2 des Gesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2)';
  law.history.entries = [
    { date: '2026-08-01', type: 'amendment', title: 'Zweite Änderung', citation: 'Gesetz vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2)', affectingVersionId: '2026-03-25', relatedNorm: secondAmendment.meta.slug },
    law.history.entries[1],
  ];
  assert.match(
    buildNormFullCitation(law, law.versions[1], extendedLookup),
    /, das zuletzt durch Artikel 2 des Zweiten Gesetzes zur Änderung des Testgesetzes vom 17\. Juli 2026/u,
  );
});

test('die letzte Änderung folgt der Fundstelle im Zitat der Fassung, auch bei gleichtägigen und früher wirksamen Änderungen', () => {
  const law = structuredClone(fixtureNorm('testgesetz'));
  const sameDay = normOfType('aenderungsvorschrift', { title: 'Zweites Gesetz zur Änderung des Testgesetzes', shortTitle: 'Zweites Änderungsgesetz', initialCitation: 'Zweites Gesetz zur Änderung des Testgesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2)' });
  const laterPublished = normOfType('aenderungsvorschrift', { title: 'Drittes Gesetz zur Änderung des Testgesetzes', shortTitle: 'Drittes Änderungsgesetz', initialCitation: 'Drittes Gesetz zur Änderung des Testgesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 947 S. 2)' });
  sameDay.meta.slug = 'zweites-aenderungsgesetz-testgesetz';
  laterPublished.meta.slug = 'drittes-aenderungsgesetz-testgesetz';
  const extendedLookup = new Map([...lookup, [sameDay.meta.slug, sameDay], [laterPublished.meta.slug, laterPublished]]);
  const third = { ...law.versions[1], versionId: '2026-09-01', validFrom: '2026-09-01', validTo: null };
  law.versions[1] = { ...law.versions[1], validTo: '2026-08-31' };
  law.versions.push(third);
  // Nr. 947 wurde nach Nr. 946 verkündet, aber schon zur Fassung vom 25. März wirksam; die Fassung
  // vom 1. September enthält beide, ihr Zitat nennt Nr. 947 als letzte Änderung.
  law.history.entries.push(
    { date: '2026-03-25', type: 'amendment', title: 'Dritte Änderung', citation: 'Gesetz vom 17. Juli 2026 (OGVBl. 2026 Nr. 947 S. 2)', affectingVersionId: '2026-03-25', relatedNorm: laterPublished.meta.slug },
    { date: '2026-09-01', type: 'amendment', title: 'Zweite Änderung', citation: 'Gesetz vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2)', affectingVersionId: '2026-09-01', relatedNorm: sameDay.meta.slug },
  );
  third.citation = 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1), zuletzt geändert durch Artikel 1 des Gesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 947 S. 2)';
  assert.equal(
    buildNormFullCitation(law, third, extendedLookup),
    'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1), das zuletzt durch Artikel 1 des Dritten Gesetzes zur Änderung des Testgesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 947 S. 2) geändert worden ist',
  );
  // Nennt das Zitat die gleichtägige Änderung, bleibt es bei ihr.
  third.citation = 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1), zuletzt geändert durch Artikel 2 des Gesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2)';
  assert.match(buildNormFullCitation(law, third, extendedLookup), /zuletzt durch Artikel 2 des Zweiten Gesetzes zur Änderung des Testgesetzes vom 17\. Juli 2026 \(OGVBl\. 2026 Nr\. 946 S\. 2\)/u);
  // Eine später wirksame Änderung zählt für eine frühere Fassung nie, auch bei passender Fundstelle.
  law.versions[1].citation = 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1), zuletzt geändert durch Artikel 2 des Gesetzes vom 17. Juli 2026 (OGVBl. 2026 Nr. 946 S. 2)';
  assert.doesNotMatch(buildNormFullCitation(law, law.versions[1], extendedLookup), /Zweiten Gesetzes/u);
});

test('eine Fundstelle ohne Datum wird als Titel plus Fundstelle zitiert', () => {
  const circular = normOfType('verwaltungsvorschrift', { initialCitation: 'Verwaltungsvorschrift (StAnzO. 2026 Nr. 913)' });
  circular.versions[0].citation = 'Verwaltungsvorschrift (StAnzO. 2026 Nr. 913)';
  assert.equal(buildNormFullCitation(circular, circular.versions[0], lookup), `${circular.meta.title} (StAnzO. 2026 Nr. 913)`);
});

test('jede Fassung des Bestands erhält ein ausgeschriebenes Vollzitat, und das Suchdokument trägt dasselbe', () => {
  for (const norm of norms) {
    for (const version of norm.versions) {
      const citation = buildNormFullCitation(norm, version, lookup);
      assert.doesNotMatch(citation, genericCitationLead, `${norm.meta.slug}:${version.versionId}`);
      assert.doesNotMatch(citation, /\\-/u, `${norm.meta.slug}:${version.versionId}`);
      assert.equal(buildSearchDocument(norm, version, lookup).citation, citation, `${norm.meta.slug}:${version.versionId}`);
    }
  }
});
