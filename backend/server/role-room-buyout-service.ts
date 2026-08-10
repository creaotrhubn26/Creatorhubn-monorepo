/**
 * role-room-buyout-service.ts
 *
 * Strukturerte buyout-vilkår (Del A punkt 47) og utløpsvarsling for
 * rettigheter (grunnlaget for punkt 46).
 *
 * Vokabularet speiler CHECK-constraintene i migrering 0446. Valideringen her
 * er ikke en erstatning for dem — databasen er siste skanse — men den gir
 * brukbare feilmeldinger framfor en rå constraint-feil, og fanger
 * kombinasjoner før de treffer disk.
 */

import { z } from "zod";
import type { Pool } from "pg";

// ── Vokabular (må matche migrering 0446) ────────────────────────────────────

export const BUYOUT_TERRITORIES = ["norway", "nordics", "europe", "world", "online_only"] as const;
export const BUYOUT_MEDIA_CHANNELS = [
  "tv", "online", "social", "cinema", "print", "ooh", "radio", "instore",
] as const;
export const BUYOUT_EXCLUSIVITY = ["none", "category", "full"] as const;

export const buyoutTermsSchema = z
  .object({
    projectId: z.string().trim().min(1).max(255),
    contractId: z.string().trim().min(1).max(255),
    candidateId: z.string().trim().max(255).nullable().optional(),
    roleId: z.string().trim().max(255).nullable().optional(),

    territories: z.array(z.enum(BUYOUT_TERRITORIES)).default([]),
    territoriesNote: z.string().trim().max(2000).nullable().optional(),
    mediaChannels: z.array(z.enum(BUYOUT_MEDIA_CHANNELS)).default([]),

    startsAt: z.string().trim().nullable().optional(),
    endsAt: z.string().trim().nullable().optional(),
    unlimited: z.boolean().default(false),

    exclusivity: z.enum(BUYOUT_EXCLUSIVITY).default("none"),
    exclusivityCategory: z.string().trim().max(255).nullable().optional(),

    renewalOption: z.boolean().default(false),
    renewalFee: z.number().nonnegative().nullable().optional(),
    renewalNoticeDays: z.number().int().nonnegative().nullable().optional(),

    fee: z.number().nonnegative().nullable().optional(),
    currency: z.string().trim().max(10).default("NOK"),
    notes: z.string().trim().max(10000).nullable().optional(),
  })
  // Speiler rr_buyout_unlimited_has_no_end.
  .refine((v) => !(v.unlimited && v.endsAt), {
    message: "Et evigvarende kjøp kan ikke ha sluttdato.",
    path: ["endsAt"],
  })
  // Speiler rr_buyout_category_requires_name.
  .refine((v) => v.exclusivity !== "category" || !!v.exclusivityCategory?.trim(), {
    message: "Kategori-eksklusivitet krever at kategorien oppgis.",
    path: ["exclusivityCategory"],
  })
  // Speiler rr_buyout_renewal_fields_need_option.
  .refine((v) => v.renewalOption || (v.renewalFee == null && v.renewalNoticeDays == null), {
    message: "Opsjonsvilkår krever at opsjon er avtalt.",
    path: ["renewalOption"],
  })
  // Speiler rr_buyout_period_order.
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, {
    message: "Sluttdato kan ikke være før startdato.",
    path: ["endsAt"],
  });

export type BuyoutTermsInput = z.infer<typeof buyoutTermsSchema>;

/**
 * Skriver vilkårene. Ett sett per kontrakt — gjentatt skriving oppdaterer
 * framfor å legge på en ny rad, slik at «hva gjelder nå» alltid er entydig.
 */
export async function upsertBuyoutTerms(
  pool: Pool,
  input: BuyoutTermsInput,
  createdBy: string | null,
): Promise<{ id: string }> {
  const v = buyoutTermsSchema.parse(input);
  const r = await pool.query<{ id: string }>(
    `INSERT INTO role_room_buyout_terms (
       project_id, contract_id, candidate_id, role_id,
       territories, territories_note, media_channels,
       starts_at, ends_at, unlimited,
       exclusivity, exclusivity_category,
       renewal_option, renewal_fee, renewal_notice_days,
       fee, currency, notes, created_by
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
     )
     ON CONFLICT (project_id, contract_id) DO UPDATE SET
       candidate_id = EXCLUDED.candidate_id,
       role_id = EXCLUDED.role_id,
       territories = EXCLUDED.territories,
       territories_note = EXCLUDED.territories_note,
       media_channels = EXCLUDED.media_channels,
       starts_at = EXCLUDED.starts_at,
       ends_at = EXCLUDED.ends_at,
       unlimited = EXCLUDED.unlimited,
       exclusivity = EXCLUDED.exclusivity,
       exclusivity_category = EXCLUDED.exclusivity_category,
       renewal_option = EXCLUDED.renewal_option,
       renewal_fee = EXCLUDED.renewal_fee,
       renewal_notice_days = EXCLUDED.renewal_notice_days,
       fee = EXCLUDED.fee,
       currency = EXCLUDED.currency,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING id`,
    [
      v.projectId, v.contractId, v.candidateId ?? null, v.roleId ?? null,
      v.territories, v.territoriesNote ?? null, v.mediaChannels,
      v.startsAt ?? null, v.endsAt ?? null, v.unlimited,
      v.exclusivity, v.exclusivityCategory ?? null,
      v.renewalOption, v.renewalFee ?? null, v.renewalNoticeDays ?? null,
      v.fee ?? null, v.currency, v.notes ?? null, createdBy,
    ],
  );
  return { id: r.rows[0].id };
}

export interface ExpiringRight {
  id: string;
  project_id: string;
  contract_id: string;
  candidate_id: string | null;
  ends_at: string;
  days_remaining: number;
  renewal_option: boolean;
  renewal_notice_days: number | null;
  /** True når opsjonsfristen er i ferd med å gå ut — da haster det mest. */
  renewal_deadline_passed: boolean;
  territories: string[];
  media_channels: string[];
}

/**
 * Rettigheter som utløper innen `withinDays`. Dette er kjernen i punkt 46:
 * at materiale ligger ute etter at retten gikk ut er et dyrt bransjeproblem,
 * og det oppdages normalt først når noen klager.
 *
 * Evigvarende kjøp utelates — de utløper aldri. Allerede utløpte tas med
 * (negative `days_remaining`), fordi de er de mest akutte.
 */
export async function listExpiringRights(
  pool: Pool,
  options: { projectId?: string; withinDays?: number; limit?: number } = {},
): Promise<ExpiringRight[]> {
  const withinDays = Number.isFinite(Number(options.withinDays))
    ? Math.max(0, Math.floor(Number(options.withinDays)))
    : 90;
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);

  const params: unknown[] = [String(withinDays)];
  let scope = "";
  if (options.projectId) {
    params.push(options.projectId);
    scope = `AND project_id = $${params.length}`;
  }
  params.push(limit);

  const r = await pool.query(
    `SELECT id, project_id, contract_id, candidate_id, ends_at,
            (ends_at - CURRENT_DATE) AS days_remaining,
            renewal_option, renewal_notice_days,
            -- Opsjonen må utøves renewal_notice_days FØR utløp; er den
            -- fristen passert, er forlengelse i praksis tapt.
            (renewal_option
              AND renewal_notice_days IS NOT NULL
              AND (ends_at - CURRENT_DATE) < renewal_notice_days) AS renewal_deadline_passed,
            territories, media_channels
       FROM role_room_buyout_terms
      WHERE unlimited = FALSE
        AND ends_at IS NOT NULL
        AND ends_at <= CURRENT_DATE + ($1::text || ' days')::interval
        ${scope}
      ORDER BY ends_at
      LIMIT $${params.length}`,
    params,
  );
  return r.rows as ExpiringRight[];
}
