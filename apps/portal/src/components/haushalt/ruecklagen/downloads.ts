/**
 * Datendateien einer Snapshot-Periode für /haushalt/<periode>/daten/<datei> und die Downloadseite.
 *
 * Alle Dateien entstehen zur Buildzeit deterministisch aus dem Snapshot; Beträge sind ganze Euro
 * und werden unverändert übernommen. Freitexte und Bezeichnungen erscheinen nur in ihrer
 * öffentlichen Fassung (`oeffentlich.ts`, Projekt-Overlay). CSV: Semikolon, UTF-8 mit BOM,
 * Zeilenende CRLF, Kopfzeile; jede Zeile nennt Periode, Status und Datenversion. Die Metadatei
 * datenpaket.json verzeichnet Größe und SHA-256 jeder übrigen Datei.
 *
 * PDF und XLSX werden nur angeboten, wenn der Snapshot das Artefakt unter dem neutralen Namen der
 * Periode (`artefaktName`) übernommen hat (`getArtifactPath`); dass dabei die öffentliche
 * Ausgabefassung Vorrang vor der Standardausgabe hat, entscheidet und prüft der Import.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { siteConfig } from '@ostrecht/shared/config/site.ts';
import { siteUrls } from '@ostrecht/shared/config/site-routing.ts';
import { getNormUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import {
  getBudgetDataUrl,
  getBudgetPeriodPlanUrl,
  getBudgetChapterUrl,
  getBudgetProjectUrl,
  getBudgetTitleUrl,
  getImprintUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';

import { HAUPTGRUPPEN, HAUPTGRUPPEN_SCHLUESSEL, getKennzahlen, type Kennzahl } from '../../../lib/haushalt/kennzahlen.ts';
import {
  hasProjektseite,
  loadEinzelplanOverlays,
  loadFreitextOverlay,
  loadProjektOverlays,
  PROJEKT_STATUS_LABELS,
  publicBezeichnung,
  publicTiteltexte,
  RECHTSBEZUG_ART_LABELS,
  rechtsgrundlageBezuege,
  resolveRechtsbezugArt,
} from '../../../lib/haushalt/oeffentlich.ts';
import { getPeriodeStatusInfo, getVisibleSnapshotPeriods, type Haushaltsperiode } from '../../../lib/haushalt/perioden.ts';
import {
  getArtifactPath,
  loadAllTitel,
  loadEinzelplaene,
  loadGesamtplan,
  loadImportManifest,
  loadKapitel,
  loadPeriodMeta,
  loadProjekte,
  resolveHaushaltRepositoryRoot,
} from '../../../lib/haushalt/snapshot.ts';
import type { Hauptgruppen, Herkunft, JahrSchluessel } from '../../../lib/haushalt/types.ts';
import { ORIGIN_LABELS } from '../format.ts';

export type DateiFormat = 'CSV' | 'JSON' | 'PDF' | 'XLSX';

export interface Spalte {
  name: string;
  beschreibung: string;
}

export interface Datendatei {
  /** Dateiname im Pfad /haushalt/<periode>/daten/<name>. */
  name: string;
  format: DateiFormat;
  titel: string;
  beschreibung: string;
  contentType: string;
  /** Spalten (CSV) bzw. Felder (JSON). */
  spalten: Spalte[];
  /** Datenzeilen ohne Kopfzeile (CSV) bzw. Einträge (JSON); bei PDF/XLSX nicht gesetzt. */
  zeilen?: number;
  bytes: number;
  sha256: string;
  body: Uint8Array;
}

type Zelle = string | number | null | undefined;

const encoder = new TextEncoder();

function absolut(path: string): string {
  return new URL(path, `${siteUrls.portal}/`).toString();
}

/** CSV-Zelle mit Quoting und Formelschutz; reine Zahlen bleiben unverändert. */
function csvZelle(value: Zelle): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : value;
  const zahl = /^-?\d+(?:,\d+)?$/u.test(text);
  if (!zahl && /^[=+\-@\t\r]/u.test(text)) text = `'${text}`;
  return /[";\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(spalten: readonly Spalte[], zeilen: readonly Zelle[][]): string {
  const kopf = spalten.map((spalte) => csvZelle(spalte.name)).join(';');
  const rumpf = zeilen.map((zeile) => {
    if (zeile.length !== spalten.length) throw new Error(`CSV-Zeile mit ${zeile.length} statt ${spalten.length} Feldern.`);
    return zeile.map(csvZelle).join(';');
  });
  return `﻿${[kopf, ...rumpf].join('\r\n')}\r\n`;
}

/** Dezimaltext der Quelle („12.5“) in deutscher Schreibweise („12,5“). */
function dezimal(value: string | undefined): string {
  return value ? value.replace('.', ',') : '';
}

function stabilesJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const GEMEINSAME_SPALTEN: Spalte[] = [
  { name: 'Periode', beschreibung: 'Kennung der Haushaltsperiode, z. B. 2027-2028.' },
  { name: 'Status', beschreibung: 'Stand des Haushaltsverfahrens der Periode, z. B. Regierungsentwurf.' },
  { name: 'Datenversion', beschreibung: 'Kurzkennung des veröffentlichten Datenstands; die vollständige Kennung nennen die Metadaten des Datenpakets (datenpaket.json).' },
];

const HG_SPALTEN: Spalte[] = HAUPTGRUPPEN_SCHLUESSEL.map((hg) => ({
  name: `Hauptgruppe ${hg} (Euro)`,
  beschreibung: `Hauptgruppe ${hg}: ${HAUPTGRUPPEN[hg].amtlich}.`,
}));

function hgWerte(hauptgruppen: Hauptgruppen): number[] {
  return HAUPTGRUPPEN_SCHLUESSEL.map((hg) => hauptgruppen[hg]);
}

interface Kontext {
  periode: Haushaltsperiode;
  id: string;
  status: string;
  datenversion: string;
  jahre: string[];
}

function kontext(id: string): Kontext {
  const periode = getVisibleSnapshotPeriods().find((entry) => entry.id === id);
  if (!periode) throw new Error(`Haushaltsperiode „${id}“ ist in diesem Build nicht sichtbar.`);
  return {
    periode,
    id,
    status: getPeriodeStatusInfo(periode).label,
    datenversion: loadImportManifest(id).quelle.commit_kurz,
    jahre: periode.jahre.map(String),
  };
}

function kopfwerte(k: Kontext): Zelle[] {
  return [k.id, k.status, k.datenversion];
}

// ---------------------------------------------------------------------------------------------
// Einzelne Dateien

interface Entwurf {
  name: string;
  format: DateiFormat;
  titel: string;
  beschreibung: string;
  contentType: string;
  spalten: Spalte[];
  zeilen?: number;
  inhalt: string | Uint8Array;
}

function gesamtplanCsv(k: Kontext): Entwurf {
  const gesamtplan = loadGesamtplan(k.id);
  const freitexte = loadFreitextOverlay(k.id);
  const spalten: Spalte[] = [
    ...GEMEINSAME_SPALTEN,
    { name: 'Jahr', beschreibung: 'Haushaltsjahr.' },
    { name: 'Ebene', beschreibung: 'Eckwert (Größe des Gesamtplans), Hauptgruppe oder Gruppe des Gruppierungsplans. Nur Zeilen derselben Ebene und Seite ergeben zusammen eine Summe.' },
    { name: 'Kennung', beschreibung: 'Kennung des Eckwerts bzw. Nummer der Hauptgruppe oder Gruppe.' },
    { name: 'Seite', beschreibung: 'Einnahme oder Ausgabe (bei Hauptgruppen und Gruppen).' },
    { name: 'Hauptgruppe', beschreibung: 'Hauptgruppe des Gruppierungsplans (0 bis 9).' },
    { name: 'Obergruppe', beschreibung: 'Obergruppe des Gruppierungsplans (zweistellig).' },
    { name: 'Gruppe', beschreibung: 'Gruppe des Gruppierungsplans (dreistellig).' },
    { name: 'Bezeichnung', beschreibung: 'Bezeichnung des Eckwerts, der Hauptgruppe oder der Gruppe.' },
    { name: 'Betrag (Euro)', beschreibung: 'Betrag in ganzen Euro.' },
    { name: 'Erläuterung', beschreibung: 'Abgrenzung des Eckwerts.' },
  ];
  const zeilen: Zelle[][] = [];
  for (const jahr of k.jahre) {
    const block = getKennzahlen(gesamtplan, jahr);
    const eckwerte = [
      block.einnahmen,
      block.ausgaben,
      block.haushaltsvolumen,
      block.zahlungenOhneZufuehrung,
      block.finanzierungssaldo,
      block.zinsen,
      block.tilgung,
      block.nettotilgung,
      block.kreditaufnahmeBrutto,
      block.strukturelleNettokreditaufnahme,
      block.ruecklagenentnahme,
      block.zufuehrungLiquiditaetsruecklage,
    ].filter((kennzahl): kennzahl is Kennzahl => kennzahl !== null && kennzahl.quelle === 'gesamtplan');
    for (const kennzahl of eckwerte) {
      zeilen.push([...kopfwerte(k), jahr, 'Eckwert', kennzahl.id, '', '', '', '', kennzahl.label, kennzahl.betrag, kennzahl.definition]);
    }
    const hauptgruppen = gesamtplan.jahre[jahr as JahrSchluessel].hauptgruppen;
    for (const hg of HAUPTGRUPPEN_SCHLUESSEL) {
      zeilen.push([...kopfwerte(k), jahr, 'Hauptgruppe', hg, HAUPTGRUPPEN[hg].seite, hg, '', '', HAUPTGRUPPEN[hg].amtlich, hauptgruppen[hg], '']);
    }
    for (const zeile of gesamtplan.gruppierung) {
      zeilen.push([
        ...kopfwerte(k),
        jahr,
        'Gruppe',
        zeile.gruppe,
        HAUPTGRUPPEN[zeile.hauptgruppe].seite,
        zeile.hauptgruppe,
        zeile.obergruppe,
        zeile.gruppe,
        publicBezeichnung(zeile.bezeichnung, freitexte),
        zeile.jahre[jahr as JahrSchluessel] ?? 0,
        '',
      ]);
    }
  }
  return {
    name: 'gesamtplan.csv',
    format: 'CSV',
    titel: 'Gesamtplan (CSV)',
    beschreibung: 'Eckwerte des Gesamtplans sowie Einnahmen und Ausgaben nach Hauptgruppen und Gruppen des Gruppierungsplans, je Haushaltsjahr.',
    contentType: 'text/csv; charset=utf-8',
    spalten,
    zeilen: zeilen.length,
    inhalt: csv(spalten, zeilen),
  };
}

function einzelplaeneCsv(k: Kontext): Entwurf {
  const freitexte = loadFreitextOverlay(k.id);
  const overlays = loadEinzelplanOverlays(k.id);
  const spalten: Spalte[] = [
    ...GEMEINSAME_SPALTEN,
    { name: 'Jahr', beschreibung: 'Haushaltsjahr.' },
    { name: 'Einzelplan', beschreibung: 'Zweistellige Einzelplannummer (als Text einlesen, um die führende Null zu erhalten).' },
    { name: 'Bezeichnung', beschreibung: 'Amtliche Bezeichnung des Einzelplans.' },
    { name: 'Kurztitel', beschreibung: 'Kurzbezeichnung des Einzelplans.' },
    { name: 'Kapitel (Anzahl)', beschreibung: 'Zahl der Kapitel des Einzelplans.' },
    { name: 'Titel (Anzahl)', beschreibung: 'Zahl der Titel des Einzelplans.' },
    { name: 'Einnahmen (Euro)', beschreibung: 'Einnahmen in ganzen Euro.' },
    { name: 'Ausgaben (Euro)', beschreibung: 'Ausgaben in ganzen Euro.' },
    ...HG_SPALTEN,
    { name: 'Adresse', beschreibung: 'Seite des Einzelplans im Haushaltsportal.' },
  ];
  const zeilen: Zelle[][] = [];
  for (const jahr of k.jahre) {
    for (const plan of loadEinzelplaene(k.id)) {
      const werte = plan.jahre[jahr as JahrSchluessel];
      zeilen.push([
        ...kopfwerte(k),
        jahr,
        plan.ep,
        publicBezeichnung(plan.bezeichnung, freitexte),
        overlays[plan.ep]?.kurztitel ?? '',
        plan.kapitelanzahl,
        plan.titelanzahl,
        werte.einnahmen,
        werte.ausgaben,
        ...hgWerte(werte.hauptgruppen),
        absolut(getBudgetPeriodPlanUrl(k.id, plan.ep)),
      ]);
    }
  }
  return {
    name: 'einzelplaene.csv',
    format: 'CSV',
    titel: 'Einzelpläne (CSV)',
    beschreibung: 'Einnahmen und Ausgaben aller Einzelpläne nach Hauptgruppen, je Haushaltsjahr.',
    contentType: 'text/csv; charset=utf-8',
    spalten,
    zeilen: zeilen.length,
    inhalt: csv(spalten, zeilen),
  };
}

function kapitelCsv(k: Kontext): Entwurf {
  const freitexte = loadFreitextOverlay(k.id);
  const spalten: Spalte[] = [
    ...GEMEINSAME_SPALTEN,
    { name: 'Jahr', beschreibung: 'Haushaltsjahr.' },
    { name: 'Einzelplan', beschreibung: 'Zweistellige Einzelplannummer (als Text einlesen).' },
    { name: 'Kapitel', beschreibung: 'Vierstellige Kapitelnummer (als Text einlesen, um die führende Null zu erhalten).' },
    { name: 'Bezeichnung', beschreibung: 'Bezeichnung des Kapitels.' },
    { name: 'Funktion', beschreibung: 'Kennziffer der Funktion des Funktionenplans (als Text einlesen).' },
    { name: 'Funktionsbezeichnung', beschreibung: 'Bezeichnung der Funktion.' },
    { name: 'Titel (Anzahl)', beschreibung: 'Zahl der Titel des Kapitels.' },
    { name: 'Einnahmen (Euro)', beschreibung: 'Einnahmen in ganzen Euro.' },
    { name: 'Ausgaben (Euro)', beschreibung: 'Ausgaben in ganzen Euro.' },
    ...HG_SPALTEN,
    { name: 'Adresse', beschreibung: 'Seite des Kapitels im Haushaltsportal.' },
  ];
  const zeilen: Zelle[][] = [];
  for (const jahr of k.jahre) {
    for (const kapitel of loadKapitel(k.id)) {
      const werte = kapitel.jahre[jahr as JahrSchluessel];
      zeilen.push([
        ...kopfwerte(k),
        jahr,
        kapitel.einzelplan,
        kapitel.kapitel,
        publicBezeichnung(kapitel.bezeichnung, freitexte),
        kapitel.funktion,
        publicBezeichnung(kapitel.funktion_bezeichnung, freitexte),
        kapitel.titelanzahl,
        werte.einnahmen,
        werte.ausgaben,
        ...hgWerte(werte.hauptgruppen),
        absolut(getBudgetChapterUrl(k.id, kapitel.einzelplan, kapitel.kapitel)),
      ]);
    }
  }
  return {
    name: 'kapitel.csv',
    format: 'CSV',
    titel: 'Kapitel (CSV)',
    beschreibung: 'Einnahmen und Ausgaben aller Kapitel nach Hauptgruppen, je Haushaltsjahr.',
    contentType: 'text/csv; charset=utf-8',
    spalten,
    zeilen: zeilen.length,
    inhalt: csv(spalten, zeilen),
  };
}

function titelCsv(k: Kontext): Entwurf {
  const freitexte = loadFreitextOverlay(k.id);
  const projektOverlays = loadProjektOverlays(k.id);
  const funktionen = new Map(loadGesamtplan(k.id).funktionen.map((zeile) => [zeile.funktion, zeile.bezeichnung]));
  const titel = loadAllTitel(k.id);
  const mitVe = titel.some((eintrag) => Object.values(eintrag.jahre).some((jahr) => typeof jahr.ve === 'number'));
  const spalten: Spalte[] = [
    ...GEMEINSAME_SPALTEN,
    { name: 'Jahr', beschreibung: 'Haushaltsjahr.' },
    { name: 'Einzelplan', beschreibung: 'Zweistellige Einzelplannummer (als Text einlesen).' },
    { name: 'Kapitel', beschreibung: 'Vierstellige Kapitelnummer (als Text einlesen).' },
    { name: 'Titel', beschreibung: 'Fünfstellige Titelnummer, je Kapitel eindeutig (als Text einlesen).' },
    { name: 'Titelgruppe', beschreibung: 'Titelgruppe, sofern der Titel einer Titelgruppe angehört.' },
    { name: 'Zweckbestimmung', beschreibung: 'Zweckbestimmung des Titels.' },
    { name: 'Seite', beschreibung: 'Einnahme oder Ausgabe.' },
    { name: 'Hauptgruppe', beschreibung: 'Hauptgruppe des Gruppierungsplans (0 bis 9).' },
    { name: 'Obergruppe', beschreibung: 'Obergruppe des Gruppierungsplans.' },
    { name: 'Gruppe', beschreibung: 'Gruppe des Gruppierungsplans.' },
    { name: 'Gruppenbezeichnung', beschreibung: 'Bezeichnung der Gruppe.' },
    { name: 'Funktion', beschreibung: 'Kennziffer der Funktion des Funktionenplans (als Text einlesen).' },
    { name: 'Funktionsbezeichnung', beschreibung: 'Bezeichnung der Funktion.' },
    { name: 'Herkunft', beschreibung: 'Herkunft der Angabe: O, D, S oder P.' },
    { name: 'Herkunft (Bedeutung)', beschreibung: 'O amtliche Quelle, D rechnerisch abgeleitet, S Planungsannahme, P politische Festlegung.' },
    { name: 'Bindung', beschreibung: 'Rechtliche Bindung des Ansatzes (gesetzlich, vertraglich, politisch), soweit angegeben.' },
    { name: 'Betrag (Euro)', beschreibung: 'Ansatz in ganzen Euro.' },
    ...(mitVe ? [{ name: 'Verpflichtungsermächtigung (Euro)', beschreibung: 'Verpflichtungsermächtigung in ganzen Euro, soweit veranschlagt.' }] : []),
    { name: 'Menge', beschreibung: 'Mengenangabe der Veranschlagung (Dezimalkomma), soweit angegeben.' },
    { name: 'Einheit', beschreibung: 'Einheit der Mengenangabe.' },
    { name: 'Satz (Euro)', beschreibung: 'Betrag je Einheit in Euro (Dezimalkomma, kann Cent enthalten).' },
    { name: 'Rechtsgrundlage', beschreibung: 'Rechtsgrundlage des Titels, soweit veröffentlicht.' },
    { name: 'Rechtsgrundlage (Art)', beschreibung: 'Geltendes Recht, verkündet, Entwurf, haushaltsrechtliche Regelung oder Verwaltungsabkommen.' },
    { name: 'Rechtsgrundlage (Adresse)', beschreibung: 'Adresse der Vorschrift im Rechtsportal, soweit vorhanden.' },
    { name: 'Finanzierung', beschreibung: 'Finanzierungsvermerk, soweit veröffentlicht.' },
    { name: 'Erläuterung', beschreibung: 'Erläuterung zum Titel, soweit veröffentlicht.' },
    { name: 'Haushaltsvermerk', beschreibung: 'Haushaltsvermerk, soweit veröffentlicht.' },
    { name: 'Vorhaben', beschreibung: 'Vorhaben, dem der Titel zugeordnet ist.' },
    { name: 'Adresse', beschreibung: 'Adresse des Titels im Haushaltsportal.' },
  ];
  const zeilen: Zelle[][] = [];
  for (const jahr of k.jahre) {
    for (const eintrag of titel) {
      const werte = eintrag.jahre[jahr as JahrSchluessel];
      if (!werte) continue;
      const texte = publicTiteltexte(eintrag, jahr, freitexte);
      const herkunft = (werte.herkunft ?? eintrag.herkunft) as Herkunft | undefined;
      const projekt = eintrag.projekt_id ? projektOverlays[eintrag.projekt_id] : undefined;
      const funktion = werte.funktion ?? eintrag.funktion ?? '';
      const funktionsname = funktionen.get(funktion);
      const einheit = werte.einheit ?? eintrag.einheit;
      zeilen.push([
        ...kopfwerte(k),
        jahr,
        eintrag.kapitel.slice(0, 2),
        eintrag.kapitel,
        eintrag.titel,
        werte.titelgruppe ?? eintrag.titelgruppe ?? '',
        publicBezeichnung(werte.zweckbestimmung ?? eintrag.zweckbestimmung ?? '', freitexte),
        eintrag.seite,
        eintrag.hauptgruppe,
        eintrag.obergruppe,
        eintrag.gruppe,
        publicBezeichnung(eintrag.gruppe_bezeichnung, freitexte),
        funktion,
        funktionsname ? publicBezeichnung(funktionsname, freitexte) : '',
        herkunft ?? '',
        herkunft ? ORIGIN_LABELS[herkunft] : '',
        werte.bindung ?? eintrag.bindung ?? '',
        werte.betrag,
        ...(mitVe ? [typeof werte.ve === 'number' ? werte.ve : ''] : []),
        dezimal(werte.menge),
        einheit ? publicBezeichnung(einheit, freitexte) : '',
        dezimal(werte.satz),
        rechtsgrundlageBezuege(texte.rechtsgrundlage).map((bezug) => bezug.text).join('; '),
        rechtsgrundlageBezuege(texte.rechtsgrundlage).map((bezug) => (bezug.art ? RECHTSBEZUG_ART_LABELS[bezug.art] : '')).join('; '),
        rechtsgrundlageBezuege(texte.rechtsgrundlage).map((bezug) => (bezug.normSlug ? getNormUrl(bezug.normSlug) : '')).join('; '),
        texte.finanzierung ?? '',
        texte.erlaeuterung ?? '',
        texte.vermerk ?? '',
        projekt?.titel ?? '',
        absolut(getBudgetTitleUrl(k.id, eintrag.kapitel.slice(0, 2), eintrag.kapitel, eintrag.titel)),
      ]);
    }
  }
  return {
    name: 'titel.csv',
    format: 'CSV',
    titel: 'Titel (CSV)',
    beschreibung: 'Alle Titel beider Haushaltsjahre mit Zweckbestimmung, Gruppierung, Funktion, Herkunft und Ansatz.',
    contentType: 'text/csv; charset=utf-8',
    spalten,
    zeilen: zeilen.length,
    inhalt: csv(spalten, zeilen),
  };
}

interface ProjektEintrag {
  kennung: string;
  titel: string;
  fachbereich: string;
  status: string;
  statusText: string;
  einzelplan: string;
  kapitel: string[];
  beschreibung: string;
  rechtsbezuege: Array<{ bezeichnung: string; art: string; adresse?: string }>;
  haushaltstitel: Array<{ kapitel: string; titel: string; zweckbestimmung: string; adresse: string }>;
  betraege: Record<string, { ausgaben: number; einnahmen: number }> | null;
  finanzplanung: Record<string, number> | null;
  betragshinweis: string | null;
  adresse: string | null;
}

function projektEintraege(k: Kontext): ProjektEintrag[] {
  const overlays = loadProjektOverlays(k.id);
  const freitexte = loadFreitextOverlay(k.id);
  const titel = new Map(loadAllTitel(k.id).map((eintrag) => [`${eintrag.kapitel}/${eintrag.titel}`, eintrag]));
  return loadProjekte(k.id).flatMap((projekt): ProjektEintrag[] => {
    const overlay = overlays[projekt.id];
    if (!overlay) return [];
    const ohneBetraege = overlay.ohneSumme === true || (overlay.status === 'nicht-finanziert' && projekt.titel.length === 0);
    const folgejahre = Object.entries(projekt.folgejahre ?? {});
    return [
      {
        kennung: overlay.slug,
        titel: overlay.titel,
        fachbereich: overlay.fachbereich,
        status: PROJEKT_STATUS_LABELS[overlay.status],
        statusText: overlay.statusText,
        einzelplan: projekt.einzelplan,
        kapitel: [...projekt.kapitel],
        beschreibung: overlay.beschreibung,
        rechtsbezuege: overlay.rechtsbezuege.map((bezug) => {
          const art = resolveRechtsbezugArt(bezug.art, bezug.normSlug) ?? bezug.art;
          return { bezeichnung: bezug.label, art: RECHTSBEZUG_ART_LABELS[art], ...(bezug.normSlug ? { adresse: getNormUrl(bezug.normSlug) } : {}) };
        }),
        haushaltstitel: projekt.titel.map((bezug) => {
          const eintrag = titel.get(`${bezug.kapitel}/${bezug.titel}`);
          return {
            kapitel: bezug.kapitel,
            titel: bezug.titel,
            zweckbestimmung: eintrag ? publicBezeichnung(eintrag.zweckbestimmung ?? '', freitexte) : '',
            adresse: absolut(getBudgetTitleUrl(k.id, bezug.kapitel.slice(0, 2), bezug.kapitel, bezug.titel)),
          };
        }),
        betraege: ohneBetraege
          ? null
          : Object.fromEntries(
              k.jahre.map((jahr) => {
                const werte = projekt.jahre[jahr as JahrSchluessel];
                return [jahr, { ausgaben: werte?.kernhaushalt ?? 0, einnahmen: werte?.einnahmen ?? 0 }];
              }),
            ),
        finanzplanung: ohneBetraege || folgejahre.length === 0 ? null : Object.fromEntries(folgejahre),
        betragshinweis: overlay.betragshinweis ?? null,
        adresse: hasProjektseite(projekt, overlay) ? absolut(getBudgetProjectUrl(k.id, overlay.slug)) : null,
      },
    ];
  });
}

const PROJEKT_FELDER: Spalte[] = [
  { name: 'kennung', beschreibung: 'Kennung des Vorhabens (zugleich Adressbestandteil im Haushaltsportal).' },
  { name: 'titel', beschreibung: 'Bezeichnung des Vorhabens.' },
  { name: 'fachbereich', beschreibung: 'Fachbereich.' },
  { name: 'status', beschreibung: 'Status des Vorhabens.' },
  { name: 'statusText', beschreibung: 'Erläuterung des Status.' },
  { name: 'einzelplan', beschreibung: 'Einzelplan des Vorhabens.' },
  { name: 'kapitel', beschreibung: 'Kapitel mit Titeln des Vorhabens.' },
  { name: 'beschreibung', beschreibung: 'Kurzbeschreibung des Vorhabens.' },
  { name: 'rechtsbezuege', beschreibung: 'Rechtsbezüge mit Art (geltendes Recht, Entwurf usw.) und Adresse im Rechtsportal.' },
  { name: 'haushaltstitel', beschreibung: 'Titel des Haushaltsplans, die dem Vorhaben zugeordnet sind.' },
  { name: 'betraege', beschreibung: 'Ausgaben und Einnahmen des Vorhabens je Haushaltsjahr in ganzen Euro; null, wenn für das Vorhaben keine eigene Summe ausgewiesen wird.' },
  { name: 'finanzplanung', beschreibung: 'Beträge späterer Jahre in ganzen Euro; Finanzplanung (Projektion), nicht bewilligt.' },
  { name: 'betragshinweis', beschreibung: 'Hinweis, der zu den Beträgen des Vorhabens gehört.' },
  { name: 'adresse', beschreibung: 'Seite des Vorhabens im Haushaltsportal, soweit vorhanden.' },
];

const PROJEKTHINWEIS =
  'Vorhaben sind eine eigene Sicht auf Titel des Haushaltsplans. Ihre Beträge sind in den Titeln bereits enthalten und werden nicht zum Gesamtplan addiert.';

function projekteJson(k: Kontext): Entwurf {
  const projekte = projektEintraege(k);
  const meta = loadPeriodMeta(k.id);
  const inhalt = stabilesJson({
    periode: k.id,
    bezeichnung: k.periode.bezeichnung,
    status: k.status,
    datenstand: meta.stand,
    datenversion: k.datenversion,
    einheit: 'Euro',
    hinweis: PROJEKTHINWEIS,
    projekte,
  });
  return {
    name: 'projekte.json',
    format: 'JSON',
    titel: 'Vorhaben (JSON)',
    beschreibung: 'Vorhaben mit Status, Rechtsbezügen, zugeordneten Titeln, Beträgen der Haushaltsjahre und Finanzplanung.',
    contentType: 'application/json; charset=utf-8',
    spalten: PROJEKT_FELDER,
    zeilen: projekte.length,
    inhalt,
  };
}

function projekteCsv(k: Kontext): Entwurf {
  const spalten: Spalte[] = [
    ...GEMEINSAME_SPALTEN,
    { name: 'Vorhaben', beschreibung: 'Bezeichnung des Vorhabens.' },
    { name: 'Kennung', beschreibung: 'Kennung des Vorhabens.' },
    { name: 'Fachbereich', beschreibung: 'Fachbereich.' },
    { name: 'Vorhabenstatus', beschreibung: 'Status des Vorhabens.' },
    { name: 'Einzelplan', beschreibung: 'Einzelplan des Vorhabens (als Text einlesen).' },
    { name: 'Kapitel', beschreibung: 'Kapitel mit Titeln des Vorhabens, durch Komma getrennt.' },
    { name: 'Jahr', beschreibung: 'Haushaltsjahr oder Jahr der Finanzplanung.' },
    { name: 'Jahresart', beschreibung: 'Haushaltsjahr oder Finanzplanung (Projektion, nicht bewilligt).' },
    { name: 'Ausgaben (Euro)', beschreibung: 'Ausgaben des Vorhabens in ganzen Euro; leer, wenn keine eigene Summe ausgewiesen wird.' },
    { name: 'Einnahmen (Euro)', beschreibung: 'Einnahmen des Vorhabens in ganzen Euro (nur Haushaltsjahre).' },
    { name: 'Betragshinweis', beschreibung: 'Hinweis, der zu den Beträgen des Vorhabens gehört.' },
    { name: 'Adresse', beschreibung: 'Seite des Vorhabens im Haushaltsportal, soweit vorhanden.' },
  ];
  const zeilen: Zelle[][] = [];
  for (const projekt of projektEintraege(k)) {
    const basis = [projekt.titel, projekt.kennung, projekt.fachbereich, projekt.status, projekt.einzelplan, projekt.kapitel.join(', ')];
    for (const jahr of k.jahre) {
      const werte = projekt.betraege?.[jahr];
      zeilen.push([...kopfwerte(k), ...basis, jahr, 'Haushaltsjahr', werte?.ausgaben ?? '', werte?.einnahmen ?? '', projekt.betragshinweis ?? '', projekt.adresse ?? '']);
    }
    for (const [jahr, betrag] of Object.entries(projekt.finanzplanung ?? {})) {
      zeilen.push([...kopfwerte(k), ...basis, jahr, 'Finanzplanung (Projektion, nicht bewilligt)', betrag, '', projekt.betragshinweis ?? '', projekt.adresse ?? '']);
    }
  }
  return {
    name: 'projekte.csv',
    format: 'CSV',
    titel: 'Vorhaben (CSV)',
    beschreibung: 'Beträge der Vorhaben je Haushaltsjahr und Jahr der Finanzplanung als Tabelle.',
    contentType: 'text/csv; charset=utf-8',
    spalten,
    zeilen: zeilen.length,
    inhalt: csv(spalten, zeilen),
  };
}

const ARTEFAKTE: ReadonlyArray<{ endung: 'pdf' | 'xlsx'; format: DateiFormat; titel: string; beschreibung: string; contentType: string }> = [
  {
    endung: 'pdf',
    format: 'PDF',
    titel: 'Haushaltsplan (PDF)',
    beschreibung: 'Haushaltsplan als Druckfassung.',
    contentType: 'application/pdf',
  },
  {
    endung: 'xlsx',
    format: 'XLSX',
    titel: 'Haushaltsplan (Tabellenkalkulation)',
    beschreibung: 'Tabellen des Haushaltsplans als Arbeitsmappe.',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
];

/** Dateiname eines Ausgabedokuments der Periode, z. B. „Haushalt_2027_2028.pdf“. */
export function artefaktName(periode: string, endung: 'pdf' | 'xlsx'): string {
  return `Haushalt_${periode.replace('-', '_')}.${endung}`;
}

function artefakte(k: Kontext): Entwurf[] {
  return ARTEFAKTE.flatMap((artefakt): Entwurf[] => {
    const name = artefaktName(k.id, artefakt.endung);
    const pfad = getArtifactPath(k.id, name);
    if (!pfad) return [];
    return [{ name, format: artefakt.format, titel: artefakt.titel, beschreibung: artefakt.beschreibung, contentType: artefakt.contentType, spalten: [], inhalt: new Uint8Array(readFileSync(pfad)) }];
  });
}

function fertig(entwurf: Entwurf): Datendatei {
  const body = typeof entwurf.inhalt === 'string' ? encoder.encode(entwurf.inhalt) : entwurf.inhalt;
  return {
    name: entwurf.name,
    format: entwurf.format,
    titel: entwurf.titel,
    beschreibung: entwurf.beschreibung,
    contentType: entwurf.contentType,
    spalten: entwurf.spalten,
    ...(entwurf.zeilen !== undefined ? { zeilen: entwurf.zeilen } : {}),
    bytes: body.byteLength,
    sha256: createHash('sha256').update(body).digest('hex'),
    body,
  };
}

function herausgeber(): string {
  const pfad = join(resolveHaushaltRepositoryRoot(), 'content', 'ressorts', 'kapitalakkumulation-des-fiskus.json');
  if (!existsSync(pfad)) throw new Error('Ressort für Finanzen (content/ressorts/kapitalakkumulation-des-fiskus.json) fehlt.');
  const ressort = JSON.parse(readFileSync(pfad, 'utf8')) as { name?: unknown };
  if (typeof ressort.name !== 'string') throw new Error('Ressort für Finanzen ohne Namen.');
  return ressort.name;
}

/** Nutzungshinweis wie im Impressum („Urheberrecht und Nutzungsrechte“). */
const NUTZUNGSHINWEIS =
  'Inhalte, die im Rahmen der politischen Simulation erstellt wurden, dürfen für Zwecke der Simulation, Berichterstattung und Dokumentation unter Nennung der Quelle verwendet werden, sofern keine abweichenden Hinweise angegeben sind.';

function datenpaketJson(k: Kontext, dateien: readonly Datendatei[]): Entwurf {
  const meta = loadPeriodMeta(k.id);
  const manifest = loadImportManifest(k.id);
  const status = getPeriodeStatusInfo(k.periode);
  const felder: Spalte[] = [
    { name: 'periode', beschreibung: 'Kennung der Haushaltsperiode.' },
    { name: 'bezeichnung', beschreibung: 'Bezeichnung der Haushaltsperiode.' },
    { name: 'haushaltsjahre', beschreibung: 'Haushaltsjahre der Periode.' },
    { name: 'status', beschreibung: 'Stand des Haushaltsverfahrens mit Erläuterung.' },
    { name: 'datenstand', beschreibung: 'Datenstand der Angaben (JJJJ-MM-TT).' },
    { name: 'datenversion', beschreibung: 'Kennung des veröffentlichten Datenstands, kurz und vollständig.' },
    { name: 'herausgeber', beschreibung: 'Herausgebende Stelle.' },
    { name: 'quelle', beschreibung: 'Quelle der Daten: Stand des Haushaltsverfahrens, Haushaltsperiode und herausgebende Stelle.' },
    { name: 'hinweis', beschreibung: 'Hinweis zum Internetangebot.' },
    { name: 'nutzung', beschreibung: 'Hinweis zur Nutzung der Daten mit Adresse des Impressums.' },
    { name: 'format', beschreibung: 'Zeichensatz, Trennzeichen und Einheiten der Dateien.' },
    { name: 'dateien', beschreibung: 'Dateien mit Adresse, Format, Größe in Byte, SHA-256-Prüfsumme und Spaltenbeschreibung.' },
  ];
  const inhalt = stabilesJson({
    periode: k.id,
    bezeichnung: k.periode.bezeichnung,
    haushaltsjahre: k.periode.jahre,
    status: { kennung: k.periode.status, bezeichnung: status.label, erlaeuterung: status.text },
    datenstand: meta.stand,
    datenversion: { kurz: manifest.quelle.commit_kurz, vollstaendig: manifest.quelle.commit },
    herausgeber: herausgeber(),
    quelle: `${status.label} zum ${k.periode.bezeichnung}, ${herausgeber()}`,
    hinweis: siteConfig.simulationNotice,
    nutzung: { hinweis: NUTZUNGSHINWEIS, impressum: absolut(getImprintUrl()) },
    format: {
      csv: 'UTF-8 mit Byte-Order-Mark, Trennzeichen Semikolon, Zeilenende CRLF, erste Zeile mit Spaltennamen. Kennziffern mit führender Null (Einzelplan, Kapitel, Titel, Funktion) als Text einlesen.',
      betraege: 'Ganze Euro ohne Tausendertrennzeichen; Mengen und Sätze mit Dezimalkomma.',
      json: 'UTF-8, Beträge als ganze Zahlen in Euro.',
    },
    dateien: dateien.map((datei) => ({
      name: datei.name,
      adresse: absolut(getBudgetDataUrl(k.id, datei.name)),
      format: datei.format,
      titel: datei.titel,
      beschreibung: datei.beschreibung,
      bytes: datei.bytes,
      sha256: datei.sha256,
      ...(datei.zeilen !== undefined ? { zeilen: datei.zeilen } : {}),
      ...(datei.spalten.length > 0 ? { spalten: datei.spalten } : {}),
    })),
  });
  return {
    name: 'datenpaket.json',
    format: 'JSON',
    titel: 'Metadaten des Datenpakets (JSON)',
    beschreibung: 'Periode, Status, Datenstand, Datenversion, Herausgeber, Quelle und Hinweise sowie Größe, SHA-256-Prüfsumme und Spalten jeder Datei.',
    contentType: 'application/json; charset=utf-8',
    spalten: felder,
    inhalt,
  };
}

const cache = new Map<string, Datendatei[]>();

/** Alle Datendateien der Periode in Anzeigereihenfolge (datenpaket.json zuletzt). */
export function getDatendateien(periode: string): Datendatei[] {
  const cached = cache.get(periode);
  if (cached) return cached;
  const k = kontext(periode);
  const dateien = [gesamtplanCsv(k), einzelplaeneCsv(k), kapitelCsv(k), titelCsv(k), projekteCsv(k), projekteJson(k), ...artefakte(k)].map(fertig);
  const alle = [...dateien, fertig(datenpaketJson(k, dateien))];
  cache.set(periode, alle);
  return alle;
}

export function getDatendatei(periode: string, name: string): Datendatei | undefined {
  return getDatendateien(periode).find((datei) => datei.name === name);
}

/** Dateigröße deutsch: „1,2 MB“, „845 kB“, „512 Byte“. */
export function formatDateigroesse(bytes: number): string {
  const format = (value: number, digits: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(value);
  if (bytes >= 1_000_000) return `${format(bytes / 1_000_000, 1)} MB`;
  if (bytes >= 1_000) return `${format(bytes / 1_000, 0)} kB`;
  return `${format(bytes, 0)} Byte`;
}
