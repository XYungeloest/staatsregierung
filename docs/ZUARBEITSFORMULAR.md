# Zuarbeitsformular für offene Portalaufgaben

**Stand:** 14. August 2026

Dieses Formular bündelt ausschließlich Zuarbeiten, Entscheidungen und externe Einstellungen, die
nicht allein aus dem Repository erledigt werden können. Der verbindliche Aufgabenstatus bleibt im
zentralen TODO der `README.md`; dieses Dokument ist keine zweite Aufgabenliste.

Du musst nicht alles auf einmal ausfüllen. Eine Antwort kann sich auf einzelne Kennungen wie
`Q-03` oder `V-04` beschränken. Nicht vorhandene Unterlagen bitte ausdrücklich als „nicht
vorhanden“ kennzeichnen, damit nicht weiter danach gesucht wird.

## Sichere Übergabe

- Quelldateien unverändert unter `/temp-neu` ablegen oder als Anhang bereitstellen.
- Zu jeder Datei möglichst den unten stehenden Quellenbegleitzettel ausfüllen.
- Private Schlüssel, API-Tokens, Passwörter und Session-Cookies niemals in dieses Formular, einen
  Chat, Git, einen Pull Request oder `/temp-neu` schreiben. Solche Werte ausschließlich direkt als
  GitHub- oder Cloudflare-Secret hinterlegen.
- Bei externen Kontoeinstellungen genügt eine Bestätigung mit Datum und, sofern unkritisch, ein
  Screenshot ohne geheime Werte.
- Eine persönliche Erinnerung oder Einordnung ist hilfreiches Gesprächswissen, ersetzt aber keine
  Primärquelle. Bitte entsprechend als „redaktionelle Auskunft“ kennzeichnen.

## Schnellübersicht

| Bereich | Was von dir benötigt wird | Dringlichkeit |
| --- | --- | --- |
| `B-01` bis `B-06` | Cloudflare-/GitHub-Einstellungen, berechtigte Testkonten und praktische Abnahme | hoch, sobald Studio und Vorschauen produktiv genutzt werden sollen |
| `M-01` bis `M-05` | Auftrag, Budget, Rechteprozess und Pilotmaterial für die Sitzungsmediathek | vor Beginn der Implementierung |
| `Q-01` bis `Q-07` | Rechts-, Verkündungs- und Parlamentsquellen oder Freigabe des amtlichen Abrufs | teils hoch |
| `V-01` bis `V-08` | neue amtliche Unterlagen und Vollzugsbelege zu aktuellen Vorhaben | sobald vorhanden |
| `H-01` bis `H-07` | historische Verfahrens-, Ernennungs- und Regierungsakten | mittel; öffentlich meist nicht zeitkritisch |
| `A-01` | dokumentierter manueller Tastatur- und Screenreader-Kurztest | vor größeren Produktionsfreigaben |

## Allgemeiner Antwortkopf

**Ausgefüllt von:**  
**Datum:**  
**Behandelte Kennungen:**  
**Dateien liegen unter:**  
**Allgemeine Hinweise:**  

Antwortstatus je Punkt:

- [ ] bereitgestellt oder entschieden
- [ ] teilweise bereitgestellt; Ergänzung folgt
- [ ] derzeit nicht vorhanden
- [ ] Vorgang hat nach meiner Kenntnis nie stattgefunden
- [ ] soll vorerst nicht weiterverfolgt werden

---

## B. Betrieb, Redaktionsstudio und Vorschauen

### B-01 – Cloudflare-Webanalyse und Einwilligung

Benötigt wird eine Kontrolle im Cloudflare-Dashboard, ob automatische Webanalyse oder andere nicht
notwendige Messdienste für die Produktionsdomain aktiv sind.

**Bitte eintragen:**

**Geprüfte Zone/Domain:**  
**Prüfdatum:**  
**Cloudflare Web Analytics aktiv:** ja / nein / unklar  
**Andere automatische Analyse aktiv:** ja / nein / unklar  
**Falls aktiv, genaue Funktion:**  
**Soll sie deaktiviert werden:** ja / nein / Entscheidung offen  
**Nachweis ohne Geheimnisse, z. B. Screenshot-Dateiname:**  

### B-02 – GitHub App für das Redaktionsstudio

Die App muss für genau dieses Repository angelegt und installiert sein. Erforderlich sind `Contents:
read/write`, `Pull requests: read/write` und `Metadata: read-only`.

**Bitte nur bestätigen, keine Schlüssel einfügen:**

- [ ] GitHub App angelegt
- [ ] auf `XYungeloest/staatsregierung` installiert
- [ ] Berechtigungen wie oben gesetzt
- [ ] `GITHUB_APP_ID` als Worker-Secret gesetzt
- [ ] `GITHUB_APP_INSTALLATION_ID` als Worker-Secret gesetzt
- [ ] `GITHUB_APP_PRIVATE_KEY` als Worker-Secret gesetzt
- [ ] `GITHUB_OWNER` und `GITHUB_REPOSITORY` als Worker-Secrets gesetzt

**App-Name, sofern öffentlich/unbedenklich:**  
**Einrichtungsdatum:**  
**Abweichungen oder Fehler:**  

### B-03 – Cloudflare Access und produktive Studio-Route

**Bitte eintragen:**

**Gewünschte produktive Studio-URL:**  
**Berechtigte Gruppe oder Personenkreis:**  
**Cloudflare-Access-Anwendung angelegt:** ja / nein  
**Allow-Policy eingerichtet:** ja / nein  
**`CF_ACCESS_TEAM_DOMAIN` als Worker-Secret gesetzt:** ja / nein  
**`CF_ACCESS_AUD` als Worker-Secret gesetzt:** ja / nein  
**Worker-Route passt zur verwalteten Zone:** ja / nein / unklar  
**Wer kann den berechtigten Test durchführen:**  
**Wer kann den unberechtigten Test durchführen:**  

Keine Zugangsdaten der Testkonten übermitteln. Es genügt, wenn die jeweilige Person den Test selbst
durchführt oder eine bereits bestehende angemeldete Sitzung im Browser verwendet.

### B-04 – Geschützte Pull-Request-Vorschauen

- [ ] Repositoryvariable `CLOUDFLARE_PREVIEWS_ENABLED=true` gesetzt
- [ ] Repository-Secret `CLOUDFLARE_API_TOKEN` gesetzt
- [ ] Repository-Secret `CLOUDFLARE_ACCOUNT_ID` gesetzt
- [ ] Token darf Worker-Versionen hochladen
- [ ] Token darf die zu einem PR gehörenden Worker-Versionen wieder löschen
- [ ] Alias-Preview-Domain durch Cloudflare Access geschützt
- [ ] Versions-Preview-Domain durch Cloudflare Access geschützt

**Erster Test-PR beziehungsweise gewünschter Testzeitpunkt:**  
**Ermittelte Preview-Domains:**  
**Erwartete zugelassene Gruppe:**  
**Besondere Einschränkungen:**  

### B-05 – Fachliche Abnahme des erweiterten Themenformulars

Bitte das Studio mit einem Testthema prüfen und die gewünschte Bedienung festlegen.

**Testthema:**  
**Termine sollen gepflegt werden als:** einzelne Formularzeilen / Kalenderansicht / andere Form  
**Module sollen gepflegt werden als:** auswählbare Bausteine / geführte Formulare je Modultyp / andere Form  
**Reihenfolge von Modulen änderbar per:** Schaltflächen / Drag-and-drop plus Tastaturalternative / egal  
**Sind Priorität und Highlight-Zeitraum verständlich:** ja / nein, Änderungsvorschlag  
**Sind verwandte Themen verständlich:** ja / nein, Änderungsvorschlag  
**Sind Wissensprojekt-Verknüpfungen verständlich:** ja / nein, Änderungsvorschlag  
**Welche Roh-JSON-Felder sind im Test noch sichtbar oder unverständlich:**  
**Weitere Änderungswünsche:**  

### B-06 – Vollständiger Studio-Testvorgang

**Testredakteur:in:**  
**Gewählter Testinhalt:**  
**Darf ein echter Draft-PR erzeugt werden:** ja / nein  
**Darf ein absichtlicher SHA-Konflikt simuliert werden:** ja / nein  
**Wer übernimmt das fachliche Review:**  
**Gewünschtes Testfenster:**  

---

## M. Sitzungsmediathek der Volkskammer

Ohne `M-01` bis `M-04` wird keine Medienarchitektur produktiv eingeführt. Livestreaming ist nicht
Teil des ersten Ausbaus, sofern hier nichts anderes ausdrücklich als späterer Auftrag festgelegt
wird.

### M-01 – Auftrag und redaktionelle Verantwortung

**Fachlich verantwortliche Stelle:**  
**Technisch verantwortliche Stelle:**  
**Dauerhaft zuständige Redaktion:**  
**Veröffentlicht werden:** nur öffentliche Sitzungen / nur öffentliche Sitzungsteile / andere  
**Nichtöffentliche Teile werden vor Übergabe bereits entfernt:** ja / nein  
**Mediathek soll in die Hauptnavigation:** ja / nein / erst nach Pilot entscheiden  
**Livestreaming:** nicht vorgesehen / später gesondert prüfen  

### M-02 – Formate, Umfang und Nutzung

**Gewünschte Medien:** Video / Audio / beides  
**Video-Eingangsformate:**  
**Audio-Eingangsformate:**  
**Download anbieten:** Video / Audio / beides / keinen Download  
**Typische Sitzungsdauer:**  
**Längste erwartete Sitzung:**  
**Erwartete Sitzungen pro Jahr:**  
**Geschätzte gleichzeitige Abrufe:**  
**Gewünschte Aufbewahrungsdauer:** dauerhaft / Anzahl Jahre / andere Regel  
**Müssen Originaldateien intern erhalten bleiben:** ja / nein / Frist  

### M-03 – Anbieter, Kosten und technische Grenzen

**Cloudflare Stream darf geprüft/genutzt werden:** ja / nein  
**Cloudflare R2 darf für Audio und freigegebene Downloads geprüft/genutzt werden:** ja / nein  
**Externe Videoplattformen, die zulässig oder ausgeschlossen sind:**  
**Monatliches Zielbudget:**  
**Harte monatliche Kostengrenze:**  
**Warnschwellen, z. B. 50/75/90 Prozent:**  
**Vorgaben zu Datenstandort oder Auftragsverarbeitung:**  
**Darf der Medienanbieter technisch notwendige Abrufdaten verarbeiten:** ja / nein / rechtlich prüfen  

### M-04 – Freigabe, Rechte, Barrierefreiheit und Löschung

**Wer bestätigt die Öffentlichkeit und Rechte einer Aufnahme:**  
**Wer prüft Untertitel und Transkript:**  
**Deutschsprachige WebVTT-Untertitel sind Pflicht:** ja / nein  
**Vollständiges Transkript ist Pflicht für:** Video / Audio / beides  
**Audiodeskription beziehungsweise Beschreibung visueller Informationen:** immer / bei Bedarf / offen  
**Wer entscheidet über Korrektur oder Depublikation:**  
**Kontaktweg für Beanstandungen:**  
**Reaktionsfrist bei Beanstandungen:**  
**Wann darf endgültig gelöscht werden:**  
**Wie lange müssen Freigabe- und Löschprotokolle erhalten bleiben:**  

### M-05 – Pilotpaket für eine öffentliche Sitzung

Bitte für genau eine längere öffentliche Sitzung bereitstellen:

- [ ] vollständige Video- und/oder Audio-Originaldatei
- [ ] Sitzungsnummer, Wahlperiode, Titel, Datum, Beginn, Ende und Ort
- [ ] öffentliche Tagesordnung
- [ ] Kapitel und Zeitmarken, sofern vorhanden
- [ ] zugehörige Drucksachen, Normen und Beschlüsse
- [ ] freigegebenes Vorschaubild mit Bildnachweis
- [ ] geprüfte Untertiteldatei im WebVTT-Format
- [ ] vollständiges Transkript mit Sprecher:innenkennzeichnung
- [ ] dokumentierte Veröffentlichungs- und Rechtefreigabe
- [ ] Angaben zu nichtöffentlichen oder zu entfernenden Passagen

**Dateinamen/Ordner:**  
**Besondere Wiedergabe- oder Datenschutzanforderungen:**  

---

## Q. Rechtsportal, Verkündungen und parlamentarische Quellen

### Q-01 – Amtliche REVOSax-Ausgangsfassungen für 34 Zielnormen

Bitte genau eine Vorgehensweise wählen:

- [ ] Die amtlichen historischen Fassungen und URLs werden von mir bereitgestellt.
- [ ] Der gezielte, unveränderte Abruf der amtlichen REVOSax-Fassungen zum 1. November 2023 wird
      hiermit für die im Anhang genannten 34 Normen freigegeben.
- [ ] Zunächst nur Kulturraumgesetz und Ostdeutsches Polizeibehördengesetz bearbeiten.
- [ ] Andere Priorisierung, nämlich:  

Bei eigener Bereitstellung je Norm benötigt: amtliche URL, Law-ID soweit vorhanden,
Gültigkeitszeitraum, HTML/PDF im Original und Hinweis, dass die Fassung am 1. November 2023 galt.

### Q-02 – Verwaltungsabkommen zur Kasernierten Grenzpolizei

Benötigt wird eine amtliche Berichtigung, Ergänzung oder Bekanntmachung, die das Inkrafttreten
beziehungsweise die Wirksamkeit ausdrücklich nennt.

**Datei oder amtliche URL:**  
**Herausgeber:**  
**Datum und Fundstelle:**  
**Genannter Wirksamkeitstag:**  
**Falls keine solche Quelle existiert:** ausdrücklich bestätigen  

### Q-03 – Plenarsitzung vom 20. Juli 2026

- [ ] vollständiges Plenarprotokoll
- [ ] Abstimmungslisten
- [ ] Beschlussempfehlung 07/18
- [ ] Beschlussempfehlung 07/19
- [ ] Beschlussempfehlung 07/20
- [ ] Beschlussempfehlung 07/21
- [ ] Änderungsanträge oder sonstige Beratungsunterlagen

**Dateien/Ordner:**  
**Sind die Unterlagen vollständig:**  

### Q-04 – Hoheitszeichen

- [ ] besonderes Hoheitszeichengesetz
- [ ] geltende Verordnung
- [ ] sämtliche Anlagen
- [ ] verbindliche Wappenbeschreibung
- [ ] amtliche Flaggen- und Wappengrafiken, falls Teil der Anlagen
- [ ] spätere Änderungen oder Berichtigungen

**Welcher Stand soll nach deiner Kenntnis gelten:**  
**Dateien/amtliche URLs:**  

### Q-05 – Feiertagsrecht

Benötigt werden Feiertagsgesetz und sämtliche einschlägigen Änderungsgesetze einschließlich
Verkündung und Inkrafttretensregeln.

**Dateien/amtliche URLs:**  
**Welche Feiertage sind nach deiner Kenntnis neu, aufgehoben oder umbenannt:**  
**Ab welchem Datum jeweils:**  

### Q-06 – Organisationserlasse 09/2025 und 12/2025

Benötigt werden Aufhebungs-, Ablösungs- oder Überleitungsquellen.

**Quelle zum Ende/Übergang von 09/2025:**  
**Quelle zum Ende/Übergang von 12/2025:**  
**Soll 12/2025 in Teilen fortgelten; wenn ja, welche:**  
**Dateien/amtliche URLs:**  

### Q-07 – NDR-Mustergesetz

Der NDR-Änderungs- und Überleitungsstaatsvertrag enthält nur die unausgefüllte Angabe
„Mustergesetz vom TT. MMMM JJJJ“.

**Wurde ein konkretes Mustergesetz beschlossen/verkündet:** ja / nein / unbekannt  
**Titel, Datum und Fundstelle:**  
**Vollständige Quelle:**  

---

## V. Aktuelle Vorhaben und Vollzugsbelege

### V-01 – Volksbefragung und Wahl zur achten Volkskammer

Diese Unterlagen bitte erst nach tatsächlicher Veröffentlichung bereitstellen:

- [ ] vollständige Befragungsunterlagen ab 22. August 2026
- [ ] endgültige Wahl- und Abstimmungsbekanntmachungen
- [ ] Nachweis der Durchführung am 5. und 6. September 2026
- [ ] amtliche Ergebnisbekanntmachung der Volksbefragung
- [ ] amtliches Wahlergebnis
- [ ] spätere politische oder rechtliche Folgebeschlüsse

**Dateien/amtliche URLs:**  
**Veröffentlichungsdatum:**  

### V-02 – Boom Europe Leipzig/Halle

Benötigt wird zusätzlich zum bereits wirksamen Agreement ein Vollzugsnachweis.

**Projektorganisation/Betreibergesellschaft:**  
**Bau- oder Standortfreigabe:**  
**Baubeginn:**  
**Betriebs- oder Standorteröffnung:**  
**Dateien/amtliche Mitteilungen:**  

### V-03 – OVV-Ticketanerkennung und Fernverkehr

**Vertrag/Tarifnachweis zur 57-Millionen-Euro-Ticketanerkennung:**  
**Beginn der Anerkennung:**  
**Geltende Tarifbedingungen und Ausschlüsse:**  
**Bestellte oder tatsächlich aufgenommene Fernverkehrsrelationen:**  
**Fahrplan- oder Betriebsnachweis je Relation:**  

Bloße Ticketanerkennung bitte nicht als Nachweis einer Streckenreaktivierung verwenden.

### V-04 – Volksacker, Flächenfonds und Bodenfonds Ost

Für jedes der drei Vorhaben getrennt eintragen:

| Vorhaben | Status | Gesetz/Errichtungsakt | Haushaltsansatz | praktischer Vollzug |
| --- | --- | --- | --- | --- |
| Volksacker |  |  |  |  |
| Flächenfonds |  |  |  |  |
| Bodenfonds Ost |  |  |  |  |

**Dateien/amtliche URLs:**  

### V-05 – Beschaffungen und Unternehmensentscheidungen

| Vorhaben | Was noch benötigt wird | Datei oder Nachweis |
| --- | --- | --- |
| E-Jura-System | Zuschlagsempfänger, Vertrag, Abnahme, Lieferung und Betriebsaufnahme |  |
| vier Hovercrafts | Auslieferung, Abnahme und tatsächlicher Einsatz; der Preis von 30 Mio. Euro ist bereits geklärt |  |
| NVIDIA-Ansiedlung | Standort, Genehmigung, Bau, Eröffnung oder Betriebsaufnahme |  |
| erster Zeppelin NT | Lieferung, Zulassung und tatsächlicher Betrieb |  |
| Luxemburg-Liebknecht-Denkmal | Fertigstellung, Abnahme und Eröffnung |  |

### V-06 – Beendigung der Kooperationen mit Israel

**Ursprünglicher Regierungsbeschluss oder gleichwertige Primärquelle:**  
**Datum:**  
**Genau betroffene Kooperationen:**  
**Ausnahmen oder spätere Änderungen:**  

### V-07 – Transparenz- und Informationsfreiheitsrecht

| Angebot | umgesetzt | öffentliche URL | zuständige Stelle | Datenpflege/Betrieb belegt durch |
| --- | --- | --- | --- | --- |
| Transparenzportal | ja / nein / geplant / verworfen |  |  |  |
| Zuständigkeitsfinder | ja / nein / geplant / verworfen |  |  |  |
| Haushaltsnavigator | ja / nein / geplant / verworfen |  |  |  |

**Weitere praktische Umsetzungsnachweise:**  

### V-08 – Weitere offene EAG-Vollzugsfragen

| Vorgang | benötigter Beleg | Datei oder Angabe |
| --- | --- | --- |
| erhöhter Personenschutz | Enddatum, Verlängerung oder fortbestehende Anordnung |  |
| Norwegenreise des Staatspräsidenten | amtlicher Reisebericht oder Durchführungsnachweis |  |
| Verkehrsverfahren Ohlinger | Bescheid beziehungsweise genauer Erledigungsausgang |  |
| Israel-Kooperationen | ursprünglicher Regierungsakt; siehe auch `V-06` |  |

---

## H. Politische Geschichte und historische Ämter

### H-01 – Bundesratszugangsstreit

- [ ] Klage oder Antrag
- [ ] Antrag/Entscheidung im einstweiligen Rechtsschutz
- [ ] Urteil, Beschluss oder sonstige Erledigung
- [ ] amtliche Bundesratsdokumente

**Aktenzeichen, nur wenn aus Quelle belegt:**  
**Dateien/amtliche URLs:**  

### H-02 – Präsidentenanklage gegen Manuela Dreyer

- [ ] Antrag oder Anklageschrift
- [ ] Rücktrittsschreiben
- [ ] Bundestagsbeschluss
- [ ] gerichtlicher Einstellungs-/Erledigungsbeschluss
- [ ] sonstige amtliche Abschlussmitteilung

**Wie endete das Verfahren laut Quelle:**  
**Dateien/amtliche URLs:**  

### H-03 – Bundespräsidentenvertretung Karl Honeckers

- [ ] konkrete Ausfertigungen und Einzelakte
- [ ] Ernennungs- oder Entlassungsurkunden
- [ ] Nachweis über Beginn und Ende der Vertretung
- [ ] Nachweis über Amtsantritt der Nachfolgeperson

**Dateien/amtliche URLs:**  

### H-04 – Staatskrise und Regierungswechsel 2025

- [ ] Rücktrittserklärung Tom Kurzschlusses
- [ ] Unterlagen zu Misstrauensvoten
- [ ] Wahlunterlagen Mateo Delgados
- [ ] Ernennungs- und Entlassungsakte
- [ ] datierter Wendepunkt-Artikel oder andere historische Primärquelle

**Kurze Einordnung der Übergangsfolge:**  
**Dateien/URLs:**  

### H-05 – Ende der Bevollmächtigtenämter Weselsky und Gysi

**Claus Weselsky:** Abberufungsurkunde / Überleitung / Organisationserlass / aktueller Nachweis  
**Gregor Gysi:** Abberufungsurkunde / Überleitung / Organisationserlass / aktueller Nachweis  
**Falls kein formaler Beendigungsakt existiert, bitte ausdrücklich angeben:**  

### H-06 – Historische Rolle Gerhardt Lehrmanns

**Amt/Funktion:**  
**Institution:**  
**Beginn und Ende:**  
**Ernennungs-, Kabinetts- oder Entlassungsnachweis:**  

Ohne Primärquelle wird weiterhin kein aktuelles öffentliches Profil angelegt.

### H-07 – Weitere politische Chronologie vor Dezember 2025

Bitte nur Punkte ausfüllen, für die datierte Quellen vorhanden sind:

**Frühere Regierungen und Wahlperioden:**  
**Partei- und Fraktionswechsel:**  
**Misstrauensvoten:**  
**Belegte Biografie Karl Honeckers:**  
**Namensgeschichte von DEMOS:**  
**Sonstige bislang unbestimmte Personen oder Verfahren:**  
**Dateien/URLs:**  

---

## A. Manuelle Abnahme

### A-01 – Tastatur- und Screenreader-Kurztest

**Testdatum:**  
**Betriebssystem:**  
**Browser und Version:**  
**Screenreader und Version:**  
**Getestete Routen:**  
**Nur Tastatur – Ergebnis:**  
**Überschriften/Landmarks – Ergebnis:**  
**Formularbeschriftungen und Fehlermeldungen – Ergebnis:**  
**Fokusreihenfolge und sichtbarer Fokus – Ergebnis:**  
**Mobile/Tablet/Desktop-Sichtprüfung – Ergebnis:**  
**Gefundene Probleme mit Route und genauer Stelle:**  

---

## Quellenbegleitzettel für jede bereitgestellte Datei

**Zugehörige Kennung(en), z. B. `Q-03`, `H-02`:**  
**Dateiname:**  
**Originaltitel:**  
**Herausgeber/ausstellende Stelle:**  
**Dokumentdatum:**  
**Veröffentlichungsdatum:**  
**Fundstelle oder amtliche URL:**  
**Seite/Abschnitt/Message-ID/Attachment:**  
**Welche konkrete Tatsache belegt die Quelle:**  
**Ist die Datei vollständig und unverändert:** ja / nein / unbekannt  
**Gibt es spätere Änderungen, Rücknahmen oder Berichtigungen:**  
**Zusätzliche Einordnung:**  

---

## Anhang: 34 noch fehlende REVOSax-Ausgangsfassungen

Für jede Norm wird die am 1. November 2023 geltende amtliche historische Fassung benötigt.

- [ ] Abschiebe-Aussetzungsverordnung
- [ ] Ausbildungs- und Prüfungsordnung für die Polizei
- [ ] Finanzausgleichsgesetz
- [ ] Gesetz über den Kulturpass für junge Erwachsene im Freistaat Ostdeutschland
- [ ] Gesetz über den öffentlichen Gesundheitsdienst
- [ ] Gesetz über die Beteiligtentransparenzdokumentation und das Lobbyregister beim Ostdeutschen Landtag
- [ ] Gesetz über die Hochschulen
- [ ] Gesetz über Kindertagesbetreuung
- [ ] Gesetz zu einer verpflichtenden Weidetier- und Herdenschutzversicherung
- [ ] Gesetz zur Durchführung des Medienstaatsvertrages und des Rundfunkbeitragsstaatsvertrages
- [ ] Gesetz zur Förderung der Gleichbehandlung und zum Schutz vor Diskriminierung im öffentlich-rechtlichen Handeln
- [ ] Kommunalwahlgesetz
- [ ] Kulturraumgesetz
- [ ] Landesbeamtengesetz
- [ ] Landesplanungsgesetz
- [ ] NDR-Staatsvertrag
- [ ] Ostdeutsche Arbeitszeitverordnung
- [ ] Ostdeutsches Justizgesetz
- [ ] Ostdeutsches Krankenhausgesetz
- [ ] Ostdeutsches Normenkontrollratsgesetz
- [ ] Ostdeutsches Personennahverkehrsgesetz
- [ ] Ostdeutsches Polizeibehördengesetz
- [ ] Sächsisches Bestattungsgesetz
- [ ] Sächsisches Gleichstellungsgesetz
- [ ] Schulgesetz
- [ ] Schulordnung Förderschulen
- [ ] Schulordnung Gemeinschaftsschulen
- [ ] Schulordnung Grundschulen
- [ ] Vermessungs- und Katastergesetz
- [ ] Verschlusssachenanweisung
- [ ] Verwaltungsorganisationsgesetz
- [ ] Waldgesetz
- [ ] Zehntes Ostdeutsches Kostenverzeichnis
- [ ] Zweckentfremdungsverbotsgesetz
