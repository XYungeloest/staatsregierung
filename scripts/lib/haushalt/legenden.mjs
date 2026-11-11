/**
 * Redaktionelle Zuordnungen des Imports: öffentliche Bezeichnungen der Herkunfts- und
 * Qualitätsklassen sowie die Einstufung der Dokumente des Gesetzgebungspakets. Taucht in den
 * Quelldaten eine Klasse oder ein Dokument auf, das hier nicht eingeordnet ist, bricht der
 * Import ab, statt es ungeprüft zu übernehmen.
 */

/** Öffentliche Bezeichnungen der Herkunftskennzeichen O/D/S/P. */
export const HERKUNFT_LEGENDE = [
  { kennung: 'O', bezeichnung: 'amtliche Quelle' },
  { kennung: 'D', bezeichnung: 'rechnerisch abgeleitet' },
  { kennung: 'S', bezeichnung: 'Planungsannahme' },
  { kennung: 'P', bezeichnung: 'politische Festlegung' },
];

/** Qualitätsklassen der Titel (Bedeutungen nach dem Titelqualitätsbericht der Quelle). */
export const QUALITAET_LEGENDE = [
  { kennung: 'D_belegt', bezeichnung: 'belegt', herkunft: 'D' },
  { kennung: 'D_ableitung', bezeichnung: 'abgeleitet aus Finanzrechnung oder Rechtsgrundlage', herkunft: 'D' },
  { kennung: 'D_quellgewicht', bezeichnung: 'nach Herkunftsgewicht abgeleitet', herkunft: 'D' },
  { kennung: 'D_struktur', bezeichnung: 'nach Haushaltssystematik gegliedert', herkunft: 'D' },
  { kennung: 'S_statusmodell', bezeichnung: 'Personalansatz nach Statusmodell', herkunft: 'S' },
  { kennung: 'S_mengenmodell', bezeichnung: 'Mengen- und Kostenmodell', herkunft: 'S' },
  { kennung: 'S_fachmodell', bezeichnung: 'fachliches Aufgabenmodell', herkunft: 'S' },
  { kennung: 'S_rest', bezeichnung: 'noch nicht untersetzter Restansatz', herkunft: 'S' },
];

/**
 * Einstufung der Dokumente des Gesetzgebungspakets nach ihrem Titel. Öffentlich sind Entwürfe
 * von Rechtsvorschriften und die Übersicht der erforderlichen Parlamentsbeschlüsse; interne
 * Vorlagen, Verhandlungsrahmen, Vollzugsmatrizen und Formulierungshilfen werden ausgeschlossen.
 */
export const GESETZ_DOKUMENT_REGELN = [
  { muster: /^Gesetz\b/u, art: 'gesetzentwurf', status: 'entwurf', oeffentlich: true },
  { muster: /^Synopse\b/u, art: 'synopse', status: 'entwurf', oeffentlich: true },
  { muster: /^Verordnungsentwürfe\b/u, art: 'verordnungsentwuerfe', status: 'entwurf', oeffentlich: true },
  { muster: /^Erforderliche Beschlüsse der Volkskammer\b/u, art: 'beschlussuebersicht', status: 'vorgesehen', oeffentlich: true },
  { muster: /^Unternehmens- und Beteiligungsbeschlüsse\b/u, art: 'beschlussentwuerfe', oeffentlich: false, grund: 'interne Beschlussentwürfe der Trägerorgane' },
  { muster: /^Entwürfe von Verwaltungsvereinbarungen\b/u, art: 'verwaltungsvereinbarungen', oeffentlich: false, grund: 'interner Verhandlungsrahmen' },
  { muster: /^Beschlussvorlage\b/u, art: 'beschlussvorlage', oeffentlich: false, grund: 'interne Kabinettsvorlage' },
  { muster: /^Vollzugs- und Beschlussmatrix\b/u, art: 'vollzugsmatrix', oeffentlich: false, grund: 'internes Vollzugsdokument' },
  { muster: /^Änderungsempfehlungen\b/u, art: 'aenderungsempfehlungen', oeffentlich: false, grund: 'interne Stellungnahme' },
  { muster: /^Formulierungshilfe\b/u, art: 'formulierungshilfe', oeffentlich: false, grund: 'interne Formulierungshilfe' },
];

/** Besoldungstabellen, die als Rechtsstände übernommen werden (ohne überholte Entwurfsfassungen). */
export const BESOLDUNG_RECHTSSTAENDE = ['ost_2023', 'sn_2025_01', 'sn_2025_02', 'reform_2027'];

/**
 * Feste Quellkennung des Haushaltsrepos im import-manifest.json. Sie hängt bewusst nicht vom
 * lokalen Verzeichnisnamen des Klons ab, damit der Snapshot reproduzierbar bleibt.
 */
export const QUELL_REPOSITORY = 'osthaushalt-2027-2028';

/**
 * Abschnitte, die in den Ausgabedateien (PDF, Arbeitsmappe) auf nicht öffentliche Inhalte
 * hinweisen. Sie entsprechen den Ausschlüssen der Datenübernahme (Finanzierungsbrücke,
 * Vergleichsrechnungen, interne Vorlagen, Auffälligkeiten- und Quellenlisten, Vollzugsmatrix,
 * Änderungsempfehlungen, Verweise auf interne Dateien). Enthält ein Artefakt einen dieser
 * Abschnitte, wird es nicht übernommen, bis das Haushaltsrepo eine öffentliche Fassung erzeugt.
 */
export const ARTEFAKT_SPERRMARKEN = [
  { muster: /Finanzierungsbr(?:ü|ue)cke/u, bezeichnung: 'Finanzierungsbrücke' },
  { muster: /Vergleichsrechnungen\s*\(keine Beschlussalternativen\)/u, bezeichnung: 'Vergleichsrechnungen' },
  { muster: /Kurzfassung f(?:ü|ue)r den Staatsrat/u, bezeichnung: 'Kurzfassung für den Staatsrat' },
  { muster: /Risiko- und Sensitivit(?:ä|ae)tsanalyse/u, bezeichnung: 'Risiko- und Sensitivitätsanalyse' },
  { muster: /Auff(?:ä|ae)lligkeiten der Reformtabellen/u, bezeichnung: 'Auffälligkeiten der Reformtabellen' },
  { muster: /Quellenverzeichnis\s*\(archiviert/u, bezeichnung: 'Quellenverzeichnis' },
  { muster: /Vollzugs- und Beschlussmatrix/u, bezeichnung: 'Vollzugs- und Beschlussmatrix' },
  { muster: /(?:Ä|Ae)nderungsempfehlungen zum Entwurf/u, bezeichnung: 'Änderungsempfehlungen' },
  { muster: /Fundstelle im Datenpaket/u, bezeichnung: 'Verweise auf interne Dateien des Datenpakets' },
];
