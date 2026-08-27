# Interner Wissenshub

Diese Dateien bilden einen internen, nicht öffentlich ausgelieferten Wissenshub für Menschen,
ChatGPT, Codex und andere Agenten. Der Hub erschließt den vorhandenen Repositorybestand, verknüpft
Quellen, ordnet Gültigkeitszeiträume ein und hält tatsächlich offene Fragen sichtbar.

## Abgrenzung

`content/` enthält öffentliche Websiteinhalte und strukturierte Rechtsdaten.  
`Gesetze/` enthält strukturtragende Importquellen und visuelle Kontrollquellen.  
`context/` enthält historische Ausgangstexte, Entwürfe und Simulationsmaterial.  
`knowledge/` enthält Querverbindungen, Rollenchronologien, Zustände, Projekte, Verfahren,
aktuelle Konflikte und Suchkandidaten.

Der Wissenshub ist keine zweite Website und kein Ersatz für das Rechtsportal. Normvolltexte und
öffentliche Seiten werden nicht kopiert.

Für das Gesamtprojekt gilt: ein Repository, ein gemeinsamer Daten- und Wissensbestand, zwei
öffentliche Anwendungen. Das Staatsportal unter `freistaat-ostdeutschland.de` und OstRecht unter
`recht.freistaat-ostdeutschland.de` referenzieren denselben Hub; weder Portal- noch Rechtsbuild
liefert `knowledge/` öffentlich aus.

Aktuelle Regierungsbesetzungen werden in `content/organisation/` kanonisch gepflegt;
Knowledge-Einträge referenzieren diese IDs und Quellen, ergänzen aber weiterhin Provenienz,
Zusammenhänge und Zeiträume.

## Einstieg

| Frage | Einstieg |
| --- | --- |
| Wer gehört aktuell dem Staatsrat an? | `current-state.json`, danach `entities/persons.json` |
| Welche Verfassungsfassung galt an einem Datum? | `timeline.json`, `current-state.json`, danach Normhistorie unter `content/normen/` |
| Welche Normen gehören zu einem politischen Komplex? | `projects.json` |
| Welche Beteiligungen, AöR und öffentlichen Wirtschafts- oder Vermögensträger bestehen? | `holdings.json` für die Einordnung, `holding-positions.json` für die vollständige Positionsinventur, danach `entities/institutions.json` und die referenzierten Primärquellen |
| Wie entwickelte sich die Regierung seit 2025? | `timeline.json`, `entities/persons.json`, `entities/institutions.json` |
| Welche Verfahren sind offen? | `proceedings.json`, `open-questions.json` |
| Welche Vereinbarungen mit Bund oder Nachbarstaaten bestehen? | `proceedings.json` |
| Welche Aussage stammt nur aus einem Gespräch? | `conversation-candidates.json`; für EAG-Ausspielungen zusätzlich `SOURCE_POLICY.md` |
| Welche Quelle ist für eine Detailfrage maßgeblich? | `SOURCE_POLICY.md`, `sources.json` |

## Dateien

`AUDIT.md` beschreibt den aktuellen Abdeckungsstand, dauerhafte Grenzen und noch offene
Arbeitsfelder.  
`SOURCE_POLICY.md` legt die Quellenhierarchie und das Konfliktverfahren fest.  
`schema.json` beschreibt gemeinsame Provenienz- und Rollenfelder.  
`sources.json` enthält stabile Quellen-IDs.  
`current-state.json` enthält ausschließlich den am Stichtag belegten aktuellen Stand.  
`timeline.json` enthält datierte Ereignisse.  
`projects.json` bündelt politische und rechtliche Gesamtkomplexe.  
`holdings.json` enthält den rekonstruierten Beteiligungsbestand, Träger- und
Gewährträgerpositionen, wichtige mittelbare Beteiligungen, Sondervermögen und die
Rechtsnachfolgelogik seit dem 1. Dezember 2023.  
`holding-positions.json` enthält die maschinenprüfbare Vollinventur der öffentlich belegten
unmittelbaren, mittelbaren und tieferliegenden Positionen. Die Spaltenreihenfolge steht in
`positionFields`; Quellen gelten portfolioübergreifend, jede Zeile besitzt zusätzlich eine
konkrete Fundstelle. Mehrländerpositionen, Fortschreibung und ausdrückliche Ausschlüsse stehen in
eigenen Sammlungen derselben Datei.  
`proceedings.json` enthält Gesetzgebungs-, Vertrags-, Gerichts- und Umsetzungsverfahren.  
`open-questions.json` enthält konkrete, noch ungeklärte Klärungsaufträge.  
`conversation-candidates.json` enthält noch nicht hinreichend bestätigtes Gesprächswissen.  
`entities/` enthält Personen, Institutionen, Parteien und Gebiete.  
`generated/` enthält ausschließlich automatisch erzeugte Dateien.

## Statuswerte

| Status | Bedeutung |
| --- | --- |
| `confirmed-primary` | durch Primärquelle oder verkündete Norm belegt |
| `confirmed-official` | durch datierte amtliche Simulationsquelle belegt |
| `editorially-confirmed` | durch verbindliche redaktionelle Festlegung bestätigt |
| `derived` | aus mehreren Quellen nachvollziehbar abgeleitet |
| `planned` | politisch geplant oder angekündigt |
| `historical` | für einen abgeschlossenen Zeitraum belegt |
| `superseded` | durch späteren Stand überholt |
| `disputed` | Quellen widersprechen sich aktuell |
| `unverified` | noch nicht hinreichend geprüft |
| `unresolved` | konkrete offene Wirksamkeits- oder Quellenfrage |

## Zeitlogik

Jeder Eintrag besitzt `asOf`. Bekannte Gültigkeitszeiträume werden mit `validFrom` und `validTo`
gespeichert. Unbekannte Daten bleiben `null`. Ein später gespeicherter Datensatz hebt einen älteren
nicht automatisch auf. Historische Amtsbezeichnungen bleiben für historische Ereignisse erhalten.

Der redaktionelle Stichtag ist in `src/config/editorial.json` festgelegt. Ein künftiger, bereits
verkündeter Zustand kann im Hub gespeichert werden, wird aber nicht als gegenwärtig ausgegeben.

## Konflikte

Widersprüchliche Aussagen werden nicht still harmonisiert. Solange der Konflikt offen ist, bleiben
die betroffenen Aussagen über Quellenreferenzen nachvollziehbar, der Status lautet `disputed` und
`open-questions.json` enthält eine konkrete Klärungsfrage.

Nach einer fachlichen Auflösung werden aktive Konfliktmarker und offene Fragen entfernt. Eine
Auflösungsentscheidung bleibt nur dann als dauerhafte technische Provenienz erhalten, wenn sie für
die heutige Datenableitung weiterhin benötigt wird. Eine bloße Historie bereits beseitigter
Konflikte gehört nicht in Audit-, Gap- oder Statusdokumente.

## Generierung und Validierung

```sh
npm run knowledge:check
npm run knowledge:build
```

`knowledge:build` erzeugt deterministisch:

```text
knowledge/generated/LLM_CONTEXT.md
knowledge/generated/INDEX.json
```

Zusätzlich erzeugt der Build aus `holding-positions.json` die öffentliche, strikt feldbegrenzte
Projektion `content/regierung/beteiligungsinventar.json`. Sie enthält keine Quellen-IDs,
Fundstellen, Dateipfade, Vertrauenswerte oder internen Notizen und bildet die Datengrundlage für
den Beteiligungsnavigator sowie dessen CSV- und JSON-Download. Die Projektion wird nicht manuell
gepflegt; `npm run holdings:check` prüft ihre Aktualität und Feldfreigabe.

`knowledge:check` prüft JSON, IDs, Quellen, Pfade, Datumswerte, Statuswerte, Verweise,
Rollenintervalle, den Ausschluss ungeprüfter Gesprächsfakten aus dem aktuellen Stand und die
Übereinstimmung der generierten Dateien.

Generierte Dateien werden nicht manuell bearbeitet.

## Pflegeablauf

1. Neue Primärquelle einpflegen.
2. Bestehende strukturierte Inhalte aktualisieren.
3. Betroffene Wissenseinträge aktualisieren.
4. Timeline-Ereignis ergänzen, wenn das Ereignis selbst dauerhaft relevant ist.
5. Offene Frage schließen oder aktualisieren; gelöste Fragen nicht als erledigte Einträge behalten.
6. `npm run knowledge:check` ausführen.
7. `npm run knowledge:build` ausführen.
8. Bestehende Content-, TypeScript- und Buildprüfungen ausführen.

## Quellenpflicht

Bestätigte Fakten benötigen mindestens eine `sourceRef`. Reine Gesprächsquellen dürfen nicht in
`current-state.json` stehen. Eindeutige EAG-Ausspielungen sind nach vollständiger Kontextprüfung
kanonische Simulationsquellen; bloße Regierungsanfragen und ungeklärte Chatbeiträge bleiben
Gesprächskandidaten. Anhänge werden visuell gelesen und mit Message-ID sowie Dateiname lokalisiert.
Externe Wikiangaben werden nur mit konkreter Miraheze-Seite oder Revision und nach Quellenabgleich
übernommen.
