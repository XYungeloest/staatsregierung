/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

// Die Cloudflare-Bindings (D1 `ostrecht_recht`, R2 `ostrecht_recht_quellen`) werden
// im Worker über `import { env } from 'cloudflare:workers'` gelesen; die Typen der
// verwendeten Aufrufe stehen in ./lib/runtime/d1-types.ts. Siehe lib/runtime/context.ts.

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
