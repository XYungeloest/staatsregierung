/**
 * Minimale Typen für die Cloudflare-D1- und R2-Bindings von OstRecht. Sie decken
 * genau die verwendeten Aufrufe ab, damit keine zusätzliche Typbibliothek nötig ist.
 */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>;
}

export interface R2ObjectBodyLike {
  body: ReadableStream | null;
  httpEtag?: string;
  size?: number;
  httpMetadata?: { contentType?: string };
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
}
