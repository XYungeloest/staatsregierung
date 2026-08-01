# AGENTS.md

## Grundregel

Dieses Repository ist das Portal des fiktiven Staatsrates mit integriertem Rechtsbereich. Die öffentliche Website soll wie eine sachliche staatliche Website wirken, nicht wie eine Entwicklerdemo.

Prioritäten:

1. Öffentliches Portal behördennah, ruhig und verständlich halten.
2. Rechtsportal unter `/recht/` funktional erhalten.
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
- keine aktiven D1/R2-Bindings im aktuellen Portalstand
- getrenntes Editorial Worker Entry unter `src/editorial-worker/`; öffentliche Seiten bleiben statisch
- klare Utility-Funktionen statt unnötiger Klassenhierarchien
- Build- und Content-Checks vor Abschluss ausführen, sofern möglich

Wichtige Befehle:

```sh
npm run content:check
npm run knowledge:check
npm run knowledge:build
npm run check
npm run editorial:check
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
- Der redaktionelle Stichtag für aktuelle Termine, Rechtsstände, Verfahren und Stellenangebote ist der 1. August 2026. Künftige Termine stehen vor vergangenen; abgelaufene Bewerbungsfristen erscheinen nicht als aktuelle Angebote.
- Operative technische Begriffe sind in interner Doku und Code zulässig.
- Der erste Staatsrat ging am 21. Juli 2026 aus dem Kabinett Honecker II hervor. Max Peterson leitet als Staatsrat das Staatssekretariat für Wirtschaft und Arbeit.
- Thomas Henry Barlow ist seit dem 20. Juli 2026 nicht mehr aktiv. Yannik Schmäle leitet seit dem 21. Juli 2026 sowohl Nachhaltigkeit und Energie als auch Staats- und Grenzsicherheit.
- Kein neues Profil für Gerhardt Lehrmann anlegen.
- Regierungschef, Stellvertretung, Mitgliedschaft, Ämter und Ressortleitungen werden ausschließlich
  aus `content/organisation/` abgeleitet. Personen- und Ressortprofile enthalten diese Felder nicht.
- Das Studio unter `/redaktion/` schreibt nie direkt nach `main`, sondern erstellt über die GitHub
  App einen atomaren Commit und einen Draft Pull Request. D1 und R2 sind keine öffentlichen
  Inhaltsquellen.

## Rechtsportal

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
nicht heuristisch aufgelöst.

Verkündungen liegen unter:

```text
content/verkuendungen/[slug].json
```

Sie verknüpfen Fundstellen über `entries[].normSlug` und `entries[].versionId` mit gespeicherten
Normfassungen. Norm-JSONs bleiben dadurch unabhängig von später gepflegten Amtsblatt-Ausgaben.

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
- Screenshot-Baselines und Accessibility-Smoke-Tests sind Teil der Produktions-QA. Sie ergänzen
  den manuellen Tastatur- und Screenreader-Kurztest.

## Bei Unsicherheit

Den vorhandenen Code, `README.md`, `AGENTS.md`, `knowledge/` und `context/` heranziehen. Wenn mehrere Wege möglich sind, die einfache, robuste und am wenigsten invasive Lösung wählen.
