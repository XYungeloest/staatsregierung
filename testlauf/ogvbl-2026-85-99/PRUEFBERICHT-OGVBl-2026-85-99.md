# Prüfbericht: probeweise Einarbeitung OGVBl. 2026 Nr. 85 bis 99

**Gegenstand:** vorbereitete Gesetzblätter OGVBl. 2026 Nr. 85 bis 99 („Polizei- und Sicherheitspaket“), Testquelle `temp-neu/OGVBl.2026Nr.85100.html`
**Status der Blätter im Test:** *vorbereitete Fassungen*. Annahme durch die Volkskammer und Verkündung am 13. November 2026 sind für diesen Test **unterstellt**.
**Prüfdatum:** 13. November 2026
**Arbeitsbereich:** `staatsregierung-testlauf-ogvbl-85-99` neben dem Originalcheckout (isolierter lokaler Klon, Zweig `testlauf/ogvbl-85-99`, ohne Remote)
**Ausgangsrevision:** `e611963b9bafb4199b41b4b86a3868a14bd2a6e7` (main, Working Tree sauber, keine lokalen Änderungen)
**Redaktioneller Stichtag des Bestands:** 14. Oktober 2026 (`packages/shared/src/config/editorial.json`), im Test **nicht** fortgeschrieben
**Nachprüfung:** Am 13. November 2026 lag eine neue Fassung der Sammeldatei vor (SHA-256 `5e77b3b2…`). Ihre Prüfung mit Status aller Befunde, neuen Befunden und Ersatzformulierungen zum Einfügen steht in **Abschnitt 8**. Die Abschnitte 0 bis 7 beschreiben unverändert die erste Fassung.

Kennzeichnung im Test: Jede Testnorm trägt in `summary` und jedem Änderungshinweis den Vorsatz „Vorbereitete Fassung (Testlauf)…“, jede Test-Verkündung im Titel „– vorbereitete Fassung (Testlauf, Annahme und Verkündung unterstellt)“. Im lokalen Rechtsportal erscheint der Hinweis auf allen 15 Verkündungsseiten und in den Fassungshinweisen.

Legende der Einordnung:

- **[VK]** Die Volkskammer müsste den Normtext vor dem Beschluss ändern.
- **[VL?]** Indiz für eine Abweichung des Gesetzblatts von der Beschlussvorlage; nicht prüfbar, weil die Drucksachen im Repository fehlen (siehe 1.4).
- **[TÜ]** Betrifft allein die technische Übernahme in Wissenshub und Rechtsportal.
- **[VB]** Vorbestehender Fehler der Referenzfassung, vom Paket berührt oder verschärft.

---

## 0 Vor einer Verkündung zu klären

Stand der ersten Fassung. Für die neue Fassung gelten 8.1 und 8.2.

| Nr. | Punkt | Einordnung | Befund |
| --- | --- | --- | --- |
| 1 | **Stellung der Kasernierten Grenzpolizei**: § 97 Abs. 1 PVDG n. F. verweist für die Polizeidienststellen auf das VPOG, dessen § 2 Abs. 2 sie abschließend und **ohne** Grenzpolizei aufzählt; zugleich erklärt § 1 Satz 3 PVDG n. F. den gesamten Polizeivollzugsdienst zur „Volkspolizei“. Die Grenzpolizei ist danach zugleich Teil der Volkspolizei und keine Polizeidienststelle. | [VK] | B-01, G-1 bis G-10 |
| 2 | **§ 46 Abs. 1 PVDG**: Die Freigabe besonderer Waffen geht an „den/die Volkspolizeipräsident:in“, ein Amt, das kein Blatt schafft; das Landespolizeipräsidium entfällt mit VPOG § 2 Abs. 2. Für die Grenzpolizei fehlt jede Freigabeinstanz. | [VK] | B-02 |
| 3 | **Inkrafttreten Staatsschutz**: Das LfStErrG (Nr. 91) gilt ab 1.12.2026 und löst das Landesamt für Verfassungsschutz auf; OstSNDG, OstSKG und die Bezeichnungsanpassung (Nr. 92, 93, 99) gelten erst ab 1.1.2027. Im Dezember 2026 hat das Landesamt für Staatsschutz keine Befugnisnorm, die Staatsschutzkommission und das Kontrollgremium bestehen nicht, und 24 geltende Normen nennen eine nicht mehr bestehende Behörde. | [VK] | B-20 |
| 4 | **OstSNDG § 1 Abs. 1**: Nr. 4 und Nr. 5 sind zwei Fassungen desselben Schutzguts nebeneinander; daraus folgen der Selbstverweis in § 2 Abs. 1 Nr. 1 („§ 2 Absatz 1 Nummer 4 bis 7“) und die Lücke in § 13 Abs. 2 (Nr. 7 ohne Löschfrist). § 18 verknüpft die Übermittlungsverbote mit „und“ statt „oder“. | [VK] [VL?] | B-22 bis B-25 |
| 5 | **Verweisungsanpassung Nr. 99 Art. 3**: Ersetzt nur Gesetzes- und Behördennamen. 14 geltende Normen verweisen auf **einzelne Paragraphen** des OstVSG (§ 2, § 2 Abs. 1, § 3 Abs. 1), deren wörtliche Übertragung auf das OstSNDG falsche Vorschriften trifft. | [VK] | B-30 |
| 6 | **Fehlende Folgeänderungen** zu § 97 Abs. 1 Nr. 5 PVDG (Pass-Ausführungsgesetz, Landesjugendhilfegesetz), zum Landespolizeipräsidium (Informationssicherheitsgesetz, Polizeifachhochschulgesetz, Besoldungsgesetz), zu § 100 PVDG (Polizeiorganisationsverordnung), zu § 97 Abs. 3 und 4 und § 101 PVDG. | [VK] | B-05 bis B-08 |
| 7 | **Verweisfehler**: PolBeschStG § 1 Abs. 2 Nr. 1 („§ 3“ VPOG statt § 2), OstSZG § 3 Satz 2, KRITIS-Gesetz §§ 8, 9, 11, 14 („Ost-Sicherheitsgesetz“, § 8 statt § 7), § 13 Abs. 1 Nr. 1 („§ 4 Absatz 1“). | [VK] | B-11, B-27, B-28, B-33 |
| 8 | **Einbeziehung der Grenzpolizei** in OstSZG (beteiligte Behörden, § 2 Abs. 3), § 46a Abs. 3 PVDG, KRITIS-Gesetz § 7 Abs. 2, OstLVSG §§ 2 und 3, VPOG § 13 (Kennzeichnung), PolFHG §§ 22b und 22c, PolDigG §§ 9 bis 12. | [VK] Entscheidung | Abschnitt 4 |
| 9 | **OstSKG § 3 Abs. 1**: Das Kontrollgremium tritt „in der Regel einmal in der Legislatur“ zusammen; alle Unterrichtungs- und Berichtspflichten setzen häufigere Sitzungen voraus. | [VK] [VL?] | B-26 |
| 10 | **Sicherheitsgesetz**: „Artkel 2“, unklare „Leitung der Geschäftsstelle“ (§ 8 Abs. 1), verstümmelte Sätze in § 8 Abs. 2 und 3, Zusammensetzung des Sicherheitskabinetts nach nicht mehr bestehenden Ressortzuschnitten (§ 3 Abs. 2). | [VK] [VL?] | B-15 bis B-18 |
| 11 | **Nr. 85 Art. 2 Nr. 2** nennt keinen Ort der Ersetzung („Es werden je die Wörter …“). | [VK] redaktionell | B-03 |
| 12 | **Abgleich mit den Beschlussvorlagen**: Die Drucksachen liegen nicht vor; mehrere Befunde (Nr. 4, 9, 10; Tippfehler) deuten auf Fassungsreste. | [VL?] | 1.4 |
| 13 | **Technische Übernahme**: Sammeldatei mit 15 Ausgaben, keine PDFs, vier eingeführte Gesetze vom Parser nicht erkannt, vorbestehende Konsolidierungslücken im PVDG, fehlende REVOSax-Snapshots, Prüfketten bleiben trotz der Befunde grün. | [TÜ] [VB] | Abschnitt 3.3 |

---

## 1 Arbeitsumgebung und Ausgangsstand

### 1.1 Maßgebliche Quellen im Repository

| Gegenstand | Quelle |
| --- | --- |
| Geltender Rechtsstand (gespeicherte Fassungen) | `content/normen/<slug>/{meta.json,history.json,versions/*.json}` |
| Verkündungsstand | `content/verkuendungen/*.json`; amtliche HTML-Quellen unter `Gesetze/` (letzte Ausgabe im Bestand: OGVBl. 2026 Nr. 84 vom 14.10.2026) |
| Konsolidierte Fassungen übernommener Stammnormen | REVOSax-Snapshots `data/recht/sources/revosax/`, Patch-Rezepte `data/recht/amendments/<akt>/<ziel>.json`, Zielliste `data/recht/consolidation-sources.json`, Ergebnis `data/recht/consolidation-manifest.json` |
| Laufzeit des Rechtsportals | D1-Projektion aus `content/` (lokal: SQLite-Seed über `scripts/serve-law-worker.mjs`) |
| Wissenshub | `knowledge/` (u. a. `projects.json` → `project-grenzpolizei`), `knowledge/generated/` |
| Ablaufregeln | `AGENTS.md`, `docs/EINPFLEGE_PLAYBOOK.md`, `docs/NORM_WORKFLOW.md` |

### 1.2 Bereits verkündete, später wirksame Änderungen

Für die Zielnormen (PVDG, KGrPolG, PolFHG, Hochschulgrade-VO, OstVSG, OstAG G 10) liegt im Bestand **keine** verkündete, später wirksame Fassung vor; die jüngste PVDG-Fassung gilt seit 1.8.2026. Für das Paket relevant ist nur der **Sicherheitserlass KRITIS 09/2026** (in Kraft seit 8.9.2026, außer Kraft mit Ablauf des 8.12.2026). Das KRITIS-Gesetz (Nr. 94) gilt bis auf § 3 Abs. 2 erst ab 1.1.2027. Für die vom Erlass getragenen Schutzmaßnahmen entsteht vom 9.12. bis 31.12.2026 eine Lücke, soweit nicht § 15a PVDG n. F. (ab 14.11.2026) greift.

### 1.3 Isolation

- Lokaler Klon (`git clone` aus dem Checkout, danach `git remote remove origin`), eigener Zweig, keine Commits, kein Push. Abhängigkeiten per APFS-Kopie (`cp -c`) übernommen, damit nichts in das `node_modules` des Originals schreibt.
- Testquelle kopiert, nicht verschoben (SHA-256 `97480bf5640ce77f6ed6baa31d21b17b5f8d07706b124dd53255854760e08e1a`, in Original und Kopie identisch).
- Lokale Ziele: lokale D1-Projektionen unter `.cache/wrangler-paket2` (Paket) und `.cache/referenz/` (Referenz-Seed), lokaler Worker auf `127.0.0.1:4399`. Kein Cloudflare-Token gesetzt, kein Remote-Befehl, kein REVOSax-Abruf.
- Kontrolle der Unverändertheit: Abschnitt 7.3.

### 1.4 Inventar der Gesetzblätter

Alle Blätter stehen in **einer** Datei `temp-neu/OGVBl.2026Nr.85100.html` (Google-Docs-Export, 343 154 Byte). Ausgegeben jeweils „zu Dresden am 13. November 2026“, unterzeichnet „Dr. Karl Honecker, Der Staatspräsident“. Für den Test wurde die Datei verlustfrei in 15 Einzelquellen `Gesetze/OGVBl. 2026 Nr. NN.html` aufgeteilt (Prüfung: Verkettung der Teile = Originalinhalt).

| Nr. | Titel | Inhalt | Inkrafttreten | Drucksache |
| --- | --- | --- | --- | --- |
| 85 | Gesetz über die Bezeichnung der Polizei des Freistaates Ostdeutschland als Volkspolizei | Art. 1 PVDG (§ 1, § 46), Art. 2 PolFHG (Bezeichnung, Hochschulname), Art. 3 Hochschulgrade-VO | 1.12.2026 | nicht im Repository |
| 86 | Gesetz über die Organisation der Volkspolizei … und zur Stärkung der bürgernahen Polizeiarbeit | Art. 1 **VPOG** (neu), Art. 2 PVDG (§ 97 Abs. 1–2, Aufhebung §§ 99, 100) | 1.12.2026 | nicht im Repository |
| 87 | Gesetz zur Reform der Polizeiausbildung | Art. 1 PolFHG §§ 22a–22d, Art. 2 Anpassungsauftrag APO Polizei, Art. 3 Übergang | 1.1.2027 | nicht im Repository |
| 88 | Gesetz zur Einführung der unabhängigen Polizei-Beschwerde- und Ermittlungsstelle | Art. 1 **PolBeschStG** (neu), Art. 2 PVDG § 98, Art. 3 Überleitung | „am ersten Tag des ersten Monats nach Verkündung“ = 1.12.2026 | nicht im Repository |
| 89 | Gesetz über die Digitalisierung der Volkspolizei | Art. 1 **PolDigG** (neu) | 1.1.2027 | nicht im Repository |
| 90 | Gesetz über die Einführung eines Ostdeutschen Sicherheitsgesetzes | Art. 1 **Ostdeutsches Sicherheitsgesetz** (neu) | 1.1.2027 | nicht im Repository |
| 91 | Staatsschutzamt-Errichtungsgesetz (LfStErrG) | Stammgesetz ohne Artikelgliederung, §§ 1–14 | 1.12.2026 | nicht im Repository |
| 92 | Gesetz zur Einführung eines Staatsschutz- und Nachrichtendienstgesetzes | Art. 1 **OstSNDG** (neu) | 1.1.2027 | nicht im Repository |
| 93 | Gesetz über die Einführung eines Staatsschutz-Kontrollgesetzes | Art. 1 **OstSKG** (neu) | 1.1.2027 | nicht im Repository |
| 94 | Gesetz zur Einführung eines Gesetzes zum Schutz kritischer Infrastrukturen | Art. 1 **OstKRITISG** (neu), Art. 2 Übergang | 1.1.2027; Art. 1 § 3 Abs. 2 am 14.11.2026 | nicht im Repository |
| 95 | Gesetz zur Einführung eines Luftverkehrssicherungsgesetzes | Art. 1 **OstLVSG** (neu) | 1.1.2027 | nicht im Repository |
| 96 | Gesetz zur Änderung des Polizeivollzugsdienstgesetzes zur Stärkung der Terrorismusabwehr | Art. 1 PVDG §§ 15a, 20a, 46a | 14.11.2026 (Tag nach Verkündung) | nicht im Repository |
| 97 | Gesetz zur Stärkung der wehrhaften Demokratie | Art. 1 **VTPG**, Art. 2 **DemFG** (beide neu) | 1.1.2027 | nicht im Repository |
| 98 | Gesetz zur Einführung eines Sicherheitsbehörden-Zusammenarbeitsgesetzes | Art. 1 **OstSZG** (neu) | 1.1.2027 | nicht im Repository |
| 99 | Gesetz zur Einführung der Ost-Sicherheitsreform und zur Anpassung des Landesrechts | Aufhebung OstVSG und OstAG G 10 (mit Ablauf 31.12.2026), Bezeichnungsanpassung, Überleitung | 1.1.2027 | nicht im Repository |

**Vollständigkeit und Fassungen.** Die Nummernfolge 85 bis 99 ist lückenlos; es gibt keine doppelten Blätter und keine zweite Fassung eines Blatts. Zu keinem Blatt liegt ein PDF vor. Drucksachen, Änderungsanträge und Begründungen zu diesem Paket sind im Repository nicht vorhanden (Suche in `context/`, `knowledge/`, `Gesetze/`; `knowledge/proceedings.json` vermerkt allgemein, dass Drucksachen nicht vorliegen). Eine Zuordnung zu Drucksachen und ein Abgleich mit den Beschlussvorlagen sind deshalb **nicht möglich**. Indizien für Fassungsreste im Normtext, ohne stillschweigende Fassungswahl:

- OstSNDG § 1 Abs. 1 Nr. 4 („Bestrebungen, die gegen die freiheitliche demokratische Grundordnung …“, endet mit Komma) und Nr. 5 („… gegen die solidarische Grund- und Friedensordnung, gegen das Gemeinwohl …“, endet mit Semikolon) regeln denselben Gegenstand doppelt.
- OstSKG § 3 Abs. 1 („einmal in der Legislatur“), Sicherheitsgesetz § 8 Abs. 2 und 3 und § 12 Abs. 1 („auf verlangen“) lesen sich wie unvollständig überarbeitete Sätze.
- Schreibfehler: „Artkel 2“ (Nr. 90), „nachr“ (PolDigG § 7 Abs. 3), „Staatsschutzbindend“ (OstSKG § 11 Abs. 2), „Suchtund“ (VPOG § 12), „in Kraft..“ (Nr. 86 Art. 3), „Grenzssicherheit“ (bereits im KGrPolG).

---

## 2 Durchgeführte Schritte

| Schritt | Befehl / Werkzeug | Ergebnis |
| --- | --- | --- |
| Referenz: Content-Prüfung | `npm run content:check` | grün (25 s) |
| Referenz: Wissenshub | `npm run knowledge:check` | grün |
| Referenz: Dokumentation | `npm run docs:check` | grün |
| Referenz: Konsolidierung | `node scripts/audit-consolidation.mjs --check` | grün; 75 Änderungsakte, 109 Ziele, 107 vollständig, 2 vorbestehend gesperrt |
| Referenz: Reststellen | `npm run norms:ost:residual-audit -- --quiet` | grün |
| Referenz: OstRecht-Build | `npm run build:recht` | grün (27 s) |
| Referenz: D1-Seed Vollbestand | `serve-law-worker.mjs --seed-only` | Seed mit 5227 Normen und 154 Verkündungen gebaut und gesichert (`.cache/referenz/`). Die Abschlussverifikation scheiterte, weil der Paketimport während des Laufs **parallel in dieselbe Arbeitskopie** schrieb (5227 ≠ 5249); das ist ein Fehler meines Ablaufs, kein Werkzeugfehler. Der Seed selbst entspricht dem Referenzbestand. |
| Import, Erstprüfung | `import-normen.mjs` auf die Sammeldatei | **Fehlerbild**: als **eine** Ausgabe „Nr. 85“ mit 15 Gesetzen erkannt (B-T1) |
| Aufteilung | `testlauf/werkzeuge/split.py` | 15 Einzelquellen, verlustfrei |
| Importkonfiguration | 15 Einträge in `NEW_PUBLICATION_CONFIG` (`scripts/import-normen.mjs`, nur Arbeitskopie) | mit Testkennzeichnung |
| Strenger Vorablauf | `import-normen.mjs --strict` | nur erwartete `would-create`, **keine** Parser- oder Vertragsbefunde |
| Schreiblauf | `import-normen.mjs --write --update-existing` | 22 Normen und 15 Verkündungen angelegt |
| Patch-Rezepte | 9 Rezepte unter `data/recht/amendments/` (PVDG 4, PolFHG 2, Hochschulgrade-VO 1, OstVSG 1, OstAG G 10 1) | siehe 3.2 |
| Konsolidierung | `consolidate-norms.mjs --target … --write` | PVDG: Fassungen 14.11.2026 und 1.12.2026; PolFHG: 1.12.2026 und 1.1.2027; VO: 1.12.2026; OstVSG und OstAG G 10: Ende 31.12.2026 |
| Reihenfolgeprobe | `testlauf/werkzeuge/perm.mjs` | alle 6 Reihenfolgen der drei PVDG-Änderungen vom 1.12.2026 ergeben denselben Körper (`517538fe…`) |
| Paket: Konsolidierungsaudit | `audit-consolidation.mjs` / `--check` | grün; 86 Akte, 121 Ziele, 116 vollständig, 5 offen (3 neu, Fehlzuordnungen, B-T8) |
| Paket: strenger Import | `import-normen.mjs --strict --quiet` | grün; nach Titelkennzeichnung der Verkündungen 15 × `would-update-publication` (gewollt) |
| Paket: Content, Wissenshub, Reststellen, Dokumentation | `npm run content:check`, `knowledge:check`, `audit-ost-residuals.mjs`, `docs:check` | alle grün |
| Paket: D1-Seed Vollbestand | `serve-law-worker.mjs --seed-only --persist-to .cache/wrangler-paket2` | 5249 Normen, 169 Verkündungen, verifiziert |
| Paket: Sichtprüfung OstRecht | lokaler Worker `127.0.0.1:4399`, Abruf von Norm-, Fassungs-, Beziehungs- und Verkündungsseiten | siehe 3.3 |
| Rückverweissuche | `testlauf/werkzeuge/scan.py` (Fassung gültig am 1.1.2027, Gesamtbestand) | siehe B-05 bis B-08, B-30 |

Nicht ausgeführt: `npm run check`, `test:fast`, Browser- und Screenshot-Suiten (kein Code geändert; Darstellung per Seitenabruf geprüft), `knowledge:build` (keine Wissenshub-Einträge angelegt), Stichtagsfortschreibung (siehe 3.3, T-10), REVOSax-Abruf (kein Netzzugriff auf Produktivquellen gewollt, siehe T-6).

---

## 3 Befunde

### 3.1 Normtext und Änderungsbefehle

Format je Befund: **Blatt / Vorschrift** · maßgebliche Ausgangsfassung · Befund (exakter Wortlaut) · Auswirkung · Einordnung · Korrektur.

**B-01 · Nr. 86 Art. 2 Nr. 2 i. V. m. Art. 1 § 2 Abs. 2 VPOG und Nr. 85 Art. 1 Nr. 1 · PVDG in der ab 14.11.2026 geltenden Fassung**
„§ 97 Absatz 1 bis 2 wird wie folgt gefasst: ‚(1) Aufbau, Gliederung und Zuständigkeiten der Polizeidienststellen bestimmen sich nach dem Volkspolizeiorganisationsgesetz. …‘“ – VPOG § 2 Abs. 2: „Polizeidienststellen sind 1. das Landeskriminalamt, 2. das Polizeiverwaltungsamt, 3. das Präsidium der Bereitschaftspolizei, 4. die Bezirkspolizeidirektionen mit ihren Polizeirevieren und Polizeiposten.“ – PVDG § 1 Satz 3 n. F.: „Der Polizeivollzugsdienst des Freistaates Ostdeutschland führt die amtliche Bezeichnung ‚Volkspolizei des Freistaates Ostdeutschland‘ (Volkspolizei).“
Die Grenzpolizei ist bisher Polizeidienststelle (§ 97 Abs. 1 Nr. 5 PVDG i. d. F. von OGVBl. 2026 Nr. 50, Art. 2 Nr. 2; zur Kollision mit Nr. 46 siehe B-04). Ab 1.12.2026 fällt sie aus der abschließenden Liste. Zugleich macht § 1 Satz 3 sie als Teil des Polizeivollzugsdienstes zur „Volkspolizei“, während sechs Blätter (Nr. 88, 89, 90, 91, 97, 98) sie ausdrücklich **neben** der Volkspolizei nennen. Auswirkung: Abschnitt 4. Die Ersetzung von „Absatz 1 bis 2“ ist ausführbar, die Formulierung ist unüblich („Die Absätze 1 und 2 werden wie folgt gefasst“). [VK] → K-01.

**B-02 · Nr. 85 Art. 1 Nr. 2 · PVDG § 46 Abs. 1 (Fassung 14.11.2026)**
Ersetzt „des Landespolizeipräsidenten oder seines Vertreters im Amt“ durch „des/der Volkspolizeipräsident:in oder deren Vertretung im Amt“. Der Zieltext steht genau einmal in § 46 Abs. 1; der Befehl ist ausführbar. Ein Amt „Volkspolizeipräsident:in“ wird in keinem Blatt geschaffen; das Landespolizeipräsidium (bisher § 97 Abs. 1 Nr. 1) fehlt in VPOG § 2 Abs. 2. Die Ersetzung ist grammatisch fehlerhaft (Genitiv, „deren“). Auswirkung: Besondere Waffen (§ 46 Abs. 3: Maschinengewehre, Handgranaten) können ab 1.12.2026 von niemandem wirksam freigegeben werden, für Volkspolizei und Grenzpolizei gleichermaßen. [VK] → K-02.

**B-03 · Nr. 85 Art. 2 · Ostdeutsches Polizeifachhochschulgesetz (Fassung 1.11.2023, keine ostdeutsche Änderung)**
Nr. 1: „Die Bezeichnung wird wie folgt gefasst: ‚Gesetz über die Hochschule der Volkspolizei (Ostdeutsches Polizeifachhochschulgesetz – OstPolFHG)‘.“ – ausführbar, der Zusatz „(FH)“ entfällt nur im Gesetzestitel, nicht im Hochschulnamen.
Nr. 2: „Es werden je die Wörter ‚Hochschule der Ostdeutschen Polizei (FH)‘ durch die Wörter ‚Hochschule der Volkspolizei (FH)‘ ersetzt.“ – **Ortsangabe fehlt**. Im Normkörper steht die Wortfolge genau einmal (§ 1: „… Hochschule der Ostdeutschen Polizei (FH), nachstehend Fachhochschule genannt“); im Test als ein Treffer in § 1 ausgeführt und so in `commandCoverage` dokumentiert. Ergebnis eindeutig, Befehl rechtsförmlich mangelhaft. [VK] redaktionell → K-19.

**B-04 · [VB] Kollision OGVBl. 2026 Nr. 46 Art. 11 und Nr. 50 Art. 2 in § 97 Abs. 1 PVDG (vorbestehend)**
Nr. 50 (in Kraft 21.7.2026) fügt nach Nr. 4 eine Nr. 5 „die Kasernierte Grenzpolizei und“ ein und macht die bisherige Nr. 5 zu Nr. 6. Nr. 46 (in Kraft 1.8.2026, Eingangsformel nennt als letzte Änderung Nr. 26, also ohne Kenntnis von Nr. 50) bestimmt: „Absatz 1 Nummer 5 wird wie folgt gefasst: ‚5. die Polizeidirektionen als Bezirkspolizeidirektionen,‘“. Wörtlich ausgeführt ersetzt Nr. 46 den Grenzpolizei-Eintrag; daneben bleibt Nr. 6 „die Polizeidirektionen.“ bestehen. Gemeint war erkennbar die Polizeidirektion. Die Rechtslage am 13.11.2026 ist insoweit **mehrdeutig**. Der Wissenshub bildet keines von beiden ab (B-T2). Das Paket beseitigt die Kollision nur, indem es Abs. 1 vollständig ersetzt, und lässt die Grenzpolizei dabei endgültig fallen.

**B-05 · Fehlende Folgeänderung: Verweise auf § 97 Abs. 1 Nr. 5 PVDG**
- Gesetz zur Ausführung des Pass- und Personalausweisgesetzes im Freistaat Ostdeutschland § 2: „… sind die Polizeidirektionen nach § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes … in der jeweils geltenden Fassung.“
- Landesjugendhilfegesetz § 5 Abs. 1 Buchst. f: „ein Vertreter der Polizei, der von der zuständigen Polizeidirektion gemäß § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes … bestimmt wird,“

Ab 1.12.2026 hat § 97 Abs. 1 keine Nummern mehr: Die Verweise **gehen ins Leere**. Folge: Die behördliche Zuständigkeit nach dem Pass- und Personalausweisrecht ist nur noch durch Auslegung bestimmbar. (Zwischen 21.7. und 31.7.2026 wies derselbe Verweis nach Nr. 50 sogar auf die Grenzpolizei, siehe B-04.) [VK] → K-05.

**B-06 · Fehlende Folgeänderung: Landespolizeipräsidium und Landespolizeipräsident**
VPOG § 2 Abs. 2 führt das Landespolizeipräsidium nicht mehr. Geltende Nennungen: Ostdeutsches Informationssicherheitsgesetz § 7 Abs. 1, § 9 („dem Landespolizeipräsidium“), § 10 Abs. 1 („des Landespolizeipräsidiums“); PolFHG § 16 Abs. 2 Nr. 2 (Mitglied des Fachhochschulbeirats: „die Landespolizeipräsidentin oder der Landespolizeipräsident“); Ostdeutsches Besoldungsgesetz Anlage 2 (Amt „Landespolizeipräsident“); dazu neun Verwaltungsvorschriften und Richtlinien (u. a. VwV Dienstordnung, VwV Innenrevision SMI, VwV verdachtsunabhängige Kontrollen, Alarmierungsrichtlinie Katastrophenschutz). Folge: Informationssicherheitsbeauftragte und Beiratssitz ohne Bezugsstelle, Besoldungsamt ohne Funktion; PolDigG § 12 Abs. 2 bestellt daneben eine eigene Informationssicherheitsbeauftragte der Volkspolizei (Doppelstruktur). [VK] → K-06.

**B-07 · Fehlende Folgeänderung: Aufhebung von § 100 PVDG**
Die Ostdeutsche Polizeiorganisationsverordnung beruht „auf Grund des § 100 des Ostdeutschen Polizeivollzugsdienstgesetzes“. Sie bleibt nach Wegfall der Ermächtigung wirksam, kann aber nicht mehr auf dieser Grundlage geändert werden. Inhaltlich weicht sie vom VPOG ab: Dienstbezirke nach alten Polizeidirektionen (§ 1), Wasserschutz beim Präsidium der Bereitschaftspolizei (§ 5 Abs. 3), Eilzuständigkeit „jede andere Polizeidienststelle“ (§ 7 Abs. 1). Eine Übergangsregel bis zur Verordnung nach VPOG § 16 fehlt. [VK] → K-23.

**B-08 · Nr. 86 Art. 2 · Restbestand § 97 Abs. 3 und 4, § 99 Abs. 2 und 3, § 101 PVDG**
- § 97 Abs. 3 (Polizeidirektion Berlin) und der rechtlich geltende Abs. 4 (Nr. 46: „Für jeden Bezirk … wird eine Bezirkspolizeidirektion eingerichtet. Ihr örtlicher Dienstbezirk entspricht dem Gebiet des Bezirks.“) bleiben neben VPOG § 7 Abs. 2 („sollen sich … decken“) und § 16 Abs. 1 Nr. 1 („Zahl … der Bezirkspolizeidirektionen“ durch Verordnung) stehen. Muss- und Soll-Regel und Verordnungsermächtigung über die Zahl widersprechen sich.
- § 99 Abs. 2 und 3 (vorübergehende Unterstellung; Eilbefugnis des LKA) entfallen ersatzlos; VPOG § 3 Abs. 1 nennt nur die „landesweite Einsatzsteuerung“.
- § 101 bleibt unverändert neben VPOG § 3: doppelte Aufsichtsregelung (Abs. 1), konkurrierende Verordnungsermächtigung (Abs. 3, „Staatsministerium des Innern“) und Anknüpfung an „Polizeidienststellen“ (Abs. 2 und 4), die die Grenzpolizei ab 1.12.2026 nicht mehr erfasst.
[VK] → K-03, K-04, K-22.

**B-09 · Nr. 86 Art. 2 Nr. 1 und Nr. 96 Art. 1 Nr. 1 · Inhaltsübersicht** – Ausführbar im amtlichen Text. Der Wissenshub führt für das PVDG keine Inhaltsübersicht; technisch nicht abbildbar. [TÜ]

**B-10 · Eingangsformeln** – Nr. 85, 86 und 88 nennen als letzte Änderung des PVDG Nr. 46; zum Wirksamkeitszeitpunkt 1.12.2026 ist es Nr. 96 (Art. 1, wirksam 14.11.2026). Nr. 87 nennt als letzte Änderung des PolFHG 2023; wirksam ist bis dahin Nr. 85 Art. 2. Nr. 85 Art. 1 lässt die Artikelangabe weg („zuletzt geändert durch Gesetz vom 20. Juli 2026“). Rein redaktionell; Ausführbarkeit nicht berührt. [VK] redaktionell.

**B-11 · Nr. 88 Art. 1 · PolBeschStG**
- § 1 Abs. 2 Nr. 1: „der Volkspolizei nach § 3 des Volkspolizeiorganisationsgesetzes“ – VPOG § 3 regelt die oberste Polizeibehörde, die Polizeidienststellen stehen in § 2 Abs. 2. Wörtlich wären nur Bedienstete der obersten Polizeibehörde erfasst. **Verweisfehler.**
- § 1 Abs. 2 Nr. 2: Zitat des KGrPolG ohne Artikel- und Seitenangabe („vom 20. Juli 2026 (OGVBl. 2026 Nr. 50)“; richtig: Artikel 1 des Gesetzes vom 20. Juli 2026, OGVBl. 2026 Nr. 50 S. 2).
- § 10 Abs. 2 Satz 2: „Die Beschwerdestelle kann der Volkskammer unterrichten.“ (Kasus).
- § 17 Abs. 1: Nr. 6 und 7 stehen im Fließtext von Nr. 5 („… Umsetzung, 6. die Einsatzstatistik … und 7. die Fälle des § 10 Absatz 2.“).
- Art. 3 Überleitung: schlüssig; Art. 3 Abs. 4 erstreckt § 9 Abs. 1 und § 18 ab 1.12.2026 auch auf die Grenzpolizei.
[VK] → K-12.

**B-12 · Nr. 86 Art. 1 · VPOG (redaktionell)** – § 9 Abs. 2: „Die Kontaktbereichsbeamt:innen und sind ständige Ansprechpersonen …“ (Wort fehlt); § 10 Abs. 1 Nr. 4: „durch eine Bedienstete:n“; § 12: „Gewalt-, Suchtund Kriminalprävention“; § 16 Abs. 1: Schlusswendung „zu regeln“ und Satz 2 stehen in Nr. 5; § 17 Abs. 2 ist neben Art. 3 (Inkrafttreten 1.12.2026) gegenstandslos; § 4 Abs. 2 zählt die Zentralstellen beim LKA abschließend auf, OstLVSG § 2 fügt eine weitere hinzu. [VK] redaktionell → K-20.

**B-13 · Nr. 87 · PolFHG §§ 22a–22d** – Einfügung nach § 22 ausführbar (§§ 22a ff. bestehen nicht). Art. 2 ist ein Anpassungsauftrag ohne Normänderung. Art. 3 Abs. 2 nimmt Führungsfunktionen aus, die „vor dem 1. Januar 2028“ übertragen wurden, obwohl § 22c seit 1.1.2027 gilt: Für 2027 gilt § 22c faktisch nicht. Ob das gewollt ist, sollte geklärt werden. „Inhaberinnen und Inhaber“ (Art. 3 Abs. 2) weicht von der sonst verwendeten Schreibweise ab. [VK] Klärung.

**B-14 · Nr. 89 · PolDigG** – Verweise auf PVDG §§ 57, 57a, 81, 82–90, 86, 91, 93, VPOG § 5, PolBeschStG und ISichG sind gültig. § 7 Abs. 3: „Übermittlungen richten sich nachr §§ 82 bis 90“; § 4 Abs. 2: Leerzeichen vor dem Punkt. Grenzpolizei siehe G-6. [VK] redaktionell.

**B-15 · Nr. 90 · Inkrafttretensartikel** – Überschrift „Artkel 2 Inkrafttreten“. Im amtlichen Text ein Schreibfehler; der Parser erkennt keinen Artikel und hängt Überschrift und Inkrafttretenssatz an § 13 an (B-T3). [VK] redaktionell, [TÜ].

**B-16 · Nr. 90 · Sicherheitsgesetz § 8**
- Abs. 1: „bei Gefahr im Verzug kann die Leitung der Geschäftsstelle ihn vorläufig aktivieren“ – eine Geschäftsstelle des Landeskrisenstabs wird nicht errichtet; gemeint sein kann die Geschäftsstelle des GLAZ Ost beim LKA (§ 5 Abs. 3). **Mehrdeutig.**
- Abs. 2: „Dem Landeskrisenstab gehören Vertreter:innen und der betroffenen Geschäftsbereiche …“ (überzähliges „und“).
- Abs. 3: „sind der Präsident:in oder der Volkskammer unverzüglich mitzuteilen“ – Adressat unklar (Präsident:in der Volkskammer oder Volkskammer selbst).
[VK] → K-14.

**B-17 · Nr. 90 · Sicherheitsgesetz § 3 Abs. 2** – Mitglieder sind „die für Frieden, Justiz, Verkehr, Gesundheit, Infrastruktur und Katastrophenschutz zuständigen Mitglieder des Staatsrates“. Nach dem Organisationserlass 09/2026 gibt es vier Geschäftsbereiche (Überfluss, Frieden, Liebe, Wahrheit); Justiz und Gesundheit liegen bei „Liebe“, Verkehr und Infrastruktur bei „Überfluss“, Katastrophenschutz bei „Frieden“. Die Aufzählung nennt damit drei Personen mehrfach; ob das „für die zentrale Koordinierung zuständige Mitglied“ besteht, ist offen (Büro des Staatspräsidenten ohne Geschäftsbereich). [VK] Klärung.

**B-18 · Nr. 90 · Sicherheitsgesetz sonstiges** – § 2 Abs. 1 ohne Schlusspunkt; § 12 Abs. 1 „auf verlangen“ (Groß-/Kleinschreibung; zudem unklar, ob jährlich oder nur auf Verlangen berichtet wird, vgl. § 4 Abs. 2: jährliche Schwerpunkte); § 2 Abs. 2 Satz 2 doppelt LfStErrG § 6 Abs. 2 Satz 2. Das Gesetz trägt keine Abkürzung; andere Blätter nennen es „Ost-Sicherheitsgesetz“ (B-28). [VK] redaktionell.

**B-19 · Nr. 91 · LfStErrG (redaktionell und Struktur)** – Kein Artikelgesetz, Typ technisch zu setzen (B-T5). § 5 Abs. 4: Die Sätze „Weisungen in laufenden strafrechtlichen Ermittlungsverfahren sind unzulässig. Die Kasernierte Grenzpolizei ist von Absatz 2 ausgenommen.“ stehen als unbezifferter eigener Absatz; ebenso § 7 Abs. 2 Satz 2 und Abs. 3 Satz 2. Zitierbarkeit unklar (Abs. 4 Satz 2 und 3 oder Abs. 5). [VK] redaktionell.

**B-20 · Nr. 91 § 14 im Verhältnis zu Nr. 92, 93, 99 · Zeitfenster 1.12.–31.12.2026** [VK]
- § 12 Abs. 1: „Das nach dem Ostdeutschen Verfassungsschutzgesetz bestehende Landesamt für Verfassungsschutz geht mit Inkrafttreten dieses Gesetzes im Landesamt für Staatsschutz auf.“ → 1.12.2026.
- § 2 Abs. 2, § 3 Abs. 2 und 3 verweisen auf das OstSNDG und die Staatsschutzkommission (ab 1.1.2027); § 7 Abs. 2 verlangt die Anhörung des Kontrollgremiums nach dem OstSKG (ab 1.1.2027).
- Das OstVSG gilt bis 31.12.2026, adressiert aber das aufgegangene Landesamt für Verfassungsschutz; die Bezeichnungsanpassung (Nr. 99 Art. 3) wirkt erst ab 1.1.2027.
- Folge: Im Dezember 2026 fehlen dem Landesamt für Staatsschutz Befugnisgrundlage und Kontrollorgane; § 4 (Durchsuchung, Beschlagnahme) und § 5 (Weisungen) gelten aber schon. 24 geltende Normen außerhalb des Pakets nennen das Landesamt für Verfassungsschutz (u. a. Sicherheitsüberprüfungsgesetz § 3 Abs. 5, Landesbeamtengesetz § 141, Personalvertretungsgesetz § 91, Besoldungsgesetz § 48, Meldeverordnung § 19); ob § 12 Abs. 1 Satz 2 („tritt in alle Rechte und Pflichten ein“) Befugnisse überträgt, bleibt offen.
→ K-07.

**B-21 · Nr. 91 § 6 Abs. 1 im Verhältnis zu Nr. 90 § 5 Abs. 3 und Nr. 98 § 1 Abs. 2** – „Das Landesamt für Staatsschutz darf Polizeidienststellen angegliedert werden. Bedienstete … dürfen zugleich einer Polizeidienststelle angehören.“ Dem stehen die räumlich und organisatorisch getrennte Einheit im GLAZ Ost und das „informationelle Trennungsprinzip“ entgegen. **Widerspruch** innerhalb des Pakets (ohne verfassungsrechtliche Bewertung). Außerdem kann das Landesamt nach § 5 Abs. 2 der Volkspolizei fachliche Weisungen erteilen, während VPOG § 3 Abs. 1 die Fachaufsicht der obersten Polizeibehörde zuweist; eine Vorrangregel fehlt (Grenzpolizei ausdrücklich ausgenommen). [VK] Klärung.

**B-22 · Nr. 92 · OstSNDG § 1 Abs. 1 Nr. 4 und 5** – siehe 1.4. Doppelregelung desselben Schutzguts in zwei Fassungen. [VK] [VL?] → K-08.

**B-23 · Nr. 92 · OstSNDG § 2 Abs. 1 Nr. 1** – „… die auf eines der in § 2 Absatz 1 Nummer 4 bis 7 genannten Ziele gerichtet sind“ – **Selbstverweis**; § 2 Abs. 1 hat nur drei Nummern. Gemeint: § 1 Abs. 1 Nr. 4 bis 7. Der Satz „Verhaltensweisen von Einzelpersonen …“ steht zwischen Nr. 1 und Nr. 2 ohne eigene Gliederung. [VK] → K-08.

**B-24 · Nr. 92 · OstSNDG § 13 Abs. 2** – Löschfristen für „Bestrebungen nach § 1 Absatz 1 Nummer 4 bis 6“ und „Tätigkeiten nach § 1 Absatz 1 Nummer 2 und 3“. Nr. 7 (Völkerverständigung) und Nr. 1 (terroristische Bestrebungen, nur dem Wort nach im zweiten Halbsatz) fehlen in der Zählung; Folge der eingeschobenen Nr. 5. Daten zu Nr. 7 unterliegen nur der Prüffrist nach Abs. 1. [VK] → K-08.

**B-25 · Nr. 92 · OstSNDG § 18** – „Die Übermittlung unterbleibt, wenn 1. …, 2. überwiegende Sicherheitsinteressen entgegenstehen und 3. besondere gesetzliche Übermittlungsregelungen entgegenstehen.“ Kumulativ formuliert: Die Verbote greifen nur, wenn alle drei Voraussetzungen zugleich vorliegen. Weitere Befunde: Der Begriff „Staatsschutz“ wird als Behördenbezeichnung verwendet, aber nicht definiert; § 1 Abs. 3 definiert nur „Landesamt für Staatsschutz“. Pronomen „Es“ (§ 3 Abs. 1, § 16 Abs. 1, § 19 Abs. 1). § 5 Abs. 4: „Präsident:in des Staatsschutzes“ statt Präsident:in des Landesamtes für Staatsschutz. § 17 Abs. 2 ist sprachlich nicht ausführbar („… so kann der Staatsschutz an andere inländische Stellen zu denselben Bedingungen Übermitteln, wie die inländische Stelle an den Staatsschutz übermitteln kann; in besonderen Fällen unterlässt …“). Gegenüber § 2 Abs. 1 OstVSG entfallen die Beobachtung fortwirkender DDR-Strukturen (dort Nr. 4) und die Mitwirkung bei Einbürgerungen (dort Abs. 2 Nr. 5); ob gewollt, ist zu klären. [VK] → K-08, K-21.

**B-26 · Nr. 93 · OstSKG § 3 Abs. 1** – „Das Kontrollgremium tritt in der Regel einmal in der Legislatur zusammen.“ Unterrichtungspflichten (§ 4 OstSKG, § 13 Sicherheitsgesetz, § 8 Abs. 2 OstSZG jährlich, § 12 Abs. 3 OstSKG halbjährlich) und der jährliche Bericht (§ 8) setzen häufigere Sitzungen voraus. Außerdem: Das bestehende Ostdeutsche Kontrollgesetz kennt bereits ein „Parlamentarisches Kontrollgremium (PKG)“ für Maßnahmen nach §§ 59–69 PVDG; zwei gleichnamige Gremien (Abgeordnetengesetz § 6 nennt nach Nr. 99 Art. 3 beide). § 11 Abs. 2 „Staatsschutzbindend“. [VK] [VL?] → K-13.

**B-27 · Nr. 94 · OstKRITISG § 13 Abs. 1 Nr. 1** – „entgegen § 4 Absatz 1 eine kritische Infrastruktur nicht oder nicht rechtzeitig registriert“ – § 4 hat keine Absätze. Der Bußgeldtatbestand verweist auf eine nicht bestehende Vorschrift. [VK] → K-10.

**B-28 · Nr. 94 · OstKRITISG §§ 8, 9 Abs. 2 Nr. 2, 11 Abs. 1, 14** – nennen das „Ost-Sicherheitsgesetz“; Nr. 90 führt die Bezeichnung „Ostdeutsches Sicherheitsgesetz“ ohne Kurzform. § 9 Abs. 2 Nr. 2: „Landeslagebildes nach § 8 des Ost-Sicherheitsgesetzes“ – das Landeslagebild steht in § 7, § 8 regelt den Landeskrisenstab. Art. 3 nennt das „Gesetz zum Schutz kritischer Infrastruktur“ (Singular). [VK] → K-10.

**B-29 · Nr. 94 · Art. 4 Satz 2** – „Artikel 1 § 3 Absatz 2 tritt am Tag nach der Verkündung in Kraft.“ Ausführbar; im Wissenshub nicht als eigener Geltungsbeginn darstellbar (B-T4). Zum Sicherheitserlass KRITIS 09/2026 siehe 1.2.

**B-30 · Nr. 99 Art. 3 · Verweisungsanpassung ohne Paragraphenkonkordanz** [VK]
„(1) Soweit in Gesetzen, Rechtsverordnungen und Verwaltungsvorschriften … 2. auf das Ostdeutsche Verfassungsschutzgesetz verwiesen wird, tritt an seine Stelle das Staatsschutz- und Nachrichtendienstgesetz …“ 14 geltende Normen verweisen auf **bestimmte** Vorschriften des OstVSG:
- „§ 2 Absatz 1 Satz 1 Nummer 1 bis 3a“ OstVSG: Strafvollzugsgesetz § 83 Abs. 3, Jugendstrafvollzugsgesetz § 71 Abs. 3, Untersuchungshaftvollzugsgesetz § 49 Abs. 3, Sicherungsverwahrungsvollzugsgesetz § 88 Abs. 3, Abschiebungshaftvollzugsgesetz § 25 Abs. 2, Sicherheitsüberprüfungsgesetz § 22 Nr. 3;
- „§ 2 Abs. 1 Nr. 1, 4 und 5“ OstVSG: VwV zur Ausführung des Ostdeutschen Sicherheitsüberprüfungsgesetzes, Abschnitt B. IV. (Nr. 5 gibt es schon im OstVSG nicht; vorbestehend);
- „§ 3 Absatz 1“ OstVSG (Begriff der Bestrebungen): FRL Bürgerbeteiligung, FRL Orte des Gemeinwesens, FRL Weltoffenes Ostdeutschland, FRL Aussteigerprogramm (II. 2. a);
- „§ 2“ OstVSG (Aufgaben): Besoldungsgesetz § 48 und VwV OstBesG (Nr. 48, 49.2, 56.2.3);
- „§ 2 Absatz 1 Nummer 2“ OstVSG: Informationssicherheitsgesetz § 13 Nr. 3.

Wörtlich übertragen träfen diese Verweise im OstSNDG § 2 (Begriffsbestimmungen) und § 3 (Grenzen der Tätigkeit), also **falsche Vorschriften**. Die Nummernfolgen entsprechen sich nicht: OstVSG § 2 Abs. 1 Nr. 1, 2, 3, 3a entspricht OstSNDG § 1 Abs. 1 Nr. 4 (oder 5), 2, 6, 7. Nr. 99 Art. 3 Abs. 2 („Die Redaktion … ändert bei Neufassungen oder Änderungen … von Amtswegen …“) ersetzt keine Folgeänderung. → K-09.

**B-31 · Nr. 99 Art. 1 und 2 · Aufhebungen** – OstVSG ohne „zuletzt geändert durch“-Angabe, sonst ausführbar; im Test als Fassungsende 31.12.2026 konsolidiert. Art. 4 Abs. 4 wiederholt § 14 Satz 2 OstSKG wortgleich im Ergebnis (keine Kollision).

**B-32 · Nr. 96 · PVDG §§ 15a, 20a, 46a** – Einfügungen ausführbar. § 20a steht neben § 20 (Meldeauflage) und § 21 Abs. 2 Nr. 2 (Aufenthaltsgebot bei terroristischer Gefahr): andere Eilzuständigkeit (§ 20a Abs. 2: „Leitung der Polizeidienststelle“; § 21 Abs. 4: Präsident:in des LKA oder einer Polizeidirektion) und anderer Richtervorbehalt. Abgrenzung durch „§ 20 bleibt unberührt“ nur teilweise. § 46a Abs. 1 verweist auf „kritische Infrastruktur im Sinne des § 15a Absatz 1“; § 15a Abs. 1 verwendet den Begriff nicht (er beschreibt Anlagen) und weicht vom OstKRITISG § 2 Nr. 1 ab. Grenzpolizei: G-3. [VK] Klärung.

**B-33 · Nr. 98 · OstSZG** – „Beteiligte Behörden“ (§ 1 Abs. 2, §§ 2, 4–7) werden nicht bestimmt. § 3 Satz 2: „Für Daten aus besonderen Maßnahmen gilt § 2 Absatz 1.“ – § 2 Abs. 1 regelt die Übermittlungspflicht an den Staatsschutz, keine Schutzregel; gemeint ist erkennbar § 1 Abs. 1 oder § 2 Abs. 3. Art. 3 ohne Überschrift. Grenzpolizei: G-6. [VK] → K-11.

**B-34 · Nr. 95 · OstLVSG** – § 2 Satz 3 ohne Schlusspunkt. § 1 Abs. 3 (Fortgeltung bestehender Zuständigkeitsverordnungen) schlüssig. Grenzpolizei: G-5. [VK] redaktionell.

**B-35 · Nr. 97 · VTPG und DemFG** – Verweise schlüssig (Landesamt für Staatsschutz besteht ab 1.12.2026; das VTPG gilt ab 1.1.2027). DemFG § 3 Abs. 2 Satz 2 steht als unbezifferter Absatz. Keine weiteren Auffälligkeiten.

### 3.2 Konsolidierung, Fassungen vor und nach den Inkrafttretenszeitpunkten

| Zeitpunkt | PVDG | PolFHG | Hochschulgrade-VO | OstVSG / OstAG G 10 | neue Gesetze |
| --- | --- | --- | --- | --- | --- |
| bis 13.11.2026 | Fassung 1.8.2026 (Referenz) | Fassung 1.11.2023 | Fassung 1.11.2023 | gelten | – |
| 14.11.2026 | + §§ 15a, 20a, 46a | unverändert | unverändert | gelten | OstKRITISG § 3 Abs. 2 (im Test nicht abgebildet, B-T4) |
| 30.11. → 1.12.2026 | § 1 Satz 3 (Volkspolizei), § 46 Abs. 1, § 97 Abs. 1–2 n. F., § 98 n. F., §§ 99, 100 weggefallen | Titel und Hochschulname „Volkspolizei“ | Titel und § 1 Abs. 1 | gelten | VPOG, PolBeschStG, LfStErrG |
| 31.12.2026 → 1.1.2027 | unverändert | + §§ 22a–22d | unverändert | aufgehoben | PolDigG, Sicherheitsgesetz, OstSNDG, OstSKG, OstKRITISG, OstLVSG, VTPG, DemFG, OstSZG |

- **Gleichzeitige Änderungen:** Am 1.12.2026 ändern Nr. 85, 86 und 88 das PVDG in getrennten Vorschriften (§ 1 und § 46 / § 97, § 99, § 100 / § 98). Mit `sameDayOrder` 1 bis 3 nach Blattnummer ausgeführt; alle sechs Reihenfolgen liefern einen identischen Normkörper. Varianten mit unterschiedlichem Ergebnis bestehen nicht.
- **Bezüge auf Vorschriften anderer Blätter:** gültig und zeitgerecht (Nr. 88 → VPOG §§ 2, 13; Nr. 89 → VPOG § 5, PolBeschStG; Nr. 90 → LfStErrG, OstSZG, OstKRITISG, OstSKG; Nr. 92/93 untereinander; Nr. 97 → Landesamt für Staatsschutz). **Fehlerhaft:** Nr. 85 → „Volkspolizeipräsident:in“ (B-02); Nr. 88 → VPOG § 3 (B-11); Nr. 94 → „Ost-Sicherheitsgesetz“, § 8 (B-28); Nr. 91 → OstSNDG und OstSKG vor deren Inkrafttreten (B-20).
- **Wiedereingeführte alte Fassungen, überschriebener Normtext:** im Paket keine; vorbestehend die Kollision Nr. 46 / Nr. 50 (B-04). Doppelregelungen: OstSNDG § 1 Abs. 1 Nr. 4/5; PVDG § 97 Abs. 4 / VPOG § 7 Abs. 2; PVDG § 101 / VPOG § 3; PVDG § 20 / § 20a; Informationssicherheitsbeauftragte (B-06).

### 3.3 Technische Übernahme in Wissenshub und Rechtsportal

- **T-1 Sammeldatei [TÜ]:** Der Importer liest `OGVBl.2026Nr.85100.html` als **eine** Ausgabe „Nr. 85“ mit 15 Normen. Geschrieben, hätten 14 Gesetze eine falsche Fundstelle erhalten. Für die Übernahme ist eine Datei je Ausgabe nötig (Namensschema `OGVBl. 2026 Nr. NN.html`). Kein Prüflauf warnt vor dieser Fehlzuordnung.
- **T-2 Vorbestehende Konsolidierungslücken im PVDG [VB][TÜ]:** Rezept zu Nr. 50 setzt nur Art. 2 Nr. 4 um (§ 101 Abs. 1); Nr. 1 bis 3 (§ 97 Abs. 1 Nr. 5 Grenzpolizei, § 100a) fehlen ohne `commandCoverage`. Rezept zu Nr. 46 Art. 11 setzt nur Nr. 1 Buchst. a um; § 97 Abs. 4 und § 100 Abs. 2 fehlen. Der Wissenshub zeigt daher heute einen anderen Rechtsstand als verkündet, und der Konsolidierungsaudit meldet das Ziel trotzdem als `complete`. Nach dem Paket bleibt das Fehlen von § 100a und § 97 Abs. 4 bestehen.
- **T-3 Parser: eingeführte Gesetze nicht erkannt [TÜ]:** Nr. 88 (PolBeschStG), Nr. 90 (Sicherheitsgesetz), Nr. 92 (OstSNDG), Nr. 95 (OstLVSG) werden nicht als eigene Normen angelegt. Ursachen: Artikelüberschrift ohne Titel bzw. zweizeiliger Titel (Nr. 88), Adjektiv vor dem Gesetzesnamen in der Artikelüberschrift („Einführung eines Ostdeutschen Sicherheitsgesetzes“, „eines Staatsschutz- und Nachrichtendienstgesetzes“). Bei Nr. 88 und 92 hängen die Artikel 2 ff. strukturell unter dem letzten „Abschnitt“ des eingeführten Gesetzes. Folge im Portal: Diese vier Gesetze sind nur als Text innerhalb der Mantelnorm erreichbar; die Verweise darauf (z. B. PVDG § 98 n. F. auf das Polizeibeschwerdestellengesetz) werden nicht verlinkt. Bei Nr. 90 erscheinen „Artkel 2 Inkrafttreten“ und der Inkrafttretenssatz als Text von § 13. Bei Nr. 85 Art. 2 liegt Nummer 2 innerhalb des Zitats von Nummer 1. Der Parservertrag und der strenge Audit melden **keinen** dieser Befunde.
- **T-4 Teilinkrafttreten [TÜ]:** Der Parser setzt bei Nr. 94 den 14.11.2026 (Art. 4 Satz 2) als Inkrafttreten des ganzen Gesetzes. Im Test mit `effectiveOverride: 2027-01-01` und `dateNote` korrigiert; ein eigener Geltungsbeginn für § 3 Abs. 2 ist im Datenmodell nicht darstellbar.
- **T-5 Normtyp [TÜ]:** Nr. 85 wird als `gesetz` statt Änderungsgesetz, Nr. 91 (Stammgesetz) als `aenderungsvorschrift` erkannt; im Test per Konfiguration gesetzt.
- **T-6 REVOSax-Ausgangsfassungen [TÜ]:** Für PolFHG, Hochschulgrade-VO, OstVSG und OstAG G 10 liegt kein REVOSax-Snapshot vor; es ist ihre erste ostdeutsche Änderung bzw. Aufhebung. Im Test wurde ersatzweise die gespeicherte Fassung vom 1.11.2023 als `existingVersionSeed` verwendet (in `consolidation-sources.json` als Testabweichung vermerkt). Produktiv ist der REVOSax-Abruf zum 1.11.2023 nötig (`npm run norms:revosax:fetch`).
- **T-7 Umbenennungen [TÜ]:** Die neuen Gesetzesbezeichnungen (PolFHG, VO) erscheinen in den Fassungen ab 1.12.2026, nicht aber in `meta.json`; nach `docs/NORM_WORKFLOW.md` ist dort redaktionell umzubenennen.
- **T-8 Konsolidierungsaudit [TÜ]:** Das Audit erkennt Nr. 85 und 87 fälschlich als Änderungen des Ostdeutschen Hochschulgesetzes (Teilwort „…hochschulgesetz“) und Nr. 87 Art. 2 als Änderung der APO Polizei (zweimal, davon einmal unter dem neuen Schlüssel `ausbildungs-und-prufungsordnung` mit `missing-baseline`). Zudem meldet es die Artikelüberschrift von Nr. 85 Art. 3 als mehrdeutigen Kandidaten. Offene Ziele steigen von 2 auf 5, `--check` bleibt grün. Produktiv wären `editorialSourceResolutions` für diese Ziele nötig.
- **T-9 Inhaltsübersicht [TÜ]:** siehe B-09.
- **T-10 Stichtag [TÜ]:** Der Stichtag 14.10.2026 liegt vor dem Verkündungsdatum. Das Portal zeigt alle Paketfassungen als „künftige Fassung … verkündet, tritt am … in Kraft“. Eine produktive Übernahme verlangt die geschlossene Stichtagskette (Playbook Kap. 6) mit Organisations-Snapshot, Themen-Hervorhebung und Fixture-Datum.
- **T-11 Kennzeichnung [TÜ]:** Ein Feld für „vorbereitete Fassung“ gibt es nicht; die `note` einer Verkündungsquelle wird nicht angezeigt. Im Test daher über den Titel gekennzeichnet; der strenge Audit meldet das erwartungsgemäß als `would-update-publication`.
- **T-12 Prüfketten [TÜ]:** `content:check`, `knowledge:check`, `docs:check`, Konsolidierungs- und Reststellenaudit und der strenge Import bleiben mit dem Paket grün. Keiner der inhaltlichen Befunde und keiner der Parserbefunde T-1/T-3 wird maschinell erkannt.
- **T-13 Portalbefund:** Neue Fassungen, Historie, Beziehungen und „(weggefallen)“ für §§ 99, 100 werden korrekt dargestellt; das VPOG ist aus PVDG § 97 verlinkt. § 99 und § 100 behalten die alte Überschrift neben „(weggefallen)“. Verkündungsseiten melden „kein Original-PDF hinterlegt“.

---

## 4 Schwerpunkt Kasernierte Grenzpolizei

### 4.1 Wie das geltende Recht die Grenzpolizei erfasst (Stand 13.11.2026)

| Weg | Fundstelle |
| --- | --- |
| Verfassungsrahmen (Wortlaut, ohne Bewertung) | Verf. Art. 12b Abs. 2 Satz 2: „… kann der Freistaat besondere kasernierte Einheiten der **Landespolizei** vorhalten.“ |
| Errichtung, Bezeichnung | KGrPolG § 1 Abs. 1 („Kasernierte Grenzpolizei“), Abs. 2 (keine Streitkraft); Kurzformen „KGrPol“ (SÜFV-O § 1 Nr. 1), „Grenzpolizei“ (Verwaltungsabkommen § 1 Abs. 1, Organisationserlass 09/2026 III Nr. 5) |
| Ressortzuordnung | KGrPolG § 1 Abs. 1 („Staatsministerium für Staats- und Grenzssicherheit“) → Organisationserlass 09/2026 Abschnitt IX → Staatssekretariat des Innern und für Staats- und Grenzsicherheit, Geschäftsbereich Frieden (Abschnitt III Nr. 5: „die Volkspolizei und die Grenzpolizei“) |
| Sammelbegriff „Polizei“ | PVDG § 1 Satz 2 („Polizei … ist der Polizeivollzugsdienst“), KGrPolG § 4 Abs. 1, § 2 Abs. 1 („vollzugspolizeiliche Aufgaben“) |
| Sammelbegriff „Polizeidienststelle“ | PVDG § 97 Abs. 1 Nr. 5 i. d. F. Nr. 50 (Kollision mit Nr. 46 ab 1.8.2026, B-04); KGrPolG setzt den Status voraus („anderer“/„übrige Polizeidienststellen“: § 2 Abs. 1 Nr. 5 und Abs. 3, § 9 Abs. 2, § 12 Abs. 1, § 13 Nr. 5) |
| Verweisung Organisation | PVDG § 100a (Nr. 50 Art. 2 Nr. 3, im Wissenshub nicht abgebildet) |
| Aufsicht | PVDG § 101 Abs. 1 (ausdrücklich), Abs. 2 und 4 (über „Polizeidienststellen“) |
| Bund | Verwaltungsabkommen (GMBl. 2026 Nr. 14) § 1 Abs. 1 Nr. 1–4 (Land- und Seegrenze, Grenzübergangsstellen einschließlich Luftverkehr, Grenzgebiet), § 3 Abs. 1 („nach dem für die Polizei des Ostdeutschen Freistaates geltenden Recht“), § 3 Abs. 2–4 (fachliche Weisungen des BMI), § 4 (Zusammenarbeit), § 6 (Luft- und Wasserdienst); KGrPolG § 3 |
| Sonstiges | SÜFV-O § 1 Nr. 1 (Lage- und Analysezentrum als lebenswichtige Einrichtung); KGrPolG § 12 Abs. 1 („Verfassungsschutzbehörden“) |

### 4.2 Vorher-Nachher je Regelungszusammenhang

Spalte „Status“: **weiter** = weiterhin erfasst · **neu** = neu einbezogen · **teilw.** = teilweise herausfallend · **voll** = vollständig herausfallend · **unklar** = Zuordnung unklar · **nicht** = nicht einbezogen, obwohl das Regelungsziel es nahelegt.

| G | Zusammenhang | bisher (13.11.2026) | künftig (14.11.2026 / ab 1.12.2026 / ab 1.1.2027) | Status | Folge für den Vollzug | Korrektur |
| --- | --- | --- | --- | --- | --- | --- |
| G-1 | Behördenstellung im Polizeivollzugsdienst | Polizeidienststelle nach PVDG § 97 Abs. 1 Nr. 5 (Nr. 50), § 100a; eigene Leitung KGrPolG § 5 | ab 1.12.: PVDG § 1 Satz 3 rechnet den gesamten Polizeivollzugsdienst zur „Volkspolizei“; § 97 Abs. 1 n. F. → VPOG § 2 Abs. 2 ohne Grenzpolizei; § 100a bleibt (nicht aufgehoben); Paketgesetze nennen die Grenzpolizei **neben** der Volkspolizei | **unklar** | Jede Norm, die an „Volkspolizei“ oder „Polizeidienststelle“ anknüpft, ist für die Grenzpolizei auslegungsbedürftig | K-01 |
| G-2 | Aufgaben, räumliche Zuständigkeit | KGrPolG §§ 2, 3, 9 Abs. 2; VA § 1; PVDG § 103 (Polizeidienststellen landesweit zuständig); PolOrgVO § 6 (Polizeidirektionen nur, „soweit nicht eine andere Polizeidienststelle zuständig ist“), § 7 Abs. 1 (Eilzuständigkeit) | Aufgaben unverändert. Ab 1.12.: PVDG § 103 erfasst die Grenzpolizei nicht mehr; VPOG § 7 Abs. 1 macht die Auffangzuständigkeit der Bezirkspolizeidirektionen gesetzlich, sie weicht nur einer „anderen Polizeidienststelle“ i. S. d. VPOG, also nicht der Grenzpolizei | **teilw.** (örtliche Zuständigkeit) / **unklar** (Konkurrenz) | Ohne § 103 hat die Grenzpolizei keine ausdrückliche landesweite Zuständigkeit, etwa für Unterstützungseinsätze nach KGrPolG § 2 Abs. 1 Nr. 5 und 7, Abs. 3. In Grenzräumen konkurrieren Bezirkspolizeidirektion und Grenzpolizei ohne Vorrangregel. Die Nachrangigkeit des Küsten- und Wasserschutzdienstes (§ 9 Abs. 2 KGrPolG gegenüber PolOrgVO § 5 Abs. 3) besteht schon heute [VB] | K-01, K-04 |
| G-3 | Befugnisse | KGrPolG § 4 Abs. 1 (PVDG-Befugnisse, dynamisch), Abs. 2 (Bundesrecht im Einzeldienst); VA § 3 Abs. 1. Eilanordnungen nach PVDG § 21 Abs. 4 Satz 3 und § 73 Abs. 2 nur durch die Präsident:innen des LKA oder einer Polizeidirektion **[VB: Grenzpolizei schon heute nicht erfasst]** | 14.11.: §§ 15a, 20a, 46a gelten über § 4 Abs. 1 auch für die Grenzpolizei (**weiter**); Anordnungen durch die „Leitung der Polizeidienststelle“ (§ 15a Abs. 3, § 20a Abs. 2, § 46a Abs. 2) sind bis 30.11. für die Grenzpolizeileitung tragfähig (vorbehaltlich B-04). Ab 1.12.: nicht mehr; Gericht nach § 20a Abs. 2 und § 73 Abs. 1 Nr. 1 („in dessen Bezirk die Polizeidienststelle ihren Sitz hat“) unbestimmt. § 46 Abs. 1: Freigabe durch nicht bestehendes Amt. § 46a Abs. 3: Im „Zuständigkeitsbereich der Bundespolizei“ nur auf deren Ersuchen, obwohl die Grenzpolizei dort nach VA § 1 Abs. 1 Nr. 3 selbst tätig ist | Befugnisse **weiter**, Anordnungs- und Freigabebefugnisse **teilw.** | Schutzbereiche um grenznahe Infrastruktur (Kernaufgabe nach KGrPolG § 2 Abs. 1 Nr. 3), Terror-Meldeauflagen und Drohnenabwehr (Luftdienst, Drohnendetektion nach KGrPolG §§ 8, 10) können von der Grenzpolizei ab 1.12. nicht rechtssicher angeordnet werden; besondere Waffen überhaupt nicht | K-01, K-02, K-15 |
| G-4 | Leitung und Aufsicht | KGrPolG § 5 Abs. 1; PVDG § 99 Abs. 1 (oberste Dienstbehörde und Führungsstelle der Polizei), § 99 Abs. 2/3, § 101 Abs. 1 (ausdrücklich), Abs. 2 (LKA-Fachaufsicht über kriminalpolizeiliche Tätigkeit), Abs. 4 (Weisungsfolgepflicht); VA § 3 Abs. 2–4 | ab 1.12.: § 99 aufgehoben, Ersatz VPOG §§ 2, 3 nur für Polizeidienststellen der Volkspolizei; § 101 Abs. 1 bleibt (**weiter**); § 101 Abs. 2 und 4 knüpfen an „Polizeidienststellen“ an (**teilw.**). Neu: LfStErrG § 5 Abs. 4 letzter Satz nimmt die Grenzpolizei von Weisungen des Landesamts für Staatsschutz aus; Sicherheitsgesetz § 9 Abs. 2 (ab 1.1.2027) erfasst sie als Behörde des Freistaates | **weiter** / **teilw.** | Dienst- und Fachaufsicht bleibt, aber ohne ausdrückliche Folgepflicht nach § 101 Abs. 4 und ohne kriminalpolizeiliche Fachaufsicht des LKA. Doppelte Aufsichtsregeln (PVDG § 101 / VPOG § 3) | K-01, K-03 |
| G-5 | Zusammenarbeit mit anderen Polizeibehörden und dem Bund | KGrPolG § 2 Abs. 3, § 12; PVDG § 102, §§ 104, 105; PolOrgVO § 7 Abs. 2; VA § 4 | **neu**: VPOG § 6 Satz 2 (Unterstützung nach KGrPolG); Sicherheitsgesetz § 1 Nr. 1, § 5 Abs. 2 (ständig im GLAZ Ost), § 8 Abs. 2 (Landeskrisenstab). **nicht**: VPOG § 4 Abs. 3 (LKA-Zentralstellen koordinieren nur Bezirkspolizeidirektionen, trotz Überschneidung mit KGrPolG § 2 Abs. 2, etwa Schleusung, Menschenhandel, Betäubungsmittel, Geldwäsche); OstLVSG § 2 (Zentralstelle Drohnenabwehr „unterstützt die Polizeidienststellen“, arbeitet mit der Bundespolizei, nicht mit der Grenzpolizei) und § 3 (Flughafenvereinbarungen ohne die Grenzpolizei, obwohl sie dort nach VA § 1 Abs. 1 Nr. 3 Grenzkontrollen wahrnimmt); OstKRITISG § 7 Abs. 2 (bei Sabotageverdacht wird nur die Volkspolizei unterrichtet). **unklar**: PVDG § 102 ab 1.12. | gemischt | Doppelarbeit und Informationslücken bei grenzüberschreitender Kriminalität, Drohnenlagen an Flughäfen und Sabotage an grenznaher Infrastruktur | K-01, K-10, K-16 |
| G-6 | Datenverarbeitung und Informationsaustausch | KGrPolG § 11 Abs. 3 und 4 (PVDG); PVDG §§ 79 ff.; VA § 4 Abs. 5 | **neu**: OstSZG § 3 (Volkspolizei ↔ Grenzpolizei; Satz 2 verweist falsch, B-33); OstSZG § 2 Abs. 1 und 2 (Übermittlungspflicht als „öffentliche Stelle“); PolDigG § 6 Abs. 2, § 7 Abs. 1 (Vernetzung, Schnittstellen). **nicht**: OstSZG § 2 Abs. 3 schützt nur Daten der Volkspolizei aus §§ 63–69 PVDG, gleichartige Daten der Grenzpolizei nicht; PolDigG §§ 9–12 (Datenschutz durch Technikgestaltung, Zugriffsprotokollierung, Löschfristen, Informationssicherheit) gelten nur für die Volkspolizei. **unklar**: OstSZG §§ 4–7 („beteiligte Behörden“ undefiniert, Projektdateien und Fallkonferenzen im GLAZ Ost, in dem die Grenzpolizei ständig mitwirkt) | gemischt | Schutzlücke bei der Weitergabe eingriffsintensiv erhobener Daten an das Landesamt für Staatsschutz; Grenzpolizei-Systeme vernetzt, aber ohne gleiche Schutzanforderungen | K-11, K-18 |
| G-7 | Kontrolle, Beschwerde, Kennzeichnung | PVDG § 98 a. F. erfasst die „Polizei des Freistaates“ (damit die Grenzpolizei); Abs. 6 Nr. 1 nennt „nachgeordnete Polizeidienststellen“ | ab 1.12.: PolBeschStG § 1 Abs. 2 Nr. 2, § 9 Abs. 1, § 10 Abs. 1, § 18 Abs. 1 nennen die Grenzpolizei ausdrücklich (**weiter**, präzisiert); Art. 3 Abs. 4 Überleitung. VPOG § 13 (Namensschild, Kennzeichnung geschlossener Einheiten): Geltung für die Grenzpolizei **unklar**, Speicherung „bei der Polizeidienststelle“ | **weiter** / **unklar** | PolBeschStG § 10 Abs. 1 Nr. 4 und § 18 Abs. 1 Nr. 6 laufen für die Grenzpolizei leer; gerade deren geschlossene Einsatz- und Zugriffseinheiten (KGrPolG § 5 Abs. 2 Nr. 6) wären ohne individuelle Kennzeichnung | K-12 |
| G-8 | Ausbildung, Fortbildung, Personal | KGrPolG § 5 Abs. 2 Nr. 11; PolFHG | ab 1.1.2027: PolFHG § 22a (Laufbahnen der Fachrichtung Polizei) erfasst Nachwuchs der Grenzpolizei, soweit er in dieser Laufbahn steht (**weiter**); §§ 22b, 22c nur „Volkspolizei“ (**nicht**); VTPG § 1 Abs. 1 (**neu**); PolBeschStG § 3 Abs. 2, § 5 Abs. 3 (**neu**) | gemischt | Keine Fortbildungspflicht und keine Führungsqualifizierung für die Grenzpolizei | K-17 |
| G-9 | Staatsschutz und Sicherheitsarchitektur | KGrPolG § 12 Abs. 1 („Verfassungsschutzbehörden“) | ab 1.12.: Landesamt für Staatsschutz ist Verfassungsschutzbehörde (LfStErrG § 2 Abs. 1), Kette **weiter**; LfStErrG § 4 Abs. 4 (Vollzugshilfe nur durch die Volkspolizei, erkennbar gewollt); § 5 Abs. 4 letzter Satz (ausgenommen) | **weiter** | keine | – |
| G-10 | Verfahren und Übergang | KGrPolG § 13 (Verordnungsermächtigung: Dienstbezirke, Zusammenarbeit „mit anderen Polizeidienststellen“) | VPOG § 17, PolBeschStG Art. 3 erfassen die Grenzpolizei nicht besonders; die PolOrgVO (Grundlage § 100 entfallen) nennt sie nicht | **unklar** | Verordnung nach KGrPolG § 13 und VPOG § 16 müssen abgestimmt werden | K-23 |

**Zusammenfassung:** Ausdrücklich und weiterhin erfasst bleibt die Grenzpolizei bei Aufsicht (PVDG § 101 Abs. 1), Beschwerdestelle (PolBeschStG), Verfassungstreueprüfung (VTPG), Sicherheitsarchitektur (Sicherheitsgesetz) und bei den PVDG-Befugnissen selbst. **Stillschweigend herausgelöst** wird sie aus allen Regelungen, die an „Polizeidienststelle“ anknüpfen: örtliche Zuständigkeit (§ 103), Anordnungsbefugnisse (§§ 15a, 20a, 46a), gerichtliche Zuständigkeit (§§ 20a, 73), Weisungsfolgepflicht und LKA-Fachaufsicht (§ 101 Abs. 2 und 4), Zusammenarbeit (§ 102). Dazu fällt die Freigabeinstanz für besondere Waffen weg (§ 46). Ihre Zuordnung zur „Volkspolizei“ (§ 1 Satz 3) ist widersprüchlich. Nicht einbezogen, obwohl das erkennbare Regelungsziel es nahelegt: OstSZG § 2 Abs. 3, PolDigG §§ 9–12, OstKRITISG § 7 Abs. 2, OstLVSG §§ 2–3, VPOG § 13, PolFHG §§ 22b–22c, PVDG § 46a Abs. 3.

---

## 5 Korrekturvorschläge

Alle Vorschläge sind als Änderungsbefehle zu den **vorbereiteten Gesetzblättern** formuliert, also zu der Fassung, über die die Volkskammer beschließt. Ob dieselben Fehler schon in der Beschlussvorlage stehen, ist mangels Drucksachen offen ([VL?] in Abschnitt 0). Wo die Volkskammer zwischen Alternativen entscheiden muss, sind diese ausgewiesen.

**K-01 Stellung der Grenzpolizei (B-01; G-1 bis G-7) – [VK], Entscheidung erforderlich**

*Variante A – Grenzpolizei als eigenständige Polizeidienststelle neben der Volkspolizei* (entspricht der Sprache von Nr. 88, 89, 90, 91, 97, 98):

1. Artikel 1 Nummer 1 des Gesetzes über die Bezeichnung der Polizei des Freistaates Ostdeutschland als Volkspolizei (Nr. 85) wird wie folgt gefasst:
   „1. Dem § 1 wird folgender Satz angefügt: ‚Die Polizeidienststellen nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes führen die amtliche Bezeichnung ‚Volkspolizei des Freistaates Ostdeutschland‘ (Volkspolizei); die Bezeichnung der Kasernierten Grenzpolizei bleibt unberührt.‘“
2. Artikel 2 Nummer 2 des Gesetzes über die Organisation der Volkspolizei … (Nr. 86) wird wie folgt gefasst:
   „2. § 97 Absatz 1 und 2 wird wie folgt gefasst:
   ‚(1) Polizeidienststellen sind die Polizeidienststellen der Volkspolizei nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes und die Kasernierte Grenzpolizei. Aufbau, Gliederung und Zuständigkeiten richten sich für die Volkspolizei nach dem Volkspolizeiorganisationsgesetz und für die Kasernierte Grenzpolizei nach dem Kasernierte-Grenzpolizei-Gesetz.
   (2) Der Freistaat unterhält die Hochschule der Volkspolizei (FH) als Einrichtung für die Aus- und Fortbildung nach Maßgabe des Ostdeutschen Polizeifachhochschulgesetzes.‘“
3. In Artikel 1 § 7 Absatz 1 des Volkspolizeiorganisationsgesetzes (Nr. 86) werden nach den Wörtern „soweit nicht eine andere Polizeidienststelle“ die Wörter „oder die Kasernierte Grenzpolizei nach den §§ 2 und 3 des Kasernierte-Grenzpolizei-Gesetzes“ eingefügt.

*Variante B – Grenzpolizei als Polizeidienststelle der Volkspolizei* (entspricht dem Wortlaut von Art. 12b Abs. 2 Verf. und § 1 Satz 3 PVDG-E; textlich die kleinste Korrektur):

1. Artikel 1 § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes (Nr. 86) wird wie folgt gefasst:
   „(2) Polizeidienststellen sind
   1. das Landeskriminalamt,
   2. das Polizeiverwaltungsamt,
   3. das Präsidium der Bereitschaftspolizei,
   4. die Bezirkspolizeidirektionen mit ihren Polizeirevieren und Polizeiposten,
   5. die Kasernierte Grenzpolizei; für sie gilt das Kasernierte-Grenzpolizei-Gesetz, soweit es von diesem Gesetz Abweichendes bestimmt.“
2. In Artikel 1 § 7 Absatz 1 des Volkspolizeiorganisationsgesetzes werden nach dem Wort „zuständig ist“ die Wörter „; die Aufgaben der Kasernierten Grenzpolizei nach den §§ 2, 3 und 9 des Kasernierte-Grenzpolizei-Gesetzes gehen vor“ eingefügt.

Folge von Variante B: PolDigG, OstKRITISG § 7 Abs. 2, PolFHG §§ 22b–22c und VPOG § 13 erfassen die Grenzpolizei ohne weitere Änderung (K-11 bis K-18 entfallen teilweise). Die Nennungen „Volkspolizei und Kasernierte Grenzpolizei“ in anderen Blättern werden redundant, aber nicht widersprüchlich. LfStErrG § 5 Abs. 4 letzter Satz bleibt als ausdrückliche Ausnahme nötig.

**K-02 Freigabe besonderer Waffen (B-02) – [VK]**
1. Artikel 1 Nummer 2 des Gesetzes Nr. 85 wird wie folgt gefasst:
   „2. In § 46 Absatz 1 werden die Wörter ‚des Landespolizeipräsidenten oder seines Vertreters im Amt‘ durch die Wörter ‚der Volkspolizeipräsident:in oder ihrer Vertretung im Amt, beim Einsatz der Kasernierten Grenzpolizei der Präsident:in der Kasernierten Grenzpolizei oder ihrer Vertretung im Amt‘ ersetzt.“
2. Dem Artikel 1 § 3 des Volkspolizeiorganisationsgesetzes (Nr. 86) wird folgender Absatz 3 angefügt:
   „(3) In der obersten Polizeibehörde leitet eine Volkspolizeipräsident:in die Angelegenheiten der Volkspolizei; sie wird durch eine ständige Vertretung im Amt vertreten.“
   Bei Variante B von K-01 entfällt in Nr. 1 der Grenzpolizei-Halbsatz nur, wenn die Freigabe auch für die Grenzpolizei bei der Volkspolizeipräsident:in liegen soll. Folgeänderung im Ostdeutschen Besoldungsgesetz (Anlage 2): Amtsbezeichnung „Landespolizeipräsident“ durch „Volkspolizeipräsident:in“ ersetzen (Besoldungsgruppe unverändert).

**K-03 § 101 PVDG (B-08, G-4) – [VK]** Nach Artikel 2 Nummer 2 des Gesetzes Nr. 86 wird folgende Nummer 2a eingefügt:
„2a. § 101 wird wie folgt geändert:
a) Absatz 1 wird wie folgt gefasst: ‚(1) Die Dienst- und Fachaufsicht über die Polizeidienststellen richtet sich nach § 3 des Volkspolizeiorganisationsgesetzes; über die Kasernierte Grenzpolizei führt sie das für die Kasernierte Grenzpolizei zuständige Staatssekretariat.‘
b) Absatz 3 wird aufgehoben.“
(Die Absätze 2 und 4 erfassen die Grenzpolizei über K-01 Variante A Nr. 2 bzw. Variante B.)

**K-04 § 97 Abs. 3 und 4 PVDG, VPOG § 7 Abs. 2 (B-08) – [VK]** Artikel 1 § 7 Absatz 2 des Volkspolizeiorganisationsgesetzes wird wie folgt gefasst:
„(2) Für jeden Bezirk nach der Ostdeutschen Bezirksordnung besteht eine Bezirkspolizeidirektion; ihr Dienstbezirk entspricht dem Gebiet des Bezirks. Für das Gebiet der Bundeshauptstadt Berlin besteht die Bezirkspolizeidirektion Berlin; sie ist so zu gliedern, dass eine flächendeckende Präsenz sowie eine wirksame Führung in Großschadenslagen, bei Großveranstaltungen und in kriminalitätsbelasteten Räumen gewährleistet sind.“
In Artikel 1 § 16 Absatz 1 Nummer 1 werden die Wörter „Zahl, Sitz und Dienstbezirke“ durch die Wörter „Sitz und innere Gliederung“ ersetzt. In Artikel 2 Nummer 2 des Gesetzes Nr. 86 wird die Angabe „§ 97 Absatz 1 bis 2 wird wie folgt gefasst:“ durch „§ 97 Absatz 1 und 2 wird wie folgt gefasst; die Absätze 3 und 4 werden aufgehoben:“ ersetzt.

**K-05 Verweise auf § 97 Abs. 1 Nr. 5 PVDG (B-05) – [VK]** Dem Gesetz Nr. 86 wird nach Artikel 2 folgender Artikel 2a eingefügt:
„Artikel 2a – Folgeänderungen
(1) In § 2 des Gesetzes zur Ausführung des Pass- und Personalausweisgesetzes im Freistaat Ostdeutschland vom 29. September 2010 (SächsGVBl. S. 263), das durch Artikel 10 des Gesetzes vom 11. Mai 2019 (SächsGVBl. S. 358) geändert worden ist, werden die Wörter ‚die Polizeidirektionen nach § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung‘ durch die Wörter ‚die Bezirkspolizeidirektionen nach § 2 Absatz 2 Nummer 4 des Volkspolizeiorganisationsgesetzes‘ ersetzt.
(2) In § 5 Absatz 1 Buchstabe f des Landesjugendhilfegesetzes in der Fassung der Bekanntmachung vom 4. September 2008 (SächsGVBl. S. 578) werden die Wörter ‚von der zuständigen Polizeidirektion gemäß § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung,‘ durch die Wörter ‚von der zuständigen Bezirkspolizeidirektion nach § 2 Absatz 2 Nummer 4 des Volkspolizeiorganisationsgesetzes‘ ersetzt.“
(Die zitierten Fundstellen sind die im Bestand geführten Stammzitate; letzte Änderungen vor Verkündung abgleichen.)

**K-06 Landespolizeipräsidium (B-06) – [VK]** In Artikel 2a des Gesetzes Nr. 86 (K-05) wird angefügt:
„(3) Im Ostdeutschen Informationssicherheitsgesetz vom 2. August 2019 (SächsGVBl. S. 630) werden in § 7 Absatz 1 und § 9 jeweils die Wörter ‚dem Landespolizeipräsidium‘ durch die Wörter ‚der obersten Polizeibehörde für die Volkspolizei‘ und in § 10 Absatz 1 die Wörter ‚des Landespolizeipräsidiums‘ durch die Wörter ‚der obersten Polizeibehörde für die Volkspolizei‘ ersetzt; die Informationssicherheitsbeauftragte nach § 12 Absatz 2 des Polizeidigitalisierungsgesetzes ist zugleich Beauftragte nach diesem Gesetz.“
In Artikel 2 des Gesetzes Nr. 85 wird folgende Nummer 3 angefügt: „3. In § 16 Absatz 2 Nummer 2 werden die Wörter ‚die Landespolizeipräsidentin oder der Landespolizeipräsident‘ durch die Wörter ‚die Volkspolizeipräsident:in‘ ersetzt.“

**K-07 Inkrafttreten des LfStErrG (B-20) – [VK]** § 14 des Staatsschutzamt-Errichtungsgesetzes (Nr. 91) wird wie folgt gefasst: „§ 14 Inkrafttreten – Dieses Gesetz tritt am 1. Januar 2027 in Kraft.“ (Alternative: Nr. 92, 93 und Nr. 99 Art. 3 auf den 1.12.2026 vorziehen; dann müsste die Aufhebung des OstVSG ebenfalls vorgezogen werden.)

**K-08 OstSNDG §§ 1, 2, 13, 18 (B-22 bis B-25) – [VK], Entscheidung zu Nr. 4/5**
1. In Artikel 1 § 1 Absatz 1 wird *entweder* Nummer 4 *oder* Nummer 5 gestrichen; die folgenden Nummern rücken auf.
2. In Artikel 1 § 2 Absatz 1 Nummer 1 wird die Angabe „§ 2 Absatz 1 Nummer 4 bis 7“ durch „§ 1 Absatz 1 Nummer 4 bis 6“ ersetzt (bei Streichung einer der Nummern 4 oder 5).
3. Artikel 1 § 13 Absatz 2 wird wie folgt gefasst: „(2) Daten über Bestrebungen nach § 1 Absatz 1 Nummer 4 bis 6 sind spätestens zehn Jahre nach der letzten gespeicherten relevanten Information zu löschen, Daten über terroristische Bestrebungen nach § 1 Absatz 1 Nummer 1 und über Tätigkeiten nach § 1 Absatz 1 Nummer 2 und 3 spätestens nach 15 Jahren, es sei denn, die Leitung des Landesamtes stellt im Einzelfall fest, dass die weitere Speicherung erforderlich ist.“
4. In Artikel 1 § 18 Nummer 2 wird das Wort „und“ durch das Wort „oder“ ersetzt.
(Werden Nummer 4 und 5 beibehalten: in Nr. 2 „§ 1 Absatz 1 Nummer 4 bis 7“, in Nr. 3 „Nummer 4 bis 7“.)

**K-09 Verweise auf das OstVSG (B-30) – [VK]** Artikel 3 Absatz 1 des Gesetzes Nr. 99 wird folgender Satz angefügt:
„Wird auf eine bestimmte Vorschrift des Ostdeutschen Verfassungsschutzgesetzes verwiesen, treten an die Stelle von dessen § 2 Absatz 1 Satz 1 Nummer 1 § 1 Absatz 1 Nummer 4, von Nummer 2 § 1 Absatz 1 Nummer 2, von Nummer 3 § 1 Absatz 1 Nummer 6, von Nummer 3a § 1 Absatz 1 Nummer 7, von § 2 im Übrigen § 1 und von § 3 Absatz 1 § 2 Absatz 1 Nummer 1 des Staatsschutz- und Nachrichtendienstgesetzes.“
(Nummern nach K-08 anpassen. Sauberer, aber umfangreicher: Folgeänderungen in den 14 Normen aus B-30.)

**K-10 OstKRITISG (B-27, B-28, G-5) – [VK]** In Artikel 1 (Nr. 94)
1. werden in § 8 Satz 1 und § 9 Absatz 2 Nummer 2 jeweils das Wort „Ost-Sicherheitsgesetzes“ durch die Wörter „Ostdeutschen Sicherheitsgesetzes“ und in § 11 Absatz 1 Satz 2 und § 14 jeweils das Wort „Ost-Sicherheitsgesetz“ durch die Wörter „Ostdeutschen Sicherheitsgesetz“ ersetzt;
2. wird in § 9 Absatz 2 Nummer 2 die Angabe „§ 8“ durch die Angabe „§ 7“ ersetzt;
3. wird in § 13 Absatz 1 Nummer 1 die Angabe „§ 4 Absatz 1“ durch die Angabe „§ 4“ ersetzt;
4. wird § 7 Absatz 2 wie folgt gefasst: „(2) Besteht der Verdacht eines Angriffs oder einer Sabotage, sind zugleich die Volkspolizei und, wenn die kritische Infrastruktur im Aufgabenbereich der Kasernierten Grenzpolizei nach § 2 Absatz 1 Nummer 3 des Kasernierte-Grenzpolizei-Gesetzes liegt, die Kasernierte Grenzpolizei zu unterrichten.“
In Artikel 3 werden die Wörter „des Gesetzes zum Schutz kritischer Infrastruktur“ durch die Wörter „des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland“ ersetzt.

**K-11 OstSZG (B-33, G-6) – [VK]** In Artikel 1 (Nr. 98)
1. wird dem § 1 folgender Absatz 4 angefügt: „(4) Beteiligte Behörden im Sinne dieses Gesetzes sind die Sicherheitsbehörden nach § 1 Nummer 1 des Ostdeutschen Sicherheitsgesetzes.“
2. werden in § 2 Absatz 3 nach dem Wort „Volkspolizei“ die Wörter „oder die Kasernierte Grenzpolizei“ eingefügt;
3. wird § 3 Satz 2 wie folgt gefasst: „Für Daten aus Maßnahmen nach den §§ 63 bis 69 des Ostdeutschen Polizeivollzugsdienstgesetzes gilt § 1 Absatz 1 und 3.“

**K-12 PolBeschStG und Kennzeichnung (B-11, G-7) – [VK]**
1. In Artikel 1 § 1 Absatz 2 Nummer 1 des Gesetzes Nr. 88 wird die Angabe „§ 3“ durch die Angabe „§ 2 Absatz 2“ ersetzt; in Nummer 2 werden die Wörter „Gesetz über die Kasernierte Grenzpolizei des Ostdeutschen Freistaates vom 20. Juli 2026 (OGVBl. 2026 Nr. 50)“ durch die Wörter „Kasernierte-Grenzpolizei-Gesetz (Artikel 1 des Gesetzes vom 20. Juli 2026, OGVBl. 2026 Nr. 50 S. 2)“ ersetzt.
2. In Artikel 1 § 10 Absatz 2 Satz 2 wird das Wort „der“ vor „Volkskammer“ durch „die“ ersetzt.
3. (nur Variante A von K-01) Dem Artikel 1 § 13 des Volkspolizeiorganisationsgesetzes (Nr. 86) wird folgender Absatz 4 angefügt: „(4) Die Absätze 1 bis 3 gelten für die Polizeivollzugsbeamt:innen der Kasernierten Grenzpolizei entsprechend; an die Stelle der Polizeidienststelle tritt die Kasernierte Grenzpolizei.“

**K-13 OstSKG § 3 Abs. 1 (B-26) – [VK], Entscheidung** Artikel 1 § 3 Absatz 1 Satz 1 des Gesetzes Nr. 93 wird wie folgt gefasst: „Das Kontrollgremium tritt mindestens einmal im Vierteljahr zusammen.“ In § 11 Absatz 2 Satz 2 wird „Staatsschutzbindend“ durch „Staatsschutz bindend“ ersetzt. Zur Unterscheidung vom Gremium nach dem Ostdeutschen Kontrollgesetz wird in § 1 die Klammer „(Kontrollgremium)“ durch „(Staatsschutz-Kontrollgremium)“ ersetzt; entsprechend in Nr. 99 Art. 3 Abs. 1 Nr. 3.

**K-14 Sicherheitsgesetz (B-15 bis B-18) – [VK]** Im Gesetz Nr. 90
1. wird die Angabe „Artkel 2“ durch „Artikel 2“ ersetzt;
2. werden in Artikel 1 § 8 Absatz 1 Satz 2 die Wörter „die Leitung der Geschäftsstelle“ durch die Wörter „die Leitung der Geschäftsstelle des Gemeinsamen Lage- und Abwehrzentrums Ost“ ersetzt (sofern das gemeint ist);
3. werden in § 8 Absatz 2 Satz 1 die Wörter „Vertreter:innen und der“ durch „Vertreter:innen der“ und in § 8 Absatz 3 die Wörter „der Präsident:in oder der Volkskammer“ durch „der Präsident:in der Volkskammer“ ersetzt;
4. wird § 3 Absatz 2 Satz 1 wie folgt gefasst: „Ihm gehören die für die Geschäftsbereiche Frieden, Liebe und Überfluss zuständigen Mitglieder des Staatsrates an.“;
5. wird in § 12 Absatz 1 das Wort „auf verlangen“ durch „jährlich“ (oder „auf Verlangen“) ersetzt und § 2 Absatz 1 ein Schlusspunkt angefügt.

**K-15 § 46a Abs. 3 PVDG (G-3) – [VK]** In Artikel 1 Nummer 4 des Gesetzes Nr. 96 wird § 46a Absatz 3 folgender Satz angefügt: „Satz 1 gilt nicht, soweit die Kasernierte Grenzpolizei Aufgaben nach § 3 des Kasernierte-Grenzpolizei-Gesetzes wahrnimmt.“

**K-16 OstLVSG (G-5) – [VK]** In Artikel 1 des Gesetzes Nr. 95
1. werden in § 2 Satz 2 die Wörter „unterstützt die Polizeidienststellen und arbeitet mit der Bundespolizei“ durch die Wörter „unterstützt die Polizeidienststellen und die Kasernierte Grenzpolizei und arbeitet mit der Bundespolizei“ ersetzt und Satz 3 ein Schlusspunkt angefügt;
2. werden in § 3 Absatz 1 nach den Wörtern „den zuständigen Behörden des Bundes“ die Wörter „und, soweit sie dort Aufgaben nach § 3 des Kasernierte-Grenzpolizei-Gesetzes wahrnimmt, der Kasernierten Grenzpolizei“ eingefügt.

**K-17 PolFHG §§ 22b, 22c (G-8) – [VK], Entscheidung** In Artikel 1 des Gesetzes Nr. 87 werden in § 22b Absatz 1 Satz 1 nach dem Wort „Volkspolizei“ die Wörter „und der Kasernierten Grenzpolizei“ und in § 22c Satz 1 nach dem Wort „Volkspolizei“ die Wörter „oder der Kasernierten Grenzpolizei“ eingefügt. (Entfällt bei Variante B von K-01.)

**K-18 PolDigG §§ 9–12 (G-6) – [VK], Entscheidung** Dem Artikel 1 § 2 des Gesetzes Nr. 89 wird folgender Absatz 4 angefügt: „(4) Die §§ 9 bis 12 gelten für die informationstechnischen Systeme der Kasernierten Grenzpolizei entsprechend; an die Stelle des Polizeiverwaltungsamtes tritt die Kasernierte Grenzpolizei.“ (Entfällt bei Variante B von K-01.)

**K-19 Nr. 85 Art. 2 Nr. 2 (B-03) – [VK] redaktionell** Artikel 2 Nummer 2 des Gesetzes Nr. 85 wird wie folgt gefasst: „2. In § 1 werden die Wörter ‚Hochschule der Ostdeutschen Polizei (FH)‘ durch die Wörter ‚Hochschule der Volkspolizei (FH)‘ ersetzt.“

**K-20 VPOG redaktionell (B-12) – [VK]** In Artikel 1 des Gesetzes Nr. 86 werden in § 9 Absatz 2 Satz 1 die Wörter „Die Kontaktbereichsbeamt:innen und sind“ durch „Die Kontaktbereichsbeamt:innen und ihre Vertretungen sind“, in § 10 Absatz 1 Nummer 4 die Wörter „durch eine Bedienstete:n“ durch „durch eine:n Bedienstete:n“ und in § 12 Satz 2 das Wort „Suchtund“ durch „Sucht- und“ ersetzt; § 17 Absatz 2 wird aufgehoben; in Artikel 3 wird „in Kraft..“ durch „in Kraft.“ ersetzt.

**K-21 OstSNDG Begriffe (B-25) – [VK]** Artikel 1 § 1 Absatz 3 des Gesetzes Nr. 92 wird wie folgt gefasst: „(3) Staatsschutz im Sinne dieses Gesetzes ist das Landesamt für Staatsschutz nach § 1 des Staatsschutzamt-Errichtungsgesetzes.“ § 17 Absatz 2 ist neu zu formulieren (Regelungsabsicht nicht eindeutig erkennbar; Klärung durch die Volkskammer).

**K-22 Ersatzlose Aufhebung § 99 Abs. 2 und 3 PVDG (B-08) – [VK], Klärung** Falls die Befugnis erhalten bleiben soll, wird Artikel 1 § 3 des Volkspolizeiorganisationsgesetzes folgender Absatz angefügt: „Die oberste Polizeibehörde kann sich oder einer anderen Polizeidienststelle nachgeordnete Polizeidienststellen vorübergehend unmittelbar unterstellen, wenn die Erfüllung der polizeilichen Aufgaben dies erfordert; bei Gefahr im Verzug kann dies das Landeskriminalamt, das die oberste Polizeibehörde unverzüglich unterrichtet.“

**K-23 Polizeiorganisationsverordnung (B-07, G-10) – [VK]** Dem Artikel 1 § 17 des Volkspolizeiorganisationsgesetzes wird folgender Absatz angefügt: „Die Ostdeutsche Polizeiorganisationsverordnung vom 17. März 2020 (SächsGVBl. S. 97) gilt bis zum Inkrafttreten einer Rechtsverordnung nach § 16 Absatz 1 fort, soweit sie diesem Gesetz nicht widerspricht.“

**Nur technische Übernahme (keine Normtextänderung):** T-1 bis T-13, insbesondere: Aufteilung der Sammeldatei, PDFs beschaffen und gegen das HTML prüfen, Parser für Artikelüberschriften „Einführung eines <Adjektiv> …gesetzes“ und Artikel ohne Überschriftentitel ertüchtigen, Typ- und Datumskonfiguration (Nr. 85, 91, 94), REVOSax-Snapshots für PolFHG, Hochschulgrade-VO, OstVSG und OstAG G 10 sichern, Rezepte zu Nr. 46 und Nr. 50 vervollständigen (§ 97 Abs. 1 Nr. 5 bzw. Kollisionsentscheidung, § 97 Abs. 4, § 100 Abs. 2, § 100a), `editorialSourceResolutions` für die Fehlzuordnungen des Audits, Umbenennung in `meta.json`, Stichtagskette.

---

## 6 Übersicht über alle geprüften Gesetzblätter

| Nr. | Import | Konsolidierung / Portal | Befunde Normtext | Grenzpolizei berührt | Auffälligkeiten |
| --- | --- | --- | --- | --- | --- |
| 85 | Mantel; Typ manuell | PVDG, PolFHG, VO konsolidiert; im Portal korrekt | B-02, B-03, B-10 | ja (§ 1 Satz 3, § 46) | ja |
| 86 | Mantel + VPOG | PVDG § 97, §§ 99, 100; VPOG im Portal verlinkt | B-01, B-04 (vorbestehend), B-05 bis B-09, B-12 | ja (Kern) | ja |
| 87 | Mantel | PolFHG §§ 22a–22d; Audit-Fehlzuordnung | B-13 | ja (§§ 22b, 22c) | ja |
| 88 | Mantel, **PolBeschStG nicht als Norm** | PVDG § 98; Struktur fehlerhaft | B-11 | ja (ausdrücklich erfasst) | ja |
| 89 | Mantel + PolDigG | Portal korrekt | B-14 | ja (§§ 6, 7; §§ 9–12 nicht) | ja |
| 90 | Mantel, **Sicherheitsgesetz nicht als Norm**, „Artkel“ in § 13 | – | B-15 bis B-18 | ja (ausdrücklich erfasst) | ja |
| 91 | Stammgesetz; Typ manuell | – | B-19 bis B-21 | ja (§ 5 Abs. 4 ausgenommen) | ja |
| 92 | Mantel, **OstSNDG nicht als Norm**, Artikel unter Abschnitt | – | B-22 bis B-25 | nein | ja |
| 93 | Mantel + OstSKG | – | B-26 | nein | ja |
| 94 | Mantel + OstKRITISG; Datum manuell | Teilinkrafttreten nicht abbildbar | B-27 bis B-29 | ja (§ 7 Abs. 2) | ja |
| 95 | Mantel, **OstLVSG nicht als Norm** | – | B-34 | ja (§§ 2, 3) | ja |
| 96 | Mantel | PVDG §§ 15a, 20a, 46a konsolidiert | B-32 | ja (§ 46a Abs. 3; Anordnungen) | ja |
| 97 | Mantel + VTPG + DemFG | – | B-35 (geringfügig) | ja (VTPG ausdrücklich) | geringfügig |
| 98 | Mantel + OstSZG | – | B-33 | ja (§§ 2, 3) | ja |
| 99 | Mantel | OstVSG, OstAG G 10 mit Ablauf 31.12.2026 | B-30, B-31 | nein | ja |

---

## 7 Ausgeführte Prüfungen, offene Fragen, Unverändertheit

### 7.1 Prüfergebnisse

- Referenzbestand: alle Prüfungen grün (Abschnitt 2).
- Paketbestand: `content:check`, `knowledge:check`, `docs:check`, Reststellenaudit, Konsolidierungsaudit `--check` grün; strenger Import grün bis auf die gewollte Titelkennzeichnung (15 × `would-update-publication`); D1-Seed Vollbestand verifiziert (5249 Normen, 169 Verkündungen); lokaler Worker liefert alle Norm-, Fassungs- und Verkündungsseiten mit HTTP 200.
- Inhaltliche Prüfung: 35 Normtextbefunde (B-01 bis B-35), 13 technische Befunde (T-1 bis T-13), 10 Grenzpolizei-Zusammenhänge (G-1 bis G-10), 23 Korrekturvorschläge (K-01 bis K-23).
- Protokolle, geparste Strukturen und Hilfswerkzeuge: `testlauf/logs/`, `testlauf/geparst/`, `testlauf/werkzeuge/`, Rückverweisdaten `testlauf/scan-2027.json`.

### 7.2 Offene Quellen- und Fassungsfragen

1. Drucksachen und Beschlussvorlagen zu Nr. 85 bis 99 fehlen; Abweichungen zwischen Vorlage und Gesetzblatt sind nicht prüfbar.
2. Amtliche PDFs fehlen; Gliederung, Nummerierung und Seitenzahlen sind nicht gegengeprüft. Die Sammeldatei nennt in jedem Inhaltsverzeichnis „Seite 2“.
3. Welche Fassung von OstSNDG § 1 Abs. 1 Nr. 4/5 gilt (B-22).
4. Rechtslage von § 97 Abs. 1 PVDG zwischen 1.8. und 30.11.2026 (Kollision Nr. 46 / Nr. 50, B-04).
5. Ob die Grenzpolizei Teil der Volkspolizei sein soll (K-01 Variante A oder B).
6. REVOSax-Ausgangsfassungen für PolFHG, Hochschulgrade-VO, OstVSG und OstAG G 10 (T-6).
7. Bereits im amtlichen Text des KGrPolG fehlen § 1 Abs. 3 bis 5 (OGVBl. 2026 Nr. 50 springt von Abs. 2 auf Abs. 6); außerhalb des Pakets, für die Grenzpolizei-Kette aber relevant.

### 7.3 Kontrolle: ursprünglicher Checkout und produktiver Rechtsbestand unverändert

Vergleich des ursprünglichen Checkouts `staatsregierung` vor Beginn (09:22 Uhr) und nach Abschluss aller Testprozesse (Worker beendet, keine Hintergrundprozesse mehr):

| Merkmal | vorher | nachher |
| --- | --- | --- |
| HEAD | `e611963b9…` | identisch |
| `git status --porcelain` (SHA-256) | `e3b0c442…` (leer) | identisch |
| alle Refs (`git for-each-ref`, SHA-256) | `47665a3c…` | identisch |
| Index-Inhalt (`git ls-files -s`, SHA-256) | `364bcaba…` | identisch |
| Worktree-Liste | 2 Einträge | identisch |
| `temp-neu/OGVBl.2026Nr.85100.html` (SHA-256) | `97480bf5…` | identisch |
| Dateien außerhalb `.git` mit Änderungszeit nach Start | – | **keine** |

In `.git` des Originals tragen `FETCH_HEAD`, Reflog-Dateien und Ref-Verzeichnisse den Zeitstempel 13.11.2026 09:30:50. Das entspricht einem `git fetch`, den dieser Testlauf nicht ausgeführt hat: Im Original liefen nur lesende Befehle, der Klon hat kein Remote. Die Repository-Konfiguration enthält Einträge einer Editor-Integration (`vscode-merge-base`, `github-pr-*`), was auf deren automatischen Abruf hindeutet. Kein Ref-Wert hat sich geändert. Die Index-Datei wurde zuletzt um 09:20:37 geschrieben, also vor dem Startmarker; das ist vermutlich das Auffrischen des Stat-Caches durch das erste `git status` dieses Laufs, ohne inhaltliche Änderung.

Produktiver Rechtsbestand: Es war kein Cloudflare-Zugang gesetzt, es lief kein Remote-, Deploy-, D1-Sync- oder R2-Befehl, es gab keinen Push, keinen PR, keine Veröffentlichung und keinen REVOSax-Abruf. Alle D1-Projektionen sind lokale SQLite-Dateien unter `.cache/` der Arbeitskopie.

Die Arbeitskopie bleibt zur Nachprüfung bestehen; Änderungen dort: `scripts/import-normen.mjs` (Testkonfiguration), `data/recht/` (Rezepte, Ziele, Manifest, Bericht), `content/normen/` (22 neue Normen, 5 geänderte), `content/verkuendungen/` (15 neue), `Gesetze/` (15 aufgeteilte Quellen), `temp-neu/` (Kopie), `testlauf/` (dieser Bericht, Protokolle, Werkzeuge).

---

## 8 Nachprüfung der neuen Fassung (v2)

### 8.1 Ergebnis in Kürze

Geprüft ist die neue Fassung der Sammeldatei `temp-neu/OGVBl.2026Nr.85100.html` (355 927 Byte, SHA-256 `5e77b3b27fe4daecc78ac1ebbe3e211081bbabed60054d163b5e12362810c60c`; erste Fassung 343 154 Byte, `97480bf5…`). Sie enthält weiter alle 15 Ausgaben Nr. 85 bis 99; Titel und Verkündungsdatum (13. November 2026) sind unverändert. Geändert ist der Aufbau von vier Blättern:

- Nr. 86 hat einen neuen Artikel 3 „Folgeänderungen“ (Pass-Ausführungsgesetz, Landesjugendhilfegesetz, Informationssicherheitsgesetz); das Inkrafttreten steht jetzt in Artikel 4.
- Nr. 91 ist jetzt ein Artikelgesetz: Artikel 1 führt das Staatsschutzamt-Errichtungsgesetz ein, Artikel 2 setzt das Inkrafttreten auf den 1. Januar 2027 statt den 1. Dezember 2026.
- Nr. 96 hat einen neuen Artikel 3 „Übergangsbestimmung“; das Inkrafttreten steht jetzt in Artikel 4.
- Nr. 98 Artikel 3 trägt jetzt die Überschrift „Inkrafttreten“.

**Ergebnis: Die neue Fassung beseitigt nicht alle Fehler.** Sie übernimmt viele Korrekturvorschläge aus Abschnitt 5 wörtlich oder sinngemäß, lässt aber Befunde offen und bringt neue Fehler hinzu.

| Gegenstand | behoben | teilweise behoben | offen | gegenstandslos |
| --- | --- | --- | --- | --- |
| Normtextbefunde B-01 bis B-35 (8.3) | 11 | 17 | 7 (B-02, B-09, B-10, B-13, B-21, B-29, B-31) | 0 |
| weitere Punkte des Berichts (8.3) | – | – | 2 (Abschnitt 1.2, K-15) | – |
| Grenzpolizei G-1 bis G-10 (8.5) | 6 (G-1, G-4, G-5, G-7, G-8, G-10) | 3 (G-2, G-3, G-6) | 0 | 1 (G-9, kein Mangel) |

Neu festgestellt sind 56 Befunde (N-01 bis N-56, Abschnitt 8.4). 22 davon sind durch die neue Fassung entstanden, teilweise entstanden, verschärft oder erst sichtbar geworden (N-01, N-03, N-05, N-06, N-07, N-10 bis N-15, N-17, N-24, N-25, N-30, N-34, N-37, N-47, N-48, N-50, N-53, N-54). Die übrigen 34 bestanden schon in der ersten Fassung und waren im Bericht nicht erfasst.

**Kasernierte Grenzpolizei.** Der Kernwiderspruch der ersten Fassung ist beseitigt: Ab 1. Dezember 2026 ist die Grenzpolizei Polizeidienststelle (PVDG § 97 Abs. 1 Satz 1 n. F.), aber nicht Teil der Volkspolizei (§ 1 Satz 3 n. F.). Damit bleibt sie für örtliche Zuständigkeit, Aufsicht, Weisungen und Zusammenarbeit im PVDG erfasst und ist in die neuen Gesetze ausdrücklich einbezogen. Offen bleiben:

- die Freigabe besonderer Waffen (§ 46 Abs. 1),
- die Anordnungsbefugnisse an elf PVDG-Stellen,
- § 46a Abs. 3 im Zuständigkeitsbereich der Bundespolizei,
- die Übergangszeit vom 14. bis 30. November 2026, in der nur §§ 15a, 20a und 46a klargestellt sind,
- der nachrangige Küsten- und Wasserschutz,
- die Erfassung der Ministerialbediensteten durch die Beschwerdestelle,
- die Online-Wache im Polizeidigitalisierungsgesetz.

Einzelheiten stehen in 8.5.

**Vorrangig vor einer Verkündung** (vollständige Liste in 8.2):

1. § 46 Abs. 1 PVDG nennt weiter „des/der Volkspolizeipräsident:in oder deren Vertretung im Amt“, ein Amt, das kein Blatt schafft. Zu entscheiden ist, wer die Freigabe erteilt (E-03, E-04, E-13, E-07, E-36, E-27).
2. Mit § 97 Abs. 1 n. F. entfällt die Gleichsetzung der Polizeidirektionen mit den Bezirkspolizeidirektionen. Elf PVDG-Anordnungsbefugnisse und zahlreiche Normen außerhalb des PVDG verlieren damit ihren Bezug (E-26, E-30, E-32).
3. „§ 97 Absatz 1 bis 2 wird wie folgt gefasst:“ steht vor einem Zitat, das mit „§ 97“ und der Überschrift beginnt. § 97 Abs. 3 und 4 bleiben neben VPOG § 7 Abs. 2 bestehen. Zu entscheiden ist, ob sie fortbestehen; die Befehlsform ist zu berichtigen (E-31). Im Test ist der Befehl wörtlich ausgeführt; eine Fassungswahl ist nicht getroffen (8.7).
4. In Nr. 85 Art. 1 Nr. 1 fehlt das öffnende Anführungszeichen vor dem Kernsatz zur Abgrenzung von Volkspolizei und Grenzpolizei (E-02).
5. Neun Normen verweisen ab 1. Januar 2027 auf Einzelvorschriften des aufgehobenen Verfassungsschutzgesetzes (E-145 bis E-150). Hinzu kommt der Sitzungsrhythmus des Kontrollgremiums „einmal in der Legislatur“ (E-102).

**Gebrauch von 8.6.** 8.6 enthält 153 Ersatzformulierungen: E-01 bis E-150 sowie E-76a, E-99a und E-132a. Jeder Eintrag nennt:

- den bisherigen Wortlaut; er steht zeichengenau und, soweit nicht anders vermerkt, genau einmal im Blatt;
- die einfügbare Ersatzformulierung;
- einen Hinweis zu Korrekturbefehl, Trefferzahl und Kombination mit anderen Einträgen.

Ist der Inhalt nicht eindeutig, sind Varianten vollständig ausformuliert, und die Entscheidung der Volkskammer ist benannt. Keine Variante ist stillschweigend gewählt. Zur Einordnung kommen zu der Legende am Anfang des Berichts hinzu:

- [VK redaktionell]: rein redaktionelle Berichtigung;
- [VK] Entscheidung: Die Volkskammer wählt zwischen Varianten;
- [VK] Klärung: Die Regelungsabsicht ist zu klären;
- [VK] formal: fehlende Angaben in Zitierformeln.

**Prüfweg.**

1. Acht Prüfgruppen haben die neue Fassung gegen alle Befunde geprüft, jeweils mit adversarialer Gegenprüfung.
2. Die Ergebnisse wurden zusammengeführt, kritisch geprüft und korrigiert.
3. Eine abschließende Prüfung in 13 Blöcken hat jede Ersatzformulierung erneut geprüft:
   - Zitate zeichengenau gegen das Blatt,
   - Rechtsförmlichkeit, Grammatik und Ausführbarkeit gegen den Bestand,
   - Varianten und Querverweise.

   Von 17 Korrekturvorschlägen dieser Prüfung haben 14 die adversariale Gegenprüfung bestanden und sind eingearbeitet.
4. Maschinell geprüft sind:
   - alle Bisher-Zitate gegen den Klartext der neuen Fassung,
   - alle E- und N-Verweise (keine toten Verweise),
   - die Spaltenzahl aller Tabellen.

**Technische Übernahme** (8.7). Die neue Fassung lässt sich nach Aufteilung lokal importieren und konsolidieren. Build, Seed und Prüfketten sind grün. Die technischen Befunde bleiben im Wesentlichen bestehen:

- die Sammeldatei (T-1),
- die PVDG-Lücken des Bestands (T-2),
- fünf eingeführte Gesetze ohne eigenen Datensatz (T-3),
- fehlende REVOSax-Ausgangsfassungen, jetzt für sieben Ziele (T-6).

### 8.2 Vor einer Verkündung weiterhin zu klären

| Nr. | Punkt | Einordnung | Befund | Ersatzformulierung |
| --- | --- | --- | --- | --- |
| 1 | **Anordnungsbefugnisse ab 1.12.2026**: Elf PVDG-Vorschriften (§ 21 Abs. 4, § 27 Abs. 5, § 58 Abs. 4, § 59 Abs. 3, § 60 Abs. 6, § 61 Abs. 5, § 63 Abs. 4 und 5, § 65 Abs. 3, § 71 Abs. 4, § 73 Abs. 2) knüpfen an die Leitung „des Landeskriminalamtes oder einer Polizeidirektion“ an; mit § 97 Abs. 1 n. F. entfällt die Gleichsetzung der Polizeidirektionen mit den Bezirkspolizeidirektionen. Die Leitung der Grenzpolizei kann keine dieser Anordnungen treffen [VB]. | [VK] Entscheidung | N-11, G-3 | E-30, E-26, E-32 |
| 2 | **§ 46a Abs. 3 PVDG**: Im Zuständigkeitsbereich der Bundespolizei handelt auch die Grenzpolizei nur auf Ersuchen der Bundespolizei, obwohl sie dort nach dem Verwaltungsabkommen selbst grenzpolizeilich tätig ist. | [VK] Entscheidung | K-15, G-3 | E-130 |
| 3 | **Übergang 14. bis 30.11.2026**: Nr. 96 Art. 3 stellt die Grenzpolizei nur für §§ 15a, 20a und 46a einer Polizeidienststelle gleich; die übrigen PVDG-Vorschriften bleiben wegen der Kollision Nr. 46/Nr. 50 bis 30.11. mehrdeutig. | [VB]; [VK] Entscheidung | B-04 | E-132, E-131, E-133 |
| 4 | **Beschwerdestelle**: PolBeschStG § 1 Abs. 2 Nr. 1 erfasst Beschäftigte der obersten Polizeibehörde nur, „soweit sie dort Aufgaben der Volkspolizei wahrnehmen“; wer dort die Grenzpolizei beaufsichtigt, ist nicht erfasst, die Einschränkung läuft wörtlich weitgehend leer. | [VK] [VL?] Entscheidung | N-17 | E-42 |
| 5 | **Informationssicherheit Volkspolizei und Grenzpolizei**: PolDigG § 2 Abs. 4 (Online-Wache nach § 1 Nr. 4 nur der Volkspolizei, doppelte Bestellregel, unklarer Bezug „an deren Stelle“); zusätzliche Beauftragte neben ISichG § 7 Abs. 2 ohne geregeltes Verhältnis; ISichG nennt das Staatssekretariat doppelt. | [VK] Entscheidung; teils [VK redaktionell] | G-6, N-24, N-25, N-15, B-06 | E-53, E-56, E-35 |
| 6 | **Küsten- und Wasserschutz der Grenzpolizei** bleibt gegenüber der Bereitschaftspolizei nachrangig (KGrPolG § 9 Abs. 2 neben PolOrgVO § 5 Abs. 3). | [VB]; [VK] Entscheidung | G-2 | E-37 |
| 7 | **Freigabe besonderer Waffen (§ 46 Abs. 1 PVDG)**: unverändert „des/der Volkspolizeipräsident:in oder deren Vertretung im Amt“; das Amt besteht nicht, für die Grenzpolizei fehlt jede Instanz. Davon hängen Besoldungsamt (Anlage 2 OstBesG), Beiratssitz (PolFHG § 16 Abs. 2) und neun Verwaltungsvorschriften ab. | [VK] Entscheidung | B-02, G-3, B-06, N-03 | E-03, E-04, E-13, E-07, E-36, E-27 |
| 8 | **Bezeichnungsanpassung erfasst das Übergangsrecht**: Nr. 99 Art. 3 Abs. 1 ersetzt ab 1.1.2027 auch die bewusst alten Bezeichnungen in LfStErrG § 12, OstSKG § 14 Satz 2 und in Nr. 99 selbst. | [VK] | N-54 | E-143 |
| 9 | **Sicherheitserlass KRITIS 09/2026**: Lücke vom 9. bis 31.12.2026 besteht fort; die Inkrafttretenstermine von Nr. 90, 94 und 95 sind unverändert. | Vollzug; hilfsweise [VK] Entscheidung | Abschnitt 1.2 | E-121 |
| 10 | **Nr. 87 Art. 3 Abs. 2**: „vor dem 1. Januar 2028“ setzt § 22c PolFHG im Jahr 2027 aus, jetzt auch für die Grenzpolizei. | [VK] Entscheidung | B-13 | E-41 |
| 11 | **Einzelverweise auf das OstVSG**: neun Normen (OstSÜG, OstISichG, OstBesG, zwei Verwaltungsvorschriften, vier Förderrichtlinien) verweisen ab 1.1.2027 auf Vorschriften eines aufgehobenen Gesetzes; v2 regelt nur die fünf Vollzugsgesetze. | [VK] Entscheidung | B-30 | E-145, E-146, E-148, E-149, E-150 |
| 12 | **Hochschulname**: Der neue Name gilt nur in PolFHG § 1 und der Hochschulgrade-VO; PVDG § 80 Abs. 6 und neun weitere Gesetze und Verordnungen behalten „Hochschule der Ostdeutschen Polizei (FH)“. | [VK] | N-02 | E-05, E-09, E-11 |
| 13 | **Polizeiorganisationsverordnung**: VPOG § 17 Abs. 2 Satz 2 trifft die fünf namentlich genannten Polizeidirektionen nicht; ob die Autobahnzuständigkeiten nach § 1 Abs. 3 PolOrgVO fortgelten, ist offen. | [VK] Entscheidung | B-07 | E-25 |
| 14 | **Unterstellungs- und Eilbefugnis** (§ 99 Abs. 2 und 3 PVDG a. F.) entfällt mit „Die §§ 99 und 100 werden aufgehoben.“ ersatzlos; § 101 Abs. 3, in den E-33 sie überführt, hebt v2 mit „Absatz 3 wird aufgehoben.“ auf. | [VK] Entscheidung | B-08 (b) | E-33 |
| 15 | **§ 97 PVDG**: „§ 97 Absatz 1 bis 2 wird wie folgt gefasst:“ mit Zitat samt Paragraphenüberschrift; Abs. 3 und 4 bleiben neben VPOG § 7 Abs. 2 bestehen. | [VK] Entscheidung (Fortbestand Abs. 3 und 4); Befehlsform [VK redaktionell] | B-01, B-08 (a), N-13 | E-31 |
| 16 | **KRITIS-Gesetz, Verweise**: „Landeslagebildes nach § 8 des Ostdeutschen Sicherheitsgesetzes“ (richtig § 7); „Ost-Sicherheitsgesetz“ in § 11 Abs. 1 Satz 2 und § 14. | [VK] | B-28 | E-113, E-114, E-117 |
| 17 | **VPOG § 16 Abs. 1 Nr. 2**: „nach den Kriterien des § 8 Absatz 2“; § 8 Abs. 2 enthält keine Kriterien. | [VK] [VL?] Entscheidung | N-09 | E-21 |
| 18 | **„Oberste Polizeibehörde“** ist nur für VPOG und PVDG bestimmt; PolBeschStG und PolDigG verwenden den Begriff ohne Verweis. | [VK redaktionell] | N-05 | E-12, E-43 |
| 19 | **OstSNDG § 3 Abs. 1 Satz 2**: Amtshilfeverbot ohne Vorbehalt der Vollzugshilfe nach LfStErrG § 4 Abs. 4 Satz 2. | [VK] | N-36 | E-86 |
| 20 | **KRITIS-Begriff im OstSNDG und im Sicherheitsgesetz** ohne „Systeme“ (abweichend von OstKRITISG § 2 Nr. 1). | [VK] | N-35 | E-85, E-58 |
| 21 | **OstKRITISG § 1 Satz 1**: „gelten für diese Anlage nur die §§ 4, 7, 8 und 14“ schließt auch Befugnisse (§ 10), Vertraulichkeit (§ 11) und Bußgeld (§ 13) aus. | [VK] Klärung | N-41 | E-110 |
| 22 | **OstKRITISG, Fristen und Bußgeld**: § 13 Abs. 1 Nr. 2 ahndet „nicht rechtzeitig“ ohne Frist im Stammgesetz; für den Resilienzplan fehlt die Vorlagepflicht. | [VK] Entscheidung | N-42 | E-111, E-112, E-115, E-118 |
| 23 | **LfStErrG § 6 Abs. 1 und § 5**: „Das Landesamt für Staatsschutz darf Polizeidienststellen angegliedert werden.“; fachliche Weisungen an die Volkspolizei ohne Vorrangregel. | [VK] [VL?] Entscheidung | B-21 | E-69, E-68 |
| 24 | **Sicherheitsgesetz**: „das zuständige Mitglied des Staatsrates“ ist nicht bestimmt; die vorläufige Aktivierung des Landeskrisenstabs durch „die Leitung der Geschäftsstelle“ hat keinen Bezug. | [VK] Entscheidung | N-27, B-16 | E-58, E-61 |
| 25 | **OstSNDG § 5 Abs. 3**: Einsatzschwelle und Adressatenbeschränkung stehen im Listeneintrag Nummer 4 und gelten nach der Gliederung nur für Vertrauenspersonen und verdeckt arbeitende Bedienstete. | [VK] | N-38 | E-89 |
| 26 | **OstSNDG § 1 Abs. 1 Nr. 3**: Bestrebungen gegen kritische Infrastruktur sind nur erfasst, wenn sie zugleich ein Ziel nach Nr. 4 bis 6 verfolgen. | [VK] Entscheidung | N-34 | E-80 |
| 27 | **OstSNDG § 17 Abs. 2, DDR-Strukturen, Einbürgerung**: § 17 Abs. 2 sprachlich nicht ausführbar; zwei Aufgaben des OstVSG ohne Entsprechung. | [VK] Entscheidung | B-25 | E-95, E-96, E-97, E-81, E-82 |
| 28 | **OstSNDG § 13 Abs. 2 und § 2 Abs. 1**: Löschfrist für terroristische Bestrebungen nur dem Wort nach, Fristbeginn elliptisch; § 2 Abs. 1 Nr. 1 endet mit Komma, „ein solches Ziel erheblich zu beschädigen“. | [VK] | B-24, B-23 | E-91, E-83, E-84 |
| 29 | **OstSKG**: „Das Kontrollgremium tritt in der Regel einmal in der Legislatur zusammen.“; zwei gleichnamige Parlamentarische Kontrollgremien. | [VK] [VL?] Entscheidung | B-26 | E-102, E-87, E-100, E-101, E-72 bis E-75, E-147, E-141 |
| 30 | **Nr. 99 Art. 3 Abs. 2**: „Die Redaktion des Ostdeutschen Gesetzes- und Verordnungsblattes“ ohne Rechtsgrundlage, Ermächtigungsformel und Bestimmtheit. | [VK] Entscheidung | N-55 | E-144, E-139 |
| 31 | **PVDG § 20a**: Eilanordnung ohne Außerkrafttreten und ohne sofortige Vollziehbarkeit; Konkurrenz zu § 21 ungeregelt. | [VK] Entscheidung | B-32 | E-126, E-127 |
| 32 | **PVDG § 46a Abs. 1**: Verkehrsflughäfen sind nicht mehr ausdrücklich Schutzgut. | [VK] Klärung | N-47 | E-128 |
| 33 | **VTPG § 9 Satz 2** regelt Sicherheitsüberprüfungen, die das VTPG unberührt lässt; dreifach lesbar. | [VK] Klärung | N-49 | E-134 |
| 34 | **PolBeschStG § 10 Abs. 1**: Die Hochschule der Volkspolizei (FH) ist einbezogen, aber nicht unterstützungspflichtig. | [VK] Entscheidung | N-20 | E-46 |
| 35 | **Zitierformeln ohne Artikel der Landesverfassung** (Nr. 91 Art. 1 § 13, Nr. 92 Art. 2, Nr. 94 Art. 3, Nr. 96 Art. 2, Nr. 98 Art. 2). | [VK] formal | N-44, N-51, N-56 | E-76a, E-99a, E-119, E-132a, E-136 |
| 36 | **Nr. 91**: nur halb zum Artikelgesetz umgebaut; Kurzbezeichnung steht am Mantelgesetz. | [VK redaktionell] [VL?] Entscheidung | N-30 | E-66, E-64, E-65, E-76 |
| 37 | **Eingangsformeln und Erstzitate**: Zitierprinzip für „zuletzt geändert“; LJHG, ISichG, APO Polizei, OstVSG, OstSNDG, OstSKG und Vollzugsgesetze ohne Änderungsangabe oder Vollzitat. | [VK redaktionell] | B-10, N-14, N-16, B-31, N-53 | E-01, E-06, E-28, E-34, E-35, E-39, E-48, E-124, E-40, E-137, E-140, E-141, E-148 |
| 38 | **PVDG-Kern, redaktionell**: fehlendes öffnendes Anführungszeichen, Inhaltsübersicht „gestrichen“ statt „(weggefallen)“, „in Kraft..“, Titel von Nr. 96. | [VK redaktionell] | N-01, N-12, B-12, N-45 | E-02, E-29, E-38, E-122, E-123 |
| 39 | **VPOG, redaktionell**: Schlussteil von § 16 Abs. 1 in Nummer 5, „eine eine“, Überschrift und Absatzzählung von § 16, Verweis in § 13 Abs. 4 Satz 3, Bezeichnung des KGrPolG in § 6 Satz 2. | [VK redaktionell] [VL?] | B-12, N-10, N-08, N-07, N-06 | E-23, E-22, E-19, E-20, E-24, E-14, E-16, E-17, E-25, E-18, E-15 |
| 40 | **PolBeschStG, redaktionell**: „Bedienstete“ für das eigene Personal, unbezifferter Satz in § 2 Abs. 1, Inkrafttretensformel. | [VK redaktionell] | N-19, N-18, N-21 | E-45, E-47, E-44, E-49 |
| 41 | **Hochschulgrade-VO, redaktionell**: Wortersetzung statt Neufassung der Bezeichnung; Rückkehrklausel fehlt. | [VK redaktionell] | N-04 | E-08, E-10, E-11 |
| 42 | **PolDigG, redaktionell**: gleiche Bezeichnung von Mantel- und Stammgesetz, Abschnitt 1 ohne Überschrift, „Aktenführung .“, „nach §§ 82 bis 90“, Schlusswendung in § 14. | [VK redaktionell] | N-22, N-23, B-14, N-26 | E-50, E-51, E-52, E-54, E-55, E-57 |
| 43 | **Sicherheitsgesetz und LfStErrG, redaktionell**: doppelter Satz zur Weisungsbefugnis, falsche Anführungszeichen, „der/dem Präsident:in“, Abschnittsüberschrift; „Vorabanordnung“, unbezifferte Absätze in § 7. | [VK redaktionell] | B-18, N-28, B-16, N-29, N-31, B-19 | E-59, E-60, E-62, E-63, E-67, E-70, E-71 |
| 44 | **OstSNDG und OstSKG, redaktionell**: Abschnitt 1 fehlt, Zeichensetzung der Aufzählungen, Kurzform „Landesamt“, Schrägstrichformen, Zuordnung in OstSKG § 14 Satz 2. | [VK redaktionell] | N-32, N-33, N-37, N-39, N-40 | E-77, E-78, E-79, E-88, E-90, E-92, E-93, E-94, E-96, E-98, E-99, E-101, E-103 bis E-109 |
| 45 | **KRITIS-Gesetz, PVDG und OstSZG, redaktionell**: fehlendes „oder“ (OstKRITISG § 13 Abs. 1, PVDG § 46a Abs. 1), Inkrafttreten ohne Vorbehalt (Nr. 94 Art. 4), „gegen die Anlage“ (§ 15a Abs. 1), Artikelfolge Nr. 96, Selbstübermittlung (OstSZG § 2 Abs. 1). | [VK redaktionell] | N-43, B-29, N-46, N-48, N-50 | E-116, E-120, E-125, E-129, E-132, E-135 |
| 46 | **Nr. 99, redaktionell**: „Artikel-10-Gesetz“ in der Überschrift von Art. 2, „G10-Kommission“ in Art. 3 Abs. 1 Nr. 4. | [VK redaktionell] | N-52 | E-138, E-142 |

### 8.3 Status der bisherigen Befunde

| ID | Blatt / Vorschrift | Status v2 | Rest bzw. Begründung | K-Vorschlag | Ersatz |
| --- | --- | --- | --- | --- | --- |
| B-01 | Nr. 86 Art. 2 Nr. 2 (§ 97 Abs. 1 PVDG) i. V. m. Nr. 85 Art. 1 Nr. 1 und VPOG § 2 | teilweise behoben | Kernwiderspruch beseitigt: § 1 Satz 3 n. F. und § 97 Abs. 1 Satz 1 n. F. („Polizeidienststellen im Sinne dieses Gesetzes sind die Polizeidienststellen der Volkspolizei nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes und die Kasernierte Grenzpolizei.“) machen die Grenzpolizei zur Polizeidienststelle, nicht zur Volkspolizei. Offen nur die Befehlsform „§ 97 Absatz 1 bis 2 wird wie folgt gefasst:“ (N-13). | K-01 Variante A abweichend umgesetzt: ohne Halbsatz zur Bezeichnung der Grenzpolizei, § 97 Abs. 1 Satz 3 verweist auf § 100a, VPOG § 7 Abs. 1 Satz 2 als Unberührtheitsklausel; Befehlsform nicht übernommen | E-31 |
| B-02 | Nr. 85 Art. 1 Nr. 2 (§ 46 Abs. 1 PVDG) | offen | Unverändert „des/der Volkspolizeipräsident:in oder deren Vertretung im Amt“: Amt besteht nicht, Genitiv und „deren“ fehlerhaft, keine Freigabe für die Grenzpolizei; Nr. 85 Art. 2 Nr. 3 ersetzt dieselbe Funktion durch die Leitung der obersten Polizeibehörde. Zieltext 1 Treffer. | K-02 nicht umgesetzt | E-03, E-04, E-13 |
| B-03 | Nr. 85 Art. 2 Nr. 2 (PolFHG § 1) | behoben | „In § 1 werden die Wörter“; Zieltext 1 Treffer; HTML-Liste jetzt richtig verschachtelt (Teilbefund aus T-3 erledigt); Rest nur ein geschütztes Leerzeichen vor Nummer 1 [TÜ]. | K-19 wörtlich umgesetzt | – |
| B-04 | Nr. 96 Art. 3; Kollision Nr. 46 Art. 11 / Nr. 50 Art. 2 in § 97 Abs. 1 PVDG | teilweise behoben | Ab 1.12.2026 beseitigt. Für 14. bis 30.11. nur „gilt die Kasernierte Grenzpolizei bei der Anwendung der §§ 15a, 20a und 46a des Ostdeutschen Polizeivollzugsdienstgesetzes als Polizeidienststelle“; übrige Vorschriften (u. a. § 73 Abs. 1 Nr. 1, § 101 Abs. 2 und 4, §§ 102, 103) bleiben mehrdeutig; T-2 unverändert [VB]. | im Bericht kein K-Vorschlag; v2 fügt Art. 3 ein | E-132, E-131, E-133 |
| B-05 | Nr. 86 Art. 3 Abs. 1 und 2 (Pass-AG § 2, LJHG § 5 Abs. 1 Buchst. f) | behoben | Beide Verweise auf VPOG § 2 Abs. 2 Nr. 4 umgestellt, je 1 Treffer, gleichzeitig wirksam. Rest außerhalb: LJHG-Stammzitat ohne letzte Änderung (N-14). | K-05 inhaltlich wörtlich, als Art. 3 statt Art. 2a | (E-34 zu N-14) |
| B-06 | Nr. 86 Art. 3 Abs. 3, Nr. 85 Art. 2 Nr. 3; Besoldungsgesetz, neun VwV, PolDigG | teilweise behoben | ISichG §§ 7, 9, 10 und PolFHG § 16 angepasst, beide mit neuen Fehlern (N-15, N-03). Offen: Besoldungsgruppe B 6 „Landespolizeipräsident – als Abteilungsleiter im Staatsministerium des Innern –“, neun Verwaltungsvorschriften, Verhältnis der Informationssicherheitsbeauftragten. | K-06 abweichend; Besoldungs-Folgeänderung aus K-02 nicht umgesetzt | E-36, E-27 (nur bei Amt Volkspolizeipräsident:in); E-07, E-35, E-53, E-56 |
| B-07 | Nr. 86 Art. 1 § 17 Abs. 2 VPOG | teilweise behoben | Fortgeltung der PolOrgVO geregelt, Fundstelle richtig. „Verweisungen in dieser Verordnung auf Polizeidirektionen beziehen sich auf die Bezirkspolizeidirektionen nach § 7.“ trifft den Text nicht (fünf namentlich bezeichnete Direktionen); Autobahnzuständigkeit nach § 1 Abs. 3 PolOrgVO offen. Die Fortgeltung der Verordnung als solche ist geklärt (G-10); offen ist nur die Zuordnung der namentlich genannten Direktionen (E-25). | K-23 abweichend umgesetzt | E-25 |
| B-08 | Nr. 86 Art. 2 Nr. 2 bis 4 (§§ 97, 99, 100, 101 PVDG) | teilweise behoben | (a) § 97 Abs. 3 und 4 bleiben neben VPOG § 7 Abs. 2 (N-13); (b) Unterstellungs- und Eilbefugnis (§ 99 Abs. 2 und 3 a. F.) entfällt mit „Die §§ 99 und 100 werden aufgehoben.“ ersatzlos; § 101 Abs. 3, in den E-33 sie überführt, hebt v2 mit „Absatz 3 wird aufgehoben.“ auf; (c) § 101 behoben. | K-03 abweichend umgesetzt; K-04 teilweise; K-22 nicht | E-31, E-33 |
| B-09 | Nr. 86 Art. 2 Nr. 1, Nr. 96 Art. 1 Nr. 1 (Inhaltsübersicht) | offen [TÜ] | Pauschalbefehle durch konkrete Befehle ersetzt, Nr. 96 ausführbar; Inhaltsübersicht im Bestand weiter nicht abbildbar (T-9). Normtextmangel „gestrichen“ unter N-12. | im Bericht kein K-Vorschlag | (E-29 zu N-12) |
| B-10 | Eingangssätze Nr. 85 Art. 1 und 2, Nr. 86 Art. 2, Nr. 87 Art. 1, Nr. 88 Art. 2, Nr. 96 Art. 1 | offen | Unverändert. Nach beiden Zitiermaßstäben unrichtig: Nr. 85 Art. 1, Nr. 86 Art. 2, Nr. 88 Art. 2 („Artikel 11 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 46 S. 2)“), Nr. 87 Art. 1; Nr. 85 Art. 2 nur Partizipform. Richtig: Nr. 85 Art. 3, Nr. 86 Art. 3 Abs. 1. Zitierprinzip festlegen. | im Bericht kein K-Vorschlag | E-01, E-06, E-28, E-39, E-48, E-124 |
| B-11 | Nr. 88 Art. 1 (PolBeschStG) | behoben | Verweis auf VPOG § 2 Abs. 2 und 3, KGrPolG-Zitat entfallen, „Die Beschwerdestelle kann die Volkskammer unterrichten.“, § 17 Abs. 1 Nr. 6 und 7 gegliedert. Neue Fragen der neuen Nr. 1: N-17, N-05, N-19, N-20. | K-12 Nr. 1 abweichend, Nr. 2 wörtlich | – |
| B-12 | Nr. 86 Art. 1 (VPOG), Art. 4 | teilweise behoben | Behoben: § 9 Abs. 2, § 10 Abs. 1 Nr. 4, § 12, § 4 Abs. 2 („insbesondere“), § 17 Abs. 2 a. F. Offen: Schlussteil „zu regeln“ und Satz 2 stehen weiter in Nr. 5 von § 16 Abs. 1; „Dieses Gesetz tritt am 1. Dezember 2026 in Kraft..“. | K-20 teilweise | E-23, E-38 |
| B-13 | Nr. 87 Art. 3 Abs. 2 | offen | Wortgleich mit v1: „die vor dem 1. Januar 2028 übertragen wurden“, „Die Inhaberinnen und Inhaber dieser Funktionen“. Einfügung der §§ 22a bis 22d ausführbar. | im Bericht kein K-Vorschlag (Klärung) | E-41 |
| B-14 | Nr. 89 Art. 1 § 4 Abs. 2, § 7 Abs. 3 (PolDigG) | teilweise behoben | „nachr“ behoben (0 Treffer); offen „Aktenführung .“; neu ohne Artikel „nach §§ 82 bis 90“. | im Bericht kein K-Vorschlag | E-54, E-55 |
| B-15 | Nr. 90 Art. 2 | behoben | „Artikel 2 Inkrafttreten“, Parser erkennt den Artikel; T-3 besteht fort [TÜ]. | K-14 Nr. 1 wörtlich | – |
| B-16 | Nr. 90 Art. 1 § 8 | teilweise behoben | Abs. 2 behoben; Abs. 3 inhaltlich behoben, aber neue Schrägstrichform „der/dem Präsident:in der Volkskammer“; Abs. 1 „die Leitung der Geschäftsstelle“ und „vom zuständigen Staatsrat“ offen. | K-14 Nr. 2 nicht, Nr. 3 umgesetzt (Abs. 3 abweichend) | E-61, E-62 |
| B-17 | Nr. 90 Art. 1 § 3 Abs. 2 | behoben | Geschäftsbereiche Frieden, Liebe und Überfluss; Koordinierungsstelle wird hinzugezogen. | K-14 Nr. 4 wörtlich, zusätzlich Satz 2 | – |
| B-18 | Nr. 90 Art. 1 § 2, § 12 | teilweise behoben | Schlusspunkt und „auf Verlangen“ behoben; offen die wortgleiche Doppelung „Polizeidienststellen sind dem Landesamt für Staatsschutz gegenüber nicht weisungsbefugt.“ (Nr. 90 § 2 Abs. 2 Satz 2, Nr. 91 § 6 Abs. 2 Satz 2). Kurzbezeichnung in Nr. 94: B-28. | K-14 Nr. 5 umgesetzt („auf Verlangen“) | E-59 |
| B-19 | Nr. 91 Art. 1 § 5 Abs. 4, § 7 | teilweise behoben | § 5 Abs. 4 zusammengeführt; § 7 Abs. 2 und 3 weiter mit unbezifferten Absätzen („Vor der Ernennung ist das Parlamentarische Kontrollgremium nach dem Staatsschutz-Kontrollgesetz anzuhören.“, „Absatz 2 gilt entsprechend.“). Typfrage durch Mantelform überholt, Umbau unvollständig (N-30). | im Bericht kein K-Vorschlag | E-70, E-71 |
| B-20 | Nr. 91 Art. 2 i. V. m. Nr. 92, 93, 99 | behoben | „Dieses Gesetz tritt am 1. Januar 2027 in Kraft.“; Zeitfenster geschlossen. 65 ausgeschriebene Nennungen in 25 Normen und 91 „LfV“ in drei VwV erfasst Nr. 99 Art. 3 Abs. 1; nicht erfasst die Geschäftsordnung der Volkskammer (Anlage 3 § 19 Abs. 1), die die Volkskammer selbst anpassen muss. Restmängel N-30, N-54. | K-07 inhaltlich, formal als Art. 2 eines Mantelgesetzes | – |
| B-21 | Nr. 91 Art. 1 § 6 Abs. 1, § 5 | offen | Unverändert; „darf Polizeidienststellen angegliedert werden“ ist die genaue Umkehrung von OstVSG § 1 Abs. 4 [VL?]; Weisungen an die Volkspolizei ohne Vorrangregel. Ob „Polizeidienststellen“ in § 6 Abs. 1 die Grenzpolizei über PVDG § 97 Abs. 1 n. F. einschließt, ist offen; E-69 Variante A nennt die Grenzpolizei ausdrücklich und gilt deshalb in beiden Lesarten. | im Bericht kein K-Vorschlag | E-69, E-68 |
| B-22 | Nr. 92 Art. 1 § 1 Abs. 1 | behoben | Nr. 4 und 5 zu Nr. 4 vereinigt, Zählung 1 bis 6; Volkskammer bestätigt nur die vereinigte Fassung [VL?]. Zeichensetzung N-33, Nr. 3 N-34. | K-08 Nr. 1 abweichend (Vereinigung statt Streichung) | – |
| B-23 | Nr. 92 Art. 1 § 2 Abs. 1 Nr. 1 und 2 | teilweise behoben | Selbstverweis behoben; Nr. 1 besteht aus zwei Sätzen und endet mit Komma; „ein solches Ziel erheblich zu beschädigen“ (seit v1). | K-08 Nr. 2 wörtlich | E-83, E-84 |
| B-24 | Nr. 92 Art. 1 § 13 Abs. 2 | teilweise behoben | Lücke für Nr. 7 entfallen; terroristische Bestrebungen nur dem Wort nach, „spätestens nach 15 Jahren“ ohne Fristbeginn, „die Leitung des Landesamtes“. | K-08 Nr. 3 nicht übernommen | E-91 |
| B-25 | Nr. 92 Art. 1 §§ 1, 3, 4, 5, 16 bis 19 | teilweise behoben | § 18 „oder“, § 1 Abs. 3, „Es“, § 5 Abs. 4 behoben; offen § 17 Abs. 2 („zu denselben Bedingungen Übermitteln“), DDR-Strukturen und Einbürgerung. | K-08 Nr. 4 und K-21 Satz 1 wörtlich; K-21 Satz 2 nicht | E-95, E-96, E-97, E-81, E-82 |
| B-26 | Nr. 93 Art. 1 § 1, § 3 Abs. 1, § 11 Abs. 2; Nr. 92 § 3 Abs. 3 | teilweise behoben | „Ihre Entscheidungen sind für den Staatsschutz bindend.“ behoben; offen Sitzungsrhythmus und zwei gleichnamige Kontrollgremien. | K-13 nur zu „bindend“ umgesetzt | E-102, E-87, E-100, E-101, E-72 bis E-75, E-147, E-141 |
| B-27 | Nr. 94 Art. 1 § 13 Abs. 1 Nr. 1 | behoben | „entgegen § 4 eine kritische Infrastruktur nicht oder nicht rechtzeitig registriert,“ | K-10 Nr. 3 wörtlich | – |
| B-28 | Nr. 94 Art. 1 §§ 8, 9, 11, 14; Art. 3 | teilweise behoben | § 8, Bezeichnung in § 9 Abs. 2 Nr. 2 und Art. 3 behoben; offen „§ 8“ statt § 7 in § 9 Abs. 2 Nr. 2 und „Ost-Sicherheitsgesetz“ in § 11 Abs. 1 Satz 2 und § 14. | K-10 Nr. 1 teilweise, Nr. 2 nicht | E-113, E-114, E-117 |
| B-29 | Nr. 94 Art. 4 | offen | Ausführbar; Satz 1 („Dieses Gesetz tritt am 1. Januar 2027 in Kraft.“) ohne Vorbehalt neben Satz 2; T-4 besteht fort [TÜ]. | im Bericht kein K-Vorschlag | E-120 |
| B-30 | Nr. 99 Art. 3 Abs. 1 Nr. 2, Art. 4 Abs. 5 | teilweise behoben | Nr. 2 gilt nur noch „insgesamt und ohne Angabe einer bestimmten Vorschrift“ (im Bestand ohne Anwendungsfall), fünf Vollzugsgesetze statisch geregelt; offen OstSÜG §§ 22, 24, OstISichG § 13 Abs. 7, OstBesG § 48, zwei VwV (VwV OstSÜG, VwV OstBesG), vier FRL. | K-09 abweichend und teilweise | E-145, E-146, E-148, E-149, E-150 |
| B-31 | Nr. 99 Art. 1 | offen | „Das Ostdeutsche Verfassungsschutzgesetz vom 16. Oktober 1992 (SächsGVBl. S. 459) wird mit Ablauf des 31. Dezember 2026 aufgehoben.“ ohne Änderungsangabe; Art. 4 Abs. 4 nur noch klarstellend. | im Bericht kein K-Vorschlag | E-137 |
| B-32 | Nr. 96 Art. 1 Nr. 2 bis 4 (§§ 15a, 20a, 46a PVDG), Art. 3 | teilweise behoben | Begriff in § 46a Abs. 1 und Anordnungen der Grenzpolizeileitung gelöst; offen § 20a (kein Außerkrafttreten der Eilanordnung, keine sofortige Vollziehbarkeit, „(4) § 20 bleibt unberührt.“, Bezug „die Polizeidienststelle“). | im Bericht kein K-Vorschlag | E-126, E-127 |
| B-33 | Nr. 98 Art. 1 (OstSZG), Art. 3 | behoben | § 1 Abs. 4, § 2 Abs. 3, § 3 Satz 2 und Überschrift von Art. 3; Folgefehler N-50. | K-11 umgesetzt (Nr. 1 abweichend) | – |
| B-34 | Nr. 95 Art. 1 §§ 2, 3 (OstLVSG) | behoben | Schlusspunkt gesetzt, Grenzpolizei in §§ 2 und 3 einbezogen. | K-16 abweichend, inhaltlich erfüllt | – |
| B-35 | Nr. 97 Art. 2 § 3 Abs. 2 (DemFG) | behoben | Satz 2 steht im Absatz. Die v1-Begründung („Landesamt für Staatsschutz besteht ab 1.12.2026“) ist überholt; es besteht ab 1.1.2027, gleichzeitig mit VTPG und DemFG. VTPG § 9: N-49. | im Bericht kein K-Vorschlag | – |
| Abschnitt 1.2 | Sicherheitserlass KRITIS 09/2026 im Verhältnis zu Nr. 90, 94, 95 | offen | Lücke 9. bis 31.12.2026; kein Normtextfehler der Blätter. | im Bericht nur Hinweis | E-121 |
| K-15 | Nr. 96 Art. 1 Nr. 4 (§ 46a Abs. 3 PVDG) | offen | nicht umgesetzt, siehe G-3. | K-15 | E-130 |

K-10 Nr. 4, K-17 und K-18 sind in v2 umgesetzt beziehungsweise überholt; sie sind in 8.5 bei G-5, G-8 und G-6 bewertet.

### 8.4 Neue Befunde

Format je Befund: **Blatt / Vorschrift** (Kennung der Prüfgruppe) · exakter Wortlaut · Auswirkung · Einordnung → Ersatzformulierung.

Neue Befunde sind für diesen Bericht fortlaufend als N-01 bis N-56 nummeriert; die Kennung der Prüfgruppe (N-<Gruppe>-<lfd>) steht jeweils in Klammern. Prüfgruppen: A1 PVDG-Kern, A2 Folgeänderungen und Hochschulrecht, B VPOG und Polizeibeschwerdestellengesetz, C Nr. 87 und 89, D Nr. 90 und 91, E Nr. 92 und 93, F Nr. 94 bis 98, G Nr. 99, H Grenzpolizei.

**N-01 · Nr. 85 Art. 1 Nr. 1 (PVDG § 1 Satz 3)** (N-A1-01, N-H-01)

Auf „Dem § 1 wird folgender Satz angefügt:“ folgt unmittelbar „Die Polizeidienststellen nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes führen die amtliche Bezeichnung“ ohne öffnendes Anführungszeichen; das schließende steht (HTML-Quelle geprüft). Der anzufügende Wortlaut ist nicht abgegrenzt, betroffen ist der Kernsatz zur Abgrenzung von Volkspolizei und Grenzpolizei (G-1). Durch v2 entstanden; die inneren Zeichen ‚…‘ sind berichtigt. [VK redaktionell] → E-02.

**N-02 · Nr. 85 Art. 2 und 3; PVDG § 80 Abs. 6 und weitere Normen** (N-A2-05)

Nr. 85 ersetzt „Hochschule der Ostdeutschen Polizei (FH)“ nur in § 1 PolFHG und § 1 Abs. 1 der Hochschulgrade-VO. Ab 1.12.2026 nennt das PVDG dieselbe Hochschule in § 80 Abs. 6 mit dem alten und in § 97 Abs. 2 n. F. („Der Freistaat unterhält die Hochschule der Volkspolizei (FH)“) mit dem neuen Namen. Den alten Namen behalten außerdem Besoldungsgesetz (§ 26 Nr. 2, § 34 Abs. 2, § 38 Abs. 3, § 40 Abs. 1, Anlagen 1 und 2), Personalvertretungsgesetz § 68 Nr. 5, Verwaltungsorganisationsgesetz § 8 Nr. 10, sechs Verordnungen und acht Verwaltungsvorschriften. Der Bericht v1 hatte das nicht erfasst. Regelungsabsicht eindeutig, keine Varianten. [VK] → E-05, E-09, E-11.

**N-03 · Nr. 85 Art. 2 Nr. 3 (PolFHG § 16 Abs. 2 Satz 1 Nr. 2)** (N-A2-01)

„die Leitung der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes oder eine von ihr benannte Vertretung“ – ausführbar (1 Treffer), aber: voraussichtlich dieselbe Person wie das Mitglied nach Nr. 1 (Organisationserlass 09/2026 Abschnitte III und IX; Auslegung); eine „benannte Vertretung“ passt nicht zu Satz 2 (Mitglieder „kraft Amtes für die Dauer ihres Hauptamtes“); dasselbe Blatt gibt dem Landespolizeipräsidenten in Art. 1 Nr. 2 einen anderen Nachfolger; die Zitierung lässt „Satz 1“ aus. Die Wahl hängt an B-02 und B-06. [VK] Entscheidung → E-07.

**N-04 · Nr. 85 Art. 3 (Hochschulgrade-VO)** (N-A2-04)

„In der Bezeichnung werden die Wörter“ – die ganze Bezeichnung wird per Wortersetzung statt durch Neufassung ausgetauscht (anders Art. 2 Nr. 1 im selben Blatt). Art. 3 ändert eine Rechtsverordnung durch Gesetz ohne Artikel „Rückkehr zum einheitlichen Verordnungsrang“; nach BVerfGE 114, 196 nur klarstellend, aber Praxis des Bestands und wegen weiteren Anpassungsbedarfs der Verordnung sinnvoll ([VB]: § 2 Nr. 5 verweist auf „§ 17 Abs. 2 Satz 1 OstPolFHG“ von 1994; Diplomgrad statt Bachelorgrad nach PolFHG § 18 Abs. 2). [VK redaktionell] → E-08, E-10, E-11.

**N-05 · Nr. 86 Art. 1 § 2 Abs. 1 (VPOG); Nr. 88 Art. 1 § 1 Abs. 2 Nr. 1, § 9 Abs. 1, § 10 Abs. 1, § 18 Abs. 1 (PolBeschStG); Nr. 89 Art. 1 § 12 Abs. 2 und 4 (PolDigG)** (N-B-07)

VPOG § 2 Abs. 1 bestimmt die oberste Polizeibehörde „im Sinne dieses Gesetzes und des Ostdeutschen Polizeivollzugsdienstgesetzes“. PolBeschStG und PolDigG richten Pflichten an „die oberste Polizeibehörde“ ohne Verweis, während Nr. 85 Art. 2 Nr. 3 und Nr. 86 Art. 2 Nr. 4 und Art. 3 Abs. 3 „nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes“ verweisen. Die Aufzählung legt einen Umkehrschluss nahe; die Lücke bestand schon in v1 und wird durch v2 verstärkt. Im geltenden Bestand verwendet kein Normtext den Begriff (0 Treffer). Redaktionelle Wahl. [VK redaktionell] → E-12, E-43.

**N-06 · Nr. 86 Art. 1 § 6 Satz 2 (VPOG)** (N-B-09, N-H-06)

„Die Unterstützung durch die Kasernierte Grenzpolizei richtet sich nach dem Gesetz über die Kasernierte Grenzpolizei des Ostdeutschen Freistaates.“ – Erstnennung mit Langbezeichnung ohne Datum und Fundstelle; die in v2 eingefügten § 7 Abs. 1 Satz 2 und § 17 Abs. 2 Satz 3 verwenden die amtliche Kurzbezeichnung „Kasernierte-Grenzpolizei-Gesetz“. Redaktionelle Wahl zwischen Kurzbezeichnung und Vollzitat; empfohlen ist das Vollzitat beim Erstzitat. [VK redaktionell] → E-15.

**N-07 · Nr. 86 Art. 1 § 13 Abs. 4 Satz 3 (VPOG)** (N-B-08)

„Die Entscheidung nach Absatz 3 Satz 2 trifft die Leitung der Kasernierten Grenzpolizei.“ – Die Entscheidung beruht auf Abs. 3 Satz 1; Satz 2 regelt nur die Zuständigkeit, von der Satz 3 abweicht. Durch v2 entstanden; geringe Priorität. [VK redaktionell] → E-18.

**N-08 · Nr. 86 Art. 1 § 16 (VPOG), Überschrift und Absatzzählung** (N-B-05)

Überschrift „Verordnungsermächtigungen, Verwaltungsvorschriften“, der Paragraph enthält aber nur Verordnungsermächtigungen und nur einen Absatz „(1)“; § 14 Abs. 2 sieht Verwaltungsvorschriften vor, ohne die Erlassbehörde zu bestimmen. Seit v1; deutet auf einen entfallenen Absatz 2 hin. Variante A ist eine inhaltliche Zuständigkeitsregel, Variante B eine Berichtigung mit Folgeänderung der vier Verweise auf „§ 16 Absatz 1“. [VK redaktionell] [VL?] Entscheidung → E-19, E-24, E-20, E-14, E-16, E-17, E-25.

**N-09 · Nr. 86 Art. 1 § 16 Abs. 1 Nr. 2 (VPOG)** (N-B-03)

„Sitz und Zuständigkeitsbereich der Polizeireviere und Polizeiposten nach den Kriterien des § 8 Absatz 2“ – § 8 Abs. 2 regelt nur die Anhörung und Unterrichtung; Organisationsmaßstäbe stehen in § 1 Abs. 2. Die Bindung der Verordnung ist unbestimmt; „Kriterien“ deutet auf eine frühere Fassung von § 8 Abs. 2. Seit v1. [VK] [VL?] Entscheidung → E-21.

**N-10 · Nr. 86 Art. 1 § 16 Abs. 1 Nr. 4 (VPOG)** (N-B-04)

„die Übertragung einzelner Aufgaben nach § 5 auf eine eine andere Polizeidienststelle nach § 2 Absatz 2,“ – Artikel bei der Ergänzung in v2 verdoppelt. [VK redaktionell] [VL?] → E-22.

**N-11 · Nr. 86 Art. 2 Nr. 2 (§ 97 Abs. 1 PVDG n. F.) im Verhältnis zu PVDG §§ 21, 27, 58 bis 61, 63, 65, 71, 73 und weiteren Normen** (N-A1-04, N-A2-06)

Seit Nr. 46 Art. 11 verband § 97 Abs. 1 Nr. 5 PVDG die Polizeidirektionen mit den Bezirkspolizeidirektionen. § 97 Abs. 1 n. F. nennt nur noch „die Polizeidienststellen der Volkspolizei nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes und die Kasernierte Grenzpolizei“; v2 stellt die Verbindung nur für PolOrgVO, Pass-AG und LJHG wieder her. Ohne Bezug bleiben elf PVDG-Stellen mit der Wortfolge „des Landeskriminalamtes oder einer Polizeidirektion“ (Anordnungs- und Eilbefugnisse mit Grundrechtsbezug), weitere Gesetze (u. a. Besoldungsgesetz § 59 Nr. 6 und Anlage 2, Sicherheitswachtgesetz § 10, Justizgesetz § 26, Personalvertretungsgesetz § 68 Nr. 2, Verwaltungsorganisationsgesetz § 8 Nr. 5), vier Verordnungen und rund 20 Verwaltungsvorschriften. Die Gleichsetzung entfällt erst durch Nr. 86; vorbestehend ist nur, dass die Leitung der Grenzpolizei keine dieser Anordnungen treffen kann. Abhilfe: eine allgemeine Klausel in VPOG § 17 (E-26), die für die Normen außerhalb des PVDG in jedem Fall nötig ist, und für das PVDG wahlweise ausdrückliche Änderungen der elf Stellen (E-30) oder eine Anordnungsbefugnis der Leitung der Grenzpolizei in § 100a (E-32). Am Bestand (Fassung 1.12.2026) nachgezählt: elf Stellen. Zur Grenzpolizei siehe G-3 [VB]. [VK] Entscheidung → E-30, E-26, E-32.

**N-12 · Nr. 86 Art. 2 Nr. 1 (Inhaltsübersicht PVDG)** (N-A1-03)

„In der Inhaltsübersicht werden die Angaben zu den §§ 99 und 100 gestrichen.“ – Nr. 3 hebt die §§ 99 und 100 auf; im Normtext stehen sie als „(weggefallen)“ weiter, die Inhaltsübersicht würde dagegen von § 98 auf § 100a springen. In v2 neu formuliert. [VK redaktionell] → E-29.

**N-13 · Nr. 86 Art. 2 Nr. 2 (§ 97 PVDG)** (N-A1-02, N-H-02)

„§ 97 Absatz 1 bis 2 wird wie folgt gefasst:“ – das Zitat beginnt mit „§ 97“ und der Überschrift „Polizeidienststellen und Einrichtungen für den Polizeivollzugsdienst“; wörtlich ausgeführt stünden Bezeichnung und Überschrift anstelle von Absatz 1. Die Absätze 3 (Nr. 26 Art. 3) und 4 (Nr. 46 Art. 11) bleiben neben VPOG § 7 Abs. 2 bestehen („Polizeidirektion Berlin“ neben „Bezirkspolizeidirektion Berlin“, Soll- neben Muss-Regel). In v2 entstanden (v1-Zitat ohne Überschrift); ersetzt den Restpunkt von B-01 und Teilpunkt (a) von B-08. [VK] Entscheidung; Befehlsform [VK redaktionell] → E-31.

**N-14 · Nr. 86 Art. 3 Abs. 2 und 3 (Eingangsformeln LJHG, ISichG); Nr. 85 Art. 2** (N-A1-06, N-A2-03)

„(3) Das Ostdeutsche Informationssicherheitsgesetz vom 2. August 2019 (SächsGVBl. S. 630) wird wie folgt geändert:“ und Abs. 2 („des Landesjugendhilfegesetzes in der Fassung der Bekanntmachung vom 4. September 2008 (SächsGVBl. S. 578) werden die Wörter“) zitieren nur das Stammgesetz. Nach den Änderungsnachweisen ist das LJHG zuletzt durch die Verordnung vom 31. Januar 2023 (SächsGVBl. S. 64) geändert (so auch amtlich OGVBl. 2026 Nr. 23), das ISichG einmal durch Artikel 14 des Gesetzes vom 31. Mai 2023 (SächsGVBl. S. 329). Abs. 1 (Pass-AG) zitiert richtig. Die Partizipform in Nr. 85 Art. 2 gehört zu B-10 (E-06). Ausführbarkeit nicht berührt; vor Übernahme gegen SächsGVBl. 2023 S. 64 und S. 329 gegenlesen. [VK redaktionell] → E-34, E-35, E-06.

**N-15 · Nr. 86 Art. 3 Abs. 3 (ISichG §§ 7, 9, 10); Nr. 89 Art. 1 § 12 Abs. 2 und § 2 Abs. 4 Satz 4 und 5 (PolDigG)** (N-A2-02, N-C-06)

Nr. 86 setzt an die Stelle des Landespolizeipräsidiums, einer Abteilung des Staatsministeriums, „der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes“, also das ganze Staatssekretariat, das nach Organisationserlass 09/2026 schon unter „In jedem Staatsministerium“ fällt (Auslegung): doppelte Nennung. Ab 1.1.2027 bestellen das Polizeiverwaltungsamt („Das Polizeiverwaltungsamt bestellt eine:n Informationssicherheitsbeauftragte:n der Volkspolizei.“) und die Leitung der Grenzpolizei („Die Leitung der Kasernierten Grenzpolizei bestellt für ihre Systeme eine Informationssicherheitsbeauftragte oder einen Informationssicherheitsbeauftragten.“) weitere weisungsfreie Beauftragte neben denen nach ISichG § 7 Abs. 2; ihr Verhältnis ist nicht geregelt (Rest aus B-06). Zwei Entscheidungen bei E-35. [VK] Entscheidung → E-35, E-53, E-56.

**N-16 · Nr. 87 Art. 2** (N-C-07)

„vom 6. August 2024 (SächsGVBl. S. 771) in der jeweils geltenden Fassung ist bis zum 30. Juni 2027“ – im Mantelgesetz gehört zum Vollzitat die letzte Änderung (Artikel 1 der Verordnung vom 30. Januar 2026, OGVBl. 2026 Nr. 12); die Dynamisierungsformel ist für Stammrecht bestimmt. [VK redaktionell] → E-40.

**N-17 · Nr. 88 Art. 1 § 1 Abs. 2 Nr. 1 (PolBeschStG)** (N-B-11, N-H-05)

„sowie der obersten Polizeibehörde, soweit sie dort Aufgaben der Volkspolizei wahrnehmen,“ – „Volkspolizei“ ist nach Nr. 85 die Gesamtheit der Dienststellen nach VPOG § 2 Abs. 2; die oberste Polizeibehörde nimmt deren Aufgaben wörtlich kaum wahr. Beschäftigte, die dort die Grenzpolizei beaufsichtigen (PVDG § 101 Abs. 1 Satz 2 n. F.), sind keine Bediensteten: kein Eingaberecht mit Schutz (§ 8, § 15 Abs. 1 Satz 2), keine Untersuchung (§ 7, § 9 Abs. 1 Nr. 3), keine Auskunftspflicht (§ 11), keine Wählbarkeits- und Abordnungssperren (§ 3 Abs. 2 Satz 2, § 5 Abs. 3). Durch v2 entstanden. Abhilfe: Anknüpfung an die bearbeiteten Angelegenheiten (E-42 Variante A oder B), Ergänzung nur der Grenzpolizei (Variante C) oder keine Änderung (Variante D). [VK] [VL?] Entscheidung → E-42.

**N-18 · Nr. 88 Art. 1 § 2 Abs. 1 (PolBeschStG)** (N-B-06)

„Sie unterliegt keiner Fach- und keiner Rechtsaufsicht.“ steht als eigener Absatzblock ohne Absatzzahl zwischen Absatz 1 und 2 (HTML: zwei Absatzelemente); gemeint ist Satz 2 von Absatz 1. Seit v1. [VK redaktionell] → E-44.

**N-19 · Nr. 88 Art. 1 § 5 Abs. 2 Satz 3 und § 16 Abs. 1 Satz 2 (PolBeschStG)** (N-B-01)

„Die Beschwerdestelle soll über Bedienstete mit Befähigung zum Richteramt“ und „Werden Bedienstete als Ermittlungspersonen tätig“ – „Bedienstete“ sind nach § 1 Abs. 2 die Beschäftigten der Polizei; gemeint ist das eigene Personal der Beschwerdestelle. Wörtlich sinnwidrig, aber vollziehbar; mit § 5 Abs. 3 vereinbar. Seit v1. [VK redaktionell] → E-45, E-47.

**N-20 · Nr. 88 Art. 1 § 10 Abs. 1 Satz 1 (PolBeschStG)** (N-B-02)

„(1) Die Polizeidienststellen, die Kasernierte Grenzpolizei und die oberste Polizeibehörde haben die Beschwerdestelle zu unterstützen.“ – Die Hochschule der Volkspolizei (FH) ist nach § 1 Abs. 2 Nr. 1 einbezogen, aber nicht unterstützungspflichtig; Auskunft, Akteneinsicht und Zutritt sind ihr gegenüber nur über die Aufsicht der obersten Polizeibehörde durchsetzbar, die unter dem Vorbehalt des PolFHG steht. Seit v1. [VK] Entscheidung → E-46.

**N-21 · Nr. 88 Art. 4** (N-B-10)

„Dieses Gesetz tritt am ersten Tag des ersten Monats nach Verkündung in Kraft.“ – weder Kalenderdatum noch Standardformel; auch als Monatsfrist lesbar. Nach üblicher Lesart 1.12.2026 wie Nr. 85 und 86, deren Vorschriften das PolBeschStG voraussetzt; die Ersatzformeln sind ergebnisgleich. Seit v1. [VK redaktionell] → E-49.

**N-22 · Nr. 89 Inhaltsverzeichnis und Gesetzesüberschrift** (N-C-05)

Mantelgesetz und eingeführtes Stammgesetz heißen beide „Gesetz über die Digitalisierung der Volkspolizei des Freistaates Ostdeutschland“, bei gleichem Datum und gleicher Fundstelle. Zitate und „dieses Gesetz“ werden mehrdeutig; im Rechtsportal entstehen zwei gleichnamige Normen [TÜ]. Seit v1. Redaktionelle Wahl der Bezeichnung. [VK redaktionell] → E-50, E-51.

**N-23 · Nr. 89 Art. 1 Abschnitt 1 (PolDigG)** (N-C-03)

„Abschnitt 1“ ohne Überschrift; die Abschnitte 2 bis 4 tragen Überschriften. Seit v1. [VK redaktionell] → E-52.

**N-24 · Nr. 89 Art. 1 § 2 Abs. 4 Satz 1, 2, 4 und 5 (PolDigG)** (N-C-01, N-H-03; Satz 2 Rest von G-6)

Satz 1 erstreckt § 12 vollständig, also auch die Bestellung durch das Polizeiverwaltungsamt (§ 12 Abs. 2 Satz 1); Satz 4 lässt die Leitung der Grenzpolizei bestellen, Satz 5 wiederholt eine schon geltende Verweisung; Satz 4 enthält die Paarform „eine Informationssicherheitsbeauftragte oder einen Informationssicherheitsbeauftragten“. Satz 2 („§ 11 Absatz 2 gilt für diese Systeme nur, soweit sie eine Online-Wache betreibt.“) knüpft an einen Begriff an, den § 1 Nr. 4 als Zugangsportal der Volkspolizei definiert; nach dem Wortlaut kann die Grenzpolizei keine Online-Wache betreiben. „soweit sie eine Online-Wache betreibt“ bezieht sich auf die in Satz 1 genannte Kasernierte Grenzpolizei; der Mangel liegt im Begriff. Durch v2 entstanden. Einordnung: Satz 2 [VK], die übrigen Sätze [VK redaktionell] → E-53.

**N-25 · Nr. 89 Art. 1 § 2 Abs. 4 Satz 3 (PolDigG)** (N-C-02)

„treten für die Kasernierte Grenzpolizei die von ihr für entsprechende Zwecke eingesetzten Systeme an deren Stelle“ – „deren“ kann sich auf die Grenzpolizei, die Zwecke oder die Systeme nach Abschnitt 2 beziehen; die Grenzpolizei ist doppelt genannt. Durch v2 entstanden. [VK redaktionell] → E-53.

**N-26 · Nr. 89 Art. 1 § 14 (PolDigG)** (N-C-04)

„das Rollen- und Berechtigungskonzept nach § 10 Absatz 1 in seinen Grundzügen zu regeln.“ – die gemeinsame Schlusswendung steht im letzten Listenpunkt, die Nummern 1 bis 3 bleiben ohne Verb; vor der letzten Nummer fehlt „und“. Gleicher Mangel wie VPOG § 16 Abs. 1 (B-12). Seit v1. [VK redaktionell] → E-57.

**N-27 · Nr. 90 Art. 1 § 1, § 8 Abs. 1 Satz 2, § 9 Abs. 2, § 10, § 11 Abs. 1, § 13 Satz 1 (Sicherheitsgesetz)** (N-D-05)

„das zuständige Mitglied des Staatsrates“ (viermal ohne Zusatz) ist nicht bestimmt; § 9 Abs. 2 unterscheidet es von „das fachlich zuständige Mitglied des Staatsrates“ und setzt damit eine geschäftsbereichsübergreifende Krisenzuständigkeit voraus. § 8 Abs. 1 Satz 2 sagt „vom zuständigen Staatsrat aktiviert“, während „Staatsrat“ in § 3 Abs. 1, § 3 Abs. 2 Satz 3 und § 12 Abs. 1 das Kollegialorgan bezeichnet. LfStErrG und OstSZG bestimmen das zuständige Mitglied ausdrücklich. Seit v1. [VK] Entscheidung → E-58, E-61.

**N-28 · Nr. 90 Art. 1 § 7 Abs. 1 Satz 1 (Sicherheitsgesetz)** (N-D-04)

„Das GLAZ Ost erstellt fortlaufend ein ,,Landeslagebild innere Sicherheit”.“ – öffnend zwei ASCII-Kommas, schließend das englische Zeichen U+201D. Seit v1. [VK redaktionell] → E-60.

**N-29 · Nr. 90 Art. 1 Abschnitt 5 (Sicherheitsgesetz)** (N-D-06)

„Berichte und Schlussbestimmungen“ – Abschnitt 5 enthält nur § 12 (Sicherheitsbericht) und § 13 (Unterrichtung); das Inkrafttreten steht im Mantelgesetz. Seit v1; geringe Priorität. [VK redaktionell] → E-63.

**N-30 · Nr. 91 Inhaltsverzeichnis, Gesetzesüberschrift, Art. 1 und 2** (N-D-01)

Der Gesamttitel lautet weiter „Gesetz zur Errichtung des Landesamtes für Staatsschutz des Freistaates Ostdeutschland (Staatsschutzamt-Errichtungsgesetz – LfStErrG)“; Artikel 1 heißt „Einführung eines Gesetzes zur Errichtung des Landesamtes für Staatsschutz des Freistaates Ostdeutschland“ und trägt keine Titelzeile des eingeführten Gesetzes. Kurzbezeichnung und Abkürzung bezeichnen damit das Mantelgesetz; die fünf Verweise auf das „Staatsschutzamt-Errichtungsgesetz“ in Nr. 90, 92 und 93 zielen genau genommen auf Artikel 1. [TÜ]: Artikelüberschrift und „Abschnitt 1“ stehen in einer Überschrift, der Parser legt das Stammgesetz nicht an. In v2 entstanden; alle anderen Einführungsblätter tragen einen eigenen Manteltitel. [VK redaktionell] [VL?] Entscheidung → E-66, E-64, E-65, E-76.

**N-31 · Nr. 91 Art. 1 § 3 Abs. 2 Nr. 2 (LfStErrG)** (N-D-03)

„für sonstige Überwachungsmaßnahmen, die einer Vorabanordnung bedürfen, von der Staatsschutzkommission nach dem Staatsschutz- und Nachrichtendienstgesetz,“ – die Kommission wird durch das OstSKG gebildet (dort §§ 9 bis 12), das OstSNDG spricht von der „vorherigen Anordnung durch die Staatsschutzkommission nach dem Staatsschutz-Kontrollgesetz“; „Vorabanordnung“ kommt nur hier vor. Vertretbar ist allenfalls die Lesart, die Anordnungspflicht beruhe auf dem OstSNDG; die Zuordnung der Kommission bleibt ungenau. Seit v1. [VK redaktionell] → E-67.

**N-32 · Nr. 92 Art. 1 vor § 1 (OstSNDG)** (N-E-06)

Auf die Titelzeile „Gesetz über den Staatsschutz und die nachrichtendienstliche Aufklärung im Freistaat Ostdeutschland (Staatsschutz- und Nachrichtendienstgesetz – OstSNDG)“ folgt unmittelbar „§ 1“; die erste Abschnittsüberschrift ist „Abschnitt 2“. Seit v1. [VK redaktionell] → E-77.

**N-33 · Nr. 92 Art. 1 § 1 Abs. 1 Nr. 1 bis 3 und § 8 Abs. 1 Nr. 4 (OstSNDG)** (N-E-08)

In § 1 Abs. 1 enden Nr. 1 bis 3 mit Semikolon („terroristische Bestrebungen;“), Nr. 4 und 5 mit Komma, Nr. 6 mit Punkt. § 8 Abs. 1 verknüpft die Ausschlussgründe nicht („deren Vollstreckung nicht länger als fünf Jahre zurückliegt,“), obwohl es dort auf alternative oder kumulative Lesart ankommt und v2 in § 18 ausdrücklich „oder“ gesetzt hat. Seit v1 (Indiz für Fassungsmischung, 1.4). [VK redaktionell] → E-78, E-79, E-80, E-90.

**N-34 · Nr. 92 Art. 1 § 1 Abs. 1 Nr. 3 (OstSNDG)** (N-E-03)

„Sabotage und Bestrebungen, die sich gegen kritische Infrastruktur richten;“ – Bestrebungen sind nach § 2 Abs. 1 Nr. 1 nur Verhaltensweisen, die auf ein Ziel nach § 1 Abs. 1 Nr. 4 bis 6 gerichtet sind; eigenständige Bestrebungen gegen kritische Infrastruktur sind nicht erfasst, obwohl § 5 Abs. 3 Satz 2, § 16 Abs. 1 Satz 2 und LfStErrG § 8 Abs. 1 Nr. 2 den Schutz kritischer Infrastruktur eigenständig behandeln. In der engen Lesart wirkt Nr. 3 insoweit nur noch auf die Löschfrist. Durch die v2-Korrektur des Selbstverweises deutlich geworden. [VK] Entscheidung → E-80.

**N-35 · Nr. 92 Art. 1 § 2 Abs. 1 Nr. 3 (OstSNDG)** (N-E-04)

„kritische Infrastruktur: Anlagen und Einrichtungen im Sinne des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland.“ – OstKRITISG § 2 Nr. 1 (Nr. 94) nennt „Anlagen, Einrichtungen und Systeme“; wahrscheinlich unbeabsichtigte Verengung. Hinweis: Nr. 90 Art. 1 § 1 Nr. 3 enthält dieselbe Begriffsbestimmung wortgleich; Ersatzformulierung in E-58. Seit v1. [VK] → E-85, E-58.

**N-36 · Nr. 92 Art. 1 § 3 Abs. 1 Satz 2 (OstSNDG)** (N-E-02)

„Das Landesamt darf die Polizei nicht im Wege der Amtshilfe um Maßnahmen ersuchen, zu denen es selbst nicht befugt ist.“ – Nach LfStErrG § 4 Abs. 4 Satz 2 ersucht das Landesamt für unmittelbaren Zwang „die Volkspolizei um Vollzugshilfe“; für die Vollzugshilfe gelten die Grundsätze der Amtshilfe (PVDG § 37 Abs. 3 Satz 2). Nr. 90 § 2 Abs. 2 enthält den Vorbehalt, das OstSNDG nicht. Seit v1. [VK] → E-86.

**N-37 · Nr. 92 Art. 1 §§ 4, 13, 16 bis 19 (OstSNDG); Nr. 93 Art. 1 § 1, § 5 Abs. 1 Nr. 2 (OstSKG)** (N-E-07)

v2 ersetzt „Es“ durch „Das Landesamt“, obwohl § 1 Abs. 3 n. F. „Staatsschutz“ einführt; in Nr. 92 steht „Landesamt“ achtmal als nicht eingeführte Kurzform. Das OstSKG verwendet „Staatsschutz“ als Behörde ohne Begriffsbestimmung (die des OstSNDG gilt nur „im Sinne dieses Gesetzes“) und einmal „Zutritt zu sämtlichen Dienststellen des Landesamtes zu gewähren und“. Teils durch v2 entstanden. [VK redaktionell] → E-88, E-93, E-94, E-96, E-98, E-99, E-101, E-103; enthalten in E-86 und E-91.

**N-38 · Nr. 92 Art. 1 § 5 Abs. 3 Nr. 4 (OstSNDG)** (N-E-01)

„der Einsatz von Vertrauenspersonen und verdeckt arbeitenden Bediensteten nach § 8. Sie dürfen nur eingesetzt werden“ – Einsatzschwelle und Adressatenbeschränkung stehen im Listeneintrag Nummer 4 (HTML: dasselbe Listenelement) und gelten nach der Gliederung nur für Vertrauenspersonen und verdeckt arbeitende Bedienstete; längerfristige Observation, Standortermittlung und Abhören (Nr. 1 bis 3) hätten keine Schwelle über § 5 Abs. 1 hinaus. § 7 Abs. 1 und § 10 Abs. 2 setzen eine allgemeine Schwelle voraus. Seit v1. [VK] → E-89.

**N-39 · Nr. 92 Art. 1 § 15 Abs. 2 (OstSNDG); Nr. 93 Art. 1 § 6 Abs. 1 und 2, § 9 Abs. 1 und 2, § 12 Abs. 1 (OstSKG)** (N-E-09)

„Sie / er muss die Befähigung zum Richteramt besitzen“, „aus einer / einem Vorsitzenden“, „Eilentscheidungen kann die/der Vorsitzende allein treffen“ – Schrägstrichformen neben der Doppelpunktschreibweise derselben Gesetze („ein:e ständige:r Bevollmächtigte:r“, „Richter:in“). Seit v1; v2 hat in § 12 Abs. 1 nur die Leerzeichen entfernt. Paarformen bleiben unberührt. [VK redaktionell] → E-92, E-104 bis E-108.

**N-40 · Nr. 93 Art. 1 § 14 Satz 2 (OstSKG)** (N-E-05)

„Bis dahin nehmen die nach bisherigem Recht gewählten Mitglieder der Parlamentarischen Kontrollkommission und der G10-Kommission deren Aufgaben wahr.“ – „deren“ ordnet die alten Gremien den neuen nicht zu; die Mitglieder der Kommission nach dem OstAG G 10 werden bestellt, nicht gewählt; „G10-Kommission“ hat im Bestand 0 Treffer (dort „G 10-Kommission“). Nr. 99 Art. 4 Abs. 4 verweist für die Übergangszeit allein auf diese Vorschrift. Seit v1. [VK redaktionell] → E-109; zur Schreibweise in Nr. 99 E-142.

**N-41 · Nr. 94 Art. 1 § 1 Satz 1 (OstKRITISG)** (N-F-10)

„gelten für diese Anlage nur die §§ 4, 7, 8 und 14“ – der Tatbestand knüpft an die Gleichwertigkeit mit §§ 5 und 6 an, die Rechtsfolge lässt für bundesrechtlich erfasste Anlagen aber auch § 10 (Befugnisse), § 11 (Vertraulichkeit der Meldungen), § 13 (Bußgeld) und § 3 Abs. 3 entfallen. Die Pflichten nach §§ 4 und 7 bestünden ohne Durchsetzung, die Meldungen ohne Schutz. Seit v1. [VK] Klärung → E-110.

**N-42 · Nr. 94 Art. 1 § 5, § 6 Abs. 2, § 13 Abs. 1 Nr. 2; Art. 2 (OstKRITISG)** (N-F-01)

„entgegen § 5 oder § 6 Absatz 2 eine Risikoanalyse oder einen Resilienzplan nicht oder nicht rechtzeitig erstellt oder nicht vorlegt,“ – §§ 5 und 6 enthalten keine Frist; die Dauerregel („Im Übrigen gilt eine Frist von sechs Monaten nach der Bestimmung.“) steht nur im Mantelgesetz. Eine Vorlagepflicht besteht nur für die Risikoanalyse (§ 5 Abs. 2 Satz 2). Seit v1, im Bericht nicht erfasst. [VK] Entscheidung → E-112, E-111, E-115, E-118.

**N-43 · Nr. 94 Art. 1 § 13 Abs. 1 Nr. 3 (OstKRITISG)** (N-F-02)

„entgegen § 7 Absatz 1 eine Meldung nicht, nicht richtig oder nicht rechtzeitig macht,“ – vor der letzten Nummer fehlt „oder“, anders als in §§ 3, 6 und 9 desselben Gesetzes. Seit v1. [VK redaktionell] → E-116.

**N-44 · Nr. 94 Art. 3** (N-F-09)

„wird das Grundrecht der Unverletzlichkeit der Wohnung (Artikel 13 des Grundgesetzes) eingeschränkt“ – Art. 37 Abs. 1 Satz 2 der Landesverfassung verlangt die Nennung „unter Angabe des Artikels“; Art. 30 der Landesverfassung fehlt (vgl. OGVBl. 2026 Nr. 16, PVDG § 10 Nr. 6). Rein formal, ohne Bewertung des Eingriffs. Seit v1. [VK] formal → E-119.

**N-45 · Nr. 96 Inhaltsverzeichnis und Gesetzesüberschrift** (N-A1-05)

„zur Änderung des Polizeivollzugsdienstgesetzes zur Stärkung der Terrorismusabwehr“ (2 Treffer) – das geänderte Gesetz heißt „Ostdeutsches Polizeivollzugsdienstgesetz“, so auch die Überschrift von Art. 1; Präzedenzfall ist die Berichtigung von Nr. 24 durch OGVBl. 2026 Nr. 68. Seit v1. [VK redaktionell] → E-122, E-123.

**N-46 · Nr. 96 Art. 1 Nr. 2 (§ 15a Abs. 1 PVDG) und Nr. 4 (§ 46a Abs. 1 Nr. 3 PVDG)** (N-F-04)

„dass dort oder gegen die Anlage eine Straftat“ – „die Anlage“ hat kein Bezugswort (vorher „einen Verkehrsflughafen“ und „Anlagen und Einrichtungen“). In § 46a Abs. 1 fehlt vor Nr. 4 das „oder“: „Steuerungs-, Navigations- oder Datensignale zu stören oder zu unterbrechen,“. Seit v1. [VK redaktionell] → E-125, E-129.

**N-47 · Nr. 96 Art. 1 Nr. 4 (§ 46a Abs. 1 PVDG)** (N-F-03)

„für Anlagen und Einrichtungen nach § 15a Absatz 1“ – die v2-Korrektur übernimmt nur die zweite Gruppe des § 15a Abs. 1; Verkehrsflughäfen sind als solche nur noch Schutzgut, wenn sie die Ausfallschwelle erfüllen. Drohnenlagen an Flughäfen sind Anlass des Pakets (Sicherheitserlass KRITIS Nr. 4 und 5); Personen und Sachen von bedeutendem Wert bleiben geschützt. [VK] Klärung → E-128.

**N-48 · Nr. 96 Art. 2 und 3** (N-F-08)

Die neue „Übergangsbestimmung“ (Art. 3) steht hinter „Einschränkung von Grundrechten“ (Art. 2); üblich und in Nr. 94 umgesetzt ist die umgekehrte Folge. Kein Blatt verweist auf diese Artikel; geringe Priorität. Durch v2 entstanden. [TÜ] am Rande: Die Überschrift von Art. 3 ist im HTML als Absatz ausgezeichnet. [VK redaktionell] → E-132.

**N-49 · Nr. 97 Art. 1 § 9 (VTPG)** (N-F-05)

„Bereits durchgeführte Sicherheitsüberprüfungen müssen nicht ohne Anlass wiederholt werden.“ – das VTPG regelt keine Sicherheitsüberprüfungen und lässt das OstSÜG unberührt (§ 1 Abs. 2); Satz 2 ist als Abweichung vom OstSÜG, als Freistellung von der Anfrage oder als Klarstellung lesbar. Seit v1. [VK] Klärung → E-134.

**N-50 · Nr. 98 Art. 1 § 2 Abs. 1 (OstSZG)** (N-F-06, N-H-04)

„(1) Die beteiligten Behörden und die übrigen öffentlichen Stellen des Freistaates übermitteln dem Landesamt für Staatsschutz“ – nach dem neuen § 1 Abs. 4 ist das Landesamt selbst beteiligte Behörde und müsste an sich selbst übermitteln; § 1 Abs. 2 grenzt richtig ab („den übrigen beteiligten Behörden“). Durch v2 entstanden. Zwei Fassungen der Berichtigung (definierter Begriff oder Aufzählung); empfohlen ist Fassung A. [VK redaktionell] → E-135.

**N-51 · Nr. 98 Art. 2; Nr. 92 Art. 2** (N-F-07)

„Durch dieses Gesetz werden das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) und das Recht auf informationelle Selbstbestimmung eingeschränkt.“ – ohne Art. 27 Abs. 1 und Art. 33 der Landesverfassung (vgl. PVDG § 10 Nr. 3 und 7). Derselbe Mangel besteht in Nr. 92 Art. 2 („Durch dieses Gesetz werden das Brief-, Post- und Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) und das Recht auf informationelle Selbstbestimmung eingeschränkt.“). Rein formal, ohne Bewertung des Eingriffs. [VK] formal → E-136, E-99a.

**N-52 · Nr. 99 Art. 2 (Überschrift) und Art. 3 Abs. 1 Nr. 4** (N-G-02; zu Nr. 4 auch N-E-05)

„Aufhebung des Ausführungsgesetzes zum Artikel-10-Gesetz“ – das Bundesgesetz heißt „Artikel 10-Gesetz“ (so Art. 4 Abs. 1 desselben Blatts und Nr. 91 bis 93); mit Bindestrichen richtig ist nur der Kurztitel des Landesgesetzes. „die G10-Kommission genannt ist“ – der Bestand schreibt „G 10-Kommission“ (Abgeordnetengesetz § 6), die Ersetzungsregel trifft wörtlich keine Fundstelle. Seit v1. [VK redaktionell] → E-138, E-142.

**N-53 · Nr. 99 Art. 3 Abs. 1 Nr. 2 und 3, Art. 4 Abs. 5** (N-G-04)

Die Erstnennungen von „Staatsschutz- und Nachrichtendienstgesetz“, „Staatsschutz-Kontrollgesetz“ und der fünf Vollzugsgesetze (Art. 4 Abs. 5, neu in v2: „§ 83 Absatz 3 des Ostdeutschen Strafvollzugsgesetzes“ usw.) stehen im Mantelgesetz ohne Datum, Fundstelle und Änderungsangabe. Bundesrecht zitiert das Paket durchgehend kurz; dafür kein Vorschlag. [VK redaktionell] → E-140, E-141, E-148.

**N-54 · Nr. 99 Art. 3 Abs. 1 im Verhältnis zu Nr. 91 Art. 1 § 12, Nr. 93 Art. 1 § 14 Satz 2 und Nr. 99 Art. 1, Art. 4 Abs. 3** (N-D-07, N-G-01)

„das Landesamt für Verfassungsschutz genannt ist, tritt an seine Stelle das Landesamt für Staatsschutz,“ – die Regel gilt ab 1.1.2027 ohne Ausnahme auch für die gleichzeitig in Kraft tretenden Übergangsvorschriften. Wörtlich angewandt ginge nach LfStErrG § 12 Abs. 1 („Das nach dem Ostdeutschen Verfassungsschutzgesetz bestehende Landesamt für Verfassungsschutz geht mit Inkrafttreten dieses Gesetzes im Landesamt für Staatsschutz auf.“) das Landesamt für Staatsschutz in sich selbst auf, und OstSKG § 14 Satz 2 liefe leer; nach Art. 3 Abs. 2 müsste die Redaktion das sogar textlich übernehmen. Durch die Gleichzeitigkeit in v2 verschärft. Die Ausnahme gehört als Satz 2 in Absatz 1; eine Datumsfassung von LfStErrG § 12 Abs. 1 ist nicht erforderlich. [VK] → E-143.

**N-55 · Nr. 99 Art. 3 Abs. 2** (N-G-03)

„(2) Die Redaktion des Ostdeutschen Gesetzes- und Verordnungsblattes ändert bei Neufassungen oder Änderungen eines Gesetzes von Amts wegen die in Absatz 1 genannten Bezeichnungen.“ – eine „Redaktion“ ist nirgends eingerichtet (Vorbild OGVBl. 2026 Nr. 22 Art. 1: „Schriftleitung“, ausdrücklich „ermächtigt“); offen bleibt, ob der amtliche Wortlaut oder eine Lesefassung geändert wird; erfasst sind nur Gesetze, Absatz 1 auch Verordnungen und Verwaltungsvorschriften; das Blatt heißt nach BeVerKüGe § 1 „Gesetz- und Verordnungsblatt für den Freistaat Ostdeutschland“. Absatz 1 wirkt ohnehin kraft Gesetzes. Seit v1 (dort Hinweis in B-30). [VK] Entscheidung → E-144, E-139.

**N-56 · Nr. 91 Art. 1 § 13 (LfStErrG); Nr. 96 Art. 2** (Nachtrag der Schlussprüfung)

„Durch dieses Gesetz werden die Grundrechte auf körperliche Unversehrtheit und Freiheit der Person (Artikel 2 Absatz 2 des Grundgesetzes), des Brief-, Post- und Fernmeldegeheimnisses (Artikel 10 des Grundgesetzes), auf Unverletzlichkeit der Wohnung (Artikel 13 des Grundgesetzes) und auf Eigentum (Artikel 14 des Grundgesetzes) eingeschränkt.“ und „Durch Artikel 1 werden die Grundrechte der körperlichen Unversehrtheit und der Freiheit der Person (Artikel 2 Absatz 2 Satz 1 und 2 des Grundgesetzes), der Freizügigkeit (Artikel 11 des Grundgesetzes) und das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) eingeschränkt.“ – derselbe Formmangel wie N-44 und N-51: Art. 37 Abs. 1 Satz 2 der Landesverfassung („Außerdem muss das Gesetz das Grundrecht unter Angabe des Artikels nennen.“) verlangt die Nennung des Landesgrundrechts; genannt sind nur Artikel des Grundgesetzes. Die Landesverfassung schützt die betroffenen Rechte in Art. 16 Abs. 1, Art. 27 Abs. 1, Art. 30 Abs. 1 und Art. 31; ein Landesgrundrecht der Freizügigkeit enthält sie nicht (so auch PVDG § 10 Nr. 4, nur Art. 11 GG). Seit v1. Rein formal, ohne Bewertung der Eingriffe und ohne Aussage, ob das Zitiergebot für das Eigentum überhaupt gilt; die Ergänzung folgt nur der Nennung im Blatt. [VK] formal → E-76a, E-132a.

### 8.5 Kasernierte Grenzpolizei nach der neuen Fassung

Spalte „Bewertung v1“ nach Tabelle 4.2 (**weiter**, **neu**, **teilw.**, **voll**, **unklar**, **nicht**); Spalte „Status v2“ nach dem Schema dieses Abschnitts.

| G | Zusammenhang | Bewertung v1 | neue Fassung (14.11. / 1.12.2026 / 1.1.2027) | Status v2 | verbleibende Folge | Ersatz |
| --- | --- | --- | --- | --- | --- | --- |
| G-1 | Behördenstellung im Polizeivollzugsdienst | **unklar** | 14.11.: Fiktion Nr. 96 Art. 3 für §§ 15a, 20a, 46a. 1.12.: PVDG § 1 Satz 3 rechnet nur die Dienststellen nach VPOG § 2 Abs. 2 zur Volkspolizei; § 97 Abs. 1 Satz 1 n. F. nennt daneben „die Kasernierte Grenzpolizei“; Satz 3 „Für die Kasernierte Grenzpolizei gilt § 100a.“ Die übrigen Blätter nennen die Grenzpolizei widerspruchsfrei neben der Volkspolizei. | behoben | Keine Auslegungsfrage mehr; redaktionell fehlendes Anführungszeichen (N-01) und Befehlsform zu § 97 (N-13). [TÜ] § 100a fehlt im technischen Bestand (T-2). | E-02, E-31 |
| G-2 | Aufgaben, räumliche Zuständigkeit | **teilw.** (örtlich) / **unklar** (Konkurrenz) | PVDG § 103 erfasst die Grenzpolizei über § 97 Abs. 1 n. F. wieder. VPOG § 7 Abs. 1 Satz 2: „Die Aufgaben und Zuständigkeiten der Kasernierten Grenzpolizei nach dem Kasernierte-Grenzpolizei-Gesetz bleiben unberührt.“ – bewusst gleichrangig statt Vorrangregel aus K-01; Abstimmung über KGrPolG § 12 Abs. 1 und PolOrgVO § 7 Abs. 2. | teilweise behoben | Küsten- und Wasserschutz bleibt nachrangig: KGrPolG § 9 Abs. 2 „soweit nicht eine andere Polizeidienststelle zuständig ist“ gegenüber PolOrgVO § 5 Abs. 3; VPOG § 17 Abs. 2 Satz 3 lässt die Subsidiaritätsklausel bestehen [VB]. | E-37 |
| G-3 | Befugnisse, Anordnungen, Freigaben | Befugnisse **weiter**, Anordnungs- und Freigabebefugnisse **teilw.** | §§ 15a, 20a und 46a erfassen die Grenzpolizei (bis 30.11. über Nr. 96 Art. 3, ab 1.12. über § 97 Abs. 1 n. F.), § 73 Abs. 1 Nr. 1 erst ab 1.12. über § 97 Abs. 1 n. F. (bis 30.11. mehrdeutig, B-04). § 46 Abs. 1 unverändert ohne Freigabeinstanz; § 46a Abs. 3 unverändert; Anordnungsvorbehalte unverändert [VB]. | teilweise behoben | Besondere Waffen sind für Einsätze der Grenzpolizei nicht freigebbar; Anordnungen nach §§ 21, 27, 58 bis 61, 63, 65, 71 Abs. 4 und 73 Abs. 2, auch bei der Kernaufgabe § 59, kann die Leitung der Grenzpolizei nicht treffen. | E-03, E-04, E-30, E-32, E-130 |
| G-4 | Leitung und Aufsicht | **weiter** / **teilw.** | PVDG § 101 Abs. 1 n. F.: „Die Dienst- und Fachaufsicht über die Kasernierte Grenzpolizei übt die oberste Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes aus.“, Satz 3 erstreckt VPOG § 3 Abs. 2; Abs. 2 und 4 über § 97 Abs. 1 n. F.; Abs. 3 aufgehoben; LfStErrG § 5 Abs. 4 Satz 3. | behoben | Die neu einbezogene LKA-Fachaufsicht über die kriminalpolizeiliche Tätigkeit steht neben Weisungen des Bundes nach dem Verwaltungsabkommen; bewusst bestätigen [VL?]. Die ersatzlos entfallene Unterstellungs- und Eilbefugnis (§ 99 Abs. 2 und 3 a. F.) ist unter B-08 (b) als offen geführt; ob sie die Grenzpolizei erfasst, entscheidet die Volkskammer bei E-33. | E-33 |
| G-5 | Zusammenarbeit mit anderen Polizeibehörden und dem Bund | gemischt (**neu** / **nicht** / **unklar**) | VPOG § 4 Abs. 2 („insbesondere“) und Abs. 3 Satz 2; OstKRITISG § 7 Abs. 2 Satz 2 (K-10 Nr. 4 umgesetzt); OstLVSG § 2 und § 3 Abs. 1 Satz 2; PVDG § 102 über § 97 Abs. 1 n. F.; Sicherheitsgesetz § 1 Nr. 1, § 5 Abs. 2. | behoben | Nur redaktionell: Bezeichnung des KGrPolG in VPOG § 6 Satz 2 (N-06). | E-15 |
| G-6 | Datenverarbeitung und Informationsaustausch | gemischt | OstSZG § 1 Abs. 4, § 2 Abs. 3, § 3 Satz 2 (K-11 umgesetzt); PolDigG § 2 Abs. 4 erstreckt §§ 9 bis 12 und § 15 Abs. 3 (K-18 durch eigene Fassung überholt). | teilweise behoben | § 11 Abs. 2 PolDigG erfasst nach dem Wortlaut kein Zugangsportal der Grenzpolizei, weil die Online-Wache nach § 1 Nr. 4 nur das Portal der Volkspolizei ist [VK]; Selbstübermittlung in OstSZG § 2 Abs. 1 (N-50); zweite Beauftragte neben ISichG § 7 Abs. 2 (N-15). Der OstSZG-Teil (B-33) ist behoben. | E-53, E-56, E-135 |
| G-7 | Kontrolle, Beschwerde, Kennzeichnung | **weiter** / **unklar** | VPOG § 13 Abs. 4 („Die Absätze 1 bis 3 gelten für die Polizeivollzugsbediensteten der Kasernierten Grenzpolizei entsprechend.“); PolBeschStG § 1 Abs. 2 Nr. 2, § 9 Abs. 1, § 10 Abs. 1, § 18 Abs. 1 und 2; Art. 3 Abs. 4. | behoben | Bedienstete der obersten Polizeibehörde mit Aufgaben gegenüber der Grenzpolizei sind keine Bediensteten nach dem PolBeschStG (N-17); Verweis in § 13 Abs. 4 Satz 3 ungenau (N-07). | E-42, E-18 |
| G-8 | Ausbildung, Fortbildung, Personal | gemischt | PolFHG § 22b Abs. 1, § 22c, § 22d Abs. 2 nennen die Grenzpolizei (K-17 wörtlich umgesetzt); VTPG § 1 Abs. 1 unverändert. | behoben | Stichtag in Nr. 87 Art. 3 Abs. 2 (B-13) betrifft beide Polizeien gleich. | E-41 |
| G-9 | Staatsschutz und Sicherheitsarchitektur | **weiter** | LfStErrG gilt ab 1.1.2027 wie OstSNDG und OstSKG; „Verfassungsschutzbehörde“ in KGrPolG § 12 Abs. 1 lückenlos besetzt; § 5 Abs. 4 Satz 3 „Die Kasernierte Grenzpolizei ist von Absatz 2 ausgenommen.“ | gegenstandslos (kein Mangel) | keine; zu LfStErrG § 6 Abs. 1 siehe B-21: E-69 Variante A nennt die Grenzpolizei ausdrücklich und gilt deshalb in beiden Lesarten. | – |
| G-10 | Verfahren und Übergang | **unklar** | VPOG § 17 Abs. 2: Fortgeltung der PolOrgVO; „Die §§ 2, 3, 9 und 13 des Kasernierte-Grenzpolizei-Gesetzes bleiben unberührt.“; VPOG § 16 Abs. 1 Nr. 1 und 4 auf Dienststellen nach § 2 Abs. 2 beschränkt. | behoben | Rest zur Polizeiorganisationsverordnung unter B-07 (teilweise behoben): Satz 2 von § 17 Abs. 2 trifft den Verordnungstext nicht, Autobahnzuständigkeiten offen; Wasserschutz siehe G-2. | E-25 |

**Zusammenfassung:** Nach der Fassung v2 ist die Grenzpolizei ab 1.12.2026 ausdrücklich Polizeidienststelle (PVDG § 97 Abs. 1 Satz 1 n. F.), aber nicht Teil der Volkspolizei (§ 1 Satz 3 n. F.); für den 14. bis 30.11.2026 sichert Nr. 96 Art. 3 nur die Anwendung der §§ 15a, 20a und 46a (B-04). Damit gelten für sie wieder die örtliche Zuständigkeit (§ 103), die Anordnungs- und Gerichtszuständigkeiten nach §§ 15a, 20a, 46a und 73 Abs. 1, Aufsicht, Weisungsfolge und LKA-Fachaufsicht (§ 101 n. F.) sowie die Zusammenarbeit (§ 102); neben den Bezirkspolizeidirektionen ist sie bewusst gleichrangig zuständig (VPOG § 7 Abs. 1 Satz 2). Ausdrücklich einbezogen ist sie nun in OstSZG, PolDigG, OstKRITISG § 7 Abs. 2, OstLVSG §§ 2 und 3, VPOG §§ 4, 6, 7, 13 und 17, PolFHG §§ 22b bis 22d, PolBeschStG, VTPG und Sicherheitsgesetz. Offen bleiben die Freigabeinstanz für besondere Waffen (§ 46 Abs. 1), § 46a Abs. 3 im Zuständigkeitsbereich der Bundespolizei, die Anordnungsvorbehalte nach §§ 21, 27, 58 bis 61, 63, 65, 71 und 73 [VB], der nachrangige Küsten- und Wasserschutz [VB], die Erfassung der Ministerialbediensteten durch die Beschwerdestelle (N-17) und die Löschpflicht des § 11 Abs. 2 PolDigG für ein Zugangsportal der Grenzpolizei. Teilweise behoben sind damit G-2, G-3 und G-6. Zu entscheiden ist außerdem, ob PVDG § 97 Abs. 3 und 4 neben VPOG § 7 Abs. 2 bestehen bleiben (E-31).

### 8.6 Ersatzformulierungen zum Einfügen

Gliederungsnummern und -buchstaben der Blätter (z. B. „2.“, „b)“ vor einem Änderungsbefehl oder Listeneintrag) erzeugt das HTML automatisch; im Klartext fehlen sie. In den Bisher-Zitaten und Ersatzformulierungen stehen sie nur zur Orientierung und werden nicht mitkopiert; ersetzt wird der Text nach der Nummer. Nummern innerhalb eines in Anführungszeichen stehenden neuen Wortlauts (z. B. „5. die Kasernierte Grenzpolizei und“ in E-131) gehören zum Text. Eine Gliederungsnummer ist nur dort von Hand zu setzen, wo der Eintrag es ausdrücklich sagt (Nr. 96 Art. 1, dessen Nummern 3 und 4 von Hand gesetzt sind; E-131). Jeder Bisher-Wortlaut steht im angegebenen Blatt genau einmal, mehrzeilige als zusammenhängender Text, soweit der Eintrag nichts anderes angibt (geprüft für alle Einträge). Varianten mit mehreren Fundstellen sind je Fundstelle als eigener Eintrag geführt; die Entscheidung steht beim jeweils genannten Haupteintrag. Trefferzahlen für Änderungsbefehle an geltendem Recht beziehen sich auf die Zielfassung am Wirksamkeitstag, bei Berichtigungen des Blatts selbst auf das vorbereitete Blatt.

#### OGVBl. 2026 Nr. 85

**E-01 · OGVBl. 2026 Nr. 85, Artikel 1, Eingangssatz (zu B-10) · [VK redaktionell]**

Bisher:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), zuletzt geändert durch Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 46 S. 2), wird wie folgt geändert:

Variante A:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 96 S. 2) geändert worden ist, wird wie folgt geändert:

Variante B:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 2 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 50 S. 2) geändert worden ist, wird wie folgt geändert:

Entscheidung der Volkskammer: Das Zitierprinzip aller Eingangsformeln ist einheitlich festzulegen (Redaktion oder Volkskammer). Variante A zitiert die letzte am Wirksamkeitstag wirksame Änderung (Linie des Berichts v1, B-10); Nr. 85, 86 und 88 zitieren dann das später nummerierte, gleichtägig verkündete Blatt Nr. 96. Variante B zitiert die letzte vor dem jeweiligen Blatt verkündete Änderung (Regel des Handbuchs der Rechtsförmlichkeit). Die Wahl gilt zugleich für E-28, E-48 und E-124; für E-06 und E-39 führen beide Maßstäbe zum selben Ergebnis.

Hinweis: Nr. 50 beginnt laut Inhaltsverzeichnis auf Seite 2. Die Ausführbarkeit der Befehle ist nicht berührt.

**E-02 · OGVBl. 2026 Nr. 85, Artikel 1 Nummer 1 (zu N-01) · [VK redaktionell]**

Bisher:

> Dem § 1 wird folgender Satz angefügt:
>
> Die Polizeidienststellen nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes führen die amtliche Bezeichnung ‚Volkspolizei des Freistaates Ostdeutschland‘ (Volkspolizei).“

Ersatzformulierung:

> 1. Dem § 1 wird folgender Satz angefügt:
>
> „Die Polizeidienststellen nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes führen die amtliche Bezeichnung ‚Volkspolizei des Freistaates Ostdeutschland‘ (Volkspolizei).“

Hinweis: § 1 PVDG hat einen Absatz mit zwei Sätzen (Fassung 1.8.2026, von Nr. 96 nicht berührt); der angefügte Satz wird Satz 3.

**E-03 · OGVBl. 2026 Nr. 85, Artikel 1 Nummer 2 (§ 46 Absatz 1 PVDG) (zu B-02, G-3) · [VK]**

Bisher:

> In § 46 Absatz 1 werden die Wörter „des Landespolizeipräsidenten oder seines Vertreters im Amt“ durch die Wörter „des/der Volkspolizeipräsident:in oder deren Vertretung im Amt“ ersetzt.

Variante A:

> 2. In § 46 Absatz 1 werden die Wörter „des Landespolizeipräsidenten oder seines Vertreters im Amt“ durch die Wörter „der Leitung der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes oder ihrer Vertretung im Amt“ ersetzt.

Variante B:

> 2. In § 46 Absatz 1 werden die Wörter „des Landespolizeipräsidenten oder seines Vertreters im Amt“ durch die Wörter „der Volkspolizeipräsident:in oder ihrer Vertretung im Amt, bei Einsätzen der Kasernierten Grenzpolizei der Leitung der Kasernierten Grenzpolizei oder ihrer Vertretung im Amt,“ ersetzt.

Variante C – Streichen: Die gesamte Nummer 2 (Bisher-Wortlaut) entfällt; § 46 Absatz 1 PVDG behält die Freigabe „des Landespolizeipräsidenten oder seines Vertreters im Amt“.

Entscheidung der Volkskammer: Wer gibt besondere Waffen frei? Variante A: die Leitung der obersten Polizeibehörde für Volkspolizei und Grenzpolizei; die Freigabe liegt auf der politischen Leitungsebene, die Funktionsbezeichnung entspricht Nr. 85 Art. 2 Nr. 3. Variante B: ein eigenes Amt Volkspolizeipräsident:in in der obersten Polizeibehörde, für Einsätze der Grenzpolizei deren Leitung; nur zusammen mit E-13, dazu Besoldungsamt (E-36), wahlweise Verwaltungsvorschriften (E-27) und Beiratssitz (E-07 Variante A). Variante C: Das Amt des Landespolizeipräsidenten besteht als Abteilungsleitung fort und behält die Freigabe; dazu E-07 Variante D, ohne E-13, E-27 und E-36. Soll die Grenzpolizei bei Variante A oder C eine eigene Freigabeinstanz erhalten, kommt E-04 hinzu (bei Variante C eingefügt nach Nummer 1); bei Variante B ist E-04 entbehrlich.

Hinweis: Zieltext „des Landespolizeipräsidenten oder seines Vertreters im Amt“ in § 46 Abs. 1 (Fassung 1.12.2026) 1 Treffer; Nr. 96, 86 und 88 berühren § 46 nicht. Ergebnis bei Variante A: „und nur nach Freigabe der Leitung der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes oder ihrer Vertretung im Amt gebraucht werden, wenn“. Die Leitung der Grenzpolizei ist nach KGrPolG § 5 Abs. 1 eine „Präsident:in“; „Leitung der Kasernierten Grenzpolizei“ entspricht VPOG § 13 Abs. 4.

**E-04 · OGVBl. 2026 Nr. 85, Artikel 1, neue Nummer 3 nach Nummer 2 (§ 46 Absatz 1 Satz 2 PVDG) (zu G-3, B-02) · [VK]**

Bisher (Einfügestelle):

> In § 46 Absatz 1 werden die Wörter „des Landespolizeipräsidenten oder seines Vertreters im Amt“ durch die Wörter „des/der Volkspolizeipräsident:in oder deren Vertretung im Amt“ ersetzt.

Einfügen nach Nummer 2:

> Dem § 46 Absatz 1 wird folgender Satz angefügt:
>
> „Beim Einsatz der Kasernierten Grenzpolizei tritt an die Stelle der Freigabe nach Satz 1 die Freigabe durch die Leitung der Kasernierten Grenzpolizei oder ihre Vertretung im Amt.“

Hinweis: Entscheidung bei E-03. Nummer 2 bleibt in der nach E-03 gewählten Fassung; bei E-03 Variante C entfällt Nummer 2, und diese Nummer wird nach Nummer 1 eingefügt. § 46 Abs. 1 hat einen Satz mit Nummern 1 und 2; der neue Satz wird Satz 2. Werden E-04 und E-05 übernommen, steht diese Nummer (§ 46) vor der Nummer aus E-05 (§ 80). Die Liste wird automatisch nummeriert.

**E-05 · OGVBl. 2026 Nr. 85, Artikel 1, neue Nummer 3 nach Nummer 2 (§ 80 Absatz 6 PVDG) (zu N-02) · [VK]**

Bisher (Einfügestelle):

> 2. In § 46 Absatz 1 werden die Wörter „des Landespolizeipräsidenten oder seines Vertreters im Amt“ durch die Wörter „des/der Volkspolizeipräsident:in oder deren Vertretung im Amt“ ersetzt.

Einfügen nach Nummer 2:

> 3. In § 80 Absatz 6 werden die Wörter „Hochschule der Ostdeutschen Polizei (FH)“ durch die Wörter „Hochschule der Volkspolizei (FH)“ ersetzt.

Hinweis: Treffer im PVDG am 1.12.2026 (Fassung 1.8.2026; Nr. 96, 86 und 88 berühren § 80 nicht): 1, nur § 80 Abs. 6 (ein Satz). Wird Nummer 2 nach E-03 neu gefasst, steht diese Nummer unverändert danach; bei Übernahme von E-04 steht sie nach dieser. Entfällt Nummer 2 (E-03 Variante C), wird diese Nummer nach Nummer 1 eingefügt, bei Übernahme von E-04 nach der Nummer aus E-04.

**E-06 · OGVBl. 2026 Nr. 85, Artikel 2, Eingangssatz (zu B-10, N-14) · [VK redaktionell]**

Bisher:

> Das Ostdeutsche Polizeifachhochschulgesetz vom 21. Dezember 2021 (SächsGVBl. 2022 S. 2), zuletzt geändert durch Artikel 7 des Gesetzes vom 31. Mai 2023 (SächsGVBl. S. 329), wird wie folgt geändert:

Ersatzformulierung:

> Das Ostdeutsche Polizeifachhochschulgesetz vom 21. Dezember 2021 (SächsGVBl. 2022 S. 2), das zuletzt durch Artikel 7 des Gesetzes vom 31. Mai 2023 (SächsGVBl. S. 329) geändert worden ist, wird wie folgt geändert:

Hinweis: Nur Vereinheitlichung der Form (Relativsatz statt Partizip), nach beiden Zitiermaßstäben richtig: Das PolFHG ist seit 2023 nicht geändert, Nr. 87 wirkt erst ab 1.1.2027. Wortgleich mit der gespeicherten Zitierung.

**E-07 · OGVBl. 2026 Nr. 85, Artikel 2 Nummer 3 (§ 16 Absatz 2 PolFHG) (zu N-03, B-06) · [VK]**

Bisher:

> 3. In § 16 Absatz 2 Nummer 2 werden die Wörter „die Landespolizeipräsidentin oder der Landespolizeipräsident“ durch die Wörter „die Leitung der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes oder eine von ihr benannte Vertretung“ ersetzt.

Variante A:

> 3. In § 16 Absatz 2 Satz 1 Nummer 2 werden die Wörter „die Landespolizeipräsidentin oder der Landespolizeipräsident“ durch die Wörter „die Volkspolizeipräsident:in“ ersetzt.

Variante B:

> 3. § 16 Absatz 2 wird wie folgt geändert:
>
> a) Satz 1 Nummer 2 wird aufgehoben.
>
> b) In Satz 2 wird die Angabe „Nummer 1 bis 3 und 5“ durch die Angabe „Nummer 1, 3 und 5“ ersetzt.

Variante C:

> 3. § 16 Absatz 2 wird wie folgt geändert:
>
> a) In Satz 1 Nummer 2 werden die Wörter „die Landespolizeipräsidentin oder der Landespolizeipräsident“ durch die Wörter „die Leitung der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes oder eine von ihr benannte Vertretung“ ersetzt.
>
> b) Satz 2 wird wie folgt gefasst:
>
> „Die Mitglieder nach Satz 1 Nummer 1, 3 und 5 sind kraft Amtes für die Dauer ihres Hauptamtes bestimmt; das Mitglied nach Satz 1 Nummer 2 ist kraft Amtes oder, wenn die Leitung der obersten Polizeibehörde eine Vertretung benennt, bis zum Widerruf der Benennung bestimmt.“

Variante D – Streichen: Die gesamte Nummer 3 (Bisher-Wortlaut) entfällt; Artikel 2 besteht dann aus den Nummern 1 und 2, § 16 PolFHG bleibt unverändert.

Entscheidung der Volkskammer: Die Wahl hängt an E-03 und B-06. Variante A, wenn ein Amt Volkspolizeipräsident:in geschaffen wird (E-03 Variante B). Ohne eigenes Amt: Variante B streicht den Sitz, weil die Leitung schon über Nummer 1 vertreten ist; Variante C behält die v2-Fassung bei und passt Satz 2 an, wenn die Leitung eine Vertretung entsenden soll (die Doppelbenennung neben Nummer 1 bleibt dann bewusst bestehen); Variante D, wenn das Amt des Landespolizeipräsidenten unverändert fortbesteht und im Beirat bleiben soll (E-03 Variante C).

Hinweis: Zieltexte je 1 Treffer; „Nummer 1 bis 3 und 5“ steht nur in Satz 2, Satz 3 und 4 nennen Nummer 2 nicht. Bei Variante B erscheint Nummer 2 als „(weggefallen)“. Variante D setzt voraus, dass auch § 46 Abs. 1 PVDG beim Landespolizeipräsidenten bleibt; Variante D nur zusammen mit E-03 Variante C.

**E-08 · OGVBl. 2026 Nr. 85, Artikel 3 Nummer 1 (zu N-04) · [VK redaktionell]**

Bisher:

> 1. In der Bezeichnung werden die Wörter „Verordnung des Ostdeutschen Staatsministeriums des Innern über die Bezeichnung der Hochschulgrade an der Hochschule der Ostdeutschen Polizei (FH)“ durch die Wörter „Verordnung über die Bezeichnung der Hochschulgrade an der Hochschule der Volkspolizei (FH)“ ersetzt.

Ersatzformulierung:

> 1. Die Bezeichnung wird wie folgt gefasst:
>
> „Verordnung über die Bezeichnung der Hochschulgrade an der Hochschule der Volkspolizei (FH)“.

Hinweis: Bezeichnung 1 Treffer; die Verordnung ist seit 2009 unverändert.

**E-09 · OGVBl. 2026 Nr. 85, nach Artikel 3, neuer Artikel 4 „Anpassung von Bezeichnungen“ (zu N-02) · [VK]**

Bisher (Einfügestelle, letzte Nummer von Artikel 3):

> 2. In § 1 Absatz 1 werden die Wörter „Hochschule der Ostdeutschen Polizei (FH)“ durch die Wörter „Hochschule der Volkspolizei (FH)“ ersetzt.

Einfügen nach Artikel 3:

> Artikel 4
>
> Anpassung von Bezeichnungen
>
> Soweit in Gesetzen, Rechtsverordnungen und Verwaltungsvorschriften des Freistaates Ostdeutschland die Hochschule der Ostdeutschen Polizei (FH) genannt ist, tritt an ihre Stelle die Hochschule der Volkspolizei (FH).

Hinweis: Stil wie Nr. 99 Art. 3 Abs. 1. Statt der Klausel kann die Volkskammer jedes betroffene Gesetz einzeln ändern; das ist eine Frage der Technik, nicht des Inhalts. Folgeeinträge: E-10 (dann Artikel 5) und E-11.

**E-10 · OGVBl. 2026 Nr. 85, nach Artikel 3 oder nach dem Artikel aus E-09, neuer Artikel „Rückkehr zum einheitlichen Verordnungsrang“ (zu N-04) · [VK redaktionell]**

Bisher (Einfügestelle):

> 2. In § 1 Absatz 1 werden die Wörter „Hochschule der Ostdeutschen Polizei (FH)“ durch die Wörter „Hochschule der Volkspolizei (FH)“ ersetzt.

Einfügen nach Artikel 3:

> Artikel 4
>
> Rückkehr zum einheitlichen Verordnungsrang
>
> Die auf Artikel 3 beruhenden Teile der Verordnung über die Bezeichnung der Hochschulgrade an der Hochschule der Volkspolizei (FH) können auf Grund der jeweils einschlägigen Ermächtigung durch Rechtsverordnung geändert werden.

Hinweis: Wird zugleich E-09 übernommen, steht dieser Artikel nach dem Artikel „Anpassung von Bezeichnungen“ und trägt die Bezeichnung „Artikel 5“. Vorbilder im Bestand: einfg-ostuvpg Art. 9, g-zur-aend-ostdeutscher-rechtsvorschriften Art. 8.

**E-11 · OGVBl. 2026 Nr. 85, bisheriger Artikel 4 (Überschrift) (zu N-02, N-04) · [VK redaktionell]**

Bisher:

> Artikel 4
>
> Inkrafttreten

Ersatzformulierung, wenn nur E-09 oder nur E-10 übernommen wird:

> Artikel 5
>
> Inkrafttreten

Ersatzformulierung, wenn E-09 und E-10 übernommen werden:

> Artikel 6
>
> Inkrafttreten

Hinweis: Im Blatt verweist nichts auf die Artikelnummer des Inkrafttretens.

#### OGVBl. 2026 Nr. 86

**E-12 · OGVBl. 2026 Nr. 86, Artikel 1 § 2 Absatz 1 VPOG (zu N-05) · [VK redaktionell]**

Bisher:

> (1) Das für die Volkspolizei und die Kasernierte Grenzpolizei zuständige Staatssekretariat ist oberste Polizeibehörde im Sinne dieses Gesetzes und des Ostdeutschen Polizeivollzugsdienstgesetzes.

Variante A:

> (1) Das für die Volkspolizei und die Kasernierte Grenzpolizei zuständige Staatssekretariat ist oberste Polizeibehörde im Sinne dieses Gesetzes und anderer Rechtsvorschriften des Freistaates Ostdeutschland.

Variante B: An dieser Stelle keine Änderung; stattdessen E-43 (Nr. 88).

Entscheidung der Volkskammer: Redaktionelle Wahl. Variante A erfasst PVDG, PolBeschStG und PolDigG ohne Einzelverweis. Variante B gilt nur für das PolBeschStG; PolDigG § 12 Abs. 2 und 4 bleiben dann ohne Verweis.

Hinweis: Das PVDG ist von „anderer Rechtsvorschriften“ umfasst; die ausdrücklichen Verweise in Nr. 85 Art. 2 Nr. 3 und Nr. 86 Art. 2 Nr. 4 und Art. 3 Abs. 3 bleiben richtig. Keine Kollision: Kein geltender Normtext verwendet den Begriff; die „obersten Landespolizeibehörden“ des Ostdeutschen Polizeibehördengesetzes sind ein anderer Begriff.

**E-13 · OGVBl. 2026 Nr. 86, Artikel 1 § 3 VPOG, neuer Absatz 3 nach Absatz 2 (zu B-02, nur bei E-03 Variante B) · [VK]**

Bisher (Einfügestelle):

> (2) Weisungen im Einzelfall, die laufende strafrechtliche Ermittlungsverfahren betreffen, sind unzulässig. Die Sachleitungsbefugnis der Staatsanwaltschaft bleibt unberührt.

Einfügen nach Absatz 2:

> (3) In der obersten Polizeibehörde leitet eine Volkspolizeipräsident:in die Angelegenheiten der Volkspolizei. Sie hat eine ständige Vertretung im Amt.

Hinweis: Entscheidung bei E-03. Absatz 2 bleibt unverändert.

**E-14 · OGVBl. 2026 Nr. 86, Artikel 1 § 5 VPOG (zu N-08, nur Variante B; Entscheidung bei E-19) · [VK redaktionell]**

Bisher:

> Das Polizeiverwaltungsamt ist zuständig für Beschaffung, Fahrzeugwesen, Dienstkleidung, persönliche Schutzausrüstung, Liegenschaftsangelegenheiten sowie Planung, Betrieb und Sicherheit der polizeilichen Informations- und Kommunikationstechnik, soweit nicht durch Rechtsverordnung nach § 16 Absatz 1 Satz 1 Nummer 4 etwas anderes bestimmt ist.

Ersatzformulierung (Variante B):

> Das Polizeiverwaltungsamt ist zuständig für Beschaffung, Fahrzeugwesen, Dienstkleidung, persönliche Schutzausrüstung, Liegenschaftsangelegenheiten sowie Planung, Betrieb und Sicherheit der polizeilichen Informations- und Kommunikationstechnik, soweit nicht durch Rechtsverordnung nach § 16 Satz 1 Nummer 4 etwas anderes bestimmt ist.

**E-15 · OGVBl. 2026 Nr. 86, Artikel 1 § 6 Satz 2 VPOG (zu N-06) · [VK redaktionell]**

Bisher:

> Die Unterstützung durch die Kasernierte Grenzpolizei richtet sich nach dem Gesetz über die Kasernierte Grenzpolizei des Ostdeutschen Freistaates.

Variante A:

> Die Unterstützung durch die Kasernierte Grenzpolizei richtet sich nach dem Kasernierte-Grenzpolizei-Gesetz.

Variante B:

> Die Unterstützung durch die Kasernierte Grenzpolizei richtet sich nach dem Kasernierte-Grenzpolizei-Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 50 S. 2) in der jeweils geltenden Fassung.

Variante C:

> Die Unterstützung durch die Kasernierte Grenzpolizei richtet sich nach dem Kasernierte-Grenzpolizei-Gesetz vom 20. Juli 2026 (OGVBl. 2026 Nr. 50 S. 2).

Entscheidung der Volkskammer: Redaktionelle Wahl. Variante A: Kurzbezeichnung ohne Fundstelle, wie sonst im VPOG für PVDG, PolFHG und Bezirksordnung. Variante B: Vollzitat beim ersten Vorkommen, dynamisch gehalten. Variante C: Vollzitat wie OstKRITISG § 1 Satz 2. Empfohlen: Variante C (Vollzitat beim Erstzitat wie OstKRITISG § 1 Satz 2).

Hinweis: Das KGrPolG ist Artikel 1 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 50, Seite 2) und seitdem unverändert. Auch die Erstzitate von PVDG (VPOG § 2 Abs. 1) und PolFHG (§ 2 Abs. 3) stehen ohne Datum und Fundstelle; diese Konvention des Pakets ließe sich nur einheitlich ändern und bleibt hier unberührt.

**E-16 · OGVBl. 2026 Nr. 86, Artikel 1 § 9 Absatz 1 VPOG (zu N-08, nur Variante B; Entscheidung bei E-19) · [VK redaktionell]**

Bisher:

> (1) Für jede Gemeinde und, soweit Gemeinden nach der Rechtsverordnung nach § 16 Absatz 1 Satz 1 Nummer 2 in Kontaktbereiche aufgeteilt werden, für jeden Kontaktbereich bestellt die zuständige Bezirkspolizeidirektion eine Kontaktbereichsbeamt:in sowie eine Vertretung.

Ersatzformulierung (Variante B):

> (1) Für jede Gemeinde und, soweit Gemeinden nach der Rechtsverordnung nach § 16 Satz 1 Nummer 2 in Kontaktbereiche aufgeteilt werden, für jeden Kontaktbereich bestellt die zuständige Bezirkspolizeidirektion eine Kontaktbereichsbeamt:in sowie eine Vertretung.

**E-17 · OGVBl. 2026 Nr. 86, Artikel 1 § 10 Absatz 2 VPOG (zu N-08, nur Variante B; Entscheidung bei E-19) · [VK redaktionell]**

Bisher:

> (2) Mindeststandards der Erreichbarkeit regelt die Rechtsverordnung nach § 16 Absatz 1 Satz 1 Nummer 3.

Ersatzformulierung (Variante B):

> (2) Mindeststandards der Erreichbarkeit regelt die Rechtsverordnung nach § 16 Satz 1 Nummer 3.

**E-18 · OGVBl. 2026 Nr. 86, Artikel 1 § 13 Absatz 4 Satz 3 VPOG (zu N-07) · [VK redaktionell]**

Bisher:

> Die Entscheidung nach Absatz 3 Satz 2 trifft die Leitung der Kasernierten Grenzpolizei.

Ersatzformulierung:

> Abweichend von Absatz 3 Satz 2 erster Halbsatz trifft die Entscheidung die Leitung der Kasernierten Grenzpolizei.

Hinweis: Die Dokumentationspflicht nach Absatz 3 Satz 2 zweiter Halbsatz gilt über Absatz 4 Satz 1 entsprechend. „Polizeivollzugsbediensteten“ in Satz 1 wird ohne Entscheidung der Volkskammer nicht an „Polizeivollzugsbeamt:innen“ angeglichen.

**E-19 · OGVBl. 2026 Nr. 86, Artikel 1 § 16 VPOG, Überschrift (zu N-08) · [VK redaktionell] [VL?]**

Bisher:

> Verordnungsermächtigungen, Verwaltungsvorschriften

Variante A: Überschrift unverändert; einzufügen ist der neue Absatz 2 nach E-24.

Variante B:

> Verordnungsermächtigungen

Entscheidung der Volkskammer: Variante A ergänzt eine Zuständigkeitsregel für Verwaltungsvorschriften als neuen Absatz 2 (E-24); das ist eine inhaltliche Ergänzung, die vier Verweise auf „§ 16 Absatz 1“ bleiben richtig. Variante B berichtigt die Überschrift, lässt die Absatzzählung entfallen (E-20) und passt die vier Verweise in §§ 5, 9, 10 und 17 an (E-14, E-16, E-17, E-25).

Hinweis: § 14 Abs. 2 sieht Verwaltungsvorschriften vor, ohne die Erlassbehörde zu bestimmen. Variante A nennt wie § 16 Abs. 1 Satz 1, PolBeschStG § 18 Abs. 2 und Nr. 91 § 8 Abs. 3 ein Mitglied des Staatsrates.

**E-20 · OGVBl. 2026 Nr. 86, Artikel 1 § 16 Absatz 1, Einleitungssatz VPOG (zu N-08, nur Variante B; Entscheidung bei E-19) · [VK redaktionell]**

Bisher:

> (1) Das für die Volkspolizei zuständige Mitglied des Staatsrates wird ermächtigt, durch Rechtsverordnung

Ersatzformulierung (Variante B):

> Das für die Volkspolizei zuständige Mitglied des Staatsrates wird ermächtigt, durch Rechtsverordnung

Hinweis: Der Binnenverweis „Rechtsverordnungen nach Satz 1 Nummer 1 und 2“ im Schlussteil bleibt richtig.

**E-21 · OGVBl. 2026 Nr. 86, Artikel 1 § 16 Absatz 1 Nummer 2 VPOG (zu N-09) · [VK] [VL?]**

Bisher:

> 2. Sitz und Zuständigkeitsbereich der Polizeireviere und Polizeiposten nach den Kriterien des § 8 Absatz 2 sowie die Aufteilung von Gemeinden in Kontaktbereiche,

Variante A:

> 2. Sitz und Zuständigkeitsbereich der Polizeireviere und Polizeiposten nach Maßgabe des § 8 Absatz 2 sowie die Aufteilung von Gemeinden in Kontaktbereiche,

Variante B:

> 2. Sitz und Zuständigkeitsbereich der Polizeireviere und Polizeiposten nach den Grundsätzen des § 1 Absatz 2 und nach Maßgabe des § 8 Absatz 2 sowie die Aufteilung von Gemeinden in Kontaktbereiche,

Entscheidung der Volkskammer: Ist die Verordnung über Reviere und Posten nur an das Verfahren des § 8 Abs. 2 gebunden (Variante A) oder zusätzlich an die Organisationsgrundsätze des § 1 Abs. 2 (Variante B)?

**E-22 · OGVBl. 2026 Nr. 86, Artikel 1 § 16 Absatz 1 Nummer 4 VPOG (zu N-10) · [VK redaktionell] [VL?]**

Bisher:

> 4. die Übertragung einzelner Aufgaben nach § 5 auf eine eine andere Polizeidienststelle nach § 2 Absatz 2,

Ersatzformulierung:

> 4. die Übertragung einzelner Aufgaben nach § 5 auf eine andere Polizeidienststelle nach § 2 Absatz 2,

**E-23 · OGVBl. 2026 Nr. 86, Artikel 1 § 16 Absatz 1 Nummer 5 und Schlussteil des Absatzes 1 VPOG (zu B-12) · [VK redaktionell]**

Bisher:

> 5. Form, Inhalt und Trageweise der Kennzeichnung nach § 13 sowie das Verfahren der Speicherung und Offenbarung der Zuordnung zu regeln. Rechtsverordnungen nach Satz 1 Nummer 1 und 2 werden der Volkskammer mindestens einen Monat vor ihrem Erlass zur Kenntnis gegeben.

Ersatzformulierung:

> 5. Form, Inhalt und Trageweise der Kennzeichnung nach § 13 sowie das Verfahren der Speicherung und Offenbarung der Zuordnung
>
> zu regeln. Rechtsverordnungen nach Satz 1 Nummer 1 und 2 werden der Volkskammer mindestens einen Monat vor ihrem Erlass zur Kenntnis gegeben.

Hinweis: Nummer 5 endet ohne Satzzeichen. Die zweite Zeile wird als nicht nummerierter, linksbündiger Schlussteil von Absatz 1 unmittelbar nach der Liste gesetzt (eigener Block nach dem Listenende, nicht im Listenelement). Kombinierbar mit E-21, E-22 und E-24 oder E-20.

**E-24 · OGVBl. 2026 Nr. 86, Artikel 1 § 16 VPOG, neuer Absatz 2 nach Absatz 1 (zu N-08, nur Variante A; Entscheidung bei E-19) · [VK]**

Bisher (Einfügestelle):

> Rechtsverordnungen nach Satz 1 Nummer 1 und 2 werden der Volkskammer mindestens einen Monat vor ihrem Erlass zur Kenntnis gegeben.

Einfügen nach Absatz 1:

> (2) Die zur Ausführung dieses Gesetzes erforderlichen Verwaltungsvorschriften erlässt das für die Volkspolizei zuständige Mitglied des Staatsrates.

Hinweis: Als eigener Absatz nach dem Schlussteil von Absatz 1, zusammen mit E-23.

**E-25 · OGVBl. 2026 Nr. 86, Artikel 1 § 17 Absatz 2 VPOG (zu B-07; Satz 1 auch zu N-08) · [VK]**

Bisher:

> (2) Die Ostdeutsche Polizeiorganisationsverordnung vom 17. März 2020 (SächsGVBl. S. 97) gilt bis zu ihrer Ablösung durch eine Rechtsverordnung nach § 16 Absatz 1 fort, soweit sie diesem Gesetz nicht widerspricht. Verweisungen in dieser Verordnung auf Polizeidirektionen beziehen sich auf die Bezirkspolizeidirektionen nach § 7. Die §§ 2, 3, 9 und 13 des Kasernierte-Grenzpolizei-Gesetzes bleiben unberührt.

Variante A:

> (2) Die Ostdeutsche Polizeiorganisationsverordnung vom 17. März 2020 (SächsGVBl. S. 97) gilt bis zu ihrer Ablösung durch eine Rechtsverordnung nach § 16 Absatz 1 fort, soweit sie diesem Gesetz nicht widerspricht. § 1 Absatz 2 und 3 der Verordnung ist nicht mehr anzuwenden; die Dienstbezirke der Bezirkspolizeidirektionen richten sich nach § 7 Absatz 2. Soweit die Verordnung im Übrigen Polizeidirektionen nennt, treten an deren Stelle die Bezirkspolizeidirektionen. Die §§ 2, 3, 9 und 13 des Kasernierte-Grenzpolizei-Gesetzes bleiben unberührt.

Variante B:

> (2) Die Ostdeutsche Polizeiorganisationsverordnung vom 17. März 2020 (SächsGVBl. S. 97) gilt bis zu ihrer Ablösung durch eine Rechtsverordnung nach § 16 Absatz 1 fort, soweit sie diesem Gesetz nicht widerspricht. § 1 Absatz 2 der Verordnung ist nicht mehr anzuwenden; die Dienstbezirke der Bezirkspolizeidirektionen richten sich nach § 7 Absatz 2. Abweichend von § 7 Absatz 2 Satz 2 ist § 1 Absatz 3 der Verordnung mit der Maßgabe anzuwenden, dass an die Stelle der dort genannten Polizeidirektion die Bezirkspolizeidirektion tritt, in deren Dienstbezirk die Stadt liegt, nach der die Polizeidirektion benannt ist. Soweit die Verordnung im Übrigen Polizeidirektionen nennt, treten an deren Stelle die Bezirkspolizeidirektionen. Die §§ 2, 3, 9 und 13 des Kasernierte-Grenzpolizei-Gesetzes bleiben unberührt.

Nur bei N-08 Variante B (E-19), Satz 1 – bisher:

> (2) Die Ostdeutsche Polizeiorganisationsverordnung vom 17. März 2020 (SächsGVBl. S. 97) gilt bis zu ihrer Ablösung durch eine Rechtsverordnung nach § 16 Absatz 1 fort, soweit sie diesem Gesetz nicht widerspricht.

Ersatzformulierung für Satz 1:

> (2) Die Ostdeutsche Polizeiorganisationsverordnung vom 17. März 2020 (SächsGVBl. S. 97) gilt bis zu ihrer Ablösung durch eine Rechtsverordnung nach § 16 fort, soweit sie diesem Gesetz nicht widerspricht.

Entscheidung der Volkskammer: Bestehen die Autobahnzuständigkeiten nach § 1 Abs. 3 PolOrgVO übergangsweise fort? Variante A: Sie entfallen; die Dienstbezirke ergeben sich allein aus § 7 Abs. 2. Variante B: Sie gelten bis zur Ablösung der Verordnung fort und werden einer Bezirkspolizeidirektion zugeordnet.

Hinweis: Bei Variante A betrifft „im Übrigen“ nur noch § 5 Abs. 2 und § 6 PolOrgVO. Bei Variante B ist die Zuordnung über die Gebietsbestimmungen der Bezirke eindeutig; Chemnitz und Zwickau liegen im Bezirk Vogtland-Erzgebirge. Ob eine Verordnung nach § 16 Abs. 1 eine solche Autobahnzuständigkeit neu regeln darf, ist wegen § 7 Abs. 2 Satz 2 zweifelhaft. Satz 1 ist in beiden Varianten gleich dem v2-Satz 1; die Ersetzung nach N-08 Variante B gilt deshalb auch für sie. Der letzte Satz bleibt Anker für E-26 und E-27. Variante A entspricht der Lesart, nach der die Autobahnzuständigkeit dem Bezirksgebiet folgt; die Fortgeltung der Verordnung im Übrigen ist geklärt (G-10).

**E-26 · OGVBl. 2026 Nr. 86, Artikel 1 § 17 VPOG, neuer Absatz 3 nach Absatz 2 (zu N-11) · [VK]**

Bisher (Einfügestelle):

> Die §§ 2, 3, 9 und 13 des Kasernierte-Grenzpolizei-Gesetzes bleiben unberührt.

Einfügen nach Absatz 2:

> (3) Soweit in Gesetzen, Rechtsverordnungen und Verwaltungsvorschriften des Freistaates Ostdeutschland Polizeidirektionen genannt sind, treten an deren Stelle die Bezirkspolizeidirektionen; an die Stelle einer namentlich bezeichneten Polizeidirektion tritt die Bezirkspolizeidirektion, in deren Dienstbezirk die Stadt liegt, nach der die Polizeidirektion benannt ist. Absatz 2 bleibt unberührt. Satz 1 gilt nicht für die Grenzpolizeidirektionen nach dem Kasernierte-Grenzpolizei-Gesetz.

Hinweis: Die Regelungsabsicht ist eindeutig (v2 setzt sie in § 17 Abs. 2 und Art. 3 Abs. 1 und 2 selbst um); deshalb keine Varianten. Ausdrückliche PVDG-Änderungen nach E-30 gehen der Klausel vor; für die Normen außerhalb des PVDG ist sie in jedem Fall nötig, und die Grundfassung von E-32 setzt sie voraus. Zur Grenzpolizei siehe E-30 (Entscheidung). „Polizeidirektion Berlin“ führt zur Bezirkspolizeidirektion Berlin. Der Anker ist in v2 und in beiden Varianten von E-25 gleich. Wird E-27 übernommen, folgt dieser als Absatz 4.

**E-27 · OGVBl. 2026 Nr. 86, Artikel 1 § 17 VPOG, neuer Absatz 4 (zu B-06, nur bei E-03 Variante B, wahlweise) · [VK]**

Bisher (Einfügestelle):

> Die §§ 2, 3, 9 und 13 des Kasernierte-Grenzpolizei-Gesetzes bleiben unberührt.

Einfügen nach Absatz 2 und gegebenenfalls nach dem Absatz aus E-26:

> (4) Soweit in Verwaltungsvorschriften des Freistaates Ostdeutschland
>
> 1. das Landespolizeipräsidium genannt ist, tritt an seine Stelle die oberste Polizeibehörde nach § 2 Absatz 1,
>
> 2. die Amtsbezeichnung „Landespolizeipräsident“ verwendet wird, tritt an ihre Stelle die Amtsbezeichnung „Volkspolizeipräsident:in“.

Hinweis: Nur sinnvoll, wenn das Amt Volkspolizeipräsident:in geschaffen wird (Entscheidung bei E-03); ohne die Klausel passt die Verwaltung die neun Verwaltungsvorschriften selbst an. Bewusst auf Verwaltungsvorschriften beschränkt, weil das Besoldungsgesetz durch E-36 ausdrücklich geändert wird. Ohne E-26 lautet die Absatzbezeichnung „(3)“. Stil wie Nr. 99 Art. 3 Abs. 1.

**E-28 · OGVBl. 2026 Nr. 86, Artikel 2, Eingangssatz (zu B-10) · [VK redaktionell]**

Bisher:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 11 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 46 S. 2) geändert worden ist, wird wie folgt geändert:

Variante A:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 96 S. 2) geändert worden ist, wird wie folgt geändert:

Variante B:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 85 S. 2) geändert worden ist, wird wie folgt geändert:

Hinweis: Entscheidung bei E-01. Derselbe Wortlaut steht in Nr. 96 Art. 1 (E-124); dort ist er bei Variante A richtig.

**E-29 · OGVBl. 2026 Nr. 86, Artikel 2 Nummer 1 (Inhaltsübersicht PVDG) (zu N-12) · [VK redaktionell]**

Bisher:

> In der Inhaltsübersicht werden die Angaben zu den §§ 99 und 100 gestrichen.

Ersatzformulierung:

> 1. In der Inhaltsübersicht werden die Angaben zu den §§ 99 und 100 wie folgt gefasst:
>
> „§ 99 (weggefallen)
>
> § 100 (weggefallen)“.

Hinweis: Die Angaben zu § 97 und § 98 bleiben unverändert, weil die Überschriften gleich bleiben. Die Angaben zu §§ 99 und 100 sind im amtlichen Text vorhanden (Nr. 50 Art. 2 Nr. 1 fügt „nach der Angabe zu § 100“ ein); im technischen Bestand nicht prüfbar (T-9).

**E-30 · OGVBl. 2026 Nr. 86, Artikel 2, neue Nummer 2 nach Nummer 1 (PVDG §§ 21 bis 73) (zu N-11, G-3) · [VK]**

Bisher (Einfügestelle):

> In der Inhaltsübersicht werden die Angaben zu den §§ 99 und 100 gestrichen.

Variante A:

> 2. In § 21 Absatz 4 Satz 3, § 27 Absatz 5 Satz 3, § 58 Absatz 4 Satz 1, § 59 Absatz 3 Satz 1, § 60 Absatz 6 Satz 1, § 61 Absatz 5 Satz 2, § 63 Absatz 4 und Absatz 5 Satz 1, § 65 Absatz 3 Satz 1, § 71 Absatz 4 Satz 1 und § 73 Absatz 2 Satz 1 werden jeweils die Wörter „einer Polizeidirektion“ durch die Wörter „einer Bezirkspolizeidirektion“ ersetzt.

Variante B:

> 2. In § 21 Absatz 4 Satz 3, § 27 Absatz 5 Satz 3, § 58 Absatz 4 Satz 1, § 59 Absatz 3 Satz 1, § 60 Absatz 6 Satz 1, § 61 Absatz 5 Satz 2, § 63 Absatz 4 und Absatz 5 Satz 1, § 65 Absatz 3 Satz 1, § 71 Absatz 4 Satz 1 und § 73 Absatz 2 Satz 1 werden jeweils die Wörter „des Landeskriminalamtes oder einer Polizeidirektion“ durch die Wörter „des Landeskriminalamtes, einer Bezirkspolizeidirektion oder der Kasernierten Grenzpolizei“ ersetzt.

Entscheidung der Volkskammer: E-26 ist in jedem Fall zu übernehmen, weil außerhalb des PVDG weitere Gesetze, Rechtsverordnungen und Verwaltungsvorschriften Polizeidirektionen nennen; ersetzbar wäre die Klausel nur durch Einzeländerungen aller dieser Normen. Für das PVDG sind zwei Fragen zu entscheiden. Erstens: Werden die elf Stellen ausdrücklich angepasst (Variante A oder B), oder gilt für sie allein E-26? Zweitens: Darf die Leitung der Kasernierten Grenzpolizei die Anordnungen treffen? Nein: Variante A oder allein E-26. Ja: Variante B; oder Variante A zusammen mit E-32 in der Fassung zu Variante A; oder allein E-26 zusammen mit E-32 in der Grundfassung. Bei Variante B ist E-32 entbehrlich.

Hinweis: Einfügung nach Nummer 1 in der v2-Fassung oder der Fassung nach E-29; die Nummer muss vor § 97 stehen (Paragraphenfolge). Die bisherigen Nummern 2 bis 4 werden 3 bis 5; die Gliederungsnummer in E-31 wird „3.“; zum Ort in E-33 siehe dort. Trefferzahl (Fassung 1.12.2026) je Fundstelle 1, insgesamt 11, für beide Wortfolgen; die Fundstellen liegen nicht in Vorschriften, die das Paket ändert. § 63 Abs. 4 hat nur einen Satz. Bei Variante B fehlt in § 65 Abs. 3 Satz 1 der Beauftragtenzusatz; in § 73 Abs. 2 Satz 1 steht er nur eingeschränkt im zweiten Halbsatz; die Sätze bleiben grammatisch richtig. Ergebnis in § 71 Abs. 4 Satz 1 bei Variante B: „ordnet der Präsident des Landeskriminalamtes, einer Bezirkspolizeidirektion oder der Kasernierten Grenzpolizei oder ein von diesen hierzu beauftragter Bediensteter an“. Die Satzpositionen stammen aus der gespeicherten Fassung; vor Übernahme gegen das amtliche PVDG (SächsGVBl. 2019 S. 358) gegenlesen.

**E-31 · OGVBl. 2026 Nr. 86, Artikel 2 Nummer 2 (§ 97 PVDG) (zu N-13, B-01, B-08) · [VK]; Befehlsform [VK redaktionell]**

Bisher (Einleitungssatz):

> § 97 Absatz 1 bis 2 wird wie folgt gefasst:

Variante A:

> 2. § 97 wird wie folgt gefasst:

Bisher (ganze Nummer 2):

> § 97 Absatz 1 bis 2 wird wie folgt gefasst:
>
> „§ 97
>
> Polizeidienststellen und Einrichtungen für den Polizeivollzugsdienst
>
> (1) Polizeidienststellen im Sinne dieses Gesetzes sind die Polizeidienststellen der Volkspolizei nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes und die Kasernierte Grenzpolizei. Aufbau, Gliederung und Zuständigkeiten der Volkspolizei bestimmen sich nach dem Volkspolizeiorganisationsgesetz. Für die Kasernierte Grenzpolizei gilt § 100a.
>
> (2) Der Freistaat unterhält die Hochschule der Volkspolizei (FH) als Einrichtung für die Aus- und Fortbildung nach Maßgabe des Ostdeutschen Polizeifachhochschulgesetzes.“

Variante B:

> 2. § 97 wird wie folgt geändert:
>
> a) Die Absätze 1 und 2 werden wie folgt gefasst:
>
> „(1) Polizeidienststellen im Sinne dieses Gesetzes sind die Polizeidienststellen der Volkspolizei nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes und die Kasernierte Grenzpolizei. Aufbau, Gliederung und Zuständigkeiten der Volkspolizei bestimmen sich nach dem Volkspolizeiorganisationsgesetz. Für die Kasernierte Grenzpolizei gilt § 100a.
>
> (2) Der Freistaat unterhält die Hochschule der Volkspolizei (FH) als Einrichtung für die Aus- und Fortbildung nach Maßgabe des Ostdeutschen Polizeifachhochschulgesetzes.“
>
> b) Die Absätze 3 und 4 werden aufgehoben.

Variante C:

> 2. § 97 Absatz 1 und 2 wird wie folgt gefasst:
>
> „(1) Polizeidienststellen im Sinne dieses Gesetzes sind die Polizeidienststellen der Volkspolizei nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes und die Kasernierte Grenzpolizei. Aufbau, Gliederung und Zuständigkeiten der Volkspolizei bestimmen sich nach dem Volkspolizeiorganisationsgesetz. Für die Kasernierte Grenzpolizei gilt § 100a.
>
> (2) Der Freistaat unterhält die Hochschule der Volkspolizei (FH) als Einrichtung für die Aus- und Fortbildung nach Maßgabe des Ostdeutschen Polizeifachhochschulgesetzes.“

Entscheidung der Volkskammer: Bleiben PVDG § 97 Abs. 3 („Polizeidirektion Berlin“, Soll-Regel) und Abs. 4 neben VPOG § 7 Abs. 2 („Bezirkspolizeidirektion Berlin“, Muss-Regel) bestehen (Variante C), oder entfallen sie (Variante A; Variante B ist eine gleichwertige Form ohne Neufassung der Überschrift)? Für den Wegfall spricht, dass VPOG § 7 Abs. 2 den Inhalt beider Absätze vollständig übernimmt; der einzige Verweis auf § 97 Abs. 3 außerhalb des § 97 (§ 100 Abs. 1 Satz 2) entfällt mit Nr. 86 Art. 2 Nr. 3.

Hinweis: Variante A ersetzt nur den Einleitungssatz; das Zitat (Paragraphenbezeichnung, Überschrift, Absätze 1 und 2) bleibt unverändert. Die Ziele (Absätze 1 bis 4) bestehen in der amtlichen Zielfassung vom 1.12.2026 je einmal (Abs. 3 aus Nr. 26 Art. 3, Abs. 4 aus Nr. 46 Art. 11 Nr. 1 Buchst. b; im technischen Bestand fehlt Abs. 4, T-2). Den einzigen Verweis auf § 97 Abs. 3 außerhalb des § 97 (§ 100 Abs. 1 Satz 2) hebt Nr. 86 Art. 2 Nr. 3 auf; der Binnenverweis in § 97 Abs. 4 Satz 3 entfällt bei Variante A und B mit Absatz 4. Die Angabe zu § 97 in der Inhaltsübersicht bleibt, weil die Überschrift gleich bleibt. Bei Übernahme von E-30 lautet die Gliederungsnummer „3.“.

**E-32 · OGVBl. 2026 Nr. 86, Artikel 2, neue Nummer nach Nummer 3 (§ 100a PVDG) (zu G-3, N-11) · [VK] [VB]**

Bisher (Einfügestelle):

> Die §§ 99 und 100 werden aufgehoben.

Einfügen nach Nummer 3 (Grundfassung, ohne E-30 Variante A oder B):

> Dem § 100a wird folgender Satz angefügt:
>
> „Soweit nach § 21 Absatz 4, § 27 Absatz 5, § 58 Absatz 4, § 59 Absatz 3, § 60 Absatz 6, § 61 Absatz 5, § 63 Absatz 4 und 5, § 65 Absatz 3, § 71 Absatz 4 und § 73 Absatz 2 eine Anordnung durch die Leitung des Landeskriminalamtes oder einer Polizeidirektion getroffen werden kann oder zu treffen ist, kann sie bei Maßnahmen der Kasernierten Grenzpolizei auch durch die Leitung der Kasernierten Grenzpolizei getroffen werden; lassen diese Vorschriften die Anordnung durch beauftragte Bedienstete zu, kann die Leitung der Kasernierten Grenzpolizei hierzu ebenfalls Bedienstete beauftragen.“

Einfügen nach Nummer 3, Fassung bei Übernahme von E-30 Variante A:

> Dem § 100a wird folgender Satz angefügt:
>
> „Soweit nach § 21 Absatz 4, § 27 Absatz 5, § 58 Absatz 4, § 59 Absatz 3, § 60 Absatz 6, § 61 Absatz 5, § 63 Absatz 4 und 5, § 65 Absatz 3, § 71 Absatz 4 und § 73 Absatz 2 eine Anordnung durch die Leitung des Landeskriminalamtes oder einer Bezirkspolizeidirektion getroffen werden kann oder zu treffen ist, kann sie bei Maßnahmen der Kasernierten Grenzpolizei auch durch die Leitung der Kasernierten Grenzpolizei getroffen werden; lassen diese Vorschriften die Anordnung durch beauftragte Bedienstete zu, kann die Leitung der Kasernierten Grenzpolizei hierzu ebenfalls Bedienstete beauftragen.“

Hinweis: Entscheidung bei E-30. Die Liste nennt alle elf Fundstellen (am Bestand nachgezählt). Die Klausel spricht von der „Leitung“, die Vorschriften vom Präsidenten. Die Grundfassung setzt E-26 voraus; bei E-30 Variante B ist E-32 entbehrlich. § 100a hat einen Satz (Nr. 50 Art. 2 Nr. 3); der neue Satz wird Satz 2. § 100a fehlt im technischen Bestand (T-2). Die fehlende oder eingeschränkte Beauftragung in § 65 Abs. 3 und § 73 Abs. 2 bleibt über „lassen diese Vorschriften die Anordnung durch beauftragte Bedienstete zu“ gewahrt. Die eingefügte Nummer wird Nummer 4, bei Übernahme von E-30 Nummer 5; der Befehl zu § 101 folgt danach (automatische Nummerierung).

**E-33 · OGVBl. 2026 Nr. 86, Artikel 2 Nummer 4 Buchstabe b (§ 101 Absatz 3 PVDG) (zu B-08) · [VK]**

Bisher:

> Absatz 3 wird aufgehoben.

Variante A:

> b) Absatz 3 wird wie folgt gefasst:
>
> „(3) Die oberste Polizeibehörde kann sich oder einer anderen Polizeidienststelle nachgeordnete Polizeidienststellen vorübergehend unmittelbar unterstellen, wenn die Erfüllung der polizeilichen Aufgaben dies erfordert. Ist bei Gefahr im Verzug ein rechtzeitiges Tätigwerden der obersten Polizeibehörde nicht zu erreichen, kann das Landeskriminalamt Maßnahmen nach Satz 1 treffen; die oberste Polizeibehörde ist unverzüglich zu unterrichten.“

Variante B:

> b) Absatz 3 wird wie folgt gefasst:
>
> „(3) Die oberste Polizeibehörde kann Polizeidienststellen der Volkspolizei vorübergehend sich oder einer anderen Polizeidienststelle der Volkspolizei unmittelbar unterstellen, wenn die Erfüllung der polizeilichen Aufgaben dies erfordert. Ist bei Gefahr im Verzug ein rechtzeitiges Tätigwerden der obersten Polizeibehörde nicht zu erreichen, kann das Landeskriminalamt Maßnahmen nach Satz 1 treffen; die oberste Polizeibehörde ist unverzüglich zu unterrichten.“

Entscheidung der Volkskammer: Variante A erhält die Unterstellungs- und Eilbefugnis aus § 99 Abs. 2 und 3 a. F. für alle Polizeidienststellen einschließlich der Grenzpolizei; Variante B beschränkt sie auf die Volkspolizei, die Führung der Grenzpolizei bleibt bei ihrer Leitung (KGrPolG § 5 Abs. 1). Soll die Befugnis bewusst entfallen, bleibt „Absatz 3 wird aufgehoben.“ unverändert.

Hinweis: Beide Varianten geben § 99 Abs. 2 und 3 a. F. inhaltlich vollständig wieder („Staatsministerium des Innern“ wird „oberste Polizeibehörde“). § 101 Abs. 3 besteht in der Zielfassung (1 Ziel); „Absatz 3 wird aufgehoben.“ steht in Nr. 86 einmal. Ort bei Übernahme nur von E-30 oder nur von E-32: „Artikel 2 Nummer 5 Buchstabe b“; bei Übernahme von E-30 und E-32: „Artikel 2 Nummer 6 Buchstabe b“.

**E-34 · OGVBl. 2026 Nr. 86, Artikel 3 Absatz 2 (Landesjugendhilfegesetz) (zu N-14) · [VK redaktionell]**

Bisher:

> (2) In § 5 Absatz 1 Buchstabe f des Landesjugendhilfegesetzes in der Fassung der Bekanntmachung vom 4. September 2008 (SächsGVBl. S. 578) werden die Wörter „von der zuständigen Polizeidirektion gemäß § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung,“ durch die Wörter „von der zuständigen Bezirkspolizeidirektion nach § 2 Absatz 2 Nummer 4 des Volkspolizeiorganisationsgesetzes“ ersetzt.

Ersatzformulierung:

> (2) In § 5 Absatz 1 Buchstabe f des Landesjugendhilfegesetzes in der Fassung der Bekanntmachung vom 4. September 2008 (SächsGVBl. S. 578), das zuletzt durch die Verordnung vom 31. Januar 2023 (SächsGVBl. S. 64) geändert worden ist, werden die Wörter „von der zuständigen Polizeidirektion gemäß § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung,“ durch die Wörter „von der zuständigen Bezirkspolizeidirektion nach § 2 Absatz 2 Nummer 4 des Volkspolizeiorganisationsgesetzes“ ersetzt.

Hinweis: Nur die Eingangsformel ändert sich; Zitat wortgleich mit OGVBl. 2026 Nr. 23. Zieltext 1 Treffer. Die Angabe stammt aus dem REVOSax-Änderungsnachweis; vor Übernahme gegen SächsGVBl. 2023 S. 64 gegenlesen.

**E-35 · OGVBl. 2026 Nr. 86, Artikel 3 Absatz 3 (Ostdeutsches Informationssicherheitsgesetz) (zu N-14, N-15, B-06) · [VK]**

Bisher (Eingangssatz):

> (3) Das Ostdeutsche Informationssicherheitsgesetz vom 2. August 2019 (SächsGVBl. S. 630) wird wie folgt geändert:

Ersatzformulierung nur für den Eingangssatz, wenn die Nummern 1 und 2 in der v2-Fassung bleiben:

> (3) Das Ostdeutsche Informationssicherheitsgesetz vom 2. August 2019 (SächsGVBl. S. 630), das durch Artikel 14 des Gesetzes vom 31. Mai 2023 (SächsGVBl. S. 329) geändert worden ist, wird wie folgt geändert:

Bisher (ganzer Absatz 3):

> (3) Das Ostdeutsche Informationssicherheitsgesetz vom 2. August 2019 (SächsGVBl. S. 630) wird wie folgt geändert:
>
> 1. In § 7 Absatz 1 Satz 1 und § 9 Satz 1 werden jeweils die Wörter „dem Landespolizeipräsidium“ durch die Wörter „der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes“ ersetzt.
>
> 2. In § 10 Absatz 1 Satz 2 werden die Wörter „des Landespolizeipräsidiums“ durch die Wörter „der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes“ ersetzt.

Variante A:

> (3) Das Ostdeutsche Informationssicherheitsgesetz vom 2. August 2019 (SächsGVBl. S. 630), das durch Artikel 14 des Gesetzes vom 31. Mai 2023 (SächsGVBl. S. 329) geändert worden ist, wird wie folgt geändert:
>
> 1. In § 7 Absatz 1 Satz 1 und § 9 Satz 1 werden jeweils die Wörter „dem Landespolizeipräsidium“ durch die Wörter „der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes für den Bereich der Volkspolizei“ ersetzt.
>
> 2. In § 10 Absatz 1 Satz 2 werden die Wörter „des Landespolizeipräsidiums“ durch die Wörter „der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes für den Bereich der Volkspolizei“ ersetzt.

Variante B:

> (3) Das Ostdeutsche Informationssicherheitsgesetz vom 2. August 2019 (SächsGVBl. S. 630), das durch Artikel 14 des Gesetzes vom 31. Mai 2023 (SächsGVBl. S. 329) geändert worden ist, wird wie folgt geändert:
>
> 1. In § 7 Absatz 1 Satz 1 und § 9 Satz 1 werden jeweils die Wörter „dem Landespolizeipräsidium,“ gestrichen.
>
> 2. In § 10 Absatz 1 Satz 2 werden die Wörter „des Landespolizeipräsidiums,“ gestrichen.

Entscheidung der Volkskammer (N-15): Entscheidung 1 (ISichG § 7 Abs. 1): eigene Ebene für die Volkspolizei in der obersten Polizeibehörde (Variante A) oder keine eigene Ebene (Variante B). Entscheidung 2 (Verhältnis der Beauftragten nach PolDigG und ISichG, einheitlich für Volkspolizei und Grenzpolizei): Personalunion – E-56 Variante A bei Variante A oder E-56 Variante B bei Variante B, jeweils mit E-53 Teil 2 Variante A; getrennte Funktionen – E-56 Variante C mit E-53 Teil 2 Variante B.

Hinweis: Treffer je einmal in § 7 Abs. 1 Satz 1, § 9 Satz 1 und § 10 Abs. 1 Satz 2, bei Variante B jeweils einschließlich des Kommas. „das durch“ ohne „zuletzt“, weil der Änderungsnachweis nur eine Änderung ausweist. Ergebnis in § 7 bei Variante A: „In jedem Staatsministerium, in der Staatskanzlei, der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes für den Bereich der Volkspolizei, der Leitstelle“; bei Variante B: „In jedem Staatsministerium, in der Staatskanzlei, der Leitstelle“. In keiner Variante entsteht eine zeitliche Lücke (ISichG ab 1.12.2026, PolDigG ab 1.1.2027).

**E-36 · OGVBl. 2026 Nr. 86, Artikel 3, neuer Absatz 4 (Ostdeutsches Besoldungsgesetz) (zu B-06, nur bei E-03 Variante B) · [VK]**

Bisher (Einfügestelle):

> 2. In § 10 Absatz 1 Satz 2 werden die Wörter „des Landespolizeipräsidiums“ durch die Wörter „der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes“ ersetzt.

Einfügen nach Absatz 3:

> (4) In Anlage 2 (Besoldungsordnung B) des Ostdeutschen Besoldungsgesetzes vom 18. Dezember 2013 (SächsGVBl. S. 970, 1005), das zuletzt durch die Artikel 1 und 3 des Gesetzes vom 6. Juli 2023 (SächsGVBl. S. 467) geändert worden ist, wird in der Besoldungsgruppe B 6 die Amtsbezeichnung „Landespolizeipräsident – als Abteilungsleiter im Staatsministerium des Innern –“ gestrichen und nach der Amtsbezeichnung „Rechnungshofdirektor – als Abteilungsleiter beim Rechnungshof des Freistaates Ostdeutschland –“ die Amtsbezeichnung „Volkspolizeipräsident:in – als Abteilungsleitung in der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes –“ eingefügt.

Hinweis: Nur zusammen mit der Schaffung des Amtes (E-03 Variante B, E-13). Beide Amtsbezeichnungen stehen in der am 1.12.2026 geltenden Fassung je einmal in Anlage 2; „Rechnungshofdirektor“ ist die letzte Amtsbezeichnung in B 6, die alphabetische Ordnung bleibt erhalten. Wird Absatz 3 nach E-35 neu gefasst, steht dieser Absatz unverändert danach. § 23 Abs. 1 OstBesG geht von Amtsbezeichnungen in Grundform aus; die Doppelpunktform folgt der Paketvorgabe. Die Änderungsangabe folgt den Quellennotizen der gespeicherten Fassung (Änderungen durch Artikel 1 und Artikel 3 des Gesetzes vom 6. Juli 2023); vor dem Beschluss gegen REVOSax 13872.27 gegenlesen. Steht stets als Absatz 4 unmittelbar nach Absatz 3.

**E-37 · OGVBl. 2026 Nr. 86, Artikel 3, neuer Absatz 4, bei Übernahme von E-36 neuer Absatz 5 (Kasernierte-Grenzpolizei-Gesetz) (zu G-2) · [VK] [VB]**

Bisher (Einfügestelle):

> In § 10 Absatz 1 Satz 2 werden die Wörter „des Landespolizeipräsidiums“ durch die Wörter „der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes“ ersetzt.

Variante A – einfügen nach Absatz 3:

> (4) Dem § 9 Absatz 2 des Kasernierte-Grenzpolizei-Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 50 S. 2) wird folgender Satz angefügt:
>
> „Auf grenznahen Gewässern sowie in den dort gelegenen Häfen und Umschlagstellen geht die Zuständigkeit der Kasernierten Grenzpolizei der Zuständigkeit des Präsidiums der Bereitschaftspolizei vor.“

Variante A bei Übernahme von E-36 – einfügen nach Absatz 4:

> (5) Dem § 9 Absatz 2 des Kasernierte-Grenzpolizei-Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 50 S. 2) wird folgender Satz angefügt:
>
> „Auf grenznahen Gewässern sowie in den dort gelegenen Häfen und Umschlagstellen geht die Zuständigkeit der Kasernierten Grenzpolizei der Zuständigkeit des Präsidiums der Bereitschaftspolizei vor.“

Variante B: keine Änderung.

Entscheidung der Volkskammer: Soll auf grenznahen Gewässern sowie in den dort gelegenen Häfen und Umschlagstellen die Kasernierte Grenzpolizei der Bereitschaftspolizei vorgehen? Variante A wirkt dauerhaft, auch gegenüber einer künftigen Verordnung nach VPOG § 16. Bei Variante B bleibt das Präsidium der Bereitschaftspolizei nach PolOrgVO § 5 Abs. 3 vorrangig zuständig, KGrPolG § 9 Abs. 2 wirkt dort nur nachrangig.

Hinweis: Die Klausel „soweit nicht eine andere Polizeidienststelle zuständig ist“ steht im KGrPolG einmal (§ 9 Abs. 2, ein Satz); der neue Satz wird Satz 2. Das KGrPolG ist seit 21.7.2026 unverändert, kein Blatt des Pakets ändert es. Die Zuständigkeit des LKA für kriminalpolizeiliche Aufgaben und die Eilzuständigkeit nach PolOrgVO § 7 Abs. 1 bleiben unberührt; PolOrgVO § 5 Abs. 3 tritt insoweit über VPOG § 17 Abs. 2 Satz 1 zurück. Wird E-36 übernommen, steht dieser Absatz als Absatz 5 nach Absatz 4 (Fassung „Variante A bei Übernahme von E-36“); der anzufügende Satz bleibt unverändert.

**E-38 · OGVBl. 2026 Nr. 86, Artikel 4 (zu B-12) · [VK redaktionell]**

Bisher:

> Dieses Gesetz tritt am 1. Dezember 2026 in Kraft..

Ersatzformulierung:

> Dieses Gesetz tritt am 1. Dezember 2026 in Kraft.

Hinweis: 1 Treffer in Nr. 86. Der Termin ist stimmig (gleichtägig mit Nr. 85 und 88, nach Nr. 96).

#### OGVBl. 2026 Nr. 87

**E-39 · OGVBl. 2026 Nr. 87, Artikel 1, Eingangssatz (zu B-10) · [VK redaktionell]**

Bisher:

> Nach § 22 des Ostdeutschen Polizeifachhochschulgesetzes vom 21. Dezember 2021 (SächsGVBl. 2022 S. 2), das zuletzt durch Artikel 7 des Gesetzes vom 31. Mai 2023 (SächsGVBl. S. 329) geändert worden ist, werden die folgenden §§ 22a bis 22d eingefügt:

Ersatzformulierung:

> Nach § 22 des Ostdeutschen Polizeifachhochschulgesetzes vom 21. Dezember 2021 (SächsGVBl. 2022 S. 2), das zuletzt durch Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 85 S. 2) geändert worden ist, werden die folgenden §§ 22a bis 22d eingefügt:

Hinweis: Gilt nach beiden Zitiermaßstäben (E-01). Die Seitenangabe stammt aus dem Inhaltsverzeichnis; ein PDF fehlt.

**E-40 · OGVBl. 2026 Nr. 87, Artikel 2 (zu N-16) · [VK redaktionell]**

Bisher:

> Die Ostdeutsche Ausbildungs- und Prüfungsordnung für die Fachrichtung Polizei vom 6. August 2024 (SächsGVBl. S. 771) in der jeweils geltenden Fassung ist bis zum 30. Juni 2027 an die §§ 22a bis 22d des Ostdeutschen Polizeifachhochschulgesetzes anzupassen.

Ersatzformulierung:

> Die Ostdeutsche Ausbildungs- und Prüfungsordnung für die Fachrichtung Polizei vom 6. August 2024 (SächsGVBl. S. 771), die zuletzt durch Artikel 1 der Verordnung vom 30. Januar 2026 (OGVBl. 2026 Nr. 12 S. 2) geändert worden ist, ist bis zum 30. Juni 2027 an die §§ 22a bis 22d des Ostdeutschen Polizeifachhochschulgesetzes anzupassen.

Hinweis: 1 Treffer im Blatt. Belegt durch Gesetze/OGVBl. 2026 Nr. 12.html und die Historie der APO; danach keine weitere Änderung. Die Seitenangabe stammt aus dem Inhaltsverzeichnis von Nr. 12.

**E-41 · OGVBl. 2026 Nr. 87, Artikel 3 Absatz 2 (zu B-13) · [VK]**

Bisher:

> (2) § 22c des Ostdeutschen Polizeifachhochschulgesetzes gilt nicht für Führungsfunktionen, die vor dem 1. Januar 2028 übertragen wurden. Die Inhaberinnen und Inhaber dieser Funktionen haben die Führungsqualifizierung bis zum 31. Dezember 2028 nachzuholen.

Variante A:

> (2) § 22c des Ostdeutschen Polizeifachhochschulgesetzes gilt nicht für Führungsfunktionen, die vor dem 1. Januar 2028 übertragen worden sind. Wer eine solche Führungsfunktion innehat, hat die Führungsqualifizierung bis zum 31. Dezember 2028 nachzuholen.

Variante B:

> (2) § 22c des Ostdeutschen Polizeifachhochschulgesetzes gilt nicht für Führungsfunktionen, die vor dem 1. Januar 2027 übertragen worden sind. Wer eine solche Führungsfunktion innehat, hat die Führungsqualifizierung bis zum 31. Dezember 2028 nachzuholen.

Entscheidung der Volkskammer: Soll 2027 ein Übergangsjahr sein, in dem § 22c für neu übertragene Führungsfunktionen nicht gilt (Variante A, Stichtag 1. Januar 2028)? Oder gilt § 22c ab Inkrafttreten am 1. Januar 2027, und nur die bis dahin übertragenen Funktionen sind ausgenommen (Variante B, Stichtag 1. Januar 2027)? Die Nachholfrist 31. Dezember 2028 bleibt in beiden Varianten.

Hinweis: Beide Varianten beseitigen zugleich die Paarform und passen die Zeitform an. Für den Stichtag 2028 spricht, dass die APO erst bis 30.6.2027 angepasst sein muss (Art. 2, § 22d Abs. 1 Nr. 5); für 2027 sprechen das Inkrafttreten und die einjährige Nachholmöglichkeit in § 22c Satz 2, die bei Variante B nur bei zwingenden dienstlichen Gründen greift. Die Ausnahme gilt auch für die Grenzpolizei (G-8). Der bisherige Wortlaut steht genau einmal im Blatt.

#### OGVBl. 2026 Nr. 88

**E-42 · OGVBl. 2026 Nr. 88, Artikel 1 § 1 Absatz 2 Nummer 1 PolBeschStG (zu N-17) · [VK] [VL?]**

Bisher:

> 1. der Polizeidienststellen und der Hochschule nach § 2 Absatz 2 und 3 des Volkspolizeiorganisationsgesetzes sowie der obersten Polizeibehörde, soweit sie dort Aufgaben der Volkspolizei wahrnehmen,

Variante A:

> 1. der Polizeidienststellen und der Hochschule nach § 2 Absatz 2 und 3 des Volkspolizeiorganisationsgesetzes sowie der obersten Polizeibehörde, soweit sie dort Angelegenheiten der Volkspolizei oder der Kasernierten Grenzpolizei bearbeiten,

Variante B:

> 1. der Polizeidienststellen und der Hochschule nach § 2 Absatz 2 und 3 des Volkspolizeiorganisationsgesetzes sowie der obersten Polizeibehörde, soweit sie dort Angelegenheiten der Volkspolizei bearbeiten,

Variante C:

> 1. der Polizeidienststellen und der Hochschule nach § 2 Absatz 2 und 3 des Volkspolizeiorganisationsgesetzes sowie der obersten Polizeibehörde, soweit sie dort Aufgaben der Volkspolizei oder der Kasernierten Grenzpolizei wahrnehmen,

Variante D: keine Änderung.

Entscheidung der Volkskammer: Erfasst werden Beschäftigte der obersten Polizeibehörde, soweit sie Angelegenheiten der Volkspolizei oder der Kasernierten Grenzpolizei bearbeiten (Variante A), oder nur bei Angelegenheiten der Volkspolizei (Variante B). Variante C ergänzt nur die Grenzpolizei und behält die Wendung „Aufgaben der Volkspolizei oder der Kasernierten Grenzpolizei wahrnehmen“. Variante D lässt v2 unverändert; die Einbeziehung läuft dann weitgehend leer.

Hinweis: Die Wendung „Aufgaben der Volkspolizei wahrnehmen“ läuft wörtlich weitgehend leer, weil die oberste Polizeibehörde kaum Aufgaben der Volkspolizei wahrnimmt; Varianten A und B knüpfen deshalb an „Angelegenheiten“ an (vgl. „Grundsatzangelegenheiten der Volkspolizei“ in VPOG § 3 Abs. 1 Satz 2). Nummer 2 bleibt unverändert. Kombinierbar mit E-43.

**E-43 · OGVBl. 2026 Nr. 88, Artikel 1 § 1 PolBeschStG, neuer Absatz 3 nach Absatz 2 (zu N-05, nur Variante B; Entscheidung bei E-12) · [VK redaktionell]**

Bisher (Einfügestelle):

> 2. der Kasernierten Grenzpolizei.

Einfügen nach Absatz 2:

> (3) Oberste Polizeibehörde im Sinne dieses Gesetzes ist die oberste Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes.

Hinweis: Als eigener Absatz unmittelbar nach der Aufzählung des Absatzes 2. „der Kasernierten Grenzpolizei.“ steht im Blatt genau einmal als eigene Zeile. Kombinierbar mit E-42.

**E-44 · OGVBl. 2026 Nr. 88, Artikel 1 § 2 Absatz 1 PolBeschStG (zu N-18) · [VK redaktionell]**

Bisher:

> (1) Die Beschwerdestelle ist in der Ausübung ihres Amtes unabhängig, weisungsfrei und nur dem Gesetz unterworfen.
>
> Sie unterliegt keiner Fach- und keiner Rechtsaufsicht.

Ersatzformulierung:

> (1) Die Beschwerdestelle ist in der Ausübung ihres Amtes unabhängig, weisungsfrei und nur dem Gesetz unterworfen. Sie unterliegt keiner Fach- und keiner Rechtsaufsicht.

Hinweis: Beide Sätze in einen Absatzblock setzen.

**E-45 · OGVBl. 2026 Nr. 88, Artikel 1 § 5 Absatz 2 Satz 3 PolBeschStG (zu N-19) · [VK redaktionell]**

Bisher:

> Die Beschwerdestelle soll über Bedienstete mit Befähigung zum Richteramt, mit kriminalistischer Ermittlungserfahrung und mit Kenntnissen der Informationstechnik verfügen.

Ersatzformulierung:

> Die Beschwerdestelle soll über eigenes Personal mit Befähigung zum Richteramt, mit kriminalistischer Ermittlungserfahrung und mit Kenntnissen der Informationstechnik verfügen.

**E-46 · OGVBl. 2026 Nr. 88, Artikel 1 § 10 Absatz 1 Satz 1 PolBeschStG (zu N-20) · [VK]**

Bisher:

> (1) Die Polizeidienststellen, die Kasernierte Grenzpolizei und die oberste Polizeibehörde haben die Beschwerdestelle zu unterstützen.

Ersatzformulierung:

> (1) Die Polizeidienststellen, die Hochschule der Volkspolizei (FH), die Kasernierte Grenzpolizei und die oberste Polizeibehörde haben die Beschwerdestelle zu unterstützen.

Entscheidung der Volkskammer: Wird die Hochschule unmittelbar zur Unterstützung verpflichtet? Unterbleibt die Änderung, ist bewusst hinzunehmen, dass die Rechte nach § 10 Abs. 1 gegenüber der Hochschule nur über die oberste Polizeibehörde durchsetzbar sind.

Hinweis: Satz 2 und die Nummern 1 bis 4 bleiben unverändert; „Dienststellen“ in Nummer 3 umfasst die Hochschule im dienstrechtlichen Sinn. Der Name „Hochschule der Volkspolizei (FH)“ gilt nach Nr. 85 Art. 2 ab demselben Tag.

**E-47 · OGVBl. 2026 Nr. 88, Artikel 1 § 16 Absatz 1 Satz 2 PolBeschStG (zu N-19) · [VK redaktionell]**

Bisher:

> Werden Bedienstete als Ermittlungspersonen tätig, gelten die Strafprozessordnung und das Ostdeutsche Datenschutz-Umsetzungsgesetz.

Ersatzformulierung:

> Werden Bedienstete der Beschwerdestelle als Ermittlungspersonen der Staatsanwaltschaft nach § 13 Absatz 1 tätig, gelten die Strafprozessordnung und das Ostdeutsche Datenschutz-Umsetzungsgesetz.

**E-48 · OGVBl. 2026 Nr. 88, Artikel 2, Eingangssatz (zu B-10) · [VK redaktionell]**

Bisher:

> § 98 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 11 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 46 S. 2) geändert worden ist, wird wie folgt gefasst:

Variante A:

> § 98 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 96 S. 2) geändert worden ist, wird wie folgt gefasst:

Variante B:

> § 98 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 86 S. 2) geändert worden ist, wird wie folgt gefasst:

Hinweis: Entscheidung bei E-01.

**E-49 · OGVBl. 2026 Nr. 88, Artikel 4 (zu N-21) · [VK redaktionell]**

Bisher:

> Dieses Gesetz tritt am ersten Tag des ersten Monats nach Verkündung in Kraft.

Variante A:

> Dieses Gesetz tritt am 1. Dezember 2026 in Kraft.

Variante B:

> Dieses Gesetz tritt am ersten Tag des auf die Verkündung folgenden Kalendermonats in Kraft.

Entscheidung der Volkskammer: Redaktionelle Wahl; beide Formeln ergeben bei Verkündung am 13.11.2026 den 1.12.2026. Variante A gleicht Nr. 88 an Nr. 85 und 86 an.

#### OGVBl. 2026 Nr. 89

**E-50 · OGVBl. 2026 Nr. 89, Inhaltsverzeichnis, mittlere Tabellenzelle zwischen „13. November 2026“ und „Seite 2“ (zu N-22) · [VK redaktionell]**

Bisher:

> Gesetz über die Digitalisierung der Volkspolizei des Freistaates Ostdeutschland

Variante A:

> Gesetz zur Digitalisierung der Volkspolizei des Freistaates Ostdeutschland

Variante B:

> Gesetz zur Einführung eines Polizeidigitalisierungsgesetzes

Entscheidung der Volkskammer: Redaktionelle Wahl der Bezeichnung des Mantelgesetzes. Variante A ändert nur „über die“ in „zur“; Variante B folgt dem Paketmuster „Gesetz zur Einführung eines“ mit der Bezeichnung des Stammgesetzes (Nr. 92, 94, 95 und 98). Die Bezeichnung des PolDigG in Artikel 1 bleibt in beiden Varianten unverändert. Zugehörig: E-51.

Hinweis: Nur die Tabellenzelle ersetzen; dieselbe Zeichenfolge steht ein zweites Mal am Anfang der Überschrift von Artikel 1 (2 Treffer im Blatt).

**E-51 · OGVBl. 2026 Nr. 89, Überschrift des Gesetzes (zu N-22) · [VK redaktionell]**

Bisher:

> Gesetz
>
> über die Digitalisierung der Volkspolizei des Freistaates Ostdeutschland
>
> vom 13. November 2026

Variante A:

> Gesetz
>
> zur Digitalisierung der Volkspolizei des Freistaates Ostdeutschland
>
> vom 13. November 2026

Variante B:

> Gesetz
>
> zur Einführung eines Polizeidigitalisierungsgesetzes
>
> vom 13. November 2026

Hinweis: Entscheidung bei E-50. Dreizeiliger Block, 1 Treffer.

**E-52 · OGVBl. 2026 Nr. 89, Artikel 1, Überschrift von Abschnitt 1 vor § 1 (zu N-23) · [VK redaktionell]**

Bisher:

> Abschnitt 1

Ersatzformulierung:

> Abschnitt 1
>
> Allgemeine Bestimmungen

Hinweis: „Abschnitt 1“ steht im Blatt genau einmal (Zeile vor „§ 1 Begriffsbestimmungen“). Die zweite Zeile wird wie bei den Abschnitten 2 bis 4 im selben Überschriftenelement nach einem Zeilenumbruch gesetzt. Die Überschrift folgt dem Paketstil (VPOG Abschnitt 1) und deckt §§ 1 bis 3 ab.

**E-53 · OGVBl. 2026 Nr. 89, Artikel 1 § 2 Absatz 4 PolDigG (zu G-6, N-24, N-25, N-15, B-06) · [VK]; Wortlaut [VK redaktionell]**

Bisher:

> (4) Die §§ 9 bis 12 und § 15 Absatz 3 gelten für die informationstechnischen Systeme der Kasernierten Grenzpolizei entsprechend. § 11 Absatz 2 gilt für diese Systeme nur, soweit sie eine Online-Wache betreibt. Soweit die §§ 9 und 12 an Systeme nach Abschnitt 2 anknüpfen, treten für die Kasernierte Grenzpolizei die von ihr für entsprechende Zwecke eingesetzten Systeme an deren Stelle. Die Leitung der Kasernierten Grenzpolizei bestellt für ihre Systeme eine Informationssicherheitsbeauftragte oder einen Informationssicherheitsbeauftragten. § 12 Absatz 2 Satz 2 gilt entsprechend.

Teil 1 – Wortlaut des Absatzes (zu G-6, N-24, N-25):

> (4) Die §§ 9 bis 11, § 12 Absatz 1 und 3 bis 5 sowie § 15 Absatz 3 gelten für die informationstechnischen Systeme der Kasernierten Grenzpolizei entsprechend. § 11 Absatz 2 gilt mit der Maßgabe, dass an die Stelle der Online-Wache ein von der Kasernierten Grenzpolizei betriebenes elektronisches Zugangsportal für Anzeigen, Hinweise und Mitteilungen tritt. Soweit die §§ 9 und 12 an Systeme nach Abschnitt 2 anknüpfen, treten an die Stelle dieser Systeme die von der Kasernierten Grenzpolizei für entsprechende Zwecke eingesetzten Systeme. Die Leitung der Kasernierten Grenzpolizei bestellt eine:n Informationssicherheitsbeauftragte:n der Kasernierten Grenzpolizei; § 12 Absatz 2 Satz 2 gilt entsprechend.

Teil 2 – Verhältnis zur Beauftragten nach § 7 Absatz 2 ISichG (zu N-15), Variante A; als neuer letzter Satz anfügen nach „§ 12 Absatz 2 Satz 2 gilt entsprechend.“:

> Die nach Satz 4 bestellte Person ist zugleich Beauftragte:r für Informationssicherheit der Kasernierten Grenzpolizei nach § 7 Absatz 2 des Ostdeutschen Informationssicherheitsgesetzes.

Teil 2, Variante B; als neuer letzter Satz anfügen:

> § 7 Absatz 2 des Ostdeutschen Informationssicherheitsgesetzes bleibt unberührt.

Entscheidung der Volkskammer: Teil 1 bedarf keiner Variantenentscheidung; mit Satz 2 bestätigt die Volkskammer, dass die Löschpflicht nach § 11 Abs. 2 für ein Zugangsportal der Grenzpolizei gilt. Teil 2: siehe E-35, Entscheidung 2 (Variante A bei Personalunion, Variante B bei getrennten Funktionen).

Hinweis: Teil 1 ersetzt den ganzen Absatz; er nimmt § 12 Abs. 2 aus der Verweisung in Satz 1 heraus, fasst Satz 2 als Maßgabe, löst den Bezug „an deren Stelle“ auf und beseitigt die Paarform. „Satz 4“ in Teil 2 bezeichnet im v2-Wortlaut und in Teil 1 den Bestellungssatz; Teil 2 lässt sich deshalb an beide anfügen. Der Absatz und jeder Einzelsatz stehen im Blatt genau einmal. Innerhalb der §§ 9 bis 12 knüpfen nur § 9 Abs. 2, § 12 Abs. 1 Satz 2 und § 12 Abs. 5 an Systeme nach Abschnitt 2 an. Der Vorschlagstext von K-18 darf nicht zusätzlich eingefügt werden, sonst entstünde ein zweiter Absatz 4.

**E-54 · OGVBl. 2026 Nr. 89, Artikel 1 § 4 Absatz 2 Satz 1 PolDigG (zu B-14) · [VK redaktionell]**

Bisher:

> Die Übermittlung elektronischer Ermittlungsakten an Staatsanwaltschaften und Gerichte richtet sich nach den Vorschriften der Strafprozessordnung über die elektronische Aktenführung .

Ersatzformulierung:

> Die Übermittlung elektronischer Ermittlungsakten an Staatsanwaltschaften und Gerichte richtet sich nach den Vorschriften der Strafprozessordnung über die elektronische Aktenführung.

Hinweis: 1 Treffer im Blatt. Satz 2 des Absatzes bleibt unverändert.

**E-55 · OGVBl. 2026 Nr. 89, Artikel 1 § 7 Absatz 3 PolDigG (zu B-14) · [VK redaktionell]**

Bisher:

> (3) Übermittlungen richten sich nach §§ 82 bis 90 des Ostdeutschen Polizeivollzugsdienstgesetzes.

Ersatzformulierung:

> (3) Übermittlungen richten sich nach den §§ 82 bis 90 des Ostdeutschen Polizeivollzugsdienstgesetzes.

Hinweis: 1 Treffer im Blatt („nach §§“ ebenfalls 1). Schreibweise wie § 4 Abs. 3 und § 15 Abs. 3 desselben Gesetzes.

**E-56 · OGVBl. 2026 Nr. 89, Artikel 1 § 12 Absatz 2 PolDigG (zu N-15, B-06) · [VK]**

Bisher:

> (2) Das Polizeiverwaltungsamt bestellt eine:n Informationssicherheitsbeauftragte:n der Volkspolizei. Sie oder er ist in dieser Funktion weisungsfrei und berichtet der obersten Polizeibehörde jährlich.

Variante A:

> (2) Informationssicherheitsbeauftragte:r der Volkspolizei ist die Person, die nach § 7 Absatz 1 Satz 1 des Ostdeutschen Informationssicherheitsgesetzes bei der obersten Polizeibehörde für den Bereich der Volkspolizei zur Beauftragten für Informationssicherheit ernannt ist. Sie ist in dieser Funktion weisungsfrei und berichtet der obersten Polizeibehörde jährlich.

Variante B:

> (2) Das Polizeiverwaltungsamt bestellt eine:n Informationssicherheitsbeauftragte:n der Volkspolizei. Die bestellte Person ist in dieser Funktion weisungsfrei und berichtet der obersten Polizeibehörde jährlich. Sie ist zugleich Beauftragte:r für Informationssicherheit der Polizeidienststellen nach § 2 Absatz 2 des Volkspolizeiorganisationsgesetzes im Sinne des § 7 Absatz 2 des Ostdeutschen Informationssicherheitsgesetzes.

Variante C:

> (2) Das Polizeiverwaltungsamt bestellt eine:n Informationssicherheitsbeauftragte:n der Volkspolizei. Die bestellte Person ist in dieser Funktion weisungsfrei und berichtet der obersten Polizeibehörde jährlich. § 7 des Ostdeutschen Informationssicherheitsgesetzes bleibt unberührt.

Hinweis: Entscheidung bei E-35 (Entscheidung 2); Variante A setzt E-35 Variante A voraus, Variante B E-35 Variante B. Variante C (getrennte Funktionen) ist mit beiden Varianten von E-35 vereinbar und gehört zu E-53 Teil 2 Variante B. Alle drei beseitigen die Paarform „Sie oder er“. Bei Variante A bleibt die Verweisung „§ 12 Absatz 2 Satz 2“ in § 2 Abs. 4 stimmig; Satz 2 wiederholt teils ISichG § 7 Abs. 3 Satz 7 (unschädlich). Variante B ist nach ISichG § 7 Abs. 2 Satz 5 zulässig („Beauftragte und Vertreter können jeweils für mehrere staatliche Stellen zuständig sein.“).

**E-57 · OGVBl. 2026 Nr. 89, Artikel 1 § 14 PolDigG (zu N-26) · [VK redaktionell]**

Bisher:

> Das zuständige Mitglied des Staatsrates wird ermächtigt, durch Rechtsverordnung
>
> 1. die technischen und organisatorischen Anforderungen an die elektronische Ermittlungsakte nach § 4,
>
> 2. Verfahren, Identifizierung und Sprachangebot der Online-Wache nach § 5 Absatz 1 und 2,
>
> 3. Zahl, Sitz und Zuständigkeitsbereiche der Leitstellen nach § 6 im Einvernehmen mit den übrigen zuständigen Mitgliedern des Staatsrates,
>
> 4. das Rollen- und Berechtigungskonzept nach § 10 Absatz 1 in seinen Grundzügen zu regeln.

Ersatzformulierung:

> Das zuständige Mitglied des Staatsrates wird ermächtigt, durch Rechtsverordnung
>
> 1. die technischen und organisatorischen Anforderungen an die elektronische Ermittlungsakte nach § 4,
>
> 2. Verfahren, Identifizierung und Sprachangebot der Online-Wache nach § 5 Absatz 1 und 2,
>
> 3. Zahl, Sitz und Zuständigkeitsbereiche der Leitstellen nach § 6 im Einvernehmen mit den übrigen zuständigen Mitgliedern des Staatsrates und
>
> 4. das Rollen- und Berechtigungskonzept nach § 10 Absatz 1 in seinen Grundzügen
>
> zu regeln.

Hinweis: „zu regeln.“ wird als eigene Zeile nach der Aufzählung gesetzt (eigener Absatz nach dem Listenende), nicht als Teil der Nummer 4. Die Teilstrings „in seinen Grundzügen zu regeln.“ und „Mitgliedern des Staatsrates,“ stehen je einmal im Blatt.

#### OGVBl. 2026 Nr. 90

**E-58 · OGVBl. 2026 Nr. 90, Artikel 1 § 1 Nummer 3 und neue Nummer 4 (Sicherheitsgesetz) (zu N-27, N-35) · [VK]**

Bisher:

> 3. kritische Infrastruktur: Anlagen und Einrichtungen im Sinne des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland.

Variante A:

> 3. kritische Infrastruktur: Anlagen und Einrichtungen im Sinne des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland;
>
> 4. zuständiges Mitglied des Staatsrates: das für den Geschäftsbereich Frieden zuständige Mitglied des Staatsrates.

Variante B:

> 3. kritische Infrastruktur: Anlagen und Einrichtungen im Sinne des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland;
>
> 4. zuständiges Mitglied des Staatsrates: das Mitglied des Staatsrates, das nach § 3 Absatz 3 Satz 1 den Vorsitz im Sicherheitskabinett führt.

Nur wenn E-85 übernommen wird, lautet Nummer 3 in Variante A und B:

> 3. kritische Infrastruktur: Anlagen, Einrichtungen und Systeme im Sinne des § 2 Nummer 1 des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland;

Entscheidung der Volkskammer: Wer ist zuständiges Mitglied des Staatsrates im Sinne des Sicherheitsgesetzes? Variante A: das für den Geschäftsbereich Frieden zuständige Mitglied, wie im LfStErrG und im OstSZG. Variante B: das Mitglied, das nach § 3 Abs. 3 Satz 1 den Vorsitz im Sicherheitskabinett führt, also gegebenenfalls die Staatspräsident:in. § 8 Abs. 1 wird nach E-61 angepasst.

Hinweis: Der Schlusspunkt von Nummer 3 wird Semikolon, Nummer 4 wird angefügt. § 3 Abs. 3, § 9 Abs. 2, § 10, § 11 Abs. 1 und § 13 bleiben unverändert. Zur Begriffsbestimmung in Nummer 3 siehe E-85.

**E-59 · OGVBl. 2026 Nr. 90, Artikel 1 § 2 Absatz 2 (Sicherheitsgesetz) (zu B-18) · [VK redaktionell]**

Bisher:

> (2) Das Landesamt für Staatsschutz darf die Polizei nicht um Maßnahmen ersuchen, zu denen es selbst nicht befugt ist; die Vollzugshilfe nach § 4 Absatz 4 des Staatsschutzamt-Errichtungsgesetzes bleibt unberührt. Polizeidienststellen sind dem Landesamt für Staatsschutz gegenüber nicht weisungsbefugt.

Ersatzformulierung:

> (2) Das Landesamt für Staatsschutz darf die Polizei nicht um Maßnahmen ersuchen, zu denen es selbst nicht befugt ist; die Vollzugshilfe nach § 4 Absatz 4 des Staatsschutzamt-Errichtungsgesetzes bleibt unberührt.

Hinweis: Streicht Satz 2; die Regel bleibt in Nr. 91 Art. 1 § 6 Abs. 2 Satz 2 wortgleich erhalten, dem sachlichen Standort („Verhältnis zur Polizei“).

**E-60 · OGVBl. 2026 Nr. 90, Artikel 1 § 7 Absatz 1 Satz 1 (Sicherheitsgesetz) (zu N-28) · [VK redaktionell]**

Bisher:

> Das GLAZ Ost erstellt fortlaufend ein ,,Landeslagebild innere Sicherheit”.

Ersatzformulierung:

> Das GLAZ Ost erstellt fortlaufend ein „Landeslagebild innere Sicherheit“.

**E-61 · OGVBl. 2026 Nr. 90, Artikel 1 § 8 Absatz 1 (Sicherheitsgesetz) (zu B-16, N-27) · [VK]**

Bisher (Satz 2):

> Er wird bei einer Sicherheitskrise vom zuständigen Staatsrat aktiviert; bei Gefahr im Verzug kann die Leitung der Geschäftsstelle ihn vorläufig aktivieren.

Variante A (ersetzt Satz 2):

> Er wird bei einer Sicherheitskrise vom zuständigen Mitglied des Staatsrates aktiviert; bei Gefahr im Verzug kann die Leitung der Geschäftsstelle des GLAZ Ost ihn vorläufig aktivieren.

Bisher (ganzer Absatz 1):

> (1) Beim zuständigen Staatssekretariat wird ein Landeskrisenstab gebildet. Er wird bei einer Sicherheitskrise vom zuständigen Staatsrat aktiviert; bei Gefahr im Verzug kann die Leitung der Geschäftsstelle ihn vorläufig aktivieren.

Variante B (ersetzt Absatz 1):

> (1) Beim zuständigen Staatssekretariat wird ein Landeskrisenstab mit einer ständigen Geschäftsstelle gebildet. Er wird bei einer Sicherheitskrise vom zuständigen Mitglied des Staatsrates aktiviert; bei Gefahr im Verzug kann die Leitung seiner Geschäftsstelle ihn vorläufig aktivieren.

Entscheidung der Volkskammer: Wer darf den Landeskrisenstab bei Gefahr im Verzug vorläufig aktivieren? Variante A: die Leitung der Geschäftsstelle des GLAZ Ost beim Landeskriminalamt. Variante B: die Leitung einer eigenen ständigen Geschäftsstelle des Landeskrisenstabs.

Hinweis: Beide Varianten vereinheitlichen „zuständigen Staatsrat“ zu „zuständigen Mitglied des Staatsrates“ (Begriff der §§ 9 bis 11 und 13); das ist auch ohne E-58 richtig, wer zuständig ist, legt E-58 fest. Die Wörter „Beim zuständigen Staatssekretariat“ in Satz 1 bleiben in beiden Varianten unverändert; die funktionsbezogene Bezeichnung sieht der Organisationserlass 09/2026 Abschnitt IX Satz 2 vor. „GLAZ Ost“ ist in § 5 Abs. 1 Satz 1 eingeführt, die Geschäftsstelle besteht nach § 5 Abs. 3 Satz 1 beim Landeskriminalamt. Treffer „Leitung der Geschäftsstelle“ und „zuständigen Staatsrat“ je 1.

**E-62 · OGVBl. 2026 Nr. 90, Artikel 1 § 8 Absatz 3 (Sicherheitsgesetz) (zu B-16) · [VK redaktionell]**

Bisher:

> (3) Die Aktivierung und ihre Beendigung sind der/dem Präsident:in der Volkskammer unverzüglich mitzuteilen.

Ersatzformulierung:

> (3) Die Aktivierung und ihre Beendigung sind der Präsident:in der Volkskammer unverzüglich mitzuteilen.

Hinweis: Unabhängig von E-61. Die Schrägstrichform ist erst mit v2 eingefügt worden; die Ersatzformulierung folgt Nr. 88 Art. 1 § 2 Abs. 2 und § 4 Abs. 1 („Präsident:in der Volkskammer“), im Dativ wie K-14 Nr. 3.

**E-63 · OGVBl. 2026 Nr. 90, Artikel 1, Überschrift von Abschnitt 5 (Sicherheitsgesetz) (zu N-29) · [VK redaktionell]**

Bisher:

> Abschnitt 5
>
> Berichte und Schlussbestimmungen

Ersatzformulierung:

> Abschnitt 5
>
> Berichte und Unterrichtung der Volkskammer

#### OGVBl. 2026 Nr. 91

**E-64 · OGVBl. 2026 Nr. 91, Inhaltsverzeichnis, Titelzeile (zu N-30, nur Variante A; Entscheidung bei E-66) · [VK redaktionell]**

Bisher:

> Gesetz zur Errichtung des Landesamtes für Staatsschutz des Freistaates Ostdeutschland (Staatsschutzamt-Errichtungsgesetz – LfStErrG)

Ersatzformulierung (Variante A):

> Gesetz zur Einführung eines Staatsschutzamt-Errichtungsgesetzes

Hinweis: Datum und Seitenangabe der Zeile bleiben unverändert. Die Titelzeile mit „Gesetz “ steht einmal (Inhaltsverzeichnis); ohne „Gesetz “ zweimal (Inhaltsverzeichnis und Kopf, siehe E-65).

**E-65 · OGVBl. 2026 Nr. 91, Überschrift des Gesetzes (zu N-30, nur Variante A; Entscheidung bei E-66) · [VK redaktionell]**

Bisher:

> Gesetz
>
> zur Errichtung des Landesamtes für Staatsschutz des Freistaates Ostdeutschland (Staatsschutzamt-Errichtungsgesetz – LfStErrG)
>
> vom 13. November 2026

Ersatzformulierung (Variante A):

> Gesetz
>
> zur Einführung eines Staatsschutzamt-Errichtungsgesetzes
>
> vom 13. November 2026

**E-66 · OGVBl. 2026 Nr. 91, Überschrift von Artikel 1 bis Überschrift von Abschnitt 1 (zu N-30) · [VK redaktionell] [VL?]**

Bisher:

> Artikel 1
>
> Einführung eines Gesetzes zur Errichtung des Landesamtes für Staatsschutz des Freistaates Ostdeutschland
>
> Abschnitt 1
>
> Errichtung und Rechtsstellung

Variante A:

> Artikel 1
>
> Einführung eines Staatsschutzamt-Errichtungsgesetzes
>
> Gesetz zur Errichtung des Landesamtes für Staatsschutz des Freistaates Ostdeutschland (Staatsschutzamt-Errichtungsgesetz – LfStErrG)
>
> Abschnitt 1
>
> Errichtung und Rechtsstellung

Variante B:

> Abschnitt 1
>
> Errichtung und Rechtsstellung

Entscheidung der Volkskammer: Die Form des Gesetzes ist zu wählen. Variante A: Mantelgesetz mit Sachtitel wie Nr. 92, 94, 95 und 98 und mit der Titelzeile des Stammgesetzes in Artikel 1 wie Nr. 90 und 93 (E-64, E-65 und dieser Eintrag). Variante B: Stammgesetz ohne Artikelgliederung wie in v1, Inkrafttreten als § 14 (dieser Eintrag und E-76; entspricht K-07).

Hinweis: Bei Variante A Artikelüberschrift, Titelzeile und Abschnittsüberschrift als drei getrennte Überschriften setzen; Artikel 2 bleibt unverändert. Bei Variante B bleiben Titel, Inhaltsverzeichnis und Kopf unverändert. In beiden Varianten bleiben die fünf Verweise anderer Blätter auf das „Staatsschutzamt-Errichtungsgesetz“ richtig; die „dieses Gesetz“-Bezüge in Artikel 1 beziehen sich auf das Stammgesetz. [TÜ] Im HTML stehen die vier Zeilen in einer einzigen Überschrift; der Parser erkennt Abschnitt 1 nicht.

**E-67 · OGVBl. 2026 Nr. 91, Artikel 1 § 3 Absatz 2 Nummer 2 (LfStErrG) (zu N-31) · [VK redaktionell]**

Bisher:

> 2. für sonstige Überwachungsmaßnahmen, die einer Vorabanordnung bedürfen, von der Staatsschutzkommission nach dem Staatsschutz- und Nachrichtendienstgesetz,

Ersatzformulierung:

> 2. für sonstige Überwachungsmaßnahmen, die nach dem Staatsschutz- und Nachrichtendienstgesetz einer vorherigen Anordnung bedürfen, von der Staatsschutzkommission nach dem Staatsschutz-Kontrollgesetz,

Hinweis: „Vorabanordnung“ 1 Treffer. Vertretbar ist die v2-Fassung allenfalls in der Lesart, die Anordnungspflicht beruhe auf dem OstSNDG; sie ist aber die einzige Stelle im Paket, die die Kommission dem OstSNDG zuordnet.

**E-68 · OGVBl. 2026 Nr. 91, Artikel 1 § 5 Absatz 3 und 4 (LfStErrG) (zu B-21, Entscheidung 2) · [VK] [VL?]**

Bisher (Absatz 4):

> (4) Weisungen nach Absatz 2 dürfen nicht dazu dienen, Maßnahmen herbeizuführen, die das Landesamt für Staatsschutz nach diesem Gesetz oder dem Staatsschutz- und Nachrichtendienstgesetz selbst nicht treffen dürfte. Weisungen in laufenden strafrechtlichen Ermittlungsverfahren sind unzulässig. Die Kasernierte Grenzpolizei ist von Absatz 2 ausgenommen.

Variante A (ersetzt Absatz 4):

> (4) Weisungen nach Absatz 2 dürfen nicht dazu dienen, Maßnahmen herbeizuführen, die das Landesamt für Staatsschutz nach diesem Gesetz oder dem Staatsschutz- und Nachrichtendienstgesetz selbst nicht treffen dürfte. Weisungen in laufenden strafrechtlichen Ermittlungsverfahren sind unzulässig. Die Volkspolizei und die Kasernierte Grenzpolizei sind von Absatz 2 ausgenommen.

Bisher (Absatz 3):

> (3) Weisungen nach Absatz 2 sind dem zuständigen Mitglied des Staatsrates unverzüglich mitzuteilen. Es kann sie jederzeit aufheben oder ändern.

Variante B (ersetzt Absatz 3):

> (3) Weisungen nach Absatz 2 sind dem zuständigen Mitglied des Staatsrates und, soweit sie an Polizeidienststellen gerichtet sind, der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes unverzüglich mitzuteilen. Das zuständige Mitglied des Staatsrates kann sie jederzeit aufheben oder ändern. Widersprechen sich eine Weisung nach Absatz 2 und eine Weisung der obersten Polizeibehörde, entscheidet das zuständige Mitglied des Staatsrates; bis zu seiner Entscheidung ist die Weisung nach Absatz 2 zu befolgen.

Entscheidung der Volkskammer (B-21, Entscheidung 2): Variante A nimmt die Volkspolizei und die Grenzpolizei von Weisungen des Landesamtes aus. Variante B behält das Weisungsrecht bei, mit Mitteilung auch an die oberste Polizeibehörde, Konfliktentscheidung durch das zuständige Mitglied des Staatsrates und vorläufigem Vorrang der Weisung des Landesamtes bis zu dieser Entscheidung. Ohne verfassungsrechtliche Bewertung.

Hinweis: „Volkspolizei“ wie Nr. 90 Art. 1 § 1 Nr. 1 und Nr. 98 Art. 1 § 1 Abs. 4; das sind nach PVDG § 1 Satz 3 n. F. die Polizeidienststellen nach VPOG § 2 Abs. 2, nicht die oberste Polizeibehörde (VPOG § 2 Abs. 1) und die Hochschule der Volkspolizei (FH) (VPOG § 2 Abs. 3); Variante A nimmt diese beiden nicht von Absatz 2 aus. Die Verweise in Nr. 93 Art. 1 § 4 Abs. 1 Nr. 3 und Nr. 90 Art. 1 § 9 Abs. 3 bleiben gültig. Ohne den letzten Halbsatz in Variante B bliebe die Rechtslage bis zur Entscheidung des zuständigen Mitglieds offen. Entscheidung 1 zu B-21 bei E-69.

**E-69 · OGVBl. 2026 Nr. 91, Artikel 1 § 6 Absatz 1 (LfStErrG) (zu B-21, Entscheidung 1) · [VK] [VL?]**

Bisher:

> (1) Das Landesamt für Staatsschutz darf Polizeidienststellen angegliedert werden. Bedienstete des Landesamtes für Staatsschutz dürfen zugleich einer Polizeidienststelle angehören.

Variante A:

> (1) Das Landesamt für Staatsschutz und Polizeidienststellen oder die Kasernierte Grenzpolizei dürfen einander nicht angegliedert werden. Bedienstete des Landesamtes für Staatsschutz dürfen nicht zugleich einer Polizeidienststelle oder der Kasernierten Grenzpolizei angehören.

Variante B:

> (1) Das Landesamt für Staatsschutz darf einer Polizeidienststelle angegliedert werden. Bedienstete des Landesamtes für Staatsschutz dürfen zugleich einer Polizeidienststelle angehören. § 5 Absatz 3 Satz 2 des Ostdeutschen Sicherheitsgesetzes und § 1 Absatz 2 des Sicherheitsbehörden-Zusammenarbeitsgesetzes bleiben unberührt.

Entscheidung der Volkskammer (B-21, Entscheidung 1): Variante A: Trennung wie bisher nach OstVSG § 1 Abs. 4, ausdrücklich auch gegenüber der Kasernierten Grenzpolizei. Variante B: Angliederung und Personalunion zulässig, mit Klarstellung des Verhältnisses zur getrennten Einheit im GLAZ Ost (Nr. 90 Art. 1 § 5 Abs. 3 Satz 2) und zum informationellen Trennungsprinzip (Nr. 98 Art. 1 § 1 Abs. 2). Ohne verfassungsrechtliche Bewertung.

Hinweis: Indiz für [VL?]: OstVSG § 1 Abs. 4 lautet „Das Landesamt für Verfassungsschutz und Polizeibehörden oder Polizeidienststellen dürfen einander nicht angegliedert werden.“; § 6 Abs. 1 ist dessen genaue Umkehrung. Ob „Polizeidienststellen“ hier die Grenzpolizei über PVDG § 97 Abs. 1 n. F. einschließt, ist offen, weil sie keine Polizeidienststelle nach VPOG § 2 Abs. 2 ist; Variante A nennt die Grenzpolizei ausdrücklich und gilt deshalb in beiden Lesarten.

**E-70 · OGVBl. 2026 Nr. 91, Artikel 1 § 7 Absatz 2 (LfStErrG) (zu B-19) · [VK redaktionell]**

Bisher:

> (2) Die Präsidentin oder der Präsident wird vom Staatsrat auf Vorschlag des zuständigen Mitglieds des Staatsrates ernannt.
>
> Vor der Ernennung ist das Parlamentarische Kontrollgremium nach dem Staatsschutz-Kontrollgesetz anzuhören.

Ersatzformulierung:

> (2) Die Präsidentin oder der Präsident wird vom Staatsrat auf Vorschlag des zuständigen Mitglieds des Staatsrates ernannt. Vor der Ernennung ist das Parlamentarische Kontrollgremium nach dem Staatsschutz-Kontrollgesetz anzuhören.

Hinweis: Nur Zusammenführung zu einem Absatzelement; der Wortlaut einschließlich der in Nr. 91 durchgehend verwendeten Paarform bleibt unverändert.

**E-71 · OGVBl. 2026 Nr. 91, Artikel 1 § 7 Absatz 3 (LfStErrG) (zu B-19) · [VK redaktionell]**

Bisher:

> (3) Die Präsidentin oder der Präsident wird durch eine Vizepräsidentin oder einen Vizepräsidenten vertreten.
>
> Absatz 2 gilt entsprechend.

Ersatzformulierung:

> (3) Die Präsidentin oder der Präsident wird durch eine Vizepräsidentin oder einen Vizepräsidenten vertreten. Absatz 2 gilt entsprechend.

Hinweis: Nur Zusammenführung zu einem Absatzelement.

**E-72 · OGVBl. 2026 Nr. 91, Artikel 1 § 8 Absatz 3 Satz 2 (LfStErrG) (zu B-26, nur Entscheidung 2 Variante B; Entscheidung bei E-87) · [VK]**

Bisher:

> Sie ist dem Parlamentarischen Kontrollgremium vorzulegen.

Ersatzformulierung (Variante B):

> Sie ist dem Parlamentarischen Kontrollgremium für den Staatsschutz vorzulegen.

Hinweis: Nach einer Umbenennung passten die unqualifizierten Nennungen in Nr. 91 dem Wortlaut nach eher auf das gleichnamige Gremium des Ostdeutschen Kontrollgesetzes. Trefferzahl in Nr. 91: 1.

**E-73 · OGVBl. 2026 Nr. 91, Artikel 1 § 9 Absatz 3 (LfStErrG) (zu B-26, nur Entscheidung 2 Variante B; Entscheidung bei E-87) · [VK]**

Bisher:

> (3) Weisungen, die eine Maßnahme gegen eine bestimmte Partei, Fraktion oder ein Mitglied der Volkskammer betreffen, ergehen schriftlich und sind dem Parlamentarischen Kontrollgremium unverzüglich mitzuteilen.

Ersatzformulierung (Variante B):

> (3) Weisungen, die eine Maßnahme gegen eine bestimmte Partei, Fraktion oder ein Mitglied der Volkskammer betreffen, ergehen schriftlich und sind dem Parlamentarischen Kontrollgremium für den Staatsschutz unverzüglich mitzuteilen.

**E-74 · OGVBl. 2026 Nr. 91, Artikel 1 § 10 Absatz 3 Satz 1 (LfStErrG) (zu B-26, nur Entscheidung 2 Variante B; Entscheidung bei E-87) · [VK]**

Bisher:

> Bedienstete können sich in dienstlichen Angelegenheiten ohne Einhaltung des Dienstweges an das Parlamentarische Kontrollgremium wenden.

Ersatzformulierung (Variante B):

> Bedienstete können sich in dienstlichen Angelegenheiten ohne Einhaltung des Dienstweges an das Parlamentarische Kontrollgremium für den Staatsschutz wenden.

**E-75 · OGVBl. 2026 Nr. 91, Artikel 1 § 11 Absatz 2 Satz 2 (LfStErrG) (zu B-26, nur Entscheidung 2 Variante B; Entscheidung bei E-87) · [VK]**

Bisher:

> Sie werden dem Parlamentarischen Kontrollgremium zur Beratung und dem Rechnungshof zur Prüfung vorgelegt.

Ersatzformulierung (Variante B):

> Sie werden dem Parlamentarischen Kontrollgremium für den Staatsschutz zur Beratung und dem Rechnungshof zur Prüfung vorgelegt.

**E-76 · OGVBl. 2026 Nr. 91, Artikel 2 (zu N-30, nur Variante B; Entscheidung bei E-66) · [VK redaktionell]**

Bisher:

> Artikel 2
>
> Inkrafttreten
>
> Dieses Gesetz tritt am 1. Januar 2027 in Kraft.

Ersatzformulierung (Variante B):

> § 14
>
> Inkrafttreten
>
> Dieses Gesetz tritt am 1. Januar 2027 in Kraft.

Hinweis: Steht als letzter Paragraph in Abschnitt 4 „Übergangs- und Schlussvorschriften“; entspricht wörtlich K-07. Der dreizeilige Block steht wortgleich auch in Nr. 89, 93 und 95; in Nr. 91 einmal.

**E-76a · OGVBl. 2026 Nr. 91, Artikel 1 § 13 (LfStErrG) (zu N-56) · [VK] formal**

Bisher:

> Durch dieses Gesetz werden die Grundrechte auf körperliche Unversehrtheit und Freiheit der Person (Artikel 2 Absatz 2 des Grundgesetzes), des Brief-, Post- und Fernmeldegeheimnisses (Artikel 10 des Grundgesetzes), auf Unverletzlichkeit der Wohnung (Artikel 13 des Grundgesetzes) und auf Eigentum (Artikel 14 des Grundgesetzes) eingeschränkt.

Ersatzformulierung:

> Durch dieses Gesetz werden die Grundrechte auf körperliche Unversehrtheit und Freiheit der Person (Artikel 2 Absatz 2 des Grundgesetzes, Artikel 16 Absatz 1 der Verfassung des Freistaates Ostdeutschland), des Brief-, Post- und Fernmeldegeheimnisses (Artikel 10 des Grundgesetzes, Artikel 27 Absatz 1 der Verfassung des Freistaates Ostdeutschland), auf Unverletzlichkeit der Wohnung (Artikel 13 des Grundgesetzes, Artikel 30 Absatz 1 der Verfassung des Freistaates Ostdeutschland) und auf Eigentum (Artikel 14 des Grundgesetzes, Artikel 31 der Verfassung des Freistaates Ostdeutschland) eingeschränkt.

Hinweis: Artikelangaben nach der Verfassung in der Fassung vom 12. September 2026 (Art. 16 „Recht auf Leben und körperliche Unversehrtheit; Freiheit der Person“, Art. 27 „Brief-, Post- und Fernmeldegeheimnis“, Art. 30 „Unverletzlichkeit der Wohnung“, Art. 31 „Eigentum“) und in der Zitierweise von PVDG § 10. Bei Variante B zu N-30 (E-66) steht die Vorschrift unverändert als § 13 im Stammgesetz. Rein formal. Treffer 1.

#### OGVBl. 2026 Nr. 92

**E-77 · OGVBl. 2026 Nr. 92, Artikel 1, nach der Titelzeile des OstSNDG und vor § 1 (zu N-32) · [VK redaktionell]**

Bisher (Einfügestelle):

> Gesetz über den Staatsschutz und die nachrichtendienstliche Aufklärung im Freistaat Ostdeutschland (Staatsschutz- und Nachrichtendienstgesetz – OstSNDG)

Einfügen nach der Titelzeile:

> Abschnitt 1
>
> Allgemeine Bestimmungen

Hinweis: Format wie die Überschriften „Abschnitt 2“ bis „Abschnitt 5“; Bezeichnung wie in Nr. 90 und Nr. 94. Keine Sachentscheidung.

**E-78 · OGVBl. 2026 Nr. 92, Artikel 1 § 1 Absatz 1 Nummer 1 (OstSNDG) (zu N-33) · [VK redaktionell]**

Bisher:

> terroristische Bestrebungen;

Ersatzformulierung:

> 1. terroristische Bestrebungen,

Hinweis: Einheitlich Komma wie in § 1 Abs. 2 und im Vorbild OstVSG § 2 Abs. 1 Satz 1; Nummer 6 schließt mit Punkt (bei E-81 Variante A mit Komma). Trefferzahl: 1.

**E-79 · OGVBl. 2026 Nr. 92, Artikel 1 § 1 Absatz 1 Nummer 2 (OstSNDG) (zu N-33) · [VK redaktionell]**

Bisher:

> sicherheitsgefährdende oder geheimdienstliche Tätigkeiten für eine fremde Macht im Geltungsbereich des Grundgesetzes;

Ersatzformulierung:

> 2. sicherheitsgefährdende oder geheimdienstliche Tätigkeiten für eine fremde Macht im Geltungsbereich des Grundgesetzes,

**E-80 · OGVBl. 2026 Nr. 92, Artikel 1 § 1 Absatz 1 Nummer 3 (OstSNDG) (zu N-34, N-33) · [VK]**

Bisher:

> Sabotage und Bestrebungen, die sich gegen kritische Infrastruktur richten;

Variante A:

> 3. Sabotage und Bestrebungen, die sich gegen kritische Infrastruktur richten, auch soweit sie nicht auf eines der in den Nummern 4 bis 6 genannten Ziele gerichtet sind,

Variante B (Inhalt unverändert, nur Zeichensetzung nach N-33):

> 3. Sabotage und Bestrebungen, die sich gegen kritische Infrastruktur richten,

Entscheidung der Volkskammer: Variante A erfasst Bestrebungen gegen kritische Infrastruktur eigenständig, ohne Bezug zu den Zielen nach Nr. 4 bis 6; die übrigen Merkmale einer Bestrebung (politisch bestimmt, ziel- und zweckgerichtet) bleiben. Variante B lässt den Inhalt unverändert; erfasst sind dann nur Bestrebungen im Sinne des § 2 Abs. 1 Nr. 1.

Hinweis: Variante A enthält die Kommakorrektur aus N-33. Trefferzahl: 1.

**E-81 · OGVBl. 2026 Nr. 92, Artikel 1 § 1 Absatz 1 Nummer 6 und neue Nummer 7 (OstSNDG) (zu B-25, Entscheidung 2) · [VK]**

Bisher:

> Bestrebungen, die gegen den Gedanken der Völkerverständigung, insbesondere gegen das friedliche Zusammenleben der Völker, gerichtet sind.

Variante A:

> 6. Bestrebungen, die gegen den Gedanken der Völkerverständigung, insbesondere gegen das friedliche Zusammenleben der Völker, gerichtet sind,
>
> 7. fortwirkende Strukturen und Tätigkeiten der Aufklärungs- und Abwehrdienste der ehemaligen Deutschen Demokratischen Republik im Geltungsbereich dieses Gesetzes.

Variante B: keine Änderung; die Aufgabe entfällt bewusst.

Entscheidung der Volkskammer (B-25, Entscheidung 2): Wird die Beobachtung fortwirkender Strukturen der Aufklärungs- und Abwehrdienste der DDR (bisher OstVSG § 2 Abs. 1 Satz 1 Nr. 4) als Aufgabe wieder aufgenommen (Variante A) oder entfällt sie (Variante B)? Für sie gibt es keine andere Grundlage. B-25 umfasst drei Entscheidungen: § 17 Abs. 2 (E-95), DDR-Strukturen (dieser Eintrag), Einbürgerung (E-82).

Hinweis: Wortlaut nach OstVSG § 2 Abs. 1 Satz 1 Nr. 4. Keine Folgeänderungen: Nummer 7 ist keine Bestrebung, § 2 Abs. 1 Nr. 1 und § 13 Abs. 2 („Nummer 4 bis 6“) bleiben richtig; für Nummer 7 gilt wie bisher nur die Prüffrist nach § 13 Abs. 1. Die Verweise in Nr. 98 („Nummer 2 und 3“) bleiben unberührt. Trefferzahl: 1.

**E-82 · OGVBl. 2026 Nr. 92, Artikel 1 § 1 Absatz 2 Nummer 3 und 4, neue Nummer 5 (OstSNDG) (zu B-25, Entscheidung 3) · [VK]**

Bisher (Nummer 3):

> bei der Verfassungstreueprüfung nach dem Verfassungstreueprüfungsgesetz und

Variante A (Nummer 3):

> 3. bei der Verfassungstreueprüfung nach dem Verfassungstreueprüfungsgesetz,

Bisher (Nummer 4):

> bei der Beratung der Betreiber:innen kritischer Infrastruktur zum Schutz vor Spionage und Sabotage.

Variante A (Nummer 4 und neue Nummer 5):

> 4. bei der Beratung der Betreiber:innen kritischer Infrastruktur zum Schutz vor Spionage und Sabotage und
>
> 5. auf Ersuchen der für Einbürgerung zuständigen Behörden bei der sicherheitsmäßigen Überprüfung von Personen, die ihre Einbürgerung beantragt haben.

Variante B: keine Änderung.

Entscheidung der Volkskammer (B-25, Entscheidung 3): Variante A nimmt die Mitwirkung bei Einbürgerungen (bisher OstVSG § 2 Abs. 2 Satz 1 Nr. 5) als § 1 Abs. 2 Nr. 5 auf; sie wirkt deklaratorisch. Bei Variante B stützt sich die Mitwirkung allein auf Bundesrecht (StAG § 37 Abs. 2) in Verbindung mit LfStErrG § 2 Abs. 1 und 2.

Hinweis: Wortlaut nach OstVSG § 2 Abs. 2 Satz 1 Nr. 5 mit neutraler Personenbezeichnung; beide Teile der Variante A nur zusammen übernehmen. Der Bezug auf StAG § 37 Abs. 2 ist ohne Netzzugriff nicht gegengelesen; vor Übernahme am Bundesrecht prüfen. Trefferzahlen je 1.

**E-83 · OGVBl. 2026 Nr. 92, Artikel 1 § 2 Absatz 1 Nummer 1 (OstSNDG) (zu B-23) · [VK]**

Bisher:

> Bestrebungen: politisch bestimmte, ziel- und zweckgerichtete Verhaltensweisen in einem oder für einen Personenzusammenschluss, die auf eines der in § 1 Absatz 1 Nummer 4 bis 6 genannten Ziele gerichtet sind. Verhaltensweisen von Einzelpersonen sind Bestrebungen, wenn sie auf Anwendung von Gewalt gerichtet oder aufgrund ihrer Wirkungsweise geeignet sind, ein solches Ziel erheblich zu beschädigen,

Ersatzformulierung:

> 1. Bestrebungen: politisch bestimmte, ziel- und zweckgerichtete Verhaltensweisen in einem oder für einen Personenzusammenschluss, die auf eines der in § 1 Absatz 1 Nummer 4 bis 6 genannten Ziele gerichtet sind. Verhaltensweisen von Einzelpersonen sind Bestrebungen, wenn sie auf Anwendung von Gewalt gerichtet oder aufgrund ihrer Wirkungsweise geeignet sind, eines der in § 1 Absatz 1 Nummer 4 bis 6 genannten Schutzgüter erheblich zu beschädigen;

Hinweis: Semikolon, weil die Nummer zwei vollständige Sätze enthält (übliche Praxis, vgl. OstVSG § 3 Abs. 1; keine wörtliche Regel des Handbuchs). „Schutzgüter“ nach dem Vorbild OstVSG § 3 Abs. 1 Satz 3 („ein Schutzgut dieses Gesetzes erheblich zu beschädigen“); der Mangel bestand schon in v1. Trefferzahl: 1.

**E-84 · OGVBl. 2026 Nr. 92, Artikel 1 § 2 Absatz 1 Nummer 2 (OstSNDG) (zu B-23) · [VK redaktionell]**

Bisher:

> terroristische Bestrebungen: ziel- und zweckgerichtete Verhaltensweisen, die auf die Begehung von Straftaten nach § 129a Absatz 1 oder 2 des Strafgesetzbuches gerichtet sind oder solche Straftaten vorbereiten oder fördern,

Ersatzformulierung:

> 2. terroristische Bestrebungen: ziel- und zweckgerichtete Verhaltensweisen, die auf die Begehung von Straftaten nach § 129a Absatz 1 oder 2 des Strafgesetzbuches gerichtet sind oder solche Straftaten vorbereiten oder fördern;

Hinweis: Angleichung an das Semikolon nach Nummer 1; Nummer 3 schließt mit Punkt (E-85). Trefferzahl: 1.

**E-85 · OGVBl. 2026 Nr. 92, Artikel 1 § 2 Absatz 1 Nummer 3 (OstSNDG) (zu N-35) · [VK]**

Bisher:

> kritische Infrastruktur: Anlagen und Einrichtungen im Sinne des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland.

Ersatzformulierung:

> 3. kritische Infrastruktur: Anlagen, Einrichtungen und Systeme im Sinne des § 2 Nummer 1 des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland.

Entscheidung der Volkskammer: Ist die Verengung auf Anlagen und Einrichtungen beabsichtigt, bleibt der v2-Wortlaut; andernfalls wird die Ersatzformulierung übernommen. Die Entscheidung gilt gleich für Nr. 90 Art. 1 § 1 Nr. 3 (E-58).

Hinweis: Verweisziel geprüft (Nr. 94 Art. 1 § 2 Nr. 1); Gesetzestitel wortgleich; Inkrafttreten am 1.1.2027 wie Nr. 92. Trefferzahl in Nr. 92: 1 (wortgleich auch in Nr. 90 Art. 1 § 1 Nr. 3, siehe E-58).

**E-86 · OGVBl. 2026 Nr. 92, Artikel 1 § 3 Absatz 1 Satz 2 (OstSNDG) (zu N-36, N-37) · [VK]**

Bisher:

> Das Landesamt darf die Polizei nicht im Wege der Amtshilfe um Maßnahmen ersuchen, zu denen es selbst nicht befugt ist.

Ersatzformulierung:

> Der Staatsschutz darf die Polizei nicht im Wege der Amtshilfe um Maßnahmen ersuchen, zu denen er selbst nicht befugt ist; die Vollzugshilfe nach § 4 Absatz 4 Satz 2 des Staatsschutzamt-Errichtungsgesetzes bleibt unberührt.

Hinweis: Vorbehalt wie Nr. 90 Art. 1 § 2 Abs. 2, auf Satz 2 präzisiert; enthält zugleich die Bezeichnungskorrektur aus N-37. Trefferzahl: 1.

**E-87 · OGVBl. 2026 Nr. 92, Artikel 1 § 3 Absatz 3 (OstSNDG) (zu B-26, Entscheidung 2) · [VK] [VL?]**

Bisher:

> (3) Die Beobachtung von Mitgliedern der Volkskammer und ihrer Fraktionen ist nur zulässig, wenn tatsächliche Anhaltspunkte dafür bestehen, dass sie Bestrebungen nach § 1 Absatz 1 selbst verfolgen; sie ist dem Parlamentarischen Kontrollgremium vorher mitzuteilen.

Variante A:

> (3) Die Beobachtung von Mitgliedern der Volkskammer und ihrer Fraktionen ist nur zulässig, wenn tatsächliche Anhaltspunkte dafür bestehen, dass sie Bestrebungen nach § 1 Absatz 1 selbst verfolgen; sie ist dem Parlamentarischen Kontrollgremium nach dem Staatsschutz-Kontrollgesetz vorher mitzuteilen.

Variante B:

> (3) Die Beobachtung von Mitgliedern der Volkskammer und ihrer Fraktionen ist nur zulässig, wenn tatsächliche Anhaltspunkte dafür bestehen, dass sie Bestrebungen nach § 1 Absatz 1 selbst verfolgen; sie ist dem Parlamentarischen Kontrollgremium für den Staatsschutz vorher mitzuteilen.

Entscheidung der Volkskammer (B-26, Entscheidung 2 – Bezeichnung): Das Ostdeutsche Kontrollgesetz („Der Landtag richtet ein Parlamentarisches Kontrollgremium (PKG) ein.“) gilt ab 1.1.2027 fort; es gibt dann zwei gleichnamige Gremien. Variante A behält den Namen und qualifiziert die einzige unqualifizierte Nennung im OstSNDG wie Nr. 90 § 13, Nr. 91 § 7 Abs. 2 und Nr. 98 § 8 Abs. 2. Variante B benennt das Gremium in „Parlamentarisches Kontrollgremium für den Staatsschutz“ um; dazu gehören E-100, E-101, E-72 bis E-75, E-147 und E-141 in der Fassung zu Variante B. Entscheidung 1 (Sitzungsrhythmus) bei E-102.

Hinweis: Die qualifizierten Nennungen „nach dem Staatsschutz-Kontrollgesetz“ in Nr. 90, 91 und 98 bleiben auch nach einer Umbenennung eindeutig. Nr. 99 Art. 3 Abs. 1 Nr. 3 wird dagegen angepasst, weil die Ersetzungsregel die Bezeichnung in andere Rechtsvorschriften überträgt. Trefferzahl: 1.

**E-88 · OGVBl. 2026 Nr. 92, Artikel 1 § 4 Absatz 2 (OstSNDG) (zu N-37) · [VK redaktionell]**

Bisher:

> (2) Das Landesamt darf Informationen offen erheben, insbesondere aus allgemein zugänglichen Quellen, und Auskunftsersuchen an öffentliche Stellen richten.

Ersatzformulierung:

> (2) Der Staatsschutz darf Informationen offen erheben, insbesondere aus allgemein zugänglichen Quellen, und Auskunftsersuchen an öffentliche Stellen richten.

Hinweis: Trefferzahl: 1.

**E-89 · OGVBl. 2026 Nr. 92, Artikel 1 § 5 Absatz 3 Nummer 4 und anschließender Text (OstSNDG) (zu N-38) · [VK]**

Bisher:

> der Einsatz von Vertrauenspersonen und verdeckt arbeitenden Bediensteten nach § 8. Sie dürfen nur eingesetzt werden, wenn hinreichende tatsächliche Anhaltspunkte dafür bestehen, dass die Bestrebung oder Tätigkeit wegen ihrer Gewaltorientierung, ihres terroristischen Charakters, ihrer Ausrichtung gegen kritische Infrastruktur oder der Steuerung durch eine fremde Macht gesteigert beobachtungsbedürftig ist. Sie richten sich nur gegen Personen, die die Bestrebung oder Tätigkeit verfolgen oder unterstützen; gegen andere Personen nur, wenn sie mit diesen in Verbindung stehen und die Maßnahme sonst aussichtslos wäre.

Ersatzformulierung:

> 4. der Einsatz von Vertrauenspersonen und verdeckt arbeitenden Bediensteten nach § 8.
>
> Sie dürfen nur eingesetzt werden, wenn hinreichende tatsächliche Anhaltspunkte dafür bestehen, dass die Bestrebung oder Tätigkeit wegen ihrer Gewaltorientierung, ihres terroristischen Charakters, ihrer Ausrichtung gegen kritische Infrastruktur oder der Steuerung durch eine fremde Macht gesteigert beobachtungsbedürftig ist. Sie richten sich nur gegen Personen, die die Bestrebung oder Tätigkeit verfolgen oder unterstützen; gegen andere Personen nur, wenn sie mit diesen in Verbindung stehen und die Maßnahme sonst aussichtslos wäre.

Hinweis: Die zweite Zeile ist nicht nummerierter Absatztext nach der Aufzählung (wie § 5 Abs. 2 Satz 2), nicht Teil des Listeneintrags 4. Der Wortlaut bleibt unverändert. Trefferzahl: 1.

**E-90 · OGVBl. 2026 Nr. 92, Artikel 1 § 8 Absatz 1 Nummer 4 (OstSNDG) (zu N-33) · [VK redaktionell]**

Bisher:

> wegen eines Verbrechens oder zu einer Freiheitsstrafe ohne Bewährung verurteilt worden ist, deren Vollstreckung nicht länger als fünf Jahre zurückliegt,

Ersatzformulierung:

> 4. wegen eines Verbrechens oder zu einer Freiheitsstrafe ohne Bewährung verurteilt worden ist, deren Vollstreckung nicht länger als fünf Jahre zurückliegt, oder

Hinweis: Jeder Ausschlussgrund gilt für sich. Trefferzahl: 1.

**E-91 · OGVBl. 2026 Nr. 92, Artikel 1 § 13 Absatz 2 (OstSNDG) (zu B-24, N-37) · [VK]**

Bisher:

> (2) Daten über Bestrebungen nach § 1 Absatz 1 Nummer 4 bis 6 sind spätestens zehn Jahre nach der letzten gespeicherten relevanten Information zu löschen, Daten über terroristische Bestrebungen und Tätigkeiten nach § 1 Absatz 1 Nummer 2 und 3 spätestens nach 15 Jahren, es sei denn, die Leitung des Landesamtes stellt im Einzelfall fest, dass die weitere Speicherung erforderlich ist.

Ersatzformulierung:

> (2) Daten über Bestrebungen nach § 1 Absatz 1 Nummer 4 bis 6 sind spätestens zehn Jahre, Daten über Bestrebungen und Tätigkeiten nach § 1 Absatz 1 Nummer 1 bis 3 spätestens 15 Jahre nach der letzten gespeicherten relevanten Information zu löschen, es sei denn, die Leitung des Staatsschutzes stellt im Einzelfall fest, dass die weitere Speicherung erforderlich ist.

Entscheidung der Volkskammer: Keine Variantenentscheidung. Mit der Ersatzformulierung bestätigt die Volkskammer, dass auch die 15-Jahres-Frist ab der letzten gespeicherten relevanten Information läuft; v2 lässt diesen Fristbeginn offen.

Hinweis: „Bestrebungen und Tätigkeiten nach § 1 Absatz 1 Nummer 1 bis 3“ folgt dem Oberbegriff des Gesetzes (§ 4 Abs. 1, § 5 Abs. 2, § 12) und erfasst die Sabotage in Nr. 3. „Leitung des Staatsschutzes“ bezeichnet die Präsident:in nach LfStErrG § 7 Abs. 1, die Vertretung folgt aus § 7 Abs. 3. Vorbild für den Fristbeginn: OstVSG § 7 Abs. 3 Satz 2. Trefferzahl: 1.

**E-92 · OGVBl. 2026 Nr. 92, Artikel 1 § 15 Absatz 2 (OstSNDG) (zu N-39) · [VK redaktionell]**

Bisher:

> (2) Die / der Ostdeutsche Datenschutzbeauftragte kontrolliert die Datenverarbeitung, soweit nicht die Staatsschutzkommission zuständig ist, mindestens alle zwei Jahre.

Ersatzformulierung:

> (2) Die:der Ostdeutsche Datenschutzbeauftragte kontrolliert die Datenverarbeitung, soweit nicht die Staatsschutzkommission zuständig ist, mindestens alle zwei Jahre.

Hinweis: Die Paarform in § 14 Abs. 2 („an die oder den Ostdeutschen Datenschutzbeauftragten“) ist zulässig und bleibt. Trefferzahl: 1.

**E-93 · OGVBl. 2026 Nr. 92, Artikel 1 § 16 Absatz 1 Satz 1 (OstSNDG) (zu N-37) · [VK redaktionell]**

Bisher:

> Der Staatsschutz darf personenbezogene Daten, die das Landesamt mit nachrichtendienstlichen Mitteln erhoben hat, an die Polizei nur übermitteln, wenn dies zur Abwehr einer wenigstens konkretisierten Gefahr für ein besonders gewichtiges Rechtsgut erforderlich ist.

Ersatzformulierung:

> Der Staatsschutz darf personenbezogene Daten, die er mit nachrichtendienstlichen Mitteln erhoben hat, an die Polizei nur übermitteln, wenn dies zur Abwehr einer wenigstens konkretisierten Gefahr für ein besonders gewichtiges Rechtsgut erforderlich ist.

Hinweis: Trefferzahl: 1.

**E-94 · OGVBl. 2026 Nr. 92, Artikel 1 § 16 Absatz 2 (OstSNDG) (zu N-37) · [VK redaktionell]**

Bisher:

> (2) An Strafverfolgungsbehörden darf das Landesamt solche Daten nur übermitteln, wenn bestimmte Tatsachen den Verdacht einer besonders schweren Straftat begründen, insbesondere einer Straftat nach §§ 89a, 89c, 129a, 129b oder 94 bis 100a des Strafgesetzbuches.

Ersatzformulierung:

> (2) An Strafverfolgungsbehörden darf der Staatsschutz solche Daten nur übermitteln, wenn bestimmte Tatsachen den Verdacht einer besonders schweren Straftat begründen, insbesondere einer Straftat nach den §§ 89a, 89c, 94 bis 100a, 129a oder 129b des Strafgesetzbuches.

Hinweis: Zugleich Artikel „den“ vor „§§“ und aufsteigende Paragraphenfolge; inhaltlich unverändert. Trefferzahl: 1.

**E-95 · OGVBl. 2026 Nr. 92, Artikel 1 § 17 Absatz 2 (OstSNDG) (zu B-25, Entscheidung 1) · [VK]**

Bisher:

> (2) Hat ein Land oder der Bund selbst die Übermittlung von Daten an den Staatsschutz verweigert oder ist nicht zu einer Übermittlung zu denselben Bedingungen bereit, so kann der Staatsschutz an andere inländische Stellen zu denselben Bedingungen Übermitteln, wie die inländische Stelle an den Staatsschutz übermitteln kann; in besonderen Fällen unterlässt der Staatsschutz die Übermittlung.

Variante A:

> (2) Verweigert ein anderes Land oder der Bund dem Staatsschutz die Übermittlung von Daten oder macht das andere Land oder der Bund die Übermittlung an den Staatsschutz von Bedingungen abhängig, die über die Voraussetzungen des Absatzes 1 hinausgehen, kann der Staatsschutz die Übermittlung an Stellen dieses Landes oder des Bundes von denselben Bedingungen abhängig machen; in besonderen Fällen unterlässt der Staatsschutz die Übermittlung.

Variante B – Streichen: Absatz 2 (Bisher-Wortlaut) entfällt; die Absätze 3 und 4 werden zu den Absätzen 2 und 3 (E-96, E-97).

Entscheidung der Volkskammer (B-25, Entscheidung 1): Variante A fasst die Gegenseitigkeitsregel ausführbar: Ermessen, beschränkt auf Stellen des Landes oder des Bundes, das die Übermittlung verweigert oder erschwert. Variante B streicht den Absatz. Die Entscheidungen 2 und 3 zu B-25 stehen bei E-81 und E-82.

Hinweis: v2 hat vier Mängel: dem zweiten Glied des Bedingungssatzes fehlt das Subjekt, „Übermitteln“ ist großgeschrieben, „die inländische Stelle“ hat kein Bezugswort, und der Maßstab von „denselben Bedingungen“ ist offen. Variante A behält das Ermessen („kann“) und den Schlusshalbsatz. Weder das Paket noch der Bestand verweisen auf § 17 Abs. 3 oder 4. Trefferzahl: 1.

**E-96 · OGVBl. 2026 Nr. 92, Artikel 1 § 17 Absatz 3 (OstSNDG) (zu N-37; bei E-95 Variante B zugleich zu B-25) · [VK redaktionell]**

Bisher:

> (3) An Betreiber kritischer Infrastruktur darf das Landesamt Informationen übermitteln, soweit dies zur Abwehr einer Gefahr von Spionage oder Sabotage erforderlich ist; personenbezogene Daten nur, wenn dies unerlässlich ist.

Ersatzformulierung, wenn Absatz 2 bestehen bleibt (v2 oder E-95 Variante A):

> (3) An Betreiber kritischer Infrastruktur darf der Staatsschutz Informationen übermitteln, soweit dies zur Abwehr einer Gefahr von Spionage oder Sabotage erforderlich ist; personenbezogene Daten nur, wenn dies unerlässlich ist.

Ersatzformulierung bei E-95 Variante B:

> (2) An Betreiber kritischer Infrastruktur darf der Staatsschutz Informationen übermitteln, soweit dies zur Abwehr einer Gefahr von Spionage oder Sabotage erforderlich ist; personenbezogene Daten nur, wenn dies unerlässlich ist.

Hinweis: Trefferzahl: 1.

**E-97 · OGVBl. 2026 Nr. 92, Artikel 1 § 17 Absatz 4 (OstSNDG) (zu B-25, nur bei E-95 Variante B) · [VK]**

Bisher:

> (4) Für die Übermittlung an ausländische und an nicht öffentliche Stellen gelten im Übrigen die Vorschriften des Bundesverfassungsschutzgesetzes über die Übermittlung durch das Bundesamt für Verfassungsschutz an solche Stellen entsprechend.

Ersatzformulierung (nur bei E-95 Variante B):

> (3) Für die Übermittlung an ausländische und an nicht öffentliche Stellen gelten im Übrigen die Vorschriften des Bundesverfassungsschutzgesetzes über die Übermittlung durch das Bundesamt für Verfassungsschutz an solche Stellen entsprechend.

Hinweis: Trefferzahl: 1.

**E-98 · OGVBl. 2026 Nr. 92, Artikel 1 § 18 Nummer 1 (OstSNDG) (zu N-37) · [VK redaktionell]**

Bisher:

> für das Landesamt erkennbar ist, dass unter Berücksichtigung der Art der Information und ihrer Erhebung die schutzwürdigen Interessen der betroffenen Person das Allgemeininteresse an der Übermittlung überwiegen,

Ersatzformulierung:

> 1. für den Staatsschutz erkennbar ist, dass unter Berücksichtigung der Art der Information und ihrer Erhebung die schutzwürdigen Interessen der betroffenen Person das Allgemeininteresse an der Übermittlung überwiegen,

Hinweis: Trefferzahl: 1.

**E-99 · OGVBl. 2026 Nr. 92, Artikel 1 § 19 Absatz 1 Satz 2 (OstSNDG) (zu N-37) · [VK redaktionell]**

Bisher:

> Das Landesamt veröffentlicht jährlich einen Staatsschutzbericht.

Ersatzformulierung:

> Der Staatsschutz veröffentlicht jährlich einen Staatsschutzbericht.

Hinweis: Trefferzahl: 1.

**E-99a · OGVBl. 2026 Nr. 92, Artikel 2 (zu N-51) · [VK] formal**

Bisher:

> Durch dieses Gesetz werden das Brief-, Post- und Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) und das Recht auf informationelle Selbstbestimmung eingeschränkt.

Ersatzformulierung:

> Durch dieses Gesetz werden das Brief-, Post- und Fernmeldegeheimnis (Artikel 10 des Grundgesetzes, Artikel 27 Absatz 1 der Verfassung des Freistaates Ostdeutschland) und das Recht auf informationelle Selbstbestimmung (Artikel 33 der Verfassung des Freistaates Ostdeutschland) eingeschränkt.

Hinweis: Artikel 27 der Verfassung schützt das Brief-, Post- und Fernmeldegeheimnis, Artikel 33 das Recht auf Datenschutz; vgl. PVDG § 10 Nr. 3 und 7. Rein formal, ohne Bewertung des Eingriffs. Treffer 1.

#### OGVBl. 2026 Nr. 93

**E-100 · OGVBl. 2026 Nr. 93, Artikel 1, Überschrift von Abschnitt 1 (OstSKG) (zu B-26, nur Entscheidung 2 Variante B; Entscheidung bei E-87) · [VK]**

Bisher:

> Abschnitt 1
>
> Parlamentarisches Kontrollgremium

Ersatzformulierung (Variante B):

> Abschnitt 1
>
> Parlamentarisches Kontrollgremium für den Staatsschutz

Hinweis: Trefferzahl in Nr. 93: 1.

**E-101 · OGVBl. 2026 Nr. 93, Artikel 1 § 1 (OstSKG) (zu B-26, N-37) · [VK]; Einfügung [VK redaktionell]**

Bisher:

> Der Staatsrat unterliegt hinsichtlich der Tätigkeit des Staatsschutzes der Kontrolle durch das Parlamentarische Kontrollgremium (Kontrollgremium).

Ersatzformulierung, nur bei B-26 Entscheidung 2 Variante B (Entscheidung bei E-87):

> Der Staatsrat unterliegt hinsichtlich der Tätigkeit des Staatsschutzes der Kontrolle durch das Parlamentarische Kontrollgremium für den Staatsschutz (Kontrollgremium).

Einfügen nach Satz 1 (zu N-37, unabhängig von B-26):

> Staatsschutz im Sinne dieses Gesetzes ist das Landesamt für Staatsschutz nach § 1 des Staatsschutzamt-Errichtungsgesetzes.

Hinweis: Der eingefügte Satz wird Satz 2 und ist wortgleich mit OstSNDG § 1 Abs. 3; bei Variante B folgt er dem neu gefassten Satz 1. Die qualifizierten Nennungen „nach dem Staatsschutz-Kontrollgesetz“ in Nr. 90, 91 und 98 bleiben eindeutig; Nr. 99 Art. 3 Abs. 1 Nr. 3 wird bei Variante B nach E-141 angepasst. Trefferzahl: 1.

**E-102 · OGVBl. 2026 Nr. 93, Artikel 1 § 3 Absatz 1 Satz 1 (OstSKG) (zu B-26, Entscheidung 1) · [VK] [VL?]**

Bisher:

> Das Kontrollgremium tritt in der Regel einmal in der Legislatur zusammen.

Variante A:

> Das Kontrollgremium tritt mindestens einmal im Vierteljahr zusammen.

Variante B:

> Das Kontrollgremium tritt mindestens zweimal im Jahr zusammen.

Entscheidung der Volkskammer (B-26, Entscheidung 1 – Sitzungsrhythmus): Variante A: mindestens vierteljährlich (wie K-13). Variante B: mindestens zweimal im Jahr (wie bisher OstVSG § 16 Abs. 2 Satz 4 für die Parlamentarische Kontrollkommission; entspricht dem halbjährlichen Rhythmus nach § 12 Abs. 3). Entscheidung 2 (Bezeichnung) bei E-87.

Hinweis: Häufigere Sitzungen setzen voraus: § 12 Abs. 3 (halbjährliche Unterrichtung durch die Staatsschutzkommission), § 8 (jährlicher Bericht), Nr. 98 § 8 Abs. 2 (jährliche Unterrichtung), Nr. 90 § 13 (mindestens wöchentliche Unterrichtung in der Krise). Zudem verwendet § 3 „Legislatur“, § 2 „Wahlperiode“. Satz 2 bleibt unverändert. Trefferzahl: 1.

**E-103 · OGVBl. 2026 Nr. 93, Artikel 1 § 5 Absatz 1 Nummer 2 (OstSKG) (zu N-37) · [VK redaktionell]**

Bisher:

> Zutritt zu sämtlichen Dienststellen des Landesamtes zu gewähren und

Ersatzformulierung:

> 2. Zutritt zu sämtlichen Dienststellen des Staatsschutzes zu gewähren und

Hinweis: Trefferzahl: 1.

**E-104 · OGVBl. 2026 Nr. 93, Artikel 1 § 6 Absatz 1 Satz 2 (OstSKG) (zu N-39) · [VK redaktionell]**

Bisher:

> Sie / er muss die Befähigung zum Richteramt besitzen und wird vom Kontrollgremium mit der Mehrheit von zwei Dritteln seiner Mitglieder vorgeschlagen und von der Präsidentin oder dem Präsidenten der Volkskammer bestellt.

Ersatzformulierung:

> Die:der ständige Bevollmächtigte muss die Befähigung zum Richteramt besitzen und wird vom Kontrollgremium mit der Mehrheit von zwei Dritteln seiner Mitglieder vorgeschlagen und von der Präsident:in der Volkskammer bestellt.

Hinweis: „Präsident:in der Volkskammer“ wie Nr. 88; der Satz wird ohnehin neu gefasst, deshalb auch die Paarform angeglichen. Trefferzahl: 1.

**E-105 · OGVBl. 2026 Nr. 93, Artikel 1 § 6 Absatz 2 (OstSKG) (zu N-39) · [VK redaktionell]**

Bisher:

> (2) Die / der ständige Bevollmächtigte nimmt die Befugnisse nach § 5 Absatz 1 im Auftrag des Kontrollgremiums wahr und bereitet dessen Sitzungen vor.

Ersatzformulierung:

> (2) Die:der ständige Bevollmächtigte nimmt die Befugnisse nach § 5 Absatz 1 im Auftrag des Kontrollgremiums wahr und bereitet dessen Sitzungen vor.

**E-106 · OGVBl. 2026 Nr. 93, Artikel 1 § 9 Absatz 1 Satz 1 (OstSKG) (zu N-39) · [VK redaktionell]**

Bisher:

> Die Staatsschutzkommission besteht aus einer / einem Vorsitzenden und vier weiteren Mitgliedern.

Ersatzformulierung:

> Die Staatsschutzkommission besteht aus einer:einem Vorsitzenden und vier weiteren Mitgliedern.

**E-107 · OGVBl. 2026 Nr. 93, Artikel 1 § 9 Absatz 2 Satz 1 (OstSKG) (zu N-39) · [VK redaktionell]**

Bisher:

> Die / der Vorsitzende und mindestens zwei weitere Mitglieder müssen die Befähigung zum Richteramt besitzen und mindestens fünf Jahre als Richter:in tätig gewesen sein.

Ersatzformulierung:

> Die:der Vorsitzende und mindestens zwei weitere Mitglieder müssen die Befähigung zum Richteramt besitzen und mindestens fünf Jahre als Richter:in tätig gewesen sein.

**E-108 · OGVBl. 2026 Nr. 93, Artikel 1 § 12 Absatz 1 Satz 2 (OstSKG) (zu N-39) · [VK redaktionell]**

Bisher:

> Eilentscheidungen kann die/der Vorsitzende allein treffen; sie sind in der nächsten Sitzung zu bestätigen.

Ersatzformulierung:

> Eilentscheidungen kann die:der Vorsitzende allein treffen; sie sind in der nächsten Sitzung zu bestätigen.

**E-109 · OGVBl. 2026 Nr. 93, Artikel 1 § 14 Satz 2 (OstSKG) (zu N-40) · [VK redaktionell]**

Bisher:

> Bis dahin nehmen die nach bisherigem Recht gewählten Mitglieder der Parlamentarischen Kontrollkommission und der G10-Kommission deren Aufgaben wahr.

Ersatzformulierung:

> Bis dahin nehmen die Mitglieder der nach bisherigem Recht gebildeten Parlamentarischen Kontrollkommission die Aufgaben des Kontrollgremiums und die Mitglieder der nach bisherigem Recht gebildeten G 10-Kommission die Aufgaben der Staatsschutzkommission wahr.

Hinweis: „gebildeten“ erfasst gewählte (Parlamentarische Kontrollkommission) und bestellte Mitglieder (G 10-Kommission). Nr. 99 Art. 4 Abs. 4 („gilt § 14 Satz 2 des Staatsschutz-Kontrollgesetzes“) bleibt zutreffend; die Ausnahme nach E-143 bleibt nötig, weil der Satz die alten Gremien weiter nennt. Trefferzahl: 1.

#### OGVBl. 2026 Nr. 94

**E-110 · OGVBl. 2026 Nr. 94, Artikel 1 § 1 Satz 1 (OstKRITISG) (zu N-41) · [VK]**

Bisher:

> Unterliegt ein Betreiber hinsichtlich einer Anlage Pflichten nach Bundesrecht, die den Pflichten nach den §§ 5 und 6 gleichwertig sind, insbesondere nach dem BSI-Gesetz, nach den bundesrechtlichen Vorschriften zur Umsetzung der Richtlinie (EU) 2022/2557 oder nach dem Luftsicherheitsgesetz, gelten für diese Anlage nur die §§ 4, 7, 8 und 14.

Variante A:

> Unterliegt ein Betreiber hinsichtlich einer Anlage Pflichten nach Bundesrecht, die den Pflichten nach den §§ 5 und 6 gleichwertig sind, insbesondere nach dem BSI-Gesetz, nach den bundesrechtlichen Vorschriften zur Umsetzung der Richtlinie (EU) 2022/2557 oder nach dem Luftsicherheitsgesetz, sind die §§ 5 und 6 auf diese Anlage nicht anzuwenden.

Variante B: keine Änderung.

Entscheidung der Volkskammer: Entfallen für bundesrechtlich gleichwertig verpflichtete Anlagen nur die §§ 5 und 6, während §§ 4, 7, 8, 14 und die Befugnis-, Vertraulichkeits- und Bußgeldvorschriften gelten (Variante A)? Oder ist die Beschränkung auf die §§ 4, 7, 8 und 14 einschließlich des Ausschlusses der §§ 10, 11 und 13 gewollt (Variante B)?

Hinweis: Korrekturbefehl: „In Artikel 1 § 1 Satz 1 werden die Wörter ‚gelten für diese Anlage nur die §§ 4, 7, 8 und 14‘ durch die Wörter ‚sind die §§ 5 und 6 auf diese Anlage nicht anzuwenden‘ ersetzt.“ Treffer: 1. Satz 2 (Informationssicherheitsgesetz) bleibt. § 13 Abs. 1 Nr. 2 läuft für diese Anlagen mangels Pflicht nach §§ 5 und 6 von selbst leer; § 10 Abs. 3 und § 9 Abs. 2 Nr. 4 („§§ 4 bis 8“) bleiben stimmig.

**E-111 · OGVBl. 2026 Nr. 94, Artikel 1 § 5 Absatz 1 (OstKRITISG) (zu N-42; gilt für beide Varianten, Entscheidung bei E-112) · [VK]**

Bisher:

> (1) Betreiber erstellen für jede kritische Infrastruktur eine Risikoanalyse, die alle erheblichen natürlichen und vom Menschen verursachten Risiken berücksichtigt, insbesondere Angriffe, Sabotage, Terrorismus, Ausfälle anderer Infrastrukturen und Naturgefahren.

Ersatzformulierung:

> (1) Betreiber erstellen für jede kritische Infrastruktur eine Risikoanalyse, die alle erheblichen natürlichen und vom Menschen verursachten Risiken berücksichtigt, insbesondere Angriffe, Sabotage, Terrorismus, Ausfälle anderer Infrastrukturen und Naturgefahren. Die Risikoanalyse ist innerhalb von sechs Monaten nach der Bestimmung der kritischen Infrastruktur zu erstellen.

Hinweis: Übernimmt die Sechsmonatsfrist aus Art. 2 Satz 2 inhaltlich unverändert ins Stammgesetz. Treffer: 1.

**E-112 · OGVBl. 2026 Nr. 94, Artikel 1 § 6 Absatz 2 (OstKRITISG) (zu N-42) · [VK]**

Bisher:

> (2) Die Maßnahmen werden in einem Resilienzplan dokumentiert.

Variante A:

> (2) Die Maßnahmen werden in einem Resilienzplan dokumentiert. Der Resilienzplan ist innerhalb von sechs Monaten nach der Bestimmung der kritischen Infrastruktur zu erstellen und der Zentralen KRITIS-Stelle auf Verlangen vorzulegen.

Variante B:

> (2) Die Maßnahmen werden in einem Resilienzplan dokumentiert. Der Resilienzplan ist innerhalb von sechs Monaten nach der Bestimmung der kritischen Infrastruktur zu erstellen.

Entscheidung der Volkskammer: Ist der Resilienzplan der Zentralen KRITIS-Stelle auf Verlangen vorzulegen, wie es das bußgeldbewehrte „nicht vorlegt“ voraussetzt (Variante A), oder entfällt die Bußgeldbewehrung der Vorlage für den Resilienzplan (Variante B)? Zugehörig: E-111 und E-118 (beide Varianten), E-115 (je Variante).

**E-113 · OGVBl. 2026 Nr. 94, Artikel 1 § 9 Absatz 2 Nummer 2 (OstKRITISG) (zu B-28) · [VK]**

Bisher:

> wertet Meldungen aus und erstellt ein Lagebild kritischer Infrastrukturen als Teil des Landeslagebildes nach § 8 des Ostdeutschen Sicherheitsgesetzes,

Ersatzformulierung:

> wertet Meldungen aus und erstellt ein Lagebild kritischer Infrastrukturen als Teil des Landeslagebildes nach § 7 des Ostdeutschen Sicherheitsgesetzes,

Hinweis: Listennummer „2.“ bleibt. Korrekturbefehl: „In Artikel 1 § 9 Absatz 2 Nummer 2 wird die Angabe ‚§ 8‘ durch die Angabe ‚§ 7‘ ersetzt.“ Die Angabe „§ 8“ steht in Nummer 2 einmal; der zweite Treffer im Blatt ist die Paragraphenbezeichnung „§ 8“ (Übungen) und wird nicht berührt. Im Sicherheitsgesetz regelt § 7 das Landeslagebild, § 8 den Landeskrisenstab.

**E-114 · OGVBl. 2026 Nr. 94, Artikel 1 § 11 Absatz 1 Satz 2 (OstKRITISG) (zu B-28) · [VK]**

Bisher:

> Sie dürfen nur zur Erfüllung von Aufgaben nach diesem Gesetz, nach dem Ost-Sicherheitsgesetz und zur Gefahrenabwehr verwendet werden.

Ersatzformulierung:

> Sie dürfen nur zur Erfüllung von Aufgaben nach diesem Gesetz, nach dem Ostdeutschen Sicherheitsgesetz und zur Gefahrenabwehr verwendet werden.

Hinweis: Sammelbefehl mit E-117: „In Artikel 1 § 11 Absatz 1 Satz 2 und § 14 wird jeweils das Wort ‚Ost-Sicherheitsgesetz‘ durch die Wörter ‚Ostdeutschen Sicherheitsgesetz‘ ersetzt.“ Treffer je 1, zusammen 2; in Nr. 85 bis 99 sonst 0.

**E-115 · OGVBl. 2026 Nr. 94, Artikel 1 § 13 Absatz 1 Nummer 2 (OstKRITISG) (zu N-42; Entscheidung bei E-112) · [VK]**

Bisher:

> entgegen § 5 oder § 6 Absatz 2 eine Risikoanalyse oder einen Resilienzplan nicht oder nicht rechtzeitig erstellt oder nicht vorlegt,

Variante A:

> entgegen § 5 Absatz 1 Satz 2 oder § 6 Absatz 2 Satz 2 eine Risikoanalyse oder einen Resilienzplan nicht oder nicht rechtzeitig erstellt oder entgegen § 5 Absatz 2 Satz 2 oder § 6 Absatz 2 Satz 2 eine Risikoanalyse oder einen Resilienzplan nicht vorlegt,

Variante B:

> entgegen § 5 Absatz 1 Satz 2 oder § 6 Absatz 2 Satz 2 eine Risikoanalyse oder einen Resilienzplan nicht oder nicht rechtzeitig erstellt oder entgegen § 5 Absatz 2 Satz 2 eine Risikoanalyse nicht vorlegt,

Hinweis: Listennummer „2.“ bleibt; Absatz 2 (Bußgeldrahmen) ist nicht berührt. Vorlagepflicht der Risikoanalyse: § 5 Abs. 2 Satz 2 („Sie ist der Zentralen KRITIS-Stelle auf Verlangen vorzulegen.“).

**E-116 · OGVBl. 2026 Nr. 94, Artikel 1 § 13 Absatz 1 Nummer 3 (OstKRITISG) (zu N-43) · [VK redaktionell]**

Bisher:

> entgegen § 7 Absatz 1 eine Meldung nicht, nicht richtig oder nicht rechtzeitig macht,

Ersatzformulierung:

> entgegen § 7 Absatz 1 eine Meldung nicht, nicht richtig oder nicht rechtzeitig macht oder

Hinweis: Listennummer „3.“ bleibt. Korrekturbefehl: „In Artikel 1 § 13 Absatz 1 Nummer 3 wird das Komma am Ende durch das Wort ‚oder‘ ersetzt.“ Treffer „macht,“: 1.

**E-117 · OGVBl. 2026 Nr. 94, Artikel 1 § 14 (OstKRITISG) (zu B-28) · [VK]**

Bisher:

> Bei einer Sicherheitskrise nach dem Ost-Sicherheitsgesetz stellen Betreiber auf Ersuchen des Landeskrisenstabes Verbindungspersonen und Lageinformationen zur Verfügung.

Ersatzformulierung:

> Bei einer Sicherheitskrise nach dem Ostdeutschen Sicherheitsgesetz stellen Betreiber auf Ersuchen des Landeskrisenstabes Verbindungspersonen und Lageinformationen zur Verfügung.

Hinweis: Siehe Sammelbefehl bei E-114.

**E-118 · OGVBl. 2026 Nr. 94, Artikel 2 (zu N-42; gilt für beide Varianten, Entscheidung bei E-112) · [VK]**

Bisher:

> Für kritische Infrastrukturen, die bis zum 31. Dezember 2026 durch Rechtsverordnung bestimmt werden, sind die Risikoanalyse und der Resilienzplan erstmals bis zum 30. Juni 2027 zu erstellen. Im Übrigen gilt eine Frist von sechs Monaten nach der Bestimmung.

Ersatzformulierung:

> Für kritische Infrastrukturen, die bis zum 31. Dezember 2026 durch Rechtsverordnung bestimmt werden, sind die Risikoanalyse und der Resilienzplan abweichend von § 5 Absatz 1 Satz 2 und § 6 Absatz 2 Satz 2 des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland erstmals bis zum 30. Juni 2027 zu erstellen.

Hinweis: Die Dauerregel aus dem bisherigen Satz 2 steht künftig in § 5 Abs. 1 Satz 2 und § 6 Abs. 2 Satz 2 (E-111, E-112).

**E-119 · OGVBl. 2026 Nr. 94, Artikel 3 (zu N-44) · [VK] formal**

Bisher:

> Durch § 10 Absatz 2 des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland wird das Grundrecht der Unverletzlichkeit der Wohnung (Artikel 13 des Grundgesetzes) eingeschränkt.

Ersatzformulierung:

> Durch § 10 Absatz 2 des Gesetzes zum Schutz kritischer Infrastrukturen im Freistaat Ostdeutschland wird das Grundrecht der Unverletzlichkeit der Wohnung (Artikel 13 des Grundgesetzes, Artikel 30 Absatz 1 der Verfassung des Freistaates Ostdeutschland) eingeschränkt.

Hinweis: Korrekturbefehl: „In Artikel 3 werden nach den Wörtern ‚Artikel 13 des Grundgesetzes‘ die Wörter ‚, Artikel 30 Absatz 1 der Verfassung des Freistaates Ostdeutschland‘ eingefügt.“ Treffer „Artikel 13 des Grundgesetzes“ in Nr. 94: 1. Rein formal; der Eingriff wird nicht bewertet.

**E-120 · OGVBl. 2026 Nr. 94, Artikel 4 (zu B-29) · [VK redaktionell]**

Bisher:

> Dieses Gesetz tritt am 1. Januar 2027 in Kraft. Artikel 1 § 3 Absatz 2 tritt am Tag nach der Verkündung in Kraft.

Ersatzformulierung:

> (1) Dieses Gesetz tritt vorbehaltlich des Absatzes 2 am 1. Januar 2027 in Kraft.
>
> (2) Artikel 1 § 3 Absatz 2 tritt am Tag nach der Verkündung in Kraft.

Hinweis: Inhaltlich keine Änderung; Form wie OGVBl. 2026 Nr. 46 („tritt vorbehaltlich der Absätze 2 bis 4 am Tag nach der Verkündung in Kraft“). Die Datendarstellung des Teilinkrafttretens (T-4) bleibt eine technische Aufgabe [TÜ].

**E-121 · außerhalb des Gesetzblatts: Sicherheitserlass KRITIS 09/2026, Nummer 10 Satz 2 (Änderungserlass mit Bekanntgabe im StAnzO. vor Ablauf des 8. Dezember 2026) (zu Abschnitt 1.2) · Vollzug; kein Normtextfehler**

Bisher:

> Er tritt mit Ablauf des 8. Dezember 2026 außer Kraft, soweit seine Geltung nicht zuvor verlängert oder einzelne Regelungen durch dauerhafte Vorschriften ersetzt werden.

Variante A:

> Er tritt mit Ablauf des 31. Dezember 2026 außer Kraft, soweit seine Geltung nicht zuvor verlängert oder einzelne Regelungen durch dauerhafte Vorschriften ersetzt werden.

Variante B: keine Textänderung; die Lücke wird bewusst hingenommen, gestützt auf §§ 15a und 46a PVDG ab 14.11.2026.

Entscheidung: Die Volkskammer muss nichts entscheiden. Variante A setzt das für Frieden zuständige Mitglied des Staatsrates durch Änderungserlass um. Ein Vorziehen des Inkrafttretens der Paketgesetze wird nicht vorgeschlagen, weil OstKRITISG §§ 8, 9 und 14 auf das Sicherheitsgesetz verweisen und OstSZG und Sicherheitsgesetz aufeinander verweisen; vorziehen ließen sie sich nur gemeinsam, das wäre eine eigene Entscheidung der Volkskammer.

Hinweis: Wortlaut des Änderungserlasses zu Variante A: „In Nummer 10 Satz 2 des Erlasses des Staatsrates für Frieden über vorläufige Maßnahmen zum verstärkten Schutz kritischer Infrastruktur (Sicherheitserlass KRITIS 09/2026) vom 8. September 2026 (StAnzO. 2026 Nr. 45 S. 2) wird die Angabe ‚8. Dezember 2026‘ durch die Angabe ‚31. Dezember 2026‘ ersetzt.“ Treffer im Erlass: 1. Wegen „zuvor“ muss die Verlängerung vor Ablauf des 8.12.2026 bekanntgegeben sein. Vom 9. bis 31.12.2026 entfielen sonst die Verwaltungsanordnungen der Nummern 4 bis 7 (Gefährdungsbewertung der Flughäfen, Dokumentation von Drohnenlagen, Hinwirken auf Betreiberprüfungen, gemeinsames Lagebild); polizeiliche Befugnisse fehlen nicht.

#### OGVBl. 2026 Nr. 95

Keine Ersatzformulierung erforderlich (B-34 behoben).

#### OGVBl. 2026 Nr. 96

**E-122 · OGVBl. 2026 Nr. 96, Inhaltsverzeichnis (zu N-45) · [VK redaktionell]**

Bisher:

> Gesetz zur Änderung des Polizeivollzugsdienstgesetzes zur Stärkung der Terrorismusabwehr

Ersatzformulierung:

> Gesetz zur Änderung des Ostdeutschen Polizeivollzugsdienstgesetzes zur Stärkung der Terrorismusabwehr

Hinweis: Die Wortfolge ab „zur Änderung“ steht im Blatt zweimal (Inhaltsverzeichnis und Überschriftszeile), als ganze Zeile je einmal; beide werden ersetzt (E-123).

**E-123 · OGVBl. 2026 Nr. 96, Überschrift des Gesetzes, Zeile nach „Gesetz“ (zu N-45) · [VK redaktionell]**

Bisher:

> zur Änderung des Polizeivollzugsdienstgesetzes zur Stärkung der Terrorismusabwehr

Ersatzformulierung:

> zur Änderung des Ostdeutschen Polizeivollzugsdienstgesetzes zur Stärkung der Terrorismusabwehr

Hinweis: Präzedenzfall: OGVBl. 2026 Nr. 68 berichtigte die Überschrift von Nr. 24 in „Gesetz zur Änderung des Ostdeutschen Polizeivollzugsdienstgesetzes zur Regelung der Schmerzgriffe“.

**E-124 · OGVBl. 2026 Nr. 96, Artikel 1, Eingangssatz (zu B-10) · [VK redaktionell]**

Bisher:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 11 des Gesetzes vom 20. Juli 2026 (OGVBl. 2026 Nr. 46 S. 2) geändert worden ist, wird wie folgt geändert:

Variante A: keine Änderung (bei diesem Maßstab ist der v2-Wortlaut richtig).

Variante B:

> Das Ostdeutsche Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), das zuletzt durch Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 88 S. 2) geändert worden ist, wird wie folgt geändert:

Hinweis: Entscheidung bei E-01. Bei Variante A ist Nr. 46 Art. 11 (wirksam 1.8.2026, nach Nr. 50 am 21.7.2026) die letzte wirksame Änderung; Nr. 50 Art. 2 stammt vom selben Tag. Nr. 89 bis 95 ändern das PVDG nicht.

**E-125 · OGVBl. 2026 Nr. 96, Artikel 1 Nummer 2, § 15a Absatz 1 PVDG (zu N-46) · [VK redaktionell]**

Bisher:

> (1) Die Polizei kann um einen Verkehrsflughafen sowie um Anlagen und Einrichtungen, deren Ausfall die Versorgung der Bevölkerung mit lebenswichtigen Gütern oder Dienstleistungen oder die Funktionsfähigkeit des Gemeinwesens erheblich beeinträchtigen könnte, einen Schutzbereich bestimmen, wenn Tatsachen die Annahme rechtfertigen, dass dort oder gegen die Anlage eine Straftat nach § 129a Absatz 1 oder 2, § 88, § 316b oder § 317 des Strafgesetzbuches begangen werden soll.

Ersatzformulierung:

> (1) Die Polizei kann um einen Verkehrsflughafen sowie um Anlagen und Einrichtungen, deren Ausfall die Versorgung der Bevölkerung mit lebenswichtigen Gütern oder Dienstleistungen oder die Funktionsfähigkeit des Gemeinwesens erheblich beeinträchtigen könnte, einen Schutzbereich bestimmen, wenn Tatsachen die Annahme rechtfertigen, dass dort oder gegen den Verkehrsflughafen, die Anlage oder die Einrichtung eine Straftat nach § 129a Absatz 1 oder 2, § 88, § 316b oder § 317 des Strafgesetzbuches begangen werden soll.

Hinweis: Korrekturbefehl: „In Artikel 1 Nummer 2 werden in § 15a Absatz 1 die Wörter ‚gegen die Anlage‘ durch die Wörter ‚gegen den Verkehrsflughafen, die Anlage oder die Einrichtung‘ ersetzt.“ Treffer: 1.

**E-126 · OGVBl. 2026 Nr. 96, Artikel 1 Nummer 3, § 20a Absatz 2 PVDG (zu B-32) · [VK]**

Bisher:

> (2) Die Maßnahme bedarf der Anordnung durch das Amtsgericht, in dessen Bezirk die Polizeidienststelle ihren Sitz hat. Bei Gefahr im Verzug kann die Leitung der Polizeidienststelle die Maßnahme anordnen; die richterliche Entscheidung ist unverzüglich nachzuholen.

Variante A:

> (2) Die Maßnahme bedarf der Anordnung durch das Amtsgericht, in dessen Bezirk die zuständige Polizeidienststelle ihren Sitz hat. Die Anordnung ist sofort vollziehbar. Bei Gefahr im Verzug kann die Leitung der zuständigen Polizeidienststelle die Maßnahme anordnen; die richterliche Entscheidung ist unverzüglich nachzuholen. Wird die Anordnung der Leitung der zuständigen Polizeidienststelle nicht binnen drei Tagen durch das Gericht bestätigt, tritt sie außer Kraft.

Variante B:

> (2) Die Maßnahme bedarf der Anordnung durch das Amtsgericht, in dessen Bezirk die zuständige Polizeidienststelle ihren Sitz hat. Bei Gefahr im Verzug kann die Leitung der zuständigen Polizeidienststelle die Maßnahme anordnen; die richterliche Entscheidung ist unverzüglich nachzuholen.

Entscheidung der Volkskammer: Ist die Eilanordnung nach § 20a wie Maßnahmen nach § 21 Abs. 2 und 3 sofort vollziehbar und tritt sie ohne richterliche Bestätigung binnen drei Tagen außer Kraft (Variante A), oder bleibt es bei der Pflicht, die richterliche Entscheidung nachzuholen (Variante B)? In beiden Varianten wird das Gericht an die zuständige Polizeidienststelle geknüpft; die Konkurrenz zu § 21 klärt E-127.

Hinweis: Variante A gleicht an § 21 Abs. 4 Satz 1, 2, 4 und 5 PVDG an. Treffer „die Polizeidienststelle ihren Sitz hat“ in Nr. 96: 1; „Leitung der Polizeidienststelle“ in § 20a Abs. 2: 1 (im Blatt insgesamt 3; § 15a Abs. 3 und § 46a Abs. 2 bleiben unberührt). Für die Grenzpolizei ist das Gericht bis 30.11. über Art. 3, ab 1.12. über § 97 Abs. 1 n. F. bestimmbar.

**E-127 · OGVBl. 2026 Nr. 96, Artikel 1 Nummer 3, § 20a Absatz 4 PVDG (zu B-32) · [VK]**

Bisher:

> (4) § 20 bleibt unberührt.“

Ersatzformulierung:

> (4) Die §§ 20 und 21 bleiben unberührt.“

Hinweis: Gilt für beide Varianten von E-126. Das schließende Anführungszeichen des eingefügten § 20a bleibt erhalten. Treffer: 1.

**E-128 · OGVBl. 2026 Nr. 96, Artikel 1 Nummer 4, § 46a Absatz 1, einleitender Satzteil PVDG (zu N-47) · [VK]**

Bisher:

> (1) Die Polizei kann zur Abwehr einer Gefahr für Leib, Leben oder Freiheit einer Person, für Anlagen und Einrichtungen nach § 15a Absatz 1 oder für Sachen von bedeutendem Wert, die von einem unbemannten Fluggerät ausgeht, technische Mittel einsetzen, um

Variante A:

> (1) Die Polizei kann zur Abwehr einer Gefahr für Leib, Leben oder Freiheit einer Person, für Verkehrsflughäfen, Anlagen und Einrichtungen nach § 15a Absatz 1 oder für Sachen von bedeutendem Wert, die von einem unbemannten Fluggerät ausgeht, technische Mittel einsetzen, um

Variante B: keine Änderung.

Entscheidung der Volkskammer: Sind Verkehrsflughäfen als solche Schutzgut des § 46a Abs. 1 (Variante A) oder nur, soweit sie die Ausfallschwelle des § 15a Abs. 1 erfüllen (Variante B)?

Hinweis: Korrekturbefehl: „In Artikel 1 Nummer 4 werden in § 46a Absatz 1 die Wörter ‚für Anlagen und Einrichtungen nach § 15a Absatz 1‘ durch die Wörter ‚für Verkehrsflughäfen, Anlagen und Einrichtungen nach § 15a Absatz 1‘ ersetzt.“ Treffer: 1. Kein „sowie“ in der oder-Aufzählung. Die Nummern 1 bis 4 bleiben; zu Nummer 3 siehe E-129.

**E-129 · OGVBl. 2026 Nr. 96, Artikel 1 Nummer 4, § 46a Absatz 1 Nummer 3 PVDG (zu N-46) · [VK redaktionell]**

Bisher:

> Steuerungs-, Navigations- oder Datensignale zu stören oder zu unterbrechen,

Ersatzformulierung:

> Steuerungs-, Navigations- oder Datensignale zu stören oder zu unterbrechen oder

Hinweis: Listennummer „3.“ bleibt. Korrekturbefehl: „In Artikel 1 Nummer 4 wird in § 46a Absatz 1 Nummer 3 das Komma am Ende durch das Wort ‚oder‘ ersetzt.“ Treffer „zu unterbrechen,“: 1. Die Alternativität zeigt § 46a Abs. 2 („Maßnahmen nach Absatz 1 Nummer 2 bis 4“).

**E-130 · OGVBl. 2026 Nr. 96, Artikel 1 Nummer 4, § 46a Absatz 3 PVDG (zu K-15, G-3) · [VK]**

Bisher:

> (3) Im Zuständigkeitsbereich der Bundespolizei werden Maßnahmen nur auf deren Ersuchen oder bei Gefahr im Verzug getroffen; die Bundespolizei ist unverzüglich zu unterrichten.

Variante A:

> (3) Im Zuständigkeitsbereich der Bundespolizei werden Maßnahmen nur auf deren Ersuchen oder bei Gefahr im Verzug getroffen. Satz 1 gilt nicht für Maßnahmen der Kasernierten Grenzpolizei bei der Wahrnehmung von Aufgaben nach § 3 des Kasernierte-Grenzpolizei-Gesetzes. Die Bundespolizei ist unverzüglich zu unterrichten.

Variante B:

> (3) Im Zuständigkeitsbereich der Bundespolizei werden Maßnahmen nur auf deren Ersuchen oder bei Gefahr im Verzug getroffen; dies gilt auch für Maßnahmen der Kasernierten Grenzpolizei bei der Wahrnehmung von Aufgaben nach § 3 des Kasernierte-Grenzpolizei-Gesetzes. Die Bundespolizei ist unverzüglich zu unterrichten.

Variante C:

> (3) Im Zuständigkeitsbereich der Bundespolizei werden Maßnahmen nur auf deren Ersuchen oder bei Gefahr im Verzug getroffen; die Bundespolizei ist unverzüglich zu unterrichten. Satz 1 gilt auch für Maßnahmen der Kasernierten Grenzpolizei.

Entscheidung der Volkskammer: Variante A: Ausnahme vom Ersuchensvorbehalt für die Grenzpolizei bei Aufgaben nach § 3 KGrPolG. Variante B: Der Vorbehalt gilt ausdrücklich auch, soweit die Grenzpolizei Aufgaben nach § 3 KGrPolG wahrnimmt. Variante C: Der Vorbehalt gilt ausdrücklich für alle Maßnahmen der Grenzpolizei im Zuständigkeitsbereich der Bundespolizei. Ohne verfassungsrechtliche Bewertung; nimmt die Grenzpolizei Aufgaben nach § 3 KGrPolG wahr, richten sich ihre Befugnisse nach § 4 Abs. 2 KGrPolG „nach Bundesrecht, soweit dieses dies bestimmt“.

Hinweis: Alle Varianten erhalten die Unterrichtungspflicht für alle Maßnahmen; der Wortlaut von K-15 („Satz 1 gilt nicht“) hätte sie beseitigt. Variante A macht Absatz 3 dreisätzig. Da die Grenzpolizei ab 1.12.2026 Polizeidienststelle ist (bis 30.11. für § 46a über Nr. 96 Art. 3), erfasst Satz 1 ihre Maßnahmen schon nach dem v2-Wortlaut; Variante B und C stellen das klar und unterscheiden sich in der Reichweite der Klarstellung. Korrekturbefehl zu Variante C: „In Artikel 1 Nummer 4 wird dem § 46a Absatz 3 folgender Satz angefügt: ‚Satz 1 gilt auch für Maßnahmen der Kasernierten Grenzpolizei.‘“ Nach Verwaltungsabkommen § 1 Abs. 1 Nr. 3 kontrolliert die Grenzpolizei auch an Grenzübergangsstellen des Luftverkehrs; sie hält Drohnendetektion vor (KGrPolG § 10 Abs. 2 Nr. 8).

**E-131 · OGVBl. 2026 Nr. 96, Artikel 1, neue Nummer 5 nach Nummer 4 (§ 97 Absatz 1 PVDG) (zu B-04, nur Variante B; Entscheidung bei E-132) · [VK] [VB]**

Bisher (Einfügestelle, Ende von Nummer 4):

> (4) Bei Maßnahmen nach Absatz 1 Nummer 1 erhobene Daten sind unverzüglich zu löschen, soweit sie nicht zur Gefahrenabwehr oder zur Verfolgung von Straftaten oder Ordnungswidrigkeiten erforderlich sind.“

Einfügen nach Nummer 4 (Variante B):

> 5. In § 97 Absatz 1 werden die Nummern 5 und 6 wie folgt gefasst:
>
> „5. die Kasernierte Grenzpolizei und
>
> 6. die Polizeidirektionen als Bezirkspolizeidirektionen.“

Hinweis: Die Gliederungsnummer „5.“ ist von Hand zu setzen, wie die Nummern 3 und 4 von Artikel 1. Ausführbar in beiden Lesarten der Kollision: Die Nummern 5 und 6 bestehen in der amtlichen Fassung ab 1.8.2026 je einmal; Nummer 4 endet seit Nr. 50 Art. 2 Nr. 2 Buchst. a ohne „und“. Ab 1.12.2026 wird der Text durch Nr. 86 Art. 2 Nr. 2 ersetzt. Im technischen Bestand erst nach Nachtrag von Nr. 50 Art. 2 Nr. 2 abbildbar (T-2). Nur zusammen mit E-132 (Streichung von Artikel 3) und E-133.

**E-132 · OGVBl. 2026 Nr. 96, Artikel 2 und 3 (zu B-04, N-48) · [VK]; Artikelfolge [VK redaktionell]**

Bisher:

> Artikel 2
>
> Einschränkung von Grundrechten
>
> Durch Artikel 1 werden die Grundrechte der körperlichen Unversehrtheit und der Freiheit der Person (Artikel 2 Absatz 2 Satz 1 und 2 des Grundgesetzes), der Freizügigkeit (Artikel 11 des Grundgesetzes) und das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) eingeschränkt.
>
> Artikel 3
>
> Übergangsbestimmung
>
> Bis zum Ablauf des 30. November 2026 gilt die Kasernierte Grenzpolizei bei der Anwendung der §§ 15a, 20a und 46a des Ostdeutschen Polizeivollzugsdienstgesetzes als Polizeidienststelle.

B-04 Variante A – ersetzt den Satz der Übergangsbestimmung; bisher:

> Bis zum Ablauf des 30. November 2026 gilt die Kasernierte Grenzpolizei bei der Anwendung der §§ 15a, 20a und 46a des Ostdeutschen Polizeivollzugsdienstgesetzes als Polizeidienststelle.

Ersatzformulierung (B-04 Variante A):

> Bis zum Ablauf des 30. November 2026 ist § 97 Absatz 1 des Ostdeutschen Polizeivollzugsdienstgesetzes mit der Maßgabe anzuwenden, dass die Kasernierte Grenzpolizei Polizeidienststelle ist.

B-04 Variante B – Streichen: Artikel 3 mit Überschrift „Übergangsbestimmung“ und Satz entfällt; dazu E-131 und E-133.

Artikelfolge (N-48) – Ersatzformulierung für Artikel 2 und 3:

> Artikel 2
>
> Übergangsbestimmung
>
> Bis zum Ablauf des 30. November 2026 gilt die Kasernierte Grenzpolizei bei der Anwendung der §§ 15a, 20a und 46a des Ostdeutschen Polizeivollzugsdienstgesetzes als Polizeidienststelle.
>
> Artikel 3
>
> Einschränkung von Grundrechten
>
> Durch Artikel 1 werden die Grundrechte der körperlichen Unversehrtheit und der Freiheit der Person (Artikel 2 Absatz 2 Satz 1 und 2 des Grundgesetzes), der Freizügigkeit (Artikel 11 des Grundgesetzes) und das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) eingeschränkt.

Entscheidung der Volkskammer (B-04): Wie weit wird die Stellung der Grenzpolizei vom 14. bis 30.11.2026 klargestellt? Variante A: für alle Vorschriften des PVDG, als Maßgaberegel in der Übergangsbestimmung (erfasst §§ 15a, 20a und 46a mit). Variante B: Bereinigung des Wortlauts von § 97 Abs. 1 ab 14.11.2026 (E-131); die Übergangsbestimmung entfällt, der Inkrafttretensartikel wird Artikel 3 (E-133). Ohne Änderung bleibt die Klarstellung bewusst auf §§ 15a, 20a und 46a beschränkt. Den Zeitraum 1.8. bis 13.11.2026 könnte das Paket nur rückwirkend regeln; er ist nicht bewertet.

Hinweis: Die Artikelfolge nach N-48 ist eine redaktionelle Berichtigung ohne Entscheidung; kein Blatt verweist auf Artikel 2 oder 3 von Nr. 96, Artikel 4 bleibt. Kombination: Mit B-04 Variante A steht in der umgestellten Übergangsbestimmung der Satz nach Variante A; mit B-04 Variante B ist N-48 gegenstandslos. Wird E-132a übernommen, steht in der umgestellten Grundrechtsklausel der Satz nach E-132a. Kein Eintrag ändert das Inkrafttreten von Nr. 86 (1. Dezember 2026); das Enddatum „30. November 2026“ bleibt bei allen Varianten von E-31 stimmig. [TÜ] Die Überschrift von Artikel 3 ist im HTML als Absatz statt als Überschrift ausgezeichnet. Trefferzahl der zusammenhängenden Passage: 1.

**E-132a · OGVBl. 2026 Nr. 96, Artikel 2 (zu N-56) · [VK] formal**

Bisher:

> Durch Artikel 1 werden die Grundrechte der körperlichen Unversehrtheit und der Freiheit der Person (Artikel 2 Absatz 2 Satz 1 und 2 des Grundgesetzes), der Freizügigkeit (Artikel 11 des Grundgesetzes) und das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) eingeschränkt.

Ersatzformulierung:

> Durch Artikel 1 werden die Grundrechte der körperlichen Unversehrtheit und der Freiheit der Person (Artikel 2 Absatz 2 Satz 1 und 2 des Grundgesetzes, Artikel 16 Absatz 1 Satz 1 und 2 der Verfassung des Freistaates Ostdeutschland), der Freizügigkeit (Artikel 11 des Grundgesetzes) und das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes, Artikel 27 Absatz 1 der Verfassung des Freistaates Ostdeutschland) eingeschränkt.

Hinweis: Die Landesverfassung enthält kein Grundrecht der Freizügigkeit; insoweit bleibt es wie in PVDG § 10 Nr. 4 bei Artikel 11 des Grundgesetzes. Wird die Artikelfolge nach E-132 umgestellt, steht dieser Satz in Artikel 3. Rein formal. Treffer 1.

**E-133 · OGVBl. 2026 Nr. 96, Artikelbezeichnung des Inkrafttretensartikels (zu B-04, nur Variante B; Entscheidung bei E-132) · [VK redaktionell]**

Bisher:

> Artikel 4

Ersatzformulierung (Variante B):

> Artikel 3

Hinweis: Folge der Streichung von Artikel 3 (Zeile „Artikel 4“ 1 Treffer). Die Überschrift „Inkrafttreten“ und der Satz bleiben unverändert.

#### OGVBl. 2026 Nr. 97

**E-134 · OGVBl. 2026 Nr. 97, Artikel 1 § 9 (VTPG) (zu N-49) · [VK]**

Bisher:

> Dieses Gesetz gilt für Einstellungsverfahren, in denen die Einstellungsentscheidung ab dem 1. Januar 2027 getroffen wird. Bereits durchgeführte Sicherheitsüberprüfungen müssen nicht ohne Anlass wiederholt werden.

Variante A:

> Dieses Gesetz gilt für Einstellungsverfahren, in denen die Einstellungsentscheidung ab dem 1. Januar 2027 getroffen wird. Bereits durchgeführte Sicherheitsüberprüfungen nach dem Ostdeutschen Sicherheitsüberprüfungsgesetz sind aus Anlass dieses Gesetzes nicht zu wiederholen.

Variante B:

> Dieses Gesetz gilt für Einstellungsverfahren, in denen die Einstellungsentscheidung ab dem 1. Januar 2027 getroffen wird.

Entscheidung der Volkskammer: Variante A stellt klar, dass das VTPG keine Wiederholung von Sicherheitsüberprüfungen nach dem OstSÜG auslöst. Variante B streicht Satz 2; die Lesart „bereits Beschäftigte nur anlassbezogen“ deckt § 4 schon ab und führt daher zu Variante B. Eine Freistellung bereits sicherheitsüberprüfter Bewerber:innen von der Anfrage wäre eine neue Sachregelung, die die Volkskammer gesondert beschließen müsste; sie ist nicht vorformuliert, weil ihr Umfang (Art und Alter der Überprüfung) nicht erkennbar ist.

Hinweis: Korrekturbefehl zu Variante A: „In Artikel 1 wird § 9 Satz 2 wie folgt gefasst: ‚Bereits durchgeführte Sicherheitsüberprüfungen nach dem Ostdeutschen Sicherheitsüberprüfungsgesetz sind aus Anlass dieses Gesetzes nicht zu wiederholen.‘“ Treffer Satz 2: 1.

#### OGVBl. 2026 Nr. 98

**E-135 · OGVBl. 2026 Nr. 98, Artikel 1 § 2 Absatz 1 (OstSZG) (zu N-50) · [VK redaktionell]**

Bisher:

> (1) Die beteiligten Behörden und die übrigen öffentlichen Stellen des Freistaates übermitteln dem Landesamt für Staatsschutz von sich aus die ihnen bekannt gewordenen Informationen einschließlich personenbezogener Daten über terroristische Bestrebungen und über Tätigkeiten nach § 1 Absatz 1 Nummer 2 und 3 des Staatsschutz- und Nachrichtendienstgesetzes.

Fassung A:

> (1) Die übrigen beteiligten Behörden und die sonstigen öffentlichen Stellen des Freistaates übermitteln dem Landesamt für Staatsschutz von sich aus die ihnen bekannt gewordenen Informationen einschließlich personenbezogener Daten über terroristische Bestrebungen und über Tätigkeiten nach § 1 Absatz 1 Nummer 2 und 3 des Staatsschutz- und Nachrichtendienstgesetzes.

Fassung B:

> (1) Die Volkspolizei, die Kasernierte Grenzpolizei und die übrigen öffentlichen Stellen des Freistaates übermitteln dem Landesamt für Staatsschutz von sich aus die ihnen bekannt gewordenen Informationen einschließlich personenbezogener Daten über terroristische Bestrebungen und über Tätigkeiten nach § 1 Absatz 1 Nummer 2 und 3 des Staatsschutz- und Nachrichtendienstgesetzes.

Entscheidung der Volkskammer: Keine inhaltliche Entscheidung; redaktionelle Wahl. Fassung A verwendet den definierten Begriff und grenzt wie § 1 Abs. 2 ab („übrigen beteiligten Behörden“), „sonstigen“ vermeidet die Doppelung; Fassung B zählt die Behörden auf. Empfohlen: Fassung A (verwendet den bestimmten Begriff wie § 1 Abs. 2).

Hinweis: Korrekturbefehl zu Fassung A: „In Artikel 1 § 2 Absatz 1 werden die Wörter ‚Die beteiligten Behörden und die übrigen öffentlichen Stellen‘ durch die Wörter ‚Die übrigen beteiligten Behörden und die sonstigen öffentlichen Stellen‘ ersetzt.“ Treffer: 1. Das „sie“ in Absatz 2 bezieht sich in beiden Fassungen weiter auf alle übermittelnden Stellen. Die Verweise auf OstSNDG § 1 Abs. 1 Nr. 2 und 3 stimmen mit der v2-Zählung überein.

**E-136 · OGVBl. 2026 Nr. 98, Artikel 2 (zu N-51) · [VK] formal**

Bisher:

> Durch dieses Gesetz werden das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes) und das Recht auf informationelle Selbstbestimmung eingeschränkt.

Ersatzformulierung:

> Durch dieses Gesetz werden das Fernmeldegeheimnis (Artikel 10 des Grundgesetzes, Artikel 27 Absatz 1 der Verfassung des Freistaates Ostdeutschland) und das Recht auf informationelle Selbstbestimmung (Artikel 33 der Verfassung des Freistaates Ostdeutschland) eingeschränkt.

Hinweis: Korrekturbefehl: „In Artikel 2 werden nach den Wörtern ‚Artikel 10 des Grundgesetzes‘ die Wörter ‚, Artikel 27 Absatz 1 der Verfassung des Freistaates Ostdeutschland‘ und nach dem Wort ‚Selbstbestimmung‘ die Wörter ‚(Artikel 33 der Verfassung des Freistaates Ostdeutschland)‘ eingefügt.“ Treffer je 1. Rein formal.

#### OGVBl. 2026 Nr. 99

**E-137 · OGVBl. 2026 Nr. 99, Artikel 1 (zu B-31) · [VK redaktionell]**

Bisher:

> Das Ostdeutsche Verfassungsschutzgesetz vom 16. Oktober 1992 (SächsGVBl. S. 459) wird mit Ablauf des 31. Dezember 2026 aufgehoben.

Ersatzformulierung:

> Das Ostdeutsche Verfassungsschutzgesetz vom 16. Oktober 1992 (SächsGVBl. S. 459), das zuletzt durch Artikel 1 des Gesetzes vom 3. Mai 2019 (SächsGVBl. S. 312) geändert worden ist, wird mit Ablauf des 31. Dezember 2026 aufgehoben.

Hinweis: Letzte Änderung nach den Quellennotizen der gespeicherten Fassung (REVOSax 3288.6, gültig ab 1.6.2019); seither keine ostdeutsche Änderung. Artikel 2 desselben Blatts zitiert das OstAG G 10 entsprechend (Artikel 2 desselben Gesetzes).

**E-138 · OGVBl. 2026 Nr. 99, Artikel 2, Überschrift (zu N-52) · [VK redaktionell]**

Bisher:

> Aufhebung des Ausführungsgesetzes zum Artikel-10-Gesetz

Ersatzformulierung:

> Aufhebung des Ausführungsgesetzes zum Artikel 10-Gesetz

Hinweis: Schreibweise des Bundesgesetzes wie Art. 4 Abs. 1 desselben Blatts und Nr. 91 bis 93; der amtliche Kurztitel des Landesgesetzes („Ostdeutsches Artikel-10-Gesetz-Ausführungsgesetz“, Art. 2 Satz 1) bleibt.

**E-139 · OGVBl. 2026 Nr. 99, Artikel 3 Absatz 1, Einleitung (zu N-55, nur Variante B; Entscheidung bei E-144) · [VK]**

Bisher:

> (1) Soweit in Gesetzen, Rechtsverordnungen und Verwaltungsvorschriften des Freistaates Ostdeutschland

Ersatzformulierung (Variante B):

> Soweit in Gesetzen, Rechtsverordnungen und Verwaltungsvorschriften des Freistaates Ostdeutschland

Hinweis: Bei Variante B hat Artikel 3 nur noch einen Absatz; die Absatzbezeichnung entfällt. Der Satzverweis „Satz 1“ in E-143 bleibt richtig.

**E-140 · OGVBl. 2026 Nr. 99, Artikel 3 Absatz 1 Nummer 2 (zu N-53) · [VK redaktionell]**

Bisher:

> auf das Ostdeutsche Verfassungsschutzgesetz insgesamt und ohne Angabe einer bestimmten Vorschrift verwiesen wird, tritt an seine Stelle das Staatsschutz- und Nachrichtendienstgesetz,

Ersatzformulierung:

> auf das Ostdeutsche Verfassungsschutzgesetz insgesamt und ohne Angabe einer bestimmten Vorschrift verwiesen wird, tritt an seine Stelle das Staatsschutz- und Nachrichtendienstgesetz vom 13. November 2026 (OGVBl. 2026 Nr. 92 S. 2),

Hinweis: Die Gliederungsnummer „2.“ bleibt. Seitenangabe aus dem Inhaltsverzeichnis; kein PDF.

**E-141 · OGVBl. 2026 Nr. 99, Artikel 3 Absatz 1 Nummer 3 (zu N-53, B-26) · [VK redaktionell]; Fassung zu B-26 Variante B [VK]**

Bisher:

> die Parlamentarische Kontrollkommission genannt ist, tritt an ihre Stelle das Parlamentarische Kontrollgremium nach dem Staatsschutz-Kontrollgesetz,

Ersatzformulierung:

> die Parlamentarische Kontrollkommission genannt ist, tritt an ihre Stelle das Parlamentarische Kontrollgremium nach dem Staatsschutz-Kontrollgesetz vom 13. November 2026 (OGVBl. 2026 Nr. 93 S. 2),

Ersatzformulierung bei B-26 Entscheidung 2 Variante B (Entscheidung bei E-87):

> die Parlamentarische Kontrollkommission genannt ist, tritt an ihre Stelle das Parlamentarische Kontrollgremium für den Staatsschutz nach dem Staatsschutz-Kontrollgesetz vom 13. November 2026 (OGVBl. 2026 Nr. 93 S. 2),

Hinweis: Die Gliederungsnummer „3.“ bleibt. Bei Variante B gehört diese Fassung zu E-87; die Ersetzungsregel überträgt sonst eine Bezeichnung, die das Gremium nach der Umbenennung nicht mehr trägt. Art. 4 Abs. 4 wird nach E-147 angepasst.

**E-142 · OGVBl. 2026 Nr. 99, Artikel 3 Absatz 1 Nummer 4 (zu N-52, N-40) · [VK redaktionell]**

Bisher:

> die G10-Kommission genannt ist, tritt an ihre Stelle die Staatsschutzkommission nach dem Staatsschutz-Kontrollgesetz.

Ersatzformulierung:

> 4. die G 10-Kommission genannt ist, tritt an ihre Stelle die Staatsschutzkommission nach dem Staatsschutz-Kontrollgesetz.

Hinweis: Zielbestand ab 1.1.2027: „G 10-Kommission“ 2 Fundstellen (Abgeordnetengesetz § 6, Geschäftsordnung der Volkskammer; Letztere keine Rechtsvorschrift im Sinne von Abs. 1), „G10-Kommission“ 0. Trefferzahl in Nr. 99: 1.

**E-143 · OGVBl. 2026 Nr. 99, Artikel 3 Absatz 1, neuer Satz 2 (Ausnahme von der Bezeichnungsanpassung) (zu N-54) · [VK]**

Bisher (Einfügestelle, Ende von Absatz 1):

> die G10-Kommission genannt ist, tritt an ihre Stelle die Staatsschutzkommission nach dem Staatsschutz-Kontrollgesetz.

Einfügen als Satz 2 von Absatz 1, nach der Aufzählung:

> Satz 1 gilt nicht für dieses Gesetz, für § 12 des Staatsschutzamt-Errichtungsgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 91 S. 2) und für § 14 Satz 2 des Staatsschutz-Kontrollgesetzes.

Entscheidung der Volkskammer: Keine Entscheidung nötig; die Regelungsabsicht ist eindeutig.

Hinweis: Der Satz steht als eigener, nicht nummerierter Satz nach der Aufzählung. Er passt zu beiden Varianten von E-144: Bei Variante A erfasst „nach Maßgabe des Absatzes 1“ die Ausnahme, bei Variante B (E-139) bleibt der Verweis „Satz 1“ richtig. Erstzitat des LfStErrG in Nr. 99 („Errichtungsgesetz“ dort 0 Treffer) mit Datum und Fundstelle; die Seitenzahl stammt aus dem Inhaltsverzeichnis von Nr. 91. Die Zitierung trifft in beiden Varianten von E-66 zu. „Dieses Gesetz“ erfasst auch Art. 1 (Aufhebung des OstVSG), Art. 4 Abs. 3 und einen nach E-145 eingefügten Folgeänderungsartikel mit seinen zitierten Altwortlauten. Wird E-142 übernommen, lautet der Ankertext „die G 10-Kommission genannt ist, tritt an ihre Stelle die Staatsschutzkommission nach dem Staatsschutz-Kontrollgesetz.“

**E-144 · OGVBl. 2026 Nr. 99, Artikel 3 Absatz 2 (zu N-55) · [VK]**

Bisher:

> (2) Die Redaktion des Ostdeutschen Gesetzes- und Verordnungsblattes ändert bei Neufassungen oder Änderungen eines Gesetzes von Amts wegen die in Absatz 1 genannten Bezeichnungen.

Variante A:

> (2) Die Schriftleitung des Gesetz- und Verordnungsblattes für den Freistaat Ostdeutschland wird ermächtigt, bei der Veröffentlichung konsolidierter Fassungen von Gesetzen und Rechtsverordnungen die Bezeichnungen und Verweisungen nach Maßgabe des Absatzes 1 von Amts wegen anzupassen.

Variante B – Streichen: Absatz 2 (Bisher-Wortlaut) entfällt; dazu E-139.

Entscheidung der Volkskammer: Variante A fasst Absatz 2 als Ermächtigung der Schriftleitung nach dem Vorbild von OGVBl. 2026 Nr. 22 Art. 1, beschränkt auf konsolidierte Fassungen von Gesetzen und Rechtsverordnungen. Variante B streicht Absatz 2; die Ersetzung wirkt allein kraft Absatz 1. Ohne verfassungsrechtliche Bewertung (Art. 76 der Verfassung sieht eine Änderung des amtlichen Wortlauts ohne Beschluss und Ausfertigung nicht vor).

Hinweis: „Nach Maßgabe des Absatzes 1“ schließt die Ausnahmen aus E-143 ein. Name des Blatts nach BeVerKüGe § 1 und dem Kopf jeder Ausgabe.

**E-145 · OGVBl. 2026 Nr. 99, nach Artikel 3, neuer Artikel 4 „Folgeänderungen“ (zu B-30) · [VK]**

Bisher (Einfügestelle, letzter Satz von Artikel 3 in v2):

> (2) Die Redaktion des Ostdeutschen Gesetzes- und Verordnungsblattes ändert bei Neufassungen oder Änderungen eines Gesetzes von Amts wegen die in Absatz 1 genannten Bezeichnungen.

Variante A:

> Artikel 4
>
> Folgeänderungen
>
> (1) Das Ostdeutsche Sicherheitsüberprüfungsgesetz vom 19. Februar 2004 (SächsGVBl. S. 44), das zuletzt durch Artikel 21 des Gesetzes vom 27. Januar 2012 (SächsGVBl. S. 130) geändert worden ist, wird wie folgt geändert:
>
> 1. § 22 Absatz 2 Nummer 3 wird wie folgt gefasst:
>
> „3. zur Erfüllung der Aufgaben nach § 1 Absatz 1 Nummer 2, 5 und 6 des Staatsschutz- und Nachrichtendienstgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 92 S. 2), in der jeweils geltenden Fassung, oder zur Aufklärung sonstiger Bestrebungen im Sinne von § 1 Absatz 1 des Staatsschutz- und Nachrichtendienstgesetzes von erheblicher Bedeutung oder“.
>
> 2. In § 24 Absatz 6 wird die Angabe „§ 9 OstVSG“ durch die Wörter „§ 14 des Staatsschutz- und Nachrichtendienstgesetzes“ ersetzt.
>
> (2) § 13 Absatz 7 des Ostdeutschen Informationssicherheitsgesetzes vom 2. August 2019 (SächsGVBl. S. 630), das zuletzt durch Artikel 3 Absatz 3 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 86 S. 2) geändert worden ist, wird wie folgt geändert:
>
> 1. In Satz 1 Nummer 3 werden die Wörter „Landesamt für Verfassungsschutz, wenn tatsächliche Anhaltspunkte für Bestrebungen nach § 2 Absatz 1 Nummer 2 des Ostdeutschen Verfassungsschutzgesetzes vom 16. Oktober 1992 (SächsGVBl. S. 459), das zuletzt durch Artikel 1 des Gesetzes vom 3. Mai 2019 (SächsGVBl. S. 312) geändert worden ist,“ durch die Wörter „Landesamt für Staatsschutz, wenn tatsächliche Anhaltspunkte für Tätigkeiten nach § 1 Absatz 1 Nummer 2 des Staatsschutz- und Nachrichtendienstgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 92 S. 2)“ und die Wörter „§ 2 Absatz 1 Nummer 1, 3 und 3a des Ostdeutschen Verfassungsschutzgesetzes“ durch die Wörter „§ 1 Absatz 1 Nummer 4 bis 6 des Staatsschutz- und Nachrichtendienstgesetzes“ ersetzt.
>
> 2. Die Wörter „§ 10 des Ostdeutschen Verfassungsschutzgesetzes“ werden durch die Wörter „§ 2 des Sicherheitsbehörden-Zusammenarbeitsgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 98 S. 2)“ ersetzt.
>
> (3) In § 48 des Ostdeutschen Besoldungsgesetzes vom 18. Dezember 2013 (SächsGVBl. S. 970, 1005), das zuletzt durch die Artikel 1 und 3 des Gesetzes vom 6. Juli 2023 (SächsGVBl. S. 467) geändert worden ist, werden die Wörter „Landesamt für Verfassungsschutz verwendet werden und dort überwiegend Aufgaben nach § 2 des Ostdeutschen Verfassungsschutzgesetzes vom 16. Oktober 1992 (SächsGVBl. S. 459), das zuletzt durch Artikel 3 des Gesetzes vom 17. Dezember 2013 (SächsGVBl. S. 890) geändert worden ist, in der jeweils geltenden Fassung,“ durch die Wörter „Landesamt für Staatsschutz verwendet werden und dort überwiegend Aufgaben nach § 1 des Staatsschutz- und Nachrichtendienstgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 92 S. 2), in der jeweils geltenden Fassung,“ ersetzt.

Variante B:

> Artikel 4
>
> Folgeänderungen
>
> (1) In § 24 Absatz 6 des Ostdeutschen Sicherheitsüberprüfungsgesetzes vom 19. Februar 2004 (SächsGVBl. S. 44), das zuletzt durch Artikel 21 des Gesetzes vom 27. Januar 2012 (SächsGVBl. S. 130) geändert worden ist, wird die Angabe „§ 9 OstVSG“ durch die Wörter „§ 14 des Staatsschutz- und Nachrichtendienstgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 92 S. 2)“ ersetzt.
>
> (2) In § 13 Absatz 7 des Ostdeutschen Informationssicherheitsgesetzes vom 2. August 2019 (SächsGVBl. S. 630), das zuletzt durch Artikel 3 Absatz 3 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 86 S. 2) geändert worden ist, werden die Wörter „§ 10 des Ostdeutschen Verfassungsschutzgesetzes“ durch die Wörter „§ 2 des Sicherheitsbehörden-Zusammenarbeitsgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 98 S. 2)“ ersetzt.
>
> (3) In § 48 des Ostdeutschen Besoldungsgesetzes vom 18. Dezember 2013 (SächsGVBl. S. 970, 1005), das zuletzt durch die Artikel 1 und 3 des Gesetzes vom 6. Juli 2023 (SächsGVBl. S. 467) geändert worden ist, werden die Wörter „Landesamt für Verfassungsschutz verwendet werden und dort überwiegend Aufgaben nach § 2 des Ostdeutschen Verfassungsschutzgesetzes vom 16. Oktober 1992 (SächsGVBl. S. 459), das zuletzt durch Artikel 3 des Gesetzes vom 17. Dezember 2013 (SächsGVBl. S. 890) geändert worden ist, in der jeweils geltenden Fassung,“ durch die Wörter „Landesamt für Staatsschutz verwendet werden und dort überwiegend Aufgaben nach § 1 des Staatsschutz- und Nachrichtendienstgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 92 S. 2), in der jeweils geltenden Fassung,“ ersetzt.

Entscheidung der Volkskammer: Variante A stellt OstSÜG § 22 Abs. 2 Nr. 3 und OstISichG § 13 Abs. 7 Satz 1 Nr. 3 dynamisch auf § 1 Abs. 1 OstSNDG um; der Übermittlungsrahmen ändert sich dabei (Nr. 4 und 5 weiter gefasst, OstVSG § 2 Abs. 1 Satz 1 Nr. 4 entfällt, „sonstige Bestrebungen“ umfassen auch § 1 Abs. 1 Nr. 1 und 3 OstSNDG). Variante B lässt beide Vorschriften wie die fünf Vollzugsgesetze statisch in der am 31.12.2026 geltenden Fassung des OstVSG weitergelten (nur zusammen mit E-148 Variante B). Unabhängig von der Variante zu bestätigen sind drei dynamische Umstellungen: OstSÜG § 24 Abs. 6 (Auskunft nach § 14 OstSNDG statt § 9 OstVSG), OstISichG § 13 Abs. 7 (§ 2 OstSZG statt § 10 OstVSG) und OstBesG § 48 (Anknüpfung an alle Aufgaben nach § 1 OstSNDG; die Stellenzulage erfasst damit auch Terrorismus- und Sabotageabwehr), außerdem die Anpassungsfrist für Verwaltungsvorschriften (E-149).

Hinweis: Einfügeort unmittelbar vor der Überschrift „Artikel 4 Überleitung“; wird Absatz 2 nach E-144 neu gefasst oder gestrichen, ist der dann letzte Satz von Artikel 3 der Anker. Folgeeinträge: E-146, E-148, E-149, E-150. Trefferzahlen in der Zielfassung vom 1.1.2027 (Leerzeichen normalisiert) je 1: „§ 9 OstVSG“ (nur § 24 Abs. 6), die beiden Wortfolgen in OstISichG § 13 Abs. 7 Satz 1 Nr. 3, „§ 10 des Ostdeutschen Verfassungsschutzgesetzes“ (nur Abs. 7), die Wortfolge in OstBesG § 48 („Verfassungsschutzgesetz“ steht im OstBesG nur dort); OstSÜG § 22 Abs. 2 Nr. 3 endet auf „von erheblicher Bedeutung oder“. „Bestrebungen nach § 2 Absatz 1 Nummer 2“ wird bewusst zu „Tätigkeiten nach § 1 Absatz 1 Nummer 2“, weil OstSNDG § 2 Abs. 1 Nr. 1 Bestrebungen nur für § 1 Abs. 1 Nr. 4 bis 6 bestimmt. Der zitierte Altwortlaut „Landesamt für Verfassungsschutz“ ist nur über die Ausnahme „dieses Gesetz“ in E-143 vor der Ersetzung nach Art. 3 Abs. 1 geschützt. Die Änderungsangabe des OstBesG folgt den Quellennotizen der gespeicherten Fassung (wie E-36); vor dem Beschluss gegen REVOSax 13872.27 gegenlesen.

Absatz 3 in Variante A und B, wenn E-36 übernommen wird:

> (3) In § 48 des Ostdeutschen Besoldungsgesetzes vom 18. Dezember 2013 (SächsGVBl. S. 970, 1005), das zuletzt durch Artikel 3 Absatz 4 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 86 S. 2) geändert worden ist, werden die Wörter „Landesamt für Verfassungsschutz verwendet werden und dort überwiegend Aufgaben nach § 2 des Ostdeutschen Verfassungsschutzgesetzes vom 16. Oktober 1992 (SächsGVBl. S. 459), das zuletzt durch Artikel 3 des Gesetzes vom 17. Dezember 2013 (SächsGVBl. S. 890) geändert worden ist, in der jeweils geltenden Fassung,“ durch die Wörter „Landesamt für Staatsschutz verwendet werden und dort überwiegend Aufgaben nach § 1 des Staatsschutz- und Nachrichtendienstgesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 92 S. 2), in der jeweils geltenden Fassung,“ ersetzt.

**E-146 · OGVBl. 2026 Nr. 99, Überschrift des bisherigen Artikels 4 (zu B-30, beide Varianten von E-145) · [VK redaktionell]**

Bisher:

> Artikel 4
>
> Überleitung

Ersatzformulierung:

> Artikel 5
>
> Überleitung

Hinweis: Kein anderes Blatt verweist auf Artikel von Nr. 99.

**E-147 · OGVBl. 2026 Nr. 99, Artikel 4 Absatz 4 (künftig Artikel 5 Absatz 4) (zu B-26, nur Entscheidung 2 Variante B; Entscheidung bei E-87) · [VK]**

Bisher:

> (4) Für die Wahrnehmung der Aufgaben des Parlamentarischen Kontrollgremiums und der Staatsschutzkommission bis zur erstmaligen Wahl und Bestellung gilt § 14 Satz 2 des Staatsschutz-Kontrollgesetzes.

Ersatzformulierung (Variante B):

> (4) Für die Wahrnehmung der Aufgaben des Parlamentarischen Kontrollgremiums für den Staatsschutz und der Staatsschutzkommission bis zur erstmaligen Wahl und Bestellung gilt § 14 Satz 2 des Staatsschutz-Kontrollgesetzes.

Hinweis: Trefferzahl in Nr. 99: 1. Absatz 4 ist nach v2 ein rein klarstellender Verweis auf OstSKG § 14 Satz 2 (E-109).

**E-148 · OGVBl. 2026 Nr. 99, Artikel 4 Absatz 5 (bei Einfügung von E-145: Artikel 5 Absatz 5) (zu N-53, B-30) · [VK redaktionell]; Variante B [VK]**

Bisher:

> (5) Soweit § 83 Absatz 3 des Ostdeutschen Strafvollzugsgesetzes, § 71 Absatz 3 des Ostdeutschen Jugendstrafvollzugsgesetzes, § 49 Absatz 3 des Ostdeutschen Untersuchungshaftvollzugsgesetzes, § 88 Absatz 3 des Ostdeutschen Sicherungsverwahrungsvollzugsgesetzes und § 25 Absatz 2 des Ostdeutschen Abschiebungshaftvollzugsgesetzes auf § 2 Absatz 1 Satz 1 Nummer 1 bis 3a des Ostdeutschen Verfassungsschutzgesetzes verweisen, ist die am 31. Dezember 2026 geltende Fassung der in Bezug genommenen Vorschrift bis zu einer ausdrücklichen gesetzlichen Anpassung des jeweiligen Verweises weiter maßgeblich.

Ersatzformulierung bei E-145 Variante A oder ohne Folgeänderungsartikel (N-53):

> (5) Soweit § 83 Absatz 3 des Ostdeutschen Strafvollzugsgesetzes vom 16. Mai 2013 (SächsGVBl. S. 250), das zuletzt durch Artikel 2 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, § 71 Absatz 3 des Ostdeutschen Jugendstrafvollzugsgesetzes vom 12. Dezember 2007 (SächsGVBl. S. 558), das zuletzt durch Artikel 3 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, § 49 Absatz 3 des Ostdeutschen Untersuchungshaftvollzugsgesetzes vom 14. Dezember 2010 (SächsGVBl. S. 414), das zuletzt durch Artikel 5 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, § 88 Absatz 3 des Ostdeutschen Sicherungsverwahrungsvollzugsgesetzes vom 16. Mai 2013 (SächsGVBl. S. 294), das zuletzt durch Artikel 4 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, und § 25 Absatz 2 des Ostdeutschen Abschiebungshaftvollzugsgesetzes vom 28. Juni 2018 (SächsGVBl. S. 458), das zuletzt durch Artikel 2 des Gesetzes vom 23. März 2026 (OGVBl. 2026 Nr. 21 S. 2) geändert worden ist, auf § 2 Absatz 1 Satz 1 Nummer 1 bis 3a des Ostdeutschen Verfassungsschutzgesetzes verweisen, ist die am 31. Dezember 2026 geltende Fassung der in Bezug genommenen Vorschrift bis zu einer ausdrücklichen gesetzlichen Anpassung des jeweiligen Verweises weiter maßgeblich.

Ersatzformulierung bei E-145 Variante B (B-30):

> (5) Soweit
>
> 1. § 83 Absatz 3 des Ostdeutschen Strafvollzugsgesetzes vom 16. Mai 2013 (SächsGVBl. S. 250), das zuletzt durch Artikel 2 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, § 71 Absatz 3 des Ostdeutschen Jugendstrafvollzugsgesetzes vom 12. Dezember 2007 (SächsGVBl. S. 558), das zuletzt durch Artikel 3 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, § 49 Absatz 3 des Ostdeutschen Untersuchungshaftvollzugsgesetzes vom 14. Dezember 2010 (SächsGVBl. S. 414), das zuletzt durch Artikel 5 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, § 88 Absatz 3 des Ostdeutschen Sicherungsverwahrungsvollzugsgesetzes vom 16. Mai 2013 (SächsGVBl. S. 294), das zuletzt durch Artikel 4 des Gesetzes vom 15. Dezember 2022 (SächsGVBl. S. 626) geändert worden ist, und § 25 Absatz 2 des Ostdeutschen Abschiebungshaftvollzugsgesetzes vom 28. Juni 2018 (SächsGVBl. S. 458), das zuletzt durch Artikel 2 des Gesetzes vom 23. März 2026 (OGVBl. 2026 Nr. 21 S. 2) geändert worden ist, auf § 2 Absatz 1 Satz 1 Nummer 1 bis 3a,
>
> 2. § 22 Absatz 2 Nummer 3 des Ostdeutschen Sicherheitsüberprüfungsgesetzes auf § 2 Absatz 1 Satz 1 Nummer 2 bis 3a und auf § 2 oder
>
> 3. § 13 Absatz 7 Satz 1 Nummer 3 des Ostdeutschen Informationssicherheitsgesetzes auf § 2 Absatz 1 Nummer 1 bis 3a
>
> des Ostdeutschen Verfassungsschutzgesetzes verweisen, ist die am 31. Dezember 2026 geltende Fassung der in Bezug genommenen Vorschrift bis zu einer ausdrücklichen gesetzlichen Anpassung des jeweiligen Verweises weiter maßgeblich.

Hinweis: Entscheidung zu B-30 bei E-145. Die letzten Änderungen der Vollzugsgesetze entsprechen den Quellennotizen (Gesetz vom 15. Dezember 2022, Artikel 2 bis 5; Abschiebungshaftvollzugsgesetz OGVBl. 2026 Nr. 21 Art. 2); weitere Änderungen in den amtlichen Blättern unter Gesetze/ gibt es nicht. Die Wortfolge „§ 2 Absatz 1 Satz 1 Nummer 1 bis 3a des Ostdeutschen Verfassungsschutzgesetzes“ steht in jedem der fünf Vollzugsgesetze einmal. In der Fassung zu Variante B genügen für OstSÜG und OstISichG die Kurztitel, weil E-145 sie vorher voll zitiert; „§ 2 Absatz 1 Nummer 1 bis 3a“ in Nummer 3 deckt beide Verweise in OstISichG § 13 Abs. 7 Satz 1 Nr. 3 ab.

**E-149 · OGVBl. 2026 Nr. 99, Artikel 4 (künftig Artikel 5), neuer Absatz 6 nach Absatz 5 (zu B-30, beide Varianten) · [VK]**

Bisher (Einfügestelle, v2-Wortlaut von Absatz 5):

> (5) Soweit § 83 Absatz 3 des Ostdeutschen Strafvollzugsgesetzes, § 71 Absatz 3 des Ostdeutschen Jugendstrafvollzugsgesetzes, § 49 Absatz 3 des Ostdeutschen Untersuchungshaftvollzugsgesetzes, § 88 Absatz 3 des Ostdeutschen Sicherungsverwahrungsvollzugsgesetzes und § 25 Absatz 2 des Ostdeutschen Abschiebungshaftvollzugsgesetzes auf § 2 Absatz 1 Satz 1 Nummer 1 bis 3a des Ostdeutschen Verfassungsschutzgesetzes verweisen, ist die am 31. Dezember 2026 geltende Fassung der in Bezug genommenen Vorschrift bis zu einer ausdrücklichen gesetzlichen Anpassung des jeweiligen Verweises weiter maßgeblich.

Einfügen nach Absatz 5:

> (6) Verwaltungsvorschriften einschließlich Förderrichtlinien, die auf eine bestimmte Vorschrift des Ostdeutschen Verfassungsschutzgesetzes verweisen, sind bis zum 30. Juni 2027 an das Staatsschutz- und Nachrichtendienstgesetz anzupassen. Bis zu ihrer Anpassung ist die am 31. Dezember 2026 geltende Fassung der in Bezug genommenen Vorschrift weiter maßgeblich.

Hinweis: Hinter dem jeweils geltenden Wortlaut von Absatz 5 einfügen (v2 oder E-148). Erfasst die VwV OstSÜG B. IV., die VwV OstBesG Nr. 48, 49.2 und 56.2.3 sowie die Förderrichtlinien Aussteigerprogramm, Orte des Gemeinwesens, Weltoffenes Ostdeutschland und Bürgerbeteiligung. Frist wie Nr. 87 Art. 2 und LfStErrG § 12 Abs. 4; zu bestätigen bei E-145.

**E-150 · OGVBl. 2026 Nr. 99, Überschrift des bisherigen Artikels 5 (zu B-30, beide Varianten von E-145) · [VK redaktionell]**

Bisher:

> Artikel 5
>
> Inkrafttreten

Ersatzformulierung:

> Artikel 6
>
> Inkrafttreten

### 8.7 Technische Übernahme der neuen Fassung

Arbeitsbereich: zweiter isolierter Klon `staatsregierung-testlauf-ogvbl-85-99-v2` neben dem Originalcheckout (Zweig `testlauf/ogvbl-85-99-v2`, ohne Remote, Ausgangsrevision `e611963b9`). Der erste Testlauf bleibt unverändert zum Vergleich bestehen. Alle Testnormen tragen den Vorsatz „Vorbereitete Fassung (Testlauf v2)“, alle Test-Verkündungen den Titelzusatz „– vorbereitete Fassung (Testlauf v2, Annahme und Verkündung unterstellt)“.

| Schritt | Befehl / Werkzeug | Ergebnis |
| --- | --- | --- |
| Import der Sammeldatei (nur Prüflauf) | `import-normen.mjs --source-dir …` | eine Ausgabe „Nr. 85“ mit 15 Normen erkannt, als mehrdeutig gemeldet (T-1 unverändert) |
| Aufteilung | `testlauf/werkzeuge/split-v2.py` | 15 Einzelquellen, verlustfrei; das Werkzeug musste an die geänderten CSS-Klassen des neuen Exports angepasst werden |
| Strenger Vorablauf | `import-normen.mjs --strict --file …` (15 Dateien) | alle 15 Ausgaben erkannt, keine Parser- oder Vertragsbefunde, nur erwartete `would-create` |
| Schreiblauf | `import-normen.mjs --write --file …` | 22 Normen und 15 Verkündungen angelegt |
| Patch-Rezepte | `testlauf/werkzeuge/recipes-v2.mjs` | 13 Rezepte für 8 Ziele (PVDG 4, PolFHG 2, Hochschulgrade-VO 1, Pass-Ausführungsgesetz 1, Landesjugendhilfegesetz 1, Informationssicherheitsgesetz 1, OstVSG 1, OstAG G 10 1) |
| Konsolidierung | `consolidate-norms.mjs --target … --write` | PVDG: Fassungen 14.11.2026 und 1.12.2026; PolFHG: 1.12.2026 und 1.1.2027; Hochschulgrade-VO, Pass-Ausführungsgesetz, Landesjugendhilfegesetz, Informationssicherheitsgesetz: 1.12.2026; OstVSG und OstAG G 10: Ende 31.12.2026 |
| Ausführbarkeit der Ersetzungsbefehle | `testlauf/werkzeuge/ausfuehrbarkeit.py` | alle neun Wortersetzungen (Nr. 85 Art. 1 Nr. 2, Art. 2 Nr. 2 und 3, Art. 3 Nr. 2; Nr. 86 Art. 3 Abs. 1 bis 3) treffen in der am 1.12.2026 geltenden Fassung genau einmal die bezeichnete Stelle |
| Reihenfolgeprobe | `testlauf/werkzeuge/perm.mjs` | alle 6 Reihenfolgen der drei PVDG-Änderungen vom 1.12.2026 ergeben denselben Körper (`bfbf92e5…`) |
| Konsolidierungsaudit | `audit-consolidation.mjs`, danach `--check` | grün; 86 Akte, 124 Ziele, 119 vollständig, 5 offen (davon 3 Fehlzuordnungen des Pakets wie T-8) |
| Reststellen | `audit-ost-residuals.mjs` | grün (5249 Normen, 0 Reststellen) |
| Wissenshub, Dokumentation | `npm run knowledge:check`, `npm run docs:check` | grün |
| Content-Prüfung, strenger Import | `npm run content:check`, `import-normen.mjs --strict` | nur die gewollte Titelkennzeichnung wird gemeldet (15 × `would-update-publication`), sonst ohne Befund |
| OstRecht-Build | `npm run build:recht` | grün |
| D1-Seed Vollbestand | `serve-law-worker.mjs --seed-only --persist-to .cache/wrangler-v2` | 5249 Normen, 5375 Fassungen, 169 Verkündungen, verifiziert (nur lokale SQLite-Datei) |
| Sichtprüfung OstRecht | lokaler Worker `127.0.0.1:4398`, danach beendet | alle abgerufenen Norm-, Fassungs- und Verkündungsseiten HTTP 200; Testkennzeichnung sichtbar; PVDG-Fassung 1.12.2026 als „künftige Fassung“ mit § 97 Abs. 1 n. F., § 101 Abs. 3 „(weggefallen)“; „§ 100a“ in § 97 Abs. 1 ohne Link, weil § 100a im Bestand fehlt (T-2); bei Nr. 91 zeigt die Gliederung „Artikel 1 … Abschnitt 1 Errichtung und Rechtsstellung“ als eine Überschrift und den Bereich „§§ 12–2“ (Parserfolge T-3) |

Stand der technischen Befunde:

- **T-1 Sammeldatei: unverändert.** Die neue Datei enthält wieder alle 15 Ausgaben; geschrieben, erhielten 14 Gesetze eine falsche Fundstelle.
- **T-2 vorbestehende PVDG-Lücken: unverändert, jetzt sichtbarer.** § 97 Abs. 1 Satz 3 n. F. verweist ausdrücklich auf § 100a, den der Bestand nicht abbildet. Die Rezepte zu Nr. 46 und Nr. 50 sind vor einer produktiven Übernahme zu vervollständigen.
- **T-3 Parser: verschärft.** Jetzt fünf eingeführte Gesetze ohne eigenen Datensatz: Polizeibeschwerdestellengesetz (Nr. 88), Ostdeutsches Sicherheitsgesetz (Nr. 90), Staatsschutzamt-Errichtungsgesetz (Nr. 91, neu, weil das Blatt jetzt ein Artikelgesetz ist), OstSNDG (Nr. 92), OstLVSG (Nr. 95). Bei Nr. 88, 90, 91 und 92 hängen die Schlussartikel strukturell unter dem letzten Abschnitt des eingeführten Gesetzes; bei Nr. 91 geht die Überschrift „Abschnitt 1“ verloren. Das „Artkel“-Problem (Nr. 90) ist mit der Textkorrektur entfallen. Kein Prüflauf meldet diese Befunde.
- **T-4 Teilinkrafttreten Nr. 94: unverändert** (Parser setzt den 14.11.2026 für das ganze Gesetz; im Test wieder per `effectiveOverride` korrigiert).
- **T-5 Normtyp: teilweise erledigt.** Nr. 91 wird als Mantelgesetz jetzt richtig typisiert; Nr. 85 wird weiter als `gesetz` erkannt.
- **T-6 REVOSax-Ausgangsfassungen: erweitert.** Durch die neuen Folgeänderungen fehlen Snapshots nun für sieben Ziele: PolFHG, Hochschulgrade-VO, OstVSG, OstAG G 10, Pass-Ausführungsgesetz, Landesjugendhilfegesetz, Informationssicherheitsgesetz (im Test ersatzweise gespeicherte Fassung vom 1.11.2023).
- **T-7, T-9, T-10, T-11: unverändert.** Die Inhaltsübersichtsbefehle (Nr. 86 Art. 2 Nr. 1, Nr. 96 Art. 1 Nr. 1) sind weiter nicht abbildbar.
- **T-8 Konsolidierungsaudit: unverändert.** Fehlzuordnungen zum Hochschulgesetz und zur APO Polizei bleiben.
- **T-12 Prüfketten: unverändert.** Kein inhaltlicher Befund dieses Abschnitts wird maschinell erkannt.
- **Auszeichnungsmängel der neuen Quelle (nur technische Übernahme):** In Nr. 85 Art. 2 steht vor Nummer 1 ein geschütztes Leerzeichen (Rest von B-03). In Nr. 96 Art. 1 sind die Nummern 3 und 4 als einfache, von Hand nummerierte Absätze statt als Listeneinträge ausgezeichnet; die Überschrift von Art. 3 ist als Absatz statt als Überschrift ausgezeichnet. In Nr. 91 stehen die Artikelüberschrift und „Abschnitt 1“ in einer gemeinsamen Überschrift. Keiner dieser Punkte ändert den Normtext; beim Import sind sie von Hand nachzuziehen.
- **Wortgetreue Ausführung von Nr. 86 Art. 2 Nr. 2:** Der Befehl „§ 97 Absatz 1 bis 2 wird wie folgt gefasst:“ wurde wörtlich ausgeführt (nur Absätze 1 und 2). Damit bleibt § 97 Abs. 3 („Polizeidirektion Berlin einzurichten“) neben VPOG § 7 Abs. 2 stehen. Die andere Lesart (ganzer § 97, weil das Zitat Paragraphenzeichen und Überschrift enthält) ist nicht gewählt worden; siehe Abschnitt 8.4.

### 8.8 Kontrolle: ursprünglicher Checkout und produktiver Rechtsbestand nach dem zweiten Lauf

Vergleich mit dem Ausgangsstand aus 7.3, aufgenommen nach Abschluss aller Prozesse des zweiten Laufs (der lokale Worker war beendet):

| Merkmal | Ausgangsstand (13.11.2026, 09:22 Uhr) | nach dem zweiten Lauf |
| --- | --- | --- |
| HEAD | `e611963b9…` | identisch |
| `git status --porcelain` (SHA-256) | `e3b0c442…` (leer) | identisch |
| alle Refs (`git for-each-ref`, SHA-256) | `47665a3c…` | `c21d89f9…`: nur `refs/remotes/origin/main` geändert (`e611963b9…` → `a4d43c24e…`) |
| Index-Inhalt (`git ls-files -s`, SHA-256) | `364bcaba…` | identisch |
| Worktree-Liste | 2 Einträge | identisch |
| `temp-neu/OGVBl.2026Nr.85100.html` (SHA-256) | `97480bf5…` | `5e77b3b2…` |

Die Änderung von `refs/remotes/origin/main` stammt von einem automatischen Abruf um 15:35:58 Uhr. Laut Reflog war es `fetch --no-recurse-submodules --no-tags --refmap= --porcelain …`, wie bei der Editor-Integration in 7.3. Dieser Testlauf hat im Original keinen `git fetch` ausgeführt. Der Abruf hat drei auf GitHub zusammengeführte Abhängigkeitsaktualisierungen (#66 bis #68) nachgeladen. HEAD, lokale Zweige, Index und Arbeitsverzeichnis des Originals sind unverändert.

Die Sammeldatei in `temp-neu/` ist die vom Auftraggeber bereitgestellte neue Fassung, die dieser Abschnitt prüft. Der Testlauf hat sie nur gelesen und für die Aufteilung in den zweiten Klon kopiert. Sonst lief im Original kein schreibender Befehl. Der zweite Lauf arbeitete ausschließlich im Klon `staatsregierung-testlauf-ogvbl-85-99-v2` und in einem temporären Arbeitsverzeichnis. Der erste Klon blieb bis auf diesen Bericht unverändert.

Produktiver Rechtsbestand: Es lief kein Remote-, Deploy-, D1-Sync-, R2- oder REVOSax-Befehl. Alle D1-Projektionen sind lokale SQLite-Dateien unter `.cache/` des zweiten Klons. Dieser Bericht liegt auf ausdrücklichen Wunsch mit Werkzeugen und Protokollen auf dem eigenen Branch `testlauf/ogvbl-2026-85-99-pruefbericht` (Ordner `testlauf/ogvbl-2026-85-99/`). Der Branch enthält keine Änderung an `content/`, `Gesetze/`, `data/` oder `knowledge/`. Er ist nicht zum Zusammenführen bestimmt und löst kein Deployment aus, weil das Deployment nur bei Änderungen an `main` läuft.
