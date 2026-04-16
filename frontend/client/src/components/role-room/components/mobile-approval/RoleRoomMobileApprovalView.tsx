// @ts-nocheck
/**
 * RoleRoomMobileApprovalView — mobile + iPad Godkjenning surface.
 *
 * Covers backlog item 126 (three sections) and is the orchestrator for
 * MobileReviewCard + MobileReviewDetailSheet. Skeleton + empty + error states
 * live here so MobileReviewCard stays purely presentational.
 *
 * Data flows through useProducerReviews (already project-scoped). Permissions
 * must be passed from the parent because they depend on project role.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

import { useProducerReviews } from '../../hooks/useProducerReviews';
import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';
import MobileReviewCard, { MobileReviewCardItem } from './MobileReviewCard';
import MobileReviewDetailSheet, {
  ReviewDecision,
  ReviewDetailData,
} from './MobileReviewDetailSheet';
import { bucketFor } from './reviewStatusVocabulary';
import IPadMasterDetailLayout from '../ipad/IPadMasterDetailLayout';
import { Button } from '@mui/material';

interface RoleRoomMobileApprovalViewProps {
  projectId: string | null;
  currentUserId: string;
  mode: RoleRoomViewportMode;
  canApprove?: boolean;
  canRequestChanges?: boolean;
  canReject?: boolean;
  canComment?: boolean;
  /** Optional display-name resolver so cards can show requester name (item 139). */
  resolveUserDisplay?: (userId: string | null | undefined) => { name: string; role?: string | null } | null;
}

function toCardItem(
  review: any,
  resolveUserDisplay?: RoleRoomMobileApprovalViewProps['resolveUserDisplay'],
): MobileReviewCardItem {
  const comments = Array.isArray(review.comments) ? review.comments : [];
  const lastComment = comments[comments.length - 1];
  const requester = resolveUserDisplay?.(review.requested_by_user_id);
  return {
    id: review.id,
    title: review.title,
    status: review.status,
    metadata: review.metadata ?? null,
    dueAt: review.due_at ?? null,
    lastCommentText: lastComment?.comment_text ?? null,
    lastCommentAuthor: lastComment?.author_role ?? null,
    commentCount: comments.length,
    requesterDisplay: requester?.name ?? null,
    requesterRole: requester?.role ?? null,
  };
}

function toDetailData(
  review: any,
  resolveUserDisplay?: RoleRoomMobileApprovalViewProps['resolveUserDisplay'],
): ReviewDetailData {
  const requester = resolveUserDisplay?.(review.requested_by_user_id);
  return {
    id: review.id,
    title: review.title,
    description: review.description ?? null,
    status: review.status,
    metadata: review.metadata ?? null,
    dueAt: review.due_at ?? null,
    requesterDisplay: requester?.name ?? null,
    requesterRole: requester?.role ?? null,
    comments: (review.comments ?? []).map((comment: any) => {
      const author = resolveUserDisplay?.(comment.author_user_id);
      return {
        id: comment.id,
        author: author?.name ?? comment.author_role ?? null,
        role: comment.author_role,
        text: comment.comment_text,
        createdAt: comment.created_at,
      };
    }),
  };
}

export const RoleRoomMobileApprovalView: React.FC<RoleRoomMobileApprovalViewProps> = ({
  projectId,
  currentUserId,
  mode,
  canApprove,
  canRequestChanges,
  canReject,
  canComment,
  resolveUserDisplay,
}) => {
  const {
    items,
    loading,
    error,
    setDecision,
    addComment,
  } = useProducerReviews(projectId ?? undefined);

  const [openReviewId, setOpenReviewId] = useState<string | null>(null);

  const { awaitingClient, awaitingYou, done } = useMemo(() => {
    const groups = { awaitingClient: [] as any[], awaitingYou: [] as any[], done: [] as any[] };
    (items ?? []).forEach((review) => {
      const isDecider = review.decision_by_user_id
        ? review.decision_by_user_id === currentUserId
        : Boolean(canApprove || canRequestChanges || canReject);
      const bucket = bucketFor(review.status, isDecider);
      groups[bucket].push(review);
    });
    return groups;
  }, [items, currentUserId, canApprove, canRequestChanges, canReject]);

  const openReview = useMemo(
    () => (items ?? []).find((r) => r.id === openReviewId) ?? null,
    [items, openReviewId],
  );

  const detailData = useMemo(
    () => (openReview ? toDetailData(openReview, resolveUserDisplay) : null),
    [openReview, resolveUserDisplay],
  );

  const handleDecision = useCallback(
    async (decision: ReviewDecision, reason?: string) => {
      if (!openReviewId) return;
      await setDecision(openReviewId, {
        decision,
        decision_reason: reason,
      });
    },
    [openReviewId, setDecision],
  );

  const handleAddComment = useCallback(
    async (text: string) => {
      if (!openReviewId) return;
      await addComment(openReviewId, { comment_text: text });
    },
    [openReviewId, addComment],
  );

  if (!projectId) {
    return (
      <Alert severity="info" variant="outlined">
        Velg et prosjekt for å se godkjenninger.
      </Alert>
    );
  }

  if (loading && items.length === 0) {
    return (
      <Stack spacing={1.5}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={96} />
        ))}
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Ingen reviewer ennå for dette prosjektet.
        </Typography>
      </Box>
    );
  }

  const isTabletMode = mode === 'tabletPortrait' || mode === 'tabletLandscape';

  const master = (
    <Stack spacing={3}>
      <ApprovalSection
        title="Venter på deg"
        reviews={awaitingYou}
        resolveUserDisplay={resolveUserDisplay}
        onOpen={setOpenReviewId}
        emptyLabel="Ingenting venter på deg."
      />
      <ApprovalSection
        title="Venter på klient"
        reviews={awaitingClient}
        resolveUserDisplay={resolveUserDisplay}
        onOpen={setOpenReviewId}
        emptyLabel="Ingenting venter på klient."
      />
      <ApprovalSection
        title="Ferdig"
        reviews={done}
        resolveUserDisplay={resolveUserDisplay}
        onOpen={setOpenReviewId}
        emptyLabel="Ingen ferdige reviewer ennå."
      />
    </Stack>
  );

  // On iPad, render the detail inline inside the split layout. On phone the
  // MobileReviewDetailSheet keeps its fullscreen-Dialog behavior.
  const inlineDetail = (
    <MobileReviewDetailSheet
      open
      inline
      onClose={() => setOpenReviewId(null)}
      mode={mode}
      review={detailData}
      canApprove={canApprove}
      canRequestChanges={canRequestChanges}
      canReject={canReject}
      canComment={canComment}
      onDecision={handleDecision}
      onAddComment={handleAddComment}
    />
  );

  const emptyDetail = (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Velg en review fra listen for å se detaljer.
      </Typography>
      {awaitingYou.length > 0 ? (
        <Button
          variant="text"
          onClick={() => setOpenReviewId(awaitingYou[0].id)}
        >
          Åpne første som venter på deg
        </Button>
      ) : null}
    </Box>
  );

  if (isTabletMode) {
    return (
      <IPadMasterDetailLayout
        mode={mode}
        enabled
        hasSelection={openReviewId !== null}
        onCloseDetail={() => setOpenReviewId(null)}
        detailTitle={openReview?.title}
        master={master}
        detail={inlineDetail}
        emptyDetail={emptyDetail}
      />
    );
  }

  return (
    <>
      {master}
      <MobileReviewDetailSheet
        open={openReviewId !== null}
        onClose={() => setOpenReviewId(null)}
        mode={mode}
        review={detailData}
        canApprove={canApprove}
        canRequestChanges={canRequestChanges}
        canReject={canReject}
        canComment={canComment}
        onDecision={handleDecision}
        onAddComment={handleAddComment}
      />
    </>
  );
};

interface ApprovalSectionProps {
  title: string;
  reviews: any[];
  resolveUserDisplay?: RoleRoomMobileApprovalViewProps['resolveUserDisplay'];
  onOpen: (id: string) => void;
  emptyLabel: string;
}

const ApprovalSection: React.FC<ApprovalSectionProps> = ({
  title,
  reviews,
  resolveUserDisplay,
  onOpen,
  emptyLabel,
}) => {
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {reviews.length > 0 ? (
          <Typography variant="caption" color="text.secondary">
            {reviews.length}
          </Typography>
        ) : null}
      </Stack>
      {reviews.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {reviews.map((review) => (
            <MobileReviewCard
              key={review.id}
              review={toCardItem(review, resolveUserDisplay)}
              onOpen={onOpen}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default RoleRoomMobileApprovalView;
