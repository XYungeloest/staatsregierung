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


### Normseite


### Verkündungen und Startseite


### Kopf, Layout und Benennungen


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
