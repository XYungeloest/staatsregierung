export const featureFlags = {
  enableAnalytics: true,
} as const;

export function isAnalyticsFeatureEnabled(): boolean {
  return featureFlags.enableAnalytics;
}
