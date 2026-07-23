#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parse, serialize } from 'parse5';

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
console.log('Strukturierte Altquellen-Transkriptionen wurden neu erzeugt.');
