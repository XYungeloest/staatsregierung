export const SITE_TARGET_NAMES = ['portal', 'law'];

export function normalizeSiteTargets(value, fallback = SITE_TARGET_NAMES) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/u)
      : [];
  const requested = raw.map((entry) => String(entry).trim()).filter(Boolean);
  const invalid = requested.filter((entry) => !SITE_TARGET_NAMES.includes(entry));
  if (invalid.length > 0) {
    throw new Error(`Unbekannte Site-Ziele: ${invalid.join(', ')}. Erlaubt sind portal und law.`);
  }
  const selected = SITE_TARGET_NAMES.filter((entry) => requested.includes(entry));
  if (selected.length > 0) return selected;
  const fallbackTargets = Array.isArray(fallback) ? fallback : SITE_TARGET_NAMES;
  return SITE_TARGET_NAMES.filter((entry) => fallbackTargets.includes(entry));
}
