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
            `SELECT id::text, name, category, lead_status AS status,
                    latitude, longitude, address, city,
                    ${claudeRankSelect},
                    ai_opportunity_score, google_rating
               FROM crm_customers
              WHERE owner_user_id = $1
                AND latitude IS NOT NULL AND longitude IS NOT NULL`,
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
