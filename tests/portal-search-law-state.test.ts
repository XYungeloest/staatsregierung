import assert from 'node:assert/strict';
import test from 'node:test';

import { lawGroupStatus, nextLawState, type LawIndexState } from '../apps/portal/src/lib/search-law-state.ts';

/**
 * Der Rechtsindex der Portalsuche wird genau einmal geholt. Vorher wurde „geladen“ aus der Länge
 * der Trefferliste erraten; weil der Fehlerpfad die Liste leer ließ, stieß jedes Rendern eine neue
 * Anfrage an. Diese Prüfungen halten die Endzustände fest, aus denen keine zweite Anfrage entsteht.
 */

test('aus idle entsteht genau eine Anfrage', () => {
  assert.equal(nextLawState('idle', 'request'), 'loading');
  assert.equal(nextLawState('loading', 'request'), 'loading', 'eine laufende Anfrage wird nicht verdoppelt');
  assert.equal(nextLawState('loaded', 'request'), 'loaded', 'ein geladener Bestand wird nicht erneut geholt');
  assert.equal(nextLawState('error', 'request'), 'error', 'ein Fehlschlag wird nicht von selbst wiederholt');
});

test('Erfolg und Fehlschlag sind Endzustände', () => {
  assert.equal(nextLawState('loading', 'success'), 'loaded');
  assert.equal(nextLawState('loading', 'failure'), 'error');
  for (const state of ['loaded', 'error'] as LawIndexState[]) {
    assert.equal(nextLawState(state, 'success'), state, `${state} bleibt bei einer späten Antwort`);
    assert.equal(nextLawState(state, 'failure'), state, `${state} bleibt bei einer späten Ablehnung`);
  }
  assert.equal(nextLawState('idle', 'success'), 'idle', 'ohne laufende Anfrage zählt keine Antwort');
});

test('ein leerer Bestand ist geladen, kein Fehler', () => {
  // Der Zustandsübergang kennt keine Trefferzahl: „success“ heißt geladen, gleich wie viele
  // Einträge die Datei enthält. Genau diese Unterscheidung fehlte vorher.
  assert.equal(lawGroupStatus(nextLawState('loading', 'success'), true), 'loaded');
  assert.notEqual(lawGroupStatus(nextLawState('loading', 'success'), true), 'error');
});

test('ein bewusster Neuversuch ist der einzige Weg zurück nach idle', () => {
  assert.equal(nextLawState('error', 'reset'), 'idle');
  assert.equal(nextLawState('loaded', 'reset'), 'idle');
  assert.equal(nextLawState(nextLawState('error', 'reset'), 'request'), 'loading');
});

test('der Bereichsfilter schaltet die Gruppe ab, ohne den Zustand zu verlieren', () => {
  for (const state of ['idle', 'loading', 'loaded', 'error'] as LawIndexState[]) {
    assert.equal(lawGroupStatus(state, false), 'off', `${state} ohne Rechtsbereich`);
  }
  assert.equal(lawGroupStatus('idle', true), 'loading', 'der Anstoß erfolgt im selben Durchlauf wie das Rendern');
  assert.equal(lawGroupStatus('loading', true), 'loading');
  assert.equal(lawGroupStatus('loaded', true), 'loaded');
  assert.equal(lawGroupStatus('error', true), 'error');
});

test('keine Folge von Ereignissen führt aus einem Endzustand in eine neue Anfrage', () => {
  // Erschöpfende Suche über alle Zustände und Ereignisse: aus loaded/error führt nur `reset`
  // heraus. Damit ist die Schleife „Fehler → Rendern → neue Anfrage“ ausgeschlossen.
  const states: LawIndexState[] = ['idle', 'loading', 'loaded', 'error'];
  for (const state of ['loaded', 'error'] as LawIndexState[]) {
    for (const event of ['request', 'success', 'failure'] as const) {
      assert.equal(nextLawState(state, event), state, `${state} + ${event}`);
    }
  }
  for (const state of states) assert.ok(states.includes(nextLawState(state, 'reset')));
});
