# Quellenhierarchie des internen Wissenshubs

**Redaktioneller Stichtag:** zentral in `../src/config/editorial.json`
**Repositoryprüfung:** 29. August 2026

## Grundsatz

Der Wissenshub speichert keine bestätigte Tatsache ohne Provenienz. Jeder bestätigte Eintrag
verweist auf mindestens eine konkrete Quelle und eine Fundstelle. Gesprächsinhalte, alte Entwürfe
und Wikiartikel sind Suchhinweise, keine automatische Tatsachengrundlage.

Bei einem Konflikt gewinnt nicht mechanisch die jüngere Datei. Maßgeblich sind Quellenart,
Geltungszeitraum, Dokumentstatus und sachliche Zuständigkeit. Eine Rechtsnorm ist für die
Rechtslage vorrangig, ein späterer Ernennungsakt kann dagegen für die tatsächliche Besetzung eines
Amtes maßgeblich sein.

## Verbindliche Priorität

1. Verkündete Rechtsnormen und amtliche Primärquellen.
2. Strukturierte Normfassungen und Verkündungsdaten unter `content/normen/` und
   `content/verkuendungen/`.
3. Andere datierte amtliche Simulationsdokumente, insbesondere Ernennungen, Entlassungen,
   Parlamentsdokumente, Verträge und gerichtliche Entscheidungen.
4. Aktuelle strukturierte Websiteinhalte unter `content/`.
5. Aktuelle zentrale Konfigurationen unter `src/config/` sowie validierte Dashboarddaten.
6. Historische Regierungs-, Parlaments- und Organisationsdokumente.
7. Kanonische EAG- beziehungsweise Simulationsausspielungen, soweit sie den Ausgang eines Vorgangs
   eindeutig festlegen.
8. Sonstige historische Dateien und Entwürfe unter `context/`.
9. Alte Wiki-Texte und redaktionelle Zusammenfassungen.
10. Bloße Regierungsanfragen, sonstige Angaben aus bisherigen Gesprächen und ungeprüftes
    Gesprächswissen.
11. Redaktionelle Ableitungen aus mehreren Quellen.

## Besondere Regeln

### Rechtsstand

Für rechtliche Detailfragen sind die gespeicherten Normfassungen, Verkündungen, Fundstellen und
Primärquellen maßgeblich. Der Wissenshub kopiert keine Normvolltexte. Er verweist über `normSlug`,
`versionId`, Verkündungs-Slug, Fundstelle und Vorschrift.

Für ausdrücklich geänderte übernommene sächsische Stammnormen ist grundsätzlich der am
1. November 2023 geltende sächsische Rechtsstand Ausgangspunkt. Spätere sächsische Änderungen
werden nur übernommen, wenn eine ostdeutsche Änderungsvorschrift gerade diesen späteren Stand
bezeichnet.

### Ämter und politische Realität

Für die tatsächliche Besetzung eines Amtes sind Ernennungs-, Entlassungs-, Wahl- und Übergangsakte
wichtiger als ein älterer Organisationserlass. Öffentliche Profile und zentrale Konfigurationen
können den aktuellen redaktionellen Stand bestätigen, ersetzen aber bei Konflikten keine
Primärquelle.

### Parlamentarische Verfahren

Ein angesetzter Sitzungstermin belegt keine Beratung, Abstimmung oder Annahme. Eine Verkündung
belegt Beschluss und Verkündung, aber nicht automatisch Beratungsverlauf, Stimmenzahlen oder
Ausschussdetails.

### Verträge und Abkommen

Unterzeichnung, Zustimmung, Ratifikation, Notifikation, Austausch von Urkunden und Inkrafttreten
sind getrennte Zustände. Ein veröffentlichter Vertrag wird ohne Nachweis der Wirksamkeitsbedingung
nicht als in Kraft bezeichnet.

### Politische Kommunikation

Pressemitteilungen, Reden und öffentliche Erklärungen belegen, dass eine Position vertreten oder
eine Ankündigung gemacht wurde. Sie belegen nicht ohne weitere Quelle, dass das angekündigte
Vorhaben beschlossen oder praktisch umgesetzt wurde.

### EAG- und Simulationsausspielungen

Der EAG-Chat enthält sowohl Regierungsanfragen als auch Entscheidungen der simulierten Außenwelt.
Diese beiden Quellenrollen sind strikt zu trennen:

1. Eine Anfrage, Idee, Absicht, Verhandlungseröffnung oder Behauptung eines Regierungsaccounts
   belegt nur Planung beziehungsweise Antragstellung.
2. Eine eindeutige Entscheidung der EAG über den Ausgang eines Vorgangs ist eine kanonische
   Simulationsquelle. Kurze Antworten wie „NVIDIA nimmt an“, „Wird genehmigt“, „Deal“, „Erledigt“,
   „Geht klar“ oder „Jo ist raus“ können genügen, wenn Antwortbezug und Gesprächskontext eindeutig
   sind.
3. Ablehnungen sind ebenfalls kanonisch. Ein abgelehntes Vorhaben wird nicht als umgesetzt geführt,
   solange keine spätere belastbare Quelle die Ablehnung ersetzt.
4. Eine spätere ausdrückliche Korrektur, Rücknahme oder Retcon-Aussage bestimmt den ab diesem
   Zeitpunkt maßgeblichen Stand. Historische Zustände bleiben nur dort erhalten, wo sie als
   Simulationsereignis oder zur Gültigkeitslogik fachlich erforderlich sind.
5. Scherze, Memes, bloße Reaktionen, Spekulationen und ungeklärte Rückfragen sind keine
   Bestätigung.
6. Nachrichten werden mit Reply-Bezug sowie den unmittelbar vorhergehenden und nachfolgenden
   Nachrichten gelesen. Einzelne Sätze werden nicht aus dem Verlauf gelöst.
7. Bildanhänge werden visuell ausgewertet. Relevanter Text, Account, sichtbares Datum,
   Attachment-Dateiname und Discord-Message-ID werden mit dem Gesprächskontext verbunden.
   Dateiname und Alt-Text allein reichen nicht.
8. Ist ein Anhang technisch nicht zugänglich, wird keine Aussage daraus abgeleitet. Stattdessen
   entsteht eine konkrete offene Quellenfrage mit Message-ID und Dateiname.
9. EAG-Locators enthalten möglichst Datum und Uhrzeit, Message-ID, Autor, Antwortbezug und
   gegebenenfalls Attachment-Dateiname.
10. Verkündete Normen, Verträge, Ernennungsurkunden und andere amtliche Primärquellen sowie
    offizielle Pressemitteilungen bleiben für ihren jeweiligen Gegenstand vorrangig.

Die redaktionelle Anwendung dieser Regeln auf den Export des Staatsregierungskanals ist in
`clarifications/2026-08-11-eag-kanon.md` dokumentiert.

### Externe Wikis

Als externe Wikiquelle ist ausschließlich `https://politiksim.miraheze.org/wiki/` zulässig.
Inhalte werden nur mit konkreter Seite, Revision oder Permalink und nach Abgleich mit höher
priorisierten Quellen übernommen. Andere Wikihoster werden nicht als Quelle verwendet.

## Konfliktverfahren

Ein tatsächlich ungeklärter Quellenwiderspruch wird mit den betroffenen Aussagen und ihren
Quellenreferenzen nachvollziehbar gehalten. Der strukturierte Eintrag erhält den Status `disputed`,
gegebenenfalls eine `conflictGroup`, und eine konkrete Frage in `open-questions.json`. Öffentliche
Inhalte werden nicht stillschweigend geändert.

Sobald ein Konflikt fachlich und quellenmäßig geklärt ist, werden `disputed`-Status, offene Frage
und aktuelle Audit- oder Gap-Einträge entfernt. Die ursprünglichen Quellen selbst bleiben
unverändert. Eine redaktionelle Auflösungsentscheidung wird nur dann dauerhaft als technische
Provenienz mitgeführt, wenn sie weiterhin erforderlich ist, um aus einem fehlerhaften,
mehrdeutigen oder nicht berichtigten Primärtext deterministisch den kanonischen Datenstand
abzuleiten. Reine Erinnerung daran, dass früher einmal ein Konflikt bestand, ist kein eigener
Dokumentationszweck.

## Gesprächswissen

Ungeprüfte Gesprächskandidaten stehen ausschließlich in `conversation-candidates.json`. Sie dürfen
erst in `current-state.json`, Entitäten, Projekte, Verfahren oder Timeline übernommen werden, wenn
eine höher priorisierte Quelle oder eine nach den vorstehenden Regeln eindeutig kanonische
EAG-Ausspielung vorliegt. `knowledge:check` verhindert, dass reine Gesprächsquellen den aktuellen
Stand tragen.
