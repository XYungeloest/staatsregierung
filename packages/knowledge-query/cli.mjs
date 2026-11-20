import { createKnowledgeQuery } from './query.mjs';
import { parseQuery, tools } from './tools.mjs';

try {
  const [operation, json = '{}', ...extra] = process.argv.slice(2);
  if (operation === '--help') {
    console.log(JSON.stringify({ usage: 'knowledge:query <Abfrage> [JSON-Objekt]', operations: Object.keys(tools) }));
  } else {
    if (!operation || extra.length) throw new TypeError('Eine Abfrage und optional ein JSON-Objekt angeben.');
    let params;
    try { params = JSON.parse(json); } catch { throw new TypeError('Ungültige JSON-Eingabe.'); }
    parseQuery(operation, params);
    console.log(JSON.stringify(createKnowledgeQuery()(operation, params), null, 2));
  }
} catch (error) {
  process.exitCode = error instanceof TypeError ? 2 : error instanceof RangeError ? 3 : 1;
  console.error(JSON.stringify({ code: process.exitCode, error: error.message }));
}
