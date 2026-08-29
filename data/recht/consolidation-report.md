# Konsolidierungs-Audit

**Ausgangsstichtag:** 2023-11-01
**Erzeugt:** 2026-08-29T14:10:16.826Z

- Erkannte Änderungsvorschriften: 61
- Erkannte Zielnormen: 85
- Vollständig konsolidiert: 81
- Aktuell offene Zielnormen: 4

## Offener Handlungsbedarf

- Fehlende Stammnormdatensätze: 0
- Unvollständige Platzhalterbestände: 0
- Blockierte Quellenkonflikte: 3
- Fehlende Primärquellen: 1

Abgeschlossene Zielnormen werden in diesem Bericht nicht fortgeschrieben. Solange eine Zielnorm noch nicht vollständig umgesetzt ist, bleibt sie mit Problem und nächstem Schritt hier sichtbar. Der vollständige maschinenlesbare Status steht zusätzlich in `data/recht/consolidation-manifest.json`; redaktionelle Quellenfragen werden in `CONTENT_GAPS.md` gebündelt.

## Offene Zielnormen

### Gesetz über den öffentlichen Personennahverkehr im Freistaat Sachsen

- Datensatz: `ostdeutsches-personennahverkehrsgesetz`
- Status: `blocked-source-conflict`
- Problem: Artikel 9 Nummer 1 des Kreis- und Bezirksneuordnungsgesetzes ordnet zum 21. Juli 2026 Ergänzungen in § 3 Absatz 1 nach den Wörtern „Landkreise und kreisfreien Städte“ an. Die am 24. März 2026 in Kraft getretene Neufassung des § 3 Absatz 1 enthält diese Wörter nicht mehr; sie stehen nur in Absatz 2. Eine Umdeutung des ausdrücklich bezeichneten Absatzes ist ohne Berichtigung oder andere Primärquelle unzulässig. Die gleichzeitig vorgesehenen weiteren Änderungen werden bis zur Klärung nicht als vollständige Folgefassung ausgegeben.
- Problem: Fassungsfolge ist nicht vollständig oder besitzt lückenhafte Intervalle.
- Nächster Schritt: Quellenkonflikt fachlich klären; bis dahin keine Konsolidierung.

### NDR-Staatsvertrag

- Datensatz: `ndr-staatsvertrag`
- Status: `missing-baseline`
- Problem: Maßgebliche amtliche Ausgangsfassung ist noch nicht versioniert.
- Nächster Schritt: Maßgebliche amtliche Ausgangsfassung ermitteln, unverändert archivieren und prüfen.

### Schulordnung Förderschulen

- Datensatz: `schulordnung-foerderschulen`
- Status: `blocked-source-conflict`
- Problem: Verbleibender Quellenkonflikt trotz OGVBl. 2026 Nr. 68: Artikel 1 Nummer 6 Buchstabe b der Änderungsverordnung verlangt in § 8 Absatz 3 die Wörter „Klassenstufen 5 und 6 der Oberschule“. Die verbindliche REVOSax-Ausgangsfassung enthält dort stattdessen „Lehrplänen für die Oberschule“. Die Berichtigung Nr. 68 erfasst nur die Befehle zu § 8 Absatz 2 und § 9 Absatz 2; eine heuristische Umdeutung des nicht berichtigten Befehls ist unzulässig.
- Problem: Fassungsfolge ist nicht vollständig oder besitzt lückenhafte Intervalle.
- Nächster Schritt: Quellenkonflikt fachlich klären; bis dahin keine Konsolidierung.

### Zehntes Sächsisches Kostenverzeichnis

- Datensatz: `zehntes-ostdeutsches-kostenverzeichnis`
- Status: `blocked-source-conflict`
- Problem: Artikel 3 Nummer 2 des Gesetzes zur Einführung des Ostdeutschen Transparenz- und Informationsfreiheitsgesetzes ordnet an, nach Tarifstelle 2 eine neue Tarifstelle 3 anzufügen. Die amtliche, im Änderungsgesetz selbst zitierte Ausgangsfassung des Zehnten Sächsischen Kostenverzeichnisses enthält im einschlägigen Abschnitt bereits eine Tarifstelle 3. Ob Ersetzung, Umnummerierung oder eine zusätzliche Tarifstelle beabsichtigt war, ist aus der Primärquelle nicht eindeutig bestimmbar.
- Problem: Fassungsfolge ist nicht vollständig oder besitzt lückenhafte Intervalle.
- Nächster Schritt: Quellenkonflikt fachlich klären; bis dahin keine Konsolidierung.

## Nicht als Zielnorm behandelte Vorlagen

- staatsvertrag-zur-anderung-des-staatsvertrages-uber-den-nord-122dpnt: unausgefüllte Mustergesetz-Vorlage ist keine Zielnorm

## Redaktionell zu prüfende Erkennungsfunde

- `erlass-lehrplan-geschichte-2026`: „Lehrplans Polytechnische Oberschule – Geschichte“ (Gliederungsüberschrift)
- `erlass-lehrplan-geschichte-2026`: „Lehrplans Erweiterte Oberschule – Geschichte“ (Gliederungsüberschrift)
- `organisationserlass-aenderung-fachbereichszuteilung-2024`: „Fachbereichszuteilungen“ (Gliederungsüberschrift)
- `sachsisches-verwaltungsorganisationsgesetz`: „Geschäftsbereiche der Staatsministerien und Umbenennung oder Zusammenlegung von Staatsbehörden“ (Gliederungsüberschrift)
