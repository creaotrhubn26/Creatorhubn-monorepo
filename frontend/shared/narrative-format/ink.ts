/**
 * Ink (inkle) → Story Graph — bevisst DELSETT, verifisert mot
 * inkle/ink «Writing with ink»:
 *   knots `=== k ===`, stitches `= s`, diverts `-> k` / `-> k.s` / `-> END|DONE`,
 *   valg `*` (engang) og `+` (sticky) med `[ ]`-suppresjon, nesting og gates
 *   `* {cond} [..]`, gathers `-` (+ `(label)`), `VAR`/`CONST`, `~ x = 1`,
 *   `{cond: a | b}` inline, flerlinje `{ - cond: … - else: … }`, `<>` glue,
 *   linje- og blokkommentarer, `# tags`, `INCLUDE`.
 *
 * Tap som dokumenteres via warnings: engangs-valg importeres som vanlige valg,
 * sekvenser/sykluser/shuffle `{a|b}` `{&…}` `{!…}` `{~…}` beholdes som tekst,
 * INCLUDE løses ikke, LIST/EXTERNAL/funksjoner støttes ikke.
 */

import { createGraphBuilder, inferVariableType, partsToHtml, proseHtml, sanitizeVariableName, VARIABLE_NAME_RE, type ContentPart, type FromTextResult, type GraphBuilder, type TextImportOptions } from './text-import-common';

export class InkImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InkImportError';
  }
}

// ─── Forbehandling ──────────────────────────────────────────────────────

function preprocess(source: string): string[] {
  let s = source.replace(/\r\n?/g, '\n');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  return s.split('\n').map((line) => line.replace(/(^|\s)\/\/.*$/, '$1').replace(/\s+$/, ''));
}

// ─── Uttrykk ────────────────────────────────────────────────────────────

export function convertInkExpression(expr: string): string {
  let out = expr.trim();
  const strings: string[] = [];
  out = out.replace(/"(?:[^"\\]|\\.)*"/g, (m) => { strings.push(m); return `⟨${strings.length - 1}⟩`; });
  out = out.replace(/\bnot\b/g, '!').replace(/\bmod\b/g, '%');
  out = out.replace(/\btrue\b/g, 'true').replace(/\bfalse\b/g, 'false');
  // Ink tillater `=` som sammenligning i betingelser.
  out = out.replace(/(^|[^=!<>])=(?!=)/g, '$1==');
  out = out.replace(/⟨(\d+)⟩/g, (_m, i: string) => strings[Number(i)]);
  return out.replace(/\s+/g, ' ').trim();
}

function convertInkAssignment(stmt: string): string {
  const m = stmt.match(/^([A-Za-z_][\w]*)\s*(\+=|-=|\*=|\/=|%=|=)\s*(.+)$/);
  if (!m) return convertInkExpression(stmt);
  return `${sanitizeVariableName(m[1])} ${m[2]} ${convertInkExpression(m[3])}`;
}

// ─── Flyt-modell ────────────────────────────────────────────────────────

type FlowNode =
  | { kind: 'text'; text: string }
  | { kind: 'code'; code: string }
  | { kind: 'divert'; target: string }
  | { kind: 'choice'; sticky: boolean; label: string; gates: string[]; name: string | null; body: FlowNode[] }
  | { kind: 'gather'; name: string | null; body: FlowNode[] }
  | { kind: 'cond'; branches: Array<{ cond: string | null; body: FlowNode[] }> };

interface Container {
  /** Fullt navn: «knot» eller «knot.stitch». */
  name: string;
  title: string;
  flow: FlowNode[];
}

const KNOT_RE = /^={2,}\s*([A-Za-z_][\w]*)\s*(\([^)]*\))?\s*=*\s*$/;
const STITCH_RE = /^=\s*([A-Za-z_][\w]*)\s*(\([^)]*\))?\s*$/;
const CHOICE_RE = /^([*+])((?:\s*[*+])*)\s*(.*)$/;
const GATHER_RE = /^(-)((?:\s*-)*)(?!>)\s*(.*)$/;

function markerDepth(first: string, rest: string): number {
  return 1 + (rest.match(/[*+-]/g)?.length ?? 0);
}

function splitInlineDivert(text: string): { text: string; divert: string | null } {
  const m = text.match(/^(.*?)\s*->\s*([A-Za-z_][\w.]*)\s*$/);
  if (m) return { text: m[1], divert: m[2] };
  return { text, divert: null };
}

/**
 * Parser linjene i en beholder til en flyt. `depth` er valgnivået vi står på;
 * linjer tolkes til vi møter et valg/gather på lavere nivå.
 */
class FlowParser {
  private i = 0;
  constructor(private readonly lines: string[], private readonly b: GraphBuilder, private readonly declare: (name: string, literal: string | null) => void) {}

  get done(): boolean { return this.i >= this.lines.length; }

  parseBlock(depth: number, stopAtGather: boolean): FlowNode[] {
    const nodes: FlowNode[] = [];
    while (this.i < this.lines.length) {
      const raw = this.lines[this.i];
      const line = raw.trim();
      if (!line) { this.i += 1; nodes.push({ kind: 'text', text: '\n' }); continue; }

      const choice = line.match(CHOICE_RE);
      if (choice) {
        const d = markerDepth(choice[1], choice[2]);
        if (d < depth) break;
        if (d > depth && nodes.length === 0) { /* dypere valg uten forelder: behandle på dette nivået */ }
        if (d > depth) { break; }
        this.i += 1;
        nodes.push(this.parseChoice(choice[1] === '+', choice[3], depth));
        continue;
      }
      const gather = line.match(GATHER_RE);
      if (gather) {
        const d = markerDepth(gather[1], gather[2]);
        if (d < depth || (d === depth && stopAtGather)) break;
        this.i += 1;
        let rest = gather[3];
        let name: string | null = null;
        const lm = rest.match(/^\(([A-Za-z_]\w*)\)\s*(.*)$/);
        if (lm) { name = lm[1]; rest = lm[2]; }
        const body: FlowNode[] = [];
        this.pushTextLine(body, rest);
        body.push(...this.parseBlock(depth + (d > depth ? 1 : 0), false));
        nodes.push({ kind: 'gather', name, body });
        continue;
      }

      if (line.startsWith('~')) {
        this.i += 1;
        const stmt = line.slice(1).trim();
        const asg = stmt.match(/^([A-Za-z_]\w*)\s*(?:\+=|-=|\*=|\/=|%=|=)\s*(.+)$/);
        if (asg) this.declare(sanitizeVariableName(asg[1]), asg[2]);
        if (/^(temp)\s/.test(stmt)) { this.b.warn('«~ temp» importert som vanlig variabel.'); nodes.push({ kind: 'code', code: convertInkAssignment(stmt.replace(/^temp\s+/, '')) }); }
        else if (/^[A-Za-z_]\w*\s*\(/.test(stmt) || /^return\b/.test(stmt)) { this.b.unsupported += 1; this.b.warn(`Setningen «~ ${stmt}» støttes ikke og ble droppet.`); }
        else nodes.push({ kind: 'code', code: convertInkAssignment(stmt) });
        continue;
      }
      if (line.startsWith('{') && !line.includes('}')) {
        this.i += 1;
        nodes.push(this.parseCondBlock(line.slice(1).trim(), depth));
        continue;
      }
      if (line.startsWith('->') ) {
        this.i += 1;
        const target = line.slice(2).trim().replace(/\s.*$/, '');
        nodes.push({ kind: 'divert', target });
        continue;
      }
      this.i += 1;
      this.pushTextLine(nodes, line);
    }
    return nodes;
  }

  private pushTextLine(nodes: FlowNode[], line: string): void {
    let text = line.replace(/\s*#[^#]*$/g, (m) => (m.trim().startsWith('#') ? '' : m)).trim();
    // Tags: alt etter første ' #' på linjen.
    const tagIdx = text.search(/(^|\s)#\S/);
    if (tagIdx >= 0) text = text.slice(0, tagIdx).trim();
    if (!text) return;
    const { text: body, divert } = splitInlineDivert(text);
    const glue = body.endsWith('<>');
    const clean = glue ? body.slice(0, -2) : body;
    if (clean.trim()) nodes.push({ kind: 'text', text: clean + (glue ? '' : '\n') });
    if (divert) nodes.push({ kind: 'divert', target: divert });
  }

  private parseChoice(sticky: boolean, rest: string, depth: number): FlowNode {
    const gates: string[] = [];
    let text = rest.trim();
    let gateMatch: RegExpMatchArray | null;
    while ((gateMatch = text.match(/^\{([^}]*)\}\s*(.*)$/))) { gates.push(convertInkExpression(gateMatch[1])); text = gateMatch[2]; }
    let name: string | null = null;
    const nm = text.match(/^\(([A-Za-z_]\w*)\)\s*(.*)$/);
    if (nm) { name = nm[1]; text = nm[2]; }
    // [valgtekst] + fortsettelse: etikett = før + [inni]; kropp-tekst = før + etter.
    let label = text;
    let firstLine = text;
    const br = text.match(/^(.*?)\[(.*?)\](.*)$/);
    if (br) { label = (br[1] + br[2]).trim(); firstLine = (br[1] + br[3]).trim(); }
    const { text: firstClean, divert } = splitInlineDivert(firstLine);
    const { text: labelClean } = splitInlineDivert(label);
    const body: FlowNode[] = [];
    if (firstClean.trim() && firstClean.trim() !== labelClean.trim()) body.push({ kind: 'text', text: `${firstClean}\n` });
    if (divert) body.push({ kind: 'divert', target: divert });
    else body.push(...this.parseBlock(depth + 1, true));
    return { kind: 'choice', sticky, label: labelClean.trim(), gates, name, body };
  }

  private parseCondBlock(header: string, depth: number): FlowNode {
    // Former: `{ cond:` … `}`  eller `{` newline `- cond: …` `- else: …` `}`
    const branches: Array<{ cond: string | null; body: FlowNode[] }> = [];
    let current: { cond: string | null; body: FlowNode[] } | null = null;
    const h = header.match(/^(.*?):\s*(.*)$/);
    if (h && h[1].trim()) { current = { cond: convertInkExpression(h[1]), body: [] }; branches.push(current); if (h[2].trim()) this.pushTextLine(current.body, h[2]); }
    while (this.i < this.lines.length) {
      const line = this.lines[this.i].trim();
      if (line === '}' || line.startsWith('}')) { this.i += 1; break; }
      const bm = line.match(/^-\s*(?:else\s*:|(.+?):)\s*(.*)$/);
      if (bm && (bm[1] === undefined || !bm[1].includes('->'))) {
        this.i += 1;
        current = { cond: bm[1] === undefined ? null : convertInkExpression(bm[1]), body: [] };
        branches.push(current);
        if (bm[2].trim()) this.pushTextLine(current.body, bm[2]);
        continue;
      }
      if (!current) { current = { cond: null, body: [] }; branches.push(current); }
      this.i += 1;
      if (line.startsWith('~')) { current.body.push({ kind: 'code', code: convertInkAssignment(line.slice(1).trim()) }); continue; }
      this.pushTextLine(current.body, line);
    }
    void depth;
    return { kind: 'cond', branches };
  }
}

// ─── Inline `{…}` i tekst ───────────────────────────────────────────────

function expandInline(text: string, b: GraphBuilder): ContentPart[] {
  const parts: ContentPart[] = [];
  let last = 0;
  const re = /\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    parts.push({ kind: 'text', text: text.slice(last, m.index) });
    last = m.index + m[0].length;
    const inner = m[1];
    const colon = inner.indexOf(':');
    if (colon > 0 && !/^[&!~]/.test(inner) && !inner.slice(0, colon).includes('|')) {
      const cond = convertInkExpression(inner.slice(0, colon));
      const [yes, no] = inner.slice(colon + 1).split('|');
      parts.push({ kind: 'code', code: `if ${cond}` });
      parts.push({ kind: 'text', text: (yes ?? '').trim() });
      if (no !== undefined) { parts.push({ kind: 'code', code: 'else' }); parts.push({ kind: 'text', text: no.trim() }); }
      parts.push({ kind: 'code', code: 'endif' });
    } else if (inner.includes('|')) {
      b.unsupported += 1;
      b.warn(`Sekvensen «{${inner}}» støttes ikke — alternativene er beholdt som tekst.`);
      parts.push({ kind: 'text', text: inner.replace(/^[&!~]/, '').split('|').map((s) => s.trim()).filter(Boolean).join(' / ') });
    } else if (/^[A-Za-z_]\w*$/.test(inner.trim())) {
      // Variabel-utskrift {x} → show(x)
      parts.push({ kind: 'code', code: `show(${sanitizeVariableName(inner.trim())})` });
    } else {
      b.unsupported += 1;
      b.warn(`Uttrykket «{${inner}}» støttes ikke og er beholdt som tekst.`);
      parts.push({ kind: 'text', text: inner });
    }
  }
  parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

// ─── Graf-emittering ────────────────────────────────────────────────────

interface Emitter {
  b: GraphBuilder;
  boardId: string;
  resolveLater: Array<{ sourceId: string; target: string; label: string }>;
  labels: Map<string, string>; // ink-navn → element-id
  onceCount: number;
}

interface Segment {
  parts: ContentPart[];
  title: string;
}

function flushSegment(em: Emitter, seg: Segment, prevId: string | null, prevLabel: string): string {
  const el = em.b.addElement({ boardId: em.boardId, titleHtml: proseHtml(seg.title), contentHtml: partsToHtml(seg.parts) });
  if (prevId) em.b.addConnection({ sourceId: prevId, targetId: el.id, labelHtml: prevLabel ? proseHtml(prevLabel) : '' });
  return el.id;
}

/**
 * Emitter en flyt. Returnerer id på siste element (eller null hvis flyten
 * endte i en divert/END) — kalleren kobler videre derfra.
 */
function emitFlow(em: Emitter, flow: FlowNode[], title: string, entryId: string | null, entryLabel: string, registerName: string | null): { tailId: string | null; headId: string | null } {
  let seg: Segment | null = null;
  let headId: string | null = null;
  let tailId: string | null = entryId;
  let pendingLabel = entryLabel;
  let ended = false;
  let segCount = 0;

  const ensureSeg = () => { if (!seg) seg = { parts: [], title: segCount === 0 ? title : `${title} (${segCount + 1})` }; };
  const closeSeg = () => {
    if (!seg) return;
    const id = flushSegment(em, seg, tailId, pendingLabel);
    if (!headId) headId = id;
    if (registerName && segCount === 0) em.labels.set(registerName, id);
    tailId = id;
    pendingLabel = '';
    seg = null;
    segCount += 1;
  };

  let i = 0;
  while (i < flow.length) {
    const node = flow[i];
    if (ended && node.kind !== 'gather' && node.kind !== 'choice') { i += 1; continue; }
    switch (node.kind) {
      case 'text': ensureSeg(); seg!.parts.push(...expandInline(node.text, em.b)); break;
      case 'code': ensureSeg(); seg!.parts.push({ kind: 'code', code: node.code }); break;
      case 'cond': {
        ensureSeg();
        node.branches.forEach((br, idx) => {
          seg!.parts.push({ kind: 'code', code: br.cond == null ? 'else' : idx === 0 ? `if ${br.cond}` : `elseif ${br.cond}` });
          for (const n of br.body) {
            if (n.kind === 'text') seg!.parts.push(...expandInline(n.text, em.b));
            else if (n.kind === 'code') seg!.parts.push({ kind: 'code', code: n.code });
            else if (n.kind === 'divert') { em.b.warn('Divert inne i betinget blokk støttes ikke — droppet.'); em.b.unsupported += 1; }
          }
        });
        seg!.parts.push({ kind: 'code', code: 'endif' });
        break;
      }
      case 'divert': {
        if (!seg && !tailId) { ensureSeg(); }
        closeSeg();
        if (node.target === 'END' || node.target === 'DONE') { ended = true; break; }
        if (tailId) em.resolveLater.push({ sourceId: tailId, target: node.target, label: '' });
        ended = true;
        break;
      }
      case 'choice': {
        // Alle påfølgende valg på dette nivået henger på samme kilde-element.
        ensureSeg();
        closeSeg();
        const sourceId = tailId!;
        const choices: FlowNode[] = [];
        while (i < flow.length && flow[i].kind === 'choice') { choices.push(flow[i]); i += 1; }
        const tails: string[] = [];
        for (const c of choices) {
          if (c.kind !== 'choice') continue;
          if (!c.sticky) em.onceCount += 1;
          let from = sourceId;
          let label = c.label;
          if (c.gates.length) {
            const branch = em.b.addElement({
              boardId: em.boardId, kind: 'branch', titleHtml: proseHtml(c.label || 'Valg-gate'),
              branchConditions: [{ id: '', script: c.gates.join(' and '), label: 'gate' }, { id: '', script: null, label: 'ellers' }],
            });
            // ids fylles av normalisering ved import; her setter vi dem selv.
            branch.branchConditions = branch.branchConditions.map((cond, k) => ({ ...cond, id: `${branch.id}-c${k}` }));
            em.b.addConnection({ sourceId, targetId: branch.id, labelHtml: proseHtml(c.label) });
            em.b.warn(`Valg-gaten «{${c.gates.join(' and ')}}» er importert som forgrening; «ellers»-grenen er ukoblet.`, c.label || undefined);
            from = branch.id;
            label = '';
            const res = emitFlow(em, c.body, c.label || 'Valg', null, '', c.name);
            if (res.headId) em.b.addConnection({ sourceId: from, targetId: res.headId, sourceOutputKey: branch.branchConditions[0].id });
            if (res.tailId) tails.push(res.tailId);
            continue;
          }
          const res = emitFlow(em, c.body, c.label || 'Valg', from, label, c.name);
          if (res.tailId) tails.push(res.tailId);
        }
        // Gather etter valgene?
        if (i < flow.length && flow[i].kind === 'gather') {
          const g = flow[i] as Extract<FlowNode, { kind: 'gather' }>;
          i += 1;
          const res = emitFlow(em, g.body, g.name ?? `${title} – samling`, null, '', g.name);
          if (res.headId) for (const t of tails) em.b.addConnection({ sourceId: t, targetId: res.headId });
          tailId = res.tailId;
          ended = res.tailId === null;
        } else {
          tailId = null;
          ended = true;
        }
        continue;
      }
      case 'gather': {
        closeSeg();
        const res = emitFlow(em, node.body, node.name ?? `${title} – samling`, tailId, pendingLabel, node.name);
        pendingLabel = '';
        tailId = res.tailId;
        ended = res.tailId === null;
        break;
      }
      default: break;
    }
    i += 1;
  }
  closeSeg();
  return { tailId: ended ? null : tailId, headId: headId ?? (registerName ? em.labels.get(registerName) ?? null : null) };
}

// ─── Hovedfunksjon ──────────────────────────────────────────────────────

export function fromInk(source: string, options: TextImportOptions): FromTextResult {
  if (typeof source !== 'string' || !source.trim()) throw new InkImportError('Fila er tom.');
  const lines = preprocess(source);
  const looksLikeInk = lines.some((l) => KNOT_RE.test(l.trim()) || /^\s*(->|VAR\s|[*+]\s)/.test(l));
  if (!looksLikeInk) throw new InkImportError('Fila ser ikke ut som Ink (ingen knots, valg eller diverts).');

  const b = createGraphBuilder(options);
  const title = options.title ?? 'Ink-import';
  const board = b.addBoard(title);
  const declare = (name: string, literal: string | null) => {
    if (!VARIABLE_NAME_RE.test(name) || b.hasVariable(name)) return;
    const { type, value } = inferVariableType(literal);
    b.addVariable(name, type, value);
  };

  // Del i beholdere (topp-nivå, knots, stitches) og trekk ut globale deklarasjoner.
  const containers: Container[] = [];
  let current: Container = { name: '', title: 'Start', flow: [] };
  let currentLines: string[] = [];
  let knotName = '';
  const flushContainer = () => {
    const parser = new FlowParser(currentLines, b, declare);
    current.flow = parser.parseBlock(1, false);
    // Rest på lavere nivå (bør ikke skje) — les alt som er igjen.
    while (!parser.done) current.flow.push(...parser.parseBlock(1, false));
    containers.push(current);
    currentLines = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const knot = line.match(KNOT_RE);
    if (knot) {
      flushContainer();
      knotName = knot[1];
      if (knot[2]) b.warn(`Knot-parametre «${knot[1]}${knot[2]}» støttes ikke — ignorert.`, knot[1]);
      current = { name: knotName, title: knotName, flow: [] };
      continue;
    }
    const stitch = line.match(STITCH_RE);
    if (stitch && knotName) {
      flushContainer();
      current = { name: `${knotName}.${stitch[1]}`, title: `${knotName} › ${stitch[1]}`, flow: [] };
      continue;
    }
    const decl = line.match(/^(VAR|CONST)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (decl) {
      const literal = decl[3].trim();
      if (literal.startsWith('->')) { b.warn(`Variabelen «${decl[2]}» holder en divert — importert som tekst.`, decl[2]); declare(sanitizeVariableName(decl[2]), `"${literal}"`); }
      else declare(sanitizeVariableName(decl[2]), literal);
      if (decl[1] === 'CONST') b.warn(`CONST «${decl[2]}» importert som vanlig variabel.`, decl[2]);
      continue;
    }
    if (/^INCLUDE\s/.test(line)) { b.warn(`«${line}» er ikke løst — importer fila separat.`); b.unsupported += 1; continue; }
    if (/^(LIST|EXTERNAL)\s/.test(line) || /^===\s*function\b/.test(line)) { b.warn(`«${line.slice(0, 40)}» støttes ikke.`); b.unsupported += 1; continue; }
    currentLines.push(raw);
  }
  flushContainer();

  const em: Emitter = { b, boardId: board.id, resolveLater: [], labels: new Map(), onceCount: 0 };
  const heads = new Map<string, string>();
  for (const c of containers) {
    const hasContent = c.flow.some((n) => n.kind !== 'text' || n.text.trim());
    if (!hasContent) continue;
    const res = emitFlow(em, c.flow, c.title, null, '', c.name || null);
    if (res.headId) heads.set(c.name, res.headId);
    // Første stitch er standard-mål for knot uten eget innhold.
    if (res.headId && c.name.includes('.')) {
      const knot = c.name.split('.')[0];
      if (!heads.has(knot)) heads.set(knot, res.headId);
    }
  }
  // Knot som bare har stitches: knot-navn → første stitch (allerede satt). Stitch-navn uten knot-prefiks: «stitch» → «knot.stitch»?
  for (const { sourceId, target, label } of em.resolveLater) {
    const direct = heads.get(target) ?? em.labels.get(target);
    let targetId = direct ?? null;
    if (!targetId) {
      // Relativ stitch-referanse: prøv «<knot>.<target>» for kildeelementets knot.
      const candidate = [...heads.entries()].find(([name]) => name.endsWith(`.${target}`));
      targetId = candidate?.[1] ?? null;
    }
    if (!targetId) { b.warn(`Diverten «-> ${target}» peker på noe som ikke finnes.`, target); b.unsupported += 1; continue; }
    b.addConnection({ sourceId, targetId, labelHtml: label ? proseHtml(label) : '' });
  }
  if (em.onceCount > 0) b.warn(`${em.onceCount} engangs-valg (*) er importert som vanlige valg — Story Graph har ikke engangs-semantikk ennå.`);

  const startId = heads.get('') ?? [...heads.values()][0] ?? null;
  b.autoLayout(startId);
  return b.finish({ title, startingElementId: startId });
}
