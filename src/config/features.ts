export const featureFlags = {
  enableEditorialTools: true,
  showEditorialNavLink: false,
  enableOfficialStyleHeader: true,
  enableStickyHeader: false,
} as const;

export function isEditorialToolsEnabled(): boolean {
  return featureFlags.enableEditorialTools;
}

export function isEditorialNavLinkVisible(): boolean {
  return featureFlags.enableEditorialTools && featureFlags.showEditorialNavLink;
}

export function isOfficialStyleHeaderEnabled(): boolean {
  return featureFlags.enableOfficialStyleHeader;
}

export function isStickyHeaderEnabled(): boolean {
  return featureFlags.enableOfficialStyleHeader && featureFlags.enableStickyHeader;
}
