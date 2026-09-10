# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## OstRecht

- [ ] Änderungen am Ort der Änderung (E36): Erst nach belegter Zuordnung von Änderungen zu
  konkreten Normeinheiten oder Absätzen eine Markierung anbieten. Keine Platzhalter-UI.
  Fertig, wenn Zuordnung und Darstellung fachlich geprüft und durch Tests abgesichert sind.

- [ ] Optionaler haftender Norm-Minimalkopf mit aktueller Normeinheit (Rest E37): Nach Einführung
  des smarten Amtsbands zunächst den Bedarf und Platzverbrauch neu bewerten. Mitlaufendes
  Zitieren ist bereits Bestandteil der Normansicht. Fertig, wenn die gesonderte Produktentscheidung
  getroffen und ein gegebenenfalls benötigter Minimalkopf zugänglich umgesetzt und getestet ist.

- [ ] Abonnements (E38): RSS, E-Mail- und Vorschriften-Abonnements fachlich festlegen, einschließlich
  Datenschutz, Versand und Betrieb. Keine Platzhalter-UI. Fertig, wenn die freigegebenen
  Abonnementwege samt Betriebskonzept umgesetzt und getestet sind.

- [ ] Redaktionelle Kurzfassungen nachtragen: 4.981 der 5.204 Vorschriften tragen keine
  Kurzbeschreibung, seit die aus dem Titel gebildeten Formeln des Massenimports entfernt sind. Die
  Oberfläche lässt die Zeile dort leer; `summary` ist ein freiwilliges Feld, und das Verzeichnis
  setzt ersatzweise die Kurzform des Vollzitats ein (`apps/recht/src/lib/norm-summary.ts`). Der
  Arbeitsvorrat steht vollständig und nach Normtyp aufgeschlüsselt in
  `data/recht/norm-summary-review.json` (Änderungsvorschrift 3.267, Verordnung 579,
  Verwaltungsvorschrift 537, Gesetz 256, Förderrichtlinie 210, Staatsvertrag 67,
  Zustimmungsgesetz 65). Der eigene ostdeutsche Bestand ist vollständig gepflegt; der Rückstand ist
  ausschließlich übernommener sächsischer Bestand ohne amtliche Kurzfassung. Zwei Drittel des
  Vorrats sind Änderungsvorschriften, deren Regelungsgegenstand „ändert X“ ist — für sie gibt es
  kein ehrliches maschinelles Ergebnis, und drei Prüfstellen weisen eine aus Typ und Titel gebildete
  Formel ausdrücklich zurück. Fertig, wenn `total` in dieser Datei 0 ist. Vor der Bearbeitung ist zu
  entscheiden, ob dieses Kriterium so bestehen bleibt oder auf einen abgegrenzten Teilbestand
  gezogen wird; ohne diese Entscheidung bleibt der Punkt dauerhaft offen.
- [ ] Sachgebietszuordnungen ohne amtlichen Beleg entscheiden: Die Sachgebiete sind **nicht**
  abgeschlossen. 473 der 4.964 übernommenen Vorschriften tragen ein Hauptsachgebiet, das keine
  Fundstellennummer der Quelle belegt; es stammt aus der Ableitungskette (`fsn-sibling`,
  `related-norm`, `stem-title`, `type-rule`, `legacy`, `keyword`). Die Zahl steht als
  `derivedMetadata.subjects.derived` in `data/recht/revosax-import-audit/summary.json`, die Fälle
  ohne jeden Anhaltspunkt in `data/recht/subject-assignment-review.json` (eine Vorschrift ohne
  belegtes Sachgebiet, neun Förderrichtlinien ohne ableitbaren Förderbereich). Zwei Teilbefunde
  liegen gemessen vor: `fundingAreaFromFsn` (`packages/shared/src/config/law-subjects.ts`) wertet
  nur vierstellige Gliederungsnummern aus und übersieht die dreistelligen; sieben der neun offenen
  Förderrichtlinien sind darüber amtlich belegbar (554 Wohnungswesen, 551 Kommunale Investitionen),
  und 44 weitere Förderrichtlinien tragen heute einen aus Titelwörtern geratenen Förderbereich, der
  der amtlichen Nummer widerspricht. Für die 473 abgeleiteten Zuordnungen fehlt ein
  Entscheidungsspeicher, der eine redaktionelle Zuordnung gegen die Ableitungskette durchsetzt
  (Muster: `data/recht/revosax-post-cutoff-decisions.json`). Fertig, wenn
  `derivedMetadata.subjects.derived` nur noch redaktionell entschiedene Fälle enthält und beide
  Prüflisten leer sind. `packages/shared/src/config/law-subjects.ts` liegt im
  D1-Projektionsabschluss; die Korrektur verlangt einen Äquivalenznachweis.
- [ ] Herkunft der übernommenen Schlagwörter klären: 149 Schlagwörter übernommener Vorschriften
  sind weder die amtliche Bezeichnung der REVOSax-Trefferliste noch eine fassungsspezifische
  Bezeichnung. Sie stammen aus redaktioneller Arbeit oder einem früheren Import und bleiben nur
  erhalten, weil sie sonst ersatzlos verschwänden; die Zahl nennt
  `node scripts/refine-revosax-derived-metadata.mjs` als „aus dem Bestand übernommen (nicht amtlich
  belegt)“. Fertig, wenn jedes dieser Schlagwörter entweder amtlich belegt oder als redaktionelle
  Entscheidung dokumentiert ist.

## Staatsportal

### Lange Seiten und Datenansichten

- [ ] Kreisreformseite mobil: jeder Bezirk genau einmal, Bereichsnavigation erreichbar. Unter 640 px
  nennen das Kartenraster `#bezirke` und die Bezirkstabelle dieselben 14 Bezirke; das Auswahlfeld der
  Filterleiste ist Bedienelement und zählt nicht als Aufzählung. Die Bereichsnavigation wird
  unterhalb von 64 rem statisch (`DESIGN.md`) und ist nach dem ersten Bildschirm nicht mehr
  erreichbar. Eine erste Umsetzung (Tausch der Darstellung unter 640 px, Fläche in der Liste,
  Rücksprung je Abschnitt) ist zurückgenommen worden, weil sie `runtime_smoke` rot machte:
  `tests/browser-smoke.spec.ts`, Messung „200-Prozent-Zoom und reduzierte Bewegung bewahren die
  Kernfunktionen“, meldete auf `/kreisreform/` bei 640 × 720 mit `zoom: 2` einen waagerechten
  Überlauf (`scrollWidth` 960 gegen `clientWidth` 320). Auf macOS ist der Befund nicht
  reproduzierbar: dort lässt `document.documentElement.style.zoom = '2'` die `clientWidth` bei
  640 px, sodass die Messung leer läuft; bei echten 320 px Fensterbreite überläuft nichts. Fertig,
  wenn unter 640 px jeder Bezirk genau einmal als Liste erscheint, die Bereichsnavigation auch mobil
  erreichbar bleibt, je eine Messung beides festhält **und** die Zoom-Messung auf Linux grün ist —
  der Reflow ist vor der nächsten Umsetzung auf einem Linux-Läufer zu reproduzieren.

## Bilder

- [ ] Erzeugung der Bildvarianten reproduzierbar machen: `npm run images:generate` erzeugt mit dem
  heute installierten `sharp` 0.35.4 andere `.avif`-Dateien als die eingecheckten. Gemessen weichen
  144 der eingecheckten AVIF-Varianten byteweise ab (regierung 75, ministerien 42, jobs 24, ui 3);
  `.webp` und `.jpg` sind identisch. `sharp` ist in keinem `package.json` deklariert und nur
  transitiv vorhanden, eine Version also nirgends festgeschrieben. Ein unbedachter Vollauf schreibt
  deshalb über hundert fachfremde Binärdateien in einen Vorgang, und kein Validator prüft die
  Varianten überhaupt auf Existenz. Zusätzlich überschreibt derselbe Lauf
  `public/images/social/portal-preview.png` mit einem eingebauten Platzhalter. Fertig, wenn `sharp`
  mit fester Version deklariert ist, ein Lauf auf unverändertem Bestand keine Datei ändert und die
  Social-Vorschau nicht mehr überschrieben wird.

## OstRecht-Werkzeuge

- [ ] Rechtsüberleitung auf übernommenes Recht begrenzen: `applyRechtsueberleitung`
  (`scripts/consolidate-norms.mjs`) läuft über jedes konsolidierte Ergebnis, auch über eigene
  ostdeutsche Vorschriften. Dort ersetzt sie Eigennamen — bei der Ostdeutschen Bezirksordnung würde
  der Bezirk „Sachsen“ zu „Ostdeutschland“ und die „Sächsische Schweiz-Osterzgebirge“ zur
  „Ostdeutschen Schweiz-Osterzgebirge“. Heute fällt das nicht auf, weil `--all` Ziele ohne
  REVOSax-Snapshot überspringt und die betroffenen Ziele nur über `--target` laufen; kein Check
  schlägt an. Fertig, wenn der Adapter nur auf Fassungen mit REVOSax-Provenienz angewandt wird, ein
  Test das festhält und die Sonderbehandlung von `existingVersionSeed` in der `--all`-Schleife
  entfallen kann.
