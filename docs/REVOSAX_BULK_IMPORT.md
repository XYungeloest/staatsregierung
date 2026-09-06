# REVOSax-Bestand, D1-Projektion und lokaler Seed

Runbook für den übernommenen sächsischen Rechtsbestand in OstRecht: Import aus REVOSax,
Rechtsüberleitung, Archivierung in R2, Materialisierung in Git, Projektion nach Cloudflare D1 und
der lokale D1-Seed für Tests. Aktuelle Bestandszahlen werden nicht hier gepflegt, sondern mit den
genannten Befehlen und Audits erzeugt (`data/recht/revosax-import-audit/summary.json`,
`npm run norms:runtime:d1-verify`).

## Stichtagsprinzip

OstRecht enthält den vollständigen REVOSax-Bestand, der am Rechtsüberleitungsstichtag
**1. November 2023** galt – einschließlich der Änderungsvorschriften, die REVOSax in der
erweiterten Suche standardmäßig ausblendet. Für jeden Treffer der Stichtagssuche wird genau die
Fassung übernommen, die REVOSax für diesen Tag ausliefert. Weder der heutige REVOSax-Stand noch die
sächsische Versionshistorie vor dem Stichtag werden importiert. Spätere Fassungen entstehen
ausschließlich aus ostdeutschen Verkündungen, geprüften Änderungsvorschriften und deterministischen
Konsolidierungsregeln (`docs/NORM_WORKFLOW.md`).

**Rechtsakte nach dem Stichtag.** Die sächsische Fundstellenpflege führt übernommene Vorschriften
in jährlichen Bereinigungsvorschriften weiter („zuletzt enthalten in der Verwaltungsvorschrift vom
27. November 2025 (SächsABl. SDr. …)“). Solche Aufnahmeklauseln ändern das Recht nicht und wirken
nicht in Ostdeutschland; `scripts/lib/revosax-citation.mjs` entfernt sie aus der übernommenen
Zitierung (`containmentDatesFromCitation`, `stripFutureContainmentClause`), Klauseln vor dem
Stichtag bleiben erhalten. Ein sächsischer Rechtsakt, dessen Erlassdatum oder Fassungsbeginn nach
dem Stichtag liegt – bei Artikeln einer Mantelvorschrift auch deren Fassungsbeginn –, gehört nicht
zum übernommenen Rechtsstand: Der Materialisierungsplan führt ihn als `SKIP` mit dem Grund
`post-cutoff-saxon-act`. Ausgenommen sind Fälle mit einer redaktionellen Entscheidung in
`data/recht/revosax-post-cutoff-decisions.json` (Schlüssel ist der Slug; Felder `slug`,
`revosaxLawId`, `resolution` `discard`|`adopted`|`open`, `adoptingNorm`, `basis`, `reason`,
`decidedAt`): `adopted` nennt die ostdeutsche Änderungsvorschrift, die den späteren Zwischenstand
als Ausgangsfassung übernimmt (Konsolidierungsweg), `open` hält den Fall begründet offen und lässt
die Norm unverändert im Bestand (dokumentiert in `CONTENT_GAPS.md`), `discard` entfernt sie mit
`--regenerate --prune-baseline`. `scripts/audit-norm-derivations.ts` prüft die Regel über den
gesamten Bestand: Eine übernommene, unveränderte Norm nennt keinen Rechtsakt nach dem Stichtag und
ist nicht Ziel einer Änderung oder Aufhebung mit späterem Datum.

## Architektur

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

- **Git (`content/normen/`, `content/verkuendungen/`)** ist der fachliche, reviewbare Source of
  Truth. Der Bestand darf nie ausschließlich in D1 oder R2 liegen; Werkzeuge und Agenten arbeiten
  unmittelbar mit den strukturierten JSON-Fassungen.
- **Cloudflare D1 (`ostrecht-recht`)** ist die abgeleitete Laufzeitdatenbank: Normidentität,
  Metadaten, Fassungen, blockweise gespeicherte Normkörper, Quellenmetadaten, abgeleitete Daten,
  Verkündungen und der FTS5-Suchindex. Sie wird ausschließlich durch `scripts/sync-recht-d1.mjs`
  aus Git projiziert.
- **Cloudflare R2 (`ostrecht-recht-quellen`)** ist das unveränderliche Quellen- und Anlagenarchiv
  (REVOSax-HTML, PDFs, Anlagen). Normseiten lesen nie aus R2.

Der Astro-Build von OstRecht liest den Korpus nicht; Norm-, Fassungs-, Historien-, Vergleichs-,
Such-, Verkündungs- und Sitemap-Routen laufen im Worker gegen D1 (`apps/recht/src/lib/runtime/`).
Eine Inhaltsänderung löst deshalb eine D1-Projektion aus, kein OstRecht-Deployment.

## Importpipeline

### 1. Discovery

```sh
npm run norms:revosax:discover-baseline -- --date 2023-11-01
```

`scripts/lib/revosax-discovery.mjs` liest das Suchformular nur zur Strukturprüfung (Geltungstag,
Mantelvorschriften, Modus `fullsearch`, die zwölf Typkürzel `G, ÄG, VO, ÄVO, VwV, ÄVwV, FRL, ÄFRL,
StV, ÄStV, ZuG, ÄZuG`); fehlende oder unbekannte Typen brechen ab. Die eigentliche Suche ist der
stateless Request `GET /suche?search_request=<URL-kodiertes JSON>` mit `valid_day`, allen zwölf
Kategorien, `include_envelopes: "1"` und `mode: "fullsearch"`; Folgeseiten werden mit dem
Session-Cookie geladen. Treffer verlinken die konkrete historische Fassung (`/vorschrift/<lawId>.<n>`)
oder die dynamische Stammnorm-URL, wenn die Stichtagsfassung zugleich die aktuelle ist.

Fail-closed: kein Manifest bei fehlender oder abweichender Trefferzahl, doppelten Treffer-URLs,
mehreren Fassungs-URLs je lawId, unvollständiger Pagination, abweichenden Typfacetten, unbekannten
Vorschriftentypen, Treffern ohne „Fassung gültig ab“ oder 0 Treffern. HTTP 429 und 5xx werden mit
Backoff wiederholt; zwischen den Seiten wartet der Crawler. Ergebnis ist
`data/recht/revosax-baseline-2023-11-01.json` (deterministisch nach lawId sortiert).

### 2. Staging und Parsing

```sh
npm run norms:revosax:stage-baseline -- --manifest data/recht/revosax-baseline-2023-11-01.json
```

Optionen: `--stratified N` (gleichmäßige Stichprobe über alle Typen), `--limit`/`--start-at`,
`--law-id`, `--refetch`, `--offline`. Rohquellen werden unter `.cache/revosax-baseline/2023-11-01/`
abgelegt (`raw/` mit SHA-256-Metadaten, `parsed/`, `report.json`) und bei Wiederholungen aus dem
Cache verwendet.

Überschriften stehen genau einmal: REVOSax führt den Titel einer Gliederungseinheit zugleich im
Attribut der Einheit und als erste Zeile ihres ersten Kindes. `stripDuplicatedHeading` entfernt die
wiederholte Zeile; bleibt kein Text übrig, entfällt der Punkt und seine Unterpunkte rücken an seine
Stelle. Gestrichen wird nur bei vollständiger Übereinstimmung ganzer Zeilen – ein Text, der
lediglich mit demselben Wort beginnt, bleibt unverändert. Gesperrter Satz der Quelle
(Amtsbezeichnungen, „s o l l“) wird bei der Rechtsüberleitung als gewöhnliches Wort übernommen.

Fassungslogik: dynamische Treffer werden über die numerische Stammnorm-URL geladen und auf die
tatsächlich angezeigte konkrete Fassung festgelegt; „Fassung gültig ab“ muss dem Treffer
entsprechen und das Intervall den Stichtag abdecken, sonst wird die passende historische Fassung
aus dem Fassungsmenü nachgeladen. Treffer ohne eigenen Lesetext sind Übersprungene
(`part-of-envelope`, `no-text-in-revosax`). Zwei Fassungen derselben lawId zum Stichtag werden
verglichen: Alias derselben Fassung → Skip, identischer Text → höhere Fassungsnummer, abweichender
Text → Reviewfall.

Fehler werden klassifiziert (`http`, `parser`, `adapter`, `residual`, `validity`, `manifest`,
`other`); es gibt keine stillen Fallbacks. Reviewkennzeichen sind informativ
(`listing-title-mismatch`, `document-date-mismatch`, `missing-document-date`,
`source-ended-without-successor`, `envelope-not-in-manifest`, `no-provisions`, `legacy-layout`) oder
blockieren die Materialisierung (`attachment-only-content`, `multi-version-text-differs`,
`multi-version-sibling-not-staged`). `parseRevosaxSnapshot()` ist der einzige Parser; ein zweiter
Parser oder ein Plaintext-Fallback ist unzulässig.

Die Kennzeile der Vorschriftenseite trägt die amtliche Form „Langtitel (Kurzbezeichnung –
Abkürzung)“. `parseRevosaxSnapshot()` trennt beide Teile: der Langtitel wird als `longTitle`
geführt, die Kurzbezeichnung als `shortTitle`, die Abkürzung als `abbr`; ein einteiliger
Klammerzusatz ist je nach Form Abkürzung oder Kurzbezeichnung, Jahresspannen bleiben
Titelbestandteil. Die Überschrift der Seite bleibt als `sourceTitle` Provenienz, weil REVOSax dort
häufig nur die Kurzbezeichnung zeigt. Die Materialisierer setzen `title` deshalb aus dem Langtitel
der Kennzeile beziehungsweise der amtlichen Trefferliste und übernehmen `shortTitle` und `abbr` nur,
wenn sie die gemeinsamen Regeln in `scripts/lib/norm-title-rules.mjs` bestehen; abkürzungsartige
Trefferlistenbezeichnungen („Änd. OstSFG“) bleiben Stichwort.

### 3. Rechtsüberleitung (Sachsen → Ostdeutschland)

`scripts/lib/revosax-ost-adapter.mjs` passt Titel, Kurzbezeichnung, Abkürzung, Vollzitat und den
gesamten Normkörper deterministisch an: `Freistaat Sachsen → Freistaat Ostdeutschland`, alle
Flexionsformen von `sächsisch`, Kürzelpräfixe `Sächs… → Ost…` (auch innerhalb zusammengesetzter
Kürzel). Nur ganze Wörter werden ersetzt; `Niedersachsen`, `Niedersächsisch` und `Sachsen-Anhalt`
bleiben unverändert. Geschützt sind ausschließlich die Fundstellenkürzel der Verkündungs- und
Amtsblätter (`SächsGVBl.`, `SächsABl.`, `SächsJMBl.`, `SächsSMBl.`, `SächsMBl.`); Institutions- und
Gesetzeskürzel wie `SächsVerfGHG` sind normativer Text und werden übergeleitet. Der Materializer
berechnet die Anpassung immer neu aus dem unveränderten Parse; ein gespeichertes `adapted` ist nur
Kontrollartefakt.

Reststellenprüfung in drei Stufen, alle fail-closed:

1. Staging: `auditAdaptedRevosaxSnapshot()` über das angepasste Parserobjekt.
2. Materialisierung: erneut über Körper, Zitierung und normative Metadatenfelder.
3. Korpus: `npm run norms:ost:residual-audit` (Teil von `content:check`) prüft alle sichtbaren
   normativen Felder des Gitbestands. Ausgenommen sind nur Provenienzfelder (`sourceReferences`,
   `sourceNotes`, `enactingBody`/`originEnactingBody`, Web- und E-Mail-Adressen) sowie
   Identifikatoren. Übernommenes Recht muss reststellenfrei sein; eigene ostdeutsche Erlasse
   dürfen Sachsen-Bezüge nur tragen, wenn die Stelle wörtlich in der amtlichen Quelle unter
   `Gesetze/` steht oder eine an den PDF-Hash gebundene Prüfung in
   `data/recht/ost-residual-backlog.json` vorliegt. Der Scanner meldet jede Fundstelle einzeln;
   Abweichungen von den dort verzeichneten Zählern lassen den Audit fehlschlagen,
   `--update-backlog` schreibt sie nach einer bewussten Entscheidung fort.

Provenienz-Semantik: `originEnactingBody` nennt das historische Ursprungsorgan der übernommenen
Quelle; `enactingBody` bleibt bei übernommenen Normen leer. `scripts/audit-norm-metadata.mjs`
(Teil von `content:check`) und `scripts/audit-norm-derivations.ts` lehnen ein sächsisches Organ in
`enactingBody` bei REVOSax-Provenienz sowie ein `originEnactingBody` ohne Provenienzbeleg ab;
`npm run norms:migrate-origin-bodies -- --write` migriert Altbestände nur bei belegter Herkunft und
unveränderter Herkunftsklasse.

### 4. R2-Archivierung

```sh
npm run norms:revosax:plan-materialization
npm run norms:revosax:r2-upload -- --plan .cache/revosax-baseline/2023-11-01/materialization-plan.json \
  --envelopes .cache/revosax-baseline/2023-11-01/envelope-components.json --concurrency 4
npm run norms:revosax:archive-attachments
```

Erst wenn `report.json` keine Fehler enthält und der Materialisierungsplan steht, werden die
unveränderten Rohquellen aller `CREATE`- und `MATCH`-Einträge (einschließlich Komponentenseiten
von Mantelbestandteilen und nachgeladener Mantelvorschriften) unter
`revosax/2023-11-01/<lawId>[.<Fassung>].html` archiviert; PDF-Anlagen unter
`revosax/2023-11-01/attachments/<lawId>/<anlagenId>-<Dateiname>`. Der Uploader prüft die Rohdatei
gegen den Stagingbericht, lädt hoch, liest zurück und vergleicht den SHA-256. Die committeten
Manifeste `data/recht/revosax-r2-manifest.json` und `data/recht/revosax-attachments.json` sind die
Referenz für die Provenienzprüfung in `scripts/check-content.mjs`; ein Objekt mit abweichendem Hash
wird nie überschrieben. Ohne `CLOUDFLARE_API_TOKEN` läuft der Transport über die lokale
Wrangler-Anmeldung (`scripts/lib/r2-transport.mjs`); `--dry-run`, `--limit` und `--law-id`
schränken ein.

### 5. Materialisierung in `content/normen/`

```sh
npm run norms:revosax:classify-envelopes             # Bestandteile von Mantelvorschriften einordnen
npm run norms:revosax:plan-materialization
npm run norms:revosax:materialize-baseline            # Prüfung ohne Schreiben
npm run norms:revosax:materialize-baseline -- --write
npm run norms:revosax:materialize-baseline -- --regenerate --write   # nur nach Adapter-/Regeländerungen
npm run norms:revosax:materialize-baseline -- --regenerate --prune-baseline --write   # zusätzlich nicht mehr übernommene Baseline-Normen entfernen
npm run content:check
npm run norms:revosax:import-audit                    # versionierter Import-Audit
```

Identität wird in dieser Reihenfolge geprüft: REVOSax-`lawId` in den Quellenreferenzen (ohne
`envelope-snapshot`) → Quellen-URL → exakter Titel → exakte Kurzbezeichnung → exakte Abkürzung.
Kein Fuzzy-Matching. Die Rückfallstufen greifen nur, wenn keine `lawId` vorliegt; das Titelmodell
(Langtitel statt Kurzbezeichnung in `title`) verändert die Zuordnung deshalb nicht.

| Aktion | Bedeutung |
| --- | --- |
| `CREATE` | neue Norm; Slug deterministisch aus der ostdeutschen Kurzbezeichnung, Kollisionen mit REVOSax-ID |
| `MATCH` | vorhandene Norm mit Fassung zum Stichtag; wird nicht verändert |
| `PROTECT` | vorhandene Norm mit anderer lawId und ohne Stichtagsfassung oder mit späteren Ost-Fassungen bleibt unangetastet |
| `REVIEW` | Identität oder Inhalt nicht eindeutig; blockiert `--write`, sofern nicht zurückgestellt |
| `SKIP` | Alias derselben Fassung, textloser Eintrag, identischer Vorgängertext, Doppelerfassung, dokumentierte Entscheidung, Rechtsakt nach dem Überleitungsstichtag |

**Mantelbestandteile.** REVOSax führt die Artikel einer Mantelvorschrift als eigene Vorschriften
ohne Lesetext. `scripts/classify-revosax-envelopes.mjs` ordnet sie ein (versioniert in
`data/recht/revosax-import-audit/envelopes.json`):

| Klasse | Bedeutung | Plan |
| --- | --- | --- |
| A | Artikel der Mantelvorschrift eindeutig zugeordnet (Anker, dessen Überschrift zum Titel passt; ersatzweise die eindeutig beste Artikelüberschrift oder die Artikelnummer) | `CREATE` als eigene Norm |
| B | technischer Alias (Mantelvorschrift besteht nur aus diesem Artikel) oder Doppelerfassung | `SKIP` |
| C | Artikel besteht nur aus Anlagenverweisen | `SKIP`, Anlagen-Workflow |
| D | kein eindeutiger Anker, kein Artikelkennzeichen, weiterleitende Mantelvorschrift, mehrere Kandidaten | `REVIEW` (`DEFER`) |

Klasse-A-Komponenten werden als `aenderungsvorschrift`/`one-time-act` materialisiert: Titel,
Kurzbezeichnung und Vollzitat von der Komponentenseite, Erlassdatum und Gültigkeitsbeginn aus der
amtlichen Trefferliste, der Text ist der zugeordnete Artikelblock der Mantelvorschrift; beide
Seiten sind R2-Quellen (`official-snapshot`, `envelope-snapshot`). Ist die Mantelvorschrift im
Bestand, trägt die Komponente `containedIn` (Beziehung „Bestandteil von“ / „Enthält als Artikel“).
Zurückgestellte Bestandteile entscheidet `scripts/resolve-revosax-envelope-defers.mjs` über den
Wortstammvergleich des Zielgesetzes mit Überschriften und Eröffnungssätzen der Mantelvorschrift,
das amtliche Klammerkürzel, den REVOSax-Anker und den Ausschluss bereits zugeordneter Geschwister –
nur bei genau einem besten Kandidaten mit deutlichem Abstand. Die Entscheidungen stehen mit
Zielgesetz, Fundstelle, Beleg und Methode in `data/recht/revosax-envelope-decisions.json`; der
Klassifizierer verifiziert jede fail-closed gegen den Artikeltext. Kein blindes Mapping.

`REVIEW`-Fälle werden in `data/recht/revosax-baseline-decisions.json` entschieden (`SKIP` mit
Begründung, Auflösung mit `canonicalSlug`, `DEFER`). Der Plan ist nur schreibbar, wenn kein nicht
zurückgestellter `REVIEW`-Fall existiert. `CREATE`-Einträge erhalten `meta.json`, `history.json`
und `versions/2023-11-01.json` mit R2-Provenienz (Objektschlüssel, amtliche URL, `lawId`,
Abrufzeit, SHA-256, Gültigkeitsintervall, `sourceRole: official-snapshot`); das Erlassdatum stammt
von der Fassungsseite oder der amtlichen Trefferliste – nie geschätzt. Ursprungsorgan,
Schlagwörter und Kurzfassung leitet `scripts/lib/revosax-metadata.mjs` deterministisch ab (im
Import-Audit als `derivedMetadata` gekennzeichnet). Die abgeleitete Kurzfassung trägt im Datensatz
`summarySource: "derived"`; sie ist eine Erschließungshilfe, wird öffentlich nicht ausgespielt und
nicht als Suchtext indexiert. Die Schlagwörter enthalten zusätzlich die Bezeichnung der amtlichen
Trefferliste, damit auch eine nicht als Kurztitel übernommene Kurzbezeichnung auffindbar bleibt.

Die Sachgebiete folgen der amtlichen Systematik. `scripts/lib/revosax-parser.mjs` liest die
Fundstellennummer aus dem Kasten „Fundstelle und systematische Gliederungsnummer“ der
Marginalspalte (`fsnNumber`, zum Beispiel `612-3.10/2`; der Adapter reicht sie unverändert
durch), der Materializer schreibt sie in die Quellenangabe der Norm. `inferSubjectAssignment`
ordnet in dieser verbindlichen Reihenfolge zu und meldet die Herkunft als `basis`: eigene
Fundstellennummer (`fsn`), Fundstellennummer einer anderen Fassung derselben Vorschrift
(`fsn-sibling`), verbundene Norm (`related-norm`), eindeutiger Titeltreffer auf die Stammnorm
(`stem-title`), Regel aus der Dokumentart (`type-rule`: Förderrichtlinie → 55 mit Förderbereich,
Staatsvertrag → 14), frühere redaktionelle Zuordnung (`legacy`), Titelschlüsselwort (`keyword`)
und zuletzt die Prüfliste `data/recht/subject-assignment-review.json` (`review`).
Zweitsachgebiete stammen nur aus amtlichen Signalen. Die einmalige Umstellung des Bestands leistet
`node --experimental-strip-types scripts/migrate-subject-systematics.mjs --write` (ohne `--write`
nur Kennzahlen); sie liest die Fundstellennummern aus `meta.json` und ersatzweise aus dem lokalen
Rohcache. Im Import-Audit zählt `derivedMetadata.subjects` die amtlich belegten gegen die
abgeleiteten Zuordnungen; `derivedMetadata.fields` nennt nur noch Schlagwörter und Kurzfassung. Der Lauf schreibt nichts, solange ein Eintrag
nicht im R2-Manifest archiviert ist, ein Zielverzeichnis existiert oder ein Datensatz die Regeln
verletzt. `--regenerate` schreibt reine Baseline-Normen nach Adapter- oder Regeländerungen neu;
Normen mit weiteren Fassungen oder anderen Quellen sind geschützt.

`summary.postCutoff` zählt die Rechtsakte nach dem Stichtag (`sourcesAfterCutoff`), die bereinigten
Aufnahmeklauseln (`citationsWithContainmentClauseStripped`), die Entscheidungen nach Auflösung, die
übersprungenen Einträge und die übernommenen Normen, die ohne dokumentierte Adoption von einem
solchen Rechtsakt geändert würden (`unchangedTargetsOfPostCutoffAmends`, muss 0 sein);
`review-flags.json` weist jeden Fall mit der Prüfmarke `post-cutoff-source` aus.

Der versionierte Import-Audit `data/recht/revosax-import-audit/` (`summary.json`, `skips.json`,
`envelopes.json`, `review-flags.json`) entsteht deterministisch aus den Stagingartefakten
(`--check` in der Content-Prüfung). Seine Bilanz muss exakt aufgehen: eindeutige Treffer = eigene
Normen + vorhandene (MATCH) + geschützte + REVIEW + SKIP. Die Prüfmarke „Quelle endet ohne
Nachfolger“ wird dort eingeordnet (siehe Befristungen).

## D1-Synchronisation

Genau eine Umfangsangabe ist Pflicht; ein Aufruf ohne Umfang bricht ab:

```sh
npm run norms:runtime:d1-sync -- --full --budget full         # Initialimport, bewusste Vollprojektion
npm run norms:runtime:d1-sync -- --slug foo --slug bar        # gezielte Normen (Teilsync, Identität bleibt)
npm run norms:runtime:d1-sync -- --delete alt-slug            # aus Git entfernte Normen samt abhängiger Zeilen löschen
npm run norms:runtime:d1-sync -- --publications               # Verkündungstabelle neu schreiben
npm run norms:runtime:d1-sync -- --git-diff <base> <head> --budget incremental --recover   # CI (Base-State-Guard)
npm run norms:runtime:d1-sync -- --remote-state --git-diff <base> <head> --budget incremental   # nur Identität, Umfang, Entscheidung (Sekunden; Exit 3 = Release-Gate nötig)
npm run norms:runtime:d1-sync -- --changed-paths pfade.txt    # Umfang aus einer Pfadliste (Teilsync)
npm run norms:runtime:d1-prove -- --base <base> [--head HEAD]  # Äquivalenznachweis Basis → Ziel (lokale Projektionen, Tabellenvergleich)
npm run norms:runtime:d1-sync -- --git-diff <base> <head> --budget incremental --equivalence-proof .cache/d1-equivalence/proof-<…>.json   # nachgewiesenen Umfang schreiben
npm run norms:runtime:d1-closure                              # Dateien des Code-Abschlusses (Teil der Projektionsidentität), --lines für den Logikhash
npm run norms:runtime:d1-sync -- --full --budget full --database ostrecht-recht-staging   # Staging (Wrangler)
npm run norms:runtime:d1-verify -- --fts-integrity            # Git ↔ D1 (Zähler, Identität, Scope, Stichproben)
```

**Umfangslogik** (`scripts/lib/d1-sync-scope.mjs`): Pfade unter `content/normen/<slug>/` ergeben
genau diesen Slug (fehlendes Verzeichnis: Löschung); `content/verkuendungen/*.json` ergibt die
Verkündung und die Normen, deren Fassungen sie zitieren. Eine Logikänderung ist genau eine
geänderte Datei des Code-Abschlusses der Projektion (Basis oder Ziel) oder eine Schemaänderung
unter `data/recht/d1/`; sie erzwingt die Vollprojektion, sofern kein Äquivalenznachweis etwas
anderes belegt. Ohne sicher bestimmbaren Abschluss zählt fail-closed die konservative Obermenge
(`GLOBAL_TRIGGER_PATTERNS`: Sync und Scope-Bibliotheken, `packages/shared/src/lib/norms/**`,
`packages/shared/src/config/**`, `packages/recht-search/src/**`, Portalbezüge). Themen und Presse (`content/themen/`, `content/presse/`) fließen nur in die
Portalbezüge von `law_norm_derived` ein: Ändert sich ihr projektionsrelevanter Auszug (Slug, Titel,
Rechtsgrundlagen-Normbezüge bzw. Datum und Normbezüge), werden die abgeleiteten Daten aller Normen
neu geschrieben – keine Fassungen, keine Vollprojektion; Hervorhebungen, Teaser, Prioritäten oder
Texte lösen nichts aus. Der redaktionelle Stichtag
(`packages/shared/src/config/editorial.json`) ist ausgenommen: bei `--git-diff` liest der Sync den
bisherigen Stichtag aus dem Basis-Ref und projiziert nur die stichtagsabhängig betroffenen Normen
und die abgeleiteten Daten aller Normen (`scripts/lib/d1-reference-date.mjs`; Gleichheit mit einer
frischen Vollprojektion prüft `tests/recht-d1-reference-date.test.mjs`). Abgeleitete Daten
(`law_norm_derived`) hängen von der Identität anderer Normen ab und werden für alle Normen neu
geschrieben, wenn sich identitätsrelevante Metadaten einer Norm geändert haben oder Normen
hinzukamen bzw. entfielen.

**Äquivalenznachweis statt Vollprojektion** (`scripts/lib/d1-projection-proof.mjs`,
`npm run norms:runtime:d1-prove`). Ändert sich die Projektionslogik, wird nicht angenommen,
sondern gerechnet: Basis (Code und Bestand des Basis-Commits) und Ziel (Arbeitsbaum) werden
vollständig projiziert – aus dem Seed-Cache (`.cache/d1-seed`, Manifest mit Projektionsidentität)
oder lokal (Basis in einem temporären Worktree mit ihrem eigenen Code) – und semantisch verglichen
(`scripts/lib/d1-projection-compare.mjs`: alle Projektionstabellen zeilenweise über den
Primärschlüssel, Volltextstichproben; normalisiert werden nur `updated_at`, `last_sync_at`,
`sync_mode`, `sync_state`, die Identitätszeilen und die rowid der Suchzeilen). Geprüft wird, ob
der inkrementelle Umfang des Syncs – zuerst mit der Logikänderung als datenneutral (`ignore`),
dann als enge Logikprojektion (`narrow`: Suchdokumente, abgeleitete Daten und abgeleitete
Normspalten aller Normen) – auf die Basis angewendet exakt das Ziel ergibt. Ergebnis `identity`
(nur Identität und Laufzeitmetadaten: der Sync berechnet dann keine korpusweiten Ableitungen,
sondern lädt den Bestand nur, um den leeren Umfang zu bestimmen und die korpusabgeleiteten
Zeilen von `law_runtime_meta` neu zu schreiben – `isMetadataOnlyRun`/`planRun` in
`scripts/sync-recht-d1.mjs`; jeder nicht leere oder nicht eindeutig datenneutrale Umfang nimmt
den normalen fail-closed Projektionsweg), `incremental` (nachgewiesener Umfang) oder `full`
(abweichende Tabellen werden genannt; Schemaänderungen sind immer `full`). Die Nachweisdatei ist
an Basis- und Ziel-Commit, alte und neue Identität, Scope, Comparator-Version und Umfangssignatur
gebunden; `--equivalence-proof <Datei>` prüft jede Bindung gegen die gespeicherte Identität in D1
und den Arbeitsbaum, bevor der Sync statt der Vollprojektion den nachgewiesenen Umfang schreibt.
Einen frei setzbaren Bypass (Annahme einer engen Änderung, Neuschreiben der Identität ohne
Vergleich) gibt es nicht. In CI rechnen `d1_token_check` (Pull Request) und `d1_sync` (`main`)
den Nachweis selbst (`docs/DEPLOYMENT_RUNBOOK.md`).

**Projektionsidentität.** `scripts/lib/d1-projection-fingerprint.mjs` bildet aus
Git-Blob-Kennungen (nie aus Änderungszeiten) den Hash der Projektionslogik, den Hash des
Rechtsbestands und den Hash der projektionsrelevanten Auszüge von Themen und Presse
(`portalProjectionOf`; die Auszüge müssen die in `derived.ts` gelesenen Felder abbilden); der
Fingerabdruck ist der SHA-256 über diese Hashes und den Scope (`full` oder
`fixture:<Pfad>@<Hash>`). Die Projektionslogik ist der transitive Code-Abschluss des
Einstiegspunkts `scripts/sync-recht-d1.mjs` (`scripts/lib/d1-projection-closure.mjs`, aufgelöst
mit esbuild: statische und literale dynamische Importe, Re-Exports und Sammeldateien,
JSON-Imports, Workspace-Pakete über ihre `exports`) plus das Schema unter `data/recht/d1/` und die
Versionen externer Pakete im Abschluss; `npm run norms:runtime:d1-closure` zeigt die Dateien.
Reine Darstellung in denselben Verzeichnissen gehört nicht dazu; sie liegt in eigenen Modulen,
die kein Modell-Modul importiert: `config/site.ts` (Bezeichnungen, Navigation, Kontakt, SEO,
`targetLabels`), `norms/origin-presentation.ts` (Herkunftsbadge und Erläuterung),
`norms/display.ts` (Datumsformat, Fundstellenparser, verlinkter Text, Gliederung),
`norms/diff-render.ts`, `norms/diff.ts`, `recht-search/search-query.ts`, die Sammeldatei
`norms/index.ts` und der vollständige Portal-Loader (`portal/loader.ts`, `portal/organization.ts`,
`portal/dates.ts`). Im Abschluss liegen dagegen `config/site-routing.ts` (Origins, Zielsite und
Pfadtabellen: die Routenhelfer schreiben Adressen in Suchdokumente und Portalbezüge),
`norms/presentation.ts` (projizierte Anzeigetexte und Anker), `norms/origin.ts` (Herkunftsmodell
und `formatNormOriginKind`), die schmalen Themen- und Presse-Loader
(`portal/norm-portal-content.ts`, `portal/json-collection.ts`) sowie Dateien außerhalb der
früheren Wurzeln, die der Sync erreicht (`portal/schema.ts`, `repository-root.ts`). Die Trennung
ist eine Modulgrenze, keine Ignore-Liste. Ist der Abschluss unsicher – ein dynamischer Import mit nicht literalem Argument, eine
esbuild-Warnung, ein fehlender Einstieg –, zählt fail-closed die konservative Obermenge. Der Sync
legt Fingerabdruck, Scope und `sync_state = complete` in `law_runtime_meta` ab; ein Lauf bei
identischer Identität ist ein No-op. Ein Fixture kann nie die Identität des Vollbestands behaupten.
Eine geänderte Identität bei gleichen Daten wird nicht behauptet, sondern über den
Äquivalenznachweis übernommen (Ergebnis `identity`: der Sync schreibt nur Identität und
Laufzeitmetadaten).

**Base-State-Guard.** Ein `--git-diff`-Sync schreibt erst, wenn D1 genau die Identität des
Basis-Refs trägt (Scope `full`, Zustand `complete`); sonst fail-closed oder mit `--recover` eine
markierte Recovery-Vollprojektion mit dem Profil `recovery`. Es gibt genau eine akzeptierte
Basis: die Identität des Basis-Refs, berechnet aus dem Code-Abschluss. Der inkrementelle Lauf
entwertet die Identität vor dem ersten Schreibzugriff und schreibt sie erst am erfolgreichen Ende; ein
abgebrochener Lauf wird beim nächsten automatischen Lauf erkannt und repariert. Manuelle Teilsyncs
(`--slug`, `--delete`, `--publications`, `--changed-paths`) verlangen eine vollständige Identität
im selben Scope, schreiben aber keine neue Identität.

**Budgets.** Remote-Läufe tragen immer ein Profil aus `data/recht/d1-sync-budgets.json`
(`--budget incremental|full|recovery|fixture`; `--max-rows-read`/`--max-rows-written`
überschreiben einzelne Grenzen). Der Sync prüft die Planschätzung vor dem ersten Schreibzugriff
(0 Schreibzugriffe bei Überschreitung) und bricht während des Laufs ab, sobald die realen Zähler das
Budget überschreiten. Entscheidung und Profil werden vor dem Planbau abgeglichen
(`assessSyncDecision`): No-op, verifizierter inkrementeller Lauf und markierte Recovery sind mit
`incremental` tragbar; ein `full`-Beschluss endet mit `incremental` sofort fail-closed (keine
Ableitungen, kein Plan, kein Schreibzugriff), weil eine Vollprojektion die produktiven Tabellen
zunächst leert. Der automatische Sync nach einem Push verwendet `incremental`; eine erforderliche
Vollprojektion ist deshalb ein Release-Gate vor dem Merge (`docs/DEPLOYMENT_RUNBOOK.md`), nie ein
erwarteter Fehler auf `main`. `--remote-state` liefert Identität, gespeicherte Identität, Umfang
und Entscheidung in Sekunden (Exit 3, wenn das Gate nötig ist); `--dry-run` baut zusätzlich den
vollständigen Plan mit Anweisungen je Tabelle, Schätzung und Budget.

**Transport.** Mit `CLOUDFLARE_API_TOKEN` (D1 Read/Write) läuft der Sync über die REST-API mit
parametrisierten Batches (`--transport api`, so in CI); ohne Token über die lokale
Wrangler-Anmeldung mit SQL-Dateien unter `.cache/d1-sync/`. Vorübergehende Netz- oder
Anmeldefehler werden je Datei wiederholt. `--local [--persist-to <Verzeichnis>]` schreibt in eine
Miniflare-D1, `--apply-schema` spielt davor die Migrationen ein (nur lokal). Token und
Anmeldedaten werden nie committed.

**Testfixture.** `data/recht/runtime-fixture.json` ist ein synthetisches Manifest
(`"source": "synthetic"`): Rollen, Fassungskennungen, Verkündungsrollen und Suchwörter des Bestands
aus `tests/helpers/fixture-corpus.ts` (Normen, Verkündungen, Themen, Pressemitteilungen – derselbe
Builder wie in den Unit-Tests). Der Seed (`scripts/d1-runtime-seed.mjs`, `OSTRECHT_D1_FIXTURE`)
projiziert diesen Bestand über `scripts/lib/runtime-fixture.mjs` ohne `content/`; der Scope lautet
`fixture:<Pfad>@<Hash über Manifest und Git-Blob des Builders>`, und in diesem Scope ersetzt derselbe
Hash Rechtsbestand und Portalgrundlagen in der Identität – redaktionelle Änderungen unter `content/`
bewegen weder Fixture-Seed noch Screenshot-Baselines. Der Sync importiert den Builder nie (er liegt
außerhalb des Code-Abschlusses); `--corpus-filter` des Syncs akzeptiert nur Slug-Listen realer
Normen (`{ "slugs": [...] }`, nur lokal oder gegen Staging, nie gegen `ostrecht-recht`) und lehnt
das synthetische Manifest ab. Nach Änderungen am Builder wird das Manifest neu geschrieben
(`node --experimental-strip-types --input-type=module -e "import('./scripts/lib/runtime-fixture.mjs').then((m) => m.writeFixtureManifest())"`);
`tests/runtime-fixture-manifest.test.ts` prüft Übereinstimmung und Rollenabdeckung.

**Verifikation** (`scripts/verify-recht-d1.mjs`): Zähler (Normen, Fassungen, Blöcke, Quellen,
abgeleitete Zeilen, Verkündungen, Suchdokumente, Suchzeilen, Stichwörter), `corpus_hash`,
Projektionsidentität und Scope, `sync_state`, optional FTS5-Integrität (`--fts-integrity`) und
deterministische Stichproben (erste und letzte übernommene Norm, eine Norm mit mehreren
Fassungen, eine übernommene Änderungsvorschrift, ein Mantelbestandteil, die größte Norm).
`--local` prüft die Miniflare-Projektion, `--corpus-filter` ein Fixture (synthetisch: Erwartungen
aus dem Builder; Slug-Liste: aus `content/`), `--database` eine andere Zieldatenbank.

## Lokaler D1-Seed für Tests

Browser-, Barrierefreiheits- und Screenshot-Tests laufen gegen den gebauten Worker
(`wrangler dev --local`, `scripts/serve-law-worker.mjs`) mit einer lokalen Miniflare-D1. Den Seed
liefert `scripts/d1-runtime-seed.mjs` als portablen SQLite-Snapshot:

```sh
npm run norms:runtime:d1-seed-fingerprint                  # deterministischer Seed-Fingerabdruck (Cache-Key)
npm run norms:runtime:d1-seed                              # Vollbestand: Snapshot bauen/verifizieren/einsetzen
OSTRECHT_D1_FIXTURE=data/recht/runtime-fixture.json npm run norms:runtime:d1-seed   # synthetisches Fixture (tests/helpers/fixture-corpus.ts)
OSTRECHT_D1_FIXTURE=data/recht/runtime-fixture.json npm run norms:runtime:d1-verify -- --local --fts-integrity --corpus-filter data/recht/runtime-fixture.json   # Fixture-Projektion prüfen
node --experimental-strip-types scripts/d1-runtime-seed.mjs verify   # Snapshot gegen den Arbeitsbaum prüfen
node --experimental-strip-types scripts/d1-runtime-seed.mjs ensure --force   # Neuaufbau erzwingen
npm run norms:runtime:d1-verify -- --local --fts-integrity  # eingesetzte Projektion prüfen
```

- Der Snapshot entsteht mit `node:sqlite` aus demselben Sync-Plan wie die produktive Projektion und
  den echten Migrationen; `scripts/d1-projection-snapshot.mjs compare` weist die tabellenweise
  Gleichheit mit einer Wrangler-Projektion nach.
- Der **Seed-Fingerabdruck** ist der SHA-256 über die Projektionsidentität (Logik, Bestand,
  Portalgrundlagen, Stichtag, Scope), den Inhaltshash der Seed-Werkzeuge, die Versionen von
  wrangler, miniflare und workerd aus `package-lock.json` und die Seed-Formatversion – keine
  Änderungszeiten, keine Laufkennungen. Gleiche Eingaben ergeben denselben Snapshot
  (`.cache/d1-seed/<Datenbank>-<full|fixture>-<Fingerabdruck>.sqlite` mit Manifest); der
  Äquivalenznachweis liest Basis- und Zielprojektion daraus, wenn das Manifest ihre Identität
  trägt (`fingerprint --json --ref <Commit>` nennt den Schlüssel eines Basis-Commits).
- Ein vorhandener Snapshot wird nie blind übernommen: Manifest-Fingerabdruck, Tabellen,
  `projection_fingerprint`, Scope, `sync_state = complete`, Zähler gegen Git und FTS5-Integrität
  werden geprüft, bevor er in den Miniflare-Zustand eingesetzt wird; danach bestätigt eine
  Wrangler-Abfrage, dass der Worker die erwartete Identität liest.
- In CI teilt `.github/actions/d1-seed` den Snapshot des Vollbestands über den Actions-Cache
  (`d1-seed-<Fingerabdruck>`); Ablauf und Laufzeitziele stehen in `docs/DEPLOYMENT_RUNBOOK.md`.

## Schema

`data/recht/d1/0001_rechtsbestand.sql` bis `0007_search_candidate_filters.sql`; produktiv manuell mit
`wrangler d1 execute <Datenbank> --remote --file …` einspielen – zuerst lokal (`--apply-schema`),
dann Staging, dann Produktion, nie automatisch.

| Tabelle | Inhalt |
| --- | --- |
| `law_norms` | Identität, schmale Übersichtsspalten (Sachgebiete, Schlagwörter, Aliasse, Herkunft, Fassungszahl, Buchstabenindex, `is_amendment`, `last_change_date` = jüngste Rechtsänderung bis zum Stichtag ohne bloße Hinweise: Standardsortierung der Übersichten und der Suche ohne Suchbegriff, `last_activity_date` = jüngstes Ereignis einschließlich Hinweisen für `lastmod`) sowie `meta_json`, `history_json` |
| `law_versions` | Fassungen ohne Körper (`version_json`), Vollzitat, Verkündungsbezug (`publication_ref_json` sowie `publication_source` und `publication_year` als Filterspalten), zeitliche Einordnung (`temporal_kind`) |
| `law_version_blocks` | äußere Body-Blöcke als JSON; große Blöcke in Teile (`part_index`) zerlegt |
| `law_source_objects` | Quellenreferenzen je Fassung, bei R2 mit `object_key` |
| `law_norm_derived` | Beziehungen, Empfehlungen, Herkunft, Textverweise, Portalbezüge |
| `law_publications` | Verkündungen als JSON |
| `law_search_documents` | Suchdokument-Metadaten je Fassung (ohne Stichtag; Fassungsbezeichnung entsteht im Browser) |
| `law_search_units` | Provisionen der geltenden Fassung, relational mit Indizes auf `norm_id`, `slug`, `(norm_id, version_id)`; dazu je Fassung eine Ergänzungseinheit (`supplement`) und eine Metadateneinheit (`metadata`: Kurzfassung, Stichwörter, Sachgebiete, Ressort, Zitate, Verkündungsbezeichnungen und frühere Bezeichnungen). Beide sind Suchtext, aber keine Trefferstelle: der Ausschnitt kommt nie aus ihnen. Der Text einer Provision beginnt beim Wortlaut; Nummer und Überschrift stehen in den eigenen Spalten `label` und `heading` |
| `law_search` | FTS5-Index mit externem Inhalt über `law_search_units`, per Trigger rowid-genau geführt |
| `law_norm_subjects`, `law_norm_history`, `law_norm_keywords` | Sachgebiete, Historieneinträge (Datumsindex), Stichwortindex je Buchstabengruppe |
| `law_runtime_meta` | Identität, Zustand, Zähler, `corpus_hash` und vorberechnete Metadatenzeilen (Suchfilter, Sachgebiete, Bestandszahlen) |

Die Metadatenzeile `projection_fingerprint` dient der Laufzeit zugleich als Schlüssel des
Randzwischenspeichers der erzeugten Fassungs-PDF (`/norm/<slug>/version/<versionId>/fassung.pdf`,
`NormStore.getProjectionFingerprint`): jeder Sync setzt einen neuen Fingerabdruck und entwertet
damit alle zwischengespeicherten Dokumente, sodass geänderte Titel oder Vollzitate nie veraltet
ausgeliefert werden.

Kostenpfad: Löschungen laufen nur über Indizes (`law_search_units` mit AFTER-DELETE-Trigger, nie
ein Vollscan des FTS5-Index); die Vollprojektion leert die Tabellen einmalig (FTS5 `delete-all`),
schreibt ohne normweise Löschungen und setzt die Laufzeitmetadaten erst am erfolgreichen Ende.
Die Laufzeit lädt nie den Korpus: Übersichten lesen `NormSummary`-Zeilen mit SQL-Filtern, A–Z und
Rechtsentwicklung paginieren serverseitig, korpusweite Zahlen kommen aus Metadatenzeilen, die
Suche blättert echt über den FTS5-Index; jede Bedingung einer Suchanfrage läuft in SQL (Typ,
Herkunft, Ressort, Sachgebiet, Status, Fassungsart, Verkündungsblatt, Jahr, Ausgabennummer, Seite,
Geltungstag, Gültigkeitszeitraum, Suchbegriffe, Wortfolgen, Ausschlussbegriffe, Strukturadressen
und die Grundmenge der Änderungsvorschriften), damit `total` dieselbe Menge zählt wie die
Trefferliste. Je Anfrage liest sie eine Seite von höchstens hundert Vorschriften, deren
Suchdokumente und höchstens acht Einheiten je Vorschrift.
`tests/recht-runtime-d1-queries.test.ts` protokolliert die Abfrageformen jeder Route.

Änderungen an den Einheiten sind eine Vollprojektion: `law_search_units` trägt seit der Umstellung
der Trefferausschnitte den Wortlaut ohne wiederholte Überschrift und zusätzlich die
Metadateneinheit. Der Äquivalenznachweis (`npm run norms:runtime:d1-prove`) ergibt deshalb `full`;
der Ablauf steht in `docs/DEPLOYMENT_RUNBOOK.md` (lokal, Staging, Produktion).

### Bedeutung von `last_change_date` (Migration 0007)

`law_norms.last_change_date` behält Name und Spalte, meint aber ab Migration 0007 ausschließlich
die **Rechtsänderung** (Erlass, Änderung, Aufhebung, Fassungsbeginn) und nicht mehr jedes
dokumentierte Ereignis: ein reiner Hinweis oder Berichtigungshinweis (`notice`) zählt nicht mehr
mit. Die alte Bedeutung steht in der neuen Spalte `last_activity_date` und trägt `lastmod` der
Sitemap. Zentrale Definitionen: `getNormLastChangeDate` und `getNormLastActivityDate` in
`packages/shared/src/lib/norms/versions.ts`.

Folge für den nächsten Sync: Die Projektionslogik hat sich geändert, damit auch die
Projektionsidentität. Der automatische inkrementelle Sync lehnt den Lauf fail-closed ab; nötig ist
eine **Vollprojektion** (`--full --budget full`), zuerst lokal, dann gegen
`ostrecht-recht-staging`, dann produktiv – kein produktiver `--full`-Sync ohne diesen Grund und
nie ohne Budgetprofil. Reihenfolge wie immer: Migration einspielen, dann projizieren. Die
Migration füllt `last_activity_date`, `is_amendment`, `publication_source` und `publication_year`
für vorhandene Zeilen bereits richtig, damit zwischen Migration und Vollprojektion weder die
Trefferzählung noch `lastmod` falsch wird; erst die Vollprojektion zieht `last_change_date` auf
die neue Bedeutung nach. Betroffen sind wenige Normen – nur solche, deren jüngstes Ereignis ein
Hinweis ist.

**Reihenfolge zwingend, nicht nur empfohlen.** Migration 0007 und die Vollprojektion müssen in der
Zielumgebung abgeschlossen sein, bevor der Worker dieses Releases dort deployt wird. Der Worker
liest `law_norms.last_activity_date` bedingungslos (`SUMMARY_SELECT` in
`apps/recht/src/lib/runtime/store.ts`); gegen eine Datenbank ohne 0007 beantwortet er jede
Rechtsroute mit 500. Umgekehrt ist der Ablauf unkritisch: 0007 ist rein additiv, der alte Worker
liest die migrierte Datenbank unverändert weiter. Produktiv werden Migrationen manuell
eingespielt – zuerst lokal, dann Staging, dann Produktion. Gemergt wird erst, wenn
`d1_token_check` No-op meldet (Schritt 4 des D1-Release-Gates in `docs/DEPLOYMENT_RUNBOOK.md`);
`d1_sync` auf `main` ist dann ein No-op und das Deployment folgt der bereits hergestellten
Projektion.

## Datenform ändern: Expand/Contract

Der Sync läuft vor dem Worker-Deployment; zwischen beiden liest der alte Worker die neue
Projektion. Deshalb gilt die Regel aus `docs/DEPLOYMENT_RUNBOOK.md`: eine neue Datenform wird
zuerst vom Worker verstanden (alt und neu), dann projiziert, und Altkompatibilität wird erst nach
dem Rollout entfernt. Neue Spalten und Felder sind additiv, Umbenennungen laufen über eine
Übergangsprojektion mit beiden Feldern.

## Staging vor Produktion und Recovery

`apps/recht/wrangler.jsonc` bindet unter `env.staging` eigene Ressourcen (D1
`ostrecht-recht-staging`, R2 `ostrecht-recht-quellen-staging`); Wrangler-Environments erben Bindings
nicht. Migration, Vollprojektion, `d1-verify --fts-integrity`, Worker-Deployment
(`npm run deploy:recht:staging`, fail-closed erzeugte Staging-Konfiguration) und Routenprüfung
laufen dort, bevor die produktive Datenbank berührt wird (`tests/staging-wrangler-config.test.mjs`,
`tests/wrangler-config.test.mjs`). Der manuelle Workflow `D1-Token prüfen` liest die produktive
Datenbank nur (`--dry-run`) und beweist den Schreibzugriff mit einer isolierten Probe gegen Staging
(`scripts/d1-write-probe.mjs`).

Recovery: Trägt D1 nicht die erwartete Basisidentität oder einen unvollständigen Zustand,
führt der automatische Sync mit `--recover` eine
markierte Vollprojektion mit dem Profil `recovery` aus.
Bleibt ein Lauf wegen Budgetüberschreitung stehen, sind Identität und Laufzeitmetadaten nicht
geschrieben; die Wiederholung (`--full --budget full`, zuerst Staging) repariert den Zustand
vollständig. Lokale Kontrolle gegen die reale Datenbank:

```sh
npm run build:recht
cd apps/recht && npx wrangler dev --config dist/server/wrangler.json --remote --port 8788
```

## Sicherheits- und Qualitätsregeln

- REVOSax wird mit identifizierendem, zurückhaltendem User-Agent und begrenzter Request-Rate
  abgerufen; HTTP 429 und 5xx mit Backoff. Kein Import gilt als erfolgreich, wenn die Suche mehr
  Treffer meldet als vollständig paginiert wurden.
- Jede Rohquelle erhält SHA-256 und wird nie durch die Rechtsüberleitung verändert; die aktuelle
  REVOSax-Fassung oder die gesamte sächsische Versionshistorie wird nicht importiert.
- Parserfehler werden nicht durch Plaintext-Extraktion kaschiert; restliche Sachsen-Bezüge in
  normativen Feldern blockieren den Import ohne dokumentierte Ausnahme; historische Fundstellen
  (`SächsGVBl.` …) werden nicht umgeschrieben.
- Bestehende ostdeutsche Normen und spätere Ost-Fassungen sind gegen Überschreibung geschützt;
  Mantelbestandteile werden nie blind zugeordnet.
- Kein produktiver `--full`-Sync ohne zwingenden Grund; Lasttests nur lokal (Miniflare) oder gegen
  `ostrecht-recht-staging`; kein Remote-Lauf ohne Budgetprofil; kein inkrementeller Sync ohne
  verifizierte Basis; kein anderer Umfang für eine Logikänderung als der Vollprojektion oder der
  vom Äquivalenznachweis gebundene – Annahmen, Stempel oder frei setzbare Bypässe gibt es nicht.
- `--corpus-filter` nie gegen die produktive Datenbank; Migrationen nie automatisch.
- Keine Cloudflare-Tokens oder anderen Secrets in Git; keine großen Binäranlagen in Git (R2).
- D1 und R2 sind Laufzeit- bzw. Archivspeicher, nicht der alleinige fachliche Wissensbestand.

## Rechtsüberleitung des Altbestands

Die redaktionell konsolidierten Altbestandsnormen (`data/recht/consolidation-sources.json`)
entstanden vor dem Rechtsüberleitungsadapter. `scripts/consolidate-norms.mjs` wendet die
Patch-Rezepte weiterhin auf den unveränderten sächsischen Ausgangstext an (Hashes und
Erwartungswerte beziehen sich auf die amtliche Quelle) und leitet erst das Ergebnis über
(`applyRechtsueberleitung`): alle Fassungen, Historie und redaktionelle Metadaten mit demselben
Adapter wie der REVOSax-Bestand; Provenienz und geschützte Fundstellenkürzel bleiben. Gesperrte
Ziele ohne nutzbare Rezepte werden aus der Ausgangsfassung fortgeschrieben; der Snapshot-Audit
vergleicht die gespeicherte Zitierung mit der übergeleiteten erwarteten.

## Befristungen aus dem übernommenen Text

Die Prüfmarke `source-ended-without-successor` (Quelle endet in REVOSax nach dem Stichtag ohne
Nachfolgefassung) wird eingeordnet: Typ A (kein Befristungsdatum im Text) ist eine spätere rein
sächsische Rechtsänderung ohne Wirkung in Ostdeutschland; Typ B (Befristung im übernommenen Text,
die zum Quellenende passt) gilt in Ostdeutschland fort. Die Entscheidungen stehen mit wörtlichem
Beleg in `data/recht/revosax-sunset-decisions.json`: `sunset-applies` lässt den Materializer
`expiryDate`, `validTo`, Status (`repealed`, sobald das Datum verstrichen ist; sonst künftiges
Ende) und einen Historieneintrag schreiben – deterministisch, auch bei `--regenerate`; `open` lässt
die Norm unverändert und hält den Fall in `CONTENT_GAPS.md` dokumentiert.
