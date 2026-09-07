# Einpflege-Playbook: Vom Eingang in `temp-neu/` bis zur veröffentlichten Seite

Dieses Dokument ist die verbindliche Arbeitsanweisung für den Satz „`temp-neu` einpflegen“. Es
ersetzt die Kurzfassungen in [`AGENTS.md`](../AGENTS.md) und [`CONTENT.md`](../CONTENT.md), die
beide hierher verweisen, und es ergänzt die fachlichen Detaildokumente
[`docs/NORM_WORKFLOW.md`](NORM_WORKFLOW.md), [`docs/DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md)
und [`docs/REVOSAX_BULK_IMPORT.md`](REVOSAX_BULK_IMPORT.md).

Es ist so geschrieben, dass ein Agent ohne Vorwissen einen beliebigen Eingang vollständig
abarbeiten kann, ohne zu raten und ohne einen Schritt zu übersehen. Wo eine Regel nicht maschinell
geprüft wird, steht das ausdrücklich dabei — genau dort entstehen die Fehler, die erst im
Deployment sichtbar werden.

**Der wichtigste Satz des Dokuments:** Ein grüner lokaler Lauf ist kein Nachweis. Drei große
Prüfbereiche laufen lokal auf macOS gar nicht oder anders als in der CI (Pixelvergleich der
Screenshots, produktive D1-Projektion, Linux-Dateinamen). Kapitel 8 sagt für jeden Eingangstyp,
was lokal beweisbar ist und was nicht.

---

## 1 Die zehn unverrückbaren Regeln

1. **`temp-neu/` wird nie verändert, geleert oder gelöscht.** Es ist der Benutzereingang und in
   `.gitignore:32` ignoriert. Quellen werden **kopiert**, nie verschoben.
2. **Kein Datensatz, keine `localSource`, kein Markdown-Link zeigt je nach `temp-neu/`.** Der Pfad
   ist nicht versioniert; lokal ist das grün (`scripts/check-content.mjs:107-121` liest den
   Git-Index), in der CI-Auscheckung ist es rot.
3. **Nicht direkt auf `main` arbeiten.** Branch, Commit, Pull Request. Direkte Pushes umgehen alle
   vier Pflichtchecks — genau so ist der Zustand entstanden, den Kapitel 12 beschreibt.
4. **Nie raten.** Passt eine Quelle nicht eindeutig auf den Bestand, wird abgebrochen und gemeldet
   (Kapitel 11), nicht heuristisch importiert.
5. **Redaktionelle Normfelder werden nur über die Importkonfiguration geändert**, nie von Hand in
   `content/normen/*/meta.json` — sonst meldet der strikte Audit dauerhaft `would-update`.
6. **Der Stichtag ist eine geschlossene Kette, kein einzelner Befehl** (Kapitel 6). Wer ihn
   fortschreibt und den Organisations-Snapshot vergisst, macht den gesamten Bestand rot.
7. **Generierte Dateien werden mitcommittet**: `knowledge/generated/**` und
   `content/regierung/beteiligungsinventar.json`. Die CI vergleicht sie byteweise.
8. **Jede neue Wissenshub-ID braucht im selben Commit einen Eintrag in
   `content/portal/topic-coverage.json`** — auch wenn sie kein Thema betrifft.
9. **Screenshot-Baselines sind Linux-Dateien und entstehen nur bewusst** (Kapitel 9). Ein lokal
   grüner Screenshot-Lauf auf macOS beweist nichts.
10. **Kein `--full` auf der produktiven D1, keine Fingerabdruck-Manipulation, kein
    `--stamp-fingerprint` als Abkürzung, kein Abschalten der Branch-Protection.**

---

## 2 Der Ablauf in einer Übersicht

```
Phase 0  Eingang sichten und klassifizieren            → Kapitel 3
Phase 1  Quellen prüfen und nach Gesetze/ bzw. context/ übernehmen
Phase 2  Fachzweig abarbeiten (einer oder mehrere)     → Kapitel 4
Phase 3  Querschnittspflichten                         → Kapitel 5–7
Phase 4  Abschlussprüfung lokal                        → Kapitel 8
Phase 5  Screenshot-Baselines                          → Kapitel 9
Phase 6  Commit-Umfang prüfen, Branch, Pull Request    → Kapitel 10
Phase 7  CI beobachten, rote Jobs auflösen             → Kapitel 12–13
```

Die Phasen sind **nicht** vertauschbar. Insbesondere gilt:

- `knowledge:build` läuft **vor** `content:check`, nie danach. `content:check` beginnt mit
  `holdings:check` und endet mit `node scripts/knowledge.mjs check`, das die generierten Dateien
  byteweise vergleicht; wer erst prüft und dann generiert, bekommt einen Fehlschlag, der nichts mit
  seinem Inhalt zu tun hat.
- Der Stichtag wird **vor** den Themen fortgeschrieben, weil `updatedAt` eines Themas nie nach dem
  Stichtag liegen darf (`scripts/check-topic-coverage.mjs:76-77`).
- Migrationen der D1 werden **vor** dem Deployment eingespielt, nie danach.

---

## 3 Phase 0: Eingang klassifizieren

Zuerst wird jede Datei in `temp-neu/` einem Zweig zugeordnet. Zusammengehörige Dateien (HTML + PDF
derselben Ausgabe, Bild + Meldung) werden als eine Einheit behandelt. Ein gemischter Eingang wird
**vollständig** abgearbeitet: beide Zweige, ein Commit, die Prüfungen des jeweils größeren Umfangs.

| Was liegt im Eingang | Erkennungsmerkmal | Zweig |
| --- | --- | --- |
| Amtsblattausgabe mit Rechtsvorschriften | HTML mit Ausgabenkopf („Ausgegeben zu …“) und Inhaltsverzeichnis, verkündet Gesetze/Verordnungen | [4.1](#41-zweig-a--amtsblattausgabe-mit-rechtsvorschriften) |
| Amtsblattausgabe ohne Rechtsvorschrift | Ausgabenkopf, aber nur Bekanntmachung, Bericht, Wahlergebnis | [4.2](#42-zweig-b--ausgabe-ohne-rechtsvorschrift) |
| Änderungsvorschrift | Titel „… zur Änderung des …“, ändert eine bestehende Stammnorm | [4.3](#43-zweig-c--änderungsvorschrift-und-konsolidierung) |
| Pressemitteilung, Rede, Termin | Fließtext, Datum, Ressortbezug | [4.4](#44-zweig-d--presse-reden-termine) |
| Personal- oder Ressortänderung | Ernennung, Entlassung, Umbenennung, Regierungswechsel | [4.5](#45-zweig-e--regierungsorganisation) |
| Interview, Wiki-Auszug, EAG-Ausspielung, Beteiligungsdaten | Quelle ohne amtliche Verkündung | [4.6](#46-zweig-f--wissenshub-ohne-normquelle) |
| Themenseite, Vorhaben | soll eine eigene Oberfläche bekommen | [4.7](#47-zweig-g--themenseiten) |
| Bilder, PDFs | Bildmotive, Anlagen | [4.8](#48-zweig-h--bilder-pdfs-assets) |
| Zeitachse, Haushalt, Stichwortregister | Dashboarddaten | [4.9](#49-zweig-i--dashboard-gesetzgebung-haushalt-stichwortregister) |

**Abbruchprüfung vor jedem Schreiben.** Bevor irgendetwas geschrieben wird:

- Widerspricht das PDF der HTML-Transkription in Struktur, Nummerierung, Seitenzahl oder Anlagen?
  → nicht importieren, Konflikt in [`CONTENT_GAPS.md`](../CONTENT_GAPS.md) beschreiben (nur den
  Dateinamen in Backticks, nie einen Pfad nach `temp-neu/`).
- Braucht der Eingang ein neues Sachgebiet, ein neues Verkündungsorgan oder ein neues Ressort?
  → siehe Kapitel 5.6, das ist kein Nebenschritt.
- Enthält ein Bildmotiv sichtbare Beschriftungsfehler oder widerspricht es dem Text? → Bild nicht
  veröffentlichen, im Eingang belassen, in `CONTENT_GAPS.md` melden.

---

## 4 Die Fachzweige

### 4.1 Zweig A — Amtsblattausgabe mit Rechtsvorschriften

Zielbestand: `content/normen/<slug>/{meta.json,history.json,versions/<versionId>.json}`,
`content/verkuendungen/<publikationsslug>.json`, `public/assets/recht/<publikationsslug>.pdf`.

**A1 — PDF gegen HTML prüfen.** Das amtliche PDF vollständig rendern und Seite für Seite gegen die
HTML-Transkription halten: Überschriften, Gliederung, Listenfortsetzungen, Seitenzahlen, Tabellen,
Anlagen, Unterschriften. Strukturkonflikte gehören in `CONTENT_GAPS.md`, nicht in einen stillen
Import.

**A2 — Quellen nach `Gesetze/` kopieren.** Namenskonvention `<Blatt>. <Jahr> Nr. <Nummer>.<ext>`,
HTML und PDF mit **identischem Basisnamen** — nur dann greift die exakte Paarung in
`scripts/lib/publication-pdf.mjs:90-91`. Der Importer erkennt die Ausgabe zwar auch bei
abweichendem Dateinamen (`StAnzO.2026Nr.41.html` wird korrekt zugeordnet), aber der strikte Audit
prüft Parservertrag und Normdiff nur für Dateien, deren Name in `configuredSourceFiles`
(`scripts/import-normen.mjs:2549-2559`) steht; der Filter selbst sitzt auf Zeile 2592.

```bash
cp "temp-neu/OGVBl. 2026 Nr. 75.html" "temp-neu/OGVBl. 2026 Nr. 75.pdf" Gesetze/
```

**A3 — Importkonfiguration ergänzen.** In `scripts/import-normen.mjs` einen Eintrag in
`NEW_PUBLICATION_CONFIG` (ab Zeile 144, 42 vorhandene Schlüssel) unter dem Schlüssel
`'<Blatt>|<Jahr>|<Ausgabe>'`, zum Beispiel `'OGVBl.|2026|75'`. Der Wert ist ein **Array mit genau
einem Eintrag je im Dokument erkannter Norm**, in der Reihenfolge `[Mantelvorschrift,
…eingeführte Stammnormen]`.

`ISSUE_CONFIG` (Zeile 76-122) ist ausschließlich der Altpfad für OGVBl. 2026 Nr. 46–59 und wird für
neue Ausgaben **nicht** verwendet.

Feldsatz je Eintrag:

| Feld | Pflicht | Wirkung |
| --- | --- | --- |
| `slug` | ja | Verzeichnisname unter `content/normen/` |
| `shortTitle` | faktisch ja | speist die abgeleiteten `keywords` (`shortTitle.split(/\s+/u)`); fehlt es, fehlen die Schlagwörter |
| `type` | ja | Normart; zulässige Werte siehe Schema, nicht CONTENT.md (dort veraltet) |
| `summary` | ja | redaktionell, mindestens 24 Zeichen; keine Formelsätze außer bei übernommenen REVOSax-Normen |
| `responsibleMinistry` | ja | muss in `allowedNormMinistries` (`scripts/check-content.mjs:58-83`) stehen |
| `subjects` | **ja** | ohne dieses Feld vergibt `configuredSubjectsFor()` (`scripts/import-normen.mjs:646-650`) still `['Bildungswesen']` |
| `pageCount` | ja | wird gegen die echte PDF-Seitenzahl geprüft, Abbruch bei Abweichung (`:859`) |
| `enactingBody` | bedingt | ohne eigenes Feld wird `Staatsrat des Freistaates Ostdeutschland` gesetzt; muss in `allowedEnactingBodies` (`:84-104`) stehen |
| `abbr`, `versionId`, `validFrom`, `effectiveOverride`, `expiryDate`, `statusOverride`, `predecessor`, `successor`, `affectedNorms`, `pdfFileName` | optional | fachlich |

**Drei stille Fallen dieses Schritts:**

- Ohne Konfigurationseintrag importiert der Schreiblauf **nichts** und meldet das nicht als Fehler.
- Weicht die Zahl der Konfigurationseinträge von der Zahl der geparsten Normen ab, bricht der Lauf
  hart ab (`:1142`) — das ist die einzige Absicherung gegen eine unvollständige Konfiguration.
- Ein einzelnes Wort „Begründung“, „Erläuterung“, „Vorblatt“, „Begleittext“ oder „Pressemitteilung“
  in den ersten 20 000 Zeichen macht eine Quelle zu `editorial` und lässt sie vollständig
  überspringen. Das greift **nur** bei Quellen ohne Ausgabenkopf, also bei konsolidierten
  Einzelnormen — nicht bei Amtsblattausgaben.

**A4 — Prüflauf (schreibt nichts).**

```bash
npm run norms:workflow -- --file "OGVBl. 2026 Nr. 75.html" --quick
```

Zum Prüflauf macht ihn allein das **Fehlen** von `--write`. `--quick` lässt nur Unit-Tests, Typen,
Build und UI-Smokes aus (`scripts/norm-workflow.mjs:56-60`); `content:check` und die
Wissenshub-Prüfungen laufen in jedem Fall.

**A5 — Redaktionell prüfen.** Titelmodell (`title` = amtlicher Langtitel, `shortTitle` = echte
Kurzbezeichnung, `abbr` = echte Abkürzung; abkürzungsartige Formen gehören in `keywords`),
Zusammenfassung, `enactingBody`, `responsibleMinistry`, Sachgebiete aus
`packages/shared/src/config/law-subjects.json`, Beziehungen.

**A6 — Schreiblauf.**

```bash
npm run norms:workflow -- --file "OGVBl. 2026 Nr. 75.html" --write
```

Der Schreibmodus aktualisiert vorhandene Ausgaben ohne Zusatzflag. Nur beim **direkten**
`import-normen`-Aufruf sind `--file` (`:2531`) und `--update-existing` (`:2536-2537`) selbst zu
setzen; `--write` ohne `--file` ist gesperrt, `--strict` und `--write` schließen sich aus.

**A7 — PDF-Zuordnung und Auslieferung.** Der Normworkflow ruft das **nicht** auf:

```bash
npm run norms:publications:pdf-sync -- --write
```

Schreibt `pdf`, `sourceReferences` der Ausgabe und die `sourceReferences` aller in
`entries[].normSlug` genannten Normen fort und kopiert die Datei nach
`public/assets/recht/<slug>.pdf`. Der öffentliche Dateiname ist der **Ausgaben-Slug**, nicht der
`Gesetze/`-Name. `pdf` niemals von Hand setzen und das PDF niemals von Hand kopieren.

**A8 — Weiter mit Kapitel 5** (Querschnittspflichten), dann Kapitel 8.

---

### 4.2 Zweig B — Ausgabe ohne Rechtsvorschrift

**Das ist der Fall, an dem das Volkskammerwahlergebnis gescheitert ist.** Eine StAnzO-Ausgabe mit
einer Bekanntmachung — Wahlergebnis, Bericht eines Verfassungsorgans, amtliche Einzelverkündung —
ist ein Verkündungsblatt, aber **keine Normimportquelle**.

**B1 — Erkennen.** Meldet `npm run norms:workflow -- --file … --quick` die Quelle als
`recognized-non-normative` (Feld `report.nonNormative`), schreibt der Importer **nichts**. Der
`--write`-Lauf ist für diese Datei ein No-op und darf **nicht** als Erledigung gelesen werden. Der
strikte Lauf bleibt dabei grün — Grün heißt hier „nichts getan“, nicht „fertig“.

**B2 — Kein Eintrag in `NEW_PUBLICATION_CONFIG`.** Ein Konfigurationseintrag für eine
nichtnormative Ausgabe macht den strikten Lauf rot.

**B3 — Verkündungsdatensatz von Hand anlegen**, Vorlage `content/verkuendungen/stanzo-2026-41.json`.
Dateiname = `slug`. Pflichtfelder der Ausgabe: `slug`, `title`, `year`, `issue`, `date`,
`publication`, `place`, `publisher`, `sourceReferences`, `entries`.

Der Eintrag in `entries[]`:

- `type: 'sonstiges'` (kein `normSlug`, keine `versionId`)
- `id`, `title`
- `citation` im Muster `<Art> vom <T>. <Monat> <JJJJ> (StAnzO. JJJJ Nr. NN S. X)` — bei gesetztem
  `documentDate` muss `vom <T>. <Monat> <JJJJ> (` wörtlich enthalten sein
- `documentDate` ist **Pflicht** und ist **nicht** das Ausgabedatum
- `startPage` und `pages` schließen sich aus
- `pageRange`/`pageCount` nicht von Hand pflegen

**Bekannte Lücke:** `entries[].type` wird von `scripts/check-content.mjs` **nicht** gegen das Enum
geprüft (nur auf „nicht leer“). Ein falscher Wert passiert `content:check` und `import-normen
--strict` und bricht erst im Build (`loadAllVerkuendungen`). Der Wert ist deshalb von Hand gegen
`scripts/lib/publication-entry-types.mjs:10` abzugleichen.

**Weitere Fallen dieses Zweigs:**

- `issue` und der Nummernteil des Slugs sind **nicht** gleich formatiert: der Slug polstert auf zwei
  Stellen (`oabl-2026-01`), `issue` nicht (`"1"`).
- Die strukturtragende Quelle der Ausgabe muss auch in den `sourceReferences` der verknüpften Normen
  stehen — bei einer normlosen Ausgabe entfällt das.
- `sourceRole` ist kein erzwungenes Enum; ein erfundener Wert passiert alle Prüfungen.
- Die Quelldatei unter `Gesetze/` darf nach dem Import **nie** mehr geändert werden, auch nicht im
  Leerraum: `content:check` wird sofort rot.

**B4 — PDF-Sync** (A7) und **B5 — Verknüpfung mit dem Portal.** Eine normlose Veröffentlichung wird
über `content/themen/<slug>.json` → `rechtsgrundlagen[]: { label, publicationSlug, note }`
verknüpft. `publicationSlug` zeigt auf die Verkündung (`scripts/check-content.mjs:623-625`);
`normSlug` bleibt Normen vorbehalten.

**B6 — Konsistenz-Sweep.** Kein Check deckt das ab, deshalb Pflichtschritt:

```bash
grep -rn "<Ereignisdatum in Klartext>" content/ knowledge/
```

Futurformulierungen in `content/presse/termine/`, `content/freistaat/`, `content/themen/` und
`content/dashboard/timeline.json` in die Vergangenheitsform setzen; Themenstatus fortschreiben
(z. B. `in-umsetzung` → `abgeschlossen`); Zeitachseneinträge für Ergebnis und amtlichen Bericht
anlegen.

---

### 4.3 Zweig C — Änderungsvorschrift und Konsolidierung

**Vorbedingungen prüfen, bevor irgendetwas geschrieben wird.** Fehlt eine davon und lässt sie sich
nicht beschaffen: abbrechen und melden, nie heuristisch konsolidieren.

1. Steht die Zielnorm in `data/recht/consolidation-sources.json` unter `targets`?
2. Existiert ihr REVOSax-Snapshot unter `data/recht/sources/revosax/`?
3. Ist Netzzugriff für `npm run norms:revosax:fetch` verfügbar?
4. Existiert bereits eine Importkonfiguration für die Ausgabe?

**Reihenfolge:**

1. Eingang inventarisieren, PDF gegen HTML prüfen.
2. HTML und PDF nach `Gesetze/` kopieren.
3. Importkonfiguration ergänzen — für eine Änderungsvorschrift zwingend `type:
   'aenderungsvorschrift'`, `affectedNorms: ['<zielnorm>']`, dazu `slug`, `shortTitle`,
   `responsibleMinistry`, `summary`, `subjects`.
4. Nur bei der **ersten** ostdeutschen Änderung einer übernommenen Stammnorm: REVOSax-Fassung zum
   1. November 2023 sichern und parsen.
   ```bash
   npm run norms:revosax:fetch -- --target <slug> --url <historische-revosax-url>
   ```
5. Zieleintrag in `data/recht/consolidation-sources.json`.
6. **Patch-Rezept** unter `data/recht/amendments/<aenderungsvorschrift>/<zielnorm>.json`.
7. Stichtag (Kapitel 6), dann Schreiblauf, dann `pdf-sync`, dann Audits.

**Ein Patch-Rezept ist für JEDE Änderung Pflicht, nicht nur für die erste.** Ohne Rezept überspringt
`scripts/consolidate-norms.mjs` das Ziel (Zeile 575-578): es schreibt eine Zeile auf stderr, lässt
den Lauf aber nicht scheitern — die Website bleibt auf dem alten Stand, ohne dass ein Check rot
wird. Nach jedem Schreiblauf gegenprüfen, dass `data/recht/consolidation-manifest.json` für das
Ziel `status: 'complete'` und das neue Wirksamkeitsdatum führt.

**Rezeptkontrakt.** Kopf: `amendmentAct`, `effectiveDate`, `versionId`, `amendmentCitation`,
`resultCitation`, `changeNote`, `commandCoverage`, `sourceReferences` (`kind:
'amendment-source'`, `localSource` unter `Gesetze/`). Je Operation: `op` aus den 17 Werten von
`CONSOLIDATION_OPERATIONS` (`scripts/lib/consolidation-engine.mjs`), `source`, `sourceProvision`,
`effectiveDate`, `expectedMatches` (≥ 1), `target` (außer bei `renameLaw`, `repealLaw`,
`replaceBody`, `designationReplacementBody`) und `expectedHash` oder `expectedOld`.

Mehrere Änderungen am selben Tag: identische `versionId`, paarweise verschiedene ganzzahlige
`sameDayOrder`; ein `repealsLaw`-Rezept steht allein an seinem Tag.

**Gültigkeitsintervalle** müssen lückenlos **und** überlappungsfrei aneinandergrenzen.

**Nach der Konsolidierung immer:**

```bash
node scripts/audit-ost-residuals.mjs
```

Reststellen zuerst inhaltlich beseitigen. Nur wörtlich in der amtlichen Quelle belegte oder per
PDF-Hash geprüfte Bezüge mit `--update-backlog` in `data/recht/ost-residual-backlog.json`
fortschreiben und committen.

**Abbruchregel.** Passt ein Änderungsbefehl nicht eindeutig auf die Ausgangsfassung, wird nicht
geraten: entweder ein `blockedTargets`-Eintrag mit `reason` und `effectiveDate` plus Eintrag in
`CONTENT_GAPS.md`, oder eine dokumentierte `editorialSourceResolution` mit Entscheidung,
verkündetem Wortlaut, Zielanker, Begründung, Datum und Belegen. Danach
`npm run norms:consolidation:audit`, Manifest und Bericht committen.

**Berichtigungen** sind etwas anderes als Änderungen: eigene Verkündung mit `type: 'berichtigung'`
und ein deklaratorisches Rezept unter `data/recht/corrections/`. Eine Berichtigung erzeugt **keinen**
neuen Wirksamkeitstag und **keine** zusätzliche Fassung.

---

### 4.4 Zweig D — Presse, Reden, Termine

Ziel: `content/presse/mitteilungen/<slug>.json`, `content/presse/reden/<slug>.json`,
`content/presse/termine/<slug>.json`. Dateiname = `slug`.

**Merksatz.** `content:check` prüft bei Pressemitteilungen **nur** Slug/Dateiname,
Bildpfad-Existenz, `related*`-Slugs, Sprache und E-Mail-Domain. Die **Pflichtfelder erzwingt allein
der Build** über `packages/shared/src/lib/portal/schema.ts:919-947`. Ohne Build ist die Prüfung
wertlos.

**Pflichtfelder Pressemitteilung:** `slug`, `title`, `date`, `ressort`, `teaser`, `image`,
`imageAlt`, `tags`, `isFeatured` (echter Boolean — fehlt er, bricht der Astro-Build ab), `body`
(reine Absatzliste). Optional: `imageCredit` (in CONTENT.md fälschlich als Pflicht geführt),
`relatedTopicSlugs`, `relatedNormSlugs`, `relatedPressSlugs`.

**Rede** zusätzlich: `speakerPersonSlug` optional — hier gilt, dass **nur das Fehlen des Schlüssels**
als „nicht gesetzt“ zählt; `null` oder Leerstring brechen den Build. Alle anderen optionalen
Pressefelder akzeptieren `null`.

**Termin** zusätzlich: `start`, `end`, `relatedTopicSlugs`, `relatedLegislationSlugs`.

**Regeln, die kein Validator prüft:**

- `date` ≤ `referenceDate`. Eine später datierte Meldung wird durch die Sortierung `date desc`
  automatisch Leitmeldung auf `/presse/`, Kopf der Startseiten-Liste, erstes RSS-Item und `lastmod`
  der Sitemap. `expectDate` prüft nur die Zeichenform, nicht den Kalender — `2026-13-45` passiert.
- `ressort` ist freier Text ohne Allowlist und erscheint wörtlich auf der Detailseite und im
  Ressortfilter. Die am Erscheinungsdatum gültige amtliche Bezeichnung aus `content/organisation`
  ableiten.
- `isFeatured` entscheidet allein über Leit- und Zweitmeldung auf `/presse/pressemitteilungen/`.
  Nicht als Standardwert setzen.
- `relatedPressSlugs` **nicht** als leeres Array schreiben: `[]` hebelt den Fallback aus und
  entfernt den Block „Weitere Meldungen“ still.
- `image` ist Pflicht und wird auf Existenz geprüft, **wird aber nur auf der Startseite gerendert
  und nur, wenn der Pfad mit `/images/ministerien/` beginnt.** Pfade unter `/images/presse/`
  erscheinen nirgends.

**Bildentscheidung.** Soll das Bild sichtbar sein, gehört es nach `public/images/ministerien/`,
und dann ist `npm run images:generate` Pflicht (Kapitel 4.8).

---

### 4.5 Zweig E — Regierungsorganisation

Einzige Quelle für Ämter, Mitgliedschaft und Ressortleitung sind
`content/organisation/{governments.json,offices.json,assignments.json}`.
`content/regierung/mitglieder/<slug>.json` ist ein **reines Personenprofil**.

**Die harten Invarianten** (`packages/shared/src/lib/portal/organization.ts:357-372`): am Stichtag
genau eine aktive Regierung, genau eine Leitung (`role: head`), genau eine Stellvertretung
(`role: deputy`) und für **jedes** Profil unter `content/ressorts/` genau eine aktive Leitung durch
ein Amt mit `canLeadMinistry`. Exklusive Ämter dürfen sich nicht überlappen.

**Die neun verbotenen abgeleiteten Felder** im Personenprofil: `amt`, `ressort`, `reihenfolge`,
`current`, `servingFrom`, `servingTo`, `currentOffices`, `formerOffices`, `appointmentSource`.

**Entlassung = `validTo` auf den Vortag.** Zuordnung und Personenprofil bleiben erhalten. Löschen ist
verboten. Wird ein Ressort dadurch führungslos, ist im selben Vorgang eine Nachfolge einzutragen
oder das Ressortprofil samt aller Verweise aufzulösen.

**Ressort umbenennen** heißt `name` und `kurzname` ändern; `slug`, Dateiname, Bildpfad und URL
bleiben stabil. Folgeliste einer Umbenennung: `allowedNormMinistries` in
`scripts/check-content.mjs` ergänzen (alten Namen belassen), `responsibleMinistry` in der
Importkonfiguration und in `content/normen/*/meta.json` prüfen,
`knowledge/entities/institutions.json` und `knowledge/current-state.json` (`stateSecretariatIds`),
Freitexte in Themen und Presse.

**Zuordnungen** in `assignments.json`: ID-Konvention im Bestand ist
`<validFrom>-<personSlug>-<kurzressort>` (alle 31 Einträge). `ministrySlug`, `governmentSlug` und
`validTo` müssen **explizit `null`** enthalten, wenn nicht belegt — Weglassen ist ein Fehler.
Mehrfachämter sind vorgesehen (eine Zeile je gleichzeitigem Amt).

**`sortOrder`:** neue Zuordnungen erhalten `sortOrder >= 3`. Werte ≤ 2 machen die Person auf drei
Seiten still zum Staatspräsidenten bzw. zur Leitung, ohne dass ein Validator anschlägt.

**Snapshot** `content/organisation/snapshots/<referenceDate>.json`: genau sechs Schlüssel in genau
dieser Reihenfolge — `asOf`, `governmentSlug`, `headPersonSlug`, `deputyPersonSlug`,
`memberPersonSlugs`, `ministryLeaders`. Der Vergleich ist ein `JSON.stringify`-Stringvergleich
(`scripts/check-organization.ts:51`): Schlüsselreihenfolge, Reihenfolge in `memberPersonSlugs`
(nach kleinstem `sortOrder`) und Schlüsselreihenfolge in `ministryLeaders` (alphabetisch nach
Ressort-Slug) sind alle signifikant. `memberPersonSlugs` enthält nur Personen mit einem Amt der
`membership: 'member'`; die Leitung der Staatskanzlei steht dort **nicht**, wohl aber in
`ministryLeaders`.

**Ungeschriebene Konventionen des Personenprofils**, die die Browser-Smokes erzwingen: `bildAlt`
beginnt mit „Porträt von “, `bildnachweis` gesetzt, `kontakt.email` gesetzt und auf
`freistaat-ostdeutschland.de`.

**`applyCabinetReshuffle`** ist eine Bibliotheksfunktion ohne CLI, deckt nur „Ressort wechselt die
Leitung“ ab und erzeugt zudem die andere ID-Form. `assignments.json` wird redaktionell editiert.

**Regierungswechsel** ist etwas anderes als eine Umbildung: alle Zuordnungen der alten Regierung
bekommen `validTo`, jedes Mitglied eine neue Zeile, dazu ein Archivstand unter
`content/regierung/archiv/`, eine Seite unter
`apps/portal/src/pages/staatsregierung/fruehere-kabinette/` und `importantItems[].governmentSlug`
in `content/portal/home.json`.

Schließlich: `content/regierung/cabinet-page.json` (Chronologie) fortschreiben und den Wissenshub
nachziehen (Kapitel 5.2).

---

### 4.6 Zweig F — Wissenshub ohne Normquelle

**Ablageregel.** Interview, Wiki-Auszug, EAG-Export und Anhänge werden aus `temp-neu/` nach
`context/` kopiert und **committet**, bevor `knowledge/sources.json` darauf zeigt. Konvention:
`context/eag/staatsregierung-ost-<kanal-id>/<export>.html` und
`.../attachments/<message-id>/<datei>`.

**Quellentypen.** `simulation-adjudication` für kanonische EAG-Entscheidungen (darf
`current-state.json` tragen), `historical-wiki-revision` mit `oldid`-Permalink für Miraheze,
`conversation` mit `conversation://`-Pfad **nur** für `conversation-candidates.json` —
`scripts/knowledge.mjs:271` sperrt in `current-state.json` jede Quelle mit
`type === 'conversation'`, unabhängig vom Inhalt.

**Pflichtfelder je Eintrag:** `id`, `title`, `status`, `asOf`, `summary`, `sourceRefs`,
`relatedIds`, `tags`, `notes`. IDs sind über **alle elf Dateien** hinweg eindeutig. `sourceRefs`
verweisen auf eine bekannte `sourceId` mit `role` aus {`primary`, `corroborating`, `conflicting`,
`context`} und nichtleerem `locator`.

**Dokumentweiter `asOf`.** In jeder geänderten Wissenshub-Datei muss der Wurzel-`asOf` ≥ dem `asOf`
jedes Eintrags sein (`scripts/knowledge.mjs:121-129`). Wer eine Person oder Institution mit
heutigem `asOf` einträgt, **muss** den Dokument-`asOf` mit anheben.

**Fallen mit Ansage:**

- Fehlt `sourceRefs` **ganz** (statt als leeres Array), stürzt der Validator ab, statt einen Fehler
  zu melden.
- Nur `relatedIds` wird repositoryweit aufgelöst. Alle anderen ID-Verweise in `current-state.json`
  (`memberPersonIds`, `chiefOfChancelleryPersonId`, `stateSecretariatIds`, …) sind ungeprüft; ein
  Tippfehler verschwindet lautlos aus `LLM_CONTEXT.md`.
- `knowledge/sources.json` wird nicht rekursiv datumsvalidiert; ein **gesetzter**, nicht-`https`-,
  nicht-`conversation`-Pfad wird auf Existenz geprüft, ein **fehlender** Pfad fällt nirgends auf.
  Externe Quellen müssen `https://` sein — `http://` meldet „Repositorypfad fehlt“.
- `knowledge/agenda.json` und `knowledge/AGENDA.md` werden von **keinem** Skript geprüft.
- `knowledge/schema.json` ist Prosa und wird von keinem Skript gelesen.
- Die sieben Summen in `knowledge/holding-positions.json.totals` werden nachgerechnet
  (`scripts/knowledge.mjs:404-415`); die Sollwerte stehen in der Fehlermeldung.
- `holding-positions.json` ist eine **geschlossene Inventur zum 1. Dezember 2023** mit sieben
  Herkunftsportfolios, kein Gegenwartsregister. Eine geerbte Position wird über `currentStatus`,
  `currentStakePercent` und `change2023To2026` fortgeschrieben.

**Generatorkette** (Reihenfolge zwingend):

```bash
npm run knowledge:check && npm run knowledge:build && npm run knowledge:check && git status --porcelain
```

Mitzucommitten: `knowledge/generated/INDEX.json`, `knowledge/generated/LLM_CONTEXT.md` und — bei
Beteiligungsänderungen — `content/regierung/beteiligungsinventar.json`.

**Klarstellungen.** Für jede nicht triviale Quellenbewertung eine Datei
`knowledge/clarifications/<JJJJ-MM-TT>-<thema>.md` mit H1-Titel anlegen und als Quelle
(`source-based-clarification` / `editorial-decision`) eintragen. Das ist die ausdrückliche Ausnahme
vom Verbot der Projektchroniken in `AGENTS.md`.

**Ein Wissenshub-Eintrag macht nichts öffentlich.** Wer öffentliche Wirkung will, pflegt zusätzlich
Themenseite, `content/dashboard/timeline.json`, `content/regierung/beteiligungen.json` oder eine
Pressemitteilung — in nutzerorientierter Sprache, ohne Quellen- oder Simulationsmechanik.

**Nacharbeit:** erledigte Einträge aus `knowledge/open-questions.json` entfernen,
`disputed`-Marker auflösen, `knowledge/AUDIT.md` fortschreiben,
[`docs/ZUARBEITSFORMULAR.md`](ZUARBEITSFORMULAR.md) und `knowledge/AGENDA.md` aktualisieren,
handgeschriebene Bestandszahlen nachziehen (`grep -rn "<alte Zahl>" knowledge/ content/`).

Siehe auch [`knowledge/README.md`](../knowledge/README.md),
[`knowledge/SOURCE_POLICY.md`](../knowledge/SOURCE_POLICY.md) und
[`knowledge/AGENTS.md`](../knowledge/AGENTS.md).

---

### 4.7 Zweig G — Themenseiten

Ziel: `content/themen/<slug>.json`. **Der Dateiname bestimmt den Slug**; Umbenennen ist ein
Slug-Wechsel mit Fernwirkung.

- `title` muss **portalweit** eindeutig sein (`scripts/check-seo.mjs`), nicht nur unter den Themen.
- `updatedAt` darf **nie** nach dem redaktionellen Stichtag liegen
  (`scripts/check-topic-coverage.mjs:76-77`) — also erst den Stichtag ziehen, dann die Themen.
- `federfuehrendesRessort` wird gegen `content/ressorts/` geprüft, `mitzeichnungsressorts`
  **nicht**. Ein Tippfehler dort fällt nirgends auf.
- Modul-IDs werden weder auf Eindeutigkeit noch gegen die festen Anker `ueberblick`,
  `rechtsgrundlagen`, `aktuelle-bezuege`, `faq`, `zustaendigkeit` geprüft. Ein Duplikat erzeugt
  zwei gleiche aria-referenzierte IDs und kann den Accessibility-Smoke brechen — aber nur beim
  **ersten** unter `/themen/` verlinkten Thema.
- `highlightUntil` ohne `highlightFrom` bricht den Parser; ein fehlendes `highlightUntil` erzeugt
  eine unbefristete Hervorhebung.
- `naechsteSchritte` darf leer sein, die Startseite greift aber ungeprüft auf
  `naechsteSchritte[0]` des Leitthemas zu.
- Unbekannte Felder werden still verworfen — das Beispiel `keyDates[].kind: "deadline"` in
  CONTENT.md existiert im Schema nicht.
- `knowledgeProjectRefs` und `content/portal/topic-coverage.json` müssen **wechselseitig** gepflegt
  werden; beide Richtungen werden getrennt geprüft.

**Hervorhebungen** siehe Kapitel 6.3 — dort liegt eine scharfe Kante.

---

### 4.8 Zweig H — Bilder, PDFs, Assets

**Bildquelle** nach `public/images/<regierung|ministerien|jobs|ui>/` (jpg/jpeg/png), dann:

```bash
npm run images:generate
```

Alle erzeugten Dateien unter `public/images/generated/<gruppe>/` **committen** — die CI erzeugt
niemals Bildvarianten. `ResponsivePicture.astro` erwartet die Varianten `-240/-360/-480` als
`.avif`/`.webp`/`.jpg`; **kein Validator prüft ihre Existenz**, sie fehlen dann nur im Browser.

**Warnungen:**

- `npm run images:generate` **überschreibt** `public/images/social/portal-preview.png` mit einem
  eingebauten SVG-Platzhalter (1200×630). Vor dem Commit prüfen.
- Für die Gruppen `presse/` und `social/` werden **keine** responsiven Varianten erzeugt.
- Das Skript benötigt `sharp`. Das Paket ist in keinem `package.json` deklariert und heute nur
  transitiv vorhanden; nach einem `npm ci` kann es fehlen. Läuft der Befehl nicht, ist das zu
  melden, nicht zu umgehen.
- Der `/images/`-Existenzcheck greift nur bei den Feldnamen `bild`, `image` und `hero`
  (`scripts/check-content.mjs:188-190`); ein Bildpfad in einem anders benannten Feld wird nicht
  geprüft.
- Dateinamen klein und ASCII: macOS ist case-insensitiv, ein Großschreibfehler fällt erst in der
  Linux-CI auf.
- Größenbudget: 24 MiB je Datei (`scripts/check-deploy-assets.mjs`, darunter das
  Cloudflare-Limit von 25 MiB). Es gibt **kein** Summen- und kein Dateizahl-Limit.
  `check-deploy-assets` bricht nach dem **ersten** Größenbefund ab und meldet fehlende PDFs im
  selben Lauf nicht mehr; er meldet außerdem Erfolg, wenn das Build-Verzeichnis gar nicht existiert.
- `ResponsivePicture` darf auf OstRecht niemals mit Bild verwendet werden.
- Lokale `.DS_Store`-Dateien wandern über `prepare-site-public` in den Portal-Build. Vor dem Commit
  `find public -name .DS_Store -delete`.

**PDFs** werden nie von Hand nach `public/assets/recht/` kopiert — das tut
`norms:publications:pdf-sync` (4.1 A7).

---

### 4.9 Zweig I — Dashboard, Gesetzgebung, Haushalt, Stichwortregister

**`content/dashboard/*.json` wird von `scripts/check-content.mjs` NICHT fachlich geprüft.** Wer nach
einer Änderung nur `check-content` ausführt, bekommt „Content-QA erfolgreich“, obwohl der Datensatz
kaputt sein kann. Die Regeln sind reine **Build-Zeit**-Prüfungen: `npm run build` ist hier
verpflichtend, nicht optional.

- `items[].references[].normSlug` und `entries[].href` auf `/recht/norm/<slug>/` werden von **keinem**
  Werkzeug gegen den Normbestand aufgelöst.
- Die Gesetzgebung ist auf **genau zwölf Vorgänge** der dritten Plenarsitzung fixiert
  (`scripts/check-content.mjs:1400-1414`). Ein neuer Vorgang unter `content/gesetzgebung/` ist
  verboten, solange diese Regel gilt.
- IDs in beiden Dashboard-Dateien werden nicht auf Eindeutigkeit geprüft.
- `content/dashboard/timeline.json` und `knowledge/timeline.json` sind **zwei getrennte Bestände**
  mit disjunkten ID-Namensräumen und ohne Konsistenzprüfung. Die Dashboard-Zeitachse ist eine
  redaktionelle Auswahl ohne Quellenbindung.
- `content/haushalt/*.json` wird von keiner Seite gerendert, aber in die Sitemap geschrieben.
- `content/stichwortregister.json` ist als **einzige** Datei dieses Bereichs Teil von
  `CORPUS_ROOTS` und damit der D1-Projektionsidentität. Eine Registeränderung ergibt `scope=portal`
  mit `runD1Sync=true`, aber **ohne** `runVisual`. Ein Registerstichwort verdrängt ein gleichlautendes
  abgeleitetes Schlagwort derselben Norm; ein Eintrag mit unbekanntem Norm-Slug überlebt den Loader.

**Service-Seiten und Stellenangebote** (`content/service/`): ein neues
`content/service/seiten/<slug>.json` ist **wirkungslos** — es entsteht keine Seite, und der
Datensatz verschwindet still aus dem Suchindex. Nur `barrierefreiheit`, `datenschutz` und `kontakt`
lesen aus diesem Verzeichnis; `impressum.astro` ist vollständig hartcodiert. Ein neues
`content/ressorts/<slug>.json` **ohne** Leitungszuordnung bricht den gesamten Portal-Build.

---

## 5 Querschnittspflichten (gelten für jeden Eingang)

### 5.1 Beziehungen pflegen

`relatedTopicSlugs`, `relatedNormSlugs`, `relatedPressSlugs` müssen auf vorhandene Slugs zeigen
(`scripts/check-content.mjs:629-645`). Themenseiten leiten ihre Pressebox automatisch aus
`relatedTopicSlugs` der Meldungen ab (die drei jüngsten).

Nicht automatisch geprüft und deshalb von Hand abzugleichen: Norm-, Verkündungs- und
Sachgebietsadressen in `content/dashboard/timeline.json`, in Themen und in Presse werden von
`scripts/check-links.mjs` übersprungen, weil sie On-demand-Routen sind. Jeder Slug ist gegen
`content/normen` bzw. `content/verkuendungen` abzugleichen und im lokalen Worker aufzurufen.

### 5.2 Wissenshub-Kopplung und Coverage

**Jede neue ID in `knowledge/projects.json` oder `knowledge/current-state.json` braucht im selben
Commit einen Eintrag in `content/portal/topic-coverage.json`** (`projectCoverage` bzw.
`currentStateCoverage`) mit einem von:

- `topicSlugs` — dann **zusätzlich** der wechselseitige Rückverweis `knowledgeProjectRefs` in
  `content/themen/<slug>.json` (`scripts/check-topic-coverage.mjs:83-108`), und ein zum
  `projectStage` passender Themenstatus;
- `publicPaths` — Muster `^/[a-z0-9/.-]*/$`, **nicht** gegen gebaute Routen geprüft;
- `reviewedWithoutDedicatedSurface: true` **plus** `reason` (≥ 20 Zeichen). Ein `reason` **ohne**
  das Flag wird nicht geprüft.

Fehlt der Eintrag, wird `content:check` rot — an einer Stelle, die nichts mit der geänderten Datei
zu tun hat.

### 5.3 Generierte Dateien

```bash
npm run knowledge:build
git status --porcelain -- knowledge/generated content/regierung/beteiligungsinventar.json
```

Beides gehört in den Commit. Die CI erzwingt es mit
`git diff --exit-code -- knowledge/generated` im Job `quality` **und** im Job `build`.

### 5.4 Sprach- und Textregeln

`scripts/check-content.mjs:226-269` verbietet in **allem außer** `content/normen` und
`content/verkuendungen`:

- Paarformen („Mitarbeiter und Mitarbeiterinnen“), Schrägstrich-, Sternchen-, Unterstrich- und
  Binnen-I-Formen, „Damen und Herren“, „Frauen und Männer“;
- „politische Simulation“, „fiktive Website“, „fiktive Seite“, „Platzhalterbild“,
  „Platzhaltergrafik“, „BITV-artig“.

Die Prüfung greift auf **jeden** String außer technischen Enum-/ID-/Referenzwerten — auch auf
technische Bezeichner im Fließtext (`foo_bar` wird als Unterstrichform gemeldet). Paarformen werden
von zwei Regeln erfasst und doppelt gemeldet.

E-Mail-Adressen ausschließlich auf `freistaat-ostdeutschland.de`.

Übernommene Mitteilungstexte werden **umgeschrieben**, nicht kopiert. `body` ist eine reine
Absatzliste ohne Überschriften, Listen, Links und Auszeichnungen; Markdown wird restlos aufgelöst.

### 5.5 Titel-Eindeutigkeit

`scripts/check-seo.mjs` lässt **keinen** Seitentitel zweimal zu — portalweit, über alle
Inhaltsarten hinweg. Vor dem Anlegen jeder neuen Seite den Titel gegen den Bestand abgleichen.
Zusätzlich verlangt der Check genau ein `h1` je Seite.

### 5.6 Allowlisten und Konfiguration

| Neuer Wert | Wo eintragen | Nebenwirkung |
| --- | --- | --- |
| Ressortbezeichnung in einer Norm | `allowedNormMinistries`, `scripts/check-content.mjs:58-83` | keine |
| Verkündungsorgan | `allowedEnactingBodies`, `scripts/check-content.mjs:84-104` | keine |
| Sachgebiet | `packages/shared/src/config/law-subjects.json` | **liegt im D1-Projektionsabschluss** → Logikänderung, Äquivalenznachweis nötig (Kapitel 7) |
| Redaktioneller Stichtag | `packages/shared/src/config/editorial.json` | ebenfalls im Abschluss → `scope=shared`, beide Deployments |

---

## 6 Der Stichtagsblock

Der redaktionelle Stichtag ist **ein** Wert: `referenceDate` in
`packages/shared/src/config/editorial.json` (heute `2026-09-06`). Er wird in beide Builds
einkompiliert und kommt zur Laufzeit **nicht** aus D1.

**Er wird ausschließlich vorwärts geschrieben.** Eine Rückdatierung lehnt
`scripts/advance-reference-date.mjs:45-51` fail-closed ab, bevor der Normbestand gelesen wird —
`statusAt` ist nicht invertierbar.

Die folgenden acht Schritte sind eine **geschlossene Kette**. Jeder einzelne für sich macht den
Bestand rot.

**S1 — Audit lesen (schreibt nichts).**

```bash
npm run norms:advance-reference-date -- --to <YYYY-MM-DD>
```

Die Ausgabe nennt jede Norm mit Statuswechsel, jede Fassung mit Einordnungswechsel, die
**ablaufenden Themen-Hervorhebungen**, die am Zielstichtag **laufenden** Hervorhebungen und den
Hinweis, dass der Organisations-Snapshot fehlt. Diese Angaben sind der eigentliche Zweck des Laufs.

**S2 — Themen-Hervorhebung sicherstellen** (siehe 6.3, dies ist die häufigste Ursache eines roten
`content:check` nach einem Stichtagssprung).

**S3 — Schreiblauf.**

```bash
npm run norms:advance-reference-date -- --to <YYYY-MM-DD> --write
```

Er schreibt **ausschließlich** `status` in betroffene `content/normen/*/meta.json` und
`referenceDate` in `editorial.json`. Alles Weitere ist Handarbeit.

**S4 — Organisations-Snapshot anlegen.**

```bash
cp content/organisation/snapshots/<alt>.json content/organisation/snapshots/<neu>.json
# danach asOf im Kopf der Datei auf den neuen Stichtag setzen und den Inhalt prüfen
```

`scripts/check-organization.ts:34-35` liest genau diese Datei **ohne Existenzprüfung**; fehlt sie,
bricht `content:check` mit ENOENT ab — der erste Fehler der Kette, und einer, der wie ein
Werkzeugfehler aussieht.

**S5 — Fixture-Stichtag mitziehen.** `tests/helpers/fixture-corpus.ts:23`
(`FIXTURE_REFERENCE_DATE`) auf denselben Wert setzen; `tests/recht-norm-labels.test.ts:117`
erzwingt die Gleichheit.

**S6 — `topic-coverage.asOf`** redaktionell mitziehen (kein CI-Risiko, aber sonst stiller Drift).
Die `asOf`-Werte der `knowledge/*.json` hängen **nicht** am Stichtag und bleiben unverändert.

**S7 — Wissenshub neu erzeugen.** `knowledge/generated/INDEX.json` (`editorialAsOf`) und
`LLM_CONTEXT.md` („Redaktioneller Stand“) tragen den Stichtag wörtlich und werden byteweise
verglichen.

```bash
npm run knowledge:build && npm run knowledge:check
```

**S8 — Vollständig prüfen.**

```bash
npm run content:check && npm run check && npm run test:fast && npm run build
```

### 6.1 Was der Stichtag bewegt

Normstatus (`future-effective` → `in-force` → `repealed`), Fassungseinordnung, „jüngste
Rechtsänderung“, Termine und Stellenangebote im Portal, Themen-Hervorhebungen, `confirmedAsOf`
jedes Gesetzgebungsvorgangs, die Organisationsvalidierung sowie zahlreiche Spalten der
D1-Tabellen `law_norms`, `law_versions`, `law_search_units`, `law_search_documents`,
`law_norm_derived` und `law_runtime_meta`.

### 6.2 Was der Stichtag **nicht** ist

Er ist **kein** Full-Trigger für die D1 (`scripts/lib/d1-sync-scope.mjs:127-130`). Für eine reine
Stichtagsfortschreibung wird **nie** `--full` angestoßen. Nur bei manuellen Läufen mit einer
Pfadliste statt Git-Diff muss der bisherige Stichtag ausdrücklich genannt werden:

```bash
npm run norms:runtime:d1-sync -- --changed-paths <datei> --reference-date-from <alter Stichtag> …
```

### 6.3 Die Hervorhebungsregel — scharfe Kante

`content/portal/topic-coverage.json` verlangt unter `discoverability.minimumActiveHighlights`
(derzeit `1`) mindestens **eine** am Stichtag laufende Hervorhebung, und
`discoverability.editorialLead` verlangt, dass ein bestimmtes Thema im genannten Zeitraum das
höchstpriorisierte aktive Thema ist (Reihenfolge: `priority` desc, `updatedAt` desc, `title` de asc).

**Ist-Stand am 2026-09-07:** genau eine aktive Hervorhebung — `volksbefragung-2026`, Fenster
`2026-08-09` bis `2026-09-10`. `kommunen-regionen-und-berlin` (bis `2026-08-31`) und
`wohnen-und-vergesellschaftung` (bis `2026-09-01`) sind abgelaufen.

**Daraus folgt: jeder Stichtag ab dem 2026-09-11 lässt `content:check` und
`check-topic-coverage` mit dem heutigen Bestand fehlschlagen.** Wer den Stichtag über den
2026-09-10 hinaus zieht, muss im selben Commit ein Thema mit laufendem Hervorhebungsfenster
versehen und `discoverability.editorialLead` darauf umstellen.

`editorialLead` schlägt nur fehl, wenn ein **zweites** Thema mit laufendem Fenster in der
Reihenfolge davor liegt. Solange `volksbefragung-2026` die einzige aktive Hervorhebung ist, ist
seine `priority` für den Check irrelevant.

---

## 7 D1: was die Projektion bewegt

OstRecht liest zur Laufzeit **ausschließlich** aus D1. Eine neue Verkündung ist erst sichtbar, wenn
die Projektion fortgeschrieben ist — die Website liest nie eine Datei.

Die Projektionsidentität ist ein SHA-256 über genau vier Bestandteile
(`scripts/lib/d1-projection-fingerprint.mjs:280`):

| Bestandteil | Inhalt |
| --- | --- |
| `logic` | transitiver Code-Abschluss von `scripts/sync-recht-d1.mjs` (heute 33 Dateien) + Schema unter `data/recht/d1/` + Versionen externer Pakete |
| `corpus` | `content/normen`, `content/verkuendungen`, `content/stichwortregister.json` |
| `portal` | projektionsrelevanter Auszug aus `content/themen` und `content/presse` (Slug, Titel, Normbezüge; Presse zusätzlich Datum) |
| `scope` | `full` oder `fixture:<Pfad>@<Hash>` |

**Für den redaktionellen Alltag gilt: nichts tun.** Der Klassifikator setzt `run_d1_sync=true`,
der Job `d1_sync` läuft mit `--git-diff <before> <sha> --budget incremental --recover`, der
Base-State-Guard verifiziert den Ausgangszustand.

**Zwei Dinge muss ein Agent trotzdem wissen:**

1. **Was bewegt den Portal-Hash?** Nur Slug, Titel, Normbezüge und (bei Presse) Datum. Teaser,
   Hervorhebung, Priorität, Fließtext und Bild sind projektionsneutral. Ändert sich der Auszug,
   läuft ein inkrementeller Sync mit `derivedRebuild` **aller** Normen (~15 600 Anweisungen) — nie
   eine Vollprojektion.
2. **Wann ist es eine Logikänderung?** Sobald eine der 33 Abschlussdateien berührt wird. Dazu
   gehören `packages/shared/src/config/editorial.json`, `packages/shared/src/config/law-subjects.json`
   und `packages/shared/src/lib/portal/schema.ts`. Vor dem Commit prüfen:

```bash
npm run norms:runtime:d1-closure
```

Liegt eine geänderte Datei darin, ist ein Äquivalenznachweis zu rechnen:

```bash
npm run norms:runtime:d1-prove -- --base origin/main
```

Ergebnis `identity` oder `incremental` = grün. Ergebnis `full` = echtes D1-Release-Gate, siehe
[`docs/DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md), Abschnitt „D1-Release-Gate“. Ein
Schema-Release wird **nie** vom Workflow eingespielt: lokal → Staging → Produktion, jeweils
Migration zuerst, dann Vollprojektion, dann Verifikation.

**Verboten:** `--stamp-fingerprint` als Abkürzung, `--assume-narrow-logic-change` ohne lokalen
Äquivalenznachweis, jede Fingerabdruck-Manipulation, um einen nötigen Sync zu überspringen, ein
produktives `--full` außerhalb des Release-Gates.

---

## 8 Abschlussprüfung: die Befehlsketten

**`npm run test:pr` enthält weder `content:check` noch `knowledge:check` noch `docs:check`.** Eine
reine Inhaltsänderung, die nur mit `test:pr` geprüft wurde, ist ungeprüft. Umgekehrt enthält
`content:check` keine Link-, SEO- oder Assetprüfung, weil diese einen frischen Build voraussetzen.

### 8.1 Eingang mit Normquelle

```bash
npm run norms:workflow -- --file "<Datei>.html" --write
npm run norms:publications:pdf-sync -- --write
npm run knowledge:build
npm run content:check
npm run docs:check
npm run check && npm run test:fast && npm run build
npm run test:links:run && npm run test:seo:run
OSTRECHT_D1_FIXTURE=data/recht/runtime-fixture.json npm run test:a11y:ci
OSTRECHT_D1_FIXTURE=data/recht/runtime-fixture.json npm run test:browsers:ci
```

`scripts/norm-workflow.mjs` deckt **nicht** ab: `docs:check`, `norms:publications:pdf-sync`,
`norms:ost:residual-audit --update-backlog`, jede Screenshot-Prüfung, jede D1-Prüfung, das Anlegen
des Organisations-Snapshots und die Reihenfolge `knowledge:build` vor `content:check`.

### 8.2 Eingang ohne Normquelle (Presse, Themen, Organisation, Wissenshub)

```bash
npm run knowledge:build
npm run content:check
npm run docs:check
npm run check && npm run test:fast
SITE_TARGETS=portal npm run build:portal
SITE_TARGETS=portal npm run test:links:run
SITE_TARGETS=portal npm run test:seo:run
SITE_TARGETS=portal npm run test:a11y:ci
SITE_TARGETS=portal npm run test:browsers:ci
```

`SITE_TARGETS` muss zum gebauten Ziel passen — ohne die Variable prüfen Links, SEO und Smokes
gegen ein Ziel, das gar nicht gebaut wurde. Alternativ das vollständige `npm run build` fahren.

### 8.3 Schneller Zwischenlauf

`node scripts/check-content.mjs` allein läuft in ~6 s und deckt für Presse-, Themen- und
Organisationsänderungen den relevanten Teil ab. Die volle Kette `npm run content:check` (elf
Audits, ~25 s, darunter der strikte Normimport über `Gesetze/`) gehört in den Abschlusslauf.

### 8.4 Was lokal auf macOS **nicht** prüfbar ist

| Bereich | Grund | Ersatz |
| --- | --- | --- |
| Screenshot-Pixelvergleich | `playwright.config.ts:38/45` setzt `ignoreSnapshots` außerhalb Linux | Kapitel 9 |
| Produktive D1-Entscheidung | braucht `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` | PR-Job `d1_token_check` lesen |
| Groß-/Kleinschreibung von Dateinamen | macOS ist case-insensitiv | ASCII-Kleinschreibung als Regel |
| Vollbestand-Verhalten der jüngsten Verkündung | PR-CI sieht nur das synthetische Fixture | `npm run build:recht && npm run norms:runtime:d1-local` (ohne `OSTRECHT_D1_FIXTURE`), dann `SITE_TARGETS=law npm run test:browsers:ci` |

Für den lokalen OstRecht-Worker gilt: `npm run norms:runtime:d1-local` trennt die
Persist-Verzeichnisse korrekt (`.cache/wrangler-fixture` für das Fixture, `.cache/wrangler-local`
für den Vollbestand). Der direkte Aufruf `npm run norms:runtime:d1-seed` tut das **nicht** und
schreibt einen Fixture-Seed in das Vollbestandsverzeichnis; die Empfehlung in `README.md` und
`docs/REVOSAX_BULK_IMPORT.md` ist an dieser Stelle irreführend.

---

## 9 Screenshot-Baselines

Versioniert sind **ausschließlich** 313 Dateien `tests/visual.spec.ts-snapshots/*-linux.png`. Es gibt
seit PR #29 **keine** `-darwin`-Baselines mehr; `-linux` in `playwright.config.ts:46` ist eine
Konstante, kein Plattform-Platzhalter.

**Auslöser.** `run_visual=true` setzen alle Änderungen unter `content/presse`, `content/themen`,
`content/dashboard`, `content/gesetzgebung`, `content/haushalt`, `content/portal`,
`content/organisation`, `content/regierung`, `public/` und `editorial.json`. **Reine Rechtsinhalte
(`content/normen`, `content/verkuendungen`) lösen die Suite bewusst NICHT aus** — ein Stichtagssprung
dagegen schon, auch ohne jede CSS-Änderung.

**Erneuern — nur bewusst, nie stillschweigend:**

```bash
npm run test:visual:update:linux -- --site portal   # braucht Docker
```

Ohne Docker: Workflow „Screenshot-Baselines erneuern“ (`workflow_dispatch`) starten, dann

```bash
npm run test:visual:baselines:apply -- --run <Lauf-ID>   # braucht gh
```

Steht weder Docker noch `gh` zur Verfügung, ist der Pull Request **unvollständig** und das ist
ausdrücklich zu melden — nicht zu übergehen.

**Fallen:**

- Der Baseline-Workflow verliert sein Artefakt, wenn irgendein Nicht-Bild-Test fehlschlägt.
- `apply` prüft den Commit des Artefakts nicht; ein Artefakt zu einem anderen Stand erzeugt falsche
  Baselines.
- Das Baseline-Artefakt lebt 14 Tage.
- Teilweise Erneuerung (`--critical`, `--grep`, `--site`) lässt Reste stehen.
- Die `-actual.png`-Dateien aus dem `visual-report`-Artefakt sind **keine** Baselines.
- Pixeltoleranz aufzuweichen statt Instabilität zu beheben ist verboten.
- `test:visual:critical` deckt von den Themenoberflächen nur `/themen/volksbefragung-2026/` und den
  Startseitenausschnitt ab; `/themen/`, `/themen/kulturpass/` und die fünf Themenausschnitte
  brauchen `test:visual:extended`.

---

## 10 Commit-Umfang

Vor dem Commit prüfen, ob **alle** erzeugten Artefakte enthalten sind. `scripts/check-content.mjs`
liest den Git-Index (`git ls-files --cached --others --exclude-standard`); eine nicht hinzugefügte
Datei ist lokal grün und in der CI-Auscheckung rot.

**Zweig A/B/C (Normen und Verkündungen):**

```
Gesetze/<Quelle>.html, Gesetze/<Quelle>.pdf
public/assets/recht/<slug>.pdf
content/normen/**            content/verkuendungen/*.json
scripts/import-normen.mjs    (Importkonfiguration)
data/recht/amendments/**     data/recht/consolidation-sources.json
data/recht/consolidation-manifest.json   data/recht/consolidation-report.md
data/recht/parsed/revosax/*.json         data/recht/sources/revosax/**
data/recht/ost-residual-backlog.json     (nur wenn fortgeschrieben)
knowledge/**                 knowledge/generated/**
content/regierung/beteiligungsinventar.json
content/portal/topic-coverage.json
packages/shared/src/config/editorial.json   (nur bei Stichtagsänderung)
content/organisation/snapshots/<Stichtag>.json
tests/helpers/fixture-corpus.ts             (nur bei Stichtagsänderung)
tests/visual.spec.ts-snapshots/*-linux.png  (nur bei bewusster Oberflächenänderung)
```

**Zweig D/E/F/G/H (ohne Normquelle):** dieselbe Liste ohne `Gesetze/`, `data/recht/` und
`content/normen`, dafür `content/presse/**`, `content/themen/**`, `content/organisation/**`,
`content/regierung/**`, `public/images/**` **einschließlich** `public/images/generated/**`,
`context/**`.

Dann:

```bash
git switch -c <thema>
git add -A
git commit
```

Kein Bericht-, Status- oder Handoff-Markdown anlegen. Offene Quellenlücken gehören in
[`CONTENT_GAPS.md`](../CONTENT_GAPS.md), offene technische Arbeiten in [`TODO.md`](../TODO.md)
(ohne abgehakte Einträge — `scripts/check-docs.mjs` lehnt sie ab).

---

## 11 Abbruch- und Meldepflichten

In diesen Fällen wird **nicht** weitergearbeitet, sondern gemeldet:

- PDF und HTML widersprechen sich strukturell.
- Ein Änderungsbefehl passt nicht eindeutig auf die Ausgangsfassung.
- Der REVOSax-Snapshot einer Zielnorm fehlt und ist nicht beschaffbar.
- Ein Bildmotiv widerspricht dem Text oder trägt sichtbare Beschriftungsfehler.
- Ein neuer Wert bräuchte eine Allowlist-Ergänzung ohne Beleg.
- Weder Docker noch `gh` sind verfügbar und Screenshot-Baselines müssten erneuert werden.
- `npm run norms:runtime:d1-prove` meldet `full` — der Merge braucht dann das Release-Gate.

Gemeldet wird im Pull Request und, wo es um eine Quellenlücke geht, in `CONTENT_GAPS.md`; wo eine
Entscheidung des Benutzers nötig ist, zusätzlich in
[`docs/ZUARBEITSFORMULAR.md`](ZUARBEITSFORMULAR.md).

---

## 12 CI verstehen

### 12.1 Was welche Änderung auslöst

Vor jedem Commit lokal bestimmen — die Ausgabe ist exakt das, was der Job `classify` in CI schreibt:

```bash
git diff --name-only origin/main...HEAD | node scripts/classify-change-scope.mjs --stdin
```

| Geänderter Pfad | scope | D1-Sync | visual | Deployment |
| --- | --- | --- | --- | --- |
| `content/normen/**`, `content/verkuendungen/**` | portal | ja | **nein** | Portal |
| `content/stichwortregister.json` | portal | ja | nein | Portal |
| `content/themen/**`, `content/presse/**` | portal | ja (derived) | ja | Portal |
| `content/organisation/**`, `content/regierung/**`, `content/dashboard/**` | portal | nein | ja | Portal |
| `public/assets/recht/**` | law | nein | ja | OstRecht |
| `packages/shared/src/config/editorial.json` | shared | ja | ja | beide |
| `packages/shared/src/config/law-subjects.json` | shared | ja | ja | beide |
| `data/recht/d1/**` (Schema) | — | **nein** (bekannte Lücke) | nein | — |
| ≥ 25 berührte Normverzeichnisse | portal | ja | nein | Portal + `full_corpus_smoke` |
| `knowledge/**.json` | ci-only | nein | nein | keins |
| `knowledge/**.md`, `docs/**.md` | docs-only | nein | nein | keins |

Die Tabelle in `docs/DEPLOYMENT_RUNBOOK.md` ist an dieser Stelle veraltet; maßgeblich ist allein
der Klassifikator.

### 12.2 Welche Checks was blockieren

- **Pflichtchecks des Rulesets „main geschützt“ sind exakt vier:** `classify`, `quality`,
  `accessibility_smoke`, `browser_smoke`.
- **Das Deployment blockieren auf `main` nur** `build`, `runtime_smoke` und `d1_sync`.
- **`visual` blockiert nichts** — weder Merge noch Deployment.
- **`d1_token_check` ist kein Pflichtcheck.** Ein Pull Request mit rotem `d1_token_check` ist
  mergebar und macht `main` danach zuverlässig rot. **Vor jedem Merge ist er von Hand zu prüfen.**
- **`docs_check` ist kein Pflichtcheck**, und bei `scope=docs-only` sind drei der vier Pflichtchecks
  übersprungen. Übersprungene Pflichtchecks gelten als bestanden. Der Pflichtcheck `quality` führt
  `node scripts/check-docs.mjs` allerdings bedingungslos aus (`pull-request.yml:244`) — die
  Dokumentationshygiene ist also in jedem Nicht-`docs-only`-Lauf ein hartes Gate.
- Ein rotes `d1_seed` lässt `runtime_smoke` und `d1_sync` auf `skipped` fallen — und `deploy`
  veröffentlicht trotzdem.
- Repository-Admins können das Ruleset umgehen (`bypass_mode: always`). **Diese Möglichkeit wird
  nicht genutzt.**

### 12.3 Erwartungsbild eines reinen Presse-Pull-Requests

`scope=portal`; `run_content_check`, `run_unit_tests`, `run_d1_sync`, `run_visual` = true;
`ui_targets=portal`; `quality`, `accessibility_smoke`, `browser_smoke` laufen; `d1_seed` und
`full_corpus_smoke` werden übersprungen; `d1_sync` läuft inkrementell. Weicht der reale Lauf davon
ab, ist die Ursache zu klären, bevor gemergt wird.

---

## 13 Wenn etwas rot ist

**`quality` bricht an `git diff --exit-code -- knowledge/generated` ab** → `npm run knowledge:build`
ausführen und die generierten Dateien committen.

**`content:check` bricht mit ENOENT auf `content/organisation/snapshots/…json` ab** → der
Stichtag wurde ohne Snapshot fortgeschrieben, Kapitel 6 S4.

**`content:check` meldet „keine aktive Hervorhebung“** → Kapitel 6.3.

**`import-normen --strict` meldet `would-update`** → jemand hat ein redaktionelles Normfeld von Hand
in `meta.json` geändert. Der Wert gehört in die Importkonfiguration; `meta.json` von Hand editierbar
sind nur `summary`, `keywords`, `subjects`-Ergänzungen, `relatedNorms`, `affectedNorms`,
`enacted`/`enacting`-Beziehungen, `predecessor`/`successor`, `sourceReferences`.

**`visual` ist rot** → Bericht sichten, Motive einzeln bewerten, Baselines bewusst erneuern
(Kapitel 9). Nie stillschweigend übergehen, nie die Toleranz aufweichen.

**`d1_sync` ist rot** → Log lesen; die Fehlermeldung aus `assessSyncDecision`
(`scripts/sync-recht-d1.mjs`) enthält den vollständigen Weg. Drei Ursachen:

1. Nachweis `full` oder Schemaänderung → D1-Release-Gate im
   [`docs/DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md).
2. Budgetüberschreitung → Profil in `data/recht/d1-sync-budgets.json` prüfen; die Änderung ist zu
   groß für `incremental`.
3. Basiszustandsabweichung (`SyncBaseMismatch`) → die produktive D1 trägt nicht die Identität des
   Basis-Commits. Ursache klären, **nicht** mit `--recover` überdecken, ohne sie verstanden zu haben.

**Ein Lauf wurde mitten im Schreiben abgebrochen** → D1 trägt
`sync_state=incremental-in-progress:<Zeit>` und keinen `projection_fingerprint`. Der nächste Lauf
erkennt das; die Wiederherstellung ist eine markierte Recovery-Vollprojektion, erst Staging, dann
Produktion.

**Abgebrochenen Lauf neu starten** nur, wenn die Ursache nachweislich außerhalb des Codes lag
(Registry-, Cloudflare- oder Netzausfall). Sonst: lokal reproduzieren, Korrektur-PR, normale CI.
**Kein manueller Eingriff in Cloudflare, keine lokale Ersatzveröffentlichung.**

---

## 14 Fallstudie: das Volkskammerwahlergebnis

Der Eingang war eine StAnzO-Ausgabe mit einer nichtnormativen Bekanntmachung plus PDF. Was
geschah — und welche Regel dieses Playbooks es verhindert:

| Was passierte | Regel |
| --- | --- |
| Der `norms:workflow`-Lauf meldete grün, ohne etwas zu schreiben (`recognized-non-normative`) und wurde als Erledigung gelesen. | 4.2 B1 |
| Die Verkündung wurde eingepflegt, aber der Bestand nicht auf Futurformulierungen zum Wahltag durchsucht. | 4.2 B6 |
| Es wurde direkt auf `main` gepusht, wodurch `d1_token_check` nie lief. | Regel 3, 12.2 |
| Der vorangegangene Commit hatte eine Oberflächenänderung ohne Baseline-Erneuerung; `visual` war rot, blockierte aber weder Merge noch Deployment. | 9, 12.2 |
| `d1_sync` wurde rot, `deploy` übersprungen — der Eintrag ist bis heute nicht öffentlich. | 13 |

**Stand 2026-09-07, nachprüfbar:** `main` steht auf `88e46b76d`; der Deploy-Lauf 34057455994 ist
mit rotem `d1_sync` gescheitert, der Screenshot-Lauf 34106802597 ist ebenfalls rot. Beide
Produktionsziele antworten mit `x-portal-commit: 582c0914…`, also dem Vorgängercommit — das
Volkskammerwahlergebnis ist nicht veröffentlicht. Die Wiederherstellung folgt Kapitel 13, nicht
einem manuellen Eingriff.

---

## 15 Checkliste zum Abhaken

```
[ ] temp-neu/ unverändert; Quellen kopiert, nicht verschoben
[ ] Kein Datensatz und kein Link zeigt nach temp-neu/
[ ] PDF gegen HTML geprüft; Konflikte in CONTENT_GAPS.md
[ ] Zweig(e) nach Kapitel 3 bestimmt und vollständig abgearbeitet
[ ] Importkonfiguration ergänzt (subjects und pageCount gesetzt)
[ ] norms:workflow --quick, dann --write
[ ] norms:publications:pdf-sync -- --write
[ ] Nichtnormative Ausgabe: Verkündungsdatensatz von Hand, entries[].type geprüft
[ ] Beziehungen beidseitig gepflegt (Normen, Themen, Presse, Register)
[ ] Wissenshub: Quelle abgelegt, Eintrag, asOf angehoben
[ ] topic-coverage: jede neue Wissenshub-ID eingetragen, Rückverweis gesetzt
[ ] Stichtagskette vollständig (Audit, Hervorhebung, --write, Snapshot, Fixture, asOf)
[ ] knowledge:build ausgeführt, generierte Dateien im Commit
[ ] images:generate ausgeführt, Varianten im Commit, social/-Platzhalter geprüft
[ ] Titel portalweit eindeutig
[ ] Sprachregeln eingehalten, Markdown aufgelöst
[ ] Abschlusskette nach Kapitel 8 gelaufen (inkl. docs:check und build)
[ ] classify-change-scope gegen den Diff gelaufen; Erwartungsbild notiert
[ ] D1-Abschluss geprüft; bei Logikänderung Äquivalenznachweis
[ ] Screenshot-Baselines bewusst erneuert oder Unvollständigkeit gemeldet
[ ] Commit-Umfang nach Kapitel 10 abgeglichen
[ ] Branch + Pull Request; nicht auf main gepusht
[ ] Nach dem Merge: d1_token_check war grün, deploy ist grün, Stand nachkontrolliert
```
