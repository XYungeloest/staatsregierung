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
```

## Inhalt und Redaktion

- Deutschsprachige Inhalte mit echten Umlauten.
- Öffentliche Seiten verwenden nutzerorientierte Sprache.
- Architekturbegriffe wie D1, R2, Build, Repository, Fallback, Live-Override oder serverseitige Formularlogik gehören nicht in öffentliche Bürgertexte.
- Operative technische Begriffe sind in interner Doku und Code zulässig.
- Gerhardt Lehrmann ist kein aktives Kabinettsmitglied. Das Wirtschaftsressort wird geschäftsführend von Ministerpräsident Dr. Karl Honecker geleitet.
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

## UI-Stil

- nüchtern
- behördennah
- gut lesbar
- barrierearm
- Jost als Schrift
- ruhige Blau-Weiß-Grün-Anmutung
- Inhaltsklarheit vor Effekten

## Bei Unsicherheit

Den vorhandenen Code, `README.md`, `AGENTS.md` und `context/` heranziehen. Wenn mehrere Wege möglich sind, die einfache, robuste und am wenigsten invasive Lösung wählen.
