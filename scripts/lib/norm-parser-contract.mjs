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
    const text = textOf(parsed.body);
    if (!text.includes('Siebte Volkskammer ist der siebte Landtag. Die Wahl zur achten Volkskammer findet Ende August statt.')) {
      issues.push('Artikel 121a weicht vom bestätigten Wortlaut „Siebte … achte“ ab');
    }
    if (text.includes('Achte Volkskammer ist der achte Landtag')) issues.push('Artikel 121a enthält die verworfene Fassung „Achte … neunte“');
  }
  return issues;
}

export function validateConstitutionParserContract(parsed) {
  const issues = [];
  const article120 = flatten(parsed.body).find((block) => block.type === 'article' && block.label === 'Artikel 120');
  const labels = article120?.children
    ?.filter((block) => block.type === 'subparagraph' || block.type === 'item')
    .map((block) => block.label) ?? [];
  if (JSON.stringify(labels) !== JSON.stringify(['1)', '1a)', '1b)', '2)'])) {
    issues.push(`Artikel 120 enthält die Absatzkennzeichnungen ${JSON.stringify(labels)} statt ["1)","1a)","1b)","2)"]`);
  }
  const text = textOf(parsed.body);
  if (!text.includes('Siebte Volkskammer ist der siebte Landtag. Die Wahl zur achten Volkskammer findet Ende August statt.')) {
    issues.push('die Lesefassung enthält nicht den quellentreuen Wortlaut von Artikel 121a');
  }
  return issues;
}
