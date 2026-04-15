import type { AnalyticsConsentValue } from '../config/analytics.ts';
import type { AnalyticsEventParams } from '../lib/analytics/client.ts';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __ostAnalyticsConfig?: {
      enabled: boolean;
      measurementId: string;
      requireConsent: boolean;
      consentStorageKey: string;
      scriptUrl: string;
      defaultConsent: Record<string, 'granted' | 'denied'>;
    };
    OstAnalytics?: {
      track: (eventName: string, params?: AnalyticsEventParams) => void;
      grantConsent: () => void;
      denyConsent: () => void;
      openConsentDialog: () => void;
      hasConsent: () => boolean;
    };
  }
}

const config = window.__ostAnalyticsConfig;

if (!config || !config.enabled || !config.measurementId) {
  // Keine Analytics-Konfiguration aktiv.
} else {
  const runtimeConfig = config;
  const banner = document.querySelector<HTMLElement>('[data-analytics-consent-banner]');
  const acceptButtons = document.querySelectorAll<HTMLElement>('[data-analytics-consent-accept]');
  const rejectButtons = document.querySelectorAll<HTMLElement>('[data-analytics-consent-reject]');
  const openButtons = document.querySelectorAll<HTMLElement>('[data-analytics-consent-open]');
  const statusTargets = document.querySelectorAll<HTMLElement>('[data-analytics-consent-status]');
  let tagLoaded = Boolean(
    document.querySelector(`script[data-ga4-loader="${runtimeConfig.measurementId}"]`) ||
      document.querySelector(
        `script[src*="googletagmanager.com/gtag/js?id=${runtimeConfig.measurementId}"]`,
      ),
  );
  let configSent = !runtimeConfig.requireConsent;
  let currentConsent = readConsent();

  function ensureGtag(): void {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag =
      window.gtag ??
      function gtagProxy(...args: unknown[]) {
        window.dataLayer?.push(args);
      };
  }

  function loadAnalyticsTag(): void {
    if (tagLoaded) {
      return;
    }

    if (document.querySelector(`script[data-ga4-loader="${runtimeConfig.measurementId}"]`)) {
      tagLoaded = true;
      sendConfig();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `${runtimeConfig.scriptUrl}?id=${encodeURIComponent(runtimeConfig.measurementId)}`;
    script.dataset.ga4Loader = runtimeConfig.measurementId;
    script.addEventListener('load', () => {
      tagLoaded = true;
      sendConfig();
    });
    document.head.append(script);
  }

  function sendConfig(): void {
    if (configSent) {
      return;
    }

    ensureGtag();
    window.gtag?.('js', new Date());
    window.gtag?.('config', runtimeConfig.measurementId, {
      send_page_view: true,
      allow_google_signals: false,
      transport_type: 'beacon',
    });
    configSent = true;
  }

  function updateConsentMode(value: AnalyticsConsentValue): void {
    ensureGtag();

    window.gtag?.('consent', 'update', {
      analytics_storage: value,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }

  function persistConsent(value: AnalyticsConsentValue): void {
    try {
      window.localStorage.setItem(runtimeConfig.consentStorageKey, value);
    } catch {
      // Lokale Speicherung ist optional.
    }
  }

  function readConsent(): AnalyticsConsentValue | null {
    try {
      const value = window.localStorage.getItem(runtimeConfig.consentStorageKey);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch {
      return null;
    }
  }

  function showBanner(): void {
    banner?.removeAttribute('hidden');
  }

  function hideBanner(): void {
    banner?.setAttribute('hidden', '');
  }

  function updateStatusText(): void {
    const label =
      currentConsent === 'granted'
        ? 'Einwilligung erteilt'
        : currentConsent === 'denied'
          ? 'Einwilligung abgelehnt'
          : 'Noch keine Entscheidung gespeichert';

    statusTargets.forEach((target) => {
      target.textContent = label;
    });
  }

  function grantConsent(): void {
    currentConsent = 'granted';
    persistConsent('granted');
    updateConsentMode('granted');
    loadAnalyticsTag();
    updateStatusText();
    hideBanner();
  }

  function denyConsent(): void {
    currentConsent = 'denied';
    persistConsent('denied');
    updateConsentMode('denied');
    updateStatusText();
    hideBanner();
  }

  function openConsentDialog(): void {
    showBanner();
    banner?.scrollIntoView({ block: 'nearest' });
  }

  function hasConsent(): boolean {
    return currentConsent === 'granted';
  }

  window.OstAnalytics = {
    track(eventName: string, params: AnalyticsEventParams = {}) {
      if (!hasConsent()) {
        return;
      }

      ensureGtag();
      window.gtag?.('event', eventName, params);
    },
    grantConsent,
    denyConsent,
    openConsentDialog,
    hasConsent,
  };

  acceptButtons.forEach((button) => {
    button.addEventListener('click', grantConsent);
  });

  rejectButtons.forEach((button) => {
    button.addEventListener('click', denyConsent);
  });

  openButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openConsentDialog();
    });
  });

  updateStatusText();

  if (runtimeConfig.requireConsent) {
    if (currentConsent === 'granted') {
      updateConsentMode('granted');
      loadAnalyticsTag();
      hideBanner();
    } else if (currentConsent === 'denied') {
      updateConsentMode('denied');
      hideBanner();
    } else {
      showBanner();
    }
  } else {
    grantConsent();
  }
}
