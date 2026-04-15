# Content-Modell

## Collections

### regierungMitglied
- slug
- name
- amt
- ressort
- reihenfolge
- kurzbiografie
- langbiografie
- bild
- bildAlt
- bildnachweis
- kontakt optional
- zitat optional

### ressort
- slug
- name
- kurzname
- leitung
- teaser
- aufgaben
- kontakt
- bild
- bildAlt
- bildnachweis
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
- imageCredit
- body
- isFeatured optional
- relatedTopicSlugs optional
- relatedNormSlugs optional
- relatedPressSlugs optional

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
- image optional
- imageAlt optional
- imageCredit optional

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
    ministerien/
    presse/
    jobs/

## Hinweis

Das bestehende Normenmodell wird nicht neu erfunden, sondern integriert.
Es darf intern angepasst werden, falls dies für `/recht/` nötig ist, aber funktional nicht reduziert werden.
