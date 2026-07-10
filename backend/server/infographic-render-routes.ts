// infographic-render-routes.ts — server-side render-API for Infographic Studio.
//
// POST /api/infographics/render — genererer et infographic-BILDE (png/jpeg) eller HTML
// fra en INLINE mal + data. Programmatisk generering (CMS server-render, live-data,
// rapporter) uten klient-JS.
//
// SIKKERHET:
//   • Gated (Bearer-token → activeSessions). Kun innloggede.
//   • Rate-limitet (aiRateLimit).
//   • KUN inline `templateHtml` — INGEN URL-fetch (unngår SSRF fra server).
//   • Render kjører med blockExternalRequests → den rendrede siden kan ikke hente
//     interne/eksterne URL-er (SSRF-vern på selve render-en).
//   • Størrelses-/dimensjons-tak.

import type { Express, Request, Response } from 'express';
import { assembleHtml } from './infographic-engine.js';
import { renderHtmlToImage } from './render-engine.js';
import { aiRateLimit } from './ai-rate-limiter.js';

type Sessions = Map<string, { userId?: string }>;

const MAX_TEMPLATE_BYTES = 500_000;   // 500 KB mal-HTML
const MAX_DIM = 3000;
const MIN_DIM = 64;

function userIdOf(req: Request, sessions: Sessions): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const s = sessions.get(auth.slice(7).trim());
    if (s?.userId) return s.userId;
  }
  return null;
}

const clampDim = (v: unknown, def: number): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(MAX_DIM, Math.max(MIN_DIM, n)) : def;
};

export function registerInfographicRenderRoutes(
  app: Express,
  deps: { activeSessions: Sessions },
): void {
  app.post(
    '/api/infographics/render',
    aiRateLimit({ windowMs: 60_000, max: 30, label: 'infographic-render' }),
    async (req: Request, res: Response) => {
      const userId = userIdOf(req, deps.activeSessions);
      if (!userId) { res.status(401).json({ error: 'Ikke innlogget.' }); return; }

      const b = (req.body ?? {}) as Record<string, unknown>;
      const templateHtml = typeof b.templateHtml === 'string' ? b.templateHtml : '';
      if (!templateHtml) {
        res.status(400).json({ error: 'templateHtml (inline mal-HTML) kreves. URL-fetch er ikke tillatt (SSRF-vern).' });
        return;
      }
      if (templateHtml.length > MAX_TEMPLATE_BYTES) {
        res.status(413).json({ error: 'Mal-HTML er for stor.' });
        return;
      }

      const data: Record<string, unknown> = (b.data && typeof b.data === 'object') ? { ...(b.data as Record<string, unknown>) } : {};
      if (typeof b.accent === 'string') data.accent = b.accent;
      const fontsCss = typeof b.fontsCss === 'string' ? b.fontsCss : undefined;
      const format = b.format === 'jpeg' || b.format === 'html' ? b.format : 'png';
      const width = clampDim(b.width, 1200);
      const height = clampDim(b.height, 630);
      const autoplaySec = typeof b.autoplaySec === 'number' && b.autoplaySec > 0 ? b.autoplaySec : undefined;

      try {
        if (format === 'html') {
          // Selvstendig, self-playing HTML (til <iframe>-embed) — ingen render nødvendig.
          const html = assembleHtml(templateHtml, data, { fontsCss, autoplaySec, loop: true });
          res.type('html').send(html);
          return;
        }
        // Bilde: statisk sluttbilde (progress=1), fast viewport.
        const html = assembleHtml(templateHtml, data, { fontsCss, progress: 1, width, height });
        const buf = await renderHtmlToImage(html, {
          width, height, deviceScaleFactor: 2, format,
          waitForMs: 400, waitUntil: 'networkidle0',
          blockExternalRequests: true,
        });
        res.type(format === 'jpeg' ? 'image/jpeg' : 'image/png');
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(buf);
      } catch (e) {
        res.status(500).json({ error: 'Render feilet: ' + (e as Error).message });
      }
    },
  );
}
