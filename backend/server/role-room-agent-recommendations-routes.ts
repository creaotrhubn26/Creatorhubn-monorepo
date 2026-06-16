/**
 * role-room-agent-recommendations-routes.ts
 *
 * Agent-anbefalinger: AI-innsikt-kort fra The Role Room Agent. Eier
 * role_room_agent_recommendation (mig 284). Talenten/produsenten ser åpne
 * anbefalinger, kan «Utfør» (done) eller avvise (dismissed).
 *
 *   GET    /api/role-room/agent/recommendations?projectId=&status=
 *   PATCH  /api/role-room/agent/recommendations/:id   body: { status }
 *   POST   /api/role-room/agent/recommendations/generate  body: { projectId? }
 *     → seeder et kuratert sett anbefalinger (v1; ekte Claude-generering senere)
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

interface SessionLike {
  userId: string;
  email?: string;
  name?: string;
}

export interface RoleRoomAgentRecommendationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

type RecStatus = "new" | "done" | "dismissed";

interface RecommendationRow {
  id: string;
  owner_user_id: string;
  project_id: string | null;
  type: string;
  title: string;
  insight: string | null;
  stat_value: string | null;
  stat_label: string | null;
  cta_label: string | null;
  icon: string | null;
  status: RecStatus;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Record<string, unknown>): RecommendationRow {
  return {
    id: String(r.id),
    owner_user_id: String(r.owner_user_id),
    project_id: r.project_id == null ? null : String(r.project_id),
    type: String(r.type),
    title: String(r.title),
    insight: r.insight == null ? null : String(r.insight),
    stat_value: r.stat_value == null ? null : String(r.stat_value),
    stat_label: r.stat_label == null ? null : String(r.stat_label),
    cta_label: r.cta_label == null ? null : String(r.cta_label),
    icon: r.icon == null ? null : String(r.icon),
    status: (["new", "done", "dismissed"].includes(String(r.status)) ? r.status : "new") as RecStatus,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

// Kuratert v1-katalog (rr-agent-in-*). Ekte Claude-generering kommer senere.
const SEED_CATALOG: Array<Omit<RecommendationRow, "id" | "owner_user_id" | "project_id" | "status" | "created_at" | "updated_at">> = [
  { type: "publiser_naa", title: "Publiser nå", insight: "Beste publiseringstidspunkt er akkurat nå — rekkevidden topper seg.", stat_value: "19:30", stat_label: "optimal tid", cta_label: "Utfør", icon: "schedule" },
  { type: "quiz", title: "Quiz-idé", insight: "Kjør en quiz i Story for å løfte engasjementet blant følgerne dine.", stat_value: "+38%", stat_label: "snitt engasjement", cta_label: "Utfør · Lag quiz", icon: "quiz" },
  { type: "boost", title: "Boost innlegg", insight: "Ett innlegg presterer langt over snittet — boost det mens det er varmt.", stat_value: "3,2×", stat_label: "over snittet", cta_label: "Utfør · Boost", icon: "trending_up" },
  { type: "svar_lead", title: "Svar på lead", insight: "En varm lead venter på svar — følg opp innen en time for best konvertering.", stat_value: "1t", stat_label: "ideell responstid", cta_label: "Utfør · Svar", icon: "contact_page" },
  { type: "budsjett", title: "Juster budsjett", insight: "Flytt annonsebudsjett til kanalen som gir lavest kost per lead.", stat_value: "−24%", stat_label: "kost per lead", cta_label: "Utfør", icon: "payments" },
  { type: "viral", title: "Viral-mulighet", insight: "Et innlegg har uvanlig høy delingsrate — lag oppfølging mens momentet varer.", stat_value: "+212%", stat_label: "deling siste 7d", cta_label: "Utfør · Følg opp", icon: "bolt" },
  { type: "reels", title: "Reels-anbefaling", insight: "Reels gir mest rekkevidde for kontoen din nå — lag en kort om dette temaet.", stat_value: "4,1×", stat_label: "rekkevidde vs foto", cta_label: "Utfør · Lag Reel", icon: "movie" },
  { type: "merch", title: "Merch-idé", insight: "Produksjonen har et engasjert publikum — vurder branded merch som inntektskanal.", stat_value: "3", stat_label: "leverandører klare", cta_label: "Utfør · Se merch", icon: "storefront" },
  { type: "poll", title: "Poll-idé", insight: "Kjør en avstemning i Story — polls gir høy interaksjon og verdifull innsikt.", stat_value: "+46%", stat_label: "interaksjon i Story", cta_label: "Utfør · Lag poll", icon: "poll" },
  { type: "livestream", title: "Livestream-idé", insight: "Gå live om dette temaet — direktesendinger bygger nærhet og prioriteres i feeden.", stat_value: "2,7×", stat_label: "visningstid live", cta_label: "Utfør · Planlegg live", icon: "sensors" },
  { type: "giveaway", title: "Giveaway", insight: "En konkurranse kan gi et hopp i følgere og rekkevidde foran lanseringen.", stat_value: "+1 200", stat_label: "snitt nye følgere", cta_label: "Utfør · Sett opp", icon: "card_giftcard" },
  { type: "testimonial", title: "Kunde-testimonial", insight: "Del en kundeomtale — sosialt bevis konverterer bedre enn egen markedsføring.", stat_value: "+31%", stat_label: "konvertering", cta_label: "Utfør · Del", icon: "format_quote" },
  { type: "story_serie", title: "Story-serie", insight: "Lag en flerdelt Story-serie — sekvenser holder følgerne lenger i Story-ringen.", stat_value: "5 deler", stat_label: "anbefalt lengde", cta_label: "Utfør · Bygg serie", icon: "auto_stories" },
  { type: "beste_tid", title: "Beste-tid-skift", insight: "Publikum er mest aktivt på et nytt tidspunkt — flytt fast publisering dit.", stat_value: "07:30", stat_label: "ny topp-tid", cta_label: "Utfør", icon: "schedule" },
];

export function setupRoleRoomAgentRecommendationsRoutes(
  deps: RoleRoomAgentRecommendationsRoutesDeps,
): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET — list anbefalinger ──────────────────────────────────────────
  app.get("/api/role-room/agent/recommendations", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const projectId = typeof req.query.projectId === "string" && req.query.projectId.trim() ? req.query.projectId.trim() : null;
      const status = typeof req.query.status === "string" && ["new", "done", "dismissed"].includes(req.query.status) ? req.query.status : "new";
      const params: unknown[] = [session.userId, status];
      let where = "owner_user_id = $1 AND status = $2";
      if (projectId) { params.push(projectId); where += ` AND (project_id = $${params.length} OR project_id IS NULL)`; }
      const r = await pool.query(
        `SELECT * FROM role_room_agent_recommendation WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
        params,
      );
      return res.json({ recommendations: r.rows.map(mapRow) });
    } catch (err) {
      console.error("[agent/recommendations GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente anbefalinger" });
    }
  });

  // ── PATCH — marker som utført / avvist ───────────────────────────────
  app.patch("/api/role-room/agent/recommendations/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const status = (req.body || {}).status;
    if (status !== "done" && status !== "dismissed" && status !== "new") {
      return res.status(400).json({ error: "Ugyldig status" });
    }
    try {
      const r = await pool.query(
        `UPDATE role_room_agent_recommendation
            SET status = $3, updated_at = now()
          WHERE id = $1 AND owner_user_id = $2 RETURNING *`,
        [req.params.id, session.userId, status],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ recommendation: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[agent/recommendations PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere" });
    }
  });

  // ── POST /generate — seed et kuratert sett (v1) ──────────────────────
  app.post("/api/role-room/agent/recommendations/generate", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const projectId = typeof (req.body || {}).projectId === "string" && req.body.projectId.trim() ? req.body.projectId.trim() : null;
    try {
      const values: string[] = [];
      const params: unknown[] = [session.userId, projectId];
      SEED_CATALOG.forEach((c, i) => {
        const base = params.length;
        params.push(crypto.randomUUID(), c.type, c.title, c.insight, c.stat_value, c.stat_label, c.cta_label, c.icon);
        values.push(`($${base + 1}, $1, $2, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, 'new')`);
        void i;
      });
      const r = await pool.query(
        `INSERT INTO role_room_agent_recommendation
           (id, owner_user_id, project_id, type, title, insight, stat_value, stat_label, cta_label, icon, status)
         VALUES ${values.join(", ")}
         RETURNING *`,
        params,
      );
      return res.json({ recommendations: r.rows.map(mapRow), created: r.rowCount });
    } catch (err) {
      console.error("[agent/recommendations generate] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere anbefalinger" });
    }
  });
}
