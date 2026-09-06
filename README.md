# Staatsrat des Ostdeutschen Freistaates

Website des fiktiven Staatsrates des Ostdeutschen Freistaates: Staatsportal, eigenständiges
Rechtsportal OstRecht, Presse, Haushalt und Service.

Das Projekt ist eine politische Simulation und stellt keine echte amtliche Veröffentlichung dar.
Der entsprechende Hinweis erscheint in der oberen Hinweisleiste, im Footer und ausführlich im
Impressum.

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
  unveränderliches Archiv amtlicher Rohquellen. Das Staatsportal liest nur `content/`.
- Git bleibt der fachliche Source of Truth; D1 und R2 sind keine Inhaltsquellen.

Der redaktionelle Stichtag steht ausschließlich in `packages/shared/src/config/editorial.json`.

## Entwicklung

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

## Wichtige Verzeichnisse

```text
apps/portal/     Staatsportal (Astro, Wrangler, Pages, Layout, Portalcode)
apps/recht/      OstRecht (Astro, Wrangler, Pages, Layout, Normkomponenten, D1-Laufzeit)
packages/        shared (gemeinsame Bausteine und Fachlogik), recht-search (Suche)
content/         kanonische öffentliche Inhalte (Normen, Verkündungen, Themen, Presse, Organisation …)
knowledge/       interner Wissenshub (nicht öffentlich ausgeliefert)
Gesetze/         amtliche und redaktionell geprüfte Rechtsquellen (HTML, PDF, Legacy-Markdown)
data/            fachliche Datenbestände: D1-Schema, Konsolidierung, REVOSax-Manifeste, Audits, Fixture
context/         historische Ausgangstexte, Entwürfe, Programme und Simulationsmaterial
public/          gemeinsame Assets (Rechts-PDFs, Kartendaten, Bilder)
docs/            Runbooks für Betrieb, Normworkflow, REVOSax-Import und Kreisreform-Karte
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
`content/organisation/` abgeleitet.

Normen liegen unter `content/normen/[slug]/` (`meta.json`, `history.json`, `versions/*.json`),
Verkündungen unter `content/verkuendungen/[slug].json`, das redaktionelle Stichwortregister des
alphabetischen Zugangs `/a-z/` unter `content/stichwortregister.json`. Historische Fassungen sind gespeicherte,
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

## Qualitätssicherung und Veröffentlichung

Pull Requests laufen gegen das synthetische Testfixture (`data/recht/runtime-fixture.json`,
Bestand aus `tests/helpers/fixture-corpus.ts`; redaktionelle Änderungen unter `content/` verändern
weder Seed noch Screenshot-Baselines); der vollständige Rechtsbestand wird als gecachter D1-Seed nur dann geprüft, wenn eine Änderung
Laufzeit, Projektion oder den Bestand in größerem Umfang berührt, sowie wöchentlich und manuell.
Ob eine Datei die D1-Projektion betrifft, bestimmt der Code-Abschluss des Syncs, nicht ihr
Verzeichnis; ändert sich die Projektionslogik, ersetzt ein vollständiger Vergleich von Basis- und
Zielprojektion die Annahme (`docs/REVOSAX_BULK_IMPORT.md`). Die Screenshot-Suite läuft bei
Oberflächenänderungen im Playwright-Container gegen das Testfixture und vergleicht strikt mit den
committeten Linux-Baselines – in Pull Requests die kritische Auswahl, auf `main` die breite
Inventur; sie ist kein Deployment-Gate (`docs/DEPLOYMENT_RUNBOOK.md`). Veröffentlicht wird
ausschließlich über den Workflow `Deploy to Cloudflare Workers` aus dem geprüften Commit auf
`main`.

## Dokumentation

| Dokument | Maßgeblich für |
| --- | --- |
| `README.md` | Einstieg, Struktur, wichtigste Befehle |
| `AGENTS.md` | Arbeits- und Redaktionsregeln für Menschen und Agenten |
| `CONTENT.md` | Inhaltsformate und Pflegewege unter `content/` |
| `CONTENT_GAPS.md` | tatsächlich offene Quellenlücken und Quellenkonflikte |
| `TODO.md` | offene technische Arbeiten |
| `DESIGN.md` | dauerhafte Gestaltungsregeln beider Anwendungen |
| `docs/DEPLOYMENT_RUNBOOK.md` | CI/CD, Änderungsscope, D1-Seed-Cache, Deployment, Expand/Contract, Nachkontrolle |
| `docs/NORM_WORKFLOW.md` | Redaktionsworkflow für Normen und Stichtagsfortschreibung |
| `docs/REVOSAX_BULK_IMPORT.md` | REVOSax-Import, D1-Synchronisation, Budgets, Recovery |
| `docs/KREISREFORM_KARTE.md` | Kartenpipeline der Kreisreform |
| `docs/ZUARBEITSFORMULAR.md` | benötigte externe Zuarbeit (Unterlagen, Entscheidungen) |
| `knowledge/README.md` | interner Wissenshub, Quellenhierarchie in `knowledge/SOURCE_POLICY.md` |

`knowledge/generated/` und `data/recht/consolidation-report.md` werden erzeugt und nicht manuell
gepflegt. `npm run docs:check` prüft kanonische Dokumente, Links und die TODO-Hygiene.
