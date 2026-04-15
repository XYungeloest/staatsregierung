# Informationsarchitektur und Routing

## Oberes Ziel
Ein zusammenhängendes Regierungsportal mit integriertem Rechtsbereich und Servicebereich.

## Primäre Routen

/

/staatsregierung/
/staatsregierung/mitglieder/
/staatsregierung/mitglieder/[slug]/
/staatsregierung/ministerpraesident/
/staatsregierung/kabinett/
/staatsregierung/kabinett/[ressort]/
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
Hinweis: Bestehende Rechtsfunktionen bleiben unter `/recht/` erhalten und werden innerhalb dieser Route weitergeführt.

/presse/
/presse/pressemitteilungen/
/presse/pressemitteilungen/[slug]/
/presse/reden/
/presse/reden/[slug]/
/presse/termine/
/presse/termine/[slug]/

/haushalt/
/haushalt/[slug]/

/freistaat/
/freistaat/[slug]/

/service/
/service/uebersicht/
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
- Die dedizierte Portalübersicht liegt unter `/service/uebersicht/`.
