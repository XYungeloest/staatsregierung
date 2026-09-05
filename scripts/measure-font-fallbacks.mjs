#!/usr/bin/env node

// Rückfallschnitte herleiten: In Chromium (Playwright) werden für Jost bzw. Source Serif 4 und für
// jede Kandidatenschrift die gerenderten Breiten zweier Textproben (16 px, mit Kerning) und die
// Zeilenbox gemessen; daraus folgen size-adjust, ascent-override und descent-override, die
// anschließend als FontFace angewandt und gegengeprüft werden. Ergebnisse und Entscheidung stehen in
// packages/shared/src/assets/fonts/README.md.
//
//   node scripts/measure-font-fallbacks.mjs kandidaten.json
//
// kandidaten.json: [{ "id": "georgia", "role": "serif", "label": "Georgia", "file": "/…/Georgia.ttf" }, …]
// role: "sans" (gegen Jost) oder "serif" (gegen Source Serif 4). Die Kandidatendateien sind die
// Systemschriften der Zielplattformen und liegen nicht im Repository.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium } from '@playwright/test';

const ROOT = resolve(process.cwd());
const WEB = {
  sans: { file: resolve(ROOT, 'packages/shared/src/assets/fonts/Jost-Variable.woff2'), type: 'font/woff2', label: 'Jost' },
  serif: { file: resolve(ROOT, 'packages/shared/src/assets/fonts/SourceSerif4Variable-Roman.woff2'), type: 'font/woff2', label: 'Source Serif 4' },
};
const UI = ['Gesetze', 'Verordnungen', 'Verwaltungsvorschriften', 'Rechtsentwicklung', 'Verkündungen', 'Sachgebiete', 'Suche in OstRecht', 'Alle Treffer anzeigen', 'Herkunft', 'Rechtsgebiet', 'Staatsregierung', 'Kabinett', 'Haushalt', 'Themen', 'Presse', 'Service', 'Kontakt', 'Ostdeutsches Kulturpassgesetz', 'Sächsische Gemeindeordnung', 'Zum Inhalt springen'].join(' ');
const TEXT = 'Die Staatsregierung des Freistaates Ostdeutschland veröffentlicht Gesetze, Verordnungen und Verwaltungsvorschriften im amtlichen Wortlaut. § 1 Absatz 2 Satz 3 gilt entsprechend; die Änderungen treten am 1. Januar 2026 in Kraft. Franz jagt im komplett verwahrlosten Taxi quer durch Bayern, während zwölf Boxkämpfer über den großen Sylter Deich jagen (0123456789).';

const candidatesFile = process.argv[2];
if (!candidatesFile) {
  console.error('Verwendung: node scripts/measure-font-fallbacks.mjs <kandidaten.json>');
  process.exit(2);
}
const candidates = JSON.parse(readFileSync(candidatesFile, 'utf8'));
const pct = (value) => `${(value * 100).toFixed(1)}%`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('http://fonts.test/**', (route) => {
  const name = new URL(route.request().url()).pathname.slice(1);
  const source = WEB[name] ?? candidates.find((candidate) => candidate.id === name);
  route.fulfill({ body: readFileSync(source.file), contentType: source.type ?? 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
});
const faces = [
  `@font-face { font-family: 'web-sans'; src: url(http://fonts.test/sans) format('woff2'); font-weight: 100 900; }`,
  `@font-face { font-family: 'web-serif'; src: url(http://fonts.test/serif) format('woff2'); font-weight: 400 700; }`,
  ...candidates.map((candidate) => `@font-face { font-family: 'cand-${candidate.id}'; src: url(http://fonts.test/${candidate.id}); }`),
].join('\n');
await page.setContent(`<!doctype html><style>${faces} body { margin: 0 } span { white-space: nowrap }</style><body></body>`);
await page.evaluate(async (families) => {
  for (const family of families) await document.fonts.load(`16px "${family}"`);
}, ['web-sans', 'web-serif', ...candidates.map((candidate) => `cand-${candidate.id}`)]);

const measure = (family, size, text) => page.evaluate(([family, size, text]) => {
  const span = document.createElement('span');
  span.style.cssText = `font-family: "${family}"; font-size: ${size}px; line-height: normal; font-kerning: normal; display: inline-block;`;
  span.textContent = text;
  document.body.appendChild(span);
  const rect = span.getBoundingClientRect();
  const context = document.createElement('canvas').getContext('2d');
  context.font = `1000px "${family}"`;
  const metrics = context.measureText('Hg');
  span.remove();
  return { width: rect.width, lineBox: rect.height, ascent: metrics.fontBoundingBoxAscent / 1000, descent: metrics.fontBoundingBoxDescent / 1000 };
}, [family, size, text]);
const addAdjusted = (id, sizeAdjust, ascent, descent) => page.evaluate(async ([id, sizeAdjust, ascent, descent]) => {
  const face = new FontFace(`adj-${id}`, `url(http://fonts.test/${id})`, { sizeAdjust: `${sizeAdjust}%`, ascentOverride: `${ascent}%`, descentOverride: `${descent}%`, lineGapOverride: '0%' });
  document.fonts.add(await face.load());
}, [id, sizeAdjust, ascent, descent]);

for (const role of ['sans', 'serif']) {
  const group = candidates.filter((candidate) => candidate.role === role);
  if (group.length === 0) continue;
  const web = { ui: await measure(`web-${role}`, 16, UI), text: await measure(`web-${role}`, 16, TEXT), ui24: await measure(`web-${role}`, 24, UI) };
  console.log(`\n== ${WEB[role].label}: Ascent ${web.ui.ascent.toFixed(4)} em, Descent ${web.ui.descent.toFixed(4)} em, Zeilenbox ${web.ui.lineBox.toFixed(2)} px bei 16 px; Breite Oberflächentexte ${web.ui.width.toFixed(1)} px, Fließtext ${web.text.width.toFixed(1)} px`);
  for (const candidate of group) {
    const raw = { ui: await measure(`cand-${candidate.id}`, 16, UI), text: await measure(`cand-${candidate.id}`, 16, TEXT), ui24: await measure(`cand-${candidate.id}`, 24, UI) };
    const ratioUI = web.ui.width / raw.ui.width;
    const ratioText = web.text.width / raw.text.width;
    const ratioUI24 = web.ui24.width / raw.ui24.width;
    // Oberfläche: Mittel aus Oberflächentexten und Fließtext; Dokument: der Fließtext bei Lesegröße.
    const chosen = role === 'sans' ? (ratioUI + ratioText) / 2 : ratioText;
    const sizeAdjust = Math.round(chosen * 1000) / 10;
    const ascent = Math.round((web.ui.ascent / (sizeAdjust / 100)) * 1000) / 10;
    const descent = Math.round((web.ui.descent / (sizeAdjust / 100)) * 1000) / 10;
    await addAdjusted(candidate.id, sizeAdjust, ascent, descent);
    const adjusted = { ui: await measure(`adj-${candidate.id}`, 16, UI), text: await measure(`adj-${candidate.id}`, 16, TEXT), ui24: await measure(`adj-${candidate.id}`, 24, UI) };
    console.log(`${candidate.label.padEnd(32)} roh: Ascent ${pct(raw.ui.ascent)} Descent ${pct(raw.ui.descent)} Zeilenbox ${raw.ui.lineBox.toFixed(2)} px · Breitenverhältnis Web/Kandidat Oberfläche ${ratioUI.toFixed(4)} Fließtext ${ratioText.toFixed(4)} Oberfläche@24 ${ratioUI24.toFixed(4)}`);
    console.log(`${''.padEnd(32)} → size-adjust ${sizeAdjust}% ascent-override ${ascent}% descent-override ${descent}% · Rest: Oberfläche ${pct(adjusted.ui.width / web.ui.width - 1)} Fließtext ${pct(adjusted.text.width / web.text.width - 1)} Oberfläche@24 ${pct(adjusted.ui24.width / web.ui24.width - 1)} · Zeilenbox ${adjusted.ui.lineBox.toFixed(2)} px (Web ${web.ui.lineBox.toFixed(2)}) · Ascent ${adjusted.ui.ascent.toFixed(4)} Descent ${adjusted.ui.descent.toFixed(4)}`);
  }
}
await browser.close();
