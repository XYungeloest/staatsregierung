# Analytics-Hinweise

## Ziel der Integration

Die Website ist für Google Analytics 4 vorbereitet, ohne dass Analytics pauschal auf jeder
Seite sofort aktiv wird. Die Einbindung bleibt vollständig statisch, GitHub-Pages-kompatibel und
ohne Backend oder externe Consent-Management-Plattform.

## Zentrale Pflege

### Measurement ID

Die GA4-Measurement-ID wird über eine öffentliche Umgebungsvariable gepflegt:

```text
PUBLIC_GA_MEASUREMENT_ID
```

Beispiel:

```sh
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build
```

Für lokale Entwicklung:

```text
.env
.env.local
```

mit zum Beispiel:

```text
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Für GitHub Pages über den vorhandenen Deploy-Workflow:

- Repository-Variable `PUBLIC_GA_MEASUREMENT_ID` in GitHub anlegen
- der Workflow reicht sie beim Build automatisch an Astro weiter

### Feature-Flags

Die zentrale Schaltung liegt in:

```text
src/config/features.ts
```

Relevante Flags:

- `enableAnalytics`
- `requireConsentForAnalytics`

Empfohlene Standardkonfiguration:

- `enableAnalytics: false`, solange noch keine produktive Einrichtung erfolgen soll
- `requireConsentForAnalytics: true`, sobald Analytics aktiviert wird

### Analytics-Konfiguration

Die technische Grundkonfiguration liegt in:

```text
src/config/analytics.ts
```

Dort sind unter anderem definiert:

- Measurement ID aus `PUBLIC_GA_MEASUREMENT_ID`
- Storage-Key für die lokale Consent-Entscheidung
- Consent-Defaults für Consent Mode v2

## Technische Einbindung

Die globale Einbindung erfolgt in:

```text
src/layouts/BaseLayout.astro
```

Dort werden zentral eingebunden:

- Consent-Mode-Default-Konfiguration
- Consent-Banner
- das clientseitige Consent-/Analytics-Skript

Die clientseitige Steuerung liegt in:

```text
src/scripts/analytics-consent.ts
```

## Consent-Logik

Wenn Analytics aktiv ist und `requireConsentForAnalytics` auf `true` steht:

1. wird standardmäßig Consent Mode mit verweigerter Statistik gesetzt
2. wird das externe Google-Analytics-Skript noch nicht geladen
3. erscheint ein einfaches Consent-Banner
4. wird die Entscheidung lokal im Browser gespeichert
5. wird das GA4-Skript erst nach Zustimmung nachgeladen

Wenn Analytics aktiv ist und `requireConsentForAnalytics` auf `false` steht:

- wird Analytics ohne Banner aktiviert
- die Einbindung bleibt aber weiterhin zentral und abschaltbar

## Datenschutzseite und Wiederaufruf

Die Datenschutzseite zeigt den technischen Status an und enthält einen Knopf zum erneuten Öffnen
der Analyse-Einstellungen.

Zusätzlich gibt es im Footer einen direkten Knopf:

- `Analyse-Einstellungen`

## Spätere Custom Events

Für spätere Ereignisse gibt es eine kleine Client-Utility:

```text
src/lib/analytics/client.ts
```

Beispiel:

```ts
import { trackAnalyticsEvent } from '../lib/analytics/client.ts';

trackAnalyticsEvent('download_rechtsdokument', {
  norm_slug: 'ostdeutsches-transparenzund-informationsfreiheitsgesetz',
});
```

Die Utility sendet nur dann Events, wenn Analytics aktiv ist und eine Zustimmung vorliegt.

## Externe Schritte außerhalb des Repos

1. In Google Analytics eine GA4-Property anlegen.
2. Einen Web-Datenstream für die Portal-Domain erstellen.
3. Die erzeugte Measurement ID als `PUBLIC_GA_MEASUREMENT_ID` hinterlegen.
4. In der Datenschutzerklärung eine juristisch passende Endfassung ergänzen.
5. Nach Deployment in Google Analytics DebugView oder Echtzeit-Berichten prüfen, ob Seitenaufrufe
   nach Zustimmung ankommen.
