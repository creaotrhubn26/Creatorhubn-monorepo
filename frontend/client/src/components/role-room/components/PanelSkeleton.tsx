/**
 * PanelSkeleton — gjenbrukbare loading-placeholders for tab-switch og
 * Suspense-fallbacks. Hver variant er konfigurert for en typisk panel-form.
 */

import { Box, Skeleton } from '@mui/material';

export type PanelSkeletonVariant = 'panel' | 'list' | 'grid' | 'form' | 'kanban';

interface PanelSkeletonProps {
  variant?: PanelSkeletonVariant;
  /** Antall placeholder-rader/kort. Default per variant. */
  count?: number;
  /** ARIA-label. Default: "Laster innhold". */
  ariaLabel?: string;
}

export const PanelSkeleton = ({
  variant = 'panel',
  count,
  ariaLabel = 'Laster innhold',
}: PanelSkeletonProps) => {
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      sx={{
        width: '100%',
        height: '100%',
        p: { xs: 2, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {variant === 'panel' && <PanelVariant count={count ?? 3} />}
      {variant === 'list' && <ListVariant count={count ?? 5} />}
      {variant === 'grid' && <GridVariant count={count ?? 6} />}
      {variant === 'form' && <FormVariant count={count ?? 4} />}
      {variant === 'kanban' && <KanbanVariant count={count ?? 3} />}
    </Box>
  );
};

const SKELETON_SX = { bgcolor: 'rgba(255,255,255,0.06)' };

const PanelVariant = ({ count }: { count: number }) => (
  <>
    {/* Header */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
      <Skeleton variant="rectangular" width={48} height={48} sx={{ ...SKELETON_SX, borderRadius: 2 }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="40%" height={26} sx={SKELETON_SX} />
        <Skeleton variant="text" width="60%" height={18} sx={SKELETON_SX} />
      </Box>
    </Box>
    {/* Content blocks */}
    {Array.from({ length: count }).map((_, idx) => (
      <Skeleton
        key={idx}
        variant="rectangular"
        height={idx === 0 ? 120 : 80}
        sx={{ ...SKELETON_SX, borderRadius: 2 }}
      />
    ))}
  </>
);

const ListVariant = ({ count }: { count: number }) => (
  <>
    {Array.from({ length: count }).map((_, idx) => (
      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Skeleton variant="circular" width={40} height={40} sx={SKELETON_SX} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="35%" height={20} sx={SKELETON_SX} />
          <Skeleton variant="text" width="55%" height={16} sx={SKELETON_SX} />
        </Box>
        <Skeleton variant="rectangular" width={60} height={24} sx={{ ...SKELETON_SX, borderRadius: 1 }} />
      </Box>
    ))}
  </>
);

const GridVariant = ({ count }: { count: number }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: 'repeat(2, 1fr)',
        sm: 'repeat(3, 1fr)',
        md: 'repeat(4, 1fr)',
      },
      gap: 2,
    }}
  >
    {Array.from({ length: count }).map((_, idx) => (
      <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton variant="rectangular" height={140} sx={{ ...SKELETON_SX, borderRadius: 2 }} />
        <Skeleton variant="text" width="80%" sx={SKELETON_SX} />
        <Skeleton variant="text" width="50%" sx={SKELETON_SX} />
      </Box>
    ))}
  </Box>
);

const FormVariant = ({ count }: { count: number }) => (
  <>
    {Array.from({ length: count }).map((_, idx) => (
      <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Skeleton variant="text" width="25%" height={14} sx={SKELETON_SX} />
        <Skeleton variant="rectangular" height={42} sx={{ ...SKELETON_SX, borderRadius: 1 }} />
      </Box>
    ))}
  </>
);

const KanbanVariant = ({ count }: { count: number }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: `repeat(${count}, 1fr)`,
      },
      gap: 2,
    }}
  >
    {Array.from({ length: count }).map((_, columnIdx) => (
      <Box key={columnIdx} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Skeleton variant="text" width="60%" height={22} sx={SKELETON_SX} />
        {Array.from({ length: 3 }).map((_, cardIdx) => (
          <Skeleton
            key={cardIdx}
            variant="rectangular"
            height={90}
            sx={{ ...SKELETON_SX, borderRadius: 2 }}
          />
        ))}
      </Box>
    ))}
  </Box>
);

export default PanelSkeleton;
