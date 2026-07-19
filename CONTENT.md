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
- Öffentliche Texte erläutern nicht die Umsetzung, Gestaltung oder Bereitstellung der Website. Keine
  Hinweise auf Platzhalter, technische Zustände oder beabsichtigte Designwirkung schreiben.
- Personenbezeichnungen mit Doppelpunkt gendern, zum Beispiel `Bürger:innen`, `Schüler:innen` und
  `Referent:in`. Paarformen, Sternchen, Binnen-I und Unterstriche nicht verwenden.
- Der sichtbare Hinweis zur politischen Simulation bleibt auf obere Hinweisleiste und Footer
  beschränkt. Das Impressum enthält die ausführliche rechtliche Einordnung; in normalen
  Seiteninhalten keine zusätzlichen Hinweise auf Fiktion oder Simulation ergänzen.
- Für aktuelle Übersichten gilt der redaktionelle Stichtag 19. Juli 2026. Termine davor sind
  vergangen; Stellen mit früherer Bewerbungsfrist sind abgelaufen und dürfen nicht als aktuell
  hervorgehoben werden.
- Bilder aus `public/images/...` werden in JSON mit absolutem Pfad ab `/images/...` referenziert.
- Bildfelder immer mit verständlichem Alternativtext pflegen. Bildnachweise nur angeben, wenn ein
  belastbarer Nachweis vorliegt; keine Platzhalter- oder vorläufigen Angaben veröffentlichen.
- Nach Content-Änderungen mindestens `npm run content:check` ausführen; vor Abschluss zusätzlich `npm run check` und bei größeren Änderungen `npm run build`.

## Verzeichnisübersicht

```text
content/
  gesetzgebung/*.json
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
  regierung/
    archiv/
      kabinett-honecker-i.json
      honecker-i/
        mitglieder/*.json
        ressorts/*.json
    mitglieder/*.json
  ressorts/*.json
  service/
    seiten/*.json
    stellen/*.json
  themen/*.json
  verkuendungen/*.json

public/data/
  kreisreform/
    manifest.json
    neue-kreise.geojson
    neue-bezirke.geojson
    alte-*.geojson
    gemeinden-zur-suche.json

src/data/dashboard/
  action-plan.ts
  legislation.ts
  timeline.ts

public/images/
  jobs/
  ministerien/
  presse/
  regierung/
  ui/
```

## Rechtsverkündungen und Fundstellen

Pfad: `content/verkuendungen/[slug].json`

Verkündungen beschreiben Ausgaben amtlicher Veröffentlichungsblätter. Sie sind das Bindeglied
zwischen Fundstelle und gespeicherter Normfassung. Die Normdateien selbst bleiben unverändert; die
Verknüpfung erfolgt über `entries[].normSlug` und `entries[].versionId`.

Pflichtfelder:

- `slug`
- `title`
- `year`
- `issue`
- `date`
- `publication`
- `entries`

Optionale Felder:

- `pdf`
- `sourceFiles`
- `sourceReferences`
- `entries[].documentDate`
- `entries[].pages`
- `entries[].normSlug`
- `entries[].versionId`

Format:

```json
{
  "slug": "ogvbl-2026-16",
  "title": "Ostdeutsches Gesetz- und Verordnungsblatt 2026 Nr. 16",
  "year": 2026,
  "issue": "16",
  "date": "2026-03-23",
  "publication": "OGVBl.",
  "sourceReferences": [
    {
      "kind": "original",
      "label": "Amtliches Original-PDF der Ausgabe",
      "availability": "not-versioned"
    }
  ],
  "entries": [
    {
      "id": "beispielgesetz",
      "title": "Beispielgesetz",
      "type": "gesetz",
      "citation": "Gesetz vom 22. März 2026 (OGVBl. 2026 Nr. 16 S. 1)",
      "documentDate": "2026-03-22",
      "pages": "1-4",
      "normSlug": "beispielgesetz",
      "versionId": "2026-03-23"
    }
  ]
}
```

`date` ist das Ausgabedatum und damit das Veröffentlichungsdatum der Ausgabe.
`entries[].documentDate` bezeichnet dagegen das Ausfertigungs- beziehungsweise Dokumentdatum.
Beide Werte werden getrennt gepflegt und dürfen nicht aus Bequemlichkeit gleichgesetzt werden.
`entries[].citation` enthält Normart, Dokumentdatum und die genaue Fundstelle einschließlich
Seitenbereich. Auch im verknüpften Normdatensatz bleibt das vollständige Normzitat erhalten, zum Beispiel
`Förderrichtlinie vom 6. März 2026 (StAnzO. 2026 Nr. 4)`.

`sourceFiles` und `sourceReferences[].localSource` dürfen ausschließlich relative Pfade zu
tatsächlich versionierten Dateien enthalten. Externe Quellen verwenden eine HTTPS-URL und
`availability: "external"`. Lokal redaktionell geprüfte, aber nicht mitversionierte Originale
werden mit `availability: "not-versioned"` dokumentiert; ein scheinbarer lokaler Pfad ist dann
unzulässig. Der aktuelle Bestand hält die amtlichen PDF-Originale nicht im Repository vor.

Erlaubte Eintragstypen:

```text
gesetz
verordnung
verwaltungsvorschrift
foerderrichtlinie
bekanntmachung
staatsvertrag
sonstiges
```

`entries[].normSlug` muss auf eine Norm unter `content/normen/` verweisen. Wenn `versionId`
gesetzt ist, muss diese Fassung unter `content/normen/[slug]/versions/[versionId].json`
vorhanden sein.

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
geplant
entwurf
im-gesetzgebungsverfahren
beschlossen
in-umsetzung
abgeschlossen
```

Format:

```json
{
  "slug": "beispielthema",
  "title": "Beispielthema",
  "teaser": "Kurzer Einstiegstext für Übersichten.",
  "status": "in-umsetzung",
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

Regierungsmitglieder werden nach `reihenfolge` sortiert. Der aktuelle Kabinettsstand ist Honecker II. Gerhardt Lehrmann ist kein aktives Kabinettsmitglied und soll nicht als neues Profil angelegt werden. Das Wirtschaftsressort wird im aktuellen Kabinett von Staatsminister Max Peterson geleitet.

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

### Archivierte Kabinette

Pfade:

```text
content/regierung/archiv/kabinett-honecker-i.json
content/regierung/archiv/honecker-i/mitglieder/[slug].json
content/regierung/archiv/honecker-i/ressorts/[slug].json
```

Archivierte Kabinette dokumentieren abgeschlossene Regierungsstände. Sie sind inhaltlich eigenständige Archivstände und werden nicht automatisch aus dem aktuellen Kabinett abgeleitet. Änderungen am aktuellen Kabinett müssen deshalb nicht rückwirkend in Archivdateien übernommen werden.

`kabinett-honecker-i.json` beschreibt den Archivstand als Ganzes.

Pflichtfelder:

- `slug`
- `title`
- `cabinetName`
- `formedOn`
- `endedOn`
- `coalition`
- `headOfGovernment`
- `deputyHead`
- `summary`

Die Archiv-Mitglieder verwenden grundsätzlich dieselben Felder wie aktuelle Regierungsmitglieder. Die Archiv-Ressorts verwenden grundsätzlich dieselben Felder wie aktuelle Ressorts. Sichtbar ausgewertet werden auf der Archivseite derzeit insbesondere Name, Amt, Ressort, Reihenfolge, Ressortname, Kurzname und Leitung.

Archivdateien dürfen frühere Ressortzuschnitte, frühere Amtsbezeichnungen und geschäftsführende Zuständigkeiten enthalten. Sie müssen aber weiterhin gültige Slugs, erreichbare Bildpfade und sachliche Archivtexte verwenden.

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

Öffentliche Übersichten teilen Termine über `src/lib/portal/dates.ts` in künftige und vergangene
Einträge. Nur Termine am oder nach dem redaktionellen Stichtag erscheinen unter „Nächste Termine“.
Vergangene Einträge bleiben im Archiv sichtbar.

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
  "image": "/images/jobs/beispielstelle.jpg",
  "imageAlt": "Bild zur Ausschreibung",
  "imageCredit": "Staatsregierung"
}
```

Die Karriereübersicht zeigt nur Stellen mit einer Bewerbungsfrist am oder nach dem redaktionellen
Stichtag als aktuell. Abgelaufene Ausschreibungen bleiben als Archivbestand erreichbar.

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

### Haushaltsbereich

Die fachlichen Haushaltsseiten liegen unter `/haushalt/`, `/haushalt/gesamtplan/`,
`/haushalt/einzelplaene/`, `/haushalt/einzelplaene/[nummer]/` und
`/haushalt/sondervermoegen/`. Die zentrale Datenlogik ist `src/data/haushalt.ts`:

- `context/Staatshaushalt 2025_2026 - Zusammenfassung.csv` liefert die Werte der beiden Jahre
  für Gesamtplan und Einzelpläne.
- `context/Staatshaushalt 2025_2026.zip` liefert die archivierten Einzelplan-Blätter für die
  dargestellten Kapitel und Titel.
- Summen, Anteile und Veränderungen werden aus diesen Werten berechnet; sie dürfen nicht in
  Seiten oder Komponenten erneut hart codiert werden.
- `content/haushalt/*.json` bleibt als Such- und Metadatenbestand erhalten. Dort keine von der
  zentralen Datenquelle abweichenden Kennzahlen pflegen.

## Rechtsportal und Normen

Normen sind der empfindlichste Content-Bereich. Sie liegen nicht als einzelne Datei, sondern immer als Ordner:

```text
content/normen/[slug]/
  meta.json
  history.json
  versions/[versionId].json
```

Historische Fassungen sind gespeicherte Fassungen. Sie werden nicht automatisch aus Änderungen berechnet. Jede Fassung muss vollständig genug sein, um eigenständig angezeigt zu werden.

Die Rechtssuche wird buildzeitbasiert aus den gespeicherten Fassungen erzeugt. Der allgemeine
Normlink führt zur aktuellen Fassung, historische Fassungen behalten eigene statische URLs.

Normtexte können kontrollierte Links enthalten, die zur Laufzeit aus eindeutigen Abkürzungen und
Kurztiteln im vorhandenen Normenbestand erzeugt werden. Externe Bundesrechtsverweise sind bewusst
auf eine kleine gepflegte Liste beschränkt.

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
future-effective
pending-effective
repealed
historical
one-time-act
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
  "enactedNorm": "eingefuehrte-stammnorm",
  "summary": "Kurze Zusammenfassung.",
  "status": "in-force"
}
```

`enactedNorm` und `enactingNorm` kennzeichnen die wechselseitige Beziehung zwischen einem
Einführungs- oder Mantelgesetz und der dadurch eingeführten Stammnorm. Diese Beziehung ist keine
Vorgänger-/Nachfolgerbeziehung und keine Berechtigung, beide Rechtsakte zusammenzuführen.

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

## Parlamentarische Gesetzgebung

Pfad: `content/gesetzgebung/[slug].json`

Parlamentarische Vorgänge werden als eigenständige, quellengebundene Inhaltsdatensätze gepflegt.
`src/data/dashboard/legislation.ts` bereitet diese Daten nur noch für das vorhandene
Übersichtsmodul auf. Ein Vorgang erhält seinen Status ausschließlich aus belegten Dokumenten;
das Erreichen eines Sitzungstermins verändert ihn nicht automatisch. Eine Annahmeempfehlung ist
weder Gesetzesbeschluss noch Verkündung.

Pflichtangaben sind Slug, vollständiger Titel, Kurztitel, Drucksachennummer, Initiator,
Verfahrensstufe, verständlicher Statustext, nächste angesetzte Beratung, Quellen, Verknüpfungen
und der zuletzt bestätigte Stand. Einbringungsdatum, Ausschuss, Beschlussempfehlung und
Verfahrensgruppe werden nur gepflegt, wenn sie belegt sind.

Jeder Eintrag unter `sources` kennzeichnet die Verfügbarkeit ausdrücklich: `local` setzt einen
versionierten `localSource`-Pfad voraus, `external` eine stabile `sourceUrl`, und `missing`
dokumentiert eine noch nicht vorliegende Primärdatei ohne erfundenen Pfad. Tagesordnung und
Beschlussempfehlung ändern einen Vorgang nicht automatisch in einen Ergebnisstatus.

Erlaubte Verfahrensstufen:

```text
eingebracht
erste-lesung-angesetzt
erste-lesung-abgeschlossen
ausschussberatung
zweite-lesung-angesetzt
beschlussempfehlung-annahme
beschlussempfehlung-ablehnung
beschlossen
verkuendet
in-kraft
erledigt
```

## Dashboard- und Modul-Daten

Nicht alle sichtbaren Inhalte liegen unter `content/`. Einige kompakte Dashboarddaten werden als TypeScript gepflegt:

- `src/data/dashboard/action-plan.ts`: 15-Punkte-Plan
- `src/data/haushalt.ts`: Gesamtplan, Einzelpläne, Kapitelangaben und Sondervermögen
- `src/data/dashboard/legislation.ts`: Darstellung der Vorgänge aus `content/gesetzgebung/`
- `src/data/dashboard/timeline.ts`: Zeitachse auf Startseite und 15-Punkte-Plan

Diese Dateien sind kein Bürgertext-Content im JSON-Modell, sondern strukturierte Moduldaten. Änderungen dort müssen typkompatibel sein. Die erlaubten Typen stehen in `src/lib/portal/modules.ts`.

Wichtige Werte:

- `ActionPlanStatus`: `umgesetzt`, `teilweise_umgesetzt`, `angelegt`
- `TimelineEntryType`: `gesetz`, `projekt`, `kabinett`, `presse`, `haushalt`
- Budgetjahre: `2025`, `2026`; Vergleiche werden aus den Jahreswerten abgeleitet

## Kreis- und Bezirksreform

Pfad: `public/data/kreisreform/`

Die Kreisreform verwendet GeoJSON für die Kartenebenen, `manifest.json` für Beschriftungen,
Verfügbarkeit und Kennzahlen sowie `gemeinden-zur-suche.json` für die Suche. Die Seite selbst liegt
unter `/kreisreform/`; die Tabellen werden beim Build aus den neuen Kreis- und Bezirksdaten erzeugt.

Neue oder geänderte Kartendaten müssen konsistente Kennungen für Suche, Bezirke und Kreise behalten.
Die Grundinformationen müssen auch ohne geladene Karte über Suche, Detailbereich, mobile
Bezirk-Karten und Tabellen erreichbar bleiben.

## Zentrale Konfiguration

Grunddaten, Navigation und Kontakt stehen nicht in `content/`, sondern in Konfigurationsdateien:

- `src/config/site.ts`: Portalname, Pfade, Navigation, Kontakt, Regierungsstammdaten
- `src/config/features.ts`: Feature-Schalter für die optionale Webanalyse
- `src/config/analytics.ts`: Analyse- und Consent-Konfiguration

Diese Dateien nur ändern, wenn sich die Struktur oder zentrale Stammdaten ändern. Normale Seiteninhalte gehören nach `content/`.

`scripts/import-normen.mjs` ist ein kontrolliertes Migrationswerkzeug für lokale Markdown-
Extrakte. Das Quellverzeichnis muss mit `--source-dir` ausdrücklich angegeben werden. Ohne
`--replace-output` läuft das Werkzeug nur prüfend; mit diesem Schalter ersetzt es den vollständigen
Normbestand und darf deshalb nur nach gesonderter Sicherung und Quellenprüfung eingesetzt werden.

## Seitengerüst und feste UI-Texte

Nicht jeder sichtbare Text ist ein redaktioneller Datensatz. Einige Texte gehören zur Seitenschablone, Navigation oder Komponente und werden deshalb im Code gepflegt.

Typische Orte:

- `src/layouts/BaseLayout.astro`: Header, Navigation, Suche, Footer und technische Metadaten.
- `src/pages/**/*.astro`: Seiteneinstiege, Abschnittsüberschriften, leere Zustände und feste Verknüpfungen.
- `src/components/**/*.astro`: Karten, Akkordeons, Statusanzeigen, Suchoberflächen und Modultexte.
- `src/lib/portal/presentation.ts` und `src/lib/norms/presentation.ts`: Formatierungs- und Anzeigetexte.
- `src/lib/norms/routes.ts`: zentrale Pfade und Gruppierungen des Rechtsbereichs, einschließlich
  Suche, Index, Sachgebieten, Förderrichtlinien und Hilfe.

Grundregel: Wiederkehrende oder fachliche Inhalte gehören in `content/` oder `src/data/dashboard/`. Kurze Strukturtexte, Labels und UI-Hinweise bleiben in Astro-Komponenten oder Konfiguration. Wenn ein Text regelmäßig redaktionell geändert werden soll, sollte er nicht dauerhaft hart in einer Seite stehen, sondern in das passende Content-Modell wandern.

Die feste Unterseite `/themen/bildung-und-schule/schulsystem/` wird im Code gepflegt, weil sie
mehrere Komponenten, lokale Anker und eine eigene Grafikdarstellung verbindet. Die Schularten,
Tabellenzeilen und Ankerpunkte liegen in `src/data/school-system.ts`; die ausgelieferte Grafik liegt
unter `public/images/ui/schulsystem.svg`, die bearbeitbare draw.io-Ausgangsdatei unter
`context/schulsystem.drawio.svg`.

Die allgemeine Suche unter `/suche/` hat feste, zugängliche Zustände für Ausgangslage, Laden,
Treffer, keine Treffer und Fehler. Die Texte dieser Zustände liegen in der Suchseite und ihrem
Skript; sie sind keine redaktionellen Datensätze. Beim Ändern müssen die Zustände weiterhin klar
unterscheidbar bleiben und Suchfeld, Filter sowie Enter-Taste per Tastatur funktionieren.

Die Kreisreform hat eine eigenständige Gebietssuche. Sie wird aus `manifest.json`, neuen Kreisen,
neuen Bezirken und `gemeinden-zur-suche.json` gespeist und muss auch ohne geöffnete Karte eine
textliche Zuordnung ausgeben.

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

Fotografische Motive sollten als webtaugliche JPEG-Dateien gepflegt werden. Transparente oder grafische Platzhalter können PNG bleiben.

`npm run content:check` prüft Bildpfade für Felder wie `bild`, `image` und `hero`, wenn sie mit `/images/` beginnen.

E-Mail-Adressen in redaktionellen JSON-Daten verwenden ausschließlich die Domain
`freistaat-ostdeutschland.de`. Die Content-QA führt diese Domain als kontrollierte Allowlist und
meldet unbekannte oder abweichende Domains als Fehler. Zentrale Portal-, Presse-, Redaktions- und
Betriebskontakte werden in `src/config/site.ts` gepflegt und auf Seiten nicht erneut hartcodiert.

Die ausgelieferte Schulsystemgrafik wird als bereinigtes SVG ohne Draw.io-Dokumentdaten oder
eingebettete Raster-Fallbacks geführt. Die Content-QA prüft dafür ein Größenbudget von 200.000 Byte
und weist verbliebene Editor- beziehungsweise Rasterdaten zurück. Die bearbeitbare Quelldatei in
`context/` bleibt davon unberührt.

## Verknüpfungen

Folgende Verknüpfungen werden in der Content-QA geprüft:

- `content/themen/*.json`: `federfuehrendesRessort` muss auf ein vorhandenes Ressort zeigen.
- `content/themen/*.json`: `rechtsgrundlagen[].normSlug` muss auf eine vorhandene Norm zeigen.
- `content/presse/mitteilungen/*.json`: `relatedTopicSlugs` muss auf vorhandene Themen zeigen.
- `content/presse/mitteilungen/*.json`: `relatedNormSlugs` muss auf vorhandene Normen zeigen.
- `content/presse/mitteilungen/*.json`: `relatedPressSlugs` muss auf vorhandene Pressemitteilungen zeigen.

Die Content-QA prüft außerhalb von `content/normen/` außerdem verbreitete Paar-, Schrägstrich-,
Sternchen-, Binnen-I- und Unterstrichformen. Öffentliche Personenbezeichnungen werden mit
Doppelpunkt gepflegt.

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
| Haushaltsdaten | `src/data/haushalt.ts` | Buildzeitbasiertes TypeScript-Datenmodell aus CSV und Archivblättern |
| Norm | `content/normen/[slug]/` | `meta.json`, `history.json`, `versions/*.json` |
| 15-Punkte-Plan | `src/data/dashboard/action-plan.ts` | TypeScript-Daten |
| Gesetzgebungsverfahren | `content/gesetzgebung/[slug].json` | JSON-Objekt |
| Gesetzgebungsdarstellung | `src/data/dashboard/legislation.ts` | TypeScript-Adapter |
| Timeline | `src/data/dashboard/timeline.ts` | TypeScript-Daten |
