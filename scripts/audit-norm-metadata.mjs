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
// Ab diesem Verkündungsdatum werden Normen redaktionell vollständig erfasst: erlassendes Organ,
// fachliche Zuständigkeit und eine eigene Zusammenfassung sind Pflicht.
const EDITORIAL_METADATA_SINCE = '2026-07-20';
// Kopf-, Bild-, Editor- und Signaturreste aus Importen gehören nie in einen Normkörper.
const IMPORT_ARTEFACTS = /data:image|;base64,|@import|LANDTAGSPRÄSIDENT|Ausgabe X\b|<mxfile/u;

function sourceReferenceKey(reference) {
  return JSON.stringify([reference.kind ?? null, reference.localSource ?? null, reference.objectKey ?? null, reference.url ?? null, reference.pageRange ?? null, reference.label ?? null]);
}

function reportDuplicateSources(slug, label, references) {
  const seen = new Set();
  for (const reference of references ?? []) {
    const key = sourceReferenceKey(reference);
    if (seen.has(key)) report(slug, `${label}: doppelte Quellenreferenz ${reference.label ?? reference.localSource ?? reference.objectKey ?? ''}`);
    seen.add(key);
  }
}

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
  // Eine Kurzbeschreibung ist freiwillig: der übernommene Massenbestand hat keine Quelle, aus der
  // sich eine belastbare Kurzfassung ableiten ließe. Steht eine da, muss sie eine Beschreibung
  // sein und kein Importfragment; der Arbeitsvorrat steht in data/recht/norm-summary-review.json.
  if (meta.summary !== undefined
    && (typeof meta.summary !== 'string' || meta.summary.trim().length < 24 || summaryFragment.test(meta.summary.trim()))) {
    report(slug, 'summary ist gesetzt, aber zu kurz oder ein typisches Importfragment');
  }
  // Formelhafte Zusammenfassungen prüft scripts/check-content.mjs bestandsweit gegen
  // summarySource und Herkunft; hier bleiben nur die stichtagsgebundenen Pflichtfelder.
  if ((meta.publicationDate ?? '') >= EDITORIAL_METADATA_SINCE) {
    if (!meta.enactingBody) report(slug, `ab ${EDITORIAL_METADATA_SINCE} verkündete Normen führen das erlassende Organ (enactingBody)`);
    if (!meta.responsibleMinistry) report(slug, `ab ${EDITORIAL_METADATA_SINCE} verkündete Normen führen die fachliche Zuständigkeit (responsibleMinistry)`);
  }
  reportDuplicateSources(slug, 'meta.json', meta.sourceReferences);
  if (versions.length === 0) {
    report(slug, 'enthält keine gespeicherte Fassung');
    continue;
  }

  for (const [index, version] of versions.entries()) {
    if (!Array.isArray(version.body) || version.body.length === 0) report(slug, `${version.versionId}: leerer Normkörper`);
    else if (IMPORT_ARTEFACTS.test(JSON.stringify(version.body))) report(slug, `${version.versionId}: Normkörper enthält Import-Artefakte (${JSON.stringify(version.body).match(IMPORT_ARTEFACTS)?.[0]})`);
    reportDuplicateSources(slug, version.versionId, version.sourceReferences);
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
