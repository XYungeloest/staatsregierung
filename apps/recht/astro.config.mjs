import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { resolveBuildCommit } from '../../scripts/lib/build-commit.mjs';

const defaultPortalSiteUrl = 'https://freistaat-ostdeutschland.de';
const defaultLawSiteUrl = 'https://recht.freistaat-ostdeutschland.de';
const portalSiteUrl = process.env.PORTAL_SITE_URL ?? defaultPortalSiteUrl;
const lawSiteUrl = process.env.LAW_SITE_URL ?? defaultLawSiteUrl;
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
  srcDir: './src',
  publicDir: './.site-public',
  outDir: './dist',
  site: process.env.SITE_URL ?? lawSiteUrl,
  base: normalizeBasePath(process.env.BASE_PATH),
  vite: {
    define: {
      'import.meta.env.PORTAL_BUILD_COMMIT': JSON.stringify(buildCommit),
      'import.meta.env.PORTAL_SITE_URL': JSON.stringify(portalSiteUrl),
      'import.meta.env.LAW_SITE_URL': JSON.stringify(lawSiteUrl),
      'import.meta.env.SITE_TARGET': JSON.stringify('law'),
    },
  },
  session: {
    // Die statischen Seiten benötigen keine serverseitigen Sessions.
    driver: sessionDrivers.null(),
  },
});
