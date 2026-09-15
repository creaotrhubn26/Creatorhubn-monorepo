/**
 * Twine (Twee 3) → Story Graph.
 *
 * Verifisert mot Twee 3-spesifikasjonen (iftechfoundation/twine-specs) og
 * twinejs' lenke-parser: `:: Navn [tags] {json}`-hoder, StoryTitle/StoryData,
 * lenkeformene `[[tekst|mål]]`, `[[tekst->mål]]`, `[[mål<-tekst]]`, `[[mål]]`
 * (+ setter-suffiks `][…]`). SugarCube 2-makroer etter tmedwards' docs;
 * Harlowe-makroer er best-effort (dokumentasjonen var ikke tilgjengelig).
 *
 * Makroer som ikke kan oversettes til arcscript beholdes som synlig tekst
 * og gir en advarsel — ingenting forsvinner stille.
 */

import { createGraphBuilder, inferVariableType, partsToHtml, proseHtml, sanitizeVariableName, VARIABLE_NAME_RE, type ContentPart, type FromTextResult, type GraphBuilder, type TextImportOptions } from './text-import-common';

export class TweeImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TweeImportError';
  }
}

type Dialect = 'sugarcube' | 'harlowe' | 'unknown';

interface Passage {
  name: string;
  tags: string[];
  metadata: Record<string, unknown>;
  body: string;
}

interface LinkRef {
  text: string;
  target: string;
  setter: string | null;
}

// ─── Hode-parsing ───────────────────────────────────────────────────────

function parseHeader(line: string): { name: string; tags: string[]; metadata: Record<string, unknown> } {
  let i = 2;
  let name = '';
  const tags: string[] = [];
  let metadata: Record<string, unknown> = {};
  const n = line.length;
  // Navn: til første u-escapede `[` eller `{`.
  while (i < n) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < n) { name += line[i + 1]; i += 2; continue; }
    if (ch === '[' || ch === '{') break;
    name += ch;
    i += 1;
  }
  name = name.trim();
  // Tag-blokk
  if (line[i] === '[') {
    let raw = '';
    i += 1;
    while (i < n) {
      const ch = line[i];
      if (ch === '\\' && i + 1 < n) { raw += line[i + 1]; i += 2; continue; }
      if (ch === ']') { i += 1; break; }
      raw += ch;
      i += 1;
    }
    tags.push(...raw.split(/\s+/).map((t) => t.trim()).filter(Boolean));
    while (i < n && line[i] === ' ') i += 1;
  }
  // Metadata-blokk (JSON)
  if (line[i] === '{') {
    const json = line.slice(i).trim();
    try {
      const parsed = JSON.parse(json) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
    } catch { /* ugyldig metadata ignoreres */ }
  }
  return { name, tags, metadata };
}

function splitPassages(source: string): Passage[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const passages: Passage[] = [];
  let current: Passage | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (!current) return;
    while (buffer.length && !buffer[buffer.length - 1].trim()) buffer.pop();
    current.body = buffer.join('\n');
    passages.push(current);
  };
  for (const line of lines) {
    if (line.startsWith('::')) {
      flush();
      const h = parseHeader(line);
      current = { name: h.name, tags: h.tags, metadata: h.metadata, body: '' };
      buffer = [];
    } else if (current) {
      buffer.push(line);
    }
  }
  flush();
  return passages;
}

// ─── Lenker ─────────────────────────────────────────────────────────────

function parseLink(inner: string): LinkRef {
  // Setter-suffiks: [[tekst|mål][$x to 1]] — twinejs splitter på `][`.
  const [linkPart, ...rest] = inner.split('][');
  const setter = rest.length ? rest.join('][').trim() || null : null;
  let text: string;
  let target: string;
  const right = linkPart.indexOf('->');
  const left = linkPart.indexOf('<-');
  const pipe = linkPart.indexOf('|');
  if (right >= 0) { text = linkPart.slice(0, right); target = linkPart.slice(right + 2); }
  else if (left >= 0) { target = linkPart.slice(0, left); text = linkPart.slice(left + 2); }
  else if (pipe >= 0) { text = linkPart.slice(0, pipe); target = linkPart.slice(pipe + 1); }
  else { text = linkPart; target = linkPart; }
  return { text: text.trim(), target: target.trim(), setter };
}

// ─── Uttrykk (TwineScript/Harlowe → arcscript) ──────────────────────────

const WORD_OPS: Record<string, string> = {
  to: '=', is: '==', isnot: '!=', eq: '==', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
  and: 'and', or: 'or', not: '!', def: '', ndef: '',
};

export function convertTwineExpression(expr: string, assignedVar: string | null = null): string {
  let out = expr.trim();
  // «is not» → !=
  out = out.replace(/\bis\s+not\b/g, '!=');
  // Harlowe «it» = variabelen som settes.
  if (assignedVar) out = out.replace(/\bit\b/g, assignedVar);
  // Strenger beskyttes mot ord-erstatning.
  const strings: string[] = [];
  out = out.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => { strings.push(m); return `⟨${strings.length - 1}⟩`; });
  out = out.replace(/[$_]([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => sanitizeVariableName(name));
  out = out.replace(/\b(to|is|isnot|eq|neq|gt|gte|lt|lte|and|or|not)\b/g, (m) => WORD_OPS[m] ?? m);
  out = out.replace(/===/g, '==').replace(/!==/g, '!=');
  out = out.replace(/⟨(\d+)⟩/g, (_m, i: string) => strings[Number(i)]);
  return out.replace(/\s+/g, ' ').trim();
}

/** Første variabel som tilordnes i et uttrykk (for typeinferens). */
function firstAssignment(expr: string): { name: string; literal: string } | null {
  const m = expr.match(/[$_]([A-Za-z_][A-Za-z0-9_]*)\s*(?:to|=)\s*(.+)$/);
  if (!m) return null;
  return { name: sanitizeVariableName(m[1]), literal: m[2].trim() };
}

// ─── Kropp-konvertering ─────────────────────────────────────────────────

interface BodyResult {
  parts: ContentPart[];
  links: LinkRef[];
  gotoOnly: boolean;
}

const SUGAR_MACRO_RE = /<<(\/?)([A-Za-z_][\w-]*)((?:[^>]|>(?!>))*)>>/g;
const HARLOWE_MACRO_RE = /\(([A-Za-z_][\w-]*):\s*([^)]*)\)/g;

function stripQuotes(s: string): string {
  const t = s.trim();
  const m = t.match(/^"([\s\S]*)"$/) ?? t.match(/^'([\s\S]*)'$/);
  return m ? m[1] : t;
}

function convertBody(body: string, dialect: Dialect, b: GraphBuilder, passageName: string, declareVar: (name: string, literal: string | null) => void): BodyResult {
  const links: LinkRef[] = [];
  const unknownMacros = new Set<string>();
  let gotoCount = 0;

  // 1) Lenker ut, plassholder inn — plassholderen løses inn i kilde-rekkefølge når
  //    teksten rundt skyves ut, så makro-lenker og [[lenker]] beholder rekkefølgen.
  const bracketLinks: LinkRef[] = [];
  const text = body.replace(/\[\[([\s\S]*?)\]\]/g, (_m, inner: string) => {
    bracketLinks.push(parseLink(inner));
    return `⟦L${bracketLinks.length - 1}⟧`;
  });

  const parts: ContentPart[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const pieces = t.split(/⟦L(\d+)⟧/);
    for (let k = 0; k < pieces.length; k += 1) {
      if (k % 2 === 1) { links.push(bracketLinks[Number(pieces[k])]); continue; }
      if (pieces[k]) parts.push({ kind: 'text', text: pieces[k] });
    }
  };
  const pushCode = (c: string) => { if (c.trim()) parts.push({ kind: 'code', code: c }); };
  const unknown = (label: string, original: string) => {
    unknownMacros.add(label);
    b.unsupported += 1;
    pushText(original);
  };

  if (dialect === 'harlowe') {
    // Hooks: (if: …)[…](else:)[…]. Vi håndterer makro + eventuelt følgende hook.
    let i = 0;
    const re = new RegExp(HARLOWE_MACRO_RE.source, 'g');
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(text)) !== null) {
      pushText(text.slice(last, m.index));
      const name = m[1].toLowerCase();
      const args = m[2];
      i = m.index + m[0].length;
      let hook: string | null = null;
      if (text[i] === '[') {
        let depth = 0;
        let j = i;
        for (; j < text.length; j += 1) {
          if (text[j] === '[') depth += 1;
          else if (text[j] === ']') { depth -= 1; if (depth === 0) break; }
        }
        hook = text.slice(i + 1, j);
        i = j + 1;
      }
      switch (name) {
        case 'set': {
          const asg = firstAssignment(args);
          if (asg) declareVar(asg.name, asg.literal);
          pushCode(convertTwineExpression(args, asg?.name ?? null));
          break;
        }
        case 'if':
        case 'unless': {
          const cond = convertTwineExpression(args);
          pushCode(name === 'unless' ? `if !(${cond})` : `if ${cond}`);
          pushText(hook ?? '');
          pushCode('endif');
          break;
        }
        case 'else-if':
        case 'elseif': {
          // Slå sammen med foregående endif → elseif.
          const prev = parts[parts.length - 1];
          if (prev?.kind === 'code' && prev.code === 'endif') parts.pop();
          pushCode(`elseif ${convertTwineExpression(args)}`);
          pushText(hook ?? '');
          pushCode('endif');
          break;
        }
        case 'else': {
          const prev = parts[parts.length - 1];
          if (prev?.kind === 'code' && prev.code === 'endif') parts.pop();
          pushCode('else');
          pushText(hook ?? '');
          pushCode('endif');
          break;
        }
        case 'link-goto':
        case 'link-reveal-goto': {
          const [t, target] = args.split(',').map(stripQuotes);
          links.push({ text: t ?? '', target: target ?? t ?? '', setter: null });
          break;
        }
        case 'goto': {
          links.push({ text: '', target: stripQuotes(args), setter: null });
          gotoCount += 1;
          break;
        }
        default:
          unknown(`(${name}:)`, `${m[0]}${hook != null ? `[${hook}]` : ''}`);
      }
      last = i;
      re.lastIndex = i;
    }
    pushText(text.slice(last));
  } else {
    // SugarCube (og ukjent dialekt: samme makro-syntaks er vanligst).
    const re = new RegExp(SUGAR_MACRO_RE.source, 'g');
    let m: RegExpExecArray | null;
    let last = 0;
    let skipUntilClose: string | null = null;
    while ((m = re.exec(text)) !== null) {
      const closing = m[1] === '/';
      const name = m[2].toLowerCase();
      const args = (m[3] ?? '').trim();
      if (skipUntilClose) {
        if (closing && name === skipUntilClose) { skipUntilClose = null; last = m.index + m[0].length; }
        continue;
      }
      pushText(text.slice(last, m.index));
      last = m.index + m[0].length;
      if (closing) {
        if (name === 'if') pushCode('endif');
        else if (name === 'link' || name === 'button' || name === 'nobr' || name === 'silently') { /* ignorer */ }
        else unknown(`<</${name}>>`, m[0]);
        continue;
      }
      switch (name) {
        case 'set': {
          const asg = firstAssignment(args);
          if (asg) declareVar(asg.name, asg.literal);
          pushCode(convertTwineExpression(args));
          break;
        }
        case 'if': pushCode(`if ${convertTwineExpression(args)}`); break;
        case 'elseif': pushCode(`elseif ${convertTwineExpression(args)}`); break;
        case 'else': pushCode('else'); break;
        case 'link':
        case 'button': {
          const argMatch = args.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')?/);
          const inline = args.match(/^\[\[([\s\S]*?)\]\]/);
          if (inline) links.push(parseLink(inline[1]));
          else if (argMatch) {
            const t = stripQuotes(argMatch[1]);
            links.push({ text: t, target: argMatch[2] ? stripQuotes(argMatch[2]) : t, setter: null });
          } else unknown(`<<${name}>>`, m[0]);
          // Kroppen (til <</link>>) er skript vi ikke kan kjøre — hopp over.
          skipUntilClose = name;
          break;
        }
        case 'goto': {
          links.push({ text: '', target: stripQuotes(args), setter: null });
          gotoCount += 1;
          break;
        }
        case 'nobr':
        case 'silently':
          break;
        default:
          unknown(`<<${name}>>`, m[0]);
      }
    }
    pushText(text.slice(last));
  }

  // Variabler brukt i tekst ($name) → mention-lignende visning er ikke støttet; behold som tekst.
  for (const macro of unknownMacros) b.warn(`Makroen ${macro} støttes ikke og er beholdt som tekst.`, passageName);

  const textOnly = parts.filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text).join('').trim();
  const codeOnly = parts.some((p) => p.kind === 'code');
  return { parts, links, gotoOnly: gotoCount === 1 && links.length === 1 && !textOnly && !codeOnly };
}

// ─── Hovedfunksjon ──────────────────────────────────────────────────────

const SPECIAL_PASSAGES = new Set(['StoryTitle', 'StoryData', 'StoryIncludes', 'StoryAuthor', 'StorySubtitle', 'StorySettings']);
/** Formatets egne spesialpassasjer (skript/UI) — ikke historieinnhold. */
const SKIP_NAMES = new Set(['StoryInit', 'PassageReady', 'PassageDone', 'PassageHeader', 'PassageFooter', 'StoryMenu', 'StoryCaption', 'StoryBanner', 'StoryInterface', 'StoryDisplayTitle', 'StoryShare']);
const SKIP_TAGS = new Set(['script', 'stylesheet', 'widget', 'Twine.private', 'annotation']);
const THEME_TAGS = new Set(['green', 'blue', 'purple', 'amber', 'red', 'teal', 'pink', 'gray']);
const POS_SCALE_X = 2.6;
const POS_SCALE_Y = 1.8;

export function fromTwee(source: string, options: TextImportOptions): FromTextResult {
  if (typeof source !== 'string' || !/^::\s*\S/m.test(source)) {
    throw new TweeImportError('Fila ser ikke ut som Twee 3 (ingen «:: Passasje»-hoder).');
  }
  const passages = splitPassages(source);
  const b = createGraphBuilder(options);

  let title: string | null = options.title ?? null;
  let startName: string | null = null;
  let dialect: Dialect = 'unknown';
  for (const p of passages) {
    if (p.name === 'StoryTitle') title = p.body.trim() || title;
    if (p.name === 'StoryData') {
      try {
        const data = JSON.parse(p.body) as { start?: string; format?: string; 'format-version'?: string };
        if (typeof data.start === 'string' && data.start.trim()) startName = data.start.trim();
        const fmt = (data.format ?? '').toLowerCase();
        dialect = fmt.includes('sugarcube') ? 'sugarcube' : fmt.includes('harlowe') ? 'harlowe' : 'unknown';
        if (dialect === 'harlowe') b.warn('Harlowe-støtte er delvis: (set:), (if:)/(else:), (link-goto:) og (goto:) oversettes; andre makroer beholdes som tekst.');
        if (dialect === 'unknown' && fmt) b.warn(`Historieformatet «${data.format}» er ukjent — lenker importeres, makroer beholdes som tekst.`);
      } catch {
        b.warn('StoryData er ikke gyldig JSON — startpassasje og format ble ikke lest.');
      }
    }
  }

  const board = b.addBoard(title ?? 'Twine');
  const declareVar = (name: string, literal: string | null) => {
    if (!VARIABLE_NAME_RE.test(name)) return;
    if (b.hasVariable(name)) return;
    const { type, value } = inferVariableType(literal);
    b.addVariable(name, type, value);
  };

  const elementByName = new Map<string, string>();
  const pending: Array<{ sourceId: string; links: LinkRef[]; passage: string }> = [];
  const jumperTargets = new Map<string, string>();

  for (const p of passages) {
    if (SPECIAL_PASSAGES.has(p.name)) continue;
    if (SKIP_NAMES.has(p.name) || p.tags.some((t) => SKIP_TAGS.has(t))) { b.warn(`Passasjen «${p.name}» er skript/stilark/oppsett og ble hoppet over.`, p.name); continue; }
    if (elementByName.has(p.name)) { b.warn(`Passasjen «${p.name}» finnes flere ganger — bare den første ble importert.`, p.name); continue; }
    const body = convertBody(p.body, dialect, b, p.name, declareVar);
    const pos = typeof p.metadata.position === 'string' ? p.metadata.position.split(',').map((n) => Number(n.trim())) : null;
    const size = typeof p.metadata.size === 'string' ? p.metadata.size.split(',').map((n) => Number(n.trim())) : null;
    const theme = p.tags.find((t) => THEME_TAGS.has(t)) ?? 'default';
    const hasPos = !!pos && pos.length === 2 && pos.every((n) => Number.isFinite(n));
    const el = b.addElement({
      boardId: board.id,
      kind: body.gotoOnly ? 'jumper' : 'element',
      titleHtml: proseHtml(p.name),
      contentHtml: body.gotoOnly ? '' : partsToHtml(body.parts),
      x: hasPos ? Math.round(pos![0] * POS_SCALE_X) : null,
      y: hasPos ? Math.round(pos![1] * POS_SCALE_Y) : null,
      width: size && size.length === 2 && Number.isFinite(size[0]) ? Math.max(160, Math.round(size[0] * POS_SCALE_X)) : undefined,
      theme,
      customId: p.name !== p.name.trim() || !/^[\w-]+$/.test(p.name) ? null : p.name,
    });
    elementByName.set(p.name, el.id);
    if (body.gotoOnly) jumperTargets.set(el.id, body.links[0].target);
    else pending.push({ sourceId: el.id, links: body.links, passage: p.name });
  }

  for (const [jumperId, targetName] of jumperTargets) {
    const target = elementByName.get(targetName);
    const el = b.element(jumperId)!;
    if (target) el.jumperTargetId = target;
    else b.warn(`Jumperen «${el.titleHtml.replace(/<[^>]+>/g, '')}» peker på passasjen «${targetName}» som ikke finnes.`, targetName);
  }

  // Variabler referert i lenke-settere og uttrykk uten <<set>> → string-variabel.
  for (const item of pending) {
    for (const link of item.links) {
      const targetId = elementByName.get(link.target);
      if (!targetId) { b.warn(`Lenken «${link.text || link.target}» i «${item.passage}» peker på passasjen «${link.target}» som ikke finnes.`, item.passage); b.unsupported += 1; continue; }
      let labelHtml = link.text && link.text !== link.target ? proseHtml(link.text) : proseHtml(link.text);
      if (link.setter) {
        const asg = firstAssignment(link.setter);
        if (asg) declareVar(asg.name, asg.literal);
        labelHtml += partsToHtml([{ kind: 'code', code: convertTwineExpression(link.setter) }]);
      }
      b.addConnection({ sourceId: item.sourceId, targetId, labelHtml });
    }
  }

  // Tilordninger vi ikke nådde (f.eks. inne i <<link>>-kropper) → typeinferens fra literalen.
  const assignRe = /[$_]([A-Za-z_][A-Za-z0-9_]*)\s*(?:to|=|\+=|-=)\s*([^>\]\n,;]+)/g;
  let am: RegExpExecArray | null;
  while ((am = assignRe.exec(source)) !== null) declareVar(sanitizeVariableName(am[1]), am[2].trim());
  // Variabler som brukes i uttrykk uten å være satt → declare som string ''.
  const allCode = source.match(/[$_][A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const ref of allCode) {
    const name = sanitizeVariableName(ref.slice(1));
    if (VARIABLE_NAME_RE.test(name) && !b.hasVariable(name)) b.addVariable(name, 'string', '');
  }

  const startId = (startName && elementByName.get(startName))
    ?? elementByName.get('Start')
    ?? [...elementByName.values()].find((id) => b.element(id)?.kind === 'element')
    ?? null;
  if (startName && !elementByName.get(startName)) b.warn(`Startpassasjen «${startName}» fra StoryData finnes ikke — første passasje brukes.`, startName);

  b.autoLayout(startId);
  return b.finish({ title, startingElementId: startId });
}
