export {};

import { formatCount } from '../lib/kreisreform/format.ts';

interface LayerInfo {
  url: string;
  available: boolean;
}

interface KreisreformManifest {
  layers: Record<string, LayerInfo>;
}

interface NeuerKreisProperties {
  id: string;
  name: string;
  typ: string;
  bezirkNeu: string;
  einwohner?: number;
  flaecheKm2?: number;
  gemeinden?: number;
}

interface NeuerBezirkProperties {
  id: string;
  name: string;
  sitz: string;
  einwohner?: number;
  flaecheKm2?: number;
  kreise?: string[];
}

interface GemeindeSearchEntry {
  id: string;
  name: string;
  typ: string;
  kreisNeu: string;
  bezirkNeu?: string;
  alterKreis?: string;
  bundeslandAlt?: string;
  einwohner?: number;
  flaecheKm2?: number;
}

interface FeatureCollection<T> {
  features: Array<{ properties: T }>;
}

type SearchEntry =
  | { kind: 'gemeinde'; label: string; context: string; properties: GemeindeSearchEntry }
  | { kind: 'kreis'; label: string; context: string; properties: NeuerKreisProperties }
  | { kind: 'bezirk'; label: string; context: string; properties: NeuerBezirkProperties };

const integerFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const areaFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/ß/gu, 'ss');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#039;');
}

function formatInteger(value: number | undefined): string {
  return typeof value === 'number' ? integerFormatter.format(value) : 'Keine Angabe';
}

function formatArea(value: number | undefined): string {
  return typeof value === 'number' ? `${areaFormatter.format(value)} km²` : 'Keine Angabe';
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function dataUrl(baseUrl: string, value: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${value.replace(/^\//u, '')}`;
}

function createSearchDetail(entry: SearchEntry): string {
  if (entry.kind === 'gemeinde') {
    const value = entry.properties;
    return `
      <p class="eyebrow">Gemeinde</p>
      <h3>${escapeHtml(value.name)}</h3>
      <dl class="meta-list">
        <div><dt>Neuer Kreis</dt><dd>${escapeHtml(value.kreisNeu)}</dd></div>
        <div><dt>Neuer Bezirk</dt><dd>${escapeHtml(value.bezirkNeu ?? 'Keine Angabe')}</dd></div>
        <div><dt>Bisheriger Kreis</dt><dd>${escapeHtml(value.alterKreis ?? 'Keine Angabe')}</dd></div>
        <div><dt>Einwohner</dt><dd>${formatInteger(value.einwohner)}</dd></div>
        <div><dt>Fläche</dt><dd>${formatArea(value.flaecheKm2)}</dd></div>
        <div><dt>Rechtsgrundlage</dt><dd>Entwurf des Kreis- und Bezirksneuordnungsgesetzes, Anlagen 1 und 2</dd></div>
      </dl>
      <p class="detail-line">Die Karte kann zur räumlichen Einordnung zusätzlich geöffnet werden.</p>
    `;
  }

  if (entry.kind === 'kreis') {
    const value = entry.properties;
    return `
      <p class="eyebrow">Neuer Kreis</p>
      <h3>${escapeHtml(value.name)}</h3>
      <dl class="meta-list">
        <div><dt>Rechtsstellung</dt><dd>${escapeHtml(value.typ)}</dd></div>
        <div><dt>Neuer Bezirk</dt><dd>${escapeHtml(value.bezirkNeu)}</dd></div>
        <div><dt>Einwohner</dt><dd>${formatInteger(value.einwohner)}</dd></div>
        <div><dt>Fläche</dt><dd>${formatArea(value.flaecheKm2)}</dd></div>
        <div><dt>Gemeinden</dt><dd>${formatCount(value.gemeinden, 'Gemeinde', 'Gemeinden')}</dd></div>
        <div><dt>Rechtsgrundlage</dt><dd>Entwurf des Kreis- und Bezirksneuordnungsgesetzes, Anlagen 1 und 2</dd></div>
      </dl>
      <p class="detail-line">Die Karte kann zur räumlichen Einordnung zusätzlich geöffnet werden.</p>
    `;
  }

  const value = entry.properties;
  return `
    <p class="eyebrow">Neuer Bezirk</p>
    <h3>${escapeHtml(value.name)}</h3>
    <dl class="meta-list">
      <div><dt>Sitz</dt><dd>${escapeHtml(value.sitz)}</dd></div>
      <div><dt>Einwohner</dt><dd>${formatInteger(value.einwohner)}</dd></div>
      <div><dt>Fläche</dt><dd>${formatArea(value.flaecheKm2)}</dd></div>
      <div><dt>Zugeordnete Kreise</dt><dd>${escapeHtml((value.kreise ?? []).join(', ') || 'Keine Angabe')}</dd></div>
      <div><dt>Rechtsgrundlage</dt><dd>Entwurf des Kreis- und Bezirksneuordnungsgesetzes, Anlage 1</dd></div>
    </dl>
    <p class="detail-line">Die Karte kann zur räumlichen Einordnung zusätzlich geöffnet werden.</p>
  `;
}

function initSearch(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('[data-kreisreform-search-input]');
  const status = root.querySelector<HTMLElement>('[data-kreisreform-search-status]');
  const results = root.querySelector<HTMLElement>('[data-kreisreform-search-results]');
  const detail = root.querySelector<HTMLElement>('[data-kreisreform-search-detail]');
  const baseUrl = root.dataset.baseUrl ?? '/';
  let indexPromise: Promise<SearchEntry[]> | undefined;
  let activeEntries: SearchEntry[] = [];

  if (!input || !status || !results || !detail) {
    return;
  }

  const loadIndex = () => {
    if (indexPromise) return indexPromise;

    indexPromise = (async () => {
      const manifest = await fetchJson<KreisreformManifest>(dataUrl(baseUrl, '/data/kreisreform/manifest.json'));
      const kreiseUrl = manifest.layers.neueKreise?.url;
      const bezirkeUrl = manifest.layers.neueBezirke?.url;
      const gemeindenUrl = manifest.layers.gemeindenSuche?.url;

      if (!kreiseUrl || !bezirkeUrl || !gemeindenUrl) {
        throw new Error('Die Suchdaten sind nicht vollständig verfügbar.');
      }

      const [kreise, bezirke, gemeinden] = await Promise.all([
        fetchJson<FeatureCollection<NeuerKreisProperties>>(dataUrl(baseUrl, kreiseUrl)),
        fetchJson<FeatureCollection<NeuerBezirkProperties>>(dataUrl(baseUrl, bezirkeUrl)),
        fetchJson<GemeindeSearchEntry[]>(dataUrl(baseUrl, gemeindenUrl)),
      ]);

      return [
        ...gemeinden.map((properties) => ({
          kind: 'gemeinde' as const,
          label: properties.name,
          context: `${properties.typ}, neuer Kreis ${properties.kreisNeu}`,
          properties,
        })),
        ...kreise.features.map(({ properties }) => ({
          kind: 'kreis' as const,
          label: properties.name,
          context: `${properties.typ}, Bezirk ${properties.bezirkNeu}`,
          properties,
        })),
        ...bezirke.features.map(({ properties }) => ({
          kind: 'bezirk' as const,
          label: properties.name,
          context: `Neuer Bezirk, Sitz ${properties.sitz}`,
          properties,
        })),
      ];
    })();

    return indexPromise;
  };

  const clearResults = () => {
    activeEntries = [];
    results.hidden = true;
    results.innerHTML = '';
  };

  const update = async () => {
    const query = input.value.trim();

    if (query.length < 2) {
      clearResults();
      detail.hidden = true;
      status.textContent = 'Geben Sie mindestens zwei Buchstaben ein, um ein Gebiet zu suchen.';
      return;
    }

    status.textContent = 'Gebietssuche wird geladen.';
    try {
      const entries = await loadIndex();
      const normalizedQuery = normalize(query);
      activeEntries = entries
        .filter((entry) => normalize(`${entry.label} ${entry.context}`).includes(normalizedQuery))
        .sort((left, right) => {
          const leftStarts = normalize(left.label).startsWith(normalizedQuery);
          const rightStarts = normalize(right.label).startsWith(normalizedQuery);
          if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
          return left.label.localeCompare(right.label, 'de');
        })
        .slice(0, 12);

      if (activeEntries.length === 0) {
        results.innerHTML = '<li>Keine Gebiete gefunden. Prüfen Sie die Schreibweise oder suchen Sie nach Kreis oder Bezirk.</li>';
        results.hidden = false;
        detail.hidden = true;
        status.textContent = 'Keine Gebiete gefunden.';
        return;
      }

      results.innerHTML = activeEntries
        .map(
          (entry, index) => `
            <li>
              <button type="button" data-kreisreform-search-result="${index}">
                <span>${escapeHtml(entry.label)}</span>
                <small>${escapeHtml(entry.context)}</small>
              </button>
            </li>`,
        )
        .join('');
      results.hidden = false;
      detail.hidden = true;
      status.textContent = `${activeEntries.length} ${activeEntries.length === 1 ? 'Treffer' : 'Treffer'} gefunden.`;

      for (const button of Array.from(results.querySelectorAll<HTMLButtonElement>('[data-kreisreform-search-result]'))) {
        button.addEventListener('click', () => {
          const entry = activeEntries[Number(button.dataset.kreisreformSearchResult ?? -1)];
          if (!entry) return;
          detail.innerHTML = createSearchDetail(entry);
          detail.hidden = false;
          clearResults();
          status.textContent = `${entry.label} ist ausgewählt.`;
        });
      }
    } catch {
      clearResults();
      detail.hidden = true;
      status.textContent = 'Die Gebietssuche konnte nicht geladen werden. Nutzen Sie die Bezirksübersicht oder die Tabellen.';
    }
  };

  input.addEventListener('focus', () => {
    void loadIndex().catch(() => undefined);
  });
  input.addEventListener('input', () => {
    void update();
  });
}

for (const root of document.querySelectorAll<HTMLElement>('[data-kreisreform-search]')) {
  initSearch(root);
}
