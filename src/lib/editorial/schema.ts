import type { PortalContact, PortalLink, ThemenFaqEintrag, ThemenRechtsgrundlage, Themenstatus } from '../portal/schema.ts';
import type {
  ActionPlanReference,
  ActionPlanStatus,
} from '../portal/modules.ts';
import type {
  EditorialEntryStatus,
  EditorialEntryType,
  EditorialPublishMode,
  EditorialSourceOrigin,
  EditorialVersionAction,
} from './studio.ts';

export interface EditorialEntryMetadata {
  sourceId?: string;
  sourceOrigin?: EditorialSourceOrigin;
}

export interface PressReleaseDraftContent {
  date: string;
  ressort: string;
  teaser: string;
  imageUrl?: string;
  mediaKey?: string;
  imageAlt: string;
  imageCredit: string;
  tags: string[];
  body: string[];
  isFeatured: boolean;
  relatedTopicSlugs: string[];
  relatedNormSlugs: string[];
  relatedPressSlugs: string[];
}

export interface EventDraftContent {
  date: string;
  location: string;
  teaser: string;
  body: string[];
  imageUrl?: string;
  mediaKey?: string;
  imageAlt?: string;
}

export interface JobDraftContent {
  ressort: string;
  standort: string;
  arbeitsbereich: string;
  datePosted: string;
  applicationDeadline: string;
  employmentType: string;
  payGrade?: string;
  teaser: string;
  body: string[];
  contact?: PortalContact;
  imageUrl?: string;
  mediaKey?: string;
  imageAlt?: string;
  imageCredit?: string;
  isActive: boolean;
}

export interface ProjectStatusDraftContent {
  description: string;
  status: ActionPlanStatus;
  ressort: string;
  href: string;
  position: number;
  references: ActionPlanReference[];
}

export interface ServicePageDraftContent {
  body: string[];
}

export interface TopicDraftContent {
  teaser: string;
  status: Themenstatus;
  hero?: string;
  beschlossen: string[];
  umgesetzt: string[];
  naechsteSchritte: string[];
  rechtsgrundlagen: ThemenRechtsgrundlage[];
  faq: ThemenFaqEintrag[];
  federfuehrendesRessort: string;
  mitzeichnungsressorts: string[];
}

export interface MinistryDraftContent {
  name: string;
  kurzname: string;
  leitung: string;
  teaser: string;
  aufgaben: string[];
  kontakt?: PortalContact;
  imageUrl?: string;
  mediaKey?: string;
  imageAlt?: string;
  imageCredit?: string;
  themen: string[];
  verknuepfteLinks: PortalLink[];
}

export interface GovernmentMemberDraftContent {
  name: string;
  amt: string;
  ressort: string;
  reihenfolge: number;
  kurzbiografie: string;
  langbiografie: string[];
  imageUrl?: string;
  mediaKey?: string;
  imageAlt?: string;
  imageCredit?: string;
  kontakt?: PortalContact;
  zitat?: string;
}

export type EditorialEntryContent =
  | PressReleaseDraftContent
  | EventDraftContent
  | JobDraftContent
  | ProjectStatusDraftContent
  | ServicePageDraftContent
  | TopicDraftContent
  | MinistryDraftContent
  | GovernmentMemberDraftContent;

export interface EditorialEntryRecord {
  id: string;
  type: EditorialEntryType;
  slug: string;
  route: string;
  title: string;
  status: EditorialEntryStatus;
  publish_mode: EditorialPublishMode;
  author: string | null;
  metadata_json: string;
  content_json: string;
  current_version_id: string | null;
  current_version_number: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface EditorialVersionRecord {
  id: string;
  entry_id: string;
  version_number: number;
  status: EditorialEntryStatus;
  action: EditorialVersionAction;
  author: string | null;
  summary: string | null;
  metadata_json: string;
  content_json: string;
  published_payload_json: string | null;
  created_at: string;
}

export interface EditorialEntry {
  id: string;
  type: EditorialEntryType;
  slug: string;
  route: string;
  title: string;
  status: EditorialEntryStatus;
  publishMode: EditorialPublishMode;
  author?: string;
  metadata: EditorialEntryMetadata;
  content: EditorialEntryContent;
  currentVersionId?: string;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface EditorialVersion {
  id: string;
  entryId: string;
  versionNumber: number;
  status: EditorialEntryStatus;
  action: EditorialVersionAction;
  author?: string;
  summary?: string;
  metadata: EditorialEntryMetadata;
  content: EditorialEntryContent;
  publishedPayload?: unknown;
  createdAt: string;
}

export interface EditorialEntryWriteInput {
  entryId?: string;
  type: EditorialEntryType;
  slug: string;
  route: string;
  title: string;
  status: EditorialEntryStatus;
  publishMode: EditorialPublishMode;
  author?: string;
  metadata: EditorialEntryMetadata;
  content: EditorialEntryContent;
  action: EditorialVersionAction;
  summary?: string;
  publishedPayload?: unknown;
}

export interface EditorialSaveResult {
  entryId: string;
  versionId: string;
  versionNumber: number;
}

export interface MediaAssetRecord {
  id: string;
  key: string;
  title: string;
  alt_text: string;
  credit: string | null;
  mime_type: string | null;
  byte_size: number | null;
  filename: string | null;
  author: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  key: string;
  title: string;
  altText: string;
  credit?: string;
  mimeType?: string;
  byteSize?: number;
  filename?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetWriteInput {
  id?: string;
  key: string;
  title: string;
  altText: string;
  credit?: string;
  mimeType?: string;
  byteSize?: number;
  filename?: string;
  author?: string;
}

export interface PublishLogWriteInput {
  entryId: string;
  versionId?: string;
  targetType: EditorialEntryType;
  targetIdentifier?: string;
  mode: EditorialPublishMode;
  status: 'success' | 'prepared' | 'failed';
  detail?: string;
  payload?: unknown;
}

export interface EditorialTypeSummary {
  type: EditorialEntryType;
  totalCount: number;
  draftCount: number;
  publishedCount: number;
  exportReadyCount: number;
}

export interface EditorialSourceSummary {
  id: string;
  title: string;
  slug: string;
  route: string;
  sourceOrigin: EditorialSourceOrigin;
  description?: string;
  updatedAt?: string;
}
