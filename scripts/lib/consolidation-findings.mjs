const file = 'data/recht/consolidation-manifest.json';

export function consolidationFindings(manifest, acts, affected) {
  const findings = [];
  for (const [i, target] of manifest.targets.entries()) {
    const related = [...target.amendmentActs, ...target.enactingActs, ...target.correctionActs].some((a) => acts.has(a.slug));
    if (!affected.has(target.canonicalSlug) && !related) continue;
    const blocked = target.status !== 'complete';
    findings.push({
      relation: 'consolidation', id: target.canonicalSlug, confidence: blocked ? 'candidate' : 'derived',
      evidence: [{ file, locator: '/targets/' + i, citation: target.title }], action: target.nextAction,
      status: target.status, problems: target.problems, effectiveDates: target.effectiveDates,
    });
  }
  for (const [i, finding] of manifest.ambiguousFindings.entries()) {
    if (acts.has(finding.amendmentAct)) findings.push({
      relation: 'ambiguous-target', id: finding.candidate, confidence: 'candidate',
      evidence: [{ file, locator: '/ambiguousFindings/' + i, citation: finding.evidence }],
      action: 'Zielvorschrift an der Primärquelle klären.',
    });
  }
  return findings;
}
