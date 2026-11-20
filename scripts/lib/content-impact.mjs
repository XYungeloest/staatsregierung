import { buildNormRelations } from '@ostrecht/shared/lib/norms/relations.ts';
import { classifyNormVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { agendaItems } from './knowledge-planning.mjs';
import { normFile, validId, versionFile } from './impact-repository.mjs';

const gazetteFile = (slug) => 'content/verkuendungen/' + slug + '.json';
const at = (file, locator, citation) => ({ file, locator, ...(citation && { citation }) });
const consolidationFile = 'data/recht/consolidation-manifest.json';
const uncertain = new Set(['disputed', 'unresolved', 'unverified']);

function reviewPassages(value, pointer, visit) {
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const path = pointer + '/' + key;
    if (key === 'text' && typeof child === 'string') {
      const match = /\b(?:bis (?:zum|spätestens)|spätestens|innerhalb (?:von|eines|einer|\d+)|wird ermächtigt|durch Rechtsverordnung|erstattet .{0,80}?Bericht)\b/iu.exec(child);
      if (match) visit(path, child.slice(Math.max(0, match.index - 75), match.index + 145));
    } else reviewPassages(child, path, visit);
  }
}

function addKnowledgeFindings(model, affected, sourcePaths, publications, add) {
  const knowledge = model.knowledge;
  const sources = new Map(knowledge.sources.map((s) => [s.id, s]));
  const linked = new Set();
  const register = (row, file, kind) => {
    const normRefs = row.normSlug ? [row, ...(row.normRefs ?? [])] : row.normRefs ?? [];
    const references = normRefs.filter((ref) => affected.has(ref.normSlug));
    const sourceRefs = (row.sourceRefs ?? []).filter((ref) => sourcePaths.has(sources.get(ref.sourceId)?.path));
    if (!references.length && !sourceRefs.length) return;
    linked.add(row.id);
    const evidence = [at(file, row.id, row.provision)];
    for (const ref of references) evidence.push(at(normFile(ref.normSlug, 'meta.json'), 'slug', ref.normSlug));
    for (const ref of sourceRefs) evidence.push(at('knowledge/sources.json', ref.sourceId, ref.locator));
    const uncertainRow = uncertain.has(row.status) || sourceRefs.some((r) => r.role === 'conflicting');
    add(kind, row.id, uncertainRow ? 'candidate' : 'derived', evidence,
      kind === 'mandate' ? 'Frist, Wirksamkeitsbedingung und Vollzugsbeleg prüfen.' : 'Belegten Sachstand mit der Quelle abgleichen.',
      { title: row.title ?? row.subject, status: row.status ?? row.stage, normRefs: references.map(({ normSlug, versionId }) => ({ normSlug, versionId })),
        ...(row.deadlineDate && { deadlineDate: row.deadlineDate }), ...(row.trigger && { trigger: row.trigger }) });
  };
  for (const collection of knowledge.collections.filter((c) => ['project', 'proceeding', 'current-state'].includes(c.type))) {
    for (const row of collection.entries) register(row, collection.file, collection.type);
  }
  for (const row of agendaItems(knowledge.agenda)) register(row, 'knowledge/agenda.json', 'agenda');
  for (const row of knowledge.mandates.mandates) {
    if (!row.duplicateOf) register(row, 'knowledge/implementation-mandates.json', 'mandate');
    else if (affected.has(row.normSlug)) {
      linked.add(row.duplicateOf);
      add('mandate-reference', row.duplicateOf, 'derived', [at('knowledge/implementation-mandates.json', row.id, row.provision)],
        'Vollzugsbefund am verwiesenen Hauptauftrag prüfen.');
    }
  }
  const directIds = new Set(linked);
  for (const c of knowledge.collections.filter((c) => ['project', 'proceeding', 'open-question'].includes(c.type))) {
    for (const row of c.entries) {
      const ids = [...new Set([...(row.relatedIds ?? []), ...(row.affectedIds ?? [])].filter((id) => directIds.has(id)))];
      const questionSource = c.type === 'open-question' && row.sourceRefs?.some((r) => sourcePaths.has(sources.get(r.sourceId)?.path));
      if (linked.has(row.id) || (!ids.length && !questionSource)) continue;
      linked.add(row.id);
      add(c.type, row.id, c.type === 'open-question' || uncertain.has(row.status) ? 'candidate' : 'derived',
        [at(c.file, row.id), ...(row.sourceRefs ?? []).map((r) => at('knowledge/sources.json', r.sourceId, r.locator))],
        row.question ?? 'Den über die Wissens-ID verknüpften Sachstand prüfen.', { relatedIds: ids, title: row.title, status: row.status });
    }
  }
  for (const src of knowledge.sources) {
    if (sourcePaths.has(src.path)) add('source-reference', src.id, 'direct',
      [at('knowledge/sources.json', src.id), at(src.path, src.title)], 'Quellenverweis und Fundstellen bei der Einpflege zuordnen.');
  }
  for (const topic of model.topics) {
    for (const [index, ref] of (topic.rechtsgrundlagen ?? []).entries()) {
      if (affected.has(ref.normSlug) || publications.has(ref.publicationSlug)) add('public-topic', topic.slug, 'derived',
        [at('content/themen/' + topic.slug + '.json', '/rechtsgrundlagen/' + index, ref.label)], 'Freigegebene Rechtsgrundlage und Erläuterung prüfen.');
    }
  }
  for (const key of ['currentStateCoverage', 'projectCoverage']) {
    for (const [i, row] of (model.coverage[key] ?? []).entries()) {
      if (!linked.has(row.id)) continue;
      for (const page of [...(row.publicPaths ?? []), ...(row.topicSlugs ?? []).map((slug) => '/themen/' + slug + '/')]) {
        add('public-page', page, 'derived', [at('content/portal/topic-coverage.json', '/' + key + '/' + i, row.id)],
          'Veröffentlichte Darstellung und Beleg abgleichen.', { relatedId: row.id });
      }
    }
  }
}

/** Lesender Bericht. Direkte Funde benennen ausschließlich die belegte Beziehung. */
export function analyzeImpact(model, { publication, norm }) {
  if (Boolean(publication) === Boolean(norm) || !validId(publication ?? norm)) throw new TypeError('Genau eine gültige Verkündungs- oder Normkennung angeben.');
  const records = new Map(model.norms.map((record) => [record.meta.slug, record]));
  const issue = publication && model.publications.find((p) => p.slug === publication);
  if ((publication && !issue) || (norm && !records.has(norm))) throw new RangeError('Ausgangsquelle fehlt: ' + (publication ?? norm));
  const referenceDate = model.knowledge.editorial.referenceDate;
  const source = issue ? { kind: 'publication', id: publication, title: issue.title, file: gazetteFile(publication), date: issue.date }
    : { kind: 'norm', id: norm, title: records.get(norm).meta.title, file: normFile(norm, 'meta.json') };
  const findings = [];
  const add = (relation, id, confidence, evidence, action, details = {}) => {
    findings.push({ relation, id, confidence, evidence, action, ...details });
  };
  const affected = new Set();
  const acts = new Set();
  const publications = new Set(issue ? [publication] : []);
  const sourcePaths = new Set([source.file, ...(issue?.sourceReferences ?? []).map((s) => s.localSource).filter(Boolean)]);
  const versions = new Map();
  function inspectVersion(slug, versionId, evidence) {
    if (!versionId) return null;
    const file = versionFile(slug, versionId);
    if (versions.has(file)) return versions.get(file);
    const version = model.readVersion(slug, versionId);
    versions.set(file, version);
    if (!version) {
      add('missing-version', slug, 'candidate', [evidence], 'Fehlende Fassung oder Verknüpfung prüfen.', { versionId, missingFile: file });
      return null;
    }
    sourcePaths.add(file);
    add('version', slug, 'direct', [evidence, at(file, '/validFrom', version.citation)], 'Gültigkeitsintervall für die Folgeprüfung verwenden.',
      { versionId, validFrom: version.validFrom, validTo: version.validTo, temporalKind: classifyNormVersion(records.get(slug), version, referenceDate) });
    reviewPassages(version.body, '/body', (pointer, excerpt) => add('mandate-or-deadline', slug, 'candidate',
      [at(file, pointer, excerpt)], 'Adressat:in, Fristbeginn, mögliche Änderung und Vollzugsnachweis fachlich prüfen.', { versionId }));
    return version;
  }
  function include(slug) {
    affected.add(slug);
    sourcePaths.add(normFile(slug, 'meta.json'));
    sourcePaths.add(normFile(slug, 'history.json'));
  }
  if (issue) {
    for (const [index, entry] of issue.entries.entries()) {
      const evidence = at(source.file, '/entries/' + index, entry.citation ?? entry.title);
      if (!entry.normSlug) {
        add('publication-entry', entry.id, 'direct', [evidence], 'Ausgabe als Sachquelle prüfen.');
        continue;
      }
      const slug = entry.normSlug;
      const record = records.get(slug);
      if (!record) {
        add('missing-norm', slug, 'candidate', [evidence], 'Normzuordnung der Verkündung prüfen.');
        continue;
      }
      include(slug);
      const version = inspectVersion(slug, entry.versionId, evidence);
      if (!entry.versionId) add('missing-version-link', slug, 'candidate', [evidence], 'Fassungsbezug der Verkündung klären.');
      const initialIndex = record.history.entries.findIndex((event) => event.type === 'initial' && event.affectingVersionId === entry.versionId);
      const initial = version && initialIndex >= 0 && record.history.initialVersionId === entry.versionId
        && (record.meta.publicationDate === issue.date || record.history.entries[initialIndex].date === issue.date);
      if (initial) acts.add(slug);
      add(initial ? 'initial' : 'published-norm', slug, 'direct',
        initial ? [evidence, at(normFile(slug, 'history.json'), '/entries/' + initialIndex)] : [evidence],
        'Verkündungsfundstelle und Fassungsbezug verwenden.', { versionId: entry.versionId ?? null });
    }
  } else {
    acts.add(norm);
    include(norm);
    const record = records.get(norm);
    for (const [i, event] of record.history.entries.entries()) {
      const evidence = at(normFile(norm, 'history.json'), '/entries/' + i, event.citation);
      inspectVersion(norm, event.affectingVersionId, evidence);
      if (event.relatedNorm && ['amendment', 'repeal'].includes(event.type)) {
        const known = records.has(event.relatedNorm);
        add(event.type === 'amendment' ? 'amended-by' : 'repealed-by', event.relatedNorm, known ? 'direct' : 'candidate',
          [evidence], known ? 'Änderungsquelle und Historienfundstelle berücksichtigen.' : 'Verwiesenen Rechtsakt zuordnen.',
          { date: event.date, versionId: event.affectingVersionId ?? null, target: norm });
      }
    }
    for (const p of model.publications) {
      for (const [i, entry] of p.entries.entries()) if (entry.normSlug === norm) {
        publications.add(p.slug);
        sourcePaths.add(gazetteFile(p.slug));
        add('publication', p.slug, 'direct', [at(gazetteFile(p.slug), '/entries/' + i, entry.citation)], 'Verkündungsbeleg berücksichtigen.');
        inspectVersion(norm, entry.versionId, at(gazetteFile(p.slug), '/entries/' + i, entry.citation));
      }
    }
  }

  const relations = buildNormRelations(model.norms);
  for (const act of acts) {
    const meta = records.get(act).meta;
    for (const key of ['affectedNorms', 'enactedNorm', 'enactedNorms']) {
      for (const slug of [meta[key]].flat().filter(Boolean)) {
        if (!records.has(slug)) add('missing-norm', slug, 'candidate', [at(normFile(act, 'meta.json'), '/' + key, slug)], 'Ziel der Normbeziehung zuordnen.');
      }
    }
    for (const rel of relations.get(act) ?? []) {
      if (!['amends', 'repeals', 'enacts'].includes(rel.kind)) continue;
      const target = rel.norm.meta.slug;
      const kind = { amends: 'amendment', repeals: 'repeal', enacts: 'initial' }[rel.kind];
      const index = rel.norm.history.entries.findIndex((h) => h.relatedNorm === act && h.type === kind
        && (!rel.date || h.date === rel.date) && (!rel.resultingVersionId || h.affectingVersionId === rel.resultingVersionId));
      let evidence;
      if (index >= 0) evidence = at(normFile(target, 'history.json'), '/entries/' + index, rel.norm.history.entries[index].citation);
      else {
        const key = ['enactedNorm', 'enactedNorms', 'affectedNorms'].find((k) => [meta[k]].flat().includes(target));
        evidence = key ? at(normFile(act, 'meta.json'), '/' + key, target)
          : at(normFile(target, 'meta.json'), rel.kind === 'enacts' ? '/enactingNorm' : '/affectedByNorms', act);
      }
      include(target);
      const versionId = rel.resultingVersionId ?? (rel.kind === 'enacts' ? rel.norm.history.initialVersionId : null);
      inspectVersion(target, versionId, evidence);
      const exact = index >= 0 || rel.kind === 'enacts';
      add(exact ? rel.kind : 'affected-norm', target, exact ? 'direct' : 'derived', [evidence],
        exact ? 'Historie und betroffene Fassung abgleichen.' : 'Art und Wirksamkeit der Änderung an der Quelle prüfen.',
        { act, date: rel.date ?? null, versionId });
    }
  }
  for (const [i, target] of model.consolidation.targets.entries()) {
    const related = [...target.amendmentActs, ...target.enactingActs, ...target.correctionActs].some((a) => acts.has(a.slug));
    if (!affected.has(target.canonicalSlug) && !related) continue;
    const blocked = target.status !== 'complete';
    add('consolidation', target.canonicalSlug, blocked ? 'candidate' : 'derived', [at(consolidationFile, '/targets/' + i, target.title)],
      target.nextAction, { status: target.status, problems: target.problems, effectiveDates: target.effectiveDates });
  }
  for (const [i, finding] of model.consolidation.ambiguousFindings.entries()) {
    if (acts.has(finding.amendmentAct)) add('ambiguous-target', finding.candidate, 'candidate',
      [at(consolidationFile, '/ambiguousFindings/' + i, finding.evidence)], 'Zielvorschrift an der Primärquelle klären.');
  }
  addKnowledgeFindings(model, affected, sourcePaths, publications, add);
  const files = [...new Set([source.file, ...sourcePaths, ...findings.flatMap((f) => f.evidence.map((e) => e.file))])].sort();
  return { schemaVersion: 1, source, referenceDate, findings, files };
}
