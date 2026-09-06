import { buildNormFullCitation, buildNormRecordLookup } from '@ostrecht/shared/lib/norms/citation.ts';
import { loadAllNorms } from '@ostrecht/shared/lib/norms/loader.ts';
import { getNormOriginInfo, NORM_ORIGIN_KINDS, type NormOriginKind } from '@ostrecht/shared/lib/norms/origin.ts';

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
const GENERIC_CITATION_LEAD =
  /^(?:Gesetz|Verordnung|Verfassung|Staatsvertrag|Verwaltungsabkommen|Verwaltungsvorschrift|Bekanntmachung|Organisationserlass|Dienstanordnung|Anordnung|Richtlinie|Allgemeinverfügung|Übereinkommen|Vereinbarung|Erlass)\s+vom\b/u;
const SAXON_BODY = /Sächs|Sachsen/u;

const norms = await loadAllNorms();
const lookup = buildNormRecordLookup(norms);
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
