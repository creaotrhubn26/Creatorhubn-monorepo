// infographic-render.ts — GJENBRUKBAR «infographic → PNG-buffer» for server-side embedding.
//
// render.png-endepunktet gir en URL (til <img>). Denne gir et BUFFER — for kontekster som
// trenger selve bytene: PDF-rapporter (pdfkit doc.image), e-post-vedlegg, fil-eksport.
// Komponerer templates-store (mal-HTML + auto-velg) + engine (assembleHtml) + render-engine
// (puppeteer → PNG) + bundlede fonter, ett sted, så alle server-flater deler samme vei.

import type { Pool } from 'pg';

import { assembleHtml } from './infographic-engine.js';
import { INTER_FONT_CSS } from './infographic-fonts.js';
import { getTemplateHtml, pickTemplateId } from './infographic-templates-store.js';
import { renderHtmlToImage } from './render-engine.js';

export interface RenderInfographicOpts {
  /** Mal-id | 'auto' (default 'auto' → motoren velger fra data-formen). */
  tpl?: string;
  /** Workspace → merkevare + workspace-scopede maler. */
  ws?: string;
  /** Aksent-hex (flettes inn i data hvis data.accent ikke satt). */
  accent?: string;
  /** Data (leses av malen som __CFG__). */
  data?: Record<string, unknown>;
  width?: number;
  height?: number;
}

/** Rendrer en infographic til et PNG-buffer. `null` hvis malen mangler. Fonter er bundlet
 *  (Inter + emoji via Docker), så output er miljø-uavhengig. */
export async function renderInfographicToBuffer(pool: Pool, opts: RenderInfographicOpts = {}): Promise<Buffer | null> {
  const { tpl = 'auto', ws, accent, data = {}, width = 1200, height = 630 } = opts;
  const d: Record<string, unknown> = { ...data };
  if (accent && d.accent == null) d.accent = accent;
  const id = tpl && tpl !== 'auto' ? tpl : await pickTemplateId(pool, d, ws);
  const templateHtml = await getTemplateHtml(pool, id);
  if (!templateHtml) return null;
  const html = assembleHtml(templateHtml, d, { progress: 1, width, height, fontsCss: INTER_FONT_CSS });
  return renderHtmlToImage(html, { width, height, deviceScaleFactor: 2, format: 'png', waitForMs: 400, blockExternalRequests: true });
}
