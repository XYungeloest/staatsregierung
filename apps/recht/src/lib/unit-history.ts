/**
 * Änderungsvermerk je Einheit über alle gespeicherten Fassungen (REVOSax-Fußnoten, gii
 * „Textnachweis“): aus den betroffenen Einheiten je Fassung (`/norm/<slug>/betroffen.json`) die
 * Einträge einer Einheit – „neu“ in der Fassung, in der sie erstmals steht (wenn nicht in der
 * ältesten), „geändert“ in jeder Fassung mit anderem Wortlaut. Rein rechnend; Seite und Skript
 * verwenden dieselbe Funktion.
 */
export interface AffectedVersionEntry {
  versionId: string;
  validFrom: string;
  previousVersionId: string;
  /** Bezeichnungen der Änderungsvorschriften, die diese Fassung bewirkt haben (Kurztitel, sonst Vollzitat-Anfang). */
  amendments: string[];
  changed: Array<{ anchor: string; label: string }>;
  added: Array<{ anchor: string; label: string }>;
  removed: Array<{ label: string }>;
}

export interface UnitHistoryEntry {
  kind: 'added' | 'changed';
  versionId: string;
  previousVersionId: string;
  validFrom: string;
  amendments: string[];
}

export function buildUnitHistory(versions: AffectedVersionEntry[], anchor: string): UnitHistoryEntry[] {
  return [...versions]
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom))
    .flatMap((version) => {
      const kind = version.added.some((unit) => unit.anchor === anchor) ? 'added' : version.changed.some((unit) => unit.anchor === anchor) ? 'changed' : undefined;
      return kind ? [{ kind, versionId: version.versionId, previousVersionId: version.previousVersionId, validFrom: version.validFrom, amendments: version.amendments }] : [];
    });
}
