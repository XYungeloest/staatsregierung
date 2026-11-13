import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const [,, root, slug, date] = process.argv;
const { parseRevosaxSnapshot } = await import(join(root, 'scripts/lib/revosax-parser.mjs'));
const { applyPatchRecipe, sha256 } = await import(join(root, 'scripts/lib/consolidation-engine.mjs'));
const config = JSON.parse(await readFile(join(root, 'data/recht/consolidation-sources.json'), 'utf8'));
const source = config.targets[slug];
const parsed = parseRevosaxSnapshot(await readFile(resolve(root, source.snapshot), 'utf8'), { url: source.baselineUrl });
const recipes = [];
for (const dir of await readdir(join(root, 'data/recht/amendments'))) { try { recipes.push(JSON.parse(await readFile(join(root, 'data/recht/amendments', dir, `${slug}.json`), 'utf8'))); } catch {} }
recipes.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || (a.sameDayOrder ?? 0) - (b.sameDayOrder ?? 0));
let base = { title: parsed.sourceTitle, body: parsed.body };
for (const r of recipes.filter((r) => r.effectiveDate < date)) base = applyPatchRecipe(base, r);
const same = recipes.filter((r) => r.effectiveDate === date);
const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
for (const p of perms(same)) {
  let s = base; let err = null;
  try { for (const r of p) s = applyPatchRecipe(s, r); } catch (e) { err = e.message; }
  console.log(p.map((r) => r.amendmentAct.replace(/^gesetz-/, '')).join(' → '), err ? 'FEHLER ' + err : sha256(s.body));
}
