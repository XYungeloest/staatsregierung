import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  classifyHtmlSource,
  parseConsolidatedHtml,
  parsePublicationHtml,
  sourceFindingIssues,
  summarizeParsedSource,
} from '../../scripts/lib/norm-html-parser.mjs';
import {
  ACCEPTED_SEQUENCE_ISSUES,
  acceptedSequenceIssuesFor,
  validateConstitutionParserContract,
  validatePublicationParserContract,
} from '../../scripts/lib/norm-parser-contract.mjs';
import { complexHtmlStructureFixtures } from './norm-structure-fixtures.mjs';

/**
 * Korpus-Tests auf den amtlichen HTML-Quellen unter Gesetze/: PDF-geprüfte Strukturmerkmale
 * (tests/corpus/norm-structure-fixtures.mjs) und amtlich belegte Nummerierungsbefunde. Die
 * Parserregeln selbst prüft tests/norm-html-parser.test.mjs auf synthetischen Fixtures.
 */

function flatten(blocks, output = [], insideQuote = false) {
  for (const block of blocks ?? []) {
    output.push({ block, insideQuote });
    flatten(block.children, output, insideQuote || block.type === 'quotedProvision');
  }
  return output;
}

function bodyText(norm) {
  return JSON.stringify(norm.body);
}

// Kopf, Inhaltsverzeichnis, CSS, eingebettete Bilder und Signaturblöcke gehören nie in einen Normkörper.
const IMPORT_ARTEFACTS = /data:image|;base64,|@import|Inhaltsverzeichnis|Dresden, den|LANDTAGSPRÄSIDENT/u;

function itemAt(parsed, path) {
  const [sectionLabel, itemLabel] = path.split('|');
  const section = parsed.body.find((block) => block.label === sectionLabel && block.children?.some((child) => child.type === 'item'));
  return section?.children.find((block) => block.label === itemLabel);
}

test('PDF-geprüfte Strukturfixtures sichern die amtlichen HTML-Quellen strukturtreu und artefaktfrei', async () => {
  for (const [fileName, fixture] of Object.entries(complexHtmlStructureFixtures)) {
    const html = await readFile(new URL(`../../Gesetze/${fileName}`, import.meta.url), 'utf8');
    if (fixture.consolidated) {
      const parsed = parseConsolidatedHtml(fileName, html, { title: fixture.title });
      assert.deepEqual(validateConstitutionParserContract(parsed), [], fileName);
      for (const [label, children] of Object.entries(fixture.labelChildren ?? {})) {
        const block = flatten(parsed.body).find((entry) => entry.block.label === label)?.block;
        assert.deepEqual(block?.children.map((child) => child.label), children, `${fileName}: ${label}`);
      }
      assert.doesNotMatch(bodyText(parsed), IMPORT_ARTEFACTS, fileName);
      continue;
    }
    assert.equal(classifyHtmlSource(fileName, html).kind, 'publication', fileName);
    const parsed = parsePublicationHtml(fileName, html, { acceptedSequenceIssues: acceptedSequenceIssuesFor(fileName) });
    assert.deepEqual(validatePublicationParserContract(parsed), [], fileName);
    const summary = summarizeParsedSource(parsed);
    const flat = flatten(parsed.body);
    const allBlocks = [parsed.body, ...parsed.introducedNorms.map((norm) => norm.body)].flatMap((body) => flatten(body).map((entry) => entry.block));
    if (fixture.outerArticles) assert.deepEqual(summary[0].outerArticles, fixture.outerArticles, `${fileName}: äußere Artikel`);
    if (fixture.outerParagraphs) assert.deepEqual(summary[0].outerParagraphs, fixture.outerParagraphs, `${fileName}: äußere Paragraphen`);
    if (fixture.introducedCount !== undefined) assert.equal(parsed.introducedNorms.length, fixture.introducedCount, `${fileName}: eingeführte Normen`);
    if (fixture.introducedLastStructures) assert.deepEqual(summary.slice(1).map((entry) => entry.lastStructure), fixture.introducedLastStructures, `${fileName}: eingeführte Normen`);
    if (fixture.introducedAbbreviations) assert.deepEqual(parsed.introducedNorms.map((norm) => norm.abbr), fixture.introducedAbbreviations, `${fileName}: Abkürzungen`);
    if (fixture.number1Children) {
      const article1 = parsed.body.find((block) => block.label === 'Artikel 1');
      const number1 = article1?.children.find((block) => block.label === '1.');
      assert.deepEqual(number1?.children.map((child) => child.label), fixture.number1Children, `${fileName}: Geschwister unter Nummer 1`);
      assert.equal(number1?.children.filter((block) => block.label === fixture.number1Children[0]).length, 1, `${fileName}: kein doppeltes Gliederungszeichen unter Nummer 1`);
      if (fixture.number1FirstChildPath) {
        assert.deepEqual([number1?.children[0]?.label, number1?.children[0]?.children?.[0]?.label], fixture.number1FirstChildPath, `${fileName}: Verschachtelung unter Nummer 1`);
      }
    }
    if (fixture.quotedStructure) assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.type === fixture.quotedStructure), `${fileName}: zitierte Struktur ${fixture.quotedStructure}`);
    if (fixture.quotedLabel) assert.ok(flat.some(({ block, insideQuote }) => insideQuote && block.label === fixture.quotedLabel), `${fileName}: zitierte Struktur ${fixture.quotedLabel}`);
    if (fixture.quotedArticle) {
      const quotedArticle = flat.find(({ block, insideQuote }) => insideQuote && block.type === 'article' && block.label === fixture.quotedArticle)?.block;
      assert.ok(quotedArticle, `${fileName}: zitierter Artikel ${fixture.quotedArticle}`);
      assert.deepEqual(quotedArticle.children.map((child) => child.label), fixture.quotedParagraphs, `${fileName}: Absätze in ${fixture.quotedArticle}`);
    }
    if (fixture.articleQuotedFirstChild) {
      const article = parsed.body.find((block) => block.label === fixture.articleQuotedFirstChild.article);
      assert.equal(article?.children[0]?.type, 'quotedProvision', `${fileName}: ${fixture.articleQuotedFirstChild.article} beginnt mit einem Zitat`);
      assert.equal(article?.children[0]?.children[0]?.label, fixture.articleQuotedFirstChild.label, `${fileName}: erste zitierte Gliederung`);
    }
    for (const type of fixture.noTopLevel ?? []) assert.ok(!parsed.body.some((block) => block.type === type), `${fileName}: ${type} nur innerhalb des Zitats`);
    if (fixture.tableCount !== undefined) assert.equal(summary[0].tableCount, fixture.tableCount, `${fileName}: Tabellen`);
    for (const [label, type] of Object.entries(fixture.labelTypes ?? {})) assert.equal(allBlocks.find((block) => block.label === label)?.type, type, `${fileName}: Blocktyp von ${label}`);
    for (const [label, count] of Object.entries(fixture.labelCounts ?? {})) assert.equal(allBlocks.filter((block) => block.label === label).length, count, `${fileName}: Häufigkeit von ${label}`);
    if (fixture.firstBlockType) assert.equal(parsed.body[0]?.type, fixture.firstBlockType, `${fileName}: erster Block`);
    if (fixture.noStandaloneDecimalAnchors) assert.equal(allBlocks.filter((block) => block.type === 'paragraphText' && /^\d+\.$/u.test(block.text)).length, 0, `${fileName}: allein gedruckte Dezimalanker`);
    for (const label of fixture.decimalWithLetterChildren ?? []) assert.ok(allBlocks.some((block) => block.label === label && block.children?.some((child) => /^a[.)]$/u.test(child.label))), `${fileName}: ${label} trägt eine Buchstabenunterliste`);
    for (const [path, labels] of Object.entries(fixture.itemChildrenLabels ?? {})) assert.deepEqual(itemAt(parsed, path)?.children.filter((child) => child.type === 'item').map((child) => child.label), labels, `${fileName}: Unterpunkte von ${path}`);
    for (const path of fixture.itemsWithLeadingText ?? []) assert.equal(itemAt(parsed, path)?.children[0]?.type, 'paragraphText', `${fileName}: Fortsetzungstext unter ${path}`);
    for (const path of fixture.topLevelItems ?? []) assert.equal(itemAt(parsed, path)?.level, 0, `${fileName}: ${path} bleibt auf der Elternebene`);
    assert.deepEqual(sourceFindingIssues(parsed.body), acceptedSequenceIssuesFor(fileName), `${fileName}: Listensequenzen`);
    for (const norm of [parsed, ...parsed.introducedNorms]) assert.doesNotMatch(bodyText(norm), IMPORT_ARTEFACTS, fileName);
  }
});


test('eine amtlich belegte Nummerierungslücke wird nur mit wörtlich hinterlegtem Befund zugelassen', async () => {
  for (const [fileName, acceptance] of Object.entries(ACCEPTED_SEQUENCE_ISSUES)) {
    const html = await readFile(new URL(`../../Gesetze/${fileName}`, import.meta.url), 'utf8');
    assert.ok(acceptance.evidence.length > 20, `${fileName}: Nachweis fehlt`);
    assert.throws(() => parsePublicationHtml(fileName, html), /needs-review/u, `${fileName}: ohne Freigabe bleibt der Befund ein Abbruchgrund`);
    assert.throws(
      () => parsePublicationHtml(fileName, html, { acceptedSequenceIssues: ['anderer Befund'] }),
      /needs-review/u,
      `${fileName}: ein abweichender Freigabetext lässt den Import nicht zu`,
    );
    const parsed = parsePublicationHtml(fileName, html, { acceptedSequenceIssues: acceptance.issues });
    assert.deepEqual(sourceFindingIssues(parsed.body), acceptance.issues, `${fileName}: genau die hinterlegten Befunde bleiben sichtbar`);
  }
});

