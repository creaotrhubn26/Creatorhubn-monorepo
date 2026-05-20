/**
 * NextRoleGdprDialog — Brukerens kontroll over NextRole-data.
 *
 * To handlinger:
 *   • Last ned alle dataene mine (ZIP) — GDPR Artikkel 20
 *   • Slett alle NextRole-data permanent (GDPR Artikkel 17 — to-stegs
 *     bekreftelse for å unngå feilklikk)
 *
 * Selve CreatorHub-kontoen berøres ikke — den slettes fra
 * hovedinnstillingene.
 */

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Alert, IconButton,
  CircularProgress, Paper, TextField, Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  DeleteForever as DeleteForeverIcon,
  ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DeletePreview {
  confirmToken: string;
  ttlSec: number;
  willDelete: {
    cvs: number;
    coverLetters: number;
    jobApplications: number;
    milestones: number;
    interviewSessions: number;
    videoPresentations: number;
  };
}

export const NextRoleGdprDialog: React.FC<Props> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [deleteStep, setDeleteStep] = useState<'idle' | 'preview' | 'confirm' | 'done'>('idle');
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    trackGA4('nextrole_gdpr_export_requested');
    try {
      // Hent ZIP via fetch (apiRequest returnerer JSON som default)
      const res = await fetch('/api/users/me/nextrole-data-export', {
        headers: { 'x-user-id': user?.id || '' },
      });
      if (!res.ok) throw new Error(`Export feilet: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nextrole-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      trackGA4('nextrole_gdpr_export_downloaded');
    } catch (err) {
      console.error('Export feilet', err);
      setExportError('Kunne ikke laste ned. Prøv på nytt.');
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = (await apiRequest('/api/users/me/nextrole-data-delete', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request: true }),
      })) as DeletePreview;
      setDeletePreview(res);
      setDeleteStep('preview');
      trackGA4('nextrole_gdpr_delete_preview', {
        cv_count: res.willDelete.cvs,
        app_count: res.willDelete.jobApplications,
      });
    } catch (err) {
      console.error('Delete preview feilet', err);
      setDeleteError('Kunne ikke hente sletteliste.');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletePreview) return;
    if (confirmText !== 'SLETT') {
      setDeleteError('Skriv SLETT i tekstfeltet for å bekrefte.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest('/api/users/me/nextrole-data-delete', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmToken: deletePreview.confirmToken }),
      });
      setDeleteStep('done');
      trackGA4('nextrole_gdpr_delete_confirmed');
    } catch (err) {
      console.error('Delete-bekreftelse feilet', err);
      setDeleteError('Sletting feilet. Token kan være utløpt — prøv på nytt.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteStep('idle');
    setDeletePreview(null);
    setConfirmText('');
    setDeleteError(null);
  };

  const totalToDelete = deletePreview
    ? Object.values(deletePreview.willDelete).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ShieldIcon sx={{ color: '#1F2937' }} />
          <Typography variant="h6">Personvern og data</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* EKSPORT */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <DownloadIcon sx={{ color: '#3B82F6' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Last ned alle dataene mine
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Få en ZIP-fil med CV-er, søknadsbrev, jobbsøknader, intervju-historikk,
              video-presentasjoner og referrals — i JSON-format. GDPR Artikkel 20.
            </Typography>
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Genererer …' : 'Last ned ZIP'}
            </Button>
            {exportError && <Alert severity="error" sx={{ mt: 1 }}>{exportError}</Alert>}
          </Box>

          <Divider />

          {/* SLETTING */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <DeleteForeverIcon sx={{ color: '#DC2626' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Slett alle mine NextRole-data
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Permanent sletting av alt du har laget i NextRole. CreatorHub-kontoen
              din (e-post, navn, andre apper) berøres ikke — det må gjøres fra
              hovedinnstillingene. GDPR Artikkel 17.
            </Typography>

            {deleteStep === 'idle' && (
              <Button
                variant="outlined"
                color="error"
                startIcon={deleting ? <CircularProgress size={16} /> : <DeleteForeverIcon />}
                onClick={handleRequestDelete}
                disabled={deleting}
              >
                Start sletting
              </Button>
            )}

            {deleteStep === 'preview' && deletePreview && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FEF2F2', borderColor: '#DC2626' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#DC2626', mb: 1 }}>
                  Du er i ferd med å slette {totalToDelete} elementer permanent:
                </Typography>
                <Stack spacing={0.3} sx={{ ml: 1, mb: 2 }}>
                  {deletePreview.willDelete.cvs > 0 && (
                    <Typography variant="body2">• {deletePreview.willDelete.cvs} CV-er</Typography>
                  )}
                  {deletePreview.willDelete.coverLetters > 0 && (
                    <Typography variant="body2">• {deletePreview.willDelete.coverLetters} søknadsbrev</Typography>
                  )}
                  {deletePreview.willDelete.jobApplications > 0 && (
                    <Typography variant="body2">• {deletePreview.willDelete.jobApplications} jobbsøknader</Typography>
                  )}
                  {deletePreview.willDelete.milestones > 0 && (
                    <Typography variant="body2">• {deletePreview.willDelete.milestones} deadlines</Typography>
                  )}
                  {deletePreview.willDelete.interviewSessions > 0 && (
                    <Typography variant="body2">• {deletePreview.willDelete.interviewSessions} intervju-sesjoner</Typography>
                  )}
                  {deletePreview.willDelete.videoPresentations > 0 && (
                    <Typography variant="body2">• {deletePreview.willDelete.videoPresentations} video-presentasjoner</Typography>
                  )}
                </Stack>

                <Alert severity="warning" sx={{ mb: 2 }}>
                  Slettingen kan IKKE reverseres. Last ned dataene først hvis du vil bevare dem.
                </Alert>

                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 700 }}>
                  Skriv <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 3 }}>SLETT</code> for å bekrefte:
                </Typography>
                <TextField
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="SLETT"
                  autoFocus
                  sx={{ mb: 1 }}
                />

                {deleteError && <Alert severity="error" sx={{ mb: 1 }}>{deleteError}</Alert>}

                <Stack direction="row" spacing={1}>
                  <Button onClick={cancelDelete} disabled={deleting}>Avbryt</Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
                    onClick={handleConfirmDelete}
                    disabled={deleting || confirmText !== 'SLETT'}
                  >
                    {deleting ? 'Sletter …' : 'Bekreft permanent sletting'}
                  </Button>
                </Stack>
              </Paper>
            )}

            {deleteStep === 'done' && (
              <Alert severity="success">
                Alle NextRole-data slettet. Du kan lukke dialogen — refresher
                appen automatisk når du er klar.
              </Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NextRoleGdprDialog;
