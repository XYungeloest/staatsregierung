import { defineConfig } from 'astro/config';

function normalizeBasePath(value) {
  if (!value || value === '/') {
    return '/';
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://freistaat-ostdeutschland.de',
  base: normalizeBasePath(process.env.BASE_PATH),
});
