/**
 * Story Graph — evaluator for uttrykk og setninger.
 *
 * Verdier er `number | string | boolean`. Variabler har deklarert type
 * (bool/int/float/string) og koerseres ved tilordning. Fail-closed: dybde-
 * og nodebudsjett, deling på null og ukjente navn gir RuntimeError.
 */

import type { CallExpr, Expr, SourcePos, Statement } from './ast';

export type ScriptValue = number | string | boolean;
export type ScriptVariableType = 'bool' | 'int' | 'float' | 'string';

export interface VariableSlot {
  name: string;
  type: ScriptVariableType;
  value: ScriptValue;
  defaultValue: ScriptValue;
}

export type MentionTarget =
  | { kind: 'element'; elementId: string }
  | { kind: 'variable'; name: string };

export interface EvalContext {
  variables: Map<string, VariableSlot>;
  visits: Map<string, number>;
  currentElementId: string | null;
  rng: () => number;
  resolveMention: (id: string) => MentionTarget | null;
  /** Løs et element-navn/custom-id (fra identifikator eller streng) til element-id. */
  resolveElementRef: (ref: string) => string | null;
  /** show()-utskrift for gjeldende setning. */
  output: string[];
  changes: Map<string, ScriptValue>;
  budget: { nodes: number; maxNodes: number };
}

export class RuntimeError extends Error {
  constructor(message: string, public readonly pos: SourcePos | null) {
    super(message);
    this.name = 'RuntimeError';
  }
}

const MAX_DEPTH = 64;

export function coerceToType(type: ScriptVariableType, value: ScriptValue, pos: SourcePos | null = null): ScriptValue {
  switch (type) {
    case 'bool': return toBool(value);
    case 'int': return Math.trunc(toNumber(value, pos));
    case 'float': return toNumber(value, pos);
    case 'string': return typeof value === 'string' ? value : formatValue(value);
    default: return value;
  }
}

export function defaultForType(type: ScriptVariableType): ScriptValue {
  switch (type) {
    case 'bool': return false;
    case 'int':
    case 'float': return 0;
    case 'string': return '';
    default: return false;
  }
}

export function formatValue(value: ScriptValue): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  return value;
}

function toBool(value: ScriptValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  return value.length > 0;
}

function toNumber(value: ScriptValue, pos: SourcePos | null): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) throw new RuntimeError(`Kan ikke regne med teksten «${value}».`, pos);
  return n;
}

function looselyEqual(a: ScriptValue, b: ScriptValue): boolean {
  if (typeof a === 'string' || typeof b === 'string') {
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    const numA = typeof a === 'string' ? Number(a) : toNumber(a, null);
    const numB = typeof b === 'string' ? Number(b) : toNumber(b, null);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA === numB;
    return formatValue(a) === formatValue(b);
  }
  return toNumber(a, null) === toNumber(b, null);
}

function compare(a: ScriptValue, b: ScriptValue, pos: SourcePos): number {
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const na = toNumber(a, pos);
  const nb = toNumber(b, pos);
  return na < nb ? -1 : na > nb ? 1 : 0;
}

function tick(ctx: EvalContext, pos: SourcePos): void {
  ctx.budget.nodes += 1;
  if (ctx.budget.nodes > ctx.budget.maxNodes) {
    throw new RuntimeError('Skriptet er for stort (nodebudsjett overskredet).', pos);
  }
}

function readVariable(ctx: EvalContext, name: string, pos: SourcePos): ScriptValue {
  const slot = ctx.variables.get(name);
  if (!slot) throw new RuntimeError(`Ukjent variabel «${name}».`, pos);
  return slot.value;
}

export function writeVariable(ctx: EvalContext, name: string, value: ScriptValue, pos: SourcePos | null): void {
  const slot = ctx.variables.get(name);
  if (!slot) throw new RuntimeError(`Ukjent variabel «${name}» — opprett den under Variabler først.`, pos);
  const coerced = coerceToType(slot.type, value, pos);
  slot.value = coerced;
  ctx.changes.set(name, coerced);
}

/** Element-referanse fra et argument-uttrykk (mention, identifikator som ikke er variabel, streng). */
function elementRefFromArg(ctx: EvalContext, arg: Expr | undefined): string | null {
  if (!arg) return ctx.currentElementId;
  if (arg.type === 'mention') {
    const target = ctx.resolveMention(arg.id);
    if (target?.kind === 'element') return target.elementId;
    throw new RuntimeError('Referansen peker ikke på et element.', arg.pos);
  }
  if (arg.type === 'identifier' && !ctx.variables.has(arg.name)) {
    const id = ctx.resolveElementRef(arg.name);
    if (!id) throw new RuntimeError(`Fant ikke element «${arg.name}».`, arg.pos);
    return id;
  }
  if (arg.type === 'literal' && typeof arg.value === 'string') {
    const id = ctx.resolveElementRef(arg.value);
    if (!id) throw new RuntimeError(`Fant ikke element «${arg.value}».`, arg.pos);
    return id;
  }
  throw new RuntimeError('visits() forventer en element-referanse.', arg.pos);
}

function callBuiltin(ctx: EvalContext, call: CallExpr, depth: number): ScriptValue {
  const argVals = (): ScriptValue[] => call.args.map((a) => evaluate(a, ctx, depth + 1));
  const num = (i: number): number => {
    const arg = call.args[i];
    if (!arg) throw new RuntimeError(`${call.name}() mangler argument ${i + 1}.`, call.pos);
    return toNumber(evaluate(arg, ctx, depth + 1), arg.pos);
  };
  switch (call.name) {
    case 'abs': return Math.abs(num(0));
    case 'sqr': { const x = num(0); return x * x; }
    case 'sqrt': {
      const x = num(0);
      if (x < 0) throw new RuntimeError('sqrt() av negativt tall.', call.pos);
      return Math.sqrt(x);
    }
    case 'round': return Math.round(num(0));
    case 'max': {
      const vals = argVals().map((v, i) => toNumber(v, call.args[i].pos));
      if (vals.length === 0) throw new RuntimeError('max() trenger minst ett argument.', call.pos);
      return Math.max(...vals);
    }
    case 'min': {
      const vals = argVals().map((v, i) => toNumber(v, call.args[i].pos));
      if (vals.length === 0) throw new RuntimeError('min() trenger minst ett argument.', call.pos);
      return Math.min(...vals);
    }
    case 'random': {
      if (call.args.length === 0) return ctx.rng();
      // Utvidelse: random(min, max) → heltall i [min, max]
      const lo = Math.ceil(num(0));
      const hi = Math.floor(call.args.length > 1 ? num(1) : lo);
      if (hi < lo) throw new RuntimeError('random(min, max): max må være ≥ min.', call.pos);
      return lo + Math.floor(ctx.rng() * (hi - lo + 1));
    }
    case 'roll': {
      // roll(sider, antall = 1): sum av antall terningkast med 1..sider
      const sides = Math.max(1, Math.floor(num(0)));
      const count = call.args.length > 1 ? Math.max(1, Math.floor(num(1))) : 1;
      if (count > 1000) throw new RuntimeError('roll(): maks 1000 terninger.', call.pos);
      let sum = 0;
      for (let i = 0; i < count; i += 1) sum += 1 + Math.floor(ctx.rng() * sides);
      return sum;
    }
    case 'visits': {
      const id = elementRefFromArg(ctx, call.args[0]);
      if (!id) return 0;
      return ctx.visits.get(id) ?? 0;
    }
    case 'resetVisits': {
      if (call.args.length === 0) { ctx.visits.clear(); return 0; }
      const id = elementRefFromArg(ctx, call.args[0]);
      if (id) ctx.visits.delete(id);
      return 0;
    }
    case 'show': {
      const text = argVals().map(formatValue).join('');
      ctx.output.push(text);
      return '';
    }
    case 'reset': {
      if (call.args.length === 0) throw new RuntimeError('reset() trenger minst én variabel.', call.pos);
      for (const arg of call.args) {
        let name: string | null = null;
        if (arg.type === 'identifier') name = arg.name;
        else if (arg.type === 'mention') {
          const target = ctx.resolveMention(arg.id);
          if (target?.kind === 'variable') name = target.name;
        } else if (arg.type === 'literal' && typeof arg.value === 'string') name = arg.value;
        if (!name) throw new RuntimeError('reset() forventer variabelnavn.', arg.pos);
        const slot = ctx.variables.get(name);
        if (!slot) throw new RuntimeError(`Ukjent variabel «${name}».`, arg.pos);
        slot.value = slot.defaultValue;
        ctx.changes.set(name, slot.value);
      }
      return '';
    }
    case 'resetAll': {
      for (const slot of ctx.variables.values()) {
        if (slot.value !== slot.defaultValue) {
          slot.value = slot.defaultValue;
          ctx.changes.set(slot.name, slot.value);
        }
      }
      return '';
    }
    default:
      throw new RuntimeError(`Ukjent funksjon «${call.name}».`, call.pos);
  }
}

export function evaluate(expr: Expr, ctx: EvalContext, depth = 0): ScriptValue {
  if (depth > MAX_DEPTH) throw new RuntimeError('Uttrykket er for dypt nøstet.', expr.pos);
  tick(ctx, expr.pos);
  switch (expr.type) {
    case 'literal':
      return expr.value;
    case 'identifier':
      return readVariable(ctx, expr.name, expr.pos);
    case 'mention': {
      const target = ctx.resolveMention(expr.id);
      if (!target) throw new RuntimeError('Referansen finnes ikke lenger.', expr.pos);
      if (target.kind === 'variable') return readVariable(ctx, target.name, expr.pos);
      // Element-referanse utenfor visits(): verdien er visits-tallet (nyttig i betingelser).
      return ctx.visits.get(target.elementId) ?? 0;
    }
    case 'unary': {
      const v = evaluate(expr.operand, ctx, depth + 1);
      if (expr.op === '!') return !toBool(v);
      if (expr.op === '-') return -toNumber(v, expr.pos);
      return toNumber(v, expr.pos);
    }
    case 'call':
      return callBuiltin(ctx, expr, depth);
    case 'binary': {
      if (expr.op === 'and') {
        return toBool(evaluate(expr.left, ctx, depth + 1)) && toBool(evaluate(expr.right, ctx, depth + 1));
      }
      if (expr.op === 'or') {
        return toBool(evaluate(expr.left, ctx, depth + 1)) || toBool(evaluate(expr.right, ctx, depth + 1));
      }
      const a = evaluate(expr.left, ctx, depth + 1);
      const b = evaluate(expr.right, ctx, depth + 1);
      switch (expr.op) {
        case '+':
          if (typeof a === 'string' || typeof b === 'string') return formatValue(a) + formatValue(b);
          return toNumber(a, expr.pos) + toNumber(b, expr.pos);
        case '-': return toNumber(a, expr.pos) - toNumber(b, expr.pos);
        case '*': return toNumber(a, expr.pos) * toNumber(b, expr.pos);
        case '/': {
          const d = toNumber(b, expr.pos);
          if (d === 0) throw new RuntimeError('Deling på null.', expr.pos);
          return toNumber(a, expr.pos) / d;
        }
        case '%': {
          const d = toNumber(b, expr.pos);
          if (d === 0) throw new RuntimeError('Rest av deling på null.', expr.pos);
          return toNumber(a, expr.pos) % d;
        }
        case '==': return looselyEqual(a, b);
        case '!=': return !looselyEqual(a, b);
        case '<': return compare(a, b, expr.pos) < 0;
        case '>': return compare(a, b, expr.pos) > 0;
        case '<=': return compare(a, b, expr.pos) <= 0;
        case '>=': return compare(a, b, expr.pos) >= 0;
        default:
          throw new RuntimeError(`Ukjent operator «${String(expr.op)}».`, expr.pos);
      }
    }
    default:
      throw new RuntimeError('Ukjent uttrykk.', (expr as Expr).pos);
  }
}

export function execute(stmt: Statement, ctx: EvalContext): void {
  if (stmt.type === 'callStatement') {
    evaluate(stmt.call, ctx, 0);
    return;
  }
  const rhs = evaluate(stmt.value, ctx, 0);
  if (stmt.op === '=') {
    writeVariable(ctx, stmt.target, rhs, stmt.pos);
    return;
  }
  const current = readVariable(ctx, stmt.target, stmt.pos);
  let next: ScriptValue;
  switch (stmt.op) {
    case '+=':
      next = (typeof current === 'string' || typeof rhs === 'string')
        ? formatValue(current) + formatValue(rhs)
        : toNumber(current, stmt.pos) + toNumber(rhs, stmt.pos);
      break;
    case '-=': next = toNumber(current, stmt.pos) - toNumber(rhs, stmt.pos); break;
    case '*=': next = toNumber(current, stmt.pos) * toNumber(rhs, stmt.pos); break;
    case '/=': {
      const d = toNumber(rhs, stmt.pos);
      if (d === 0) throw new RuntimeError('Deling på null.', stmt.pos);
      next = toNumber(current, stmt.pos) / d;
      break;
    }
    case '%=': {
      const d = toNumber(rhs, stmt.pos);
      if (d === 0) throw new RuntimeError('Rest av deling på null.', stmt.pos);
      next = toNumber(current, stmt.pos) % d;
      break;
    }
    default:
      throw new RuntimeError(`Ukjent tilordning «${String(stmt.op)}».`, stmt.pos);
  }
  writeVariable(ctx, stmt.target, next, stmt.pos);
}

export function truthy(value: ScriptValue): boolean {
  return toBool(value);
}
