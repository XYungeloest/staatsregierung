# Redaktionelle Quellenklärung: Ersatz fehlerhafter Ausgaben von Gesetz- und Verordnungsblatt und Staatsanzeiger

**Stand:** 13. September 2026

## Anlass

Für sieben bereits versionierte Ausgaben wurden neue Fassungen bereitgestellt. Die bisher im
Repository geführten Dateien enthielten an einzelnen Stellen einen Wortlaut, der die in
`CONTENT_GAPS.md` und im Konsolidierungsaudit geführten Quellenkonflikte ausgelöst hatte. Die neuen
Fassungen ersetzen die bisherigen Dateien vollständig; es gibt keine zweite Originalfassung dieser
Ausgaben.

## Verbindliche Quellenauflösung

Jede neue Datei wurde anhand von Ausgabenummer, Ausgabedatum, Seitenzahl, enthaltenen Rechtsakten,
Titeln, Unterschriften und dem Wortlaut der Änderungsbefehle der bisherigen Ausgabe zugeordnet. HTML
und PDF jeder Ausgabe wurden gegeneinander geprüft. Maßgeblich sind:

| Ausgabe | Dateien | Abweichung gegenüber der ersetzten Fassung |
| --- | --- | --- |
| OGVBl. 2026 Nr. 32 | `Gesetze/OGVBl. 2026 Nr. 32.html`, `.pdf` | Artikel 3 Nummer 2: „Tarifstelle 3 wird wie folgt gefasst“ statt „Nach Tarifstelle 2 wird folgende Tarifstelle 3 angefügt“ |
| OGVBl. 2026 Nr. 46 | `Gesetze/OGVBl. 2026 Nr. 46.html`, `.pdf` | Artikel 9 Nummer 1: „§ 3 Absatz 1 Satz 3 wird wie folgt gefasst“ statt der Ergänzungen in Satz 1 und 2 |
| OGVBl. 2026 Nr. 64 | `Gesetze/OGVBl. 2026 Nr. 64.html`, `.pdf` | Artikel 1 Nummer 6 Buchstabe b: „Lehrplänen für die Oberschule“ statt „Klassenstufen 5 und 6 der Oberschule“ |
| OGVBl. 2026 Nr. 72 | `Gesetze/OGVBl. 2026 Nr. 72.html`, `.pdf` | Artikel 1: nach § 71g ein Sechster Abschnitt mit § 71h statt eines § 71b nach § 71a |
| OGVBl. 2026 Nr. 77 | `Gesetze/OGVBl. 2026 Nr. 77.html`, `.pdf` | Artikel 5 zählt 1. bis 4. statt 1., 3., 4., 5. |
| StAnzO. 2026 Nr. 39 | `Gesetze/StAnzO.2026Nr.39.html`, `Gesetze/StAnzO. 2026 Nr. 39.pdf` | Eingangsformel: „§ 23 Abs. 3 und 4 und § 14 Abs. 2.“ statt „§ 24 Absatz 3“ |
| StAnzO. 2026 Nr. 45 | `Gesetze/StAnzO. 2026 Nr. 45.html`, `.pdf` | Nummer 9: „Das für die Landespolizei zuständige Staatssekretariat“ statt „Das Staatssekretariat für Landespolizei“ |

Die Markdown-Alttranskriptionen `OGVBl. 2026 Nr. 32.md` und `OGVBl. 2026 Nr. 46.md` gaben den
ersetzten Wortlaut wieder und sind entfernt. Verkündungsdatensätze, Quellenangaben der Normen,
Prüfsummen, Prüfdaten und die ausgelieferten PDF-Dateien verweisen ausschließlich auf die neuen
Dateien.

## Folgen für Konsolidierung und Wissenshub

- **Ostdeutsches Personennahverkehrsgesetz:** Der Konflikt ist gelöst. Die Fassung vom
  21. Juli 2026 enthält den neu gefassten § 3 Absatz 1 Satz 3, § 5a und die am selben Tag
  wirksamen §§ 4b bis 4g aus OGVBl. 2026 Nr. 47.
- **Ostdeutsche Gemeindeordnung:** Der Konflikt ist gelöst. Die Fassung vom 1. Oktober 2026 enthält
  den Sechsten Abschnitt mit § 71h.
- **Zehntes Ostdeutsches Kostenverzeichnis:** Der Konflikt ist gelöst. Die Fassung vom 1. Juli 2026
  enthält die neu gefasste Tarifstelle 3 der laufenden Nummer 55.
- **Schulordnung Förderschulen:** Der Konflikt zu Artikel 1 Nummer 6 Buchstabe b ist gelöst. Die
  Konsolidierung bleibt dennoch gesperrt, weil Artikel 1 Nummer 18 Buchstabe b und Nummer 30 nicht
  auf die Ausgangsfassung passen (siehe unten); das Rezept für die übrigen Befehle liegt geprüft vor.
- **OGVBl. 2026 Nr. 77:** Die Nummerierungsausnahme im Parser und der Quellenhinweis zur Zählung
  sind entfallen; das Rezept zum Krankenhaussicherungs- und Rekommunalisierungsfondsgesetz nennt
  die Nummern 1 bis 4.
- **StAnzO. 2026 Nr. 45:** Der Befund zur Ressortbezeichnung ist erledigt.

## Weiterhin offene Quellenfragen

1. **OGVBl. 2026 Nr. 72, Artikel 2 und 3:** § 60a der Landkreisordnung und § 24a der
   Bezirksordnung verweisen „nach § 71b Absatz 2 und 3“, obwohl Artikel 1 die Hinweisgeberstellen
   als § 71h einfügt. Die Verweise bleiben unverändert.
2. **StAnzO. 2026 Nr. 39:** Die Bekanntmachung nennt im Text weiterhin „§ 24 Absatz 4“ und
   „§ 10 Absatz 2“ des Interflug-Gesetzes. Der Wortlaut bleibt unverändert.
3. **OGVBl. 2026 Nr. 64, Artikel 1 Nummer 18 Buchstabe b und Nummer 30:** Die Befehle ersetzen in
   § 30 Absatz 4 die Wörter „Oberschule oder Gemeinschaftsschule“, die dort nicht stehen, und zielen
   auf § 18 Absatz 3 Satz 3, obwohl § 18 Absatz 3 nur einen Satz hat. Die Schulordnung Förderschulen
   wird ohne Berichtigung nicht konsolidiert.
4. **Hoheitszeichenverordnung:** Die Quellenfrage zu Artikel 2 Absatz 2 des Besonderen Gesetzes
   zur Neuregelung des Hoheitszeichenrechts (OGVBl. 2026 Nr. 70) ist von diesem Ersatz nicht
   betroffen; die Konsolidierung bleibt gesperrt.

Diese Klärung ändert keinen verkündeten Wortlaut. Sie dokumentiert ausschließlich, welche der
vorliegenden Quellenfassungen redaktionell maßgeblich ist.
