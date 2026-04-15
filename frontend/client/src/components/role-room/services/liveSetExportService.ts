// @ts-nocheck
/**
 * liveSetExportService.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Pro-tier export engine for Live Set Mode.
 *
 * Exports:
 *  • Script Supervisor Daily Report → PDF  (A4, jsPDF + autotable)
 *  • Circle/Print Take List         → PDF
 *  • All Takes                      → CSV  (BOM UTF-8, Excel-safe)
 *  • Continuity Notes               → CSV
 *
 * Dependencies (already in frontend/package.json):
 *   jspdf ^3, jspdf-autotable ^5, file-saver ^2
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import type { Take, ContinuityNote, ShootingDay } from './productionWorkflowService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportContext {
  projectTitle:   string;
  projectId:      string;
  shootingDay:    ShootingDay;
  takes:          Take[];
  notes:          ContinuityNote[];
  exportedBy:     string;
  exportedAt?:    string; // ISO, defaults to now
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function nowISO(): string { return new Date().toISOString(); }

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function safeText(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v);
}

/** CSV: wrap in quotes and escape embedded quotes */
function csvCell(v: unknown): string {
  const s = safeText(v).replace(/"/g, '""');
  return `"${s}"`;
}

function csvRow(cols: unknown[]): string {
  return cols.map(csvCell).join(',');
}

/** Trigger a browser file download via file-saver */
function download(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

// ─── PDF header helper ────────────────────────────────────────────────────────

function addPdfHeader(doc: jsPDF, ctx: ExportContext, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  const exportedAt = ctx.exportedAt ?? nowISO();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(ctx.projectTitle, 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, 14, 25);
  doc.text(
    `Dag ${ctx.shootingDay.dayNumber} — ${dateLabel(ctx.shootingDay.date)} — ${ctx.shootingDay.location}`,
    14, 31,
  );
  doc.text(`Eksportert av ${ctx.exportedBy} ${timeLabel(exportedAt)}`, 14, 37);

  // Thin rule
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 40, w - 14, 40);
}

// ─── 1. Script Supervisor Daily Report (PDF) ──────────────────────────────────

export function exportDailyReportPdf(ctx: ExportContext): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addPdfHeader(doc, ctx, 'Script Supervisor Daglig Rapport');

  const circled  = ctx.takes.filter(t => t.status === 'circle');
  const printed  = ctx.takes.filter(t => t.status === 'print');
  const good     = ctx.takes.filter(t => t.status === 'good');
  const bad      = ctx.takes.filter(t => t.status === 'bad');

  // Summary stats box
  autoTable(doc, {
    startY: 44,
    head:   [['Totalt takes', 'Circle', 'Print', 'God', 'Dårlig']],
    body:   [[ctx.takes.length, circled.length, printed.length, good.length, bad.length]],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
  });

  const afterStats = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // All takes table
  autoTable(doc, {
    startY:   afterStats,
    head:     [['#', 'Scene', 'Shot', 'Take', 'Status', 'Kamera', 'Linse', 'FPS', 'ISO', 'ND', 'Sek', 'Notat']],
    body:     ctx.takes.map((t, i) => [
      i + 1,
      t.sceneId.replace('scene-', ''),
      t.shotId  ?? '',
      t.takeNumber,
      t.status.toUpperCase(),
      t.camera  ?? '',
      t.lens    ?? '',
      t.fps     ?? '',
      t.iso     ?? '',
      t.ndFilter ?? '',
      t.duration ?? '',
      t.notes   ?? '',
    ]),
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 8 },
      4: { cellWidth: 14 },
    },
  });

  const after = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Continuity notes
  if (ctx.notes.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Kontinuitetsnotater', 14, after);
    autoTable(doc, {
      startY:     after + 4,
      head:       [['Tid', 'Type', 'Scene', 'Notat', 'Av']],
      body:       ctx.notes.map(n => [
        timeLabel(n.timestamp),
        n.type,
        n.sceneId.replace('scene-', ''),
        n.note,
        n.createdBy ?? '',
      ]),
      styles:     { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 8 },
    });
  }

  const filename = `${ctx.projectTitle.replace(/\s+/g, '_')}_Dag${ctx.shootingDay.dayNumber}_rapport_${dateLabel(ctx.exportedAt ?? nowISO())}.pdf`;
  doc.save(filename);
}

// ─── 2. Circle / Print Take List (PDF) ───────────────────────────────────────

export function exportCirclePrintPdf(ctx: ExportContext): void {
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addPdfHeader(doc, ctx, 'Circle & Print — Take Liste');

  const selected = ctx.takes.filter(t => t.status === 'circle' || t.status === 'print');

  if (!selected.length) {
    doc.setFontSize(12);
    doc.text('Ingen circle eller print takes for denne dagen.', 14, 55);
  } else {
    autoTable(doc, {
      startY:   44,
      head:     [['Scene', 'Shot', 'Take #', 'Status', 'Kamera', 'Linse', 'FPS', 'ISO', 'ND', 'Varighet (s)', 'Tid logget', 'Notat']],
      body:     selected.map(t => [
        t.sceneId.replace('scene-', ''),
        t.shotId  ?? '',
        t.takeNumber,
        t.status.toUpperCase(),
        t.camera  ?? '',
        t.lens    ?? '',
        t.fps     ?? '',
        t.iso     ?? '',
        t.ndFilter ?? '',
        t.duration ?? '',
        t.loggedAt ? timeLabel(t.loggedAt) : '',
        t.notes   ?? '',
      ]),
      styles:     { fontSize: 9, cellPadding: 2.5 },
      headStyles: {
        fillColor: t => t.column.index === 3 ? [21, 101, 192] : [30, 30, 30],
        textColor: 255,
        fontSize:  9,
      } as Parameters<typeof autoTable>[1]['headStyles'],
      alternateRowStyles: { fillColor: [240, 247, 255] },
    });
  }

  const filename = `${ctx.projectTitle.replace(/\s+/g, '_')}_Dag${ctx.shootingDay.dayNumber}_circle_print.pdf`;
  doc.save(filename);
}

// ─── 3. All Takes → CSV ───────────────────────────────────────────────────────

export function exportTakesCsv(ctx: ExportContext): void {
  const BOM = '\uFEFF'; // Excel-safe UTF-8
  const header = csvRow([
    'Prosjekt', 'Dag', 'Dato', 'Scene', 'Shot', 'Take', 'Status',
    'Kamera', 'Linse', 'FPS', 'ISO', 'ND-filter', 'Varighet (s)',
    'Tid logget', 'Notat', 'Logget av',
  ]);
  const rows = ctx.takes.map(t =>
    csvRow([
      ctx.projectTitle,
      ctx.shootingDay.dayNumber,
      dateLabel(ctx.shootingDay.date),
      t.sceneId.replace('scene-', ''),
      t.shotId    ?? '',
      t.takeNumber,
      t.status,
      t.camera    ?? '',
      t.lens      ?? '',
      t.fps       ?? '',
      t.iso       ?? '',
      t.ndFilter  ?? '',
      t.duration  ?? '',
      t.loggedAt  ? timeLabel(t.loggedAt) : '',
      t.notes     ?? '',
      t.loggedBy  ?? '',
    ]),
  );
  const csv  = [header, ...rows].join('\r\n');
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `${ctx.projectTitle.replace(/\s+/g, '_')}_Dag${ctx.shootingDay.dayNumber}_takes.csv`;
  download(blob, filename);
}

// ─── 4. Continuity Notes → CSV ────────────────────────────────────────────────

export function exportNotesCsv(ctx: ExportContext): void {
  const BOM    = '\uFEFF';
  const header = csvRow(['Prosjekt', 'Dag', 'Dato', 'Scene', 'Shot', 'Take', 'Type', 'Notat', 'Tid', 'Av']);
  const rows   = ctx.notes.map(n =>
    csvRow([
      ctx.projectTitle,
      ctx.shootingDay.dayNumber,
      dateLabel(ctx.shootingDay.date),
      n.sceneId.replace('scene-', ''),
      n.shotId    ?? '',
      n.takeId    ?? '',
      n.type,
      n.note,
      timeLabel(n.timestamp),
      n.createdBy ?? '',
    ]),
  );
  const csv    = [header, ...rows].join('\r\n');
  const blob   = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `${ctx.projectTitle.replace(/\s+/g, '_')}_Dag${ctx.shootingDay.dayNumber}_notater.csv`;
  download(blob, filename);
}

// ─── 5. Convenience: export all four in one zip-like sequence ───────────────

export function exportAll(ctx: ExportContext): void {
  exportDailyReportPdf(ctx);
  exportCirclePrintPdf(ctx);
  exportTakesCsv(ctx);
  exportNotesCsv(ctx);
}
