import assert from 'node:assert/strict';
import test from 'node:test';

import { collectBodyContent } from '@ostrecht/recht-search/search.ts';
import { buildProvisionVersionDiff } from '@ostrecht/shared/lib/norms/diff.ts';
import { renderNormDiffDocument } from '@ostrecht/shared/lib/norms/diff-render.ts';
import { parseNormVersion, ContentValidationError } from '@ostrecht/shared/lib/norms/schema.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

/**
 * Der Unterschriftenblock trägt Unterzeichner:in (text), Amtsbezeichnung (title) und
 * wahlweise Ort und Datum (label). Er steht unter dem Normtext, ist aber keine Regelung:
 * Er bildet keine Fundstelle, wird nicht durchsucht und trägt keine Textverweise.
 */
const signatureBody: NormBodyBlock[] = [
  {
    type: 'paragraph',
    label: '§ 1',
    title: 'Zweck',
    children: [{ type: 'paragraphText', text: 'Diese Vorschrift regelt den Prüffall.' }],
  },
  { type: 'signature', text: 'Alex Beispiel', title: 'Der Ministerpräsident' },
];

function version(body: NormBodyBlock[]) {
  return {
    versionId: '2026-01-01',
    validFrom: '2026-01-01',
    validTo: null,
    isCurrent: true,
    citation: 'Prüfvorschrift vom 1. Januar 2026 (OGVBl. 2026 Nr. 1)',
    changeNote: 'Stammfassung.',
    body,
  };
}

test('ein Unterschriftenblock wird geprüft und lässt keine Untergliederung zu', () => {
  const parsed = parseNormVersion(version(signatureBody), 'pruefnorm/versions/2026-01-01.json');
  assert.equal(parsed.body.at(-1)?.type, 'signature');
  assert.equal(parsed.body.at(-1)?.text, 'Alex Beispiel');
  assert.equal(parsed.body.at(-1)?.title, 'Der Ministerpräsident');
  assert.throws(
    () => parseNormVersion(version([{ type: 'signature', text: 'A', children: [{ type: 'paragraphText', text: 'x' }] }]), 'p/v.json'),
    ContentValidationError,
  );
  assert.throws(
    () => parseNormVersion(version([{ type: 'signature' } as NormBodyBlock]), 'p/v.json'),
    ContentValidationError,
  );
});

test('Unterschriften bilden keine Fundstelle und stehen nicht im Suchtext', () => {
  const collected = collectBodyContent(signatureBody);
  assert.equal(collected.hitUnits.length, 1);
  assert.equal(collected.hitUnits[0].label, '§ 1');
  assert.doesNotMatch(collected.hitUnits[0].text, /Ministerpräsident|Alex Beispiel/u);
  assert.doesNotMatch(collected.supplementalTextParts.join('\n'), /Ministerpräsident|Alex Beispiel/u);
});

test('der Fassungsvergleich erkennt eine geänderte Unterschrift und stellt sie dar', () => {
  const before = version(signatureBody);
  const after = version([
    signatureBody[0],
    { type: 'signature', text: 'Kim Muster', title: 'Die Staatsministerin des Innern' },
  ]);
  const diffs = buildProvisionVersionDiff(before, after);
  const signature = diffs.find((entry) => entry.type === 'signature');
  assert.ok(signature, 'Unterschriftenblock fehlt im Vergleich');
  assert.equal(signature.kind, 'changed');
  const html = renderNormDiffDocument(diffs, '2026-01-01', '2026-02-01');
  assert.match(html, /norm-signature__name/u);
  assert.match(html, /Kim Muster/u);
  assert.match(html, /Alex Beispiel/u);
});
