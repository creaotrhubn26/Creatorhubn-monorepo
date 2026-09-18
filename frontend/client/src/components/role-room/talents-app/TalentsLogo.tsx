/**
 * TalentsLogo.tsx — "The Role Room" logo + "TALENTS" under.
 *
 * Bruker MERKE-filen theroleroom-mark-1024-transparent.png — masker,
 * klaffbrett og person-ikon, uten tekst.
 *
 * 🔑 Sto tidligere på app-ikonet, som er hele lockupen med tagline. I 24 px
 * var teksten uleselig grøt, og taglinen i den filen er dessuten feilstavet
 * («Casting. Boles. Together.»). Ordmerket «TALENTS» settes som tekst under.
 *
 * Den hvite card-bakgrunnen beholdes: et indigo merke på en mørk indigo
 * sidebar har for lite kontrast alene, og de hvite konturlinjene inne i
 * maskene hører til tegningen.
 */

import { Box, Typography } from '@mui/material';
import { palette, radius } from './theme';

interface TalentsLogoProps {
  /** Sidebar-header (large) eller topbar/loading (compact). */
  variant?: 'large' | 'compact';
}

// Hvit card-bakgrunn gir logoen kontrast mot den mørke sidebaren.
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
            src="/theroleroom-mark-1024-transparent.png"
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
          boxShadow: '0 4px 16px rgba(75, 61, 143,0.18), 0 1px 3px rgba(0,0,0,0.4)',
          // Subtil hvit-glow så card-en pop'er mot mørk sidebar
        }}
      >
        <Box
          component="img"
          src="/theroleroom-mark-1024-transparent.png"
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
