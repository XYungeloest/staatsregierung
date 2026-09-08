#!/usr/bin/env node

/**
 * Einmalige Bereinigung der Schlagwörter des eigenen ostdeutschen Bestands.
 *
 * Schlagwörter sind Zweitbezeichnungen und Nutzerbegriffe. Titel, Kurzbezeichnung und Abkürzung
 * stehen im Volltextindex bereits als eigene Spalten (`law_search`); ein Titelbestandteil ab fünf
 * Zeichen ist dort doppelt und als Suchbegriff wertlos — „Erstes“, „Änderung“ oder „Freistaat“ ist
 * kein Begriff, unter dem jemand sucht. Dieselbe Regel hat den übernommenen Bestand bereinigt
 * (scripts/refine-revosax-derived-metadata.mjs); dieses Werkzeug wendet sie auf die Vorschriften
 * ohne REVOSax-Provenienz an, deren Schlagwörter der Erzeuger scripts/import-normen.mjs bis dahin
 * aus der Kurzbezeichnung gebildet hat. Maßgeblich ist die gemeinsame Regel `titleWords` aus
 * scripts/lib/norm-title-rules.mjs — wer entfernt, muss dasselbe Muster treffen, das erzeugt wurde,
 * sonst verschwinden redaktionelle Begriffe mit.
 *
 * Vorschriften mit REVOSax-Provenienz (`sourceReferences[].lawId`) bleiben unberührt: dort ist das
 * Schlagwort die amtliche Bezeichnung der Trefferliste, die im Langtitel in Klammern wiederkehrt.
 *
 * Angefasst wird ausschließlich das Feld `keywords` in content/normen/<slug>/meta.json; die
 * Reihenfolge der verbleibenden Werte und jedes andere Feld bleiben, wie sie sind. Eine leere
 * Liste ist zulässig (scripts/check-content.mjs) — dann trägt die Vorschrift keine belegte
 * Zweitbezeichnung mehr.
 *
 * Aufruf:
 *   node scripts/migrate-own-norm-keywords.mjs            # nur Bericht, schreibt nichts
 *   node scripts/migrate-own-norm-keywords.mjs --write    # schreibt content/normen
 *
 * Die Migration ist deterministisch und arbeitet ohne Netzwerkzugriff.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { keywordCore, titleWords } from './lib/norm-title-rules.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NORMS_DIR = join(ROOT, 'content/normen');

/** True, wenn die Vorschrift aus dem übernommenen REVOSax-Bestand stammt. */
function hasRevosaxProvenance(meta) {
  return (meta.sourceReferences ?? [])
    .some((reference) => typeof reference?.lawId === 'string' && reference.lawId);
}

function main() {
  const write = process.argv.includes('--write');
  const slugs = readdirSync(NORMS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const stats = { norms: slugs.length, own: 0, changed: 0, removed: 0, kept: 0, withoutKeyword: 0 };

  for (const slug of slugs) {
    const path = join(NORMS_DIR, slug, 'meta.json');
    const meta = JSON.parse(readFileSync(path, 'utf8'));
    if (hasRevosaxProvenance(meta)) continue;
    stats.own += 1;

    const names = new Set([meta.title, meta.shortTitle, meta.abbr]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean));
    const words = titleWords(meta);
    const before = (meta.keywords ?? []).map((value) => String(value ?? '').trim()).filter(Boolean);
    // Verglichen wird die randbereinigte Form: „Abendgymnasien-“ ist derselbe Titelbestandteil wie
    // „Abendgymnasien“, nur mit dem Bindestrich einer aufgetrennten Wortverbindung. Ein Wert mit
    // Bindestrich am Rand ist nie eine Bezeichnung, unter der jemand sucht.
    const after = before.filter((value) => !names.has(value)
      && !words.has(keywordCore(value))
      && !/^-|-$/u.test(value));
    stats.kept += after.length;
    if (after.length === before.length) continue;

    stats.changed += 1;
    stats.removed += before.length - after.length;
    if (after.length === 0) stats.withoutKeyword += 1;
    meta.keywords = after;
    if (write) writeFileSync(path, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  }

  console.log(`Normen: ${stats.norms}, davon eigener Bestand: ${stats.own}`);
  console.log(`geänderte Dateien: ${stats.changed}${write ? '' : ' (Probelauf, nichts geschrieben)'}`);
  console.log(`entfernte Titelbestandteile: ${stats.removed}, verbleibende Schlagwörter: ${stats.kept}`);
  console.log(`danach ohne Schlagwort: ${stats.withoutKeyword}`);
}

main();
