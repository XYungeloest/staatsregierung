/// <reference types="astro/client" />

import type { D1Database, R2BucketLike } from './lib/runtime/d1-types.ts';

type OstRechtEnv = {
  APP_ENV?: string;
  ostrecht_recht?: D1Database;
  ostrecht_recht_quellen?: R2BucketLike;
};

type OstRechtRuntime = import('@astrojs/cloudflare').Runtime<OstRechtEnv>;

declare global {
  namespace App {
    interface Locals extends OstRechtRuntime {}
  }
}
