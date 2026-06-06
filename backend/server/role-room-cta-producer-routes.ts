/**
 * role-room-cta-producer-routes.ts — producer-facing Page CTA button.
 *
 * Lets the content marketer set the client's Facebook Page call-to-action
 * button ("Book nå" / "Ring nå" / "Registrer deg" …) so the Page itself drives
 * lead capture. Real-product surface on top of the pages_manage_cta App Review
 * demo (role-room-pages-cta-routes.ts): same Graph calls, but authenticated
 * with the producer's session + the Page token derived from the connection.
 *
 * Endpoints (requireAdminSession, user-isolated via the connection):
 *   GET  /api/role-room/cta/producer?connectionId=...
 *   POST /api/role-room/cta/producer  { connectionId, ctaType, ctaUrl }
 *
 * Live writes need pages_manage_cta App Review approval; until then the Graph
 * call returns an error which we surface (success:false) for the UI to explain.
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

// Lead-gen-relevant subset offered to producers (Meta supports more).
export const CTA_TYPES = [
  "BOOK_NOW", "CALL_NOW", "SIGN_UP", "GET_QUOTE", "CONTACT_US",
  "LEARN_MORE", "SHOP_NOW", "MESSAGE_PAGE", "GET_DIRECTIONS",
] as const;
type CtaType = (typeof CTA_TYPES)[number];
function isValidCtaType(v: unknown): v is CtaType {
  return typeof v === "string" && (CTA_TYPES as readonly string[]).includes(v);
}

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomCtaProducerRoutesDeps {
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

/** Modern field Meta auto-surfaces as a CTA, for CTA types that map cleanly. */
function modernField(ctaType: string, ctaUrl: string): { name: string; value: string } | null {
  if (ctaType === "CALL_NOW" || ctaType === "BOOK_NOW") {
    return { name: "phone", value: ctaUrl.replace(/^tel:/i, "") };
  }
  if (["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "GET_QUOTE", "GET_DIRECTIONS"].includes(ctaType)) {
    return { name: "website", value: ctaUrl };
  }
  return null;
}

export function setupRoleRoomCtaProducerRoutes(deps: RoleRoomCtaProducerRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/role-room/cta/producer ─────────────────────────────────────
  app.get("/api/role-room/cta/producer", async (req, res) => {
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
      const token = await getPageToken(fresh);
      const params = new URLSearchParams({ fields: "id,name,phone,website", access_token: token });
      const r = await fetch(`${GRAPH}/${encodeURIComponent(fresh.facebookPageId)}?${params.toString()}`);
      const body = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (!r.ok) {
        res.status(200).json({ success: false, error: body?.error?.message || `Graph ${r.status}` });
        return;
      }
      res.json({
        success: true,
        pageName: body.name ?? fresh.facebookPageName,
        phone: body.phone ?? null,
        website: body.website ?? null,
        ctaTypes: CTA_TYPES,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/cta/producer ────────────────────────────────────
  app.post("/api/role-room/cta/producer", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; ctaType?: unknown; ctaUrl?: string };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const ctaType = body.ctaType;
    const ctaUrl = typeof body.ctaUrl === "string" ? body.ctaUrl.trim() : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    if (!isValidCtaType(ctaType)) {
      res.status(400).json({ success: false, error: "invalid ctaType", validValues: CTA_TYPES });
      return;
    }
    if (!ctaUrl) {
      res.status(400).json({ success: false, error: "ctaUrl is required" });
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
      const pageId = fresh.facebookPageId;

      // Legacy cta_type/cta_link (deprecated on modern Pages).
      let legacyOk = false;
      let legacyErr = "";
      try {
        const lp = new URLSearchParams({ cta_type: String(ctaType), cta_link: ctaUrl, access_token: token });
        const lr = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}`, { method: "POST", body: lp });
        const lb = (await lr.json().catch(() => ({}))) as Record<string, any>;
        legacyOk = lr.ok;
        if (!lr.ok) legacyErr = lb?.error?.message || `Graph ${lr.status}`;
      } catch (e) { legacyErr = String(e); }

      // Modern field that Meta auto-surfaces as a CTA.
      let modernOk = false;
      let modernErr = "";
      const mf = modernField(String(ctaType), ctaUrl);
      if (mf) {
        try {
          const mp = new URLSearchParams({ [mf.name]: mf.value, access_token: token });
          const mr = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}`, { method: "POST", body: mp });
          const mb = (await mr.json().catch(() => ({}))) as Record<string, any>;
          modernOk = mr.ok;
          if (!mr.ok) modernErr = mb?.error?.message || `Graph ${mr.status}`;
        } catch (e) { modernErr = String(e); }
      }

      const success = legacyOk || modernOk;
      res.status(200).json({
        success,
        ctaType,
        ctaUrl,
        error: success ? null : (legacyErr || modernErr || "Kunne ikke sette CTA."),
        note: legacyOk
          ? "CTA satt via Meta sitt CTA-API."
          : modernOk
            ? "Meta sitt CTA-API er utfaset; tilsvarende felt (telefon/nettside) ble satt og vises automatisk som CTA-knapp."
            : null,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
