import { featureFlags } from './features.ts';

export const analyticsConfig = {
  measurementId: (import.meta.env.PUBLIC_GA_MEASUREMENT_ID ?? '').trim(),
  scriptOrigin: 'https://www.googletagmanager.com/gtag/js',
  consentStorageKey: 'ostrecht-portal.analytics-consent',
  defaultConsent: {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  },
} as const;

export type AnalyticsConsentValue = 'granted' | 'denied';

export function isAnalyticsMeasurementConfigured(): boolean {
  return analyticsConfig.measurementId.length > 0;
}

export function isAnalyticsEnabled(): boolean {
  return featureFlags.enableAnalytics && isAnalyticsMeasurementConfigured();
}

export function requiresAnalyticsConsent(): boolean {
  return isAnalyticsEnabled() && featureFlags.requireConsentForAnalytics;
}
