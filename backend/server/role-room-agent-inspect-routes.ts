/**
 * role-room-agent-inspect-routes.ts
 *
 * Setup-funksjon for /api/role-room/agent/* inspeksjons-endpoints —
 * Meta Graph API-discovery, hashtag-suggesting, og ads-attribution-
 * inspeksjon for The Role Room Agent (Innholdsprodusent-mode).
 *
 * 6 endpoints:
 *   - POST /agent/meta-page-inspect          (Meta Graph page-detaljer)
 *   - GET  /agent/page-search                (search Facebook/IG pages)
 *   - POST /agent/page-content-inspect       (analyser page-content)
 *   - POST /agent/hashtag-suggest            (Claude → hashtag-forslag)
 *   - POST /agent/ig-hashtag-inspect         (IG hashtag-analytics via Graph)
 *   - POST /agent/ads-attribution-inspect    (ads-attribution-analytics)
 *
 * Auth: requireAdminSession + feature-flag `role-room-agent-producer`.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomAgentInspectRoutes } from "./role-room-agent-inspect-routes";
 *
 *   setupRoleRoomAgentInspectRoutes({
 *     app, pool, requireAdminSession, isCompatAdminFeatureEnabled,
 *   });
 *
 * Mode-noter: Innholdsprodusent-mode-feature, gated på feature-flag.
 */

import type express from "express";
import type { Pool } from "pg";

import { listInstagramConnections } from "./role-room-instagram-oauth.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomAgentInspectRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

export function setupRoleRoomAgentInspectRoutes(
  deps: RoleRoomAgentInspectRoutesDeps,
): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  app.post("/api/role-room/agent/meta-page-inspect", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawInput = typeof body.pageIdOrUrl === "string" ? body.pageIdOrUrl.trim() : "";
    if (!rawInput) {
      return res.status(400).json({ success: false, error: "pageIdOrUrl er påkrevd." });
    }

    // Accept numeric Page IDs, full facebook.com URLs, and bare page
    // handles (e.g. "creatorhubn"). Strip URL chrome and trailing slashes.
    const pageIdOrHandle = (() => {
      if (/^[0-9]{5,}$/.test(rawInput)) return rawInput;
      try {
        const url = new URL(rawInput.startsWith("http") ? rawInput : `https://${rawInput}`);
        if (/facebook\.com$/i.test(url.hostname) || /facebook\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts.length > 0) {
            const last = parts[parts.length - 1];
            if (/^[0-9]+$/.test(last)) return last;
            return parts[0];
          }
        }
      } catch {
        /* fall through — treat as handle */
      }
      return rawInput.replace(/^@/, "").replace(/\/$/, "");
    })();

    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({
        success: false,
        error: "Du må koble Facebook/Instagram til Role Room før du kan hente public Page-metadata.",
        connectRequired: true,
      });
    }
    const connection = connections[0];

    const fields = [
      "id",
      "name",
      "fan_count",
      "followers_count",
      "category",
      "category_list",
      "about",
      "website",
      "link",
      "verification_status",
    ].join(",");
    const graphVersion = "v21.0";
    const graphUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageIdOrHandle)}?${new URLSearchParams({
      fields,
      access_token: connection.accessToken,
    })}`;

    try {
      const response = await fetch(graphUrl, { method: "GET" });
      const text = await response.text();
      let payload: Record<string, unknown> | null = null;
      try { payload = JSON.parse(text) as Record<string, unknown>; } catch { /* keep raw */ }

      if (!response.ok) {
        console.error(`[meta-page-inspect] graph status=${response.status} body=${text.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (payload?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(response.status === 400 ? 422 : response.status).json({
          success: false,
          error: typeof errObj?.message === "string"
            ? `Meta Graph API: ${errObj.message}`
            : `Meta Graph API returnerte ${response.status}.`,
          graphStatus: response.status,
          graphError: errObj,
        });
      }
      if (!payload || typeof payload.id !== "string") {
        return res.status(502).json({ success: false, error: "Uventet respons fra Meta Graph API." });
      }

      return res.json({
        success: true,
        page: {
          id: String(payload.id),
          name: typeof payload.name === "string" ? payload.name : null,
          fanCount: typeof payload.fan_count === "number" ? payload.fan_count : null,
          followersCount: typeof payload.followers_count === "number" ? payload.followers_count : null,
          category: typeof payload.category === "string" ? payload.category : null,
          categoryList: Array.isArray(payload.category_list) ? payload.category_list : null,
          about: typeof payload.about === "string" ? payload.about : null,
          website: typeof payload.website === "string" ? payload.website : null,
          link: typeof payload.link === "string" ? payload.link : null,
          verificationStatus: typeof payload.verification_status === "string" ? payload.verification_status : null,
        },
        meta: {
          resolvedFrom: rawInput,
          resolvedTo: pageIdOrHandle,
          graphVersion,
        },
      });
    } catch (err) {
      console.error(`[meta-page-inspect] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

  app.get("/api/role-room/agent/page-search", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: "q (search query) må være minst 2 tegn." });
    }
    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({ success: false, error: "Koble Facebook/Instagram til Role Room først.", connectRequired: true });
    }
    const connection = connections[0];
    const url = `https://graph.facebook.com/v21.0/pages/search?${new URLSearchParams({
      q,
      fields: "id,name,category,link,verification_status,fan_count",
      access_token: connection.accessToken,
    })}`;
    try {
      const response = await fetch(url);
      const text = await response.text();
      let body: Record<string, unknown> | null = null;
      try { body = JSON.parse(text); } catch { /* keep raw */ }
      if (!response.ok) {
        console.error(`[page-search] status=${response.status} body=${text.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (body?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(response.status).json({
          success: false,
          error: typeof errObj?.message === "string" ? `Meta Graph API: ${errObj.message}` : `Meta Graph API returnerte ${response.status}.`,
        });
      }
      const results = Array.isArray(body?.data) ? body.data : [];
      return res.json({
        success: true,
        pages: results.slice(0, 8).map((p: Record<string, unknown>) => ({
          id: typeof p.id === "string" ? p.id : null,
          name: typeof p.name === "string" ? p.name : null,
          category: typeof p.category === "string" ? p.category : null,
          link: typeof p.link === "string" ? p.link : null,
          verified: p.verification_status === "blue_verified" || p.verification_status === "gray_verified",
          fanCount: typeof p.fan_count === "number" ? p.fan_count : null,
        })),
      });
    } catch (err) {
      console.error(`[page-search] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

  app.post("/api/role-room/agent/page-content-inspect", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawInput = typeof body.pageIdOrUrl === "string" ? body.pageIdOrUrl.trim() : "";
    if (!rawInput) {
      return res.status(400).json({ success: false, error: "pageIdOrUrl er påkrevd." });
    }

    const pageIdOrHandle = (() => {
      if (/^[0-9]{5,}$/.test(rawInput)) return rawInput;
      try {
        const url = new URL(rawInput.startsWith("http") ? rawInput : `https://${rawInput}`);
        if (/facebook\.com$/i.test(url.hostname) || /facebook\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts.length > 0) {
            const last = parts[parts.length - 1];
            if (/^[0-9]+$/.test(last)) return last;
            return parts[0];
          }
        }
      } catch { /* fall through */ }
      return rawInput.replace(/^@/, "").replace(/\/$/, "");
    })();

    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({
        success: false,
        error: "Du må koble Facebook/Instagram til Role Room før du kan hente public Page-innhold.",
        connectRequired: true,
      });
    }
    const connection = connections[0];

    const graphVersion = "v21.0";

    // Pages on Meta's "New Pages Experience" require a Page-scoped token
    // for /{page-id}/posts + /videos — user tokens yield OAuthException
    // code 190 subcode 2069032. Resolve the Page from /me/accounts and
    // use its access_token for the feed reads.
    let resolvedPageId: string = pageIdOrHandle;
    let pageAccessToken: string | null = null;
    try {
      const accountsRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,username,access_token&access_token=${encodeURIComponent(connection.accessToken)}`,
      );
      const accountsBody = await accountsRes.json() as {
        data?: Array<{ id?: string; name?: string; username?: string; access_token?: string }>;
      };
      const needle = pageIdOrHandle.toLowerCase();
      const match = (accountsBody.data ?? []).find((p) =>
        String(p.id) === pageIdOrHandle ||
        (p.username && p.username.toLowerCase() === needle) ||
        (p.name && p.name.toLowerCase() === needle),
      );
      if (match?.access_token && match.id) {
        pageAccessToken = match.access_token;
        resolvedPageId = match.id;
      }
    } catch (err) {
      console.error(`[page-content-inspect] me/accounts threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!pageAccessToken) {
      return res.status(403).json({
        success: false,
        error: "Fant ingen Page-token for denne siden — admin-kontoen må ha en rolle på Facebook-siden. Pre-review virker kun for sider du er admin på; post-approval åpnes alle public Pages via app access token.",
      });
    }

    const postsFields = [
      "id",
      "message",
      "created_time",
      "permalink_url",
      "full_picture",
      "attachments{media_type,title,url}",
      "comments.limit(3){message,created_time,from{name}}",
    ].join(",");
    const videosFields = [
      "id",
      "title",
      "description",
      "created_time",
      "permalink_url",
      "source",
      "picture",
    ].join(",");

    const postsUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(resolvedPageId)}/posts?${new URLSearchParams({
      fields: postsFields,
      limit: "5",
      access_token: pageAccessToken,
    })}`;
    const videosUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(resolvedPageId)}/videos?${new URLSearchParams({
      fields: videosFields,
      limit: "5",
      access_token: pageAccessToken,
    })}`;

    try {
      const [postsRes, videosRes] = await Promise.all([fetch(postsUrl), fetch(videosUrl)]);

      // Posts endpoint is required; videos is optional (some Pages only
      // post photos/text). Fail only if posts fails hard.
      const postsText = await postsRes.text();
      let postsBody: Record<string, unknown> | null = null;
      try { postsBody = JSON.parse(postsText); } catch { /* keep raw */ }
      if (!postsRes.ok) {
        console.error(`[page-content-inspect] posts status=${postsRes.status} body=${postsText.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (postsBody?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(postsRes.status === 400 ? 422 : postsRes.status).json({
          success: false,
          error: typeof errObj?.message === "string" ? `Meta Graph API: ${errObj.message}` : `Meta Graph API returnerte ${postsRes.status}.`,
          graphError: errObj,
        });
      }

      const videosText = await videosRes.text();
      let videosBody: Record<string, unknown> | null = null;
      try { videosBody = JSON.parse(videosText); } catch { /* keep raw */ }
      if (!videosRes.ok) {
        console.warn(`[page-content-inspect] videos status=${videosRes.status} body=${videosText.replace(/\s+/g, " ").slice(0, 200)}`);
      }

      const postsData = Array.isArray(postsBody?.data) ? postsBody.data : [];
      const videosData = videosRes.ok && Array.isArray(videosBody?.data) ? videosBody.data : [];

      return res.json({
        success: true,
        posts: postsData.map((p: Record<string, unknown>) => ({
          id: typeof p.id === "string" ? p.id : null,
          message: typeof p.message === "string" ? p.message : null,
          createdTime: typeof p.created_time === "string" ? p.created_time : null,
          permalinkUrl: typeof p.permalink_url === "string" ? p.permalink_url : null,
          fullPicture: typeof p.full_picture === "string" ? p.full_picture : null,
          attachments: (p as any).attachments?.data ?? [],
          comments: Array.isArray((p as any).comments?.data)
            ? (p as any).comments.data.map((c: any) => ({
                message: typeof c?.message === "string" ? c.message : null,
                createdTime: typeof c?.created_time === "string" ? c.created_time : null,
                fromName: typeof c?.from?.name === "string" ? c.from.name : null,
              }))
            : [],
        })),
        videos: videosData.map((v: Record<string, unknown>) => ({
          id: typeof v.id === "string" ? v.id : null,
          title: typeof v.title === "string" ? v.title : null,
          description: typeof v.description === "string" ? v.description : null,
          createdTime: typeof v.created_time === "string" ? v.created_time : null,
          permalinkUrl: typeof v.permalink_url === "string" ? v.permalink_url : null,
          source: typeof v.source === "string" ? v.source : null,
          picture: typeof v.picture === "string" ? v.picture : null,
        })),
        meta: { resolvedFrom: rawInput, resolvedTo: resolvedPageId, graphVersion },
      });
    } catch (err) {
      console.error(`[page-content-inspect] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

  app.post("/api/role-room/agent/hashtag-suggest", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const context = typeof body.context === "string" ? body.context.trim() : "";
    const brand = typeof body.brand === "string" ? body.brand.trim() : "";
    const desiredCount = Math.min(15, Math.max(3, typeof body.count === "number" ? body.count : 8));
    if (!context) {
      return res.status(400).json({ success: false, error: "context er påkrevd." });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(503).json({ success: false, error: "ANTHROPIC_API_KEY ikke satt i backend." });
    }

    // 1) Ask Claude for hashtag candidates.
    let candidates: Array<{ hashtag: string; reasoning: string }> = [];
    try {
      const mod: any = await import("@anthropic-ai/sdk");
      const AnthropicCtor = mod.default ?? mod.Anthropic;
      const client = new AnthropicCtor({ apiKey: anthropicKey });
      const prompt = `Du er en norsk sosial-strateg for Instagram. Basert på dette innholdet, foreslå ${desiredCount} hashtag-kandidater som er mest relevante og sannsynlig vil gi god organic rekkevidde på norsk eller nordisk IG-marked.

  ${brand ? `Merkevare: ${brand}\n` : ""}Innhold:
  ${context.slice(0, 1500)}

  Regler:
  - Kun alfanumerisk + underscore (ingen æøå, ingen mellomrom, ingen emoji)
  - Blanding av høy-volum-tags (#oslo, #norway), nisje-tags (#osloeats) og brand-spesifikke tags
  - Ingen dupliserte
  - Ikke bruk #-tegn i svaret, bare selve tag-navnet

  Svar KUN med gyldig JSON på dette skjemaet, ingen markdown eller commentary:
  {
    "candidates": [
      { "hashtag": "string", "reasoning": "kort norsk begrunnelse i 1 setning" }
    ]
  }`;

      const response = await client.messages.create({
        model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      });
      const text = (response?.content ?? [])
        .map((block: any) => (typeof block?.text === "string" ? block.text : ""))
        .join("")
        .trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      if (parsed && Array.isArray(parsed.candidates)) {
        candidates = parsed.candidates
          .map((c: any) => ({
            hashtag: String(c?.hashtag || "").replace(/^#/, "").replace(/[^A-Za-z0-9_]/g, "").toLowerCase(),
            reasoning: typeof c?.reasoning === "string" ? c.reasoning : "",
          }))
          .filter((c: { hashtag: string }) => c.hashtag.length >= 2 && c.hashtag.length <= 30);
      }
    } catch (err) {
      console.error(`[hashtag-suggest] Claude threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(502).json({ success: false, error: "AI-forslag feilet — prøv igjen om et øyeblikk." });
    }
    if (candidates.length === 0) {
      return res.json({ success: true, candidates: [], meta: { source: "claude", validated: 0 } });
    }

    // 2) Validate each candidate against Meta /ig_hashtag_search. Best-
    // effort — if no connection is stored we skip validation and just
    // return Claude's draft so the producer can still copy them.
    const connections = await listInstagramConnections(pool, session.userId);
    const connection = connections[0];
    const igUserId = connection?.igBusinessAccountId;
    const graphVersion = "v21.0";

    type Validated = {
      hashtag: string;
      reasoning: string;
      hashtagId: string | null;
      topMediaPreview: string | null;
      validationError: string | null;
    };
    const validated: Validated[] = await Promise.all(
      candidates.slice(0, desiredCount).map(async (c) => {
        if (!connection || !igUserId) {
          return { hashtag: c.hashtag, reasoning: c.reasoning, hashtagId: null, topMediaPreview: null, validationError: "no_connection" };
        }
        try {
          const searchUrl = `https://graph.facebook.com/${graphVersion}/ig_hashtag_search?${new URLSearchParams({
            user_id: igUserId,
            q: c.hashtag,
            access_token: connection.accessToken,
          })}`;
          const r = await fetch(searchUrl);
          if (!r.ok) {
            return { hashtag: c.hashtag, reasoning: c.reasoning, hashtagId: null, topMediaPreview: null, validationError: `search_${r.status}` };
          }
          const j = await r.json().catch(() => null) as any;
          const id = j?.data?.[0]?.id ?? null;
          if (!id) {
            return { hashtag: c.hashtag, reasoning: c.reasoning, hashtagId: null, topMediaPreview: null, validationError: "not_found" };
          }
          // Peek at 1 top post's permalink as a freshness/engagement signal.
          const peekUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(id)}/top_media?${new URLSearchParams({
            user_id: igUserId,
            fields: "permalink",
            limit: "1",
            access_token: connection.accessToken,
          })}`;
          const peekRes = await fetch(peekUrl);
          let topMediaPreview: string | null = null;
          if (peekRes.ok) {
            const peek = await peekRes.json().catch(() => null) as any;
            topMediaPreview = peek?.data?.[0]?.permalink ?? null;
          }
          return { hashtag: c.hashtag, reasoning: c.reasoning, hashtagId: id, topMediaPreview, validationError: null };
        } catch (err) {
          return { hashtag: c.hashtag, reasoning: c.reasoning, hashtagId: null, topMediaPreview: null, validationError: "fetch_threw" };
        }
      }),
    );

    // Rank: validated first, then by reasoning length (proxy for
    // specificity), then alphabetical.
    validated.sort((a, b) => {
      if (!!a.hashtagId !== !!b.hashtagId) return a.hashtagId ? -1 : 1;
      const ra = (a.reasoning || "").length;
      const rb = (b.reasoning || "").length;
      if (ra !== rb) return rb - ra;
      return a.hashtag.localeCompare(b.hashtag);
    });

    return res.json({
      success: true,
      candidates: validated,
      meta: {
        source: "claude",
        validated: validated.filter((v) => !!v.hashtagId).length,
        validationMissing: !connection || !igUserId,
      },
    });
  });

  app.post("/api/role-room/agent/ig-hashtag-inspect", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawHashtag = typeof body.hashtag === "string" ? body.hashtag.trim() : "";
    const normalizedTag = rawHashtag.replace(/^#/, "").trim();
    if (!normalizedTag) {
      return res.status(400).json({ success: false, error: "hashtag er påkrevd." });
    }
    if (!/^[a-z0-9_]+$/i.test(normalizedTag)) {
      return res.status(400).json({ success: false, error: "Hashtag kan kun inneholde bokstaver, tall og underscore." });
    }

    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({
        success: false,
        error: "Koble Facebook/Instagram til Role Room først.",
        connectRequired: true,
      });
    }
    const connection = connections[0];
    const igUserId = connection.igBusinessAccountId;
    if (!igUserId) {
      return res.status(409).json({
        success: false,
        error: "Ingen Instagram Business Account knyttet til Meta-tilkoblingen.",
      });
    }

    const graphVersion = "v21.0";
    // Step 1: resolve hashtag id
    const searchUrl = `https://graph.facebook.com/${graphVersion}/ig_hashtag_search?${new URLSearchParams({
      user_id: igUserId,
      q: normalizedTag,
      access_token: connection.accessToken,
    })}`;
    try {
      const searchRes = await fetch(searchUrl);
      const searchText = await searchRes.text();
      let searchBody: Record<string, unknown> | null = null;
      try { searchBody = JSON.parse(searchText); } catch { /* keep raw */ }
      if (!searchRes.ok) {
        console.error(`[ig-hashtag-inspect] search status=${searchRes.status} body=${searchText.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (searchBody?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(searchRes.status === 400 ? 422 : searchRes.status).json({
          success: false,
          error: typeof errObj?.message === "string" ? `Meta Graph API: ${errObj.message}` : `Meta Graph API returnerte ${searchRes.status}.`,
          graphError: errObj,
        });
      }
      const searchData = Array.isArray(searchBody?.data) ? searchBody.data : [];
      const hashtagId = (searchData[0] as Record<string, unknown> | undefined)?.id;
      if (!hashtagId || typeof hashtagId !== "string") {
        return res.json({
          success: true,
          hashtag: { id: null, name: normalizedTag },
          posts: [],
          meta: { graphVersion, resolvedFrom: rawHashtag },
        });
      }

      // Step 2: fetch top media. IG hashtag top_media supports only a
      // narrower field set than user/media — thumbnail_url + like_count
      // + comments_count + timestamp trigger (#100) "Please read docs
      // for supported fields". Stick to the canonical documented set.
      const fields = [
        "id",
        "media_type",
        "media_url",
        "permalink",
        "caption",
        "children{media_url,media_type}",
      ].join(",");
      const topMediaUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(hashtagId)}/top_media?${new URLSearchParams({
        user_id: igUserId,
        fields,
        limit: "9",
        access_token: connection.accessToken,
      })}`;
      const mediaRes = await fetch(topMediaUrl);
      const mediaText = await mediaRes.text();
      let mediaBody: Record<string, unknown> | null = null;
      try { mediaBody = JSON.parse(mediaText); } catch { /* keep raw */ }
      if (!mediaRes.ok) {
        console.error(`[ig-hashtag-inspect] top_media status=${mediaRes.status} body=${mediaText.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (mediaBody?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(mediaRes.status).json({
          success: false,
          error: typeof errObj?.message === "string" ? `Meta Graph API: ${errObj.message}` : `Meta Graph API returnerte ${mediaRes.status}.`,
          graphError: errObj,
          hashtag: { id: hashtagId, name: normalizedTag },
        });
      }
      const mediaArray = Array.isArray(mediaBody?.data) ? mediaBody.data : [];
      const posts = mediaArray.map((m: Record<string, unknown>) => ({
        id: typeof m.id === "string" ? m.id : null,
        mediaType: typeof m.media_type === "string" ? m.media_type : null,
        mediaUrl: typeof m.media_url === "string" ? m.media_url : null,
        thumbnailUrl: typeof m.thumbnail_url === "string" ? m.thumbnail_url : null,
        permalink: typeof m.permalink === "string" ? m.permalink : null,
        caption: typeof m.caption === "string" ? m.caption : null,
        likeCount: typeof m.like_count === "number" ? m.like_count : null,
        commentsCount: typeof m.comments_count === "number" ? m.comments_count : null,
        timestamp: typeof m.timestamp === "string" ? m.timestamp : null,
      }));
      return res.json({
        success: true,
        hashtag: { id: hashtagId, name: normalizedTag },
        posts,
        meta: { graphVersion, resolvedFrom: rawHashtag, igUserId },
      });
    } catch (err) {
      console.error(`[ig-hashtag-inspect] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

  app.post("/api/role-room/agent/ads-attribution-inspect", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawInput = typeof body.adAccountId === "string" ? body.adAccountId.trim() : "";
    if (!rawInput) {
      return res.status(400).json({ success: false, error: "adAccountId er påkrevd." });
    }
    // Normalize: Meta wants act_{id} prefix on the ad account.
    const adAccountId = rawInput.startsWith("act_") ? rawInput : `act_${rawInput.replace(/\D/g, "")}`;

    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({
        success: false,
        error: "Du må koble Facebook/Instagram til Role Room før du kan hente ads attribution-data.",
        connectRequired: true,
      });
    }
    const connection = connections[0];

    const fields = [
      "impressions",
      "clicks",
      "spend",
      "cpc",
      "cpm",
      "ctr",
      "reach",
      "frequency",
      "actions",
      "action_values",
    ].join(",");
    const graphVersion = "v21.0";
    const graphUrl = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(adAccountId)}/insights?${new URLSearchParams({
      fields,
      date_preset: "last_7d",
      action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
      access_token: connection.accessToken,
    })}`;

    try {
      const response = await fetch(graphUrl, { method: "GET" });
      const text = await response.text();
      let payload: Record<string, unknown> | null = null;
      try { payload = JSON.parse(text) as Record<string, unknown>; } catch { /* keep raw */ }

      if (!response.ok) {
        console.error(`[ads-attribution-inspect] graph status=${response.status} body=${text.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (payload?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(response.status === 400 ? 422 : response.status).json({
          success: false,
          error: typeof errObj?.message === "string"
            ? `Meta Graph API: ${errObj.message}`
            : `Meta Graph API returnerte ${response.status}.`,
          graphStatus: response.status,
          graphError: errObj,
        });
      }
      if (!payload) {
        return res.status(502).json({ success: false, error: "Uventet respons fra Meta Graph API." });
      }

      const dataArray = Array.isArray(payload.data) ? payload.data : [];
      const firstRow = (dataArray[0] as Record<string, unknown> | undefined) ?? null;

      return res.json({
        success: true,
        insights: firstRow ? {
          impressions: typeof firstRow.impressions === "string" ? Number(firstRow.impressions) : null,
          clicks: typeof firstRow.clicks === "string" ? Number(firstRow.clicks) : null,
          spend: typeof firstRow.spend === "string" ? Number(firstRow.spend) : null,
          cpc: typeof firstRow.cpc === "string" ? Number(firstRow.cpc) : null,
          cpm: typeof firstRow.cpm === "string" ? Number(firstRow.cpm) : null,
          ctr: typeof firstRow.ctr === "string" ? Number(firstRow.ctr) : null,
          reach: typeof firstRow.reach === "string" ? Number(firstRow.reach) : null,
          frequency: typeof firstRow.frequency === "string" ? Number(firstRow.frequency) : null,
          actions: Array.isArray(firstRow.actions) ? firstRow.actions : null,
          actionValues: Array.isArray(firstRow.action_values) ? firstRow.action_values : null,
        } : null,
        meta: {
          resolvedFrom: rawInput,
          resolvedTo: adAccountId,
          graphVersion,
          datePreset: "last_7d",
          attributionWindows: ["7d_click", "1d_view"],
        },
      });
    } catch (err) {
      console.error(`[ads-attribution-inspect] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

}
