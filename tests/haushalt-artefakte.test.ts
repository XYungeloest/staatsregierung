import assert from 'node:assert/strict';
import test from 'node:test';

import { artefaktName } from '../apps/portal/src/components/haushalt/ruecklagen/downloads.ts';
import { findUebernommenesArtefakt } from '../apps/portal/src/lib/haushalt/snapshot.ts';
import type { Artefakt } from '../apps/portal/src/lib/haushalt/types.ts';

// Import-Manifest im Kleinen: Der Import verzeichnet jede Quelldatei; nur übernommene Dateien
// tragen einen veröffentlichten Namen.
const gesperrtIntern: Artefakt[] = [
  { quelldatei: 'Haushalt_2093_2094.pdf', status: 'gesperrt', sha256: 'a'.repeat(64), grund: 'enthält nicht öffentliche Abschnitte: Quellenverzeichnis' },
  { quelldatei: 'Haushalt_2093_2094.xlsx', status: 'gesperrt', sha256: 'b'.repeat(64), grund: 'enthält nicht öffentliche Abschnitte: Quellenverzeichnis' },
];

test('Ausgabedokumente werden unter dem neutralen Namen der Periode angeboten', () => {
  assert.equal(artefaktName('2093-2094', 'pdf'), 'Haushalt_2093_2094.pdf');
  assert.equal(artefaktName('2093-2094', 'xlsx'), 'Haushalt_2093_2094.xlsx');
});

test('gesperrte interne Fassung und übernommene öffentliche Fassung ergeben einen Download unter dem neutralen Namen', () => {
  const manifest = {
    artefakte: [
      ...gesperrtIntern,
      { datei: 'Haushalt_2093_2094.pdf', quelldatei: 'Haushalt_2093_2094_oeffentlich.pdf', status: 'uebernommen', sha256: 'c'.repeat(64), bytes: 10 },
      { datei: 'Haushalt_2093_2094.xlsx', quelldatei: 'Haushalt_2093_2094_oeffentlich.xlsx', status: 'uebernommen', sha256: 'd'.repeat(64), bytes: 20 },
    ] satisfies Artefakt[],
  };
  assert.equal(findUebernommenesArtefakt(manifest, 'Haushalt_2093_2094.pdf')?.quelldatei, 'Haushalt_2093_2094_oeffentlich.pdf');
  assert.equal(findUebernommenesArtefakt(manifest, 'Haushalt_2093_2094.xlsx')?.quelldatei, 'Haushalt_2093_2094_oeffentlich.xlsx');
  assert.equal(findUebernommenesArtefakt(manifest, 'Haushalt_2093_2094_oeffentlich.pdf'), undefined, 'kein Download unter dem Herkunftsnamen');
});

test('ohne übernommenes Artefakt wird nichts angeboten', () => {
  assert.equal(findUebernommenesArtefakt({ artefakte: gesperrtIntern }, 'Haushalt_2093_2094.pdf'), undefined);
  const ersetzt: Artefakt[] = [
    { quelldatei: 'Haushalt_2093_2094.pdf', status: 'ersetzt', sha256: 'a'.repeat(64), grund: 'öffentliche Ausgabefassung liegt vor' },
    { quelldatei: 'Haushalt_2093_2094_oeffentlich.pdf', status: 'gesperrt', sha256: 'c'.repeat(64), grund: 'enthält lokale Pfade' },
  ];
  assert.equal(findUebernommenesArtefakt({ artefakte: ersetzt }, 'Haushalt_2093_2094.pdf'), undefined, 'kein Rückfall auf die Standardausgabe');
  assert.equal(findUebernommenesArtefakt({ artefakte: [] }, 'Haushalt_2093_2094.xlsx'), undefined);
});
