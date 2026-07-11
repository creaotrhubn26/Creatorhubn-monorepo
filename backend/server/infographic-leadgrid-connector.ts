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
import { resolveOrgIdForUser } from './leadgrid-org-resolver.js';
import { getTeamLeaderboard, getCommissionEarnings } from './leadgrid-sales-data.js';
import { assembleHtml } from './infographic-engine.js';
import { INTER_FONT_CSS } from './infographic-fonts.js';
import { renderHtmlToImage } from './render-engine.js';
import { getTemplateHtml, pickTemplateId } from './infographic-templates-store.js';
import { getTokens } from './design-tokens-store.js';

/** Første navn (leaderboard-etiketter skal være korte). */
function firstName(full: string): string { return (full || '').trim().split(/\s+/)[0] || full; }
/** Kompakt NOK: 45200 → «45,2k», 1200000 → «1,2M». Count-up-vennlig (tall + suffiks). */
function compactNok(n: number): string {
  if (n >= 1_000_000) return String(Math.round(n / 100_000) / 10).replace('.', ',') + 'M';
  if (n >= 1_000) return String(Math.round(n / 100) / 10).replace('.', ',') + 'k';
  return String(Math.round(n));
}

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

// Leadgrid-konnektorene rendrer i 'leadgrid'-workspacet (Leadgrid-maler foretrekkes,
// faller tilbake til globale). Holder Leadgrid-flatene atskilt fra andre produkter.
const LEADGRID_WS = 'leadgrid';

/** Data → auto-valgt mal (leadgrid-workspace) → PNG-buffer. null = mal mangler. */
async function renderToBuffer(pool: Pool, data: Record<string, unknown>, width: number, height: number): Promise<Buffer | null> {
  const id = await pickTemplateId(pool, data, LEADGRID_WS);
  const templateHtml = await getTemplateHtml(pool, id);
  if (!templateHtml) return null;
  const html = assembleHtml(templateHtml, data, { progress: 1, width, height, fontsCss: INTER_FONT_CSS });
  return renderHtmlToImage(html, { width, height, deviceScaleFactor: 2, format: 'png', waitForMs: 400, blockExternalRequests: true });
}

// Kort cache (KPI endres gjennom dagen). Keyet på org+view+dims.
const cache = new Map<string, { buf: Buffer; at: number }>();
const CACHE_TTL_MS = 60_000;

const TREND_LABEL: Record<string, string> = { rising: 'Stigende ▲', stable: 'Stabilt', falling: 'Fallende ▼' };

const VIEWS = new Set(['score', 'activity', 'breakdown', 'goal']);

/** Momentum → infografikk-data, avhengig av `view` (alt fra momentum-objektet, ingen ekstra spørring). */
function shapeMomentum(m: Awaited<ReturnType<typeof computeTodayMomentum>>, view: string, accent: string): Record<string, unknown> {
  const a = m.todayActivity;
  if (view === 'activity') {
    return {
      accent, title: 'Aktivitet i dag',
      cards: [
        { value: String(a.contacts), label: 'Kontakter' },
        { value: String(a.meetings), label: 'Møter' },
        { value: String(a.followups), label: 'Oppfølginger' },
        { value: String(a.pipelineMoves), label: 'Pipeline' },
      ],
    };
  }
  if (view === 'breakdown') {
    // Momentum-analyse: de tre del-scorene (0-100) som KPI-er.
    return {
      accent, title: 'Momentum-analyse',
      cards: [
        { value: String(Math.round(m.breakdown.activityScore)), label: 'Aktivitet' },
        { value: String(Math.round(m.breakdown.velocityScore)), label: 'Tempo' },
        { value: String(Math.round(m.breakdown.decayScore)), label: 'Ferskhet' },
      ],
    };
  }
  if (view === 'goal') {
    // Dagens måloppnåelse: samlet faktisk vs daglig mål på tvers av de 4 metrikkene → prosent.
    const done = a.contacts + a.followups + a.meetings + a.pipelineMoves;
    const target = a.contactsTarget + a.followupsTarget + a.meetingsTarget + a.pipelineMovesTarget;
    const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
    return { accent, value: String(pct) + '%', label: 'Dagens mål' };
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

    const view = typeof req.query.view === 'string' && VIEWS.has(req.query.view) ? req.query.view : 'score';
    const accent = typeof req.query.accent === 'string' ? req.query.accent : (await getTokens(pool, LEADGRID_WS)).accent;
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
      const id = await pickTemplateId(pool, data, LEADGRID_WS); // donut for score, stat-bar for aktivitet
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

  // GET /api/infographics/leadgrid/leaderboard.png — team-podium (samme scope som
  // /sales-leadership/team-members: innlogget org-medlem). metric=leads|prizes|value.
  app.get('/api/infographics/leadgrid/leaderboard.png', async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: 'Innlogging kreves' }); return; }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) { res.status(400).json({ error: 'mangler_organization_id' }); return; }
    const metric = ['leads', 'prizes', 'value'].includes(String(req.query.metric)) ? String(req.query.metric) : 'leads';
    const accent = typeof req.query.accent === 'string' ? req.query.accent : (await getTokens(pool, LEADGRID_WS)).accent;
    const width = clampDim(req.query.w, 1200); const height = clampDim(req.query.h, 630);
    const top = Math.min(6, Math.max(2, parseInt(String(req.query.top ?? '4'), 10) || 4));
    const key = `lb|${orgId}|${metric}|${top}|${accent}|${width}x${height}`;
    const now = Date.now(); const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) { res.type('image/png').setHeader('Cache-Control', 'private, max-age=60').send(hit.buf); return; }
    try {
      const members = await getTeamLeaderboard(pool, orgId, session.userId);
      const valOf = (m: typeof members[number]) => metric === 'prizes' ? m.won : metric === 'value' ? m.totalValueNok : m.leads;
      const title = metric === 'prizes' ? 'Flest premier' : metric === 'value' ? 'Størst premie-verdi' : 'Flest leads';
      const cards = [...members].sort((a, b) => valOf(b) - valOf(a)).slice(0, top)
        .map((m) => ({ value: metric === 'value' ? compactNok(valOf(m)) : String(valOf(m)), label: firstName(m.name) }));
      const data: Record<string, unknown> = cards.length ? { accent, title, cards } : { accent, value: '0', label: 'Ingen data enda' };
      const buf = await renderToBuffer(pool, data, width, height);
      if (!buf) { res.status(404).json({ error: 'Mal utilgjengelig.' }); return; }
      if (cache.size >= 200) cache.delete(cache.keys().next().value as string);
      cache.set(key, { buf, at: now });
      res.type('image/png').setHeader('Cache-Control', 'private, max-age=60').send(buf);
    } catch (e) { res.status(500).json({ error: 'Render feilet: ' + (e as Error).message }); }
  });

  // GET /api/infographics/leadgrid/commission.png — provisjon (samme scope som
  // /sales-leadership/commission-earnings). period=month|quarter|year, view=total|byseller.
  app.get('/api/infographics/leadgrid/commission.png', async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: 'Innlogging kreves' }); return; }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) { res.status(400).json({ error: 'mangler_organization_id' }); return; }
    const period = String(req.query.period ?? 'month');
    const view = req.query.view === 'byseller' ? 'byseller' : 'total';
    const accent = typeof req.query.accent === 'string' ? req.query.accent : '#0a7d38';
    const width = clampDim(req.query.w, 1200); const height = clampDim(req.query.h, 630);
    const top = Math.min(6, Math.max(2, parseInt(String(req.query.top ?? '4'), 10) || 4));
    const key = `com|${orgId}|${period}|${view}|${top}|${accent}|${width}x${height}`;
    const now = Date.now(); const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) { res.type('image/png').setHeader('Cache-Control', 'private, max-age=60').send(hit.buf); return; }
    try {
      const result = await getCommissionEarnings(pool, orgId, session.userId, period);
      const periodLabel = result.period === 'quarter' ? 'dette kvartalet' : result.period === 'year' ? 'i år' : 'denne måneden';
      let data: Record<string, unknown>;
      if (view === 'byseller') {
        const cards = result.members.filter((m) => m.commissionNok > 0).sort((a, b) => b.commissionNok - a.commissionNok).slice(0, top)
          .map((m) => ({ value: compactNok(m.commissionNok), label: firstName(m.name) }));
        data = cards.length ? { accent, title: 'Provisjon · ' + periodLabel, cards } : { accent, value: '0', label: 'Ingen provisjon ' + periodLabel };
      } else {
        data = { accent, value: 'kr ' + compactNok(result.totalCommissionNok), label: 'Provisjon · ' + periodLabel };
      }
      const buf = await renderToBuffer(pool, data, width, height);
      if (!buf) { res.status(404).json({ error: 'Mal utilgjengelig.' }); return; }
      if (cache.size >= 200) cache.delete(cache.keys().next().value as string);
      cache.set(key, { buf, at: now });
      res.type('image/png').setHeader('Cache-Control', 'private, max-age=60').send(buf);
    } catch (e) { res.status(500).json({ error: 'Render feilet: ' + (e as Error).message }); }
  });
}
