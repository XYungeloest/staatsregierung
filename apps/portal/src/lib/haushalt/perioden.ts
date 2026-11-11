import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasSnapshot, resolveHaushaltRepositoryRoot } from './snapshot.ts';

/**
 * Periodenregister des Haushaltsbereichs (content/haushalt/perioden.json) und zentrale
 * Sichtbarkeitsentscheidung.
 *
 * Öffentlich ist eine Periode genau dann, wenn `freigabe.oeffentlich === true` und ihr Status
 * nicht „arbeitsentwurf“ ist. Ein Build mit `HAUSHALT_VORSCHAU` (über astro.config.mjs als
 * `import.meta.env.HAUSHALT_VORSCHAU`) macht zusätzlich alle nicht freigegebenen Perioden sichtbar;
 * deren Seiten tragen dann `noindex` und den Vorschauhinweis (`isPreviewOnly`) und stehen nie in
 * der Sitemap. Ohne Vorschau erzeugen nicht freigegebene Perioden keine Seiten, keine
 * Inventar-, Such- oder Sitemapeinträge und keine Verweise.
 *
 * Das Register wird zur Buildzeit per node:fs gelesen und vollständig geprüft; ein ungültiges
 * Register bricht den Build ab. Alle Abfragen nehmen optional ein eigenes Register, den
 * Vorschaumodus und den Stichtag entgegen (Tests).
 */

export const HAUSHALTS_STATUS = [
  'arbeitsentwurf',
  'regierungsentwurf',
  'parlamentarische-beratung',
  'beschlossen',
  'verkuendet',
  'historisch',
] as const;
export type HaushaltsStatus = (typeof HAUSHALTS_STATUS)[number];

export const HAUSHALTS_DATENQUELLEN = ['snapshot', 'legacy-2025-2026'] as const;
export type HaushaltsDatenquelle = (typeof HAUSHALTS_DATENQUELLEN)[number];

export interface PeriodenFreigabe {
  oeffentlich: boolean;
  /** Freigabedatum (JJJJ-MM-TT); bei nicht freigegebenen Perioden null. */
  datum: string | null;
  /** Grundlage der Freigabe; bei nicht freigegebenen Perioden null. */
  grundlage: string | null;
  /** Redaktioneller Hinweis zur ausstehenden Freigabe (nicht öffentlich anzuzeigen). */
  hinweis?: string;
}

export interface Nachtrag {
  nummer: number;
  status: HaushaltsStatus;
}

export interface Haushaltsperiode {
  /** Kennung JJJJ-JJJJ, zugleich URL-Segment. */
  id: string;
  bezeichnung: string;
  jahre: number[];
  status: HaushaltsStatus;
  datenquelle: HaushaltsDatenquelle;
  freigabe: PeriodenFreigabe;
  rechtsgrundlage?: { normSlug: string };
  nachtrag?: Nachtrag;
}

export interface PeriodenRegister {
  perioden: Haushaltsperiode[];
}

/** Optionen aller Abfragen; ohne Angabe gelten Register, Vorschaumodus und Stichtag des Builds. */
export interface PeriodenOptionen {
  register?: PeriodenRegister;
  vorschau?: boolean;
  /** Redaktioneller Stichtag JJJJ-MM-TT. */
  stichtag?: string;
}

/** Farbton des Statusabzeichens (entspricht `StatusTone` der Haushaltskomponenten). */
export type HaushaltsStatusTon = 'geltend' | 'entwurf' | 'beratung' | 'beschlossen' | 'historisch' | 'vorschau';

export interface PeriodenStatusInfo {
  /** Kurzbezeichnung für das Statusabzeichen. */
  label: string;
  tone: HaushaltsStatusTon;
  /** Ein Satz zur Einordnung des Status in öffentlicher Sprache. */
  text: string;
  /** Laufender oder abgeschlossener Nachtrag, sofern im Register geführt. */
  nachtrag?: { nummer: number; label: string; text: string; tone: HaushaltsStatusTon };
}

const PERIODE_MUSTER = /^(\d{4})-(\d{4})$/u;
const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/u;

function fehler(at: string, message: string): never {
  throw new Error(`content/haushalt/perioden.json ${at}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStatus(value: unknown): value is HaushaltsStatus {
  return typeof value === 'string' && (HAUSHALTS_STATUS as readonly string[]).includes(value);
}

/**
 * Prüft ein Periodenregister und gibt es typisiert zurück. Wirft bei jedem Formfehler; die
 * Querprüfungen gegen Snapshots und Normen übernimmt `npm run haushalt:check`.
 */
export function parsePeriodenRegister(value: unknown): PeriodenRegister {
  if (!isRecord(value) || !Array.isArray(value.perioden)) fehler('', 'erwartet ein Objekt mit der Liste „perioden“');
  const ids = new Set<string>();
  const perioden = value.perioden.map((entry, index): Haushaltsperiode => {
    const at = `perioden[${index}]`;
    if (!isRecord(entry)) fehler(at, 'kein Objekt');
    const id = entry.id;
    const match = typeof id === 'string' ? PERIODE_MUSTER.exec(id) : null;
    if (!match || typeof id !== 'string') fehler(at, `id „${String(id)}“ hat nicht die Form JJJJ-JJJJ`);
    if (ids.has(id)) fehler(at, `Periode ${id} doppelt`);
    ids.add(id);
    const jahre = [Number(match[1]), Number(match[2])];
    if (jahre[1] !== jahre[0] + 1) fehler(at, `${id} sind keine aufeinanderfolgenden Jahre`);
    if (!Array.isArray(entry.jahre) || entry.jahre.length !== 2 || entry.jahre[0] !== jahre[0] || entry.jahre[1] !== jahre[1]) {
      fehler(at, `jahre passen nicht zur id ${id}`);
    }
    if (typeof entry.bezeichnung !== 'string' || entry.bezeichnung.trim() === '') fehler(at, 'bezeichnung fehlt');
    if (!isStatus(entry.status)) fehler(at, `Status „${String(entry.status)}“ ist nicht zulässig`);
    const datenquelle = entry.datenquelle;
    if (typeof datenquelle !== 'string' || !(HAUSHALTS_DATENQUELLEN as readonly string[]).includes(datenquelle)) {
      fehler(at, `datenquelle „${String(datenquelle)}“ ist nicht zulässig`);
    }
    const freigabe = entry.freigabe;
    if (!isRecord(freigabe) || typeof freigabe.oeffentlich !== 'boolean') fehler(at, 'freigabe.oeffentlich fehlt');
    const datum = freigabe.datum ?? null;
    const grundlage = freigabe.grundlage ?? null;
    if (freigabe.oeffentlich) {
      if (typeof datum !== 'string' || !DATUM_MUSTER.test(datum)) fehler(at, 'freigegebene Periode ohne Freigabedatum');
      if (typeof grundlage !== 'string' || grundlage.trim() === '') fehler(at, 'freigegebene Periode ohne Freigabegrundlage');
      if (entry.status === 'arbeitsentwurf') fehler(at, 'ein Arbeitsentwurf darf nicht freigegeben werden');
    } else if (datum !== null || grundlage !== null) {
      fehler(at, 'nicht freigegebene Periode trägt Freigabedatum oder -grundlage');
    }
    if (freigabe.hinweis !== undefined && typeof freigabe.hinweis !== 'string') fehler(at, 'freigabe.hinweis ist kein Text');

    let rechtsgrundlage: Haushaltsperiode['rechtsgrundlage'];
    if (entry.rechtsgrundlage !== undefined) {
      const slug = isRecord(entry.rechtsgrundlage) ? entry.rechtsgrundlage.normSlug : undefined;
      if (typeof slug !== 'string' || slug === '') fehler(at, 'rechtsgrundlage.normSlug fehlt');
      rechtsgrundlage = { normSlug: slug };
    }
    if (entry.status === 'verkuendet' && !rechtsgrundlage) fehler(at, 'verkündete Periode ohne Rechtsgrundlage');

    let nachtrag: Nachtrag | undefined;
    if (entry.nachtrag !== undefined) {
      const raw = entry.nachtrag;
      if (!isRecord(raw) || !Number.isSafeInteger(raw.nummer) || (raw.nummer as number) < 1) fehler(at, 'nachtrag.nummer muss eine positive ganze Zahl sein');
      if (!isStatus(raw.status)) fehler(at, `nachtrag.status „${String(raw.status)}“ ist nicht zulässig`);
      nachtrag = { nummer: raw.nummer as number, status: raw.status };
    }

    return {
      id,
      bezeichnung: entry.bezeichnung,
      jahre,
      status: entry.status,
      datenquelle: datenquelle as HaushaltsDatenquelle,
      freigabe: {
        oeffentlich: freigabe.oeffentlich,
        datum: datum as string | null,
        grundlage: grundlage as string | null,
        ...(typeof freigabe.hinweis === 'string' ? { hinweis: freigabe.hinweis } : {}),
      },
      ...(rechtsgrundlage ? { rechtsgrundlage } : {}),
      ...(nachtrag ? { nachtrag } : {}),
    };
  });
  return { perioden };
}

let registerCache: PeriodenRegister | null = null;
let stichtagCache: string | null = null;

/** Liest und prüft content/haushalt/perioden.json (zwischengespeichert). */
export function loadPeriodenRegister(): PeriodenRegister {
  if (registerCache) return registerCache;
  const path = join(resolveHaushaltRepositoryRoot(), 'content', 'haushalt', 'perioden.json');
  if (!existsSync(path)) throw new Error('Periodenregister content/haushalt/perioden.json fehlt.');
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`content/haushalt/perioden.json enthält ungültiges JSON: ${(error as Error).message}`);
  }
  registerCache = parsePeriodenRegister(json);
  return registerCache;
}

/** Redaktioneller Stichtag aus packages/shared/src/config/editorial.json. */
export function getRedaktionellerStichtag(): string {
  if (stichtagCache) return stichtagCache;
  const path = join(resolveHaushaltRepositoryRoot(), 'packages', 'shared', 'src', 'config', 'editorial.json');
  const json = JSON.parse(readFileSync(path, 'utf8')) as { referenceDate?: unknown };
  if (typeof json.referenceDate !== 'string' || !DATUM_MUSTER.test(json.referenceDate)) {
    throw new Error('packages/shared/src/config/editorial.json: referenceDate fehlt oder ist kein Datum.');
  }
  stichtagCache = json.referenceDate;
  return stichtagCache;
}

/** Leert die Zwischenspeicher (für Tests). */
export function clearPeriodenCache(): void {
  registerCache = null;
  stichtagCache = null;
}

function readVorschauFlag(): unknown {
  // Vite ersetzt import.meta.env.HAUSHALT_VORSCHAU im Build (astro.config.mjs); Node-Skripte und
  // Tests lesen die Umgebungsvariable.
  const metaEnvironment = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const fromMeta = metaEnvironment?.HAUSHALT_VORSCHAU;
  if (fromMeta !== undefined) return fromMeta;
  return typeof process !== 'undefined' ? process.env?.HAUSHALT_VORSCHAU : undefined;
}

/** Wertet einen Vorschauschalter aus: true, „1“ oder „true“ (Groß-/Kleinschreibung egal). */
export function parseVorschauFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

/** Ist der Build ein Vorschau-Build (HAUSHALT_VORSCHAU)? */
export function isVorschauAktiv(): boolean {
  return parseVorschauFlag(readVorschauFlag());
}

function registerOf(options?: PeriodenOptionen): PeriodenRegister {
  return options?.register ?? loadPeriodenRegister();
}

function vorschauOf(options?: PeriodenOptionen): boolean {
  return options?.vorschau ?? isVorschauAktiv();
}

function stichtagOf(options?: PeriodenOptionen): string {
  return options?.stichtag ?? getRedaktionellerStichtag();
}

/** Öffentlich ⇔ freigabe.oeffentlich === true und Status nicht „arbeitsentwurf“. */
export function isPeriodePublic(periode: Haushaltsperiode): boolean {
  return periode.freigabe.oeffentlich === true && periode.status !== 'arbeitsentwurf';
}

/** Sichtbar im aktuellen Build: öffentlich oder (im Vorschau-Build) jede Periode des Registers. */
export function isPeriodeVisible(periode: Haushaltsperiode, options?: PeriodenOptionen): boolean {
  return isPeriodePublic(periode) || vorschauOf(options);
}

/**
 * Nur in der Vorschau sichtbar (nicht freigegeben): Seiten tragen dann `noindex` und den
 * Vorschauhinweis, Inventareinträge stehen nicht in Sitemap und Übersicht.
 */
export function isPreviewOnly(periode: Haushaltsperiode): boolean {
  return !isPeriodePublic(periode);
}

/** Erstes Jahr absteigend: die neueste Periode zuerst. */
function neuesteZuerst(left: Haushaltsperiode, right: Haushaltsperiode): number {
  return right.jahre[0] - left.jahre[0];
}

/** Alle Perioden des Registers (unabhängig von der Sichtbarkeit), neueste zuerst. */
export function getAllPeriods(options?: PeriodenOptionen): Haushaltsperiode[] {
  return [...registerOf(options).perioden].sort(neuesteZuerst);
}

/** Im aktuellen Build sichtbare Perioden, neueste zuerst. */
export function getVisiblePeriods(options?: PeriodenOptionen): Haushaltsperiode[] {
  return getAllPeriods(options).filter((periode) => isPeriodeVisible(periode, options));
}

/**
 * Sichtbare Perioden mit Snapshotdaten unter data/haushalt/<id>/ (Quelle der Seiten unter
 * /haushalt/<id>/…). `hatSnapshot` ist für Tests austauschbar.
 */
export function getVisibleSnapshotPeriods(
  options?: PeriodenOptionen & { hatSnapshot?: (id: string) => boolean },
): Haushaltsperiode[] {
  const check = options?.hatSnapshot ?? hasSnapshot;
  return getVisiblePeriods(options).filter((periode) => periode.datenquelle === 'snapshot' && check(periode.id));
}

/** Periode nach Kennung, unabhängig von der Sichtbarkeit (Sichtbarkeit separat prüfen). */
export function getPeriode(id: string, options?: PeriodenOptionen): Haushaltsperiode | undefined {
  return registerOf(options).perioden.find((periode) => periode.id === id);
}

/** Sichtbare Periode nach Kennung oder undefined. */
export function getVisiblePeriode(id: string, options?: PeriodenOptionen): Haushaltsperiode | undefined {
  const periode = getPeriode(id, options);
  return periode && isPeriodeVisible(periode, options) ? periode : undefined;
}

function stichtagJahr(stichtag: string): number {
  if (!DATUM_MUSTER.test(stichtag)) throw new Error(`Ungültiger Stichtag „${stichtag}“.`);
  return Number(stichtag.slice(0, 4));
}

/** Liegt der Stichtag in einem Haushaltsjahr der Periode? */
export function isStichtagInPeriode(periode: Haushaltsperiode, stichtag: string): boolean {
  return periode.jahre.includes(stichtagJahr(stichtag));
}

function periodenImStichtag(options: PeriodenOptionen | undefined, status: readonly HaushaltsStatus[]): Haushaltsperiode[] {
  const stichtag = stichtagOf(options);
  return registerOf(options).perioden.filter(
    (periode) => isPeriodePublic(periode) && status.includes(periode.status) && isStichtagInPeriode(periode, stichtag),
  );
}

/**
 * Geltende Periode: öffentlich, Haushaltsgesetz verkündet („verkuendet“) und der redaktionelle
 * Stichtag liegt in einem ihrer Haushaltsjahre. Ein nur beschlossener, noch nicht verkündeter
 * Haushalt gilt nicht (siehe getMassgeblichePeriode). Ohne Treffer undefined.
 */
export function getGeltendePeriode(options?: PeriodenOptionen): Haushaltsperiode | undefined {
  return periodenImStichtag(options, ['verkuendet'])[0];
}

/**
 * Maßgebliche Periode für das laufende Haushaltsjahr: die geltende Periode oder, solange die
 * Verkündung aussteht, eine von der Volkskammer beschlossene Periode, deren Jahre den Stichtag
 * umfassen. Seiten bezeichnen eine nur beschlossene Periode nie als „geltend“.
 */
export function getMassgeblichePeriode(options?: PeriodenOptionen): Haushaltsperiode | undefined {
  return getGeltendePeriode(options) ?? periodenImStichtag(options, ['beschlossen'])[0];
}

function nachtragInfo(nachtrag: Nachtrag): NonNullable<PeriodenStatusInfo['nachtrag']> {
  const label = `${nachtrag.nummer}. Nachtragshaushalt`;
  const texte: Record<HaushaltsStatus, string> = {
    arbeitsentwurf: 'Der Nachtragshaushalt befindet sich in Vorbereitung.',
    regierungsentwurf: 'Der Entwurf eines Nachtragshaushalts liegt vor; die Volkskammer hat ihn noch nicht beschlossen.',
    'parlamentarische-beratung': 'Der Entwurf des Nachtragshaushalts wird in der Volkskammer beraten.',
    beschlossen: 'Die Volkskammer hat den Nachtragshaushalt beschlossen; die Verkündung steht noch aus.',
    verkuendet: 'Der Nachtragshaushalt ist verkündet.',
    historisch: 'Der Nachtragshaushalt betrifft abgeschlossene Haushaltsjahre.',
  };
  const toene: Record<HaushaltsStatus, HaushaltsStatusTon> = {
    arbeitsentwurf: 'vorschau',
    regierungsentwurf: 'entwurf',
    'parlamentarische-beratung': 'beratung',
    beschlossen: 'beschlossen',
    verkuendet: 'geltend',
    historisch: 'historisch',
  };
  return { nummer: nachtrag.nummer, label, text: texte[nachtrag.status], tone: toene[nachtrag.status] };
}

/**
 * Nachtrag der Periode mit dieser Bezeichnung (z. B. „Doppelhaushalt 2025/2026“) für den
 * Periodenkopf aller Haushaltsseiten, oder undefined.
 */
export function getNachtragZurBezeichnung(
  bezeichnung: string,
  perioden: readonly Haushaltsperiode[] = getAllPeriods(),
  options?: Pick<PeriodenOptionen, 'stichtag'>,
): PeriodenStatusInfo['nachtrag'] {
  const periode = perioden.find((entry) => entry.bezeichnung === bezeichnung);
  return periode ? getPeriodeStatusInfo(periode, options).nachtrag : undefined;
}

/**
 * Öffentliche Statusangabe einer Periode für Statusabzeichen und Periodenkopf. Ein Entwurf wird
 * nie als geltendes Haushaltsgesetz bezeichnet: „Geltender Haushalt“ steht nur bei einem
 * verkündeten Haushalt, dessen Haushaltsjahre den redaktionellen Stichtag umfassen.
 */
export function getPeriodeStatusInfo(periode: Haushaltsperiode, options?: Pick<PeriodenOptionen, 'stichtag'>): PeriodenStatusInfo {
  const stichtag = stichtagOf(options);
  const jahr = stichtagJahr(stichtag);
  const [erstesJahr, letztesJahr] = [periode.jahre[0], periode.jahre[periode.jahre.length - 1]];
  const abgelaufen = jahr > letztesJahr;
  let info: PeriodenStatusInfo;
  switch (periode.status) {
    case 'arbeitsentwurf':
      info = {
        label: 'Arbeitsentwurf',
        tone: 'vorschau',
        text: 'Interner Arbeitsstand der Haushaltsaufstellung; nicht zur Veröffentlichung bestimmt.',
      };
      break;
    case 'regierungsentwurf':
      // Keine Tatsachenbehauptung über einen Beschluss des Staatsrats: Das Register belegt nur die
      // Veröffentlichung des Entwurfs, nicht dessen Beschlussfassung.
      info = {
        label: 'Regierungsentwurf',
        tone: 'entwurf',
        text: 'Entwurf der Haushaltsaufstellung; die Volkskammer hat den Haushalt noch nicht beschlossen.',
      };
      break;
    case 'parlamentarische-beratung':
      info = {
        label: 'In parlamentarischer Beratung',
        tone: 'beratung',
        text: 'Der Entwurf des Staatsrates wird in der Volkskammer beraten; die Ansätze können sich noch ändern.',
      };
      break;
    case 'beschlossen':
      info = abgelaufen
        ? {
            label: 'Abgeschlossener Haushalt',
            tone: 'historisch',
            text: 'Die Haushaltsjahre sind abgelaufen; die Angaben geben den damals beschlossenen Haushaltsplan wieder.',
          }
        : {
            label: 'Von der Volkskammer beschlossen',
            tone: 'beschlossen',
            text: 'Die Volkskammer hat den Haushalt beschlossen; die Verkündung des Haushaltsgesetzes steht noch aus.',
          };
      break;
    case 'verkuendet':
      if (abgelaufen) {
        info = {
          label: 'Abgeschlossener Haushalt',
          tone: 'historisch',
          text: 'Die Haushaltsjahre sind abgelaufen; die Angaben geben den damals geltenden Haushaltsplan wieder.',
        };
      } else if (jahr < erstesJahr) {
        info = {
          label: 'Verkündeter Haushalt',
          tone: 'beschlossen',
          text: `Das Haushaltsgesetz ist verkündet; der Haushalt gilt ab dem 1. Januar ${erstesJahr}.`,
        };
      } else {
        info = {
          label: 'Geltender Haushalt',
          tone: 'geltend',
          text: 'Das Haushaltsgesetz ist verkündet; der Haushaltsplan ist Grundlage der laufenden Haushaltsführung.',
        };
      }
      break;
    case 'historisch':
      info = {
        label: 'Abgeschlossener Haushalt',
        tone: 'historisch',
        text: 'Die Haushaltsjahre sind abgelaufen; die Angaben geben den damals geltenden Haushaltsplan wieder.',
      };
      break;
    default:
      throw new Error(`Unbekannter Haushaltsstatus „${String((periode as { status: unknown }).status)}“.`);
  }
  return periode.nachtrag ? { ...info, nachtrag: nachtragInfo(periode.nachtrag) } : info;
}

/** „2027/2028“ für die Jahre einer Periode. */
export function formatPeriodenjahre(periode: Pick<Haushaltsperiode, 'jahre'>): string {
  return periode.jahre.join('/');
}
