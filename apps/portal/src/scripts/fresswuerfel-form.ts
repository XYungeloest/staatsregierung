const form = document.querySelector<HTMLFormElement>('#campaign-form');
if (form) {
  const status = document.querySelector<HTMLElement>('#form-status')!;
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  // Bleibt bei Netzwerkfehlern und Wiederholungen stabil. Kein Speichern persönlicher Daten im Browser.
  const requestId = crypto.randomUUID();
  let completed = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (completed || button.disabled) return;
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
    const values = new FormData(form);
    button.disabled = true;
    button.textContent = 'Wird eingereicht …';
    status.textContent = '';
    try {
      values.set('requestId', requestId);
      const response = await fetch(form.dataset.endpoint!, { method: 'POST', body: values });
      const data = await response.json();
      if (!response.ok || typeof data.number !== 'string') {
        status.textContent = data.error || 'Die Einreichung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.';
        for (const [key, error] of Object.entries(data.errors ?? {})) {
          const field = form.elements.namedItem(key) as HTMLInputElement | null;
          field?.setAttribute('aria-invalid', 'true');
          const message = document.getElementById(`${key}-error`);
          if (message) message.textContent = String(error);
        }
        (form.querySelector<HTMLElement>('[aria-invalid=true]') ?? status).focus();
      } else {
        completed = true;
        status.textContent = `Vielen Dank! Ihre Idee wurde gespeichert. Ihre Einreichungsnummer: ${data.number}. Bitte bewahren Sie diese Nummer auf.`;
        form.reset();
        form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(el => { el.disabled = true; });
        status.focus();
      }
    } catch {
      status.textContent = 'Die Einreichung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut. Eine wiederholte Anfrage wird nur einmal gespeichert.';
      status.focus();
    } finally {
      button.disabled = completed;
      button.textContent = completed ? 'Idee gespeichert' : 'Idee einreichen';
    }
  });
}
