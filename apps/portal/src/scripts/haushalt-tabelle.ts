/**
 * Tabellen-Enhancer des Haushaltsinformationssystems (progressive Verbesserung).
 *
 * Ohne JavaScript bleibt jede Tabelle vollständig sichtbar: alle Zeilen, alle Spalten, alle
 * Erläuterungen; Sprungziele (`#titel-…`) funktionieren über `:target`. Bedienelemente, die
 * JavaScript brauchen, tragen `hidden` und `data-tabelle-js`; das Skript blendet sie nach der
 * Initialisierung ein. Eingebunden wird es von `components/haushalt/DataTableFrame.astro` (einmal
 * je Seite gebündelt); mehrere Tabellen je Seite arbeiten unabhängig.
 *
 * Attributprotokoll
 * =================
 *
 * Wurzel (`DataTableFrame` rendert sie):
 *   data-haushalt-tabelle            Wurzel einer Tabelle; trägt eine eindeutige `id`.
 *   data-nomen-singular="Titel"      Nomen bei Gesamtzahl 1.
 *   data-nomen-plural="Titeln"       Nomen im Dativ Plural: „Auswahl: 12 von 300 Titeln.“
 *   data-seitengroesse="25"          Zeilen je Seite (Standard des Rahmens:
 *                                    `DEFAULT_PORTAL_PAGE_SIZE`); 0 oder fehlend = keine Blätterung.
 *                                    Gefiltert und sortiert wird immer über alle Zeilen.
 *   data-export-filename="….csv"     Dateiname des CSV-Exports (Standard: `<id>.csv`).
 *   data-export-meta='{"Periode":"2027-2028","Datenstand":"2026-10-30"}'
 *                                    Zusatzspalten, die in jeder CSV-Zeile wiederholt werden
 *                                    (keine Metadatenzeilen in der Datei).
 *   data-export-zeilenfelder='[{"key":"kapitel","label":"Kapitel"}]'
 *                                    Zusatzspalten aus Zeilenattributen `data-export-<key>`.
 *   data-year-view="2027"            Anfangsansicht der Jahresspalten (siehe unten).
 *   data-year-view-schmal="2027"     Anfangsansicht bis 47,99 rem Breite, solange die Ansicht nicht
 *                                    selbst gewählt wurde.
 *   data-url-param="q"               Suchbegriff aus `?q=` vorbefüllen und mitschreiben.
 *
 * In der Wurzel (oder in einem Element mit `data-tabelle-ziel="<id der Wurzel>"`):
 *   input[data-tabelle-suche]        Freitextsuche über `data-search` der Datenzeile (sonst
 *                                    ihren Text). Normalisierung: Kleinbuchstaben, ä→ae, ö→oe,
 *                                    ü→ue, ß→ss, Diakritika entfernt; alle Wörter müssen passen.
 *   select[data-filter="feld"]       Auswahlfilter gegen `data-feld` der Datenzeile; leerer Wert
 *                                    = alle. Mehrere Zeilenwerte mit „|“ trennen
 *                                    (`data-thema="bildung|digitales"`).
 *   button[data-year-view-value="2027"]  Jahresansicht (aria-pressed wird gepflegt) …
 *   select[data-year-view-control]       … oder als Auswahlfeld.
 *   [data-year-col="2027 beide"]     Zelle/Spaltenkopf ist nur in den genannten Ansichten
 *                                    sichtbar; Ansicht „alle“ zeigt jede Spalte.
 *   input[type=checkbox][data-erlaeuterungen-toggle] (oder button mit aria-pressed)
 *                                    blendet alle `[data-erlaeuterung]` der Tabelle ein/aus.
 *   form[data-tabelle-werkzeuge][data-label-auto]  Werkzeugleiste ohne eigenen Namen; erhält
 *                                    „Suche und Filter: <Name des Tabellenbereichs>“.
 *   [data-tabelle-status]            Statuszeile (role="status", aria-live="polite").
 *   [data-tabelle-leer]              Leerhinweis, sichtbar bei 0 Treffern.
 *   [data-tabelle-blaettern]         Hülle um `DataPagination.astro` (`[data-pagination-range]`,
 *                                    `[data-pagination-total]`, `[data-pagination-page]`,
 *                                    `button[data-page-action="previous|next"]`); sichtbar nur,
 *                                    wenn die Tabelle mehr Zeilen hat als eine Seite.
 *   [data-tabelle-rahmen]            Hülle des Scrollbereichs (auch in `ChartData`); trägt
 *                                    `data-scroll-links` und `data-scroll-rechts`, solange dort
 *                                    Spalten verdeckt sind.
 *   [data-tabelle-scrollhinweis]     Hinweis, sichtbar nur, solange die Tabelle breiter ist als
 *                                    ihr Bereich.
 *   button[data-tabelle-zuruecksetzen]  setzt Suche und Filter zurück.
 *   button[data-tabelle-export]      CSV-Export aller Zeilen der Auswahl (über alle Seiten).
 *
 * Tabelle:
 *   th[data-sort="number"|"text"]    sortierbare Spalte; das Skript setzt einen <button> in den
 *                                    Kopf und pflegt `aria-sort`. `data-sort-first="asc|desc"`
 *                                    (Standard: Zahlen absteigend, Text aufsteigend),
 *                                    `data-sort-col="n"` (0-basiert) bei verschachtelten Köpfen.
 *                                    Ein serverseitig gesetztes `aria-sort` muss der tatsächlichen
 *                                    Ausgangsreihenfolge entsprechen; sie wird wiederhergestellt,
 *                                    wenn die sortierte Spalte ausgeblendet wird.
 *   th[data-export-key="betrag_2027"] Spalte gehört in den CSV-Export; Spaltenname aus
 *                                    `data-export-label`, sonst aus dem Kopftext.
 *   td/th[data-sort="…"]             Sortierwert der Zelle; sonst `data-export-value`, sonst
 *                                    `<data value>` in der Zelle, sonst der Text.
 *   td/th[data-export-value="…"]     exakter Exportwert (Geld: ganze Euro); sonst `<data value>`
 *                                    in der Zelle, sonst der Text ohne `aria-hidden`, Knöpfe und
 *                                    `[data-export-ignorieren]`.
 *   tbody tr                         Datenzeile; `id` (z. B. `titel-63361`) macht sie zum
 *                                    Sprungziel. Datenzeilen haben eine Zelle je Spalte
 *                                    (kein colspan vor sortierbaren Spalten).
 *   tbody tr[data-folgezeile]        gehört zur vorhergehenden Datenzeile (Erläuterung,
 *                                    Unterzeile); wird mit ihr sortiert, gefiltert und geblättert,
 *                                    exportiert wird nur die Datenzeile.
 *   tbody tr[data-gruppenkopf]       Gruppenkopf (z. B. Kapitel, `<th scope="rowgroup">`); bleibt
 *                                    an seiner Stelle, sortiert wird innerhalb der Gruppe; sichtbar
 *                                    auf jeder Seite mit Zeilen der Gruppe.
 *
 * Überall auf der Seite:
 *   button[data-haushalt-link="titel-63361"]  kopiert die absolute Adresse mit Anker
 *                                    (`CopyLinkButton.astro`) und meldet den Erfolg.
 *
 * Sprungziele: Beim Laden und bei `hashchange` wird eine Zeile mit passender `id`
 * hervorgehoben (`.is-ziel`), bei Bedarf auf ihre Seite geblättert, in den Blick gerollt und
 * fokussiert; ist sie durch Suche oder Filter verborgen, werden diese zuvor zurückgesetzt.
 * Passt die Tabelle ohne waagerechtes Rollen in ihren Bereich, haftet der Spaltenkopf unter der
 * Bereichsnavigation (`--hh-kopf-oben`). Zum Drucken werden alle Zeilen der Auswahl gezeigt.
 */

import { getPageState } from '@ostrecht/shared/lib/portal/pagination.ts';

const ROOT_SELECTOR = '[data-haushalt-tabelle]';
const STATUS_DELAY = 350;
const NARROW_QUERY = '(max-width: 47.99rem)';
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
const integerFormat = new Intl.NumberFormat('de-DE');
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .replace(/ä/gu, 'ae')
    .replace(/ö/gu, 'oe')
    .replace(/ü/gu, 'ue')
    .replace(/ß/gu, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function cleanText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('[aria-hidden="true"], button, [data-export-ignorieren]').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

function cellExportValue(cell: HTMLTableCellElement | undefined): string {
  if (!cell) return '';
  if (cell.dataset.exportValue !== undefined) return cell.dataset.exportValue;
  const data = cell.querySelector<HTMLDataElement>('data[value]');
  if (data) return data.value;
  return cleanText(cell);
}

function cellSortValue(cell: HTMLTableCellElement | undefined): string {
  if (!cell) return '';
  if (cell.dataset.sort !== undefined) return cell.dataset.sort;
  return cellExportValue(cell);
}

function csvField(raw: string): string {
  let value = raw;
  // Formeln in Tabellenkalkulationen verhindern; reine Zahlen bleiben unverändert.
  if (/^[=+\-@\t\r]/u.test(value) && !/^[+-]?\d+(?:[.,]\d+)?$/u.test(value)) value = `'${value}`;
  if (/[";\r\n]/u.test(value) || /^\s|\s$/u.test(value)) return `"${value.replace(/"/gu, '""')}"`;
  return value;
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Höhe der haftenden Bereichsnavigation (0, wenn sie auf dieser Breite nicht haftet). */
function stickyOffset(): number {
  const nav = document.querySelector<HTMLElement>('.section-navigation');
  if (!nav || window.getComputedStyle(nav).position !== 'sticky') return 0;
  return Math.round(nav.getBoundingClientRect().height);
}

interface Segment {
  body: HTMLTableSectionElement;
  head: HTMLTableRowElement | null;
  groups: RowGroup[];
}

interface RowGroup {
  main: HTMLTableRowElement;
  rows: HTMLTableRowElement[];
  index: number;
  search: string;
  segment: Segment;
  /** passt zu Suche und Filtern */
  visible: boolean;
  /** steht auf der aktuellen Seite */
  shown: boolean;
}

interface SortColumn {
  th: HTMLTableCellElement;
  button: HTMLButtonElement;
  indicator: HTMLSpanElement;
  column: number;
  type: 'number' | 'text';
  first: 'asc' | 'desc';
  label: string;
}

interface ExportColumn {
  key: string;
  label: string;
  column: number;
}

/** Spaltenposition jedes Kopfes unter Berücksichtigung von colspan/rowspan. */
function headerColumns(table: HTMLTableElement): Map<HTMLTableCellElement, number> {
  const positions = new Map<HTMLTableCellElement, number>();
  const occupied: boolean[][] = [];
  const headRows = Array.from(table.tHead?.rows ?? []);
  headRows.forEach((row, rowIndex) => {
    occupied[rowIndex] ??= [];
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      while (occupied[rowIndex][column]) column += 1;
      positions.set(cell, column);
      for (let r = 0; r < Math.max(1, cell.rowSpan); r += 1) {
        occupied[rowIndex + r] ??= [];
        for (let c = 0; c < Math.max(1, cell.colSpan); c += 1) occupied[rowIndex + r][column + c] = true;
      }
      column += Math.max(1, cell.colSpan);
    }
  });
  return positions;
}

function cellAt(row: HTMLTableRowElement, column: number): HTMLTableCellElement | undefined {
  let position = 0;
  for (const cell of Array.from(row.cells)) {
    if (position === column) return cell;
    position += Math.max(1, cell.colSpan);
    if (position > column) return undefined;
  }
  return undefined;
}

let globalStatus: HTMLElement | null = null;

function announceGlobally(message: string) {
  if (!globalStatus) {
    globalStatus = document.createElement('p');
    globalStatus.className = 'visually-hidden';
    globalStatus.setAttribute('role', 'status');
    globalStatus.setAttribute('aria-live', 'polite');
    document.body.append(globalStatus);
  }
  globalStatus.textContent = '';
  window.setTimeout(() => {
    if (globalStatus) globalStatus.textContent = message;
  }, 50);
}

class HaushaltTabelle {
  readonly root: HTMLElement;
  readonly table: HTMLTableElement;
  readonly wrap: HTMLElement | null;
  readonly scrollHint: HTMLElement | null;
  readonly segments: Segment[] = [];
  readonly groups: RowGroup[] = [];
  readonly groupByRow = new Map<HTMLTableRowElement, RowGroup>();
  readonly sortColumns: SortColumn[] = [];
  /** `aria-sort` aus dem HTML: beschreibt die Ausgangsreihenfolge. */
  readonly serverSort = new Map<HTMLTableCellElement, string>();
  readonly exportColumns: ExportColumn[] = [];
  readonly headerLabels = new Map<HTMLTableCellElement, { label: string; column: number }>();
  readonly sortCache = new Map<number, Map<RowGroup, string | number | null>>();
  readonly controls: HTMLElement[];
  readonly search: HTMLInputElement | null;
  readonly filters: HTMLSelectElement[];
  readonly status: HTMLElement | null;
  readonly empty: HTMLElement | null;
  readonly pager: HTMLElement | null;
  readonly explanationToggle: HTMLInputElement | HTMLButtonElement | null;
  readonly yearButtons: HTMLButtonElement[];
  readonly yearSelect: HTMLSelectElement | null;
  readonly yearCells: HTMLElement[];
  readonly explanations: HTMLElement[];
  readonly urlParam: string | undefined;
  readonly pageSize: number;
  page = 1;
  showAll = false;
  private frame = 0;
  private layoutFrame = 0;
  private statusTimer = 0;
  private lastTarget: HTMLTableRowElement | null = null;
  private lastRow: HTMLTableRowElement | null = null;
  private yearViewChosen = false;
  private userSorted = false;

  constructor(root: HTMLElement, table: HTMLTableElement) {
    this.root = root;
    this.table = table;
    this.wrap = table.closest<HTMLElement>('.table-wrap');
    this.scrollHint = root.querySelector<HTMLElement>('[data-tabelle-scrollhinweis]');
    const linked = root.id
      ? Array.from(document.querySelectorAll<HTMLElement>(`[data-tabelle-ziel="${CSS.escape(root.id)}"]`))
      : [];
    this.controls = [root, ...linked];
    const find = <T extends Element>(selector: string) =>
      this.controls.flatMap((scope) => Array.from(scope.querySelectorAll<T>(selector)));

    this.search = find<HTMLInputElement>('input[data-tabelle-suche]')[0] ?? null;
    this.filters = find<HTMLSelectElement>('select[data-filter]');
    this.status = root.querySelector<HTMLElement>('[data-tabelle-status]');
    this.empty = root.querySelector<HTMLElement>('[data-tabelle-leer]');
    this.pager = root.querySelector<HTMLElement>('[data-tabelle-blaettern]');
    this.explanationToggle = find<HTMLInputElement | HTMLButtonElement>('[data-erlaeuterungen-toggle]')[0] ?? null;
    this.yearButtons = find<HTMLButtonElement>('button[data-year-view-value]');
    this.yearSelect = find<HTMLSelectElement>('select[data-year-view-control]')[0] ?? null;
    this.yearCells = Array.from(table.querySelectorAll<HTMLElement>('[data-year-col]'));
    this.explanations = Array.from(table.querySelectorAll<HTMLElement>('[data-erlaeuterung]'));
    this.urlParam = root.dataset.urlParam || undefined;
    const size = Number(root.dataset.seitengroesse ?? 0);
    this.pageSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : 0;

    this.collectRows();
    this.setupHeaders();
    this.bind();

    const regionLabel = this.wrap?.getAttribute('aria-label') ?? '';
    find<HTMLFormElement>('form[data-tabelle-werkzeuge][data-label-auto]').forEach((form) => {
      if (regionLabel) form.setAttribute('aria-label', `Suche und Filter: ${regionLabel}`);
    });

    if (this.urlParam && this.search) {
      const initial = new URLSearchParams(window.location.search).get(this.urlParam);
      if (initial) this.search.value = initial;
    }
    const initialView = this.preferredYearView();
    if (initialView) this.setYearView(initialView, false);

    find<HTMLElement>('[data-tabelle-js][hidden]').forEach((element) => {
      element.hidden = false;
    });
    this.render();
    this.observeLayout();
  }

  private preferredYearView(): string | undefined {
    const narrow = this.root.dataset.yearViewSchmal;
    if (narrow && window.matchMedia(NARROW_QUERY).matches) return narrow;
    return (
      this.root.dataset.yearView ||
      this.yearButtons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.yearViewValue ||
      this.yearSelect?.value ||
      undefined
    );
  }

  private collectRows() {
    for (const body of Array.from(this.table.tBodies)) {
      let segment: Segment = { body, head: null, groups: [] };
      this.segments.push(segment);
      let current: RowGroup | null = null;
      for (const row of Array.from(body.rows)) {
        if (row.hasAttribute('data-gruppenkopf')) {
          segment = { body, head: row, groups: [] };
          this.segments.push(segment);
          current = null;
          continue;
        }
        if (row.hasAttribute('data-folgezeile') && current) {
          current.rows.push(row);
          this.groupByRow.set(row, current);
          continue;
        }
        current = { main: row, rows: [row], index: this.groups.length, search: '', segment, visible: true, shown: true };
        segment.groups.push(current);
        this.groups.push(current);
        this.groupByRow.set(row, current);
      }
    }
    for (const group of this.groups) {
      const source = group.main.dataset.search ?? group.rows.map((row) => cleanText(row)).join(' ');
      group.search = normalizeSearch(source);
    }
    // Leere Ausgangssegmente (tbody beginnt mit einem Gruppenkopf) entfernen.
    for (let index = this.segments.length - 1; index >= 0; index -= 1) {
      const segment = this.segments[index];
      if (!segment.head && segment.groups.length === 0) this.segments.splice(index, 1);
    }
  }

  private setupHeaders() {
    const positions = headerColumns(this.table);
    for (const [th, position] of positions) {
      const column = th.dataset.sortCol !== undefined ? Number(th.dataset.sortCol) : position;
      const label = th.dataset.exportLabel ?? cleanText(th);
      this.headerLabels.set(th, { label, column });
      if (th.dataset.exportKey) {
        this.exportColumns.push({ key: th.dataset.exportKey, label, column });
      }
      if (th.dataset.sort === undefined) continue;
      const type = th.dataset.sort === 'number' ? 'number' : 'text';
      const first = th.dataset.sortFirst === 'asc' || th.dataset.sortFirst === 'desc' ? th.dataset.sortFirst : type === 'number' ? 'desc' : 'asc';
      const initial = th.getAttribute('aria-sort');
      if (initial) this.serverSort.set(th, initial);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hh-sortierknopf';
      const text = document.createElement('span');
      text.className = 'hh-sortierknopf__text';
      text.append(...Array.from(th.childNodes));
      const indicator = document.createElement('span');
      indicator.className = 'hh-sortierknopf__zeichen';
      indicator.setAttribute('aria-hidden', 'true');
      button.append(text, indicator);
      th.append(button);
      const sortColumn: SortColumn = { th, button, indicator, column, type, first, label };
      this.sortColumns.push(sortColumn);
      button.addEventListener('click', () => this.sortBy(sortColumn));
    }
    this.updateSortIndicators();
  }

  private bind() {
    for (const scope of this.controls) {
      const forms = scope.matches('form') ? [scope] : Array.from(scope.querySelectorAll('form'));
      forms.forEach((form) => form.addEventListener('submit', (event) => event.preventDefault()));
    }
    this.search?.addEventListener('input', () => {
      this.writeUrlState();
      this.page = 1;
      this.schedule();
    });
    this.filters.forEach((select) =>
      select.addEventListener('change', () => {
        this.page = 1;
        this.schedule();
      }),
    );
    this.yearButtons.forEach((button) =>
      button.addEventListener('click', () => {
        this.yearViewChosen = true;
        this.setYearView(button.dataset.yearViewValue ?? '', true);
      }),
    );
    this.yearSelect?.addEventListener('change', () => {
      this.yearViewChosen = true;
      this.setYearView(this.yearSelect?.value ?? '', true);
    });
    if (this.root.dataset.yearViewSchmal) {
      window.matchMedia(NARROW_QUERY).addEventListener('change', () => {
        if (this.yearViewChosen) return;
        const view = this.preferredYearView();
        if (view) this.setYearView(view, false);
      });
    }
    if (this.explanationToggle) {
      const toggle = this.explanationToggle;
      toggle.addEventListener(toggle instanceof HTMLInputElement ? 'change' : 'click', () => {
        if (toggle instanceof HTMLButtonElement) {
          toggle.setAttribute('aria-pressed', toggle.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        }
        this.schedule();
      });
    }
    this.controls
      .flatMap((scope) => Array.from(scope.querySelectorAll<HTMLButtonElement>('button[data-tabelle-zuruecksetzen]')))
      .forEach((button) =>
        button.addEventListener('click', () => {
          this.resetFilters();
          this.render();
          this.focusAfterReset();
        }),
      );
    this.controls
      .flatMap((scope) => Array.from(scope.querySelectorAll<HTMLButtonElement>('button[data-tabelle-export]')))
      .forEach((button) => button.addEventListener('click', () => this.exportCsv()));
    const previousButton = this.pager?.querySelector<HTMLButtonElement>('[data-page-action="previous"]') ?? null;
    const nextButton = this.pager?.querySelector<HTMLButtonElement>('[data-page-action="next"]') ?? null;
    previousButton?.addEventListener('click', () => {
      this.page = Math.max(1, this.page - 1);
      this.render();
      this.keepPagerFocus(previousButton, nextButton);
    });
    nextButton?.addEventListener('click', () => {
      this.page += 1;
      this.render();
      this.keepPagerFocus(nextButton, previousButton);
    });
  }

  /**
   * Wird der betätigte Blätterknopf auf der ersten oder letzten Seite deaktiviert, verliert er
   * den Fokus. Der Fokus geht dann auf den anderen Blätterknopf, sonst auf den Tabellenbereich.
   */
  private keepPagerFocus(pressed: HTMLButtonElement, other: HTMLButtonElement | null) {
    if (!pressed.disabled) return;
    if (other && !other.disabled) {
      other.focus();
      return;
    }
    if (!this.wrap) return;
    if (!this.wrap.hasAttribute('tabindex')) this.wrap.tabIndex = -1;
    this.wrap.focus();
  }

  /** Fokus nach „Auswahl zurücksetzen“: Suchfeld, sonst erstes Auswahlfeld, sonst Tabellenbereich. */
  private focusAfterReset() {
    const target: HTMLElement | null = this.search ?? this.filters[0] ?? this.wrap;
    if (!target) return;
    if (target === this.wrap && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus();
  }

  private explanationsOn(): boolean {
    const toggle = this.explanationToggle;
    if (!toggle) return true;
    return toggle instanceof HTMLInputElement ? toggle.checked : toggle.getAttribute('aria-pressed') === 'true';
  }

  private schedule() {
    if (this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  /** Alle Zeilen der Auswahl in Anzeigereihenfolge (über alle Seiten). */
  private matchingGroups(): RowGroup[] {
    return this.segments.flatMap((segment) => segment.groups.filter((group) => group.visible));
  }

  render() {
    const terms = normalizeSearch(this.search?.value ?? '').split(' ').filter(Boolean);
    const activeFilters = this.filters
      .filter((select) => select.value !== '')
      .map((select) => ({ field: select.dataset.filter ?? '', value: select.value }));
    const showExplanations = this.explanationsOn();

    for (const group of this.groups) {
      const matchesSearch = terms.every((term) => group.search.includes(term));
      const matchesFilters = activeFilters.every(({ field, value }) => {
        const rowValue = group.main.getAttribute(`data-${field}`) ?? '';
        return rowValue === value || rowValue.split('|').includes(value);
      });
      group.visible = matchesSearch && matchesFilters;
    }

    const matching = this.matchingGroups();
    const paginate = this.pageSize > 0 && !this.showAll;
    const state = getPageState(matching.length, this.page, paginate ? this.pageSize : Math.max(1, matching.length));
    // Beim Drucken bleibt die gewählte Seite für danach erhalten.
    if (paginate) this.page = state.page;
    const onPage = new Set(paginate ? matching.slice(state.start, state.end) : matching);

    for (const group of this.groups) {
      group.shown = onPage.has(group);
      group.rows.forEach((row) => {
        const isExplanation = row !== group.main && row.hasAttribute('data-erlaeuterung');
        row.hidden = !group.shown || (isExplanation && !showExplanations);
      });
    }
    for (const segment of this.segments) {
      if (segment.head) segment.head.hidden = !segment.groups.some((group) => group.shown);
    }
    for (const element of this.explanations) {
      if (element instanceof HTMLTableRowElement && this.groupByRow.has(element)) continue;
      element.hidden = !showExplanations;
    }

    // Letzte sichtbare Zeile ohne untere Linie (der Rahmen schließt die Tabelle ab).
    this.lastRow?.classList.remove('is-letzte-zeile');
    const lastGroup = paginate ? matching[state.end - 1] : matching[matching.length - 1];
    this.lastRow = lastGroup ? [...lastGroup.rows].reverse().find((row) => !row.hidden) ?? null : null;
    this.lastRow?.classList.add('is-letzte-zeile');

    if (this.empty) this.empty.hidden = matching.length > 0;
    this.updatePager(state, paginate);
    this.setStatus(this.countText(matching.length));
  }

  private updatePager(state: ReturnType<typeof getPageState>, paginate: boolean) {
    if (!this.pager) return;
    const needed = paginate && this.groups.length > this.pageSize;
    this.pager.hidden = !needed;
    if (!needed) return;
    const set = (selector: string, text: string) => {
      const element = this.pager?.querySelector<HTMLElement>(selector);
      if (element && element.textContent !== text) element.textContent = text;
    };
    set('[data-pagination-range]', state.rangeLabel);
    set('[data-pagination-total]', integerFormat.format(state.total));
    set('[data-pagination-page]', state.pageLabel);
    const previous = this.pager.querySelector<HTMLButtonElement>('[data-page-action="previous"]');
    const next = this.pager.querySelector<HTMLButtonElement>('[data-page-action="next"]');
    if (previous) previous.disabled = !state.hasPrevious;
    if (next) next.disabled = !state.hasNext;
  }

  private noun(count: number): string {
    return count === 1 ? this.root.dataset.nomenSingular ?? 'Eintrag' : this.root.dataset.nomenPlural ?? 'Einträgen';
  }

  private countText(matching: number): string {
    const total = this.groups.length;
    return `Auswahl: ${integerFormat.format(matching)} von ${integerFormat.format(total)} ${this.noun(total)}.`;
  }

  setStatus(message: string, immediate = false) {
    if (!this.status) return;
    window.clearTimeout(this.statusTimer);
    if (immediate || !this.status.textContent) {
      this.status.textContent = message;
      return;
    }
    this.statusTimer = window.setTimeout(() => {
      if (this.status) this.status.textContent = message;
    }, STATUS_DELAY);
  }

  resetFilters() {
    if (this.search) this.search.value = '';
    this.filters.forEach((select) => {
      select.value = '';
    });
    this.page = 1;
    this.writeUrlState();
  }

  private writeUrlState() {
    if (!this.urlParam) return;
    const url = new URL(window.location.href);
    const value = this.search?.value.trim() ?? '';
    if (value) url.searchParams.set(this.urlParam, value);
    else url.searchParams.delete(this.urlParam);
    window.history.replaceState(window.history.state, '', url);
  }

  setYearView(view: string, announce: boolean) {
    if (!view) return;
    this.root.dataset.yearView = view;
    for (const cell of this.yearCells) {
      const views = (cell.dataset.yearCol ?? '').split(/\s+/u).filter(Boolean);
      cell.hidden = view !== 'alle' && !views.includes(view);
    }
    for (const button of this.yearButtons) {
      const active = button.dataset.yearViewValue === view;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('is-active', active);
    }
    if (this.yearSelect && this.yearSelect.value !== view) this.yearSelect.value = view;
    const label = this.yearButtons.find((button) => button.dataset.yearViewValue === view)?.textContent?.trim() ?? view;

    // Eine ausgeblendete Spalte darf die Reihenfolge nicht unsichtbar bestimmen.
    const sorted = this.userSorted ? this.sortColumns.find((column) => column.th.hasAttribute('aria-sort')) : undefined;
    if (sorted && sorted.th.hidden) {
      this.restoreInitialOrder();
      if (announce) this.setStatus(`Ansicht: ${label}. Die Spalte ${sorted.label} ist ausgeblendet; die Tabelle steht wieder in der Ausgangsreihenfolge.`, true);
      return;
    }
    if (announce) this.setStatus(`Ansicht: ${label}.`, true);
  }

  private sortValue(group: RowGroup, column: SortColumn): string | number | null {
    let cache = this.sortCache.get(column.column);
    if (!cache) {
      cache = new Map();
      this.sortCache.set(column.column, cache);
    }
    if (cache.has(group)) return cache.get(group) ?? null;
    const raw = cellSortValue(cellAt(group.main, column.column));
    let value: string | number | null = raw;
    if (column.type === 'number') {
      const parsed = Number(raw.replace(/\s/gu, '').replace(/−/gu, '-'));
      value = raw.trim() === '' || !Number.isFinite(parsed) ? null : parsed;
    }
    cache.set(group, value);
    return value;
  }

  /** Schreibt die Zeilen jeder Gruppe in der Reihenfolge von `segment.groups` zurück. */
  private applyOrder() {
    const bodies = [...new Set(this.segments.map((segment) => segment.body))];
    for (const body of bodies) {
      const fragment = document.createDocumentFragment();
      for (const segment of this.segments) {
        if (segment.body !== body) continue;
        if (segment.head) fragment.append(segment.head);
        for (const group of segment.groups) fragment.append(...group.rows);
      }
      body.append(fragment);
    }
  }

  sortBy(column: SortColumn) {
    const current = column.th.getAttribute('aria-sort');
    const direction = current === 'ascending' ? 'desc' : current === 'descending' ? 'asc' : column.first;
    const factor = direction === 'asc' ? 1 : -1;
    for (const segment of this.segments) {
      segment.groups.sort((left, right) => {
        const a = this.sortValue(left, column);
        const b = this.sortValue(right, column);
        if (a === null && b === null) return left.index - right.index;
        if (a === null) return 1;
        if (b === null) return -1;
        const result = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
        return result === 0 ? left.index - right.index : result * factor;
      });
    }
    this.applyOrder();
    for (const other of this.sortColumns) {
      if (other === column) other.th.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
      else other.th.removeAttribute('aria-sort');
    }
    this.userSorted = true;
    this.updateSortIndicators();
    this.page = 1;
    this.render();
    this.setStatus(`Sortiert nach ${column.label}, ${direction === 'asc' ? 'aufsteigend' : 'absteigend'}.`, true);
  }

  /** Stellt die Reihenfolge des HTML und das serverseitige `aria-sort` wieder her. */
  restoreInitialOrder() {
    for (const segment of this.segments) segment.groups.sort((left, right) => left.index - right.index);
    this.applyOrder();
    for (const column of this.sortColumns) {
      const initial = this.serverSort.get(column.th);
      if (initial) column.th.setAttribute('aria-sort', initial);
      else column.th.removeAttribute('aria-sort');
    }
    this.userSorted = false;
    this.updateSortIndicators();
    this.page = 1;
    this.render();
  }

  private updateSortIndicators() {
    for (const column of this.sortColumns) {
      const state = column.th.getAttribute('aria-sort');
      column.indicator.textContent = state === 'ascending' ? '↑' : state === 'descending' ? '↓' : '↕';
    }
  }

  exportCsv() {
    const meta = parseJson<Record<string, string>>(this.root.dataset.exportMeta, {});
    const rowFields = parseJson<Array<{ key: string; label: string }>>(this.root.dataset.exportZeilenfelder, []);
    const columns = this.exportColumns.length > 0
      ? this.exportColumns
      : Array.from(this.table.tHead?.rows[this.table.tHead.rows.length - 1]?.cells ?? []).map((th, index) => {
          const entry = this.headerLabels.get(th);
          return { key: `spalte_${index + 1}`, label: entry?.label ?? '', column: entry?.column ?? index };
        });
    const header = [...columns.map((column) => column.label), ...rowFields.map((field) => field.label), ...Object.keys(meta)];
    const groups = this.matchingGroups();
    const lines = [header.map(csvField).join(';')];
    for (const group of groups) {
      const values = [
        ...columns.map((column) => cellExportValue(cellAt(group.main, column.column))),
        ...rowFields.map((field) => group.main.getAttribute(`data-export-${field.key}`) ?? ''),
        ...Object.values(meta).map((value) => String(value)),
      ];
      lines.push(values.map(csvField).join(';'));
    }
    const blob = new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.root.dataset.exportFilename || `${this.root.id || 'tabelle'}.csv`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const total = this.groups.length;
    this.setStatus(
      `CSV-Datei mit ${integerFormat.format(groups.length)} ${groups.length === 1 ? 'Zeile' : 'Zeilen'} erstellt (${integerFormat.format(groups.length)} von ${integerFormat.format(total)} ${this.noun(total)}).`,
      true,
    );
  }

  /** Hebt die Zeile hervor, blättert bei Bedarf auf ihre Seite; `false`, wenn sie nicht hierher gehört. */
  reveal(target: Element): boolean {
    const row = target.closest('tr');
    if (!row || !this.table.contains(row)) return false;
    const group = this.groupByRow.get(row as HTMLTableRowElement);
    if (group && !group.visible) {
      this.resetFilters();
      this.render();
      this.setStatus('Suche und Filter wurden zurückgesetzt, um die verlinkte Zeile zu zeigen.', true);
    }
    if (group && !group.shown && this.pageSize > 0) {
      const position = this.matchingGroups().indexOf(group);
      if (position >= 0) {
        this.page = Math.floor(position / this.pageSize) + 1;
        this.render();
      }
    }
    const focusRow = group ? group.main : (row as HTMLTableRowElement);
    this.lastTarget?.classList.remove('is-ziel');
    focusRow.classList.add('is-ziel');
    this.lastTarget = focusRow;
    if (!focusRow.hasAttribute('tabindex')) focusRow.tabIndex = -1;
    const rect = focusRow.getBoundingClientRect();
    const headHeight = this.wrap?.classList.contains('is-ohne-scroll') ? this.table.tHead?.getBoundingClientRect().height ?? 0 : 0;
    const inView = rect.top >= stickyOffset() + headHeight && rect.bottom <= window.innerHeight;
    if (!inView) focusRow.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    focusRow.focus({ preventScroll: true });
    return true;
  }

  contains(element: Element): boolean {
    return this.root.contains(element);
  }

  /** Scrollbarkeit, Schatten, Hinweis und haftender Kopf folgen der tatsächlichen Breite. */
  private observeLayout() {
    const wrap = this.wrap;
    if (!wrap) return;
    const update = () => {
      this.layoutFrame = 0;
      const overflow = this.table.getBoundingClientRect().width > wrap.clientWidth + 1;
      wrap.classList.toggle('is-ohne-scroll', !overflow);
      wrap.tabIndex = overflow ? 0 : -1;
      if (this.scrollHint) {
        this.scrollHint.hidden = !overflow;
        if (overflow && this.scrollHint.id) wrap.setAttribute('aria-describedby', this.scrollHint.id);
        else wrap.removeAttribute('aria-describedby');
      }
      this.root.style.setProperty('--hh-kopf-oben', `${stickyOffset()}px`);
    };
    const schedule = () => {
      if (!this.layoutFrame) this.layoutFrame = window.requestAnimationFrame(update);
    };
    update();
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      observer.observe(wrap);
      observer.observe(this.table);
    }
    window.addEventListener('resize', schedule, { passive: true });
  }
}

/**
 * Kantenschatten für jeden Scrollbereich `[data-tabelle-rahmen] > .table-wrap` (Haushaltstabellen
 * und Diagrammtabellen): `data-scroll-links`/`data-scroll-rechts`, solange dort Spalten verdeckt
 * sind.
 */
function watchScrollFrame(frame: HTMLElement) {
  if (frame.dataset.tabelleRahmenBereit) return;
  const wrap = frame.querySelector<HTMLElement>(':scope > .table-wrap');
  if (!wrap) return;
  frame.dataset.tabelleRahmenBereit = 'true';
  let pending = 0;
  const update = () => {
    pending = 0;
    const max = wrap.scrollWidth - wrap.clientWidth;
    const scrollable = !wrap.classList.contains('is-ohne-scroll') && max > 1;
    frame.toggleAttribute('data-scroll-links', scrollable && wrap.scrollLeft > 1);
    frame.toggleAttribute('data-scroll-rechts', scrollable && wrap.scrollLeft < max - 1);
  };
  const schedule = () => {
    if (!pending) pending = window.requestAnimationFrame(update);
  };
  update();
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(schedule);
    observer.observe(wrap);
    const table = wrap.querySelector('table');
    if (table) observer.observe(table);
  }
  wrap.addEventListener('scroll', schedule, { passive: true });
  // Aufklapper: beim Öffnen erstmals messbar.
  frame.closest('details')?.addEventListener('toggle', schedule);
}

const instances: HaushaltTabelle[] = [];

function revealHash() {
  const raw = window.location.hash.slice(1);
  if (!raw) return;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // Unlesbarer Anker: unverändert verwenden.
  }
  const target = document.getElementById(id);
  if (!target) return;
  for (const instance of instances) {
    if (instance.contains(target) && instance.reveal(target)) return;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Weiter mit der Auswahl als Rückfall.
  }
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.className = 'visually-hidden';
  document.body.append(field);
  field.select();
  let copied = false;
  // Rückfall für Umgebungen ohne Zwischenablage-API (unsicherer Kontext); nur wenn vorhanden.
  const execCommand = (document as unknown as { execCommand?: (command: string) => boolean }).execCommand;
  try {
    copied = typeof execCommand === 'function' ? execCommand.call(document, 'copy') : false;
  } catch {
    copied = false;
  }
  field.remove();
  previous?.focus({ preventScroll: true });
  return copied;
}

function setupLinkButtons() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-haushalt-link]'));
  buttons.forEach((button) => {
    button.hidden = false;
  });
  if (buttons.length === 0) return;
  document.addEventListener('click', async (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-haushalt-link]');
    if (!button) return;
    const anchor = button.dataset.haushaltLink ?? '';
    const url = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(anchor)}`;
    const copied = await copyText(url);
    const message = copied ? 'Link in die Zwischenablage kopiert.' : `Link konnte nicht kopiert werden: ${url}`;
    const instance = instances.find((entry) => entry.contains(button));
    if (instance) instance.setStatus(message, true);
    else announceGlobally(message);
    const visible = button.querySelector<HTMLElement>('[aria-hidden="true"]');
    if (visible && copied) {
      const original = visible.textContent;
      visible.textContent = 'Kopiert';
      window.setTimeout(() => {
        visible.textContent = original;
      }, 2000);
    }
  });
}

function init() {
  document.querySelectorAll<HTMLElement>(ROOT_SELECTOR).forEach((root) => {
    if (root.dataset.haushaltTabelleBereit) return;
    const table = root.querySelector<HTMLTableElement>('table');
    if (!table) return;
    root.dataset.haushaltTabelleBereit = 'true';
    instances.push(new HaushaltTabelle(root, table));
  });
  document.querySelectorAll<HTMLElement>('[data-tabelle-rahmen]').forEach(watchScrollFrame);
  setupLinkButtons();
  revealHash();
  window.addEventListener('hashchange', revealHash);
  // Zum Drucken alle Zeilen der Auswahl zeigen, danach wieder blättern.
  window.addEventListener('beforeprint', () => {
    instances.forEach((instance) => {
      instance.showAll = true;
      instance.render();
    });
  });
  window.addEventListener('afterprint', () => {
    instances.forEach((instance) => {
      instance.showAll = false;
      instance.render();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
