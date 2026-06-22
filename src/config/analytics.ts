import { isAnalyticsFeatureEnabled } from './features.ts';

export const analyticsConfig = {
  measurementId: 'G-7W7STBQE3Q',
  consentStorageKey: 'ostrecht-portal-analytics-consent',
  bannerId: 'analytics-consent-banner',
  requireConsent: true,
} as const;

export type AnalyticsConsentState = 'accepted' | 'rejected';

export function isAnalyticsEnabled(): boolean {
  return isAnalyticsFeatureEnabled() && analyticsConfig.measurementId.length > 0;
}

export function getDefaultAnalyticsConsentState(): AnalyticsConsentState {
  return 'rejected';
}

export function shouldShowAnalyticsConsentBanner(): boolean {
  return analyticsConfig.requireConsent;
}
