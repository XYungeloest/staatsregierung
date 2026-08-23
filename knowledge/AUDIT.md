# Wissensaudit zur Politiksimulation und zum Freistaat Ostdeutschland

**Ausgangsstand des Erstaudits:** `9aa406f7baebdd264d3ed824be65b43413a9dd9a`

**Redaktioneller Stichtag des Gegenwartsstands:** 9. August 2026
**Auditstand:** 28. Juli 2026, fortgeschrieben am 12. August 2026

## Methode und Grenzen

Geprüft wurden insbesondere `README.md`, `AGENTS.md`, `CONTENT.md`, `CONTENT_GAPS.md`, die zentralen Konfigurationen, strukturierte Freistaats-, Regierungs-, Themen-, Gesetzgebungs-, Norm- und Verkündungsdaten, Dashboarddaten, das Konsolidierungsmanifest, der Konsolidierungsbericht, Kreisreformdaten sowie ausgewählte historische Dateien unter `context/`.

Der öffentliche Produktionsstand wurde nicht als automatisch kanonisch behandelt. Maßgeblich ist
der jeweils geprüfte Repositorystand zum oben genannten redaktionellen Stichtag. Der festgehaltene
Ausgangscommit dokumentiert den Erstaudit, nicht den heutigen Repository-HEAD. Das PolitikSim-Wiki
auf Miraheze wurde als zulässige ergänzende Sekundärquelle registriert. Der automatisierte Abruf
war am Auditdatum teilweise durch HTTP 403 blockiert, deshalb wurden daraus keine alleinstehenden
Tatsachen übernommen. Andere Wikihoster wurden nicht verwendet.

## Quellen- und Abdeckungsmatrix

| Bereich | Vorhandene Quellen | Bereits strukturiert | Nur Fließtext oder Altquelle | Gesprächswissen vorhanden | Konflikte | Fehlende Informationen | Empfehlung |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| A. Staat und Verfassungsordnung | Verfassungsfassungen, Normhistorie, Staatsaufbau, Große Staatsreform | hoch | mittel | hoch | mittel | mittel | Verfassungsereignisse, Organaliase und Übergänge dauerhaft über IDs verknüpfen |
| B. Regierung und Verwaltung | Zentrale Konfiguration, aktuelle und historische Profile, Ressorts, Organisationserlasse | hoch für 2025/2026 | mittel | hoch | mittel | hoch vor Dezember 2025 | Rollenchronologie statt aktueller Dateipfade als Wahrheit verwenden |
| C. Personen | Aktuelle Profile, Kabinettsarchiv, alte Wiki-Snapshots | mittel | hoch | hoch | mittel | hoch bei Bundes- und Parteifunktionen | Nur belegte Amtsintervalle übernehmen, übrige Namen als Kandidaten führen |
| D. Parteien, Fraktionen und Mehrheiten | Koalitionskonfiguration, Profile, Kabinettsdaten | mittel | mittel | hoch | hoch | mittel | DEMOS-Namenschronologie und Fraktionswechsel mit Primärakten klären |
| E. Gesetzgebung und Rechtsordnung | Normen, Verkündungen, Gesetzgebungsverfahren, Konsolidierungsmanifest | sehr hoch | mittel | hoch | hoch | 34 Ausgangssnapshots | Rechtsdetail weiterhin im Rechtsportal belassen, Hub als Beziehungs- und Verfahrensindex nutzen |
| F. Politische Vorhaben und Staatsprojekte | Themen, Aktionsplan, Normkomplexe, Presse und Verfahren | mittel bis hoch | hoch | sehr hoch | mittel | mittel | Projektverbünde mit Status, Normen, Institutionen, Finanzierung und Meilensteinen modellieren |
| G. Parlamentarische Geschichte | Gesetzgebungsverfahren, Tagesordnungen, Verkündungen | mittel | hoch | hoch | gering | hoch | Plenarprotokolle, Abstimmungen und frühere Wahlperioden beschaffen |
| H. Gerichtsverfahren und Verfassungskonflikte | einzelne Normen und Gesprächshinweise | gering | mittel | sehr hoch | unbekannt | sehr hoch | Keine Verfahren ohne Aktenzeichen und Primärdokument in den bestätigten Bestand übernehmen |
| I. Bund, Länder und internationale Beziehungen | Staatsverträge, Themen, CONTENT_GAPS | mittel | hoch | sehr hoch | mittel | hoch | Ratifikation, Notifikation, Bundesrollen und Bund-Länder-Vereinbarungen getrennt erfassen |
| J. Gebiet, Bezirke und Kommunalstruktur | Bezirksseite, Gesetz, Verfahrensdaten, GeoJSON-Manifest | sehr hoch | mittel | hoch | gering | mittel | Vierzehn seit 1. August 2026 geltende Bezirke und die acht historischen Flächenbezirke mit Gültigkeitsintervallen führen |
| K. Haushalt und öffentliche Unternehmen | Haushaltslogik, CSV/ZIP, Normen, Fonds- und Unternehmensgesetze | mittel | mittel | hoch | gering | mittel | Zahlen nur mit Bezugsjahr und Datenquelle übernehmen, Institutionen projektbezogen verknüpfen |
| L. Politische Kommunikation und Positionen | Pressemitteilungen, Reden, Timeline, Themen | hoch | hoch | sehr hoch | gering | mittel | Tatsachen, Ankündigungen und politische Begründungen getrennt modellieren |
| M. Website, Rechtsportal und Simulationskonventionen | README, AGENTS, CONTENT, DESIGN, Code, Tests | sehr hoch | mittel | hoch | gering | gering | Wissenshub intern halten und Validierung in den Qualitätslauf integrieren |

## Bereits zuverlässig über `content/` abrufbar

Zuverlässig strukturiert sind insbesondere:

1. aktuelle und historische Regierungsprofile ab dem Kabinett Honecker I,
2. der erste Staatsrat und seine aktuellen Geschäftsbereiche,
3. Freistaatsseiten zu Staatsaufbau, Geschichte, Bezirken und Großer Staatsreform,
4. Themenseiten mit Ressort- und Normverweisen,
5. Gesetzgebungsverfahren,
6. Normmetadaten, vollständige gespeicherte Fassungen und Normhistorien,
7. Verkündungen mit `normSlug` und `versionId`,
8. Pressemitteilungen, Reden und Termine,
9. Haushalts- und Serviceinhalte.

Diese Inhalte werden im Wissenshub nicht vollständig kopiert. Gespeichert werden Beziehungen, Gültigkeitszeiträume, Status, Konflikte und stabile Verweise.

## Informationen, die vor allem in `Gesetze/` vorkommen

`Gesetze/` enthält die strukturtragenden HTML-Transkriptionen der Verkündungsblätter und Einzelnormen sowie PDF- und DOCX-Prüfquellen. Dort liegen insbesondere genaue Gesetzeswortlaute, Anlagen, Tabellen, Schlussvorschriften und historische Ursprungsfassungen.

Nach den Repositoryregeln sind HTML-Dateien die regulären Importquellen. Markdown bleibt Altbestand, soweit eine entsprechende HTML-Quelle existiert. Der Wissenshub verweist auf Norm- und Verkündungsdatensätze und kopiert diese Volltexte nicht.

## Informationen, die nur in `context/` oder alten Wiki-Texten vorkommen

Vor allem ältere Regierungslisten, biografische Erzählungen, Entwürfe, politische Planungen, Reden, Standortvereinbarungen und historische Wikiartikel liegen unter `context/`. Diese Quellen sind wichtig für die Suche, aber nicht automatisch aktuell oder kanonisch.

Besonders prüfbedürftig sind:

* frühere Regierungen vor Dezember 2025,
* Staatskrise und Regierungswechsel 2025,
* Bundesrats- und Bundespräsidentenrollen,
* Parteiämter und Parteiwechsel,
* konkrete Gerichtsverfahren,
* nicht abgeschlossene Verträge und Verwaltungsvereinbarungen,
* Projektorganisationen, die nur in Entwürfen beschrieben werden.

## Mehrfach oder widersprüchlich gespeicherte Angaben

1. Die Koalitionspartei DEMOS erscheint als „DEMOS an der Elbe“, „Bündnis Demokratie Europa (DEMOS)“ und historisch „DEMOS Ost“.
2. Die Ursprungsbezeichnung der Verfassung und spätere strukturtragende Arbeitsfassungen weichen in Titel und Artikel 114 voneinander ab.
3. Das Hoheitszeichengesetz verwendet einen fehlerhaften Zielanker.
4. Die Kontroll-PDF zur SERO-Verordnung zeigt Nr. 57, während HTML und Datensatz Nr. 58 führen.
5. Die Organisationserlasse 09/2025, 12/2025 und 05/2026 sind über Neuordnung, partielle Fortgeltung und den Übergang zum Staatsrat historisch abgegrenzt.
6. Verschiedene historische und aktuelle Regierungsdateien verwenden alte und neue Amtsbezeichnungen ohne gemeinsame Rollenchronologie.
7. Der öffentliche Produktionsstand kann hinter dem Repositorystand zurückliegen und ist deshalb kein Ersatz für den redaktionellen Stichtag.

## Wahrscheinlich veraltete Angaben

Wahrscheinlich veraltet sind alte Wiki- und `context/`-Angaben zu Regierung, Ressorts, Parlament,
Bezirken und Verfassungsorganen, sofern sie keinen Gültigkeitszeitraum besitzen. Die acht früheren
Flächenbezirke endeten mit Ablauf des 31. Juli 2026; seit 1. August gelten vierzehn Bezirke. Auch
öffentliche Texte zum Kabinett Honecker II sind seit der Bildung des ersten Staatsrates am
21. Juli 2026 nur noch historisch richtig.

Planungsdokumente zu Transparenzportal, Zuständigkeitsfinder, Haushaltsnavigator oder weiteren Portalfunktionen sind nur dann als umgesetzt zu behandeln, wenn Route, Inhalt und Funktion im aktuellen Code vorhanden sind.

## Wichtige bisher nicht ausreichend strukturierte historische Ereignisse

* Gründung und früheste Regierungsbildungen des Freistaates,
* Wahlen und Wahlperioden vor der siebten Wahlperiode,
* Staatskrise 2025,
* Rücktritt von Tom Kurzschluss,
* Misstrauensvoten und Regierungswechsel,
* vollständige Chronologie der Verfassungsänderungen als politische Ereignisse,
* Partei- und Fraktionswechsel,
* Bundesratspräsidentschaft und mögliche Vertretung der Bundespräsidentin,
* Gerichtsverfahren und Organstreitigkeiten.

## Gesprächsinformationen mit zusätzlichem Prüfbedarf

Die nicht hinreichend belegten Gesprächsinformationen stehen ausschließlich in `conversation-candidates.json`. Delgados Amtszeit, die OVV-/DB-Ticketanerkennung, der EAG-Ausgang zu Boom Europe, Feiertagsrecht, Hoheitszeichenrecht und der Nichtbestand der früher vermuteten Bodenprojekte sind inzwischen geklärt. Das Boom Europe Leipzig/Halle Agreement ist als rechtskräftig unterzeichnet und in Kraft bestätigt. Offen bleiben unter anderem Tarif- und Reaktivierungsdetails, einzelne frühe Regierungsdaten sowie die operative Standorteröffnung von Boom Europe.

## Nicht zu übernehmende Inhalte

Nicht in den bestätigten Wissensbestand gehören:

1. Normvolltexte und vollständige öffentliche Seiten,
2. ungeprüfte Gesprächserinnerungen,
3. bloße Sitzungstermine als Beleg eines Beschlusses,
4. politische Ankündigungen als Beleg praktischer Umsetzung,
5. nicht ratifizierte oder nicht notifizierte Verträge als wirksames Recht,
6. Schätzungen unbekannter Amts- oder Inkrafttretensdaten,
7. aktuelle Angaben aus alten Wiki- oder Kontextdateien ohne Zeitbezug,
8. Inhalte anderer Wikihoster als Miraheze,
9. genaue Abstimmungszahlen ohne Protokoll oder Abstimmungsnachweis.

## Künftig kanonische Quellen

Kanonisch für den jeweiligen Zweck sind:

* `src/config/editorial.json` für den redaktionellen Stichtag,
* `content/normen/` und `content/verkuendungen/` für strukturierte Rechtsstände,
* `Gesetze/*.html` als reguläre strukturtragende Importquellen,
* `data/recht/consolidation-manifest.json` für den Konsolidierungsstand,
* `content/organisation/` für den redaktionell bestätigten aktuellen und historischen Regierungsstand,
* datierte Ernennungs-, Entlassungs-, Vertrags-, Gerichts- und Parlamentsdokumente für politische Realität,
* `knowledge/` als interner Beziehungs-, Zeit- und Konfliktindex.

## Nur historisch zu behandelnde Quellen

* `context/` ohne ausdrückliche aktuelle Bestätigung,
* alte Wiki-Texte,
* archivierte Kabinetts- und Ressortdateien,
* alte Organisationserlasse,
* Markdown-Altbestand bei vorhandener HTML-Quelle,
* frühere Produktionsstände der Website.

## Klassifikation der 30 Gesprächshinweise

| Nr. | Ergebnis | Begründung |
| ---: | --- | --- |
| 1 | bereits weitgehend vorhanden | Gründungsdatum und sächsische Ausgangsordnung stehen in Geschichte und Repositoryregeln; eigenständige Gründungsurkunde fehlt |
| 2 | bereits vorhanden | Dresden und Berliner Sonderstellung sind strukturiert |
| 3 | vollständig mit Zeitlogik vorhanden | vierzehn Bezirke gelten am Stichtag seit 1. August 2026; die acht früheren Flächenbezirke sind historisch |
| 4 | vollständig vorhanden | Übergänge Landtag, Staatsregierung und Ministerien sind in Verfassung und Staatsreform belegt |
| 5 | vollständig vorhanden | erster Staatsrat seit 21. Juli 2026 |
| 6 | vollständig vorhanden | selbstständige Rechtsverordnungen und SERO-Verordnung sind belegt |
| 7 | vollständig vorhanden | sechs gespeicherte Verfassungsfassungen und alle vier Reformgesetze sind verknüpft |
| 8 | vollständig vorhanden | Regierungsführung seit 20. Dezember 2025, Staatspräsident seit 21. Juli 2026 |
| 9 | teilweise vorhanden | Regierungsbiografie vorhanden, Parteiwechsel und Parteifunktionen fehlen |
| 10 | vollständig vorhanden | Volksfront und DEMOS tragen den Staatsrat |
| 11 | teilweise vorhanden | 11 von 15 Sitzen seit 5. Juli 2026 belegt, einzelne Wechsel nicht |
| 12 | teilweise vorhanden | viele aktuelle und historische Profile vorhanden, mehrere Namen ungeklärt |
| 13 | vollständig vorhanden | Barlow, Schmäle und Lehrmann-Hinweis stehen in AGENTS und Profilen |
| 14 | nicht ausreichend vorhanden | Staatskrise 2025 fehlt als belastbare Timeline |
| 15 | weitgehend vorhanden | Reformkomplexe sind in Verfassung, Reformseite und Normen abgebildet |
| 16 | weitgehend vorhanden | geltender Hoheitszeichenbestand ist geklärt; der fehlerhafte historische Änderungsanker bleibt dokumentiert |
| 17 | überwiegend vorhanden | Bodenprojekte und Feiertagsrecht sind geklärt; Tarif- und Fernverkehrsvollzug benötigen Nacharbeit |
| 18 | teilweise vorhanden | drei Boom-Europe-Gesetze und Verfahren belegt, Detailorganisation noch zu extrahieren |
| 19 | weitgehend vorhanden | Grenzpolizeiabkommen gilt seit seiner Veröffentlichung; operative Umsetzung bleibt im Aufbau |
| 20 | widersprüchlich oder nicht belegt | Beginn der Bundesratspräsidentschaft fehlt als Primärquelle |
| 21 | nicht vorhanden | Bundesratszugangs- oder Stimmrechtsstreit nicht aktenförmig modelliert |
| 22 | nicht vorhanden | Vertretung der Bundespräsidentin und Einzelakte nicht belegt |
| 23 | nicht vorhanden | genannte Gerichtsverfahren fehlen mit Aktenzeichen und Entscheidungen |
| 24 | teilweise vorhanden | Notifikations- und Ratifikationslücken sind ausdrücklich dokumentiert |
| 25 | vollständig vorhanden | Portalrollen sind im Code und Content sichtbar |
| 26 | teilweise vorhanden | einige Funktionen umgesetzt, alte Planungen nicht systematisch klassifiziert |
| 27 | vollständig vorhanden | HTML ist reguläre Importquelle, Markdown Altbestand |
| 28 | vollständig vorhanden | sächsischer Stichtag 1. November 2023 ist verbindlich dokumentiert |
| 29 | weitgehend vorhanden | historische Verfassungsfassungen und reproduzierbare Konsolidierung existieren, 34 Ausgangssnapshots fehlen |
| 30 | als neues Wissenselement sinnvoll | nichtrechtliche Realitätsänderungen werden nun über Rollen, Timeline und Verfahren modelliert |

## Ergebnis des Audits

Der Repositorybestand ist im Rechtsbereich bereits stark strukturiert. Die größte Lücke liegt nicht bei Normtexten, sondern bei der politischen Realität zwischen den Normen: historische Regierungen, Personenrollen, Parteien, Koalitionsänderungen, externe Beziehungen, Gerichtsverfahren und Projektmeilensteine.

Der Wissenshub verwendet deshalb keine zweite Normdatenbank. Er bildet stabile Querverbindungen, Zeitintervalle, Provenienz, Konflikte und offene Prüfaufträge.

## Fortschreibung: EAG-Ausspielungen und amtliche Dokumente vom 11. August 2026

Der Discordexport des Kanals `staatsregierung-ost` wurde vollständig chronologisch ausgewertet. Er umfasst 1.689 Nachrichten und 46 Anhänge vom 9. April 2024 bis 11. August 2026. Alle Anhänge waren technisch zugänglich. Bilder wurden visuell gelesen; PDF- und DOCX-Dokumente wurden gerendert und kontrolliert; die beigefügte Krankenhaustabelle wurde strukturell ausgewertet. Die redaktionelle Befundliste mit Message-IDs, Reply-Bezügen und Attachment-Dateinamen steht in `clarifications/2026-08-11-eag-kanon.md`.

Die Quellenrichtlinie unterscheidet nun ausdrücklich zwischen bloßen Regierungsanfragen und kanonischen EAG-Entscheidungen über die simulierte Außenwelt. Ablehnungen sind bindend, spätere Retcons setzen frühere Aussagen auf `superseded`, und Scherze oder unklare Reaktionen sind keine Bestätigung.

Neu belastbar modelliert sind insbesondere:

- Mateo Delgados Amtszeit als Ministerpräsident vom 4. September bis 19. Dezember 2025,
- die Ernennungen von Claus Weselsky und Gregor Gysi,
- die fünf Stufen des Helsinki-Komplexes bis zum Inkrafttreten des ostdeutschen Beitritts am 27. Januar 2026,
- die schrittweise Übernahme der Elia-Beteiligung an 50Hertz,
- bestätigte Vergabe-, Unternehmens- und Beschaffungsentscheidungen mit getrennten offenen Lieferfragen,
- die Ablösung des direkten Krankenhauskaufs durch den Rekommunalisierungsfonds,
- 57 Millionen Euro für die OVV-Ticketanerkennung bei DB Fernverkehr, ausdrücklich ohne automatischen Reaktivierungsnachweis,
- EAG-bestätigte Umbenennungen und Denkmalentscheidung,
- abgelehnte, zurückgenommene und überholte Vorhaben.

Das Helsinki-Übereinkommen ist eine Vertragsfassung von 1992. Ostdeutschland unterzeichnete am 6. Oktober 2025 und setzte den Beitritt mit der Verkündung von Zustimmungsgesetz und Übereinkommen im Ostdeutschen Vertragsblatt am 27. Januar 2026 in Kraft. Der Rechtsportalstatus wird deshalb als `in-force` mit diesem ostdeutschen Wirksamkeitsdatum geführt.
