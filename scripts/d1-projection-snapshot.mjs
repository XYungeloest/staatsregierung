#!/usr/bin/env node --experimental-strip-types

// Muss vor allen @ostrecht-Importen stehen (SITE_TARGET=law für die Routenhelfer).
import './lib/law-site-env.mjs';

import { resolve } from 'node:path';

import { compareProjections, formatComparison } from './lib/d1-projection-compare.mjs';
import { projectionClosure } from './lib/d1-projection-closure.mjs';
import { FULL_SCOPE, projectionIdentity, projectionLogicLines } from './lib/d1-projection-fingerprint.mjs';
import { DEFAULT_PROOF_DIR, describeProofResult, loadProjectionInputs, proveProjectionEquivalence } from './lib/d1-projection-proof.mjs';
import { checkSearchIndexIntegrity, executePlan, openDatabase } from './lib/d1-sqlite.mjs';
import * as sync from './sync-recht-d1.mjs';

/**
 * Lokale Werkzeuge für die D1-Projektion ohne Cloudflare-Zugriff.
 *
 *   project   Projektion mit den echten Migrationen (data/recht/d1/*.sql, FTS5, Trigger) in eine
 *             SQLite-Datei (node:sqlite): Vollprojektion (--out <Datei> --full) oder gezielter
 *             Git-Diff-Lauf in eine vorhandene Datei (--into <Datei> --git-diff <base> <head>).
 *   compare   Vollständiger semantischer Tabellenvergleich zweier Dateien
 *             (scripts/lib/d1-projection-compare.mjs; Exit 1 bei Abweichung).
 *   prove     Äquivalenznachweis Basis-Ref → Arbeitsbaum (scripts/lib/d1-projection-proof.mjs):
 *             --base <Ref> [--head <Ref>] [--out <Verzeichnis>] [--keep]; schreibt die
 *             Nachweisdatei, die der Sync mit --equivalence-proof prüft.
 *   closure   Dateien des transitiven Code-Abschlusses der Projektion (was Teil der
 *             Projektionsidentität ist) und die Zeilen des Logikhashes; [--ref <Ref>].
 *
 * `project` verwendet immer den Sync des aktuellen Arbeitsverzeichnisses (scripts/sync-recht-d1.mjs)
 * und dessen Rechtsbestand. Kein Befehl schreibt in eine Cloudflare-Datenbank.
 */

const ROOT = resolve(process.cwd());

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function project(args) {
  const out = valueAfter(args, '--out');
  const into = valueAfter(args, '--into');
  if (Boolean(out) === Boolean(into)) throw new Error('project braucht genau eines von --out <neue Datei> oder --into <vorhandene Datei>');
  const startedAt = Date.now();
  const { norms, publications, context } = await loadProjectionInputs(ROOT, { sync });
  console.log(`${norms.length} Normen und ${publications.length} Verkündungen geladen (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  const identity = await projectionIdentity({ root: ROOT, scope: FULL_SCOPE });
  console.log(`Projektionsidentität ${identity.fingerprint.slice(0, 16)}… (Logik ${identity.logic.slice(0, 12)}…, Bestand ${identity.corpus.slice(0, 12)}…, Portal ${identity.portal.slice(0, 12)}…)`);
  const scopeArgs = args.filter((value) => value !== 'project');
  const scope = await sync.resolveScope(scopeArgs, { norms, publications, logicPaths: identity.closureUncertain ? null : new Set(identity.logicFiles) });
  console.log(`Umfang: ${scope.mode}${scope.mode === 'incremental' ? ` – ${scope.slugs.length} Norm(en), ${scope.publicationSlugs.length} Verkündung(en)${scope.derivedRebuild ? ', abgeleitete Daten aller Normen' : ''}${scope.refreshSearchDocuments ? ', Suchdokumente aller Normen' : ''}` : ''}${scope.reasons?.length ? ` – ${scope.reasons.slice(0, 4).join('; ')}` : ''}`);
  const now = valueAfter(args, '--now') ?? '2026-01-01T00:00:00.000Z';
  const plan = sync.buildSyncPlan({ scope, norms, publications, context, now, fingerprint: identity, identity, writeIdentity: true });
  console.log(`Plan: ${plan.selected.length} Normen, ${plan.derivedCount} abgeleitete Datensätze, ${plan.documentRefreshCount ?? 0} Normen mit erneuerten Suchdokumenten, ${plan.publicationCount} Verkündungen, ${plan.statementCount} Anweisungen (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  const db = await openDatabase(out ?? into, { create: Boolean(out), root: ROOT });
  const executed = executePlan(db, plan);
  checkSearchIndexIntegrity(db);
  db.close();
  console.log(`${executed} Anweisungen nach ${out ?? into} geschrieben; FTS5-Integrität geprüft (${Math.round((Date.now() - startedAt) / 1000)} s).`);
}

async function compare(args) {
  const [left, right] = args.filter((value) => value !== 'compare' && !value.startsWith('--'));
  if (!left || !right) throw new Error('compare braucht zwei SQLite-Dateien');
  const comparison = await compareProjections(left, right, { root: ROOT });
  console.log(formatComparison(comparison));
  if (!comparison.identical) process.exitCode = 1;
}

async function prove(args) {
  const baseRef = valueAfter(args, '--base');
  if (!baseRef) throw new Error('prove braucht --base <Ref>');
  const { proof } = await proveProjectionEquivalence({
    root: ROOT,
    sync,
    baseRef,
    headRef: valueAfter(args, '--head') ?? 'HEAD',
    proofDir: valueAfter(args, '--out') ?? DEFAULT_PROOF_DIR,
    keepProjections: args.includes('--keep'),
  });
  console.log(`Ergebnis: ${describeProofResult(proof)}`);
  if (proof.result === 'full') process.exitCode = 1;
}

async function closure(args) {
  const ref = valueAfter(args, '--ref') ?? null;
  const resolved = await projectionClosure({ root: ROOT, ref });
  console.log(`Abschluss${ref ? ` von ${ref}` : ' des Arbeitsbaums'}: ${resolved.files.length} Datei(en)${resolved.uncertain ? ' – UNSICHER, der Fingerabdruck zählt die konservative Obermenge' : ''}`);
  for (const reason of resolved.reasons) console.log(`  ! ${reason}`);
  for (const file of resolved.files) console.log(`  ${file}`);
  if (resolved.externals.length > 0) console.log(`Externe Pakete: ${resolved.externals.join(', ')}`);
  if (args.includes('--lines')) {
    console.log('Zeilen des Logikhashes:');
    for (const line of (await projectionLogicLines(ROOT, { ref, closure: resolved })).sort()) console.log(`  ${line}`);
  }
}

const command = process.argv[2];
const args = process.argv.slice(2);
if (command === 'project') await project(args);
else if (command === 'compare') await compare(args);
else if (command === 'prove') await prove(args);
else if (command === 'closure') await closure(args);
else {
  console.error('Verwendung: d1-projection-snapshot.mjs project (--out <Datei> --full | --into <Datei> --git-diff <base> <head>) [--now <ISO>] | compare <a.sqlite> <b.sqlite> | prove --base <Ref> [--head <Ref>] [--out <Verzeichnis>] [--keep] | closure [--ref <Ref>] [--lines]');
  process.exit(2);
}
