import { HaushaltError, formatValue, sumBy } from './common.mjs';

/**
 * Rechnerische Identitäten und Querbezüge zwischen Gesamtplan, Finanzplanung, Rücklagen und
 * Personal. Die Funktionen arbeiten auf der Snapshot-Form der Daten und werden zweimal genutzt:
 * vom Import auf den gerade überführten Quelldaten (Herkunftsangaben = Quelldateien) und von
 * `haushalt:check` auf dem gespeicherten Snapshot (Herkunftsangaben = Snapshot-Dateien).
 * Es wird nichts korrigiert oder neu berechnet; jede Abweichung ist ein Befund, der beide
 * Herkünfte nennt.
 *
 * Erwartete Bezeichnungen in `labels`:
 * gesamtplan, finanzplan, kreditfinanzierungsplan, massnahmen, ruecklage, fonds, stellen,
 * reformwirkung, komponenten, kapitelwirkung.
 */

/**
 * Stellen aus dem Vollzug der Sicherheitsreform je Kapitel und Jahr (Planäquivalente). Die Teile
 * sind bereits in den Spalten des Mengengerüsts enthalten: `sicherheitsreform_beamte` in
 * `beamte_neu_o_r`, `sicherheitsreform_anwaerter` in `anwaerter`, `sicherheitsreform_tarif` in
 * `arbeitnehmer`. Das Haushaltsrepo rundet jeden Teil und die Gesamtzahl `sicherheitsreform` je für
 * sich auf ganze VZÄ (scripts/haushaltsplan/anlagen.py, stellen()); die Gesamtzahl kann deshalb um
 * eins von der Summe der gerundeten Teile abweichen.
 */
export const STELLEN_SICHERHEITSREFORM = ['sicherheitsreform', 'sicherheitsreform_beamte', 'sicherheitsreform_tarif', 'sicherheitsreform_anwaerter'];
const SICHERHEITSREFORM_TEILE = [
  ['beamte', 'sicherheitsreform_beamte', 'beamte_neu_o_r', 'Neueinstellungen'],
  ['tarif', 'sicherheitsreform_tarif', 'arbeitnehmer', 'Arbeitnehmer:innen'],
  ['anwaerter', 'sicherheitsreform_anwaerter', 'anwaerter', 'Anwärter:innen'],
];

/** Einheit der skalierten Dezimalzahlen: 10^-7 (eine Stelle mehr als die zulässigen sechs Nachkommastellen). */
const SKALA = 10000000n;

/**
 * Wertebereich eines gerundet angegebenen Dezimalwerts als [lo, hi] in Einheiten von 10^-7: Der
 * exakte Wert liegt höchstens eine halbe Einheit der letzten angegebenen Stelle vom angegebenen
 * Wert entfernt (beide Ränder eingeschlossen, gleich ob halb aufwärts oder halb gerade gerundet).
 */
function rundungsbereich(raw, label) {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/u.exec(String(raw));
  if (!match) throw new HaushaltError(`${label}: „${raw}“ ist keine nichtnegative Dezimalzahl mit höchstens sechs Nachkommastellen`);
  const nachkomma = match[2] ?? '';
  const wert = BigInt(match[1]) * SKALA + BigInt(nachkomma.padEnd(7, '0'));
  const halb = 5n * 10n ** BigInt(6 - nachkomma.length);
  return { lo: wert > halb ? wert - halb : 0n, hi: wert + halb, wert };
}

/** Ganze Zahlen, die kaufmännische Rundung (halb aufwärts) eines Werts in [lo, hi] ergeben kann. */
function moeglicheRundung({ lo, hi }) {
  return [Number((lo + SKALA / 2n) / SKALA), Number((hi + SKALA / 2n) / SKALA)];
}

function dezimalText(skaliert) {
  const ganz = skaliert / SKALA;
  const rest = (skaliert % SKALA).toString().padStart(7, '0').replace(/0+$/u, '');
  return rest === '' ? String(ganz) : `${ganz},${rest}`;
}

/**
 * Prüft die Stellen der Sicherheitsreform im Mengengerüst gegen die Jahresdurchschnitte der Quelle
 * (Zeilen mit kapitel, stellenart, jahr, vzae_jahresdurchschnitt). Die Quelle gibt die
 * Jahresdurchschnitte gerundet an (derzeit auf 0,1 VZÄ); geprüft wird deshalb, ob jeder Teil und die
 * Gesamtzahl eine mögliche kaufmännische Rundung eines Werts im Rundungsbereich des Teils bzw. der
 * Summe der Rundungsbereiche sind.
 */
export function pruefeSicherheitsreformStellen(problems, stellen, zeilen, years, label) {
  const arten = new Map(SICHERHEITSREFORM_TEILE.map(([art, feld]) => [art, feld]));
  const kapitelIndex = new Map(stellen.map((entry) => [entry.kapitel, entry]));
  const werte = new Map();
  zeilen.forEach((zeile, index) => {
    const at = `${label} Zeile ${index + 1}`;
    const jahr = Number(zeile.jahr);
    if (!arten.has(zeile.stellenart)) problems.add(`${at}: Stellenart „${zeile.stellenart}“ ist nicht eingeordnet`);
    if (!years.includes(jahr)) problems.add(`${at}: Jahr ${zeile.jahr} liegt außerhalb der Periode`);
    if (!kapitelIndex.has(zeile.kapitel)) problems.add(`${at}: Kapitel ${zeile.kapitel} fehlt in der Personalübersicht`);
    const key = `${zeile.kapitel}|${jahr}`;
    const eintrag = werte.get(key) ?? new Map();
    if (eintrag.has(zeile.stellenart)) problems.add(`${at}: Kapitel ${zeile.kapitel}, ${zeile.stellenart}, ${jahr} doppelt`);
    eintrag.set(zeile.stellenart, rundungsbereich(zeile.vzae_jahresdurchschnitt, `${at} vzae_jahresdurchschnitt`));
    werte.set(key, eintrag);
  });
  const pruefe = (subject, feld, ist, bereich, beschreibung) => {
    const [min, max] = moeglicheRundung(bereich);
    if (!Number.isSafeInteger(ist) || ist < min || ist > max) {
      problems.add(`${subject}: daten/stellen.csv ${feld} = ${formatValue(ist)}, aber ${beschreibung} ${dezimalText(bereich.wert)} VZÄ (${label}) ergibt gerundet ${min === max ? min : `${min} bis ${max}`}`);
    }
  };
  for (const entry of stellen) {
    for (const year of years) {
      const row = entry.jahre?.[String(year)];
      if (!row) continue;
      const eintrag = werte.get(`${entry.kapitel}|${year}`) ?? new Map();
      const subject = `Stellen der Sicherheitsreform Kapitel ${entry.kapitel} ${year}`;
      const summe = { lo: 0n, hi: 0n, wert: 0n };
      for (const [art, feld] of SICHERHEITSREFORM_TEILE) {
        const bereich = eintrag.get(art) ?? { lo: 0n, hi: 0n, wert: 0n };
        summe.lo += bereich.lo;
        summe.hi += bereich.hi;
        summe.wert += bereich.wert;
        pruefe(subject, feld, row[feld], bereich, 'der Jahresdurchschnitt');
      }
      pruefe(subject, 'sicherheitsreform', row.sicherheitsreform, summe, 'die Summe der Jahresdurchschnitte');
    }
  }
}

/** Rechnerische Identitäten innerhalb einzelner Zeilen (keine Neuberechnung, nur Prüfung). */
export function pruefeRechenidentitaeten(problems, data, labels) {
  const { years = [], massnahmen = [], kreditfinanzierungsplan = [], allgemeineRuecklage = [], fondsGegenposten = [], stellen = [], reformwirkungJahre = [], kapitelwirkung = [] } = data;

  for (const massnahme of massnahmen) {
    for (const [jahr, row] of Object.entries(massnahme.jahre ?? {})) {
      problems.equal(
        row.einnahmen + row.einsparungen - row.kosten,
        'Einnahmen + Einsparungen − Kosten',
        row.nettoentlastung,
        `${labels.massnahmen} nettoentlastung`,
        `Finanzierungsmaßnahme ${massnahme.id} ${jahr}`,
      );
    }
  }

  for (const row of kreditfinanzierungsplan) {
    problems.equal(
      row.kreditaufnahme - row.tilgung,
      'Kreditaufnahme − Tilgung',
      row.nettokreditaufnahme,
      `${labels.kreditfinanzierungsplan} nettokreditaufnahme`,
      `Kreditfinanzierungsplan ${row.jahr}`,
    );
  }

  allgemeineRuecklage.forEach((row, index) => {
    problems.equal(
      row.anfang - row.entnahme + row.zufuehrung,
      'Anfangsbestand − Entnahme + Zuführung',
      row.ende,
      `${labels.ruecklage} ende`,
      `Allgemeine Rücklage ${row.jahr}`,
    );
    const previous = allgemeineRuecklage[index - 1];
    if (previous) {
      problems.equal(row.anfang, `${labels.ruecklage} anfang ${row.jahr}`, previous.ende, `${labels.ruecklage} ende ${previous.jahr}`, `Allgemeine Rücklage ${row.jahr}`);
    }
  });

  // Verwendungsplan: veranschlagt (betrag) höchstens Planbetrag, Kürzung = Planbetrag − veranschlagt;
  // ein in das zweite Haushaltsjahr übertragener Teil erscheint dort als eigene Zeile mit gleichem Planbetrag.
  const letztesJahr = years.length > 0 ? Math.max(...years) : null;
  for (const row of fondsGegenposten) {
    const subject = `Fondsgegenposten ${row.fonds_id} ${row.jahr}`;
    for (const feld of ['betrag', 'planbetrag', 'kuerzung', 'uebertragung']) {
      if (!Number.isSafeInteger(row[feld]) || row[feld] < 0) problems.add(`${subject}: ${labels.fonds} ${feld} = ${formatValue(row[feld])} ist kein nichtnegativer Betrag`);
    }
    problems.equal(row.planbetrag - row.betrag, 'Planbetrag − veranschlagt', row.kuerzung, `${labels.fonds} kuerzung`, subject);
    if (row.uebertragung !== 0 && (!years.includes(row.jahr) || row.jahr === letztesJahr)) {
      problems.add(`${subject}: ${labels.fonds} uebertragung ${formatValue(row.uebertragung)} außerhalb eines übertragbaren Haushaltsjahres`);
    }
    if (row.uebertragen_aus !== null && row.uebertragung !== 0) {
      problems.add(`${subject}: übertragene Zeile (aus ${row.uebertragen_aus}) überträgt selbst ${formatValue(row.uebertragung)}`);
    }
    // Übertragen wird nur in das zweite (letzte) Haushaltsjahr der Periode.
    if (row.uebertragen_aus !== null && row.jahr !== letztesJahr) {
      problems.add(`${subject}: übertragene Zeile (aus ${row.uebertragen_aus}) steht nicht im Haushaltsjahr ${letztesJahr}, in das übertragen wird`);
    }
    // Bei konsolidierter Betrachtung entfällt genau der veranschlagte Betrag.
    problems.equal(row.konsolidierungseliminierung, `${labels.fonds} konsolidierungseliminierung`, row.betrag, 'veranschlagt (betrag)', subject);
  }
  const uebertragen = new Map();
  for (const row of fondsGegenposten) {
    if (row.uebertragen_aus === null) continue;
    const key = `${row.fonds_id}|${row.uebertragen_aus}`;
    uebertragen.set(key, (uebertragen.get(key) ?? 0) + row.planbetrag);
  }
  for (const row of fondsGegenposten) {
    if (row.uebertragen_aus !== null) continue;
    const key = `${row.fonds_id}|${row.jahr}`;
    problems.equal(
      uebertragen.get(key) ?? 0,
      'Planbetrag der übertragenen Zeilen im Folgejahr',
      row.uebertragung,
      `${labels.fonds} uebertragung`,
      `Fondsgegenposten ${row.fonds_id} ${row.jahr}`,
    );
    uebertragen.delete(key);
  }
  for (const key of uebertragen.keys()) {
    const [fonds, jahr] = key.split('|');
    problems.add(`${labels.fonds}: übertragene Zeilen von ${fonds} verweisen auf ${jahr}, dort fehlt die Ausgangszeile`);
  }

  for (const entry of stellen) {
    for (const [jahr, row] of Object.entries(entry.jahre ?? {})) {
      const subject = `Planäquivalente Kapitel ${entry.kapitel} ${jahr}`;
      problems.equal(row.beamte_bestand + row.anwaerter + row.beamte_neu_o_r, 'Bestand + Anwärter:innen + Neueinstellungen', row.beamte, `${labels.stellen} beamte`, subject);
      problems.equal(row.beamte + row.arbeitnehmer + row.auszubildende, 'Beamt:innen + Arbeitnehmer:innen + Auszubildende', row.summe, `${labels.stellen} summe`, subject);
      // Stellen der Sicherheitsreform: davon-Angaben der Spalten des Mengengerüsts.
      let teile = 0;
      for (const feld of STELLEN_SICHERHEITSREFORM) {
        if (!Number.isSafeInteger(row[feld]) || row[feld] < 0) problems.add(`${subject}: ${labels.stellen} ${feld} = ${formatValue(row[feld])} ist keine nichtnegative ganze Zahl`);
      }
      for (const [, feld, enthalten, bezeichnung] of SICHERHEITSREFORM_TEILE) {
        teile += row[feld];
        if (row[feld] > row[enthalten]) {
          problems.add(`${subject}: ${labels.stellen} ${feld} = ${formatValue(row[feld])} übersteigt ${bezeichnung} (${enthalten} = ${formatValue(row[enthalten])})`);
        }
      }
      if (Math.abs(row.sicherheitsreform - teile) > 1) {
        problems.add(`${subject}: ${labels.stellen} sicherheitsreform = ${formatValue(row.sicherheitsreform)} weicht um mehr als die Rundung von der Summe der Teile (${formatValue(teile)}) ab`);
      }
    }
  }

  for (const row of reformwirkungJahre) {
    const subject = `Personalreform ${row.jahr}`;
    problems.equal(row.besoldung + row.versorgung + row.beihilfe + row.tarif + row.verwaltung, 'Besoldung + Versorgung + Beihilfe + Tarif + Verwaltung', row.ausgaben, `${labels.reformwirkung} ausgaben`, subject);
    problems.equal(row.steuer + row.fonds, 'Steuer + Fonds', row.einnahmen, `${labels.reformwirkung} einnahmen`, subject);
    problems.equal(row.ausgaben - row.einnahmen, 'Ausgaben − Einnahmen', row.netto, `${labels.reformwirkung} netto`, subject);
  }

  for (const row of kapitelwirkung) {
    for (const feld of ['sicherheitsreform', 'endfassung']) {
      if (!Number.isSafeInteger(row[feld])) problems.add(`Kapitelwirkung ${row.kapitel}/${row.gruppe} ${row.jahr}: ${labels.kapitelwirkung} ${feld} = ${formatValue(row[feld])} ist kein ganzzahliger Betrag`);
    }
    problems.equal(
      row.vorher + row.basisbereinigung + row.reformwirkung + row.finanzfolge,
      'vorher + Basisbereinigung + Reformwirkung + Finanzfolge',
      row.nachher,
      `${labels.kapitelwirkung} nachher`,
      `Kapitelwirkung ${row.kapitel}/${row.gruppe} ${row.jahr}`,
    );
  }
}

/**
 * Querbezüge zwischen Gesamtplan, Finanzplan, Kreditfinanzierungsplan, Rücklagen und
 * Personalreform sowie Versorgungsfonds ↔ Verwendungsplan. `gesamtplanJahre` ist
 * { "<jahr>": { einnahmen, ausgaben, … } }.
 */
export function pruefeQuerbezuege(problems, data, labels) {
  const { years, gesamtplanJahre, finanzplan = [], kreditfinanzierungsplan = [], allgemeineRuecklage = [], fondsGegenposten = [], versorgungsfondsErstattung = [], reformwirkungJahre = [], komponenten = [] } = data;
  const finde = (rows, jahr) => rows.find((row) => row.jahr === jahr);

  // Veranschlagte Erstattung des Versorgungsfonds = veranschlagte Zeilen des Verwendungsplans (Art
  // pension), über alle Jahre beider Seiten.
  const pensionsposten = fondsGegenposten.filter((posten) => posten.art === 'pension');
  const erstattungsjahre = [...new Set([...versorgungsfondsErstattung.map((row) => row.jahr), ...pensionsposten.map((posten) => posten.jahr)])].sort((a, b) => a - b);
  for (const jahr of erstattungsjahre) {
    const zeilen = versorgungsfondsErstattung.filter((row) => row.jahr === jahr);
    const posten = pensionsposten.filter((entry) => entry.jahr === jahr);
    if (zeilen.length !== 1) {
      problems.add(`Versorgungsfonds ${jahr}: ${labels.versorgungsfonds} hat ${zeilen.length} Zeilen für das Jahr, der Verwendungsplan (${labels.fonds}) ${posten.length} Zeilen des Versorgungsfonds`);
      continue;
    }
    problems.equal(
      zeilen[0].veranschlagt,
      `${labels.versorgungsfonds} veranschlagt`,
      sumBy(posten, (entry) => entry.betrag),
      `Summe der veranschlagten Erstattung (${labels.fonds}, Versorgungsfonds)`,
      `Versorgungsfonds ${jahr}`,
    );
  }

  for (const year of years) {
    const gp = gesamtplanJahre[String(year)];
    if (!gp) continue;
    const subject = `Gesamtplan ${year}`;
    problems.equal(gp.ausgaben, `${labels.gesamtplan} ausgaben`, gp.haushaltsvolumen, `${labels.gesamtplan} haushaltsvolumen`, subject);
    problems.equal(gp.einnahmen + (gp.ungedeckt ?? 0), 'Einnahmen + ausgewiesene Deckungslücke', gp.ausgaben, `${labels.gesamtplan} ausgaben`, subject);
    if (gp.zahlungen_ohne_zufuehrung !== undefined && gp.zufuehrung_liquiditaetsruecklage !== undefined) {
      problems.equal(
        gp.zahlungen_ohne_zufuehrung + gp.zufuehrung_liquiditaetsruecklage,
        'Zahlungen ohne Zuführung + Zuführung an die Liquiditätsrücklage',
        gp.ausgaben,
        `${labels.gesamtplan} ausgaben`,
        subject,
      );
    }

    const kfp = finde(kreditfinanzierungsplan, year);
    if (kfp) {
      if (gp.zinsen !== undefined) problems.equal(kfp.zinsen, `${labels.kreditfinanzierungsplan} zinsen`, gp.zinsen, `${labels.gesamtplan} zinsen`, `Zinsen ${year}`);
      if (gp.tilgung !== undefined) problems.equal(kfp.tilgung, `${labels.kreditfinanzierungsplan} tilgung`, gp.tilgung, `${labels.gesamtplan} tilgung`, `Tilgung ${year}`);
      if (gp.kredit_brutto !== undefined) problems.equal(kfp.kreditaufnahme, `${labels.kreditfinanzierungsplan} kreditaufnahme`, gp.kredit_brutto, `${labels.gesamtplan} kredit_brutto`, `Kreditaufnahme ${year}`);
      if (gp.strukturelle_nka !== undefined) problems.equal(kfp.strukturelle_nka, `${labels.kreditfinanzierungsplan} strukturelle_nka`, gp.strukturelle_nka, `${labels.gesamtplan} strukturelle_nka`, `Strukturelle Nettokreditaufnahme ${year}`);
      if (gp.nettotilgung !== undefined) problems.equal(-kfp.nettokreditaufnahme, `negative Nettokreditaufnahme (${labels.kreditfinanzierungsplan})`, gp.nettotilgung, `${labels.gesamtplan} nettotilgung`, `Nettotilgung ${year}`);
    } else {
      problems.add(`${labels.kreditfinanzierungsplan}: Haushaltsjahr ${year} fehlt`);
    }

    const fp = finde(finanzplan, year);
    if (fp) {
      for (const field of ['haushaltsvolumen', 'einnahmen', 'zinsen', 'ungedeckt']) {
        if (fp[field] !== undefined && gp[field] !== undefined) problems.equal(fp[field], `${labels.finanzplan} ${field}`, gp[field], `${labels.gesamtplan} ${field}`, `Finanzplan ${year}`);
      }
      // Der Finanzplan weist Ausgaben ohne Zuführung an die Liquiditätsrücklage aus.
      if (gp.zahlungen_ohne_zufuehrung !== undefined) {
        problems.equal(fp.ausgaben, `${labels.finanzplan} ausgaben`, gp.zahlungen_ohne_zufuehrung, `${labels.gesamtplan} zahlungen_ohne_zufuehrung`, `Finanzplan ${year}`);
      }
    } else {
      problems.add(`${labels.finanzplan}: Haushaltsjahr ${year} fehlt`);
    }

    const ruecklage = finde(allgemeineRuecklage, year);
    if (ruecklage && gp.ruecklagenentnahme !== undefined) {
      problems.equal(ruecklage.entnahme, `${labels.ruecklage} entnahme`, gp.ruecklagenentnahme, `${labels.gesamtplan} ruecklagenentnahme`, `Rücklagenentnahme ${year}`);
    }
  }

  for (const fp of finanzplan) {
    const kfp = finde(kreditfinanzierungsplan, fp.jahr);
    if (kfp && fp.schuldenstand !== undefined) {
      problems.equal(fp.schuldenstand, `${labels.finanzplan} schuldenstand`, kfp.schuldenstand_ende, `${labels.kreditfinanzierungsplan} schuldenstand_ende`, `Schuldenstand ${fp.jahr}`);
    }
    if (kfp && fp.zinsen !== undefined && kfp.zinsen !== undefined) {
      problems.equal(fp.zinsen, `${labels.finanzplan} zinsen`, kfp.zinsen, `${labels.kreditfinanzierungsplan} zinsen`, `Zinsen ${fp.jahr}`);
    }
    const ruecklage = finde(allgemeineRuecklage, fp.jahr);
    if (ruecklage && fp.ruecklage_ende !== undefined) {
      problems.equal(ruecklage.ende, `${labels.ruecklage} ende`, fp.ruecklage_ende, `${labels.finanzplan} ruecklage_ende`, `Allgemeine Rücklage ${fp.jahr}`);
    }
    if (ruecklage && fp.liquiditaet_ende !== undefined && ruecklage.liquiditaetsruecklage_ende !== undefined) {
      problems.equal(ruecklage.liquiditaetsruecklage_ende, `${labels.ruecklage} liquiditaetsruecklage_ende`, fp.liquiditaet_ende, `${labels.finanzplan} liquiditaet_ende`, `Liquiditätsrücklage ${fp.jahr}`);
    }
    // Vorzeichen: personalreform_netto ist die Nettoentlastung (positiv), reformwirkung.netto die
    // Nettowirkung auf den Haushalt (negativ = Entlastung).
    const reform = finde(reformwirkungJahre, fp.jahr);
    if (reform && fp.personalreform_netto !== undefined) {
      problems.equal(-reform.netto, `negative Nettowirkung (${labels.reformwirkung})`, fp.personalreform_netto, `${labels.finanzplan} personalreform_netto`, `Personalreform ${fp.jahr}`);
    }
  }

  for (const row of reformwirkungJahre) {
    for (const [seite, field] of [['Ausgabe', 'ausgaben'], ['Einnahme', 'einnahmen']]) {
      problems.equal(
        sumBy(komponenten.filter((item) => item.jahr === row.jahr && item.seite === seite), (item) => item.betrag),
        `Summe der Reformkomponenten (${labels.komponenten})`,
        row[field],
        `${labels.reformwirkung} ${field}`,
        `Personalreform ${row.jahr} (${seite})`,
      );
    }
  }
}

/**
 * Abgleich der Projektbeträge mit der Summe der referenzierten Titel. `titelBetrag(konzeptId,
 * jahr)` liefert { seite, betrag } oder null. Ergebnis: Liste der Abweichungen.
 */
export function projektsummenAbweichungen(projekte, years, titelBetrag) {
  const abweichungen = [];
  for (const projekt of projekte) {
    for (const year of years) {
      let ausgaben = 0;
      let einnahmen = 0;
      for (const reference of projekt.titel ?? []) {
        const row = reference.konzept_id ? titelBetrag(reference.konzept_id, year) : null;
        if (!row) continue;
        if (row.seite === 'Ausgabe') ausgaben += row.betrag;
        else einnahmen += row.betrag;
      }
      const soll = projekt.jahre?.[String(year)];
      if (!soll || ausgaben !== soll.kernhaushalt || einnahmen !== soll.einnahmen) {
        abweichungen.push({
          projekt: projekt.id,
          jahr: year,
          kernhaushalt: soll?.kernhaushalt ?? null,
          summe_ausgabetitel: ausgaben,
          einnahmen: soll?.einnahmen ?? null,
          summe_einnahmetitel: einnahmen,
        });
      }
    }
  }
  return abweichungen;
}

/**
 * Einnahmetitel des Kernhaushalts, auf die Fondsgegenposten der Haushaltsjahre verweisen, die
 * aber im Titelplan in keinem Kapitel vorkommen. Ergebnis je Jahr und Titelnummer mit Anzahl
 * der Zeilen und Summe der Konsolidierungseliminierung.
 */
export function fehlendeFondsEinnahmetitel(fondsGegenposten, years, titelnummern) {
  const result = new Map();
  for (const row of fondsGegenposten) {
    if (!years.includes(row.jahr)) continue;
    const titel = row.einnahmetitel_kernhaushalt;
    if (!titel || titelnummern.has(titel)) continue;
    const key = `${row.jahr}|${titel}`;
    const entry = result.get(key) ?? { jahr: row.jahr, einnahmetitel: titel, zeilen: 0, konsolidierungseliminierung: 0 };
    entry.zeilen += 1;
    entry.konsolidierungseliminierung += row.konsolidierungseliminierung;
    result.set(key, entry);
  }
  return [...result.values()].sort((left, right) => left.jahr - right.jahr || (left.einnahmetitel < right.einnahmetitel ? -1 : left.einnahmetitel > right.einnahmetitel ? 1 : 0));
}
