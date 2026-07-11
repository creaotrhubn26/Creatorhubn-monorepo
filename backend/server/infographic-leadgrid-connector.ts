// infographic-leadgrid-connector.ts — DATA-KONNEKTOR: live Leadgrid-KPI → auto-infografikk.
//
// «Kobles til hva som helst» i praksis: henter dagens momentum for KALLERENS egen org,
// former det til infografikk-`data`, lar motoren velge mal (donut for score, stat-bar for
// aktivitet) og rendrer PNG. Gjenbruker EKSAKT samme auth/RBAC som momentum-data
// (requireLeadMapPermission «momentum.view» + resolveOrgIdSmart) → ingen ny data-lekkasje,
// kun egen org (ingen IDOR). Første konnektor; mønsteret gjelder Role Room/CV/… senere.

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { requireLeadMapPermission } from './lead-map-rbac-helper.js';
import { computeTodayMomentum } from './leadgrid-momentum-service.js';
import { assembleHtml } from './infographic-engine.js';
import { INTER_FONT_CSS } from './infographic-fonts.js';
import { renderHtmlToImage } from './render-engine.js';
import { getTemplateHtml, pickTemplateId } from './infographic-templates-store.js';

type SessionData = { userId: string; role?: string; email?: string };
type Sessions = Map<string, SessionData>;

function getSession(req: Request, sessions: Sessions): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) { const s = sessions.get(auth.slice(7)); if (s) return s; }
  return null;
}

async function resolveOrgIdSmart(req: Request, pool: Pool, userId: string): Promise<string | null> {
  const explicit = (req.query?.organization_id as string | undefined);
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

const clampDim = (v: unknown, def: number): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(3000, Math.max(64, n)) : def;
};

// Kort cache (KPI endres gjennom dagen). Keyet på org+view+dims.
const cache = new Map<string, { buf: Buffer; at: number }>();
const CACHE_TTL_MS = 60_000;

const TREND_LABEL: Record<string, string> = { rising: 'Stigende ▲', stable: 'Stabilt', falling: 'Fallende ▼' };

/** Momentum → infografikk-data, avhengig av `view`. */
function shapeMomentum(m: Awaited<ReturnType<typeof computeTodayMomentum>>, view: string, accent: string): Record<string, unknown> {
  if (view === 'activity') {
    const a = m.todayActivity;
    return {
      accent,
      title: 'Aktivitet i dag',
      cards: [
        { value: String(a.contacts), label: 'Kontakter' },
        { value: String(a.meetings), label: 'Møter' },
        { value: String(a.followups), label: 'Oppfølginger' },
        { value: String(a.pipelineMoves), label: 'Pipeline' },
      ],
    };
  }
  // default: score som donut/prosent (0-100), trend i label.
  return { accent, value: String(Math.round(m.score)) + '%', label: 'Momentum · ' + (TREND_LABEL[m.trend] || m.trend) };
}

export function registerInfographicLeadgridRoutes(deps: { app: Express; pool: Pool; activeSessions: Sessions }): void {
  const { app, pool, activeSessions } = deps;
  const permView = requireLeadMapPermission('momentum.view', { pool, activeSessions, resolveOrgId: resolveOrgIdSmart });

  // GET /api/infographics/leadgrid/momentum.png — kallerens egen org (RBAC-gated).
  app.get('/api/infographics/leadgrid/momentum.png', permView, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: 'Innlogging kreves' }); return; }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) { res.status(400).json({ error: 'mangler_organization_id' }); return; }

    const view = req.query.view === 'activity' ? 'activity' : 'score';
    const accent = typeof req.query.accent === 'string' ? req.query.accent : '#2f6df0';
    const width = clampDim(req.query.w, 1200);
    const height = clampDim(req.query.h, 630);
    const key = `${orgId}|${view}|${accent}|${width}x${height}`;
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) {
      res.type('image/png').setHeader('Cache-Control', 'private, max-age=60').send(hit.buf);
      return;
    }
    try {
      const momentum = await computeTodayMomentum(pool, orgId);
      const data = shapeMomentum(momentum, view, accent);
      const id = await pickTemplateId(pool, data);            // donut for score, stat-bar for aktivitet
      const templateHtml = await getTemplateHtml(pool, id);
      if (!templateHtml) { res.status(404).json({ error: 'Mal utilgjengelig.' }); return; }
      const html = assembleHtml(templateHtml, data, { progress: 1, width, height, fontsCss: INTER_FONT_CSS });
      const buf = await renderHtmlToImage(html, { width, height, deviceScaleFactor: 2, format: 'png', waitForMs: 400, blockExternalRequests: true });
      if (cache.size >= 200) cache.delete(cache.keys().next().value as string);
      cache.set(key, { buf, at: now });
      res.type('image/png').setHeader('Cache-Control', 'private, max-age=60').send(buf);
    } catch (e) {
      res.status(500).json({ error: 'Render feilet: ' + (e as Error).message });
    }
  });
}
