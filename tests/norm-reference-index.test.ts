import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import {
  buildNormTextLinkReferences,
  buildRelatedNormRecommendationIndex,
  getRelatedNormRecommendations,
  selectMatchingTextLinkReferences,
} from '@ostrecht/shared/lib/norms/references.ts';
import { getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { renderLinkedDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';

test('Textverweise werden über den Präfixindex genauso gefunden wie beim Rendern', async () => {
  const norms = await loadAllNorms();
  const sample = norms.slice(0, 40);
  for (const norm of sample) {
    const references = buildNormTextLinkReferences(norms, norm.meta.slug);
    const texts = norm.versions.flatMap((version) => {
      const parts: string[] = [];
      const visit = (blocks: typeof version.body): void => {
        for (const block of blocks) {
          if (block.label) parts.push(block.label);
          if (block.title) parts.push(block.title);
          if (block.text) parts.push(block.text);
          if (block.children) visit(block.children);
        }
      };
      visit(version.body);
      return parts;
    });
    const matched = selectMatchingTextLinkReferences(references, texts);
    const matchedLabels = new Set(matched.map((reference) => reference.label));
    // Jeder beim Rendern erzeugte Link muss aus der Teilmenge stammen; die Teilmenge
    // darf keine Labels enthalten, die im Text nicht vorkommen.
    for (const text of texts) {
      const full = renderLinkedDisplayText(text, references);
      const subset = renderLinkedDisplayText(text, matched);
      assert.equal(subset, full, `${norm.meta.slug}: ${text.slice(0, 60)}`);
    }
    for (const reference of matched) {
      assert.ok(texts.some((text) => text.includes(reference.label)), `${norm.meta.slug}: ${reference.label}`);
    }
    void matchedLabels;
  }
});

test('Empfehlungsindex liefert dieselben Empfehlungen wie die paarweise Berechnung', async () => {
  const norms = await loadAllNorms();
  const index = buildRelatedNormRecommendationIndex(norms);
  // Die paarweise Berechnung ist O(n) je Norm; über den vollen Bestand (mehrere
  // tausend Normen) wäre der Vergleich quadratisch. Eine deterministische
  // Stichprobe über den ganzen Bestand genügt als Regressionsschutz.
  const step = Math.max(1, Math.ceil(norms.length / 60));
  for (const norm of norms.filter((_, position) => position % step === 0)) {
    const expected = getRelatedNormRecommendations(norm, norms).map((entry) => [entry.norm.meta.slug, entry.relation, entry.score]);
    const actual = (index.get(norm.meta.slug) ?? []).map((entry) => [entry.slug, entry.relation, entry.score]);
    assert.deepEqual(actual, expected, norm.meta.slug);
  }
  void getApplicableVersion;
});
