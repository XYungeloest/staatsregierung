# Implementierungsbericht: Portalqualität 2026

Stand der Umsetzung und Prüfung: 18. Juli 2026

## Ergebnis

Die im Auftrag genannten Punkte der Prioritäten A, B und C wurden im Repository umgesetzt. Die
bestehende Astro-/Cloudflare-Architektur, die behördennahe Gestaltung und sämtliche bestehenden
Rechtsportal-URLs blieben erhalten. Der Produktionsbuild erzeugt 322 Seiten. Die automatisierten
Content-, Typ-, Unit-, Link-, SEO-, Datenschutz-, Layout-, Browser-, Accessibility- und visuellen
Prüfungen sind erfolgreich.

Eine Änderung bleibt außerhalb des Repositorys erforderlich: In der Cloudflare-Konfiguration muss
die automatische Einbindung von **Cloudflare Web Analytics** deaktiviert bleiben. Im Quellcode,
Build und in der Worker-Konfiguration gibt es keine Einbindung von
`static.cloudflareinsights.com`; eine Dashboard-Injektion kann das Repository jedoch nicht
verhindern. Nach dem nächsten Deployment müssen außerdem die ausgelieferten Header einmal an der
öffentlichen HTTPS-URL gegengeprüft werden.

## Kompakte Übersicht

| Priorität | Problem | Umsetzung | Dateien | Verifikation |
| --------- | ------- | --------- | ------- | ------------ |
| A1 | OSM und Statistik vor Einwilligung; unvollständiger Datenschutz | lokale Kartenfreigabe, Consent-Gating und -Widerruf, gleichwertige Entscheidungen, vollständige Datenschutzerklärung | `src/pages/kreisreform/index.astro`, `src/scripts/kreisreform-map.ts`, `src/scripts/analytics-consent.ts`, `src/components/analytics/AnalyticsConsentBanner.astro`, `src/pages/service/datenschutz.astro` | Privacy-/Request-Tests bestanden |
| A2 | fehlende Sicherheitsheader | Cloudflare-Static-Assets-Header und ressourcenbasierte CSP | `public/_headers` | Produktionspreview und Header-Abruf bestanden |
| A3 | horizontaler Dokumentüberlauf | containerbezogene Vollbreitenfläche statt `vw`-Berechnung; lokale Scrollcontainer | `src/styles/global.css`, `tests/quality.spec.ts` | alle acht Viewports bestanden |
| A4 | `OstBFG`/`GüABFO` widersprüchlich; zufällige Normempfehlungen | Metadaten bereinigt; belastbare Relationslogik mit Beziehungsart | Bildungsfreistellungs-`meta.json`, `src/lib/norms/references.ts`, Normseiten | drei Unit-Tests und Buildprüfung bestanden |
| A5 | „1 Gemeinden“ und Darstellungsfehler | zentrale Mengenflexion; typografische Metadatenkorrekturen | `src/lib/kreisreform/format.ts`, Kreisreform-Skripte, betroffene Norm-JSONs | Content-QA bestanden |
| A6 | fiktive Behörde als `GovernmentOrganization` | allgemeine `Organization` mit ausdrücklicher Simulationsbeschreibung | `src/lib/seo/index.ts`, `src/config/site.ts` | JSON-LD-/SEO-Prüfung bestanden |
| B7–10 | lange Startseite, schmale Karten, ungenauer CTA, hoher Header | priorisierte Startseite, Dreierspalten, passender CTA, kompakter Header | `src/pages/index.astro`, `src/styles/global.css`, `src/layouts/BaseLayout.astro` | 115 visuelle Tests bestanden |
| B11 | übergroße Rasterbilder | AVIF/WebP/JPEG, `picture`, `srcset`, `sizes`, feste Maße | `ResponsivePicture.astro`, Bildkomponenten, `scripts/generate-responsive-images.mjs`, `public/images/generated/` | Build, Browser- und Bildprüfung bestanden |
| B12 | uneinheitliche Reformstatus | sechs normalisierte Statuswerte ohne erfundene Daten | Themen-JSONs, `schema.ts`, `presentation.ts`, `CONTENT.md` | Content-/Typprüfung bestanden |
| B13 | unübersichtliche Portalsuche | Relevanz, Hervorhebung, Aktualität, URL-Zustand, Nachladen, Live-Status, `noindex` | `src/scripts/portal-search-page.ts`, `src/pages/suche.astro`, `src/lib/portal/search.ts` | Browser- und SEO-Prüfung bestanden |
| B14–16 | Kontakt-Live-Status, Header-Namen, unvollständige Erklärung | Live-Region, stabile Fokusführung, kurze Namen, dokumentierter Prüfstand | Kontakt-, Layout-, Barrierefreiheitsdateien | Browser- und Axe-Tests bestanden |
| B17 | sichtbare Datumswerte ohne Semantik | `<time datetime>` in Portal-, Presse-, Regierungs-, Kreisreform- und Rechtseiten | betroffene Seiten und Kartenkomponenten | Astro-Check und SEO-QA bestanden |
| C18 | fehlende Social-Vorschau | 1200 × 630 PNG, Open-Graph- und Twitter-Metadaten | `public/images/social/portal-preview.png`, `BaseLayout.astro` | Maße, absolute URL und Meta-Tags geprüft |
| C19 | Sitemap ohne `lastmod` | nur belastbare Inhaltsdaten als `lastmod`; Suche ausgeschlossen | `src/pages/sitemap.xml.ts` | SEO- und Linkprüfung bestanden |
| C20 | schwache zukünftige Slugs | `ae/oe/ue`, Wortgrenzen, stabile numerische Kollisionen | Import-/Vorbereitungsskripte | bestehende URLs unverändert; Typ-/Buildprüfung bestanden |
| C21 | lange Kreistabelle | Kreis-/Bezirksfilter, Live-Zahl, sticky Köpfe, mobile Darstellung, Scrollhinweis | Kreisreformseite, `kreisreform-table.ts`, CSS | Browser-, Overflow- und Axe-Tests bestanden |

## Bestandsaufnahme

### Architektur und Deployment

- Framework: Astro 6 mit TypeScript und statischer Ausgabe.
- Zielplattform: Cloudflare Workers mit `@astrojs/cloudflare`; statische Assets werden über die
  Cloudflare-Static-Assets-Konvention ausgeliefert.
- Inhalte: dateibasiert unter `content/`; Normen behalten `meta.json`, `history.json` und gespeicherte
  Fassungen unter `versions/`.
- Laufzeitdaten: keine aktiven D1- oder R2-Bindings.
- Suche: buildzeitlich erzeugte JSON-Indizes mit clientseitiger Darstellung; die Basisseite bleibt
  ohne Suchparameter erreichbar.
- Kartenansicht: Leaflet mit lokalen Geometrie-/Manifestdaten und externen OpenStreetMap-Kacheln.
- Statistik: Google Analytics 4 war bereits als optionales Feature mit einer Measurement-ID
  konfiguriert.

### Tatsächliche externe Verbindungen

| Dienst/Ziel | Art | Neuer Laufzeitstatus |
| ----------- | --- | -------------------- |
| Cloudflare | Hosting, CDN und technische Protokollierung | für die Auslieferung erforderlich; in der Datenschutzerklärung beschrieben |
| `a/b/c.tile.openstreetmap.org` | Kartenkacheln | ausschließlich nach „Karte laden“, nur für den aktuellen Seitenaufruf |
| `www.googletagmanager.com` und Google-Analytics-Endpunkte | optionale Statistik | ausschließlich nach ausdrücklicher Statistikzustimmung |
| `gesetze-im-internet.de` | weiterführende Rechtslinks | nur bei einem aktiven Klick, keine automatische Einbettung |
| Schema.org-URLs | Bezeichner in JSON-LD | keine Browseranfrage |
| `static.cloudflareinsights.com` | mögliche Hosting-Dashboard-Injektion | keine Einbindung im Repository oder Build; extern zu deaktivieren |

Lokale Schrift-, Bild-, Script-, Stylesheet-, GeoJSON- und Suchindexdateien erzeugen keine
Drittanfragen. Die CSP bildet genau die verbleibenden Laufzeitziele ab.

## Priorität A

### A1 – Datenschutz und externe Dienste

**Problem und Ursache:** Leaflet wurde beim Sichtbarwerden beziehungsweise Seitenstart
initialisiert. Dadurch konnten OSM-Kacheln ohne aktive Entscheidung angefordert werden. GA4 war
zwar zustimmungsabhängig angelegt, aber Ablehnung, Widerruf, Speicherfehler und die optische
Gleichwertigkeit waren nicht vollständig abgesichert. Die Datenschutzerklärung bildete OSM,
Cloudflare und die Einwilligungsabläufe nicht vollständig ab.

**Lösung:**

- Die Karte beginnt als lokale, fokussierbare Ladefläche mit Erklärung, primärem Ladebutton und
  Sprunglink zur vollständig funktionsfähigen Alternative.
- Erst `data-map-load` importiert und initialisiert Leaflet. Die Freigabe wird bewusst nicht
  dauerhaft gespeichert.
- Gebietssuche, Ergebnisdetail, Bezirksübersicht, Kreis-/Bezirksfilter und Tabellen arbeiten ohne
  Karte.
- GA4 lädt erst nach `accepted`; der Standard ist `rejected`. Ablehnung bleibt in `localStorage`
  wirksam. Der Widerruf entfernt den Loader, setzt den Consent zurück, versucht vorhandene
  Statistik-Cookies zu löschen und führt den Fokus zur erneuten Entscheidung.
- Beide Bannerentscheidungen verwenden dieselbe Größe, Farbe und visuelle Gewichtung. Die
  Tastaturreihenfolge ist „nur notwendig“ vor „Statistik erlauben“.
- Die Datenschutzerklärung nennt verantwortliche Stelle, Hosting/Protokolle, Dienste, Zwecke,
  Datenarten, Empfänger, Einwilligungslogik, nur tatsächlich bekannte Speicheraussagen, Widerruf,
  Rechte, mögliche internationale Übertragungen und Kontaktwege.

**Betroffene Dateien:**
`src/pages/kreisreform/index.astro`, `src/scripts/kreisreform-map.ts`,
`src/scripts/kreisreform-search.ts`, `src/scripts/kreisreform-table.ts`,
`src/scripts/analytics-consent.ts`, `src/components/analytics/AnalyticsConsentBanner.astro`,
`src/pages/service/datenschutz.astro`, `content/service/seiten/datenschutz.json`, CSS und Tests.

**Auswirkung:** Keine OSM- oder Google-Statistikanfrage vor der jeweiligen Entscheidung;
gleichwertige, widerrufbare und tastaturbedienbare Auswahl; vollständige Nutzung ohne Karte.

### A2 – Sicherheitsheader

**Problem und Ursache:** Die statische Cloudflare-Ausgabe enthielt keine projektspezifische
Headerdatei.

**Lösung:** `public/_headers` setzt HSTS für zwei Jahre einschließlich Subdomains,
`nosniff`, `strict-origin-when-cross-origin`, eine restriktive `Permissions-Policy`,
`X-Frame-Options: DENY`, `X-Permitted-Cross-Domain-Policies: none` und eine CSP mit
`frame-ancestors 'none'`. Es gibt weder `*` noch `unsafe-eval`. `unsafe-inline` bleibt für die von
Astro ausgegebenen Inline-Styles beziehungsweise Bootstraps erforderlich; externe Script-, Bild-
und Verbindungsziele sind einzeln auf GA und OSM begrenzt.

**Verifikation:** Der Cloudflare-Produktionspreview lieferte alle Header per HTTP-Headerabruf aus.
Die CSP ließ die getesteten Kernfunktionen in Chromium, Firefox und WebKit zu. Eine erneute Prüfung
an der öffentlichen HTTPS-URL folgt zwingend nach dem Deployment.

### A3 – Horizontaler Überlauf

**Problem und Ursache:** `calc(50% - 50vw)` rechnete mit der Viewportbreite einschließlich
Scrollbar und verbreiterte Vollbreitenbereiche über das Dokument hinaus.

**Lösung:** Der Seitenshell ist ein Inline-Size-Container; Vollbreitenflächen verwenden `cqw` statt
`vw`. Inhalt und Hintergrund bleiben korrekt ausgerichtet. Tabellen behalten ausschließlich in
ihren beschrifteten, fokussierbaren Containern lokales horizontales Scrollen. Es wurde kein globales
`overflow-x: hidden` als Kaschierung ergänzt.

**Verifikation:** Startseite, Kreisreform, Portalsuche und Bildungsfreistellungsgesetz bestehen bei
320×568, 375×667, 390×844, 768×1024, 1024×768, 1366×768, 1440×900 und 1920×1080 jeweils
`scrollWidth <= clientWidth`.

### A4 – Rechtsportal

**Problem und Ursache:** Die kanonischen Metadaten des Bildungsfreistellungsgesetzes führten
`GüABFO`, während sichtbarer Inhalt `OstBFG` verwendete. Die alte Empfehlungslogik gewichtete eine
breite Ressort-/Sachgebietsüberschneidung zu stark.

**Lösung:** Titel, Kurztitel, Abkürzung, Schlagwörter, Metabeschreibung, Suchausgabe und
Normdarstellung verwenden konsistent `OstBFG`. URLs und Fassungsinhalt blieben unverändert. Die neue
Empfehlungslogik priorisiert explizite Vorgänger-/Nachfolger-/Historienbezüge, danach echte
Textverweise, gemeinsame Rechtsgrundlagen und nur hinreichend seltene konkrete Sachgebiete. Eine
bloße Ressortübereinstimmung reicht nicht. Ergebnisse nennen „ändert“, „führt aus“, „verweist auf“,
„gemeinsame Rechtsgrundlage“ oder „gleiches Sachgebiet“ und werden ganz weggelassen, wenn keine
belastbare Beziehung besteht.

**Betroffene Dateien:** Bildungsfreistellungs-`meta.json`, `src/lib/norms/references.ts`,
`src/lib/norms/index.ts`, `NormMetaCard.astro`, aktuelle und historische Normseiten,
`tests/norm-recommendations.test.ts`.

### A5 – Sprach- und Datenfehler

**Problem und Ursache:** Mengenbezeichnungen waren an einigen Stellen fest als Plural ausgegeben;
importierte Metadaten enthielten zusammengezogene Wortgruppen und falsche Flexionen.

**Lösung:** `formatCount` bildet Singular und Plural zentral ab. Offensichtliche Darstellungsfehler
wie „Ausbildungsund“, „Tariftreueund“, „Transparenzund“, „Polizei-Beschwerdeund“,
„des Staatsministerium“ und vergleichbare fehlende Bindestriche wurden an den vorhandenen
Metadaten-/Fassungsquellen korrigiert. Materielle Regelungen und Slugs wurden nicht verändert.

### A6 – Strukturierte Daten und Simulation

**Problem und Ursache:** `GovernmentOrganization` konnte losgelöst vom sichtbaren Hinweis als reale
Behördenbehauptung gelesen werden.

**Lösung:** Die Organisationsdaten verwenden `Organization` ohne fiktive Adresse oder fiktive
Kontaktdaten und mit ausdrücklicher Beschreibung als fiktives Regierungsportal einer
Politiksimulation. `WebSite`, `SearchAction` und `BreadcrumbList` bleiben erhalten. Artikel-,
Datensatz- und Ereignisbeschreibungen übernehmen ebenfalls die Simulationskennzeichnung.

**Verifikation:** Alle JSON-LD-Blöcke des Builds wurden geparst; `GovernmentOrganization` kommt im
Build nicht mehr vor.

## Priorität B

### B7–B10 – Startseite, Karten, Hero und Header

Die Startseite wurde auf Hero/Suche, fünf anliegenorientierte Einstiege, gebündelte aktuelle
Vorhaben, einen kompakten Regierungsstand sowie Presse/Termine/Kontakt konzentriert. Wiederholte
Rechts-, Projekt-, RSS-, Kalender- und Serviceeinstiege wurden zusammengeführt, nicht entfernt.
Anliegenkarten stehen auf breiten Ansichten in drei statt fünf engen Spalten. Der Hero nennt
„Portal durchsuchen“ und führt genau zur allgemeinen Suche. Der Desktop-Header verwendet geringere
vertikale Abstände bei unveränderten Suchfeld- und Touch-Zielgrößen; Hinweisleiste und seriöse
Portalidentität bleiben sichtbar.

**Dateien:** `src/pages/index.astro`, `src/styles/global.css`, `src/layouts/BaseLayout.astro`.

### B11 – Responsive Bilder

`ResponsivePicture.astro` liefert AVIF, WebP und JPEG mit mehreren redaktionell sinnvollen Breiten,
`srcset`, `sizes`, expliziten intrinsischen Maßen und bestehendem Lazy Loading. Regierungsmitglieder,
Ressorts und Stellenangebote verwenden die Komponente. Das Generatorscript erstellt 387 Varianten;
winzige 1×1-Quellbilder werden nicht künstlich als Presse-/Themenbilder oder Social Cards
hochskaliert. Die generierten Dateien belegen insgesamt rund 15 MB und werden statisch gecacht.

**Dateien:** `scripts/generate-responsive-images.mjs`, `ResponsivePicture.astro`, Regierungs-,
Ressort- und Stellenkomponenten/-seiten, `public/images/generated/`, `package.json`.

### B12 – Einheitliches Reformstatusmodell

Die erlaubten Werte sind `geplant`, `entwurf`, `im-gesetzgebungsverfahren`, `beschlossen`,
`in-umsetzung` und `abgeschlossen`. Bestehende Werte wurden konservativ auf diese Skala übertragen.
Vorhandene Daten werden über die Timeline beziehungsweise Projektmetadaten gezeigt; Statusdaten oder
nächste Schritte wurden nicht erfunden.

**Dateien:** Themen-JSONs, `src/lib/portal/schema.ts`, `src/lib/portal/presentation.ts`,
`CONTENT.md`.

### B13 – Portalsuche

Treffer erhalten gewichtete Relevanz, markierte Suchbegriffe, eine optionale Sortierung nach
Aktualität und jeweils zwanzig Ergebnisse pro Nachladeschritt. Suchbegriff, Typfilter und Sortierung
stehen in der URL. Ergebniszahl, Ladezustand und Leermeldung sind Live-Status; Markup wird vor der
Ausgabe maskiert. `/suche/` gibt `noindex, follow` aus und ist aus der Sitemap entfernt, während
interne Links weiterhin verfolgt werden können.

**Dateien:** `src/pages/suche.astro`, `src/scripts/portal-search-page.ts`,
`src/lib/portal/search.ts`, `BaseLayout.astro`, SEO-Testscript.

### B14–B16 – Kontakt, Header-Namen und Barrierefreiheitserklärung

Der Kontaktwegweiser verbindet `label` und `select` explizit, kündigt die Auswahl in einer
Live-Region an, fügt eine Ergebnisüberschrift ein und verschiebt den Fokus nicht automatisch. Der
Markenlink heißt zugänglich „Startseite Freistaat Ostdeutschland“; Suchfeld und Suchbutton haben
getrennte, kurze Beschriftungen. Die Barrierefreiheitserklärung nennt Prüfdatum, Bereiche,
Methoden, einen ehrlichen Status „teilweise vereinbar“, bekannte Einschränkungen, Alternativen,
Feedback-/Reaktionsweg und Simulation. Sie behauptet keine amtliche BITV-Zertifizierung und keine
nicht vorhandenen Gebärdensprachvideos.

### B17 – Semantische Datumswerte

Veröffentlichungs-, Termin-, Bewerbungs-, Kabinetts-, Reform-, Rechtsstands-, Inkrafttretens- und
Historienangaben sind als `<time datetime="…">` ausgezeichnet. Metabeschreibungen und
Breadcrumb-Text bleiben naturgemäß reine Strings.

## Priorität C

### C18 – Social-Media-Vorschau

`public/images/social/portal-preview.png` ist 1200×630 Pixel groß und nennt sichtbar
„Fiktives Regierungsportal · Politiksimulation“. `BaseLayout.astro` gibt absolute `og:image`- und
`twitter:image`-URLs, Abmessungen, PNG-Typ und `summary_large_image` aus. Unbrauchbare
1×1-Inhaltsbilder fallen auf dieses Motiv zurück.

### C19 – Sitemap

Die Sitemap führt 298 indexierbare URLs. Für 198 Einträge werden nur belastbare redaktionelle Daten
aus Presse, Reden, Terminen, Stellen, Normfassungen oder Verkündungen als `lastmod` ausgegeben. Für
Seiten ohne echtes Änderungsdatum wird kein Builddatum vorgetäuscht. Die Suche ist ausgeschlossen.

### C20 – Neue Slugs

Neue Import-/Vorbereitungsslugs transliterieren `ä/ö/ü/ß` zu `ae/oe/ue/ss`, schneiden lange Slugs
an Wortgrenzen und lösen Kollisionen deterministisch numerisch. Zufalls-/Hashsuffixe werden für neue
Inhalte nicht mehr als Standard erzeugt. Bestehende, bereits indexierte Norm- und Kreisreform-URLs
wurden nicht umbenannt; Redirects waren daher nicht erforderlich.

### C21 – Tabellen

Die Kreisreformtabelle besitzt eine Suche nach Kreis/Gemeinde und einen Bezirksfilter, eine
zugängliche Live-Trefferzahl, sticky Überschriften, mobile Zellbeschriftungen und einen sichtbaren
Hinweis auf den lokalen horizontalen Scrollbereich. Das Tabellenmarkup wird nicht für
Screenreader dupliziert.

## Verifikation

| Prüfung | Ergebnis |
| ------- | -------- |
| Installation gemäß Lockfile (`npm ci`) | erfolgreich |
| Abhängigkeitsprüfung | 4 moderate YAML-/Language-Server-Hinweise durch nicht erzwungene transitive Updates behoben; 3 niedrige Astro/esbuild-Hinweise verbleiben, weil der angebotene Fix Astro 7 als Breaking Upgrade erzwingen würde |
| `npm run content:check` | erfolgreich |
| `npm run check` | 155 Astro-Dateien, 0 Fehler, 0 Warnungen, 0 Hinweise |
| `npm run test:unit` | 3/3 Tests der Normempfehlungen bestanden |
| `npm run build` | 322 Seiten erfolgreich gebaut |
| `npm run links:check` | 322 HTML-Dateien, alle internen Links gültig |
| `npm run seo:check` | Titel, Descriptions, Canonicals, genau eine H1, leere Links, JSON-LD, Social Cards, Suche und Sitemap bestanden |
| `npm run test:quality` | 5/5 Qualitätsgruppen bestanden; alle acht geforderten Viewports, Privacy-Gating, Consent, SEO, 200-%-Zoom und reduzierte Bewegung |
| `npm run test:browsers` | 6/6 Kernabläufe in Chromium, Firefox und WebKit bestanden |
| `npm run test:a11y` | 60/60 Axe-Smoke-Tests in fünf Viewports bestanden |
| `npm run test:visual` | 115/115 aktualisierte Screenshot-Baselines bestanden |
| Produktionspreview/Headers | Status 200; HSTS, CSP, `nosniff`, Referrer-, Permissions- und Framing-Schutz vorhanden |
| Visuelle Sichtprüfung | Startseite, Kartenfreigabe, mobile Karten-/Layeransicht und Social Preview geprüft |

Die browsergestützten Tests decken Skip-Link, Kernnavigation, Suchfelder, Kontaktwegweiser,
Haushaltsumschaltung, Kartenfreigabe, Layer, Tabellen, Statusmeldungen, Landmarken, Überschriften,
Alternativtexte, 200-%-Zoom und reduzierte Bewegung ab. Ein formaler manueller Audit mit mehreren
realen Screenreader-/Betriebssystemkombinationen war nicht Bestandteil der automatisierten
Ausführungsumgebung und wird daher nicht als durchgeführt behauptet.

## Verbleibende externe Schritte

1. In Cloudflare für Produktions- und Staging-Domain die automatische Web-Analytics-Einbindung
   deaktivieren: Cloudflare Dashboard → **Analytics & Logs** → **Web Analytics** → betreffende Site
   → **Manage site** beziehungsweise **Settings** → automatische JavaScript-Einbindung
   deaktivieren. Anschließend im ausgelieferten HTML und Netzwerkprotokoll prüfen, dass
   `static.cloudflareinsights.com` nicht erscheint.
2. Den aktuellen Build deployen. Danach `curl -I https://freistaat-ostdeutschland.de/` ausführen und
   die Header aus `public/_headers` an der echten HTTPS-Antwort bestätigen.
3. Nach dem Deployment die beiden Datenschutzbedingungen nochmals an der öffentlichen Domain
   prüfen: keine OSM-Kachel vor „Karte laden“ und kein Google-Request vor Statistikzustimmung.

Diese Schritte benötigen Zugriff auf die externe Cloudflare-Zone beziehungsweise ein Deployment.
Im Repository selbst sind keine weiteren fachlichen oder technischen Punkte aus dem Auftrag offen.
`npm audit` weist noch drei niedrige Hinweise zur lokalen Astro/esbuild-Entwicklungsservernutzung
unter Windows aus. Der einzige automatische Fix würde Astro 7 und den Cloudflare-Adapter als
Breaking Major Upgrade installieren und wurde entsprechend der Vorgabe gegen großflächige,
nicht erforderliche Abhängigkeitsupdates bewusst nicht erzwungen.
