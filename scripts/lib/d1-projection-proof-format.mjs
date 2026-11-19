import { readFile } from 'node:fs/promises';

/**
 * Format und Bindungsprüfung des Äquivalenznachweises (scripts/lib/d1-projection-proof.mjs
 * erzeugt ihn, scripts/sync-recht-d1.mjs prüft ihn). Bewusst ohne Projektions- oder
 * Datenbankcode, damit der Sync nur dieses reine Modul importiert und der Code-Abschluss der
 * Projektion (scripts/lib/d1-projection-closure.mjs) frei von Werkzeugcode und dynamischen
 * Importen bleibt.
 *
 * Ein Nachweis gilt nur für genau den geprüften Stand: Schema und Comparator-Version, Scope
 * `full`, Basis- und Ziel-Commit des Laufs (die aufgelösten `--git-diff`-Refs des Syncs), die
 * Zielidentität des Arbeitsbaums, die gespeicherte Identität von D1 als Basis, ein anwendbares
 * Ergebnis und die Signatur des nachgewiesenen Umfangs. Fehlt eine Bindung, ist der Nachweis
 * nicht anwendbar – es gibt keinen Weg, ihn zu setzen, ohne beide Projektionen verglichen zu haben.
 */

export const PROOF_SCHEMA = 'd1-projection-proof/1';
/**
 * Version des Tabellenvergleichs (scripts/lib/d1-projection-compare.mjs); jede Änderung entwertet
 * alte Nachweise. 3: der Vergleich nennt je normbezogener Tabelle alle abweichenden Normen
 * (`normIds`), aus denen der Nachweis die durch die Logik abweichenden Normen bestimmt.
 */
export const COMPARATOR_VERSION = 3;
/**
 * Obergrenze der Normen, die ein Nachweis zusätzlich vollständig neu schreiben lässt, weil die
 * Logikänderung nur sie verändert (`logicAffectedSlugs`, Versuch nach `narrow`). Darüber bleibt
 * der Nachweis `full`: eine so breite Abweichung ist keine eng begrenzte Logikwirkung mehr.
 */
export const MAX_LOGIC_AFFECTED_NORMS = 250;
export const PROOF_RESULTS = ['identity', 'incremental', 'full'];
export const FULL_SCOPE = 'full';

export async function readProof(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u;

/**
 * `commits`: die aufgelösten Commits des Laufs (`--git-diff <base> <head>`); ohne sie ist der
 * Nachweis nicht anwendbar.
 * @param {{ storedFingerprint: string | null, headIdentity: { fingerprint: string } | null, commits: { base: string, head: string } | null, scope?: string }} options
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function validateProof(proof, { storedFingerprint, headIdentity, commits, scope = FULL_SCOPE }) {
  const problems = [];
  if (!proof || typeof proof !== 'object') return { ok: false, problems: ['Nachweis fehlt oder ist keine JSON-Datei'] };
  if (!commits || !COMMIT.test(String(commits.base)) || !COMMIT.test(String(commits.head))) problems.push('Basis- und Ziel-Commit des Laufs fehlen (fail-closed)');
  else {
    if (proof.base?.commit !== commits.base) problems.push(`Basis-Commit des Nachweises ${String(proof.base?.commit).slice(0, 9)} ≠ Lauf ${commits.base.slice(0, 9)}`);
    if (proof.head?.commit !== commits.head) problems.push(`Ziel-Commit des Nachweises ${String(proof.head?.commit).slice(0, 9)} ≠ Lauf ${commits.head.slice(0, 9)}`);
  }
  if (proof.$schema !== PROOF_SCHEMA) problems.push(`Nachweisschema ${String(proof.$schema)} ≠ ${PROOF_SCHEMA}`);
  if (proof.comparator !== COMPARATOR_VERSION) problems.push(`Comparator-Version ${String(proof.comparator)} ≠ ${COMPARATOR_VERSION}`);
  if (!PROOF_RESULTS.includes(proof.result)) problems.push(`unbekanntes Ergebnis ${String(proof.result)}`);
  if (proof.result === 'full') problems.push('der Nachweis verlangt eine Vollprojektion; er ersetzt sie nicht');
  if (proof.head?.scope !== scope || proof.base?.scope !== scope) problems.push(`Nachweis-Scope ${String(proof.head?.scope)}/${String(proof.base?.scope)} ≠ ${scope}`);
  if (!headIdentity || proof.head?.fingerprint !== headIdentity.fingerprint) problems.push(`Zielidentität des Nachweises ${String(proof.head?.fingerprint).slice(0, 16)}… ≠ Arbeitsbaum ${String(headIdentity?.fingerprint).slice(0, 16)}…`);
  if (!storedFingerprint || storedFingerprint !== proof.base?.fingerprint) problems.push(`gespeicherte Identität ${String(storedFingerprint).slice(0, 16)}… ist nicht die Basis des Nachweises ${String(proof.base?.fingerprint).slice(0, 16)}…`);
  if (proof.result !== 'full' && (typeof proof.scopeSignature !== 'string' || !proof.logicChange)) problems.push('Nachweis nennt keinen nachgewiesenen Umfang');
  problems.push(...logicAffectedProblems(proof));
  return { ok: problems.length === 0, problems };
}

/**
 * Form der zusätzlich neu zu schreibenden Normen: fehlt das Feld (oder ist es `null`), gibt es
 * keine. Sonst nur am Ergebnis `incremental` der engen Logikprojektion, als nicht leere, streng
 * sortierte Liste eindeutiger Slugs bis zur Obergrenze – jede andere Schreibweise derselben Menge
 * wäre eine nicht kanonische, also nicht vom Nachweis erzeugte Liste. Die Bindung an den Umfang
 * leistet die Umfangssignatur (der Sync rechnet sie mit genau dieser Liste nach).
 */
function logicAffectedProblems(proof) {
  const slugs = proof.logicAffectedSlugs;
  if (slugs === undefined || slugs === null) return [];
  if (!Array.isArray(slugs) || slugs.length === 0 || !slugs.every((slug) => typeof slug === 'string' && slug.length > 0)) return ['logicAffectedSlugs ist keine nicht leere Slug-Liste'];
  const problems = [];
  if (slugs.some((slug, index) => index > 0 && !(slugs[index - 1] < slug))) problems.push('logicAffectedSlugs ist nicht streng sortiert und eindeutig');
  if (slugs.length > MAX_LOGIC_AFFECTED_NORMS) problems.push(`logicAffectedSlugs nennt ${slugs.length} Normen > Obergrenze ${MAX_LOGIC_AFFECTED_NORMS}`);
  if (proof.result !== 'incremental' || proof.logicChange !== 'narrow') problems.push(`logicAffectedSlugs gibt es nur am Ergebnis incremental der engen Logikprojektion (hier ${String(proof.result)}/${String(proof.logicChange)})`);
  return problems;
}

export function describeProofResult(proof) {
  if (proof.result === 'identity') return 'Projektion identisch – nur Identität und Laufzeitmetadaten fortschreiben';
  if (proof.result === 'incremental') return `inkrementeller Umfang genügt (${proof.logicChange === 'narrow' ? 'enge Logikprojektion' : 'Logikänderung datenneutral'}: ${proof.plan.slugs.length} Norm(en), ${proof.plan.publicationSlugs.length} Verkündung(en)${proof.plan.derivedRebuild ? ', abgeleitete Daten aller Normen' : ''}${proof.plan.refreshSearchDocuments ? ', Suchdokumente aller Normen' : ''}${proof.logicAffectedSlugs?.length ? `, davon ${proof.logicAffectedSlugs.length} durch die Logik abweichende Norm(en) vollständig: ${proof.logicAffectedSlugs.join(', ')}` : ''})`;
  return `Vollprojektion erforderlich (abweichende Tabellen: ${(proof.comparison?.differingTables ?? []).join(', ') || 'unbekannt'})`;
}
