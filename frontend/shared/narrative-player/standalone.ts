/**
 * Story Graph — standalone spiller (vanilla DOM, ingen React).
 *
 * Bygges til `client/public/embed/narrative-player.js` som IIFE med
 * global `StoryGraphPlayer` (`npm run build:narrative-player`). Brukes av
 * standalone HTML-eksporten. Motoren er den delte `createPlaySession`.
 */

import { createPlaySession, type PlaySession, type PlayView } from '../narrative-runtime';
import type { RuntimeGraph } from '../narrative-runtime/types';
import { sanitizeHtml, textOf } from './sanitize';

export interface MountOptions {
  title?: string;
  debug?: boolean;
  labels?: Partial<PlayerLabels>;
}

export interface PlayerLabels {
  restart: string;
  back: string;
  start: string;
  noStart: string;
  end: string;
  branchEnd: string;
  continueLabel: string;
  debugVariables: string;
  debugVisits: string;
  debugLog: string;
  scriptError: string;
  runtimeError: string;
  empty: string;
}

const DEFAULT_LABELS: PlayerLabels = {
  restart: 'Start på nytt',
  back: 'Tilbake',
  start: 'Start',
  noStart: 'Ingen startelement er satt.',
  end: 'Slutt — dette elementet har ingen utganger.',
  branchEnd: 'Forgreningen har ingen utgang som passer.',
  continueLabel: 'Fortsett',
  debugVariables: 'Variabler',
  debugVisits: 'Besøk',
  debugLog: 'Logg',
  scriptError: 'Skriptfeil',
  runtimeError: 'Kjørefeil',
  empty: 'Historien har ingen elementer.',
};

export interface PlayerHandle {
  destroy: () => void;
  session: PlaySession;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mount(root: HTMLElement, graph: RuntimeGraph, options: MountOptions = {}): PlayerHandle {
  const labels: PlayerLabels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const session = createPlaySession(graph);
  const debug = !!options.debug;

  root.innerHTML = '';
  const shell = el('div', 'sgp');
  const bar = el('div', 'sgp-bar');
  const heading = el('h1', undefined, options.title ?? 'Story Graph');
  const restartBtn = el('button', 'sgp-btn', labels.restart);
  const backBtn = el('button', 'sgp-btn', labels.back);
  bar.append(heading, backBtn, restartBtn);
  const body = el('div', 'sgp-body');
  const main = el('div', 'sgp-main');
  const card = el('div', 'sgp-card');
  main.append(card);
  body.append(main);
  const debugPanel = el('aside', 'sgp-debug');
  if (debug) body.append(debugPanel);
  shell.append(bar, body);
  root.append(shell);

  restartBtn.addEventListener('click', () => { session.restart(); render(); });
  backBtn.addEventListener('click', () => { session.back(); render(); });

  function renderDebug(view: PlayView | null): void {
    if (!debug) return;
    debugPanel.innerHTML = '';
    const state = session.getState();
    debugPanel.append(el('h2', undefined, labels.debugVariables));
    const table = el('table');
    for (const def of session.getVariableDefs()) {
      const tr = el('tr');
      const name = el('td', undefined, def.name);
      const valueCell = el('td');
      const input = el('input');
      input.value = String(state.variables[def.name] ?? '');
      input.setAttribute('data-variable', def.name);
      input.addEventListener('change', () => {
        const raw = input.value;
        const value = def.type === 'bool' ? raw === 'true' || raw === '1'
          : def.type === 'int' ? Math.trunc(Number(raw) || 0)
            : def.type === 'float' ? Number(raw) || 0 : raw;
        session.setVariable(def.name, value);
        render();
      });
      valueCell.append(input);
      tr.append(name, valueCell);
      table.append(tr);
    }
    debugPanel.append(table);
    debugPanel.append(el('h2', undefined, labels.debugVisits));
    const visits = el('table');
    for (const [id, count] of Object.entries(state.visits)) {
      const e = graph.elements.find((x) => x.id === id);
      const tr = el('tr');
      tr.append(el('td', undefined, e ? textOf(e.titleHtml) || id : id), el('td', undefined, String(count)));
      visits.append(tr);
    }
    debugPanel.append(visits);
    debugPanel.append(el('h2', undefined, labels.debugLog));
    const log = el('div', 'sgp-log');
    log.textContent = state.log.slice(-30).map((l) => `${l.step}. ${l.kind}: ${l.message}`).join('\n');
    debugPanel.append(log);
    void view;
  }

  function render(): void {
    const view = session.current();
    card.innerHTML = '';
    backBtn.disabled = !session.canBack();

    if (!view) {
      if (graph.elements.length === 0) {
        card.append(el('p', 'sgp-title', labels.empty));
      } else if (!graph.settings.startingElementId) {
        card.append(el('p', 'sgp-title', labels.noStart));
      } else {
        const startBtn = el('button', 'sgp-btn sgp-primary', labels.start);
        startBtn.addEventListener('click', () => { session.start(); render(); });
        card.append(startBtn);
      }
      renderDebug(null);
      return;
    }

    const head = el('div', 'sgp-title');
    if (view.speakerName) head.append(el('span', 'sgp-speaker', view.speakerName));
    head.append(document.createTextNode(textOf(view.element.titleHtml) || ''));
    card.append(head);

    const content = el('div', 'sgp-content');
    content.innerHTML = sanitizeHtml(view.html) || '<p><em>—</em></p>';
    card.append(content);

    const state = session.getState();
    const errors = state.log.filter((l) => l.elementId === view.elementId && l.errors.length > 0).flatMap((l) => l.errors);
    if (errors.length) {
      const box = el('div', 'sgp-errors');
      for (const e of errors) box.append(el('div', undefined, `${e.kind === 'parse' ? labels.scriptError : labels.runtimeError}: ${e.message}`));
      card.append(box);
    }

    const options = el('div', 'sgp-options');
    view.options.forEach((opt, i) => {
      const label = textOf(opt.labelHtml) || `${labels.continueLabel}${view.options.length > 1 ? ` (${i + 1})` : ''}`;
      const btn = el('button', 'sgp-option', label);
      btn.setAttribute('data-connection', opt.connectionId);
      btn.addEventListener('click', () => { session.choose(opt.connectionId); render(); main.scrollTop = 0; });
      options.append(btn);
    });
    if (view.deadEnd) options.append(el('div', 'sgp-end', view.element.kind === 'branch' ? labels.branchEnd : labels.end));
    card.append(options);
    renderDebug(view);
  }

  session.start();
  render();

  return {
    session,
    destroy: () => { root.innerHTML = ''; },
  };
}
