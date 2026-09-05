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
