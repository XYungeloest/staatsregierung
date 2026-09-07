import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * Die beiden Arbeitslisten der Metadatenpflege sind committete Dateien; sie veralten sonst
 * unbemerkt gegen den Bestand. Geprüft wird ihre innere Stimmigkeit und ihr Bezug zum Bestand,
 * nicht ein Bestandswert: kein Test hier kennt eine Zahl wie 4.980 — er rechnet sie aus dem
 * Bestand aus und vergleicht. Wächst der Bestand oder trägt die Redaktion Kurzfassungen nach,
 * ändert sich die Zahl, und der Test bleibt richtig.
 */

const ROOT = process.cwd();
const NORMS_DIR = join(ROOT, 'content', 'normen');
const REVIEW_PATH = join(ROOT, 'data', 'recht', 'norm-summary-review.json');
const AUDIT_PATH = join(ROOT, 'data', 'recht', 'revosax-import-audit', 'summary.json');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const slugs = readdirSync(NORMS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const metaOf = new Map(slugs.map((slug) => [slug, readJson(join(NORMS_DIR, slug, 'meta.json'))]));
const hasEditorialSummary = (meta) => Boolean(String(meta.summary ?? '').trim());

test('norm-summary-review.json ist in sich stimmig', () => {
  const review = readJson(REVIEW_PATH);
  assert.ok(Array.isArray(review.entries), 'entries ist eine Liste');
  assert.equal(review.total, review.entries.length, 'total zählt die Einträge');
  const listed = review.entries.map((entry) => entry.slug);
  assert.equal(new Set(listed).size, listed.length, 'jeder Slug steht genau einmal');
  assert.deepEqual(listed, [...listed].sort((left, right) => left.localeCompare(right, 'de')), 'die Liste ist sortiert (reproduzierbare Datei)');
  const byType = review.entries.reduce((counts, entry) => ({ ...counts, [entry.type]: (counts[entry.type] ?? 0) + 1 }), {});
  assert.deepEqual(review.byType, byType, 'byType zählt dieselben Einträge');
  assert.equal(Object.values(review.byType).reduce((sum, value) => sum + value, 0), review.total, 'byType summiert sich auf total');
});

test('norm-summary-review.json beschreibt genau die Vorschriften ohne redaktionelle Kurzfassung', () => {
  const review = readJson(REVIEW_PATH);
  const listed = new Set(review.entries.map((entry) => entry.slug));

  for (const entry of review.entries) {
    const meta = metaOf.get(entry.slug);
    assert.ok(meta, `${entry.slug}: die Vorschrift gibt es im Bestand`);
    assert.equal(hasEditorialSummary(meta), false, `${entry.slug}: steht in der Liste, trägt aber eine Kurzfassung`);
    assert.equal(entry.type, meta.type, `${entry.slug}: Typ der Liste stimmt mit meta.json überein`);
    assert.equal(entry.primarySubject ?? null, meta.primarySubject ?? null, `${entry.slug}: Hauptsachgebiet stimmt mit meta.json überein`);
  }

  const missing = slugs.filter((slug) => !hasEditorialSummary(metaOf.get(slug)) && !listed.has(slug));
  assert.deepEqual(missing, [], 'jede Vorschrift ohne Kurzfassung steht in der Liste');
});

test('keine Vorschrift trägt mehr eine abgeleitete Kurzfassungsformel', () => {
  const derived = slugs.filter((slug) => metaOf.get(slug).summarySource === 'derived');
  assert.deepEqual(derived, [], 'summarySource "derived" ist abgeschafft; die Formeln sind entfernt');
  // Die Formeln dürfen auch ohne die Kennzeichnung nicht zurückkommen. Geprüft wird nicht gegen
  // eine Zeichenkette, sondern gegen die Formeln selbst: jede wird aus dem Titel der Vorschrift
  // nachgerechnet, so wie die beiden Erzeuger sie gebildet haben.
  const formeln = [];
  for (const slug of slugs) {
    const meta = metaOf.get(slug);
    const summary = String(meta.summary ?? '').trim();
    if (!summary) continue;
    for (const bezeichnung of [meta.title, meta.shortTitle].filter(Boolean)) {
      const gegenstand = String(bezeichnung).match(/\b(?:über|zur|zum)\s+(.+)$/iu)?.[1]?.replace(/\.$/u, '');
      const kandidaten = [
        `Enthält die Regelungen der amtlichen Ausgangsfassung „${bezeichnung}“.`,
        `Enthält die Regelungen der am 1. November 2023 übernommenen Ausgangsfassung „${bezeichnung}“.`,
        `Übernommene Änderungsvorschrift des Rechtsbestands zum 1. November 2023: „${bezeichnung}“.`,
        ...(gegenstand ? [`Regelt ${gegenstand.charAt(0).toLocaleLowerCase('de')}${gegenstand.slice(1)}.`] : []),
      ];
      if (kandidaten.includes(summary)) formeln.push(slug);
    }
  }
  assert.deepEqual(formeln, [], 'keine Vorschrift trägt eine aus ihrem eigenen Titel gebildete Formel als Kurzfassung');
});

test('das Import-Audit weist genau die Felder aus, die der Bestand noch abgeleitet trägt', () => {
  const audit = readJson(AUDIT_PATH).derivedMetadata;
  assert.ok(audit, 'derivedMetadata steht im Audit');
  assert.equal(audit.subjects.official + audit.subjects.derived, audit.subjects.total, 'die Sachgebietsbilanz geht auf');

  // `subjects` steht genau dann in der Liste, wenn es noch Zuordnungen ohne amtlichen Beleg gibt.
  assert.equal(audit.fields.includes('subjects'), audit.subjects.derived > 0, 'subjects ist genau dann ein offenes Feld, wenn es abgeleitete Zuordnungen gibt');
  // `summary` und `keywords` sind keine abgeleiteten Felder mehr: die Formeln sind entfernt, und
  // die Schlagwörter der übernommenen Vorschriften stammen aus der amtlichen Trefferliste.
  assert.equal(audit.fields.includes('summary'), false, 'summary ist kein abgeleitetes Feld mehr');
  assert.equal(audit.fields.includes('keywords'), false, 'keywords ist kein abgeleitetes Feld mehr');
  assert.ok(audit.source.includes('nicht amtlich belegt'), 'der Quellentext benennt die nicht belegte Herkunft ausdrücklich');
});

test('kein Schlagwort einer übernommenen Vorschrift ist ihre eigene Bezeichnung', () => {
  const treffer = [];
  for (const slug of slugs) {
    const meta = metaOf.get(slug);
    const names = new Set([meta.title, meta.shortTitle, meta.abbr].map((value) => String(value ?? '').trim()).filter(Boolean));
    for (const keyword of meta.keywords ?? []) {
      if (names.has(String(keyword).trim())) treffer.push(`${slug}: ${keyword}`);
    }
  }
  // Titel, Kurzbezeichnung und Abkürzung stehen im Suchindex als eigene Spalten; als Schlagwort
  // wären sie doppelt.
  assert.deepEqual(treffer, [], 'Bezeichnungen gehören nicht zusätzlich in die Schlagwörter');
});
