import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ALL_CATEGORIES,
  AMENDMENT_CATEGORIES,
  CookieJar,
  DOCUMENT_TYPE_CATEGORIES,
  RevosaxDiscoveryError,
  RevosaxHttpError,
  SEARCH_FORM_URL,
  SEARCH_URL,
  STEM_CATEGORIES,
  buildManifest,
  buildResultPageUrl,
  buildSearchRequest,
  buildSearchUrl,
  describeHttpFailure,
  discoverBaseline,
  extractResultPage,
  inspectSearchForm,
  requestWithRetry,
  verifyDiscovery,
  verifySearchEcho,
} from '../scripts/lib/revosax-discovery.mjs';

const fixture = (name) => readFile(new URL(`./fixtures/revosax/${name}`, import.meta.url), 'utf8');

const RAILS_422 = '<!doctype html><html lang="en"><head><title>The change you wanted was rejected (422 Unprocessable Entity)</title><style>body{margin:0}</style></head><body><main><h1>The change you wanted was rejected.</h1><p>Maybe you tried to change something you didn\'t have access to.</p></main><script>console.log("x")</script></body></html>';

function hitHtml({
  lawId,
  version = null,
  slug = 'Vorschrift',
  label,
  title,
  citation = 'SächsGVBl. 2023 Nr. 1 S. 1',
  type = 'Gesetz',
  fsn = null,
  documentDate = '11. Oktober 2023',
  validFrom = '31. Oktober 2023',
  validTo = null,
}) {
  const href = version ? `/vorschrift/${lawId}.${version}` : `/vorschrift/${lawId}-${slug}`;
  return `<div class="result_hit">
<p class="einzug">
<a href="${href}"><img width="16" height="12" alt="" src="/assets/symbole/x.gif" />${label}</a>
</p>
<div class="score"><div class="value" style="width: 0%;"></div></div>
<p>
${title}
<br>
${citation}
<br>
Vorschriftentyp: ${type}
${fsn ? `<span class="fsn-nr">Fsn-Nr.: ${fsn}</span>` : ''}
<br>
Erlassdatum: ${documentDate}
<br>
Fassung gültig ab: ${validFrom}
${validTo ? `<br>\nFassung gültig bis: ${validTo}` : ''}
</p>
</div>`;
}

function resultPage({
  count,
  page,
  pageCount,
  hits,
  types = ALL_CATEGORIES,
  envelopes = true,
  validDay = '01.11.2023',
  facet = {},
}) {
  const facetItems = Object.entries(facet).map(([name, number]) =>
    `<li><div class="flex_row_space_between"><form class="button_to" method="post" action="/suche"><button class="search_agg_link flex_row_space_between" data-turbo="false" title="${name}" type="submit"><div class="name truncate">${name}</div><div class="txt_right">(${number})</div></button><input type="hidden" name="authenticity_token" value="FIXTURE-TOKEN" autocomplete="off" /></form></div></li>`,
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="de-DE"><head><title>REVOSax Landesrecht Sachsen Trefferliste</title></head><body>
<div class="" id="content">
<div class="titel"><h1>Trefferliste</h1></div>
<div class="line">Sie haben eine erweiterte Suche mit folgenden Parametern durchgeführt:</div>
<div class="line">
<span class="pright_m nowrap"><span class="pright_s">Typ:</span><strong>${types.join(', ')}</strong></span>
${envelopes ? '<span class="pright_m nowrap"><span class="pright_s"></span><strong>zugleich Mantelvorschrift</strong></span>' : ''}
<span class="pright_m nowrap"><span class="pright_s">Geltungstag:</span><strong>${validDay}</strong></span>
</div>
<div class="block" id="listeohne">
<h2>${count} Treffer</h2>
<div class="suchergebnis search_result">
${hits.map(hitHtml).join('\n')}
</div>
</div>
${pageCount > 0 ? `<div class="block pager" id="blaettern"><div class="ergebnisse"><span class="aktuell">Seite ${page} von ${pageCount}</span>
<div class="forward"><form class="button_to" method="post" action="/suche?seite=${page + 1}"><button class="page_btn" data-turbo="false" type="submit">nächste</button><input type="hidden" name="authenticity_token" value="FIXTURE-TOKEN" autocomplete="off" /></form></div></div></div>` : ''}
</div>
<div id="quickbar"><h2>Filter</h2><div class="box"><h3>Typ</h3><ul class="revo_bucketliste">${facetItems}</ul></div></div>
</body></html>`;
}

const SESSION_COOKIE = '_web_esbuild_session=abc123';

function fakeSite({ formHtml, pages, sessionCookie = SESSION_COOKIE, setCookie = true, pageOverride = () => null }) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const requested = new URL(String(url));
    calls.push({ url: requested.toString(), method: init.method ?? 'GET', cookie: init.headers?.cookie ?? null });
    const headers = { 'content-type': 'text/html; charset=utf-8', ...(setCookie ? { 'set-cookie': `${sessionCookie}; path=/; HttpOnly; SameSite=Lax` } : {}) };
    if (requested.pathname === '/vorschriftensuche') return new Response(formHtml, { status: 200, headers });
    if (requested.pathname === '/suche') {
      const page = requested.searchParams.has('search_request') ? 1 : Number(requested.searchParams.get('seite'));
      if (page > 1 && init.headers?.cookie !== sessionCookie) {
        return new Response('<html><head><title>REVOSax Landesrecht Sachsen Erweiterte Suche</title></head><body>Keine Suche in der Session</body></html>', { status: 200, headers });
      }
      const html = pageOverride(page) ?? pages[page - 1];
      if (!html) return new Response('<html><body>Seite fehlt</body></html>', { status: 404, headers });
      return new Response(html, { status: 200, headers });
    }
    return new Response('nicht gefunden', { status: 404, headers });
  };
  return { fetchImpl, calls };
}

const SAMPLE_HITS = [
  { lawId: '3000', label: 'Testgesetz', title: 'Gesetz über den Test', type: 'Gesetz', fsn: '1.1' },
  { lawId: '1000', label: 'ÄndG Test', title: 'Gesetz zur Änderung des Testgesetzes', type: 'Änderungsgesetz' },
  { lawId: '2000', version: '2', label: 'TestVO', title: 'Verordnung über den Test', type: 'Verordnung', validTo: '30. Juni 2024' },
  { lawId: '4000', label: 'ÄndVO Test', title: 'Verordnung zur Änderung der TestVO', type: 'Änderungsverordnung' },
  { lawId: '500', label: 'TestStV', title: 'Staatsvertrag über den Test', type: 'Staatsvertrag' },
];

const SAMPLE_FACET = { Gesetz: 1, Änderungsgesetz: 1, Verordnung: 1, Änderungsverordnung: 1, Staatsvertrag: 1 };

function samplePages({ count = 5, facet = SAMPLE_FACET } = {}) {
  return [
    resultPage({ count, page: 1, pageCount: 3, hits: SAMPLE_HITS.slice(0, 2), facet }),
    resultPage({ count, page: 2, pageCount: 3, hits: SAMPLE_HITS.slice(2, 4), facet }),
    resultPage({ count, page: 3, pageCount: 3, hits: SAMPLE_HITS.slice(4), facet }),
  ];
}

test('REVOSax-Suchformular wird strukturell erkannt; Änderungstypen sind standardmäßig aus', async () => {
  const form = inspectSearchForm(await fixture('vorschriftensuche.html'));
  assert.equal(form.action, SEARCH_URL);
  assert.equal(form.method, 'POST');
  assert.equal(form.mode, 'fullsearch');
  assert.deepEqual(form.categories, ALL_CATEGORIES);
  assert.deepEqual(form.defaultCategories, STEM_CATEGORIES);
  assert.equal(form.validDayField, 'search_request[valid_day_de]');
  assert.equal(form.envelopesField, 'search_request[include_envelopes]');
  assert.equal(form.envelopesDefault, true);
  assert.equal(form.hasAuthenticityToken, true);
});

test('fehlende oder unbekannte Vorschriftentypen im Formular blockieren die Discovery', async () => {
  const html = await fixture('vorschriftensuche.html');
  const withoutAmendmentLaws = html.replace(/<input id="categories_aeg"[^>]*>/u, '');
  assert.throws(() => inspectSearchForm(withoutAmendmentLaws), (error) =>
    error instanceof RevosaxDiscoveryError && /Vorschriftentypen fehlen im Formular: ÄG/u.test(error.message));

  const withUnknownType = html.replace(
    '<input id="categories_aezug"',
    '<input type="checkbox" value="NEU" name="search_request[categories][]" id="categories_neu" /><input id="categories_aezug"',
  );
  assert.throws(() => inspectSearchForm(withUnknownType), /unbekannte Vorschriftentypen im Formular: NEU/u);
  assert.throws(() => inspectSearchForm('<html><body><form action="/suche"></form></body></html>'), /search_request\[mode\]/u);
});

test('search_request entspricht dem realen REVOSax-JSON und wird URL-kodiert übertragen', () => {
  const request = buildSearchRequest('2023-11-01', ALL_CATEGORIES);
  assert.deepEqual(request, {
    valid_day: '2023-11-01',
    categories: ['G', 'ÄG', 'VO', 'ÄVO', 'VwV', 'ÄVwV', 'FRL', 'ÄFRL', 'StV', 'ÄStV', 'ZuG', 'ÄZuG'],
    include_envelopes: '1',
    mode: 'fullsearch',
  });
  const url = new URL(buildSearchUrl(request));
  assert.equal(url.origin + url.pathname, SEARCH_URL);
  assert.deepEqual(JSON.parse(url.searchParams.get('search_request')), request);
  assert.equal(buildResultPageUrl(2), `${SEARCH_URL}?seite=2`);
  assert.equal(buildSearchRequest('2023-11-01', ALL_CATEGORIES, { includeEnvelopes: false }).include_envelopes, '0');
  assert.throws(() => buildSearchRequest('2023-13-01', ALL_CATEGORIES), /Ungültiger --date-Wert/u);
  assert.throws(() => buildSearchRequest('01.11.2023', ALL_CATEGORIES), /YYYY-MM-DD/u);
  assert.throws(() => buildSearchRequest('2023-11-01', []), /categories/u);
  assert.throws(() => buildResultPageUrl(0), /Ergebnisseite/u);
});

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

test('Änderungstypen bleiben eigene Kategorien und werden als Änderungsvorschrift klassifiziert', () => {
  for (const [label, entry] of Object.entries(DOCUMENT_TYPE_CATEGORIES)) {
    if (label.startsWith('Änderung')) {
      assert.equal(entry.normType, 'aenderungsvorschrift', label);
      assert.ok(AMENDMENT_CATEGORIES.includes(entry.category), label);
    } else {
      assert.notEqual(entry.normType, 'aenderungsvorschrift', label);
      assert.ok(STEM_CATEGORIES.includes(entry.category), label);
    }
  }
  assert.deepEqual(
    [...new Set(Object.values(DOCUMENT_TYPE_CATEGORIES).map((entry) => entry.category))].sort(),
    [...ALL_CATEGORIES].sort(),
  );
});

test('Parameterecho der Trefferseite muss der Anfrage entsprechen', () => {
  const echo = { types: ALL_CATEGORIES, envelopes: true, validDay: '01.11.2023' };
  verifySearchEcho(echo, { date: '2023-11-01', categories: ALL_CATEGORIES });
  assert.throws(() => verifySearchEcho({ ...echo, envelopes: false }, { date: '2023-11-01', categories: ALL_CATEGORIES }), /Mantelvorschriften/u);
  assert.throws(() => verifySearchEcho({ ...echo, validDay: '01.12.2023' }, { date: '2023-11-01', categories: ALL_CATEGORIES }), /Geltungstag 01\.12\.2023 bestätigt statt 01\.11\.2023/u);
  assert.throws(() => verifySearchEcho({ ...echo, types: STEM_CATEGORIES }, { date: '2023-11-01', categories: ALL_CATEGORIES }), /bestätigt Typen/u);
});

test('verifyDiscovery ist fail-closed bei Count-Mismatch, Duplikaten, Facetten und Typen', async () => {
  const hits = [
    ...extractResultPage(await fixture('suche-seite-1.html')).hits,
    ...extractResultPage(await fixture('suche-seite-2.html')).hits,
  ];
  const facet = { Verordnung: 3, Änderungsverordnung: 3, Verwaltungsvorschrift: 1, Förderrichtlinie: 1, Änderungsförderrichtlinie: 1, Änderungszustimmungsgesetz: 1 };
  const consistent = { reportedCount: 10, pageCount: 2, hitsPerPage: 5, pagesVisited: 2, hits, typeFacet: facet };
  verifyDiscovery(consistent);

  assert.throws(() => verifyDiscovery({ ...consistent, reportedCount: 11 }), /meldet 11 Treffer, der Crawler hat aber 10 eindeutige/u);
  assert.throws(() => verifyDiscovery({ ...consistent, hits: [...hits, hits[0]], reportedCount: 11 }), /nicht vereinigte Duplikat-URL/u);
  // Zwei Fassungen derselben lawId sind ein realer REVOSax-Zustand und kein Zählfehler.
  verifyDiscovery({
    ...consistent,
    hits: [...hits, { ...hits[1], url: 'https://www.revosax.sachsen.de/vorschrift/20249.1', versionSuffix: '1' }],
    reportedCount: 11,
    pageCount: 3,
    pagesVisited: 3,
    typeFacet: { ...facet, Änderungsverordnung: 4 },
  });
  assert.throws(() => verifyDiscovery({ ...consistent, typeFacet: { ...facet, Verordnung: 4 } }), /Typfacette „Verordnung“ meldet 4, gefunden wurden 3/u);
  assert.throws(() => verifyDiscovery({ ...consistent, pagesVisited: 1 }), /1 von 2 Ergebnisseiten/u);
  assert.throws(() => verifyDiscovery({ ...consistent, pageCount: 3, pagesVisited: 3 }), /passen nicht zu 3 Seiten/u);
  assert.throws(() => verifyDiscovery({ ...consistent, hits: [], reportedCount: 0 }), /keine Treffer/u);
  assert.throws(
    () => verifyDiscovery({ ...consistent, hits: hits.map((hit, index) => (index === 0 ? { ...hit, documentType: 'Satzung', category: null, normType: null } : hit)), typeFacet: {} }),
    /unbekannte Vorschriftentypen in der Trefferliste: Satzung/u,
  );
  assert.throws(
    () => verifyDiscovery({ ...consistent, hits: hits.map((hit, index) => (index === 0 ? { ...hit, validFrom: null } : hit)), typeFacet: {} }),
    /ohne „Fassung gültig ab“/u,
  );
});

test('HTTP-Fehler nennen Status, Methode, finale URL und einen begrenzten Antwortauszug', async () => {
  const fetchImpl = async () => new Response(RAILS_422, { status: 422, headers: { 'set-cookie': 'secret_session=geheim; HttpOnly' } });
  await assert.rejects(
    requestWithRetry(SEARCH_URL, { fetchImpl, method: 'POST', body: 'x=1', headers: { authorization: 'Bearer geheim' }, sleep: async () => {} }),
    (error) => {
      assert.ok(error instanceof RevosaxHttpError);
      assert.equal(error.status, 422);
      assert.match(error.message, /^HTTP 422 bei POST https:\/\/www\.revosax\.sachsen\.de\/suche/u);
      assert.match(error.message, /The change you wanted was rejected/u);
      assert.doesNotMatch(error.message, /console\.log|margin:0|geheim|cookie|authorization/iu);
      return true;
    },
  );
  const longBody = `<html><body>${'Fehlertext '.repeat(100)}</body></html>`;
  const description = describeHttpFailure({ status: 404, method: 'GET', url: SEARCH_URL, body: longBody });
  assert.ok(description.length < 420, description.length);
  assert.match(description, /…$/u);
});

test('429 und 5xx werden mit Backoff wiederholt, Retry-After wird beachtet', async () => {
  const responses = [
    () => new Response('busy', { status: 503 }),
    () => new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }),
    () => new Response('<html><body>ok</body></html>', { status: 200 }),
  ];
  const sleeps = [];
  const result = await requestWithRetry(SEARCH_URL, {
    fetchImpl: async () => responses.shift()(),
    sleep: async (ms) => sleeps.push(ms),
  });
  assert.equal(result.status, 200);
  assert.deepEqual(sleeps, [1000, 2000]);

  const exhausted = [];
  await assert.rejects(
    requestWithRetry(SEARCH_URL, { fetchImpl: async () => new Response('down', { status: 503 }), retries: 2, sleep: async (ms) => exhausted.push(ms) }),
    (error) => error instanceof RevosaxHttpError && error.status === 503,
  );
  assert.deepEqual(exhausted, [1000, 2000]);
});

test('CookieJar hält die REVOSax-Session ohne sie zu protokollieren', () => {
  const jar = new CookieJar();
  jar.absorb(new Headers([['set-cookie', '_web_esbuild_session=erste; path=/; HttpOnly'], ['set-cookie', 'other=1; path=/']]));
  assert.equal(jar.header(), '_web_esbuild_session=erste; other=1');
  jar.absorb(new Headers([['set-cookie', '_web_esbuild_session=zweite; path=/']]));
  assert.equal(jar.header(), '_web_esbuild_session=zweite; other=1');
  assert.equal(jar.size, 2);
});

test('discoverBaseline crawlt alle Seiten mit Session-Cookie und erzeugt ein deterministisches Manifest', async () => {
  const formHtml = await fixture('vorschriftensuche.html');
  const site = fakeSite({ formHtml, pages: samplePages() });
  const manifest = await discoverBaseline({
    date: '2023-11-01',
    fetchImpl: site.fetchImpl,
    sleep: async () => {},
    now: () => new Date('2026-09-03T10:00:00Z'),
  });

  assert.deepEqual(site.calls.map((call) => call.method), ['GET', 'GET', 'GET', 'GET']);
  assert.equal(site.calls[0].url, SEARCH_FORM_URL);
  const searchCall = new URL(site.calls[1].url);
  assert.equal(searchCall.pathname, '/suche');
  assert.deepEqual(JSON.parse(searchCall.searchParams.get('search_request')), {
    valid_day: '2023-11-01',
    categories: ALL_CATEGORIES,
    include_envelopes: '1',
    mode: 'fullsearch',
  });
  assert.equal(site.calls[2].url, `${SEARCH_URL}?seite=2`);
  assert.equal(site.calls[2].cookie, SESSION_COOKIE);
  assert.equal(site.calls[3].url, `${SEARCH_URL}?seite=3`);

  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.query.geltungstag, '2023-11-01');
  assert.deepEqual(manifest.query.includeTypes, ALL_CATEGORIES);
  assert.equal(manifest.query.includeEnvelopes, true);
  assert.equal(manifest.reportedCount, 5);
  assert.equal(manifest.discoveredCount, 5);
  assert.equal(manifest.pageCount, 3);
  assert.equal(manifest.hitsPerPage, 2);
  assert.deepEqual(manifest.hits.map((hit) => hit.lawId), ['500', '1000', '2000', '3000', '4000']);
  assert.deepEqual(manifest.categoryCounts, { G: 1, ÄG: 1, VO: 1, ÄVO: 1, VwV: 0, ÄVwV: 0, FRL: 0, ÄFRL: 0, StV: 1, ÄStV: 0, ZuG: 0, ÄZuG: 0 });
  assert.equal(manifest.typeCounts.Staatsvertrag, 1);
  const historical = manifest.hits.find((hit) => hit.lawId === '2000');
  assert.equal(historical.url, 'https://www.revosax.sachsen.de/vorschrift/2000.2');
  assert.equal(historical.validTo, '2024-06-30');
  assert.equal(manifest.discoveredAt, '2026-09-03T10:00:00.000Z');

  const second = await discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: samplePages() }).fetchImpl, sleep: async () => {}, now: () => new Date('2026-09-03T11:00:00Z') });
  assert.deepEqual({ ...second, discoveredAt: null }, { ...manifest, discoveredAt: null });
});

test('Count-Mismatch, Session-Verlust und leere Suchen verhindern das Manifest', async () => {
  const formHtml = await fixture('vorschriftensuche.html');
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: samplePages({ count: 6 }) }).fetchImpl, sleep: async () => {} }),
    /meldet 6 Treffer, der Crawler hat aber 5 eindeutige/u,
  );
  const [firstPage] = samplePages();
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: samplePages(), pageOverride: (page) => (page === 2 ? firstPage : null) }).fetchImpl, sleep: async () => {} }),
    /Seite 2 angefordert, REVOSax lieferte 1/u,
  );
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: samplePages(), setCookie: false }).fetchImpl, sleep: async () => {} }),
    (error) => error instanceof RevosaxDiscoveryError && /keine Trefferliste geliefert/u.test(error.message),
  );
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: [resultPage({ count: 0, page: 0, pageCount: 0, hits: [] })] }).fetchImpl, sleep: async () => {} }),
    /meldet 0 Treffer/u,
  );
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: samplePages({ facet: { ...SAMPLE_FACET, Gesetz: 2 } }) }).fetchImpl, sleep: async () => {} }),
    /Typfacette „Gesetz“ meldet 2, gefunden wurden 1/u,
  );
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: samplePages().map((page) => page.replace('zugleich Mantelvorschrift', 'ohne Mantel')) }).fetchImpl, sleep: async () => {} }),
    /Mantelvorschriften/u,
  );
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: samplePages() }).fetchImpl, sleep: async () => {}, maxPages: 2 }),
    /--max-pages 2/u,
  );
});

test('buildManifest sortiert deterministisch nach lawId und dokumentiert Mehrfachfassungen', () => {
  const searchRequest = buildSearchRequest('2023-11-01', ALL_CATEGORIES);
  const hits = [
    { url: 'https://www.revosax.sachsen.de/vorschrift/10-b', lawId: '10', versionSuffix: null, category: 'G', documentType: 'Gesetz' },
    { url: 'https://www.revosax.sachsen.de/vorschrift/9.3', lawId: '9', versionSuffix: '3', category: 'VO', documentType: 'Verordnung' },
    { url: 'https://www.revosax.sachsen.de/vorschrift/9.12', lawId: '9', versionSuffix: '12', category: 'VO', documentType: 'Verordnung' },
  ];
  const manifest = buildManifest({ date: '2023-11-01', searchRequest, searchUrl: buildSearchUrl(searchRequest), hits, reportedCount: 3, pageCount: 1, hitsPerPage: 5, typeFacet: {}, passes: [{ pass: 1, pagesVisited: 1, newHits: 3, repeatedHits: 0, uniqueTotal: 3 }] });
  assert.deepEqual(manifest.hits.map((hit) => hit.url.split('/').at(-1)), ['9.3', '9.12', '10-b']);
  assert.equal(manifest.categoryCounts.VO, 2);
  assert.equal(manifest.lawIdCount, 2);
  assert.deepEqual(manifest.multiVersionLawIds, { 9: ['https://www.revosax.sachsen.de/vorschrift/9.12', 'https://www.revosax.sachsen.de/vorschrift/9.3'] });
  assert.deepEqual(manifest.hits[0].alternativeVersionUrls, ['https://www.revosax.sachsen.de/vorschrift/9.12']);
  assert.equal(manifest.hits[2].alternativeVersionUrls, undefined);
  assert.equal(manifest.passes.length, 1);
});

test('instabile Pagination wird durch weitere Durchläufe fail-closed vervollständigt', async () => {
  const formHtml = await fixture('vorschriftensuche.html');
  const facet = SAMPLE_FACET;
  // Durchlauf 1: Seite 2 wiederholt den ersten Treffer von Seite 1 und lässt lawId 2000 aus.
  const unstablePage2 = resultPage({ count: 5, page: 2, pageCount: 3, hits: [SAMPLE_HITS[0], SAMPLE_HITS[3]], facet });
  let requestsForPage2 = 0;
  const site = fakeSite({
    formHtml,
    pages: samplePages(),
    pageOverride: (page) => {
      if (page !== 2) return null;
      requestsForPage2 += 1;
      return requestsForPage2 === 1 ? unstablePage2 : null;
    },
  });
  const manifest = await discoverBaseline({ date: '2023-11-01', fetchImpl: site.fetchImpl, sleep: async () => {} });
  assert.equal(manifest.discoveredCount, 5);
  assert.deepEqual(manifest.hits.map((hit) => hit.lawId), ['500', '1000', '2000', '3000', '4000']);
  assert.equal(manifest.passes.length, 2);
  assert.equal(manifest.passes[0].repeatedHits, 1);
  assert.equal(manifest.passes[0].uniqueTotal, 4);
  assert.equal(manifest.passes[1].newHits, 1);
  assert.equal(manifest.passes[1].uniqueTotal, 5);
  // Der zweite Durchlauf endet, sobald der Bestand vollständig ist.
  assert.ok(manifest.passes[1].pagesVisited <= 3);

  let secondRequestsForPage2 = 0;
  const single = fakeSite({
    formHtml,
    pages: samplePages(),
    pageOverride: (page) => {
      if (page !== 2) return null;
      secondRequestsForPage2 += 1;
      return secondRequestsForPage2 === 1 ? unstablePage2 : null;
    },
  });
  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: single.fetchImpl, sleep: async () => {}, maxPasses: 1 }),
    (error) => {
      assert.match(error.message, /4 eindeutige Links und 1 Duplikatzeile\(n\) sind erst nach zwei übereinstimmenden vollständigen Durchläufen belastbar/u);
      assert.equal(error.details.hits.length, 4);
      assert.equal(error.details.passes.length, 1);
      return true;
    },
  );
});

test('Fassungsmenü liefert konkrete Fassungskennungen samt Gültigkeitszeiträumen', async () => {
  const { extractActiveVersion, extractVersionLinks } = await import('../scripts/lib/revosax-discovery.mjs');
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

test('reproduzierbare REVOSax-Duplikatzeilen werden nach zwei identischen Durchläufen akzeptiert', async () => {
  const formHtml = await fixture('vorschriftensuche.html');
  // REVOSax listet lawId 3000 auf Seite 1 und erneut auf Seite 3; die gemeldete Zahl zählt beide Zeilen.
  const pages = [
    resultPage({ count: 6, page: 1, pageCount: 3, hits: SAMPLE_HITS.slice(0, 2), facet: SAMPLE_FACET }),
    resultPage({ count: 6, page: 2, pageCount: 3, hits: SAMPLE_HITS.slice(2, 4), facet: SAMPLE_FACET }),
    resultPage({ count: 6, page: 3, pageCount: 3, hits: [SAMPLE_HITS[4], SAMPLE_HITS[0]], facet: SAMPLE_FACET }),
  ];
  const site = fakeSite({ formHtml, pages });
  const manifest = await discoverBaseline({ date: '2023-11-01', fetchImpl: site.fetchImpl, sleep: async () => {} });
  assert.equal(manifest.reportedCount, 6);
  assert.equal(manifest.discoveredCount, 5);
  assert.deepEqual(manifest.duplicateListings, [{ url: 'https://www.revosax.sachsen.de/vorschrift/3000-Vorschrift', occurrences: 2 }]);
  assert.equal(manifest.passes.length, 2);
  assert.deepEqual(manifest.passes.map((pass) => [pass.rows, pass.newHits, pass.duplicateUrls.length]), [[6, 5, 1], [6, 0, 1]]);
  assert.equal(manifest.typeCountBasis, 'unique');

  await assert.rejects(
    discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages }).fetchImpl, sleep: async () => {}, maxPasses: 1 }),
    /erst nach zwei übereinstimmenden vollständigen Durchläufen/u,
  );

  // Facette zählt Zeilen statt eindeutiger Vorschriften: ebenfalls konsistent akzeptiert.
  const rowFacetPages = pages.map((page) => page.replace('<div class="txt_right">(1)</div></button><input type="hidden" name="authenticity_token" value="FIXTURE-TOKEN" autocomplete="off" /></form></div></li>', '<div class="txt_right">(2)</div></button><input type="hidden" name="authenticity_token" value="FIXTURE-TOKEN" autocomplete="off" /></form></div></li>'));
  const rowManifest = await discoverBaseline({ date: '2023-11-01', fetchImpl: fakeSite({ formHtml, pages: rowFacetPages }).fetchImpl, sleep: async () => {} });
  assert.equal(rowManifest.typeCountBasis, 'rows');
});

test('Bestandteile von Mantelvorschriften ohne eigenen Lesetext werden erkannt', async () => {
  const { detectEnvelopeComponent } = await import('../scripts/lib/revosax-discovery.mjs');
  const component = '<html><body><div id="content"><div class="law_show"><h1>Änderung des Testgesetzes</h1><p>Vollzitat: Änderung des Testgesetzes vom 5. Mai 2004 (SächsGVBl. S. 148, 171)</p> Bestandteil der Vorschrift <a href="/vorschrift/1228-Testmodernisierungsgesetz#a44">Testmodernisierungsgesetz</a></div></div></body></html>';
  assert.deepEqual(detectEnvelopeComponent(component, 'https://www.revosax.sachsen.de/vorschrift/1003'), {
    envelopeLawId: '1228',
    envelopeUrl: 'https://www.revosax.sachsen.de/vorschrift/1228-Testmodernisierungsgesetz#a44',
    envelopeTitle: 'Testmodernisierungsgesetz',
    envelopeAnchor: 'a44',
  });
  const regular = '<html><body><div id="content"><div class="law_show"><h1>Testgesetz</h1><article id="lesetext"><div class="sections"></div></article> Bestandteil der Vorschrift <a href="/vorschrift/1">x</a></div></div></body></html>';
  assert.equal(detectEnvelopeComponent(regular), null);
  assert.equal(detectEnvelopeComponent('<html><body><div class="law_show"><h1>x</h1></div></body></html>'), null);
});

test('Anlagenverweise im Lesetext werden gesammelt', async () => {
  const { extractAttachmentLinks } = await import('../scripts/lib/revosax-discovery.mjs');
  const html = '<html><body><article id="lesetext"><div class="sections"><section title="Übereinkommen"><p><a href="/attachments/12287">Übereinkommen</a> <a href="#FNID_1">1</a></p><p><a href="/attachments/12285">Änderungsprotokoll</a><a href="/attachments/12287">nochmal</a></p></section></div></article><a href="/attachments/999">außerhalb</a></body></html>';
  assert.deepEqual(extractAttachmentLinks(html, 'https://www.revosax.sachsen.de/vorschrift/1018'), [
    { url: 'https://www.revosax.sachsen.de/attachments/12287', label: 'Übereinkommen' },
    { url: 'https://www.revosax.sachsen.de/attachments/12285', label: 'Änderungsprotokoll' },
  ]);
});

test('Seiten ohne Text im REVOSax-Datenbestand werden erkannt', async () => {
  const { detectMissingText } = await import('../scripts/lib/revosax-discovery.mjs');
  assert.equal(detectMissingText('<html><body><div class="law_show"><h1>x</h1><p>Vollzitat: x</p> Datei nicht im Datenbestand. </div></body></html>'), 'Datei nicht im Datenbestand');
  assert.equal(detectMissingText('<html><body><div class="law_show"><h1>x</h1><p>Vollzitat: x</p> Datei befindet sich in Bearbeitung. </div></body></html>'), 'Datei befindet sich in Bearbeitung');
  assert.equal(detectMissingText('<html><body><div class="law_show"><h1>x</h1><article id="lesetext">Datei nicht im Datenbestand.</article></div></body></html>'), null);
  assert.equal(detectMissingText('<html><body><div class="law_show"><h1>x</h1></div></body></html>'), null);
});
