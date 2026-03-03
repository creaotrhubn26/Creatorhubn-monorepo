import React from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';

export type MemoryCardTypeKey = 'A' | 'B' | 'C' | 'D' | 'E';
export type MemoryCardStatus = 'active' | 'backup' | 'full' | 'error' | 'empty';

export interface MemoryCardVisualDesignProps {
  cardType: MemoryCardTypeKey;
  capacity: string;
  speed: string;
  status: MemoryCardStatus;
  profession?: 'photographer' | 'videographer' | 'music_producer';
  size?: 'small' | 'medium' | 'large';
}

const CARD_GRADIENTS: Record<MemoryCardStatus, string> = {
  active: 'linear-gradient(145deg, #1b5e20, #4caf50)',
  backup: 'linear-gradient(145deg, #e65100, #ff9800)',
  full: 'linear-gradient(145deg, #b71c1c, #ef5350)',
  error: 'linear-gradient(145deg, #4a148c, #ab47bc)',
  empty: 'linear-gradient(145deg, #263238, #607d8b)',
};

const STATUS_LABELS: Record<MemoryCardStatus, string> = {
  active: 'Active',
  backup: 'Backup',
  full: 'Almost Full',
  error: 'Error',
  empty: 'Empty',
};

function getSizeMetrics(size: NonNullable<MemoryCardVisualDesignProps['size']>): {
  width: number;
  height: number;
  font: number;
} {
  switch (size) {
    case 'small':
      return { width: 64, height: 88, font: 10 };
    case 'large':
      return { width: 120, height: 160, font: 14 };
    case 'medium':
    default:
      return { width: 92, height: 124, font: 12 };
  }
}

export default function MemoryCardVisualDesign({
  cardType,
  capacity,
  speed,
  status,
  size = 'medium',
}: MemoryCardVisualDesignProps): React.ReactElement {
  const metrics = getSizeMetrics(size);

  return (
    <Paper
      elevation={3}
      sx={{
        background: CARD_GRADIENTS[status],
        borderRadius: 2,
        color: '#fff',
        height: metrics.height,
        p: 1,
        position: 'relative',
        width: metrics.width,
      }}
    >
      <Box
        sx={{
          border: '2px solid rgba(255,255,255,0.4)',
          borderRadius: 1,
          inset: 6,
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />
      <Stack sx={{ height: '100%', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <Typography sx={{ fontSize: metrics.font + 1, fontWeight: 700, letterSpacing: 0.5 }}>
          CARD {cardType}
        </Typography>
        <Box>
          <Typography sx={{ fontSize: metrics.font, fontWeight: 600 }}>{capacity}</Typography>
          <Typography sx={{ fontSize: metrics.font - 1, opacity: 0.9 }}>{speed}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

interface MemoryCardSetProps {
  profession?: 'photographer' | 'videographer' | 'music_producer';
  showLabels?: boolean;
}

const DEFAULT_SET: Array<{
  type: MemoryCardTypeKey;
  capacity: string;
  speed: string;
  status: MemoryCardStatus;
}> = [
  { type: 'A', capacity: '128GB', speed: 'V90', status: 'active' },
  { type: 'B', capacity: '64GB', speed: 'V60', status: 'backup' },
  { type: 'C', capacity: '256GB', speed: 'V90', status: 'full' },
  { type: 'D', capacity: '32GB', speed: 'V30', status: 'empty' },
  { type: 'E', capacity: '64GB', speed: 'V60', status: 'error' },
];

export function MemoryCardSet({ profession, showLabels = false }: MemoryCardSetProps): React.ReactElement {
  return (
    <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" justifyContent="center">
      {DEFAULT_SET.map((card) => (
        <Stack key={card.type} spacing={0.5} alignItems="center">
          <MemoryCardVisualDesign
            cardType={card.type}
            capacity={card.capacity}
            speed={card.speed}
            status={card.status}
            profession={profession}
            size="small"
          />
          {showLabels ? <Chip size="small" label={STATUS_LABELS[card.status]} /> : null}
        </Stack>
      ))}
    </Stack>
  );
}
