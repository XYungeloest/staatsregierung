export const featureFlags = {
  enableOfficialStyleHeader: true,
  enableStickyHeader: false,
  enableAnalytics: true,
} as const;

export function isOfficialStyleHeaderEnabled(): boolean {
  return featureFlags.enableOfficialStyleHeader;
}

export function isStickyHeaderEnabled(): boolean {
  return featureFlags.enableOfficialStyleHeader && featureFlags.enableStickyHeader;
}

export function isAnalyticsFeatureEnabled(): boolean {
  return featureFlags.enableAnalytics;
}
