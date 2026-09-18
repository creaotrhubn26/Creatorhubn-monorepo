/**
 * Story Graph — lexer for skriptspråket. Tokens bærer offset så feil kan pekes på.
 */

export type TokenType =
  | 'number' | 'string' | 'boolean' | 'identifier' | 'keyword' | 'mention'
  | 'op' | 'lparen' | 'rparen' | 'comma' | 'dot' | 'newline' | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export class LexError extends Error {
  constructor(message: string, public readonly offset: number) {
    super(message);
    this.name = 'LexError';
  }
}

const KEYWORDS = new Set(['if', 'elseif', 'else', 'endif', 'is', 'not', 'and', 'or']);
const THREE_CHAR_OPS = new Set<string>([]);
const TWO_CHAR_OPS = new Set(['+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||']);
const ONE_CHAR_OPS = new Set(['=', '+', '-', '*', '/', '%', '<', '>', '!']);

const isIdentStart = (ch: string): boolean => /[A-Za-z$_À-ɏ]/.test(ch);
const isIdentPart = (ch: string): boolean => /[A-Za-z0-9$_À-ɏ]/.test(ch);
const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  let i = 0;
  const push = (type: TokenType, value: string, start: number, end: number) => tokens.push({ type, value, start, end });

  while (i < n) {
    const ch = source[i];

    if (ch === '\n') { push('newline', '\n', i, i + 1); i += 1; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === ' ') { i += 1; continue; }

    // Mention: @[id]
    if (ch === '@' && source[i + 1] === '[') {
      const close = source.indexOf(']', i + 2);
      if (close === -1) throw new LexError('Uavsluttet referanse (@[…]).', i);
      push('mention', source.slice(i + 2, close), i, close + 1);
      i = close + 1;
      continue;
    }

    if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1] ?? ''))) {
      const start = i;
      while (i < n && isDigit(source[i])) i += 1;
      if (source[i] === '.' && isDigit(source[i + 1] ?? '')) {
        i += 1;
        while (i < n && isDigit(source[i])) i += 1;
      }
      push('number', source.slice(start, i), start, i);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i += 1;
      let value = '';
      let closed = false;
      while (i < n) {
        const c = source[i];
        if (c === '\\' && i + 1 < n) {
          const next = source[i + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
          continue;
        }
        if (c === quote) { closed = true; i += 1; break; }
        if (c === '\n') break;
        value += c;
        i += 1;
      }
      if (!closed) throw new LexError('Uavsluttet streng.', start);
      push('string', value, start, i);
      continue;
    }

    if (isIdentStart(ch)) {
      const start = i;
      while (i < n && isIdentPart(source[i])) i += 1;
      const word = source.slice(start, i);
      if (word === 'true' || word === 'false') push('boolean', word, start, i);
      else if (KEYWORDS.has(word)) push('keyword', word, start, i);
      else push('identifier', word, start, i);
      continue;
    }

    if (ch === '(') { push('lparen', '(', i, i + 1); i += 1; continue; }
    if (ch === ')') { push('rparen', ')', i, i + 1); i += 1; continue; }
    if (ch === ',') { push('comma', ',', i, i + 1); i += 1; continue; }
    if (ch === '.') { push('dot', '.', i, i + 1); i += 1; continue; }
    if (ch === ';') { push('newline', ';', i, i + 1); i += 1; continue; }

    const three = source.slice(i, i + 3);
    if (THREE_CHAR_OPS.has(three)) { push('op', three, i, i + 3); i += 3; continue; }
    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) { push('op', two, i, i + 2); i += 2; continue; }
    if (ONE_CHAR_OPS.has(ch)) { push('op', ch, i, i + 1); i += 1; continue; }

    throw new LexError(`Uventet tegn «${ch}».`, i);
  }

  push('eof', '', n, n);
  return tokens;
}
