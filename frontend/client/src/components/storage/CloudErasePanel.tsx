/**
 * CloudErasePanel — GDPR Art 17 right-to-erasure UI for cloud-destinasjoner.
 *
 * Lister storage-providers koblet til prosjektet (via dit_destinations'
 * cloud_provider_id) og lar bruker trigge full sletting fra B2-bucketen
 * for ett prosjekt. Sletting går via backend POST
 * /api/storage/providers/:id/erase-project (eksisterer fra Fase 3),
 * som itererer dit_backup_jobs og kaller b2_delete_file_version på
 * hver fil, deretter logger til gdpr_deletion_audit.
 *
 * Defensiv UX:
 *   1. Confirm-dialog med prosjekt-navn + provider-label
 *   2. Krever at bruker skriver inn prosjektnavnet for å bekrefte
 *   3. Viser progress + sluttsummary (deleted/failed/total + feil-liste)
 *   4. Audit-rad logges PR fil — synlig i admin gdpr-audit-view senere
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GavelIcon from '@mui/icons-material/Gavel';
import {
  EraseProjectResponse,
  eraseProjectFromProvider,
  listStorageProviders,
  StorageProvider,
} from '@/api/storageProviders';

interface Props {
  projectId: string;
  projectName: string;
}

export default function CloudErasePanel({ projectId, projectName }: Props) {
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [chosenProvider, setChosenProvider] = useState<StorageProvider | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [reason, setReason] = useState('user_request');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EraseProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listStorageProviders()
      .then((r) => {
        if (r.success) setProviders(r.providers);
      })
      .catch(() => {});
  }, []);

  const handleStartErase = (p: StorageProvider) => {
    setChosenProvider(p);
    setTypedName('');
    setReason('user_request');
    setResult(null);
    setError(null);
    setConfirmOpen(true);
  };

  const handleConfirmErase = async () => {
    if (!chosenProvider) return;
    setBusy(true);
    setError(null);
    try {
      const r = await eraseProjectFromProvider(chosenProvider.id, {
        project_id: projectId,
        reason: reason || 'user_request',
      });
      setResult(r);
      if (!r.success) {
        setError(r.error ?? 'Sletting feilet');
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setConfirmOpen(false);
    setChosenProvider(null);
    setResult(null);
    setError(null);
    setTypedName('');
  };

  const confirmEnabled =
    !busy && typedName.trim() === projectName.trim() && projectName.length > 0;

  if (providers.length === 0) {
    return null; // Skjul panelet hvis ingen providers er satt opp
  }

  return (
    <>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
            <GavelIcon color="error" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Right-to-erasure (GDPR Art. 17)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Slett alle filer for dette prosjektet fra en cloud-bucket.
                Brukes når klient ber om sletting. Hver sletting logges i
                gdpr_deletion_audit som bevis på samsvar.
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={1}>
            {providers.map((p) => (
              <Stack
                key={p.id}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1,
                  px: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {p.account_label}
                  </Typography>
                  <Chip
                    size="small"
                    label={p.provider.toUpperCase()}
                    variant="outlined"
                  />
                </Stack>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteForeverIcon />}
                  onClick={() => handleStartErase(p)}
                >
                  Slett alt fra denne
                </Button>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <WarningAmberIcon />
            <span>Permanent sletting</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {!result && (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Du er i ferd med å slette ALLE filer for prosjektet{' '}
                <strong>{projectName}</strong> fra{' '}
                <strong>«{chosenProvider?.account_label}»</strong> (Backblaze
                B2).
              </DialogContentText>
              <Alert severity="error" sx={{ mb: 2 }}>
                Denne handlingen kan IKKE angres. Backblaze tilbyr ikke
                versjons-recovery for permanent slettede filer over 1-7 dager,
                avhengig av bucket-konfigurasjon.
              </Alert>
              <TextField
                fullWidth
                size="small"
                label={`Skriv inn «${projectName}» for å bekrefte`}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                disabled={busy}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                size="small"
                label="Begrunnelse (logges i audit)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="user_request | art17_request | retention_expired"
                disabled={busy}
                helperText="Brukes for GDPR-samsvars-rapportering"
              />
            </>
          )}

          {result && (
            <Stack spacing={2}>
              <Alert severity={result.failed > 0 ? 'warning' : 'success'}>
                Slettet {result.deleted} av {result.total} filer
                {result.failed > 0 ? ` (${result.failed} feil)` : ''}.
              </Alert>
              {result.errors.length > 0 && (
                <Box
                  sx={{
                    p: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    maxHeight: 200,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                >
                  {result.errors.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary">
                Audit-rad logget i gdpr_deletion_audit-tabellen.
              </Typography>
            </Stack>
          )}

          {error && !result && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          {!result && (
            <>
              <Button onClick={handleClose} disabled={busy}>
                Avbryt
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleConfirmErase}
                disabled={!confirmEnabled}
                startIcon={
                  busy ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <DeleteForeverIcon />
                  )
                }
              >
                {busy ? 'Sletter…' : 'Slett permanent'}
              </Button>
            </>
          )}
          {result && (
            <Button variant="contained" onClick={handleClose}>
              Lukk
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
