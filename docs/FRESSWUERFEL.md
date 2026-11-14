# Fresswürfel-Maskottchenwettbewerb

## Redaktion und Termine

Adresse: `/themen/fresswuerfel-maskottchen/`. Kampagnenkonfiguration:
`content/kampagnen/fresswuerfel.json`. Seitentexte und Formular:
`apps/portal/src/pages/themen/fresswuerfel-maskottchen/index.astro`.

`phase` steuert `vorbereitet`, `einreichung`, `sichtung`, `ergebnis`. Die API nimmt nur bei
`einreichung` innerhalb von `startsAt` (inklusive) und `endsAt` (exklusive) Beiträge an.
Termine als ISO-8601 mit Offset/Z; öffentliche Ausgabe Europe/Berlin. Der Einreichungsschluss
am 30. November 2026 umfasst den ganzen Tag: gespeichert ist `2026-12-01T00:00:00+01:00`.
Ohne Startdatum erscheint „Der Starttermin wird hier bekannt gegeben.“ Der Wettbewerb ist
unabhängig vom Betriebsbeginn der Restaurantkette.

Nach der Frist `phase: "sichtung"` wählen. `candidates` enthält ausschließlich freigegebene
`{slug,title,description,image?}`; Bilder als `{src,alt}`. Die Auswahl erscheint nur bei Sichtung.
Für die Ergebnisfreigabe `result: {title,description,explanation?}` pflegen und `phase: "ergebnis"`
setzen. Keine erfundenen Ergebnisse einsetzen; die URL bleibt erhalten. Die HO trifft die
Auswahl nach Wiedererkennbarkeit, Fresswürfel-Bezug, Eigenständigkeit und Kostümtauglichkeit.
Es gibt keine öffentliche Abstimmung.

Der Startseitenteaser verwendet `ImportantNoticeBand` und erscheint beim Build innerhalb von
`teaserFrom`/`teaserUntil` und der offenen Einreichung. Dafür gilt die echte Bauzeit, weil die
laufende Teilnahme unabhängig vom redaktionellen Rechtsstichtag geöffnet wird. Am Fristende
die Sichtungsphase veröffentlichen; der Browser entfernt den abgelaufenen Teaser auch ohne
Neubau, und die API schließt automatisch nach Echtzeit.
Die Themenübersicht, Portalsuche und Sitemap führen den Wettbewerb dauerhaft.

## Speicher und Sicherheit

Cloudflare-Ressourcen sind für Produktion und Staging getrennt konfiguriert:

| Umgebung | D1 | Privater R2-Speicher |
| --- | --- | --- |
| Produktion | `ostrecht-fresswuerfel` | `ostrecht-fresswuerfel-skizzen` |
| Staging | `ostrecht-fresswuerfel-staging` | `ostrecht-fresswuerfel-skizzen-staging` |

Bindings: `FRESSWUERFEL_DB` und `FRESSWUERFEL_SKETCHES`. Keine öffentlichen R2-Domains und kein
r2.dev-Zugriff. E-Mail-Adressen, Originaltexte und Originalbilder haben keine öffentlichen
Leseendpunkte. Moderation erfolgt ausschließlich über einen berechtigten Cloudflare-Zugang.

Dateien: optional JPEG, PNG, WebP bis 5 MiB; höchstens 4.194.304 Pixel und 4.096 Pixel je Seite.
Die API begrenzt den gesamten Request auch ohne Content-Length, prüft Typ/Abmessungen und
decodiert das Bild mit Photon/WASM tatsächlich vor der Speicherung. SVG, defekte, falsch
deklarierte und zu große Bilder werden abgewiesen. Originaldateinamen werden nicht gespeichert.
Originale bleiben unverändert unter zufälligen privaten Objektschlüsseln. Ein Bild ist nie
Teil der öffentlichen Antwort.

Der Browser sendet einen stabilen Anfragebezeichner. Ein SHA-256 aus Texten und gegebenenfalls
Bildbytes sowie der eindeutige D1-Schlüssel verhindern doppelte Speicherung bei Wiederholungen.
Eine Nummer erscheint erst nach bestätigtem R2-Upload (falls vorhanden) und Nachlesen des
D1-Datensatzes. Unklare Speicherergebnisse erzeugen keinen Erfolg; erneutes Senden ist möglich.
Parallel verworfene Uploadversuche werden bereinigt, verwaiste Originale spätestens über den
R2-Lebenszyklus entfernt. Pro gehashter IP-Kennung sind fünf neue Versuche je UTC-Stunde erlaubt;
auch ungültige Bildversuche zählen. Identische erfolgreiche Wiederholungen werden zuvor erkannt.

`privacyContact` ist `ho@freistaat-ostdeutschland.de`, `retentionDays` beträgt 90. Der tägliche
Löschworker `ostrecht-fresswuerfel-cleanup` läuft um 02:17 UTC und entfernt abgelaufene Originale
vor den zugehörigen D1-Datensätzen sowie alte Rate-Limit-Kennungen. Fehler erscheinen in den
Worker-Logs; Wiederholungen sind sicher. Die öffentliche maximale Frist berücksichtigt den
folgenden täglichen Lauf. R2 hat zusätzlich eine 90-Tage-Lebenszyklusregel für `originals/`.
Cloudflare-D1-Wiederherstellungskopien unterliegen separat den accountseitigen Time-Travel-Fristen;
diese sind keine öffentlichen Datenquellen und werden nicht für die Redaktion verwendet.

## Lokale Vorschau

```sh
npm run build:portal
node scripts/fresswuerfel.mjs preview --phase einreichung --port 4330
```

Vorschau: `http://127.0.0.1:4330/themen/fresswuerfel-maskottchen/`.
Der Befehl initialisiert D1 samt Bildmigration und privaten lokalen R2-Speicher, ohne Remotezugriff.
Daten liegen ignoriert unter `.cache/fresswuerfel/`. Nur synthetische Beiträge verwenden.
Zum Phasenwechsel neu starten: `--phase vorbereitet`, `sichtung` oder `ergebnis`. Diese
Vorschauphasen funktionieren ausschließlich bei `APP_ENV=local`. Die Ergebnisprobe ist als
lokaler Test benannt. Kein Vorschaudatensatz wird in Produktionsdaten übernommen.

## Sichtung, Freigabe und Löschung

```sh
node scripts/fresswuerfel.mjs list
node scripts/fresswuerfel.mjs inspect --number FW-…
node scripts/fresswuerfel.mjs approve --number FW-… --title "Freigegebener Titel" --description "Redigierter Kurztext"
node scripts/fresswuerfel.mjs approve --number FW-… --title "Freigegebener Titel" --description "Redigierter Kurztext" --image --alt "Beschreibung der abgebildeten Figur"
node scripts/fresswuerfel.mjs purge
node scripts/fresswuerfel.mjs delete --number FW-…
```

Standard ist lokal. Remote ausdrücklich `--remote --config apps/portal/wrangler.jsonc` ergänzen;
für Staging zusätzlich `--env staging`. Ein abweichender Bucket kann über `--bucket` angegeben
werden. `list` zeigt maximal 100 gültige Einreichungen; für größere Bestände über berechtigtes
Wrangler-SQL nach Datum/Nummer paginieren. `inspect` lädt ein privates Original ausschließlich
in `.cache/fresswuerfel/sichtung/`, niemals ins öffentliche Verzeichnis.

`approve` verlangt einen ausdrücklich redigierten Kurztext. `--image` decodiert das ausgewählte
Original erneut mit sharp, richtet es aus, verkleinert es auf maximal 1.200 × 1.200 Pixel und
codiert es neu als WebP ohne EXIF/XMP/ICC-Metadaten. `--alt` ist dabei Pflicht. Nur dieses Derivat
darf in die Galerie. Rechte und endgültigen Einsatz klärt die HO gesondert mit den Einreichenden.

Remote-Freigaben schreiben den kuratierten Datensatz nach `content/kampagnen/fresswuerfel.json`
und Bildderivate nach `public/images/fresswuerfel/auswahl/`. Der geprüfte Branch/PR veröffentlicht
sie. Lokal entstehen Freigaben und Derivate ausschließlich in `.cache/fresswuerfel/`; ein
Neustart der lokalen Sichtungsvorschau zeigt sie an. Ein neuer Build entfernt deren lokale
Vorschaukopien aus dem generierten Ausgabeverzeichnis. Keine Kontaktdaten oder Originale in Git.

`delete` entfernt Original und privaten Datensatz. Bei Löschwünschen gegebenenfalls zusätzlich
die öffentliche Freigabe und ihr Derivat über einen geprüften PR entfernen. `purge` ist der
manuelle Löschlauf; regelmäßig übernimmt das der Cron-Worker.

## Betrieb und Veröffentlichung

Konfiguration: `apps/portal/wrangler.jsonc`; Cron-Worker:
`apps/portal/wrangler.fresswuerfel-cleanup.jsonc`. Beide Umgebungen führen ihre eigenen Bindings.
Schema: erst `data/fresswuerfel/schema.sql`, dann einmalig `data/fresswuerfel/002-skizzen.sql` auf
der jeweiligen neuen Datenbank anwenden (lokal automatisch). Nicht erneut die ALTER-Migration
auf einer bereits migrierten Datenbank ausführen. Keine Migration auf die Rechtsdatenbank.

Runtime-Variablen: `FRESSWUERFEL_ENABLED=true`, `FRESSWUERFEL_UPLOADS_ENABLED=true`.
`FRESSWUERFEL_RATE_SALT` ist ein unabhängiges zufälliges Worker-Secret je Umgebung (mindestens
32 Zeichen, nur über stdin bei `wrangler secret put`). Ohne Binding, Secret oder gepflegte
Datenschutzhinweise bleibt das Formular geschlossen; ohne R2-Anbindung bleibt das Uploadfeld aus.

Veröffentlichungen erfolgen über den in [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)
beschriebenen geprüften PR-/Main-Workflow. `deploy:portal` und `deploy:portal:staging`
veröffentlichen jeweils auch den zugehörigen Löschworker. Eine Produktionsaktivierung ist vom
Betriebsbeginn der Restaurantkette unabhängig. Keine Testbilder oder Vorschaukonfigurationen
in Release-Artefakte übernehmen. Nach Veröffentlichung Formular, ungültigen Upload, gespeicherte
Einreichung und private Direktzugriffe prüfen; ausschließlich markierte technische Proben nutzen
und diese anschließend samt Originalen löschen.

## Prüfwerkzeuge

```sh
npm run check:portal
npm run build:portal
node --experimental-strip-types --test tests/fresswuerfel.test.ts
npx playwright test --config playwright.fresswuerfel.config.ts
npm run test:fast
npm run content:check
npm run docs:check
```

Unit-Tests prüfen echte SQLite-Abfragen, Bilddecoder, Wiederholung, Rate-Limit, Speicherfehler,
Phasen und Löschung. Browserprüfungen prüfen Text und Bild, fehlerhafte Dateien, Originalschutz,
Bildfreigabe ohne Metadaten, alle Phasen, Tastatur, mobile Breiten und WCAG. Screenshots liegen
im ignorierten `test-results/fresswuerfel/`.

Technische Grundlagen: [Photon für Cloudflare Workers](https://silvia-odwyer.github.io/photon/guide/photon-cloudflare-workers/),
[R2-Lebenszyklen](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
