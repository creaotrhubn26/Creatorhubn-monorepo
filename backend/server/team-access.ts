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
    // Hent profesjon + e-post i én spørring (e-post brukes til fallback under).
    const u = await pool.query(
      `SELECT profession, LOWER(email) AS email FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (String(u.rows[0]?.profession || "").toLowerCase() === "enterprise") return true;
    const email = u.rows[0]?.email ? String(u.rows[0].email) : null;
    // Aktivt org-medlemskap på user_id ELLER e-post. E-post-fallback speiler
    // GET /api/enterprise/my-membership: provisjonering setter ofte kun `email`
    // (invitert som betalt/aktiv) FØR raden kobles til en users-record, og uten
    // dette ville de fått 403 fra de nylig gatede endepunktene.
    const m = await pool.query(
      `SELECT 1 FROM enterprise_team_members
        WHERE status = 'active'
          AND (user_id = $1 OR ($2::text IS NOT NULL AND LOWER(email) = $2))
        LIMIT 1`,
      [userId, email],
    );
    return (m.rowCount ?? 0) > 0;
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
