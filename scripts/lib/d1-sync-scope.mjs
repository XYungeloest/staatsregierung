/**
 * Bestimmt aus geänderten Repositorypfaden den Umfang einer D1-Projektion.
 *
 * Normale Inhaltsänderungen treffen nur die betroffenen Normen: Pfade unter
 * content/normen/<slug>/ ergeben genau diesen Slug (gelöschte Verzeichnisse
 * ergeben eine Löschung). Änderungen unter content/verkuendungen/ ergeben eine
 * Neuprojektion der Verkündungen und der Normen, deren Fassungen die geänderten
 * Verkündungen zitieren. Änderungen an der Ableitungslogik, dem Schema oder den
 * korpusweiten Portalbezügen (Themen, Presse) erfordern eine Vollprojektion.
 *
 * Abhängigkeiten der abgeleiteten Daten (law_norm_derived): Beziehungen,
 * Empfehlungen, Textverweise und Portalbezüge einer Norm hängen von der Identität
 * (Slug, Titel, Kurzbezeichnung, Abkürzung, Typ, Status, Sachgebiete, Schlagwörter,
 * Relationen) *anderer* Normen ab. Ändert sich die Identität einer Norm oder
 * kommt eine Norm hinzu bzw. fällt weg, werden deshalb die abgeleiteten Zeilen
 * aller Normen neu geschrieben (ohne Fassungen und Normkörper); ändern sich nur
 * Fassungen, Historie oder sonstige Metadaten, genügt die Norm selbst.
 */

export const GLOBAL_TRIGGER_PATTERNS = [
  /^scripts\/sync-recht-d1\.mjs$/u,
  /^scripts\/lib\/d1-sync-scope\.mjs$/u,
  /^data\/recht\/d1\//u,
  /^packages\/shared\/src\/lib\/norms\//u,
  /^packages\/shared\/src\/lib\/portal\/(?:content|routes|loader|legislation)\.ts$/u,
  /^packages\/shared\/src\/config\//u,
  /^packages\/recht-search\/src\//u,
  /^content\/themen\//u,
  /^content\/presse\//u,
];

/** Felder von meta.json, deren Änderung die abgeleiteten Daten anderer Normen berührt. */
export const IDENTITY_FIELDS = [
  'slug', 'title', 'shortTitle', 'abbr', 'type', 'status', 'subjects', 'primarySubject', 'keywords',
  'predecessorSlug', 'successorSlug', 'enactingNorm', 'enactedNorm', 'enactedNorms', 'containedIn',
  'affectedNorms', 'affectedByNorms', 'relatedNorms', 'documentDate', 'effectiveDate', 'expiryDate',
];

export function normalizeChangedPath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//u, '');
}

function slugFromNormPath(path) {
  const match = path.match(/^content\/normen\/([^/]+)\/(?:meta\.json|history\.json|versions\/[^/]+\.json)$/u);
  return match ? match[1] : null;
}

function publicationSlugFromPath(path) {
  const match = path.match(/^content\/verkuendungen\/([^/]+)\.json$/u);
  return match ? match[1] : null;
}

/**
 * @param {string[]} paths geänderte Pfade (relativ zum Repository)
 * @param {{ existingSlugs: Set<string>, existingPublications?: Set<string>, identityChanged?: (slug: string) => boolean }} options
 */
export function scopeFromChangedPaths(paths, { existingSlugs, existingPublications = null, identityChanged = () => false } = {}) {
  const normalized = paths.map(normalizeChangedPath).filter(Boolean);
  const reasons = [];
  const slugs = new Set();
  const deletedSlugs = new Set();
  const publicationSlugs = new Set();
  const deletedPublications = new Set();
  let full = false;
  let unknown = 0;

  for (const path of normalized) {
    if (GLOBAL_TRIGGER_PATTERNS.some((pattern) => pattern.test(path))) {
      full = true;
      reasons.push(`${path}: Projektionslogik oder korpusweite Grundlage geändert`);
      continue;
    }
    const slug = slugFromNormPath(path);
    if (slug) {
      if (existingSlugs.has(slug)) slugs.add(slug);
      else deletedSlugs.add(slug);
      continue;
    }
    const publication = publicationSlugFromPath(path);
    if (publication) {
      if (!existingPublications || existingPublications.has(publication)) publicationSlugs.add(publication);
      else deletedPublications.add(publication);
      continue;
    }
    if (/^content\/normen\/|^content\/verkuendungen\//u.test(path)) {
      // Unerwartete Datei innerhalb des Rechtsbestands: konservativ vollständig projizieren.
      full = true;
      reasons.push(`${path}: unerwarteter Pfad im Rechtsbestand`);
      continue;
    }
    unknown += 1;
  }

  let derivedRebuild = false;
  if (!full) {
    if (deletedSlugs.size > 0) {
      derivedRebuild = true;
      reasons.push(`${deletedSlugs.size} Norm(en) gelöscht: abgeleitete Daten aller Normen neu`);
    }
    for (const slug of slugs) {
      if (identityChanged(slug)) {
        derivedRebuild = true;
        reasons.push(`${slug}: Identität geändert oder neu: abgeleitete Daten aller Normen neu`);
      }
    }
  }

  return {
    mode: full ? 'full' : 'incremental',
    slugs: [...slugs].sort(),
    deletedSlugs: [...deletedSlugs].sort(),
    publicationSlugs: [...publicationSlugs].sort(),
    deletedPublications: [...deletedPublications].sort(),
    derivedRebuild: full ? false : derivedRebuild,
    ignoredPaths: unknown,
    reasons,
  };
}

/** Vergleicht zwei meta.json-Stände auf identitätsrelevante Änderungen. */
export function metaIdentityChanged(previous, current) {
  if (!previous || !current) return true;
  for (const field of IDENTITY_FIELDS) {
    if (JSON.stringify(previous[field] ?? null) !== JSON.stringify(current[field] ?? null)) return true;
  }
  return false;
}

/** Normen, deren Fassungen eine der geänderten Verkündungen zitieren (Verkündungsbezug in D1). */
export function normsCitingPublications(publications, publicationSlugs) {
  const wanted = new Set(publicationSlugs);
  const slugs = new Set();
  for (const publication of publications) {
    if (!wanted.has(publication.slug)) continue;
    for (const entry of publication.entries ?? []) {
      if (entry.normSlug) slugs.add(entry.normSlug);
    }
  }
  return [...slugs].sort();
}
