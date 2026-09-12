/**
 * RoleRoomEduLogo — gjenbrukbart The Role Room-logo-lockup for mørke flater.
 *
 * Bruker det ekte merket (masker + klaffbrett) fra TheRoleRoom_Logo_v2.png,
 * beskåret via background-crop, + «THE ROLE ROOM» i HVITT (så ordmerket alltid
 * er lesbart på mørk bakgrunn — den originale PNG-en har mørk-lilla tekst som
 * forsvinner mot mørkt). Samme look som det kinematiske hero-bildet.
 */

import { Box, Stack, Typography } from '@mui/material';

export function RoleRoomEduLogo({
  markSize = 46,
  showTagline = true,
}: {
  markSize?: number;
  showTagline?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.4}>
      <Box
        role="img"
        aria-label="The Role Room"
        sx={{
          width: markSize, height: markSize, flexShrink: 0,
          backgroundImage: 'url(/TheRoleRoom_Logo_v2.png)',
          backgroundSize: '210% auto',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
          // Lysende lilla glød så merket «synes mer» (som på hero-bildet):
          // radial halo (0 0-blur) i to lag.
          filter: 'drop-shadow(0 0 13px rgba(139,92,246,0.75)) drop-shadow(0 0 5px rgba(196,181,253,0.55))',
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: markSize * 0.33, letterSpacing: 1.2, lineHeight: 1.05, color: '#fff', whiteSpace: 'nowrap' }}>
          THE ROLE ROOM
        </Typography>
        {showTagline && (
          <Typography sx={{ fontSize: markSize * 0.2, color: '#c4b5fd', letterSpacing: 0.4, lineHeight: 1, mt: 0.25 }}>
            Casting. Roles. Together.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export default RoleRoomEduLogo;
