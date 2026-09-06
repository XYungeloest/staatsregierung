import { parseNormHistory, parseNormMeta, parseNormVersion, type NormBodyBlock, type NormRecord, type NormType } from '@ostrecht/shared/lib/norms/schema.ts';
import { comparePublicationsNewestFirst, parseVerkuendung, type Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';

/**
 * Kleiner, bewusst gebauter Rechtsbestand für Funktions- und Laufzeittests: jede Norm steht für
 * eine Rolle (übernommen und geändert, übernommen und unverändert, ostdeutsch neu geschaffen,
 * künftig, aufgehoben, Änderungsvorschrift, Mantelvorschrift mit Artikel, Förderrichtlinie,
 * Zustimmungsgesetz, Staatsvertrag, Stichtagswechsel). Alle Datensätze durchlaufen dieselben
 * Schema-Parser wie der echte Bestand. Der Bestand ist keine Kopie realer Normen: Tests prüfen
 * hier Verhalten, nicht Inhalte; der reale Bestand wird von den Content-Audits geprüft.
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
        title: 'Gesetz zur Änderung des Testgesetzes', shortTitle: 'Änderungsgesetz Testgesetz', type: 'aenderungsvorschrift', status: 'one-time-act',
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
        summary: 'Enthält die Regelungen der übernommenen Ausgangsfassung zur Bestattung.', originEnactingBody: 'Sächsisches Staatsministerium des Innern', effectiveDate: '2003-03-03', sourceReferences: [revosaxSource('1002')],
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
        title: 'Ostdeutsches Vergesellschaftungsgesetz', shortTitle: 'Vergesellschaftungsgesetz', abbr: 'OstVergG', type: 'gesetz', status: 'in-force',
        subjects: ['Wirtschaft und Arbeit'], keywords: ['OstVergG', 'Vergesellschaftung'], initialCitation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)',
        summary: 'Regelt die Vergesellschaftung von Betrieben der Daseinsvorsorge.', enactingBody: 'Landtag des Freistaates Ostdeutschland', responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland',
        documentDate: '2026-09-02', publicationDate: '2026-09-02', effectiveDate: '2026-09-03', sourceReferences: [htmlSource('OGVBl. 2026 Nr. 70.html')],
      },
      history: { initialVersionId: '2026-09-03', entries: [{ date: '2026-09-03', type: 'initial', title: 'Erlass', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', affectingVersionId: '2026-09-03' }] },
      versions: [{
        versionId: '2026-09-03', validFrom: '2026-09-03', validTo: null, isCurrent: true, citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', changeNote: 'Stammfassung.',
        body: [paragraph('§ 1', 'Zweck', 'Dieses Gesetz dient der Daseinsvorsorge; die öffentliche Sicherheit bleibt gewahrt.'), paragraph('§ 2', 'Verfahren', 'Die Vergesellschaftung erfolgt durch Rechtsverordnung; § 2 des Ostdeutschen Testgesetzes (OstTestG) bleibt unberührt.')],
      }],
    }),
    // Künftig in Kraft tretend.
    norm({
      slug: 'kuenftiges-gesetz',
      meta: {
        title: 'Ostdeutsches Zukunftsgesetz', shortTitle: 'Zukunftsgesetz', abbr: 'OstZukG', type: 'gesetz', status: 'future-effective',
        subjects: ['Wirtschaft und Arbeit'], keywords: ['OstZukG'], initialCitation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)',
        summary: 'Tritt erst nach dem Stichtag in Kraft und regelt künftige Förderungen.', enactingBody: 'Landtag des Freistaates Ostdeutschland', documentDate: '2026-09-02', publicationDate: '2026-09-02', effectiveDate: '2026-10-01',
        sourceReferences: [htmlSource('OGVBl. 2026 Nr. 70.html')],
      },
      history: { initialVersionId: '2026-10-01', entries: [{ date: '2026-10-01', type: 'initial', title: 'Erlass', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)', affectingVersionId: '2026-10-01' }] },
      versions: [{
        versionId: '2026-10-01', validFrom: '2026-10-01', validTo: null, isCurrent: false, citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)', changeNote: 'Stammfassung.',
        body: [paragraph('§ 1', 'Förderung', 'Künftige Förderungen werden nach diesem Gesetz gewährt.')],
      }],
    }),
    // Aufgehoben.
    norm({
      slug: 'aufgehobene-verordnung',
      meta: {
        title: 'Ostdeutsche Altverordnung', shortTitle: 'Altverordnung', type: 'verordnung', status: 'repealed',
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
        title: 'Verordnung zur Neufassung der Testverordnung und zur Änderung anderer Verordnungen', shortTitle: 'Mantelverordnung Test', type: 'verordnung', status: 'in-force',
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
        title: 'Änderung der Gebührenverordnung', shortTitle: 'Änd. GebVO', type: 'aenderungsvorschrift', status: 'one-time-act', containedIn: 'mantelverordnung',
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
        subjects: ['Bauen und Wohnen'], keywords: ['FRL Testkindergeld', 'Testkindergeld'], initialCitation: 'Richtlinie vom 9. Februar 2026 (StAnzO. 2026 Nr. 2 S. 3)',
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
        title: 'Gesetz zum Staatsvertrag über die Testzusammenarbeit', shortTitle: 'Zustimmungsgesetz Testvertrag', type: 'zustimmungsgesetz', status: 'in-force',
        subjects: ['Staat und Verwaltung'], keywords: ['Testzusammenarbeit'], initialCitation: 'Gesetz vom 26. Januar 2026 (OGVBl. 2026 Nr. 1 S. 9)',
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
        title: 'Staatsvertrag zur Änderung des Staatsvertrages über die Testzusammenarbeit', shortTitle: 'Änderungsstaatsvertrag Testzusammenarbeit', type: 'staatsvertrag', status: 'one-time-act',
        subjects: ['Staat und Verwaltung'], keywords: ['Testzusammenarbeit'], initialCitation: 'Staatsvertrag vom 8. März 2026 (OVertrBl. 2026 Nr. 4 S. 2)',
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
        subjects: ['Haushalt und Finanzen'], keywords: ['OstHG', 'Haushalt'], initialCitation: 'Sächsisches Haushaltsgesetz vom 10. April 2001 (SächsGVBl. S. 153)',
        summary: 'Regelt die Aufstellung des Haushalts; zum 3. September 2026 geändert.', originEnactingBody: 'Sächsischer Landtag', effectiveDate: '2001-04-10', affectedByNorms: ['neues-ostgesetz'], sourceReferences: [revosaxSource('1004')],
      },
      history: {
        initialVersionId: BASELINE,
        entries: [
          { date: BASELINE, type: 'initial', title: 'Ausgangsfassung', citation: 'Sächsisches Haushaltsgesetz vom 10. April 2001 (SächsGVBl. S. 153)', affectingVersionId: BASELINE },
          { date: '2026-09-03', type: 'amendment', title: 'Änderung durch das Vergesellschaftungsgesetz', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', affectingVersionId: '2026-09-03', relatedNorm: 'neues-ostgesetz' },
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
          changeNote: 'Geändert durch das Vergesellschaftungsgesetz.', sourceReferences: [htmlSource('OGVBl. 2026 Nr. 70.html')],
          body: [paragraph('§ 1', 'Haushaltsplan', 'Der Haushaltsplan wird jährlich aufgestellt und veröffentlicht.')],
        },
      ],
    }),
  ];
}

export function buildFixturePublications(): Verkuendung[] {
  return [
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
      entries: [{ id: 'mantelverordnung', title: 'Verordnung zur Neufassung der Testverordnung und zur Änderung anderer Verordnungen', type: 'verordnung', citation: 'Verordnung vom 30. April 2026 (OGVBl. 2026 Nr. 40 S. 2)', startPage: '2', documentDate: '2026-04-30', normSlug: 'mantelverordnung', versionId: '2026-05-01' }],
    },
    {
      slug: 'ogvbl-2026-70', title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 70', year: 2026, issue: '70', date: '2026-09-02', publication: 'OGVBl.',
      sourceReferences: [{ label: 'Strukturierte HTML-Fassung', kind: 'structured-html-transcription', availability: 'versioned', localSource: 'Gesetze/OGVBl. 2026 Nr. 70.html' }],
      entries: [
        { id: 'neues-ostgesetz', title: 'Ostdeutsches Vergesellschaftungsgesetz', type: 'gesetz', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 2)', startPage: '2', documentDate: '2026-09-02', normSlug: 'neues-ostgesetz', versionId: '2026-09-03' },
        { id: 'kuenftiges-gesetz', title: 'Ostdeutsches Zukunftsgesetz', type: 'gesetz', citation: 'Gesetz vom 2. September 2026 (OGVBl. 2026 Nr. 70 S. 5)', startPage: '5', documentDate: '2026-09-02', normSlug: 'kuenftiges-gesetz', versionId: '2026-10-01' },
      ],
    },
  ].map((publication) => parseVerkuendung(publication, `${publication.slug}.json`)).sort(comparePublicationsNewestFirst);
}

/** Minimaler Datensatz eines Normtyps (für typabhängige Funktionen wie das Vollzitat). */
export function normOfType(type: NormType, overrides: Record<string, unknown> = {}): NormRecord {
  const citation = 'Testfundstelle vom 1. Januar 2026 (OGVBl. 2026 Nr. 1 S. 1)';
  return norm({
    slug: `typ-${type}`,
    meta: { title: `Testvorschrift (${type})`, shortTitle: `Testvorschrift ${type}`, type, status: 'in-force', subjects: ['Staat und Verwaltung'], initialCitation: citation, summary: 'Testdatensatz eines Normtyps für Funktionstests.', ...overrides },
    history: { initialVersionId: '2026-01-01', entries: [{ date: '2026-01-01', type: 'initial', title: 'Stammfassung', citation, affectingVersionId: '2026-01-01' }] },
    versions: [{ versionId: '2026-01-01', validFrom: '2026-01-01', validTo: null, isCurrent: true, citation, changeNote: 'Stammfassung.', body: [paragraph('§ 1', 'Regelung', 'Testregelung.')] }],
  });
}

let fixtureNorms: NormRecord[] | null = null;
let fixturePublications: Verkuendung[] | null = null;

/** Einmal gebauter, geteilter Fixture-Bestand (nur lesend verwenden; zum Verändern structuredClone). */
export function fixtureCorpus(): { norms: NormRecord[]; publications: Verkuendung[] } {
  fixtureNorms ??= buildFixtureNorms();
  fixturePublications ??= buildFixturePublications();
  return { norms: fixtureNorms, publications: fixturePublications };
}
