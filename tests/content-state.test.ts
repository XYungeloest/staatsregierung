import assert from 'node:assert/strict';
import test from 'node:test';

import { loadNormsOnce as loadAllNorms } from './helpers/corpus.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { loadLegislativeProcedures } from '@ostrecht/shared/lib/portal/legislation.ts';
import { PORTAL_REFERENCE_DATE } from '@ostrecht/shared/lib/portal/dates.ts';
import { loadEvents } from '@ostrecht/shared/lib/portal/content.ts';
import editorialConfig from '@ostrecht/shared/config/editorial.json' with { type: 'json' };

const cutoff = editorialConfig.referenceDate;

test('der redaktionelle Stichtag bleibt zentral definiert', () => {
  assert.equal(PORTAL_REFERENCE_DATE, cutoff);
});

test('Verfahren sind quellengebunden und ihre Dokumentnummern eindeutig', async () => {
  const procedures = await loadLegislativeProcedures();
  assert.ok(procedures.length > 0);
  assert.equal(new Set(procedures.map((entry) => entry.documentNumber)).size, procedures.length);
  assert.ok(procedures.every((entry) => entry.confirmedAsOf === cutoff));
  assert.ok(procedures.every((entry) => entry.sources.filter((source) => source.kind === 'verkuendung').length === 1));
  assert.ok(procedures.every((entry) => entry.sources
    .filter((source) => source.localSource)
    .every((source) => source.availability === 'local')));
});

test('Plenartermine und Verfahren verwenden dieselben Beziehungs-IDs', async () => {
  const procedures = await loadLegislativeProcedures();
  const procedureSlugs = new Set(procedures.map((entry) => entry.slug));
  const events = await loadEvents();

  for (const event of events.filter((entry) => entry.relatedLegislationSlugs?.length)) {
    assert.deepEqual(new Set(event.relatedLegislationSlugs), procedureSlugs, event.slug);
  }
});

test('Verkündungen tragen vollständige Einträge und eine nachvollziehbare Quellenhierarchie', async () => {
  const publications = await loadAllVerkuendungen();
  assert.ok(publications.length > 0);
  assert.ok(publications.every((publication) => publication.entries.length > 0));
  assert.ok(publications.every((publication) => !publication.sourceFiles?.length));
  assert.ok(publications.every((publication) => publication.sourceReferences?.length));
  assert.ok(publications.every((publication) => publication.sourceReferences?.every((source) => (
    source.availability !== 'versioned' || Boolean(source.localSource)
  ))));
  assert.ok(publications.flatMap((publication) => publication.entries).every(
    (entry) => !/^(?:OGVBl|StAnzO|OABl|OVertrBl|GMBl)\./u.test(entry.citation),
  ));
});

test('Normen bleiben mit Fassungen, Historie und aktueller redaktioneller Zuständigkeit verbunden', async () => {
  const norms = await loadAllNorms();
  assert.ok(norms.length > 0);

  for (const norm of norms) {
    const versionIds = new Set(norm.versions.map((version) => version.versionId));
    assert.ok(norm.versions.length > 0, `${norm.meta.slug}: keine Fassung`);
    if (norm.history.initialVersionId !== null) {
      assert.ok(versionIds.has(norm.history.initialVersionId), `${norm.meta.slug}: Ausgangsfassung fehlt`);
    }
    assert.ok(norm.versions.every((version) => version.body.length > 0), `${norm.meta.slug}: leere Fassung`);

    if ((norm.meta.publicationDate ?? '') >= '2026-07-20') {
      assert.ok(norm.meta.enactingBody, `${norm.meta.slug}: erlassendes Organ fehlt`);
      assert.ok(norm.meta.responsibleMinistry, `${norm.meta.slug}: zuständiger Geschäftsbereich fehlt`);
      assert.notEqual(norm.meta.summary, `Regelt ${norm.meta.title}.`, `${norm.meta.slug}: generische Zusammenfassung`);
    }
  }
});
