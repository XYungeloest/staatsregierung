import { DEFAULT_PORTAL_PAGE_SIZE, getPageState } from '@ostrecht/shared/lib/portal/pagination.ts';

export {};

interface KreisRow {
  name: string;
  typ: string;
  bezirkNeu: string;
  einwohner: number;
  flaecheKm2: number;
  gemeinden: number;
  alteKreise: Array<{ name: string }>;
}

const root = document.querySelector<HTMLElement>('[data-kreisreform-table-filter]');
const body = document.querySelector<HTMLTableSectionElement>('[data-kreisreform-table-body]');
const pagination = document.querySelector<HTMLElement>('[data-pagination="kreise"]');

const integerFormat = new Intl.NumberFormat('de-DE');
const areaFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/ß/gu, 'ss');
}

function escapeHtml(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

function formatCount(count: number, one: string, many: string): string {
  return `${integerFormat.format(count)} ${count === 1 ? one : many}`;
}

if (root && body && pagination) {
  const query = root.querySelector<HTMLInputElement>('[data-kreisreform-table-query]');
  const district = root.querySelector<HTMLSelectElement>('[data-kreisreform-table-bezirk]');
  const status = root.querySelector<HTMLElement>('[data-kreisreform-table-status]');
  const range = pagination.querySelector<HTMLElement>('[data-pagination-range]');
  const total = pagination.querySelector<HTMLElement>('[data-pagination-total]');
  const pageLabel = pagination.querySelector<HTMLElement>('[data-pagination-page]');
  const previous = pagination.querySelector<HTMLButtonElement>('[data-page-action="previous"]');
  const next = pagination.querySelector<HTMLButtonElement>('[data-page-action="next"]');
  const districtRows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-kreisreform-table-row][data-kind="bezirk"]'));
  const baseUrl = root.dataset.baseUrl ?? '/';
  const dataUrl = `${baseUrl.replace(/\/?$/u, '/')}data/kreisreform/neue-kreise.geojson`;

  let rows: KreisRow[] = [];
  let page = 1;

  const createRow = (kreis: KreisRow): string => `
    <tr data-kreisreform-table-row data-kind="kreis">
      <th scope="row">${escapeHtml(kreis.name)}</th>
      <td>${escapeHtml(kreis.typ)}</td>
      <td>${escapeHtml(kreis.bezirkNeu)}</td>
      <td>${integerFormat.format(kreis.einwohner)}</td>
      <td>${areaFormat.format(kreis.flaecheKm2)} km²</td>
      <td>${escapeHtml(kreis.alteKreise.map((entry) => entry.name).join(', '))}<span>${escapeHtml(formatCount(kreis.gemeinden, 'Gemeinde', 'Gemeinden'))}</span></td>
    </tr>`;

  const render = () => {
    const term = normalize(query?.value.trim() ?? '');
    const selected = district?.value ?? '';
    const matches = rows.filter(
      (kreis) =>
        (!term || normalize(`${kreis.name} ${kreis.bezirkNeu}`).includes(term)) &&
        (!selected || kreis.bezirkNeu === selected),
    );
    const state = getPageState(matches.length, page, DEFAULT_PORTAL_PAGE_SIZE);
    page = state.page;

    body.innerHTML =
      matches.length > 0
        ? matches.slice(state.start, state.end).map(createRow).join('')
        : '<tr><td colspan="6">Kein Kreis entspricht dieser Auswahl.</td></tr>';

    let visibleDistricts = 0;
    for (const row of districtRows) {
      const name = row.dataset.bezirk ?? '';
      const visible = (!term || normalize(row.dataset.name ?? '').includes(term)) && (!selected || name === selected);
      row.hidden = !visible;
      if (visible) visibleDistricts += 1;
    }

    if (range) range.textContent = state.rangeLabel;
    if (total) total.textContent = String(state.total);
    if (pageLabel) pageLabel.textContent = state.pageLabel;
    if (previous) previous.disabled = !state.hasPrevious;
    if (next) next.disabled = !state.hasNext;
    if (status) {
      status.textContent = `${formatCount(visibleDistricts, 'Bezirk', 'Bezirke')} und ${formatCount(matches.length, 'Kreis', 'Kreise')} gefunden.`;
    }
  };

  root.addEventListener('submit', (event) => event.preventDefault());
  query?.addEventListener('input', () => {
    page = 1;
    render();
  });
  district?.addEventListener('change', () => {
    page = 1;
    render();
  });
  previous?.addEventListener('click', () => {
    page = Math.max(1, page - 1);
    render();
  });
  next?.addEventListener('click', () => {
    page += 1;
    render();
  });

  void fetch(dataUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Kreisdaten nicht erreichbar (${response.status})`);
      return (await response.json()) as { features: Array<{ properties: KreisRow }> };
    })
    .then((collection) => {
      rows = collection.features
        .map((feature) => feature.properties)
        .sort((left, right) => `${left.name}-${left.typ}`.localeCompare(`${right.name}-${right.typ}`, 'de'));
      render();
    })
    .catch(() => {
      // Ohne die Datei bleibt die vorgerenderte erste Seite stehen.
    });
}
