import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildNormAnchorMap,
  buildNormOutline,
  getResolvedBlockAnchorId,
} from '../src/lib/norms/presentation.ts';
import type { NormBodyBlock } from '../src/lib/norms/schema.ts';

const blocks: NormBodyBlock[] = [
  {
    type: 'part',
    label: 'Teil 1',
    title: 'Allgemeine Vorschriften',
    children: [
      {
        type: 'section',
        label: 'Abschnitt 1',
        title: 'Grundlagen',
        children: [
          {
            type: 'subsection',
            label: 'Unterabschnitt 1',
            children: [
              {
                type: 'paragraph',
                label: '§ 1',
                title: 'Geltungsbereich',
                children: [{ type: 'paragraphText', text: 'Diese Vorschrift gilt.' }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: 'section',
    label: 'Abschnitt 1',
    children: [
      {
        type: 'paragraph',
        label: '§ 2',
        children: [{ type: 'paragraphText', text: 'Weitere Regelung.' }],
      },
    ],
  },
  {
    type: 'quotedProvision',
    children: [
      {
        type: 'section',
        label: 'Abschnitt 1',
        title: 'Zitierte Gliederung',
        children: [
          {
            type: 'paragraph',
            label: '§ 1',
            title: 'Zitierte Vorschrift',
            children: [{ type: 'paragraphText', text: 'Erstes Zitat.' }],
          },
        ],
      },
    ],
  },
  {
    type: 'quotedProvision',
    children: [
      {
        type: 'paragraph',
        label: '§ 1',
        title: 'Weitere zitierte Vorschrift',
        children: [{ type: 'paragraphText', text: 'Zweites Zitat.' }],
      },
    ],
  },
];

test('Abschnittsnummer, Titel, Unterabschnitt und Paragraph bilden eine gemeinsame Gliederung', () => {
  const outline = buildNormOutline(blocks);
  assert.equal(outline[0].label, 'Teil 1');
  assert.equal(outline[0].title, 'Allgemeine Vorschriften');
  assert.equal(outline[0].children[0].label, 'Abschnitt 1');
  assert.equal(outline[0].children[0].title, 'Grundlagen');
  assert.equal(outline[0].children[0].children[0].label, 'Unterabschnitt 1');
  assert.equal(outline[0].children[0].children[0].title, 'Unterabschnitt 1');
  assert.equal(outline[0].children[0].children[0].children[0].label, '§ 1');
  assert.equal(outline[0].children[0].children[0].children[0].title, 'Geltungsbereich');
});

test('Inhaltsübersicht und Renderer verwenden dieselben eindeutigen Anker', () => {
  const anchors = buildNormAnchorMap(blocks);
  const outlineAnchors: string[] = [];
  const collect = (items: ReturnType<typeof buildNormOutline>) => {
    for (const item of items) {
      outlineAnchors.push(item.anchor);
      collect(item.children);
    }
  };
  collect(buildNormOutline(blocks));

  assert.equal(outlineAnchors[0], getResolvedBlockAnchorId(anchors, [0], blocks[0]));
  assert.equal(
    outlineAnchors[1],
    getResolvedBlockAnchorId(anchors, [0, 0], blocks[0].children?.[0] as NormBodyBlock),
  );
  assert.equal(new Set(anchors.values()).size, anchors.size);
  assert.ok(outlineAnchors.every((anchor) => [...anchors.values()].includes(anchor)));
  assert.notEqual(
    getResolvedBlockAnchorId(anchors, [0, 0], blocks[0].children?.[0] as NormBodyBlock),
    getResolvedBlockAnchorId(anchors, [1], blocks[1]),
  );
});

test('zitierte Vorschriften erhalten einen eigenen kollisionsfreien Namensraum', () => {
  const anchors = buildNormAnchorMap(blocks);
  const firstQuote = getResolvedBlockAnchorId(
    anchors,
    [2, 0, 0],
    blocks[2].children?.[0].children?.[0] as NormBodyBlock,
    'zitat',
  );
  const secondQuote = getResolvedBlockAnchorId(
    anchors,
    [3, 0],
    blocks[3].children?.[0] as NormBodyBlock,
    'zitat',
  );

  assert.match(firstQuote, /^zitat-paragraph-1/u);
  assert.match(secondQuote, /^zitat-paragraph-1/u);
  assert.notEqual(firstQuote, secondQuote);
  assert.ok(!JSON.stringify(buildNormOutline(blocks)).includes('Zitierte Vorschrift'));
});

test('NormBody bindet aria-labelledby an tatsächlich gerenderte Überschriften', () => {
  const component = readFileSync(
    new URL('../src/components/norms/NormBody.astro', import.meta.url),
    'utf8',
  );

  assert.match(component, /aria-labelledby=\{headingId\}/u);
  assert.match(component, /<HeadingTag id=\{headingId\} class="norm-division__heading">/u);
  assert.match(component, /<HeadingTag id=\{headingId\} class="norm-unit__heading">/u);
  assert.match(component, /<HeadingTag id=\{headingId\} class="norm-quoted-unit__heading">/u);
  assert.doesNotMatch(component, /const childHeadingLevel = block\.title/u);
});
