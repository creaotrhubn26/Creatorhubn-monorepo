/**
 * Story Graph — tolk. Speiler Arcweaves TS-tolk i form:
 *   createInterpreter({ variables, visits, currentElementId }) →
 *     runScript(html)          → { html, output, changes, errors }
 *     evaluateCondition(script)→ { value, errors }
 * Kaster aldri til kalleren — alle feil samles i `errors`.
 */

import type { Expr, Program, ProgramNode } from './ast';
import {
  RuntimeError, coerceToType, defaultForType, evaluate, execute, truthy,
  type EvalContext, type MentionTarget, type ScriptValue, type ScriptVariableType, type VariableSlot,
} from './evaluator';
import { escapeHtml, segmentContentHtml, type ContentSegment } from './html';
import { ParseError, parseExpression, parseProgram } from './parser';

export interface ScriptVariable {
  name: string;
  type: ScriptVariableType;
  defaultValue: ScriptValue | null | undefined;
  value?: ScriptValue | null;
}

export interface ScriptError {
  kind: 'parse' | 'runtime';
  message: string;
  segmentIndex: number | null;
  offset: number | null;
}

export interface RunResult {
  /** Rendret HTML: html-segmenter der betingede seksjoner er filtrert, kodeblokker fjernet, show()-utskrift lagt inn. */
  html: string;
  /** Kun show()-tekst (ren tekst, uten HTML), i rekkefølge. */
  output: string;
  changes: Record<string, ScriptValue>;
  errors: ScriptError[];
}

export interface ConditionResult {
  value: boolean;
  errors: ScriptError[];
}

export interface InterpreterOptions {
  variables: ScriptVariable[];
  visits?: Record<string, number>;
  currentElementId?: string | null;
  rng?: () => number;
  resolveMention?: (id: string) => MentionTarget | null;
  resolveElementRef?: (ref: string) => string | null;
  maxNodes?: number;
}

export interface Interpreter {
  runScript: (html: string) => RunResult;
  evaluateCondition: (script: string) => ConditionResult;
  getVariables: () => Record<string, ScriptValue>;
  setVariable: (name: string, value: ScriptValue) => void;
  resetVariables: () => void;
  getVisits: () => Record<string, number>;
  incrementVisit: (elementId: string) => number;
  setCurrentElement: (elementId: string | null) => void;
}

function toScriptError(err: unknown): ScriptError {
  if (err instanceof ParseError) return { kind: 'parse', message: err.message, segmentIndex: err.segmentIndex, offset: err.offset };
  if (err instanceof RuntimeError) {
    return { kind: 'runtime', message: err.message, segmentIndex: err.pos?.segmentIndex ?? null, offset: err.pos?.start ?? null };
  }
  return { kind: 'runtime', message: err instanceof Error ? err.message : 'Ukjent feil i skript.', segmentIndex: null, offset: null };
}

export function buildVariableSlots(variables: ScriptVariable[]): Map<string, VariableSlot> {
  const map = new Map<string, VariableSlot>();
  for (const v of variables) {
    const type = v.type;
    const rawDefault = v.defaultValue == null ? defaultForType(type) : v.defaultValue;
    const defaultValue = safeCoerce(type, rawDefault);
    const value = v.value == null ? defaultValue : safeCoerce(type, v.value);
    map.set(v.name, { name: v.name, type, value, defaultValue });
  }
  return map;
}

function safeCoerce(type: ScriptVariableType, value: ScriptValue): ScriptValue {
  try {
    return coerceToType(type, value, null);
  } catch {
    return defaultForType(type);
  }
}

export function createInterpreter(options: InterpreterOptions): Interpreter {
  const variables = buildVariableSlots(options.variables);
  const visits = new Map<string, number>(Object.entries(options.visits ?? {}));
  let currentElementId = options.currentElementId ?? null;
  const rng = options.rng ?? Math.random;
  const resolveMention = options.resolveMention ?? (() => null);
  const resolveElementRef = options.resolveElementRef ?? (() => null);
  const maxNodes = options.maxNodes ?? 10_000;

  const makeContext = (changes: Map<string, ScriptValue>): EvalContext => ({
    variables,
    visits,
    currentElementId,
    rng,
    resolveMention,
    resolveElementRef,
    output: [],
    changes,
    budget: { nodes: 0, maxNodes },
  });

  const renderProgram = (program: Program, ctx: EvalContext, out: string[], errors: ScriptError[], shown: string[]): void => {
    for (const node of program) {
      renderNode(node, ctx, out, errors, shown);
    }
  };

  const renderNode = (node: ProgramNode, ctx: EvalContext, out: string[], errors: ScriptError[], shown: string[]): void => {
    switch (node.type) {
      case 'html':
        out.push(node.html);
        return;
      case 'assignment':
      case 'callStatement': {
        ctx.output = [];
        try {
          execute(node, ctx);
        } catch (err) {
          errors.push(toScriptError(err));
        }
        if (ctx.output.length > 0) {
          const text = ctx.output.join('');
          shown.push(text);
          out.push(`<p class="narrative-show">${escapeHtml(text)}</p>`);
        }
        return;
      }
      case 'if': {
        for (const branch of node.branches) {
          let take = false;
          if (branch.condition === null) {
            take = true;
          } else {
            try {
              take = truthy(evaluate(branch.condition, ctx, 0));
            } catch (err) {
              errors.push(toScriptError(err));
              take = false;
            }
          }
          if (take) {
            renderProgram(branch.body, ctx, out, errors, shown);
            return;
          }
        }
        return;
      }
      default:
        return;
    }
  };

  const runScript = (html: string): RunResult => {
    const errors: ScriptError[] = [];
    const changes = new Map<string, ScriptValue>();
    const segments: ContentSegment[] = segmentContentHtml(html);
    let program: Program;
    try {
      program = parseProgram(segments);
    } catch (err) {
      errors.push(toScriptError(err));
      // Parse-feil: vis html-segmentene som de er, uten skript.
      return {
        html: segments.filter((s) => s.kind === 'html').map((s) => (s as { html: string }).html).join(''),
        output: '',
        changes: {},
        errors,
      };
    }
    const ctx = makeContext(changes);
    const out: string[] = [];
    const shown: string[] = [];
    renderProgram(program, ctx, out, errors, shown);
    return { html: out.join(''), output: shown.join(''), changes: Object.fromEntries(changes), errors };
  };

  const evaluateCondition = (script: string): ConditionResult => {
    const errors: ScriptError[] = [];
    const trimmed = (script ?? '').trim();
    if (!trimmed) return { value: true, errors };
    let expr: Expr;
    try {
      expr = parseExpression(trimmed, 0);
    } catch (err) {
      errors.push(toScriptError(err));
      return { value: false, errors };
    }
    const ctx = makeContext(new Map());
    try {
      return { value: truthy(evaluate(expr, ctx, 0)), errors };
    } catch (err) {
      errors.push(toScriptError(err));
      return { value: false, errors };
    }
  };

  return {
    runScript,
    evaluateCondition,
    getVariables: () => Object.fromEntries(Array.from(variables.values()).map((s) => [s.name, s.value])),
    setVariable: (name, value) => {
      const slot = variables.get(name);
      if (!slot) return;
      slot.value = safeCoerce(slot.type, value);
    },
    resetVariables: () => { for (const slot of variables.values()) slot.value = slot.defaultValue; },
    getVisits: () => Object.fromEntries(visits),
    incrementVisit: (elementId) => {
      const next = (visits.get(elementId) ?? 0) + 1;
      visits.set(elementId, next);
      return next;
    },
    setCurrentElement: (elementId) => { currentElementId = elementId; },
  };
}
