import type { Pool } from "pg";

export interface LeadDiscoveryScope {
  ownerUserId: string;
  organizationId: string | null;
  projectId: string;
}

/**
 * Returner Google Place-ID-er som allerede finnes i samme CRM-scope.
 *
 * Organisasjonen er den stabile identiteten ved bruker-/databaseflytting.
 * owner_user_id brukes bare som fallback for eldre kontoer uten org.
 * project_id beholdes i scopet fordi samme bedrift kan være et legitimt
 * prospekt i to ulike salgsprosjekter.
 */
export async function fetchExistingDiscoveryPlaceIds(
  pool: Pool,
  scope: LeadDiscoveryScope,
): Promise<Set<string>> {
  const r = await pool.query<{ google_place_id: string }>(
    `SELECT google_place_id
       FROM crm_customers
      WHERE google_place_id IS NOT NULL
        AND project_id IS NOT DISTINCT FROM $3
        AND (
          ($2::uuid IS NOT NULL AND organization_id = $2::uuid)
          OR ($2::uuid IS NULL AND owner_user_id = $1)
        )`,
    [scope.ownerUserId, scope.organizationId, scope.projectId],
  );
  return new Set(r.rows.map((row) => row.google_place_id));
}
