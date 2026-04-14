# Content-Modell

## Collections

### regierungMitglied
- slug
- name
- amt
- ressort
- partei
- reihenfolge
- kurzbiografie
- langbiografie
- bild
- bildAlt
- kontakt optional
- zitat optional

### ressort
- slug
- name
- kurzname
- leitung
- partei optional
- teaser
- aufgaben
- kontakt
- bild
- bildAlt
- themen
- verknuepfteLinks

### themenseite
- slug
- title
- teaser
- status
- hero optional
- beschlossen
- umgesetzt
- naechsteSchritte
- rechtsgrundlagen
- faq
- federfuehrendesRessort
- mitzeichnungsressorts optional

### pressemitteilung
- slug
- title
- date
- ressort
- teaser
- image
- imageAlt
- imageCredit optional
- body
- isFeatured optional

### rede
- slug
- title
- date
- sprecher
- teaser
- body

### termin
- slug
- title
- date
- location
- teaser
- body

### haushaltsseite
- slug
- title
- teaser
- body
- dataset optional

### stellenangebot
- slug
- title
- ressort
- standort
- arbeitsbereich
- datePosted
- applicationDeadline
- employmentType
- payGrade optional
- teaser
- body
- contact optional

### statischeSeite
- slug
- title
- body

### norm
bestehendes Modell aus dem Rechtsportal weiterverwenden

## Content-Verzeichnisse

content/
  regierung/mitglieder/
  ressorts/
  themen/
  presse/mitteilungen/
  presse/reden/
  presse/termine/
  haushalt/
  service/stellen/
  service/seiten/
  normen/

## Asset-Verzeichnisse

public/
  images/
    ui/
    regierung/
    ressorts/
    themen/
    presse/
    haushalt/
    jobs/

## Hinweis

Das bestehende Normenmodell wird nicht neu erfunden, sondern integriert.
Es darf intern angepasst werden, falls dies für `/recht/` nötig ist, aber funktional nicht reduziert werden.