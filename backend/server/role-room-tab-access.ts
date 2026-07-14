/**
 * role-room-tab-access.ts — server-side håndhevelse av Story Arc Studio RBAC.
 *
 * Lederen delegerer per-fane-nivå (Skjult/Se/Administrere) til roller og brukere
 * via `role_room_project_tab_overrides` (se role-room-project-tab-config-routes).
 * Frontend gater UI-et; DETTE er den serverside speilingen for de fanene som har
 * egne data-endepunkter.
 *
 * Semantikk (bevisst begrenset — «security slice», fase 2):
 *   - Lederen (casting_projects.created_by) → alltid 'manage' (kortslutter).
 *   - Eksplisitt overstyring (bruker vinner over rolle) → nivået fra kartet;
 *     fane som mangler i kartet = 'hidden'.
 *   - INGEN eksplisitt overstyring → null = «ingen serverside-begrensning».
 *     Rolle-presets bor kun i frontend (studioAccessModel.ts), så serveren
 *     håndhever KUN lederens eksplisitte delegeringer + leder-supremati. Dette
 *     matcher sikkerhetsventilen i frontend (ukjent/legacy rolle → ingen lås).
 *
 * Fail-open: enhver DB-feil her → null (ingen begrensning). Medlemskaps-porten
 * (canAccessRoleRoomProject) feiler allerede lukket og gjelder FØR dette laget,
 * så en forbigående feil her degraderer til medlemskap-only, ikke utestenging.
 */

import type { Pool } from "pg";

export type TabAccessLevel = "hidden" | "view" | "manage";
type OverrideMap = Record<string, "view" | "manage">;

const RANK: Record<TabAccessLevel, number> = { hidden: 0, view: 1, manage: 2 };

type Resolved =
  | { kind: "leader" }
  | { kind: "none" } // ingen eksplisitt overstyring → ingen serverside-begrensning
  | { kind: "map"; map: OverrideMap };

const cache = new Map<string, { value: Resolved; expires: number }>();
const TTL_MS = 10_000;

/**
 * Normaliser en lagret rad til et nivå-kart. Nyere rader har `tab_access`
 * (nivå-kart); eldre synlighets-rader har kun `tab_values` → full tilgang.
 * Speiler rowToTabAccess i role-room-project-tab-config-routes.
 */
function rowToOverrideMap(tabAccess: unknown, tabValues: unknown): OverrideMap | null {
  if (tabAccess && typeof tabAccess === "object" && !Array.isArray(tabAccess)) {
    const out: OverrideMap = {};
    let n = 0;
    for (const [k, v] of Object.entries(tabAccess as Record<string, unknown>)) {
      if (v === "view" || v === "manage") {
        out[String(k)] = v;
        n += 1;
      }
    }
    if (n > 0) return out;
  }
  if (Array.isArray(tabValues)) {
    const out: OverrideMap = {};
    for (const v of tabValues) if (typeof v === "string") out[v] = "manage";
    return out;
  }
  return null;
}

async function resolve(pool: Pool, projectId: string, viewerId: string): Promise<Resolved> {
  // Leder-supremati — kortslutt før noen overstyrings-oppslag.
  const leader = await pool.query(
    `SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2 LIMIT 1`,
    [projectId, viewerId],
  );
  if ((leader.rowCount ?? 0) > 0) return { kind: "leader" };

  // Bruker-overstyring vinner over rolle-overstyring.
  const userOv = await pool.query(
    `SELECT tab_values, tab_access FROM role_room_project_tab_overrides
      WHERE project_id = $1 AND target_type = 'user' AND target_value = $2 LIMIT 1`,
    [projectId, viewerId],
  );
  if (userOv.rows[0]) {
    const map = rowToOverrideMap(userOv.rows[0].tab_access, userOv.rows[0].tab_values);
    if (map) return { kind: "map", map };
  }

  // Rolle-overstyring.
  const roleRes = await pool.query(
    `SELECT role FROM casting_user_roles
      WHERE project_id = $1 AND user_id = $2 AND deactivated_at IS NULL LIMIT 1`,
    [projectId, viewerId],
  );
  const role: string | null = roleRes.rows[0]?.role ?? null;
  if (role) {
    const roleOv = await pool.query(
      `SELECT tab_values, tab_access FROM role_room_project_tab_overrides
        WHERE project_id = $1 AND target_type = 'role' AND target_value = $2 LIMIT 1`,
      [projectId, role],
    );
    if (roleOv.rows[0]) {
      const map = rowToOverrideMap(roleOv.rows[0].tab_access, roleOv.rows[0].tab_values);
      if (map) return { kind: "map", map };
    }
  }

  return { kind: "none" };
}

/**
 * Effektivt fane-nivå for en bruker. Returnerer null når det ikke finnes noen
 * eksplisitt overstyring (→ ingen serverside-begrensning; presets er frontend).
 */
export async function resolveTabAccessLevel(
  pool: Pool,
  projectId: string,
  viewerId: string,
  tabKey: string,
): Promise<TabAccessLevel | null> {
  if (!projectId || !viewerId || !tabKey) return null;
  const key = `${projectId}|${viewerId}`;
  const now = Date.now();
  const hit = cache.get(key);
  let resolved: Resolved;
  if (hit && hit.expires > now) {
    resolved = hit.value;
  } else {
    try {
      resolved = await resolve(pool, projectId, viewerId);
    } catch (err) {
      console.error("[rr-tab-access] resolve failed (fail-open):", err);
      resolved = { kind: "none" };
    }
    cache.set(key, { value: resolved, expires: now + TTL_MS });
  }
  if (resolved.kind === "leader") return "manage";
  if (resolved.kind === "none") return null;
  return resolved.map[tabKey] ?? "hidden";
}

/**
 * True hvis brukeren møter `need`-nivået for `tabKey`. null-nivå (ingen eksplisitt
 * overstyring) behandles som full tilgang — serveren håndhever kun lederens
 * eksplisitte delegeringer + leder-supremati.
 */
export async function viewerMeetsTabLevel(
  pool: Pool,
  projectId: string,
  viewerId: string,
  tabKey: string,
  need: "view" | "manage",
): Promise<boolean> {
  const level = await resolveTabAccessLevel(pool, projectId, viewerId, tabKey);
  if (level === null) return true;
  return RANK[level] >= RANK[need];
}
