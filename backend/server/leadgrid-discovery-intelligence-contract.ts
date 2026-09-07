import { z } from "zod";

export const MARKETING_DISCOVERY_SKILL_KEY =
  "marketing.discovery_intelligence" as const;
export const MARKETING_DISCOVERY_SKILL_VERSION = "1.0.0" as const;

export const marketingInsightCategorySchema = z.enum([
  "competition",
  "audience",
  "positioning",
  "messaging",
  "channels",
  "opportunity",
  "risk",
  "experiment",
  "win_loss",
]);

export const marketingInsightClaimTypeSchema = z.enum([
  "fact",
  "inference",
  "hypothesis",
]);

const marketingExperimentSchema = z
  .object({
    hypothesis: z.string().trim().min(10).max(600),
    action: z.string().trim().min(10).max(600),
    metric: z.string().trim().min(2).max(180),
    success_criterion: z.string().trim().min(3).max(240),
    duration_days: z.number().int().min(1).max(180),
  })
  .strict();

export const marketingIntelligenceOutputSchema = z
  .object({
    executive_summary: z.string().trim().min(20).max(1_800),
    overall_confidence: z.number().min(0).max(1),
    conflicts: z.array(z.string().trim().min(3).max(500)).max(12),
    gaps: z.array(z.string().trim().min(3).max(500)).max(12),
    insights: z
      .array(
        z
          .object({
            category: marketingInsightCategorySchema,
            claim_type: marketingInsightClaimTypeSchema,
            title: z.string().trim().min(3).max(180),
            finding: z.string().trim().min(10).max(1_200),
            relevance: z.string().trim().min(10).max(800),
            confidence: z.number().min(0).max(1),
            evidence_coverage: z.number().min(0).max(1),
            evidence_refs: z
              .array(
                z
                  .string()
                  .trim()
                  .regex(/^E\d{3}$/),
              )
              .min(1)
              .max(8),
            counter_evidence: z.array(z.string().trim().min(3).max(500)).max(8),
            recommended_action: z.string().trim().min(10).max(800),
            experiment: marketingExperimentSchema.nullable(),
          })
          .strict(),
      )
      .min(3)
      .max(12),
  })
  .strict();

export type MarketingIntelligenceOutput = z.infer<
  typeof marketingIntelligenceOutputSchema
>;

export const marketingIntelligenceFeedbackSchema = z
  .object({
    decision: z.enum(["accept", "reject", "correct"]),
    reason_code: z.string().trim().min(2).max(80).nullable().optional(),
    note: z.string().trim().min(2).max(2_000).nullable().optional(),
    correction: z
      .object({
        title: z.string().trim().min(3).max(180).optional(),
        finding: z.string().trim().min(10).max(1_200).optional(),
        relevance: z.string().trim().min(10).max(800).optional(),
        recommended_action: z.string().trim().min(10).max(800).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.decision === "correct" &&
      (!value.correction || Object.keys(value.correction).length === 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correction"],
        message: "En korrigering må endre minst ett innsiktsfelt.",
      });
    }
    if (value.decision === "reject" && !value.reason_code && !value.note) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason_code"],
        message: "En avvisning må ha årsak eller kommentar.",
      });
    }
  });

export type MarketingIntelligenceFeedback = z.infer<
  typeof marketingIntelligenceFeedbackSchema
>;

/**
 * The model may only cite evidence identifiers sent in the prompt. This is a
 * hard post-condition rather than a prompt preference.
 */
export function validateMarketingIntelligenceOutput(
  value: unknown,
  allowedEvidenceRefs: ReadonlySet<string>,
): MarketingIntelligenceOutput {
  const parsed = marketingIntelligenceOutputSchema.parse(value);
  for (const insight of parsed.insights) {
    for (const reference of insight.evidence_refs) {
      if (!allowedEvidenceRefs.has(reference)) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ["insights", insight.title, "evidence_refs"],
            message: `Ukjent evidansereferanse: ${reference}`,
          },
        ]);
      }
    }
  }
  return parsed;
}
