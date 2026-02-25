/**
 * casting/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Barrel export for the casting domain layer.
 *
 * Usage:
 *   import { CandidateStatus, getCandidateStatusMeta, useCastingStore } from '../casting';
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Domain types ────────────────────────────────────────────────────────────
export type {
  CandidateStatus,
  WorkflowStatus,
  PoolCandidate,
  ProjectCandidate,
  CandidateConsent,
  CastingEvent,
} from './domain/castingTypes';

export {
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_COLORS,
  CANDIDATE_STATUS_LIST,
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUS_COLORS,
  getCandidateStatusMeta,
  getWorkflowStatusMeta,
} from './domain/castingTypes';

// ── Workflow engine ─────────────────────────────────────────────────────────
export type {
  TransitionResult,
  WorkflowTransitionContext,
  BulkTransitionResult,
  RoleRequirements,
  CandidateProfile,
  ScoreBreakdown,
  IntelligenceContext,
  IntelligenceScoreBreakdown,
} from './domain/workflowEngine';

export {
  transitionCandidateStatus,
  transitionWorkflowStatus,
  getAllowedCandidateTransitions,
  getAllowedWorkflowTransitions,
  bulkTransitionCandidateStatus,
  scoreCandidate,
  scoreCandidateWithIntelligence,
} from './domain/workflowEngine';

// ── Store ───────────────────────────────────────────────────────────────────
export {
  useCastingStore,
  selectProjectCandidates,
  selectPoolCandidates,
  selectCountsByStatus,
  selectSelectedCandidate,
  selectFilteredCandidates,
  selectStatusSummary,
} from './store/useCastingStore';

export type {
  CastingStoreState,
  CastingStoreActions,
} from './store/useCastingStore';
