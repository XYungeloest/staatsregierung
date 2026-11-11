import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUSGABE_KATEGORIEN,
  DEFINITION_INVESTITIONEN,
  EINNAHME_KATEGORIEN,
  HAUPTGRUPPEN,
  getAnteil,
  getAusgabeKategorien,
  getBundesmittel,
  getEinnahmeKategorien,
  getEinzelplanKennzahlen,
  getHauptfunktionen,
  getKapitelKennzahlen,
  getKennzahlen,
  getPeriodenvergleich,
  getPersonalKategorien,
  getVeraenderung,
  kategorisiere,
  legacyAmountsToHauptgruppen,
  type KategorieRegel,
} from '../apps/portal/src/lib/haushalt/kennzahlen.ts';
import type { Einzelplan, Gesamtplan, Gruppierungszeile, Hauptgruppen, Kapitel } from '../apps/portal/src/lib/haushalt/types.ts';

/**
 * Abgeleitete Haushaltssichten gegen einen synthetischen Gesamtplan mit kleinen runden Beträgen
 * (keine Beträge des echten Bestands). Die Gruppierung enthält bewusst auch Obergruppen, die im
 * Bestand fehlen (z. B. 32, 59, 98), damit Rest- und Ausnahmeregeln greifen.
 */

type Zeile = [hauptgruppe: string, obergruppe: string, gruppe: string, bezeichnung: string, j1: number, j2: number];

const ZEILEN: Zeile[] = [
  ['0', '01', '011', 'Lohnsteuer', 300, 320],
  ['0', '05', '053', 'Grunderwerbsteuer', 100, 110],
  ['1', '11', '111', 'Gebühren, sonstige Entgelte', 40, 40],
  ['1', '12', '121', 'Einnahmen aus Gewinnen von Unternehmen und Beteiligungen', 10, 10],
  ['2', '21', '211', 'Allgemeine Zuweisungen vom Bund', 80, 85],
  ['2', '23', '232', 'Sonstige Zuweisungen von Ländern', 20, 20],
  ['3', '32', '325', 'Schuldenaufnahmen auf dem sonstigen Kreditmarkt im Inland', 30, 0],
  ['3', '33', '331', 'Zuweisungen für Investitionen vom Bund', 50, 55],
  ['3', '34', '346', 'Zuschüsse für Investitionen von der EU', 10, 10],
  ['3', '35', '359', 'Entnahmen aus sonstigen Rücklagen', 60, 0],
  ['3', '38', '381', 'Haushaltstechnische Verrechnungen', 5, 5],
  ['4', '42', '422', 'Bezüge der Beamt:innen', 120, 125],
  ['4', '42', '428', 'Entgelte der Arbeitnehmer:innen', 110, 115],
  ['4', '43', '432', 'Versorgungsbezüge', 50, 55],
  ['4', '44', '441', 'Beihilfen', 20, 20],
  ['4', '46', '461', 'Globale Mehrausgaben für Personalausgaben', 10, 10],
  ['5', '51', '511', 'Geschäftsbedarf', 30, 30],
  ['5', '57', '575', 'Zinsausgaben an sonstigen inländischen Kreditmarkt', 25, 27],
  ['5', '59', '595', 'Tilgung an sonstigen inländischen Kreditmarkt', 15, 18],
  ['6', '63', '633', 'Sonstige Zuweisungen an Gemeinden', 160, 170],
  ['7', '71', '712', 'Große Neu-, Um- und Erweiterungsbauten', 40, 35],
  ['8', '88', '883', 'Zuweisungen für Investitionen an Gemeinden', 60, 50],
  ['9', '91', '919', 'Zuführungen an sonstige Rücklagen', 70, 40],
  ['9', '98', '981', 'Haushaltstechnische Verrechnungen', 5, 0],
];

function gruppierung(): Gruppierungszeile[] {
  return ZEILEN.map(([hauptgruppe, obergruppe, gruppe, bezeichnung, j1, j2]) => ({
    hauptgruppe: hauptgruppe as Gruppierungszeile['hauptgruppe'],
    obergruppe,
    gruppe,
    bezeichnung,
    jahre: { '2091': j1, '2092': j2 },
  }));
}

function hauptgruppenSumme(jahr: '2091' | '2092'): Hauptgruppen {
  const result = Object.fromEntries(Object.keys(HAUPTGRUPPEN).map((hg) => [hg, 0])) as Hauptgruppen;
  for (const zeile of gruppierung()) result[zeile.hauptgruppe] += zeile.jahre[jahr];
  return result;
}

function summe(hg: Hauptgruppen, keys: string[]): number {
  return keys.reduce((total, key) => total + hg[key as keyof Hauptgruppen], 0);
}

function gesamtplan(): Gesamtplan {
  const jahre = {} as Gesamtplan['jahre'];
  for (const jahr of ['2091', '2092'] as const) {
    const hg = hauptgruppenSumme(jahr);
    const einnahmen = summe(hg, ['0', '1', '2', '3']);
    const ausgaben = summe(hg, ['4', '5', '6', '7', '8', '9']);
    jahre[jahr] = {
      einnahmen,
      ausgaben,
      haushaltsvolumen: Math.max(einnahmen, ausgaben),
      zinsen: jahr === '2091' ? 25 : 27,
      tilgung: jahr === '2091' ? 15 : 18,
      ruecklagenentnahme: jahr === '2091' ? 60 : 0,
      finanzierungssaldo_vor_ueberschussverwendung: einnahmen - ausgaben,
      hauptgruppen: hg,
    };
  }
  return {
    schema: 'haushalt-snapshot/1',
    periode: '2091-2092',
    jahre,
    gruppierung: gruppierung(),
    funktionen: [
      { hauptfunktion: '0', hauptfunktion_bezeichnung: 'Allgemeine Dienste', funktion: '011', bezeichnung: 'Politische Führung', jahre: { '2091': jahre['2091'].ausgaben - 100, '2092': jahre['2092'].ausgaben - 100 } },
      { hauptfunktion: '1', hauptfunktion_bezeichnung: 'Bildungswesen', funktion: '111', bezeichnung: 'Unterrichtsverwaltung', jahre: { '2091': 100, '2092': 100 } },
    ],
  };
}

test('Anteile und Veränderungen', () => {
  assert.equal(getAnteil(25, 100), 0.25);
  assert.equal(getAnteil(5, 0), null);
  assert.deepEqual(getVeraenderung(200, 250), { absolut: 50, relativ: 0.25 });
  assert.deepEqual(getVeraenderung(-100, -50), { absolut: 50, relativ: 0.5 });
  assert.deepEqual(getVeraenderung(0, 10), { absolut: 10, relativ: null });
});

test('Einnahme- und Ausgabekategorien sind lückenlos und überschneidungsfrei', () => {
  const plan = gesamtplan();
  for (const jahr of ['2091', '2092']) {
    const einnahmen = getEinnahmeKategorien(plan, jahr, { mitLeeren: true });
    const ausgaben = getAusgabeKategorien(plan, jahr, { mitLeeren: true });
    assert.equal(einnahmen.reduce((total, wert) => total + wert.betrag, 0), plan.jahre[jahr as '2091'].einnahmen);
    assert.equal(ausgaben.reduce((total, wert) => total + wert.betrag, 0), plan.jahre[jahr as '2091'].ausgaben);
    const gruppen = [...einnahmen, ...ausgaben].flatMap((wert) => wert.gruppen.map((gruppe) => gruppe.gruppe));
    assert.equal(new Set(gruppen).size, gruppen.length, 'jede Gruppe genau einmal');
    assert.equal(gruppen.length, ZEILEN.length);
  }
  const ausgaben2091 = new Map(getAusgabeKategorien(plan, '2091').map((wert) => [wert.id, wert]));
  assert.equal(ausgaben2091.get('zinsen')?.betrag, 25);
  assert.equal(ausgaben2091.get('tilgung')?.betrag, 15);
  assert.equal(ausgaben2091.get('saechliche-verwaltungsausgaben')?.betrag, 30, 'Zins und Tilgung nicht doppelt');
  assert.equal(ausgaben2091.get('uebrige-finanzierungsausgaben')?.betrag, 5);
  assert.equal(ausgaben2091.get('zufuehrungen-ruecklagen')?.umfang, 'Obergruppe 91');
  assert.equal(ausgaben2091.get('saechliche-verwaltungsausgaben')?.umfang, 'Hauptgruppe 5 ohne Obergruppen 56, 57, 58, 59');
  assert.equal(ausgaben2091.get('uebrige-finanzierungsausgaben')?.umfang, 'Hauptgruppe 9 ohne Obergruppe 91');
  const einnahmen2091 = new Map(getEinnahmeKategorien(plan, '2091').map((wert) => [wert.id, wert]));
  assert.equal(einnahmen2091.get('schuldenaufnahmen')?.betrag, 30);
  assert.equal(einnahmen2091.get('ruecklagenentnahmen')?.betrag, 60);
  assert.equal(einnahmen2091.get('uebrige-finanzierungseinnahmen')?.betrag, 5);
  assert.equal(einnahmen2091.has('uebrige-einnahmen'), false, 'leere Restkategorie entfällt standardmäßig');
  assert.equal(new Map(getEinnahmeKategorien(plan, '2092').map((wert) => [wert.id, wert])).has('schuldenaufnahmen'), false);
});

test('Jede Kategorie trägt eine öffentliche Definition', () => {
  for (const regel of [...EINNAHME_KATEGORIEN, ...AUSGABE_KATEGORIEN]) {
    assert.ok(regel.definition.length > 20, regel.id);
    assert.doesNotMatch(regel.definition, /Simulation|Modell|Snapshot|Import/iu, regel.id);
  }
});

test('Personalausgaben nach Teilkategorien ergeben die Hauptgruppe 4', () => {
  const plan = gesamtplan();
  const teile = getPersonalKategorien(plan, '2091');
  assert.equal(teile.reduce((total, wert) => total + wert.betrag, 0), plan.jahre['2091'].hauptgruppen['4']);
  assert.deepEqual(teile.map((wert) => [wert.id, wert.betrag]), [
    ['bezuege-beamte', 120],
    ['entgelte-arbeitnehmer', 110],
    ['versorgung', 50],
    ['beihilfen', 20],
    ['uebrige-personalausgaben', 10],
  ]);
  // Umfang aus der Regel: Gruppenregeln nennen ihre Gruppe, nicht die gemeinsame Obergruppe.
  const umfang = new Map(teile.map((wert) => [wert.id, wert.umfang]));
  assert.equal(umfang.get('bezuege-beamte'), 'Gruppe 422');
  assert.equal(umfang.get('entgelte-arbeitnehmer'), 'Gruppe 428');
  assert.equal(umfang.get('versorgung'), 'Obergruppe 43');
  assert.doesNotMatch(umfang.get('uebrige-personalausgaben') ?? '', /422|428/u, 'Rest ohne die Gruppen anderer Kategorien');
  assert.match(umfang.get('uebrige-personalausgaben') ?? '', /^Gruppen? /u);
});

test('Lücke, Überschneidung und Summenabweichung brechen ab', () => {
  const zeilen = gruppierung().filter((zeile) => zeile.hauptgruppe === '0').map((zeile) => ({ ...zeile, betrag: zeile.jahre['2091'] }));
  const nurLohnsteuer: KategorieRegel[] = [{ id: 'lohn', label: 'Lohnsteuer', definition: 'Gruppe 011.', gruppen: ['011'] }];
  assert.throws(() => kategorisiere(zeilen, nurLohnsteuer, { bezeichnung: 'Test', sollSumme: 400 }), /Gruppe 053 ist keiner Kategorie zugeordnet \(Lücke\)/u);
  const doppelt: KategorieRegel[] = [
    { id: 'a', label: 'A', definition: 'Hauptgruppe 0.', hauptgruppen: ['0'] },
    { id: 'b', label: 'B', definition: 'Obergruppe 05.', obergruppen: ['05'] },
  ];
  assert.throws(() => kategorisiere(zeilen, doppelt, { bezeichnung: 'Test', sollSumme: 400 }), /mehrere Kategorien \(a, b\)/u);
  const mitRest: KategorieRegel[] = [...nurLohnsteuer, { id: 'rest', label: 'Rest', definition: 'Übrige.', rest: true }];
  assert.equal(kategorisiere(zeilen, mitRest, { bezeichnung: 'Test', sollSumme: 400 }).find((wert) => wert.id === 'rest')?.betrag, 100);
  assert.throws(() => kategorisiere(zeilen, mitRest, { bezeichnung: 'Test', sollSumme: 401 }), /weicht von 401 ab/u);
  assert.throws(
    () => kategorisiere(zeilen, [...mitRest, { id: 'rest2', label: 'Rest', definition: 'Übrige.', rest: true }], { bezeichnung: 'Test', sollSumme: 400 }),
    /mehr als eine Restkategorie/u,
  );

  // Ein Gesamtplan, dessen Gruppierung nicht zur Einnahmensumme passt, wird nicht still gezeigt.
  const kaputt = gesamtplan();
  kaputt.jahre['2091'].einnahmen += 1;
  assert.throws(() => getEinnahmeKategorien(kaputt, '2091'), /Kategorien nicht lückenlos/u);
});

test('Kennzahlenblock: Quellfelder, Investitionen und Schuldendienst mit Definition', () => {
  const plan = gesamtplan();
  const kennzahlen = getKennzahlen(plan, '2091');
  assert.equal(kennzahlen.investitionen.betrag, 100);
  assert.equal(kennzahlen.investitionen.definition, DEFINITION_INVESTITIONEN);
  assert.deepEqual(kennzahlen.investitionen.bestandteile?.map((teil) => teil.betrag), [40, 60]);
  assert.equal(kennzahlen.schuldendienst?.betrag, 40);
  assert.equal(kennzahlen.steuern.betrag, 400);
  assert.equal(kennzahlen.personal.betrag, 310);
  assert.equal(kennzahlen.zuweisungen.betrag, 160);
  assert.equal(kennzahlen.finanzierungssaldo?.label, 'Finanzierungssaldo vor Überschussverwendung');
  assert.equal(kennzahlen.kreditaufnahmeBrutto, null, 'fehlendes Quellfeld bleibt leer statt geschätzt');
  assert.ok('strukturelleNettokreditaufnahme' in kennzahlen);
  assert.equal(kennzahlen.ruecklagenentnahme?.label, 'Entnahme aus der allgemeinen Rücklage');
  assert.match(kennzahlen.schuldendienst?.definition ?? '', /keine Teilsumme der Hauptgruppen/u);
  assert.doesNotMatch(kennzahlen.tilgung?.definition ?? '', /nicht als eigener Tilgungstitel/u, 'Tilgung als Titel veranschlagt');
  assert.throws(() => getKennzahlen(plan, '2099'), /Jahr 2099 fehlt/u);

  // Tilgung nur im Gesamtplan, nicht als Titel (Obergruppen 58/59): Definitionen sagen das.
  const ohneTilgungstitel = gesamtplan();
  for (const zeile of ohneTilgungstitel.gruppierung) {
    if (zeile.obergruppe === '58' || zeile.obergruppe === '59') zeile.jahre['2091'] = 0;
  }
  const ohne = getKennzahlen(ohneTilgungstitel, '2091');
  assert.match(ohne.tilgung?.definition ?? '', /nicht als eigener Tilgungstitel/u);
  assert.match(ohne.schuldendienst?.definition ?? '', /nicht als eigener Tilgungstitel/u);
});

test('Bundesmittel sind eine Teilmenge über die Gruppenbezeichnung „vom Bund“', () => {
  const bund = getBundesmittel(gesamtplan(), '2091');
  assert.deepEqual(bund.gruppen.map((gruppe) => gruppe.gruppe), ['211', '331']);
  assert.equal(bund.betrag, 130);
  assert.match(bund.definition, /211, 331/u);
  assert.equal(bund.label, 'darunter Einnahmegruppen „vom Bund“', 'kein Anspruch auf Vollständigkeit der Bundesmittel');
  assert.match(bund.definition, /in anderen Gruppen veranschlagt sind, sind nicht enthalten/u);
});

test('Hauptfunktionen ergeben die Ausgaben', () => {
  const plan = gesamtplan();
  const werte = getHauptfunktionen(plan, '2091');
  assert.equal(werte.reduce((total, wert) => total + wert.betrag, 0), plan.jahre['2091'].ausgaben);
  const kaputt = gesamtplan();
  kaputt.funktionen[1].jahre['2091'] += 1;
  assert.throws(() => getHauptfunktionen(kaputt, '2091'), /weicht von den Ausgaben/u);
});

test('Einzelplan- und Kapitelkennzahlen', () => {
  const plan = gesamtplan();
  const hg = (werte: Partial<Hauptgruppen>): Hauptgruppen =>
    ({ ...Object.fromEntries(Object.keys(HAUPTGRUPPEN).map((key) => [key, 0])), ...werte }) as Hauptgruppen;
  const einzelplan: Einzelplan = {
    ep: '04',
    bezeichnung: 'Musterplan',
    ressort: 'Musterstelle',
    kapitel: ['0401'],
    kapitelanzahl: 1,
    titelanzahl: 1,
    jahre: {
      '2091': { einnahmen: 10, ausgaben: 200, hauptgruppen: hg({ '4': 100, '7': 20, '8': 30, '6': 50 }) },
      '2092': { einnahmen: 10, ausgaben: 250, hauptgruppen: hg({ '4': 120, '7': 30, '8': 30, '6': 70 }) },
    },
  };
  const kennzahlen = getEinzelplanKennzahlen(einzelplan, plan);
  assert.equal(kennzahlen.jahre['2091'].investitionen, 50);
  assert.equal(kennzahlen.jahre['2091'].personalAnteil, 0.5);
  assert.equal(kennzahlen.jahre['2091'].anteilAusgaben, 200 / plan.jahre['2091'].ausgaben);
  assert.deepEqual(kennzahlen.veraenderungAusgaben, { absolut: 50, relativ: 0.25 });

  const kapitel: Kapitel = {
    kapitel: '0401',
    einzelplan: '04',
    bezeichnung: 'Musterkapitel',
    funktion: '111',
    funktion_bezeichnung: 'Unterrichtsverwaltung',
    titelanzahl: 1,
    jahre: {
      '2091': { einnahmen: 0, ausgaben: 100, rest: 5, hauptgruppen: hg({ '4': 100 }) },
      '2092': { einnahmen: 0, ausgaben: 125, rest: 0, hauptgruppen: hg({ '4': 125 }) },
    },
  };
  const kap = getKapitelKennzahlen(kapitel, einzelplan);
  assert.equal(kap.jahre['2091'].anteilAusgaben, 0.5);
  assert.equal(kap.jahre['2091'].rest, 5);
  assert.throws(() => getKapitelKennzahlen({ ...kapitel, einzelplan: '05' }, einzelplan), /gehört nicht/u);
});

test('Periodenvergleich bildet Altwerte auf Hauptgruppen ab und nennt den Strukturhinweis', () => {
  const alt = {
    tax: 1, administration: 2, allocations: 3, financingRevenue: 4, revenue: 10,
    personnel: 5, operations: 6, transfers: 7, construction: 8, investments: 9, financingExpenses: 10, expenses: 45,
  };
  assert.deepEqual(legacyAmountsToHauptgruppen(alt), { '0': 1, '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10 });
  const vergleich = getPeriodenvergleich({ '2089': alt, '2090': alt }, gesamtplan());
  assert.deepEqual(vergleich.jahre, ['2089', '2090', '2091', '2092']);
  assert.equal(vergleich.zeilen.length, 10);
  assert.equal(vergleich.zeilen[4].werte['2089'], 5);
  assert.equal(vergleich.ausgaben['2089'], 45);
  assert.equal(vergleich.einnahmen['2091'], gesamtplan().jahre['2091'].einnahmen);
  assert.match(vergleich.hinweis, /Einzelpläne werden mit dem Doppelhaushalt 2091\/2092 neu zugeschnitten/u);
  assert.throws(() => getPeriodenvergleich({ '2091': alt }, gesamtplan()), /überschneiden/u);
});
