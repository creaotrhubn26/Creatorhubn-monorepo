/**
 * Standalone HTML-eksport: én fil med spilleren (ferdigbygd IIFE fra
 * `frontend/shared/narrative-player/`) og grafen inlinet. Åpnes lokalt uten
 * nett. Grafen reduseres til runtime-delsettet (ingen notater, ingen
 * riktekst-attributter, ingen lagringsnøkler).
 */

import type { RuntimeGraph } from '../narrative-runtime/types';
import { htmlToTitle } from './text';
import type { ExportGraph } from './types';

const TYPED_ATTRIBUTES = new Set(['bool', 'int', 'float', 'string']);

/** Delsettet spilleren trenger — også brukt av det offentlige delings-endepunktet. */
export function toRuntimeSubset(graph: ExportGraph): RuntimeGraph {
  return {
    settings: { startingElementId: graph.settings.startingElementId },
    boards: graph.boards.map((b) => ({ id: b.id, name: b.name, customId: b.customId ?? null })),
    elements: graph.elements
      .filter((e) => e.kind !== 'note')
      .map((e) => ({
        id: e.id, boardId: e.boardId, kind: e.kind, titleHtml: e.titleHtml, contentHtml: e.contentHtml,
        customId: e.customId, jumperTargetId: e.jumperTargetId, branchConditions: e.branchConditions, sortOrder: e.sortOrder ?? 0,
      })),
    connections: graph.connections.map((c) => ({
      id: c.id, sourceId: c.sourceId, targetId: c.targetId, sourceOutputKey: c.sourceOutputKey, labelHtml: c.labelHtml, sortOrder: c.sortOrder ?? 0,
    })),
    components: graph.components.map((c) => ({ id: c.id, name: c.name, customId: c.customId ?? null })),
    elementComponents: graph.elementComponents.map((ec) => ({ elementId: ec.elementId, componentId: ec.componentId, sortOrder: ec.sortOrder ?? 0 })),
    attributes: graph.attributes
      .filter((a) => a.ownerKind !== 'element' && TYPED_ATTRIBUTES.has(a.type))
      .map((a) => ({ ownerKind: a.ownerKind, ownerId: a.ownerId, name: a.name, type: a.type, value: a.value })),
    variables: graph.variables.map((v) => ({ id: v.id, name: v.name, type: v.type, defaultValue: v.defaultValue })),
  };
}

/** JSON som trygt kan stå inne i <script>: `<` og linjeskilletegn escapes. */
export function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface StandaloneHtmlOptions {
  title?: string | null;
  graph: ExportGraph;
  /** Innholdet i client/public/embed/narrative-player.js. */
  playerJs: string;
  /** Vis debugger-panel (variabler/besøk) i den eksporterte spilleren. */
  debug?: boolean;
  lang?: string;
}

export const STANDALONE_CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0b0d0f;color:#e8ebe9;font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.sgp{min-height:100vh;display:flex;flex-direction:column}
.sgp-bar{display:flex;align-items:center;gap:.5rem;padding:.6rem 1rem;border-bottom:1px solid #1f2a24;background:#0f1412;flex-wrap:wrap}
.sgp-bar h1{font-size:.9rem;margin:0;flex:1;letter-spacing:.04em;color:#9fb3a8;font-weight:600}
.sgp-btn{background:transparent;color:#cfd8d3;border:1px solid #2b3a32;border-radius:6px;padding:.35rem .7rem;font:inherit;font-size:.85rem;cursor:pointer}
.sgp-btn:hover{border-color:#22c55e;background:rgba(34,197,94,.08)}
.sgp-btn[disabled]{opacity:.4;cursor:default}
.sgp-btn.sgp-primary{background:#22c55e;color:#04140a;border-color:#22c55e;font-weight:700}
.sgp-body{display:flex;flex:1;min-height:0}
.sgp-main{flex:1;overflow:auto;padding:2rem 1rem}
.sgp-card{max-width:720px;margin:0 auto}
.sgp-speaker{display:inline-block;font-size:.75rem;font-weight:700;color:#22c55e;background:rgba(34,197,94,.12);border-radius:999px;padding:.1rem .6rem;margin-right:.5rem}
.sgp-title{font-size:.8rem;color:#7d8f86;margin-bottom:.5rem}
.sgp-content p{margin:.6rem 0}
.sgp-content .narrative-show{color:#22c55e;font-family:ui-monospace,monospace;font-size:.9em}
.sgp-content .mention{color:#22c55e;font-weight:600}
.sgp-content img{max-width:100%;border-radius:6px}
.sgp-options{display:flex;flex-direction:column;gap:.5rem;margin-top:1.5rem}
.sgp-option{text-align:left;background:transparent;color:#e8ebe9;border:1px solid #2b3a32;border-radius:8px;padding:.6rem .9rem;font:inherit;cursor:pointer}
.sgp-option:hover{border-color:#22c55e;background:rgba(34,197,94,.08)}
.sgp-end{color:#f59e0b;font-size:.85rem;margin-top:1rem}
.sgp-errors{margin-top:1rem;padding:.6rem .8rem;border:1px solid #7c5a12;border-radius:8px;color:#fbbf24;font-size:.85rem}
.sgp-debug{width:300px;flex:0 0 300px;border-left:1px solid #1f2a24;background:#0f1412;padding:1rem;overflow:auto;font-size:.8rem}
.sgp-debug h2{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#7d8f86;margin:0 0 .5rem}
.sgp-debug table{width:100%;border-collapse:collapse;margin-bottom:1rem}
.sgp-debug td{padding:.2rem 0;border-bottom:1px solid #1f2a24;vertical-align:middle}
.sgp-debug input{width:100%;background:#0b0d0f;color:#e8ebe9;border:1px solid #2b3a32;border-radius:4px;padding:.15rem .3rem;font:inherit;font-size:.8rem}
.sgp-log{font-family:ui-monospace,monospace;font-size:.72rem;color:#9fb3a8;white-space:pre-wrap}
@media (max-width:800px){.sgp-debug{display:none}}
`;

export function buildStandaloneHtml(options: StandaloneHtmlOptions): string {
  const title = options.title?.trim() || 'Story Graph';
  const runtime = toRuntimeSubset(options.graph);
  const playerJs = options.playerJs.replace(/<\/script/gi, '<\\/script');
  const config = jsonForScriptTag({ title, debug: !!options.debug, graph: runtime });
  return [
    '<!doctype html>',
    `<html lang="${escapeHtmlText(options.lang ?? 'nb')}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtmlText(title)}</title>`,
    `<style>${STANDALONE_CSS}</style>`,
    '</head>',
    '<body>',
    '<div id="story-graph-root"></div>',
    `<script>${playerJs}</script>`,
    `<script>window.__STORY_GRAPH__=${config};</script>`,
    '<script>StoryGraphPlayer.mount(document.getElementById("story-graph-root"),window.__STORY_GRAPH__.graph,{title:window.__STORY_GRAPH__.title,debug:window.__STORY_GRAPH__.debug});</script>',
    '</body>',
    '</html>',
  ].join('\n');
}

/** Filnavn-vennlig tittel (eksport-nedlastinger). */
export function exportFileStem(title: string | null | undefined, fallback = 'story-graph'): string {
  const base = htmlToTitle(title ?? '')
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || fallback;
}
