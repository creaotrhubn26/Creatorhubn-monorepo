/**
 * role-room-leads-producer-routes.ts — producer-facing Meta Lead Ads retrieval.
 *
 * Lets the content marketer pull the CLIENT's lead-gen leads (Meta Lead Ads)
 * for a connected Page, so they can deliver leads to the customer. This is the
 * real-product surface on top of the App Review demo
 * (role-room-leads-retrieval-routes.ts): same Graph calls, but authenticated
 * with the producer's session + the Page token derived from the stored
 * connection (instead of a pasted token).
 *
 * Endpoints (requireAdminSession, user-isolated via the connection):
 *   GET /api/role-room/leads/producer/forms?connectionId=...
 *     → /v21.0/{page-id}/leadgen_forms
 *   GET /api/role-room/leads/producer/leads?connectionId=...&formId=...&limit=...
 *     → /v21.0/{form-id}/leads
 *
 * Note: live data requires leads_retrieval App Review approval; until then the
 * Graph call returns an error which we surface (success:false) for the UI to
 * explain gracefully.
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
const FORM_FIELDS = "id,name,status,leads_count,created_time";
const LEAD_FIELDS = "id,created_time,ad_id,form_id,field_data";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomLeadsProducerRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

// Lead segments for retargeting: warm / lukewarm / cold / lost (+ unset).
export type LeadSegment = "varm" | "lunken" | "kald" | "tapt";
const VALID_SEGMENTS: LeadSegment[] = ["varm", "lunken", "kald", "tapt"];

let leadSegmentSchemaReady = false;
async function ensureLeadSegmentSchema(pool: Pool): Promise<void> {
  if (leadSegmentSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_lead_segments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      lead_external_id TEXT NOT NULL,
      segment TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, lead_external_id)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_rr_lead_segments_user ON role_room_lead_segments(user_id, connection_id);`,
  );
  leadSegmentSchemaReady = true;
}

/** Map of lead_external_id → segment for the given user. */
async function fetchSegments(pool: Pool, userId: string, leadIds: string[]): Promise<Record<string, string>> {
  if (leadIds.length === 0) return {};
  const result = await pool.query(
    `SELECT lead_external_id, segment FROM role_room_lead_segments
       WHERE user_id = $1 AND lead_external_id = ANY($2::text[])`,
    [userId, leadIds],
  );
  const map: Record<string, string> = {};
  for (const row of result.rows) map[String(row.lead_external_id)] = String(row.segment);
  return map;
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

export function setupRoleRoomLeadsProducerRoutes(deps: RoleRoomLeadsProducerRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/role-room/leads/producer/forms ─────────────────────────────
  app.get("/api/role-room/leads/producer/forms", async (req, res) => {
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
      const pageToken = await getPageToken(fresh);
      const params = new URLSearchParams({ fields: FORM_FIELDS, access_token: pageToken });
      const upstream = await fetch(
        `${GRAPH}/${encodeURIComponent(fresh.facebookPageId)}/leadgen_forms?${params.toString()}`,
      );
      const body = (await upstream.json().catch(() => ({}))) as Record<string, any>;
      if (!upstream.ok) {
        res.status(200).json({
          success: false,
          error: body?.error?.message || `Graph ${upstream.status}`,
          forms: [],
        });
        return;
      }
      const data = Array.isArray(body.data) ? body.data : [];
      res.json({
        success: true,
        pageName: fresh.facebookPageName,
        forms: data.map((f: Record<string, any>) => ({
          id: f.id,
          name: f.name ?? "(uten navn)",
          status: f.status ?? null,
          leadsCount: typeof f.leads_count === "number" ? f.leads_count : null,
          createdTime: f.created_time ?? null,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── GET /api/role-room/leads/producer/leads ─────────────────────────────
  app.get("/api/role-room/leads/producer/leads", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    const formId = typeof req.query.formId === "string" ? req.query.formId : "";
    if (!connectionId || !formId) {
      res.status(400).json({ success: false, error: "connectionId and formId are required" });
      return;
    }
    const limit = typeof req.query.limit === "string" ? req.query.limit : "50";
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const pageToken = await getPageToken(fresh);
      const params = new URLSearchParams({ fields: LEAD_FIELDS, limit, access_token: pageToken });
      const upstream = await fetch(
        `${GRAPH}/${encodeURIComponent(formId)}/leads?${params.toString()}`,
      );
      const body = (await upstream.json().catch(() => ({}))) as Record<string, any>;
      if (!upstream.ok) {
        res.status(200).json({
          success: false,
          error: body?.error?.message || `Graph ${upstream.status}`,
          leads: [],
        });
        return;
      }
      const data = Array.isArray(body.data) ? body.data : [];
      await ensureLeadSegmentSchema(pool);
      const segments = await fetchSegments(pool, session.userId, data.map((l: Record<string, any>) => String(l.id)));
      res.json({
        success: true,
        leads: data.map((lead: Record<string, any>) => {
          // field_data is [{name, values:[...]}, …] — flatten to a label→value map.
          const fields: Record<string, string> = {};
          for (const fd of Array.isArray(lead.field_data) ? lead.field_data : []) {
            if (fd?.name) fields[fd.name] = Array.isArray(fd.values) ? fd.values.join(", ") : "";
          }
          return {
            id: lead.id,
            createdTime: lead.created_time ?? null,
            name: fields.full_name || fields.name || null,
            email: fields.email || null,
            phone: fields.phone_number || fields.phone || null,
            segment: segments[String(lead.id)] ?? null,
            fields,
          };
        }),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/segment ──────────────────────────
  // Tag a lead into a retargeting segment (varm/lunken/kald/tapt) or clear it.
  app.post("/api/role-room/leads/producer/segment", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; leadId?: string; segment?: string | null };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    const segment = body.segment;
    if (!connectionId || !leadId) {
      res.status(400).json({ success: false, error: "connectionId and leadId are required" });
      return;
    }
    if (segment !== null && !VALID_SEGMENTS.includes(segment as LeadSegment)) {
      res.status(400).json({ success: false, error: "invalid segment" });
      return;
    }
    try {
      // Verify the connection belongs to this user (isolation).
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadSegmentSchema(pool);
      if (segment === null) {
        await pool.query(
          `DELETE FROM role_room_lead_segments WHERE user_id = $1 AND lead_external_id = $2`,
          [session.userId, leadId],
        );
      } else {
        await pool.query(
          `INSERT INTO role_room_lead_segments (user_id, connection_id, lead_external_id, segment)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, lead_external_id)
           DO UPDATE SET segment = EXCLUDED.segment, connection_id = EXCLUDED.connection_id, updated_at = now()`,
          [session.userId, connectionId, leadId, segment],
        );
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
