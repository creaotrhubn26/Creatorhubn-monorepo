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
 * Approksimasjon av hvilke steg som er fullført basert på producerWorkflowStatus.
 * Mangler granulær backend-signaler — vi gjør et best-effort som er bedre enn
 * ingenting.
 */
export function deriveCompletedWorkflowSteps(
  status: 'planning' | 'awaiting_client' | 'changes_requested' | 'approved' | null | undefined,
): ReadonlyArray<WorkflowStepKey> {
  if (status === 'approved') {
    return ['brief', 'story', 'storyboard', 'approval'];
  }
  if (status === 'awaiting_client' || status === 'changes_requested') {
    return ['brief', 'story', 'storyboard'];
  }
  return [];
}
