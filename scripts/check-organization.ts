import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PORTAL_REFERENCE_DATE } from '../src/lib/portal/dates.ts';
import {
  loadCurrentGovernment,
  loadCabinetPageContent,
  loadGovernmentProfiles,
  loadMinistryProfiles,
  loadOrganizationData,
  loadHomeContent,
  loadTopics,
} from '../src/lib/portal/loader.ts';
import { parseActionPlanData, parseTimelineData } from '../src/lib/portal/dashboard-content.ts';
import { isActiveInterval, validateOrganization } from '../src/lib/portal/organization.ts';

interface OrganizationSnapshot {
  asOf: string;
  governmentSlug: string;
  headPersonSlug: string;
  deputyPersonSlug: string;
  memberPersonSlugs: string[];
  ministryLeaders: Record<string, string>;
}

const [organization, profiles, ministries, currentGovernment] = await Promise.all([
  loadOrganizationData(),
  loadGovernmentProfiles(),
  loadMinistryProfiles(),
  loadCurrentGovernment(),
]);
validateOrganization(organization, profiles, ministries, PORTAL_REFERENCE_DATE);

const snapshotPath = resolve(process.cwd(), 'content', 'organisation', 'snapshots', `${PORTAL_REFERENCE_DATE}.json`);
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as OrganizationSnapshot;
const officeBySlug = new Map(organization.offices.map((entry) => [entry.slug, entry]));
const ministryLeaders = Object.fromEntries(
  organization.assignments
    .filter((entry) => entry.ministrySlug && officeBySlug.get(entry.officeSlug)?.canLeadMinistry && isActiveInterval(entry.validFrom, entry.validTo, snapshot.asOf))
    .map((entry) => [entry.ministrySlug as string, entry.personSlug])
    .sort(([left], [right]) => left.localeCompare(right)),
);
const actual: OrganizationSnapshot = {
  asOf: snapshot.asOf,
  governmentSlug: currentGovernment.slug,
  headPersonSlug: currentGovernment.headPersonSlug,
  deputyPersonSlug: currentGovernment.deputyPersonSlug,
  memberPersonSlugs: currentGovernment.memberPersonSlugs,
  ministryLeaders,
};
if (JSON.stringify(actual) !== JSON.stringify(snapshot)) {
  throw new Error(`Organisations-Snapshot ${snapshot.asOf} weicht ab. Erwartet:\n${JSON.stringify(snapshot, null, 2)}\nAbgeleitet:\n${JSON.stringify(actual, null, 2)}`);
}
console.log(`Organisationsmodell und Snapshot ${snapshot.asOf} erfolgreich geprüft.`);

const [home, cabinetPage, topics, actionPlanRaw, timelineRaw] = await Promise.all([
  loadHomeContent(),
  loadCabinetPageContent(),
  loadTopics(),
  readFile(resolve(process.cwd(), 'content', 'dashboard', 'action-plan.json'), 'utf8'),
  readFile(resolve(process.cwd(), 'content', 'dashboard', 'timeline.json'), 'utf8'),
]);
parseActionPlanData(JSON.parse(actionPlanRaw));
parseTimelineData(JSON.parse(timelineRaw));
const topicSlugs = new Set(topics.map((topic) => topic.slug));
for (const slug of [...home.featuredTopicSlugs, ...cabinetPage.topicHighlightSlugs]) {
  if (!topicSlugs.has(slug)) throw new Error(`Redaktionelle Themenreferenz verweist auf unbekannten Slug: ${slug}`);
}
const governmentSlugs = new Set(organization.governments.map((government) => government.slug));
for (const item of home.importantItems) {
  if (item.governmentSlug && !governmentSlugs.has(item.governmentSlug)) {
    throw new Error(`Startseitenhinweis verweist auf unbekannte Regierung: ${item.governmentSlug}`);
  }
}
console.log('Startseite, Kabinettsseite und Dashboarddaten erfolgreich geprüft.');
