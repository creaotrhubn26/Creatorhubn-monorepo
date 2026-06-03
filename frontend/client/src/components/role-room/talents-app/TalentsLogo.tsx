/**
 * TalentsLogo.tsx — "The Role Room" logo + "TALENTS" under.
 *
 * Bruker /theroleroom-app-icon-1024-transparent.png (original lilla
 * logo med teater-masker + clapperboard + person-ikon).
 *
 * Branding-strategi: Originale lilla brand-farger bevares. For å sikre
 * kontrast mot mørk lilla sidebar-bakgrunn, plasseres logoen på en
 * lys hvit card-bakgrunn med padding + subtil drop-shadow.
 */

import { Box, Typography } from '@mui/material';
import { palette, radius } from './theme';

interface TalentsLogoProps {
  /** Sidebar-header (large) eller topbar/loading (compact). */
  variant?: 'large' | 'compact';
}

// Hvit card-bakgrunn for å gi den lilla logoen kontrast mot mørk sidebar.
const LIGHT_CARD_BG = '#ffffff';

export default function TalentsLogo({ variant = 'large' }: TalentsLogoProps) {
  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            bgcolor: LIGHT_CARD_BG,
            borderRadius: radius.sm,
            p: 0.4,
            display: 'inline-flex',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <Box
            component="img"
            src="/theroleroom-app-icon-1024-transparent.png"
            alt="The Role Room Talents"
            sx={{ height: 24, width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </Box>
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
        gap: 0.6,
      }}
    >
      <Box
        sx={{
          bgcolor: LIGHT_CARD_BG,
          borderRadius: radius.md,
          p: 1.4,
          display: 'inline-flex',
          boxShadow: '0 4px 16px rgba(168,85,247,0.18), 0 1px 3px rgba(0,0,0,0.4)',
          // Subtil hvit-glow så card-en pop'er mot mørk sidebar
        }}
      >
        <Box
          component="img"
          src="/theroleroom-app-icon-1024-transparent.png"
          alt="The Role Room"
          sx={{
            width: '100%',
            maxWidth: 120,
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </Box>
      <Typography
        sx={{
          color: palette.accentBright,
          fontSize: '0.78rem',
          fontWeight: 800,
          letterSpacing: '0.42em',
        }}
      >
        TALENTS
      </Typography>
    </Box>
  );
}
