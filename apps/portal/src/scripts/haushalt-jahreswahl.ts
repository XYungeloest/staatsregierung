/**
 * Jahreswahl des Haushaltseinstiegs (/haushalt/): schaltet zwischen den Ansichten einzelner
 * Haushaltsjahre und den Vergleichen um. Fortschreitende Verbesserung: Ohne JavaScript blendet ein
 * <noscript>-Stil alle Ansichten untereinander ein und die Schaltflächen aus.
 *
 * Protokoll:
 * - Wurzel `[data-haushalt-jahreswahl]`
 * - Schaltflächen `button[data-jahreswahl-option="<ansicht>"]` mit `aria-pressed` und
 *   `data-jahreswahl-meldung` (Text der Statusmeldung)
 * - Ansichten `[data-jahreswahl-ansicht="<ansicht>"]`
 * - Statuszeile `[data-jahreswahl-status]` (role=status)
 * - Die gewählte Ansicht wird als `?ansicht=<ansicht>` in die Adresse geschrieben und beim Laden
 *   wiederhergestellt, sofern es sie gibt.
 */

const PARAMETER = 'ansicht';

function initJahreswahl(root: HTMLElement): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-jahreswahl-option]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-jahreswahl-ansicht]'));
  const status = root.querySelector<HTMLElement>('[data-jahreswahl-status]');
  if (buttons.length === 0 || panels.length === 0) return;

  const available = new Set(buttons.map((button) => button.dataset.jahreswahlOption ?? ''));
  const initial = buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.jahreswahlOption ?? buttons[0].dataset.jahreswahlOption ?? '';
  let fromUrl: string | null = null;
  try {
    fromUrl = new URL(window.location.href).searchParams.get(PARAMETER);
  } catch {
    fromUrl = null;
  }
  let selected = fromUrl && available.has(fromUrl) ? fromUrl : initial;

  const render = (announce: boolean) => {
    for (const button of buttons) {
      const active = button.dataset.jahreswahlOption === selected;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('is-active', active);
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.jahreswahlAnsicht !== selected;
    }
    if (status && announce) {
      const button = buttons.find((entry) => entry.dataset.jahreswahlOption === selected);
      status.textContent = button?.dataset.jahreswahlMeldung ?? '';
    }
  };

  const writeUrl = () => {
    try {
      const url = new URL(window.location.href);
      if (selected === initial) url.searchParams.delete(PARAMETER);
      else url.searchParams.set(PARAMETER, selected);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // Ohne History-API bleibt die Adresse unverändert.
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      selected = button.dataset.jahreswahlOption ?? selected;
      render(true);
      writeUrl();
    });
  }

  root.querySelectorAll<HTMLElement>('[data-jahreswahl-steuerung]').forEach((element) => {
    element.hidden = false;
  });
  render(selected !== initial);
}

document.querySelectorAll<HTMLElement>('[data-haushalt-jahreswahl]').forEach(initJahreswahl);
