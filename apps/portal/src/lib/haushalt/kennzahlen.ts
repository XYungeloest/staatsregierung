import type {
  Einzelplan,
  Gesamtplan,
  GesamtplanJahr,
  Gruppierungszeile,
  Hauptgruppen,
  HauptgruppenSchluessel,
  Kapitel,
  Seite,
} from './types.ts';

/**
 * Abgeleitete Sichten auf den Haushaltssnapshot.
 *
 * Das Haushaltsrepo rechnet, das Portal zeigt: Hier entstehen ausschließlich Anteile,
 * Jahresveränderungen, Gruppierungen und ausdrücklich definierte Sammelgrößen (Investitionen =
 * HG 7 + HG 8, Schuldendienst = Zinsen + Tilgung). Jede Sammelgröße trägt ihren Definitionstext.
 * Die Kategorien der Einnahme- und Ausgabeseite sind lückenlos und überschneidungsfrei; das wird
 * bei jedem Aufruf geprüft und bricht bei einer Abweichung ab, statt still eine abweichende
 * Summe zu zeigen.
 */

export const HAUPTGRUPPEN_SCHLUESSEL: readonly HauptgruppenSchluessel[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const EINNAHME_HAUPTGRUPPEN: readonly HauptgruppenSchluessel[] = ['0', '1', '2', '3'];
export const AUSGABE_HAUPTGRUPPEN: readonly HauptgruppenSchluessel[] = ['4', '5', '6', '7', '8', '9'];

export interface HauptgruppenBezeichnung {
  /** Amtliche Kurzform für Tabellen und Diagramme. */
  kurz: string;
  /** Bezeichnung laut Gruppierungsplan. */
  amtlich: string;
  seite: Seite;
}

/** Hauptgruppen 0–9 des Gruppierungsplans. */
export const HAUPTGRUPPEN: Record<HauptgruppenSchluessel, HauptgruppenBezeichnung> = {
  '0': { kurz: 'Steuern und steuerähnliche Abgaben', amtlich: 'Einnahmen aus Steuern und steuerähnlichen Abgaben', seite: 'Einnahme' },
  '1': { kurz: 'Verwaltungseinnahmen', amtlich: 'Verwaltungseinnahmen, Einnahmen aus Schuldendienst und dergleichen', seite: 'Einnahme' },
  '2': { kurz: 'Zuweisungen und Zuschüsse (laufend)', amtlich: 'Einnahmen aus Zuweisungen und Zuschüssen mit Ausnahme für Investitionen', seite: 'Einnahme' },
  '3': {
    kurz: 'Schuldenaufnahmen, Investitionszuweisungen, besondere Finanzierungseinnahmen',
    amtlich: 'Einnahmen aus Schuldenaufnahmen, aus Zuweisungen und Zuschüssen für Investitionen, besondere Finanzierungseinnahmen',
    seite: 'Einnahme',
  },
  '4': { kurz: 'Personalausgaben', amtlich: 'Personalausgaben', seite: 'Ausgabe' },
  '5': { kurz: 'Sächliche Verwaltungsausgaben und Schuldendienst', amtlich: 'Sächliche Verwaltungsausgaben, Ausgaben für den Schuldendienst', seite: 'Ausgabe' },
  '6': { kurz: 'Zuweisungen und Zuschüsse (laufend)', amtlich: 'Ausgaben für Zuweisungen und Zuschüsse mit Ausnahme für Investitionen', seite: 'Ausgabe' },
  '7': { kurz: 'Baumaßnahmen', amtlich: 'Baumaßnahmen', seite: 'Ausgabe' },
  '8': {
    kurz: 'Sonstige Investitionen und Investitionsförderung',
    amtlich: 'Sonstige Ausgaben für Investitionen und Investitionsförderungsmaßnahmen',
    seite: 'Ausgabe',
  },
  '9': { kurz: 'Besondere Finanzierungsausgaben', amtlich: 'Besondere Finanzierungsausgaben', seite: 'Ausgabe' },
};

// ---------------------------------------------------------------------------------------------
// Anteile und Veränderungen

/** Anteil als Bruchteil (0,25 = 25 %); null, wenn das Ganze 0 ist. */
export function getAnteil(teil: number, ganzes: number): number | null {
  return ganzes === 0 ? null : teil / ganzes;
}

export interface Veraenderung {
  /** Differenz neu − alt in ganzen Euro. */
  absolut: number;
  /** Relative Veränderung als Bruchteil; null bei Ausgangswert 0. */
  relativ: number | null;
}

/** Veränderung von `alt` zu `neu`; relativ bezogen auf den Betrag des Ausgangswerts. */
export function getVeraenderung(alt: number, neu: number): Veraenderung {
  return { absolut: neu - alt, relativ: alt === 0 ? null : (neu - alt) / Math.abs(alt) };
}

function jahrDaten(gesamtplan: Gesamtplan, jahr: string): GesamtplanJahr {
  const daten = gesamtplan.jahre[jahr as `${number}`];
  if (!daten) throw new Error(`Gesamtplan ${gesamtplan.periode}: Jahr ${jahr} fehlt.`);
  return daten;
}

/** Haushaltsjahre eines Gesamtplans in aufsteigender Reihenfolge. */
export function getJahre(gesamtplan: Gesamtplan): string[] {
  return Object.keys(gesamtplan.jahre).sort();
}

// ---------------------------------------------------------------------------------------------
// Kennzahlenblock

export interface Kennzahl {
  id: string;
  label: string;
  /** Ganze Euro, unverändert aus dem Snapshot oder als definierte Summe. */
  betrag: number;
  /** Öffentliche Definition der Größe. */
  definition: string;
  /** Herkunft: Feld des Gesamtplans, Hauptgruppe oder definierte Summe aus Bestandteilen. */
  quelle: 'gesamtplan' | 'hauptgruppe' | 'summe';
  /** Einzelwerte einer Summe (z. B. HG 7 und HG 8 der Investitionen). */
  bestandteile?: Array<{ label: string; betrag: number }>;
}

export interface Kennzahlenblock {
  jahr: string;
  einnahmen: Kennzahl;
  ausgaben: Kennzahl;
  haushaltsvolumen: Kennzahl;
  zahlungenOhneZufuehrung: Kennzahl | null;
  finanzierungssaldo: Kennzahl | null;
  steuern: Kennzahl;
  personal: Kennzahl;
  investitionen: Kennzahl;
  zuweisungen: Kennzahl;
  zinsen: Kennzahl | null;
  tilgung: Kennzahl | null;
  schuldendienst: Kennzahl | null;
  ruecklagenentnahme: Kennzahl | null;
  zufuehrungLiquiditaetsruecklage: Kennzahl | null;
  strukturelleNettokreditaufnahme: Kennzahl | null;
  kreditaufnahmeBrutto: Kennzahl | null;
  nettotilgung: Kennzahl | null;
}

function feld(daten: GesamtplanJahr, name: string): number | null {
  const value = daten[name];
  return typeof value === 'number' ? value : null;
}

function quellKennzahl(daten: GesamtplanJahr, name: string, id: string, label: string, definition: string): Kennzahl | null {
  const betrag = feld(daten, name);
  return betrag === null ? null : { id, label, betrag, definition, quelle: 'gesamtplan' };
}

function hgKennzahl(hauptgruppen: Hauptgruppen, hg: HauptgruppenSchluessel, id: string, label: string): Kennzahl {
  return {
    id,
    label,
    betrag: hauptgruppen[hg],
    definition: `Hauptgruppe ${hg} des Gruppierungsplans: ${HAUPTGRUPPEN[hg].amtlich}.`,
    quelle: 'hauptgruppe',
  };
}

export const DEFINITION_INVESTITIONEN =
  'Hauptgruppe 7 (Baumaßnahmen) und Hauptgruppe 8 (sonstige Ausgaben für Investitionen und Investitionsförderungsmaßnahmen) zusammen.';
export const DEFINITION_SCHULDENDIENST =
  'Zinsen und Tilgung laut Gesamtplan zusammen. Der Schuldendienst ist keine Teilsumme der Hauptgruppen oder Ausgabekategorien und wird nicht zu ihnen addiert.';
const DEFINITION_TILGUNG = 'Planmäßige Tilgung von Kreditmarktschulden laut Gesamtplan.';
const HINWEIS_TILGUNG_OHNE_TITEL =
  'Die Tilgung ist nicht als eigener Tilgungstitel (Obergruppen 58 und 59 des Gruppierungsplans) veranschlagt; der Betrag stammt aus dem Gesamtplan.';

/** Sind im Jahr Tilgungsausgaben als Titel (Obergruppen 58/59) veranschlagt? */
function tilgungAlsTitel(gesamtplan: Gesamtplan, jahr: string): boolean {
  return gesamtplan.gruppierung.some(
    (zeile) => (zeile.obergruppe === '58' || zeile.obergruppe === '59') && (zeile.jahre[jahr as `${number}`] ?? 0) !== 0,
  );
}

/** Investitionen eines Hauptgruppenblocks: HG 7 + HG 8 mit beiden Einzelwerten. */
export function getInvestitionen(hauptgruppen: Hauptgruppen): Kennzahl {
  return {
    id: 'investitionen',
    label: 'Investitionen',
    betrag: hauptgruppen['7'] + hauptgruppen['8'],
    definition: DEFINITION_INVESTITIONEN,
    quelle: 'summe',
    bestandteile: [
      { label: HAUPTGRUPPEN['7'].kurz, betrag: hauptgruppen['7'] },
      { label: HAUPTGRUPPEN['8'].kurz, betrag: hauptgruppen['8'] },
    ],
  };
}

/** Kennzahlen eines Haushaltsjahres aus dem Gesamtplan. Optionale Quellfelder ergeben null. */
export function getKennzahlen(gesamtplan: Gesamtplan, jahr: string): Kennzahlenblock {
  const daten = jahrDaten(gesamtplan, jahr);
  const hg = daten.hauptgruppen;
  const zinsen = quellKennzahl(daten, 'zinsen', 'zinsen', 'Zinsen', 'Zinsausgaben laut Gesamtplan.');
  const tilgung = quellKennzahl(
    daten,
    'tilgung',
    'tilgung',
    'Tilgung',
    tilgungAlsTitel(gesamtplan, jahr) ? DEFINITION_TILGUNG : `${DEFINITION_TILGUNG} ${HINWEIS_TILGUNG_OHNE_TITEL}`,
  );
  const schuldendienst: Kennzahl | null =
    zinsen && tilgung
      ? {
          id: 'schuldendienst',
          label: 'Schuldendienst',
          betrag: zinsen.betrag + tilgung.betrag,
          definition: tilgungAlsTitel(gesamtplan, jahr)
            ? DEFINITION_SCHULDENDIENST
            : `${DEFINITION_SCHULDENDIENST} ${HINWEIS_TILGUNG_OHNE_TITEL}`,
          quelle: 'summe',
          bestandteile: [
            { label: zinsen.label, betrag: zinsen.betrag },
            { label: tilgung.label, betrag: tilgung.betrag },
          ],
        }
      : null;
  return {
    jahr,
    einnahmen: { id: 'einnahmen', label: 'Einnahmen', betrag: daten.einnahmen, definition: 'Gesamteinnahmen laut Gesamtplan (Hauptgruppen 0 bis 3).', quelle: 'gesamtplan' },
    ausgaben: {
      id: 'ausgaben',
      label: 'Ausgaben',
      betrag: daten.ausgaben,
      definition: 'Gesamtausgaben laut Gesamtplan (Hauptgruppen 4 bis 9) einschließlich der Zuführung an die Liquiditätsrücklage.',
      quelle: 'gesamtplan',
    },
    haushaltsvolumen: {
      id: 'haushaltsvolumen',
      label: 'Haushaltsvolumen',
      betrag: daten.haushaltsvolumen,
      definition: 'Haushaltsvolumen laut Gesamtplan.',
      quelle: 'gesamtplan',
    },
    zahlungenOhneZufuehrung: quellKennzahl(
      daten,
      'zahlungen_ohne_zufuehrung',
      'zahlungen-ohne-zufuehrung',
      'Ausgaben ohne Zuführung an die Liquiditätsrücklage',
      'Gesamtausgaben laut Gesamtplan abzüglich der Zuführung an die Liquiditätsrücklage; Bezugsgröße der Finanzplanung.',
    ),
    finanzierungssaldo: quellKennzahl(
      daten,
      'finanzierungssaldo_vor_ueberschussverwendung',
      'finanzierungssaldo',
      'Finanzierungssaldo vor Überschussverwendung',
      'Finanzierungssaldo laut Gesamtplan, bevor über die Verwendung eines Überschusses entschieden ist.',
    ),
    steuern: hgKennzahl(hg, '0', 'steuern', 'Steuern und steuerähnliche Abgaben'),
    personal: hgKennzahl(hg, '4', 'personal', 'Personalausgaben'),
    investitionen: getInvestitionen(hg),
    zuweisungen: hgKennzahl(hg, '6', 'zuweisungen', 'Zuweisungen und Zuschüsse (ohne Investitionen)'),
    zinsen,
    tilgung,
    schuldendienst,
    ruecklagenentnahme: quellKennzahl(
      daten,
      'ruecklagenentnahme',
      'ruecklagenentnahme',
      'Entnahme aus der allgemeinen Rücklage',
      'Entnahme aus der allgemeinen Rücklage laut Gesamtplan. Die Einnahmekategorie „Entnahmen aus Rücklagen, Fonds und Stöcken“ (Obergruppe 35) umfasst zusätzlich Entnahmen aus Zweckrücklagen, Fonds und Sondervermögen.',
    ),
    zufuehrungLiquiditaetsruecklage: quellKennzahl(
      daten,
      'zufuehrung_liquiditaetsruecklage',
      'zufuehrung-liquiditaetsruecklage',
      'Zuführung an die Liquiditätsrücklage',
      'Zuführung an die Liquiditätsrücklage laut Gesamtplan.',
    ),
    strukturelleNettokreditaufnahme: quellKennzahl(
      daten,
      'strukturelle_nka',
      'strukturelle-nettokreditaufnahme',
      'Strukturelle Nettokreditaufnahme',
      'Strukturelle Nettokreditaufnahme laut Gesamtplan; sie ist keine Kreditbewegung des Jahres.',
    ),
    kreditaufnahmeBrutto: quellKennzahl(
      daten,
      'kredit_brutto',
      'kreditaufnahme-brutto',
      'Bruttokreditaufnahme',
      'Neue Kreditaufnahme am Kreditmarkt laut Gesamtplan. Die Anschlussfinanzierung fällig werdender Kredite (Umschuldung) ist darin nicht enthalten und wird nur nachrichtlich geführt.',
    ),
    nettotilgung: quellKennzahl(daten, 'nettotilgung', 'nettotilgung', 'Nettotilgung', 'Tilgung abzüglich neuer Kreditaufnahme laut Gesamtplan.'),
  };
}

// ---------------------------------------------------------------------------------------------
// Kategorien nach dem Gruppierungsplan

export interface KategorieRegel {
  id: string;
  label: string;
  /** Öffentliche Definition (einbezogene Hauptgruppen, Obergruppen oder Gruppen). */
  definition: string;
  hauptgruppen?: readonly string[];
  obergruppen?: readonly string[];
  gruppen?: readonly string[];
  /** Ausnahmen innerhalb der einbezogenen Hauptgruppen oder Obergruppen. */
  ausser?: { obergruppen?: readonly string[]; gruppen?: readonly string[] };
  /** Restkategorie: nimmt alle Zeilen auf, die keine andere Regel trifft. Höchstens eine je Liste. */
  rest?: boolean;
}

export interface KategorieGruppe {
  hauptgruppe: string;
  obergruppe: string;
  gruppe: string;
  bezeichnung: string;
  betrag: number;
}

export interface KategorieWert {
  id: string;
  label: string;
  definition: string;
  /**
   * Umfang laut Regel, z. B. „Hauptgruppe 5 ohne Obergruppen 56, 57, 58, 59“ oder „Gruppe 422“;
   * bei der Restkategorie die tatsächlich enthaltenen Gruppen.
   */
  umfang: string;
  betrag: number;
  /** Anteil an der Summe der Seite (Einnahmen bzw. Ausgaben bzw. Hauptgruppe). */
  anteil: number | null;
  gruppen: KategorieGruppe[];
}

export interface KategorieOptionen {
  /** Kategorien ohne Betrag mitliefern (Standard: weglassen). */
  mitLeeren?: boolean;
}

function trifft(regel: KategorieRegel, zeile: Pick<Gruppierungszeile, 'hauptgruppe' | 'obergruppe' | 'gruppe'>): boolean {
  if (regel.rest) return false;
  const eingeschlossen =
    Boolean(regel.hauptgruppen?.includes(zeile.hauptgruppe)) ||
    Boolean(regel.obergruppen?.includes(zeile.obergruppe)) ||
    Boolean(regel.gruppen?.includes(zeile.gruppe));
  if (!eingeschlossen) return false;
  const ausgenommen =
    Boolean(regel.ausser?.obergruppen?.includes(zeile.obergruppe)) || Boolean(regel.ausser?.gruppen?.includes(zeile.gruppe));
  return !ausgenommen;
}

function aufzaehlung(einzahl: string, mehrzahl: string, werte: readonly string[]): string {
  const sortiert = [...werte].sort();
  return sortiert.length === 1 ? `${einzahl} ${sortiert[0]}` : `${mehrzahl} ${sortiert.join(', ')}`;
}

/**
 * Umfang einer Kategorie aus ihrer Regel: einbezogene Hauptgruppen, Obergruppen und Gruppen mit
 * Ausnahmen („Hauptgruppe 5 ohne Obergruppen 56, 57, 58, 59“, „Gruppe 422“). Eine
 * Restkategorie nennt die tatsächlich enthaltenen Gruppen.
 */
function umfangText(regel: KategorieRegel, gruppen: KategorieGruppe[]): string {
  if (regel.rest) {
    if (gruppen.length === 0) return 'keine Gruppen veranschlagt';
    return aufzaehlung('Gruppe', 'Gruppen', [...new Set(gruppen.map((gruppe) => gruppe.gruppe))]);
  }
  const teile: string[] = [];
  if (regel.hauptgruppen?.length) teile.push(aufzaehlung('Hauptgruppe', 'Hauptgruppen', regel.hauptgruppen));
  if (regel.obergruppen?.length) teile.push(aufzaehlung('Obergruppe', 'Obergruppen', regel.obergruppen));
  if (regel.gruppen?.length) teile.push(aufzaehlung('Gruppe', 'Gruppen', regel.gruppen));
  const ausnahmen: string[] = [];
  if (regel.ausser?.obergruppen?.length) ausnahmen.push(aufzaehlung('Obergruppe', 'Obergruppen', regel.ausser.obergruppen));
  if (regel.ausser?.gruppen?.length) ausnahmen.push(aufzaehlung('Gruppe', 'Gruppen', regel.ausser.gruppen));
  const text = teile.join(', ');
  return ausnahmen.length > 0 ? `${text} ohne ${ausnahmen.join(' und ')}` : text;
}

/**
 * Ordnet Gruppierungszeilen Kategorien zu und prüft die Zuordnung:
 * - jede Zeile trifft höchstens eine Regel (sonst Überschneidung → Fehler),
 * - Zeilen ohne Regel gehen in die Restkategorie; fehlt sie, ist das eine Lücke → Fehler,
 * - die Summe aller Kategorien entspricht `sollSumme` (sonst Fehler).
 */
export function kategorisiere(
  zeilen: ReadonlyArray<Pick<Gruppierungszeile, 'hauptgruppe' | 'obergruppe' | 'gruppe' | 'bezeichnung'> & { betrag: number }>,
  regeln: readonly KategorieRegel[],
  pruefung: { bezeichnung: string; sollSumme: number },
  optionen: KategorieOptionen = {},
): KategorieWert[] {
  const ids = new Set<string>();
  for (const regel of regeln) {
    if (ids.has(regel.id)) throw new Error(`${pruefung.bezeichnung}: Kategorie „${regel.id}“ doppelt.`);
    ids.add(regel.id);
  }
  const restRegeln = regeln.filter((regel) => regel.rest);
  if (restRegeln.length > 1) throw new Error(`${pruefung.bezeichnung}: mehr als eine Restkategorie.`);
  const rest = restRegeln[0];

  const zuordnung = new Map<string, KategorieGruppe[]>(regeln.map((regel) => [regel.id, []]));
  for (const zeile of zeilen) {
    const treffer = regeln.filter((regel) => trifft(regel, zeile));
    if (treffer.length > 1) {
      throw new Error(
        `${pruefung.bezeichnung}: Gruppe ${zeile.gruppe} fällt in mehrere Kategorien (${treffer.map((regel) => regel.id).join(', ')}).`,
      );
    }
    const ziel = treffer[0] ?? rest;
    if (!ziel) throw new Error(`${pruefung.bezeichnung}: Gruppe ${zeile.gruppe} ist keiner Kategorie zugeordnet (Lücke).`);
    zuordnung.get(ziel.id)!.push({
      hauptgruppe: zeile.hauptgruppe,
      obergruppe: zeile.obergruppe,
      gruppe: zeile.gruppe,
      bezeichnung: zeile.bezeichnung,
      betrag: zeile.betrag,
    });
  }

  const werte = regeln.map((regel): KategorieWert => {
    const gruppen = zuordnung.get(regel.id)!;
    const betrag = gruppen.reduce((summe, gruppe) => summe + gruppe.betrag, 0);
    return {
      id: regel.id,
      label: regel.label,
      definition: regel.definition,
      umfang: umfangText(regel, gruppen),
      betrag,
      anteil: getAnteil(betrag, pruefung.sollSumme),
      gruppen,
    };
  });
  const summe = werte.reduce((total, wert) => total + wert.betrag, 0);
  if (summe !== pruefung.sollSumme) {
    throw new Error(
      `${pruefung.bezeichnung}: Summe der Kategorien ${summe} weicht von ${pruefung.sollSumme} ab (Kategorien nicht lückenlos).`,
    );
  }
  return optionen.mitLeeren ? werte : werte.filter((wert) => wert.betrag !== 0);
}

/** Einnahmekategorien; lückenlos über die Hauptgruppen 0–3. */
export const EINNAHME_KATEGORIEN: readonly KategorieRegel[] = [
  {
    id: 'steuern',
    label: 'Steuern und steuerähnliche Abgaben',
    definition: 'Hauptgruppe 0 des Gruppierungsplans (Obergruppen 01 bis 09).',
    hauptgruppen: ['0'],
  },
  {
    id: 'verwaltungseinnahmen',
    label: 'Verwaltungseinnahmen',
    definition:
      'Hauptgruppe 1 des Gruppierungsplans: Gebühren und Entgelte, Geldstrafen und Bußgelder, Einnahmen aus wirtschaftlicher Tätigkeit und Vermögen sowie Einnahmen aus Schuldendienst und dergleichen.',
    hauptgruppen: ['1'],
  },
  {
    id: 'zuweisungen-laufend',
    label: 'Zuweisungen und Zuschüsse (laufend)',
    definition: 'Hauptgruppe 2 des Gruppierungsplans: Zuweisungen und Zuschüsse mit Ausnahme solcher für Investitionen.',
    hauptgruppen: ['2'],
  },
  {
    id: 'investitionszuweisungen',
    label: 'Zuweisungen und Zuschüsse für Investitionen',
    definition: 'Obergruppen 33 und 34 des Gruppierungsplans: Zuweisungen und Zuschüsse für Investitionen.',
    obergruppen: ['33', '34'],
  },
  {
    id: 'ruecklagenentnahmen',
    label: 'Entnahmen aus Rücklagen, Fonds und Stöcken',
    definition:
      'Obergruppe 35 des Gruppierungsplans: Entnahmen aus Rücklagen, Fonds und Stöcken einschließlich zweckgebundener Rücklagen und Sondervermögen; umfasst mehr als die Entnahme aus der allgemeinen Rücklage.',
    obergruppen: ['35'],
  },
  {
    id: 'schuldenaufnahmen',
    label: 'Schuldenaufnahmen',
    definition: 'Obergruppen 31 und 32 des Gruppierungsplans: Schuldenaufnahmen bei öffentlichen Bereichen und am Kreditmarkt.',
    obergruppen: ['31', '32'],
  },
  {
    id: 'uebrige-finanzierungseinnahmen',
    label: 'Übrige besondere Finanzierungseinnahmen',
    definition: 'Übrige Obergruppen der Hauptgruppe 3 des Gruppierungsplans (ohne Obergruppen 31 bis 35).',
    hauptgruppen: ['3'],
    ausser: { obergruppen: ['31', '32', '33', '34', '35'] },
  },
  {
    id: 'uebrige-einnahmen',
    label: 'Übrige Einnahmen',
    definition: 'Einnahmegruppen, die keiner der übrigen Kategorien zugeordnet sind.',
    rest: true,
  },
];

/** Ausgabekategorien; lückenlos über die Hauptgruppen 4–9. */
export const AUSGABE_KATEGORIEN: readonly KategorieRegel[] = [
  {
    id: 'personal',
    label: 'Personalausgaben',
    definition: 'Hauptgruppe 4 des Gruppierungsplans: Bezüge, Entgelte, Versorgung, Beihilfen und sonstige Personalausgaben.',
    hauptgruppen: ['4'],
  },
  {
    id: 'saechliche-verwaltungsausgaben',
    label: 'Sächliche Verwaltungsausgaben',
    definition: 'Hauptgruppe 5 des Gruppierungsplans ohne Zins- und Tilgungsausgaben (ohne Obergruppen 56 bis 59).',
    hauptgruppen: ['5'],
    ausser: { obergruppen: ['56', '57', '58', '59'] },
  },
  {
    id: 'zinsen',
    label: 'Zinsausgaben',
    definition: 'Obergruppen 56 und 57 des Gruppierungsplans: Zinsausgaben an öffentliche Bereiche und am Kreditmarkt.',
    obergruppen: ['56', '57'],
  },
  {
    id: 'tilgung',
    label: 'Tilgungsausgaben',
    definition: 'Obergruppen 58 und 59 des Gruppierungsplans: als Titel veranschlagte Tilgungsausgaben.',
    obergruppen: ['58', '59'],
  },
  {
    id: 'zuweisungen-laufend',
    label: 'Zuweisungen und Zuschüsse (laufend)',
    definition: 'Hauptgruppe 6 des Gruppierungsplans: Zuweisungen und Zuschüsse mit Ausnahme solcher für Investitionen.',
    hauptgruppen: ['6'],
  },
  {
    id: 'baumassnahmen',
    label: 'Baumaßnahmen',
    definition: 'Hauptgruppe 7 des Gruppierungsplans.',
    hauptgruppen: ['7'],
  },
  {
    id: 'investitionen-foerderung',
    label: 'Sonstige Investitionen und Investitionsförderung',
    definition:
      'Hauptgruppe 8 des Gruppierungsplans: u. a. Erwerb von Sachen, Grundstücken und Beteiligungen, Darlehen, Zuweisungen und Zuschüsse für Investitionen sowie Ausgaben aus der Inanspruchnahme aus Gewährleistungen (Obergruppe 87).',
    hauptgruppen: ['8'],
  },
  {
    id: 'zufuehrungen-ruecklagen',
    label: 'Zuführungen an Rücklagen, Fonds und Stöcke',
    definition: 'Obergruppe 91 des Gruppierungsplans; enthält auch die Zuführung an die Liquiditätsrücklage.',
    obergruppen: ['91'],
  },
  {
    id: 'uebrige-finanzierungsausgaben',
    label: 'Übrige besondere Finanzierungsausgaben',
    definition: 'Übrige Obergruppen der Hauptgruppe 9 des Gruppierungsplans (ohne Obergruppe 91).',
    hauptgruppen: ['9'],
    ausser: { obergruppen: ['91'] },
  },
  {
    id: 'uebrige-ausgaben',
    label: 'Übrige Ausgaben',
    definition: 'Ausgabegruppen, die keiner der übrigen Kategorien zugeordnet sind.',
    rest: true,
  },
];

/** Teilkategorien der Personalausgaben (Hauptgruppe 4), lückenlos. */
export const PERSONAL_KATEGORIEN: readonly KategorieRegel[] = [
  {
    id: 'bezuege-beamte',
    label: 'Bezüge der Beamt:innen und Richter:innen',
    definition: 'Gruppe 422 des Gruppierungsplans.',
    gruppen: ['422'],
  },
  {
    id: 'entgelte-arbeitnehmer',
    label: 'Entgelte der Arbeitnehmer:innen',
    definition: 'Gruppe 428 des Gruppierungsplans.',
    gruppen: ['428'],
  },
  {
    id: 'versorgung',
    label: 'Versorgungsbezüge',
    definition: 'Obergruppe 43 des Gruppierungsplans: Versorgungsbezüge und dergleichen, u. a. der Beamt:innen und Richter:innen und ihrer Hinterbliebenen.',
    obergruppen: ['43'],
  },
  {
    id: 'beihilfen',
    label: 'Beihilfen',
    definition: 'Obergruppe 44 des Gruppierungsplans: Beihilfen für aktiv Beschäftigte und Versorgungsempfänger:innen.',
    obergruppen: ['44'],
  },
  {
    id: 'uebrige-personalausgaben',
    label: 'Übrige Personalausgaben',
    definition:
      'Übrige Gruppen der Hauptgruppe 4, etwa Aufwendungen für Abgeordnete und ehrenamtlich Tätige, nicht aufteilbare Bezüge, personalbezogene Sozialversicherungsbeiträge und globale Mehrausgaben.',
    rest: true,
  },
];

function zeilenFuer(gesamtplan: Gesamtplan, jahr: string, hauptgruppen: readonly string[]) {
  jahrDaten(gesamtplan, jahr);
  return gesamtplan.gruppierung
    .filter((zeile) => hauptgruppen.includes(zeile.hauptgruppe))
    .map((zeile) => ({ ...zeile, betrag: zeile.jahre[jahr as `${number}`] ?? 0 }));
}

/** Einnahmen nach Kategorien; Σ = Einnahmen des Gesamtplans (sonst Fehler). */
export function getEinnahmeKategorien(gesamtplan: Gesamtplan, jahr: string, optionen?: KategorieOptionen): KategorieWert[] {
  return kategorisiere(
    zeilenFuer(gesamtplan, jahr, EINNAHME_HAUPTGRUPPEN),
    EINNAHME_KATEGORIEN,
    { bezeichnung: `Einnahmekategorien ${jahr}`, sollSumme: jahrDaten(gesamtplan, jahr).einnahmen },
    optionen,
  );
}

/** Ausgaben nach Kategorien; Σ = Ausgaben des Gesamtplans (sonst Fehler). */
export function getAusgabeKategorien(gesamtplan: Gesamtplan, jahr: string, optionen?: KategorieOptionen): KategorieWert[] {
  return kategorisiere(
    zeilenFuer(gesamtplan, jahr, AUSGABE_HAUPTGRUPPEN),
    AUSGABE_KATEGORIEN,
    { bezeichnung: `Ausgabekategorien ${jahr}`, sollSumme: jahrDaten(gesamtplan, jahr).ausgaben },
    optionen,
  );
}

/** Personalausgaben nach Teilkategorien; Σ = Hauptgruppe 4 (sonst Fehler). */
export function getPersonalKategorien(gesamtplan: Gesamtplan, jahr: string, optionen?: KategorieOptionen): KategorieWert[] {
  return kategorisiere(
    zeilenFuer(gesamtplan, jahr, ['4']),
    PERSONAL_KATEGORIEN,
    { bezeichnung: `Personalausgaben ${jahr}`, sollSumme: jahrDaten(gesamtplan, jahr).hauptgruppen['4'] },
    optionen,
  );
}

export interface Teilmenge {
  id: string;
  label: string;
  definition: string;
  betrag: number;
  anteil: number | null;
  gruppen: KategorieGruppe[];
}

/**
 * Einnahmegruppen „vom Bund“ als Teilmenge der Einnahmen. Nicht als „Bundesmittel insgesamt“
 * darstellen: Bundesmittel in anderen Gruppen (z. B. Titel 232 71) sind nicht enthalten.
 * Keine eigene Kategorie, überschneidet sich mit den laufenden und investiven Zuweisungen: alle
 * Einnahmegruppen, deren Bezeichnung im Gruppierungsplan „vom Bund“ lautet (z. B. 211, 231, 331).
 */
export function getBundesmittel(gesamtplan: Gesamtplan, jahr: string): Teilmenge {
  const gruppen = zeilenFuer(gesamtplan, jahr, EINNAHME_HAUPTGRUPPEN)
    .filter((zeile) => /\bvom Bund\b/u.test(zeile.bezeichnung))
    .map((zeile) => ({
      hauptgruppe: zeile.hauptgruppe,
      obergruppe: zeile.obergruppe,
      gruppe: zeile.gruppe,
      bezeichnung: zeile.bezeichnung,
      betrag: zeile.betrag,
    }));
  const betrag = gruppen.reduce((summe, gruppe) => summe + gruppe.betrag, 0);
  const codes = gruppen.map((gruppe) => gruppe.gruppe).join(', ');
  return {
    id: 'bundesmittel',
    label: 'darunter Einnahmegruppen „vom Bund“',
    definition: `Einnahmegruppen, die der Gruppierungsplan als Zuweisungen oder Zuschüsse „vom Bund“ bezeichnet (${codes || 'keine'}); Teilmenge der laufenden und investiven Zuweisungen. Bundesmittel, die in anderen Gruppen veranschlagt sind, sind nicht enthalten.`,
    betrag,
    anteil: getAnteil(betrag, jahrDaten(gesamtplan, jahr).einnahmen),
    gruppen,
  };
}

// ---------------------------------------------------------------------------------------------
// Funktionenplan

export interface Hauptfunktionswert {
  hauptfunktion: string;
  bezeichnung: string;
  betrag: number;
  anteil: number | null;
  funktionen: Array<{ funktion: string; bezeichnung: string; betrag: number }>;
}

/** Ausgaben nach Hauptfunktionen; Σ = Ausgaben des Gesamtplans (sonst Fehler). */
export function getHauptfunktionen(gesamtplan: Gesamtplan, jahr: string): Hauptfunktionswert[] {
  const ausgaben = jahrDaten(gesamtplan, jahr).ausgaben;
  const map = new Map<string, Hauptfunktionswert>();
  for (const zeile of gesamtplan.funktionen) {
    const betrag = zeile.jahre[jahr as `${number}`] ?? 0;
    let eintrag = map.get(zeile.hauptfunktion);
    if (!eintrag) {
      eintrag = { hauptfunktion: zeile.hauptfunktion, bezeichnung: zeile.hauptfunktion_bezeichnung, betrag: 0, anteil: null, funktionen: [] };
      map.set(zeile.hauptfunktion, eintrag);
    }
    eintrag.betrag += betrag;
    eintrag.funktionen.push({ funktion: zeile.funktion, bezeichnung: zeile.bezeichnung, betrag });
  }
  const werte = [...map.values()].sort((left, right) => left.hauptfunktion.localeCompare(right.hauptfunktion));
  const summe = werte.reduce((total, wert) => total + wert.betrag, 0);
  if (summe !== ausgaben) throw new Error(`Funktionenplan ${jahr}: Summe ${summe} weicht von den Ausgaben ${ausgaben} ab.`);
  for (const wert of werte) wert.anteil = getAnteil(wert.betrag, ausgaben);
  return werte;
}

// ---------------------------------------------------------------------------------------------
// Einzelpläne und Kapitel

export interface PlanJahresKennzahlen {
  einnahmen: number;
  ausgaben: number;
  /** HG 4. */
  personal: number;
  /** HG 7 + HG 8. */
  investitionen: number;
  /** Anteil an den Gesamtausgaben (Einzelplan) bzw. an den Ausgaben des Einzelplans (Kapitel). */
  anteilAusgaben: number | null;
  personalAnteil: number | null;
  investitionsAnteil: number | null;
}

export interface PlanKennzahlen {
  jahre: Record<string, PlanJahresKennzahlen>;
  /** Veränderung erstes → letztes Jahr der Periode. */
  veraenderungAusgaben: Veraenderung | null;
  veraenderungEinnahmen: Veraenderung | null;
}

function planJahr(
  daten: { einnahmen: number; ausgaben: number; hauptgruppen: Hauptgruppen },
  bezugAusgaben: number,
): PlanJahresKennzahlen {
  const investitionen = daten.hauptgruppen['7'] + daten.hauptgruppen['8'];
  return {
    einnahmen: daten.einnahmen,
    ausgaben: daten.ausgaben,
    personal: daten.hauptgruppen['4'],
    investitionen,
    anteilAusgaben: getAnteil(daten.ausgaben, bezugAusgaben),
    personalAnteil: getAnteil(daten.hauptgruppen['4'], daten.ausgaben),
    investitionsAnteil: getAnteil(investitionen, daten.ausgaben),
  };
}

function veraenderungen(jahre: Record<string, PlanJahresKennzahlen>): Pick<PlanKennzahlen, 'veraenderungAusgaben' | 'veraenderungEinnahmen'> {
  const keys = Object.keys(jahre).sort();
  if (keys.length < 2) return { veraenderungAusgaben: null, veraenderungEinnahmen: null };
  const [erstes, letztes] = [jahre[keys[0]], jahre[keys[keys.length - 1]]];
  return {
    veraenderungAusgaben: getVeraenderung(erstes.ausgaben, letztes.ausgaben),
    veraenderungEinnahmen: getVeraenderung(erstes.einnahmen, letztes.einnahmen),
  };
}

/** Kennzahlen eines Einzelplans; Anteil bezogen auf die Gesamtausgaben desselben Jahres. */
export function getEinzelplanKennzahlen(plan: Einzelplan, gesamtplan: Gesamtplan): PlanKennzahlen {
  const jahre: Record<string, PlanJahresKennzahlen> = {};
  for (const jahr of getJahre(gesamtplan)) {
    const daten = plan.jahre[jahr as `${number}`];
    if (!daten) throw new Error(`Einzelplan ${plan.ep}: Jahr ${jahr} fehlt.`);
    jahre[jahr] = planJahr(daten, jahrDaten(gesamtplan, jahr).ausgaben);
  }
  return { jahre, ...veraenderungen(jahre) };
}

export interface KapitelJahresKennzahlen extends PlanJahresKennzahlen {
  /** Noch nicht untersetzte Restansätze der Ausgaben. */
  rest: number;
}

export interface KapitelKennzahlen {
  jahre: Record<string, KapitelJahresKennzahlen>;
  veraenderungAusgaben: Veraenderung | null;
  veraenderungEinnahmen: Veraenderung | null;
}

/** Kennzahlen eines Kapitels; Anteil bezogen auf die Ausgaben seines Einzelplans. */
export function getKapitelKennzahlen(kapitel: Kapitel, plan: Einzelplan): KapitelKennzahlen {
  if (kapitel.einzelplan !== plan.ep) throw new Error(`Kapitel ${kapitel.kapitel} gehört nicht zum Einzelplan ${plan.ep}.`);
  const jahre: Record<string, KapitelJahresKennzahlen> = {};
  for (const jahr of Object.keys(kapitel.jahre).sort()) {
    const daten = kapitel.jahre[jahr as `${number}`];
    const planDaten = plan.jahre[jahr as `${number}`];
    if (!planDaten) throw new Error(`Einzelplan ${plan.ep}: Jahr ${jahr} fehlt.`);
    jahre[jahr] = { ...planJahr(daten, planDaten.ausgaben), rest: daten.rest };
  }
  return { jahre, ...veraenderungen(jahre) };
}

// ---------------------------------------------------------------------------------------------
// Periodenvergleich mit dem Doppelhaushalt 2025/2026

/**
 * Felder der bisherigen Haushaltsdaten 2025/2026 (`BudgetAmounts`); `tax` bis
 * `financingExpenses` entsprechen den Hauptgruppen 0 bis 9 der Zusammenfassung
 * (context/Staatshaushalt 2025_2026 - Zusammenfassung.csv).
 */
export interface LegacyBudgetAmounts {
  tax: number;
  administration: number;
  allocations: number;
  financingRevenue: number;
  revenue: number;
  personnel: number;
  operations: number;
  transfers: number;
  construction: number;
  investments: number;
  financingExpenses: number;
  expenses: number;
}

const LEGACY_HAUPTGRUPPEN: Record<HauptgruppenSchluessel, keyof LegacyBudgetAmounts> = {
  '0': 'tax',
  '1': 'administration',
  '2': 'allocations',
  '3': 'financingRevenue',
  '4': 'personnel',
  '5': 'operations',
  '6': 'transfers',
  '7': 'construction',
  '8': 'investments',
  '9': 'financingExpenses',
};

/** Bildet die Altwerte 2025/2026 unverändert auf die Hauptgruppen 0–9 ab. */
export function legacyAmountsToHauptgruppen(amounts: LegacyBudgetAmounts): Hauptgruppen {
  return Object.fromEntries(
    HAUPTGRUPPEN_SCHLUESSEL.map((hg) => [hg, amounts[LEGACY_HAUPTGRUPPEN[hg]]]),
  ) as Hauptgruppen;
}

/** Strukturhinweis zum Periodenvergleich, z. B. für „2027-2028“. */
export function getPeriodenvergleichHinweis(neuePeriode: string): string {
  return `Der Vergleich ist nur auf der Ebene der Gesamtsummen und Hauptgruppen möglich. Die Einzelpläne werden mit dem Doppelhaushalt ${neuePeriode.replace('-', '/')} neu zugeschnitten; Einzelplanwerte beider Perioden sind deshalb nicht miteinander vergleichbar.`;
}

export interface Periodenvergleich {
  jahre: string[];
  zeilen: Array<{ hauptgruppe: HauptgruppenSchluessel; bezeichnung: string; seite: Seite; werte: Record<string, number> }>;
  einnahmen: Record<string, number>;
  ausgaben: Record<string, number>;
  hinweis: string;
}

/**
 * Hauptgruppen und Gesamtsummen der Altperiode (Werte je Jahr) neben einem Snapshot-Gesamtplan.
 * Summen kommen jeweils aus der Quelle (`revenue`/`expenses` bzw. Gesamtplan), nicht aus einer
 * Neuberechnung.
 */
export function getPeriodenvergleich(alt: Record<string, LegacyBudgetAmounts>, neu: Gesamtplan): Periodenvergleich {
  const altJahre = Object.keys(alt).sort();
  const neuJahre = getJahre(neu);
  const jahre = [...altJahre, ...neuJahre];
  if (new Set(jahre).size !== jahre.length) throw new Error('Periodenvergleich: Jahre überschneiden sich.');
  const hgJe = new Map<string, Hauptgruppen>();
  for (const jahr of altJahre) hgJe.set(jahr, legacyAmountsToHauptgruppen(alt[jahr]));
  for (const jahr of neuJahre) hgJe.set(jahr, jahrDaten(neu, jahr).hauptgruppen);
  const zeilen = HAUPTGRUPPEN_SCHLUESSEL.map((hg) => ({
    hauptgruppe: hg,
    bezeichnung: HAUPTGRUPPEN[hg].kurz,
    seite: HAUPTGRUPPEN[hg].seite,
    werte: Object.fromEntries(jahre.map((jahr) => [jahr, hgJe.get(jahr)![hg]])),
  }));
  return {
    jahre,
    zeilen,
    einnahmen: Object.fromEntries([...altJahre.map((jahr) => [jahr, alt[jahr].revenue]), ...neuJahre.map((jahr) => [jahr, jahrDaten(neu, jahr).einnahmen])]),
    ausgaben: Object.fromEntries([...altJahre.map((jahr) => [jahr, alt[jahr].expenses]), ...neuJahre.map((jahr) => [jahr, jahrDaten(neu, jahr).ausgaben])]),
    hinweis: getPeriodenvergleichHinweis(neu.periode),
  };
}
