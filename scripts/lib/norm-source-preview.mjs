import { parse } from 'parse5';
import { buildStructuralVersionDiff } from '@ostrecht/shared/lib/norms/diff.ts';
import { classifyHtmlSource, parseConsolidatedHtml, parsePublicationHtml, summarizeParsedSource } from './norm-html-parser.mjs';
import { ACCEPTED_SEQUENCE_ISSUES, acceptedSequenceIssuesFor } from './norm-parser-contract.mjs';

const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (value) => String(value ?? '').replace(/[&<>"']/gu, (character) => escaped[character]);

// Die Originalspalte übernimmt nur Text und Absatzgrenzen, auch wenn die Quelle Skripte oder Bilder enthält.
function originalText(node) {
  if (node.nodeName === '#text') return node.value;
  if (['head', 'style', 'script', 'noscript', 'template', 'iframe', 'object', 'svg'].includes(node.tagName)) return '';
  const text = (node.childNodes ?? []).map(originalText).join('');
  return ['p', 'br', 'div', 'tr', 'td', 'th', 'li', 'h1', 'h2', 'h3', 'h4'].includes(node.tagName) ? text + '\n' : text;
}

export function inspectSource(name, html) {
  let reason = '';
  let parsed;
  const warnings = [];
  try {
    const result = classifyHtmlSource(name, html);
    reason = result.reason;
    if (result.kind === 'publication' && result.normative) {
      parsed = parsePublicationHtml(name, html, { acceptedSequenceIssues: acceptedSequenceIssuesFor(name) });
    } else if (result.kind === 'consolidated') parsed = parseConsolidatedHtml(name, html);
    const known = ACCEPTED_SEQUENCE_ISSUES[name];
    if (known) warnings.push(...known.issues, known.evidence);
  } catch (error) {
    warnings.push(error.message);
  }
  const norms = parsed ? [parsed, ...(parsed.introducedNorms ?? [])] : [];
  return { reason, warnings, parsed, norms, summaries: parsed ? summarizeParsedSource(parsed) : [],
    text: originalText(parse(html)).replace(/\n[\t ]*\n+/gu, '\n\n').trim() };
}

function blocksMarkup(blocks) {
  if (!blocks?.length) return '';
  return '<ul class="blocks">' + blocks.map((block) => {
    const heading = [block.label, block.title].filter(Boolean).join(' ');
    return '<li><small>' + e(block.type) + '</small> ' + (heading ? '<strong>' + e(heading) + '</strong>' : '')
      + (block.text ? '<p>' + e(block.text) + '</p>' : '') + blocksMarkup(block.children) + '</li>';
  }).join('') + '</ul>';
}

function comparisonMarkup(norm, matches) {
  if (matches.length !== 1) return '<p>Für diesen Parsertitel ist keine eindeutige gespeicherte Vergleichsfassung belegt.</p>';
  const [{ entry, version }] = matches;
  if (!version) return '<p>Die bezeichnete Fassung fehlt. ' + e(entry.normSlug + ' / ' + entry.versionId) + '</p>';
  const changes = buildStructuralVersionDiff(version, norm).filter((unit) => unit.kind !== 'unchanged');
  const origin = 'content/normen/' + entry.normSlug + '/versions/' + version.versionId + '.json';
  const labels = { added: 'Hinzugekommen', removed: 'Entfallen', changed: 'Geändert' };
  return '<details><summary>Vergleich mit der bezeichneten Fassung · ' + changes.length + ' abweichende Texteinheiten</summary>'
    + '<p><code>' + e(origin) + '</code> · ' + e(entry.citation) + '</p>'
    + changes.map((unit) => '<h4>' + labels[unit.kind] + ' · ' + e(unit.provisionLabel ?? unit.label) + '</h4>'
      + '<dl><dt>Gespeichert</dt><dd>' + e([unit.beforeTitle, unit.beforeText].filter(Boolean).join(' ')) + '</dd>'
      + '<dt>Parser</dt><dd>' + e([unit.afterTitle, unit.afterText].filter(Boolean).join(' ')) + '</dd></dl>').join('') + '</details>';
}

export function renderSourcePreview({ name, digest, review, pdf, saved = [], warnings = [], conflicts = [] }) {
  const issues = [...review.warnings, ...warnings, ...conflicts.map((row) =>
    [row.id, row.status, ...row.evidence.map((ref) => ref.file + ' #' + ref.locator + ' · ' + ref.citation),
      ...(row.problems ?? []), row.action].filter(Boolean).join(' · '))];
  const list = issues.length ? '<ul>' + issues.map((item) => '<li>' + e(item) + '</li>').join('') + '</ul>'
    : '<p>Keine Befunde aus Parser und zugeordnetem Konsolidierungsmanifest.</p>';
  const byTitle = Map.groupBy(review.norms, (norm) => norm.title);
  const norms = review.norms.map((norm, index) => {
    const summary = review.summaries[index];
    const matches = byTitle.get(norm.title).length === 1 ? saved.filter(({ entry }) => entry.title === norm.title) : [];
    return '<article><h3>' + e(norm.title) + '</h3><p>' + summary.structureCount + ' Gliederungseinheiten · '
      + summary.listCount + ' Listeneinträge · ' + summary.tableCount + ' Tabellen</p>' + comparisonMarkup(norm, matches)
      + blocksMarkup(norm.body) + '</article>';
  }).join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src file:; base-uri 'none'; form-action 'none'">
<title>Quellenprüfung · ${e(name)}</title><style>
*{box-sizing:border-box}body{font:1rem/1.5 system-ui,sans-serif;color:#172e3b;margin:1rem auto;max-width:110rem;padding:0 1rem}
h1,h2,h3{line-height:1.2}code,dd,pre,li{overflow-wrap:anywhere}pre{font:inherit;white-space:pre-wrap}
.grid{display:grid;gap:1.5rem;grid-template-columns:repeat(2,minmax(0,1fr))}section{min-width:0}iframe{width:100%;height:70vh;border:1px solid #687b86}
summary{cursor:pointer}details{margin:.75rem 0}small{color:#3c5a64}.blocks{padding-left:1.1rem}.blocks p{margin:.35rem 0}
@media(min-width:55.01rem){.grid{align-items:start}.grid>section:first-child{position:sticky;top:.5rem;max-height:calc(100vh - 1rem);overflow:auto}}
@media(max-width:55rem){.grid{grid-template-columns:1fr}iframe{height:55vh}}</style></head><body>
<main><h1>Lokale Quellenprüfung</h1><p>${e(name)} · SHA-256 <code>${e(digest)}</code></p><p>${e(review.reason)}</p>
<h2>Prüfbefunde</h2>${list}<div class="grid"><section><h2>Originalquelle</h2>
${pdf ? '<p><a href="' + e(pdf.url) + '">' + e(pdf.name) + '</a> · ' + e(pdf.label) + '</p><iframe title="Lokale Vergleichs-PDF" src="' + e(pdf.url) + '"></iframe>' : ''}
<details${pdf ? '' : ' open'}><summary>Text der HTML-Quelle</summary><pre>${e(review.text)}</pre></details></section>
<section><h2>Parserergebnis und Gliederung</h2>${norms || '<p>Für diese Quelle liegt kein strukturiertes Parserergebnis vor.</p>'}</section></div></main></body></html>\n`;
}
