import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PortalContentValidationError } from './schema.ts';

export const LEGISLATIVE_STAGES = [
  'eingebracht',
  'erste-lesung-angesetzt',
  'erste-lesung-abgeschlossen',
  'ausschussberatung',
  'zweite-lesung-angesetzt',
  'beschlussempfehlung-annahme',
  'beschlussempfehlung-ablehnung',
  'beschlossen',
  'verkuendet',
  'in-kraft',
  'erledigt',
] as const;

export type LegislativeProcedureStage = (typeof LEGISLATIVE_STAGES)[number];

export interface LegislativeSource {
  label: string;
  kind: 'drucksache' | 'beschlussempfehlung' | 'tagesordnung' | 'entwurf';
  availability: 'local' | 'external' | 'missing';
  localSource?: string;
  sourceUrl?: string;
}

export interface LegislativeRecommendation {
  documentNumber: string;
  result: 'annahme' | 'ablehnung';
}

export interface LegislativeProcedure {
  slug: string;
  title: string;
  shortTitle: string;
  documentNumber: string;
  initiator: string;
  introducedOn?: string;
  stage: LegislativeProcedureStage;
  statusLabel: string;
  nextScheduledReading: {
    date: string;
    reading: 'erste-lesung' | 'zweite-lesung';
  };
  leadCommittee?: string;
  proposedCommittee?: string;
  recommendation?: LegislativeRecommendation;
  sources: LegislativeSource[];
  relatedTopics: string[];
  relatedMinistries: string[];
  relatedNorms: string[];
  confirmedAsOf: string;
  group?: string;
  dateNote?: string;
}

const CONTENT_ROOT = resolve(process.cwd(), 'content', 'gesetzgebung');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DOCUMENT_NUMBER_PATTERN = /^07\/\d{2}$/u;

function fail(path: string, message: string): never {
  throw new PortalContentValidationError(`${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'muss ein Objekt sein');
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'muss ein nichtleerer String sein');
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : string(value, path);
}

function date(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed)) fail(path, 'muss im Format JJJJ-MM-TT vorliegen');
  return parsed;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'muss ein Array sein');
  return value.map((entry, index) => string(entry, `${path}[${index}]`));
}

function parseProcedure(value: unknown, path: string): LegislativeProcedure {
  const entry = record(value, path);
  const slug = string(entry.slug, `${path}.slug`);
  const documentNumber = string(entry.documentNumber, `${path}.documentNumber`);
  const stage = string(entry.stage, `${path}.stage`) as LegislativeProcedureStage;
  if (!SLUG_PATTERN.test(slug)) fail(`${path}.slug`, 'muss ein technischer Slug sein');
  if (!DOCUMENT_NUMBER_PATTERN.test(documentNumber)) fail(`${path}.documentNumber`, 'muss dem Muster 07/00 entsprechen');
  if (!LEGISLATIVE_STAGES.includes(stage)) fail(`${path}.stage`, 'enthält eine unbekannte Verfahrensstufe');

  const scheduled = record(entry.nextScheduledReading, `${path}.nextScheduledReading`);
  const reading = string(scheduled.reading, `${path}.nextScheduledReading.reading`);
  if (reading !== 'erste-lesung' && reading !== 'zweite-lesung') {
    fail(`${path}.nextScheduledReading.reading`, 'muss erste-lesung oder zweite-lesung sein');
  }

  const recommendation = entry.recommendation
    ? record(entry.recommendation, `${path}.recommendation`)
    : undefined;
  const recommendationResult = recommendation
    ? string(recommendation.result, `${path}.recommendation.result`)
    : undefined;
  if (recommendationResult && recommendationResult !== 'annahme' && recommendationResult !== 'ablehnung') {
    fail(`${path}.recommendation.result`, 'muss annahme oder ablehnung sein');
  }

  if (!Array.isArray(entry.sources)) fail(`${path}.sources`, 'muss ein Array sein');
  const sources = entry.sources.map((source, index) => {
    const sourceEntry = record(source, `${path}.sources[${index}]`);
    const kind = string(sourceEntry.kind, `${path}.sources[${index}].kind`) as LegislativeSource['kind'];
    if (!['drucksache', 'beschlussempfehlung', 'tagesordnung', 'entwurf'].includes(kind)) {
      fail(`${path}.sources[${index}].kind`, 'enthält einen unbekannten Quellentyp');
    }
    const availability = string(
      sourceEntry.availability,
      `${path}.sources[${index}].availability`,
    ) as LegislativeSource['availability'];
    if (!['local', 'external', 'missing'].includes(availability)) {
      fail(`${path}.sources[${index}].availability`, 'muss local, external oder missing sein');
    }
    const localSource = optionalString(sourceEntry.localSource, `${path}.sources[${index}].localSource`);
    const sourceUrl = optionalString(sourceEntry.sourceUrl, `${path}.sources[${index}].sourceUrl`);
    if (availability === 'local' && !localSource) {
      fail(`${path}.sources[${index}].localSource`, 'ist für eine lokale Quelle erforderlich');
    }
    if (availability === 'external' && !sourceUrl) {
      fail(`${path}.sources[${index}].sourceUrl`, 'ist für eine externe Quelle erforderlich');
    }
    if (availability === 'missing' && (localSource || sourceUrl)) {
      fail(`${path}.sources[${index}]`, 'darf für eine fehlende Quelle keinen Pfad oder URL behaupten');
    }
    return {
      label: string(sourceEntry.label, `${path}.sources[${index}].label`),
      kind,
      availability,
      localSource,
      sourceUrl,
    };
  });

  return {
    slug,
    title: string(entry.title, `${path}.title`),
    shortTitle: string(entry.shortTitle, `${path}.shortTitle`),
    documentNumber,
    initiator: string(entry.initiator, `${path}.initiator`),
    introducedOn: entry.introducedOn ? date(entry.introducedOn, `${path}.introducedOn`) : undefined,
    stage,
    statusLabel: string(entry.statusLabel, `${path}.statusLabel`),
    nextScheduledReading: {
      date: date(scheduled.date, `${path}.nextScheduledReading.date`),
      reading: reading as 'erste-lesung' | 'zweite-lesung',
    },
    leadCommittee: optionalString(entry.leadCommittee, `${path}.leadCommittee`),
    proposedCommittee: optionalString(entry.proposedCommittee, `${path}.proposedCommittee`),
    recommendation: recommendation
      ? {
          documentNumber: string(recommendation.documentNumber, `${path}.recommendation.documentNumber`),
          result: recommendationResult as 'annahme' | 'ablehnung',
        }
      : undefined,
    sources,
    relatedTopics: stringArray(entry.relatedTopics, `${path}.relatedTopics`),
    relatedMinistries: stringArray(entry.relatedMinistries, `${path}.relatedMinistries`),
    relatedNorms: stringArray(entry.relatedNorms, `${path}.relatedNorms`),
    confirmedAsOf: date(entry.confirmedAsOf, `${path}.confirmedAsOf`),
    group: optionalString(entry.group, `${path}.group`),
    dateNote: optionalString(entry.dateNote, `${path}.dateNote`),
  };
}

export async function loadLegislativeProcedures(): Promise<LegislativeProcedure[]> {
  const entries = await readdir(CONTENT_ROOT, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const fileNames = entries
    .filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry: Dirent) => entry.name)
    .sort((left: string, right: string) => left.localeCompare(right, 'de'));
  const procedures = await Promise.all(fileNames.map(async (fileName) => {
    const value = JSON.parse(await readFile(join(CONTENT_ROOT, fileName), 'utf8')) as unknown;
    const procedure = parseProcedure(value, `content/gesetzgebung/${fileName}`);
    if (`${procedure.slug}.json` !== fileName) fail(`content/gesetzgebung/${fileName}.slug`, 'muss dem Dateinamen entsprechen');
    return procedure;
  }));
  return procedures.sort((left, right) => left.documentNumber.localeCompare(right.documentNumber, 'de', { numeric: true }));
}

export function formatLegislativeProcedureStage(stage: LegislativeProcedureStage): string {
  const labels: Record<LegislativeProcedureStage, string> = {
    eingebracht: 'Eingebracht',
    'erste-lesung-angesetzt': 'Erste Lesung angesetzt',
    'erste-lesung-abgeschlossen': 'Erste Lesung abgeschlossen',
    ausschussberatung: 'Ausschussberatung',
    'zweite-lesung-angesetzt': 'Zweite Lesung angesetzt',
    'beschlussempfehlung-annahme': 'Annahme empfohlen',
    'beschlussempfehlung-ablehnung': 'Ablehnung empfohlen',
    beschlossen: 'Beschlossen',
    verkuendet: 'Verkündet',
    'in-kraft': 'In Kraft',
    erledigt: 'Erledigt',
  };
  return labels[stage];
}
