import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
const [,, parserPath, outDir, ...files] = process.argv;
const { parsePublicationHtml } = await import(parserPath);
await mkdir(outDir, { recursive: true });
for (const file of files) {
  const html = await readFile(file, 'utf8');
  try {
    const parsed = parsePublicationHtml(basename(file), html);
    const out = { issue: parsed.issue, title: parsed.title, type: parsed.type, effectiveDate: parsed.effectiveDate, startPage: parsed.startPage, signature: parsed.signature, body: parsed.body,
      introduced: (parsed.introducedNorms||[]).map(n => ({ kind: n.kind, title: n.title, shortTitle: n.shortTitle, abbr: n.abbr, type: n.type, effectiveDate: n.effectiveDate, body: n.body })) };
    await writeFile(join(outDir, basename(file).replace(/\.html$/, '.json')), JSON.stringify(out, null, 1));
    console.log(basename(file), 'ok', parsed.type, parsed.effectiveDate, 'introduced:', out.introduced.map(n => n.title + ' [' + (n.abbr ?? '') + ']').join(' | '));
  } catch (error) {
    console.log(basename(file), 'FEHLER', error.message);
  }
}
