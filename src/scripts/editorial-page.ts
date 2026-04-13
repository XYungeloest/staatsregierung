import {
  buildNewNormResult,
  buildNewVersionResult,
  getBodyTemplate,
  type EditorialBootstrapData,
  type GeneratedFile,
  type NewNormInput,
  type NewVersionInput,
} from '../lib/editorial/tooling.ts';

const root = document.querySelector<HTMLElement>('[data-editorial-root]');

if (root) {
  const bootstrapElement = document.getElementById('editorial-bootstrap');
  const bootstrapText = bootstrapElement?.textContent ?? '{}';
  const bootstrap = JSON.parse(bootstrapText) as EditorialBootstrapData;
  const feedback = root.querySelector<HTMLElement>('[data-editorial-feedback]');
  const outputSection = root.querySelector<HTMLElement>('[data-editorial-output]');
  const outputSummary = root.querySelector<HTMLElement>('[data-editorial-output-summary]');
  const fileList = root.querySelector<HTMLElement>('[data-editorial-file-list]');
  const newNormForm = root.querySelector<HTMLFormElement>('[data-editorial-form="new-norm"]');
  const newVersionForm = root.querySelector<HTMLFormElement>('[data-editorial-form="new-version"]');
  const modeInputs = Array.from(root.querySelectorAll<HTMLInputElement>('[data-editorial-mode]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-editorial-panel]'));
  const existingNormSelect = root.querySelector<HTMLSelectElement>('[data-editorial-existing-norm]');
  const existingSummary = root.querySelector<HTMLElement>('[data-editorial-existing-summary]');
  const dateFormatter = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function formatDate(value: string): string {
    const [year, month, day] = value.split('-').map((entry) => Number.parseInt(entry, 10));
    return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
  }

  function getSelectedMode(): string {
    return modeInputs.find((input) => input.checked)?.value ?? 'new-norm';
  }

  function setFeedback(message: string, variant: 'default' | 'success' | 'error' = 'default'): void {
    if (!feedback) {
      return;
    }

    feedback.classList.remove('editorial-feedback--success', 'editorial-feedback--error');

    if (variant === 'success') {
      feedback.classList.add('editorial-feedback--success');
    }

    if (variant === 'error') {
      feedback.classList.add('editorial-feedback--error');
    }

    feedback.textContent = message;
  }

  function applyMode(): void {
    const currentMode = getSelectedMode();

    for (const panel of panels) {
      const panelMode = panel.dataset.editorialPanel;
      if (!panelMode) {
        continue;
      }

      if (panelMode === 'new-norm' || panelMode === 'new-version') {
        panel.hidden = panelMode !== currentMode;
      }
    }
  }

  function renderExistingNormSummary(): void {
    if (!(existingSummary instanceof HTMLElement) || !(existingNormSelect instanceof HTMLSelectElement)) {
      return;
    }

    const selected = bootstrap.norms.find((record) => record.meta.slug === existingNormSelect.value);
    if (!selected) {
      existingSummary.textContent = 'Wählen Sie eine bestehende Norm, um die vorhandenen Fassungen anzuzeigen.';
      return;
    }

    const versions = [...selected.versions]
      .sort((left, right) => right.validFrom.localeCompare(left.validFrom))
      .map((version) => {
        const range = version.validTo
          ? `${formatDate(version.validFrom)} bis ${formatDate(version.validTo)}`
          : `seit ${formatDate(version.validFrom)}`;
        return `<li><strong>${escapeHtml(version.versionId)}</strong> – ${escapeHtml(range)}${version.isCurrent ? ' (aktuell)' : ''}</li>`;
      })
      .join('');

    existingSummary.innerHTML = `
      <p><strong>${escapeHtml(selected.meta.title)}</strong></p>
      <p>${escapeHtml(selected.meta.abbr)} | ${escapeHtml(selected.meta.ministry)}</p>
      <p>Vorhandene Fassungen:</p>
      <ul class="editorial-version-list">${versions}</ul>
    `;
  }

  function setTextareaValue(form: HTMLFormElement | null, name: string, value: string): void {
    const field = form?.elements.namedItem(name);
    if (field instanceof HTMLTextAreaElement) {
      field.value = value;
    }
  }

  function getCurrentBodyTemplate(): string | null {
    if (!(existingNormSelect instanceof HTMLSelectElement)) {
      return null;
    }

    const selected = bootstrap.norms.find((record) => record.meta.slug === existingNormSelect.value);
    const currentVersion = selected?.versions.find((entry) => entry.isCurrent) ?? selected?.versions.at(-1);
    return currentVersion ? `${JSON.stringify(currentVersion.body, null, 2)}\n` : null;
  }

  function renderFiles(resultFiles: GeneratedFile[], summaryText: string): void {
    if (!(outputSection instanceof HTMLElement) || !(outputSummary instanceof HTMLElement) || !(fileList instanceof HTMLElement)) {
      return;
    }

    outputSection.hidden = false;
    outputSummary.textContent = summaryText;
    fileList.innerHTML = resultFiles
      .map(
        (file, index) => `
          <article class="editorial-file panel">
            <div class="editorial-file__header">
              <div>
                <h3>${escapeHtml(file.label)}</h3>
                <p class="detail-line">${escapeHtml(file.path)}</p>
                <p class="detail-line">${escapeHtml(file.description)}</p>
              </div>
              <div class="editorial-file__actions">
                <button class="button-link button-link--secondary" type="button" data-editorial-copy="${index}">JSON kopieren</button>
                <button class="button-link button-link--secondary" type="button" data-editorial-download="${index}">Datei herunterladen</button>
              </div>
            </div>
            <pre class="editorial-code"><code>${escapeHtml(file.content)}</code></pre>
          </article>
        `,
      )
      .join('');

    fileList.dataset.editorialFiles = JSON.stringify(resultFiles);
  }

  async function copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.append(textarea);
    textarea.select();
    const execCommand = Reflect.get(document, 'execCommand') as
      | ((commandId: string, showUI?: boolean, value?: string) => boolean)
      | undefined;
    const copied = execCommand ? execCommand.call(document, 'copy') : false;
    textarea.remove();

    if (!copied) {
      throw new Error('Die Zwischenablage ist in diesem Browser nicht verfügbar.');
    }
  }

  function downloadFile(file: GeneratedFile): void {
    const blob = new Blob([file.content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.path.split('/').at(-1) ?? file.label;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function readNewNormInput(): NewNormInput {
    if (!(newNormForm instanceof HTMLFormElement)) {
      throw new Error('Das Formular für neue Normen wurde nicht gefunden.');
    }

    const formData = new FormData(newNormForm);

    return {
      id: String(formData.get('id') ?? '').trim(),
      slug: String(formData.get('slug') ?? '').trim(),
      title: String(formData.get('title') ?? '').trim(),
      shortTitle: String(formData.get('shortTitle') ?? '').trim(),
      abbr: String(formData.get('abbr') ?? '').trim(),
      type: String(formData.get('type') ?? '').trim() as NewNormInput['type'],
      ministry: String(formData.get('ministry') ?? '').trim(),
      subjectsText: String(formData.get('subjectsText') ?? '').trim(),
      keywordsText: String(formData.get('keywordsText') ?? '').trim(),
      initialCitation: String(formData.get('initialCitation') ?? '').trim(),
      summary: String(formData.get('summary') ?? '').trim(),
      status: String(formData.get('status') ?? '').trim() as NewNormInput['status'],
      versionId: String(formData.get('versionId') ?? '').trim(),
      validFrom: String(formData.get('validFrom') ?? '').trim(),
      validTo: String(formData.get('validTo') ?? '').trim(),
      isCurrent: formData.get('isCurrent') === 'on',
      citation: String(formData.get('citation') ?? '').trim(),
      changeNote: String(formData.get('changeNote') ?? '').trim(),
      bodyText: String(formData.get('bodyText') ?? '').trim(),
    };
  }

  function readNewVersionInput(): NewVersionInput {
    if (!(newVersionForm instanceof HTMLFormElement)) {
      throw new Error('Das Formular für neue Fassungen wurde nicht gefunden.');
    }

    const formData = new FormData(newVersionForm);

    return {
      normSlug: String(formData.get('normSlug') ?? '').trim(),
      versionId: String(formData.get('versionId') ?? '').trim(),
      validFrom: String(formData.get('validFrom') ?? '').trim(),
      validTo: String(formData.get('validTo') ?? '').trim(),
      isCurrent: formData.get('isCurrent') === 'on',
      citation: String(formData.get('citation') ?? '').trim(),
      changeNote: String(formData.get('changeNote') ?? '').trim(),
      bodyText: String(formData.get('bodyText') ?? '').trim(),
      createHistoryEntry: formData.get('createHistoryEntry') === 'on',
      historyTitle: String(formData.get('historyTitle') ?? '').trim(),
      historyNote: String(formData.get('historyNote') ?? '').trim(),
    };
  }

  function handleSuccess(summaryText: string, warnings: string[], files: GeneratedFile[]): void {
    const fullSummary =
      warnings.length > 0 ? `${summaryText} Hinweise: ${warnings.join(' ')}` : summaryText;
    renderFiles(files, fullSummary);
    setFeedback(fullSummary, 'success');
  }

  for (const input of modeInputs) {
    input.addEventListener('change', applyMode);
  }

  existingNormSelect?.addEventListener('change', renderExistingNormSummary);
  renderExistingNormSummary();
  applyMode();

  root.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const template = target.dataset.editorialTemplate;
    if (template === 'new-norm-law') {
      setTextareaValue(newNormForm, 'bodyText', getBodyTemplate('law'));
    }

    if (template === 'new-norm-directive') {
      setTextareaValue(newNormForm, 'bodyText', getBodyTemplate('directive'));
    }

    if (template === 'new-norm-empty') {
      setTextareaValue(newNormForm, 'bodyText', getBodyTemplate('empty'));
    }

    if (template === 'existing-law') {
      setTextareaValue(newVersionForm, 'bodyText', getBodyTemplate('law'));
    }

    if (template === 'existing-directive') {
      setTextareaValue(newVersionForm, 'bodyText', getBodyTemplate('directive'));
    }

    if (template === 'existing-current') {
      const currentBody = getCurrentBodyTemplate();
      if (!currentBody) {
        setFeedback(
          'Für die ausgewählte Norm konnte keine aktuelle Fassung als Vorlage geladen werden.',
          'error',
        );
        return;
      }

      setTextareaValue(newVersionForm, 'bodyText', currentBody);
    }

    const copyIndex = target.dataset.editorialCopy;
    const downloadIndex = target.dataset.editorialDownload;
    const storedFiles = fileList?.dataset.editorialFiles;
    const files = storedFiles ? (JSON.parse(storedFiles) as GeneratedFile[]) : [];

    if (copyIndex !== undefined) {
      const file = files[Number.parseInt(copyIndex, 10)];
      if (!file) {
        return;
      }

      try {
        await copyText(file.content);
        setFeedback(`"${file.label}" wurde in die Zwischenablage kopiert.`, 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Die Datei konnte nicht kopiert werden.';
        setFeedback(message, 'error');
      }
    }

    if (downloadIndex !== undefined) {
      const file = files[Number.parseInt(downloadIndex, 10)];
      if (!file) {
        return;
      }

      downloadFile(file);
      setFeedback(`"${file.label}" wurde zum Download bereitgestellt.`, 'success');
    }
  });

  newNormForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
      const result = buildNewNormResult(readNewNormInput(), bootstrap.norms);
      handleSuccess(result.summary, result.warnings, result.files);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Die Eingaben konnten nicht verarbeitet werden.';
      setFeedback(message, 'error');
      outputSection?.setAttribute('hidden', 'true');
    }
  });

  newVersionForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
      const result = buildNewVersionResult(readNewVersionInput(), bootstrap.norms);
      handleSuccess(result.summary, result.warnings, result.files);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Die Eingaben konnten nicht verarbeitet werden.';
      setFeedback(message, 'error');
      outputSection?.setAttribute('hidden', 'true');
    }
  });

  newNormForm?.addEventListener('reset', () => {
    window.setTimeout(() => {
      setFeedback('Das Formular für neue Normen wurde zurückgesetzt.');
      outputSection?.setAttribute('hidden', 'true');
    }, 0);
  });

  newVersionForm?.addEventListener('reset', () => {
    window.setTimeout(() => {
      renderExistingNormSummary();
      setFeedback('Das Formular für neue Fassungen wurde zurückgesetzt.');
      outputSection?.setAttribute('hidden', 'true');
    }, 0);
  });
}
