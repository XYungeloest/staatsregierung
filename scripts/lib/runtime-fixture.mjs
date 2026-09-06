import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Manifest und Bestand des D1-Testfixtures (data/recht/runtime-fixture.json).
 *
 * Zwei Manifestformen:
 *   - synthetisch (`"$schema": "runtime-fixture/2"`, `"source": "synthetic"`): der Bestand ist die
 *     Ausgabe des Builders tests/helpers/fixture-corpus.ts (Normen, Verkündungen, Themen,
 *     Pressemitteilungen); content/ wird nicht gelesen. So sehen Browser-, Barrierefreiheits- und
 *     Screenshot-Tests einen kleinen deterministischen Bestand, den redaktionelle Änderungen unter
 *     content/ nicht verändern.
 *   - Slug-Liste (`{ "slugs": [...] }`, Staging-Sonderfall von scripts/sync-recht-d1.mjs
 *     --corpus-filter): reale Normen aus content/normen, alle Verkündungen.
 *
 * Nur dieser Lader importiert den Builder – mit literalem Spezifizierer, damit der Code-Abschluss
 * der Projektion sicher bleibt. scripts/sync-recht-d1.mjs, scripts/lib/d1-sync-scope.mjs,
 * scripts/lib/d1-projection-fingerprint.mjs und scripts/lib/d1-projection-proof-format.mjs
 * importieren diese Datei nicht: der Fixture-Bestand ist Testdatum, keine Projektionslogik
 * (tests/runtime-fixture-manifest.test.ts prüft das).
 */

export const FIXTURE_MANIFEST_SCHEMA = 'runtime-fixture/2';
export const FIXTURE_BUILDER_PATH = 'tests/helpers/fixture-corpus.ts';

export function isSyntheticFixture(manifest) {
  return Boolean(manifest) && typeof manifest === 'object' && manifest.source === 'synthetic';
}

/** Manifest lesen und auf eine der beiden Formen prüfen. */
export async function readFixtureManifest(root, fixturePath) {
  const manifest = JSON.parse(await readFile(resolve(root, fixturePath), 'utf8'));
  if (isSyntheticFixture(manifest)) {
    if (manifest.$schema !== FIXTURE_MANIFEST_SCHEMA) throw new Error(`${fixturePath}: synthetisches Fixture erwartet "$schema": "${FIXTURE_MANIFEST_SCHEMA}", gefunden ${JSON.stringify(manifest.$schema)}`);
    if (manifest.builder !== FIXTURE_BUILDER_PATH) throw new Error(`${fixturePath}: "builder" muss ${FIXTURE_BUILDER_PATH} sein (nur dieser Builder wird geladen), gefunden ${JSON.stringify(manifest.builder)}`);
    if (!manifest.roles || typeof manifest.roles !== 'object') throw new Error(`${fixturePath}: "roles" (Rolle → Slugs) fehlt`);
    return manifest;
  }
  if (!Array.isArray(manifest.slugs) || manifest.slugs.length === 0) throw new Error(`${fixturePath}: weder synthetisches Manifest ("source": "synthetic") noch Slug-Liste ("slugs")`);
  return manifest;
}

/** Slugs einer Slug-Liste (Einträge als String oder { slug }). */
export function fixtureSlugList(manifest) {
  return [...new Set((manifest.slugs ?? []).map((entry) => (typeof entry === 'string' ? entry : entry?.slug)).filter(Boolean))];
}

/** Alle Slugs, die das Manifest einer Rolle zuordnet (synthetisch) bzw. Slugs mit Rollen (Slug-Liste). */
export function fixtureRoleSlugs(manifest) {
  if (isSyntheticFixture(manifest)) return new Set(Object.values(manifest.roles).flat());
  return new Set((manifest.slugs ?? []).flatMap((entry) => (entry && typeof entry === 'object' && Array.isArray(entry.roles) && entry.roles.length > 0 ? [entry.slug] : [])));
}

/**
 * Bestand eines synthetischen Fixtures aus dem Builder (literaler dynamischer Import, unter
 * node --experimental-strip-types). `root` ist nur Teil der Fehlermeldung: der Builder liegt
 * relativ zu dieser Datei, nicht zum geprüften Baum.
 */
export async function loadFixtureCorpus(root, manifest) {
  if (!isSyntheticFixture(manifest)) throw new Error(`Bestand aus dem Builder gibt es nur für ein synthetisches Fixture (${root})`);
  const builder = await import('../../tests/helpers/fixture-corpus.ts');
  const { topics, pressReleases } = builder.buildFixturePortal();
  return { norms: builder.buildFixtureNorms(), publications: builder.buildFixturePublications(), topics, pressReleases, manifest: builder.buildFixtureManifest() };
}

/** Erwartete Normzahl im Fixture-Scope: Builder-Normen oder eindeutige Slugs der Liste. */
export async function expectedFixtureNormCount(root, manifest) {
  if (isSyntheticFixture(manifest)) return (await loadFixtureCorpus(root, manifest)).norms.length;
  return fixtureSlugList(manifest).length;
}

/** Manifest aus dem Builder nach data/recht/runtime-fixture.json schreiben (Pflege nach Builder-Änderungen). */
export async function writeFixtureManifest(root = process.cwd(), fixturePath = 'data/recht/runtime-fixture.json') {
  const builder = await import('../../tests/helpers/fixture-corpus.ts');
  const target = resolve(root, fixturePath);
  await writeFile(target, `${JSON.stringify(builder.buildFixtureManifest(), null, 2)}\n`, 'utf8');
  return target;
}
