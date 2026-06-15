/**
 * lead-map-competitor-routes.ts
 *
 * Konkurrent-management for Lead Map.
 *
 * Endepunkter:
 *   GET  /api/admin-room/lead-map/competitors
 *        → liste alle konkurrenter for workspace (auto + manual)
 *   POST /api/admin-room/lead-map/competitors
 *        → legg til manuelt (uten Market Scan-kobling)
 *   PATCH /api/admin-room/lead-map/competitors/:id
 *        → oppdater threat_level / priority_rank / notes
 *   POST /api/admin-room/lead-map/competitors/:id/assess
 *        → Claude vurderer threat-level + "hva bekymre seg for" + "hva ignorere"
 *   POST /api/admin-room/lead-map/leads/rank-all
 *        → Claude ranker alle leads etter "mest anbefalt å nå ut til"
 *   GET  /api/admin-room/lead-map/market-points
 *        → kombinert leads + competitors for kartvisning (bbox-filter)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { searchPlaces } from "./lead-map-service.js";
import { assessCompetitorThreat } from "./competitor-threat-assessment.js";
import {
  generateCounterCampaign,
  saveCounterCampaignToWorkflow,
  type CounterCampaign,
} from "./competitor-counter-campaign.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

interface CompetitorRow {
  id: string;
  name: string;
  domain: string;
  category: string | null;
  positioning: string | null;
  primary_offer: string | null;
  latitude: number | null;
  longitude: number | null;
  google_address: string | null;
  google_phone: string | null;
  google_rating: number | null;
  is_manual_addition: boolean;
  threat_level: "near" | "medium" | "far" | null;
  threat_score: number | null;
  claude_threat_summary: string | null;
  claude_what_to_worry_about: string | null;
  claude_what_to_ignore: string | null;
  claude_assessed_at: string | null;
  priority_rank: number | null;
  created_at: string;
}

function rowToCompetitor(r: CompetitorRow) {
  return {
    id: r.id,
    name: r.name,
    domain: r.domain,
    category: r.category,
    positioning: r.positioning,
    primaryOffer: r.primary_offer,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    address: r.google_address,
    phone: r.google_phone,
    rating: r.google_rating != null ? Number(r.google_rating) : null,
    isManualAddition: r.is_manual_addition,
    threatLevel: r.threat_level,
    threatScore: r.threat_score,
    claudeThreatSummary: r.claude_threat_summary,
    claudeWhatToWorryAbout: r.claude_what_to_worry_about,
    claudeWhatToIgnore: r.claude_what_to_ignore,
    claudeAssessedAt: r.claude_assessed_at,
    priorityRank: r.priority_rank,
    createdAt: r.created_at,
  };
}

export function registerLeadMapCompetitorRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  // ─── GET /competitors ─────────────────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/competitors",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<CompetitorRow>(
          `SELECT id::text, name, domain, category, positioning, primary_offer,
                  latitude, longitude, google_address, google_phone, google_rating,
                  is_manual_addition, threat_level, threat_score,
                  claude_threat_summary, claude_what_to_worry_about, claude_what_to_ignore,
                  claude_assessed_at::text, priority_rank, created_at::text
             FROM market_scan_competitors
            WHERE workspace_owner_user_id = $1
            ORDER BY
              priority_rank DESC NULLS LAST,
              CASE threat_level
                WHEN 'near' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'far' THEN 3
                ELSE 4
              END,
              threat_score DESC NULLS LAST,
              created_at DESC
            LIMIT 200`,
          [session.userId],
        );
        return res.json({ competitors: r.rows.map(rowToCompetitor) });
      } catch (err) {
        return res.status(500).json({ error: "list_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /competitors (manuell add) ──────────────────────────────
  app.post(
    "/api/admin-room/lead-map/competitors",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as {
        name?: string;
        domain?: string;
        category?: string;
        positioning?: string;
        primaryOffer?: string;
        region?: string;
        threatLevel?: "near" | "medium" | "far";
      };
      if (!body.name || !body.domain) {
        return res.status(400).json({ error: "name_og_domain_kreves" });
      }
      try {
        // Best-effort Google Places-oppslag
        let geo = { lat: null as number | null, lng: null as number | null, placeId: null as string | null, address: null as string | null, phone: null as string | null, rating: null as number | null };
        try {
          const query = body.region ? `${body.name} ${body.region}` : body.name;
          const places = await searchPlaces(pool, {
            query,
            ownerUserId: session.userId,
          } as Parameters<typeof searchPlaces>[1]);
          if (places.ok && places.results[0]) {
            const top = places.results[0];
            geo = {
              lat: top.latitude,
              lng: top.longitude,
              placeId: top.placeId,
              address: top.address,
              phone: top.phone,
              rating: top.rating,
            };
          }
        } catch { /* noop */ }

        const ins = await pool.query<CompetitorRow>(
          `INSERT INTO market_scan_competitors (
             market_scan_id, workspace_owner_user_id,
             name, domain, category, positioning, primary_offer,
             confidence, evidence_urls,
             latitude, longitude, google_place_id, google_address,
             google_phone, google_rating, google_lookup_at,
             is_manual_addition, added_by_user_id, threat_level
           )
           VALUES (
             NULL, $1, $2, $3, $4, $5, $6,
             'high', '{}'::text[],
             $7, $8, $9, $10, $11, $12,
             CASE WHEN $9 IS NOT NULL THEN NOW() ELSE NULL END,
             TRUE, $1, $13
           )
           RETURNING id::text, name, domain, category, positioning, primary_offer,
                     latitude, longitude, google_address, google_phone, google_rating,
                     is_manual_addition, threat_level, threat_score,
                     claude_threat_summary, claude_what_to_worry_about,
                     claude_what_to_ignore, claude_assessed_at::text,
                     priority_rank, created_at::text`,
          [
            session.userId,
            body.name,
            body.domain,
            body.category ?? null,
            body.positioning ?? null,
            body.primaryOffer ?? null,
            geo.lat,
            geo.lng,
            geo.placeId,
            geo.address,
            geo.phone,
            geo.rating,
            body.threatLevel ?? null,
          ],
        );
        const competitor = rowToCompetitor(ins.rows[0]);

        // Auto-fyr Claude threat-vurdering i bakgrunnen — bruker venter ikke.
        // Hopper over hvis brukeren har eksplisitt satt threat_level i form-en
        // (de har allerede tatt et standpunkt).
        if (!body.threatLevel && process.env.ANTHROPIC_API_KEY) {
          void (async () => {
            try {
              await assessCompetitorThreat(pool, {
                competitorId: competitor.id,
                workspaceOwnerUserId: session.userId,
              });
              console.log(`[competitor-add] Auto-assessed threat for ${competitor.name}`);
            } catch (err) {
              console.warn(
                `[competitor-add] Auto-assess feilet for ${competitor.name}:`,
                (err as Error).message,
              );
            }
          })();
        }

        return res.json({ competitor });
      } catch (err) {
        return res.status(500).json({ error: "add_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /competitors/:id ───────────────────────────────────────
  app.patch(
    "/api/admin-room/lead-map/competitors/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as {
        threatLevel?: "near" | "medium" | "far";
        priorityRank?: number;
        positioning?: string;
      };
      try {
        const r = await pool.query<CompetitorRow>(
          `UPDATE market_scan_competitors
              SET threat_level = COALESCE($3, threat_level),
                  priority_rank = COALESCE($4, priority_rank),
                  positioning = COALESCE($5, positioning)
            WHERE id = $1 AND workspace_owner_user_id = $2
          RETURNING id::text, name, domain, category, positioning, primary_offer,
                    latitude, longitude, google_address, google_phone, google_rating,
                    is_manual_addition, threat_level, threat_score,
                    claude_threat_summary, claude_what_to_worry_about,
                    claude_what_to_ignore, claude_assessed_at::text,
                    priority_rank, created_at::text`,
          [
            req.params.id,
            session.userId,
            body.threatLevel ?? null,
            body.priorityRank ?? null,
            body.positioning ?? null,
          ],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ competitor: rowToCompetitor(r.rows[0]) });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /competitors/:id ──────────────────────────────────────
  app.delete(
    "/api/admin-room/lead-map/competitors/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query(
          `DELETE FROM market_scan_competitors
            WHERE id = $1 AND workspace_owner_user_id = $2
          RETURNING id::text`,
          [req.params.id, session.userId],
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ ok: true, deleted: r.rows[0].id });
      } catch (err) {
        return res.status(500).json({ error: "delete_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /calendar (kommende møter + follow-ups) ─────────────────
  // Returner alle leads med:
  //   1. lead_status = 'meeting_booked' (booket møte — bruk next_follow_up_at som dato)
  //   2. next_follow_up_at innen 30 dager (planlagt follow-up)
  // Sortert etter dato. UI viser som liste eller mini-kalender.
  app.get(
    "/api/admin-room/lead-map/calendar",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{
          id: string;
          name: string;
          lead_status: string;
          next_follow_up_at: string | null;
          next_action: string | null;
          city: string | null;
          phone: string | null;
          email: string | null;
          owner_user_id: string | null;
          assigned_user_name: string | null;
          assigned_user_email: string | null;
        }>(
          `SELECT c.id::text, c.name, c.lead_status,
                  c.next_follow_up_at::text,
                  c.next_action, c.city, c.phone, c.email,
                  c.owner_user_id,
                  u.name AS assigned_user_name,
                  u.email AS assigned_user_email
             FROM crm_customers c
             LEFT JOIN users u ON u.id = c.owner_user_id
            WHERE c.owner_user_id = $1
              AND c.next_follow_up_at IS NOT NULL
              AND c.next_follow_up_at >= NOW() - INTERVAL '1 day'
              AND c.next_follow_up_at <= NOW() + INTERVAL '60 days'
              AND c.lead_status NOT IN ('won', 'lost', 'do_not_contact')
            ORDER BY c.next_follow_up_at ASC
            LIMIT 100`,
          [session.userId],
        );
        const events = r.rows.map((row) => ({
          id: row.id,
          leadName: row.name,
          status: row.lead_status,
          datetime: row.next_follow_up_at,
          nextAction: row.next_action,
          city: row.city,
          phone: row.phone,
          email: row.email,
          assignedUserId: row.owner_user_id,
          assignedUserName: row.assigned_user_name,
          assignedUserEmail: row.assigned_user_email,
          eventType: row.lead_status === "meeting_booked" ? "meeting" : "follow_up",
        }));
        return res.json({ events });
      } catch (err) {
        return res.status(500).json({ error: "calendar_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /reminders (stille leads + dagens follow-ups) ──────────
  app.get(
    "/api/admin-room/lead-map/reminders",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const stale = await pool.query<{
          id: string; name: string; lead_status: string; city: string | null;
          days_silent: number; updated_at: string;
        }>(
          `SELECT id::text, name, lead_status, city,
                  (EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400)::int AS days_silent,
                  updated_at::text
             FROM crm_customers
            WHERE owner_user_id = $1
              AND lead_status NOT IN ('won', 'lost', 'do_not_contact')
              AND updated_at < NOW() - INTERVAL '7 days'
            ORDER BY updated_at ASC
            LIMIT 50`,
          [session.userId],
        );

        const buckets = {
          over30days: stale.rows.filter((r) => r.days_silent >= 30).length,
          over14days: stale.rows.filter((r) => r.days_silent >= 14 && r.days_silent < 30).length,
          over7days: stale.rows.filter((r) => r.days_silent >= 7 && r.days_silent < 14).length,
        };

        const dueToday = await pool.query<{
          id: string; name: string; next_follow_up_at: string; next_action: string | null;
        }>(
          `SELECT id::text, name, next_follow_up_at::text, next_action
             FROM crm_customers
            WHERE owner_user_id = $1
              AND next_follow_up_at IS NOT NULL
              AND next_follow_up_at <= NOW() + INTERVAL '24 hours'
              AND next_follow_up_at >= NOW() - INTERVAL '24 hours'
              AND lead_status NOT IN ('won', 'lost', 'do_not_contact')
            ORDER BY next_follow_up_at ASC
            LIMIT 20`,
          [session.userId],
        );

        return res.json({
          staleLeads: stale.rows.map((r) => ({
            id: r.id,
            name: r.name,
            status: r.lead_status,
            city: r.city,
            daysSilent: r.days_silent,
            updatedAt: r.updated_at,
          })),
          buckets,
          dueToday: dueToday.rows.map((r) => ({
            id: r.id,
            name: r.name,
            datetime: r.next_follow_up_at,
            nextAction: r.next_action,
          })),
          totalStale: stale.rows.length,
        });
      } catch (err) {
        return res.status(500).json({ error: "reminders_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /status-report (ukens status-rapport) ──────────────────
  app.get(
    "/api/admin-room/lead-map/status-report",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{
          new_leads_7d: number;
          won_7d: number;
          meetings_7d: number;
          longest_silent_days: number;
          longest_silent_name: string | null;
          active_pipeline: number;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_leads_7d,
             COUNT(*) FILTER (
               WHERE lead_status = 'won'
                 AND updated_at >= NOW() - INTERVAL '7 days'
             )::int AS won_7d,
             COUNT(*) FILTER (
               WHERE lead_status = 'meeting_booked'
                 AND updated_at >= NOW() - INTERVAL '7 days'
             )::int AS meetings_7d,
             COALESCE(MAX(
               (EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400)::int
             ) FILTER (
               WHERE lead_status NOT IN ('won', 'lost', 'do_not_contact')
             ), 0)::int AS longest_silent_days,
             (SELECT name FROM crm_customers
               WHERE owner_user_id = $1
                 AND lead_status NOT IN ('won', 'lost', 'do_not_contact')
               ORDER BY updated_at ASC LIMIT 1
             ) AS longest_silent_name,
             COUNT(*) FILTER (
               WHERE lead_status NOT IN ('won', 'lost', 'do_not_contact')
             )::int AS active_pipeline
           FROM crm_customers
          WHERE owner_user_id = $1`,
          [session.userId],
        );
        const row = r.rows[0];

        const recommendations: string[] = [];
        if (row.longest_silent_days >= 14 && row.longest_silent_name) {
          recommendations.push(
            `${row.longest_silent_name} har ikke fått oppmerksomhet på ${row.longest_silent_days} dager — følg opp eller marker som tapt`,
          );
        }
        if (row.new_leads_7d === 0) {
          recommendations.push(
            "Ingen nye leads siste uken — kjør 'Discover leads' eller importer fra Google Places",
          );
        } else if (row.new_leads_7d >= 5 && row.meetings_7d === 0) {
          recommendations.push(
            `${row.new_leads_7d} nye leads, men 0 bookede møter — øk follow-up-takt`,
          );
        }
        if (row.active_pipeline >= 20 && row.won_7d === 0) {
          recommendations.push(
            `${row.active_pipeline} aktive leads, men ingen vunnet siste uken — review pitch-strategi`,
          );
        }

        return res.json({
          newLeads7d: row.new_leads_7d,
          won7d: row.won_7d,
          meetings7d: row.meetings_7d,
          longestSilentDays: row.longest_silent_days,
          longestSilentName: row.longest_silent_name,
          activePipeline: row.active_pipeline,
          recommendations,
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        return res.status(500).json({ error: "status_report_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /leaderboard (konkurranse blant lead-skaffere) ──────────
  // Per-bruker aggregat: hvem har skaffet flest leads, mest converted,
  // beste conversion-rate. Workspace-isolert til admin-room-tenant.
  app.get(
    "/api/admin-room/lead-map/leaderboard",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{
          owner_user_id: string | null;
          user_name: string | null;
          user_email: string | null;
          total_leads: number;
          won: number;
          lost: number;
          meeting_booked: number;
          interested: number;
          declined: number;
          last_activity_at: string | null;
        }>(
          `SELECT c.owner_user_id,
                  u.name AS user_name,
                  u.email AS user_email,
                  COUNT(*)::int AS total_leads,
                  COUNT(*) FILTER (WHERE c.lead_status = 'won')::int AS won,
                  COUNT(*) FILTER (WHERE c.lead_status = 'lost')::int AS lost,
                  COUNT(*) FILTER (WHERE c.lead_status = 'meeting_booked')::int AS meeting_booked,
                  COUNT(*) FILTER (WHERE c.lead_status = 'interested')::int AS interested,
                  COUNT(*) FILTER (WHERE c.lead_status = 'declined')::int AS declined,
                  MAX(c.updated_at)::text AS last_activity_at
             FROM crm_customers c
             LEFT JOIN users u ON u.id = c.owner_user_id
            WHERE c.owner_user_id = $1
               OR EXISTS (
                 SELECT 1 FROM users me
                  WHERE me.id = $1
                    AND LOWER(COALESCE(me.role, '')) IN ('admin','super_admin','owner')
               )
            GROUP BY c.owner_user_id, u.name, u.email
            ORDER BY total_leads DESC, won DESC
            LIMIT 50`,
          [session.userId],
        );
        const leaders = r.rows.map((row, idx) => {
          const closeable = row.won + row.lost;
          const conversionRate = closeable > 0 ? Math.round((row.won / closeable) * 100) : null;
          return {
            rank: idx + 1,
            userId: row.owner_user_id,
            userName: row.user_name,
            userEmail: row.user_email,
            totalLeads: row.total_leads,
            won: row.won,
            lost: row.lost,
            meetingBooked: row.meeting_booked,
            interested: row.interested,
            declined: row.declined,
            conversionRate,
            lastActivityAt: row.last_activity_at,
          };
        });
        return res.json({ leaders });
      } catch (err) {
        return res.status(500).json({ error: "leaderboard_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /competitors/:id/counter-campaign (Claude → Marketing Cockpit-bro) ──
  // Genererer en mot-kampanje. Returnerer JSON-struktur (target-segment,
  // key-messages, content-drafts, channel-mix) UTEN å persistere. Bruker
  // kaller separat /save for å lagre som marketing_workflow.
  app.post(
    "/api/admin-room/lead-map/competitors/:id/counter-campaign",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const campaign = await generateCounterCampaign(pool, {
          competitorId: req.params.id,
          workspaceOwnerUserId: session.userId,
        });
        return res.json({ campaign });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "competitor_not_found") return res.status(404).json({ error: msg });
        if (msg.includes("ANTHROPIC_API_KEY mangler")) {
          return res.status(500).json({ error: "anthropic_key_missing" });
        }
        return res.status(500).json({ error: "counter_campaign_failed", detail: msg });
      }
    },
  );

  // ─── POST /competitors/:id/counter-campaign/save (persistere som workflow) ──
  // Lagrer en allerede generert counter-campaign som marketing_workflow
  // slik at den havner i Marketing Cockpit. Cockpit-UI parser
  // workflow.notes (JSON) for å vise innholdet.
  app.post(
    "/api/admin-room/lead-map/competitors/:id/counter-campaign/save",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as { campaign?: CounterCampaign };
      if (!body.campaign) return res.status(400).json({ error: "campaign_kreves_i_body" });
      try {
        const result = await saveCounterCampaignToWorkflow(pool, {
          workspaceOwnerUserId: session.userId,
          competitorId: req.params.id,
          campaign: body.campaign,
        });
        return res.json(result);
      } catch (err) {
        return res.status(500).json({ error: "save_failed", detail: String((err as Error).message) });
      }
    },
  );

  // ─── POST /competitors/:id/assess (Claude threat-vurdering) ───────
  app.post(
    "/api/admin-room/lead-map/competitors/:id/assess",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        await assessCompetitorThreat(pool, {
          competitorId: req.params.id,
          workspaceOwnerUserId: session.userId,
        });
        // Hent oppdatert rad så frontend ikke trenger ny round-trip
        const r = await pool.query<CompetitorRow>(
          `SELECT id::text, name, domain, category, positioning, primary_offer,
                  latitude, longitude, google_address, google_phone, google_rating,
                  is_manual_addition, threat_level, threat_score,
                  claude_threat_summary, claude_what_to_worry_about,
                  claude_what_to_ignore, claude_assessed_at::text,
                  priority_rank, created_at::text
             FROM market_scan_competitors
            WHERE id = $1 AND workspace_owner_user_id = $2`,
          [req.params.id, session.userId],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ competitor: rowToCompetitor(r.rows[0]) });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "competitor_not_found") return res.status(404).json({ error: msg });
        if (msg.includes("ANTHROPIC_API_KEY mangler")) {
          return res.status(500).json({ error: "anthropic_key_missing" });
        }
        return res.status(500).json({ error: "assess_failed", detail: msg });
      }
    },
  );

  // ─── POST /leads/rank-all (Claude rangering av leads) ─────────────
  app.post(
    "/api/admin-room/lead-map/leads/rank-all",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "anthropic_key_missing" });

      try {
        const leads = await pool.query<{
          id: string; name: string; category: string | null;
          positioning: string | null;
          city: string | null; website_url: string | null;
          google_rating: number | null;
        }>(
          `SELECT id::text, name, category,
                  notes AS positioning,
                  city, website_url, google_rating
             FROM crm_customers
            WHERE owner_user_id = $1
              AND lead_status NOT IN ('won', 'lost', 'do_not_contact')
            ORDER BY created_at DESC
            LIMIT 50`,
          [session.userId],
        );
        if (leads.rows.length === 0) {
          return res.json({ ranked: 0 });
        }

        // Min Brand Kit-baseline
        const bk = await pool.query<{ profile: string | null }>(
          `SELECT (brand_profile->>'positioning_summary')::text AS profile
             FROM brand_kits
            WHERE workspace_owner_user_id = $1
            ORDER BY updated_at DESC LIMIT 1`,
          [session.userId],
        );
        const myProfile = bk.rows[0]?.profile ?? "(ingen brand-kit registrert)";

        const client = new Anthropic({ apiKey });
        const msg = await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `Du er Role Room Agent. Ranger disse potensielle kundene etter
hvor anbefalt det er for vår bedrift å nå ut til dem.

VÅR POSISJONERING:
${myProfile}

LEADS (${leads.rows.length}):
${leads.rows.map((l, i) => `${i + 1}. ${l.name} (${l.category ?? "?"}) — ${l.city ?? "?"} — rating ${l.google_rating ?? "?"}`).join("\n")}

Returner strengt JSON-array:
[
  { "id": "<lead.id>", "rank": 0-100, "reason": "kort begrunnelse" },
  ...
]
Rangering 100 = bestmatch (kjør outreach nå). 0 = ikke relevant.`,
          }],
        });

        const text = msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return res.status(500).json({ error: "claude_no_json", raw: text });
        const ranked = JSON.parse(jsonMatch[0]) as Array<{
          id: string; rank: number; reason: string;
        }>;

        // Map id → lead.id (Claude kan ha brukt index 1-50). Pass på.
        const validIds = new Set(leads.rows.map((l) => l.id));
        let updates = 0;
        for (const r of ranked) {
          if (!validIds.has(r.id)) continue;
          await pool.query(
            `UPDATE crm_customers
                SET claude_recommendation_rank = $3,
                    claude_recommendation_reason = $4,
                    claude_ranked_at = NOW()
              WHERE id = $1 AND owner_user_id = $2`,
            [r.id, session.userId, r.rank, r.reason],
          );
          updates += 1;
        }
        return res.json({ ranked: updates });
      } catch (err) {
        return res.status(500).json({ error: "rank_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /market-points (kombinert kart-data) ─────────────────────
  //
  // Defensiv mot delvis kjørte migrasjoner: hver del (leads/competitors)
  // har egen try/catch slik at hvis ett av sub-spørringene feiler (f.eks.
  // mig 281 ikke applied → claude_recommendation_rank mangler), får vi
  // FORTSATT en delvis respons med det som finnes. UI degraderer pent.
  app.get(
    "/api/admin-room/lead-map/market-points",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const include = String(req.query.include ?? "both"); // 'leads' | 'competitors' | 'both'
      const out: {
        leads: unknown[];
        competitors: unknown[];
        warnings?: string[];
      } = { leads: [], competitors: [] };
      const warnings: string[] = [];

      // ── Leads (m/ defensiv fallback hvis mig 281 ikke applied) ────
      if (include === "leads" || include === "both") {
        try {
          // Sjekk om mig 281's crm_customers-utvidelse er applied
          const hasClaudeCols = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_name = 'crm_customers'
                  AND column_name = 'claude_recommendation_rank'
             ) AS exists`,
          );
          const claudeRankSelect = hasClaudeCols.rows[0].exists
            ? "claude_recommendation_rank, claude_recommendation_reason"
            : "NULL::int AS claude_recommendation_rank, NULL::text AS claude_recommendation_reason";

          const l = await pool.query(
            // Kolonnen heter `lead_category` på crm_customers (mig 271) — ikke `category`.
            // JOIN users for å vise eier-navn ('skaffet av').
            `SELECT c.id::text, c.name, c.lead_category AS category, c.lead_status AS status,
                    c.latitude, c.longitude, c.address, c.city,
                    ${claudeRankSelect.replace(/claude_recommendation_/g, 'c.claude_recommendation_')},
                    c.ai_opportunity_score, c.google_rating,
                    c.owner_user_id,
                    u.name AS assigned_user_name,
                    u.email AS assigned_user_email
               FROM crm_customers c
               LEFT JOIN users u ON u.id = c.owner_user_id
              WHERE c.owner_user_id = $1
                AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL`,
            [session.userId],
          );
          out.leads = l.rows.map((r: Record<string, unknown>) => ({
            kind: "lead",
            id: r.id,
            name: r.name,
            category: r.category,
            status: r.status,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            address: r.address,
            city: r.city,
            recommendationRank: r.claude_recommendation_rank,
            recommendationReason: r.claude_recommendation_reason,
            aiOpportunityScore: r.ai_opportunity_score,
            googleRating: r.google_rating != null ? Number(r.google_rating) : null,
            assignedUserId: r.owner_user_id,
            assignedUserName: r.assigned_user_name,
            assignedUserEmail: r.assigned_user_email,
          }));
        } catch (err) {
          console.error("[market-points] leads-query failed", err);
          warnings.push(`leads_unavailable: ${(err as Error).message}`);
        }
      }

      // ── Konkurrenter (m/ defensiv fallback hvis mig 281 ikke applied) ──
      if (include === "competitors" || include === "both") {
        try {
          const hasCompCols = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM information_schema.columns
                WHERE table_name = 'market_scan_competitors'
                  AND column_name = 'workspace_owner_user_id'
             ) AS exists`,
          );
          if (!hasCompCols.rows[0].exists) {
            warnings.push("competitors_unavailable: mig 281 not applied");
          } else {
            const c = await pool.query<CompetitorRow>(
              `SELECT id::text, name, domain, category, positioning, primary_offer,
                      latitude, longitude, google_address, google_phone, google_rating,
                      is_manual_addition, threat_level, threat_score,
                      claude_threat_summary, claude_what_to_worry_about,
                      claude_what_to_ignore, claude_assessed_at::text,
                      priority_rank, created_at::text
                 FROM market_scan_competitors
                WHERE workspace_owner_user_id = $1
                  AND latitude IS NOT NULL AND longitude IS NOT NULL`,
              [session.userId],
            );
            out.competitors = c.rows.map((r) => ({
              kind: "competitor",
              ...rowToCompetitor(r),
            }));
          }
        } catch (err) {
          console.error("[market-points] competitors-query failed", err);
          warnings.push(`competitors_unavailable: ${(err as Error).message}`);
        }
      }

      if (warnings.length > 0) out.warnings = warnings;
      return res.json(out);
    },
  );
}
