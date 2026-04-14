export class PortalContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortalContentValidationError';
  }
}

export interface PortalContact {
  name?: string;
  email?: string;
  telefon?: string;
  referat?: string;
}

export interface PortalLink {
  label: string;
  href: string;
}

export interface RegierungMitglied {
  slug: string;
  name: string;
  amt: string;
  ressort: string;
  reihenfolge: number;
  kurzbiografie: string;
  langbiografie: string[];
  bild: string;
  bildnachweis: string;
  kontakt?: PortalContact;
  zitat?: string;
}

export interface Ministerium {
  slug: string;
  name: string;
  kurzname: string;
  leitung: string;
  teaser: string;
  aufgaben: string[];
  kontakt: PortalContact;
  bild: string;
  bildnachweis: string;
  themen: string[];
  verknuepfteLinks: PortalLink[];
}

export interface Pressemitteilung {
  slug: string;
  title: string;
  date: string;
  teaser: string;
  image: string;
  imageAlt: string;
  imageCredit: string;
  ministry: string;
  tags: string[];
  body: string[];
  isFeatured: boolean;
}

export interface Stellenangebot {
  slug: string;
  title: string;
  ministry: string;
  datePosted: string;
  applicationDeadline: string;
  location: string;
  employmentType: string;
  payGrade?: string;
  teaser: string;
  body: string[];
  contact?: PortalContact;
}

export interface Seite {
  slug: string;
  title: string;
  body: string[];
}

function createPath(prefix: string, key: string): string {
  return `${prefix}.${key}`;
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Objekt sein`);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PortalContentValidationError(`${path}: muss ein nichtleerer String sein`);
  }

  return value.trim();
}

function expectOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return expectString(value, path);
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PortalContentValidationError(`${path}: muss eine Zahl sein`);
  }

  return value;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new PortalContentValidationError(`${path}: muss true oder false sein`);
  }

  return value;
}

function expectDate(value: unknown, path: string): string {
  const date = expectString(value, path);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new PortalContentValidationError(`${path}: muss im Format JJJJ-MM-TT vorliegen`);
  }

  return date;
}

function expectSlug(value: unknown, path: string): string {
  const slug = expectString(value, path);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    throw new PortalContentValidationError(`${path}: muss ein technischer Slug sein`);
  }

  return slug;
}

function expectStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => expectString(entry, `${path}[${index}]`));
}

function parseContact(value: unknown, path: string): PortalContact | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const entry = expectRecord(value, path);
  return {
    name: expectOptionalString(entry.name, createPath(path, 'name')),
    email: expectOptionalString(entry.email, createPath(path, 'email')),
    telefon: expectOptionalString(entry.telefon, createPath(path, 'telefon')),
    referat: expectOptionalString(entry.referat, createPath(path, 'referat')),
  };
}

function parseLinks(value: unknown, path: string): PortalLink[] {
  if (!Array.isArray(value)) {
    throw new PortalContentValidationError(`${path}: muss ein Array sein`);
  }

  return value.map((entry, index) => {
    const record = expectRecord(entry, `${path}[${index}]`);
    return {
      label: expectString(record.label, `${path}[${index}].label`),
      href: expectString(record.href, `${path}[${index}].href`),
    };
  });
}

export function parseRegierungMitglied(value: unknown, path: string): RegierungMitglied {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    name: expectString(entry.name, createPath(path, 'name')),
    amt: expectString(entry.amt, createPath(path, 'amt')),
    ressort: expectString(entry.ressort, createPath(path, 'ressort')),
    reihenfolge: expectNumber(entry.reihenfolge, createPath(path, 'reihenfolge')),
    kurzbiografie: expectString(entry.kurzbiografie, createPath(path, 'kurzbiografie')),
    langbiografie: expectStringArray(entry.langbiografie, createPath(path, 'langbiografie')),
    bild: expectString(entry.bild, createPath(path, 'bild')),
    bildnachweis: expectString(entry.bildnachweis, createPath(path, 'bildnachweis')),
    kontakt: parseContact(entry.kontakt, createPath(path, 'kontakt')),
    zitat: expectOptionalString(entry.zitat, createPath(path, 'zitat')),
  };
}

export function parseMinisterium(value: unknown, path: string): Ministerium {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    name: expectString(entry.name, createPath(path, 'name')),
    kurzname: expectString(entry.kurzname, createPath(path, 'kurzname')),
    leitung: expectString(entry.leitung, createPath(path, 'leitung')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    aufgaben: expectStringArray(entry.aufgaben, createPath(path, 'aufgaben')),
    kontakt: parseContact(entry.kontakt, createPath(path, 'kontakt')) ?? {},
    bild: expectString(entry.bild, createPath(path, 'bild')),
    bildnachweis: expectString(entry.bildnachweis, createPath(path, 'bildnachweis')),
    themen: expectStringArray(entry.themen, createPath(path, 'themen')),
    verknuepfteLinks: parseLinks(entry.verknuepfteLinks, createPath(path, 'verknuepfteLinks')),
  };
}

export function parsePressemitteilung(value: unknown, path: string): Pressemitteilung {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    date: expectDate(entry.date, createPath(path, 'date')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    image: expectString(entry.image, createPath(path, 'image')),
    imageAlt: expectString(entry.imageAlt, createPath(path, 'imageAlt')),
    imageCredit: expectString(entry.imageCredit, createPath(path, 'imageCredit')),
    ministry: expectString(entry.ministry, createPath(path, 'ministry')),
    tags: expectStringArray(entry.tags, createPath(path, 'tags')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
    isFeatured: expectBoolean(entry.isFeatured, createPath(path, 'isFeatured')),
  };
}

export function parseStellenangebot(value: unknown, path: string): Stellenangebot {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    ministry: expectString(entry.ministry, createPath(path, 'ministry')),
    datePosted: expectDate(entry.datePosted, createPath(path, 'datePosted')),
    applicationDeadline: expectDate(
      entry.applicationDeadline,
      createPath(path, 'applicationDeadline'),
    ),
    location: expectString(entry.location, createPath(path, 'location')),
    employmentType: expectString(entry.employmentType, createPath(path, 'employmentType')),
    payGrade: expectOptionalString(entry.payGrade, createPath(path, 'payGrade')),
    teaser: expectString(entry.teaser, createPath(path, 'teaser')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
    contact: parseContact(entry.contact, createPath(path, 'contact')),
  };
}

export function parseSeite(value: unknown, path: string): Seite {
  const entry = expectRecord(value, path);

  return {
    slug: expectSlug(entry.slug, createPath(path, 'slug')),
    title: expectString(entry.title, createPath(path, 'title')),
    body: expectStringArray(entry.body, createPath(path, 'body')),
  };
}
