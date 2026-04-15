# Redaktionshandbuch

Praktische Anleitung zur inhaltlichen Pflege der Website der Staatsregierung des Ostdeutschen Freistaates.

Diese Dokumentation beschreibt den tatsächlichen Stand des Repositories. Sie ist bewusst repo-spezifisch und ergänzt die Master-Spezifikation um die konkrete Frage: Welche Datei muss ich anfassen, wenn ich Inhalt ändern oder neu anlegen will?

## 1. Grundprinzip des Repositories

Das Portal ist vollständig statisch. Laufzeitinhalte kommen derzeit fast vollständig aus JSON-Dateien unter `content/`. Die Website nutzt dafür keine Astro-Content-Collections, sondern eigene Loader und Validatoren in `src/lib/portal/` und `src/lib/norms/`.

Wichtig für die redaktionelle Arbeit:

- `content/` enthält die kanonischen Laufzeitinhalte.
- `public/images/` enthält direkt referenzierte Bilder.
- `Gesetze/` enthält juristische Primärquellen in Markdown, ist aber nicht die direkt gerenderte Website-Struktur.
- `context/` enthält Kontext- und Quellenmaterial für die Redaktion, ist aber kein direkt gerenderter Portalinhalt.
- Viele Übersichts- und Landingpages enthalten zusätzlich fest eingebauten Text direkt in `.astro`-Dateien.

## 2. Tatsächliche Inhaltsstruktur

Stand des Repositories zum Zeitpunkt dieser Anleitung:

| Bereich | Pfad | Format | Aktueller Umfang | Route-Muster | Hinweis |
| --- | --- | --- | --- | --- | --- |
| Themen & Projekte | `content/themen/` | JSON | 11 Dateien | `/themen/[slug]/` | Vollständig datengetrieben |
| Regierungsmitglieder | `content/regierung/mitglieder/` | JSON | 12 Dateien | `/staatsregierung/mitglieder/[slug]/` | Vollständig datengetrieben |
| Ressorts / Ministerien | `content/ressorts/` | JSON | 13 Dateien | `/staatsregierung/kabinett/[ressort]/` | Ist-Pfad heißt `ressorts`, nicht `ministerien` |
| Pressemitteilungen | `content/presse/mitteilungen/` | JSON | 4 Dateien | `/presse/pressemitteilungen/[slug]/` | Unterstützt Themen- und Rechtsbezüge |
| Reden | `content/presse/reden/` | JSON | 3 Dateien | `/presse/reden/[slug]/` | Detailseiten ohne individuelles Bildschema |
| Termine | `content/presse/termine/` | JSON | 4 Dateien | `/presse/termine/[slug]/` | Detailseiten ohne individuelles Bildschema |
| Haushalt | `content/haushalt/` | JSON | 3 Dateien | `/haushalt/[slug]/` | Teilweise kombiniert mit Dashboard-Daten |
| Über den Freistaat | `content/freistaat/` | JSON | 5 Dateien | `/freistaat/[slug]/` | Teilweise mit slug-spezifischen Zusätzen im Template |
| Service-Seiten | `content/service/seiten/` | JSON | 4 Dateien | feste Einzelrouten | Kein generischer Catch-all-Router |
| Stellenangebote | `content/service/stellen/` | JSON | 3 Dateien | `/service/karriere/[slug]/` | Vollständig datengetrieben |
| Normdaten | `content/normen/[slug]/` | JSON | 78 Normordner | `/recht/norm/[slug]/...` | Kanonischer Rechtsbestand |
| Bilder | `public/images/...` | PNG/SVG | mehrere Ordner | direkt per Pfad | Keine Bildpipeline, direkte Auslieferung |
| Primärquellen Recht | `Gesetze/` | Markdown | mehrere Dateien | keine direkte Route | Quellmaterial für Import/Migration |
| Kontextmaterial | `context/` | Markdown, Wiki | mehrere Dateien | keine direkte Route | Redaktions- und Recherchematerial |

## 3. Wo finde ich welche Texte?

### Startseite

- Hauptdatei: `src/pages/index.astro`
- Format: Astro mit festem Seitentext
- Zusätzliche Datenquellen:
  - `content/themen/`
  - `content/presse/mitteilungen/`
  - `content/service/stellen/`
  - `content/normen/`
  - `src/data/dashboard/timeline.ts`
- Wichtig: Wenn du nur die großen Intro- und Abschnittstexte der Startseite ändern willst, ändere `src/pages/index.astro`. Wenn du nur Karteninhalte ändern willst, bearbeite die jeweiligen JSON-Dateien.

### Staatsregierung

- Übersichtsseite: `src/pages/staatsregierung/index.astro`
- Format: Astro mit festem Seitentext
- Eingebundene Daten:
  - `content/regierung/mitglieder/`
  - `content/ressorts/`
  - `content/themen/`
  - `src/config/site.ts` für Regierungsstammdaten

### Ministerpräsident

- Seite: `src/pages/staatsregierung/ministerpraesident/index.astro`
- Format: Astro mit festem Seitentext
- Datenquellen:
  - erstes Regierungsmitglied aus `content/regierung/mitglieder/`
  - `src/config/site.ts` für Kabinettsdaten
- Wichtig: Diese Seite ist nicht rein content-getrieben. Biografischer Fließtext und Rahmentexte liegen im Template.

### Kabinett / Regierungsmitglieder

- Übersichten:
  - `src/pages/staatsregierung/kabinett/index.astro`
  - `src/pages/staatsregierung/mitglieder/index.astro`
- Personendaten:
  - `content/regierung/mitglieder/*.json`
- Detailseiten:
  - `src/pages/staatsregierung/mitglieder/[slug].astro`
- Wichtig: Die Übersichtsseiten enthalten feste Introtexte. Die einzelnen Profile kommen aus JSON.

### Ressorts / Ministerien

- Übersichtslogik:
  - `src/pages/staatsregierung/kabinett/index.astro`
- Ressortdaten:
  - `content/ressorts/*.json`
- Detailseiten:
  - `src/pages/staatsregierung/kabinett/[ressort].astro`
- Wichtig: Das Inhaltsverzeichnis der Spezifikation spricht teils von Ministerien, im Ist-Zustand liegt der Content unter `content/ressorts/`.

### Themen & Projekte

- Übersicht:
  - `src/pages/themen/index.astro`
- Inhalt:
  - `content/themen/*.json`
- Detailseiten:
  - `src/pages/themen/[slug].astro`
- Besonderheit:
  - Rechtsbezüge werden über `rechtsgrundlagen[].normSlug` ins Rechtsportal verlinkt.

### Pressemitteilungen

- Übersichten:
  - `src/pages/presse/index.astro`
  - `src/pages/presse/pressemitteilungen/index.astro`
- Inhalt:
  - `content/presse/mitteilungen/*.json`
- Detailseiten:
  - `src/pages/presse/pressemitteilungen/[slug].astro`
- Besonderheit:
  - Pressemitteilungen können mit Themen, Normen und anderen Meldungen verknüpft werden.

### Reden

- Übersicht:
  - `src/pages/presse/reden/index.astro`
- Inhalt:
  - `content/presse/reden/*.json`
- Detailseiten:
  - `src/pages/presse/reden/[slug].astro`
- Wichtig:
  - Reden haben derzeit kein eigenes Bildfeld im Schema. Die Detailseiten nutzen ein generisches Platzhalterbild.

### Termine

- Übersicht:
  - `src/pages/presse/termine/index.astro`
- Inhalt:
  - `content/presse/termine/*.json`
- Detailseiten:
  - `src/pages/presse/termine/[slug].astro`
- Wichtig:
  - Termine haben derzeit kein eigenes Bildfeld im Schema. Die Detailseiten nutzen ein generisches Platzhalterbild.

### Haushalt

- Übersicht:
  - `src/pages/haushalt/index.astro`
- Inhalt:
  - `content/haushalt/*.json`
- Detailseiten:
  - `src/pages/haushalt/[slug].astro`
- Zusätzliche Datensätze:
  - `src/data/dashboard/budget.ts`
- Wichtig:
  - Die Haushaltsseiten sind JSON-basiert, aber der Budget-Explorer und einzelne Kennzahlen leben zusätzlich in `src/data/dashboard/`.

### Über den Freistaat

- Übersicht:
  - `src/pages/freistaat/index.astro`
- Inhalt:
  - `content/freistaat/*.json`
- Detailseiten:
  - `src/pages/freistaat/[slug].astro`
- Wichtig:
  - Einige Slugs bekommen im Template zusätzliche, speziell gerenderte Blöcke. Nicht jeder sichtbare Abschnitt liegt daher ausschließlich im JSON.

### Service-Seiten

- JSON-Inhalte:
  - `content/service/seiten/kontakt.json`
  - `content/service/seiten/impressum.json`
  - `content/service/seiten/datenschutz.json`
  - `content/service/seiten/barrierefreiheit.json`
- Seiten-Dateien:
  - `src/pages/service/kontakt.astro`
  - `src/pages/service/impressum.astro`
  - `src/pages/service/datenschutz.astro`
  - `src/pages/service/barrierefreiheit.astro`
- Zusätzlich fest gepflegt:
  - `src/pages/service/index.astro`
  - `src/pages/service/uebersicht.astro`
  - `src/pages/service/faq.astro`
- Wichtig:
  - Neue JSON-Dateien unter `content/service/seiten/` erzeugen noch keine neue öffentliche Seite. Dafür braucht es zusätzlich eine passende Astro-Datei unter `src/pages/service/`.

### Karriere / Stellenangebote

- Übersicht:
  - `src/pages/service/karriere/index.astro`
- Inhalte:
  - `content/service/stellen/*.json`
- Detailseiten:
  - `src/pages/service/karriere/[slug].astro`
- Wichtig:
  - Introtexte, Filterhinweise und Seiteneinstiege liegen auf der Übersichtsseite direkt im Template.

### Rechtsportal / Normdaten

- Landingpage:
  - `src/pages/recht/index.astro`
- Suche:
  - `src/pages/recht/suche.astro`
  - `src/pages/recht/search-index.json.ts`
- Archiv und Sachgebiete:
  - `src/pages/recht/archiv/index.astro`
  - `src/pages/recht/sachgebiete/index.astro`
  - `src/pages/recht/sachgebiete/[subject].astro`
- Norminhalte:
  - `content/normen/[slug]/meta.json`
  - `content/normen/[slug]/history.json`
  - `content/normen/[slug]/versions/[versionId].json`
- Primärquelle für neue juristische Inhalte:
  - `Gesetze/*.md`
- Wichtig:
  - Die Website rendert die JSON-Struktur unter `content/normen/`. Markdown in `Gesetze/` ist Quelle, aber nicht die direkt ausgelieferte Struktur.

## 4. Formate und Pflichtfelder

### Allgemeine JSON-Regeln

- JSON muss syntaktisch gültig sein.
- Datumsfelder werden intern als `YYYY-MM-DD` gepflegt.
- Slugs sind technische ASCII-Slugs in Kleinbuchstaben mit Bindestrichen.
- Bei Portal-JSON außerhalb des Rechtsbereichs sollte der Dateiname nach Möglichkeit dem `slug` entsprechen.
- Sichtbare Titel und Texte sollen echte Umlaute und korrekte Großschreibung verwenden.
- Bei fast allen Portaltypen ist `body` ein Array von Absätzen als Strings, nicht Markdown.

### Regierungsmitglied

- Pfad: `content/regierung/mitglieder/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `name`
  - `amt`
  - `ressort`
  - `reihenfolge`
  - `kurzbiografie`
  - `langbiografie`
  - `bild`
  - `bildnachweis`
- Optionale Felder:
  - `bildAlt`
  - `kontakt`
  - `zitat`

### Ressort

- Pfad: `content/ressorts/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `name`
  - `kurzname`
  - `leitung`
  - `teaser`
  - `aufgaben`
  - `kontakt`
  - `bild`
  - `bildnachweis`
  - `themen`
  - `verknuepfteLinks`
- Optional:
  - `bildAlt`

### Themenseite

- Pfad: `content/themen/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `title`
  - `teaser`
  - `status`
  - `beschlossen`
  - `umgesetzt`
  - `naechsteSchritte`
  - `rechtsgrundlagen`
  - `faq`
  - `federfuehrendesRessort`
- Optional:
  - `hero`
  - `mitzeichnungsressorts`
- Erlaubte Werte für `status`:
  - `umgesetzt`
  - `kernprojekt`
  - `teilweise-umgesetzt`
  - `sehr-weit-umgesetzt`
  - `deutlich-umgesetzt`
  - `ausbauphase`
  - `laufend`

### Pressemitteilung

- Pfad: `content/presse/mitteilungen/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `title`
  - `date`
  - `ressort`
  - `teaser`
  - `image`
  - `imageAlt`
  - `imageCredit`
  - `tags`
  - `body`
  - `isFeatured`
- Optionale Relationen:
  - `relatedTopicSlugs`
  - `relatedNormSlugs`
  - `relatedPressSlugs`

### Rede

- Pfad: `content/presse/reden/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `title`
  - `date`
  - `sprecher`
  - `teaser`
  - `body`

### Termin

- Pfad: `content/presse/termine/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `title`
  - `date`
  - `location`
  - `teaser`
  - `body`

### Haushaltsseite

- Pfad: `content/haushalt/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `title`
  - `teaser`
  - `body`
- Optional:
  - `dataset`

### Freistaat-Seite und Service-Seite

- Pfade:
  - `content/freistaat/<slug>.json`
  - `content/service/seiten/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `title`
  - `body`

### Stellenangebot

- Pfad: `content/service/stellen/<slug>.json`
- Pflichtfelder:
  - `slug`
  - `title`
  - `ressort`
  - `standort`
  - `arbeitsbereich`
  - `datePosted`
  - `applicationDeadline`
  - `employmentType`
  - `teaser`
  - `body`
- Optional:
  - `payGrade`
  - `contact`
  - `image`
  - `imageAlt`
  - `imageCredit`

### Normdaten

- Pfad:
  - `content/normen/<slug>/meta.json`
  - `content/normen/<slug>/history.json`
  - `content/normen/<slug>/versions/<versionId>.json`
- `meta.json` Pflichtfelder:
  - `id`
  - `slug`
  - `title`
  - `shortTitle`
  - `abbr`
  - `type`
  - `ministry`
  - `subjects`
  - `keywords`
  - `initialCitation`
  - `predecessor`
  - `successor`
  - `summary`
  - `status`
- `history.json` Pflichtstruktur:
  - `initialVersionId`
  - `entries[]` mit mindestens `date`, `type`, `title`, `citation`
- `versions/<versionId>.json` Pflichtfelder:
  - `versionId`
  - `validFrom`
  - `validTo`
  - `isCurrent`
  - `citation`
  - `changeNote`
  - `body`
- Wichtig:
  - `meta.slug` muss dem Ordnernamen entsprechen.
  - `versionId` muss dem Dateinamen der Versionsdatei entsprechen.
  - Norm-`body` ist kein Textarray, sondern eine strukturierte Blockhierarchie.

## 5. Wie füge ich neue Inhalte hinzu?

### Neue Themenseite

1. Eine bestehende Datei aus `content/themen/` als Vorlage kopieren.
2. Dateiname und `slug` gleichziehen, zum Beispiel `content/themen/digitales-rathaus.json` und `slug: "digitales-rathaus"`.
3. `title`, `teaser`, `status`, Listenfelder und `faq` füllen.
4. Bei Rechtsbezügen nach Möglichkeit `normSlug` setzen, damit die Seite automatisch ins Rechtsportal verlinkt.
5. Falls ein Hero-Bild genutzt werden soll, Bild unter `public/images/...` anlegen und den Pfad in `hero` eintragen.
6. Build prüfen.

### Neue Pressemitteilung

1. Eine bestehende Datei aus `content/presse/mitteilungen/` kopieren.
2. `slug`, `title`, `date`, `ressort`, `teaser`, `tags` und `body` anpassen.
3. Passendes Bild in `public/images/presse/` ablegen.
4. Im JSON `image`, `imageAlt` und `imageCredit` setzen.
5. Optional thematische Relationen ergänzen:
   - `relatedTopicSlugs`
   - `relatedNormSlugs`
   - `relatedPressSlugs`
6. `isFeatured` auf `true` setzen, wenn die Meldung auch auf Übersichtsseiten hervorgehoben erscheinen soll.

### Neues Regierungsmitglied

1. Eine bestehende Datei aus `content/regierung/mitglieder/` kopieren.
2. `slug`, `name`, `amt`, `ressort` und `reihenfolge` pflegen.
3. `kurzbiografie` kurz halten, `langbiografie` als Absatzliste pflegen.
4. Bild unter `public/images/regierung/` anlegen und in `bild` referenzieren.
5. `bildAlt` und `bildnachweis` immer sinnvoll setzen.
6. Optional `kontakt` und `zitat` ergänzen.

### Neues Ressort

1. Eine bestehende Datei aus `content/ressorts/` kopieren.
2. `slug` festlegen. Dieser Slug wird direkt als URL-Teil unter `/staatsregierung/kabinett/<slug>/` verwendet.
3. `name`, `kurzname`, `leitung`, `teaser`, `aufgaben` und `themen` pflegen.
4. Kontaktobjekt füllen.
5. Bild unter `public/images/ministerien/` ablegen und per `bild` referenzieren.
6. `verknuepfteLinks` nur mit stabilen internen oder bewusst externen Links pflegen.

### Neues Stellenangebot

1. Eine bestehende Datei aus `content/service/stellen/` kopieren.
2. `slug`, `title`, `ressort`, `standort`, `arbeitsbereich`, `employmentType`, `datePosted` und `applicationDeadline` setzen.
3. `teaser` kurz halten, `body` als Absatzliste ausformulieren.
4. Optional `payGrade`, `contact`, `image`, `imageAlt` und `imageCredit` ergänzen.
5. Optionales Bild unter `public/images/jobs/` ablegen.

### Neue Service-Seite

Es gibt zwei Fälle.

Fall 1: Eine bestehende Service-Seite inhaltlich ändern.

1. Für Kontakt, Impressum, Datenschutz oder Barrierefreiheit die passende Datei unter `content/service/seiten/` ändern.
2. Prüfen, ob zusätzlich fester Seitentext in der zugehörigen `.astro`-Datei angepasst werden muss.

Fall 2: Eine ganz neue öffentliche Service-Seite anlegen.

1. Neue JSON-Datei unter `content/service/seiten/` anlegen.
2. Zusätzliche Routendatei unter `src/pages/service/` anlegen, weil es derzeit keinen generischen Service-Router für beliebige Slugs gibt.
3. Navigation oder Verlinkung an passender Stelle ergänzen, falls die Seite öffentlich erreichbar sein soll.

### Neue oder geänderte Rechtsportal-Inhalte

Bei Normen ist das JSON unter `content/normen/` maßgeblich.

Für eine bestehende Norm:

1. `meta.json` ändern, wenn sich Stammdaten ändern.
2. `history.json` ändern, wenn ein neuer Historieneintrag hinzukommt.
3. `versions/<versionId>.json` anlegen oder anpassen, wenn eine neue Fassung veröffentlicht wird.
4. Wenn eine neue Fassung aktuell sein soll, `isCurrent` sauber setzen und frühere Fassungen entsprechend beenden.

Für eine neue Norm:

1. Neuen Ordner `content/normen/<slug>/` anlegen.
2. `meta.json`, `history.json` und mindestens eine Datei in `versions/` anlegen.
3. Darauf achten:
   - Ordnername = `meta.slug`
   - Versionsdatei = `versionId`
4. Build prüfen.

Für neue juristische Inhalte aus Primärquellen:

1. Ausgangspunkt sind die Markdown-Dateien in `Gesetze/`.
2. Diese Dateien werden nicht direkt gerendert.
3. Der Inhalt muss in die kanonische JSON-Struktur unter `content/normen/` überführt werden.
4. Hilfreich ist das Importskript `scripts/import-normen.mjs`.
5. Optional kann die Eingabemaske unter `/redaktion/` genutzt werden, wenn `enableEditorialTools` in `src/config/features.ts` aktiviert ist.

## 6. Wie werden Bilder eingebunden?

Aktuelle Bildordner:

- `public/images/regierung/`
- `public/images/ministerien/`
- `public/images/presse/`
- `public/images/jobs/`
- `public/images/ui/`

Einbindung:

- In JSON-Dateien werden Bilder als Root-Pfade referenziert, zum Beispiel `/images/presse/freistaat-stiftet-neue-staatliche-auszeichnungen.png`.
- Die Dateien liegen direkt unter `public/` und werden ohne zusätzliche Verarbeitung ausgeliefert.

Empfohlene Praxis:

- Dateiname möglichst gleich dem Content-Slug.
- Für Regierungsmitglieder eher Porträtformat verwenden.
- Für Presse, Jobs und Ressorts eher ruhige Querformate verwenden.
- `bildAlt` oder `imageAlt` nicht leer lassen, wenn das Schema ein Alt-Feld vorsieht.
- `bildnachweis` oder `imageCredit` immer pflegen, weil diese Angaben im UI sichtbar sind.

Wichtig:

- Bilder werden nicht automatisch optimiert oder zugeschnitten.
- Wenn du ein bestehendes Platzhalterbild ersetzen willst, kannst du die Datei unter demselben Pfad austauschen.

## 7. Wie funktionieren Verlinkungen ins Rechtsportal?

### Von Themenseiten aus

- Rechtsbezüge stehen in `content/themen/<slug>.json` unter `rechtsgrundlagen`.
- Für stabile Links ins Rechtsportal sollte `normSlug` gesetzt werden.
- Beispiel:

```json
{
  "label": "Ostdeutsches Kulturpassgesetz",
  "normSlug": "ostdeutsches-kulturpassgesetz",
  "note": "aktuelle Fassung"
}
```

### Von Pressemitteilungen aus

- Normbezüge werden über `relatedNormSlugs` gepflegt.
- Themenbezüge über `relatedTopicSlugs`.
- Weitere Meldungen über `relatedPressSlugs`.

### Direkte stabile Rechts-URLs

- Aktuelle Fassung:
  - `/recht/norm/<slug>/`
- Historie:
  - `/recht/norm/<slug>/history/`
- Gespeicherte historische Fassung:
  - `/recht/norm/<slug>/version/<versionId>/`

Worauf du achten solltest:

- Slugs nach Veröffentlichung möglichst nicht mehr ändern.
- Titel können angepasst werden, der technische `slug` sollte für stabile Links gleich bleiben.
- Bei Querverlinkungen im Content immer den Norm-Slug verwenden, nicht den sichtbaren Titel.

## 8. Formatierungs- und Redaktionsregeln

- Sichtbare deutsche Texte mit echten Umlauten und Sonderzeichen schreiben.
- Deutsche Nomen sichtbar korrekt großschreiben.
- Datumswerte in JSON immer als `YYYY-MM-DD` speichern.
- Die Anzeige als `TT. Monat JJJJ` übernimmt das Portal selbst.
- `teaser` möglichst knapp halten, in der Regel ein bis zwei Sätze.
- `body`-Felder als Absatzlisten schreiben. Ein Eintrag im Array entspricht im Regelfall einem Absatz.
- Keine slug-artigen oder technisch klingenden Labels in sichtbaren Texten verwenden.
- Ressortnamen konsistent halten. Für Querverbindungen in Themen oder Presse möglichst dieselben Benennungen verwenden wie in den Ressortdaten.
- Behördlich-sachlichen Ton verwenden. Das Portal ist fiktiv, soll aber wie eine Regierungswebsite wirken.

Wichtig für JSON-`body`:

- Das Portal rendert dort normalen Fließtext.
- Markdown-Überschriften, Listen oder HTML werden nicht systematisch als rich text interpretiert.
- Wenn eine Seite komplexere Strukturen braucht, ist meist zusätzlich eine Template-Anpassung nötig.

## 9. Praktische Bearbeitungshinweise

Dateien, die du bevorzugt direkt ändern solltest:

- Inhalte unter `content/`
- Bilder unter `public/images/`
- Portalweite Kontakt-, Navigations- und Kennzeichnungstexte unter `src/config/site.ts`

Dateien, bei denen Vorsicht sinnvoll ist:

- `src/pages/*.astro`
  - hier liegen oft sichtbare Landingpage-Texte, aber auch Struktur und Logik
- `src/data/dashboard/*.ts`
  - das sind kuratierte Sekundärdaten für Module, nicht die primäre Content-Wahrheit
- `src/lib/portal/schema.ts`
  - Content-Schema und Validierung
- `src/lib/norms/schema.ts`
  - Normschema und strenge Validierung
- `src/lib/portal/loader.ts` und `src/lib/norms/loader.ts`
  - Lade- und Sortierlogik
- `src/config/features.ts`
  - Feature-Flags, keine normalen Inhaltsdateien

Faustregel:

- Wenn du nur Texte, Daten, Bilder oder Relationen ändern willst, beginne in `content/`.
- Wenn sich eine Seite trotz JSON-Änderung nicht wie gewünscht verändert, liegt ein Teil des sichtbaren Inhalts wahrscheinlich im zugehörigen `.astro`-Template.

## 10. Abweichungen zwischen Spezifikation und Ist-Zustand

Diese Unterschiede sind für die redaktionelle Arbeit wichtig:

1. Das Portal nutzt aktuell keine Astro-Content-Collections, sondern eigene JSON-Loader.
2. Ministerien liegen im Ist-Zustand unter `content/ressorts/`, nicht unter `content/ministerien/`.
3. Die Ministeriumsseiten hängen derzeit unter `/staatsregierung/kabinett/` und nicht unter einer eigenen öffentlichen Route `/ministerien/`.
4. Startseite, Staatsregierung, Ministerpräsident, Service-Übersichten, FAQ und mehrere Landingpages sind nur teilweise content-getrieben. Ein Teil des sichtbaren Textes liegt direkt in Astro-Dateien.
5. Neue Service-Seiten entstehen nicht allein durch eine JSON-Datei. Für neue öffentliche Seiten ist zusätzlich eine eigene Route nötig.
6. Haushaltsdaten und einzelne Dashboard-Module leben zusätzlich in `src/data/dashboard/`.
7. `Gesetze/` und `context/` sind wichtige Redaktions- und Quellordner, aber keine direkt gerenderten Website-Collections.
8. Das Rechtsportal rendert ausschließlich die strukturierte JSON-Fassung unter `content/normen/`.

## 11. Schnellstart

Wenn du nur eine neue Themenseite hinzufügen willst:

- neue JSON-Datei unter `content/themen/` anlegen
- `slug`, `title`, `status`, Listen und `rechtsgrundlagen` pflegen
- bei Rechtsbezügen `normSlug` setzen

Wenn du nur eine Pressemitteilung ergänzen willst:

- neue JSON-Datei unter `content/presse/mitteilungen/` anlegen
- Bild unter `public/images/presse/` ablegen
- `imageAlt`, `imageCredit` und optional Relationen pflegen

Wenn du nur ein neues Regierungsmitglied ergänzen willst:

- neue JSON-Datei unter `content/regierung/mitglieder/` anlegen
- Bild unter `public/images/regierung/` ablegen
- `reihenfolge`, `kurzbiografie`, `langbiografie`, `bildnachweis` pflegen

Wenn du nur ein neues Ressort ergänzen willst:

- neue JSON-Datei unter `content/ressorts/` anlegen
- Bild unter `public/images/ministerien/` ablegen
- `aufgaben`, `themen`, `kontakt` und `verknuepfteLinks` pflegen

Wenn du nur ein neues Stellenangebot ergänzen willst:

- neue JSON-Datei unter `content/service/stellen/` anlegen
- optional Bild unter `public/images/jobs/` ablegen
- Datumsfelder im ISO-Format pflegen

Wenn du nur Texte auf der Startseite austauschen willst:

- `src/pages/index.astro` ändern
- zusätzlich prüfen, ob Karteninhalte aus `content/` oder `src/data/dashboard/` kommen

Wenn du nur Rechtsportal-Inhalte ändern willst:

- nur unter `content/normen/<slug>/` arbeiten
- bei neuen Fassungen `history.json` und `versions/<versionId>.json` gemeinsam pflegen
- Slugs und Versionsdateinamen stabil halten

## 12. Empfohlener Abschluss nach redaktionellen Änderungen

Nach größeren Änderungen ist sinnvoll:

```sh
npx astro check
npm run build
```

Wenn nur Text oder Bilder ausgetauscht wurden, reicht meist zunächst ein lokaler Blick im Dev-Server. Bei neuen Seiten, Slugs oder Normfassungen sollte der Build immer mitgeprüft werden.
