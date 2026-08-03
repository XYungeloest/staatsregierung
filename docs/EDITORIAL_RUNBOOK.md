# Redaktionsrunbook

Das Studio liegt nach betrieblicher Einrichtung unter `/redaktion/`. Jede Einreichung erzeugt oder aktualisiert einen Draft Pull Request; sie veröffentlicht nie direkt nach `main`.

## Zusammensetzung des Staatsrats ändern

1. „Kabinettsumbildung“ öffnen.
2. Wirksamkeitsdatum und Regierung wählen und den Vorgang kurz zusammenfassen.
3. Für jedes betroffene Ressort neue Person, zulässiges Amt, öffentliche Amtsbezeichnung und Reihenfolge wählen.
4. „Änderung prüfen“ wählen. Das Studio beendet die bisherige Leitung am Vortag, legt die neue Zuordnung an und prüft Referenzen, Gültigkeitsintervalle, exklusive Ämter, Regierungsleitung und alle Ressortleitungen.
5. Die Gegenüberstellung „Bisher/Neu“, betroffene Seiten und den Diff prüfen.
6. Als Entwurf einreichen. Alle Zuordnungen des Vorgangs landen in derselben `content/organisation/assignments.json` und in einem einzigen Commit.

Ändert sich nur eine Ressortleitung, wird derselbe Vorgang mit genau diesem Ressort verwendet. Eine Person kann mehrere gleichzeitige Zuordnungen erhalten. Die Staatskanzleileitung kann aktiv sein, ohne Mitglied des Staatsrats zu werden.

## Regierungsmitglied oder Ressort bearbeiten

Unter „Regierungsmitglied“ werden Biografie, Kontakt, Zitat und Bild gepflegt. Amt, aktueller Status und Ressort gehören nicht in die Personendatei. Unter „Ressort oder Staatssekretariat“ werden Beschreibung, Aufgaben, Kontakt, Themen und Links gepflegt; die Leitung wird ausschließlich über „Kabinettsumbildung“ geändert.

Neue Person oder neues Ressort über „Neuen Inhalt anlegen“ beginnen, technischen Slug vergeben, Pflichtfelder ausfüllen, Diff prüfen und als Draft einreichen. Eine neue aktive Ressortzuweisung muss im selben redaktionellen Vorgang fachlich vollständig sein; andernfalls lehnt die Organisationsprüfung sie ab.

## Presse, Rede, Termin oder Stellenangebot anlegen

Den passenden Inhaltstyp wählen, „Neuen Inhalt anlegen“ verwenden und einen eindeutigen Slug vergeben. Datumswerte und Pflichtfelder werden serverseitig mit denselben Parsern wie beim öffentlichen Build geprüft. Textabschnitte werden als sortierbare String-Liste gepflegt; beliebiges HTML wird nicht akzeptiert. Termine können zusätzlich ISO-Beginn und -Ende mit Uhrzeit erhalten. Abgelaufene Stellen werden am redaktionellen Stichtag automatisch nicht als aktuell hervorgehoben.

## Startseite und Themenseiten bearbeiten

„Startseite“ enthält Hero, Direkteinstiege, wichtige Hinweise und die referenzierten hervorgehobenen Themen. Regierungsinformationen in einem wichtigen Hinweis werden über `governmentSlug` abgeleitet und nicht als Name wiederholt. Themen- und Ressortreferenzen werden über Auswahlfelder gesetzt und auf vorhandene Slugs geprüft.

Auf Themenseiten werden Status, federführendes Ressort, mitzeichnende Ressorts, beschlossene und umgesetzte Punkte, nächste Schritte, Rechtsgrundlagen und FAQ strukturiert gepflegt.

## Dashboard bearbeiten

„Dashboard-Aktionsplan“ und „Dashboard-Timeline“ bearbeiten die JSON-Dateien unter `content/dashboard/`. Mit der Positionsangabe und den Pfeiltasten im Listeneditor lassen sich Einträge umsortieren. Die TypeScript-Dateien unter `src/data/dashboard/` sind keine redaktionellen Quellen.

## Bild wählen oder ergänzen

Vorhandene Bilder aus `public/images/` im Bildfeld auswählen. Für ein neues Bild die Datei direkt am Bildfeld wählen und einen sachlichen Alternativtext eintragen; Bildnachweis oder Quelle ergänzen, soweit vorhanden. Zulässig sind JPEG, PNG, WebP und AVIF bis 5 MB. Das Studio prüft MIME-Typ und Dateisignatur, erzeugt einen sicheren Namen unter `public/images/editorial/` und nimmt das Bild in denselben PR-Commit auf. Es gibt keine zweite Medienquelle in R2.

## Diff und Vorschau prüfen

Vor der Einreichung zeigt das Studio alle betroffenen Dateien und öffentlichen Routen. Den Diff auf unbeabsichtigte Löschungen und insbesondere Referenzen, Datumswerte, Alternativtexte und Reihenfolge prüfen. Reine Content-, Knowledge- und Bildänderungen erhalten Content-, Knowledge-, Typ-, Unit-, Build-, Link- und SEO-Prüfungen. Bei Änderungen an Code, Layout, Styles, Tests oder Infrastruktur kommen Studio-, Accessibility-, Browser- und Visual-Prüfungen hinzu. Ist Cloudflare Preview eingerichtet, erscheint die geschützte URL nach den jeweils erforderlichen erfolgreichen Prüfungen als PR-Kommentar.

## Git-Konflikt behandeln

Meldet das Studio eine veraltete Basis-SHA, wurde `main` seit dem Laden geändert. Nicht blind erneut senden. Inhalt neu laden, gewünschte Änderung erneut anwenden, neuen Diff prüfen und wieder einreichen. Ein vorhandener Redaktionsbranch kann weitergeführt werden; der Adapter schreibt nie mit `force` und erzeugt bei einem Basiswechsel keinen Teil-Commit.

## Freigabe und Veröffentlichung

Draft-Status erst nach fachlicher Prüfung, erfolgreicher CI und Sichtprüfung der Vorschau aufheben. Review einholen und den PR nach den üblichen Repositoryregeln nach `main` mergen. Der bestehende Main-Workflow baut und veröffentlicht anschließend die statische Website. Das Studio selbst umgeht weder Review noch Produktionspipeline.

## Änderung zurücknehmen

Vor Merge kann der Draft PR geschlossen oder durch einen korrigierenden Studio-Commit aktualisiert werden. Nach Merge wird über Git ein eigener Revert- oder Korrektur-PR erstellt; keine Datei direkt in Cloudflare, D1 oder R2 ändern. Bei einer zeitlich bereits wirksamen Organisationsänderung ist fachlich meist eine neue Zuordnung mit neuem Wirksamkeitsdatum richtiger als das Umschreiben historischer Daten.

## Direkte Pflege ohne Studio

Bei einem Studioausfall können berechtigte Entwickler:innen dieselben JSON-Dateien in einem normalen Branch bearbeiten. Für eine Kabinettsänderung `applyCabinetReshuffle` beziehungsweise einen darauf aufbauenden lokalen Vorgang verwenden und keine abgeleiteten Person- oder Ressortfelder manuell ergänzen. Vor PR mindestens ausführen:

```sh
npm run content:check
npm run knowledge:check
npm run check
npm run editorial:check
npm run test:unit
npm run build
```
