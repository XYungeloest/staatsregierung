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
    /^(?:Das|Die)\s+([^.\n:]{2,320}?(?:gesetz|ordnung|verordnung|anweisung|staatsvertrag|kostenverzeichnis|verfassung)(?:\s+für\s+den\s+Freistaat\s+(?:Sachsen|Ostdeutschland))?)(?:\s+vom\s+[^,\n]{3,100})?,?\s+wird\s+(?:wie folgt\s+)?(?:geändert|neu gefasst|aufgehoben)\b/iu,
  );
  return sentence ? { title: sentence[1].trim(), evidence: 'Änderungssatz' } : null;
}

function targetFromActTitle(title) {
  const match = String(title ?? '').match(
    /^(?:Gesetz|Verordnung)\s+zur\s+(?:[A-Za-zÄÖÜäöüß-]+\s+)?Änderung\s+(?:des|der)\s+(.+)$/u,
  );
  return match ? { title: match[1].trim(), evidence: 'Titel der Änderungsvorschrift' } : null;
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
      if (!templateProblems.includes(problem)) templateProblems.push(problem);
    }
    const bodyFindings = flatBlocks.map(targetFromBlock).filter(Boolean);
    const findings = bodyFindings.length > 0
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
    for (const finding of findings) {
        const targetTitle = finding.title;
        const canonical = finding.canonical ?? canonicalFor(targetTitle);
        if (!canonical) {
          ambiguousFindings.push({
            amendmentAct: record.meta.slug,
            candidate: targetTitle,
            evidence: finding.evidence,
          });
          continue;
        }
        if (canonical.canonicalSlug === 'mustergesetz') {
          templateProblems.push(`${record.meta.slug}: unausgefüllte Mustergesetz-Vorlage ist keine Zielnorm`);
          continue;
        }
        recognizedActs.add(record.meta.slug);
        const target = targets.get(canonical.canonicalSlug) ?? {
          ...canonical,
          aliases: [],
          amendmentActs: [],
          effectiveDates: [],
          problems: [],
        };
        if (!target.aliases.includes(targetTitle)) target.aliases.push(targetTitle);
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
    const blocked = config.blockedTargets[target.canonicalSlug];
    const stem = existingStemFor(target, norms);
    const enactingActs = stem?.meta.enactingNorm
      ? target.amendmentActs.filter((act) => act.slug === stem.meta.enactingNorm)
      : [];
    const amendmentActs = target.amendmentActs.filter((act) =>
      !enactingActs.some((enactingAct) => enactingAct.slug === act.slug)
    );
    const amendmentActsWithTargetDates = amendmentActs.map((act) => {
      const historyEntry = stem?.history.entries.find((entry) =>
        entry.relatedNorm === act.slug &&
        entry.affectingVersionId &&
        entry.type === 'amendment'
      );
      return {
        ...act,
        targetEffectiveDate: historyEntry?.date ?? act.effectiveDate,
      };
    });
    const effectiveDates = [...new Set(
      amendmentActsWithTargetDates.map((act) => act.targetEffectiveDate).filter(Boolean),
    )].sort();
    const introducedStem = enactingActs.length > 0;
    const requiredBaseline = introducedStem
      ? stem?.versions.map((version) => version.validFrom).sort()[0] ?? stem?.meta.effectiveDate ?? BASELINE_DATE
      : BASELINE_DATE;
    const problems = [...target.problems];
    if (blocked) problems.push(blocked.reason);
    if (!source.snapshot && !blocked && !introducedStem) {
      problems.push('Amtliche REVOSax-Ausgangsfassung zum Stichtag ist noch nicht versioniert.');
    }
    if (!stem && !blocked) problems.push('Eigenständiger Stammnormdatensatz fehlt.');
    if (hasPlaceholder(stem)) problems.push('Gespeicherte Stammnorm enthält Platzhalter oder eine nicht aufgelöste Auslassungsfundstelle.');
    if ((source.snapshot || introducedStem) && stem && !completeIntervals(stem, effectiveDates, requiredBaseline)) {
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
      : !source.snapshot && !introducedStem
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
    const nextAction = {
      'blocked-source-conflict': 'Quellenkonflikt fachlich klären; bis dahin keine Konsolidierung.',
      'missing-baseline': 'Historische REVOSax-Fassung zum 1. November 2023 ermitteln, abrufen und prüfen.',
      'missing-stem-record': 'Ausgangsfassung parsen und eigenständigen Stammnormdatensatz anlegen.',
      'incomplete-placeholder': 'Redaktionell geprüfte Patch-Rezepte anwenden und vollständige Folgefassungen erzeugen.',
      complete: 'Bei neuen Änderungsvorschriften erneut auditieren.',
    }[status];
    return {
      canonicalSlug: target.canonicalSlug,
      title: source.title ?? target.title,
      aliases: [...new Set([...(source.aliases ?? []), ...target.aliases])].sort((a, b) => a.localeCompare(b, 'de')),
      revosaxLawId: source.revosaxLawId ?? null,
      baselineUrl: source.baselineUrl ?? null,
      baselineSnapshotDate: source.baselineSnapshotDate ?? BASELINE_DATE,
      sourceValidFrom: source.sourceValidFrom ?? null,
      sourceValidTo: source.sourceValidTo ?? null,
      sourceSha256: source.sourceSha256 ?? null,
      existingStemNormSlug: stem?.meta.slug ?? null,
      enactingActs: enactingActs.sort((a, b) => (a.effectiveDate ?? '').localeCompare(b.effectiveDate ?? '')),
      amendmentActs: amendmentActsWithTargetDates.sort((a, b) =>
        (a.targetEffectiveDate ?? '').localeCompare(b.targetEffectiveDate ?? '')
      ),
      effectiveDates,
      status,
      problems,
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
  const report = [
    '# Konsolidierungs-Audit',
    '',
    `**Ausgangsstichtag:** ${BASELINE_DATE}`,
    `**Erzeugt:** ${manifest.generatedAt}`,
    '',
    `- Erkannte Änderungsvorschriften: ${manifest.counts.recognizedAmendmentActs}`,
    `- Erkannte Zielnormen: ${manifest.counts.recognizedTargetNorms}`,
    `- Vollständig konsolidiert: ${manifest.counts.completeTargetNorms}`,
    `- Blockierte Quellenkonflikte: ${manifest.counts.blockedSourceConflicts}`,
    `- Fehlende Primärquellen: ${manifest.counts.missingPrimarySources}`,
    '',
    ...manifestTargets.flatMap((target) => [
      `## ${target.title}`,
      '',
      `- Slug: \`${target.canonicalSlug}\``,
      `- Status: \`${target.status}\``,
      `- Stammnorm: ${target.existingStemNormSlug ? `\`${target.existingStemNormSlug}\`` : 'fehlt'}`,
      `- REVOSax: ${target.baselineUrl ?? 'noch nicht belegt'}`,
      `- Einführung: ${target.enactingActs.map((act) => `\`${act.slug}\` (${act.effectiveDate})`).join(', ') || 'keine'}`,
      `- Änderungen: ${target.amendmentActs.map((act) => `\`${act.slug}\` (${act.effectiveDate})`).join(', ') || 'keine'}`,
      `- Nächster Schritt: ${target.nextAction}`,
      ...(target.problems.length ? ['- Probleme:', ...target.problems.map((problem) => `  - ${problem}`)] : []),
      '',
    ]),
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
  const reportText = `${report}\n`;
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
