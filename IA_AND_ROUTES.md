# Informationsarchitektur und Routing

## Oberes Ziel
Ein zusammenhängendes Regierungsportal mit integriertem Rechtsbereich und Servicebereich.

## Primäre Routen

/
  
/staatsregierung/
/staatsregierung/ministerpraesident/
/staatsregierung/kabinett/
/staatsregierung/kabinett/[ressort]
/staatsregierung/koalition/
/staatsregierung/15-punkte-plan/

/themen/
/themen/[slug]/

/recht/
/recht/verfassung/
/recht/suche/
/recht/archiv/
/recht/norm/[slug]/
/recht/norm/[slug]/history/
/recht/norm/[slug]/version/[versionId]/
Hinweis: Bei /recht/ kann die bereits umgesetze Form auch beibehalten/ergänzt werden.

/presse/
/presse/pressemitteilungen/
/presse/pressemitteilungen/[slug]/
/presse/reden/
/presse/reden/[slug]/
/presse/termine/

/haushalt/
/haushalt/gesamtplan/
/haushalt/einzelplaene/
/haushalt/sondervermoegen/

/freistaat/
/freistaat/verfassung-und-staatsziele/
/freistaat/bezirke/
/freistaat/landesfarben-und-hoheitszeichen/
/freistaat/hauptstaedte/
/freistaat/geschichte/

/service/
/service/karriere/
/service/karriere/[slug]/
/service/kontakt/
/service/faq/
/service/barrierefreiheit/
/service/impressum/
/service/datenschutz/

## Sekundäre Navigation

- Suche
- Sitemap / Übersicht
- Kontakt
- Impressum
- Datenschutz
- Barrierefreiheit

## Routing-Regeln

- Das Rechtsportal liegt vollständig unter `/recht/`.
- Alle Regierungs-, Presse-, Haushalts- und Serviceinhalte liegen außerhalb des Rechtsbereichs.
- Themenseiten verlinken direkt in den Rechtsbereich.
- Service-Seiten werden nicht doppelt außerhalb von `/service/` abgelegt.