/**
 * Story Graph → Markdown (lesbar gjennomgang per brett: elementer, valg,
 * forgreninger, jumpere, notater, variabler, komponenter). DOM-fri.
 */

import { applyLocaleToGraph } from './locale';
import { contentHtmlToMarkdown, htmlToPlainText, htmlToTitle } from './text';
import type { ExportElement, ExportGraph } from './types';

function bySort<T extends { sortOrder?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function elementLabel(e: ExportElement | undefined): string {
  if (!e) return '(mangler)';
  const title = htmlToTitle(e.titleHtml);
  if (title) return title;
  if (e.kind === 'branch') return 'Forgrening';
  if (e.kind === 'jumper') return 'Jumper';
  return e.customId ? `#${e.customId}` : 'Uten tittel';
}

export function toMarkdown(input: ExportGraph, options: { locale?: string | null } = {}): string {
  const graph = applyLocaleToGraph(input, options.locale);
  const out: string[] = [];
  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const componentById = new Map(graph.components.map((c) => [c.id, c]));
  const connectionsBySource = new Map<string, ExportGraph['connections']>();
  for (const c of bySort(graph.connections)) {
    const list = connectionsBySource.get(c.sourceId) ?? [];
    list.push(c);
    connectionsBySource.set(c.sourceId, list);
  }
  const componentsByElement = new Map<string, string[]>();
  for (const ec of bySort(graph.elementComponents)) {
    const list = componentsByElement.get(ec.elementId) ?? [];
    const name = componentById.get(ec.componentId)?.name;
    if (name) list.push(name);
    componentsByElement.set(ec.elementId, list);
  }

  out.push(`# ${graph.settings.title?.trim() || 'Story Graph'}`);
  const start = graph.settings.startingElementId ? elementById.get(graph.settings.startingElementId) : undefined;
  out.push('');
  out.push(`Startelement: ${start ? `**${elementLabel(start)}**` : '_ikke satt_'}`);

  for (const board of bySort(graph.boards)) {
    const folder = board.folderPath?.trim();
    out.push('', `## ${board.name}${folder ? ` (${folder})` : ''}`);
    const elements = bySort(graph.elements.filter((e) => e.boardId === board.id));
    if (elements.length === 0) out.push('', '_Tomt brett._');
    for (const e of elements) {
      if (e.kind === 'note') {
        const text = htmlToPlainText(e.contentHtml);
        out.push('', ...(text ? text.split('\n').map((l) => `> ${l}`) : ['> _(tomt notat)_']));
        continue;
      }
      const heading = `### ${elementLabel(e)}${e.customId ? ` \`${e.customId}\`` : ''}${e.id === graph.settings.startingElementId ? ' ▶' : ''}`;
      out.push('', heading);
      if (e.kind === 'element') {
        const comps = componentsByElement.get(e.id) ?? [];
        if (comps.length) out.push('', `_Komponenter: ${comps.join(', ')}_`);
        const body = contentHtmlToMarkdown(e.contentHtml);
        if (body) out.push('', body);
        const outgoing = connectionsBySource.get(e.id) ?? [];
        if (outgoing.length) {
          out.push('', 'Valg:');
          for (const c of outgoing) {
            const label = htmlToTitle(c.labelHtml);
            out.push(`- ${label ? `«${label}» → ` : '→ '}${elementLabel(elementById.get(c.targetId))}`);
          }
        } else {
          out.push('', '_Slutt (ingen utganger)._');
        }
      } else if (e.kind === 'branch') {
        const outgoing = connectionsBySource.get(e.id) ?? [];
        out.push('', 'Forgrening:');
        e.branchConditions.forEach((cond, i) => {
          const conn = outgoing.find((c) => c.sourceOutputKey === cond.id);
          const target = conn ? elementLabel(elementById.get(conn.targetId)) : '_(ikke koblet)_';
          const head = cond.script == null ? 'ellers' : `${i === 0 ? 'if' : 'elseif'} \`${cond.script}\``;
          out.push(`- ${head} → ${target}`);
        });
      } else if (e.kind === 'jumper') {
        const target = e.jumperTargetId ? elementById.get(e.jumperTargetId) : undefined;
        out.push('', `Jumper → ${target ? elementLabel(target) : '_(uten mål)_'}`);
      }
    }
  }

  if (graph.variables.length) {
    out.push('', '## Variabler', '', '| Navn | Type | Standard |', '|---|---|---|');
    for (const v of bySort(graph.variables)) out.push(`| ${v.name} | ${v.type} | ${JSON.stringify(v.defaultValue ?? null)} |`);
  }

  if (graph.components.length) {
    out.push('', '## Komponenter');
    for (const c of bySort(graph.components)) {
      const attrs = bySort(graph.attributes.filter((a) => a.ownerKind === 'component' && a.ownerId === c.id));
      const folder = c.folderPath?.trim();
      out.push('', `- **${c.name}**${folder ? ` (${folder})` : ''}${c.customId ? ` \`${c.customId}\`` : ''}`);
      for (const a of attrs) {
        const value = a.type === 'rich_text' ? htmlToTitle(String(a.value ?? '')) : JSON.stringify(a.value ?? null);
        out.push(`  - ${a.name}: ${value}`);
      }
    }
  }

  return out.join('\n').trim() + '\n';
}
