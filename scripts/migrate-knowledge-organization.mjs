import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const write = process.argv.includes('--write');
const root = resolve(process.cwd());

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

async function save(path, value) {
  if (write) await writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const sourcesDocument = await readJson('knowledge/sources.json');
const sourceById = new Map(sourcesDocument.sources.map((source) => [source.id, source]));
const organizationSources = [
  {
    id: 'source-organization-governments',
    type: 'structured-content',
    path: 'content/organisation/governments.json',
    title: 'Regierungen und Kabinette',
    date: '2026-07-31',
    status: 'primary',
    scope: ['government', 'parliament', 'coalitions'],
    notes: 'Kanonische zeitliche Definition der Regierungen und Kabinette.',
  },
  {
    id: 'source-organization-offices',
    type: 'structured-content',
    path: 'content/organisation/offices.json',
    title: 'Ämter und Funktionen',
    date: '2026-07-31',
    status: 'primary',
    scope: ['government', 'institutions'],
    notes: 'Kanonische Definition von Ämtern, Funktionen und Exklusivität.',
  },
  {
    id: 'source-organization-assignments',
    type: 'structured-content',
    path: 'content/organisation/assignments.json',
    title: 'Zeitliche Amts- und Ressortzuweisungen',
    date: '2026-07-31',
    status: 'primary',
    scope: ['government', 'persons', 'institutions'],
    notes: 'Kanonische Quelle für aktuelle und historische Besetzungen sowie Ressortleitungen.',
  },
];

for (const source of organizationSources) {
  const existing = sourceById.get(source.id);
  if (existing) Object.assign(existing, source);
  else sourcesDocument.sources.push(source);
}

Object.assign(sourceById.get('source-site-config'), {
  scope: ['website'],
  notes: 'Technische Portalkonfiguration; keine Quelle für Regierungsbesetzungen.',
});
Object.assign(sourceById.get('source-government-timeline'), {
  path: 'content/dashboard/timeline.json',
  notes: 'Redaktionell gepflegte Ereignisauswahl, nicht für unbelegte Abstimmungsdetails maßgeblich.',
});
Object.assign(sourceById.get('source-action-plan'), {
  path: 'content/dashboard/action-plan.json',
});

const personsDocument = await readJson('knowledge/entities/persons.json');
for (const person of personsDocument.persons) {
  for (const role of person.roles ?? []) {
    for (const key of ['appointmentSource', 'terminationSource']) {
      const reference = role[key];
      if (reference?.locator && /(?:currentOffices|formerOffices)/u.test(reference.locator)) {
        reference.sourceId = 'source-organization-assignments';
        reference.locator = `personSlug=${person.id.replace(/^person-/u, '')}; officeTitle=${role.officeTitle}; validFrom=${role.validFrom}`;
      }
    }
  }
}

const institutionsDocument = await readJson('knowledge/entities/institutions.json');
for (const institution of institutionsDocument.institutions) {
  for (const reference of institution.sourceRefs ?? []) {
    if (reference.locator && /(?:currentOffices|formerOffices)/u.test(reference.locator)) {
      reference.sourceId = 'source-organization-assignments';
      reference.locator = `institutionId=${institution.id}`;
    }
  }
}

const currentStateDocument = await readJson('knowledge/current-state.json');
for (const section of currentStateDocument.sections) {
  if (section.id === 'state-current-identity') {
    section.sourceRefs = section.sourceRefs.map((reference) =>
      reference.sourceId === 'source-site-config'
        ? { sourceId: 'source-organization-governments', locator: 'governments[id=erster-staatsrat].seatOfGovernment', role: 'corroborating' }
        : reference,
    );
  }
  if (section.id === 'state-current-government') {
    section.sourceRefs = [
      { sourceId: 'source-organization-governments', locator: 'governments[id=erster-staatsrat]', role: 'primary' },
      { sourceId: 'source-organization-assignments', locator: 'assignments[governmentSlug=erster-staatsrat]', role: 'primary' },
    ];
  }
  if (section.id === 'state-current-parliament') {
    section.sourceRefs = section.sourceRefs.map((reference) =>
      reference.sourceId === 'source-site-config'
        ? { sourceId: 'source-organization-governments', locator: 'governments[id=erster-staatsrat].legislature und Sitzzahlen', role: 'primary' }
        : reference,
    );
  }
}

function migrateLegacyOrganizationReferences(value) {
  if (Array.isArray(value)) {
    value.forEach(migrateLegacyOrganizationReferences);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.sourceId === 'string' && typeof value.locator === 'string') {
    if (value.sourceId === 'source-site-config' && value.locator.includes('currentGovernment')) {
      value.sourceId = 'source-organization-governments';
      value.locator = value.locator.replaceAll('currentGovernment', 'governments[id=erster-staatsrat]');
    }
    if (value.sourceId !== 'source-organization-assignments' && /(?:currentOffices|formerOffices)/u.test(value.locator)) {
      value.sourceId = 'source-organization-assignments';
      value.locator = 'assignments (zeitlich passende Zuordnung)';
    } else if (value.sourceId === 'source-organization-assignments' && /migriert aus (?:currentOffices|formerOffices)/u.test(value.locator)) {
      value.locator = 'assignments (zeitlich passende Zuordnung)';
    }
  }
  Object.values(value).forEach(migrateLegacyOrganizationReferences);
}

const additionalKnowledgePaths = [
  'knowledge/entities/parties.json',
  'knowledge/entities/territories.json',
  'knowledge/timeline.json',
  'knowledge/projects.json',
  'knowledge/proceedings.json',
  'knowledge/open-questions.json',
];
const additionalKnowledgeDocuments = await Promise.all(additionalKnowledgePaths.map(readJson));
for (const document of [personsDocument, institutionsDocument, currentStateDocument, ...additionalKnowledgeDocuments]) {
  migrateLegacyOrganizationReferences(document);
}

await Promise.all([
  save('knowledge/sources.json', sourcesDocument),
  save('knowledge/entities/persons.json', personsDocument),
  save('knowledge/entities/institutions.json', institutionsDocument),
  save('knowledge/current-state.json', currentStateDocument),
  ...additionalKnowledgePaths.map((path, index) => save(path, additionalKnowledgeDocuments[index])),
]);

console.log(write
  ? 'Knowledge-Referenzen wurden auf das Organisationsmodell migriert.'
  : 'Prüflauf: Knowledge-Referenzen können deterministisch auf das Organisationsmodell migriert werden.');
