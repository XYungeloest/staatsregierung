import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { resolveBuildCommit } from './scripts/lib/build-commit.mjs';

const defaultSiteUrl = 'https://freistaat-ostdeutschland.de';
const buildCommit = resolveBuildCommit();

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
  site: process.env.SITE_URL ?? defaultSiteUrl,
  base: normalizeBasePath(process.env.BASE_PATH),
  vite: {
    define: {
      'import.meta.env.PORTAL_BUILD_COMMIT': JSON.stringify(buildCommit),
    },
  },
  redirects: {
    '/presse/termine/einbringung-kreis-und-bezirksreform-2027/':
      '/presse/termine/einbringung-kreis-und-bezirksreform-2026/',
    '/recht/norm/sachsische-landkreisordnung/':
      '/recht/norm/saechsische-landkreisordnung/',
  },
  session: {
    // Phase 1 verwendet keine serverseitigen Sessions.
    driver: sessionDrivers.null(),
  },
});
