import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const write = process.argv.includes('--write');
const profileDirectory = join(root, 'content', 'regierung', 'mitglieder');
const ministryDirectory = join(root, 'content', 'ressorts');
const organizationFiles = ['governments.json', 'offices.json', 'assignments.json'];

const profileOrganizationFields = [
  'amt',
  'ressort',
  'reihenfolge',
  'current',
  'servingFrom',
  'servingTo',
  'currentOffices',
  'formerOffices',
  'appointmentSource',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function jsonFiles(directory) {
  return (await readdir(directory)).filter((entry) => entry.endsWith('.json')).sort();
}

async function migrateFile(path, fields) {
  const value = await readJson(path);
  const removed = fields.filter((field) => Object.hasOwn(value, field));
  if (removed.length === 0) return undefined;
  for (const field of removed) delete value[field];
  if (write) await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return { path: path.slice(root.length + 1), removed };
}

async function migrateMinistryFile(path) {
  const value = await readJson(path);
  const removed = [];
  if (Object.hasOwn(value, 'leitung')) {
    delete value.leitung;
    removed.push('leitung');
  }
  if (Array.isArray(value.verknuepfteLinks)) {
    const links = value.verknuepfteLinks.filter((link) => !/^\/staatsregierung\/mitglieder\//u.test(link?.href ?? ''));
    if (links.length !== value.verknuepfteLinks.length) {
      value.verknuepfteLinks = links;
      removed.push('manuell gepflegte Leitungsprofile');
    }
  }
  if (removed.length === 0) return undefined;
  if (write) await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return { path: path.slice(root.length + 1), removed };
}

for (const file of organizationFiles) {
  await readJson(join(root, 'content', 'organisation', file));
}

const changes = [];
for (const file of await jsonFiles(profileDirectory)) {
  const result = await migrateFile(join(profileDirectory, file), profileOrganizationFields);
  if (result) changes.push(result);
}
for (const file of await jsonFiles(ministryDirectory)) {
  const result = await migrateMinistryFile(join(ministryDirectory, file));
  if (result) changes.push(result);
}

if (changes.length === 0) {
  console.log('Redaktionelle v2-Migration: keine Legacy-Organisationsfelder gefunden.');
} else {
  for (const change of changes) console.log(`${write ? 'Migriert' : 'Würde migrieren'}: ${change.path} (${change.removed.join(', ')})`);
  if (!write) console.log('Schreiben nur mit --write.');
}
