# Übergabe: REVOSax-Vollbestand, D1/R2 und OstRecht-Runtime

**Stand:** 3. September 2026  
**Arbeitsbranch:** `revosax-bulk-import-d1-r2`  
**Draft-PR:** #18  
**Ziel:** Eine lokale Coding-AI soll ohne vorherigen Gesprächskontext den begonnenen Umbau sicher fortführen können.

## 1. Fachliches Ziel

OstRecht soll den vollständigen sächsischen Rechtsbestand übernehmen, der am Rechtsüberleitungsstichtag **1. November 2023** nach REVOSax galt. Es wird **nicht** der heutige REVOSax-Bestand und **nicht** die gesamte historische Versionskette importiert.

Maßgeblich ist die REVOSax-Erweiterte-Suche mit:

- Geltungstag `01.11.2023`,
- Gesetzen und Änderungsgesetzen,
- Verordnungen und Änderungsverordnungen,
- Verwaltungsvorschriften und Änderungsverwaltungsvorschriften,
- Förderrichtlinien und Änderungsförderrichtlinien,
- Staatsverträgen und deren angebotenen Änderungstypen,
- Zustimmungsgesetzen und deren angebotenen Änderungstypen,
- gegebenenfalls Mantelvorschriften, sofern dies für einen vollständigen Bestand fachlich erforderlich ist.

Für jeden Suchtreffer wird genau die von REVOSax für diesen Stichtag gelieferte Fassung übernommen. Vor dem 1. November 2023 liegende historische Fassungen werden nicht zusätzlich materialisiert. Spätere ostdeutsche Fassungen entstehen ausschließlich aus ostdeutschen Verkündungen und den bereits vorhandenen Konsolidierungs-/Patchmechanismen.

Als Größenordnung: Eine manuell im Browser ausgeführte REVOSax-Abfrage mit allen Änderungstypen ergab für den 1. Dezember 2023 ungefähr **5.099 Treffer**. Die Zahl für den 1. November 2023 ist noch zu ermitteln und muss vom Discovery-Skript vollständig und fail-closed nachvollzogen werden.

## 2. Architekturentscheidung

Der Rechtsbestand bleibt bewusst in drei Schichten erhalten:

### Git / Wissenshub

`content/normen/` bleibt der fachliche, reviewbare Source of Truth. Das ist zwingend, damit lokale Agenten, Codex, ChatGPT und Entwickler schnell:

- bestehende Normen finden,
- geltende Fassungen lesen,
- Paragraphen/Artikel durchsuchen,
- geplante Änderungsbefehle gegen den aktuellen Wortlaut formulieren,
- Normrelationen und Historien nachvollziehen können.

Der Bestand darf deshalb nie ausschließlich in D1/R2 liegen.

### Cloudflare D1

D1 wird die abgeleitete produktive Runtime-Datenbank für OstRecht. Dort liegen:

- Normidentität und Metadaten,
- Fassungen,
- strukturierte Body-Blöcke,
- Quellenmetadaten,
- FTS5-Suchindex der jeweils aktuellen Fassung.

Schema: `data/recht/d1/0001_rechtsbestand.sql`.

Der Body wird absichtlich blockweise gespeichert, nicht als ein einzelnes riesiges JSON. `scripts/sync-recht-d1.mjs` blockiert einzelne JSON-Blöcke über 1,8 MB.

### Cloudflare R2

R2 ist das unveränderte Quellen-/Anlagenarchiv:

- REVOSax-Roh-HTML,
- PDFs,
- binäre/größere Anlagen.

Normseiten sollen später nicht aus R2 parsen. Parsing und Rechtsüberleitungsanpassung erfolgen vor Veröffentlichung; die Website liest normalen Normtext aus D1.

## 3. Bereits reale Cloudflare-Ressourcen

Diese Ressourcen existieren bereits im Cloudflare-Konto des Projekts:

- Account-ID: `28871b9b1c6753235a331544f7c68460`
- D1-Datenbank: `ostrecht-recht`
- D1-Database-ID: `2491f200-de20-4a45-b028-d00a4fd57840`
- D1-Binding in Wrangler: `ostrecht_recht`
- R2-Bucket: `ostrecht-recht-quellen`
- R2-Binding in Wrangler: `ostrecht_recht_quellen`

Die Migrationen `data/recht/d1/0001_rechtsbestand.sql` bis `0004_search_references.sql` wurden
manuell mit `wrangler d1 execute ostrecht-recht --remote --file …` auf die reale Datenbank angewendet.

Die Account-ID und Database-ID sind keine Secrets. Ein Cloudflare-API-Token ist **nicht** im Repository vorhanden und darf nie committed werden. Für schreibende lokale/CI-Skripte muss er nur über lokale Umgebung/Secrets bereitgestellt werden.

## 4. Bereits implementierte Dateien

Vor neuer Implementierung zuerst diese Dateien vollständig lesen und vorhandene Logik wiederverwenden.

### Bestehende Altlogik, die schon vor diesem Branch vorhanden war

- `scripts/revosax-snapshot.mjs`
  - Einzel-Snapshot-Workflow
  - SHA-256
  - Provenienz
  - Validitätsprüfung
  - Attachments
- `scripts/lib/revosax-parser.mjs`
  - strukturtragender REVOSax-Parser mit `parse5`
  - Überschriften, §§/Artikel, Listen, Tabellen, Gültigkeitsdaten, Satznummern usw.
- `scripts/materialize-revosax-norms.mjs`
  - bestehende Einzelmaterialisierung nach `content/normen`
- `packages/shared/src/lib/norms/schema.ts`
  - Normschema, Bodytypen und Quellenreferenzen
- `packages/shared/src/lib/norms/loader.ts`
  - heutiger Dateisystemloader

**Keinen zweiten REVOSax-Parser bauen.** Bulkimport muss den bestehenden Parser verwenden und Parserfehler sichtbar machen.

### Auf diesem Branch neu vorbereitet

- `scripts/revosax-discover-baseline.mjs` und `scripts/lib/revosax-discovery.mjs`
  - Discovery der Stichtagstreffer über das reale `search_request`-Format, siehe Abschnitt 5
- `scripts/revosax-stage-baseline.mjs`
  - lädt konkrete Treffer
  - Retry/Backoff
  - SHA-256
  - nutzt `parseRevosaxSnapshot()`
  - wendet Ostdeutschland-Adapter an
  - schreibt Roh-/Parsed-Dateien zunächst nur nach `.cache/`
- `scripts/lib/revosax-ost-adapter.mjs`
  - deterministische Sachsen→Ostdeutschland-Anpassung
  - Reststellen-Audit
  - historische Fundstellenkürzel bleiben geschützt
- `tests/revosax-ost-adapter.test.mjs`
- `scripts/plan-revosax-materialization.mjs`
  - vorbereitet für Identitäts-/Schutzplanung
  - Kategorien `CREATE`, `MATCH`, `PROTECT`, `REVIEW`
- `scripts/upload-revosax-r2.mjs`
  - R2-Rohquellenarchivierung
- `scripts/sync-recht-d1.mjs`
  - Spiegelung von `content/normen` nach D1
  - FTS5 für aktuelle Fassung
  - D1-Batchabfragen
- `data/recht/d1/0001_rechtsbestand.sql`
- `docs/REVOSAX_BULK_IMPORT.md`
- ausführlicher Backlog in `README.md` unter `TODO`
- reale D1-/R2-Bindings in `apps/recht/wrangler.jsonc`

## 5. Discovery repariert: reales REVOSax-Requestformat (3. September 2026)

Der frühere Fehler `HTTP 422` beim Befehl

```sh
npm run norms:revosax:discover-baseline -- --date 2023-11-01
```

ist behoben. Ursache war die Rails-CSRF-Prüfung: Das Skript sendete das sichtbare Formular als
`POST /suche` ohne die zugehörige Session (Cookie zum `authenticity_token`); REVOSax antwortet darauf
mit „The change you wanted was rejected (422 Unprocessable Entity)“.

Das reale Verhalten wurde mit Browser-Netzwerkprotokoll (Formular ausgefüllt: Geltungstag
01.11.2023, alle Stamm- und Änderungstypen, „zugleich Mantelvorschriften“) und mit `curl`
verifiziert:

- Browser: `POST /suche` mit `search_request[valid_day_de]=01.11.2023`,
  `search_request[categories][]=G|ÄG|VO|ÄVO|VwV|ÄVwV|FRL|ÄFRL|StV|ÄStV|ZuG|ÄZuG`,
  `search_request[include_envelopes]=1`, `search_request[mode]=fullsearch` und CSRF-Token in der
  Session → „5092 Treffer“, „Seite 1 von 1019“. Die Seitenknöpfe sind `POST /suche?seite=<n>`.
- Stateless-Äquivalent (vom Skript verwendet): `GET /suche?search_request=<URL-kodiertes JSON>` mit
  `{"valid_day":"2023-11-01","categories":[…12 Kürzel…],"include_envelopes":"1","mode":"fullsearch"}`
  → identische 5092 Treffer. Änderungstypen sind eigene Kürzel im `categories`-Array; es gibt keine
  gesonderten Flags. Folgeseiten: `GET /suche?seite=<n>` mit dem Session-Cookie der ersten Antwort.
  Ein `page`-Feld im JSON liefert HTTP 500.
- Treffer verlinken die konkrete historische Fassung (`/vorschrift/<lawId>.<n>`) oder bei
  unveränderter aktueller Fassung die dynamische Stammnorm-URL (`/vorschrift/<lawId>-<slug>`) und
  nennen jeweils „Fassung gültig ab“, Vorschriftentyp, Fundstelle, Fsn-Nr. und Erlassdatum.

Die Logik liegt in `scripts/lib/revosax-discovery.mjs` (Formularstrukturprüfung, JSON-Request,
Session-Cookie, Retry/Backoff, Trefferextraktion, fail-closed-Verifikation, deterministisches
Manifest); `scripts/revosax-discover-baseline.mjs` ist nur noch das CLI. Tests mit echten
REVOSax-Fixtures: `tests/revosax-discovery.test.mjs`. Details im Runbook
`docs/REVOSAX_BULK_IMPORT.md`, Abschnitt „Discovery“.

## 6. Zwingende Rechtsüberleitungsanpassung

Jede importierte normative Stichtagsfassung wird von sächsischem in ostdeutsches Landesrecht angepasst.

Beispiele:

```text
Freistaat Sachsen           -> Freistaat Ostdeutschland
Sächsisches ...             -> Ostdeutsches ...
Sächsischen ...             -> Ostdeutschen ...
sächsische ...              -> ostdeutsche ...
SächsBG                     -> OstBG
SächsSchulG                 -> OstSchulG
```

Dies betrifft insbesondere:

- Titel,
- Kurzbezeichnung,
- Abkürzung,
- fassungsspezifische Titelmetadaten,
- Überschriften,
- Normkörper,
- normative Anlagen.

### Nicht umschreiben

Historische Quellen-/Fundstellenangaben bleiben historisch korrekt, z. B.:

- `SächsGVBl.`
- `SächsABl.`
- `SächsJMBl.`
- REVOSax-URLs
- REVOSax-ID
- SHA-256 der Rohquelle

Auch echte Fremdbezüge wie `Sachsen-Anhalt` dürfen nicht zu `Ostdeutschland-Anhalt` werden.

Der Adaptertest hatte anfangs einen Fehler, weil `SächsGVBl.` im `fullCitation` vom Reststellen-Audit beanstandet wurde. Das wurde im Branch korrigiert: geschützte historische Quellenkürzel werden beim Audit ausgeblendet, nicht umgeschrieben.

## 7. Materialisierung: bestehendes Ostrecht unbedingt schützen

Der Bulkimport darf bestehende ostdeutsche Normen/Folgefassungen nie überschreiben.

Vor jedem Write wird ein Plan erzeugt:

- `CREATE`: tatsächlich neue übernommene Norm
- `MATCH`: bestehende Norm eindeutig erkannt, Baseline/Provenienz passend ergänzbar
- `PROTECT`: bestehende ostdeutsche Folgefassungen/Änderungen schützen
- `REVIEW`: Identität nicht eindeutig; Schreiben blockieren
- optional `SKIP`: fachlich nicht zu importieren

Identitätsmerkmale in Prioritätsreihenfolge:

1. REVOSax `lawId`
2. bereits bekannte Quellenreferenz
3. Titel
4. Kurzbezeichnung
5. Abkürzung

Keine fuzzy Auto-Merges bei Mehrdeutigkeit.

## 8. R2-Provenienz im Normschema (umgesetzt)

`NormSourceReference` erlaubt für `revosax-snapshot` zwei Speicherorte derselben unveränderlichen
amtlichen Quelle: `availability: "versioned"` mit `localSource` im Repository oder
`availability: "r2-archived"` mit `objectKey` (und optional `bucket`) im Bucket
`ostrecht-recht-quellen`. `url`, `sha256`, `retrievedAt`, `lawId`, `sourceValidFrom`/`sourceValidTo`,
`sourceRole: "official-snapshot"` und `mediaType` bleiben Pflicht. `scripts/check-content.mjs` prüft
R2-Verweise gegen `data/recht/revosax-r2-manifest.json` (Objektschlüssel und SHA-256 müssen
übereinstimmen); Mischformen und fehlende Hashes werden abgelehnt (`tests/norm-schema*.test.ts`,
`tests/check-content*.test.*`). Alle vorhandenen Normen validieren weiterhin.

## 9. Reihenfolge und Stand (3. September 2026)

| Phase | Stand |
| --- | --- |
| A Discovery | erledigt: 5.092 Listenzeilen, 5.089 eindeutige Fassungen, Manifest `data/recht/revosax-baseline-2023-11-01.json` |
| B Staging | erledigt: 20 → 100 → 5.089/5.089 ohne Fehler; Bericht `.cache/revosax-baseline/2023-11-01/report.json`, versionierter Import-Audit unter `data/recht/revosax-import-audit/` |
| C R2-Provenienz, Plan, Materializer | erledigt: 3.346 Stammfassungen/Änderungsakte + 1.620 Artikel und Absätze von Mantelvorschriften (Klassifizierung A/B/C/D plus zweite Stufe `data/recht/revosax-envelope-decisions.json`, `containedIn`/`part-of` auch für MATCH), `PROTECT` 52, `REVIEW` 0, `SKIP` 64 begründet; Bilanz in `data/recht/revosax-import-audit/summary.json` |
| D R2 und Git | erledigt: HTML-Rohquellen (Fassungsseiten, Komponentenseiten, 20 nachgeladene Mantelseiten inkl. vier historischer Fassungen) und 890 PDF-Anlagen hashverifiziert in `ostrecht-recht-quellen`; 5.207 Normen unter `content/normen/`; Korpus-Audit `npm run norms:ost:residual-audit` mit 0 Reststellen im übergeleiteten Recht und leerem Rückstand (Altbestand über `scripts/consolidate-norms.mjs` übergeleitet) |
| E D1 | erledigt: Schema 0001–0005 (0005: relationale `law_search_units` + FTS5 mit externem Inhalt und Triggern, Übersichtsspalten, `law_norm_subjects`, `law_norm_history`); Sync mit einmaligem Reset im Vollpfad, indexierten Löschungen, Projektionsfingerabdruck (No-op), Kostenzählern und Budgets; auf Staging gemessen (Fixture-Vollprojektion 151/9.507 Zeilen, Einzelsync 155/289, No-op 8/0); produktive D1 noch auf 0004-Stand (Release-Gate) |
| F OstRecht-Runtime | erledigt: On-demand-Routen aus D1 ohne Korpusaufbau (NormSummary, Metadatenzeilen, Historienindex), Vergleich nur für das angefragte Paar, Sitemap/Suchvorschläge aus schmalen Spalten; aufzeichnende D1-Tests je Route |
| G CI/CD | erledigt: `scripts/classify-change-scope.mjs` mit `run_d1_sync`, Job `d1_sync` mit `--git-diff` in `deploy.yml`; PR-Smoke gegen das Testfixture (`OSTRECHT_D1_FIXTURE`, 38 Normen), Vollbestand als Release-Gate und in `full-corpus-smoke.yml`; `serve-law-worker.mjs` mit Inhaltshash statt mtime; Staging mit eigenen Bindings; Token braucht D1 Read/Write |

Die genauen Befehle je Phase stehen im Runbook `docs/REVOSAX_BULK_IMPORT.md`; offene Punkte
(Migration 0005 und Neuprojektion der produktiven D1, PDF-only-Vorschriften, Sichtung der
Prüfmarken, generische Metadaten) im README-Backlog.

## 10. Nicht tun

- Nicht auf `main` direkt entwickeln; Branch/PR verwenden.
- Produktion nicht umschalten, bevor D1-Vollbestand geprüft ist.
- Nicht die aktuelle REVOSax-Fassung statt 01.11.2023 importieren.
- Nicht sämtliche historischen sächsischen Fassungen importieren.
- Nicht bestehende ostdeutsche Normen überschreiben.
- Nicht `SächsGVBl.` und andere historische Fundstellen in `Ost...` umschreiben.
- Nicht Rohquellen nach der Ostdeutschland-Transformation als „amtliche Quelle“ abspeichern.
- Nicht einen neuen Parser neben `parseRevosaxSnapshot()` erfinden.
- Parserfehler nicht durch Plaintext-Fallback kaschieren.
- Keine Cloudflare-Tokens oder andere Secrets committen.
- Keine tausenden statischen Versionsvergleichsrouten erzeugen.
- Keine großen Binäranlagen in Git aufnehmen; dafür R2 verwenden.
- Keinen produktiven `--full`-Sync ohne zwingenden Grund; nie mit einem Sync-Pfad, der den
  Volltextindex normweise scannt. Lasttests nur lokal (Miniflare) oder gegen
  `ostrecht-recht-staging` mit kleinem Umfang und protokollierten `rows_read`/`rows_written`.
- Migrationen unter `data/recht/d1/` nie ungeprüft automatisch einspielen: lokal, dann Staging,
  dann Produktion.
- `--corpus-filter` (Testfixture) nie gegen die produktive Datenbank.

## 11. Qualitäts- und Abnahmekriterien

Vor Merge dieses Projektschritts mindestens:

```sh
npm run content:check
npm run check
npm run test:unit
npm run build
npm run links:check
npm run seo:check
```

Zusätzlich für den Import:

- Discovery-Count exakt vollständig
- wiederholter Discovery-Lauf deterministisch
- 0 Parserfehler im finalen Staging oder explizit klassifizierte REVIEW-Fälle
- 0 unerlaubte Sachsen-Reststellen in normativen Feldern
- historische Quellenangaben unverändert
- keine bestehenden Ost-Folgefassungen verloren
- D1-Dry-run erfolgreich
- D1-Datenbestand stichprobenartig gegen Git verglichen
- R2-Objekte hashidentisch zur heruntergeladenen Rohquelle

## 12. Aktueller Branch-/PR-Zustand

Draft-PR #18 bleibt Draft. Der Branch enthält den vollständigen Importpfad (Discovery, Staging,
korrigierter Adapter mit Korpus-Audit, Mantelbestandteile als eigene Änderungsvorschriften,
Anlagenarchiv, versionierter Import-Audit), die D1-gestützte OstRecht-Laufzeit, den inkrementellen
D1-Sync, getrennte Staging-Ressourcen und die CI-Trennung. Die produktive Website wird erst mit dem
Merge auf `main` umgestellt.

Release-Gates (siehe README): Migration 0005 und Neuprojektion der produktiven D1 mit dem
kostensicheren Vollpfad samt Projektionsfingerabdruck (damit der `d1_sync`-Job nach dem Merge ein
No-op ist), Produktions-Smoke nach dem ersten Deployment, Workers Paid für den Betrieb mit dem
Vollbestand, Repository-Secret `CLOUDFLARE_API_TOKEN` mit D1 Read/Write. Die verbliebenen
redaktionellen Restarbeiten (PDF-only-Vorschriften, Prüfmarken, generische Metadaten) sind mit
lawId, sourceId, URL, Titel, Slug und Grund unter `data/recht/revosax-import-audit/` versioniert;
Mantelbestandteile sind über `data/recht/revosax-envelope-decisions.json` vollständig entschieden,
der Rückstand `data/recht/ost-residual-backlog.json` ist leer.
