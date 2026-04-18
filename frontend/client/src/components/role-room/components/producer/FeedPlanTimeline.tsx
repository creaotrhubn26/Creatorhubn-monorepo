import { useMemo } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  AutoMode as AutoModeIcon,
  CalendarMonth as CalendarMonthIcon,
  EventAvailable as EventAvailableIcon,
} from '@mui/icons-material';
import type {
  RoleRoomFeedBrandSnapshot,
  RoleRoomFeedPost,
} from '../../services/roleRoomAgentService';
import { CONCEPT_LABELS } from '../../utils/feedPlanner';
import type { RoleRoomFeedPostConcept } from '../../services/roleRoomAgentService';

type FeedPlanTimelineProps = {
  posts: RoleRoomFeedPost[];
  brandSnapshot: RoleRoomFeedBrandSnapshot | null;
  selectedPostId: string | null;
  onSelectPost: (id: string) => void;
  onAutoSchedule: () => void;
  onClearSchedule: () => void;
};

const WEEKDAY_NB = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
const MONTH_NB = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

function formatDateShort(iso: string | null): { date: string; time: string; weekday: string } | null {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (value: number) => value.toString().padStart(2, '0');
    return {
      date: `${date.getDate()} ${MONTH_NB[date.getMonth()]}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
      weekday: WEEKDAY_NB[date.getDay()],
    };
  } catch {
    return null;
  }
}

export default function FeedPlanTimeline({
  posts,
  brandSnapshot,
  selectedPostId,
  onSelectPost,
  onAutoSchedule,
  onClearSchedule,
}: FeedPlanTimelineProps) {
  const hasAnyScheduled = useMemo(() => posts.some((post) => Boolean(post.scheduledFor)), [posts]);

  const orderedPosts = useMemo(() => {
    const indexed = posts.map((post, index) => ({ post, index }));
    return indexed.sort((left, right) => {
      const ld = left.post.scheduledFor ? new Date(left.post.scheduledFor).getTime() : Number.MAX_SAFE_INTEGER;
      const rd = right.post.scheduledFor ? new Date(right.post.scheduledFor).getTime() : Number.MAX_SAFE_INTEGER;
      if (ld !== rd) return ld - rd;
      return left.index - right.index;
    });
  }, [posts]);

  return (
    <Stack
      spacing={1}
      sx={{
        p: 1.4,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.55)',
        border: '1px solid rgba(148,163,184,0.16)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={0.8} alignItems="center">
          <CalendarMonthIcon fontSize="small" sx={{ color: '#22d3ee' }} />
          <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' }}>
            Innholdsplan
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.78rem' }}>
            {hasAnyScheduled ? `${posts.filter((p) => p.scheduledFor).length} av ${posts.length} planlagt` : 'Ingen datoer satt'}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.6}>
          <Tooltip title="Foreslår man/ons/fre 09:00 fra neste mandag (ulåste posts)">
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoModeIcon fontSize="small" />}
              onClick={onAutoSchedule}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: '#22d3ee',
                borderColor: 'rgba(34,211,238,0.4)',
                '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
              }}
            >
              Auto-planlegg
            </Button>
          </Tooltip>
          {hasAnyScheduled ? (
            <Button
              size="small"
              onClick={onClearSchedule}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: 'rgba(226,232,240,0.65)',
                '&:hover': { bgcolor: 'rgba(148,163,184,0.06)' },
              }}
            >
              Tøm
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.6,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(148,163,184,0.32)',
            borderRadius: 3,
          },
        }}
      >
        {orderedPosts.map(({ post, index }) => {
          const date = formatDateShort(post.scheduledFor);
          const isSelected = post.id === selectedPostId;
          const conceptLabel = CONCEPT_LABELS[post.concept as RoleRoomFeedPostConcept] || 'Post';

          return (
            <Box
              key={post.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectPost(post.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectPost(post.id);
                }
              }}
              sx={{
                minWidth: 132,
                cursor: 'pointer',
                p: 1,
                borderRadius: 1.6,
                bgcolor: isSelected ? 'rgba(34,211,238,0.12)' : 'rgba(15,23,42,0.7)',
                border: `1px solid ${isSelected ? '#22d3ee' : 'rgba(148,163,184,0.18)'}`,
                transition: 'transform 0.12s ease, border-color 0.12s ease, background 0.12s ease',
                '&:hover': {
                  borderColor: '#22d3ee',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.6 }}>
                <Box
                  sx={{
                    width: 26,
                    height: 32,
                    borderRadius: 0.6,
                    background: post.customImageUrl
                      ? `center/cover no-repeat url(${post.customImageUrl})`
                      : `linear-gradient(135deg, ${post.backgroundColor || '#0f172a'}, ${post.accentColor || '#22d3ee'})`,
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                />
                <Stack spacing={0} sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      color: '#e2e8f0',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      lineHeight: 1.15,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{index + 1} · {conceptLabel}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.62rem' }}>
                    {brandSnapshot?.companyName || 'merke'}
                  </Typography>
                </Stack>
              </Stack>
              {date ? (
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <EventAvailableIcon sx={{ color: '#22d3ee', fontSize: 14 }} />
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.7rem', fontWeight: 700 }}>
                    {date.weekday} {date.date}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.66rem' }}>
                    {date.time}
                  </Typography>
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.66rem', fontStyle: 'italic' }}>
                  Ingen dato satt
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
