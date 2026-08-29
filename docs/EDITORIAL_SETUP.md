# Einrichtung von Redaktionsstudio, GitHub App und Vorschauen

Diese Schritte erzeugen externe Ressourcen und werden deshalb nicht automatisch durch Repositoryänderungen ausgeführt.

## 1. GitHub App

Eine GitHub App für genau dieses Repository anlegen und installieren. Erforderliche Repository-Berechtigungen:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only

Webhooks sind nicht erforderlich. Danach die folgenden Worker-Secrets setzen:

```sh
npx wrangler secret put GITHUB_APP_ID --config wrangler.editorial.jsonc
npx wrangler secret put GITHUB_APP_INSTALLATION_ID --config wrangler.editorial.jsonc
npx wrangler secret put GITHUB_APP_PRIVATE_KEY --config wrangler.editorial.jsonc
npx wrangler secret put GITHUB_OWNER --config wrangler.editorial.jsonc
npx wrangler secret put GITHUB_REPOSITORY --config wrangler.editorial.jsonc
```

`GITHUB_APP_PRIVATE_KEY` enthält den vollständigen PEM-Schlüssel. Keine dieser Angaben gehört in Browsercode oder versionierte Dateien. Der Basisbranch ist als `GITHUB_BASE_BRANCH=main` konfiguriert.

## 2. Cloudflare Access

Vor dem Studio-Deployment eine selbst gehostete Access-Anwendung für die Produktionsdomain und den Pfad `/redaktion/*` anlegen. Nur die gewünschte Redaktionsgruppe erhält eine Allow-Policy. Anschließend setzen:

```sh
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --config wrangler.editorial.jsonc
npx wrangler secret put CF_ACCESS_AUD --config wrangler.editorial.jsonc
```

`CF_ACCESS_TEAM_DOMAIN` hat die Form `teamname.cloudflareaccess.com`; `CF_ACCESS_AUD` ist der Application Audience Tag. Der Worker prüft das Access-JWT selbst und bleibt bei fehlenden Werten geschlossen. Der sichere Ablauf folgt der [Cloudflare-Dokumentation zur JWT-Validierung](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Nach Einrichtung kann der getrennte Worker bewusst deployt werden:

```sh
npm run editorial:check
npm run editorial:deploy
```

Die Route in `wrangler.editorial.jsonc` muss zur tatsächlich in Cloudflare verwalteten Zone passen. Vor Freigabe mit einem nicht berechtigten Konto prüfen, dass sowohl die HTML-Seite als auch direkte `/redaktion/api/*`-Aufrufe abgewiesen werden.

## 3. Lokaler Mock

Der lokale Befehl nutzt einen rein speicherbasierten Beispieldatensatz und weder GitHub noch Access:

```sh
npm run editorial:dev
```

Der Mock ist nur bei `APP_ENV=local` oder `test` zulässig und kann nie in Produktion aktiviert werden. Er dient der Formular-, Diff- und Ablaufprüfung; beim Neustart werden Änderungen verworfen. Die Adaptertests simulieren zusätzlich Tokenfehler, SHA-Konflikte, atomare Commits sowie Erstellen und Aktualisieren eines Draft Pull Requests.

## 4. Pull-Request-Vorschauen

In den GitHub-Repository-Einstellungen setzen:

- Variable `CLOUDFLARE_PREVIEWS_ENABLED=true`
- Secret `CLOUDFLARE_API_TOKEN`
- Secret `CLOUDFLARE_ACCOUNT_ID`

Das Token benötigt nur die zum Hochladen einer Worker-Version erforderlichen Rechte. Der Workflow nutzt Version Preview URLs und deployt diese Version nicht nach Produktion. Die [Cloudflare-Dokumentation zu Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/) weist darauf hin, dass diese URLs standardmäßig öffentlich sind. Deshalb eine Access-Anwendung für die Alias- und Versions-Preview-Domain des Workers konfigurieren; die genaue Domain steht nach dem ersten manuellen `wrangler versions upload` fest.

Ohne die Repositoryvariable bleibt der Preview-Job übersprungen, während alle Qualitätsprüfungen weiterlaufen. Fehlende Preview-Secrets führen somit nicht zu einem unsicheren Ersatzdeployment.

Der Workflow ermittelt den Änderungsscope zentral über `scripts/classify-change-scope.mjs`. Der
gemeinsame Ausgangscommit von PR- und Basisbranch wird verwendet, damit spätere Änderungen an
`main` nicht fälschlich dem offenen PR zugerechnet werden. `docs-only` löst keine UI-Smokes aus;
alle anderen PR-Änderungen erhalten die bestehenden Accessibility- und Browser-Smokes. Im
Produktionsworkflow bestimmen `portal`, `law` und `shared`, welche Anwendung gebaut und
veröffentlicht wird; gemeinsame Quellen wie `knowledge/`, `Gesetze/` und `content/normen/` gelten
konservativ als `shared`.

Jeder Preview-Upload wird mit seiner Cloudflare-Versions-ID im technischen Teil des PR-Kommentars registriert. Beim Schließen oder Mergen des Pull Requests löscht der Workflow alle für diesen PR registrierten Preview-Versionen und kennzeichnet die Vorschau im Kommentar als entfernt. Das Cloudflare-API-Token benötigt dafür neben dem Upload auch die Berechtigung zum Löschen von Worker-Versionen.

## 5. Abnahme

- Zugriff ohne Access-Sitzung liefert 401/Access-Anmeldung.
- Falsche Audience und abgelaufenes JWT werden abgewiesen.
- Studio liest `main` und zeigt Inhalte sowie Referenzauswahl an.
- Ein Testvorgang erstellt einen Branch `redaktion/...`, genau einen Commit und einen Draft Pull Request.
- Der PR enthält Redakteur:in, Inhaltstyp, Routen und Prüfhinweise.
- CI und geschützte Vorschau erscheinen im PR.
- Produktion ändert sich erst nach Review, Merge und erfolgreichem bestehenden Main-Deployment.
