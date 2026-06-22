import {
  analyticsConfig,
  type AnalyticsConsentState,
  getDefaultAnalyticsConsentState,
  isAnalyticsEnabled,
  shouldShowAnalyticsConsentBanner,
} from '../config/analytics.ts';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __ga4Configured?: boolean;
  }
}

const ACCEPT_SELECTOR = '[data-analytics-consent-accept]';
const REJECT_SELECTOR = '[data-analytics-consent-reject]';
const RESET_SELECTOR = '[data-analytics-consent-reset]';

function supportsStorage(): boolean {
  try {
    return typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readConsent(): AnalyticsConsentState | null {
  if (!supportsStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(analyticsConfig.consentStorageKey);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

function writeConsent(value: AnalyticsConsentState): void {
  if (!supportsStorage()) {
    return;
  }

  window.localStorage.setItem(analyticsConfig.consentStorageKey, value);
}

function clearConsent(): void {
  if (!supportsStorage()) {
    return;
  }

  window.localStorage.removeItem(analyticsConfig.consentStorageKey);
}

function getBanner(): HTMLElement | null {
  return document.getElementById(analyticsConfig.bannerId);
}

function showBanner(): void {
  getBanner()?.removeAttribute('hidden');
}

function hideBanner(): void {
  getBanner()?.setAttribute('hidden', '');
}

function updateGoogleConsent(state: AnalyticsConsentState): void {
  if (typeof window.gtag !== 'function') {
    return;
  }

  const analyticsStorage = state === 'accepted' ? 'granted' : 'denied';

  window.gtag('consent', 'update', {
    analytics_storage: analyticsStorage,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

function configureGoogleAnalytics(consent: AnalyticsConsentState): void {
  if (window.__ga4Configured) {
    return;
  }

  const analyticsStorage = consent === 'accepted' ? 'granted' : 'denied';
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args));
  window.gtag('consent', 'default', {
    analytics_storage: analyticsStorage,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', analyticsConfig.measurementId, { anonymize_ip: true });

  if (!document.querySelector('script[data-analytics-loader]')) {
    const script = document.createElement('script');
    script.async = true;
    script.dataset.analyticsLoader = 'true';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsConfig.measurementId)}`;
    document.head.append(script);
  }
  window.__ga4Configured = true;
}

function applyConsent(state: AnalyticsConsentState): void {
  if (state === 'accepted') {
    configureGoogleAnalytics(state);
  }

  updateGoogleConsent(state);
}

function persistAndApplyConsent(state: AnalyticsConsentState): void {
  writeConsent(state);
  applyConsent(state);
  hideBanner();
}

function handleClick(event: Event): void {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest(ACCEPT_SELECTOR)) {
    persistAndApplyConsent('accepted');
    return;
  }

  if (target.closest(REJECT_SELECTOR)) {
    persistAndApplyConsent('rejected');
    return;
  }

  if (target.closest(RESET_SELECTOR)) {
    clearConsent();
    window.__ga4Configured = false;
    const defaultConsent = getDefaultAnalyticsConsentState();
    applyConsent(defaultConsent);

    if (shouldShowAnalyticsConsentBanner()) {
      showBanner();
    } else {
      hideBanner();
    }
  }
}

function initAnalyticsConsent(): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  const storedConsent = readConsent();
  const consent = storedConsent ?? getDefaultAnalyticsConsentState();

  applyConsent(consent);

  if (storedConsent) {
    hideBanner();
    document.addEventListener('click', handleClick);
    return;
  }

  if (shouldShowAnalyticsConsentBanner()) {
    showBanner();
  } else {
    hideBanner();
  }

  document.addEventListener('click', handleClick);
}

initAnalyticsConsent();
