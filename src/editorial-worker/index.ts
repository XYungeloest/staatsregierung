import {
  appendMediaChanges,
  prepareCabinetReshuffle,
  prepareDocumentChange,
  type PreparedEditorialChange,
} from './content.ts';
import {
  createEditorialRepository,
  GitHubAdapterError,
  MemoryEditorialRepository,
  type EditorialFileChange,
  type EditorialRepository,
  type GitHubEditorialEnv,
} from './github.ts';
import { mockEditorialFiles } from './mock-content.ts';
import {
  editorialRegistry,
  getEditorialFilePath,
  isEditorialContentType,
  type EditorialContentTypeId,
} from './registry.ts';
import {
  createCsrfCookie,
  createCsrfToken,
  EditorialSecurityError,
  securityHeaders,
  validateImageUploadBytes,
  validateMutationRequest,
  verifyAccessRequest,
  type EditorialSecurityEnv,
} from './security.ts';
import { renderStudioHtml, studioClientScript, studioStyles } from './ui.ts';
import type { CabinetReshuffleInput } from '../lib/portal/organization.ts';

interface EditorialWorkerEnv extends GitHubEditorialEnv, EditorialSecurityEnv {
  PUBLIC_SITE_ORIGIN?: string;
}

interface EditorialPayload {
  type?: string;
  slug?: string;
  value?: unknown;
  expectedBaseSha?: string;
  title?: string;
  media?: Array<{ name: string; type: string; alt: string; credit?: string; contentBase64: string }>;
}

let localRepository: EditorialRepository | undefined;

function repositoryFor(env: EditorialWorkerEnv): EditorialRepository {
  if (env.EDITORIAL_ADAPTER === 'mock') {
    if (env.APP_ENV !== 'local' && env.APP_ENV !== 'test') throw new GitHubAdapterError('Der Mock-Adapter ist nur lokal und in Tests zulässig.', 'configuration', 503);
    localRepository ??= new MemoryEditorialRepository(mockEditorialFiles, 'mock-main-sha');
    return localRepository;
  }
  return createEditorialRepository(env);
}

function json(value: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...securityHeaders(), ...extraHeaders },
  });
}

function text(value: string, contentType: string, extraHeaders: HeadersInit = {}): Response {
  return new Response(value, { headers: { 'content-type': contentType, ...securityHeaders(), ...extraHeaders } });
}

async function requestJson(request: Request, maxBytes = 8 * 1024 * 1024): Promise<EditorialPayload> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new EditorialSecurityError('Die Anfrage ist zu groß.', 413);
  try {
    return JSON.parse(raw) as EditorialPayload;
  } catch {
    throw new EditorialSecurityError('Die Anfrage enthält kein gültiges JSON.', 400);
  }
}

function assertType(value: string | undefined): EditorialContentTypeId {
  if (!value || !isEditorialContentType(value)) throw new EditorialSecurityError('Unbekannter redaktioneller Inhaltstyp.', 404);
  return value;
}

function decodeBase64(value: string): Uint8Array {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new EditorialSecurityError('Ein Bild enthält ungültige Binärdaten.', 422);
  }
}

async function mediaChanges(payload: EditorialPayload): Promise<EditorialFileChange[]> {
  const changes: EditorialFileChange[] = [];
  for (const media of payload.media ?? []) {
    const bytes = decodeBase64(media.contentBase64);
    const file = new File([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], media.name, { type: media.type });
    const validated = await validateImageUploadBytes(file, media.alt);
    changes.push({ path: validated.path, content: validated.bytes, mediaType: validated.mediaType });
  }
  return changes;
}

function cabinetInput(value: unknown): CabinetReshuffleInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EditorialSecurityError('Die Kabinettsänderung fehlt.', 422);
  const candidate = value as Partial<CabinetReshuffleInput>;
  if (typeof candidate.effectiveDate !== 'string' || typeof candidate.governmentSlug !== 'string' || typeof candidate.summary !== 'string' || !Array.isArray(candidate.changes)) {
    throw new EditorialSecurityError('Wirksamkeitsdatum, Regierung, Zusammenfassung und Änderungen sind erforderlich.', 422);
  }
  return candidate as CabinetReshuffleInput;
}

async function prepare(repository: EditorialRepository, payload: EditorialPayload): Promise<PreparedEditorialChange> {
  const type = assertType(payload.type);
  const prepared = type === 'cabinet-reshuffle'
    ? await prepareCabinetReshuffle(repository, cabinetInput(payload.value), payload.expectedBaseSha)
    : await prepareDocumentChange(repository, type, payload.value, payload.slug, payload.expectedBaseSha);
  return appendMediaChanges(prepared, await mediaChanges(payload));
}

async function listContent(repository: EditorialRepository, type: EditorialContentTypeId): Promise<Response> {
  const definition = editorialRegistry[type];
  if (definition.mode === 'workflow') return json({ items: [{ slug: definition.id, label: definition.label }] });
  if (definition.singletonPath) return json({ items: [{ slug: definition.id, label: definition.label }] });
  const revision = await repository.getBaseRevision();
  const paths = (await repository.listFiles(`${definition.directory}/`, revision)).filter((path) => path.endsWith('.json'));
  const items = await Promise.all(paths.map(async (path) => {
    const slug = path.split('/').pop()!.replace(/\.json$/u, '');
    const raw = await repository.readFile(path, revision);
    let label = slug;
    try {
      const value = JSON.parse(raw ?? '{}') as Record<string, unknown>;
      label = String(value.title ?? value.name ?? value.kurzname ?? slug);
    } catch { /* Die Inhaltsvalidierung meldet beschädigte Dateien beim Öffnen. */ }
    return { slug, label };
  }));
  return json({ items: items.sort((left, right) => left.label.localeCompare(right.label, 'de')) });
}

async function loadOptions(repository: EditorialRepository): Promise<Response> {
  const revision = await repository.getBaseRevision();
  async function collection(prefix: string, labelKeys: string[]): Promise<Array<{ value: string; label: string }>> {
    const paths = (await repository.listFiles(prefix, revision)).filter((path) => path.endsWith('.json'));
    return Promise.all(paths.map(async (path) => {
      const value = JSON.parse(await repository.readFile(path, revision) ?? '{}') as Record<string, unknown>;
      const slug = String(value.slug ?? path.split('/').pop()!.replace(/\.json$/u, ''));
      const label = labelKeys.map((key) => value[key]).find((entry) => typeof entry === 'string') ?? slug;
      return { value: slug, label: String(label) };
    }));
  }
  const [persons, ministries, topics, images, governmentsRaw, officesRaw, normFiles] = await Promise.all([
    collection('content/regierung/mitglieder/', ['name']),
    collection('content/ressorts/', ['kurzname', 'name']),
    collection('content/themen/', ['title']),
    repository.listFiles('public/images/', revision),
    repository.readFile('content/organisation/governments.json', revision),
    repository.readFile('content/organisation/offices.json', revision),
    repository.listFiles('content/normen/', revision),
  ]);
  const governmentsDocument = JSON.parse(governmentsRaw ?? '{"governments":[]}') as { governments: Array<{ slug: string; title: string }> };
  const officesDocument = JSON.parse(officesRaw ?? '{"offices":[]}') as { offices: Array<{ slug: string; title: string; canLeadMinistry: boolean }> };
  const normSlugs = [...new Set(normFiles.filter((path) => path.endsWith('/meta.json')).map((path) => path.split('/')[2]))].sort();
  return json({
    persons: persons.sort((left, right) => left.label.localeCompare(right.label, 'de')),
    ministries: ministries.sort((left, right) => left.label.localeCompare(right.label, 'de')),
    topics: topics.sort((left, right) => left.label.localeCompare(right.label, 'de')),
    governments: governmentsDocument.governments.map((entry) => ({ value: entry.slug, label: entry.title })),
    offices: officesDocument.offices.map((entry) => ({ value: entry.slug, label: entry.title, canLeadMinistry: entry.canLeadMinistry })),
    norms: normSlugs.map((slug) => ({ value: slug, label: slug })),
    images: images.filter((path) => /\.(?:avif|jpe?g|png|webp)$/iu.test(path)).map((path) => ({ value: `/${path.replace(/^public\//u, '')}`, label: path.replace(/^public\//u, '') })),
  });
}

async function apiRequest(request: Request, env: EditorialWorkerEnv, repository: EditorialRepository): Promise<Response> {
  const url = new URL(request.url);
  const endpoint = url.pathname.replace(/^\/redaktion\/api\//u, '');
  if (endpoint === 'bootstrap') {
    if (request.method !== 'GET') throw new EditorialSecurityError('Diese HTTP-Methode ist nicht zulässig.', 405);
    const registry = Object.values(editorialRegistry).map(({ validate: _validate, ...definition }) => definition);
    return json({ registry, baseSha: await repository.getBaseRevision(), publicSiteOrigin: env.PUBLIC_SITE_ORIGIN ?? 'https://freistaat-ostdeutschland.de' });
  }
  if (endpoint === 'options') {
    if (request.method !== 'GET') throw new EditorialSecurityError('Diese HTTP-Methode ist nicht zulässig.', 405);
    return loadOptions(repository);
  }
  if (endpoint === 'list') {
    if (request.method !== 'GET') throw new EditorialSecurityError('Diese HTTP-Methode ist nicht zulässig.', 405);
    return listContent(repository, assertType(url.searchParams.get('type') ?? undefined));
  }
  if (endpoint === 'content') {
    if (request.method !== 'GET') throw new EditorialSecurityError('Diese HTTP-Methode ist nicht zulässig.', 405);
    const type = assertType(url.searchParams.get('type') ?? undefined);
    const definition = editorialRegistry[type];
    if (definition.mode === 'workflow') return json({ value: null, label: definition.label });
    const slug = url.searchParams.get('slug') ?? type;
    const path = getEditorialFilePath(type, slug);
    const raw = await repository.readFile(path, await repository.getBaseRevision());
    if (raw === undefined) return json({ error: 'Inhalt wurde nicht gefunden.' }, 404);
    return json({ value: JSON.parse(raw) as unknown, label: definition.label, path });
  }
  if (endpoint === 'media-check') {
    validateMutationRequest(request, env, { maxBytes: 5 * 1024 * 1024 + 100_000, contentTypes: ['multipart/form-data'] });
    const form = await request.formData();
    const file = form.get('file');
    const alt = form.get('alt');
    if (!(file instanceof File) || typeof alt !== 'string') throw new EditorialSecurityError('Bild und Alternativtext sind erforderlich.', 422);
    const result = await validateImageUploadBytes(file, alt);
    return json({ gitPath: result.path, publicPath: `/${result.path.replace(/^public\//u, '')}` });
  }
  if (endpoint === 'preview' || endpoint === 'submit') {
    validateMutationRequest(request, env, { maxBytes: 8 * 1024 * 1024 });
    const payload = await requestJson(request);
    const prepared = await prepare(repository, payload);
    if (endpoint === 'preview') {
      return json({ baseSha: prepared.baseSha, files: prepared.changes.map((change) => change.path), routes: prepared.routes, diff: prepared.diff, workflowPreview: prepared.workflowPreview });
    }
    if (!payload.title?.trim()) throw new EditorialSecurityError('Ein Titel für den Pull Request ist erforderlich.', 422);
    const result = await repository.submit({
      type: prepared.type,
      slug: prepared.slug,
      title: payload.title.trim(),
      editorEmail: (await verifyAccessRequest(request, env)).email,
      expectedBaseSha: prepared.baseSha,
      changes: prepared.changes,
      routes: prepared.routes,
      checks: ['npm run content:check', 'npm run knowledge:check', 'npm run check', 'npm run test:unit', 'npm run build'],
    });
    return json({ ...result, baseSha: await repository.getBaseRevision() });
  }
  return json({ error: 'API-Endpunkt wurde nicht gefunden.' }, 404);
}

export default {
  async fetch(request: Request, env: EditorialWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/redaktion')) return json({ error: 'Nicht gefunden.' }, 404);
    try {
      const identity = await verifyAccessRequest(request, env);
      const repository = repositoryFor(env);
      if (url.pathname.startsWith('/redaktion/api/')) return await apiRequest(request, env, repository);
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new EditorialSecurityError('Diese HTTP-Methode ist nicht zulässig.', 405);
      if (url.pathname === '/redaktion/app.js') return text(studioClientScript, 'text/javascript; charset=utf-8');
      if (url.pathname === '/redaktion/styles.css') return text(studioStyles, 'text/css; charset=utf-8');
      if (url.pathname === '/redaktion' || url.pathname === '/redaktion/') {
        const token = createCsrfToken();
        const local = env.APP_ENV === 'local' || env.APP_ENV === 'test';
        return text(renderStudioHtml(token, identity.email), 'text/html; charset=utf-8', { 'set-cookie': createCsrfCookie(token, local) });
      }
      return json({ error: 'Nicht gefunden.' }, 404);
    } catch (error) {
      if (error instanceof EditorialSecurityError) return json({ error: error.message }, error.status, error.status === 405 ? { allow: 'GET, HEAD, POST' } : {});
      if (error instanceof GitHubAdapterError) return json({ error: error.message, code: error.code }, error.status);
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler im Redaktionsstudio.';
      return json({ error: message }, 422);
    }
  },
};
