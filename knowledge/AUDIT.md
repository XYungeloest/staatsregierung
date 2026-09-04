# Wissensaudit zur Politiksimulation und zum Freistaat Ostdeutschland

**Redaktioneller Stichtag:** zentral in `../packages/shared/src/config/editorial.json`

## Zweck

Dieses Audit beschreibt ausschließlich den gegenwärtigen Abdeckungsstand des internen
Wissenshubs, seine dauerhaften Grenzen und die noch offenen Arbeitsfelder. Abgeschlossene
Einzelprüfungen, frühere Konflikte und bereits eingepflegte Befunde werden hier nicht als
Fortschrittschronik mitgeführt.

Maßgeblich ist der geprüfte Repositorystand. Ein abweichender öffentlicher Produktionsstand ist
keine eigenständige Quelle. Die Quellenhierarchie und das Verfahren bei echten Konflikten stehen in
`SOURCE_POLICY.md`.

## Aktuell offene Abdeckung

| Bereich | Gegenwärtiger Stand | Noch offen |
| --- | --- | --- |
| Staat und Verfassungsordnung | aktuelle Verfassungsfassungen, Staatsaufbau und Staatsreform sind strukturiert | einzelne historische Verfassungsereignisse und Organübergänge weiter verdichten |
| Regierung und Verwaltung | aktueller Staatsrat und jüngere Regierungsstände sind strukturiert | Regierungs- und Rollenchronologie vor Dezember 2025 vervollständigen |
| Personen und Parteien | aktuelle Rollen und zahlreiche historische Profile sind vorhanden | einzelne Parteiwechsel, Parteifunktionen, DEMOS-Namenschronologie und frühere Amtsintervalle belegen |
| Gesetzgebung und Rechtsordnung | 89 Zielnormen sind erkannt, 84 vollständig konsolidiert; 4 Zieltextkonflikte sind gesperrt und 1 bekannte Ausgangsfassung ist noch nicht technisch archiviert | die Konflikte beim Gesetz über den öffentlichen Personennahverkehr, bei der Ostdeutschen Gemeindeordnung, bei der Schulordnung Förderschulen und beim Zehnten Sächsischen Kostenverzeichnis quellenbasiert klären sowie die bekannte NDR-Ausgangsfassung unverändert versionieren |
| Parlamentarische Geschichte | siebte Wahlperiode ist über Verfahren, Tagesordnungen und Verkündungen erschlossen | frühere Wahlperioden sowie nicht vorliegende Plenar- und Abstimmungsnachweise nur bei neuer Quelle ergänzen |
| Gerichts- und Verfassungsverfahren | einzelne Vorgänge sind als Kandidaten oder Verfahren erfasst | Aktenzeichen, Entscheidungen und Verfahrensausgänge nur aus belastbaren Quellen übernehmen |
| Politische Vorhaben und Vollzug | zentrale Reform- und Projektkomplexe sind verknüpft | operative Vollzugsstände unter anderem bei Boom Europe, OVV/DB und mehreren Beschaffungen belegen |
| Beteiligungen und öffentliche Träger | Rechtsnachfolge und öffentlich belegte Beteiligungspositionen sind strukturiert | nicht öffentlich ausgewiesene tiefere Beteiligungsstufen sowie formale Anpassungen einzelner Mehrländer-Staatsverträge und Satzungen bleiben offen |
| Gebiet und Kommunalstruktur | geltende Bezirks- und Kreisstruktur sowie historische Vergleichsstände sind strukturiert | keine allgemeine Strukturierungsaufgabe; neue Quellen nur bei konkretem Anlass einarbeiten |
| Website und Rechtsportal | Datenmodelle, Portaltrennung, Redaktions- und Normworkflow sind dokumentiert | laufende technische Pflege und die im zentralen Backlog genannten Erweiterungen |

## Aktuelle Quellen- und Rechtsfragen

Die menschenlesbare Liste der tatsächlich noch relevanten Quellenfragen steht in
`../CONTENT_GAPS.md`. Der maschinenlesbare Einzelstatus der Normkonsolidierung steht in
`../data/recht/consolidation-manifest.json`. Konkrete offene Wissensfragen stehen in
`open-questions.json`.

Besonders relevant sind derzeit:

- die technische Archivierung der bekannten vollständigen Ausgangsfassung des NDR-Staatsvertrags vor der Änderung vom 8. März 2026,
- die Zieltextkonflikte beim Gesetz über den öffentlichen Personennahverkehr, bei der Ostdeutschen Gemeindeordnung, bei der Schulordnung Förderschulen und beim Zehnten Sächsischen Kostenverzeichnis,
- die abweichende Wahlterminangabe in Artikel 121a der Staatsverfassung,
- fehlende Vollzugsbelege für mehrere politische und wirtschaftliche Vorhaben,
- noch unvollständige politische Rollen- und Ereignischronologien vor Ende 2025,
- nicht öffentlich ausgewiesene Beteiligungstiefen und formale Anpassungen gemeinsamer Träger.

## Dauerhafte Quellen- und Modellgrenzen

`content/` bleibt der kanonische öffentliche Inhaltsbestand. `Gesetze/` enthält die
strukturtragenden Rechtsquellen und visuellen Kontrollquellen. `knowledge/` ergänzt Beziehungen,
Gültigkeitszeiträume, Provenienz, Verfahren und offene Fragen, ohne eine zweite Normdatenbank zu
bilden.

Historische Dateien unter `context/`, alte Wiki-Texte und ungeprüftes Gesprächswissen sind keine
automatische Quelle für den Gegenwartsstand. Eindeutige EAG-Ausspielungen werden nur nach den
Regeln in `SOURCE_POLICY.md` übernommen. Als externe Wikiquelle ist ausschließlich das
PolitikSim-Wiki auf Miraheze zugelassen.

Nicht belegte Werte werden nicht geschätzt. Ein Sitzungstermin belegt keine Abstimmung. Eine
politische Ankündigung belegt keinen Vollzug. Vertragsschritte wie Unterzeichnung, Ratifikation,
Notifikation und Inkrafttreten werden getrennt behandelt. Bei Rechtsnormen werden
Quellenkonflikte nicht heuristisch aufgelöst.

## Pflegegrundsatz

Das Audit wird nur geändert, wenn sich der aktuelle Abdeckungsstand, eine dauerhafte Grenze oder
ein noch offenes Arbeitsfeld ändert. Eine erfolgreiche Einzelprüfung wird nicht allein deshalb
hier dokumentiert. Ihre fachlichen Ergebnisse gehören in die kanonischen Daten, Quellen und
gegebenenfalls in eine dauerhaft erforderliche Quellenentscheidung.
