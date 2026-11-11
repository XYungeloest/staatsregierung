import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_BUDGET_PERIOD_ID,
  getBudgetChapterUrl,
  getBudgetDataUrl,
  getBudgetPageUrl,
  getBudgetPeriodPageUrl,
  getBudgetPeriodPlanUrl,
  getBudgetPeriodUrl,
  getBudgetPlanUrl,
  getBudgetProjectUrl,
  getBudgetSearchUrl,
  getBudgetTitleUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';
import { buildHaushaltRoutes } from '../apps/portal/src/lib/haushalt/inventory.ts';
import {
  getGeltendePeriode,
  getMassgeblichePeriode,
  getNachtragZurBezeichnung,
  getPeriode,
  getPeriodeStatusInfo,
  getVisiblePeriods,
  getVisibleSnapshotPeriods,
  isPeriodePublic,
  isPeriodeVisible,
  isPreviewOnly,
  parsePeriodenRegister,
  parseVorschauFlag,
  type PeriodenRegister,
} from '../apps/portal/src/lib/haushalt/perioden.ts';

/**
 * Periodenregister, Sichtbarkeitsgate und Statusangaben gegen ein synthetisches Register
 * (Jahre 2091 bis 2096), unabhängig vom redaktionellen Bestand unter content/haushalt/.
 */

function registerVon(perioden: unknown[]): PeriodenRegister {
  return parsePeriodenRegister({ perioden });
}

const verkuendet = {
  id: '2091-2092',
  bezeichnung: 'Doppelhaushalt 2091/2092',
  jahre: [2091, 2092],
  status: 'verkuendet',
  datenquelle: 'legacy-2025-2026',
  freigabe: { oeffentlich: true, datum: '2091-01-10', grundlage: 'Haushaltsgesetz 2091/2092' },
  rechtsgrundlage: { normSlug: 'mustergesetz' },
};
const entwurf = {
  id: '2093-2094',
  bezeichnung: 'Doppelhaushalt 2093/2094',
  jahre: [2093, 2094],
  status: 'regierungsentwurf',
  datenquelle: 'snapshot',
  freigabe: { oeffentlich: false, datum: null, grundlage: null, hinweis: 'Freigabe nach Beschluss.' },
};
const arbeitsstand = {
  id: '2095-2096',
  bezeichnung: 'Doppelhaushalt 2095/2096',
  jahre: [2095, 2096],
  status: 'arbeitsentwurf',
  datenquelle: 'snapshot',
  freigabe: { oeffentlich: false, datum: null, grundlage: null },
};
const register = registerVon([verkuendet, entwurf, arbeitsstand]);

test('Register: gültige Einträge werden typisiert übernommen', () => {
  assert.equal(register.perioden.length, 3);
  assert.deepEqual(getPeriode('2093-2094', { register })?.jahre, [2093, 2094]);
  assert.equal(getPeriode('2093-2094', { register })?.freigabe.hinweis, 'Freigabe nach Beschluss.');
  assert.equal(getPeriode('1999-2000', { register }), undefined);
});

test('Register: Formfehler brechen ab', () => {
  const kaputt = (aenderung: Record<string, unknown>) => () => registerVon([{ ...entwurf, ...aenderung }]);
  assert.throws(() => parsePeriodenRegister({}), /Liste „perioden“/u);
  assert.throws(kaputt({ id: '2093' }), /JJJJ-JJJJ/u);
  assert.throws(kaputt({ id: '2093-2095', jahre: [2093, 2095] }), /aufeinanderfolgenden/u);
  assert.throws(kaputt({ jahre: [2093, 2095] }), /jahre passen nicht/u);
  assert.throws(kaputt({ status: 'geplant' }), /Status „geplant“/u);
  assert.throws(kaputt({ datenquelle: 'tabelle' }), /datenquelle/u);
  assert.throws(kaputt({ bezeichnung: ' ' }), /bezeichnung/u);
  assert.throws(kaputt({ freigabe: { oeffentlich: true, datum: null, grundlage: 'x' } }), /Freigabedatum/u);
  assert.throws(kaputt({ freigabe: { oeffentlich: false, datum: '2093-01-01', grundlage: null } }), /trägt Freigabedatum/u);
  assert.throws(kaputt({ status: 'arbeitsentwurf', freigabe: { oeffentlich: true, datum: '2093-01-01', grundlage: 'x' } }), /Arbeitsentwurf/u);
  assert.throws(kaputt({ status: 'verkuendet', freigabe: { oeffentlich: true, datum: '2093-01-01', grundlage: 'x' } }), /ohne Rechtsgrundlage/u);
  assert.throws(kaputt({ nachtrag: { nummer: 0, status: 'beschlossen' } }), /nachtrag\.nummer/u);
  assert.throws(() => registerVon([entwurf, entwurf]), /doppelt/u);
});

test('Gate ohne Vorschau: nur freigegebene Perioden sind sichtbar', () => {
  const optionen = { register, vorschau: false };
  assert.deepEqual(getVisiblePeriods(optionen).map((periode) => periode.id), ['2091-2092']);
  const [alt, neu, arbeit] = register.perioden;
  assert.equal(isPeriodePublic(alt), true);
  assert.equal(isPeriodePublic(neu), false);
  assert.equal(isPeriodePublic(arbeit), false);
  assert.equal(isPeriodeVisible(neu, optionen), false);
  assert.deepEqual(getVisibleSnapshotPeriods({ ...optionen, hatSnapshot: () => true }), []);
});

test('Gate mit Vorschau: alle Perioden sichtbar, nicht freigegebene nur als Vorschau', () => {
  const optionen = { register, vorschau: true };
  assert.deepEqual(getVisiblePeriods(optionen).map((periode) => periode.id), ['2095-2096', '2093-2094', '2091-2092']);
  assert.deepEqual(register.perioden.map(isPreviewOnly), [false, true, true]);
  assert.deepEqual(
    getVisibleSnapshotPeriods({ ...optionen, hatSnapshot: (id) => id === '2093-2094' }).map((periode) => periode.id),
    ['2093-2094'],
  );
});

test('Vorschauschalter: nur true, „1“ und „true“ schalten die Vorschau ein', () => {
  for (const wert of [true, '1', 'true', ' TRUE ']) assert.equal(parseVorschauFlag(wert), true, String(wert));
  for (const wert of [false, undefined, '', '0', 'false', 'ja', 1]) assert.equal(parseVorschauFlag(wert), false, String(wert));
});

test('Geltende Periode: nur verkündet, öffentlich und Stichtag in den Haushaltsjahren; beschlossen ist nur maßgeblich', () => {
  assert.equal(getGeltendePeriode({ register, stichtag: '2092-06-30' })?.id, '2091-2092');
  assert.equal(getGeltendePeriode({ register, stichtag: '2093-06-30' }), undefined, 'ein Entwurf gilt nie');
  assert.equal(getGeltendePeriode({ register, stichtag: '2090-12-31' }), undefined);
  const beschlossen = registerVon([
    { ...verkuendet, status: 'beschlossen' },
    { ...entwurf, status: 'beschlossen', freigabe: { oeffentlich: true, datum: '2092-12-01', grundlage: 'Beschluss' } },
  ]);
  assert.equal(getGeltendePeriode({ register: beschlossen, stichtag: '2093-02-01' }), undefined, 'ohne Verkündung gilt kein Haushalt');
  assert.equal(getMassgeblichePeriode({ register: beschlossen, stichtag: '2093-02-01' })?.id, '2093-2094');
  assert.equal(getMassgeblichePeriode({ register, stichtag: '2093-06-30' }), undefined, 'ein Entwurf ist nie maßgeblich');
  const beide = registerVon([verkuendet, { ...entwurf, id: '2092-2093', jahre: [2092, 2093], status: 'beschlossen', freigabe: { oeffentlich: true, datum: '2091-12-01', grundlage: 'Beschluss' } }]);
  assert.equal(getGeltendePeriode({ register: beide, stichtag: '2092-03-01' })?.id, '2091-2092');
  assert.equal(getMassgeblichePeriode({ register: beide, stichtag: '2092-03-01' })?.id, '2091-2092', 'verkündet geht vor');
});

test('Statusangaben: Entwurf nie als geltender Haushalt, verkündet nur im Stichtagszeitraum', () => {
  const [alt, neu, arbeit] = register.perioden;
  const entwurfInfo = getPeriodeStatusInfo(neu, { stichtag: '2093-06-30' });
  assert.equal(entwurfInfo.label, 'Regierungsentwurf');
  assert.equal(entwurfInfo.tone, 'entwurf');
  assert.doesNotMatch(entwurfInfo.text, /Staatsrat/u, 'keine Aussage über einen Staatsratsbeschluss');
  assert.match(entwurfInfo.text, /Volkskammer hat den Haushalt noch nicht beschlossen/u);
  assert.doesNotMatch(`${entwurfInfo.label} ${entwurfInfo.text}`, /geltend/iu);
  // Auch ein veröffentlichter Regierungsentwurf behauptet keinen Staatsratsbeschluss; die
  // Freigabegrundlage belegt nur die Veröffentlichung.
  const freigegeben = registerVon([{ ...entwurf, freigabe: { oeffentlich: true, datum: '2092-10-01', grundlage: 'Veröffentlichung des Regierungsentwurfs' } }]).perioden[0];
  const freigegebenInfo = getPeriodeStatusInfo(freigegeben, { stichtag: '2093-06-30' });
  assert.equal(freigegebenInfo.label, 'Regierungsentwurf');
  assert.doesNotMatch(freigegebenInfo.text, /Staatsrat/u);
  assert.match(freigegebenInfo.text, /Volkskammer hat den Haushalt noch nicht beschlossen/u);

  assert.deepEqual(
    [getPeriodeStatusInfo(alt, { stichtag: '2091-05-01' }).label, getPeriodeStatusInfo(alt, { stichtag: '2091-05-01' }).tone],
    ['Geltender Haushalt', 'geltend'],
  );
  assert.equal(getPeriodeStatusInfo(alt, { stichtag: '2090-11-01' }).label, 'Verkündeter Haushalt');
  assert.equal(getPeriodeStatusInfo(alt, { stichtag: '2094-01-01' }).tone, 'historisch');
  assert.equal(getPeriodeStatusInfo(arbeit, { stichtag: '2094-01-01' }).label, 'Arbeitsentwurf');

  const beratung = registerVon([{ ...entwurf, status: 'parlamentarische-beratung' }]).perioden[0];
  assert.equal(getPeriodeStatusInfo(beratung, { stichtag: '2093-01-01' }).tone, 'beratung');
  const historisch = registerVon([{ ...verkuendet, status: 'historisch' }]).perioden[0];
  assert.equal(getPeriodeStatusInfo(historisch, { stichtag: '2099-01-01' }).label, 'Abgeschlossener Haushalt');

  const mitNachtrag = registerVon([{ ...verkuendet, nachtrag: { nummer: 1, status: 'regierungsentwurf' } }]).perioden[0];
  const info = getPeriodeStatusInfo(mitNachtrag, { stichtag: '2092-01-01' });
  assert.equal(info.nachtrag?.label, '1. Nachtragshaushalt');
  assert.match(info.nachtrag?.text ?? '', /noch nicht beschlossen/u);
});

test('Adressen: Haushaltsperioden, Einzelpläne, Kapitel, Titelanker und Daten', () => {
  assert.equal(getBudgetPeriodUrl('2093-2094'), '/haushalt/2093-2094/');
  assert.equal(getBudgetPeriodPageUrl('2093-2094', 'gesamtplan'), '/haushalt/2093-2094/gesamtplan/');
  assert.equal(getBudgetPeriodPlanUrl('2093-2094', '4'), '/haushalt/2093-2094/einzelplaene/04/');
  assert.equal(getBudgetChapterUrl('2093-2094', '04', '0407'), '/haushalt/2093-2094/einzelplaene/04/kapitel/0407/');
  assert.equal(getBudgetTitleUrl('2093-2094', '04', '0407', '63361'), '/haushalt/2093-2094/einzelplaene/04/kapitel/0407/#titel-63361');
  assert.equal(getBudgetProjectUrl('2093-2094', 'musterprojekt'), '/haushalt/2093-2094/projekte/musterprojekt/');
  assert.equal(getBudgetDataUrl('2093-2094', 'titel.csv'), '/haushalt/2093-2094/daten/titel.csv');
  assert.equal(getBudgetSearchUrl('2093-2094'), '/haushalt/2093-2094/suche/');
  assert.equal(getBudgetSearchUrl('2093-2094', 'Schule & Kita'), '/haushalt/2093-2094/suche/?q=Schule%20%26%20Kita');
  assert.throws(() => getBudgetPeriodUrl('2093'), /Ungültige Haushaltsperiode/u);
  assert.throws(() => getBudgetChapterUrl('2093-2094', '04', '0507'), /gehört nicht/u);
  assert.throws(() => getBudgetDataUrl('2093-2094', '../geheim.json'), /Dateiname/u);

  // Bisherige Helfer: Gesamtplan und Einzelpläne gehören zur Periode 2025/2026.
  assert.equal(LEGACY_BUDGET_PERIOD_ID, '2025-2026');
  assert.equal(getBudgetPageUrl('gesamtplan'), '/haushalt/2025-2026/gesamtplan/');
  assert.equal(getBudgetPageUrl('einzelplaene'), '/haushalt/2025-2026/einzelplaene/');
  assert.equal(getBudgetPageUrl('sondervermoegen'), '/haushalt/sondervermoegen/');
  assert.equal(getBudgetPlanUrl('7'), '/haushalt/2025-2026/einzelplaene/07/');
});

test('Inventar: Sichtbarkeit der Perioden steuert Sitemap, Übersicht und Suche', () => {
  const budgetPages = [
    { slug: 'gesamtplan', title: 'Gesamtplan', teaser: 'Muster' },
    { slug: 'einzelplaene', title: 'Einzelpläne', teaser: 'Muster' },
    { slug: 'sondervermoegen', title: 'Sondervermögen', teaser: 'Muster' },
  ];
  const legacyPlans = [{ number: '01', title: 'Musterplan', category: 'Ressort', responsibility: 'Musterstelle' }];
  const legacy = { ...verkuendet, id: '2025-2026', jahre: [2025, 2026], bezeichnung: 'Doppelhaushalt 2025/2026' };
  const ohneSnapshot = { hatSnapshot: () => false, stichtag: '2026-06-01' };

  const oeffentlich = buildHaushaltRoutes({
    budgetPages,
    legacyPlans,
    perioden: { register: registerVon([legacy, entwurf]), vorschau: false, ...ohneSnapshot },
  });
  assert.deepEqual(oeffentlich.map((route) => route.path), [
    '/haushalt/',
    '/haushalt/sondervermoegen/',
    '/haushalt/2025-2026/',
    '/haushalt/2025-2026/gesamtplan/',
    '/haushalt/2025-2026/einzelplaene/',
    '/haushalt/2025-2026/einzelplaene/01/',
  ]);
  assert.ok(oeffentlich.every((route) => route.sitemap && route.search));
  assert.ok(oeffentlich.every((route) => !route.path.includes('2093')), 'keine Spur der nicht freigegebenen Periode');
  assert.equal(oeffentlich.find((route) => route.path.endsWith('/01/'))?.overview, false);

  // Nicht freigegebene Altperiode: ohne Vorschau keine Seiten, mit Vorschau ohne Sitemap/Übersicht.
  const gesperrt = { ...legacy, status: 'regierungsentwurf', freigabe: { oeffentlich: false, datum: null, grundlage: null } };
  delete (gesperrt as { rechtsgrundlage?: unknown }).rechtsgrundlage;
  const ohne = buildHaushaltRoutes({ budgetPages, legacyPlans, perioden: { register: registerVon([gesperrt]), vorschau: false, ...ohneSnapshot } });
  assert.deepEqual(ohne.map((route) => route.path), ['/haushalt/', '/haushalt/sondervermoegen/']);
  const mit = buildHaushaltRoutes({ budgetPages, legacyPlans, perioden: { register: registerVon([gesperrt]), vorschau: true, ...ohneSnapshot } });
  const vorschauRouten = mit.filter((route) => route.path.startsWith('/haushalt/2025-2026/'));
  assert.equal(vorschauRouten.length, 4);
  assert.ok(vorschauRouten.every((route) => !route.sitemap && !route.overview && route.search));
});

test('Nachtragshaushalt: Statusabzeichen mit Ton und Zuordnung über die Periodenbezeichnung', () => {
  const register = registerVon([{ ...verkuendet, nachtrag: { nummer: 2, status: 'parlamentarische-beratung' } }, entwurf]);
  const nachtrag = getNachtragZurBezeichnung(verkuendet.bezeichnung, register.perioden, { stichtag: '2091-06-01' });
  assert.equal(nachtrag?.label, '2. Nachtragshaushalt');
  assert.equal(nachtrag?.tone, 'beratung');
  assert.match(nachtrag?.text ?? '', /beraten/u);
  assert.equal(getNachtragZurBezeichnung(entwurf.bezeichnung, register.perioden, { stichtag: '2091-06-01' }), undefined);
  assert.equal(getNachtragZurBezeichnung('Unbekannt', register.perioden), undefined);
});
