// @ts-nocheck
/**
 * MobileReviewDetailSheet — fullscreen review detail on phone, right drawer
 * on iPad. Renders the full review with history and a sticky decision bar.
 *
 * Covers backlog items:
 *  - 128: én sticky "Godkjenn"-knapp nederst
 *  - 129: bekreftelse ved avslag og change request (destructive gate)
 *  - 133: review history som timeline inne i sheet
 *  - 139: klientnavn og rolle synlig
 *  - 147: hindre dobbel submit (pending-state gates the CTAs)
 *  - 148: ingen optimistic UI — vente på serverbekreftelse
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import {
  mapReviewStatusToMobile,
  presentReviewStatus,
} from './reviewStatusVocabulary';
import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';

export interface ReviewDetailComment {
  id: string;
  author: string | null;
  role?: string | null;
  text: string;
  createdAt?: string;
}

export interface ReviewDetailData {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
  dueAt?: string | null;
  requesterDisplay?: string | null;
  requesterRole?: string | null;
  comments: ReviewDetailComment[];
}

export type ReviewDecision = 'approved' | 'rejected' | 'changes_requested';

interface MobileReviewDetailSheetProps {
  open: boolean;
  onClose: () => void;
  mode: RoleRoomViewportMode;
  review: ReviewDetailData | null;

  /** Permissions — desktop panel uses the same three flags. */
  canApprove?: boolean;
  canRequestChanges?: boolean;
  canReject?: boolean;
  canComment?: boolean;

  onDecision: (decision: ReviewDecision, reason?: string) => Promise<void>;
  onAddComment?: (text: string) => Promise<void>;

  /**
   * When true, render the body inline (no Dialog / Drawer wrapper) — used by
   * IPadMasterDetailLayout on tabletLandscape where the detail has its own
   * column. Defaults to false (phone + tabletPortrait overlay behavior).
   */
  inline?: boolean;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export const MobileReviewDetailSheet: React.FC<MobileReviewDetailSheetProps> = ({
  open,
  onClose,
  mode,
  review,
  canApprove,
  canRequestChanges,
  canReject,
  canComment,
  onDecision,
  onAddComment,
  inline,
}) => {
  const useDrawer = !inline && (mode === 'tabletPortrait' || mode === 'tabletLandscape');

  const [pendingDecision, setPendingDecision] = useState<ReviewDecision | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<ReviewDecision | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const mobileStatus = useMemo(
    () => (review ? mapReviewStatusToMobile(review.status, review.metadata) : null),
    [review],
  );
  const presentation = mobileStatus ? presentReviewStatus(mobileStatus) : null;

  const isTerminal = mobileStatus === 'approved' || mobileStatus === 'rejected';

  const handleApprove = async () => {
    if (!review) return;
    setLocalError(null);
    setPendingDecision('approved');
    try {
      await onDecision('approved');
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Kunne ikke godkjenne');
    } finally {
      setPendingDecision(null);
    }
  };

  const handleConfirmDestructive = async () => {
    if (!review || !confirmDecision) return;
    setLocalError(null);
    setPendingDecision(confirmDecision);
    try {
      await onDecision(confirmDecision, reasonInput.trim() || undefined);
      setConfirmDecision(null);
      setReasonInput('');
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Kunne ikke oppdatere status');
    } finally {
      setPendingDecision(null);
    }
  };

  const handleAddComment = async () => {
    if (!review || !onAddComment || !commentDraft.trim()) return;
    setLocalError(null);
    setCommentPending(true);
    try {
      await onAddComment(commentDraft.trim());
      setCommentDraft('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Kunne ikke legge til kommentar');
    } finally {
      setCommentPending(false);
    }
  };

  if (!review) return null;

  const header = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{
        px: 2,
        pt: useDrawer ? 2 : 'calc(var(--rr-safe-top, 0px) + 12px)',
        pb: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1, pr: 2 }}>
        <Typography variant="h6" fontWeight={700} noWrap>
          {review.title}
        </Typography>
        {review.requesterDisplay ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            {review.requesterDisplay}
            {review.requesterRole ? ` • ${review.requesterRole}` : ''}
          </Typography>
        ) : null}
      </Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        {presentation ? (
          <Chip
            size="small"
            label={presentation.label}
            sx={{ bgcolor: presentation.bg, color: presentation.color, fontWeight: 700 }}
          />
        ) : null}
        <IconButton
          onClick={onClose}
          aria-label="Lukk review"
          sx={{
            width: 'var(--rr-touch-target-min, 44px)',
            height: 'var(--rr-touch-target-min, 44px)',
          }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>
    </Stack>
  );

  const body = (
    <Box sx={{ px: 2, pt: 1, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {review.description ? (
        <Typography variant="body2">{review.description}</Typography>
      ) : null}

      {review.dueAt ? (
        <Typography variant="caption" color="text.secondary">
          Frist: {formatTimestamp(review.dueAt)}
        </Typography>
      ) : null}

      {/* Item 133: review history as inline timeline. */}
      <Stack spacing={1.25}>
        <Typography variant="overline" color="text.secondary">
          Historikk
        </Typography>
        {review.comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Ingen kommentarer ennå.
          </Typography>
        ) : (
          review.comments.map((comment) => (
            <Box
              key={comment.id}
              sx={{
                borderLeft: '2px solid',
                borderColor: 'divider',
                pl: 1.5,
                py: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {comment.author || 'Ukjent'}
                {comment.role ? ` • ${comment.role}` : ''}
                {comment.createdAt ? ` • ${formatTimestamp(comment.createdAt)}` : ''}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {comment.text}
              </Typography>
            </Box>
          ))
        )}
      </Stack>

      {canComment && !isTerminal ? (
        <Stack spacing={1}>
          <TextField
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            label="Legg til kommentar"
            multiline
            minRows={2}
            fullWidth
          />
          <Button
            variant="outlined"
            disabled={!commentDraft.trim() || commentPending}
            onClick={handleAddComment}
            sx={{ alignSelf: 'flex-end', minHeight: 'var(--rr-touch-target-min, 44px)' }}
          >
            {commentPending ? 'Sender …' : 'Legg til'}
          </Button>
        </Stack>
      ) : null}

      {localError ? <Alert severity="error">{localError}</Alert> : null}
    </Box>
  );

  // Item 128: sticky decision bar. Hidden when review is in a terminal state
  // or when the current user has no decision permissions.
  const stickyBar =
    isTerminal || (!canApprove && !canRequestChanges && !canReject) ? null : (
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          px: 2,
          py: 1.5,
          pb: 'calc(var(--rr-safe-bottom, 0px) + 12px)',
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {canApprove ? (
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="success"
            disabled={pendingDecision !== null}
            onClick={handleApprove}
            sx={{
              minHeight: 'var(--rr-touch-target-min, 44px)',
              fontWeight: 700,
            }}
          >
            {pendingDecision === 'approved' ? <CircularProgress size={20} color="inherit" /> : 'Godkjenn'}
          </Button>
        ) : null}
        <Stack direction="row" spacing={1}>
          {canRequestChanges ? (
            <Button
              fullWidth
              variant="outlined"
              color="warning"
              disabled={pendingDecision !== null}
              onClick={() => setConfirmDecision('changes_requested')}
              sx={{ minHeight: 'var(--rr-touch-target-min, 44px)' }}
            >
              Be om endring
            </Button>
          ) : null}
          {canReject ? (
            <Button
              fullWidth
              variant="outlined"
              color="error"
              disabled={pendingDecision !== null}
              onClick={() => setConfirmDecision('rejected')}
              sx={{ minHeight: 'var(--rr-touch-target-min, 44px)' }}
            >
              Avslå
            </Button>
          ) : null}
        </Stack>
      </Box>
    );

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {header}
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>{body}</Box>
      {stickyBar}
    </Box>
  );

  const confirmDialog = (
    <Dialog
      open={confirmDecision !== null}
      onClose={() => {
        if (pendingDecision !== null) return;
        setConfirmDecision(null);
        setReasonInput('');
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {confirmDecision === 'rejected' ? 'Bekreft avslag' : 'Bekreft endringsforespørsel'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {confirmDecision === 'rejected'
            ? 'Avslag kan være synlig for klienten umiddelbart. Skriv gjerne en begrunnelse.'
            : 'Klienten vil se at du ber om endring. Beskriv hva som må endres.'}
        </DialogContentText>
        <TextField
          value={reasonInput}
          onChange={(event) => setReasonInput(event.target.value)}
          label="Begrunnelse (valgfri)"
          multiline
          minRows={3}
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={() => {
            setConfirmDecision(null);
            setReasonInput('');
          }}
          disabled={pendingDecision !== null}
        >
          Avbryt
        </Button>
        <Button
          variant="contained"
          color={confirmDecision === 'rejected' ? 'error' : 'warning'}
          onClick={handleConfirmDestructive}
          disabled={pendingDecision !== null}
        >
          {pendingDecision !== null ? <CircularProgress size={20} color="inherit" /> : 'Bekreft'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (inline) {
    return (
      <>
        {content}
        {confirmDialog}
      </>
    );
  }

  if (useDrawer) {
    return (
      <>
        <Drawer
          anchor="right"
          open={open}
          onClose={onClose}
          PaperProps={{ sx: { width: 'min(520px, 95vw)' } }}
        >
          {content}
        </Drawer>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        aria-labelledby="rr-review-detail-title"
        PaperProps={{
          className: 'rr-mobile-sheet',
          sx: {
            margin: 0,
            borderTopLeftRadius: 'var(--rr-bottom-sheet-radius, 16px)',
            borderTopRightRadius: 'var(--rr-bottom-sheet-radius, 16px)',
          },
        }}
      >
        <DialogTitle id="rr-review-detail-title" sx={{ p: 0 }}>
          <span className="sr-only">Review</span>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>{content}</DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
};

export default MobileReviewDetailSheet;
