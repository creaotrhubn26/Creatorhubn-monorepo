import type { ProducerPhase } from './producerWorkflowService';

export type ProducerWorkflowFocusPanel = 'economy' | 'reviews' | 'timeline';
export type ProducerWorkflowEconomyView = 'overview' | 'budget' | 'approvals';
export type ProducerWorkflowApprovalTemplate = 'storyboard' | 'manuscript' | 'shotlist';

export interface ProducerWorkflowFocusPayload {
  projectId: string;
  panel: ProducerWorkflowFocusPanel;
  reviewId?: string;
  timelineItemId?: string;
  agreementId?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  economyView?: ProducerWorkflowEconomyView;
  focusedPhase?: ProducerPhase | 'all';
  approvalTemplate?: ProducerWorkflowApprovalTemplate;
}

const PRODUCER_WORKFLOW_FOCUS_EVENT_NAME = 'role-room:producer-workflow-focus';

export function emitProducerWorkflowFocusEvent(payload: ProducerWorkflowFocusPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProducerWorkflowFocusPayload>(PRODUCER_WORKFLOW_FOCUS_EVENT_NAME, {
      detail: payload,
    }),
  );
}

export function onProducerWorkflowFocusEvent(
  handler: (payload: ProducerWorkflowFocusPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ProducerWorkflowFocusPayload>;
    if (!customEvent.detail) {
      return;
    }
    handler(customEvent.detail);
  };

  window.addEventListener(PRODUCER_WORKFLOW_FOCUS_EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(PRODUCER_WORKFLOW_FOCUS_EVENT_NAME, listener as EventListener);
}
