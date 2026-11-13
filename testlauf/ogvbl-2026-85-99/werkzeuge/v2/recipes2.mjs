import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const [,, root, sp] = process.argv;
const { sha256, applyPatchRecipe } = await import(join(root, 'scripts/lib/consolidation-engine.mjs'));
const rj = async (p) => JSON.parse(await readFile(p, 'utf8'));
const src = (n) => `Gesetze/OGVBl. 2026 Nr. ${n}.html`;
const ref = (n) => [{ kind: 'amendment-source', label: `OGVBl. 2026 Nr. ${n}`, availability: 'versioned', localSource: src(n) }];
const write = async (act, slug, rec) => { await mkdir(join(root, 'data/recht/amendments', act), { recursive: true }); await writeFile(join(root, 'data/recht/amendments', act, `${slug}.json`), JSON.stringify(rec, null, 2) + '\n'); console.log('Rezept', act, slug); };
const seed = async (slug) => { const v = await rj(join(root, 'content/normen', slug, 'versions/2023-11-01.json')); const m = await rj(join(root, 'content/normen', slug, 'meta.json')); return { title: v.title ?? m.title, body: v.body, citation: v.citation, meta: m }; };
const clean = (node) => { const c = structuredClone(node); const fix = (x) => { for (const k of ['text', 'title']) if (typeof x[k] === 'string') x[k] = x[k].replace(/^„/u, '').replace(/“\.?$/u, ''); delete x.listId; (x.children ?? []).forEach(fix); }; fix(c); return c; };
const quoted = async (n) => { const d = await rj(join(sp, 'parsed', `OGVBl. 2026 Nr. ${n}.json`)); const r = []; const w = (xs) => xs.forEach((x) => { if (x.type === 'quotedProvision') r.push(x); w(x.children ?? []); }); w(d.body); return r; };
// Konfiguration der Ziele (Testabweichung: gespeicherte Ausgangsfassung statt REVOSax-Snapshot)
const cfgPath = join(root, 'data/recht/consolidation-sources.json');
const cfg = await rj(cfgPath);
const targets = {
  'ostdeutsches-polizeifachhochschulgesetz': 'Gesetz über die Hochschule der Ostdeutschen Polizei (FH)',
  'vo-bezeichnung-hochschulgrade-fh-polizei': 'Verordnung des Ostdeutschen Staatsministeriums des Innern über die Bezeichnung der Hochschulgrade an der Hochschule der Ostdeutschen Polizei (FH)',
  'ostdeutsches-verfassungsschutzgesetz': 'Gesetz über den Verfassungsschutz im Freistaat Ostdeutschland',
  'ostdeutsches-artikel-10-gesetz-ausfuehrungsgesetz': 'Gesetz zur Ausführung des Artikel 10-Gesetzes im Freistaat Ostdeutschland',
};
for (const [slug, title] of Object.entries(targets)) cfg.targets[slug] = { title, aliases: [title], existingVersionSeed: { versionId: '2023-11-01' }, testlaufHinweis: 'Testlauf OGVBl. 2026 Nr. 85-99: gespeicherte Ausgangsfassung statt REVOSax-Snapshot; produktiv ist der REVOSax-Abruf zum 1. November 2023 erforderlich.' };
await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
// PolFHG
const fh = await seed('ostdeutsches-polizeifachhochschulgesetz');
const C_FH = 'Ostdeutsches Polizeifachhochschulgesetz vom 21. Dezember 2021 (SächsGVBl. 2022 S. 2)';
let E = '2026-12-01';
const r85 = { amendmentAct: 'gesetz-bezeichnung-volkspolizei', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 85)', resultCitation: C_FH + ', zuletzt geändert durch Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 85)',
  changeNote: 'Vorbereitete Fassung (Testlauf): Gesetzesbezeichnung und Hochschulbezeichnung auf Volkspolizei umgestellt.',
  commandCoverage: ['Artikel 2 Nummer 1 und 2. Nummer 2 nennt keinen Ort („Es werden je die Wörter …“); im Normkörper besteht genau ein Treffer (§ 1), der ersetzt wird. Kurzbezeichnung und Abkürzung bleiben unverändert.'],
  sourceReferences: ref(85),
  operations: [
    { op: 'renameLaw', expectedOld: fh.title, value: 'Gesetz über die Hochschule der Volkspolizei', expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 2 Nummer 1', effectiveDate: E },
    { op: 'designationReplacementBody', expectedOld: 'Hochschule der Ostdeutschen Polizei (FH)', value: 'Hochschule der Volkspolizei (FH)', expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 2 Nummer 2', effectiveDate: E },
  ] };
await write('gesetz-bezeichnung-volkspolizei', 'ostdeutsches-polizeifachhochschulgesetz', r85);
const after85 = applyPatchRecipe({ title: fh.title, body: fh.body }, r85);
const p22 = after85.body.find((x) => x.type === 'paragraph' && x.label === '§ 22');
const q87 = (await quoted(87))[0].children.filter((x) => x.type === 'paragraph').map(clean);
E = '2027-01-01';
await write('gesetz-reform-polizeiausbildung', 'ostdeutsches-polizeifachhochschulgesetz', { amendmentAct: 'gesetz-reform-polizeiausbildung', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 87)', resultCitation: C_FH + ', zuletzt geändert durch Artikel 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 87)',
  changeNote: 'Vorbereitete Fassung (Testlauf): §§ 22a bis 22d über Pflichtkompetenzen, Fortbildung, Führungsqualifizierung und Evaluation eingefügt.',
  commandCoverage: ['Artikel 1 vollständig. Artikel 2 (Anpassungsauftrag an die Ausbildungs- und Prüfungsordnung) ändert keinen Normtext.'],
  sourceReferences: ref(87),
  operations: [...q87].reverse().map((value) => ({ op: 'insertProvisionAfter', target: { type: 'paragraph', label: '§ 22' }, expectedHash: sha256(p22), expectedMatches: 1, value, source: src(87), sourceProvision: 'Artikel 1', effectiveDate: E })) });
// VO Hochschulgrade
const vo = await seed('vo-bezeichnung-hochschulgrade-fh-polizei');
const vo11 = vo.body.find((x) => x.label === '§ 1').children.find((x) => x.label === '(1)');
E = '2026-12-01';
await write('gesetz-bezeichnung-volkspolizei', 'vo-bezeichnung-hochschulgrade-fh-polizei', { amendmentAct: 'gesetz-bezeichnung-volkspolizei', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 85)', resultCitation: 'Verordnung über die Bezeichnung der Hochschulgrade an der Hochschule der Volkspolizei (FH) vom 19. Mai 2009 (SächsGVBl. S. 250), geändert durch Artikel 3 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 85)',
  changeNote: 'Vorbereitete Fassung (Testlauf): Bezeichnung der Verordnung und der Hochschule auf Volkspolizei umgestellt.',
  commandCoverage: ['Artikel 3 Nummer 1 und 2 vollständig.'], sourceReferences: ref(85),
  operations: [
    { op: 'renameLaw', expectedOld: vo.title, value: 'Verordnung über die Bezeichnung der Hochschulgrade an der Hochschule der Volkspolizei (FH)', expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 3 Nummer 1', effectiveDate: E },
    { op: 'replaceText', target: { type: 'subparagraph', label: '(1)', parentType: 'paragraph', parentLabel: '§ 1' }, expectedOld: vo11.text, value: vo11.text.replace('Hochschule der Ostdeutschen Polizei (FH)', 'Hochschule der Volkspolizei (FH)'), expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 3 Nummer 2', effectiveDate: E },
  ] });
// Aufhebungen
E = '2027-01-01';
for (const [slug, art] of [['ostdeutsches-verfassungsschutzgesetz', 'Artikel 1'], ['ostdeutsches-artikel-10-gesetz-ausfuehrungsgesetz', 'Artikel 2']]) {
  const s = await seed(slug);
  await write('ost-sicherheitsreform-anpassungsgesetz', slug, { amendmentAct: 'ost-sicherheitsreform-anpassungsgesetz', effectiveDate: E, repealsLaw: true,
    amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 99)', resultCitation: s.citation,
    changeNote: `Vorbereitete Fassung (Testlauf): mit Ablauf des 31. Dezember 2026 aufgehoben durch ${art} des Gesetzes zur Einführung der Ost-Sicherheitsreform.`,
    sourceReferences: ref(99),
    operations: [{ op: 'repealLaw', expectedHash: sha256({ title: s.title, body: s.body }), expectedMatches: 1, source: src(99), sourceProvision: art, effectiveDate: E }] });
}
