import type { NormMeta } from '@ostrecht/shared/lib/norms/schema.ts';
import { comparePublicationsNewestFirst, getPublicationLabel, type Verkuendung } from '@ostrecht/shared/lib/norms/publications.ts';
import { getNormUrl, getPublicationUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import type { ActionPlanItem } from '@ostrecht/shared/lib/portal/dashboard-content.ts';
import type { LegislativeProcedure } from '@ostrecht/shared/lib/portal/legislation.ts';
import { getTopicUrl } from '@ostrecht/shared/lib/portal/routes.ts';
import type { ThemenRechtsgrundlage, Themenseite } from '@ostrecht/shared/lib/portal/schema.ts';

export function publicLegalSources(norms: NormMeta[], publications: Verkuendung[]) {
  const normBySlug = new Map(norms.map((norm) => [norm.slug, norm]));
  const publicationBySlug = new Map(publications.map((issue) => [issue.slug, issue]));
  const publicationByNorm = new Map<string, Verkuendung>();
  for (const issue of [...publications].sort(comparePublicationsNewestFirst)) {
    for (const { normSlug } of issue.entries) {
      if (normSlug && !publicationByNorm.has(normSlug)) publicationByNorm.set(normSlug, issue);
    }
  }
  return (reference: ThemenRechtsgrundlage) => ({
    ...reference,
    norm: reference.normSlug ? normBySlug.get(reference.normSlug) : undefined,
    publication: reference.publicationSlug ? publicationBySlug.get(reference.publicationSlug)
      : reference.normSlug ? publicationByNorm.get(reference.normSlug) : undefined,
  });
}

export type PublicLegalSource = ReturnType<ReturnType<typeof publicLegalSources>>;

export function projectPublicStatus(items: ActionPlanItem[], topics: Themenseite[], procedures: LegislativeProcedure[],
  resolveSource: ReturnType<typeof publicLegalSources>) {
  // Redigierte hrefs sind kanonische Portalpfade, auch bei einem Build mit abweichender Basis.
  const topicByPath = new Map(topics.map((topic) => [`/themen/${topic.slug}/`, topic]));
  function publicReference(reference: ThemenRechtsgrundlage) {
    const { label, note, norm, publication } = resolveSource(reference);
    return {
      label, note,
      norm: norm && { slug: norm.slug, href: getNormUrl(norm.slug), status: norm.status,
        effectiveDate: norm.effectiveDate, expiryDate: norm.expiryDate },
      publication: publication && { slug: publication.slug, href: getPublicationUrl(publication.slug),
        label: getPublicationLabel(publication), date: publication.date },
    };
  }
  return items.map((item) => {
    const topic = topicByPath.get(item.href);
    return {
      ...item,
      legalReferences: (item.references ?? []).map(publicReference),
      topic: topic ? {
        slug: topic.slug, title: topic.title, href: getTopicUrl(topic.slug), status: topic.status,
        updatedAt: topic.updatedAt, beschlossen: topic.beschlossen, geltendesRecht: topic.geltendesRecht, umgesetzt: topic.umgesetzt,
        naechsteSchritte: topic.naechsteSchritte, legalReferences: topic.rechtsgrundlagen.map(publicReference),
        procedures: procedures.filter((procedure) => procedure.relatedTopics.includes(topic.slug)).map((procedure) => ({
          slug: procedure.slug, title: procedure.shortTitle, documentNumber: procedure.documentNumber,
          stage: procedure.stage, statusLabel: procedure.statusLabel, confirmedAsOf: procedure.confirmedAsOf,
          decidedOn: procedure.decidedOn, promulgatedOn: procedure.promulgatedOn, effectiveOn: procedure.effectiveOn,
          implementationOn: procedure.implementationOn,
        })),
      } : null,
    };
  });
}
