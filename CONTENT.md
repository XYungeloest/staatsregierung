# Content-Pflege

Diese Datei beschreibt den aktuellen kanonischen Weg, Inhalte der Website einzupflegen. Maßgeblich sind der tatsächliche Code- und Content-Stand, `README.md`, `AGENTS.md` und diese Datei. Technische Details werden in den Parsern in `packages/shared/src/lib/portal/schema.ts` und `packages/shared/src/lib/norms/schema.ts` validiert.

## Grundsatz

Öffentliche Website-Inhalte werden in der Regel dateibasiert als JSON unter `content/` gepflegt. Eine Inhaltsdatei ist immer ein JSON-Objekt, kein Markdown-Dokument und keine Liste als Wurzelwert. Textabsätze werden meist als String-Arrays gepflegt.

Das Portal wird dateibasiert gepflegt: Inhalte werden über validierte JSON-Dateien und Bilddateien unter `public/images/` bereitgestellt. Das Staatsportal liest ausschließlich `content/`; OstRecht liest zur Laufzeit die aus `content/normen` und `content/verkuendungen` projizierte Cloudflare-D1-Datenbank (eine abgeleitete Projektion, keine zweite Inhaltsquelle; siehe `docs/REVOSAX_BULK_IMPORT.md`). R2 archiviert nur unveränderte Rohquellen. Änderungen an den kanonischen Dateien werden über Branches und Pull Requests geprüft.

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
- Für aktuelle Übersichten gilt der zentrale redaktionelle Stichtag aus
  `packages/shared/src/config/editorial.json`. Termine davor sind
  vergangen; Stellen mit früherer Bewerbungsfrist sind abgelaufen und dürfen nicht als aktuell
  hervorgehoben werden.
- Bilder aus `public/images/...` werden in JSON mit absolutem Pfad ab `/images/...` referenziert.
- Bildfelder immer mit verständlichem Alternativtext pflegen. Bildnachweise nur angeben, wenn ein
  belastbarer Nachweis vorliegt; keine Platzhalter- oder vorläufigen Angaben veröffentlichen.
- Nach Content-Änderungen mindestens `npm run content:check` ausführen; vor Abschluss zusätzlich `npm run check` und bei größeren Änderungen `npm run build`.

## Verzeichnisübersicht

```text
content/
  dashboard/
  gesetzgebung/*.json
  freistaat/*.json
  haushalt/*.json
  normen/[slug]/
    meta.json
    history.json
    versions/[versionId].json
  organisation/
    governments.json
    offices.json
    assignments.json
    snapshots/[datum].json
  portal/home.json
  presse/
    mitteilungen/*.json
    reden/*.json
    termine/*.json
  regierung/
    cabinet-page.json
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

apps/portal/src/data/dashboard/
  action-plan.ts       # reiner JSON-Leseadapter
  legislation.ts       # Darstellung aus content/gesetzgebung
  timeline.ts          # reiner JSON-Leseadapter

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
- `place`
- `publisher`
- `originalIssueDesignation`
- `alternativeIssueDesignation`
- `sourceFiles`
- `sourceReferences`
- `entries[].documentDate`
- `entries[].startPage`
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
`originalIssueDesignation` gibt ausschließlich die im Original sichtbare Ausgabenbezeichnung
wieder. Eine zusätzlich im Portal verwendete, nicht im Original stehende Bezeichnung wird getrennt
als `alternativeIssueDesignation` gespeichert. Das optionale Feld `pdf` ist einem tatsächlich
öffentlich erreichbaren Download vorbehalten; eine nur intern versionierte Kontrollquelle wird
nicht automatisch öffentlich verlinkt.
`entries[].documentDate` bezeichnet dagegen das Ausfertigungs- beziehungsweise Dokumentdatum.
Beide Werte werden getrennt gepflegt und dürfen nicht aus Bequemlichkeit gleichgesetzt werden.
`entries[].type` bezeichnet dieselbe Rechtsvorschrift wie die verknüpfte Norm und folgt deshalb
deren Normtyp (`publicationEntryTypeForNormType` in
`packages/shared/src/lib/norms/publications.ts`): Zustimmungsgesetze erscheinen als `gesetz`,
Änderungsvorschriften mit dem Typ des ändernden Rechtsakts – im Staatsanzeiger
`verwaltungsvorschrift`, sonst `gesetz` oder `verordnung` –, alle übrigen Normtypen unverändert.
`entries[].citation` enthält Normart, Dokumentdatum und die belegte Fundstelle. Die genannte
Normart muss zum Normtyp passen; amtliche Sonderformen einer Verwaltungsvorschrift (Anordnung,
Erlass, Organisationserlass, Dienstanordnung) und einer Förderrichtlinie (Richtlinie) bleiben
erhalten. `startPage` bezeichnet
ausschließlich eine belastbar bekannte Anfangsseite; `pages` ist vollständigen, belegten Seitenbereichen
vorbehalten. Eine Anfangsseite darf nicht als vollständiger Seitenbereich ausgegeben und bei Mantelgesetzen
nicht pauschal auf eingeführte Stammnormen übertragen werden. Auch im verknüpften Normdatensatz bleibt das vollständige Normzitat erhalten, zum Beispiel
`Förderrichtlinie vom 6. März 2026 (StAnzO. 2026 Nr. 4)`.

Normmetadaten trennen das erlassende Organ (`enactingBody`) vom fachlich zuständigen Geschäftsbereich
(`responsibleMinistry`). Das frühere Sammelfeld `ministry` ist in Normmetadaten nicht mehr zulässig.
Das Titelmodell trennt drei Bezeichnungen: `title` ist der amtliche Langtitel, `shortTitle` die
echte Kurzbezeichnung und `abbr` die echte Abkürzung. `shortTitle` und `abbr` sind optional und
entfallen, wenn es sie nicht gibt; sie wiederholen weder den Titel noch einander. Abkürzungsartige
Bezeichnungen der Quelle („Änd. OstSFG“, „1. ÄndVO …“, reine Kürzelformen) sind kein Kurztitel und
werden als Stichwort in `keywords` geführt. Eine Abkürzung ist höchstens 20 Zeichen lang oder,
zusammengeschrieben, höchstens 30 Zeichen; sie enthält keinen Zeilenumbruch und ist keine aus dem
Titel gebildete Initialenfolge. `abbr` darf ausschließlich aus einer Primärquelle übernommen werden.
Redaktionelle Kurztitel werden über `shortTitleSource: "editorial"` kenntlich gemacht; ohne
`shortTitle` entfällt auch dieses Feld. Die gemeinsamen Regeln stehen in
`scripts/lib/norm-title-rules.mjs` und werden von Import, Materialisierung und `content:check` genutzt.

Öffentlich gilt überall derselbe Titelblock (`getNormTitleBlock`): Überschrift ist die
Kurzbezeichnung, sonst der Titel; der Langtitel steht darunter, wenn er von der Überschrift abweicht;
die Abkürzung steht daneben, wenn sie sich von der Überschrift unterscheidet.

`summary` ist eine redaktionelle Kurzbeschreibung. Ist sie nur eine aus Typ und Titel gebildete
Formel des Massenimports, trägt sie `summarySource: "derived"`; solche Zusammenfassungen werden
öffentlich nicht ausgespielt und nicht als Suchtext indexiert. Ohne Kennzeichnung gilt eine
Zusammenfassung als redaktionell. Formeln ohne REVOSax-Herkunft sind unzulässig; eigene Vorschriften
brauchen eine echte Kurzbeschreibung.

Verwaltungsabkommen werden als eigener Normtyp `verwaltungsabkommen` geführt und nicht als
Staatsvertrag oder Verwaltungsvorschrift klassifiziert. Vertragspartner, Unterzeichner,
Abschlussort, Rechtsgrundlagen und quellentreue Abweichungen stehen in `agreementDetails`.
Ein modelliertes Wirksamkeitsdatum darf einen fehlenden ausdrücklichen Inkrafttretenssatz nicht
verdecken; der Quellenhinweis wird zusätzlich in `dateNote` und `versions[].sourceNotes` geführt.

Bei HTML-migrierten Normen dokumentiert `meta.json` dieselbe strukturtragende Datei zusätzlich in
`sourceReferences`. Verkündungsdatensatz und Normmetadaten müssen dabei auf denselben `.html`-Pfad
zeigen; die Content-QA prüft diese Beziehung. Nur bei einer Altquelle ohne zuordenbare HTML-Ausgabe
darf stattdessen `legacy-markdown-transcription` mit einem `.md`-Pfad verwendet werden. Auch dann
müssen Verkündungsdatensatz und Normmetadaten dieselbe strukturtragende Datei nennen.
Eine parallel bereitgestellte Markdown-Transkription wird bei vollständigem HTML als
`supplementary-markdown-transcription` dokumentiert und bleibt gegenüber HTML und amtlicher
PDF-Kontrolle nachrangig.

`sourceFiles` und `sourceReferences[].localSource` dürfen ausschließlich relative Pfade zu
tatsächlich versionierten Dateien enthalten. Externe Quellen verwenden eine HTTPS-URL und
`availability: "external"`. Lokal redaktionell geprüfte, aber nicht mitversionierte Originale
werden mit `availability: "not-versioned"` dokumentiert; ein scheinbarer lokaler Pfad ist dann
unzulässig. Soweit amtliche PDFs unter `Gesetze/` versioniert sind, dienen sie der visuellen
Gegenprüfung, werden aber nicht als strukturtragende Importquelle behandelt. Diese Gegenprüfung
umfasst insbesondere Gliederungstiefe, Einrückung, Nummerierungs- und Fortsetzungsfolgen, zitierte
Neufassungen, Tabellenkopf- und Zellenstruktur sowie die Zuordnung von Anlagen. Mehrdeutige
Abweichungen werden weder sprachlich noch strukturell still harmonisiert.
Bei binären Prüfquellen dokumentiert `sourceReferences` zusätzlich Medientyp, SHA-256, PDF-
Seitenzahl, Prüfdatum, Quellenrolle und die zugehörige abgeleitete Transkription. `structure-bearing`
kennzeichnet die strukturtragende Textquelle; `visual-control` die maßgebliche visuelle
Gegenprüfung. Stimmen beide nicht überein, hat die Primärquelle Vorrang und die Abweichung wird in
`CONTENT_GAPS.md` festgehalten.

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

Themenseiten sind die fachlichen Portalseiten zu politischen Schwerpunkten. Sie verknüpfen Ressorts,
Rechtsgrundlagen und – soweit vorhanden – Wissenshub-Projekte. Der fachliche Status und die
redaktionelle Priorisierung bleiben getrennte Angaben: `status` beschreibt das Vorhaben,
`priority`, `featured` und der Hervorhebungszeitraum steuern nur seine Auffindbarkeit.

Pflichtfelder:

- `slug`
- `title`
- `teaser`
- `status`
- `cluster`
- `priority`
- `featured`
- `updatedAt`
- `beschlossen`
- `umgesetzt`
- `naechsteSchritte`
- `rechtsgrundlagen`
- `faq`
- `federfuehrendesRessort`
- `knowledgeProjectRefs`

Optionale Felder:

- `hero`
- `mitzeichnungsressorts`
- `highlightFrom`
- `highlightUntil`
- `relatedTopicSlugs`
- `keyDates`
- `modules`

`cluster` ordnet jedes Thema genau einem Bereich zu. Erlaubt sind `staat-demokratie`,
`bildung-gesellschaft`, `wirtschaft-arbeit`, `infrastruktur-wohnen`, `umwelt-versorgung` und
`nachbarschaft-europa`. `priority` liegt zwischen 0 und 100. `featured` kennzeichnet einen
dauerhaften Schwerpunkt. Ein Thema wird im Zeitraum von `highlightFrom` bis einschließlich
`highlightUntil` im Bereich „Aktuell“ der Themenübersicht und auf der Startseite hervorgehoben.
Fehlt `highlightUntil`, bleibt die Hervorhebung offen; das ist nur für tatsächlich dauerhaft
aktuelle Vorhaben sinnvoll. `updatedAt` ist ein fachliches Redaktionsdatum, kein Build-Zeitpunkt.

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
  "cluster": "infrastruktur-wohnen",
  "priority": 80,
  "featured": true,
  "highlightFrom": "2026-08-01",
  "highlightUntil": "2026-08-31",
  "updatedAt": "2026-08-09",
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
  "mitzeichnungsressorts": ["weiteres-ressort"],
  "relatedTopicSlugs": ["verwandtes-thema"],
  "keyDates": [
    {
      "date": "2026-08-22",
      "label": "Nächster fachlicher Termin",
      "kind": "deadline"
    }
  ],
  "modules": [],
  "knowledgeProjectRefs": ["project-beispiel"]
}
```

`federfuehrendesRessort` und `mitzeichnungsressorts` verweisen auf Slugs in `content/ressorts/`. `rechtsgrundlagen[].normSlug` verweist auf einen Norm-Slug unter `content/normen/`.
`keyDates` speichert belegte fachliche Termine. `modules` erlaubt die Typen `questions`,
`timeline`, `facts` und `comparison`; sie werden nur verwendet, wenn die jeweilige Darstellung
einen inhaltlichen Mehrwert hat. Projekt- und Gegenwartsstände des Wissenshubs werden in
`content/portal/topic-coverage.json` redaktionell öffentlichen Themen oder anderen Portalwegen
zugeordnet. Neue Wissenshub-IDs müssen dort eingeordnet werden; eine Ausnahme ohne eigene
Oberfläche benötigt eine Begründung. Dasselbe Register enthält unter `discoverability` die
zentrale Mindestzahl laufender Hervorhebungen und – nur für einen ausdrücklich datierten
redaktionellen Zeitraum – das führende aktuelle Thema. Dadurch muss eine zeitkritische
Priorisierung weder in der Startseite noch in der Themenübersicht doppelt gepflegt werden. Vor dem
Fortschreiben des redaktionellen Stichtags ist ein ausgelaufener Zeitraum durch eine neue belegte
Hervorhebung oder eine redaktionell beschlossene Nachfolge zu ersetzen.

### Regierungsorganisation

Pfade:

```text
content/organisation/governments.json
content/organisation/offices.json
content/organisation/assignments.json
```

Diese drei Dateien sind die einzige öffentliche Quelle für Regierungschef, Stellvertretung,
Mitgliedschaft, aktuelle Ämter, Ressortleitungen und Mitgliederzahl. Eine Zuordnung enthält
mindestens Person, Amt, Regierung, Gültigkeitsintervall und – bei einer Ressortleitung – den
Ressort-Slug. Mehrere gleichzeitige Zuordnungen sind zulässig.

```json
{
  "id": "2026-07-21-wirtschaft-max-peterson",
  "personSlug": "max-peterson",
  "officeSlug": "staatsratsmitglied",
  "ministrySlug": "wirtschaft-arbeitsmarkt-und-beschaeftigung",
  "governmentSlug": "erster-staatsrat",
  "title": "Staatsrat für Wirtschaft und Arbeit",
  "validFrom": "2026-07-21",
  "validTo": null,
  "sortOrder": 100,
  "sourceRefs": ["redaktionelle-quelle"]
}
```

Kabinettsänderungen werden atomar mit der Funktion `applyCabinetReshuffle` in
`packages/shared/src/lib/portal/organization.ts` durchgeführt. Sie beendet die bisherige
Leitung, legt die neue Zuordnung an, prüft alle Invarianten und liefert Diff, Dateien und Routen.
`content/organisation/snapshots/` enthält ausdrücklich datierte Test-Snapshots und ist keine zweite
öffentliche Datenquelle.

### Ressorts

Pfad: `content/ressorts/[slug].json`

Ressorts beschreiben Staatssekretariate, Zuständigkeiten, Kontakt und Verknüpfungen. Die aktuelle
Leitung wird aus `content/organisation/assignments.json` abgeleitet und darf hier nicht gepflegt werden.

Pflichtfelder:

- `slug`
- `name`
- `kurzname`
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
  "bildnachweis": "Staatsrat",
  "themen": ["Themenbezug"],
  "verknuepfteLinks": [
    {
      "label": "Zum Staatsrat",
      "href": "/staatsregierung/"
    }
  ]
}
```

### Regierungsmitglieder

Pfad: `content/regierung/mitglieder/[slug].json`

Personendateien enthalten Biografie, Kontakt, Bild und Darstellungsangaben. Sortierung, aktueller
Status, Ämter, Ressorts und Mitgliedschaft werden aus dem Organisationsmodell abgeleitet. Emma
Müller kann dadurch als aktive Chefin der Staatskanzlei erscheinen, ohne Mitglied des Staatsrats zu
sein; mehrere gleichzeitige Ämter werden ohne Freitextduplikate unterstützt.

Pflichtfelder:

- `slug`
- `name`
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
  "kurzbiografie": "Kurze Zusammenfassung.",
  "langbiografie": ["Absatz eins.", "Absatz zwei."],
  "bild": "/images/regierung/max-mustermann.jpg",
  "bildAlt": "Porträt von Max Mustermann",
  "bildnachweis": "Staatsrat",
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

Öffentliche Übersichten teilen Termine über `packages/shared/src/lib/portal/dates.ts` in künftige und vergangene
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
`/haushalt/sondervermoegen/`. Die zentrale Datenlogik ist `apps/portal/src/data/haushalt.ts`:

- `context/Staatshaushalt 2025_2026 - Zusammenfassung.csv` liefert die Werte der beiden Jahre
  für Gesamtplan und Einzelpläne.
- `context/Staatshaushalt 2025_2026.zip` liefert die archivierten Einzelplan-Blätter für die
  dargestellten Kapitel und Titel.
- Summen, Anteile und Veränderungen werden aus diesen Werten berechnet; sie dürfen nicht in
  Seiten oder Komponenten erneut hart codiert werden.
- `content/haushalt/*.json` bleibt als Such- und Metadatenbestand erhalten. Dort keine von der
  zentralen Datenquelle abweichenden Kennzahlen pflegen.

## Rechtsportal und Normen

OstRecht ist unter `https://recht.freistaat-ostdeutschland.de` eine eigenständige öffentliche
Anwendung. Es verwendet ohne Contentkopie dieselben Verzeichnisse `content/normen/`,
`content/verkuendungen/`, `content/gesetzgebung/` und `Gesetze/` wie das Staatsportal. Das interne
`knowledge/` bleibt ebenfalls gemeinsam, wird aber in keinem öffentlichen Build ausgeliefert.
Öffentliche URLs werden ausschließlich durch die zentralen Route-Helper erzeugt; Normdatensätze
enthalten deshalb keine Site-Origin. Das Staatsportal behält `/recht/` als Brückenseite und leitet
frühere Detailadressen permanent auf die konfigurierbare `LAW_SITE_URL` weiter.

Normen sind der empfindlichste Content-Bereich. Sie liegen nicht als einzelne Datei, sondern immer als Ordner:

```text
content/normen/[slug]/
  meta.json
  history.json
  versions/[versionId].json
```

Historische Fassungen sind gespeicherte Fassungen. Sie werden nicht bei einem Seitenaufruf aus
Änderungstexten berechnet. Jede Fassung muss vollständig genug sein, um eigenständig angezeigt zu
werden; Platzhalter wie „unverändert“ oder zusammengefasste Paragraphenbereiche sind unzulässig.

Die Rechtssuche wird buildzeitbasiert aus den gespeicherten Fassungen erzeugt. Der allgemeine
Normlink führt dynamisch zu der am zentralen redaktionellen Stichtag geltenden Fassung.
Versionsspezifische URLs verweisen unveränderlich auf genau eine gespeicherte Fassung.
`packages/shared/src/lib/norms/versions.ts` unterscheidet `current`, `future`, `historical` und
`unknown-effective` aus Gültigkeitsintervall, Normstatus und Stichtag.

Die Rechtsherkunft wird nicht als freies Redaktionslabel gepflegt. `packages/shared/src/lib/norms/origin.ts`
ermittelt sie aus den vorhandenen Quellen- und Historienfeldern nach diesen Regeln:

- „Übernommen“ setzt eine Fassung ab dem 1. November 2023 und einen fassungsspezifischen
  `revosax-snapshot` voraus, dessen `sourceValidFrom`/`sourceValidTo` diesen Tag abdeckt.
- Spätere ostdeutsche `amendment`- und `repeal`-Einträge zählen nur mit belegter ostdeutscher
  Fundstelle oder eindeutig verknüpfter eigener Änderungsvorschrift.
- Eine nach dem Ausgangsstichtag beginnende Norm gilt nur dann als eigenständig neu geschaffen,
  wenn ihre eigene Verkündung oder die verknüpfte Einführungsvorschrift belegt ist und keine
  sächsische Übernahmequelle vorliegt.
- Unvollständige Belege führen zu „Herkunft nicht abschließend belegt“; sie werden nicht aus Titel,
  Sachgebiet oder einer bloßen zeitlichen Nähe erraten.
- Ein später ausdrücklich übernommener sächsischer Zwischenstand bleibt bis zur ersten eigenen
  Änderung als übernommene Zwischenfassung erkennbar. Die Ausgangsfassung und jede geänderte
  Fassung werden fassungsspezifisch beschriftet.

Normtexte können kontrollierte Links enthalten, die zur Laufzeit aus eindeutigen Abkürzungen und
Kurztiteln im vorhandenen Normenbestand erzeugt werden. Externe Bundesrechtsverweise sind bewusst
auf eine kleine gepflegte Liste beschränkt.

### Norm-Metadaten

Pfad: `content/normen/[slug]/meta.json`

Pflichtfelder:

- `id`
- `slug`
- `title`
- `type`
- `subjects`
- `primarySubject`
- `keywords`
- `initialCitation`
- `predecessor`
- `successor`
- `summary`
- `status`

`shortTitle`, `abbr`, `shortTitleSource`, `summarySource`, `enactingBody` und `responsibleMinistry`
sind optional. Kurzbezeichnung und Abkürzung folgen dem Titelmodell; eine Abkürzung darf nur
bei belastbarer Quelle gepflegt werden. Neue Normen trennen das erlassende Organ von der fachlichen
Zuständigkeit. `predecessorSlug` und `successorSlug` können zusätzlich gesetzt werden, wenn die
Beziehung auf einen eindeutig geprüften Normdatensatz verweist; nur dann wird sie als Normlink
ausgegeben.

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
  "enactingBody": "Volkskammer des Freistaates Ostdeutschland",
  "responsibleMinistry": "Staatssekretariat für Rechtsstaatlichkeit und kulturelle Emanzipation",
  "subjects": ["Verfassungsrecht"],
  "primarySubject": "Verfassungsrecht",
  "keywords": ["Beispiel"],
  "initialCitation": "Gesetz vom 17. April 2026 (OGVBl. 2026 Nr. 20 S. 2)",
  "predecessor": null,
  "successor": null,
  "enactedNorm": "eingefuehrte-stammnorm",
  "summary": "Kurze Zusammenfassung.",
  "status": "in-force"
}
```

`enactedNorm`, `enactedNorms` und `enactingNorm` kennzeichnen die wechselseitige Beziehung zwischen einem
Einführungs- oder Mantelgesetz und der dadurch eingeführten Stammnorm. Diese Beziehung ist keine
Vorgänger-/Nachfolgerbeziehung und keine Berechtigung, beide Rechtsakte zusammenzuführen.
`affectedNorms` und `affectedByNorms` kennzeichnen entsprechend die wechselseitige Beziehung
zwischen Änderungsvorschrift und geänderter Stammnorm. Der Historieneintrag der Stammnorm nennt
zusätzlich die Änderungsvorschrift und die betroffene Folgefassung; bei einer vollständigen
Aufhebung endet die letzte Volltextfassung am letzten Geltungstag.

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

Optionale fassungsspezifische Identitätsfelder:

- `title`
- `shortTitle`
- `abbr`
- `summary`

Regeln:

- `isCurrent` ist ein rückwärtskompatibles Bestandsfeld. Öffentliche Statusangaben und Filter
  dürfen daraus nicht abgeleitet werden.
- `validFrom` und `validTo` bilden ein geschlossenes Gültigkeitsintervall; `validTo: null` bedeutet
  bei geltenden oder zukünftigen Fassungen ein offenes Ende.
- Gespeicherte Intervalle derselben Norm dürfen sich nicht überlappen.
- Bei ausdrücklich historischen oder aufgehobenen Datensätzen ohne belegtes Enddatum bleibt
  `validTo` leer; die öffentliche Anzeige weist die Bestandslücke aus, statt „bis heute“ zu
  behaupten.
- Ist `meta.expiryDate` belegt, muss `validTo` der letzten gespeicherten Fassung diesem Datum
  entsprechen.
- Eine Allgemeinverfügung, deren Titel oder Wortlaut ein Ende nennt („bis zum 1. Januar 2026“,
  „mit Ablauf des …“), führt dieses Ende als `meta.expiryDate`; liegt es vor dem redaktionellen
  Stichtag, ist der Status `repealed` und die Historie trägt einen Eintrag zum Außerkrafttreten.
  Der Import erzeugt diese Angaben deterministisch aus `PUBLICATION_EXPIRY_CONFIG` in
  `scripts/import-normen.mjs`, nicht von Hand.
- Eine zukünftige Fassung wird aus `validFrom` nach dem redaktionellen Stichtag ermittelt und nie
  als historische Fassung bezeichnet.
- Bei `pending-effective` wird die Fassung unabhängig vom Bestandsfeld als „Inkrafttreten nicht
  belegt“ behandelt.
- `versionId` ist innerhalb einer Norm eindeutig.
- Ändern sich Titel, Kurztitel, Abkürzung oder Kurzbeschreibung, werden die neuen Werte in der
  betroffenen Fassung gespeichert. Historische Fassungen behalten ihre damalige Bezeichnung;
  `meta.json` dient nur als Rückfallwert.
- Die fassungseigenen Bezeichnungen folgen demselben Titelmodell: `shortTitle` wiederholt nicht den
  Titel der Fassung, `abbr` bleibt eine echte Abkürzung. Eine fassungseigene `summary` gilt immer
  als redaktionell.
- Das öffentliche Vollzitat wird ausschließlich zentral mit `buildNormFullCitation` für die
  konkret angezeigte Fassung erzeugt. Stammfundstelle, einzelne Verkündung und Vollzitat bleiben
  getrennte Angaben.

### Normlinks, Suche und Druck

- `/norm/[slug]/` auf der OstRecht-Origin ist der dynamische Hauptlink.
- `/norm/[slug]/version/[versionId]/` auf der OstRecht-Origin ist der unveränderliche Fassungslink.
- Die Fassungsnavigation erscheint auf Normtext, gespeicherter Fassung, „Fassungen und Änderungen“
  und Vergleich. Sie führt ausschließlich Unterseiten: „Aktuelle Fassung“, „Fassungen und
  Änderungen“ (`/norm/[slug]/history/`) und – ab zwei gespeicherten Fassungen – „Fassungsvergleich“.
  Dasselbe Ziel heißt überall „Fassungen und Änderungen“; die Seite selbst gliedert sich in
  Fassungen, Änderungen und Stammdaten.
- Der Vergleich speichert die Auswahl in `von` und `bis`; ohne JavaScript bleibt der voreingestellte
  Vergleich zur vorherigen Fassung lesbar. Bei übernommenem Recht wird zusätzlich ein direkter
  Vergleich mit der belegten Ausgangsfassung angeboten. Weitere Paarungen werden erst beim Abruf für
  genau das angefragte Paar berechnet; die Normseiten betten nicht alle Fassungs-Paare ein.
- `/rechtsentwicklung/` auf der OstRecht-Origin bündelt Herkunft, Ausgangsfassung, eigene Änderungen und den
  anwendbaren Stand. Filter für Suchtext, Herkunft, Normtyp, Sachgebiet und Status bleiben in der
  Adresse erhalten.
- Suchparameter mit mehreren Werten werden wiederholt, etwa `type=gesetz&type=verordnung`.
  Verschiedene Facetten sind UND-verknüpft, Werte derselben Facette ODER-verknüpft.
- `versionScope` unterstützt `current`, `future`, `historical`, `unknown-effective` und `all`.
- `origin` unterstützt `ostdeutsch-original`, `inherited-unchanged`, `inherited-amended` und
  `origin-unresolved` und verwendet dieselbe zentrale Einordnung wie die Normseiten.
- Ein Stern am Wortende ist ein Präfix-Platzhalter; die normale Teilwortsuche bleibt bestehen.
- Ohne ausdrücklichen `sort`-Parameter gilt: mit Suchanfrage Relevanz, ohne Suchanfrage (auch mit
  Filtern) `activity` – das jüngste Rechtsereignis der Norm zuerst (Erlass, Änderung, Aufhebung,
  Fassungsbeginn bis zum Stichtag; dieselbe Definition wie `law_norms.last_change_date`), sodass
  neue und geänderte Vorschriften vor unverändert übernommenem Recht stehen. `publication`,
  `relevance`, `title` und `rechtsstand` bleiben wählbare Sortierungen.
- Druckansichten sind Portalansichten. Ein PDF- oder Anlagenlink wird nur aus einem belegten
  Quellenfeld erzeugt.
- `subjects` nennt ausschließlich Untergruppen der amtlichen zweistufigen Sachgebietssystematik
  (`packages/shared/src/config/law-subjects.json`: acht Hauptgruppen, 56 Untergruppen mit
  zweistelliger Gliederungsnummer, zehn Förderbereiche 550–559; Helfer in
  `packages/shared/src/config/law-subjects.ts`). Höchstens drei Sachgebiete ohne Wiederholung;
  `primarySubject` ist Pflicht und stets `subjects[0]`. Die frühere Auffangbezeichnung
  „Landesrecht“ ist unzulässig. Die Hauptgruppe folgt aus der Untergruppe und wird nicht
  gespeichert; die Adresse eines Sachgebiets ist `/sachgebiete/<nummer>-<titel>/`.
- `fundingArea` nennt bei einer Förderrichtlinie den Förderbereich (`"550"` bis `"559"`) aus
  derselben Konfiguration; bei allen anderen Normarten ist das Feld unzulässig.
- `sourceReferences[].fsnNumber` hält die Fundstellennummer einer amtlichen REVOSax-Quelle fest
  (zum Beispiel `"612-3.10/2"`). Ihre Gliederungsnummer trägt die Sachgebietszuordnung und macht
  sie ohne den lokalen Rohcache nachvollziehbar.

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
signature
```

Strukturblöcke wie `part`, `chapter`, `section`, `subsection`, `paragraph`, `article` und `annex` brauchen mindestens `label` oder `title` und in der Regel `children`. Textblöcke `paragraphText`, `item` und `subitem` brauchen `text`.

Der Blocktyp `signature` bildet den Unterschriftenblock am Ende einer eigenen Verkündung ab:
`text` nennt die unterzeichnende Person, `title` die Amtsbezeichnung in Normalschreibung
(„Der Ministerpräsident“, „Die Staatsministerin des Innern, Bau und für Kommunales“) und `label`
Ort und Datum, soweit die Quelle sie im selben Block führt. Untergeordnete Blöcke sind dort nicht
zulässig. Der Block steht auf Dokumentebene unter dem Normtext, bildet keine Fundstelle, wird nicht
durchsucht und trägt keine Textverweise. Führt die Quelle Ort und Datum als eigene Zeile vor der
Unterschrift („Dresden, den 20. Juli 2026“), gehört der gesamte Ausfertigungsblock nicht zum
Normkörper und wird beim Import verworfen.

Amtliche Quellen setzen Amtsbezeichnungen und einzelne Hervorhebungen gesperrt („D e r
M I N I S T E R P R Ä S I D E N T“, „s o l l“). Der Normkörper kennt kein Auszeichnungsmodell für
Hervorhebungen; gesperrter Satz wird deshalb als gewöhnliches Wort gespeichert. `content:check`
lehnt Folgen aus mindestens vier einzeln stehenden Buchstaben in `label`, `title` und `text`
außerhalb eines `signature`-Blocks ab. Ebenso lehnt es einen Text ab, der mit der Überschrift
seiner übergeordneten Gliederungseinheit beginnt: Die Überschrift steht genau einmal.

## Parlamentarische Gesetzgebung

Pfad: `content/gesetzgebung/[slug].json`

Parlamentarische Vorgänge werden als eigenständige, quellengebundene Inhaltsdatensätze gepflegt.
`packages/shared/src/lib/portal/legislation.ts` validiert und lädt diese Datensätze für die Portalansichten. Ein
Vorgang erhält seinen Status ausschließlich aus belegten Dokumenten; das Erreichen eines
Sitzungstermins verändert ihn nicht automatisch. Eine Annahmeempfehlung ist weder Gesetzesbeschluss
noch Verkündung.

Pflichtangaben sind Slug, vollständiger Titel, Kurztitel, Drucksachennummer, Initiator,
Verfahrensstufe, verständlicher Statustext, nächste angesetzte Beratung, Quellen und
Verknüpfungen. Der zuletzt bestätigte Stand wird zentral aus `packages/shared/src/config/editorial.json` abgeleitet.
Einbringungsdatum, Ausschuss, Beschlussempfehlung und
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

Häufig redigierte Dashboarddaten liegen als validiertes JSON vor:

- `content/dashboard/action-plan.json`: 15-Punkte-Plan
- `content/dashboard/timeline.json`: Zeitachse
- `apps/portal/src/data/haushalt.ts`: Gesamtplan, Einzelpläne, Kapitelangaben und Sondervermögen

Die gleichnamigen Dateien unter `apps/portal/src/data/dashboard/` laden nur das JSON. Die erlaubten Typen und
Parser stehen in `packages/shared/src/lib/portal/dashboard-content.ts`.

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

- `packages/shared/src/config/site-routing.ts`: Origins, Zielsite und Pfadtabellen beider Websites (Teil der D1-Projektion)
- `packages/shared/src/config/site.ts`: Portalname, Navigation, Kontakt, SEO und Zielbezeichnungen (reine Darstellung)
- `packages/shared/src/config/editorial.json`: redaktioneller Stichtag
- `packages/shared/src/config/features.ts`: Feature-Schalter für die optionale Webanalyse
- `packages/shared/src/config/analytics.ts`: Analyse- und Consent-Konfiguration

Diese Dateien nur ändern, wenn sich die Struktur oder zentrale Stammdaten ändern. Normale Seiteninhalte gehören nach `content/`.

`scripts/import-normen.mjs` ist der kontrollierte Importer für versionierte Rechtsquellen unter
`Gesetze/`. Reguläre Quellen sind HTML-Dateien. Er verwendet `parse5`, klassifiziert
Verkündungsblätter, konsolidierte Einzelnormen,
redaktionelle Dateien, nicht unterstützte und mehrdeutige Quellen und rekonstruiert Google-Docs-
Listen aus Listenkennung, Ebene, CSS-Zählerformat und Zählerstand. Skripte, externe Stylesheets,
Schriftimporte, Bilder und Layoutattribute werden verworfen. Das Quell-HTML wird nicht direkt in
Astro ausgegeben; allein validierte JSON-Blöcke sind öffentlich. Markdown bleibt ausschließlich für
Altquellen ohne entsprechende HTML-Ausgabe verfügbar. Sobald die Ausgabe intern als HTML erkannt
wird, wird ihr Markdown-Pendant nicht geöffnet. Der Legacy-Parser nutzt erhaltene Einrückungen und
gleicht verlorene alphabetische beziehungsweise römische Ebenen gegen die PDF-Darstellung ab.
Ohne `--write` läuft der Import ausschließlich prüfend. Schreiben ist nur mit einer gezielten
`.html`- oder zulässigen `.md`-`--file`-Angabe möglich; vorhandene Datensätze werden
erst mit `--update-existing` verändert. Es gibt keinen Modus, der den gesamten Normbestand
automatisch löscht. PDF-Dateien werden nur als visuelle Kontrollquelle und nicht automatisch als
Normtext ausgewertet. Fehlt die notwendige PDF oder bleibt eine Struktur trotz visueller Kontrolle
mehrdeutig, wird dies in `CONTENT_GAPS.md` festgehalten; der strikte Audit meldet den betroffenen
Parserfall als `needs-review`.

```sh
npm run norms:audit
npm run norms:audit -- --strict
npm run norms:alt-sources:build
npm run norms:alt-sources:migrate
npm run norms:import -- --write --file "Gesetze/OGVBl. 2026 Nr. 58.html"
npm run norms:import -- --write --file "Gesetze/OGVBl.2026Nr.59.html"
npm run norms:import -- --write --update-existing --file "Gesetze/OGVBl. 2026 Nr. 44.md"
npm run test:parser
```

Der strikte Audit ist schreibfrei und prüft die konfigurierten HTML-Primärquellen gegen die
gespeicherten Normfassungen und Verkündungsdatensätze. Er schlägt bei fehlenden Normen,
abweichenden Titeln oder Datumswerten, Parser-Vertragsverletzungen und geplanten Änderungen fehl.
Er ist Bestandteil von `npm run content:check` und der CI-Qualitätsprüfung.

Für OGVBl. 2026 Nr. 59 ist die vollständige HTML-Fassung die strukturtragende Importquelle.
Das amtliche PDF dient der visuellen Kontrolle; die inhaltlich identische Markdown-Fassung bleibt
als zusätzliche Transkription versioniert und wird bei vorhandener HTML-Ausgabe nicht importiert.

Die Altquellen-Befehle sind ein enger, reproduzierbarer Migrationspfad für OGVBl. II/2024,
OGVBl. I/2025 und die dazugehörige Verfassungsquelle. Der Build-Befehl setzt die vollständigen
Ausgaben aus redaktionell geprüften Teiltranskriptionen zusammen. Der Migrationsbefehl validiert
zunächst Hashes, Seiteninventar und Struktur und aktualisiert dann die elf Einzelakte,
Verkündungsdatensätze sowie die belegten Verfassungs- und Bezirksfassungen. Das dazugehörige
Prüfinventar liegt unter `data/recht/alt-source-inventory.json`; weder Migration noch Content-Check
benötigen Netzwerkzugriff.

### Konsolidierung übernommener Stammnormen

Der verbindliche Ausgangsstichtag für sächsische Stammnormen ist der 1. November 2023. Die
Konsolidierung verwendet genau die an diesem Tag geltende historische REVOSax-Fassung. Für
Stammnormen, die erst später nachweislich eingeführt wurden, gilt stattdessen die belegte
Einführungsfassung; sie erhalten keine künstliche REVOSax-Ausgangsfassung.

```text
data/recht/
  consolidation-sources.json
  consolidation-manifest.json
  consolidation-report.md
  sources/revosax/[zielnorm]/[fassungs-id].html
  parsed/revosax/[zielnorm].json
  amendments/[aenderungsvorschrift]/[zielnorm].json
```

- `sources/revosax/` enthält unveränderte amtliche HTML-Snapshots. Jeder Snapshot hat
  Vorschriften-ID, konkrete Fassungs-URL, tatsächlichen Quellgültigkeitszeitraum, Abrufdatum und
  SHA-256 in `consolidation-sources.json`.
- Nur `npm run norms:revosax:fetch` greift auf das Netz zu. Parser, Konsolidierung, Content-QA und
  Build arbeiten ausschließlich mit versionierten lokalen Quellen.
- Ein unter `adoptedSources` gesicherter späterer sächsischer Zwischenstand ist nur zulässig, wenn
  eine ostdeutsche Änderungsvorschrift genau diese Fassung bezeichnet. Neben Snapshot, URL,
  Gültigkeitsintervall und Hash werden Änderungsvorschrift, Änderungsstelle und der wörtliche
  Adoptionsbeleg gespeichert. Die Zwischenfassung erhält eine eigene unveränderliche Versions-ID.
  Spätere sächsische Fassungen ohne solchen Beleg werden nicht in das ostdeutsche Recht übernommen.
- Patch-Rezepte nennen für jede Operation Zielanker, erwarteten Alttext oder Hash, erwartete
  Trefferzahl, Änderungsquelle, Änderungsstelle und Wirksamkeitsdatum. Null oder mehrere Treffer
  sowie ein abweichender Hash brechen den Lauf ab; eine heuristische Änderung wird nicht
  geschrieben.
- Wirken mehrere belegte Änderungen am selben Tag, muss jedes Rezept einen eindeutigen
  `sameDayOrder` besitzen. Die Rezepte werden in dieser Reihenfolge angewendet, erzeugen genau eine
  gemeinsame Volltextfassung und bleiben als getrennte Historieneinträge sichtbar.
- Ohne `--write` bleibt `npm run norms:consolidate` ein Prüflauf. Das Schreibflag aktualisiert nur
  das ausgewählte Ziel und seine wechselseitigen Beziehungen. Vorhandene Slugs und
  versionsspezifische URLs bleiben stabil.
- `npm run norms:consolidation:audit` erkennt Änderungsvorschriften und Zielnormen rekursiv und
  erzeugt Manifest und Bericht. `npm run content:check` verwendet `--check` und schlägt fehl, wenn
  der gespeicherte Audit nicht mehr dem Content entspricht.
- `blocked-source-conflict` ist eine fachliche Sperre. Eine gesperrte Norm wird erst
  konsolidiert, wenn die im Manifest und in `CONTENT_GAPS.md` benannte Primärquellenfrage
  eindeutig geklärt ist.
- Eine verbindlich redaktionell geklärte Abweichung erhält dagegen den Status
  `resolved-source-conflict`. Entscheidung, verkündeter Wortlaut, angewendeter Zielanker,
  Begründung, Entscheidungsdatum und Belege stehen maschinenlesbar in Normmetadaten,
  Quellenkonfiguration und Patch-Rezept. Die Änderungsvorschrift selbst wird dabei nicht
  umgeschrieben. Eine solche Auflösung ist ausdrücklich keine konfliktfreie Quellenlage.

## Seitengerüst und feste UI-Texte

Nicht jeder sichtbare Text ist ein redaktioneller Datensatz. Einige Texte gehören zur Seitenschablone, Navigation oder Komponente und werden deshalb im Code gepflegt.

Typische Orte:

- `apps/portal/src/layouts/BaseLayout.astro`: Header, Navigation, Suche, Footer und technische Metadaten.
- `apps/portal/src/pages/**/*.astro`: Seiteneinstiege, Abschnittsüberschriften, leere Zustände und feste Verknüpfungen.
- `apps/portal/src/components/**/*.astro` und `apps/recht/src/components/**/*.astro`: app-spezifische Karten, Akkordeons, Statusanzeigen, Suchoberflächen und Modultexte.
- `packages/shared/src/components/**/*.astro`: von beiden Anwendungen verwendete Seitengerüst- und Basiskomponenten.
- `packages/shared/src/lib/portal/presentation.ts`, `packages/shared/src/lib/norms/display.ts` und `packages/shared/src/lib/norms/origin-presentation.ts`: Formatierungen, Gliederung und Anzeigetexte der Oberfläche. `packages/shared/src/lib/norms/presentation.ts` enthält nur die projizierten Anzeigetexte und Anker (Normtyp, Rechtsstand, Umlautkorrektur) und gehört zur D1-Projektion.
- `packages/shared/src/lib/norms/routes.ts`: zentrale Pfade und Gruppierungen des Rechtsbereichs, einschließlich
  Suche, Index, Sachgebieten, Förderrichtlinien und Hilfe.

Grundregel: Wiederkehrende oder fachliche Inhalte gehören in `content/` oder `apps/portal/src/data/dashboard/`. Kurze Strukturtexte, Labels und UI-Hinweise bleiben in Astro-Komponenten oder Konfiguration. Wenn ein Text regelmäßig redaktionell geändert werden soll, sollte er nicht dauerhaft hart in einer Seite stehen, sondern in das passende Content-Modell wandern.

Die feste Unterseite `/themen/bildung-und-schule/schulsystem/` wird im Code gepflegt, weil sie
mehrere Komponenten, lokale Anker und eine eigene Grafikdarstellung verbindet. Die Schularten,
Tabellenzeilen und Ankerpunkte liegen in `apps/portal/src/data/school-system.ts`; die ausgelieferte Grafik liegt
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
Betriebskontakte werden in `packages/shared/src/config/site.ts` gepflegt und auf Seiten nicht erneut hartcodiert.

Die ausgelieferte Schulsystemgrafik wird als bereinigtes SVG ohne Draw.io-Dokumentdaten oder
eingebettete Raster-Fallbacks geführt. Die Content-QA prüft dafür ein Größenbudget von 200.000 Byte
und weist verbliebene Editor- beziehungsweise Rasterdaten zurück. Die bearbeitbare Quelldatei in
`context/` bleibt davon unberührt.

## Verknüpfungen

Folgende Verknüpfungen werden in der Content-QA geprüft:

- `content/themen/*.json`: `federfuehrendesRessort` muss auf ein vorhandenes Ressort zeigen.
- `content/themen/*.json`: `rechtsgrundlagen[].normSlug` muss auf eine vorhandene Norm zeigen.
- `content/themen/*.json`: `relatedTopicSlugs` muss auf vorhandene Themen zeigen.
- `content/themen/*.json`: `knowledgeProjectRefs` muss wechselseitig zum Coverage-Register passen.
- `content/presse/mitteilungen/*.json`: `relatedTopicSlugs` muss auf vorhandene Themen zeigen.
- `content/presse/mitteilungen/*.json`: `relatedNormSlugs` muss auf vorhandene Normen zeigen.
- `content/presse/mitteilungen/*.json`: `relatedPressSlugs` muss auf vorhandene Pressemitteilungen zeigen.
- `content/presse/termine/*.json`: `relatedTopicSlugs` muss auf vorhandene Themen zeigen.

`npm run content:check` führt zusätzlich `scripts/check-topic-coverage.mjs` aus. Der Check verlangt
für alle Wissenshub-Projekte und Gegenwartsstände eine redaktionelle Einordnung, prüft die
wechselseitigen Projektbezüge, verhindert eine zweite Startseiten-Themenliste und stellt sicher,
dass am redaktionellen Stichtag mindestens die unter `discoverability.minimumActiveHighlights`
festgelegte Zahl aktueller Themen auffindbar ist. Eine zeitlich begrenzte Spitzenpriorität wird
über `discoverability.editorialLead` mit Thema, Beginn und Ende gepflegt; außerhalb dieses
Zeitraums gilt sie nicht mehr.

Die Content-QA prüft außerhalb von `content/normen/` außerdem verbreitete Paar-, Schrägstrich-,
Sternchen-, Binnen-I- und Unterstrichformen. Öffentliche Personenbezeichnungen werden mit
Doppelpunkt gepflegt.

Interne Links in `verknuepfteLinks`, Dashboarddaten und Fließtext werden nicht vollständig automatisch validiert. Sie sollten nach Änderungen im Browser geprüft werden.

## Empfohlener Ablauf

1. Bestehende Datei als Vorlage nutzen.
2. `slug` und Dateiname konsistent halten.
3. Pflichtfelder vollständig ausfüllen.
4. Verweise auf Ressorts, Themen, Normen und Pressemitteilungen gegen den Bestand prüfen.
5. Bilder unter `public/images/...` ablegen und mit `/images/...` referenzieren.
6. Öffentliche Texte auf behördennahen Ton und technische Begriffe prüfen.
7. `npm run content:check` ausführen.
8. Bei strukturellen Änderungen zusätzlich `npm run check` und `npm run build` ausführen.

### Vollständiger Eingang aus `temp-neu/`

Die Anweisung „`temp-neu` einpflegen“ genügt künftig als Kurzform für den gesamten Ablauf:

1. Neue Dateien inventarisieren und zusammengehörige HTML-, PDF-, Markdown- und Bildquellen erkennen.
2. Amtliche PDFs vollständig rendern und gegen Überschriften, Gliederung, Listenfortsetzungen,
   Seitenzahlen, Tabellen, Anlagen und Signaturen der strukturtragenden HTML-Quelle prüfen.
3. Geprüfte amtliche Quellen nach `Gesetze/` übernehmen; öffentlich verlinkte PDFs zusätzlich unter
   `public/assets/recht/` ablegen.
4. Für jede neue Ausgabe eine stabile Importkonfiguration ergänzen und den kanonischen Ablauf aus
   [`docs/NORM_WORKFLOW.md`](docs/NORM_WORKFLOW.md) verwenden: zunächst mit
   `npm run norms:workflow -- --file "…html" --quick` auditieren, danach mit
   `npm run norms:workflow -- --file "…html" --write` gezielt importieren, konsolidieren und
   vollständig prüfen. Der Workflow aktualisiert vorhandene Normen inkrementell; `--quick` ist
   nur eine Zwischenprüfung und kein Abschlusslauf.
5. Pressemitteilungen aus dem Eingang in das Content-Schema übertragen, redaktionell kürzen oder
   gliedern und mit Themen, Normen sowie verwandten Meldungen verbinden.
6. Bilder nur bei inhaltlicher Übereinstimmung und ohne sichtbare Beschriftungsfehler veröffentlichen;
   andernfalls im Eingang belassen und den Konflikt melden.
7. Betroffene Themen-, Timeline-, Dashboard- und andere Gegenwartsangaben sowie den zentralen
   redaktionellen Stichtag gemeinsam fortschreiben.
8. Für Eingänge ohne Normquelle die entsprechenden Content-, Wissenshub-, Build-, Link- und
   SEO-Prüfungen sowie die repräsentativen Browser- und Accessibility-Smokes separat ausführen.
   Bei Normquellen übernimmt der vollständige `norms:workflow`-Lauf diese Prüfungen. Visuelle
   Baselines nur bei tatsächlich betroffenen Oberflächen und erst nach Sichtprüfung aktualisieren.

Dieser Ablauf verändert oder leert `temp-neu/` nicht. Das Verzeichnis bleibt der wiederverwendbare
Benutzereingang und ist nicht Teil der öffentlichen Auslieferung.

## Schnellreferenz

| Inhalt | Datei oder Ordner | Format |
| --- | --- | --- |
| Themenseite | `content/themen/[slug].json` | JSON-Objekt |
| Ressort | `content/ressorts/[slug].json` | JSON-Objekt |
| Regierungsmitglied | `content/regierung/mitglieder/[slug].json` | JSON-Objekt |
| Regierungsorganisation | `content/organisation/*.json` | normalisierte JSON-Objekte |
| Startseite | `content/portal/home.json` | JSON-Objekt |
| Themen-Coverage | `content/portal/topic-coverage.json` | JSON-Objekt |
| Kabinettsseite | `content/regierung/cabinet-page.json` | JSON-Objekt |
| Pressemitteilung | `content/presse/mitteilungen/[slug].json` | JSON-Objekt |
| Rede | `content/presse/reden/[slug].json` | JSON-Objekt |
| Termin | `content/presse/termine/[slug].json` | JSON-Objekt |
| Stellenangebot | `content/service/stellen/[slug].json` | JSON-Objekt |
| Service-Seite | `content/service/seiten/[slug].json` | JSON-Objekt |
| Freistaat-Seite | `content/freistaat/[slug].json` | JSON-Objekt |
| Haushaltsdaten | `apps/portal/src/data/haushalt.ts` | Buildzeitbasiertes TypeScript-Datenmodell aus CSV und Archivblättern |
| Norm | `content/normen/[slug]/` | `meta.json`, `history.json`, `versions/*.json` |
| 15-Punkte-Plan | `content/dashboard/action-plan.json` | JSON-Objekt |
| Gesetzgebungsverfahren | `content/gesetzgebung/[slug].json` | JSON-Objekt |
| Timeline | `content/dashboard/timeline.json` | JSON-Objekt |
