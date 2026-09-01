export interface GitHubEditorialEnv {
  APP_ENV: string;
  EDITORIAL_ADAPTER?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_INSTALLATION_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_BASE_BRANCH?: string;
}

export interface EditorialFileChange {
  path: string;
  content: string | Uint8Array;
  mediaType?: string;
}

export interface EditorialSubmission {
  type: string;
  slug: string;
  title: string;
  editorEmail: string;
  expectedBaseSha: string;
  branchName?: string;
  changes: EditorialFileChange[];
  routes: string[];
  checks: string[];
}

export interface EditorialSubmissionResult {
  branchName: string;
  commitSha: string;
  pullRequestNumber: number;
  pullRequestUrl: string;
  updated: boolean;
}

export interface EditorialRepository {
  getBaseRevision(): Promise<string>;
  readFile(path: string, revision?: string): Promise<string | undefined>;
  readFiles(paths: string[], revision?: string): Promise<Record<string, string | undefined>>;
  listFiles(prefix: string, revision?: string): Promise<string[]>;
  submit(submission: EditorialSubmission): Promise<EditorialSubmissionResult>;
}

export class GitHubAdapterError extends Error {
  readonly code: 'configuration' | 'conflict' | 'token' | 'api' | 'validation';
  readonly status: number;

  constructor(
    message: string,
    code: 'configuration' | 'conflict' | 'token' | 'api' | 'validation',
    status = 502,
  ) {
    super(message);
    this.name = 'GitHubAdapterError';
    this.code = code;
    this.status = status;
  }
}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/gu, '').replace(/\+/gu, '-').replace(/\//gu, '_');
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/gu, '')), (character) => character.charCodeAt(0)));
}

function joinBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function derLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>>= 8) bytes.unshift(value & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function derValue(tag: number, content: Uint8Array): Uint8Array {
  return joinBytes(Uint8Array.of(tag), derLength(content.length), content);
}

function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  );
  return derValue(0x30, joinBytes(version, rsaAlgorithm, derValue(0x04, pkcs1)));
}

function decodePemBody(body: string): Uint8Array {
  const normalized = body.replace(/\s/gu, '');
  if (!normalized) throw new GitHubAdapterError('Der private Schlüssel der GitHub App ist leer.', 'configuration', 503);
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

function privateKeyBytes(pem: string): Uint8Array {
  const normalized = pem.replace(/\\n/gu, '\n').trim();
  const pkcs8 = normalized.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/u);
  if (pkcs8) return decodePemBody(pkcs8[1]);
  const pkcs1 = normalized.match(/-----BEGIN RSA PRIVATE KEY-----([\s\S]+?)-----END RSA PRIVATE KEY-----/u);
  if (pkcs1) return pkcs1ToPkcs8(decodePemBody(pkcs1[1]));
  throw new GitHubAdapterError('Der private Schlüssel der GitHub App hat kein unterstütztes PEM-Format.', 'configuration', 503);
}

function assertConfiguration(env: GitHubEditorialEnv): asserts env is GitHubEditorialEnv & Required<Pick<GitHubEditorialEnv, 'GITHUB_APP_ID' | 'GITHUB_APP_INSTALLATION_ID' | 'GITHUB_APP_PRIVATE_KEY' | 'GITHUB_OWNER' | 'GITHUB_REPOSITORY'>> {
  const missing = ['GITHUB_APP_ID', 'GITHUB_APP_INSTALLATION_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_OWNER', 'GITHUB_REPOSITORY']
    .filter((key) => !env[key as keyof GitHubEditorialEnv]);
  if (missing.length > 0) throw new GitHubAdapterError(`GitHub-Konfiguration fehlt: ${missing.join(', ')}.`, 'configuration', 503);
}

interface GitHubResponseError {
  message?: string;
  documentation_url?: string;
}

export class GitHubAppRepository implements EditorialRepository {
  private installationToken?: { value: string; expiresAt: number };
  private readonly treeCache = new Map<string, Promise<string[]>>();
  private readonly baseUrl = 'https://api.github.com';

  private readonly env: GitHubEditorialEnv;
  private readonly fetcher: typeof fetch;

  constructor(env: GitHubEditorialEnv, fetcher: typeof fetch = fetch) {
    assertConfiguration(env);
    this.env = env;
    this.fetcher = fetcher;
  }

  private get owner(): string { return this.env.GITHUB_OWNER!; }
  private get repository(): string { return this.env.GITHUB_REPOSITORY!; }
  private get baseBranch(): string { return this.env.GITHUB_BASE_BRANCH ?? 'main'; }

  private async createAppJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const payload = base64Url(encoder.encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: this.env.GITHUB_APP_ID })));
    let key: CryptoKey;
    try {
      key = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyBytes(this.env.GITHUB_APP_PRIVATE_KEY!).buffer as ArrayBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
      );
    } catch {
      throw new GitHubAdapterError('Der private Schlüssel der GitHub App ist ungültig.', 'configuration', 503);
    }
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${payload}`));
    return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
  }

  private async getInstallationToken(force = false): Promise<string> {
    if (!force && this.installationToken && this.installationToken.expiresAt > Date.now() + 60_000) {
      return this.installationToken.value;
    }
    const fetchRequest = this.fetcher;
    const response = await fetchRequest(`${this.baseUrl}/app/installations/${this.env.GITHUB_APP_INSTALLATION_ID}/access_tokens`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${await this.createAppJwt()}`,
        'user-agent': 'ostrecht-redaktionsstudio',
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok) {
      throw new GitHubAdapterError('GitHub konnte kein Installationstoken für die App ausstellen.', 'token', response.status === 401 ? 401 : 502);
    }
    const body = await response.json() as { token: string; expires_at: string };
    this.installationToken = { value: body.token, expiresAt: Date.parse(body.expires_at) };
    return body.token;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.getInstallationToken();
    const fetchRequest = this.fetcher;
    const response = await fetchRequest(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'ostrecht-redaktionsstudio',
        'x-github-api-version': '2022-11-28',
        ...init.headers,
      },
    });
    if (response.status === 401 && retry) {
      await this.getInstallationToken(true);
      return this.request<T>(path, init, false);
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as GitHubResponseError;
      const message = body.message ? `GitHub: ${body.message}` : 'GitHub-API-Fehler.';
      throw new GitHubAdapterError(message, response.status === 409 || response.status === 422 ? 'conflict' : 'api', response.status);
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  }

  private async getRef(branch: string): Promise<string | undefined> {
    try {
      const response = await this.request<{ object: { sha: string } }>(`/repos/${this.owner}/${this.repository}/git/ref/heads/${branch}`);
      return response.object.sha;
    } catch (error) {
      if (error instanceof GitHubAdapterError && error.status === 404) return undefined;
      throw error;
    }
  }

  async getBaseRevision(): Promise<string> {
    const sha = await this.getRef(this.baseBranch);
    if (!sha) throw new GitHubAdapterError(`Der Basisbranch ${this.baseBranch} wurde nicht gefunden.`, 'api', 404);
    return sha;
  }

  async readFile(path: string, revision = this.baseBranch): Promise<string | undefined> {
    try {
      const response = await this.request<{ content: string; encoding: string }>(`/repos/${this.owner}/${this.repository}/contents/${path}?ref=${encodeURIComponent(revision)}`);
      if (response.encoding !== 'base64') throw new GitHubAdapterError('GitHub lieferte ein unbekanntes Dateiformat.', 'api');
      return decodeBase64(response.content);
    } catch (error) {
      if (error instanceof GitHubAdapterError && error.status === 404) return undefined;
      throw error;
    }
  }

  async readFiles(paths: string[], revision = this.baseBranch): Promise<Record<string, string | undefined>> {
    const uniquePaths = [...new Set(paths)];
    const result: Record<string, string | undefined> = {};
    for (let offset = 0; offset < uniquePaths.length; offset += 50) {
      const chunk = uniquePaths.slice(offset, offset + 50);
      const fields = chunk.map((path, index) =>
        `f${index}: object(expression: ${JSON.stringify(`${revision}:${path}`)}) { ... on Blob { text isBinary } }`,
      ).join('\n');
      const response = await this.request<{
        data?: { repository?: Record<string, { text?: string | null; isBinary?: boolean } | null> };
        errors?: Array<{ message?: string }>;
      }>('/graphql', {
        method: 'POST',
        body: JSON.stringify({ query: `query { repository(owner: ${JSON.stringify(this.owner)}, name: ${JSON.stringify(this.repository)}) { ${fields} } }` }),
      });
      if (response.errors?.length) throw new GitHubAdapterError(`GitHub GraphQL: ${response.errors[0].message ?? 'Dateien konnten nicht gelesen werden.'}`, 'api');
      const repository = response.data?.repository;
      if (!repository) throw new GitHubAdapterError('GitHub GraphQL lieferte kein Repository.', 'api');
      chunk.forEach((path, index) => {
        const blob = repository[`f${index}`];
        result[path] = blob && !blob.isBinary && typeof blob.text === 'string' ? blob.text : undefined;
      });
    }
    return result;
  }

  async listFiles(prefix: string, revision?: string): Promise<string[]> {
    const sha = revision ?? await this.getBaseRevision();
    let paths = this.treeCache.get(sha);
    if (!paths) {
      paths = this.request<{ tree: Array<{ path: string; type: string }> }>(`/repos/${this.owner}/${this.repository}/git/trees/${sha}?recursive=1`)
        .then((tree) => tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path).sort());
      this.treeCache.set(sha, paths);
    }
    return (await paths).filter((path) => path.startsWith(prefix));
  }

  async submit(submission: EditorialSubmission): Promise<EditorialSubmissionResult> {
    if (submission.changes.length === 0) throw new GitHubAdapterError('Die Änderung enthält keine Dateien.', 'validation', 422);
    const paths = new Set<string>();
    for (const change of submission.changes) {
      if (paths.has(change.path) || change.path.startsWith('/') || change.path.includes('..')) {
        throw new GitHubAdapterError(`Unzulässiger oder doppelter Dateipfad: ${change.path}`, 'validation', 422);
      }
      paths.add(change.path);
    }

    const baseSha = await this.getBaseRevision();
    if (baseSha !== submission.expectedBaseSha) {
      throw new GitHubAdapterError('Der Hauptbranch wurde zwischenzeitlich geändert. Bitte Änderung neu laden und den Diff erneut prüfen.', 'conflict', 409);
    }
    const safeSlug = submission.slug.replace(/[^a-z0-9-]/gu, '-').replace(/-+/gu, '-').replace(/^-|-$/gu, '') || 'aenderung';
    const safeType = submission.type.replace(/[^a-z0-9-]/gu, '-');
    const branchName = submission.branchName ?? `redaktion/${safeType}/${safeSlug}-${baseSha.slice(0, 7)}`;
    let branchHead = await this.getRef(branchName);
    if (!branchHead) {
      await this.request(`/repos/${this.owner}/${this.repository}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      });
      branchHead = baseSha;
    }

    const blobs = await Promise.all(submission.changes.map(async (change) => {
      const bytes = typeof change.content === 'string' ? encoder.encode(change.content) : change.content;
      const blob = await this.request<{ sha: string }>(`/repos/${this.owner}/${this.repository}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: base64(bytes), encoding: 'base64' }),
      });
      return { path: change.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));

    // Ein erneuter Basisvergleich verhindert, dass nach vorbereiteten Blobs still auf einem veralteten Stand committet wird.
    if (await this.getBaseRevision() !== submission.expectedBaseSha) {
      throw new GitHubAdapterError('Der Hauptbranch wurde während der Einreichung geändert. Es wurde kein Commit angelegt.', 'conflict', 409);
    }
    const parentCommit = await this.request<{ tree: { sha: string } }>(`/repos/${this.owner}/${this.repository}/git/commits/${branchHead}`);
    const tree = await this.request<{ sha: string }>(`/repos/${this.owner}/${this.repository}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: blobs }),
    });
    const commit = await this.request<{ sha: string }>(`/repos/${this.owner}/${this.repository}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: `Redaktion: ${submission.title}`,
        tree: tree.sha,
        parents: [branchHead],
        author: { name: 'Redaktionsstudio', email: submission.editorEmail },
      }),
    });
    await this.request(`/repos/${this.owner}/${this.repository}/git/refs/heads/${branchName}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    const body = [
      `Eingereicht durch: ${submission.editorEmail}`,
      `Inhaltstyp: ${submission.type}`,
      '',
      'Betroffene Routen:',
      ...submission.routes.map((route) => `- ${route}`),
      '',
      'Vorgesehene Prüfungen:',
      ...submission.checks.map((check) => `- ${check}`),
      '',
      `Basis-SHA: \`${submission.expectedBaseSha}\``,
    ].join('\n');
    const openPullRequests = await this.request<Array<{ number: number; html_url: string }>>(`/repos/${this.owner}/${this.repository}/pulls?state=open&head=${encodeURIComponent(`${this.owner}:${branchName}`)}`);
    if (openPullRequests[0]) {
      const pullRequest = await this.request<{ number: number; html_url: string }>(`/repos/${this.owner}/${this.repository}/pulls/${openPullRequests[0].number}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: submission.title, body }),
      });
      return { branchName, commitSha: commit.sha, pullRequestNumber: pullRequest.number, pullRequestUrl: pullRequest.html_url, updated: true };
    }
    const pullRequest = await this.request<{ number: number; html_url: string }>(`/repos/${this.owner}/${this.repository}/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title: submission.title, body, head: branchName, base: this.baseBranch, draft: true }),
    });
    return { branchName, commitSha: commit.sha, pullRequestNumber: pullRequest.number, pullRequestUrl: pullRequest.html_url, updated: false };
  }
}

export class MemoryEditorialRepository implements EditorialRepository {
  private revision: string;
  private readonly files: Map<string, string>;
  readonly submissions: EditorialSubmission[] = [];

  constructor(files: Record<string, string> = {}, revision = 'mock-main-sha') {
    this.files = new Map(Object.entries(files));
    this.revision = revision;
  }

  async getBaseRevision(): Promise<string> { return this.revision; }
  async readFile(path: string): Promise<string | undefined> { return this.files.get(path); }
  async readFiles(paths: string[]): Promise<Record<string, string | undefined>> {
    return Object.fromEntries(paths.map((path) => [path, this.files.get(path)]));
  }
  async listFiles(prefix: string): Promise<string[]> { return [...this.files.keys()].filter((path) => path.startsWith(prefix)).sort(); }

  async submit(submission: EditorialSubmission): Promise<EditorialSubmissionResult> {
    if (submission.expectedBaseSha !== this.revision) throw new GitHubAdapterError('Der Mock-Hauptbranch wurde zwischenzeitlich geändert.', 'conflict', 409);
    const nextFiles = new Map(this.files);
    for (const change of submission.changes) {
      nextFiles.set(change.path, typeof change.content === 'string' ? change.content : new TextDecoder().decode(change.content));
    }
    for (const [path, content] of nextFiles) this.files.set(path, content);
    this.submissions.push(structuredClone(submission));
    const branchName = submission.branchName ?? `redaktion/${submission.type}/${submission.slug}-${this.revision.slice(0, 7)}`;
    return { branchName, commitSha: `mock-commit-${this.submissions.length}`, pullRequestNumber: this.submissions.length, pullRequestUrl: `https://example.invalid/pr/${this.submissions.length}`, updated: this.submissions.length > 1 };
  }
}

export function createEditorialRepository(env: GitHubEditorialEnv, fetcher: typeof fetch = fetch): EditorialRepository {
  if (env.EDITORIAL_ADAPTER === 'mock') {
    if (env.APP_ENV !== 'local' && env.APP_ENV !== 'test') {
      throw new GitHubAdapterError('Der Mock-Adapter ist nur lokal und in Tests zulässig.', 'configuration', 503);
    }
    return new MemoryEditorialRepository();
  }
  return new GitHubAppRepository(env, fetcher);
}
