import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Gemeinsame SQLite-Hilfen für lokale D1-Projektionen ohne Cloudflare-Zugriff
 * (node:sqlite): Datenbank mit den echten Migrationen anlegen und einen Sync-Plan
 * (scripts/sync-recht-d1.mjs, buildSyncPlan) in einer Transaktion ausführen.
 * Verwendet von scripts/d1-projection-snapshot.mjs (Äquivalenznachweis) und
 * scripts/lib/d1-runtime-seed.mjs (Seed für den lokalen Worker).
 */

export const MIGRATION_FILE_PATTERN = /^\d{4}_.*\.sql$/u;

export async function listMigrations(root) {
  const schemaDir = join(root, 'data', 'recht', 'd1');
  return (await readdir(schemaDir)).filter((file) => MIGRATION_FILE_PATTERN.test(file)).sort().map((name) => join(schemaDir, name));
}

export async function openDatabase(path, { create, root = process.cwd(), readOnly = false } = {}) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path, readOnly ? { readOnly: true } : {});
  if (create) {
    for (const file of await listMigrations(root)) db.exec(await readFile(file, 'utf8'));
  }
  return db;
}

function bindable(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export function executePlan(db, plan) {
  let count = 0;
  db.exec('BEGIN');
  try {
    for (const group of plan.groups) {
      for (const query of group.queries) {
        db.prepare(query.sql).run(...(query.params ?? []).map(bindable));
        count += 1;
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return count;
}

/** FTS5-Integritätsprüfung des Suchindex (wirft bei Abweichung). */
export function checkSearchIndexIntegrity(db) {
  db.exec("INSERT INTO law_search(law_search) VALUES ('integrity-check')");
}
