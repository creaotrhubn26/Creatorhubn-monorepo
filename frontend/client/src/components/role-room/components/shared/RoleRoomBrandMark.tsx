import { type FC } from 'react';
import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import useBrandingSettings from '../../hooks/useBrandingSettings';
import { ROLE_ROOM_BRAND_ASSETS } from '../../config/branding';

interface RoleRoomBrandMarkProps {
  size?: number;
  appearance?: 'badge' | 'header';
  showLabel?: boolean;
  label?: string;
  sx?: SxProps<Theme>;
}

const RoleRoomBrandMark: FC<RoleRoomBrandMarkProps> = ({
  size = 28,
  appearance = 'badge',
  showLabel = true,
  label,
  sx,
}) => {
  const branding = useBrandingSettings();
  const brandLabel = label || branding.identity.appName || 'The Role Room';
  const markUrl = branding.identity.iconUrl || ROLE_ROOM_BRAND_ASSETS.mark;

  if (appearance === 'header') {
    return (
      <Box
        component="img"
        src={markUrl}
        alt={brandLabel}
        sx={{
          width: { xs: 110, sm: 160 },
          maxWidth: '100%',
          height: 'auto',
          objectFit: 'contain',
          objectPosition: 'center',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
          ...sx,
        }}
      />
    );
  }

  return (
    <Stack
      direction="row"
      spacing={0.8}
      alignItems="center"
      sx={{
        px: 0.8,
        py: 0.45,
        borderRadius: 1.2,
        border: '1px solid rgba(56,189,248,0.42)',
        bgcolor: 'rgba(7,13,26,0.76)',
        boxShadow: '0 0 0 1px rgba(125,211,252,0.16) inset',
        ...sx,
      }}
    >
      <Box
        component="img"
        src={markUrl}
        alt={brandLabel}
        sx={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: 1,
          border: '1px solid rgba(186,230,253,0.6)',
          bgcolor: 'rgba(2,6,23,0.66)',
          p: 0.2,
          boxShadow: '0 0 14px rgba(168,85,247,0.28)',
          flexShrink: 0,
        }}
      />
      {showLabel ? (
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(186,230,253,0.96)',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {brandLabel}
        </Typography>
      ) : null}
    </Stack>
  );
};

export default RoleRoomBrandMark;
