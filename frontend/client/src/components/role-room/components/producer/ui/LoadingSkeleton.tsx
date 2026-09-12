import type { ReactElement } from 'react';
import { Box, Skeleton, Stack } from '@mui/material';
import { RR_COLORS, RR_RADIUS } from './tokens';

/**
 * Content-shaped dark skeletons for first load — replaces the bare
 * `<CircularProgress />` that 72 producer panels use, so the layout doesn't jump
 * when data arrives. Pick the `variant` that best matches the panel's body.
 *
 * @example
 * {loading && events.length === 0
 *   ? <LoadingSkeleton variant="list" count={5} />
 *   : <EventList events={events} />}
 */
export type LoadingSkeletonVariant = 'list' | 'table' | 'cards' | 'lines';

export interface LoadingSkeletonProps {
  /** Shape of the skeleton. Defaults to 'list'. */
  variant?: LoadingSkeletonVariant;
  /** Number of rows / cards / lines. Defaults per-variant (list 4, table 5, cards 3, lines 3). */
  count?: number;
  /** Optional test id on the wrapper. */
  testId?: string;
}

const SKEL_BG = 'rgba(148,163,184,0.14)';
const SKEL_HL = 'rgba(148,163,184,0.22)';

function Bone(props: {
  width?: number | string;
  height?: number | string;
  variant?: 'text' | 'rectangular' | 'circular';
  radius?: number;
}): ReactElement {
  return (
    <Skeleton
      animation="wave"
      variant={props.variant ?? 'text'}
      width={props.width}
      height={props.height}
      sx={{
        bgcolor: SKEL_BG,
        borderRadius: props.radius ?? undefined,
        '&::after': { background: `linear-gradient(90deg, transparent, ${SKEL_HL}, transparent)` },
      }}
    />
  );
}

function ListRows({ count }: { count: number }): ReactElement {
  return (
    <Stack spacing={1}>
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            gap: 1.2,
            p: 1.2,
            borderRadius: RR_RADIUS.row,
            bgcolor: RR_COLORS.surfaceBg,
            border: RR_COLORS.border,
          }}
        >
          <Bone variant="circular" width={32} height={32} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Bone width="40%" height={14} />
            <Bone width="90%" height={12} />
            <Bone width="65%" height={12} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function TableRows({ count }: { count: number }): ReactElement {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: RR_RADIUS.panel,
        bgcolor: RR_COLORS.panelBg,
        border: RR_COLORS.border,
      }}
    >
      <Stack spacing={1.1}>
        {Array.from({ length: count }).map((_, i) => (
          <Stack key={i} direction="row" spacing={1.5} alignItems="center">
            <Bone width="22%" height={14} />
            <Bone width="40%" height={14} />
            <Bone width="18%" height={14} />
            <Box sx={{ flex: 1 }} />
            <Bone width={48} height={14} />
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function Cards({ count }: { count: number }): ReactElement {
  return (
    <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          sx={{
            flex: '1 1 160px',
            minWidth: 160,
            p: 1.4,
            borderRadius: RR_RADIUS.panel,
            bgcolor: RR_COLORS.cardBg,
            border: RR_COLORS.border,
            borderLeft: `3px solid ${RR_COLORS.borderColor}`,
          }}
        >
          <Bone width="55%" height={11} />
          <Bone width="40%" height={26} />
          <Bone width="70%" height={11} />
        </Box>
      ))}
    </Stack>
  );
}

function Lines({ count }: { count: number }): ReactElement {
  return (
    <Stack spacing={0.8}>
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} width={i === count - 1 ? '60%' : '100%'} height={13} />
      ))}
    </Stack>
  );
}

const DEFAULT_COUNT: Record<LoadingSkeletonVariant, number> = {
  list: 4,
  table: 5,
  cards: 3,
  lines: 3,
};

export default function LoadingSkeleton({
  variant = 'list',
  count,
  testId,
}: LoadingSkeletonProps): ReactElement {
  const n = count ?? DEFAULT_COUNT[variant];
  return (
    <Box data-testid={testId ?? 'loading-skeleton'} data-variant={variant} aria-busy="true">
      {variant === 'list' ? <ListRows count={n} /> : null}
      {variant === 'table' ? <TableRows count={n} /> : null}
      {variant === 'cards' ? <Cards count={n} /> : null}
      {variant === 'lines' ? <Lines count={n} /> : null}
    </Box>
  );
}
