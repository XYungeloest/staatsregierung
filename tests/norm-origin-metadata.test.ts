import assert from 'node:assert/strict';
import test from 'node:test';

import { getNormOriginInfo, NORM_ORIGIN_KINDS, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';

import { loadNormsOnce } from './helpers/corpus.ts';

const SAXON_BODY = /Sächs|Sachsen/u;

/**
 * Dauerhafte Metadatenregel: `enactingBody` ist das erlassende Organ im ostdeutschen
 * Rechtsbestand, `originEnactingBody` das historische Ursprungsorgan der übernommenen Quelle.
 * Übernommene Normen dürfen deshalb kein sächsisches Organ als `enactingBody` tragen, eigenständig
 * geschaffene Normen kein sächsisches Ursprungsorgan.
 */
test('Herkunftsklassen und Erlassorgane widersprechen sich im Bestand nicht', async () => {
  const norms = await loadNormsOnce();
  const counts: Record<NormOriginKind, number> = { 'ostdeutsch-original': 0, 'inherited-unchanged': 0, 'inherited-amended': 0, 'origin-unresolved': 0 };
  const problems: string[] = [];
  for (const record of norms) {
    const origin = getNormOriginInfo(record, norms);
    counts[origin.kind] += 1;
    const enactingBody = record.meta.enactingBody ?? '';
    const originBody = record.meta.originEnactingBody ?? '';
    if (origin.kind.startsWith('inherited-') && SAXON_BODY.test(enactingBody)) {
      problems.push(`${record.meta.slug}: ${origin.kind} führt ein sächsisches Organ als enactingBody (${enactingBody})`);
    }
    if (origin.kind === 'ostdeutsch-original' && SAXON_BODY.test(originBody)) {
      problems.push(`${record.meta.slug}: ostdeutsch-original führt ein sächsisches Ursprungsorgan (${originBody})`);
    }
    if (origin.kind === 'ostdeutsch-original' && SAXON_BODY.test(enactingBody)) {
      problems.push(`${record.meta.slug}: ostdeutsch-original führt ein sächsisches Erlassorgan (${enactingBody})`);
    }
  }
  assert.deepEqual(problems, []);
  for (const kind of NORM_ORIGIN_KINDS) assert.ok(counts[kind] >= 0);
  assert.ok(counts['inherited-unchanged'] > 0 && counts['inherited-amended'] > 0 && counts['ostdeutsch-original'] > 0, JSON.stringify(counts));
});
