export const complexHtmlStructureFixtures = {
  3: {
    outerArticles: ['Artikel 1', 'Artikel 2'],
    quotedStructure: 'annex',
    tableCount: 1,
  },
  17: {
    outerArticles: ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 4', 'Artikel 5'],
    quotedLabel: '§ 15',
  },
  46: {
    introducedLastStructures: ['§ 25', '§ 26'],
  },
  47: {
    introducedAbbreviations: ['OstEisG', 'OstVerkVergG', 'VerkBindG'],
  },
  52: {
    outerArticles: Array.from({ length: 13 }, (_, index) => `Artikel ${index + 1}`),
    introducedLastStructures: ['§ 48', '§ 7', '§ 7', '§ 13', '§ 8'],
  },
  53: {
    outerArticles: ['Artikel 1', 'Artikel 2'],
    number1Children: ['a.', 'b.', 'c.', 'd.', 'e.'],
    quotedArticle: 'Artikel 5',
    quotedParagraphs: ['(1)', '(2)', '(3)'],
  },
  54: {
    outerArticles: ['Artikel 1', 'Artikel 2'],
    number1Children: ['a.', 'b.', 'c.', 'd.', 'e.'],
    quotedArticle: 'Artikel 95a',
    quotedParagraphs: ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)'],
  },
  58: {
    outerParagraphs: Array.from({ length: 35 }, (_, index) => `§ ${index + 1}`),
  },
};
