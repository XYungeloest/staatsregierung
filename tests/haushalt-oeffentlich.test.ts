import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { validateSnapshotOverlays } from '../scripts/lib/haushalt/editorial.mjs';
import {
  METABEGRIFFE,
  enthaeltMetabegriff,
  enthaeltPaarform,
  findeMetabegriffe,
  findeMetabegriffeOeffentlich,
  formatKapitelnummer,
  formatTitelnummer,
  hasProjektseite,
  normalizeFreitextOverlay,
  publicBezeichnung,
  publicErlaeuterung,
  publicFinanzierung,
  publicRechtsgrundlage,
  publicSuchbegriffe,
  publicTiteltexte,
  publicVermerk,
  rechtsgrundlageBezuege,
  resolveRechtsbezugArt,
  type ProjektOverlay,
} from '../apps/portal/src/lib/haushalt/oeffentlich.ts';
import type { Titel } from '../apps/portal/src/lib/haushalt/types.ts';

/**
 * Fail-closed-Freigabe der Haushaltsfreitexte mit synthetischen Texten: Metabegriffe und
 * Paarformen, vollständige Klassifikation von Rechtsgrundlage, Finanzierung, Erläuterung und
 * Vermerk, öffentliche Fassungen von Bezeichnungen und die redaktionelle Prüfung, die
 * unklassifizierte Quelltexte zurückweist.
 */

test('Metabegriffe kennzeichnen Arbeitsvermerke', () => {
  const vermerke = [
    'Fortschreibung nach dem Recht des Simulationsbundes',
    'Simulations-GG Art. 106',
    'Modellannahme 2 % je Jahr',
    'Versorgungsmodell der Aufstellung',
    'Prognose W2 der Steuerschätzung',
    'Verteilung nach Referenzvektor',
    'Zahlungsstand nicht belegt',
    'Überleitung nicht nachgewiesen',
    'Ableitung aus Originaltiteln',
    'Reales Gesetz als Vorlage',
    'Datenpaket 3, Solver-Lauf',
    'Basisrun c0-20991231-v1',
    'Korrektur K-02a',
    'Finanzierung über F09',
    'Prüfung Q37',
    'Entscheidung D-57',
    'Rest gegenüber C0 v2',
    'nach sächsischem Vorbild',
    'Herleitung aus dem Basishaushalt',
    'Projekt-/Spezialrecht gemäß Projektregister',
    'Der Zuschuss wird nicht zusätzlich gerechnet.',
    'Der Ansatz ist eine Planungsannahme.',
    'Planungsäquivalent rd. 6.000 VZÄ',
    'Kein zweiter Vollaufbau.',
    'Der Ansatz bleibt als Sammelansatz gekennzeichnet.',
    'Theaterförderung – modellierter Förderrahmen',
    'etwaige Übernahme von tegut-Filialen',
  ];
  for (const text of vermerke) assert.equal(enthaeltMetabegriff(text), true, text);
  const oeffentlich = [
    'Zuschüsse für Bildungsprojekte, Wettbewerbe und Modellvorhaben',
    'Ausgleich der Elternbeiträge an kommunale und freie Träger',
    'Zuschüsse an Realschulen und Gymnasien',
    'Planungsgröße rund 9,5 Millionen je Fahrzeug',
    'Finanzausgleichsgesetz Ost (FAG Ost)',
    'Bestehende Förderungen werden angerechnet.',
    'Gesperrt bis zum Nachweis der Zuordnung zu den Kapiteln.',
  ];
  for (const text of oeffentlich) assert.deepEqual(findeMetabegriffe(text), [], text);
  for (const begriff of METABEGRIFFE) assert.ok(begriff.begruendung.length > 10, begriff.id);
});

test('Paarformen und andere Genderschreibweisen werden erkannt, Doppelpunktformen nicht', () => {
  const paarformen = [
    'Schülerinnen und Schüler',
    'Erzieherinnen und Erzieher sowie Schulsozialarbeiterinnen und -sozialarbeiter',
    'Förderschülerinnen und -schüler',
    'Endgeräte für Schülerinnen, Schüler und Lehrkräfte',
    'Bezüge der Beamtinnen, Beamten, Richterinnen und Richter',
    'Nachversicherung ausscheidender Beamtinnen und Beamter',
    'Lehrer und Lehrerinnen',
    'Bürger/-innen',
    'BürgerInnen',
    'Bürger*innen',
    'Bürger_innen',
  ];
  for (const text of paarformen) assert.equal(enthaeltPaarform(text), true, text);
  const zulaessig = ['Schüler:innen und Lehrkräfte', 'Beamt:innen und Richter:innen', 'Gewinnen und Gewerbe', 'Binnenschifffahrt und Rinnen', 'innen und außen'];
  for (const text of zulaessig) assert.equal(enthaeltPaarform(text), false, text);
});

const overlay = normalizeFreitextOverlay({
  rechtsgrundlage: {
    'Mustergesetz §§ 1, 2': { anzeige: 'Mustergesetz §§ 1, 2', normSlug: 'mustergesetz', art: 'geltend' },
    'LHO; Untersetzung offen': { anzeige: null },
  },
  finanzierung: { 'Gesamtdeckung; Lücke gesondert': { anzeige: null } },
  erlaeuterung: {
    'Zuschüsse für Bildungsprojekte.': { anzeige: 'Zuschüsse für Bildungsprojekte.' },
    'Kassenprognose nach Fallgruppenmodell': { anzeige: 'Kassenprognose nach Fallgruppen' },
    'Unauffälliger, aber interner Text': { anzeige: null },
    'Allgemeine Erläuterung.': { anzeige: 'Allgemeine Erläuterung.' },
  },
  vermerk: {
    'Gesperrt bis zur Vorlage der Bauliste.': { anzeige: 'Gesperrt bis zur Vorlage der Bauliste.' },
    'Gesperrter Vermerk': { anzeige: null },
    'Einsparungen aus F12 sind enthalten.': { anzeige: 'Einsparungen aus der Zinssteuerung sind enthalten.' },
  },
  bezeichnungen: { 'Entgelte der Arbeitnehmerinnen und Arbeitnehmer': 'Entgelte der Arbeitnehmer:innen', 'Theater – modellierter Förderrahmen': 'Theater' },
});

test('Rechtsgrundlage und Finanzierung: nur klassifizierte Texte mit Anzeige erscheinen', () => {
  assert.deepEqual(publicRechtsgrundlage('Mustergesetz §§ 1, 2', overlay), {
    text: 'Mustergesetz §§ 1, 2',
    normSlug: 'mustergesetz',
    art: 'geltend',
  });
  assert.equal(publicRechtsgrundlage('LHO; Untersetzung offen', overlay), null, 'anzeige null');
  assert.equal(publicRechtsgrundlage('Nicht klassifizierter Text', overlay), null, 'fail-closed');
  assert.equal(publicRechtsgrundlage(undefined, overlay), null);
  assert.equal(publicFinanzierung('Gesamtdeckung; Lücke gesondert', overlay), null);
  assert.equal(publicFinanzierung('Unbekannt', overlay), null);
  assert.equal(publicRechtsgrundlage('Mustergesetz §§ 1, 2', normalizeFreitextOverlay(undefined)), null, 'ohne Overlay nichts');
});

test('Erläuterungen und Vermerke: nur klassifizierte Texte in ihrer öffentlichen Fassung', () => {
  assert.equal(publicErlaeuterung('Zuschüsse für Bildungsprojekte.', overlay), 'Zuschüsse für Bildungsprojekte.');
  assert.equal(publicErlaeuterung('Ein unauffälliger, aber nicht klassifizierter Text.', overlay), null, 'fail-closed');
  assert.equal(publicErlaeuterung('Kassenprognose nach Fallgruppenmodell', overlay), 'Kassenprognose nach Fallgruppen');
  assert.equal(publicErlaeuterung('Unauffälliger, aber interner Text', overlay), null);
  assert.equal(publicErlaeuterung('   ', overlay), null);
  assert.equal(publicVermerk('Gesperrt bis zur Vorlage der Bauliste.', overlay), 'Gesperrt bis zur Vorlage der Bauliste.');
  assert.equal(publicVermerk('Gesperrter Vermerk', overlay), null);
  assert.equal(publicVermerk('Einsparungen aus F12 sind enthalten.', overlay), 'Einsparungen aus der Zinssteuerung sind enthalten.');
  assert.equal(publicVermerk('Nicht klassifiziert.', overlay), null);
});

test('Bezeichnungen: unauffällig unverändert, Metabegriff oder Paarform nur mit öffentlicher Fassung', () => {
  assert.equal(publicBezeichnung('Sonstige Zuweisungen an Gemeinden', overlay), 'Sonstige Zuweisungen an Gemeinden');
  assert.equal(publicBezeichnung('Entgelte der Arbeitnehmerinnen und Arbeitnehmer', overlay), 'Entgelte der Arbeitnehmer:innen');
  assert.equal(publicBezeichnung('Theater – modellierter Förderrahmen', overlay), 'Theater');
  assert.equal(publicBezeichnung(undefined, overlay), undefined);
  assert.throws(() => publicBezeichnung('Programmverwaltung (F09)', overlay), /ohne öffentliche Fassung/u);
  assert.throws(() => publicBezeichnung('Beihilfen für Versorgungsempfängerinnen und Versorgungsempfänger', overlay), /ohne öffentliche Fassung/u);
});

test('Art eines Rechtsbezugs folgt bei Normverweis dem Normstatus zum Stichtag', () => {
  const status = (slug: string) => ({ kuenftig: 'future-effective', geltend: 'in-force', aufgehoben: 'repealed' })[slug] ?? null;
  assert.equal(resolveRechtsbezugArt('geltend', 'kuenftig', status), 'verkuendet', 'verkündet, noch nicht in Kraft');
  assert.equal(resolveRechtsbezugArt('verkuendet', 'geltend', status), 'geltend', 'inzwischen in Kraft');
  assert.equal(resolveRechtsbezugArt('geltend', 'geltend', status), 'geltend');
  assert.equal(resolveRechtsbezugArt('verkuendet', undefined, status), 'verkuendet', 'ohne Norm redaktionell');
  assert.equal(resolveRechtsbezugArt('entwurf', 'kuenftig', status), 'entwurf', 'Entwürfe bleiben Entwürfe');
  assert.equal(resolveRechtsbezugArt(undefined, 'kuenftig', status), undefined);
  // Ein ausdrücklich „verkündeter“ Bezug auf eine geltende Norm meint deren noch nicht wirksame
  // Änderungsfassung und bleibt verkündet, bis der Stichtag sie erreicht.
  const kuenftigeAenderung = (slug: string) => slug === 'geltend';
  assert.equal(resolveRechtsbezugArt('verkuendet', 'geltend', status, kuenftigeAenderung), 'verkuendet');
  assert.equal(resolveRechtsbezugArt('geltend', 'geltend', status, kuenftigeAenderung), 'geltend', 'als geltend eingestuft bleibt geltend');
  assert.equal(resolveRechtsbezugArt('verkuendet', 'geltend', status, () => false), 'geltend', 'ohne künftige Fassung in Kraft');
});

test('Vorgeschriebene öffentliche Formeln gelten nur für redaktionelle Texte', () => {
  assert.deepEqual(findeMetabegriffe('Planungsannahme'), ['rechenvermerk'], 'Quelltexte bleiben streng');
  assert.deepEqual(findeMetabegriffeOeffentlich('Herkunft: Planungsannahme.'), []);
  assert.deepEqual(findeMetabegriffeOeffentlich('modellierte Planäquivalente (Vollzeitäquivalente), keine gezählten Beschäftigten'), []);
  assert.deepEqual(findeMetabegriffeOeffentlich('Planungsannahme laut Modellannahme'), ['modell']);
  assert.deepEqual(findeMetabegriffeOeffentlich('Kein zweiter Vollaufbau'), ['rechenvermerk']);
});

test('Titeltexte: jahresabhängige Felder gehen den jahresinvarianten vor', () => {
  const titel = {
    konzept_id: 'K1',
    kapitel: '0401',
    titel: '63301',
    seite: 'Ausgabe',
    hauptgruppe: '6',
    obergruppe: '63',
    gruppe: '633',
    gruppe_bezeichnung: 'Sonstige Zuweisungen an Gemeinden',
    rechtsgrundlage: 'LHO; Untersetzung offen',
    erlaeuterung: 'Allgemeine Erläuterung.',
    jahre: {
      '2091': { id: 'T.0401/63301@2091', betrag: 1, rechtsgrundlage: 'Mustergesetz §§ 1, 2' },
      '2092': { id: 'T.0401/63301@2092', betrag: 2, vermerk: 'Gesperrter Vermerk' },
    },
  } as unknown as Titel;
  assert.deepEqual(publicTiteltexte(titel, '2091', overlay), {
    rechtsgrundlage: { text: 'Mustergesetz §§ 1, 2', normSlug: 'mustergesetz', art: 'geltend' },
    finanzierung: null,
    erlaeuterung: 'Allgemeine Erläuterung.',
    vermerk: null,
  });
  assert.equal(publicTiteltexte(titel, '2092', overlay).rechtsgrundlage, null);
});

test('Suchbegriffe ohne interne Kennungen; Projektseiten nie für nicht finanzierte Vorhaben ohne Titel', () => {
  assert.deepEqual(publicSuchbegriffe(['Landesbank', 'F04', 'Gewinnabführung', '']), ['Landesbank', 'Gewinnabführung']);
  assert.deepEqual(publicSuchbegriffe(['Handelsorganisation', 'tegut', 'Laden']), ['Handelsorganisation', 'Laden']);
  const overlayVon = (status: ProjektOverlay['status']): ProjektOverlay => ({
    slug: 'muster', titel: 'Muster', fachbereich: 'Muster', status, statusText: 'Muster', topicSlugs: [], beschreibung: 'Muster', rechtsbezuege: [],
  });
  const ohneTitel = { titel: [] };
  const mitTitel = { titel: [{ kapitel: '0401', titel: '63301', konzept_id: 'K1' }] };
  assert.equal(hasProjektseite(ohneTitel, overlayVon('nicht-finanziert')), false);
  assert.equal(hasProjektseite(mitTitel, overlayVon('nicht-finanziert')), true);
  assert.equal(hasProjektseite(ohneTitel, overlayVon('beschlossen')), true);
  assert.equal(hasProjektseite(mitTitel, undefined), false, 'ohne Overlay keine Seite');
  assert.equal(formatKapitelnummer('0407'), '04 07');
  assert.equal(formatTitelnummer('63361'), '633 61');
});

function snapshotFixture(t: { after: (fn: () => void) => void }) {
  const base = mkdtempSync(join(tmpdir(), 'haushalt-freitexte-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const content = join(base, 'content');
  const snapshot = join(base, 'data', '2091-2092');
  mkdirSync(join(snapshot, 'titel'), { recursive: true });
  mkdirSync(join(content, 'haushalt', '2091-2092'), { recursive: true });
  const titel = (rechtsgrundlage: string, extra: Record<string, unknown> = {}) => ({
    kapitel: '0101', titel: '42201', rechtsgrundlage, finanzierung: 'Gesamtdeckung', jahre: { '2091': { betrag: 1 } }, ...extra,
  });
  writeFileSync(join(snapshot, 'titel', '01.json'), JSON.stringify({
    titel: [
      titel('Gesetz A', { zweckbestimmung: 'Programmverwaltung (F09)', gruppe_bezeichnung: 'Entgelte der Arbeitnehmerinnen und Arbeitnehmer' }),
      titel('Gesetz B', { zweckbestimmung: 'Zuschüsse an Vereine', erlaeuterung: 'Erläuterung mit Modellannahme', vermerk: 'Gesperrt bis zur Vorlage.' }),
    ],
  }));
  writeFileSync(join(snapshot, 'einzelplaene.json'), JSON.stringify({ einzelplaene: [{ ep: '01', bezeichnung: 'Volkskammer' }] }));
  writeFileSync(join(snapshot, 'projekte.json'), JSON.stringify({
    projekte: [
      { id: 'p1', status: 'option', jahre: { '2091': { kernhaushalt: 0, einnahmen: 0 } } },
      { id: 'p2', status: 'beschlossen', jahre: { '2091': { kernhaushalt: 5, einnahmen: 0 } } },
    ],
  }));
  const write = (datei: string, value: unknown) => writeFileSync(join(content, 'haushalt', '2091-2092', datei), JSON.stringify(value));
  const pruefe = () => {
    const problems = { problems: [] as string[], add(message: string) { this.problems.push(message); } };
    validateSnapshotOverlays({ contentRoot: content, snapshotDirectory: snapshot, periode: '2091-2092', problems });
    return problems.problems;
  };
  return { write, pruefe, snapshot };
}

const gueltigeEinzelplaene = {
  einzelplaene: { '01': { kurztitel: 'Muster', kategorie: 'Verfassungsorgan', beschreibung: 'Musterbeschreibung.', ministrySlugs: [], topicSlugs: [] } },
};
const projekt = (slug: string, status: string, extra: Record<string, unknown> = {}) => ({
  slug, titel: 'Muster', fachbereich: 'Muster', status, statusText: 'Muster', topicSlugs: [], beschreibung: 'Musterbeschreibung.', rechtsbezuege: [], ...extra,
});

test('haushalt:check: jeder Quelltext muss klassifiziert sein, öffentliche Texte ohne Arbeitsvermerk', (t) => {
  const { write, pruefe } = snapshotFixture(t);
  write('einzelplaene.json', gueltigeEinzelplaene);
  write('projekte.json', { projekte: { p1: projekt('muster-eins', 'nicht-finanziert'), p2: projekt('muster-zwei', 'beschlossen') } });
  const gueltig = {
    rechtsgrundlage: { 'Gesetz A': { anzeige: 'Gesetz A', art: 'verkuendet' }, 'Gesetz B': { anzeige: null } },
    finanzierung: { Gesamtdeckung: { anzeige: null } },
    erlaeuterung: { 'Erläuterung mit Modellannahme': { anzeige: null } },
    vermerk: { 'Gesperrt bis zur Vorlage.': { anzeige: 'Gesperrt bis zur Vorlage.' } },
    bezeichnungen: {
      'Programmverwaltung (F09)': 'Programmverwaltung',
      'Entgelte der Arbeitnehmerinnen und Arbeitnehmer': 'Entgelte der Arbeitnehmer:innen',
    },
  };
  write('freitexte.json', gueltig);
  assert.deepEqual(pruefe(), []);

  write('freitexte.json', {
    rechtsgrundlage: { 'Gesetz A': { anzeige: 'Gesetz A laut Modell' }, 'Veraltet': { anzeige: null }, 'Gesetz B': { anzeige: null, art: 'geltend' } },
    finanzierung: {},
    erlaeuterung: { 'Gibt es nicht': { anzeige: 'Text' }, 'Erläuterung mit Modellannahme': { anzeige: 'Für Schülerinnen und Schüler', art: 'geltend' } },
    bezeichnungen: { 'Programmverwaltung (F09)': 'Programmverwaltung (F09)', 'Veraltete Bezeichnung': 'Neu' },
    sonstiges: [],
  });
  const problems = pruefe().join('\n');
  assert.match(problems, /finanzierung „Gesamtdeckung“ ist nicht klassifiziert/u);
  assert.match(problems, /vermerk „Gesperrt bis zur Vorlage\.“ ist nicht klassifiziert/u);
  assert.match(problems, /anzeige enthält interne Begriffe \(modell\)/u);
  assert.match(problems, /„Veraltet“ kommt im Snapshot nicht vor/u);
  assert.match(problems, /wird nicht angezeigt und darf weder normSlug noch art oder weitere tragen/u);
  assert.match(problems, /erlaeuterung „Gibt es nicht“ kommt im Snapshot nicht vor/u);
  assert.match(problems, /erlaeuterung „Erläuterung mit Modellannahme“ → anzeige enthält eine Paarform/u);
  assert.match(problems, /erlaeuterung „Erläuterung mit Modellannahme“ hat das unbekannte Feld „art“/u);
  assert.match(problems, /Bezeichnung „Entgelte der Arbeitnehmerinnen und Arbeitnehmer“ enthält einen internen Begriff oder eine Paarform/u);
  assert.match(problems, /bezeichnungen „Programmverwaltung \(F09\)“ → Fassung enthält interne Begriffe \(kennung\)/u);
  assert.match(problems, /bezeichnungen „Veraltete Bezeichnung“ kommt im Snapshot nicht vor/u);
  assert.match(problems, /unbekannter Abschnitt „sonstiges“/u);
});

test('haushalt:check: mehrere Rechtsbezüge je Quelltext, Entwürfe ohne Normverweis', (t) => {
  const { write, pruefe } = snapshotFixture(t);
  write('einzelplaene.json', gueltigeEinzelplaene);
  write('projekte.json', { projekte: { p1: projekt('muster-eins', 'nicht-finanziert'), p2: projekt('muster-zwei', 'beschlossen') } });
  const basis = {
    finanzierung: { Gesamtdeckung: { anzeige: null } },
    erlaeuterung: { 'Erläuterung mit Modellannahme': { anzeige: null } },
    vermerk: { 'Gesperrt bis zur Vorlage.': { anzeige: 'Gesperrt bis zur Vorlage.' } },
    bezeichnungen: { 'Programmverwaltung (F09)': 'Programmverwaltung', 'Entgelte der Arbeitnehmerinnen und Arbeitnehmer': 'Entgelte der Arbeitnehmer:innen' },
  };
  write('freitexte.json', {
    ...basis,
    rechtsgrundlage: {
      'Gesetz A': { anzeige: 'Gesetz A', art: 'geltend', weitere: [{ anzeige: 'Entwurf eines Änderungsgesetzes', art: 'entwurf' }] },
      'Gesetz B': { anzeige: null },
    },
  });
  assert.deepEqual(pruefe(), []);

  write('freitexte.json', {
    ...basis,
    rechtsgrundlage: {
      'Gesetz A': { anzeige: 'Gesetz A in der Fassung des Entwurfs', art: 'entwurf', normSlug: 'muster', weitere: [{ anzeige: '', art: 'irgendwas', zusatz: 1 }] },
      'Gesetz B': { anzeige: null, weitere: [] },
    },
  });
  const problems = pruefe().join('\n');
  assert.match(problems, /„Gesetz A“: ein Entwurf verweist nicht auf eine Norm/u);
  assert.match(problems, /weitere\[0\] hat das unbekannte Feld „zusatz“/u);
  assert.match(problems, /weitere\[0\]: anzeige muss ein nicht leerer Text sein/u);
  assert.match(problems, /weitere\[0\]: art „irgendwas“ ist nicht zulässig/u);
  assert.match(problems, /„Gesetz B“ wird nicht angezeigt und darf weder normSlug noch art oder weitere tragen/u);
});

test('Öffentliche Rechtsgrundlage: weitere Bezüge behalten ihre eigene Art', () => {
  const overlay = normalizeFreitextOverlay({
    rechtsgrundlage: {
      'G1; G2': { anzeige: 'Gesetz 1', art: 'haushaltsregelung', weitere: [{ anzeige: 'Entwurf Gesetz 2', art: 'entwurf' }, { anzeige: '', art: 'entwurf' }] },
    },
  });
  const rechtsgrundlage = publicRechtsgrundlage('G1; G2', overlay);
  assert.deepEqual(rechtsgrundlageBezuege(rechtsgrundlage), [
    { text: 'Gesetz 1', art: 'haushaltsregelung' },
    { text: 'Entwurf Gesetz 2', art: 'entwurf' },
  ]);
  assert.deepEqual(rechtsgrundlageBezuege(null), []);
});

test('haushalt:check: Einzelplan- und Projekt-Overlays sind vollständig und stellen Optionen nie als finanziert dar', (t) => {
  const { write, pruefe } = snapshotFixture(t);
  write('freitexte.json', {
    rechtsgrundlage: { 'Gesetz A': { anzeige: null }, 'Gesetz B': { anzeige: null } },
    finanzierung: { Gesamtdeckung: { anzeige: null } },
    erlaeuterung: { 'Erläuterung mit Modellannahme': { anzeige: null } },
    vermerk: { 'Gesperrt bis zur Vorlage.': { anzeige: null } },
    bezeichnungen: { 'Programmverwaltung (F09)': 'Programmverwaltung', 'Entgelte der Arbeitnehmerinnen und Arbeitnehmer': 'Entgelte der Arbeitnehmer:innen' },
  });
  write('einzelplaene.json', { einzelplaene: { '01': { kurztitel: 'Muster', kategorie: 'Behörde', beschreibung: 'Im Simulationsbund.', ministrySlugs: ['x'], topicSlugs: [] }, '02': gueltigeEinzelplaene.einzelplaene['01'] } });
  write('projekte.json', {
    projekte: {
      p1: projekt('Muster Eins', 'beschlossen', { ohneSumme: true }),
      p2: projekt('muster-zwei', 'nicht-finanziert', { beschreibung: 'Finanzierung über F06.', statusText: 'Für Schülerinnen und Schüler.' }),
      p3: projekt('muster-zwei', 'geplant', {
        ohneSumme: 'ja',
        betragshinweis: 'Teilbetrag ohne Vollaufbau.',
        rechtsbezuege: [{ label: 'Gesetzentwurf', art: 'entwurf', normSlug: 'irgendeine-norm' }],
      }),
    },
  });
  const problems = pruefe().join('\n');
  assert.match(problems, /kategorie „Behörde“ ist nicht zulässig/u);
  assert.match(problems, /einzelplaene\.01\.beschreibung enthält interne Begriffe/u);
  assert.match(problems, /einzelplaene\.02 gibt es im Snapshot nicht/u);
  assert.match(problems, /projekte\.p1\.slug „Muster Eins“ ist keine gültige Adresse/u);
  assert.match(problems, /projekte\.p1 ist in der Quelle eine Option/u);
  assert.match(problems, /projekte\.p2 ist als „nicht-finanziert“ geführt, hat im Snapshot aber Beträge/u);
  assert.match(problems, /projekte\.p2\.beschreibung enthält interne Begriffe \(kennung\)/u);
  assert.match(problems, /projekte\.p3 gibt es im Snapshot nicht/u);
  assert.match(problems, /„muster-zwei“ ist bereits für p2 vergeben/u);
  assert.match(problems, /projekte\.p2\.statusText enthält eine Paarform/u);
  assert.match(problems, /projekte\.p1: ohneSumme verlangt einen betragshinweis/u);
  assert.match(problems, /projekte\.p3\.ohneSumme muss true oder false sein/u);
  assert.match(problems, /projekte\.p3\.betragshinweis enthält interne Begriffe \(rechenvermerk\)/u);
  assert.match(problems, /projekte\.p3\.rechtsbezuege\[0\]: ein Entwurf verweist nicht auf eine Norm/u);
});

test('haushalt:check: Finanzierungs-, Personal-, Fonds- und Suchzuordnungen verweisen nur auf Kennungen des Snapshots', (t) => {
  const { write, pruefe, snapshot } = snapshotFixture(t);
  writeFileSync(join(snapshot, 'finanzierung.json'), JSON.stringify({ massnahmen: [{ id: 'F01' }, { id: 'P01' }] }));
  writeFileSync(join(snapshot, 'personal.json'), JSON.stringify({ rechtsstaende: [{ code: 'R0' }], kennzahlen: [{ kennzahl: 'zugaenge' }] }));
  writeFileSync(join(snapshot, 'ruecklagen.json'), JSON.stringify({
    fonds_gegenposten: [{ fonds_id: 'X-1', art: 'earmarked' }, { fonds_id: 'X-2', art: 'special_fund' }],
    wirtschaftsplaene: [{ id: 'werk' }],
  }));
  writeFileSync(join(snapshot, 'kapitel.json'), JSON.stringify({ kapitel: [{ kapitel: '0101' }] }));
  writeFileSync(join(snapshot, 'gesamtplan.json'), JSON.stringify({ gruppierung: [{ gruppe: '422' }] }));
  write('finanzierung.json', {
    planungsstatus: 'Planungsannahme – keine bereits eingegangene Zahlung.',
    massnahmen: { F01: { titel: 'F01', erlaeuterung: 'Text.', herkunft: 'Text.', zweck: 'Text.' }, F99: { titel: 'Muster' } },
    dienstrecht: { kennung: 'P02' },
  });
  write('personal.json', { rechtsstaende: { R0: { kurz: 'Geltendes Recht' }, A: { kurz: 'Vergleich' } }, kennzahlen: { zugaenge: 'Zugänge der Beamtinnen und Beamten' } });
  write('fonds.json', {
    arten: { zweckruecklage: {}, sondervermoegen: {} },
    fonds: { 'X-1': { name: 'Rücklage', art: 'sondervermoegen', einnahmetitel: { kapitel: '0101', titel: '35999' } } },
    unternehmen: { werk: { name: 'Werk', kapitel: ['0999'] } },
  });
  write('suchbegriffe.json', { begriffe: [{ woerter: ['Kantine'], ziele: [{ kapitel: '0101', titel: '42201' }, { gruppe: '999' }, { projekt: 'p9' }, { titel: '42201' }] }] });
  const problems = pruefe().join('\n');
  assert.doesNotMatch(problems, /planungsstatus/u, 'vorgeschriebene Formel „Planungsannahme“');
  assert.match(problems, /finanzierung\.json: massnahmen\.F99 ist keine Finanzierungsmaßnahme im Snapshot/u);
  assert.match(problems, /massnahmen\.F01\.voraussetzung fehlt/u);
  assert.match(problems, /massnahmen\.F01\.titel ist eine Kennung/u);
  assert.match(problems, /dienstrecht\.kennung „P02“ ist keine Maßnahme/u);
  assert.match(problems, /personal\.json: rechtsstaende\.A ist keine Rechtsstandskennung im Snapshot/u);
  assert.match(problems, /personal\.json: kennzahlen\.zugaenge enthält eine Paarform/u);
  assert.match(problems, /fonds\.json: Fonds „X-2“ fehlt/u);
  assert.match(problems, /fonds\.X-1\.art „sondervermoegen“ passt nicht zur Art „earmarked“/u);
  assert.match(problems, /fonds\.X-1\.einnahmetitel Titel 0101\/35999 gibt es im Snapshot nicht/u);
  assert.match(problems, /unternehmen\.werk\.kapitel „0999“ gibt es im Snapshot nicht/u);
  assert.doesNotMatch(problems, /ziele\[0\]/u, 'existierender Titel');
  assert.match(problems, /ziele\[1\]\.gruppe „999“ gibt es im Snapshot nicht/u);
  assert.match(problems, /ziele\[2\]\.projekt „p9“ hat kein Projekt-Overlay/u);
  assert.match(problems, /ziele\[3\] hat keine zulässige Form/u);
});
