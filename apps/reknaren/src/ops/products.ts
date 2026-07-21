/**
 * Produktlinjer (Creatorhub / The Role Room / Leadgrid) som DIMENSJONER, slik at
 * inntekt kan segmenteres per produkt i regnskapet.
 *
 * Fakturamotoren bærer «project»-dimensjonen på linjenivå, så produktene
 * representeres som prosjektdimensjoner. Stripe-synken tagger hver utkast-linje
 * med produktets kode; når fakturaen utstedes, viser
 * `dimensionResultReport(kind='project')` inntekt (og resultat) per produkt.
 */

import { createDimension } from '../dimensions/service.js';
import { ConflictError } from '../shared/errors.js';
import type { Actor } from '../audit/audit.js';
import type { Db } from '../db/pool.js';

/** Kilde-produkt (fra Stripe) → produktlinje-dimensjon. */
export const PRODUCT_DIMENSIONS: Record<string, { code: string; name: string }> = {
  creatorhub: { code: 'CREATORHUB', name: 'Creatorhub' },
  role_room: { code: 'ROLEROOM', name: 'The Role Room' },
  leadgrid: { code: 'LEADGRID', name: 'Leadgrid' },
};

/** Dimensjonskode for et kilde-produkt, eller null når ukjent/utagget. */
export function productDimensionCode(sourceProduct: string | null): string | null {
  if (!sourceProduct) return null;
  return PRODUCT_DIMENSIONS[sourceProduct]?.code ?? null;
}

/** Idempotent: sikrer at alle produktlinjer finnes som prosjektdimensjoner. */
export async function ensureProductDimensions(
  db: Db,
  organizationId: string,
  actor: Actor,
): Promise<void> {
  for (const { code, name } of Object.values(PRODUCT_DIMENSIONS)) {
    try {
      await createDimension(db, { organizationId, actor, kind: 'project', code, name });
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err; // finnes allerede → idempotent
    }
  }
}
