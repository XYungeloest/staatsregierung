# Offene technische Arbeiten

Diese Liste enthält nur offene Aufgaben mit Fertigkriterium. Erledigtes wird entfernt, nicht
abgehakt; Git ist die Historie. Quellenlücken stehen in `CONTENT_GAPS.md`, benötigte externe
Zuarbeit in `docs/ZUARBEITSFORMULAR.md`, wiederkehrende Pflegeregeln in
`docs/DEPLOYMENT_RUNBOOK.md`.

## OstRecht

- [ ] Linux-Baselines der Screenshot-Suite committen. Der CI-Job `visual` erzeugt fehlende
  `*-linux.png` im Playwright-Container und stellt sie als Artefakt bereit. Fertig, wenn
  `tests/visual.spec.ts-snapshots/` für jede Seite und jedes Projekt eine Linux-Baseline enthält und
  der Job ohne Warnung „Baselines fehlen“ durchläuft.
- [ ] Fundstellensuche um das Ostdeutsche Vertragsblatt erweitern: `PUBLICATION_REFERENCE_PATTERN`
  in `packages/recht-search/src/search-query.ts` kennt `OVertrBl.` nicht, eine Suche nach
  „OVertrBl. 2026 Nr. 1“ wird deshalb nicht als Fundstelle erkannt. Fertig, wenn ein Unit-Test in
  `tests/law-portal.test.ts` den Fundstellentreffer für ein Vertragsblatt nachweist (Änderung an der
  Suchlogik löst eine Vollprojektion aus, siehe `docs/REVOSAX_BULK_IMPORT.md`).
- [ ] Abgeleitete Metadaten der übernommenen Normen nachschärfen: Sachgebiete, Schlagwörter und
  Kurzfassungen der REVOSax-Baseline sind deterministisch aus Typ, Ressort und Titel abgeleitet und
  im Import-Audit als `derivedMetadata` gekennzeichnet. Fertig, wenn redaktionell geprüfte Werte
  vorliegen und die Kennzeichnung in `data/recht/revosax-import-audit/summary.json` entfällt.
- [ ] Cloudflare-Plan festlegen: Workers Paid ist für den Betrieb mit dem Vollbestand vorgesehen
  (Schreibvorgänge einer Vollprojektion, CPU-Zeit großer Normen). Fertig, wenn der Plan aktiv ist
  und `docs/DEPLOYMENT_RUNBOOK.md` die geltenden D1-Limits nennt.

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
