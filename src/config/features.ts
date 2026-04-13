export const featureFlags = {
  enableEditorialTools: true,
  showEditorialNavLink: true,
} as const;

export function isEditorialToolsEnabled(): boolean {
  return featureFlags.enableEditorialTools;
}

export function isEditorialNavLinkVisible(): boolean {
  return featureFlags.enableEditorialTools && featureFlags.showEditorialNavLink;
}
