/**
 * Story Graph → PDF («lesbart manus»): tittelside, per brett elementer med
 * innhold, valg, forgreninger og jumpere, deretter vedlegg med variabler og
 * komponenter. pdfkit med innebygd DejaVu Sans (æøå rendres likt overalt —
 * samme fonter som audio-showcase-routes.ts).
 *
 * Komposisjonen (`composeStoryGraphPdf`) skriver mot et minimalt dokument-
 * grensesnitt så den kan testes uten å parse PDF-bytes.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import {
  applyLocaleToGraph, bySort, elementLabel, exportFileStem, htmlToPlainText, htmlToTitle, indexGraph, type ExportGraph,
} from '../../frontend/shared/narrative-format/index.ts';
import { segmentContentHtml, stripCodeBlocks } from '../../frontend/shared/narrative-script/html.ts';

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets', 'fonts');
let FONTS: { regular: Buffer; bold: Buffer; oblique: Buffer } | null = null;
function fonts() {
  if (!FONTS) FONTS = {
    regular: readFileSync(join(FONT_DIR, 'DejaVuSans.ttf')),
    bold: readFileSync(join(FONT_DIR, 'DejaVuSans-Bold.ttf')),
    oblique: readFileSync(join(FONT_DIR, 'DejaVuSans-Oblique.ttf')),
  };
  return FONTS;
}

/** Delsettet av pdfkit komposisjonen bruker (testbart med en opptaker). */
export interface PdfDocLike {
  font(name: string): this;
  fontSize(size: number): this;
  fillColor(color: string): this;
  text(text: string, options?: Record<string, unknown>): this;
  moveDown(lines?: number): this;
  addPage(): this;
}

export interface StoryGraphPdfOptions {
  locale?: string | null;
  /** Overstyr tittel (default: grafens tittel eller «Story Graph»). */
  title?: string | null;
  /** Dato på tittelsiden (default: nå). */
  generatedAt?: Date;
}

const INK = '#111111';
const DIM = '#666666';
const ACCENT = '#15803d';
const CODE = '#374151';

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long' }).format(d);
}

/** Skriver hele dokumentet. Kalles med et pdfkit-dokument der fontene «Sans», «Sans-Bold», «Sans-Oblique» er registrert. */
export function composeStoryGraphPdf(doc: PdfDocLike, input: ExportGraph, options: StoryGraphPdfOptions = {}): void {
  const graph = applyLocaleToGraph(input, options.locale);
  const { elementById, connectionsBySource, componentsByElement } = indexGraph(graph);
  const title = options.title?.trim() || htmlToTitle(graph.settings.title ?? '') || 'Story Graph';
  const start = graph.settings.startingElementId ? elementById.get(graph.settings.startingElementId) : undefined;
  const elementCount = graph.elements.filter((e) => e.kind === 'element').length;
  const choiceCount = graph.connections.filter((c) => elementById.get(c.sourceId)?.kind === 'element').length;

  const h = (text: string, size: number, color = INK) => { doc.font('Sans-Bold').fontSize(size).fillColor(color).text(text); };
  const p = (text: string, size = 10.5, color = INK) => { doc.font('Sans').fontSize(size).fillColor(color).text(text); };
  const dim = (text: string) => p(text, 9, DIM);
  const code = (text: string) => { doc.font('Sans-Oblique').fontSize(8.5).fillColor(CODE).text(text); };

  // ── Tittelside
  doc.moveDown(6);
  dim('STORY GRAPH · LESBART MANUS');
  doc.moveDown(0.4);
  h(title, 26);
  doc.moveDown(0.6);
  p(`Startelement: ${start ? elementLabel(start) : 'ikke satt'}`);
  p(`${graph.boards.length} brett · ${elementCount} elementer · ${choiceCount} valg · ${graph.variables.length} variabler · ${graph.components.length} komponenter`, 10.5, DIM);
  if (options.locale && options.locale !== 'nb') p(`Språk: ${options.locale}`, 10.5, DIM);
  doc.moveDown(1);
  dim(`Generert ${fmtDate(options.generatedAt ?? new Date())} · The Role Room`);

  // ── Brett
  for (const board of bySort(graph.boards)) {
    doc.addPage();
    const folder = board.folderPath?.trim();
    dim(folder ? folder.toUpperCase() : 'BRETT');
    h(board.name, 18, ACCENT);
    doc.moveDown(0.5);
    const elements = bySort(graph.elements.filter((e) => e.boardId === board.id));
    if (elements.length === 0) { p('Tomt brett.', 10.5, DIM); continue; }
    for (const e of elements) {
      if (e.kind === 'note') {
        const text = htmlToPlainText(e.contentHtml);
        doc.moveDown(0.4);
        doc.font('Sans-Oblique').fontSize(9.5).fillColor(DIM).text(`Notat: ${text || '(tomt)'}`);
        continue;
      }
      doc.moveDown(0.8);
      const marks = [e.customId ? `#${e.customId}` : null, e.id === graph.settings.startingElementId ? 'START' : null].filter(Boolean).join(' · ');
      h(elementLabel(e), 13);
      if (marks) dim(marks);
      if (e.kind === 'element') {
        const comps = componentsByElement.get(e.id) ?? [];
        if (comps.length) dim(`Komponenter: ${comps.join(', ')}`);
        for (const seg of segmentContentHtml(e.contentHtml ?? '')) {
          if (seg.kind === 'html') { const t = htmlToPlainText(seg.html); if (t) { doc.moveDown(0.25); p(t); } }
          else if (seg.code.trim()) { doc.moveDown(0.15); code(seg.code.trim()); }
        }
        const outgoing = connectionsBySource.get(e.id) ?? [];
        doc.moveDown(0.35);
        if (outgoing.length === 0) { p('Slutt (ingen utganger).', 10, DIM); continue; }
        p('Valg:', 10, DIM);
        for (const c of outgoing) {
          const label = htmlToTitle(stripCodeBlocks(c.labelHtml ?? ''));
          const script = segmentContentHtml(c.labelHtml ?? '').filter((s) => s.kind === 'code').map((s) => (s as { code: string }).code.trim()).filter(Boolean).join('; ');
          p(`• ${label ? `«${label}» → ` : '→ '}${elementLabel(elementById.get(c.targetId))}${script ? `   [${script}]` : ''}`, 10.5);
        }
      } else if (e.kind === 'branch') {
        const outgoing = connectionsBySource.get(e.id) ?? [];
        doc.moveDown(0.25);
        e.branchConditions.forEach((cond, i) => {
          const conn = outgoing.find((c) => c.sourceOutputKey === cond.id);
          const target = conn ? elementLabel(elementById.get(conn.targetId)) : '(ikke koblet)';
          const head = cond.script == null ? 'ellers' : `${i === 0 ? 'if' : 'elseif'} ${cond.script}`;
          p(`• ${head} → ${target}`, 10.5);
        });
      } else if (e.kind === 'jumper') {
        const target = e.jumperTargetId ? elementById.get(e.jumperTargetId) : undefined;
        p(`→ Jumper til ${target ? elementLabel(target) : '(uten mål)'}`, 10.5);
      }
    }
  }

  // ── Vedlegg
  if (graph.variables.length || graph.components.length) {
    doc.addPage();
    dim('VEDLEGG');
    if (graph.variables.length) {
      h('Variabler', 16, ACCENT);
      doc.moveDown(0.3);
      for (const v of bySort(graph.variables)) p(`${v.name}  (${v.type})  standard: ${JSON.stringify(v.defaultValue ?? null)}`, 10.5);
      doc.moveDown(0.8);
    }
    if (graph.components.length) {
      h('Komponenter', 16, ACCENT);
      doc.moveDown(0.3);
      for (const c of bySort(graph.components)) {
        const folder = c.folderPath?.trim();
        h(`${c.name}${c.customId ? `  #${c.customId}` : ''}`, 11.5);
        if (folder) dim(folder);
        const attrs = bySort(graph.attributes.filter((a) => a.ownerKind === 'component' && a.ownerId === c.id));
        for (const a of attrs) {
          const value = a.type === 'rich_text' ? htmlToTitle(String(a.value ?? '')) : typeof a.value === 'string' ? a.value : JSON.stringify(a.value ?? null);
          p(`• ${a.name}: ${value}`, 10);
        }
        doc.moveDown(0.4);
      }
    }
  }
}

/** Felles pdfkit-oppsett (A4, innebygde fonter, sidetall i bunn) rundt en komposisjon. */
function renderPdf(title: string, compose: (doc: PdfDocLike) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const f = fonts();
      const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true, info: { Title: title, Author: 'The Role Room · Story Graph' } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.registerFont('Sans', f.regular);
      doc.registerFont('Sans-Bold', f.bold);
      doc.registerFont('Sans-Oblique', f.oblique);
      compose(doc as unknown as PdfDocLike);
      // Sidetall (hopp over tittelsiden).
      const range = doc.bufferedPageRange();
      for (let i = 1; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        doc.font('Sans').fontSize(8).fillColor(DIM)
          .text(`${title} · side ${i + 1} av ${range.count}`, doc.page.margins.left, doc.page.height - 40, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center', lineBreak: false });
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Rendrer PDF-bytes med pdfkit (A4, innebygde fonter, sidetall i bunn). */
export function renderStoryGraphPdf(graph: ExportGraph, options: StoryGraphPdfOptions = {}): Promise<Buffer> {
  const title = options.title?.trim() || htmlToTitle(graph.settings.title ?? '') || 'Story Graph';
  return renderPdf(title, (doc) => composeStoryGraphPdf(doc, graph, options));
}

export function storyGraphPdfFilename(graph: ExportGraph, locale: string | null | undefined): string {
  return `${exportFileStem(graph.settings.title)}${locale && locale !== 'nb' ? `-${locale}` : ''}.pdf`;
}

// ═══════════════════════════════════════════════════════════════════════
//  Manus-PDF av scener (Scener & gameplay) — UX-28
//  Et scenebasert studio (WFU) har ofte ingen brett; manuset er scenekortene.
// ═══════════════════════════════════════════════════════════════════════

export interface ScenesScriptPdfScene {
  code: string;
  title: string;
  subtitle: string;
  workingId: string | null;
  era: string;
  location: string;
  status: string;
  episodeCode: string | null;
  episodeTitle: string | null;
  beforeState: string;
  action: string;
  control: string;
  afterState: string;
  audio: string;
  changeNote: string;
  bridge: string;
  timeNote: string;
  challenge: string;
  gameplayMechanic: string;
  environment: string;
  sourceRefs: Array<{ tag: string; ref: string }>;
  lines: Array<{ cueId: string; speakerLabel: string; textEn: string; textNb: string; sourceType: string; recordingStatus: string }>;
  gates: Array<{ gateKey: string; status: string; evidence: string }>;
}

export interface ScenesScriptPdfInput {
  projectName: string;
  scenes: ScenesScriptPdfScene[];
  generatedAt?: Date;
}

const SCENE_STATUS_LABEL: Record<string, string> = { idea: 'Idé', in_progress: 'Under arbeid', in_review: 'Til review', changes_requested: 'Endringer ønsket', approved: 'Godkjent', implemented: 'Implementert' };
const ERA_LABEL: Record<string, string> = { pre: 'Før 1797', '1797': '1797 · barndom', '1802': '1802 · ungdom', '1817': '1817 · voksen', other: '' };
const GATE_LABEL: Record<string, string> = { script_coverage: 'Manusdekning', greybox: 'Gråboks / regelprøve', characters_animation: 'Karakterer og animasjon', playthrough: 'iPad-gjennomspilling', picture: 'Bilde', audio: 'Foley / dialog / miks' };
const GATE_STATUS_LABEL: Record<string, string> = { not_started: 'Ikke startet', in_progress: 'Pågår', passed: 'Bestått', failed: 'Feilet' };

/** Skriver manus-PDF: tittelside, én seksjon per scene (Før/Handling/Kontroll/Etter/Lyd, replikker, gater), vedlegg med sceneliste. */
export function composeScenesScriptPdf(doc: PdfDocLike, input: ScenesScriptPdfInput): void {
  const h = (text: string, size: number, color = INK) => { doc.font('Sans-Bold').fontSize(size).fillColor(color).text(text); };
  const p = (text: string, size = 10.5, color = INK) => { doc.font('Sans').fontSize(size).fillColor(color).text(text); };
  const dim = (text: string) => p(text, 9, DIM);
  const field = (label: string, value: string) => {
    if (!value.trim()) return;
    doc.moveDown(0.35);
    h(label.toUpperCase(), 8.5, ACCENT);
    p(value.trim());
  };
  const title = input.projectName.trim() || 'Manus';
  const lineCount = input.scenes.reduce((n, s) => n + s.lines.length, 0);
  const passed = input.scenes.reduce((n, s) => n + s.gates.filter((g) => g.status === 'passed').length, 0);
  const gateTotal = input.scenes.reduce((n, s) => n + s.gates.length, 0);

  // ── Tittelside
  doc.moveDown(6);
  dim('STORY GRAPH · MANUS (SCENER)');
  doc.moveDown(0.4);
  h(title, 26);
  doc.moveDown(0.6);
  p(`${input.scenes.length} scener · ${lineCount} replikker · ${passed} av ${gateTotal} gater bestått`, 10.5, DIM);
  doc.moveDown(1);
  dim(`Generert ${fmtDate(input.generatedAt ?? new Date())} · The Role Room`);

  // ── Scener
  let lastEpisode: string | null | undefined;
  for (const s of input.scenes) {
    doc.addPage();
    const epLabel = s.episodeCode ? `${s.episodeCode}${s.episodeTitle ? ` · ${s.episodeTitle}` : ''}` : 'UTEN EPISODE';
    if (epLabel !== lastEpisode) { dim(epLabel.toUpperCase()); lastEpisode = epLabel; } else { dim(epLabel.toUpperCase()); }
    h(`${s.code} – ${s.title || '(uten tittel)'}`, 18, ACCENT);
    const meta = [s.workingId && s.workingId !== s.code ? `arbeids-ID ${s.workingId}` : null, ERA_LABEL[s.era] ?? s.era, s.location.trim() || null, SCENE_STATUS_LABEL[s.status] ?? s.status].filter(Boolean).join(' · ');
    if (meta) dim(meta);
    if (s.subtitle.trim()) { doc.moveDown(0.2); doc.font('Sans-Oblique').fontSize(10.5).fillColor(INK).text(s.subtitle.trim()); }
    field('Før', s.beforeState);
    field('Handling', s.action);
    field('Kontroll', s.control);
    field('Etter / utløser', s.afterState);
    field('Lyd', s.audio);
    field('Endring', s.changeNote);
    field('Bro', s.bridge);
    field('Tid', s.timeNote);
    field('Utfordring', s.challenge);
    field('Spillmekanikk', s.gameplayMechanic);
    field('Miljø', s.environment);
    if (s.sourceRefs.length) { doc.moveDown(0.3); dim(`Kilder: ${s.sourceRefs.map((r) => `${r.tag} · ${r.ref}`).join(', ')}`); }
    if (s.lines.length) {
      doc.moveDown(0.6);
      h(`REPLIKKER (${s.lines.length})`, 8.5, ACCENT);
      for (const l of s.lines) {
        const text = l.textEn.trim() || l.textNb.trim();
        const extra = l.textEn.trim() && l.textNb.trim() ? `  /  ${l.textNb.trim()}` : '';
        p(`${l.cueId}  ${l.speakerLabel.trim() || '—'}:  ${text}${extra}  [${l.sourceType}${l.recordingStatus && l.recordingStatus !== 'none' ? ` · ${l.recordingStatus}` : ''}]`, 10);
      }
    }
    if (s.gates.length) {
      doc.moveDown(0.6);
      h('LEVERANSEGATER', 8.5, ACCENT);
      for (const g of s.gates) {
        p(`• ${GATE_LABEL[g.gateKey] ?? g.gateKey}: ${GATE_STATUS_LABEL[g.status] ?? g.status}${g.evidence.trim() ? ` — ${g.evidence.trim()}` : ''}`, 10);
      }
    }
  }

  // ── Vedlegg: sceneliste
  doc.addPage();
  dim('VEDLEGG');
  h('Sceneliste', 16, ACCENT);
  doc.moveDown(0.3);
  for (const s of input.scenes) p(`${s.code}  ${s.title}  ·  ${SCENE_STATUS_LABEL[s.status] ?? s.status}${s.episodeCode ? `  ·  ${s.episodeCode}` : ''}`, 10);
}

export function renderScenesScriptPdf(input: ScenesScriptPdfInput): Promise<Buffer> {
  const title = input.projectName.trim() || 'Manus';
  return renderPdf(title, (doc) => composeScenesScriptPdf(doc, input));
}

export function scenesScriptPdfFilename(projectName: string): string {
  return `${exportFileStem(projectName)}-manus.pdf`;
}
