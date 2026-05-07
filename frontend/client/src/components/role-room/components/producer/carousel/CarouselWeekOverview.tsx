/**
 * CarouselWeekOverview — top-level week-view for a generated draft.
 *
 * Renders the 7-day grid (one card per format-day), shows hook + status
 * per post, lets user click in to edit a single post.
 */

import { Box, Card, Chip, IconButton, Stack, Typography, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  FORMAT_DAY_LABELS,
  PLATFORM_LABELS,
  type CarouselPostRow,
  type CarouselDraftRow,
} from '../../../../../services/carouselService';

interface Props {
  draft: CarouselDraftRow;
  posts: CarouselPostRow[];
  onSelectPost: (postId: string) => void;
}

export default function CarouselWeekOverview({ draft, posts, onSelectPost }: Props) {
  const sorted = [...posts].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
            Uke {draft.week_starting}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.65)' }}>
            {draft.approved_post_count} av {draft.total_posts} godkjent · status: {draft.status}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(7, 1fr)' },
          gap: 1.5,
        }}
      >
        {sorted.map((post) => {
          const meta = FORMAT_DAY_LABELS[post.format];
          const platformLabel = PLATFORM_LABELS[post.primary_platform];
          const isApproved = post.status === 'approved' || post.status === 'scheduled' || post.status === 'published';
          return (
            <Card
              key={post.id}
              variant="outlined"
              onClick={() => onSelectPost(post.id)}
              sx={{
                p: 1.5,
                cursor: 'pointer',
                bgcolor: 'rgba(15,23,42,0.72)',
                borderColor: isApproved
                  ? 'rgba(52,211,153,0.45)'
                  : 'rgba(168,85,247,0.22)',
                transition: 'border-color 120ms ease, transform 120ms ease',
                '&:hover': {
                  borderColor: '#a855f7',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(226,232,240,0.65)', letterSpacing: 1 }}
                  >
                    {meta.day}
                  </Typography>
                  {isApproved ? (
                    <Tooltip title="Godkjent">
                      <CheckCircleIcon sx={{ color: '#34d399', fontSize: 18 }} />
                    </Tooltip>
                  ) : (
                    <Tooltip title="Utkast">
                      <ScheduleIcon sx={{ color: 'rgba(226,232,240,0.45)', fontSize: 18 }} />
                    </Tooltip>
                  )}
                </Stack>
                <Box sx={{ fontSize: 28, lineHeight: 1 }}>{meta.emoji}</Box>
                <Typography
                  variant="body2"
                  sx={{ color: '#e2e8f0', fontWeight: 600, lineHeight: 1.3 }}
                >
                  {post.hook}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={meta.label}
                    sx={{
                      bgcolor: 'rgba(168,85,247,0.16)',
                      color: '#c084fc',
                      fontSize: 11,
                      height: 20,
                    }}
                  />
                  <Chip
                    size="small"
                    label={platformLabel}
                    sx={{
                      bgcolor: 'rgba(34,211,238,0.12)',
                      color: '#22d3ee',
                      fontSize: 11,
                      height: 20,
                    }}
                  />
                </Stack>
                <Stack direction="row" justifyContent="flex-end">
                  <IconButton size="small" sx={{ color: '#c084fc' }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
