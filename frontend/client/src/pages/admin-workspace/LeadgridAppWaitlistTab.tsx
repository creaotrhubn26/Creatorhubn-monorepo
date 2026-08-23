/**
 * LeadgridAppWaitlistTab — Markedsføring → App-venteliste.
 *
 * Leadgrid-appen (iOS) er i TestFlight, ikke live på App Store ennå.
 * leadgrid.no sin "Logg inn"-knapp åpner en venteliste-modal som samler
 * e-post i leadgrid_app_waitlist. Denne fanen viser antall
 * total/upvarslet, og lar deg trigge lanserings-utsendelsen én gang
 * appen faktisk er på App Store (backend: POST .../notify-launch,
 * admin-gated, idempotent — trygt å kjøre flere ganger).
 */
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Stack, TextField, Typography,
} from '@mui/material';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';

interface WaitlistStatus {
  total: number;
  pending: number;
}

interface NotifyResult {
  sent: number;
  failed: number;
  total: number;
}

export function LeadgridAppWaitlistTab() {
  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [appStoreUrl, setAppStoreUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<NotifyResult | null>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const r = await fetch('/api/leadgrid/app-waitlist/status');
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setStatusError(data.error === 'krever_admin' ? 'Krever admin-tilgang' : 'Kunne ikke hente status'); return; }
      setStatus({ total: data.total ?? 0, pending: data.pending ?? 0 });
    } catch (e: any) {
      setStatusError(String(e?.message ?? e));
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { void loadStatus(); }, []);

  const validUrl = /^https:\/\/apps\.apple\.com\//.test(appStoreUrl.trim());

  const sendLaunchEmails = async () => {
    if (!validUrl) return;
    if (!window.confirm(
      `Send "appen er live"-e-post til ${status?.pending ?? 'alle upvarslede'} personer på ventelisten?`,
    )) return;
    setSending(true);
    setSendError(null);
    setResult(null);
    try {
      const r = await fetch('/api/leadgrid/app-waitlist/notify-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appStoreUrl: appStoreUrl.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setSendError(data.error ?? 'Utsendelse feilet'); return; }
      setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0, total: data.total ?? 0 });
      void loadStatus();
    } catch (e: any) {
      setSendError(String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>App-venteliste</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Besøkende på leadgrid.no som klikker "Logg inn" (før appen er på App Store) legger igjen
        e-posten sin her i stedet. Trigg utsendelsen under når appen faktisk er live.
      </Typography>

      <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {loadingStatus ? <CircularProgress size={28} /> : (status?.total ?? '—')}
          </Typography>
          <Typography variant="caption" color="text.secondary">Totalt påmeldt</Typography>
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: status?.pending ? '#f59e0b' : undefined }}>
            {loadingStatus ? <CircularProgress size={28} /> : (status?.pending ?? '—')}
          </Typography>
          <Typography variant="caption" color="text.secondary">Ikke varslet ennå</Typography>
        </Box>
      </Stack>
      {statusError && <Alert severity="error" sx={{ mb: 2 }}>{statusError}</Alert>}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Lanser til ventelisten</Typography>
      <Stack spacing={1.5}>
        <TextField
          fullWidth size="small" label="App Store-lenke" value={appStoreUrl}
          onChange={(e) => setAppStoreUrl(e.target.value)}
          placeholder="https://apps.apple.com/no/app/leadgrid/id..."
          error={appStoreUrl.length > 0 && !validUrl}
          helperText={appStoreUrl.length > 0 && !validUrl ? 'Må være en apps.apple.com-lenke' : ' '}
        />
        {sendError && <Alert severity="error">{sendError}</Alert>}
        {result && (
          <Alert severity={result.failed > 0 ? 'warning' : 'success'}>
            Sendt til {result.sent} av {result.total} {result.failed > 0 && `(${result.failed} feilet)`}
          </Alert>
        )}
        <Button
          variant="contained" startIcon={<RocketLaunchOutlinedIcon />}
          disabled={!validUrl || sending || (status?.pending ?? 0) === 0}
          onClick={sendLaunchEmails}
          sx={{ alignSelf: 'flex-start' }}
        >
          {sending ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : `Send til ${status?.pending ?? 0} ventende`}
        </Button>
      </Stack>
    </Box>
  );
}

export default LeadgridAppWaitlistTab;
