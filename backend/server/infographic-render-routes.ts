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

// Enkel TTL-cache for GET-render (samme tpl+data+dims → serveres fra minne).
const imgCache = new Map<string, { buf: Buffer; at: number }>();
const IMG_CACHE_TTL_MS = 15 * 60 * 1000;
const IMG_CACHE_MAX = 300;

// Bare hostede maler under /embed/ (validert path). Fetches fra frontend-basen — INGEN
// vilkårlig host (SSRF-vern). Basen settes via env; default localhost for dev.
const TEMPLATE_BASE = process.env.INFOGRAPHIC_TEMPLATE_BASE || 'http://localhost:5001';
const SAFE_TPL = /^\/embed\/[A-Za-z0-9._/-]+\.html$/;

export function registerInfographicRenderRoutes(
  app: Express,
  deps: { activeSessions: Sessions },
): void {
  // GET /api/infographics/render.png — OFFENTLIG (til <img> i CMS-sider). Rendrer en
  // HOSTET bibliotek-mal (?tpl=/embed/…) med data (?d=base64url-JSON) → PNG. SEO-vennlig,
  // ingen klient-JS. Cachet + IP-rate-limitet. KUN /embed/-maler (ingen vilkårlig HTML/host).
  app.get(
    '/api/infographics/render.png',
    aiRateLimit({ windowMs: 60_000, max: 60, label: 'infographic-render-img' }),
    async (req: Request, res: Response) => {
      const tpl = String(req.query.tpl ?? '');
      if (!SAFE_TPL.test(tpl) || tpl.includes('..')) {
        res.status(400).json({ error: 'Ugyldig tpl — kun /embed/*.html-maler.' });
        return;
      }
      const width = clampDim(req.query.w, 1200);
      const height = clampDim(req.query.h, 630);
      const dRaw = typeof req.query.d === 'string' ? req.query.d : '';
      const accent = typeof req.query.accent === 'string' ? req.query.accent : '';
      const key = `${tpl}|${width}x${height}|${accent}|${dRaw}`;
      const now = Date.now();
      const hit = imgCache.get(key);
      if (hit && now - hit.at < IMG_CACHE_TTL_MS) {
        res.type('image/png').setHeader('Cache-Control', 'public, max-age=86400').send(hit.buf);
        return;
      }
      let data: Record<string, unknown> = {};
      if (dRaw) { try { data = JSON.parse(Buffer.from(dRaw, 'base64url').toString('utf8')); } catch { /* tom */ } }
      if (accent) data.accent = accent;
      try {
        const r = await fetch(`${TEMPLATE_BASE}${tpl}`);
        if (!r.ok) { res.status(502).json({ error: 'Kunne ikke hente mal.' }); return; }
        const templateHtml = await r.text();
        if (templateHtml.length > MAX_TEMPLATE_BYTES) { res.status(413).json({ error: 'Mal for stor.' }); return; }
        const html = assembleHtml(templateHtml, data, { progress: 1, width, height });
        const buf = await renderHtmlToImage(html, { width, height, deviceScaleFactor: 2, format: 'png', waitForMs: 400, blockExternalRequests: true });
        if (imgCache.size >= IMG_CACHE_MAX) imgCache.delete(imgCache.keys().next().value as string);
        imgCache.set(key, { buf, at: now });
        res.type('image/png').setHeader('Cache-Control', 'public, max-age=86400').send(buf);
      } catch (e) {
        res.status(500).json({ error: 'Render feilet: ' + (e as Error).message });
      }
    },
  );

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
