/**
 * Helpers for content-producer workflow-stepper.
 *
 * Mapper aktiv planner-surface (+ workspace-fokus) til hvilket steg som
 * skal være highlighted i workflow-stepperen.
 */

import type { ClientPortalWorkspace } from './clientPortal';
import type { WorkflowStepKey } from '../components/ContentProducerWorkflowStepper';

export type ContentProducerSurfaceLike =
  | 'overview'
  | 'project_room'
  | 'approval'
  | 'delivery'
  | 'economy'
  | string
  | null
  | undefined;

export function deriveActiveWorkflowStep(
  surface: ContentProducerSurfaceLike,
  workspace?: ClientPortalWorkspace | string | null,
): WorkflowStepKey | null {
  switch (surface) {
    case 'approval':
      return 'approval';
    case 'delivery':
      return 'delivery';
    case 'economy':
      return 'economy';
    case 'project_room':
      if (workspace === 'storyboard') return 'storyboard';
      if (workspace === 'manuscript' || workspace === 'shotlist') return 'story';
      return 'brief';
    case 'overview':
    default:
      return null;
  }
}

/**
 * Hvilke steg er fullført. Brief/story/storyboard/approval avledes fra
 * producerWorkflowStatus (review-drevet). Levering og Økonomi har ingen
 * pålitelig avledet «ferdig»-signal, så de markeres eksplisitt av produsenten
 * og leses fra `producerPhaseCompletion` (et ISO-tidspunkt = fullført).
 */
export function deriveCompletedWorkflowSteps(
  status: 'planning' | 'awaiting_client' | 'changes_requested' | 'approved' | null | undefined,
  phaseCompletion?: { delivery?: string | null; economy?: string | null } | null,
): ReadonlyArray<WorkflowStepKey> {
  const completed: WorkflowStepKey[] = [];
  if (status === 'approved') {
    completed.push('brief', 'story', 'storyboard', 'approval');
  } else if (status === 'awaiting_client' || status === 'changes_requested') {
    completed.push('brief', 'story', 'storyboard');
  }
  // Eksplisitt markerte faser — uavhengig av review-status.
  if (phaseCompletion?.delivery) completed.push('delivery');
  if (phaseCompletion?.economy) completed.push('economy');
  return completed;
}
