#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parse, serialize } from 'parse5';
import { parsePublicationHtml } from './lib/norm-html-parser.mjs';
import { parsePublicationMarkdown } from './lib/norm-markdown-parser.mjs';

const ROOT = process.cwd();

function bodyOf(html) {
  const document = parse(html);
  const visit = (node) => {
    if (node.tagName === 'body') return node;
    for (const child of node.childNodes ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  const body = visit(document);
  if (!body) throw new Error('HTML-Quelle besitzt keinen body.');
  return body.childNodes.map((node) => serialize(node)).join('');
}

function page(title, sourceNote, content) {
  return `<section class="source-document"><h2>${title}</h2><p class="source-note">${sourceNote}</p>${content}</section>`;
}

const TRANSCRIBABLE_LEGACY_SOURCES = [
  'OABl. 2025 Nr. 1.md',
  'OABl. 2025 Nr. 3.md',
  'OABl. 2025 Nr. 4.md',
  'OABl. 2025 Nr. 5.md',
  'OABl. 2025 Nr. 6.md',
  'OGVBl. 2025 Nr. 8.md',
  'OGVBl. 2025 Nr. 9.md',
  'OGVBl. 2025 Nr. 11.md',
  'OGVBl. 2025 Nr. 12.md',
  'OGVBl. 2026 Nr. 12.md',
  'OGVBl. 2026 Nr. 44.md',
];

const STRUCTURE_TYPES = new Set([
  'part', 'chapter', 'section', 'subsection', 'article', 'paragraph', 'annex',
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function germanDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ];
  return `${Number(day)}. ${months[Number(month) - 1]} ${year}`;
}

function sourcePlace(markdown) {
  return markdown.match(/Ausgegeben\s+(?:zu|in)\s+([^|\n]+?)\s+am/iu)?.[1]
    ?.replace(/\s+/gu, ' ')
    .trim() ?? 'Leipzig';
}

function headingText(block) {
  return [block.label, block.title].filter(Boolean).join(' ');
}

function listStartValue(label, style) {
  const visible = String(label ?? '').replace(/^\(/u, '').replace(/[.)]$/u, '');
  if (style === 'decimal' || style === 'decimal-parenthesized') {
    const value = Number.parseInt(visible, 10);
    return Number.isInteger(value) ? value : null;
  }
  if (style === 'lower-latin' || style === 'upper-latin') {
    if (!/^[a-z]+$/iu.test(visible)) return null;
    return [...visible.toLocaleLowerCase('de')].reduce((total, character) => total * 26 + character.charCodeAt(0) - 96, 0);
  }
  if (style === 'lower-roman' || style === 'upper-roman') {
    const values = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    let total = 0;
    let previous = 0;
    for (const character of [...visible.toLocaleLowerCase('de')].reverse()) {
      const value = values[character];
      if (!value) return null;
      total += value < previous ? -value : value;
      previous = Math.max(previous, value);
    }
    return total || null;
  }
  return null;
}

function listTagAndAttributes(block) {
  const style = block.numberingStyle ?? 'decimal';
  if (style === 'bullet' || block.label === '–') return { tag: 'ul', attributes: '' };
  const type = {
    decimal: '1',
    'decimal-parenthesized': '1',
    'lower-latin': 'a',
    'upper-latin': 'A',
    'lower-roman': 'i',
    'upper-roman': 'I',
  }[style] ?? '1';
  const firstLabel = String(block.label ?? '');
  const decoration = firstLabel.match(/^(\()?[^\s]+([.)])$/u);
  const start = listStartValue(firstLabel, style);
  const attributes = [
    `type="${type}"`,
    start && start > 1 ? `start="${start}"` : '',
    style === 'decimal-parenthesized' || decoration?.[1] ? 'data-label-style="parenthesized"' : '',
    decoration?.[2] && !decoration[1] ? `data-label-suffix="${decoration[2]}"` : '',
  ].filter(Boolean).join(' ');
  return { tag: 'ol', attributes: attributes ? ` ${attributes}` : '' };
}

function isListEntry(block) {
  return block?.type === 'item' || block?.type === 'subitem';
}

function detachedChildren(block) {
  return (block.children ?? []).filter((child) => child.type === 'quotedProvision' || STRUCTURE_TYPES.has(child.type));
}

function serializeTable(block) {
  const rows = (block.children ?? []).map((row) => `<tr>${(row.children ?? []).map((cell) => {
    const tag = cell.type === 'tableHeaderCell' ? 'th' : 'td';
    return `<${tag}>${escapeHtml(cell.text)}</${tag}>`;
  }).join('')}</tr>`).join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

function serializeListGroup(entries) {
  const first = entries[0];
  const { tag, attributes } = listTagAndAttributes(first);
  const detached = [];
  const items = entries.map((entry) => {
    const nestedEntries = (entry.children ?? []).filter(isListEntry);
    const inlineParagraphs = (entry.children ?? [])
      .filter((child) => child.type === 'paragraphText')
      .map((child) => `<p>${escapeHtml(child.text)}</p>`)
      .join('');
    const nested = nestedEntries.length > 0 ? serializeFlow(nestedEntries) : '';
    detached.push(...detachedChildren(entry));
    return `<li>${escapeHtml(entry.text)}${inlineParagraphs}${nested}</li>`;
  }).join('');
  return { markup: `<${tag}${attributes}>${items}</${tag}>`, detached };
}

function serializeSubparagraphGroup(entries) {
  const first = entries[0];
  const { tag, attributes } = listTagAndAttributes({ ...first, numberingStyle: 'decimal-parenthesized' });
  const items = entries.map((entry) => (
    `<li>${escapeHtml(entry.text)}${serializeFlow(entry.children ?? [])}</li>`
  )).join('');
  return `<${tag}${attributes}>${items}</${tag}>`;
}

function serializeFlow(blocks) {
  let output = '';
  for (let index = 0; index < (blocks ?? []).length;) {
    const block = blocks[index];
    if (isListEntry(block)) {
      const entries = [];
      while (index < blocks.length && isListEntry(blocks[index])) {
        entries.push(blocks[index]);
        index += 1;
        if (detachedChildren(entries.at(-1)).length > 0) break;
      }
      const serialized = serializeListGroup(entries);
      output += serialized.markup;
      for (const detached of serialized.detached) output += serializeFlow([detached]);
      continue;
    }
    if (block.type === 'paragraphText') {
      output += `<p>${escapeHtml(block.text)}</p>`;
    } else if (block.type === 'subparagraph') {
      const subparagraphs = [];
      while (index < blocks.length && blocks[index].type === 'subparagraph') {
        subparagraphs.push(blocks[index]);
        index += 1;
      }
      output += serializeSubparagraphGroup(subparagraphs);
      continue;
    } else if (STRUCTURE_TYPES.has(block.type)) {
      const attributes = [
        `data-structure-type="${escapeHtml(block.type)}"`,
        `data-structure-label="${escapeHtml(block.label)}"`,
        block.title ? `data-structure-title="${escapeHtml(block.title)}"` : '',
      ].filter(Boolean).join(' ');
      output += `<h2 ${attributes}>${escapeHtml(headingText(block))}</h2>${serializeFlow(block.children ?? [])}`;
    } else if (block.type === 'table') {
      output += serializeTable(block);
    } else if (block.type === 'quotedProvision') {
      output += serializeFlow(block.children ?? []);
    }
    index += 1;
  }
  return output;
}

function publicationHeading(parsed) {
  if (parsed.abbr && parsed.shortTitle !== parsed.title) {
    return `${parsed.title} (${parsed.shortTitle} – ${parsed.abbr})`;
  }
  return parsed.title;
}

function transcribePublication(markdownFileName, markdown) {
  const parsed = parsePublicationMarkdown(markdownFileName, markdown);
  const htmlFileName = markdownFileName.replace(/\.md$/u, '.html');
  const longName = parsed.publication === 'OABl.'
    ? 'Amtsblatt'
    : 'Gesetz- und Verordnungsblatt';
  const date = germanDate(parsed.publicationDate);
  const documentDate = germanDate(parsed.documentDate);
  const heading = publicationHeading(parsed);
  const page = parsed.startPage ?? '2';
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title></head><body>
<header><p>${longName}</p><p>für den Freistaat Ostdeutschland.</p><p>Nr. ${escapeHtml(parsed.issue)} ·</p><p>Ausgegeben zu ${escapeHtml(sourcePlace(markdown))} am ${date}</p></header>
<p>Inhaltsverzeichnis</p>
<table><tbody><tr><td>${documentDate}</td><td>${escapeHtml(heading)}</td><td>Seite ${escapeHtml(page)}</td></tr></tbody></table>
<h2>${escapeHtml(heading)}</h2><p>vom ${documentDate}</p>
${serializeFlow(parsed.body)}
</body></html>
`;
  const validated = parsePublicationHtml(htmlFileName, html);
  if (
    validated.publication !== parsed.publication
    || validated.issue !== parsed.issue
    || validated.documentDate !== parsed.documentDate
    || validated.title !== parsed.title
  ) {
    throw new Error(`${htmlFileName}: generierte Transkription weicht bei Ausgabeidentität oder Normtitel ab.`);
  }
  return html;
}

function issueHtml({ title, designation, date, toc, documents }) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title}</title></head><body>
<header><h1>${title}</h1><p>${designation}</p><p>Ausgegeben am ${date}</p></header>
<nav aria-label="Inhaltsverzeichnis der Ausgabe"><h2>Inhaltsverzeichnis</h2><ol>${toc.map((entry) =>
    `<li>${entry.title}, ${entry.date}, Seite ${entry.pages}</li>`).join('')}</ol></nav>
${documents.join('\n')}
</body></html>\n`;
}

const constitution2024 = bodyOf(await readFile(resolve(ROOT, 'Gesetze/Staatsverfassung-2024.html'), 'utf8'));
const districts2025 = bodyOf(await readFile(resolve(ROOT, 'Gesetze/Ostdeutsche Bezirksordnung 2025.html'), 'utf8'));

const ii24 = issueHtml({
  title: 'Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland',
  designation: 'OGVBl Nr. II/24',
  date: '15. Oktober 2024',
  toc: [
    { title: 'Verordnung über die Änderung der Oberstufen- und Abiturprüfungsverordnung', date: '16. September 2024', pages: '2' },
    { title: 'Organisationserlass über die Änderung der Fachbereichszuteilung zu den Staatsministerien', date: '23. September 2024', pages: '3' },
    { title: 'Dienstanordnung anlässlich der momentanen Terrorgefahr', date: '2. Oktober 2024', pages: '4' },
    { title: 'Gesetz zur Einsetzung einer neuen Landesverfassung', date: '14. Oktober 2024', pages: '5 bis 32' },
  ],
  documents: [
    page(
      'Verordnung über die Änderung der Oberstufen- und Abiturprüfungsverordnung',
      'Dokumentdatum 16. September 2024 · Seite 2',
      `<p>Die Ostdeutsche Staatsregierung hat am 16. September 2024 die folgende Verordnung erlassen:</p>
<h3>Paragraph 1</h3><h4>Lorem Ipsum</h4>
<p>Der Paragraph 9 der Oberstufen- und Abiturprüfungsverordnung wird wie folgt geändert:</p>
<ol><li>Der Absatz 1 wird wie folgt geändert:
<blockquote><p>„(1) Jeder Schüler mit Ausnahme der in Absatz 3 genannten Schüler wählt aus dem Angebot seiner Schule Leistungskurse in zwei Fächern des Pflichtbereichs. Erstes Leistungskursfach ist Deutsch, Mathematik oder eine fortgeführte Fremdsprache. Folgende Leistungskurskombinationen sind zulässig.</p>
<ol><li>Deutsch – Mathematik,</li><li>Deutsch – fortgeführte Fremdsprache,</li><li>Deutsch – Biologie oder Chemie oder Physik,</li><li>Deutsch – Geschichte,</li><li>Deutsch – Gesellschaft, Rechtswissenschaften und Wirtschaft,</li><li>Mathematik – Gesellschaft, Rechtswissenschaften und Wirtschaft,</li><li>Mathematik – fortgeführte Fremdsprache,</li><li>Mathematik – Biologie oder Chemie oder Physik,</li><li>Mathematik – Geschichte,</li><li>fortgeführte Fremdsprache – Geschichte,</li><li>Gesellschaft, Rechtswissenschaften und Wirtschaft – Biologie oder Chemie oder Physik,</li><li>Gesellschaft, Rechtswissenschaften und Wirtschaft – fortgeführte Fremdsprache,</li><li>Gesellschaft, Rechtswissenschaften und Wirtschaft – Geschichte.“</li></ol></blockquote></li>
<li>Dem Paragraphen werden die folgenden Absätze 5 und 6 angefügt:
<blockquote><p>„(5) Sollte eine Schule weniger als fünfzig Lehrer in Vollzeit angestellt haben, so finden die Buchstaben 4, 5, 10 und 13 des Absatzes 1 keine Anwendung.</p><p>(6) Die Vorgaben aus Absatz 1 Buchstaben 5, 6, 11, 12 und 13 treten zum Beginn des Schuljahres 2025/2026 in Kraft.“</p></blockquote></li></ol>
<h3>Paragraph 2</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am Tage der Verkündung in Kraft.</p>`,
    ),
    page(
      'Organisationserlass über die Änderung der Fachbereichszuteilung zu den Staatsministerien',
      'Dokumentdatum 23. September 2024 · Seite 3',
      `<p>Die Ostdeutsche Staatsregierung hat am 23. September 2024 die folgende Verordnung erlassen:</p>
<h3>Paragraph 1</h3><h4>Änderung der Fachbereichszuteilungen</h4><p>Der Fachbereich „Angelegenheiten der nationalen Minderheit der Sorbinnen und Sorben“ wird der Staatskanzlei zugeordnet.</p>
<h3>Paragraph 2</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am Tage der Verkündung in Kraft.</p>`,
    ),
    page(
      'Dienstanordnung anlässlich der momentanen Terrorgefahr',
      'Das Inhaltsverzeichnis nennt den 2. Oktober 2024; der Einleitungssatz nennt den 23. September 2024 · Seite 4',
      `<p>Die Ostdeutsche Staatsregierung hat am 23. September 2024 die folgende Verordnung erlassen:</p>
<h3>Paragraph 1</h3><h4>Schutz von Mitarbeitern der Staatsregierung</h4><p>Alle Mitarbeiter der Staatsregierung werden dazu angewiesen aufgrund der imminenten Terrorgefahr gegen staatliche Einrichtungen von Zuhause zu arbeiten.</p>
<h3>Paragraph 2</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am Tage der Verkündung in Kraft.</p>`,
    ),
    page(
      'Gesetz zur Einsetzung einer neuen Landesverfassung',
      'Dokumentdatum 14. Oktober 2024 · Seiten 5 bis 32',
      `<p>Der Ostdeutsche Landtag hat am 14. Oktober 2024 folgendes Gesetz beschlossen:</p>
<h3>Artikel 1</h3><p>Die bisherige Verfassung des Freistaates Ostdeutschland, zuletzt geändert am 11. Juli 2013, wird aufgehoben.</p>
<h3>Artikel 2</h3><p>Der nachstehende Entwurf wird als neue Landesverfassung eingesetzt:</p>
<section class="enacted-law">${constitution2024}</section>
<h3>Artikel 3</h3><p>Das Gesetz tritt am Tage seiner Verkündung in Kraft.</p>`,
    ),
  ],
});

const i25 = issueHtml({
  title: 'Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland',
  designation: 'Ausgabe 1 · GVBl Nr. I/25',
  date: '12. März 2025',
  toc: [
    { title: 'Organisationserlass über die Neueinteilung der Fachbereiche von Staatsministerien', date: '8. Oktober 2024', pages: '2' },
    { title: 'Bekanntmachung des Verbotes der Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“', date: '11. November 2024', pages: '3' },
    { title: 'Dienstanordnung zum Schutze der Geflüchtetenunterkünfte im Lande', date: '20. November 2024', pages: '4' },
    { title: 'Dienstanordnung zur Sicherung der öffentlichen Sicherheit in der Silvesternacht', date: '31. Dezember 2024', pages: '5' },
    { title: 'Organisationserlass über die Neugliederung einiger Ministerien', date: '22. Januar 2025', pages: '6' },
    { title: 'Gesetz zur Einführung von Bezirken (Ostdeutsches Bezirkseinführungsgesetz)', date: '6. März 2025', pages: '7 bis 14' },
    { title: 'Gesetz zur Änderung der Landesverfassung', date: '6. März 2025', pages: '15' },
  ],
  documents: [
    page(
      'Organisationserlass über die Neueinteilung der Fachbereiche von Staatsministerien',
      'Dokumentdatum 8. Oktober 2024 · Seite 2',
      `<p>Die Ostdeutsche Staatsregierung hat am 8. Oktober 2024 folgende Verordnung verkündet.</p>
<h3>Paragraph 1</h3><h4>Neueinteilung der Fachbereiche</h4><p>Das Staatsministerium für Umwelt, Landwirtschaft &amp; Klimaschutz wird aufgelöst. Die Fachbereiche werden dem Staatsministerium Infrastruktur &amp; Verkehr zugeteilt.</p>
<h3>Paragraph 2</h3><h4>Umbenennung des Staatsministeriums für Infrastruktur &amp; Verkehr</h4><p>Das Staatsministerium für Infrastruktur &amp; Verkehr wird in Staatsministerium für Infrastruktur, Verkehr &amp; Umweltschutz umbenannt.</p>
<h3>Paragraph 3</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am Tage ihrer Verkündung in Kraft.</p>`,
    ),
    page(
      'Bekanntmachung des Verbotes der Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“',
      'Dokumentdatum 11. November 2024 · Seite 3',
      `<p>Die Ostdeutsche Staatsregierung hat am 11. November 2024 folgende Verordnung verkündet.</p>
<h3>Paragraph 1</h3><h4>Verfügung</h4><ol>
<li>Die Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“ richtet sich gegen die verfassungsmäßige Ordnung.</li>
<li>Die Vereinigung „Sachsen den Sachsen, Deutschland den Deutschen e.V.“ ist verboten. Das Verbot erstreckt sich darüberhinaus auf alle Teilorganisationen, insbesondere auf die Jugendorganisation der Vereinigung.</li>
<li>Es ist verboten, Ersatzorganisationen für die verbotenen Vereinigungen zu bilden oder bestehende Organisationen als Ersatzorganisationen fortzuführen.</li>
<li>Der Betrieb jeglicher Öffentlichkeitspräsenz der Vereinigung und all ihrer Teilorganisationen wird eingestellt, dazu gehört insbesondere der Betrieb der Internetseiten und von Profilen in sozialen Medien.</li>
<li>Kennzeichen der Vereinigung und all ihrer Teilorganisationen dürfen für die Dauer der Vollziehbarkeit des Verbots nicht öffentlich, in einer Versammlung oder in Schrift, Ton- oder Bildträgern, Abbildungen oder Darstellungen, die verbreitet werden oder zur Verbreitung bestimmt sind, verwendet werden.</li>
<li>Das Vermögen der Vereinigung und all ihrer Teilorganisationen wird beschlagnahmt und eingezogen.</li>
<li>Forderungen und Sachen Dritter werden beschlagnahmt und eingezogen, soweit der Berechtigte durch Überlassung der Sachen an die Vereinigung oder einer ihrer Teilorganisationen deren verfassungswidrige Bestreben vorsätzlich gefördert hat oder die Sachen zur Förderung dieser Bestrebungen bestimmt hat.</li></ol>
<h3>Paragraph 2</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am Tage ihrer Verkündung in Kraft.</p>`,
    ),
    page(
      'Dienstanordnung zum Schutze der Geflüchtetenunterkünfte im Lande',
      'Dokumentdatum 20. November 2024 · Seite 4',
      `<p>Die Ostdeutsche Staatsregierung hat am 20. November 2024 folgende Verordnung verkündet.</p>
<h3>Paragraph 1</h3><h4>Polizeipräsenz bei allen Geflüchtetenunterkünften</h4><ol>
<li>Es wird angeordnet, dass ab sofort vor jeder Geflüchtetenunterkunft auf dem Gebiet des Freistaates Ostdeutschland Polizisten der ostdeutschen Landespolizei zum Schutze der Unterkünfte, ihrer Bewohner und des dort arbeitenden Personals stationiert wird.</li>
<li>Die Aufgaben der Polizisten vor Ort beziehen sich auf<ol type="a"><li>die präventive Überwachung der Unterkunft und ihres Umfeldes,</li><li>die Deeskalation im Konfliktfall und</li><li>die Prävention von Straftaten, welche sich gegen die Unterkunft richten.</li></ol></li>
<li>In einem Umkreis von 100 Metern um die gesamte Unterkunft gilt nach § 42 Absatz 5 des Waffengesetzes ein generelles Verbot Waffen zu führen.</li></ol>
<h3>Paragraph 2</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am Tage der Verkündung in Kraft und am 20.01.2025 außer Kraft. Sollte sich die besondere Gefahrenlage über einen längeren oder kürzeren Zeitraum erstrecken als eigentlich durch das Außerkrafttreten geregelt, kann das Staatsministerium diese Dienstanordnung verkürzen oder verlängern.</p>`,
    ),
    page(
      'Dienstanordnung zur Sicherung der öffentlichen Sicherheit in der Silvesternacht',
      'Dokumentdatum 31. Dezember 2024 · Seite 5',
      `<p>Die Ostdeutsche Staatsregierung hat am 31. Dezember 2024 folgende Verordnung verkündet.</p>
<h3>Paragraph 1</h3><h4>Dienstanordnung</h4><ol><li>In Innenstädten und an Orten von großen öffentlichen Ansammlungen<ol type="a"><li>unterstützt die Polizei jegliche eingeteilte Rettungsdienste bei der Errichtung von Zelten und Plätzen zur Erstversorgung,</li><li>bereitet sich die Feuerwehr im Falle einer Überlastung der Rettungsdienste auf entlastende Erste Hilfe Maßnahmen vor und</li><li>wird die Polizeipräsenz erhöht.</li></ol></li><li>Die genaue Festlegung der Zahlen und Räume obliegt den kommunalen Entscheidungsträgern.</li></ol>
<h3>Paragraph 2</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am 31.12.2024 um 20:00 Uhr in Kraft und am 01.01.2025 um 08:00 Uhr in Kraft.</p>`,
    ),
    page(
      'Organisationserlass über die Neugliederung einiger Ministerien',
      'Dokumentdatum 22. Januar 2025 · Seite 6',
      `<p>Die Ostdeutsche Staatsregierung hat am 22. Januar 2025 folgende Verordnung verkündet.</p>
<h3>Paragraph 1</h3><h4>Aussetzung eines Erlasses</h4><p>Der Organisationserlass über die Neueinteilung der Fachbereiche von Staatsministerien vom 8. November 2024 wird außer Kraft gesetzt.</p>
<h3>Paragraph 2</h3><h4>Ausgliederung eines Fachbereiches</h4><p>Es wird ein neues Staatsministerium der Gesundheit gegründet, der Gesundheitsbereich wird aus dem Staatsministerium für Arbeit, Soziales, Gesellschaft &amp; Gesundheit ausgegliedert, womit dieses künftig den Titel Staatsministerium für Arbeit, Soziales &amp; Gesellschaft trägt.</p>
<h3>Paragraph 3</h3><h4>Inkrafttreten, Außerkrafttreten</h4><p>Die Verordnung tritt am Tage der Verkündung in Kraft.</p>`,
    ),
    page(
      'Gesetz zur Einführung von Bezirken (Ostdeutsches Bezirkseinführungsgesetz)',
      'Dokumentdatum 6. März 2025 · Seiten 7 bis 14',
      `<p>Der Ostdeutsche Landtag hat am 6. März 2025 folgendes Gesetz beschlossen:</p>
<h3>Artikel 1</h3><section class="enacted-law">${districts2025}</section>
<h3>Artikel 2 – Änderung der Landkreisordnung des ostdeutschen Freistaates</h3><p>Die Landkreisordnung des Ostdeutschen Freistaates vom 9. März 2018 wird wie folgt geändert:</p><ol><li>Im § 75 wird „die Landesdirektion Ostdeutschland“ durch „der jeweilige Bezirk“ ersetzt.</li></ol>
<h3>Artikel 3 – Änderung des Gesetzes zur Raumordnung und Landesplanung des Freistaates Ostdeutschland</h3><p>Das Gesetz zur Raumordnung und Landesplanung des Freistaates Ostdeutschland vom 11. Dezember 2018 wird wie folgt geändert:</p><ol><li>Im § 19 wird „die Landesdirektion Ostdeutschland“ durch „der jeweilige Bezirk“ ersetzt.</li></ol>
<h3>Artikel 4 – Änderung des Gesetzes über die Verwaltungsorganisation des Freistaates Ostdeutschland</h3><p>Das Gesetz über die Verwaltungsorganisation des Freistaates Ostdeutschland vom 25. November 2003, zuletzt geändert am 20. Dezember 2022, wird wie folgt geändert:</p><ol><li>Der § 6 wird wie folgt neugefasst:<blockquote><p>„(1) Allgemeine Staatsbehörde sind die jeweiligen Bezirke, auf dessen Gebiet die Verwaltungsaufgabe zutrifft. Die Bezirke sind dem Staatsministerium direkt nachgeordnet.</p><p>(2) Die Bezirke nehmen Aufgaben aus mehreren Staatsministerien wahr und koordinieren die staatliche Verwaltungstätigkeit im gesamten Freistaat. Sie sind, soweit nichts anderes bestimmt ist, höhere Verwaltungsbehörde im Sinne bundesrechtlicher Vorschriften. Die Bezirke nehmen die Aufgaben des Landesamtes zur Regelung offener Vermögensfragen und die Aufgaben der verwaltungsrechtlichen und beruflichen Rehabilitierung wahr.“</p></blockquote></li><li>Der § 6 wird in „Bezirke“ umbenannt.</li></ol>
<h3>Artikel 5 – Inkrafttreten</h3><p>Das Gesetz tritt am Tage seiner Verkündung in Kraft.</p>`,
    ),
    page(
      'Gesetz zur Änderung der Landesverfassung',
      'Dokumentdatum 6. März 2025 · Seite 15',
      `<p>Der Ostdeutsche Landtag hat am 6. März 2025 folgendes Gesetz beschlossen.</p>
<h3>Artikel 1 – Änderung der Verfassung des Ostdeutschen Freistaates</h3><p>Die Verfassung des Ostdeutschen Freistaates vom 15.10.2024, wird wie folgt geändert:</p><ol><li>Der Artikel 114 wird wie folgt geändert:<ol type="a"><li>Der Artikel wird in „Artikel 114 Demokratiegebot“ umbenannt.</li><li>Der Absatz 1 wird wie folgt neu gefasst: <blockquote>„Keinerlei Verfassungs- oder Gesetzes- oder Verordnungsänderung oder -einführung darf den Grundgedanken des demokratischen, republikanischen Rechtsstaates und der parlamentarischen Staatsform antasten.“</blockquote></li><li>Dem Artikel wird ein folgender Absatz 2 angefügt: <blockquote>„Die Errichtung einer Diktatur, unabhängig der Form, ist verboten.“</blockquote></li><li>Dem Artikel wird ein folgender Absatz 3 angefügt: <blockquote>„Den in Absatz 1 und 2 genannten Vorschriften widersprechende Gesetze, Verordnungen und Beschlüsse sind nicht auszuarbeiten, nicht zu verkünden, oder, bei vorausgegangener Verkündung, nicht zu befolgen.“</blockquote></li></ol></li></ol>
<h3>Artikel 2 – Inkrafttreten</h3><p>Das Gesetz tritt am Tage seiner Verkündung in Kraft.</p>`,
    ),
  ],
});

await writeFile(resolve(ROOT, 'Gesetze/OGVBl II-24.html'), ii24);
await writeFile(resolve(ROOT, 'Gesetze/OGVBl I-25.html'), i25);

for (const markdownFileName of TRANSCRIBABLE_LEGACY_SOURCES) {
  const markdown = await readFile(resolve(ROOT, 'Gesetze', markdownFileName), 'utf8');
  const htmlFileName = markdownFileName.replace(/\.md$/u, '.html');
  await writeFile(resolve(ROOT, 'Gesetze', htmlFileName), transcribePublication(markdownFileName, markdown));
}
console.log('Strukturierte Altquellen-Transkriptionen wurden neu erzeugt.');
