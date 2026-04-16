/**
 * Mobile short-status vocabulary for reviews (backlog item 144).
 *
 * The desktop panel uses "Venter" / "Endringer ønsket" which are too long for
 * mobile cards. This file maps the backend enum to the mobile labels
 * "Utkast / Sendt / Åpnet / Godkjent / Endring" requested in the spec, plus
 * the colours used by MobileReviewCard status chips.
 *
 * Only used by the mobile/iPad approval surface — desktop continues to use
 * REVIEW_STATUS_LABELS from utils/producerWorkflow.ts.
 */

export type MobileReviewStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'approved'
  | 'changes_requested'
  | 'rejected';

export interface MobileReviewStatusPresentation {
  label: string;
  color: string;
  bg: string;
}

const PRESENTATION: Record<MobileReviewStatus, MobileReviewStatusPresentation> = {
  draft: { label: 'Utkast', color: '#475569', bg: 'rgba(100,116,139,0.14)' },
  sent: { label: 'Sendt', color: '#0369a1', bg: 'rgba(14,165,233,0.14)' },
  opened: { label: 'Åpnet', color: '#6d28d9', bg: 'rgba(124,58,237,0.14)' },
  approved: { label: 'Godkjent', color: '#047857', bg: 'rgba(16,185,129,0.14)' },
  changes_requested: { label: 'Endring', color: '#b45309', bg: 'rgba(245,158,11,0.18)' },
  rejected: { label: 'Avslått', color: '#b91c1c', bg: 'rgba(239,68,68,0.16)' },
};

/**
 * Map the backend `ProducerClientReview.status` (plus optional metadata) to
 * the mobile status. The backend currently exposes pending/approved/rejected/
 * changes_requested — "sent" and "opened" are mobile-only derivations:
 *   - `sent` == pending without any opens recorded in metadata
 *   - `opened` == pending with `metadata.opened_at` set
 *   - `draft` is only used if the backend adds it later; kept here so the
 *     card never crashes on an unknown enum value.
 */
export function mapReviewStatusToMobile(
  backendStatus: string | null | undefined,
  metadata?: Record<string, unknown> | null,
): MobileReviewStatus {
  switch (backendStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'changes_requested':
      return 'changes_requested';
    case 'draft':
      return 'draft';
    case 'pending': {
      const opened = metadata && typeof metadata === 'object' ? metadata['opened_at'] : undefined;
      return opened ? 'opened' : 'sent';
    }
    default:
      return 'sent';
  }
}

export function presentReviewStatus(status: MobileReviewStatus): MobileReviewStatusPresentation {
  return PRESENTATION[status];
}

/** Bucket a review into the three mobile lists described by item 126. */
export type ApprovalBucket = 'awaitingClient' | 'awaitingYou' | 'done';

export function bucketFor(
  backendStatus: string | null | undefined,
  currentUserIsDecider: boolean,
): ApprovalBucket {
  if (backendStatus === 'approved' || backendStatus === 'rejected') return 'done';
  if (backendStatus === 'changes_requested') return 'awaitingYou';
  return currentUserIsDecider ? 'awaitingYou' : 'awaitingClient';
}
