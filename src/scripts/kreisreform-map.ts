import type * as Leaflet from 'leaflet';
import type { Feature, FeatureCollection, GeoJsonObject, Geometry } from 'geojson';

type LayerKey = 'neueKreise' | 'neueBezirke' | 'alteKreise' | 'alteBezirke' | 'alteBundeslaender';

interface LayerInfo {
  url: string;
  available: boolean;
  reason?: string;
}

interface KreisreformManifest {
  layers: Record<string, LayerInfo>;
  notice: string;
}

interface AlterKreis {
  id: string;
  name: string;
  bundeslandAlt: string;
  bezirkAlt: string;
}

interface KreisreformProperties {
  id?: string;
  name?: string;
  nameRaw?: string;
  typ?: string;
  bezirkNeu?: string;
  sitz?: string;
  einwohner?: number;
  flaecheKm2?: number;
  gemeinden?: number;
  kreise?: string[];
  alteKreise?: AlterKreis[];
  neueKreise?: string[];
  bundeslandAlt?: string;
  bezirkAlt?: string;
  quelle?: string;
}

interface LayerDefinition {
  key: LayerKey;
  manifestKey: keyof KreisreformManifest['layers'];
  defaultVisible: boolean;
}

const layerDefinitions: LayerDefinition[] = [
  { key: 'neueKreise', manifestKey: 'neueKreise', defaultVisible: true },
  { key: 'neueBezirke', manifestKey: 'neueBezirke', defaultVisible: true },
  { key: 'alteKreise', manifestKey: 'alteKreise', defaultVisible: false },
  { key: 'alteBezirke', manifestKey: 'alteBezirke', defaultVisible: false },
  { key: 'alteBundeslaender', manifestKey: 'alteBundeslaender', defaultVisible: false },
];

const districtColors: Record<string, string> = {
  Berlin: '#8f2e2f',
  Elbsachsen: '#2f7b3d',
  Lausitz: '#9b6b22',
  'Leipzig-Mittelsachsen': '#5b6f2a',
  'Magdeburg-Anhalt': '#376a8a',
  'Mecklenburg-Schwerin': '#39796d',
  'Mittelmark-Fläming': '#705f8f',
  Nordmark: '#516c9b',
  'Oderland-Uckermark': '#2d6f55',
  'Saale-Harz': '#7c6130',
  'Saale-Pleiße': '#7a4e75',
  'Thüringer Wald-Eichsfeld': '#426b3a',
  'Vogtland-Erzgebirge': '#6e5d2f',
  Vorpommern: '#3a768d',
};

const integerFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const areaFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

function bootMaps(): void {
  for (const trigger of document.querySelectorAll<HTMLElement>('[data-open-kreisreform-map]')) {
    trigger.addEventListener('click', () => {
      const disclosure = document.querySelector<HTMLDetailsElement>('[data-map-disclosure]');
      if (disclosure) disclosure.open = true;
    });
  }

  const containers = Array.from(document.querySelectorAll<HTMLElement>('[data-kreisreform-map]'));
  for (const container of containers) {
    if (container.dataset.mapInitialized === 'true') continue;
    container.dataset.mapInitialized = 'true';

    const disclosure = container.closest<HTMLDetailsElement>('[data-map-disclosure]');
    if (!disclosure) {
      lazyInit(container);
      continue;
    }

    const mobileQuery = window.matchMedia('(max-width: 640px)');
    const startWhenAvailable = () => {
      if (disclosure.open) {
        lazyInit(container);
      }
    };
    const updateDisclosure = () => {
      if (!mobileQuery.matches) {
        disclosure.open = true;
      }
      startWhenAvailable();
    };

    disclosure.addEventListener('toggle', startWhenAvailable);
    mobileQuery.addEventListener('change', updateDisclosure);
    updateDisclosure();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootMaps, { once: true });
} else {
  bootMaps();
}

function lazyInit(container: HTMLElement): void {
  if (container.dataset.mapLoadScheduled === 'true') return;
  container.dataset.mapLoadScheduled = 'true';

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    void initMap(container);
  };

  if (!('IntersectionObserver' in window)) {
    start();
    return;
  }

  const fallbackTimer = window.setTimeout(start, 2500);
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        window.clearTimeout(fallbackTimer);
        start();
      }
    },
    { rootMargin: '180px' },
  );

  observer.observe(container);
}

async function initMap(container: HTMLElement): Promise<void> {
  const mapElement = container.querySelector<HTMLElement>('[data-map-canvas]');
  const statusElement = container.querySelector<HTMLElement>('[data-map-status]');
  const detailPanel = container.querySelector<HTMLElement>('[data-detail-panel]');
  const resetButton = container.querySelector<HTMLButtonElement>('[data-map-reset]');

  if (!mapElement || !statusElement || !detailPanel) return;

  const baseUrl = container.dataset.baseUrl ?? '/';
  const dataUrl = (value: string) => {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${base}${value.replace(/^\//u, '')}`;
  };

  setStatus(statusElement, 'Kartendaten werden geladen.');

  try {
    const L = await import('leaflet');
    const manifest = await fetchJson<KreisreformManifest>(dataUrl('/data/kreisreform/manifest.json'));
    const map = L.map(mapElement, {
      attributionControl: true,
      scrollWheelZoom: false,
      zoomControl: true,
      zoomSnap: 0.25,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap-Mitwirkende',
      maxZoom: 18,
    }).addTo(map);

    const state = createMapState(L, map, manifest, dataUrl, detailPanel, statusElement);
    applyLayerAvailability(container, manifest);
    wireLayerControls(container, state);
    wireReset(resetButton, state);
    await Promise.all([ensureLayer('neueKreise', state), ensureLayer('neueBezirke', state)]);
    setLayerVisibility('neueKreise', true, state);
    setLayerVisibility('neueBezirke', true, state);
    fitToVisibleLayers(state);
    setStatus(statusElement, 'Karte bereit. Wählen Sie ein Gebiet aus oder nutzen Sie die Gebietssuche.');

    window.setTimeout(() => {
      map.invalidateSize();
      fitToVisibleLayers(state);
    }, 120);
  } catch {
    setStatus(
      statusElement,
      'Die Karte konnte nicht geladen werden. Nutzen Sie die tabellarische Übersicht oder die Suche.',
      true,
    );
  }
}

function createMapState(
  L: typeof Leaflet,
  map: Leaflet.Map,
  manifest: KreisreformManifest,
  dataUrl: (value: string) => string,
  detailPanel: HTMLElement,
  statusElement: HTMLElement,
) {
  return {
    L,
    map,
    manifest,
    dataUrl,
    detailPanel,
    statusElement,
    layers: new Map<LayerKey, Leaflet.GeoJSON>(),
    data: new Map<LayerKey, FeatureCollection>(),
    selectedLayer: undefined as Leaflet.Layer | undefined,
  };
}

type MapState = ReturnType<typeof createMapState>;

function setStatus(element: HTMLElement, message: string, isError = false): void {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function ensureLayer(key: LayerKey, state: MapState): Promise<Leaflet.GeoJSON | undefined> {
  const existingLayer = state.layers.get(key);
  if (existingLayer) return existingLayer;

  const definition = layerDefinitions.find((entry) => entry.key === key);
  const layerInfo = definition ? state.manifest.layers[definition.manifestKey] : undefined;
  if (!definition || !layerInfo?.available) {
    setStatus(state.statusElement, layerInfo?.reason ?? 'Dieser Layer ist nicht verfügbar.', true);
    return undefined;
  }

  const collection = await fetchJson<FeatureCollection>(state.dataUrl(layerInfo.url));
  state.data.set(key, collection);

  const layer = state.L.geoJSON(collection as GeoJsonObject, {
    style: (feature) => styleFeature(key, (feature?.properties ?? {}) as KreisreformProperties),
    onEachFeature: (feature, leafletLayer) => {
      const typedFeature = feature as Feature<Geometry, KreisreformProperties>;
      leafletLayer.on({
        mouseover: () => highlightLayer(key, leafletLayer, state),
        mouseout: () => resetLayerHighlight(key, leafletLayer, state),
        click: () => selectFeature(key, typedFeature, leafletLayer, state),
      });
    },
  });

  state.layers.set(key, layer);
  return layer;
}

function setLayerVisibility(key: LayerKey, visible: boolean, state: MapState): void {
  const layer = state.layers.get(key);
  if (!layer) return;

  if (visible) {
    layer.addTo(state.map);
    return;
  }

  layer.removeFrom(state.map);
}

function applyLayerAvailability(container: HTMLElement, manifest: KreisreformManifest): void {
  for (const definition of layerDefinitions) {
    const input = container.querySelector<HTMLInputElement>(`[data-layer-toggle="${definition.key}"]`);
    const label = input?.closest<HTMLElement>('.kreisreform-layer-toggle');
    const status = label?.querySelector<HTMLElement>('[data-layer-note]');
    const layerInfo = manifest.layers[definition.manifestKey];

    if (!input || !layerInfo) continue;

    input.checked = definition.defaultVisible && layerInfo.available;
    input.disabled = !layerInfo.available;
    label?.classList.toggle('is-disabled', !layerInfo.available);
    label?.classList.toggle('is-active', input.checked);
    if (status) {
      status.textContent = layerInfo.available ? '' : 'noch nicht hinterlegt';
    }
  }
}

function wireLayerControls(container: HTMLElement, state: MapState): void {
  const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('[data-layer-toggle]'));

  for (const input of inputs) {
    input.addEventListener('change', () => {
      const key = input.dataset.layerToggle as LayerKey;
      const label = input.closest<HTMLElement>('.kreisreform-layer-toggle');
      label?.classList.toggle('is-active', input.checked);
      void (async () => {
        if (input.checked) {
          const layer = await ensureLayer(key, state);
          if (layer) {
            setLayerVisibility(key, true, state);
            state.map.invalidateSize();
            setStatus(state.statusElement, 'Layer eingeblendet.');
          } else {
            input.checked = false;
            label?.classList.remove('is-active');
          }
          return;
        }

        setLayerVisibility(key, false, state);
        state.map.invalidateSize();
      })();
    });
  }
}

function wireReset(button: HTMLButtonElement | null, state: MapState): void {
  button?.addEventListener('click', () => {
    for (const definition of layerDefinitions) {
      const input = document.querySelector<HTMLInputElement>(`[data-layer-toggle="${definition.key}"]`);
      const shouldShow = definition.key === 'neueKreise' || definition.key === 'neueBezirke';
      if (input && !input.disabled) input.checked = shouldShow;
      input?.closest<HTMLElement>('.kreisreform-layer-toggle')?.classList.toggle('is-active', shouldShow);
      setLayerVisibility(definition.key, shouldShow, state);
    }
    state.selectedLayer = undefined;
    renderEmptyDetail(state.detailPanel);
    fitToVisibleLayers(state);
    setStatus(state.statusElement, 'Neue Ordnung wiederhergestellt.');
  });
}

function styleFeature(key: LayerKey, properties: KreisreformProperties): Leaflet.PathOptions {
  if (key === 'neueKreise') {
    return {
      color: '#173b6b',
      fillColor: districtColors[properties.bezirkNeu ?? ''] ?? '#7d8b68',
      fillOpacity: 0.34,
      opacity: 0.92,
      weight: 1.35,
    };
  }

  if (key === 'neueBezirke') {
    return {
      color: '#173b6b',
      fillOpacity: 0.04,
      opacity: 1,
      weight: 2.8,
    };
  }

  if (key === 'alteKreise') {
    return {
      color: '#8f2e2f',
      dashArray: '6 4',
      fillOpacity: 0,
      opacity: 0.94,
      weight: 1.7,
    };
  }

  if (key === 'alteBezirke') {
    return {
      color: '#6b4b2f',
      dashArray: '8 6',
      fillOpacity: 0,
      opacity: 0.9,
      weight: 2,
    };
  }

  return {
    color: '#6d7a73',
    dashArray: '2 6',
    fillOpacity: 0.02,
    opacity: 0.8,
    weight: 1.4,
  };
}

function highlightLayer(key: LayerKey, layer: Leaflet.Layer, state: MapState): void {
  if ('setStyle' in layer && typeof layer.setStyle === 'function') {
    layer.setStyle({
      weight: key === 'neueBezirke' ? 4 : 2.4,
      opacity: 1,
      fillOpacity: key === 'neueBezirke' ? 0.08 : 0.58,
    });
  }
  if ('bringToFront' in layer && typeof layer.bringToFront === 'function') {
    layer.bringToFront();
  }
  state.map.getContainer().style.cursor = 'pointer';
}

function resetLayerHighlight(key: LayerKey, layer: Leaflet.Layer, state: MapState): void {
  const group = state.layers.get(key);
  if (group && 'resetStyle' in group && typeof group.resetStyle === 'function') {
    group.resetStyle(layer);
  }
  state.map.getContainer().style.cursor = '';
}

function selectFeature(
  key: LayerKey,
  feature: Feature<Geometry, KreisreformProperties>,
  layer: Leaflet.Layer,
  state: MapState,
  note?: string,
): void {
  state.selectedLayer = layer;
  const properties = (feature.properties ?? {}) as KreisreformProperties;
  renderDetail(key, properties, state.detailPanel, note);

  if ('bindPopup' in layer && typeof layer.bindPopup === 'function') {
    layer.bindPopup(`<strong>${escapeHtml(properties.name ?? 'Gebiet')}</strong>`).openPopup();
  }
}

function renderEmptyDetail(panel: HTMLElement): void {
  panel.innerHTML = `
    <p class="eyebrow">Auswahl</p>
    <h3>Gebiet auswählen</h3>
    <p>Wählen Sie ein Gebiet in der Karte oder einen Treffer aus der Suche aus.</p>
  `;
}

function renderDetail(key: LayerKey, properties: KreisreformProperties, panel: HTMLElement, note?: string): void {
  if (key === 'neueKreise') {
    const oldParts = properties.alteKreise?.length
      ? `<ul>${properties.alteKreise
          .map((entry) => `<li>${escapeHtml(entry.name)} <span>${escapeHtml(entry.bezirkAlt)}</span></li>`)
          .join('')}</ul>`
      : '<p>Keine Angabe.</p>';

    panel.innerHTML = `
      <p class="eyebrow">Neuer Kreis</p>
      <h3>${escapeHtml(properties.name ?? 'Kreis')}</h3>
      ${note ? `<p class="kreisreform-detail-note">${escapeHtml(note)}</p>` : ''}
      <dl class="meta-list">
        <div><dt>Rechtsstellung</dt><dd>${escapeHtml(properties.typ ?? 'Keine Angabe')}</dd></div>
        <div><dt>Neuer Bezirk</dt><dd>${escapeHtml(properties.bezirkNeu ?? 'Keine Angabe')}</dd></div>
        <div><dt>Einwohner</dt><dd>${formatInteger(properties.einwohner)}</dd></div>
        <div><dt>Fläche</dt><dd>${formatArea(properties.flaecheKm2)}</dd></div>
        <div><dt>Gemeinden</dt><dd>${formatInteger(properties.gemeinden)}</dd></div>
      </dl>
      <h4>Bisherige Gebietsteile</h4>
      ${oldParts}
    `;
    return;
  }

  if (key === 'neueBezirke') {
    const kreise = properties.kreise?.length
      ? `<ul>${properties.kreise.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>`
      : '<p>Keine Angabe.</p>';

    panel.innerHTML = `
      <p class="eyebrow">Neuer Bezirk</p>
      <h3>${escapeHtml(properties.name ?? 'Bezirk')}</h3>
      <dl class="meta-list">
        <div><dt>Sitz</dt><dd>${escapeHtml(properties.sitz ?? 'Keine Angabe')}</dd></div>
        <div><dt>Einwohner</dt><dd>${formatInteger(properties.einwohner)}</dd></div>
        <div><dt>Fläche</dt><dd>${formatArea(properties.flaecheKm2)}</dd></div>
      </dl>
      <h4>Zugeordnete Kreise</h4>
      ${kreise}
    `;
    return;
  }

  if (key === 'alteKreise') {
    const neueKreise = properties.neueKreise?.length
      ? `<ul>${properties.neueKreise.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>`
      : '<p>Keine Angabe.</p>';

    panel.innerHTML = `
      <p class="eyebrow">Bisheriger Kreis</p>
      <h3>${escapeHtml(properties.name ?? 'Gebiet')}</h3>
      <dl class="meta-list">
        <div><dt>Typ</dt><dd>${escapeHtml(properties.typ ?? 'Keine Angabe')}</dd></div>
        <div><dt>Bisheriges Land</dt><dd>${escapeHtml(properties.bundeslandAlt ?? 'Keine Angabe')}</dd></div>
        <div><dt>Bisheriger Bezirk</dt><dd>${escapeHtml(properties.bezirkAlt ?? 'Keine Angabe')}</dd></div>
      </dl>
      <h4>Zuordnung in der neuen Ordnung</h4>
      ${neueKreise}
    `;
    return;
  }

  if (key === 'alteBezirke') {
    const kreise = properties.kreise?.length
      ? `<ul>${properties.kreise.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>`
      : '<p>Keine Angabe.</p>';

    panel.innerHTML = `
      <p class="eyebrow">Bisheriger Bezirk</p>
      <h3>${escapeHtml(properties.name ?? 'Bezirk')}</h3>
      <dl class="meta-list">
        <div><dt>Sitz</dt><dd>${escapeHtml(properties.sitz ?? 'Keine Angabe')}</dd></div>
        <div><dt>Quelle</dt><dd>${escapeHtml(properties.quelle ?? 'Keine Angabe')}</dd></div>
      </dl>
      <h4>Bisherige Kreise</h4>
      ${kreise}
    `;
    return;
  }

  panel.innerHTML = `
    <p class="eyebrow">Bisheriges Land</p>
    <h3>${escapeHtml(properties.name ?? 'Gebiet')}</h3>
    <dl class="meta-list">
      <div><dt>Typ</dt><dd>${escapeHtml(properties.typ ?? 'Keine Angabe')}</dd></div>
      <div><dt>Quelle</dt><dd>${escapeHtml(properties.quelle ?? 'Keine Angabe')}</dd></div>
    </dl>
  `;
}

function fitToVisibleLayers(state: MapState): void {
  const bounds = state.L.latLngBounds([]);
  for (const layer of state.layers.values()) {
    if (!state.map.hasLayer(layer)) continue;
    const layerBounds = layer.getBounds();
    if (layerBounds.isValid()) bounds.extend(layerBounds);
  }

  if (bounds.isValid()) {
    state.map.fitBounds(bounds, { padding: [16, 16], maxZoom: 7 });
  }
}

function formatInteger(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? integerFormatter.format(value) : 'Keine Angabe';
}

function formatArea(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${areaFormatter.format(value)} km²` : 'Keine Angabe';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#039;');
}
