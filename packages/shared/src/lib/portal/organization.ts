import type {
  Ministerium,
  MinisteriumProfil,
  RegierungMitglied,
  RegierungProfil,
} from '@ostrecht/shared/lib/portal/schema.ts';

export type GovernmentKind = 'cabinet' | 'state-council';
export type GovernmentMembership = 'member' | 'leadership-outside' | 'external';
export type GovernmentOfficeRole = 'head' | 'deputy' | 'member' | 'other';

export interface GovernmentDefinition {
  slug: string;
  title: string;
  kind: GovernmentKind;
  validFrom: string;
  validTo: string | null;
  coalition: string;
  coalitionShort: string;
  coalitionParties: string[];
  legislature: string;
  predecessor: string | null;
  seatOfGovernment: string;
  coalitionSeats: number;
  parliamentSeats: number;
  sourceRefs: string[];
}

export interface GovernmentOfficeDefinition {
  slug: string;
  label: string;
  role: GovernmentOfficeRole;
  membership: GovernmentMembership;
  exclusive: boolean;
  canLeadMinistry: boolean;
  requiresMinistry: boolean;
}

export interface GovernmentAssignment {
  id: string;
  personSlug: string;
  officeSlug: string;
  ministrySlug: string | null;
  governmentSlug: string | null;
  title: string;
  leadershipLabel?: string;
  displayMinistryLabel?: string;
  historicalMinistryLabel?: string;
  validFrom: string;
  validTo: string | null;
  sortOrder: number;
  sourceRefs: string[];
}

export interface OrganizationData {
  governments: GovernmentDefinition[];
  offices: GovernmentOfficeDefinition[];
  assignments: GovernmentAssignment[];
}

export type PersonProfile = RegierungProfil;

export interface CurrentGovernmentState extends GovernmentDefinition {
  headOfGovernment: string;
  headPersonSlug: string;
  deputyHead: string;
  deputyPersonSlug: string;
  memberPersonSlugs: string[];
  memberCount: number;
  stateSecretariatCount: number;
  formedOn: string;
  lastReshuffleOn: string;
}

export interface PersonOrganizationState {
  activeAssignments: GovernmentAssignment[];
  formerAssignments: GovernmentAssignment[];
  futureAssignments: GovernmentAssignment[];
  isActive: boolean;
  isGovernmentMember: boolean;
}

export interface CabinetReshuffleChange {
  ministrySlug: string;
  personSlug: string;
  officeSlug: string;
  title: string;
  leadershipLabel?: string;
  sortOrder: number;
  sourceRefs: string[];
}

export interface CabinetReshuffleInput {
  effectiveDate: string;
  governmentSlug: string;
  summary: string;
  changes: CabinetReshuffleChange[];
}

export interface CabinetReshufflePreviewRow {
  ministrySlug: string;
  ministryName: string;
  beforePersonSlug: string | null;
  beforePersonName: string | null;
  afterPersonSlug: string;
  afterPersonName: string;
}

export interface CabinetReshuffleResult {
  organization: OrganizationData;
  preview: CabinetReshufflePreviewRow[];
  affectedFiles: string[];
  affectedRoutes: string[];
}

export class OrganizationValidationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Organisationsmodell ist ungültig:\n- ${problems.join('\n- ')}`);
    this.name = 'OrganizationValidationError';
    this.problems = problems;
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrganizationValidationError([`${path}: muss ein nichtleerer String sein`]);
  }
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, path);
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null) return null;
  return requiredString(value, path);
}

function requiredSlug(value: unknown, path: string): string {
  const slug = requiredString(value, path);
  if (!SLUG_PATTERN.test(slug)) {
    throw new OrganizationValidationError([`${path}: muss ein technischer Slug sein`]);
  }
  return slug;
}

function requiredDate(value: unknown, path: string): string {
  const date = requiredString(value, path);
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new OrganizationValidationError([`${path}: muss ein gültiges Datum im Format JJJJ-MM-TT sein`]);
  }
  return date;
}

function nullableDate(value: unknown, path: string): string | null {
  if (value === null) return null;
  return requiredDate(value, path);
}

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new OrganizationValidationError([`${path}: muss true oder false sein`]);
  }
  return value;
}

function requiredNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new OrganizationValidationError([`${path}: muss eine Zahl sein`]);
  }
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new OrganizationValidationError([`${path}: muss eine Liste sein`]);
  }
  return value.map((entry, index) => requiredString(entry, `${path}[${index}]`));
}

function objectArray(value: unknown, path: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new OrganizationValidationError([`${path}: muss eine Liste sein`]);
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new OrganizationValidationError([`${path}[${index}]: muss ein Objekt sein`]);
    }
    return entry;
  });
}

function expectRoot(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new OrganizationValidationError([`${path}: muss ein Objekt sein`]);
  }
  return value;
}

export function parseGovernments(value: unknown, path = 'content/organisation/governments.json'): GovernmentDefinition[] {
  const root = expectRoot(value, path);
  return objectArray(root.governments, `${path}.governments`).map((entry, index) => {
    const kind = requiredString(entry.kind, `${path}.governments[${index}].kind`) as GovernmentKind;
    if (!['cabinet', 'state-council'].includes(kind)) {
      throw new OrganizationValidationError([`${path}.governments[${index}].kind: unbekannte Regierungsart`]);
    }
    return {
      slug: requiredSlug(entry.slug, `${path}.governments[${index}].slug`),
      title: requiredString(entry.title, `${path}.governments[${index}].title`),
      kind,
      validFrom: requiredDate(entry.validFrom, `${path}.governments[${index}].validFrom`),
      validTo: nullableDate(entry.validTo, `${path}.governments[${index}].validTo`),
      coalition: requiredString(entry.coalition, `${path}.governments[${index}].coalition`),
      coalitionShort: requiredString(entry.coalitionShort, `${path}.governments[${index}].coalitionShort`),
      coalitionParties: stringArray(entry.coalitionParties, `${path}.governments[${index}].coalitionParties`),
      legislature: requiredString(entry.legislature, `${path}.governments[${index}].legislature`),
      predecessor: nullableString(entry.predecessor, `${path}.governments[${index}].predecessor`),
      seatOfGovernment: requiredString(entry.seatOfGovernment, `${path}.governments[${index}].seatOfGovernment`),
      coalitionSeats: requiredNumber(entry.coalitionSeats, `${path}.governments[${index}].coalitionSeats`),
      parliamentSeats: requiredNumber(entry.parliamentSeats, `${path}.governments[${index}].parliamentSeats`),
      sourceRefs: stringArray(entry.sourceRefs, `${path}.governments[${index}].sourceRefs`),
    };
  });
}

export function parseGovernmentOffices(value: unknown, path = 'content/organisation/offices.json'): GovernmentOfficeDefinition[] {
  const root = expectRoot(value, path);
  return objectArray(root.offices, `${path}.offices`).map((entry, index) => {
    const role = requiredString(entry.role, `${path}.offices[${index}].role`) as GovernmentOfficeRole;
    const membership = requiredString(entry.membership, `${path}.offices[${index}].membership`) as GovernmentMembership;
    if (!['head', 'deputy', 'member', 'other'].includes(role)) {
      throw new OrganizationValidationError([`${path}.offices[${index}].role: unbekannte Rollenart`]);
    }
    if (!['member', 'leadership-outside', 'external'].includes(membership)) {
      throw new OrganizationValidationError([`${path}.offices[${index}].membership: unbekannte Mitgliedschaftsart`]);
    }
    return {
      slug: requiredSlug(entry.slug, `${path}.offices[${index}].slug`),
      label: requiredString(entry.label, `${path}.offices[${index}].label`),
      role,
      membership,
      exclusive: requiredBoolean(entry.exclusive, `${path}.offices[${index}].exclusive`),
      canLeadMinistry: requiredBoolean(entry.canLeadMinistry, `${path}.offices[${index}].canLeadMinistry`),
      requiresMinistry: requiredBoolean(entry.requiresMinistry, `${path}.offices[${index}].requiresMinistry`),
    };
  });
}

export function parseGovernmentAssignments(value: unknown, path = 'content/organisation/assignments.json'): GovernmentAssignment[] {
  const root = expectRoot(value, path);
  return objectArray(root.assignments, `${path}.assignments`).map((entry, index) => ({
    id: requiredSlug(entry.id, `${path}.assignments[${index}].id`),
    personSlug: requiredSlug(entry.personSlug, `${path}.assignments[${index}].personSlug`),
    officeSlug: requiredSlug(entry.officeSlug, `${path}.assignments[${index}].officeSlug`),
    ministrySlug: entry.ministrySlug === null ? null : requiredSlug(entry.ministrySlug, `${path}.assignments[${index}].ministrySlug`),
    governmentSlug: entry.governmentSlug === null ? null : requiredSlug(entry.governmentSlug, `${path}.assignments[${index}].governmentSlug`),
    title: requiredString(entry.title, `${path}.assignments[${index}].title`),
    leadershipLabel: optionalString(entry.leadershipLabel, `${path}.assignments[${index}].leadershipLabel`),
    displayMinistryLabel: optionalString(entry.displayMinistryLabel, `${path}.assignments[${index}].displayMinistryLabel`),
    historicalMinistryLabel: optionalString(entry.historicalMinistryLabel, `${path}.assignments[${index}].historicalMinistryLabel`),
    validFrom: requiredDate(entry.validFrom, `${path}.assignments[${index}].validFrom`),
    validTo: nullableDate(entry.validTo, `${path}.assignments[${index}].validTo`),
    sortOrder: requiredNumber(entry.sortOrder, `${path}.assignments[${index}].sortOrder`),
    sourceRefs: stringArray(entry.sourceRefs, `${path}.assignments[${index}].sourceRefs`),
  }));
}

export function isActiveInterval(validFrom: string, validTo: string | null, date: string): boolean {
  return validFrom <= date && (validTo === null || validTo >= date);
}

function intervalsOverlap(leftFrom: string, leftTo: string | null, rightFrom: string, rightTo: string | null): boolean {
  return leftFrom <= (rightTo ?? '9999-12-31') && rightFrom <= (leftTo ?? '9999-12-31');
}

function assertUnique(values: string[], label: string, problems: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) problems.push(`${label} ist nicht eindeutig: ${value}`);
    seen.add(value);
  }
}

export function validateOrganization(
  organization: OrganizationData,
  profiles: PersonProfile[],
  ministries: MinisteriumProfil[],
  referenceDate?: string,
): void {
  const problems: string[] = [];
  assertUnique(organization.governments.map((entry) => entry.slug), 'Regierungs-Slug', problems);
  assertUnique(organization.offices.map((entry) => entry.slug), 'Amts-Slug', problems);
  assertUnique(organization.assignments.map((entry) => entry.id), 'Zuordnungs-ID', problems);
  assertUnique(profiles.map((entry) => entry.slug), 'Personen-Slug', problems);
  assertUnique(ministries.map((entry) => entry.slug), 'Ressort-Slug', problems);

  const governmentBySlug = new Map(organization.governments.map((entry) => [entry.slug, entry]));
  const officeBySlug = new Map(organization.offices.map((entry) => [entry.slug, entry]));
  const profileBySlug = new Map(profiles.map((entry) => [entry.slug, entry]));
  const ministryBySlug = new Map(ministries.map((entry) => [entry.slug, entry]));

  for (const government of organization.governments) {
    if (government.validTo && government.validFrom > government.validTo) {
      problems.push(`Regierung ${government.slug} besitzt ein umgekehrtes Gültigkeitsintervall`);
    }
    if (government.coalitionSeats > government.parliamentSeats) {
      problems.push(`Regierung ${government.slug} besitzt mehr Koalitions- als Parlamentssitze`);
    }
  }

  for (const assignment of organization.assignments) {
    const office = officeBySlug.get(assignment.officeSlug);
    const government = assignment.governmentSlug ? governmentBySlug.get(assignment.governmentSlug) : undefined;
    if (!profileBySlug.has(assignment.personSlug)) problems.push(`${assignment.id}: unbekannte Person ${assignment.personSlug}`);
    if (!office) problems.push(`${assignment.id}: unbekanntes Amt ${assignment.officeSlug}`);
    if (assignment.ministrySlug && !ministryBySlug.has(assignment.ministrySlug)) problems.push(`${assignment.id}: unbekanntes Ressort ${assignment.ministrySlug}`);
    if (assignment.governmentSlug && !government) problems.push(`${assignment.id}: unbekannte Regierung ${assignment.governmentSlug}`);
    if (assignment.validTo && assignment.validFrom > assignment.validTo) problems.push(`${assignment.id}: umgekehrtes Gültigkeitsintervall`);
    if (office?.requiresMinistry && !assignment.ministrySlug) problems.push(`${assignment.id}: Amt ${office.slug} benötigt ein Ressort`);
    if (!office?.canLeadMinistry && assignment.ministrySlug) problems.push(`${assignment.id}: Amt ${office?.slug ?? assignment.officeSlug} darf kein Ressort leiten`);
    if (government && (assignment.validFrom < government.validFrom || (government.validTo && (assignment.validTo === null || assignment.validTo > government.validTo)))) {
      problems.push(`${assignment.id}: Zuordnung liegt außerhalb der Amtszeit von ${government.slug}`);
    }
  }

  const exclusiveAssignments = organization.assignments.filter((assignment) => officeBySlug.get(assignment.officeSlug)?.exclusive);
  for (let index = 0; index < exclusiveAssignments.length; index += 1) {
    const left = exclusiveAssignments[index];
    for (const right of exclusiveAssignments.slice(index + 1)) {
      if (left.officeSlug === right.officeSlug && left.governmentSlug === right.governmentSlug && intervalsOverlap(left.validFrom, left.validTo, right.validFrom, right.validTo)) {
        problems.push(`Exklusives Amt ${left.officeSlug} ist in ${left.governmentSlug ?? 'externer Organisation'} überlappend besetzt: ${left.id}, ${right.id}`);
      }
    }
  }

  const ministryAssignments = organization.assignments.filter((assignment) => assignment.ministrySlug && officeBySlug.get(assignment.officeSlug)?.canLeadMinistry);
  for (let index = 0; index < ministryAssignments.length; index += 1) {
    const left = ministryAssignments[index];
    for (const right of ministryAssignments.slice(index + 1)) {
      if (left.ministrySlug === right.ministrySlug && intervalsOverlap(left.validFrom, left.validTo, right.validFrom, right.validTo)) {
        problems.push(`Ressort ${left.ministrySlug} besitzt überlappende Leitungen: ${left.id}, ${right.id}`);
      }
    }
  }

  if (referenceDate) {
    const activeGovernments = organization.governments.filter((entry) => isActiveInterval(entry.validFrom, entry.validTo, referenceDate));
    if (activeGovernments.length !== 1) problems.push(`Am ${referenceDate} muss genau eine Regierung aktiv sein, gefunden: ${activeGovernments.length}`);
    const activeGovernment = activeGovernments[0];
    if (activeGovernment) {
      const activeAssignments = organization.assignments.filter((entry) => entry.governmentSlug === activeGovernment.slug && isActiveInterval(entry.validFrom, entry.validTo, referenceDate));
      const heads = activeAssignments.filter((entry) => officeBySlug.get(entry.officeSlug)?.role === 'head');
      const deputies = activeAssignments.filter((entry) => officeBySlug.get(entry.officeSlug)?.role === 'deputy');
      if (heads.length !== 1) problems.push(`${activeGovernment.slug}: am ${referenceDate} muss genau eine Leitung aktiv sein`);
      if (deputies.length !== 1) problems.push(`${activeGovernment.slug}: am ${referenceDate} muss genau eine Stellvertretung aktiv sein`);
    }
    for (const ministry of ministries) {
      const leaders = ministryAssignments.filter((entry) => entry.ministrySlug === ministry.slug && isActiveInterval(entry.validFrom, entry.validTo, referenceDate));
      if (leaders.length !== 1) problems.push(`${ministry.slug}: am ${referenceDate} muss genau eine zulässige Leitung aktiv sein, gefunden: ${leaders.length}`);
    }
  }

  if (problems.length > 0) throw new OrganizationValidationError(problems);
}

export function getPersonOrganizationState(
  personSlug: string,
  organization: OrganizationData,
  date: string,
): PersonOrganizationState {
  const officeBySlug = new Map(organization.offices.map((entry) => [entry.slug, entry]));
  const assignments = organization.assignments.filter((entry) => entry.personSlug === personSlug);
  const activeAssignments = assignments
    .filter((entry) => isActiveInterval(entry.validFrom, entry.validTo, date))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, 'de'));
  const formerAssignments = assignments
    .filter((entry) => entry.validTo !== null && entry.validTo < date)
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom));
  const futureAssignments = assignments
    .filter((entry) => entry.validFrom > date)
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  return {
    activeAssignments,
    formerAssignments,
    futureAssignments,
    isActive: activeAssignments.length > 0,
    isGovernmentMember: activeAssignments.some((entry) => officeBySlug.get(entry.officeSlug)?.membership === 'member'),
  };
}

export function deriveCurrentGovernment(
  organization: OrganizationData,
  profiles: PersonProfile[],
  ministries: MinisteriumProfil[],
  date: string,
): CurrentGovernmentState {
  validateOrganization(organization, profiles, ministries, date);
  const government = organization.governments.find((entry) => isActiveInterval(entry.validFrom, entry.validTo, date));
  if (!government) throw new OrganizationValidationError([`Am ${date} ist keine Regierung aktiv`]);
  const officeBySlug = new Map(organization.offices.map((entry) => [entry.slug, entry]));
  const profileBySlug = new Map(profiles.map((entry) => [entry.slug, entry]));
  const activeAssignments = organization.assignments.filter((entry) => entry.governmentSlug === government.slug && isActiveInterval(entry.validFrom, entry.validTo, date));
  const head = activeAssignments.find((entry) => officeBySlug.get(entry.officeSlug)?.role === 'head');
  const deputy = activeAssignments.find((entry) => officeBySlug.get(entry.officeSlug)?.role === 'deputy');
  if (!head || !deputy) throw new OrganizationValidationError([`${government.slug}: Leitung oder Stellvertretung fehlt`]);
  const memberPersonSlugs = [...new Set(activeAssignments.filter((entry) => officeBySlug.get(entry.officeSlug)?.membership === 'member').map((entry) => entry.personSlug))]
    .sort((left, right) => {
      const leftOrder = Math.min(...activeAssignments.filter((entry) => entry.personSlug === left).map((entry) => entry.sortOrder));
      const rightOrder = Math.min(...activeAssignments.filter((entry) => entry.personSlug === right).map((entry) => entry.sortOrder));
      return leftOrder - rightOrder;
    });
  const lastReshuffleOn = activeAssignments.reduce((latest, entry) => entry.validFrom > latest ? entry.validFrom : latest, government.validFrom);
  return {
    ...government,
    headOfGovernment: profileBySlug.get(head.personSlug)?.name ?? head.personSlug,
    headPersonSlug: head.personSlug,
    deputyHead: profileBySlug.get(deputy.personSlug)?.name ?? deputy.personSlug,
    deputyPersonSlug: deputy.personSlug,
    memberPersonSlugs,
    memberCount: memberPersonSlugs.length,
    stateSecretariatCount: ministries.filter((entry) => entry.slug !== 'staatskanzlei').length,
    formedOn: government.validFrom,
    lastReshuffleOn,
  };
}

function assignmentMinistryName(assignment: GovernmentAssignment, ministryBySlug: Map<string, MinisteriumProfil>): string | undefined {
  if (assignment.displayMinistryLabel) return assignment.displayMinistryLabel;
  if (assignment.historicalMinistryLabel) return assignment.historicalMinistryLabel;
  if (!assignment.ministrySlug) return undefined;
  return ministryBySlug.get(assignment.ministrySlug)?.name;
}

export function deriveGovernmentMember(
  profile: PersonProfile,
  organization: OrganizationData,
  ministries: MinisteriumProfil[],
  date: string,
): RegierungMitglied {
  const state = getPersonOrganizationState(profile.slug, organization, date);
  const ministryBySlug = new Map(ministries.map((entry) => [entry.slug, entry]));
  const activeGovernmentAssignments = state.activeAssignments.filter((entry) => entry.governmentSlug !== null || entry.ministrySlug !== null);
  const displayAssignments = activeGovernmentAssignments.length > 0 ? activeGovernmentAssignments : state.formerAssignments.slice(0, 2);
  const relevantAssignments = organization.assignments.filter((entry) => entry.personSlug === profile.slug && (entry.governmentSlug !== null || entry.ministrySlug !== null));
  const servingFrom = relevantAssignments.map((entry) => entry.validFrom).sort()[0];
  const servingTo = state.isActive ? undefined : relevantAssignments.map((entry) => entry.validTo).filter((entry): entry is string => Boolean(entry)).sort().at(-1);
  return {
    ...profile,
    amt: displayAssignments.map((entry) => entry.title).join(' sowie '),
    ressort: displayAssignments.map((entry) => assignmentMinistryName(entry, ministryBySlug)).filter((entry): entry is string => Boolean(entry)).join('; '),
    reihenfolge: Math.min(...displayAssignments.map((entry) => entry.sortOrder), 999),
    current: state.isActive,
    servingFrom,
    servingTo,
    currentOffices: state.activeAssignments.map((entry) => ({
      title: entry.title,
      ministry: assignmentMinistryName(entry, ministryBySlug),
      servingFrom: entry.validFrom,
      servingTo: entry.validTo ?? undefined,
    })),
    formerOffices: state.formerAssignments.map((entry) => ({
      title: entry.title,
      ministry: assignmentMinistryName(entry, ministryBySlug),
      servingFrom: entry.validFrom,
      servingTo: entry.validTo ?? undefined,
    })),
    appointmentSource: state.activeAssignments.flatMap((entry) => entry.sourceRefs)[0] ?? relevantAssignments.flatMap((entry) => entry.sourceRefs)[0],
  };
}

export function deriveMinistry(
  ministry: MinisteriumProfil,
  organization: OrganizationData,
  profiles: PersonProfile[],
  date: string,
): Ministerium {
  const officeBySlug = new Map(organization.offices.map((entry) => [entry.slug, entry]));
  const profileBySlug = new Map(profiles.map((entry) => [entry.slug, entry]));
  const leaders = organization.assignments.filter((entry) =>
    entry.ministrySlug === ministry.slug &&
    officeBySlug.get(entry.officeSlug)?.canLeadMinistry &&
    isActiveInterval(entry.validFrom, entry.validTo, date));
  if (leaders.length !== 1) {
    throw new OrganizationValidationError([`${ministry.slug}: am ${date} wurde keine eindeutige Leitung abgeleitet`]);
  }
  const leader = leaders[0];
  const name = profileBySlug.get(leader.personSlug)?.name ?? leader.personSlug;
  const leadershipLinks = [{ label: `Profil von ${name}`, href: `/staatsregierung/mitglieder/${leader.personSlug}/` }];
  if (ministry.slug === 'staatskanzlei') {
    const head = organization.assignments.find((entry) => officeBySlug.get(entry.officeSlug)?.role === 'head' && isActiveInterval(entry.validFrom, entry.validTo, date));
    if (head && head.personSlug !== leader.personSlug) {
      leadershipLinks.push({ label: 'Profil des Staatspräsidenten', href: `/staatsregierung/mitglieder/${head.personSlug}/` });
    }
  }
  return {
    ...ministry,
    leitung: `${leader.leadershipLabel ?? leader.title} ${name}`,
    verknuepfteLinks: ministry.slug === 'staatskanzlei'
      ? [...ministry.verknuepfteLinks, ...leadershipLinks]
      : [...leadershipLinks, ...ministry.verknuepfteLinks],
  };
}

function previousDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function uniqueAssignmentId(base: string, assignments: GovernmentAssignment[]): string {
  const ids = new Set(assignments.map((entry) => entry.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function applyCabinetReshuffle(
  organization: OrganizationData,
  profiles: PersonProfile[],
  ministries: MinisteriumProfil[],
  input: CabinetReshuffleInput,
): CabinetReshuffleResult {
  if (!DATE_PATTERN.test(input.effectiveDate)) throw new OrganizationValidationError(['Wirksamkeitsdatum ist ungültig']);
  if (input.changes.length === 0) throw new OrganizationValidationError(['Mindestens eine Umbesetzung ist erforderlich']);
  const working: OrganizationData = structuredClone(organization);
  const profileBySlug = new Map(profiles.map((entry) => [entry.slug, entry]));
  const ministryBySlug = new Map(ministries.map((entry) => [entry.slug, entry]));
  const officeBySlug = new Map(working.offices.map((entry) => [entry.slug, entry]));
  const preview: CabinetReshufflePreviewRow[] = [];
  const routeSet = new Set(['/staatsregierung/', '/staatsregierung/kabinett/', '/staatsregierung/mitglieder/', '/']);
  const seenMinistries = new Set<string>();

  for (const change of input.changes) {
    if (seenMinistries.has(change.ministrySlug)) throw new OrganizationValidationError([`Ressort ${change.ministrySlug} ist im Vorgang doppelt enthalten`]);
    seenMinistries.add(change.ministrySlug);
    const ministry = ministryBySlug.get(change.ministrySlug);
    const person = profileBySlug.get(change.personSlug);
    const office = officeBySlug.get(change.officeSlug);
    if (!ministry) throw new OrganizationValidationError([`Unbekanntes Ressort: ${change.ministrySlug}`]);
    if (!person) throw new OrganizationValidationError([`Unbekannte Person: ${change.personSlug}`]);
    if (!office?.canLeadMinistry) throw new OrganizationValidationError([`Amt ${change.officeSlug} ist nicht zur Ressortleitung zugelassen`]);
    const previous = working.assignments.find((entry) => entry.ministrySlug === change.ministrySlug && officeBySlug.get(entry.officeSlug)?.canLeadMinistry && isActiveInterval(entry.validFrom, entry.validTo, input.effectiveDate));
    if (previous) {
      if (previous.validFrom === input.effectiveDate) {
        working.assignments = working.assignments.filter((entry) => entry.id !== previous.id);
      } else {
        previous.validTo = previousDay(input.effectiveDate);
      }
    }
    const idBase = `${input.effectiveDate}-${change.ministrySlug}-${change.personSlug}`;
    working.assignments.push({
      id: uniqueAssignmentId(idBase, working.assignments),
      personSlug: change.personSlug,
      officeSlug: change.officeSlug,
      ministrySlug: change.ministrySlug,
      governmentSlug: input.governmentSlug,
      title: change.title,
      leadershipLabel: change.leadershipLabel,
      validFrom: input.effectiveDate,
      validTo: null,
      sortOrder: change.sortOrder,
      sourceRefs: change.sourceRefs,
    });
    preview.push({
      ministrySlug: ministry.slug,
      ministryName: ministry.name,
      beforePersonSlug: previous?.personSlug ?? null,
      beforePersonName: previous ? profileBySlug.get(previous.personSlug)?.name ?? previous.personSlug : null,
      afterPersonSlug: person.slug,
      afterPersonName: person.name,
    });
    routeSet.add(`/staatsregierung/kabinett/${ministry.slug}/`);
    routeSet.add(`/staatsregierung/mitglieder/${person.slug}/`);
    if (previous) routeSet.add(`/staatsregierung/mitglieder/${previous.personSlug}/`);
  }

  working.assignments.sort((left, right) => left.validFrom.localeCompare(right.validFrom) || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  validateOrganization(working, profiles, ministries, input.effectiveDate);
  return {
    organization: working,
    preview,
    affectedFiles: ['content/organisation/assignments.json'],
    affectedRoutes: [...routeSet].sort(),
  };
}
