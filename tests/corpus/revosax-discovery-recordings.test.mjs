import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { SEARCH_URL, ALL_CATEGORIES, extractResultPage } from '../../scripts/lib/revosax-discovery.mjs';

/**
 * Erkennung auf unveränderten Mitschnitten realer REVOSax-Seiten (tests/fixtures/revosax/).
 * Die Mitschnitte nennen reale Vorschriften; deshalb laufen diese Prüfungen als Korpus-Tests.
 * Die Discovery-Logik selbst prüft tests/revosax-discovery.test.mjs auf synthetischen Seiten.
 */
const fixture = (name) => readFile(new URL(`../fixtures/revosax/${name}`, import.meta.url), 'utf8');

test('Trefferseite 1: Trefferzahl, Pagination, Treffer, Typfacette und Parameterecho', async () => {
  const page = extractResultPage(await fixture('suche-seite-1.html'), SEARCH_URL);
  assert.equal(page.reportedCount, 5092);
  assert.equal(page.currentPage, 1);
  assert.equal(page.pageCount, 1019);
  assert.equal(page.hits.length, 5);
  assert.deepEqual(page.echo, { types: ALL_CATEGORIES, envelopes: true, validDay: '01.11.2023' });
  assert.equal(page.typeFacet['Änderungsgesetz'], 1490);
  assert.equal(page.typeFacet.Gesetz, 264);
  assert.equal(Object.keys(page.typeFacet).length, 10);

  const amendment = page.hits[0];
  assert.equal(amendment.url, 'https://www.revosax.sachsen.de/vorschrift/20247-VO-Anpassungen-in-der-Lehrkraefteaus-und-weiterbildung');
  assert.equal(amendment.lawId, '20247');
  assert.equal(amendment.versionSuffix, null);
  assert.equal(amendment.urlKind, 'dynamic');
  assert.equal(amendment.label, 'VO Anpassungen in der Lehrkräfteaus- und -weiterbildung');
  assert.equal(amendment.title, 'Verordnung des Sächsischen Staatsministeriums für Kultus zu Anpassungen in der Lehrkräfteaus- und -weiterbildung');
  assert.equal(amendment.citation, 'SächsGVBl. 2023 Nr. 18 S. 822');
  assert.equal(amendment.documentType, 'Änderungsverordnung');
  assert.equal(amendment.category, 'ÄVO');
  assert.equal(amendment.normType, 'aenderungsvorschrift');
  assert.equal(amendment.fsnNumber, '1.104A');
  assert.equal(amendment.documentDate, '2023-10-11');
  assert.equal(amendment.validFrom, '2023-10-31');
  assert.equal(amendment.validTo, null);
  assert.match(amendment.context, /Fassung gültig ab: 31\. Oktober 2023/u);

  const historical = page.hits[2];
  assert.equal(historical.url, 'https://www.revosax.sachsen.de/vorschrift/20250.1');
  assert.equal(historical.versionSuffix, '1');
  assert.equal(historical.urlKind, 'version');
  assert.equal(historical.label, 'Sächsische Kommunalpauschalenverordnung');
  assert.equal(historical.category, 'VO');
  assert.equal(historical.normType, 'verordnung');
  assert.equal(historical.fsnNumber, '24.1/3');
  assert.equal(historical.documentDate, '2023-09-27');

  const consentAmendment = page.hits[4];
  assert.equal(consentAmendment.lawId, '20242');
  assert.equal(consentAmendment.documentType, 'Änderungszustimmungsgesetz');
  assert.equal(consentAmendment.category, 'ÄZuG');
  assert.equal(consentAmendment.normType, 'aenderungsvorschrift');
});

test('Trefferseite 2 liefert Session-Pagination und historische Fassungs-URLs', async () => {
  const page = extractResultPage(await fixture('suche-seite-2.html'), `${SEARCH_URL}?seite=2`);
  assert.equal(page.currentPage, 2);
  assert.equal(page.pageCount, 1019);
  assert.equal(page.reportedCount, 5092);
  const hit = page.hits.find((entry) => entry.lawId === '18648');
  assert.equal(hit.url, 'https://www.revosax.sachsen.de/vorschrift/18648.3');
  assert.equal(hit.versionSuffix, '3');
  assert.equal(hit.urlKind, 'version');
  assert.equal(hit.label, 'Lehrer-Qualifizierungsverordnung');
  assert.equal(hit.citation, 'SächsGVBl. 2020 Nr. 7 S. 125');
  assert.equal(hit.documentDate, '2020-03-26');
  assert.equal(hit.validFrom, '2023-10-31');
  assert.deepEqual(page.hits.map((entry) => entry.category), ['VO', 'VO', 'VwV', 'FRL', 'ÄFRL']);
});

test('Fassungsmenü liefert konkrete Fassungskennungen samt Gültigkeitszeiträumen', async () => {
  const { extractActiveVersion, extractVersionLinks } = await import('../../scripts/lib/revosax-discovery.mjs');
  const html = await fixture('vorschrift-20250.1-menu.html');
  const versions = extractVersionLinks(html, 'https://www.revosax.sachsen.de/vorschrift/20250.1');
  assert.deepEqual(versions.map((version) => [version.versionSuffix, version.validFrom, version.validTo, version.active]), [
    ['1', '2023-10-31', '2024-08-16', true],
    ['2', '2024-08-17', '2024-09-17', false],
    ['3', '2024-09-18', null, false],
  ]);
  assert.equal(versions[0].url, 'https://www.revosax.sachsen.de/vorschrift/20250.1');
  assert.equal(extractActiveVersion(html).url, 'https://www.revosax.sachsen.de/vorschrift/20250.1');
  assert.equal(extractActiveVersion('<html><body><a class="law_version_link" href="/vorschrift/1.1">x</a></body></html>'), null);
});
