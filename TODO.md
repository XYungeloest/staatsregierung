# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## OstRecht

- [ ] Abgeleitete Metadaten der übernommenen Normen nachschärfen: Schlagwörter und Kurzfassungen
  der REVOSax-Baseline sind deterministisch aus Typ und Titel abgeleitet und im Import-Audit als
  `derivedMetadata` gekennzeichnet. Die Sachgebiete folgen der amtlichen Systematik;
  `derivedMetadata.subjects` zählt, wie viele Zuordnungen die Fundstellennummer belegt und wie
  viele aus der Ableitungskette stammen, die Zweifelsfälle stehen in
  `data/recht/subject-assignment-review.json`. Fertig, wenn redaktionell geprüfte Schlagwörter und
  Kurzfassungen vorliegen und die Kennzeichnung in `data/recht/revosax-import-audit/summary.json`
  entfällt.
- [ ] Übergangsregel des Base-State-Guards abschließen: Code, Tests, Workflow-Schritte und
  Runbook kennen nur noch die Identität aus dem Code-Abschluss; der Guard akzeptiert keine frühere
  Berechnung mehr. Fertig, wenn Staging und Produktion eine Identität der neuen Berechnung tragen
  (`npm run norms:runtime:d1-sync -- --remote-state …` meldet für beide No-op).

### Bestand und Struktur


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


### Verkündungen und Startseite

- [ ] Startseite: Das Raster „Schnellzugriff“ hat vier Spalten für fünf Karten („Sachgebiete“
  steht allein in der zweiten Reihe), drei von vier „Aktuelle Änderungen“ tragen den
  Platzhalter „Verkündung.“, unter „Künftige Änderungen“ steht der Maßnahmekatalog Bienen mit
  „tritt künftig in Kraft“ neben dem Hinweis „Tritt durch Befristung … außer Kraft“, und „PDF
  und HTML“ sowie „Zugänglich — Responsiv und barrierearm“ sind Format- und Websprache. Fertig,
  wenn das Raster bei 1280 px keine Einzelkarte lässt, Einträge ohne Änderungsnotiz den
  Vollzitatanfang statt „Verkündung.“ zeigen, künftiges Außerkrafttreten als „tritt außer
  Kraft“ beschriftet ist und die Funktionsliste in Nutzersprache steht.

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
