/**
 * workflowEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic workflow engine for the casting pipeline.
 *
 * Manages two orthogonal state machines:
 *
 *   1. Candidate Status  (casting decision: pending → shortlist → confirmed)
 *   2. Workflow Status    (production ops: pending → auditioned → contracted)
 *
 * Each machine defines allowed transitions and optional preconditions.
 * UI code should NEVER mutate status directly — always call:
 *
 *   workflowEngine.transitionCandidateStatus(current, target)
 *   workflowEngine.transitionWorkflowStatus(current, target, context)
 *
 * which returns `{ ok, next, reason? }`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CandidateStatus, WorkflowStatus, ProjectCandidate } from './castingTypes';

// ─── Transition result ───────────────────────────────────────────────────────

export interface TransitionResult<T> {
  /** Whether the transition is allowed. */
  ok: boolean;
  /** The resulting status if ok, or the unchanged current status if not. */
  next: T;
  /** Human-readable reason (Norwegian) when the transition is denied. */
  reason?: string;
}

// ─── Candidate Status transitions ────────────────────────────────────────────

/**
 * Adjacency map defining which CandidateStatus values can reach which others.
 * `'*'` means "can transition to any status" (e.g. rejected → anything for undo).
 */
const CANDIDATE_STATUS_TRANSITIONS: Record<CandidateStatus, CandidateStatus[] | '*'> = {
  pending:   ['requested', 'shortlist', 'rejected'],
  requested: ['shortlist', 'pending', 'rejected'],
  shortlist: ['selected', 'requested', 'pending', 'rejected'],
  selected:  ['confirmed', 'shortlist', 'rejected'],
  confirmed: ['selected', 'rejected'],
  rejected:  '*', // Allow un-rejecting to any status
};

/**
 * Validate and perform a CandidateStatus transition.
 */
export function transitionCandidateStatus(
  current: CandidateStatus,
  target: CandidateStatus,
): TransitionResult<CandidateStatus> {
  if (current === target) {
    return { ok: true, next: current };
  }

  const allowed = CANDIDATE_STATUS_TRANSITIONS[current];
  if (allowed === '*' || allowed.includes(target)) {
    return { ok: true, next: target };
  }

  return {
    ok: false,
    next: current,
    reason: `Kan ikke gå fra «${current}» til «${target}». Tillatte overganger: ${
      Array.isArray(allowed) ? allowed.join(', ') : 'alle'
    }.`,
  };
}

/**
 * Returns the list of statuses a candidate can transition to from `current`.
 */
export function getAllowedCandidateTransitions(
  current: CandidateStatus,
): CandidateStatus[] {
  const allowed = CANDIDATE_STATUS_TRANSITIONS[current];
  if (allowed === '*') {
    return ['pending', 'requested', 'shortlist', 'selected', 'confirmed', 'rejected'];
  }
  return allowed;
}

// ─── Workflow Status transitions ─────────────────────────────────────────────

/**
 * Adjacency map for the production workflow pipeline.
 * More restrictive than candidate status — production stages are sequential.
 */
const WORKFLOW_STATUS_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  pending:    ['auditioned', 'declined'],
  auditioned: ['selected', 'declined', 'pending'],
  selected:   ['offer_sent', 'auditioned', 'declined'],
  offer_sent: ['confirmed', 'declined', 'selected'],
  confirmed:  ['contracted', 'declined'],
  declined:   ['pending'],  // Allow re-opening
  contracted: ['production', 'declined'],
  production: ['contracted'], // Can step back
};

/**
 * Context used to evaluate preconditions for workflow transitions.
 */
export interface WorkflowTransitionContext {
  /** Has the candidate completed at least one audition? */
  hasAudition?: boolean;
  /** Has the candidate received a rating? */
  hasRating?: boolean;
  /** Does the candidate have a signed contract? */
  hasContract?: boolean;
}

/**
 * Preconditions that must be satisfied for certain workflow transitions.
 * Key format: `from→to`.
 */
const WORKFLOW_PRECONDITIONS: Record<string, {
  check: (ctx: WorkflowTransitionContext) => boolean;
  reason: string;
}> = {
  'pending→selected': {
    check: (ctx) => !!ctx.hasAudition,
    reason: 'Kandidaten må ha gjennomført audition før de kan velges.',
  },
  'selected→offer_sent': {
    check: (ctx) => !!ctx.hasRating,
    reason: 'Kandidaten må ha en vurdering (rating) før tilbud sendes.',
  },
  'confirmed→contracted': {
    check: (_ctx) => true, // Contract check can be added when contract service is ready
    reason: 'Kontrakt må være klar.',
  },
};

/**
 * Validate and perform a WorkflowStatus transition.
 *
 * @param current  - current workflow status
 * @param target   - desired workflow status
 * @param context  - optional context for precondition checks
 */
export function transitionWorkflowStatus(
  current: WorkflowStatus,
  target: WorkflowStatus,
  context: WorkflowTransitionContext = {},
): TransitionResult<WorkflowStatus> {
  if (current === target) {
    return { ok: true, next: current };
  }

  const allowed = WORKFLOW_STATUS_TRANSITIONS[current];
  if (!allowed.includes(target)) {
    return {
      ok: false,
      next: current,
      reason: `Kan ikke gå fra «${current}» til «${target}». Tillatte overganger: ${allowed.join(', ')}.`,
    };
  }

  // Check preconditions
  const preKey = `${current}→${target}`;
  const precondition = WORKFLOW_PRECONDITIONS[preKey];
  if (precondition && !precondition.check(context)) {
    return {
      ok: false,
      next: current,
      reason: precondition.reason,
    };
  }

  return { ok: true, next: target };
}

/**
 * Returns which workflow statuses are reachable from `current`,
 * optionally filtering by preconditions.
 */
export function getAllowedWorkflowTransitions(
  current: WorkflowStatus,
  context: WorkflowTransitionContext = {},
): { status: WorkflowStatus; allowed: boolean; reason?: string }[] {
  const targets = WORKFLOW_STATUS_TRANSITIONS[current];
  return targets.map(target => {
    const preKey = `${current}→${target}`;
    const precondition = WORKFLOW_PRECONDITIONS[preKey];
    if (precondition && !precondition.check(context)) {
      return { status: target, allowed: false, reason: precondition.reason };
    }
    return { status: target, allowed: true };
  });
}

// ─── Bulk transition helper ──────────────────────────────────────────────────

export interface BulkTransitionResult {
  succeeded: { candidateId: string; newStatus: CandidateStatus }[];
  failed: { candidateId: string; reason: string }[];
}

/**
 * Validate a bulk candidate status transition.
 * Returns partial success — some may fail validation while others succeed.
 */
export function bulkTransitionCandidateStatus(
  candidates: Pick<ProjectCandidate, 'id' | 'status'>[],
  targetStatus: CandidateStatus,
): BulkTransitionResult {
  const succeeded: BulkTransitionResult['succeeded'] = [];
  const failed: BulkTransitionResult['failed'] = [];

  for (const candidate of candidates) {
    const result = transitionCandidateStatus(candidate.status, targetStatus);
    if (result.ok) {
      succeeded.push({ candidateId: candidate.id, newStatus: result.next });
    } else {
      failed.push({ candidateId: candidate.id, reason: result.reason ?? 'Ukjent feil' });
    }
  }

  return { succeeded, failed };
}

// ─── Scoring engine (rule-based, Level A) ────────────────────────────────────

export interface RoleRequirements {
  ageRange?: { min?: number; max?: number };
  gender?: string[];
  skills?: string[];
  languages?: string[];
  location?: string;
}

export interface CandidateProfile {
  name?: string;
  age?: number;
  gender?: string;
  skills: string[];
  languages: string[];
  location?: string;
  previousPerformanceScore?: number;
}

export interface ScoreBreakdown {
  ageFit: number;
  genderFit: number;
  skillFit: number;
  languageFit: number;
  locationFit: number;
  experienceFit: number;
  total: number;
}

/**
 * Deterministic rule-based scoring for candidate–role matching.
 *
 * Returns a score 0–100 plus breakdown.
 * This is Level A (cheapest, most stable). AI-assisted scoring (Level B/C)
 * can wrap this later as a refinement layer.
 */
export function scoreCandidate(
  role: RoleRequirements,
  candidate: CandidateProfile,
): ScoreBreakdown {
  const weights = {
    ageFit:        0.20,
    genderFit:     0.10,
    skillFit:      0.30,
    languageFit:   0.15,
    locationFit:   0.10,
    experienceFit: 0.15,
  };

  // Age fit
  let ageFit = 1.0;
  if (role.ageRange && candidate.age != null) {
    const { min, max } = role.ageRange;
    if (min != null && max != null) {
      if (candidate.age >= min && candidate.age <= max) {
        ageFit = 1.0;
      } else {
        const dist = candidate.age < min ? min - candidate.age : candidate.age - max;
        ageFit = Math.max(0, 1 - dist * 0.1);
      }
    }
  }

  // Gender fit
  let genderFit = 1.0;
  if (role.gender?.length && candidate.gender) {
    genderFit = role.gender.includes(candidate.gender) ? 1.0 : 0.0;
  }

  // Skill overlap
  let skillFit = 1.0;
  if (role.skills?.length) {
    const overlap = candidate.skills.filter(s =>
      role.skills!.some(rs => rs.toLowerCase() === s.toLowerCase()),
    ).length;
    skillFit = role.skills.length > 0 ? overlap / role.skills.length : 1.0;
  }

  // Language overlap
  let languageFit = 1.0;
  if (role.languages?.length) {
    const overlap = candidate.languages.filter(l =>
      role.languages!.some(rl => rl.toLowerCase() === l.toLowerCase()),
    ).length;
    languageFit = role.languages.length > 0 ? overlap / role.languages.length : 1.0;
  }

  // Location fit
  let locationFit = 1.0;
  if (role.location && candidate.location) {
    locationFit = role.location.toLowerCase() === candidate.location.toLowerCase() ? 1.0 : 0.3;
  }

  // Experience (pass-through if available)
  const experienceFit = candidate.previousPerformanceScore != null
    ? candidate.previousPerformanceScore / 100
    : 0.5;

  const total = Math.round(
    (ageFit * weights.ageFit +
      genderFit * weights.genderFit +
      skillFit * weights.skillFit +
      languageFit * weights.languageFit +
      locationFit * weights.locationFit +
      experienceFit * weights.experienceFit) *
      100,
  );

  return {
    ageFit: Math.round(ageFit * 100),
    genderFit: Math.round(genderFit * 100),
    skillFit: Math.round(skillFit * 100),
    languageFit: Math.round(languageFit * 100),
    locationFit: Math.round(locationFit * 100),
    experienceFit: Math.round(experienceFit * 100),
    total,
  };
}

// ─── Intelligence-boosted scoring (Level B) ──────────────────────────────────
//
// Wraps the deterministic scoreCandidate with signals from the
// Role Room Learning Engine (preferences, insights, crew suggestions).
// This creates a feedback loop: creator behaviour → learned preferences →
// candidate ranking — making casting smarter over time.

export interface IntelligenceContext {
  /** Learned preferences from preferencesApi.get() */
  preferences: Array<{
    preferenceKey: string;
    preferenceValue: string;
    category: string;
    confidence: number;
  }>;
  /** Skills the creator has been trending toward (from insights.creativeDna) */
  preferredGenres?: string[];
  /** Visual signatures the creator gravitates toward */
  visualSignatures?: string[];
  /** Crew members the creator has worked well with (high synergy) */
  highSynergyCrew?: Array<{ name: string; synergyScore: number }>;
}

export interface IntelligenceScoreBreakdown extends ScoreBreakdown {
  /** Bonus (or penalty) from intelligence signals, -20 to +20 */
  intelligenceBoost: number;
  /** Human-readable reasons for the boost */
  boostReasons: string[];
  /** Whether the scoring was intelligence-enhanced */
  intelligenceEnhanced: boolean;
}

/**
 * Score a candidate against a role, then apply intelligence boosts
 * derived from the creator's learned preferences and behaviour patterns.
 *
 * The base score (Level A) is always computed first, then intelligence
 * signals add/subtract up to ±20 points to produce the final total.
 */
export function scoreCandidateWithIntelligence(
  role: RoleRequirements,
  candidate: CandidateProfile,
  intelligence: IntelligenceContext,
): IntelligenceScoreBreakdown {
  // Start with deterministic base score
  const base = scoreCandidate(role, candidate);

  let boost = 0;
  const reasons: string[] = [];

  // 1. Preference-based skill boost
  //    If the creator has confirmed/learned preferences for specific skills,
  //    and the candidate has those skills, boost the score.
  const skillPrefs = intelligence.preferences.filter(
    p => p.category === 'casting' || p.category === 'skills' || p.category === 'crew',
  );
  for (const pref of skillPrefs) {
    const prefVal = pref.preferenceValue.toLowerCase();
    if (candidate.skills.some(s => s.toLowerCase().includes(prefVal))) {
      const prefBoost = Math.round(pref.confidence * 5); // max +5 per preference match
      boost += prefBoost;
      reasons.push(`Matcher din preferanse «${pref.preferenceValue}» (+${prefBoost})`);
    }
  }

  // 2. Genre/visual alignment
  //    If the role or candidate aligns with genres the creator naturally gravitates toward
  if (intelligence.preferredGenres?.length && role.skills?.length) {
    const genreOverlap = role.skills.filter(s =>
      intelligence.preferredGenres!.some(g => g.toLowerCase() === s.toLowerCase()),
    ).length;
    if (genreOverlap > 0) {
      const genreBoost = Math.min(genreOverlap * 3, 8);
      boost += genreBoost;
      reasons.push(`Rollen matcher dine foretrukne sjangre (+${genreBoost})`);
    }
  }

  // 3. Visual signature alignment
  if (intelligence.visualSignatures?.length && candidate.skills.length) {
    const visualMatch = candidate.skills.filter(s =>
      intelligence.visualSignatures!.some(v => v.toLowerCase().includes(s.toLowerCase())),
    ).length;
    if (visualMatch > 0) {
      const vBoost = Math.min(visualMatch * 2, 6);
      boost += vBoost;
      reasons.push(`Kandidaten matcher dine visuelle signaturer (+${vBoost})`);
    }
  }

  // 4. Past crew synergy
  //    If this candidate name matches a crew member the creator has high synergy with
  if (intelligence.highSynergyCrew?.length && candidate.name) {
    const synergyMatch = intelligence.highSynergyCrew.find(
      c => c.name.toLowerCase() === candidate.name!.toLowerCase(),
    );
    if (synergyMatch) {
      const synergyBoost = Math.round(synergyMatch.synergyScore * 10); // max +10
      boost += synergyBoost;
      reasons.push(`Høy synergi fra tidligere samarbeid (+${synergyBoost})`);
    }
  }

  // 5. Preference penalties
  //    Apply negative signals from learned dislikes
  const negativePrefs = intelligence.preferences.filter(
    p => p.preferenceKey.startsWith('avoid_') || p.preferenceKey.startsWith('dislike_'),
  );
  for (const pref of negativePrefs) {
    const prefVal = pref.preferenceValue.toLowerCase();
    if (candidate.skills.some(s => s.toLowerCase().includes(prefVal))) {
      const penalty = -Math.round(pref.confidence * 4);
      boost += penalty;
      reasons.push(`Matcher uønsket egenskap «${pref.preferenceValue}» (${penalty})`);
    }
  }

  // Clamp boost to ±20
  boost = Math.max(-20, Math.min(20, boost));

  // Clamp final total to 0-100
  const total = Math.max(0, Math.min(100, base.total + boost));

  return {
    ...base,
    total,
    intelligenceBoost: boost,
    boostReasons: reasons,
    intelligenceEnhanced: reasons.length > 0,
  };
}
