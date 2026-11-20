import { createHash } from 'node:crypto';

const agendaGroups = {
  first100Days: 'Aufbauprogramm für die ersten 100 Tage',
  additionalLaws: 'Weitere Gesetzesvorhaben',
  majorProjects: 'Politische Vorhaben und Projekte',
};
const agendaStages = new Set(['idea', 'programme', 'conditional-programme', 'concept', 'drafting', 'introduced']);
const tiers = ['ueberfaellig', 'fristgebunden', 'rechtsetzung', 'ermaechtigung', 'vollzug', 'nicht-pruefbar', 'verfallen'];
const heading = {
  ueberfaellig: 'Frist verstrichen, Vollzugsbeleg offen', fristgebunden: 'Fristgebundene Aufträge',
  rechtsetzung: 'Rechtsetzungsaufträge', ermaechtigung: 'Ermächtigungen', vollzug: 'Weitere Vollzugsaufträge',
  'nicht-pruefbar': 'Im Bestand nicht prüfbar', verfallen: 'Abgelaufene Ermächtigungen',
};

export function agendaItems(agenda) {
  return Object.keys(agendaGroups).flatMap((key) => Array.isArray(agenda[key]) ? agenda[key] : []);
}

export function bodyDigest(version) {
  return createHash('sha256').update(JSON.stringify(version.body)).digest('hex');
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Legacy-Aufträge verwenden Norm-Slug und Vorschrift als unmittelbaren Quellenverweis. */
export function validatePlanning({ agenda, mandates, sources, ids, hasNorm, loadVersion, referenceDate }) {
  const errors = [];
  const allIds = new Set(ids);
  const refs = (id, list) => {
    if (!Array.isArray(list) || !list.length) {
      errors.push(id + ': Quellenbeleg fehlt.');
      return;
    }
    for (const r of list) {
      if (!sources.has(r?.sourceId) || typeof r.locator !== 'string' || !r.locator.trim() ||
          !['primary', 'corroborating', 'conflicting', 'context'].includes(r.role)) {
        errors.push(id + ': ungültiger Quellenverweis ' + r?.sourceId);
      }
    }
  };
  function register(id) {
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id) || allIds.has(id)) errors.push('Fehlende oder doppelte ID: ' + id);
    allIds.add(id);
  }
  for (const key of Object.keys(agendaGroups)) {
    if (!Array.isArray(agenda[key])) errors.push('agenda.json: fehlende Liste ' + key);
  }
  const plans = agendaItems(agenda);
  const rules = Array.isArray(agenda.simulationRules) ? agenda.simulationRules : [];
  if (agenda.simulationRules && !Array.isArray(agenda.simulationRules)) errors.push('agenda.json: ungültige Liste simulationRules.');
  for (const x of [...plans, ...rules]) {
    register(x.id);
    refs(x.id, x.sourceRefs);
    if (!x.title || !x.summary) errors.push(x.id + ': Titel oder Zusammenfassung fehlt.');
  }
  for (const x of plans) {
    if (!agendaStages.has(x.stage) || !agenda.stageDefinitions?.[x.stage]) errors.push(x.id + ': ungültige Planungsstufe.');
    if (x.asOf && (!validDate(x.asOf) || x.asOf > agenda.asOf)) errors.push(x.id + ': ungültiger Prüfstand.');
    for (const r of x.normRefs ?? []) {
      if (![r.normSlug, r.versionId].every((key) => typeof key === 'string' && /^[a-z0-9-]+$/.test(key)) ||
          !loadVersion(r.normSlug, r.versionId)) errors.push(x.id + ': referenzierte Normfassung fehlt.');
    }
    for (const id of x.relatedIds ?? []) if (!allIds.has(id)) errors.push(x.id + ': unbekannte relatedId ' + id);
  }
  for (const rule of rules) {
    if (!validDate(rule.validFrom)) errors.push(rule.id + ': Beginn der Festlegung fehlt.');
  }
  const rows = Array.isArray(mandates.mandates) ? mandates.mandates : [];
  if (!Array.isArray(mandates.mandates)) errors.push('implementation-mandates.json: Auftragsliste fehlt.');
  const byId = new Map(rows.map((x) => [x.id, x]));
  const counts = new Map(tiers.map((tier) => [tier, 0]));
  const proofs = new Set();
  const evidenceVersions = new Map();
  let duplicates = 0;
  for (const x of rows) {
    register(x.id);
    if (!tiers.includes(x.tier) || !x.provision?.trim()) errors.push(x.id + ': Stufe oder Vorschrift fehlt.');
    if (x.normSlug && (!/^[a-z0-9-]+$/.test(x.normSlug) || !hasNorm(x.normSlug))) errors.push(x.id + ': unbekannte Norm ' + x.normSlug);
    if (!x.normSlug && !x.sourceRefs?.some((r) => r.role === 'primary' && sources.get(r.sourceId)?.type === 'official-gazette')) {
      errors.push(x.id + ': amtliche Rechtsquelle fehlt.');
    }
    if (x.duplicateOf) {
      const target = byId.get(x.duplicateOf);
      if (!target || target.duplicateOf || target.tier !== x.tier) errors.push(x.id + ': ungültiges duplicateOf ' + x.duplicateOf);
      duplicates++;
      continue;
    }
    counts.set(x.tier, (counts.get(x.tier) ?? 0) + 1);
    if (!['offen','teilweise','nicht-pruefbar'].includes(x.status) || !['kann','soll','muss'].includes(x.obligation) ||
        !x.subject || !x.addressee || !x.instrument || !x.evidence?.length) errors.push(x.id + ': unvollständiger Vollzugsbefund.');
    // Ältere Belege enthalten neben Freitext auch vollständige Pfade zu gespeicherten Fassungen.
    for (const evidence of Array.isArray(x.evidence) ? x.evidence : []) {
      if (typeof evidence !== 'string') {
        errors.push(x.id + ': ungültiger Eintrag in evidence.');
        continue;
      }
      for (const match of evidence.matchAll(/(?:^|[\s(])(?:content\/normen\/)?([a-z0-9-]+)\/versions\/([a-z0-9-]+)\.json\b/gu)) {
        const [, slug, versionId] = match;
        const key = slug + '/' + versionId;
        if (!evidenceVersions.has(key)) evidenceVersions.set(key, loadVersion(slug, versionId)?.versionId === versionId);
        if (!evidenceVersions.get(key)) errors.push(x.id + ': Normfassung aus evidence fehlt: ' + key);
      }
    }
    if (x.sourceRefs || x.asOf) refs(x.id, x.sourceRefs);
    if (x.deadlineDate && (!validDate(x.deadlineDate) || !x.deadline)) errors.push(x.id + ': Frist ist ungültig.');
    if ((x.tier === 'fristgebunden' && x.deadlineDate && x.deadlineDate < referenceDate) ||
        (x.tier === 'ueberfaellig' && x.deadlineDate && x.deadlineDate >= referenceDate)) errors.push(x.id + ': Friststufe am Stichtag prüfen.');
    if (x.asOf && (!validDate(x.asOf) || x.asOf > mandates.asOf || !validDate(x.validFrom))) errors.push(x.id + ': Prüfstand oder Wirksamkeitsdatum ungültig.');
    if (x.normSlug && (x.asOf || x.versionId)) {
      const key = x.normSlug + '/' + x.versionId;
      proofs.add(key);
      if (!mandates.versionEvidence?.[key]) errors.push(x.id + ': Prüfbeleg der Normfassung fehlt: ' + key);
    }
  }
  for (const [key, hash] of Object.entries(mandates.versionEvidence ?? {})) {
    const parts = key.split('/');
    const version = parts.length === 2 && parts.every((p) => /^[a-z0-9-]+$/.test(p)) && loadVersion(...parts);
    if (!proofs.has(key) || !version || version.versionId !== parts[1] || bodyDigest(version) !== hash ||
        (version.validTo && version.validTo < referenceDate)) errors.push('Vollzugsaufträge: Normfassung erneut prüfen: ' + key);
  }
  if (mandates.totals?.open !== rows.length || mandates.totals?.duplicates !== duplicates ||
      tiers.some((tier) => (mandates.totals?.listedByTier?.[tier] ?? 0) !== counts.get(tier))) errors.push('implementation-mandates.json: Summen weichen ab.');
  return errors;
}

export function planningIndex(agenda, mandates) {
  const items = agendaItems(agenda).map((x) => ({
    id: x.id, type: 'agenda', title: x.title, stage: x.stage, aliases: [], tags: [x.stage, x.kind].filter(Boolean),
    validFrom: null, validTo: null, target: 'knowledge/agenda.json',
  }));
  for (const rule of agenda.simulationRules ?? []) items.push({
    id: rule.id, type: 'simulation-rule', title: rule.title, aliases: [], tags: ['Simulationsregel'],
    validFrom: rule.validFrom, validTo: null, target: 'knowledge/agenda.json',
  });
  const aliases = new Map();
  for (const x of mandates.mandates.filter((x) => x.duplicateOf)) {
    if (!aliases.has(x.duplicateOf)) aliases.set(x.duplicateOf, []);
    aliases.get(x.duplicateOf).push(x.id, x.normSlug + ' ' + x.provision);
  }
  for (const x of mandates.mandates.filter((x) => !x.duplicateOf)) items.push({
    id: x.id, type: 'implementation-mandate', title: x.subject, aliases: aliases.get(x.id) ?? [],
    tags: [x.normSlug ?? x.norm, x.provision, x.tier, x.instrument], status: x.status,
    validFrom: x.validFrom ?? null, validTo: null, deadlineDate: x.deadlineDate || null, target: 'knowledge/implementation-mandates.json',
  });
  return items;
}

export function renderAgenda(agenda) {
  const politics = agenda.politicalContext;
  const vote = politics.volksbefragung2026;
  const lines = ['# Politische und gesetzgeberische Agenda', '', agenda.purpose, '',
    politics.jointList.name + ' ist die gemeinsame Wahlliste von ' + politics.jointList.participants.join(' und ') + '. ' +
      politics.jointList.partyContinuity, '', politics.electionOutcome, '', vote.outcome + ' ' + vote.legalEffect,
    '', '[Regierungsprogramm des Roten Aufbruchs](../' + agenda.programmeSource + ')', '', '## Planungsstufen', ''];
  for (const [stage, description] of Object.entries(agenda.stageDefinitions)) lines.push('- **' + stage + '** — ' + description);
  for (const [group, title] of Object.entries(agendaGroups)) {
    lines.push('', '## ' + title, '');
    for (const x of agenda[group]) {
      lines.push('### ' + x.title, '', '**' + x.stage + '** · ' + x.summary, '');
      for (const key of ['targetInstrument', 'baseline', 'resolvedCondition', 'politicalBasis', 'openDecision', 'note']) {
        if (x[key]) lines.push(x[key], '');
      }
    }
  }
  lines.push('## Bestehendes Recht und offene Folgeziele', '');
  for (const x of agenda.legalBaseline) lines.push('- **' + x.topic + '** — ' + x.currentState + ' ' + x.openFollowUp);
  lines.push('', '## Vergleichsmaterial', '');
  for (const x of agenda.nonAgendaReferences) lines.push('- **' + x.topic + '** — ' + x.reason);
  lines.push('', '## Verbindliche Simulationsregeln', '');
  for (const x of agenda.simulationRules ?? []) lines.push('- **' + x.title + '** (' + x.validFrom + ') — ' + x.summary);
  lines.push('', 'Quellen und Pflegehinweise stehen in [agenda.json](agenda.json).', '');
  return lines.join('\n');
}

export function renderMandates(doc, referenceDate) {
  const rows = doc.mandates.filter((x) => !x.duplicateOf);
  const lines = ['# Vollzugsaufträge', '', 'Rechtsstand ' + referenceDate + '. ' + doc.method, '',
    '„Offen“ bezeichnet den fehlenden Beleg. Bei „nicht-pruefbar“ liegt der Nachweis außerhalb des ausgewerteten Bestands. ' +
    'Zeitlich bedingte Pflichten behalten ihre Auslöser. Quellen und Fundstellen stehen im [Vollzugsregister](implementation-mandates.json).', '',
    rows.length + ' eigenständige Aufträge. ' + doc.totals.duplicates + ' Querverweise aus Mantelgesetzen.', ''];
  for (const tier of tiers) {
    const group = rows.filter((x) => x.tier === tier);
    lines.push('## ' + heading[tier] + ' (' + group.length + ')', '');
    if (['ueberfaellig','fristgebunden','rechtsetzung','ermaechtigung'].includes(tier)) {
      for (const x of group.sort((a,b) => (a.deadlineDate || '9999').localeCompare(b.deadlineDate || '9999'))) {
        const future = x.validFrom > referenceDate ? ' · wirksam ab ' + x.validFrom : '';
        lines.push('- ' + (x.deadlineDate || x.deadline ? '**' + (x.deadlineDate || x.deadline) + '** · ' : '') + x.norm + ', ' + x.provision +
          ' — ' + x.subject + ' (' + x.status + future + ')' + (x.trigger ? ' Auslöser: ' + x.trigger + '.' : ''));
      }
    } else {
      const byNorm = new Map();
      for (const x of group) byNorm.set(x.norm, (byNorm.get(x.norm) ?? 0) + 1);
      for (const [name, count] of [...byNorm].sort(([a],[b]) => a.localeCompare(b,'de'))) lines.push('- ' + name + ' (' + count + ')');
    }
    lines.push('');
  }
  return lines.join('\n');
}

// Ein gleichdatiertes Verkündungspaket nimmt höchstens zwei der zehn Plätze ein.
export function recentEvents(events, referenceDate, limit = 10) {
  const counts = new Map();
  return events.filter((x) => x.date <= referenceDate).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .filter((x) => {
      const key = x.date + '/' + (x.eventType ?? x.tags?.[0] ?? '');
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key) <= 2;
    }).slice(0, limit);
}
