// Erzeugt die Patch-Rezepte des Testlaufs v2 (vorbereitete Fassungen OGVBl. 2026 Nr. 85-99, Sammeldatei-Hash 5e77b3b2…).
// Wortgetreue Ausführung ohne stillschweigende Reparatur; Abweichungen stehen in commandCoverage.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root = process.cwd();
const { sha256, applyPatchRecipe } = await import(join(root, 'scripts/lib/consolidation-engine.mjs'));
const { parseRevosaxSnapshot } = await import(join(root, 'scripts/lib/revosax-parser.mjs'));
const rj = async (p) => JSON.parse(await readFile(p, 'utf8'));
const src = (n) => `Gesetze/OGVBl. 2026 Nr. ${n}.html`;
const ref = (n) => [{ kind: 'amendment-source', label: `OGVBl. 2026 Nr. ${n}`, availability: 'versioned', localSource: src(n) }];
const V = 'Vorbereitete Fassung (Testlauf v2): ';
const write = async (act, slug, rec) => { await mkdir(join(root, 'data/recht/amendments', act), { recursive: true }); await writeFile(join(root, 'data/recht/amendments', act, `${slug}.json`), JSON.stringify(rec, null, 2) + '\n'); console.log('Rezept', act, slug, rec.effectiveDate); return rec; };
const parsed = async (n) => rj(join(root, 'testlauf/geparst', `OGVBl. 2026 Nr. ${n}.json`));
const clean = (node) => { const c = structuredClone(node); const fix = (x) => { for (const k of ['text', 'title']) if (typeof x[k] === 'string') x[k] = x[k].replace(/^„/u, '').replace(/“\.?$/u, ''); delete x.listId; (x.children ?? []).forEach(fix); }; fix(c); return c; };
const quotedParas = async (n) => { const d = await parsed(n); const r = {}; const w = (xs) => xs.forEach((x) => { if (x.type === 'quotedProvision') (x.children ?? []).filter((c) => c.type === 'paragraph').forEach((p) => { r[p.label] = clean(p); }); w(x.children ?? []); }); w(d.body); return r; };
const items = async (n) => { const d = await parsed(n); const r = []; const w = (xs) => xs.forEach((x) => { if (x.text) r.push(x.text); w(x.children ?? []); }); w(d.body); return r; };
const find = (body, pred, parent = null) => { for (const b of body) { if (pred(b, parent)) return b; const f = find(b.children ?? [], pred, b); if (f) return f; } return null; };
const para = (state, label) => find(state.body, (b) => b.type === 'paragraph' && b.label === label);
const sub = (state, plabel, slabel) => (para(state, plabel).children ?? []).find((c) => c.label === slabel);

// Ziele mit gespeicherter Ausgangsfassung (Testabweichung, produktiv REVOSax-Snapshot erforderlich)
const cfgPath = join(root, 'data/recht/consolidation-sources.json');
const cfg = await rj(cfgPath);
const seeds = {
  'ostdeutsches-polizeifachhochschulgesetz': null, 'vo-bezeichnung-hochschulgrade-fh-polizei': null,
  'ostdeutsches-verfassungsschutzgesetz': null, 'ostdeutsches-artikel-10-gesetz-ausfuehrungsgesetz': null,
  'gesetz-zur-ausfuehrung-des-pass-und-personalausweisgesetzes-im-freistaat-ostdeutschland': null, 'landesjugendhilfegesetz': null, 'ostdeutsches-informationssicherheitsgesetz': null,
};
for (const slug of Object.keys(seeds)) {
  const v = await rj(join(root, 'content/normen', slug, 'versions/2023-11-01.json'));
  seeds[slug] = { title: v.title, body: v.body, citation: v.citation };
  if (cfg.targets[slug]) throw new Error('Ziel existiert bereits: ' + slug);
  cfg.targets[slug] = { title: v.title, aliases: [v.title], existingVersionSeed: { versionId: '2023-11-01' }, testlaufHinweis: 'Testlauf v2 OGVBl. 2026 Nr. 85-99: gespeicherte Ausgangsfassung statt REVOSax-Snapshot; produktiv ist der REVOSax-Abruf zum 1. November 2023 erforderlich.' };
}
await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

// PVDG: Zustand aus REVOSax-Snapshot und vorhandenen Rezepten
const pv = cfg.targets['ostdeutsches-polizeivollzugsdienstgesetz'];
const snap = parseRevosaxSnapshot(await readFile(resolve(root, pv.snapshot), 'utf8'), { url: pv.baselineUrl });
let st = { title: snap.sourceTitle, body: snap.body };
const existing = [];
for (const dir of await readdir(join(root, 'data/recht/amendments'))) { try { existing.push(await rj(join(root, 'data/recht/amendments', dir, 'ostdeutsches-polizeivollzugsdienstgesetz.json'))); } catch {} }
existing.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || (a.sameDayOrder ?? 0) - (b.sameDayOrder ?? 0));
for (const r of existing) st = applyPatchRecipe(st, r);
console.log('PVDG-Ausgangszustand nach', existing.length, 'Rezepten');
const C_PV = 'Ostdeutsches Polizeivollzugsdienstgesetz vom 11. Mai 2019 (SächsGVBl. S. 358), zuletzt geändert durch ';

// Nr. 96 (14.11.2026)
const q96 = await quotedParas(96);
let E = '2026-11-14';
const r96 = { amendmentAct: 'gesetz-aenderung-pvdg-terrorismusabwehr', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 96)', resultCitation: C_PV + 'Artikel 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 96)',
  changeNote: V + '§§ 15a, 20a und 46a zur Terrorismusabwehr eingefügt.',
  commandCoverage: ['Artikel 1 Nummer 2 bis 4 vollständig. Artikel 1 Nummer 1 (Inhaltsübersicht) ist im gespeicherten Normkörper nicht abbildbar. Artikel 3 (Übergangsbestimmung bis 30. November 2026) ändert den Normtext nicht.'],
  sourceReferences: ref(96),
  operations: [['§ 15', '§ 15a', 'Artikel 1 Nummer 2'], ['§ 20', '§ 20a', 'Artikel 1 Nummer 3'], ['§ 46', '§ 46a', 'Artikel 1 Nummer 4']].map(([after, lab, prov]) => ({ op: 'insertProvisionAfter', target: { type: 'paragraph', label: after }, expectedHash: sha256(para(st, after)), expectedMatches: 1, value: q96[lab], source: src(96), sourceProvision: prov, effectiveDate: E })) };
st = applyPatchRecipe(st, await write('gesetz-aenderung-pvdg-terrorismusabwehr', 'ostdeutsches-polizeivollzugsdienstgesetz', r96));

// Nr. 85 Art. 1 (1.12.2026, Reihenfolge 1)
E = '2026-12-01';
const it85 = await items(85);
const n1 = it85.find((t) => t.startsWith('Dem § 1 wird folgender Satz angefügt:'));
const satz3 = n1.replace('Dem § 1 wird folgender Satz angefügt:', '').trim().replace(/^„/u, '').replace(/“$/u, '');
const p1 = find(para(st, '§ 1').children, (b) => b.type === 'paragraphText');
const p46 = sub(st, '§ 46', '(1)');
const OLD46 = 'des Landespolizeipräsidenten oder seines Vertreters im Amt', NEW46 = 'des/der Volkspolizeipräsident:in oder deren Vertretung im Amt';
if (p46.text.split(OLD46).length !== 2) throw new Error('§ 46 Abs. 1: Treffer ≠ 1');
const r85 = { amendmentAct: 'gesetz-bezeichnung-volkspolizei', effectiveDate: E, versionId: E, sameDayOrder: 1,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 85)', resultCitation: C_PV + 'Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 88)',
  changeNote: V + 'amtliche Bezeichnung Volkspolizei für die Polizeidienststellen nach dem Volkspolizeiorganisationsgesetz eingeführt; Freigabe besonderer Waffen neu bezeichnet.',
  commandCoverage: ['Artikel 1 Nummer 1 und 2 wortgetreu. In Nummer 1 fehlt im Gesetzblatt das öffnende Anführungszeichen des angefügten Satzes; der Satz wird ohne Anführungszeichen übernommen. Nummer 2 übernimmt die Bezeichnung „Volkspolizeipräsident:in“, für die kein Blatt ein Amt schafft (Befund B-02).'],
  sourceReferences: ref(85),
  operations: [
    { op: 'replaceText', target: { type: 'paragraphText', parentType: 'paragraph', parentLabel: '§ 1' }, expectedOld: p1.text, value: p1.text + ' ' + satz3, expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 1 Nummer 1', effectiveDate: E },
    { op: 'replaceText', target: { type: 'subparagraph', label: '(1)', parentType: 'paragraph', parentLabel: '§ 46' }, expectedOld: p46.text, value: p46.text.replace(OLD46, NEW46), expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 1 Nummer 2', effectiveDate: E },
  ] };
st = applyPatchRecipe(st, await write('gesetz-bezeichnung-volkspolizei', 'ostdeutsches-polizeivollzugsdienstgesetz', r85));

// Nr. 86 Art. 2 (1.12.2026, Reihenfolge 2) – wörtlich: nur Absätze 1 und 2 von § 97
const q86 = await quotedParas(86);
const new97 = q86['§ 97'];
const p97 = para(st, '§ 97');
const i1 = p97.children.findIndex((c) => c.label === '(1)'), i2 = p97.children.findIndex((c) => c.label === '(2)');
const range = p97.children.slice(i1, i2 + 1);
const it86 = await items(86);
const a101 = it86.find((t) => t.startsWith('Absatz 1 wird wie folgt gefasst: „(1)'));
const t101 = a101.replace('Absatz 1 wird wie folgt gefasst: „(1) ', '').replace(/“$/u, '');
const s101 = sub(st, '§ 101', '(1)'), s101_3 = sub(st, '§ 101', '(3)');
const r86 = { amendmentAct: 'gesetz-organisation-volkspolizei', effectiveDate: E, versionId: E, sameDayOrder: 2,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 86)', resultCitation: C_PV + 'Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 88)',
  changeNote: V + 'Polizeidienststellen einschließlich der Kasernierten Grenzpolizei bestimmt; Aufsicht neu geregelt; §§ 99 und 100 aufgehoben.',
  commandCoverage: ['Artikel 2 Nummer 2 bis 4 ausgeführt. Nummer 1 (Inhaltsübersicht) ist nicht abbildbar. Nummer 2 lautet „§ 97 Absatz 1 bis 2 wird wie folgt gefasst:“, das Zitat enthält aber Paragraphenzeichen und Überschrift von § 97 (gleichlautend mit der bisherigen Überschrift). Wortgetreu ausgeführt werden nur die Absätze 1 und 2; die Absätze 3 und 4 bleiben stehen. Die Lesart „ganzer § 97“ würde Absatz 3 (Polizeidirektion Berlin) und den verkündeten, im Bestand nicht abgebildeten Absatz 4 entfallen lassen. Keine stillschweigende Fassungswahl.'],
  sourceReferences: ref(86),
  operations: [
    { op: 'replaceSiblingRange', target: { type: 'subparagraph', label: '(1)', parentLabel: '§ 97' }, throughTarget: { type: 'subparagraph', label: '(2)', parentLabel: '§ 97' }, expectedHash: sha256(range), expectedMatches: 1, value: new97.children.filter((c) => ['(1)', '(2)'].includes(c.label)), source: src(86), sourceProvision: 'Artikel 2 Nummer 2', effectiveDate: E },
    { op: 'repealProvision', target: { type: 'paragraph', label: '§ 99' }, expectedHash: sha256(para(st, '§ 99')), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 2 Nummer 3', effectiveDate: E },
    { op: 'repealProvision', target: { type: 'paragraph', label: '§ 100' }, expectedHash: sha256(para(st, '§ 100')), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 2 Nummer 3', effectiveDate: E },
    { op: 'replaceText', target: { type: 'subparagraph', label: '(1)', parentType: 'paragraph', parentLabel: '§ 101' }, expectedOld: s101.text, value: t101, expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 2 Nummer 4 Buchstabe a', effectiveDate: E },
    { op: 'repealProvision', target: { type: 'subparagraph', label: '(3)', parentType: 'paragraph', parentLabel: '§ 101' }, expectedHash: sha256(s101_3), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 2 Nummer 4 Buchstabe b', effectiveDate: E },
  ] };
st = applyPatchRecipe(st, await write('gesetz-organisation-volkspolizei', 'ostdeutsches-polizeivollzugsdienstgesetz', r86));

// Nr. 88 Art. 2 (1.12.2026, Reihenfolge 3) – Text gegenüber v1 unverändert
const q88 = await quotedParas(88);
const r88 = { amendmentAct: 'gesetz-einfuehrung-polizeibeschwerdestelle', effectiveDate: E, versionId: E, sameDayOrder: 3,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 88)', resultCitation: C_PV + 'Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 88)',
  changeNote: V + '§ 98 als Verweis auf das Polizeibeschwerdestellengesetz neu gefasst.', commandCoverage: ['Artikel 2 vollständig.'], sourceReferences: ref(88),
  operations: [{ op: 'replaceProvision', target: { type: 'paragraph', label: '§ 98' }, expectedHash: sha256(para(st, '§ 98')), expectedMatches: 1, value: q88['§ 98'], source: src(88), sourceProvision: 'Artikel 2', effectiveDate: E }] };
if (!q88['§ 98']) throw new Error('Nr. 88: § 98 nicht im Zitat gefunden');
st = applyPatchRecipe(st, await write('gesetz-einfuehrung-polizeibeschwerdestelle', 'ostdeutsches-polizeivollzugsdienstgesetz', r88));

// PolFHG: Nr. 85 Art. 2 (1.12.2026), Nr. 87 Art. 1 (1.1.2027)
const fh = seeds['ostdeutsches-polizeifachhochschulgesetz'];
const C_FH = 'Ostdeutsches Polizeifachhochschulgesetz vom 21. Dezember 2021 (SächsGVBl. 2022 S. 2)';
let fs = { title: fh.title, body: fh.body };
const fh16 = find(para(fs, '§ 16').children, (b) => b.type === 'item' && b.text?.includes('die Landespolizeipräsidentin oder der Landespolizeipräsident'));
const rFH85 = { amendmentAct: 'gesetz-bezeichnung-volkspolizei', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 85)', resultCitation: C_FH + ', zuletzt geändert durch Artikel 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 85)',
  changeNote: V + 'Gesetzes- und Hochschulbezeichnung auf Volkspolizei umgestellt; Beiratssitz der obersten Polizeibehörde zugeordnet.',
  commandCoverage: ['Artikel 2 Nummer 1 bis 3 vollständig.'], sourceReferences: ref(85),
  operations: [
    { op: 'renameLaw', expectedOld: fh.title, value: 'Gesetz über die Hochschule der Volkspolizei', expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 2 Nummer 1', effectiveDate: E },
    { op: 'designationReplacementBody', expectedOld: 'Hochschule der Ostdeutschen Polizei (FH)', value: 'Hochschule der Volkspolizei (FH)', expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 2 Nummer 2', effectiveDate: E },
    { op: 'replaceText', target: { type: 'item', text: fh16.text, parentType: 'paragraph', parentLabel: '§ 16' }, expectedOld: fh16.text, value: fh16.text.replace('die Landespolizeipräsidentin oder der Landespolizeipräsident', 'die Leitung der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes oder eine von ihr benannte Vertretung'), expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 2 Nummer 3', effectiveDate: E },
  ] };
fs = applyPatchRecipe(fs, await write('gesetz-bezeichnung-volkspolizei', 'ostdeutsches-polizeifachhochschulgesetz', rFH85));
const q87 = await quotedParas(87);
const E2 = '2027-01-01';
const p22 = para(fs, '§ 22');
await write('gesetz-reform-polizeiausbildung', 'ostdeutsches-polizeifachhochschulgesetz', { amendmentAct: 'gesetz-reform-polizeiausbildung', effectiveDate: E2, versionId: E2,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 87)', resultCitation: C_FH + ', zuletzt geändert durch Artikel 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 87)',
  changeNote: V + '§§ 22a bis 22d über Pflichtkompetenzen, Fortbildung, Führungsqualifizierung und Evaluation eingefügt.',
  commandCoverage: ['Artikel 1 vollständig. Artikel 2 ändert keinen Normtext.'], sourceReferences: ref(87),
  operations: ['§ 22d', '§ 22c', '§ 22b', '§ 22a'].map((lab) => ({ op: 'insertProvisionAfter', target: { type: 'paragraph', label: '§ 22' }, expectedHash: sha256(p22), expectedMatches: 1, value: q87[lab], source: src(87), sourceProvision: 'Artikel 1', effectiveDate: E2 })) });

// Hochschulgrade-VO: Nr. 85 Art. 3
const vo = seeds['vo-bezeichnung-hochschulgrade-fh-polizei'];
const vo11 = (vo.body.find((x) => x.label === '§ 1').children ?? []).find((x) => x.label === '(1)');
await write('gesetz-bezeichnung-volkspolizei', 'vo-bezeichnung-hochschulgrade-fh-polizei', { amendmentAct: 'gesetz-bezeichnung-volkspolizei', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 85)', resultCitation: 'Verordnung über die Bezeichnung der Hochschulgrade an der Hochschule der Volkspolizei (FH) vom 19. Mai 2009 (SächsGVBl. S. 250), geändert durch Artikel 3 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 85)',
  changeNote: V + 'Bezeichnung der Verordnung und der Hochschule auf Volkspolizei umgestellt.', commandCoverage: ['Artikel 3 Nummer 1 und 2 vollständig.'], sourceReferences: ref(85),
  operations: [
    { op: 'renameLaw', expectedOld: vo.title, value: 'Verordnung über die Bezeichnung der Hochschulgrade an der Hochschule der Volkspolizei (FH)', expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 3 Nummer 1', effectiveDate: E },
    { op: 'replaceText', target: { type: 'subparagraph', label: '(1)', parentType: 'paragraph', parentLabel: '§ 1' }, expectedOld: vo11.text, value: vo11.text.replace('Hochschule der Ostdeutschen Polizei (FH)', 'Hochschule der Volkspolizei (FH)'), expectedMatches: 1, source: src(85), sourceProvision: 'Artikel 3 Nummer 2', effectiveDate: E },
  ] });

// Folgeänderungen Nr. 86 Art. 3 (1.12.2026)
const rep = (s, a, b) => { if (s.split(a).length !== 2) throw new Error('Treffer ≠ 1: ' + a); return s.replace(a, b); };
const VPOG24 = 'die Bezirkspolizeidirektionen nach § 2 Absatz 2 Nummer 4 des Volkspolizeiorganisationsgesetzes';
const pa = seeds['gesetz-zur-ausfuehrung-des-pass-und-personalausweisgesetzes-im-freistaat-ostdeutschland'];
const pa2 = find(para(pa, '§ 2').children, (b) => b.type === 'paragraphText');
await write('gesetz-organisation-volkspolizei', 'gesetz-zur-ausfuehrung-des-pass-und-personalausweisgesetzes-im-freistaat-ostdeutschland', { amendmentAct: 'gesetz-organisation-volkspolizei', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 86)', resultCitation: pa.citation + ', zuletzt geändert durch Artikel 3 Absatz 1 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 86)',
  changeNote: V + 'Zuständigkeit auf die Bezirkspolizeidirektionen nach dem Volkspolizeiorganisationsgesetz umgestellt.', commandCoverage: ['Artikel 3 Absatz 1 vollständig.'], sourceReferences: ref(86),
  operations: [{ op: 'replaceText', target: { type: 'paragraphText', parentType: 'paragraph', parentLabel: '§ 2' }, expectedOld: pa2.text, value: rep(pa2.text, 'die Polizeidirektionen nach § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung', VPOG24), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 3 Absatz 1', effectiveDate: E }] });
const lj = seeds['landesjugendhilfegesetz'];
const ljf = find(para(lj, '§ 5').children, (b) => b.type === 'item' && b.label === 'f)');
await write('gesetz-organisation-volkspolizei', 'landesjugendhilfegesetz', { amendmentAct: 'gesetz-organisation-volkspolizei', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 86)', resultCitation: lj.citation + ', zuletzt geändert durch Artikel 3 Absatz 2 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 86)',
  changeNote: V + 'Bestimmung der Polizeivertretung im Landesjugendhilfeausschuss auf die Bezirkspolizeidirektion umgestellt.', commandCoverage: ['Artikel 3 Absatz 2 vollständig.'], sourceReferences: ref(86),
  operations: [{ op: 'replaceText', target: { type: 'item', text: ljf.text, parentType: 'paragraph', parentLabel: '§ 5' }, expectedOld: ljf.text, value: rep(ljf.text, 'von der zuständigen Polizeidirektion gemäß § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung,', 'von der zuständigen Bezirkspolizeidirektion nach § 2 Absatz 2 Nummer 4 des Volkspolizeiorganisationsgesetzes'), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 3 Absatz 2', effectiveDate: E }] });
const is = seeds['ostdeutsches-informationssicherheitsgesetz'];
const OPB = 'der obersten Polizeibehörde nach § 2 Absatz 1 des Volkspolizeiorganisationsgesetzes';
const is7 = sub(is, '§ 7', '(1)'), is9 = find(para(is, '§ 9').children, (b) => b.type === 'paragraphText'), is10 = sub(is, '§ 10', '(1)');
await write('gesetz-organisation-volkspolizei', 'ostdeutsches-informationssicherheitsgesetz', { amendmentAct: 'gesetz-organisation-volkspolizei', effectiveDate: E, versionId: E,
  amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 86)', resultCitation: is.citation + ', geändert durch Artikel 3 Absatz 3 des Gesetzes vom 13. November 2026 (OGVBl. 2026 Nr. 86)',
  changeNote: V + 'Landespolizeipräsidium durch die oberste Polizeibehörde nach dem Volkspolizeiorganisationsgesetz ersetzt.', commandCoverage: ['Artikel 3 Absatz 3 Nummer 1 und 2 vollständig.'], sourceReferences: ref(86),
  operations: [
    { op: 'replaceText', target: { type: 'subparagraph', label: '(1)', parentType: 'paragraph', parentLabel: '§ 7' }, expectedOld: is7.text, value: rep(is7.text, 'dem Landespolizeipräsidium', OPB), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 3 Absatz 3 Nummer 1', effectiveDate: E },
    { op: 'replaceText', target: { type: 'paragraphText', parentType: 'paragraph', parentLabel: '§ 9' }, expectedOld: is9.text, value: rep(is9.text, 'dem Landespolizeipräsidium', OPB), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 3 Absatz 3 Nummer 1', effectiveDate: E },
    { op: 'replaceText', target: { type: 'subparagraph', label: '(1)', parentType: 'paragraph', parentLabel: '§ 10' }, expectedOld: is10.text, value: rep(is10.text, 'des Landespolizeipräsidiums', OPB.replace('der obersten', 'der obersten')), expectedMatches: 1, source: src(86), sourceProvision: 'Artikel 3 Absatz 3 Nummer 2', effectiveDate: E },
  ] });

// Aufhebungen Nr. 99 Art. 1 und 2 (Ablauf 31.12.2026)
for (const [slug, art] of [['ostdeutsches-verfassungsschutzgesetz', 'Artikel 1'], ['ostdeutsches-artikel-10-gesetz-ausfuehrungsgesetz', 'Artikel 2']]) {
  const s = seeds[slug];
  await write('ost-sicherheitsreform-anpassungsgesetz', slug, { amendmentAct: 'ost-sicherheitsreform-anpassungsgesetz', effectiveDate: E2, repealsLaw: true,
    amendmentCitation: 'Gesetz vom 13. November 2026 (OGVBl. 2026 Nr. 99)', resultCitation: s.citation,
    changeNote: V + `mit Ablauf des 31. Dezember 2026 aufgehoben durch ${art} des Gesetzes zur Einführung der Ost-Sicherheitsreform.`, sourceReferences: ref(99),
    operations: [{ op: 'repealLaw', expectedHash: sha256({ title: s.title, body: s.body }), expectedMatches: 1, source: src(99), sourceProvision: art, effectiveDate: E2 }] });
}
console.log('fertig');
