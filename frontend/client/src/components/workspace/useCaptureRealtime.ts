/**
 * Workspace Capture updates carried by the shared per-user event stream.
 * Every consumer in the tab is multiplexed by useUserEventStream, so Capture
 * no longer opens a second socket or places a durable session token in a URL.
 */
import { useRef } from 'react';
import { useUserEventStream, type RealtimeUserEvent } from '@/hooks/useUserEventStream';

function eventBelongsToProject(event: RealtimeUserEvent, projectId: string): boolean {
  return 'projectId' in event && event.projectId === projectId;
}

function capturePayload(event: RealtimeUserEvent): unknown {
  switch (event.kind) {
    case 'capture.activity-recorded':
      return event.activity;
    case 'capture.handoff-triggered':
      return {
        type: 'handoff_triggered',
        handoffId: event.handoffId,
        submittedCount: event.submittedCount,
        requestedCount: event.requestedCount,
      };
    case 'capture.client-review':
      return { type: 'client_review', review: event.review };
    default:
      return event;
  }
}

export function useCaptureRealtime(projectId: string, onEvent?: (payload: any) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const status = useUserEventStream({
    enabled: Boolean(projectId && projectId !== 'sample'),
    onEvent: (event) => {
      if (!eventBelongsToProject(event, projectId)) return;
      if (event.kind.startsWith('capture.') || event.kind.startsWith('shot.')) {
        onEventRef.current?.(capturePayload(event));
      }
    },
    // Events can be missed while disconnected. Existing Capture consumers
    // treat an empty payload as a signal to run their complete REST refetch.
    onReconnect: () => onEventRef.current?.(null),
  });

  return { live: status === 'connected' };
}
