/**
 * auto-enrichment.ts — nattlig auto-berikelse av CRM-porteføljen
 *
 * Kobler orgnr på alle CRM-selskaper som aldri er beriket (navnesøk m/
 * match-vakt i lead-brreg-service) — og AKTIVERER dermed konkursvakten,
 * IP-vakten og regnskapstallene for hele porteføljen uten manuelle klikk.
 *
 * Redelighet:
 *  - Match-vakten nekter vage navnetreff; auto-koblede merkes
 *    autoLinked i data og «bekreft»-badge i UI.
 *  - Tak per kjøring (rotasjon over netter); allerede forsøkte
 *    (enriched_at satt) re-forsøkes ikke automatisk.
 *  - Én lead-feil stopper ikke resten.
 */

import type { Pool } from "pg";
import { enrichLeadWithBrreg } from "../lead-brreg-service.js";

const MAX_PER_RUN = 50;

export interface AutoEnrichmentResult {
  attempted: number;
  linked: number;
  rejectedByGuard: number;
  notFound: number;
  errors: string[];
}

export async function runAutoEnrichment(pool: Pool): Promise<AutoEnrichmentResult> {
  const candidates = await pool.query<{ id: string; owner_user_id: string }>(
    `SELECT id::text, owner_user_id
       FROM crm_customers
      WHERE organization_id IS NOT NULL
        AND archived_at IS NULL
        AND enrichment_org_nr IS NULL
        AND enriched_at IS NULL
        AND length(name) >= 5
      ORDER BY updated_at DESC
      LIMIT ${MAX_PER_RUN}`,
  );

  let linked = 0;
  let rejectedByGuard = 0;
  let notFound = 0;
  const errors: string[] = [];

  for (const row of candidates.rows) {
    try {
      const result = await enrichLeadWithBrreg(pool, {
        leadId: row.id,
        workspaceOwnerUserId: row.owner_user_id,
        autoMode: true,
      });
      if (result.found) linked += 1;
      else if (result.matchedName) rejectedByGuard += 1;
      else notFound += 1;
    } catch (err) {
      errors.push(`${row.id}: ${String(err).slice(0, 80)}`);
    }
  }

  return { attempted: candidates.rows.length, linked, rejectedByGuard, notFound, errors };
}
