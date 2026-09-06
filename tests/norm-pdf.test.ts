import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNormFullCitation, buildNormRecordLookup } from '@ostrecht/shared/lib/norms/citation.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import type { NormBodyBlock, NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import { classifyNormVersion } from '@ostrecht/shared/lib/norms/versions.ts';

import { referenceDateLabel, versionKindLabel } from '../apps/recht/src/lib/vocabulary.ts';
import { TEXT_WIDTH, flattenNormBody, paginate, wrapParagraphs } from '../apps/recht/src/lib/pdf/layout.ts';
import { renderNormVersionPdf, versionStatusLine } from '../apps/recht/src/lib/pdf/norm-pdf.ts';
import { encodeWinAnsi, toWinAnsiBytes } from '../apps/recht/src/lib/pdf/winansi.ts';
import { FIXTURE_REFERENCE_DATE, FIXTURE_ROLES, buildFixtureNorms } from './helpers/fixture-corpus.ts';

/**
 * Erzeugung der Fassungs-PDF: Dateiaufbau (Querverweistabelle, Seitenbaum), Kopf- und Fußzeilen,
 * Umbruch und Seitenverteilung, Zeichenkodierung und Wiederholbarkeit. Geprüft wird Verhalten auf
 * dem synthetischen Testbestand (tests/helpers/fixture-corpus.ts) und auf eigens gebauten
 * Blockfolgen – nie an einer realen Vorschrift.
 */

const norms = buildFixtureNorms();
const lookup = buildNormRecordLookup(norms);

function fixtureNorm(role: keyof typeof FIXTURE_ROLES): NormRecord {
  const slug = FIXTURE_ROLES[role];
  const norm = norms.find((entry) => entry.meta.slug === slug);
  assert.ok(norm, `Fixture-Rolle „${role}“ fehlt im Testbestand`);
  return norm;
}

function versionOfKind(norm: NormRecord, kind: 'current' | 'historical'): NormVersion {
  const version = norm.versions.find((entry) => classifyNormVersion(norm, entry, FIXTURE_REFERENCE_DATE) === kind);
  assert.ok(version, `Fassungsart „${kind}“ fehlt im Testbestand`);
  return version;
}

/** PDF-Bytes als Latin-1-Text; die Struktur (Objekte, Querverweise) ist reiner ASCII-Text. */
function asText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

/** Hexdarstellung eines Textes, wie sie im Inhaltsstrom steht. */
function hexOf(value: string): string {
  return [...toWinAnsiBytes(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const winAnsiDecoder = new TextDecoder('windows-1252');

/** Die gesetzten Textstücke eines ungepackten Dokuments in Reihenfolge des Inhaltsstroms. */
function renderedRuns(bytes: Uint8Array): string[] {
  return [...asText(bytes).matchAll(/<([0-9a-f]*)> Tj/gu)].map(([, hex]) =>
    winAnsiDecoder.decode(Uint8Array.from(hex.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16))),
  );
}

async function renderFixturePdf(role: keyof typeof FIXTURE_ROLES, kind: 'current' | 'historical' = 'current'): Promise<{ norm: NormRecord; version: NormVersion; fullCitation: string; bytes: Uint8Array }> {
  const norm = fixtureNorm(role);
  const version = versionOfKind(norm, kind);
  const fullCitation = buildNormFullCitation(norm, version, lookup);
  const bytes = await renderNormVersionPdf({
    norm,
    version,
    fullCitation,
    temporalKind: classifyNormVersion(norm, version, FIXTURE_REFERENCE_DATE),
    referenceDate: FIXTURE_REFERENCE_DATE,
    compress: false,
  });
  return { norm, version, fullCitation, bytes };
}

test('erzeugtes PDF trägt einen gültigen Dateiaufbau mit stimmiger Querverweistabelle', async () => {
  const { bytes } = await renderFixturePdf('inherited-amended');
  const text = asText(bytes);

  assert.ok(text.startsWith('%PDF-1.4\n'), 'Datei beginnt mit der PDF-Kennung');
  assert.ok(text.endsWith('%%EOF'), 'Datei endet mit der Endmarke');

  const startxref = text.match(/startxref\n(\d+)\n%%EOF$/u);
  assert.ok(startxref, 'startxref steht am Dateiende');
  const xrefOffset = Number(startxref[1]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), 'xref', 'startxref zeigt auf die Querverweistabelle');

  const header = text.slice(xrefOffset).match(/^xref\n0 (\d+)\n/u);
  assert.ok(header, 'Querverweistabelle nennt ihre Größe');
  const size = Number(header[1]);
  const entriesStart = xrefOffset + header[0].length;
  assert.equal(text.slice(entriesStart, entriesStart + 20), '0000000000 65535 f\r\n', 'der erste Eintrag ist der freie Eintrag');
  for (let objectNumber = 1; objectNumber < size; objectNumber += 1) {
    const entry = text.slice(entriesStart + objectNumber * 20, entriesStart + (objectNumber + 1) * 20);
    assert.match(entry, /^\d{10} 00000 n\r\n$/u, `Eintrag ${objectNumber} hat das feste Format`);
    const offset = Number(entry.slice(0, 10));
    assert.ok(text.startsWith(`${objectNumber} 0 obj`, offset), `Eintrag ${objectNumber} zeigt auf das Objekt`);
  }

  const pageObjects = text.match(/\/Type \/Page\b/gu) ?? [];
  const count = text.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/u);
  assert.ok(count, 'Seitenbaum nennt die Seitenzahl');
  assert.equal(Number(count[1]), pageObjects.length, 'Seitenzahl entspricht der Zahl der Seitenobjekte');
  assert.equal(Number(count[1]), (size - 7) / 2, 'je Seite ein Seiten- und ein Inhaltsobjekt');
});

test('Kopfblock nennt Vollzitat und Rechtsstand, jede Seite trägt den Portalhinweis', async () => {
  const { norm, version, fullCitation, bytes } = await renderFixturePdf('inherited-amended');
  const runs = renderedRuns(bytes);
  const document = runs.join(' ');

  assert.ok(runs.some((run) => run.startsWith('Vollzitat: ')), 'der Kopfblock nennt das Vollzitat');
  assert.ok(document.includes(`Vollzitat: ${toDisplayText(fullCitation)}`), 'das Vollzitat steht vollständig im Kopfblock');
  assert.ok(runs.includes(`${versionKindLabel('current')}, ${referenceDateLabel(FIXTURE_REFERENCE_DATE)}`), 'die geltende Fassung nennt den Rechtsstand');
  assert.ok(runs.some((run) => run.startsWith('Fundstelle: ')), 'der Kopfblock nennt die Fundstelle');
  assert.ok(document.includes(toDisplayText(version.body[0]?.title ?? '')), 'der Vorschriftentext steht im Dokument');

  const pages = Number(asText(bytes).match(/\/Count (\d+)/u)?.[1]);
  for (let page = 1; page <= pages; page += 1) {
    assert.ok(
      runs.some((run) => run === `Portalfassung, keine amtliche Verkündung · OstRecht, recht.freistaat-ostdeutschland.de · Seite ${page} von ${pages}`),
      `Seite ${page} trägt den Fuß mit Seitenzahl`,
    );
  }
  assert.ok(runs.filter((run) => run.startsWith(`${toDisplayText(norm.meta.shortTitle ?? norm.meta.title)} · `)).length >= pages - 1, 'jede Seite trägt den laufenden Kopf');
});

test('historische Fassung nennt die Fassungsart und ihre Gültigkeit statt des Rechtsstands', async () => {
  const { norm, version, bytes } = await renderFixturePdf('inherited-amended', 'historical');
  const runs = renderedRuns(bytes);
  const status = versionStatusLine({ version, temporalKind: 'historical', referenceDate: FIXTURE_REFERENCE_DATE });

  assert.ok(status.startsWith(versionKindLabel('historical')), 'Statuszeile beginnt mit der Fassungsart');
  assert.ok(status.includes('gültig ab'), 'Statuszeile nennt den Beginn der Gültigkeit');
  assert.ok(runs.includes(status), 'die Statuszeile steht im Dokument');
  assert.ok(!runs.join(' ').includes(referenceDateLabel(FIXTURE_REFERENCE_DATE)), 'die historische Fassung nennt keinen Rechtsstand');
  assert.notEqual(version.versionId, versionOfKind(norm, 'current').versionId);
});

test('langer Vorschriftentext wird auf mehrere Seiten mit fortlaufender Seitenzahl verteilt', async () => {
  const norm = structuredClone(fixtureNorm('inherited-amended')) as NormRecord;
  const version = versionOfKind(norm, 'current');
  const blocks: NormBodyBlock[] = Array.from({ length: 3000 }, (_, index) => ({
    type: 'subparagraph',
    label: `(${index + 1})`,
    text: `Absatz ${index + 1} enthält eine Regelung mit hinreichender Länge für den Zeilenumbruch im erzeugten Dokument.`,
    children: [],
  }));
  version.body = blocks;

  const lines = wrapParagraphs(flattenNormBody(blocks));
  for (const line of lines) assert.ok(line.width <= TEXT_WIDTH + 0.01, `Zeile bleibt in der Textbreite (${line.width})`);
  const pages = paginate(lines);
  assert.ok(pages.length > 20, `mehrseitiges Dokument (${pages.length} Seiten)`);

  const bytes = await renderNormVersionPdf({
    norm,
    version,
    temporalKind: 'current',
    referenceDate: FIXTURE_REFERENCE_DATE,
    compress: false,
  });
  const text = asText(bytes);
  const total = Number(text.match(/\/Count (\d+)/u)?.[1]);
  assert.ok(total > 20, 'die Datei hat entsprechend viele Seiten');

  let previous = -1;
  for (let page = 1; page <= total; page += 1) {
    const position = text.indexOf(hexOf(`Seite ${page} von ${total}`));
    assert.ok(position > previous, `Seite ${page} trägt ihre Fußzeile in der richtigen Reihenfolge`);
    previous = position;
  }
});

test('überlange Wörter werden hart getrennt statt über den Rand zu laufen', () => {
  const lines = wrapParagraphs([
    { text: `Kennung ${'A'.repeat(400)} Ende`, font: 'F1', size: 10.5, indent: 0, spacingBefore: 0, keepWithNext: false },
  ]);
  assert.ok(lines.length > 1, 'das Wort wird auf mehrere Zeilen verteilt');
  for (const line of lines) assert.ok(line.width <= TEXT_WIDTH + 0.01, 'keine Zeile ragt über die Textbreite hinaus');
});

test('Zeichen werden nach Windows-1252 kodiert, Sonderzeichen ersetzt und Unbekanntes gemeldet', () => {
  const german = encodeWinAnsi('äöüß§€„“–—');
  assert.deepEqual([...german.bytes], [0xe4, 0xf6, 0xfc, 0xdf, 0xa7, 0x80, 0x84, 0x93, 0x96, 0x97]);
  assert.deepEqual(german.unmapped, []);

  const replaced = encodeWinAnsi('⁴ě→●−');
  assert.deepEqual([...replaced.bytes], [0x34, 0x65, 0x2d, 0x3e, 0x95, 0x2d], '⁴ → 4, ě → e, → → ->, ● → Aufzählungszeichen, − → -');
  assert.deepEqual(replaced.unmapped, []);

  const cyrillic = encodeWinAnsi('Сор');
  assert.equal(Buffer.from(cyrillic.bytes).toString('latin1'), 'Sor');
  assert.deepEqual(cyrillic.unmapped, []);

  const unknown = encodeWinAnsi('Zeichen 漢 im Text');
  assert.equal(Buffer.from(unknown.bytes).toString('latin1'), 'Zeichen ? im Text');
  assert.deepEqual(unknown.unmapped, ['漢']);

  const whitespace = encodeWinAnsi('1 000 Euro­zeichen\tund');
  assert.equal(Buffer.from(whitespace.bytes).toString('latin1'), '1 000 Eurozeichen und');
});

test('dieselbe Fassung ergibt bei jedem Aufruf dieselben Bytes, auch gepackt', async () => {
  const first = await renderFixturePdf('constitution');
  const second = await renderFixturePdf('constitution');
  assert.deepEqual([...first.bytes], [...second.bytes], 'unkomprimierte Ausgabe ist wiederholbar');

  const norm = fixtureNorm('constitution');
  const version = versionOfKind(norm, 'current');
  const packedInput = {
    norm,
    version,
    temporalKind: 'current' as const,
    referenceDate: FIXTURE_REFERENCE_DATE,
  };
  const packed = await renderNormVersionPdf(packedInput);
  const packedAgain = await renderNormVersionPdf(packedInput);
  assert.deepEqual([...packed], [...packedAgain], 'gepackte Ausgabe ist wiederholbar');
  assert.ok(asText(packed).includes('/Filter /FlateDecode'), 'die Inhaltsströme werden gepackt');
  assert.ok(packed.length < first.bytes.length, 'die gepackte Datei ist kleiner');
});

test('Tabellen im Vorschriftentext werden lesbar verkettet', async () => {
  const { bytes } = await renderFixturePdf('norm-table');
  assert.ok(asText(bytes).startsWith('%PDF-1.4\n'), 'die Tabellenfassung wird erzeugt');
  assert.ok(renderedRuns(bytes).some((run) => run.includes(' · ')), 'eine Tabellenzeile steht als verketteter Text im Dokument');

  const norm = fixtureNorm('norm-table');
  const version = versionOfKind(norm, 'current');
  const paragraphs = flattenNormBody(version.body);
  const joinedRow = paragraphs.find((paragraph) => paragraph.text.includes(' · '));
  assert.ok(joinedRow, 'eine Tabellenzeile steht als verkettete Textzeile');
  for (const line of wrapParagraphs(paragraphs)) assert.ok(line.width <= TEXT_WIDTH + 0.01, 'auch Tabellenzeilen bleiben in der Textbreite');
});

test('unbekannte Blockarten brechen die Erzeugung nicht ab', () => {
  const blocks = [
    { type: 'unterschriftenblock' as unknown as NormBodyBlock['type'], label: 'Dresden, den 1. Januar 2026', text: 'Vorname Nachname', title: 'Amtsbezeichnung' },
    { type: 'signature' as unknown as NormBodyBlock['type'], label: 'Dresden, den 2. Januar 2026', text: 'Vorname Nachname', title: 'Amtsbezeichnung' },
  ] satisfies NormBodyBlock[];
  const paragraphs = flattenNormBody(blocks);
  assert.ok(paragraphs.length >= 4, 'beide Blöcke liefern Textzeilen');
  assert.ok(paragraphs.some((paragraph) => paragraph.text === 'Amtsbezeichnung'), 'das Amt steht auf einer eigenen Zeile');
});
