# Sicherheitsmeldungen

## Geltungsbereich

Sicherheitsmeldungen können das Staatsportal unter `freistaat-ostdeutschland.de`, OstRecht unter
`recht.freistaat-ostdeutschland.de` sowie deren Quellcode, Importwerkzeuge und Deployment betreffen.
Sicherheitskorrekturen werden für den aktuellen Stand auf `main` und die daraus betriebenen
Anwendungen gepflegt. Ältere Commits erhalten keine eigene Sicherheitswartung.

## Vertraulich melden

Sende Hinweise an
[portalbetrieb@freistaat-ostdeutschland.de](mailto:portalbetrieb@freistaat-ostdeutschland.de),
möglichst mit dem Betreff „Sicherheitsmeldung Staatsportal/OstRecht“.
Veröffentliche noch nicht behobene Schwachstellen, Zugangsdaten und personenbezogene Daten nicht
in Issues oder Pull Requests.

Hilfreich sind:

- Name der betroffenen Ansicht, öffentliche URL, Komponente oder Commit-Kennung;
- erwartetes und beobachtetes Verhalten sowie eine Einschätzung der Auswirkungen;
- möglichst kleine, nachvollziehbare Schritte zur Reproduktion;
- bereinigte Belege ohne Zugangsdaten oder personenbezogene Daten.

Prüfe nach Möglichkeit lokal mit synthetischen Daten. Greife nicht auf fremde Daten zu,
verändere oder lösche keine produktiven Daten und führe keine Lasttests gegen die öffentlichen
Anwendungen durch. Wenn du versehentlich sensible Daten siehst, beende den Zugriff und melde den
Umstand ohne die Daten weiterzuverbreiten.

## Bearbeitung

Die Repository-Verwaltung prüft die Meldung, klärt Rückfragen und stimmt eine mögliche
Veröffentlichung mit der meldenden Person ab. Es gibt keine zugesicherte Reaktionsfrist und kein
Bug-Bounty-Programm. Allgemeine Fehler und Inhaltskorrekturen gehören in die
[Issue-Vorlagen](https://github.com/XYungeloest/staatsregierung/issues/new/choose).
