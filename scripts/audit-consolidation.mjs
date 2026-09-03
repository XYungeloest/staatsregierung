#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const ROOT = process.cwd();
const NORM_ROOT = resolve(ROOT, 'content/normen');
const CONFIG_PATH = resolve(ROOT, 'data/recht/consolidation-sources.json');
const MANIFEST_PATH = resolve(ROOT, 'data/recht/consolidation-manifest.json');
const REPORT_PATH = resolve(ROOT, 'data/recht/consolidation-report.md');
const BASELINE_DATE = '2023-11-01';
const CHECK_ONLY = process.argv.slice(2).includes('--check');
const PLACEHOLDER_PATTERN = /^(?:§{1,2}\s*[\d\sabisund,.-]+\s*)?u?\s*n\s*v\s*e\s*r\s*ä\s*n\s*d\s*e\s*r\s*t$/iu;
const ELLIPSIS_CITATION_PATTERN = /zuletzt\s+durch\s+(?:…|\.{3})\s+geändert/iu;

const CANONICAL_GROUPS = [
  ['staatsverfassung-des-freistaates-ostdeutschland', 'Verfassung des Freistaates Ostdeutschland', /Staatsverfassung|Landesverfassung|Verfassung des (?:Freistaates|Ostdeutschen Freistaates)|^Verfassung$/iu],
  ['ostdeutsches-feiertagsgesetz', 'Gesetz über Sonn- und Feiertage', /Sonn- und Feiertage|Feiertagsgesetz/iu],
  ['saechsische-bauordnung', 'Sächsische Bauordnung', /Bauordnung/iu],
  ['saechsisches-ladenoeffnungsgesetz', 'Sächsisches Ladenöffnungsgesetz', /Ladenöffnungsgesetz/iu],
  ['ostdeutsches-schulgesetz', 'Schulgesetz', /\b(?:Ostdeutsch(?:es|en)\s+)?Schulgesetz(?:es)?\b/iu],
  ['hochschulmedizingesetz', 'Hochschulmedizingesetz', /\bHochschulmedizingesetz(?:es)?\b/iu],
  ['schulordnung-grundschulen', 'Schulordnung Grundschulen', /\bSchulordnung\s+Grundschulen\b/iu],
  ['schulordnung-gemeinschaftsschulen', 'Schulordnung Gemeinschaftsschulen', /\bSchulordnung\s+Gemeinschaftsschulen\b/iu],
  ['schulordnung-foerderschulen', 'Schulordnung Förderschulen', /\bSchulordnung\s+Förderschulen\b/iu],
  ['saechsische-klassenbildungsverordnung', 'Sächsische Klassenbildungsverordnung', /\b(?:Sächsische[nrsm]?\s+)?Klassenbildungsverordnung\b/iu],
  ['pruefungsverordnung-waldorfschulen', 'Prüfungsverordnung Waldorfschulen', /\bPrüfungsverordnung\s+Waldorfschulen\b/iu],
  ['schulordnung-berufsschule', 'Schulordnung Berufsschule', /\bSchulordnung\s+Berufsschule\b/iu],
  ['schulordnung-berufliche-gymnasien', 'Schulordnung Berufliche Gymnasien', /\bSchulordnung\s+Berufliche\s+Gymnasien\b/iu],
  ['vwv-schulformulare', 'VwV Schulformulare', /\b(?:VwV|Verwaltungsvorschrift)[^\n.]{0,180}\bSchulformulare\b|\bVerwaltungsvorschrift\s+zur\s+Verwendung\s+von\s+Formularen\s+für\s+die\s+schulische\s+Verwaltung\b/iu],
  ['vwv-beratungslehrer', 'VwV Beratungslehrer', /\b(?:VwV|Verwaltungsvorschrift)[^\n.]{0,180}\bBeratungslehrer\b/iu],
  ['vwv-radfahrausbildung', 'VwV Radfahrausbildung', /\b(?:VwV|Verwaltungsvorschrift)[^\n.]{0,180}\bRadfahrausbildung\b/iu],
  ['vwv-stundentafeln', 'VwV Stundentafeln', /VwV\s+Stundentafel|Stundentafeln/iu],
  ['saechsische-haushaltsordnung', 'Sächsische Haushaltsordnung', /Haushaltsordnung/iu],
  ['saechsisches-gleichstellungsgesetz', 'Sächsisches Gleichstellungsgesetz', /Gleichstellungsgesetz/iu],
  ['saechsisches-verwaltungskostengesetz', 'Sächsisches Verwaltungskostengesetz', /Verwaltungskostengesetz/iu],
  ['zehntes-ostdeutsches-kostenverzeichnis', 'Zehntes Ostdeutsches Kostenverzeichnis', /Zehnt.*Kostenverzeichnis/iu],
  ['ostdeutsches-krankenhausgesetz', 'Ostdeutsches Krankenhausgesetz', /Krankenhausgesetz/iu],
  ['gesundheitsdienstgesetz', 'Gesetz über den öffentlichen Gesundheitsdienst', /Gesundheitsdienst/iu],
  ['saechsisches-bestattungsgesetz', 'Sächsisches Bestattungsgesetz', /Bestattungsgesetz/iu],
  ['ausbildungs-und-pruefungsordnung-polizei', 'Ausbildungs- und Prüfungsordnung für die Polizei', /Ausbildungs.*Prüfungsordnung.*Polizei|Polizeifachschul/iu],
  ['ostdeutsches-polizeivollzugsdienstgesetz', 'Ostdeutsches Polizeivollzugsdienstgesetz', /Polizeivollzugsdienstgesetz/iu],
  ['ostdeutsches-polizeibehoerdengesetz', 'Ostdeutsches Polizeibehördengesetz', /Polizeibehördengesetz/iu],
  ['saechsisches-polizeigesetz', 'Sächsisches Polizeigesetz', /(?:Sächsisch|Ostdeutsch).*Polizeigesetz|^Polizeigesetz(?:es)?$/iu],
  ['ostdeutsches-justizgesetz', 'Ostdeutsches Justizgesetz', /Justizgesetz/iu],
  ['kindertagesbetreuungsgesetz', 'Gesetz über Kindertagesbetreuung', /Kindertagesbetreuung/iu],
  ['ostdeutsche-lehrkraefte-arbeitszeitverordnung', 'Ostdeutsche Lehrkräfte-Arbeitszeitverordnung', /Lehrkräfte-Arbeitszeitverordnung/iu],
  ['ostdeutsche-arbeitszeitverordnung', 'Ostdeutsche Arbeitszeitverordnung', /(?<!Lehrkräfte-)Arbeitszeitverordnung/iu],
  ['ostdeutsches-tariftreueund-vergabegesetz', 'Ostdeutsches Tariftreue- und Vergabegesetz', /Vergabegesetz/iu],
  ['verschlusssachenanweisung', 'Verschlusssachenanweisung', /Verschlusssachenanweisung/iu],
  ['saechsische-landkreisordnung', 'Sächsische Landkreisordnung', /Landkreisordnung/iu],
  ['saechsische-gemeindeordnung', 'Sächsische Gemeindeordnung', /Gemeindeordnung/iu],
  ['kommunalwahlgesetz', 'Kommunalwahlgesetz', /Kommunalwahlgesetz/iu],
  ['landesplanungsgesetz', 'Landesplanungsgesetz', /Landesplanungsgesetz|Raumordnung und Landesplanung/iu],
  ['sachsisches-verwaltungsorganisationsgesetz', 'Verwaltungsorganisationsgesetz', /Verwaltungsorganisationsgesetz|Gesetz(?:es)? über die Verwaltungsorganisation/iu],
  ['finanzausgleichsgesetz', 'Finanzausgleichsgesetz', /Finanzausgleichsgesetz/iu],
  ['ostdeutsches-personennahverkehrsgesetz', 'Ostdeutsches Personennahverkehrsgesetz', /Personennahverkehrsgesetz|Gesetz(?:es)? über den öffentlichen Personennahverkehr/iu],
  ['kulturraumgesetz', 'Kulturraumgesetz', /Kulturraumgesetz|Gesetz(?:es)? über die Kulturräume/iu],
  ['ostdeutsches-hochschulgesetz', 'Gesetz über die Hochschulen', /Hochschulgesetz|Gesetz(?:es)? über die Hochschulen/iu],
  ['fluechtlingsaufnahmegesetz', 'Flüchtlingsaufnahmegesetz', /Flüchtlingsaufnahmegesetz/iu],
  ['abschiebungshaftvollzugsgesetz', 'Abschiebungshaftvollzugsgesetz', /Abschiebungshaftvollzugsgesetz/iu],
  ['landesbeamtengesetz', 'Landesbeamtengesetz', /Landesbeamtengesetz/iu],
  ['vermessungs-und-katastergesetz', 'Vermessungs- und Katastergesetz', /Vermessungs.*Katastergesetz/iu],
  ['zweckentfremdungsverbotsgesetz', 'Zweckentfremdungsverbotsgesetz', /Zweckentfremdungsverbotsgesetz/iu],
  ['archivgesetz', 'Archivgesetz', /Archivgesetz/iu],
  ['waldgesetz', 'Waldgesetz', /Waldgesetz/iu],
  ['ostdeutsches-normenkontrollratsgesetz', 'Ostdeutsches Normenkontrollratsgesetz', /Normenkontrollratsgesetz/iu],
  ['ndr-staatsvertrag', 'NDR-Staatsvertrag', /NDR-Staatsvertrag|Staatsvertrag über den Norddeutschen Rundfunk/iu],
  [
    'gesetz-zur-durchfuehrung-des-medienstaatsvertrages-und-des-rundfunkbeitragsstaatsvertrages',
    'Gesetz zur Durchführung des Medienstaatsvertrages und des Rundfunkbeitragsstaatsvertrages',
    /Gesetz(?:es)? zur Durchführung des Medienstaatsvertrages und des Rundfunkbeitragsstaatsvertrages/iu,
  ],
  ['ostdeutsche-bezirksordnung', 'Ostdeutsche Bezirksordnung', /Bezirksordnung/iu],
  ['wappenverordnung', 'Wappenverordnung', /Wappenverordnung/iu],
  ['abschiebe-aussetzungsverordnung', 'Abschiebe-Aussetzungsverordnung', /Abschiebe-Aussetzungsverordnung/iu],
  ['mustergesetz', 'Mustergesetz', /Mustergesetz vom TT\./iu],
];

function flatten(blocks, output = []) {
  for (const block of blocks ?? []) {
    output.push(block);
    flatten(block.children, output);
  }
  return output;
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de')
    .replace(/\b(?:des|der|die|das|sachsischen?|ostdeutschen?|freistaates?|sachsen|ostdeutschland)\b/gu, ' ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function stableFindingKey(finding) {
  if (typeof finding === 'string') return JSON.stringify(['text', finding]);
  return JSON.stringify([
    finding?.type ?? 'finding',
    finding?.norm ?? finding?.amendmentAct ?? finding?.file ?? '',
    finding?.location ?? finding?.fundstelle ?? finding?.evidence ?? '',
    finding?.errorCode ?? finding?.code ?? '',
    finding?.description ?? finding?.candidate ?? finding?.problem ?? '',
  ]);
}

function pushUniqueFinding(findings, finding) {
  const key = stableFindingKey(finding);
  if (!findings.some((existing) => stableFindingKey(existing) === key)) findings.push(finding);
}

function slugify(value) {
  return normalize(value)
    .replace(/\bgesetz über\b/gu, '')
    .trim()
    .replace(/\s+/gu, '-') || 'ungeklaerte-zielnorm';
}

function canonicalFor(title) {
  const cleanedTitle = String(title)
    .replace(/Kindertages-\s+betreuung/gu, 'Kindertagesbetreuung')
    .replace(/^Gesetzes\b/u, 'Gesetz')
    .replace(/\b(Hochschulmedizin|Kinder(?:tages)?betreuung|Polizei)gesetzes$/u, '$1gesetz')
    .replace(/\bStaatsvertrages$/u, 'Staatsvertrag')
    .trim();
  const match = CANONICAL_GROUPS.find(([, , pattern]) => pattern.test(cleanedTitle));
  if (match) return { canonicalSlug: match[0], title: match[1], known: true };
  const looksLikeNormTitle =
    /(?:gesetz|verordnung|ordnung|satzung|staatsvertrag|verfassung|anweisung)$/iu.test(cleanedTitle) &&
    !/^(?:Bezeichnung|Anpassung|Änderung|auf|für|bisher)\b/iu.test(cleanedTitle);
  return looksLikeNormTitle
    ? { canonicalSlug: slugify(cleanedTitle), title: cleanedTitle, known: false }
    : null;
}

function targetFromBlock(block) {
  const heading = `${block.title ?? ''}`.match(
    /^(?:Änderung|Neufassung|Anpassung)\s+(?:des|der)\s+(.+)$/iu,
  );
  if (heading && ['article', 'paragraph', 'section', 'chapter', 'part'].includes(block.type)) {
    return { title: heading[1].trim(), evidence: 'Gliederungsüberschrift' };
  }
  const text = `${block.text ?? ''}`;
  if (block.type !== 'paragraphText' || text.length > 600) return null;
  const sentence = text.match(
    /^(?:Das|Die)\s+([^\n:]{2,320}?(?:gesetz|ordnung|verordnung|verwaltungsvorschrift|vwv|anweisung|staatsvertrag|kostenverzeichnis|verfassung)(?:\s+für\s+den\s+Freistaat\s+(?:Sachsen|Ostdeutschland))?)(?:\s+vom\s+[^\n]{3,180}?)?(?:,\s+(?:das|die)\s+[^\n]{0,320}?\bgeändert worden ist)?,?\s+wird\s+(?:wie folgt\s+)?(?:geändert|neu gefasst|aufgehoben)\b/iu,
  );
  return sentence ? { title: sentence[1].trim(), evidence: 'Änderungssatz' } : null;
}

function targetFromActTitle(title) {
  const match = String(title ?? '').match(
    /^(?:(?:Erste|Zweite|Dritte|Vierte|Fünfte|Sechste|Siebte|Achte|Neunte|Zehnte|Elfte|Zwölfte)\s+)?(?:Gesetz|Verordnung|(?:Gemeinsame\s+)?Verwaltungsvorschrift)(?:\s+[^\n]{0,220}?)?\s+zur\s+(?:[A-Za-zÄÖÜäöüß-]+\s+)?Änderung\s+(?:des|der)\s+(.+)$/u,
  );
  return match ? { title: match[1].trim(), evidence: 'Titel der Änderungsvorschrift' } : null;
}

function prioritizedBodyFindings(body) {
  const findings = [];
  for (const block of body ?? []) {
    const scope = block.type === 'article' ? flatten([block], []) : [block];
    const candidates = scope.map(targetFromBlock).filter(Boolean);
    const operative = candidates.filter((finding) => finding.evidence === 'Änderungssatz');
    findings.push(...(operative.length > 0 ? operative : candidates));
    if (block.type !== 'article' && block.children?.length) {
      findings.push(...prioritizedBodyFindings(block.children));
    }
  }
  return findings;
}

async function loadNorms() {
  const result = [];
  for (const entry of await readdir(NORM_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(NORM_ROOT, entry.name);
    const [meta, history] = await Promise.all([
      readFile(join(directory, 'meta.json'), 'utf8').then(JSON.parse),
      readFile(join(directory, 'history.json'), 'utf8').then(JSON.parse),
    ]);
    const versions = await Promise.all((await readdir(join(directory, 'versions')))
      .filter((name) => name.endsWith('.json'))
      .map((name) => readFile(join(directory, 'versions', name), 'utf8').then(JSON.parse)));
    result.push({ meta, history, versions });
  }
  return result;
}

function existingStemFor(target, norms) {
  const candidates = norms.filter(({ meta }) =>
    meta.slug === target.canonicalSlug ||
    [meta.title, meta.shortTitle, meta.abbr].filter(Boolean).some((value) =>
      target.aliases.some((alias) => normalize(value) === normalize(alias))
    )
  );
  const stems = candidates.filter(({ meta }) => !meta.affectedNorms?.length && meta.type !== 'aenderungsvorschrift');
  const canonicalStem = stems.find(({ meta }) => meta.slug === target.canonicalSlug);
  if (canonicalStem) return canonicalStem;
  return stems.length === 1 ? stems[0] : null;
}

function hasPlaceholder(record) {
  return record?.versions.some((version) => flatten(version.body).some((block) => {
    const text = `${block.text ?? ''}`.trim();
    return PLACEHOLDER_PATTERN.test(text) || ELLIPSIS_CITATION_PATTERN.test(text);
  })) ?? false;
}

function completeIntervals(record, effectiveDates, baselineDate = BASELINE_DATE) {
  if (!record) return false;
  const repealDates = record.history.entries
    .filter((entry) => entry.type === 'repeal')
    .map((entry) => entry.date);
  const amendmentDates = effectiveDates.filter((date) => !repealDates.includes(date));
  if (record.versions.length < amendmentDates.length + 1) return false;
  const versions = [...record.versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  if (versions[0].validFrom !== baselineDate) return false;
  return versions.every((version, index) => {
    const next = versions[index + 1];
    if (!next) {
      if (repealDates.length === 0) return version.validTo === null;
      const repealDate = [...repealDates].sort().at(-1);
      const date = new Date(`${repealDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - 1);
      return version.validTo === date.toISOString().slice(0, 10);
    }
    const date = new Date(`${next.validFrom}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return version.validTo === date.toISOString().slice(0, 10);
  });
}

async function main() {
  const [norms, config] = await Promise.all([
    loadNorms(),
    readFile(CONFIG_PATH, 'utf8').then(JSON.parse),
  ]);
  const targets = new Map();
  const recognizedActs = new Set();
  const templateProblems = [];
  const ambiguousFindings = [];

  for (const record of norms) {
    const recordEffectiveDate =
      record.meta.effectiveDate ??
      record.versions.map((version) => version.validFrom).filter(Boolean).sort()[0] ??
      null;
    const flatBlocks = record.versions.flatMap((version) => flatten(version.body));
    if (flatBlocks.some((block) => /Mustergesetz vom TT\.\s*MMMM\s*JJJJ/iu.test(`${block.title ?? ''} ${block.text ?? ''}`))) {
      const problem = `${record.meta.slug}: unausgefüllte Mustergesetz-Vorlage ist keine Zielnorm`;
      pushUniqueFinding(templateProblems, problem);
    }
    const neverTookEffect = record.meta.status === 'historical' && record.meta.effectiveDate == null;
    // Der operative Änderungssatz bezeichnet innerhalb desselben Artikels die
    // tatsächlich geänderte Norm genauer als eine möglicherweise fehlerhafte
    // Artikelüberschrift. Andere Artikel desselben Mantelgesetzes bleiben
    // unabhängig davon vollständig auswertbar.
    const bodyFindings = neverTookEffect
      ? []
      : record.versions.flatMap((version) => prioritizedBodyFindings(version.body));
    const findings = neverTookEffect
      ? []
      : bodyFindings.length > 0
        ? bodyFindings
        : [targetFromActTitle(record.meta.title)].filter(Boolean);
    for (const targetSlug of [
      record.meta.enactedNorm,
      ...(record.meta.enactedNorms ?? []),
    ].filter(Boolean)) {
      const targetRecord = norms.find((candidate) => candidate.meta.slug === targetSlug);
      if (!targetRecord) continue;
      findings.push({
        title: targetRecord.meta.title,
        evidence: 'explizite Einführungsbeziehung',
        canonical: canonicalFor(targetRecord.meta.title) ?? {
          canonicalSlug: targetRecord.meta.slug,
          title: targetRecord.meta.title,
        },
      });
    }
    for (const targetSlug of record.meta.affectedNorms ?? []) {
      if (!config.targets[targetSlug] && !config.blockedTargets[targetSlug]) continue;
      const targetRecord = norms.find((candidate) => candidate.meta.slug === targetSlug);
      if (!targetRecord) continue;
      findings.push({
        title: targetRecord.meta.title,
        evidence: 'explizite Änderungsbeziehung',
        canonical: {
          canonicalSlug: targetRecord.meta.slug,
          title: targetRecord.meta.title,
          known: true,
        },
      });
    }
    for (const finding of findings) {
        const targetTitle = finding.title;
        const editorialTarget = record.meta.slug === 'gesetz-zur-anderung-des-polizeigesetzes-zur-regelung-der-schmerzgriffe'
          ? {
              canonicalSlug: 'ostdeutsches-polizeivollzugsdienstgesetz',
              title: 'Ostdeutsches Polizeivollzugsdienstgesetz',
              known: true,
            }
          : null;
        const canonical = editorialTarget ?? finding.canonical ?? canonicalFor(targetTitle);
        if (!canonical) {
          pushUniqueFinding(ambiguousFindings, {
            amendmentAct: record.meta.slug,
            candidate: targetTitle,
            evidence: finding.evidence,
          });
          continue;
        }
        if (canonical.canonicalSlug === 'mustergesetz') {
          pushUniqueFinding(templateProblems, `${record.meta.slug}: unausgefüllte Mustergesetz-Vorlage ist keine Zielnorm`);
          continue;
        }
        const target = targets.get(canonical.canonicalSlug) ?? {
          ...canonical,
          aliases: [],
          amendmentActs: [],
          correctionActs: [],
          effectiveDates: [],
          problems: [],
        };
        if (!target.aliases.includes(targetTitle)) target.aliases.push(targetTitle);
        if (record.meta.type === 'berichtigung') {
          if (!target.correctionActs.some((act) => act.slug === record.meta.slug)) {
            target.correctionActs.push({
              slug: record.meta.slug,
              title: record.meta.title,
              publicationDate: record.meta.publicationDate ?? recordEffectiveDate,
              detectedType: record.meta.type,
            });
          }
          targets.set(canonical.canonicalSlug, target);
          continue;
        }
        recognizedActs.add(record.meta.slug);
        if (!target.amendmentActs.some((act) => act.slug === record.meta.slug)) {
          target.amendmentActs.push({
            slug: record.meta.slug,
            title: record.meta.title,
            effectiveDate: recordEffectiveDate,
            detectedType: record.meta.type,
            typeCorrectionNeeded: record.meta.type !== 'aenderungsvorschrift',
          });
        }
        const effectiveDate = recordEffectiveDate;
        if (effectiveDate && !target.effectiveDates.includes(effectiveDate)) target.effectiveDates.push(effectiveDate);
        targets.set(canonical.canonicalSlug, target);
    }
  }

  const manifestTargets = [...targets.values()].map((target) => {
    const source = config.targets[target.canonicalSlug] ?? {};
    const historicalNonConsolidatable = source.historicalNonConsolidatable === true;
    const blocked = config.blockedTargets[target.canonicalSlug];
    const stem = existingStemFor(target, norms);
    const enactingActs = stem?.meta.enactingNorm
      ? target.amendmentActs.filter((act) => act.slug === stem.meta.enactingNorm)
      : target.amendmentActs.filter((act) =>
          act.slug === stem?.meta.slug &&
          act.detectedType !== 'aenderungsvorschrift' &&
          !stem?.meta.affectedNorms?.length
        );
    const amendmentActs = target.amendmentActs.filter((act) =>
      !enactingActs.some((enactingAct) => enactingAct.slug === act.slug)
    );
    const amendmentActsWithTargetDates = amendmentActs.map((act) => {
      const historyEntry = stem?.history.entries.find((entry) =>
        entry.relatedNorm === act.slug &&
        ['amendment', 'repeal'].includes(entry.type)
      );
      return {
        ...act,
        targetEffectiveDate: historyEntry?.date ?? blocked?.effectiveDate ?? act.effectiveDate,
      };
    });
    const effectiveDates = [...new Set(
      amendmentActsWithTargetDates.map((act) => act.targetEffectiveDate).filter(Boolean),
    )].sort();
    const introducedStem = enactingActs.length > 0;
    const adoptedPrimarySource = source.adoptedSources?.find((entry) => entry.snapshot && entry.sourceSha256);
    const sourceAvailable = Boolean(source.snapshot || adoptedPrimarySource);
    const knownBaseline = Boolean(source.baselineUrl || source.baselineCitation);
    const requiredBaseline = source.baselineVersionDate ?? (introducedStem
      ? stem?.versions.map((version) => version.validFrom).sort()[0] ?? stem?.meta.effectiveDate ?? BASELINE_DATE
      : source.snapshot ? BASELINE_DATE : adoptedPrimarySource?.versionDate ?? BASELINE_DATE);
    const problems = [...target.problems];
    if (blocked) problems.push(blocked.reason);
    if (!sourceAvailable && !blocked && !introducedStem && !historicalNonConsolidatable) {
      problems.push(knownBaseline
        ? 'Maßgebliche amtliche Ausgangsfassung ist bekannt, aber noch nicht unverändert versioniert.'
        : 'Maßgebliche amtliche Ausgangsfassung ist noch nicht versioniert.');
    }
    // Ohne maßgebliche Ausgangsquelle ist das Fehlen eines Stammnormdatensatzes
    // keine eigenständige offene Arbeitsklasse, sondern Teil des Baseline-Fehlers.
    if (!stem && !blocked && sourceAvailable) problems.push('Eigenständiger Stammnormdatensatz fehlt.');
    if (hasPlaceholder(stem) && !historicalNonConsolidatable) problems.push('Gespeicherte Stammnorm enthält Platzhalter oder eine nicht aufgelöste Auslassungsfundstelle.');
    if (!historicalNonConsolidatable && (sourceAvailable || introducedStem) && stem && !completeIntervals(stem, effectiveDates, requiredBaseline)) {
      problems.push('Fassungsfolge ist nicht vollständig oder besitzt lückenhafte Intervalle.');
    }
    if (
      introducedStem &&
      amendmentActs.length > 0 &&
      !blocked &&
      !completeIntervals(stem, effectiveDates, requiredBaseline)
    ) {
      problems.push('Neu eingeführte Stammnorm besitzt weitere Änderungen; deren vollständige Folgefassung ist noch zu prüfen.');
    }
    const status = blocked
      ? 'blocked-source-conflict'
      : historicalNonConsolidatable
        ? 'complete'
      : !sourceAvailable && !introducedStem
        ? 'missing-baseline'
      : !stem
          ? 'missing-stem-record'
          : hasPlaceholder(stem)
            ? 'incomplete-placeholder'
            : introducedStem && amendmentActs.length === 0
              ? 'complete'
              : completeIntervals(stem, effectiveDates, requiredBaseline)
              ? 'complete'
              : 'incomplete-placeholder';
    const nextAction = historicalNonConsolidatable
      ? 'Historischen, bereits unwirksamen Änderungsakt dokumentiert halten; keine künstliche Konsolidierung erzeugen.'
      : {
      'blocked-source-conflict': 'Quellenkonflikt fachlich klären; bis dahin keine Konsolidierung.',
      'missing-baseline': knownBaseline
        ? 'Bekannte maßgebliche amtliche Ausgangsfassung unverändert archivieren und prüfen.'
        : 'Maßgebliche amtliche Ausgangsfassung ermitteln, unverändert archivieren und prüfen.',
      'missing-stem-record': 'Ausgangsfassung parsen und eigenständigen Stammnormdatensatz anlegen.',
      'incomplete-placeholder': 'Redaktionell geprüfte Patch-Rezepte anwenden und vollständige Folgefassungen erzeugen.',
      complete: 'Bei neuen Änderungsvorschriften erneut auditieren.',
      }[status];
    return {
      canonicalSlug: target.canonicalSlug,
      title: source.title ?? target.title,
      aliases: [...new Set([...(source.aliases ?? []), ...target.aliases])].sort((a, b) => a.localeCompare(b, 'de')),
      revosaxLawId: source.revosaxLawId ?? null,
      baselineUrl: source.baselineUrl ?? adoptedPrimarySource?.baselineUrl ?? null,
      baselineSnapshotDate: source.baselineSnapshotDate ?? adoptedPrimarySource?.versionDate ?? BASELINE_DATE,
      sourceValidFrom: source.sourceValidFrom ?? adoptedPrimarySource?.sourceValidFrom ?? null,
      sourceValidTo: source.sourceValidTo ?? adoptedPrimarySource?.sourceValidTo ?? null,
      sourceSha256: source.sourceSha256 ?? adoptedPrimarySource?.sourceSha256 ?? null,
      historicalNonConsolidatable,
      editorialResolutions: [
        ...(source.editorialResolutions ?? []),
        ...(source.editorialSourceResolutions ?? []),
      ].map(({ id, status, decisionDate, issue, publishedText, resolvedApplication, rationale, evidence }) => ({
        id,
        status,
        decisionDate,
        issue,
        publishedText,
        resolvedApplication,
        rationale,
        evidence,
      })),
      existingStemNormSlug: stem?.meta.slug ?? null,
      enactingActs: enactingActs.sort((a, b) => (a.effectiveDate ?? '').localeCompare(b.effectiveDate ?? '')),
      amendmentActs: amendmentActsWithTargetDates.sort((a, b) =>
        (a.targetEffectiveDate ?? '').localeCompare(b.targetEffectiveDate ?? '')
      ),
      correctionActs: [...(target.correctionActs ?? [])].sort((a, b) =>
        (a.publicationDate ?? '').localeCompare(b.publicationDate ?? '')
      ),
      effectiveDates,
      status,
      problems: [...new Set(problems)],
      nextAction,
    };
  }).sort((a, b) => a.title.localeCompare(b.title, 'de'));

  const existingManifest = CHECK_ONLY
    ? await readFile(MANIFEST_PATH, 'utf8').then(JSON.parse).catch(() => null)
    : null;
  const manifest = {
    generatedAt: existingManifest?.generatedAt ?? new Date().toISOString(),
    baselineSnapshotDate: BASELINE_DATE,
    counts: {
      recognizedAmendmentActs: recognizedActs.size,
      recognizedTargetNorms: manifestTargets.length,
      completeTargetNorms: manifestTargets.filter((target) => target.status === 'complete').length,
      blockedSourceConflicts: manifestTargets.filter((target) => target.status === 'blocked-source-conflict').length,
      missingPrimarySources: manifestTargets.filter((target) => target.status === 'missing-baseline').length,
    },
    templateProblems,
    ambiguousFindings,
    targets: manifestTargets,
  };
  const openTargets = manifestTargets.filter((target) => target.status !== 'complete');
  const openTargetDetails = openTargets.flatMap((target) => [
    `### ${target.title}`,
    '',
    `- Datensatz: \`${target.canonicalSlug}\``,
    `- Status: \`${target.status}\``,
    ...(target.problems.length ? target.problems.map((problem) => `- Problem: ${problem}`) : []),
    `- Nächster Schritt: ${target.nextAction}`,
    '',
  ]);
  const report = [
    '# Konsolidierungs-Audit',
    '',
    `**Ausgangsstichtag:** ${BASELINE_DATE}`,
    `**Erzeugt:** ${manifest.generatedAt}`,
    '',
    `- Erkannte Änderungsvorschriften: ${manifest.counts.recognizedAmendmentActs}`,
    `- Erkannte Zielnormen: ${manifest.counts.recognizedTargetNorms}`,
    `- Vollständig konsolidiert: ${manifest.counts.completeTargetNorms}`,
    `- Aktuell offene Zielnormen: ${openTargets.length}`,
    '',
    '## Offener Handlungsbedarf',
    '',
    `- Fehlende Stammnormdatensätze: ${openTargets.filter((target) => target.status === 'missing-stem-record').length}`,
    `- Unvollständige Platzhalterbestände: ${openTargets.filter((target) => target.status === 'incomplete-placeholder').length}`,
    `- Blockierte Quellenkonflikte: ${manifest.counts.blockedSourceConflicts}`,
    `- Fehlende Primärquellen: ${manifest.counts.missingPrimarySources}`,
    '',
    'Abgeschlossene Zielnormen werden in diesem Bericht nicht fortgeschrieben. Solange eine Zielnorm noch nicht vollständig umgesetzt ist, bleibt sie mit Problem und nächstem Schritt hier sichtbar. Der vollständige maschinenlesbare Status steht zusätzlich in `data/recht/consolidation-manifest.json`; redaktionelle Quellenfragen werden in `CONTENT_GAPS.md` gebündelt.',
    '',
    ...(openTargetDetails.length ? ['## Offene Zielnormen', '', ...openTargetDetails] : []),
    ...(templateProblems.length ? ['## Nicht als Zielnorm behandelte Vorlagen', '', ...templateProblems.map((problem) => `- ${problem}`), ''] : []),
    ...(ambiguousFindings.length
      ? [
          '## Redaktionell zu prüfende Erkennungsfunde',
          '',
          ...ambiguousFindings.map((finding) =>
            `- \`${finding.amendmentAct}\`: „${finding.candidate}“ (${finding.evidence})`
          ),
          '',
        ]
      : []),
  ].join('\n');

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const reportText = `${report.trimEnd()}\n`;
  if (CHECK_ONLY) {
    const [storedManifest, storedReport] = await Promise.all([
      readFile(MANIFEST_PATH, 'utf8').catch(() => ''),
      readFile(REPORT_PATH, 'utf8').catch(() => ''),
    ]);
    if (storedManifest !== manifestText || storedReport !== reportText) {
      throw new Error(
        'Konsolidierungsmanifest ist nicht aktuell. ' +
        '„npm run norms:consolidation:audit“ ausführen und den fachlichen Diff prüfen.',
      );
    }
  } else {
    await mkdir(dirname(MANIFEST_PATH), { recursive: true });
    await Promise.all([
      writeFile(MANIFEST_PATH, manifestText, 'utf8'),
      writeFile(REPORT_PATH, reportText, 'utf8'),
    ]);
  }
  console.log(JSON.stringify(manifest.counts));
}

await main();
