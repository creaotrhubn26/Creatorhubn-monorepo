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
import type { Pool } from 'pg';
import { assembleHtml } from './infographic-engine.js';
import { INTER_FONT_CSS } from './infographic-fonts.js';
import { renderHtmlToImage } from './render-engine.js';
import { aiRateLimit } from './ai-rate-limiter.js';
import {
  listTemplates, listTemplatesAdmin, getTemplateHtml, pickTemplateId,
  upsertTemplate, deleteTemplate,
} from './infographic-templates-store.js';
import { getTokens, getRawTokens, setTokens } from './design-tokens-store.js';

type Sessions = Map<string, { userId?: string }>;
type AdminGuard = (req: Request, res: Response) => { email: string } | null;
const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

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

// /embed/(templates/)?<id>.html → <id>  (back-compat for gamle CMS-blokker)
function embedPathToId(p: string): string {
  return p.replace(/^\/embed\/(?:templates\/)?/, '').replace(/\.html$/, '');
}
// innebygd id → /embed-sti (fallback-fetch før migrasjon)
function builtinEmbedPath(id: string): string {
  return id === 'demo-template' ? '/embed/demo-template.html' : `/embed/templates/${id}.html`;
}

export function registerInfographicRenderRoutes(
  app: Express,
  deps: { activeSessions: Sessions; pool: Pool; requireAdminSession: AdminGuard },
): void {
  const { pool, requireAdminSession } = deps;

  // GET /api/infographics/templates?ws=<workspace> — OFFENTLIG liste (globale + workspace-
  // scopede) til mal-velger. Uten ws → kun globale (produkt-flatene holdes atskilt).
  app.get('/api/infographics/templates', async (req: Request, res: Response) => {
    const rows = await listTemplates(pool, req.query.ws as string | undefined);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ templates: rows.map((t) => ({ id: t.id, label: t.label, category: t.category, isBuiltin: t.isBuiltin, workspaceId: t.workspaceId })) });
  });
  // GET /api/infographics/render.png — OFFENTLIG (til <img> i CMS-sider). Rendrer en
  // HOSTET bibliotek-mal (?tpl=/embed/…) med data (?d=base64url-JSON) → PNG. SEO-vennlig,
  // ingen klient-JS. Cachet + IP-rate-limitet. KUN /embed/-maler (ingen vilkårlig HTML/host).
  app.get(
    '/api/infographics/render.png',
    aiRateLimit({ windowMs: 60_000, max: 60, label: 'infographic-render-img' }),
    async (req: Request, res: Response) => {
      const rawTpl = String(req.query.tpl ?? '');
      const width = clampDim(req.query.w, 1200);
      const height = clampDim(req.query.h, 630);
      const dRaw = typeof req.query.d === 'string' ? req.query.d : '';
      const accentQ = typeof req.query.accent === 'string' ? req.query.accent : '';
      // Data parses FØR mal-valg, så `tpl=auto` kan la motoren velge mal fra data-formen.
      let data: Record<string, unknown> = {};
      if (dRaw) { try { data = JSON.parse(Buffer.from(dRaw, 'base64url').toString('utf8')); } catch { /* tom */ } }
      // Aksent: query > data > workspace-merkevare (design-token). Gjør render on-brand per produkt.
      let accent = accentQ;
      if (!accent && data.accent == null) accent = (await getTokens(pool, req.query.ws as string | undefined)).accent;
      if (accent) data.accent = accent;
      // Løs `tpl` → en mal-ID. Maler er DATA (DB): «auto» velger fra registeret;
      // «/embed/…html» (gamle blokker) og bare id-er mapper til samme DB-id.
      let id: string;
      let embedFallback: string | null = null;
      if (rawTpl === 'auto') {
        id = await pickTemplateId(pool, data, req.query.ws as string | undefined);
        embedFallback = builtinEmbedPath(id);
      } else if (SAFE_TPL.test(rawTpl) && !rawTpl.includes('..')) {
        id = embedPathToId(rawTpl);
        embedFallback = rawTpl;
      } else if (TEMPLATE_ID_RE.test(rawTpl)) {
        id = rawTpl;
        embedFallback = builtinEmbedPath(id);
      } else {
        res.status(400).json({ error: 'Ugyldig tpl — mal-id, /embed/*.html eller «auto».' });
        return;
      }
      const key = `${id}|${width}x${height}|${accent}|${dRaw}`;
      const now = Date.now();
      const hit = imgCache.get(key);
      if (hit && now - hit.at < IMG_CACHE_TTL_MS) {
        res.type('image/png').setHeader('Cache-Control', 'public, max-age=86400').send(hit.buf);
        return;
      }
      try {
        // Primært: HTML fra DB-registeret. Fallback (før migrasjon): hostet /embed-fil.
        let templateHtml = await getTemplateHtml(pool, id);
        if (!templateHtml && embedFallback && SAFE_TPL.test(embedFallback)) {
          const r = await fetch(`${TEMPLATE_BASE}${embedFallback}`);
          if (r.ok) templateHtml = await r.text();
        }
        if (!templateHtml) { res.status(404).json({ error: 'Ukjent mal.' }); return; }
        if (templateHtml.length > MAX_TEMPLATE_BYTES) { res.status(413).json({ error: 'Mal for stor.' }); return; }
        const html = assembleHtml(templateHtml, data, { progress: 1, width, height, fontsCss: INTER_FONT_CSS });
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
      // Inter bundlet som standard; egendefinert fontsCss legges til (ikke erstattes).
      const fontsCss = INTER_FONT_CSS + (typeof b.fontsCss === 'string' ? b.fontsCss : '');
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

  // ── ADMIN: mal-CRUD (legg til/rediger maler UTEN app-deploy) ──────────────
  // GET liste (m/ inaktive + metadata) til admin-UI.
  app.get('/api/admin/infographics/templates', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ templates: await listTemplatesAdmin(pool) });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST/PUT upsert. Validering (id, kontrakt, størrelse) i store.
  const upsertHandler = async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const result = await upsertTemplate(pool, {
      id: String(b.id ?? ''),
      label: String(b.label ?? ''),
      html: String(b.html ?? ''),
      category: (b.category as never) ?? 'other',
      autoPriority: typeof b.autoPriority === 'number' ? b.autoPriority : 0,
      accentDefault: typeof b.accent === 'string' ? b.accent : (typeof b.accentDefault === 'string' ? b.accentDefault : null),
      active: b.active !== false,
      workspaceId: (b.workspaceId ?? b.workspace) as string | null | undefined,
    });
    if ('error' in result) { res.status(400).json(result); return; }
    res.json({ ok: true });
  };
  app.post('/api/admin/infographics/templates', upsertHandler);
  app.put('/api/admin/infographics/templates/:id', (req, res) => {
    (req.body as Record<string, unknown>).id = req.params.id;
    return upsertHandler(req, res);
  });

  // DELETE (innebygde beskyttet i store).
  app.delete('/api/admin/infographics/templates/:id', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const result = await deleteTemplate(pool, String(req.params.id));
    if ('error' in result) { res.status(400).json(result); return; }
    res.json({ ok: true });
  });

  // ── DESIGN-TOKENS (merkevare som data per workspace) ─────────────────────
  // GET effektive tokens (global + workspace). Offentlig (til preview/render/klient).
  app.get('/api/design/tokens', async (req: Request, res: Response) => {
    // ?raw=1 → KUN eksplisitte workspace-overstyringer (ikke global-basis) for flater
    // som må beholde egne literaler til admin faktisk overstyrer (Role Room Talents).
    const raw = req.query.raw === '1' || req.query.raw === 'true';
    const tokens = raw
      ? await getRawTokens(pool, req.query.ws as string | undefined)
      : await getTokens(pool, req.query.ws as string | undefined);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ workspace: (req.query.ws as string) || 'global', tokens });
  });

  // PUT overstyr tokens for et workspace (admin). Body = patch (kun kjente string-tokens).
  app.put('/api/admin/design/tokens/:ws', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const result = await setTokens(pool, String(req.params.ws), (req.body ?? {}) as Record<string, unknown>);
    if ('error' in result) { res.status(400).json(result); return; }
    res.json({ ok: true });
  });
}
