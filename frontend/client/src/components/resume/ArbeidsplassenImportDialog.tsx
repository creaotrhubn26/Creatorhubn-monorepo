/**
 * ArbeidsplassenImportDialog — auto-import av stilling fra NAV.
 *
 * Brukerflyt:
 *   1. Bruker limer inn URL fra arbeidsplassen.no
 *   2. Klikk "Hent stilling" → backend henter via NAV's åpne API
 *   3. Preview vises (tittel, selskap, beskrivelse, søknadsfrist)
 *   4. Klikk "Opprett som jobbsøknad" → POST /api/job-applications
 *      + valgfri auto-opprett av søknadsfrist-milepæl
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, Paper, Chip,
  CircularProgress, Alert, IconButton, Divider, Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  Link as LinkIcon,
  WorkOutline as WorkIcon,
  EventNote as DeadlineIcon,
  CheckCircle as CheckIcon,
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

interface NavStilling {
  uuid: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  description: string | null;
  applicationDeadline: string | null;
  applicationUrl: string;
  source: string;
  contacts: Array<{ name: string; email: string | null; phone: string | null; title: string | null }>;
  categories: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: (jobApplicationId: string) => void;
}

export const ArbeidsplassenImportDialog: React.FC<Props> = ({ open, onClose, onImported }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [stilling, setStilling] = useState<NavStilling | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDeadline, setCreateDeadline] = useState(true);
  const [done, setDone] = useState(false);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setError(null);
    setStilling(null);
    try {
      const res = await apiRequest(
        `/api/nextrole/arbeidsplassen/fetch?url=${encodeURIComponent(url.trim())}`,
        { headers: { 'x-user-id': user?.id || '' } },
      );
      setStilling(res.stilling);
      trackGA4('nextrole_arbeidsplassen_fetched', { uuid: res.stilling.uuid });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        setError('Stillingen finnes ikke lenger på arbeidsplassen.no.');
      } else if (status === 400) {
        setError('Ugyldig URL. Lim inn en lenke fra arbeidsplassen.no.');
      } else {
        setError('Kunne ikke hente stillingen. Prøv igjen.');
      }
    } finally {
      setFetching(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!stilling) throw new Error('no_stilling');
      // 1) Opprett jobbsøknad
      const app = (await apiRequest('/api/job-applications', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: stilling.jobTitle,
          company: stilling.company ?? 'Ukjent',
          location: stilling.location ?? null,
          jobUrl: stilling.applicationUrl,
          source: 'nav.no',
          status: 'saved',
          priority: 'medium',
          notes: stilling.description ?? null,
          tags: stilling.categories.slice(0, 5),
        }),
      })) as { id: string };

      // 2) Opprett deadline-milepæl hvis brukeren ønsker det
      if (createDeadline && stilling.applicationDeadline) {
        try {
          await apiRequest(`/api/job-applications/${app.id}/milestones`, {
            method: 'POST',
            headers: {
              'x-user-id': user?.id || '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              kind: 'application_deadline',
              title: `Søknadsfrist for ${stilling.jobTitle}`,
              dueAt: stilling.applicationDeadline,
            }),
          });
        } catch (err) {
          console.warn('Deadline-milestone kunne ikke opprettes', err);
        }
      }

      return app;
    },
    onSuccess: (app) => {
      queryClient.invalidateQueries({ queryKey: ['job-applications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['job-milestones-upcoming', user?.id] });
      setDone(true);
      trackGA4('nextrole_arbeidsplassen_imported', {
        application_id: app.id,
        with_deadline: createDeadline && !!stilling?.applicationDeadline,
      });
      onImported?.(app.id);
    },
  });

  const reset = () => {
    setUrl('');
    setStilling(null);
    setError(null);
    setDone(false);
  };

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose(); }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            component="img"
            src="https://arbeidsplassen.nav.no/static/favicon.ico"
            alt=""
            sx={{ width: 22, height: 22 }}
            onError={(e: any) => { e.target.style.display = 'none'; }}
          />
          <Typography variant="h6">Importer fra arbeidsplassen.no</Typography>
        </Stack>
        <IconButton onClick={() => { reset(); onClose(); }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {done ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CheckIcon sx={{ fontSize: 56, color: '#10B981' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Importert til Kanban
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Stillingen ligger nå i "Lagret"-kolonnen i Mine søknader.
              {createDeadline && stilling?.applicationDeadline && ' Søknadsfristen er lagt til som milepæl.'}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="info">
              Lim inn URL fra arbeidsplassen.no (NAV) eller stillings-ID — så henter vi
              tittel, beskrivelse og søknadsfrist automatisk.
            </Alert>

            <Stack direction="row" spacing={1}>
              <TextField
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
                size="small"
                placeholder="https://arbeidsplassen.nav.no/stillinger/stilling/..."
                InputProps={{ startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />
              <Button
                variant="outlined"
                onClick={handleFetch}
                disabled={fetching || !url.trim()}
                startIcon={fetching ? <CircularProgress size={16} /> : null}
              >
                {fetching ? 'Henter…' : 'Hent'}
              </Button>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            {stilling && (
              <>
                <Divider />
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#FAFAFA' }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <WorkIcon sx={{ color: '#F5B82E', mt: 0.3 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {stilling.jobTitle}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stilling.company ?? 'Ukjent arbeidsgiver'}
                        {stilling.location && ` · ${stilling.location}`}
                      </Typography>

                      {stilling.applicationDeadline && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                          <DeadlineIcon sx={{ fontSize: 16, color: '#DC2626' }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#DC2626' }}>
                            Søknadsfrist:{' '}
                            {new Date(stilling.applicationDeadline).toLocaleDateString('no-NO', {
                              day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </Typography>
                        </Stack>
                      )}

                      {stilling.categories.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                          {stilling.categories.slice(0, 5).map((c) => (
                            <Chip key={c} label={c} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                          ))}
                        </Stack>
                      )}

                      {stilling.description && (
                        <Box
                          sx={{
                            mt: 1.5,
                            maxHeight: 140, overflowY: 'auto',
                            border: '1px solid', borderColor: 'divider',
                            borderRadius: 1, p: 1,
                            fontSize: 12, color: 'text.secondary',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {stilling.description.slice(0, 1200)}
                          {stilling.description.length > 1200 && '…'}
                        </Box>
                      )}
                    </Box>
                  </Stack>
                </Paper>

                {stilling.applicationDeadline && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={createDeadline}
                        onChange={(e) => setCreateDeadline(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Opprett milepæl for søknadsfristen automatisk
                      </Typography>
                    }
                  />
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>
          {done ? 'Lukk' : 'Avbryt'}
        </Button>
        {stilling && !done && (
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            startIcon={createMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
            sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
          >
            {createMutation.isPending ? 'Lagrer…' : 'Legg til som jobbsøknad'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ArbeidsplassenImportDialog;
