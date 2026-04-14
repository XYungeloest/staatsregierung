export const featureFlags = {
  enableEditorialTools: true,
  showEditorialNavLink: false,
  enableOfficialStyleHeader: true,
  enableServiceLinks: true,
  enableStickyHeader: true,
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

export function isServiceLinksEnabled(): boolean {
  return featureFlags.enableOfficialStyleHeader && featureFlags.enableServiceLinks;
}

export function isStickyHeaderEnabled(): boolean {
  return featureFlags.enableOfficialStyleHeader && featureFlags.enableStickyHeader;
}
