#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const normRoot = join(root, 'content', 'normen');
const editorialConfig = JSON.parse(await readFile(join(root, 'packages', 'shared', 'src', 'config', 'editorial.json'), 'utf8'));
const referenceDate = editorialConfig.referenceDate;
const problems = [];
const forbiddenResponsibilities = new Set([
  'Landtag des Freistaates Ostdeutschland',
  'Volkskammer des Freistaates Ostdeutschland',
  'Sächsischer Landtag',
]);
const summaryFragment = /^(?:§|Abschnitt\b|Artikel\b|OABl\.|OGVBl\.|StAnzO\.|GVBl\.|Aufgrund\b|Auf Grund\b|\d+\.)|(?:\.\.\.|…)$/u;
// Provenienz-Semantik: enactingBody ist das erlassende Organ im ostdeutschen Rechtsbestand,
// originEnactingBody das Ursprungsorgan der übernommenen sächsischen Quelle (REVOSax-Snapshot).
const saxonBody = /Sächs|Sachsen/u;

function report(slug, message) {
  problems.push(`${slug}: ${message}`);
}

function applicableVersion(meta, versions) {
  const current = versions.find((version) =>
    version.validFrom <= referenceDate && (version.validTo === null || version.validTo >= referenceDate));
  if (current) return current;
  if (meta.status === 'pending-effective') return versions[0];
  return [...versions].sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0];
}

for (const entry of await readdir(normRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const slug = entry.name;
  const directory = join(normRoot, slug);
  const meta = JSON.parse(await readFile(join(directory, 'meta.json'), 'utf8'));
  const history = JSON.parse(await readFile(join(directory, 'history.json'), 'utf8'));
  const versionFiles = (await readdir(join(directory, 'versions'))).filter((file) => file.endsWith('.json'));
  const versions = await Promise.all(versionFiles.map(async (file) =>
    JSON.parse(await readFile(join(directory, 'versions', file), 'utf8'))));
  versions.sort((left, right) => left.validFrom.localeCompare(right.validFrom));

  if (meta.ministry !== undefined) report(slug, 'verwendet noch das unspezifische Feld ministry');
  const hasRevosaxProvenance = [...(meta.sourceReferences ?? []), ...versions.flatMap((version) => version.sourceReferences ?? [])]
    .some((reference) => reference.kind === 'revosax-snapshot');
  if (hasRevosaxProvenance && saxonBody.test(meta.enactingBody ?? '')) {
    report(slug, `übernommene Norm führt ein sächsisches Organ als enactingBody: ${meta.enactingBody} (gehört in originEnactingBody)`);
  }
  if (!hasRevosaxProvenance && meta.originEnactingBody) {
    report(slug, `originEnactingBody ohne REVOSax-Herkunftsbeleg: ${meta.originEnactingBody}`);
  }
  if (forbiddenResponsibilities.has(meta.responsibleMinistry)) {
    report(slug, `führt ein erlassendes Organ als zuständiges Ressort: ${meta.responsibleMinistry}`);
  }
  if (typeof meta.summary !== 'string' || meta.summary.trim().length < 24 || summaryFragment.test(meta.summary.trim())) {
    report(slug, 'summary ist leer, zu kurz oder ein typisches Importfragment');
  }
  if (versions.length === 0) {
    report(slug, 'enthält keine gespeicherte Fassung');
    continue;
  }

  for (const [index, version] of versions.entries()) {
    const identity = {
      title: version.title ?? meta.title,
      shortTitle: version.shortTitle ?? version.title ?? meta.shortTitle ?? meta.title,
      abbr: version.abbr ?? meta.abbr,
    };
    if (!identity.title?.trim() || !identity.shortTitle?.trim()) {
      report(slug, `${version.versionId}: Titel oder Kurztitel fehlt`);
    }
    if (!version.citation?.trim()) report(slug, `${version.versionId}: Vollzitat-Grundlage fehlt`);
    if (version.validTo !== null && version.validTo < version.validFrom) {
      report(slug, `${version.versionId}: Gültigkeitsende liegt vor dem Gültigkeitsbeginn`);
    }
    const next = versions[index + 1];
    if (next && (version.validTo === null || version.validTo >= next.validFrom)) {
      report(slug, `${version.versionId}: Gültigkeitsintervall überlappt ${next.versionId}`);
    }
    if (/Sächsisch|Sachsen/u.test(identity.title)
      && /Ostdeutsch/u.test(version.citation)
      && !/Sächsisch|Sachsen/u.test(version.citation.split(/, (?:zuletzt )?geändert/u)[0])) {
      report(slug, `${version.versionId}: öffentliche Bezeichnung wirkt gegenüber dem Vollzitat veraltet`);
    }
    if (identity.abbr && !meta.keywords?.includes(identity.abbr) && identity.abbr !== meta.abbr) {
      report(slug, `${version.versionId}: fassungsspezifische Abkürzung fehlt in den Suchstichwörtern (${identity.abbr})`);
    }
  }

  const applicable = applicableVersion(meta, versions);
  if (!applicable) report(slug, `keine zum Stichtag ${referenceDate} auswertbare Fassung`);
  const newestPastHistory = [...(history.entries ?? [])]
    .filter((item) => item.date <= referenceDate)
    .sort((left, right) => right.date.localeCompare(left.date))[0];
  if (newestPastHistory && applicable && newestPastHistory.date > applicable.validFrom
    && newestPastHistory.type === 'amendment') {
    report(slug, `letzte Änderung ${newestPastHistory.date} ist jünger als die angezeigte Fassung ${applicable.versionId}`);
  }
}

if (problems.length > 0) {
  console.error(`Metadaten-Audit fehlgeschlagen (${problems.length} Befunde):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Metadaten-Audit erfolgreich: alle Normseiten sind zum Stichtag ${referenceDate} widerspruchsfrei.`);
}
