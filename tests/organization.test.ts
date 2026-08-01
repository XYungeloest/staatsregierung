import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadGovernmentProfiles,
  loadMinistryProfiles,
  loadOrganizationData,
} from '../src/lib/portal/loader.ts';
import {
  applyCabinetReshuffle,
  deriveCurrentGovernment,
  deriveGovernmentMember,
  deriveMinistry,
  getPersonOrganizationState,
  OrganizationValidationError,
  validateOrganization,
  type OrganizationData,
} from '../src/lib/portal/organization.ts';

async function fixture() {
  const [organization, profiles, ministries] = await Promise.all([
    loadOrganizationData(),
    loadGovernmentProfiles(),
    loadMinistryProfiles(),
  ]);
  return { organization, profiles, ministries };
}

test('aktuelle, historische und künftige Regierungsstände werden zum Stichtag abgeleitet', async () => {
  const { organization, profiles, ministries } = await fixture();
  const historical = deriveCurrentGovernment(organization, profiles, ministries, '2026-07-20');
  const current = deriveCurrentGovernment(organization, profiles, ministries, '2026-08-01');
  assert.equal(historical.slug, 'kabinett-honecker-ii');
  assert.equal(current.slug, 'erster-staatsrat');
  assert.equal(current.headPersonSlug, 'karl-honecker');

  const future = applyCabinetReshuffle(organization, profiles, ministries, {
    effectiveDate: '2026-09-01',
    governmentSlug: 'erster-staatsrat',
    summary: 'Testweise künftige Ressortübergabe',
    changes: [{
      ministrySlug: 'umwelt-energie-und-klimaschutz',
      personSlug: 'max-peterson',
      officeSlug: 'staatsratsmitglied',
      title: 'Staatsrat für Nachhaltigkeit und Energie',
      sortOrder: 60,
      sourceRefs: ['test'],
    }],
  });
  assert.equal(getPersonOrganizationState('yannik-schmaele', future.organization, '2026-08-31').activeAssignments.filter((entry) => entry.ministrySlug).length, 2);
  assert.equal(deriveMinistry(ministries.find((entry) => entry.slug === 'umwelt-energie-und-klimaschutz')!, future.organization, profiles, '2026-09-01').leitung.includes('Max Peterson'), true);
});

test('mehrere gleichzeitige Ämter und eine Leitung außerhalb des Staatsrates bleiben unterscheidbar', async () => {
  const { organization, profiles, ministries } = await fixture();
  const yannik = getPersonOrganizationState('yannik-schmaele', organization, '2026-08-01');
  const emma = getPersonOrganizationState('emma-mueller', organization, '2026-08-01');
  assert.equal(yannik.activeAssignments.filter((entry) => entry.ministrySlug).length, 2);
  assert.equal(yannik.isGovernmentMember, true);
  assert.equal(emma.isActive, true);
  assert.equal(emma.isGovernmentMember, false);
  assert.equal(deriveGovernmentMember(profiles.find((entry) => entry.slug === 'emma-mueller')!, organization, ministries, '2026-08-01').current, true);
});

test('Person, Ressort und Kabinett werden aus denselben Zuordnungen konsistent abgeleitet', async () => {
  const { organization, profiles, ministries } = await fixture();
  const government = deriveCurrentGovernment(organization, profiles, ministries, '2026-08-01');
  const yannik = deriveGovernmentMember(profiles.find((entry) => entry.slug === 'yannik-schmaele')!, organization, ministries, '2026-08-01');
  const environment = deriveMinistry(ministries.find((entry) => entry.slug === 'umwelt-energie-und-klimaschutz')!, organization, profiles, '2026-08-01');
  assert.ok(government.memberPersonSlugs.includes('yannik-schmaele'));
  assert.match(yannik.ressort, /Nachhaltigkeit und Energie/u);
  assert.match(environment.leitung, /Yannik Schmäle/u);
  assert.deepEqual(environment.verknuepfteLinks[0], { label: 'Profil von Yannik Schmäle', href: '/staatsregierung/mitglieder/yannik-schmaele/' });
  assert.equal(ministries.find((entry) => entry.slug === 'umwelt-energie-und-klimaschutz')!.verknuepfteLinks.some((link) => link.href.startsWith('/staatsregierung/mitglieder/')), false);
});

test('fehlende Referenzen und ungültige Datumsintervalle werden abgewiesen', async () => {
  const { organization, profiles, ministries } = await fixture();
  const missingReference = structuredClone(organization);
  missingReference.assignments[0].personSlug = 'nicht-vorhanden';
  assert.throws(() => validateOrganization(missingReference, profiles, ministries), OrganizationValidationError);
  const invalidInterval = structuredClone(organization);
  invalidInterval.assignments[0].validTo = '2020-01-01';
  assert.throws(() => validateOrganization(invalidInterval, profiles, ministries), OrganizationValidationError);
});

test('überlappende Ressortleitungen und doppelte exklusive Ämter werden abgewiesen', async () => {
  const { organization, profiles, ministries } = await fixture();
  const leadershipOverlap = structuredClone(organization);
  leadershipOverlap.assignments.push({
    ...leadershipOverlap.assignments.find((entry) => entry.ministrySlug === 'umwelt-energie-und-klimaschutz' && entry.validTo === null)!,
    id: 'test-doppelte-ressortleitung', personSlug: 'max-peterson',
  });
  assert.throws(() => validateOrganization(leadershipOverlap, profiles, ministries), /überlappende Leitungen/u);

  const exclusiveOverlap = structuredClone(organization);
  exclusiveOverlap.assignments.push({
    ...exclusiveOverlap.assignments.find((entry) => entry.officeSlug === 'staatspraesident')!,
    id: 'test-doppelter-staatspraesident', personSlug: 'mateo-delgado',
  });
  assert.throws(() => validateOrganization(exclusiveOverlap, profiles, ministries), /Exklusives Amt/u);
});

test('ein aktives Ressort ohne zulässige Leitung wird abgewiesen', async () => {
  const { organization, profiles, ministries } = await fixture();
  const withoutLeader: OrganizationData = structuredClone(organization);
  withoutLeader.assignments = withoutLeader.assignments.filter((entry) => !(entry.ministrySlug === 'umwelt-energie-und-klimaschutz' && entry.validTo === null));
  assert.throws(() => validateOrganization(withoutLeader, profiles, ministries, '2026-08-01'), /muss genau eine zulässige Leitung aktiv sein/u);
});

test('Kabinettsumbildungen sind atomar und liefern alte sowie neue Besetzung', async () => {
  const { organization, profiles, ministries } = await fixture();
  const before = structuredClone(organization);
  const result = applyCabinetReshuffle(organization, profiles, ministries, {
    effectiveDate: '2026-08-15', governmentSlug: 'erster-staatsrat', summary: 'Ressortübergabe',
    changes: [{ ministrySlug: 'umwelt-energie-und-klimaschutz', personSlug: 'max-peterson', officeSlug: 'staatsratsmitglied', title: 'Staatsrat für Nachhaltigkeit und Energie', sortOrder: 60, sourceRefs: ['test'] }],
  });
  assert.deepEqual(organization, before, 'Die Eingabedaten dürfen nicht teilweise verändert werden.');
  assert.equal(result.preview[0].beforePersonSlug, 'yannik-schmaele');
  assert.equal(result.preview[0].afterPersonSlug, 'max-peterson');
  assert.deepEqual(result.affectedFiles, ['content/organisation/assignments.json']);
  assert.ok(result.affectedRoutes.includes('/staatsregierung/mitglieder/max-peterson/'));

  const invalidBefore = structuredClone(organization);
  assert.throws(() => applyCabinetReshuffle(organization, profiles, ministries, {
    effectiveDate: '2026-08-15', governmentSlug: 'erster-staatsrat', summary: 'Fehlerfall',
    changes: [{ ministrySlug: 'unbekannt', personSlug: 'max-peterson', officeSlug: 'staatsratsmitglied', title: 'Test', sortOrder: 60, sourceRefs: ['test'] }],
  }));
  assert.deepEqual(organization, invalidBefore);
});
