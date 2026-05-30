/**
 * Klient-Plan — leveranse-tidslinje + neste beslutninger. Gjenbruker
 * RoleRoomMobilePlannerView som allerede har bøtter ("I dag", "Neste",
 * "Blokkert", "Over frist") og fase-progress.
 *
 * Klient-perspektivet: «når kommer ting jeg må godkjenne / når er
 * leveransene mine klare?»
 */
import { lazy, Suspense } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useRoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';

const RoleRoomMobilePlannerView = lazy(
  () => import('../mobile-planner/RoleRoomMobilePlannerView'),
);

export default function ClientPlanView({ projectId }: { projectId: string }) {
  const viewport = useRoleRoomViewportMode();
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
          Plan
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.66)' }}>
          Leveranser, frister og hva produsenten jobber med nå.
        </Typography>
      </Box>
      <Suspense
        fallback={
          <Stack direction="row" justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress size={24} sx={{ color: '#22d3ee' }} />
          </Stack>
        }
      >
        {/* FAB-knappen "Create" vises fortsatt — Planner-komponenten har ikke
            ekstern prop for å skjule den ennå; tracker som follow-up. */}
        <RoleRoomMobilePlannerView projectId={projectId} mode={viewport.mode} />
      </Suspense>
    </Stack>
  );
}
