interface D1QueryResult<T = unknown> {
  success: boolean;
  results: T[];
}

interface D1ExecResult {
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1QueryResult<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1ExecResult>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface R2GetOptions {
  onlyIf?: Headers;
  range?: Headers;
}

interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  };
}

interface R2Object {
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array> | null;
}

interface R2Bucket {
  get(key: string, options?: R2GetOptions): Promise<R2Object | R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob,
    options?: R2PutOptions,
  ): Promise<R2Object>;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MEDIA: R2Bucket;
  }
}

declare module 'cloudflare:workers' {
  export const env: Cloudflare.Env;
}
