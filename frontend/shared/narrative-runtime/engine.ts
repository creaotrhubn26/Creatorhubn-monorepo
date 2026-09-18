/**
 * Story Graph — spillmotor (Play Mode). Ren TS, ingen React/DOM.
 *
 * Regler (som Arcweave):
 *  - Ankomst til element: visits++ først, deretter kjøres innholdets skript.
 *  - Jumper følges automatisk (sløyfevakt).
 *  - Forgrening rutes automatisk til første sanne betingelse (script null = else)
 *    via koblingen med sourceOutputKey = betingelsens id. Ingen treff → blindvei.
 *  - Utgående koblinger fra et element er spillerens valg. Etikett-skript kjøres
 *    når valget tas (tilordninger), ikke ved visning.
 */

import {
  createInterpreter, hasScript, stripCodeBlocks,
  type Interpreter, type ScriptError, type ScriptValue,
} from '../narrative-script';
import { buildResolvers, buildScriptVariables } from './scope';
import type { RuntimeConnection, RuntimeElement, RuntimeGraph } from './types';

export interface PlayOption {
  connectionId: string;
  targetId: string;
  /** Etikett-HTML uten kodeblokker (til visning). */
  labelHtml: string;
  hasScript: boolean;
}

export interface PlayView {
  elementId: string;
  boardId: string;
  element: RuntimeElement;
  /** Rendret innhold (betingede seksjoner filtrert, show() lagt inn, kodeblokker fjernet). */
  html: string;
  options: PlayOption[];
  /** Ingen utganger (element uten koblinger, eller forgrening uten treff). */
  deadEnd: boolean;
  /** Navn på første festede komponent (taler for TTS). */
  speakerName: string | null;
  componentNames: string[];
}

export interface PlayLogEntry {
  step: number;
  kind: 'enter' | 'choose' | 'branch' | 'jumper' | 'restart' | 'set';
  elementId: string | null;
  message: string;
  changes: Record<string, ScriptValue>;
  errors: ScriptError[];
}

export interface PlayState {
  variables: Record<string, ScriptValue>;
  visits: Record<string, number>;
  historyDepth: number;
  log: PlayLogEntry[];
}

export interface PlaySession {
  start: () => PlayView | null;
  current: () => PlayView | null;
  choose: (connectionId: string) => PlayView | null;
  back: () => PlayView | null;
  canBack: () => boolean;
  restart: () => PlayView | null;
  setVariable: (name: string, value: ScriptValue) => void;
  getState: () => PlayState;
  /** Deklarerte variabler med type (til debugger). */
  getVariableDefs: () => Array<{ name: string; type: string }>;
}

/**
 * Fase 8e: hendelser fra spilløkta (til spilltest-telemetri). Samme hendelser som loggen
 * (enter/choose/branch/jumper/restart/set) pluss `back`, som ikke logges. Kalleren
 * (spill, standalone-spiller, iPad-runtime) velger selv hva som sendes videre.
 */
export interface PlayEvent {
  kind: PlayLogEntry['kind'] | 'back';
  elementId: string | null;
  /** Valgt kobling (kun `choose`). */
  connectionId?: string;
  /** Mål-element (kun `choose`/`jumper`/`branch` når kjent). */
  targetId?: string;
  step: number;
  changes: Record<string, ScriptValue>;
  errorCount: number;
  message: string;
}

export interface PlaySessionOptions {
  rng?: () => number;
  startElementId?: string | null;
  maxJumps?: number;
  maxLog?: number;
  /** Fase 8e: kalles etter hver loggført hendelse + `back`. Feil i callbacken svelges (motoren skal aldri stoppe spillet). */
  onEvent?: (event: PlayEvent) => void;
}

interface Snapshot {
  elementId: string;
  variables: Record<string, ScriptValue>;
  visits: Record<string, number>;
  logLength: number;
}

const MAX_HISTORY = 200;

export function createPlaySession(graph: RuntimeGraph, options: PlaySessionOptions = {}): PlaySession {
  const maxJumps = options.maxJumps ?? 100;
  const maxLog = options.maxLog ?? 500;
  const variableDefs = buildScriptVariables(graph);
  const resolvers = buildResolvers(graph, variableDefs);
  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const connectionsBySource = new Map<string, RuntimeConnection[]>();
  for (const c of [...graph.connections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    const list = connectionsBySource.get(c.sourceId) ?? [];
    list.push(c);
    connectionsBySource.set(c.sourceId, list);
  }
  const componentName = new Map(graph.components.map((c) => [c.id, c.name]));
  const componentsByElement = new Map<string, string[]>();
  for (const ec of [...graph.elementComponents].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    const list = componentsByElement.get(ec.elementId) ?? [];
    const name = componentName.get(ec.componentId);
    if (name) list.push(name);
    componentsByElement.set(ec.elementId, list);
  }

  let interpreter: Interpreter = makeInterpreter();
  let view: PlayView | null = null;
  let history: Snapshot[] = [];
  let log: PlayLogEntry[] = [];
  let step = 0;

  function makeInterpreter(): Interpreter {
    return createInterpreter({
      variables: variableDefs,
      rng: options.rng,
      resolveMention: resolvers.resolveMention,
      resolveElementRef: resolvers.resolveElementRef,
    });
  }

  function emit(event: PlayEvent): void {
    if (!options.onEvent) return;
    try { options.onEvent(event); } catch { /* telemetri skal aldri stoppe spillet */ }
  }

  function pushLog(entry: Omit<PlayLogEntry, 'step'>, extra: { connectionId?: string; targetId?: string } = {}): void {
    step += 1;
    log.push({ step, ...entry });
    if (log.length > maxLog) log = log.slice(log.length - maxLog);
    emit({ kind: entry.kind, elementId: entry.elementId, step, changes: entry.changes, errorCount: entry.errors.length, message: entry.message, ...extra });
  }

  function startElementId(): string | null {
    const explicit = options.startElementId ?? graph.settings.startingElementId;
    if (explicit && elementById.has(explicit)) return explicit;
    const firstBoard = graph.boards[0]?.id;
    const candidates = graph.elements
      .filter((e) => e.kind === 'element' && (!firstBoard || e.boardId === firstBoard))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return candidates[0]?.id ?? graph.elements.find((e) => e.kind === 'element')?.id ?? null;
  }

  function buildOptions(element: RuntimeElement): PlayOption[] {
    return (connectionsBySource.get(element.id) ?? [])
      .filter((c) => elementById.has(c.targetId))
      .map((c) => ({
        connectionId: c.id,
        targetId: c.targetId,
        labelHtml: stripCodeBlocks(c.labelHtml ?? ''),
        hasScript: hasScript(c.labelHtml),
      }));
  }

  function makeView(element: RuntimeElement, html: string, options: PlayOption[], deadEnd: boolean): PlayView {
    const names = componentsByElement.get(element.id) ?? [];
    return {
      elementId: element.id,
      boardId: element.boardId,
      element,
      html,
      options,
      deadEnd,
      speakerName: names[0] ?? null,
      componentNames: names,
    };
  }

  /** Gå inn i et element; følger jumpere/forgreninger til vi lander på et element (eller blindvei). */
  function enter(elementId: string, depth = 0): PlayView | null {
    const element = elementById.get(elementId);
    if (!element) {
      pushLog({ kind: 'enter', elementId, message: 'Elementet finnes ikke.', changes: {}, errors: [] });
      return view;
    }
    if (depth > maxJumps) {
      pushLog({ kind: 'jumper', elementId, message: `Stoppet: mer enn ${maxJumps} hopp på rad (sløyfe?).`, changes: {}, errors: [] });
      view = makeView(element, '', [], true);
      return view;
    }
    interpreter.setCurrentElement(element.id);
    interpreter.incrementVisit(element.id);

    if (element.kind === 'jumper') {
      const target = element.jumperTargetId;
      pushLog({ kind: 'jumper', elementId: element.id, message: target ? 'Jumper fulgt.' : 'Jumper uten mål.', changes: {}, errors: [] }, target ? { targetId: target } : {});
      if (!target || !elementById.has(target)) {
        view = makeView(element, '', [], true);
        return view;
      }
      return enter(target, depth + 1);
    }

    if (element.kind === 'branch') {
      const errors: ScriptError[] = [];
      let chosen: string | null = null;
      for (const cond of element.branchConditions) {
        let take = false;
        if (cond.script === null || cond.script.trim() === '') {
          take = true;
        } else {
          const r = interpreter.evaluateCondition(cond.script);
          errors.push(...r.errors);
          take = r.value;
        }
        if (take) { chosen = cond.id; break; }
      }
      const outgoing = connectionsBySource.get(element.id) ?? [];
      const next = chosen ? outgoing.find((c) => c.sourceOutputKey === chosen) : undefined;
      pushLog({
        kind: 'branch', elementId: element.id,
        message: chosen ? (next ? 'Forgrening: betingelse traff.' : 'Forgrening: betingelsen traff, men utgangen er ikke koblet.') : 'Forgrening: ingen betingelse traff.',
        changes: {}, errors,
      }, next ? { connectionId: next.id, targetId: next.targetId } : {});
      if (!next || !elementById.has(next.targetId)) {
        view = makeView(element, '', [], true);
        return view;
      }
      return enter(next.targetId, depth + 1);
    }

    const run = interpreter.runScript(element.contentHtml ?? '');
    pushLog({ kind: 'enter', elementId: element.id, message: 'Ankomst.', changes: run.changes, errors: run.errors });
    const opts = buildOptions(element);
    view = makeView(element, run.html, opts, opts.length === 0);
    return view;
  }

  function snapshot(): void {
    if (!view) return;
    history.push({
      elementId: view.elementId,
      variables: interpreter.getVariables(),
      visits: interpreter.getVisits(),
      logLength: log.length,
    });
    if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
  }

  function restoreInterpreter(variables: Record<string, ScriptValue>, visits: Record<string, number>, elementId: string | null): void {
    interpreter = createInterpreter({
      variables: variableDefs.map((v) => ({ ...v, value: variables[v.name] })),
      visits,
      currentElementId: elementId,
      rng: options.rng,
      resolveMention: resolvers.resolveMention,
      resolveElementRef: resolvers.resolveElementRef,
    });
  }

  const session: PlaySession = {
    start: () => {
      interpreter = makeInterpreter();
      history = [];
      log = [];
      step = 0;
      view = null;
      const id = startElementId();
      if (!id) {
        pushLog({ kind: 'enter', elementId: null, message: 'Ingen startelement — legg til et element eller sett startelement.', changes: {}, errors: [] });
        return null;
      }
      return enter(id);
    },
    current: () => view,
    choose: (connectionId) => {
      if (!view) return null;
      const connection = (connectionsBySource.get(view.elementId) ?? []).find((c) => c.id === connectionId);
      if (!connection) return view;
      snapshot();
      if (hasScript(connection.labelHtml)) {
        const r = interpreter.runScript(connection.labelHtml);
        pushLog({ kind: 'choose', elementId: view.elementId, message: 'Valg tatt (etikett-skript kjørt).', changes: r.changes, errors: r.errors }, { connectionId, targetId: connection.targetId });
      } else {
        pushLog({ kind: 'choose', elementId: view.elementId, message: 'Valg tatt.', changes: {}, errors: [] }, { connectionId, targetId: connection.targetId });
      }
      return enter(connection.targetId);
    },
    back: () => {
      const snap = history.pop();
      if (!snap) return view;
      // Gjenopprett tilstand SLIK DEN VAR FØR valget, og re-vis elementet uten å kjøre skriptet på nytt.
      restoreInterpreter(snap.variables, snap.visits, snap.elementId);
      log = log.slice(0, snap.logLength);
      const element = elementById.get(snap.elementId);
      if (!element) { view = null; return null; }
      // Re-rendring uten sideeffekter: kjør på en kopi og forkast endringer.
      const preview = createInterpreter({
        variables: variableDefs.map((v) => ({ ...v, value: snap.variables[v.name] })),
        visits: snap.visits,
        currentElementId: element.id,
        rng: options.rng,
        resolveMention: resolvers.resolveMention,
        resolveElementRef: resolvers.resolveElementRef,
      });
      const opts = buildOptions(element);
      view = makeView(element, preview.runScript(element.contentHtml ?? '').html, opts, opts.length === 0);
      emit({ kind: 'back', elementId: element.id, step, changes: {}, errorCount: 0, message: 'Tilbake.' });
      return view;
    },
    canBack: () => history.length > 0,
    restart: () => {
      const v = session.start();
      pushLog({ kind: 'restart', elementId: v?.elementId ?? null, message: 'Startet på nytt.', changes: {}, errors: [] });
      return v;
    },
    setVariable: (name, value) => {
      interpreter.setVariable(name, value);
      pushLog({ kind: 'set', elementId: view?.elementId ?? null, message: `Debugger: ${name} satt.`, changes: { [name]: interpreter.getVariables()[name] }, errors: [] });
    },
    getState: () => ({
      variables: interpreter.getVariables(),
      visits: interpreter.getVisits(),
      historyDepth: history.length,
      log: [...log],
    }),
    getVariableDefs: () => variableDefs.map((v) => ({ name: v.name, type: v.type })),
  };

  return session;
}
