#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { sha256 } from './lib/consolidation-engine.mjs';

const ROOT = process.cwd();
const EFFECTIVE_DATE = '2026-09-01';
const CLEANUP_ACT = 'verordnung-zur-bereinigung-des-allgemeinbildenden-schulordnungsrechts-2026';
const SOFS_ACT = 'verordnung-zur-aenderung-der-schulordnung-foerderschulen-2026';
const VERSIONS = {
  [CLEANUP_ACT]: '2026-08-31',
  [SOFS_ACT]: '2026-09-01',
  'aendvwv-schulformulare-2026': '2026-09-01',
  'aendvwv-beratungslehrer-2026': '2026-09-01',
  'aendvwv-radfahrausbildung-2026': '2026-09-01',
};

const readJson = async (path) => JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
const clone = (value) => structuredClone(value);

async function amendment(slug) {
  return readJson(`content/normen/${slug}/versions/${VERSIONS[slug]}.json`);
}

function walk(blocks, visitor, parent = null) {
  for (const block of blocks) {
    visitor(block, parent);
    walk(block.children ?? [], visitor, block);
  }
}

function matches(block, query, parent) {
  return Object.entries(query).every(([key, value]) => key === 'parentLabel'
    ? parent?.label === value
    : key === 'parentType'
      ? parent?.type === value
      : block[key] === value);
}

function findOne(body, query, context = JSON.stringify(query)) {
  const found = [];
  walk(body, (block, parent) => {
    if (matches(block, query, parent)) found.push(block);
  });
  if (found.length !== 1) throw new Error(`${context}: ${found.length} statt genau ein Treffer`);
  return found[0];
}

function findText(body, { type, label, startsWith }, context = startsWith) {
  const found = [];
  walk(body, (block) => {
    if ((!type || block.type === type) && (!label || block.label === label) && block.text?.startsWith(startsWith)) found.push(block);
  });
  if (found.length !== 1) throw new Error(`${context}: ${found.length} statt genau ein Texttreffer`);
  return found[0];
}

function findTop(body, label, type = 'paragraph') {
  return findOne(body, { type, label }, `${type} ${label}`);
}

function replaceStrings(value, oldText, newText, expected = 1) {
  let count = 0;
  const visit = (entry) => {
    if (typeof entry === 'string') {
      const pieces = entry.split(oldText);
      count += pieces.length - 1;
      return pieces.join(newText);
    }
    if (Array.isArray(entry)) return entry.map(visit);
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.entries(entry).map(([key, child]) => [key, visit(child)]));
    }
    return entry;
  };
  const result = visit(value);
  if (count !== expected) throw new Error(`„${oldText}“: ${count} statt ${expected} Ersetzungen`);
  return result;
}

function mutateStrings(block, oldText, newText, expected = 1) {
  const changed = replaceStrings(block, oldText, newText, expected);
  for (const key of Object.keys(block)) delete block[key];
  Object.assign(block, changed);
}

function stripQuoteMarks(blocks) {
  const result = clone(blocks);
  const strings = [];
  walk(result, (block) => {
    for (const field of ['text', 'title']) {
      if (typeof block[field] === 'string' && block[field]) strings.push([block, field]);
    }
  });
  if (strings.length) {
    const [first, firstField] = strings[0];
    first[firstField] = first[firstField].replace(/^„/u, '');
    const [last, lastField] = strings.at(-1);
    last[lastField] = last[lastField].replace(/“\.?$/u, '').replace(/”\.?$/u, '');
  }
  return result;
}

function quotedBlocks(act, commandPrefix, quoteIncludes) {
  const commands = [];
  walk(act.body, (block) => {
    if (block.type === 'item' && block.text?.startsWith(commandPrefix) &&
        block.children?.some((child) => child.type === 'quotedProvision') &&
        (!quoteIncludes || JSON.stringify(block.children).includes(quoteIncludes))) commands.push(block);
  });
  if (commands.length !== 1) throw new Error(`${commandPrefix}: ${commands.length} zitierte Änderungsbefehle`);
  return stripQuoteMarks(commands[0].children.find((child) => child.type === 'quotedProvision').children);
}

function quotedParagraph(act, commandPrefix, label) {
  return findOne(quotedBlocks(act, commandPrefix), { type: 'paragraph', label }, commandPrefix);
}

function blocksAsSubparagraphs(blocks) {
  const result = clone(blocks);
  if (result[0]?.type === 'paragraphText') {
    const matched = result[0].text.match(/^\((\d+[a-z]?)\)\s*(.*)$/su);
    if (!matched) throw new Error(`Zitat beginnt nicht mit Absatzbezeichnung: ${result[0].text}`);
    result[0] = { type: 'subparagraph', label: `(${matched[1]})`, text: matched[2], children: [] };
  }
  return result;
}

function replaceRange(parent, startLabel, endLabel, replacement) {
  const start = parent.children.findIndex((block) => block.type === 'subparagraph' && block.label === startLabel);
  if (start < 0) throw new Error(`${parent.label}: ${startLabel} fehlt`);
  const end = endLabel
    ? parent.children.findIndex((block, index) => index > start && block.type === 'subparagraph' && block.label === endLabel)
    : parent.children.findIndex((block, index) => index > start && block.type === 'subparagraph');
  const deleteCount = (end < 0 ? parent.children.length : end) - start;
  parent.children.splice(start, deleteCount, ...clone(replacement));
}

function replaceSubparagraph(parent, label, blocks) {
  replaceRange(parent, label, null, blocksAsSubparagraphs(blocks));
}

function repealSubparagraph(parent, label) {
  const target = findOne(parent.children, { type: 'subparagraph', label }, `${parent.label} ${label}`);
  target.text = '(weggefallen)';
  target.children = [];
  const index = parent.children.indexOf(target);
  const next = parent.children.findIndex((block, candidate) =>
    candidate > index && block.type === 'subparagraph'
  );
  if (next > index + 1) parent.children.splice(index + 1, next - index - 1);
}

function quotedSentence(act, commandPrefix) {
  const blocks = quotedBlocks(act, commandPrefix);
  const first = blocks.find((block) => typeof block.text === 'string');
  if (!first) throw new Error(`${commandPrefix}: kein Satztext im Zitat`);
  return first.text.replace(/^\(\d+[a-z]?\)\s*/u, '');
}

const SUPER = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function replaceSentence(block, sentenceNumber, newText) {
  const prefix = SUPER[sentenceNumber - 1];
  const next = SUPER[sentenceNumber];
  const start = block.text.indexOf(prefix);
  if (start < 0) {
    if (sentenceNumber === 1 && !SUPER.some((mark) => block.text.includes(mark))) {
      block.text = newText;
      return;
    }
    throw new Error(`${block.label ?? block.type}: Satz ${sentenceNumber} fehlt`);
  }
  const end = next ? block.text.indexOf(next, start + 1) : -1;
  block.text = `${block.text.slice(0, start)}${prefix}${newText}${end < 0 ? '' : block.text.slice(end)}`;
}

function insertSentenceAfter(block, sentenceNumber, newText) {
  const prefix = SUPER[sentenceNumber - 1];
  const next = SUPER[sentenceNumber];
  const start = block.text.indexOf(prefix);
  if (start < 0) throw new Error(`${block.label}: Satz ${sentenceNumber} fehlt`);
  const end = next ? block.text.indexOf(next, start + 1) : -1;
  if (end < 0) block.text = `${block.text} ${next ?? ''}${newText}`;
  else block.text = `${block.text.slice(0, end)}${next}${newText} ${SUPER[sentenceNumber + 1] ?? ''}${block.text.slice(end + 1)}`;
}

function replaceProvisionOperation(original, value, source, sourceProvision) {
  return {
    op: 'replaceProvision',
    target: { type: original.type, label: original.label },
    expectedHash: sha256(original),
    expectedMatches: 1,
    value,
    source,
    sourceProvision,
    effectiveDate: EFFECTIVE_DATE,
  };
}

function insertAfterOperation(anchor, value, source, sourceProvision) {
  return {
    op: 'insertProvisionAfter',
    target: { type: anchor.type, label: anchor.label },
    expectedHash: sha256(anchor),
    expectedMatches: 1,
    value,
    source,
    sourceProvision,
    effectiveDate: EFFECTIVE_DATE,
  };
}

function renameOperation(oldTitle, newTitle, source, sourceProvision) {
  return {
    op: 'renameLaw', expectedOld: oldTitle, expectedMatches: 1, value: newTitle,
    source, sourceProvision, effectiveDate: EFFECTIVE_DATE,
  };
}

function recipe({ act, citation, resultCitation, changeNote, operations, coverage, source }) {
  return {
    amendmentAct: act,
    effectiveDate: EFFECTIVE_DATE,
    versionId: EFFECTIVE_DATE,
    amendmentCitation: citation,
    resultCitation,
    changeNote,
    commandCoverage: coverage,
    sourceReferences: [{ kind: 'amendment-source', label: citation, availability: 'versioned', localSource: source }],
    operations,
  };
}

async function baseline(slug) {
  return readJson(`data/recht/parsed/revosax/${slug}.json`);
}

async function writeRecipe(act, target, value) {
  const path = resolve(ROOT, 'data/recht/amendments', act, `${target}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`${target}: ${value.operations.length} geprüfte Operationen`);
}

async function buildClasses(cleanup) {
  const slug = 'saechsische-klassenbildungsverordnung';
  const base = await baseline(slug);
  const operations = [];
  const p2Old = findTop(base.body, '§ 2');
  const p2 = clone(p2Old);
  replaceSubparagraph(p2, '(4)', quotedBlocks(cleanup, '§ 2 Absatz 4 wird wie folgt gefasst:', 'LRS-Klassen'));
  const p4Old = findTop(base.body, '§ 4');
  const p4 = clone(p4Old);
  p4.children = [{ type: 'paragraphText', text: '(weggefallen)' }];
  const annexOld = findTop(base.body, 'Anlage', 'annex');
  const annex = findOne(quotedBlocks(cleanup, 'Die Anlage wird wie folgt gefasst:'), { type: 'annex', label: 'Anlage (zu §§ 1 und 3)' });
  operations.push(
    renameOperation(base.sourceTitle, 'Ostdeutsche Klassenbildungsverordnung', 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 1 § 1 Nummer 1'),
    replaceProvisionOperation(p2Old, p2, 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 1 § 1 Nummer 2'),
    replaceProvisionOperation(p4Old, p4, 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 1 § 1 Nummer 3'),
    replaceProvisionOperation(annexOld, annex, 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 1 § 1 Nummer 4'),
  );
  await writeRecipe(CLEANUP_ACT, slug, recipe({
    act: CLEANUP_ACT, citation: 'Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    resultCitation: 'Ostdeutsche Klassenbildungsverordnung, geändert durch Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    changeNote: 'Bezeichnung, Gewichtungsregel und Anlage neu gefasst; § 4 aufgehoben.',
    operations, coverage: ['Artikel 1 § 1 Nummern 1 bis 4'], source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
  }));
}

async function buildSchoolNetwork(cleanup) {
  const slug = 'schulnetzplanungsverordnung';
  const base = await baseline(slug);
  const touched = new Map();
  for (const label of ['§ 3', '§ 4', '§ 5', '§ 6', '§ 7', '§ 11', '§ 12', '§ 13', '§ 14', '§ 15', '§ 16']) {
    touched.set(label, { old: findTop(base.body, label), next: clone(findTop(base.body, label)) });
  }
  mutateStrings(touched.get('§ 3').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 3);
  mutateStrings(touched.get('§ 3').next, 'eine Absolventenzahlprognose der obersten Schulaufsichtsbehörde für die Förderschulen, Oberschulen, Gymnasien und Gemeinschaftsschulen für jeden Landkreis und jede Kreisfreie Stadt sowie', 'eine Absolventenzahlprognose der obersten Schulaufsichtsbehörde für Förderschulen, Polytechnische Oberschulen und Erweiterte Oberschulen für jeden Landkreis und jede kreisfreie Stadt sowie', 1);
  mutateStrings(touched.get('§ 4').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 2);
  const p5 = touched.get('§ 5').next;
  replaceSubparagraph(p5, '(5)', quotedBlocks(cleanup, '§ 5 Absatz 5 wird wie folgt gefasst:'));
  mutateStrings(touched.get('§ 6').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 3);
  mutateStrings(touched.get('§ 7').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 2);
  const p11a2 = findOne(touched.get('§ 11').next.children, { type: 'subparagraph', label: '(2)' });
  replaceSentence(p11a2, 1, quotedSentence(cleanup, '§ 11 Absatz 2 Satz 1 wird wie folgt gefasst:'));
  mutateStrings(touched.get('§ 12').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  mutateStrings(touched.get('§ 13').next, 'Freistaates Sachsen', 'Freistaates Ostdeutschland', 1);
  mutateStrings(touched.get('§ 13').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 2);
  const p14a1 = findOne(touched.get('§ 14').next.children, { type: 'subparagraph', label: '(1)' });
  replaceSubparagraph(touched.get('§ 14').next, '(1)', quotedBlocks(cleanup, 'Absatz 1 wird wie folgt gefasst:'));
  mutateStrings(touched.get('§ 14').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  void p14a1;
  mutateStrings(touched.get('§ 15').next, 'Freistaates Sachsen', 'Freistaates Ostdeutschland', 1);
  replaceSubparagraph(touched.get('§ 15').next, '(2)', quotedBlocks(cleanup, 'Absatz 2 wird wie folgt gefasst:'));
  touched.get('§ 16').next.children = [{ type: 'paragraphText', text: '(weggefallen)' }];
  const annexOld = findTop(base.body, 'Anlage', 'annex');
  const annex = clone(annexOld);
  mutateStrings(annex, 'Grundschule, Oberschule,\nGemeinschaftsschule', 'Polytechnische Oberschule', 1);
  mutateStrings(annex, 'Gymnasium, Gemeinschaftsschule, Berufliches Gymnasium, Abendgymnasium, Kolleg', 'Erweiterte Oberschule, Berufliches Gymnasium, Abendgymnasium, Kolleg', 1);
  const operations = [
    renameOperation(base.sourceTitle, 'Ostdeutsche Schulnetzplanungsverordnung', 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 1 § 2 Nummer 1'),
    ...[...touched.values()].map(({ old, next }) => replaceProvisionOperation(old, next, 'Gesetze/OGVBl. 2026 Nr. 67.html', `Artikel 1 § 2 (${old.label})`)),
    replaceProvisionOperation(annexOld, annex, 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 1 § 2 Nummer 13'),
  ];
  await writeRecipe(CLEANUP_ACT, slug, recipe({
    act: CLEANUP_ACT, citation: 'Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    resultCitation: 'Ostdeutsche Schulnetzplanungsverordnung, geändert durch Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    changeNote: 'Schularten, Zuständigkeiten, Bezeichnungen und Planungsregeln an das ostdeutsche Schulrecht angepasst.',
    operations, coverage: ['Artikel 1 § 2 Nummern 1 bis 13'], source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
  }));
}

async function buildFreeCarrier(cleanup) {
  const slug = 'freie-trager-schulverordnung';
  const base = await baseline(slug);
  const touched = new Map();
  for (const label of ['§ 1', '§ 2', '§ 5', '§ 11']) touched.set(label, { old: findTop(base.body, label), next: clone(findTop(base.body, label)) });
  mutateStrings(touched.get('§ 1').next, 'Freistaat Sachsen', 'Freistaat Ostdeutschland', 1);
  const p2 = touched.get('§ 2').next;
  const itemB = findText(p2.children, { type: 'item', label: 'b)', startsWith: 'bei einer Grundschule' }, '§ 2 Absatz 2 Nummer 4 Buchstabe b');
  itemB.text = findText(quotedBlocks(cleanup, '§ 2 Absatz 2 Nummer 4 Buchstabe b wird wie folgt gefasst:'), { type: 'item', label: 'b)', startsWith: 'bei einer Polytechnischen Oberschule' }).text;
  replaceSubparagraph(p2, '(4)', quotedBlocks(cleanup, '§ 2 Absatz 4 wird wie folgt gefasst:', 'Weltanschauungsschule'));
  repealSubparagraph(touched.get('§ 5').next, '(6)');
  touched.get('§ 11').next = quotedParagraph(cleanup, '§ 11 wird wie folgt gefasst:', '§ 11');
  const operations = [
    renameOperation(base.sourceTitle, base.sourceTitle.replace('Freistaat Sachsen', 'Freistaat Ostdeutschland').replace('Sächsische ', ''), 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 2 § 1 Nummer 1'),
    ...[...touched.values()].map(({ old, next }) => replaceProvisionOperation(old, next, 'Gesetze/OGVBl. 2026 Nr. 67.html', `Artikel 2 § 1 (${old.label})`)),
  ];
  await writeRecipe(CLEANUP_ACT, slug, recipe({
    act: CLEANUP_ACT, citation: 'Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    resultCitation: 'Freie-Träger-Schulverordnung, geändert durch Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    changeNote: 'Genehmigungs-, Anerkennungs- und Übergangsrecht an die neuen Schularten angepasst.',
    operations, coverage: ['Artikel 2 § 1 Nummern 1 bis 5'], source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
  }));
}

function replaceParagraphTextStarting(parent, prefix, newText) {
  const found = [];
  walk(parent.children ?? [], (block) => {
    if (block.type === 'paragraphText' && block.text?.startsWith(prefix)) found.push(block);
  });
  if (found.length !== 1) throw new Error(`${parent.label}: ${found.length} Absatztexte beginnen mit ${prefix}`);
  found[0].text = newText;
}

async function buildWaldorf(cleanup) {
  const slug = 'pruefungsverordnung-waldorfschulen';
  const base = await baseline(slug);
  const labels = ['§ 1', '§ 4', '§ 9', '§ 10', '§ 12', '§ 14', '§ 15', '§ 17', '§ 18', '§ 19', '§ 22', '§ 23', '§ 25', '§ 26'];
  const touched = new Map(labels.map((label) => [label, { old: findTop(base.body, label), next: clone(findTop(base.body, label)) }]));
  replaceSentence(touched.get('§ 1').next.children.find((block) => block.type === 'paragraphText'), 2, quotedSentence(cleanup, '§ 1 Satz 2 wird wie folgt gefasst:'));
  mutateStrings(touched.get('§ 4').next, 'der Oberschule oder Gemeinschaftsschule', 'der Polytechnischen Oberschule', 1);
  replaceSubparagraph(touched.get('§ 9').next, '(1)', quotedBlocks(cleanup, '§ 9 Absatz 1 wird wie folgt gefasst:'));
  replaceRange(touched.get('§ 10').next, '(1)', '(4)', blocksAsSubparagraphs(quotedBlocks(cleanup, 'Absatz 1 und 2 wird wie folgt gefasst:')));
  mutateStrings(touched.get('§ 12').next, 'an Oberschulen oder Gemeinschaftsschulen in öffentlicher Trägerschaft', 'an Polytechnischen Oberschulen in öffentlicher Trägerschaft', 1);
  replaceSubparagraph(touched.get('§ 14').next, '(1)', quotedBlocks(cleanup, '§ 14 Absatz 1 wird wie folgt gefasst:'));
  touched.get('§ 15').next = quotedParagraph(cleanup, '§ 15 wird wie folgt gefasst:', '§ 15');
  mutateStrings(touched.get('§ 17').next, 'mindestens die Note „ausreichend“', 'mindestens die Note 4', 1);
  const p18 = touched.get('§ 18').next;
  replaceSentence(findOne(p18.children, { type: 'subparagraph', label: '(1)' }), 2, quotedSentence(cleanup, 'Absatz 1 Satz 2 wird wie folgt gefasst:'));
  replaceSentence(findOne(p18.children, { type: 'subparagraph', label: '(4)' }), 1, quotedSentence(cleanup, 'Absatz 4 Satz 1 wird wie folgt gefasst:'));
  replaceSubparagraph(p18, '(7)', quotedBlocks(cleanup, 'Absatz 7 wird wie folgt gefasst:'));
  mutateStrings(p18, '§ 50 Absatz 11 Satz 2 der Schulordnung Gymnasien Abiturprüfung', '§ 33 Absatz 2 der Schulordnung Erweiterte Oberschulen und Abiturprüfung', 1);
  mutateStrings(touched.get('§ 19').next, '§ 49 der Schulordnung Gymnasien Abiturprüfung', '§ 25 der Schulordnung Erweiterte Oberschulen und Abiturprüfung', 1);
  mutateStrings(touched.get('§ 19').next, 'eines Gymnasiums', 'einer Erweiterten Oberschule', 1);
  touched.get('§ 22').next = quotedParagraph(cleanup, '§ 22 wird wie folgt gefasst:', '§ 22');
  touched.get('§ 23').next = quotedParagraph(cleanup, '§ 23 wird wie folgt gefasst:', '§ 23');
  mutateStrings(touched.get('§ 25').next, 'an Gymnasien in öffentlicher Trägerschaft', 'an Erweiterten Oberschulen in öffentlicher Trägerschaft', 1);
  touched.get('§ 26').next = quotedParagraph(cleanup, '§ 26 wird wie folgt gefasst:', '§ 26');
  const operations = [...touched.values()].map(({ old, next }) =>
    replaceProvisionOperation(old, next, 'Gesetze/OGVBl. 2026 Nr. 67.html', `Artikel 2 § 2 (${old.label})`)
  );
  await writeRecipe(CLEANUP_ACT, slug, recipe({
    act: CLEANUP_ACT, citation: 'Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    resultCitation: 'Prüfungsverordnung Waldorfschulen, geändert durch Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    changeNote: 'Abschluss- und Abiturprüfungsrecht an SOPOS und SOEOSA angepasst.',
    operations, coverage: ['Artikel 2 § 2 Nummern 1 bis 14'], source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
  }));
}

async function buildVocational(cleanup) {
  const slug = 'schulordnung-berufsschule';
  const base = await baseline(slug);
  const labels = ['§ 4', '§ 7', '§ 8', '§ 12', '§ 26', '§ 28'];
  const touched = new Map(labels.map((label) => [label, { old: findTop(base.body, label), next: clone(findTop(base.body, label)) }]));
  mutateStrings(touched.get('§ 4').next, 'Oberschule', 'Polytechnische Oberschule', 2);
  const p7 = touched.get('§ 7').next;
  const a4Index = p7.children.findIndex((block) => block.type === 'subparagraph' && block.label === '(4)');
  const nextSub = p7.children.findIndex((block, index) => index > a4Index && block.type === 'subparagraph');
  const end = nextSub < 0 ? p7.children.length : nextSub;
  const item6 = p7.children.findIndex((block, index) => index > a4Index && index < end && block.type === 'item' && block.label === '6.');
  if (item6 < 0) throw new Error('BSO § 7 Absatz 4 Nummer 6 fehlt');
  p7.children.splice(item6, 1);
  for (const block of p7.children.slice(a4Index + 1, end)) {
    if (block.type === 'item') {
      const number = Number.parseInt(block.label, 10);
      if (number >= 7 && number <= 12) block.label = `${number - 1}.`;
    }
  }
  replaceParagraphTextStarting(p7, '²', `²${quotedSentence(cleanup, 'Satz 2 wird wie folgt gefasst:')}`);
  mutateStrings(touched.get('§ 8').next, 'Freistaat Sachsen', 'Freistaat Ostdeutschland', 2);
  const p12 = touched.get('§ 12').next;
  mutateStrings(p12, 'Freistaates Sachsen', 'Freistaates Ostdeutschland', 2);
  replaceSubparagraph(p12, '(3)', quotedBlocks(cleanup, 'Absatz 3 wird wie folgt gefasst:', 'Einzugsbereiche'));
  mutateStrings(p12, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 2);
  mutateStrings(p12, 'Freistaat Sachsen', 'Freistaat Ostdeutschland', 1);
  mutateStrings(touched.get('§ 26').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  const p28 = touched.get('§ 28').next;
  replaceSentence(findOne(p28.children, { type: 'paragraphText' }), 3, quotedSentence(cleanup, 'Absatz 1 Satz 3 wird wie folgt gefasst:'));
  mutateStrings(p28, 'der Oberschule', 'der Polytechnischen Oberschule', 1);
  const p31 = findTop(base.body, '§ 31');
  const p31a = quotedParagraph(cleanup, 'Nach § 31 wird folgender § 31a eingefügt:', '§ 31a');
  const title = quotedBlocks(cleanup, 'Die Bezeichnung wird wie folgt gefasst:').find((block) => block.text?.includes('Berufsschule im Freistaat Ostdeutschland'))?.text;
  if (!title) throw new Error('BSO: neue Bezeichnung fehlt');
  const operations = [
    renameOperation(base.sourceTitle, title, 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 2 § 3 Nummer 1'),
    ...[...touched.values()].map(({ old, next }) => replaceProvisionOperation(old, next, 'Gesetze/OGVBl. 2026 Nr. 67.html', `Artikel 2 § 3 (${old.label})`)),
    insertAfterOperation(p31, p31a, 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 2 § 3 Nummer 8'),
  ];
  await writeRecipe(CLEANUP_ACT, slug, recipe({
    act: CLEANUP_ACT, citation: 'Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    resultCitation: 'Schulordnung Berufsschule, geändert durch Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    changeNote: 'Schularten, Datenverarbeitung, Einzugsbereiche und Ethikunterricht angepasst.',
    operations, coverage: ['Artikel 2 § 3 Nummern 1 bis 8'], source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
  }));
}

async function buildVocationalGymnasium(cleanup) {
  const slug = 'schulordnung-berufliche-gymnasien';
  const base = await baseline(slug);
  const labels = ['§ 4', '§ 6', '§ 7', '§ 35', '§ 38', '§ 40', '§ 72'];
  const touched = new Map(labels.map((label) => [label, { old: findTop(base.body, label), next: clone(findTop(base.body, label)) }]));
  const p4 = touched.get('§ 4').next;
  repealSubparagraph(p4, '(2)');
  p4.children = p4.children.filter((block) => !(block.type === 'subparagraph' && block.label === '(2)' && block.text === '(weggefallen)'));
  for (const block of p4.children) {
    if (block.type === 'subparagraph') {
      const number = Number.parseInt(block.label.replaceAll(/[()]/gu, ''), 10);
      if (number >= 3 && number <= 7) block.label = `(${number - 1})`;
    }
  }
  mutateStrings(p4, 'Absätzen 1 und 4', 'Absätzen 1 und 3', 1);
  mutateStrings(p4, 'Absatz 6 Satz 1', 'Absatz 5 Satz 1', 1);
  const p6 = touched.get('§ 6').next;
  mutateStrings(p6, '§ 4 Absatz 5 Satz 2 oder Absatz 6 Satz 1', '§ 4 Absatz 4 Satz 2 oder Absatz 5 Satz 1', 1);
  const item9 = findOne(p6.children, { type: 'item', label: '9.' });
  const item9Index = p6.children.indexOf(item9);
  p6.children.splice(item9Index, 1);
  for (const block of p6.children) {
    if (block.type === 'item' && ['10.', '11.'].includes(block.label)) block.label = `${Number.parseInt(block.label, 10) - 1}.`;
  }
  mutateStrings(p6, '§ 4 Absatz 3', '§ 4 Absatz 2', 1);
  const p7 = touched.get('§ 7').next;
  mutateStrings(p7, '75 Prozent', '85 Prozent', 1);
  const item2 = findOne(p7.children, { type: 'item', label: '2.' });
  p7.children.splice(p7.children.indexOf(item2), 1);
  for (const block of p7.children) {
    if (block.type === 'item' && ['3.', '4.'].includes(block.label)) block.label = `${Number.parseInt(block.label, 10) - 1}.`;
  }
  mutateStrings(p7, '§ 4 Absatz 5 und 6', '§ 4 Absatz 4 und 5', 1);
  const p35a2 = findOne(touched.get('§ 35').next.children, { type: 'subparagraph', label: '(2)' });
  replaceSentence(p35a2, 2, quotedSentence(cleanup, '§ 35 Absatz 2 Satz 2 wird wie folgt gefasst:'));
  mutateStrings(touched.get('§ 38').next, 'Evangelische Religion, Katholische Religion oder Ethik', 'Ethik', 1);
  mutateStrings(touched.get('§ 40').next, 'Evangelische Religion, Katholische Religion oder Ethik', 'Ethik', 1);
  mutateStrings(touched.get('§ 72').next, 'Evangelische Religion, Katholische Religion oder Ethik', 'Ethik', 2);
  const p76 = findTop(base.body, '§ 76');
  const p76a = quotedParagraph(cleanup, 'Nach § 76 wird folgender § 76a eingefügt:', '§ 76a');
  const operations = [
    ...[...touched.values()].map(({ old, next }) => replaceProvisionOperation(old, next, 'Gesetze/OGVBl. 2026 Nr. 67.html', `Artikel 2 § 4 (${old.label})`)),
    insertAfterOperation(p76, p76a, 'Gesetze/OGVBl. 2026 Nr. 67.html', 'Artikel 2 § 4 Nummer 9'),
  ];
  await writeRecipe(CLEANUP_ACT, slug, recipe({
    act: CLEANUP_ACT, citation: 'Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    resultCitation: 'Schulordnung Berufliche Gymnasien, geändert durch Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    changeNote: 'Aufnahmequoten, Verweise sowie Ethik- und freiwilliger Religionsunterricht angepasst.',
    operations, coverage: ['Artikel 2 § 4 Nummern 1 bis 9'], source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
  }));
}

async function buildSofs(act) {
  const slug = 'schulordnung-foerderschulen';
  const base = await baseline(slug);
  const labels = ['§ 1', '§ 3', '§ 4', '§ 6', '§ 7', '§ 8', '§ 9', '§ 11', '§ 12', '§ 13', '§ 14', '§ 14a', '§ 14b', '§ 15', '§ 16', '§ 18', '§ 22', '§ 23', '§ 24', '§ 25', '§ 27a', '§ 30', '§ 33', '§ 34', '§ 34a', '§ 34b', '§ 34c', '§ 35'];
  const touched = new Map(labels.map((label) => [label, { old: findTop(base.body, label), next: clone(findTop(base.body, label)) }]));
  mutateStrings(touched.get('§ 1').next, 'Freistaat Sachsen', 'Freistaat Ostdeutschland', 1);
  const p3 = touched.get('§ 3').next;
  mutateStrings(p3, 'Grundschulteil', 'Primarstufenteil', 2);
  mutateStrings(p3, 'Oberschulteil', 'Sekundarstufenteil', 2);
  replaceSubparagraph(p3, '(3)', quotedBlocks(act, 'Absatz 3 wird wie folgt gefasst:', 'Primarstufenteil umfasst fünf Schuljahre'));
  mutateStrings(touched.get('§ 4').next, 'Grundschulteil', 'Primarstufenteil', 1);
  mutateStrings(touched.get('§ 4').next, 'Oberschulteil', 'Sekundarstufenteil', 1);
  const p6 = touched.get('§ 6').next;
  mutateStrings(p6, 'Grundschulteil', 'Primarstufenteil', 1);
  mutateStrings(p6, 'Oberschulteil', 'Sekundarstufenteil', 1);
  replaceSubparagraph(p6, '(3)', quotedBlocks(act, 'Absatz 3 wird wie folgt gefasst:', 'gilt § 3 Absatz 3 entsprechend'));
  replaceSubparagraph(touched.get('§ 7').next, '(4)', quotedBlocks(act, '§ 7 Absatz 4 wird wie folgt gefasst:'));
  mutateStrings(touched.get('§ 8').next, 'Klassenstufen 1 bis 4 der Grundschule', 'Klassenstufen 1 bis 4 der Polytechnischen Oberschule', 1);
  mutateStrings(touched.get('§ 8').next, 'Klassenstufen 5 und 6 der Oberschule', 'Klassenstufen 5 und 6 der Polytechnischen Oberschule', 1);
  const p9 = touched.get('§ 9').next;
  mutateStrings(p9, 'Klassenstufen 1 bis 4 der Grundschule', 'Klassenstufen 1 bis 4 der Polytechnischen Oberschule', 1);
  replaceSubparagraph(p9, '(3)', quotedBlocks(act, 'Absatz 3 wird wie folgt gefasst:', 'emotionale und soziale Entwicklung'));
  mutateStrings(touched.get('§ 11').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  mutateStrings(touched.get('§ 12').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  const p13 = touched.get('§ 13').next;
  mutateStrings(p13, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 5);
  mutateStrings(p13, 'die Grundschule, die Oberschule+ oder die Gemeinschaftsschule', 'die Polytechnische Oberschule', 1);
  mutateStrings(p13, 'die Grundschule, die Oberschule+, die Gemeinschaftsschule', 'die Polytechnische Oberschule', 1);
  mutateStrings(p13, 'der Grund- und Oberschule, der Gemeinschaftsschule oder des Gymnasiums', 'der Polytechnischen oder Erweiterten Oberschule', 1);
  const p14 = touched.get('§ 14').next;
  mutateStrings(p14, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  const p14a1 = findOne(p14.children, { type: 'subparagraph', label: '(1)' });
  replaceSentence(p14a1, 2, quotedSentence(act, 'Satz 2 wird wie folgt gefasst:'));
  const item8 = findOne(p14.children, { type: 'item', label: '8.' });
  p14.children.splice(p14.children.indexOf(item8), 1);
  for (const block of p14.children) {
    if (block.type === 'item') {
      const number = Number.parseInt(block.label, 10);
      if (number >= 9 && number <= 13) block.label = `${number - 1}.`;
    }
  }
  mutateStrings(p14, 'Nummer 1 bis 6, 8 und 12', 'Nummer 1 bis 6 und 11', 1);
  mutateStrings(p14, 'Nummer 7, 10 und 13', 'Nummer 7, 9 und 12', 1);
  const p14a = touched.get('§ 14a').next;
  mutateStrings(p14a, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 2);
  const p14b = touched.get('§ 14b').next;
  mutateStrings(p14b, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  replaceRange(p14b, '(3)', '(5)', blocksAsSubparagraphs(quotedBlocks(act, 'Die Absätze 3 und 4 werden wie folgt gefasst:')));
  repealSubparagraph(p14b, '(6)');
  mutateStrings(touched.get('§ 15').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  touched.get('§ 16').next = quotedParagraph(act, '§ 16 wird wie folgt gefasst:', '§ 16');
  mutateStrings(touched.get('§ 18').next, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  const p20 = findTop(base.body, '§ 20');
  const p20a = quotedParagraph(act, 'Nach § 20 wird folgender § 20a eingefügt:', '§ 20a');
  const p22 = touched.get('§ 22').next;
  const p22a5 = blocksAsSubparagraphs(quotedBlocks(act, '§ 22 wird folgender Absatz 5 angefügt:'));
  if (p22a5.length !== 1 || p22a5[0].label !== '(5)') throw new Error('SOFS § 22 Absatz 5: unerwartete Zitatstruktur');
  p22.children.push(p22a5[0]);
  const p23 = touched.get('§ 23').next;
  mutateStrings(p23, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 2);
  const p24 = touched.get('§ 24').next;
  insertSentenceAfter(findOne(p24.children, { type: 'subparagraph', label: '(7)' }), 1, quotedSentence(act, 'Nach Absatz 7 Satz 1 wird folgender Satz eingefügt:'));
  mutateStrings(p24, 'Sächsischen Schulgesetzes', 'Ostdeutschen Schulgesetzes', 1);
  replaceSentence(findOne(p24.children, { type: 'subparagraph', label: '(8)' }), 2, quotedSentence(act, 'Absatz 8 Satz 2 wird wie folgt gefasst:'));
  const p25 = touched.get('§ 25').next;
  replaceSubparagraph(p25, '(7)', quotedBlocks(act, '§ 25 Absatz 7 wird wie folgt gefasst:'));
  replaceSentence(findOne(p25.children, { type: 'subparagraph', label: '(11)' }), 1, quotedSentence(act, '§ 25 Absatz 11 Satz 1 wird wie folgt gefasst:'));
  mutateStrings(touched.get('§ 27a').next, 'die Note „ungenügend“', 'die Note 5', 2);
  const p30 = touched.get('§ 30').next;
  replaceSubparagraph(p30, '(2)', quotedBlocks(act, 'Absatz 2 wird wie folgt gefasst:', 'lernzielgleicher Unterrichtung'));
  mutateStrings(p30, 'Oberschule oder Gemeinschaftsschule', 'Polytechnische Oberschule', 1);
  const p33 = touched.get('§ 33').next;
  mutateStrings(p33, 'Schulordnung Ober- und Abendoberschulen', 'Schulordnung Polytechnische Oberschulen', 1);
  replaceSubparagraph(p33, '(2)', quotedBlocks(act, 'In Absatz 1 werden die Wörter', 'Dieser Abschnitt findet keine Anwendung'));
  const p34 = touched.get('§ 34').next;
  mutateStrings(p34, 'von mindestens 2,2', 'von 2,2 oder besser', 1);
  replaceSubparagraph(p34, '(4)', quotedBlocks(act, 'Absatz 4 wird wie folgt gefasst:', 'Erlangung des Abschlusses'));
  replaceSubparagraph(p34, '(6)', quotedBlocks(act, 'Absatz 6 wird wie folgt gefasst:'));
  replaceRange(p34, '(7)', '(10)', blocksAsSubparagraphs(quotedBlocks(act, 'Die Absätze 7 bis 9 werden wie folgt gefasst:')));
  const p34a = touched.get('§ 34a').next;
  mutateStrings(p34a, 'mindestens die Note „ausreichend“ erzielt hat oder die Note „mangelhaft“', 'mindestens die Note 4 erzielt hat oder eine Note 5', 1);
  replaceSentence(findOne(p34a.children, { type: 'subparagraph', label: '(4)' }), 1, quotedSentence(act, 'Absatz 4 Satz 1 wird wie folgt gefasst:'));
  const p34b = touched.get('§ 34b').next;
  mutateStrings(p34b, 'Note „ausreichend“', 'Note 4', 1);
  mutateStrings(p34b, 'mindestens die Note „ausreichend“ erzielt hat oder die Note „mangelhaft“', 'mindestens die Note 4 erzielt hat oder eine Note 5', 1);
  replaceRange(p34b, '(2)', '(4)', blocksAsSubparagraphs(quotedBlocks(act, 'Die Absätze 2 und 3 werden wie folgt gefasst:')));
  touched.get('§ 34c').next.children = [{ type: 'paragraphText', text: '(weggefallen)' }];
  mutateStrings(touched.get('§ 35').next, 'mit Wirkung vom 1. August 2004', '', 1);
  const operations = [
    ...[...touched.values()].map(({ old, next }) => replaceProvisionOperation(old, next, 'Gesetze/OGVBl. 2026 Nr. 64.html', `Artikel 1 (${old.label})`)),
    insertAfterOperation(p20, p20a, 'Gesetze/OGVBl. 2026 Nr. 64.html', 'Artikel 1 Nummer 12'),
  ];
  await writeRecipe(SOFS_ACT, slug, recipe({
    act: SOFS_ACT, citation: 'Verordnung vom 15. August 2026 (OGVBl. 2026 Nr. 64 S. 2)',
    resultCitation: 'Schulordnung Förderschulen, geändert durch Verordnung vom 15. August 2026 (OGVBl. 2026 Nr. 64 S. 2)',
    changeNote: 'Schulstufen, Übergänge, Leistungsbewertung, Abschlüsse, Ethik und mobile Endgeräte an das neue Schulrecht angepasst.',
    operations, coverage: ['Artikel 1 Nummern 1 bis 32'], source: 'Gesetze/OGVBl. 2026 Nr. 64.html',
  }));
}

async function buildAdvisory(act) {
  const slug = 'vwv-beratungslehrer';
  const base = await baseline(slug);
  const nextBody = clone(base.body);
  const item = findOne(nextBody, { type: 'item', label: '2.1.1' });
  item.text = findOne(quotedBlocks(act, 'Nummer 2.1.1 wird wie folgt gefasst:'), { type: 'item', label: '2.1.1' }).text;
  for (const label of ['2.1.4', '2.2.1', '2.2.2', '2.3.1', '2.3.2', '2.3.3', '2.3.5', '2.3.6', '3.4']) {
    const target = findOne(nextBody, { type: 'item', label });
    for (const [oldText, newText] of [
      ['Regionalschulämter', 'Schulaufsichtsbehörden'],
      ['Regionalschulamtes', 'Schulaufsichtsbehörde'],
      ['Regionalschulamt', 'Schulaufsichtsbehörde'],
    ]) {
      const count = JSON.stringify(target).split(oldText).length - 1;
      if (count) mutateStrings(target, oldText, newText, count);
    }
  }
  for (const label of ['2.3.1', '3.4']) {
    const target = findOne(nextBody, { type: 'item', label });
    const variants = ['Sächsische Staatsministerium für Kultus', 'Sächsischen Staatsministerium für Kultus'];
    let count = 0;
    for (const oldText of variants) {
      const matches = JSON.stringify(target).split(oldText).length - 1;
      if (matches) { mutateStrings(target, oldText, 'oberste Schulaufsichtsbehörde', matches); count += matches; }
    }
    if (count < 1) throw new Error(`${label}: Ministeriumsbezeichnung nicht ersetzt`);
  }
  const operations = [];
  for (const section of base.body.filter((block) => block.type === 'section')) {
    const updated = findTop(nextBody, section.label, 'section');
    if (JSON.stringify(section) !== JSON.stringify(updated)) {
      operations.push(replaceProvisionOperation(section, updated, 'Gesetze/StAnzO. 2026 Nr. 30.html', `Nummern 1 bis 3 (${section.label})`));
    }
  }
  await writeRecipe('aendvwv-beratungslehrer-2026', slug, recipe({
    act: 'aendvwv-beratungslehrer-2026', citation: 'Verwaltungsvorschrift vom 16. August 2026 (StAnzO. 2026 Nr. 30 S. 2)',
    resultCitation: 'VwV Beratungslehrer, geändert durch Verwaltungsvorschrift vom 16. August 2026 (StAnzO. 2026 Nr. 30 S. 2)',
    changeNote: 'Auswahlregel und Behördenbezeichnungen aktualisiert.', operations,
    coverage: ['Nummern 1 bis 3'], source: 'Gesetze/StAnzO. 2026 Nr. 30.html',
  }));
}

async function buildCycling(act) {
  const slug = 'vwv-radfahrausbildung';
  const base = await baseline(slug);
  const touched = new Map();
  for (const label of ['I.', 'VI.', 'X.']) touched.set(label, { old: findTop(base.body, label, 'section'), next: clone(findTop(base.body, label, 'section')) });
  const i1 = findOne(touched.get('I.').next.children, { type: 'item', label: '1.' });
  i1.text = findOne(quotedBlocks(act, 'Ziffer I Nummer 1 wird wie folgt gefasst:'), { type: 'item', label: '1.' }).text;
  mutateStrings(touched.get('VI.').next, 'Standorte des Landesamtes für Schule und Bildung', 'Schulaufsichtsbehörden', 1);
  mutateStrings(touched.get('X.').next, 'Fahrradpass der Polizei Sachsen', 'von der zuständigen Polizeibehörde bereitgestellte Fahrradpass', 1);
  const operations = [...touched.values()].map(({ old, next }) =>
    replaceProvisionOperation(old, next, 'Gesetze/StAnzO. 2026 Nr. 31.html', `Nummern 1 bis 3 (${old.label})`)
  );
  await writeRecipe('aendvwv-radfahrausbildung-2026', slug, recipe({
    act: 'aendvwv-radfahrausbildung-2026', citation: 'Verwaltungsvorschrift vom 16. August 2026 (StAnzO. 2026 Nr. 31 S. 2)',
    resultCitation: 'VwV Radfahrausbildung, geändert durch Verwaltungsvorschrift vom 16. August 2026 (StAnzO. 2026 Nr. 31 S. 2)',
    changeNote: 'Lehrplan-, Schulaufsichts- und Polizeibezeichnungen aktualisiert.', operations,
    coverage: ['Nummern 1 bis 3'], source: 'Gesetze/StAnzO. 2026 Nr. 31.html',
  }));
}

async function buildForms(act) {
  const slug = 'vwv-schulformulare';
  const base = await baseline(slug);
  const sectionOld = findTop(base.body, 'II.', 'section');
  const section = clone(sectionOld);
  const item3e = findOne(section.children, { type: 'item', label: 'e)', parentLabel: '3.' }, 'Ziffer II Nummer 3 Buchstabe e');
  item3e.text = findOne(act.body, { type: 'item', label: 'e)' }, 'ÄndVwV Nummer 2 Buchstabe e').text;
  const item5a = findOne(section.children, { type: 'item', label: 'a)', parentLabel: '5.' }, 'Ziffer II Nummer 5 Buchstabe a');
  const candidates = [];
  walk(act.body, (block, parent) => {
    if (block.type === 'item' && block.label === 'a)' && parent?.type !== 'item' && block.text?.startsWith('Für jeden Kurs')) candidates.push(block);
  });
  if (candidates.length !== 1) throw new Error(`VwV Schulformulare Nummer 3 Buchstabe a: ${candidates.length} Treffer`);
  item5a.text = candidates[0].text.replace(/“$/u, '');
  const annexOld = findTop(base.body, 'Anlage', 'annex');
  const annex = clone(annexOld);
  const annex2 = annex.children.findIndex((block) => block.text === 'Anlage 2');
  if (annex2 < 0) throw new Error('VwV Schulformulare: Anlage 2 fehlt');
  annex.children.splice(annex2, 1, {
    type: 'section', label: 'Anlage 2', title: 'Schülerkartei', children: [
      { type: 'paragraphText', text: 'Amtlicher Formularvordruck; die Zeile „Religionszugehörigkeit: nein/ja“ entfällt.' },
      { type: 'item', label: '4', text: 'Nur in der Primarstufe der Polytechnischen Oberschule nach § 5 Absatz 2 SOPOS und an Förderschulen nach § 14 Absatz 1 Satz 6 Nummer 10 SOFS.', level: 0, numberingStyle: 'decimal', children: [] },
      { type: 'paragraphText', text: 'Anmeldung, Abmeldung und Teilnahme an freiwilligem Religions- oder Weltanschauungsunterricht werden nicht in der allgemeinen Schülerkartei, sondern ausschließlich in den Formularen nach der VwV Ethik, Religion und Weltanschauung dokumentiert.' },
    ],
  });
  const newTitle = quotedBlocks(act, 'Die Bezeichnung wird wie folgt gefasst:')[0].text;
  const operations = [
    renameOperation(base.sourceTitle, newTitle, 'Gesetze/StAnzO. 2026 Nr. 23.html', 'Nummer 1'),
    replaceProvisionOperation(sectionOld, section, 'Gesetze/StAnzO. 2026 Nr. 23.html', 'Nummern 2 und 3'),
    replaceProvisionOperation(annexOld, annex, 'Gesetze/StAnzO. 2026 Nr. 23.html', 'Nummer 4'),
  ];
  const result = recipe({
    act: 'aendvwv-schulformulare-2026', citation: 'Verwaltungsvorschrift vom 16. August 2026 (StAnzO. 2026 Nr. 23 S. 2)',
    resultCitation: 'VwV Schulformulare, geändert durch Verwaltungsvorschrift vom 16. August 2026 (StAnzO. 2026 Nr. 23 S. 2)',
    changeNote: 'Formularbezeichnungen, Kursbuchregel und Anlage 2 aktualisiert.', operations,
    coverage: ['Nummern 1 bis 4; Übergangsregelung in Nummer 5 verbleibt in der Änderungsvorschrift'], source: 'Gesetze/StAnzO. 2026 Nr. 23.html',
  });
  result.sourceReferences.push({
    kind: 'primary-pdf', label: 'Amtliche REVOSax-Anlage 2 (Ausgangsformular)', availability: 'versioned',
    localSource: 'data/recht/sources/revosax/vwv-schulformulare/anlage-2.pdf',
    url: 'https://www.revosax.sachsen.de/attachments/33341',
    sha256: 'bee7cc89f425e926ab82b9a37c21b81d4530e9d84e6aaff386034e6e9162da7e',
    mediaType: 'application/pdf', pageCount: 1, verifiedAt: '2026-08-16', sourceRole: 'visual-control',
  });
  await writeRecipe('aendvwv-schulformulare-2026', slug, result);
}

async function buildRepeal(target, itemNumber) {
  const base = await baseline(target);
  const value = recipe({
    act: CLEANUP_ACT,
    citation: 'Verordnung vom 16. August 2026 (OGVBl. 2026 Nr. 67 S. 2)',
    resultCitation: base.fullCitation,
    changeNote: 'Mit Ablauf des 31. August 2026 außer Kraft getreten.',
    coverage: [`Artikel 5 Absatz 1 Nummer ${itemNumber}`],
    source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
    operations: [{
      op: 'repealLaw',
      expectedHash: sha256({ title: base.sourceTitle, body: base.body }),
      expectedMatches: 1,
      source: 'Gesetze/OGVBl. 2026 Nr. 67.html',
      sourceProvision: `Artikel 5 Absatz 1 Nummer ${itemNumber}`,
      effectiveDate: EFFECTIVE_DATE,
    }],
  });
  value.repealsLaw = true;
  await writeRecipe(CLEANUP_ACT, target, value);
}

const cleanup = await amendment(CLEANUP_ACT);
const sofs = await amendment(SOFS_ACT);
const forms = await amendment('aendvwv-schulformulare-2026');
const advisory = await amendment('aendvwv-beratungslehrer-2026');
const cycling = await amendment('aendvwv-radfahrausbildung-2026');

await buildClasses(cleanup);
await buildSchoolNetwork(cleanup);
await buildFreeCarrier(cleanup);
await buildWaldorf(cleanup);
await buildAdvisory(advisory);
await buildCycling(cycling);
await buildForms(forms);
await buildRepeal('schulordnung-grundschulen', 1);
await buildRepeal('schulordnung-ober-und-abendoberschulen', 2);
await buildRepeal('schulordnung-gemeinschaftsschulen', 3);
await buildRepeal('schulordnung-gymnasien-abiturpruefung', 4);
void buildVocational;
void buildVocationalGymnasium;
void buildSofs;
void sofs;
