# Offene Quellenfragen

**Redaktioneller Stand:** 21. Juli 2026
**Zuletzt geprüft:** 22. Juli 2026

Diese Datei trennt belegte Tatsachen von redaktionellen Schlussfolgerungen. Fehlende Angaben werden
nicht ergänzt oder fortgeschrieben, bis eine hinreichende Primärquelle vorliegt.

## 1. Redaktionell offene Primärquellen

Belegt:

- Die Beschlussempfehlungen 07/18 bis 07/21 sind im bereitgestellten Quellenbestand nicht als
  Original-PDF vorhanden.
- Ein Plenarprotokoll und die einzelnen Abstimmungsergebnisse der dritten Plenarsitzung vom
  20. Juli 2026 liegen nicht vor.
- Die Ausgaben OGVBl. 2026 Nr. 46 bis 58 liegen als redaktionell geprüfte HTML-Transkriptionen
  unter `Gesetze/` vor. Die zugehörigen Original-PDFs sind nicht Bestandteil des Repositorys.
- `OGVBl II-24.pdf` und `OGVBl I-25.pdf` sind bildbasierte Alt-Ausgaben. Für elf darin enthaltene
  ältere Dokumente liegt weiterhin kein redaktionell geprüfter maschinenlesbarer Volltext vor.
- Für mehrere ältere Stammnormen, darunter Landesplanungsgesetz, Landkreisordnung und
  Verwaltungsorganisationsgesetz, fehlen vollständige Primärnachweise zu Normdatum,
  Veröffentlichung oder Inkrafttreten.
- Die Veröffentlichungsliste weist die Ursprungsfassung der Staatsverfassung ab Seite 5 der
  Ausgabe OGVBl. 2024 Nr. II nach. Eine versionierte HTML-Quelle dieser historischen Ausgabe mit
  ihrem vollständigen Wortlaut liegt nicht vor. `Staatsverfassung.html` ist eine konsolidierte
  Lesefassung. Deshalb kann derzeit keine belastbare historische Volltextfassung von 2024
  gespeichert werden.
- Für das polnische und das tschechische Grenzraumabkommen ist der für das Inkrafttreten
  erforderliche Austausch der Notifikationen nicht nachgewiesen. Für den NDR-Änderungs- und
  Überleitungsstaatsvertrag ist der Austausch der Ratifikationsurkunden nicht nachgewiesen.

Schlussfolgerung:

- Die Ausgaben 46 bis 58 und ihre Normtexte werden aus den versionierten HTML-Transkriptionen
  gepflegt. Eine PDF-Extraktion wird nicht als Ersatzquelle verwendet.
- Die Verkündungsblätter 46 bis 57 belegen Beschluss und Verkündung der zwölf zuvor angesetzten
  Vorhaben. Nicht belegte Abstimmungsverläufe oder Stimmenzahlen werden nicht ergänzt.
- Die Alt-Ausgaben werden erst nach einer redaktionell geprüften Transkription als vollständige
  Normfassungen ergänzt.
- Bei Änderungsgesetzen ohne vollständig belegte Ausgangsfassung wird keine frei rekonstruierte
  konsolidierte Fassung erstellt.
- Die drei bedingt wirksamen Staatsverträge bleiben veröffentlicht, aber ohne belegtes
  Inkrafttreten.

## 2. Nicht belegte parlamentarische Einzelergebnisse

Belegt:

- Die Tagesordnung setzte für den 20. Juli 2026 zwölf Beratungen an.
- Die Ausgaben OGVBl. 2026 Nr. 46 bis 57 dokumentieren die anschließende Verkündung dieser zwölf
  Vorhaben.
- Die amtlichen Verkündungen erlauben die Statusangaben „beschlossen“ und „verkündet“ sowie die aus
  den Schlussvorschriften abgeleiteten Wirksamkeitsangaben.
- Ein Plenarprotokoll mit Redebeiträgen, Änderungsanträgen, Einzelabstimmungen und Stimmenzahlen
  liegt nicht vor.

Schlussfolgerung:

- Die zwölf Vorgänge werden nicht mehr als lediglich angesetzt dargestellt.
- Abstimmungsergebnisse, Beratungsverläufe oder nicht aus der Verkündung erkennbare Ausschussdetails
  werden weiterhin nicht behauptet.
- Die Drucksachen und Beschlussempfehlungen bleiben historische Verfahrensquellen; für den aktuellen
  Rechtsstand sind die Verkündungsblätter maßgeblich.

## 3. Technische Quellenverfügbarkeit im Repository

Belegt:

- Unter `Gesetze/` liegen 79 HTML-Dateien und 98 ältere Markdown-Dateien. Die HTML-Ausgaben 46 bis
  58 und `Staatsverfassung.html` dienen als lokale strukturtragende Importquellen. Die Markdown-
  Dateien sind Altbestand, werden nicht automatisch gelöscht und beeinflussen den Import nicht.
- Ein `sourceFiles`-Eintrag ist nur zulässig, wenn die angegebene Datei im Git-Bestand und im
  Checkout vorhanden ist. Der Content-Checker prüft beides.
- Die neuen Ausgabedatensätze verweisen über `sourceReferences` auf die versionierte
  HTML-Transkription. Nicht mitversionierte Original-PDFs werden nicht als lokale Datei
  behauptet.
- Der Normimport läuft standardmäßig nur als Audit. Schreiben erfordert `--write` und eine gezielte
  `--file`-Angabe; vorhandene Normen werden erst mit `--update-existing` verändert.
- Der vollständige Audit meldet mehrere ältere OABl.-, StAnzO.- und einzelne OGVBl.-Dateien als
  mehrdeutig. Diese Dateien werden nicht automatisch importiert.

Schlussfolgerung:

- `npm run content:check` benötigt keine privaten lokalen PDF-Quellen.
- Mehrdeutige Altquellen bleiben unverändert, bis ihr Aufbau redaktionell geprüft und ein
  passender Parserfall ergänzt wurde.
- Der Import löscht den vorhandenen Normbestand nicht und erzeugt keine instabilen Suffix-Slugs.

## 4. Bekannte Widersprüche in den Quellen

Belegt:

- Die HTML-Ausgabe OGVBl. 2026 Nr. 53 enthält in der dort verkündeten Änderung zu Artikel 121a
  „Achte Volkskammer … Wahl zur neunten Volkskammer“.
- Die konsolidierte Quelle `Staatsverfassung.html` enthält in Artikel 121a dagegen „Siebte
  Volkskammer ist der siebte Landtag. Die Wahl zur achten Volkskammer findet Ende August statt.“
- Beide HTML-Quellen werden quellentreu und ohne automatische sprachliche oder inhaltliche
  Korrektur importiert. Der Widerspruch ist redaktionell noch anhand eines höherrangigen
  Primärnachweises zu klären.
- StAnzO. 2026 Nr. 13 enthält 19. Mai 2026 im Kopf beziehungsweise Inhaltsverzeichnis, 27. Mai 2026
  in der Überschrift und 19. Mai 2026 in der Unterschriftszeile. Das Ausgabedatum ist der
  27. Mai 2026.
- Beim Helsinki-Übereinkommen nennt das Verkündungsblattregister den 14. Juli 1994, der Kopf des
  lokalen Originals den 14. Juli 1992 und der Vertragstext den 9. April 1992 als Abschlussdatum.
- Die lokale Entwurfsdatei zu Drucksache 07/27 nennt den 15. Juli 2025, obwohl der Vorgang der
  siebten Wahlperiode im Juli 2026 zugeordnet ist.

Schlussfolgerung:

- Das Erste Staatsreformgesetz und die konsolidierte Lesefassung bleiben bis zur Quellenklärung in
  ihren jeweiligen HTML-Wortlauten gespeichert; der Importer harmonisiert den Widerspruch nicht.
- `initialVersionId` der Verfassung bleibt leer, solange keine belastbare historische
  Volltextfassung vorliegt; die konsolidierte Fassung vom 21. Juli 2026 wird nicht als
  Ursprungsfassung ausgegeben.
- Bei StAnzO. 2026 Nr. 13 wird das Ausgabedatum als Veröffentlichungsdatum verwendet; ein
  eindeutiges Dokumentdatum wird nicht erfunden.
- Beim Helsinki-Übereinkommen wird der 9. April 1992 als Dokumentdatum geführt. Die abweichenden
  Index- und Kopfangaben bleiben als Hinweis sichtbar.
- Für Drucksache 07/27 wird kein unbelegtes Einbringungsdatum ergänzt.

## 5. Nächster Aktualisierungsschritt

1. Original-PDFs der Ausgaben 46 bis 58 mit den versionierten HTML-Transkriptionen abgleichen.
2. Plenarprotokoll und Einzelabstimmungsergebnisse vom 20. Juli 2026 nachreichen und ausschließlich
   für die noch offenen Beratungsdetails auswerten.
3. Mehrdeutige Alt-Ausgaben redaktionell transkribieren und mit gezielten Parser-Fixtures absichern.
4. Austauschdaten der Notifikationen beziehungsweise Ratifikationsurkunden für die drei
   Staatsverträge belegen.
