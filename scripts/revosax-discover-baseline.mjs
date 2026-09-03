#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parse } from 'parse5';

const SEARCH_URL = 'https://www.revosax.sachsen.de/vorschriftensuche';
const DEFAULT_DATE = '2023-11-01';
const ALL_TYPES = new Set(['G', 'ÄG', 'VO', 'ÄVO', 'VwV', 'ÄVwV', 'FRL', 'ÄFRL', 'StV', 'ÄStV', 'ZuG', 'ÄZuG']);

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function germanDate(isoDate) {
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) throw new Error(`Ungültiger --date-Wert ${isoDate}; erwartet YYYY-MM-DD`);
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function attrs(node) {
  return Object.fromEntries((node?.attrs ?? []).map(({ name, value }) => [name, value]));
}

function text(node) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(text).join(' ').replace(/\s+/gu, ' ').trim();
}

function walk(node, predicate, output = []) {
  if (node?.tagName && predicate(node)) output.push(node);
  for (const child of node?.childNodes ?? []) walk(child, predicate, output);
  return output;
}

function findForm(document) {
  const forms = walk(document, (node) => node.tagName === 'form');
  const form = forms.find((candidate) => /Geltungstag/iu.test(text(candidate))) ?? forms[0];
  if (!form) throw new Error('REVOSax-Suchformular nicht gefunden');
  return form;
}

function controlContext(control) {
  const own = attrs(control);
  const candidates = [own.id, own.name, own.value, own.placeholder].filter(Boolean).join(' ');
  const parentText = text(control.parentNode).slice(0, 500);
  return `${candidates} ${parentText}`;
}

function buildSearchRequest(html, date) {
  const document = parse(html);
  const form = findForm(document);
  const formAttrs = attrs(form);
  const controls = walk(form, (node) => ['input', 'select', 'textarea', 'button'].includes(node.tagName));
  const params = new URLSearchParams();
  const dateInputs = controls.filter((control) => {
    const properties = attrs(control);
    return control.tagName === 'input' &&
      (properties.type ?? 'text').toLowerCase() !== 'hidden' &&
      /(?:TT\.MM\.JJJJ|date|datum|gelt|gült|valid)/iu.test(controlContext(control));
  });
  let dateControl = dateInputs.find((control) => /(?:geltungstag|stichtag)/iu.test(controlContext(control)));
  if (!dateControl) {
    const placeholderDates = controls.filter((control) =>
      control.tagName === 'input' && /TT\.MM\.JJJJ/iu.test(attrs(control).placeholder ?? '')
    );
    dateControl = placeholderDates[2];
  }
  if (!dateControl?.attrs) throw new Error('Eingabefeld „Geltungstag“ im REVOSax-Formular nicht erkannt');

  for (const control of controls) {
    const properties = attrs(control);
    const name = properties.name;
    if (!name || properties.disabled !== undefined) continue;
    const type = (properties.type ?? '').toLowerCase();

    if (control === dateControl) {
      params.set(name, date);
      continue;
    }

    if (type === 'checkbox' || type === 'radio') {
      const value = properties.value ?? 'on';
      if (ALL_TYPES.has(value)) params.append(name, value);
      else if (properties.checked !== undefined) params.append(name, value);
      continue;
    }

    if (type === 'submit' || type === 'button' || type === 'reset' || type === 'file') continue;
    if (control.tagName === 'select') {
      const options = walk(control, (node) => node.tagName === 'option');
      for (const option of options.filter((entry) => attrs(entry).selected !== undefined)) {
        params.append(name, attrs(option).value ?? text(option));
      }
      continue;
    }
    if (properties.value) params.append(name, properties.value);
  }

  const action = new URL(formAttrs.action || SEARCH_URL, SEARCH_URL);
  const method = (formAttrs.method ?? 'get').toUpperCase();
  return { action, method, params };
}

async function sleep(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function request(url, options = {}, retries = 4) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': 'OstRecht REVOSax-Baseline-Importer/1.0',
          accept: 'text/html,application/xhtml+xml',
          'accept-encoding': 'identity',
          ...(options.headers ?? {}),
        },
        ...options,
      });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === retries) throw new Error(`HTTP ${response.status}`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

function resultCount(pageText) {
  const match = pageText.match(/([\d.]+)\s+Treffer/iu);
  return match ? Number.parseInt(match[1].replace(/\./gu, ''), 10) : null;
}

function nearestResultText(anchor) {
  let node = anchor;
  for (let depth = 0; depth < 4 && node; depth += 1, node = node.parentNode) {
    const candidate = text(node);
    if (candidate.length >= 20 && candidate.length <= 2000) return candidate;
  }
  return text(anchor);
}

function extractPage(html, pageUrl) {
  const document = parse(html);
  const anchors = walk(document, (node) => node.tagName === 'a');
  const hits = [];
  const pagination = [];

  for (const anchor of anchors) {
    const href = attrs(anchor).href;
    if (!href) continue;
    let url;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (url.hostname !== 'www.revosax.sachsen.de' && url.hostname !== 'revosax.sachsen.de') continue;

    const versionMatch = url.pathname.match(/^\/vorschrift\/(\d+)(?:\.(\d+))?(?:-[^/]*)?$/u);
    if (versionMatch) {
      const label = text(anchor);
      const context = nearestResultText(anchor);
      hits.push({
        url: url.toString(),
        lawId: versionMatch[1],
        versionSuffix: versionMatch[2] ?? null,
        label,
        context,
      });
      continue;
    }

    const anchorText = text(anchor);
    let ancestor = anchor.parentNode;
    let paginationContext = '';
    for (let depth = 0; depth < 3 && ancestor; depth += 1, ancestor = ancestor.parentNode) {
      paginationContext += ` ${attrs(ancestor).class ?? ''} ${attrs(ancestor).id ?? ''}`;
    }
    if (
      /(?:pagination|pager|seiten|page)/iu.test(paginationContext) ||
      /^(?:weiter|nächste|naechste|›|»|\d+)$/iu.test(anchorText)
    ) {
      pagination.push(url.toString());
    }
  }

  return {
    hits,
    pagination: [...new Set(pagination)],
    reportedCount: resultCount(text(document)),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isoDate = valueAfter(args, '--date') ?? DEFAULT_DATE;
  const date = germanDate(isoDate);
  const output = resolve(valueAfter(args, '--output') ?? `data/recht/revosax-baseline-${isoDate}.json`);
  const delayMs = Number.parseInt(valueAfter(args, '--delay-ms') ?? '200', 10);
  const maxPages = Number.parseInt(valueAfter(args, '--max-pages') ?? '1000', 10);

  const formResponse = await request(SEARCH_URL);
  const formHtml = await formResponse.text();
  const search = buildSearchRequest(formHtml, date);
  let firstResponse;
  if (search.method === 'GET') {
    const url = new URL(search.action);
    for (const [key, value] of search.params) url.searchParams.append(key, value);
    firstResponse = await request(url);
  } else {
    firstResponse = await request(search.action, {
      method: search.method,
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: search.params.toString(),
    });
  }

  const queue = [{ url: firstResponse.url, html: await firstResponse.text() }];
  const visited = new Set();
  const hits = new Map();
  let reportedCount = null;

  while (queue.length > 0) {
    if (visited.size >= maxPages) throw new Error(`Mehr als ${maxPages} Ergebnisseiten; Abbruch statt unkontrolliertem Crawl`);
    const current = queue.shift();
    if (visited.has(current.url)) continue;
    visited.add(current.url);
    const extracted = extractPage(current.html, current.url);
    reportedCount ??= extracted.reportedCount;
    for (const hit of extracted.hits) hits.set(hit.url, hit);

    for (const pageUrl of extracted.pagination) {
      if (visited.has(pageUrl) || queue.some((entry) => entry.url === pageUrl)) continue;
      await sleep(delayMs);
      const response = await request(pageUrl);
      queue.push({ url: response.url, html: await response.text() });
    }
  }

  const manifest = {
    schemaVersion: 1,
    source: 'REVOSax erweiterte Vorschriftensuche',
    sourceUrl: SEARCH_URL,
    query: {
      geltungstag: isoDate,
      includeTypes: [...ALL_TYPES],
    },
    discoveredAt: new Date().toISOString(),
    reportedCount,
    discoveredCount: hits.size,
    pagesVisited: visited.size,
    hits: [...hits.values()].sort((left, right) => left.url.localeCompare(right.url)),
  };

  if (reportedCount !== null && hits.size !== reportedCount) {
    throw new Error(
      `REVOSax meldet ${reportedCount} Treffer, der Crawler hat aber ${hits.size} eindeutige Vorschriftenlinks gefunden. ` +
      `Manifest wird nicht geschrieben; Pagination/Selektoren prüfen.`,
    );
  }
  if (hits.size === 0) throw new Error('REVOSax-Suche lieferte keine auswertbaren Vorschriftenlinks');

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`${hits.size} REVOSax-Treffer für ${isoDate} nach ${output} geschrieben.`);
}

await main();
