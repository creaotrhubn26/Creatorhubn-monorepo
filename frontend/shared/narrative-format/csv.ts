/**
 * Story Graph → CSV (regneark-vennlig oversikt: én rad per element, deretter
 * variabler og komponenter). DOM-fri, delt av frontend, backend og MCP.
 *
 * Norsk Excel-profil (samme regler som backend/server/leadgrid-csv.ts, som
 * frontend ikke kan importere): skilletegn `;`, linjeskift `\r\n`, BOM, og
 * celler som starter med = + - @ tab/CR får `'`-prefiks (formel-injeksjon).
 */

import { applyLocaleToGraph } from './locale';
import { htmlToPlainText, htmlToTitle } from './text';
import { segmentContentHtml, stripCodeBlocks } from '../narrative-script/html';
import { bySort, elementLabel, indexGraph } from './traverse';
import type { ExportGraph } from './types';

export const CSV_DELIMITER = ';';
export const CSV_BOM = '﻿';
const EOL = '\r\n';
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = value == null ? '' : typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(CSV_DELIMITER);
}

const KIND_LABEL: Record<string, string> = { element: 'Element', branch: 'Forgrening', jumper: 'Jumper', note: 'Notat' };
const ELEMENT_HEADERS = ['Brett', 'Mappe', 'ElementId', 'CustomId', 'Type', 'Tittel', 'Innhold', 'Komponenter', 'Valg', 'Betingelser', 'JumperMål', 'Skript', 'Start'];

/** Skriptet (kodeblokkene) i et innhold som én celle; linjeskift bevares. */
function scriptOf(html: string | null | undefined): string {
  return segmentContentHtml(html ?? '')
    .filter((s): s is Extract<typeof s, { kind: 'code' }> => s.kind === 'code')
    .map((s) => s.code.trim())
    .filter(Boolean)
    .join('\n');
}

export function toCsv(input: ExportGraph, options: { locale?: string | null } = {}): string {
  const graph = applyLocaleToGraph(input, options.locale);
  const { elementById, connectionsBySource, componentsByElement } = indexGraph(graph);

  const lines: string[] = [csvRow(ELEMENT_HEADERS)];
  for (const board of bySort(graph.boards)) {
    for (const e of bySort(graph.elements.filter((el) => el.boardId === board.id))) {
      const outgoing = connectionsBySource.get(e.id) ?? [];
      const choices = e.kind === 'element'
        ? outgoing.map((c) => `${htmlToTitle(stripCodeBlocks(c.labelHtml ?? '')) || '→'} → ${elementLabel(elementById.get(c.targetId))}`).join(' | ')
        : '';
      const conditions = e.kind === 'branch'
        ? e.branchConditions.map((cond, i) => {
          const conn = outgoing.find((c) => c.sourceOutputKey === cond.id);
          const head = cond.script == null ? 'ellers' : `${i === 0 ? 'if' : 'elseif'} ${cond.script}`;
          return `${head} → ${conn ? elementLabel(elementById.get(conn.targetId)) : '(ikke koblet)'}`;
        }).join(' | ')
        : '';
      const jumperTarget = e.kind === 'jumper' ? elementLabel(e.jumperTargetId ? elementById.get(e.jumperTargetId) : undefined) : '';
      const labelScripts = e.kind === 'element' ? outgoing.map((c) => scriptOf(c.labelHtml)).filter(Boolean).map((s) => `[valg] ${s}`) : [];
      lines.push(csvRow([
        board.name, board.folderPath ?? '', e.id, e.customId ?? '', KIND_LABEL[e.kind] ?? e.kind,
        e.kind === 'note' ? '' : htmlToTitle(e.titleHtml),
        htmlToPlainText(stripCodeBlocks(e.contentHtml ?? '')),
        (componentsByElement.get(e.id) ?? []).join(', '),
        choices, conditions, jumperTarget,
        [scriptOf(e.contentHtml), ...labelScripts].filter(Boolean).join('\n'),
        e.id === graph.settings.startingElementId ? 'ja' : '',
      ]));
    }
  }

  if (graph.variables.length) {
    lines.push('', csvRow(['Variabler']), csvRow(['Navn', 'Type', 'Standard']));
    for (const v of bySort(graph.variables)) lines.push(csvRow([v.name, v.type, v.defaultValue ?? '']));
  }
  if (graph.components.length) {
    lines.push('', csvRow(['Komponenter']), csvRow(['Navn', 'Mappe', 'CustomId', 'Attributter']));
    for (const c of bySort(graph.components)) {
      const attrs = bySort(graph.attributes.filter((a) => a.ownerKind === 'component' && a.ownerId === c.id))
        .map((a) => `${a.name}=${a.type === 'rich_text' ? htmlToTitle(String(a.value ?? '')) : typeof a.value === 'string' ? a.value : JSON.stringify(a.value ?? null)}`)
        .join(' | ');
      lines.push(csvRow([c.name, c.folderPath ?? '', c.customId ?? '', attrs]));
    }
  }
  return CSV_BOM + lines.join(EOL) + EOL;
}
