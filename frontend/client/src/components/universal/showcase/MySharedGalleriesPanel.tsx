// @ts-nocheck
/**
 * MySharedGalleriesPanel
 *
 * Liste over photographer_client_galleries denne fotografen eier.
 * Lar Fredrik:
 *  - Se hvilke share-lenker som er aktive / revokerte / utløpt
 *  - Kopiere eksisterende share-URL
 *  - Revokere en lenke (status='revoked' — fungerer ikke mer)
 *  - Regenerere accessToken (gammel slutter umiddelbart)
 *
 * Wires inn via en knapp øverst i ShowcaseSharingDialog. Backend-rutene
 * lever i backend/server/showcase-misc-routes.ts.
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
  Chip,
  IconButton,
  Button,
  Stack,
  LinearProgress,
  Alert,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  AutorenewOutlined as RegenerateIcon,
  BlockOutlined as RevokeIcon,
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SharedGallery {
  id: string;
  projectTitle: string;
  clientName: string;
  clientEmail: string;
  accessToken: string;
  status: 'active' | 'revoked' | string;
  projectState: 'in_review' | 'delivered' | null;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

interface MySharedGalleriesPanelProps {
  open: boolean;
  onClose: () => void;
}

function statusLabel(g: SharedGallery): { label: string; color: 'success' | 'warning' | 'error' | 'default' } {
  if (g.status === 'revoked') return { label: 'Revokert', color: 'error' };
  if (g.isExpired) return { label: 'Utløpt', color: 'warning' };
  if (g.projectState === 'delivered') return { label: 'Levert', color: 'success' };
  if (g.projectState === 'in_review') return { label: 'Til review', color: 'warning' };
  return { label: 'Aktiv', color: 'success' };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildShareUrl(accessToken: string): string {
  if (typeof window === 'undefined') return `/client/gallery/${accessToken}`;
  return `${window.location.origin}/client/gallery/${accessToken}`;
}

export default function MySharedGalleriesPanel({ open, onClose }: MySharedGalleriesPanelProps) {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<SharedGallery | null>(null);
  const [regenerated, setRegenerated] = useState<{ galleryId: string; shareUrl: string } | null>(null);

  const { data, isLoading, error } = useQuery<{ galleries: SharedGallery[] }>({
    queryKey: ['/api/showcase/galleries/mine'],
    queryFn: () => apiRequest('/api/showcase/galleries/mine'),
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const galleries = data?.galleries ?? [];

  const revokeMutation = useMutation({
    mutationFn: async (galleryId: string) =>
      apiRequest(`/api/showcase/galleries/${galleryId}/revoke`, { method: 'POST' }) as Promise<any>,
    onSuccess: (result: any, _galleryId) => {
      setToast(result?.message ?? 'Lenken er revokert.');
      queryClient.invalidateQueries({ queryKey: ['/api/showcase/galleries/mine'] });
      setPendingRevoke(null);
    },
    onError: (err: any) => {
      setToast(`Kunne ikke revokere: ${err?.message ?? 'ukjent feil'}`);
      setPendingRevoke(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (galleryId: string) =>
      apiRequest(`/api/showcase/galleries/${galleryId}/regenerate-token`, { method: 'POST' }) as Promise<any>,
    onSuccess: (result: any, galleryId) => {
      const shareUrl = typeof result?.shareUrl === 'string' ? result.shareUrl : buildShareUrl(result?.accessToken ?? '');
      setRegenerated({ galleryId, shareUrl });
      queryClient.invalidateQueries({ queryKey: ['/api/showcase/galleries/mine'] });
    },
    onError: (err: any) => {
      setToast(`Kunne ikke regenerere lenke: ${err?.message ?? 'ukjent feil'}`);
    },
  });

  const handleCopy = (url: string) => {
    void navigator.clipboard.writeText(url);
    setToast('Lenke kopiert til utklippstavlen.');
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Mine delte galleries</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {isLoading && <LinearProgress sx={{ my: 2 }} />}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Kunne ikke laste galleries: {(error as Error)?.message ?? 'ukjent feil'}
            </Alert>
          )}
          {!isLoading && galleries.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Ingen delte galleries ennå. Når du sender et showcase til en klient dukker det opp her.
              </Typography>
            </Box>
          )}
          <Stack spacing={1.5}>
            {galleries.map((g) => {
              const status = statusLabel(g);
              const shareUrl = buildShareUrl(g.accessToken);
              const isRevoked = g.status === 'revoked';
              const newUrl = regenerated?.galleryId === g.id ? regenerated.shareUrl : null;
              return (
                <Box
                  key={g.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    opacity: isRevoked ? 0.7 : 1,
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1, alignItems: { sm: 'center' } }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                      {g.projectTitle}
                    </Typography>
                    <Chip size="small" label={status.label} color={status.color === 'default' ? undefined : status.color} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {g.clientName} — {g.clientEmail}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Opprettet {formatDate(g.createdAt)}
                    {g.expiresAt ? ` · Utløper ${formatDate(g.expiresAt)}` : ''}
                  </Typography>

                  {newUrl && (
                    <Alert severity="info" sx={{ mb: 1 }} onClose={() => setRegenerated(null)}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        Ny lenke generert. Kopier og send manuelt til klient.
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="caption"
                          component="code"
                          sx={{ flex: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}
                        >
                          {newUrl}
                        </Typography>
                        <Button size="small" onClick={() => handleCopy(newUrl)}>Kopier</Button>
                      </Box>
                    </Alert>
                  )}

                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Tooltip title={isRevoked ? 'Lenken er revokert' : 'Kopier share-lenke'}>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ContentCopyIcon />}
                          onClick={() => handleCopy(shareUrl)}
                          disabled={isRevoked}
                        >
                          Kopier lenke
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Åpne i ny fane (det klienten ser)">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => window.open(shareUrl, '_blank')}
                          disabled={isRevoked}
                        >
                          Forhåndsvis
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Generer ny accessToken — gammel lenke slutter å virke">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<RegenerateIcon />}
                          onClick={() => regenerateMutation.mutate(g.id)}
                          disabled={regenerateMutation.isPending}
                        >
                          Ny lenke
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={isRevoked ? 'Allerede revokert' : 'Revoker lenken — klienten mister tilgang umiddelbart'}>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<RevokeIcon />}
                          onClick={() => setPendingRevoke(g)}
                          disabled={isRevoked || revokeMutation.isPending}
                        >
                          Revoker
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingRevoke} onClose={() => setPendingRevoke(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Revoker lenken til «{pendingRevoke?.projectTitle}»?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingRevoke?.clientName} ({pendingRevoke?.clientEmail}) mister tilgang umiddelbart.
            Kommentarer og selections beholdes for audit. Handlingen kan ikke angres,
            men du kan generere en ny lenke etterpå.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRevoke(null)}>Avbryt</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => pendingRevoke && revokeMutation.mutate(pendingRevoke.id)}
            disabled={revokeMutation.isPending}
          >
            Revoker
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
