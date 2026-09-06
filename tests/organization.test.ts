import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCabinetReshuffle,
  deriveCurrentGovernment,
  deriveGovernmentMember,
  deriveMinistry,
  getPersonOrganizationState,
  OrganizationValidationError,
  validateOrganization,
  type OrganizationData,
} from '@ostrecht/shared/lib/portal/organization.ts';
import type { MinisteriumProfil, RegierungProfil } from '@ostrecht/shared/lib/portal/schema.ts';

/**
 * Organisationsmodell auf einem synthetischen Bestand: zwei Regierungen, exklusive Ämter,
 * Ressortleitungen, Mehrfachämter und eine Leitung außerhalb der Regierung. Ob die realen
 * Organisationsdaten dem Snapshot entsprechen, prüft scripts/check-organization.ts in content:check.
 */
function person(slug: string, name: string): RegierungProfil {
  return { slug, name, kurzbiografie: `${name} im Testbestand.`, langbiografie: [], bild: `/images/${slug}.jpg` };
}

function ministry(slug: string, name: string): MinisteriumProfil {
  return { slug, name, kurzname: name, teaser: `${name} im Testbestand.`, aufgaben: [], kontakt: {}, bild: `/images/${slug}.jpg`, themen: [], verknuepfteLinks: [{ label: 'Organigramm', href: `/staatsregierung/kabinett/${slug}/organigramm/` }] };
}

function fixture(): { organization: OrganizationData; profiles: RegierungProfil[]; ministries: MinisteriumProfil[] } {
  const organization: OrganizationData = {
    governments: [
      { slug: 'kabinett-alt', title: 'Kabinett Alt', kind: 'cabinet', validFrom: '2025-01-01', validTo: '2026-06-30', coalition: 'Testkoalition', coalitionShort: 'Test', coalitionParties: ['A'], legislature: '1. Testlandtag', predecessor: null, seatOfGovernment: 'Teststadt', coalitionSeats: 10, parliamentSeats: 15, sourceRefs: ['test'] },
      { slug: 'staatsrat-neu', title: 'Staatsrat Neu', kind: 'state-council', validFrom: '2026-07-01', validTo: null, coalition: 'Testkoalition', coalitionShort: 'Test', coalitionParties: ['A', 'B'], legislature: '1. Testlandtag', predecessor: 'Kabinett Alt', seatOfGovernment: 'Teststadt', coalitionSeats: 11, parliamentSeats: 15, sourceRefs: ['test'] },
    ],
    offices: [
      { slug: 'praesident', label: 'Präsident', role: 'head', membership: 'member', exclusive: true, canLeadMinistry: false, requiresMinistry: false },
      { slug: 'stellvertretung', label: 'Stellvertretung', role: 'deputy', membership: 'member', exclusive: true, canLeadMinistry: true, requiresMinistry: true },
      { slug: 'mitglied', label: 'Mitglied', role: 'member', membership: 'member', exclusive: false, canLeadMinistry: true, requiresMinistry: true },
      { slug: 'amtschef', label: 'Amtschef', role: 'other', membership: 'leadership-outside', exclusive: false, canLeadMinistry: true, requiresMinistry: true },
    ],
    assignments: [
      { id: 'alt-emil-praesident', personSlug: 'emil-ende', officeSlug: 'praesident', ministrySlug: null, governmentSlug: 'kabinett-alt', title: 'Präsident', validFrom: '2025-01-01', validTo: '2026-06-30', sortOrder: 1, sourceRefs: ['test'] },
      { id: 'alt-fritz-finanzen', personSlug: 'fritz-falk', officeSlug: 'stellvertretung', ministrySlug: 'finanzen', governmentSlug: 'kabinett-alt', title: 'Stellvertreter und Finanzminister', validFrom: '2025-01-01', validTo: '2026-06-30', sortOrder: 2, sourceRefs: ['test'] },
      { id: 'alt-clara-umwelt', personSlug: 'clara-cordes', officeSlug: 'mitglied', ministrySlug: 'umwelt', governmentSlug: 'kabinett-alt', title: 'Umweltministerin', validFrom: '2025-01-01', validTo: '2026-06-30', sortOrder: 3, sourceRefs: ['test'] },
      { id: 'alt-clara-energie', personSlug: 'clara-cordes', officeSlug: 'mitglied', ministrySlug: 'energie', governmentSlug: 'kabinett-alt', title: 'Energieministerin', validFrom: '2025-01-01', validTo: '2026-06-30', sortOrder: 4, sourceRefs: ['test'] },
      { id: 'neu-anna-praesident', personSlug: 'anna-adler', officeSlug: 'praesident', ministrySlug: null, governmentSlug: 'staatsrat-neu', title: 'Präsidentin', validFrom: '2026-07-01', validTo: null, sortOrder: 1, sourceRefs: ['test'] },
      { id: 'neu-bernd-finanzen', personSlug: 'bernd-bach', officeSlug: 'stellvertretung', ministrySlug: 'finanzen', governmentSlug: 'staatsrat-neu', title: 'Stellvertreter und Staatsrat für Finanzen', validFrom: '2026-07-01', validTo: null, sortOrder: 2, sourceRefs: ['test'] },
      { id: 'neu-clara-umwelt', personSlug: 'clara-cordes', officeSlug: 'mitglied', ministrySlug: 'umwelt', governmentSlug: 'staatsrat-neu', title: 'Staatsrätin für Umwelt', validFrom: '2026-07-01', validTo: null, sortOrder: 3, sourceRefs: ['test'] },
      { id: 'neu-clara-energie', personSlug: 'clara-cordes', officeSlug: 'mitglied', ministrySlug: 'energie', governmentSlug: 'staatsrat-neu', title: 'Staatsrätin für Energie', validFrom: '2026-07-01', validTo: null, sortOrder: 4, sourceRefs: ['test'] },
      { id: 'dora-staatskanzlei', personSlug: 'dora-dahl', officeSlug: 'amtschef', ministrySlug: 'staatskanzlei', governmentSlug: null, title: 'Amtschefin der Staatskanzlei', validFrom: '2025-01-01', validTo: null, sortOrder: 9, sourceRefs: ['test'] },
    ],
  };
  const profiles = [person('anna-adler', 'Anna Adler'), person('bernd-bach', 'Bernd Bach'), person('clara-cordes', 'Clara Cordes'), person('dora-dahl', 'Dora Dahl'), person('emil-ende', 'Emil Ende'), person('fritz-falk', 'Fritz Falk')];
  const ministries = [ministry('staatskanzlei', 'Staatskanzlei'), ministry('finanzen', 'Staatssekretariat für Finanzen'), ministry('umwelt', 'Staatssekretariat für Umwelt'), ministry('energie', 'Staatssekretariat für Energie')];
  return { organization, profiles, ministries };
}

test('aktuelle, historische und künftige Regierungsstände werden zum Stichtag abgeleitet', () => {
  const { organization, profiles, ministries } = fixture();
  const historical = deriveCurrentGovernment(organization, profiles, ministries, '2026-06-01');
  const current = deriveCurrentGovernment(organization, profiles, ministries, '2026-08-01');
  assert.equal(historical.slug, 'kabinett-alt');
  assert.equal(historical.headPersonSlug, 'emil-ende');
  assert.equal(current.slug, 'staatsrat-neu');
  assert.equal(current.headPersonSlug, 'anna-adler');
  assert.equal(current.deputyPersonSlug, 'bernd-bach');
  assert.deepEqual(current.memberPersonSlugs, ['anna-adler', 'bernd-bach', 'clara-cordes']);

  const future = applyCabinetReshuffle(organization, profiles, ministries, {
    effectiveDate: '2026-09-01',
    governmentSlug: 'staatsrat-neu',
    summary: 'Testweise künftige Ressortübergabe',
    changes: [{ ministrySlug: 'umwelt', personSlug: 'bernd-bach', officeSlug: 'mitglied', title: 'Staatsrat für Umwelt', sortOrder: 5, sourceRefs: ['test'] }],
  });
  assert.equal(getPersonOrganizationState('clara-cordes', future.organization, '2026-08-31').activeAssignments.filter((entry) => entry.ministrySlug).length, 2);
  assert.equal(getPersonOrganizationState('clara-cordes', future.organization, '2026-09-01').activeAssignments.filter((entry) => entry.ministrySlug).length, 1);
  assert.equal(deriveMinistry(ministries[2], future.organization, profiles, '2026-09-01').leitung.includes('Bernd Bach'), true);
});

test('mehrere gleichzeitige Ämter und eine Leitung außerhalb der Regierung bleiben unterscheidbar', () => {
  const { organization, profiles, ministries } = fixture();
  const clara = getPersonOrganizationState('clara-cordes', organization, '2026-08-01');
  const dora = getPersonOrganizationState('dora-dahl', organization, '2026-08-01');
  assert.equal(clara.activeAssignments.filter((entry) => entry.ministrySlug).length, 2);
  assert.equal(clara.isGovernmentMember, true);
  assert.equal(dora.isActive, true);
  assert.equal(dora.isGovernmentMember, false);
  assert.equal(deriveGovernmentMember(profiles[3], organization, ministries, '2026-08-01').current, true);
  const fritz = deriveGovernmentMember(profiles[5], organization, ministries, '2026-08-01');
  assert.equal(fritz.current, false);
  assert.equal(fritz.servingTo, '2026-06-30');
});

test('Person, Ressort und Regierung werden aus denselben Zuordnungen konsistent abgeleitet', () => {
  const { organization, profiles, ministries } = fixture();
  const government = deriveCurrentGovernment(organization, profiles, ministries, '2026-08-01');
  const clara = deriveGovernmentMember(profiles[2], organization, ministries, '2026-08-01');
  const environment = deriveMinistry(ministries[2], organization, profiles, '2026-08-01');
  assert.ok(government.memberPersonSlugs.includes('clara-cordes'));
  assert.match(clara.ressort, /Umwelt/u);
  assert.match(clara.amt, /Umwelt.*Energie/u);
  assert.match(environment.leitung, /Clara Cordes/u);
  assert.deepEqual(environment.verknuepfteLinks[0], { label: 'Profil von Clara Cordes', href: '/staatsregierung/mitglieder/clara-cordes/' });
  assert.equal(ministries[2].verknuepfteLinks.some((link) => link.href.startsWith('/staatsregierung/mitglieder/')), false, 'Leitungslinks werden abgeleitet, nicht gepflegt');
});

test('fehlende Referenzen und ungültige Datumsintervalle werden abgewiesen', () => {
  const { organization, profiles, ministries } = fixture();
  const missingReference = structuredClone(organization);
  missingReference.assignments[0].personSlug = 'nicht-vorhanden';
  assert.throws(() => validateOrganization(missingReference, profiles, ministries), OrganizationValidationError);
  const invalidInterval = structuredClone(organization);
  invalidInterval.assignments[0].validTo = '2020-01-01';
  assert.throws(() => validateOrganization(invalidInterval, profiles, ministries), OrganizationValidationError);
});

test('überlappende Ressortleitungen und doppelte exklusive Ämter werden abgewiesen', () => {
  const { organization, profiles, ministries } = fixture();
  const leadershipOverlap = structuredClone(organization);
  leadershipOverlap.assignments.push({ ...leadershipOverlap.assignments.find((entry) => entry.id === 'neu-clara-umwelt')!, id: 'test-doppelte-ressortleitung', personSlug: 'bernd-bach' });
  assert.throws(() => validateOrganization(leadershipOverlap, profiles, ministries), /überlappende Leitungen/u);

  const exclusiveOverlap = structuredClone(organization);
  exclusiveOverlap.assignments.push({ ...exclusiveOverlap.assignments.find((entry) => entry.id === 'neu-anna-praesident')!, id: 'test-doppelter-praesident', personSlug: 'emil-ende' });
  assert.throws(() => validateOrganization(exclusiveOverlap, profiles, ministries), /Exklusives Amt/u);
});

test('ein aktives Ressort ohne zulässige Leitung wird abgewiesen', () => {
  const { organization, profiles, ministries } = fixture();
  const withoutLeader: OrganizationData = structuredClone(organization);
  withoutLeader.assignments = withoutLeader.assignments.filter((entry) => entry.id !== 'neu-clara-umwelt');
  assert.throws(() => validateOrganization(withoutLeader, profiles, ministries, '2026-08-01'), /muss genau eine zulässige Leitung aktiv sein/u);
});

test('Kabinettsumbildungen sind atomar und liefern alte sowie neue Besetzung', () => {
  const { organization, profiles, ministries } = fixture();
  const before = structuredClone(organization);
  const result = applyCabinetReshuffle(organization, profiles, ministries, {
    effectiveDate: '2026-08-15', governmentSlug: 'staatsrat-neu', summary: 'Ressortübergabe',
    changes: [{ ministrySlug: 'umwelt', personSlug: 'bernd-bach', officeSlug: 'mitglied', title: 'Staatsrat für Umwelt', sortOrder: 5, sourceRefs: ['test'] }],
  });
  assert.deepEqual(organization, before, 'Die Eingabedaten dürfen nicht teilweise verändert werden.');
  assert.equal(result.preview[0].beforePersonSlug, 'clara-cordes');
  assert.equal(result.preview[0].afterPersonSlug, 'bernd-bach');
  assert.deepEqual(result.affectedFiles, ['content/organisation/assignments.json']);
  assert.ok(result.affectedRoutes.includes('/staatsregierung/mitglieder/bernd-bach/'));

  assert.throws(() => applyCabinetReshuffle(organization, profiles, ministries, {
    effectiveDate: '2026-08-15', governmentSlug: 'staatsrat-neu', summary: 'Fehlerfall',
    changes: [{ ministrySlug: 'unbekannt', personSlug: 'bernd-bach', officeSlug: 'mitglied', title: 'Test', sortOrder: 5, sourceRefs: ['test'] }],
  }));
  assert.deepEqual(organization, before);
});
