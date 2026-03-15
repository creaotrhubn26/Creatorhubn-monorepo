import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  producerWorkflowService,
  type AddProducerReviewCommentInput,
  type CreateProducerReviewInput,
  type ProducerClientReview,
  type ProducerReviewComment,
  type SetProducerReviewDecisionInput,
} from '../services/producerWorkflowService';

export function useProducerReviews(projectId?: string) {
  const [items, setItems] = useState<ProducerClientReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setItems([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextItems = await producerWorkflowService.getReviews(projectId);
      setItems(nextItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente review-flyt');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createReview = useCallback(async (payload: CreateProducerReviewInput) => {
    if (!projectId) throw new Error('Mangler projectId');
    const created = await producerWorkflowService.createReview(projectId, payload);
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
      const updated = await producerWorkflowService.setReviewDecision(projectId, reviewId, payload);
      setItems((prev) => prev.map((review) => (review.id === reviewId ? { ...review, ...updated } : review)));
      return updated;
    },
    [projectId],
  );

  const summary = useMemo(() => {
    return items.reduce(
      (acc, review) => {
        const status = review.status || 'pending';
        if (status === 'approved') acc.approved += 1;
        else if (status === 'rejected') acc.rejected += 1;
        else if (status === 'changes_requested') acc.changesRequested += 1;
        else acc.pending += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, changesRequested: 0 },
    );
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

