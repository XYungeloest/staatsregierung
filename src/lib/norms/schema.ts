export const NORM_TYPES = [
  'gesetz',
  'verordnung',
  'verwaltungsvorschrift',
  'foerderrichtlinie',
  'allgemeinverfuegung',
  'bekanntmachung',
  'staatsvertrag',
  'verwaltungsabkommen',
  'zustimmungsgesetz',
  'aenderungsvorschrift',
] as const;

export const NORM_STATUSES = [
  'in-force',
  'future-effective',
  'pending-effective',
  'repealed',
  'historical',
  'one-time-act',
  'planned',
] as const;

export const HISTORY_ENTRY_TYPES = ['initial', 'amendment', 'repeal', 'notice'] as const;

export const STRUCTURE_TYPES = [
  'part',
  'chapter',
  'section',
  'subsection',
  'paragraph',
  'article',
  'annex',
  'subparagraph',
  'paragraphText',
  'item',
  'subitem',
  'quotedProvision',
  'table',
  'tableRow',
  'tableHeaderCell',
  'tableCell',
] as const;

export const TABLE_HEADER_SCOPES = ['col', 'row', 'colgroup', 'rowgroup'] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export type NormType = (typeof NORM_TYPES)[number];
export type NormStatus = (typeof NORM_STATUSES)[number];
export type HistoryEntryType = (typeof HISTORY_ENTRY_TYPES)[number];
export type StructureType = (typeof STRUCTURE_TYPES)[number];
export type TableHeaderScope = (typeof TABLE_HEADER_SCOPES)[number];

export interface NormSourceReference {
  kind:
    | 'structured-html-transcription'
    | 'legacy-markdown-transcription'
    | 'supplementary-markdown-transcription'
    | 'revosax-snapshot'
    | 'amendment-source'
    | 'primary-pdf'
    | 'structured-docx-source';
  label: string;
  availability: 'versioned';
  localSource: string;
  url?: string;
  retrievedAt?: string;
  sha256?: string;
  lawId?: string;
  sourceValidFrom?: string;
  sourceValidTo?: string;
  mediaType?: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/html' | 'text/markdown';
  pageCount?: number;
  pageRange?: string;
  verifiedAt?: string;
  sourceRole?: 'structure-bearing' | 'visual-control' | 'supplementary-transcription' | 'official-snapshot' | 'amendment-evidence';
  derivedSource?: string;
}

export interface NormSourceNote {
  label: string;
  text: string;
}

export interface AgreementPartyReference {
  name: string;
  institutionId?: string;
}

export interface AgreementSignatoryReference {
  name: string;
  personId?: string;
  office: string;
  representingParty: string;
}

export interface AgreementLegalBasisReference {
  label: string;
  title: string;
  url?: string;
}

export interface AgreementSourceDiscrepancy {
  location: string;
  originalText: string;
  canonicalText: string;
  note: string;
}

export interface AdministrativeAgreementDetails {
  signedOn: string;
  signedAt: string;
  publishedOn: string;
  effectiveOn: string;
  effectivenessNote: string;
  parties: AgreementPartyReference[];
  signatories: AgreementSignatoryReference[];
  legalBases: AgreementLegalBasisReference[];
  responsibleInstitutionId?: string;
  projectIds?: string[];
  sourceDiscrepancies?: AgreementSourceDiscrepancy[];
}

export interface NormEditorialResolution {
  id: string;
  status: 'resolved-source-conflict';
  decisionDate: string;
  issue: string;
  publishedText: string;
  resolvedApplication: string;
  rationale: string;
  evidence: string[];
}

export interface NormMeta {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  abbr?: string;
  shortTitleSource?: 'official' | 'editorial';
  type: NormType;
  /** Bestandsfeld; neue Datensätze trennen Organ und fachliche Zuständigkeit. */
  ministry?: string;
  enactingBody?: string;
  responsibleMinistry?: string;
  subjects: string[];
  primarySubject?: string;
  keywords: string[];
  initialCitation: string;
  predecessor: string | null;
  successor: string | null;
  predecessorSlug?: string;
  successorSlug?: string;
  enactingNorm?: string;
  enactedNorm?: string;
  enactedNorms?: string[];
  affectedNorms?: string[];
  affectedByNorms?: string[];
  relatedNorms?: string[];
  summary: string;
  status: NormStatus;
  documentDate?: string;
  publicationDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  dateNote?: string;
  agreementDetails?: AdministrativeAgreementDetails;
  sourceReferences?: NormSourceReference[];
  editorialResolutions?: NormEditorialResolution[];
}

export interface NormBodyBlock {
  type: StructureType;
  label?: string;
  title?: string;
  text?: string;
  level?: number;
  listId?: string;
  numberingStyle?: string;
  scope?: TableHeaderScope;
  rowspan?: number;
  colspan?: number;
  columns?: number;
  children?: NormBodyBlock[];
}

export interface RawStructuredBodyBlock {
  type: string;
  [key: string]: unknown;
}

export interface NormVersion {
  versionId: string;
  validFrom: string;
  validTo: string | null;
  isCurrent: boolean;
  citation: string;
  changeNote: string;
  sourceReferences?: NormSourceReference[];
  sourceNotes?: NormSourceNote[];
  body: NormBodyBlock[];
}

export interface NormHistoryEntry {
  date: string;
  type: HistoryEntryType;
  title: string;
  citation: string;
  note?: string;
  affectingVersionId?: string | null;
  relatedNorm?: string | null;
}

export interface NormHistory {
  initialVersionId: string | null;
  entries: NormHistoryEntry[];
}

export interface NormRecord {
  meta: NormMeta;
  history: NormHistory;
  versions: NormVersion[];
}

export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentValidationError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new ContentValidationError(`${path}: ${message}`);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    fail(path, 'muss ein Objekt sein');
  }

  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    fail(path, 'muss ein String sein');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    fail(path, 'darf nicht leer sein');
  }

  return trimmed;
}

function expectSlug(value: unknown, path: string): string {
  const slug = expectString(value, path);

  if (!SLUG_PATTERN.test(slug)) {
    fail(path, 'muss ein technischer Slug sein');
  }

  return slug;
}

function expectOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectString(value, path);
}

function expectTableCellText(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'muss ein String sein');
  return value.trim();
}

function expectOptionalContainerText(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(path, 'muss ein String sein');
  return value.trim();
}

function expectNullableString(value: unknown, path: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return expectString(value, path);
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    fail(path, 'muss ein Boolean sein');
  }

  return value;
}

function expectOptionalInteger(
  value: unknown,
  path: string,
  { minimum = 0 }: { minimum?: number } = {},
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < minimum) {
    fail(path, `muss eine ganze Zahl ab ${minimum} sein`);
  }
  return value as number;
}

function expectStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    fail(path, 'muss ein String-Array sein');
  }

  return value.map((entry, index) => expectString(entry, `${path}[${index}]`));
}

function expectSlugArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    fail(path, 'muss ein Slug-Array sein');
  }

  return value.map((entry, index) => expectSlug(entry, `${path}[${index}]`));
}

function parseNormSourceReference(value: unknown, path: string): NormSourceReference {
  const object = expectObject(value, path);
  return {
    kind: expectEnumValue(
      object.kind,
      `${path}.kind`,
      [
        'structured-html-transcription',
        'legacy-markdown-transcription',
        'supplementary-markdown-transcription',
        'revosax-snapshot',
        'amendment-source',
        'primary-pdf',
        'structured-docx-source',
      ] as const,
    ),
    label: expectString(object.label, `${path}.label`),
    availability: expectEnumValue(object.availability, `${path}.availability`, ['versioned'] as const),
    localSource: expectString(object.localSource, `${path}.localSource`),
    url: expectOptionalString(object.url, `${path}.url`),
    retrievedAt:
      object.retrievedAt === undefined
        ? undefined
        : expectIsoDate(object.retrievedAt, `${path}.retrievedAt`),
    sha256: expectOptionalString(object.sha256, `${path}.sha256`),
    lawId: expectOptionalString(object.lawId, `${path}.lawId`),
    sourceValidFrom:
      object.sourceValidFrom === undefined
        ? undefined
        : expectIsoDate(object.sourceValidFrom, `${path}.sourceValidFrom`),
    sourceValidTo:
      object.sourceValidTo === undefined
        ? undefined
        : expectIsoDate(object.sourceValidTo, `${path}.sourceValidTo`),
    mediaType: expectOptionalString(object.mediaType, `${path}.mediaType`) as NormSourceReference['mediaType'],
    pageCount: expectOptionalInteger(object.pageCount, `${path}.pageCount`, { minimum: 1 }),
    pageRange: expectOptionalString(object.pageRange, `${path}.pageRange`),
    verifiedAt:
      object.verifiedAt === undefined
        ? undefined
        : expectIsoDate(object.verifiedAt, `${path}.verifiedAt`),
    sourceRole: expectOptionalString(object.sourceRole, `${path}.sourceRole`) as NormSourceReference['sourceRole'],
    derivedSource: expectOptionalString(object.derivedSource, `${path}.derivedSource`),
  };
}

function parseNormSourceNote(value: unknown, path: string): NormSourceNote {
  const object = expectObject(value, path);
  return {
    label: expectString(object.label, `${path}.label`),
    text: expectString(object.text, `${path}.text`),
  };
}

function parseAgreementParty(value: unknown, path: string): AgreementPartyReference {
  const object = expectObject(value, path);
  return {
    name: expectString(object.name, `${path}.name`),
    institutionId: expectOptionalString(object.institutionId, `${path}.institutionId`),
  };
}

function parseAgreementSignatory(value: unknown, path: string): AgreementSignatoryReference {
  const object = expectObject(value, path);
  return {
    name: expectString(object.name, `${path}.name`),
    personId: expectOptionalString(object.personId, `${path}.personId`),
    office: expectString(object.office, `${path}.office`),
    representingParty: expectString(object.representingParty, `${path}.representingParty`),
  };
}

function parseAgreementLegalBasis(value: unknown, path: string): AgreementLegalBasisReference {
  const object = expectObject(value, path);
  return {
    label: expectString(object.label, `${path}.label`),
    title: expectString(object.title, `${path}.title`),
    url: expectOptionalString(object.url, `${path}.url`),
  };
}

function parseAgreementSourceDiscrepancy(
  value: unknown,
  path: string,
): AgreementSourceDiscrepancy {
  const object = expectObject(value, path);
  return {
    location: expectString(object.location, `${path}.location`),
    originalText: expectString(object.originalText, `${path}.originalText`),
    canonicalText: expectString(object.canonicalText, `${path}.canonicalText`),
    note: expectString(object.note, `${path}.note`),
  };
}

function parseAdministrativeAgreementDetails(
  value: unknown,
  path: string,
): AdministrativeAgreementDetails {
  const object = expectObject(value, path);
  const parties = object.parties;
  const signatories = object.signatories;
  const legalBases = object.legalBases;
  if (!Array.isArray(parties) || parties.length < 2) {
    fail(`${path}.parties`, 'muss mindestens zwei Vertragspartner enthalten');
  }
  if (!Array.isArray(signatories) || signatories.length < 2) {
    fail(`${path}.signatories`, 'muss mindestens zwei Unterzeichner enthalten');
  }
  if (!Array.isArray(legalBases) || legalBases.length === 0) {
    fail(`${path}.legalBases`, 'muss mindestens eine Rechtsgrundlage enthalten');
  }

  return {
    signedOn: expectIsoDate(object.signedOn, `${path}.signedOn`),
    signedAt: expectString(object.signedAt, `${path}.signedAt`),
    publishedOn: expectIsoDate(object.publishedOn, `${path}.publishedOn`),
    effectiveOn: expectIsoDate(object.effectiveOn, `${path}.effectiveOn`),
    effectivenessNote: expectString(object.effectivenessNote, `${path}.effectivenessNote`),
    parties: parties.map((entry, index) => parseAgreementParty(entry, `${path}.parties[${index}]`)),
    signatories: signatories.map((entry, index) =>
      parseAgreementSignatory(entry, `${path}.signatories[${index}]`),
    ),
    legalBases: legalBases.map((entry, index) =>
      parseAgreementLegalBasis(entry, `${path}.legalBases[${index}]`),
    ),
    responsibleInstitutionId: expectOptionalString(
      object.responsibleInstitutionId,
      `${path}.responsibleInstitutionId`,
    ),
    projectIds: object.projectIds === undefined
      ? undefined
      : expectStringArray(object.projectIds, `${path}.projectIds`),
    sourceDiscrepancies: object.sourceDiscrepancies === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(object.sourceDiscrepancies)) {
            fail(`${path}.sourceDiscrepancies`, 'muss ein Array sein');
          }
          return object.sourceDiscrepancies.map((entry, index) =>
            parseAgreementSourceDiscrepancy(entry, `${path}.sourceDiscrepancies[${index}]`),
          );
        })(),
  };
}

function parseEditorialResolution(value: unknown, path: string): NormEditorialResolution {
  const object = expectObject(value, path);
  return {
    id: expectSlug(object.id, `${path}.id`),
    status: expectEnumValue(object.status, `${path}.status`, ['resolved-source-conflict'] as const),
    decisionDate: expectIsoDate(object.decisionDate, `${path}.decisionDate`),
    issue: expectString(object.issue, `${path}.issue`),
    publishedText: expectString(object.publishedText, `${path}.publishedText`),
    resolvedApplication: expectString(object.resolvedApplication, `${path}.resolvedApplication`),
    rationale: expectString(object.rationale, `${path}.rationale`),
    evidence: expectStringArray(object.evidence, `${path}.evidence`),
  };
}

function expectEnumValue<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): T[number] {
  const stringValue = expectString(value, path);

  if (!allowed.includes(stringValue)) {
    fail(path, `muss einer dieser Werte sein: ${allowed.join(', ')}`);
  }

  return stringValue as T[number];
}

function expectIsoDate(value: unknown, path: string): string {
  const stringValue = expectString(value, path);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    fail(path, 'muss ein Datum im Format YYYY-MM-DD sein');
  }

  return stringValue;
}

function parseBodyBlocks(value: unknown, path: string): NormBodyBlock[] {
  if (!Array.isArray(value)) {
    fail(path, 'muss ein Array strukturierter Inhaltsblöcke sein');
  }

  return value.map((entry, index) => parseBodyBlock(entry, `${path}[${index}]`));
}

function parseRawBodyBlocks(value: unknown, path: string): RawStructuredBodyBlock[] {
  if (!Array.isArray(value)) {
    fail(path, 'muss ein Array strukturierter Inhaltsblöcke sein');
  }

  return value.map((entry, index) => {
    const object = expectObject(entry, `${path}[${index}]`);
    expectString(object.type, `${path}[${index}].type`);
    return object as RawStructuredBodyBlock;
  });
}

function parseBodyBlock(value: unknown, path: string): NormBodyBlock {
  const object = expectObject(value, path);
  const type = expectEnumValue(object.type, `${path}.type`, STRUCTURE_TYPES);
  const label = expectOptionalString(object.label, `${path}.label`);
  const title = expectOptionalString(object.title, `${path}.title`);
  const text = type === 'tableCell' || type === 'tableHeaderCell'
    ? expectTableCellText(object.text, `${path}.text`)
    : type === 'subparagraph' || type === 'item' || type === 'subitem'
      ? expectOptionalContainerText(object.text, `${path}.text`)
      : expectOptionalString(object.text, `${path}.text`);
  const children =
    object.children === undefined ? undefined : parseBodyBlocks(object.children, `${path}.children`);
  const level = expectOptionalInteger(object.level, `${path}.level`);
  const listId = expectOptionalString(object.listId, `${path}.listId`);
  const numberingStyle = expectOptionalString(object.numberingStyle, `${path}.numberingStyle`);
  const scope = object.scope === undefined
    ? undefined
    : expectEnumValue(object.scope, `${path}.scope`, TABLE_HEADER_SCOPES);
  const rowspan = expectOptionalInteger(object.rowspan, `${path}.rowspan`, { minimum: 1 });
  const colspan = expectOptionalInteger(object.colspan, `${path}.colspan`, { minimum: 1 });
  const columns = expectOptionalInteger(object.columns, `${path}.columns`, { minimum: 1 });

  if (type === 'paragraphText') {
    if (!text) {
      fail(`${path}.text`, `ist für Blocktyp "${type}" erforderlich`);
    }
  }

  if ((type === 'subparagraph' || type === 'item' || type === 'subitem') && !label && !text && (!children || children.length === 0)) {
    fail(path, `Blocktyp "${type}" benötigt Gliederungszeichen, Text oder untergeordnete Blöcke`);
  }

  if (
    type === 'part' ||
    type === 'chapter' ||
    type === 'section' ||
    type === 'subsection' ||
    type === 'paragraph' ||
    type === 'article' ||
    type === 'annex'
  ) {
    if (!title && !label) {
      fail(path, `Blocktyp "${type}" benötigt mindestens "title" oder "label"`);
    }
  }

  if ((type === 'part' || type === 'chapter' || type === 'section' || type === 'subsection' || type === 'annex') && !children) {
    fail(`${path}.children`, `ist für Blocktyp "${type}" erforderlich`);
  }

  if ((type === 'paragraph' || type === 'article' || type === 'table' || type === 'tableRow') && !children) {
    fail(`${path}.children`, `ist für Blocktyp "${type}" erforderlich`);
  }

  if (type === 'quotedProvision' && (!children || children.length === 0)) {
    fail(`${path}.children`, 'muss für zitierten Normtext mindestens einen Block enthalten');
  }

  if ((level !== undefined || listId !== undefined || numberingStyle !== undefined) && !['item', 'subitem', 'subparagraph'].includes(type)) {
    fail(path, 'Listenmetadaten sind nur an Listen- und Absatzpunkten zulässig');
  }

  if ((rowspan !== undefined || colspan !== undefined) && type !== 'tableCell' && type !== 'tableHeaderCell') {
    fail(path, 'rowspan und colspan sind nur an Tabellenzellen zulässig');
  }

  if (scope !== undefined && type !== 'tableHeaderCell') {
    fail(`${path}.scope`, 'ist nur an Tabellenkopfzellen zulässig');
  }

  if (columns !== undefined && type !== 'table') {
    fail(path, 'columns ist nur an Tabellen zulässig');
  }

  if ((type === 'tableCell' || type === 'tableHeaderCell') && text === undefined) {
    fail(`${path}.text`, 'muss für eine Tabellenzelle vorhanden sein');
  }

  const block: NormBodyBlock = {
    type,
    label,
    title,
    text,
    level,
    listId,
    numberingStyle,
    scope,
    rowspan,
    colspan,
    columns,
    children,
  };

  if (type === 'table') validateTableGrid(block, path);
  return block;
}

function validateTableGrid(table: NormBodyBlock, path: string): void {
  const rows = table.children ?? [];
  const occupied: boolean[][] = [];
  let width = 0;
  rows.forEach((row, rowIndex) => {
    if (row.type !== 'tableRow') fail(`${path}.children[${rowIndex}].type`, 'muss tableRow sein');
    occupied[rowIndex] ??= [];
    let column = 0;
    (row.children ?? []).forEach((cell, cellIndex) => {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeaderCell') {
        fail(`${path}.children[${rowIndex}].children[${cellIndex}].type`, 'muss eine Tabellenzelle sein');
      }
      while (occupied[rowIndex][column]) column += 1;
      const rowspan = cell.rowspan ?? 1;
      const colspan = cell.colspan ?? 1;
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        occupied[rowIndex + rowOffset] ??= [];
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          if (occupied[rowIndex + rowOffset][column + columnOffset]) {
            fail(`${path}.children[${rowIndex}].children[${cellIndex}]`, 'überlappt eine andere Tabellenzelle');
          }
          occupied[rowIndex + rowOffset][column + columnOffset] = true;
        }
      }
      column += colspan;
    });
    width = Math.max(width, occupied[rowIndex].length);
  });
  occupied.forEach((row, rowIndex) => {
    if (row.filter(Boolean).length !== width) {
      fail(`${path}.children[${rowIndex}]`, `belegt ${row.filter(Boolean).length} statt ${width} Spalten`);
    }
  });
  if (table.columns !== undefined && table.columns !== width) {
    fail(`${path}.columns`, `ist ${table.columns}, die Tabelle besitzt jedoch ${width} Spalten`);
  }
}

export function parseNormMeta(value: unknown, path = 'meta.json'): NormMeta {
  const object = expectObject(value, path);
  const rawType = expectString(object.type, `${path}.type`).toLowerCase();
  const rawStatus = expectString(object.status, `${path}.status`).toLowerCase();
  const subjects = expectStringArray(object.subjects, `${path}.subjects`);
  const primarySubject = expectOptionalString(object.primarySubject, `${path}.primarySubject`);

  if (primarySubject && !subjects.includes(primarySubject)) {
    fail(`${path}.primarySubject`, 'muss zugleich in subjects enthalten sein');
  }

  const normalizedTypeMap: Record<string, NormType> = {
    gesetz: 'gesetz',
    verordnung: 'verordnung',
    verwaltungsvorschrift: 'verwaltungsvorschrift',
    foerderrichtlinie: 'foerderrichtlinie',
    förderrichtlinie: 'foerderrichtlinie',
    allgemeinverfuegung: 'allgemeinverfuegung',
    allgemeinverfügung: 'allgemeinverfuegung',
    bekanntmachung: 'bekanntmachung',
    staatsvertrag: 'staatsvertrag',
    verwaltungsabkommen: 'verwaltungsabkommen',
    zustimmungsgesetz: 'zustimmungsgesetz',
    aenderungsvorschrift: 'aenderungsvorschrift',
    änderungsvorschrift: 'aenderungsvorschrift',
  };

  const normalizedStatusMap: Record<string, NormStatus> = {
    'in-force': 'in-force',
    published: 'in-force',
    repealed: 'repealed',
    aufgehoben: 'repealed',
    planned: 'planned',
    draft: 'planned',
    'future-effective': 'future-effective',
    'pending-effective': 'pending-effective',
    historical: 'historical',
    'one-time-act': 'one-time-act',
  };

  if (!normalizedTypeMap[rawType]) {
    fail(`${path}.type`, `muss einer dieser Werte sein: ${NORM_TYPES.join(', ')}`);
  }

  if (!normalizedStatusMap[rawStatus]) {
    fail(`${path}.status`, `muss einer dieser Werte sein: ${NORM_STATUSES.join(', ')}`);
  }

  return {
    id: expectString(object.id, `${path}.id`),
    slug: expectSlug(object.slug, `${path}.slug`),
    title: expectString(object.title, `${path}.title`),
    shortTitle: expectString(object.shortTitle, `${path}.shortTitle`),
    abbr: expectOptionalString(object.abbr, `${path}.abbr`),
    shortTitleSource: object.shortTitleSource === undefined
      ? undefined
      : expectEnumValue(object.shortTitleSource, `${path}.shortTitleSource`, ['official', 'editorial'] as const),
    type: normalizedTypeMap[rawType],
    ministry: expectOptionalString(object.ministry, `${path}.ministry`),
    enactingBody: expectOptionalString(object.enactingBody, `${path}.enactingBody`),
    responsibleMinistry: expectOptionalString(object.responsibleMinistry, `${path}.responsibleMinistry`),
    subjects,
    primarySubject,
    keywords: expectStringArray(object.keywords, `${path}.keywords`),
    initialCitation: expectString(object.initialCitation, `${path}.initialCitation`),
    predecessor: expectNullableString(object.predecessor, `${path}.predecessor`),
    successor: expectNullableString(object.successor, `${path}.successor`),
    predecessorSlug: object.predecessorSlug === undefined
      ? undefined
      : expectSlug(object.predecessorSlug, `${path}.predecessorSlug`),
    successorSlug: object.successorSlug === undefined
      ? undefined
      : expectSlug(object.successorSlug, `${path}.successorSlug`),
    enactingNorm: expectOptionalString(object.enactingNorm, `${path}.enactingNorm`),
    enactedNorm: expectOptionalString(object.enactedNorm, `${path}.enactedNorm`),
    enactedNorms:
      object.enactedNorms === undefined
        ? undefined
        : expectStringArray(object.enactedNorms, `${path}.enactedNorms`),
    affectedNorms:
      object.affectedNorms === undefined
        ? undefined
        : expectSlugArray(object.affectedNorms, `${path}.affectedNorms`),
    affectedByNorms:
      object.affectedByNorms === undefined
        ? undefined
        : expectSlugArray(object.affectedByNorms, `${path}.affectedByNorms`),
    relatedNorms:
      object.relatedNorms === undefined
        ? undefined
        : expectSlugArray(object.relatedNorms, `${path}.relatedNorms`),
    summary: expectString(object.summary, `${path}.summary`),
    status: normalizedStatusMap[rawStatus],
    documentDate:
      object.documentDate === undefined
        ? undefined
        : expectIsoDate(object.documentDate, `${path}.documentDate`),
    publicationDate:
      object.publicationDate === undefined
        ? undefined
        : expectIsoDate(object.publicationDate, `${path}.publicationDate`),
    effectiveDate:
      object.effectiveDate === undefined
        ? undefined
        : expectIsoDate(object.effectiveDate, `${path}.effectiveDate`),
    expiryDate:
      object.expiryDate === undefined
        ? undefined
        : expectIsoDate(object.expiryDate, `${path}.expiryDate`),
    dateNote: expectOptionalString(object.dateNote, `${path}.dateNote`),
    agreementDetails: object.agreementDetails === undefined
      ? undefined
      : parseAdministrativeAgreementDetails(object.agreementDetails, `${path}.agreementDetails`),
    sourceReferences: object.sourceReferences === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(object.sourceReferences)) fail(`${path}.sourceReferences`, 'muss ein Array sein');
          return object.sourceReferences.map((entry, index) =>
            parseNormSourceReference(entry, `${path}.sourceReferences[${index}]`),
          );
        })(),
    editorialResolutions: object.editorialResolutions === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(object.editorialResolutions)) {
            fail(`${path}.editorialResolutions`, 'muss ein Array sein');
          }
          return object.editorialResolutions.map((entry, index) =>
            parseEditorialResolution(entry, `${path}.editorialResolutions[${index}]`),
          );
        })(),
  };
}

export function parseNormVersion(value: unknown, path = 'version.json'): NormVersion {
  const object = expectObject(value, path);

  return {
    versionId: expectString(object.versionId, `${path}.versionId`),
    validFrom: expectIsoDate(object.validFrom, `${path}.validFrom`),
    validTo:
      object.validTo === null || object.validTo === undefined
        ? null
        : expectIsoDate(object.validTo, `${path}.validTo`),
    isCurrent: expectBoolean(object.isCurrent, `${path}.isCurrent`),
    citation: expectString(object.citation, `${path}.citation`),
    changeNote: expectString(object.changeNote, `${path}.changeNote`),
    sourceReferences: object.sourceReferences === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(object.sourceReferences)) {
            fail(`${path}.sourceReferences`, 'muss ein Array sein');
          }
          return object.sourceReferences.map((entry, index) =>
            parseNormSourceReference(entry, `${path}.sourceReferences[${index}]`),
          );
        })(),
    sourceNotes: object.sourceNotes === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(object.sourceNotes)) {
            fail(`${path}.sourceNotes`, 'muss ein Array sein');
          }
          return object.sourceNotes.map((entry, index) =>
            parseNormSourceNote(entry, `${path}.sourceNotes[${index}]`),
          );
        })(),
    body: normalizeBodyBlocks(parseRawBodyBlocks(object.body, `${path}.body`), `${path}.body`),
  };
}

function parseHistoryEntry(value: unknown, path: string): NormHistoryEntry {
  const object = expectObject(value, path);

  return {
    date: expectIsoDate(object.date, `${path}.date`),
    type: expectEnumValue(object.type, `${path}.type`, HISTORY_ENTRY_TYPES),
    title: expectString(object.title, `${path}.title`),
    citation: expectString(object.citation, `${path}.citation`),
    note: expectOptionalString(object.note, `${path}.note`),
    affectingVersionId: object.affectingVersionId === undefined
      ? undefined
      : expectNullableString(object.affectingVersionId, `${path}.affectingVersionId`),
    relatedNorm:
      object.relatedNorm === undefined
        ? undefined
        : expectNullableString(object.relatedNorm, `${path}.relatedNorm`),
  };
}

export function parseNormHistory(value: unknown, path = 'history.json'): NormHistory {
  const object = expectObject(value, path);
  const entries = object.entries;
  if (!Array.isArray(entries)) {
    fail(`${path}.entries`, 'muss ein Array sein');
  }

  if (typeof object.initialVersionId === 'string' || object.initialVersionId === null) {
    return {
      initialVersionId: object.initialVersionId === null
        ? null
        : expectString(object.initialVersionId, `${path}.initialVersionId`),
      entries: entries.map((entry, index) => parseHistoryEntry(entry, `${path}.entries[${index}]`)),
    };
  }

  const normSlug =
    object.normSlug === undefined ? undefined : expectString(object.normSlug, `${path}.normSlug`);

  const normalizedEntries = entries.map((entry, index) => {
    const entryPath = `${path}.entries[${index}]`;
    const rawEntry = expectObject(entry, entryPath);
    const kind = expectString(rawEntry.kind, `${entryPath}.kind`).toLowerCase();
    const typeMap: Record<string, HistoryEntryType> = {
      stammfassung: 'initial',
      aenderung: 'amendment',
      änderung: 'amendment',
      aufhebung: 'repeal',
      hinweis: 'notice',
    };

    if (!typeMap[kind]) {
      fail(`${entryPath}.kind`, `unbekannter Historientyp "${kind}"`);
    }

    return {
      date: expectIsoDate(rawEntry.date, `${entryPath}.date`),
      type: typeMap[kind],
      title: expectString(rawEntry.label, `${entryPath}.label`),
      citation: expectString(rawEntry.citation, `${entryPath}.citation`),
      note: undefined,
      affectingVersionId:
        rawEntry.versionId === undefined
          ? undefined
          : expectNullableString(rawEntry.versionId, `${entryPath}.versionId`),
      relatedNorm:
        rawEntry.relatedNormSlug === undefined
          ? undefined
          : expectNullableString(rawEntry.relatedNormSlug, `${entryPath}.relatedNormSlug`),
    } satisfies NormHistoryEntry;
  });

  return {
    initialVersionId:
      normalizedEntries.find((entry) => entry.type === 'initial')?.affectingVersionId ??
      normalizedEntries[0]?.affectingVersionId ??
      normSlug ??
      fail(`${path}.entries`, 'muss eine Stammfassung mit Versionsbezug enthalten'),
    entries: normalizedEntries,
  };
}

function normalizeBodyBlocks(blocks: RawStructuredBodyBlock[], path: string): NormBodyBlock[] {
  return blocks.flatMap((block, index) => normalizeBodyBlock(block, `${path}[${index}]`));
}

function normalizeBodyBlock(block: RawStructuredBodyBlock, path: string): NormBodyBlock[] {
  const rawType = expectString(block.type, `${path}.type`).toLowerCase();
  const normalizedTypeMap: Record<string, StructureType> = {
    part: 'part',
    chapter: 'chapter',
    section: 'section',
    subsection: 'subsection',
    paragraph: 'paragraph',
    article: 'article',
    annex: 'annex',
    paragraphtext: 'paragraphText',
    item: 'item',
    subitem: 'subitem',
    subparagraph: 'subparagraph',
    quotedprovision: 'quotedProvision',
    table: 'table',
    tablerow: 'tableRow',
    tableheadercell: 'tableHeaderCell',
    tablecell: 'tableCell',
  };
  const type = normalizedTypeMap[rawType] ?? rawType;

  const looksLikeStructuredBlock =
    block.children !== undefined || block.title !== undefined || block.label !== undefined;

  if (type === 'section' && !looksLikeStructuredBlock) {
    return [
      {
        type: 'section',
        label:
          expectOptionalString(block.label, `${path}.label`) ??
          expectOptionalString(block.number, `${path}.number`),
        title:
          expectOptionalString(block.title, `${path}.title`) ??
          expectOptionalString(block.heading, `${path}.heading`) ??
          expectOptionalString(block.text, `${path}.text`),
        children: [],
      },
    ];
  }

  if ((type === 'paragraph' || type === 'article') && !looksLikeStructuredBlock) {
    const content = Array.isArray(block.content)
      ? block.content.map((entry, contentIndex) =>
          expectString(entry, `${path}.content[${contentIndex}]`),
        )
      : [];

    return [
      {
        type: type as StructureType,
        label:
          expectOptionalString(block.label, `${path}.label`) ??
          expectOptionalString(block.number, `${path}.number`),
        title:
          expectOptionalString(block.title, `${path}.title`) ??
          expectOptionalString(block.heading, `${path}.heading`) ??
          expectOptionalString(block.text, `${path}.text`),
        children: content.map((text) => ({
          type: 'paragraphText',
          text,
        })),
      },
    ];
  }

  if (STRUCTURE_TYPES.includes(type as StructureType)) {
    return [parseBodyBlock(block, path)];
  }

  fail(`${path}.type`, `unbekannter Inhaltstyp "${type}"`);
}

export function validateNormRecord(record: NormRecord, context = record.meta.slug): NormRecord {
  if (record.meta.slug !== context) {
    fail(`${context}/meta.json.slug`, 'muss dem Verzeichnisnamen entsprechen');
  }

  if (record.versions.length === 0) {
    fail(`${context}/versions`, 'muss mindestens eine Fassung enthalten');
  }

  if (record.meta.type === 'verwaltungsabkommen' && !record.meta.agreementDetails) {
    fail(`${context}/meta.json.agreementDetails`, 'ist für ein Verwaltungsabkommen erforderlich');
  }
  if (record.meta.type === 'verwaltungsabkommen' && record.meta.agreementDetails) {
    const details = record.meta.agreementDetails;
    if (details.signedOn !== record.meta.documentDate) {
      fail(`${context}/meta.json.agreementDetails.signedOn`, 'muss dem Abschlussdatum des Dokuments entsprechen');
    }
    if (details.publishedOn !== record.meta.publicationDate) {
      fail(`${context}/meta.json.agreementDetails.publishedOn`, 'muss dem Veröffentlichungsdatum entsprechen');
    }
    if (details.effectiveOn !== record.meta.effectiveDate) {
      fail(`${context}/meta.json.agreementDetails.effectiveOn`, 'muss dem modellierten Wirksamkeitsdatum entsprechen');
    }
  }

  const knownVersionIds = new Set<string>();
  for (const version of record.versions) {
    if (knownVersionIds.has(version.versionId)) {
      fail(`${context}/versions/${version.versionId}.json`, 'Version-ID ist doppelt vergeben');
    }

    knownVersionIds.add(version.versionId);

  }

  if (record.history.initialVersionId !== null && !knownVersionIds.has(record.history.initialVersionId)) {
    fail(
      `${context}/history.json.initialVersionId`,
      'muss auf eine vorhandene Version verweisen',
    );
  }

  for (const [index, entry] of record.history.entries.entries()) {
    if (entry.affectingVersionId && !knownVersionIds.has(entry.affectingVersionId)) {
      fail(
        `${context}/history.json.entries[${index}].affectingVersionId`,
        'muss auf eine vorhandene Version verweisen',
      );
    }
  }

  return {
    ...record,
    versions: [...record.versions].sort((left, right) => left.validFrom.localeCompare(right.validFrom)),
    history: {
      ...record.history,
      entries: [...record.history.entries].sort((left, right) => left.date.localeCompare(right.date)),
    },
  };
}
