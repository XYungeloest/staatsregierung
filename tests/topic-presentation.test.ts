import assert from 'node:assert/strict';
import test from 'node:test';

import { parseThemenseite } from '../packages/shared/src/lib/portal/schema.ts';
import { formatTopicStatus } from '../packages/shared/src/lib/portal/presentation.ts';

const source = {
  slug: 'beispiel', title: 'Beispiel', teaser: 'Einführung', status: 'beschlossen',
  cluster: 'wirtschaft-arbeit', priority: 5, featured: false, updatedAt: '2026-01-01',
  beschlossen: [], umgesetzt: [], naechsteSchritte: [], faq: [],
  rechtsgrundlagen: [{ label: 'Beispielgesetz', normSlug: 'beispielgesetz' }],
  federfuehrendesRessort: 'wirtschaft', knowledgeProjectRefs: [],
};
const read = (extra: object = {}) => parseThemenseite({ ...source, ...extra }, 'Thema');

test('Themen behalten ihre Altform und prüfen Darstellungsvariante, Fachanwendung und Wirkungsbeleg', () => {
  assert.equal(read().pageType, 'compact');
  assert.equal(read({ pageType: 'dossier' }).pageType, 'dossier');
  assert.equal(read({ pageType: 'application', application: 'budget' }).application, 'budget');
  for (const extra of [{ pageType: 'application' }, { pageType: 'unbekannt' }, { pageType: 'compact', application: 'budget' }]) {
    assert.throws(() => read(extra));
  }
  const impact = { text: 'Eine belegte Auswirkung.', normSlug: 'beispielgesetz' };
  assert.deepEqual(read({ impacts: [impact] }).impacts, [impact]);
  assert.throws(() => read({ impacts: [{ ...impact, normSlug: 'unverknuepft' }] }), /Rechtsgrundlage fehlt/);
  const event = { kind: 'norm-effective', slug: 'beispielgesetz' };
  assert.deepEqual(read({ reportedEvents: [event] }).reportedEvents, [event]);
  assert.throws(() => read({ reportedEvents: [{ ...event, slug: 'unverknuepft' }] }), /Rechtsgrundlage fehlt/);
  const labels = ['beschlossen', 'verkuendet', 'in-kraft', 'im-vollzug', 'umgesetzt', 'abgeschlossen', 'eingestellt'].map((status) => formatTopicStatus(read({ status }).status));
  assert.equal(new Set(labels).size, labels.length);
});

test('Rechtsgruppen erfassen jede Quelle genau einmal und lösen nur redigierte Kennungen auf', () => {
  const legalGroups = [{ id: 'zugang', title: 'Zugang zur Leistung' }];
  const reference = { ...source.rechtsgrundlagen[0], group: 'zugang' };
  const dossier = { pageType: 'dossier', legalGroups };
  assert.equal(read({ ...dossier, rechtsgrundlagen: [reference] }).rechtsgrundlagen[0].group, 'zugang');
  assert.throws(() => read({ ...dossier, rechtsgrundlagen: [reference, reference] }), /doppelte Norm/);
  assert.throws(() => read(dossier), /Dossiergruppe/);
  assert.throws(() => read({ ...dossier, rechtsgrundlagen: [{ ...reference, group: 'unbekannt' }] }), /Dossiergruppe/);
  assert.throws(() => read({ legalGroups, rechtsgrundlagen: [reference] }), /Dossiergruppe/);
});
