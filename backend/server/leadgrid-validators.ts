/**
 * leadgrid-validators.ts
 *
 * Zod-skjemaer for de mest brukte Leadgrid-endepunktene. Brukes via
 * `parseOr400(schema, req.body, res)` i route-handlers. Returnerer 400
 * med strukturert `issues`-liste hvis valideringen feiler.
 *
 * Dekker (robusthet-bundle 2):
 *   - POST /api/leadgrid/intelligence/recommendations/:id/execute
 *   - POST /api/leadgrid/leads/:id/meeting-notes/from-text
 *   - POST /api/leadgrid/leads/:id/meeting-notes/upload-audio
 *   - POST /api/leadgrid/routes/plan
 *   - PATCH /api/leadgrid/intelligence/weights
 *   - POST /api/leadgrid/territories
 */

import { z } from "zod";
import type { Response } from "express";

// ─── Felles primitiver ────────────────────────────────────────────────
export const uuidSchema = z.string().uuid();

export const orgIdInput = z.object({
  organization_id: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});

// ─── POST /api/leadgrid/intelligence/recommendations/:id/execute ──────
export const executeRecommendationBody = z.object({
  outcome: z.enum(["positive", "neutral", "negative"]).default("neutral"),
  outcome_notes: z.string().max(2000).optional(),
});
export type ExecuteRecommendationBody = z.infer<typeof executeRecommendationBody>;

// ─── POST /api/leadgrid/leads/:id/meeting-notes/from-text ─────────────
export const fromTextBody = z.object({
  transcript: z.string().min(1).max(50000),
  language: z.enum(["no", "en", "sv", "da"]).default("no"),
});
export type FromTextBody = z.infer<typeof fromTextBody>;

// ─── POST /api/leadgrid/leads/:id/meeting-notes/upload-audio ──────────
export const uploadAudioBody = z.object({
  // base64 av minst ~75 bytes lyd-payload
  audio_base64: z.string().min(100),
  duration_seconds: z.number().int().min(1).max(7200).optional(), // max 2 timer
  language: z.enum(["no", "en", "sv", "da"]).default("no"),
});
export type UploadAudioBody = z.infer<typeof uploadAudioBody>;

// ─── POST /api/leadgrid/routes/plan ───────────────────────────────────
export const planRouteBody = z.object({
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_lat: z.number().min(-90).max(90),
  start_lng: z.number().min(-180).max(180),
  limit: z.number().int().min(1).max(24).default(12),
});
export type PlanRouteBody = z.infer<typeof planRouteBody>;

// ─── PATCH /api/leadgrid/intelligence/weights ─────────────────────────
// Tillater både flat camelCase form (categoryFit/digitalNeed/...)
// og innpakket `{ weights: {...} }`. Verdier valideres 0..5 nedstrøms
// av handleren — her sjekker vi bare struktur og rekkevidde.
const weightValue = z.number().min(0).max(5);
export const patchWeightsBody = z
  .object({
    weights: z.record(z.string(), weightValue).optional(),
    categoryFit: weightValue.optional(),
    digitalNeed: weightValue.optional(),
    budgetPotential: weightValue.optional(),
    engagement: weightValue.optional(),
    timing: weightValue.optional(),
    locationFit: weightValue.optional(),
  })
  .refine(
    (v) =>
      v.weights !== undefined ||
      v.categoryFit !== undefined ||
      v.digitalNeed !== undefined ||
      v.budgetPotential !== undefined ||
      v.engagement !== undefined ||
      v.timing !== undefined ||
      v.locationFit !== undefined,
    { message: "Trenger minst én vekt-verdi (categoryFit/digitalNeed/... eller weights-objekt)" },
  );
export type PatchWeightsBody = z.infer<typeof patchWeightsBody>;

// ─── POST /api/leadgrid/territories ───────────────────────────────────
export const createTerritoryBody = z
  .object({
    name: z.string().min(1).max(200),
    assigned_user_id: z.string().nullable().optional(),
    sales_team_id: z.string().uuid().nullable().optional(),
    geometry: z.unknown().optional(),
    municipalities: z.array(z.string()).default([]),
    postal_codes: z.array(z.string()).default([]),
    center_lat: z.number().min(-90).max(90).nullable().optional(),
    center_lng: z.number().min(-180).max(180).nullable().optional(),
    radius_m: z.number().int().positive().nullable().optional(),
    priority: z.number().int().default(100),
    effective_from: z.string().nullable().optional(),
    effective_to: z.string().nullable().optional(),
  })
  .refine(
    (v) =>
      v.geometry != null ||
      (v.municipalities && v.municipalities.length > 0) ||
      (v.postal_codes && v.postal_codes.length > 0) ||
      (typeof v.radius_m === "number" && v.radius_m > 0),
    {
      message:
        "Trenger minst polygon (geometry), admin-enhet (municipalities/postal_codes) eller sirkel (radius_m)",
    },
  );
export type CreateTerritoryBody = z.infer<typeof createTerritoryBody>;

/**
 * parseOr400 — kjør zod-parsing, send 400 + issues-array hvis ugyldig.
 * Returnerer `null` ved feil (caller bør `return` umiddelbart).
 */
export function parseOr400<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  res: Response,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({
      error: "validation_failed",
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      })),
    });
    return null;
  }
  return result.data;
}
