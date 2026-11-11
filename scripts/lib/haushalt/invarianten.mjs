import { sumBy } from './common.mjs';

/**
 * Rechnerische Identitäten und Querbezüge zwischen Gesamtplan, Finanzplanung, Rücklagen und
 * Personal. Die Funktionen arbeiten auf der Snapshot-Form der Daten und werden zweimal genutzt:
 * vom Import auf den gerade überführten Quelldaten (Herkunftsangaben = Quelldateien) und von
 * `haushalt:check` auf dem gespeicherten Snapshot (Herkunftsangaben = Snapshot-Dateien).
 * Es wird nichts korrigiert oder neu berechnet; jede Abweichung ist ein Befund, der beide
 * Herkünfte nennt.
 *
 * Erwartete Bezeichnungen in `labels`:
 * gesamtplan, finanzplan, kreditfinanzierungsplan, massnahmen, ruecklage, stellen,
 * reformwirkung, komponenten, kapitelwirkung.
 */

/** Rechnerische Identitäten innerhalb einzelner Zeilen (keine Neuberechnung, nur Prüfung). */
export function pruefeRechenidentitaeten(problems, data, labels) {
  const { massnahmen = [], kreditfinanzierungsplan = [], allgemeineRuecklage = [], stellen = [], reformwirkungJahre = [], kapitelwirkung = [] } = data;

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

  for (const entry of stellen) {
    for (const [jahr, row] of Object.entries(entry.jahre ?? {})) {
      const subject = `Planäquivalente Kapitel ${entry.kapitel} ${jahr}`;
      problems.equal(row.beamte_bestand + row.anwaerter + row.beamte_neu_o_r, 'Bestand + Anwärter:innen + Neueinstellungen', row.beamte, `${labels.stellen} beamte`, subject);
      problems.equal(row.beamte + row.arbeitnehmer + row.auszubildende, 'Beamt:innen + Arbeitnehmer:innen + Auszubildende', row.summe, `${labels.stellen} summe`, subject);
    }
  }

  for (const row of reformwirkungJahre) {
    const subject = `Personalreform ${row.jahr}`;
    problems.equal(row.besoldung + row.versorgung + row.beihilfe + row.tarif + row.verwaltung, 'Besoldung + Versorgung + Beihilfe + Tarif + Verwaltung', row.ausgaben, `${labels.reformwirkung} ausgaben`, subject);
    problems.equal(row.steuer + row.fonds, 'Steuer + Fonds', row.einnahmen, `${labels.reformwirkung} einnahmen`, subject);
    problems.equal(row.ausgaben - row.einnahmen, 'Ausgaben − Einnahmen', row.netto, `${labels.reformwirkung} netto`, subject);
  }

  for (const row of kapitelwirkung) {
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
 * Personalreform. `gesamtplanJahre` ist { "<jahr>": { einnahmen, ausgaben, … } }.
 */
export function pruefeQuerbezuege(problems, data, labels) {
  const { years, gesamtplanJahre, finanzplan = [], kreditfinanzierungsplan = [], allgemeineRuecklage = [], reformwirkungJahre = [], komponenten = [] } = data;
  const finde = (rows, jahr) => rows.find((row) => row.jahr === jahr);

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
