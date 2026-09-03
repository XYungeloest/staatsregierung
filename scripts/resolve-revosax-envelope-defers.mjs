#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createEnvelopeLoader,
  describeBlockPath,
  headingSimilarity,
  openingText,
} from './classify-revosax-envelopes.mjs';

/**
 * Zweite Stufe für zurückgestellte Mantelbestandteile (Klasse D der Klassifizierung).
 *
 * Die Komponentenseite eines Bestandteils trägt keinen Artikeltext, nur Titel,
 * Vollzitat und den Verweis auf die Mantelvorschrift. Der Artikel wird deshalb in der
 * Mantelvorschrift bestimmt – nicht nur über Artikelüberschriften, sondern über den
 * Text jeder Gliederungseinheit in beliebiger Tiefe (Artikel, römische Abschnitte,
 * Paragraphen, Absätze von Folgeänderungsartikeln, Nummern): der aus dem
 * Komponententitel abgeleitete Name des Zielgesetzes („Änderung des Gesetzes über
 * Zuständigkeiten …“ → „Gesetz über Zuständigkeiten …“) wird als Wortstammmenge mit
 * Überschrift und Eröffnungssatz der Einheit verglichen (Recall der Zielstämme;
 * „Das Gesetz über … vom … (SächsGVBl. …) wird wie folgt geändert“, „In § 3 des
 * Sächsischen Disziplinargesetzes …“). Zusätzliche Belege: amtliches Klammerkürzel
 * aus dem Kurztitel der Trefferliste, der REVOSax-Anker (#a2 → Artikel 2, #roemIII →
 * III., #abs2 → Absatz 2, #p55 → § 55), ein im Titel genannter Artikel („Artikel 1
 * [Änderung …]“) und der Ausschluss bereits zugeordneter Geschwister derselben
 * Mantelvorschrift.
 *
 * Zwei dokumentierte Sonderfälle der Textlage:
 *   - TEXT_CARRIERS: die Mantelvorschrift 4371 führt ihren Artikel 1 (Zweites Sächsisches
 *     Rechtsbereinigungsgesetz) nur als Überschrift; der Text steht in der eigenen
 *     REVOSax-Vorschrift 3382. Die Bestandteile werden dort gesucht (textLawId).
 *   - ENVELOPE_VERSIONS: für Stammgesetze, deren aktuelle Fassung den Änderungs-
 *     paragraphen nicht mehr enthält oder auf eine Nachfolgevorschrift weiterleitet,
 *     wird die historische Fassung zum Erlassdatum des Bestandteils herangezogen
 *     (Finanzausgleichsgesetz 1996 = 5479.1, Hochschulgesetz 1999 = 2956.1, Wahlgesetz
 *     1993 = 2876.1, Kommunalbekanntmachungsverordnung 1997 = 2932.1).
 *
 * Eine Zuordnung gilt nur bei genau einem besten Kandidaten mit hoher Übereinstimmung
 * und deutlichem Abstand zum zweitbesten; alles andere bleibt zurückgestellt und wird
 * im Bericht mit den besten Kandidaten ausgewiesen, damit eine redaktionelle
 * Entscheidung (method „manual-reviewed“) nachvollziehbar getroffen werden kann. Der
 * Klassifizierer verifiziert jede Entscheidung erneut gegen den Artikeltext.
 *
 * Aufruf:
 *   node scripts/resolve-revosax-envelope-defers.mjs [--report <Bericht>] [--write] [--offline]
 * Ohne --write wird nur der Bericht (.cache/revosax-baseline/2023-11-01/envelope-defers.json)
 * geschrieben; mit --write werden automatische Zuordnungen in
 * data/recht/revosax-envelope-decisions.json ergänzt (manuell geprüfte Einträge bleiben
 * unverändert).
 */

const ROOT = process.cwd();
const CACHE_ROOT = join(ROOT, '.cache', 'revosax-baseline', '2023-11-01');
const DECISIONS_PATH = resolve(ROOT, 'data', 'recht', 'revosax-envelope-decisions.json');
const MIN_SCORE = 0.6;
const MIN_MARGIN = 0.2;

export const TEXT_CARRIERS = {
  4371: { textLawId: '3382', reason: 'Artikel 1 der Mantelvorschrift 4371 (Zweites Sächsisches Rechtsbereinigungsgesetz) steht in REVOSax nur als Überschrift; der Artikeltext wird in der eigenständigen Vorschrift 3382 geführt.' },
};
export const ENVELOPE_VERSIONS = {
  5479: { version: '1', reason: 'Finanzausgleichsgesetz 1996 in der Fassung vom 1. Januar 1996 (5479.1); spätere Fassungen enthalten den Änderungsparagraphen nicht mehr.' },
  2956: { version: '1', reason: 'Sächsisches Hochschulgesetz vom 11. Juni 1999 in der Erstfassung (2956.1); die Vorschrift leitet heute auf die Nachfolgevorschrift 19986 weiter.' },
  2876: { version: '1', reason: 'Sächsisches Wahlgesetz vom 5. August 1993 in der Erstfassung (2876.1); die Vorschrift leitet heute auf die Nachfolgevorschrift 20176 weiter.' },
  2932: { version: '1', reason: 'Kommunalbekanntmachungsverordnung vom 19. Dezember 1997 in der Erstfassung (2932.1); die aktuelle Fassung (16777) enthält den Änderungsbefehl nicht mehr.' },
};

const STOPWORDS = new Set(['des', 'der', 'die', 'das', 'den', 'dem', 'für', 'zur', 'zum', 'und', 'über', 'von', 'im', 'in', 'am', 'an', 'auf', 'mit', 'bei', 'nach', 'aus', 'zu', 'ein', 'eine', 'einer', 'eines', 'einem', 'sowie', 'dieses', 'dieser', 'freistaat', 'sachsen', 'sächsisch', 'smk', 'smi', 'smj', 'smf', 'sms', 'smwa', 'smul']);
const SYNONYMS = new Map([['vwv', 'verwaltungsvorschrift'], ['vo', 'verordnung'], ['rl', 'richtlinie'], ['frl', 'förderrichtlinie'], ['stv', 'staatsvertrag']]);

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();

/** Wortstämme: Klammern entfernt, Umbruchtrennungen zusammengefügt, „X- und Y“ getrennt, Flexion gekappt. */
export function stems(value) {
  const text = normalize(value)
    .toLocaleLowerCase('de')
    .replace(/[–—]/gu, '-')
    .replace(/\[[^\]]*\]/gu, ' ')
    .replace(/(\p{L})-\s+(?:und|oder)\s+/gu, '$1 und ')
    .replace(/(\p{L})-\s*(\p{L})/gu, '$1$2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  const result = new Set();
  for (const raw of text.split(' ')) {
    const word = SYNONYMS.get(raw) ?? raw;
    if (!word || STOPWORDS.has(word)) continue;
    const stem = word.length >= 6 ? word.replace(/(?:es|en|er|em|s|e|n)$/u, '') : word;
    if (stem.length >= 2 && !STOPWORDS.has(stem)) result.add(stem);
  }
  return result;
}

/** Anteil der Zielstämme, die im Text vorkommen (0–1). */
export function recall(target, text) {
  const wanted = stems(target);
  if (wanted.size === 0) return 0;
  const present = stems(text);
  let shared = 0;
  for (const stem of wanted) if (present.has(stem)) shared += 1;
  return shared / wanted.size;
}

/** Zielgesetz aus dem Komponententitel („Änderung des/der …“, „Aufhebung der …“, Tippfehler „Ändeurng“). */
export function targetNameFromTitle(title) {
  const text = normalize(title).replace(/\[[^\]]*\]/gu, ' ').replace(/\s+/gu, ' ').trim();
  const match = text.match(/^(?:Änderung|Ändeurng|Änder|Aufhebung|Neufassung|Ergänzung|Berichtigung|Änderungen)\s+(?:des|der|von|vom|zum|zur|dem|den)?\s*(.+)$/iu);
  // Zusammengeschriebene Kürzel in REVOSax-Titeln („RLWohnraumanpassung“ → „RL Wohnraumanpassung“).
  return normalize(match ? match[1] : text).replace(/^(RL|VwV|FRL)(?=[A-ZÄÖÜ]\p{Ll})/u, '$1 ');
}

/** Artikelkennzeichen aus dem Komponententitel („Artikel 1 [Änderung …]“). */
export function articleFromTitle(title) {
  const match = normalize(title).match(/^(?:Artikel|Art\.)\s*(\d+[a-z]?)\b/u);
  return match ? `Artikel ${match[1]}` : null;
}

/** Kennzeichen, auf das ein REVOSax-Anker zeigt (#a2 → Artikel 2, #roemIII → III., #abs2 → (2), #p55 → § 55). */
export function anchorLabel(anchor) {
  const value = String(anchor ?? '');
  let match = value.match(/^a(\d+[a-z]?)$/u);
  if (match) return `Artikel ${match[1]}`;
  match = value.match(/^ro[e]?m([IVXLC]+)$/u);
  if (match) return `${match[1]}.`;
  // Absatzanker (#abs2) sind ohne Artikelbezug mehrdeutig und liefern keinen Beleg.
  match = value.match(/^p(\d+[a-z]?)$/u);
  if (match) return `§ ${match[1]}`;
  return null;
}

const CHANGE_PATTERN = /\bwird\b|\bwerden\b|\btritt\b|\btreten\b|aufgehoben|gestrichen|angefügt|eingefügt|ersetzt|gefasst|geändert/u;

function labelAbbreviation(label) {
  const match = normalize(label).match(/^(?:Änd\.|Änderung|Aufh\.|Aufhebung)?\s*([A-ZÄÖÜ][\wÄÖÜäöüß-]{2,})$/u);
  return match ? match[1] : null;
}

function abbreviations(text) {
  return new Set([...normalize(text).matchAll(/\(([A-ZÄÖÜ][\wÄÖÜäöüß-]{2,})\)/gu)].map((match) => match[1]));
}

/** Alle Gliederungseinheiten (beliebige Tiefe) mit Kennzeichen oder Überschrift, ohne reine Textabsätze. */
export function listCandidateBlocks(body) {
  const candidates = [];
  const walk = (blocks, path, parentIntro) => blocks.forEach((block, index) => {
    const current = [...path, index];
    const label = normalize(block.label);
    const title = normalize(block.title);
    const opening = normalize(`${block.text ?? ''} ${openingText(block, 400)}`).slice(0, 400);
    if (!['paragraphText', 'table', 'tableRow', 'tableCell', 'attachment'].includes(block.type) && (label || title)) {
      // Nummern nur als Änderungs-/Aufhebungsbefehle: der Befehl steht im eigenen Text oder im
      // Einleitungssatz des Elternblocks („Die folgenden Rechtsvorschriften werden aufgehoben:“).
      if (block.type !== 'item' || CHANGE_PATTERN.test(opening) || CHANGE_PATTERN.test(parentIntro)) {
        candidates.push({ block, path: current, label, title, opening, described: describeBlockPath(body, current) ?? label });
      }
    }
    const intro = normalize(`${title} ${block.text ?? ''} ${(block.children ?? []).find((child) => child.type === 'paragraphText')?.text ?? ''}`);
    walk(block.children ?? [], current, intro);
  });
  walk(body, [], '');
  return candidates;
}

export function scoreCandidates(component, envelope, { excludedPaths = new Set() } = {}) {
  const title = normalize(component.sourceTitle ?? component.listing?.title ?? '');
  const target = targetNameFromTitle(title);
  const componentAbbr = labelAbbreviation(component.listing?.label);
  const wantedArticle = articleFromTitle(title);
  const anchorHint = anchorLabel(component.anchor);
  const all = listCandidateBlocks(envelope.body);
  const anchoredPath = anchorHint ? all.find((candidate) => candidate.label === anchorHint)?.path ?? null : null;
  const underAnchor = (path) => anchoredPath !== null && JSON.stringify(path.slice(0, anchoredPath.length)) === JSON.stringify(anchoredPath);
  const candidates = all
    .filter((candidate) => !excludedPaths.has(JSON.stringify(candidate.path)))
    .map((candidate) => {
      const text = `${candidate.title} ${candidate.opening}`;
      const recallScore = recall(target, text);
      const headingScore = headingSimilarity(title.replace(/\[[^\]]*\]/gu, ' '), candidate.title);
      const abbrHit = componentAbbr ? abbreviations(candidate.opening).has(componentAbbr) : false;
      const titleArticle = wantedArticle && candidate.label === wantedArticle;
      const anchorHit = underAnchor(candidate.path);
      let score = Math.max(recallScore, headingScore);
      if (abbrHit) score += 0.25;
      if (anchorHit) score += 0.2;
      if (titleArticle) score += 0.5;
      return { label: candidate.label, described: candidate.described || candidate.title, heading: candidate.title, path: candidate.path, opening: candidate.opening.slice(0, 220), recall: Number(recallScore.toFixed(2)), headingScore: Number(headingScore.toFixed(2)), abbrHit, anchorHit, titleArticle, score: Number(Math.min(score, 1.5).toFixed(2)) };
    });
  // Tiefere Einheiten vor ihren Vorfahren, wenn der Vorfahr nur ein Sammelartikel ist
  // („Folgeänderungen“, „Aufhebung bestehender Rechtsvorschriften“: Überschrift passt nicht
  // zum Komponententitel): der Absatz bzw. die Nummer ist dann die präzisere Fundstelle.
  candidates.sort((left, right) => right.score - left.score || right.path.length - left.path.length);
  const deduped = candidates.filter((candidate, index) => !(candidate.headingScore < 0.5 && candidates.slice(0, index).some((other) => other.score === candidate.score && candidate.path.length < other.path.length && JSON.stringify(other.path.slice(0, candidate.path.length)) === JSON.stringify(candidate.path))));
  return { target, componentAbbr, wantedArticle, anchorHint, candidates: deduped };
}

export function decide({ target, componentAbbr, candidates }) {
  const [best, second] = candidates;
  if (!best) return { action: 'DEFER', reason: 'Mantelvorschrift ohne erkennbare Gliederungseinheiten' };
  const margin = Number((best.score - (second?.score ?? 0)).toFixed(2));
  // Hohe Übereinstimmung allein genügt nicht: ohne deutlichen Abstand zum zweitbesten
  // Kandidaten (etwa bei generischen Zielnamen wie „Gesetz“) bleibt der Fall zurückgestellt.
  const strong = best.score >= MIN_SCORE && margin >= MIN_MARGIN;
  if (strong && (best.recall > 0 || best.headingScore > 0 || best.titleArticle)) {
    const proofs = [];
    if (best.recall >= 0.5) proofs.push(`Text nennt das Zielgesetz „${target}“ (Recall ${best.recall.toFixed(2)})`);
    if (best.headingScore >= 0.5) proofs.push(`Überschrift entspricht dem Komponententitel (${best.headingScore.toFixed(2)})`);
    if (best.abbrHit) proofs.push(`Kürzel ${componentAbbr} im Eröffnungssatz`);
    if (best.anchorHit) proofs.push('REVOSax-Anker zeigt auf diese Einheit');
    if (best.titleArticle) proofs.push('Komponententitel nennt den Artikel');
    return {
      action: 'MAP',
      method: best.anchorHit && best.recall < 0.5 && best.headingScore < 0.5 ? 'anchor-opening-sentence' : 'opening-sentence',
      article: best.described,
      blockPath: best.path,
      reason: `${best.described}: ${proofs.join('; ')}; Abstand zum nächsten Kandidaten ${margin.toFixed(2)}`,
      evidence: { ...(best.opening ? { openingText: best.opening.slice(0, 160) } : {}), ...(best.heading ? { heading: best.heading } : {}), score: best.score, margin, target },
    };
  }
  return {
    action: 'DEFER',
    reason: best.score >= MIN_SCORE
      ? `mehrere Einheiten passen zum Zielgesetz „${target}“ (${best.described}: ${best.score.toFixed(2)}, ${second?.described}: ${second?.score.toFixed(2)})`
      : `keine Einheit passt eindeutig zum Zielgesetz „${target}“ (beste ${best.described}: ${best.score.toFixed(2)})`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const report = await readJson(resolve(valueAfter(args, '--report') ?? join(CACHE_ROOT, 'report.json')));
  const classification = await readJson(resolve(ROOT, 'data', 'recht', 'revosax-import-audit', 'envelopes.json'));
  const existing = await readJson(DECISIONS_PATH).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return {
      schemaVersion: 1,
      description: 'Geprüfte Zuordnungen zurückgestellter Mantelbestandteile (Klasse D der Klassifizierung) zu Gliederungseinheiten ihrer Mantelvorschrift: automatisch über Zielgesetz im Eröffnungssatz/Überschrift/Anker (scripts/resolve-revosax-envelope-defers.mjs) oder redaktionell (manual-reviewed). textLawId nennt die Vorschrift, die den Artikeltext tatsächlich führt; envelopeVersion die historische Fassung. Der Klassifizierer verifiziert jede Zuordnung gegen den Text.',
      decisions: {},
    };
  });
  const loader = createEnvelopeLoader(report, { offline: args.includes('--offline') });
  const deferred = classification.components.filter((component) => component.class === 'D');
  // Bereits zugeordnete Einheiten derselben Mantelvorschrift (Klasse A) sind ausgeschlossen.
  const takenPaths = new Map();
  for (const component of classification.components) {
    if (component.class !== 'A' || !component.articleBlockPath) continue;
    const key = component.envelopeSourceId ?? component.envelopeLawId;
    const set = takenPaths.get(key) ?? new Set();
    set.add(JSON.stringify(component.articleBlockPath));
    takenPaths.set(key, set);
  }
  const results = [];
  for (const component of deferred) {
    const result = { sourceId: component.sourceId, lawId: component.lawId, envelopeLawId: component.envelopeLawId, sourceTitle: component.sourceTitle, listingLabel: component.listing?.label ?? null, anchor: component.anchor, heuristicReason: component.reason };
    const manual = existing.decisions[component.sourceId];
    if (manual?.method === 'manual-reviewed') {
      result.decision = { ...manual, note: 'manuell geprüft (unverändert)' };
      results.push(result);
      continue;
    }
    try {
      const carrier = TEXT_CARRIERS[component.envelopeLawId];
      const versioned = ENVELOPE_VERSIONS[component.envelopeLawId];
      const lawId = carrier ? carrier.textLawId : String(component.envelopeLawId);
      const envelope = await loader.load(lawId, versioned?.version ?? null);
      if (envelope.parseError) throw new Error(`Mantelvorschrift nicht parsebar: ${envelope.parseError}`);
      const scored = scoreCandidates(component, envelope, { excludedPaths: takenPaths.get(envelope.sourceId) ?? new Set() });
      result.target = scored.target;
      result.anchorHint = scored.anchorHint;
      result.candidates = scored.candidates.slice(0, 4);
      result.decision = decide(scored);
      if (result.decision.action === 'MAP') {
        if (carrier) Object.assign(result.decision, { textLawId: carrier.textLawId, textCarrierReason: carrier.reason });
        if (versioned) Object.assign(result.decision, { envelopeVersion: versioned.version, envelopeVersionReason: versioned.reason });
      }
      result.envelopeTitle = envelope.title;
      result.envelopeSourceId = envelope.sourceId;
    } catch (error) {
      result.decision = { action: 'DEFER', reason: error.message };
    }
    results.push(result);
  }
  const counts = { MAP: 0, DEFER: 0 };
  for (const result of results) counts[result.decision.action] += 1;
  const output = join(CACHE_ROOT, 'envelope-defers.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), counts, results }, null, 2)}\n`, 'utf8');
  console.log(`Zurückgestellte Bestandteile: ${results.length}; zuordenbar: ${counts.MAP}; weiterhin offen: ${counts.DEFER}`);
  console.log(`Bericht: ${output.replace(`${ROOT}/`, '')}`);
  if (args.includes('--write')) {
    let added = 0;
    for (const result of results) {
      if (result.decision.action !== 'MAP' || result.decision.note) continue;
      const current = existing.decisions[result.sourceId];
      if (current && current.method === 'manual-reviewed') continue;
      const { note, ...decision } = result.decision;
      existing.decisions[result.sourceId] = { action: 'MAP', envelopeLawId: String(result.envelopeLawId), ...decision, sourceTitle: result.sourceTitle, decidedAt: '2026-09-03' };
      added += 1;
    }
    existing.decisions = Object.fromEntries(Object.entries(existing.decisions).sort(([left], [right]) => Number.parseFloat(left) - Number.parseFloat(right)));
    await writeFile(DECISIONS_PATH, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
    console.log(`${added} Zuordnungen in ${DECISIONS_PATH.replace(`${ROOT}/`, '')} geschrieben (${Object.keys(existing.decisions).length} Einträge gesamt)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
