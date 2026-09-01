# Architektur des Redaktionsstudios

Der fachliche Redaktionsstichtag wird ausschließlich in `packages/shared/src/config/editorial.json` gesetzt.

## Entscheidung

Git bleibt die kanonische Quelle aller veröffentlichten Portalinhalte. Die öffentliche Astro-Website wird weiterhin vollständig statisch gebaut und vom bestehenden Cloudflare Worker ausgeliefert. Das Redaktionsstudio läuft als kleiner, getrennter Worker unter `/redaktion/*` und reicht Änderungen über eine GitHub App als Draft Pull Request ein.

```text
Redakteur:in
  -> Cloudflare Access
  -> Editorial Worker /redaktion/*
       -> gemeinsame Content-Parser und Feldregistry
       -> GitHub App (kurzlebiges Installationstoken)
       -> Branch + ein Commit + Draft Pull Request
  -> Pull-Request-CI + geschützte Cloudflare-Vorschau
  -> Review und Merge
  -> bestehender statischer Produktionsbuild
```

Das eigenständige Rechtsportal OstRecht nutzt weiterhin denselben dateibasierten Datenbestand und
wird getrennt vom Staatsportal gebaut. Die Registry enthält bewusst keinen zweiten Rechtseditor;
das Studio bleibt Teil der Staatsportal-Infrastruktur und Änderungen durchlaufen denselben
Pull-Request-Prozess.

## Normalisiertes Organisationsmodell

Die aktuelle und historische Regierungsorganisation wird aus drei Dateien abgeleitet:

- `content/organisation/governments.json`: Regierungen, Amtszeiten, Koalition und Parlamentsdaten
- `content/organisation/offices.json`: Ämter, Rollen, Exklusivität und Zulässigkeit zur Ressortleitung
- `content/organisation/assignments.json`: zeitlich gültige Personen-, Amts-, Regierungs- und Ressortzuweisungen

Personenprofile enthalten Biografie, Kontakt, Bild und Darstellungsinformationen. Ressortdateien enthalten Beschreibung, Aufgaben, Kontakt und Darstellung. Aktuelles Amt, Mitgliedschaft und Ressortleitung werden nur in `packages/shared/src/lib/portal/organization.ts` abgeleitet. `packages/shared/src/lib/portal/loader.ts` stellt daraus typisierte Objektformen für Komponenten bereit.

Der Snapshot `content/organisation/snapshots/2026-08-01.json` ist ausdrücklich eine zentrale Testbehauptung für diesen Stichtag, keine zweite öffentliche Datenquelle. Allgemeine Invarianten prüfen Referenzen, Intervalle, Exklusivität und eindeutige Ressortleitungen unabhängig von konkreten Namen.

## Redaktionelle Inhaltsquellen

Häufig bearbeitete Inhalte liegen in validiertem JSON:

- `content/portal/home.json`
- `content/regierung/cabinet-page.json`
- `content/dashboard/action-plan.json`
- `content/dashboard/timeline.json`

Die TypeScript-Dateien unter `apps/portal/src/data/dashboard/` sind nur noch dünne Leseadapter. Darstellungslogik bleibt in Astro und TypeScript.

## Studio-Worker und Sicherheitsgrenzen

Der Worker in `apps/redaktion/src/` enthält keine Secrets im Browser. In Produktion verweigert er den Betrieb, wenn Access- oder GitHub-App-Konfiguration fehlt. Er validiert den Header `Cf-Access-Jwt-Assertion` kryptografisch gegen die Access-JWKS sowie erwarteten Issuer und Audience. Frei setzbare E-Mail-Header werden nicht als Identität akzeptiert. Grundlage ist die [offizielle Cloudflare-Anleitung zur JWT-Prüfung](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Schreibzugriffe sind zusätzlich durch Same-Origin-Prüfung, `SameSite=Strict`-CSRF-Cookie und Header-Token, Methodenerlaubnis, Content-Type- und Größenlimits geschützt. Bilder werden auf höchstens 5 MB, zulässigen MIME-Typ, Dateisignatur, sicheren Namen und verpflichtenden Alternativtext geprüft. Die Content Security Policy verhindert fremde Skripte und Einbettung.

## GitHub-Ablauf

Der Adapter liest zuerst den aktuellen SHA von `main`. Vor dem Commit wird derselbe SHA erneut geprüft. Alle JSON- und Bildänderungen werden als Blobs vorbereitet, in einem Git-Baum zusammengeführt und mit genau einem Commit auf einen Branch unter `redaktion/...` geschrieben. Ein veralteter Basis-SHA führt zu einem verständlichen Konflikt; vorbereitete, nicht referenzierte Blobs werden nicht als Teil-Commit sichtbar. Anschließend wird ein Draft Pull Request erstellt oder der vorhandene Draft desselben Branches aktualisiert.

Die GitHub App verwendet ein signiertes App-JWT nur serverseitig, tauscht es gegen ein kurzlebiges Installationstoken und erneuert dieses bei Ablauf. Langlebige Personal Access Tokens sind nicht vorgesehen.

## Vorschau und Deployment

`apps/portal/wrangler.jsonc` aktiviert Worker Preview URLs. Die Pull-Request-CI lädt nach vollständiger Qualitätsprüfung mit `wrangler versions upload --config apps/portal/wrangler.jsonc --preview-alias ...` eine unveröffentlichte Worker-Version hoch und verlinkt sie im Pull Request. Die dabei erzeugten Versions-IDs werden im technischen Teil des PR-Kommentars gesammelt. Beim Schließen oder Mergen löscht ein eigener Cleanup-Job alle registrierten Versionen, sodass weder der Alias noch ältere versionsgebundene Vorschauen dauerhaft erreichbar bleiben. Cloudflare beschreibt Version Preview URLs und Alias-Vorschauen in der [offiziellen Dokumentation](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/). Preview URLs sind von sich aus öffentlich; deshalb muss die passende Preview-Domain zusätzlich durch Cloudflare Access geschützt werden.

Der Produktionsdeploy bleibt ausschließlich im bestehenden Workflow für `main` beziehungsweise den ausdrücklich gestarteten Workflow. Die Preview-Pipeline führt kein Produktionsdeployment aus.

## Datenhaltung

Git ist die kanonische Quelle veröffentlichter Inhalte. D1 und R2 sind für die öffentliche
Inhaltsauslieferung nicht konfiguriert; das Redaktionsstudio arbeitet mit den versionierten
Dateien und Pull Requests.
