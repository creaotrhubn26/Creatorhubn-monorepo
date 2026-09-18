/**
 * Story Graph Fase 8e — spilltest-telemetri.
 *
 * Spillet (iPad/Swift-runtime, standalone-spiller, JS-pakke) sender hendelser per scene til
 * et alltid-204-inntak (beacon-disiplin fra prototype-testing-routes: en feil her skal aldri
 * stoppe spillet). Autentisering = prosjekt-token i `Authorization: Bearer sgp_…`, lagret som
 * sha256-hash (capture-client-tokens-mønsteret); råtokenet vises én gang i Integrasjoner-fanen.
 *
 *   POST /api/role-room/narrative/playtest/events        { events: [...] } (≤ 500) → 204 alltid
 *                                                          (ukjent/tilbakekalt token → 204 uten lagring,
 *                                                           > 500 → 413, > 600/min per token → 429)
 *
 * Aggregatet (økter, drop-off, median tid, dødsfall, valgfordeling) beregnes i SQL og vises på
 * scenekortets Spilltest-fane og som hjem-KPI. Ingen PII: kun scenekode, hendelse, tid, build,
 * device-klasse og en klientvalgt (tilfeldig) sesjons-id.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import type { Queryable } from './role-room-narrative-service.js';
import { createTokenRateLimiter } from './narrative-rate-limit.js';

type Row = Record<string, unknown>;
const id = (prefix: string) => `${prefix}_${randomUUID()}`;
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export const PLAYTEST_MAX_BATCH = 500;
export const PLAYTEST_RATE_PER_MIN = 600;
export const PLAYTEST_EVENTS = ['enter', 'exit', 'choice', 'checkpoint', 'death', 'complete', 'custom'] as const;
export type PlaytestEventKind = (typeof PLAYTEST_EVENTS)[number];

// ─── Token ───────────────────────────────────────────────────────────

export function hashPlaytestToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface NarrativePlaytestToken {
  id: string; projectId: string; label: string; createdBy: string | null; createdAt: string;
  expiresAt: string | null; revokedAt: string | null; lastUsedAt: string | null; eventCount: number;
}

function mapToken(r: Row): NarrativePlaytestToken {
  return {
    id: String(r.id), projectId: String(r.project_id), label: String(r.label ?? ''), createdBy: r.created_by ? String(r.created_by) : null,
    createdAt: iso(r.created_at) ?? '', expiresAt: iso(r.expires_at), revokedAt: iso(r.revoked_at), lastUsedAt: iso(r.last_used_at), eventCount: num(r.event_count),
  };
}

export async function createPlaytestToken(
  db: Queryable, projectId: string, userId: string, input: { label?: string; ttlDays?: number | null } = {},
): Promise<{ token: NarrativePlaytestToken; rawToken: string }> {
  const rawToken = `sgp_${randomBytes(32).toString('base64url')}`;
  const ttlDays = input.ttlDays == null ? null : Math.min(Math.max(Math.floor(input.ttlDays), 1), 365);
  const expiresAt = ttlDays ? new Date(Date.now() + ttlDays * 86_400_000) : null;
  const { rows } = await db.query(
    `INSERT INTO narrative_playtest_tokens (id, project_id, label, token_hash, created_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id('npk'), projectId, (input.label ?? '').trim().slice(0, 200), hashPlaytestToken(rawToken), userId, expiresAt],
  );
  return { token: mapToken(rows[0] as Row), rawToken };
}

export async function listPlaytestTokens(db: Queryable, projectId: string): Promise<NarrativePlaytestToken[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_playtest_tokens WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]);
  return (rows as Row[]).map(mapToken);
}

export async function revokePlaytestToken(db: Queryable, projectId: string, tokenId: string): Promise<NarrativePlaytestToken | null> {
  const { rows } = await db.query(
    `UPDATE narrative_playtest_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1 AND project_id = $2 RETURNING *`,
    [tokenId, projectId],
  );
  return rows[0] ? mapToken(rows[0] as Row) : null;
}

/** Gyldig (ikke tilbakekalt, ikke utløpt) token for råtokenet, ellers null. */
export async function resolvePlaytestToken(db: Queryable, rawToken: string): Promise<{ id: string; projectId: string } | null> {
  if (!rawToken || rawToken.length > 200) return null;
  const { rows } = await db.query(
    `SELECT id, project_id FROM narrative_playtest_tokens
      WHERE token_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`,
    [hashPlaytestToken(rawToken)],
  );
  const r = rows[0] as Row | undefined;
  return r ? { id: String(r.id), projectId: String(r.project_id) } : null;
}

// ─── Hendelser ───────────────────────────────────────────────────────

export const playtestEventSchema = z.object({
  sessionId: z.string().trim().min(1).max(80),
  sceneCode: z.string().trim().min(1).max(40),
  event: z.enum(PLAYTEST_EVENTS),
  tMs: z.number().int().min(0).max(86_400_000).optional(),
  connectionId: z.string().trim().max(120).optional(),
  build: z.string().trim().max(100).optional(),
  deviceClass: z.string().trim().max(40).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type PlaytestEvent = z.infer<typeof playtestEventSchema>;

export const playtestBatchSchema = z.object({ events: z.array(z.unknown()).min(1).max(PLAYTEST_MAX_BATCH) });

/** Validerer hver hendelse for seg; ugyldige droppes stille (beacon-disiplin). */
export function normalizePlaytestEvents(raw: unknown[]): PlaytestEvent[] {
  const out: PlaytestEvent[] = [];
  for (const item of raw) {
    const parsed = playtestEventSchema.safeParse(item);
    if (!parsed.success) continue;
    const ev = parsed.data;
    if (ev.payload && JSON.stringify(ev.payload).length > 2000) ev.payload = { truncated: true };
    out.push({ ...ev, sceneCode: ev.sceneCode.toUpperCase() });
  }
  return out;
}

export async function insertPlaytestEvents(db: Queryable, token: { id: string; projectId: string }, events: PlaytestEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const cols = 10;
  const values: unknown[] = [];
  const tuples = events.map((e, i) => {
    values.push(token.projectId, token.id, e.sessionId, e.build ?? '', e.deviceClass ?? '', e.sceneCode, e.event, e.tMs ?? null, e.connectionId ?? null, JSON.stringify(e.payload ?? {}));
    const b = i * cols;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}::jsonb)`;
  });
  await db.query(
    `INSERT INTO narrative_playtest_events (project_id, token_id, session_id, build, device_class, scene_code, event, t_ms, connection_id, payload) VALUES ${tuples.join(', ')}`,
    values,
  );
  await db.query(`UPDATE narrative_playtest_tokens SET last_used_at = now(), event_count = event_count + $2 WHERE id = $1`, [token.id, events.length]);
  return events.length;
}

// ─── Inntak (alltid 204) ─────────────────────────────────────────────

export function createPlaytestIngestHandler(pool: Pool, opts: { limiter?: { hit(key: string): boolean } } = {}): RequestHandler {
  const limiter = opts.limiter ?? createTokenRateLimiter({ windowMs: 60_000, max: PLAYTEST_RATE_PER_MIN });
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const raw = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
      if (!raw) { res.status(204).end(); return; }
      if (limiter.hit(hashPlaytestToken(raw))) { res.status(429).set('Retry-After', '60').end(); return; }
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      // Enkelt-hendelse godtas også (uten `events`-innpakning).
      const list = Array.isArray(body.events) ? body.events : [body];
      if (list.length > PLAYTEST_MAX_BATCH) { res.status(413).json({ error: 'batch_too_large', max: PLAYTEST_MAX_BATCH }); return; }
      const token = await resolvePlaytestToken(pool, raw);
      if (!token) { res.status(204).end(); return; }
      const events = normalizePlaytestEvents(list);
      await insertPlaytestEvents(pool, token, events);
      res.status(204).end();
    } catch (err) {
      console.error('[narrative/playtest] ingest error', err);
      if (!res.headersSent) res.status(204).end();
    }
  };
}

// ─── Aggregat ────────────────────────────────────────────────────────

export interface PlaytestSceneStats {
  sceneCode: string; sessions: number; enters: number; exits: number; deaths: number; completes: number;
  medianTimeMs: number | null; dropOff: number; choices: Record<string, number>;
}
export interface PlaytestSummary {
  days: number; build: string | null; builds: string[]; sessions: number; events: number;
  scenes: PlaytestSceneStats[];
  /** Scene med flest økter som slutter der uten `complete` — «verste drop-off». */
  worstDropOff: { sceneCode: string; sessions: number } | null;
}

export async function getPlaytestSummary(db: Queryable, projectId: string, opts: { build?: string | null; days?: number } = {}): Promise<PlaytestSummary> {
  const days = Math.min(Math.max(Math.floor(opts.days ?? 30), 1), 365);
  const build = opts.build?.trim() || null;
  const where = `project_id = $1 AND received_at > now() - ($2::int * interval '1 day')${build ? ' AND build = $3' : ''}`;
  const params: unknown[] = build ? [projectId, days, build] : [projectId, days];
  const [perScene, last, choices, totals] = await Promise.all([
    db.query(
      `SELECT scene_code, COUNT(DISTINCT session_id)::int AS sessions,
              COUNT(*) FILTER (WHERE event = 'enter')::int AS enters,
              COUNT(*) FILTER (WHERE event = 'exit')::int AS exits,
              COUNT(*) FILTER (WHERE event = 'death')::int AS deaths,
              COUNT(*) FILTER (WHERE event = 'complete')::int AS completes,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY t_ms) FILTER (WHERE event = 'exit' AND t_ms IS NOT NULL) AS median_ms
         FROM narrative_playtest_events WHERE ${where} GROUP BY scene_code ORDER BY scene_code`,
      params,
    ),
    db.query(
      `SELECT scene_code, COUNT(*)::int AS n FROM (
         SELECT DISTINCT ON (session_id) session_id, scene_code, event
           FROM narrative_playtest_events WHERE ${where}
          ORDER BY session_id, received_at DESC, id DESC
       ) l WHERE event <> 'complete' GROUP BY scene_code`,
      params,
    ),
    db.query(
      `SELECT scene_code, connection_id, COUNT(*)::int AS n FROM narrative_playtest_events
        WHERE ${where} AND event = 'choice' AND connection_id IS NOT NULL GROUP BY scene_code, connection_id`,
      params,
    ),
    db.query(
      `SELECT COUNT(DISTINCT session_id)::int AS sessions, COUNT(*)::int AS events,
              COALESCE(array_agg(DISTINCT build) FILTER (WHERE build <> ''), '{}') AS builds
         FROM narrative_playtest_events WHERE ${where}`,
      params,
    ),
  ]);
  const dropBy = new Map<string, number>();
  for (const r of last.rows as Row[]) dropBy.set(String(r.scene_code), num(r.n));
  const choicesBy = new Map<string, Record<string, number>>();
  for (const r of choices.rows as Row[]) {
    const code = String(r.scene_code);
    const m = choicesBy.get(code) ?? {};
    m[String(r.connection_id)] = num(r.n);
    choicesBy.set(code, m);
  }
  const scenes: PlaytestSceneStats[] = (perScene.rows as Row[]).map((r) => {
    const code = String(r.scene_code);
    return {
      sceneCode: code, sessions: num(r.sessions), enters: num(r.enters), exits: num(r.exits), deaths: num(r.deaths), completes: num(r.completes),
      medianTimeMs: r.median_ms == null ? null : Math.round(num(r.median_ms)), dropOff: dropBy.get(code) ?? 0, choices: choicesBy.get(code) ?? {},
    };
  });
  let worst: PlaytestSummary['worstDropOff'] = null;
  for (const [code, n] of dropBy) if (n > 0 && (!worst || n > worst.sessions)) worst = { sceneCode: code, sessions: n };
  const t = (totals.rows[0] ?? {}) as Row;
  const builds = Array.isArray(t.builds) ? (t.builds as unknown[]).map(String).sort() : [];
  return { days, build, builds, sessions: num(t.sessions), events: num(t.events), scenes, worstDropOff: worst };
}
