export type ProducerWorkflowEventDomain = 'timeline' | 'economy' | 'reviews' | 'project' | 'notifications';
export type ProducerWorkflowEventMutation = 'created' | 'updated' | 'deleted' | 'reloaded';

export interface ProducerWorkflowEventPayload {
  projectId: string;
  domain: ProducerWorkflowEventDomain;
  mutation: ProducerWorkflowEventMutation;
  entityId?: string;
}

const PRODUCER_WORKFLOW_EVENT_NAME = 'role-room:producer-workflow';

export function emitProducerWorkflowEvent(payload: ProducerWorkflowEventPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProducerWorkflowEventPayload>(PRODUCER_WORKFLOW_EVENT_NAME, {
      detail: payload,
    }),
  );
}

export function onProducerWorkflowEvent(
  handler: (payload: ProducerWorkflowEventPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ProducerWorkflowEventPayload>;
    if (!customEvent.detail) {
      return;
    }
    handler(customEvent.detail);
  };

  window.addEventListener(PRODUCER_WORKFLOW_EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(PRODUCER_WORKFLOW_EVENT_NAME, listener as EventListener);
}
