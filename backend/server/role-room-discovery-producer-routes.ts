/**
 * role-room-discovery-producer-routes.ts — producer-facing discovery / research.
 *
 * "Research-boost" — turns three App Review demos into one real producer
 * feature so the content marketer can do competitor/partner/content research:
 *   - IG hashtag search + recent media (Instagram Public Content Access)
 *   - IG business discovery by @username (Instagram Public Content Access)
 *   - Facebook Page public metadata + recent posts (Page Public Content/Metadata)
 *
 * Authenticated with the producer's session + the Page token derived from the
 * stored connection (instead of an app/pasted token). The IG user_id is the
 * connection's IG Business account.
 *
 * Endpoints (requireAdminSession, user-isolated via the connection):
 *   GET /api/role-room/discovery/hashtag?connectionId=...&q=...
 *   GET /api/role-room/discovery/ig-profile?connectionId=...&username=...
 *   GET /api/role-room/discovery/fb-page?connectionId=...&pageId=...
 *
 * Live data needs Public Content Access App Review approval; until then the
 * Graph call returns an error which we surface (success:false) for the UI.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  getConnection,
  ensureFreshConnection,
  META_GRAPH_API_VERSION,
  type InstagramConnectionRow,
} from "./role-room-instagram-oauth.js";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const IG_MEDIA_FIELDS = "id,caption,media_type,permalink,timestamp";
const PAGE_FIELDS = "id,name,about,category,fan_count,verification_status,website,description";
const PAGE_POST_FIELDS = "id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true)";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomDiscoveryProducerRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

/** Derive a Page access token from the stored long-lived user token. */
async function getPageToken(connection: InstagramConnectionRow): Promise<string> {
  try {
    const url =
      `${GRAPH}/${encodeURIComponent(connection.facebookPageId)}` +
      `?fields=access_token&access_token=${encodeURIComponent(connection.accessToken)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (res.ok && json.access_token) return json.access_token;
  } catch {
    /* fall through to user token */
  }
  return connection.accessToken;
}

function graphErr(body: Record<string, any>, status: number): string {
  return body?.error?.message || `Graph ${status}`;
}

export function setupRoleRoomDiscoveryProducerRoutes(deps: RoleRoomDiscoveryProducerRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // Resolve + authorize a connection for the session; returns {fresh, token} or null (response sent).
  async function resolve(req: express.Request, res: express.Response) {
    const session = requireAdminSession(req, res);
    if (!session) return null;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return null;
    }
    const connection = await getConnection(pool, connectionId, session.userId);
    if (!connection) {
      res.status(404).json({ success: false, error: "connection_not_found" });
      return null;
    }
    const fresh = await ensureFreshConnection(pool, connection);
    const token = await getPageToken(fresh);
    return { fresh, token };
  }

  // ── GET /api/role-room/discovery/hashtag ────────────────────────────────
  // Hashtag → recent public media in the client's niche (content inspiration).
  app.get("/api/role-room/discovery/hashtag", async (req, res) => {
    const q = (typeof req.query.q === "string" ? req.query.q : "").trim().replace(/^#/, "");
    if (!q) {
      res.status(400).json({ success: false, error: "q (hashtag) is required" });
      return;
    }
    try {
      const ctx = await resolve(req, res);
      if (!ctx) return;
      const userId = ctx.fresh.igBusinessAccountId;
      if (!userId) {
        res.status(200).json({ success: false, error: "Tilkoblingen mangler en Instagram-bedriftskonto." });
        return;
      }
      // 1) hashtag id
      const sp = new URLSearchParams({ user_id: userId, q, access_token: ctx.token });
      const sRes = await fetch(`${GRAPH}/ig_hashtag_search?${sp.toString()}`);
      const sBody = (await sRes.json().catch(() => ({}))) as Record<string, any>;
      if (!sRes.ok || !Array.isArray(sBody.data) || !sBody.data[0]?.id) {
        res.status(200).json({ success: false, error: sRes.ok ? "Fant ikke emneknaggen." : graphErr(sBody, sRes.status), media: [] });
        return;
      }
      const hashtagId = String(sBody.data[0].id);
      // 2) recent media
      const mp = new URLSearchParams({ user_id: userId, fields: IG_MEDIA_FIELDS, access_token: ctx.token, limit: "24" });
      const mRes = await fetch(`${GRAPH}/${encodeURIComponent(hashtagId)}/recent_media?${mp.toString()}`);
      const mBody = (await mRes.json().catch(() => ({}))) as Record<string, any>;
      if (!mRes.ok) {
        res.status(200).json({ success: false, error: graphErr(mBody, mRes.status), media: [] });
        return;
      }
      const data = Array.isArray(mBody.data) ? mBody.data : [];
      res.json({
        success: true,
        hashtag: q,
        media: data.map((m: Record<string, any>) => ({
          id: m.id,
          caption: m.caption ?? null,
          mediaType: m.media_type ?? null,
          permalink: m.permalink ?? null,
          timestamp: m.timestamp ?? null,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── GET /api/role-room/discovery/ig-profile ─────────────────────────────
  // Competitor IG profile (business discovery) by @username.
  app.get("/api/role-room/discovery/ig-profile", async (req, res) => {
    const username = (typeof req.query.username === "string" ? req.query.username : "").trim().replace(/^@/, "");
    if (!username) {
      res.status(400).json({ success: false, error: "username is required" });
      return;
    }
    try {
      const ctx = await resolve(req, res);
      if (!ctx) return;
      const userId = ctx.fresh.igBusinessAccountId;
      if (!userId) {
        res.status(200).json({ success: false, error: "Tilkoblingen mangler en Instagram-bedriftskonto." });
        return;
      }
      const fields = `business_discovery.username(${username}){username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website,media.limit(9){${IG_MEDIA_FIELDS}}}`;
      const sp = new URLSearchParams({ fields, access_token: ctx.token });
      const r = await fetch(`${GRAPH}/${encodeURIComponent(userId)}?${sp.toString()}`);
      const body = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (!r.ok || !body.business_discovery) {
        res.status(200).json({ success: false, error: r.ok ? "Fant ikke profilen (må være en bedrifts-/skaperkonto)." : graphErr(body, r.status) });
        return;
      }
      const bd = body.business_discovery;
      res.json({
        success: true,
        profile: {
          username: bd.username ?? username,
          name: bd.name ?? null,
          profilePictureUrl: bd.profile_picture_url ?? null,
          followersCount: bd.followers_count ?? null,
          followsCount: bd.follows_count ?? null,
          mediaCount: bd.media_count ?? null,
          biography: bd.biography ?? null,
          website: bd.website ?? null,
          media: Array.isArray(bd.media?.data)
            ? bd.media.data.map((m: Record<string, any>) => ({
                id: m.id, caption: m.caption ?? null, mediaType: m.media_type ?? null,
                permalink: m.permalink ?? null, timestamp: m.timestamp ?? null,
              }))
            : [],
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── GET /api/role-room/discovery/fb-page ────────────────────────────────
  // Public Facebook Page metadata + recent posts (partner/competitor research).
  app.get("/api/role-room/discovery/fb-page", async (req, res) => {
    const pageId = (typeof req.query.pageId === "string" ? req.query.pageId : "").trim();
    if (!pageId) {
      res.status(400).json({ success: false, error: "pageId is required" });
      return;
    }
    try {
      const ctx = await resolve(req, res);
      if (!ctx) return;
      const pp = new URLSearchParams({ fields: PAGE_FIELDS, access_token: ctx.token });
      const pRes = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}?${pp.toString()}`);
      const pBody = (await pRes.json().catch(() => ({}))) as Record<string, any>;
      if (!pRes.ok) {
        res.status(200).json({ success: false, error: graphErr(pBody, pRes.status) });
        return;
      }
      const op = new URLSearchParams({ fields: PAGE_POST_FIELDS, access_token: ctx.token, limit: "10" });
      const oRes = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/posts?${op.toString()}`);
      const oBody = (await oRes.json().catch(() => ({}))) as Record<string, any>;
      const posts = oRes.ok && Array.isArray(oBody.data) ? oBody.data : [];
      res.json({
        success: true,
        page: {
          id: pBody.id ?? pageId,
          name: pBody.name ?? null,
          about: pBody.about ?? pBody.description ?? null,
          category: pBody.category ?? null,
          fanCount: typeof pBody.fan_count === "number" ? pBody.fan_count : null,
          verified: pBody.verification_status ?? null,
          website: pBody.website ?? null,
        },
        posts: posts.map((p: Record<string, any>) => ({
          id: p.id,
          message: p.message ?? null,
          createdTime: p.created_time ?? null,
          permalinkUrl: p.permalink_url ?? null,
          reactions: p.reactions?.summary?.total_count ?? null,
          comments: p.comments?.summary?.total_count ?? null,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
