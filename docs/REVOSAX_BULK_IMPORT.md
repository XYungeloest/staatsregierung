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

`scripts/lib/revosax-ost-adapter.mjs` wendet die Rechtsüberleitungsanpassung deterministisch auf
Titel, Kurzbezeichnung, Abkürzung, Vollzitat und den gesamten Normkörper (Labels, Überschriften,
Texte, Anlagen) an: `Freistaat Sachsen → Freistaat Ostdeutschland`, `Sachsens → Ostdeutschlands`,
alle Flexionsformen von `sächsisch` (auch Bindestrichkomposita und die Schreibvariante
„sächsicher“), Kürzelpräfixe `Sächs… → Ost…` (auch innerhalb zusammengesetzter Kürzel wie
`DVOSächsBO → DVOOstBO`). Nur ganze Wörter werden ersetzt; `Niedersächsisch`, `Niedersachsen` und
`Sachsen-Anhalt` bleiben als echte Fremdbezüge unverändert.

Geschützt sind ausschließlich die Fundstellenkürzel der Verkündungs- und Amtsblätter
(`SächsGVBl.`, `SächsABl.`, `SächsJMBl.`, `SächsSMBl.`, `SächsMBl.`, jeweils mit Punkt). Institutions-
und Gesetzeskürzel wie `SächsVerfGH`/`SächsVerfGHG` sind normativer Text und werden zu
`OstVerfGH`/`OstVerfGHG`; ein Begriff wird nicht dadurch geschützt, dass er Präfix eines
Gesetzeskürzels ist (das war der Fehler des ersten Adapterstands, der 14 Normen mit `SächsVerfGHG`
und `SächsVerfGHAufwEntschVO` hinterließ).

Der Materializer berechnet die Anpassung immer neu aus dem unveränderten Parse (`original`) mit dem
aktuellen Adapter; ein im Staging gespeichertes `adapted` ist nur Kontrollartefakt.

Reststellenprüfung in drei Stufen, alle fail-closed:

1. Staging: `auditAdaptedRevosaxSnapshot()` über das angepasste Parserobjekt (Titel, Zitierung, Körper).
2. Materialisierung: erneut über Körper, Zitierung und die normativen Metadatenfelder (Kurzfassung,
   Schlagwörter, Änderungsvermerk, Historie).
3. Korpus: `npm run norms:ost:residual-audit` (`scripts/audit-ost-residuals.mjs`, Teil von
   `content:check` und `tests/ost-residual-audit.test.mjs`) prüft den fertigen Gitbestand unter
   `content/normen/`: alle sichtbaren normativen Felder (Meta-Titel, Kurzbezeichnung, Abkürzung,
   Kurzfassung, Schlagwörter, Fassungstitel/-kurzbezeichnungen/-abkürzungen, Zitierungen ohne die
   geschützten Fundstellenkürzel, Änderungsvermerke, Historieneinträge, Normkörper samt Anlagen).
   Ausgenommen sind nur Provenienzfelder: `sourceReferences` (URLs, R2-Schlüssel, SHA-256,
   historische Bezeichnungen), `sourceNotes`, `enactingBody`/`originEnactingBody` sowie Web- und
   E-Mail-Adressen; `id`/`slug` sind Identifikatoren. Gesucht wird nach `Sachsen`, `Sachsens`,
   `sachsen`, `Sächs…`/`sächs…` (auch innerhalb von Kürzeln) und nach Adapterartefakten wie
   `Niederostdeutsch`. Übernommenes Recht (R2-Provenienz) muss reststellenfrei sein. Der redaktionelle
   Altbestand vor dem Adapter (Normen aus `Gesetze/`, z. B. `landesbeamtengesetz` mit Titel
   „Sächsisches Beamtengesetz“) wird nicht geduldet, sondern als versionierter Rückstand in
   `data/recht/ost-residual-backlog.json` geführt; jede Abweichung von den dort verzeichneten Zählern
   lässt den Audit fehlschlagen, `--update-backlog` schreibt ihn nach einer bewussten redaktionellen
   Änderung fort.

Provenienz-Semantik der Metadaten: `originEnactingBody` nennt das historische Ursprungsorgan der
übernommenen sächsischen Quelle („Sächsischer Landtag“, „Sächsische Staatsregierung“ …). Es ist kein
Erlassorgan der ostdeutschen Norm; das Feld `enactingBody` bleibt übernommenen Normen leer und die
Normseite zeigt `originEnactingBody` als „Ursprungsorgan der übernommenen Quelle“. Historische
Fundstellen und Quellenbezeichnungen bleiben sächsisch, der operative Normtext ist ostdeutsch.

### 4. R2-Archivierung

Erst wenn `report.json` keine Fehler enthält und der Materialisierungsplan (Schritt 5) steht, werden
die unveränderten Rohquellen aller Einträge mit Aktion `CREATE` oder `MATCH` nach R2 übertragen –
einschließlich der Komponentenseiten von Mantelbestandteilen und der nachgeladenen Mantelvorschriften:

```sh
npm run norms:revosax:plan-materialization
npm run norms:revosax:r2-upload -- --plan .cache/revosax-baseline/2023-11-01/materialization-plan.json \
  --envelopes .cache/revosax-baseline/2023-11-01/envelope-components.json --concurrency 4
```

Bucket `ostrecht-recht-quellen`, Objektschlüssel `revosax/2023-11-01/<REVOSAX-ID>[.<FASSUNG>].html`
(nachgeladene Mantelvorschriften: `revosax/2023-11-01/envelope-<lawId>.html`). Der Uploader prüft vor
jedem Objekt, dass die Rohdatei im Cache byte- und hashidentisch zum Stagingbericht ist, lädt sie
hoch, liest sie zur Kontrolle zurück und vergleicht den SHA-256. Das committete Manifest
`data/recht/revosax-r2-manifest.json` (lawId, Fassung, amtliche URL, Objektschlüssel, SHA-256,
Größe, Abruf- und Uploadzeit, `verified`) ist die Referenz für die Provenienzprüfung in
`scripts/check-content.mjs` und für den Materializer. Ein Objekt mit abweichendem Hash wird nie
überschrieben; Rohquellen werden nie nachträglich verändert.

Anlagen (PDF-Anhänge der Fassungsseiten) archiviert `npm run norms:revosax:archive-attachments`
(`scripts/archive-revosax-attachments.mjs`) unverändert unter
`revosax/2023-11-01/attachments/<lawId>/<anlagenId>-<Dateiname>` und führt das Manifest
`data/recht/revosax-attachments.json` (Herkunft lawId/sourceId, Norm-Slug, Original-URL, Dateiname
aus Content-Disposition, MIME-Type, SHA-256, Größe, Objektschlüssel, Upload- und Prüfzeitpunkt,
grober Typ). Hash vor und nach dem Upload müssen übereinstimmen (`verified`).
`tests/revosax-attachments.test.mjs` prüft die Manifestintegrität.

Ohne `CLOUDFLARE_API_TOKEN` laufen beide Transporte über die lokale Wrangler-Anmeldung
(`scripts/lib/r2-transport.mjs`); ein Aufruf dauert rund drei Sekunden, vier bis sechs parallele
Uploads schaffen etwa 30 Objekte pro Minute. `--dry-run` prüft nur, `--limit` und `--law-id`
schränken ein. Dieser Schritt verändert den Git-Rechtsbestand nicht.

### 5. Materialisierung in `content/normen/`

```sh
npm run norms:revosax:classify-envelopes             # Bestandteile von Mantelvorschriften einordnen
npm run norms:revosax:plan-materialization
npm run norms:revosax:materialize-baseline            # Prüfung ohne Schreiben
npm run norms:revosax:materialize-baseline -- --write
npm run norms:revosax:materialize-baseline -- --regenerate --write   # nur nach Adapter-/Regeländerungen
npm run content:check
npm run norms:revosax:import-audit                    # versionierter Import-Audit
```

`scripts/plan-revosax-materialization.mjs` ordnet jeden Stagingeintrag dem bestehenden Bestand zu.
Identität wird in dieser Reihenfolge geprüft: REVOSax-`lawId` in den Quellenreferenzen (ohne
`envelope-snapshot`-Referenzen) → Quellen-URL → exakter Titel → exakte Kurzbezeichnung → exakte
Abkürzung (normalisiert, ohne Fuzzy-Matching).

| Aktion | Bedeutung |
| --- | --- |
| `CREATE` | neue Norm; Slug deterministisch aus der ostdeutschen Kurzbezeichnung, Kollisionen mit REVOSax-ID |
| `MATCH` | vorhandene Norm mit Fassung zum Stichtag (bereits materialisiert oder redaktionell aus derselben REVOSax-Fassung importiert); wird nicht verändert |
| `PROTECT` | vorhandene Norm mit anderer lawId und ohne Stichtagsfassung oder mit späteren Ost-Fassungen bleibt unangetastet |
| `REVIEW` | Identität oder Inhalt nicht eindeutig; blockiert `--write`, sofern nicht zurückgestellt |
| `SKIP` | Alias derselben Fassung, textloser Eintrag, identischer Vorgängertext, REVOSax-Doppelerfassung, dokumentierte Entscheidung |

Bestehende Normen, die selbst aus der Baseline stammen (Fassung zum Stichtag) und eine andere
REVOSax-`lawId` tragen, sind für den Titel-/Abkürzungsabgleich keine Kandidaten: gleiche
Kurzbezeichnungen von Änderungsvorschriften („Änd. OstAZVO“) ergeben getrennte Akte mit
deterministischem Slug-Zusatz. REVOSax-Doppelerfassungen (identischer angepasster Text und
identische Zitierung unter zwei lawIds, z. B. 4476/9501) übernimmt der Plan nur unter der
niedrigeren lawId.

**Mantelbestandteile.** REVOSax führt die Artikel einer Mantelvorschrift (Artikelgesetz, Mantel-
Verwaltungsvorschrift) als eigene Vorschriften mit eigener lawId; ihre Seite enthält keinen
Lesetext, sondern nur Titel, eigenes Vollzitat und den Verweis „Bestandteil der Vorschrift
<Mantelvorschrift>#<Anker>“. Diese 1.662 Treffer entfallen nicht mehr pauschal, sondern werden von
`scripts/classify-revosax-envelopes.mjs` eingeordnet (`.cache/…/envelope-components.json`,
versioniert in `data/recht/revosax-import-audit/envelopes.json`):

| Klasse | Bedeutung | Plan |
| --- | --- | --- |
| A | Artikel der Mantelvorschrift eindeutig zugeordnet: Anker (`#a44`/`data-anchor`, römisch `#roemII`/`romII`, Paragraphenanker `#p21`), dessen Überschrift zum eigenen Titel der Komponente passt (Wortstammvergleich ≥ 0,6; REVOSax verlinkt manche Bestandteile fälschlich auf `#a1`); ersatzweise die eindeutig beste Artikelüberschrift (≥ 0,6, Abstand ≥ 0,2 zur zweitbesten) oder die Artikelnummer bei Seiten ohne a-Anker | `CREATE` als eigene Norm |
| B | Mantelvorschrift besteht nur aus diesem Artikel und trägt dasselbe Vollzitat (technischer Alias) oder eine zweite REVOSax-Vorschrift zeigt auf denselben Artikel (Doppelerfassung; die niedrigere lawId bleibt) | `SKIP` (`envelope-alias-of`) |
| C | Artikel besteht nur aus Anlagenverweisen | `SKIP` (`envelope-attachment-only`), Anlagen-Workflow |
| D | Anker zeigt auf einen anderen Artikel und keine Überschrift passt, kein Anker, kein Artikelkennzeichen, weiterleitende Mantelvorschrift, mehrere Kandidaten | `REVIEW` (`DEFER` mit Grund) |

Klasse-A-Komponenten werden als `aenderungsvorschrift`/`one-time-act` materialisiert
(`buildEnvelopeComponentRecord`): Titel, Kurzbezeichnung und Vollzitat von der Komponentenseite,
Erlassdatum und Gültigkeitsbeginn aus der amtlichen Trefferliste, der Text ist der zugeordnete
Artikelblock der Mantelvorschrift. Beide amtlichen Seiten sind R2-Quellen: die Komponentenseite als
`official-snapshot` (lawId der Komponente), die Mantelvorschrift als `envelope-snapshot` mit Anker
(lawId der Mantelvorschrift; zählt nicht zur Identität). Ist die Mantelvorschrift selbst im Bestand,
trägt die Komponente `containedIn` und die Website zeigt die Beziehung „Bestandteil von“ /
„Enthält als Artikel“ (`part-of`/`contains` in `relations.ts`). 18 Mantelvorschriften, die zum
Stichtag nicht mehr gelistet sind, wurden einmalig nachgeladen und archiviert, damit der
Artikeltext aus derselben unveränderten Quelle stammt. Ergebnis: 1.521 Artikel (A), 40 Aliasse
(B), 101 Reviewfälle (D, zurückgestellt). `--prune-baseline` entfernt zusammen mit `--regenerate`
Baseline-Normen, deren Quelle nach neuer Einordnung nicht mehr übernommen wird.

`REVIEW`-Fälle werden in `data/recht/revosax-baseline-decisions.json` entschieden: `SKIP` mit
Begründung, Auflösung mit `canonicalSlug` oder `DEFER` (bewusst offen gehaltener Reviewfall; bleibt
`REVIEW` im Plan und im Import-Audit, blockiert den Schreibmodus aber nicht). Der Plan ist nur
schreibbar, wenn kein nicht zurückgestellter `REVIEW`-Fall existiert.

`scripts/materialize-revosax-baseline.mjs` schreibt `CREATE`-Einträge: `meta.json`, `history.json`
und `versions/2023-11-01.json` (`versionId` und `validFrom` = `2023-11-01`, `validTo` offen,
Änderungsvermerk „Ausgangsfassung zum Rechtsüberleitungsstichtag …“) mit R2-Provenienz
(Objektschlüssel, amtliche URL, `lawId`, Abrufzeit, SHA-256, Gültigkeitsintervall,
`sourceRole: official-snapshot`). Das Erlassdatum stammt von der Fassungsseite, ersatzweise aus der
amtlichen Trefferliste (Spalte Erlassdatum) – nie geschätzt. Ursprungsorgan (`originEnactingBody`),
Sachgebiete, Schlagwörter und Kurzfassung leitet `scripts/lib/revosax-metadata.mjs` deterministisch
ab. Jeder Datensatz wird vor dem Schreiben mit dem Normschema validiert und auf Reststellen geprüft;
der Lauf schreibt nichts, solange ein Eintrag nicht im R2-Manifest archiviert ist, ein
Zielverzeichnis bereits existiert oder ein Datensatz die Regeln verletzt.

`--regenerate` schreibt `MATCH`-Einträge, deren Norm ausschließlich aus der Baseline besteht (genau
eine Fassung `2023-11-01` mit R2-Quelle derselben lawId), deterministisch aus dem Staging neu – nach
Adapter- oder Regeländerungen. Normen mit weiteren Fassungen oder anderen Quellen sind geschützt;
ändert sich der Slug durch die Anpassung (z. B. `aend-saechsverfghg → aend-ostverfghg`), wird das
alte Verzeichnis ersetzt.

Umfang im Repository: 4.867 übernommene Normverzeichnisse (3.346 Stammfassungen und Änderungsakte,
1.521 Artikel von Mantelvorschriften), 5.108 Normen insgesamt, rund 15.400 JSON-Dateien und 195 MB
(unkomprimiert); das Git-Pack wächst dadurch um etwa 90 MB. Rohquellen (5.028 HTML-Seiten, 890
PDF-Anlagen) liegen nur in R2. `npm run content:check` braucht mit dem Vollbestand rund anderthalb
Minuten, `npm run test:unit` rund eine Minute.

Der versionierte Import-Audit `data/recht/revosax-import-audit/` (`summary.json`, `skips.json`,
`envelopes.json`, `review-flags.json`) entsteht deterministisch aus den Stagingartefakten
(`npm run norms:revosax:import-audit`, `--check` in der Content-Prüfung) und hält für jeden
SKIP-, Review- und Prüfmarkenfall lawId, sourceId, URL, Titel, Slug und Grund fest – die offenen
redaktionellen Aufgaben verlieren ihre Identität nicht, wenn `.cache/` gelöscht wird. Die Bilanz in
`summary.json` muss exakt aufgehen: eindeutige Treffer = eigene Normen + vorhandene (MATCH) +
geschützte + REVIEW + SKIP. Die Prüfmarke „Quelle endet ohne Nachfolger“ wird dort eingeordnet:
Typ A (Nachfolgefassung im REVOSax-Fassungsmenü, für Ostdeutschland ohne Wirkung), Typ B
(Befristung im übernommenen Text, die mit dem Gültigkeitsende übereinstimmt – möglicherweise
ostdeutsch wirksam, Review) oder unklar (Review). Fehlende Erlassdaten sind mit ihrer Quelle
(Trefferliste oder keine) verzeichnet.

## D1-Synchronisation

Das Repository wird als Runtime-Projektion nach D1 gespiegelt; genau eine Umfangsangabe ist Pflicht,
ein Aufruf ohne Umfang bricht ab:

```sh
npm run norms:runtime:d1-sync -- --full                       # Initialimport, Recovery, bewusste Vollprojektion
npm run norms:runtime:d1-sync -- --slug foo --slug bar        # gezielte Normen
npm run norms:runtime:d1-sync -- --delete alt-slug            # aus Git entfernte Normen samt abhängiger Zeilen löschen
npm run norms:runtime:d1-sync -- --publications               # Verkündungstabelle neu schreiben
npm run norms:runtime:d1-sync -- --git-diff <base> <head>     # Umfang aus dem Git-Diff (CI)
npm run norms:runtime:d1-sync -- --changed-paths pfade.txt    # Umfang aus einer Pfadliste
npm run norms:runtime:d1-sync -- --full --database ostrecht-recht-staging   # Staging-Datenbank (Wrangler)
npm run norms:runtime:d1-verify                               # Git ↔ D1 (Zähler, Fingerabdruck, Stichproben)
```

Umfangslogik (`scripts/lib/d1-sync-scope.mjs`, `tests/recht-d1-sync-scope.test.mjs`): Pfade unter
`content/normen/<slug>/` ergeben genau diesen Slug (fehlt das Verzeichnis, eine Löschung);
`content/verkuendungen/*.json` ergibt die Verkündung und die Normen, deren Fassungen sie zitieren
(`publication_ref_json`, Vollzitat). Änderungen an der Projektionslogik (`scripts/sync-recht-d1.mjs`,
`packages/shared/src/lib/norms/**`, `packages/recht-search/**`, `data/recht/d1/`, Themen und Presse
als Grundlage der Portalbezüge) erzwingen die Vollprojektion. Abgeleitete Daten (`law_norm_derived`:
Beziehungen, Empfehlungen, Textverweise, Portalbezüge) hängen von der Identität *anderer* Normen ab;
sie werden für alle Normen neu geschrieben (ohne Fassungen und Körper), wenn sich identitätsrelevante
Metadaten einer Norm geändert haben (`meta.json` im Git-Diff verglichen), eine Norm hinzukam oder
entfiel – sonst nur für die geänderte Norm. Eine Löschung entfernt `law_search`,
`law_search_documents`, `law_norm_derived`, `law_source_objects`, `law_version_blocks`,
`law_versions` und `law_norms` der Norm. Jeder Lauf aktualisiert `law_runtime_meta` (`last_sync_at`,
`norm_count`, `publication_count`, `corpus_hash` = Fingerabdruck über Slugs, Fassungen und
Verkündungen des Git-Bestands, den `d1-verify` gegen das Repository prüft).

Schema: `data/recht/d1/0001_rechtsbestand.sql` bis `0004_search_references.sql` (manuell mit
`wrangler d1 execute <Datenbank> --remote --file …` anwenden; lokal `--apply-schema`). Tabellen:

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
| `law_runtime_meta` | `last_sync_at`, `norm_count`, `publication_count`, `corpus_hash` |

Der Sync lädt den gesamten Bestand über den gemeinsamen Loader (validiert also jede Norm), berechnet
die korpusweiten Ableitungen mit `packages/shared/src/lib/norms/derived.ts` (derselbe Code wie die
Dateivariante der Website) und schreibt je ausgewählter Norm alle Zeilen neu. Er läuft als
Rechtsportal (`SITE_TARGET=law`, `scripts/lib/law-site-env.mjs`), damit Normadressen relativ und
Portalverweise absolut in der Projektion stehen.

Transport: Mit `CLOUDFLARE_API_TOKEN` (D1 Read/Write) läuft der Sync über die REST-API mit
parametrisierten Batches (`--transport api`, so in CI); ohne Token verwendet er die lokale
Wrangler-Anmeldung (`wrangler d1 execute … --remote --file`) mit SQL-Dateien unter
`.cache/d1-sync/`, in denen Parameter als Literale gerendert sind; vorübergehende Netz- oder
Anmeldefehler werden je Datei bis zu viermal wiederholt. `--dry-run` validiert und schreibt beim
Wrangler-Transport nur die Dateien. `--local` schreibt in die Miniflare-D1 unter
`.cache/wrangler-local` (Smoke-Tests, Entwicklung). Token und Anmeldedaten werden nie committed.

Kontrolle der Projektion gegen Git (`scripts/verify-recht-d1.mjs`): Zähler für Normen, Fassungen,
Blöcke, Quellen (davon R2), abgeleitete Zeilen, Verkündungen, Suchdokumente und Suchzeilen,
Laufzeitmetadaten einschließlich `corpus_hash`, dazu Stichproben (deterministische Auswahl über den
Bestand plus gezielt: erste und letzte übernommene REVOSax-Norm, eine Ost-Norm mit mindestens drei
Fassungen, eine übernommene Änderungsvorschrift, ein Mantelbestandteil, die größte Norm) mit
Titel/Typ/Status, Fassungen mit Blöcken, Suchzeilen und absoluten Portalverweisen.
`--local` prüft die Miniflare-Projektion, `--database` eine andere Zieldatenbank.

Limits: D1 Free zählt 5 Mio. Zeilenlesevorgänge und 100.000 Schreibvorgänge je Tag. Der Vollsync
des Stichtagsbestands (rund 95.000 Operationen) und die Laufzeitzugriffe des Workers haben das
Leselimit am 3. September 2026 zweimal erschöpft; danach antwortet die Datenbank bis Mitternacht UTC
mit Fehler 7500. Vor dem produktiven Betrieb mit dem Vollbestand ist Workers Paid einzuplanen; der
inkrementelle Sync hält den laufenden Betrieb klein.

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
| `content/normen/**`, `content/verkuendungen/**` | ja | nur Staatsportal (rendert Rechtsgrundlagen statisch) | inkrementell (`--git-diff`) |
| `content/themen/**`, `content/presse/**` | ja | Staatsportal | Vollprojektion (Empfehlungen, Portalbezüge) |
| `scripts/sync-recht-d1.mjs` | ja | – | Vollprojektion |
| `packages/shared/src/lib/norms/**`, `packages/recht-search/**` | – | beide bzw. OstRecht | Vollprojektion |
| `apps/recht/**` | – | OstRecht | – |
| `data/recht/d1/*.sql` | ja | – | nein: Migrationen werden bewusst manuell eingespielt |

Der Workflow `.github/workflows/deploy.yml` führt den Job `d1_sync` (nur bei `push`, nach dem
Build, mit `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` aus den Repository-Secrets) vor dem
Deployment aus: `npm run norms:runtime:d1-sync -- --transport api --git-diff <before> <sha>`, also nur
die im Push geänderten Normen und Verkündungen; eine Vollprojektion nur bei geänderter
Projektionslogik oder ohne bekannten Vorgängerstand. Ein manuelles `workflow_dispatch`-Deployment
schreibt die Projektion nicht. Der Token braucht dafür zusätzlich `D1 Read`/`D1 Write` für die
Datenbank `ostrecht-recht`.

Staging: `apps/recht/wrangler.jsonc` bindet unter `env.staging` ausdrücklich eigene Ressourcen
(D1 `ostrecht-recht-staging`, R2 `ostrecht-recht-quellen-staging`; beide angelegt, Schema
0001–0004 eingespielt, Datenbank noch leer). Wrangler-Environments erben Bindings nicht; ohne diese
Angaben hätte staging keine Datenbank. Die produktive Datenbank wird von staging nie beschrieben;
Seeding: `npm run norms:runtime:d1-sync -- --full --database ostrecht-recht-staging`
(Wrangler-Transport). `tests/wrangler-config.test.mjs` prüft die Konfiguration.

Browser-Smoke- und Barrierefreiheitstests (`tests/browser-smoke.spec.ts`, `tests/accessibility.spec.ts`)
laufen für OstRecht gegen den gebauten Worker: `scripts/serve-law-worker.mjs` projiziert `content/`
mit `npm run norms:runtime:d1-sync -- --full --local --apply-schema` in eine lokale Miniflare-D1
unter `.cache/wrangler-local` (Migrationen aus `data/recht/d1/`, Fingerabdruck-Marker verhindert
unnötige Neuaufbauten) und startet `wrangler dev --local` auf Port 4322. In CI übernimmt der Schritt
`npm run norms:runtime:d1-local` das Seeding vor Playwright; die produktive Datenbank wird dabei
nicht berührt. Das vollständige Seeding dauert lokal rund acht Minuten, in CI 14 bis 16 Minuten.

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

## Noch offene Schritte (Release-Gates)

- Remote-D1 gegen Git verifizieren (`npm run norms:runtime:d1-verify`) und Produktions-Smoke nach
  dem Deployment; beides scheitert derzeit am Free-Tier-Leselimit von D1 und ist als Release-Gate
  im README geführt.
- Zurückgestellte Reviewfälle (`DEFER` in `data/recht/revosax-baseline-decisions.json`, Details in
  `data/recht/revosax-import-audit/envelopes.json`): Mantelbestandteile, deren Artikel nicht
  maschinell zuzuordnen ist.
- PDF-only-Vorschriften 1018 (Übereinkommen als Scan ohne Textebene) und 17114 (Fragebogen-Anlage):
  Anlagen sind archiviert, Materialisierung bleibt Reviewfall.
- Prüfmarken sichten: Typ-B- und unklare „Quelle endet ohne Nachfolger“-Fälle sowie Fassungen ohne
  Erlassdatum in `data/recht/revosax-import-audit/review-flags.json`.
- Altbestand mit sächsischen Bezeichnungen (`data/recht/ost-residual-backlog.json`) über die
  Konsolidierung aus `Gesetze/` nachziehen.
- Sachgebiete, Schlagwörter und Kurzfassungen der übernommenen Normen sind deterministisch
  abgeleitet und generisch; redaktionelle Verfeinerung offen.
