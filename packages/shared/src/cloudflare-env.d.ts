declare namespace Cloudflare {
  interface Env {
    APP_ENV?: string;
  }
}

interface ImportMetaEnv {
  readonly PORTAL_BUILD_COMMIT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
