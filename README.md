# Staatsrat des Ostdeutschen Freistaates

Website des fiktiven Staatsrates des Ostdeutschen Freistaates: Staatsportal, eigenständiges
Rechtsportal OstRecht, Presse, Haushalt und Service.

Das Projekt ist eine politische Simulation und stellt keine echte amtliche Veröffentlichung dar.
Der entsprechende Hinweis erscheint in der oberen Hinweisleiste, im Footer und ausführlich im
Impressum.

## Lizenzen

Die Lizenz richtet sich nach dem jeweiligen Bestandteil. Eine Astro-Datei kann zum Beispiel
MIT-lizenzierten Programmcode und einen redaktionellen Text unter CC BY-NC 4.0 enthalten.

| Bestandteil | Bedingungen für die Nachnutzung |
| --- | --- |
| Eigener Programmcode der Portale, Importwerkzeuge und Tests | [MIT](LICENSE). Der Code darf auch kommerziell genutzt und bearbeitet werden. Bei Weitergabe sind Copyright- und Lizenzvermerk beizubehalten. |
| Eigene redaktionelle Texte, Dokumentation und selbst verfasste Simulationsnormen | [CC BY-NC 4.0](LICENSES/CC-BY-NC-4.0.txt), soweit die Mitwirkenden über die Rechte verfügen. Teilen und Bearbeiten sind für nichtkommerzielle Zwecke erlaubt. Angegebene Urheber:innen und Quelle nennen, auf die Lizenz verweisen und Änderungen kenntlich machen. [Deutscher Lizenzvertrag](https://creativecommons.org/licenses/by-nc/4.0/legalcode.de). |
| Übernommene und konsolidierte Vorschriften | Bei gemischten Fassungen erfasst CC BY-NC 4.0 nur die eigenen geschützten Textbeiträge. Für echte amtliche Gesetzes- und Verordnungstexte gilt [§ 5 Abs. 1 UrhG](https://www.gesetze-im-internet.de/urhg/__5.html). Ihr Wortlaut darf auch kommerziell genutzt werden. |
| Karten und Schriften | Die historischen VG250-Vergleichsdaten des BKG stehen unter [Datenlizenz Deutschland – Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0). Der [Quellennachweis](public/data/kreisreform/quellennachweis-vg250.txt) nennt die bearbeiteten Ebenen. Für die Hintergrundkarte gelten die [OpenStreetMap-Hinweise](https://www.openstreetmap.org/copyright). Jost, Source Serif 4 und Ost Grotesk haben [eigene Schriftlizenzen](packages/shared/src/assets/fonts/README.md). |

[REVOSax](https://www.revosax.sachsen.de/hilfe) stellt konsolidiertes sächsisches Landesrecht
bereit. Weder die Hilfe noch das [Impressum von REVOSax](https://www.revosax.sachsen.de/impressum)
weisen eine pauschale Nachnutzungslizenz für die gesamte Sammlung aus. Für andere amtliche
Werke, die unter § 5 Abs. 2 UrhG fallen, gelten die dort genannten Vorgaben zu Änderungen
und Quellenangaben. Bei HTML-Snapshots, Original-PDFs, Anlagen und redaktionellen Zusätzen
sind die Rechte an der jeweiligen Quelle zu beachten. Das gilt auch für importierte
Haushaltsunterlagen und Material in `context/`. Für
Abbildungen, Wappen, Logos und Wettbewerbseinreichungen gelten die Nutzungsrechte am jeweiligen
Werk. Gesetzlich erlaubte Nutzungen und bereits erteilte Nutzungsrechte bleiben unberührt.

## Architektur

Ein npm-Workspace-Monorepo mit einem gemeinsamen Daten- und Wissensbestand und zwei öffentlichen
Anwendungen:

- Staatsportal: `https://freistaat-ostdeutschland.de` (`@ostrecht/portal`, `apps/portal/`)
- Rechtsportal OstRecht: `https://recht.freistaat-ostdeutschland.de` (`@ostrecht/recht`, `apps/recht/`)

Gemeinsam genutzt werden `@ostrecht/shared` (`packages/shared/`: Komponenten, Konfiguration,
Styles, Typen, Portal- und Normlogik) und `@ostrecht/recht-search` (`packages/recht-search/`:
Suchlogik von OstRecht). Die Root-`package.json` orchestriert Entwicklung, Prüfung, Build und
Deployment; ein zusätzlicher Monorepo-Orchestrator wird nicht verwendet.

Technischer Kern:

- Astro und TypeScript, Cloudflare Workers als Zielplattform
- dateibasierte Inhalte unter `content/`, normalisierte Regierungsorganisation unter
  `content/organisation/`, interner Wissenshub unter `knowledge/`
- Cloudflare D1 (`ostrecht-recht`) als abgeleitete Laufzeitdatenbank von OstRecht, projiziert aus
  `content/normen` und `content/verkuendungen`; Cloudflare R2 (`ostrecht-recht-quellen`) als
  unveränderliches Archiv amtlicher Rohquellen. Das Staatsportal liest `content/` und den
  versionierten Haushaltssnapshot unter `data/haushalt/` (`docs/HAUSHALT.md`).
- Git bleibt der fachliche Source of Truth; D1 und R2 sind keine Inhaltsquellen.

Der redaktionelle Stichtag steht ausschließlich in `packages/shared/src/config/editorial.json`.

## Entwicklung

`mise install` richtet die in [mise.toml](mise.toml) festgelegte Node-Version ein.
Danach installiert `npm ci` die Workspace-Abhängigkeiten. Mit `mise run dev`,
`mise run dev:recht`, `mise run check`, `mise run test` und `mise run build` stehen die
npm-Aufrufe auch als Tasks bereit. Die regulären CI-Jobs lesen dieselbe Node-Version.
Die folgenden Befehle laufen auch direkt mit npm.

```sh
npm ci
npm run dev            # Staatsportal
npm run dev:recht      # OstRecht
npm run content:check
npm run knowledge:check
npm run knowledge:build
npm run check
npm run test:fast      # schnelle Unit-Tests (Sekunden)
npm run test:pr        # was ein normaler PR lokal vorab prüft: Typen, Unit-Tests, ein Build, Links, SEO, Smokes, kritische Screenshots
npm run test:full      # bewusst vollständig: zusätzlich Content-Audits, Korpus-Tests, breite Screenshot-Inventur
npm run build
npm run links:check
npm run seo:check
npm run test:a11y
npm run test:browsers
npm run test:visual
```

`PORTAL_SITE_URL` und `LAW_SITE_URL` steuern die beiden Origins. `npm run build:portal` schreibt
nach `apps/portal/dist/`, `npm run build:recht` nach `apps/recht/dist/`. Die gemeinsame Assetquelle
`public/` wird vor dem Build durch `scripts/prepare-site-public.mjs` je Anwendung aufgeteilt.

OstRecht lokal mit Rechtsdaten: `npm run test:a11y` und `npm run test:browsers` starten den gebauten
Worker über `scripts/serve-law-worker.mjs` mit einer lokalen Miniflare-D1. Der Seed dafür ist ein
portabler SQLite-Snapshot (`npm run norms:runtime:d1-seed`, Fixture über
`OSTRECHT_D1_FIXTURE=data/recht/runtime-fixture.json` – ein synthetischer Bestand aus
`tests/helpers/fixture-corpus.ts`, kein Auszug aus `content/`); `npm run norms:runtime:d1-seed-fingerprint`
liefert den deterministischen Seed-Fingerabdruck. Die produktive Datenbank wird dabei nie berührt.

Für die Redaktion erschließt die [Änderungsfolgenanalyse](docs/EINPFLEGE_PLAYBOOK.md)
betroffene Fassungen, Verfahren und Themen. Die [lokale Quellenprüfung](docs/NORM_WORKFLOW.md)
stellt den strukturierten Import neben das amtliche PDF. Agenten finden die lesende CLI und
die Konfiguration des lokalen MCP-Servers im [Wissenshub](knowledge/README.md).

Der [technische Datenfluss](docs/architektur/datenfluss.d2) lässt sich mit
`mise run docs:diagram` als SVG unter `.cache/docs/datenfluss.svg` erzeugen.
Mit D2 0.9.0 im Suchpfad steht dafür auch `npm run docs:diagram` zur Verfügung.

## Wichtige Verzeichnisse

```text
apps/portal/     Staatsportal (Astro, Wrangler, Pages, Layout, Portalcode)
apps/recht/      OstRecht (Astro, Wrangler, Pages, Layout, Normkomponenten, D1-Laufzeit)
packages/        shared (gemeinsame Bausteine und Fachlogik), recht-search (Suche)
content/         kanonische öffentliche Inhalte (Normen, Verkündungen, Themen, Presse, Organisation …)
knowledge/       interner Wissenshub (nicht öffentlich ausgeliefert)
Gesetze/         amtliche und redaktionell geprüfte Rechtsquellen (HTML, PDF, Legacy-Markdown)
data/            fachliche Datenbestände: D1-Schema, Konsolidierung, REVOSax-Manifeste, Audits, Fixture, Haushaltssnapshots
context/         historische Ausgangstexte, Entwürfe, Programme und Simulationsmaterial
public/          gemeinsame Assets (Rechts-PDFs, Kartendaten, Bilder)
docs/            Runbooks für Betrieb, Normworkflow, REVOSax-Import, Haushalt und Kreisreform-Karte
scripts/         repo-weite Import-, Build-, Seed- und Prüfwerkzeuge
tests/           schnelle Unit-Tests auf synthetischen Fixtures, tests/corpus/ (Projektionsnachweis, Seed), Browser-, Accessibility- und Screenshot-Tests
```

## Inhalte und Recht

Welche Seiten das Staatsportal öffentlich hat, steht genau einmal im Portalinventar
(`apps/portal/src/lib/route-inventory.ts`): `sitemap.xml`, die Serviceübersicht unter
`/service/uebersicht/` und der Suchindex leiten sich daraus ab. Die Portalsuche lädt
`/search-index.json` mit den Portalinhalten sofort und `/search-index-recht.json` mit den
Bezeichnungen des Rechtsbestands erst, wenn der Bereichsfilter das Recht einschließt.

Öffentliche Inhalte werden über validierte JSON-Dateien unter `content/` gepflegt; Formate und
Pflegewege stehen in `CONTENT.md`. Ämter, Mitgliedschaften und Ressortleitungen werden nur aus
`content/organisation/` abgeleitet. „Staat & Behörden“ erschließt politische Leitung,
Staatssekretariate, Personen und Archiv. Unter „Freistaat“ führt die Gebietssuche unmittelbar zur
Kreisreform. „Politik & Vorhaben“ verbindet Themen, Reformdossiers und Regierungsprogramm.
Die Seitentypen, Statusangaben und Quellen für konkrete Auswirkungen sind in
[CONTENT.md](CONTENT.md#themenseiten) beschrieben.

Normen liegen unter `content/normen/[slug]/` (`meta.json`, `history.json`, `versions/*.json`),
Verkündungen unter `content/verkuendungen/[slug].json`, das redaktionelle Stichwortregister des
alphabetischen Zugangs `/a-z/stichwortregister/` unter `content/stichwortregister.json`. Historische Fassungen sind gespeicherte,
unveränderliche Fassungen. Reguläre Importquellen sind die HTML-Dateien unter `Gesetze/`; PDFs
dienen der visuellen Gegenprüfung. Für übernommene Stammnormen ist der sächsische Rechtsstand am
1. November 2023 die Ausgangsfassung; Folgefassungen entstehen nur über geprüfte Patch-Rezepte.

```sh
npm run norms:workflow -- --file "Gesetze/…html" --write   # kanonischer Import- und QA-Ablauf
npm run norms:audit
npm run norms:consolidation:audit
npm run norms:metadata:audit
npm run norms:advance-reference-date -- --to <Datum> --write
```

Haushaltsdaten kommen aus dem Haushaltsrepo und werden nur als geprüfter Snapshot übernommen
(`docs/HAUSHALT.md`):

```sh
npm run haushalt:sync -- --source <pfad zum Haushaltsrepo>   # Snapshot data/haushalt/<periode>/
npm run haushalt:check                                      # Snapshot, Register und Overlays (Teil von content:check)
```

## Qualitätssicherung und Veröffentlichung

Pull Requests laufen gegen das synthetische Testfixture (`data/recht/runtime-fixture.json`,
Bestand aus `tests/helpers/fixture-corpus.ts`; redaktionelle Änderungen unter `content/` verändern
weder Seed noch Screenshot-Baselines); der vollständige Rechtsbestand wird als gecachter D1-Seed nur dann geprüft, wenn eine Änderung
Laufzeit, Projektion oder den Bestand in größerem Umfang berührt, sowie wöchentlich und manuell.
Ob eine Datei die D1-Projektion betrifft, bestimmt der Code-Abschluss des Syncs, nicht ihr
Verzeichnis; ändert sich die Projektionslogik, ersetzt ein vollständiger Vergleich von Basis- und
Zielprojektion die Annahme (`docs/REVOSAX_BULK_IMPORT.md`). Die Screenshot-Suite läuft bei
Oberflächenänderungen im Playwright-Container gegen das Testfixture und vergleicht strikt mit den
committeten Linux-Baselines. Pull Requests prüfen die kritische Auswahl. Die breite Inventur
läuft wöchentlich und manuell. Der Release-Workflow auf `main` kann bestandene Quellprüfungen
für denselben Git-Baum und Änderungsumfang übernehmen. Produktionsbuild, Laufzeittests und
Veröffentlichungsnachweise entstehen im Release-Lauf. Die Zuordnung und der Wiederanlauf
sind im [Betriebsrunbook](docs/DEPLOYMENT_RUNBOOK.md) beschrieben.

## Mitwirken und Meldungen

Die [Beitragsanleitung](CONTRIBUTING.md) beschreibt den Einstieg und passende Prüfungen.
Für Fehler, Inhaltskorrekturen und Vorschläge gibt es
[Issue-Vorlagen](https://github.com/XYungeloest/staatsregierung/issues/new/choose).
[SUPPORT.md](SUPPORT.md) ordnet Fragen und Meldewege ein; für den Umgang miteinander gilt der
[Verhaltenskodex](CODE_OF_CONDUCT.md). Sicherheitslücken bitte vertraulich gemäß
[SECURITY.md](SECURITY.md) melden.

## Dokumentation

| Dokument | Maßgeblich für |
| --- | --- |
| `README.md` | Einstieg, Struktur, wichtigste Befehle |
| `AGENTS.md` | Arbeits- und Redaktionsregeln für Menschen und Agenten |
| `CONTENT.md` | Inhaltsformate und Pflegewege unter `content/` |
| `CONTENT_GAPS.md` | tatsächlich offene Quellenlücken und belegte Redaktionsentscheidungen zu Quellkonflikten |
| `TODO.md` | offene technische Arbeiten |
| `DESIGN.md` | dauerhafte Gestaltungsregeln beider Anwendungen |
| `docs/EINPFLEGE_PLAYBOOK.md` | vollständiger Eingangsablauf „`temp-neu` einpflegen“ für alle Inhaltsarten |
| `docs/DEPLOYMENT_RUNBOOK.md` | CI/CD, Änderungsscope, D1-Seed-Cache, Deployment, Expand/Contract, Nachkontrolle |
| `docs/NORM_WORKFLOW.md` | Redaktionsworkflow für Normen und Stichtagsfortschreibung |
| `docs/REVOSAX_BULK_IMPORT.md` | REVOSax-Import, D1-Synchronisation, Budgets, Recovery |
| `docs/HAUSHALT.md` | Haushaltsinformationssystem: Import, Freigabe, Overlays, Ausgabedateien, Tests |
| `docs/KREISREFORM_KARTE.md` | Kartenpipeline der Kreisreform |
| `docs/ZUARBEITSFORMULAR.md` | benötigte externe Zuarbeit (Unterlagen, Entscheidungen) |
| `knowledge/README.md` | interner Wissenshub, Quellenhierarchie in `knowledge/SOURCE_POLICY.md` |

`knowledge/generated/` und `data/recht/consolidation-report.md` werden erzeugt und nicht manuell
gepflegt. `npm run docs:check` prüft kanonische Dokumente, Links und die TODO-Hygiene.

Der lokale Teilnahme- und Redaktionsweg für den Maskottchenwettbewerb steht in [docs/FRESSWUERFEL.md](docs/FRESSWUERFEL.md).
