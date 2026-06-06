// @ts-nocheck
/**
 * MultiRoundManagerPanel
 *
 * Lar Fredrik starte en ny proofing-runde på et galleri etter at klienten
 * har gitt feedback. Eksisterende selections fra forrige runde beholdes
 * for sammenligning; nye selections inherits den nye runde-nummeret.
 *
 * Backend:
 *   GET  /api/photographer/galleries          (eksisterende — gallery list)
 *   POST /api/showcase/galleries/:id/start-new-round  (denne PR-en)
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Box,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Alert,
  Stack,
  Chip,
  Snackbar,
} from '@mui/material';
import {
  Close as CloseIcon,
  RestartAlt as RestartAltIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PhotographerGallery {
  id: string;
  projectTitle: string;
  clientName: string;
  clientEmail: string;
  status: string;
  gallerySettings?: { proofingRound?: number; projectState?: string };
  createdAt?: string;
}

interface MultiRoundManagerPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function MultiRoundManagerPanel({ open, onClose }: MultiRoundManagerPanelProps) {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [pendingNewRound, setPendingNewRound] = useState<PhotographerGallery | null>(null);

  const { data, isLoading, error } = useQuery<{ galleries: PhotographerGallery[] }>({
    queryKey: ['/api/photographer/galleries'],
    queryFn: () => apiRequest('/api/photographer/galleries'),
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const galleries = data?.galleries ?? [];

  const startRoundMutation = useMutation({
    mutationFn: async (galleryId: string) =>
      apiRequest(`/api/showcase/galleries/${galleryId}/start-new-round`, { method: 'POST' }) as Promise<any>,
    onSuccess: (result: any) => {
      setToast(result?.message ?? `Runde ${result?.round} startet.`);
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
      setPendingNewRound(null);
    },
    onError: (err: any) => {
      setToast(`Kunne ikke starte ny runde: ${err?.message ?? 'ukjent feil'}`);
      setPendingNewRound(null);
    },
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">Runde-håndtering</Typography>
            <Typography variant="caption" color="text.secondary">
              Start ny runde etter klient-feedback. Tidligere valg beholdes for sammenligning.
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {isLoading && <LinearProgress sx={{ mb: 2 }} />}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Kunne ikke laste galleries: {(error as Error)?.message ?? 'ukjent feil'}
            </Alert>
          )}
          {!isLoading && galleries.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Ingen galleries ennå. Når du deler et showcase med en klient dukker det opp her.
              </Typography>
            </Box>
          )}
          <Stack spacing={1.5}>
            {galleries
              .filter((g) => g.status === 'active' || g.status === 'completed')
              .map((g) => {
                const round = Number(g.gallerySettings?.proofingRound ?? 1) || 1;
                const state = g.gallerySettings?.projectState;
                return (
                  <Box
                    key={g.id}
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                        {g.projectTitle}
                      </Typography>
                      <Chip
                        size="small"
                        label={`Runde ${round}`}
                        color={round > 1 ? 'warning' : 'default'}
                        variant={round > 1 ? 'filled' : 'outlined'}
                      />
                      {state && (
                        <Chip
                          size="small"
                          label={state === 'delivered' ? 'Levert' : 'Til review'}
                          color={state === 'delivered' ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {g.clientName} — {g.clientEmail}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<RestartAltIcon />}
                      onClick={() => setPendingNewRound(g)}
                      disabled={startRoundMutation.isPending}
                    >
                      Start runde {round + 1}
                    </Button>
                  </Box>
                );
              })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingNewRound} onClose={() => setPendingNewRound(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Start runde {(Number(pendingNewRound?.gallerySettings?.proofingRound ?? 1) || 1) + 1} på «{pendingNewRound?.projectTitle}»?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Klienten kan velge på nytt fra galleriet. Eksisterende valg fra runde{' '}
            {Number(pendingNewRound?.gallerySettings?.proofingRound ?? 1) || 1} beholdes for sammenligning.
            Galleriets utløpsdato settes 30 dager fram, og state flippes tilbake til «til review».
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingNewRound(null)}>Avbryt</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => pendingNewRound && startRoundMutation.mutate(pendingNewRound.id)}
            disabled={startRoundMutation.isPending}
          >
            Start ny runde
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
