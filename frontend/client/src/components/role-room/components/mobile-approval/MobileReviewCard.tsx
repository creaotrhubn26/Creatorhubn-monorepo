// @ts-nocheck
/**
 * MobileReviewCard — compact review card for the mobile Godkjenning feed.
 *
 * Covers backlog items 127 (status, frist, siste kommentar), 139 (klientnavn
 * og rolle) and 144 (kort statusord).
 */

import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ChatBubbleOutline as CommentIcon,
  Event as EventIcon,
} from '@mui/icons-material';

import {
  mapReviewStatusToMobile,
  presentReviewStatus,
} from './reviewStatusVocabulary';

export interface MobileReviewCardItem {
  id: string;
  title: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  dueAt?: string | null;
  lastCommentText?: string | null;
  lastCommentAuthor?: string | null;
  commentCount?: number;
  requesterDisplay?: string | null;
  requesterRole?: string | null;
}

interface MobileReviewCardProps {
  review: MobileReviewCardItem;
  onOpen: (id: string) => void;
}

function formatDue(iso?: string | null): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const now = Date.now();
  const diffMs = due.getTime() - now;
  const days = Math.round(diffMs / 86_400_000);
  try {
    const formatted = new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: 'short' }).format(due);
    if (days < 0) return `Frist ${formatted} (${Math.abs(days)} d over)`;
    if (days === 0) return `Frist i dag`;
    if (days === 1) return `Frist i morgen`;
    return `Frist ${formatted}`;
  } catch {
    return due.toLocaleDateString();
  }
}

export const MobileReviewCard: React.FC<MobileReviewCardProps> = ({ review, onOpen }) => {
  const mobileStatus = mapReviewStatusToMobile(review.status, review.metadata);
  const { label, color, bg } = presentReviewStatus(mobileStatus);
  const dueLabel = formatDue(review.dueAt);
  const isOverdue = Boolean(
    review.dueAt && new Date(review.dueAt).getTime() < Date.now() && mobileStatus !== 'approved' && mobileStatus !== 'rejected',
  );

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Åpne review ${review.title}`}
      onClick={() => onOpen(review.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(review.id);
        }
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        borderRadius: 'var(--rr-card-radius, 12px)',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        minHeight: 'var(--rr-touch-target-min, 44px)',
        '&:focus-visible': {
          outline: '2px solid #6366f1',
          outlineOffset: 2,
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {review.title}
          </Typography>
          {review.requesterDisplay ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {review.requesterDisplay}
              {review.requesterRole ? ` • ${review.requesterRole}` : ''}
            </Typography>
          ) : null}
        </Box>
        <Chip
          size="small"
          label={label}
          aria-label={`Status: ${label}`}
          sx={{ bgcolor: bg, color, fontWeight: 700 }}
        />
      </Stack>

      {review.lastCommentText ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {review.lastCommentAuthor ? <strong>{review.lastCommentAuthor}: </strong> : null}
          {review.lastCommentText}
        </Typography>
      ) : null}

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {dueLabel ? (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <EventIcon fontSize="small" sx={{ color: isOverdue ? '#b91c1c' : 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: isOverdue ? '#b91c1c' : 'text.secondary', fontWeight: isOverdue ? 700 : 500 }}>
                {dueLabel}
              </Typography>
            </Stack>
          ) : null}
          {typeof review.commentCount === 'number' && review.commentCount > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <CommentIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {review.commentCount}
              </Typography>
            </Stack>
          ) : null}
        </Stack>
        <IconButton
          size="small"
          aria-label="Åpne review"
          tabIndex={-1}
          sx={{ pointerEvents: 'none' }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
};

export default MobileReviewCard;
