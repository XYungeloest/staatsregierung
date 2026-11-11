import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SNAPSHOT_SCHEMA,
  type Artefakt,
  type EinzelplaeneDatei,
  type Einzelplan,
  type FinanzierungDatei,
  type Gesamtplan,
  type GesetzeDatei,
  type ImportManifest,
  type Kapitel,
  type KapitelDatei,
  type PersonalDatei,
  type Periodenmeta,
  type Projekt,
  type ProjekteDatei,
  type QualitaetDatei,
  type RuecklagenDatei,
  type SnapshotKopf,
  type Titel,
  type TitelDatei,
} from './types.ts';

/**
 * Buildzeit-Loader für den Haushaltssnapshot unter <repo>/data/haushalt/<periode>/.
 *
 * Liest ausschließlich den versionierten Snapshot (nie das Haushaltsrepo), prüft Schema-Kennung
 * und Periode jeder Datei und hält die Ergebnisse im Speicher. Beträge werden unverändert
 * weitergegeben.
 */

const PERIODE_MUSTER = /^\d{4}-\d{4}$/u;
const EINZELPLAN_MUSTER = /^\d{2}$/u;

function isRepositoryRoot(candidate: string): boolean {
  const packagePath = join(candidate, 'package.json');
  if (!existsSync(packagePath)) return false;
  try {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { workspaces?: unknown };
    return Array.isArray(packageJson.workspaces) && existsSync(join(candidate, 'data'));
  } catch {
    return false;
  }
}

function searchUpwards(start: string): string | null {
  let candidate = resolve(start);
  while (true) {
    if (isRepositoryRoot(candidate)) return candidate;
    const parent = dirname(candidate);
    if (parent === candidate) return null;
    candidate = parent;
  }
}

let cachedRoot: string | null = null;

/** Repository-Wurzel: package.json mit `workspaces` und einem data/-Verzeichnis. */
export function resolveHaushaltRepositoryRoot(): string {
  if (cachedRoot) return cachedRoot;
  const starts: string[] = [];
  try {
    starts.push(dirname(fileURLToPath(import.meta.url)));
  } catch {
    // import.meta.url ist im gebündelten Build nicht immer eine Datei-URL.
  }
  starts.push(process.cwd());
  for (const start of starts) {
    const root = searchUpwards(start);
    if (root) {
      cachedRoot = root;
      return root;
    }
  }
  throw new Error(`Repository-Wurzel für die Haushaltsdaten nicht gefunden (gesucht ab ${starts.join(', ')}).`);
}

/** Wurzel aller Snapshots: <repo>/data/haushalt. */
export function getHaushaltDataRoot(): string {
  return join(resolveHaushaltRepositoryRoot(), 'data', 'haushalt');
}

export function getSnapshotDirectory(periode: string): string {
  if (!PERIODE_MUSTER.test(periode)) throw new Error(`Ungültige Haushaltsperiode „${periode}“.`);
  return join(getHaushaltDataRoot(), periode);
}

export function hasSnapshot(periode: string): boolean {
  return existsSync(join(getSnapshotDirectory(periode), 'import-manifest.json'));
}

const cache = new Map<string, unknown>();

function loadFile<T extends SnapshotKopf>(periode: string, relativePath: string): T {
  const key = `${periode}/${relativePath}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached as T;

  const path = join(getSnapshotDirectory(periode), relativePath);
  if (!existsSync(path)) {
    throw new Error(`Haushaltsdaten ${periode}/${relativePath} fehlen. Der Snapshot wird mit „npm run haushalt:sync“ erzeugt.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Haushaltsdaten ${periode}/${relativePath} enthalten ungültiges JSON: ${(error as Error).message}`);
  }
  const head = json as Partial<SnapshotKopf> | null;
  if (!head || typeof head !== 'object' || head.schema !== SNAPSHOT_SCHEMA || head.periode !== periode) {
    throw new Error(`Haushaltsdaten ${periode}/${relativePath}: Schema „${String(head?.schema)}“ oder Periode „${String(head?.periode)}“ unerwartet.`);
  }
  cache.set(key, json);
  return json as T;
}

export function loadImportManifest(periode: string): ImportManifest {
  return loadFile<ImportManifest>(periode, 'import-manifest.json');
}

export function loadPeriodMeta(periode: string): Periodenmeta {
  return loadFile<Periodenmeta>(periode, 'periode.json');
}

export function loadGesamtplan(periode: string): Gesamtplan {
  return loadFile<Gesamtplan>(periode, 'gesamtplan.json');
}

export function loadEinzelplaene(periode: string): Einzelplan[] {
  return loadFile<EinzelplaeneDatei>(periode, 'einzelplaene.json').einzelplaene;
}

export function loadEinzelplan(periode: string, ep: string): Einzelplan | undefined {
  return loadEinzelplaene(periode).find((entry) => entry.ep === ep);
}

export function loadKapitel(periode: string): Kapitel[] {
  return loadFile<KapitelDatei>(periode, 'kapitel.json').kapitel;
}

export function loadKapitelForPlan(periode: string, ep: string): Kapitel[] {
  return loadKapitel(periode).filter((entry) => entry.einzelplan === ep);
}

export function loadTitelDatei(periode: string, ep: string): TitelDatei {
  if (!EINZELPLAN_MUSTER.test(ep)) throw new Error(`Ungültige Einzelplannummer „${ep}“.`);
  return loadFile<TitelDatei>(periode, `titel/${ep}.json`);
}

export function loadTitelForPlan(periode: string, ep: string): Titel[] {
  return loadTitelDatei(periode, ep).titel;
}

export function loadTitelForKapitel(periode: string, kapitel: string): Titel[] {
  return loadTitelForPlan(periode, kapitel.slice(0, 2)).filter((entry) => entry.kapitel === kapitel);
}

export function loadAllTitel(periode: string): Titel[] {
  return loadEinzelplaene(periode).flatMap((plan) => loadTitelForPlan(periode, plan.ep));
}

export function loadProjekte(periode: string): Projekt[] {
  return loadFile<ProjekteDatei>(periode, 'projekte.json').projekte;
}

export function loadFinanzierung(periode: string): FinanzierungDatei {
  return loadFile<FinanzierungDatei>(periode, 'finanzierung.json');
}

export function loadRuecklagen(periode: string): RuecklagenDatei {
  return loadFile<RuecklagenDatei>(periode, 'ruecklagen.json');
}

export function loadPersonal(periode: string): PersonalDatei {
  return loadFile<PersonalDatei>(periode, 'personal.json');
}

export function loadQualitaet(periode: string): QualitaetDatei {
  return loadFile<QualitaetDatei>(periode, 'qualitaet.json');
}

export function loadGesetze(periode: string): GesetzeDatei {
  return loadFile<GesetzeDatei>(periode, 'gesetze.json');
}

/**
 * Übernommener Artefakteintrag zu einem veröffentlichten Dateinamen (z. B. „Haushalt_2027_2028.pdf“)
 * oder `undefined`. Gesperrte und ersetzte Quelldateien tragen keinen veröffentlichten Namen.
 */
export function findUebernommenesArtefakt(
  manifest: Pick<ImportManifest, 'artefakte'>,
  datei: string,
): Extract<Artefakt, { status: 'uebernommen' }> | undefined {
  return manifest.artefakte.find(
    (entry): entry is Extract<Artefakt, { status: 'uebernommen' }> => entry.status === 'uebernommen' && entry.datei === datei,
  );
}

/**
 * Absoluter Pfad einer übernommenen Ausgabedatei (PDF/XLSX) unter ihrem veröffentlichten Namen oder
 * `null`, wenn keine Quelldatei unter diesem Namen übernommen wurde. Welche Quelldatei das ist
 * (vorrangig die öffentliche Ausgabefassung), entscheidet allein der Import.
 */
export function getArtifactPath(periode: string, datei: string): string | null {
  if (!findUebernommenesArtefakt(loadImportManifest(periode), datei)) return null;
  const path = join(getSnapshotDirectory(periode), 'ausgabe', datei);
  return existsSync(path) ? path : null;
}

/** Leert den Zwischenspeicher (für Tests). */
export function clearSnapshotCache(): void {
  cache.clear();
}
