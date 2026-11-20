import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getNormVersionIdentity } from '@ostrecht/shared/lib/norms/identity.ts';
import { classifyNormVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { agendaItems, evidenceNormVersions } from '../../scripts/lib/knowledge-planning.mjs';
import { analyzeImpact } from '../../scripts/lib/content-impact.mjs';
import { loadImpactRepository, normFile, readVersion, repositoryRoot, versionFile } from '../../scripts/lib/impact-repository.mjs';
import { loadModel } from '../../scripts/knowledge.mjs';
import { parseQuery } from './tools.mjs';

const fold = (s) => s.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '').replaceAll('ß', 'ss');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const openStages = new Set(['ongoing', 'implementation', 'government-draft-published', 'cabinet-approved-draft',
  'proposal', 'mediation-requested', 'correspondence-draft', 'formal-outcome-unresolved']);

function entriesFor(model) {
  const entries = [];
  function add(row, type, file, asOf) {
    entries.push({ ...row, type, file, asOf: row.asOf ?? asOf });
  }
  for (const collection of model.collections) {
    for (const row of collection.entries) add(row, collection.type, collection.file, collection.document.asOf);
  }
  for (const source of model.sources) add({ ...source, sourceType: source.type }, 'source', 'knowledge/sources.json', model.sourcesDoc.asOf);
  for (const row of agendaItems(model.agenda)) add({ ...row, status: 'planned' }, 'agenda', 'knowledge/agenda.json', model.agenda.asOf);
  for (const row of model.agenda.simulationRules ?? []) add(row, 'simulation-rule', 'knowledge/agenda.json', model.agenda.asOf);
  const mandates = model.mandates.mandates;
  const aliases = new Map();
  for (const row of mandates.filter((r) => r.duplicateOf)) {
    if (!aliases.has(row.duplicateOf)) aliases.set(row.duplicateOf, []);
    aliases.get(row.duplicateOf).push(row.id, [row.normSlug, row.provision].filter(Boolean).join(' '));
  }
  for (const row of mandates.filter((r) => !r.duplicateOf)) {
    add({ ...row, title: row.subject, aliases: aliases.get(row.id) ?? [], tags: [row.norm, row.normSlug, row.provision].filter(Boolean) },
      'implementation-mandate', 'knowledge/implementation-mandates.json', model.mandates.baselineAsOf ?? model.mandates.asOf);
  }
  const positions = model.holdingPositions;
  for (const portfolio of positions.portfolios) {
    for (const values of portfolio.positions) {
      const pos = Object.fromEntries(positions.positionFields.map((field, i) => [field, values[i]]));
      add({ id: 'holding-position-' + pos.key, title: pos.name, status: pos.currentStatus, validFrom: positions.inheritanceAt,
        summary: pos.sourceLocator, sourceRefs: portfolio.sourceIds.map((sourceId) => ({ sourceId, role: 'context' })) },
      'holding-position', 'knowledge/holding-positions.json', positions.asOf);
    }
  }
  return entries.sort((a, b) => compare(a.id, b.id));
}

function repositoryLegalState({ norm, version }, referenceDate) {
  try {
    const metaFile = normFile(norm, 'meta.json');
    const meta = JSON.parse(readFileSync(join(repositoryRoot, metaFile), 'utf8'));
    const versions = version ? [version] : readdirSync(join(repositoryRoot, normFile(norm, 'versions')))
      .filter((s) => s.endsWith('.json')).sort().map((f) => f.slice(0, -5));
    return versions.map((id) => {
      const v = readVersion(norm, id);
      if (!v) throw new RangeError('Normfassung fehlt: ' + norm + '/' + id);
      return { id: norm, versionId: id, title: getNormVersionIdentity({ meta }, v).title, status: meta.status, temporalKind: classifyNormVersion({ meta }, v, referenceDate),
        validFrom: v.validFrom, validTo: v.validTo, asOf: referenceDate,
        sources: [{ file: versionFile(norm, id), locator: v.citation ?? '/versionId' }, { file: metaFile, locator: '/status' }] };
    });
  } catch (error) {
    if (error.code === 'ENOENT') throw new RangeError('Norm fehlt: ' + norm);
    throw error;
  }
}

export function createKnowledgeQuery(model = loadModel(repositoryRoot), {
  legalState = repositoryLegalState, impact = (publication) => analyzeImpact(loadImpactRepository(repositoryRoot, model), { publication }),
} = {}) {
  const referenceDate = model.editorial.referenceDate;
  const entries = entriesFor(model);
  const byId = new Map(entries.map((r) => [r.id, r]));
  for (const row of model.mandates.mandates.filter((r) => r.duplicateOf)) byId.set(row.id, byId.get(row.duplicateOf));
  const questions = entries.filter((r) => r.type === 'open-question' && r.questionStatus !== 'closed');
  const sources = new Map(model.sources.map((s) => [s.id, s]));
  const expand = (ref) => ({ ...ref, file: sources.get(ref.sourceId)?.path ?? null, sourceType: sources.get(ref.sourceId)?.type ?? null });
  const citations = (r) => r.type === 'source' ? [{ sourceId: r.id, file: r.path, locator: r.title, sourceType: r.sourceType }]
    : (r.sourceRefs ?? []).map(expand);
  const normRefs = (r) => [...(r.normSlug ? [{ normSlug: r.normSlug, versionId: r.versionId ?? null }] : []), ...(r.normRefs ?? [])];
  const conflicts = (r) => [...new Set([...(r.openQuestionIds ?? []), ...questions.filter((q) => q.affectedIds?.includes(r.id) || q.relatedIds?.includes(r.id)).map((q) => q.id)])];

  function view(r) {
    const refs = citations(r);
    return { id: r.id, type: r.type, title: r.title, status: r.status ?? null,
      evidenceStatus: r.type === 'conversation-candidate' ? 'unverified'
        : ['implementation-mandate', 'holding-position'].includes(r.type) ? 'derived' : r.status ?? null,
      asOf: r.asOf, validFrom: r.validFrom ?? null, validTo: r.validTo ?? null,
      stage: r.projectStage ?? r.stage ?? null, summary: r.summary ?? r.subject ?? null,
      file: r.file, locator: r.id,
      ...(r.type === 'proceeding' && { proceedingType: r.proceedingType, decision: r.decision, nextAction: r.nextAction }),
      ...(r.type === 'open-question' && { question: r.question, questionStatus: r.questionStatus, requiredSource: r.requiredSource,
        reason: r.reason, affectedIds: (r.affectedIds ?? []).slice(0, 8) }),
      sources: refs.slice(0, 5), sourceCount: refs.length,
      normRefs: normRefs(r).slice(0, 8), relatedIds: (r.relatedIds ?? []).slice(0, 8), conflictIds: conflicts(r).slice(0, 8),
      ...(r.type === 'implementation-mandate' && { tier: r.tier, obligation: r.obligation, provision: r.provision,
        deadlineDate: r.deadlineDate ?? null, deadline: r.deadline ?? null, trigger: r.trigger ?? null,
        evidence: (r.evidence ?? []).slice(0, 4) }) };
  }
  function find(id, type) {
    const row = byId.get(id);
    if (!row || (type && row.type !== type)) throw new RangeError('Kein passender Wissenseintrag: ' + id);
    return row;
  }
  const queries = {
    search_knowledge({ query }) {
      const needle = fold(query);
      const matches = [];
      for (const row of entries) {
        const names = [row.id, row.title, ...(row.aliases ?? []), ...(row.nameVariants ?? [])].filter(Boolean).map(fold);
        const rank = names.includes(needle) ? 0 : names.some((n) => n.includes(needle)) ? 1
          : row.tags?.some((t) => fold(t).includes(needle)) ? 2 : null;
        if (rank !== null) matches.push({ row, rank });
      }
      return matches.sort((a, b) => a.rank - b.rank).map((m) => view(m.row));
    },
    get_entity({ id }) {
      const row = find(id);
      const present = (item) => (!item.validFrom || item.validFrom <= referenceDate) && (!item.validTo || item.validTo >= referenceDate);
      const state = entries.filter((e) => e.type === 'current-state' && e.id !== row.id && present(e) && e.relatedIds?.includes(id));
      const roles = row.type === 'person' ? queries.get_roles({ id }).filter(present) : [];
      return [view(row), ...state.map(view), ...roles, ...normRefs(row).map((ref) => ({ kind: 'norm-reference', ...ref, file: row.file, locator: row.id })),
        ...(row.relatedIds ?? []).map((relatedId) => ({ kind: 'related', id: relatedId, file: row.file, locator: row.id }))];
    },
    get_roles({ id }) {
      const row = find(id, 'person');
      return (row.roles ?? []).map((role, index) => ({ id: row.id, title: role.officeTitle, institutionId: role.institutionId,
        validFrom: role.validFrom, validTo: role.validTo, acting: role.acting, status: row.status, asOf: row.asOf,
        file: row.file, locator: row.id + '.roles[' + index + ']', sources: [role.appointmentSource, role.terminationSource].filter(Boolean).map(expand) }));
    },
    get_project_context({ id }) {
      const row = find(id, 'project');
      const related = new Set([...(row.relatedIds ?? []), ...conflicts(row)]);
      const context = entries.filter((e) => related.has(e.id) || (e.type === 'proceeding' && e.relatedIds?.includes(id)));
      return [view(row), ...normRefs(row).flatMap((r) => {
        try { return legalState({ norm: r.normSlug, version: r.versionId }, referenceDate); }
        catch (error) {
          if (!(error instanceof RangeError)) throw error;
          return [{ ...r, status: 'unresolved', file: row.file, locator: row.id + '.normRefs', reason: error.message }];
        }
      }),
        ...(row.milestones ?? []).map((step) => ({ kind: 'milestone', ...step, file: row.file, locator: row.id + '.milestones' })),
        ...context.map(view)];
    },
    get_proceeding({ id }) { return [view(find(id, 'proceeding'))]; },
    list_open_proceedings({ type }) {
      return entries.filter((r) => r.type === 'proceeding' && openStages.has(r.stage) && (!type || type === r.proceedingType)).map(view);
    },
    list_open_mandates({ norm }) {
      return entries.filter((r) => r.type === 'implementation-mandate' && r.tier !== 'verfallen' && (!norm || r.normSlug === norm))
        .sort((a, b) => compare(a.deadlineDate || '9999', b.deadlineDate || '9999') || compare(a.id, b.id)).map(view);
    },
    trace_sources({ id }) {
      const row = find(id);
      return [...citations(row), ...normRefs(row).map((r) => ({ file: r.versionId ? versionFile(r.normSlug, r.versionId) : normFile(r.normSlug, 'meta.json'), locator: row.provision ?? r.normSlug })),
        ...(row.evidence ?? []).flatMap((label, index) => {
          const versions = evidenceNormVersions(label);
          return versions.length ? versions.map(({ normSlug, versionId }) => ({
            file: versionFile(normSlug, versionId), locator: row.provision ?? versionId, label,
          })) : [{ file: row.file, locator: row.id + '.evidence[' + index + ']', label }];
        })];
    },
    list_source_conflicts() {
      return entries.filter((r) => r.status === 'disputed' || questions.includes(r)
        || r.sourceRefs?.some((ref) => ref.role === 'conflicting')).map(view);
    },
    get_legal_state(params) { return legalState(params, referenceDate); },
    analyze_publication_impact({ publication }) { return impact(publication).findings; },
  };
  return (name, input = {}) => {
    const params = parseQuery(name, input);
    const all = queries[name](params);
    const items = [];
    let bytes = 0;
    for (const row of all.slice(params.offset, params.offset + params.limit)) {
      const size = Buffer.byteLength(JSON.stringify(row));
      if (items.length && bytes + size > 48_000) break;
      if (size > 48_000) {
        items.push({ id: row.id, file: row.file ?? row.evidence?.[0]?.file, locator: row.locator ?? row.evidence?.[0]?.locator, truncated: true });
        break;
      }
      items.push(row);
      bytes += size;
    }
    const next = params.offset + items.length;
    return { schemaVersion: 1, query: name, referenceDate, total: all.length, offset: params.offset,
      nextOffset: next < all.length ? next : null, items };
  };
}
