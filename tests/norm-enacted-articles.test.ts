import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDerivedContext, deriveNorm } from '@ostrecht/shared/lib/norms/derived.ts';
import { buildVersionComparison } from '@ostrecht/shared/lib/norms/diff.ts';
import { buildNormOutline } from '@ostrecht/shared/lib/norms/display.ts';
import {
  enactedNormReferences,
  findEnactedArticles,
  presentEnactedArticles,
  presentEnactedVersions,
  type EnactedNormReference,
} from '@ostrecht/shared/lib/norms/enacted-articles.ts';
import { buildNormAnchorMap } from '@ostrecht/shared/lib/norms/presentation.ts';
import { getNormUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import type { NormBodyBlock } from '@ostrecht/shared/lib/norms/schema.ts';

import { flattenNormBody } from '../apps/recht/src/lib/pdf/layout.ts';
import { FIXTURE_REFERENCE_DATE, buildEnactingActFixture } from './helpers/fixture-corpus.ts';

/**
 * Einführungsartikel als Verweis (REVOSax-Darstellung): Ein Artikel, der ein eigenes, als eigene
 * Vorschrift geführtes Gesetz einführt, zeigt statt des Zitats die Bezeichnung des eingeführten
 * Gesetzes als allgemeinen Normlink; Änderungsartikel bleiben Volltext; die Zuordnung ist
 * fail-closed. Geprüft am synthetischen Einführungsgesetz aus tests/helpers/fixture-corpus.ts.
 */

const records = buildEnactingActFixture();
const act = records.find((entry) => entry.meta.slug === 'testeinfuehrungsgesetz')!;
const body = act.versions[0].body;
const context = buildDerivedContext({ norms: records, publications: [], asOf: FIXTURE_REFERENCE_DATE });
const enacted = enactedNormReferences(deriveNorm(act, context).relations);

function articleByLabel(blocks: NormBodyBlock[], label: string): NormBodyBlock {
  const found = blocks.find((block) => block.type === 'article' && block.label === label);
  assert.ok(found, `${label} fehlt`);
  return found;
}

function hasQuote(block: NormBodyBlock): boolean {
  return (block.children ?? []).some((child) => child.type === 'quotedProvision' || hasQuote(child));
}

test('eingeführte Vorschriften stammen aus den Beziehungen beider Richtungen, je Vorschrift einmal', () => {
  assert.deepEqual(enacted.map((entry) => entry.slug).sort(), ['testaufsichtsgesetz', 'testpruefgesetz', 'testregistergesetz']);
  assert.deepEqual(enactedNormReferences([
    { kind: 'enacts', slug: 'a', title: 'A', shortTitle: '' },
    { kind: 'enacts', slug: 'a', title: 'A', shortTitle: '' },
    { kind: 'amends', slug: 'b', title: 'B', shortTitle: '' },
  ]).map((entry) => entry.slug), ['a']);
  assert.deepEqual(enactedNormReferences(undefined), []);
});

test('jeder Einführungsartikel wird genau seinem Gesetz zugeordnet, Änderungen und Neufassungen nicht', () => {
  const found = findEnactedArticles(body, enacted);
  const byLabel = new Map(found.map((entry) => [body[entry.path[0]].label, entry]));
  assert.deepEqual([...byLabel.keys()].sort(), ['Artikel 1', 'Artikel 2', 'Artikel 3']);
  assert.equal(byLabel.get('Artikel 1')?.slug, 'testpruefgesetz');
  assert.equal(byLabel.get('Artikel 2')?.slug, 'testregistergesetz');
  assert.equal(byLabel.get('Artikel 3')?.slug, 'testaufsichtsgesetz');
  // Bezeichnung im Wortlaut der Vorschrift samt Kurztitel und Abkürzung.
  assert.equal(byLabel.get('Artikel 1')?.text, 'Gesetz über die Prüfung von Testvorhaben (Testprüfgesetz – TestPrG)');
  assert.equal(byLabel.get('Artikel 1')?.placement, 'body');
  assert.equal(byLabel.get('Artikel 2')?.placement, 'heading');
  assert.equal(byLabel.get('Artikel 3')?.placement, 'body');
});

test('Darstellung wie REVOSax: nur Artikelbezeichnung und Gesetzestitel als Verweis, ohne Einleitungssatz und Zitat', () => {
  const presented = presentEnactedArticles(body, enacted);
  const first = articleByLabel(presented.body, 'Artikel 1');
  assert.equal(hasQuote(first), false);
  // Der Einleitungssatz („Das nachstehende wird Gesetz:“) entfällt mit dem Zitat.
  assert.deepEqual(first.children?.map((child) => child.text), ['Gesetz über die Prüfung von Testvorhaben (Testprüfgesetz – TestPrG)']);
  assert.equal(presented.links.get(first.children![0]), getNormUrl('testpruefgesetz'));
  assert.equal(first.title, 'Einführung eines Testprüfgesetzes');

  const second = articleByLabel(presented.body, 'Artikel 2');
  assert.deepEqual(second.children, []);
  assert.equal(presented.links.get(second), getNormUrl('testregistergesetz'));
  assert.equal(second.title, 'Gesetz über das Testregister (Testregistergesetz – TestRegG)');

  // Die Einleitungszeile mit dem Gesetzestitel bleibt als einzige Zeile und wird selbst zum Verweis.
  const third = articleByLabel(presented.body, 'Artikel 3');
  assert.deepEqual(third.children?.map((child) => child.text), ['Gesetz über die Aufsicht über Testvorhaben (Testaufsichtsgesetz – TestAufsG)']);
  assert.equal(presented.links.get(third.children![0]), getNormUrl('testaufsichtsgesetz'));

  // Änderungsbefehle und die Neufassung eines nicht eingeführten Gesetzes bleiben unverändert dieselben Objekte.
  assert.equal(articleByLabel(presented.body, 'Artikel 4'), articleByLabel(body, 'Artikel 4'));
  assert.equal(articleByLabel(presented.body, 'Artikel 5'), articleByLabel(body, 'Artikel 5'));
  assert.equal(presented.body[0], body[0]);
  // Der gespeicherte Normkörper bleibt unberührt.
  assert.ok(hasQuote(articleByLabel(body, 'Artikel 1')));

  // Gliederung: Artikel mit eingeführtem Titel, keine Einheiten aus dem Zitat.
  const outline = buildNormOutline(presented.body, buildNormAnchorMap(body));
  assert.deepEqual(outline.map((item) => item.label), ['Artikel 1', 'Artikel 2', 'Artikel 3', 'Artikel 4', 'Artikel 5', 'Artikel 6']);
  assert.equal(outline[1].title, 'Gesetz über das Testregister (Testregistergesetz – TestRegG)');
  assert.ok(outline.every((item) => item.children.length === 0));
});

const STRUCTURAL = new Set<NormBodyBlock['type']>(['part', 'chapter', 'section', 'subsection', 'paragraph', 'article', 'annex']);

/** Indexpfade aller verankerten Blöcke (Gliederungseinheiten, auch in Zitaten). */
function anchoredPaths(blocks: NormBodyBlock[], path: number[] = []): Array<{ key: string; block: NormBodyBlock }> {
  return blocks.flatMap((block, index) => {
    const current = [...path, index];
    const own = STRUCTURAL.has(block.type) ? [{ key: current.join('.'), block }] : [];
    return [...own, ...anchoredPaths(block.children ?? [], current)];
  });
}

function blockAt(blocks: NormBodyBlock[], key: string): NormBodyBlock | undefined {
  let entries: NormBodyBlock[] | undefined = blocks;
  let found: NormBodyBlock | undefined;
  for (const index of key.split('.').map(Number)) {
    found = entries?.[index];
    entries = found?.children;
  }
  return found;
}

test('Sprungmarken bleiben stabil: die Ankertabelle des gespeicherten Körpers gilt für den dargestellten', () => {
  const presented = presentEnactedArticles(body, enacted);
  const stored = buildNormAnchorMap(body);

  // Jeder verankerte Block der Darstellung steht im gespeicherten Körper am selben Indexpfad.
  const shown = anchoredPaths(presented.body);
  assert.ok(shown.length > 6);
  for (const { key, block } of shown) {
    const original = blockAt(body, key);
    assert.equal(original?.type, block.type, key);
    assert.equal(original?.label, block.label, key);
    assert.ok(stored.has(key), key);
  }

  // Volltext-Zitat nach einem eingekürzten Zitat: Artikel 5 zitiert § 1 wie Artikel 1. Im
  // gespeicherten Körper trägt es das Kollisionssuffix; eine Ankertabelle aus dem dargestellten
  // Körper würde es auf den Basisanker vorrücken lassen (Sprungmarke zeigte auf eine andere Stelle).
  const fifth = body.findIndex((block) => block.label === 'Artikel 5');
  const quotedFirst = shown.find(({ key, block }) => key.startsWith(`${fifth}.`) && block.label === '§ 1');
  assert.ok(quotedFirst);
  assert.match(stored.get(quotedFirst.key)!, /^zitat-paragraph-1--/u);
  assert.equal(buildNormAnchorMap(presented.body).get(quotedFirst.key), 'zitat-paragraph-1');
  for (const { key } of shown.filter((entry) => entry.key.startsWith(`${fifth}.`))) {
    assert.match(stored.get(key)!, /^(artikel-5|zitat-.+--.+)$/u, key);
  }

  // Gliederung mit derselben Tabelle: Anker wie im gespeicherten Körper.
  assert.deepEqual(buildNormOutline(presented.body, stored).map((item) => item.anchor), buildNormOutline(body).map((item) => item.anchor));
});

test('fail-closed: Mehrdeutigkeit, fehlende Beziehung oder abweichende Form lassen den Volltext stehen', () => {
  // Ohne Beziehung „führt ein“ keine Zuordnung.
  assert.deepEqual(findEnactedArticles(body, []), []);
  assert.equal(presentEnactedArticles(body, []).body, body);

  // Zwei Artikel mit demselben eingeführten Gesetz: keiner wird eingekürzt.
  const doubled = [articleByLabel(body, 'Artikel 1'), { ...articleByLabel(body, 'Artikel 1'), label: 'Artikel 1a' }];
  assert.deepEqual(findEnactedArticles(doubled, enacted.filter((entry) => entry.slug === 'testpruefgesetz')), []);

  // Text nach dem Zitat (zum Beispiel eine Maßgabe) verhindert die Kürzung.
  const withTrailer: NormBodyBlock = { ...articleByLabel(body, 'Artikel 1'), children: [...articleByLabel(body, 'Artikel 1').children!, { type: 'paragraphText', text: 'Maßgabe zum Inkrafttreten.' }] };
  assert.deepEqual(findEnactedArticles([withTrailer], enacted), []);

  // Ein Titel, der nur mit demselben Wortanfang beginnt, ist kein Treffer.
  const similar: EnactedNormReference[] = [{ slug: 'x', title: 'Gesetz über die Prüfung von Testvorhab' }, { slug: 'y', title: 'Anderes Gesetz ohne Bezug' }];
  assert.deepEqual(findEnactedArticles(body, similar), []);
});

test('eindeutige Zuordnung ohne Titeltreffer nur bei genau einem Gesetz und genau einem Zitatartikel', () => {
  const single: EnactedNormReference[] = [{ slug: 'testordnung', title: 'Ordnung über Testabläufe', shortTitle: 'Testablaufordnung' }];
  const onlyNew = [articleByLabel(body, 'Artikel 5'), articleByLabel(body, 'Artikel 6')];
  const [match] = findEnactedArticles(onlyNew, single);
  assert.equal(match?.slug, 'testordnung');
  assert.equal(match?.placement, 'body');
  // Der Zitatkopf trägt die Bezeichnung.
  assert.equal(match?.text, 'Testordnung (TestO)');
  // Zwei Artikel mit ganzen Zitaten: keine eindeutige Zuordnung.
  assert.deepEqual(findEnactedArticles([articleByLabel(body, 'Artikel 2'), articleByLabel(body, 'Artikel 5')], single), []);
  // Ohne Artikeltitel und Einleitung wird die Bezeichnung zum Artikeltitel; sonst Titel und Kurztitel der Beziehung.
  const untitled: NormBodyBlock = { type: 'article', label: 'Artikel 1', children: [{ type: 'quotedProvision', children: articleByLabel(body, 'Artikel 2').children![0].children }] };
  assert.deepEqual(findEnactedArticles([untitled], single).map(({ placement, text }) => ({ placement, text })), [{ placement: 'heading', text: 'Ordnung über Testabläufe (Testablaufordnung)' }]);
  // Gespeicherter Titel weicht vom Zitatkopf ab (Präfix „Besonderes“): kein Titeltreffer, die
  // eindeutige Zuordnung greift und die Bezeichnung folgt dem Wortlaut des Zitatkopfs.
  const prefixed: EnactedNormReference[] = [{ slug: 'testgleichheitsgesetz', title: 'Besonderes Gesetz zur Förderung der Testgleichheit', shortTitle: 'Testgleichheitsgesetz' }];
  const prefixedArticle: NormBodyBlock = {
    type: 'article', label: 'Artikel 1', title: 'Einführung eines Testgleichheitsgesetzes',
    children: [{ type: 'paragraphText', text: 'Das nachstehende wird Gesetz:' }, { type: 'quotedProvision', children: [{ type: 'paragraphText', text: '„Gesetz zur Förderung der Testgleichheit (Testgleichheitsgesetz – TestGlG)' }, ...articleByLabel(body, 'Artikel 2').children![0].children!] }],
  };
  const [prefixedMatch] = findEnactedArticles([prefixedArticle, articleByLabel(body, 'Artikel 6')], prefixed);
  assert.deepEqual(prefixedMatch && { slug: prefixedMatch.slug, placement: prefixedMatch.placement, text: prefixedMatch.text }, { slug: 'testgleichheitsgesetz', placement: 'body', text: 'Gesetz zur Förderung der Testgleichheit (Testgleichheitsgesetz – TestGlG)' });
  assert.deepEqual(articleByLabel(presentEnactedArticles([prefixedArticle], prefixed).body, 'Artikel 1').children?.map((child) => child.text), ['Gesetz zur Förderung der Testgleichheit (Testgleichheitsgesetz – TestGlG)']);
  // Ein Zitat mit nur einer Einheit genügt der eindeutigen Zuordnung nicht.
  const oneUnit: NormBodyBlock = { type: 'article', label: 'Artikel 1', title: 'Neufassung', children: [{ type: 'quotedProvision', children: [{ type: 'paragraph', label: '§ 9', title: 'Testregel', children: [] }] }] };
  assert.deepEqual(findEnactedArticles([oneUnit], single), []);
});

test('PDF und Fassungsvergleich arbeiten auf demselben dargestellten Normkörper', () => {
  // Die PDF kennt keine Verweise: unter der Bezeichnung steht die absolute Adresse des Stammeintrags.
  const address = (slug: string): string => `https://recht.example.test/norm/${slug}/`;
  const presented = presentEnactedArticles(body, enacted, { hrefFor: address, addressLine: true });
  const pdfLines = flattenNormBody(presented.body).map((paragraph) => paragraph.text);
  const pdfText = pdfLines.join('\n');
  const designation = pdfLines.indexOf('Gesetz über die Prüfung von Testvorhaben (Testprüfgesetz – TestPrG)');
  assert.ok(designation >= 0);
  assert.equal(pdfLines[designation + 1], address('testpruefgesetz'));
  assert.ok(pdfLines.includes(address('testregistergesetz')));
  assert.doesNotMatch(pdfText, /Das Testprüfgesetz regelt den Testzweck/u);
  assert.doesNotMatch(pdfText, /Das nachstehende wird Gesetz/u);
  assert.match(pdfText, /Testvorhaben werden nach dem Testprüfgesetz geprüft/u);
  // Ohne Adresszeile (Bildschirm) steht keine Adresse im Normtext.
  assert.ok(!flattenNormBody(presentEnactedArticles(body, enacted).body).some((paragraph) => paragraph.text.startsWith('http')));

  const version = act.versions[0];
  const changed = structuredClone(version);
  changed.versionId = '2026-07-01';
  changed.validFrom = '2026-07-01';
  const quote = changed.body[1].children![1];
  quote.children![1].children![0].children![0].text = 'Das Testprüfgesetz regelt den geänderten Testzweck.';
  const [from, to] = presentEnactedVersions([version, changed], enacted);
  const comparison = buildVersionComparison(from, to);
  assert.equal(comparison.provisions.filter((entry) => entry.kind !== 'unchanged').length, 0);
  // Ohne Darstellung zeigte der Vergleich die Änderung im Zitat.
  assert.ok(buildVersionComparison(version, changed).provisions.some((entry) => entry.kind !== 'unchanged'));
});

test('der Verweis ist der allgemeine, dynamische Normlink', () => {
  const hrefs = [...presentEnactedArticles(body, enacted).links.values()];
  assert.deepEqual(hrefs.sort(), ['testaufsichtsgesetz', 'testpruefgesetz', 'testregistergesetz'].map((slug) => getNormUrl(slug)).sort());
  assert.ok(hrefs.every((href) => !href.includes('/version/')));
  // Andere Linkbildung (zum Beispiel für Tests oder andere Origins) bleibt möglich.
  assert.deepEqual([...presentEnactedArticles(body, enacted, { hrefFor: (slug) => `#${slug}` }).links.values()].sort(), ['#testaufsichtsgesetz', '#testpruefgesetz', '#testregistergesetz']);
});

test('Anführungszeichen: nur Randzeichen ohne Gegenstück entfallen, Titel mit geschlossenem Zitat bleiben vollständig', () => {
  const quotedTitle = 'Gesetz zur Errichtung der Testanstalt „Muster Anstalt“';
  const single: EnactedNormReference[] = [{ slug: 'testanstaltsgesetz', title: quotedTitle, shortTitle: 'Muster-Gesetz' }];
  const units = articleByLabel(body, 'Artikel 2').children![0].children!;
  // Titel als Artikeltitel: das schließende Zeichen gehört zum Titel.
  const asHeading: NormBodyBlock = { type: 'article', label: 'Artikel 1', title: quotedTitle, children: [{ type: 'quotedProvision', children: units }] };
  assert.equal(findEnactedArticles([asHeading], single)[0]?.text, quotedTitle);
  // Ersatzregel ohne Zitatkopf: Titel und Kurztitel der Stammnorm, Zeichen vollständig.
  const untitled: NormBodyBlock = { type: 'article', label: 'Artikel 1', children: [{ type: 'quotedProvision', children: units }] };
  assert.equal(findEnactedArticles([untitled], single)[0]?.text, `${quotedTitle} (Muster-Gesetz)`);
  // Zitatkopf mit öffnendem Zeichen des umgebenden Zitats: nur dieses entfällt.
  const withHead: NormBodyBlock = { type: 'article', label: 'Artikel 1', title: 'Einführung', children: [{ type: 'quotedProvision', children: [{ type: 'paragraphText', text: `„${quotedTitle}` }, ...units] }] };
  assert.equal(findEnactedArticles([withHead], single)[0]?.text, quotedTitle);
  // Ein ganz umschließendes Paar entfällt.
  const enclosed: NormBodyBlock = { type: 'article', label: 'Artikel 1', title: 'Einführung', children: [{ type: 'paragraphText', text: `„${quotedTitle}“` }, { type: 'quotedProvision', children: units }] };
  assert.equal(findEnactedArticles([enclosed], single)[0]?.text, quotedTitle);
});

test('Einführungsartikel in einer Anlage tragen den Verweis ebenso', () => {
  const annexed: NormBodyBlock[] = [{ type: 'annex', label: 'Anlage', title: 'Einführungsbestimmungen', children: [articleByLabel(body, 'Artikel 2')] }];
  const presented = presentEnactedArticles(annexed, enacted);
  const article = presented.body[0].children![0];
  assert.equal(presented.links.get(article), getNormUrl('testregistergesetz'));
  assert.deepEqual(article.children, []);
});
