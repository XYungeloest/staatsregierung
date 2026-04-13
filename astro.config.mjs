// @ts-check
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL ?? 'https://XYungeloest.github.io';
const rawBase = process.env.BASE_PATH ?? '/staatsregierung';
const normalizedBase = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;

export default defineConfig({
  output: 'static',
  site,
  base: normalizedBase,
});
