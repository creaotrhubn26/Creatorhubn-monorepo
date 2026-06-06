import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  producerWorkflowService,
  type AddProducerReviewCommentInput,
  type CreateProducerReviewInput,
  type ProducerClientReview,
  type ProducerReviewComment,
  type SetProducerReviewDecisionInput,
  summarizeProducerReviewStatuses,
} from '../services/producerWorkflowService';
import { onProducerWorkflowEvent } from '../services/producerWorkflowEvents';

interface UseProducerReviewsOptions {
  /**
   * Sett > 0 for å poll'e backend på intervall (ms) så klient-beslutninger og
   * -kommentarer som skjer i klientportalen (en annen enhet/sesjon) dukker opp
   * hos produsenten i tilnærmet sanntid — uten WebSocket (som ikke går gjennom
   * Vercel-rewriten). `onProducerWorkflowEvent` dekker kun samme fane, så uten
   * polling ser ikke Stig klientens handlinger før han laster på nytt.
   */
  livePollMs?: number;
}

export function useProducerReviews(projectId?: string, options?: UseProducerReviewsOptions) {
  const livePollMs = options?.livePollMs ?? 0;
  const [items, setItems] = useState<ProducerClientReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  // `silent` brukes av live-polling: ingen spinner og ingen feilbanner som
  // overskriver en allerede god liste hvis ett enkelt bakgrunnskall feiler.
  const runLoad = useCallback(async (silent: boolean) => {
    const requestId = ++requestIdRef.current;
    if (!projectId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const nextItems = await producerWorkflowService.getReviews(projectId);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(nextItems);
      setLastSyncedAt(Date.now());
      if (silent) {
        setError(null);
      }
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente review-flyt');
      }
    } finally {
      if (requestId === requestIdRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [projectId]);

  const load = useCallback(() => runLoad(false), [runLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  useEffect(() => {
    if (!projectId) {
      return () => undefined;
    }

    return onProducerWorkflowEvent((payload) => {
      if (payload.projectId !== projectId || payload.domain !== 'reviews') {
        return;
      }
      void load();
    });
  }, [load, projectId]);

  // Live-polling: pauses når fanen er skjult (sparer kall), og henter en gang
  // umiddelbart når Stig kommer tilbake til fanen.
  useEffect(() => {
    if (!projectId || livePollMs <= 0 || typeof window === 'undefined') {
      return () => undefined;
    }

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      void runLoad(true);
    };
    const timer = window.setInterval(tick, livePollMs);

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void runLoad(true);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      window.clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [projectId, livePollMs, runLoad]);

  const createReview = useCallback(async (payload: CreateProducerReviewInput) => {
    if (!projectId) throw new Error('Mangler projectId');
    const created = await producerWorkflowService.createReviewWithTimeline(projectId, payload);
    setItems((prev) => [created, ...prev]);
    return created;
  }, [projectId]);

  const addComment = useCallback(
    async (reviewId: string, payload: AddProducerReviewCommentInput): Promise<ProducerReviewComment> => {
      if (!projectId) throw new Error('Mangler projectId');
      const comment = await producerWorkflowService.addReviewComment(projectId, reviewId, payload);
      setItems((prev) =>
        prev.map((review) => (
          review.id === reviewId
            ? { ...review, comments: [...(review.comments ?? []), comment] }
            : review
        )),
      );
      return comment;
    },
    [projectId],
  );

  const setDecision = useCallback(
    async (reviewId: string, payload: SetProducerReviewDecisionInput) => {
      if (!projectId) throw new Error('Mangler projectId');
      const updated = await producerWorkflowService.setReviewDecisionWithTimeline(projectId, reviewId, payload);
      setItems((prev) => prev.map((review) => (review.id === reviewId ? { ...review, ...updated } : review)));
      return updated;
    },
    [projectId],
  );

  const summary = useMemo(() => {
    const reviewSummary = summarizeProducerReviewStatuses(items);
    return {
      pending: reviewSummary.pendingReviews,
      approved: reviewSummary.approvedReviews,
      rejected: reviewSummary.rejectedReviews,
      changesRequested: reviewSummary.changesRequestedReviews,
    };
  }, [items]);

  return {
    items,
    summary,
    loading,
    error,
    lastSyncedAt,
    livePollActive: livePollMs > 0,
    reload: load,
    createReview,
    addComment,
    setDecision,
  };
}
