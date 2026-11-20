import { parseArgs } from 'node:util';
import { analyzeImpact } from './lib/content-impact.mjs';
import { loadImpactRepository, validId } from './lib/impact-repository.mjs';

function printReport(report, summary) {
  console.log(report.source.title + ' · ' + report.source.file + ' · Stichtag ' + report.referenceDate);
  const labels = { direct: 'Direkt belegt', derived: 'Abgeleitet', candidate: 'Prüfkandidaten' };
  for (const [key, label] of Object.entries(labels)) {
    const found = report.findings.filter((r) => r.confidence === key);
    console.log(label + ' (' + found.length + ')');
    if (summary) continue;
    for (const row of found) {
      const detail = [row.versionId, row.temporalKind, row.deadlineDate, row.status].filter(Boolean).join(' · ');
      console.log('  ' + row.relation + ' ' + row.id + (detail ? ' · ' + detail : '') + ' — ' + row.action);
      for (const ref of row.evidence) console.log('    ' + ref.file + ' #' + ref.locator + (ref.citation ? ' · ' + ref.citation : ''));
    }
  }
}

try {
  const { values } = parseArgs({ options: {
    publication: { type: 'string' }, norm: { type: 'string' }, json: { type: 'boolean' },
    'source-file': { type: 'string', multiple: true }, summary: { type: 'boolean' },
  } });
  const { publication, norm } = values;
  const files = values['source-file'];
  if ([publication, norm, files].filter(Boolean).length !== 1
      || (!files && !validId(publication ?? norm))
      || files?.some((f) => !f || /[/\\\0]/u.test(f))) {
    throw new TypeError('Genau --publication <Slug>, --norm <Slug> oder --source-file <Dateiname> angeben.');
  }
  const model = loadImpactRepository();
  if (files) {
    const reports = [];
    const unmatched = [];
    const matched = new Set();
    for (const f of files) {
      const key = 'Gesetze/' + f;
      const issues = model.publications.filter((p) => p.sourceReferences?.some((s) => s.localSource === key));
      if (!issues.length) unmatched.push(key);
      for (const p of issues) matched.add(p.slug);
    }
    for (const slug of [...matched].sort()) reports.push(analyzeImpact(model, { publication: slug }));
    if (values.json) console.log(JSON.stringify({ reports, unmatched }, null, 2));
    else {
      for (const path of unmatched) console.log('Zuordnung zu einer Verkündung prüfen: ' + path);
      for (const report of reports) printReport(report, values.summary);
    }
  } else {
    const report = analyzeImpact(model, { publication, norm });
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report, values.summary);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = error.code?.startsWith('ERR_PARSE_ARGS') || error instanceof TypeError ? 2 : 1;
}
