import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { actionPlanItems } from '../src/data/dashboard/action-plan.ts';
import { timelineEntries } from '../src/data/dashboard/timeline.ts';

const write = process.argv.includes('--write');
const directory = resolve(process.cwd(), 'content', 'dashboard');
const targets = [
  { path: resolve(directory, 'action-plan.json'), value: { items: actionPlanItems } },
  { path: resolve(directory, 'timeline.json'), value: { entries: timelineEntries } },
];

await mkdir(directory, { recursive: true });
for (const target of targets) {
  const serialized = `${JSON.stringify(target.value, null, 2)}\n`;
  const current = await readFile(target.path, 'utf8').catch(() => undefined);
  if (current === serialized) {
    console.log(`Unverändert: ${target.path}`);
  } else if (write) {
    await writeFile(target.path, serialized, 'utf8');
    console.log(`Migriert: ${target.path}`);
  } else {
    console.log(`Würde migrieren: ${target.path}`);
  }
}
if (!write) console.log('Schreiben nur mit --write.');
