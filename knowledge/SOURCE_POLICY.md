# Quellenhierarchie des internen Wissenshubs

**Redaktioneller Stand:** 9. August 2026
**Auditstand:** 9. August 2026

## Grundsatz

Der Wissenshub speichert keine Wahrheit ohne Provenienz. Jeder bestätigte Eintrag verweist auf mindestens eine konkrete Quelle und eine Fundstelle. Gesprächsinhalte, alte Entwürfe und Wikiartikel sind Suchhinweise, keine automatische Tatsachengrundlage.

Bei einem Konflikt gewinnt nicht mechanisch die jüngere Datei. Maßgeblich sind Quellenart, Geltungszeitraum, Dokumentstatus und sachliche Zuständigkeit. Eine Rechtsnorm ist für die Rechtslage vorrangig, ein späterer Ernennungsakt kann dagegen für die tatsächliche Besetzung eines Amtes maßgeblich sein.

## Verbindliche Priorität

1. Verkündete Rechtsnormen und amtliche Primärquellen.
2. Strukturierte Normfassungen und Verkündungsdaten unter `content/normen/` und `content/verkuendungen/`.
3. Andere datierte amtliche Simulationsdokumente, insbesondere Ernennungen, Entlassungen, Parlamentsdokumente, Verträge und gerichtliche Entscheidungen.
4. Aktuelle strukturierte Websiteinhalte unter `content/`.
5. Aktuelle zentrale Konfigurationen unter `src/config/` sowie validierte Dashboarddaten.
6. Historische Regierungs-, Parlaments- und Organisationsdokumente.
7. Dateien unter `context/`.
8. Alte Wiki-Texte und redaktionelle Zusammenfassungen.
9. Angaben aus bisherigen Gesprächen.
10. Redaktionelle Ableitungen aus mehreren Quellen.

## Besondere Regeln

### Rechtsstand

Für rechtliche Detailfragen sind die gespeicherten Normfassungen, Verkündungen, Fundstellen und Primärquellen maßgeblich. Der Wissenshub kopiert keine Normvolltexte. Er verweist über `normSlug`, `versionId`, Verkündungs-Slug, Fundstelle und Vorschrift.

Für ausdrücklich geänderte übernommene sächsische Stammnormen ist grundsätzlich der am 1. November 2023 geltende sächsische Rechtsstand Ausgangspunkt. Spätere sächsische Änderungen werden nur übernommen, wenn eine ostdeutsche Änderungsvorschrift gerade diesen späteren Stand bezeichnet.

### Ämter und politische Realität

Für die tatsächliche Besetzung eines Amtes sind Ernennungs-, Entlassungs-, Wahl- und Übergangsakte wichtiger als ein älterer Organisationserlass. Öffentliche Profile und zentrale Konfigurationen können den aktuellen redaktionellen Stand bestätigen, ersetzen aber bei Konflikten keine Primärquelle.

### Parlamentarische Verfahren

Ein angesetzter Sitzungstermin belegt keine Beratung, Abstimmung oder Annahme. Eine Verkündung belegt Beschluss und Verkündung, aber nicht automatisch Beratungsverlauf, Stimmenzahlen oder Ausschussdetails.

### Verträge und Abkommen

Unterzeichnung, Zustimmung, Ratifikation, Notifikation, Austausch von Urkunden und Inkrafttreten sind getrennte Zustände. Ein veröffentlichter Vertrag wird ohne Nachweis der Wirksamkeitsbedingung nicht als in Kraft bezeichnet.

### Politische Kommunikation

Pressemitteilungen, Reden und öffentliche Erklärungen belegen, dass eine Position vertreten oder eine Ankündigung gemacht wurde. Sie belegen nicht ohne weitere Quelle, dass das angekündigte Vorhaben beschlossen oder praktisch umgesetzt wurde.

### Externe Wikis

Als externe Wikiquelle ist ausschließlich `https://politiksim.miraheze.org/wiki/` zulässig. Inhalte werden nur mit konkreter Seite, Revision oder Permalink und nach Abgleich mit höher priorisierten Quellen übernommen. Andere Wikihoster werden nicht als Quelle verwendet.

## Konfliktverfahren

Bei widersprüchlichen Quellen werden beide Aussagen mit ihrer Provenienz erhalten. Der Eintrag erhält den Status `disputed`, gegebenenfalls eine `conflictGroup`, und eine Frage in `open-questions.json`. Öffentliche Inhalte werden nicht stillschweigend geändert.

Redaktionell aufgelöste Quellenabweichungen bleiben als solche dokumentiert. Eine redaktionelle Entscheidung verändert nicht den Wortlaut der ursprünglichen Quelle.

## Gesprächswissen

Gesprächskandidaten stehen ausschließlich in `conversation-candidates.json`. Sie dürfen erst in `current-state.json`, Entitäten, Projekte, Verfahren oder Timeline übernommen werden, wenn eine höher priorisierte Quelle vorliegt. `knowledge:check` verhindert, dass reine Gesprächsquellen den aktuellen Stand tragen.
