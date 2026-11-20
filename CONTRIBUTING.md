# Mitwirken

Beiträge zum Staatsportal und zum Rechtsportal OstRecht sind willkommen: Fehlerberichte,
Verbesserungen der Barrierefreiheit, belegte Inhaltskorrekturen und überschaubare Codeänderungen.
Das Projekt gehört zu einer politischen Simulation. Die veröffentlichten Rechtstexte sind keine
echten amtlichen Veröffentlichungen.

## Hinweise und Vorschläge

Suche zunächst in den [vorhandenen Issues](https://github.com/XYungeloest/staatsregierung/issues).
Für neue Meldungen stehen Vorlagen für technische Fehler, Inhaltskorrekturen und Vorschläge bereit.
Nenne die betroffene Seite und beschreibe konkret, was geändert werden sollte. Bei Rechtsinhalten
sind Fundstelle, Fassung und Quellenbeleg besonders hilfreich.

Sicherheitslücken bitte vertraulich nach [SECURITY.md](SECURITY.md) melden. Für den Umgang
miteinander gilt der [Verhaltenskodex](CODE_OF_CONDUCT.md). Fragen zum Projekt sind in
[SUPPORT.md](SUPPORT.md) eingeordnet.

## Änderungen vorbereiten

1. Lies den Einstieg in [README.md](README.md) und die Arbeitsregeln in [AGENTS.md](AGENTS.md).
   Für Inhalte gelten außerdem [CONTENT.md](CONTENT.md), für Oberflächen [DESIGN.md](DESIGN.md).
2. Besprich größere Änderungen vorab in einem Issue. Halte einzelne Beiträge auf ein konkretes
   Problem begrenzt und orientiere dich an den vorhandenen Komponenten und Datenformaten.
3. Erstelle einen Branch oder einen Fork und öffne einen Pull Request gegen `main`.
   Beschreibe das Problem, die Änderung und die ausgeführten Prüfungen; verlinke passende Issues.
4. Ergänze bei sichtbaren Änderungen Screenshots, möglichst auch für kleine Bildschirme.
   Füge keine Zugangsdaten, personenbezogenen Einreichungen oder privaten Betriebsdaten hinzu.

## Lokal prüfen

Benötigt wird Node.js gemäß `engines` in [package.json](package.json). Nach `npm ci` starten
`npm run dev` das Staatsportal und `npm run dev:recht` OstRecht. Hinweise zur lokalen D1-Testumgebung
stehen in der README.

Wähle die Prüfungen passend zur Änderung und nenne im Pull Request auch nicht ausgeführte Prüfungen:

- Dokumentation: `npm run docs:check`.
- Für Code und Oberfläche prüft `npm run test:pr` die Änderung. Auf einem neuen Rechner lädt
  `npx playwright install chromium` den benötigten Browser vor dem ersten Lauf. Prüfe sichtbare
  Änderungen auch in den betroffenen Ansichten. Die Testkategorien stehen im
  [Deployment-Runbook](docs/DEPLOYMENT_RUNBOOK.md).
- Kanonische Inhalte: `npm run content:check` und die Prüfungen des jeweiligen Redaktionsworkflows.
- Wissenshub: `npm run knowledge:check`, `npm run knowledge:build`, erneut `npm run knowledge:check`.

Für neue Unterlagen aus `temp-neu/` gilt der vollständige Ablauf im
[Einpflege-Playbook](docs/EINPFLEGE_PLAYBOOK.md), für Normquellen der
[Normworkflow](docs/NORM_WORKFLOW.md). Generierte Bestände werden über ihre Werkzeuge erzeugt.
Produktive D1-/R2-Zugriffe und Veröffentlichungen gehören zum geregelten Betrieb; ein Beitrag
benötigt dafür keine produktiven Zugangsdaten.

## Quellen und Rechte

Eigener Programmcode wird unter MIT aufgenommen, eigene redaktionelle Texte und Simulationsnormen
unter CC BY-NC 4.0. Das gilt auch, wenn ein Beitrag Code und Text in derselben Datei enthält.
Der [Geltungsbereich der Lizenzen](README.md#lizenzen) beschreibt die Zuordnung.

Gib für übernommene Texte, Bilder und Daten die Quelle und die Grundlage für die Veröffentlichung
an, etwa eine Lizenz oder eine Freigabe. Mache kenntlich, was du am Material geändert hast.
Für die Nachnutzung veröffentlichter Simulationsinhalte gelten die Hinweise am jeweiligen Werk
und die [Nutzungshinweise im Impressum des Staatsportals](https://freistaat-ostdeutschland.de/service/impressum/#nutzungsrechte).
