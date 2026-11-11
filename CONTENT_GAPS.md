# Offene Quellenfragen

Diese Datei enthält ausschließlich Quellenlücken, Quellenkonflikte und notwendige Quellenarbeiten,
die im aktuellen Repository offen sind. Jeder Eintrag nennt Fundstelle, Grund und das, was zur
Lösung fehlt. Gelöste Fälle werden entfernt; der maschinenlesbare Einzelstand der
Normkonsolidierung steht in `data/recht/consolidation-manifest.json`, die Bilanz der
REVOSax-Übernahme in `data/recht/revosax-import-audit/summary.json`.

## Hoheitszeichenrecht: Ermächtigungsverweis und Fortgeltungsmaßgaben

OGVBl. 2026 Nr. 70, Artikel 2 Absatz 2 (HTML und PDF S. 13), verweist für die neue
Durchführungsverordnung auf § 17 OHzG. Dieser regelt Ordnungswidrigkeiten; die
Verordnungsermächtigung steht in § 19. Eine amtliche Berichtigung fehlt. Die Vorschrift verweist
außerdem pauschal auf die entsprechenden neuen Gesetzesvorschriften. Für eine vollständige
Konsolidierung der Hoheitszeichenverordnung fehlen eindeutige Einzelzuordnungen. Bis zur Klärung
bleibt dieses Ziel gesperrt. Die eindeutig verkündeten Fortgeltungsmaßgaben, die Nichtanwendung
der Vorschriften über das große Staatswappen und das späteste Außerkrafttreten am 31. Dezember
2026 sind als Anwendungshinweise und Frist erfasst; die Originalquellen bleiben unverändert.

## Eingang vom 12. September 2026: amtliche Wortlautbefunde ohne Berichtigung

- **Wörtliche Ersetzungen „Landtag“ → „Volkskammer“** — Artikel 5 Nummer 3 Buchstabe a der Ausgabe Nr. 77 ergibt in der Bezeichnung des § 18 OstKHFondsG „Unterrichtung des Volkskammer“, Artikel 5 Nummer 3 der Ausgabe Nr. 76 in § 3 Absatz 1 Satz 1 OLADG „für den Volkskammer“. Die Fassungen geben den angeordneten Wortlaut wieder; eine grammatische Glättung wäre eine Änderung ohne amtliche Grundlage.
- **Artikel 75a Absatz 1 und Artikel 83 Absatz 3 der Staatsverfassung** — der neu gefasste Wortlaut endet in der Verkündung (OGVBl. 2026 Nr. 76) mit zwei Punkten beziehungsweise ohne Schlusspunkt und mit abweichendem Anführungszeichen; beides ist quellentreu gespeichert.
- **§§ 5a und 10a des Ostdeutschen Krankenhausgesetzes** — die 2026 durch das Gesetz über einen Landesfonds zur Sicherung und Rekommunalisierung von Krankenhäusern (OGVBl. 2026 Nr. 28) eingefügten Paragraphen liegen in der gespeicherten Fassung nur mit Überschrift vor; das damalige Rezept hat die Zeilen der Inhaltsübersicht statt der Vorschriftentexte eingefügt. Zu klären ist der Wortlaut aus der Quelle; bis dahin bleibt die Fassung unverändert (Artikel 4 Nummer 2 der Ausgabe Nr. 77 fügt § 10b hinter dem leeren § 10a ein).

## REVOSax-Übernahme (Ausgangsbestand 1. November 2023)

- **Europäisches Übereinkommen über das grenzüberschreitende Fernsehen (REVOSax 1018)** —
  REVOSax hält den Text nur als PDF-Anlagen vor; das Übereinkommen selbst ist ein Scan ohne
  Textebene. Ohne manuell geprüfte Texterkennung wird kein Normtext erzeugt; die Anlagen sind
  hashverifiziert in R2 archiviert (dokumentierter SKIP in
  `data/recht/revosax-baseline-decisions.json`).
- **Änderungs-VwV mit reiner Fragebogen-Anlage (REVOSax 17114)** — die einzige Anlage hat eine
  Textebene, ist aber ein Formular und kein Normtext; sie wird nicht als Paragraphentext
  umgedeutet (dokumentierter SKIP, Anlage in R2).
- **Richtlinie Hilfe Wohngebäude und Unternehmen 2014 (REVOSax 14011.1)** — der übernommene Text
  befristet die Richtlinie auf den 31. Dezember 2015, REVOSax führt die Fassung jedoch bis zum
  31. Dezember 2023 als geltend. Ohne weitere amtliche Quelle ist nicht entscheidbar, ob eine
  Verlängerung vorlag; die Norm bleibt unverändert, der Fall ist in
  `data/recht/revosax-sunset-decisions.json` als offen dokumentiert.

## Sächsische Rechtsakte nach dem Überleitungsstichtag

Erlassdatum oder Fassungsbeginn nach dem 1. November 2023 werden in
`data/recht/revosax-post-cutoff-decisions.json` entschieden (`discard`, `adopted`, `open`). Offen
bleibt ein Fall:

- **VwV Größere Raubtiere** (`vwv-groessere-raubtiere`, REVOSax 21231) — die amtliche Trefferliste
  nennt als Erlassdatum den 30. Mai 2025, die übernommene Fassung gilt aber seit dem 1. Juli 2023
  und wurde für den Stichtag ausgeliefert. Ohne weitere amtliche Quelle ist nicht entscheidbar, ob
  die Vorschrift am Stichtag in dieser Fassung galt; sie bleibt unverändert im Bestand.

## Rechtsherkunft nicht belegbar (`origin-unresolved`)

Die Herkunftsklasse wird aus Quellen, Fundstellen und Historie abgeleitet
(`getNormOriginInfo` in `packages/shared/src/lib/norms/origin.ts`); sie lässt sich in der Rechtssuche
über den Filter „Rechtsherkunft“ unter „Weitere Filter · Erweiterte Suche“ und im Verzeichnis
„A–Z und Register“ über die Spalte „Herkunft“ und die Auswahl der Herkunftsart eingrenzen. Fünf
Normen lassen sich nach den geltenden Regeln nicht zuordnen, weil das Herkunftsmodell nur die
Übernahme des sächsischen Rechtsstands zum 1. November 2023 und die eigene ostdeutsche Setzung
kennt:

- **Ostdeutsches Zweckentfremdungsverbotsgesetz** (`zweckentfremdungsverbotsgesetz`) — sächsisches
  Gesetz vom 14. Februar 2024 (SächsGVBl. S. 167, REVOSax 20743.1, gültig ab 19. März 2024), also
  nach dem Stichtag erlassen und dennoch übernommen; ostdeutsche Änderung durch OGVBl. 2026
  Nr. 29. Die Übernahme ist als `adopted` in `data/recht/revosax-post-cutoff-decisions.json`
  belegt; offen bleibt allein die Herkunftsklasse, weil das Modell nur Übernahme zum Stichtag und
  eigene ostdeutsche Setzung kennt.
- **Ostdeutsches Gleichstellungsgesetz** (`saechsisches-gleichstellungsgesetz`) — sächsisches
  Gesetz vom 19. Oktober 2023 (SächsGVBl. S. 850, REVOSax 20283.1), am Stichtag verkündet, aber
  erst am 1. Januar 2024 in Kraft; ostdeutsche Änderung durch OGVBl. 2026 Nr. 35. Die Übernahme
  ist in `data/recht/revosax-post-cutoff-decisions.json` als `adopted` belegt; offen ist, ob am
  Stichtag verkündetes, noch nicht geltendes Recht als übernommen gilt.
- **Ausbildungs- und Prüfungsordnung Polizei** (`ausbildungs-und-pruefungsordnung-polizei`) —
  sächsische Verordnung vom 6. August 2024, Fassung ab 1. September 2025 (REVOSax 21006.2),
  ostdeutsche Änderung durch OGVBl. 2026 Nr. 12; die Übernahme ist wie beim
  Zweckentfremdungsverbotsgesetz in `data/recht/revosax-post-cutoff-decisions.json` als `adopted`
  belegt, die Herkunftsklasse bleibt offen.
- **NDR-Staatsvertrag** (`ndr-staatsvertrag`) — Staatsvertrag der vier norddeutschen Länder vom
  4./9. März 2021, in Kraft seit dem 1. September 2021; die Ausgangsfassung ist unverändert unter
  `Gesetze/NDR-Staatsvertrag.html` und `Gesetze/NDR-Staatsvertrag.pdf` archiviert und durch den
  ostdeutschen Änderungsstaatsvertrag vom 8. März 2026 (OVertrBl. 2026 Nr. 4) geändert. Er ist
  weder zum 1. November 2023 aus dem sächsischen Rechtsstand übernommen noch eine eigene
  ostdeutsche Setzung; das Herkunftsmodell kennt für einen mitgetragenen Staatsvertrag eines
  anderen Landes keine Klasse.
- **Oberstufen- und Abiturprüfungsverordnung** (`oberstufenund-abiturprufungsverordnung`) — die
  2024 geänderte Verordnung war nach der amtlichen Klarstellung in Artikel 5 Absatz 2 der Verordnung
  zur Bereinigung des allgemeinbildenden Schulordnungsrechts (OGVBl. 2026 Nr. 67) bereits seit dem
  1. August 2008 außer Kraft; der Akt von 2024 setzte sie weder neu noch wieder in Kraft. Der
  Datensatz trägt weder eine REVOSax-Quelle noch eine eigene Ausgangsfassung. Ohne amtliche Quelle
  der 1996er Verordnung bleibt die Herkunft ungeklärt.

## Bekanntmachungen zur Interflug (StAnzO. 2026 Nr. 39 und 40)

- **Bekanntmachung des Staatsrates über die Bestellung des Gründungsvorstandes der Interflug
  (StAnzO. 2026 Nr. 39)** — die maßgebliche Ausgabe stützt die Bekanntmachung in der
  Eingangsformel auf „§ 23 Abs. 3 und 4 und § 14 Abs. 2.“ des Interflug-Gesetzes. Im Text nennt
  sie für die Aufgaben des Gründungsvorstandes weiterhin „§ 24 Absatz 4“ und für die Bestellung
  des ersten Vorstandes „§ 10 Absatz 2 des Interflug-Gesetzes“. Im verkündeten Interflug-Gesetz
  (OGVBl. 2026 Nr. 74) regelt § 23 Absatz 4 die Aufgaben des Gründungsvorstandes und § 14
  Absatz 2 die Bestellung des Vorstandes durch den Verwaltungsrat; § 24 existiert nicht, § 10
  betrifft das betriebsnotwendige Vermögen. Der Wortlaut wird unverändert wiedergegeben; die
  Abweichung ist im Datierungshinweis der Norm dokumentiert. HTML und PDF stimmen überein.

## Verweise im Gesetz zur Einführung von Hinweisgebermeldestellen (OGVBl. 2026 Nr. 72)

- **Artikel 2 (§ 60a Landkreisordnung) und Artikel 3 (§ 24a Bezirksordnung)** — beide
  Vorschriften lassen Landkreise und Bezirke Hinweisgeberstellen „nach § 71b Absatz 2 und 3“
  errichten. Die maßgebliche Ausgabe fügt die Hinweisgeberstellen in Artikel 1 jedoch als § 71h
  in einen neuen Sechsten Abschnitt der Gemeindeordnung ein; § 71b der Gemeindeordnung regelt die
  Bundeshauptstadt Berlin. HTML und PDF stimmen überein. Die Verweise werden unverändert
  wiedergegeben, bis eine amtliche Berichtigung vorliegt.

## Haushalt 2027/2028: Korrekturen im Haushaltsrepo

Quelle ist der Snapshot `data/haushalt/2027-2028/` (Haushaltsrepo `osthaushalt-2027-2028`, Commit
laut `import-manifest.json`). Offen und nur im Haushaltsrepo lösbar:

- Vorhaben „Verwaltungsdigitalisierung und gemeinsame Rechenzentren“: In
  `haushalt/2027-2028/redaktion/untersetzung/ep08_09.toml` ist dem Breitbandtitel 09 23/883 01
  `projekt = "digital"` zugeordnet, das Vorhaben führt aber Einzelplan 17. Zur Lösung die
  Zuordnung am Breitbandtitel entfernen und die Titel der Kapitel 17 03, 17 10 und 17 11
  zuordnen. Bis dahin zeigt das Portal das Vorhaben ohne Projektbetrag mit erläuterndem Hinweis.
- Ressortzuordnung einzelner Kapitel (03 05 Raumordnung, 09 23 Breitbandausbau) und Umfang des
  Einzelplans 15 (Prüfdienste vermutlich in Kapitel 06 03): redaktionell mit dem Haushaltsrepo zu
  klären; das Portal ordnet bis dahin nach Einzelplänen zu.
- Unternehmensname beim Vorhaben „Handelsorganisation Ost“: Der Snapshot nennt eine etwaige
  Übernahme von Filialen eines namentlich bezeichneten realen Handelsunternehmens, und zwar in
  `projekte.json` (Beschreibung und Suchbegriffe des Vorhabens `ho`) und im Rohtext der Erläuterung
  zu Kapitel 07 10 Titel 831 75 (`titel/07.json`, dort mit Modellannahmen zu Filialzahl und
  Kaufpreis). Derselbe Rohtext steht zwangsläufig als Schlüssel der Klassifikation in
  `content/haushalt/2027-2028/freitexte.json`. Weder `knowledge/` noch `context/` belegen ein
  solches Vorhaben. Veröffentlicht wird keine dieser Stellen: Das Portal zeigt die freigegebene
  neutrale Fassung („eine etwaige Übernahme bestehender Filialen“) und lässt den Namen in der Suche
  weg; PDF und Arbeitsmappe sind neutral gefasst, die Artefaktprüfung sperrt den Namen. Zur Lösung
  im Haushaltsrepo die Vorhabendaten und den Titeltext neutral fassen oder das Vorhaben mit Quelle
  belegen; danach `npm run haushalt:sync` und den Klassifikationsschlüssel an den neuen Rohtext
  anpassen.
- Status der Wirtschaftspläne: In `wirtschaftsplaene.csv` (Spalte `status`) tragen ElbeLB,
  Handelsorganisation Ost, Ostdeutsche Rohstoffwerke, Landesbodenfonds und beide
  Interflug-Gesellschaften für 2027 bis 2031 den Status von Gemeingut Wohnen (Kopierfehler).
  Veröffentlicht wird der Status nicht: Das Portal schließt das Feld aus, die Arbeitsmappe führt
  die Spalte nicht. Zur Lösung im Haushaltsrepo den Status je Unternehmen berichtigen.
- Kostenfreie Kita- und Schulverpflegung (Kapitel 04 07): Der Zusatzbedarf (Titel 633 01,
  633 02, 633 03 und 633 61, 2027 zusammen 1.707,66 Mio. EUR) liegt um 201,24 Mio. EUR unter
  Bruttobedarf (2,15 Mio. Nutzende × 195 Tage × 6,00 EUR) abzüglich bestehender Finanzierung
  (Titel 633 04 und 686 61, 550 Mio. EUR) und Einsparung aus gemeinsamer Beschaffung
  (56,6 Mio. EUR). Die Programmrechnung des Haushaltsrepos zieht den Sockel aus Titel 686 61
  ein zweites Mal ab. Die öffentlichen Texte rechnen ihn nicht gesondert an. Zur Lösung im
  Haushaltsrepo die Programmrechnung klären.
- Wirtschaftspläne der Landesunternehmen (`ruecklagen.json`, `wirtschaftsplaene`): Die Spalte
  `kernhaushalt` ist nicht mit den Einzelplänen abgestimmt. Für Gemeingut Wohnen (Titel 0704/891 01,
  891 02, 891 74) und die Landesenergiewerke (0904/831 91) entspricht sie einzelnen Titeln; für die
  Ostdeutsche Eisenbahn (Kapitel 10 08 bis 10 10), die Ostdeutschen Rohstoffwerke (07 06), den
  Landesbodenfonds (19 03) und Interflug Spezialflug (10 04) steht 0, obwohl dort Mittel für diese
  Unternehmen veranschlagt sind; Umsatz und Investitionen dieser Unternehmen außer der Eisenbahn
  sind ebenfalls 0. Die Ausschüttung der ElbeLB 2027 (189 Mio. EUR) passt nicht zur Einnahme
  0604/121 01 (63 Mio. EUR) und zur Gewinnverwendung des Vorhabens (40 % des Bilanzgewinns,
  Landesanteil 75 %, rechnerisch 84 Mio. EUR Ausschüttung). PDF und Arbeitsmappe bezeichnen die
  Spalte als „Zuführung laut Wirtschaftsplan“ und verweisen für die Ansätze auf die Einzelpläne.
  Zur Lösung im Haushaltsrepo die Wirtschaftspläne mit den Titeln abstimmen; danach
  `npm run haushalt:sync`.
- Rechtsgrundlage zu Kapitel 09 04 Titel 831 91 (Landesenergiewerke): Der Rohtext in `titel/09.json`
  nennt „Haushaltsbegleitgesetz Art. 3 (Beteiligungsrecht)“. Nach dem Entwurf des
  Haushaltsbegleitgesetzes ändert Artikel 3 das Finanzausgleichsgesetz Ost; die Finanzierung der
  Landesenergiewerke regelt Artikel 4 § 1. Veröffentlicht wird die berichtigte Fassung aus
  `freitexte.json`. Zur Lösung im Haushaltsrepo den Rohtext berichtigen und danach den
  Klassifikationsschlüssel anpassen.
- Bezeichnungen im Snapshot: Die Zuständigkeit für Einzelplan 18 lautet „Beauftragte für Datenschutz
  und Informationsfreiheit (unabhängig)“; diese Bezeichnung ist weder in `content/` noch in
  `knowledge/` belegt (das Ostdeutsche Transparenz- und Informationsfreiheitsgesetz nennt „die oder
  der Ostdeutsche Datenschutz- und Transparenzbeauftragte“). Den Kapitelbezeichnungen 11 02,
  13 05, 14 01 und 18 03 fehlen die Aufzählungskommas; Kapitel 20 71 heißt „Beihilfe für
  Versorgungsempfänger“. Zur Lösung im Haushaltsrepo die Bezeichnungen berichtigen oder in
  `freitexte.json` (`bezeichnungen`) eine öffentliche Fassung festlegen.

## Rechtskonsolidierung

`npm run norms:consolidation:audit` erzeugt `data/recht/consolidation-report.md` mit den offenen
Zielnormen. Derzeit blockieren zwei Quellenkonflikte:

- **Schulordnung Förderschulen** — `blocked-source-conflict`: Artikel 1 Nummer 18 Buchstabe b der
  OGVBl. 2026 Nr. 64 ersetzt in § 30 Absatz 4 die Wörter „Oberschule oder Gemeinschaftsschule“, die
  dort nicht stehen; Artikel 1 Nummer 30 ersetzt in § 18 Absatz 3 Satz 3 die Wörter „Sächsischen
  Schulgesetzes“, obwohl § 18 Absatz 3 nur einen Satz hat und die Wörter in Absatz 1 Satz 3 stehen.
  Die übrigen Befehle sind in einem geprüften Rezept umgesetzt; ohne Berichtigung wird keine
  Folgefassung erzeugt.
- **Hoheitszeichenverordnung** — `blocked-source-conflict`: Artikel 2 Absatz 2 des Besonderen
  Gesetzes zur Neuregelung des Hoheitszeichenrechts (OGVBl. 2026 Nr. 70) ordnet die Fortgeltung als
  Vollziehungsverordnung „aufgrund des § 17“ OHzG an, obwohl § 17 Ordnungswidrigkeiten regelt und
  die Ermächtigung in § 19 steht; die Verweise auf die entsprechenden neuen Vorschriften sind nicht
  einzeln zuordenbar. Einzelheiten stehen im Abschnitt „Hoheitszeichenrecht: Ermächtigungsverweis
  und Fortgeltungsmaßgaben“.

## Legacy-Transkriptionen

Drei produktive Quellenreferenzen aus zwei Markdownquellen verbleiben als
`legacy-markdown-transcription`: OGVBl. 2025 Nr. 10 ist wegen eines Konflikts zwischen Markdown
und PDF blockiert, für OGVBl. 2024 Nr. 2 S. 2 fehlt eine ausreichende Kontrollquelle für die
vollständige Fassung. Klassifikation und Blockierungsgründe stehen in
`data/recht/alt-source-inventory.json`.

## Dauerhafte Quellenbegrenzung

Für die dritte Plenarsitzung vom 20. Juli 2026 liegt kein Plenarprotokoll mit Redebeiträgen,
Einzelabstimmungen und Stimmenzahlen vor. Für die Gesetzesbeschlüsse des Ostdeutschen Landtages
vom 2. September 2026 (OGVBl. 2026 Nr. 70 bis 74) und der achten Volkskammer vom 11. September
2026 (OGVBl. 2026 Nr. 76 bis 79) sowie vom 12. Oktober 2026 (OGVBl. 2026 Nr. 80 bis 84)
liegen weder Plenarprotokolle noch Drucksachen vor. Die
Verkündungen belegen Beschlussdatum, Verkündung und Inkrafttreten der betroffenen Vorhaben, nicht
aber den Beratungsverlauf oder konkrete Abstimmungszahlen; bei den Beschlüssen vom 2. und
11. September und 12. Oktober auch nicht die Einbringung. Solche Details werden ohne zusätzliche Primärquelle nicht
ergänzt.
