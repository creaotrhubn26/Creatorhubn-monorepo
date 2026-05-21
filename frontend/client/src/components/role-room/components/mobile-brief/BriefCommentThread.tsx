/**
 * BriefCommentThread — inline kommentar-tråd per brief-felt.
 *
 * Rendres som en sammenleggbar seksjon under hvert BriefField, slik at
 * klient og innholdsprodusent kan diskutere ett spesifikt felt uten å
 * forlate briefen. Når tråden er kollapset vises bare en chip med
 * antall uløste kommentarer.
 */

import React, { useState } from 'react';
import {
  Box, Stack, Typography, Chip, IconButton, TextField, Button,
  Avatar, Collapse, Divider, CircularProgress, Tooltip,
} from '@mui/material';
import {
  ChatBubbleOutline as ChatIcon,
  Send as SendIcon,
  CheckCircleOutline as ResolveIcon,
  DeleteOutline as DeleteIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { useBriefComments } from './useBriefCollaboration';
import type { BriefComment } from '../../services/briefCollaborationService';

interface BriefCommentThreadProps {
  projectId: string | null;
  fieldKey: string;
  fieldLabel?: string;
  /** Skjul tråden helt hvis tom (f.eks. for klient-modus i summary). */
  hideIfEmpty?: boolean;
  /** Vises i avatar når current user kommenterer. Bruk faktisk fornavn hvis tilgjengelig. */
  currentUserName?: string;
  /** Kompakt rendering (mindre padding, brukes inne i BriefField). */
  dense?: boolean;
}

function initials(name?: string | null, role?: string | null): string {
  if (name && name.trim()) {
    return name.trim().slice(0, 1).toUpperCase();
  }
  if (role === 'client') return 'K';
  if (role === 'producer') return 'P';
  return '?';
}

function authorLabel(c: BriefComment): string {
  if (c.author_name && c.author_name.trim()) return c.author_name.trim();
  return c.author_role === 'client' ? 'Klient' : c.author_role === 'producer' ? 'Innholdsprodusent' : 'System';
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const delta = Math.max(0, Date.now() - then);
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return 'akkurat nå';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min siden`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} t siden`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} d siden`;
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
}

export const BriefCommentThread: React.FC<BriefCommentThreadProps> = ({
  projectId,
  fieldKey,
  fieldLabel,
  hideIfEmpty = false,
  currentUserName,
  dense = false,
}) => {
  const { comments, loading, error, addComment, resolveComment, deleteComment } = useBriefComments(
    projectId,
    fieldKey,
  );
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const unresolvedCount = comments.filter((c) => !c.resolved_at).length;

  if (hideIfEmpty && comments.length === 0 && !expanded) return null;

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      await addComment(body, { authorName: currentUserName });
      setDraft('');
    } catch {
      /* feilen vises via error */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        mt: dense ? 0.5 : 1,
        bgcolor: 'rgba(139, 92, 246, 0.04)',
        border: '1px solid rgba(139, 92, 246, 0.16)',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: dense ? 1 : 1.5,
          py: 0.75,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <ChatIcon fontSize="small" sx={{ color: 'rgba(139, 92, 246, 0.9)' }} />
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
          Diskusjon{fieldLabel ? ` om ${fieldLabel.toLowerCase()}` : ''}
          {unresolvedCount > 0 && (
            <Chip
              size="small"
              label={unresolvedCount}
              sx={{ ml: 1, height: 18, fontSize: 11, bgcolor: 'rgba(245, 184, 46, 0.18)', color: '#F5B82E' }}
            />
          )}
        </Typography>
        <IconButton size="small" aria-label={expanded ? 'Skjul tråd' : 'Vis tråd'}>
          {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider sx={{ borderColor: 'rgba(139, 92, 246, 0.16)' }} />
        <Box sx={{ p: dense ? 1 : 1.5 }}>
          {loading && comments.length === 0 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Laster kommentarer…
              </Typography>
            </Stack>
          ) : comments.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Ingen kommentarer enda. Skriv noe under for å starte samtalen.
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  onResolve={() => resolveComment(c.id).catch(() => undefined)}
                  onDelete={() => deleteComment(c.id).catch(() => undefined)}
                />
              ))}
            </Stack>
          )}

          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              {error}
            </Typography>
          )}

          <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ mt: 1.5 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(139, 92, 246, 0.6)', fontSize: 13 }}>
              {initials(currentUserName ?? null)}
            </Avatar>
            <TextField
              size="small"
              fullWidth
              multiline
              maxRows={4}
              placeholder="Skriv en kommentar…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              disabled={submitting}
            />
            <Tooltip title="Send (⌘+Enter)">
              <span>
                <IconButton
                  color="primary"
                  size="small"
                  disabled={submitting || draft.trim().length === 0}
                  onClick={() => void handleSubmit()}
                  aria-label="Send kommentar"
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
};

interface CommentRowProps {
  comment: BriefComment;
  onResolve: () => void;
  onDelete: () => void;
}

const CommentRow: React.FC<CommentRowProps> = ({ comment, onResolve, onDelete }) => {
  const resolved = Boolean(comment.resolved_at);
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        opacity: resolved ? 0.6 : 1,
        textDecoration: resolved ? 'line-through' : 'none',
      }}
    >
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: comment.author_role === 'client' ? 'rgba(245, 184, 46, 0.7)' : 'rgba(139, 92, 246, 0.7)',
          fontSize: 13,
        }}
      >
        {initials(comment.author_name, comment.author_role)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {authorLabel(comment)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {relativeTime(comment.created_at)}
            {resolved ? ' • løst' : ''}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {comment.body}
        </Typography>
      </Box>
      {!resolved && (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Marker som løst">
            <IconButton size="small" onClick={onResolve} aria-label="Marker som løst">
              <ResolveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Slett">
            <IconButton size="small" onClick={onDelete} aria-label="Slett kommentar">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  );
};

export default BriefCommentThread;
