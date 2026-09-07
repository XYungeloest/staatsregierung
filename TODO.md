# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## Betrieb

Diese drei Punkte stammen aus dem Audit vom 7. September 2026 und sind Betriebsarbeit, keine
Weiterentwicklung. Der Ablauf, der sie künftig verhindert, steht in
`docs/EINPFLEGE_PLAYBOOK.md`.

- [ ] Deployment von `main` wiederherstellen: Der Lauf 34057455994 (Commit 88e46b76d,
  Volkskammerwahlergebnis) ist an `d1_sync` gescheitert, `deploy` wurde übersprungen; der
  nachfolgende Lauf 34113139609 (da95e919f) war `ci-only` und hat `d1_sync` und `deploy` erneut
  übersprungen. Beide Produktionsziele antworten deshalb weiterhin mit
  `x-portal-commit: 582c0914…`, dem Stand vom 6. September — das Volkskammerwahlergebnis ist
  nicht veröffentlicht. Zuerst die Fehlermeldung aus `assessSyncDecision` lesen und entscheiden,
  ob ein Äquivalenznachweis genügt oder das D1-Release-Gate greift
  (`docs/DEPLOYMENT_RUNBOOK.md`). Fertig, wenn `d1_sync` auf `main` grün ist, `deploy` gelaufen
  ist und `npm run test:deployment:production` beide Ziele mit dem aktuellen `main`-Commit
  bestätigt.
- [ ] Linux-Screenshot-Baselines erneuern: Die Inventur 34106802597 (visual-extended, 88e46b76d)
  meldet 50 fehlgeschlagene Aufnahmen von 228. Ursache sind die Oberflächenänderungen der Commits
  582c09147 (Wegweiserschrift, `foundation.css`) und 88e46b76d (`section-system.css`,
  `TopicModule.astro`, vorgerückter Stichtag), zu denen keine Baselines erneuert wurden. Der Lauf
  „Screenshot-Baselines erneuern“ 34062347773 hält bereits ein Artefakt für genau diesen Stand
  bereit; es verfällt am 20. September 2026. Fertig, wenn die erneuerten
  `tests/visual.spec.ts-snapshots/*-linux.png` nach Sichtprüfung jeder geänderten Aufnahme
  committet sind und `visual-extended` auf `main` grün läuft.
- [ ] Themen-Hervorhebung über den 10. September 2026 hinaus sicherstellen:
  `content/portal/topic-coverage.json` verlangt unter `discoverability.minimumActiveHighlights`
  mindestens eine am Stichtag laufende Hervorhebung. `volksbefragung-2026` ist die einzige mit
  laufendem Fenster (9. August bis 10. September 2026); `kommunen-regionen-und-berlin` und
  `wohnen-und-vergesellschaftung` sind abgelaufen. Jeder Stichtag ab dem 11. September lässt
  deshalb `content:check` und `check-topic-coverage` fehlschlagen. Fertig, wenn mindestens ein
  Thema am fortgeschriebenen Stichtag ein laufendes Hervorhebungsfenster trägt,
  `discoverability.editorialLead` darauf zeigt und der Audit
  `npm run norms:advance-reference-date -- --to <Zieldatum>` laufende Hervorhebungen meldet.

## OstRecht

- [ ] Abgeleitete Metadaten der übernommenen Normen nachschärfen: Schlagwörter und Kurzfassungen
  der REVOSax-Baseline sind deterministisch aus Typ und Titel abgeleitet und im Import-Audit als
  `derivedMetadata` gekennzeichnet. Die Sachgebiete folgen der amtlichen Systematik;
  `derivedMetadata.subjects` zählt, wie viele Zuordnungen die Fundstellennummer belegt und wie
  viele aus der Ableitungskette stammen, die Zweifelsfälle stehen in
  `data/recht/subject-assignment-review.json`. Fertig, wenn redaktionell geprüfte Schlagwörter und
  Kurzfassungen vorliegen und die Kennzeichnung in `data/recht/revosax-import-audit/summary.json`
  entfällt.

## Staatsportal

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
