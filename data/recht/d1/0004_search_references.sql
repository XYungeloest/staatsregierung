-- Strukturadressen (Paragraph, Artikel, Absätze) je Suchtreffer, damit die Suche
-- Fundstellenangaben wie „§ 3 Absatz 2“ direkt auf die passende Provision abbilden kann.
DROP TABLE IF EXISTS law_search;
CREATE VIRTUAL TABLE law_search USING fts5(
  norm_id UNINDEXED,
  version_id UNINDEXED,
  provision_path UNINDEXED,
  anchor UNINDEXED,
  block_type UNINDEXED,
  references_json UNINDEXED,
  slug UNINDEXED,
  title,
  short_title,
  abbr,
  label,
  heading,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
