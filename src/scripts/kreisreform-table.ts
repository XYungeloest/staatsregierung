export {};

const root = document.querySelector<HTMLElement>('[data-kreisreform-table-filter]');

if (root) {
  const query = root.querySelector<HTMLInputElement>('[data-kreisreform-table-query]');
  const district = root.querySelector<HTMLSelectElement>('[data-kreisreform-table-bezirk]');
  const status = root.querySelector<HTMLElement>('[data-kreisreform-table-status]');
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-kreisreform-table-row]'));

  const normalize = (value: string) => value
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/ß/gu, 'ss');

  const update = () => {
    const term = normalize(query?.value.trim() ?? '');
    const selectedDistrict = district?.value ?? '';
    let districts = 0;
    let counties = 0;

    for (const row of rows) {
      const matchesQuery = !term || normalize(row.dataset.name ?? '').includes(term);
      const matchesDistrict = !selectedDistrict || row.dataset.bezirk === selectedDistrict;
      const visible = matchesQuery && matchesDistrict;
      row.hidden = !visible;
      if (visible && row.dataset.kind === 'bezirk') districts += 1;
      if (visible && row.dataset.kind === 'kreis') counties += 1;
    }

    if (status) {
      status.textContent = `${districts} ${districts === 1 ? 'Bezirk' : 'Bezirke'} und ${counties} ${counties === 1 ? 'Kreis' : 'Kreise'} sichtbar.`;
    }
  };

  query?.addEventListener('input', update);
  district?.addEventListener('change', update);
  update();
}
