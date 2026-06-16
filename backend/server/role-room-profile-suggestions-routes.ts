/**
 * role-room-profile-suggestions-routes.ts
 *
 * Agent «Profilforslag»: AI-optimalisering av en tilkoblet plattform-profil
 * (Facebook-side, Instagram osv). Agenten foreslår en optimalisert bio,
 * nøkkelord/hashtags og en handlingsknapp (CTA) ut fra sidens navn, kategori
 * og følgertall. Eier role_room_profile_suggestion (mig 285).
 *
 *   GET    /api/role-room/profile-suggestions?platform=&projectId=
 *            → siste forslag + tilkoblet side-info
 *   POST   /api/role-room/profile-suggestions/generate
 *            body: { projectId?, platform?, pageId?, pageName?, category?,
 *                    followersCount?, currentBio? }
 *   PATCH  /api/role-room/profile-suggestions/:id  body: { status }
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike {
  userId: string;
  email?: string;
  name?: string;
}

export interface RoleRoomProfileSuggestionsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

type SugStatus = "new" | "applied" | "dismissed";

interface SuggestionRow {
  id: string;
  owner_user_id: string;
  project_id: string | null;
  platform: string;
  page_id: string | null;
  page_name: string | null;
  bio: string | null;
  hashtags: string[];
  cta_label: string | null;
  status: SugStatus;
  source: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Record<string, unknown>): SuggestionRow {
  let hashtags: string[] = [];
  const raw = r.hashtags;
  if (Array.isArray(raw)) hashtags = raw.map((x) => String(x));
  else if (typeof raw === "string") { try { const p = JSON.parse(raw); if (Array.isArray(p)) hashtags = p.map((x) => String(x)); } catch { /* ignore */ } }
  return {
    id: String(r.id),
    owner_user_id: String(r.owner_user_id),
    project_id: r.project_id == null ? null : String(r.project_id),
    platform: String(r.platform),
    page_id: r.page_id == null ? null : String(r.page_id),
    page_name: r.page_name == null ? null : String(r.page_name),
    bio: r.bio == null ? null : String(r.bio),
    hashtags,
    cta_label: r.cta_label == null ? null : String(r.cta_label),
    status: (["new", "applied", "dismissed"].includes(String(r.status)) ? r.status : "new") as SugStatus,
    source: r.source == null ? null : String(r.source),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

interface GeneratedSuggestion {
  bio: string;
  hashtags: string[];
  ctaLabel: string;
}

interface PageContext {
  platform: string;
  pageName: string | null;
  category: string | null;
  followersCount: number | null;
  currentBio: string | null;
}

/** Slår opp tilkoblet side fra IG/FB-connections hvis frontend ikke sendte navn. */
async function lookupConnectedPage(pool: Pool, ownerUserId: string, platform: string): Promise<{ pageId: string | null; pageName: string | null }> {
  try {
    const r = await pool.query(
      `SELECT facebook_page_id, facebook_page_name
         FROM role_room_instagram_connections
        WHERE user_id = $1 AND connection_state = 'connected'
        ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [ownerUserId],
    );
    void platform;
    if (r.rows[0]) return { pageId: r.rows[0].facebook_page_id ?? null, pageName: r.rows[0].facebook_page_name ?? null };
  } catch { /* tabell/kolonne mangler — hopp over */ }
  return { pageId: null, pageName: null };
}

/** Lar Claude lage profilforslag. null hvis Claude er av eller kallet feiler. */
async function generateWithClaude(ctx: PageContext): Promise<GeneratedSuggestion | null> {
  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== "true" || !process.env.ANTHROPIC_API_KEY) return null;
  let client: any;
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch {
    return null;
  }

  const prompt = `Du er The Role Room Agent — en norsk merkevare- og innholdsstrateg.
Optimaliser ${ctx.platform === "facebook" ? "Facebook-siden" : "profilen"} basert på denne konteksten:

KONTEKST:
${JSON.stringify(ctx, null, 2)}

Lag:
1. "bio": en optimalisert profil-bio på norsk. MAKS 255 tegn. Varm, konkret, beskriver hva de tilbyr og inviterer til handling. Ikke bruk emoji.
2. "hashtags": 3–5 relevante nøkkelord/hashtags på norsk, UTEN #-prefiks, camelCase eller enkeltord (f.eks. "håndverksbakeri").
3. "ctaLabel": kort norsk tekst til en handlingsknapp (f.eks. "Besøk oss i dag", "Bestill bord", "Se meny"). Maks 30 tegn.

Forankre forslagene i sidens navn og kategori. Svar KUN med gyldig JSON, ingen markdown:
{"bio":"...","hashtags":["...","..."],"ctaLabel":"..."}`;

  try {
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    let text = "";
    for (const block of response.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") text += block.text;
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const bio = typeof parsed.bio === "string" ? parsed.bio.trim().slice(0, 255) : "";
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((h: unknown) => typeof h === "string").map((h: string) => h.replace(/^#/, "").trim()).filter(Boolean).slice(0, 6)
      : [];
    const ctaLabel = typeof parsed.ctaLabel === "string" ? parsed.ctaLabel.trim().slice(0, 30) : "";
    if (!bio && hashtags.length === 0 && !ctaLabel) return null;
    return { bio, hashtags, ctaLabel: ctaLabel || "Les mer" };
  } catch (err) {
    console.error("[profile-suggestions Claude] failed", err);
    return null;
  }
}

/** Enkel mal-fallback når Claude er av. */
function templateSuggestion(ctx: PageContext): GeneratedSuggestion {
  const name = ctx.pageName || "oss";
  const cat = ctx.category ? ctx.category.toLowerCase() : "tilbudet vårt";
  return {
    bio: `${name} — vi brenner for ${cat}. Følg oss for nyheter, inspirasjon og gode tilbud. Ta gjerne kontakt!`.slice(0, 255),
    hashtags: ["lokaltFavoritt", "følgOss", "norge"],
    ctaLabel: "Les mer",
  };
}

export function setupRoleRoomProfileSuggestionsRoutes(deps: RoleRoomProfileSuggestionsRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET — siste forslag for scope ────────────────────────────────────
  app.get("/api/role-room/profile-suggestions", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const platform = typeof req.query.platform === "string" && req.query.platform.trim() ? req.query.platform.trim() : "facebook";
      const projectId = typeof req.query.projectId === "string" && req.query.projectId.trim() ? req.query.projectId.trim() : null;
      const pageId = typeof req.query.pageId === "string" && req.query.pageId.trim() ? req.query.pageId.trim() : null;
      const params: unknown[] = [session.userId, platform];
      let where = "owner_user_id = $1 AND platform = $2";
      if (pageId) { params.push(pageId); where += ` AND page_id = $${params.length}`; }
      if (projectId) { params.push(projectId); where += ` AND (project_id = $${params.length} OR project_id IS NULL)`; }
      const r = await pool.query(
        `SELECT * FROM role_room_profile_suggestion WHERE ${where} AND status <> 'dismissed' ORDER BY created_at DESC LIMIT 1`,
        params,
      );
      const connected = await lookupConnectedPage(pool, session.userId, platform);
      return res.json({ suggestion: r.rows[0] ? mapRow(r.rows[0]) : null, connectedPage: connected });
    } catch (err) {
      console.error("[profile-suggestions GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente profilforslag" });
    }
  });

  // ── POST /generate — Claude-generering (fallback: mal) ───────────────
  app.post("/api/role-room/profile-suggestions/generate", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body || {}) as Record<string, unknown>;
    const platform = typeof body.platform === "string" && body.platform.trim() ? body.platform.trim() : "facebook";
    const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
    try {
      let pageId = typeof body.pageId === "string" ? body.pageId : null;
      let pageName = typeof body.pageName === "string" && body.pageName.trim() ? body.pageName.trim() : null;
      if (!pageName) {
        const connected = await lookupConnectedPage(pool, session.userId, platform);
        pageId = pageId ?? connected.pageId;
        pageName = connected.pageName;
      }
      const ctx: PageContext = {
        platform,
        pageName,
        category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : null,
        followersCount: typeof body.followersCount === "number" ? body.followersCount : null,
        currentBio: typeof body.currentBio === "string" && body.currentBio.trim() ? body.currentBio.trim() : null,
      };

      const claude = await generateWithClaude(ctx);
      const gen = claude ?? templateSuggestion(ctx);
      const source = claude ? "claude" : "template";

      const r = await pool.query(
        `INSERT INTO role_room_profile_suggestion
           (owner_user_id, project_id, platform, page_id, page_name, bio, hashtags, cta_label, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'new', $9)
         RETURNING *`,
        [session.userId, projectId, platform, pageId, pageName, gen.bio, JSON.stringify(gen.hashtags), gen.ctaLabel, source],
      );
      return res.json({ suggestion: mapRow(r.rows[0]), source });
    } catch (err) {
      console.error("[profile-suggestions generate] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere profilforslag" });
    }
  });

  // ── PATCH — marker som brukt / avvist ────────────────────────────────
  app.patch("/api/role-room/profile-suggestions/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const status = (req.body || {}).status;
    if (status !== "applied" && status !== "dismissed" && status !== "new") {
      return res.status(400).json({ error: "Ugyldig status" });
    }
    try {
      const r = await pool.query(
        `UPDATE role_room_profile_suggestion
            SET status = $3, updated_at = now()
          WHERE id = $1 AND owner_user_id = $2 RETURNING *`,
        [req.params.id, session.userId, status],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ suggestion: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[profile-suggestions PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere" });
    }
  });
}
