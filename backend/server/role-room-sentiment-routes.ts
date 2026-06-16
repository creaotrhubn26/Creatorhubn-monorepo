/**
 * role-room-sentiment-routes.ts
 *
 * Sentiment-fordeling («stemningen rundt merkevaren») fra social_events
 * (sentiment_label) siste N dager. Samme tall for BÅDE produsenten (agent-
 * session) OG klienten (portal-token → prosjektets eier). Brukes i markedsplan
 * og månedsrapporten.
 *
 *   GET /api/role-room/sentiment?days=30           (produsent)
 *   GET /api/client/portal/sentiment?token=&days=  (klient)
 */

import type express from "express";
import type { Pool } from "pg";
import { resolveClientPortalSession } from "./role-room-client-portal";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomSentimentRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

interface SentimentResult {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  netSentiment: number;
  days: number;
}

// social_events → en brukers tilkoblede kanaler (samme mønster som agent-insights).
const ACCOUNT_SUBQUERY = `account_id IN (
  SELECT ig_business_account_id FROM role_room_instagram_connections WHERE user_id = $1
  UNION SELECT facebook_page_id FROM role_room_instagram_connections WHERE user_id = $1 AND facebook_page_id IS NOT NULL
  UNION SELECT linkedin_member_id FROM role_room_linkedin_connections WHERE user_id = $1 AND linkedin_member_id IS NOT NULL
  UNION SELECT DISTINCT account_id FROM social_metrics WHERE platform = 'youtube'
     AND connection_id IN (SELECT id FROM role_room_google_connections WHERE user_id = $1)
)`;

async function buildSentiment(pool: Pool, ownerUserId: string, days: number): Promise<SentimentResult> {
  let pos = 0, neu = 0, neg = 0;
  try {
    const r = await pool.query(
      `SELECT
         count(*) FILTER (WHERE sentiment_label = 'positive')                         AS pos,
         count(*) FILTER (WHERE sentiment_label IN ('neutral','mixed') OR sentiment_label IS NULL) AS neu,
         count(*) FILTER (WHERE sentiment_label = 'negative')                         AS neg
       FROM social_events
       WHERE ${ACCOUNT_SUBQUERY}
         AND occurred_at > now() - ($2 || ' days')::interval`,
      [ownerUserId, String(days)],
    );
    pos = Number(r.rows[0]?.pos) || 0;
    neu = Number(r.rows[0]?.neu) || 0;
    neg = Number(r.rows[0]?.neg) || 0;
  } catch (err) {
    console.error("[sentiment] query failed", err);
  }
  const total = pos + neu + neg;
  const pct = (n: number): number => (total ? Math.round((n / total) * 100) : 0);
  return {
    positive: pos, neutral: neu, negative: neg, total,
    positivePct: pct(pos), neutralPct: pct(neu), negativePct: pct(neg),
    netSentiment: total ? Math.round(((pos - neg) / total) * 100) : 0,
    days,
  };
}

function parseDays(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 365 ? Math.round(n) : 30;
}

export function setupRoleRoomSentimentRoutes(deps: RoleRoomSentimentRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  app.get("/api/role-room/sentiment", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const sentiment = await buildSentiment(pool, session.userId, parseDays(req.query.days));
      return res.json({ sentiment });
    } catch (err) {
      console.error("[sentiment producer] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente sentiment" });
    }
  });

  app.get("/api/client/portal/sentiment", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const portalSession = await resolveClientPortalSession(pool, token);
    if (!portalSession) return res.status(404).json({ error: "invalid_or_expired_token" });
    try {
      // Finn prosjektets eier og bygg sentiment for eierens kanaler.
      const ownerRow = await pool.query(
        `SELECT owner_user_id FROM role_room_marketing_plans WHERE project_id = $1 AND owner_user_id IS NOT NULL ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
        [portalSession.projectId],
      );
      const ownerUserId = ownerRow.rows[0]?.owner_user_id ? String(ownerRow.rows[0].owner_user_id) : null;
      if (!ownerUserId) return res.json({ sentiment: await buildSentiment(pool, "__none__", parseDays(req.query.days)) });
      const sentiment = await buildSentiment(pool, ownerUserId, parseDays(req.query.days));
      return res.json({ sentiment });
    } catch (err) {
      console.error("[sentiment client] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente sentiment" });
    }
  });
}
