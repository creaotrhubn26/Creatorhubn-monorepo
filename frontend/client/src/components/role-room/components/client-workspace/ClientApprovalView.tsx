/**
 * Klient-Godkjenning — viser kø av materialer som venter på godkjenning.
 * Gjenbruker RoleRoomMobileApprovalView med klient-permissions: kan
 * godkjenne, avvise og kommentere, men IKKE redigere produsentens utkast.
 */
import { lazy, Suspense } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useRoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';

const RoleRoomMobileApprovalView = lazy(
  () => import('../mobile-approval/RoleRoomMobileApprovalView'),
);

export default function ClientApprovalView({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const viewport = useRoleRoomViewportMode();
  const currentUserId = user?.id != null ? String(user.id) : '';
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
          Godkjenning
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.66)' }}>
          Materialer som venter på din godkjenning. Du kan godkjenne, be om
          endringer, eller avvise — produsenten ser kommentarene dine umiddelbart.
        </Typography>
      </Box>
      <Suspense
        fallback={
          <Stack direction="row" justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress size={24} sx={{ color: '#22d3ee' }} />
          </Stack>
        }
      >
        {/* MobileApprovalView håndterer egne data-loader + canApprove/canRequestChanges/canReject/canComment */}
        <RoleRoomMobileApprovalView
          projectId={projectId}
          currentUserId={currentUserId}
          mode={viewport.mode}
          canApprove
          canRequestChanges
          canReject
          canComment
        />
      </Suspense>
    </Stack>
  );
}
