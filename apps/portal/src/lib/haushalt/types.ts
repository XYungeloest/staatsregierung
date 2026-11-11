/**
 * Typen des Haushaltssnapshots `haushalt-snapshot/1` unter data/haushalt/<periode>/.
 *
 * Der Snapshot wird ausschließlich durch `npm run haushalt:sync` erzeugt und durch
 * `npm run haushalt:check` geprüft. Geldbeträge sind ganze Euro (JSON-Integer). Ausnahmen sind
 * ausdrücklich gekennzeichnet: Mengen- und Satzangaben sowie Besoldungsbeträge stehen als exakte
 * Dezimaltexte, Anteile (`quote`, `funktionsvorbehalt_anteil`) als Zahl.
 *
 * Felder mit dem Vermerk **Arbeitsvermerk der Quelle** übernehmen Freitexte der
 * Haushaltsaufstellung unverändert (Modellierungs-, Nachweis- oder Simulationsvermerke,
 * interne Kennungen). Sie dienen der Nachvollziehbarkeit und sind nicht für öffentliche Seiten,
 * den Suchindex oder Downloads bestimmt; öffentliche Texte kommen aus den redaktionellen
 * Overlays unter content/haushalt/<periode>/.
 */

export const SNAPSHOT_SCHEMA = 'haushalt-snapshot/1' as const;

/** Jahreszahl als Objektschlüssel, z. B. "2027". */
export type JahrSchluessel = `${number}`;
/** Abbildung Jahr → Wert. */
export type JahresWerte<T> = Record<JahrSchluessel, T>;

/** Hauptgruppen "0" bis "9" (0–3 Einnahmen, 4–9 Ausgaben). */
export type HauptgruppenSchluessel = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type Hauptgruppen = Record<HauptgruppenSchluessel, number>;

/** Herkunftskennzeichen: amtliche Quelle, rechnerisch abgeleitet, Planungsannahme, politische Festlegung. */
export type Herkunft = 'O' | 'D' | 'S' | 'P';

export type Qualitaetsklasse =
  | 'D_belegt'
  | 'D_ableitung'
  | 'D_quellgewicht'
  | 'D_struktur'
  | 'S_statusmodell'
  | 'S_mengenmodell'
  | 'S_fachmodell'
  | 'S_rest';

export type Seite = 'Einnahme' | 'Ausgabe';

export interface SnapshotKopf {
  schema: typeof SNAPSHOT_SCHEMA;
  /** Periodenkennung, z. B. "2027-2028". */
  periode: string;
}

// ---------------------------------------------------------------------------------------------
// import-manifest.json

export interface Quellangabe {
  /** Feste Kennung des Haushaltsrepos (unabhängig vom lokalen Verzeichnisnamen). */
  repository: 'osthaushalt-2027-2028' | string;
  commit: string;
  /** Die ersten sieben Zeichen von `commit`. */
  commit_kurz: string;
  /** Commitdatum des Quellstands (ISO 8601); kein Zeitpunkt des Importlaufs. */
  commitdatum: string;
  fassung: string;
  /** Pfad der aktiven Fassung innerhalb des Haushaltsrepos, z. B. "haushalt/2027-2028". */
  pfad: string;
  basisrun: string;
  stand: string;
  korrekturvorlagen: string[];
  pruefstand: { bestanden: number; gesamt: number };
}

export interface Quelldatei {
  /** Pfad innerhalb des Haushaltsrepos. */
  pfad: string;
  sha256: string;
  /** Womit der Hash abgesichert ist: Quellmanifest oder sauberer Git-Stand. */
  pruefung: 'MANIFEST.json' | 'daten/manifest.json' | 'git';
}

export interface Snapshotdatei {
  /** Pfad relativ zu data/haushalt/<periode>/. */
  pfad: string;
  sha256: string;
  bytes: number;
}

export interface Kontrollsummen {
  einnahmen: number;
  ausgaben: number;
  einzelplaene: number;
  kapitel: number;
  titel: number;
}

/**
 * Ausgabedatei der Quelle (`quelldatei` unter `ausgabe/` des Haushaltsrepos). Übernommen wird sie
 * unverändert unter dem veröffentlichten Namen `datei` (die öffentliche Ausgabefassung
 * `<name>_oeffentlich.<endung>` als `<name>.<endung>`); gesperrte und durch die öffentliche
 * Ausgabefassung ersetzte Dateien liegen nicht im Snapshot.
 */
export type Artefakt =
  | { datei: string; quelldatei: string; status: 'uebernommen'; sha256: string; bytes: number }
  | { quelldatei: string; status: 'gesperrt' | 'ersetzt'; sha256: string; grund: string };

export interface ProjektsummenAbweichung {
  projekt: string;
  jahr: number;
  /** null, wenn das Projekt für das Jahr keinen Betrag nennt. */
  kernhaushalt: number | null;
  summe_ausgabetitel: number;
  einnahmen: number | null;
  summe_einnahmetitel: number;
}

/** Einnahmetitel eines Fondsgegenpostens, der im Titelplan in keinem Kapitel vorkommt. */
export interface FondsEinnahmetitelBefund {
  jahr: number;
  einnahmetitel: string;
  /** Anzahl der Gegenposten-Zeilen mit diesem Einnahmetitel. */
  zeilen: number;
  /** Summe der Konsolidierungseliminierung dieser Zeilen. */
  konsolidierungseliminierung: number;
}

export type ImportBefund =
  | { kennung: 'projektsummen'; beschreibung: string; geprueft: number; abweichungen: ProjektsummenAbweichung[] }
  | { kennung: 'fonds-kapitelbezuege'; beschreibung: string; kapitel: string[] }
  | { kennung: 'fonds-einnahmetitel'; beschreibung: string; abweichungen: FondsEinnahmetitelBefund[] }
  | { kennung: string; beschreibung: string; [feld: string]: unknown };

export interface Ausschluss {
  quelle: string;
  felder?: string[];
  grund: string;
}

export interface ImportManifest extends SnapshotKopf {
  quelle: Quellangabe;
  quelldateien: Quelldatei[];
  snapshotdateien: Snapshotdatei[];
  kontrollsummen: JahresWerte<Kontrollsummen>;
  /** Titelfelder, die unter `jahre` stehen. */
  titel_jahresfelder: string[];
  artefakte: Artefakt[];
  befunde: ImportBefund[];
  ausschluesse: Ausschluss[];
}

// ---------------------------------------------------------------------------------------------
// periode.json

export interface Legendeneintrag {
  kennung: string;
  bezeichnung: string;
}

export interface Periodenmeta extends SnapshotKopf {
  jahre: number[];
  /** Bezeichnung der Quelle. Arbeitsvermerk der Quelle (enthält einen Simulationszusatz). */
  quellbezeichnung: string;
  /** Status laut Quelle, z. B. "Regierungsentwurf". */
  quellstatus: string;
  /** Datenstand der Quelle (JJJJ-MM-TT). */
  stand: string;
  /** Arbeitsvermerk der Quelle (enthält einen Simulationszusatz). */
  titel_datenstatus: string;
  haushaltsvolumen: JahresWerte<number>;
  /** Volumen des festgeschriebenen Finanzrahmens vor den Korrekturvorlagen. */
  haushaltsvolumen_basis: JahresWerte<number> | null;
  /** Interne Kennung des Finanzrahmens. Arbeitsvermerk der Quelle. */
  basis: string;
  korrekturvorlagen: Array<{ id: string; kurzbeschreibung: string; art: string }>;
  legenden: {
    herkunft: Array<Legendeneintrag & { kennung: Herkunft }>;
    qualitaet: Array<Legendeneintrag & { kennung: Qualitaetsklasse; herkunft: Herkunft }>;
  };
}

// ---------------------------------------------------------------------------------------------
// gesamtplan.json

export interface GesamtplanJahr {
  einnahmen: number;
  /** Ausgaben einschließlich der Zuführung an die Liquiditätsrücklage (= Haushaltsvolumen). */
  ausgaben: number;
  haushaltsvolumen: number;
  /** Ausgaben ohne Zuführung an die Liquiditätsrücklage; entspricht `Finanzplanjahr.ausgaben`. */
  zahlungen_ohne_zufuehrung?: number;
  zufuehrung_liquiditaetsruecklage?: number;
  ungedeckt?: number;
  strukturelle_nka?: number;
  kredit_brutto?: number;
  tilgung?: number;
  nettotilgung?: number;
  zinsen?: number;
  ruecklagenentnahme?: number;
  einnahmen_vor_finanzierung?: number;
  haushaltsvolumen_baseline?: number;
  zufuehrung_baseline?: number;
  finanzierungssaldo_vor_ueberschussverwendung?: number;
  /** Weitere ganzzahlige Felder der Quelle werden unverändert übernommen. */
  [feld: string]: number | Hauptgruppen | undefined;
  hauptgruppen: Hauptgruppen;
}

export interface Gruppierungszeile {
  hauptgruppe: HauptgruppenSchluessel;
  obergruppe: string;
  gruppe: string;
  bezeichnung: string;
  jahre: JahresWerte<number>;
}

export interface Funktionszeile {
  hauptfunktion: string;
  hauptfunktion_bezeichnung: string;
  funktion: string;
  bezeichnung: string;
  /** Ausgaben je Jahr. */
  jahre: JahresWerte<number>;
}

export interface Gesamtplan extends SnapshotKopf {
  jahre: JahresWerte<GesamtplanJahr>;
  gruppierung: Gruppierungszeile[];
  funktionen: Funktionszeile[];
}

// ---------------------------------------------------------------------------------------------
// einzelplaene.json, kapitel.json

export interface Einzelplan {
  /** Zweistellige Einzelplannummer, z. B. "04". */
  ep: string;
  bezeichnung: string;
  /** Ressortbezeichnung laut Quelle (Freitext). */
  ressort: string;
  kapitel: string[];
  kapitelanzahl: number;
  titelanzahl: number;
  jahre: JahresWerte<{ einnahmen: number; ausgaben: number; hauptgruppen: Hauptgruppen }>;
}

export interface EinzelplaeneDatei extends SnapshotKopf {
  einzelplaene: Einzelplan[];
}

export interface Kapitel {
  /** Vierstellige Kapitelnummer, z. B. "0407". */
  kapitel: string;
  einzelplan: string;
  bezeichnung: string;
  funktion: string;
  funktion_bezeichnung: string;
  titelanzahl: number;
  jahre: JahresWerte<{
    einnahmen: number;
    ausgaben: number;
    /** Summe der noch nicht untersetzten Restansätze (Qualitätsklasse S_rest) der Ausgaben. */
    rest: number;
    hauptgruppen: Hauptgruppen;
  }>;
}

export interface KapitelDatei extends SnapshotKopf {
  kapitel: Kapitel[];
}

// ---------------------------------------------------------------------------------------------
// titel/<ep>.json

/** Beschreibende Felder, die je nach Datenlage oben oder unter `jahre` stehen. */
export interface TitelBeschreibung {
  titelgruppe?: string;
  zweckbestimmung?: string;
  funktion?: string;
  herkunft?: Herkunft;
  qualitaet?: Qualitaetsklasse;
  bindung?: string;
  /**
   * Arbeitsvermerk der Quelle: überwiegend Platzhalter wie „Aufgabenrecht und
   * Empfängeruntersetzung offen“, keine geprüfte Rechtsgrundlage. Nicht öffentlich anzeigen.
   */
  rechtsgrundlage?: string;
  /** Arbeitsvermerk der Quelle (Deckungsvermerk der Modellierung). Nicht öffentlich anzeigen. */
  finanzierung?: string;
  projekt_id?: string;
  einheit?: string;
  erlaeuterung?: string;
  vermerk?: string;
}

export interface TitelJahr extends TitelBeschreibung {
  /** Originale Titel-ID der Quelle, z. B. "T.0407/63361@2027". */
  id: string;
  /** Ansatz in ganzen Euro. */
  betrag: number;
  /** Verpflichtungsermächtigung in ganzen Euro, sofern angegeben. */
  ve?: number;
  /** Menge als exakter Dezimaltext. */
  menge?: string;
  /** Satz je Einheit in Euro als exakter Dezimaltext (kann Cent enthalten). */
  satz?: string;
}

export interface Titel extends TitelBeschreibung {
  konzept_id: string;
  kapitel: string;
  /** Fünfstellige Titelnummer (Gruppe + Zählnummer), je Kapitel eindeutig. */
  titel: string;
  seite: Seite;
  hauptgruppe: HauptgruppenSchluessel;
  obergruppe: string;
  gruppe: string;
  gruppe_bezeichnung: string;
  jahre: JahresWerte<TitelJahr>;
}

export interface TitelDatei extends SnapshotKopf {
  einzelplan: string;
  /** Felder, die unter `jahre` stehen. */
  jahresfelder: string[];
  titel: Titel[];
}

// ---------------------------------------------------------------------------------------------
// projekte.json

export interface ProjektTitelbezug {
  kapitel: string;
  titel: string;
  konzept_id: string;
}

export interface Projekt {
  /** Technische Kennung der Quelle (kein öffentlicher Slug). */
  id: string;
  name: string;
  art: string;
  einzelplan: string;
  /** Status laut Quelle (z. B. "beschlossen", "planung", "option"). */
  status: string;
  traeger: string;
  /** Arbeitsvermerk der Quelle; öffentliche Rechtsbezüge kommen aus dem Projekt-Overlay. */
  rechtsgrundlage: string;
  beschreibung: string;
  suchbegriffe: string[];
  kapitel: string[];
  titel: ProjektTitelbezug[];
  /** Projektsicht derselben Titel; nie zum Gesamtplan addieren. */
  jahre: JahresWerte<{ kernhaushalt: number; einnahmen: number }>;
  /** Finanzplanung (Projektion), nicht bewilligt. */
  folgejahre: JahresWerte<number>;
  folgejahre_investiv: JahresWerte<number>;
  zusatz?: {
    gegenstand?: string;
    stueckzahl?: number;
    gesamtkosten?: number;
    bisher_gezahlt?: string;
    /** Arbeitsvermerk der Quelle (kann interne Rechenstandskennungen enthalten). */
    hinweis_kredit?: string;
    unternehmensinvestition?: JahresWerte<number>;
    projektkredit?: JahresWerte<number>;
  };
}

export interface ProjekteDatei extends SnapshotKopf {
  projekte: Projekt[];
}

// ---------------------------------------------------------------------------------------------
// finanzierung.json

export interface Finanzierungsmassnahme {
  /** Interne Kennung (z. B. "F09"); öffentlicher Titel kommt aus dem Overlay. */
  id: string;
  bezeichnung: string;
  /** Arbeitsvermerk der Quelle; öffentlich nur der Overlay-Text „Voraussetzung“. */
  bedingung: string;
  /** Arbeitsvermerk der Quelle; öffentliche Rechtsbezüge kommen aus dem Overlay. */
  rechtsgrundlage: string;
  /** Planungsstatus laut Quelle (mit Herkunftskennzeichen); öffentlich über das Overlay. */
  status: string;
  jahre: JahresWerte<{ einnahmen: number; einsparungen: number; kosten: number; nettoentlastung: number }>;
}

export interface Kreditfinanzierungsjahr {
  jahr: number;
  kreditaufnahme: number;
  tilgung: number;
  nettokreditaufnahme: number;
  strukturelle_nka: number;
  strukturgrenze: number;
  /** Anschlussfinanzierung, nachrichtlich. */
  umschuldung_nachrichtlich: number;
  schuldenstand_ende: number;
  zinsen: number;
}

export interface Finanzplanjahr {
  jahr: number;
  einnahmen: number;
  /**
   * Ausgaben OHNE Zuführung an die Liquiditätsrücklage; entspricht
   * `GesamtplanJahr.zahlungen_ohne_zufuehrung`, nicht `GesamtplanJahr.ausgaben`. Nie beide
   * Werte ohne Definition als „Ausgaben“ desselben Jahres nebeneinander zeigen.
   */
  ausgaben: number;
  haushaltsvolumen: number;
  ungedeckt: number;
  zinsen: number;
  ruecklage_ende: number;
  liquiditaet_ende: number;
  schuldenstand: number;
  /** "Haushaltsjahr" oder Kennzeichnung als Projektion. */
  status: string;
  /**
   * Nettoentlastung durch die Personalreform (positiv = Entlastung). Vorzeichen entgegengesetzt
   * zu `Reformwirkungsjahr.netto`: personalreform_netto = −netto.
   */
  personalreform_netto?: number;
  haushaltsvolumen_baseline?: number;
  liquiditaet_ende_baseline?: number;
  ruecklage_ende_baseline?: number;
  schuldenstand_baseline?: number;
}

export interface Verpflichtungsermaechtigung {
  projekt: string;
  bezeichnung: string;
  kapitel: string;
  titel: string;
  /** Anteil (keine Geldangabe). */
  quote: number;
  begruendung: string;
  ve: JahresWerte<number>;
  /** Voraussichtliche Fälligkeiten künftiger Jahre (keine Bewilligung). */
  faelligkeiten: JahresWerte<number>;
  herkunft: string;
  hinweis: string;
}

export interface FinanzierungDatei extends SnapshotKopf {
  massnahmen: Finanzierungsmassnahme[];
  kreditfinanzierungsplan: Kreditfinanzierungsjahr[];
  finanzplan: Finanzplanjahr[];
  verpflichtungen: Verpflichtungsermaechtigung[];
}

// ---------------------------------------------------------------------------------------------
// ruecklagen.json

export interface AllgemeineRuecklageJahr {
  jahr: number;
  anfang: number;
  entnahme: number;
  zufuehrung: number;
  ende: number;
  mindestliquiditaet: number;
  liquiditaetsruecklage_ende: number;
}

export interface Fondsgegenposten {
  /** Technische Kennung des Fonds bzw. der Zweckrücklage. */
  fonds_id: string;
  jahr: number;
  kapitel: string;
  hauptgruppe: string;
  titelgruppe: string;
  betrag: number;
  bezeichnung: string;
  art: string;
  herkunft: string;
  gegenpartei: string;
  verwendungsart: string;
  /**
   * Titelnummer laut Quelle, KEIN garantierter Titelbezug im Snapshot: Kommt die Nummer im
   * Titelplan nicht vor, ist sie im import-manifest.json unter dem Befund
   * „fonds-einnahmetitel“ verzeichnet. Keine Titellinks daraus bilden.
   */
  einnahmetitel_kernhaushalt: string;
  /** Betrag, der bei konsolidierter Betrachtung entfällt. */
  konsolidierungseliminierung: number;
  rechtsaenderung_erforderlich: boolean;
  zielkapitel: string[];
}

export interface Wirtschaftsplanjahr {
  id: string;
  unternehmen: string;
  jahr: number;
  umsatz: number;
  investitionen: number;
  kernhaushalt: number;
  neue_kredite: number;
  schuldenstand: number;
  ausschuettung: number;
  /** Arbeitsvermerk der Quelle; öffentliche Texte kommen aus dem Unternehmens-Overlay. */
  rechtsgrundlage: string;
}

export interface RuecklagenDatei extends SnapshotKopf {
  allgemeine_ruecklage: AllgemeineRuecklageJahr[];
  fonds_gegenposten: Fondsgegenposten[];
  wirtschaftsplaene: Wirtschaftsplanjahr[];
}

// ---------------------------------------------------------------------------------------------
// personal.json

export interface StellenJahr {
  beamte_bestand: number;
  anwaerter: number;
  auszubildende: number;
  beamte_neu_o_r: number;
  arbeitnehmer: number;
  beamte: number;
  summe: number;
  beamte_bisheriges_recht: number;
  kostenaequivalent_beamte: number;
  kostenaequivalent_arbeitnehmer: number;
}

export interface StellenKapitel {
  kapitel: string;
  einzelplan: string;
  bezeichnung: string;
  bereich: string;
  herkunft: string;
  jahre: JahresWerte<StellenJahr>;
}

export interface Reformwirkungsjahr {
  jahr: number;
  besoldung: number;
  versorgung: number;
  beihilfe: number;
  tarif: number;
  verwaltung: number;
  ausgaben: number;
  steuer: number;
  fonds: number;
  einnahmen: number;
  /**
   * Nettowirkung auf den Haushalt = ausgaben − einnahmen (negativ = Entlastung). Vorzeichen
   * entgegengesetzt zu `Finanzplanjahr.personalreform_netto`.
   */
  netto: number;
}

/** Wirkung der Personalreform je Kapitel und Personalgruppe (Haushaltsjahre). */
export interface Kapitelwirkung {
  jahr: number;
  einzelplan: string;
  kapitel: string;
  bereich: string;
  gruppe: string;
  vorher: number;
  basisbereinigung: number;
  reformwirkung: number;
  finanzfolge: number;
  /** = vorher + basisbereinigung + reformwirkung + finanzfolge = Σ Titel der Gruppe im Kapitel. */
  nachher: number;
}

/** Bezeichnung eines Rechtsstands der Vergleichs- und Versorgungsreihen (z. B. R0, A, A2, B, C). */
export interface Rechtsstand {
  code: string;
  /** Bezeichnung laut Quelle, z. B. „Geltendes Ostrecht 31.12.2026“ oder „Reformentwurf“. */
  bezeichnung: string;
}

/** Modellrechnung eines Blocks (Besoldung, Anwärter:innen, Versorgung) je Rechtsstand. */
export interface Regimevergleichsreihe {
  block: string;
  /** Kennung, aufzulösen über `PersonalDatei.rechtsstaende`. */
  rechtsstand: string;
  jahre: JahresWerte<number>;
}

export interface Reformkomponente {
  jahr: number;
  komponente: string;
  bezeichnung: string;
  gruppe: string;
  seite: Seite;
  betrag: number;
}

export interface Versorgungsreihe {
  /** Kennung des Rechtsstands, aufzulösen über `PersonalDatei.rechtsstaende`. */
  rechtsstand: string;
  /** Fallgruppe (Kennung der Quelle, z. B. bestand_ruhegehalt); ohne Bezeichnung in der Quelle. */
  teil: string;
  jahre: JahresWerte<number>;
}

/** Besoldungstabelle: Gruppe → Betrag oder Stufe → Betrag (Monatsbeträge als Dezimaltext). */
export type Besoldungsordnung = Record<string, string | Record<string, string>>;

export interface Besoldungsrechtsstand {
  bezeichnung: string | null;
  gueltig_ab: string | null;
  herkunft: string | null;
  tabellen: Record<string, Besoldungsordnung | Record<string, string>>;
}

export interface Personalstrukturzeile {
  bereich: string;
  bezeichnung: string;
  jahr: number;
  ist_beamte_2024?: number;
  ist_arbeitnehmer_2024?: number;
  bestand_2026?: number;
  bestandsbeamte_im_dienst?: number;
  ruhestandszugaenge?: number;
  einstellungen_beamte_bisher?: number;
  einstellungen_o_reform?: number;
  einstellungen_r_unveraendert?: number;
  einstellungen_tarif_statt_beamte?: number;
  tarifstellen_statt_beamte_kumuliert?: number;
  [feld: string]: string | number | undefined;
  /** Anteil (keine Geldangabe). */
  funktionsvorbehalt_anteil: number;
  herkunft: string;
}

export interface PersonalDatei extends SnapshotKopf {
  stellen: {
    /** Modellierte Planäquivalente/VZÄ, keine gezählten Beschäftigten. */
    art: 'modellierte-planaequivalente';
    kapitel: StellenKapitel[];
  };
  /** Legende der Rechtsstandskennungen (aus der Regimevergleichstabelle der Quelle). */
  rechtsstaende: Rechtsstand[];
  reformwirkung: { jahre: Reformwirkungsjahr[]; komponenten: Reformkomponente[] };
  kapitelwirkung: Kapitelwirkung[];
  /** Reformannahmen (Rechtsstand C) sind Entwurf und nie als geltendes Recht darzustellen. */
  regimevergleich: Regimevergleichsreihe[];
  versorgung: {
    reihen: Versorgungsreihe[];
    /** Bereits gebuchte, durch die Reform ersetzte Vorbuchung je Jahr. */
    vorbuchung: JahresWerte<number>;
    /** Barwerte der Versorgungsverpflichtungen (Rechtsstände B und C) mit Bewertungsparametern. */
    barwerte: {
      /** Dezimaltext, z. B. "0.025". */
      rechnungszins: string;
      /** Dezimaltext, z. B. "0.02". */
      dynamik: string;
      laufend_b: number;
      laufend_c: number;
      anwartschaften_b: number;
      anwartschaften_c: number;
      gesamt_b: number;
      gesamt_c: number;
      /** = gesamt_b − gesamt_c. */
      minderung: number;
      hinweis: string;
    };
    versorgungsfonds_erstattung: Array<{ jahr: number; geplant: number; tatsaechlich: number; minderung: number }>;
  };
  /** Kennungen der Quelle ohne Bezeichnung; nur mit redaktioneller Beschriftung anzeigen. */
  kennzahlen: Array<{ kennzahl: string; jahr: number; wert: number }>;
  besoldungstabellen: Record<string, Besoldungsrechtsstand>;
  personalstruktur: Personalstrukturzeile[];
  normen: Array<{ norm: string; inhalt: string; betroffen: string; modellkomponente: string; status: string }>;
}

// ---------------------------------------------------------------------------------------------
// qualitaet.json, gesetze.json

export interface QualitaetDatei extends SnapshotKopf {
  /** Ausgaben je Qualitätsklasse und Jahr. */
  klassen: JahresWerte<Partial<Record<Qualitaetsklasse, number>>>;
  groesste_restansaetze: Array<{ kapitel: string; titel: string; zweckbestimmung: string; jahr: number; betrag: number }>;
  /**
   * Prüfungen der Quelle. `name` ist ein Arbeitsvermerk der Quelle (interne Prüfbezeichnungen);
   * öffentlich nur `pruefstand` zeigen.
   */
  pruefungen: Array<{ name: string; ok: boolean }>;
  pruefstand: { bestanden: number; gesamt: number };
}

export interface GesetzDokument {
  nr: string;
  titel: string;
  art: 'gesetzentwurf' | 'synopse' | 'verordnungsentwuerfe' | 'beschlussuebersicht' | string;
  status: 'entwurf' | 'vorgesehen' | string;
}

export interface GesetzeDatei extends SnapshotKopf {
  stand: string;
  dokumente: GesetzDokument[];
}
