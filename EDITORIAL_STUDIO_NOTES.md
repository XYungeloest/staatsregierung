# Editorial Studio Notes

## Ziel von Phase 1

Das Redaktionsstudio unter `/redaktion/` ist ein interner, bewusst schmaler Arbeitsbereich für die Website der Staatsregierung. Es ersetzt kein externes CMS und baut keine eigene Login- oder Rollenarchitektur. Stattdessen nutzt es:

- Astro + TypeScript
- Cloudflare Workers für gezielte on-demand-Routen
- D1 für Entwürfe, Versionen und Publish-Logs
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
  Bearbeitung, Preview, Versionsverlauf und Publish-/Export-Aktionen
- `/redaktion/medien/`
  Einfacher R2-Upload und Liste referenzierbarer `mediaKey`s
- `/redaktion/entwuerfe/`
  Übersicht aller Draft- und Export-States
- `/redaktion/recht/`
  Bestehendes Rechtswerkzeug für Normdateien

Zusätzlich gibt es interne Endpunkte unter `/redaktion/api/...` für Speichern, Direktpublish, Exportvorbereitung und Medienupload.

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

### Entwurf + Preview + Export

- `service-seite`
  Exportpfad `content/service/seiten/[slug].json`
- `themenseite`
  Exportpfad `content/themen/[slug].json`
- `ressort`
  Exportpfad `content/ressorts/[slug].json`
- `regierungsmitglied`
  Exportpfad `content/regierung/mitglieder/[slug].json`

Diese vier Typen bleiben im öffentlichen Portal vorerst dateibasiert. Das Studio erzeugt dafür exportbereite JSON-Payloads und speichert sie als nachvollziehbare D1-Versionen.

## D1-Struktur

- `editor_entries`
  aktueller Stand eines Redaktionsobjekts mit Status, Slug, Route, Metadata und Content-JSON
- `editor_versions`
  einfache Versionierung mit Änderungsvermerk, Aktion und optional gespeichertem Payload
- `media_assets`
  R2-Referenzen mit Titel, Alt-Text, Credit, MIME-Type und Dateiname
- `publish_log`
  Protokoll für direkte Veröffentlichungen oder vorbereitete Exporte

Die Migration liegt unter `db/migrations/0002_editorial_studio.sql`.

## Publish- und Exportmodell

### Direktpublish

Für Pressemitteilungen, Termine, Stellenangebote und Projektstatus:

1. Formular validieren
2. Payload in das bestehende Zielmodell transformieren
3. in die jeweilige D1-Live-Tabelle schreiben
4. Redaktionsstand in `editor_entries` und `editor_versions` als `published` ablegen
5. Publish-Log schreiben

### Exportmodus

Für Service-Seiten, Themenseiten, Ressorts und Regierungsmitglieder:

1. Formular validieren
2. Payload im bestehenden dateibasierten JSON-Format erzeugen
3. Redaktionsstand als `export_ready` in D1 speichern
4. Exportpfad und Payload im Versionsstand bzw. Publish-Log festhalten
5. JSON über `/redaktion/api/inhalte/[type]/[id]/export.json` herunterladen

Die manuelle Übernahme in `content/` bleibt in Phase 1 bewusst außerhalb des Studios.

## Vorschau

Die Vorschau läuft innerhalb der Bearbeitungsseiten unter `/redaktion/inhalte/[type]/[id]` bzw. `/neu`. Sie zeigt:

- Ziel-URL
- Zielstatus
- strukturierte inhaltliche Vorschau je Typ
- bei Export-Typen zusätzlich den vorgesehenen Content-Pfad

Die Vorschau ist absichtlich sachlich und intern gehalten. Sie ersetzt keine vollständige öffentliche Seitendarstellung, gibt aber eine belastbare inhaltliche Kontrolle vor dem Speichern oder Veröffentlichen.

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

Eine große Medienbibliothek mit Ordnern, Workflows oder Transformationen ist bewusst nicht Teil von Phase 1.

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

## Bewusste Grenzen von Phase 1

- keine Mehrbenutzer-Rollenmatrix
- keine Kommentare oder Echtzeit-Kollaboration
- kein WYSIWYG-HTML-Editor
- keine Veröffentlichung ins Rechtsportal
- keine automatische Rückschreibung exportierter JSON-Dateien in `content/`
- keine vollständige CMS-Architektur
