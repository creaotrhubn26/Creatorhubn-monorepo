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
        return res.json({ competitor: rowToCompetitor(ins.rows[0]) });
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

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "anthropic_key_missing" });

      try {
        // Hent konkurrent + min Brand Kit som baseline
        const cr = await pool.query<{
          id: string; name: string; domain: string;
          category: string | null; positioning: string | null;
          primary_offer: string | null;
        }>(
          `SELECT id::text, name, domain, category, positioning, primary_offer
             FROM market_scan_competitors
            WHERE id = $1 AND workspace_owner_user_id = $2`,
          [req.params.id, session.userId],
        );
        if (cr.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const comp = cr.rows[0];

        // Min egen brand-kit-summary (siste)
        const bk = await pool.query<{ profile: string | null }>(
          `SELECT (brand_profile->>'positioning_summary')::text AS profile
             FROM brand_kits
            WHERE workspace_owner_user_id = $1
            ORDER BY updated_at DESC LIMIT 1`,
          [session.userId],
        );
        const myProfile = bk.rows[0]?.profile ?? "(ingen brand-kit-summary registrert)";

        const client = new Anthropic({ apiKey });
        const msg = await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `Du er Role Room Agent. Vurder en konkurrent for vår egen bedrift.

VÅR EGEN POSISJONERING:
${myProfile}

KONKURRENTEN:
- Navn: ${comp.name}
- Domene: ${comp.domain}
- Kategori: ${comp.category ?? "?"}
- Tilbud: ${comp.primary_offer ?? "?"}
- Posisjonering: ${comp.positioning ?? "?"}

Returner strengt JSON:
{
  "threat_level": "near" | "medium" | "far",
  "threat_score": 0-100,
  "threat_summary": "1-2 setninger om hvorfor dette trussel-nivået",
  "what_to_worry_about": "konkrete grunner du må holde øye med dette",
  "what_to_ignore": "hva du IKKE bør bruke energi på rundt denne konkurrenten"
}`,
          }],
        });

        const text = msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return res.status(500).json({ error: "claude_no_json", raw: text });
        const parsed = JSON.parse(jsonMatch[0]) as {
          threat_level: "near" | "medium" | "far";
          threat_score: number;
          threat_summary: string;
          what_to_worry_about: string;
          what_to_ignore: string;
        };

        const updated = await pool.query<CompetitorRow>(
          `UPDATE market_scan_competitors
              SET threat_level = $3,
                  threat_score = $4,
                  claude_threat_summary = $5,
                  claude_what_to_worry_about = $6,
                  claude_what_to_ignore = $7,
                  claude_assessed_at = NOW()
            WHERE id = $1 AND workspace_owner_user_id = $2
          RETURNING id::text, name, domain, category, positioning, primary_offer,
                    latitude, longitude, google_address, google_phone, google_rating,
                    is_manual_addition, threat_level, threat_score,
                    claude_threat_summary, claude_what_to_worry_about,
                    claude_what_to_ignore, claude_assessed_at::text,
                    priority_rank, created_at::text`,
          [
            comp.id,
            session.userId,
            parsed.threat_level,
            parsed.threat_score,
            parsed.threat_summary,
            parsed.what_to_worry_about,
            parsed.what_to_ignore,
          ],
        );
        return res.json({ competitor: rowToCompetitor(updated.rows[0]) });
      } catch (err) {
        return res.status(500).json({ error: "assess_failed", detail: String(err) });
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
  app.get(
    "/api/admin-room/lead-map/market-points",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const include = String(req.query.include ?? "both"); // 'leads' | 'competitors' | 'both'
      try {
        const out: { leads: unknown[]; competitors: unknown[] } = { leads: [], competitors: [] };

        if (include === "leads" || include === "both") {
          const l = await pool.query(
            `SELECT id::text, name, category, lead_status AS status,
                    latitude, longitude, address, city,
                    claude_recommendation_rank, claude_recommendation_reason,
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
        }

        if (include === "competitors" || include === "both") {
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

        return res.json(out);
      } catch (err) {
        return res.status(500).json({ error: "market_points_failed", detail: String(err) });
      }
    },
  );
}
