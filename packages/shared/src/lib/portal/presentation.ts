import type { Themenstatus } from '@ostrecht/shared/lib/portal/schema.ts';

export function formatTopicStatus(status: Themenstatus): string {
  switch (status) {
    case 'geplant':
      return 'Geplant';
    case 'entwurf':
      return 'Entwurf';
    case 'im-gesetzgebungsverfahren':
      return 'Im Gesetzgebungsverfahren';
    case 'beschlossen':
      return 'Beschlossen';
    case 'in-umsetzung':
      return 'In Umsetzung';
    case 'abgeschlossen':
      return 'Abgeschlossen';
  }
}

export function getTopicStatusTone(status: Themenstatus): 'green' | 'blue' | 'amber' {
  switch (status) {
    case 'abgeschlossen':
      return 'green';
    case 'beschlossen':
    case 'in-umsetzung':
      return 'blue';
    case 'geplant':
    case 'entwurf':
    case 'im-gesetzgebungsverfahren':
      return 'amber';
  }
}

/**
 * Spaltenzahl für ein Kartenraster, das keine allein stehende Karte in der letzten Reihe
 * erzeugt. Geprüft werden vier und drei Spalten; gewählt wird die erste, deren letzte Reihe voll
 * ist oder mindestens zwei Karten trägt. Durch drei teilbare Mengen bekommen drei Spalten, damit
 * sechs und neun Karten gleichmäßige Reihen ergeben.
 *
 * 7 → 4 (4 + 3), 8 → 4, 6 → 3 (3 + 3), 5 → 3 (3 + 2), 10 → 4 (4 + 4 + 2), 1 bis 4 → die Anzahl.
 */
export function getBalancedColumnCount(count: number, max = 4): number {
  if (count <= 0) return 1;
  if (count <= max) return count;
  if (count % 3 === 0) return 3;
  for (let columns = max; columns >= 2; columns -= 1) {
    const rest = count % columns;
    if (rest === 0 || rest >= 2) return columns;
  }
  // Manche Mengen (13, 17, 21) lassen bei zwei bis vier Spalten immer eine Karte übrig; dann
  // gewinnt die breiteste Reihe, weil die letzte Karte dort am wenigsten verloren wirkt.
  return max;
}

/**
 * Ist ein Wert eine Kennzahl? Kennzahlenkarten und Kennzahlenzeilen sind nach `DESIGN.md`
 * quantitativen Werten vorbehalten. Als Kennzahl gilt eine Zahl mit optionaler Einheit oder
 * Ergänzung („14“, „101 Kreise“, „25 Mrd. €“, „rund 3,2 Prozent“), nicht ein Satz und nicht eine
 * Bezeichnung („Dresden“, „Erster Staatsrat“). Zusammengesetzte Angaben mit zwei Zahlen
 * („9 Träger + 2 Sondervermögen“) sind keine einzelne Kennzahl.
 */
export function isMetricValue(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 32) return false;
  // Satzgrenze: ein Punkt, dem ein neues Wort folgt, macht aus der Angabe einen Satz.
  if (/[.!?]\s+[A-ZÄÖÜ]/u.test(text)) return false;
  // Ordnungszahl („7. Volkskammer“) ist eine Bezeichnung, keine Kennzahl.
  if (/^\d+\.\s/u.test(text)) return false;
  const numbers = text.match(/\d+(?:[.,]\d+)?/gu) ?? [];
  if (numbers.length !== 1) return false;
  return /^(?:rund |etwa |ca\. |circa |über |unter |bis zu |−|-|\+)?\d/u.test(text);
}
