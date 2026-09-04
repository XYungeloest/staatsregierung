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
Verifikationsumfang; unbekannte Laufzeitpfade werden vorsorglich als `shared` behandelt.

| Scope | Typische Pfade | Produktion |
| --- | --- | --- |
| `docs-only` | Root-Dokumentation, `docs/`, interne Knowledge-Markdown-Dateien | kein Build, kein Deployment; Whitespace- und Dokumentationsstrukturprüfung |
| `ci-only` | Tests, Workflows, Validatoren, Audits, Importer, `Gesetze/`, `data/recht/`, interne Knowledge-Daten | kein Deployment; nur die angeforderten Prüfungen |
| `portal` | `apps/portal/`, portalbezogene Inhalte, Kreisreform, portalbezogene Daten | nur Staatsportal |
| `law` | `apps/recht/`, `packages/recht-*`, `public/assets/recht/` | nur OstRecht |
| `shared` | `packages/shared/`, `content/normen/`, `content/verkuendungen/`, gemeinsame Buildskripte, Root-Konfiguration, Abhängigkeiten | beide Anwendungen |

Zwei weitere Flags bestimmen den Prüfumfang von OstRecht unabhängig vom Deploymentziel:

- **`run_full_corpus_smoke`** – der Smoke läuft gegen den gesamten Rechtsbestand statt gegen das
  Fixture, wenn die Änderung D1-Schema oder Migrationen, Sync-, Scope-, Stichtags- oder
  Seed-Werkzeuge (`scripts/sync-recht-d1.mjs`, `scripts/lib/d1-*`, `scripts/d1-runtime-seed.mjs`,
  `scripts/serve-law-worker.mjs`, `scripts/verify-recht-d1.mjs`), den Runtime-Store und die
  Routen mit Datenbankzugriff (`apps/recht/src/lib/runtime/`, `apps/recht/src/pages/` außer
  Hilfe, 404 und robots), die Normbibliothek und Konfiguration (`packages/shared/src/lib/norms/`,
  `packages/shared/src/config/` einschließlich Stichtag), die Portalbezüge der Projektion, die
  Suchlogik (`packages/recht-search/src/`), die OstRecht-Laufzeitkonfiguration oder
  `package-lock.json` berührt – oder wenn mindestens 25 Normverzeichnisse geändert sind
  (`LARGE_CORPUS_CHANGE_THRESHOLD`). Ein manuelles OstRecht-Release prüft immer den Vollbestand.
  Rein visuelle Änderungen (Komponenten, Layouts, Styles, Browserskripte, Hilfe- und Fehlerseite)
  laufen gegen das Fixture.
- **`run_visual`** – die Screenshot-Suite läuft bei Oberflächen-, Layout-, Style- und
  Portalinhaltsänderungen, nicht bei reinem Normcontent, Dokumentation oder Workflows.

Normen und Verkündungen sind trotz des Rechtsportals `shared`, weil das Staatsportal sie für Suche,
Fundstellen und die Rechtsbrücke einliest; ihre Änderung löst kein OstRecht-Deployment aus,
sondern eine D1-Projektion. Die Buildartefakte liegen unter `apps/portal/dist/` und
`apps/recht/dist/`; sie werden einmal gebaut, als Artefakt hochgeladen und vor Smokes und
Deployment wieder unter `apps/` hergestellt.

## Regulärer Ablauf auf `main`

```text
classify ─┬─ build ───────────────┬─ runtime_smoke ─┬─ deploy
          ├─ d1_seed (Vollbestand)┘                 │
          ├─ d1_sync (Cloudflare D1) ───────────────┘
          └─ visual (Screenshots, kein Gate)
```

1. `classify` bestimmt Deployment- und Verifikationswirkung.
2. `build` stellt `node_modules` aus dem Actions-Cache her (`.github/actions/setup-node-modules`,
   Schlüssel aus Betriebssystem, Node-Version und `package-lock.json`; ohne Treffer `npm ci`), führt
   `npm audit` mit Wiederholung bei Registryfehlern aus (`scripts/npm-audit-retry.mjs`: nur
   HTTP 5xx, 429 und Netzfehler werden bis zu dreimal wiederholt; ein Befund ab Stufe `high` schlägt
   sofort fehl), prüft Dokumentationsstruktur, Inhalte, Wissenshub, Typen und Unit-Tests je Scope,
   baut einmal, prüft Assets, Links und SEO und lädt den Build als Artefakt hoch.
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
   dem Planbau abgeglichen, ein `full`-Beschluss endet sofort fail-closed. Dass er auf `main`
   nicht eintritt, stellt das D1-Release-Gate vor dem Merge sicher (siehe unten). Migrationen
   spielt der Workflow nie ein.
6. `deploy` veröffentlicht zuerst OstRecht, danach das Staatsportal, und prüft den
   Produktionsstand (`npm run test:deployment:production`).
7. `visual` läuft bei `run_visual` im Playwright-Container gegen das Fixture und vergleicht strikt
   mit den committeten Linux-Baselines (drei Viewports: 1440, 768, 390); es ist kein
   Deployment-Gate, ein Fehlschlag wird aber wie eine Regression behandelt.

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
- `visual` bei `run_visual` im Playwright-Container;
- `d1_token_check` bei `run_d1_sync`: `--remote-state` gegen Produktion (Identität, gespeicherte
  Identität, Umfang und Entscheidung des künftigen Main-Syncs in Sekunden, kein Sync-Plan, kein
  Schreibzugriff) – grün bei No-op oder verifiziertem inkrementellem Lauf, rot (Exit 3), wenn der
  Sync nach dem Merge eine Vollprojektion bräuchte; dazu ein Teilsync der Verkündungen gegen
  Staging als Schreibnachweis des Tokens;
- `preview` für Pull Requests mit Staatsportal-Wirkung, wenn `CLOUDFLARE_PREVIEWS_ENABLED=true`,
  `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` gesetzt sind (Worker-Version mit
  PR-Alias, durch Cloudflare Access zu schützen; Versionen werden beim Schließen gelöscht).

Actions-Caches eines PR-Branches sind nur für diesen Branch sichtbar; `main` liest eigene und
Standardbranch-Caches. Nach dem Merge einer Änderung an den Seed-Eingaben projiziert `main` deshalb
einmal neu und speichert den Snapshot für alle folgenden Läufe und Branches.

## D1-Release-Gate

Ein grüner Pull Request muss nach dem Merge einen grünen Main-Workflow ergeben. Ändert ein PR die
Projektionsidentität (Projektionslogik, Schema, Stichtag, Normbezüge von Themen/Presse), zeigt
`d1_token_check` mit `--remote-state`, wie `d1_sync` auf `main` entscheiden würde. Meldet er das
Gate (Exit 3), wird die Zielprojektion vor dem Merge hergestellt, nie danach:

1. Lokal nachweisen, dass eine enge Projektion dem Zielstand entspricht
   (`scripts/d1-projection-snapshot.mjs`: Basisstand als SQLite, gezielter Lauf hinein, frische
   Vollprojektion, `compare` tabellenweise identisch). Ohne Nachweis bleibt nur die bewusste
   Vollprojektion (`--full --budget full`, Tabellen werden geleert: Staging zuerst, Produktion nur
   außerhalb der Nutzungszeiten und mit anschließender Verifikation).
2. Staging auf den Zielstand bringen (`--git-diff <main> <head> --assume-narrow-logic-change
   --budget incremental --database ostrecht-recht-staging`), `d1-verify --fts-integrity`, Staging-
   Worker deployen und die Kernrouten prüfen.
3. Produktion mit demselben Lauf auf den Zielstand bringen und verifizieren; der alte Worker liest
   die neue Projektion bis zum Deployment nur, wenn die Datenform nach Expand/Contract abwärts-
   kompatibel ist.
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

Der Fingerabdruck ändert sich nur, wenn Projektionslogik, Migrationen, Rechtsbestand,
Portalgrundlagen, Stichtag, Seed-Werkzeuge oder die Versionen von wrangler, miniflare und workerd
sich ändern; CSS, Komponenten, Tests oder Dokumentation ändern ihn nicht. Der Job-Summary jedes
Laufs zeigt Status (`restored`/`built`), Projektions-, Verifikations- und Einsetzdauer sowie die
Laufzeiten von Build, Verifikation, A11y und Browser. Der Workflow `OstRecht-Vollbestand-Smoke`
läuft wöchentlich und manuell mit demselben Cache; `refresh_seed` erzwingt die Projektion.

Laufzeitziele (Richtwerte, keine harten Grenzen):

| Szenario | Ziel |
| --- | --- |
| Pull Request mit Fixture | unter 15 Minuten bis zu den Pflichtchecks |
| Release auf `main`, Fixture | unter 20 Minuten bis zum Deployment |
| Release auf `main`, Vollbestand mit Cache-Treffer | Seed unter 1 Minute; Gesamtlauf unter 25 Minuten |
| Release auf `main`, Vollbestand mit Cache-Miss | Projektion parallel zum Build; Gesamtlauf unter 30 Minuten |

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
| Visuelle Regression | `visual` schlägt fehl | Testbericht (Artefakt `visual-report`) sichten; Linux-Baselines nur nach Abnahme mit dem Playwright-Container erneuern (`npm run test:visual:run -- --update-snapshots` im Job), nie stillschweigend |
| D1-Sync | Remote-State meldet Release-Gate, Budget überschritten oder Basis nicht verifiziert | D1-Release-Gate vor dem Merge ausführen (enge Projektion mit Nachweis, sonst bewusste Vollprojektion zuerst gegen Staging); Workflow erst nach No-op mergen |
| Cloudflare-Upload | alle Prüfungen grün, aber `deploy` schlägt fehl | Token, Account-ID, Worker-Konfiguration und Wrangler-Ausgabe prüfen; keine lokale Ersatzveröffentlichung |
| Nachkontrolle | Workflow grün, aber Commitkennung oder Route stimmt nicht | letzte tatsächlich ausgelieferte Kennung feststellen und Deployment erst nach Ursachenklärung erneut anstoßen |

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
