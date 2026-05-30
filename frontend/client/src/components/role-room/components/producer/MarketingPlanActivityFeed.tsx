/**
 * MarketingPlanActivityFeed — vertikal tidslinje med alt som har
 * skjedd på markedsplanen: plan-versjoner, klient-kommentarer,
 * reviews, preview-uploads, inline-edits.
 *
 * Hektes inn under posts-tabellen i MarketingPlanWorkspace.
 */

import { useEffect, useState } from 'react';
import { Box, Stack, Typography, CircularProgress, Chip } from '@mui/material';
import {
  History as HistoryIcon,
  ChatBubbleOutline as CommentIcon,
  CheckCircle as ApprovedIcon,
  ReportProblem as ChangesIcon,
  Movie as PreviewIcon,
  Edit as EditIcon,
  AutoAwesome as VersionIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type ActivityEvent, type ActivityEventKind,
} from '../../services/roleRoomAgentService';

interface Props {
  projectId: string;
  /** Bumps når noe har skjedd (post-edit, versjon-activate) — feed refetches. */
  refreshNonce?: number;
}

const EVENT_VISUALS: Record<ActivityEventKind, {
  color: string; bg: string;
  icon: typeof HistoryIcon;
  actorBadge: string;
}> = {
  plan_version: {
    color: '#a855f7', bg: 'rgba(168,85,247,0.14)',
    icon: VersionIcon, actorBadge: '',
  },
  client_comment: {
    color: '#67e8f9', bg: 'rgba(34,211,238,0.14)',
    icon: CommentIcon, actorBadge: 'Klient',
  },
  team_comment: {
    color: '#f0a500', bg: 'rgba(240,165,0,0.14)',
    icon: CommentIcon, actorBadge: 'Team',
  },
  client_review_approved: {
    color: '#4ad48a', bg: 'rgba(74,212,138,0.14)',
    icon: ApprovedIcon, actorBadge: 'Klient',
  },
  client_review_changes_requested: {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.14)',
    icon: ChangesIcon, actorBadge: 'Klient',
  },
  preview_uploaded: {
    color: '#ec4899', bg: 'rgba(236,72,153,0.14)',
    icon: PreviewIcon, actorBadge: 'Team',
  },
  post_edited: {
    color: '#94a3b8', bg: 'rgba(148,163,184,0.14)',
    icon: EditIcon, actorBadge: 'Team',
  },
};

export function MarketingPlanActivityFeed({ projectId, refreshNonce }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const e = await roleRoomAgentService.getMarketingActivityFeed(projectId);
        if (!cancelled) setEvents(e);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, refreshNonce]);

  return (
    <Box sx={cardSx}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.4 }}>
        <HistoryIcon sx={{ color: '#a855f7', fontSize: 22 }} />
        <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1rem' }}>
          Aktivitet
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.78rem' }}>
          ({events.length})
        </Typography>
      </Stack>

      {loading && (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={28} sx={{ color: '#a855f7' }} />
        </Stack>
      )}

      {error && (
        <Typography sx={{ color: '#ef4f6f', fontSize: '0.84rem' }}>{error}</Typography>
      )}

      {!loading && !error && events.length === 0 && (
        <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.84rem' }}>
          Ingen aktivitet ennå. Klient-kommentarer, godkjennelser, preview-uploads og redigeringer dukker opp her.
        </Typography>
      )}

      <Stack spacing={0} sx={{ position: 'relative' }}>
        {events.length > 0 && (
          <Box sx={timelineBarSx} />
        )}
        {events.map((event, idx) => (
          <EventRow key={`${event.at}-${idx}`} event={event} />
        ))}
      </Stack>
    </Box>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const v = EVENT_VISUALS[event.kind];
  const Icon = v.icon;
  return (
    <Stack direction="row" spacing={1.4} sx={{ position: 'relative', py: 1.2 }}>
      <Box sx={{
        ...dotSx,
        bgcolor: v.bg,
        border: `2px solid ${v.color}`,
        color: v.color,
      }}>
        <Icon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
          <Typography sx={{ color: '#f8fafc', fontSize: '0.86rem', fontWeight: 700 }}>
            {event.title}
          </Typography>
          {event.actor.name && (
            <Chip size="small"
                  label={event.actor.name}
                  sx={{
                    height: 18, fontSize: '0.66rem', fontWeight: 700,
                    bgcolor: v.bg, color: v.color,
                  }} />
          )}
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem' }}>
            · {formatRelative(event.at)}
          </Typography>
        </Stack>
        {event.postHook && (
          <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.78rem', mt: 0.3, fontStyle: 'italic' }}>
            Posten: "{event.postHook.slice(0, 80)}"
          </Typography>
        )}
        {event.detail && (
          <Typography sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem', mt: 0.3, lineHeight: 1.5 }}>
            {event.detail}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'akkurat nå';
  if (min < 60) return `${min} min siden`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}t siden`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}d siden`;
  return new Date(iso).toLocaleDateString('nb', { day: '2-digit', month: 'short' });
}

const cardSx = {
  p: 2.2, borderRadius: 2.2, mt: 2,
  bgcolor: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.14)',
};

const dotSx = {
  width: 28, height: 28, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, zIndex: 1,
};

const timelineBarSx = {
  position: 'absolute',
  left: 13, top: 24, bottom: 24,
  width: 2,
  bgcolor: 'rgba(148,163,184,0.18)',
};

export default MarketingPlanActivityFeed;
