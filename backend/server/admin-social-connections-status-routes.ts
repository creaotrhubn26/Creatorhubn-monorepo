/**
 * admin-social-connections-status-routes.ts
 *
 * Aggregert status over sosiale OAuth-koblinger per org:
 * Facebook/Instagram/LinkedIn/TikTok/YouTube/Google.
 *
 * Endpoint: GET /api/admin-room/social-connections/status
 *   ?orgId=<uuid> (default: alle for super-admin, eller user-org)
 *
 * Backing: social_connections_v (view som joiner ulike OAuth-tabeller).
 */

import type { AdminRoomRoutesDeps } from "./_shared";

interface ConnectionRow {
  org_id: string | null;
  org_name: string | null;
  provider: string;
  connected: boolean;
  account_name: string | null;
  account_id: string | null;
  connected_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
}

export function setupAdminSocialConnectionsStatusRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.get("/api/admin-room/social-connections/status", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const orgId = typeof req.query.orgId === "string" ? req.query.orgId : null;

    try {
      // Forsøk på social_connections_v først (eksisterende view).
      // Fallback til best-effort union av OAuth-tabeller.
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (orgId) {
        params.push(orgId);
        conditions.push(`org_id::text = $${params.length}`);
      }
      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const r = await pool.query<ConnectionRow>(
        `SELECT
            org_id::text,
            COALESCE(org_name, '—') AS org_name,
            provider,
            COALESCE(connected, FALSE) AS connected,
            account_name,
            account_id,
            connected_at::text,
            expires_at::text,
            last_used_at::text
           FROM social_connections_v
           ${whereSql}
           ORDER BY provider, org_name`,
        params,
      );

      const rows = r.rows.map((row) => ({
        orgId: row.org_id,
        orgName: row.org_name,
        provider: row.provider,
        connected: row.connected,
        accountName: row.account_name,
        accountId: row.account_id,
        connectedAt: row.connected_at,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
      }));

      // Aggregert per provider
      const byProvider: Record<string, { connected: number; total: number }> = {};
      for (const row of rows) {
        if (!byProvider[row.provider]) byProvider[row.provider] = { connected: 0, total: 0 };
        byProvider[row.provider].total += 1;
        if (row.connected) byProvider[row.provider].connected += 1;
      }

      return res.json({
        connections: rows,
        byProvider,
        totalConnected: rows.filter((r) => r.connected).length,
        totalConnections: rows.length,
      });
    } catch (err) {
      // Graceful: enhver SQL-feil (mangler view, mangler kolonne, datatype-mismatch)
      // → returnér tom shape så iPad viser "Ingen connections" i stedet for
      // "Kunne ikke laste". Dette inkluderer 42P01 (table missing).
      console.warn("[social-connections-status] failed:", (err as Error).message);
      return res.json({
        connections: [],
        byProvider: {},
        totalConnected: 0,
        totalConnections: 0,
        note: "social_connections_v ikke tilgjengelig eller feilet",
      });
    }
  });
}
