import assert from 'node:assert/strict';
import test from 'node:test';

import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { isInheritedAmendment } from '@ostrecht/shared/lib/norms/inventory.ts';
import { getNormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';
import { getNormSortWord } from '@ostrecht/shared/lib/norms/presentation.ts';
import { getGermanIndexLetter } from '@ostrecht/shared/lib/norms/routes.ts';
import { getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import type { NormType } from '@ostrecht/shared/lib/norms/schema.ts';

import { loadNormsOnce } from '../helpers/corpus.ts';

/**
 * Das Ordnungswort soll den alphabetischen Zugang tatsächlich aufteilen. Geprüft wird über den
 * ganzen Bestand: keine Buchstabengruppe trägt mehr als ein Viertel eines Verzeichnisses, das
 * Ordnungswort ist nie leer und beginnt nie mit Artikel oder Präposition. Ohne diese Prüfung
 * fällt erst im Betrieb auf, dass eine Titelgewohnheit alle Vorschriften unter einen Buchstaben
 * stellt (vor dem Ordnungswort standen 79 Prozent der Verwaltungsvorschriften unter V).
 */

const LEADING_STOPWORD = /^(?:der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen|über|zur|zum|zu|für|gegen|von|vom|mit|nach|auf|bei|wegen|betreffend|hinsichtlich)\s/iu;
const MAX_LETTER_SHARE = 0.25;

interface SortRow {
  slug: string;
  type: NormType;
  word: string;
  letter: string;
}

let rowsPromise: Promise<SortRow[]> | null = null;

/** Grundmenge des Bestands mit ihrem Ordnungswort (übernommene Änderungsvorschriften ohne). */
function inventoryRows(): Promise<SortRow[]> {
  rowsPromise ??= (async () => {
    const norms = await loadNormsOnce();
    return norms
      .map((norm) => {
        const identity = getNormVersionIdentity(norm, getApplicableVersion(norm));
        const word = getNormSortWord(identity);
        return { slug: norm.meta.slug, type: norm.meta.type, originKind: getNormOriginInfo(norm, norms).kind, word, letter: getGermanIndexLetter(word) };
      })
      .filter((row) => !isInheritedAmendment(row));
  })();
  return rowsPromise;
}

function maxLetterShare(rows: SortRow[]): { letter: string; count: number; share: number } {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.letter, (counts.get(row.letter) ?? 0) + 1);
  const [letter, count] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? ['', 0];
  return { letter, count, share: rows.length === 0 ? 0 : count / rows.length };
}

test('kein Verzeichnis der Grundmenge liegt zu mehr als einem Viertel unter einem Buchstaben', async () => {
  const rows = await inventoryRows();
  assert.ok(rows.length > 0);
  for (const type of ['gesetz', 'verordnung', 'verwaltungsvorschrift', 'foerderrichtlinie'] as NormType[]) {
    const scoped = rows.filter((row) => row.type === type);
    assert.ok(scoped.length > 0, `Bestand ohne ${type}`);
    const worst = maxLetterShare(scoped);
    assert.ok(worst.share <= MAX_LETTER_SHARE, `${type}: ${worst.count} von ${scoped.length} unter ${worst.letter} (${Math.round(worst.share * 100)} Prozent)`);
  }
  const overall = maxLetterShare(rows);
  assert.ok(overall.share <= MAX_LETTER_SHARE, `Grundmenge: ${overall.count} von ${rows.length} unter ${overall.letter} (${Math.round(overall.share * 100)} Prozent)`);
});

test('das Ordnungswort ist nie leer und beginnt nie mit Artikel oder Präposition', async () => {
  const rows = await inventoryRows();
  const empty = rows.filter((row) => row.word.trim() === '');
  assert.deepEqual(empty.map((row) => row.slug), []);
  const leading = rows.filter((row) => LEADING_STOPWORD.test(row.word));
  assert.deepEqual(leading.slice(0, 5).map((row) => `${row.slug}: ${row.word}`), []);
});
