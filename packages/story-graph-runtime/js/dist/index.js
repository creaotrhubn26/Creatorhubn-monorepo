/* @creatorhub/story-graph-runtime — generert av `npm run build:narrative-runtime-pkg` (frontend/shared/narrative-runtime-pkg). Ikke rediger for hånd. */

// shared/narrative-runtime/scope.ts
var TYPED = /* @__PURE__ */ new Set(["bool", "int", "float", "string"]);
function slugifyScopeName(name) {
  const slug = name.replace(/[æÆ]/g, (m) => m === "æ" ? "ae" : "Ae").replace(/[øØ]/g, (m) => m === "ø" ? "o" : "O").replace(/[åÅ]/g, (m) => m === "å" ? "a" : "A").replace(/ß/g, "ss").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_$]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[A-Za-z_$]/.test(slug) ? slug : `_${slug}`;
}
function toScriptValue(type, value) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (type === "string") return JSON.stringify(value);
  return null;
}
function buildScriptVariables(graph) {
  var _a, _b;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const v of graph.variables) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    out.push({ name: v.name, type: v.type, defaultValue: toScriptValue(v.type, v.defaultValue) });
  }
  const ownerScope = /* @__PURE__ */ new Map();
  for (const c of graph.components) ownerScope.set(c.id, ((_a = c.customId) == null ? void 0 : _a.trim()) || slugifyScopeName(c.name));
  for (const b of graph.boards) ownerScope.set(b.id, ((_b = b.customId) == null ? void 0 : _b.trim()) || slugifyScopeName(b.name));
  for (const a of graph.attributes) {
    if (a.ownerKind === "element" || !TYPED.has(a.type)) continue;
    const scope = ownerScope.get(a.ownerId);
    if (!scope) continue;
    const name = `${scope}.${a.name}`;
    if (seen.has(name)) continue;
    seen.add(name);
    const type = a.type;
    out.push({ name, type, defaultValue: toScriptValue(type, a.value) });
  }
  return out;
}
function buildResolvers(graph, variables) {
  var _a;
  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const elementByCustomId = /* @__PURE__ */ new Map();
  for (const e of graph.elements) if ((_a = e.customId) == null ? void 0 : _a.trim()) elementByCustomId.set(e.customId.trim(), e.id);
  const variableNameById = /* @__PURE__ */ new Map();
  for (const v of graph.variables) if (v.id) variableNameById.set(v.id, v.name);
  const variableNames = new Set(variables.map((v) => v.name));
  return {
    variableNames,
    resolveMention: (id) => {
      if (elementById.has(id)) return { kind: "element", elementId: id };
      const byCustom = elementByCustomId.get(id);
      if (byCustom) return { kind: "element", elementId: byCustom };
      const varName = variableNameById.get(id);
      if (varName) return { kind: "variable", name: varName };
      if (variableNames.has(id)) return { kind: "variable", name: id };
      return null;
    },
    resolveElementRef: (ref) => {
      var _a2;
      if (elementById.has(ref)) return ref;
      return (_a2 = elementByCustomId.get(ref)) != null ? _a2 : null;
    }
  };
}

// shared/narrative-script/ast.ts
var BUILTIN_FUNCTIONS = [
  "abs",
  "max",
  "min",
  "random",
  "roll",
  "round",
  "sqr",
  "sqrt",
  "visits",
  "show",
  "resetVisits",
  "reset",
  "resetAll"
];
function isBuiltinFunction(name) {
  return BUILTIN_FUNCTIONS.includes(name);
}

// shared/narrative-script/lexer.ts
var LexError = class extends Error {
  constructor(message, offset) {
    super(message);
    this.offset = offset;
    this.name = "LexError";
  }
};
var KEYWORDS = /* @__PURE__ */ new Set(["if", "elseif", "else", "endif", "is", "not", "and", "or"]);
var THREE_CHAR_OPS = /* @__PURE__ */ new Set([]);
var TWO_CHAR_OPS = /* @__PURE__ */ new Set(["+=", "-=", "*=", "/=", "%=", "==", "!=", "<=", ">=", "&&", "||"]);
var ONE_CHAR_OPS = /* @__PURE__ */ new Set(["=", "+", "-", "*", "/", "%", "<", ">", "!"]);
var isIdentStart = (ch) => /[A-Za-z$_À-ɏ]/.test(ch);
var isIdentPart = (ch) => /[A-Za-z0-9$_À-ɏ]/.test(ch);
var isDigit = (ch) => ch >= "0" && ch <= "9";
function tokenize(source) {
  var _a, _b;
  const tokens = [];
  const n = source.length;
  let i = 0;
  const push = (type, value, start, end) => tokens.push({ type, value, start, end });
  while (i < n) {
    const ch = source[i];
    if (ch === "\n") {
      push("newline", "\n", i, i + 1);
      i += 1;
      continue;
    }
    if (ch === " " || ch === "	" || ch === "\r" || ch === " ") {
      i += 1;
      continue;
    }
    if (ch === "@" && source[i + 1] === "[") {
      const close = source.indexOf("]", i + 2);
      if (close === -1) throw new LexError("Uavsluttet referanse (@[…]).", i);
      push("mention", source.slice(i + 2, close), i, close + 1);
      i = close + 1;
      continue;
    }
    if (isDigit(ch) || ch === "." && isDigit((_a = source[i + 1]) != null ? _a : "")) {
      const start = i;
      while (i < n && isDigit(source[i])) i += 1;
      if (source[i] === "." && isDigit((_b = source[i + 1]) != null ? _b : "")) {
        i += 1;
        while (i < n && isDigit(source[i])) i += 1;
      }
      push("number", source.slice(start, i), start, i);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i += 1;
      let value = "";
      let closed = false;
      while (i < n) {
        const c = source[i];
        if (c === "\\" && i + 1 < n) {
          const next = source[i + 1];
          value += next === "n" ? "\n" : next === "t" ? "	" : next;
          i += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          i += 1;
          break;
        }
        if (c === "\n") break;
        value += c;
        i += 1;
      }
      if (!closed) throw new LexError("Uavsluttet streng.", start);
      push("string", value, start, i);
      continue;
    }
    if (isIdentStart(ch)) {
      const start = i;
      while (i < n && isIdentPart(source[i])) i += 1;
      const word = source.slice(start, i);
      if (word === "true" || word === "false") push("boolean", word, start, i);
      else if (KEYWORDS.has(word)) push("keyword", word, start, i);
      else push("identifier", word, start, i);
      continue;
    }
    if (ch === "(") {
      push("lparen", "(", i, i + 1);
      i += 1;
      continue;
    }
    if (ch === ")") {
      push("rparen", ")", i, i + 1);
      i += 1;
      continue;
    }
    if (ch === ",") {
      push("comma", ",", i, i + 1);
      i += 1;
      continue;
    }
    if (ch === ".") {
      push("dot", ".", i, i + 1);
      i += 1;
      continue;
    }
    if (ch === ";") {
      push("newline", ";", i, i + 1);
      i += 1;
      continue;
    }
    const three = source.slice(i, i + 3);
    if (THREE_CHAR_OPS.has(three)) {
      push("op", three, i, i + 3);
      i += 3;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      push("op", two, i, i + 2);
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(ch)) {
      push("op", ch, i, i + 1);
      i += 1;
      continue;
    }
    throw new LexError(`Uventet tegn «${ch}».`, i);
  }
  push("eof", "", n, n);
  return tokens;
}

// shared/narrative-script/parser.ts
var ParseError = class extends Error {
  constructor(message, offset, segmentIndex) {
    super(message);
    this.offset = offset;
    this.segmentIndex = segmentIndex;
    this.name = "ParseError";
  }
};
var ASSIGN_OPS = /* @__PURE__ */ new Set(["=", "+=", "-=", "*=", "/=", "%="]);
var TokenStream = class {
  constructor(tokens, segmentIndex) {
    this.tokens = tokens;
    this.segmentIndex = segmentIndex;
    this.pos = 0;
  }
  peek(offset = 0) {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }
  next() {
    const t = this.peek();
    if (t.type !== "eof") this.pos += 1;
    return t;
  }
  atEnd() {
    return this.peek().type === "eof";
  }
  is(type, value, offset = 0) {
    const t = this.peek(offset);
    return t.type === type && (value === void 0 || t.value === value);
  }
  accept(type, value) {
    return this.is(type, value) ? this.next() : null;
  }
  expect(type, value, what) {
    var _a;
    const t = this.peek();
    if (t.type === type && (value === void 0 || t.value === value)) return this.next();
    throw this.error(`Forventet ${(_a = what != null ? what : value) != null ? _a : type}, fant «${t.value || "slutt"}».`, t.start);
  }
  skipNewlines() {
    while (this.is("newline")) this.next();
  }
  error(message, offset) {
    return new ParseError(message, offset, this.segmentIndex);
  }
  pos_(start, end) {
    return { start, end, segmentIndex: this.segmentIndex };
  }
};
function parseExpressionFrom(s) {
  return parseOr(s);
}
function parseOr(s) {
  let left = parseAnd(s);
  for (; ; ) {
    if (s.accept("keyword", "or") || s.accept("op", "||")) {
      const right = parseAnd(s);
      left = { type: "binary", op: "or", left, right, pos: span(left, right) };
    } else return left;
  }
}
function parseAnd(s) {
  let left = parseIs(s);
  for (; ; ) {
    if (s.accept("keyword", "and") || s.accept("op", "&&")) {
      const right = parseIs(s);
      left = { type: "binary", op: "and", left, right, pos: span(left, right) };
    } else return left;
  }
}
function parseIs(s) {
  let left = parseEquality(s);
  for (; ; ) {
    if (s.is("keyword", "is")) {
      s.next();
      const negated = !!s.accept("keyword", "not");
      const right = parseEquality(s);
      left = { type: "binary", op: negated ? "!=" : "==", left, right, pos: span(left, right) };
    } else return left;
  }
}
function parseEquality(s) {
  let left = parseComparison(s);
  for (; ; ) {
    const t = s.peek();
    if (t.type === "op" && (t.value === "==" || t.value === "!=")) {
      s.next();
      const right = parseComparison(s);
      left = { type: "binary", op: t.value, left, right, pos: span(left, right) };
    } else return left;
  }
}
function parseComparison(s) {
  let left = parseAdditive(s);
  for (; ; ) {
    const t = s.peek();
    if (t.type === "op" && (t.value === "<" || t.value === ">" || t.value === "<=" || t.value === ">=")) {
      s.next();
      const right = parseAdditive(s);
      left = { type: "binary", op: t.value, left, right, pos: span(left, right) };
    } else return left;
  }
}
function parseAdditive(s) {
  let left = parseMultiplicative(s);
  for (; ; ) {
    const t = s.peek();
    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      s.next();
      const right = parseMultiplicative(s);
      left = { type: "binary", op: t.value, left, right, pos: span(left, right) };
    } else return left;
  }
}
function parseMultiplicative(s) {
  let left = parseUnary(s);
  for (; ; ) {
    const t = s.peek();
    if (t.type === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
      s.next();
      const right = parseUnary(s);
      left = { type: "binary", op: t.value, left, right, pos: span(left, right) };
    } else return left;
  }
}
function parseUnary(s) {
  const t = s.peek();
  if (t.type === "op" && (t.value === "!" || t.value === "-" || t.value === "+") || t.type === "keyword" && t.value === "not") {
    s.next();
    const operand = parseUnary(s);
    const op = t.value === "not" ? "!" : t.value;
    return { type: "unary", op, operand, pos: { start: t.start, end: operand.pos.end, segmentIndex: operand.pos.segmentIndex } };
  }
  return parsePrimary(s);
}
function parsePrimary(s) {
  const t = s.peek();
  switch (t.type) {
    case "number":
      s.next();
      return { type: "literal", value: Number(t.value), pos: s.pos_(t.start, t.end) };
    case "string":
      s.next();
      return { type: "literal", value: t.value, pos: s.pos_(t.start, t.end) };
    case "boolean":
      s.next();
      return { type: "literal", value: t.value === "true", pos: s.pos_(t.start, t.end) };
    case "mention":
      s.next();
      return { type: "mention", id: t.value, pos: s.pos_(t.start, t.end) };
    case "lparen": {
      s.next();
      s.skipNewlines();
      const inner = parseExpressionFrom(s);
      s.skipNewlines();
      s.expect("rparen", void 0, "«)»");
      return inner;
    }
    case "identifier": {
      s.next();
      if (s.is("lparen")) {
        s.next();
        const args = [];
        s.skipNewlines();
        if (!s.is("rparen")) {
          for (; ; ) {
            s.skipNewlines();
            args.push(parseExpressionFrom(s));
            s.skipNewlines();
            if (s.accept("comma")) continue;
            break;
          }
        }
        const close = s.expect("rparen", void 0, "«)»");
        if (!isBuiltinFunction(t.value)) throw s.error(`Ukjent funksjon «${t.value}».`, t.start);
        return { type: "call", name: t.value, args, pos: s.pos_(t.start, close.end) };
      }
      let name = t.value;
      let end = t.end;
      while (s.is("dot") && s.is("identifier", void 0, 1)) {
        s.next();
        const part = s.next();
        name += `.${part.value}`;
        end = part.end;
      }
      return { type: "identifier", name, pos: s.pos_(t.start, end) };
    }
    case "eof":
      throw s.error("Uventet slutt på uttrykk.", t.start);
    default:
      throw s.error(`Uventet «${t.value}».`, t.start);
  }
}
function span(left, right) {
  return { start: left.pos.start, end: right.pos.end, segmentIndex: left.pos.segmentIndex };
}
function parseStatement(s) {
  const t = s.peek();
  if (t.type === "identifier") {
    let lookahead = 1;
    while (s.is("dot", void 0, lookahead) && s.is("identifier", void 0, lookahead + 1)) lookahead += 2;
    const opTok = s.peek(lookahead);
    if (opTok.type === "op" && ASSIGN_OPS.has(opTok.value)) {
      s.next();
      let target = t.value;
      while (s.is("dot") && s.is("identifier", void 0, 1)) {
        s.next();
        target += `.${s.next().value}`;
      }
      s.next();
      const value = parseExpressionFrom(s);
      return { type: "assignment", target, op: opTok.value, value, pos: s.pos_(t.start, value.pos.end) };
    }
    if (s.is("lparen", void 0, 1)) {
      const call = parsePrimary(s);
      if (call.type !== "call") throw s.error("Forventet funksjonskall.", t.start);
      return { type: "callStatement", call, pos: call.pos };
    }
    throw s.error(`Forventet tilordning eller funksjonskall etter «${t.value}».`, t.start);
  }
  throw s.error(`Uventet «${t.value || "slutt"}» — forventet setning.`, t.start);
}
function parseCodeItems(code2, segmentIndex) {
  let tokens;
  try {
    tokens = tokenize(code2);
  } catch (err) {
    if (err instanceof LexError) throw new ParseError(err.message, err.offset, segmentIndex);
    throw err;
  }
  const s = new TokenStream(tokens, segmentIndex);
  const items = [];
  s.skipNewlines();
  while (!s.atEnd()) {
    const t = s.peek();
    if (t.type === "keyword" && t.value === "if") {
      s.next();
      const condition = parseExpressionFrom(s);
      items.push({ type: "if", condition, pos: s.pos_(t.start, condition.pos.end) });
    } else if (t.type === "keyword" && t.value === "elseif") {
      s.next();
      const condition = parseExpressionFrom(s);
      items.push({ type: "elseif", condition, pos: s.pos_(t.start, condition.pos.end) });
    } else if (t.type === "keyword" && t.value === "else") {
      s.next();
      if (s.is("keyword", "if")) {
        s.next();
        const condition = parseExpressionFrom(s);
        items.push({ type: "elseif", condition, pos: s.pos_(t.start, condition.pos.end) });
      } else {
        items.push({ type: "else", pos: s.pos_(t.start, t.end) });
      }
    } else if (t.type === "keyword" && t.value === "endif") {
      s.next();
      items.push({ type: "endif", pos: s.pos_(t.start, t.end) });
    } else {
      items.push(parseStatement(s));
    }
    if (!s.atEnd() && !s.is("newline")) {
      const bad = s.peek();
      throw s.error(`Uventet «${bad.value}» — forventet linjeskift.`, bad.start);
    }
    s.skipNewlines();
  }
  return items;
}
function parseExpression(source, segmentIndex = 0) {
  let tokens;
  try {
    tokens = tokenize(source);
  } catch (err) {
    if (err instanceof LexError) throw new ParseError(err.message, err.offset, segmentIndex);
    throw err;
  }
  const s = new TokenStream(tokens, segmentIndex);
  s.skipNewlines();
  if (s.atEnd()) throw s.error("Tom betingelse.", 0);
  const expr = parseExpressionFrom(s);
  s.skipNewlines();
  if (!s.atEnd()) throw s.error(`Uventet «${s.peek().value}» etter uttrykket.`, s.peek().start);
  return expr;
}
function parseProgram(segments) {
  const root = [];
  const stack = [];
  const target = () => stack.length ? stack[stack.length - 1].current.body : root;
  for (const seg of segments) {
    if (seg.kind === "html") {
      target().push({ type: "html", html: seg.html, segmentIndex: seg.index });
      continue;
    }
    const items = parseCodeItems(seg.code, seg.index);
    for (const item of items) {
      switch (item.type) {
        case "if": {
          const branch = { condition: item.condition, body: [], pos: item.pos };
          const block = { type: "if", branches: [branch], pos: item.pos };
          target().push(block);
          stack.push({ block, current: branch });
          break;
        }
        case "elseif": {
          const top = stack[stack.length - 1];
          if (!top) throw new ParseError("«elseif» uten «if».", item.pos.start, item.pos.segmentIndex);
          if (top.current.condition === null) throw new ParseError("«elseif» etter «else».", item.pos.start, item.pos.segmentIndex);
          const branch = { condition: item.condition, body: [], pos: item.pos };
          top.block.branches.push(branch);
          top.current = branch;
          break;
        }
        case "else": {
          const top = stack[stack.length - 1];
          if (!top) throw new ParseError("«else» uten «if».", item.pos.start, item.pos.segmentIndex);
          if (top.current.condition === null) throw new ParseError("Flere «else» i samme blokk.", item.pos.start, item.pos.segmentIndex);
          const branch = { condition: null, body: [], pos: item.pos };
          top.block.branches.push(branch);
          top.current = branch;
          break;
        }
        case "endif": {
          if (!stack.pop()) throw new ParseError("«endif» uten «if».", item.pos.start, item.pos.segmentIndex);
          break;
        }
        default:
          target().push(item);
      }
    }
  }
  if (stack.length > 0) {
    const open = stack[stack.length - 1].block;
    throw new ParseError("«if» mangler «endif».", open.pos.start, open.pos.segmentIndex);
  }
  return root;
}

// shared/narrative-script/evaluator.ts
var RuntimeError = class extends Error {
  constructor(message, pos) {
    super(message);
    this.pos = pos;
    this.name = "RuntimeError";
  }
};
var MAX_DEPTH = 64;
function coerceToType(type, value, pos = null) {
  switch (type) {
    case "bool":
      return toBool(value);
    case "int":
      return Math.trunc(toNumber(value, pos));
    case "float":
      return toNumber(value, pos);
    case "string":
      return typeof value === "string" ? value : formatValue(value);
    default:
      return value;
  }
}
function defaultForType(type) {
  switch (type) {
    case "bool":
      return false;
    case "int":
    case "float":
      return 0;
    case "string":
      return "";
    default:
      return false;
  }
}
function formatValue(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  return value;
}
function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  return value.length > 0;
}
function toNumber(value, pos) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) throw new RuntimeError(`Kan ikke regne med teksten «${value}».`, pos);
  return n;
}
function looselyEqual(a, b) {
  if (typeof a === "string" || typeof b === "string") {
    if (typeof a === "string" && typeof b === "string") return a === b;
    const numA = typeof a === "string" ? Number(a) : toNumber(a, null);
    const numB = typeof b === "string" ? Number(b) : toNumber(b, null);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA === numB;
    return formatValue(a) === formatValue(b);
  }
  return toNumber(a, null) === toNumber(b, null);
}
function compare(a, b, pos) {
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  const na = toNumber(a, pos);
  const nb = toNumber(b, pos);
  return na < nb ? -1 : na > nb ? 1 : 0;
}
function tick(ctx, pos) {
  ctx.budget.nodes += 1;
  if (ctx.budget.nodes > ctx.budget.maxNodes) {
    throw new RuntimeError("Skriptet er for stort (nodebudsjett overskredet).", pos);
  }
}
function readVariable(ctx, name, pos) {
  const slot = ctx.variables.get(name);
  if (!slot) throw new RuntimeError(`Ukjent variabel «${name}».`, pos);
  return slot.value;
}
function writeVariable(ctx, name, value, pos) {
  const slot = ctx.variables.get(name);
  if (!slot) throw new RuntimeError(`Ukjent variabel «${name}» — opprett den under Variabler først.`, pos);
  const coerced = coerceToType(slot.type, value, pos);
  slot.value = coerced;
  ctx.changes.set(name, coerced);
}
function elementRefFromArg(ctx, arg) {
  if (!arg) return ctx.currentElementId;
  if (arg.type === "mention") {
    const target = ctx.resolveMention(arg.id);
    if ((target == null ? void 0 : target.kind) === "element") return target.elementId;
    throw new RuntimeError("Referansen peker ikke på et element.", arg.pos);
  }
  if (arg.type === "identifier" && !ctx.variables.has(arg.name)) {
    const id = ctx.resolveElementRef(arg.name);
    if (!id) throw new RuntimeError(`Fant ikke element «${arg.name}».`, arg.pos);
    return id;
  }
  if (arg.type === "literal" && typeof arg.value === "string") {
    const id = ctx.resolveElementRef(arg.value);
    if (!id) throw new RuntimeError(`Fant ikke element «${arg.value}».`, arg.pos);
    return id;
  }
  throw new RuntimeError("visits() forventer en element-referanse.", arg.pos);
}
function callBuiltin(ctx, call, depth) {
  var _a;
  const argVals = () => call.args.map((a) => evaluate(a, ctx, depth + 1));
  const num2 = (i) => {
    const arg = call.args[i];
    if (!arg) throw new RuntimeError(`${call.name}() mangler argument ${i + 1}.`, call.pos);
    return toNumber(evaluate(arg, ctx, depth + 1), arg.pos);
  };
  switch (call.name) {
    case "abs":
      return Math.abs(num2(0));
    case "sqr": {
      const x = num2(0);
      return x * x;
    }
    case "sqrt": {
      const x = num2(0);
      if (x < 0) throw new RuntimeError("sqrt() av negativt tall.", call.pos);
      return Math.sqrt(x);
    }
    case "round":
      return Math.round(num2(0));
    case "max": {
      const vals = argVals().map((v, i) => toNumber(v, call.args[i].pos));
      if (vals.length === 0) throw new RuntimeError("max() trenger minst ett argument.", call.pos);
      return Math.max(...vals);
    }
    case "min": {
      const vals = argVals().map((v, i) => toNumber(v, call.args[i].pos));
      if (vals.length === 0) throw new RuntimeError("min() trenger minst ett argument.", call.pos);
      return Math.min(...vals);
    }
    case "random": {
      if (call.args.length === 0) return ctx.rng();
      const lo = Math.ceil(num2(0));
      const hi = Math.floor(call.args.length > 1 ? num2(1) : lo);
      if (hi < lo) throw new RuntimeError("random(min, max): max må være ≥ min.", call.pos);
      return lo + Math.floor(ctx.rng() * (hi - lo + 1));
    }
    case "roll": {
      const sides = Math.max(1, Math.floor(num2(0)));
      const count = call.args.length > 1 ? Math.max(1, Math.floor(num2(1))) : 1;
      if (count > 1e3) throw new RuntimeError("roll(): maks 1000 terninger.", call.pos);
      let sum = 0;
      for (let i = 0; i < count; i += 1) sum += 1 + Math.floor(ctx.rng() * sides);
      return sum;
    }
    case "visits": {
      const id = elementRefFromArg(ctx, call.args[0]);
      if (!id) return 0;
      return (_a = ctx.visits.get(id)) != null ? _a : 0;
    }
    case "resetVisits": {
      if (call.args.length === 0) {
        ctx.visits.clear();
        return 0;
      }
      const id = elementRefFromArg(ctx, call.args[0]);
      if (id) ctx.visits.delete(id);
      return 0;
    }
    case "show": {
      const text = argVals().map(formatValue).join("");
      ctx.output.push(text);
      return "";
    }
    case "reset": {
      if (call.args.length === 0) throw new RuntimeError("reset() trenger minst én variabel.", call.pos);
      for (const arg of call.args) {
        let name = null;
        if (arg.type === "identifier") name = arg.name;
        else if (arg.type === "mention") {
          const target = ctx.resolveMention(arg.id);
          if ((target == null ? void 0 : target.kind) === "variable") name = target.name;
        } else if (arg.type === "literal" && typeof arg.value === "string") name = arg.value;
        if (!name) throw new RuntimeError("reset() forventer variabelnavn.", arg.pos);
        const slot = ctx.variables.get(name);
        if (!slot) throw new RuntimeError(`Ukjent variabel «${name}».`, arg.pos);
        slot.value = slot.defaultValue;
        ctx.changes.set(name, slot.value);
      }
      return "";
    }
    case "resetAll": {
      for (const slot of ctx.variables.values()) {
        if (slot.value !== slot.defaultValue) {
          slot.value = slot.defaultValue;
          ctx.changes.set(slot.name, slot.value);
        }
      }
      return "";
    }
    default:
      throw new RuntimeError(`Ukjent funksjon «${call.name}».`, call.pos);
  }
}
function evaluate(expr, ctx, depth = 0) {
  var _a;
  if (depth > MAX_DEPTH) throw new RuntimeError("Uttrykket er for dypt nøstet.", expr.pos);
  tick(ctx, expr.pos);
  switch (expr.type) {
    case "literal":
      return expr.value;
    case "identifier":
      return readVariable(ctx, expr.name, expr.pos);
    case "mention": {
      const target = ctx.resolveMention(expr.id);
      if (!target) throw new RuntimeError("Referansen finnes ikke lenger.", expr.pos);
      if (target.kind === "variable") return readVariable(ctx, target.name, expr.pos);
      return (_a = ctx.visits.get(target.elementId)) != null ? _a : 0;
    }
    case "unary": {
      const v = evaluate(expr.operand, ctx, depth + 1);
      if (expr.op === "!") return !toBool(v);
      if (expr.op === "-") return -toNumber(v, expr.pos);
      return toNumber(v, expr.pos);
    }
    case "call":
      return callBuiltin(ctx, expr, depth);
    case "binary": {
      if (expr.op === "and") {
        return toBool(evaluate(expr.left, ctx, depth + 1)) && toBool(evaluate(expr.right, ctx, depth + 1));
      }
      if (expr.op === "or") {
        return toBool(evaluate(expr.left, ctx, depth + 1)) || toBool(evaluate(expr.right, ctx, depth + 1));
      }
      const a = evaluate(expr.left, ctx, depth + 1);
      const b = evaluate(expr.right, ctx, depth + 1);
      switch (expr.op) {
        case "+":
          if (typeof a === "string" || typeof b === "string") return formatValue(a) + formatValue(b);
          return toNumber(a, expr.pos) + toNumber(b, expr.pos);
        case "-":
          return toNumber(a, expr.pos) - toNumber(b, expr.pos);
        case "*":
          return toNumber(a, expr.pos) * toNumber(b, expr.pos);
        case "/": {
          const d = toNumber(b, expr.pos);
          if (d === 0) throw new RuntimeError("Deling på null.", expr.pos);
          return toNumber(a, expr.pos) / d;
        }
        case "%": {
          const d = toNumber(b, expr.pos);
          if (d === 0) throw new RuntimeError("Rest av deling på null.", expr.pos);
          return toNumber(a, expr.pos) % d;
        }
        case "==":
          return looselyEqual(a, b);
        case "!=":
          return !looselyEqual(a, b);
        case "<":
          return compare(a, b, expr.pos) < 0;
        case ">":
          return compare(a, b, expr.pos) > 0;
        case "<=":
          return compare(a, b, expr.pos) <= 0;
        case ">=":
          return compare(a, b, expr.pos) >= 0;
        default:
          throw new RuntimeError(`Ukjent operator «${String(expr.op)}».`, expr.pos);
      }
    }
    default:
      throw new RuntimeError("Ukjent uttrykk.", expr.pos);
  }
}
function execute(stmt, ctx) {
  if (stmt.type === "callStatement") {
    evaluate(stmt.call, ctx, 0);
    return;
  }
  const rhs = evaluate(stmt.value, ctx, 0);
  if (stmt.op === "=") {
    writeVariable(ctx, stmt.target, rhs, stmt.pos);
    return;
  }
  const current = readVariable(ctx, stmt.target, stmt.pos);
  let next;
  switch (stmt.op) {
    case "+=":
      next = typeof current === "string" || typeof rhs === "string" ? formatValue(current) + formatValue(rhs) : toNumber(current, stmt.pos) + toNumber(rhs, stmt.pos);
      break;
    case "-=":
      next = toNumber(current, stmt.pos) - toNumber(rhs, stmt.pos);
      break;
    case "*=":
      next = toNumber(current, stmt.pos) * toNumber(rhs, stmt.pos);
      break;
    case "/=": {
      const d = toNumber(rhs, stmt.pos);
      if (d === 0) throw new RuntimeError("Deling på null.", stmt.pos);
      next = toNumber(current, stmt.pos) / d;
      break;
    }
    case "%=": {
      const d = toNumber(rhs, stmt.pos);
      if (d === 0) throw new RuntimeError("Rest av deling på null.", stmt.pos);
      next = toNumber(current, stmt.pos) % d;
      break;
    }
    default:
      throw new RuntimeError(`Ukjent tilordning «${String(stmt.op)}».`, stmt.pos);
  }
  writeVariable(ctx, stmt.target, next, stmt.pos);
}
function truthy(value) {
  return toBool(value);
}

// shared/narrative-script/html.ts
var CODE_BLOCK_RE = /<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/gi;
var MENTION_RE = /<span([^>]*)>([\s\S]*?)<\/span>/gi;
var TAG_RE = /<[^>]+>/g;
var ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#x2F": "/",
  "#47": "/",
  // Vanlige navngitte entiteter fra riktekst-editorer (norsk + typografi).
  aring: "å",
  Aring: "Å",
  aelig: "æ",
  AElig: "Æ",
  oslash: "ø",
  Oslash: "Ø",
  eacute: "é",
  egrave: "è",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  deg: "°",
  times: "×",
  middot: "·",
  bull: "•"
};
function decodeEntities(input) {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, entity) => {
    if (entity in ENTITY_MAP) return ENTITY_MAP[entity];
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code2 = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code2) ? String.fromCodePoint(code2) : whole;
    }
    if (entity.startsWith("#")) {
      const code2 = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code2) ? String.fromCodePoint(code2) : whole;
    }
    return whole;
  });
}
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function readAttr(attrs, name) {
  var _a, _b;
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  if (!m) return null;
  return decodeEntities((_b = (_a = m[1]) != null ? _a : m[2]) != null ? _b : "");
}
function mentionKind(attrs) {
  var _a;
  const explicit = readAttr(attrs, "data-kind");
  const cls = ((_a = readAttr(attrs, "class")) != null ? _a : "") + " " + (explicit != null ? explicit : "");
  if (/variable/i.test(cls)) return "variable";
  if (/component/i.test(cls)) return "component";
  if (/board/i.test(cls)) return "board";
  return "element";
}
function prepareCode(rawInner) {
  const mentions = [];
  let code2 = rawInner.replace(MENTION_RE, (_whole, attrs, label) => {
    const id = readAttr(attrs, "data-id");
    if (!id) return decodeEntities(label.replace(TAG_RE, ""));
    const ref = { id, kind: mentionKind(attrs), label: decodeEntities(label.replace(TAG_RE, "")).trim() };
    mentions.push(ref);
    return `@[${id}]`;
  });
  code2 = code2.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n").replace(TAG_RE, "");
  return { code: decodeEntities(code2), mentions };
}
function segmentContentHtml(html) {
  const segments = [];
  if (!html) return segments;
  let last = 0;
  let index = 0;
  CODE_BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = CODE_BLOCK_RE.exec(html)) !== null) {
    if (m.index > last) {
      const chunk = html.slice(last, m.index);
      if (chunk.trim()) segments.push({ kind: "html", index: index++, html: chunk });
    }
    const { code: code2, mentions } = prepareCode(m[1]);
    segments.push({ kind: "code", index: index++, code: code2, rawHtml: m[0], mentions });
    last = m.index + m[0].length;
  }
  if (last < html.length) {
    const chunk = html.slice(last);
    if (chunk.trim()) segments.push({ kind: "html", index: index++, html: chunk });
  }
  return segments;
}
function stripCodeBlocks(html) {
  return html.replace(CODE_BLOCK_RE, "");
}
function hasScript(html) {
  if (!html) return false;
  CODE_BLOCK_RE.lastIndex = 0;
  return CODE_BLOCK_RE.test(html);
}

// shared/narrative-script/interpreter.ts
function toScriptError(err) {
  var _a, _b, _c, _d;
  if (err instanceof ParseError) return { kind: "parse", message: err.message, segmentIndex: err.segmentIndex, offset: err.offset };
  if (err instanceof RuntimeError) {
    return { kind: "runtime", message: err.message, segmentIndex: (_b = (_a = err.pos) == null ? void 0 : _a.segmentIndex) != null ? _b : null, offset: (_d = (_c = err.pos) == null ? void 0 : _c.start) != null ? _d : null };
  }
  return { kind: "runtime", message: err instanceof Error ? err.message : "Ukjent feil i skript.", segmentIndex: null, offset: null };
}
function buildVariableSlots(variables) {
  const map = /* @__PURE__ */ new Map();
  for (const v of variables) {
    const type = v.type;
    const rawDefault = v.defaultValue == null ? defaultForType(type) : v.defaultValue;
    const defaultValue = safeCoerce(type, rawDefault);
    const value = v.value == null ? defaultValue : safeCoerce(type, v.value);
    map.set(v.name, { name: v.name, type, value, defaultValue });
  }
  return map;
}
function safeCoerce(type, value) {
  try {
    return coerceToType(type, value, null);
  } catch (e) {
    return defaultForType(type);
  }
}
function createInterpreter(options) {
  var _a, _b, _c, _d, _e, _f;
  const variables = buildVariableSlots(options.variables);
  const visits = new Map(Object.entries((_a = options.visits) != null ? _a : {}));
  let currentElementId = (_b = options.currentElementId) != null ? _b : null;
  const rng = (_c = options.rng) != null ? _c : Math.random;
  const resolveMention = (_d = options.resolveMention) != null ? _d : (() => null);
  const resolveElementRef = (_e = options.resolveElementRef) != null ? _e : (() => null);
  const maxNodes = (_f = options.maxNodes) != null ? _f : 1e4;
  const makeContext = (changes) => ({
    variables,
    visits,
    currentElementId,
    rng,
    resolveMention,
    resolveElementRef,
    output: [],
    changes,
    budget: { nodes: 0, maxNodes }
  });
  const renderProgram = (program, ctx, out, errors, shown) => {
    for (const node of program) {
      renderNode(node, ctx, out, errors, shown);
    }
  };
  const renderNode = (node, ctx, out, errors, shown) => {
    switch (node.type) {
      case "html":
        out.push(node.html);
        return;
      case "assignment":
      case "callStatement": {
        ctx.output = [];
        try {
          execute(node, ctx);
        } catch (err) {
          errors.push(toScriptError(err));
        }
        if (ctx.output.length > 0) {
          const text = ctx.output.join("");
          shown.push(text);
          out.push(`<p class="narrative-show">${escapeHtml(text)}</p>`);
        }
        return;
      }
      case "if": {
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
  const runScript = (html) => {
    const errors = [];
    const changes = /* @__PURE__ */ new Map();
    const segments = segmentContentHtml(html);
    let program;
    try {
      program = parseProgram(segments);
    } catch (err) {
      errors.push(toScriptError(err));
      return {
        html: segments.filter((s) => s.kind === "html").map((s) => s.html).join(""),
        output: "",
        changes: {},
        errors
      };
    }
    const ctx = makeContext(changes);
    const out = [];
    const shown = [];
    renderProgram(program, ctx, out, errors, shown);
    return { html: out.join(""), output: shown.join(""), changes: Object.fromEntries(changes), errors };
  };
  const evaluateCondition = (script) => {
    const errors = [];
    const trimmed = (script != null ? script : "").trim();
    if (!trimmed) return { value: true, errors };
    let expr;
    try {
      expr = parseExpression(trimmed, 0);
    } catch (err) {
      errors.push(toScriptError(err));
      return { value: false, errors };
    }
    const ctx = makeContext(/* @__PURE__ */ new Map());
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
    resetVariables: () => {
      for (const slot of variables.values()) slot.value = slot.defaultValue;
    },
    getVisits: () => Object.fromEntries(visits),
    incrementVisit: (elementId) => {
      var _a2;
      const next = ((_a2 = visits.get(elementId)) != null ? _a2 : 0) + 1;
      visits.set(elementId, next);
      return next;
    },
    setCurrentElement: (elementId) => {
      currentElementId = elementId;
    }
  };
}

// shared/narrative-runtime/engine.ts
var MAX_HISTORY = 200;
function createPlaySession(graph, options = {}) {
  var _a, _b, _c, _d;
  const maxJumps = (_a = options.maxJumps) != null ? _a : 100;
  const maxLog = (_b = options.maxLog) != null ? _b : 500;
  const variableDefs = buildScriptVariables(graph);
  const resolvers = buildResolvers(graph, variableDefs);
  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const connectionsBySource = /* @__PURE__ */ new Map();
  for (const c of [...graph.connections].sort((a, b) => {
    var _a2, _b2;
    return ((_a2 = a.sortOrder) != null ? _a2 : 0) - ((_b2 = b.sortOrder) != null ? _b2 : 0);
  })) {
    const list = (_c = connectionsBySource.get(c.sourceId)) != null ? _c : [];
    list.push(c);
    connectionsBySource.set(c.sourceId, list);
  }
  const componentName = new Map(graph.components.map((c) => [c.id, c.name]));
  const componentsByElement = /* @__PURE__ */ new Map();
  for (const ec of [...graph.elementComponents].sort((a, b) => {
    var _a2, _b2;
    return ((_a2 = a.sortOrder) != null ? _a2 : 0) - ((_b2 = b.sortOrder) != null ? _b2 : 0);
  })) {
    const list = (_d = componentsByElement.get(ec.elementId)) != null ? _d : [];
    const name = componentName.get(ec.componentId);
    if (name) list.push(name);
    componentsByElement.set(ec.elementId, list);
  }
  let interpreter = makeInterpreter();
  let view = null;
  let history = [];
  let log = [];
  let step = 0;
  function makeInterpreter() {
    return createInterpreter({
      variables: variableDefs,
      rng: options.rng,
      resolveMention: resolvers.resolveMention,
      resolveElementRef: resolvers.resolveElementRef
    });
  }
  function pushLog(entry) {
    step += 1;
    log.push({ step, ...entry });
    if (log.length > maxLog) log = log.slice(log.length - maxLog);
  }
  function startElementId() {
    var _a2, _b2, _c2, _d2, _e, _f;
    const explicit = (_a2 = options.startElementId) != null ? _a2 : graph.settings.startingElementId;
    if (explicit && elementById.has(explicit)) return explicit;
    const firstBoard = (_b2 = graph.boards[0]) == null ? void 0 : _b2.id;
    const candidates = graph.elements.filter((e) => e.kind === "element" && (!firstBoard || e.boardId === firstBoard)).sort((a, b) => {
      var _a3, _b3;
      return ((_a3 = a.sortOrder) != null ? _a3 : 0) - ((_b3 = b.sortOrder) != null ? _b3 : 0);
    });
    return (_f = (_e = (_c2 = candidates[0]) == null ? void 0 : _c2.id) != null ? _e : (_d2 = graph.elements.find((e) => e.kind === "element")) == null ? void 0 : _d2.id) != null ? _f : null;
  }
  function buildOptions(element) {
    var _a2;
    return ((_a2 = connectionsBySource.get(element.id)) != null ? _a2 : []).filter((c) => elementById.has(c.targetId)).map((c) => {
      var _a3;
      return {
        connectionId: c.id,
        targetId: c.targetId,
        labelHtml: stripCodeBlocks((_a3 = c.labelHtml) != null ? _a3 : ""),
        hasScript: hasScript(c.labelHtml)
      };
    });
  }
  function makeView(element, html, options2, deadEnd) {
    var _a2, _b2;
    const names = (_a2 = componentsByElement.get(element.id)) != null ? _a2 : [];
    return {
      elementId: element.id,
      boardId: element.boardId,
      element,
      html,
      options: options2,
      deadEnd,
      speakerName: (_b2 = names[0]) != null ? _b2 : null,
      componentNames: names
    };
  }
  function enter(elementId, depth = 0) {
    var _a2, _b2;
    const element = elementById.get(elementId);
    if (!element) {
      pushLog({ kind: "enter", elementId, message: "Elementet finnes ikke.", changes: {}, errors: [] });
      return view;
    }
    if (depth > maxJumps) {
      pushLog({ kind: "jumper", elementId, message: `Stoppet: mer enn ${maxJumps} hopp på rad (sløyfe?).`, changes: {}, errors: [] });
      view = makeView(element, "", [], true);
      return view;
    }
    interpreter.setCurrentElement(element.id);
    interpreter.incrementVisit(element.id);
    if (element.kind === "jumper") {
      const target = element.jumperTargetId;
      pushLog({ kind: "jumper", elementId: element.id, message: target ? "Jumper fulgt." : "Jumper uten mål.", changes: {}, errors: [] });
      if (!target || !elementById.has(target)) {
        view = makeView(element, "", [], true);
        return view;
      }
      return enter(target, depth + 1);
    }
    if (element.kind === "branch") {
      const errors = [];
      let chosen = null;
      for (const cond of element.branchConditions) {
        let take = false;
        if (cond.script === null || cond.script.trim() === "") {
          take = true;
        } else {
          const r = interpreter.evaluateCondition(cond.script);
          errors.push(...r.errors);
          take = r.value;
        }
        if (take) {
          chosen = cond.id;
          break;
        }
      }
      const outgoing = (_a2 = connectionsBySource.get(element.id)) != null ? _a2 : [];
      const next = chosen ? outgoing.find((c) => c.sourceOutputKey === chosen) : void 0;
      pushLog({
        kind: "branch",
        elementId: element.id,
        message: chosen ? next ? "Forgrening: betingelse traff." : "Forgrening: betingelsen traff, men utgangen er ikke koblet." : "Forgrening: ingen betingelse traff.",
        changes: {},
        errors
      });
      if (!next || !elementById.has(next.targetId)) {
        view = makeView(element, "", [], true);
        return view;
      }
      return enter(next.targetId, depth + 1);
    }
    const run = interpreter.runScript((_b2 = element.contentHtml) != null ? _b2 : "");
    pushLog({ kind: "enter", elementId: element.id, message: "Ankomst.", changes: run.changes, errors: run.errors });
    const opts = buildOptions(element);
    view = makeView(element, run.html, opts, opts.length === 0);
    return view;
  }
  function snapshot() {
    if (!view) return;
    history.push({
      elementId: view.elementId,
      variables: interpreter.getVariables(),
      visits: interpreter.getVisits(),
      logLength: log.length
    });
    if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
  }
  function restoreInterpreter(variables, visits, elementId) {
    interpreter = createInterpreter({
      variables: variableDefs.map((v) => ({ ...v, value: variables[v.name] })),
      visits,
      currentElementId: elementId,
      rng: options.rng,
      resolveMention: resolvers.resolveMention,
      resolveElementRef: resolvers.resolveElementRef
    });
  }
  const session = {
    start: () => {
      interpreter = makeInterpreter();
      history = [];
      log = [];
      step = 0;
      view = null;
      const id = startElementId();
      if (!id) {
        pushLog({ kind: "enter", elementId: null, message: "Ingen startelement — legg til et element eller sett startelement.", changes: {}, errors: [] });
        return null;
      }
      return enter(id);
    },
    current: () => view,
    choose: (connectionId) => {
      var _a2;
      if (!view) return null;
      const connection = ((_a2 = connectionsBySource.get(view.elementId)) != null ? _a2 : []).find((c) => c.id === connectionId);
      if (!connection) return view;
      snapshot();
      if (hasScript(connection.labelHtml)) {
        const r = interpreter.runScript(connection.labelHtml);
        pushLog({ kind: "choose", elementId: view.elementId, message: "Valg tatt (etikett-skript kjørt).", changes: r.changes, errors: r.errors });
      } else {
        pushLog({ kind: "choose", elementId: view.elementId, message: "Valg tatt.", changes: {}, errors: [] });
      }
      return enter(connection.targetId);
    },
    back: () => {
      var _a2;
      const snap = history.pop();
      if (!snap) return view;
      restoreInterpreter(snap.variables, snap.visits, snap.elementId);
      log = log.slice(0, snap.logLength);
      const element = elementById.get(snap.elementId);
      if (!element) {
        view = null;
        return null;
      }
      const preview = createInterpreter({
        variables: variableDefs.map((v) => ({ ...v, value: snap.variables[v.name] })),
        visits: snap.visits,
        currentElementId: element.id,
        rng: options.rng,
        resolveMention: resolvers.resolveMention,
        resolveElementRef: resolvers.resolveElementRef
      });
      const opts = buildOptions(element);
      view = makeView(element, preview.runScript((_a2 = element.contentHtml) != null ? _a2 : "").html, opts, opts.length === 0);
      return view;
    },
    canBack: () => history.length > 0,
    restart: () => {
      var _a2;
      const v = session.start();
      pushLog({ kind: "restart", elementId: (_a2 = v == null ? void 0 : v.elementId) != null ? _a2 : null, message: "Startet på nytt.", changes: {}, errors: [] });
      return v;
    },
    setVariable: (name, value) => {
      var _a2;
      interpreter.setVariable(name, value);
      pushLog({ kind: "set", elementId: (_a2 = view == null ? void 0 : view.elementId) != null ? _a2 : null, message: `Debugger: ${name} satt.`, changes: { [name]: interpreter.getVariables()[name] }, errors: [] });
    },
    getState: () => ({
      variables: interpreter.getVariables(),
      visits: interpreter.getVisits(),
      historyDepth: history.length,
      log: [...log]
    }),
    getVariableDefs: () => variableDefs.map((v) => ({ name: v.name, type: v.type }))
  };
  return session;
}

// shared/narrative-runtime/validate.ts
function walkExpr(expr, onIdentifier, onMention) {
  switch (expr.type) {
    case "identifier":
      onIdentifier(expr.name, false);
      return;
    case "mention":
      onMention(expr.id);
      return;
    case "unary":
      walkExpr(expr.operand, onIdentifier, onMention);
      return;
    case "binary":
      walkExpr(expr.left, onIdentifier, onMention);
      walkExpr(expr.right, onIdentifier, onMention);
      return;
    case "call": {
      const elementRefFn = expr.name === "visits" || expr.name === "resetVisits";
      const varRefFn = expr.name === "reset";
      for (const arg of expr.args) {
        if (arg.type === "identifier" && (elementRefFn || varRefFn)) onIdentifier(arg.name, elementRefFn);
        else if (arg.type === "mention") onMention(arg.id);
        else walkExpr(arg, onIdentifier, onMention);
      }
      return;
    }
    default:
      return;
  }
}
function walkProgram(program, onIdentifier, onMention) {
  const visit = (node) => {
    switch (node.type) {
      case "assignment":
        onIdentifier(node.target, false);
        walkExpr(node.value, onIdentifier, onMention);
        return;
      case "callStatement":
        walkExpr(node.call, onIdentifier, onMention);
        return;
      case "if":
        for (const b of node.branches) {
          if (b.condition) walkExpr(b.condition, onIdentifier, onMention);
          b.body.forEach(visit);
        }
        return;
      default:
        return;
    }
  };
  program.forEach(visit);
}
function validateScripts(graph) {
  const issues = [];
  const variables = buildScriptVariables(graph);
  const resolvers = buildResolvers(graph, variables);
  const titleOf = (id) => {
    var _a;
    const e = graph.elements.find((x) => x.id === id);
    const t = ((_a = e == null ? void 0 : e.titleHtml) != null ? _a : "").replace(/<[^>]+>/g, "").trim();
    return t || id;
  };
  const check = (program, elementId, where, isProgram) => {
    const seenUnknown = /* @__PURE__ */ new Set();
    const onIdentifier = (name, elementRef) => {
      if (elementRef) {
        if (!resolvers.resolveElementRef(name)) {
          issues.push({ level: "warning", elementId, message: `${where}: fant ikke element «${name}» i visits().` });
        }
        return;
      }
      if (!resolvers.variableNames.has(name) && !seenUnknown.has(name)) {
        seenUnknown.add(name);
        issues.push({ level: "error", elementId, message: `${where}: ukjent variabel «${name}».` });
      }
    };
    const onMention = (id) => {
      if (!resolvers.resolveMention(id)) {
        issues.push({ level: "warning", elementId, message: `${where}: referansen peker på noe som ikke finnes lenger.` });
      }
    };
    if (isProgram) walkProgram(program, onIdentifier, onMention);
    else walkExpr(program, onIdentifier, onMention);
  };
  for (const element of graph.elements) {
    const title = titleOf(element.id);
    if (element.kind === "note") continue;
    if (hasScript(element.contentHtml)) {
      try {
        const program = parseProgram(segmentContentHtml(element.contentHtml));
        check(program, element.id, `«${title}»`, true);
      } catch (err) {
        const msg = err instanceof ParseError ? err.message : "Ugyldig skript.";
        issues.push({ level: "error", elementId: element.id, message: `«${title}»: skriptfeil — ${msg}` });
      }
    }
    if (element.kind === "branch") {
      element.branchConditions.forEach((cond, i) => {
        if (cond.script === null || cond.script.trim() === "") return;
        try {
          const expr = parseExpression(cond.script);
          check(expr, element.id, `«${title}» betingelse ${i + 1}`, false);
        } catch (err) {
          const msg = err instanceof ParseError ? err.message : "Ugyldig betingelse.";
          issues.push({ level: "error", elementId: element.id, message: `«${title}» betingelse ${i + 1}: ${msg}` });
        }
      });
    }
  }
  for (const c of graph.connections) {
    if (!hasScript(c.labelHtml)) continue;
    try {
      const program = parseProgram(segmentContentHtml(c.labelHtml));
      check(program, c.sourceId, `Kobling fra «${titleOf(c.sourceId)}»`, true);
    } catch (err) {
      const msg = err instanceof ParseError ? err.message : "Ugyldig skript.";
      issues.push({ level: "error", elementId: c.sourceId, message: `Kobling fra «${titleOf(c.sourceId)}»: skriptfeil — ${msg}` });
    }
  }
  return issues;
}
function validateStoryGraph(graph) {
  var _a, _b, _c, _d;
  const issues = [];
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const incoming = /* @__PURE__ */ new Map();
  for (const c of graph.connections) incoming.set(c.targetId, ((_a = incoming.get(c.targetId)) != null ? _a : 0) + 1);
  const start = graph.settings.startingElementId;
  if (!start && graph.elements.some((e) => e.kind === "element")) {
    issues.push({ level: "warning", elementId: null, message: "Ingen startelement er satt." });
  }
  for (const e of graph.elements) {
    if (e.kind === "note") continue;
    if (e.kind === "jumper" && (!e.jumperTargetId || !byId.has(e.jumperTargetId))) {
      issues.push({ level: "error", elementId: e.id, message: "Jumper mangler gyldig mål." });
      continue;
    }
    if (e.kind === "branch") {
      if (e.branchConditions.length === 0) issues.push({ level: "error", elementId: e.id, message: "Forgrening har ingen betingelser." });
      const wired = new Set(graph.connections.filter((c) => c.sourceId === e.id).map((c) => c.sourceOutputKey));
      for (const cond of e.branchConditions) {
        if (!wired.has(cond.id)) issues.push({ level: "warning", elementId: e.id, message: `Utgangen «${(_c = (_b = cond.label) != null ? _b : cond.script) != null ? _c : "else"}» er ikke koblet.` });
      }
    }
    if (e.id !== start && !((_d = incoming.get(e.id)) != null ? _d : 0) && !graph.elements.some((j) => j.jumperTargetId === e.id)) {
      issues.push({ level: "warning", elementId: e.id, message: "Elementet kan ikke nås (ingen innganger)." });
    }
  }
  return issues.concat(validateScripts(graph));
}

// shared/narrative-format/arcweave-types.ts
function isArcweaveFolder(value) {
  return !!value && typeof value === "object" && Array.isArray(value.children);
}

// shared/narrative-format/ids.ts
var ID_PREFIXES = {
  board: "nbd",
  element: "nel",
  connection: "ncn",
  component: "ncp",
  attribute: "nat",
  variable: "nvr",
  asset: "nas",
  condition: "cond"
};
var PREFIX_RE = /^[a-z]{2,5}_(.+)$/;
function createExportIdMapper() {
  const forward = /* @__PURE__ */ new Map();
  const used = /* @__PURE__ */ new Set();
  return {
    map(internalId) {
      const existing = forward.get(internalId);
      if (existing) return existing;
      const m = PREFIX_RE.exec(internalId);
      let candidate = m ? m[1] : internalId;
      if (used.has(candidate)) candidate = internalId;
      if (used.has(candidate)) {
        let n = 2;
        while (used.has(`${candidate}-${n}`)) n += 1;
        candidate = `${candidate}-${n}`;
      }
      used.add(candidate);
      forward.set(internalId, candidate);
      return candidate;
    },
    entries: () => [...forward.entries()]
  };
}
function randomUuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.random() * 16 | 0;
    return (ch === "x" ? r : r & 3 | 8).toString(16);
  });
}
var defaultIdFactory = (kind) => `${ID_PREFIXES[kind]}_${randomUuid()}`;
function folderIdForPath(path, used) {
  const slug = path.toLowerCase().replace(/[æ]/g, "ae").replace(/[ø]/g, "o").replace(/[å]/g, "a").replace(/[^a-z0-9/]+/g, "-").replace(/\//g, "--").replace(/^-+|-+$/g, "");
  let candidate = `folder-${slug || "root"}`;
  if (used.has(candidate)) {
    let n = 2;
    while (used.has(`${candidate}-${n}`)) n += 1;
    candidate = `${candidate}-${n}`;
  }
  used.add(candidate);
  return candidate;
}

// shared/narrative-format/import.ts
var ArcweaveImportError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ArcweaveImportError";
  }
};
var KNOWN_THEMES = /* @__PURE__ */ new Set(["default", "green", "blue", "purple", "amber", "red", "teal", "pink", "gray"]);
var THEME_ALIASES = { orange: "amber", yellow: "amber", grey: "gray", cyan: "teal", magenta: "pink" };
var VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;
function normalizeTheme(theme) {
  var _a;
  const t = typeof theme === "string" ? theme.trim().toLowerCase() : "";
  if (!t) return "default";
  if (KNOWN_THEMES.has(t)) return t;
  return (_a = THEME_ALIASES[t]) != null ? _a : "default";
}
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function str(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function sanitizeVariableName(name) {
  const cleaned = name.replace(/[æÆ]/g, "ae").replace(/[øØ]/g, "o").replace(/[åÅ]/g, "a").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}
function folderPaths(collection) {
  const out = /* @__PURE__ */ new Map();
  const referenced = /* @__PURE__ */ new Set();
  for (const v of Object.values(collection)) if (isArcweaveFolder(v)) for (const c of v.children) referenced.add(c);
  const roots = Object.entries(collection).filter(([id, v]) => isArcweaveFolder(v) && (v.root || !referenced.has(id)));
  const visited = /* @__PURE__ */ new Set();
  const walk = (folder, path) => {
    for (const childId of folder.children) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = collection[childId];
      if (isArcweaveFolder(child)) {
        walk(child, path ? `${path}/${child.name}` : child.name);
      } else if (child) {
        out.set(childId, path);
      }
    }
  };
  for (const [, root] of roots) walk(root, "");
  return out;
}
function fromArcweaveProject(input, options) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const project = input;
  if (!project || typeof project !== "object" || !project.boards || !project.elements) {
    throw new ArcweaveImportError("Dokumentet ser ikke ut som en Arcweave-eksport (mangler «boards»/«elements»).");
  }
  const { projectId } = options;
  const now = (_a = options.now) != null ? _a : (/* @__PURE__ */ new Date()).toISOString();
  const factory = (_b = options.idFactory) != null ? _b : defaultIdFactory;
  const warnings = [];
  const warn = (message, ref) => {
    warnings.push(ref ? { message, ref } : { message });
  };
  const idMap = /* @__PURE__ */ new Map();
  const newId = (kind, arcId) => {
    const existing = idMap.get(arcId);
    if (existing) return existing;
    const id = factory(kind, arcId);
    idMap.set(arcId, id);
    return id;
  };
  const lookup = (arcId) => {
    var _a2;
    return arcId ? (_a2 = idMap.get(arcId)) != null ? _a2 : null : null;
  };
  const boardsIn = record(project.boards);
  const elementsIn = record(project.elements);
  const branchesIn = record(project.branches);
  const jumpersIn = record(project.jumpers);
  const notesIn = record(project.notes);
  const connectionsIn = record(project.connections);
  const conditionsIn = record(project.conditions);
  const componentsIn = record(project.components);
  const attributesIn = record(project.attributes);
  const variablesIn = record(project.variables);
  const assetsIn = record(project.assets);
  for (const id of Object.keys(elementsIn)) newId("element", id);
  for (const id of Object.keys(branchesIn)) newId("element", id);
  for (const id of Object.keys(jumpersIn)) newId("element", id);
  for (const id of Object.keys(notesIn)) newId("element", id);
  for (const [id, v] of Object.entries(componentsIn)) if (!isArcweaveFolder(v)) newId("component", id);
  for (const [id, v] of Object.entries(assetsIn)) if (!isArcweaveFolder(v)) newId("asset", id);
  for (const [id, v] of Object.entries(boardsIn)) if (!isArcweaveFolder(v)) newId("board", id);
  const assetPaths = folderPaths(assetsIn);
  const assets = [];
  for (const [arcId, a] of Object.entries(assetsIn)) {
    if (isArcweaveFolder(a)) continue;
    const type = str(a.type).toLowerCase();
    const kind = type === "audio" || type === "video" ? type : "image";
    if (type && type !== kind) warn(`Ressurs «${a.name}» har typen «${a.type}» — importert som bilde.`, arcId);
    const url = typeof a.url === "string" && /^https?:\/\//i.test(a.url) ? a.url : null;
    assets.push({
      id: newId("asset", arcId),
      projectId,
      kind,
      name: str(a.name) || "Ressurs",
      storageKey: null,
      externalUrl: url,
      mime: null,
      sizeBytes: null,
      folderPath: (_c = assetPaths.get(arcId)) != null ? _c : "",
      createdAt: now,
      updatedAt: now
    });
    if (!url) warn(`Ressursfila «${a.name}» følger ikke med i JSON — legg til URL i Ressurser.`, arcId);
  }
  const assetRef = (cover) => {
    const id = (cover == null ? void 0 : cover.id) ? lookup(cover.id) : null;
    return id && assets.some((a) => a.id === id) ? id : null;
  };
  const boardPaths = folderPaths(boardsIn);
  const boards = [];
  const boardOfArcElement = /* @__PURE__ */ new Map();
  let boardOrder = 0;
  for (const [arcId, b] of Object.entries(boardsIn)) {
    if (isArcweaveFolder(b)) continue;
    const id = newId("board", arcId);
    boards.push({
      id,
      projectId,
      name: str(b.name) || "Brett",
      customId: b.customId ? str(b.customId) : null,
      folderPath: (_d = boardPaths.get(arcId)) != null ? _d : "",
      sortOrder: boardOrder++,
      viewport: {},
      createdAt: now,
      updatedAt: now
    });
    for (const list of [b.elements, b.branches, b.jumpers, b.notes]) {
      for (const child of Array.isArray(list) ? list : []) boardOfArcElement.set(child, id);
    }
  }
  if (boards.length === 0) {
    boards.push({ id: factory("board"), projectId, name: "Brett 1", customId: null, folderPath: "", sortOrder: 0, viewport: {}, createdAt: now, updatedAt: now });
    warn("Prosjektet hadde ingen brett — alt ble lagt på «Brett 1».");
  }
  const fallbackBoardId = boards[0].id;
  const boardFor = (arcId, label) => {
    const b = boardOfArcElement.get(arcId);
    if (b) return b;
    warn(`${label} lå ikke på noe brett — lagt på «${boards[0].name}».`, arcId);
    return fallbackBoardId;
  };
  const elements = [];
  const elementComponents = [];
  let elementOrder = 0;
  const base = (arcId, kind, label) => ({
    id: newId("element", arcId),
    projectId,
    boardId: boardFor(arcId, label),
    kind,
    titleHtml: "",
    contentHtml: "",
    x: 0,
    y: 0,
    width: 260,
    height: 120,
    theme: "default",
    coverAssetId: null,
    customId: null,
    jumperTargetId: null,
    branchConditions: [],
    version: 1,
    sortOrder: elementOrder++,
    createdAt: now,
    updatedAt: now,
    i18n: {}
  });
  for (const [arcId, e] of Object.entries(elementsIn)) {
    const el = base(arcId, "element", `Elementet «${str(e.title).replace(/<[^>]+>/g, "") || arcId}»`);
    el.titleHtml = str(e.title);
    el.contentHtml = str(e.content);
    el.x = num(e.x, 0);
    el.y = num(e.y, 0);
    el.width = num(e.width, 260);
    el.height = num(e.height, 120);
    el.theme = normalizeTheme(e.theme);
    el.coverAssetId = assetRef((_e = e.assets) == null ? void 0 : _e.cover);
    el.customId = typeof e.customId === "string" && e.customId.trim() ? e.customId.trim() : null;
    elements.push(el);
    (Array.isArray(e.components) ? e.components : []).forEach((compArcId, i) => {
      const compId = lookup(compArcId);
      if (!compId) {
        warn(`Elementet «${arcId}» peker på en komponent som ikke finnes.`, compArcId);
        return;
      }
      elementComponents.push({ elementId: el.id, componentId: compId, sortOrder: i });
    });
  }
  const branchOfCondition = /* @__PURE__ */ new Map();
  for (const [arcId, b] of Object.entries(branchesIn)) {
    const el = base(arcId, "branch", "Forgreningen");
    el.x = num(b.x, 0);
    el.y = num(b.y, 0);
    el.width = 200;
    el.height = 80;
    el.theme = normalizeTheme(b.theme);
    const conds = [];
    const condRefs = [];
    const c = (_f = b.conditions) != null ? _f : { ifCondition: "" };
    if (c.ifCondition) condRefs.push({ arcId: c.ifCondition, isElse: false });
    for (const ei of Array.isArray(c.elseIfConditions) ? c.elseIfConditions : []) condRefs.push({ arcId: ei, isElse: false });
    if (c.elseCondition) condRefs.push({ arcId: c.elseCondition, isElse: true });
    for (const ref of condRefs) {
      const cond = conditionsIn[ref.arcId];
      if (!cond) {
        warn("Forgreningen peker på en betingelse som ikke finnes.", ref.arcId);
        continue;
      }
      const conditionId = factory("condition");
      const script = ref.isElse ? null : typeof cond.script === "string" && cond.script.trim() ? cond.script : "true";
      conds.push({ id: conditionId, script, label: ref.isElse ? "Ellers" : null });
      branchOfCondition.set(ref.arcId, { branchId: el.id, conditionId });
    }
    if (conds.length === 0) {
      conds.push({ id: factory("condition"), script: "true", label: null });
      warn("Forgreningen manglet betingelser — fikk en «true»-betingelse.", arcId);
    }
    el.branchConditions = conds;
    elements.push(el);
  }
  for (const [arcId, j] of Object.entries(jumpersIn)) {
    const el = base(arcId, "jumper", "Jumperen");
    el.x = num(j.x, 0);
    el.y = num(j.y, 0);
    el.width = 160;
    el.height = 60;
    const target = lookup(j.elementId);
    if (j.elementId && !target) warn("Jumperen peker på et element som ikke finnes.", arcId);
    el.jumperTargetId = target;
    elements.push(el);
  }
  for (const [arcId, n] of Object.entries(notesIn)) {
    const el = base(arcId, "note", "Notatet");
    el.contentHtml = str(n.content);
    el.x = num(n.x, 0);
    el.y = num(n.y, 0);
    el.width = num(n.width, 200);
    el.height = num(n.height, 120);
    el.theme = normalizeTheme(n.theme);
    elements.push(el);
  }
  const elementById = new Map(elements.map((e) => [e.id, e]));
  const connections = [];
  let connOrder = 0;
  for (const [arcId, c] of Object.entries(connectionsIn)) {
    let sourceId;
    let sourceOutputKey = "default";
    if (c.sourceType === "conditions") {
      const ref = branchOfCondition.get(c.sourceid);
      sourceId = (_g = ref == null ? void 0 : ref.branchId) != null ? _g : null;
      if (ref) sourceOutputKey = ref.conditionId;
    } else {
      sourceId = lookup(c.sourceid);
    }
    const targetId = lookup(c.targetid);
    const source = sourceId ? elementById.get(sourceId) : void 0;
    const target = targetId ? elementById.get(targetId) : void 0;
    if (!source || !target || source.kind === "note" || target.kind === "note") {
      warn("Koblingen peker på noe som ikke finnes og ble droppet.", arcId);
      continue;
    }
    connections.push({
      id: newId("connection", arcId),
      projectId,
      boardId: source.boardId,
      sourceId: source.id,
      targetId: target.id,
      sourceOutputKey,
      labelHtml: typeof c.label === "string" ? c.label : "",
      sortOrder: connOrder++,
      createdAt: now,
      updatedAt: now,
      i18n: {}
    });
  }
  const componentPaths = folderPaths(componentsIn);
  const components = [];
  let compOrder = 0;
  for (const [arcId, c] of Object.entries(componentsIn)) {
    if (isArcweaveFolder(c)) continue;
    components.push({
      id: newId("component", arcId),
      projectId,
      name: str(c.name) || "Komponent",
      folderPath: (_h = componentPaths.get(arcId)) != null ? _h : "",
      coverAssetId: assetRef((_i = c.assets) == null ? void 0 : _i.cover),
      customId: c.customId ? str(c.customId) : null,
      sortOrder: compOrder++,
      createdAt: now,
      updatedAt: now
    });
  }
  const attributes = [];
  let attrOrder = 0;
  for (const [arcId, a] of Object.entries(attributesIn)) {
    const ownerKind = a.cType === "elements" ? "element" : a.cType === "components" ? "component" : a.cType === "boards" ? "board" : null;
    const ownerId = lookup(a.cId);
    if (!ownerKind || !ownerId) {
      warn(`Attributtet «${a.name}» har en eier som ikke finnes.`, arcId);
      continue;
    }
    const v = (_j = a.value) != null ? _j : { data: "", type: "string" };
    let type;
    let value;
    switch (v.type) {
      case "string":
        type = v.plain === false ? "rich_text" : "string";
        value = str(v.data);
        break;
      case "integer":
        type = "int";
        value = Math.trunc(num(v.data, 0));
        break;
      case "float":
        type = "float";
        value = num(v.data, 0);
        break;
      case "boolean":
        type = "bool";
        value = v.data === true || v.data === "true";
        break;
      case "component-list":
      case "asset-list": {
        type = v.type === "component-list" ? "component_list" : "asset_list";
        value = (Array.isArray(v.data) ? v.data : []).map((x) => lookup(typeof x === "string" ? x : null)).filter((x) => !!x);
        break;
      }
      default:
        type = "string";
        value = str(v.data);
        warn(`Attributtet «${a.name}» har ukjent type «${String(v.type)}» — importert som tekst.`, arcId);
    }
    attributes.push({
      id: newId("attribute", arcId),
      projectId,
      ownerKind,
      ownerId,
      name: str(a.name) || "attributt",
      type,
      value,
      customId: null,
      sortOrder: attrOrder++,
      createdAt: now,
      updatedAt: now
    });
  }
  const variables = [];
  const seenNames = /* @__PURE__ */ new Set();
  let varOrder = 0;
  for (const [arcId, v] of Object.entries(variablesIn)) {
    if (isArcweaveFolder(v)) continue;
    const rawName = str(v.name);
    let name = rawName;
    if (!VARIABLE_NAME_RE.test(name)) {
      name = sanitizeVariableName(rawName);
      warn(`Variabelen «${rawName}» fikk navnet «${name}» (kun bokstaver, tall og _).`, arcId);
    }
    if (seenNames.has(name)) {
      warn(`Variabelen «${name}» finnes flere ganger — bare den første ble importert.`, arcId);
      continue;
    }
    seenNames.add(name);
    const t = str(v.type).toLowerCase();
    const type = t === "integer" || t === "int" ? "int" : t === "float" ? "float" : t === "boolean" || t === "bool" ? "bool" : "string";
    const defaultValue = type === "int" ? Math.trunc(num(v.value, 0)) : type === "float" ? num(v.value, 0) : type === "bool" ? v.value === true || v.value === "true" : str(v.value);
    variables.push({ id: newId("variable", arcId), projectId, name, type, defaultValue, sortOrder: varOrder++, createdAt: now, updatedAt: now });
  }
  const startingElementId = lookup(project.startingElement);
  if (project.startingElement && !startingElementId) warn("Startelementet i Arcweave-prosjektet finnes ikke.", project.startingElement);
  const coverAssetId = assetRef((_k = project.cover) != null ? _k : null);
  return {
    graph: {
      settings: { projectId, title: str(project.name) || null, startingElementId, coverAssetId, schemaVersion: 1, updatedAt: now, locales: ["nb"], i18n: {} },
      boards,
      elements,
      connections,
      components,
      elementComponents,
      attributes,
      variables,
      assets
    },
    warnings
  };
}

// shared/narrative-format/text.ts
function htmlToPlainText(html) {
  if (!html) return "";
  const text = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n").replace(/<li[^>]*>/gi, "- ").replace(/<[^>]+>/g, "");
  return decodeEntities(text).replace(/ /g, " ").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// shared/narrative-format/locale.ts
var SOURCE_LOCALE = "nb";
function proseChunks(html) {
  if (!html) return [];
  return segmentContentHtml(html).filter((s) => s.kind === "html").map((s) => s.html);
}
function mergeCodeBlocks(sourceHtml, translatedHtml) {
  var _a;
  if (!translatedHtml) return sourceHtml;
  const sourceSegments = segmentContentHtml(sourceHtml);
  if (!sourceSegments.some((s) => s.kind === "code")) return translatedHtml;
  const translated = proseChunks(translatedHtml);
  let k = 0;
  const out = [];
  for (const seg of sourceSegments) {
    if (seg.kind === "code") {
      out.push(seg.rawHtml);
      continue;
    }
    out.push((_a = translated[k]) != null ? _a : seg.html);
    k += 1;
  }
  for (; k < translated.length; k += 1) out.push(translated[k]);
  return out.join("");
}
function applyLocaleToGraph(graph, locale) {
  var _a, _b;
  if (!locale || locale === SOURCE_LOCALE) return graph;
  const settingsTitle = (_b = (_a = graph.settings.i18n) == null ? void 0 : _a[locale]) == null ? void 0 : _b.title;
  return {
    ...graph,
    settings: { ...graph.settings, title: (settingsTitle == null ? void 0 : settingsTitle.trim()) ? settingsTitle.trim() : graph.settings.title },
    elements: graph.elements.map((e) => {
      var _a2, _b2, _c;
      const o = (_a2 = e.i18n) == null ? void 0 : _a2[locale];
      if (!o) return e;
      return {
        ...e,
        titleHtml: ((_b2 = o.titleHtml) == null ? void 0 : _b2.trim()) ? o.titleHtml : e.titleHtml,
        contentHtml: ((_c = o.contentHtml) == null ? void 0 : _c.trim()) ? mergeCodeBlocks(e.contentHtml, o.contentHtml) : e.contentHtml
      };
    }),
    connections: graph.connections.map((c) => {
      var _a2, _b2;
      const o = (_a2 = c.i18n) == null ? void 0 : _a2[locale];
      if (!((_b2 = o == null ? void 0 : o.labelHtml) == null ? void 0 : _b2.trim())) return c;
      return { ...c, labelHtml: mergeCodeBlocks(c.labelHtml, o.labelHtml) };
    })
  };
}

// shared/narrative-format/standalone.ts
var TYPED_ATTRIBUTES = /* @__PURE__ */ new Set(["bool", "int", "float", "string"]);
function toRuntimeSubset(graph) {
  return {
    settings: { startingElementId: graph.settings.startingElementId },
    boards: graph.boards.map((b) => {
      var _a;
      return { id: b.id, name: b.name, customId: (_a = b.customId) != null ? _a : null };
    }),
    elements: graph.elements.filter((e) => e.kind !== "note").map((e) => {
      var _a;
      return {
        id: e.id,
        boardId: e.boardId,
        kind: e.kind,
        titleHtml: e.titleHtml,
        contentHtml: e.contentHtml,
        customId: e.customId,
        jumperTargetId: e.jumperTargetId,
        branchConditions: e.branchConditions,
        sortOrder: (_a = e.sortOrder) != null ? _a : 0
      };
    }),
    connections: graph.connections.map((c) => {
      var _a;
      return {
        id: c.id,
        sourceId: c.sourceId,
        targetId: c.targetId,
        sourceOutputKey: c.sourceOutputKey,
        labelHtml: c.labelHtml,
        sortOrder: (_a = c.sortOrder) != null ? _a : 0
      };
    }),
    components: graph.components.map((c) => {
      var _a;
      return { id: c.id, name: c.name, customId: (_a = c.customId) != null ? _a : null };
    }),
    elementComponents: graph.elementComponents.map((ec) => {
      var _a;
      return { elementId: ec.elementId, componentId: ec.componentId, sortOrder: (_a = ec.sortOrder) != null ? _a : 0 };
    }),
    attributes: graph.attributes.filter((a) => a.ownerKind !== "element" && TYPED_ATTRIBUTES.has(a.type)).map((a) => ({ ownerKind: a.ownerKind, ownerId: a.ownerId, name: a.name, type: a.type, value: a.value })),
    variables: graph.variables.map((v) => ({ id: v.id, name: v.name, type: v.type, defaultValue: v.defaultValue }))
  };
}

// shared/narrative-runtime-pkg/sample.ts
var code = (s) => `<pre><code>${s}</code></pre>`;
var SAMPLE_GRAPH = {
  settings: { title: "Pungen", startingElementId: "nel_start", coverAssetId: null },
  boards: [{ id: "nbd_main", name: "Landsbyen", customId: "village", folderPath: "", sortOrder: 0 }],
  elements: [
    { id: "nel_start", boardId: "nbd_main", kind: "element", titleHtml: "<p>Torget</p>", contentHtml: `<p>Du finner en pung på torget.</p>${code("gold += 10")}${code("if visits() > 1")}<p>Pungen er lettere denne gangen.</p>${code("gold -= 5")}${code("endif")}`, x: 40, y: 80, width: 260, height: 120, theme: "green", coverAssetId: null, customId: "start", jumperTargetId: null, branchConditions: [], sortOrder: 0 },
    { id: "nel_market", boardId: "nbd_main", kind: "element", titleHtml: "<p>Markedet</p>", contentHtml: `${code("if gold >= 10 and not visits(@[rich])")}<p>Kjøpmannen smiler.</p>${code("elseif gold > 0")}<p>Kjøpmannen nikker.</p>${code("else")}<p>Kjøpmannen snur ryggen til.</p>${code("endif")}`, x: 400, y: 80, width: 260, height: 120, theme: "amber", coverAssetId: null, customId: "market", jumperTargetId: null, branchConditions: [], sortOrder: 1 },
    { id: "nel_choice", boardId: "nbd_main", kind: "branch", titleHtml: "", contentHtml: "", x: 760, y: 80, width: 200, height: 80, theme: "default", coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: "c_rich", script: "gold >= 10", label: "Rik" }, { id: "c_poor", script: null, label: "Ellers" }], sortOrder: 2 },
    { id: "nel_rich", boardId: "nbd_main", kind: "element", titleHtml: "<p>Rik</p>", contentHtml: "<p>Du kjøper et sverd.</p>", x: 1100, y: 20, width: 260, height: 120, theme: "blue", coverAssetId: null, customId: "rich", jumperTargetId: null, branchConditions: [], sortOrder: 3 },
    { id: "nel_poor", boardId: "nbd_main", kind: "element", titleHtml: "<p>Fattig</p>", contentHtml: "<p>Tomme lommer.</p>", x: 1100, y: 200, width: 260, height: 120, theme: "red", coverAssetId: null, customId: "poor", jumperTargetId: null, branchConditions: [], sortOrder: 4 },
    { id: "nel_end", boardId: "nbd_main", kind: "element", titleHtml: "<p>Slutt</p>", contentHtml: "<p>Historien er over.</p>", x: 1450, y: 20, width: 260, height: 120, theme: "gray", coverAssetId: null, customId: "end", jumperTargetId: null, branchConditions: [], sortOrder: 5 },
    { id: "nel_giveup", boardId: "nbd_main", kind: "branch", titleHtml: "", contentHtml: "", x: 1450, y: 200, width: 200, height: 80, theme: "default", coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [{ id: "c_giveup", script: "gold < 0 or not brave", label: "Gir opp" }, { id: "c_again", script: null, label: "Igjen" }], sortOrder: 6 },
    { id: "nel_jump", boardId: "nbd_main", kind: "jumper", titleHtml: "", contentHtml: "", x: 1800, y: 200, width: 160, height: 60, theme: "default", coverAssetId: null, customId: null, jumperTargetId: "nel_start", branchConditions: [], sortOrder: 7 }
  ],
  connections: [
    { id: "ncn_k1", boardId: "nbd_main", sourceId: "nel_start", targetId: "nel_market", sourceOutputKey: "default", labelHtml: "<p>Gå til markedet</p>", sortOrder: 0 },
    { id: "ncn_k2", boardId: "nbd_main", sourceId: "nel_start", targetId: "nel_end", sourceOutputKey: "default", labelHtml: "<p>Gå hjem</p>", sortOrder: 1 },
    { id: "ncn_k3", boardId: "nbd_main", sourceId: "nel_market", targetId: "nel_choice", sourceOutputKey: "default", labelHtml: `<p>Handle</p>${code("gold -= 10")}`, sortOrder: 2 },
    { id: "ncn_k4", boardId: "nbd_main", sourceId: "nel_market", targetId: "nel_end", sourceOutputKey: "default", labelHtml: "<p>Gå videre uten å handle</p>", sortOrder: 3 },
    { id: "ncn_k5", boardId: "nbd_main", sourceId: "nel_choice", targetId: "nel_rich", sourceOutputKey: "c_rich", labelHtml: "", sortOrder: 4 },
    { id: "ncn_k6", boardId: "nbd_main", sourceId: "nel_choice", targetId: "nel_poor", sourceOutputKey: "c_poor", labelHtml: "", sortOrder: 5 },
    { id: "ncn_k7", boardId: "nbd_main", sourceId: "nel_rich", targetId: "nel_end", sourceOutputKey: "default", labelHtml: "<p>Ferdig</p>", sortOrder: 6 },
    { id: "ncn_k8", boardId: "nbd_main", sourceId: "nel_poor", targetId: "nel_giveup", sourceOutputKey: "default", labelHtml: "<p>Tilbake til torget</p>", sortOrder: 7 },
    { id: "ncn_k9", boardId: "nbd_main", sourceId: "nel_giveup", targetId: "nel_end", sourceOutputKey: "c_giveup", labelHtml: "", sortOrder: 8 },
    { id: "ncn_k10", boardId: "nbd_main", sourceId: "nel_giveup", targetId: "nel_jump", sourceOutputKey: "c_again", labelHtml: "", sortOrder: 9 }
  ],
  components: [{ id: "ncp_merchant", name: "Kjøpmannen", folderPath: "", coverAssetId: null, customId: "merchant", sortOrder: 0 }],
  elementComponents: [{ elementId: "nel_market", componentId: "ncp_merchant", sortOrder: 0 }],
  attributes: [{ id: "nat_mood", ownerKind: "component", ownerId: "ncp_merchant", name: "mood", type: "string", value: "grådig", sortOrder: 0 }],
  variables: [
    { id: "nvr_gold", name: "gold", type: "int", defaultValue: 0, sortOrder: 0 },
    { id: "nvr_brave", name: "brave", type: "bool", defaultValue: true, sortOrder: 1 }
  ],
  assets: []
};

// shared/narrative-format/export.ts
var VARIABLE_TYPE_OUT = {
  int: "integer",
  float: "float",
  bool: "boolean",
  string: "string"
};
function bySort(list) {
  return [...list].sort((a, b) => {
    var _a, _b;
    return ((_a = a.sortOrder) != null ? _a : 0) - ((_b = b.sortOrder) != null ? _b : 0);
  });
}
function coerceVariableValue(type, value) {
  switch (type) {
    case "int": {
      const n = Number(value);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    }
    case "float": {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    case "bool":
      return value === true || value === "true" || value === 1;
    default:
      return value == null ? "" : String(value);
  }
}
function buildFolderTree(rootName, usedIds) {
  const folders = {};
  const idByPath = /* @__PURE__ */ new Map();
  const rootId = folderIdForPath(`${rootName}-root`, usedIds);
  folders[rootId] = { name: "Root", children: [], root: true };
  idByPath.set("", rootId);
  const ensure = (path) => {
    var _a;
    const existing = idByPath.get(path);
    if (existing) return existing;
    const segments = path.split("/").filter(Boolean);
    const parentPath = segments.slice(0, -1).join("/");
    const parentId = ensure(parentPath);
    const id = folderIdForPath(`${rootName}/${path}`, usedIds);
    folders[id] = { name: (_a = segments[segments.length - 1]) != null ? _a : path, children: [] };
    folders[parentId].children.push(id);
    idByPath.set(path, id);
    return id;
  };
  const add = (folderPath, leafId) => {
    const path = (folderPath != null ? folderPath : "").split("/").map((s) => s.trim()).filter(Boolean).join("/");
    folders[ensure(path)].children.push(leafId);
  };
  return { folders, add };
}
function attributeValue(a, id) {
  var _a;
  const list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string").map(id) : [];
  switch (a.type) {
    case "rich_text":
      return { data: a.value == null ? "" : String(a.value), type: "string", plain: false };
    case "string":
      return { data: a.value == null ? "" : String(a.value), type: "string", plain: true };
    case "bool":
      return { data: coerceVariableValue("bool", a.value), type: "boolean", plain: true };
    case "int":
      return { data: coerceVariableValue("int", a.value), type: "integer", plain: true };
    case "float":
      return { data: coerceVariableValue("float", a.value), type: "float", plain: true };
    case "component_list":
      return { data: list(a.value), type: "component-list", plain: true };
    case "asset_list":
      return { data: list(a.value), type: "asset-list", plain: true };
    default:
      return { data: (_a = a.value) != null ? _a : "", type: "string", plain: true };
  }
}
function toArcweaveProject(input, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  const graph = applyLocaleToGraph(input, options.locale);
  const mapper = (_a = options.idMapper) != null ? _a : createExportIdMapper();
  const id = (internal) => mapper.map(internal);
  const usedFolderIds = /* @__PURE__ */ new Set();
  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const boardIds = new Set(graph.boards.map((b) => b.id));
  const componentIds = new Set(graph.components.map((c) => c.id));
  const assetIds = new Set(graph.assets.map((a) => a.id));
  const connectionsBySource = /* @__PURE__ */ new Map();
  for (const c of bySort(graph.connections)) {
    const list = (_b = connectionsBySource.get(c.sourceId)) != null ? _b : [];
    list.push(c);
    connectionsBySource.set(c.sourceId, list);
  }
  const componentsByElement = /* @__PURE__ */ new Map();
  for (const ec of bySort(graph.elementComponents)) {
    if (!componentIds.has(ec.componentId)) continue;
    const list = (_c = componentsByElement.get(ec.elementId)) != null ? _c : [];
    list.push(ec.componentId);
    componentsByElement.set(ec.elementId, list);
  }
  const attributesByOwner = /* @__PURE__ */ new Map();
  for (const a of bySort(graph.attributes)) {
    const key = `${a.ownerKind}:${a.ownerId}`;
    const list = (_d = attributesByOwner.get(key)) != null ? _d : [];
    list.push(a);
    attributesByOwner.set(key, list);
  }
  const attrIds = (kind, ownerId) => {
    var _a2;
    return ((_a2 = attributesByOwner.get(`${kind}:${ownerId}`)) != null ? _a2 : []).map((a) => id(a.id));
  };
  const cover = (assetId) => assetId && assetIds.has(assetId) ? { cover: { id: id(assetId) } } : {};
  const boardTree = buildFolderTree("boards", usedFolderIds);
  const boards = {};
  const boardOut = /* @__PURE__ */ new Map();
  for (const b of bySort(graph.boards)) {
    const out = {
      name: b.name,
      customId: (_e = b.customId) != null ? _e : null,
      notes: [],
      jumpers: [],
      branches: [],
      elements: [],
      connections: []
    };
    const boardAttrs = attrIds("board", b.id);
    if (boardAttrs.length) out.attributes = boardAttrs;
    boards[id(b.id)] = out;
    boardOut.set(b.id, out);
    boardTree.add(b.folderPath, id(b.id));
  }
  Object.assign(boards, boardTree.folders);
  const elements = {};
  const branches = {};
  const conditions = {};
  const jumpers = {};
  const notes = {};
  const connections = {};
  const connectable = (e) => !!e && e.kind !== "note";
  const targetType = (e) => e.kind === "branch" ? "branches" : e.kind === "jumper" ? "jumpers" : "elements";
  for (const e of bySort(graph.elements)) {
    const board = boardOut.get(e.boardId);
    if (!board || !boardIds.has(e.boardId)) continue;
    const eid = id(e.id);
    switch (e.kind) {
      case "element": {
        const outputs = [];
        for (const c of (_f = connectionsBySource.get(e.id)) != null ? _f : []) {
          const target = elementById.get(c.targetId);
          if (!connectable(target)) continue;
          const cid = id(c.id);
          outputs.push(cid);
          connections[cid] = {
            type: "Straight",
            theme: "default",
            sourceid: eid,
            targetid: id(target.id),
            sourceType: "elements",
            targetType: targetType(target),
            label: ((_g = c.labelHtml) == null ? void 0 : _g.trim()) ? c.labelHtml : null
          };
          board.connections.push(cid);
        }
        const out = {
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
          theme: e.theme || "default",
          title: (_h = e.titleHtml) != null ? _h : "",
          content: (_i = e.contentHtml) != null ? _i : "",
          outputs,
          components: ((_j = componentsByElement.get(e.id)) != null ? _j : []).map(id),
          attributes: attrIds("element", e.id),
          assets: cover(e.coverAssetId)
        };
        if ((_k = e.customId) == null ? void 0 : _k.trim()) out.customId = e.customId.trim();
        elements[eid] = out;
        board.elements.push(eid);
        break;
      }
      case "branch": {
        const conds = e.branchConditions.length > 0 ? e.branchConditions : [{ id: `${e.id}-if`, script: "true", label: null }];
        const outgoing = (_l = connectionsBySource.get(e.id)) != null ? _l : [];
        const condIds = [];
        conds.forEach((cond, index) => {
          var _a2, _b2;
          const isLast = index === conds.length - 1;
          const isElse = isLast && cond.script == null && conds.length > 1;
          const condId = id(cond.id);
          condIds.push(condId);
          const conn = outgoing.find((c) => c.sourceOutputKey === cond.id);
          const target = conn ? elementById.get(conn.targetId) : void 0;
          let output = null;
          if (conn && connectable(target)) {
            const cid = id(conn.id);
            output = cid;
            connections[cid] = {
              type: "Straight",
              theme: "default",
              sourceid: condId,
              targetid: id(target.id),
              sourceType: "conditions",
              targetType: targetType(target),
              label: ((_a2 = conn.labelHtml) == null ? void 0 : _a2.trim()) ? conn.labelHtml : null
            };
            board.connections.push(cid);
          }
          conditions[condId] = isElse ? { output } : { script: ((_b2 = cond.script) == null ? void 0 : _b2.trim()) ? cond.script : "true", output };
        });
        const [ifCondition, ...rest] = condIds;
        const lastCond = conds[conds.length - 1];
        const hasElse = conds.length > 1 && lastCond.script == null;
        branches[eid] = {
          x: e.x,
          y: e.y,
          theme: e.theme || "default",
          conditions: {
            ifCondition,
            elseIfConditions: hasElse ? rest.slice(0, -1) : rest,
            elseCondition: hasElse ? rest[rest.length - 1] : null
          }
        };
        board.branches.push(eid);
        break;
      }
      case "jumper": {
        const target = e.jumperTargetId ? elementById.get(e.jumperTargetId) : void 0;
        jumpers[eid] = { x: e.x, y: e.y, elementId: target && target.kind === "element" ? id(target.id) : null };
        board.jumpers.push(eid);
        break;
      }
      case "note": {
        notes[eid] = { x: e.x, y: e.y, width: e.width, height: e.height, theme: e.theme || "default", content: (_m = e.contentHtml) != null ? _m : "" };
        board.notes.push(eid);
        break;
      }
      default:
        break;
    }
  }
  const componentTree = buildFolderTree("components", usedFolderIds);
  const components = {};
  for (const c of bySort(graph.components)) {
    const cid = id(c.id);
    components[cid] = {
      name: c.name,
      customId: (_n = c.customId) != null ? _n : null,
      attributes: attrIds("component", c.id),
      assets: cover(c.coverAssetId)
    };
    componentTree.add(c.folderPath, cid);
  }
  Object.assign(components, componentTree.folders);
  const attributes = {};
  for (const a of bySort(graph.attributes)) {
    const ownerExists = a.ownerKind === "element" ? elementById.has(a.ownerId) : a.ownerKind === "component" ? componentIds.has(a.ownerId) : boardIds.has(a.ownerId);
    if (!ownerExists) continue;
    attributes[id(a.id)] = {
      cId: id(a.ownerId),
      cType: a.ownerKind === "element" ? "elements" : a.ownerKind === "component" ? "components" : "boards",
      name: a.name,
      value: attributeValue(a, id)
    };
  }
  const variables = {};
  const variableRootId = folderIdForPath("variables-root", usedFolderIds);
  const variableChildren = [];
  for (const v of bySort(graph.variables)) {
    const vid = id(v.id);
    variables[vid] = {
      name: v.name,
      type: (_o = VARIABLE_TYPE_OUT[v.type]) != null ? _o : "string",
      cType: "global",
      value: coerceVariableValue(v.type, v.defaultValue)
    };
    variableChildren.push(vid);
  }
  variables[variableRootId] = { name: "Root", children: variableChildren, root: true };
  const assetTree = buildFolderTree("assets", usedFolderIds);
  const assets = {};
  for (const a of graph.assets) {
    const aid = id(a.id);
    assets[aid] = a.externalUrl ? { name: a.name, type: a.kind, url: a.externalUrl } : { name: a.name, type: a.kind };
    assetTree.add(a.folderPath, aid);
  }
  Object.assign(assets, assetTree.folders);
  const start = graph.settings.startingElementId ? elementById.get(graph.settings.startingElementId) : void 0;
  const coverAsset = graph.settings.coverAssetId && assetIds.has(graph.settings.coverAssetId) ? { id: id(graph.settings.coverAssetId) } : null;
  return {
    name: (_p = graph.settings.title) != null ? _p : "",
    cover: coverAsset,
    startingElement: start && start.kind === "element" ? id(start.id) : null,
    boards,
    notes,
    elements,
    jumpers,
    connections,
    branches,
    components,
    attributes,
    assets,
    variables,
    conditions
  };
}

// shared/narrative-runtime-pkg/index.ts
function sampleArcweaveProject() {
  return toArcweaveProject(SAMPLE_GRAPH);
}
function loadArcweaveProject(project) {
  let seq = 0;
  const { graph, warnings } = fromArcweaveProject(project, {
    projectId: "pkg",
    now: "1970-01-01T00:00:00.000Z",
    idFactory: (kind, sourceId) => sourceId != null ? sourceId : `${kind}_${++seq}`
  });
  return { graph: toRuntimeSubset(graph), warnings: warnings.map((w) => w.message) };
}
function createSessionFromArcweave(project, options = {}) {
  return createPlaySession(loadArcweaveProject(project).graph, options);
}
function playTranscript(graph, options = {}) {
  var _a, _b;
  const maxSteps = (_a = options.maxSteps) != null ? _a : 12;
  const pick = (_b = options.pick) != null ? _b : (() => 0);
  const session = createPlaySession(graph, { rng: () => 0.5 });
  const lines = [];
  const globalNames = [...graph.variables.map((v) => v.name)].sort();
  const vars = () => {
    const v = session.getState().variables;
    return globalNames.map((k) => `${k}=${formatValue2(v[k])}`).join(" ");
  };
  const dump = (view2) => {
    var _a2;
    if (!view2) {
      lines.push("(no view)");
      return;
    }
    lines.push(`@ ${((_a2 = view2.element.customId) == null ? void 0 : _a2.trim()) || view2.elementId} | ${htmlToPlainText(view2.element.titleHtml).trim()}`);
    const text = htmlToPlainText(view2.html).trim();
    if (text) lines.push(`  ${text.split(/\s*\n+\s*/).filter(Boolean).join(" / ")}`);
    view2.options.forEach((o, i) => lines.push(`  ${i + 1}) ${htmlToPlainText(o.labelHtml).trim()}`));
    if (view2.deadEnd) lines.push("  (end)");
    lines.push(`  vars: ${vars()}`);
  };
  let view = session.start();
  dump(view);
  for (let step = 0; step < maxSteps && view && !view.deadEnd && view.options.length > 0; step++) {
    const idx = Math.min(Math.max(pick(view.options.length, step), 0), view.options.length - 1);
    lines.push(`> choose ${idx + 1}`);
    view = session.choose(view.options[idx].connectionId);
    dump(view);
  }
  return `${lines.join("\n")}
`;
}
function formatValue2(v) {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e3) / 1e3);
  return JSON.stringify(v != null ? v : null);
}
export {
  ArcweaveImportError,
  SAMPLE_GRAPH,
  buildResolvers,
  buildScriptVariables,
  createPlaySession,
  createSessionFromArcweave,
  fromArcweaveProject,
  htmlToPlainText,
  loadArcweaveProject,
  playTranscript,
  sampleArcweaveProject,
  slugifyScopeName,
  toRuntimeSubset,
  validateScripts,
  validateStoryGraph
};
