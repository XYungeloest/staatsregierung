import { PortalContentValidationError } from './schema.ts';

export type ActionPlanStatus = 'umgesetzt' | 'teilweise_umgesetzt' | 'angelegt';

export interface ActionPlanReference {
  label: string;
  normSlug: string;
}

export interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  status: ActionPlanStatus;
  ressort: string;
  href: string;
  references?: ActionPlanReference[];
}

export type TimelineEntryType = 'gesetz' | 'projekt' | 'kabinett' | 'presse' | 'haushalt';

export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  type: TimelineEntryType;
  summary: string;
  ressort?: string;
  href?: string;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PortalContentValidationError(`${path}: muss ein Objekt sein`);
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new PortalContentValidationError(`${path}: muss ein nichtleerer String sein`);
  return value.trim();
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new PortalContentValidationError(`${path}: muss eine Liste sein`);
  return value;
}

export function parseActionPlanData(value: unknown, path = 'content/dashboard/action-plan.json'): ActionPlanItem[] {
  const root = record(value, path);
  return array(root.items, `${path}.items`).map((raw, index) => {
    const entry = record(raw, `${path}.items[${index}]`);
    const status = string(entry.status, `${path}.items[${index}].status`) as ActionPlanStatus;
    if (!['umgesetzt', 'teilweise_umgesetzt', 'angelegt'].includes(status)) throw new PortalContentValidationError(`${path}.items[${index}].status: unbekannter Status`);
    const references = entry.references === undefined ? undefined : array(entry.references, `${path}.items[${index}].references`).map((rawReference, referenceIndex) => {
      const reference = record(rawReference, `${path}.items[${index}].references[${referenceIndex}]`);
      return { label: string(reference.label, `${path}.items[${index}].references[${referenceIndex}].label`), normSlug: string(reference.normSlug, `${path}.items[${index}].references[${referenceIndex}].normSlug`) };
    });
    return {
      id: string(entry.id, `${path}.items[${index}].id`),
      title: string(entry.title, `${path}.items[${index}].title`),
      description: string(entry.description, `${path}.items[${index}].description`),
      status,
      ressort: string(entry.ressort, `${path}.items[${index}].ressort`),
      href: string(entry.href, `${path}.items[${index}].href`),
      references,
    };
  });
}

export function parseTimelineData(value: unknown, path = 'content/dashboard/timeline.json'): TimelineEntry[] {
  const root = record(value, path);
  const allowedTypes: TimelineEntryType[] = ['gesetz', 'projekt', 'kabinett', 'presse', 'haushalt'];
  return array(root.entries, `${path}.entries`).map((raw, index) => {
    const entry = record(raw, `${path}.entries[${index}]`);
    const type = string(entry.type, `${path}.entries[${index}].type`) as TimelineEntryType;
    if (!allowedTypes.includes(type)) throw new PortalContentValidationError(`${path}.entries[${index}].type: unbekannter Ereignistyp`);
    const date = string(entry.date, `${path}.entries[${index}].date`);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new PortalContentValidationError(`${path}.entries[${index}].date: muss im Format JJJJ-MM-TT vorliegen`);
    return {
      id: string(entry.id, `${path}.entries[${index}].id`), date, title: string(entry.title, `${path}.entries[${index}].title`), type,
      summary: string(entry.summary, `${path}.entries[${index}].summary`),
      ressort: entry.ressort === undefined ? undefined : string(entry.ressort, `${path}.entries[${index}].ressort`),
      href: entry.href === undefined ? undefined : string(entry.href, `${path}.entries[${index}].href`),
    };
  }).sort((left, right) => left.date.localeCompare(right.date));
}
