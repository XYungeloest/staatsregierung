import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildNormFullCitation, buildNormRecordLookup } from '@ostrecht/shared/lib/norms/citation.ts';
import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { getNormOriginInfo, NORM_ORIGIN_KINDS, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';
import { buildNormRelations } from '@ostrecht/shared/lib/norms/relations.ts';
import { resolveRepositoryRoot } from '@ostrecht/shared/lib/repository-root.ts';

/**
 * Abgeleitete Invarianten des gesamten Rechtsbestands (Content-Audit, Teil von content:check):
 *
 *  - Jede gespeicherte Fassung erhält ein ausgeschriebenes Vollzitat, das die Vorschrift nennt
 *    und nicht mit der bloßen Normart („Gesetz vom …“) beginnt; keine maskierten Bindestriche.
 *  - Rechtsherkunft und Erlassorgane widersprechen sich nicht: übernommene Normen führen kein
 *    sächsisches Organ als `enactingBody`, ostdeutsch neu geschaffene Normen kein sächsisches
 *    Ursprungsorgan und kein sächsisches Erlassorgan.
 *  - Der Bestand enthält jede der drei belegten Herkunftsklassen.
 *
 * Die Regeln selbst werden mit synthetischen Datensätzen in tests/norm-citation.test.ts und
 * tests/law-portal.test.ts geprüft; dieses Audit prüft nur, ob der reale Bestand sie erfüllt.
 */
/**
 * Rechtsüberleitungsstichtag: Der sächsische Rechtsstand am 1. November 2023 ist der
 * verbindliche Ausgangspunkt. Eine übernommene und unveränderte Vorschrift darf deshalb
 * keinen sächsischen Rechtsakt nach diesem Tag nennen und nicht Ziel einer Änderung oder
 * Aufhebung mit späterem Datum sein; ein späterer Zwischenstand ist nur mit dokumentierter
 * ostdeutscher Adoption zulässig (data/recht/revosax-post-cutoff-decisions.json).
 */
const BASELINE_DATE = '2023-11-01';
const GERMAN_DATE = /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gu;
const GERMAN_MONTHS: Record<string, string> = {
  Januar: '01', Februar: '02', 'März': '03', April: '04', Mai: '05', Juni: '06',
  Juli: '07', August: '08', September: '09', Oktober: '10', November: '11', Dezember: '12',
};

function germanDatesAfter(value: string | undefined, cutoff: string): string[] {
  const dates: string[] = [];
  for (const match of String(value ?? '').matchAll(GERMAN_DATE)) {
    const iso = `${match[3]}-${GERMAN_MONTHS[match[2]]}-${match[1].padStart(2, '0')}`;
    if (iso > cutoff) dates.push(iso);
  }
  return [...new Set(dates)];
}

const GENERIC_CITATION_LEAD =
  /^(?:Gesetz|Verordnung|Verfassung|Staatsvertrag|Verwaltungsabkommen|Verwaltungsvorschrift|Bekanntmachung|Organisationserlass|Dienstanordnung|Anordnung|Richtlinie|Allgemeinverfügung|Übereinkommen|Vereinbarung|Erlass)\s+vom\b/u;
const SAXON_BODY = /Sächs|Sachsen/u;

const norms = await loadAllNorms();
const lookup = buildNormRecordLookup(norms);
const relations = buildNormRelations(norms);
const postCutoffDecisions = JSON.parse(
  await readFile(join(resolveRepositoryRoot(), 'data', 'recht', 'revosax-post-cutoff-decisions.json'), 'utf8')
    .catch(() => '{"decisions":{}}'),
).decisions as Record<string, { resolution?: string }>;
const problems: string[] = [];
const counts = Object.fromEntries(NORM_ORIGIN_KINDS.map((kind) => [kind, 0])) as Record<NormOriginKind, number>;

for (const record of norms) {
  const slug = record.meta.slug;
  for (const version of record.versions) {
    const citation = buildNormFullCitation(record, version, lookup);
    if (GENERIC_CITATION_LEAD.test(citation)) problems.push(`${slug}:${version.versionId}: Vollzitat nennt nur die Normart: „${citation}“`);
    if (/\\-/u.test(citation)) problems.push(`${slug}:${version.versionId}: Vollzitat enthält einen maskierten Bindestrich`);
  }
  const origin = getNormOriginInfo(record, norms);
  counts[origin.kind] += 1;
  const enactingBody = record.meta.enactingBody ?? '';
  const originBody = record.meta.originEnactingBody ?? '';
  if (origin.kind.startsWith('inherited-') && SAXON_BODY.test(enactingBody)) {
    problems.push(`${slug}: ${origin.kind} führt ein sächsisches Organ als enactingBody (${enactingBody})`);
  }
  if (origin.kind === 'ostdeutsch-original' && SAXON_BODY.test(originBody)) {
    problems.push(`${slug}: ostdeutsch-original führt ein sächsisches Ursprungsorgan (${originBody})`);
  }
  if (origin.kind === 'ostdeutsch-original' && SAXON_BODY.test(enactingBody)) {
    problems.push(`${slug}: ostdeutsch-original führt ein sächsisches Erlassorgan (${enactingBody})`);
  }

  const adopted = postCutoffDecisions?.[slug]?.resolution === 'adopted';
  if (origin.kind === 'inherited-unchanged' && !adopted) {
    const citations = [
      ['meta.json initialCitation', record.meta.initialCitation],
      ...record.versions.map((version) => [`versions/${version.versionId}.json`, version.citation] as const),
      ...record.history.entries.map((entry) => [`history.json ${entry.date}`, entry.citation] as const),
    ] as ReadonlyArray<readonly [string, string | undefined]>;
    for (const [where, citation] of citations) {
      const dates = germanDatesAfter(citation, BASELINE_DATE);
      if (dates.length > 0) {
        problems.push(`${slug}: übernommene, unveränderte Norm nennt in ${where} einen Rechtsakt nach dem Überleitungsstichtag (${dates.join(', ')})`);
      }
    }
    for (const relation of relations.get(slug) ?? []) {
      if (!['amends', 'amended-by', 'repeals', 'repealed-by'].includes(relation.kind)) continue;
      if (!relation.date || relation.date <= BASELINE_DATE) continue;
      const related = relation.norm;
      const relatedOrigin = getNormOriginInfo(related, norms);
      if (!relatedOrigin.kind.startsWith('inherited-')) continue;
      problems.push(`${slug}: übernommene, unveränderte Norm ist über „${relation.kind}“ mit dem übernommenen Rechtsakt ${related.meta.slug} vom ${relation.date} nach dem Überleitungsstichtag verbunden`);
    }
  }
  if (origin.kind.startsWith('inherited-') && record.meta.documentDate && record.meta.documentDate > BASELINE_DATE && !adopted &&
    postCutoffDecisions?.[slug]?.resolution !== 'open') {
    problems.push(`${slug}: übernommene Norm trägt das Erlassdatum ${record.meta.documentDate} nach dem Überleitungsstichtag ohne dokumentierte Übernahme (data/recht/revosax-post-cutoff-decisions.json)`);
  }
}

for (const kind of ['inherited-unchanged', 'inherited-amended', 'ostdeutsch-original'] as const) {
  if (counts[kind] === 0) problems.push(`Herkunftsklasse ${kind} kommt im Bestand nicht mehr vor (${JSON.stringify(counts)})`);
}

if (problems.length > 0) {
  console.error(`Ableitungs-Audit fehlgeschlagen (${problems.length} Befunde):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Ableitungs-Audit erfolgreich: ${norms.length} Normen, Vollzitate ausgeschrieben, Herkunft ${Object.entries(counts).map(([kind, count]) => `${kind} ${count}`).join(', ')}.`);
}
