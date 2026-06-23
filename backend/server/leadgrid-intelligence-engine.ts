/**
 * leadgrid-intelligence-engine.ts
 *
 * Leadgrid Intelligence Engine — sentralservice som beregner:
 *   - composite lead_score (0-100) fra 6 vektede dimensjoner
 *   - conversion_probability (0-1) basert på pipeline-stage + signals
 *   - expected_value (NOK)
 *   - follow_up_priority (0-100)
 *   - lead_temperature (cold/warm/hot/ready)
 *   - Next Best Action (action + channel + reason + confidence)
 *
 * Persisterer alt på crm_customers + history i lead_scores_history +
 * recommendation-rad i lead_recommendations. Emitter webhooks.
 *
 * 20 formler implementert som rene eksporterte funksjoner for testbarhet.
 *
 * Default-vekter (sum=1.0):
 *   categoryFit     0.20
 *   digitalNeed     0.25
 *   budgetPotential 0.20
 *   engagement      0.15
 *   timing          0.10
 *   locationFit     0.10
 *
 * Org-overstyrte vekter ligger i crm_scoring_weights (per dimension).
 * Vi mapper de 6 facetene over til dimension-navn med samme nøkkel.
 */

import type { Pool } from "pg";
import { emitWebhook } from "./webhook-emitter.js";

// ─────────────────────────────────────────────────────────────────────
// Typer
// ─────────────────────────────────────────────────────────────────────

export interface IntelligenceFacets {
  categoryFit: number;     // 0-100
  digitalNeed: number;     // 0-100
  budgetPotential: number; // 0-100
  engagement: number;      // 0-100
  timing: number;          // 0-100
  locationFit: number;     // 0-100
}

export interface IntelligenceWeights {
  categoryFit: number;
  digitalNeed: number;
  budgetPotential: number;
  engagement: number;
  timing: number;
  locationFit: number;
}

export type LeadTemperature = "cold" | "warm" | "hot" | "ready";

export interface NextBestAction {
  action: string;        // 'call_now' | 'send_email' | 'visit' | 'book_meeting' | ...
  channel: string | null;
  reason: string;
  bestTime: { weekday?: string; hour_from?: number; hour_to?: number } | null;
  confidence: number;    // 0-1
  expectedImpact: "low" | "medium" | "high";
  priority: "low" | "normal" | "high" | "urgent";
  suggestedMessage?: string;
}

export interface IntelligenceResult {
  leadId: string;
  organizationId: string;
  facets: IntelligenceFacets;
  weights: IntelligenceWeights;
  leadScore: number;
  conversionProbability: number;
  expectedValue: number;
  followUpPriority: number;
  leadTemperature: LeadTemperature;
  pipelineStage: string;
  daysSinceContact: number | null;
  decay: number;
  nextBestAction: NextBestAction;
  recommendationId?: string;
  computedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Konstanter
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: IntelligenceWeights = {
  categoryFit: 0.20,
  digitalNeed: 0.25,
  budgetPotential: 0.20,
  engagement: 0.15,
  timing: 0.10,
  locationFit: 0.10,
};

/** Mapper facet-key til dimension-navn i crm_scoring_weights */
const FACET_DIMENSION_KEYS: Record<keyof IntelligenceWeights, string> = {
  categoryFit: "category_fit",
  digitalNeed: "digital_need",
  budgetPotential: "budget_potential",
  engagement: "engagement",
  timing: "timing",
  locationFit: "location_fit",
};

/** Base conversion-sannsynlighet per (pipeline_stage ELLER lead_status) */
export const STAGE_BASE_PROBABILITY: Record<string, number> = {
  // pipeline_stage
  new: 0.05,
  first_contact: 0.10,
  qualified: 0.20,
  meeting: 0.50,
  proposal: 0.65,
  negotiation: 0.75,
  won: 1.0,
  lost: 0.0,
  // lead_status (overlapper men beholdes for fallback)
  unvisited: 0.03,
  visited: 0.10,
  return: 0.15,
  not_present: 0.05,
  declined: 0.02,
  interested: 0.30,
  meeting_booked: 0.50,
  proposal_sent: 0.65,
  do_not_contact: 0.0,
};

// ─────────────────────────────────────────────────────────────────────
// Rene formler (testbare uten DB)
// ─────────────────────────────────────────────────────────────────────

/** Klamp tall til [min, max] */
function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v) || !Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** Composite-score = sum(facet * weight). Forventer vekter som summerer til ~1. */
export function computeLeadScore(
  facets: IntelligenceFacets,
  weights: IntelligenceWeights = DEFAULT_WEIGHTS,
): number {
  const totalWeight =
    weights.categoryFit + weights.digitalNeed + weights.budgetPotential +
    weights.engagement + weights.timing + weights.locationFit;
  if (totalWeight === 0) return 0;
  const weighted =
    facets.categoryFit * weights.categoryFit +
    facets.digitalNeed * weights.digitalNeed +
    facets.budgetPotential * weights.budgetPotential +
    facets.engagement * weights.engagement +
    facets.timing * weights.timing +
    facets.locationFit * weights.locationFit;
  return Math.round(clamp(weighted / totalWeight, 0, 100));
}

/** Score → temperatur */
export function scoreToTemperature(score: number): LeadTemperature {
  if (score >= 90) return "ready";
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

/** Decay-funksjon for follow-up-priority */
export function computeFollowUpDecay(daysSinceContact: number): number {
  if (!Number.isFinite(daysSinceContact) || daysSinceContact < 0) return 1.0;
  if (daysSinceContact <= 1) return 1.0;
  if (daysSinceContact <= 3) return 0.80;
  if (daysSinceContact <= 7) return 0.55;
  if (daysSinceContact <= 14) return 0.30;
  return 0.10;
}

/**
 * Conversion-sannsynlighet basert på stage + engagement-justering.
 * Modifikatorer:
 *   - positive recent activity: +5-15%
 *   - negative signals (declined/lost): bremses
 *   - decay applied via daysSinceContact
 */
export function computeConversionProbability(args: {
  pipelineStage: string;
  leadStatus: string;
  recentActivityCount: number;
  positiveSignalCount: number;
  negativeSignalCount: number;
  daysSinceContact: number | null;
}): number {
  // Base: foretrekk pipeline_stage hvis kjent, ellers fall tilbake til lead_status
  const stageBase = STAGE_BASE_PROBABILITY[args.pipelineStage];
  const statusBase = STAGE_BASE_PROBABILITY[args.leadStatus];
  let p =
    typeof stageBase === "number"
      ? stageBase
      : typeof statusBase === "number"
        ? statusBase
        : 0.05;

  // Engagement-justering (max +0.20)
  const engagementBoost = Math.min(0.20, args.recentActivityCount * 0.02);
  p += engagementBoost;

  // Positive signaler (max +0.15)
  p += Math.min(0.15, args.positiveSignalCount * 0.05);

  // Negative signaler (max -0.20)
  p -= Math.min(0.20, args.negativeSignalCount * 0.05);

  // Decay hvis lang stillhet
  if (args.daysSinceContact !== null) {
    const decay = computeFollowUpDecay(args.daysSinceContact);
    // Decay påvirker «aktiv» del av sannsynligheten (over base)
    const above = Math.max(0, p - 0.05);
    p = 0.05 + above * decay;
  }

  return clamp(p, 0, 1);
}

/** EV = estimated_value × probability */
export function computeExpectedValue(
  estimatedValue: number | null | undefined,
  probability: number,
): number {
  if (estimatedValue == null || !Number.isFinite(estimatedValue)) return 0;
  return Math.round(estimatedValue * clamp(probability, 0, 1) * 100) / 100;
}

/**
 * Follow-up-prioritet 0-100:
 *   priority = (score * 0.35) + (prob * 100 * 0.30) + (evScore * 0.20) +
 *              (urgencyBoost * 0.15) - (negativeSignals * 5)
 * Hvor evScore = min(100, expectedValue / 1000) (ev. juster om bedrift har større deals).
 */
export function computeFollowUpPriority(args: {
  score: number;
  probability: number;
  expectedValue: number;
  daysSinceContact: number | null;
  urgentFlag: boolean;
  negativeSignalCount: number;
}): number {
  const evScore = Math.min(100, args.expectedValue / 1000);
  const decay =
    args.daysSinceContact !== null
      ? 1.0 - computeFollowUpDecay(args.daysSinceContact)
      : 0;
  const urgencyBoost = (args.urgentFlag ? 20 : 0) + decay * 30;
  const raw =
    args.score * 0.35 +
    args.probability * 100 * 0.30 +
    evScore * 0.20 +
    urgencyBoost * 0.15 -
    args.negativeSignalCount * 5;
  return Math.round(clamp(raw, 0, 100));
}

/** Response rate = replies / attempts. Min-floor for små N. */
export function computeResponseRate(replies: number, attempts: number): number {
  if (attempts <= 0) return 0;
  return clamp(replies / attempts, 0, 1);
}

/** Conversion rate = won / total */
export function computeConversionRate(won: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(won / total, 0, 1);
}

/** Pipeline velocity (NOK/dag) = (active × winRate × avgDeal) / avgCycleDays */
export function computePipelineVelocity(
  active: number,
  winRate: number,
  avgDeal: number,
  avgCycleDays: number,
): number {
  if (avgCycleDays <= 0) return 0;
  return Math.round((active * winRate * avgDeal) / avgCycleDays);
}

/** Route-effektivitet = relevantVisits / hours */
export function computeRouteEfficiency(
  relevantVisits: number,
  travelTimeSeconds: number,
): number {
  if (travelTimeSeconds <= 0) return 0;
  const hours = travelTimeSeconds / 3600;
  if (hours <= 0) return 0;
  return Math.round((relevantVisits / hours) * 100) / 100;
}

/** Forventet ruteverdi = sum(stop.expectedValue) - travelCost */
export function computeExpectedRouteValue(
  stops: Array<{ expectedValue: number }>,
  travelCost: number,
): number {
  const sum = stops.reduce((acc, s) => acc + (s.expectedValue || 0), 0);
  return Math.round((sum - travelCost) * 100) / 100;
}

/** Churn risk: høy hvis lang stillhet + tidligere positiv engasjement */
export function computeChurnRisk(args: {
  daysSinceContact: number | null;
  hadPositiveEngagement: boolean;
  pipelineStage: string;
}): "low" | "medium" | "high" {
  if (args.pipelineStage === "won" || args.pipelineStage === "lost") return "low";
  const days = args.daysSinceContact ?? 0;
  if (args.hadPositiveEngagement && days > 30) return "high";
  if (days > 60) return "high";
  if (days > 21) return "medium";
  return "low";
}

// ─────────────────────────────────────────────────────────────────────
// Next Best Action — regel-basert
// ─────────────────────────────────────────────────────────────────────

interface NbaInputs {
  leadStatus: string;
  pipelineStage: string;
  temperature: LeadTemperature;
  score: number;
  probability: number;
  daysSinceContact: number | null;
  decay: number;
  recentActivityCount: number;
  hasEmail: boolean;
  hasPhone: boolean;
  hasEnrichment: boolean;
  hasGeo: boolean;
  hasMeetingBooked: boolean;
  hasMeetingPast: boolean;
  isInProspectingTerritory: boolean;
}

/**
 * Determiner som kjører reglene i prioritert rekkefølge.
 * Returnerer FØRSTE match.
 */
export function determineNextBestAction(input: NbaInputs): NextBestAction {
  const d = input.daysSinceContact;

  // 1) do_not_contact
  if (input.leadStatus === "do_not_contact") {
    return {
      action: "do_not_contact",
      channel: null,
      reason: "Markert som «ikke kontakt» — respekter ønsket.",
      bestTime: null,
      confidence: 1.0,
      expectedImpact: "low",
      priority: "low",
    };
  }
  // 2) lost
  if (input.leadStatus === "lost" || input.pipelineStage === "lost") {
    return {
      action: "mark_lost",
      channel: null,
      reason: "Lead er tapt — arkiver og fokuser på andre.",
      bestTime: null,
      confidence: 0.95,
      expectedImpact: "low",
      priority: "low",
    };
  }
  // 3) mangler kontaktinfo
  if (!input.hasEmail && !input.hasPhone) {
    return {
      action: "add_missing_info",
      channel: null,
      reason: "Mangler både e-post og telefon — kan ikke kontakte før dette er fylt inn.",
      bestTime: null,
      confidence: 0.95,
      expectedImpact: "high",
      priority: "high",
    };
  }
  // 4) ingen enrichment ennå
  if (!input.hasEnrichment) {
    return {
      action: "run_research",
      channel: null,
      reason: "Ingen BRREG/website-research kjørt ennå — kjør Leadgrid Research først.",
      bestTime: null,
      confidence: 0.9,
      expectedImpact: "medium",
      priority: "normal",
    };
  }
  // 5) ready uten meeting
  if (input.temperature === "ready" && !input.hasMeetingBooked) {
    return {
      action: "call_now",
      channel: "phone",
      reason: "Lead er «klar» (score ≥90) og har ikke møte ennå — ring nå før den blir kald.",
      bestTime: { hour_from: 9, hour_to: 16 },
      confidence: 0.92,
      expectedImpact: "high",
      priority: "urgent",
    };
  }
  // 6) hot + 2+ dager siden kontakt
  if (input.temperature === "hot" && (d ?? Infinity) >= 2) {
    return {
      action: "call_now",
      channel: "phone",
      reason: `Hot lead, ${d} dager siden siste kontakt — ring i dag.`,
      bestTime: { hour_from: 9, hour_to: 16 },
      confidence: 0.85,
      expectedImpact: "high",
      priority: "urgent",
    };
  }
  // 7) proposal_sent + 3+ dager
  if (input.leadStatus === "proposal_sent" && (d ?? Infinity) >= 3) {
    return {
      action: "call_now",
      channel: "phone",
      reason: `Tilbud sendt for ${d} dager siden uten svar — ring og lukk.`,
      bestTime: { hour_from: 10, hour_to: 15 },
      confidence: 0.8,
      expectedImpact: "high",
      priority: "urgent",
    };
  }
  // 8) interested + 1+ dager
  if (input.leadStatus === "interested" && (d ?? Infinity) >= 1) {
    return {
      action: "book_meeting",
      channel: "phone",
      reason: "Lead har vist interesse — book møte før engasjementet faller.",
      bestTime: { hour_from: 9, hour_to: 16 },
      confidence: 0.8,
      expectedImpact: "high",
      priority: "high",
    };
  }
  // 9) meeting passed → send proposal
  if (input.pipelineStage === "meeting" && input.hasMeetingPast) {
    return {
      action: "send_proposal",
      channel: "email",
      reason: "Møte er gjennomført — send tilbud før momentum dør.",
      bestTime: null,
      confidence: 0.85,
      expectedImpact: "high",
      priority: "high",
    };
  }
  // 10) qualified + 5+ dager
  if (input.pipelineStage === "qualified" && (d ?? Infinity) >= 5) {
    return {
      action: "send_email",
      channel: "email",
      reason: `Kvalifisert lead, ${d} dager uten kontakt — send en personlig e-post.`,
      bestTime: null,
      confidence: 0.7,
      expectedImpact: "medium",
      priority: "normal",
    };
  }
  // 11) warm + 7+ dager
  if (input.temperature === "warm" && (d ?? Infinity) >= 7) {
    return {
      action: "send_follow_up_email",
      channel: "email",
      reason: "Warm lead som har vært stille i over en uke — send oppfølging.",
      bestTime: null,
      confidence: 0.65,
      expectedImpact: "medium",
      priority: "normal",
    };
  }
  // 12) lav decay (lang stillhet)
  if (input.decay < 0.3) {
    if (input.score >= 50) {
      return {
        action: "reassign",
        channel: null,
        reason: "Decay <30% men score er fortsatt OK — vurder å re-tildele til en aktiv selger.",
        bestTime: null,
        confidence: 0.6,
        expectedImpact: "medium",
        priority: "normal",
      };
    }
    return {
      action: "wait",
      channel: null,
      reason: "Lang stillhet og lav score — la den ligge til nye signaler dukker opp.",
      bestTime: null,
      confidence: 0.7,
      expectedImpact: "low",
      priority: "low",
    };
  }
  // 13) ingen aktivitet siste 14d + score <30 → mark_lost
  if (
    input.recentActivityCount === 0 &&
    input.score < 30 &&
    (d ?? 0) >= 14
  ) {
    return {
      action: "mark_lost",
      channel: null,
      reason: "Ingen aktivitet på 14+ dager og lav score — arkiver som tapt.",
      bestTime: null,
      confidence: 0.7,
      expectedImpact: "low",
      priority: "low",
    };
  }
  // 14) fallback
  if (input.hasGeo && input.isInProspectingTerritory && input.temperature !== "cold") {
    return {
      action: "visit",
      channel: "visit",
      reason: "Warm+ lead innenfor 50 km av deg — vurder felt-besøk.",
      bestTime: { hour_from: 10, hour_to: 15 },
      confidence: 0.55,
      expectedImpact: "medium",
      priority: "normal",
    };
  }
  return {
    action: "wait",
    channel: null,
    reason: "Ingen umiddelbar handling påkrevd — overvåk for nye signaler.",
    bestTime: null,
    confidence: 0.5,
    expectedImpact: "low",
    priority: "low",
  };
}

// ─────────────────────────────────────────────────────────────────────
// DB-helpers
// ─────────────────────────────────────────────────────────────────────

interface LeadRow {
  id: string;
  organization_id: string | null;
  owner_user_id: string | null;
  assigned_user_id: string | null;
  lead_status: string;
  pipeline_stage: string | null;
  lead_category: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
  estimated_value: number | null;
  enrichment_data: Record<string, unknown> | null;
  enriched_at: string | null;
  last_visit_at: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  ai_opportunity_score: number | null;
}

export async function fetchLead(pool: Pool, leadId: string): Promise<LeadRow | null> {
  // FIX (2026-06-22): crm_customers har INGEN organization_id-kolonne.
  // Vi henter primary org via JOIN organization_members.
  const r = await pool.query<LeadRow>(
    `SELECT c.id::text,
            (SELECT om.organization_id::text FROM organization_members om
              WHERE om.user_id = c.owner_user_id ORDER BY om.joined_at ASC LIMIT 1)
            AS organization_id,
            c.owner_user_id::text,
            c.assigned_user_id::text,
            c.lead_status,
            c.pipeline_stage,
            c.lead_category,
            c.email,
            c.phone,
            c.website_url,
            c.latitude::float8 AS latitude,
            c.longitude::float8 AS longitude,
            c.estimated_value::float8 AS estimated_value,
            c.enrichment_data,
            c.enriched_at::text,
            c.last_visit_at::text,
            c.last_contacted_at::text,
            c.next_follow_up_at::text,
            c.ai_opportunity_score
       FROM crm_customers c
      WHERE c.id = $1::uuid
      LIMIT 1`,
    [leadId],
  );
  return r.rows[0] ?? null;
}

interface ActivityRow {
  activity_type: string;
  created_at: string;
}

export async function fetchRecentActivities(
  pool: Pool,
  leadId: string,
  days = 60,
): Promise<ActivityRow[]> {
  const r = await pool.query<ActivityRow>(
    `SELECT activity_type, created_at::text
       FROM crm_lead_activities
      WHERE customer_id = $1::uuid
        AND created_at > NOW() - ($2::text || ' days')::interval
      ORDER BY created_at DESC`,
    [leadId, String(days)],
  );
  return r.rows;
}

interface NeedRow {
  need_type: string;
  status: string;
  priority: number | null;
}

export async function fetchNeeds(pool: Pool, leadId: string): Promise<NeedRow[]> {
  try {
    const r = await pool.query<NeedRow>(
      `SELECT need_type, status, priority
         FROM crm_customer_needs
        WHERE customer_id = $1
          AND status IN ('detected','accepted')`,
      [leadId],
    );
    return r.rows;
  } catch {
    return [];
  }
}

interface SignalRow {
  signal_type: string;
}

export async function fetchSignals(pool: Pool, leadId: string): Promise<SignalRow[]> {
  try {
    const r = await pool.query<SignalRow>(
      `SELECT signal_type FROM crm_customer_signals WHERE customer_id = $1`,
      [leadId],
    );
    return r.rows;
  } catch {
    return [];
  }
}

/**
 * Batch-fetch alle DB-data som trengs for å beregne intelligence for ETT
 * lead, i ÉN roundtrip via CTE. Erstatter 4 separate parallelle queries
 * (lead, activities, needs, signals, weights) som tidligere kjørte via
 * `Promise.all`.
 *
 * Effekt på 10k-leads cron: 4× → 1× DB-roundtrips = 40k → 10k queries.
 *
 * Returnerer `null` hvis lead ikke finnes. Hvis organization_id ikke kan
 * resolves (lead har ingen owner_user_id, eller eieren er ikke i noen
 * organization_members), settes `lead.organization_id = null` og
 * `weights` faller tilbake til DEFAULT_WEIGHTS.
 *
 * NB: De individuelle `fetchLead/fetchRecentActivities/fetchNeeds/
 * fetchSignals/fetchWeights`-funksjonene beholdes (eksporterte) fordi
 * de potensielt brukes andre steder.
 */
export async function fetchLeadIntelContext(
  pool: Pool,
  leadId: string,
): Promise<{
  lead: LeadRow;
  activities: ActivityRow[];
  needs: NeedRow[];
  signals: SignalRow[];
  weights: IntelligenceWeights;
} | null> {
  const r = await pool.query<{
    lead_data: LeadRow;
    activities_json: ActivityRow[] | null;
    needs_json: NeedRow[] | null;
    signals_json: SignalRow[] | null;
    weights_json: Array<{ dimension: string; weight: number }> | null;
  }>(
    `WITH lead AS (
       SELECT c.id::text AS id,
              (SELECT om.organization_id::text FROM organization_members om
                 WHERE om.user_id = c.owner_user_id
                 ORDER BY om.joined_at ASC LIMIT 1) AS organization_id,
              c.owner_user_id::text AS owner_user_id,
              c.assigned_user_id::text AS assigned_user_id,
              c.lead_status,
              c.pipeline_stage,
              c.lead_category,
              c.email, c.phone, c.website_url,
              c.latitude::float8 AS latitude,
              c.longitude::float8 AS longitude,
              c.estimated_value::float8 AS estimated_value,
              c.enrichment_data,
              c.enriched_at::text AS enriched_at,
              c.last_visit_at::text AS last_visit_at,
              c.last_contacted_at::text AS last_contacted_at,
              c.next_follow_up_at::text AS next_follow_up_at,
              c.ai_opportunity_score
         FROM crm_customers c
        WHERE c.id = $1::uuid
        LIMIT 1
     ),
     activities AS (
       SELECT json_agg(row_to_json(a)) AS data FROM (
         SELECT activity_type, created_at::text AS created_at
           FROM crm_lead_activities
          WHERE customer_id = $1::uuid
            AND created_at > NOW() - INTERVAL '60 days'
          ORDER BY created_at DESC
          LIMIT 200
       ) a
     ),
     needs AS (
       SELECT json_agg(row_to_json(n)) AS data FROM (
         SELECT need_type, status, priority
           FROM crm_customer_needs
          WHERE customer_id = $1
            AND status IN ('detected','accepted')
       ) n
     ),
     signals AS (
       SELECT json_agg(row_to_json(s)) AS data FROM (
         SELECT signal_type
           FROM crm_customer_signals
          WHERE customer_id = $1
       ) s
     ),
     weights AS (
       SELECT json_agg(row_to_json(w)) AS data FROM (
         SELECT dimension, weight::float8 AS weight
           FROM crm_scoring_weights
          WHERE organization_id = (
            SELECT organization_id::uuid FROM lead WHERE organization_id IS NOT NULL
          )
       ) w
     )
     SELECT row_to_json(lead.*) AS lead_data,
            COALESCE(activities.data, '[]'::json) AS activities_json,
            COALESCE(needs.data, '[]'::json) AS needs_json,
            COALESCE(signals.data, '[]'::json) AS signals_json,
            COALESCE(weights.data, '[]'::json) AS weights_json
       FROM lead
       LEFT JOIN activities ON true
       LEFT JOIN needs ON true
       LEFT JOIN signals ON true
       LEFT JOIN weights ON true`,
    [leadId],
  );

  if (r.rowCount === 0 || !r.rows[0]?.lead_data) return null;
  const row = r.rows[0];

  // Bygg weights med fallback til DEFAULT_WEIGHTS per dimension
  const weightsArr = row.weights_json ?? [];
  const lookup = new Map(weightsArr.map((w) => [w.dimension, w.weight]));
  const weights: IntelligenceWeights = { ...DEFAULT_WEIGHTS };
  (Object.keys(FACET_DIMENSION_KEYS) as Array<keyof IntelligenceWeights>).forEach((k) => {
    const dim = FACET_DIMENSION_KEYS[k];
    const v = lookup.get(dim);
    if (typeof v === "number" && Number.isFinite(v)) {
      weights[k] = v;
    }
  });

  return {
    lead: row.lead_data,
    activities: row.activities_json ?? [],
    needs: row.needs_json ?? [],
    signals: row.signals_json ?? [],
    weights,
  };
}

/**
 * Hent org-weights fra crm_scoring_weights. Faller tilbake til DEFAULT_WEIGHTS
 * for hver facet som mangler.
 */
export async function fetchWeights(
  pool: Pool,
  organizationId: string | null,
): Promise<IntelligenceWeights> {
  if (!organizationId) return { ...DEFAULT_WEIGHTS };
  try {
    const r = await pool.query<{ dimension: string; weight: number }>(
      `SELECT dimension, weight::float8 AS weight
         FROM crm_scoring_weights
        WHERE organization_id = $1::uuid`,
      [organizationId],
    );
    const lookup = new Map(r.rows.map((row) => [row.dimension, row.weight]));
    const w: IntelligenceWeights = { ...DEFAULT_WEIGHTS };
    (Object.keys(FACET_DIMENSION_KEYS) as Array<keyof IntelligenceWeights>).forEach((k) => {
      const dim = FACET_DIMENSION_KEYS[k];
      const v = lookup.get(dim);
      if (typeof v === "number" && Number.isFinite(v)) w[k] = v;
    });
    return w;
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Facet-utregning (per-faktor)
// ─────────────────────────────────────────────────────────────────────

function computeCategoryFit(lead: LeadRow): number {
  // Hvis vi har en kategori og enrichment har vurdert match, bruk den;
  // ellers en moderat default når kategori er kjent (50) eller lav (25) når null.
  if (!lead.lead_category) return 25;
  // Hvis enrichment_data.leadgrid_research.opportunityScore finnes, bruk den (1-10 → 10-100)
  const research = (lead.enrichment_data?.leadgrid_research as { opportunityScore?: number } | undefined);
  if (research && typeof research.opportunityScore === "number") {
    return clamp(research.opportunityScore * 10, 0, 100);
  }
  return 60;
}

function computeDigitalNeed(needs: NeedRow[]): number {
  // Tell aktive «needs_*»-needs; 5+ = 100, 0 = 0
  const digitalNeeds = needs.filter(
    (n) => n.need_type.startsWith("needs_") || n.need_type.includes("digital"),
  );
  if (digitalNeeds.length === 0) return 30; // default — kan være vi bare ikke har scannet enda
  const score = Math.min(100, digitalNeeds.length * 20);
  // Boost hvis høy priority er satt
  const maxPriority = digitalNeeds.reduce((m, n) => Math.max(m, n.priority ?? 0), 0);
  if (maxPriority >= 8) return Math.min(100, score + 10);
  return score;
}

function computeBudgetPotential(lead: LeadRow): number {
  // Bruk BRREG.employees hvis tilgjengelig
  const brreg = lead.enrichment_data?.brreg as
    | { company?: { employees?: number } }
    | undefined;
  const employees = brreg?.company?.employees ?? null;
  if (employees == null) {
    // Fall tilbake til estimated_value (hvis selger har skrevet inn)
    if (lead.estimated_value != null) {
      if (lead.estimated_value >= 100_000) return 85;
      if (lead.estimated_value >= 25_000) return 60;
      if (lead.estimated_value > 0) return 40;
    }
    return 50;
  }
  if (employees >= 100) return 90;
  if (employees >= 50) return 80;
  if (employees >= 20) return 70;
  if (employees >= 5) return 60;
  if (employees >= 1) return 40;
  return 25;
}

function computeEngagement(activities: ActivityRow[]): number {
  // 30d window
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = activities.filter((a) => {
    const ts = Date.parse(a.created_at);
    return Number.isFinite(ts) && ts > cutoff;
  });
  // Positiv vekting per type
  let pts = 0;
  for (const a of recent) {
    switch (a.activity_type) {
      case "meeting_scheduled":
      case "proposal_sent":
        pts += 25;
        break;
      case "visit_logged":
      case "pitch_generated":
        pts += 15;
        break;
      case "note_added":
      case "follow_up_set":
        pts += 8;
        break;
      case "status_changed":
        pts += 5;
        break;
      default:
        pts += 3;
    }
  }
  return clamp(pts, 0, 100);
}

function computeTiming(lead: LeadRow, signals: SignalRow[]): number {
  // Recent positive signals boost timing. Vi vet bare type, ikke dato — så
  // bruk last_contacted_at + lead_status som proxy.
  const positives = ["interested", "meeting_booked", "proposal_sent"];
  if (positives.includes(lead.lead_status)) return 85;
  if (lead.lead_status === "visited" || lead.lead_status === "return") return 65;
  if (lead.lead_status === "unvisited") return 40;
  if (signals.some((s) => s.signal_type.includes("hiring") || s.signal_type.includes("funding"))) {
    return 90;
  }
  return 50;
}

function computeLocationFit(args: {
  leadLat: number | null;
  leadLng: number | null;
  userLat?: number | null;
  userLng?: number | null;
}): number {
  if (args.leadLat == null || args.leadLng == null) return 30;
  if (args.userLat == null || args.userLng == null) {
    // Vi vet at lead har geo, men ikke selger — gi moderat-høy
    return 70;
  }
  const km = haversineKm(args.leadLat, args.leadLng, args.userLat, args.userLng);
  if (km <= 10) return 100;
  if (km <= 25) return 90;
  if (km <= 50) return 80;
  if (km <= 100) return 65;
  if (km <= 250) return 50;
  if (km <= 500) return 35;
  return 20;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─────────────────────────────────────────────────────────────────────
// Sub-utility helpers
// ─────────────────────────────────────────────────────────────────────

function daysBetween(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000)));
}

function countPositive(signals: SignalRow[]): number {
  return signals.filter((s) =>
    /positive|interested|hiring|funding|growth/i.test(s.signal_type),
  ).length;
}

function countNegative(signals: SignalRow[]): number {
  return signals.filter((s) =>
    /negative|declined|churn|cancel|bankruptcy/i.test(s.signal_type),
  ).length;
}

// ─────────────────────────────────────────────────────────────────────
// Hovedaggregat
// ─────────────────────────────────────────────────────────────────────

export interface ComputeOpts {
  trigger?: "cron" | "activity" | "enrichment" | "manual";
  persist?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

/**
 * Beregn full intelligence for ett lead. Default: persisterer + emitter
 * webhook. Sett `persist: false` for dry-run (brukes i tester / preview).
 */
export async function computeIntelligenceForLead(
  pool: Pool,
  leadId: string,
  opts: ComputeOpts = {},
): Promise<IntelligenceResult | null> {
  const trigger = opts.trigger ?? "manual";
  const persist = opts.persist !== false;

  // PERF (skalering nivå 2): én CTE-query henter lead + activities + needs
  // + signals + weights i én DB-roundtrip i stedet for fire parallelle
  // queries. Effekt på 10k-leads cron: 40k → 10k queries.
  const ctx = await fetchLeadIntelContext(pool, leadId);
  if (!ctx) return null;
  const { lead, activities, needs, signals, weights } = ctx;
  if (!lead.organization_id) {
    // Vi krever org-tilhørighet for å persistere
    return null;
  }

  const now = new Date();
  const lastContactIso =
    lead.last_contacted_at ?? lead.last_visit_at ?? null;
  const daysSinceContact = daysBetween(lastContactIso, now);
  const decay = computeFollowUpDecay(daysSinceContact ?? 9999);
  const positiveSignals = countPositive(signals);
  const negativeSignals = countNegative(signals);
  const recentActivityCount = activities.length;

  const facets: IntelligenceFacets = {
    categoryFit: computeCategoryFit(lead),
    digitalNeed: computeDigitalNeed(needs),
    budgetPotential: computeBudgetPotential(lead),
    engagement: computeEngagement(activities),
    timing: computeTiming(lead, signals),
    locationFit: computeLocationFit({
      leadLat: lead.latitude,
      leadLng: lead.longitude,
      userLat: opts.userLocation?.lat ?? null,
      userLng: opts.userLocation?.lng ?? null,
    }),
  };

  const leadScore = computeLeadScore(facets, weights);
  const pipelineStage = lead.pipeline_stage ?? "new";

  const probability = computeConversionProbability({
    pipelineStage,
    leadStatus: lead.lead_status,
    recentActivityCount,
    positiveSignalCount: positiveSignals,
    negativeSignalCount: negativeSignals,
    daysSinceContact,
  });

  const expectedValue = computeExpectedValue(lead.estimated_value, probability);
  const temperature = scoreToTemperature(leadScore);

  const urgentFlag =
    lead.lead_status === "proposal_sent" ||
    lead.lead_status === "interested" ||
    temperature === "ready";

  const followUpPriority = computeFollowUpPriority({
    score: leadScore,
    probability,
    expectedValue,
    daysSinceContact,
    urgentFlag,
    negativeSignalCount: negativeSignals,
  });

  const hasMeetingBooked =
    lead.lead_status === "meeting_booked" || pipelineStage === "meeting";
  // Vi kan ikke uten join sjekke om meetingen har passert; bruk konservativ proxy
  const hasMeetingPast =
    pipelineStage === "meeting" &&
    (daysSinceContact ?? 0) >= 1;
  const isInProspectingTerritory =
    lead.latitude != null && lead.longitude != null && facets.locationFit >= 70;

  const nba = determineNextBestAction({
    leadStatus: lead.lead_status,
    pipelineStage,
    temperature,
    score: leadScore,
    probability,
    daysSinceContact,
    decay,
    recentActivityCount,
    hasEmail: !!lead.email,
    hasPhone: !!lead.phone,
    hasEnrichment: !!lead.enriched_at || !!lead.enrichment_data,
    hasGeo: lead.latitude != null && lead.longitude != null,
    hasMeetingBooked,
    hasMeetingPast,
    isInProspectingTerritory,
  });

  const result: IntelligenceResult = {
    leadId,
    organizationId: lead.organization_id,
    facets,
    weights,
    leadScore,
    conversionProbability: probability,
    expectedValue,
    followUpPriority,
    leadTemperature: temperature,
    pipelineStage,
    daysSinceContact,
    decay,
    nextBestAction: nba,
    computedAt: now.toISOString(),
  };

  if (!persist) return result;

  const recommendationId = await persistIntelligence(pool, lead, result, trigger);
  result.recommendationId = recommendationId ?? undefined;

  // Webhooks (fire-and-forget for at vi ikke skal blokkere flowen)
  void emitWebhook(pool, "lead.scored", {
    lead_id: leadId,
    organization_id: lead.organization_id,
    lead_score: leadScore,
    conversion_probability: probability,
    expected_value: expectedValue,
    follow_up_priority: followUpPriority,
    lead_temperature: temperature,
    pipeline_stage: pipelineStage,
    facets,
    triggered_by: trigger,
    computed_at: result.computedAt,
  }, lead.organization_id);

  if (recommendationId) {
    void emitWebhook(pool, "recommendation.created", {
      recommendation_id: recommendationId,
      lead_id: leadId,
      organization_id: lead.organization_id,
      action_type: nba.action,
      channel: nba.channel,
      priority: nba.priority,
      reason: nba.reason,
      confidence: nba.confidence,
      expected_impact: nba.expectedImpact,
    }, lead.organization_id);
  }

  return result;
}

async function persistIntelligence(
  pool: Pool,
  lead: LeadRow,
  result: IntelligenceResult,
  trigger: string,
): Promise<string | null> {
  // 1) Update crm_customers
  try {
    await pool.query(
      `UPDATE crm_customers
          SET lead_score = $2,
              conversion_probability = $3,
              expected_value = $4,
              follow_up_priority = $5,
              lead_temperature = $6,
              next_best_action = $7,
              next_best_action_reason = $8,
              next_best_action_channel = $9,
              next_best_action_confidence = $10,
              priority = $11,
              scored_at = NOW(),
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [
        lead.id,
        result.leadScore,
        result.conversionProbability,
        result.expectedValue,
        result.followUpPriority,
        result.leadTemperature,
        result.nextBestAction.action,
        result.nextBestAction.reason,
        result.nextBestAction.channel,
        result.nextBestAction.confidence,
        result.nextBestAction.priority,
      ],
    );
  } catch (err) {
    console.warn("[intelligence-engine] persist crm_customers failed:", err);
  }

  // 2) Insert into history
  try {
    await pool.query(
      `INSERT INTO lead_scores_history
         (lead_id, organization_id, lead_score, conversion_probability,
          expected_value, follow_up_priority, lead_temperature, pipeline_stage,
          category_fit, digital_need, budget_potential, engagement, timing,
          location_fit, computed_by, triggered_by, reason)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8,
               $9, $10, $11, $12, $13, $14, 'engine', $15, $16)`,
      [
        lead.id,
        lead.organization_id,
        result.leadScore,
        result.conversionProbability,
        result.expectedValue,
        result.followUpPriority,
        result.leadTemperature,
        result.pipelineStage,
        result.facets.categoryFit,
        result.facets.digitalNeed,
        result.facets.budgetPotential,
        result.facets.engagement,
        result.facets.timing,
        result.facets.locationFit,
        trigger,
        result.nextBestAction.reason,
      ],
    );
  } catch (err) {
    console.warn("[intelligence-engine] persist history failed:", err);
  }

  // 3) Insert recommendation (kun hvis NBA er noe annet enn wait/do_not_contact for å unngå spam,
  //    OG hvis det ikke finnes en aktiv pending som er identisk fra siste 6t).
  if (
    result.nextBestAction.action === "wait" ||
    result.nextBestAction.action === "do_not_contact"
  ) {
    return null;
  }
  try {
    const existing = await pool.query<{ id: string }>(
      `SELECT id::text
         FROM lead_recommendations
        WHERE lead_id = $1::uuid
          AND status = 'pending'
          AND action_type = $2
          AND created_at > NOW() - INTERVAL '6 hours'
        LIMIT 1`,
      [lead.id, result.nextBestAction.action],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const r = await pool.query<{ id: string }>(
      `INSERT INTO lead_recommendations
         (lead_id, organization_id, assigned_user_id, action_type, channel,
          priority, reason, best_contact_time, suggested_message, confidence,
          expected_impact, expires_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, $9, $10,
               $11, NOW() + INTERVAL '72 hours')
       RETURNING id::text`,
      [
        lead.id,
        lead.organization_id,
        lead.assigned_user_id,
        result.nextBestAction.action,
        result.nextBestAction.channel,
        result.nextBestAction.priority,
        result.nextBestAction.reason,
        result.nextBestAction.bestTime
          ? JSON.stringify(result.nextBestAction.bestTime)
          : null,
        result.nextBestAction.suggestedMessage ?? null,
        result.nextBestAction.confidence,
        result.nextBestAction.expectedImpact,
      ],
    );
    return r.rows[0]?.id ?? null;
  } catch (err) {
    console.warn("[intelligence-engine] persist recommendation failed:", err);
    return null;
  }
}
