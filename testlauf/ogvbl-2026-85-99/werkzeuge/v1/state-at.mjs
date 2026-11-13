// Ermittelt den Rezeptzustand (vor Rechtsüberleitung) eines REVOSax-Ziels nach allen vorhandenen Rezepten bis einschließlich Datum.
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const [,, root, slug, until, ...labels] = process.argv;
const { parseRevosaxSnapshot } = await import(join(root, 'scripts/lib/revosax-parser.mjs'));
const { applyPatchRecipe, sha256 } = await import(join(root, 'scripts/lib/consolidation-engine.mjs'));
const config = JSON.parse(await readFile(join(root, 'data/recht/consolidation-sources.json'), 'utf8'));
const source = config.targets[slug];
const html = await readFile(resolve(root, source.snapshot), 'utf8');
const parsed = parseRevosaxSnapshot(html, { url: source.baselineUrl });
let state = { title: parsed.sourceTitle, body: parsed.body };
const recipes = [];
for (const dir of await readdir(join(root, 'data/recht/amendments'))) {
  try { recipes.push(JSON.parse(await readFile(join(root, 'data/recht/amendments', dir, `${slug}.json`), 'utf8'))); } catch {}
}
recipes.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || (a.sameDayOrder ?? 0) - (b.sameDayOrder ?? 0));
for (const r of recipes) { if (r.effectiveDate <= until) { state = applyPatchRecipe(state, r); console.error('angewandt', r.amendmentAct, r.effectiveDate); } }
const walk = (nodes, parent, cb) => nodes.forEach((n) => { cb(n, parent); walk(n.children ?? [], n, cb); });
console.log('TITLE', state.title);
walk(state.body, null, (n, p) => {
  if (n.type === 'paragraph' && labels.includes(n.label)) {
    console.log('==', n.label, 'hash', sha256(n));
    for (const c of n.children ?? []) console.log('   ', c.type, c.label ?? '', 'hash', sha256(c), JSON.stringify(c.text ?? '').slice(0, 260));
  }
});
