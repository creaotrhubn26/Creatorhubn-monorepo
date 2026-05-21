/**
 * BriefActivityFeed — sidepanel som viser hva som har skjedd i briefen
 * (felt-endringer, kommentarer, lagring, osv.). Rendres typisk i en
 * Drawer på mobil og i et right-rail på tablet/desktop.
 */

import React from 'react';
import {
  Box, Stack, Typography, IconButton, Avatar, CircularProgress, Chip, Divider, Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  EditNote as EditIcon,
  ChatBubbleOutline as ChatIcon,
  CheckCircleOutline as CheckIcon,
  Save as SaveIcon,
  HistoryToggleOff as ClockIcon,
} from '@mui/icons-material';
import { useBriefActivity } from './useBriefCollaboration';
import type { BriefActivityEntry } from '../../services/briefCollaborationService';

interface BriefActivityFeedProps {
  projectId: string | null;
  limit?: number;
  /** Skjul header (refresh-knapp + tittel) — brukes når feeden ligger i en Drawer som har sin egen header. */
  embeddedHeader?: boolean;
  title?: string;
}

function eventIcon(kind: string): React.ReactNode {
  switch (kind) {
    case 'comment_added':
    case 'comment_replied':
      return <ChatIcon fontSize="small" />;
    case 'comment_resolved':
      return <CheckIcon fontSize="small" />;
    case 'field_edited':
      return <EditIcon fontSize="small" />;
    case 'brief_saved':
      return <SaveIcon fontSize="small" />;
    default:
      return <ClockIcon fontSize="small" />;
  }
}

function eventLabel(entry: BriefActivityEntry): string {
  const field = entry.field_key ? ` (${entry.field_key})` : '';
  switch (entry.event_kind) {
    case 'comment_added':
      return `kommenterte${field}`;
    case 'comment_replied':
      return `svarte i tråd${field}`;
    case 'comment_resolved':
      return `markerte kommentar som løst${field}`;
    case 'comment_deleted':
      return `slettet kommentar${field}`;
    case 'field_edited':
      return `endret ${entry.field_key ?? 'felt'}`;
    case 'brief_saved': {
      const count = Array.isArray((entry.metadata as { fieldsEdited?: unknown[] })?.fieldsEdited)
        ? ((entry.metadata as { fieldsEdited: unknown[] }).fieldsEdited.length)
        : 0;
      return count > 0 ? `lagret briefen (${count} felt)` : 'lagret briefen';
    }
    case 'brief_viewed':
      return 'åpnet briefen';
    case 'reference_added':
      return `la til referanse${field}`;
    case 'reference_removed':
      return `fjernet referanse${field}`;
    case 'voice_memo_added':
      return 'la til talenotat';
    default:
      return entry.event_kind.replace(/_/g, ' ');
  }
}

function actorLabel(entry: BriefActivityEntry): string {
  if (entry.actor_name && entry.actor_name.trim()) return entry.actor_name.trim();
  if (entry.actor_role === 'client') return 'Klient';
  if (entry.actor_role === 'producer') return 'Innholdsprodusent';
  if (entry.actor_role === 'system') return 'System';
  return 'Ukjent';
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

export const BriefActivityFeed: React.FC<BriefActivityFeedProps> = ({
  projectId,
  limit = 50,
  embeddedHeader = false,
  title = 'Aktivitet',
}) => {
  const { activity, loading, error, reload } = useBriefActivity(projectId, limit);

  return (
    <Box
      sx={{
        bgcolor: 'rgba(20, 20, 24, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 2,
        p: 1.5,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!embeddedHeader && (
        <>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ pb: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700 }}>
              {title}
            </Typography>
            <Chip size="small" label={activity.length} sx={{ height: 18, fontSize: 11 }} />
            <Tooltip title="Oppdater">
              <span>
                <IconButton size="small" onClick={() => void reload()} disabled={loading} aria-label="Oppdater aktivitet">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        </>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', mt: 1, pr: 0.5 }}>
        {loading && activity.length === 0 ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Laster aktivitet…
            </Typography>
          </Stack>
        ) : activity.length === 0 && !error ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
            Ingenting har skjedd enda. Endringer og kommentarer dukker opp her.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {activity.map((entry) => (
              <Stack key={entry.id} direction="row" spacing={1} alignItems="flex-start">
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: entry.actor_role === 'client'
                      ? 'rgba(245, 184, 46, 0.6)'
                      : 'rgba(139, 92, 246, 0.6)',
                    fontSize: 12,
                  }}
                >
                  {eventIcon(entry.event_kind)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.35 }}>
                    <strong>{actorLabel(entry)}</strong> {eventLabel(entry)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {relativeTime(entry.created_at)}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        )}

        {error && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default BriefActivityFeed;
