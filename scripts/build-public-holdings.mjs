#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const sourcePath = resolve(root, 'knowledge', 'holding-positions.json');
const outputPath = resolve(root, 'content', 'regierung', 'beteiligungsinventar.json');
const checkOnly = process.argv.includes('--check');

const allowedPositionFields = [
  'key',
  'name',
  'origin',
  'level',
  'parent',
  'parentKey',
  'relation',
  'stakePercent',
  'effectivePublicPercent',
  'currentStakePercent',
  'consolidatedInheritedPercent',
  'currentConsolidatedPercent',
  'consolidatedPosition',
  'legalForm',
  'legalFormGroup',
  'cutoffStatus',
  'currentStatus',
  'change2023To2026',
];

const forbiddenPublicFields = new Set([
  'confidence',
  'cutoffMethod',
  'detailsSource',
  'inventorySource',
  'locator',
  'note',
  'notes',
  'path',
  'sourceId',
  'sourceIds',
  'sourceLocator',
  'sourceRefs',
]);

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replaceAll('ß', 'ss')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function normalizeName(value) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('de-DE');
}

function normalizeLegalForm(value) {
  const form = value.trim();
  if (form === 'GmbH') return 'GmbH';
  if (form === 'gGmbH') return 'gGmbH';
  if (form === 'AG') return 'AG';
  if (form === 'AöR') return 'AöR';
  if (form === 'GmbH & Co. KG') return 'GmbH & Co. KG';
  if (form === 'KG' || form === 'GbR') return 'Sonstige Personengesellschaft';
  if (form === 'eG') return 'Genossenschaft';
  if (form === 'Stiftung') return 'Stiftung';
  if (form === 'KdöR') return 'Körperschaft des öffentlichen Rechts';
  if (form === 'Eigenbetrieb') return 'Landes- oder Eigenbetrieb';
  if (form === 'SE') return 'Europäische Gesellschaft';
  return 'Sonstige öffentliche Position';
}

function expectObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} muss ein Objekt sein.`);
  }
  return value;
}

function expectArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} muss eine Liste sein.`);
  return value;
}

function expectString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} muss ein nichtleerer String sein.`);
  }
  return value;
}

function expectNullablePercent(value, label) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} muss eine Zahl zwischen 0 und 100 oder null sein.`);
  }
  return value;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedCountEntries(map) {
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'de'))
    .map(([value, count]) => ({ value, count }));
}

function assertNoForbiddenFields(value, path = 'projection') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFields(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenPublicFields.has(key)) {
      throw new Error(`${path}.${key} ist kein freigegebenes öffentliches Feld.`);
    }
    assertNoForbiddenFields(entry, `${path}.${key}`);
  }
}

function buildProjection(source) {
  const inventory = expectObject(source, 'holding-positions.json');
  const positionFields = expectArray(inventory.positionFields, 'positionFields');
  const fieldIndex = Object.fromEntries(positionFields.map((field, index) => [field, index]));
  const requiredFields = [
    'key',
    'name',
    'level',
    'parent',
    'relation',
    'stakePercent',
    'effectivePublicPercent',
    'legalForm',
    'cutoffStatus',
    'currentStatus',
    'currentStakePercent',
    'change2023To2026',
  ];
  for (const field of requiredFields) {
    if (!Number.isInteger(fieldIndex[field])) throw new Error(`Pflichtspalte ${field} fehlt.`);
  }

  const sharedPositions = expectArray(inventory.consolidatedSharedPositions, 'consolidatedSharedPositions')
    .map((raw, index) => {
      const entry = expectObject(raw, `consolidatedSharedPositions[${index}]`);
      const name = expectString(entry.name, `consolidatedSharedPositions[${index}].name`);
      return {
        key: `shared-${slugify(name)}`,
        name,
        relation: expectString(entry.relation, `consolidatedSharedPositions[${index}].relation`),
        inheritedPercent: expectNullablePercent(entry.inheritedPercent, `consolidatedSharedPositions[${index}].inheritedPercent`),
        currentPercent: expectNullablePercent(entry.currentPercent, `consolidatedSharedPositions[${index}].currentPercent`),
        components: expectArray(entry.components, `consolidatedSharedPositions[${index}].components`)
          .map((component, componentIndex) => expectString(component, `consolidatedSharedPositions[${index}].components[${componentIndex}]`)),
        status: expectString(entry.status, `consolidatedSharedPositions[${index}].status`),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'de'));
  const sharedByName = new Map(sharedPositions.map((entry) => [normalizeName(entry.name), entry]));

  const projectedPositions = [];
  const originTotals = [];
  for (const [portfolioIndex, rawPortfolio] of expectArray(inventory.portfolios, 'portfolios').entries()) {
    const portfolio = expectObject(rawPortfolio, `portfolios[${portfolioIndex}]`);
    const origin = expectString(portfolio.origin, `portfolios[${portfolioIndex}].origin`);
    const rows = expectArray(portfolio.positions, `portfolios[${portfolioIndex}].positions`);
    const nameToKeys = new Map();

    for (const [rowIndex, rawRow] of rows.entries()) {
      const row = expectArray(rawRow, `portfolios[${portfolioIndex}].positions[${rowIndex}]`);
      if (row.length !== positionFields.length) {
        throw new Error(`Positionszeile ${origin}/${rowIndex} hat ${row.length} statt ${positionFields.length} Spalten.`);
      }
      const name = expectString(row[fieldIndex.name], `${origin}/${rowIndex}.name`);
      const key = expectString(row[fieldIndex.key], `${origin}/${rowIndex}.key`);
      const normalized = normalizeName(name);
      nameToKeys.set(normalized, [...(nameToKeys.get(normalized) ?? []), key]);
    }

    let direct = 0;
    let indirectOrDeeper = 0;
    for (const [rowIndex, rawRow] of rows.entries()) {
      const row = expectArray(rawRow, `portfolios[${portfolioIndex}].positions[${rowIndex}]`);
      const key = expectString(row[fieldIndex.key], `${origin}/${rowIndex}.key`);
      const name = expectString(row[fieldIndex.name], `${origin}/${rowIndex}.name`);
      const level = expectString(row[fieldIndex.level], `${origin}/${rowIndex}.level`);
      const relation = expectString(row[fieldIndex.relation], `${origin}/${rowIndex}.relation`);
      const legalForm = expectString(row[fieldIndex.legalForm], `${origin}/${rowIndex}.legalForm`);
      const parent = row[fieldIndex.parent] === null
        ? null
        : expectString(row[fieldIndex.parent], `${origin}/${rowIndex}.parent`);
      const parentCandidates = parent ? nameToKeys.get(normalizeName(parent)) ?? [] : [];
      const shared = sharedByName.get(normalizeName(name));

      if (level === 'direct') direct += 1;
      else indirectOrDeeper += 1;

      const projected = {
        key,
        name,
        origin,
        level,
        parent,
        parentKey: parentCandidates.length === 1 ? parentCandidates[0] : null,
        relation,
        stakePercent: expectNullablePercent(row[fieldIndex.stakePercent], `${origin}/${rowIndex}.stakePercent`),
        effectivePublicPercent: expectNullablePercent(row[fieldIndex.effectivePublicPercent], `${origin}/${rowIndex}.effectivePublicPercent`),
        currentStakePercent: expectNullablePercent(row[fieldIndex.currentStakePercent], `${origin}/${rowIndex}.currentStakePercent`),
        consolidatedInheritedPercent: shared?.inheritedPercent ?? null,
        currentConsolidatedPercent: shared?.currentPercent ?? null,
        consolidatedPosition: Boolean(shared),
        legalForm,
        legalFormGroup: normalizeLegalForm(legalForm),
        cutoffStatus: expectString(row[fieldIndex.cutoffStatus], `${origin}/${rowIndex}.cutoffStatus`),
        currentStatus: expectString(row[fieldIndex.currentStatus], `${origin}/${rowIndex}.currentStatus`),
        change2023To2026: row[fieldIndex.change2023To2026] === null
          ? null
          : expectString(row[fieldIndex.change2023To2026], `${origin}/${rowIndex}.change2023To2026`),
      };

      if (!allowedPositionFields.every((field) => Object.hasOwn(projected, field)) || Object.keys(projected).some((field) => !allowedPositionFields.includes(field))) {
        throw new Error(`Öffentliche Positionsprojektion ${key} enthält eine unerwartete Feldmenge.`);
      }
      projectedPositions.push(projected);
    }

    originTotals.push({ origin, total: rows.length, direct, indirectOrDeeper });
  }

  projectedPositions.sort((left, right) => left.key.localeCompare(right.key, 'de'));
  const keys = new Set();
  const names = new Set();
  const legalFormGroups = new Map();
  const relations = new Map();
  const cutoffStatuses = new Map();
  const currentStatuses = new Map();
  let direct = 0;
  let indirect = 0;
  let secondDegree = 0;

  for (const position of projectedPositions) {
    if (keys.has(position.key)) throw new Error(`Doppelter Positionsschlüssel: ${position.key}`);
    keys.add(position.key);
    names.add(position.name);
    increment(legalFormGroups, position.legalFormGroup);
    increment(relations, position.relation);
    increment(cutoffStatuses, position.cutoffStatus);
    increment(currentStatuses, position.currentStatus);
    if (position.level === 'direct') direct += 1;
    if (position.level === 'indirect') indirect += 1;
    if (position.level === 'second-degree') secondDegree += 1;
  }

  for (const position of projectedPositions) {
    if (position.parentKey && !keys.has(position.parentKey)) {
      throw new Error(`${position.key}.parentKey verweist auf eine fehlende öffentliche Position.`);
    }
  }

  const sourceTotals = expectObject(inventory.totals, 'totals');
  if (projectedPositions.length !== sourceTotals.positionRows) {
    throw new Error(`Öffentliche Projektion enthält ${projectedPositions.length} statt ${sourceTotals.positionRows} Positionszeilen.`);
  }
  if (direct + indirect + secondDegree !== projectedPositions.length) {
    throw new Error('Direkte und mittelbare Beteiligungsstufen ergeben nicht die Gesamtzahl.');
  }
  if (direct !== sourceTotals.directRows || indirect + secondDegree !== sourceTotals.indirectAndSecondDegreeRows) {
    throw new Error('Die Beteiligungsstufen weichen von den kanonischen Inventarsummen ab.');
  }

  const projection = {
    schemaVersion: 1,
    title: 'Beteiligungs- und Trägerbestand des Freistaates Ostdeutschland',
    description: 'Öffentlich belegte unmittelbare und mittelbare Beteiligungs-, Träger-, Mitgliedschafts- und Vermögenspositionen mit Ausgangsstichtag 1. Dezember 2023.',
    asOf: expectString(inventory.asOf, 'asOf'),
    inheritanceDate: expectString(inventory.inheritanceAt, 'inheritanceAt'),
    totals: {
      positionRows: projectedPositions.length,
      distinctNames: names.size,
      directRows: direct,
      indirectRows: indirect,
      secondDegreeRows: secondDegree,
      indirectAndSecondDegreeRows: indirect + secondDegree,
      originTotals,
      legalFormGroups: sortedCountEntries(legalFormGroups),
      relations: sortedCountEntries(relations),
      cutoffStatuses: sortedCountEntries(cutoffStatuses),
      currentStatuses: sortedCountEntries(currentStatuses),
      sharedPositions: sharedPositions.length,
    },
    positions: projectedPositions,
    sharedPositions,
  };

  assertNoForbiddenFields(projection);
  const serialized = JSON.stringify(projection);
  if (/knowledge\//u.test(serialized) || /"source-[a-z0-9-]+"/u.test(serialized)) {
    throw new Error('Die öffentliche Projektion enthält einen internen Wissens- oder Quellenverweis.');
  }
  return projection;
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const projection = buildProjection(source);
const output = `${JSON.stringify(projection, null, 2)}\n`;

if (checkOnly) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  if (existing !== output) {
    throw new Error('content/regierung/beteiligungsinventar.json ist nicht aktuell. Bitte npm run holdings:build ausführen.');
  }
  console.log(`Öffentliche Beteiligungsprojektion geprüft: ${projection.totals.positionRows} Positionen.`);
} else {
  await writeFile(outputPath, output, 'utf8');
  console.log(`Öffentliche Beteiligungsprojektion erstellt: ${projection.totals.positionRows} Positionen.`);
}

export { allowedPositionFields, buildProjection };
