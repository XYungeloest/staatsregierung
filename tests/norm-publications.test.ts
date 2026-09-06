import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPublicationEntryType } from '@ostrecht/shared/lib/norms/display.ts';
import {
  isCompatiblePublicationEntryType,
  publicationEntryTypeForNormType,
  PUBLICATION_ENTRY_TYPES,
} from '@ostrecht/shared/lib/norms/publications.ts';
import { NORM_TYPES } from '@ostrecht/shared/lib/norms/schema.ts';

import {
  citationLabelMatchesNormType,
  isCompatiblePublicationEntryType as scriptIsCompatible,
  NORM_TYPE_CITATION_LABELS,
  publicationEntryTypeForNormType as scriptEntryType,
  PUBLICATION_ENTRY_TYPES as SCRIPT_PUBLICATION_ENTRY_TYPES,
} from '../scripts/lib/publication-entry-types.mjs';

const PUBLICATIONS = ['OGVBl.', 'OABl.', 'StAnzO.', 'OVertrBl.', 'GMBl.'];

test('der Typ eines Verkündungseintrags folgt dem Typ der verkündeten Norm', () => {
  assert.equal(publicationEntryTypeForNormType('gesetz', { publication: 'OGVBl.' }), 'gesetz');
  assert.equal(publicationEntryTypeForNormType('zustimmungsgesetz', { publication: 'OVertrBl.' }), 'gesetz');
  assert.equal(publicationEntryTypeForNormType('allgemeinverfuegung', { publication: 'OABl.' }), 'allgemeinverfuegung');
  assert.equal(publicationEntryTypeForNormType('foerderrichtlinie', { publication: 'OABl.' }), 'foerderrichtlinie');
  // Änderungsvorschriften tragen den Typ des ändernden Rechtsakts.
  assert.equal(publicationEntryTypeForNormType('aenderungsvorschrift', { publication: 'StAnzO.' }), 'verwaltungsvorschrift');
  assert.equal(publicationEntryTypeForNormType('aenderungsvorschrift', { publication: 'OGVBl.', initialCitation: 'Gesetz vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)' }), 'gesetz');
  assert.equal(publicationEntryTypeForNormType('aenderungsvorschrift', { publication: 'OGVBl.', initialCitation: 'Verordnung vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)' }), 'verordnung');
});

test('jeder abgeleitete Eintragstyp ist zulässig, benannt und mit seinem Normtyp verträglich', () => {
  for (const normType of NORM_TYPES) {
    for (const publication of PUBLICATIONS) {
      const entryType = publicationEntryTypeForNormType(normType, { publication });
      assert.ok(PUBLICATION_ENTRY_TYPES.includes(entryType), `${normType}/${publication}: ${entryType}`);
      assert.ok(formatPublicationEntryType(entryType).length > 0, entryType);
      assert.equal(isCompatiblePublicationEntryType(entryType, normType), true, `${normType}/${publication}`);
    }
  }
});

test('unverträgliche Paare werden erkannt', () => {
  assert.equal(isCompatiblePublicationEntryType('gesetz', 'allgemeinverfuegung'), false);
  assert.equal(isCompatiblePublicationEntryType('verordnung', 'gesetz'), false);
  assert.equal(isCompatiblePublicationEntryType('bekanntmachung', 'berichtigung'), false);
  assert.equal(isCompatiblePublicationEntryType('verwaltungsvorschrift', 'aenderungsvorschrift'), true);
});

test('Werkzeuge und Laufzeit verwenden dieselbe Tabelle', () => {
  assert.deepEqual([...SCRIPT_PUBLICATION_ENTRY_TYPES], [...PUBLICATION_ENTRY_TYPES]);
  for (const normType of NORM_TYPES) {
    assert.ok(NORM_TYPE_CITATION_LABELS[normType], `Zitierbezeichnung fehlt für ${normType}`);
    for (const publication of PUBLICATIONS) {
      const citation = `Verordnung vom 1. Januar 2026 (${publication} 2026 Nr. 1)`;
      assert.equal(
        scriptEntryType(normType, { publication, initialCitation: citation }),
        publicationEntryTypeForNormType(normType, { publication, initialCitation: citation }),
        `${normType}/${publication}`,
      );
    }
    for (const entryType of PUBLICATION_ENTRY_TYPES) {
      assert.equal(
        scriptIsCompatible(entryType, normType),
        isCompatiblePublicationEntryType(entryType, normType),
        `${entryType}/${normType}`,
      );
    }
  }
});

test('die Zitierbezeichnung eines Eintrags muss zum Normtyp passen', () => {
  assert.equal(citationLabelMatchesNormType('Allgemeinverfügung vom 31. Dezember 2025 (OABl. 2025 Nr. 9 S. 2)', 'allgemeinverfuegung'), true);
  assert.equal(citationLabelMatchesNormType('Gesetz vom 31. Dezember 2025 (OABl. 2025 Nr. 9 S. 2)', 'allgemeinverfuegung'), false);
  // Amtliche Sonderformen einer Verwaltungsvorschrift bleiben zulässig.
  for (const label of ['Verwaltungsvorschrift', 'Anordnung', 'Erlass', 'Organisationserlass', 'Dienstanordnung']) {
    assert.equal(citationLabelMatchesNormType(`${label} vom 1. Januar 2026 (StAnzO. 2026 Nr. 1)`, 'verwaltungsvorschrift'), true, label);
  }
  // Einleitende Zusätze der amtlichen Zitierung bleiben zulässig.
  assert.equal(citationLabelMatchesNormType('Geändert durch Abschnitt I der Bekanntmachung vom 1. Januar 2026 (StAnzO. 2026 Nr. 1)', 'bekanntmachung'), true);
  assert.equal(citationLabelMatchesNormType('Richtlinie vom 1. Januar 2026 (OABl. 2026 Nr. 1)', 'foerderrichtlinie'), true);
});
