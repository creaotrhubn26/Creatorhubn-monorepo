/**
 * role-room-project-access.ts
 *
 * Delt tilgangs-vakt for PROSJEKT-scopede økonomi-/ads-endepunkter.
 *
 * Bakgrunn (IDOR): /api/role-room/ads/* (budget, results, recommendations,
 * management-fee-summary) autentiserte kun at KALLEREN var innlogget (apiKeyAuth),
 * men scopet data utelukkende på en kaller-oppgitt `projectId` — uten å sjekke at
 * brukeren faktisk tilhører prosjektet. En hvilken som helst innlogget bruker
 * kunne dermed lese et annet prosjekts annonse-økonomi.
 *
 * Lovlig tilgang = ENTEN:
 *   (a) Produsent/team: bruker er `casting_projects.created_by` ELLER har en
 *       `casting_user_roles`-rad for prosjektet, ELLER
 *   (b) Klient: brukerens e-post matcher en AKTIV `role_room_client_portal_sessions`
 *       for prosjektet (klienten som ble invitert + logget inn).
 * Alle andre innloggede brukere avvises (403).
 */
import type { Pool } from "pg";

export interface ProjectAccessUser {
  userId?: string | null;
  email?: string | null;
}

/** Henter den autentiserte brukeren apiKeyAuth la på req (userId + email). */
export function readProjectAccessUser(req: unknown): ProjectAccessUser | null {
  const apiKeyUser = (req as { apiKeyUser?: ProjectAccessUser } | null)?.apiKeyUser;
  return apiKeyUser ?? null;
}

export async function canAccessProjectAds(
  pool: Pool,
  projectId: string,
  user: ProjectAccessUser | null | undefined,
): Promise<boolean> {
  const userId = user?.userId;
  if (!projectId || !userId) return false;

  // (a) Produsent / team-medlem
  try {
    const member = await pool.query(
      `SELECT 1
         FROM casting_projects cp
         LEFT JOIN casting_user_roles cur
           ON cp.id = cur.project_id AND cur.user_id = $2
        WHERE cp.id = $1
          AND (cp.created_by = $2 OR cur.user_id IS NOT NULL)
        LIMIT 1`,
      [projectId, userId],
    );
    if ((member.rowCount ?? 0) > 0) return true;
  } catch {
    /* tabell-/spørringsfeil → fall videre til klient-sjekk */
  }

  // (b) Klient med aktiv portal-sesjon (e-post-match)
  const email = (user?.email ?? "").trim().toLowerCase();
  if (email) {
    try {
      const client = await pool.query(
        `SELECT 1
           FROM role_room_client_portal_sessions
          WHERE project_id = $1
            AND lower(client_email) = $2
            AND status = 'active'
          LIMIT 1`,
        [projectId, email],
      );
      if ((client.rowCount ?? 0) > 0) return true;
    } catch {
      /* best-effort */
    }
  }

  return false;
}
