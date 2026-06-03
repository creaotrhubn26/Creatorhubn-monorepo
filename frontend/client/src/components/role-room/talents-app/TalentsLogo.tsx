/**
 * TalentsLogo.tsx — "The Role Room" eksisterende logo + "TALENTS" under.
 *
 * Bruker /theroleroom-app-icon-1024-transparent.png (oppdatert logo med
 * teater-masker + clapperboard + person-ikon + "Casting. Roles. Together."
 * tagline) + "TALENTS"-tekst under for sidebar-header.
 */

import { Box, Typography } from '@mui/material';
import { palette } from './theme';

interface TalentsLogoProps {
  /** Sidebar-header (large) eller topbar/loading (compact). */
  variant?: 'large' | 'compact';
}

export default function TalentsLogo({ variant = 'large' }: TalentsLogoProps) {
  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="img"
          src="/theroleroom-app-icon-1024-transparent.png"
          alt="The Role Room Talents"
          sx={{ height: 28, width: 'auto', objectFit: 'contain' }}
        />
        <Typography
          sx={{
            color: palette.accentBright,
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.28em',
          }}
        >
          TALENTS
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.4,
      }}
    >
      <Box
        component="img"
        src="/theroleroom-app-icon-1024-transparent.png"
        alt="The Role Room"
        sx={{
          width: '100%',
          maxWidth: 140,
          height: 'auto',
          objectFit: 'contain',
        }}
      />
      <Typography
        sx={{
          color: palette.accentBright,
          fontSize: '0.78rem',
          fontWeight: 800,
          letterSpacing: '0.42em',
          mt: -0.2,
        }}
      >
        TALENTS
      </Typography>
    </Box>
  );
}
