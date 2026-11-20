import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeImpact } from '../scripts/lib/content-impact.mjs';

const from = '2032-05-01';
const gazette = 'testausgabe';
const issue = { slug: gazette, date: '2032-04-01', title: 'Testausgabe', entries: [
  { id: 'a', normSlug: 'mantel', versionId: from, citation: 'Testausgabe S. 1' },
] };
function record(slug, entries = []) {
  return { meta: { slug, title: slug, status: 'active' }, history: { initialVersionId: from, entries }, versions: [] };
}
function fixture() {
  const act = record('mantel', [{ type: 'initial', date: issue.date, affectingVersionId: from }]);
  act.meta.enactedNorm = 'neufassung';
  const change = { relatedNorm: 'mantel', date: from, affectingVersionId: from, citation: 'Testausgabe Art. 2' };
  const norms = [act, record('neufassung'), record('ziel-a', [{ ...change, type: 'amendment' }]),
    record('ziel-b', [{ ...change, type: 'amendment' }]), record('altnorm', [{ ...change, type: 'repeal', affectingVersionId: null }])];
  const projects = [{ id: 'projekt', title: 'Verfahren', openQuestionIds: ['einweg-frage'], normRefs: [{ normSlug: 'ziel-a', versionId: from }] },
    { id: 'aehnlicher-titel', title: 'mantel', normRefs: [] }];
  return {
    norms, publications: [issue], topics: [{ slug: 'thema', rechtsgrundlagen: [{ normSlug: 'neufassung' }] }, { slug: 'projekt-thema', knowledgeProjectRefs: ['projekt'] }],
    coverage: { projectCoverage: [{ id: 'projekt', publicPaths: ['/themen/thema/'] }] },
    consolidation: { targets: [{ canonicalSlug: 'ziel-b', title: 'Ziel B', status: 'blocked-source-conflict', problems: ['Zielanker offen'],
      enactingActs: [], amendmentActs: [{ slug: 'mantel' }], correctionActs: [], nextAction: 'Quellen vergleichen.' }], ambiguousFindings: [] },
    knowledge: { editorial: { referenceDate: '2032-04-20' }, agenda: { majorProjects: [] },
      mandates: { mandates: [{ id: 'auftrag', normSlug: 'ziel-a', deadlineDate: '2032-06-01', status: 'offen' }] },
      sources: [{ id: 'quelle', path: 'content/verkuendungen/testausgabe.json', title: 'Druckausgabe' }],
      collections: [{ type: 'project', file: 'knowledge/projects.json', entries: projects },
        { type: 'proceeding', file: 'knowledge/proceedings.json', entries: [{ id: 'verfahren', relatedIds: ['projekt'] }] },
        { type: 'open-question', file: 'knowledge/open-questions.json', entries: [{ id: 'frage', affectedIds: ['projekt'], question: 'Welcher Anker?' }, { id: 'einweg-frage', question: 'Welche Quelle?' }] }] },
    readVersion: (_slug, id) => ({ versionId: id, validFrom: from, validTo: null, body: [{ text: 'Der Bericht ist bis zum 1. Juni vorzulegen.' }] }),
  };
}

test('Verkündung trennt Stammnorm, zwei Änderungen, Aufhebung und künftige Wirksamkeit', () => {
  const model = fixture();
  const result = analyzeImpact(model, { publication: gazette });
  assert.deepEqual(result, analyzeImpact(model, { publication: gazette }));
  const { findings } = result;
  assert.deepEqual(findings.filter((f) => f.relation === 'amends').map((f) => f.id).sort(), ['ziel-a', 'ziel-b']);
  assert.ok(findings.some((f) => f.relation === 'enacts' && f.id === 'neufassung' && f.confidence === 'direct'));
  assert.ok(findings.some((f) => f.relation === 'repeals' && f.id === 'altnorm' && f.versionId === null));
  assert.ok(findings.some((f) => f.relation === 'initial' && f.id === 'mantel'));
  assert.ok(findings.filter((f) => f.relation === 'version').every((f) => f.temporalKind === 'future'));
  assert.ok(findings.every((f) => f.evidence.length && f.evidence.every((e) => e.file && e.locator)));
  assert.ok(findings.some((f) => f.relation === 'mandate-or-deadline' && f.confidence === 'candidate' && f.evidence[0].locator === '/body/0/text'));
});

test('Projektbezüge folgen Kennungen und behalten strittige Konsolidierung und Vollzugsstatus bei', () => {
  const { findings } = analyzeImpact(fixture(), { publication: gazette });
  for (const [relation, id, confidence] of [
    ['project', 'projekt', 'derived'], ['open-question', 'einweg-frage', 'candidate'], ['public-topic', 'projekt-thema', 'derived'], ['proceeding', 'verfahren', 'derived'],
    ['public-topic', 'thema', 'derived'], ['public-page', '/themen/thema/', 'derived'],
    ['consolidation', 'ziel-b', 'candidate'], ['open-question', 'frage', 'candidate'],
    ['mandate', 'auftrag', 'derived'], ['source-reference', 'quelle', 'direct'],
  ]) assert.ok(findings.some((f) => f.id === id && f.relation === relation && f.confidence === confidence), relation);
  assert.equal(findings.some((f) => f.id === 'aehnlicher-titel'), false);
  assert.equal(findings.find((f) => f.id === 'auftrag').deadlineDate, '2032-06-01');
});

test('Fehlende Fassungen bleiben offen und eine Wiederveröffentlichung erbt keine früheren Rechtswirkungen', () => {
  const model = fixture();
  model.readVersion = () => null;
  const { findings } = analyzeImpact(model, { publication: gazette });
  assert.ok(findings.some((f) => f.relation === 'missing-version' && f.confidence === 'candidate'));
  assert.equal(findings.some((f) => f.relation === 'initial'), false);
  const later = fixture();
  later.publications = [{ ...issue, date: '2035-01-01' }];
  assert.equal(analyzeImpact(later, { publication: gazette }).findings.some((f) => f.relation === 'repeals'), false);
  assert.ok(analyzeImpact(fixture(), { norm: 'ziel-a' }).findings.some((f) => f.relation === 'amended-by' && f.id === 'mantel'));
  assert.throws(() => analyzeImpact(model, { norm: '../x' }), TypeError);
  assert.throws(() => analyzeImpact(model, { norm: 'fremd' }), RangeError);
});
