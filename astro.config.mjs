import { defineConfig, sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

const defaultSiteUrl = 'https://freistaat-ostdeutschland.de';

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
  session: {
    // Phase 1 verwendet keine serverseitigen Sessions.
    driver: sessionDrivers.null(),
  },
});
