import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { RoleRoomWorkspaceLens } from './productionWorkspaceLens';
import { getRoleRoomWorkspaceVisual } from './workspaceVisualRegistry';

interface RoleRoomWorkspaceVisualProps {
  lens?: RoleRoomWorkspaceLens;
  variant?: 'thumbnail' | 'hero';
  decorative?: boolean;
  loading?: 'eager' | 'lazy';
  sx?: SxProps<Theme>;
}

export function RoleRoomWorkspaceVisual({
  lens = 'full',
  variant = 'thumbnail',
  decorative = true,
  loading = 'lazy',
  sx,
}: RoleRoomWorkspaceVisualProps) {
  const visual = getRoleRoomWorkspaceVisual(lens);
  const isHero = variant === 'hero';

  return (
    <Box
      data-testid={`role-room-workspace-visual-${visual.family}`}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        bgcolor: '#111827',
        border: '1px solid rgba(147,164,220,.2)',
        borderRadius: isHero ? 0 : 1.5,
        ...sx,
      }}
    >
      <Box
        component="img"
        src={visual.src}
        alt={decorative ? '' : visual.label}
        aria-hidden={decorative ? true : undefined}
        loading={loading}
        decoding="async"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: visual.objectPosition,
          filter: isHero ? 'saturate(.82) contrast(1.02)' : 'saturate(.72) contrast(1.06)',
          transform: 'scale(1.01)',
        }}
      />
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          background: isHero
            ? 'linear-gradient(180deg, rgba(7,11,17,.02) 20%, rgba(7,11,17,.72) 100%)'
            : 'linear-gradient(135deg, rgba(7,11,17,.08), rgba(42,61,86,.28))',
        }}
      />
    </Box>
  );
}

export default RoleRoomWorkspaceVisual;
