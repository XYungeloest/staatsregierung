import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  getArtifactPath,
  getHaushaltDataRoot,
  loadAllTitel,
  loadEinzelplaene,
  loadGesamtplan,
  loadImportManifest,
  loadKapitel,
  loadPeriodMeta,
  loadProjekte,
  loadTitelForPlan,
} from '../../apps/portal/src/lib/haushalt/snapshot.ts';
import { pruefeArtefakteGegenFreitexte } from '../../scripts/haushalt-check.mjs';
import { validateSnapshotDirectory } from '../../scripts/lib/haushalt/validate.mjs';

// Prüft die versionierten Haushaltssnapshots generisch gegen ihr eigenes import-manifest.json;
// es werden keine Beträge des Bestands im Test festgeschrieben.

const dataRoot = getHaushaltDataRoot();
const perioden = readdirSync(dataRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .sort();

test('es gibt mindestens einen Haushaltssnapshot', () => {
  assert.ok(perioden.length > 0);
});

for (const periode of perioden) {
  test(`${periode}: Snapshot besteht die gemeinsame Prüflogik (Hashes, Summen, Eindeutigkeit, Projekte)`, () => {
    assert.deepEqual(validateSnapshotDirectory(join(dataRoot, periode), { periode }), []);
  });

  test(`${periode}: Kontrollsummen des import-manifest.json entsprechen den Daten`, () => {
    const manifest = loadImportManifest(periode);
    const meta = loadPeriodMeta(periode);
    const gesamtplan = loadGesamtplan(periode);
    const plaene = loadEinzelplaene(periode);
    const kapitel = loadKapitel(periode);
    const titel = loadAllTitel(periode);

    assert.deepEqual(Object.keys(manifest.kontrollsummen), meta.jahre.map(String));
    for (const [jahr, summen] of Object.entries(manifest.kontrollsummen)) {
      const key = jahr as `${number}`;
      assert.equal(plaene.length, summen.einzelplaene, 'Anzahl der Einzelpläne laut Manifest');
      assert.equal(kapitel.length, summen.kapitel, 'Anzahl der Kapitel laut Manifest');
      assert.equal(titel.length, summen.titel, 'Anzahl der Titel laut Manifest');
      assert.equal(gesamtplan.jahre[key].einnahmen, summen.einnahmen);
      assert.equal(gesamtplan.jahre[key].ausgaben, summen.ausgaben);
      assert.equal(meta.haushaltsvolumen[key], gesamtplan.jahre[key].haushaltsvolumen);

      const einnahmen = plaene.reduce((total, plan) => total + plan.jahre[key].einnahmen, 0);
      const ausgaben = plaene.reduce((total, plan) => total + plan.jahre[key].ausgaben, 0);
      assert.equal(einnahmen, summen.einnahmen, 'Σ Einzelpläne = Gesamtplan (Einnahmen)');
      assert.equal(ausgaben, summen.ausgaben, 'Σ Einzelpläne = Gesamtplan (Ausgaben)');

      const titelEinnahmen = titel.filter((entry) => entry.seite === 'Einnahme').reduce((total, entry) => total + entry.jahre[key].betrag, 0);
      const titelAusgaben = titel.filter((entry) => entry.seite === 'Ausgabe').reduce((total, entry) => total + entry.jahre[key].betrag, 0);
      assert.equal(titelEinnahmen, summen.einnahmen, 'Σ Titel = Gesamtplan (Einnahmen)');
      assert.equal(titelAusgaben, summen.ausgaben, 'Σ Titel = Gesamtplan (Ausgaben)');
      for (const betrag of [einnahmen, ausgaben, titelEinnahmen, titelAusgaben]) assert.ok(Number.isSafeInteger(betrag));
    }
  });

  test(`${periode}: jeder Einzelplan hat genau eine Titeldatei mit seinen Kapiteln`, () => {
    const plaene = loadEinzelplaene(periode);
    const dateien = readdirSync(join(dataRoot, periode, 'titel')).map((name) => name.replace(/\.json$/u, '')).sort();
    assert.deepEqual(dateien, plaene.map((plan) => plan.ep).sort());
    for (const plan of plaene) {
      const kapitel = new Set(loadTitelForPlan(periode, plan.ep).map((entry) => entry.kapitel));
      for (const code of kapitel) assert.ok(plan.kapitel.includes(code), `${plan.ep}: Kapitel ${code}`);
    }
  });

  test(`${periode}: Projekte verweisen nur auf vorhandene Titel, jeder Titel höchstens einmal`, () => {
    const titel = new Map(loadAllTitel(periode).map((entry) => [entry.konzept_id, entry]));
    const vergeben = new Set<string>();
    for (const projekt of loadProjekte(periode)) {
      for (const bezug of projekt.titel) {
        assert.ok(titel.has(bezug.konzept_id), `${projekt.id}: ${bezug.kapitel}/${bezug.titel}`);
        assert.equal(vergeben.has(bezug.konzept_id), false);
        vergeben.add(bezug.konzept_id);
      }
    }
  });

  test(`${periode}: Ausgabedateien nur, wenn im Manifest als übernommen verzeichnet`, () => {
    for (const artefakt of loadImportManifest(periode).artefakte) {
      if (artefakt.status === 'uebernommen') {
        const path = getArtifactPath(periode, artefakt.datei);
        assert.ok(path, artefakt.datei);
        assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), artefakt.sha256, `${artefakt.datei} aus ${artefakt.quelldatei}`);
      } else {
        // Gesperrte oder ersetzte Quelldateien werden nicht angeboten: kein angebotenes
        // Ausgabedokument hat ihren Inhalt (der neutrale Name kann der einer öffentlichen
        // Ausgabefassung sein).
        for (const datei of ['pdf', 'xlsx'].map((endung) => `Haushalt_${periode.replace('-', '_')}.${endung}`)) {
          const path = getArtifactPath(periode, datei);
          if (path) assert.notEqual(createHash('sha256').update(readFileSync(path)).digest('hex'), artefakt.sha256, `${datei} enthält ${artefakt.quelldatei}`);
        }
      }
    }
  });

  test(`${periode}: übernommene Ausgabedateien enthalten weder nicht freigegebene Titeltexte noch interne Kennungen`, () => {
    const contentRoot = join(dataRoot, '..', '..', 'content');
    assert.deepEqual(pruefeArtefakteGegenFreitexte({ snapshotDirectory: join(dataRoot, periode), contentRoot, periode }), []);
  });
}
