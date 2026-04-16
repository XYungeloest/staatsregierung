# Editorial Studio Notes

## Ziel von Phase 4

Das Redaktionsstudio unter `/redaktion/` bleibt ein interner, bewusst schmaler Arbeitsbereich für die Website der Staatsregierung. Es ersetzt kein externes CMS und baut keine eigene Login- oder Rollenarchitektur. Stattdessen nutzt es:

- Astro + TypeScript
- Cloudflare Workers für gezielte on-demand-Routen
- D1 für Entwürfe, Versionen, Live-Overrides und Publish-Logs
- R2 für Medienuploads und kleine Medienauswahl im Seiteneditor
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
  Einfache Medienbibliothek mit Upload, Übersicht, Filter und referenzierbaren `mediaKey`s
- `/redaktion/entwuerfe/`
  Übersicht aller Drafts und offenen, noch nicht live übernommenen Änderungen
- `/redaktion/recht/`
  Bestehendes Rechtswerkzeug für Normdateien

Zusätzlich gibt es interne Endpunkte unter `/redaktion/api/...` für Speichern, Direktpublish, Live-Override, Override-Reset, JSON-Export und Medienupload.

Neu in Phase 3 und 4:

- seitennahe Inline-/Block-Bearbeitung direkt aus editierbaren öffentlichen Seiten
- ein Sidepanel-Editor statt ausschließlicher Studio-Formularseiten
- feldgenaue Statusanzeige pro Block

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

### Seitennahe Bearbeitung

Direkt aus der jeweiligen Seite heraus bearbeitbar sind jetzt mindestens:

- `pressemitteilung`
  Kopfbereich, Medienblock, Meldungstext
- `service-seite`
  Seitentitel und Inhaltsblock
- `themenseite`
  Hero, Beschlossen, Umgesetzt, Nächste Schritte, FAQ
- `ressort`
  Ressortkopf, Medienblock, Aufgaben, Kontakt
- `regierungsmitglied`
  Profilkopf, Porträt, Biografie, Kontakt

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

## Feld- und Block-Mapping

Die seitennahen Bearbeitungseinstiege hängen nicht frei an HTML, sondern an einem kleinen Mapping-Layer in `src/lib/editorial/inline.ts`.

Dort ist je unterstütztem Seitentyp festgelegt:

- welche Blöcke editierbar sind
- welche Formularfelder zu diesem Block gehören
- welche Werte aus statischem Fallback, Live-Stand und Entwurf verglichen werden
- ob ein Block Medienauswahl benötigt

Die Templates rendern nur die Einstiegspunkte und das Sidepanel. Die eigentliche Zuordnung zwischen Seitensektion und D1-Feldern liegt bewusst getrennt im Mapping-Layer.

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

Zusätzlich markieren einzelne Inhaltsblöcke kleine `Bearbeiten`-Aktionen direkt an der Seite. Diese öffnen ein Sidepanel, das:

- den aktuellen Entwurfswert lädt
- den statischen oder D1-Ausgangswert sichtbar macht
- Änderungen als Entwurf speichert
- direkt veröffentlicht
- den statischen Fallback in den Entwurf übernehmen kann
- bei Override-Typen einen Reset auf den statischen Stand erlaubt

## R2-Nutzung

Uploads im Studio:

1. Datei unter `/redaktion/medien/` hochladen
2. Upload landet in `MEDIA` mit einem Key unter `editorial/YYYY-MM-DD/...`
3. Metadaten landen in `media_assets`
4. der erzeugte `mediaKey` kann in Formularen eingetragen werden

Neu in Phase 3:

- das Sidepanel zeigt für Medienblöcke eine kleine Bibliothek vorhandener Assets
- Uploads können direkt aus dem Sidepanel erfolgen
- der Upload springt danach zurück auf die gerade bearbeitete Seite
- Medien werden über `mediaKey` in die bestehenden D1- und Override-Modelle eingebunden

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
4. Für seitennahe Bearbeitung auf öffentlichen Seiten zusätzlich sicherstellen, dass auch die editierbaren öffentlichen Routen die Access-Header sehen können.
5. Das übrige öffentliche Portal ohne Redaktionsoberfläche normal ausliefern.

Das Studio erkennt Access-Sitzungen jetzt nicht nur über `cf-access-authenticated-user-email`, sondern auch über weitere typische Access-Header wie `cf-access-authenticated-user-name`, `cf-access-authenticated-user-uuid` und `cf-access-jwt-assertion`. Es baut dennoch keine eigene Benutzerverwaltung auf.

## Remote-Betrieb in Staging und Produktion

- Alle Schreibpfade unter `/redaktion/api/...` laufen on-demand und verlangen remote eine erkannte lokale Sitzung oder Cloudflare Access.
- Die Studio-Seiten zeigen jetzt die erkannte Umgebung (`local`, `staging`, `production`) sowie den Binding-Status für D1 und R2 an.
- Öffentliche Bearbeiten-Einstiege bleiben dezent und erscheinen nur, wenn die jeweilige Seitenanfrage lokal oder mit Access-Headern ankommt.
- Ein erfolgreicher Publish schreibt in die D1- bzw. R2-Ressourcen der aktuell angezeigten Worker-Umgebung.

## Remote-Testablauf

1. Migrationen für die Zielumgebung anwenden.
2. Optional Seed-Daten einspielen.
3. `npm run deploy:staging` oder `npm run deploy` ausführen.
4. Geschützt über Cloudflare Access die Route `/redaktion/` öffnen.
5. Auf der Studio-Startseite prüfen:
   - Umgebung
   - Access-Signal
   - D1-Binding
   - R2-Binding
6. Einen Entwurf speichern, veröffentlichen oder ein Medium hochladen.
7. Die öffentliche Zielseite neu laden und den Hinweis `Live-Override aktiv` bzw. das neue Medium prüfen.

## Override- und Reset-Prüfung

- Ein veröffentlichter Override ist produktiv aktiv, wenn die öffentliche Seite `Live-Override aktiv` meldet und der Studio-Eintrag eine veröffentlichte Version besitzt.
- Ein Reset stellt sofort auf den statischen Repository-Fallback zurück, der D1-Entwurf bleibt jedoch erhalten.
- Für direkte D1-Typen gilt die Veröffentlichung als produktiv, sobald der Eintrag auf der öffentlichen Route aus der Zielumgebung sichtbar ist.

## Bewusste Grenzen dieser Phase

- keine Mehrbenutzer-Rollenmatrix
- keine Kommentare oder Echtzeit-Kollaboration
- kein WYSIWYG-HTML-Editor
- keine Veröffentlichung ins Rechtsportal
- keine vollständige CMS-Architektur
- keine feldgenaue Bearbeitung des Rechtsportals unter `/recht/`
