/**
 * Zustand des nachgeladenen Rechtsindex in der Portalsuche.
 *
 * Der Rechtsbestand liegt in einer eigenen Datei und wird erst geholt, wenn der Bereichsfilter ihn
 * einschließt und tatsächlich gesucht wird. Vorher wurde „geladen“ aus der Länge der Trefferliste
 * erraten: eine leere Liste hieß „steht noch aus“, und weil der Fehlerpfad die Liste ebenfalls leer
 * ließ, stieß jedes Rendern eine neue Anfrage an – bei einem Ausfall ohne Ende, und ein legitim
 * leerer Bestand war von einem Ausfall nicht zu unterscheiden.
 *
 * Der Zustand wird deshalb geführt, nicht abgeleitet. `loaded` und `error` sind Endzustände: eine
 * Wiederholung entsteht nie von selbst, sondern nur durch eine bewusste Bedienung, die den Zustand
 * ausdrücklich zurücksetzt (`reset`). Die Übergänge stehen hier ohne DOM, damit sie ohne Browser
 * geprüft werden können (`tests/portal-search-law-state.test.ts`).
 */

export type LawIndexState = 'idle' | 'loading' | 'loaded' | 'error';

export type LawIndexEvent = 'request' | 'success' | 'failure' | 'reset';

/** Sichtbarer Zustand der Gruppe „Recht“; `off` heißt: der Bereichsfilter schließt Recht aus. */
export type LawGroupStatus = 'off' | 'loading' | 'loaded' | 'error';

export function nextLawState(current: LawIndexState, event: LawIndexEvent): LawIndexState {
  if (event === 'reset') return 'idle';
  // Nur aus `idle` heraus entsteht eine Anfrage; das ersetzt die Merkung der laufenden Zusage.
  if (event === 'request') return current === 'idle' ? 'loading' : current;
  // Antworten zählen nur zur laufenden Anfrage: eine verspätete Antwort nach einem `reset` darf
  // einen neuen Lauf nicht überschreiben.
  if (current !== 'loading') return current;
  return event === 'success' ? 'loaded' : 'error';
}

/**
 * Was die Gruppe „Recht“ zeigt. Solange der Bereichsfilter Recht einschließt, gilt `idle` als
 * `loading`: Die Suchseite stößt das Laden im selben Durchlauf an, in dem sie rendert.
 */
export function lawGroupStatus(state: LawIndexState, wantsLaw: boolean): LawGroupStatus {
  if (!wantsLaw) return 'off';
  return state === 'idle' ? 'loading' : state;
}
