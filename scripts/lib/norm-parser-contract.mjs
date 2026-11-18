/**
 * Quellbefunde, die eine amtliche Quelle nachweislich selbst trägt: Nummerierungsbefunde und
 * Tabellenzellen, deren Inhalt nur als Abbildung ohne Textalternative vorliegt. Der Parser lässt
 * genau diese Befunde je Datei zu (`parsePublicationHtml(…, { acceptedSequenceIssues })`); der
 * Nachweis nennt die PDF-Seite, auf der der Befund sichtbar ist. Jeder andere Befund bleibt
 * ein Abbruchgrund.
 */
export const ACCEPTED_SEQUENCE_ISSUES = {
  'OGVBl. 2026 Nr. 21.html': {
    issues: ['Artikel 1 > 4.: lückenhafte Nummerierungsfolge oder nicht aufgelöster Listenwechsel (2. → 4.)'],
    evidence: 'PDF S. 5 und HTML: Artikel 1 Nummer 3 steht als leere Nummer zwischen Nummer 2 und Nummer 4.',
  },
  'OGVBl. 2026 Nr. 47.html': {
    issues: ['Artikel 4 > 3.: doppeltes Gliederungszeichen (3. → 3.)'],
    evidence: 'PDF S. 39–42 und HTML (start="3"): Artikel 4 zählt die Änderungsbefehle 1., 2., 3., 3.; der Befehl zu § 7 trägt wie der vorangehende die Nummer 3.',
  },
  'StAnzO. 2026 Nr. 7.html': {
    issues: [1, 2, 3, 4].map((row) =>
      `I. > 2. > quotedProvision[0] > ANLAGE 8 (zu Nummer 6.4) > table[0] > Zeile ${row}, Zelle 2: Abbildung ohne Textalternative`),
    evidence: 'PDF S. 2–3 und HTML: Die zweite Spalte der Anlage 8 zeigt je eine Kennzeichnungsgrafik der Geheimhaltungsstufe (Bilddateien ohne Textalternative); der Wortlaut der Grafiken ist nicht als Text verfügbar.',
  },
  'OGVBl. 2026 Nr. 18.html': {
    issues: ['Artikel 1 > 7.: lückenhafte Nummerierungsfolge oder nicht aufgelöster Listenwechsel (5. → 7.)'],
    evidence: 'PDF S. 5 und HTML: Artikel 1 Nummer 6 steht als leere Nummer zwischen Nummer 5 und Nummer 7.',
  },
};

export function acceptedSequenceIssuesFor(fileName) {
  return ACCEPTED_SEQUENCE_ISSUES[fileName]?.issues ?? [];
}

/**
 * Jede Ausgabe mit zugelassenem Quellbefund erhält in der Importkonfiguration einen
 * nutzerorientierten `sourceNotes`-Hinweis (docs/NORM_WORKFLOW.md). Liefert die Dateien, für die
 * `notesByFile` ({ [Datei]: { [Normslug]: Hinweise[] } }) keinen solchen Hinweis enthält.
 */
export function filesWithoutSourceNote(notesByFile, accepted = ACCEPTED_SEQUENCE_ISSUES) {
  return Object.keys(accepted).filter((fileName) =>
    !Object.values(notesByFile?.[fileName] ?? {}).some((notes) =>
      Array.isArray(notes) && notes.some((note) => note?.label && note?.text)));
}

/**
 * Ergänzt Quellhinweise einer Fassung um konfigurierte Hinweise. Ein gleichnamiger vorhandener
 * Hinweis wird durch den konfigurierten ersetzt, damit ein erneutes Einlesen nichts verdoppelt.
 */
export function withSourceNotes(existingNotes, addedNotes) {
  const added = (addedNotes ?? []).filter((note) => note?.label && note?.text);
  if (!added.length) return existingNotes ?? undefined;
  const addedLabels = new Set(added.map((note) => note.label));
  return [...(existingNotes ?? []).filter((note) => !addedLabels.has(note?.label)), ...added];
}

function flatten(blocks, output = []) {
  for (const block of blocks ?? []) {
    output.push(block);
    flatten(block.children, output);
  }
  return output;
}

function textOf(blocks) {
  return flatten(blocks)
    .map((block) => [block.label, block.title, block.text].filter(Boolean).join(' '))
    .join(' ');
}

function flattenWithQuoteState(blocks, output = [], insideQuote = false) {
  for (const block of blocks ?? []) {
    const quoted = insideQuote || block.type === 'quotedProvision';
    output.push({ block, insideQuote });
    flattenWithQuoteState(block.children, output, quoted);
  }
  return output;
}

export function validatePublicationParserContract(parsed) {
  const issues = [];
  const issueNumber = Number(parsed.issue);
  if (issueNumber >= 46 && issueNumber <= 57) {
    if (parsed.documentDate !== '2026-07-20') issues.push('Dokumentdatum muss 2026-07-20 sein');
    if (parsed.publicationDate !== '2026-07-20') issues.push('Veröffentlichungsdatum muss 2026-07-20 sein');
  }
  if (issueNumber === 58) {
    if (parsed.documentDate !== '2026-07-20') issues.push('Dokumentdatum muss 2026-07-20 sein');
    if (parsed.publicationDate !== '2026-07-21') issues.push('Veröffentlichungsdatum muss 2026-07-21 sein');
  }

  if (issueNumber === 53) {
    const flat = flattenWithQuoteState(parsed.body);
    const outerArticles = flat
      .filter(({ block, insideQuote }) => !insideQuote && block.type === 'article')
      .map(({ block }) => block.label);
    if (JSON.stringify(outerArticles) !== JSON.stringify(['Artikel 1', 'Artikel 2'])) {
      issues.push(`äußere Artikel sind ${JSON.stringify(outerArticles)} statt ["Artikel 1","Artikel 2"]`);
    }
    const quotedArticle5 = flat.find(({ block, insideQuote }) => insideQuote && block.type === 'article' && block.label === 'Artikel 5');
    if (!quotedArticle5) issues.push('Artikel 5 wurde nicht als zitierte Neufassung erkannt');
    const firstItem = parsed.body.find((block) => block.label === 'Artikel 1')?.children?.find((block) => block.type === 'item');
    if (firstItem?.label !== '1.' || firstItem.children?.[0]?.label !== 'a.' || firstItem.children?.[0]?.children?.[0]?.label !== 'i.') {
      issues.push('Änderungshierarchie 1. → a. → i. wurde nicht rekonstruiert');
    }
    const firstItemLabels = firstItem?.children?.map((block) => block.label) ?? [];
    if (JSON.stringify(firstItemLabels) !== JSON.stringify(['a.', 'b.', 'c.', 'd.', 'e.'])) {
      issues.push(`Geschwisterfolge unter Nummer 1 ist ${JSON.stringify(firstItemLabels)} statt ["a.","b.","c.","d.","e."]`);
    }
    const letterD = firstItem?.children?.find((block) => block.label === 'd.');
    const letterE = firstItem?.children?.find((block) => block.label === 'e.');
    const quotedArticle5Paragraphs = flattenWithQuoteState(letterD?.children)
      .filter(({ block, insideQuote }) => insideQuote && block.type === 'subparagraph')
      .map(({ block }) => block.label);
    if (JSON.stringify(quotedArticle5Paragraphs) !== JSON.stringify(['(1)', '(2)', '(3)'])) {
      issues.push(`zitierter Artikel 5 enthält die Absatzkennzeichnungen ${JSON.stringify(quotedArticle5Paragraphs)} statt ["(1)","(2)","(3)"]`);
    }
    if (!letterE?.text?.startsWith('Artikel 6 wird wie folgt geändert')) {
      issues.push('Artikel 6 wurde nicht als Buchstabe e. unter Nummer 1 erkannt');
    }
  }
  return issues;
}

export function validateConstitutionParserContract(parsed) {
  const issues = [];
  const article120 = flatten(parsed.body).find((block) => block.type === 'article' && block.label === 'Artikel 120');
  const labels = article120?.children
    ?.filter((block) => block.type === 'subparagraph' || block.type === 'item')
    .map((block) => block.label) ?? [];
  if (JSON.stringify(labels) !== JSON.stringify(['(1)', '(1a)', '(1b)', '(2)'])) {
    issues.push(`Artikel 120 enthält die Absatzkennzeichnungen ${JSON.stringify(labels)} statt ["(1)","(1a)","(1b)","(2)"]`);
  }
  const text = textOf(parsed.body);
  if (!text.includes('Siebte Volkskammer ist der siebte Landtag. Die Wahl zur achten Volkskammer findet Ende August statt.')) {
    issues.push('die Lesefassung enthält nicht den quellentreuen Wortlaut von Artikel 121a');
  }
  return issues;
}
