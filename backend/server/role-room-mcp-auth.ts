/**
 * role-room-mcp-auth.ts — autentisering for The Role Room MCP-server.
 *
 * Gjenbruker de SAMME sikkerhets-primitivene som Integration v1-API-et
 * (rri_-nøkler, scope-hierarki, konto-status) — kun oppslaget er speilet her
 * fordi MCP-transporten (JSON-RPC) trenger et rent resultat i stedet for
 * Express-middleware. Ingen ny scope-/hash-logikk: alt kommer fra v1-modulen.
 */

import type { Pool } from "pg";
import {
  hashApiKey,
  parseScopes,
  resolveEffectiveScopes,
  ensureIntegrationPhase2Tables,
  type IntegrationUserContext,
} from "./role-room-integrations-v1-routes.js";

export type McpAuthResult =
  | { ok: true; user: IntegrationUserContext }
  | { ok: false; status: number; code: string; message: string };

/**
 * Slår opp en rri_-nøkkel og returnerer integrasjons-konteksten (konto, bruker,
 * effektive scopes, rate-limit). Speiler v1-middlewarens oppslag: konto-nøkler
 * først, så eldre `role_room_api_keys`. Ingen scope-krav her — kalleren sjekker
 * per-verktøy-scope med `hasScope`.
 */
export async function authenticateMcpKey(pool: Pool, rawKey: string | undefined): Promise<McpAuthResult> {
  if (typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return { ok: false, status: 401, code: "missing_api_key", message: "En Role Room integrasjons-API-nøkkel (rri_…) kreves." };
  }
  const keyHash = hashApiKey(rawKey.trim());
  await ensureIntegrationPhase2Tables(pool);

  // 1) Integrasjons-konto-nøkkel (ny modell)
  const accountKeyResult = await pool.query(
    `SELECT k.id, k.integration_account_id, k.label, k.created_for_user_id, k.scopes,
            a.slug AS account_slug, a.name AS account_name, a.status AS account_status,
            a.allowed_scopes, a.rate_limit_per_minute
       FROM role_room_integration_api_keys k
       JOIN role_room_integration_accounts a ON a.id = k.integration_account_id
      WHERE k.key_hash = $1 AND k.is_active = TRUE
        AND (k.expires_at IS NULL OR k.expires_at > NOW())
      LIMIT 1`,
    [keyHash],
  );

  if (Number(accountKeyResult.rowCount ?? 0) > 0) {
    const row = accountKeyResult.rows[0] as Record<string, unknown>;
    if (row.account_status !== "active") {
      return { ok: false, status: 403, code: "integration_account_inactive", message: "Integrasjonskontoen er ikke aktiv." };
    }
    const scopes = resolveEffectiveScopes(parseScopes(row.scopes), parseScopes(row.allowed_scopes));
    await pool.query("UPDATE role_room_integration_api_keys SET last_used_at = NOW() WHERE id = $1", [row.id]);
    return {
      ok: true,
      user: {
        apiKeyId: String(row.id),
        apiKeyName: String(row.label ?? ""),
        userId: String(row.created_for_user_id ?? ""),
        scopes,
        accountId: (row.integration_account_id as string) ?? null,
        accountSlug: (row.account_slug as string) ?? null,
        accountName: (row.account_name as string) ?? null,
        rateLimitPerMinute: Number(row.rate_limit_per_minute ?? 120),
        isLegacyKey: false,
      },
    };
  }

  // 2) Eldre nøkkel (bakover-kompatibel)
  const legacyResult = await pool.query(
    `SELECT * FROM role_room_api_keys
      WHERE key_hash = $1 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [keyHash],
  );
  if (Number(legacyResult.rowCount ?? 0) === 0) {
    return { ok: false, status: 403, code: "invalid_api_key", message: "API-nøkkelen er ugyldig eller utløpt." };
  }
  const apiKey = legacyResult.rows[0] as Record<string, unknown>;
  await pool.query("UPDATE role_room_api_keys SET last_used_at = NOW() WHERE id = $1", [apiKey.id]);
  return {
    ok: true,
    user: {
      apiKeyId: String(apiKey.id),
      apiKeyName: String(apiKey.name ?? ""),
      userId: String(apiKey.user_id ?? ""),
      scopes: parseScopes(apiKey.scopes),
      rateLimitPerMinute: 120,
      isLegacyKey: true,
    },
  };
}

/**
 * Prosjekt-tilgang: eier ELLER aktivt medlem i casting_user_roles. Fail-closed.
 * Samme regel som resten av Role Room bruker (owner OR casting_user_roles).
 */
export async function mcpCanAccessProject(pool: Pool, projectId: string, userId: string): Promise<boolean> {
  if (!projectId || !userId) return false;
  try {
    const r = await pool.query(
      `SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2
       UNION
       SELECT 1 FROM casting_user_roles WHERE project_id = $1 AND user_id = $2 AND deactivated_at IS NULL
       LIMIT 1`,
      [projectId, userId],
    );
    return Number(r.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}
