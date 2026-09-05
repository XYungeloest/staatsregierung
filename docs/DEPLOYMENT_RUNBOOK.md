# Betriebsrunbook für Veröffentlichungen

Staatsportal und OstRecht werden ausschließlich über den Workflow `Deploy to Cloudflare Workers`
aus dem geprüften Commit auf `main` veröffentlicht. Der Workflow bestimmt aus den geänderten
Pfaden, was gebaut, geprüft und veröffentlicht wird. Ein manuelles Überschreiben eines produktiven
Workers ist kein Wiederherstellungsweg. `main` ist durch das Ruleset „main geschützt“ nur über Pull
Requests mit den Pflichtchecks `classify`, `quality`, `accessibility_smoke` und `browser_smoke`
veränderbar.

## Änderungsscope

Die zentrale Zuordnung liegt in `scripts/classify-change-scope.mjs`
(`tests/change-scope.test.mjs` dokumentiert die Fälle). Sie trennt Deploymentziele von
Verifikationsumfang; unbekannte Laufzeitpfade werden vorsorglich als `shared` behandelt. Ob eine
Datei die D1-Projektion betrifft, wird nicht aus ihrem Verzeichnis geraten, sondern aus dem
Code-Abschluss der Projektion (`scripts/lib/d1-projection-closure.mjs`, siehe
`docs/REVOSAX_BULK_IMPORT.md`): nur Dateien, die `scripts/sync-recht-d1.mjs` tatsächlich erreicht,
und das Schema zählen als Projektionscode; reine Darstellungslogik in denselben Verzeichnissen
(z. B. `norms/diff-render.ts`) ist Oberfläche. Ist der Abschluss nicht sicher bestimmbar, gilt
fail-closed die konservative Obermenge dieser Verzeichnisse.

| Scope | Typische Pfade | Produktion |
| --- | --- | --- |
| `docs-only` | Root-Dokumentation, `docs/`, interne Knowledge-Markdown-Dateien | kein Build, kein Deployment; Whitespace- und Dokumentationsstrukturprüfung |
| `ci-only` | Tests, Workflows, Validatoren, Audits, Importer, `Gesetze/`, `data/recht/`, interne Knowledge-Daten | kein Deployment; nur die angeforderten Prüfungen |
| `portal` | `apps/portal/`, portalbezogene Inhalte, Kreisreform, portalbezogene Daten | nur Staatsportal |
| `law` | `apps/recht/`, `packages/recht-*`, `public/assets/recht/` | nur OstRecht |
| `shared` | `packages/shared/`, `content/normen/`, `content/verkuendungen/`, gemeinsame Buildskripte, Root-Konfiguration, Abhängigkeiten | beide Anwendungen |

Drei weitere Flags bestimmen den Prüfumfang unabhängig vom Deploymentziel:

- **`run_full_corpus_smoke`** – der Smoke läuft gegen den gesamten Rechtsbestand statt gegen das
  Fixture, wenn die Änderung Projektionscode (Code-Abschluss des Syncs einschließlich Stichtag und
  Portalbezügen) oder das D1-Schema, die Kandidatenabfragen der Suche
  (`packages/recht-search/src/search-query.ts`), Seed- und Verifikationswerkzeuge
  (`scripts/sync-recht-d1.mjs`, `scripts/lib/d1-*`, `scripts/d1-runtime-seed.mjs`,
  `scripts/d1-projection-snapshot.mjs`, `scripts/serve-law-worker.mjs`,
  `scripts/verify-recht-d1.mjs`), den Runtime-Store und die Routen mit Datenbankzugriff
  (`apps/recht/src/lib/runtime/`, `apps/recht/src/pages/` außer Hilfe, 404 und robots), die
  OstRecht-Laufzeitkonfiguration oder `package-lock.json` berührt – oder wenn mindestens 25
  Normverzeichnisse geändert sind (`LARGE_CORPUS_CHANGE_THRESHOLD`). Ein manuelles OstRecht-Release
  prüft immer den Vollbestand. Rein visuelle Änderungen (Komponenten, Layouts, Styles,
  Browserskripte, Darstellungslogik außerhalb des Abschlusses, Hilfe- und Fehlerseite) laufen
  gegen das Fixture.
- **`run_corpus_tests`** – die Korpus-Tests (`tests/corpus/`, Vollbestand und Projektion) laufen
  nur bei Inhalts-, Projektions- oder Laufzeitänderungen, bei geänderten Abhängigkeiten und bei
  Änderungen an diesen Tests selbst; die schnellen Unit-Tests (`tests/*.test.*`) laufen bei jeder
  Codeänderung.
- **`run_visual`** – die Screenshot-Suite läuft bei Oberflächen-, Layout-, Style- und
  Portalinhaltsänderungen, nicht bei reinem Normcontent, Dokumentation oder Workflows: in Pull
  Requests die kritische Auswahl, auf `main` die breite Inventur (siehe Screenshot-Suite).

Normen und Verkündungen sind trotz des Rechtsportals `shared`, weil das Staatsportal sie für Suche,
Fundstellen und die Rechtsbrücke einliest; ihre Änderung löst kein OstRecht-Deployment aus,
sondern eine D1-Projektion. Die Buildartefakte liegen unter `apps/portal/dist/` und
`apps/recht/dist/`; sie werden einmal gebaut, als Artefakt hochgeladen und vor Smokes und
Deployment wieder unter `apps/` hergestellt.

## Regulärer Ablauf auf `main`

```text
classify ─┬─ build ───────────────┬─ runtime_smoke ─┬─ deploy
          ├─ d1_seed (Vollbestand)┼─ d1_sync ───────┘
          │                        (Cloudflare D1; bei geänderter Projektionslogik
          │                         Äquivalenznachweis statt Vollprojektion)
          └─ visual (breite Screenshot-Inventur, kein Gate)
```

1. `classify` bestimmt Deployment- und Verifikationswirkung (mit `node_modules`, weil der
   Code-Abschluss der Projektion esbuild braucht).
2. `build` stellt `node_modules` aus dem Actions-Cache her (`.github/actions/setup-node-modules`,
   Schlüssel aus Betriebssystem, Node-Version und `package-lock.json`; ohne Treffer `npm ci`), führt
   `npm audit` mit Wiederholung bei Registryfehlern aus (`scripts/npm-audit-retry.mjs`: nur
   HTTP 5xx, 429 und Netzfehler werden bis zu dreimal wiederholt; ein Befund ab Stufe `high` schlägt
   sofort fehl), prüft Dokumentationsstruktur, Inhalte, Wissenshub, Typen, schnelle Unit-Tests
   und je Scope die Korpus-Tests, baut einmal, prüft Assets, Links und SEO und lädt den Build als
   Artefakt hoch.
3. `d1_seed` läuft parallel zum Build, nur bei `run_full_corpus_smoke`: Seed-Fingerabdruck
   bestimmen, Snapshot aus dem Actions-Cache (`d1-seed-<Fingerabdruck>`) wiederherstellen und
   verifizieren; ohne Treffer genau eine Projektion, danach Snapshot im Cache speichern.
4. `runtime_smoke` lädt den Build, setzt den Seed ein (Vollbestand aus dem Cache oder Fixture; ein
   fehlender Cache-Eintrag führt zu einer Projektion als Rückfall, nie zu einem Abbruch),
   verifiziert die Projektion gegen Git (`norms:runtime:d1-verify --local --fts-integrity`) und
   führt Barrierefreiheits- und Browser-Smoke gegen denselben Worker aus.
5. `d1_sync` projiziert bei `run_d1_sync` die Rechtsdaten nach Cloudflare D1:
   `--git-diff <before> <sha> --budget incremental --recover`. Der Lauf ist ein No-op, wenn D1
   bereits die Projektionsidentität des Commits trägt; er schreibt inkrementell nur mit
   verifizierter Basis (Base-State-Guard) und fällt sonst auf eine markierte Recovery zurück. Eine
   Vollprojektion führt der automatische Sync nie aus: Entscheidung und Budgetprofil werden vor
   dem Planbau abgeglichen, ein `full`-Beschluss endet fail-closed. Verlangt er die Vollprojektion
   nur wegen geänderter Projektionslogik (Remote-State meldet Exit 3), rechnet der Job zuerst den
   Äquivalenznachweis (`npm run norms:runtime:d1-prove -- --base <before> --head <sha>`:
   Basisprojektion aus dem Seed-Cache oder aus einem Worktree des Basis-Commits, Zielprojektion
   aus dem Seed des Laufs, vollständiger Tabellenvergleich) und übergibt ihn dem Sync
   (`--equivalence-proof`): nachgewiesen gleiche Daten übernehmen nur die neue Identität und die
   Laufzeitmetadaten, ein nachgewiesener inkrementeller Umfang wird geschrieben, alles andere
   bleibt rot. Dass das auf `main` nicht eintritt, zeigt `d1_token_check` vor dem Merge (siehe
   unten). Migrationen spielt der Workflow nie ein.
6. `deploy` veröffentlicht zuerst OstRecht, danach das Staatsportal, und prüft den
   Produktionsstand (`npm run test:deployment:production`).
7. `visual` läuft bei `run_visual` im Playwright-Container gegen das Fixture und vergleicht die
   breite Inventur (`npm run test:visual:extended`, drei Viewports: 1440, 768, 390) strikt mit den
   committeten Linux-Baselines; es ist kein Deployment-Gate, ein Fehlschlag wird aber wie eine
   Regression behandelt.

Bei `docs-only` endet der Lauf nach `docs_check`, bei `ci-only` nach den angeforderten Prüfungen.
Ein manuell gestarteter Workflow bietet die Ziele `portal`, `law` und `both` und verwendet
standardmäßig `staging` (vollständige `portal_site_url` und `law_site_url` erforderlich);
`production` ist nur für eine bewusst freigegebene Veröffentlichung zu wählen. Staging von
OstRecht verwendet `npm run deploy:recht:staging` mit der fail-closed erzeugten
`wrangler.staging.json` (`scripts/write-staging-wrangler-config.mjs`).

## Pull-Request-Prüfung

`classify`, `quality` (wie `build`, mit PR-Artefakt), `accessibility_smoke` und `browser_smoke`
(zwei parallele Fixture-Jobs) sind die Pflichtchecks des Rulesets; bei `docs-only` werden sie
übersprungen und `docs_check` läuft. Zusätzlich:

- `d1_seed` und `full_corpus_smoke` bei `run_full_corpus_smoke` (Seed aus dem Cache, Verifikation,
  A11y und Browser gegen den Vollbestand);
- `visual` bei `run_visual` im Playwright-Container: die kritische Auswahl
  (`npm run test:visual:critical`, wenige Minuten);
- `d1_token_check` bei `run_d1_sync`: `--remote-state` gegen Produktion (Identität, gespeicherte
  Identität, Umfang und Entscheidung des künftigen Main-Syncs in Sekunden, kein Sync-Plan, kein
  Schreibzugriff) – grün bei No-op oder verifiziertem inkrementellem Lauf. Meldet er eine nötige
  Vollprojektion (Exit 3), rechnet der Job den Äquivalenznachweis wie `d1_sync` auf `main`
  (Basis-Seed aus dem Cache von `main`, Ziel-Seed aus `d1_seed`, sonst lokale Projektionen) und
  wiederholt den Remote-State mit dem Nachweis: grün, wenn `main` nach dem Merge nur Identität
  oder einen nachgewiesenen inkrementellen Umfang schreibt, rot mit den abweichenden Tabellen,
  wenn tatsächlich eine Vollprojektion nötig ist; dazu ein Teilsync der Verkündungen gegen
  Staging als Schreibnachweis des Tokens;
- `preview` für Pull Requests mit Staatsportal-Wirkung, wenn `CLOUDFLARE_PREVIEWS_ENABLED=true`,
  `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` gesetzt sind (Worker-Version mit
  PR-Alias, durch Cloudflare Access zu schützen; Versionen werden beim Schließen gelöscht).

Actions-Caches eines PR-Branches sind nur für diesen Branch sichtbar; `main` liest eigene und
Standardbranch-Caches. Nach dem Merge einer Änderung an den Seed-Eingaben projiziert `main` deshalb
einmal neu und speichert den Snapshot für alle folgenden Läufe und Branches.

## D1-Release-Gate

Ein grüner Pull Request muss nach dem Merge einen grünen Main-Workflow ergeben. Ändert ein PR die
Projektionsidentität, gibt es drei Fälle:

| Fall | Erkennung | Weg |
| --- | --- | --- |
| Inhalte (Normen, Verkündungen, Stichtag, Normbezüge von Themen/Presse) | `d1_token_check`: inkrementell | nichts zu tun; `d1_sync` schreibt inkrementell mit verifizierter Basis |
| Projektionslogik ohne Schemaänderung | `d1_token_check`: Remote-State Exit 3 → Äquivalenznachweis | automatisch: Nachweis `identity` (nur Identität und Metadaten) oder `incremental` (nachgewiesener Umfang, z. B. abgeleitete Daten und Suchdokumente aller Normen) → grün; Nachweis `full` (abweichende Tabellen werden genannt) → wie Schemaänderung |
| Schemaänderung (`data/recht/d1/`) oder Nachweis `full` | `d1_token_check` rot | Zielprojektion vor dem Merge herstellen, nie danach (unten) |

Der Nachweis ist keine Annahme: er projiziert Basis und Ziel vollständig (Seed-Cache oder lokale
Projektion), vergleicht alle Tabellen semantisch (`scripts/lib/d1-projection-compare.mjs`) und
bindet das Ergebnis an Basis- und Ziel-Commit, alte und neue Identität, Scope, Comparator-Version
und den nachgewiesenen Umfang; der Sync prüft jede Bindung, bevor er statt der Vollprojektion
schreibt. Einen frei setzbaren Bypass gibt es nicht. Lokal:

```sh
npm run norms:runtime:d1-prove -- --base origin/main            # Nachweis für HEAD, Ergebnis in .cache/d1-equivalence/
npm run norms:runtime:d1-sync -- --remote-state --git-diff origin/main HEAD --budget incremental --equivalence-proof .cache/d1-equivalence/proof-<…>.json
```

Ist eine Vollprojektion tatsächlich nötig (Schema, Nachweis `full`), wird die Zielprojektion vor
dem Merge hergestellt:

1. Migration und Projektion zuerst lokal (`--local --apply-schema`, `d1-verify --fts-integrity`).
2. Staging auf den Zielstand bringen (`--full --budget full --database ostrecht-recht-staging`,
   Migration zuerst), `d1-verify --fts-integrity`, Staging-Worker deployen und die Kernrouten
   prüfen.
3. Produktion außerhalb der Nutzungszeiten mit demselben Lauf auf den Zielstand bringen und
   verifizieren; der alte Worker liest die neue Projektion bis zum Deployment nur, wenn die
   Datenform nach Expand/Contract abwärtskompatibel ist.
4. `d1_token_check` erneut starten: er meldet No-op. Erst dann mergen; `d1_sync` auf `main` ist
   ein No-op, das Deployment folgt ohne manuellen Reparaturschritt.

Ein Squash-Merge behält die Projektionsidentität des PR-Heads, weil sie nur aus Dateiinhalten
berechnet wird.

## D1-Seed-Cache

Der lokale D1-Seed ist ein SQLite-Snapshot mit deterministischem Fingerabdruck
(`scripts/d1-runtime-seed.mjs`, Details in `docs/REVOSAX_BULK_IMPORT.md`):

| Fall | Ablauf |
| --- | --- |
| Cache-Treffer | Fingerabdruck bestimmen → Snapshot wiederherstellen → Manifest, Tabellen, Identität, Scope, `sync_state`, Zähler und FTS5-Integrität prüfen → in Miniflare einsetzen → Wrangler liest die Identität → Smoke. Keine Projektion. |
| Cache-Miss | Fingerabdruck bestimmen → genau eine Projektion (`node:sqlite`) → dieselbe Verifikation → Snapshot im Cache speichern → einsetzen → Smoke. |

Der Fingerabdruck ändert sich nur, wenn Projektionscode (Code-Abschluss des Syncs), Migrationen,
Rechtsbestand, Portalgrundlagen, Stichtag, Seed-Werkzeuge oder die Versionen von wrangler,
miniflare und workerd sich ändern; CSS, Komponenten, Darstellungslogik außerhalb des Abschlusses,
Tests oder Dokumentation ändern ihn nicht. `npm run norms:runtime:d1-seed-fingerprint -- --json
--ref <Commit>` bestimmt ihn für einen Basis-Commit (Cache-Schlüssel des Äquivalenznachweises). Der Job-Summary jedes
Laufs zeigt Status (`restored`/`built`), Projektions-, Verifikations- und Einsetzdauer sowie die
Laufzeiten von Build, Verifikation, A11y und Browser. Der Workflow `OstRecht-Vollbestand-Smoke`
läuft wöchentlich und manuell mit demselben Cache; `refresh_seed` erzwingt die Projektion.

Laufzeitziele (Richtwerte, keine harten Grenzen):

| Szenario | Ziel |
| --- | --- |
| Pull Request, reine Oberfläche (Fixture, kritische Screenshots) | unter 10 Minuten bis zu den Pflichtchecks |
| Pull Request mit Inhalts- oder Laufzeitänderung (Korpus-Tests, Vollbestand) | unter 15 Minuten bis zu den Pflichtchecks |
| Pull Request mit Äquivalenznachweis (`d1_token_check`) | Nachweis unter 20 Minuten, kein Pflichtcheck |
| Release auf `main`, Fixture | unter 20 Minuten bis zum Deployment |
| Release auf `main`, Vollbestand mit Cache-Treffer | Seed unter 1 Minute; Gesamtlauf unter 25 Minuten |
| Release auf `main`, Vollbestand mit Cache-Miss | Projektion parallel zum Build; Gesamtlauf unter 30 Minuten |
| Release auf `main` mit Äquivalenznachweis | `d1_sync` unter 25 Minuten; kein produktiver Rebuild bei gleichen Daten |

## Datenform der D1-Projektion ändern (Expand/Contract)

Die Projektion nach Cloudflare D1 läuft vor dem Worker-Deployment; für die Dauer bis zum
Deployment liest der bereits veröffentlichte Worker die neue Projektion. Ein Worker, der neue
Felder oder Formate noch nicht kennt, zeigt in diesem Fenster fehlende Werte. Deshalb gilt für jede
Änderung an Suchdokumenten, Metadatenzeilen, Spalten oder JSON-Feldern der Projektion:

1. **Expand:** Der Worker versteht alte und neue Datenform; neue Felder werden additiv gelesen,
   fehlende Werte fail-safe dargestellt (Beispiel: unbekannte Rechtsherkunft wird als „Herkunft
   ungeklärt“ gezeigt, `apps/recht/src/scripts/search-page.ts`). Dieses Release enthält noch
   keine Projektionsänderung.
2. **Migrate:** Die Projektion wird auf die neue Form umgestellt (bei Umbenennungen als
   Übergangsprojektion, die alte und neue Felder parallel schreibt). Schema-Migrationen zuerst
   lokal, dann Staging, dann Produktion.
3. **Contract:** Erst nach erfolgreichem Rollout beider Seiten wird die Altkompatibilität entfernt.

Ein Release darf nie gleichzeitig eine neue Datenform einführen und einen Worker voraussetzen, der
sie erst mit demselben Release lesen kann. Der Vollbestand-Smoke prüft den neuen Worker gegen die
neue Projektion, nicht den alten Worker; die Übergangsregel ersetzt er nicht.

## Fehlerklasse bestimmen

| Fehlerklasse | Erkennbar an | Nächster Schritt |
| --- | --- | --- |
| Inhalt oder Wissenshub | `content:check`, Normaudit, Knowledge-Check oder generierte Dateien schlagen fehl | Daten und Quelle im PR korrigieren; Validator nicht abschwächen |
| Dokumentation | `docs:check` meldet fehlende kanonische Dokumente, tote Links oder erledigte TODO-Einträge | Verweise korrigieren, Erledigtes entfernen |
| Typen oder Build | `astro check`, Unit-Test oder Build schlägt fehl | Fehler im selben Branch reproduzieren und über Korrektur-PR beheben |
| npm audit | Befund ab Stufe `high` | Abhängigkeit aktualisieren; eine vorübergehend nicht behebbare Ausnahme mit Advisory, Nutzung, Risiko und Prüftermin in `TODO.md` |
| npm audit (Registry) | Wrapper meldet nach drei Versuchen „Registry nicht erreichbar“ | Lauf erneut starten; kein Codefehler |
| D1-Seed | Seed-Verifikation lehnt einen Snapshot ab | Snapshot wird verworfen und neu projiziert; bei wiederholter Ablehnung Seed-Werkzeuge und Migrationen prüfen |
| Browser oder Barrierefreiheit | Link-, SEO-, Accessibility- oder Browser-Test schlägt fehl | betroffene Route und Viewport aus dem Testbericht prüfen |
| Visuelle Regression | `visual` schlägt fehl | Testbericht (Artefakt `visual-report`) sichten; bei beabsichtigter Änderung Linux-Baselines erneuern (`npm run test:visual:update:linux -- --site law`, ohne Docker Workflow „Screenshot-Baselines erneuern“ und `npm run test:visual:baselines:apply -- --run <Lauf-ID>`), sichten und committen, nie stillschweigend |
| D1-Sync | Remote-State meldet Release-Gate (Nachweis `full` oder Schema), Budget überschritten oder Basis nicht verifiziert | D1-Release-Gate vor dem Merge ausführen (Vollprojektion zuerst gegen Staging); Workflow erst nach No-op mergen |
| Cloudflare-Upload | alle Prüfungen grün, aber `deploy` schlägt fehl | Token, Account-ID, Worker-Konfiguration und Wrangler-Ausgabe prüfen; keine lokale Ersatzveröffentlichung |
| Nachkontrolle | Workflow grün, aber Commitkennung oder Route stimmt nicht | letzte tatsächlich ausgelieferte Kennung feststellen und Deployment erst nach Ursachenklärung erneut anstoßen |

## Testkategorien und lokale Prüfschleifen

Jeder Test hat genau eine Verantwortung; derselbe Sachverhalt wird nicht auf mehreren Ebenen
wiederholt:

| Kategorie | Ort | Zweck | läuft |
| --- | --- | --- | --- |
| schnell / Unit | `tests/*.test.{ts,mjs}` | reine Funktionen, Parser, Scope, Fingerabdruck, Abschluss, Nachweisbindung – kein Vollbestand, kein Worker | bei jeder Codeänderung, lokal in Sekunden (`npm run test:fast`) |
| Korpus | `tests/corpus/` | Vollbestand, Ableitungen, Projektion, Abnahmefälle der Identität auf dem Fixture | bei Inhalts-, Projektions- oder Laufzeitänderungen (`npm run test:corpus`) |
| Content / statisch | `content:check`, `knowledge`, `test:links:run`, `test:seo:run` | Schemas, Normdaten, Wissenshub, Links, SEO | bei Inhalts- und Pipeline-Änderungen bzw. nach jedem Build |
| Laufzeit / Browser | `tests/browser-smoke.spec.ts`, `tests/holdings-navigator.spec.ts` | echte Nutzerwege gegen den gebauten Worker (Fixture) | Pflichtcheck |
| Barrierefreiheit | `tests/accessibility.spec.ts` | axe und Fokusindikator auf repräsentativen Seiten | Pflichtcheck |
| Visual | `tests/visual.spec.ts` | Layout und Design (kritisch / breit), keine funktionalen Assertions | bei Oberflächenänderungen |
| Vollbestand | `full_corpus_smoke`, `OstRecht-Vollbestand-Smoke` | Datenintegrität, Suche und D1 über den echten Bestand | bei relevanten Änderungen, wöchentlich, manuell |
| Browsermatrix | `tests/quality.spec.ts`, `test:browsers:run` | Firefox/WebKit, sieben Viewports, Zoom | manuell |

Lokale Befehle (jede Website wird höchstens einmal gebaut; die `*:run`-Varianten arbeiten auf dem
vorhandenen Build):

```sh
npm run test:fast     # Typen nicht enthalten: reine Unit-Tests in Sekunden
npm run test:pr       # Typen, schnelle Unit-Tests, ein Build, Links, SEO, A11y- und Browser-Smoke (Fixture), kritische Screenshots
npm run test:full     # zusätzlich docs:check, content:check, Korpus-Tests, breite Screenshot-Inventur
SITE_TARGETS=law npm run test:pr   # nur OstRecht in den Build-nachgelagerten Prüfungen
```

`test:pr` setzt `OSTRECHT_D1_FIXTURE` auf das Testfixture; ein kleiner Oberflächen-Change
projiziert weder den Vollbestand noch erzeugt er Hunderte Screenshots. Die Komfortbefehle
`links:check`, `seo:check`, `test:a11y`, `test:browsers` und `test:visual` bauen selbst und sind für
Einzelaufrufe gedacht, nicht für Sammelprüfungen.

## Screenshot-Suite

Die Screenshot-Suite prüft Layout und Design – CSS-Regressionen, falsche Abstände, verschwundene
Elemente, Überläufe, kaputte Breakpoints –, nichts, was Browser-Smoke oder Barrierefreiheitstest
bereits sehen. Sie hat zwei Stufen (`tests/visual.spec.ts`):

- **visual-critical** (`npm run test:visual:critical`, Tag `@critical`): je Website Startseite,
  eine typische Inhaltsseite und die layoutkritischen Komponenten (Portal: Startseite mit
  Aktuelles-Modul, Ministerium, Thema, Kreisreform, Consent; OstRecht: Startseite, Suche mit
  Suchkopf und Filtern, Normseite, Rechtsstand/Herkunft, Fassungsvergleich, mobile Navigation) auf
  Desktop und Mobil, Tablet nur bei eigenem Breakpoint (Startseiten). Läuft in Pull Requests.
- **visual-extended** (`npm run test:visual:extended`): alle Motive auf drei Viewports. Läuft auf
  `main` bei Oberflächenänderungen, wöchentlich und manuell (`visual-extended.yml`).

Kanonische Plattform ist Linux: versioniert sind nur `-linux.png`-Baselines aus dem
Playwright-Container. Auf macOS laufen dieselben Tests funktional (Seitenaufbau, Überlauf,
Interaktion) ohne Pixelvergleich; `OSTRECHT_VISUAL_STRICT=1` erzwingt ihn. Bei einer beabsichtigten
Oberflächenänderung wird die Suite zunächst rot – das ist ihr Zweck; die Baselines werden dann mit
einem Vorgang erneuert:

```sh
npm run test:visual:update:linux -- --site law                   # Docker: Container wie in CI, Build, Fixture-Seed, Update, strikter Vergleich
npm run test:visual:update:linux -- --site portal --critical      # nur die kritische Suite
npm run test:visual:update:linux -- --grep "Komponenten-Basislinien: norm"   # einzelne Tests
```

Ohne Docker: Workflow „Screenshot-Baselines erneuern“ (Website, Suite, Muster wählbar; prüft die
Auswahl direkt strikt gegen die neuen Baselines), danach
`npm run test:visual:baselines:apply -- --run <Lauf-ID>`. In beiden Fällen bleiben Sichtprüfung
und Commit bewusst manuell; die normale PR-CI aktualisiert nie Baselines. Instabile Screenshots
werden über Wartebedingungen, blockierte externe Requests, feste Schriften und gezielte Masken
stabilisiert – nicht über eine größere Pixeltoleranz (`maxDiffPixelRatio` 0,005 bleibt).

## Letzten ausgelieferten Commit feststellen

Die HTML-Seiten tragen `meta[name="build-commit"]`; alle ausgelieferten Routen tragen zusätzlich
`X-Portal-Commit`:

```sh
curl -fsSI https://freistaat-ostdeutschland.de/ | sed -n '/^x-portal-commit:/Ip'
curl -fsS https://freistaat-ostdeutschland.de/ | grep -o 'meta name="build-commit" content="[0-9a-f]\{40\}"'
curl -fsSI https://recht.freistaat-ostdeutschland.de/ | sed -n '/^x-portal-commit:/Ip'
curl -fsS https://recht.freistaat-ostdeutschland.de/ | grep -o 'meta name="build-commit" content="[0-9a-f]\{40\}"'
```

Der öffentliche Stand gilt erst dann als bestätigt, wenn Header und HTML dieselbe vollständige
Kennung ausgeben und sie dem freigegebenen Commit auf `main` entspricht.

## Korrektur und Wiederanlauf

1. Fehler lokal mit dem betroffenen Repositorybefehl reproduzieren.
2. Korrektur in einem neuen oder bestehenden Pull Request vornehmen.
3. Vollständige für den Änderungstyp relevante CI abwarten.
4. Korrektur nach `main` übernehmen; der normale Main-Workflow veröffentlicht sie.
5. Einen abgebrochenen Lauf nur dann erneut starten, wenn die Ursache außerhalb des Codes lag und
   unverändert behoben ist, etwa ein vorübergehender Cloudflare- oder Registry-Ausfall.

Produktionsdateien, Worker-Versionen und Content werden nicht direkt in Cloudflare korrigiert.
Dadurch bleibt jeder ausgelieferte Stand einem Git-Commit zuordenbar.

## Nachkontrolle

In Produktion führt der Workflow `npm run test:deployment:production` aus; manuell:

```sh
PORTAL_SITE_URL=https://freistaat-ostdeutschland.de \
LAW_SITE_URL=https://recht.freistaat-ostdeutschland.de \
EXPECTED_COMMIT=<vollständiger-commit> \
npm run test:deployment:production
```

Bei einem `shared`-Lauf müssen die folgenden Routen dieselbe vollständige Kennung liefern und
erfolgreich antworten:

```text
/
/recht/
/sitemap.xml
/robots.txt

https://recht.freistaat-ostdeutschland.de/
https://recht.freistaat-ostdeutschland.de/suche/
https://recht.freistaat-ostdeutschland.de/norm/erstes-gesetz-zur-grossen-staatsreform/
https://recht.freistaat-ostdeutschland.de/verkuendungen/
https://recht.freistaat-ostdeutschland.de/sitemap.xml
https://recht.freistaat-ostdeutschland.de/robots.txt
```

Zusätzlich kurz prüfen: Startseite, Themenübersicht und aktuelles Leitthema; Rechtssuche und eine
geltende Normfassung auf OstRecht; `robots.txt`, Sitemap und Suchindex beider Origins; einen alten
Portalpfad unter `/recht/norm/...` auf den permanenten Cross-Origin-Redirect; auf Mobilbreite
Navigation, Suche und Einwilligungsentscheidung; dass keine Webanalyse ohne Zustimmung geladen
wird. Bei `portal`- oder `law`-Läufen beschränkt sich die automatische Nachkontrolle auf das
jeweilige Ziel (`DEPLOY_TARGETS=portal|law` für einen manuellen Einzelcheck).

## Pflege- und Releaseregeln

Diese Punkte sind wiederkehrende Pflegeanforderungen, keine erledigbaren Aufgaben:

- Der redaktionelle Stichtag bleibt ein fachlich gepflegter Wert in
  `packages/shared/src/config/editorial.json`. Er wird nur vorwärts fortgeschrieben
  (`npm run norms:advance-reference-date -- --to <Datum> --write`; eine Rückdatierung lehnt das
  Werkzeug fail-closed ab) und zieht die Statusfelder betroffener Normen mit. Beim Fortschreiben
  werden Termine, Stellen, Hervorhebungen, Verfahren, Normfassungen, Regierungszuordnungen,
  Gebietsstände, Timeline und Suchindex gemeinsam geprüft. Für D1 ist die Stichtagsänderung kein
  Full-Trigger.
- Hervorhebungen auf Startseite und Themenübersicht sind redaktionelle Entscheidungen in den
  Themendaten (`highlightFrom`/`highlightUntil`); sie werden nicht gesetzt oder verlängert, um ein
  Layout zu füllen. Die Startseite ist für eine, zwei und drei aktive Hervorhebungen gestaltet;
  `content/portal/topic-coverage.json` legt die Mindestzahl fest.
- Vor jeder Produktionsfreigabe erfolgt zusätzlich zu den automatisierten Prüfungen ein kurzer
  manueller Tastatur- und Screenreader-Test sowie eine Sichtprüfung der festgelegten Mobil-,
  Tablet- und Desktopbreiten.
- Nach abgeschlossenen Arbeiten werden `README.md`, `CONTENT.md`, `CONTENT_GAPS.md`, `TODO.md`,
  `DESIGN.md`, `docs/` und `knowledge/` auf veraltete Aussagen geprüft; Erledigtes wird entfernt,
  nicht archiviert. Generierte Dateien (`knowledge/generated/`, `data/recht/consolidation-report.md`)
  werden nur durch die Build-Befehle aktualisiert; `npm run docs:check` prüft Links und Struktur.
- Dependabot öffnet wöchentlich reviewpflichtige Pull Requests für npm- und Actions-Updates. Ein
  hoher oder kritischer Auditbefund wird behoben, bevor die Änderung nach `main` gelangt.
  Major-Upgrades von Astro, Cloudflare-Adapter, Wrangler oder Playwright benötigen die vollständige
  Testmatrix einschließlich Build, Vollbestand-, Browser-, Accessibility- und Visual-Tests; ein
  Wrangler- oder Miniflare-Upgrade ändert den Seed-Fingerabdruck und erzeugt einmalig einen neuen
  Seed.
