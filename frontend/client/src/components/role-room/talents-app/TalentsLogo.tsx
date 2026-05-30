/**
 * TalentsLogo.tsx — "The Role Room" eksisterende logo + "TALENTS" under.
 *
 * Bruker /TheRoleRoom_Logo_Tagline.png (eksisterende asset) som master,
 * stacker "TALENTS" tekst under for å matche mockup #11 sidebar-header.
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
          src="/TheRoleRoom_Logo_Tagline.png"
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
        alignItems: 'flex-start',
        gap: 0.6,
        pl: 0.4,
      }}
    >
      <Box
        component="img"
        src="/TheRoleRoom_Logo_Tagline.png"
        alt="The Role Room"
        sx={{
          width: '100%',
          maxWidth: 180,
          height: 'auto',
          objectFit: 'contain',
          // Sett ned tagline-fading slik at "TALENTS" under blir den dominante undertittelen
          filter: 'brightness(1.05)',
        }}
      />
      <Typography
        sx={{
          color: palette.accentBright,
          fontSize: '0.78rem',
          fontWeight: 800,
          letterSpacing: '0.42em',
          pl: '54px', // align under "ROLE ROOM"-teksten (etter ikon-delen av logo)
          mt: -0.4,
        }}
      >
        TALENTS
      </Typography>
    </Box>
  );
}
