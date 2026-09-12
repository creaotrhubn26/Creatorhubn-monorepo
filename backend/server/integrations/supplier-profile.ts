/**
 * supplier-profile.ts — leverandørprofil + «kan vi levere»-vurdering
 *
 * Profilen sier hvilke anbudskrav org-en kan dokumentere (nøklene
 * speiler TENDER_REQUIREMENT_LEXICON). Fit-vurderingen er
 * DETERMINISTISK: krav × profil → har/mangler/ukjent — aldri gjettet.
 *
 * Redelighet: uutfylt profil gir «ukjent», ikke 0 eller 100 — og
 * score beregnes kun over krav profilen faktisk har svart på.
 */

import { z } from "zod";
import { TENDER_REQUIREMENT_LEXICON } from "./sales-trigger-sync.js";

/** Krav som er kapabiliteter (rammeavtale er kontraktsform, ikke evne). */
export const CAPABILITY_KEYS = TENDER_REQUIREMENT_LEXICON
  .map((r) => r.key)
  .filter((k) => k !== "rammeavtale");

export const supplierProfileSchema = z
  .object({
    capabilities: z.record(
      z.enum(CAPABILITY_KEYS as [string, ...string[]]),
      z.boolean(),
    ),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type SupplierProfileInput = z.infer<typeof supplierProfileSchema>;

export interface DeliveryFit {
  have: string[];
  missing: string[];
  unknown: string[];
  /** Andel oppfylte av BESVARTE krav (0–100); null når alt er ubesvart. */
  scorePct: number | null;
}

export function computeDeliveryFit(
  requirements: string[],
  capabilities: Record<string, boolean> | null,
): DeliveryFit {
  const relevant = requirements.filter((r) => CAPABILITY_KEYS.includes(r));
  const have: string[] = [];
  const missing: string[] = [];
  const unknown: string[] = [];
  for (const req of relevant) {
    const answer = capabilities?.[req];
    if (answer === true) have.push(req);
    else if (answer === false) missing.push(req);
    else unknown.push(req);
  }
  const answered = have.length + missing.length;
  return {
    have,
    missing,
    unknown,
    scorePct: answered > 0 ? Math.round((have.length / answered) * 100) : null,
  };
}

export function requirementLabel(key: string): string {
  return TENDER_REQUIREMENT_LEXICON.find((r) => r.key === key)?.label ?? key;
}
