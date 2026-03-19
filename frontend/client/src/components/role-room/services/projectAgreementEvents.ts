export type ProjectAgreementEventMutation =
  | 'created'
  | 'updated'
  | 'status_updated'
  | 'signature_updated'
  | 'deleted'
  | 'reloaded';

export interface ProjectAgreementEventPayload {
  projectId: string;
  mutation: ProjectAgreementEventMutation;
  agreementId?: string;
}

const PROJECT_AGREEMENT_EVENT_NAME = 'role-room:project-agreements';

export function emitProjectAgreementEvent(payload: ProjectAgreementEventPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProjectAgreementEventPayload>(PROJECT_AGREEMENT_EVENT_NAME, {
      detail: payload,
    }),
  );
}

export function onProjectAgreementEvent(
  handler: (payload: ProjectAgreementEventPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ProjectAgreementEventPayload>;
    if (!customEvent.detail) {
      return;
    }
    handler(customEvent.detail);
  };

  window.addEventListener(PROJECT_AGREEMENT_EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(PROJECT_AGREEMENT_EVENT_NAME, listener as EventListener);
}
