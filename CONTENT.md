# Content-Pflege

Diese Datei beschreibt den aktuellen kanonischen Weg, Inhalte der Website einzupflegen. Maßgeblich sind der tatsächliche Code- und Content-Stand, `README.md`, `AGENTS.md` und diese Datei. Technische Details werden in den Parsern in `src/lib/portal/schema.ts` und `src/lib/norms/schema.ts` validiert.

## Grundsatz

Öffentliche Website-Inhalte werden in der Regel dateibasiert als JSON unter `content/` gepflegt. Eine Inhaltsdatei ist immer ein JSON-Objekt, kein Markdown-Dokument und keine Liste als Wurzelwert. Textabsätze werden meist als String-Arrays gepflegt.

Das Portal wird derzeit dateibasiert gepflegt. Cloudflare D1/R2 sind im aktuellen Stand nicht an die Website angebunden; Inhalte werden über JSON-Dateien, TypeScript-Dashboarddaten und Bilddateien unter `public/images/` bereitgestellt.

## Allgemeine Regeln

- Inhalte deutschsprachig mit echten Umlauten schreiben.
- Dateinamen und Slugs technisch halten: kleingeschrieben, ASCII, Ziffern und Bindestriche, zum Beispiel `wohnen-und-vergesellschaftung`.
- Bei normalen Content-Dateien muss `slug` dem Dateinamen entsprechen.
- Bei Normen muss `meta.json.slug` dem Normordner entsprechen.
- Datumswerte in JSON als `YYYY-MM-DD` schreiben, zum Beispiel `2026-04-17`.
- Öffentliche Bürgertexte sachlich, behördennah und verständlich formulieren.
- Entwicklerbegriffe wie D1, R2, Build, Repository, Fallback, Live-Override oder serverseitige Formularlogik nicht in öffentliche Seiten schreiben.
- Bilder aus `public/images/...` werden in JSON mit absolutem Pfad ab `/images/...` referenziert.
- Bildfelder immer mit verständlichem Alternativtext und Nachweis pflegen, wenn der Inhaltstyp diese Felder vorsieht.
- Nach Content-Änderungen mindestens `npm run content:check` ausführen; vor Abschluss zusätzlich `npm run check` und bei größeren Änderungen `npm run build`.

## Verzeichnisübersicht

```text
content/
  freistaat/*.json
  haushalt/*.json
  normen/[slug]/
    meta.json
    history.json
    versions/[versionId].json
  presse/
    mitteilungen/*.json
    reden/*.json
    termine/*.json
  regierung/mitglieder/*.json
  ressorts/*.json
  service/
    seiten/*.json
    stellen/*.json
  themen/*.json

src/data/dashboard/
  action-plan.ts
  budget.ts
  legislation.ts
  timeline.ts

public/images/
  jobs/
  ministerien/
  presse/
  regierung/
  ui/
```

## Normale JSON-Inhalte

Die folgenden Content-Typen liegen jeweils als einzelne JSON-Datei. Pflichtfelder sind die Felder, die der Parser erwartet. Optionale Felder sind gekennzeichnet.

### Themenseiten

Pfad: `content/themen/[slug].json`

Themenseiten sind die fachlichen Portalseiten zu politischen Schwerpunkten. Sie verknüpfen Ressorts und Rechtsgrundlagen.

Pflichtfelder:

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

Optionale Felder:

- `hero`
- `mitzeichnungsressorts`

Erlaubte Werte für `status`:

```text
umgesetzt
kernprojekt
teilweise-umgesetzt
sehr-weit-umgesetzt
deutlich-umgesetzt
ausbauphase
laufend
```

Format:

```json
{
  "slug": "beispielthema",
  "title": "Beispielthema",
  "teaser": "Kurzer Einstiegstext für Übersichten.",
  "status": "laufend",
  "hero": "Ein längerer Einstieg für die Detailseite.",
  "beschlossen": ["Beschlossener Punkt."],
  "umgesetzt": ["Umgesetzter Punkt."],
  "naechsteSchritte": ["Nächster Schritt."],
  "rechtsgrundlagen": [
    {
      "label": "Anzeigename der Norm",
      "normSlug": "slug-der-norm"
    }
  ],
  "faq": [
    {
      "question": "Frage?",
      "answer": "Antwort."
    }
  ],
  "federfuehrendesRessort": "slug-des-ressorts",
  "mitzeichnungsressorts": ["weiteres-ressort"]
}
```

`federfuehrendesRessort` und `mitzeichnungsressorts` verweisen auf Slugs in `content/ressorts/`. `rechtsgrundlagen[].normSlug` verweist auf einen Norm-Slug unter `content/normen/`.

### Ressorts

Pfad: `content/ressorts/[slug].json`

Ressorts beschreiben Ministerien, Zuständigkeiten, Kontakt und Verknüpfungen.

Pflichtfelder:

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

Optionale Felder:

- `bildAlt`

Format:

```json
{
  "slug": "staatskanzlei",
  "name": "Staatskanzlei des Ostdeutschen Freistaates",
  "kurzname": "Staatskanzlei",
  "leitung": "Staatsministerin Beispiel",
  "teaser": "Kurze Beschreibung.",
  "aufgaben": ["Aufgabe"],
  "kontakt": {
    "name": "Kontaktstelle",
    "email": "kontakt@example.test",
    "telefon": "+49 351 100-0000",
    "referat": "Referat"
  },
  "bild": "/images/ministerien/staatskanzlei.jpg",
  "bildAlt": "Beschreibung des Bildes",
  "bildnachweis": "Staatsregierung",
  "themen": ["Themenbezug"],
  "verknuepfteLinks": [
    {
      "label": "Zur Staatsregierung",
      "href": "/staatsregierung/"
    }
  ]
}
```

### Regierungsmitglieder

Pfad: `content/regierung/mitglieder/[slug].json`

Regierungsmitglieder werden nach `reihenfolge` sortiert. Gerhardt Lehrmann ist kein aktives Kabinettsmitglied und soll nicht als neues Profil angelegt werden. Das Wirtschaftsressort wird geschäftsführend von Ministerpräsident Dr. Karl Honecker geleitet.

Pflichtfelder:

- `slug`
- `name`
- `amt`
- `ressort`
- `reihenfolge`
- `kurzbiografie`
- `langbiografie`
- `bild`
- `bildnachweis`

Optionale Felder:

- `bildAlt`
- `kontakt`
- `zitat`

Format:

```json
{
  "slug": "max-mustermann",
  "name": "Max Mustermann",
  "amt": "Staatsminister",
  "ressort": "Bezeichnung des Ressorts",
  "reihenfolge": 10,
  "kurzbiografie": "Kurze Zusammenfassung.",
  "langbiografie": ["Absatz eins.", "Absatz zwei."],
  "bild": "/images/regierung/max-mustermann.jpg",
  "bildAlt": "Porträt von Max Mustermann",
  "bildnachweis": "Staatsregierung",
  "kontakt": {
    "email": "max.mustermann@example.test",
    "telefon": "+49 351 100-0000"
  },
  "zitat": "Optionales Zitat."
}
```

### Pressemitteilungen

Pfad: `content/presse/mitteilungen/[slug].json`

Pressemitteilungen können mit Themen, Normen und anderen Pressemitteilungen verknüpft werden.

Pflichtfelder:

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

Optionale Felder:

- `relatedTopicSlugs`
- `relatedNormSlugs`
- `relatedPressSlugs`

Format:

```json
{
  "slug": "beispielmeldung",
  "title": "Titel der Pressemitteilung",
  "date": "2026-04-17",
  "ressort": "Staatskanzlei",
  "teaser": "Kurzer Vorspann.",
  "image": "/images/presse/beispielmeldung.png",
  "imageAlt": "Beschreibung des Bildes",
  "imageCredit": "Staatsregierung",
  "tags": ["Tag"],
  "body": ["Absatz eins.", "Absatz zwei."],
  "isFeatured": false,
  "relatedTopicSlugs": ["themen-slug"],
  "relatedNormSlugs": ["norm-slug"],
  "relatedPressSlugs": ["andere-pressemitteilung"]
}
```

### Reden

Pfad: `content/presse/reden/[slug].json`

Pflichtfelder:

- `slug`
- `title`
- `date`
- `sprecher`
- `teaser`
- `body`

Format:

```json
{
  "slug": "beispielrede",
  "title": "Titel der Rede",
  "date": "2026-04-17",
  "sprecher": "Dr. Karl Honecker",
  "teaser": "Kurzer Vorspann.",
  "body": ["Absatz eins.", "Absatz zwei."]
}
```

### Termine

Pfad: `content/presse/termine/[slug].json`

Pflichtfelder:

- `slug`
- `title`
- `date`
- `location`
- `teaser`
- `body`

Format:

```json
{
  "slug": "beispieltermin",
  "title": "Titel des Termins",
  "date": "2026-04-17",
  "location": "Dresden, Staatskanzlei",
  "teaser": "Kurzer Vorspann.",
  "body": ["Absatz eins.", "Absatz zwei."]
}
```

### Stellenangebote

Pfad: `content/service/stellen/[slug].json`

Pflichtfelder:

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

Optionale Felder:

- `payGrade`
- `contact`
- `image`
- `imageAlt`
- `imageCredit`

Format:

```json
{
  "slug": "beispielstelle",
  "title": "Sachbearbeitung Beispiel",
  "ressort": "Staatsministerium Beispiel",
  "standort": "Dresden",
  "arbeitsbereich": "Referat Beispiel",
  "datePosted": "2026-04-17",
  "applicationDeadline": "2026-05-17",
  "employmentType": "Vollzeit",
  "payGrade": "E 11 TV-L",
  "teaser": "Kurzer Vorspann.",
  "body": ["Absatz eins.", "Absatz zwei."],
  "contact": {
    "name": "Personalreferat",
    "email": "karriere@example.test",
    "telefon": "+49 351 100-0000"
  },
  "image": "/images/jobs/beispielstelle.png",
  "imageAlt": "Bild zur Ausschreibung",
  "imageCredit": "Staatsregierung"
}
```

### Service-Seiten

Pfad: `content/service/seiten/[slug].json`

Pflichtfelder:

- `slug`
- `title`
- `body`

Format:

```json
{
  "slug": "kontakt",
  "title": "Kontakt",
  "body": ["Absatz eins.", "Absatz zwei."]
}
```

Die aktuell dateibasiert gepflegten Service-Grundseiten sind Kontakt, Impressum, Datenschutz und Barrierefreiheit.

### Freistaat-Seiten

Pfad: `content/freistaat/[slug].json`

Pflichtfelder:

- `slug`
- `title`
- `body`

Format wie Service-Seiten. Diese Seiten beschreiben Grundlagen des fiktiven Freistaates, etwa Bezirke, Geschichte, Hauptstädte, Landesfarben und Verfassungsziele.

### Haushaltsseiten

Pfad: `content/haushalt/[slug].json`

Pflichtfelder:

- `slug`
- `title`
- `teaser`
- `body`

Optionale Felder:

- `dataset`

Format:

```json
{
  "slug": "gesamtplan",
  "title": "Doppelhaushalt 2025/2026 - Gesamtplan",
  "teaser": "Kurzer Einstieg.",
  "body": ["Absatz eins.", "Absatz zwei."],
  "dataset": {
    "key": "frei strukturierbare Zusatzdaten für die jeweilige Seite"
  }
}
```

`dataset` wird als Objekt akzeptiert. Die Darstellung hängt von der jeweiligen Haushaltsseite ab.

## Rechtsportal und Normen

Normen sind der empfindlichste Content-Bereich. Sie liegen nicht als einzelne Datei, sondern immer als Ordner:

```text
content/normen/[slug]/
  meta.json
  history.json
  versions/[versionId].json
```

Historische Fassungen sind gespeicherte Fassungen. Sie werden nicht automatisch aus Änderungen berechnet. Jede Fassung muss vollständig genug sein, um eigenständig angezeigt zu werden.

### Norm-Metadaten

Pfad: `content/normen/[slug]/meta.json`

Pflichtfelder:

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

Erlaubte Werte für `type`:

```text
gesetz
verordnung
verwaltungsvorschrift
foerderrichtlinie
allgemeinverfuegung
bekanntmachung
staatsvertrag
zustimmungsgesetz
aenderungsvorschrift
```

Erlaubte Werte für `status`:

```text
in-force
repealed
planned
```

Format:

```json
{
  "id": "beispielgesetz",
  "slug": "beispielgesetz",
  "title": "Gesetz über ein Beispiel",
  "shortTitle": "Beispielgesetz",
  "abbr": "BspG",
  "type": "gesetz",
  "ministry": "Landtag des Freistaates Ostdeutschland",
  "subjects": ["Landesrecht"],
  "keywords": ["Beispiel"],
  "initialCitation": "Gesetz vom 17. April 2026",
  "predecessor": null,
  "successor": null,
  "summary": "Kurze Zusammenfassung.",
  "status": "in-force"
}
```

### Norm-Historie

Pfad: `content/normen/[slug]/history.json`

Bevorzugtes aktuelles Format:

```json
{
  "initialVersionId": "2026-04-17",
  "entries": [
    {
      "date": "2026-04-17",
      "type": "initial",
      "title": "Bekanntmachung der Stammfassung.",
      "citation": "Gesetz vom 17. April 2026",
      "affectingVersionId": "2026-04-17"
    }
  ]
}
```

Erlaubte Werte für `entries[].type`:

```text
initial
amendment
repeal
notice
```

Optionale Felder je Historieneintrag:

- `note`
- `affectingVersionId`
- `relatedNorm`

`initialVersionId` und `affectingVersionId` müssen auf vorhandene Dateien unter `versions/` verweisen.

### Norm-Fassungen

Pfad: `content/normen/[slug]/versions/[versionId].json`

Pflichtfelder:

- `versionId`
- `validFrom`
- `validTo`
- `isCurrent`
- `citation`
- `changeNote`
- `body`

Regeln:

- Es muss genau eine Fassung mit `isCurrent: true` geben.
- Bei der aktuellen Fassung ist `validTo` immer `null`.
- Bei historischen Fassungen ist `validTo` gesetzt.
- `versionId` ist innerhalb einer Norm eindeutig.

Format:

```json
{
  "versionId": "2026-04-17",
  "validFrom": "2026-04-17",
  "validTo": null,
  "isCurrent": true,
  "citation": "Gesetz vom 17. April 2026",
  "changeNote": "Bekanntmachung der Stammfassung.",
  "body": [
    {
      "type": "paragraph",
      "label": "§ 1",
      "title": "Zweck",
      "children": [
        {
          "type": "paragraphText",
          "text": "Dieses Gesetz regelt ein Beispiel."
        },
        {
          "type": "item",
          "label": "1.",
          "text": "Erster Punkt."
        }
      ]
    }
  ]
}
```

Erlaubte Blocktypen in `body`:

```text
part
chapter
section
subsection
paragraph
article
annex
paragraphText
item
subitem
```

Strukturblöcke wie `part`, `chapter`, `section`, `subsection`, `paragraph`, `article` und `annex` brauchen mindestens `label` oder `title` und in der Regel `children`. Textblöcke `paragraphText`, `item` und `subitem` brauchen `text`.

## Dashboard- und Modul-Daten

Nicht alle sichtbaren Inhalte liegen unter `content/`. Einige kompakte Dashboarddaten werden als TypeScript gepflegt:

- `src/data/dashboard/action-plan.ts`: 15-Punkte-Plan
- `src/data/dashboard/budget.ts`: Budget-Explorer, Haushaltszahlen und Sonderfonds
- `src/data/dashboard/legislation.ts`: Gesetzgebungsstand
- `src/data/dashboard/timeline.ts`: Zeitachse auf Startseite und 15-Punkte-Plan

Diese Dateien sind kein Bürgertext-Content im JSON-Modell, sondern strukturierte Moduldaten. Änderungen dort müssen typkompatibel sein. Die erlaubten Typen stehen in `src/lib/portal/modules.ts`.

Wichtige Werte:

- `ActionPlanStatus`: `umgesetzt`, `teilweise_umgesetzt`, `angelegt`
- `TimelineEntryType`: `gesetz`, `projekt`, `kabinett`, `presse`, `haushalt`
- `LegislativeStage`: `entwurf`, `kabinett`, `landtag`, `verkuendung`, `inkrafttreten`
- Budgetjahre: `2025`, `2026`

## Zentrale Konfiguration

Grunddaten, Navigation und Kontakt stehen nicht in `content/`, sondern in Konfigurationsdateien:

- `src/config/site.ts`: Portalname, Pfade, Navigation, Kontakt, Regierungsstammdaten
- `src/config/features.ts`: Feature-Schalter für Header, Analytics und ähnliche Bereiche
- `src/config/analytics.ts`: Analyse- und Consent-Konfiguration

Diese Dateien nur ändern, wenn sich die Struktur oder zentrale Stammdaten ändern. Normale Seiteninhalte gehören nach `content/`.

## Seitengerüst und feste UI-Texte

Nicht jeder sichtbare Text ist ein redaktioneller Datensatz. Einige Texte gehören zur Seitenschablone, Navigation oder Komponente und werden deshalb im Code gepflegt.

Typische Orte:

- `src/layouts/BaseLayout.astro`: Header, Navigation, Suche, Footer und technische Metadaten.
- `src/pages/**/*.astro`: Seiteneinstiege, Abschnittsüberschriften, leere Zustände und feste Verknüpfungen.
- `src/components/**/*.astro`: Karten, Akkordeons, Statusanzeigen, Suchoberflächen und Modultexte.
- `src/lib/portal/presentation.ts` und `src/lib/norms/presentation.ts`: Formatierungs- und Anzeigetexte.

Grundregel: Wiederkehrende oder fachliche Inhalte gehören in `content/` oder `src/data/dashboard/`. Kurze Strukturtexte, Labels und UI-Hinweise bleiben in Astro-Komponenten oder Konfiguration. Wenn ein Text regelmäßig redaktionell geändert werden soll, sollte er nicht dauerhaft hart in einer Seite stehen, sondern in das passende Content-Modell wandern.

## Bilder und Medien

Dateibasierte Bilder liegen derzeit in diesen Ordnern:

```text
public/images/jobs/
public/images/ministerien/
public/images/presse/
public/images/regierung/
public/images/ui/
```

In JSON wird daraus zum Beispiel:

```json
{
  "image": "/images/presse/beispiel.png",
  "imageAlt": "Beschreibung des Bildes",
  "imageCredit": "Staatsregierung"
}
```

`npm run content:check` prüft Bildpfade für Felder wie `bild`, `image` und `hero`, wenn sie mit `/images/` beginnen.

## Verknüpfungen

Folgende Verknüpfungen werden in der Content-QA geprüft:

- `content/themen/*.json`: `federfuehrendesRessort` muss auf ein vorhandenes Ressort zeigen.
- `content/themen/*.json`: `rechtsgrundlagen[].normSlug` muss auf eine vorhandene Norm zeigen.
- `content/presse/mitteilungen/*.json`: `relatedTopicSlugs` muss auf vorhandene Themen zeigen.
- `content/presse/mitteilungen/*.json`: `relatedNormSlugs` muss auf vorhandene Normen zeigen.
- `content/presse/mitteilungen/*.json`: `relatedPressSlugs` muss auf vorhandene Pressemitteilungen zeigen.

Interne Links in `verknuepfteLinks`, Dashboarddaten und Fließtext werden nicht vollständig automatisch validiert. Sie sollten nach Änderungen im Browser geprüft werden.

## Empfohlener Ablauf

1. Passenden Content-Typ und Pfad bestimmen.
2. Bestehende Datei als Vorlage nutzen.
3. `slug` und Dateiname konsistent halten.
4. Pflichtfelder vollständig ausfüllen.
5. Verweise auf Ressorts, Themen, Normen und Pressemitteilungen gegen den Bestand prüfen.
6. Bilder unter `public/images/...` ablegen und mit `/images/...` referenzieren.
7. Öffentliche Texte auf behördennahen Ton und technische Begriffe prüfen.
8. `npm run content:check` ausführen.
9. Bei strukturellen Änderungen zusätzlich `npm run check` und `npm run build` ausführen.

## Schnellreferenz

| Inhalt | Datei oder Ordner | Format |
| --- | --- | --- |
| Themenseite | `content/themen/[slug].json` | JSON-Objekt |
| Ressort | `content/ressorts/[slug].json` | JSON-Objekt |
| Regierungsmitglied | `content/regierung/mitglieder/[slug].json` | JSON-Objekt |
| Pressemitteilung | `content/presse/mitteilungen/[slug].json` | JSON-Objekt |
| Rede | `content/presse/reden/[slug].json` | JSON-Objekt |
| Termin | `content/presse/termine/[slug].json` | JSON-Objekt |
| Stellenangebot | `content/service/stellen/[slug].json` | JSON-Objekt |
| Service-Seite | `content/service/seiten/[slug].json` | JSON-Objekt |
| Freistaat-Seite | `content/freistaat/[slug].json` | JSON-Objekt |
| Haushaltsseite | `content/haushalt/[slug].json` | JSON-Objekt mit optionalem `dataset` |
| Norm | `content/normen/[slug]/` | `meta.json`, `history.json`, `versions/*.json` |
| 15-Punkte-Plan | `src/data/dashboard/action-plan.ts` | TypeScript-Daten |
| Budget-Module | `src/data/dashboard/budget.ts` | TypeScript-Daten |
| Gesetzgebungsstand | `src/data/dashboard/legislation.ts` | TypeScript-Daten |
| Timeline | `src/data/dashboard/timeline.ts` | TypeScript-Daten |
