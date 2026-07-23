import { createHash } from 'node:crypto';

export const CONSOLIDATION_OPERATIONS = [
  'replaceProvision',
  'replaceText',
  'insertProvisionBefore',
  'insertProvisionAfter',
  'insertParagraph',
  'repealProvision',
  'renameProvision',
  'renameLaw',
  'replaceHeading',
  'amendTable',
  'appendAnnex',
  'designationReplacement',
  'repealLaw',
];

export function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

export function sha256(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(canonicalJson(value));
  return createHash('sha256').update(serialized).digest('hex');
}

export function clone(value) {
  return structuredClone(value);
}

function walk(blocks, visitor, parent = null) {
  for (const [index, block] of blocks.entries()) {
    visitor(block, { parent, siblings: blocks, index });
    walk(block.children ?? [], visitor, block);
  }
}

function matchesTarget(block, target, parent) {
  return (!target.type || block.type === target.type) &&
    (!target.label || block.label === target.label) &&
    (!target.title || block.title === target.title) &&
    (!target.parentType || parent?.type === target.parentType) &&
    (!target.parentLabel || parent?.label === target.parentLabel);
}

function locateExactlyOne(body, target, operation) {
  const matches = [];
  walk(body, (block, location) => {
    if (matchesTarget(block, target, location.parent)) matches.push({ block, ...location });
  });
  if (matches.length !== 1) {
    throw new Error(`${operation}: Ziel ${JSON.stringify(target)} hat ${matches.length} statt genau einem Treffer`);
  }
  return matches[0];
}

function assertOperationContract(operation) {
  if (!CONSOLIDATION_OPERATIONS.includes(operation.op)) {
    throw new Error(`nicht unterstützte Konsolidierungsoperation: ${operation.op}`);
  }
  for (const field of ['source', 'sourceProvision', 'effectiveDate']) {
    if (!operation[field]) throw new Error(`${operation.op}: Pflichtfeld ${field} fehlt`);
  }
  if (operation.expectedMatches === undefined) {
    throw new Error(`${operation.op}: Pflichtfeld expectedMatches fehlt`);
  }
  if (!['renameLaw', 'repealLaw'].includes(operation.op) && !operation.target) {
    throw new Error(`${operation.op}: eindeutiger Zielanker fehlt`);
  }
  if (!operation.expectedHash && operation.expectedOld === undefined && operation.op !== 'renameLaw') {
    throw new Error(`${operation.op}: expectedHash oder expectedOld fehlt`);
  }
  if (!Number.isInteger(operation.expectedMatches) || operation.expectedMatches < 1) {
    throw new Error(`${operation.op}: expectedMatches muss mindestens 1 sein`);
  }
}

function assertExpectedBlock(block, operation) {
  if (operation.expectedHash && sha256(block) !== operation.expectedHash) {
    throw new Error(`${operation.op}: Zielhash weicht ab (${sha256(block)} statt ${operation.expectedHash})`);
  }
  if (operation.expectedOld !== undefined && operation.op !== 'designationReplacement') {
    const field = operation.field ?? 'text';
    if (block[field] !== operation.expectedOld) {
      throw new Error(`${operation.op}: erwarteter alter Wert in ${field} wurde nicht gefunden`);
    }
  }
}

function replaceInObject(value, oldText, newText) {
  let matches = 0;
  const visit = (entry) => {
    if (typeof entry === 'string') {
      const parts = entry.split(oldText);
      matches += parts.length - 1;
      return parts.join(newText);
    }
    if (Array.isArray(entry)) return entry.map(visit);
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.entries(entry).map(([key, child]) => [key, visit(child)]));
    }
    return entry;
  };
  return { value: visit(value), matches };
}

export function applyPatchRecipe(input, recipe) {
  const result = clone(input);
  if (!Array.isArray(recipe.operations) || recipe.operations.length === 0) {
    throw new Error(`${recipe.amendmentAct ?? 'Patch-Rezept'}: operations fehlt`);
  }

  for (const operation of recipe.operations) {
    assertOperationContract(operation);
    if (operation.effectiveDate !== recipe.effectiveDate) {
      throw new Error(`${operation.op}: Wirksamkeitsdatum weicht vom Rezept ab`);
    }

    if (operation.op === 'renameLaw') {
      if (operation.expectedMatches !== 1) {
        throw new Error('renameLaw: genau ein Titeltreffer ist erforderlich');
      }
      if (!operation.expectedOld || result.title !== operation.expectedOld) {
        throw new Error('renameLaw: erwarteter bisheriger Normtitel wurde nicht gefunden');
      }
      result.title = operation.value;
      continue;
    }
    if (operation.op === 'repealLaw') {
      if (operation.expectedMatches !== 1) {
        throw new Error('repealLaw: genau ein Normtreffer ist erforderlich');
      }
      const currentHash = sha256({ title: result.title, body: result.body });
      if (currentHash !== operation.expectedHash) {
        throw new Error(`repealLaw: Zielhash weicht ab (${currentHash} statt ${operation.expectedHash})`);
      }
      result.repealed = true;
      continue;
    }

    const location = locateExactlyOne(result.body, operation.target, operation.op);
    if (operation.op !== 'designationReplacement' && operation.expectedMatches !== 1) {
      throw new Error(`${operation.op}: genau ein Zieltreffer ist erforderlich`);
    }
    assertExpectedBlock(location.block, operation);

    if (operation.op === 'replaceProvision') {
      location.siblings.splice(location.index, 1, clone(operation.value));
    } else if (operation.op === 'insertProvisionBefore') {
      location.siblings.splice(location.index, 0, clone(operation.value));
    } else if (operation.op === 'insertProvisionAfter') {
      location.siblings.splice(location.index + 1, 0, clone(operation.value));
    } else if (operation.op === 'insertParagraph') {
      location.block.children ??= [];
      const index = operation.position === 'start' ? 0 : location.block.children.length;
      location.block.children.splice(index, 0, clone(operation.value));
    } else if (operation.op === 'repealProvision') {
      location.block.children = [{ type: 'paragraphText', text: operation.value ?? '(weggefallen)' }];
    } else if (operation.op === 'renameProvision') {
      location.block.label = operation.value;
    } else if (operation.op === 'replaceHeading') {
      location.block.title = operation.value;
    } else if (operation.op === 'amendTable') {
      if (location.block.type !== 'table') throw new Error('amendTable: Ziel ist keine Tabelle');
      location.siblings.splice(location.index, 1, clone(operation.value));
    } else if (operation.op === 'appendAnnex') {
      result.body.push(clone(operation.value));
    } else if (operation.op === 'replaceText') {
      const field = operation.field ?? 'text';
      location.block[field] = operation.value;
    } else if (operation.op === 'designationReplacement') {
      const replacement = replaceInObject(location.block, operation.expectedOld, operation.value);
      const expectedMatches = operation.expectedMatches ?? 1;
      if (replacement.matches !== expectedMatches) {
        throw new Error(`designationReplacement: ${replacement.matches} statt ${expectedMatches} Treffer`);
      }
      location.siblings.splice(location.index, 1, replacement.value);
    }
  }

  return result;
}

export function previousIsoDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
