/**
 * Bestimmt aus geänderten Repositorypfaden den Umfang einer D1-Projektion.
 *
 * Normale Inhaltsänderungen treffen nur die betroffenen Normen: Pfade unter
 * content/normen/<slug>/ ergeben genau diesen Slug (gelöschte Verzeichnisse
 * ergeben eine Löschung). Änderungen unter content/verkuendungen/ ergeben eine
 * Neuprojektion der Verkündungen und der Normen, deren Fassungen die geänderten
 * Verkündungen zitieren. Änderungen an der Ableitungslogik oder dem Schema erfordern eine
 * Vollprojektion. Portalgrundlagen (content/themen, content/presse) fließen ausschließlich in
 * die Portalbezüge von law_norm_derived ein: ihre Änderung erneuert die abgeleiteten Daten
 * aller Normen (`derivedRebuild`), keine Fassungen oder Normkörper; ist der projektions-
 * relevante Auszug der Datei unverändert (`portalProjectionChanged`, z. B. nur eine
 * Hervorhebung oder ein Teaser), löst sie nichts aus.
 *
 * Projektionslogik: Mit `logicPaths` (Dateien des transitiven Code-Abschlusses der Projektion
 * in Basis und Ziel, scripts/lib/d1-projection-closure.mjs) zählt genau eine geänderte Datei
 * dieses Abschlusses als Logikänderung; andere Dateien in denselben Verzeichnissen (reine
 * Darstellung) sind unerheblich. Ohne `logicPaths` gilt fail-closed die konservative Obermenge
 * GLOBAL_TRIGGER_PATTERNS. Schemaänderungen unter data/recht/d1/ sind immer eine Vollprojektion.
 *
 * `logicChange` sagt, wie eine Logikänderung außerhalb des Schemas zu behandeln ist. Standard ist
 * `full` (die Umfangslogik kann nicht wissen, welche Zeilen eine Codeänderung berührt). Die beiden
 * anderen Werte darf nur ein validierter Äquivalenznachweis setzen (scripts/lib/d1-projection-proof.mjs),
 * nie ein Aufrufer aus eigener Annahme: `narrow` schreibt statt der Vollprojektion die
 * Suchdokumente (law_search_documents) und abgeleiteten Daten (law_norm_derived, abgeleitete
 * Spalten von law_norms) aller Normen neu; `ignore` behandelt die Logikänderung als
 * datenneutral (nur Identität und Laufzeitmetadaten werden geschrieben).
 *
 * Der redaktionelle Stichtag (packages/shared/src/config/editorial.json) ist ein Sonderfall:
 * Seine Fortschreibung ändert die Projektion nur bei Normen, deren Fassungseinordnung oder
 * geltende Fassung zwischen altem und neuem Stichtag verschieden ist (scripts/lib/
 * d1-reference-date.mjs). Der Aufrufer liefert diese Slugs über `referenceDateSlugs`; ohne
 * diese Angabe bleibt die Stichtagsänderung konservativ ein Full-Trigger. Betroffene Normen
 * werden vollständig neu geschrieben, die abgeleiteten Daten aller Normen ebenfalls, weil sie
 * auf die geltende Fassung anderer Normen verweisen.
 *
 * Abhängigkeiten der abgeleiteten Daten (law_norm_derived): Beziehungen,
 * Empfehlungen, Textverweise und Portalbezüge einer Norm hängen von der Identität
 * (Slug, Titel, Kurzbezeichnung, Abkürzung, Typ, Status, Sachgebiete, Schlagwörter,
 * Relationen) *anderer* Normen ab. Ändert sich die Identität einer Norm oder
 * kommt eine Norm hinzu bzw. fällt weg, werden deshalb die abgeleiteten Zeilen
 * aller Normen neu geschrieben (ohne Fassungen und Normkörper); ändern sich nur
 * Fassungen, Historie oder sonstige Metadaten, genügt die Norm selbst.
 */

import { createHash } from 'node:crypto';

export const REFERENCE_DATE_PATH = 'packages/shared/src/config/editorial.json';
/**
 * Redaktionelles Stichwortregister: Eingabe der Stichworteinträge (law_norm_keywords). Eine
 * Änderung berührt weder Fassungen noch Normkörper noch abgeleitete Daten; sie schreibt die
 * Stichworteinträge aller Normen neu (`refreshKeywords`), weil ein Registerstichwort ein
 * gleichlautendes abgeleitetes Schlagwort derselben Norm ersetzt.
 */
export const KEYWORD_REGISTER_PATH = 'content/stichwortregister.json';
/** Schemaänderungen erzwingen immer die Vollprojektion. */
export const SCHEMA_TRIGGER_PATTERN = /^data\/recht\/d1\//u;
export const LOGIC_CHANGE_MODES = ['full', 'narrow', 'ignore'];

/** Konservative Obermenge der Projektionslogik (Rückfall ohne bekannten Abschluss). */
export const GLOBAL_TRIGGER_PATTERNS = [
  /^scripts\/sync-recht-d1\.mjs$/u,
  /^scripts\/lib\/d1-sync-scope\.mjs$/u,
  /^scripts\/lib\/d1-reference-date\.mjs$/u,
  /^scripts\/lib\/d1-projection-closure\.mjs$/u,
  /^scripts\/lib\/d1-projection-fingerprint\.mjs$/u,
  /^data\/recht\/d1\//u,
  /^packages\/shared\/src\/lib\/norms\//u,
  /^packages\/shared\/src\/lib\/portal\/(?:content|routes|loader|legislation)\.ts$/u,
  /^packages\/shared\/src\/config\//u,
  /^packages\/recht-search\/src\//u,
];

/** Portalgrundlagen, die nur die Portalbezüge in law_norm_derived beeinflussen. */
export const PORTAL_CONTENT_PATTERN = /^content\/(?:themen|presse)\//u;

/**
 * Ziele der Normprojektion (scripts/sync-recht-d1.mjs, `normQueries`). Ein Metadata-only-Umfang
 * schreibt statt aller Zeilen einer Norm nur die Ziele, die die geänderten meta.json-Felder
 * überhaupt berühren können.
 *
 *   norm                 law_norms (eine Upsert-Zeile, enthält meta_json und alle Übersichtsspalten)
 *   versions             law_versions, law_version_blocks, law_source_objects
 *   derived              law_norm_derived und die abgeleiteten Spalten von law_norms
 *   subjects             law_norm_subjects
 *   keywords             law_norm_keywords
 *   history              law_norm_history
 *   searchDocuments      law_search_documents (Metadaten je Fassung)
 *   searchUnits          alle law_search_units der Norm (Trefferstellen und Metadateneinheit)
 *   searchMetadataUnit   nur die Metadateneinheit (block_type = 'metadata') der geltenden Fassung
 */
export const NORM_TARGETS = ['norm', 'versions', 'derived', 'subjects', 'keywords', 'history', 'searchDocuments', 'searchUnits', 'searchMetadataUnit'];

/**
 * Wirkung einzelner meta.json-Felder auf diese Ziele – ermittelt an den Projektionsfunktionen
 * selbst, nicht vermutet (tests/d1-metadata-only-scope.test.mjs mutiert jedes Feld und vergleicht
 * die erzeugten Anweisungen mengenweise; ein hier zu eng eingetragenes Feld fällt dort auf).
 *
 * Aufgenommen wird nur, was zwei Bedingungen erfüllt: die Änderung berührt ausschließlich Zeilen
 * *derselben* Norm, und sie berührt von deren Zeilen nur die genannten Ziele. Ein Feld, das hier
 * fehlt, ist nicht klassifiziert: die Norm wird dann fail-closed vollständig neu projiziert. Damit
 * ist die Liste erweiterbar, ohne dass ihre Lücken zu falschen Daten führen.
 *
 * `summary`/`summarySource` gehen über `getPublicNormSummary` in die Übersichtsspalte, das
 * Suchdokument und den Metadatentext der Suche ein; die Fassungsspalte law_versions.summary hängt
 * dagegen allein an `version.summary` (packages/shared/src/lib/norms/identity.ts). `keywords`
 * liefert zusätzlich die Stichworteinträge der Art `derived`.
 */
export const META_FIELD_TARGETS = {
  summary: ['norm', 'searchDocuments', 'searchMetadataUnit'],
  summarySource: ['norm', 'searchDocuments', 'searchMetadataUnit'],
  keywords: ['norm', 'keywords', 'searchDocuments', 'searchMetadataUnit'],
  ministry: ['norm', 'searchDocuments', 'searchMetadataUnit'],
  responsibleMinistry: ['norm', 'searchDocuments', 'searchMetadataUnit'],
  fundingArea: ['norm'],
};

/** Felder von meta.json, deren Änderung die abgeleiteten Daten anderer Normen berührt. */
export const IDENTITY_FIELDS = [
  'slug', 'title', 'shortTitle', 'abbr', 'type', 'status', 'subjects', 'primarySubject', 'keywords',
  'predecessorSlug', 'successorSlug', 'enactingNorm', 'enactedNorm', 'enactedNorms', 'containedIn',
  'affectedNorms', 'affectedByNorms', 'relatedNorms', 'documentDate', 'effectiveDate', 'expiryDate',
];

const METADATA_ONLY_LABEL = 'nur die betroffenen Ziele statt aller Zeilen der Norm';

/** Bindender Kurzwert der Metadata-only-Zuordnung für die Umfangssignatur (Nachweisbindung). */
export function metadataOnlyDigest(metadataOnly) {
  const entries = Object.entries(metadataOnly ?? {}).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  if (entries.length === 0) return null;
  const canonical = JSON.stringify(entries.map(([slug, targets]) => [slug, NORM_TARGETS.filter((target) => targets.includes(target))]));
  return { count: entries.length, digest: createHash('sha256').update(canonical).digest('hex').slice(0, 32) };
}

/**
 * Ziele, die eine Liste geänderter meta.json-Felder berühren kann, oder `null`, wenn mindestens
 * ein Feld nicht klassifiziert ist (fail-closed: vollständige Neuprojektion der Norm). Eine leere
 * Feldliste – meta.json geändert, aber kein Feldwert anders (Formatierung, Schlüsselreihenfolge) –
 * ergibt die leere Zielmenge: an der Projektion dieser Norm ändert sich nichts.
 */
export function classifyMetaFields(fields) {
  if (!Array.isArray(fields)) return null;
  const targets = new Set();
  for (const field of fields) {
    const fieldTargets = META_FIELD_TARGETS[field];
    if (!fieldTargets) return null;
    for (const target of fieldTargets) targets.add(target);
  }
  return NORM_TARGETS.filter((target) => targets.has(target));
}

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

/** Ist der Pfad Projektionslogik? Mit Abschluss exakt, sonst über die konservative Obermenge. */
export function isProjectionLogicPath(path, logicPaths = null) {
  if (SCHEMA_TRIGGER_PATTERN.test(path)) return true;
  if (logicPaths) return logicPaths.has(path);
  return GLOBAL_TRIGGER_PATTERNS.some((pattern) => pattern.test(path));
}

/**
 * @param {string[]} paths geänderte Pfade (relativ zum Repository)
 * @param {{ existingSlugs: Set<string>, existingPublications?: Set<string>, identityChanged?: (slug: string) => boolean, referenceDateSlugs?: (() => string[]) | null, logicPaths?: Set<string> | null, logicChange?: 'full' | 'narrow' | 'ignore', portalProjectionChanged?: (path: string) => boolean }} options
 *   `referenceDateSlugs` liefert die stichtagsabhängig betroffenen Normen, wenn sich nur der
 *   redaktionelle Stichtag geändert hat (scripts/lib/d1-reference-date.mjs); ohne Angabe bleibt
 *   eine Änderung von editorial.json ein Full-Trigger. `portalProjectionChanged` sagt für eine
 *   Themen- oder Pressedatei, ob sich ihr projektionsrelevanter Auszug geändert hat (Standard:
 *   ja, konservativ). `metaFieldsChanged` liefert für eine Norm die Namen der geänderten
 *   meta.json-Felder (Basis gegen Ziel) oder `null`, wenn der Vergleich nicht möglich ist; ohne
 *   diese Angabe wird jede Norm vollständig neu projiziert. `logicPaths` und `logicChange` siehe
 *   Kopfkommentar.
 */
export function scopeFromChangedPaths(paths, { existingSlugs, existingPublications = null, identityChanged = () => false, referenceDateSlugs = null, logicPaths = null, logicChange = 'full', portalProjectionChanged = () => true, metaFieldsChanged = () => null } = {}) {
  if (!LOGIC_CHANGE_MODES.includes(logicChange)) throw new Error(`logicChange muss full, narrow oder ignore sein, erhalten: ${String(logicChange)}`);
  const normalized = paths.map(normalizeChangedPath).filter(Boolean);
  const reasons = [];
  const slugs = new Set();
  const deletedSlugs = new Set();
  const publicationSlugs = new Set();
  const deletedPublications = new Set();
  /** Welche Dateien einer Norm sich geändert haben – Metadata-only gilt nur für meta.json allein. */
  const normFiles = new Map();
  let full = false;
  let unknown = 0;
  let referenceDateChanged = false;
  let narrowLogic = false;
  let portalChanged = 0;
  let registerChanged = false;

  for (const path of normalized) {
    if (path === REFERENCE_DATE_PATH && referenceDateSlugs) {
      referenceDateChanged = true;
      continue;
    }
    if (path === KEYWORD_REGISTER_PATH) {
      registerChanged = true;
      continue;
    }
    if (PORTAL_CONTENT_PATTERN.test(path)) {
      if (portalProjectionChanged(path)) portalChanged += 1;
      continue;
    }
    if (isProjectionLogicPath(path, logicPaths)) {
      if (SCHEMA_TRIGGER_PATTERN.test(path) || logicChange === 'full') {
        full = true;
        reasons.push(`${path}: ${SCHEMA_TRIGGER_PATTERN.test(path) ? 'Schema' : 'Projektionslogik'} geändert`);
        continue;
      }
      if (logicChange === 'narrow') {
        narrowLogic = true;
        reasons.push(`${path}: enge Logikänderung nachgewiesen – Suchdokumente und abgeleitete Daten aller Normen neu`);
        continue;
      }
      reasons.push(`${path}: Logikänderung nachgewiesen datenneutral`);
      continue;
    }
    const slug = slugFromNormPath(path);
    if (slug) {
      if (existingSlugs.has(slug)) {
        slugs.add(slug);
        if (!normFiles.has(slug)) normFiles.set(slug, new Set());
        normFiles.get(slug).add(path.slice(`content/normen/${slug}/`.length));
      } else deletedSlugs.add(slug);
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
  if (!full && registerChanged) {
    reasons.push(`${KEYWORD_REGISTER_PATH}: Stichwortregister geändert, Stichworteinträge aller Normen neu`);
  }
  if (!full && portalChanged > 0) {
    derivedRebuild = true;
    reasons.push(`${portalChanged} Portalgrundlage(n) (Themen/Presse) mit geänderten Normbezügen: abgeleitete Daten aller Normen neu`);
  }
  if (!full && referenceDateChanged) {
    const affected = referenceDateSlugs().filter((slug) => existingSlugs.has(slug));
    for (const slug of affected) slugs.add(slug);
    derivedRebuild = true;
    reasons.push(`${REFERENCE_DATE_PATH}: Stichtag fortgeschrieben, ${affected.length} stichtagsabhängige Norm(en) und abgeleitete Daten aller Normen neu`);
  }
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

  // Metadata-only: Normen, an denen ausschließlich meta.json geändert wurde und deren geänderte
  // Felder sämtlich klassifiziert sind. Alles andere bleibt die vollständige Neuprojektion der
  // Norm – ein unbekanntes Feld, eine zweite geänderte Datei oder ein fehlender Basisvergleich
  // genügen, um in den größeren sicheren Umfang zurückzufallen.
  const metadataOnly = {};
  if (!full) {
    for (const slug of slugs) {
      const files = normFiles.get(slug);
      if (!files || files.size !== 1 || !files.has('meta.json')) continue;
      const targets = classifyMetaFields(metaFieldsChanged(slug));
      if (targets) metadataOnly[slug] = targets;
    }
    const count = Object.keys(metadataOnly).length;
    if (count > 0) reasons.push(`${count} von ${slugs.size} Norm(en) nur mit klassifizierten meta.json-Feldern: ${METADATA_ONLY_LABEL}`);
  }

  return {
    mode: full ? 'full' : 'incremental',
    slugs: [...slugs].sort(),
    metadataOnly,
    deletedSlugs: [...deletedSlugs].sort(),
    publicationSlugs: [...publicationSlugs].sort(),
    deletedPublications: [...deletedPublications].sort(),
    derivedRebuild: full ? false : (derivedRebuild || narrowLogic),
    refreshSearchDocuments: !full && narrowLogic,
    refreshKeywords: !full && registerChanged,
    ignoredPaths: unknown,
    reasons,
  };
}

/**
 * Deterministische Kurzform eines Umfangs (ohne Begründungen) – bindet einen Äquivalenznachweis
 * an genau den Umfang, der nachgewiesen wurde.
 */
export function scopeSignature(scope) {
  return JSON.stringify({
    mode: scope.mode,
    slugs: [...scope.slugs].sort(),
    // Der Metadata-only-Umfang bestimmt, welche Zeilen einer Norm überhaupt geschrieben werden;
    // er gehört deshalb in die Signatur. Statt der vollen Zuordnung (bei einem Bestandslauf
    // Tausende Einträge) bindet ein Digest über die sortierte Zuordnung den nachgewiesenen Stand.
    metadataOnly: metadataOnlyDigest(scope.metadataOnly),
    deletedSlugs: [...scope.deletedSlugs].sort(),
    publicationSlugs: [...scope.publicationSlugs].sort(),
    deletedPublications: [...(scope.deletedPublications ?? [])].sort(),
    derivedRebuild: Boolean(scope.derivedRebuild),
    refreshSearchDocuments: Boolean(scope.refreshSearchDocuments),
    refreshKeywords: Boolean(scope.refreshKeywords),
  });
}

/** Schreibt der Umfang außer Identität und Laufzeitmetadaten nichts? */
export function isEmptyScope(scope) {
  return scope.mode === 'incremental' && scope.slugs.length === 0 && scope.deletedSlugs.length === 0
    && scope.publicationSlugs.length === 0 && (scope.deletedPublications ?? []).length === 0
    && !scope.derivedRebuild && !scope.refreshSearchDocuments && !scope.refreshKeywords;
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
