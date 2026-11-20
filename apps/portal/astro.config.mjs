import { fileURLToPath } from 'node:url';
import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { internalKnowledgeGuard } from '../../scripts/lib/internal-knowledge.mjs';
import { createBuildInfo } from '../../scripts/lib/release-info.mjs';
import { haushaltVorschauIntegration, parseHaushaltVorschau } from '../../scripts/lib/haushalt/vorschau.mjs';
import { legacyRedirects } from './src/config/legacy-routes.mjs';

const defaultPortalSiteUrl = 'https://freistaat-ostdeutschland.de';
const defaultLawSiteUrl = 'https://recht.freistaat-ostdeutschland.de';
const portalSiteUrl = process.env.PORTAL_SITE_URL ?? defaultPortalSiteUrl;
const lawSiteUrl = process.env.LAW_SITE_URL ?? defaultLawSiteUrl;
const buildInfo = createBuildInfo('portal');
// Vorschau nicht freigegebener Haushaltsperioden (apps/portal/src/lib/haushalt/perioden.ts). Nur
// lokale Prüfungen und CI-Builds setzen HAUSHALT_VORSCHAU; Produktions- und Staging-Deploys
// verweigern Vorschau-Builds (scripts/check-haushalt-release.mjs). Unbekannte Werte brechen ab.
const haushaltVorschau = parseHaushaltVorschau(process.env.HAUSHALT_VORSCHAU);

function normalizeBasePath(value) {
  if (!value || value === '/') {
    return '/';
  }

  const trimmedValue = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmedValue ? `/${trimmedValue}/` : '/';
}

export default defineConfig({
  adapter: cloudflare({
    imageService: 'passthrough',
    // Portal- und Rechtsdaten werden weiterhin buildzeitbasiert aus Dateien gelesen.
    prerenderEnvironment: 'node',
  }),
  output: 'static',
  srcDir: './src',
  publicDir: './.site-public',
  outDir: './dist',
  site: process.env.SITE_URL ?? portalSiteUrl,
  base: normalizeBasePath(process.env.BASE_PATH),
  vite: {
    plugins: [internalKnowledgeGuard()],
    define: {
      'import.meta.env.PORTAL_BUILD_COMMIT': JSON.stringify(buildInfo.commit),
      'import.meta.env.PORTAL_BUILD_INFO': JSON.stringify(buildInfo),
      'import.meta.env.PORTAL_SITE_URL': JSON.stringify(portalSiteUrl),
      'import.meta.env.LAW_SITE_URL': JSON.stringify(lawSiteUrl),
      'import.meta.env.SITE_TARGET': JSON.stringify('portal'),
      'import.meta.env.HAUSHALT_VORSCHAU': JSON.stringify(haushaltVorschau),
    },
  },
  redirects: legacyRedirects,
  integrations: [
    haushaltVorschauIntegration({
      vorschau: haushaltVorschau,
      contentRoot: fileURLToPath(new URL('../../content', import.meta.url)),
    }),
  ],
  session: {
    // Die statischen Seiten benötigen keine serverseitigen Sessions.
    driver: sessionDrivers.null(),
  },
});
