import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const problems = [];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

async function readJson(path) {
  return JSON.parse(await readFile(join(root, path), 'utf8'));
}

const [coverage, projectsRoot, currentStateRoot, editorial, home] = await Promise.all([
  readJson('content/portal/topic-coverage.json'),
  readJson('knowledge/projects.json'),
  readJson('knowledge/current-state.json'),
  readJson('src/config/editorial.json'),
  readJson('content/portal/home.json'),
]);
const topicFiles = (await readdir(join(root, 'content', 'themen'))).filter((file) => file.endsWith('.json'));
const topics = await Promise.all(topicFiles.map(async (file) => readJson(`content/themen/${file}`)));
const topicBySlug = new Map(topics.map((topic) => [topic.slug, topic]));
const projectById = new Map(projectsRoot.projects.map((project) => [project.id, project]));
const currentStateById = new Map(currentStateRoot.sections.map((section) => [section.id, section]));

function validateCoverageEntries(entries, knownById, label) {
  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    const location = `${label}[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${location}: muss ein Objekt sein`);
      continue;
    }
    if (typeof entry.id !== 'string' || !knownById.has(entry.id)) {
      problems.push(`${location}.id: unbekannte Wissenshub-ID ${String(entry.id)}`);
      continue;
    }
    if (seen.has(entry.id)) problems.push(`${location}.id: doppelte Zuordnung ${entry.id}`);
    seen.add(entry.id);

    const topicSlugs = entry.topicSlugs ?? [];
    const publicPaths = entry.publicPaths ?? [];
    if (!Array.isArray(topicSlugs) || !Array.isArray(publicPaths)) {
      problems.push(`${location}: topicSlugs und publicPaths müssen Listen sein`);
      continue;
    }
    if (topicSlugs.length === 0 && publicPaths.length === 0 && entry.reviewedWithoutDedicatedSurface !== true) {
      problems.push(`${location}: benötigt eine öffentliche Oberfläche oder eine ausdrückliche redaktionelle Ausnahme`);
    }
    if (entry.reviewedWithoutDedicatedSurface === true && (typeof entry.reason !== 'string' || entry.reason.trim().length < 20)) {
      problems.push(`${location}.reason: redaktionelle Ausnahme muss nachvollziehbar begründet sein`);
    }
    for (const slug of topicSlugs) {
      if (!slugPattern.test(slug) || !topicBySlug.has(slug)) {
        problems.push(`${location}.topicSlugs: unbekanntes Thema ${slug}`);
      }
    }
    for (const path of publicPaths) {
      if (typeof path !== 'string' || !/^\/[a-z0-9/.-]*\/$/u.test(path)) {
        problems.push(`${location}.publicPaths: ungültiger interner Pfad ${String(path)}`);
      }
    }
  }
  for (const id of knownById.keys()) {
    if (!seen.has(id)) problems.push(`${label}: neue Wissenshub-ID ${id} wurde noch nicht redaktionell eingeordnet`);
  }
}

validateCoverageEntries(coverage.projectCoverage ?? [], projectById, 'projectCoverage');
validateCoverageEntries(coverage.currentStateCoverage ?? [], currentStateById, 'currentStateCoverage');

const projectCoverageById = new Map((coverage.projectCoverage ?? []).map((entry) => [entry.id, entry]));
for (const topic of topics) {
  if (typeof topic.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(topic.updatedAt)) {
    problems.push(`content/themen/${topic.slug}.json: updatedAt muss einen fachlichen Datumsstand enthalten`);
  } else if (topic.updatedAt > editorial.referenceDate) {
    problems.push(`content/themen/${topic.slug}.json: updatedAt liegt nach dem redaktionellen Stichtag ${editorial.referenceDate}`);
  }
  for (const relatedSlug of topic.relatedTopicSlugs ?? []) {
    if (!topicBySlug.has(relatedSlug)) problems.push(`content/themen/${topic.slug}.json: unbekanntes verwandtes Thema ${relatedSlug}`);
    if (relatedSlug === topic.slug) problems.push(`content/themen/${topic.slug}.json: darf sich nicht selbst als verwandtes Thema führen`);
  }
  for (const projectId of topic.knowledgeProjectRefs ?? []) {
    const mapping = projectCoverageById.get(projectId);
    if (!projectById.has(projectId)) {
      problems.push(`content/themen/${topic.slug}.json: unbekannte Wissenshub-Projektreferenz ${projectId}`);
    } else if (!mapping?.topicSlugs?.includes(topic.slug)) {
      problems.push(`content/themen/${topic.slug}.json: ${projectId} ist im Coverage-Register nicht wechselseitig zugeordnet`);
    }
  }
}

for (const entry of coverage.projectCoverage ?? []) {
  for (const topicSlug of entry.topicSlugs ?? []) {
    const topic = topicBySlug.get(topicSlug);
    if (topic && !topic.knowledgeProjectRefs?.includes(entry.id)) {
      problems.push(`projectCoverage ${entry.id}: Themenseite ${topicSlug} führt die Wissenshub-Projektreferenz nicht zurück`);
    }
  }
  const project = projectById.get(entry.id);
  if (!project || !entry.topicSlugs?.length) continue;
  if (['in-force', 'in-implementation', 'partly-implemented'].includes(project.projectStage)) {
    for (const topicSlug of entry.topicSlugs) {
      const topic = topicBySlug.get(topicSlug);
      if (topic && ['geplant', 'entwurf'].includes(topic.status)) {
        problems.push(`projectCoverage ${entry.id}: bestätigter Projektstand ${project.projectStage} passt nicht zum Themenstatus ${topic.status} von ${topicSlug}`);
      }
    }
  }
}

if ('featuredTopicSlugs' in home) {
  problems.push('content/portal/home.json: featuredTopicSlugs ist eine parallele Themenpriorisierung; Hervorhebungen gehören in den Themendatensatz');
}
const activeHighlights = topics
  .filter((topic) => topic.highlightFrom && topic.highlightFrom <= editorial.referenceDate && (!topic.highlightUntil || topic.highlightUntil >= editorial.referenceDate))
  .sort((left, right) => right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt));
if (activeHighlights.length === 0) {
  problems.push(`Themendiscoverability: am Stichtag ${editorial.referenceDate} ist kein aktuelles Vorhaben hervorgehoben`);
}
if (activeHighlights[0]?.slug !== 'volksbefragung-2026') {
  problems.push('Themendiscoverability: Volksbefragung 2026 muss am Stichtag das höchst priorisierte aktuelle Vorhaben sein');
}

if (problems.length > 0) {
  console.error('Themen-Coverage fehlgeschlagen:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Themen-Coverage erfolgreich geprüft: ${topics.length} Themen, ${projectById.size} Projekte, ${currentStateById.size} Gegenwartsstände, ${activeHighlights.length} aktuelle Hervorhebungen.`);
}
