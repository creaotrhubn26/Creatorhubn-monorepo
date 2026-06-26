/**
 * leadgrid-deal-defaults.ts
 *
 * Default deal_probability per pipeline_stage. Brukes når en lead
 * får ny pipeline_stage uten at deal_probability er manuelt
 * overskrevet (deal_probability_overridden = false).
 *
 * Vi bruker EKSISTERENDE stage-enum (mig 313):
 *   new → first_contact → qualified → meeting → proposal → negotiation → won/lost
 *
 * Prompten ba om stages som 'contacted'/'proposal_sent'/'verbal_yes' —
 * de mappes inn i eksisterende stages:
 *   contacted     → first_contact
 *   proposal_sent → proposal
 *   verbal_yes    → negotiation
 */

export type LeadgridStage =
  | "new"
  | "first_contact"
  | "qualified"
  | "meeting"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export const LEADGRID_STAGES: LeadgridStage[] = [
  "new",
  "first_contact",
  "qualified",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

/** Default-probability per stage (0-100) — brukes når brukeren ikke har overskrevet. */
export const DEFAULT_PROBABILITY_BY_STAGE: Record<LeadgridStage, number> = {
  new: 10,
  first_contact: 20,
  qualified: 35,
  meeting: 50,
  proposal: 65,
  negotiation: 80,
  won: 100,
  lost: 0,
};

export function isLeadgridStage(s: unknown): s is LeadgridStage {
  return typeof s === "string" && (LEADGRID_STAGES as string[]).includes(s);
}

export function defaultProbabilityFor(stage: string): number | null {
  if (!isLeadgridStage(stage)) return null;
  return DEFAULT_PROBABILITY_BY_STAGE[stage];
}
