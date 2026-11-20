import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,219}$/u);
const paging = { offset: z.number().int().min(0).max(1_000_000).default(0), limit: z.number().int().min(1).max(25).default(10) };
const tool = (description, fields = {}) => ({ description, inputSchema: z.strictObject({ ...fields, ...paging }) });

export const tools = {
  search_knowledge: tool('Wissenseinträge nach ID, Bezeichnung, Synonym und Schlagwort suchen.', { query: z.string().trim().min(1).max(160) }),
  get_entity: tool('Sachstand, Belegstatus, Geltungszeitraum und Beziehungen einer Wissens-ID.', { id }),
  get_roles: tool('Belegte historische und aktuelle Rollen einer Person mit Amtsquellen.', { id }),
  get_project_context: tool('Projektstand, Rechtsgrundlagen, Meilensteine und verknüpfte Verfahren.', { id }),
  get_proceeding: tool('Belegter Verfahrensstand mit Quellen und offenen Fragen.', { id }),
  list_open_proceedings: tool('Verfahren mit offener Verfahrensstufe oder ausdrücklich ungeklärtem Ausgang.', { type: id.optional() }),
  list_open_mandates: tool('Vollzugsbefunde mit Fristen, Bedingungen und fehlenden Nachweisen.', { norm: id.optional() }),
  trace_sources: tool('Primärquellen, Fundstellen und ältere Belegangaben zu einer Aussage.', { id }),
  list_source_conflicts: tool('Strittige Aussagen und offene Quellenfragen.'),
  get_legal_state: tool('Gespeicherte Fassungen und Rechtsstand einer Norm am redaktionellen Stichtag.', { norm: id, version: id.optional() }),
  analyze_publication_impact: tool('Quellenbasierte Änderungsfolgen einer Verkündung mit Fundstelle je Ergebnis.', { publication: id }),
};

export function parseQuery(name, params) {
  if (!Object.hasOwn(tools, name)) throw new TypeError('Unbekannte Abfrage: ' + name);
  const result = tools[name].inputSchema.safeParse(params);
  if (!result.success) throw new TypeError(result.error.issues.map((e) => e.path.join('.') + ': ' + e.message).join(', '));
  return result.data;
}
