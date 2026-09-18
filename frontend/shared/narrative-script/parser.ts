/**
 * Story Graph — parser (rekursiv nedstigning med presedensklatring).
 *
 * Presedens (lavest → høyest):
 *   or / ||   →   and / &&   →   is / is not   →   == !=   →   < > <= >=
 *   →   + -   →   * / %   →   unær (! not + -)   →   primær
 */

import type {
  AssignOperator, BinaryOperator, CodeItem, Expr, IfBlock, IfBranch, Program, ProgramNode,
  SourcePos, Statement,
} from './ast';
import { isBuiltinFunction } from './ast';
import type { ContentSegment } from './html';
import { LexError, tokenize, type Token } from './lexer';

export class ParseError extends Error {
  constructor(message: string, public readonly offset: number, public readonly segmentIndex: number) {
    super(message);
    this.name = 'ParseError';
  }
}

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=']);

class TokenStream {
  private pos = 0;
  constructor(private readonly tokens: Token[], private readonly segmentIndex: number) {}

  peek(offset = 0): Token { return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]; }
  next(): Token { const t = this.peek(); if (t.type !== 'eof') this.pos += 1; return t; }
  atEnd(): boolean { return this.peek().type === 'eof'; }

  is(type: Token['type'], value?: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === type && (value === undefined || t.value === value);
  }
  accept(type: Token['type'], value?: string): Token | null {
    return this.is(type, value) ? this.next() : null;
  }
  expect(type: Token['type'], value?: string, what?: string): Token {
    const t = this.peek();
    if (t.type === type && (value === undefined || t.value === value)) return this.next();
    throw this.error(`Forventet ${what ?? value ?? type}, fant «${t.value || 'slutt'}».`, t.start);
  }
  skipNewlines(): void { while (this.is('newline')) this.next(); }
  error(message: string, offset: number): ParseError { return new ParseError(message, offset, this.segmentIndex); }
  pos_(start: number, end: number): SourcePos { return { start, end, segmentIndex: this.segmentIndex }; }
}

// ─── Uttrykk ────────────────────────────────────────────────────────────

function parseExpressionFrom(s: TokenStream): Expr { return parseOr(s); }

function parseOr(s: TokenStream): Expr {
  let left = parseAnd(s);
  for (;;) {
    if (s.accept('keyword', 'or') || s.accept('op', '||')) {
      const right = parseAnd(s);
      left = { type: 'binary', op: 'or', left, right, pos: span(left, right) };
    } else return left;
  }
}

function parseAnd(s: TokenStream): Expr {
  let left = parseIs(s);
  for (;;) {
    if (s.accept('keyword', 'and') || s.accept('op', '&&')) {
      const right = parseIs(s);
      left = { type: 'binary', op: 'and', left, right, pos: span(left, right) };
    } else return left;
  }
}

function parseIs(s: TokenStream): Expr {
  let left = parseEquality(s);
  for (;;) {
    if (s.is('keyword', 'is')) {
      s.next();
      const negated = !!s.accept('keyword', 'not');
      const right = parseEquality(s);
      left = { type: 'binary', op: negated ? '!=' : '==', left, right, pos: span(left, right) };
    } else return left;
  }
}

function parseEquality(s: TokenStream): Expr {
  let left = parseComparison(s);
  for (;;) {
    const t = s.peek();
    if (t.type === 'op' && (t.value === '==' || t.value === '!=')) {
      s.next();
      const right = parseComparison(s);
      left = { type: 'binary', op: t.value as BinaryOperator, left, right, pos: span(left, right) };
    } else return left;
  }
}

function parseComparison(s: TokenStream): Expr {
  let left = parseAdditive(s);
  for (;;) {
    const t = s.peek();
    if (t.type === 'op' && (t.value === '<' || t.value === '>' || t.value === '<=' || t.value === '>=')) {
      s.next();
      const right = parseAdditive(s);
      left = { type: 'binary', op: t.value as BinaryOperator, left, right, pos: span(left, right) };
    } else return left;
  }
}

function parseAdditive(s: TokenStream): Expr {
  let left = parseMultiplicative(s);
  for (;;) {
    const t = s.peek();
    if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
      s.next();
      const right = parseMultiplicative(s);
      left = { type: 'binary', op: t.value as BinaryOperator, left, right, pos: span(left, right) };
    } else return left;
  }
}

function parseMultiplicative(s: TokenStream): Expr {
  let left = parseUnary(s);
  for (;;) {
    const t = s.peek();
    if (t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
      s.next();
      const right = parseUnary(s);
      left = { type: 'binary', op: t.value as BinaryOperator, left, right, pos: span(left, right) };
    } else return left;
  }
}

function parseUnary(s: TokenStream): Expr {
  const t = s.peek();
  if ((t.type === 'op' && (t.value === '!' || t.value === '-' || t.value === '+')) || (t.type === 'keyword' && t.value === 'not')) {
    s.next();
    const operand = parseUnary(s);
    const op = t.value === 'not' ? '!' : (t.value as '!' | '-' | '+');
    return { type: 'unary', op, operand, pos: { start: t.start, end: operand.pos.end, segmentIndex: operand.pos.segmentIndex } };
  }
  return parsePrimary(s);
}

function parsePrimary(s: TokenStream): Expr {
  const t = s.peek();
  switch (t.type) {
    case 'number':
      s.next();
      return { type: 'literal', value: Number(t.value), pos: s.pos_(t.start, t.end) };
    case 'string':
      s.next();
      return { type: 'literal', value: t.value, pos: s.pos_(t.start, t.end) };
    case 'boolean':
      s.next();
      return { type: 'literal', value: t.value === 'true', pos: s.pos_(t.start, t.end) };
    case 'mention':
      s.next();
      return { type: 'mention', id: t.value, pos: s.pos_(t.start, t.end) };
    case 'lparen': {
      s.next();
      s.skipNewlines();
      const inner = parseExpressionFrom(s);
      s.skipNewlines();
      s.expect('rparen', undefined, '«)»');
      return inner;
    }
    case 'identifier': {
      s.next();
      if (s.is('lparen')) {
        s.next();
        const args: Expr[] = [];
        s.skipNewlines();
        if (!s.is('rparen')) {
          for (;;) {
            s.skipNewlines();
            args.push(parseExpressionFrom(s));
            s.skipNewlines();
            if (s.accept('comma')) continue;
            break;
          }
        }
        const close = s.expect('rparen', undefined, '«)»');
        if (!isBuiltinFunction(t.value)) throw s.error(`Ukjent funksjon «${t.value}».`, t.start);
        return { type: 'call', name: t.value, args, pos: s.pos_(t.start, close.end) };
      }
      // Punktnotasjon: a.b(.c)
      let name = t.value;
      let end = t.end;
      while (s.is('dot') && s.is('identifier', undefined, 1)) {
        s.next();
        const part = s.next();
        name += `.${part.value}`;
        end = part.end;
      }
      return { type: 'identifier', name, pos: s.pos_(t.start, end) };
    }
    case 'eof':
      throw s.error('Uventet slutt på uttrykk.', t.start);
    default:
      throw s.error(`Uventet «${t.value}».`, t.start);
  }
}

function span(left: Expr, right: Expr): SourcePos {
  return { start: left.pos.start, end: right.pos.end, segmentIndex: left.pos.segmentIndex };
}

// ─── Setninger / kodeblokk ──────────────────────────────────────────────

function parseStatement(s: TokenStream): Statement {
  const t = s.peek();
  if (t.type === 'identifier') {
    // Tilordning: ident(.ident)* op expr
    let lookahead = 1;
    while (s.is('dot', undefined, lookahead) && s.is('identifier', undefined, lookahead + 1)) lookahead += 2;
    const opTok = s.peek(lookahead);
    if (opTok.type === 'op' && ASSIGN_OPS.has(opTok.value)) {
      s.next();
      let target = t.value;
      while (s.is('dot') && s.is('identifier', undefined, 1)) { s.next(); target += `.${s.next().value}`; }
      s.next(); // op
      const value = parseExpressionFrom(s);
      return { type: 'assignment', target, op: opTok.value as AssignOperator, value, pos: s.pos_(t.start, value.pos.end) };
    }
    if (s.is('lparen', undefined, 1)) {
      const call = parsePrimary(s);
      if (call.type !== 'call') throw s.error('Forventet funksjonskall.', t.start);
      return { type: 'callStatement', call, pos: call.pos };
    }
    throw s.error(`Forventet tilordning eller funksjonskall etter «${t.value}».`, t.start);
  }
  throw s.error(`Uventet «${t.value || 'slutt'}» — forventet setning.`, t.start);
}

/** Parse innholdet i én kodeblokk til en liste av items (if/elseif/else/endif/setninger). */
export function parseCodeItems(code: string, segmentIndex: number): CodeItem[] {
  let tokens: Token[];
  try {
    tokens = tokenize(code);
  } catch (err) {
    if (err instanceof LexError) throw new ParseError(err.message, err.offset, segmentIndex);
    throw err;
  }
  const s = new TokenStream(tokens, segmentIndex);
  const items: CodeItem[] = [];
  s.skipNewlines();
  while (!s.atEnd()) {
    const t = s.peek();
    if (t.type === 'keyword' && t.value === 'if') {
      s.next();
      const condition = parseExpressionFrom(s);
      items.push({ type: 'if', condition, pos: s.pos_(t.start, condition.pos.end) });
    } else if (t.type === 'keyword' && t.value === 'elseif') {
      s.next();
      const condition = parseExpressionFrom(s);
      items.push({ type: 'elseif', condition, pos: s.pos_(t.start, condition.pos.end) });
    } else if (t.type === 'keyword' && t.value === 'else') {
      s.next();
      // «else if …» som to ord aksepteres også.
      if (s.is('keyword', 'if')) {
        s.next();
        const condition = parseExpressionFrom(s);
        items.push({ type: 'elseif', condition, pos: s.pos_(t.start, condition.pos.end) });
      } else {
        items.push({ type: 'else', pos: s.pos_(t.start, t.end) });
      }
    } else if (t.type === 'keyword' && t.value === 'endif') {
      s.next();
      items.push({ type: 'endif', pos: s.pos_(t.start, t.end) });
    } else {
      items.push(parseStatement(s));
    }
    // Setninger skilles av linjeskift/semikolon eller slutt.
    if (!s.atEnd() && !s.is('newline')) {
      const bad = s.peek();
      throw s.error(`Uventet «${bad.value}» — forventet linjeskift.`, bad.start);
    }
    s.skipNewlines();
  }
  return items;
}

/** Parse et enkelt uttrykk (forgreningsbetingelse). Kaster ParseError. */
export function parseExpression(source: string, segmentIndex = 0): Expr {
  let tokens: Token[];
  try {
    tokens = tokenize(source);
  } catch (err) {
    if (err instanceof LexError) throw new ParseError(err.message, err.offset, segmentIndex);
    throw err;
  }
  const s = new TokenStream(tokens, segmentIndex);
  s.skipNewlines();
  if (s.atEnd()) throw s.error('Tom betingelse.', 0);
  const expr = parseExpressionFrom(s);
  s.skipNewlines();
  if (!s.atEnd()) throw s.error(`Uventet «${s.peek().value}» etter uttrykket.`, s.peek().start);
  return expr;
}

/**
 * Strukturpass: bygg et Program av segmenter der if/elseif/else/endif kan
 * ligge i forskjellige kodeblokker med html imellom.
 */
export function parseProgram(segments: ContentSegment[]): Program {
  const root: ProgramNode[] = [];
  const stack: Array<{ block: IfBlock; current: IfBranch }> = [];
  const target = (): ProgramNode[] => (stack.length ? stack[stack.length - 1].current.body : root);

  for (const seg of segments) {
    if (seg.kind === 'html') {
      target().push({ type: 'html', html: seg.html, segmentIndex: seg.index });
      continue;
    }
    const items = parseCodeItems(seg.code, seg.index);
    for (const item of items) {
      switch (item.type) {
        case 'if': {
          const branch: IfBranch = { condition: item.condition, body: [], pos: item.pos };
          const block: IfBlock = { type: 'if', branches: [branch], pos: item.pos };
          target().push(block);
          stack.push({ block, current: branch });
          break;
        }
        case 'elseif': {
          const top = stack[stack.length - 1];
          if (!top) throw new ParseError('«elseif» uten «if».', item.pos.start, item.pos.segmentIndex);
          if (top.current.condition === null) throw new ParseError('«elseif» etter «else».', item.pos.start, item.pos.segmentIndex);
          const branch: IfBranch = { condition: item.condition, body: [], pos: item.pos };
          top.block.branches.push(branch);
          top.current = branch;
          break;
        }
        case 'else': {
          const top = stack[stack.length - 1];
          if (!top) throw new ParseError('«else» uten «if».', item.pos.start, item.pos.segmentIndex);
          if (top.current.condition === null) throw new ParseError('Flere «else» i samme blokk.', item.pos.start, item.pos.segmentIndex);
          const branch: IfBranch = { condition: null, body: [], pos: item.pos };
          top.block.branches.push(branch);
          top.current = branch;
          break;
        }
        case 'endif': {
          if (!stack.pop()) throw new ParseError('«endif» uten «if».', item.pos.start, item.pos.segmentIndex);
          break;
        }
        default:
          target().push(item);
      }
    }
  }
  if (stack.length > 0) {
    const open = stack[stack.length - 1].block;
    throw new ParseError('«if» mangler «endif».', open.pos.start, open.pos.segmentIndex);
  }
  return root;
}
