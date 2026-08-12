# Betriebsrunbook für Veröffentlichungen

Das Portal wird ausschließlich über den Workflow `Deploy to Cloudflare Workers` veröffentlicht.
Ein manuelles Überschreiben des produktiven Workers ist kein Wiederherstellungsweg.

## Regulärer Ablauf

1. Änderung über einen geprüften Pull Request nach `main` übernehmen.
2. Im Main-Workflow zuerst `quality` und `visual` prüfen. Der Job `deploy` startet erst nach beiden
   erfolgreichen Prüfungen.
3. Den im Workflow ausgewiesenen vollständigen Commit notieren.
4. Nach dem Deployment die Produktionskennung und die zentralen Routen nach dem unten
   beschriebenen Verfahren prüfen.

Ein manuell gestarteter Workflow verwendet standardmäßig `staging`. Dafür muss eine vollständige
`site_url` angegeben werden. `production` ist nur für eine bewusst freigegebene Veröffentlichung
zu wählen.

## Fehlerklasse bestimmen

| Fehlerklasse | Erkennbar an | Nächster Schritt |
| --- | --- | --- |
| Inhalt oder Wissenshub | `content:check`, Normaudit, Knowledge-Check oder generierte Dateien schlagen fehl | Daten und Quelle im PR korrigieren; Validator nicht abschwächen |
| Typen oder Build | `astro check`, Unit-Test oder Build schlägt fehl | Fehler im selben Branch reproduzieren und über Korrektur-PR beheben |
| Browser oder Barrierefreiheit | Link-, SEO-, Accessibility-, Quality- oder Browser-Test schlägt fehl | betroffene Route und Viewport aus dem Testbericht prüfen |
| Visuelle Regression | Visual-Job schlägt fehl | Artefakt `visual-diffs-…` laden, expected/actual/diff einzeln sichten; Baselines nur nach Abnahme ändern |
| Cloudflare-Upload | alle Prüfungen grün, aber `deploy` schlägt fehl | Token, Account-ID, Worker-Konfiguration und Wrangler-Ausgabe prüfen; keine lokale Ersatzveröffentlichung |
| Nachkontrolle | Workflow grün, aber Commitkennung oder Route stimmt nicht | letzte tatsächlich ausgelieferte Kennung feststellen und Deployment erst nach Ursachenklärung erneut anstoßen |

## Letzten ausgelieferten Commit feststellen

Die HTML-Seiten tragen `meta[name="build-commit"]`; alle ausgelieferten Routen tragen zusätzlich
`X-Portal-Commit`. Für eine erste Prüfung:

```sh
curl -fsSI https://freistaat-ostdeutschland.de/ | sed -n '/^x-portal-commit:/Ip'
curl -fsS https://freistaat-ostdeutschland.de/ | grep -o 'meta name="build-commit" content="[0-9a-f]\{40\}"'
```

Die ermittelte Kennung mit dem freigegebenen Commit auf `main` und dem letzten erfolgreichen
Deployment-Job vergleichen. Der öffentliche Stand gilt erst dann als bestätigt, wenn Header und
HTML dieselbe vollständige Kennung ausgeben.

## Korrektur und Wiederanlauf

1. Fehler lokal mit dem betroffenen Repositorybefehl reproduzieren.
2. Korrektur in einem neuen oder bestehenden Pull Request vornehmen.
3. Vollständige für den Änderungstyp relevante CI abwarten.
4. Korrektur nach `main` übernehmen; der normale Main-Workflow veröffentlicht sie.
5. Einen abgebrochenen Lauf nur dann erneut starten, wenn die Ursache außerhalb des Codes lag und
   unverändert behoben ist, etwa ein vorübergehender Cloudflare-Ausfall.

Produktionsdateien, Worker-Versionen und Content werden nicht direkt in Cloudflare korrigiert.
Dadurch bleibt jeder ausgelieferte Stand einem Git-Commit zuordenbar.

## Nachkontrolle

Die folgenden Routen müssen dieselbe vollständige Kennung liefern und erfolgreich antworten:

```text
/
/recht/
/recht/verfassung/
/recht/norm/erstes-gesetz-zur-grossen-staatsreform/
/recht/norm/sero-verordnung/
/recht/verkuendungen/ogvbl-2026-53/
/recht/verkuendungen/ogvbl-2026-58/
/sitemap.xml
/search-index.json
```

Zusätzlich kurz prüfen:

- Startseite, Themenübersicht und aktuelles Leitthema,
- Rechtssuche und eine geltende Normfassung,
- `robots.txt`, Sitemap und Suchindex,
- auf Mobilbreite Navigation, Suche und die Einwilligungsentscheidung,
- dass keine Webanalyse ohne Zustimmung geladen wird.

## Abhängigkeiten und Actions

Dependabot öffnet wöchentlich reviewpflichtige Pull Requests für npm- und GitHub-Actions-
Aktualisierungen. Jeder Pull Request führt `npm audit --audit-level=high` aus. Ein hoher oder
kritischer Befund wird behoben, bevor die Änderung nach `main` gelangt. Eine vorübergehend nicht
behebbare Ausnahme muss mit Advisory, betroffener Nutzung, Risikobewertung und Prüftermin im
zentralen TODO der README dokumentiert werden. Major-Upgrades von Astro, Cloudflare-Adapter oder
Wrangler benötigen die vollständige Testmatrix einschließlich Build, Browser-, Accessibility- und
Visual-Tests.
