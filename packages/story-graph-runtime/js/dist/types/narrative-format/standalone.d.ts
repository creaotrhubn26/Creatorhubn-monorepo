/**
 * Standalone HTML-eksport: én fil med spilleren (ferdigbygd IIFE fra
 * `frontend/shared/narrative-player/`) og grafen inlinet. Åpnes lokalt uten
 * nett. Grafen reduseres til runtime-delsettet (ingen notater, ingen
 * riktekst-attributter, ingen lagringsnøkler).
 */
import type { RuntimeGraph } from '../narrative-runtime/types';
import type { ExportGraph } from './types';
/** Delsettet spilleren trenger — også brukt av det offentlige delings-endepunktet. */
export declare function toRuntimeSubset(graph: ExportGraph): RuntimeGraph;
/** JSON som trygt kan stå inne i <script>: `<` og linjeskilletegn escapes. */
export declare function jsonForScriptTag(value: unknown): string;
export interface StandaloneHtmlOptions {
    title?: string | null;
    graph: ExportGraph;
    /** Innholdet i client/public/embed/narrative-player.js. */
    playerJs: string;
    /** Vis debugger-panel (variabler/besøk) i den eksporterte spilleren. */
    debug?: boolean;
    lang?: string;
    /** Eksporter på et annet språk enn kilden. */
    locale?: string | null;
}
export declare const STANDALONE_CSS = "\n:root{color-scheme:dark}\n*{box-sizing:border-box}\nbody{margin:0;background:#0b0d0f;color:#e8ebe9;font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}\n.sgp{min-height:100vh;display:flex;flex-direction:column}\n.sgp-bar{display:flex;align-items:center;gap:.5rem;padding:.6rem 1rem;border-bottom:1px solid #1f2a24;background:#0f1412;flex-wrap:wrap}\n.sgp-bar h1{font-size:.9rem;margin:0;flex:1;letter-spacing:.04em;color:#9fb3a8;font-weight:600}\n.sgp-btn{background:transparent;color:#cfd8d3;border:1px solid #2b3a32;border-radius:6px;padding:.35rem .7rem;font:inherit;font-size:.85rem;cursor:pointer}\n.sgp-btn:hover{border-color:#22c55e;background:rgba(34,197,94,.08)}\n.sgp-btn[disabled]{opacity:.4;cursor:default}\n.sgp-btn.sgp-primary{background:#22c55e;color:#04140a;border-color:#22c55e;font-weight:700}\n.sgp-body{display:flex;flex:1;min-height:0}\n.sgp-main{flex:1;overflow:auto;padding:2rem 1rem}\n.sgp-card{max-width:720px;margin:0 auto}\n.sgp-speaker{display:inline-block;font-size:.75rem;font-weight:700;color:#22c55e;background:rgba(34,197,94,.12);border-radius:999px;padding:.1rem .6rem;margin-right:.5rem}\n.sgp-title{font-size:.8rem;color:#7d8f86;margin-bottom:.5rem}\n.sgp-content p{margin:.6rem 0}\n.sgp-content .narrative-show{color:#22c55e;font-family:ui-monospace,monospace;font-size:.9em}\n.sgp-content .mention{color:#22c55e;font-weight:600}\n.sgp-content img{max-width:100%;border-radius:6px}\n.sgp-options{display:flex;flex-direction:column;gap:.5rem;margin-top:1.5rem}\n.sgp-option{text-align:left;background:transparent;color:#e8ebe9;border:1px solid #2b3a32;border-radius:8px;padding:.6rem .9rem;font:inherit;cursor:pointer}\n.sgp-option:hover{border-color:#22c55e;background:rgba(34,197,94,.08)}\n.sgp-end{color:#f59e0b;font-size:.85rem;margin-top:1rem}\n.sgp-errors{margin-top:1rem;padding:.6rem .8rem;border:1px solid #7c5a12;border-radius:8px;color:#fbbf24;font-size:.85rem}\n.sgp-debug{width:300px;flex:0 0 300px;border-left:1px solid #1f2a24;background:#0f1412;padding:1rem;overflow:auto;font-size:.8rem}\n.sgp-debug h2{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#7d8f86;margin:0 0 .5rem}\n.sgp-debug table{width:100%;border-collapse:collapse;margin-bottom:1rem}\n.sgp-debug td{padding:.2rem 0;border-bottom:1px solid #1f2a24;vertical-align:middle}\n.sgp-debug input{width:100%;background:#0b0d0f;color:#e8ebe9;border:1px solid #2b3a32;border-radius:4px;padding:.15rem .3rem;font:inherit;font-size:.8rem}\n.sgp-log{font-family:ui-monospace,monospace;font-size:.72rem;color:#9fb3a8;white-space:pre-wrap}\n@media (max-width:800px){.sgp-debug{display:none}}\n";
export declare function buildStandaloneHtml(options: StandaloneHtmlOptions): string;
/** Filnavn-vennlig tittel (eksport-nedlastinger). */
export declare function exportFileStem(title: string | null | undefined, fallback?: string): string;
