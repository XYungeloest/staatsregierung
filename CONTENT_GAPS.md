# Offene Quellenfragen

**Repositoryprüfung:** 27. August 2026  
**Redaktioneller Stichtag:** 23. August 2026

Diese Datei enthält nur Quellenfragen, Konflikte und technische Quellenarbeiten, die im aktuellen
Repository noch tatsächlich relevant sind. Abgeschlossene Prüfungen und früher bestehende
Abweichungen werden hier nicht als Historie fortgeschrieben. Der maschinenlesbare Einzelstand der
Normkonsolidierung steht in `data/recht/consolidation-manifest.json`.

## Rechtskonsolidierung

- Für den **NDR-Staatsvertrag** fehlt weiterhin die vollständige maßgebliche Ausgangsfassung vor
  der Änderung vom 8. März 2026 einschließlich Anlagen. Ohne diese Primärquelle wird keine
  konsolidierte Stammfassung erzeugt.
- Bei **24 Zielnormen** ist der maßgebliche Ausgangssnapshot bereits bestimmt, der eigenständige
  historisierte Stammnormdatensatz aber noch anzulegen. Die jeweils betroffenen Normen und der
  nächste technische Schritt stehen im Konsolidierungsmanifest.
- **Zwei Zielnormen** besitzen noch unvollständige Platzhalterbestände. Auch hier ist der
  Einzelstatus im Konsolidierungsmanifest maßgeblich.
- Die Konsolidierung von **SOFS, BSO und BGySO** ist wegen nicht eindeutig auflösbarer
  Zieltextkonflikte gesperrt. Einzelne Änderungsbefehle der OGVBl. 2026 Nr. 64 und 67 passen nicht
  auf die nach der Quellenrichtlinie verbindlichen Ausgangsfassungen. Die amtlichen
  Änderungsvorschriften bleiben davon unberührt; eine scheinbar eindeutige Folgefassung darf nicht
  erzeugt werden.
- Die Anlage des NDR-Änderungs- und Überleitungsstaatsvertrags enthält lediglich die unausgefüllte
  Vorlage „Mustergesetz vom TT. MMMM JJJJ“. Offen ist, ob daneben ein konkretes Mustergesetz
  beschlossen oder verkündet wurde.

## Aktuelle Quellenkonflikte

- Artikel 121a der Staatsverfassung nennt für die Wahl zur achten Volkskammer weiterhin
  **„Ende August“**. Die Wahl ist dagegen verbindlich auf den **5. und 6. September 2026**
  festgelegt. Beide Angaben sind quellenmäßig belegt und dürfen nicht still harmonisiert werden.
- `OABl. 2025 Nr. 2` und `StAnzO. 2026 Nr. 2.html` betreffen dasselbe zugrunde liegende Dokument
  unter unterschiedlichen Bezeichnungen. Die technische Dokumentidentität ist noch
  zusammenzuführen. Dokumentkopf und internes Datum sind dabei kanonisch; abweichende Datei- und
  Datensatzbezeichnungen bleiben nur als Provenienz erhalten.

## Noch notwendige Quellenarbeit

- Für die weiterhin nur als Markdown vorliegenden Altquellen sind schrittweise strukturierte,
  redaktionell geprüfte HTML-Transkriptionen anzulegen. Bis dahin bleiben Legacy-Parser,
  PDF-Gegenprüfung und die vorhandenen Strukturfixtures erforderlich.
- Die im Konsolidierungsmanifest ausgewiesenen noch nicht vollständig historisierten
  REVOSax-Ausgangsfassungen sind mit Gültigkeitszeitraum und Snapshot zu sichern und anschließend
  über geprüfte Patch-Rezepte zu konsolidieren. Besonders relevant sind derzeit das
  Kulturraumgesetz und das Ostdeutsche Polizeibehördengesetz.

## Dauerhafte Quellenbegrenzung

Für die dritte Plenarsitzung vom 20. Juli 2026 liegt kein Plenarprotokoll mit Redebeiträgen,
Einzelabstimmungen und Stimmenzahlen vor. Die Verkündungen belegen Beschluss und Verkündung der
betroffenen Vorhaben, nicht aber den Beratungsverlauf oder konkrete Abstimmungszahlen. Solche
Details werden ohne zusätzliche Primärquelle nicht ergänzt.
