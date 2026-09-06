# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## OstRecht

- [ ] Abgeleitete Metadaten der übernommenen Normen nachschärfen: Sachgebiete, Schlagwörter und
  Kurzfassungen der REVOSax-Baseline sind deterministisch aus Typ, Ressort und Titel abgeleitet und
  im Import-Audit als `derivedMetadata` gekennzeichnet. Fertig, wenn redaktionell geprüfte Werte
  vorliegen und die Kennzeichnung in `data/recht/revosax-import-audit/summary.json` entfällt.
- [ ] Cloudflare-Plan festlegen: Workers Paid ist für den Betrieb mit dem Vollbestand vorgesehen
  (Schreibvorgänge einer Vollprojektion, CPU-Zeit großer Normen). Fertig, wenn der Plan aktiv ist
  und `docs/DEPLOYMENT_RUNBOOK.md` die geltenden D1-Limits nennt.
- [ ] Übergangsregel des Base-State-Guards entfernen: `projectionIdentity` liefert neben dem
  Fingerabdruck einen `legacyFingerprint` (Logikhash über ganze Verzeichnisse statt über den
  Code-Abschluss), den `decideSyncAction`, `validateProof` und die Seed-Cache-Schlüssel
  (`legacyFingerprint` in `runtimeSeedIdentity`, zweiter Restore-Schritt in `d1_token_check` und
  `d1_sync`) als Basiszustand akzeptieren, damit eine vor dem Abschluss-Algorithmus geschriebene
  D1 keine Recovery-Vollprojektion auslöst. Fertig, wenn Produktion und Staging eine Identität der
  neuen Berechnung tragen (`npm run norms:runtime:d1-sync -- --remote-state …` meldet No-op) und
  `legacyFingerprint`, `legacyProjectionLogicHash` samt Tests in
  `tests/recht-d1-sync-guard.test.mjs`, `tests/d1-projection-proof.test.mjs` und
  `tests/d1-projection-closure.test.mjs` sowie die Legacy-Restore-Schritte der Workflows gelöscht
  sind.

### Bestand und Struktur

- [ ] Übernommene Änderungsvorschriften aus den Verzeichnissen herausnehmen: 3336 der 5209 Normen
  tragen den Normtyp Änderungsvorschrift, davon 3276 aus dem sächsischen Rechtsstand übernommen
  und 60 ostdeutsch neu. Die übernommenen stehen gleichberechtigt neben Stammnormen in
  Sachgebieten (72 von 95 Einträgen in „Staats- und Verfassungsrecht“), im A–Z, in der
  Rechtsentwicklung und in den Bestandszahlen („5209 Vorschriften im Bestand“ gegenüber „1867
  geltende Vorschriften“ auf der Startseite). REVOSax führt Änderungsvorschriften nur in der
  Normenhistorie der Stammnorm und als eigenen Vorschriftentyp (ÄG, ÄVO, ÄVwV) in der Suche.
  Ostdeutsche Änderungsvorschriften bleiben sichtbar: Neues ostdeutsches Recht soll leichter zu
  finden sein als altes sächsisches. Fertig, wenn Verzeichnisse, Sachgebiete, A–Z und
  Rechtsentwicklung standardmäßig Stammnormen und ostdeutsche Änderungsvorschriften zeigen,
  übernommene Änderungsvorschriften nur über den Normtyp-Filter oder die Herkunftsfacette
  erscheinen, jede Änderungsvorschrift aus der Historie ihrer Stammnorm verlinkt ist und alle
  Bestandszahlen dieselbe Grundmenge nennen („x Vorschriften, davon y geltend“).
- [ ] Sachgebiete zu einer nummerierten Systematik zusammenführen: 43 flache Sachgebiete mit
  Nahdubletten (Bildung und Schule, Bildung und Weiterbildung, Bildung und Wissenschaft,
  Schulrecht; Grenzpolizei, Grenzschutz; Öffentlicher Dienst, Öffentliches Dienstrecht; Innere
  Sicherheit, Sicherheit und Ordnung, Polizei- und Ordnungsrecht; Sozialrecht, Arbeit und
  Soziales, Gesundheit und Soziales), 17 Sachgebiete mit höchstens fünf Normen und der
  Sammelposten „Landesrecht“ mit 1500 Normen. REVOSax ordnet jede Vorschrift über eine
  Gliederungsnummer (Fsn-Nr., etwa 312-V97.1) in acht Hauptgruppen mit Untergruppen ein.
  Fertig, wenn eine zweistufige nummerierte Systematik mit Zuordnungstabelle alter zu neuen
  Sachgebieten in `packages/shared/src/config/` liegt, „Landesrecht“ als Sachgebiet entfällt,
  jede Norm mindestens eine Untergruppe trägt und Sachgebietsseiten, Filter und Startseite die
  Systematik in derselben Reihenfolge zeigen (ergänzt den Eintrag zu den abgeleiteten
  Metadaten).
- [ ] Verzeichnisse und A–Z nach Ordnungswort sortieren: Die Sortierung nach amtlichem Langtitel
  bündelt 108 von 310 Gesetzen unter G („Gesetz über …“), 285 von 615 Verordnungen und 456 von
  577 Verwaltungsvorschriften unter V, im A–Z 1419 Einträge unter V; die Buchstabenleiste ist in
  drei von vier Verzeichnissen ohne Nutzen. Fertig, wenn Verzeichnisse und A–Z nach einem in
  `packages/shared/src/lib/norms/presentation.ts` abgeleiteten Ordnungswort sortieren
  (Kurztitel, sonst Titel ohne Gattungspräfix „Gesetz über/zur“, „Verordnung des … über“,
  „Verwaltungsvorschrift des … zur“), die Ableitung getestet ist und ein Korpus-Test prüft,
  dass kein Buchstabe mehr als ein Viertel eines Verzeichnisses trägt.
- [ ] Verkündungen und Fundstellennachweise zusammenführen: Beide Seitenfamilien tragen
  dieselben Filter (Verkündungsblatt, Jahr, Ausgabennummer, Normtyp, Suchbegriff), denselben
  Kopf und dieselbe Jahresleiste; die Fundstellen sortieren nicht chronologisch (1. März 2024,
  dann 29. Juli 2026, 9. Januar 2026 …) und benennen Einzelverkündungen falsch („Amtliche
  Einzelverkündung 2024 Nr. 1. März 2024“). Fertig, wenn `/fundstellen/` als Ansicht „Einträge“
  innerhalb von `/verkuendungen/` geführt wird (Umschalter Ausgaben/Einträge, alte Adresse
  leitet weiter), beide Ansichten nach Ausgabedatum absteigend sortieren und Einzelverkündungen
  als „Amtliche Einzelverkündung vom …“ erscheinen.
- [ ] Rechtsentwicklung als Suchansicht statt viertem Verzeichnis: `/rechtsentwicklung/` hat ein
  eigenes Filterformular (Freitext, Rechtsentwicklung, Normtyp, Sachgebiet, Status) mit eigener
  Statusliste („Alle Status / außer Kraft / einmaliger Rechtsakt / historische Fassung / in
  Kraft“), die von der Rechtsstand-Auswahl der Verzeichnisse („Geltend / Zukünftig / Historisch
  oder aufgehoben“) und der Status-Facette der Suche abweicht. Fertig, wenn die Herkunftszahlen
  als Kacheln auf der Suche oder Startseite stehen, die Liste auf `/suche/` mit vorbelegter
  Facette „Rechtsherkunft“ verweist (alte Adresse leitet weiter) und es nur noch eine
  Status-Wortliste gibt (siehe Benennungen).
- [ ] Förderrichtlinien nach Förderbereichen gliedern: `/foerderrichtlinien/` ist ein flaches
  Verzeichnis mit 215 Einträgen und Buchstabenleiste (V: 7, G: 1); REVOSax gliedert
  Förderrichtlinien in Haupt- und Unterkategorien. Fertig, wenn Förderrichtlinien nach
  Förderbereich gruppiert sind (aus Ressort und Sachgebiet abgeleitet, redaktionell
  überschreibbar), die Seite die Bereiche mit Zahl voranstellt und die Buchstabenleiste dort
  entfällt.
- [ ] Stichwortregister in Bürgersprache: REVOSax führt einen alphabetischen Index mit
  bürgernahen Stichwörtern, die auf Vorschriften verweisen; das A–Z unter `/archiv/` mischt
  Titel, Abkürzungen und aus Titelwörtern abgeleitete Schlagwörter (`inferKeywords` in
  `scripts/lib/revosax-metadata.mjs`). Fertig, wenn ein redaktionell gepflegtes Register
  (eigene Datei unter `content/` oder gekennzeichnetes Feld) existiert, ein Stichwort auf
  mehrere Normen verweisen kann, das A–Z Stichwörter sichtbar von Titeln trennt und die
  Adresse `/a-z/` heißt (`/archiv/` leitet weiter; „Archiv“ meint sonst die R2-Ablage).

### Suche

- [ ] Suchtreffer serverseitig blättern und zählen: `/api/suche.json` liefert je Anfrage bis zu
  145 Dokumente mit vollständigen `hitUnits` (3,6 MB entpackt, 0,8 MB übertragen, 1,3 s bei
  „Gemeinde“), die Seite fordert sie beim Aufruf zweimal an (mit und ohne
  `includeAmendments`), der Client rechnet daraus „Mindestens 71 Treffer“, obwohl der Server
  `total: 1040` kennt, und „Weitere Treffer anzeigen“ blättert nur innerhalb der 120
  Kandidaten. Fertig, wenn der Server je Seite höchstens 20 Treffer mit fertig gekürzten
  Textausschnitten (höchstens 300 Zeichen je Einheit) und die Gesamtzahl liefert, die
  Trefferzeile die Gesamtzahl nennt, pro Suche genau eine Anfrage gestellt wird, `offset` das
  Blättern trägt und der Zählkonsistenz-Smoke-Test die Serverzahl gegen die Verzeichnisse
  prüft.
- [ ] Überschrift nicht doppelt im Textausschnitt: `collectBodyContent` in
  `packages/recht-search/src/search.ts` schreibt Label und Titel einer Einheit in `text`, die
  Trefferliste zeigt beides zusätzlich als Vorspann-Link („§ 1 Verwaltungseinheit
  Annaberg-Buchholz: § 1 Verwaltungseinheit Annaberg-Buchholz Die Gemeinde …“, 20 von 20
  Treffern). Fertig, wenn der Ausschnitt mit dem ersten Satz nach der Überschrift beginnt,
  Label und Titel nur im Vorspann-Link stehen und ein Suchtest das für Paragraph-, Artikel- und
  Nummerneinheiten prüft.
- [ ] Treffer verdichten: Ein Treffer ist bei 375 px rund 400 px hoch (Titel doppelt, Metazeile,
  Ausschnitt mit doppelter Überschrift, „Weitere Angaben“). Fertig, wenn ein Treffer ohne
  aufgeklappte Angaben bei 375 px höchstens 220 px hoch ist (Messung in `tests/visual.spec.ts`)
  und die Metazeile bei „Übernommen und unverändert“ die Fundstelle statt der Herkunft führt.

### Normseite

- [ ] Normarbeitsbereich zwischen 64 und 80 rem zweispaltig: `.norm-workspace` fällt bei
  `width <= 80rem` auf eine Spalte zurück und blendet `.norm-outline--desktop` aus; bei 1280 px
  bleibt neben dem 598 px breiten Text die halbe Breite leer und die Inhaltsübersicht muss über
  „Inhalt der Vorschrift“ aufgeklappt werden. Fertig, wenn zwischen 64 und 80 rem
  Inhaltsübersicht und Text nebeneinander stehen (Vorschriftendaten darunter), die Übersicht
  dort klebend bleibt und `DESIGN.md` (Responsives Verhalten) die Stufe beschreibt.
- [ ] Fassungsnavigation nur aus Unterseiten: Die Reihe „Aktuelle Fassung · Historische Fassungen ·
  Änderungsverlauf · Fassungsvergleich“ mischt Unterseiten (`/`, `/history/`, `/vergleich/`) mit
  dem Sprungziel `/history/#historieneintraege`; dasselbe Ziel heißt auf der Startseite
  „Änderungsverlauf“ (→ `/history/`) und auf der Normseite „Alle Änderungen anzeigen“
  (→ `/history/`), und „Historische Fassungen“ listet auch die geltende Fassung und erscheint
  selbst bei Normen mit nur einer Fassung. Fertig, wenn die Reihe nur Unterseiten mit
  `aria-current` enthält — entweder entfällt „Änderungsverlauf“ und `/history/` heißt „Fassungen
  und Änderungen“ mit einer Sprungleiste zu den beiden Abschnitten, oder der Änderungsverlauf
  wird eine eigene Unterseite `/norm/<slug>/aenderungen/` — und Startseite, Normseite und
  Verzeichnisse auf dieses eine Ziel mit demselben Wort verweisen.
- [ ] Normkopf mobil verdichten: Bei 375 px ist der Kopf 506 px hoch, der Vorschriftentext
  beginnt erst bei 1260 px (Kopf, Werkzeugleiste, Fassungsnavigation, Rechtsstand-Kasten);
  „Als HTML lesen“ verweist auf `#normtext` und ist ein falsch beschrifteter Sprunglink. Fertig,
  wenn unter 48 rem Zusammenfassung, Fundstelle und Rechtsstand-Kasten in einem
  Aufklappbereich „Angaben zur Vorschrift“ liegen, ein Link „Zum Vorschriftentext“ den Sprung
  übernimmt, der Text spätestens bei 700 px beginnt (Messung in `tests/visual.spec.ts`) und der
  Werkzeugplatz „Als HTML lesen“ entfällt oder eine echte Gesamtansicht ohne Portalrahmen
  öffnet.
- [ ] Vorschriftendaten einmal statt viermal: Normtyp, Fassungsstand, „In Kraft ab“,
  Quellenbeleg und Fundstelle/Vollzitat erscheinen im Kopf, im Kasten „Rechtsstand und
  Herkunft“, im Block „Zitieren und Rechtsstand“ und unter „Vorschriftendaten“ (die
  REVOSax-Quelle dreimal verlinkt); Werte wie „zum redaktionellen Stichtag geltend“,
  „Vollständige Ausgangsfassung zum Rechtsüberleitungsstichtag. · 1. November 2023“ und
  „Ausgangsfassung zum Rechtsüberleitungsstichtag 2023-11-01“ sind Systemsprache. Fertig, wenn
  jede Angabe genau einmal steht (Kopf: Titel, Kurztitel, Abkürzung, Normtyp, Fassungsstatus;
  ein Block „Vorschriftendaten“: Vollzitat, Fundstelle, Rechtsstand, Herkunft, Quelle,
  Sachgebiete, Ressort), Daten ausgeschrieben sind und `NormMetaCard.astro`,
  `NormLegalStatusPanel.astro` und `NormCitationBlock.astro` in
  `apps/recht/src/components/norms/` zu einer Komponente zusammengeführt sind.
- [ ] Statuszeile des Normkopfs: „Aktuelle Fassung · in Kraft seit 15. Oktober 2024“ nennt das
  Inkrafttreten der Stammfassung, Fassungsstand und Rechtsstand-Kasten nennen den 21. Juli
  2026; der Link „Ostdeutsche Änderungsvorschrift“ im Kasten führt ohne Titel auf eine von vier
  Änderungsvorschriften. Fertig, wenn die Statuszeile die Fassung beschreibt („Geltende
  Fassung seit 21. Juli 2026 · Vorschrift in Kraft seit 15. Oktober 2024“), Änderungsvorschriften
  mit Titel und Datum verlinkt sind und ein Test beide Daten gegen `getNormLastChangeDate` und
  das `validFrom` der Stammfassung prüft.
- [ ] Einheitenart statt „Paragraphen“: Der Schalter heißt auch bei Artikeln und Nummern „Alle
  Paragraphen öffnen/schließen“, der Vergleich meldet „132 geänderte Vorschriften“ für
  Einheiten einer Vorschrift, der Werkzeugknopf je Einheit ist ein „···“ ohne sichtbare
  Beschriftung. Fertig, wenn Schalter und Vergleichszähler die Einheitenart der Norm nennen
  („Alle Artikel öffnen“, „132 geänderte Artikel“) und der Werkzeugknopf ab 48 rem ein
  beschriftetes Symbol („Werkzeuge“) ist.
- [ ] Einheiten-Überschriften außerhalb von `<summary>`: Jede Einheit ist ein `<details>`, dessen
  `<summary>` die `<h4>`-Überschrift enthält; Safari mit VoiceOver und Firefox geben
  Überschriften in `summary` nicht als Überschrift aus, die Überschriftennavigation im Normtext
  entfällt damit. Fertig, wenn Überschrift und Aufklappschalter getrennt sind (Überschrift als
  `h4`, Schalter mit `aria-expanded` und `aria-controls`) und `tests/accessibility.spec.ts` die
  Überschriftenfolge im Normtext prüft.
- [ ] Fassungsvergleich: unbeschriftete Absätze inhaltlich paaren: Präambeln und andere Absätze
  ohne Label werden positionsweise gepaart; die Verfassungspräambel (24. März gegen 21. Juli
  2026) erscheint als fünf „Geändert“- und drei „Entfallen“-Paare, obwohl nur Zeilen eingefügt
  wurden („hat sich das ostdeutsche Volk diese Verfassung gegeben.“ gilt als entfallen und
  zugleich als geändert). Fertig, wenn `packages/shared/src/lib/norms/diff.ts` unbeschriftete
  Absätze über eine längste gemeinsame Teilfolge mit Ähnlichkeitsschwelle paart, unveränderte
  Absätze nicht gelistet werden und ein Test mit der Verfassungspräambel höchstens die
  tatsächlich eingefügten Zeilen meldet.
- [ ] Inhaltsübersicht lesbar: Einträge und Labels der Inhaltsübersicht (Desktop und
  Aufklappbereich) stehen in `--text-2xs` (11,52 px), 134 Einträge bei der Verfassung. Fertig,
  wenn Einträge mindestens `--text-sm` verwenden, Labels nicht kleiner als 12 px sind und der
  Stilwächter-Test die Untergrenze für `.outline-list a` festhält.
- [ ] Stichtag ohne Handarbeit fortschreiben: Das Portal zeigt „Geltend am 4. September 2026“,
  während die neueste Verkündung vom 3. September stammt und der Aufruf am 5. September
  erfolgt; `editorial.json` wird von Hand fortgeschrieben. Fertig, wenn ein täglicher Workflow
  `npm run norms:advance-reference-date -- --to <heute> --write` ausführt und das Ergebnis als
  Commit auf `main` landet (Statusfelder mitgezogen, D1-Freigabe nur bei Statuswechsel) oder
  die Oberfläche bei Stichtag vor dem Aufruftag „Rechtsstand vom …“ statt „Geltend am …“
  zeigt.
- [ ] PDF je Fassung: REVOSax bietet für jede Vorschrift „Vorschrift als PDF“; OstRecht zeigt
  für die meisten Normen „Als PDF öffnen · nicht hinterlegt“ und nur die Druckansicht. Fertig,
  wenn für jede Fassung ein aus dem Normtext erzeugtes PDF (Kopf mit Vollzitat und Rechtsstand,
  Seitenzahlen, Hinweis „Portalfassung, keine amtliche Verkündung“) abrufbar ist, der
  Werkzeugplatz zwischen „Amtliche Ausgabe (PDF)“ und „Fassung als PDF“ unterscheidet und die
  Erzeugung getestet ist.

### Verkündungen und Startseite

- [ ] Verkündungsseite: Auf `/verkuendungen/<slug>/` sind die Eintragstitel nicht verlinkt, der
  einzige Link heißt „Fassung 2026-09-03“; die Liste „Ausgabe und Quellen“ enthält zwei nicht
  verlinkte `<strong>`-Zeilen aus `sourceReferences[].label` („Vollständige strukturtragende
  HTML-Fassung der amtlichen Ausgabe“, „Amtliche visuelle Veröffentlichungsfassung“), die Seite
  hat zwei `<main>`-Elemente, „Herausgegeben von Freistaat Ostdeutschland“ ist falsch gebeugt
  und die PDF-Adresse enthält Leerzeichen (`/assets/recht/OGVBl. 2026 Nr. 74.pdf`). Fertig,
  wenn der Eintragstitel auf die Fassung verlinkt („Fassung vom 3. September 2026“ als
  Zusatz), die Quellenliste nur echte Links enthält, genau ein `<main>` existiert (Prüfung in
  `tests/accessibility.spec.ts`), PDF-Dateien unter Slug-Namen liegen und der Satz
  „Herausgegeben vom Freistaat Ostdeutschland“ lautet.
- [ ] Ausgabenkarten ohne doppelten Titel: Karten in `/verkuendungen/` und auf der Startseite
  nennen die Ausgabe zweimal („Staatsanzeiger Ostdeutschland 2026 Nr. 40“, „StAnzO. 2026 Nr.
  40“) und das Verkündungsblatt ein drittes Mal als Faktum. Fertig, wenn die Karte den Langnamen
  als Überschrift, das Kurzzitat nur in der Metazeile und die Einträge mit Titel führt.
- [ ] Startseite: Das Raster „Schnellzugriff“ hat vier Spalten für fünf Karten („Sachgebiete“
  steht allein in der zweiten Reihe), drei von vier „Aktuelle Änderungen“ tragen den
  Platzhalter „Verkündung.“, unter „Künftige Änderungen“ steht der Maßnahmekatalog Bienen mit
  „tritt künftig in Kraft“ neben dem Hinweis „Tritt durch Befristung … außer Kraft“, und „PDF
  und HTML“ sowie „Zugänglich — Responsiv und barrierearm“ sind Format- und Websprache. Fertig,
  wenn das Raster bei 1280 px keine Einzelkarte lässt, Einträge ohne Änderungsnotiz den
  Vollzitatanfang statt „Verkündung.“ zeigen, künftiges Außerkrafttreten als „tritt außer
  Kraft“ beschriftet ist und die Funktionsliste in Nutzersprache steht.
- [ ] Verzeichniseinträge: Jeder Eintrag beginnt mit einem unbeschrifteten Datum (`<time>` mit
  dem Fassungsstand), 41 von 50 VwV-Einträgen zeigen die Beschreibung „Enthält die Regelungen
  der am 1. November 2023 übernommenen Ausgangsfassung „…““, die nur den Titel wiederholt, und
  „Rechtsstand: in Kraft“ bzw. „Rechtsstand: einmaliger Rechtsakt“ verwendet „Rechtsstand“ für
  einen Status. Fertig, wenn `DirectoryEntry.astro` das Datum beschriftet, generierte
  Platzhalterbeschreibungen nicht rendert (stattdessen die Vollzitat-Kurzform) und der Status
  als „Geltung“ bezeichnet wird.

### Kopf, Layout und Benennungen

- [ ] Hauptnavigation bei 80 rem nicht einklappen: `(width <= 80rem)` versteckt `.law-main-nav`
  und zeigt „Menü“, also auch bei 1280 px, einer der häufigsten Laptop-Breiten; zuvor klappte
  die Navigation erst unter 1184 px. Fertig, wenn die sieben Einträge zwischen 64 und 80 rem
  sichtbar bleiben (kürzere Beschriftung oder Verlagerung von Barrierefreiheit und Staatsportal
  in die Kopfleiste), der Stilwächter-Test bei 1024, 1100 und 1280 px keinen Umbruch findet
  und `DESIGN.md` die Kopf-Zwischenstufe entsprechend beschreibt.
- [ ] Zeigerziele im Änderungsverlauf: 13 Listenlinks der Historie (`.inline-link` in
  Definitionslisten) sind 23 px hoch und unterschreiten die 24-px-Untergrenze (WCAG 2.5.8).
  Fertig, wenn Listenlinks mindestens 24 px hoch sind und `tests/accessibility.spec.ts` die
  Untergrenze für Links außerhalb von Fließtext prüft.
- [ ] Eine Wortliste für Geltung, Rechtsstand und Fassung: Dieselbe Sache heißt „Rechtsstand“
  (Verzeichnisfilter: Geltend / Zukünftig / Historisch oder aufgehoben), „Status“ (Suche und
  Rechtsentwicklung: in Kraft / außer Kraft / einmaliger Rechtsakt / historische Fassung),
  „Gültigkeit“ (Suchtreffer) und „Fassungsstatus“ (Normseite); die Verfassung heißt
  „Verfassung“ (Navigation), „Ostdeutsche Staatsverfassung“ (Brotkrumen, Vergleichsauswahl) und
  „Verfassung des Freistaates Ostdeutschland“ (Titel); Bestandszahlen mischen „geltende
  Vorschriften“, „Vorschriften im Bestand“ und „gespeicherte Fassungen“. Fertig, wenn
  `lawSiteConfig.targetLabels` in `packages/shared/src/config/site.ts` die Begriffe Geltung (in
  Kraft, künftig, außer Kraft, einmaliger Rechtsakt), Rechtsstand (Datum) und Fassung
  (geltend, historisch, künftig) festlegt, alle Filter, Facetten und Karten sie verwenden und
  ein Test die Optionslisten der drei Formulare gegen die Wortliste prüft.
- [ ] Systemsprache aus öffentlichen Texten: „gespeicherte Fassungen/Normfassungen/Rechtsstände“,
  „im Datenbestand nachgewiesen“, „semantischer Anker“, „Rechtsüberleitungsstichtag“,
  „strukturtragende HTML-Fassung“, ISO-Daten („Fassung 2026-09-03“, „gültig ab 2002-12-31“,
  Seitentitel „… 2025-03-12“), „Kranken*findet“ (fehlendes Leerzeichen in der Hilfe), „T: 1
  Vorschriften“ (Buchstabenleiste), „Alle Status“. Fertig, wenn ein Test über die gerenderten
  Seiten (Start, Suche, Verzeichnis, Norm, Historie, Verkündung, Hilfe) keine ISO-Daten und
  keine Wörter einer Sperrliste (gespeichert, Datenbestand, Anker, strukturtragend, Stichtag
  außerhalb der Hilfe) findet und Zähler Singular und Plural korrekt bilden.

### Import aus den eigenen Verkündungen

- [ ] Unterschriftenblöcke aus dem Normtext: In mindestens 22 ostdeutschen Normen (eine
  PR-Prüfung zählte 27) steht der Schlussblock der Verkündung gesperrt gesetzt im Normtext
  („D e r M I N I S T E R P R Ä S I D E N T“, „D i e S T A A T S M I N I S T E R I N D E S
  I N N E R N“), etwa in `wohnvergesellschaftungs-durchfuhrungsverordnung`, `schulmilcherlass`
  und `ostdeutsche-einkommensgrenzen-verordnung`; Vorleseprogramme lesen solche Folgen
  buchstabenweise, die Suche zählt sie als Treffer-Einheit. Fertig, wenn
  `scripts/import-normen.mjs` Ort, Datum und Unterzeichner als eigenen Block `signature`
  ablegt, der als Unterschriftenzeile gerendert und nicht als Einheit indexiert wird,
  gesperrter Satz normalisiert ist (auch Hervorhebungen wie „s o l l“ in `vwv-zur-gvga-und-gvo`
  als Auszeichnung statt Leerzeichen) und `content:check` Folgen aus mindestens vier einzeln
  stehenden Buchstaben im Normtext ablehnt.

### Übernommene Normen aus dem REVOSax-Import

- [ ] Überschrift im Nummerntext: In 259 Fassungen (1249 Einheiten, etwa `vwv-komminfra2009`
  und `anordnung-begnadigungsrecht`) beginnt das erste `item` einer nummerierten `section` mit
  dem Titel der Section („1. Vorbehalt des Begnadigungsrechts“ als Überschrift und erneut als
  Textanfang). Fertig, wenn `scripts/materialize-revosax-norms.mjs` die Überschrift beim Import
  abtrennt, die betroffenen Fassungen neu materialisiert sind und `content:check` einen Text
  ablehnt, der mit dem Titel seiner übergeordneten Einheit beginnt.
- [ ] Sächsische Rechtsakte nach dem Überleitungsstichtag: Übernommene Normen tragen Fundstellen
  und Beziehungen nach dem 1. November 2023 („zuletzt enthalten in der Verwaltungsvorschrift
  vom 27. November 2025 (SächsABl. SDr.)“, Beziehung „ändert“ zur VwV der Staatskanzlei),
  stehen aber als „Übernommen und unverändert“ mit Fassungsstand 1. November 2023. Fertig, wenn
  eine Importregel festlegt, ob solche Rechtsakte verworfen, als ostdeutsche Änderungen
  übernommen oder als „nicht konsolidierte Änderung“ ausgewiesen werden,
  `data/recht/revosax-import-audit/summary.json` die betroffenen Normen zählt und keine Norm
  zugleich „unverändert“ und Ziel einer Beziehung „ändert“ mit Datum nach dem Stichtag ist.
- [ ] Normtyp von Verkündungseintrag und Norm: In `content/verkuendungen/oabl-2025-09.json` ist
  die Allgemeinverfügung zum Alexanderplatz als Eintragstyp `gesetz` mit Zitat „Gesetz vom
  31. Dezember 2025“ geführt, die Norm selbst als `allgemeinverfuegung` ohne Geltungsende und
  weiter „in Kraft“. Fertig, wenn `content:check` Eintragstyp und Normtyp abgleicht, das Zitat
  aus dem Normtyp gebildet wird und befristete Allgemeinverfügungen ein `validTo` tragen.

## Sitzungsmediathek der Volkskammer

Große Audio- oder Videodateien dürfen weder unter `public/` (Workers Static Assets: 25 MiB je
Datei) noch als Git-Blob in einen Pull Request gelangen; die Medien-CSP lässt nur die eigene Origin
zu. Die Mediathek betrifft zunächst aufgezeichnete öffentliche Sitzungen, keinen Livebetrieb. Die
benötigten Entscheidungen und Unterlagen stehen in `docs/ZUARBEITSFORMULAR.md` (Abschnitt M).

- [ ] Fachlichen Auftrag mit der Volkskammer festlegen (Redaktion, Öffentlichkeit, Formate,
  Download, Aufbewahrung, Depublikation, Volumen). Fertig, wenn Abschnitt M des
  Zuarbeitsformulars ausgefüllt vorliegt.
- [ ] Architekturentscheidung mit Kostenprobe für Cloudflare Stream (Video), R2 (Audio, Downloads)
  und eine externe Plattform; monatliches Kostenlimit und Warnschwellen. Fertig, wenn die
  Entscheidung samt Kostenprobe im Deployment-Runbook dokumentiert ist.
- [ ] Validiertes Contentmodell unter `content/volkskammer/sitzungen/` (Metadaten in Git,
  Binärdaten nur im Mediendienst; Stream-UID bzw. R2-Schlüssel, Prüfsumme, Dauer und
  Verarbeitungsstatus als Referenzen). Fertig, wenn Schema, `content:check` und `CONTENT.md` das
  Modell tragen.
- [ ] Portalbereich `/volkskammer/sitzungen/` mit barrierearmem Player (kein Autoplay,
  Tastaturbedienung, Untertitel/Transkript als Veröffentlichungsvoraussetzung), geschütztem
  Uploadablauf (kurzlebige Einmal-URLs, resumierbare Uploads, serverseitige Validierung),
  R2-Custom-Domain statt `r2.dev`, minimalen CSP-Anpassungen ohne Wildcards sowie Tests für
  Schema, Suche, Sitemap, Wiedergabe und Barrierefreiheit. Fertig, wenn eine längere öffentliche
  Sitzung als Pilot veröffentlicht, gemessen und abgenommen ist.
