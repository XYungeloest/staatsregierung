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

`data/recht/d1/0001_rechtsbestand.sql` wurde bereits manuell auf die reale D1-Datenbank angewendet.

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

## 8. R2-Provenienz im Normschema noch fertigstellen

Vor dem Vollmaterialisieren muss `NormSourceReference` sauber R2-Quellen erlauben.

Ziel: Eine `revosax-snapshot`-Quelle muss nicht zwingend tausendfach als Roh-HTML in Git liegen. Sie soll alternativ unveränderlich über R2 referenziert werden können, mindestens mit:

- `kind: "revosax-snapshot"`
- `label`
- `url` der amtlichen REVOSax-Fassung
- `retrievedAt`
- `sha256`
- `lawId`
- `sourceValidFrom`
- `sourceValidTo`
- `sourceRole: "official-snapshot"`
- `objectKey` des R2-Objekts
- geeignetem `mediaType`

Die bestehende Provenienzprüfung darf dadurch nicht aufgeweicht werden. Repositoryquelle oder R2-Objekt sind alternative Speicherorte derselben unveränderlichen amtlichen Quelle; URL, Hash und Validitätsdaten bleiben Pflicht, soweit für REVOSax verfügbar.

Alle vorhandenen Normen müssen weiterhin validieren.

## 9. Empfohlene sichere Reihenfolge ab jetzt

### Phase A: Discovery reparieren

1. aktuellen REVOSax-Request im Browser analysieren
2. `search_request` exakt nachbauen
3. Discovery für `2023-11-01` ausführen
4. Trefferzahl plausibilisieren
5. Manifest committen, wenn vollständig und reproduzierbar

### Phase B: Stichprobe statt sofortiger Vollimport

Danach zunächst:

```sh
npm run norms:revosax:stage-baseline -- \
  --manifest data/recht/revosax-baseline-2023-11-01.json \
  --limit 20
```

Prüfen:

- 20/20 Abrufe erfolgreich
- Parser keine stillen Fallbacks
- Titel/Kürzel angepasst
- Fundstellen nicht verfälscht
- keine unerlaubten Sachsen-Reste
- Gültigkeitsdaten plausibel
- Änderungsvorschriften sinnvoll klassifiziert

Erst dann größere Stichprobe, danach Vollstaging.

### Phase C: R2-Provenienz + Materializer

1. Schema erweitern
2. Tests ergänzen
3. Materialisierungsplan erstellen
4. REVIEW-Fälle manuell untersuchen
5. erst danach Write-Modus implementieren/aktivieren

### Phase D: R2 und Git

1. unveränderte Rohquellen nach `ostrecht-recht-quellen`
2. R2-Manifest mit SHA-256/Object-Key
3. materialisierte ostdeutsche Normen nach `content/normen`
4. `content:check`, Normaudits, Unit-Tests

### Phase E: D1

1. zuerst `npm run norms:runtime:d1-sync -- --dry-run`
2. dann vorhandenen Bestand testweise mit einer Norm synchronisieren
3. Daten direkt in D1 kontrollieren
4. danach Vollsync
5. D1 ist nur abgeleitete Runtimekopie; Git bleibt Source of Truth

### Phase F: OstRecht-Runtime umbauen

Erst wenn Gitbestand und D1 vollständig stimmen:

- `apps/recht/astro.config.mjs` nicht mehr vollständig statisch für Rechtsdaten
- Normdetail, Fassungen und Historie on-demand aus D1
- vorhandene UI-Komponenten wiederverwenden
- Suchseite auf D1/FTS5
- Vergleich zweier Fassungen on-demand, nicht mehr alle `n × (n-1)` Paare builden
- Sitemap passend dynamisch/cached erzeugen
- öffentliche URLs unverändert lassen
- statische Help-/redaktionelle Seiten dürfen prerendered bleiben

### Phase G: CI/CD trennen

- reine Normänderung: validieren + inkrementeller D1/R2-Sync
- Änderung an Rechtsportalcode: Worker/Astro bauen und deployen
- nicht mehr wegen jeder Rechtsnorm den gesamten Bestand statisch rebuilden

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

Draft-PR #18 bleibt absichtlich Draft. Die öffentliche Runtime liest weiterhin wie bisher dateibasiert/statisch. D1/R2-Bindings existieren bereits, aber die Anwendung ist noch nicht auf D1-Lesen umgestellt.

Der unmittelbar nächste technische Auftrag ist **ausschließlich die korrekte REVOSax-Discovery zu reparieren und zu verifizieren**, danach eine kleine Staging-Stichprobe durchzuführen. Erst wenn diese belastbar ist, den Vollimport weiterbauen.
