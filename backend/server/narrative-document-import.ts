/**
 * Story Graph Fase 8b — manusimport: Word/PDF/Markdown → scener og replikker.
 *
 * Ren, testbar modul uten DB. Flyten er alltid dry-run først:
 *   extractDocumentText(buffer) → parseSceneDocument(text) → diffAgainstProject(parsed, existing)
 * og brukeren godkjenner diffen før noe skrives (AGENTS.md-regelen: ingen replikk strykes
 * stille — det som mangler i dokumentet blir forslag til åpne spørsmål, ikke slettinger).
 *
 * Grammatikken er avledet av WFU-dokumentene (OPENING-HYBRID-v2, SCENE-PLAN-v3,
 * OPENING-DIALOGUE-v2) og tåler tre tekstformer: Markdown (som skrevet), HTML fra mammoth
 * (docx) normalisert til samme form, og ren tekst fra pdf-parse (uten fet skrift og pipes).
 *
 *   ### P01 — Skoleveien · W01 · 1797, ettermiddag      ← scene: workingId, tittel, cue-blokk, epoke
 *   **Før:** …  **Handling:** …  **Kontroll:** …  **Etter/utløser:** …  **Lyd:** …
 *   ## W01 — Skoleveien · 1797                          ← replikkblokk (kobles til scenen via W01)
 *   | W01.01 | NORA | E | Must you read all the way home? |
 */
import { createRequire } from 'node:module';
import mammoth from 'mammoth';

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParseModule: any = _require('pdf-parse');

export const DOCUMENT_IMPORT_MAX_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_IMPORT_MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  markdown: 'text/markdown',
  text: 'text/plain',
} as const;

export type DocumentKind = 'docx' | 'pdf' | 'md' | 'txt';
export type ParsedLineSourceType = 'E' | 'T' | 'E+T' | 'U' | 'A';
export type ParsedEra = 'pre' | '1797' | '1802' | '1817' | 'other';

export interface ParsedLine {
  cueId: string;
  speakerLabel: string;
  sourceType: ParsedLineSourceType | null;
  textEn: string;
  note?: string;
}

export interface ParsedSceneFields {
  beforeState: string;
  action: string;
  control: string;
  afterState: string;
  audio: string;
}

export interface ParsedScene {
  workingId: string;
  title: string;
  subtitle: string;
  era: ParsedEra;
  /** Replikkblokker scenen eier (W01, U04 …), fra overskriften. */
  cueBlocks: string[];
  fields: ParsedSceneFields;
  lines: ParsedLine[];
}

export interface ParsedDocument {
  title: string | null;
  scenes: ParsedScene[];
  /** Replikker gruppert på blokk-prefiks (W01 → …), også de som ingen scene i dokumentet eier. */
  dialogueBlocks: Record<string, ParsedLine[]>;
  warnings: string[];
  stats: { scenes: number; lines: number; unassignedBlocks: number };
}

export class DocumentImportError extends Error {
  constructor(public readonly code: 'unsupported_type' | 'empty_text' | 'nothing_recognized', message: string) {
    super(message);
    this.name = 'DocumentImportError';
  }
}

// ─── Tekstuttrekk ────────────────────────────────────────────────────

export function documentKindOf(mimetype: string, filename: string): DocumentKind | null {
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  if (mimetype === DOCUMENT_IMPORT_MIME.docx || ext === 'docx') return 'docx';
  if (mimetype === DOCUMENT_IMPORT_MIME.pdf || ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || mimetype === DOCUMENT_IMPORT_MIME.markdown) return 'md';
  if (ext === 'txt' || mimetype.startsWith('text/')) return 'txt';
  return null;
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITY[code.toLowerCase()] ?? m;
  });
}

/** mammoth-HTML → samme tekstform som Markdown-kildene (overskrifter, fet, tabellrader). */
export function htmlToDocumentText(html: string): string {
  let s = html.replace(/\r/g, '');
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, inner: string) => `\n${'#'.repeat(Number(lvl))} ${inner}\n`);
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t: string, inner: string) => `**${inner.trim()}**`);
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_m, row: string) => {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => c[1].replace(/<[^>]+>/g, '').trim());
    return `\n| ${cells.join(' | ')} |\n`;
  });
  s = s.replace(/<\/(p|div|li|table|thead|tbody)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '- ');
  s = s.replace(/<[^>]+>/g, '');
  return decodeEntities(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractDocumentText(buffer: Buffer, mimetype: string, filename: string): Promise<{ text: string; kind: DocumentKind }> {
  const kind = documentKindOf(mimetype, filename);
  if (!kind) throw new DocumentImportError('unsupported_type', 'Støttede formater: .docx, .pdf, .md, .txt');
  let text: string;
  if (kind === 'docx') {
    // convertToHtml (ikke extractRawText) så overskrifter, fet skrift og tabeller overlever.
    const result = await mammoth.convertToHtml({ buffer });
    text = htmlToDocumentText(result.value ?? '');
  } else if (kind === 'pdf') {
    const parsed = await pdfParseModule.default(buffer);
    text = typeof parsed?.text === 'string' ? parsed.text : '';
  } else {
    text = buffer.toString('utf8');
  }
  if (text.trim().length < 40) throw new DocumentImportError('empty_text', 'Fant ingen tekst i dokumentet.');
  return { text, kind };
}

// ─── Parser ──────────────────────────────────────────────────────────

/** `### P01 — Skoleveien · W01 · 1797, ettermiddag` (hashene er valgfrie: PDF-tekst mangler dem). */
const SCENE_HEADER_RE = /^(?:#{1,6}\s*)?([A-Z]{1,3}\d{2,4}[A-Z]?)\s+[—–-]\s+(.+)$/;
/** `## W01 — Skoleveien · 1797` — replikkblokk-overskrift. */
const BLOCK_HEADER_RE = /^(?:#{1,6}\s*)?([WUK]\d{2}[A-Z]?)\s+[—–-]\s+(.+)$/;
const CUE_RE = /^([WUK]\d{2}[A-Z]?)\.(\d{2})$/;
const FIELD_LABELS: Array<{ key: keyof ParsedSceneFields; re: RegExp }> = [
  { key: 'beforeState', re: /^(?:\*\*)?(?:før|before)\s*:(?:\*\*)?\s*/i },
  { key: 'action', re: /^(?:\*\*)?(?:handling|action)\s*:(?:\*\*)?\s*/i },
  { key: 'control', re: /^(?:\*\*)?(?:kontroll(?:\/utgang)?|control)\s*:(?:\*\*)?\s*/i },
  { key: 'afterState', re: /^(?:\*\*)?(?:etter(?:\/utløser)?|after(?:\/trigger)?)\s*:(?:\*\*)?\s*/i },
  { key: 'audio', re: /^(?:\*\*)?(?:lyd|audio|sound)\s*:(?:\*\*)?\s*/i },
];
const SOURCE_TYPES = new Set<ParsedLineSourceType>(['E', 'T', 'E+T', 'U', 'A']);

function emptyFields(): ParsedSceneFields {
  return { beforeState: '', action: '', control: '', afterState: '', audio: '' };
}

export function eraFromText(s: string): ParsedEra {
  // «før 1797» / kultfilm-scener er epoken FØR spillets tidslinje — sjekkes før årstallet.
  if (/\b(før 1797|before 1797|kult(?:film|en|ens)?|1750|17[0-8]\d)\b/i.test(s)) return 'pre';
  const m = /\b(1797|1802|1817)\b/.exec(s);
  if (m) return m[1] as ParsedEra;
  return 'other';
}

/** Tokens fra scene-overskriften: `Skoleveien · W01 · 1797, ettermiddag` → tittel + cue-blokker. */
function splitHeader(rest: string): { title: string; subtitle: string; cueBlocks: string[] } {
  const parts = rest.split(/\s+·\s+/).map((p) => p.trim()).filter(Boolean);
  const title = parts.shift() ?? rest.trim();
  const cueBlocks: string[] = [];
  for (const p of parts) for (const m of p.matchAll(/\b([WUK]\d{2}[A-Z]?)\b/g)) cueBlocks.push(m[1]);
  return { title, subtitle: parts.join(' · '), cueBlocks: [...new Set(cueBlocks)] };
}

/** Én replikk-rad, med eller uten pipes: `| W01.01 | NORA | E | tekst |` / `W01.01 NORA E tekst`. */
function parseCueRow(line: string): ParsedLine | null {
  const piped = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  if (line.trim().startsWith('|')) {
    const cells = piped.split('|').map((c) => c.trim());
    if (cells.length < 3 || !CUE_RE.test(cells[0])) return null;
    const hasType = cells.length >= 4 && SOURCE_TYPES.has(cells[2] as ParsedLineSourceType);
    return {
      cueId: cells[0], speakerLabel: cells[1],
      sourceType: hasType ? (cells[2] as ParsedLineSourceType) : null,
      textEn: (hasType ? cells.slice(3) : cells.slice(2)).join(' | ').trim(),
    };
  }
  const m = /^([WUK]\d{2}[A-Z]?\.\d{2})\s+([A-ZÆØÅ][A-ZÆØÅ0-9 ,'\-]{0,40}?)\s+(E\+T|E|T|U|A)\s+(.+)$/.exec(line.trim());
  if (!m) return null;
  return { cueId: m[1], speakerLabel: m[2].trim(), sourceType: m[3] as ParsedLineSourceType, textEn: m[4].trim() };
}

export function parseSceneDocument(rawText: string): ParsedDocument {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const dialogueBlocks: Record<string, ParsedLine[]> = {};
  const warnings: string[] = [];
  let title: string | null = null;
  let current: ParsedScene | null = null;
  let currentField: keyof ParsedSceneFields | null = null;
  let inBlock: string | null = null;

  const flushField = () => { currentField = null; };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!title && /^#\s+/.test(trimmed)) { title = trimmed.replace(/^#\s+/, '').trim(); continue; }

    const sceneHead = SCENE_HEADER_RE.exec(trimmed);
    const blockHead = BLOCK_HEADER_RE.exec(trimmed);
    // En W/U/K-overskrift er replikkblokk; alt annet (P01, G03A, H01, R02 …) er scene.
    if (blockHead && /^[WUK]\d{2}[A-Z]?$/.test(blockHead[1]) && !/^\*\*/.test(trimmed)) {
      inBlock = blockHead[1];
      dialogueBlocks[inBlock] ??= [];
      current = null; flushField();
      continue;
    }
    // Scene-overskrift: med hasher (Markdown/docx) alltid; uten hasher (PDF-tekst) også,
    // fordi «P02 — Ringen · W02 · …» er entydig nok og aldri en feltlinje.
    if (sceneHead) {
      const { title: sceneTitle, subtitle, cueBlocks } = splitHeader(sceneHead[2]);
      current = { workingId: sceneHead[1].toUpperCase(), title: sceneTitle, subtitle, era: eraFromText(sceneHead[2]), cueBlocks, fields: emptyFields(), lines: [] };
      scenes.push(current);
      inBlock = null; flushField();
      continue;
    }

    // Replikk-rad (i en blokk, eller løs rad som selv oppgir blokk via cue-ID).
    const cue = parseCueRow(trimmed);
    if (cue) {
      const block = CUE_RE.exec(cue.cueId)![1];
      (dialogueBlocks[block] ??= []).push(cue);
      continue;
    }
    if (/^\|\s*-{2,}/.test(trimmed) || /^\|\s*ID\s*\|/i.test(trimmed)) continue; // tabellhode/skillelinje

    if (!current) continue;
    if (!trimmed) { flushField(); continue; }
    if (/^#{1,6}\s/.test(trimmed)) { current = null; flushField(); continue; } // ny seksjon uten scene-ID

    const label = FIELD_LABELS.find((f) => f.re.test(trimmed));
    if (label) {
      currentField = label.key;
      const value = trimmed.replace(label.re, '').trim();
      current.fields[label.key] = current.fields[label.key] ? `${current.fields[label.key]} ${value}` : value;
      continue;
    }
    if (currentField) {
      // Fortsettelseslinje for feltet (Markdown-brekk). Ny **Etikett:** avbryter.
      if (/^\*\*[^*]+:\*\*/.test(trimmed)) { flushField(); continue; }
      current.fields[currentField] = `${current.fields[currentField]} ${trimmed}`.trim();
    }
  }

  // Koble replikkblokker til scener via overskriftens cue-blokker.
  const owned = new Set<string>();
  for (const sc of scenes) {
    for (const b of sc.cueBlocks) {
      const rows = dialogueBlocks[b];
      if (rows) { sc.lines.push(...rows); owned.add(b); }
    }
  }
  const unassigned = Object.keys(dialogueBlocks).filter((b) => !owned.has(b));
  for (const b of unassigned) warnings.push(`Replikkblokk ${b} har ingen scene i dokumentet — kobles mot eksisterende scener ved diff.`);
  // Dupliserte cue-ID-er i samme blokk.
  for (const [b, rows] of Object.entries(dialogueBlocks)) {
    const seen = new Set<string>();
    for (const r of rows) { if (seen.has(r.cueId)) warnings.push(`Duplisert cue-ID ${r.cueId} i blokk ${b}.`); seen.add(r.cueId); }
  }
  const lineCount = Object.values(dialogueBlocks).reduce((n, rows) => n + rows.length, 0);
  if (scenes.length === 0 && lineCount === 0) {
    throw new DocumentImportError('nothing_recognized', 'Fant verken scener (### P01 — …) eller replikker (W01.01 …) i dokumentet.');
  }
  return { title, scenes, dialogueBlocks, warnings, stats: { scenes: scenes.length, lines: lineCount, unassignedBlocks: unassigned.length } };
}

// ─── Diff mot prosjektet ─────────────────────────────────────────────

export interface ExistingLine { id: string; cueId: string; speakerLabel: string; textEn: string; sourceType: string | null }
export interface ExistingScene {
  id: string; code: string; workingId: string | null; title: string; subtitle: string; era: string;
  beforeState: string; action: string; control: string; afterState: string; audio: string;
  lines: ExistingLine[];
}

export type SceneFieldKey = 'title' | 'subtitle' | 'era' | keyof ParsedSceneFields;
export interface FieldChange { from: string; to: string }
export interface LineChange { lineId: string; cueId: string; changes: Partial<Record<'speakerLabel' | 'textEn' | 'sourceType', FieldChange>> }

export interface ImportDiff {
  create: Array<{ workingId: string; code: string; scene: ParsedScene }>;
  update: Array<{
    sceneId: string; code: string; workingId: string;
    changes: Partial<Record<SceneFieldKey, FieldChange>>;
    lines: { create: ParsedLine[]; update: LineChange[]; unchanged: number };
  }>;
  unchanged: Array<{ sceneId: string; code: string }>;
  /** I prosjektet, men ikke i dokumentet → foreslås som åpne spørsmål (aldri sletting). */
  missingInDoc: { scenes: Array<{ sceneId: string; code: string }>; lines: Array<{ sceneId: string; code: string; lineId: string; cueId: string }> };
  warnings: string[];
  stats: { create: number; update: number; unchanged: number; linesCreate: number; linesUpdate: number; missingScenes: number; missingLines: number };
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function fieldDiff(existing: ExistingScene, parsed: ParsedScene): Partial<Record<SceneFieldKey, FieldChange>> {
  const out: Partial<Record<SceneFieldKey, FieldChange>> = {};
  const cmp = (key: SceneFieldKey, from: string, to: string, onlyIfProvided = true) => {
    if (onlyIfProvided && !norm(to)) return; // dokumentet sier ingenting → rør ikke feltet
    if (norm(from) !== norm(to)) out[key] = { from: norm(from), to: norm(to) };
  };
  cmp('title', existing.title, parsed.title);
  cmp('subtitle', existing.subtitle, parsed.subtitle);
  if (parsed.era !== 'other') cmp('era', existing.era, parsed.era, false);
  for (const k of ['beforeState', 'action', 'control', 'afterState', 'audio'] as const) cmp(k, existing[k], parsed.fields[k]);
  return out;
}

function lineDiff(existing: ExistingLine[], parsed: ParsedLine[]): { create: ParsedLine[]; update: LineChange[]; unchanged: number; missing: ExistingLine[] } {
  const byCue = new Map(existing.map((l) => [l.cueId.toUpperCase(), l]));
  const seen = new Set<string>();
  const create: ParsedLine[] = []; const update: LineChange[] = []; let unchanged = 0;
  for (const p of parsed) {
    const key = p.cueId.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const ex = byCue.get(key);
    if (!ex) { create.push(p); continue; }
    const changes: LineChange['changes'] = {};
    if (norm(ex.speakerLabel) !== norm(p.speakerLabel) && norm(p.speakerLabel)) changes.speakerLabel = { from: norm(ex.speakerLabel), to: norm(p.speakerLabel) };
    if (norm(ex.textEn) !== norm(p.textEn) && norm(p.textEn)) changes.textEn = { from: norm(ex.textEn), to: norm(p.textEn) };
    if (p.sourceType && (ex.sourceType ?? '') !== p.sourceType) changes.sourceType = { from: ex.sourceType ?? '', to: p.sourceType };
    if (Object.keys(changes).length) update.push({ lineId: ex.id, cueId: ex.cueId, changes }); else unchanged += 1;
  }
  const missing = existing.filter((l) => !seen.has(l.cueId.toUpperCase()));
  return { create, update, unchanged, missing };
}

/** Cue-blokker en eksisterende scene eier: undertittel-tokens + prefiks på eksisterende replikker. */
function existingCueBlocks(sc: ExistingScene): Set<string> {
  const out = new Set<string>();
  for (const m of (sc.subtitle ?? '').matchAll(/\b([WUK]\d{2}[A-Z]?)\b/g)) out.add(m[1]);
  for (const l of sc.lines) { const m = CUE_RE.exec(l.cueId.toUpperCase()); if (m) out.add(m[1]); }
  return out;
}

export function diffAgainstProject(parsed: ParsedDocument, existing: ExistingScene[]): ImportDiff {
  const warnings = [...parsed.warnings];
  const byKey = new Map<string, ExistingScene>();
  for (const sc of existing) {
    if (sc.workingId) byKey.set(sc.workingId.toUpperCase(), sc);
    byKey.set(sc.code.toUpperCase(), sc);
  }
  const create: ImportDiff['create'] = []; const update: ImportDiff['update'] = []; const unchanged: ImportDiff['unchanged'] = [];
  const missingLines: ImportDiff['missingInDoc']['lines'] = [];
  const touched = new Set<string>();

  // Replikkblokker som ingen dokument-scene eier → eksisterende scener som eier blokken.
  const ownedByDoc = new Set(parsed.scenes.flatMap((s) => s.cueBlocks));
  const extraLinesByScene = new Map<string, ParsedLine[]>();
  for (const [block, rows] of Object.entries(parsed.dialogueBlocks)) {
    if (ownedByDoc.has(block)) continue;
    const owner = existing.find((sc) => existingCueBlocks(sc).has(block));
    if (!owner) { warnings.push(`Replikkblokk ${block} (${rows.length} replikker) hører ikke til noen scene — hopper over.`); continue; }
    extraLinesByScene.set(owner.id, [...(extraLinesByScene.get(owner.id) ?? []), ...rows]);
  }

  for (const p of parsed.scenes) {
    const ex = byKey.get(p.workingId.toUpperCase());
    if (!ex) {
      if (!/^[A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?$/.test(p.workingId)) { warnings.push(`Scene ${p.workingId}: ID-en kan ikke brukes som scenekode — hoppes over.`); continue; }
      create.push({ workingId: p.workingId, code: p.workingId, scene: p });
      continue;
    }
    if (touched.has(ex.id)) { warnings.push(`Scene ${p.workingId} forekommer flere ganger i dokumentet; første forekomst brukes.`); continue; }
    touched.add(ex.id);
    const changes = fieldDiff(ex, p);
    const ld = lineDiff(ex.lines, [...p.lines, ...(extraLinesByScene.get(ex.id) ?? [])]);
    extraLinesByScene.delete(ex.id);
    for (const m of ld.missing) missingLines.push({ sceneId: ex.id, code: ex.code, lineId: m.id, cueId: m.cueId });
    if (Object.keys(changes).length || ld.create.length || ld.update.length) {
      update.push({ sceneId: ex.id, code: ex.code, workingId: ex.workingId ?? ex.code, changes, lines: { create: ld.create, update: ld.update, unchanged: ld.unchanged } });
    } else {
      unchanged.push({ sceneId: ex.id, code: ex.code });
    }
  }
  // Scener som bare fikk løse replikkblokker (dialog-dokument uten scene-overskrifter).
  for (const [sceneId, rows] of extraLinesByScene) {
    const ex = existing.find((s) => s.id === sceneId)!;
    const ld = lineDiff(ex.lines, rows);
    // Et rent dialog-dokument dekker ikke nødvendigvis alle blokker → bare replikker i
    // blokker dokumentet faktisk inneholder regnes som «mangler».
    const docBlocks = new Set(rows.map((r) => CUE_RE.exec(r.cueId.toUpperCase())![1]));
    for (const m of ld.missing) { const b = CUE_RE.exec(m.cueId.toUpperCase())?.[1]; if (b && docBlocks.has(b)) missingLines.push({ sceneId: ex.id, code: ex.code, lineId: m.id, cueId: m.cueId }); }
    touched.add(ex.id);
    if (ld.create.length || ld.update.length) update.push({ sceneId: ex.id, code: ex.code, workingId: ex.workingId ?? ex.code, changes: {}, lines: { create: ld.create, update: ld.update, unchanged: ld.unchanged } });
    else unchanged.push({ sceneId: ex.id, code: ex.code });
  }
  // Scener i prosjektet som dokumentet ikke nevner — kun relevant når dokumentet har scener.
  const missingScenes = parsed.scenes.length > 0
    ? existing.filter((sc) => !touched.has(sc.id) && sc.workingId && /^[A-Z]{1,3}\d{2,4}[A-Z]?$/.test(sc.workingId) && sameFamily(sc.workingId, parsed.scenes))
      .map((sc) => ({ sceneId: sc.id, code: sc.code }))
    : [];

  return {
    create, update, unchanged,
    missingInDoc: { scenes: missingScenes, lines: missingLines },
    warnings,
    stats: {
      create: create.length, update: update.length, unchanged: unchanged.length,
      linesCreate: create.reduce((n, c) => n + c.scene.lines.length, 0) + update.reduce((n, u) => n + u.lines.create.length, 0),
      linesUpdate: update.reduce((n, u) => n + u.lines.update.length, 0),
      missingScenes: missingScenes.length, missingLines: missingLines.length,
    },
  };
}

/** «P»-scener sammenlignes bare med et dokument som har P-scener (SCENE-PLAN har G/H/R). */
function sameFamily(workingId: string, docScenes: ParsedScene[]): boolean {
  const prefix = /^[A-Z]+/.exec(workingId)?.[0] ?? '';
  return docScenes.some((s) => (/^[A-Z]+/.exec(s.workingId)?.[0] ?? '') === prefix);
}
