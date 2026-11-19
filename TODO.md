# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## OstRecht

- [ ] E-Mail- und Vorschriften-Abonnements (Rest E38): Der Änderungsdienst ist als ein RSS-Feed
  abonnierbar (`/aenderungsdienst/rss.xml`). E-Mail-Versand und Abonnements je Vorschrift sind
  fachlich festzulegen, einschließlich Datenschutz, Versand und Betrieb. Keine Platzhalter-UI.
  Fertig, wenn die freigegebenen Abonnementwege samt Betriebskonzept umgesetzt und getestet sind.

- [ ] Redaktionelle Kurzfassungen nachtragen: 4.981 der 5.254 Vorschriften tragen keine
  Kurzbeschreibung, seit die aus dem Titel gebildeten Formeln des Massenimports entfernt sind. Die
  Oberfläche lässt die Zeile dort leer; `summary` ist ein freiwilliges Feld, und das Verzeichnis
  setzt ersatzweise die Kurzform des Vollzitats ein (`apps/recht/src/lib/norm-summary.ts`). Der
  Arbeitsvorrat steht vollständig und nach Normtyp aufgeschlüsselt in
  `data/recht/norm-summary-review.json` (Änderungsvorschrift 3.267, Verordnung 581,
  Verwaltungsvorschrift 538, Gesetz 253, Förderrichtlinie 210, Staatsvertrag 67,
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
- [ ] Herkunft der übernommenen Schlagwörter klären: 145 Schlagwörter übernommener Vorschriften
  sind weder die amtliche Bezeichnung der REVOSax-Trefferliste noch eine fassungsspezifische
  Bezeichnung. Sie stammen aus redaktioneller Arbeit oder einem früheren Import und bleiben nur
  erhalten, weil sie sonst ersatzlos verschwänden; die Zahl nennt
  `node scripts/refine-revosax-derived-metadata.mjs` als „aus dem Bestand übernommen (nicht amtlich
  belegt)“. Fertig, wenn jedes dieser Schlagwörter entweder amtlich belegt oder als redaktionelle
  Entscheidung dokumentiert ist.

- [ ] Listenverschachtelung: verbleibende Grenzfälle des HTML-Parsers. Flach bleiben Nummern nach
  einem Absatz „(n)“, der ohne Doppelpunkt endet (OGVBl. 2026 Nr. 77, Artikel 4 Nummer 2, § 10b
  Absatz 2), und der zitierte Wortlaut in mit Zeilenumbruch gesetzten Berichtigungsbuchstaben
  (OGVBl. 2026 Nr. 68, Nummer 7). Eine Regel ohne Doppelpunkt verändert zusätzlich rund 15
  Ausgaben, deren Absatzlisten heute der Bestandsform folgen. Fertig, wenn beide Muster in
  `tests/norm-html-parser.test.mjs` synthetisch abgedeckt, die betroffenen
  Quellen nach `docs/NORM_WORKFLOW.md` neu eingelesen sind und die Struktur an diesen Stellen dem
  PDF entspricht.

- [ ] Synthetische Ausgabenummern im Testbestand: `tests/helpers/fixture-corpus.ts` und die
  davon abhängigen schnellen Tests (u. a. `tests/law-portal.test.ts`, `tests/norm-citation.test.ts`,
  `tests/norm-markdown-parser.test.mjs`, `tests/import-normen-cli.test.mjs`,
  `tests/norm-schema-table.test.ts`, `tests/norm-publications.test.ts`,
  `tests/publication-pdf.test.mjs`) verwenden noch Ausgabebezeichnungen des realen Bestands
  (OGVBl. 2026 Nr. 1, 45, 70 und 99, StAnzO. 2026 Nr. 2, OABl. 2025 Nr. 9). Die Fixture-Ausgabe
  `ogvbl-2026-70` stimmt mit Datum (2. September 2026) und Fundstelle „OGVBl. 2026 Nr. 70 S. 2“
  wörtlich mit einer realen Verkündung überein. Die Umstellung berührt außerdem
  `data/recht/runtime-fixture.json`, den D1-Testseed, die Playwright-Specs und die
  Screenshot-Baselines. Vorab entscheidet die Projektleitung, ob bloße reale Ausgabenummern mit
  synthetischem Datum und Inhalt zulässig bleiben. Fertig, wenn kein Fixture- oder Testwert Datum
  und Fundstelle einer Ausgabe unter `content/verkuendungen/` wiedergibt (nach Entscheidung auch
  keine reale Ausgabenummer) und `npm run test:pr` grün ist.
- [ ] Unterschriften im Transkriptionsgenerator: `serializeFlow` in
  `scripts/build-alt-source-transcriptions.mjs` gibt keine `signature`-Blöcke aus, obwohl der
  Markdown-Parser sie liefert; deshalb fehlen in den Transkriptionen und Fassungen von OABl. 2025
  Nr. 1, 3, 4, 5 und 6 sowie OGVBl. 2025 Nr. 8, 9, 11 und 12 die Unterschriften. Die vorhandenen
  Transkriptionen werden nach Entscheidung der Projektleitung vom 18. November 2026 nicht neu
  erzeugt; die Korrektur verhindert, dass ein künftiger Lauf Unterschriften verliert, und ändert
  keine Datei unter `Gesetze/`. Fertig, wenn `serializeFlow` Unterschriften ausgibt und ein
  synthetischer Test das abdeckt.
- [ ] REVOSax-Nacharbeiten mit vorhandenem Stagingcache (`.cache/revosax-baseline/2023-11-01/`,
  lokal nicht vorhanden): Erstens mit `npm run norms:revosax:plan-materialization` neu planen; die
  Artikel 2 bis 4 des Gesetzes vom 6. Juli 2023 (REVOSax 20118, 20119, 20120; Mantelvorschrift
  20116) dürfen nach der korrigierten Stichtagsregel (`postCutoffFacts`) nicht mehr als
  post-cutoff übersprungen werden und werden gezielt materialisiert (`--law-id`, erst Audit, dann
  `--write`). Zweitens prüfen, ob die Slug-Prüfung der Befristungsentscheidungen in
  `scripts/materialize-revosax-baseline.mjs` für die Entscheidung 14060.5
  (`ostdeutsches-normenkontrollratsgesetz`) gegen den Plan besteht. Drittens
  `npm run norms:revosax:import-audit` neu erzeugen, damit `summary.json`, `skips.json` und
  `review-flags.json` die neuen `adopted`-Entscheidungen (`ostdeutsches-hochschulgesetz`,
  `ostdeutsches-schulgesetz`) und die neuen Konsolidierungsziele abbilden. Viertens die rund 70
  übernommenen reinen Baseline-Normen ohne lokalen Snapshot neu erzeugen: Sie entstanden vor der
  Erkennung manuell gesetzter REVOSax-Satznummern (`<sup class="satzzahl_manuell">`) und führen
  verirrte Satzzahlen wie „1Abweichend …“ im Normtext. Die Materialisierung liest die gecachte
  Parserausgabe (`parsed/<sourceId>.json`) und parst nicht neu; deshalb zuerst
  `npm run norms:revosax:stage-baseline -- --offline` (parst die gecachten Rohseiten mit dem
  aktuellen Parser und schreibt Parserausgabe und Stagingbericht neu), dann
  `npm run norms:revosax:materialize-baseline -- --regenerate` (erst Audit, dann `--write`).
  Befund: `grep -rlE '"text": "[1-9][0-9]?[A-ZÄÖÜ][a-zäöüß]|[.;:!?] [1-9][0-9]?[A-ZÄÖÜ][a-zäöüß]' content/normen --include='*.json' | grep /versions/`.
  Quellentreu und ausgenommen sind die wörtlich in `Gesetze/OGVBl II-24.html`,
  `Gesetze/Staatsverfassung-2024.html` und `Gesetze/Staatsverfassung-2025.html` stehenden
  Satzzahlen in Art. 17 Abs. 2 („4Das Nähere …“), Art. 67 Abs. 1 („2Er kann …“) und Art. 95 Abs. 6
  („3In diesen Ausnahmefällen“) von `staatsverfassung-des-freistaates-ostdeutschland` und
  `gesetz-zur-einsetzung-einer-neuen-landesverfassung`.
  Derselbe Lauf übernimmt für diese Normen die sichtbaren REVOSax-Überschriften statt des
  `title`-Attributs der Gliederungseinheit (veraltete Überschriften, maskierte Zeilenumbrüche;
  bei Anlagen, deren Kopfzeile nur Kennzeichen und Bezug nennt, die folgende Überschriftenzeile),
  erhält Tabellen in Listeneinträgen als Tabellenblock, übernimmt Tabellenbeschriftungen
  (`<caption>`) als Tabellentitel und setzt die sichtbare Kopfzeile des Tabellenkörpers an die
  Stelle der zugänglichen Wiederholung im `<thead>` (`repeatedTableHeader`); all das liest der
  Parser bereits so.
  Befund: `grep -rlE '"title": "[^"]*<br' content/normen` (betrifft nur noch Normen ohne lokalen
  Snapshot); doppelte Tabellenköpfe: Tabellen, deren erste Zeile nur Kopfzellen trägt und deren
  zweite Zeile mehr als die Hälfte dieser Köpfe wiederholt (316 Tabellen in 122 Normen, etwa
  `landesentwicklungsplan-2013`).
  Die Kennzeile von neun dieser Normen endete mit einem Fußnotenzeichen, mit oder ohne Leerzeichen
  („… – LEP 2013) 1“, „… (NaturschutzdienstVO)1“); ihre Titel sind bereinigt, der Parser
  verwirft das Zeichen aber noch nicht, weil seine Auszeichnung in der Kennzeile ohne Rohseite
  nicht prüfbar ist. Vor dem Neuerzeugen an einer gecachten Rohseite (etwa 12896) die Auszeichnung
  prüfen und das Zeichen in `parseRevosaxSnapshot` mit synthetischem Test verwerfen.
  Fertig, wenn der Plan die drei Akte als CREATE führt, das Import-Audit für sie keine
  post-cutoff-Marke mehr hat, die Materialisierung mit vorhandenem Plan ohne Fehler läuft und der
  Satzzahl-Befund außer diesen beiden Verfassungsnormen 0 Treffer hat, der `<br`-Befund und der
  Befund doppelter Tabellenköpfe 0 Treffer haben, kein Titel auf das Zeichen einer eigenen Fußnote
  (`sourceNotes[].label`) endet und keine Überschrift einer übernommenen Norm vom sichtbaren REVOSax-Wortlaut abweicht; den Bezug in
  Anlagenkennzeichen regelt der folgende Eintrag.
- [ ] Sichtbarer Bezug in REVOSax-Anlagenkennzeichen: `markerFromSection` in
  `scripts/lib/revosax-parser.mjs` übernimmt das Kennzeichen samt Bezug „(zu § …)“ nur aus dem
  `title`-Attribut der Einheit. Fehlt der Bezug dort, fehlt er auch im Kennzeichen, obwohl ihn die
  sichtbare Kopfzeile (`<h4>`) nennt: `finanzausgleichsgesetz` Anlage 1 „(zu § 7 Absatz 3)“ und
  Anlage 2 „(zu § 16 Absatz 2)“, `ausbildungs-und-pruefungsordnung-polizei` „(zu § 26 Absatz 2)“,
  `ostdeutsche-arbeitszeitverordnung` „(zu § 15)“, `schulnetzplanungsverordnung` „(zu § 5
  Absatz 4)“, `ostdeutsches-besoldungsgesetz` Anlage 1 bis 4, `ostdeutsches-justizgesetz`
  „(zu § 1 Abs. 4)“ (Fassungen 2023-11-01 und 2024-01-01), `saechsische-klassenbildungsverordnung` „(zu §§ 1
  und 3)“ (Fassung 2023-11-01), `schulordnung-berufliche-gymnasien` Anlage 1 und 3,
  `schulordnung-ober-und-abendoberschulen` „(zu § 61 Absatz 4 Satz 2)“ und `vwv-radfahrausbildung`
  „(zu Ziffer IV Nummer 2)“. Im `zehntes-ostdeutsches-kostenverzeichnis` tragen Anlage 2 bis 5
  statt des sichtbaren Bezugs „(zu Anlage 1 laufende Nummer 17 Tarifstelle …)“ den Zusatz des
  Attributs im Kennzeichen; Anlage 6 führt statt „(zu § 1 Nummer 5)“ den unvollständigen
  Attributzusatz „(Schreibauslagen nach § 13 Abs. 5 OstVwKG“ als Überschrift. Bei Justizgesetz und
  Klassenbildungsverordnung wechselt das Kennzeichen deshalb zwischen den Fassungen. Das Kennzeichen
  bestimmt Sprungmarke (`getBlockAnchorId`) und Einheitenzuordnung über Fassungen hinweg; die
  Korrektur ändert Anker gespeicherter Fassungen und berührt Patch-Rezepte, die Anlagen
  adressieren. Befund: sichtbare `<h4>` und `title`-Attribut der Anlagen in
  `data/recht/sources/revosax/*/*.html` vergleichen. Fertig, wenn jedes Anlagenkennzeichen den
  sichtbaren Bezug trägt, bisherige Anlagenanker weiter auflösen, ein synthetischer Test in
  `tests/revosax-parser.test.mjs` das abdeckt und die betroffenen Konsolidierungsziele nachgezogen
  sind; für Normen ohne lokalen Snapshot gilt das mit dem Lauf des vorigen Eintrags.
- [ ] REVOSax-Discovery gegen das neue Seitenlayout prüfen: `parseTypeFacet` in
  `scripts/lib/revosax-discovery.mjs` setzt `#quickbar` und Kastenüberschriften `h3` voraus; der
  Snapshot-Parser ist bereits angepasst. Fertig, wenn ein Discovery-Lauf gegen das aktuelle Layout
  die Typfacetten liest und ein synthetischer Test das neue Markup abdeckt.
- [ ] Langtitel bei Bekanntmachungen einer Neufassung: `parseRevosaxSnapshot` in
  `scripts/lib/revosax-parser.mjs` liest die erste `h3` der Kennzeile als `longTitle`. Bei einer
  Bekanntmachung der Neufassung ist das die Zeile „Bekanntmachung der Neufassung …“, nicht die
  nachfolgende förmliche Titelzeile des Gesetzes; die Ausgangsfassungen des Schulgesetzes führen
  die Titelzeile deshalb als gepflegte Fassungsbezeichnung. Fertig, wenn der Parser in diesem Fall
  die förmliche Titelzeile liefert, ein synthetischer Test in `tests/revosax-parser.test.mjs` das
  abdeckt und ein Audit der betroffenen Snapshots keine abweichende Bezeichnung mehr meldet.
- [ ] Gezielter Schreibmodus für `norms:workflow`: `scripts/norm-workflow.mjs --write` ruft
  unabhängig von `--file` bestandsweite Schreibschritte auf (`consolidate-norms --all --write`,
  `materialize-revosax-norms --all --update-existing --write`, `audit-consolidation` ohne
  `--check`, `knowledge:build`). Für das Neueinlesen nach einer Parseränderung oder die Nachpflege
  einer einzelnen Verkündung sieht dieses Runbook dagegen
  `norms:import -- --write --update-existing --file` vor. Fertig, wenn ein Schalter die
  Schreibschritte auf die ausgewählten Quellen und ihre Konsolidierungsziele beschränkt und
  `docs/NORM_WORKFLOW.md` beide Wege einheitlich beschreibt.
- [ ] Einzeldateizuordnung im strikten Import: `npm run norms:import -- --strict --file
  "OGVBl. 2026 Nr. 36.html"` meldet für zwei eingeführte Normen „Zuordnung zu mehreren
  Bestandsdatensätzen mehrdeutig“, der strikte Gesamtlauf besteht. Fertig, wenn der
  Einzeldateimodus dieselben Bestandskandidaten sieht wie der Gesamtlauf und ein synthetischer Test
  das sichert.
- [ ] Neueinlesen aufgehobener HTML-Einmalakte: `reconcileVersionIntervals` und `mergeWithExisting`
  in `scripts/import-normen.mjs` übernehmen `validTo`/`isCurrent` einer gespeicherten Fassung nur,
  wenn es eine spätere Fassung gibt; `status: "repealed"` und `expiryDate` entstehen nur aus
  `PUBLICATION_EXPIRY_CONFIG`. Ein Schreiblauf für `Gesetze/OGVBl I-25.html` setzt deshalb die
  Aufhebung des Bezirkseinführungsgesetzes zurück, ebenso bei anderen durch spätere Akte
  aufgehobenen HTML-Normen wie dem Organisationserlass 05/2026. Fertig, wenn gespeichertes
  `validTo`, `expiryDate` und `status: "repealed"` bei einem Aufhebungseintrag mit `relatedNorm`
  erhalten bleiben, mit synthetischem Test.
- [ ] Fassungsmerkmal „nie in Kraft getreten“: Verkündete, aber nie wirksam gewordene Fassungen
  (Änderungswortlaut der Oberstufen- und Abiturprüfungsverordnung von 2024, Endgeräteverordnung
  OGVBl. 2026 Nr. 15, VwV vorl. HWiF 2026 nach Artikel 2 Absatz 3 OGVBl. 2026 Nr. 37) erscheinen mit
  Geltungsintervall oder als geltend. Fertig, wenn `packages/shared/src/lib/norms/schema.ts`,
  `versions.ts`, `NormFacts.astro` und die D1-Projektion das Merkmal oder eine historische Norm ohne
  Fassung abbilden (mit Äquivalenznachweis für die Projektion) und die drei Fälle danach gepflegt
  sind. Nach Entscheidung der Projektleitung vom 18. November 2026 gelten der Änderungswortlaut von
  2024 und die VwV vorl. HWiF 2026 als nie in Kraft getreten; bis dahin bleiben sie in
  `CONTENT_GAPS.md` dokumentiert.
- [ ] Importschutz gegen nichtamtliche Markdown-Lesefassungen: `resolveLegacyConsolidatedRecord` in
  `scripts/import-normen.mjs` ordnet eine konsolidierte Markdown-Lesefassung unter `Gesetze/` allein
  über Titelähnlichkeit einem Bestand zu und kann eine gegen das PDF geprüfte Fassung überschreiben;
  den Schutz nach `preferReviewedSeedBodies` gibt es nur für die Lesefassung der Staatsverfassung.
  Fertig, wenn geprüfte Fassungen auch dort geschützt sind, die Zuordnung vorrangig über die
  verknüpfte `localSource` läuft (mit synthetischem Test) und die Oberstufen- und
  Abiturprüfungsverordnung, Fassung 2024-10-15, PDF-treu gepflegt ist, ohne dass das strikte Audit
  `would-update` meldet.
- [ ] Quellhinweise für konsolidierte Folgefassungen: `scripts/consolidate-norms.mjs` übernimmt
  `sourceNotes` nur aus Seeds oder Snapshots, nicht aus Patch-Rezepten. Die
  Verschlusssachenanweisung, Fassung 2026-03-28, zeigt deshalb die leeren Bildzellen der Anlage 8
  ohne Hinweis. Fertig, wenn ein Rezeptfeld Quellhinweise der Ergebnisfassung trägt (mit
  synthetischem Test) oder die Leitung festlegt, dass der Hinweis an der Änderungsvorschrift genügt.
- [ ] Vollzitat ohne Stammdatum: Viele Patch-Rezepte bilden `resultCitation` als „<Kurzbezeichnung>,
  geändert durch …“ ohne Datum und Fundstelle der Stammnorm (Fundstellen:
  `grep -rhoE '"resultCitation": "[^",(]*(\([^)]*\))?, (zuletzt )?geändert durch' data/recht/amendments`).
  `citationBaseForVersion` in `packages/shared/src/lib/norms/citation.ts` ergänzt nur die Klammer aus
  `meta.initialCitation`, nicht „vom …“ oder „in der Fassung der Bekanntmachung vom …“. Fertig, wenn
  das Vollzitat den Datums- und Fundstellenteil aus `meta.initialCitation` übernimmt (mit
  Unit-Test unter `tests/`) oder die Rezepte einzeln nachgezogen sind.
- [ ] Doppeltes „Berichtigung“ in Quellenangaben: `scripts/lib/correction-engine.mjs` bildet Labels
  als „… – Berichtigung <correctionCitation>“, obwohl `correctionCitation` bereits mit
  „Berichtigung“ beginnt; so entstehen „Berichtigung Berichtigung vom 14. August 2026“ (Fundstellen:
  `grep -rl 'Berichtigung Berichtigung' content/normen`). Fertig, wenn `apply-corrections` das Wort
  nur einmal setzt (mit synthetischem Test) und die abgeleiteten Labels nachgezogen sind.
- [ ] Titel mit Zeilenumbruch im HTML-Parser: `normalizeHeadingText` in
  `scripts/lib/norm-html-parser.mjs` schneidet einen Titel mit Zeilenumbruch nach dem ersten Wort ab
  („Abkommen<br>zwischen …“ wird zu „zwischen …“); die betroffenen Titel sind nur über `meta.json`
  gesichert. Fertig, wenn der Parser den vollständigen Titel liefert und ein synthetischer Test in
  `tests/norm-html-parser.test.mjs` das abdeckt.
- [ ] Befristungseintrag in der Historie selbst befristeter Vorschriften: Nur Vorschriften aus
  `PUBLICATION_EXPIRY_CONFIG` in `scripts/import-normen.mjs` erhalten einen Historieneintrag am
  ersten Tag ohne Geltung. Bei Befristungen aus `NEW_PUBLICATION_CONFIG` oder aus Klarstellungen
  steht das Ende nur in `meta.expiryDate` (Befund: `jq` über `content/normen/*/meta.json` mit
  `expiryDate` ohne passenden Historieneintrag). Fertig, wenn der Importer für jede belegte
  Befristung einheitlich einen Eintrag am Folgetag des letzten Geltungstags erzeugt, ein
  synthetischer Test das abdeckt und die betroffenen Vorschriften neu eingelesen sind.
- [ ] Unbenutzte Allowlist-Einträge in `scripts/check-content.mjs`: „Ministerium für freistaatliche
  Sicherheit“ in `allowedNormMinistries` und `allowedEnactingBodies` nutzt keine Norm mehr. Fertig,
  wenn die Einträge entfernt sind und `npm run content:check` sowie
  `tests/law-publication-presentation.test.ts` bestehen.
- [ ] Prüfung der Vollzugsaufträge im Wissenshub: `knowledge/implementation-mandates.json` und
  `knowledge/VOLLZUGSAUFTRAEGE.md` werden von keinem Skript geprüft oder erzeugt;
  `scripts/knowledge.mjs check` liest sie nicht. Fertig, wenn die Prüfung `normSlug`, die
  Normfassungen in `evidence`, Wissenshub-IDs und das Feld `norm` (abbr, sonst shortTitle, sonst
  title aus `meta.json`) gegen den Bestand abgleicht, mit synthetischem Test.
- [ ] Fußnoten übernommener Vorschriften überleiten: `parseSourceNotes` in
  `scripts/lib/revosax-parser.mjs` legt alle Fußnoten der Quelle als `sourceNotes` ab;
  `adaptParsedRevosaxSnapshot` in `scripts/lib/revosax-ost-adapter.mjs` passt sie nicht an, und
  `scripts/audit-ost-residuals.mjs` nimmt sie als Provenienz (`PROVENANCE_KEYS`) vom Audit aus.
  Viele dieser Fußnoten sind Normtext: Die Datenansicht der VwV-OstHO nennt in den Fußnoten 15, 18
  und 28 „SäHO“, der Haupttext „OstHO“. Daneben stehen Redaktionshinweise der Quelle
  (Gerichtsentscheidungen, Inkrafttretensbekanntmachungen, Webadressen). Betroffen sind 68
  Fußnoten in 40 übernommenen Vorschriften (`hasSaxonResidual` über die `sourceNotes` aller
  Fassungen). Zugleich gehen Tabellen in Fußnoten verloren, weil eine Fußnote nur Text trägt
  (VwV-OstHO Fußnote 28: Kopfzeile „Unterscheidung lfd. Buchst. Text“ im Fließtext). Fertig, wenn
  in `docs/REVOSAX_BULK_IMPORT.md` Abschnitt 3 festgelegt ist, welche Fußnoten übergeleitet werden,
  der Adapter sie anpasst, der Reststellenaudit sie prüft, Fußnotentabellen strukturiert erhalten
  bleiben (mit synthetischen Tests) und die betroffenen Vorschriften neu materialisiert sind.
- [ ] Absatzadressen unter gedruckten Gliederungsnummern eindeutig machen: Steht ein Absatz unter
  einer gedruckten Nummer mit Überschrift innerhalb einer Einheit („3. Kontaktstelle / (1) … /
  4. Daten / (1) …“, etwa in den Anhängen der Grenzraumabkommen OVertrBl. 2026 Nr. 2 und 3), bildet
  `subparagraphId` in `apps/recht/src/components/norms/NormBody.astro` Anker und verborgene
  Adresse nur aus Einheit und Absatznummer. Gleich nummerierte Absätze verschiedener
  Nummern heißen dadurch beide „Anhang 5 (1)“ und unterscheiden sich nur durch einen angehängten
  Zähler im Anker. Fertig, wenn Adresse und Anker solcher Absätze die übergeordnete Nummer
  enthalten, bestehende Anker als Weiterleitungsanker erhalten bleiben und ein synthetischer Test
  zwei gleich nummerierte Absätze unter verschiedenen Nummern unterscheidet.
- [ ] Textverweis vom Zustimmungsgesetz auf das Helsinki-Übereinkommen: Die Rechtsbeziehung ist
  über `relatedNorms` in
  `content/normen/gesetz-zu-dem-ubereinkommen-uber-den-schutz-der-meeresumwelt-des-ostseegebiets/meta.json`
  hergestellt, im Normtext von Artikel 1 fehlt aber der Link. `buildNormTextLinkReferences` in
  `packages/shared/src/lib/norms/references.ts` bildet Textlinks nur aus `abbr` und `shortTitle`
  der Zielnorm, und `apps/recht/src/components/norms/NormBody.astro` wendet
  `renderLinkedDisplayText` nur auf Blocktext und Tabellenzellen an, nicht auf Überschriften. Der
  Text von Artikel 1 nennt das Übereinkommen mit seinem langen Vertragstitel, der weder `title`
  noch `shortTitle` wörtlich enthält; nur die Überschrift lautet „Zustimmung zum
  Helsinki-Übereinkommen“. Eine nicht belegte Abkürzung scheidet aus
  (`UNVERIFIED_ABBREVIATIONS` in `scripts/import-normen.mjs`). Auch eine Verlinkung von
  Überschriften ergäbe allein keinen Treffer, weil die Überschrift weder `shortTitle` noch `title`
  der Zielnorm enthält. Jeder Weg braucht deshalb eine zusätzliche Verweisbezeichnung, die wörtlich
  im verlinkten Text steht: für die Überschrift „Helsinki-Übereinkommen“, für den Absatztext eine
  Wendung aus dem dort genannten Vertragstitel. Fertig, wenn ein redaktionelles Feld für
  zusätzliche Verweisbezeichnungen einer Norm von Importer, Konsolidierung und D1-Sync erhalten
  wird und in die Textlinks eingeht, Artikel 1 des Zustimmungsgesetzes (Absatztext oder, falls die
  Leitung Überschriftenlinks festlegt, Überschrift) über diese Bezeichnung auf
  `/norm/helsinki-ubereinkommen-uber-den-schutz-der-meeresumwelt-des-ostseegebiets/` verweist
  und ein synthetischer Test unter `tests/` das abdeckt.

## Staatsportal

### Lange Seiten und Datenansichten

- [ ] Kreisreformseite mobil: jeder Bezirk genau einmal, Bereichsnavigation erreichbar. Unter 640 px
  nennen das Kartenraster `#bezirke` und die Bezirkstabelle dieselben 14 Bezirke; das Auswahlfeld der
  Filterleiste ist Bedienelement und zählt nicht als Aufzählung. Die Bereichsnavigation wird
  unterhalb von 64 rem statisch (`DESIGN.md`) und ist nach dem ersten Bildschirm nicht mehr
  erreichbar. Fertig, wenn unter 640 px jeder Bezirk genau einmal als Liste erscheint, die
  Bereichsnavigation auch mobil erreichbar bleibt, je eine Messung beides festhält und die
  Reflow-Messung „200-Prozent-Zoom und reduzierte Bewegung bewahren die Kernfunktionen“
  (`tests/browser-smoke.spec.ts`, 320 × 360 CSS-Pixel bei Gerätepixelverhältnis 2) grün bleibt.

## Bilder

- [ ] Erzeugung der Bildvarianten reproduzierbar machen: `npm run images:generate` erzeugte bei der
  Messung mit `sharp` 0.35.4 andere `.avif`-Dateien als die eingecheckten; damals wichen
  144 der eingecheckten AVIF-Varianten byteweise ab (regierung 75, ministerien 42, jobs 24, ui 3);
  `.webp` und `.jpg` sind identisch. Ob die Abweichung mit dem heute installierten `sharp`
  0.35.5 fortbesteht, ist nicht neu gemessen. `sharp` ist in `apps/portal/package.json` nur als
  Bereich `^0.35.5` deklariert, eine feste Version also nirgends vorgegeben. Ein unbedachter Vollauf schreibt
  deshalb über hundert fachfremde Binärdateien in einen Vorgang, und kein Validator prüft die
  Varianten überhaupt auf Existenz. Zusätzlich überschreibt derselbe Lauf
  `public/images/social/portal-preview.png` mit einem eingebauten Platzhalter. Fertig, wenn `sharp`
  mit fester Version deklariert ist, ein Lauf auf unverändertem Bestand keine Datei ändert und die
  Social-Vorschau nicht mehr überschrieben wird.
