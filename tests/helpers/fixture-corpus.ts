import type { PortalPressReleaseLike, PortalTopicLike } from '@ostrecht/shared/lib/norms/derived.ts';
import { parseNormHistory, parseNormMeta, parseNormVersion, type NormBodyBlock, type NormRecord, type NormType } from '@ostrecht/shared/lib/norms/schema.ts';
import { comparePublicationsNewestFirst, parseVerkuendung, type Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';

/**
 * Kleiner, bewusst gebauter Rechtsbestand für Funktions- und Laufzeittests: jede Norm steht für
 * eine Rolle (übernommen und geändert, übernommen und unverändert, ostdeutsch neu geschaffen,
 * künftig, aufgehoben, historisch, Änderungsvorschrift, übernommene Änderungsvorschrift,
 * Mantelvorschrift mit Artikel, Förderrichtlinie, Zustimmungsgesetz, Staatsvertrag,
 * Stichtagswechsel, Verfassung mit mehreren Fassungen, Verwaltungsvorschrift, Bekanntmachung,
 * Tabelle im Normtext, reiner Hinweis, ungeklärte Herkunft). Alle Datensätze durchlaufen dieselben
 * Schema-Parser wie der echte Bestand. Der Bestand ist keine Kopie realer Normen: Tests prüfen
 * hier Verhalten, nicht Inhalte; der reale Bestand wird von den Content-Audits geprüft.
 *
 * Derselbe Bestand ist das D1-Testfixture der Browser-, Barrierefreiheits- und Screenshot-Tests:
 * das Manifest data/recht/runtime-fixture.json (`buildFixtureManifest`) nennt die Rollen, der
 * Seed (scripts/lib/d1-runtime-seed.mjs über scripts/lib/runtime-fixture.mjs) projiziert die
 * Ausgabe dieses Builders statt content/normen. Deshalb gilt: keine Datei- oder Umgebungszugriffe,
 * nur Importe aus dem Schema; Ereignisdaten absolut und außerhalb des Fensters
 * 2026-09-01 bis 2026-09-04 (tests/recht-d1-reference-date.test.mjs), jede Norm mit eigener
 * Abkürzung und eigenem Kurztitel, Sachgebiete nur aus packages/shared/src/config/law-subjects.ts.
 */
export const FIXTURE_REFERENCE_DATE = '2026-09-04';

const BASELINE = '2023-11-01';

function paragraph(label: string, title: string, ...texts: string[]): NormBodyBlock {
  return { type: 'paragraph', label, title, children: texts.map((text, index) => ({ type: 'subparagraph', label: `(${index + 1})`, text, children: [] })) };
}

function revosaxSource(lawId: string, sourceValidFrom = '2000-01-01') {
  return {
    kind: 'revosax-snapshot',
    label: `Amtliche REVOSax-Fassung ${lawId}`,
    availability: 'r2-archived',
    objectKey: `revosax/${BASELINE}/${lawId}.html`,
    url: `https://www.revosax.sachsen.de/vorschrift/${lawId}`,
    retrievedAt: '2026-09-03',
    sha256: lawId.padEnd(64, 'a').slice(0, 64),
    lawId,
    sourceValidFrom,
    sourceRole: 'official-snapshot',
    mediaType: 'text/html',
  };
}

function htmlSource(file: string) {
  return { kind: 'structured-html-transcription', label: `Amtliche Ausgabe ${file}`, availability: 'versioned', localSource: `Gesetze/${file}`, sourceRole: 'structure-bearing' };
}

interface NormInput {
  slug: string;
  meta: Record<string, unknown>;
  history: Record<string, unknown>;
  versions: Array<Record<string, unknown>>;
}

function norm({ slug, meta, history, versions }: NormInput): NormRecord {
  return {
    meta: parseNormMeta({ id: slug, slug, predecessor: null, successor: null, keywords: [], ...meta }, `${slug}/meta.json`),
    history: parseNormHistory(history, `${slug}/history.json`),
    versions: versions.map((version) => parseNormVersion(version, `${slug}/versions/${version.versionId}.json`)),
  };
}

const AMENDMENT_CITATION = 'Gesetz vom 23. März 2026 (OGVBl. 2026 Nr. 1 S. 2)';
const CONSTITUTION_CITATION = 'Verfassung vom 15. Dezember 2023 (OGVBl. 2024 Nr. 1 S. 1)';
const CONSTITUTION_AMENDMENT_1 = 'Gesetz vom 20. Februar 2025 (OGVBl. 2025 Nr. 3 S. 1)';
const CONSTITUTION_AMENDMENT_2 = 'Gesetz vom 18. Mai 2026 (OGVBl. 2026 Nr. 45 S. 1)';

function tableRow(texts: string[], cell: 'tableCell' | 'tableHeaderCell' = 'tableCell'): NormBodyBlock {
  return { type: 'tableRow', children: texts.map((text) => (cell === 'tableHeaderCell' ? { type: cell, text, scope: 'col' } : { type: cell, text })) };
}

/** Verfassungstext: Präambel als Block ohne Gliederungszeichen, danach Artikel. */
function constitutionBody(article2: string): NormBodyBlock[] {
  return [
    { type: 'paragraph', title: 'Präambel', children: [{ type: 'paragraphText', text: 'Das Volk des Freistaates Ostdeutschland gibt sich im Bewusstsein seiner Verantwortung diese Verfassung.' }] },
    { type: 'article', label: 'Artikel 1', title: 'Der Freistaat', children: [{ type: 'paragraphText', text: 'Der Freistaat Ostdeutschland ist ein demokratischer und sozialer Rechtsstaat.' }] },
    { type: 'article', label: 'Artikel 2', title: 'Persönlichkeit', children: [{ type: 'paragraphText', text: article2 }] },
    { type: 'article', label: 'Artikel 3', title: 'Landtag', children: [{ type: 'paragraphText', text: 'Der Landtag ist die gewählte Vertretung des Volkes.' }] },
  ];
}

export function buildFixtureNorms(): NormRecord[] {
  return [
    // Übernommen und ostdeutsch geändert: zwei Fassungen, fassungsspezifischer Titel, eine Änderung.
    norm({
      slug: 'testgesetz',
      meta: {
        title: 'Testgesetz für den Ostdeutschen Freistaat', shortTitle: 'Ostdeutsches Testgesetz', abbr: 'OstTestG', type: 'gesetz', status: 'in-force',
        subjects: ['Kommunal- und Verwaltungsrecht', 'Gesundheit und Soziales'], primarySubject: 'Kommunal- und Verwaltungsrecht', keywords: ['OstTestG', 'Gemeinde', 'Feiertag'],
        initialCitation: 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1)', summary: 'Regelt die Feiertage der Gemeinden im Testbestand.',
        originEnactingBody: 'Sächsischer Landtag', responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland', effectiveDate: '2000-01-01',
        affectedByNorms: ['aenderungsgesetz-testgesetz'], sourceReferences: [revosaxSource('1001')],
      },
      history: {
        initialVersionId: BASELINE,
        entries: [
          { date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1)', affectingVersionId: BASELINE },
          { date: '2026-03-25', type: 'amendment', title: 'Änderung durch das Änderungsgesetz', citation: AMENDMENT_CITATION, affectingVersionId: '2026-03-25', relatedNorm: 'aenderungsgesetz-testgesetz' },
        ],
      },
      versions: [
        {
          versionId: BASELINE, validFrom: BASELINE, validTo: '2026-03-24', isCurrent: false, title: 'Ostdeutsches Testgesetz', abbr: 'OstTestG',
          citation: 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1)', changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag.', sourceReferences: [revosaxSource('1001')],
          body: [paragraph('§ 1', 'Geltungsbereich', 'Dieses Gesetz gilt für alle Gemeinden.'), paragraph('§ 2', 'Feiertage', 'Die Gemeinden begehen die gesetzlichen Feiertage.'), paragraph('§ 3', 'Inkrafttreten', 'Dieses Gesetz tritt am 1. Januar 2000 in Kraft.')],
        },
        {
          versionId: '2026-03-25', validFrom: '2026-03-25', validTo: null, isCurrent: true, title: 'Testgesetz für den Ostdeutschen Freistaat', abbr: 'OstTestG',
          citation: 'Sächsisches Testgesetz vom 1. Januar 2000 (SächsGVBl. S. 1), zuletzt geändert durch Artikel 1 des Gesetzes vom 23. März 2026 (OGVBl. 2026 Nr. 1 S. 2)',
          changeNote: 'Geändert durch das Änderungsgesetz.', sourceReferences: [htmlSource('OGVBl. 2026 Nr. 1.html')],
          body: [paragraph('§ 1', 'Geltungsbereich', 'Dieses Gesetz gilt für alle Gemeinden.'), paragraph('§ 2', 'Feiertage', 'Die Gemeinden begehen die gesetzlichen Feiertage und den Tag der Verfassung.'), paragraph('§ 2a', 'Gedenktage', 'Gedenktage werden durch Rechtsverordnung bestimmt.'), paragraph('§ 3', 'Inkrafttreten', 'Dieses Gesetz tritt am 1. Januar 2000 in Kraft.')],
        },
      ],
    }),
    // Ostdeutsche Änderungsvorschrift zum Testgesetz.
    norm({
      slug: 'aenderungsgesetz-testgesetz',
      meta: {
        title: 'Gesetz zur Änderung des Testgesetzes', shortTitle: 'Änderungsgesetz Testgesetz', abbr: 'TestGÄndG', type: 'aenderungsvorschrift', status: 'one-time-act',
        subjects: ['Kommunal- und Verwaltungsrecht'], keywords: ['Testgesetz'], initialCitation: AMENDMENT_CITATION, summary: 'Ändert das Testgesetz um den Tag der Verfassung.',
        enactingBody: 'Landtag des Freistaates Ostdeutschland', documentDate: '2026-03-23', publicationDate: '2026-03-24', effectiveDate: '2026-03-25', affectedNorms: ['testgesetz'],
        sourceReferences: [htmlSource('OGVBl. 2026 Nr. 1.html')],
      },
      history: { initialVersionId: '2026-03-24', entries: [{ date: '2026-03-24', type: 'initial', title: 'Verkündung', citation: AMENDMENT_CITATION, affectingVersionId: '2026-03-24' }] },
      versions: [{
        versionId: '2026-03-24', validFrom: '2026-03-24', validTo: null, isCurrent: true, citation: AMENDMENT_CITATION, changeNote: 'Verkündete Fassung.',
        body: [
          { type: 'article', label: 'Artikel 1', title: 'Änderung des Testgesetzes', children: [{ type: 'paragraphText', text: 'Das Testgesetz wird wie folgt geändert: In § 2 werden nach dem Wort „Feiertage“ die Wörter „und den Tag der Verfassung“ eingefügt.' }] },
          { type: 'article', label: 'Artikel 2', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: 'Dieses Gesetz tritt am 25. März 2026 in Kraft.' }] },
        ],
      }],
    }),
    // Übernommen und unverändert.
    norm({
      slug: 'testverordnung',
      meta: {
        title: 'Ostdeutsche Bestattungsverordnung', shortTitle: 'Bestattungsverordnung', abbr: 'OstBestVO', type: 'verordnung', status: 'in-force',
        subjects: ['Gesundheit und Soziales'], keywords: ['OstBestVO', 'Bestattung'], initialCitation: 'Sächsische Bestattungsverordnung vom 3. März 2003 (SächsGVBl. S. 30)',
        summary: 'Enthält die Regelungen der übernommenen Ausgangsfassung zur Bestattung.', originEnactingBody: 'Sächsisches Staatsministerium des Innern', effectiveDate: '2003-03-03', affectedByNorms: ['aend-testverordnung-alt'], sourceReferences: [revosaxSource('1002')],
      },
      history: { initialVersionId: BASELINE, entries: [{ date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsische Bestattungsverordnung vom 3. März 2003 (SächsGVBl. S. 30)', affectingVersionId: BASELINE }] },
      versions: [{
        versionId: BASELINE, validFrom: BASELINE, validTo: null, isCurrent: true, citation: 'Sächsische Bestattungsverordnung vom 3. März 2003 (SächsGVBl. S. 30)', changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag.', sourceReferences: [revosaxSource('1002')],
        body: [paragraph('§ 1', 'Bestattungspflicht', 'Bestattungen erfolgen auf Friedhöfen.'), paragraph('§ 2', 'Fristen', 'Die Bestattung erfolgt innerhalb von acht Tagen.')],
      }],
    }),
    // Ostdeutsch neu geschaffen, jüngstes Rechtsereignis des Bestands.
    norm({
      slug: 'neues-ostgesetz',
      meta: {
        title: 'Ostdeutsches Testbeteiligungsgesetz', shortTitle: 'Testbeteiligungsgesetz', abbr: 'OstTBG', type: 'gesetz', status: 'in-force',
        subjects: ['Wirtschaft und Förderung'], keywords: ['OstTBG', 'Testbeteiligung'], initialCitation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)',
        summary: 'Regelt die Beteiligung der Gemeinden an Testvorhaben des Freistaates.', enactingBody: 'Landtag des Freistaates Ostdeutschland', responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland',
        documentDate: '2026-09-02', publicationDate: '2026-09-02', effectiveDate: '2026-09-03', sourceReferences: [htmlSource('OGVBl. 2026 Nr. 70.html')],
      },
      history: { initialVersionId: '2026-09-03', entries: [{ date: '2026-09-03', type: 'initial', title: 'Erlass', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', affectingVersionId: '2026-09-03' }] },
      versions: [{
        versionId: '2026-09-03', validFrom: '2026-09-03', validTo: null, isCurrent: true, citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', changeNote: 'Stammfassung.',
        body: [paragraph('§ 1', 'Zweck', 'Dieses Gesetz dient der Testbeteiligung der Gemeinden; die öffentliche Sicherheit bleibt gewahrt.'), paragraph('§ 2', 'Verfahren', 'Die Testbeteiligung erfolgt durch Rechtsverordnung; § 2 des Ostdeutschen Testgesetzes (OstTestG) bleibt unberührt.')],
      }],
    }),
    // Künftig in Kraft tretend: weit nach jedem erreichbaren Stichtag, damit die Rolle nicht kippt.
    norm({
      slug: 'kuenftiges-gesetz',
      meta: {
        title: 'Ostdeutsches Zukunftsgesetz', shortTitle: 'Zukunftsgesetz', abbr: 'OstZukG', type: 'gesetz', status: 'future-effective',
        subjects: ['Wirtschaft und Förderung'], keywords: ['OstZukG'], initialCitation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)',
        summary: 'Tritt erst nach dem Stichtag in Kraft und regelt künftige Förderungen.', enactingBody: 'Landtag des Freistaates Ostdeutschland', documentDate: '2026-09-02', publicationDate: '2026-09-02', effectiveDate: '2099-01-01',
        sourceReferences: [htmlSource('OGVBl. 2026 Nr. 70.html')],
      },
      history: { initialVersionId: '2099-01-01', entries: [{ date: '2099-01-01', type: 'initial', title: 'Erlass', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)', affectingVersionId: '2099-01-01' }] },
      versions: [{
        versionId: '2099-01-01', validFrom: '2099-01-01', validTo: null, isCurrent: false, citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)', changeNote: 'Stammfassung.',
        body: [paragraph('§ 1', 'Förderung', 'Künftige Förderungen werden nach diesem Gesetz gewährt.')],
      }],
    }),
    // Aufgehoben.
    norm({
      slug: 'aufgehobene-verordnung',
      meta: {
        title: 'Ostdeutsche Altverordnung', shortTitle: 'Altverordnung', abbr: 'OstAltVO', type: 'verordnung', status: 'repealed',
        subjects: ['Kommunal- und Verwaltungsrecht'], keywords: ['Altverordnung'], initialCitation: 'Sächsische Altverordnung vom 5. Mai 2005 (SächsGVBl. S. 50)',
        summary: 'Übernommene Verordnung, die zum 25. März 2026 aufgehoben wurde.', originEnactingBody: 'Sächsische Staatsregierung', effectiveDate: '2005-05-05', expiryDate: '2026-03-24', sourceReferences: [revosaxSource('1003')],
      },
      history: {
        initialVersionId: BASELINE,
        entries: [
          { date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsische Altverordnung vom 5. Mai 2005 (SächsGVBl. S. 50)', affectingVersionId: BASELINE },
          { date: '2026-03-25', type: 'repeal', title: 'Aufhebung', citation: AMENDMENT_CITATION, affectingVersionId: null, relatedNorm: 'aenderungsgesetz-testgesetz' },
        ],
      },
      versions: [{
        versionId: BASELINE, validFrom: BASELINE, validTo: '2026-03-24', isCurrent: false, citation: 'Sächsische Altverordnung vom 5. Mai 2005 (SächsGVBl. S. 50)', changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag.', sourceReferences: [revosaxSource('1003')],
        body: [paragraph('§ 1', 'Gegenstand', 'Diese Verordnung regelt Altfälle.')],
      }],
    }),
    // Mantelvorschrift und ein eigenständig geführter Artikel (part-of/contains).
    norm({
      slug: 'mantelverordnung',
      meta: {
        title: 'Verordnung zur Neufassung der Testverordnung und zur Änderung anderer Verordnungen', shortTitle: 'Mantelverordnung Test', abbr: 'TestMantelVO', type: 'verordnung', status: 'in-force',
        subjects: ['Kommunal- und Verwaltungsrecht'], keywords: ['Mantelverordnung'], initialCitation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)',
        summary: 'Fasst die Testverordnung neu und ändert weitere Verordnungen.', enactingBody: 'Staatsregierung des Freistaates Ostdeutschland', documentDate: '2026-04-30', publicationDate: '2026-04-30', effectiveDate: '2026-05-01',
        sourceReferences: [htmlSource('OGVBl. 2026 Nr. 40.html')],
      },
      history: { initialVersionId: '2026-05-01', entries: [{ date: '2026-05-01', type: 'initial', title: 'Erlass', citation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)', affectingVersionId: '2026-05-01' }] },
      versions: [{
        versionId: '2026-05-01', validFrom: '2026-05-01', validTo: null, isCurrent: true, citation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)', changeNote: 'Stammfassung.',
        body: [
          { type: 'article', label: 'Artikel 1', title: 'Neufassung der Testverordnung', children: [{ type: 'paragraphText', text: 'Die Testverordnung wird neu gefasst.' }] },
          { type: 'article', label: 'Artikel 2', title: 'Änderung der Gebührenverordnung', children: [{ type: 'paragraphText', text: 'Die Gebührenverordnung wird wie folgt geändert: § 3 wird aufgehoben.' }] },
          { type: 'article', label: 'Artikel 3', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: 'Diese Verordnung tritt am 1. Mai 2026 in Kraft.' }] },
        ],
      }],
    }),
    norm({
      slug: 'aend-gebuehrenverordnung-artikel',
      meta: {
        title: 'Änderung der Gebührenverordnung', shortTitle: 'Änd. GebVO', abbr: 'GebVOÄnd', type: 'aenderungsvorschrift', status: 'one-time-act', containedIn: 'mantelverordnung',
        subjects: ['Kommunal- und Verwaltungsrecht'], keywords: ['Gebührenverordnung'], initialCitation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)',
        summary: 'Artikel 2 der Mantelverordnung: hebt § 3 der Gebührenverordnung auf.', enactingBody: 'Staatsregierung des Freistaates Ostdeutschland', documentDate: '2026-04-30', effectiveDate: '2026-05-01',
        sourceReferences: [htmlSource('OGVBl. 2026 Nr. 40.html')],
      },
      history: { initialVersionId: '2026-05-01', entries: [{ date: '2026-05-01', type: 'initial', title: 'Erlass', citation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)', affectingVersionId: '2026-05-01' }] },
      versions: [{
        versionId: '2026-05-01', validFrom: '2026-05-01', validTo: null, isCurrent: true, citation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)', changeNote: 'Artikel 2 der Mantelverordnung.',
        body: [{ type: 'article', label: 'Artikel 2', title: 'Änderung der Gebührenverordnung', children: [{ type: 'paragraphText', text: 'Die Gebührenverordnung wird wie folgt geändert: § 3 wird aufgehoben.' }] }],
      }],
    }),
    // Förderrichtlinie mit sprechender Abkürzung (Autovervollständigung, feldbewusste Suche).
    norm({
      slug: 'foerderrichtlinie-testkindergeld',
      meta: {
        title: 'Förderrichtlinie des Staatsministeriums des Innern zur Gewährung eines Testkindergeldes', shortTitle: 'Förderrichtlinie Testkindergeld', abbr: 'FRL Testkindergeld', type: 'foerderrichtlinie', status: 'in-force',
        subjects: ['Wohnen und Bodenordnung'], keywords: ['FRL Testkindergeld', 'Testkindergeld'], initialCitation: 'Richtlinie vom 9. Februar 2026 (StAnzO. 2026 Nr. 2 S. 3)',
        summary: 'Fördert Familien beim Erwerb von Wohneigentum mit dem Testkindergeld.', enactingBody: 'Staatsministerium des Innern', documentDate: '2026-02-09', publicationDate: '2026-02-10', effectiveDate: '2026-02-10',
        sourceReferences: [htmlSource('StAnzO. 2026 Nr. 2.html')],
      },
      history: { initialVersionId: '2026-02-10', entries: [{ date: '2026-02-10', type: 'initial', title: 'Erlass', citation: 'Richtlinie vom 9. Februar 2026 (StAnzO. 2026 Nr. 2 S. 3)', affectingVersionId: '2026-02-10' }] },
      versions: [{
        versionId: '2026-02-10', validFrom: '2026-02-10', validTo: null, isCurrent: true, citation: 'Richtlinie vom 9. Februar 2026 (StAnzO. 2026 Nr. 2 S. 3)', changeNote: 'Stammfassung.',
        body: [{ type: 'section', label: 'I.', title: 'Zuwendungszweck', children: [{ type: 'paragraphText', text: 'Der Freistaat gewährt Familien ein Testkindergeld für den Erwerb von Wohneigentum.' }] }],
      }],
    }),
    // Zustimmungsgesetz und ändernder Staatsvertrag (Fundstelle im Vertragsblatt).
    norm({
      slug: 'zustimmungsgesetz-testvertrag',
      meta: {
        title: 'Gesetz zum Staatsvertrag über die Testzusammenarbeit', shortTitle: 'Zustimmungsgesetz Testvertrag', abbr: 'TestVertrG', type: 'zustimmungsgesetz', status: 'in-force',
        subjects: ['Völkerrecht und Staatsverträge'], keywords: ['Testzusammenarbeit'], initialCitation: 'Gesetz vom 26. Januar 2026 (OGVBl. 2026 Nr. 1 S. 9)',
        summary: 'Stimmt dem Staatsvertrag über die Testzusammenarbeit zu.', enactingBody: 'Landtag des Freistaates Ostdeutschland', documentDate: '2026-01-26', publicationDate: '2026-03-24', effectiveDate: '2026-03-25',
        sourceReferences: [htmlSource('OGVBl. 2026 Nr. 1.html')],
      },
      history: { initialVersionId: '2026-03-25', entries: [{ date: '2026-03-25', type: 'initial', title: 'Erlass', citation: 'Gesetz vom 26. Januar 2026 (OGVBl. 2026 Nr. 1 S. 9)', affectingVersionId: '2026-03-25' }] },
      versions: [{
        versionId: '2026-03-25', validFrom: '2026-03-25', validTo: null, isCurrent: true, citation: 'Gesetz vom 26. Januar 2026 (OGVBl. 2026 Nr. 1 S. 9)', changeNote: 'Stammfassung.',
        body: [{ type: 'article', label: 'Artikel 1', title: 'Zustimmung', children: [{ type: 'paragraphText', text: 'Dem Staatsvertrag über die Testzusammenarbeit wird zugestimmt.' }] }],
      }],
    }),
    norm({
      slug: 'staatsvertrag-aenderung-testvertrag',
      meta: {
        title: 'Staatsvertrag zur Änderung des Staatsvertrages über die Testzusammenarbeit', shortTitle: 'Änderungsstaatsvertrag Testzusammenarbeit', abbr: 'TestVertrÄndStV', type: 'staatsvertrag', status: 'one-time-act',
        subjects: ['Völkerrecht und Staatsverträge'], keywords: ['Testzusammenarbeit'], initialCitation: 'Staatsvertrag vom 8. März 2026 (OVertrBl. 2026 Nr. 4 S. 2)',
        summary: 'Ändert den Staatsvertrag über die Testzusammenarbeit.', enactingBody: 'Landtag des Freistaates Ostdeutschland', documentDate: '2026-03-08', publicationDate: '2026-03-24', effectiveDate: '2026-03-25',
        sourceReferences: [htmlSource('OVertrBl. 2026 Nr. 4.html')],
      },
      history: { initialVersionId: '2026-03-25', entries: [{ date: '2026-03-25', type: 'initial', title: 'Erlass', citation: 'Staatsvertrag vom 8. März 2026 (OVertrBl. 2026 Nr. 4 S. 2)', affectingVersionId: '2026-03-25' }] },
      versions: [{
        versionId: '2026-03-25', validFrom: '2026-03-25', validTo: null, isCurrent: true, citation: 'Staatsvertrag vom 8. März 2026 (OVertrBl. 2026 Nr. 4 S. 2)', changeNote: 'Stammfassung.',
        body: [{ type: 'article', label: 'Artikel 1', title: 'Änderung', children: [{ type: 'paragraphText', text: 'Artikel 3 des Staatsvertrages wird neu gefasst.' }] }],
      }],
    }),
    // Übernommene Norm mit Fassungswechsel am 3. September 2026 (Stichtagsfortschreibung).
    norm({
      slug: 'stichtagsgesetz',
      meta: {
        title: 'Haushaltsgesetz des Ostdeutschen Freistaates', shortTitle: 'Ostdeutsches Haushaltsgesetz', abbr: 'OstHG', type: 'gesetz', status: 'in-force',
        subjects: ['Haushaltsrecht'], keywords: ['OstHG', 'Haushalt'], initialCitation: 'Sächsisches Haushaltsgesetz vom 10. April 2001 (SächsGVBl. S. 153)',
        summary: 'Regelt die Aufstellung des Haushalts; zum 3. September 2026 geändert.', originEnactingBody: 'Sächsischer Landtag', effectiveDate: '2001-04-10', affectedByNorms: ['neues-ostgesetz'], sourceReferences: [revosaxSource('1004')],
      },
      history: {
        initialVersionId: BASELINE,
        entries: [
          { date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsisches Haushaltsgesetz vom 10. April 2001 (SächsGVBl. S. 153)', affectingVersionId: BASELINE },
          { date: '2026-09-03', type: 'amendment', title: 'Änderung durch das Testbeteiligungsgesetz', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', affectingVersionId: '2026-09-03', relatedNorm: 'neues-ostgesetz' },
        ],
      },
      versions: [
        {
          versionId: BASELINE, validFrom: BASELINE, validTo: '2026-09-02', isCurrent: false, citation: 'Sächsisches Haushaltsgesetz vom 10. April 2001 (SächsGVBl. S. 153)', changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag.', sourceReferences: [revosaxSource('1004')],
          body: [paragraph('§ 1', 'Haushaltsplan', 'Der Haushaltsplan wird jährlich aufgestellt.')],
        },
        {
          versionId: '2026-09-03', validFrom: '2026-09-03', validTo: null, isCurrent: true,
          citation: 'Sächsisches Haushaltsgesetz vom 10. April 2001 (SächsGVBl. S. 153), das zuletzt durch Artikel 3 des Gesetzes vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2) geändert worden ist',
          changeNote: 'Geändert durch das Testbeteiligungsgesetz.', sourceReferences: [htmlSource('OGVBl. 2026 Nr. 70.html')],
          body: [paragraph('§ 1', 'Haushaltsplan', 'Der Haushaltsplan wird jährlich aufgestellt und veröffentlicht.')],
        },
      ],
    }),
    // Verfassung: feste Adresse der Website (packages/shared/src/config/site.ts, Weiterleitung
    // /verfassung/), drei Fassungen mit vorangestellter Präambel ohne Gliederungszeichen.
    norm({
      slug: 'staatsverfassung-des-freistaates-ostdeutschland',
      meta: {
        title: 'Verfassung des Freistaates Ostdeutschland', shortTitle: 'Ostdeutsche Verfassung', abbr: 'OstVerf', type: 'gesetz', status: 'in-force',
        subjects: ['Staats- und Verfassungsrecht'], keywords: ['OstVerf', 'Verfassung', 'Grundrechte'], initialCitation: CONSTITUTION_CITATION,
        summary: 'Verfassung des Testbestands mit Präambel, Grundrechten und Staatsorganisation; zweimal geändert.', enactingBody: 'Landtag des Freistaates Ostdeutschland',
        responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland', documentDate: '2023-12-15', publicationDate: '2024-01-01', effectiveDate: '2024-01-01',
        sourceReferences: [htmlSource('OGVBl. 2024 Nr. 1.html')],
      },
      history: {
        initialVersionId: '2024-01-01',
        entries: [
          { date: '2024-01-01', type: 'initial', title: 'Erlass', citation: CONSTITUTION_CITATION, affectingVersionId: '2024-01-01' },
          { date: '2025-03-01', type: 'amendment', title: 'Erste Verfassungsänderung', citation: CONSTITUTION_AMENDMENT_1, affectingVersionId: '2025-03-01' },
          { date: '2026-06-01', type: 'amendment', title: 'Zweite Verfassungsänderung', citation: CONSTITUTION_AMENDMENT_2, affectingVersionId: '2026-06-01' },
        ],
      },
      versions: [
        {
          versionId: '2024-01-01', validFrom: '2024-01-01', validTo: '2025-02-28', isCurrent: false, citation: CONSTITUTION_CITATION, changeNote: 'Stammfassung.', sourceReferences: [htmlSource('OGVBl. 2024 Nr. 1.html')],
          body: constitutionBody('Jeder Mensch hat das Recht auf freie Entfaltung seiner Persönlichkeit.'),
        },
        {
          versionId: '2025-03-01', validFrom: '2025-03-01', validTo: '2026-05-31', isCurrent: false, citation: `${CONSTITUTION_CITATION}, geändert durch Gesetz vom 20. Februar 2025 (OGVBl. 2025 Nr. 3 S. 1)`,
          changeNote: 'Erste Verfassungsänderung: Artikel 2 neu gefasst.', sourceReferences: [htmlSource('OGVBl. 2025 Nr. 3.html')],
          body: constitutionBody('Jeder Mensch hat das Recht auf freie Entfaltung seiner Persönlichkeit und auf Achtung seiner Würde.'),
        },
        {
          versionId: '2026-06-01', validFrom: '2026-06-01', validTo: null, isCurrent: true, citation: `${CONSTITUTION_CITATION}, zuletzt geändert durch Gesetz vom 18. Mai 2026 (OGVBl. 2026 Nr. 45 S. 1)`,
          changeNote: 'Zweite Verfassungsänderung: Artikel 2 ergänzt.', sourceReferences: [htmlSource('OGVBl. 2026 Nr. 45.html')],
          body: constitutionBody('Jeder Mensch hat das Recht auf freie Entfaltung seiner Persönlichkeit, auf Achtung seiner Würde und auf Teilhabe am Testbestand.'),
        },
      ],
    }),
    // Übernommen und unverändert, Titel mit Anfangsbuchstaben G (A–Z mit Herkunftsfilter).
    norm({
      slug: 'gefahrenabwehrverordnung-testgelaende',
      meta: {
        title: 'Gefahrenabwehrverordnung für Testgelände', shortTitle: 'Testgeländeverordnung', abbr: 'TestGelVO', type: 'verordnung', status: 'in-force',
        subjects: ['Sicherheit und Ordnung'], keywords: ['TestGelVO', 'Testgelände', 'Gefahrenabwehr'], initialCitation: 'Sächsische Gefahrenabwehrverordnung vom 12. Dezember 2012 (SächsGVBl. S. 700)',
        summary: 'Übernommene Verordnung über die Ordnung auf Testgeländen; seit dem Stichtag unverändert.', originEnactingBody: 'Sächsisches Staatsministerium des Innern', effectiveDate: '2013-01-01', sourceReferences: [revosaxSource('1005')],
      },
      history: { initialVersionId: BASELINE, entries: [{ date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsische Gefahrenabwehrverordnung vom 12. Dezember 2012 (SächsGVBl. S. 700)', affectingVersionId: BASELINE }] },
      versions: [{
        versionId: BASELINE, validFrom: BASELINE, validTo: null, isCurrent: true, citation: 'Sächsische Gefahrenabwehrverordnung vom 12. Dezember 2012 (SächsGVBl. S. 700)', changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag.', sourceReferences: [revosaxSource('1005')],
        body: [paragraph('§ 1', 'Geltungsbereich', 'Diese Verordnung gilt auf allen Testgeländen des Freistaates.'), paragraph('§ 2', 'Verhalten auf dem Testgelände', 'Das Betreten des Testgeländes ist nur mit Erlaubnis zulässig.')],
      }],
    }),
    // Übernommene sächsische Änderungsvorschrift (R2-archivierte REVOSax-Quelle), in der Ausgangsfassung eingearbeitet.
    norm({
      slug: 'aend-testverordnung-alt',
      meta: {
        title: 'Verordnung zur Änderung bestattungsrechtlicher Vorschriften', shortTitle: 'Änderungsverordnung Bestattungsrecht', abbr: 'BestRÄndVO', type: 'aenderungsvorschrift', status: 'one-time-act',
        subjects: ['Gesundheit und Soziales'], keywords: ['Bestattungsrecht'], initialCitation: 'Verordnung vom 5. Mai 2010 (SächsGVBl. S. 120)',
        summary: 'Sächsische Änderungsverordnung, die in der übernommenen Ausgangsfassung der Bestattungsverordnung bereits eingearbeitet ist.',
        originEnactingBody: 'Sächsisches Staatsministerium des Innern', documentDate: '2010-05-05', effectiveDate: '2010-06-01', affectedNorms: ['testverordnung'], sourceReferences: [revosaxSource('1006', '2010-06-01')],
      },
      history: { initialVersionId: BASELINE, entries: [{ date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Verordnung vom 5. Mai 2010 (SächsGVBl. S. 120)', affectingVersionId: BASELINE }] },
      versions: [{
        versionId: BASELINE, validFrom: BASELINE, validTo: null, isCurrent: true, citation: 'Verordnung vom 5. Mai 2010 (SächsGVBl. S. 120)', changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag.', sourceReferences: [revosaxSource('1006', '2010-06-01')],
        body: [
          { type: 'article', label: 'Artikel 1', title: 'Änderung der Bestattungsverordnung', children: [{ type: 'paragraphText', text: 'Die Bestattungsverordnung wird wie folgt geändert: In § 2 wird die Angabe „sechs Tagen“ durch die Angabe „acht Tagen“ ersetzt.' }] },
          { type: 'article', label: 'Artikel 2', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: 'Diese Verordnung tritt am 1. Juni 2010 in Kraft.' }] },
        ],
      }],
    }),
    // Historisch: übernommene Verordnung, durch Zeitablauf außer Kraft.
    norm({
      slug: 'alte-testverordnung',
      meta: {
        title: 'Ostdeutsche Übergangsverordnung für Testfälle', shortTitle: 'Übergangsverordnung Testfälle', abbr: 'TestÜbVO', type: 'verordnung', status: 'historical',
        subjects: ['Verwaltungsrecht'], keywords: ['TestÜbVO', 'Übergang'], initialCitation: 'Sächsische Übergangsverordnung vom 7. Juli 2007 (SächsGVBl. S. 70)',
        summary: 'Übernommene Verordnung, die mit Ablauf des 31. Dezember 2025 außer Kraft getreten ist.', originEnactingBody: 'Sächsische Staatsregierung', effectiveDate: '2007-07-07', expiryDate: '2025-12-31', sourceReferences: [revosaxSource('1008')],
      },
      history: { initialVersionId: BASELINE, entries: [{ date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsische Übergangsverordnung vom 7. Juli 2007 (SächsGVBl. S. 70)', affectingVersionId: BASELINE }] },
      versions: [{
        versionId: BASELINE, validFrom: BASELINE, validTo: '2025-12-31', isCurrent: false, citation: 'Sächsische Übergangsverordnung vom 7. Juli 2007 (SächsGVBl. S. 70)', changeNote: 'Ausgangsfassung zum Rechtsüberleitungsstichtag.', sourceReferences: [revosaxSource('1008')],
        body: [paragraph('§ 1', 'Übergangsfälle', 'Diese Verordnung gilt für Übergangsfälle bis zum 31. Dezember 2025.')],
      }],
    }),
    // Verwaltungsvorschrift (Verzeichnis der Verwaltungsvorschriften, zweiter Treffer für „Testgelände“).
    norm({
      slug: 'vwv-testgelaende',
      meta: {
        title: 'Verwaltungsvorschrift des Staatsministeriums des Innern zur Ordnung auf dem Testgelände', shortTitle: 'VwV Testgelände', abbr: 'VwVTestGel', type: 'verwaltungsvorschrift', status: 'in-force',
        subjects: ['Verwaltungsrecht'], keywords: ['VwVTestGel', 'Testgelände', 'Formulare'], initialCitation: 'Verwaltungsvorschrift vom 4. Mai 2026 (StAnzO. 2026 Nr. 5 S. 2)',
        summary: 'Bestimmt Zugang, Formulare und Verhalten auf dem Testgelände.', enactingBody: 'Staatsministerium des Innern', documentDate: '2026-05-04', publicationDate: '2026-05-12', effectiveDate: '2026-05-13',
        sourceReferences: [htmlSource('StAnzO. 2026 Nr. 5.html')],
      },
      history: { initialVersionId: '2026-05-13', entries: [{ date: '2026-05-13', type: 'initial', title: 'Erlass', citation: 'Verwaltungsvorschrift vom 4. Mai 2026 (StAnzO. 2026 Nr. 5 S. 2)', affectingVersionId: '2026-05-13' }] },
      versions: [{
        versionId: '2026-05-13', validFrom: '2026-05-13', validTo: null, isCurrent: true, citation: 'Verwaltungsvorschrift vom 4. Mai 2026 (StAnzO. 2026 Nr. 5 S. 2)', changeNote: 'Stammfassung.',
        body: [
          { type: 'section', label: 'I.', title: 'Geltungsbereich', children: [{ type: 'paragraphText', text: 'Diese Verwaltungsvorschrift gilt für alle Behörden, die das Testgelände nutzen.' }] },
          { type: 'section', label: 'II.', title: 'Formulare', children: [{ type: 'paragraphText', text: 'Für den Zugang zum Testgelände sind die vorgeschriebenen Formulare zu verwenden.' }] },
          { type: 'section', label: 'III.', title: 'Inkrafttreten', children: [{ type: 'paragraphText', text: 'Diese Verwaltungsvorschrift tritt am 13. Mai 2026 in Kraft.' }] },
        ],
      }],
    }),
    // Bekanntmachung mit zwei Fassungen (Barrierefreiheitstest „Bekanntmachung“, Screenshot).
    norm({
      slug: 'bekanntmachung-teststiftung',
      meta: {
        title: 'Bekanntmachung über die Errichtung der Teststiftung', shortTitle: 'Bekanntmachung Teststiftung', abbr: 'TestStiftBek', type: 'bekanntmachung', status: 'in-force',
        subjects: ['Verwaltungsrecht'], keywords: ['Teststiftung'], initialCitation: 'Bekanntmachung vom 6. Mai 2026 (StAnzO. 2026 Nr. 5 S. 4)',
        summary: 'Gibt die Errichtung der Teststiftung und ihre Organe bekannt; die Besetzung des Vorstands wurde später geändert.', enactingBody: 'Staatsministerium des Innern',
        documentDate: '2026-05-06', publicationDate: '2026-05-12', effectiveDate: '2026-05-13', sourceReferences: [htmlSource('StAnzO. 2026 Nr. 5.html')],
      },
      history: {
        initialVersionId: '2026-05-13',
        entries: [
          { date: '2026-05-13', type: 'initial', title: 'Bekanntmachung', citation: 'Bekanntmachung vom 6. Mai 2026 (StAnzO. 2026 Nr. 5 S. 4)', affectingVersionId: '2026-05-13' },
          { date: '2026-07-15', type: 'amendment', title: 'Änderung der Bekanntmachung', citation: 'Bekanntmachung vom 10. Juli 2026 (StAnzO. 2026 Nr. 8 S. 3)', affectingVersionId: '2026-07-15' },
        ],
      },
      versions: [
        {
          versionId: '2026-05-13', validFrom: '2026-05-13', validTo: '2026-07-14', isCurrent: false, citation: 'Bekanntmachung vom 6. Mai 2026 (StAnzO. 2026 Nr. 5 S. 4)', changeNote: 'Stammfassung.',
          body: [{ type: 'section', label: '1.', title: 'Errichtung', children: [{ type: 'paragraphText', text: 'Die Teststiftung ist mit Wirkung vom 13. Mai 2026 errichtet. Den Vorstand bildet die Testperson A.' }] }],
        },
        {
          versionId: '2026-07-15', validFrom: '2026-07-15', validTo: null, isCurrent: true, citation: 'Bekanntmachung vom 6. Mai 2026 (StAnzO. 2026 Nr. 5 S. 4), geändert durch Bekanntmachung vom 10. Juli 2026 (StAnzO. 2026 Nr. 8 S. 3)',
          changeNote: 'Vorstand neu besetzt.', sourceReferences: [htmlSource('StAnzO. 2026 Nr. 8.html')],
          body: [{ type: 'section', label: '1.', title: 'Errichtung', children: [{ type: 'paragraphText', text: 'Die Teststiftung ist mit Wirkung vom 13. Mai 2026 errichtet. Den Vorstand bildet die Testperson B.' }] }],
        },
      ],
    }),
    // Tabelle im Normtext (Kopfzellen mit Spaltenbezug).
    norm({
      slug: 'testgebuehrenverzeichnis',
      meta: {
        title: 'Gesetz über das Testgebührenverzeichnis', shortTitle: 'Testgebührenverzeichnisgesetz', abbr: 'TestGebVerzG', type: 'gesetz', status: 'in-force',
        subjects: ['Haushaltsrecht', 'Verwaltungsrecht'], primarySubject: 'Haushaltsrecht', keywords: ['TestGebVerzG', 'Gebühren'], initialCitation: 'Gesetz vom 28. April 2026 (OGVBl. 2026 Nr. 40 S. 8)',
        summary: 'Legt die Gebühren für Testverfahren in einem tabellarischen Verzeichnis fest.', enactingBody: 'Landtag des Freistaates Ostdeutschland', documentDate: '2026-04-28', publicationDate: '2026-04-30', effectiveDate: '2026-05-01',
        sourceReferences: [htmlSource('OGVBl. 2026 Nr. 40.html')],
      },
      history: { initialVersionId: '2026-05-01', entries: [{ date: '2026-05-01', type: 'initial', title: 'Erlass', citation: 'Gesetz vom 28. April 2026 (OGVBl. 2026 Nr. 40 S. 8)', affectingVersionId: '2026-05-01' }] },
      versions: [{
        versionId: '2026-05-01', validFrom: '2026-05-01', validTo: null, isCurrent: true, citation: 'Gesetz vom 28. April 2026 (OGVBl. 2026 Nr. 40 S. 8)', changeNote: 'Stammfassung.',
        body: [
          paragraph('§ 1', 'Gebührenpflicht', 'Für Testverfahren werden Gebühren nach dem Verzeichnis in § 2 erhoben.'),
          {
            type: 'paragraph', label: '§ 2', title: 'Gebührenverzeichnis',
            children: [
              { type: 'paragraphText', text: 'Die Gebühren betragen:' },
              {
                type: 'table', columns: 3,
                children: [
                  tableRow(['Nummer', 'Amtshandlung', 'Gebühr in Euro'], 'tableHeaderCell'),
                  tableRow(['1', 'Eröffnung eines Testverfahrens', '50']),
                  tableRow(['2', 'Verlängerung eines Testverfahrens', '25']),
                  tableRow(['3', 'Abschluss eines Testverfahrens', '10']),
                ],
              },
            ],
          },
          paragraph('§ 3', 'Inkrafttreten', 'Dieses Gesetz tritt am 1. Mai 2026 in Kraft.'),
        ],
      }],
    }),
    // Reiner Hinweis nach dem Erlass: jüngste Aktivität liegt nach der jüngsten Rechtsänderung.
    norm({
      slug: 'hinweisverordnung',
      meta: {
        title: 'Verordnung über Testhinweise', shortTitle: 'Testhinweisverordnung', abbr: 'TestHinwVO', type: 'verordnung', status: 'in-force',
        subjects: ['Verwaltungsrecht'], keywords: ['TestHinwVO', 'Hinweis'], initialCitation: 'Verordnung vom 18. Dezember 2023 (OGVBl. 2024 Nr. 1 S. 12)',
        summary: 'Ostdeutsche Verordnung mit einem späteren Berichtigungshinweis, der den Rechtsstand nicht verändert.', enactingBody: 'Staatsregierung des Freistaates Ostdeutschland',
        documentDate: '2023-12-18', publicationDate: '2024-01-01', effectiveDate: '2024-01-01', sourceReferences: [htmlSource('OGVBl. 2024 Nr. 1.html')],
      },
      history: {
        initialVersionId: '2024-01-01',
        entries: [
          { date: '2024-01-01', type: 'initial', title: 'Erlass', citation: 'Verordnung vom 18. Dezember 2023 (OGVBl. 2024 Nr. 1 S. 12)', affectingVersionId: '2024-01-01' },
          { date: '2026-08-27', type: 'notice', title: 'Berichtigungshinweis', citation: 'Berichtigung vom 26. August 2026 (OGVBl. 2026 Nr. 66 S. 1)', note: 'Die Berichtigung betrifft ein Schreibversehen in § 2; der Wortlaut der Fassung bleibt unverändert.', affectingVersionId: null },
        ],
      },
      versions: [{
        versionId: '2024-01-01', validFrom: '2024-01-01', validTo: null, isCurrent: true, citation: 'Verordnung vom 18. Dezember 2023 (OGVBl. 2024 Nr. 1 S. 12)', changeNote: 'Stammfassung.',
        body: [paragraph('§ 1', 'Hinweise', 'Die Behörden erteilen Testhinweise auf Verlangen.'), paragraph('§ 2', 'Form', 'Testhinweise ergehen schriftlich.')],
      }],
    }),
    // Herkunft ungeklärt: sächsische Quelle, deren Geltung erst nach dem Rechtsüberleitungsstichtag beginnt.
    norm({
      slug: 'unklare-verordnung',
      meta: {
        title: 'Verordnung über ungeklärte Testzuständigkeiten', shortTitle: 'Testzuständigkeitsverordnung', abbr: 'TestZustVO', type: 'verordnung', status: 'in-force',
        subjects: ['Verwaltungsrecht'], keywords: ['TestZustVO', 'Zuständigkeit'], initialCitation: 'Sächsische Zuständigkeitsverordnung vom 20. Januar 2024 (SächsGVBl. S. 40)',
        summary: 'Übernommene Verordnung ohne belegten Ausgangsrechtsstand zum 1. November 2023; die Herkunft ist ungeklärt.', originEnactingBody: 'Sächsische Staatsregierung', effectiveDate: '2024-02-01',
        sourceReferences: [revosaxSource('1007', '2024-02-01')],
      },
      history: { initialVersionId: '2024-02-01', entries: [{ date: '2024-02-01', type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsische Zuständigkeitsverordnung vom 20. Januar 2024 (SächsGVBl. S. 40)', affectingVersionId: '2024-02-01' }] },
      versions: [{
        versionId: '2024-02-01', validFrom: '2024-02-01', validTo: null, isCurrent: true, citation: 'Sächsische Zuständigkeitsverordnung vom 20. Januar 2024 (SächsGVBl. S. 40)', changeNote: 'Übernommene Fassung ohne Stichtagsbeleg.', sourceReferences: [revosaxSource('1007', '2024-02-01')],
        body: [paragraph('§ 1', 'Zuständigkeit', 'Zuständig ist die Testbehörde.')],
      }],
    }),
  ];
}

export function buildFixturePublications(): Verkuendung[] {
  return [
    {
      slug: 'ogvbl-2024-01', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2024 Nr. 1', year: 2024, issue: '1', date: '2024-01-01', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2024 Nr. 1.html' }],
      entries: [
        { id: 'staatsverfassung', title: 'Verfassung des Freistaates Ostdeutschland', type: 'gesetz', citation: CONSTITUTION_CITATION, startPage: '1', documentDate: '2023-12-15', normSlug: 'staatsverfassung-des-freistaates-ostdeutschland', versionId: '2024-01-01' },
        { id: 'hinweisverordnung', title: 'Verordnung über Testhinweise', type: 'verordnung', citation: 'Verordnung vom 18. Dezember 2023 (OGVBl. 2024 Nr. 1 S. 12)', startPage: '12', documentDate: '2023-12-18', normSlug: 'hinweisverordnung', versionId: '2024-01-01' },
      ],
    },
    {
      slug: 'ogvbl-2025-03', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2025 Nr. 3', year: 2025, issue: '3', date: '2025-02-28', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2025 Nr. 3.html' }],
      entries: [{ id: 'verfassungsaenderung-2025', title: 'Gesetz zur Änderung der Verfassung des Freistaates Ostdeutschland', type: 'gesetz', citation: CONSTITUTION_AMENDMENT_1, startPage: '1', documentDate: '2025-02-20', normSlug: 'staatsverfassung-des-freistaates-ostdeutschland', versionId: '2025-03-01' }],
    },
    {
      slug: 'ogvbl-2026-01', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 1', year: 2026, issue: '1', date: '2026-03-24', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2026 Nr. 1.html' }],
      entries: [
        { id: 'aenderungsgesetz-testgesetz', title: 'Gesetz zur Änderung des Testgesetzes', type: 'gesetz', citation: AMENDMENT_CITATION, startPage: '2', documentDate: '2026-03-23', normSlug: 'aenderungsgesetz-testgesetz', versionId: '2026-03-24' },
        { id: 'zustimmungsgesetz-testvertrag', title: 'Gesetz zum Staatsvertrag über die Testzusammenarbeit', type: 'gesetz', citation: 'Gesetz vom 26. Januar 2026 (OGVBl. 2026 Nr. 1 S. 9)', startPage: '9', documentDate: '2026-01-26', normSlug: 'zustimmungsgesetz-testvertrag', versionId: '2026-03-25' },
      ],
    },
    {
      slug: 'stanzo-2026-02', title: 'Ostdeutscher Staatsanzeiger 2026 Nr. 2', year: 2026, issue: '2', date: '2026-02-10', publication: 'StAnzO.', alternativeIssueDesignation: 'OABl. 2026 Nr. 2',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/StAnzO. 2026 Nr. 2.html' }],
      entries: [{ id: 'foerderrichtlinie-testkindergeld', title: 'Förderrichtlinie Testkindergeld', type: 'foerderrichtlinie', citation: 'Richtlinie vom 9. Februar 2026 (StAnzO. 2026 Nr. 2 S. 3)', startPage: '3', documentDate: '2026-02-09', normSlug: 'foerderrichtlinie-testkindergeld', versionId: '2026-02-10' }],
    },
    {
      slug: 'overtrbl-2026-04', title: 'Ostdeutsches Vertragsblatt 2026 Nr. 4', year: 2026, issue: '4', date: '2026-03-24', publication: 'OVertrBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OVertrBl. 2026 Nr. 4.html' }],
      entries: [{ id: 'staatsvertrag-aenderung-testvertrag', title: 'Staatsvertrag zur Änderung des Staatsvertrages über die Testzusammenarbeit', type: 'staatsvertrag', citation: 'Staatsvertrag vom 8. März 2026 (OVertrBl. 2026 Nr. 4 S. 2)', startPage: '2', documentDate: '2026-03-08', normSlug: 'staatsvertrag-aenderung-testvertrag', versionId: '2026-03-25' }],
    },
    {
      slug: 'ogvbl-2026-40', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 40', year: 2026, issue: '40', date: '2026-04-30', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2026 Nr. 40.html' }],
      entries: [
        { id: 'mantelverordnung', title: 'Verordnung zur Neufassung der Testverordnung und zur Änderung anderer Verordnungen', type: 'verordnung', citation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)', startPage: '2', documentDate: '2026-04-30', normSlug: 'mantelverordnung', versionId: '2026-05-01' },
        { id: 'testgebuehrenverzeichnis', title: 'Gesetz über das Testgebührenverzeichnis', type: 'gesetz', citation: 'Gesetz vom 28. April 2026 (OGVBl. 2026 Nr. 40 S. 8)', startPage: '8', documentDate: '2026-04-28', normSlug: 'testgebuehrenverzeichnis', versionId: '2026-05-01' },
      ],
    },
    {
      slug: 'stanzo-2026-05', title: 'Ostdeutscher Staatsanzeiger 2026 Nr. 5', year: 2026, issue: '5', date: '2026-05-12', publication: 'StAnzO.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/StAnzO. 2026 Nr. 5.html' }],
      entries: [
        { id: 'vwv-testgelaende', title: 'Verwaltungsvorschrift des Staatsministeriums des Innern zur Ordnung auf dem Testgelände', type: 'verwaltungsvorschrift', citation: 'Verwaltungsvorschrift vom 4. Mai 2026 (StAnzO. 2026 Nr. 5 S. 2)', startPage: '2', documentDate: '2026-05-04', normSlug: 'vwv-testgelaende', versionId: '2026-05-13' },
        { id: 'bekanntmachung-teststiftung', title: 'Bekanntmachung über die Errichtung der Teststiftung', type: 'bekanntmachung', citation: 'Bekanntmachung vom 6. Mai 2026 (StAnzO. 2026 Nr. 5 S. 4)', startPage: '4', documentDate: '2026-05-06', normSlug: 'bekanntmachung-teststiftung', versionId: '2026-05-13' },
      ],
    },
    {
      slug: 'ogvbl-2026-45', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 45', year: 2026, issue: '45', date: '2026-05-20', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2026 Nr. 45.html' }],
      entries: [{ id: 'verfassungsaenderung-2026', title: 'Zweites Gesetz zur Änderung der Verfassung des Freistaates Ostdeutschland', type: 'gesetz', citation: CONSTITUTION_AMENDMENT_2, startPage: '1', documentDate: '2026-05-18', normSlug: 'staatsverfassung-des-freistaates-ostdeutschland', versionId: '2026-06-01' }],
    },
    {
      slug: 'stanzo-2026-08', title: 'Ostdeutscher Staatsanzeiger 2026 Nr. 8', year: 2026, issue: '8', date: '2026-07-14', publication: 'StAnzO.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/StAnzO. 2026 Nr. 8.html' }],
      entries: [{ id: 'bekanntmachung-teststiftung-aenderung', title: 'Bekanntmachung zur Änderung der Bekanntmachung über die Errichtung der Teststiftung', type: 'bekanntmachung', citation: 'Bekanntmachung vom 10. Juli 2026 (StAnzO. 2026 Nr. 8 S. 3)', startPage: '3', documentDate: '2026-07-10', normSlug: 'bekanntmachung-teststiftung', versionId: '2026-07-15' }],
    },
    {
      slug: 'ogvbl-2026-66', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 66', year: 2026, issue: '66', date: '2026-08-26', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2026 Nr. 66.html' }],
      entries: [{ id: 'berichtigung-hinweisverordnung', title: 'Berichtigung der Verordnung über Testhinweise', type: 'berichtigung', citation: 'Berichtigung vom 26. August 2026 (OGVBl. 2026 Nr. 66 S. 1)', startPage: '1', documentDate: '2026-08-26', normSlug: 'hinweisverordnung', versionId: '2024-01-01' }],
    },
    {
      slug: 'ogvbl-2026-70', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 70', year: 2026, issue: '70', date: '2026-09-02', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2026 Nr. 70.html' }],
      entries: [
        { id: 'neues-ostgesetz', title: 'Ostdeutsches Testbeteiligungsgesetz', type: 'gesetz', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', startPage: '2', documentDate: '2026-09-02', normSlug: 'neues-ostgesetz', versionId: '2026-09-03' },
        { id: 'kuenftiges-gesetz', title: 'Ostdeutsches Zukunftsgesetz', type: 'gesetz', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)', startPage: '5', documentDate: '2026-09-02', normSlug: 'kuenftiges-gesetz', versionId: '2099-01-01' },
      ],
    },
  ].map((publication) => parseVerkuendung(publication, `${publication.slug}.json`)).sort(comparePublicationsNewestFirst);
}

/** Minimaler Datensatz eines Normtyps (für typabhängige Funktionen wie das Vollzitat). */
export function normOfType(type: NormType, overrides: Record<string, unknown> = {}): NormRecord {
  const citation = 'Testfundstelle vom 1. Januar 2026 (OGVBl. 2026 Nr. 1 S. 1)';
  return norm({
    slug: `typ-${type}`,
    meta: { title: `Testvorschrift (${type})`, shortTitle: `Testvorschrift ${type}`, type, status: 'in-force', subjects: ['Staats- und Verfassungsrecht'], initialCitation: citation, summary: 'Testdatensatz eines Normtyps für Funktionstests.', ...overrides },
    history: { initialVersionId: '2026-01-01', entries: [{ date: '2026-01-01', type: 'initial', title: 'Stammfassung', citation, affectingVersionId: '2026-01-01' }] },
    versions: [{ versionId: '2026-01-01', validFrom: '2026-01-01', validTo: null, isCurrent: true, citation, changeNote: 'Stammfassung.', body: [paragraph('§ 1', 'Regelung', 'Testregelung.')] }],
  });
}

/**
 * Portalgrundlagen des Fixtures (Themen und Pressemitteilungen mit Normbezügen), aus denen der Seed
 * die Staatsportal-Bezüge in law_norm_derived ableitet; die Adressen bildet der Seed über
 * packages/shared/src/lib/portal/routes.ts.
 */
export function buildFixturePortal(): { topics: PortalTopicLike[]; pressReleases: PortalPressReleaseLike[] } {
  return {
    topics: [
      { slug: 'testthema', title: 'Testthema', rechtsgrundlagen: [{ normSlug: 'testgesetz' }, { normSlug: 'staatsverfassung-des-freistaates-ostdeutschland' }] },
      { slug: 'testgelaende', title: 'Testgelände im Freistaat', rechtsgrundlagen: [{ normSlug: 'gefahrenabwehrverordnung-testgelaende' }, { normSlug: 'testgesetz' }] },
    ],
    pressReleases: [
      { slug: '2026-03-24-testgesetz-geaendert', title: 'Testgesetz geändert', date: '2026-03-24', relatedNormSlugs: ['testgesetz', 'aenderungsgesetz-testgesetz'] },
      { slug: '2026-06-01-verfassungsaenderung-in-kraft', title: 'Zweite Verfassungsänderung in Kraft', date: '2026-06-01', relatedNormSlugs: ['staatsverfassung-des-freistaates-ostdeutschland'] },
    ],
  };
}

/**
 * Rollen des Fixtures (Rolle → Slug). Browser-, Barrierefreiheits- und Screenshot-Tests lesen sie
 * über das Manifest data/recht/runtime-fixture.json (tests/helpers/law-runtime.ts) statt Slugs zu
 * nennen; tests/runtime-fixture-manifest.test.ts prüft, dass jede Rolle im Bestand erfüllt ist.
 */
export const FIXTURE_ROLES = {
  'constitution': 'staatsverfassung-des-freistaates-ostdeutschland',
  'multi-version': 'staatsverfassung-des-freistaates-ostdeutschland',
  'inherited-amended': 'testgesetz',
  'inherited-unchanged': 'testverordnung',
  'inherited-unchanged-letter-g': 'gefahrenabwehrverordnung-testgelaende',
  'inherited-amendment-act': 'aend-testverordnung-alt',
  'ostdeutsch-original': 'neues-ostgesetz',
  'origin-unresolved': 'unklare-verordnung',
  'amendment-act': 'aenderungsgesetz-testgesetz',
  'repealed': 'aufgehobene-verordnung',
  'historical': 'alte-testverordnung',
  'future-effective': 'kuenftiges-gesetz',
  'reference-date-switch': 'stichtagsgesetz',
  'envelope': 'mantelverordnung',
  'envelope-article': 'aend-gebuehrenverordnung-artikel',
  'foerderrichtlinie': 'foerderrichtlinie-testkindergeld',
  'zustimmungsgesetz': 'zustimmungsgesetz-testvertrag',
  'staatsvertrag': 'staatsvertrag-aenderung-testvertrag',
  'verwaltungsvorschrift': 'vwv-testgelaende',
  'bekanntmachung': 'bekanntmachung-teststiftung',
  'norm-table': 'testgebuehrenverzeichnis',
  'notice-only': 'hinweisverordnung',
  'portal-relations': 'testgesetz',
} as const;

/** Fassungskennungen je Rolle, wo Tests eine feste Fassungsadresse brauchen (Vergleich, historische Fassung). */
export const FIXTURE_VERSIONS = {
  'inherited-amended': { historical: BASELINE, current: '2026-03-25' },
} as const;

/** Verkündungsrollen (Rolle → Ausgabenslug). */
export const FIXTURE_PUBLICATIONS = {
  'detail': 'stanzo-2026-05',
} as const;

/**
 * Suchwörter des Fixtures: `multi-hit` trifft mehrere geltende Vorschriften ohne Änderungsbezug,
 * `ostdeutsch-original` in erster Linie die ostdeutsch neu geschaffene Norm, `inherited-unchanged`
 * holt die übernommene, unveränderte Norm über den Freitextfilter der Rechtsentwicklung nach vorn.
 */
export const FIXTURE_SEARCH = {
  'multi-hit': 'Testgelände',
  'ostdeutsch-original': 'Testbeteiligung',
  'inherited-unchanged': 'Bestattungsverordnung',
} as const;

export interface FixtureManifest {
  $schema: 'runtime-fixture/2';
  source: 'synthetic';
  builder: string;
  description: string;
  roles: Record<string, string[]>;
  versions: Record<string, Record<string, string>>;
  publications: Record<string, string[]>;
  search: Record<string, string>;
}

/**
 * Manifest des Testfixtures (data/recht/runtime-fixture.json). Die Datei ist die committete
 * Ausgabe dieser Funktion; tests/runtime-fixture-manifest.test.ts hält beide gleich.
 */
export function buildFixtureManifest(): FixtureManifest {
  const listed = <T extends Record<string, string>>(map: T): Record<string, string[]> => Object.fromEntries(Object.entries(map).map(([role, slug]) => [role, [slug]]));
  return {
    $schema: 'runtime-fixture/2',
    source: 'synthetic',
    builder: 'tests/helpers/fixture-corpus.ts',
    description: 'Synthetischer Testbestand für Browser-, Barrierefreiheits- und Screenshot-Tests gegen die D1-Runtime: der Seed (scripts/d1-runtime-seed.mjs, OSTRECHT_D1_FIXTURE) projiziert die Ausgabe des Builders tests/helpers/fixture-corpus.ts (Normen, Verkündungen, Themen, Pressemitteilungen) statt content/. Die Tests lesen Rollen (roles: Rolle → Slugs), Fassungskennungen (versions), Verkündungsrollen (publications) und Suchwörter (search) aus diesem Manifest statt feste Bezeichnungen zu nennen. Erzeugt von buildFixtureManifest(); tests/runtime-fixture-manifest.test.ts prüft die Übereinstimmung.',
    roles: listed(FIXTURE_ROLES),
    versions: Object.fromEntries(Object.entries(FIXTURE_VERSIONS).map(([role, versions]) => [role, { ...versions }])),
    publications: listed(FIXTURE_PUBLICATIONS),
    search: { ...FIXTURE_SEARCH },
  };
}

let fixtureNorms: NormRecord[] | null = null;
let fixturePublications: Verkuendung[] | null = null;
let fixturePortal: ReturnType<typeof buildFixturePortal> | null = null;

/** Einmal gebauter, geteilter Fixture-Bestand (nur lesend verwenden; zum Verändern structuredClone). */
export function fixtureCorpus(): { norms: NormRecord[]; publications: Verkuendung[]; topics: PortalTopicLike[]; pressReleases: PortalPressReleaseLike[] } {
  fixtureNorms ??= buildFixtureNorms();
  fixturePublications ??= buildFixturePublications();
  fixturePortal ??= buildFixturePortal();
  return { norms: fixtureNorms, publications: fixturePublications, topics: fixturePortal.topics, pressReleases: fixturePortal.pressReleases };
}
