/**
 * castingTypes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Canonical type definitions for the entire casting domain.
 *
 * ALL casting components, services, and stores must import types from here —
 * never define local `Candidate`, `CandidateStatus`, or `WorkflowStatus`
 * interfaces in individual components.
 *
 * Two status systems coexist because they model different stages:
 *
 *   CandidateStatus  → casting-phase status (pool → shortlist → confirmed)
 *   WorkflowStatus   → production-pipeline status (audition → contract → set)
 *
 * A candidate's CandidateStatus drives the KanbanPanel / ManagementPanel,
 * while WorkflowStatus drives the workflow stepper on the detail/sidebar view.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Candidate Status (casting phase) ────────────────────────────────────────

/**
 * The 6-value status used in Kanban columns and Candidate Management filters.
 * Represents where the candidate sits in the casting decision pipeline.
 */
export type CandidateStatus =
  | 'pending'
  | 'requested'
  | 'shortlist'
  | 'selected'
  | 'confirmed'
  | 'rejected';

/** Norwegian display labels for each casting status. */
export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  pending:   'Ingen status',
  requested: 'Forespurt',
  shortlist: 'Vurderes',
  selected:  'Valgt',
  confirmed: 'Bekreftet',
  rejected:  'Avvist',
};

/** Hex colour tokens for each casting status. */
export const CANDIDATE_STATUS_COLORS: Record<CandidateStatus, string> = {
  pending:   '#6b7280',
  requested: '#00d4ff',
  shortlist: '#ffb800',
  selected:  '#8b5cf6',
  confirmed: '#10b981',
  rejected:  '#ef4444',
};

/** Convenience array for KanbanPanel columns and filter chips. */
export const CANDIDATE_STATUS_LIST: {
  status: CandidateStatus;
  label: string;
  color: string;
}[] = (Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[]).map(s => ({
  status: s,
  label: CANDIDATE_STATUS_LABELS[s],
  color: CANDIDATE_STATUS_COLORS[s],
}));

// ─── Workflow Status (production pipeline) ───────────────────────────────────

/**
 * The 8-value pipeline used in CandidateWorkflowStatus stepper.
 * Represents the operational journey from search to wrapped production.
 */
export type WorkflowStatus =
  | 'pending'
  | 'auditioned'
  | 'selected'
  | 'offer_sent'
  | 'confirmed'
  | 'declined'
  | 'contracted'
  | 'production';

/** Norwegian display labels for each workflow status. */
export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  pending:    'Venter',
  auditioned: 'Audition',
  selected:   'Valgt',
  offer_sent: 'Tilbud sendt',
  confirmed:  'Bekreftet',
  declined:   'Avslått',
  contracted: 'Kontrakt',
  production: 'Produksjon',
};

/** Hex colour tokens for each workflow status. */
export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  pending:    '#9ca3af',
  auditioned: '#f59e0b',
  selected:   '#10b981',
  offer_sent: '#3b82f6',
  confirmed:  '#8b5cf6',
  declined:   '#ef4444',
  contracted: '#06b6d4',
  production: '#ec4899',
};

// ─── Candidate (global pool entity) ──────────────────────────────────────────

/**
 * A person in the global talent pool.
 * This is the **single source of truth** — project-specific data lives in
 * `ProjectCandidate`.
 */
export interface PoolCandidate {
  id: string;
  name: string;
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
  };
  photos: string[];
  videos: string[];
  modelUrl?: string;
  personality?: string;
  notes?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── Candidate in a project (relational) ─────────────────────────────────────

/**
 * The canonical in-project candidate shape used across KanbanPanel,
 * CandidateManagementPanel, and the workflow stepper.
 *
 * `Candidate` from `models/casting.ts` is the legacy equivalent and will be
 * gradually replaced by imports from this file.
 */
export interface ProjectCandidate {
  id: string;
  /** Pool candidate ID (null when created directly in a project). */
  poolCandidateId?: string | null;
  /** Project this candidate belongs to. */
  projectId: string;
  /** Role(s) the candidate is linked to in this project. */
  roleIds: string[];

  // ── Display fields (denormalised from pool for offline/quick access) ──
  name: string;
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
  };
  photos: string[];
  videos: string[];
  modelUrl?: string;

  // ── Casting state ──
  status: CandidateStatus;
  workflowStatus: WorkflowStatus;

  // ── Evaluation ──
  auditionNotes: string;
  auditionRating?: number;
  /** Overall match score 0–100 (rule engine computed). */
  scoreTotal?: number;
  /** Breakdown of how the score was calculated. */
  scoreBreakdown?: Record<string, number>;
  /** Risk flags surfaced by the scoring engine. */
  riskFlags?: string[];

  // ── Metadata ──
  source: 'pool' | 'import' | 'manual';
  createdAt: string;
  updatedAt: string;
  consent?: CandidateConsent[];
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

export interface CandidateConsent {
  type: string;
  granted: boolean;
  date: string;
  details?: string;
}

// ─── Workflow transition event (audit log) ───────────────────────────────────

export interface CastingEvent {
  id: string;
  projectId: string;
  actorUserId: string;
  type:
    | 'candidate_added'
    | 'candidate_removed'
    | 'status_changed'
    | 'workflow_changed'
    | 'notes_updated'
    | 'bulk_status_changed'
    | 'bulk_deleted'
    | 'imported_from_pool';
  payload: Record<string, unknown>;
  createdAt: string;
}

// ─── Helpers re-exported by CandidateWorkflowStatus ──────────────────────────

/**
 * Returns full metadata for a given CandidateStatus value.
 * Single source of truth — replaces duplicated `getStatusColor` / `getStatusLabel`
 * functions in KanbanPanel, CandidateManagementPanel, etc.
 */
export function getCandidateStatusMeta(status: CandidateStatus | string): {
  label: string;
  color: string;
  status: CandidateStatus;
} {
  const key = (status in CANDIDATE_STATUS_LABELS
    ? status
    : 'pending') as CandidateStatus;
  return {
    status: key,
    label: CANDIDATE_STATUS_LABELS[key],
    color: CANDIDATE_STATUS_COLORS[key],
  };
}

/**
 * Returns full metadata for a given WorkflowStatus value.
 * Replaces `getWorkflowStatusColor` / `getWorkflowStatusLabel`.
 */
export function getWorkflowStatusMeta(status: WorkflowStatus | 'declined' | string): {
  label: string;
  color: string;
  status: WorkflowStatus;
} {
  if (status === 'declined') {
    return { status: 'declined', label: 'Avslått', color: '#ef4444' };
  }
  const key = (status in WORKFLOW_STATUS_LABELS
    ? status
    : 'pending') as WorkflowStatus;
  return {
    status: key,
    label: WORKFLOW_STATUS_LABELS[key],
    color: WORKFLOW_STATUS_COLORS[key],
  };
}
