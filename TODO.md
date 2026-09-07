# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## Betrieb

Dieser Punkt stammt aus dem Audit vom 7. September 2026 und ist Betriebsarbeit, keine
Weiterentwicklung. Der Ablauf, der ihn künftig verhindert, steht in
`docs/EINPFLEGE_PLAYBOOK.md`.

- [ ] Themen-Hervorhebung über den 10. September 2026 hinaus sicherstellen:
  `content/portal/topic-coverage.json` verlangt unter `discoverability.minimumActiveHighlights`
  mindestens eine am Stichtag laufende Hervorhebung. `volksbefragung-2026` ist die einzige mit
  laufendem Fenster (9. August bis 10. September 2026); `kommunen-regionen-und-berlin` und
  `wohnen-und-vergesellschaftung` sind abgelaufen. Der Stichtag steht seit dem Eingang StAnzO. 2026
  Nr. 42 auf dem 7. September 2026; jeder Stichtag ab dem 11. September lässt `content:check` und
  `check-topic-coverage` fehlschlagen. Fertig, wenn mindestens ein Thema am fortgeschriebenen
  Stichtag ein laufendes Hervorhebungsfenster trägt, `discoverability.editorialLead` darauf zeigt
  und der Audit `npm run norms:advance-reference-date -- --to <Zieldatum>` laufende Hervorhebungen
  meldet.

## OstRecht

- [ ] Schreiblauf des Normworkflows mit der Metadatenpflege in Einklang bringen: `npm run
  norms:workflow -- --file <Quelle> --write` führt `scripts/materialize-revosax-norms.mjs --all
  --update-existing --write` aus und erzeugt die übernommenen Normen vollständig aus
  `data/recht/parsed/revosax/` neu. Dabei gehen die nachgelagerten Metadatenpflegen von PR #30
  (`fsnNumber` in den Quellenangaben) und PR #39 (amtliche Langtitel statt der Kurzformen des
  Massenimports) verloren: Ein einzelner Eingang aus `temp-neu/` verändert so 146 unbeteiligte
  Dateien unter `content/normen/`, ohne dass ein Check anschlägt. Beim Eingang StAnzO. 2026 Nr. 42
  wurden diese Dateien deshalb von Hand zurückgesetzt. Fertig, wenn ein Schreiblauf des
  Normworkflows auf einer unveränderten Auscheckung von `main` außer den Dateien der eingepflegten
  Quelle keine Änderung erzeugt — entweder weil der Materialisierer die gepflegten Felder erhält
  oder weil die Verfeinerung (`scripts/refine-revosax-derived-metadata.mjs`) Teil des Workflows
  wird.
- [ ] Redaktionelle Kurzfassungen nachtragen: 4.981 der 5.200 Vorschriften tragen keine
  Kurzbeschreibung, seit die aus dem Titel gebildeten Formeln des Massenimports entfernt sind. Die
  Oberfläche lässt die Zeile dort leer; `summary` ist ein freiwilliges Feld. Der Arbeitsvorrat steht
  vollständig und nach Normtyp aufgeschlüsselt in `data/recht/norm-summary-review.json`
  (Änderungsvorschrift 3.267, Verordnung 579, Verwaltungsvorschrift 537, Gesetz 256,
  Förderrichtlinie 210, Staatsvertrag 67, Zustimmungsgesetz 65). Fertig, wenn `total` in dieser
  Datei 0 ist.
- [ ] Sachgebietszuordnungen ohne amtlichen Beleg entscheiden: Die Sachgebiete sind **nicht**
  abgeschlossen. 473 der 4.964 übernommenen Vorschriften tragen ein Hauptsachgebiet, das keine
  Fundstellennummer der Quelle belegt; es stammt aus der Ableitungskette (`fsn-sibling`,
  `related-norm`, `stem-title`, `type-rule`, `legacy`, `keyword`). Die Zahl steht als
  `derivedMetadata.subjects.derived` in `data/recht/revosax-import-audit/summary.json`, die Fälle
  ohne jeden Anhaltspunkt in `data/recht/subject-assignment-review.json` (eine Vorschrift ohne
  belegtes Sachgebiet, neun Förderrichtlinien ohne ableitbaren Förderbereich). Fertig, wenn
  `derivedMetadata.subjects.derived` nur noch redaktionell entschiedene Fälle enthält und beide
  Prüflisten leer sind.
- [ ] Herkunft der Schlagwörter redaktionell prüfen. Die aus dem Titel gebildeten Schlagwörter des
  Massenimports sind entfernt (`scripts/refine-revosax-derived-metadata.mjs`, Regel: ein
  Titelbestandteil ab fünf Zeichen oder eine wortgleiche Bezeichnung ist kein Schlagwort). Im
  Bestand stehen 6.616 Schlagwörter mit vier Herkünften; zwei sind belegt, zwei nicht:
  - amtliche Bezeichnung der REVOSax-Trefferliste: 5.440 — belegt, nichts zu tun;
  - fassungsspezifische Abkürzung oder Kurzbezeichnung aus `versions/*.json`: 2 — belegt;
  - aus dem Bestand übernommene Schlagwörter der übernommenen Vorschriften: 149 — **nicht amtlich
    belegt**; sie stammen aus redaktioneller Arbeit oder einem früheren Import und bleiben nur
    erhalten, weil sie sonst ersatzlos verschwänden;
  - 1.002 übernommene Vorschriften tragen gar keine zweite Bezeichnung.
  Offen bleibt außerdem der eigene ostdeutsche Bestand: 514 der 1.025 Schlagwörter seiner
  190 Vorschriften sind Titelbestandteile ab fünf Zeichen (151 Vorschriften), weil
  `scripts/import-normen.mjs` sie weiterhin aus dem Kurztitel erzeugt. Fertig, wenn jedes
  Schlagwort entweder amtlich belegt oder redaktionell gesetzt ist, `scripts/import-normen.mjs`
  keine Titelwörter mehr bildet und die Content-QA ein Titelwort als Schlagwort zurückweist.

## Staatsportal

### Regierungsarchiv

- [ ] Archivstände für das Kabinett Honecker II und den ersten Staatsrat nachziehen. Für einen
  Regierungswechsel verlangt `docs/EINPFLEGE_PLAYBOOK.md` (4.5) einen Archivstand unter
  `content/regierung/archiv/` und eine Seite unter
  `apps/portal/src/pages/staatsregierung/fruehere-kabinette/`. Beide fehlen seit dem Übergang vom
  20. Juli 2026 und erneut seit dem 7. September 2026; die Übersichtsseite
  `fruehere-kabinette/index.astro` bindet nur `kabinett-honecker-i.json` fest ein und listet
  deshalb genau eine Regierung. Fertig, wenn beide Regierungen einen Archivdatensatz und einen
  Eintrag in der Übersicht haben und die Seite ihre Einträge nicht mehr einzeln importiert.


### Lange Seiten und Datenansichten

- [ ] Aufbau der Kreisreformseite als Invarianten sichern statt über eine Seitenhöhe. Erledigt sind
  die gemeinsame Blätterung (Kreistabelle und Beteiligungsnavigator verwenden dieselbe
  `DataPagination` mit `DEFAULT_PORTAL_PAGE_SIZE`) und die genannte Zeilenzahl je Seite. Die frühere
  Vorgabe „bei 375 px unter 8.000 px“ ist **nicht** erfüllt (gemessen 15.548 px) und wird
  ausdrücklich ersetzt: Sie misst kein Gestaltungsmerkmal, sondern das Produkt aus Bestandsgröße
  (101 Kreise), Zeichenlänge der längsten Zelle, Fensterbreite und der vom Nutzer eingestellten
  Schriftgröße — bei 200 % Textvergrößerung (WCAG 1.4.4) wäre sie zwangsläufig verletzt, und
  erreichbar wäre sie nur, indem die Seitengröße unter die des Beteiligungsnavigators fiele oder
  ganze Tabellen hinter einem Aufklapper verschwänden. An ihre Stelle treten prüfbare Aussagen über
  den Aufbau; zwei davon laufen bereits (`tests/visual.spec.ts`, Messungen „Datenansichten … wachsen
  nicht mit dem Bestand“ und „bleibt progressiv und ohne Scrollfalle“: höchstens
  `DEFAULT_PORTAL_PAGE_SIZE` Zeilen je Tabelle und je Sammelblock, kein Aufklappbereich beim Aufruf
  offen, Sprungziel zu den Tabellen im ersten Bildschirm, kein waagerechter Überlauf). Offen bleibt
  die Dreifachnennung der 14 Bezirke unter 640 px (Kartenraster `#bezirke`, Bezirkstabelle und
  Auswahlspalte der Karte) und die Abschnittsnavigation, die unterhalb von 64 rem wegrollt, ohne
  einen Rücksprung anzubieten. Fertig, wenn unter 640 px jeder Bezirk genau einmal als Liste
  erscheint, die Abschnittsnavigation auch mobil erreichbar bleibt (mitgeführt oder als
  Rücksprung) und je eine Messung beides festhält.

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
