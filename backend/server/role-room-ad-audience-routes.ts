/**
 * role-room-ad-audience-routes.ts
 *
 * Agent «Annonse-målgruppe» — «hvem annonsen treffer». Det finnes ingen ekte
 * Meta-delivery-insights-kilde ennå, så Agenten ESTIMERER en plausibel
 * målgruppe (rekkevidde, alder, kjønn, sted, interesser) fra firmaprofilen
 * med Claude. Tydelig merket som AI-estimat. Eier role_room_ad_audience (287).
 *
 *   GET   /api/role-room/ad-audience?projectId=&platform=
 *   POST  /api/role-room/ad-audience/generate
 *           body: { projectId, platform?, companyName?, industry?,
 *                   targetAudience?, location? }
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomAdAudienceRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

interface AudienceRow {
  id: string;
  project_id: string;
  platform: string;
  audience_name: string | null;
  estimated_reach: number | null;
  ages: Array<{ lbl: string; pct: number }>;
  female_pct: number | null;
  locations: Array<{ name: string; pct: number }>;
  interests: Array<{ t: string; hot: boolean }>;
  source: string | null;
  created_at: string;
}

function jsonArr(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function mapRow(r: Record<string, unknown>): AudienceRow {
  return {
    id: String(r.id),
    project_id: String(r.project_id),
    platform: String(r.platform),
    audience_name: r.audience_name == null ? null : String(r.audience_name),
    estimated_reach: r.estimated_reach == null ? null : Number(r.estimated_reach),
    ages: jsonArr(r.ages).map((a) => ({ lbl: String(a.lbl ?? ""), pct: Number(a.pct) || 0 })),
    female_pct: r.female_pct == null ? null : Number(r.female_pct),
    locations: jsonArr(r.locations).map((l) => ({ name: String(l.name ?? ""), pct: Number(l.pct) || 0 })),
    interests: jsonArr(r.interests).map((i) => ({ t: String(i.t ?? ""), hot: Boolean(i.hot) })),
    source: r.source == null ? null : String(r.source),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

interface GeneratedAudience {
  audienceName: string;
  estimatedReach: number;
  ages: Array<{ lbl: string; pct: number }>;
  femalePct: number;
  locations: Array<{ name: string; pct: number }>;
  interests: Array<{ t: string; hot: boolean }>;
}

interface AudienceCtx { platform: string; companyName: string | null; industry: string | null; targetAudience: string | null; location: string | null }

async function generateWithClaude(ctx: AudienceCtx): Promise<GeneratedAudience | null> {
  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== "true" || !process.env.ANTHROPIC_API_KEY) return null;
  let client: any;
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch { return null; }

  const prompt = `Du er The Role Room Agent — norsk annonsestrateg. ESTIMER en plausibel annonse-målgruppe («hvem annonsen treffer») for denne bedriften på ${ctx.platform === "meta" ? "Meta (Instagram/Facebook)" : ctx.platform}.

KONTEKST:
${JSON.stringify(ctx, null, 2)}

Gi et realistisk estimat (dette er et AI-estimat, ikke ekte plattformdata):
- "audienceName": kort navn på målgruppen (f.eks. "Aktive filmskapere").
- "estimatedReach": anslått ukentlig rekkevidde i valgt område (heltall, realistisk for Norge).
- "ages": fordeling over [18–24, 25–34, 35–44, 45–54, 55+], pct summerer til ~100.
- "femalePct": andel kvinner (0–100).
- "locations": 3 norske byer/områder med pct.
- "interests": 4–6 relevante interesser, "hot": true for de 1–2 mest sentrale.

Svar KUN med gyldig JSON, ingen markdown:
{"audienceName":"...","estimatedReach":34200,"ages":[{"lbl":"18–24","pct":18}],"femalePct":57,"locations":[{"name":"Oslo","pct":44}],"interests":[{"t":"Film & video","hot":true}]}`;

  try {
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    let text = "";
    for (const block of response.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") text += block.text;
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const p = JSON.parse(text.slice(start, end + 1));
    const ages = jsonArr(p.ages).map((a) => ({ lbl: String(a.lbl ?? ""), pct: Math.round(Number(a.pct) || 0) })).slice(0, 6);
    const locations = jsonArr(p.locations).map((l) => ({ name: String(l.name ?? ""), pct: Math.round(Number(l.pct) || 0) })).slice(0, 5);
    const interests = jsonArr(p.interests).map((i) => ({ t: String(i.t ?? ""), hot: Boolean(i.hot) })).filter((i) => i.t).slice(0, 6);
    if (!ages.length && !interests.length) return null;
    return {
      audienceName: typeof p.audienceName === "string" ? p.audienceName.trim().slice(0, 80) : "Målgruppe",
      estimatedReach: Math.max(0, Math.round(Number(p.estimatedReach) || 0)),
      ages, femalePct: Math.min(100, Math.max(0, Math.round(Number(p.femalePct) || 50))), locations, interests,
    };
  } catch (err) {
    console.error("[ad-audience Claude] failed", err);
    return null;
  }
}

function templateAudience(ctx: AudienceCtx): GeneratedAudience {
  return {
    audienceName: ctx.targetAudience || "Relevant publikum",
    estimatedReach: 28000,
    ages: [{ lbl: "18–24", pct: 16 }, { lbl: "25–34", pct: 38 }, { lbl: "35–44", pct: 28 }, { lbl: "45–54", pct: 13 }, { lbl: "55+", pct: 5 }],
    femalePct: 54,
    locations: [{ name: "Oslo", pct: 42 }, { name: "Bergen", pct: 20 }, { name: "Trondheim", pct: 13 }],
    interests: [{ t: ctx.industry || "Bransjen", hot: true }, { t: "Innholdsskaping", hot: true }, { t: "Sosiale medier", hot: false }, { t: "Lokalt næringsliv", hot: false }],
  };
}

export function setupRoleRoomAdAudienceRoutes(deps: RoleRoomAdAudienceRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  app.get("/api/role-room/ad-audience", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const projectId = typeof req.query.projectId === "string" && req.query.projectId.trim() ? req.query.projectId.trim() : null;
    if (!projectId) return res.status(400).json({ error: "projectId kreves" });
    const platform = typeof req.query.platform === "string" && req.query.platform.trim() ? req.query.platform.trim() : "meta";
    try {
      const r = await pool.query(
        `SELECT * FROM role_room_ad_audience WHERE project_id = $1 AND platform = $2 ORDER BY created_at DESC LIMIT 1`,
        [projectId, platform],
      );
      return res.json({ audience: r.rows[0] ? mapRow(r.rows[0]) : null });
    } catch (err) {
      console.error("[ad-audience GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente målgruppe" });
    }
  });

  app.post("/api/role-room/ad-audience/generate", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body || {}) as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
    if (!projectId) return res.status(400).json({ error: "projectId kreves" });
    const platform = typeof body.platform === "string" && body.platform.trim() ? body.platform.trim() : "meta";
    try {
      const ctx: AudienceCtx = {
        platform,
        companyName: typeof body.companyName === "string" && body.companyName.trim() ? body.companyName.trim() : null,
        industry: typeof body.industry === "string" && body.industry.trim() ? body.industry.trim() : null,
        targetAudience: typeof body.targetAudience === "string" && body.targetAudience.trim() ? body.targetAudience.trim()
          : Array.isArray(body.targetAudience) ? body.targetAudience.filter((x) => typeof x === "string").join(", ") : null,
        location: typeof body.location === "string" && body.location.trim() ? body.location.trim() : null,
      };
      const claude = await generateWithClaude(ctx);
      const gen = claude ?? templateAudience(ctx);
      const source = claude ? "claude" : "template";

      const r = await pool.query(
        `INSERT INTO role_room_ad_audience
           (owner_user_id, project_id, platform, audience_name, estimated_reach, ages, female_pct, locations, interests, source)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10)
         RETURNING *`,
        [session.userId, projectId, platform, gen.audienceName, gen.estimatedReach, JSON.stringify(gen.ages), gen.femalePct, JSON.stringify(gen.locations), JSON.stringify(gen.interests), source],
      );
      return res.json({ audience: mapRow(r.rows[0]), source });
    } catch (err) {
      console.error("[ad-audience generate] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere målgruppe" });
    }
  });
}
