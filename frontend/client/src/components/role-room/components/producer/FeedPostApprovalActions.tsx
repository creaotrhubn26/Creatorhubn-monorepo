import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Block as BlockIcon,
  Edit as EditIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomFeedApprovalState,
  type RoleRoomFeedPost,
} from '../../services/roleRoomAgentService';
import { describeApprovalState } from '../../utils/feedApprovalLabels';

interface FeedPostApprovalActionsProps {
  projectId: string;
  platform: string;
  post: RoleRoomFeedPost;
  /** Kalt etter vellykket state-overgang slik at parent kan oppdatere
   *  posten lokalt (uten å reload-e hele planen). */
  onStateChanged: (
    nextState: RoleRoomFeedApprovalState,
    note?: string | null,
  ) => void;
}

/**
 * Bruker-vendt approval-kontroll for én feed-post.
 * Eksponerer KUN norske handlingsord — ingen JSON, ingen rå state-strenger.
 *
 * Vises kompakt i FeedPostDetailPanel med farget statusbar + 1-2 knapper
 * relevant for nåværende state.
 */
export default function FeedPostApprovalActions({
  projectId,
  platform,
  post,
  onStateChanged,
}: FeedPostApprovalActionsProps): React.ReactElement {
  const currentState: RoleRoomFeedApprovalState = post.approvalState ?? 'draft';
  const descriptor = describeApprovalState(currentState);

  const [busyTarget, setBusyTarget] = useState<RoleRoomFeedApprovalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  async function transition(target: RoleRoomFeedApprovalState, note?: string | null) {
    setBusyTarget(target);
    setError(null);
    const result = await roleRoomAgentService.setFeedPostApproval({
      projectId,
      platform,
      postIds: [post.id],
      approvalState: target,
      approvalNote: note ?? null,
    });
    setBusyTarget(null);
    if (!result.success) {
      setError(result.error ?? 'Kunne ikke oppdatere status.');
      return;
    }
    onStateChanged(target, note ?? null);
    setShowRejectInput(false);
    setRejectNote('');
  }

  const isBusy = busyTarget !== null;

  return (
    <Stack
      data-testid="feed-post-approval-actions"
      data-current-state={currentState}
      spacing={1}
      sx={{
        p: 1.4,
        borderRadius: 2,
        bgcolor: descriptor.bgColor,
        border: `1px solid ${descriptor.borderColor}`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          size="small"
          label={descriptor.label}
          sx={{
            height: 22,
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            bgcolor: 'rgba(15,23,42,0.45)',
            color: descriptor.color,
            border: `1px solid ${descriptor.borderColor}`,
          }}
        />
        <Typography sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.78rem', flex: 1 }}>
          {descriptor.description}
        </Typography>
      </Stack>

      {post.approvalNote && (currentState === 'rejected' || currentState === 'needs_changes') ? (
        <Box
          sx={{
            p: 1,
            borderRadius: 1.4,
            bgcolor: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.18)',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.65rem',
              color: 'rgba(226,232,240,0.55)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
              mb: 0.3,
            }}
          >
            Kommentar fra reviewer
            {post.approvalChangedBy ? ` · ${post.approvalChangedBy}` : ''}
          </Typography>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
            {post.approvalNote}
          </Typography>
        </Box>
      ) : null}

      {showRejectInput ? (
        <Stack spacing={0.8}>
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder="Hva trenger å endres? (valgfritt)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            disabled={isBusy}
            size="small"
            sx={{
              '& .MuiInputBase-root': {
                fontSize: '0.82rem',
                color: '#e2e8f0',
                bgcolor: 'rgba(15,23,42,0.55)',
              },
            }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              size="small"
              onClick={() => {
                setShowRejectInput(false);
                setRejectNote('');
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                color: 'rgba(226,232,240,0.7)',
              }}
              disabled={isBusy}
            >
              Avbryt
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => transition('needs_changes', rejectNote.trim() || null)}
              disabled={isBusy}
              startIcon={
                busyTarget === 'needs_changes' ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <EditIcon fontSize="small" />
                )
              }
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                bgcolor: '#fbbf24',
                color: '#0f172a',
                '&:hover': { bgcolor: '#f59e0b' },
              }}
            >
              Send tilbake
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {currentState === 'draft' || currentState === 'needs_changes' ? (
            <Button
              size="small"
              variant="contained"
              startIcon={
                busyTarget === 'approved' ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <CheckIcon fontSize="small" />
                )
              }
              onClick={() => transition('approved')}
              disabled={isBusy}
              data-testid="approve-button"
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                bgcolor: '#22c55e',
                color: '#0f172a',
                '&:hover': { bgcolor: '#16a34a' },
              }}
            >
              Godkjenn
            </Button>
          ) : null}

          {currentState === 'draft' ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon fontSize="small" />}
              onClick={() => setShowRejectInput(true)}
              disabled={isBusy}
              data-testid="request-changes-button"
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                color: '#fbbf24',
                borderColor: 'rgba(251,191,36,0.5)',
                '&:hover': { borderColor: '#fbbf24', bgcolor: 'rgba(251,191,36,0.08)' },
              }}
            >
              Be om endring
            </Button>
          ) : null}

          {currentState === 'approved' || currentState === 'scheduled' ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={
                busyTarget === 'draft' ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <ReplayIcon fontSize="small" />
                )
              }
              onClick={() => transition('draft')}
              disabled={isBusy}
              data-testid="back-to-draft-button"
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                color: 'rgba(226,232,240,0.85)',
                borderColor: 'rgba(148,163,184,0.4)',
              }}
            >
              Tilbake til utkast
            </Button>
          ) : null}

          {currentState === 'draft' ? (
            <Button
              size="small"
              variant="text"
              startIcon={<BlockIcon fontSize="small" />}
              onClick={() => transition('rejected')}
              disabled={isBusy}
              data-testid="reject-button"
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                color: 'rgba(248,113,113,0.85)',
                '&:hover': { bgcolor: 'rgba(248,113,113,0.08)' },
              }}
            >
              Avvis
            </Button>
          ) : null}

          {currentState === 'rejected' ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ReplayIcon fontSize="small" />}
              onClick={() => transition('draft')}
              disabled={isBusy}
              data-testid="back-to-draft-button"
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                color: 'rgba(226,232,240,0.85)',
                borderColor: 'rgba(148,163,184,0.4)',
              }}
            >
              Send inn på nytt
            </Button>
          ) : null}
        </Stack>
      )}

      {error ? (
        <Typography sx={{ color: '#fca5a5', fontSize: '0.74rem' }}>{error}</Typography>
      ) : null}
    </Stack>
  );
}
