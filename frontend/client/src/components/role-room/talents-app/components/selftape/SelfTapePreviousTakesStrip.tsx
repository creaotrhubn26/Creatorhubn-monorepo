/**
 * SelfTapePreviousTakesStrip — horisontal strip av 5 take-thumbnails
 */
import { Box, IconButton, Stack, Typography } from '@mui/material';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';

import { palette, radius } from '../../theme';
import {
  formatDuration,
  selectTake,
  type SelftapeTake,
} from '../../../services/roleRoomSelfTapesService';

interface Props {
  takes: SelftapeTake[];
  currentTakeId: string | null;
  onSelect: () => Promise<void> | void;
  onMoreClick: (e: React.MouseEvent<HTMLElement>, take: SelftapeTake) => void;
}

export default function SelfTapePreviousTakesStrip({
  takes, currentTakeId, onSelect, onMoreClick,
}: Props) {
  if (takes.length === 0) return null;
  return (
    <Box>
      <Typography
        sx={{
          color: palette.textMuted,
          fontSize: '0.78rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          mb: 1,
        }}
      >
        Tidligere takes
      </Typography>
      <Stack
        direction="row"
        spacing={1.4}
        sx={{ overflowX: 'auto', pb: 0.6, gap: 1.4, '& > *': { flexShrink: 0 } }}
      >
        {takes.map((t) => {
          const isCurrent = t.id === currentTakeId;
          return (
            <Box
              key={t.id}
              onClick={async () => {
                await selectTake(t.id);
                await onSelect();
              }}
              sx={{
                width: 160,
                bgcolor: palette.bgCard,
                border: `1px solid ${isCurrent ? palette.accentBright : palette.border}`,
                borderRadius: radius.sm,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s',
                boxShadow: isCurrent ? '0 4px 18px rgba(168,85,247,0.32)' : 'none',
                '&:hover': { transform: 'translateY(-2px)', borderColor: palette.accentBright },
              }}
            >
              <Box
                sx={{
                  aspectRatio: '16 / 9',
                  bgcolor: '#000',
                  position: 'relative',
                  backgroundImage: t.thumbnail_url ? `url(${t.thumbnail_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Nummer-pille */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    bgcolor: 'rgba(168,85,247,0.85)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    px: 0.8,
                    borderRadius: 999,
                  }}
                >
                  {t.take_number}
                </Box>
                {/* Tre-prikker */}
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    color: 'rgba(255,255,255,0.85)',
                    bgcolor: 'rgba(0,0,0,0.32)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.48)' },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoreClick(e, t);
                  }}
                >
                  <MoreVertOutlinedIcon fontSize="small" />
                </IconButton>
                {/* Play-overlay */}
                {!t.thumbnail_url ? (
                  <PlayArrowOutlinedIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 32 }} />
                ) : null}
                {/* Varighet */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 6,
                    right: 6,
                    bgcolor: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    px: 0.8,
                    py: 0.2,
                    borderRadius: 0.6,
                  }}
                >
                  {formatDuration(t.duration_ms)}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
