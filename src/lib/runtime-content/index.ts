import { parseNormMeta } from '../norms/schema.ts';
import { toDisplayText } from '../norms/presentation.ts';
import {
  parseMinisteriumProfil,
  parseRede,
  parseRegierungProfil,
  parseSeite,
  parseThemenseite,
  type Ministerium,
  type Rede,
  type RegierungMitglied,
  type Seite,
  type Themenseite,
} from '../portal/schema.ts';
import {
  deriveGovernmentMember,
  deriveMinistry,
  parseGovernmentAssignments,
  parseGovernmentOffices,
  parseGovernments,
  validateOrganization,
} from '../portal/organization.ts';
import { PORTAL_REFERENCE_DATE } from '../portal/dates.ts';
import governmentsData from '../../../content/organisation/governments.json';
import officesData from '../../../content/organisation/offices.json';
import assignmentsData from '../../../content/organisation/assignments.json';

interface RuntimeTopicSummary {
  slug: string;
  title: string;
  teaser: string;
}

interface RuntimeNormSummary {
  slug: string;
  title: string;
  summary: string;
}

function toContentPath(filePath: string): string {
  const marker = '/content/';
  const markerIndex = filePath.indexOf(marker);

  if (markerIndex >= 0) {
    return `content/${filePath.slice(markerIndex + marker.length)}`;
  }

  return filePath;
}

const topicModules = import.meta.glob('../../../content/themen/*.json', {
  eager: true,
  import: 'default',
});

const speechModules = import.meta.glob('../../../content/presse/reden/*.json', {
  eager: true,
  import: 'default',
});

const servicePageModules = import.meta.glob('../../../content/service/seiten/*.json', {
  eager: true,
  import: 'default',
});

const ministryModules = import.meta.glob('../../../content/ressorts/*.json', {
  eager: true,
  import: 'default',
});

const governmentMemberModules = import.meta.glob('../../../content/regierung/mitglieder/*.json', {
  eager: true,
  import: 'default',
});

const normMetaModules = import.meta.glob('../../../content/normen/*/meta.json', {
  eager: true,
  import: 'default',
});

const runtimeTopics = Object.entries(topicModules)
  .map(([filePath, value]) => parseThemenseite(value, toContentPath(filePath)))
  .sort((left, right) => left.title.localeCompare(right.title, 'de'));

const runtimeSpeeches = Object.entries(speechModules)
  .map(([filePath, value]) => parseRede(value, toContentPath(filePath)))
  .sort((left, right) => right.date.localeCompare(left.date));

const runtimeServicePages = Object.entries(servicePageModules)
  .map(([filePath, value]) => parseSeite(value, toContentPath(filePath)))
  .sort((left, right) => left.title.localeCompare(right.title, 'de'));

const runtimeMinistryProfiles = Object.entries(ministryModules)
  .map(([filePath, value]) => parseMinisteriumProfil(value, toContentPath(filePath)));

const runtimeGovernmentProfiles = Object.entries(governmentMemberModules)
  .map(([filePath, value]) => parseRegierungProfil(value, toContentPath(filePath)));

const runtimeOrganization = {
  governments: parseGovernments(governmentsData),
  offices: parseGovernmentOffices(officesData),
  assignments: parseGovernmentAssignments(assignmentsData),
};
validateOrganization(runtimeOrganization, runtimeGovernmentProfiles, runtimeMinistryProfiles, PORTAL_REFERENCE_DATE);

const runtimeMinistries = runtimeMinistryProfiles
  .map((ministry) => deriveMinistry(ministry, runtimeOrganization, runtimeGovernmentProfiles, PORTAL_REFERENCE_DATE))
  .sort((left, right) => left.name.localeCompare(right.name, 'de'));

const runtimeGovernmentMembers = runtimeGovernmentProfiles
  .map((profile) => deriveGovernmentMember(profile, runtimeOrganization, runtimeMinistryProfiles, PORTAL_REFERENCE_DATE))
  .sort((left, right) => left.reihenfolge - right.reihenfolge);

const runtimeNormSummaries = Object.entries(normMetaModules).map(([filePath, value]) => {
  const meta = parseNormMeta(value, toContentPath(filePath));

  return {
    slug: meta.slug,
    title: toDisplayText(meta.title),
    summary: toDisplayText(meta.summary),
  } satisfies RuntimeNormSummary;
});

const runtimeTopicLookup = new Map(
  runtimeTopics.map((topic) => [
    topic.slug,
    {
      slug: topic.slug,
      title: topic.title,
      teaser: topic.teaser,
    } satisfies RuntimeTopicSummary,
  ]),
);

const runtimeNormLookup = new Map(runtimeNormSummaries.map((entry) => [entry.slug, entry]));
const runtimeTopicBySlug = new Map(runtimeTopics.map((topic) => [topic.slug, topic]));
const runtimeMinistryBySlug = new Map(runtimeMinistries.map((entry) => [entry.slug, entry]));
const runtimeGovernmentMemberBySlug = new Map(runtimeGovernmentMembers.map((entry) => [entry.slug, entry]));
const runtimeServicePageBySlug = new Map(runtimeServicePages.map((entry) => [entry.slug, entry]));

export function getRuntimeTopicLookup(): Map<string, RuntimeTopicSummary> {
  return runtimeTopicLookup;
}

export function getRuntimeNormLookup(): Map<string, RuntimeNormSummary> {
  return runtimeNormLookup;
}

export function loadRuntimeSpeeches(): Rede[] {
  return [...runtimeSpeeches];
}

export function loadRuntimeTopics(): Themenseite[] {
  return [...runtimeTopics];
}

export function loadRuntimeTopicBySlug(slug: string): Themenseite | undefined {
  return runtimeTopicBySlug.get(slug);
}

export function loadRuntimeMinistries(): Ministerium[] {
  return [...runtimeMinistries];
}

export function loadRuntimeMinistryBySlug(slug: string): Ministerium | undefined {
  return runtimeMinistryBySlug.get(slug);
}

export function loadRuntimeGovernmentMembers(): RegierungMitglied[] {
  return [...runtimeGovernmentMembers];
}

export function loadRuntimeGovernmentMemberBySlug(slug: string): RegierungMitglied | undefined {
  return runtimeGovernmentMemberBySlug.get(slug);
}

export function loadRuntimeServicePages(): Seite[] {
  return [...runtimeServicePages];
}

export function loadRuntimeServicePageBySlug(slug: string): Seite | undefined {
  return runtimeServicePageBySlug.get(slug);
}
