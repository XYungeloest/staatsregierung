#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const knowledgeDir = path.join(root, 'knowledge');
const generatedDir = path.join(knowledgeDir, 'generated');
const asOfPattern = /^\d{4}-\d{2}-\d{2}$/;
const confirmedStatuses = new Set([
  'confirmed-primary',
  'confirmed-official',
  'editorially-confirmed',
  'derived',
  'historical',
  'superseded',
  'disputed',
]);
const statuses = new Set([
  'confirmed-primary',
  'confirmed-official',
  'editorially-confirmed',
  'derived',
  'planned',
  'historical',
  'superseded',
  'disputed',
  'unverified',
  'unresolved',
]);
const sourceRoles = new Set(['primary', 'corroborating', 'conflicting', 'context']);
const forbiddenSourceHosts = ['politiksimde.fandom.com'];

const dataSpecs = [
  ['knowledge/current-state.json', 'sections', 'current-state'],
  ['knowledge/timeline.json', 'events', 'timeline-event'],
  ['knowledge/projects.json', 'projects', 'project'],
  ['knowledge/holdings.json', 'holdings', 'holding'],
  ['knowledge/proceedings.json', 'proceedings', 'proceeding'],
  ['knowledge/open-questions.json', 'questions', 'open-question'],
  ['knowledge/conversation-candidates.json', 'candidates', 'conversation-candidate'],
  ['knowledge/entities/institutions.json', 'institutions', 'institution'],
  ['knowledge/entities/persons.json', 'persons', 'person'],
  ['knowledge/entities/parties.json', 'parties', 'party'],
  ['knowledge/entities/territories.json', 'territories', 'territory'],
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function loadModel() {
  const editorial = readJson('src/config/editorial.json');
  const sourcesDoc = readJson('knowledge/sources.json');
  const holdingPositions = readJson('knowledge/holding-positions.json');
  const collections = dataSpecs.map(([file, key, type]) => {
    const document = readJson(file);
    if (!Array.isArray(document[key])) {
      throw new Error(`${file}: Feld ${key} muss ein Array sein.`);
    }
    return { file, key, type, document, entries: document[key] };
  });
  return {
    editorial,
    sourcesDoc,
    sources: sourcesDoc.sources,
    holdingPositions,
    collections,
    byType: new Map(collections.map((collection) => [collection.type, collection.entries])),
  };
}

function validateDate(value, location, errors) {
  if (value === null || value === undefined) return;
  if (typeof value !== 'string' || !asOfPattern.test(value)) {
    errors.push(`${location}: ungültiges Datumsformat ${JSON.stringify(value)}.`);
    return;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    errors.push(`${location}: ungültiges Kalenderdatum ${value}.`);
  }
}

function walkDates(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkDates(item, `${location}[${index}]`, errors));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (
      key === 'date' ||
      key === 'asOf' ||
      key === 'validFrom' ||
      key === 'validTo' ||
      key === 'formedOn' ||
      key === 'endedOn' ||
      key === 'effectiveDate' ||
      key === 'publicationDate' ||
      key === 'documentDate' ||
      key === 'seatCountAsOf' ||
      key === 'futureEffectiveDate'
    ) {
      validateDate(child, `${location}.${key}`, errors);
    }
    walkDates(child, `${location}.${key}`, errors);
  }
}

function validateEntry(entry, file, documentAsOf, sourceIds, errors) {
  const location = `${file}:${entry.id ?? '<ohne-id>'}`;
  for (const field of ['id', 'title', 'status', 'asOf', 'summary', 'sourceRefs', 'relatedIds', 'tags', 'notes']) {
    if (!(field in entry)) errors.push(`${location}: Pflichtfeld ${field} fehlt.`);
  }
  if (!statuses.has(entry.status)) errors.push(`${location}: unbekannter Status ${entry.status}.`);
  validateDate(entry.asOf, `${location}.asOf`, errors);
  if (
    typeof documentAsOf === 'string' &&
    asOfPattern.test(documentAsOf) &&
    typeof entry.asOf === 'string' &&
    asOfPattern.test(entry.asOf) &&
    entry.asOf > documentAsOf
  ) {
    errors.push(`${location}: asOf ${entry.asOf} liegt nach dem Datensatzstand ${documentAsOf}.`);
  }
  validateDate(entry.validFrom, `${location}.validFrom`, errors);
  validateDate(entry.validTo, `${location}.validTo`, errors);
  if (entry.validFrom && entry.validTo && entry.validFrom > entry.validTo) {
    errors.push(`${location}: validFrom liegt nach validTo.`);
  }
  if (!Array.isArray(entry.sourceRefs)) {
    errors.push(`${location}: sourceRefs muss ein Array sein.`);
  } else {
    for (const [index, ref] of entry.sourceRefs.entries()) {
      if (!sourceIds.has(ref.sourceId)) {
        errors.push(`${location}.sourceRefs[${index}]: unbekannte Quelle ${ref.sourceId}.`);
      }
      if (!sourceRoles.has(ref.role)) {
        errors.push(`${location}.sourceRefs[${index}]: unbekannte Quellenrolle ${ref.role}.`);
      }
      if (!ref.locator) {
        errors.push(`${location}.sourceRefs[${index}]: locator fehlt.`);
      }
    }
  }
  if (confirmedStatuses.has(entry.status) && entry.sourceRefs.length === 0) {
    errors.push(`${location}: bestätigter Eintrag ohne sourceRefs.`);
  }
}

function intervalsOverlap(a, b) {
  const aStart = a.validFrom ?? '0000-01-01';
  const aEnd = a.validTo ?? '9999-12-31';
  const bStart = b.validFrom ?? '0000-01-01';
  const bEnd = b.validTo ?? '9999-12-31';
  return aStart <= bEnd && bStart <= aEnd;
}

function validateModel(model, compareGenerated) {
  const errors = [];
  validateDate(model.editorial.referenceDate, 'src/config/editorial.json:referenceDate', errors);
  const sourceIds = new Set();
  const sourceById = new Map();

  for (const source of model.sources) {
    if (!source.id || sourceIds.has(source.id)) {
      errors.push(`knowledge/sources.json: doppelte oder fehlende Quellen-ID ${source.id}.`);
      continue;
    }
    sourceIds.add(source.id);
    sourceById.set(source.id, source);
    validateDate(source.date, `knowledge/sources.json:${source.id}.date`, errors);
    const sourcePath = source.path ?? '';
    for (const forbiddenHost of forbiddenSourceHosts) {
      if (sourcePath.includes(forbiddenHost)) {
        errors.push(`knowledge/sources.json:${source.id}: unzulässiger Wikihoster ${forbiddenHost}.`);
      }
    }
    const isExternal = /^https:\/\//.test(sourcePath);
    const isConversation = /^conversation:\/\//.test(sourcePath);
    if (!isExternal && !isConversation) {
      const absolute = path.join(root, sourcePath);
      if (!fs.existsSync(absolute)) {
        errors.push(`knowledge/sources.json:${source.id}: Repositorypfad fehlt: ${sourcePath}.`);
      }
    }
  }

  validateHoldingPositions(model.holdingPositions, sourceIds, errors);

  const allEntries = [];
  const idMap = new Map();
  for (const collection of model.collections) {
    walkDates(collection.document, collection.file, errors);
    for (const entry of collection.entries) {
      validateEntry(entry, collection.file, collection.document.asOf, sourceIds, errors);
      if (idMap.has(entry.id)) {
        errors.push(`Doppelte Wissens-ID ${entry.id} in ${collection.file} und ${idMap.get(entry.id).file}.`);
      } else {
        idMap.set(entry.id, { ...entry, file: collection.file, type: collection.type });
      }
      allEntries.push({ ...entry, file: collection.file, type: collection.type });
    }
  }

  for (const item of allEntries) {
    for (const relatedId of item.relatedIds ?? []) {
      if (!idMap.has(relatedId)) {
        errors.push(`${item.file}:${item.id}: relatedId ${relatedId} existiert nicht.`);
      }
    }
  }

  const institutions = new Set((model.byType.get('institution') ?? []).map((entry) => entry.id));
  const parties = new Set((model.byType.get('party') ?? []).map((entry) => entry.id));
  const persons = model.byType.get('person') ?? [];

  for (const person of persons) {
    for (const [index, role] of (person.roles ?? []).entries()) {
      const location = `knowledge/entities/persons.json:${person.id}.roles[${index}]`;
      if (!institutions.has(role.institutionId)) {
        errors.push(`${location}: unbekannte Institution ${role.institutionId}.`);
      }
      validateDate(role.validFrom, `${location}.validFrom`, errors);
      validateDate(role.validTo, `${location}.validTo`, errors);
      if (role.validFrom && role.validTo && role.validFrom > role.validTo) {
        errors.push(`${location}: validFrom liegt nach validTo.`);
      }
      if (!role.appointmentSource?.sourceId || !sourceIds.has(role.appointmentSource.sourceId)) {
        errors.push(`${location}: gültige appointmentSource fehlt.`);
      }
      if (role.validTo && (!role.terminationSource?.sourceId || !sourceIds.has(role.terminationSource.sourceId))) {
        errors.push(`${location}: beendete Rolle ohne gültige terminationSource.`);
      }
    }
    for (const partyId of person.partyIds ?? []) {
      if (!parties.has(partyId)) {
        errors.push(`knowledge/entities/persons.json:${person.id}: unbekannte Partei ${partyId}.`);
      }
    }
    const permanentRoles = (person.roles ?? []).filter((role) => role.permanent && !role.acting);
    for (let i = 0; i < permanentRoles.length; i += 1) {
      for (let j = i + 1; j < permanentRoles.length; j += 1) {
        const left = permanentRoles[i];
        const right = permanentRoles[j];
        if (
          left.institutionId === right.institutionId &&
          left.officeTitle === right.officeTitle &&
          intervalsOverlap(left, right) &&
          !left.notes?.includes('overlapAllowed') &&
          !right.notes?.includes('overlapAllowed')
        ) {
          errors.push(`knowledge/entities/persons.json:${person.id}: überlappende Amtszeiten für ${left.officeTitle}.`);
        }
      }
    }
  }

  const currentState = model.byType.get('current-state') ?? [];
  for (const section of currentState) {
    if (['unverified', 'unresolved', 'planned', 'disputed'].includes(section.status)) {
      errors.push(`knowledge/current-state.json:${section.id}: unzulässiger Status ${section.status}.`);
    }
    for (const ref of section.sourceRefs ?? []) {
      const source = sourceById.get(ref.sourceId);
      if (source?.type === 'conversation') {
        errors.push(`knowledge/current-state.json:${section.id}: Gesprächsquelle ${source.id} ist unzulässig.`);
      }
    }
  }

  const currentGovernment = currentState.find((entry) => entry.id === 'state-current-government');
  if (currentGovernment) {
    const currentPersonIds = [
      ...(currentGovernment.memberPersonIds ?? []),
      currentGovernment.chiefOfChancelleryPersonId,
    ].filter(Boolean);
    for (const personId of currentPersonIds) {
      const person = idMap.get(personId);
      if (!person) continue;
      const activeRoles = (person.roles ?? []).filter((role) => {
        if (role.validFrom && role.validFrom > currentGovernment.asOf) return false;
        if (role.validTo && role.validTo < currentGovernment.asOf) return false;
        return true;
      });
      if (activeRoles.length === 0) {
        errors.push(`knowledge/current-state.json:${personId}: keine am Stichtag aktive Rolle.`);
      }
    }
  }

  for (const item of allEntries) {
    if (
      item.status === 'confirmed-official' ||
      item.status === 'confirmed-primary' ||
      item.status === 'editorially-confirmed'
    ) {
      if (item.validFrom && item.validFrom > item.asOf && !item.tags?.includes('future')) {
        errors.push(`${item.file}:${item.id}: als bestätigt geführt, obwohl validFrom nach asOf liegt.`);
      }
      if (
        item.type !== 'timeline-event' &&
        item.validTo &&
        item.validTo < item.asOf &&
        !item.tags?.includes('historical')
      ) {
        errors.push(`${item.file}:${item.id}: als aktuell bestätigt geführt, obwohl validTo vor asOf liegt.`);
      }
    }
  }

  if (compareGenerated) {
    const generated = generateOutputs(model);
    for (const [relativePath, expected] of Object.entries(generated)) {
      const absolute = path.join(root, relativePath);
      if (!fs.existsSync(absolute)) {
        errors.push(`${relativePath}: generierte Datei fehlt.`);
      } else if (fs.readFileSync(absolute, 'utf8') !== expected) {
        errors.push(`${relativePath}: weicht vom generierten Stand ab. npm run knowledge:build ausführen.`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Knowledge-Check fehlgeschlagen (${errors.length} Fehler):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function validateHoldingPositions(document, sourceIds, errors) {
  const file = 'knowledge/holding-positions.json';
  walkDates(document, file, errors);
  if (!Array.isArray(document.positionFields) || document.positionFields.length === 0) {
    errors.push(`${file}: positionFields muss ein nicht leeres Array sein.`);
    return;
  }
  if (!Array.isArray(document.portfolios)) {
    errors.push(`${file}: portfolios muss ein Array sein.`);
    return;
  }

  const keyIndex = document.positionFields.indexOf('key');
  const nameIndex = document.positionFields.indexOf('name');
  const levelIndex = document.positionFields.indexOf('level');
  const cutoffStatusIndex = document.positionFields.indexOf('cutoffStatus');
  const currentStatusIndex = document.positionFields.indexOf('currentStatus');
  const locatorIndex = document.positionFields.indexOf('sourceLocator');
  for (const [field, index] of Object.entries({ key: keyIndex, name: nameIndex, level: levelIndex, cutoffStatus: cutoffStatusIndex, currentStatus: currentStatusIndex, sourceLocator: locatorIndex })) {
    if (index < 0) errors.push(`${file}: Pflichtspalte ${field} fehlt.`);
  }

  const allowedLevels = new Set(['direct', 'indirect', 'second-degree']);
  const allowedCutoffStatuses = new Set(['active', 'liquidation', 'scheduled-liquidation', 'insolvency']);
  const allowedCurrentStatuses = new Set(['active', 'liquidation', 'insolvency', 'succeeded-to-off']);
  const keys = new Set();
  let rowCount = 0;
  let directCount = 0;
  let liquidationCount = 0;

  for (const [portfolioIndex, portfolio] of document.portfolios.entries()) {
    const location = `${file}.portfolios[${portfolioIndex}]`;
    if (!portfolio.id || !portfolio.origin || !portfolio.cutoffMethod) {
      errors.push(`${location}: id, origin oder cutoffMethod fehlt.`);
    }
    if (!Array.isArray(portfolio.sourceIds) || portfolio.sourceIds.length === 0) {
      errors.push(`${location}: sourceIds muss ein nicht leeres Array sein.`);
    } else {
      for (const sourceId of portfolio.sourceIds) {
        if (!sourceIds.has(sourceId)) errors.push(`${location}: unbekannte Quelle ${sourceId}.`);
      }
    }
    if (!Array.isArray(portfolio.positions)) {
      errors.push(`${location}: positions muss ein Array sein.`);
      continue;
    }
    for (const [rowIndex, row] of portfolio.positions.entries()) {
      const rowLocation = `${location}.positions[${rowIndex}]`;
      if (!Array.isArray(row) || row.length !== document.positionFields.length) {
        errors.push(`${rowLocation}: Zeilenlänge stimmt nicht mit positionFields überein.`);
        continue;
      }
      rowCount += 1;
      const key = row[keyIndex];
      if (typeof key !== 'string' || !key || keys.has(key)) errors.push(`${rowLocation}: fehlender oder doppelter Schlüssel ${key}.`);
      keys.add(key);
      if (typeof row[nameIndex] !== 'string' || !row[nameIndex]) errors.push(`${rowLocation}: Name fehlt.`);
      if (!allowedLevels.has(row[levelIndex])) errors.push(`${rowLocation}: unbekannte Ebene ${row[levelIndex]}.`);
      if (row[levelIndex] === 'direct') directCount += 1;
      if (!allowedCutoffStatuses.has(row[cutoffStatusIndex])) errors.push(`${rowLocation}: unbekannter Stichtagsstatus ${row[cutoffStatusIndex]}.`);
      if (['liquidation', 'scheduled-liquidation', 'insolvency'].includes(row[cutoffStatusIndex])) liquidationCount += 1;
      if (!allowedCurrentStatuses.has(row[currentStatusIndex])) errors.push(`${rowLocation}: unbekannter aktueller Status ${row[currentStatusIndex]}.`);
      if (typeof row[locatorIndex] !== 'string' || !row[locatorIndex]) errors.push(`${rowLocation}: Quellenfundstelle fehlt.`);
    }
  }

  const expected = document.totals ?? {};
  const derived = {
    portfolioCount: document.portfolios.length,
    positionRows: rowCount,
    directRows: directCount,
    indirectAndSecondDegreeRows: rowCount - directCount,
    cutoffLiquidationOrInsolvencyRows: liquidationCount,
    consolidatedSharedPositions: document.consolidatedSharedPositions?.length ?? 0,
    explicitExclusions: document.exclusions?.length ?? 0,
  };
  for (const [key, value] of Object.entries(derived)) {
    if (expected[key] !== value) errors.push(`${file}.totals.${key}: erwartet ${value}, gefunden ${expected[key]}.`);
  }
}

function buildIndex(model) {
  const items = [];
  for (const source of model.sources) {
    items.push({
      id: source.id,
      title: source.title,
      type: 'source',
      aliases: [],
      tags: source.scope ?? [],
      validFrom: source.date ?? null,
      validTo: null,
      target: 'knowledge/sources.json',
    });
  }
  for (const collection of model.collections) {
    for (const entry of collection.entries) {
      items.push({
        id: entry.id,
        title: entry.title,
        type: collection.type,
        aliases: entry.aliases ?? entry.nameVariants ?? [],
        tags: entry.tags ?? [],
        validFrom: entry.validFrom ?? entry.date ?? null,
        validTo: entry.validTo ?? entry.date ?? null,
        target: collection.file,
      });
    }
  }
  const fields = model.holdingPositions.positionFields;
  const keyIndex = fields.indexOf('key');
  const nameIndex = fields.indexOf('name');
  for (const portfolio of model.holdingPositions.portfolios) {
    for (const row of portfolio.positions) {
      items.push({
        id: `holding-position-${row[keyIndex]}`,
        title: row[nameIndex],
        type: 'holding-position',
        aliases: [],
        tags: ['holding-position', portfolio.origin],
        validFrom: model.holdingPositions.inheritanceAt,
        validTo: null,
        target: 'knowledge/holding-positions.json',
      });
    }
  }
  items.sort((left, right) => left.id.localeCompare(right.id, 'de'));
  return stableJson({
    generatedAt: model.sourcesDoc.asOf,
    editorialAsOf: model.editorial.referenceDate,
    count: items.length,
    items,
  });
}

function buildContext(model) {
  const currentState = model.byType.get('current-state') ?? [];
  const persons = model.byType.get('person') ?? [];
  const projects = model.byType.get('project') ?? [];
  const holdings = model.byType.get('holding') ?? [];
  const proceedings = model.byType.get('proceeding') ?? [];
  const timeline = model.byType.get('timeline-event') ?? [];
  const questions = model.byType.get('open-question') ?? [];
  const parties = model.byType.get('party') ?? [];
  const territories = model.byType.get('territory') ?? [];
  const inventory = model.holdingPositions;

  const government = currentState.find((entry) => entry.id === 'state-current-government');
  const parliament = currentState.find((entry) => entry.id === 'state-current-parliament');
  const constitution = currentState.find((entry) => entry.id === 'state-current-constitution');
  const territoryState = currentState.find((entry) => entry.id === 'state-current-territory');

  const currentPeople = (government?.memberPersonIds ?? [])
    .map((id) => persons.find((person) => person.id === id))
    .filter(Boolean);
  const chief = persons.find((person) => person.id === government?.chiefOfChancelleryPersonId);

  const lines = [];
  lines.push('# Generierter Gesamtkontext');
  lines.push('');
  lines.push('> Diese Datei ist ein generierter Überblick. Für rechtliche Detailfragen sind die verknüpften Primärquellen und Normfassungen maßgeblich.');
  lines.push('');
  lines.push(`**Redaktioneller Stand:** ${model.editorial.referenceDate}`);
  lines.push('');
  lines.push('## Quellenregeln');
  lines.push('');
  lines.push('Verkündete Normen und amtliche Primärquellen haben Vorrang. Gesprächswissen steht ausschließlich in `conversation-candidates.json`. Ankündigung, Beschluss, Wirksamkeit und praktische Umsetzung werden getrennt. Externe Wikiangaben sind nur aus dem PolitikSim-Wiki auf Miraheze und nur mit konkreter Revision zulässig.');
  lines.push('');
  lines.push('## Aktueller Staatsaufbau');
  lines.push('');
  lines.push('Der Freistaat wird am Stichtag durch Volkskammer, Staatsrat, Staatspräsident, Verfassungsgerichtshof und Rechnungshof geprägt. Die obersten Geschäftsbereiche werden als Staatssekretariate geführt. Historische Bezeichnungen bleiben in den Entitäten mit Gültigkeitszeiträumen erhalten.');
  lines.push('');
  lines.push('## Aktueller Staatsrat');
  lines.push('');
  for (const person of currentPeople) {
    const activeRoles = (person.roles ?? []).filter((role) => {
      const date = government.asOf;
      return (!role.validFrom || role.validFrom <= date) && (!role.validTo || role.validTo >= date);
    });
    lines.push(`- **${person.title}:** ${activeRoles.map((role) => role.officeTitle).join('; ')}`);
  }
  if (chief) {
    const activeRoles = (chief.roles ?? []).filter((role) => !role.validTo || role.validTo >= government.asOf);
    lines.push(`- **${chief.title}:** ${activeRoles.map((role) => role.officeTitle).join('; ')}`);
  }
  lines.push('');
  lines.push('## Parteien und Mehrheiten');
  lines.push('');
  lines.push(`${parliament?.legislature}: Koalition aus ${parties.filter((party) => parliament?.coalitionPartyIds?.includes(party.id)).map((party) => party.title).join(' und ')}, ${parliament?.coalitionSeats} von ${parliament?.totalSeats} Sitzen seit ${parliament?.seatCountAsOf}. Bundesparteiname und ostdeutsche Listenbezeichnungen der DEMOS werden getrennt mit ihrem jeweiligen Zeit- und Wahlbezug geführt.`);
  lines.push('');
  lines.push('## Geltende Verfassungsfassung');
  lines.push('');
  lines.push(`\`${constitution?.normSlug}\`, Version \`${constitution?.versionId}\`. Sie berücksichtigt alle vier Gesetze zur Großen Staatsreform und gilt seit 21. Juli 2026.`);
  lines.push('');
  lines.push('## Gebiet');
  lines.push('');
  const currentDistricts = (territoryState?.currentDistrictIds ?? []).map((id) => territories.find((item) => item.id === id)?.title).filter(Boolean);
  const historicalDistricts = (territoryState?.historicalDistrictIds ?? []).map((id) => territories.find((item) => item.id === id)?.title).filter(Boolean);
  lines.push(`Am Stichtag bestehen vierzehn Bezirke: ${currentDistricts.join(', ')}. Die mit Ablauf des 31. Juli 2026 aufgehobenen Flächenbezirke werden als historischer Gebietsstand geführt: ${historicalDistricts.join(', ')}.`);
  lines.push('');
  lines.push('## Zentrale Gesetzes- und Projektkomplexe');
  lines.push('');
  for (const project of projects.filter((item) => !['unverified'].includes(item.status))) {
    lines.push(`- **${project.title}**: ${project.projectStage}. ${project.summary}`);
  }
  lines.push('');
  lines.push('## Öffentliche Wirtschaft und Beteiligungen');
  lines.push('');
  const succession = holdings.find((item) => item.id === 'holding-rechtsnachfolge-2023');
  if (succession) {
    lines.push(succession.summary);
    lines.push('');
  }
  lines.push(`Die strukturierte Stichtagsinventur enthält ${inventory.totals.positionRows} belegte Positionszeilen: ${inventory.totals.directRows} unmittelbare sowie ${inventory.totals.indirectAndSecondDegreeRows} mittelbare oder tieferliegende Positionen. ${inventory.totals.cutoffLiquidationOrInsolvencyRows} Zeilen waren am Ausgangsstichtag bereits in Liquidation, zur Auflösung bestimmt oder insolvent. Mehrländerpositionen werden in ${inventory.totals.consolidatedSharedPositions} konsolidierten Datensätzen zusammengeführt; ${inventory.totals.explicitExclusions} spätere Realentwicklungen sind ausdrücklich ausgeschlossen.`);
  lines.push('');
  for (const holding of holdings.filter((item) => item.tags?.includes('key-holding') && item.id !== 'holding-rechtsnachfolge-2023')) {
    lines.push(`- **${holding.title}**: ${holding.summary}`);
  }
  lines.push('');
  lines.push('## Wichtigste historische Ereignisse');
  lines.push('');
  for (const event of [...timeline].sort((a, b) => a.date.localeCompare(b.date)).slice(-10)) {
    lines.push(`- **${event.date}: ${event.title}.** ${event.summary}`);
  }
  lines.push('');
  lines.push('## Laufende Verfahren und Abhängigkeiten');
  lines.push('');
  for (const proceeding of proceedings.filter((item) => !['completed'].includes(item.stage))) {
    lines.push(`- **${proceeding.title}** (${proceeding.stage ?? proceeding.status}): ${proceeding.summary}`);
  }
  lines.push('');
  lines.push('## Bekannte Konflikte und offene Fragen');
  lines.push('');
  for (const question of questions.filter((item) => ['high', 'medium'].includes(item.priority)).slice(0, 12)) {
    lines.push(`- **${question.title}**: ${question.reason}`);
  }
  lines.push('');
  lines.push('## Detaildateien');
  lines.push('');
  lines.push('- Quellen und Hierarchie: `knowledge/SOURCE_POLICY.md`, `knowledge/sources.json`');
  lines.push('- Aktueller Stand: `knowledge/current-state.json`');
  lines.push('- Personen, Institutionen, Parteien und Gebiete: `knowledge/entities/`');
  lines.push('- Ereignisse: `knowledge/timeline.json`');
  lines.push('- Projektverbünde: `knowledge/projects.json`');
  lines.push('- Beteiligungen und öffentliche Wirtschafts- und Vermögensträger: `knowledge/holdings.json`');
  lines.push('- Vollinventur der unmittelbaren und mittelbaren Positionen: `knowledge/holding-positions.json`');
  lines.push('- Verfahren: `knowledge/proceedings.json`');
  lines.push('- Offene Fragen: `knowledge/open-questions.json`');
  lines.push('- Nur Gesprächswissen: `knowledge/conversation-candidates.json`');
  lines.push('- Suchindex: `knowledge/generated/INDEX.json`');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function generateOutputs(model) {
  return {
    'knowledge/generated/INDEX.json': buildIndex(model),
    'knowledge/generated/LLM_CONTEXT.md': buildContext(model),
  };
}

function writeGenerated(model) {
  fs.mkdirSync(generatedDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(generateOutputs(model))) {
    fs.writeFileSync(path.join(root, relativePath), content, 'utf8');
  }
}

const command = process.argv[2] ?? 'check';
if (!['check', 'build'].includes(command)) {
  console.error('Verwendung: node scripts/knowledge.mjs <check|build>');
  process.exit(2);
}

const model = loadModel();
if (command === 'build') {
  if (validateModel(model, false)) {
    writeGenerated(model);
    const reloaded = loadModel();
    if (validateModel(reloaded, true)) {
      console.log('Knowledge-Build erfolgreich.');
    }
  }
} else if (validateModel(model, true)) {
  console.log('Knowledge-Check erfolgreich.');
}
