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

export function useProducerReviews(projectId?: string) {
  const [items, setItems] = useState<ProducerClientReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!projectId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextItems = await producerWorkflowService.getReviews(projectId);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(nextItems);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente review-flyt');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [projectId]);

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
    reload: load,
    createReview,
    addComment,
    setDecision,
  };
}
