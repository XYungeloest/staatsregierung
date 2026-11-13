# Testlauf OGVBl. 2026 Nr. 85–99 – Prüfbericht

Dieser Ordner dokumentiert einen probeweisen Einpflegelauf der vorbereiteten Gesetzblätter
OGVBl. 2026 Nr. 85 bis 99 (Polizei- und Sicherheitspaket). Unterstellt wurden die Annahme durch
die Volkskammer und die Verkündung am 13. November 2026. Alle Testnormen und
Test-Verkündungen sind als vorbereitete Fassungen gekennzeichnet.

**Dieser Branch ist nicht zum Mergen bestimmt.** Er enthält nur Bericht, Werkzeuge und Protokolle.
Am kanonischen Bestand (`content/`, `Gesetze/`, `data/`, `knowledge/`) wurde nichts geändert.
Es gab keinen Import, keinen D1-Sync und kein Deployment.

## Inhalt

| Pfad | Inhalt |
| --- | --- |
| `PRUEFBERICHT-OGVBl-2026-85-99.md` | Prüfbericht. Abschnitte 0–7 behandeln die erste Fassung der Sammeldatei. Abschnitt 8 prüft die neue Fassung nach und enthält Ersatzformulierungen zum Einfügen. |
| `werkzeuge/v1/`, `werkzeuge/v2/` | Hilfsskripte der beiden Testläufe: Aufteilung der Sammeldatei, Testkonfiguration des Importers, Patch-Rezeptgenerator, Reihenfolge- und Ausführbarkeitsproben, Zähl- und Lesehelfer |
| `protokolle/v1/`, `protokolle/v2/` | Ausgaben der Import-, Audit-, Konsolidierungs-, Build-, Seed- und Worker-Läufe in den isolierten Testklonen; dazu in v1 die Rückverweissuche (`rueckverweise-scan-2027.json`) |
| `kontrolle/` | Fingerabdruck des Originalcheckouts vor dem ersten Lauf und nach dem zweiten Lauf (HEAD, Status, Refs, Arbeitsbäume, Index, Sammeldatei) |

## Quellen

| Lauf | Sammeldatei `temp-neu/OGVBl.2026Nr.85100.html` | SHA-256 |
| --- | --- | --- |
| erste Fassung (Abschnitte 0–7) | 343 154 Byte | `97480bf5640ce77f6ed6baa31d21b17b5f8d07706b124dd53255854760e08e1a` |
| neue Fassung (Abschnitt 8) | 355 927 Byte | `5e77b3b27fe4daecc78ac1ebbe3e211081bbabed60054d163b5e12362810c60c` |

`temp-neu/` ist in `.gitignore` ausgeschlossen. Die Sammeldateien sind deshalb nicht Teil dieses
Branches. Dasselbe gilt für die daraus erzeugten Testnormen, Test-Verkündungen, Patch-Rezepte,
konsolidierten Testfassungen, lokalen D1-Seeds und Builds. Sie liegen nur in den lokalen Testklonen
`staatsregierung-testlauf-ogvbl-85-99` (erste Fassung) und `staatsregierung-testlauf-ogvbl-85-99-v2`
(neue Fassung) neben dem Originalcheckout.

## Hinweise

- In Bericht, Skripten und Protokollen sind lokale absolute Pfade gekürzt: Verzeichnisse neben dem
  Checkout stehen nur mit ihrem Ordnernamen, temporäre Arbeitsverzeichnisse als `<Arbeitsverzeichnis>`.
  Skripte mit fest eingetragenen Pfaden laufen deshalb erst nach Anpassung.
- Der Bericht enthält keine verfassungsrechtliche Abwägung. Wo Inhalt oder Fassungswahl offen ist,
  stehen ausformulierte Varianten mit der jeweils zu treffenden Entscheidung.
