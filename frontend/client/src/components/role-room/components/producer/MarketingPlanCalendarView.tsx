/**
 * MarketingPlanCalendarView — månedskalender med posts plassert på
 * dayOffset. Drag-drop tillater å bytte dag uten å åpne dialog.
 *
 * Bruker native HTML5 drag-drop API (ingen ekstra library). Hver
 * post er en draggable Box som setter postId i dataTransfer; dag-
 * cellene mottar drop og kaller onMovePost(postId, newDayOffset).
 */

import { Box, Stack, Typography, Tooltip, Chip } from '@mui/material';
import type { MarketingPlanPost } from '../../services/roleRoomAgentService';

interface Props {
  posts: MarketingPlanPost[];
  startDate: string | null;
  horizonDays: number;
  readOnly?: boolean;
  onMovePost: (postId: string, newDayOffset: number) => Promise<void> | void;
  onClickPost?: (post: MarketingPlanPost) => void;
}

const FORMAT_COLOR: Record<MarketingPlanPost['format'], string> = {
  reel: '#DD2A7B',
  carousel: '#f58529',
  image: '#22d3ee',
  story: '#a855f7',
  tiktok: '#ec4899',
  linkedin_post: '#3b82f6',
  youtube_short: '#ef4444',
};

export function MarketingPlanCalendarView({
  posts, startDate, horizonDays, readOnly, onMovePost, onClickPost,
}: Props) {
  const startMs = startDate ? new Date(startDate).getTime() : Date.now();
  const days = Array.from({ length: horizonDays }, (_, i) => {
    const date = new Date(startMs + i * 86400_000);
    return { offset: i, date };
  });

  const postsByDay = new Map<number, MarketingPlanPost[]>();
  for (const p of posts) {
    if (p.dayOffset == null) continue;
    const list = postsByDay.get(p.dayOffset) ?? [];
    list.push(p);
    postsByDay.set(p.dayOffset, list);
  }

  return (
    <Box sx={gridSx}>
      {days.map(({ offset, date }) => {
        const dayPosts = postsByDay.get(offset) ?? [];
        return (
          <DayCell key={offset}
                    offset={offset}
                    date={date}
                    posts={dayPosts}
                    readOnly={readOnly}
                    onMovePost={onMovePost}
                    onClickPost={onClickPost} />
        );
      })}
    </Box>
  );
}

function DayCell({ offset, date, posts, readOnly, onMovePost, onClickPost }: {
  offset: number; date: Date; posts: MarketingPlanPost[];
  readOnly?: boolean;
  onMovePost: (postId: string, newDayOffset: number) => Promise<void> | void;
  onClickPost?: (post: MarketingPlanPost) => void;
}) {
  return (
    <Box
      onDragOver={(e) => {
        if (readOnly) return;
        e.preventDefault();
        e.currentTarget.style.background = 'rgba(236,72,153,0.14)';
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.background = '';
      }}
      onDrop={(e) => {
        if (readOnly) return;
        e.preventDefault();
        e.currentTarget.style.background = '';
        const postId = e.dataTransfer.getData('text/plain');
        if (postId) void onMovePost(postId, offset);
      }}
      sx={cellSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.4 }}>
        <Typography sx={dayNumSx}>
          {offset + 1}
        </Typography>
        <Typography sx={dayDateSx}>
          {date.toLocaleDateString('nb', { day: '2-digit', month: 'short' })}
        </Typography>
      </Stack>
      <Stack spacing={0.4}>
        {posts.map(p => (
          <PostTile key={p.id} post={p} readOnly={readOnly} onClickPost={onClickPost} />
        ))}
      </Stack>
    </Box>
  );
}

function PostTile({ post, readOnly, onClickPost }: {
  post: MarketingPlanPost; readOnly?: boolean;
  onClickPost?: (post: MarketingPlanPost) => void;
}) {
  const color = FORMAT_COLOR[post.format];
  return (
    <Tooltip title={post.hook} placement="top">
      <Box
        draggable={!readOnly}
        onDragStart={(e) => {
          if (readOnly) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', post.id);
        }}
        onClick={() => onClickPost?.(post)}
        sx={{
          ...tileSx,
          borderLeft: `3px solid ${color}`,
          cursor: readOnly ? 'default' : 'grab',
          '&:active': readOnly ? undefined : { cursor: 'grabbing' },
          '&:hover': onClickPost ? { bgcolor: 'rgba(236,72,153,0.10)' } : undefined,
        }}>
        <Typography sx={{
          fontSize: '0.68rem', fontWeight: 700,
          color: '#f8fafc',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {post.hook}
        </Typography>
        {post.lastEditedByKind && (
          <Chip size="small"
                label={post.lastEditedByKind === 'client' ? 'K' : 'T'}
                sx={{
                  height: 12, fontSize: '0.55rem', fontWeight: 800,
                  bgcolor: post.lastEditedByKind === 'client'
                    ? 'rgba(34,211,238,0.18)' : 'rgba(236,72,153,0.18)',
                  color: post.lastEditedByKind === 'client' ? '#67e8f9' : '#f9a8d4',
                  '& .MuiChip-label': { px: 0.5 },
                  position: 'absolute', top: 2, right: 2,
                }} />
        )}
      </Box>
    </Tooltip>
  );
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 0.6,
  maxHeight: 520,
  overflowY: 'auto' as const,
};

const cellSx = {
  bgcolor: 'rgba(2,6,23,0.6)',
  border: '1px solid rgba(148,163,184,0.12)',
  borderRadius: 1,
  p: 0.8,
  minHeight: 88,
  display: 'flex',
  flexDirection: 'column' as const,
  transition: 'background 120ms',
};

const dayNumSx = {
  color: '#f8fafc', fontWeight: 800, fontSize: '0.78rem',
};

const dayDateSx = {
  color: 'rgba(226,232,240,0.55)', fontSize: '0.66rem',
};

const tileSx = {
  bgcolor: 'rgba(15,23,42,0.85)',
  borderRadius: 0.6,
  p: 0.6,
  position: 'relative' as const,
  transition: 'background 120ms',
};

export default MarketingPlanCalendarView;
