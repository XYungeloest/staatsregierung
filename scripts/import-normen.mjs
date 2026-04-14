#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIR = resolve(ROOT, 'Gesetze');
const OUTPUT_DIR = resolve(ROOT, 'content', 'normen');
const TODAY_ISO = '2026-04-14';

const SOURCE_TYPES = [
  'Gesetz',
  'Verordnung',
  'Förderrichtlinie',
  'Verwaltungsvorschrift',
  'Allgemeinverfügung',
  'Bekanntmachung',
  'Staatsvertrag',
  'Abkommen',
  'Übereinkommen',
  'Vertrag',
];

const STRUCTURE_RANK = {
  part: 1,
  chapter: 2,
  section: 3,
  subsection: 4,
  article: 5,
  paragraph: 5,
  annex: 5,
};

const FILE_OVERRIDES = {
  'OVertrBl. 2026 Nr. 1.md': {
    extraSegments: [
      {
        kind: 'secondary',
        headingType: 'Übereinkommen',
        title: 'Übereinkommen über den Schutz der Meeresumwelt des Ostseegebiets, 1992',
        shortTitle: 'Helsinki-Übereinkommen über den Schutz der Meeresumwelt des Ostseegebiets',
        abbr: 'Helsinki-Übereinkommen 1992',
        validFrom: '1992-07-14',
        bodyStartsAtPattern: '^\\| CONVENTION on the Protection of the Marine Environment of the Baltic Sea Area, 1992',
        note: 'Veröffentlichter Vertragstext lag in der Markdown-Quelle nur als stark verdichteter Extrakt vor.',
      },
    ],
  },
};

const SUBJECT_RULES = [
  {
    subject: 'Sicherheit und Ordnung',
    keywords: ['Polizei', 'Sicherheit', 'Waffen', 'Messer'],
    pattern: /polizei|allgemeinverf[üu]gung|waffen|messer|sicherheit|öffentliche ordnung/iu,
  },
  {
    subject: 'Kommunal- und Verwaltungsrecht',
    keywords: ['Kommunen', 'Landkreise', 'Verwaltung'],
    pattern: /kommunal|landkreis|verwaltungsorganisationsgesetz|verwaltung/iu,
  },
  {
    subject: 'Wohnen und Bodenordnung',
    keywords: ['Wohnen', 'Vergesellschaftung', 'Wohnraum'],
    pattern: /wohn|vergesellschaft|miete|boden/iu,
  },
  {
    subject: 'Rundfunk und Medien',
    keywords: ['Rundfunk', 'Fernsehfunk', 'Medien'],
    pattern: /rundfunk|fernsehfunk|medien/iu,
  },
  {
    subject: 'Transparenz und Informationszugang',
    keywords: ['Transparenz', 'Informationsfreiheit', 'Informationszugang'],
    pattern: /transparenz|informationsfrei|informationszugang|lobbyregister/iu,
  },
  {
    subject: 'Bildung und Weiterbildung',
    keywords: ['Bildung', 'Weiterbildung', 'Schule'],
    pattern: /bildung|weiterbildung|schul|hochschul|bildungsfreistellung/iu,
  },
  {
    subject: 'Arbeit und Soziales',
    keywords: ['Arbeit', 'Beschäftigte', 'Soziales'],
    pattern: /arbeit|besch[äa]ftigt|sozial|qualifikation|pflege/iu,
  },
  {
    subject: 'Wirtschaft und Förderung',
    keywords: ['Förderung', 'Wirtschaft', 'Zuwendung'],
    pattern: /f[öo]rder|wirtschaft|zuwendung|meisterkredit|reparaturbonus/iu,
  },
  {
    subject: 'Umwelt, Energie und Klimaschutz',
    keywords: ['Umwelt', 'Energie', 'Klima', 'Hochwasser'],
    pattern: /umwelt|energie|klima|hochwasser|meeresumwelt|wasser/iu,
  },
  {
    subject: 'Völkerrecht und Staatsverträge',
    keywords: ['Staatsvertrag', 'Abkommen', 'Nachbarschaft'],
    pattern: /staatsvertrag|abkommen|[üu]bereinkommen|vertrag|nachbarschaft|grenz/iu,
  },
  {
    subject: 'Feiertage und gesellschaftliches Leben',
    keywords: ['Feiertage', 'Religion'],
    pattern: /feiertag|religi[öo]s|trauer|gedenk/iu,
  },
  {
    subject: 'Raumordnung und Landesplanung',
    keywords: ['Landesplanung', 'Raumordnung'],
    pattern: /landesplanung|raumordnung/iu,
  },
];

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeWhitespace(value) {
  return value.replace(/\u000b/gu, '').replace(/\s+/gu, ' ').trim();
}

function unescapeMarkdown(value) {
  return value.replace(/\\([.()])/gu, '$1');
}

function collapseSpacedLetters(value) {
  return value
    .replace(/\b(?:[A-ZÄÖÜa-zäöüß]\s){2,}[A-ZÄÖÜa-zäöüß]\b/gu, (match) =>
      match.replace(/\s+/gu, ''),
    )
    .replace(/\bD e r\b/gu, 'Der')
    .replace(/\bD i e\b/gu, 'Die')
    .replace(/\bU N D\b/gu, 'UND');
}

function stripMarkdown(value) {
  return normalizeWhitespace(
    collapseSpacedLetters(
      unescapeMarkdown(
        value
          .replace(/!\[[^\]]*\]\[[^\]]*\]/gu, ' ')
          .replace(/^#+\s*/gu, '')
          .replace(/\*\*/gu, '')
          .replace(/__(.*?)__/gu, '$1')
          .replace(/\*(.*?)\*/gu, '$1')
          .replace(/`/gu, '')
          .replace(/\[\^.+?\]/gu, '')
          .replace(/\{#.+?\}/gu, '')
          .replace(/\[(.+?)\]\([^)]*\)/gu, '$1')
          .replace(/([\p{L}])-\s+([\p{Ll}])/gu, '$1$2')
          .replace(/^\|\s*/gu, '')
          .replace(/\s*\|$/gu, '')
          .replace(/\s*\|\s*/gu, ' ')
          .replace(/^[–-]\s*/gu, '– ')
          .replace(/\s+([,.;:!?])/gu, '$1'),
      ),
    ),
  );
}

function prependHeadingTypeIfFragment(title, headingType) {
  const normalizedTitle = normalizeWhitespace(title);
  const normalizedHeadingType = normalizeWhitespace(headingType);

  if (!normalizedTitle || !normalizedHeadingType) {
    return normalizedTitle;
  }

  const titleLower = normalizedTitle.toLocaleLowerCase('de-DE');
  const headingLower = normalizedHeadingType.toLocaleLowerCase('de-DE');

  if (titleLower.startsWith(`${headingLower} `) || titleLower === headingLower) {
    return normalizedTitle;
  }

  if (/^(über|zur|zum|zu|durch|betreffend|wegen|gegen|für|unter|des|der|den|das)\b/iu.test(normalizedTitle)) {
    return `${normalizedHeadingType} ${normalizedTitle}`;
  }

  return normalizedTitle;
}

function makeLine(raw, index) {
  const trimmed = raw.trim();
  const text = stripMarkdown(trimmed);

  return {
    index,
    raw,
    trimmed,
    text,
    isBlank: text.length === 0,
    isBold:
      /^\*\*.+\*\*$/u.test(trimmed) ||
      /^#+\s*\*\*.+\*\*$/u.test(trimmed) ||
      /^\*.+\*$/u.test(trimmed),
  };
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/ß/gu, 'ss')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function checksum(value) {
  let hash = 5381;

  for (const character of value) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }

  return (hash >>> 0).toString(36);
}

function shortSlug(value) {
  const slug = slugify(value);
  if (slug.length <= 80) {
    return slug;
  }

  return `${slug.slice(0, 60).replace(/-+$/u, '')}-${checksum(slug).slice(0, 8)}`;
}

function compareStrings(left, right) {
  return left.localeCompare(right, 'de');
}

function isStandaloneFile(lines) {
  return lines.some((line) => /^#\s+/u.test(line.trimmed)) && !lines.some((line) => /Ausgegeben/u.test(line.text));
}

function findFirstLineIndex(lines, pattern, startIndex = 0) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (pattern.test(lines[index].text) || pattern.test(lines[index].trimmed)) {
      return index;
    }
  }

  return -1;
}

function parseGermanDate(value) {
  if (!value) {
    return null;
  }

  const cleaned = normalizeWhitespace(
    unescapeMarkdown(value)
      .replace(/[,]/gu, ' ')
      .replace(/\./gu, '. ')
      .replace(/\s+/gu, ' '),
  );

  const match = cleaned.match(
    /(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/iu,
  );

  if (!match) {
    return null;
  }

  const monthMap = {
    januar: '01',
    februar: '02',
    märz: '03',
    maerz: '03',
    april: '04',
    mai: '05',
    juni: '06',
    juli: '07',
    august: '08',
    september: '09',
    oktober: '10',
    november: '11',
    dezember: '12',
  };

  const day = match[1].padStart(2, '0');
  const month = monthMap[match[2].toLowerCase()];
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function formatGermanDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map((entry) => Number.parseInt(entry, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function readTitleBundle(lines, typeLineIndex) {
  const headingType = stripMarkdown(lines[typeLineIndex].trimmed).replace(/\.$/u, '');
  const titleLines = [];
  let validFrom = null;
  let index = typeLineIndex + 1;

  while (index < lines.length) {
    const current = lines[index];
    if (current.isBlank) {
      index += 1;
      continue;
    }

    if (/^vom\b/iu.test(current.text)) {
      validFrom = parseGermanDate(current.text);
      index += 1;
      break;
    }

    if (
      titleLines.length > 0 &&
      (/^(Auf Grund|Aufgrund|Der Landtag|Der Ministerpr[äa]sident|Es wird verordnet|Es wird bekannt gemacht|verordnet\b|beschlie[ßs]t\b)/iu.test(
        current.text,
      ) ||
        isListItem(current))
    ) {
      break;
    }

    if (isStructureLine(current) || SOURCE_TYPES.includes(current.text)) {
      break;
    }

    titleLines.push(current.text);
    index += 1;
  }

  return {
    headingType,
    titleLines,
    validFrom,
    bodyStartIndex: index,
  };
}

function parseTitleMetadata(titleLines, fallbackTitle = '') {
  const joined = normalizeWhitespace(titleLines.join(' ')) || fallbackTitle;
  const parts = titleLines.map((line) => normalizeWhitespace(line)).filter(Boolean);
  let title = joined;
  let shortTitle = '';
  let abbr = '';
  let removableParenthetical = '';

  for (const part of parts) {
    const explicitShortTitle = part.match(/^\((.+?)\s+[–-]\s+([A-Za-zÄÖÜäöüß0-9./-]+)\)$/u);
    if (explicitShortTitle) {
      shortTitle = normalizeWhitespace(explicitShortTitle[1]).replace(/\d+$/u, '');
      abbr = normalizeWhitespace(explicitShortTitle[2]).replace(/\d+$/u, '');
      removableParenthetical = part;
    }

    const simpleAbbr = part.match(/^\(([^()]{2,32})\)$/u);
    if (!abbr && simpleAbbr && !/\s+[–-]\s+/u.test(part)) {
      abbr = normalizeWhitespace(simpleAbbr[1]).replace(/\d+$/u, '');
    }
  }

  if (!shortTitle) {
    const embedded = joined.match(/\((.+?)\s+[–-]\s+([A-Za-zÄÖÜäöüß0-9./-]+)\)/u);
    if (embedded) {
      shortTitle = normalizeWhitespace(embedded[1]).replace(/\d+$/u, '');
      abbr = abbr || normalizeWhitespace(embedded[2]).replace(/\d+$/u, '');
      title = normalizeWhitespace(joined.replace(embedded[0], ''));
    }
  }

  if (!shortTitle && titleLines.length > 0) {
    shortTitle = titleLines[0];
  }

  if (removableParenthetical) {
    title = normalizeWhitespace(title.replace(removableParenthetical, ''));
  }

  shortTitle = normalizeWhitespace(shortTitle || title).replace(/([A-Za-zÄÖÜäöüß])\d+\b/gu, '$1');
  title = normalizeWhitespace(title).replace(/([A-Za-zÄÖÜäöüß])\d+\b/gu, '$1');
  abbr = normalizeWhitespace(abbr).replace(/([A-Za-zÄÖÜäöüß])\d+\b/gu, '$1');

  if (!abbr) {
    if (shortTitle.length <= 40) {
      abbr = shortTitle;
    } else {
      const initials = shortTitle
        .split(/\s+/u)
        .filter((word) => word.length > 2 && !/^(der|die|das|des|dem|den|und|zur|zum|im|in|am|an|auf|f[üu]r|von|mit)$/iu.test(word))
        .map((word) => word.replace(/[^A-Za-zÄÖÜäöüß]/gu, '').slice(0, 1))
        .join('');
      abbr = initials.length >= 3 ? initials : shortTitle.slice(0, 40).trim();
    }
  }

  return {
    title,
    shortTitle,
    abbr: abbr.trim(),
  };
}

function inferNormType(sourceHeadingType, title) {
  const normalizedHeading = sourceHeadingType.toLowerCase();
  const normalizedTitle = title.toLowerCase();

  if (normalizedHeading === 'förderrichtlinie') {
    return 'foerderrichtlinie';
  }

  if (normalizedHeading === 'verwaltungsvorschrift') {
    return 'verwaltungsvorschrift';
  }

  if (normalizedHeading === 'allgemeinverfügung') {
    return 'allgemeinverfuegung';
  }

  if (normalizedHeading === 'bekanntmachung') {
    return 'bekanntmachung';
  }

  if (normalizedHeading === 'verordnung') {
    return 'verordnung';
  }

  if (
    normalizedHeading === 'staatsvertrag' ||
    normalizedHeading === 'abkommen' ||
    normalizedHeading === 'übereinkommen' ||
    normalizedHeading === 'vertrag'
  ) {
    return 'staatsvertrag';
  }

  if (
    /gesetz (zu|zum|zu dem) (dem )?(abkommen|staatsvertrag|übereinkommen|vertrag)/iu.test(title)
  ) {
    return 'zustimmungsgesetz';
  }

  if (
    /gesetz (zur|zu|zum) (änderung|einführung|errichtung|bereinigung|neufassung|anpassung)/iu.test(
      normalizedTitle,
    )
  ) {
    return 'aenderungsvorschrift';
  }

  return 'gesetz';
}

function buildPublicationInfo(fileName, lines) {
  const publicationLabel =
    lines.find((line) => /(Gesetz- und Verordnungsblatt|Amtsblatt|Staatsanzeiger|Vertragsblatt)/u.test(line.text))
      ?.text ?? '';

  const issueLine =
    lines.find((line) => /Ausgegeben/u.test(line.text) && /\bNr\./u.test(line.text))?.text ?? '';
  const fileBase = basename(fileName, '.md');
  const citation = fileBase.replace(/^OGVBl\./u, 'OGVBl.')
    .replace(/^OABl\./u, 'OABl.')
    .replace(/^StAnzO\./u, 'StAnzO.')
    .replace(/^OVertrBl\./u, 'OVertrBl.');

  const issueDate = parseGermanDate(issueLine) ?? parseGermanDate(fileName);

  return {
    citation,
    issueDate,
    publicationLabel,
  };
}

function normalizeCitation(type, validFrom, publicationCitation) {
  const typeLabelMap = {
    gesetz: 'Gesetz',
    verordnung: 'Verordnung',
    foerderrichtlinie: 'Förderrichtlinie',
    verwaltungsvorschrift: 'Verwaltungsvorschrift',
    allgemeinverfuegung: 'Allgemeinverfügung',
    bekanntmachung: 'Bekanntmachung',
    staatsvertrag: 'Staatsvertrag',
    zustimmungsgesetz: 'Zustimmungsgesetz',
    aenderungsvorschrift: 'Gesetz',
  };

  const typeLabel = typeLabelMap[type] ?? 'Norm';
  return `${typeLabel} vom ${formatGermanDate(validFrom)} (${publicationCitation})`;
}

function extractExplicitAuthorities(lines) {
  const relevantLines = [];
  for (const line of lines.slice(0, 120)) {
    if (/Inhaltsverzeichnis/u.test(line.text)) {
      break;
    }

    relevantLines.push(line);
    if (relevantLines.length >= 40) {
      break;
    }
  }

  const head = relevantLines.map((line) => collapseSpacedLetters(line.text)).join(' ');
  const matches = head.match(/Staatsministerium[^.;:]+/giu) ?? [];

  return dedupe(
    matches.map((entry) =>
      normalizeWhitespace(
        entry
          .replace(/\s+erlass.*$/iu, '')
          .replace(/\s+ordnet.*$/iu, '')
          .replace(/\s+erlässt.*$/iu, '')
          .replace(/\s+nachstehend.*$/iu, ''),
      ),
    ),
  );
}

function fallbackMinistry(type, title) {
  if (/rundfunk|fernsehfunk|medien/iu.test(title)) {
    return 'Staatskanzlei des Freistaates Ostdeutschland';
  }

  if (/umwelt|energie|klima|wasser|hochwasser|meeresumwelt/iu.test(title)) {
    return 'Staatsministerium für Umwelt, Energie und Klimaschutz';
  }

  if (/wirtschaft|förder|meisterkredit|reparaturbonus/iu.test(title)) {
    return 'Staatsministerium für Wirtschaft, Nachhaltigkeit und Mobilität';
  }

  if (/polizei|kommunal|landkreis|verwaltung|wohn|bau/iu.test(title)) {
    return 'Staatsministerium des Innern, Bau und für kommunale Angelegenheiten';
  }

  if (/nachbarschaft|abkommen|staatsvertrag|übereinkommen|grenz/iu.test(title)) {
    return 'Staatsministerium für Völkerfreundschaft und Nachbarschaftspolitik';
  }

  if (/bildung|weiterbildung|schule|bildungsfreistellung|kultus|abitur|oberstufe|gymnasial/iu.test(title)) {
    return 'Staatsministerium für Kultus, Jugend und Sport';
  }

  if (type === 'gesetz' || type === 'zustimmungsgesetz' || type === 'aenderungsvorschrift') {
    return 'Landtag des Freistaates Ostdeutschland';
  }

  return 'Freistaat Ostdeutschland';
}

function inferSubjectsAndKeywords(title, bodyPreview, type, abbr) {
  const haystack = `${title} ${bodyPreview}`.trim();
  const subjects = [];
  const keywords = [];

  for (const rule of SUBJECT_RULES) {
    if (rule.pattern.test(haystack)) {
      subjects.push(rule.subject);
      keywords.push(...rule.keywords);
    }
  }

  if (subjects.length === 0) {
    if (type === 'staatsvertrag' || type === 'zustimmungsgesetz') {
      subjects.push('Völkerrecht und Staatsverträge');
    } else if (type === 'foerderrichtlinie') {
      subjects.push('Wirtschaft und Förderung');
    } else if (type === 'verordnung') {
      subjects.push('Verordnungsrecht');
    } else if (type === 'verwaltungsvorschrift' || type === 'bekanntmachung') {
      subjects.push('Öffentliche Verwaltung');
    } else {
      subjects.push('Landesrecht');
    }
  }

  const titleKeywords = title
    .split(/[^\p{L}\p{N}-]+/u)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word.length >= 4 &&
        !/^(gesetz|verordnung|förderrichtlinie|verwaltungsvorschrift|allgemeinverfügung|bekanntmachung|staatsvertrag)$/iu.test(
          word,
        ),
    )
    .slice(0, 8);

  keywords.push(...titleKeywords);
  if (abbr && abbr !== title) {
    keywords.push(abbr);
  }

  return {
    subjects: dedupe(subjects).slice(0, 3),
    keywords: dedupe(keywords).slice(0, 12),
  };
}

function collectBodyPreview(blocks, maxLength = 260) {
  const parts = [];

  const visit = (entries) => {
    for (const entry of entries) {
      if (entry.label) {
        parts.push(entry.label);
      }
      if (entry.title) {
        parts.push(entry.title);
      }
      if (entry.text) {
        parts.push(entry.text);
      }
      if (entry.children) {
        visit(entry.children);
      }
      if (normalizeWhitespace(parts.join(' ')).length >= maxLength) {
        return;
      }
    }
  };

  visit(blocks);
  return normalizeWhitespace(parts.join(' ')).slice(0, maxLength);
}

function buildSummary(title, bodyPreview) {
  if (!bodyPreview) {
    return `Regelt ${title}.`;
  }

  const trimmed = bodyPreview.replace(/\s+/gu, ' ').trim();
  if (/^Der Ostdeutsche Landtag\b/iu.test(trimmed) || /^Das nachstehende wird\b/iu.test(trimmed)) {
    return `Regelt ${title}.`;
  }

  if (trimmed.length <= 220) {
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
  }

  const shortened = trimmed.slice(0, 217).replace(/\s+\S*$/u, '');
  return `${shortened}...`;
}

function buildInitialHistory(validFrom, citation, versionId, changeNote) {
  return {
    initialVersionId: versionId,
    entries: [
      {
        date: validFrom,
        type: 'initial',
        title: changeNote,
        citation,
        affectingVersionId: versionId,
      },
    ],
  };
}

function isStructureLine(line) {
  return Boolean(parseStructureMarker(line.text));
}

function parseStructureMarker(text) {
  if (!text) {
    return null;
  }

  const cleaned = normalizeWhitespace(text);

  let match = cleaned.match(/^(Teil\s+\d+[a-zA-Z]*)\s*[–:-]?\s*(.*)$/u);
  if (match) {
    return { type: 'part', label: match[1], title: normalizeWhitespace(match[2]) || undefined };
  }

  match = cleaned.match(/^(Kapitel\s+\d+[a-zA-Z]*)\s*[–:-]?\s*(.*)$/u);
  if (match) {
    return { type: 'chapter', label: match[1], title: normalizeWhitespace(match[2]) || undefined };
  }

  match = cleaned.match(/^(Abschnitt\s+\d+[a-zA-Z]*)\s*[–:-]?\s*(.*)$/u);
  if (match) {
    return { type: 'section', label: match[1], title: normalizeWhitespace(match[2]) || undefined };
  }

  match = cleaned.match(/^(Unterabschnitt\s+\d+[a-zA-Z]*)\s*[–:-]?\s*(.*)$/u);
  if (match) {
    return {
      type: 'subsection',
      label: match[1],
      title: normalizeWhitespace(match[2]) || undefined,
    };
  }

  match = cleaned.match(/^([IVXLCDM]+)\.\s*(.*)$/u);
  if (match) {
    return { type: 'section', label: match[1] + '.', title: normalizeWhitespace(match[2]) || undefined };
  }

  match = cleaned.match(/^(Präambel)\s*[–:-]?\s*(.*)$/u);
  if (match) {
    return { type: 'section', label: 'Präambel', title: normalizeWhitespace(match[2]) || undefined };
  }

  match = cleaned.match(/^(Artikel\s+\d+[a-zA-Z]*)\s*[–:-]?\s*(.*)$/iu);
  if (match) {
    return { type: 'article', label: match[1], title: normalizeWhitespace(match[2]) || undefined };
  }

  match = cleaned.match(/^(Article\s+\d+[A-Za-z]*)\s*[–:-]?\s*(.*)$/iu);
  if (match) {
    return { type: 'article', label: match[1], title: normalizeWhitespace(match[2]) || undefined };
  }

  match = cleaned.match(
    /^§{1,2}\s*\d+[a-zA-Z]*(?:\s*(?:,|und)\s*\d+[a-zA-Z]*)*(?:\s+bis\s+\d+[a-zA-Z]*)?/u,
  );
  if (match && /^§/u.test(match[0])) {
    const label = normalizeWhitespace(match[0]);
    const remainder = normalizeWhitespace(cleaned.slice(match[0].length).replace(/^(?:–|-|:)\s*/u, ''));

    return {
      type: 'paragraph',
      label,
      title: remainder || undefined,
    };
  }

  match = cleaned.match(/^(Anlage|Anhang|Annex)\s*([A-Za-z0-9.-]+)?\s*[–:-]?\s*(.*)$/iu);
  if (match) {
    const label = normalizeWhitespace([match[1], match[2]].filter(Boolean).join(' '));
    return {
      type: 'annex',
      label,
      title: normalizeWhitespace(match[3]) || undefined,
    };
  }

  return null;
}

function isListItem(line) {
  return (
    /^(\d+)\.\s+/u.test(line.text) ||
    /^([a-z])\)\s+/iu.test(line.text) ||
    /^[–-]\s+/u.test(line.text)
  );
}

function parseListItem(line, previousKind = null) {
  let match = line.text.match(/^(\d+)\.\s+(.*)$/u);
  if (match) {
    return { type: 'item', label: `${match[1]}.`, text: normalizeWhitespace(match[2]) };
  }

  match = line.text.match(/^([a-z])\)\s+(.*)$/iu);
  if (match) {
    return {
      type: previousKind === 'item' ? 'subitem' : 'item',
      label: `${match[1]})`,
      text: normalizeWhitespace(match[2]),
    };
  }

  match = line.text.match(/^[–-]\s+(.*)$/u);
  if (match) {
    return { type: 'item', label: '–', text: normalizeWhitespace(match[1]) };
  }

  return null;
}

function createContainerStack(root) {
  return [{ children: root, rank: 0, block: null }];
}

function appendBlock(stack, block) {
  const rank = STRUCTURE_RANK[block.type] ?? 99;

  while (stack.length > 1 && stack.at(-1).rank >= rank) {
    stack.pop();
  }

  stack.at(-1).children.push(block);

  if (block.children) {
    stack.push({ children: block.children, rank, block });
  }
}

function currentChildren(stack) {
  return stack.at(-1).children;
}

function stripReferenceDefinitions(lines) {
  return lines.filter(
    (line) =>
      !/^\[image\d+\]:\s*</iu.test(line.trimmed) &&
      !/^\[\^.+?\]:/u.test(line.trimmed) &&
      !/^!\[[^\]]*\]\[[^\]]*\]$/u.test(line.trimmed),
  );
}

function skipFrontMatter(lines, source) {
  let filtered = [...lines];

  if (source.kind === 'standalone') {
    const tocIndex = filtered.findIndex((line) => /Inhaltsverzeichnis/u.test(line.text));
    if (tocIndex >= 0) {
      const nextMainHeading = filtered.findIndex(
        (line, index) => index > tocIndex && /^#\s+/u.test(line.trimmed) && !/Inhaltsverzeichnis/u.test(line.text),
      );
      if (nextMainHeading >= 0) {
        filtered = filtered.slice(nextMainHeading + 1);
      }
    }
  }

  if (filtered.length > 0 && normalizeWhitespace(filtered[0].text) === normalizeWhitespace(source.title)) {
    filtered = filtered.slice(1);
  }

  return filtered;
}

function stripSignatureBlocks(lines) {
  const result = [];
  let skipping = false;

  for (const line of lines) {
    if (
      /^(Dresden|Berlin|Leipzig|Potsdam|Warschau|Prag|Helsinki),\s+den\b/iu.test(line.text) ||
      /^Geschehen zu\b/iu.test(line.text)
    ) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (isStructureLine(line)) {
        skipping = false;
        result.push(line);
      }
      continue;
    }

    result.push(line);
  }

  return result;
}

function addContinuation(children, text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return;
  }

  const last = children.at(-1);
  if (!last) {
    children.push({ type: 'paragraphText', text: normalized });
    return;
  }

  if (last.type === 'paragraphText' || last.type === 'item' || last.type === 'subitem') {
    last.text = normalizeWhitespace(`${last.text} ${normalized}`);
    return;
  }

  children.push({ type: 'paragraphText', text: normalized });
}

function prepareBodyLines(source) {
  let lines = source.bodyLines.map((entry, index) =>
    makeLine(typeof entry === 'string' ? entry : entry.raw ?? String(entry), index),
  );
  lines = stripReferenceDefinitions(lines);
  lines = skipFrontMatter(lines, source);
  lines = stripSignatureBlocks(lines);

  if (source.kind === 'secondary' && source.note) {
    source.report.partialFiles.add(source.fileName);
  }

  return lines;
}

function splitDenseConventionLines(lines, source) {
  if (source.type !== 'staatsvertrag') {
    return lines;
  }

  const result = [];

  for (const line of lines) {
    if (line.text.includes('Article 1') && line.text.includes('Article 2')) {
      const parts = line.text
        .replace(/\b(Article\s+\d+)/giu, '\n$1')
        .replace(/\b(Annex\s+[IVX0-9]+)/giu, '\n$1')
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean);

      result.push(...parts.map((entry, index) => makeLine(entry, line.index + index)));
      source.report.partialFiles.add(source.fileName);
      continue;
    }

    result.push(line);
  }

  return result;
}

function parseBody(source) {
  const root = [];
  const stack = createContainerStack(root);
  let lines = prepareBodyLines(source);
  lines = splitDenseConventionLines(lines, source);
  let index = 0;
  let previousListType = null;

  while (index < lines.length) {
    const line = lines[index];

    if (line.isBlank) {
      previousListType = null;
      index += 1;
      continue;
    }

    const marker = parseStructureMarker(line.text);
    if (marker) {
      const block = {
        type: marker.type,
        label: marker.label,
        title: marker.title,
        children: [],
      };

      let lookahead = index + 1;
      while (lookahead < lines.length && lines[lookahead].isBlank) {
        lookahead += 1;
      }

      if (!block.title && lookahead < lines.length) {
        const candidate = lines[lookahead];
        if (candidate.isBold && !isStructureLine(candidate) && !isListItem(candidate)) {
          block.title = candidate.text;
          index = lookahead;
        }
      }

      appendBlock(stack, block);
      previousListType = null;
      index += 1;
      continue;
    }

    if (isListItem(line)) {
      const item = parseListItem(line, previousListType);
      if (item) {
        currentChildren(stack).push(item);
        previousListType = item.type;

        let lookahead = index + 1;
        while (lookahead < lines.length) {
          const continuation = lines[lookahead];
          if (
            continuation.isBlank ||
            isStructureLine(continuation) ||
            isListItem(continuation) ||
            /^\(?\d+\)\s+/u.test(continuation.text)
          ) {
            break;
          }

          item.text = normalizeWhitespace(`${item.text} ${continuation.text}`);
          lookahead += 1;
        }

        index = lookahead;
        continue;
      }
    }

    previousListType = null;
    const target = currentChildren(stack);
    const paragraphText = line.text;
    target.push({ type: 'paragraphText', text: paragraphText });
    index += 1;

    while (index < lines.length) {
      const continuation = lines[index];
      if (continuation.isBlank || isStructureLine(continuation) || isListItem(continuation)) {
        break;
      }

      if (/^\(?\d+\)\s+/u.test(continuation.text)) {
        break;
      }

      addContinuation(target, continuation.text);
      index += 1;
    }
  }

  return root;
}

function findPrimaryTypeLine(lines) {
  return lines.findIndex((line) =>
    /^(Gesetz|Verordnung|Förderrichtlinie|Verwaltungsvorschrift|Allgemeinverfügung|Bekanntmachung|Staatsvertrag)$/u.test(
      line.text,
    ),
  );
}

function findSecondaryTypeLines(lines, startIndex) {
  const indices = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    if (/^(Abkommen|Staatsvertrag|Übereinkommen|Vertrag)$/u.test(lines[index].text)) {
      indices.push(index);
    }
  }

  return indices;
}

function buildStandaloneSource(fileName, lines, report) {
  const headingLineIndex = lines.findIndex((line) => /^#\s+/u.test(line.trimmed));
  if (headingLineIndex < 0) {
    return [];
  }

  const titleLines = [];
  let headingType = 'Gesetz';
  let cursor = headingLineIndex;

  while (cursor < lines.length) {
    const current = lines[cursor];
    if (current.isBlank) {
      cursor += 1;
      continue;
    }

    if (/^in der Fassung\b/iu.test(current.text) || /^Vollzitat$/iu.test(current.text)) {
      break;
    }

    if (/^#\s+/u.test(current.trimmed) || /^\(.+\)$/u.test(current.text)) {
      titleLines.push(current.text);
      if (titleLines.length === 1 && /^(Gesetz|Verordnung|Förderrichtlinie|Verwaltungsvorschrift|Bekanntmachung)$/u.test(current.text)) {
        headingType = current.text;
      }
      cursor += 1;
      continue;
    }

    break;
  }

  const validFrom =
    parseGermanDate(lines.find((line) => /Fassung der Bekanntmachung vom/u.test(line.text))?.text ?? '') ??
    parseGermanDate(fileName) ??
    TODAY_ISO;

  const { title, shortTitle, abbr } = parseTitleMetadata(titleLines);
  const type = inferNormType(headingType, title);

  const citationBlockIndex = lines.findIndex((line) => /^Vollzitat$/iu.test(line.text));
  let citation = normalizeCitation(type, validFrom, basename(fileName, '.md'));
  if (citationBlockIndex >= 0) {
    const citationLines = [];
    let index = citationBlockIndex + 1;
    while (index < lines.length && !lines[index].isBlank) {
      citationLines.push(lines[index].text);
      index += 1;
    }
    const explicitCitation = normalizeWhitespace(citationLines.join(' '));
    if (explicitCitation) {
      citation = explicitCitation;
    }
  }

  return [
    {
      fileName,
      kind: 'standalone',
      headingType,
      title,
      shortTitle,
      abbr,
      validFrom,
      type,
      citation,
      bodyLines: lines.slice(headingLineIndex),
      metaLines: lines,
      report,
    },
  ];
}

function extractIntroducedSegments(primarySource) {
  const introductions = [];
  const lines = primarySource.bodyLines.map((raw, index) => makeLine(raw, index));

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Das nachstehende wird (Gesetz|Verordnung):$/iu.test(lines[index].text)) {
      continue;
    }

    const headingType = lines[index].text.includes('Verordnung') ? 'Verordnung' : 'Gesetz';
    const titleLines = [];
    let cursor = index + 1;

    while (cursor < lines.length && lines[cursor].isBlank) {
      cursor += 1;
    }

    while (
      cursor < lines.length &&
      !lines[cursor].isBlank &&
      !isStructureLine(lines[cursor]) &&
      !/^vom\b/iu.test(lines[cursor].text)
    ) {
      titleLines.push(lines[cursor].text);
      cursor += 1;
    }

    const bodyStart = cursor;
    let bodyEnd = lines.length;

    for (let lookahead = bodyStart; lookahead < lines.length; lookahead += 1) {
      if (/^Artikel\s+\d+/iu.test(lines[lookahead].text)) {
        bodyEnd = lookahead;
        break;
      }
    }

    const titleMeta = parseTitleMetadata(titleLines);
    introductions.push({
      kind: 'embedded',
      fileName: primarySource.fileName,
      headingType,
      title: titleMeta.title,
      shortTitle: titleMeta.shortTitle,
      abbr: titleMeta.abbr,
      validFrom: primarySource.validFrom,
      type: inferNormType(headingType, titleMeta.title),
      citation: primarySource.citation,
      bodyStart,
      bodyEnd,
      titleLineCount: titleLines.length,
      bodyLines: lines.slice(bodyStart, bodyEnd).map((line) => line.raw),
      metaLines: primarySource.metaLines,
      report: primarySource.report,
    });
  }

  if (introductions.length === 0) {
    return { introductions: [], outerBodyLines: primarySource.bodyLines };
  }

  const skipRanges = introductions.map((entry) => [entry.bodyStart, entry.bodyEnd]);
  const outerLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const inSkippedRange = skipRanges.some(([start, end]) => index >= start && index < end);
    if (!inSkippedRange) {
      outerLines.push(lines[index].raw);
    }
  }

  return { introductions, outerBodyLines: outerLines };
}

function buildPublicationSources(fileName, lines, report) {
  const publication = buildPublicationInfo(fileName, lines);
  const primaryTypeLine = findPrimaryTypeLine(lines);
  if (primaryTypeLine < 0) {
    return [];
  }

  const primaryBundle = readTitleBundle(lines, primaryTypeLine);
  const primaryTitleMeta = parseTitleMetadata(primaryBundle.titleLines);
  const primaryOriginalShortTitle = primaryTitleMeta.shortTitle;
  primaryTitleMeta.title = prependHeadingTypeIfFragment(primaryTitleMeta.title, primaryBundle.headingType);
  primaryTitleMeta.shortTitle = prependHeadingTypeIfFragment(
    primaryTitleMeta.shortTitle,
    primaryBundle.headingType,
  );
  if (primaryTitleMeta.abbr === primaryOriginalShortTitle) {
    primaryTitleMeta.abbr = primaryTitleMeta.shortTitle;
  }
  const primaryType = inferNormType(primaryBundle.headingType, primaryTitleMeta.title);
  const secondaryTypeLines = findSecondaryTypeLines(lines, primaryBundle.bodyStartIndex + 1);
  const secondaryStart = secondaryTypeLines[0] ?? lines.length;
  const primaryBodyLines = lines.slice(primaryBundle.bodyStartIndex, secondaryStart).map((line) => line.raw);
  const primaryCitation = normalizeCitation(
    primaryType,
    primaryBundle.validFrom ?? publication.issueDate ?? TODAY_ISO,
    publication.citation,
  );

  const primarySource = {
    fileName,
    kind: 'primary',
    headingType: primaryBundle.headingType,
    title: primaryTitleMeta.title,
    shortTitle: primaryTitleMeta.shortTitle,
    abbr: primaryTitleMeta.abbr,
    validFrom: primaryBundle.validFrom ?? publication.issueDate ?? TODAY_ISO,
    type: primaryType,
    citation: primaryCitation,
    bodyLines: primaryBodyLines,
    metaLines: lines,
    publication,
    report,
  };

  const { introductions, outerBodyLines } = extractIntroducedSegments(primarySource);
  primarySource.bodyLines = outerBodyLines;

  const sources = [primarySource, ...introductions];

  for (const secondaryIndex of secondaryTypeLines) {
    const bundle = readTitleBundle(lines, secondaryIndex);
    const titleMeta = parseTitleMetadata(bundle.titleLines);
    const originalShortTitle = titleMeta.shortTitle;
    titleMeta.title = prependHeadingTypeIfFragment(titleMeta.title, bundle.headingType);
    titleMeta.shortTitle = prependHeadingTypeIfFragment(titleMeta.shortTitle, bundle.headingType);
    if (titleMeta.abbr === originalShortTitle) {
      titleMeta.abbr = titleMeta.shortTitle;
    }
    const type = inferNormType(bundle.headingType, titleMeta.title);
    const citation = normalizeCitation(
      type,
      bundle.validFrom ?? publication.issueDate ?? TODAY_ISO,
      publication.citation,
    );

    sources.push({
      fileName,
      kind: 'secondary',
      headingType: bundle.headingType,
      title: titleMeta.title,
      shortTitle: titleMeta.shortTitle,
      abbr: titleMeta.abbr,
      validFrom: bundle.validFrom ?? publication.issueDate ?? TODAY_ISO,
      type,
      citation,
      bodyLines: lines.slice(bundle.bodyStartIndex).map((line) => line.raw),
      metaLines: lines,
      publication,
      report,
    });
  }

  const overrides = FILE_OVERRIDES[fileName]?.extraSegments ?? [];
  for (const extraSegment of overrides) {
    const startIndex = findFirstLineIndex(
      lines,
      new RegExp(extraSegment.bodyStartsAtPattern, 'u'),
      primaryBundle.bodyStartIndex,
    );

    if (startIndex < 0) {
      continue;
    }

    sources.push({
      fileName,
      kind: extraSegment.kind,
      headingType: extraSegment.headingType,
      title: extraSegment.title,
      shortTitle: extraSegment.shortTitle,
      abbr: extraSegment.abbr,
      validFrom: extraSegment.validFrom,
      type: inferNormType(extraSegment.headingType, extraSegment.title),
      citation: normalizeCitation(
        inferNormType(extraSegment.headingType, extraSegment.title),
        extraSegment.validFrom,
        publication.citation,
      ),
      bodyLines: lines.slice(startIndex).map((line) => line.raw),
      metaLines: lines,
      publication,
      note: extraSegment.note,
      report,
    });
  }

  return sources;
}

function buildNormRecords(sources) {
  const records = [];
  const usedSlugs = new Set();

  for (const source of sources) {
    const body = parseBody(source);
    const bodyPreview = collectBodyPreview(body);
    const explicitAuthorities = extractExplicitAuthorities(source.metaLines);
    const ministry =
      explicitAuthorities.length > 0
        ? explicitAuthorities.join('; ')
        : fallbackMinistry(source.type, source.title);
    const { subjects, keywords } = inferSubjectsAndKeywords(
      source.title,
      bodyPreview,
      source.type,
      source.abbr,
    );
    const summary = buildSummary(source.title, bodyPreview);
    const changeNote =
      source.kind === 'standalone' ? 'Bekanntmachung der geltenden Fassung.' : 'Stammfassung.';
    const versionId = source.validFrom;

    let slug = shortSlug(source.shortTitle || source.title || source.abbr);
    if (!slug) {
      slug = shortSlug(source.fileName.replace(/\.md$/u, ''));
    }

    if (slug.length > 80 && source.abbr) {
      const abbrSlug = shortSlug(source.abbr);
      if (abbrSlug) {
        slug = abbrSlug;
      }
    }

    let suffix = 2;
    const baseSlug = slug;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(slug);

    const citation = source.citation;

    const meta = {
      id: slug,
      slug,
      title: source.title,
      shortTitle: source.shortTitle || source.title,
      abbr: source.abbr || source.shortTitle || source.title,
      type: source.type,
      ministry,
      subjects,
      keywords,
      initialCitation: citation,
      predecessor: null,
      successor: null,
      summary,
      status: 'in-force',
    };

    const version = {
      versionId,
      validFrom: source.validFrom,
      validTo: null,
      isCurrent: true,
      citation,
      changeNote,
      body,
    };

    const history = buildInitialHistory(source.validFrom, citation, versionId, changeNote);

    records.push({ meta, history, versions: [version], source });
  }

  return records.sort((left, right) => compareStrings(left.meta.title, right.meta.title));
}

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeRecords(records) {
  const previousEntries = await readdir(OUTPUT_DIR).catch(() => []);
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await ensureDirectory(OUTPUT_DIR);

  for (const record of records) {
    const normDirectory = join(OUTPUT_DIR, record.meta.slug);
    const versionsDirectory = join(normDirectory, 'versions');
    await ensureDirectory(versionsDirectory);
    await writeJson(join(normDirectory, 'meta.json'), record.meta);
    await writeJson(join(normDirectory, 'history.json'), record.history);

    for (const version of record.versions) {
      await writeJson(join(versionsDirectory, `${version.versionId}.json`), version);
    }
  }

  return previousEntries.filter((entry) => entry !== '.gitkeep').sort(compareStrings);
}

async function readMarkdownFiles() {
  const entries = await readdir(SOURCE_DIR, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort(compareStrings);

  const files = [];
  for (const fileName of markdownFiles) {
    const raw = await readFile(join(SOURCE_DIR, fileName), 'utf8');
    const normalized = raw.replace(/\r\n/gu, '\n').replace(/\u000b/gu, '');
    const lines = normalized.split('\n').map((line, index) => makeLine(line, index));
    files.push({ fileName, raw: normalized, lines });
  }

  return files;
}

async function main() {
  const report = {
    partialFiles: new Set(),
  };

  const files = await readMarkdownFiles();
  const sources = [];

  for (const file of files) {
    const fileSources = isStandaloneFile(file.lines)
      ? buildStandaloneSource(file.fileName, file.lines, report)
      : buildPublicationSources(file.fileName, file.lines, report);

    sources.push(...fileSources);
  }

  if (sources.length === 0) {
    throw new Error('Es konnten keine Normquellen aus dem Verzeichnis "Gesetze" abgeleitet werden.');
  }

  const records = buildNormRecords(sources);

  if (records.length === 0) {
    throw new Error('Es konnten keine Normdatensätze erzeugt werden.');
  }

  const replacedEntries = await writeRecords(records);

  console.log(
    JSON.stringify(
      {
        importedNormCount: records.length,
        replacedSeedEntries: replacedEntries,
        partiallyStructuredFiles: [...report.partialFiles].sort(compareStrings),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
