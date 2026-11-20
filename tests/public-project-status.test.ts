import assert from 'node:assert/strict';
import test from 'node:test';
import { publicLegalSources, projectPublicStatus } from '../apps/portal/src/lib/project-status.ts';
import type { LegislativeProcedure } from '@ostrecht/shared/lib/portal/legislation.ts';
import type { Themenseite } from '@ostrecht/shared/lib/portal/schema.ts';
import { buildFixturePublications, normOfType } from './helpers/fixture-corpus.ts';

test('Öffentlicher Projektstand verbindet nur redigierte Pfade und trennt Verfahren, Rechtswirksamkeit und Umsetzung', () => {
  const { meta } = normOfType('gesetz', { effectiveDate: '2031-05-01' });
  const issue = buildFixturePublications()[0];
  const first = { ...issue, slug: 'ausgabe-eins', date: '2031-03-01', entries: [{ ...issue.entries[0], normSlug: meta.slug }] };
  const latest = { ...first, slug: 'ausgabe-zwei', date: '2031-04-01' };
  const resolveSource = publicLegalSources([meta], [first, latest]);
  const reference = { label: 'Quelle', normSlug: meta.slug };
  const topic: Themenseite = {
    slug: 'vorhaben', title: 'Vorhaben', teaser: 'Bericht', status: 'beschlossen', cluster: 'staat-demokratie', priority: 1,
    featured: false, updatedAt: '2031-04-03', beschlossen: ['Beschluss'], umgesetzt: [], naechsteSchritte: ['Prüfung'],
    rechtsgrundlagen: [{ ...reference, publicationSlug: first.slug }], faq: [], federfuehrendesRessort: 'stelle', keyDates: [],
    modules: [], knowledgeProjectRefs: ['interne-kennung'],
  };
  const proceeding: LegislativeProcedure = { slug: 'lesung', title: 'Beratung', shortTitle: 'Beratung', initiator: 'Gremium',
    stage: 'beschlossen', documentNumber: '07/01', statusLabel: 'Beschlossen', confirmedAsOf: '2031-04-03', decidedOn: '2031-03-01',
    relatedTopics: [topic.slug], relatedMinistries: [], relatedNorms: [], sources: [] };
  const item = { id: 'punkt', title: topic.title, href: '/themen/vorhaben/', status: 'angelegt' as const,
    ressort: 'Stelle', description: 'Ziel', references: [reference] };
  const [withTopic, similar] = projectPublicStatus([item, { ...item, href: '/dienst/' }], [topic],
    [proceeding, { ...proceeding, slug: 'anders', relatedTopics: [] }], resolveSource);
  assert.equal(similar.topic, null);
  assert.equal(withTopic.status, item.status);
  assert.deepEqual(withTopic.references, item.references);
  assert.equal(withTopic.legalReferences[0].publication?.slug, latest.slug);
  assert.equal(withTopic.topic?.legalReferences[0].publication?.slug, first.slug);
  assert.equal(withTopic.topic?.legalReferences[0].norm?.effectiveDate, '2031-05-01');
  assert.deepEqual(withTopic.topic?.umgesetzt, []);
  assert.deepEqual(withTopic.topic?.naechsteSchritte, ['Prüfung']);
  assert.equal(withTopic.topic?.procedures.length, 1);
  assert.equal(withTopic.topic?.procedures[0].implementationOn, undefined);
  assert.equal(resolveSource({ ...reference, publicationSlug: 'fehlend' }).publication, undefined);
  assert.doesNotMatch(JSON.stringify(withTopic), /knowledgeProjectRefs|interne-kennung/u);
});
