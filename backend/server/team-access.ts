/**
 * team-access.ts — server-side håndhevelse av team-/Enterprise-gating.
 *
 * Frontend skjuler team-/samarbeids-UI (band-roster, invitér bidragsytere,
 * collaborator-sync, EaseVerse-band) bak `useTeamAccess`, men det er kun
 * kosmetisk — de muterende endepunktene må selv nekte ikke-Enterprise-brukere,
 * ellers omgås betalingsmuren med et direkte API-kall.
 *
 * Én kilde til sannhet, speiler GET /api/enterprise/my-membership og
 * useTeamAccess: aktivt org-medlemskap (enterprise_team_members) ELLER
 * enterprise-profesjonen. Fail-closed: enhver feil → ingen tilgang.
 */
import type { Pool } from "pg";

export async function hasActiveTeamAccess(
  pool: Pool,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const m = await pool.query(
      `SELECT 1 FROM enterprise_team_members
        WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId],
    );
    if ((m.rowCount ?? 0) > 0) return true;
    const u = await pool.query(
      `SELECT profession FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return String(u.rows[0]?.profession || "").toLowerCase() === "enterprise";
  } catch {
    return false;
  }
}

/**
 * Express-hjelper: nekter med 403 hvis brukeren mangler team-tilgang.
 * Returnerer true hvis kallet skal fortsette, false hvis 403 er sendt.
 */
export async function requireTeamAccess(
  pool: Pool,
  userId: string | null | undefined,
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
): Promise<boolean> {
  if (await hasActiveTeamAccess(pool, userId)) return true;
  res.status(403).json({
    error: "enterprise_required",
    message: "Team-/samarbeidsfunksjoner krever Enterprise.",
  });
  return false;
}
