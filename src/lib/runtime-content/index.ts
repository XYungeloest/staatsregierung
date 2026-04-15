import { parseNormMeta } from '../norms/schema.ts';
import { toDisplayText } from '../norms/presentation.ts';
import { parseRede, parseThemenseite, type Rede } from '../portal/schema.ts';

interface RuntimeTopicSummary {
  slug: string;
  title: string;
  teaser: string;
}

interface RuntimeNormSummary {
  slug: string;
  title: string;
  summary: string;
}

function toContentPath(filePath: string): string {
  const marker = '/content/';
  const markerIndex = filePath.indexOf(marker);

  if (markerIndex >= 0) {
    return `content/${filePath.slice(markerIndex + marker.length)}`;
  }

  return filePath;
}

const topicModules = import.meta.glob('../../../content/themen/*.json', {
  eager: true,
  import: 'default',
});

const speechModules = import.meta.glob('../../../content/presse/reden/*.json', {
  eager: true,
  import: 'default',
});

const normMetaModules = import.meta.glob('../../../content/normen/*/meta.json', {
  eager: true,
  import: 'default',
});

const runtimeTopics = Object.entries(topicModules).map(([filePath, value]) =>
  parseThemenseite(value, toContentPath(filePath)),
);

const runtimeSpeeches = Object.entries(speechModules)
  .map(([filePath, value]) => parseRede(value, toContentPath(filePath)))
  .sort((left, right) => right.date.localeCompare(left.date));

const runtimeNormSummaries = Object.entries(normMetaModules).map(([filePath, value]) => {
  const meta = parseNormMeta(value, toContentPath(filePath));

  return {
    slug: meta.slug,
    title: toDisplayText(meta.title),
    summary: toDisplayText(meta.summary),
  } satisfies RuntimeNormSummary;
});

const runtimeTopicLookup = new Map(
  runtimeTopics.map((topic) => [
    topic.slug,
    {
      slug: topic.slug,
      title: topic.title,
      teaser: topic.teaser,
    } satisfies RuntimeTopicSummary,
  ]),
);

const runtimeNormLookup = new Map(runtimeNormSummaries.map((entry) => [entry.slug, entry]));

export function getRuntimeTopicLookup(): Map<string, RuntimeTopicSummary> {
  return runtimeTopicLookup;
}

export function getRuntimeNormLookup(): Map<string, RuntimeNormSummary> {
  return runtimeNormLookup;
}

export function loadRuntimeSpeeches(): Rede[] {
  return [...runtimeSpeeches];
}
