# Betriebsrunbook für Veröffentlichungen

Staatsportal und OstRecht werden ausschließlich über den Workflow `Deploy to Cloudflare Workers`
aus dem geprüften Commit veröffentlicht. Der Workflow bestimmt aus den geänderten Pfaden, welche
Anwendung neu gebaut und veröffentlicht werden muss. Ein manuelles Überschreiben eines produktiven
Workers ist kein Wiederherstellungsweg.

## Änderungsscope

Die zentrale Zuordnung liegt in `scripts/classify-change-scope.mjs`. Sie trennt Runtime-Deploymentziele
von Verifikationsflags. Unbekannte Laufzeitpfade und gemeinsame Quellen werden vorsorglich als
`shared` behandelt.

| Scope | Typische Pfade | Produktion |
| --- | --- | --- |
| `docs-only` | Root-Dokumentation, `docs/` sowie interne Knowledge-Markdown-Dateien | kein Build und kein Deployment |
| `ci-only` | Tests, Workflowdateien, Validatoren, Audits, Importer, `Gesetze/`, `data/recht/` und interne Knowledge-Daten | kein Produktionsdeployment |
| `portal` | `apps/portal/`, portalbezogene Inhalte, Kreisreform und portalbezogene Daten | nur Staatsportal |
| `law` | `apps/recht/`, `packages/recht-*` und `public/assets/recht/` | nur OstRecht |
| `shared` | `packages/shared/`, `content/normen/`, `content/verkuendungen/`, gemeinsame Buildskripte, Root-Buildkonfiguration und Abhängigkeiten | beide Anwendungen |

`ci-only` führt die erforderlichen Content-, Knowledge-, Unit- oder Buildprüfungen aus, veröffentlicht
aber nie eine Website. Ein Astro-Build findet dabei nur statt, wenn die geänderte Prüfung selbst einen
Build benötigt, etwa bei Browser-Smokes oder Link- und SEO-Validatoren. Tests und Prüfscripts setzen
kein Deploymentziel.

Normen und Verkündungen sind trotz des Rechtsportals `shared`, weil das Staatsportal sie unter
anderem für Suche, Fundstellen und die Rechtsbrücke einliest. Die PDF-Assets unter
`public/assets/recht/` werden dagegen nur vom Rechtsportal ausgeliefert.

`packages/recht-search/` enthält die ausschließlich von OstRecht verwendete Suchlogik. Die
Klassifikation behandelt `packages/portal-*` und `packages/recht-*` als app-spezifisch; sie lösen
ausschließlich den jeweiligen Websitebuild aus.

Die Buildartefakte liegen unter `apps/portal/dist/` und `apps/recht/dist/`. GitHub Actions lädt
diese app-lokalen Verzeichnisse als gemeinsames Artefakt hoch und stellt sie vor UI-Smokes und
Deployment wieder unter `apps/` her. Die unveränderten Worker `ostrecht-portal` und
`ostrecht-recht` verwenden `apps/portal/wrangler.jsonc` beziehungsweise
`apps/recht/wrangler.jsonc`.

## Regulärer Ablauf

1. Änderung über einen geprüften Pull Request nach `main` übernehmen.
2. Der Main-Workflow ermittelt Deployment- und Verifikationswirkung. Bei `docs-only` endet der Lauf
   nach dem leichten Dokumentationscheck; bei `ci-only` nach den angeforderten Prüfungen, jeweils ohne
   Produktionsdeployment.
3. Für `portal` oder `law` laufen nur der betroffene Build, dessen Typprüfungen sowie dessen Link-
   und SEO-Prüfung. Der Content-Audit läuft nur bei Inhalts-, Quellen- oder Validatoränderungen. Bei
   `shared` werden beide Anwendungen gebaut und geprüft.
4. Für `portal` und `law` laufen Accessibility- und Browser-Smokes nur gegen das jeweils betroffene
   Ziel; bei `shared` laufen beide Zielgruppen. Im Main-Workflow erledigt das ein einziger Job
   `full_runtime_smoke`: er projiziert den gesamten Rechtsbestand genau einmal in eine lokale
   Miniflare-D1 (kein Zugriff auf die Cloudflare-D1), verifiziert die Projektion
   (`norms:runtime:d1-verify --local --fts-integrity`) und führt danach A11y- und Browser-Smoke gegen
   denselben Worker aus; Pull Requests prüfen stattdessen zwei parallele Fixture-Jobs. Bei
   `docs-only` und üblichen `ci-only`-Läufen gibt es keine UI-Smokes. Die manuelle Releaseprüfung
   bleibt für jede Produktionsfreigabe erforderlich.
5. Bei `run_d1_sync` projiziert der Job `d1_sync` die Rechtsdaten vor dem Deployment nach
   Cloudflare D1: `--git-diff <before> <sha> --budget incremental --recover`. Der Lauf ist ein No-op,
   wenn D1 bereits die Projektionsidentität des Commits trägt; er schreibt inkrementell nur, wenn D1
   nachweislich den Stand des Vorgänger-Commits trägt (Base-State-Guard), und fällt sonst auf eine
   als Recovery markierte Vollprojektion mit dem Profil `recovery` zurück. Budgets aus
   `data/recht/d1-sync-budgets.json` werden vor dem ersten Schreibzugriff (Planschätzung, dann
   0 Schreibzugriffe) und laufend gegen die realen Zähler geprüft; bei Überschreitung schlägt das
   Deployment fehl und verlangt eine bewusste Entscheidung (Budget prüfen, `--full --budget full`
   manuell). Schema-Migrationen (`data/recht/d1/*.sql`) spielt der Workflow nie ein.
6. Bei beiden Zielen veröffentlicht der Workflow zuerst OstRecht und danach das Staatsportal. So
   verweist die Portalbrücke erst nach der erfolgreichen Aktualisierung des Rechtsportals auf den
   neuen Stand.
7. Den im Workflow ausgewiesenen vollständigen Commit notieren. Die Produktionsnachkontrolle prüft
   nur die tatsächlich veröffentlichten Ziele; der Portal-Altpfad-Redirect wird bei einer
   Portalprüfung zusätzlich gegen den bestehenden Rechtsorigin kontrolliert.

Ein manuell gestarteter Workflow bietet die Ziele `portal`, `law` und `both` (Standard). Er verwendet
standardmäßig `staging`; dafür müssen vollständige `portal_site_url` und `law_site_url` angegeben
werden. `production` ist nur für eine bewusst freigegebene Veröffentlichung zu wählen. Die
zielbezogenen Prüfungen bleiben auch beim manuellen Deployment aktiv.

## Pull-Request-Prüfung

Der Pull-Request-Workflow verwendet dieselbe Trennung. `docs-only` erhält nur den leichten
Dokumentationscheck; `ci-only` nur die angeforderten Prüfungen ohne Produktionsartefakt oder
Cloudflare-Vorschau. Bei `portal` oder `law` werden nur der jeweilige Typecheck, Build, Link- und
SEO-Lauf sowie zielbezogene UI-Smokes ausgeführt. `shared` führt den vollständigen Lauf für beide
Anwendungen aus. Die bestehende Cloudflare-PR-Vorschau bleibt auf Pull Requests mit
Staatsportal-Runtimewirkung beschränkt; bei einem reinen `law`-Scope wird sie wegen der bestehenden
portalbezogenen Previewarchitektur nicht gestartet.

### Cloudflare-PR-Vorschau einrichten

In den GitHub-Repository-Einstellungen müssen die Variable
`CLOUDFLARE_PREVIEWS_ENABLED=true` sowie die Secrets `CLOUDFLARE_API_TOKEN` und
`CLOUDFLARE_ACCOUNT_ID` gesetzt sein. Das Token benötigt nur die Rechte zum Hochladen und Löschen
von Worker-Versionen.

Der Workflow lädt mit `wrangler versions upload --config apps/portal/wrangler.jsonc` eine
unveröffentlichte Worker-Version mit PR-spezifischem Preview-Alias hoch. Diese Version wird nicht
nach Produktion deployt. Da Cloudflare Preview URLs standardmäßig öffentlich sind, müssen Alias-
und Versions-Preview-Domain durch eine eigene Cloudflare-Access-Anwendung geschützt werden. Die
konkrete Domain steht nach dem ersten manuellen Preview-Upload fest.

Ohne `CLOUDFLARE_PREVIEWS_ENABLED=true` wird nur der Preview-Job übersprungen; die übrigen
Qualitätsprüfungen laufen weiter. Der Workflow merkt sich die erzeugten Versions-IDs im technischen
Teil des PR-Kommentars und löscht sie beim Schließen oder Mergen des Pull Requests. Fehlende
Preview-Secrets führen nicht zu einem Ersatz- oder Produktionsdeployment.

## Fehlerklasse bestimmen

| Fehlerklasse | Erkennbar an | Nächster Schritt |
| --- | --- | --- |
| Inhalt oder Wissenshub | `content:check`, Normaudit, Knowledge-Check oder generierte Dateien schlagen fehl | Daten und Quelle im PR korrigieren; Validator nicht abschwächen |
| Typen oder Build | `astro check`, Unit-Test oder Build schlägt fehl | Fehler im selben Branch reproduzieren und über Korrektur-PR beheben |
| Browser oder Barrierefreiheit | Link-, SEO-, Accessibility- oder Browser-Test schlägt fehl | betroffene Route und Viewport aus dem Testbericht prüfen |
| Visuelle Regression | gezielter Visual-Lauf schlägt fehl | Artefakt und Baseline einzeln sichten; Baselines nur nach Abnahme ändern |
| Cloudflare-Upload | alle Prüfungen grün, aber `deploy` schlägt fehl | Token, Account-ID, Worker-Konfiguration und Wrangler-Ausgabe prüfen; keine lokale Ersatzveröffentlichung |
| Nachkontrolle | Workflow grün, aber Commitkennung oder Route stimmt nicht | letzte tatsächlich ausgelieferte Kennung feststellen und Deployment erst nach Ursachenklärung erneut anstoßen |

## Letzten ausgelieferten Commit feststellen

Die HTML-Seiten tragen `meta[name="build-commit"]`; alle ausgelieferten Routen tragen zusätzlich
`X-Portal-Commit`. Für eine erste Prüfung:

```sh
curl -fsSI https://freistaat-ostdeutschland.de/ | sed -n '/^x-portal-commit:/Ip'
curl -fsS https://freistaat-ostdeutschland.de/ | grep -o 'meta name="build-commit" content="[0-9a-f]\{40\}"'
curl -fsSI https://recht.freistaat-ostdeutschland.de/ | sed -n '/^x-portal-commit:/Ip'
curl -fsS https://recht.freistaat-ostdeutschland.de/ | grep -o 'meta name="build-commit" content="[0-9a-f]\{40\}"'
```

Die ermittelte Kennung mit dem freigegebenen Commit auf `main` und dem letzten erfolgreichen
Deployment-Job vergleichen. Der öffentliche Stand gilt erst dann als bestätigt, wenn Header und
HTML dieselbe vollständige Kennung ausgeben.

## Korrektur und Wiederanlauf

1. Fehler lokal mit dem betroffenen Repositorybefehl reproduzieren.
2. Korrektur in einem neuen oder bestehenden Pull Request vornehmen.
3. Vollständige für den Änderungstyp relevante CI abwarten.
4. Korrektur nach `main` übernehmen; der normale Main-Workflow veröffentlicht sie.
5. Einen abgebrochenen Lauf nur dann erneut starten, wenn die Ursache außerhalb des Codes lag und
   unverändert behoben ist, etwa ein vorübergehender Cloudflare-Ausfall.

Produktionsdateien, Worker-Versionen und Content werden nicht direkt in Cloudflare korrigiert.
Dadurch bleibt jeder ausgelieferte Stand einem Git-Commit zuordenbar.

## Nachkontrolle

In Produktion führt der Workflow `npm run test:deployment:production` aus. Der Test wiederholt die
Prüfung während der kurzen Ausbreitungsphase und schlägt mit Route, HTTP-Status oder abweichender
Commitkennung fehl. Manuell kann derselbe Test so gestartet werden:

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

Zusätzlich kurz prüfen:

- Startseite, Themenübersicht und aktuelles Leitthema,
- Rechtssuche und eine geltende Normfassung auf OstRecht,
- `robots.txt`, Sitemap und Suchindex beider Origins,
- einen alten Portalpfad unter `/recht/norm/...` auf den permanenten Cross-Origin-Redirect,
- auf Mobilbreite Navigation, Suche und die Einwilligungsentscheidung,
- dass keine Webanalyse ohne Zustimmung geladen wird.

Bei `portal`- oder `law`-Läufen beschränkt sich die automatische Nachkontrolle auf das jeweilige
Ziel. Für einen manuellen Einzelcheck kann `DEPLOY_TARGETS=portal` oder `DEPLOY_TARGETS=law`
gesetzt werden; ohne diese Variable werden beide Ziele geprüft.

## Pflege- und Release-Regeln

Diese Punkte sind wiederkehrende Pflegeanforderungen, keine erledigbaren Feature-TODOs:

- Der redaktionelle Stichtag bleibt ein fachlich gepflegter Wert. Er wird nicht aus dem Builddatum
  oder automatisch aus dem aktuellen Kalendertag abgeleitet und wird nur einmal in
  `packages/shared/src/config/editorial.json` gesetzt. Beim Fortschreiben werden Termine,
  Stellen, Hervorhebungen, Verfahren, Normfassungen, Regierungszuordnungen, Gebietsstände,
  Timeline und Suchindex gemeinsam geprüft.
- Vor jeder Produktionsfreigabe erfolgt zusätzlich zu den automatisierten Prüfungen ein kurzer
  manueller Tastatur- und Screenreader-Test sowie eine Sichtprüfung der festgelegten Mobil-,
  Tablet- und Desktopbreiten. Das Ergebnis wird im Release- bzw. Pull-Request-Kontext festgehalten;
  die Dokumentation ersetzt den Test nicht.
- Nach abgeschlossenen Arbeiten werden README, `CONTENT.md`, `CONTENT_GAPS.md`, `DESIGN.md`,
  `docs/` und `knowledge/` auf veraltete Aufgaben und Aussagen geprüft. Generierte Wissensdateien
  werden ausschließlich mit `npm run knowledge:build` aktualisiert.

## Abhängigkeiten und Actions

Dependabot öffnet wöchentlich reviewpflichtige Pull Requests für npm- und GitHub-Actions-
Aktualisierungen. Jeder Pull Request führt `npm audit --audit-level=high` aus. Ein hoher oder
kritischer Befund wird behoben, bevor die Änderung nach `main` gelangt. Eine vorübergehend nicht
behebbare Ausnahme muss mit Advisory, betroffener Nutzung, Risikobewertung und Prüftermin im
zentralen TODO der README dokumentiert werden. Major-Upgrades von Astro, Cloudflare-Adapter oder
Wrangler benötigen die vollständige Testmatrix einschließlich Build, Browser-, Accessibility- und
Visual-Tests.
