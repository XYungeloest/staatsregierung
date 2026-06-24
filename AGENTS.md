# AGENTS.md

## Grundregel

Dieses Repository ist das Portal einer fiktiven Staatsregierung mit integriertem Rechtsbereich. Die öffentliche Website soll wie eine sachliche Regierungswebsite wirken, nicht wie eine Entwicklerdemo.

Prioritäten:

1. Öffentliches Portal behördennah, ruhig und verständlich halten.
2. Rechtsportal unter `/recht/` funktional erhalten.
3. Inhalte möglichst dateibasiert und nachvollziehbar pflegen.
4. Cloudflare-Deploymentlogik respektieren.
5. Keine unnötige neue Architektur oder Bibliothek einführen.
6. Änderungen klein, überprüfbar und passend zum vorhandenen Stil halten.

## Dokumentationsstand

Primäre Projektdokumentation ist jetzt:

- `README.md`
- `AGENTS.md`
- `CONTENT.md`
- `DESIGN.md`
- der tatsächliche Code- und Content-Zustand
- `context/` als erhaltenes Ausgangs- und Simulationsmaterial

Alte Root-Spezifikationen und Zwischenpläne sind nicht mehr kanonisch.

## Arbeitsweise

- Bei Review- oder Planungsfragen zuerst den tatsächlichen Repo-Zustand lesen.
- Ist-Zustand und gewünschte Weiterentwicklung klar trennen.
- Bei Strukturfragen konservativ an bestehenden Routen, Komponenten und Content-Modellen orientieren.
- Keine großen Refactorings starten, wenn eine direkte, robuste Änderung reicht.
- Nicht verwandte Änderungen im Working Tree nicht zurücksetzen.
- Neue zentrale Entscheidungen knapp in `README.md` oder hier dokumentieren.

## Technik

- Astro
- TypeScript
- Cloudflare Workers
- keine aktiven D1/R2-Bindings im aktuellen Portalstand
- klare Utility-Funktionen statt unnötiger Klassenhierarchien
- Build- und Content-Checks vor Abschluss ausführen, sofern möglich

Wichtige Befehle:

```sh
npm run content:check
npm run check
npm run build
npm run links:check
npm run test:visual
npm run test:a11y
```

## Inhalt und Redaktion

- Deutschsprachige Inhalte mit echten Umlauten.
- Öffentliche Seiten verwenden nutzerorientierte Sprache.
- Architekturbegriffe wie D1, R2, Build, Repository, Fallback, Live-Override oder serverseitige Formularlogik gehören nicht in öffentliche Bürgertexte.
- Öffentliche Texte erklären weder Gestaltung noch Umsetzung der Website. Formulierungen über Platzhalter, Designabsichten, technische Zustände oder die eigene Seitenstruktur vermeiden.
- Geschlechtergerechte Personenbezeichnungen einheitlich mit Doppelpunkt schreiben, zum Beispiel `Bürger:innen` oder `Referent:in`. Keine Paarformen, Sterne, Binnen-I oder Unterstriche verwenden.
- Der Hinweis auf die politische Simulation bleibt sichtbar in der oberen Hinweisleiste und im Footer. Außerhalb dieser festen Hinweise bleiben öffentliche Texte frei von Wiederholungen; das Impressum enthält die erforderliche ausführliche Einordnung des fiktiven Internetangebots.
- Der redaktionelle Stichtag für aktuelle Termine und Stellenangebote ist der 24. Juni 2026. Künftige Termine stehen vor vergangenen; abgelaufene Bewerbungsfristen erscheinen nicht als aktuelle Angebote.
- Operative technische Begriffe sind in interner Doku und Code zulässig.
- Gerhardt Lehrmann ist kein aktives Kabinettsmitglied. Das Wirtschaftsressort wird im aktuellen Kabinett Honecker II von Staatsminister Max Peterson geleitet.
- Kein neues Profil für Gerhardt Lehrmann anlegen.

## Rechtsportal

Normen liegen unter:

```text
content/normen/[slug]/
  meta.json
  history.json
  versions/[versionId].json
```

Historische Fassungen sind gespeicherte Fassungen, keine automatisch berechneten Konsolidierungen.

Verkündungen liegen unter:

```text
content/verkuendungen/[slug].json
```

Sie verknüpfen Fundstellen über `entries[].normSlug` und `entries[].versionId` mit gespeicherten
Normfassungen. Norm-JSONs bleiben dadurch unabhängig von später gepflegten Amtsblatt-Ausgaben.

## UI-Stil

- nüchtern
- behördennah
- gut lesbar
- barrierearm
- Jost als Schrift
- ruhige Blau-Weiß-Grün-Anmutung
- Inhaltsklarheit vor Effekten
- Startseiteninhalte klar priorisieren: Einstieg, zentrale Portalpfade, aktueller Regierungsstand, Reformen, Recht sowie Presse und Service.
- Die Kreisreform ist ein zentraler Portalweg unter `/kreisreform/`, in der Hauptnavigation, auf der Startseite und in den Themen-Einstiegen sichtbar.
- Interaktive Karten, Tabellen und Filter müssen auf kleinen Bildschirmen ohne unkontrolliertes horizontales Scrollen nutzbar bleiben.
- Die Kreisreform-Suche muss ohne geöffnete Karte ein textliches Ergebnis liefern; die Karte startet
  auf kleinen Bildschirmen nur nach ausdrücklichem Öffnen.
- Statistik bleibt freiwillig: Nur notwendige Funktionen sind Standard, Webanalyse startet erst nach ausdrücklicher Zustimmung.
- Screenshot-Baselines und Accessibility-Smoke-Tests sind Teil der Produktions-QA. Sie ergänzen
  den manuellen Tastatur- und Screenreader-Kurztest.

## Bei Unsicherheit

Den vorhandenen Code, `README.md`, `AGENTS.md` und `context/` heranziehen. Wenn mehrere Wege möglich sind, die einfache, robuste und am wenigsten invasive Lösung wählen.
