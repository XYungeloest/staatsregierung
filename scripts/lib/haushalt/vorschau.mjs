import { existsSync, readFileSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vorschaumodus des Haushaltsbereichs (reines JavaScript, ohne Abhängigkeiten auf das Portal):
 *
 * - `parseHaushaltVorschau` wertet HAUSHALT_VORSCHAU streng aus; unbekannte Werte brechen den
 *   Build ab, damit keine Seite den Schalter anders liest als das Gate.
 * - `haushaltVorschauIntegration` (Astro-Integration in apps/portal/astro.config.mjs) schreibt
 *   nach einem Vorschau-Build mit mindestens einer nicht freigegebenen Periode den Marker
 *   dist/haushalt-vorschau.json (außerhalb von dist/client, nicht ausgeliefert) und ergänzt
 *   dist/client/_headers um `X-Robots-Tag: noindex` für jede solche Periode; ohne Vorschau oder
 *   ohne nicht freigegebene Periode entfernt sie einen alten Marker.
 * - Der Freigabe-Guard (scripts/check-haushalt-release.mjs) liest Marker und Header-Regeln.
 */

export const VORSCHAU_MARKER = 'haushalt-vorschau.json';
export const VORSCHAU_SCHEMA = 'haushalt-vorschau/1';
const EIN = new Set(['1', 'true']);
const AUS = new Set(['', '0', 'false']);

/** HAUSHALT_VORSCHAU: „1“/„true“ → true, leer/„0“/„false“ → false, sonst Fehler. */
export function parseHaushaltVorschau(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true) return true;
  const normalized = String(value).trim().toLowerCase();
  if (EIN.has(normalized)) return true;
  if (AUS.has(normalized)) return false;
  throw new Error(`HAUSHALT_VORSCHAU="${value}" ist ungültig; zulässig sind 1, true, 0, false oder leer.`);
}

/**
 * Öffentlich ⇔ freigabe.oeffentlich === true und Status nicht „arbeitsentwurf“ – dieselbe Regel
 * wie isPeriodePublic (apps/portal/src/lib/haushalt/perioden.ts) und isPeriodPublic
 * (scripts/lib/haushalt/editorial.mjs).
 */
export function isPeriodPublic(entry) {
  return entry?.freigabe?.oeffentlich === true && entry?.status !== 'arbeitsentwurf';
}

/** Kennungen der nicht freigegebenen Perioden laut content/haushalt/perioden.json; fehlt das Register, Fehler. */
export function nichtFreigegebenePerioden(contentRoot) {
  const path = join(contentRoot, 'haushalt', 'perioden.json');
  if (!existsSync(path)) throw new Error('content/haushalt/perioden.json fehlt');
  const register = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(register?.perioden)) throw new Error('content/haushalt/perioden.json: Liste „perioden“ fehlt');
  return register.perioden
    .filter((entry) => !isPeriodPublic(entry))
    .map((entry) => String(entry.id))
    .filter((id) => /^\d{4}-\d{4}$/u.test(id));
}

/** Pfadmuster der noindex-Regel einer Periode in _headers. */
export function vorschauHeaderPfad(id) {
  return `/haushalt/${id}/*`;
}

/** _headers-Block mit X-Robots-Tag: noindex für alle Pfade nicht freigegebener Perioden. */
export function vorschauHeaderRegeln(perioden) {
  return perioden.map((id) => `${vorschauHeaderPfad(id)}\n  X-Robots-Tag: noindex\n`).join('\n');
}

/** Pfade in _headers, für die eine Regel `X-Robots-Tag: noindex` gilt. */
export function noindexHeaderPfade(headers) {
  const pfade = new Set();
  let aktuell = null;
  for (const zeile of headers.replace(/\r\n?/gu, '\n').split('\n')) {
    if (zeile.trim() === '' || zeile.trimStart().startsWith('#')) continue;
    if (!/^\s/u.test(zeile)) {
      aktuell = zeile.trim();
    } else if (aktuell && /^x-robots-tag:\s*noindex\b/iu.test(zeile.trim())) {
      pfade.add(aktuell);
    }
  }
  return pfade;
}

function toPath(value) {
  return value instanceof URL ? fileURLToPath(value) : value;
}

/**
 * Schreibt bzw. entfernt die Vorschau-Artefakte eines Portal-Builds.
 * @param {{ outDir: string|URL, clientDir: string|URL, vorschau: boolean, contentRoot: string }} options
 * @returns {Promise<{ marker: boolean, perioden: string[] }>}
 */
export async function schreibeVorschauArtefakte({ outDir, clientDir, vorschau, contentRoot }) {
  const markerPath = join(toPath(outDir), VORSCHAU_MARKER);
  if (!vorschau) {
    await rm(markerPath, { force: true });
    return { marker: false, perioden: [] };
  }
  const perioden = nichtFreigegebenePerioden(contentRoot);
  // Ohne nicht freigegebene Periode entspricht ein Vorschau-Build der Freigabeform: kein Marker,
  // damit PR-Vorschauen hochgeladen werden und der Freigabe-Guard den Build wie jeden anderen prüft.
  if (perioden.length === 0) {
    await rm(markerPath, { force: true });
    return { marker: false, perioden: [] };
  }
  {
    const headersPath = join(toPath(clientDir), '_headers');
    const bisher = existsSync(headersPath) ? await readFile(headersPath, 'utf8') : '';
    const fehlend = perioden.filter((id) => !noindexHeaderPfade(bisher).has(vorschauHeaderPfad(id)));
    if (fehlend.length > 0) {
      const trenner = bisher === '' || bisher.endsWith('\n\n') ? '' : bisher.endsWith('\n') ? '\n' : '\n\n';
      await writeFile(headersPath, `${bisher}${trenner}${vorschauHeaderRegeln(fehlend)}`, 'utf8');
    }
  }
  await writeFile(markerPath, `${JSON.stringify({ schema: VORSCHAU_SCHEMA, vorschau: true, perioden }, null, 2)}\n`, 'utf8');
  return { marker: true, perioden };
}

/**
 * Astro-Integration „haushalt-vorschau-marker“.
 * @param {{ vorschau: boolean, contentRoot: string }} options
 */
export function haushaltVorschauIntegration({ vorschau, contentRoot }) {
  let outDir;
  let clientDir;
  return {
    name: 'haushalt-vorschau-marker',
    hooks: {
      'astro:config:done': ({ config }) => {
        outDir = config.outDir;
        clientDir = config.build?.client ?? config.outDir;
      },
      'astro:build:done': async ({ logger }) => {
        const result = await schreibeVorschauArtefakte({ outDir, clientDir, vorschau, contentRoot });
        if (result.marker) {
          logger.info(
            `Vorschau-Build: nicht freigegebene Haushaltsperioden (${result.perioden.join(', ')}) sind enthalten (noindex, nicht für die Produktion).`,
          );
        }
      },
    },
  };
}
