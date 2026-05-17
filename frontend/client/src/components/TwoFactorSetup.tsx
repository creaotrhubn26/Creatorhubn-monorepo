/**
 * TwoFactorSetup — aktiverer TOTP-basert 2FA for innlogget bruker.
 *
 * Krever at `Authorization: Bearer <session-token>` sendes med — vi
 * leser fra `authSessionService` for å hente det automatisk.
 *
 * Stages:
 *   loading    — henter status (er 2FA allerede aktivert?)
 *   off        — viser "Aktiver 2FA"-CTA
 *   enrolling  — viser QR-kode + form for første kode
 *   verifying  — sjekker første kode
 *   enabled    — viser backup-koder ÉN gang
 *   active     — 2FA er på, viser "Slå av" + backup-codes-status
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Shield as ShieldIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import authSessionService from '@/components/role-room/services/authSessionService';

type Stage = 'loading' | 'off' | 'enrolling' | 'verifying' | 'enabled' | 'active';

interface TwoFactorSetupProps {
  userEmail?: string;
  onSetupComplete?: (success: boolean) => void;
}

export default function TwoFactorSetup({ onSetupComplete }: TwoFactorSetupProps) {
  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState<number>(0);

  const authHeaders = useCallback((): HeadersInit => {
    const token = authSessionService.getSessionTokenSync();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, []);

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/2fa/status', { headers: authHeaders() });
      if (response.status === 401) {
        setStage('off');
        setError('Du må være logget inn for å konfigurere 2FA.');
        return;
      }
      if (!response.ok) {
        setStage('off');
        setError('Kunne ikke hente 2FA-status.');
        return;
      }
      const payload = await response.json() as { enabled: boolean; pending: boolean; backupCodesRemaining: number };
      setBackupCodesRemaining(payload.backupCodesRemaining ?? 0);
      setStage(payload.enabled ? 'active' : 'off');
      setError(null);
    } catch {
      setStage('off');
      setError('Nettverksfeil.');
    }
  }, [authHeaders]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  const startEnroll = useCallback(async (): Promise<void> => {
    setError(null);
    setStage('enrolling');
    try {
      const response = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        setError(payload?.message ?? 'Kunne ikke starte 2FA-oppsett.');
        setStage('off');
        return;
      }
      const payload = await response.json() as { secret: string; otpauthUrl: string; qrPngDataUrl: string };
      setQrPngDataUrl(payload.qrPngDataUrl);
      setSecret(payload.secret);
      setCode('');
    } catch {
      setError('Nettverksfeil.');
      setStage('off');
    }
  }, [authHeaders]);

  const verifyAndEnable = useCallback(async (): Promise<void> => {
    if (code.length !== 6) {
      setError('Koden må være 6 sifre.');
      return;
    }
    setStage('verifying');
    setError(null);
    try {
      const response = await fetch('/api/2fa/verify-and-enable', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: code }),
      });
      if (!response.ok) {
        setError('Feil kode. Sjekk Authenticator-appen og prøv igjen.');
        setStage('enrolling');
        return;
      }
      const payload = await response.json() as { backupCodes: string[]; message?: string };
      setBackupCodes(payload.backupCodes);
      setStage('enabled');
      onSetupComplete?.(true);
    } catch {
      setError('Nettverksfeil.');
      setStage('enrolling');
    }
  }, [code, authHeaders, onSetupComplete]);

  const disable = useCallback(async (): Promise<void> => {
    if (!window.confirm('Slå av 2FA? Du kan aktivere på nytt senere.')) return;
    try {
      const response = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (response.ok) {
        setStage('off');
        setBackupCodes(null);
        setSecret(null);
        setQrPngDataUrl(null);
        await refreshStatus();
      } else {
        setError('Kunne ikke slå av 2FA.');
      }
    } catch {
      setError('Nettverksfeil.');
    }
  }, [authHeaders, refreshStatus]);

  if (stage === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180 }}>
        <CircularProgress size={28} />
        <Typography sx={{ ml: 2, color: 'text.secondary' }}>Laster 2FA-status…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2 }}>
        <ShieldIcon sx={{ color: '#22d3ee' }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          To-faktor-autentisering (TOTP)
        </Typography>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {stage === 'off' ? (
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            Legg et ekstra lag med sikkerhet på kontoen: en 6-sifret kode fra Google Authenticator,
            1Password eller Authy som genereres hvert 30. sekund.
          </Typography>
          <Button onClick={() => void startEnroll()} variant="contained" sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}>
            Aktiver 2FA
          </Button>
        </Stack>
      ) : null}

      {(stage === 'enrolling' || stage === 'verifying') && qrPngDataUrl ? (
        <Stack spacing={2}>
          <Typography sx={{ fontWeight: 600 }}>1. Scan QR-koden med Authenticator-appen din</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#fff', borderRadius: 1, alignSelf: 'flex-start' }}>
            <Box component="img" src={qrPngDataUrl} alt="QR-kode for TOTP" sx={{ width: 220, height: 220 }} />
          </Box>
          {secret ? (
            <Box>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 0.4 }}>
                Eller skriv inn nøkkelen manuelt:
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box component="code" sx={{ p: 0.8, bgcolor: 'rgba(148,163,184,0.12)', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.84rem', wordBreak: 'break-all' }}>
                  {secret}
                </Box>
                <Button
                  size="small"
                  startIcon={<CopyIcon />}
                  onClick={() => navigator.clipboard?.writeText(secret)}
                  sx={{ textTransform: 'none' }}
                >
                  Kopier
                </Button>
              </Stack>
            </Box>
          ) : null}
          <Typography sx={{ fontWeight: 600, mt: 1 }}>2. Skriv inn den 6-sifrede koden fra appen</Typography>
          <TextField
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: '8px', fontSize: '1.4rem', textAlign: 'center', fontFamily: 'monospace' } }}
            placeholder="123456"
            autoFocus
            sx={{ alignSelf: 'flex-start', width: 220 }}
          />
          <Button
            onClick={() => void verifyAndEnable()}
            disabled={stage === 'verifying' || code.length !== 6}
            variant="contained"
            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
          >
            {stage === 'verifying' ? 'Verifiserer…' : 'Verifiser og aktiver'}
          </Button>
        </Stack>
      ) : null}

      {stage === 'enabled' && backupCodes ? (
        <Stack spacing={2}>
          <Alert severity="success" icon={<CheckIcon />}>
            <strong>2FA er aktivert.</strong> Lagre backup-kodene under et trygt sted — de vises kun denne ene gangen.
          </Alert>
          <Box sx={{ p: 2, bgcolor: 'rgba(148,163,184,0.08)', borderRadius: 1 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.2 }}>
              Backup-koder ({backupCodes.length})
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 1.4 }}>
              Hver kode kan brukes ÉN gang hvis du mister telefonen. Skriv ut eller lagre i en passord-manager.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.8 }}>
              {backupCodes.map((bc) => (
                <Box key={bc} component="code" sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 0.6, fontFamily: 'monospace', fontSize: '0.95rem', textAlign: 'center', letterSpacing: '2px' }}>
                  {bc}
                </Box>
              ))}
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 1.6 }}>
              <Button
                startIcon={<CopyIcon />}
                size="small"
                onClick={() => navigator.clipboard?.writeText(backupCodes.join('\n'))}
                sx={{ textTransform: 'none' }}
              >
                Kopier alle
              </Button>
              <Button
                size="small"
                onClick={() => { setStage('active'); setBackupCodes(null); void refreshStatus(); }}
                sx={{ textTransform: 'none' }}
                variant="contained"
              >
                Jeg har lagret kodene
              </Button>
            </Stack>
          </Box>
        </Stack>
      ) : null}

      {stage === 'active' ? (
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <CheckIcon sx={{ color: '#34d399' }} />
            <Typography sx={{ fontWeight: 700, color: 'success.main' }}>
              2FA er aktivert
            </Typography>
            <Chip
              label={`${backupCodesRemaining} backup-koder igjen`}
              size="small"
              color={backupCodesRemaining < 3 ? 'warning' : 'default'}
            />
          </Stack>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.88rem' }}>
            Du må gi en 6-sifret kode fra Authenticator-appen hver gang du logger inn.
          </Typography>
          {backupCodesRemaining < 3 ? (
            <Alert severity="warning">
              Du har få backup-koder igjen. Vurder å slå av 2FA og aktivere på nytt for å generere nye koder.
            </Alert>
          ) : null}
          <Button onClick={() => void disable()} color="error" variant="outlined" sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
            Slå av 2FA
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
