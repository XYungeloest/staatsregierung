import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { lawSubjects } from '@ostrecht/shared/config/law-subjects.ts';
import { lawSiteConfig } from '@ostrecht/shared/config/site.ts';
import { getNormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';
import { getGermanIndexLetter } from '@ostrecht/shared/lib/norms/routes.ts';
import type { NormBodyBlock, NormRecord } from '@ostrecht/shared/lib/norms/schema.ts';
import { getNormLastActivityDate, getNormLastChangeDate } from '@ostrecht/shared/lib/norms/versions.ts';
import { isAmendmentRecord } from '@ostrecht/recht-search/search.ts';

import { fixtureRoleSlugs, isSyntheticFixture, readFixtureManifest } from '../scripts/lib/runtime-fixture.mjs';
import { buildFixtureManifest, FIXTURE_REFERENCE_DATE, FIXTURE_ROLES, FIXTURE_SEARCH, fixtureCorpus } from './helpers/fixture-corpus.ts';

/**
 * Das D1-Testfixture der Browser-, Barrierefreiheits- und Screenshot-Tests ist die Ausgabe des
 * Builders tests/helpers/fixture-corpus.ts; data/recht/runtime-fixture.json ist sein committetes
 * Manifest. Dieser Test hält beide gleich und prüft laufzeitunabhängig, dass der Bestand jede
 * Rolle erfüllt, auf die sich die Specs verlassen – fehlt eine Rolle, wird das Fixture ergänzt,
 * nicht der Test abgeschwächt.
 */
const MANIFEST_PATH = 'data/recht/runtime-fixture.json';
const REGENERATE = 'node --experimental-strip-types --input-type=module -e "import(\'./scripts/lib/runtime-fixture.mjs\').then((m) => m.writeFixtureManifest())"';
const ABBR_PATTERN = /^[A-Za-zÄÖÜäöü][\wÄÖÜäöüß-]{3,}$/u;

const { norms, publications, topics, pressReleases } = fixtureCorpus();
const bySlug = new Map(norms.map((norm) => [norm.meta.slug, norm]));
const roleNorm = (role: keyof typeof FIXTURE_ROLES): NormRecord => {
  const norm = bySlug.get(FIXTURE_ROLES[role]);
  assert.ok(norm, `Rolle ${role}: Slug ${FIXTURE_ROLES[role]} fehlt im Bestand`);
  return norm;
};
const origin = (role: keyof typeof FIXTURE_ROLES) => getNormOriginInfo(roleNorm(role), norms).kind;
const currentTitles = norms.filter((norm) => norm.meta.status === 'in-force' && !isAmendmentRecord(norm)).map((norm) => norm.meta.title);
const blocksOf = (norm: NormRecord): NormBodyBlock[] => {
  const found: NormBodyBlock[] = [];
  const visit = (blocks: NormBodyBlock[]) => {
    for (const block of blocks) {
      found.push(block);
      if (block.children) visit(block.children);
    }
  };
  for (const version of norm.versions) visit(version.body);
  return found;
};

test('das committete Manifest ist die Ausgabe des Builders', async () => {
  const committed = JSON.parse(readFileSync(new URL(`../${MANIFEST_PATH}`, import.meta.url), 'utf8'));
  assert.deepEqual(committed, buildFixtureManifest(), `${MANIFEST_PATH} weicht vom Builder ab; neu schreiben mit: ${REGENERATE}`);
  const manifest = await readFixtureManifest(process.cwd(), MANIFEST_PATH);
  assert.equal(isSyntheticFixture(manifest), true);
  for (const slug of fixtureRoleSlugs(manifest)) assert.ok(bySlug.has(slug), `Rollen-Slug ${slug} fehlt im Bestand`);
  for (const [role, versions] of Object.entries(manifest.versions)) {
    const norm = bySlug.get(manifest.roles[role][0]);
    assert.ok(norm, `Fassungsrolle ${role}: Norm fehlt`);
    for (const [kind, versionId] of Object.entries(versions)) assert.ok(norm.versions.some((version) => version.versionId === versionId), `Fassung ${role}.${kind} = ${versionId} fehlt`);
  }
  const issues = new Set(publications.map((publication) => publication.slug));
  for (const [role, slugs] of Object.entries(manifest.publications)) for (const slug of slugs) assert.ok(issues.has(slug), `Verkündungsrolle ${role}: Ausgabe ${slug} fehlt`);
});

test('jede Rolle ist im Bestand erfüllt', () => {
  assert.equal(`/norm/${FIXTURE_ROLES.constitution}/`, lawSiteConfig.paths.constitution, 'die Verfassung liegt unter der konfigurierten Adresse (Weiterleitung /verfassung/)');
  assert.ok(roleNorm('multi-version').versions.length >= 3, 'eine Norm mit mindestens drei Fassungen');
  assert.equal(origin('inherited-amended'), 'inherited-amended');
  assert.equal(origin('inherited-unchanged'), 'inherited-unchanged');
  assert.equal(origin('inherited-unchanged-letter-g'), 'inherited-unchanged');
  assert.equal(getGermanIndexLetter(roleNorm('inherited-unchanged-letter-g').meta.title), 'G', 'A–Z mit Herkunftsfilter unter G');
  assert.equal(origin('ostdeutsch-original'), 'ostdeutsch-original');
  assert.equal(origin('origin-unresolved'), 'origin-unresolved');
  const inheritedAmendmentAct = roleNorm('inherited-amendment-act');
  assert.equal(inheritedAmendmentAct.meta.type, 'aenderungsvorschrift');
  assert.ok(inheritedAmendmentAct.versions.some((version) => (version.sourceReferences ?? []).some((reference) => reference.availability === 'r2-archived')), 'übernommene Änderungsvorschrift mit R2-archivierter Quelle');
  assert.equal(roleNorm('amendment-act').meta.type, 'aenderungsvorschrift');
  assert.equal(roleNorm('repealed').meta.status, 'repealed');
  assert.equal(roleNorm('historical').meta.status, 'historical');
  const future = roleNorm('future-effective');
  assert.equal(future.meta.status, 'future-effective');
  assert.ok(future.versions.every((version) => version.validFrom > FIXTURE_REFERENCE_DATE), 'die künftige Norm bleibt künftig');
  assert.ok(roleNorm('envelope-article').meta.containedIn, 'Mantelbestandteil mit containedIn');
  assert.equal(roleNorm('envelope-article').meta.containedIn, FIXTURE_ROLES.envelope);
  assert.equal(roleNorm('foerderrichtlinie').meta.type, 'foerderrichtlinie');
  assert.equal(roleNorm('zustimmungsgesetz').meta.type, 'zustimmungsgesetz');
  assert.equal(roleNorm('staatsvertrag').meta.type, 'staatsvertrag');
  assert.equal(roleNorm('verwaltungsvorschrift').meta.type, 'verwaltungsvorschrift');
  const notice = roleNorm('bekanntmachung');
  assert.equal(notice.meta.type, 'bekanntmachung');
  assert.ok(notice.versions.length >= 2, 'Bekanntmachung mit zwei Fassungen');

  // Tabelle mit Kopfzellen, die ausschließlich Spalten bezeichnen (Browser-Smoke Normtabellen).
  const tables = blocksOf(roleNorm('norm-table')).filter((block) => block.type === 'table');
  assert.ok(tables.length > 0, 'Norm mit Tabelle');
  const headerCells = blocksOf(roleNorm('norm-table')).filter((block) => block.type === 'tableHeaderCell');
  assert.ok(headerCells.length > 0 && headerCells.every((cell) => cell.scope === 'col'));

  // Reiner Hinweis: jüngste Aktivität nach der jüngsten Rechtsänderung (Sitemap lastmod vs. Sortierung).
  const noticeOnly = roleNorm('notice-only');
  assert.ok(noticeOnly.history.entries.some((entry) => entry.type === 'notice'));
  assert.ok((getNormLastActivityDate(noticeOnly, FIXTURE_REFERENCE_DATE) ?? '') > (getNormLastChangeDate(noticeOnly, FIXTURE_REFERENCE_DATE) ?? ''));

  // Portalbezüge: Themen und Pressemitteilungen nennen die Norm der Rolle portal-relations.
  assert.ok(topics.some((topic) => (topic.rechtsgrundlagen ?? []).some((reference) => reference.normSlug === FIXTURE_ROLES['portal-relations'])));
  assert.ok(pressReleases.some((release) => (release.relatedNormSlugs ?? []).includes(FIXTURE_ROLES['portal-relations'])));
  for (const topic of topics) for (const reference of topic.rechtsgrundlagen ?? []) assert.ok(bySlug.has(reference.normSlug ?? ''), `Thema ${topic.slug}: Normbezug ${reference.normSlug} fehlt`);
  for (const release of pressReleases) for (const slug of release.relatedNormSlugs ?? []) assert.ok(bySlug.has(slug), `Presse ${release.slug}: Normbezug ${slug} fehlt`);

  // Verkündungen: mehrere Ausgaben (Übersichten, Ausgabenfilter), jeder Eintrag zeigt auf eine gespeicherte Fassung.
  assert.ok(publications.length >= 3);
  for (const publication of publications) {
    for (const entry of publication.entries) {
      const norm = bySlug.get(entry.normSlug ?? '');
      assert.ok(norm, `${publication.slug}: Eintrag ${entry.id} nennt eine fremde Norm ${entry.normSlug}`);
      assert.ok(norm.versions.some((version) => version.versionId === entry.versionId), `${publication.slug}: Eintrag ${entry.id} nennt eine fremde Fassung ${entry.versionId}`);
    }
  }
});

test('Suchwörter, Abkürzungen, Kurztitel und Sachgebiete tragen die Specs', () => {
  const titled = (word: string) => currentTitles.filter((title) => title.includes(word));
  assert.ok(titled(FIXTURE_SEARCH['multi-hit']).length >= 2, 'multi-hit trifft mehrere geltende Vorschriften ohne Änderungsbezug');
  assert.ok(roleNorm('ostdeutsch-original').meta.title.includes(FIXTURE_SEARCH['ostdeutsch-original']));
  assert.ok(roleNorm('inherited-unchanged').meta.title.includes(FIXTURE_SEARCH['inherited-unchanged']));
  assert.equal(norms.filter((norm) => norm.meta.title.includes(FIXTURE_SEARCH['inherited-unchanged'])).length, 1, 'der Freitextfilter der Rechtsentwicklung findet genau die übernommene, unveränderte Norm');

  const abbrs = norms.map((norm) => norm.meta.abbr).filter((abbr): abbr is string => Boolean(abbr));
  assert.equal(new Set(abbrs).size, abbrs.length, 'Abkürzungen sind eindeutig');
  assert.equal(new Set(norms.map((norm) => norm.meta.shortTitle)).size, norms.length, 'Kurztitel sind eindeutig');
  assert.ok(norms.some((norm) => norm.meta.type === 'gesetz' && norm.meta.status === 'in-force' && /^[A-Za-zÄÖÜäöü]{4,}$/u.test(norm.meta.abbr ?? '')), 'ein geltendes Gesetz mit reiner Buchstabenabkürzung (Vorschlagsliste)');
  assert.ok(norms.filter((norm) => ABBR_PATTERN.test(norm.meta.abbr ?? '')).length >= 4, 'genügend eindeutige Abkürzungen für die Standardsuche');
  assert.ok(norms.filter((norm) => (getNormLastChangeDate(norm, FIXTURE_REFERENCE_DATE) ?? '') <= FIXTURE_REFERENCE_DATE && getNormLastChangeDate(norm, FIXTURE_REFERENCE_DATE)).length > 6, 'mehr als sechs Normen mit Rechtsänderung bis zum Stichtag (Übersichten, Sitemap)');

  const configured = new Set(lawSubjects.map((subject) => subject.title));
  for (const norm of norms) for (const subject of norm.meta.subjects) assert.ok(configured.has(subject), `${norm.meta.slug}: Sachgebiet „${subject}“ steht nicht in der amtlichen Systematik`);
});

test('der Builder bleibt außerhalb des Projektionsabschlusses', () => {
  const importOfFixture = /(?:from\s+['"][^'"]*|import\(\s*['"][^'"]*)(?:runtime-fixture\.mjs|fixture-corpus)/u;
  for (const file of ['scripts/sync-recht-d1.mjs', 'scripts/lib/d1-sync-scope.mjs', 'scripts/lib/d1-projection-proof-format.mjs', 'scripts/lib/d1-projection-fingerprint.mjs', 'scripts/lib/d1-projection-closure.mjs']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!importOfFixture.test(source), `${file} darf weder scripts/lib/runtime-fixture.mjs noch tests/helpers/fixture-corpus.ts importieren`);
  }
  const loader = readFileSync(new URL('../scripts/lib/runtime-fixture.mjs', import.meta.url), 'utf8');
  assert.match(loader, /import\('\.\.\/\.\.\/tests\/helpers\/fixture-corpus\.ts'\)/u, 'der Lader importiert den Builder mit literalem Spezifizierer');
});
