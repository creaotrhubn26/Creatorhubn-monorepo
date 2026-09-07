/**
 * TeamspaceLanding — landingsside for et teamspace.
 *
 * Lister verktøyene teamet bruker som kort som hopper videre. Flyttet ut
 * av AdminWorkspace.tsx da panel-registeret (panels.tsx) ble innført, så
 * registeret kan importere den uten sirkulær avhengighet.
 */

import { Box, Stack, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { BRAND } from './brand';
import type { WorkspaceItemId } from './workspaceItems';


export function TeamspaceLanding({
  label,
  cards,
  onJumpTo,
}: {
  label: string;
  cards: { id: WorkspaceItemId; label: string }[];
  onJumpTo: (id: WorkspaceItemId) => void;
}) {
  return (
    <Stack spacing={2}>
      <Typography sx={{ color: BRAND.textMuted, fontSize: '0.86rem' }}>
        {label}-team bruker disse verktøyene:
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {cards.map((c) => (
          <Stack
            key={c.id}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => onJumpTo(c.id)}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: BRAND.panelBg,
              border: `1px solid ${BRAND.border}`,
              cursor: 'pointer',
              '&:hover': { borderColor: BRAND.borderHover, bgcolor: BRAND.hoverBg },
            }}
          >
            <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.88rem' }}>
              {c.label}
            </Typography>
            <ChevronRightIcon sx={{ color: BRAND.accent }} />
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}

export default TeamspaceLanding;
