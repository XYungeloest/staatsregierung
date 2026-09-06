import { readFile } from 'node:fs/promises';

/**
 * Format und Bindungsprüfung des Äquivalenznachweises (scripts/lib/d1-projection-proof.mjs
 * erzeugt ihn, scripts/sync-recht-d1.mjs prüft ihn). Bewusst ohne Projektions- oder
 * Datenbankcode, damit der Sync nur dieses reine Modul importiert und der Code-Abschluss der
 * Projektion (scripts/lib/d1-projection-closure.mjs) frei von Werkzeugcode und dynamischen
 * Importen bleibt.
 *
 * Ein Nachweis gilt nur für genau den geprüften Stand: Schema und Comparator-Version, Scope
 * `full`, die Zielidentität des Arbeitsbaums, die gespeicherte Identität von D1 als Basis, ein
 * anwendbares Ergebnis und die Signatur des nachgewiesenen Umfangs. Fehlt eine Bindung, ist der Nachweis nicht anwendbar – es gibt keinen
 * Weg, ihn zu setzen, ohne beide Projektionen verglichen zu haben.
 */

export const PROOF_SCHEMA = 'd1-projection-proof/1';
/** Version des Tabellenvergleichs (scripts/lib/d1-projection-compare.mjs); jede Änderung entwertet alte Nachweise. */
export const COMPARATOR_VERSION = 2;
export const PROOF_RESULTS = ['identity', 'incremental', 'full'];
export const FULL_SCOPE = 'full';

export async function readProof(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/**
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function validateProof(proof, { storedFingerprint, headIdentity, scope = FULL_SCOPE }) {
  const problems = [];
  if (!proof || typeof proof !== 'object') return { ok: false, problems: ['Nachweis fehlt oder ist keine JSON-Datei'] };
  if (proof.$schema !== PROOF_SCHEMA) problems.push(`Nachweisschema ${String(proof.$schema)} ≠ ${PROOF_SCHEMA}`);
  if (proof.comparator !== COMPARATOR_VERSION) problems.push(`Comparator-Version ${String(proof.comparator)} ≠ ${COMPARATOR_VERSION}`);
  if (!PROOF_RESULTS.includes(proof.result)) problems.push(`unbekanntes Ergebnis ${String(proof.result)}`);
  if (proof.result === 'full') problems.push('der Nachweis verlangt eine Vollprojektion; er ersetzt sie nicht');
  if (proof.head?.scope !== scope || proof.base?.scope !== scope) problems.push(`Nachweis-Scope ${String(proof.head?.scope)}/${String(proof.base?.scope)} ≠ ${scope}`);
  if (!headIdentity || proof.head?.fingerprint !== headIdentity.fingerprint) problems.push(`Zielidentität des Nachweises ${String(proof.head?.fingerprint).slice(0, 16)}… ≠ Arbeitsbaum ${String(headIdentity?.fingerprint).slice(0, 16)}…`);
  if (!storedFingerprint || storedFingerprint !== proof.base?.fingerprint) problems.push(`gespeicherte Identität ${String(storedFingerprint).slice(0, 16)}… ist nicht die Basis des Nachweises ${String(proof.base?.fingerprint).slice(0, 16)}…`);
  if (proof.result !== 'full' && (typeof proof.scopeSignature !== 'string' || !proof.logicChange)) problems.push('Nachweis nennt keinen nachgewiesenen Umfang');
  return { ok: problems.length === 0, problems };
}

export function describeProofResult(proof) {
  if (proof.result === 'identity') return 'Projektion identisch – nur Identität und Laufzeitmetadaten fortschreiben';
  if (proof.result === 'incremental') return `inkrementeller Umfang genügt (${proof.logicChange === 'narrow' ? 'enge Logikprojektion' : 'Logikänderung datenneutral'}: ${proof.plan.slugs.length} Norm(en), ${proof.plan.publicationSlugs.length} Verkündung(en)${proof.plan.derivedRebuild ? ', abgeleitete Daten aller Normen' : ''}${proof.plan.refreshSearchDocuments ? ', Suchdokumente aller Normen' : ''})`;
  return `Vollprojektion erforderlich (abweichende Tabellen: ${(proof.comparison?.differingTables ?? []).join(', ') || 'unbekannt'})`;
}
