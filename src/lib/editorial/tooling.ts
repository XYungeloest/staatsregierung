import {
  parseNormHistory,
  parseNormMeta,
  parseNormVersion,
  validateNormRecord,
  type NormBodyBlock,
  type NormHistory,
  type NormHistoryEntry,
  type NormMeta,
  type NormRecord,
  type NormStatus,
  type NormType,
  type NormVersion,
} from '../norms/schema.ts';

export interface EditorialExistingNormData {
  meta: NormMeta;
  history: NormHistory;
  versions: NormVersion[];
}

export interface EditorialBootstrapData {
  norms: EditorialExistingNormData[];
}

export interface GeneratedFile {
  label: string;
  path: string;
  description: string;
  content: string;
}

export interface EditorialBuildResult {
  files: GeneratedFile[];
  warnings: string[];
  summary: string;
}

export interface NewNormInput {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  abbr: string;
  type: NormType;
  ministry: string;
  subjectsText: string;
  keywordsText: string;
  initialCitation: string;
  summary: string;
  status: NormStatus;
  versionId: string;
  validFrom: string;
  validTo: string;
  isCurrent: boolean;
  citation: string;
  changeNote: string;
  bodyText: string;
}

export interface NewVersionInput {
  normSlug: string;
  versionId: string;
  validFrom: string;
  validTo: string;
  isCurrent: boolean;
  citation: string;
  changeNote: string;
  bodyText: string;
  createHistoryEntry: boolean;
  historyTitle: string;
  historyNote: string;
}

export type BodyTemplateKey = 'law' | 'directive' | 'empty';

const BODY_TEMPLATES: Record<BodyTemplateKey, NormBodyBlock[]> = {
  law: [
    {
      type: 'section',
      label: 'Abschnitt 1',
      title: 'Allgemeine Bestimmungen',
      children: [
        {
          type: 'paragraph',
          label: '§ 1',
          title: 'Gegenstand',
          children: [
            {
              type: 'paragraphText',
              text: 'Diese Norm regelt den sachlichen Anwendungsbereich.',
            },
          ],
        },
        {
          type: 'paragraph',
          label: '§ 2',
          title: 'Begriffsbestimmungen',
          children: [
            {
              type: 'item',
              label: '1.',
              text: 'Beispielbegriff Nummer eins.',
            },
            {
              type: 'item',
              label: '2.',
              text: 'Beispielbegriff Nummer zwei.',
            },
          ],
        },
      ],
    },
  ],
  directive: [
    {
      type: 'section',
      label: 'I.',
      title: 'Zuwendungszweck',
      children: [
        {
          type: 'paragraphText',
          text: 'Diese Richtlinie beschreibt Zweck, Voraussetzungen und Verfahren.',
        },
        {
          type: 'item',
          label: '1.',
          text: 'Beispielhafte Voraussetzung.',
        },
        {
          type: 'item',
          label: '2.',
          text: 'Beispielhafte Fördersumme oder Maßnahme.',
        },
      ],
    },
    {
      type: 'section',
      label: 'II.',
      title: 'Inkrafttreten',
      children: [
        {
          type: 'paragraphText',
          text: 'Diese Richtlinie tritt am angegebenen Datum in Kraft.',
        },
      ],
    },
  ],
  empty: [],
};

function parseStructuredBody(bodyText: string): unknown {
  try {
    return JSON.parse(bodyText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ungültiges JSON';
    throw new Error(`Norminhalt: enthält ungültiges JSON (${message})`);
  }
}

function parseStringList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function cloneRecord(record: EditorialExistingNormData): NormRecord {
  return structuredClone({
    meta: record.meta,
    history: record.history,
    versions: record.versions,
  });
}

function buildInitialHistoryEntry(version: NormVersion): NormHistoryEntry {
  return {
    date: version.validFrom,
    type: 'initial',
    title: `Erstveröffentlichung vom ${version.validFrom}`,
    citation: version.citation,
    affectingVersionId: version.versionId,
    relatedNorm: null,
  };
}

function buildAmendmentHistoryEntry(input: NewVersionInput, version: NormVersion): NormHistoryEntry {
  return {
    date: version.validFrom,
    type: 'amendment',
    title: input.historyTitle.trim() || `Neue Fassung vom ${version.validFrom}`,
    citation: version.citation,
    note: input.historyNote.trim() || undefined,
    affectingVersionId: version.versionId,
    relatedNorm: null,
  };
}

function dayBefore(value: string): string {
  const [year, month, day] = value.split('-').map((entry) => Number.parseInt(entry, 10));
  const date = new Date(Date.UTC(year, month - 1, day - 1));

  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getCurrentVersion(record: NormRecord): NormVersion {
  const version = record.versions.find((entry) => entry.isCurrent);
  if (!version) {
    throw new Error(`Die Norm ${record.meta.slug} enthält keine aktuelle Fassung.`);
  }

  return version;
}

function createMeta(input: NewNormInput): NormMeta {
  return parseNormMeta({
    id: input.id,
    slug: input.slug,
    title: input.title,
    shortTitle: input.shortTitle,
    abbr: input.abbr,
    type: input.type,
    ministry: input.ministry,
    subjects: parseStringList(input.subjectsText),
    keywords: parseStringList(input.keywordsText),
    initialCitation: input.initialCitation,
    predecessor: null,
    successor: null,
    summary: input.summary,
    status: input.status,
  });
}

function createVersion(
  input: Pick<
    NewNormInput | NewVersionInput,
    'versionId' | 'validFrom' | 'validTo' | 'isCurrent' | 'citation' | 'changeNote' | 'bodyText'
  >,
): NormVersion {
  return parseNormVersion({
    versionId: input.versionId,
    validFrom: input.validFrom,
    validTo: input.validTo.trim() ? input.validTo : null,
    isCurrent: input.isCurrent,
    citation: input.citation,
    changeNote: input.changeNote,
    body: parseStructuredBody(input.bodyText),
  });
}

function buildGeneratedFile(label: string, filePath: string, description: string, value: unknown): GeneratedFile {
  return {
    label,
    path: filePath,
    description,
    content: formatJson(value),
  };
}

export function getBodyTemplate(template: BodyTemplateKey): string {
  return formatJson(BODY_TEMPLATES[template]);
}

export function buildNewNormResult(
  input: NewNormInput,
  existingNorms: EditorialExistingNormData[],
): EditorialBuildResult {
  if (existingNorms.some((record) => record.meta.slug === input.slug)) {
    throw new Error(`Slug "${input.slug}" ist bereits vergeben.`);
  }

  if (existingNorms.some((record) => record.meta.id === input.id)) {
    throw new Error(`ID "${input.id}" ist bereits vergeben.`);
  }

  const meta = createMeta(input);
  const version = createVersion(input);
  const history = parseNormHistory({
    initialVersionId: version.versionId,
    entries: [buildInitialHistoryEntry(version)],
  });

  const record = validateNormRecord({
    meta,
    history,
    versions: [version],
  });

  return {
    summary: `Neue Norm "${record.meta.title}" mit erster Fassung ${record.versions[0].versionId}.`,
    warnings: [],
    files: [
      buildGeneratedFile(
        'meta.json',
        `content/normen/${record.meta.slug}/meta.json`,
        'Stammdaten der neuen Norm',
        record.meta,
      ),
      buildGeneratedFile(
        'history.json',
        `content/normen/${record.meta.slug}/history.json`,
        'Initiale Historie mit Stammfassung',
        record.history,
      ),
      buildGeneratedFile(
        `${record.versions[0].versionId}.json`,
        `content/normen/${record.meta.slug}/versions/${record.versions[0].versionId}.json`,
        'Erste konsolidierte Fassung',
        record.versions[0],
      ),
    ],
  };
}

export function buildNewVersionResult(
  input: NewVersionInput,
  existingNorms: EditorialExistingNormData[],
): EditorialBuildResult {
  const existingNorm = existingNorms.find((record) => record.meta.slug === input.normSlug);
  if (!existingNorm) {
    throw new Error(`Die bestehende Norm "${input.normSlug}" wurde nicht gefunden.`);
  }

  if (existingNorm.versions.some((version) => version.versionId === input.versionId)) {
    throw new Error(`Die Version-ID "${input.versionId}" ist für diese Norm bereits vorhanden.`);
  }

  const record = cloneRecord(existingNorm);
  const newVersion = createVersion(input);
  const warnings: string[] = [];
  let previousCurrentFile: GeneratedFile | null = null;
  let updatedMetaFile: GeneratedFile | null = null;

  if (input.isCurrent) {
    const currentVersion = getCurrentVersion(record);

    if (newVersion.validFrom <= currentVersion.validFrom) {
      throw new Error(
        `Eine neue aktuelle Fassung muss nach der bisherigen aktuellen Fassung (${currentVersion.validFrom}) beginnen.`,
      );
    }

    currentVersion.isCurrent = false;
    currentVersion.validTo = dayBefore(newVersion.validFrom);

    previousCurrentFile = buildGeneratedFile(
      `${currentVersion.versionId}.json`,
      `content/normen/${record.meta.slug}/versions/${currentVersion.versionId}.json`,
      'Aktualisierte bisherige aktuelle Fassung mit gesetztem Rechtsstand-Ende',
      currentVersion,
    );

    if (record.meta.status !== 'in-force') {
      record.meta.status = 'in-force';
      updatedMetaFile = buildGeneratedFile(
        'meta.json',
        `content/normen/${record.meta.slug}/meta.json`,
        'Aktualisierte Stammdaten mit korrigiertem Status',
        record.meta,
      );
      warnings.push('Die Stammdaten wurden zusätzlich mit Status "in Kraft" ausgegeben.');
    }
  }

  record.versions.push(newVersion);

  if (input.createHistoryEntry) {
    record.history.entries.push(buildAmendmentHistoryEntry(input, newVersion));
  } else {
    warnings.push('Es wurde keine aktualisierte history.json erzeugt.');
  }

  const validatedRecord = validateNormRecord(record);
  const files: GeneratedFile[] = [
    buildGeneratedFile(
      `${newVersion.versionId}.json`,
      `content/normen/${validatedRecord.meta.slug}/versions/${newVersion.versionId}.json`,
      'Neue Fassung der bestehenden Norm',
      newVersion,
    ),
  ];

  if (previousCurrentFile) {
    files.push(previousCurrentFile);
  }

  if (input.createHistoryEntry) {
    files.push(
      buildGeneratedFile(
        'history.json',
        `content/normen/${validatedRecord.meta.slug}/history.json`,
        'Aktualisierte Historie einschließlich neuem Historieneintrag',
        validatedRecord.history,
      ),
    );
  }

  if (updatedMetaFile) {
    files.push(updatedMetaFile);
  }

  return {
    summary: `Neue Fassung ${newVersion.versionId} für "${validatedRecord.meta.title}".`,
    warnings,
    files,
  };
}
