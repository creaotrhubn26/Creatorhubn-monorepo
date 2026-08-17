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
import { getTokens, getRawTokens, setTokens, resetTokens, replaceTokens, saveDesignSnapshot, listDesignSnapshots, restoreDesignSnapshot } from './design-tokens-store.js';
import { generateDesignSuggestions, mapSlotsToSources } from './design-suggest.js';
import { resolveConnector, listLiveConnectors } from './design-connectors.js';

type Sessions = Map<string, { userId?: string }>;
type AdminGuard = (req: Request, res: Response) => { userId: string; email: string; name: string; role: string; loginAt: string } | null;
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
      // Dynamisk KILDE (?source=<nøkkel>): slå opp en admin-kuratert marketing-metric fra workspacets
      // design-tokens `metrics`-namespace → verdi/etikett flettes inn i data. «Koblet opp»: endre
      // metricen ett sted, alle infographics som bruker nøkkelen oppdateres (innen cache-TTL).
      const sourceKey = typeof req.query.source === 'string' ? req.query.source : '';
      if (sourceKey && /^[A-Za-z0-9_-]{1,60}$/.test(sourceKey)) {
        try {
          const toks = await getTokens(pool, req.query.ws as string | undefined) as Record<string, unknown>;
          const metrics = toks.metrics as Record<string, { value?: unknown; label?: unknown }> | undefined;
          const m = metrics && typeof metrics === 'object' ? metrics[sourceKey] : undefined;
          if (m && typeof m === 'object') {
            if (m.value != null) data.value = m.value;
            if (m.label != null) data.label = m.label;
          } else {
            // Ingen admin-metric → prøv en LIVE connector (kun publicSafe, resolvert fra DB).
            const live = await resolveConnector(pool, sourceKey, { requirePublicSafe: true });
            if (live != null) data.value = live;
          }
        } catch { /* kilde utilgjengelig → behold data som er */ }
      }
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
      const key = `${id}|${width}x${height}|${accent}|${dRaw}|${sourceKey}:${String(data.value ?? '')}:${String(data.label ?? '')}`;
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
    // `raw: true`-markør slik at klienter (Role Room Talents) trygt kan skille et EKTE
    // raw-svar fra en gammel backend som ignorerer ?raw=1 (deploy-rekkefølge-sikkerhet).
    res.json({ workspace: (req.query.ws as string) || 'global', ...(raw ? { raw: true } : {}), tokens });
  });

  // GET konnektor-register pr. workspace (Fase D) — ÉN kilde til sannhet for hvilke live-data-
  // flater et produkt kan binde. Utvides ved å legge til her (ikke frontend-hardkode). Leadgrid
  // har ekte konnektorer i dag; andre produkter markeres «kommer» (planned).
  const DESIGN_CONNECTORS: Record<string, { id: string; path: string; desc: string; status: 'live' | 'planned' }[]> = {
    leadgrid: [
      { id: 'momentum', path: '/api/infographics/leadgrid/momentum.png?view=score|activity|breakdown|goal', desc: 'Salgs-momentum (donut/stat-bar)', status: 'live' },
      { id: 'leaderboard', path: '/api/infographics/leadgrid/leaderboard.png?metric=leads|prizes|value', desc: 'Team-podium', status: 'live' },
      { id: 'commission', path: '/api/infographics/leadgrid/commission.png?period=month&view=total|byseller', desc: 'Provisjon', status: 'live' },
    ],
    creatorhub: [
      { id: 'project-overview', path: '(planlagt)', desc: 'Prosjekt-oversikt (leveranser/milepæler)', status: 'planned' },
    ],
    theroleroom: [
      { id: 'casting-activity', path: '(planlagt)', desc: 'Casting-aktivitet (roller/auditions)', status: 'planned' },
    ],
  };
  // A/B eksponerings-telling. Persisteres i `design_ab_stats` (overlever restart). In-memory speil
  // beholdes som umiddelbar fallback FØR migrasjonen er kjørt / hvis DB-skriv feiler.
  const abExposures = new Map<string, number>();
  const abConversions = new Map<string, number>();
  const AB_VARIANT_RE = /^[A-Za-z0-9 _-]{1,60}$/;
  const abBump = (kind: 'exposure' | 'conversion', req: Request, res: Response) => {
    const b = (req.body ?? {}) as { ws?: unknown; variant?: unknown };
    const ws = String(b.ws ?? '').slice(0, 40);
    const variant = String(b.variant ?? '').slice(0, 60);
    if (ws && AB_VARIANT_RE.test(variant)) {
      const map = kind === 'exposure' ? abExposures : abConversions;
      if (map.size < 5000) { const k = `${ws}|${variant}`; map.set(k, (map.get(k) ?? 0) + 1); }
      // Persistér (best-effort). `col` er en fast literal (ikke bruker-input) → ingen injection.
      const col = kind === 'exposure' ? 'exposures' : 'conversions';
      pool.query(
        `INSERT INTO design_ab_stats (workspace, variant, ${col}, updated_at) VALUES ($1, $2, 1, now())
         ON CONFLICT (workspace, variant) DO UPDATE SET ${col} = design_ab_stats.${col} + 1, updated_at = now()`,
        [ws, variant],
      ).catch(() => { /* tabell mangler før migrasjon → in-memory dekker */ });
    }
    res.status(204).end();
  };
  app.post('/api/design/ab-exposure', (req: Request, res: Response) => abBump('exposure', req, res));
  app.post('/api/design/ab-conversion', (req: Request, res: Response) => abBump('conversion', req, res));
  app.get('/api/admin/design/ab-stats', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const ws = String(req.query.ws ?? '');
    // Foretrekk persisterte tall; fall tilbake til in-memory hvis tabellen ikke finnes ennå.
    try {
      const r = await pool.query<{ variant: string; exposures: string; conversions: string }>(
        `SELECT variant, exposures, conversions FROM design_ab_stats WHERE workspace = $1`, [ws],
      );
      if (r.rows.length) {
        const exposures: Record<string, number> = {};
        const conversions: Record<string, number> = {};
        for (const row of r.rows) { exposures[row.variant] = Number(row.exposures); conversions[row.variant] = Number(row.conversions); }
        res.json({ exposures, conversions, persistent: true });
        return;
      }
    } catch { /* tabell ikke migrert → in-memory under */ }
    const pick = (map: Map<string, number>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of map) { const idx = k.indexOf('|'); if (k.slice(0, idx) === ws) out[k.slice(idx + 1)] = v; }
      return out;
    };
    res.json({ exposures: pick(abExposures), conversions: pick(abConversions), persistent: false });
  });

  app.get('/api/design/connectors', (req: Request, res: Response) => {
    const ws = String(req.query.ws || '');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ workspace: ws, connectors: DESIGN_CONNECTORS[ws] || [] });
  });

  // OFFENTLIG: gjeldende verdier for publicSafe live-connectors (for tekst-bindinger på landinger).
  // Kun trygge aggregater; cachet så DB ikke treffes ved hver last.
  app.get('/api/design/connector-values', async (req: Request, res: Response) => {
    const ws = String(req.query.ws || '');
    try {
      const live = await listLiveConnectors(pool, ws);
      const values: Record<string, { value: unknown }> = {};
      for (const c of live) values[c.key] = { value: c.value };
      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json({ values });
    } catch { res.json({ values: {} }); }
  });

  // PUT overstyr tokens for et workspace (admin). Body = patch (kun kjente string-tokens).
  app.put('/api/admin/design/tokens/:ws', async (req: Request, res: Response) => {
    const admin = req.adminSession;
    if (!admin) return;
    const ws = String(req.params.ws);
    const patch = (req.body ?? {}) as Record<string, unknown>;
    // Pre-image (Fase D undo): eksakt overstyrings-tilstand FØR endringen, for «Angre».
    const prev = await getRawTokens(pool, ws).catch(() => ({}));
    const result = await setTokens(pool, ws, patch);
    if ('error' in result) { res.status(400).json(result); return; }
    // Fase D governance-audit: append til eksisterende admin_activity_log (mig 138) — hvem
    // endret hvilke token-grupper når (+ pre-image for undo). Defensiv: mangler tabell → hopp over.
    try {
      const keys = Object.keys(patch);
      await pool.query(
        `INSERT INTO admin_activity_log (user_id, entity_type, entity_id, action, summary, details)
         VALUES ($1, 'design_tokens', $2, 'updated', $3, $4::jsonb)`,
        [(admin as any).userId ?? 'unknown', ws, `Endret design-tokens (${keys.join(', ') || '—'}) for «${ws}»`,
          JSON.stringify({ email: (admin as any).email ?? null, keys, patch, prev })],
      );
    } catch { /* audit ikke-kritisk */ }
    res.json({ ok: true });
  });

  // GET design-datakilder: list definerte marketing-metrics for et workspace (for «koble til»-picker
  // i editoren). Verifisering er iboende: hver kilde returneres MED sin gjeldende verdi/etikett, så
  // klienten ser at dataen faktisk kommer gjennom før den binder en infographic til den.
  app.get('/api/admin/design/sources', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const ws = String(req.query.ws ?? '');
    try {
      const toks = await getTokens(pool, ws) as Record<string, unknown>;
      const metrics = (toks.metrics && typeof toks.metrics === 'object') ? toks.metrics as Record<string, { value?: unknown; label?: unknown }> : {};
      const manual = Object.entries(metrics).map(([key, m]) => ({ key, value: m?.value ?? null, label: m?.label ?? null, live: false, ok: m?.value != null }));
      // LIVE connectors: resolvert fra ekte DB → verifisert verdi følger med.
      const live = await listLiveConnectors(pool, ws);
      res.json({ sources: [...manual, ...live] });
    } catch { res.json({ sources: [] }); }
  });

  // GET verifiser ÉN kilde: slår opp metric-en → { ok, value, label } el. { ok:false, reason }.
  app.get('/api/admin/design/verify-source', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const ws = String(req.query.ws ?? ''); const source = String(req.query.source ?? '');
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(source)) { res.json({ ok: false, reason: 'Ugyldig kilde-nøkkel.' }); return; }
    try {
      const toks = await getTokens(pool, ws) as Record<string, unknown>;
      const metrics = toks.metrics as Record<string, { value?: unknown; label?: unknown }> | undefined;
      const m = metrics && metrics[source];
      if (m && (m.value != null || m.label != null)) res.json({ ok: true, value: m.value ?? null, label: m.label ?? null });
      else res.json({ ok: false, reason: `Fant ingen definert kilde «${source}» — legg den til i Design-tokens → metrics.` });
    } catch { res.json({ ok: false, reason: 'Kunne ikke hente kilder.' }); }
  });

  // POST AI-slot-mapping: komponentens data-slots + tilgjengelige kilder → Claude → validert mapping.
  app.post('/api/admin/design/map-slots',
    aiRateLimit({ windowMs: 60_000, max: 20, label: 'design-map-slots' }),
    async (req: Request, res: Response) => {
      if (!requireAdminSession(req, res)) return;
      const b = (req.body ?? {}) as { slots?: unknown; sources?: unknown };
      const slots = Array.isArray(b.slots) ? b.slots.slice(0, 20).map((s: any) => ({ id: String(s?.id ?? '').slice(0, 40), label: String(s?.label ?? '').slice(0, 120) })).filter((s) => s.id) : [];
      const sources = Array.isArray(b.sources) ? b.sources.slice(0, 60).map((s: any) => ({ key: String(s?.key ?? '').slice(0, 60), label: s?.label != null ? String(s.label).slice(0, 120) : undefined, type: s?.type != null ? String(s.type).slice(0, 20) : undefined })).filter((s) => s.key) : [];
      res.json(await mapSlotsToSources(slots, sources));
    });

  // Versjonshistorikk: navngitte gjenopprettingspunkter for hele design-tilstanden (admin).
  app.post('/api/admin/design/history/snapshot', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const b = (req.body ?? {}) as { ws?: unknown; label?: unknown };
    const r = await saveDesignSnapshot(pool, String(b.ws ?? ''), String(b.label ?? ''));
    if ('error' in r) { res.status(400).json(r); return; }
    res.json(r);
  });
  app.get('/api/admin/design/history', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    res.json({ snapshots: await listDesignSnapshots(pool, String(req.query.ws ?? '')) });
  });
  app.post('/api/admin/design/history/restore', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    const b = (req.body ?? {}) as { ws?: unknown; id?: unknown };
    const r = await restoreDesignSnapshot(pool, String(b.ws ?? ''), String(b.id ?? ''));
    if ('error' in r) { res.status(400).json(r); return; }
    res.json(r);
  });

  // POST design-forslag (AI): element-kontekst → Claude → strukturerte, forhåndsvisbare forslag.
  app.post('/api/admin/design/suggest',
    aiRateLimit({ windowMs: 60_000, max: 20, label: 'design-suggest' }),
    async (req: Request, res: Response) => {
      if (!requireAdminSession(req, res)) return;
      const b = (req.body ?? {}) as Record<string, unknown>;
      const el = (b.element ?? {}) as Record<string, unknown>;
      const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);
      const result = await generateDesignSuggestions({
        workspace: str(b.workspace, 40), accent: str(b.accent, 40),
        tag: str(el.tag, 20), role: str(el.role, 30), text: str(el.text, 200),
        color: str(el.color, 40), background: str(el.background, 60),
        fontSize: str(el.fontSize, 20), fontWeight: str(el.fontWeight, 20),
        borderRadius: str(el.borderRadius, 20), padding: str(el.padding, 40),
        width: num(el.width), height: num(el.height),
      });
      res.json(result);
    });

  // POST undo = angre siste token-endring for et workspace (Fase D) — gjenopprett pre-image.
  app.post('/api/admin/design/tokens/:ws/undo', async (req: Request, res: Response) => {
    const admin = req.adminSession;
    if (!admin) return;
    if ((admin as any).role !== 'super_admin') { res.status(403).json({ error: 'Angre krever super_admin.' }); return; }
    const ws = String(req.params.ws);
    try {
      const q = await pool.query(
        `SELECT details FROM admin_activity_log
         WHERE entity_type = 'design_tokens' AND entity_id = $1 AND action = 'updated'
         ORDER BY created_at DESC LIMIT 1`, [ws],
      );
      if (!q.rows[0]) { res.status(404).json({ error: 'Ingen endring å angre.' }); return; }
      const prev = (q.rows[0].details && (q.rows[0].details as any).prev) || {};
      const result = await replaceTokens(pool, ws, prev as Record<string, unknown>);
      if ('error' in result) { res.status(400).json(result); return; }
      try {
        await pool.query(
          `INSERT INTO admin_activity_log (user_id, entity_type, entity_id, action, summary, details)
           VALUES ($1, 'design_tokens', $2, 'undone', $3, $4::jsonb)`,
          [(admin as any).userId ?? 'unknown', ws, `Angret siste design-token-endring for «${ws}»`,
            JSON.stringify({ email: (admin as any).email ?? null, keys: ['(undo)'] })],
        );
      } catch { /* audit ikke-kritisk */ }
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Angre feilet.' }); }
  });

  // GET endringslogg for et workspaces design-tokens (admin) — Fase D governance-innsyn.
  app.get('/api/admin/design/tokens/:ws/audit', async (req: Request, res: Response) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const r = await pool.query(
        `SELECT user_id, action, summary, details, created_at FROM admin_activity_log
         WHERE entity_type = 'design_tokens' AND entity_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [String(req.params.ws)],
      );
      res.json({ entries: r.rows });
    } catch { res.json({ entries: [] }); }
  });

  // DELETE = tilbakestill workspacet til standard (Fase D) — fjern alle overstyringer,
  // re-seed kanonisk merkevare for produkter. Audit-logges.
  app.delete('/api/admin/design/tokens/:ws', async (req: Request, res: Response) => {
    const admin = req.adminSession;
    if (!admin) return;
    // Rolle-tier (Fase D): destruktive ops (reset) er super_admin-only; vanlig admin kan redigere.
    if ((admin as any).role !== 'super_admin') { res.status(403).json({ error: 'Tilbakestilling krever super_admin.' }); return; }
    const ws = String(req.params.ws);
    const result = await resetTokens(pool, ws);
    if ('error' in result) { res.status(400).json(result); return; }
    try {
      await pool.query(
        `INSERT INTO admin_activity_log (user_id, entity_type, entity_id, action, summary, details)
         VALUES ($1, 'design_tokens', $2, 'reset', $3, $4::jsonb)`,
        [(admin as any).userId ?? 'unknown', ws, `Tilbakestilte design-tokens for «${ws}» til standard`,
          JSON.stringify({ email: (admin as any).email ?? null, keys: ['(reset)'] })],
      );
    } catch { /* audit ikke-kritisk */ }
    res.json({ ok: true });
  });
}
