import { buildNormFullCitation, buildNormRecordLookup, type NormRecordLookup } from '@ostrecht/shared/lib/norms/citation.ts';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { getNormOriginInfo, type NormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';
import type { TextLinkReference } from '@ostrecht/shared/lib/norms/presentation.ts';
import {
  buildNormPublicationReferenceLookup,
  type NormPublicationReference,
  type Verkuendung,
} from '@ostrecht/shared/lib/norms/publications.ts';
import {
  buildNormTextLinkReferences,
  buildRelatedNormRecommendationIndex,
  selectMatchingTextLinkReferences,
  type NormRelationKind as RecommendationKind,
} from '@ostrecht/shared/lib/norms/references.ts';
import {
  buildNormRelations,
  toNormRelationViews,
  type NormRelationLookup,
  type NormRelationView,
} from '@ostrecht/shared/lib/norms/relations.ts';
import { getNormUrl, getNormVersionUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import type { NormRecord, NormVersion } from '@ostrecht/shared/lib/norms/schema.ts';
import { classifyNormVersion, EDITORIAL_REFERENCE_DATE, getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';

/**
 * Korpusweite Ableitungen je Norm. Sie werden vom D1-Sync aus dem vollständigen
 * Git-Bestand berechnet und je Norm gespeichert, damit die Website zur Laufzeit
 * nur die Zeilen der angefragten Norm lesen muss. Die Dateivariante der Website
 * berechnet dieselben Werte mit demselben Code.
 */

export interface NormRecommendationView {
  slug: string;
  relation: RecommendationKind;
  score: number;
  title: string;
  shortTitle: string;
}

export interface NormPortalLinks {
  topics: Array<{ slug: string; title: string; url: string }>;
  pressReleases: Array<{ slug: string; title: string; date: string; url: string }>;
}

export interface NormDerivedData {
  relations: NormRelationView[];
  recommendations: NormRecommendationView[];
  origin: NormOriginInfo;
  textReferences: TextLinkReference[];
  portalLinks: NormPortalLinks;
}

export interface PortalTopicLike {
  slug: string;
  title: string;
  rechtsgrundlagen?: Array<{ normSlug?: string }>;
}

export interface PortalPressReleaseLike {
  slug: string;
  title: string;
  date: string;
  relatedNormSlugs?: string[];
}

export interface DerivedContext {
  norms: NormRecord[];
  publications: Verkuendung[];
  /** Redaktioneller Stichtag, zu dem geltende Fassungen und Fassungslinks bestimmt werden. */
  asOf: string;
  lookup: NormRecordLookup;
  relations: NormRelationLookup;
  recommendations: ReturnType<typeof buildRelatedNormRecommendationIndex>;
  publicationReferences: Map<string, NormPublicationReference>;
  topicsByNorm: Map<string, NormPortalLinks['topics']>;
  pressByNorm: Map<string, NormPortalLinks['pressReleases']>;
}

export function versionUrlFor(norm: NormRecord, versionId: string, asOf = EDITORIAL_REFERENCE_DATE): string | undefined {
  const version = norm.versions.find((entry) => entry.versionId === versionId);
  if (!version) return undefined;
  return classifyNormVersion(norm, version, asOf) === 'current'
    ? getNormUrl(norm.meta.slug)
    : getNormVersionUrl(norm.meta.slug, versionId);
}

export function identityFor(norm: NormRecord, asOf = EDITORIAL_REFERENCE_DATE): { title: string; shortTitle: string } {
  const identity = getNormVersionIdentity(norm, getApplicableVersion(norm, asOf));
  return { title: identity.title, shortTitle: identity.shortTitle };
}

export function collectVersionTexts(norm: NormRecord): string[] {
  const parts: string[] = [];
  const visit = (blocks: NormVersion['body']): void => {
    for (const block of blocks ?? []) {
      if (block.label) parts.push(block.label);
      if (block.title) parts.push(block.title);
      if (block.text) parts.push(block.text);
      if (block.children) visit(block.children);
    }
  };
  for (const version of norm.versions) visit(version.body);
  return parts;
}

export function buildDerivedContext({
  norms,
  publications,
  topics = [],
  pressReleases = [],
  topicUrl = (slug: string) => `/themen/${slug}/`,
  pressReleaseUrl = (slug: string) => `/presse/${slug}/`,
  asOf = EDITORIAL_REFERENCE_DATE,
}: {
  norms: NormRecord[];
  publications: Verkuendung[];
  topics?: PortalTopicLike[];
  pressReleases?: PortalPressReleaseLike[];
  topicUrl?: (slug: string) => string;
  pressReleaseUrl?: (slug: string) => string;
  /** Redaktioneller Stichtag der Projektion; Standard ist der zentrale Stichtag aus editorial.json. */
  asOf?: string;
}): DerivedContext {
  const topicsByNorm = new Map<string, NormPortalLinks['topics']>();
  for (const topic of topics) {
    for (const reference of topic.rechtsgrundlagen ?? []) {
      if (!reference.normSlug) continue;
      const list = topicsByNorm.get(reference.normSlug) ?? [];
      if (!list.some((entry) => entry.slug === topic.slug)) {
        list.push({ slug: topic.slug, title: topic.title, url: topicUrl(topic.slug) });
      }
      topicsByNorm.set(reference.normSlug, list);
    }
  }
  const pressByNorm = new Map<string, NormPortalLinks['pressReleases']>();
  for (const release of pressReleases) {
    for (const slug of release.relatedNormSlugs ?? []) {
      const list = pressByNorm.get(slug) ?? [];
      list.push({ slug: release.slug, title: release.title, date: release.date, url: pressReleaseUrl(release.slug) });
      pressByNorm.set(slug, list);
    }
  }
  return {
    norms,
    publications,
    asOf,
    lookup: buildNormRecordLookup(norms),
    relations: buildNormRelations(norms),
    recommendations: buildRelatedNormRecommendationIndex(norms, { asOf }),
    publicationReferences: buildNormPublicationReferenceLookup(publications),
    topicsByNorm,
    pressByNorm,
  };
}

export function deriveNorm(norm: NormRecord, context: DerivedContext): NormDerivedData {
  const asOf = context.asOf ?? EDITORIAL_REFERENCE_DATE;
  const textReferences = selectMatchingTextLinkReferences(
    buildNormTextLinkReferences(context.norms, norm.meta.slug, asOf),
    collectVersionTexts(norm),
  );
  const relations = toNormRelationViews(context.relations.get(norm.meta.slug) ?? [], {
    identityFor: (related) => identityFor(related, asOf),
    versionUrlFor: (related, versionId) => versionUrlFor(related, versionId, asOf),
  });
  const recommendations = (context.recommendations.get(norm.meta.slug) ?? []).map((entry) => {
    const related = context.lookup.get(entry.slug);
    const identity = related ? identityFor(related, asOf) : { title: entry.slug, shortTitle: entry.slug };
    return { slug: entry.slug, relation: entry.relation, score: entry.score, ...identity };
  });
  return {
    relations,
    recommendations,
    origin: getNormOriginInfo(norm, context.norms),
    textReferences,
    portalLinks: {
      topics: context.topicsByNorm.get(norm.meta.slug) ?? [],
      pressReleases: [...(context.pressByNorm.get(norm.meta.slug) ?? [])]
        .sort((left, right) => right.date.localeCompare(left.date))
        .slice(0, 3),
    },
  };
}

export function fullCitationFor(norm: NormRecord, version: NormVersion, context: DerivedContext): string {
  return buildNormFullCitation(norm, version, context.lookup);
}
