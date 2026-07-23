#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { parseConsolidatedHtml } from './lib/norm-html-parser.mjs';

const ROOT = process.cwd();
const VERIFIED_AT = '2026-07-23';
const CONSTITUTION_SLUG = 'staatsverfassung-des-freistaates-ostdeutschland';
const DISTRICT_SLUG = 'ostdeutsche-bezirksordnung';

const SOURCES = {
  ii24Pdf: {
    path: 'Gesetze/OGVBl II-24.pdf',
    mediaType: 'application/pdf',
    pageCount: 32,
    sha256: '9b9b5f8d691c8f4341711a5c30b4c1ac2a03a73a00cbf915688ef8a00b91a6fd',
  },
  i25Pdf: {
    path: 'Gesetze/OGVBl I-25.pdf',
    mediaType: 'application/pdf',
    pageCount: 15,
    sha256: '1c8362ccf1fa1f7d7be5c6a267c38ea0dc218efe27b77402eba4de8be72521d7',
  },
  constitutionDocx: {
    path: 'Gesetze/Verfassung.docx',
    mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sha256: '7eec0947e070da17710b0c52dacfbe9f1b682d9c6434519b51599cf902f56590',
  },
  i24Pdf: {
    path: 'Gesetze/OGVBl-03-24.pdf',
    mediaType: 'application/pdf',
    pageCount: 2,
    sha256: '76b82af51dfd3e12e73645313a40db807205e61c5c659615890ea23ecfe58d40',
  },
};

const p = (text) => ({ type: 'paragraphText', text });
const item = (label, text, children = []) => ({
  type: 'item',
  label,
  text,
  level: /^[a-z]/iu.test(label) ? 1 : 0,
  listId: 'source-outline',
  numberingStyle: /^[a-z]/iu.test(label) ? 'lower-latin' : 'decimal',
  children,
});
const sub = (label, text, children = []) => ({
  type: 'subparagraph',
  label,
  text,
  children,
});
const paragraph = (label, title, children) => ({ type: 'paragraph', label, title, children });
const article = (label, title, children) => ({ type: 'article', label, ...(title ? { title } : {}), children });
const quote = (children) => ({ type: 'quotedProvision', children });

async function json(path) {
  return JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
}

async function writeJson(path, value) {
  const absolute = resolve(ROOT, path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(resolve(ROOT, path))).digest('hex');
}

function htmlReference(localSource, label, derivedSource, pageRange) {
  return {
    kind: 'structured-html-transcription',
    label,
    availability: 'versioned',
    localSource,
    mediaType: 'text/html',
    verifiedAt: VERIFIED_AT,
    sourceRole: 'structure-bearing',
    ...(pageRange ? { pageRange } : {}),
    ...(derivedSource ? { derivedSource } : {}),
  };
}

function pdfReference(source, label, derivedSource, pageRange) {
  return {
    kind: 'primary-pdf',
    label,
    availability: 'versioned',
    localSource: source.path,
    sha256: source.sha256,
    mediaType: source.mediaType,
    pageCount: source.pageCount,
    verifiedAt: VERIFIED_AT,
    sourceRole: 'visual-control',
    ...(pageRange ? { pageRange } : {}),
    ...(derivedSource ? { derivedSource } : {}),
  };
}

function docxReference(derivedSource) {
  return {
    kind: 'structured-docx-source',
    label: 'Strukturtragende DOCX-Quelle der Verfassung vor den Änderungen von 2026',
    availability: 'versioned',
    localSource: SOURCES.constitutionDocx.path,
    sha256: SOURCES.constitutionDocx.sha256,
    mediaType: SOURCES.constitutionDocx.mediaType,
    verifiedAt: VERIFIED_AT,
    sourceRole: 'structure-bearing',
    derivedSource,
  };
}

function publicationHtmlReference(localSource, label, derivedSource) {
  return {
    kind: 'structured-html-transcription',
    label,
    availability: 'versioned',
    localSource,
    mediaType: 'text/html',
    verifiedAt: VERIFIED_AT,
    sourceRole: 'structure-bearing',
    derivedSource,
  };
}

function publicationPdfReference(source, label, derivedSource) {
  return {
    kind: 'primary-pdf',
    label,
    availability: 'versioned',
    localSource: source.path,
    sha256: source.sha256,
    mediaType: source.mediaType,
    pageCount: source.pageCount,
    verifiedAt: VERIFIED_AT,
    sourceRole: 'visual-control',
    ...(derivedSource ? { derivedSource } : {}),
  };
}

function normMeta({
  slug,
  title,
  shortTitle = title,
  type,
  citation,
  documentDate,
  publicationDate,
  effectiveDate,
  expiryDate,
  dateNote,
  summary,
  subjects,
  keywords,
  status = 'one-time-act',
  sourceReferences,
  enactingNorm,
  enactedNorm,
  enactedNorms,
  affectedNorms,
  affectedByNorms,
  responsibleMinistry,
}) {
  return {
    id: slug,
    slug,
    title,
    shortTitle,
    shortTitleSource: 'official',
    type,
    enactingBody: type === 'verwaltungsvorschrift' || type === 'bekanntmachung'
      ? 'Staatsregierung des Freistaates Ostdeutschland'
      : 'Landtag des Freistaates Ostdeutschland',
    responsibleMinistry: responsibleMinistry ?? 'Staatskanzlei des Freistaates Ostdeutschland',
    subjects,
    keywords,
    initialCitation: citation,
    predecessor: null,
    successor: null,
    summary,
    status,
    documentDate,
    publicationDate,
    effectiveDate,
    ...(expiryDate ? { expiryDate } : {}),
    ...(dateNote ? { dateNote } : {}),
    sourceReferences,
    ...(enactingNorm ? { enactingNorm } : {}),
    ...(enactedNorm ? { enactedNorm } : {}),
    ...(enactedNorms ? { enactedNorms } : {}),
    ...(affectedNorms ? { affectedNorms } : {}),
    ...(affectedByNorms ? { affectedByNorms } : {}),
  };
}

async function writeSingleVersionNorm({ meta, body, versionId = meta.documentDate, validFrom = meta.effectiveDate, validTo = meta.expiryDate ?? null, sourceNotes = [] }) {
  const version = {
    versionId,
    validFrom,
    validTo,
    isCurrent: validTo === null,
    citation: meta.initialCitation,
    changeNote: 'Amtlich verkündete Stammfassung.',
    sourceReferences: meta.sourceReferences,
    ...(sourceNotes.length > 0 ? { sourceNotes } : {}),
    body,
  };
  const history = {
    initialVersionId: versionId,
    entries: [{
      date: meta.documentDate,
      type: 'initial',
      title: 'Stammfassung verkündet.',
      citation: meta.initialCitation,
      affectingVersionId: versionId,
    }],
  };
  await writeJson(`content/normen/${meta.slug}/meta.json`, meta);
  await writeJson(`content/normen/${meta.slug}/history.json`, history);
  await writeJson(`content/normen/${meta.slug}/versions/${versionId}.json`, version);
}

function issueReferences(issueHtml, pdfSource) {
  return [
    publicationHtmlReference(issueHtml, 'Redaktionell geprüfte strukturierte Transkription der vollständigen Ausgabe', pdfSource.path),
    publicationPdfReference(pdfSource, 'Amtliches Original-PDF der Ausgabe', issueHtml),
  ];
}

function normReferences(issueHtml, pdfSource, pageRange) {
  return [
    htmlReference(issueHtml, 'Redaktionell geprüfte strukturierte Transkription der Ausgabe', pdfSource.path, pageRange),
    pdfReference(pdfSource, 'Amtliches Original-PDF der Ausgabe', issueHtml, pageRange),
  ];
}

async function parseBody(path, title) {
  const source = await readFile(resolve(ROOT, path), 'utf8');
  return parseConsolidatedHtml(path, source, { title }).body;
}

function findBlock(body, label) {
  for (const block of body) {
    if (block.label === label) return block;
    const nested = findBlock(block.children ?? [], label);
    if (nested) return nested;
  }
  return null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueSourceReferences(...groups) {
  const seen = new Set();
  return groups.flat().filter((reference) => {
    const key = JSON.stringify([
      reference.kind ?? null,
      reference.localSource ?? null,
      reference.url ?? null,
      reference.pageRange ?? null,
      reference.label ?? null,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withoutLocalSources(references, localSources) {
  const managed = new Set(localSources);
  return (references ?? []).filter((reference) => !managed.has(reference.localSource));
}

function apply2026PromulgationAmendment(body) {
  const amended = clone(body);
  const article76 = findBlock(amended, 'Artikel 76');
  if (!article76) throw new Error('Artikel 76 fehlt in der Verfassungsfassung von 2025.');
  const paragraph1 = article76.children.find((entry) => entry.label === '(1)');
  if (!paragraph1?.text?.includes('der laufenden Legislaturperiode')) {
    throw new Error('Erwarteter alter Wortlaut in Artikel 76 Absatz 1 fehlt.');
  }
  paragraph1.text = paragraph1.text.replace('der laufenden Legislaturperiode', 'vierzehn Tage');
  const paragraph1a = sub(
    '(1a)',
    'Die Frist von vierzehn Tage nach Absatz 1 Satz 1 sowie die Dringlichkeit nach Satz 2 gilt nicht, wenn die Umstände es nicht zulassen. In diesem Falle müssen jedoch Gesetze, so schnell es die Umstände erlauben, verkündet werden.',
  );
  const paragraph4 = sub('(4)', 'Näheres zur Ausfertigung und Verkündung nach Absatz 1 bis 3 wird durch Gesetz geregelt.');
  const index = article76.children.indexOf(paragraph1);
  article76.children.splice(index + 1, 0, paragraph1a);
  article76.children.push(paragraph4);
  return amended;
}

function apply2026InsigniaAmendment(body) {
  const amended = clone(body);
  const article2 = findBlock(amended, 'Artikel 2');
  if (!article2) throw new Error('Artikel 2 fehlt in der Verfassungsfassung vom 28. Januar 2026.');
  const paragraph2 = article2.children.find((entry) => entry.label === '(2)');
  const expected = 'Die Landesfarben sind Weiß und Grün.';
  if (paragraph2?.text !== expected) {
    throw new Error(`Erwarteter alter Wortlaut in Artikel 2 Absatz 2 fehlt: „${paragraph2?.text ?? ''}“`);
  }
  paragraph2.text = 'Die Landesfarben sind Blau, Weiß und Grün.';
  return amended;
}

function applySportAmendmentToDistrictReplacement(body) {
  const amended = clone(body);
  const paragraph13 = findBlock(amended, '§ 13');
  if (!paragraph13) {
    throw new Error('§ 13 fehlt in der ab 1. August 2026 geltenden Ablösungsfassung der Bezirksordnung.');
  }

  const existingParagraph13a = findBlock(amended, '§ 13a');
  const items = paragraph13.children.filter((entry) => entry.type === 'item');
  const sportItem = items.find((entry) =>
    entry.text === 'bezirkliche Sportentwicklung und Sportkoordination nach Maßgabe des Ostdeutschen Sportfördergesetzes,'
  );

  // Die Migration bleibt auch dann stabil, wenn sie gegen den bereits erzeugten
  // konsolidierten Datenbestand erneut ausgeführt wird.
  if (sportItem?.label === '10.' && existingParagraph13a) {
    const labels = items.map((entry) => entry.label);
    if (labels.join('|') !== Array.from({ length: 11 }, (_, index) => `${index + 1}.`).join('|')) {
      throw new Error('Die bereits sportrechtlich geänderte Nummernfolge in § 13 ist widersprüchlich.');
    }
    return amended;
  }

  const expectedLabels = Array.from({ length: 10 }, (_, index) => `${index + 1}.`);
  if (items.map((entry) => entry.label).join('|') !== expectedLabels.join('|')) {
    throw new Error('Der Sportänderungsbefehl erwartet in der Ablösungsfassung von § 13 die Nummern 1 bis 10.');
  }
  if (existingParagraph13a) {
    throw new Error('§ 13a ist bereits vorhanden, ohne dass die erwartete Sportänderung in § 13 nachweisbar ist.');
  }

  const formerItem10 = items.at(-1);
  formerItem10.label = '11.';
  const itemIndex = paragraph13.children.indexOf(formerItem10);
  paragraph13.children.splice(itemIndex, 0, {
    ...item(
      '10.',
      'bezirkliche Sportentwicklung und Sportkoordination nach Maßgabe des Ostdeutschen Sportfördergesetzes,',
    ),
    listId: formerItem10.listId,
  });

  const paragraphIndex = amended.indexOf(paragraph13);
  if (paragraphIndex < 0) {
    throw new Error('§ 13 ist nicht als äußerer Paragraph der Ablösungsfassung gespeichert.');
  }
  amended.splice(
    paragraphIndex + 1,
    0,
    paragraph('§ 13a', 'Bezirkliche Sportkoordination', [
      sub('(1)', 'Der Bezirk koordiniert im Rahmen seiner Aufgaben die regionale Sportentwicklung.'),
      sub(
        '(2)',
        'Die bezirkliche Sportkoordination begründet keine Weisungsbefugnis gegenüber Gemeinden, Landkreisen oder kreisfreien Städten, soweit gesetzlich nichts anderes bestimmt ist.',
      ),
    ]),
  );
  return amended;
}

const constitution2024Body = await parseBody('Gesetze/Staatsverfassung-2024.html', 'Verfassung des Ostdeutschen Freistaates');
const constitution2025Body = await parseBody('Gesetze/Staatsverfassung-2025.html', 'Verfassung des Ostdeutschen Freistaates');
const district2025Body = await parseBody('Gesetze/Ostdeutsche Bezirksordnung 2025.html', 'Bezirksordnung des ostdeutschen Freistaates');

const constitutionArticleLabels = constitution2024Body
  .flatMap((block) => block.children ?? [block])
  .filter((block) => /^Artikel\s+\d+/u.test(block.label ?? ''));
if (constitutionArticleLabels.length !== 122 || !findBlock(constitution2024Body, 'Artikel 122')) {
  throw new Error(`Ursprungsverfassung ist unvollständig (${constitutionArticleLabels.length} statt 122 Artikel).`);
}
if (!findBlock(district2025Body, '§ 1') || !findBlock(district2025Body, '§ 29')) {
  throw new Error('Bezirksordnung 2025 enthält nicht die vollständigen §§ 1 bis 29.');
}

for (const source of Object.values(SOURCES)) {
  const actual = await sha256(source.path);
  if (actual !== source.sha256) throw new Error(`${source.path}: SHA-256 ${actual} weicht vom geprüften Wert ${source.sha256} ab.`);
}

const ii24 = {
  slug: 'ogvbl-2024-ii',
  title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2024 Nr. II',
  year: 2024,
  issue: 'II',
  date: '2024-10-15',
  publication: 'OGVBl.',
  originalIssueDesignation: 'OGVBl Nr. II/24',
  alternativeIssueDesignation: 'OGVBl. 2024 Nr. II',
  entries: [
    {
      id: 'verordnung-aenderung-oberstufen-abiturpruefungsverordnung-2024',
      title: 'Verordnung über die Änderung der Oberstufen- und Abiturprüfungsverordnung',
      type: 'verordnung',
      citation: 'Verordnung vom 16. September 2024 (OGVBl. 2024 Nr. II S. 2)',
      pages: '2',
      documentDate: '2024-09-16',
    normSlug: 'verordnung-aenderung-oberstufen-abiturpruefungsverordnung-2024',
      versionId: '2024-09-16',
    },
    {
      id: 'organisationserlass-aenderung-fachbereichszuteilung-2024',
      title: 'Organisationserlass über die Änderung der Fachbereichszuteilung zu den Staatsministerien',
      type: 'verwaltungsvorschrift',
      citation: 'Organisationserlass vom 23. September 2024 (OGVBl. 2024 Nr. II S. 3)',
      pages: '3',
      documentDate: '2024-09-23',
      normSlug: 'organisationserlass-aenderung-fachbereichszuteilung-2024',
      versionId: '2024-09-23',
    },
    {
      id: 'dienstanordnung-momentane-terrorgefahr-2024',
      title: 'Dienstanordnung anlässlich der momentanen Terrorgefahr',
      type: 'verwaltungsvorschrift',
      citation: 'Dienstanordnung vom 2. Oktober 2024 (OGVBl. 2024 Nr. II S. 4)',
      pages: '4',
      documentDate: '2024-10-02',
      normSlug: 'dienstanordnung-momentane-terrorgefahr-2024',
      versionId: '2024-10-02',
    },
    {
      id: 'gesetz-zur-einsetzung-einer-neuen-landesverfassung',
      title: 'Gesetz zur Einsetzung einer neuen Landesverfassung',
      type: 'gesetz',
      citation: 'Gesetz vom 14. Oktober 2024 (OGVBl. 2024 Nr. II S. 5–32)',
      pages: '5-32',
      documentDate: '2024-10-14',
      normSlug: 'gesetz-zur-einsetzung-einer-neuen-landesverfassung',
      versionId: '2024-10-14',
    },
  ],
  sourceReferences: issueReferences('Gesetze/OGVBl II-24.html', SOURCES.ii24Pdf),
};

const i25 = {
  slug: 'ogvbl-2025-01-07',
  title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2025 Nr. 1–7',
  year: 2025,
  issue: '1–7',
  date: '2025-03-12',
  publication: 'OGVBl.',
  originalIssueDesignation: 'Ausgabe 1 · GVBl Nr. I/25',
  alternativeIssueDesignation: 'OGVBl. 2025 Nr. 1–7',
  entries: [
    {
      id: 'organisationserlass-neueinteilung-fachbereiche-2024',
      title: 'Organisationserlass über die Neueinteilung der Fachbereiche von Staatsministerien',
      type: 'verwaltungsvorschrift',
      citation: 'Organisationserlass vom 8. Oktober 2024 (OGVBl. 2025 Nr. 1–7 S. 2)',
      pages: '2',
      documentDate: '2024-10-08',
      normSlug: 'organisationserlass-neueinteilung-fachbereiche-2024',
      versionId: '2024-10-08',
    },
    {
      id: 'bekanntmachung-verbot-sachsen-den-sachsen-deutschland-den-deutschen',
      title: 'Bekanntmachung des Verbotes der Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“',
      type: 'bekanntmachung',
      citation: 'Bekanntmachung vom 11. November 2024 (OGVBl. 2025 Nr. 1–7 S. 3)',
      pages: '3',
      documentDate: '2024-11-11',
      normSlug: 'bekanntmachung-verbot-sachsen-den-sachsen-deutschland-den-deutschen',
      versionId: '2024-11-11',
    },
    {
      id: 'dienstanordnung-schutz-gefluechtetenunterkuenfte-2024',
      title: 'Dienstanordnung zum Schutze der Geflüchtetenunterkünfte im Lande',
      type: 'verwaltungsvorschrift',
      citation: 'Dienstanordnung vom 20. November 2024 (OGVBl. 2025 Nr. 1–7 S. 4)',
      pages: '4',
      documentDate: '2024-11-20',
      normSlug: 'dienstanordnung-schutz-gefluechtetenunterkuenfte-2024',
      versionId: '2024-11-20',
    },
    {
      id: 'dienstanordnung-silvesternacht-2024',
      title: 'Dienstanordnung zur Sicherung der öffentlichen Sicherheit in der Silvesternacht',
      type: 'verwaltungsvorschrift',
      citation: 'Dienstanordnung vom 31. Dezember 2024 (OGVBl. 2025 Nr. 1–7 S. 5)',
      pages: '5',
      documentDate: '2024-12-31',
      normSlug: 'dienstanordnung-silvesternacht-2024',
      versionId: '2024-12-31',
    },
    {
      id: 'organisationserlass-neugliederung-ministerien-2025',
      title: 'Organisationserlass über die Neugliederung einiger Ministerien',
      type: 'verwaltungsvorschrift',
      citation: 'Organisationserlass vom 22. Januar 2025 (OGVBl. 2025 Nr. 1–7 S. 6)',
      pages: '6',
      documentDate: '2025-01-22',
      normSlug: 'organisationserlass-neugliederung-ministerien-2025',
      versionId: '2025-01-22',
    },
    {
      id: 'ostdeutsches-bezirkseinfuehrungsgesetz',
      title: 'Gesetz zur Einführung von Bezirken (Ostdeutsches Bezirkseinführungsgesetz)',
      type: 'gesetz',
      citation: 'Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–14)',
      pages: '7-14',
      documentDate: '2025-03-06',
      normSlug: 'ostdeutsches-bezirkseinfuehrungsgesetz',
      versionId: '2025-03-06',
    },
    {
      id: 'gesetz-zur-aenderung-der-landesverfassung-2025',
      title: 'Gesetz zur Änderung der Landesverfassung',
      type: 'gesetz',
      citation: 'Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 15)',
      pages: '15',
      documentDate: '2025-03-06',
      normSlug: 'gesetz-zur-aenderung-der-landesverfassung-2025',
      versionId: '2025-03-06',
    },
  ],
  sourceReferences: issueReferences('Gesetze/OGVBl I-25.html', SOURCES.i25Pdf),
};

await writeJson('content/verkuendungen/ogvbl-2024-ii.json', ii24);
await writeJson('content/verkuendungen/ogvbl-2025-01-07.json', i25);

const iiRefs = (range) => normReferences('Gesetze/OGVBl II-24.html', SOURCES.ii24Pdf, range);
const iRefs = (range) => normReferences('Gesetze/OGVBl I-25.html', SOURCES.i25Pdf, range);

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'verordnung-aenderung-oberstufen-abiturpruefungsverordnung-2024',
    title: 'Verordnung über die Änderung der Oberstufen- und Abiturprüfungsverordnung',
    type: 'aenderungsvorschrift',
    citation: 'Verordnung vom 16. September 2024 (OGVBl. 2024 Nr. II S. 2)',
    documentDate: '2024-09-16',
    publicationDate: '2024-10-15',
    effectiveDate: '2024-10-15',
    summary: 'Ändert die zugelassenen Leistungskurskombinationen und trifft ergänzende Vorgaben für kleinere Schulen und das Schuljahr 2025/2026.',
    subjects: ['Bildung und Schule'],
    keywords: ['Oberstufe', 'Abiturprüfung', 'Leistungskurse'],
    sourceReferences: iiRefs('2'),
    affectedNorms: ['oberstufenund-abiturprufungsverordnung'],
    responsibleMinistry: 'Staatssekretariat für Volksbildung und Wissenschaft',
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 16. September 2024 die folgende Verordnung erlassen:'),
    paragraph('§ 1', 'Lorem Ipsum', [
      p('Der Paragraph 9 der Oberstufen- und Abiturprüfungsverordnung wird wie folgt geändert:'),
      item('1.', 'Der Absatz 1 wird wie folgt geändert:', [quote([
        sub('(1)', 'Jeder Schüler mit Ausnahme der in Absatz 3 genannten Schüler wählt aus dem Angebot seiner Schule Leistungskurse in zwei Fächern des Pflichtbereichs. Erstes Leistungskursfach ist Deutsch, Mathematik oder eine fortgeführte Fremdsprache. Folgende Leistungskurskombinationen sind zulässig.', [
          item('1.', 'Deutsch – Mathematik,'),
          item('2.', 'Deutsch – fortgeführte Fremdsprache,'),
          item('3.', 'Deutsch – Biologie oder Chemie oder Physik,'),
          item('4.', 'Deutsch – Geschichte,'),
          item('5.', 'Deutsch – Gesellschaft, Rechtswissenschaften und Wirtschaft,'),
          item('6.', 'Mathematik – Gesellschaft, Rechtswissenschaften und Wirtschaft,'),
          item('7.', 'Mathematik – fortgeführte Fremdsprache,'),
          item('8.', 'Mathematik – Biologie oder Chemie oder Physik,'),
          item('9.', 'Mathematik – Geschichte,'),
          item('10.', 'fortgeführte Fremdsprache – Geschichte,'),
          item('11.', 'Gesellschaft, Rechtswissenschaften und Wirtschaft – Biologie oder Chemie oder Physik,'),
          item('12.', 'Gesellschaft, Rechtswissenschaften und Wirtschaft – fortgeführte Fremdsprache,'),
          item('13.', 'Gesellschaft, Rechtswissenschaften und Wirtschaft – Geschichte.'),
        ]),
      ])]),
      item('2.', 'Dem Paragraphen werden die folgenden Absätze 5 und 6 angefügt:', [quote([
        sub('(5)', 'Sollte eine Schule weniger als fünfzig Lehrer in Vollzeit angestellt haben, so finden die Buchstaben 4, 5, 10 und 13 des Absatzes 1 keine Anwendung.'),
        sub('(6)', 'Die Vorgaben aus Absatz 1 Buchstaben 5, 6, 11, 12 und 13 treten zum Beginn des Schuljahres 2025/2026 in Kraft.'),
      ])]),
    ]),
    paragraph('§ 2', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am Tage der Verkündung in Kraft.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'organisationserlass-aenderung-fachbereichszuteilung-2024',
    title: 'Organisationserlass über die Änderung der Fachbereichszuteilung zu den Staatsministerien',
    type: 'verwaltungsvorschrift',
    citation: 'Organisationserlass vom 23. September 2024 (OGVBl. 2024 Nr. II S. 3)',
    documentDate: '2024-09-23',
    publicationDate: '2024-10-15',
    effectiveDate: '2024-10-15',
    summary: 'Ordnet die Angelegenheiten der sorbischen Minderheit der Staatskanzlei zu.',
    subjects: ['Staatsorganisation', 'Sorbische Angelegenheiten'],
    keywords: ['Organisationserlass', 'Sorben', 'Staatskanzlei'],
    sourceReferences: iiRefs('3'),
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 23. September 2024 die folgende Verordnung erlassen:'),
    paragraph('§ 1', 'Änderung der Fachbereichszuteilungen', [p('Der Fachbereich „Angelegenheiten der nationalen Minderheit der Sorbinnen und Sorben“ wird der Staatskanzlei zugeordnet.')]),
    paragraph('§ 2', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am Tage der Verkündung in Kraft.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'dienstanordnung-momentane-terrorgefahr-2024',
    title: 'Dienstanordnung anlässlich der momentanen Terrorgefahr',
    type: 'verwaltungsvorschrift',
    citation: 'Dienstanordnung vom 2. Oktober 2024 (OGVBl. 2024 Nr. II S. 4)',
    documentDate: '2024-10-02',
    publicationDate: '2024-10-15',
    effectiveDate: '2024-10-15',
    dateNote: 'Das Inhaltsverzeichnis nennt den 2. Oktober 2024; der Einleitungssatz nennt als Erlassdatum den 23. September 2024.',
    summary: 'Ordnet wegen einer benannten Terrorgefahr Heimarbeit für die Beschäftigten der Staatsregierung an.',
    subjects: ['Staatsorganisation', 'Innere Sicherheit'],
    keywords: ['Dienstanordnung', 'Terrorgefahr', 'Heimarbeit'],
    sourceReferences: iiRefs('4'),
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 23. September 2024 die folgende Verordnung erlassen:'),
    paragraph('§ 1', 'Schutz von Mitarbeitern der Staatsregierung', [p('Alle Mitarbeiter der Staatsregierung werden dazu angewiesen aufgrund der imminenten Terrorgefahr gegen staatliche Einrichtungen von Zuhause zu arbeiten.')]),
    paragraph('§ 2', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am Tage der Verkündung in Kraft.')]),
  ],
  sourceNotes: [{
    label: 'Abweichende Datumsangaben',
    text: 'Das Inhaltsverzeichnis nennt den 2. Oktober 2024, der Einleitungssatz im Normtext dagegen den 23. September 2024. Das Portal führt beide Angaben getrennt und nimmt keine stillschweigende Bereinigung vor.',
  }],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'gesetz-zur-einsetzung-einer-neuen-landesverfassung',
    title: 'Gesetz zur Einsetzung einer neuen Landesverfassung',
    type: 'aenderungsvorschrift',
    citation: 'Gesetz vom 14. Oktober 2024 (OGVBl. 2024 Nr. II S. 5–32)',
    documentDate: '2024-10-14',
    publicationDate: '2024-10-15',
    effectiveDate: '2024-10-15',
    summary: 'Hebt die zuvor geltende Landesverfassung auf und setzt die vollständig verkündete Verfassung des Ostdeutschen Freistaates in Kraft.',
    subjects: ['Staats- und Verfassungsrecht'],
    keywords: ['Landesverfassung', 'Verfassung', 'Einsetzung'],
    sourceReferences: [
      ...iiRefs('5-32'),
      htmlReference('Gesetze/Staatsverfassung-2024.html', 'Strukturierte Ursprungsfassung der Verfassung', SOURCES.ii24Pdf.path, '5-32'),
      docxReference('Gesetze/Staatsverfassung-2024.html'),
    ],
    enactedNorm: CONSTITUTION_SLUG,
    responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland',
  }),
  body: [
    p('Der Ostdeutsche Landtag hat am 14. Oktober 2024 folgendes Gesetz beschlossen:'),
    article('Artikel 1', null, [p('Die bisherige Verfassung des Freistaates Ostdeutschland, zuletzt geändert am 11. Juli 2013, wird aufgehoben.')]),
    article('Artikel 2', null, [
      p('Der nachstehende Entwurf wird als neue Landesverfassung eingesetzt:'),
      quote(constitution2024Body),
    ]),
    article('Artikel 3', null, [p('Das Gesetz tritt am Tage seiner Verkündung in Kraft.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'organisationserlass-neueinteilung-fachbereiche-2024',
    title: 'Organisationserlass über die Neueinteilung der Fachbereiche von Staatsministerien',
    type: 'verwaltungsvorschrift',
    citation: 'Organisationserlass vom 8. Oktober 2024 (OGVBl. 2025 Nr. 1–7 S. 2)',
    documentDate: '2024-10-08',
    publicationDate: '2025-03-12',
    effectiveDate: '2024-10-08',
    expiryDate: '2025-01-22',
    dateNote: 'Der Einleitungssatz bezeichnet den 8. Oktober 2024 als Tag der Verkündung; die Sammelausgabe wurde erst am 12. März 2025 ausgegeben. Der spätere Organisationserlass setzt den Vorgänger unter abweichender Datumsbezeichnung außer Kraft.',
    summary: 'Löst das Umwelt-, Landwirtschafts- und Klimaschutzressort auf, überträgt seine Fachbereiche und benennt das Infrastrukturressort um.',
    subjects: ['Staatsorganisation'],
    keywords: ['Organisationserlass', 'Fachbereiche', 'Ministerien'],
    status: 'repealed',
    sourceReferences: iRefs('2'),
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 8. Oktober 2024 folgende Verordnung verkündet.'),
    paragraph('§ 1', 'Neueinteilung der Fachbereiche', [p('Das Staatsministerium für Umwelt, Landwirtschaft & Klimaschutz wird aufgelöst. Die Fachbereiche werden dem Staatsministerium Infrastruktur & Verkehr zugeteilt.')]),
    paragraph('§ 2', 'Umbenennung des Staatsministeriums für Infrastruktur & Verkehr', [p('Das Staatsministerium für Infrastruktur & Verkehr wird in Staatsministerium für Infrastruktur, Verkehr & Umweltschutz umbenannt.')]),
    paragraph('§ 3', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am Tage ihrer Verkündung in Kraft.')]),
  ],
  sourceNotes: [{
    label: 'Spätere Aufhebung',
    text: 'Der Organisationserlass vom 22. Januar 2025 setzt diesen Erlass außer Kraft, bezeichnet ihn dort jedoch abweichend als Erlass vom 8. November 2024.',
  }],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'bekanntmachung-verbot-sachsen-den-sachsen-deutschland-den-deutschen',
    title: 'Bekanntmachung des Verbotes der Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“',
    type: 'bekanntmachung',
    citation: 'Bekanntmachung vom 11. November 2024 (OGVBl. 2025 Nr. 1–7 S. 3)',
    documentDate: '2024-11-11',
    publicationDate: '2025-03-12',
    effectiveDate: '2024-11-11',
    dateNote: 'Der Einleitungssatz bezeichnet den 11. November 2024 als Tag der Verkündung; die Sammelausgabe wurde am 12. März 2025 ausgegeben.',
    summary: 'Verbietet die benannte Vereinigung und ihre Teilorganisationen und regelt Kennzeichen-, Vermögens- und Ersatzorganisationsfolgen.',
    subjects: ['Vereinsrecht', 'Innere Sicherheit'],
    keywords: ['Vereinsverbot', 'Vereinigung', 'Beschlagnahme'],
    status: 'one-time-act',
    sourceReferences: iRefs('3'),
    responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft',
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 11. November 2024 folgende Verordnung verkündet.'),
    paragraph('§ 1', 'Verfügung', [
      item('1.', 'Die Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“ richtet sich gegen die verfassungsmäßige Ordnung.'),
      item('2.', 'Die Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“ ist verboten. Das Verbot erstreckt sich darüberhinaus auf alle Teilorganisationen, insbesondere auf die Jugendorganisation der Vereinigung.'),
      item('3.', 'Es ist verboten, Ersatzorganisationen für die verbotenen Vereinigungen zu bilden oder bestehende Organisationen als Ersatzorganisationen fortzuführen.'),
      item('4.', 'Der Betrieb jeglicher Öffentlichkeitspräsenz der Vereinigung und all ihrer Teilorganisationen wird eingestellt, dazu gehört insbesondere der Betrieb der Internetseiten und von Profilen in sozialen Medien.'),
      item('5.', 'Kennzeichen der Vereinigung und all ihrer Teilorganisationen dürfen für die Dauer der Vollziehbarkeit des Verbots nicht öffentlich, in einer Versammlung oder in Schrift, Ton- oder Bildträgern, Abbildungen oder Darstellungen, die verbreitet werden oder zur Verbreitung bestimmt sind, verwendet werden.'),
      item('6.', 'Das Vermögen der Vereinigung und all ihrer Teilorganisationen wird beschlagnahmt und eingezogen.'),
      item('7.', 'Forderungen und Sachen Dritter werden beschlagnahmt und eingezogen, soweit der Berechtigte durch Überlassung der Sachen an die Vereinigung oder einer ihrer Teilorganisationen deren verfassungswidrige Bestreben vorsätzlich gefördert hat oder die Sachen zur Förderung dieser Bestrebungen bestimmt hat.'),
    ]),
    paragraph('§ 2', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am Tage ihrer Verkündung in Kraft.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'dienstanordnung-schutz-gefluechtetenunterkuenfte-2024',
    title: 'Dienstanordnung zum Schutze der Geflüchtetenunterkünfte im Lande',
    type: 'verwaltungsvorschrift',
    citation: 'Dienstanordnung vom 20. November 2024 (OGVBl. 2025 Nr. 1–7 S. 4)',
    documentDate: '2024-11-20',
    publicationDate: '2025-03-12',
    effectiveDate: '2024-11-20',
    expiryDate: '2025-01-20',
    dateNote: 'Die Quelle nennt ein Außerkrafttreten am 20. Januar 2025, obwohl die Ausgabe erst am 12. März 2025 ausgegeben wurde. Eine Verlängerung ist nicht belegt.',
    summary: 'Ordnet Polizeipräsenz und eine Waffenverbotszone an Geflüchtetenunterkünften an und nennt den 20. Januar 2025 als Außerkrafttretensdatum.',
    subjects: ['Innere Sicherheit', 'Flüchtlingsaufnahme'],
    keywords: ['Geflüchtetenunterkünfte', 'Polizeipräsenz', 'Waffenverbot'],
    status: 'repealed',
    sourceReferences: iRefs('4'),
    responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft',
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 20. November 2024 folgende Verordnung verkündet.'),
    paragraph('§ 1', 'Polizeipräsenz bei allen Geflüchtetenunterkünften', [
      item('1.', 'Es wird angeordnet, dass ab sofort vor jeder Geflüchtetenunterkunft auf dem Gebiet des Freistaates Ostdeutschland Polizisten der ostdeutschen Landespolizei zum Schutze der Unterkünfte, ihrer Bewohner und des dort arbeitenden Personals stationiert wird.'),
      item('2.', 'Die Aufgaben der Polizisten vor Ort beziehen sich auf', [
        item('a.', 'die präventive Überwachung der Unterkunft und ihres Umfeldes,'),
        item('b.', 'die Deeskalation im Konfliktfall und'),
        item('c.', 'die Prävention von Straftaten, welche sich gegen die Unterkunft richten.'),
      ]),
      item('3.', 'In einem Umkreis von 100 Metern um die gesamte Unterkunft gilt nach § 42 Absatz 5 des Waffengesetzes ein generelles Verbot Waffen zu führen.'),
    ]),
    paragraph('§ 2', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am Tage der Verkündung in Kraft und am 20.01.2025 außer Kraft. Sollte sich die besondere Gefahrenlage über einen längeren oder kürzeren Zeitraum erstrecken als eigentlich durch das Außerkrafttreten geregelt, kann das Staatsministerium diese Dienstanordnung verkürzen oder verlängern.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'dienstanordnung-silvesternacht-2024',
    title: 'Dienstanordnung zur Sicherung der öffentlichen Sicherheit in der Silvesternacht',
    type: 'verwaltungsvorschrift',
    citation: 'Dienstanordnung vom 31. Dezember 2024 (OGVBl. 2025 Nr. 1–7 S. 5)',
    documentDate: '2024-12-31',
    publicationDate: '2025-03-12',
    effectiveDate: '2024-12-31',
    expiryDate: '2025-01-01',
    dateNote: 'Die Schlussvorschrift bezeichnet den Zeitpunkt 1. Januar 2025 um 08:00 Uhr wörtlich erneut als Inkrafttreten. Nach Überschrift und Regelungszusammenhang wird er als Außerkrafttretenszeitpunkt ausgewiesen; der Originalwortlaut bleibt im Normtext erhalten.',
    summary: 'Ordnet Unterstützungs- und Bereitschaftsmaßnahmen für Rettungsdienste, Feuerwehr und Polizei in der Silvesternacht an.',
    subjects: ['Innere Sicherheit', 'Katastrophenschutz'],
    keywords: ['Silvester', 'Polizei', 'Feuerwehr', 'Rettungsdienst'],
    status: 'repealed',
    sourceReferences: iRefs('5'),
    responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft',
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 31. Dezember 2024 folgende Verordnung verkündet.'),
    paragraph('§ 1', 'Dienstanordnung', [
      item('1.', 'In Innenstädten und an Orten von großen öffentlichen Ansammlungen', [
        item('a.', 'unterstützt die Polizei jegliche eingeteilte Rettungsdienste bei der Errichtung von Zelten und Plätzen zur Erstversorgung,'),
        item('b.', 'bereitet sich die Feuerwehr im Falle einer Überlastung der Rettungsdienste auf entlastende Erste Hilfe Maßnahmen vor und'),
        item('c.', 'wird die Polizeipräsenz erhöht.'),
      ]),
      item('2.', 'Die genaue Festlegung der Zahlen und Räume obliegt den kommunalen Entscheidungsträgern.'),
    ]),
    paragraph('§ 2', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am 31.12.2024 um 20:00 Uhr in Kraft und am 01.01.2025 um 08:00 Uhr in Kraft.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'organisationserlass-neugliederung-ministerien-2025',
    title: 'Organisationserlass über die Neugliederung einiger Ministerien',
    type: 'verwaltungsvorschrift',
    citation: 'Organisationserlass vom 22. Januar 2025 (OGVBl. 2025 Nr. 1–7 S. 6)',
    documentDate: '2025-01-22',
    publicationDate: '2025-03-12',
    effectiveDate: '2025-01-22',
    dateNote: 'Der Einleitungssatz bezeichnet den 22. Januar 2025 als Tag der Verkündung; die Sammelausgabe wurde am 12. März 2025 ausgegeben. Die Aufhebungsvorschrift nennt den 8. November 2024; die veröffentlichte Vorgängerquelle trägt das Dokumentdatum 8. Oktober 2024.',
    summary: 'Hebt einen früheren Organisationserlass auf, gründet ein Gesundheitsressort und benennt das verbleibende Arbeits- und Sozialressort um.',
    subjects: ['Staatsorganisation'],
    keywords: ['Organisationserlass', 'Gesundheit', 'Ministerien'],
    sourceReferences: iRefs('6'),
  }),
  body: [
    p('Die Ostdeutsche Staatsregierung hat am 22. Januar 2025 folgende Verordnung verkündet.'),
    paragraph('§ 1', 'Aussetzung eines Erlasses', [p('Der Organisationserlass über die Neueinteilung der Fachbereiche von Staatsministerien vom 8. November 2024 wird außer Kraft gesetzt.')]),
    paragraph('§ 2', 'Ausgliederung eines Fachbereiches', [p('Es wird ein neues Staatsministerium der Gesundheit gegründet, der Gesundheitsbereich wird aus dem Staatsministerium für Arbeit, Soziales, Gesellschaft & Gesundheit ausgegliedert, womit dieses künftig den Titel Staatsministerium für Arbeit, Soziales & Gesellschaft trägt.')]),
    paragraph('§ 3', 'Inkrafttreten, Außerkrafttreten', [p('Die Verordnung tritt am Tage der Verkündung in Kraft.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'ostdeutsches-bezirkseinfuehrungsgesetz',
    title: 'Gesetz zur Einführung von Bezirken',
    shortTitle: 'Ostdeutsches Bezirkseinführungsgesetz',
    type: 'aenderungsvorschrift',
    citation: 'Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–14)',
    documentDate: '2025-03-06',
    publicationDate: '2025-03-12',
    effectiveDate: '2025-03-12',
    summary: 'Führt die Ostdeutsche Bezirksordnung ein und ändert Landkreisordnung, Landesplanungsrecht und Verwaltungsorganisationsrecht.',
    subjects: ['Kommunal- und Verwaltungsrecht', 'Raumordnung und Landesplanung'],
    keywords: ['Bezirke', 'Bezirksordnung', 'Bezirkseinführung'],
    sourceReferences: [
      ...iRefs('7-14'),
      htmlReference('Gesetze/Ostdeutsche Bezirksordnung 2025.html', 'Strukturierte Ursprungsfassung der Ostdeutschen Bezirksordnung', SOURCES.i25Pdf.path, '7-13'),
    ],
    enactedNorm: DISTRICT_SLUG,
    affectedNorms: ['saechsische-landkreisordnung'],
    responsibleMinistry: 'Staatssekretariat des Innern und für Wohnungswirtschaft',
  }),
  body: [
    p('Der Ostdeutsche Landtag hat am 6. März 2025 folgendes Gesetz beschlossen:'),
    article('Artikel 1', null, [quote(district2025Body)]),
    article('Artikel 2', 'Änderung der Landkreisordnung des ostdeutschen Freistaates', [
      p('Die Landkreisordnung des Ostdeutschen Freistaates vom 9. März 2018 wird wie folgt geändert:'),
      item('1.', 'Im § 75 wird „die Landesdirektion Ostdeutschland“ durch „der jeweilige Bezirk“ ersetzt.'),
    ]),
    article('Artikel 3', 'Änderung des Gesetzes zur Raumordnung und Landesplanung des Freistaates Ostdeutschland', [
      p('Das Gesetz zur Raumordnung und Landesplanung des Freistaates Ostdeutschland vom 11. Dezember 2018 wird wie folgt geändert:'),
      item('1.', 'Im § 19 wird „die Landesdirektion Ostdeutschland“ durch „der jeweilige Bezirk“ ersetzt.'),
    ]),
    article('Artikel 4', 'Änderung des Gesetzes über die Verwaltungsorganisation des Freistaates Ostdeutschland', [
      p('Das Gesetz über die Verwaltungsorganisation des Freistaates Ostdeutschland vom 25. November 2003, zuletzt geändert am 20. Dezember 2022, wird wie folgt geändert:'),
      item('1.', 'Der § 6 wird wie folgt neugefasst:', [quote([
        sub('(1)', 'Allgemeine Staatsbehörde sind die jeweiligen Bezirke, auf dessen Gebiet die Verwaltungsaufgabe zutrifft. Die Bezirke sind dem Staatsministerium direkt nachgeordnet.'),
        sub('(2)', 'Die Bezirke nehmen Aufgaben aus mehreren Staatsministerien wahr und koordinieren die staatliche Verwaltungstätigkeit im gesamten Freistaat. Sie sind, soweit nichts anderes bestimmt ist, höhere Verwaltungsbehörde im Sinne bundesrechtlicher Vorschriften. Die Bezirke nehmen die Aufgaben des Landesamtes zur Regelung offener Vermögensfragen und die Aufgaben der verwaltungsrechtlichen und beruflichen Rehabilitierung wahr.'),
      ])]),
      item('2.', 'Der § 6 wird in „Bezirke“ umbenannt.'),
    ]),
    article('Artikel 5', 'Inkrafttreten', [p('Das Gesetz tritt am Tage seiner Verkündung in Kraft.')]),
  ],
});

await writeSingleVersionNorm({
  meta: normMeta({
    slug: 'gesetz-zur-aenderung-der-landesverfassung-2025',
    title: 'Gesetz zur Änderung der Landesverfassung',
    type: 'aenderungsvorschrift',
    citation: 'Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 15)',
    documentDate: '2025-03-06',
    publicationDate: '2025-03-12',
    effectiveDate: '2025-03-12',
    summary: 'Benennt Artikel 114 in „Demokratiegebot“ um, fasst Absatz 1 neu und fügt zwei weitere Absätze an.',
    subjects: ['Staats- und Verfassungsrecht'],
    keywords: ['Landesverfassung', 'Demokratiegebot', 'Artikel 114'],
    sourceReferences: iRefs('15'),
    affectedNorms: [CONSTITUTION_SLUG],
    responsibleMinistry: 'Staatskanzlei des Freistaates Ostdeutschland',
  }),
  body: [
    p('Der Ostdeutsche Landtag hat am 6. März 2025 folgendes Gesetz beschlossen.'),
    article('Artikel 1', 'Änderung der Verfassung des Ostdeutschen Freistaates', [
      p('Die Verfassung des Ostdeutschen Freistaates vom 15.10.2024, wird wie folgt geändert:'),
      item('1.', 'Der Artikel 114 wird wie folgt geändert:', [
        item('a.', 'Der Artikel wird in „Artikel 114 Demokratiegebot“ umbenannt.'),
        item('b.', 'Der Absatz 1 wird wie folgt neu gefasst:', [quote([
          sub('(1)', 'Keinerlei Verfassungs- oder Gesetzes- oder Verordnungsänderung oder -einführung darf den Grundgedanken des demokratischen, republikanischen Rechtsstaates und der parlamentarischen Staatsform antasten.'),
        ])]),
        item('c.', 'Dem Artikel wird ein folgender Absatz 2 angefügt:', [quote([
          sub('(2)', 'Die Errichtung einer Diktatur, unabhängig der Form, ist verboten.'),
        ])]),
        item('d.', 'Dem Artikel wird ein folgender Absatz 3 angefügt:', [quote([
          sub('(3)', 'Den in Absatz 1 und 2 genannten Vorschriften widersprechende Gesetze, Verordnungen und Beschlüsse sind nicht auszuarbeiten, nicht zu verkünden, oder, bei vorausgegangener Verkündung, nicht zu befolgen.'),
        ])]),
      ]),
    ]),
    article('Artikel 2', 'Inkrafttreten', [p('Das Gesetz tritt am Tage seiner Verkündung in Kraft.')]),
  ],
});

const constitutionCurrent = await json(`content/normen/${CONSTITUTION_SLUG}/versions/2026-07-21.json`);
const constitutionReferences2024 = [
  htmlReference('Gesetze/Staatsverfassung-2024.html', 'Redaktionell geprüfte strukturierte Ursprungsfassung', SOURCES.ii24Pdf.path, '5-32'),
  pdfReference(SOURCES.ii24Pdf, 'Amtliches Original-PDF der Ursprungsfassung', 'Gesetze/Staatsverfassung-2024.html', '5-32'),
  docxReference('Gesetze/Staatsverfassung-2024.html'),
];
const constitutionReferences2025 = [
  htmlReference('Gesetze/Staatsverfassung-2025.html', 'Strukturierte Lesefassung nach der Änderung vom 6. März 2025', SOURCES.i25Pdf.path, '15'),
  pdfReference(SOURCES.i25Pdf, 'Amtliches Original-PDF des Änderungsgesetzes', 'Gesetze/Staatsverfassung-2025.html', '15'),
  docxReference('Gesetze/Staatsverfassung-2025.html'),
];
const promulgationActSlug = 'gesetz-zur-veranderung-der-verfassung-zur-anderung-der-verku-437sg5';
const promulgationAct = await json(`content/normen/${promulgationActSlug}/meta.json`);
const insigniaActSlug = 'gesetz-zur-einfuhrung-eines-hoheitszeichengesetzes';
const insigniaAct = await json(`content/normen/${insigniaActSlug}/meta.json`);
const constitution2026Body = apply2026PromulgationAmendment(constitution2025Body);
const constitutionInsigniaBody = apply2026InsigniaAmendment(constitution2026Body);
const constitutionMeta = await json(`content/normen/${CONSTITUTION_SLUG}/meta.json`);
constitutionMeta.initialCitation = 'Verfassung des Ostdeutschen Freistaates vom 15. Oktober 2024 (OGVBl. 2024 Nr. II S. 5–32)';
constitutionMeta.enactingNorm = 'gesetz-zur-einsetzung-einer-neuen-landesverfassung';
const managedConstitutionSources = [
  'Gesetze/Staatsverfassung-2024.html',
  'Gesetze/Staatsverfassung-2025.html',
  SOURCES.ii24Pdf.path,
  SOURCES.i25Pdf.path,
  SOURCES.constitutionDocx.path,
];
constitutionMeta.sourceReferences = uniqueSourceReferences(
  constitutionReferences2024,
  constitutionReferences2025,
  withoutLocalSources(constitutionMeta.sourceReferences, managedConstitutionSources),
);
constitutionMeta.affectedByNorms = [
  'gesetz-zur-aenderung-der-landesverfassung-2025',
  promulgationActSlug,
  insigniaActSlug,
  'erstes-gesetz-zur-grossen-staatsreform',
  'zweites-gesetz-zur-grossen-staatsreform',
  'drittes-gesetz-zur-grossen-staatsreform',
  'viertes-gesetz-zur-grossen-staatsreform',
];
constitutionMeta.dateNote = 'Aktuelle redaktionelle Lesefassung vom 21. Juli 2026. Die amtliche Ursprungsbezeichnung lautet „Verfassung des Ostdeutschen Freistaates“. Der fehlerhafte Zielanker im Hoheitszeichengesetz vom 23. März 2026 wird als Einfügung vor dem Wort „Weiß“ ausgelegt.';
await writeJson(`content/normen/${CONSTITUTION_SLUG}/meta.json`, constitutionMeta);
await writeJson(`content/normen/${CONSTITUTION_SLUG}/history.json`, {
  initialVersionId: '2024-10-15',
  entries: [
    {
      date: '2024-10-15',
      type: 'initial',
      title: 'Ursprungsfassung verkündet.',
      citation: 'Verfassung des Ostdeutschen Freistaates vom 15. Oktober 2024 (OGVBl. 2024 Nr. II S. 5–32)',
      affectingVersionId: '2024-10-15',
      relatedNorm: 'gesetz-zur-einsetzung-einer-neuen-landesverfassung',
    },
    {
      date: '2025-03-12',
      type: 'amendment',
      title: 'Artikel 114 neu gefasst und zum Demokratiegebot erweitert.',
      citation: 'Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 15)',
      affectingVersionId: '2025-03-12',
      relatedNorm: 'gesetz-zur-aenderung-der-landesverfassung-2025',
    },
    {
      date: '2026-01-28',
      type: 'amendment',
      title: 'Verkündungsregeln in Artikel 76 geändert.',
      citation: promulgationAct.initialCitation,
      affectingVersionId: '2026-01-28',
      relatedNorm: promulgationActSlug,
    },
    {
      date: '2026-03-24',
      type: 'amendment',
      title: 'Landesfarbe Blau in Artikel 2 Absatz 2 ergänzt.',
      citation: insigniaAct.initialCitation,
      note: 'Der im Änderungsgesetz fehlerhaft bezeichnete Zielanker „nach dem Wort ‚nach‘“ wird redaktionell als „vor dem Wort ‚Weiß‘“ ausgelegt.',
      affectingVersionId: '2026-03-24',
      relatedNorm: insigniaActSlug,
    },
    ...['erstes', 'zweites', 'drittes', 'viertes'].map((ordinal, index) => ({
      date: '2026-07-21',
      type: 'amendment',
      title: `${ordinal[0].toUpperCase()}${ordinal.slice(1)} Gesetz zur Großen Staatsreform berücksichtigt.`,
      citation: `Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. ${53 + index})`,
      affectingVersionId: '2026-07-21',
      relatedNorm: `${ordinal}-gesetz-zur-grossen-staatsreform`,
    })),
  ],
});
await writeJson(`content/normen/${CONSTITUTION_SLUG}/versions/2024-10-15.json`, {
  versionId: '2024-10-15',
  validFrom: '2024-10-15',
  validTo: '2025-03-11',
  isCurrent: false,
  citation: 'Verfassung des Ostdeutschen Freistaates vom 15. Oktober 2024 (OGVBl. 2024 Nr. II S. 5–32)',
  changeNote: 'Amtlich verkündete Ursprungsfassung.',
  sourceReferences: constitutionReferences2024,
  sourceNotes: [{
    label: 'Titel der strukturierten Arbeitsquelle',
    text: 'Das DOCX verwendet die Variante „Verfassung des Freistaates Ostdeutschland“. Maßgeblich für diese Fassung ist die im PDF verkündete Bezeichnung „Verfassung des Ostdeutschen Freistaates“.',
  }],
  body: constitution2024Body,
});
await writeJson(`content/normen/${CONSTITUTION_SLUG}/versions/2025-03-12.json`, {
  versionId: '2025-03-12',
  validFrom: '2025-03-12',
  validTo: '2026-01-27',
  isCurrent: false,
  citation: 'Verfassung des Ostdeutschen Freistaates vom 15. Oktober 2024 (OGVBl. 2024 Nr. II S. 5–32), geändert durch Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 15)',
  changeNote: 'Artikel 114 durch das Gesetz zur Änderung der Landesverfassung neu gefasst.',
  sourceReferences: constitutionReferences2025,
  body: constitution2025Body,
});
await writeJson(`content/normen/${CONSTITUTION_SLUG}/versions/2026-01-28.json`, {
  versionId: '2026-01-28',
  validFrom: '2026-01-28',
  validTo: '2026-03-23',
  isCurrent: false,
  citation: `Verfassung des Ostdeutschen Freistaates vom 15. Oktober 2024, zuletzt geändert durch ${promulgationAct.initialCitation}`,
  changeNote: 'Artikel 76 durch das Gesetz zur Änderung der Verkündungsregeln geändert.',
  sourceReferences: promulgationAct.sourceReferences,
  body: constitution2026Body,
});
await writeJson(`content/normen/${CONSTITUTION_SLUG}/versions/2026-03-24.json`, {
  versionId: '2026-03-24',
  validFrom: '2026-03-24',
  validTo: '2026-07-20',
  isCurrent: false,
  citation: `Verfassung des Ostdeutschen Freistaates vom 15. Oktober 2024, zuletzt geändert durch ${insigniaAct.initialCitation}`,
  changeNote: 'Artikel 2 Absatz 2 um die Landesfarbe Blau ergänzt.',
  sourceReferences: insigniaAct.sourceReferences,
  sourceNotes: [{
    label: 'Redaktionelle Auslegung des Zielankers',
    text: 'Der Änderungssatz nennt „nach dem Wort ‚nach‘“. Er wird entsprechend der ausdrücklich geklärten Regelungsabsicht als Einfügung vor dem Wort „Weiß“ angewendet; der Wortlaut des Änderungsgesetzes bleibt unverändert gespeichert.',
  }],
  body: constitutionInsigniaBody,
});
constitutionCurrent.sourceReferences = uniqueSourceReferences(
  withoutLocalSources(constitutionCurrent.sourceReferences, ['Gesetze/Staatsverfassung.html']),
  [htmlReference('Gesetze/Staatsverfassung.html', 'Redaktionelle Lesefassung vom 21. Juli 2026', 'Gesetze/OGVBl. 2026 Nr. 53.html')],
);
await writeJson(`content/normen/${CONSTITUTION_SLUG}/versions/2026-07-21.json`, constitutionCurrent);

promulgationAct.type = 'aenderungsvorschrift';
promulgationAct.affectedNorms = [...new Set([...(promulgationAct.affectedNorms ?? []), CONSTITUTION_SLUG])];
await writeJson(`content/normen/${promulgationActSlug}/meta.json`, promulgationAct);
insigniaAct.affectedNorms = [...new Set([...(insigniaAct.affectedNorms ?? []), CONSTITUTION_SLUG])];
await writeJson(`content/normen/${insigniaActSlug}/meta.json`, insigniaAct);

const districtMeta = await json(`content/normen/${DISTRICT_SLUG}/meta.json`);
districtMeta.documentDate = '2025-03-06';
districtMeta.publicationDate = '2025-03-12';
districtMeta.effectiveDate = '2025-03-12';
districtMeta.initialCitation = 'Ostdeutsche Bezirksordnung vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–13)';
districtMeta.enactingNorm = 'ostdeutsches-bezirkseinfuehrungsgesetz';
districtMeta.affectedByNorms = ['sportneuordnungsgesetz', 'kreis-und-bezirksneuordnungsgesetz'];
districtMeta.status = 'in-force';
districtMeta.sourceReferences = uniqueSourceReferences(
  [
    htmlReference('Gesetze/Ostdeutsche Bezirksordnung 2025.html', 'Strukturierte Ursprungsfassung der Ostdeutschen Bezirksordnung', SOURCES.i25Pdf.path, '7-13'),
    pdfReference(SOURCES.i25Pdf, 'Amtliches Original-PDF der Ursprungsfassung', 'Gesetze/Ostdeutsche Bezirksordnung 2025.html', '7-13'),
  ],
  withoutLocalSources(
    districtMeta.sourceReferences,
    ['Gesetze/Ostdeutsche Bezirksordnung 2025.html', SOURCES.i25Pdf.path],
  ),
);
await writeJson(`content/normen/${DISTRICT_SLUG}/meta.json`, districtMeta);
await writeJson(`content/normen/${DISTRICT_SLUG}/versions/2025-03-12.json`, {
  versionId: '2025-03-12',
  validFrom: '2025-03-12',
  validTo: '2026-07-31',
  isCurrent: false,
  citation: 'Ostdeutsche Bezirksordnung vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–13)',
  changeNote: 'Durch Artikel 1 des Ostdeutschen Bezirkseinführungsgesetzes eingeführte Stammfassung.',
  sourceReferences: districtMeta.sourceReferences.slice(0, 2),
  body: district2025Body,
});

const [districtReplacementSource, sportMeta, reformMeta] = await Promise.all([
  json(`content/normen/${DISTRICT_SLUG}/versions/2026-08-01.json`),
  json('content/normen/sportneuordnungsgesetz/meta.json'),
  json('content/normen/kreis-und-bezirksneuordnungsgesetz/meta.json'),
]);
const district2026 = {
  ...districtReplacementSource,
  body: applySportAmendmentToDistrictReplacement(districtReplacementSource.body),
};
district2026.citation = 'Ostdeutsche Bezirksordnung vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–13), vollständig abgelöst durch Artikel 2 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 46) und geändert durch Artikel 8 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 52)';
district2026.changeNote = 'Vollständige Ablösung der bisherigen Bezirksordnung durch Artikel 2 des Kreis- und Bezirksneuordnungsgesetzes; die ab 1. August 2026 geltende Neufassung wird zugleich durch Artikel 8 des Sportneuordnungsgesetzes geändert.';
district2026.sourceReferences = uniqueSourceReferences(
  districtReplacementSource.sourceReferences ?? [],
  reformMeta.sourceReferences ?? [],
  sportMeta.sourceReferences ?? [],
);
district2026.isCurrent = false;
await writeJson(`content/normen/${DISTRICT_SLUG}/versions/2026-08-01.json`, district2026);
await writeJson(`content/normen/${DISTRICT_SLUG}/history.json`, {
  initialVersionId: '2025-03-12',
  entries: [
    {
      date: '2025-03-12',
      type: 'initial',
      title: 'Stammfassung durch das Ostdeutsche Bezirkseinführungsgesetz eingeführt.',
      citation: 'Gesetz vom 6. März 2025 (OGVBl. 2025 Nr. 1–7 S. 7–14)',
      affectingVersionId: '2025-03-12',
      relatedNorm: 'ostdeutsches-bezirkseinfuehrungsgesetz',
    },
    {
      date: '2026-08-01',
      type: 'amendment',
      title: 'Bisherige Bezirksordnung vollständig abgelöst.',
      citation: 'Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 46)',
      affectingVersionId: '2026-08-01',
      relatedNorm: 'kreis-und-bezirksneuordnungsgesetz',
    },
    {
      date: '2026-08-01',
      type: 'amendment',
      title: 'Bezirkliche Sportentwicklung und Sportkoordination ergänzt.',
      citation: 'Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 52)',
      note: 'Artikel 8 wird entsprechend der geklärten zeitlichen Zuordnung auf die ab 1. August 2026 geltende Ablösungsfassung angewendet.',
      affectingVersionId: '2026-08-01',
      relatedNorm: 'sportneuordnungsgesetz',
    },
  ],
});

const districtIntroduction = await json('content/normen/ostdeutsches-bezirkseinfuehrungsgesetz/meta.json');
districtIntroduction.enactedNorm = DISTRICT_SLUG;
districtIntroduction.affectedNorms = [...new Set([...(districtIntroduction.affectedNorms ?? []), 'saechsische-landkreisordnung'])];
await writeJson('content/normen/ostdeutsches-bezirkseinfuehrungsgesetz/meta.json', districtIntroduction);

const countyMeta = await json('content/normen/saechsische-landkreisordnung/meta.json');
countyMeta.affectedByNorms = [...new Set([...(countyMeta.affectedByNorms ?? []), 'ostdeutsches-bezirkseinfuehrungsgesetz'])];
await writeJson('content/normen/saechsische-landkreisordnung/meta.json', countyMeta);

const upperSchoolMeta = await json('content/normen/oberstufenund-abiturprufungsverordnung/meta.json');
upperSchoolMeta.affectedByNorms = [...new Set([...(upperSchoolMeta.affectedByNorms ?? []), 'verordnung-aenderung-oberstufen-abiturpruefungsverordnung-2024'])];
await writeJson('content/normen/oberstufenund-abiturprufungsverordnung/meta.json', upperSchoolMeta);

sportMeta.affectedNorms = [...new Set([...(sportMeta.affectedNorms ?? []), DISTRICT_SLUG])];
await writeJson('content/normen/sportneuordnungsgesetz/meta.json', sportMeta);

reformMeta.enactedNorms = (reformMeta.enactedNorms ?? []).filter((slug) => slug !== DISTRICT_SLUG);
reformMeta.affectedNorms = [...new Set([...(reformMeta.affectedNorms ?? []), DISTRICT_SLUG])];
await writeJson('content/normen/kreis-und-bezirksneuordnungsgesetz/meta.json', reformMeta);

const i24 = await json('content/verkuendungen/ogvbl-2024-i.json');
delete i24.pdf;
i24.sourceReferences = [
  publicationPdfReference(SOURCES.i24Pdf, 'Amtliches Original-PDF der Ausgabe', null),
  ...(i24.sourceReferences ?? []).filter((reference) => reference.kind === 'index'),
];
await writeJson('content/verkuendungen/ogvbl-2024-i.json', i24);
const holidayAmendmentPath = 'content/normen/gesetz-zur-anderung-des-gesetzes-uber-sonn-und-feiertage-im-freistaat-ostdeutschland/meta.json';
const holidayAmendment = await json(holidayAmendmentPath);
holidayAmendment.sourceReferences = [
  {
    kind: 'amendment-source',
    label: 'Amtliches Original-PDF OGVBl. 2024 Nr. I',
    availability: 'versioned',
    localSource: SOURCES.i24Pdf.path,
    sha256: SOURCES.i24Pdf.sha256,
    mediaType: SOURCES.i24Pdf.mediaType,
    pageCount: SOURCES.i24Pdf.pageCount,
    pageRange: '1-2',
    verifiedAt: VERIFIED_AT,
    sourceRole: 'amendment-evidence',
  },
];
await writeJson(holidayAmendmentPath, holidayAmendment);

await writeJson('data/recht/alt-source-inventory.json', {
  checkedAt: VERIFIED_AT,
  sources: [
    {
      id: 'ogvbl-ii-2024',
      title: 'Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland, OGVBl Nr. II/24',
      localSource: SOURCES.ii24Pdf.path,
      mediaType: SOURCES.ii24Pdf.mediaType,
      sha256: SOURCES.ii24Pdf.sha256,
      pageCount: SOURCES.ii24Pdf.pageCount,
      sourceRole: 'visual-control',
      derivedSource: 'Gesetze/OGVBl II-24.html',
      verifiedAt: VERIFIED_AT,
      documents: ii24.entries.map(({ normSlug, title, pages }) => ({ normSlug, title, pages })),
    },
    {
      id: 'ogvbl-i-2025',
      title: 'Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland, Ausgabe 1, GVBl Nr. I/25',
      localSource: SOURCES.i25Pdf.path,
      mediaType: SOURCES.i25Pdf.mediaType,
      sha256: SOURCES.i25Pdf.sha256,
      pageCount: SOURCES.i25Pdf.pageCount,
      sourceRole: 'visual-control',
      derivedSource: 'Gesetze/OGVBl I-25.html',
      verifiedAt: VERIFIED_AT,
      documents: i25.entries.map(({ normSlug, title, pages }) => ({ normSlug, title, pages })),
    },
    {
      id: 'staatsverfassung-docx',
      title: 'Strukturtragende DOCX-Quelle der Verfassung vor den Änderungen 2026',
      localSource: SOURCES.constitutionDocx.path,
      mediaType: SOURCES.constitutionDocx.mediaType,
      sha256: SOURCES.constitutionDocx.sha256,
      sourceRole: 'structure-bearing',
      derivedSources: ['Gesetze/Staatsverfassung-2024.html', 'Gesetze/Staatsverfassung-2025.html'],
      verifiedAt: VERIFIED_AT,
      notes: [
        'Das DOCX umfasst in der geprüften Word-Darstellung 37 Seiten.',
        'Der DOCX-Titel weicht von der amtlichen PDF-Bezeichnung ab.',
        'Artikel 114 entspricht bereits dem Änderungsstand vom 12. März 2025 und wurde für die Ursprungsfassung anhand des PDF zurückgeführt.',
      ],
    },
    {
      id: 'ogvbl-i-2024',
      title: 'Ostdeutsches Gesetz- und Verordnungsblatt 2024 Nr. I',
      localSource: SOURCES.i24Pdf.path,
      mediaType: SOURCES.i24Pdf.mediaType,
      sha256: SOURCES.i24Pdf.sha256,
      pageCount: SOURCES.i24Pdf.pageCount,
      sourceRole: 'amendment-evidence',
      verifiedAt: VERIFIED_AT,
      notes: ['Die ungewöhnliche äußere Gliederung Artikel 1, Artikel 2, Artikel 3 und Artikel 6 wurde gegen das Original bestätigt.'],
    },
  ],
});

console.log('Altquellen, elf Einzelakte, Verfassungshistorie und belegte Bezirksfassungen wurden migriert.');
