# AGENTS.md

## Grundregel

Dieses Repository enthält das Staatsportal und das eigenständige Rechtsportal des fiktiven Ostdeutschen Freistaates. Beide öffentlichen Websites sollen sachlich und staatlich wirken, nicht wie Entwicklerdemos.

Prioritäten:

1. Öffentliches Portal behördennah, ruhig und verständlich halten.
2. Eigenständiges Rechtsportal OstRecht unter `recht.freistaat-ostdeutschland.de` funktional erhalten; `/recht/` im Staatsportal bleibt die Brückenseite.
3. Inhalte möglichst dateibasiert und nachvollziehbar pflegen.
4. Cloudflare-Deploymentlogik respektieren.
5. Keine unnötige neue Architektur oder Bibliothek einführen.
6. Änderungen klein, überprüfbar und passend zum vorhandenen Stil halten.

## Dokumentationsstand

Primäre Projektdokumentation ist jetzt:

- `README.md`
- `AGENTS.md`
- `CONTENT.md`
- `DESIGN.md`
- `knowledge/README.md` für den internen Wissenshub
- der tatsächliche Code- und Content-Zustand
- `context/` als erhaltenes Ausgangs- und Simulationsmaterial

Alte Root-Spezifikationen und Zwischenpläne sind nicht mehr kanonisch.

## Interner Wissenshub

`knowledge/` erschließt den politischen, institutionellen und zeitlichen Zusammenhang der vorhandenen Quellen. Der Hub ist interne Repositorydokumentation und darf nicht über Astro-Routen öffentlich ausgeliefert werden. Er ersetzt weder `content/` noch `Gesetze/` oder das Rechtsportal.

Bestätigte Wissenseinträge benötigen konkrete Quellenreferenzen und, soweit bekannt, Gültigkeitszeiträume. Gesprächswissen bleibt bis zur Prüfung ausschließlich in `knowledge/conversation-candidates.json`. Alte Wiki- und Kontextdateien dürfen nicht ungeprüft als aktueller Stand übernommen werden. Als externe Wikiquelle ist ausschließlich `https://politiksim.miraheze.org/wiki/` zulässig.

Nach Änderungen am Wissenshub ausführen:

```sh
npm run knowledge:check
npm run knowledge:build
npm run knowledge:check
```

Generierte Dateien unter `knowledge/generated/` werden nicht manuell gepflegt.

## Arbeitsweise

- Bei Review- oder Planungsfragen zuerst den tatsächlichen Repo-Zustand lesen.
- Ist-Zustand und gewünschte Weiterentwicklung klar trennen.
- Bei Strukturfragen konservativ an bestehenden Routen, Komponenten und Content-Modellen orientieren.
- Keine großen Refactorings starten, wenn eine direkte, robuste Änderung reicht.
- Nicht verwandte Änderungen im Working Tree nicht zurücksetzen.
- Neue zentrale Entscheidungen knapp in `README.md` oder hier dokumentieren.

## Technik

- Astro
- TypeScript
- Cloudflare Workers
- ein Repository, ein gemeinsamer Daten- und Wissensbestand, zwei öffentliche Anwendungen
- Staatsportal: `freistaat-ostdeutschland.de`, Build `npm run build:portal`, Worker `ostrecht-portal`
- Rechtsportal: `recht.freistaat-ostdeutschland.de`, Build `npm run build:recht`, Worker `ostrecht-recht`
- öffentliche Rechtsrouten liegen auf der Rechtsdomain ohne zusätzliches `/recht/`-Präfix
- Cross-Site-Links werden über `packages/shared/src/lib/portal/routes.ts` und `packages/shared/src/lib/norms/routes.ts` erzeugt; die Origins stammen aus `PORTAL_SITE_URL` und `LAW_SITE_URL`
- OstRecht liest Rechtsdaten zur Laufzeit aus Cloudflare D1 (`ostrecht_recht`, Projektion aus `content/` per `npm run norms:runtime:d1-sync`); R2 (`ostrecht_recht_quellen`) archiviert nur unveränderte Rohquellen; das Staatsportal hat keine D1/R2-Bindings
- klare Utility-Funktionen statt unnötiger Klassenhierarchien
- Build- und Content-Checks vor Abschluss ausführen, sofern möglich

### Workspace-Struktur

- `apps/portal/`: eigenständige Astro-Anwendung des Staatsportals mit app-lokaler Astro- und
  Wrangler-Konfiguration; Buildausgabe unter `apps/portal/dist/`
- `apps/recht/`: eigenständige Astro-Anwendung von OstRecht mit app-lokaler Astro- und
  Wrangler-Konfiguration; Buildausgabe unter `apps/recht/dist/`
- `packages/shared/`: tatsächlich von mehreren Anwendungen verwendete Komponenten,
  Konfigurationen, Styles, Typen sowie Portal- und Normlogik
- `Gesetze/`, `content/`, `knowledge/`, `data/`, `context/` und `docs/`: gemeinsame kanonische
  Root-Bestände; nicht in einzelne Workspaces verschieben
- `scripts/` und `tests/`: repo-weite Werkzeuge und Prüfungen im Root

Dependencies werden im jeweils nutzenden Workspace deklariert. Die Root-Kommandos bleiben die
öffentliche Bedienoberfläche und leiten bei Bedarf an die Workspaces weiter. Die gemeinsame
`public/`-Quelle wird buildzeitlich nach `apps/portal/.site-public/` beziehungsweise
`apps/recht/.site-public/` aufgeteilt; diese Verzeichnisse sowie die app-lokalen `dist/`- und
`.astro/`-Verzeichnisse sind generiert.

Wichtige Befehle:

```sh
npm run content:check
npm run knowledge:check
npm run knowledge:build
npm run check
npm run build
npm run links:check
npm run test:visual
npm run test:a11y
```

## Inhalt und Redaktion

- Deutschsprachige Inhalte mit echten Umlauten.
- Öffentliche Seiten verwenden nutzerorientierte Sprache.
- Architekturbegriffe wie D1, R2, Build, Repository, Fallback, Live-Override oder serverseitige Formularlogik gehören nicht in öffentliche Bürgertexte.
- Öffentliche Texte erklären weder Gestaltung noch Umsetzung der Website. Formulierungen über Platzhalter, Designabsichten, technische Zustände oder die eigene Seitenstruktur vermeiden.
- Geschlechtergerechte Personenbezeichnungen einheitlich mit Doppelpunkt schreiben, zum Beispiel `Bürger:innen` oder `Referent:in`. Keine Paarformen, Sterne, Binnen-I oder Unterstriche verwenden.
- Der Hinweis auf die politische Simulation bleibt sichtbar in der oberen Hinweisleiste und im Footer. Außerhalb dieser festen Hinweise bleiben öffentliche Texte frei von Wiederholungen; das Impressum enthält die erforderliche ausführliche Einordnung des fiktiven Internetangebots.
- Der redaktionelle Stichtag für aktuelle Termine, Rechtsstände, Verfahren und Stellenangebote wird ausschließlich aus `packages/shared/src/config/editorial.json` gelesen. Künftige Termine stehen vor vergangenen; abgelaufene Bewerbungsfristen erscheinen nicht als aktuelle Angebote.
- Operative technische Begriffe sind in interner Doku und Code zulässig.
- Der erste Staatsrat ging am 21. Juli 2026 aus dem Kabinett Honecker II hervor. Max Peterson leitet als Staatsrat das Staatssekretariat für Wirtschaft und Arbeit.
- Thomas Henry Barlow ist seit dem 20. Juli 2026 nicht mehr aktiv. Yannik Schmäle leitet seit dem 21. Juli 2026 sowohl Nachhaltigkeit und Energie als auch Staats- und Grenzsicherheit.
- Kein neues Profil für Gerhardt Lehrmann anlegen.
- Regierungschef, Stellvertretung, Mitgliedschaft, Ämter und Ressortleitungen werden ausschließlich
  aus `content/organisation/` abgeleitet. Personen- und Ressortprofile enthalten diese Felder nicht.
- Änderungen an kanonischen Inhalten erfolgen über geprüfte Branches und Pull Requests. D1 und R2
  sind keine öffentlichen Inhaltsquellen.

## Rechtsportal

Das Rechtsportal ist eine getrennte öffentliche Astro-Anwendung mit `LawLayout.astro` und den
Seiteneinstiegen unter `apps/recht/src/pages/`. Es liest denselben kanonischen Bestand wie das Staatsportal.
Alte Detailadressen unter `/recht/...` werden permanent auf die Rechts-Origin weitergeleitet;
`/recht/` selbst bleibt im Staatsportal eine inhaltliche Brückenseite. Ein Domainwechsel darf keine
Migration der Normdaten oder des Wissenshubs erfordern.

Normen liegen unter:

```text
content/normen/[slug]/
  meta.json
  history.json
  versions/[versionId].json
```

Historische Fassungen sind gespeicherte Fassungen, keine automatisch berechneten Konsolidierungen.
Die öffentliche Fassungsart wird zentral aus Gültigkeitsintervall und redaktionellem Stichtag
ermittelt. `isCurrent` ist nur ein kompatibles Bestandsfeld. Allgemeine Normlinks bleiben dynamisch;
versionsspezifische Links bleiben unveränderlich. PDF- und Anlagenlinks dürfen nur aus belegten
Quellenfeldern entstehen.

Die versionierten HTML-Quellen unter `Gesetze/` sind die regulären Normimportquellen. Ist dieselbe
Ausgabe intern als HTML erkennbar, öffnet der Importer den gleichartigen Markdown-Altbestand nicht.
Nur für Quellen ohne HTML darf der getrennte Legacy-Markdown-Parser gezielt eingesetzt werden; die
Quelle wird dann ausdrücklich als `legacy-markdown-transcription` dokumentiert. Der Import läuft
ohne Schreibflag nur als Audit, schreibt ausschließlich gezielt ausgewählte Quellen und darf
vorhandene Normordner nicht pauschal löschen. Quell-HTML wird nie direkt öffentlich gerendert;
veröffentlicht werden nur validierte strukturierte Normdaten. PDFs dienen bei Altquellen der
visuellen Gegenprüfung, nicht als automatisch importierter Volltext. Soweit eine passende PDF
vorliegt, ist sie auch bei HTML-Quellen zur Kontrolle von Gliederung, Einrückung, Nummerierungsfolge,
Listenfortsetzungen, zitierten Neufassungen, Tabellen und Anlagen heranzuziehen. Fehlende PDFs und
nicht eindeutig auflösbare Strukturkonflikte werden in `CONTENT_GAPS.md` dokumentiert; mehrdeutige
Fälle dürfen im strikten Audit nicht still als geprüft gelten.

Für ausdrücklich geänderte übernommene Stammnormen ist der sächsische Rechtsstand am
1. November 2023 der verbindliche Ausgangspunkt. Amtliche historische REVOSax-Seiten werden nur
über den ausdrücklichen Fetch-Befehl abgerufen und unverändert samt SHA-256 versioniert. Eine
Folgefassung darf nur aus einem redaktionell geprüften Patch-Rezept mit eindeutigem Zielanker,
erwartetem Alttext oder Hash, Trefferzahl, Änderungsquelle und Wirksamkeitsdatum entstehen.
Ein späterer sächsischer Zwischenstand darf nur übernommen werden, wenn ihn eine ostdeutsche
Änderungsvorschrift wörtlich als Ausgangsfassung bezeichnet; der Adoptionsbeleg wird mit dem
zusätzlichen Snapshot gespeichert. Gleichzeitige Änderungen brauchen eine explizite Reihenfolge
und führen zu einer gemeinsamen Folgefassung mit getrennten Historieneinträgen.
Konsolidierung und Build bleiben offline. Quellkonflikte erhalten einen Sperrstatus; sie werden
nicht heuristisch aufgelöst. Die Konsolidierung wendet Patch-Rezepte auf den unveränderten
sächsischen Ausgangstext an und leitet erst das Ergebnis mit dem Rechtsüberleitungsadapter über;
`npm run norms:ost:residual-audit` verlangt 0 Reststellen im übergeleiteten Recht und lässt
Sachsen-Bezüge in eigenen ostdeutschen Erlassen nur zu, wenn sie wörtlich in der amtlichen Quelle
unter `Gesetze/` stehen oder eine an den PDF-Hash gebundene Prüfung in
`data/recht/ost-residual-backlog.json` dokumentiert ist.

Mantelbestandteile aus REVOSax werden zweistufig zugeordnet: fail-closed heuristisch
(`scripts/classify-revosax-envelopes.mjs`) und über geprüfte Entscheidungen in
`data/recht/revosax-envelope-decisions.json` (`scripts/resolve-revosax-envelope-defers.mjs`;
jede Entscheidung nennt Zielgesetz, Fundstelle, Beleg und Methode und wird gegen den Artikeltext
verifiziert). Kein blindes Mapping.

D1 ist die Runtime-Projektion (Schema `data/recht/d1/`, Sync `scripts/sync-recht-d1.mjs`):
Löschungen laufen nur über Indizes (nie ein Vollscan des FTS5-Index), die Vollprojektion ist ein
bewusster Sondermodus mit einmaligem Reset, der Projektionsfingerabdruck macht einen Sync bei
unverändertem Stand zum No-op, Kostenzähler und `--max-rows-read`/`--max-rows-written` sind
Pflicht bei Remote-Läufen. Kein produktiver `--full`-Sync ohne zwingenden Grund; Lasttests nur
lokal oder gegen `ostrecht-recht-staging`; Migrationen lokal → Staging → Produktion, nie
automatisch. Die OstRecht-Laufzeit lädt nie den vollständigen Korpus: Übersichten lesen
`NormSummary`-Zeilen mit SQL-Filtern, korpusweite Zahlen kommen aus vorberechneten
Metadatenzeilen. Pull-Request-Smoke läuft gegen `data/recht/runtime-fixture.json`; der Vollbestand
ist Release-Gate und manueller Lauf.

Verkündungen liegen unter:

```text
content/verkuendungen/[slug].json
```

Sie verknüpfen Fundstellen über `entries[].normSlug` und `entries[].versionId` mit gespeicherten
Normfassungen. Norm-JSONs bleiben dadurch unabhängig von später gepflegten Amtsblatt-Ausgaben.

## Eingang aus `temp-neu/`

Die kurze Arbeitsanweisung „`temp-neu` einpflegen“ bezeichnet den vollständigen redaktionellen
Eingangsablauf. Dazu gehören ohne weitere Einzelerklärung: Dateien inventarisieren, HTML und PDF
gegeneinander prüfen, amtliche Quellen nach `Gesetze/` und öffentliche PDFs nach
`public/assets/recht/` übernehmen, Normen und Verkündungen gezielt importieren, mitgelieferte
Pressemitteilungen in `content/presse/mitteilungen/` übertragen, belastbare Bilder unter
`public/images/` ablegen, Beziehungen zu Normen, Themen und Pressemitteilungen pflegen sowie
betroffene Gegenwartsstände und den redaktionellen Stichtag aktualisieren. Anschließend sind
für jede übernommene Normquelle der kanonische Ablauf aus `docs/NORM_WORKFLOW.md` mit
`npm run norms:workflow -- --file "…html" --write` auszuführen. Er verbindet den gezielten
Import, die Konsolidierungs- und Metadatenprüfungen, den Wissenshub sowie die technische
Content-, Build-, Link- und SEO-QA. Repräsentative Browser- und Accessibility-Smokes gehören
zum Release-Gate; breite Browsermatrizen und Screenshot-Vergleiche werden bei betroffenen
Designänderungen gezielt manuell ausgeführt. `--quick` ist nur für Zwischenprüfungen zulässig.
Geänderte Screenshot-Baselines werden nur nach Sichtprüfung übernommen. Widersprüchliche oder
fehlerhafte Bildmotive werden nicht als amtliche Darstellung veröffentlicht. `temp-neu/` bleibt
unverändert als Benutzereingang bestehen.

## UI-Stil

- nüchtern
- behördennah
- gut lesbar
- barrierearm
- Jost als Schrift
- ruhige Blau-Weiß-Grün-Anmutung
- Inhaltsklarheit vor Effekten
- Startseiteninhalte klar priorisieren: Einstieg, zentrale Portalpfade, aktueller Regierungsstand, Reformen, Recht sowie Presse und Service.
- Die Kreisreform ist ein zentraler Portalweg unter `/kreisreform/`, in der Hauptnavigation, auf der Startseite und in den Themen-Einstiegen sichtbar.
- Interaktive Karten, Tabellen und Filter müssen auf kleinen Bildschirmen ohne unkontrolliertes horizontales Scrollen nutzbar bleiben.
- Die Kreisreform-Suche muss ohne geöffnete Karte ein textliches Ergebnis liefern; die Karte startet
  auf kleinen Bildschirmen nur nach ausdrücklichem Öffnen.
- Statistik bleibt freiwillig: Nur notwendige Funktionen sind Standard, Webanalyse startet erst nach ausdrücklicher Zustimmung.
- Das Release-Gate verwendet repräsentative Chromium- und Accessibility-Smoke-Tests. Screenshot-
  Baselines und die breite Browsermatrix sind gezielte manuelle Design- und Kompatibilitätswerkzeuge;
  reine Pixelabweichungen blockieren kein Deployment.

## Bei Unsicherheit

Den vorhandenen Code, `README.md`, `AGENTS.md`, `knowledge/` und `context/` heranziehen. Wenn mehrere Wege möglich sind, die einfache, robuste und am wenigsten invasive Lösung wählen.
