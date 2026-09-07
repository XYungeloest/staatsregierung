# Zuarbeitsformular für offene Portalaufgaben

Dieses Formular enthält ausschließlich Punkte, für die aktuell externe Unterlagen oder eine
inhaltliche Entscheidung benötigt werden. Offene technische Arbeiten stehen in `../TODO.md`,
offene Quellenfragen in `../CONTENT_GAPS.md`; der redaktionelle Stichtag steht zentral in
`../packages/shared/src/config/editorial.json`.

## Sichere Übergabe

- Quelldateien unverändert unter `/temp-neu` ablegen oder als Anhang bereitstellen.
- Private Schlüssel, API-Tokens, Passwörter und Session-Cookies nie hier, im Chat oder in Git
  eintragen. Solche Werte ausschließlich als GitHub- oder Cloudflare-Secret hinterlegen.
- Nicht vorhandene Unterlagen bitte ausdrücklich als „nicht vorhanden“ kennzeichnen.
- Eine redaktionelle Auskunft bitte als solche kennzeichnen; sie ersetzt keine Primärquelle.

## Antwortkopf

**Ausgefüllt von:**  
**Datum:**  
**Behandelte Kennungen:**  
**Dateien liegen unter:**  
**Allgemeine Hinweise:**

---

## M. Sitzungsmediathek der Volkskammer

Diese Angaben werden erst benötigt, wenn die Mediathek tatsächlich beauftragt werden soll.

### M-01 – Auftrag und Verantwortung

**Fachlich verantwortliche Stelle:**  
**Technisch verantwortliche Stelle:**  
**Dauerhaft zuständige Redaktion:**  
**Veröffentlicht werden:** nur öffentliche Sitzungen / nur öffentliche Sitzungsteile / andere  
**Nichtöffentliche Teile werden vor Übergabe entfernt:** ja / nein  
**Mediathek in der Hauptnavigation:** ja / nein / nach Pilot entscheiden  
**Livestreaming:** nicht vorgesehen / später gesondert prüfen

### M-02 – Formate und Umfang

**Gewünschte Medien:** Video / Audio / beides  
**Eingangsformate:**  
**Download anbieten:** Video / Audio / beides / keinen Download  
**Typische und längste Sitzungsdauer:**  
**Erwartete Sitzungen pro Jahr und gleichzeitige Abrufe:**  
**Aufbewahrungsdauer:**  
**Originaldateien intern erhalten:** ja / nein / Frist

### M-03 – Anbieter, Kosten und Datenschutz

**Cloudflare Stream darf geprüft/genutzt werden:** ja / nein  
**Cloudflare R2 darf geprüft/genutzt werden:** ja / nein  
**Zulässige oder ausgeschlossene externe Plattformen:**  
**Monatliches Zielbudget und harte Kostengrenze:**  
**Warnschwellen:**  
**Vorgaben zu Datenstandort und Auftragsverarbeitung:**

### M-04 – Freigabe und Barrierefreiheit

**Wer bestätigt Öffentlichkeit und Rechte:**  
**Wer prüft Untertitel und Transkript:**  
**WebVTT-Untertitel sind Pflicht:** ja / nein  
**Vollständiges Transkript ist Pflicht für:** Video / Audio / beides  
**Audiodeskription:** immer / bei Bedarf / offen  
**Wer entscheidet über Korrektur oder Depublikation:**  
**Kontaktweg und Reaktionsfrist bei Beanstandungen:**  
**Lösch- und Protokollfristen:**

### M-05 – Pilotpaket

Bitte für eine längere öffentliche Sitzung bereitstellen:

- [ ] Video- und/oder Audio-Originaldatei
- [ ] Sitzungsnummer, Wahlperiode, Titel, Datum, Beginn, Ende und Ort
- [ ] öffentliche Tagesordnung, Kapitel und Zeitmarken
- [ ] zugehörige Drucksachen und Beschlüsse
- [ ] freigegebenes Vorschaubild mit Bildnachweis
- [ ] geprüfte WebVTT-Untertitel und vollständiges Transkript
- [ ] Veröffentlichungs- und Rechtefreigabe
- [ ] Angaben zu nichtöffentlichen oder zu entfernenden Passagen

---

## Q. Noch fehlende Rechtsquellen

### Q-01 – Technische Archivierung der NDR-Ausgangsfassung

Die fachlich maßgebliche Ausgangsfassung ist durch die korrigierte Veröffentlichung inzwischen
eindeutig identifiziert: Staatsvertrag über den Norddeutschen Rundfunk (NDR-Staatsvertrag) vom
4./9. März 2021 (GVOBl. M-V S. 797). Eine vollständige amtliche Fassung stellt der NDR bereit:
https://www.ndr.de/der_ndr/zahlen_und_daten/staatsvertrag202.pdf

Offen ist nur noch die unveränderte Versionierung dieser Ausgangsfassung im Repository und die
anschließende Konsolidierungsprüfung. Eine gesonderte Klärung eines „Mustergesetzes“ ist nicht
erforderlich; der entsprechende Platzhalter stammte aus der ersetzten fehlerhaften Fassung von
OVertrBl. 2026 Nr. 4.

**Nur falls der amtliche Abruf technisch nicht möglich ist:** vollständige PDF unverändert unter
`/temp-neu` bereitstellen.

---

## V. Künftige Vollzugsbelege

### V-01 – Folgebelege zur Volksbefragung und zur achten Volkskammerwahl

Durchführung, amtliches Endergebnis der Volksbefragung, amtliches Wahlergebnis und der politische
Auswertungsbericht des Staatsrates sind durch das amtliche Endergebnis der Bundeswahlleitung vom
6. September 2026 und StAnzO. 2026 Nr. 41 belegt und eingepflegt; die konstituierende Sitzung der
achten Volkskammer am 7. September 2026 durch StAnzO. 2026 Nr. 42. Weiterhin benötigt werden nur:

- [ ] gesonderter Beschluss des Staatsrates über organisatorische Grundlagen und nächste Schritte
      der Olympiabewerbung
- [ ] Gesetzentwürfe, Einbringungen und Verkündungen der angekündigten Folgevorhaben, insbesondere
      Sozialistische Verfassungsnovelle sowie Wirtschaftsplanungs- und Gemeinwirtschaftsgesetz
- [ ] Errichtungsakte für Staatsplankommission Ost und Landeswirtschaftsrat

### V-01a – Personenbelege zum zweiten Staatsrat

Wahl, Konstituierung, Staatspräsident, Stellvertretung und der Zuschnitt der vier Geschäftsbereiche
sind durch StAnzO. 2026 Nr. 42, OGVBl. 2026 Nr. 75 und die Zuarbeit vom 7. September 2026 belegt und
eingepflegt. Weiterhin benötigt werden nur:

- [ ] Personendatensatz Johanna Schwade: Kurzbiografie, Werdegang und dienstliche Kontaktangabe
- [ ] Porträt von Johanna Schwade als JPEG oder PNG für `public/images/regierung/`; bis dahin führt
      das Profil ein Ansichtsbild
- [ ] Originaldatei des Ernennungsaktes vom 7. September 2026 für
      `context/amtliche-dokumente/2026-09-07/`; der Wortlaut ist bereits transkribiert
- [ ] Personendatensätze, Kontaktangaben und Porträts für Finn Bonnano, Kilian Schmidt und Lukas
      Schmidt, falls die Staatssekretäre eigene Profile erhalten sollen; das Organisationsmodell
      braucht dafür zusätzlich ein eigenes Amt unterhalb der Ressortleitung
- [ ] Revisionspermalink des Wikiartikels „Kabinett Honecker III“ auf
      `https://politiksim.miraheze.org/wiki/`

### V-02 – Boom Europe Leipzig/Halle

Für einen weitergehenden Umsetzungsstatus werden benötigt:

**Projektorganisation oder Betreibergesellschaft:**  
**Bau- oder Standortfreigabe und Baubeginn:**  
**Betriebs- oder Standorteröffnung:**  
**Dateien oder amtliche Mitteilungen:**

### V-03 – OVV-Ticketanerkennung und Fernverkehr

**Vertrag/Tarifnachweis zur 57-Millionen-Euro-Ticketanerkennung:**  
**Beginn der Anerkennung, Tarifbedingungen und Ausschlüsse:**  
**Tatsächlich bestellte oder aufgenommene Fernverkehrsrelationen:**  
**Fahrplan- oder Betriebsnachweis je Relation:**

Die Ticketanerkennung allein belegt keine Streckenreaktivierung.

### V-04 – Beschaffungen und Unternehmensentscheidungen

| Vorhaben | Noch benötigter Vollzugsbeleg |
| --- | --- |
| E-Jura-System | Zuschlagsempfänger, Vertrag, Abnahme, Lieferung und Betriebsaufnahme |
| vier Hovercrafts | Auslieferung, Abnahme und tatsächlicher Einsatz; Preis: 30 Mio. Euro |
| NVIDIA-Ansiedlung | Standort, Genehmigung, Bau, Eröffnung oder Betriebsaufnahme |
| erster Zeppelin NT | Lieferung, Zulassung und tatsächlicher Betrieb |
| Luxemburg-Liebknecht-Denkmal | Fertigstellung, Abnahme und Eröffnung |

### V-05 – Weitere EAG-Vollzugsfragen

| Vorgang | Benötigter Beleg |
| --- | --- |
| erhöhter Personenschutz | Enddatum, Verlängerung oder fortbestehende Anordnung |
| Norwegenreise des Staatspräsidenten | amtlicher Reisebericht oder Durchführungsnachweis |
| Verkehrsverfahren Ohlinger | Bescheid oder genauer Erledigungsausgang |

---

## Quellenbegleitzettel

**Kennung:**  
**Dateiname und Originaltitel:**  
**Herausgeber/ausstellende Stelle:**  
**Dokument- und Veröffentlichungsdatum:**  
**Fundstelle oder amtliche URL:**  
**Seite/Abschnitt/Message-ID/Attachment:**  
**Welche konkrete Tatsache belegt die Quelle:**  
**Vollständig und unverändert:** ja / nein / unbekannt  
**Spätere Änderungen, Rücknahmen oder Berichtigungen:**
