/**
 * role-room-events-producer-routes.ts — producer-facing Instagram events.
 *
 * Lets the content marketer publish Instagram events on the client's connected
 * IG Business account (open house, gratis-konsultasjon-dag, webinar, launch),
 * so followers can RSVP / mark interested — an event-driven lead source. Real-
 * product surface on top of the instagram_manage_events App Review demo
 * (role-room-ig-events-routes.ts): same Graph calls, authenticated with the
 * producer's session + the Page token derived from the connection; the IG
 * user_id is the connection's IG Business account.
 *
 * Endpoints (requireAdminSession, user-isolated via the connection):
 *   GET    /api/role-room/events/producer?connectionId=...
 *   POST   /api/role-room/events/producer   { connectionId, name, startTime, endTime?, description?, placeName? }
 *   DELETE /api/role-room/events/producer/:eventId?connectionId=...
 *
 * Live writes need instagram_manage_events approval; until then the Graph call
 * returns an error which we surface (success:false) for the UI to explain.
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
const EVENT_FIELDS = "id,title,start_time,end_time,description,venue";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomEventsProducerRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

async function getPageToken(connection: InstagramConnectionRow): Promise<string> {
  try {
    const url =
      `${GRAPH}/${encodeURIComponent(connection.facebookPageId)}` +
      `?fields=access_token&access_token=${encodeURIComponent(connection.accessToken)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (res.ok && json.access_token) return json.access_token;
  } catch {
    /* fall through */
  }
  return connection.accessToken;
}

/** Accept ISO 8601 (from <input type=datetime-local>) or epoch; return epoch seconds. */
function toUnix(s: string): string {
  if (/^\d+$/.test(s)) return s;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : s;
}

export function setupRoleRoomEventsProducerRoutes(deps: RoleRoomEventsProducerRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/role-room/events/producer ──────────────────────────────────
  app.get("/api/role-room/events/producer", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const userId = fresh.igBusinessAccountId;
      if (!userId) {
        res.status(200).json({ success: false, error: "Tilkoblingen mangler en Instagram-bedriftskonto.", events: [] });
        return;
      }
      const token = await getPageToken(fresh);
      const params = new URLSearchParams({ fields: EVENT_FIELDS, access_token: token });
      const r = await fetch(`${GRAPH}/${encodeURIComponent(userId)}/upcoming_events?${params.toString()}`);
      const body = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (!r.ok) {
        res.status(200).json({ success: false, error: body?.error?.message || `Graph ${r.status}`, events: [] });
        return;
      }
      const data = Array.isArray(body.data) ? body.data : [];
      res.json({
        success: true,
        events: data.map((e: Record<string, any>) => ({
          id: e.id,
          title: e.title ?? null,
          startTime: e.start_time ?? null,
          endTime: e.end_time ?? null,
          description: e.description ?? null,
          venue: e.venue?.name ?? (typeof e.venue === "string" ? e.venue : null),
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/events/producer ─────────────────────────────────
  app.post("/api/role-room/events/producer", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      connectionId?: string; name?: string; startTime?: string;
      endTime?: string; description?: string; placeName?: string;
    };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
    if (!connectionId || !name || !startTime) {
      res.status(400).json({ success: false, error: "connectionId, name and startTime are required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const userId = fresh.igBusinessAccountId;
      if (!userId) {
        res.status(200).json({ success: false, error: "Tilkoblingen mangler en Instagram-bedriftskonto." });
        return;
      }
      const token = await getPageToken(fresh);
      const form = new URLSearchParams({ title: name, start_time: toUnix(startTime), access_token: token });
      if (typeof body.endTime === "string" && body.endTime.trim()) form.set("end_time", toUnix(body.endTime.trim()));
      if (typeof body.description === "string" && body.description.trim()) form.set("description", body.description.trim());
      if (typeof body.placeName === "string" && body.placeName.trim()) form.set("venue_name", body.placeName.trim());
      const r = await fetch(`${GRAPH}/${encodeURIComponent(userId)}/upcoming_events`, { method: "POST", body: form });
      const rb = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (!r.ok) {
        res.status(200).json({ success: false, error: rb?.error?.message || `Graph ${r.status}` });
        return;
      }
      res.json({ success: true, id: rb.id ?? null });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── DELETE /api/role-room/events/producer/:eventId ──────────────────────
  app.delete("/api/role-room/events/producer/:eventId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const eventId = req.params.eventId;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId || !eventId) {
      res.status(400).json({ success: false, error: "connectionId and eventId are required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const token = await getPageToken(fresh);
      const r = await fetch(`${GRAPH}/${encodeURIComponent(eventId)}?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
      const rb = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (!r.ok) {
        res.status(200).json({ success: false, error: rb?.error?.message || `Graph ${r.status}` });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
