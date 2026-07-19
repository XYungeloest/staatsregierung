# Offene Quellenfragen

**Redaktioneller Stand:** 19. Juli 2026
**Zuletzt geprüft:** 19. Juli 2026

Diese Datei trennt belegte Tatsachen von redaktionellen Schlussfolgerungen. Fehlende Angaben werden im Portal nicht ergänzt oder fortgeschrieben, bis eine hinreichende Primärquelle vorliegt.

## 1. Redaktionell offene Primärquellen

Belegt:

- Die Beschlussempfehlungen 07/18 bis 07/21 sind im bereitgestellten Quellenbestand nicht als Original-PDF vorhanden.
- Die amtliche Tagesordnung der dritten Plenarsitzung am 20. Juli 2026 liegt nicht als dauerhaft versionierte lokale Primärdatei vor.
- `OGVBl II-24.pdf` und `OGVBl I-25.pdf` sind bildbasierte Ausgaben. Für elf darin enthaltene ältere Dokumente liegt kein verlässlich maschinenlesbarer Volltext vor.
- Die Datei `Verfassung des Ostdeutschen Freistaates.pdf` enthält einen Verfassungstext, aber keine eindeutig belegte amtliche Fundstelle und kein zweifelsfrei belegtes Verkündungsdatum.
- Für mehrere ältere Stammnormen, darunter das Landesplanungsgesetz, die Landkreisordnung und das Verwaltungsorganisationsgesetz, fehlen im bereitgestellten Bestand vollständige Primärnachweise zu Normdatum, Veröffentlichung und Inkrafttreten.
- Für das polnische und das tschechische Grenzraumabkommen ist der für das Inkrafttreten erforderliche Austausch der Notifikationen nicht nachgewiesen. Für den NDR-Änderungs- und Überleitungsstaatsvertrag ist der Austausch der Ratifikationsurkunden nicht nachgewiesen.

Schlussfolgerung:

- Geänderte Gesetzeswortlaute, Ausschusszuständigkeiten und Beschlussergebnisse werden aus den fehlenden Beschlussempfehlungen nicht rekonstruiert.
- Die Alt-Ausgaben werden erst nach einer redaktionell geprüften Transkription als vollständige Normfassungen ergänzt.
- Die Verfassung und die weiteren Stammnormen erhalten keine erfundene Fundstelle oder Datumsangabe.
- Die drei bedingt wirksamen Staatsverträge werden als veröffentlicht, aber nicht als geltender Rechtsstand ausgewiesen.
- Bei Änderungsgesetzen ohne vollständig belegte Stammfassung wird keine frei rekonstruierte konsolidierte Fassung erstellt.

## 2. Noch nicht eingetretene beziehungsweise nicht belegte parlamentarische Ergebnisse

Belegt:

- Die Tagesordnung setzt am 20. Juli 2026 zwölf Beratungen an: fünf zweite und sieben erste Lesungen.
- Für fünf Vorgänge ist eine Annahmeempfehlung angegeben. Eine Empfehlung ist weder ein Gesetzesbeschluss noch eine Verkündung.
- Für das Kreis- und Bezirksneuordnungsgesetz ist nur die vorgeschlagene Überweisung an den Ausschuss für Inneres und Kommunen belegt.
- Zum redaktionellen Stichtag liegt naturgemäß noch kein Ergebnisprotokoll der Sitzung vom 20. Juli 2026 vor.

Schlussfolgerung:

- Alle zwölf Vorgänge bleiben im Status „angesetzt“.
- Kein Vorgang wird allein durch Zeitablauf, Tagesordnung oder Annahmeempfehlung als beschlossen, verkündet oder in Kraft geführt.
- Nachzureichen sind Plenarprotokoll, Abstimmungsergebnisse, gegebenenfalls beschlossene Fassungen, Ausfertigungen und die späteren Verkündungsblätter.

## 3. Technische Quellenverfügbarkeit im Repository

Belegt:

- Die zur Redaktion verwendeten Original-PDFs im lokalen Arbeitsordner `Gesetze/` sind nicht Bestandteil des versionierten Repositorys. Der Ordner ist ausdrücklich als lokaler Import- und Arbeitsordner ignoriert.
- Die 81 Ausgabedatensätze behaupten deshalb keine lokalen `sourceFiles` mehr. Sie kennzeichnen das amtliche Original als „nicht mitversioniert“ und verweisen zusätzlich auf die festgeschriebene Liste der Verkündungsblätter als externen Index.
- Versionierte lokale Quellenpfade sind nur in den Gesetzgebungsvorgängen vorhanden und zeigen auf Dateien unter `context/entwürfe/`.
- Der Content-Checker prüft lokale Quellenpfade gegen den Git-Dateibestand und gegen den aktuellen Checkout. Ein fehlender oder nicht versionierter lokaler Pfad ist ein Fehler.
- Das Importwerkzeug akzeptiert ein Quellenverzeichnis nur noch ausdrücklich über `--source-dir`; ohne `--replace-output` führt es ausschließlich einen Prüflauf aus.

Schlussfolgerung:

- Ein sauberer Checkout benötigt keinen privaten Ordner `Gesetze/` für `npm run content:check`.
- Die amtlichen Original-PDFs sind redaktionell weiterhin aufzubewahren. Eine spätere Aufnahme in das Repository erfordert eine gesonderte Speicher-, Lizenz- und Veröffentlichungsentscheidung.

## 4. Bekannte Widersprüche in den Quellen

Belegt:

- StAnzO. 2026 Nr. 13 enthält 19. Mai 2026 im Kopf beziehungsweise Inhaltsverzeichnis, 27. Mai 2026 in der Überschrift und 19. Mai 2026 in der Unterschriftszeile. Das Ausgabedatum ist der 27. Mai 2026.
- Beim Helsinki-Übereinkommen nennt das Verkündungsblattregister den 14. Juli 1994, der Kopf des lokalen Originals den 14. Juli 1992 und der Vertragstext den 9. April 1992 als Abschlussdatum.
- Die lokale Entwurfsdatei zu Drucksache 07/27 nennt den 15. Juli 2025, obwohl der Vorgang dem 7. Landtag im Juli 2026 zugeordnet ist.

Schlussfolgerung:

- Bei StAnzO. 2026 Nr. 13 wird das Ausgabedatum als Veröffentlichungsdatum verwendet; ein eindeutiges Dokumentdatum wird nicht ausgewiesen.
- Beim Helsinki-Übereinkommen wird der 9. April 1992 als Dokumentdatum geführt. Die abweichenden Index- und Kopfangaben bleiben als Hinweis sichtbar.
- Für Drucksache 07/27 wird kein Einbringungsdatum ausgewiesen.

## 5. Nächster Aktualisierungsschritt

1. Amtliche Tagesordnung und Beschlussempfehlungen 07/18 bis 07/21 als Primärdateien nachreichen und gegen die erfassten Vorgänge prüfen.
2. Nach der Sitzung vom 20. Juli 2026 Plenarprotokoll und Abstimmungsergebnisse einarbeiten; Statusänderungen nur aus diesen Quellen ableiten.
3. Gegebenenfalls beschlossene Fassungen mit späteren Ausfertigungen und Verkündungsblättern abgleichen.
4. Austauschdaten der Notifikationen beziehungsweise Ratifikationsurkunden für die drei Staatsverträge belegen.
5. Bildbasierte Alt-Ausgaben transkribieren und fehlende Fundstellen älterer Stammnormen recherchieren.
