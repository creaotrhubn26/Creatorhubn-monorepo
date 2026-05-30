/**
 * Klient-Brief — klienten ser briefen produsenten har samlet, kan kommentere
 * og fylle ut felter de selv har info om. Bruker RoleRoomMobileBriefWizard som
 * allerede har steg + autosave + kommentarer.
 */
import { lazy, Suspense } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

const RoleRoomMobileBriefWizard = lazy(
  () => import('../mobile-brief/RoleRoomMobileBriefWizard'),
);

export default function ClientBriefView({ projectId }: { projectId: string }) {
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
          Brief
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.66)' }}>
          Mål, målgruppe, leveranser og referanser. Begge dere ser samme brief —
          endringer du gjør synker til produsenten umiddelbart.
        </Typography>
      </Box>
      <Suspense
        fallback={
          <Stack direction="row" justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress size={24} sx={{ color: '#22d3ee' }} />
          </Stack>
        }
      >
        <RoleRoomMobileBriefWizard projectId={projectId} />
      </Suspense>
    </Stack>
  );
}
