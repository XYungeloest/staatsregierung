# AGENTS.md für den internen Wissenshub

Diese Regeln gelten für Arbeiten unter `knowledge/`.

## Gesetzgebungs- und politische Zukunftsfragen

Bei Fragen nach geplanten Gesetzen, noch nicht umgesetzten politischen Vorhaben, der nächsten Wahlperiode oder dem Regierungsprogramm des Roten Aufbruchs zuerst `agenda.json` lesen.

`agenda.json` ist die kanonische interne Planungsübersicht. `AGENDA.md` ist die kompakte, menschlich lesbare Arbeitsansicht derselben Themen. Bei Abweichungen ist `agenda.json` maßgeblich.

Bei Fragen, welche Verordnungen, Verwaltungsvorschriften, Satzungen, Errichtungsakte, Bestellungen oder Berichte das geltende Recht noch verlangt, zuerst `implementation-mandates.json` lesen (Arbeitsansicht `VOLLZUGSAUFTRAEGE.md`). Einträge mit `duplicateOf` nicht doppelt zählen; `nicht-pruefbar` heißt nicht unerfüllt.

Die Agenda ist ausdrücklich **kein Rechtsbestand**. Für die geltende Rechtslage anschließend `current-state.json`, `projects.json`, `proceedings.json`, `content/normen/` und `content/verkuendungen/` heranziehen.

Vor einem neuen Gesetzesentwurf immer prüfen, ob das Vorhaben bereits ganz oder teilweise verkündet ist oder ob bereits eine einschlägige Stammnorm existiert. Bereits geltende Normen nicht als offene Gesetzesideen behandeln. Westdeutsches oder sächsisches Vergleichsrecht nicht ohne ausdrückliche ostdeutsche Festlegung als Agenda-Vorhaben übernehmen.

## Wahlkontext 2026

Zur Wahl zur 8. Ostdeutschen Volkskammer am 5. und 6. September 2026 treten Volksfront und Bündnis Demokratie Europa (DEMOS) gemeinsam auf der Wahlliste **Roter Aufbruch (RA)** an. Die Parteien behalten ihre eigenständigen politischen Identitäten; RA ist in diesem Kontext als gemeinsame Wahlliste zu behandeln und nicht als automatische dauerhafte Umbenennung beider Parteien.

Der vollständige Programmtext liegt unter `../context/programme/roter-aufbruch-2026/regierungsprogramm-roter-aufbruch-2026.md`; die redaktionelle Erschließung unter `../context/programme/roter-aufbruch-2026/README.md`. Die gegen den Rechtsbestand bereinigte strukturierte Vorhabenliste steht in `agenda.json`, die Arbeitsübersicht in `AGENDA.md`.

## Politische Grundlinien und Reaktionsfragen

Bei außen-, friedens- und sicherheitspolitischen Reaktionsfragen zuerst `POLITISCHE_GRUNDLINIEN.md` lesen. Das gilt insbesondere für Russland, NATO und USA, den Ukrainekrieg, hybride Bedrohungen, militärische Nutzung ziviler Infrastruktur, Aufrüstung und Militarisierung, Zivil- und Katastrophenschutz sowie politische Bezugnahmen auf Einigungsvertrag und Zwei-plus-Vier-Vertrag.

Die dort festgehaltenen Aussagen sind redaktionell bestätigte politische Leitlinien und **kein geltendes Recht**. Bei konkreten Ereignissen sind Tatsachenlage, Attribution und aktuelle Rechtslage gesondert zu prüfen. Eine politische Bezugnahme auf die Friedensordnung der deutschen Einheit darf insbesondere nicht als nicht bestehende allgemeine Neutralitätspflicht Deutschlands oder Ostdeutschlands dargestellt werden.

### Konkreter Fall Leipzig/Halle im September 2026

Bei Fragen zum Drohnenvorfall am Flughafen Leipzig/Halle, zu den Ermittlungen gegen DJZ, NRJ und Chemnitz Revolte, zu möglichen rechtsextremen beziehungsweise ausländischen Bezügen, zur Zuständigkeit von ZESA und PTAZ oder zur Auseinandersetzung mit der Bundesregierung über die Russland-Attribution zusätzlich `clarifications/2026-09-14-leipzig-halle-drohnenfall.md` lesen.

Dabei strikt zwischen gesicherten Tatsachen, bloßen Ermittlungsansätzen und politischer Bewertung unterscheiden. Das auffällige Russland-Reisemuster eines Beschuldigten ist nach aktuellem Stand ein interner Ermittlungsansatz und **kein Beweis** für Tatbeteiligung oder russische staatliche Steuerung. Dieser Hinweis soll nicht automatisch in öffentliche Formulierungen übernommen werden.

Ebenso soll die fortbestehende Zuständigkeit ostdeutscher Ermittlungsbehörden nicht ohne konkreten Anlass zu einer öffentlichen Kompetenzdebatte mit dem Bund zugespitzt werden. Für öffentliche Kommunikation ist der Grundsatz maßgeblich: **Erst aufklären, dann bewerten.**

## Fortschreibung

Wenn ein Agenda-Vorhaben in ein förmliches Verfahren übergeht, den konkreten Vorgang in `proceedings.json` ergänzen. Nach Verkündung bestimmt der Normbestand den Rechtsstatus. In der Agenda bleiben dann nur noch nicht erledigte Folge- oder Ausbauziele stehen.
