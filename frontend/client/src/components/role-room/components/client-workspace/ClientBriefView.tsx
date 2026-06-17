/**
 * Klient-Brief — klienten ser briefen produsenten har samlet, kan kommentere
 * og fylle ut felter de selv har info om. Bruker RoleRoomMobileBriefWizard som
 * allerede har steg + autosave + kommentarer.
 */
import { lazy, Suspense, useState } from 'react';
import { Box, Button, CircularProgress, Snackbar, Stack, Typography } from '@mui/material';
import { CloudUploadOutlined as PublishIcon } from '@mui/icons-material';
import { useClientIntake } from '../../hooks/useClientIntake';
import ClientAwaitingPublish from './ClientAwaitingPublish';

const RoleRoomMobileBriefWizard = lazy(
  () => import('../mobile-brief/RoleRoomMobileBriefWizard'),
);

export default function ClientBriefView({ projectId }: { projectId: string }) {
  // Klienten ser briefen først når produsenten har publisert den (backend-gate
  // returnerer null for upublisert → publishedAt mangler).
  const { intake, loading, publish, publishing } = useClientIntake(projectId);
  const published = Boolean(intake?.publishedAt);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
          Brief
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.66)' }}>
          Mål, målgruppe, leveranser og referanser. Du ser den publiserte
          briefen — innspillene dine synker tilbake til produsenten når du
          publiserer.
        </Typography>
      </Box>
      {loading ? (
        <Stack direction="row" justifyContent="center" sx={{ py: 4 }}>
          <CircularProgress size={24} sx={{ color: '#22d3ee' }} />
        </Stack>
      ) : !published ? (
        <ClientAwaitingPublish noun="briefen" />
      ) : (
        <>
          <Suspense
            fallback={
              <Stack direction="row" justifyContent="center" sx={{ py: 4 }}>
                <CircularProgress size={24} sx={{ color: '#22d3ee' }} />
              </Stack>
            }
          >
            <RoleRoomMobileBriefWizard projectId={projectId} />
          </Suspense>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
            <Button
              variant="contained"
              startIcon={publishing ? <CircularProgress size={15} color="inherit" /> : <PublishIcon />}
              disabled={publishing}
              onClick={async () => {
                try {
                  await publish(true);
                  setToast('Innspillene dine er publisert til produsenten.');
                } catch {
                  setToast('Kunne ikke publisere innspillene. Prøv igjen.');
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44, bgcolor: '#0f766e', '&:hover': { bgcolor: '#0d655e' } }}
            >
              {publishing ? 'Publiserer …' : 'Publiser innspill til produsent'}
            </Button>
          </Box>
        </>
      )}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  );
}
