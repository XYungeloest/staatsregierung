export type AnalyticsEventValue = string | number | boolean;
export type AnalyticsEventParams = Record<string, AnalyticsEventValue | undefined>;

export interface AnalyticsRuntimeApi {
  track: (eventName: string, params?: AnalyticsEventParams) => void;
  grantConsent: () => void;
  denyConsent: () => void;
  openConsentDialog: () => void;
  hasConsent: () => boolean;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    OstAnalytics?: AnalyticsRuntimeApi;
    __ostAnalyticsConfig?: {
      enabled: boolean;
      measurementId: string;
      requireConsent: boolean;
      consentStorageKey: string;
      scriptUrl: string;
      defaultConsent: Record<string, 'granted' | 'denied'>;
    };
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  params: AnalyticsEventParams = {},
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.OstAnalytics?.track(eventName, params);
}

export function openAnalyticsConsentSettings(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.OstAnalytics?.openConsentDialog();
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.OstAnalytics?.hasConsent() ?? false;
}
