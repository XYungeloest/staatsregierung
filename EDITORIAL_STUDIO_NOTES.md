# Editorial Studio Notes

## Ziel von Phase 2

Das Redaktionsstudio unter `/redaktion/` bleibt ein interner, bewusst schmaler Arbeitsbereich für die Website der Staatsregierung. Es ersetzt kein externes CMS und baut keine eigene Login- oder Rollenarchitektur. Stattdessen nutzt es:

- Astro + TypeScript
- Cloudflare Workers für gezielte on-demand-Routen
- D1 für Entwürfe, Versionen, Live-Overrides und Publish-Logs
- R2 für Medienuploads
- Cloudflare Access als vorgesehenen Schutz vor öffentlichem Zugriff

Das Rechtsportal unter `/recht/` bleibt funktional unangetastet. Das bisherige Normdatei-Werkzeug bleibt separat unter `/redaktion/recht/` erhalten.

## Routen

- `/redaktion/`
  Studio-Übersicht mit Inhaltstypen, Schnellzugriff und letzten Redaktionsständen
- `/redaktion/inhalte/`
  Übersicht aller bearbeitbaren Typen
- `/redaktion/inhalte/[type]/`
  Typbezogene Übersicht mit bestehenden Quellen und vorhandenen Entwürfen
- `/redaktion/inhalte/[type]/neu`
  Neuer Entwurf, optional aus D1- oder Datei-Vorlage
- `/redaktion/inhalte/[type]/[id]`
  Bearbeitung, Preview, Versionsverlauf, Publish-/Override-Aktionen und Reset auf statischen Fallback
- `/redaktion/medien/`
  Einfacher R2-Upload und Liste referenzierbarer `mediaKey`s
- `/redaktion/entwuerfe/`
  Übersicht aller Drafts und offenen, noch nicht live übernommenen Änderungen
- `/redaktion/recht/`
  Bestehendes Rechtswerkzeug für Normdateien

Zusätzlich gibt es interne Endpunkte unter `/redaktion/api/...` für Speichern, Direktpublish, Live-Override, Override-Reset, JSON-Export und Medienupload.

## Unterstützte Inhaltstypen

### Direkt live schaltbar

- `pressemitteilung`
  schreibt nach `press_releases`
- `termin`
  schreibt nach `events`
- `stellenangebot`
  schreibt nach `jobs`
- `projektstatus`
  schreibt nach `project_status`

### Live-Override mit dateibasiertem Fallback

- `service-seite`
  Fallback-Datei `content/service/seiten/[slug].json`
- `themenseite`
  Fallback-Datei `content/themen/[slug].json`
- `ressort`
  Fallback-Datei `content/ressorts/[slug].json`
- `regierungsmitglied`
  Fallback-Datei `content/regierung/mitglieder/[slug].json`

Diese vier Typen bleiben im Portal strukturell dateibasiert. Öffentlich wird aber zuerst geprüft, ob ein veröffentlichter D1-Override existiert. Nur wenn kein Override aktiv ist, wird die bisherige Datei aus `content/` gerendert.

## D1-Struktur

- `editor_entries`
  aktueller Stand eines Redaktionsobjekts mit Status, Slug, Route, Metadata, Content-JSON und optionalem `published_version_id`
- `editor_versions`
  einfache Versionierung mit Änderungsvermerk, Aktion und optional gespeichertem Payload
- `media_assets`
  R2-Referenzen mit Titel, Alt-Text, Credit, MIME-Type und Dateiname
- `publish_log`
  Protokoll für direkte Veröffentlichungen, Live-Overrides, Reset-Vorgänge und optionale JSON-Exporte

Die Migrationen liegen unter `db/migrations/0002_editorial_studio.sql` und `db/migrations/0003_editorial_live_overrides.sql`.

## Publish-, Override- und Fallbackmodell

### Direktpublish

Für Pressemitteilungen, Termine, Stellenangebote und Projektstatus:

1. Formular validieren
2. Payload in das bestehende Zielmodell transformieren
3. in die jeweilige D1-Live-Tabelle schreiben
4. Redaktionsstand in `editor_entries` und `editor_versions` als `published` ablegen
5. Publish-Log schreiben

### Live-Override

Für Service-Seiten, Themenseiten, Ressorts und Regierungsmitglieder:

1. Optional bestehenden statischen Inhalt als Vorlage übernehmen
2. Formular validieren
3. Payload im bisherigen JSON-Schema erzeugen
4. veröffentlichte Version als `published_version_id` markieren
5. öffentliche Seite rendert den Override aus D1
6. der statische Inhalt in `content/` bleibt als Fallback erhalten

### Reset auf statischen Stand

Für Override-Typen:

1. im Studio den Eintrag öffnen
2. Aktion `Override deaktivieren` ausführen
3. `published_version_id` wird geleert
4. öffentliche Seite fällt sofort auf den dateibasierten Inhalt zurück
5. der Entwurf bleibt in D1 erhalten und kann später erneut veröffentlicht werden

### JSON-Export

Für Override-Typen steht optional weiter ein strukturierter JSON-Download bereit. Das ist hilfreich, wenn ein veröffentlichter D1-Stand später bewusst ins Repository übernommen werden soll.

## Vorschau

Die Vorschau läuft innerhalb der Bearbeitungsseiten unter `/redaktion/inhalte/[type]/[id]` bzw. `/neu`. Sie zeigt:

- Ziel-URL
- Zielstatus
- strukturierte inhaltliche Vorschau je Typ
- bei Override-Typen zusätzlich den statischen Fallback-Pfad

Die Vorschau ist absichtlich sachlich und intern gehalten. Sie ersetzt keine vollständige öffentliche Seitendarstellung, gibt aber eine belastbare inhaltliche Kontrolle vor dem Speichern oder Veröffentlichen.

## Seitennahe Bearbeitungseinstiege

Editierbare öffentliche Seiten zeigen eine dezente interne Box mit:

- Quelle der aktuellen Auslieferung (`Statischer Fallback` oder `Live-Override aktiv`)
- Hinweis auf unveröffentlichte Änderungen
- Link `Seite im Redaktionsstudio öffnen`

Die Box wird nur angezeigt, wenn Redaktionsfunktionen aktiviert sind und lokal oder mit Cloudflare-Access-Headern gearbeitet wird.

## R2-Nutzung

Uploads im Studio:

1. Datei unter `/redaktion/medien/` hochladen
2. Upload landet in `MEDIA` mit einem Key unter `editorial/YYYY-MM-DD/...`
3. Metadaten landen in `media_assets`
4. der erzeugte `mediaKey` kann in Formularen eingetragen werden

Gespeichert werden:

- `key`
- `title`
- `alt_text`
- `credit`
- `mime_type`
- `byte_size`
- `filename`

Eine große Medienbibliothek mit Ordnern, Workflows oder Transformationen ist bewusst nicht Teil dieser Phase.

## Lokale Entwicklung und Tests

1. Migrationen lokal anwenden:

```sh
npm run db:migrate:local
```

2. Optional Seed-Daten für die bestehenden dynamischen Bereiche einspielen:

```sh
npm run db:seed:local
```

3. Entwicklungsserver starten:

```sh
npm run dev
```

4. Build und Typprüfung:

```sh
npm run check
npm run build
```

## Cloudflare Access

Für Staging und Produktion sollte `/redaktion/*` nicht öffentlich erreichbar sein. Empfohlene Einrichtung:

1. In Cloudflare Zero Trust eine Access Application für die Pfade `/redaktion/*` anlegen.
2. Zulässige Identitäten oder Gruppen definieren.
3. Optional nur bestimmte E-Mail-Domänen oder konkrete Nutzer zulassen.
4. Das öffentliche Portal außerhalb von `/redaktion/*` ungeschützt lassen.

Das Studio liest vorhandene Access-Header (`cf-access-authenticated-user-email`, `cf-access-authenticated-user-name`) nur für Anzeige- und Autorenfelder aus. Es baut keine eigene Benutzerverwaltung auf.

## Bewusste Grenzen dieser Phase

- keine Mehrbenutzer-Rollenmatrix
- keine Kommentare oder Echtzeit-Kollaboration
- kein WYSIWYG-HTML-Editor
- keine Veröffentlichung ins Rechtsportal
- keine vollständige CMS-Architektur
