import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { portalCollections } from '@ostrecht/shared/lib/portal/collections.ts';
import { isCurrentOrFuture, PORTAL_REFERENCE_DATE } from '@ostrecht/shared/lib/portal/dates.ts';
import {
  deriveCurrentGovernment,
  deriveGovernmentMember,
  deriveMinistry,
  parseGovernmentAssignments,
  parseGovernmentOffices,
  parseGovernments,
  validateOrganization,
  type CurrentGovernmentState,
  type OrganizationData,
} from '@ostrecht/shared/lib/portal/organization.ts';
import {
  parseHaushaltsseite,
  parseHomeContent,
  parseCabinetPageContent,
  parseBeteiligungsInventar,
  parseBeteiligungsUebersicht,
  PortalContentValidationError,
  parseRede,
  parseMinisteriumProfil,
  parsePressemitteilung,
  parseRegierungProfil,
  parseSeite,
  parseStellenangebot,
  parseTermin,
  parseThemenseite,
  type Haushaltsseite,
  type HomeContent,
  type CabinetPageContent,
  type BeteiligungsInventar,
  type BeteiligungsUebersicht,
  type Ministerium,
  type MinisteriumProfil,
  type Pressemitteilung,
  type Rede,
  type RegierungMitglied,
  type RegierungProfil,
  type Seite,
  type Stellenangebot,
  type Termin,
  type Themenseite,
} from '@ostrecht/shared/lib/portal/schema.ts';
import { resolveRepositoryRoot } from '@ostrecht/shared/lib/repository-root.ts';

const CONTENT_ROOT = join(resolveRepositoryRoot(), 'content');

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PortalContentValidationError(`${filePath}: enthält ungültiges JSON`);
    }

    throw error;
  }
}

async function listJsonFiles(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
      .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry: Dirent) => entry.name)
      .sort((left: string, right: string) => left.localeCompare(right, 'de'));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function loadCollection<T>(
  directorySegments: string[],
  parser: (value: unknown, path: string) => T,
): Promise<T[]> {
  const directoryPath = join(CONTENT_ROOT, ...directorySegments);
  const fileNames = await listJsonFiles(directoryPath);

  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = join(directoryPath, fileName);
      const json = await readJsonFile(filePath);
      return parser(json, `content/${directorySegments.join('/')}/${fileName}`);
    }),
  );

  return entries;
}

export async function loadGovernmentProfiles(): Promise<RegierungProfil[]> {
  return loadCollection(
    portalCollections.regierungMitglied.directorySegments,
    parseRegierungProfil,
  );
}

export async function loadMinistryProfiles(): Promise<MinisteriumProfil[]> {
  return loadCollection(portalCollections.ressort.directorySegments, parseMinisteriumProfil);
}

export async function loadOrganizationData(): Promise<OrganizationData> {
  const organizationRoot = join(CONTENT_ROOT, 'organisation');
  const [governmentsValue, officesValue, assignmentsValue] = await Promise.all([
    readJsonFile(join(organizationRoot, 'governments.json')),
    readJsonFile(join(organizationRoot, 'offices.json')),
    readJsonFile(join(organizationRoot, 'assignments.json')),
  ]);
  return {
    governments: parseGovernments(governmentsValue),
    offices: parseGovernmentOffices(officesValue),
    assignments: parseGovernmentAssignments(assignmentsValue),
  };
}

async function loadOrganizationContext(referenceDate = PORTAL_REFERENCE_DATE) {
  const [organization, profiles, ministries] = await Promise.all([
    loadOrganizationData(),
    loadGovernmentProfiles(),
    loadMinistryProfiles(),
  ]);
  validateOrganization(organization, profiles, ministries, referenceDate);
  return { organization, profiles, ministries };
}

export async function loadGovernmentMembers(referenceDate = PORTAL_REFERENCE_DATE): Promise<RegierungMitglied[]> {
  const { organization, profiles, ministries } = await loadOrganizationContext(referenceDate);
  return profiles
    .map((profile) => deriveGovernmentMember(profile, organization, ministries, referenceDate))
    .sort((left, right) => left.reihenfolge - right.reihenfolge || left.name.localeCompare(right.name, 'de'));
}

export async function loadCurrentGovernmentMembers(referenceDate = PORTAL_REFERENCE_DATE): Promise<RegierungMitglied[]> {
  const entries = await loadGovernmentMembers(referenceDate);
  return entries.filter((entry) => entry.current);
}

export async function loadGovernmentMemberBySlug(
  slug: string,
  referenceDate = PORTAL_REFERENCE_DATE,
): Promise<RegierungMitglied | undefined> {
  const entries = await loadGovernmentMembers(referenceDate);
  return entries.find((entry) => entry.slug === slug);
}

export async function loadMinistries(referenceDate = PORTAL_REFERENCE_DATE): Promise<Ministerium[]> {
  const { organization, profiles, ministries } = await loadOrganizationContext(referenceDate);
  return ministries
    .map((ministry) => deriveMinistry(ministry, organization, profiles, referenceDate))
    .sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

export async function loadMinistryBySlug(slug: string, referenceDate = PORTAL_REFERENCE_DATE): Promise<Ministerium | undefined> {
  const entries = await loadMinistries(referenceDate);
  return entries.find((entry) => entry.slug === slug);
}

export async function loadCurrentGovernment(referenceDate = PORTAL_REFERENCE_DATE): Promise<CurrentGovernmentState> {
  const { organization, profiles, ministries } = await loadOrganizationContext(referenceDate);
  return deriveCurrentGovernment(organization, profiles, ministries, referenceDate);
}

export async function loadHomeContent(): Promise<HomeContent> {
  return parseHomeContent(await readJsonFile(join(CONTENT_ROOT, 'portal', 'home.json')));
}

export async function loadCabinetPageContent(): Promise<CabinetPageContent> {
  return parseCabinetPageContent(await readJsonFile(join(CONTENT_ROOT, 'regierung', 'cabinet-page.json')));
}

export async function loadBeteiligungsUebersicht(): Promise<BeteiligungsUebersicht> {
  return parseBeteiligungsUebersicht(await readJsonFile(join(CONTENT_ROOT, 'regierung', 'beteiligungen.json')));
}

export async function loadBeteiligungsInventar(): Promise<BeteiligungsInventar> {
  return parseBeteiligungsInventar(
    await readJsonFile(join(CONTENT_ROOT, 'regierung', 'beteiligungsinventar.json')),
  );
}

export async function loadPressReleases(): Promise<Pressemitteilung[]> {
  const entries = await loadCollection(
    portalCollections.pressemitteilung.directorySegments,
    parsePressemitteilung,
  );
  return entries.sort((left, right) => right.date.localeCompare(left.date));
}

export async function loadSpeeches(): Promise<Rede[]> {
  const entries = await loadCollection(portalCollections.rede.directorySegments, parseRede);
  return entries.sort((left, right) => right.date.localeCompare(left.date));
}

export async function loadSpeechBySlug(slug: string): Promise<Rede | undefined> {
  const entries = await loadSpeeches();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadEvents(): Promise<Termin[]> {
  const entries = await loadCollection(portalCollections.termin.directorySegments, parseTermin);
  return entries.sort((left, right) => left.date.localeCompare(right.date));
}

export async function loadEventBySlug(slug: string): Promise<Termin | undefined> {
  const entries = await loadEvents();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadTopics(): Promise<Themenseite[]> {
  const entries = await loadCollection(portalCollections.themenseite.directorySegments, parseThemenseite);
  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function loadTopicBySlug(slug: string): Promise<Themenseite | undefined> {
  const entries = await loadTopics();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadBudgetPages(): Promise<Haushaltsseite[]> {
  const entries = await loadCollection(
    portalCollections.haushaltsseite.directorySegments,
    parseHaushaltsseite,
  );
  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function loadBudgetPageBySlug(slug: string): Promise<Haushaltsseite | undefined> {
  const entries = await loadBudgetPages();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadPressReleaseBySlug(
  slug: string,
): Promise<Pressemitteilung | undefined> {
  const entries = await loadPressReleases();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadJobOffers(): Promise<Stellenangebot[]> {
  const entries = await loadCollection(
    portalCollections.stellenangebot.directorySegments,
    parseStellenangebot,
  );
  return entries.sort((left, right) => right.datePosted.localeCompare(left.datePosted));
}

export async function loadJobOfferBySlug(slug: string): Promise<Stellenangebot | undefined> {
  const entries = await loadJobOffers();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadPages(): Promise<Seite[]> {
  const entries = await loadCollection(
    portalCollections.serviceSeite.directorySegments,
    parseSeite,
  );
  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function loadPageBySlug(slug: string): Promise<Seite | undefined> {
  const entries = await loadPages();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadFreestatePages(): Promise<Seite[]> {
  const entries = await loadCollection(
    portalCollections.freistaatSeite.directorySegments,
    parseSeite,
  );
  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function loadFreestatePageBySlug(slug: string): Promise<Seite | undefined> {
  const entries = await loadFreestatePages();
  return entries.find((entry) => entry.slug === slug);
}

export async function loadFeaturedPressReleases(limit = 3): Promise<Pressemitteilung[]> {
  const entries = await loadPressReleases();
  return entries.filter((entry) => entry.isFeatured).slice(0, limit);
}

export async function loadRecentPressReleases(limit = 3): Promise<Pressemitteilung[]> {
  const entries = await loadPressReleases();
  return entries.slice(0, limit);
}

export async function loadCurrentJobOffers(limit = 3): Promise<Stellenangebot[]> {
  const entries = await loadJobOffers();
  return entries.filter((entry) => isCurrentOrFuture(entry.applicationDeadline)).slice(0, limit);
}
