# REVOSax-Vollbestand zum Rechtsüberleitungsstichtag

## Ziel

OstRecht soll nicht nur die bislang einzeln konsolidierten übernommenen Stammnormen enthalten, sondern den vollständigen für den Rechtsüberleitungsstichtag maßgeblichen REVOSax-Bestand einschließlich der Änderungsvorschriften, die REVOSax in der erweiterten Suche standardmäßig ausblendet.

Maßgeblicher Ausgangspunkt ist der **1. November 2023**. Es wird nicht die heutige REVOSax-Fassung und auch nicht die vollständige sächsische Versionshistorie übernommen. Für jeden Treffer der REVOSax-Stichtagssuche wird genau die Fassung verarbeitet, die REVOSax für den 1. November 2023 als einschlägig ausliefert. Dadurch bleibt der Initialbestand endlich und nachvollziehbar. Spätere Fassungen entstehen in OstRecht ausschließlich aus ostdeutschen Verkündungen, geprüften Änderungsvorschriften und deterministischen Konsolidierungsregeln.

REVOSax dokumentiert, dass die erweiterte Suche einen „Geltungstag“ unterstützt und Gesetze, Verordnungen, Verwaltungsvorschriften, Förderrichtlinien, Staatsverträge und Zustimmungsgesetze jeweils einschließlich ihrer Änderungsvorschriften auswählen kann. Die Änderungsvorschriften sind in der Standardansicht bewusst nicht vollständig aktiviert. Der Import muss deshalb ausdrücklich alle Stamm- und Änderungstypen einschalten.

## Architekturentscheidung

Die fachliche und technische Quelle bleiben voneinander getrennt:

```text
REVOSax-Stichtagssuche 01.11.2023
            |
            v
   Discovery + Rohdownload
            |
      +-----+------------------+
      |                        |
      v                        v
unveränderte Quelle       Parser + Adapter
      |                        |
      v                        v
     R2                 content/normen/
HTML, PDF, Anlagen       Git/Wissenshub
                               |
                               v
                         D1-Runtime-Sync
                               |
                               v
                        OstRecht Worker
```

### Git/Wissenshub

`content/normen/` bleibt der fachliche, reviewbare und für Agenten unmittelbar durchsuchbare Rechtsbestand. Das ist wichtig, weil beim Entwurf neuer Rechtsnormen schnell festgestellt werden muss,

- ob eine Norm bereits existiert,
- wie Titel, Kurzbezeichnung und Abkürzung lauten,
- welche Fassung aktuell gilt,
- welcher Paragraph oder Artikel eine bestimmte Regelung enthält,
- welche Normen von einer geplanten Änderung betroffen sind,
- welche Änderungsbefehle auf welche konkrete Textstelle zielen müssen.

Der Vollbestand darf deshalb **nicht ausschließlich in D1 oder R2 liegen**. Codex, ChatGPT und lokale Repository-Werkzeuge sollen weiterhin unmittelbar mit den strukturierten JSON-Fassungen arbeiten können.

### D1

D1 wird die produktive strukturierte Laufzeitdatenbank für OstRecht. Der Website-Build soll später nicht mehr alle Normdateien einlesen und für jede Norm, Fassung und Vergleichskombination statische Seiten erzeugen.

D1 enthält insbesondere:

- Normidentität und Metadaten,
- sämtliche ostdeutschen Fassungen,
- den strukturierten Normkörper,
- Quellenmetadaten,
- den jeweils aktuellen Volltext-Suchindex.

Der Normkörper wird nicht als eine einzige große JSON-Zeile gespeichert. `law_version_blocks` speichert jeden äußeren Body-Block separat. Dadurch wird die D1-Zeilengrenze auch bei großen Gesetzen und umfangreichen Anlagen nicht unnötig ausgereizt. Das initiale Schema liegt unter `data/recht/d1/0001_rechtsbestand.sql`.

### R2

R2 ist ausschließlich Quellen- und Anlagenarchiv. Dort liegen unverändert:

- die von REVOSax ausgelieferten HTML-Fassungen,
- PDFs,
- externe Anlagen und sonstige Binärquellen.

Der öffentliche Normtext wird nicht bei jedem Seitenaufruf aus R2 geparst. Parsing und Sachsen→Ostdeutschland-Anpassung finden vor der Veröffentlichung statt. Der Worker liest für normale Normseiten aus D1. R2 wird nur benötigt, wenn eine archivierte Primärquelle oder Anlage abgerufen beziehungsweise redaktionell überprüft werden soll.

## Warum der Astro-Build entkoppelt werden muss

OstRecht ist derzeit `output: 'static'`. `loadAllNorms()` liest den vollständigen Bestand aus `content/normen/`, und die Normseiten erzeugen ihre Pfade über `getStaticPaths()`.

Bei einigen tausend Vorschriften ist das zwar grundsätzlich noch baubar, aber unnötig teuer. Besonders ungünstig ist die heutige Vergleichsroute, weil sie für eine Norm mit `n` Fassungen jede geordnete Paarung erzeugt. Das sind `n × (n - 1)` Vergleichsartefakte. Eine Norm mit 20 Fassungen würde damit allein 380 Vergleichs-JSONs erzeugen.

Zielzustand:

- Websitecode geändert → Astro/Worker bauen und deployen.
- Norm hinzugefügt oder geändert → Content validieren und D1/R2 inkrementell synchronisieren.
- Vergleich zweier Fassungen → nur bei tatsächlichem Abruf berechnen und anschließend cachen.
- Suchindex → aus D1/FTS5 statt aus einer buildzeitlich erzeugten statischen JSON-Gesamtdatei.

Eine Inhaltsänderung soll nach der Umstellung **kein vollständiges OstRecht-Rebuild mehr auslösen**.

## Importpipeline

### 1. Discovery über die REVOSax-Stichtagssuche

Befehl:

```sh
npm run norms:revosax:discover-baseline -- --date 2023-11-01
```

`scripts/revosax-discover-baseline.mjs` (Logik in `scripts/lib/revosax-discovery.mjs`) bildet das
reale REVOSax-Verhalten nach, das am 3. September 2026 mit Browser-Netzwerkprotokoll und `curl`
verifiziert wurde:

1. `GET /vorschriftensuche` liefert das Rails-Formular (`POST /suche`, Felder `search_request[…]`,
   CSRF-`authenticity_token`) und den Session-Cookie. Das Formular wird nur zur Strukturprüfung
   gelesen: Geltungstagsfeld `search_request[valid_day_de]`, Mantelvorschriften
   `search_request[include_envelopes]`, Modus `search_request[mode]=fullsearch` und die zwölf
   Typkürzel `G, ÄG, VO, ÄVO, VwV, ÄVwV, FRL, ÄFRL, StV, ÄStV, ZuG, ÄZuG` müssen vorhanden sein.
   Fehlende oder unbekannte Typen brechen ab. Die Änderungstypen sind im Formular standardmäßig
   nicht aktiviert; „zugleich Mantelvorschriften“ ist standardmäßig aktiv.
2. Die eigentliche Suche ist der stateless Request `GET /suche?search_request=<URL-kodiertes JSON>`:

   ```json
   {
     "valid_day": "2023-11-01",
     "categories": ["G", "ÄG", "VO", "ÄVO", "VwV", "ÄVwV", "FRL", "ÄFRL", "StV", "ÄStV", "ZuG", "ÄZuG"],
     "include_envelopes": "1",
     "mode": "fullsearch"
   }
   ```

   Änderungstypen sind eigene Kürzel im selben `categories`-Array; REVOSax verwendet dafür keine
   separaten Flags. `include_envelopes: "1"` entspricht dem Haken „zugleich Mantelvorschriften“ und
   bleibt für den vollständigen Bestand gesetzt. `mode: "fullsearch"` ist die erweiterte Suche; die
   Schnellsuche der Startseite verwendet `quicksearch`. Der frühere HTTP-422-Fehler entstand, weil
   der Formular-POST ohne die zugehörige Rails-Session gesendet wurde (CSRF-Prüfung); der JSON-GET
   benötigt keinen Token und liefert dieselbe Trefferliste wie der Browser-POST.
3. Die Trefferseite bestätigt die Parameter („Typ: …“, „zugleich Mantelvorschrift“,
   „Geltungstag: 01.11.2023“), nennt die Trefferzahl und „Seite 1 von N“ mit 5 Treffern je Seite.
   REVOSax hält die Suche in der Session; Folgeseiten werden mit `GET /suche?seite=<n>` und dem
   Session-Cookie geladen (im Browser: `POST /suche?seite=<n>`). Ein `page`-Feld im JSON beantwortet
   REVOSax mit HTTP 500.
4. Jeder Treffer liefert Link, Kurzbezeichnung, vollständigen Titel, Fundstelle, „Vorschriftentyp“,
   Fsn-Nr., Erlassdatum und „Fassung gültig ab“. Treffer verlinken entweder die konkrete historische
   Fassung (`/vorschrift/<lawId>.<n>`) oder, wenn die am Geltungstag geltende Fassung zugleich die
   aktuelle ist, die dynamische Stammnorm-URL (`/vorschrift/<lawId>-<slug>`). Das Staging prüft
   deshalb bei jeder geladenen Quelle, dass „Fassung gültig ab“ dem Treffer entspricht und das
   Gültigkeitsintervall den Stichtag abdeckt.

Fail-closed-Regeln: Es entsteht kein Manifest bei fehlender oder abweichender Trefferzahl, doppelten
Treffer-URLs, mehreren Fassungs-URLs je lawId, unvollständiger Pagination, abweichenden Typfacetten
der Marginalspalte, unbekannten Vorschriftentypen, Treffern ohne „Fassung gültig ab“ oder 0 Treffern.
HTTP 429 und 5xx werden mit exponentiellem Backoff wiederholt; andere HTTP-Fehler nennen Status,
Methode, finale URL und einen begrenzten Antwortauszug, nie Header oder Cookies. Zwischen den
Ergebnisseiten wartet der Crawler standardmäßig 250 ms. Die Treffer werden deterministisch nach
lawId sortiert; zwei Läufe liefern semantisch denselben Bestand.

Ergebnis ist `data/recht/revosax-baseline-2023-11-01.json` (Schema 2) mit `query.searchRequest`,
`reportedCount`, `discoveredCount`, `pageCount`, `typeCounts` (Facette), `categoryCounts` und
`hits[]` (URL, lawId, Fassungssuffix, URL-Art, Kurzbezeichnung, Titel, Fundstelle, Vorschriftentyp,
Kategorie, OstRecht-Normtyp, Fsn-Nr., Erlassdatum, „Fassung gültig ab/bis“).

### 2. Staging, Parsing und Rechtsüberleitungsanpassung

Befehl:

```sh
npm run norms:revosax:stage-baseline -- --manifest data/recht/revosax-baseline-2023-11-01.json
```

Für Stichproben: `--stratified 20` verteilt die Auswahl gleichmäßig über alle zwölf Vorschriftentypen,
`--limit`/`--start-at` wählen einen Bereich, `--law-id` einzelne Vorschriften. Bereits geladene
Rohquellen werden aus `.cache/` wiederverwendet (`--refetch` erzwingt Neuabruf, `--offline`
verbietet Netzzugriffe); nach einer Parseränderung genügt deshalb ein Lauf ohne Netzlast.

Der Staging-Schritt lädt jede Fassung genau einmal (250 ms Pause, Retry/Backoff bei 429/5xx) und legt
unter `.cache/revosax-baseline/2023-11-01/` ab:

```text
raw/<lawId>[.<Fassung>].html        unveränderte Rohquelle
raw/<lawId>[.<Fassung>].meta.json   abgerufene URL, Abrufzeitpunkt, SHA-256, Größe, Content-Type
parsed/<lawId>[.<Fassung>].json     Treffer, Quellmetadaten, Original- und Ost-Fassung
report.json                          maschinenlesbarer Bericht
```

Fassungslogik:

- Dynamische Treffer (`/vorschrift/<lawId>-<slug>`) werden über die numerische Stammnorm-URL
  `/vorschrift/<lawId>` geladen; der Objektschlüssel spiegelt diese Identität (`<lawId>.html`).
  Jede Seite nennt die tatsächlich angezeigte konkrete Fassung (`law_version_link linkactive`);
  sie wird als `canonicalVersionUrl`/`versionNumber` festgehalten. Fassungs-URLs (`<lawId>.<n>`)
  müssen genau diese Fassung zeigen.
- Das „Fassung gültig ab“ der Trefferliste muss dem Seitenwert entsprechen und das Intervall muss
  den Stichtag abdecken (auch für Änderungsvorschriften). Zeigt eine dynamische Seite eine spätere
  Fassung oder leitet sie auf eine Nachfolgevorschrift weiter, wird die passende historische
  Fassung aus dem Fassungsmenü (bei Weiterleitung: über `<lawId>.1`) geladen und erneut geprüft
  (`resolved-historical-version`).
- Treffer ohne eigenen Lesetext werden nicht als Fehler, sondern als Übersprungene geführt:
  `part-of-envelope:<lawId>` (Bestandteil einer Mantelvorschrift, deren Text in der verlinkten
  Vorschrift liegt) und `no-text-in-revosax` („Datei nicht im Datenbestand“).
- Liefert REVOSax für eine lawId zwei Fassungen zum Stichtag, werden sie verglichen: dieselbe
  konkrete Fassung unter zwei URLs wird als Alias übersprungen, identischer angepasster Text wird
  deterministisch auf die höhere Fassungsnummer aufgelöst, abweichender Text wird zum Reviewfall.

Fehler werden klassifiziert (`http`, `parser`, `adapter`, `residual`, `validity`, `manifest`,
`other`); es gibt keine stillen Fallbacks. `report.json` enthält Gesamtzahl, Erfolge, Fehler je
Klasse, Reviewfälle je Kennzeichen, Übersprungene, Mantelbestandteile, Anlagenverweise,
Strukturhinweise (`hoisted-wrapper`, `generic-section`, `legacy-layout`, `no-provisions`) und je
Eintrag Kategorie, Normtyp, Trefferlistenangaben, kanonische Fassung, SHA-256, Gültigkeit,
angepasste Titel, vorgeschlagenen Slug und Reviewkennzeichen. Reviewkennzeichen sind
informativ (`listing-title-mismatch`, `document-date-mismatch`, `missing-document-date`,
`source-ended-without-successor`, `envelope-not-in-manifest`, `no-provisions`, `legacy-layout`)
oder blockierend für die Materialisierung (`attachment-only-content`, `multi-version-text-differs`,
`multi-version-sibling-not-staged`).

`parseRevosaxSnapshot()` bleibt der einzige Parser. Für den Vollbestand wurde er deterministisch um
Buchstaben- und Römisch-Gliederungen von Verwaltungsvorschriften, HTML-Listen, generische
Dokument-Wrapper, betitelte Abschnitte ohne Kennzeichen, das ältere Layout ohne
Gliederungscontainer und Zustimmungsgesetze bzw. Bekanntmachungen erweitert, deren Text allein im
Dokument-Wrapper liegt. Ein erneutes Parsen aller 62 versionierten Snapshots liefert unverändert
dieselben Ergebnisse.

### 3. Sachsen→Ostdeutschland

Die Rechtsüberleitungs-/Bereinigungsanpassung wird **nicht** als unkontrolliertes globales `replace()` durchgeführt. Sie ist ein eigener deterministischer Verarbeitungsschritt in `scripts/lib/revosax-ost-adapter.mjs`.

Normative Inhalte werden beispielsweise wie folgt transformiert:

```text
Freistaat Sachsen                    -> Freistaat Ostdeutschland
Sächsisches Beamtengesetz            -> Ostdeutsches Beamtengesetz
Sächsischen ...                      -> Ostdeutschen ...
sächsischem Recht                    -> ostdeutschem Recht
SächsBG                              -> OstBG
SächsSchulG                          -> OstSchulG
```

Die Transformation betrifft insbesondere:

- Titel,
- Kurzbezeichnung,
- Abkürzung,
- normative Vollzitatbestandteile,
- Überschriften,
- Paragraphen- und Artikeltexte,
- Anlageninhalte, soweit sie zum Normkörper gehören.

Nicht blind verändert werden historische Quellenangaben. `SächsGVBl.`, `SächsABl.`, `SächsJMBl.` und entsprechende Fundstellen bleiben erhalten, weil die Ausgangsnorm tatsächlich dort veröffentlicht wurde. Ebenso unverändert bleiben REVOSax-URL, REVOSax-ID, SHA-256 und archivierte Rohquelle.

`Sachsen-Anhalt` wird nicht in `Ostdeutschland-Anhalt` umgeschrieben. Echte Fremdbezüge sind fachlich von der Bezeichnung des übergeleiteten Landesrechts zu unterscheiden.

Nach der Transformation läuft ein Reststellen-Audit. Verbliebene Vorkommen von `Sachsen`, `sächsisch` oder `Sächs...` in normativen Feldern führen grundsätzlich zum Abbruch und müssen entweder durch eine generische Regel oder eine ausdrücklich dokumentierte Ausnahme geklärt werden.

### 4. R2-Archivierung

Erst wenn `report.json` keine Fehler enthält und der Materialisierungsplan (Schritt 5) steht, werden
die unveränderten Rohquellen der Einträge mit Aktion `CREATE` oder `MATCH` nach R2 übertragen:

```sh
npm run norms:revosax:plan-materialization
npm run norms:revosax:r2-upload -- --plan .cache/revosax-baseline/2023-11-01/materialization-plan.json --concurrency 6
```

Bucket `ostrecht-recht-quellen`, Objektschlüssel `revosax/2023-11-01/<REVOSAX-ID>[.<FASSUNG>].html`.
Der Uploader prüft vor jedem Objekt, dass die Rohdatei im Cache byte- und hashidentisch zum
Stagingbericht ist, lädt sie hoch, liest sie zur Kontrolle zurück und vergleicht den SHA-256. Das
committete Manifest `data/recht/revosax-r2-manifest.json` (lawId, Fassung, amtliche URL,
Objektschlüssel, SHA-256, Größe, Abruf- und Uploadzeit, `verified`) ist die Referenz für die
Provenienzprüfung in `scripts/check-content.mjs` und für den Materializer. Es wird während des Laufs
alle 25 Objekte fortgeschrieben; ein Abbruch verliert keinen Fortschritt, ein Neustart überspringt
bereits verzeichnete Objekte. Ein Objekt mit abweichendem Hash wird nie überschrieben.

Ohne `CLOUDFLARE_API_TOKEN` läuft der Transport über die lokale Wrangler-Anmeldung
(`wrangler r2 object put/get`). Ein Aufruf dauert rund drei Sekunden; mit sechs parallelen Uploads
schafft der Lauf etwa 30 Objekte pro Minute (3.354 Objekte mit 127 MB: rund zwei Stunden).
`--dry-run` prüft nur, `--limit` und `--law-id` schränken ein. Dieser Schritt verändert den
Git-Rechtsbestand nicht.

### 5. Materialisierung in `content/normen/`

```sh
npm run norms:revosax:plan-materialization
npm run norms:revosax:materialize-baseline            # Prüfung ohne Schreiben
npm run norms:revosax:materialize-baseline -- --write
npm run content:check
```

`scripts/plan-revosax-materialization.mjs` ordnet jeden Stagingeintrag dem bestehenden Bestand zu.
Identität wird in dieser Reihenfolge geprüft: REVOSax-`lawId` in der Quellenreferenz → Quellen-URL →
exakter Titel → exakte Kurzbezeichnung → exakte Abkürzung (normalisiert, ohne Fuzzy-Matching).

| Aktion | Bedeutung |
| --- | --- |
| `CREATE` | neue Norm; Slug deterministisch aus der ostdeutschen Kurzbezeichnung, Kollisionen mit REVOSax-ID |
| `MATCH` | vorhandene Norm ohne Fassung zum Stichtag; wird nicht automatisch verändert (siehe offene Schritte) |
| `PROTECT` | vorhandene Norm mit eigener Stichtagsfassung oder späteren Ost-Fassungen bleibt unangetastet |
| `REVIEW` | Identität oder Inhalt nicht eindeutig (z. B. nur PDF-Anlagen); blockiert `--write` |
| `SKIP` | Mantelbestandteil, Alias derselben Fassung, textloser Eintrag, identischer Vorgängertext |

Bestehende Normen, die selbst aus der Baseline stammen (Fassung zum Stichtag) und eine andere
REVOSax-`lawId` tragen, sind für den Titel-/Abkürzungsabgleich keine Kandidaten: gleiche
Kurzbezeichnungen von Änderungsvorschriften („Änd. OstAZVO“) ergeben getrennte Akte mit
deterministischem Slug-Zusatz. Normen mit anderer `lawId`, aber ohne Stichtagsfassung (spätere
Ost-Importe, Vorgänger/Nachfolger) bleiben Kandidaten und ergeben `PROTECT` oder `REVIEW`.

`REVIEW`-Fälle werden in `data/recht/revosax-baseline-decisions.json` mit Begründung entschieden;
der Plan liest die Datei bei jedem Lauf. REVOSax-Doppelerfassungen (identischer angepasster Text
und identische Zitierung unter zwei lawIds, z. B. 4476/9501) übernimmt der Plan nur unter der
niedrigeren lawId. Ergebnis zum Stichtag vor dem Schreiben: `CREATE` 3.346, `MATCH` 7, `PROTECT` 52,
`REVIEW` 0, `SKIP` 1.684 (1.662 Mantelbestandteile, 9 textlose Einträge, 8 Aliasse, 2 identische
Vorgängertexte, 2 Nur-PDF-Vorschriften 1018 und 17114, 1 Doppelerfassung). Nach dem Schreiben
meldet ein erneuter Planlauf dieselben Einträge als `MATCH` (Stichtagsfassung vorhanden). Der Plan
liegt unter `.cache/revosax-baseline/2023-11-01/materialization-plan.json`.

`scripts/materialize-revosax-baseline.mjs` schreibt ausschließlich `CREATE`-Einträge: `meta.json`,
`history.json` und `versions/2023-11-01.json` (`versionId` und `validFrom` = `2023-11-01`,
`validTo` offen, Änderungsvermerk „Ausgangsfassung nach dem am 2023-11-01 geltenden sächsischen
Rechtsstand“) mit der Quellenreferenz `revosax-snapshot` / `availability: r2-archived`
(Objektschlüssel, amtliche URL, `lawId`, Abrufzeit, SHA-256, Gültigkeitsintervall,
`sourceRole: official-snapshot`). Erlassorgan, Sachgebiete, Schlagwörter und Kurzfassung leitet
`scripts/lib/revosax-metadata.mjs` deterministisch aus Typ, Ressort und Titel ab. Jeder Datensatz
wird vor dem Schreiben mit dem gemeinsamen Normschema validiert und erneut auf Sachsen-Reststellen
geprüft. Der Lauf schreibt nichts, solange auch nur ein Eintrag nicht im R2-Manifest archiviert ist,
ein Zielverzeichnis bereits existiert oder ein Datensatz die Regeln verletzt; Bericht:
`.cache/revosax-baseline/2023-11-01/materialization-report.json`. Änderungsvorschriften bleiben
eigene Rechtsetzungsakte, Mantelbestandteile werden nicht als Normen angelegt.

Umfang im Repository: 3.346 neue Normverzeichnisse mit rund 10.000 JSON-Dateien und 170 MB
(unkomprimiert); das Git-Pack wächst dadurch um etwa 75 MB. Rohquellen (127 MB HTML) liegen nur in
R2. `npm run content:check` braucht mit dem Vollbestand rund eine Minute, `npm run test:unit` unter
einer Minute.

## D1-Synchronisation

Das Repository wird als Runtime-Projektion nach D1 gespiegelt:

```sh
npm run norms:runtime:d1-sync -- --dry-run
npm run norms:runtime:d1-sync -- --slug ostdeutsches-feiertagsgesetz
npm run norms:runtime:d1-sync
```

Schema: `data/recht/d1/0001_rechtsbestand.sql` bis `0004_search_references.sql` (in dieser
Reihenfolge mit `wrangler d1 execute ostrecht-recht --remote --file …` anwenden). Tabellen:

| Tabelle | Inhalt |
| --- | --- |
| `law_norms` | Identität, Spalten für Listen sowie `meta_json`, `history_json`, Sortier- und Gültigkeitsfelder |
| `law_versions` | Fassungen ohne Körper (`version_json`), Vollzitat, Verkündungsbezug, zeitliche Einordnung |
| `law_version_blocks` | äußere Body-Blöcke als JSON; Blöcke über 40.000 Zeichen in Teile (`part_index`) zerlegt |
| `law_source_objects` | Quellenreferenzen je Fassung, bei R2 mit `object_key` |
| `law_norm_derived` | Beziehungen, Empfehlungen, Herkunft, im Text vorkommende Verweise, Portalbezüge |
| `law_publications` | Verkündungen als JSON |
| `law_search_documents` | Suchdokument-Metadaten je Fassung |
| `law_search` | FTS5 der geltenden Fassung, provisionsgenau mit Anker und Strukturadresse |
| `law_runtime_meta` | `last_sync_at`, `norm_count`, `publication_count` |

Der Sync lädt den gesamten Bestand über den gemeinsamen Loader (validiert also jede Norm), berechnet
die korpusweiten Ableitungen mit `packages/shared/src/lib/norms/derived.ts` (derselbe Code wie die
Dateivariante der Website) und schreibt je Norm alle Zeilen neu. Bei einem Vollsync werden Zeilen
gelöscht, die im Repository nicht mehr existieren.

Transport: Mit `CLOUDFLARE_API_TOKEN` (D1 Read/Write) läuft der Sync über die REST-API mit
parametrisierten Batches (`--transport api`, so auch in CI); ohne Token verwendet er die lokale
Wrangler-Anmeldung (`wrangler d1 execute ostrecht-recht --remote --file`) mit SQL-Dateien unter
`.cache/d1-sync/`, in denen Parameter als Literale gerendert sind. `--dry-run` validiert und schreibt
beim Wrangler-Transport nur die Dateien. Token und Anmeldedaten werden nie committed.

Kontrolle der Projektion gegen Git (Zähler und Stichproben, auch für die lokale Miniflare-D1):

```sh
npm run norms:runtime:d1-verify
npm run norms:runtime:d1-verify -- --local
```

Limits: D1 Free zählt 5 Mio. Zeilenlesevorgänge und 100.000 Schreibvorgänge je Tag. Der Vollsync
des Stichtagsbestands (3.587 Normen, 65 SQL-Dateien, rund 230 MB) hat das Leselimit am Synctag
erschöpft, weil Löschen und FTS-Neuaufbau je Norm Zeilen lesen; danach antwortet die Datenbank bis
Mitternacht UTC mit Fehler 7500. Vor einem produktiven Betrieb mit dem Vollbestand ist Workers Paid
einzuplanen oder der Sync auf geänderte Normen zu beschränken (`--slug`).

Lokale Kontrolle des Worker-Standes gegen die reale Datenbank:

```sh
npm run build:recht
cd apps/recht && npx wrangler dev --config dist/server/wrangler.json --remote --port 8788
```

Danach `/norm/<slug>/`, `/norm/<slug>/history/`, `/norm/<slug>/vergleich/<von>/<bis>.json`,
`/api/suche.json?q=…`, `/search-suggestions.json`, `/verkuendungen/index.json` und `/sitemap.xml`
abrufen; die Antworten tragen `X-Portal-Commit`.

## Runtime-Umbau von OstRecht

`apps/recht` ist weiterhin `output: 'static'`; Norm-, Fassungs-, Historien-, Vergleichs-, Index-,
Sachgebiets-, Verkündungs- und Sitemap-Routen tragen jedoch `export const prerender = false` und
laufen im Cloudflare-Worker. Der Adapter erzeugt `apps/recht/dist/server/entry.mjs` samt
`dist/server/wrangler.json` (Bindings aus `wrangler.jsonc`); `npm run deploy:recht` veröffentlicht
mit dieser erzeugten Konfiguration.

- `apps/recht/src/lib/runtime/store.ts` kapselt den Datenzugriff: `createD1NormStore` liest die
  Projektion aus dem Binding `ostrecht_recht`; `createFileNormStore` liest `content/` und berechnet
  dieselben Ableitungen. `getNormStore(Astro.locals)` wählt je nach vorhandenem Binding.
- Normkörper werden nur für die angezeigte Fassung geladen; ein Fassungsvergleich lädt genau die
  beiden angefragten Fassungen (`/norm/[slug]/vergleich/[von]/[bis].json`).
- Übersichten arbeiten mit einem im Worker gecachten Metadatenbestand (ohne Körper), der bei
  geändertem `last_sync_at` neu geladen wird.
- Die Suchseite bleibt eine statische Hülle. `/api/suche.json` wählt über den FTS5-Index Kandidaten
  (Wortpräfixe der Anfrage, ODER-verknüpft, Typfilter), liefert je Kandidatennorm alle Fassungen als
  Suchdokumente und nur die passenden Provisionen der geltenden Fassung; Bewertung, Filterung und
  Gruppierung übernimmt weiterhin `packages/recht-search/search-query.ts` im Browser. Historische
  und künftige Fassungen sind damit über Titel, Kurzbezeichnung, Abkürzung und Fundstelle auffindbar,
  im Volltext jedoch nur die geltende Fassung.
- `/search-suggestions.json` und `/verkuendungen/index.json` werden aus D1 erzeugt; das statische
  `search-index.json` entfällt.
- Worker-Antworten tragen über die Middleware denselben `X-Portal-Commit` wie die Assets.
- workerd kennt `node:fs` nicht. Die Dateiloader (`norms/loader.ts`, `loadAllVerkuendungen`,
  `portal/content.ts`) und die dateibasierten Suchartefakte (`recht-search/search-files.ts`)
  werden deshalb nur lazy importiert; reine Helfer wie `getCurrentVersion` liegen in
  `norms/versions.ts`. Ein Worker ohne D1-Binding antwortet mit einem klaren Fehler statt eines
  Dateizugriffs.
- Öffentliche URLs sind unverändert; `scripts/check-links.mjs` und `scripts/check-seo.mjs` erkennen
  On-demand-Routen aus den Seitenquellen und prüfen die Sitemap im Deployment-Smoke.

## CI/CD-Trennung

`scripts/classify-change-scope.mjs` bestimmt aus den geänderten Pfaden, was ein Push auslöst
(`tests/change-scope.test.mjs` dokumentiert die Fälle):

| Änderung | Content-Prüfung | Build/Deploy | D1-Projektion |
| --- | --- | --- | --- |
| `content/normen/**`, `content/verkuendungen/**` | ja | nur Staatsportal (rendert Rechtsgrundlagen statisch) | ja |
| `content/themen/**`, `content/presse/**` | ja | Staatsportal | ja (Empfehlungen, Portalbezüge) |
| `scripts/sync-recht-d1.mjs` | ja | – | ja |
| `packages/shared/src/lib/norms/**`, `packages/recht-search/**` | – | beide bzw. OstRecht | ja |
| `apps/recht/**` | – | OstRecht | – |
| `data/recht/d1/*.sql` | ja | – | nein: Migrationen werden bewusst manuell eingespielt |

Der Workflow `.github/workflows/deploy.yml` führt den Job `d1_sync` (nur bei `push`, nach dem
Build, mit `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` aus den Repository-Secrets über
`npm run norms:runtime:d1-sync -- --transport api`) vor dem Deployment aus; ein manuelles
`workflow_dispatch`-Deployment schreibt die Projektion nicht. Der Token braucht dafür zusätzlich
`D1 Read`/`D1 Write` für die Datenbank `ostrecht-recht`.

Browser-Smoke- und Barrierefreiheitstests (`tests/browser-smoke.spec.ts`, `tests/accessibility.spec.ts`)
laufen für OstRecht nicht mehr gegen den statischen Client-Build, sondern gegen den gebauten Worker:
`scripts/serve-law-worker.mjs` projiziert `content/` mit `npm run norms:runtime:d1-sync -- --local
--apply-schema` in eine lokale Miniflare-D1 unter `.cache/wrangler-local` (Migrationen aus
`data/recht/d1/`, Fingerabdruck-Marker verhindert unnötige Neuaufbauten) und startet
`wrangler dev --local` auf Port 4322. In CI übernimmt der Schritt `npm run norms:runtime:d1-local`
das Seeding vor Playwright; die produktive Datenbank wird dabei nicht berührt. Der Sync läuft
dabei als Rechtsportal (`SITE_TARGET=law`, gesetzt über `scripts/lib/law-site-env.mjs`), damit
Normadressen relativ und Portalverweise absolut in der Projektion stehen. Das vollständige Seeding
(3.587 Normen, 65 SQL-Dateien, lokale D1 rund 640 MB) dauert lokal etwa sieben Minuten; in CI
entsprechend länger. Es fällt nur an, wenn Änderungen an `apps/recht` oder den gemeinsamen Paketen
OstRecht-Smoke-Tests auslösen.

Unit-Tests (`npm run test:unit`, Heap 4 GB) laden den Bestand über `tests/helpers/corpus.ts` nur
einmal je Testprozess; der Suchindex für die browserseitige Suchlogik wird aus dem redaktionellen
Kernbestand plus jeder 15. übernommenen Baseline-Norm gebaut, weil ein Gesamtindex über den
Vollbestand als Testartefakt zu groß ist und in Produktion ohnehin nur D1-Kandidaten bewertet werden.
Der paarweise Empfehlungsvergleich prüft eine deterministische Stichprobe.

## Sicherheits- und Qualitätsregeln

- REVOSax wird mit identifizierendem, zurückhaltendem User-Agent und begrenzter Request-Rate abgerufen.
- HTTP 429 und temporäre 5xx-Antworten werden mit Backoff behandelt.
- Kein Import gilt als erfolgreich, wenn die Stichtagssuche mehr Treffer meldet als der Scraper vollständig paginiert hat.
- Jede Rohquelle erhält SHA-256.
- Die Rohquelle wird nie durch die Ostdeutschland-Anpassung verändert.
- Ein Parserfehler wird nicht durch ungeprüfte Plaintext-Extraktion kaschiert.
- Restliche Sachsen-Bezüge in normativen Feldern blockieren den Import, sofern keine dokumentierte Ausnahme besteht.
- Bestehende spätere Ost-Fassungen sind gegen Baseline-Überschreibung geschützt.
- D1 und R2 sind veröffentlichte Laufzeitspeicher, nicht der alleinige fachliche Wissensbestand.
- Geheimnisse, Account-IDs mit Sicherheitsrelevanz und API-Tokens werden nicht in Git gespeichert.

## Noch offene Implementierungsschritte

- Anlagen: 230 der neuen Normen verweisen auf 890 REVOSax-Anlagen (PDF, meist Formulare und
  Muster). Die Verweise stehen im Stagingbericht (`attachments`); die Dateien selbst sind noch nicht
  nach R2 archiviert und nicht als Quellen verzeichnet.
- `MATCH`-Fälle (7 vorhandene Normen ohne Stichtagsfassung, z. B. `wappenverordnung`): die
  REVOSax-Fassung ist in R2 archiviert, die Ergänzung der Fassung in `versions/` bleibt eine
  redaktionelle Nacharbeit mit Prüfung der bestehenden Fassungshistorie.
- Prüfmarken des Stagings (`reviewFlagCounts`, insbesondere 287 × `source-ended-without-successor`
  und 250 × `missing-document-date`) sind informativ und sollten redaktionell gesichtet werden.
- Für ein getrenntes Staging-Deployment fehlt eine eigene D1-/R2-Umgebung; `wrangler.jsonc` bindet
  in beiden Umgebungen dieselben Ressourcen.
- Sachgebiete, Schlagwörter, Kurzfassung und Erlassorgan der übernommenen Normen sind deterministisch
  abgeleitet und generisch (z. B. Sachgebiet „Landesrecht“); redaktionelle Verfeinerung offen.
