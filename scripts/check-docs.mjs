#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Strukturelle Dokumentationshygiene (ohne Abhängigkeiten, läuft auch im docs-only-Job):
 *
 *   1. Die kanonischen Dokumente existieren (README, AGENTS, CONTENT, CONTENT_GAPS, DESIGN, TODO,
 *      Runbooks unter docs/, Wissenshub-Einstieg).
 *   2. Relative Links in Root-, docs/- und knowledge/-Markdown zeigen auf vorhandene Dateien –
 *      keine toten Verweise auf gelöschte Handoffs oder verschobene Runbooks.
 *   3. TODO.md enthält nur offene Aufgaben: keine abgehakten `[x]`-Einträge.
 *   4. Keine Verweise auf bewusst entfernte Dokumentklassen (alte Agenten-Handoffs).
 *
 * Aufruf: node scripts/check-docs.mjs [--root <Verzeichnis>]
 * Generierte Dateien (knowledge/generated/) prüft weiterhin `npm run knowledge:check`.
 */

export const CANONICAL_DOCUMENTS = [
  'README.md',
  'AGENTS.md',
  'CONTENT.md',
  'CONTENT_GAPS.md',
  'DESIGN.md',
  'TODO.md',
  'docs/DEPLOYMENT_RUNBOOK.md',
  'docs/NORM_WORKFLOW.md',
  'docs/REVOSAX_BULK_IMPORT.md',
  'docs/KREISREFORM_KARTE.md',
  'docs/ZUARBEITSFORMULAR.md',
  'knowledge/README.md',
  'knowledge/SOURCE_POLICY.md',
  'knowledge/AUDIT.md',
];

/** Dokumentklassen, die bewusst nicht mehr existieren; ein Verweis darauf ist ein Fehler. */
export const RETIRED_DOCUMENT_PATTERNS = [/REVOSAX_LOCAL_AI_HANDOFF\.md/u, /\bHANDOFF\.md\b/u];

const LINK_PATTERN = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function markdownFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(entry.name);
  }
  for (const directory of ['docs', 'knowledge']) {
    if (!(await exists(join(root, directory)))) continue;
    for (const entry of await readdir(join(root, directory), { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      files.push(relative(root, join(entry.parentPath ?? entry.path, entry.name)));
    }
  }
  return files.sort();
}

export function extractRelativeLinks(markdown) {
  const links = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*```/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(LINK_PATTERN)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|#|tel:)/iu.test(target)) continue;
      links.push(target);
    }
  }
  return links;
}

export async function checkDocs(root = process.cwd()) {
  const problems = [];
  for (const document of CANONICAL_DOCUMENTS) {
    if (!(await exists(join(root, document)))) problems.push(`kanonisches Dokument fehlt: ${document}`);
  }
  for (const file of await markdownFiles(root)) {
    const markdown = await readFile(join(root, file), 'utf8');
    for (const pattern of RETIRED_DOCUMENT_PATTERNS) {
      if (pattern.test(markdown)) problems.push(`${file}: Verweis auf entferntes Dokument (${pattern.source})`);
    }
    for (const link of extractRelativeLinks(markdown)) {
      const [pathPart] = link.split('#');
      if (!pathPart) continue;
      const target = resolve(root, dirname(file), decodeURIComponent(pathPart));
      if (!(await exists(target))) problems.push(`${file}: toter Link ${link}`);
    }
    if (file === 'TODO.md') {
      const done = markdown.split('\n').filter((line) => /^\s*[-*]\s+\[[xX]\]/u.test(line));
      if (done.length > 0) problems.push(`TODO.md enthält ${done.length} abgehakte Einträge; erledigte Aufgaben werden entfernt, nicht archiviert`);
    }
  }
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root = resolve(rootIndex >= 0 ? args[rootIndex + 1] : process.cwd());
  const problems = await checkDocs(root);
  if (problems.length > 0) {
    console.error(`Dokumentationsprüfung fehlgeschlagen:\n- ${problems.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('Dokumentationsprüfung erfolgreich: kanonische Dokumente vorhanden, keine toten Links, TODO.md ohne erledigte Einträge.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
