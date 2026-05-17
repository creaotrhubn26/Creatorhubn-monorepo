/**
 * /reset-passord/:token — sett nytt passord via reset-token fra e-post.
 *
 * Flow:
 *   1. Bruker lander her fra "Tilbakestill passord"-e-post
 *   2. Vi verifiserer tokenet via GET — viser feilmelding hvis utløpt/brukt
 *   3. Form for nytt passord + bekreft
 *   4. POST setter passordet; success → vis bekreftelse + lenke til /login
 */

import { useEffect, useState } from 'react';
import { useParams, Link as WouterLink } from 'wouter';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Lock as LockIcon, CheckCircle as CheckIcon } from '@mui/icons-material';

type Stage = 'verifying' | 'form' | 'submitting' | 'success' | 'error';

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [stage, setStage] = useState<Stage>('verifying');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStage('error');
      setErrorMessage('Mangler reset-token i URL-en.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/auth/reset-password/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (response.ok) {
          const payload = await response.json() as { email: string };
          setEmail(payload.email);
          setStage('form');
          return;
        }
        const errPayload = await response.json().catch(() => null) as { error?: string } | null;
        const reason = errPayload?.error;
        setStage('error');
        setErrorMessage(
          reason === 'expired'
            ? 'Lenken er utløpt. Be om en ny tilbakestillings-lenke.'
            : reason === 'already_used'
              ? 'Denne lenken er allerede brukt. Be om en ny hvis du trenger å endre passord igjen.'
              : 'Lenken er ikke gyldig. Sjekk at du brukte hele lenken fra e-posten.',
        );
      } catch {
        if (cancelled) return;
        setStage('error');
        setErrorMessage('Nettverksfeil — sjekk tilkoblingen og prøv igjen.');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (): Promise<void> => {
    if (password.length < 8) {
      setErrorMessage('Passord må være minst 8 tegn.');
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage('Passordene er ikke like.');
      return;
    }
    setStage('submitting');
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/auth/reset-password/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        const payload = await response.json() as { message?: string };
        setSuccessMessage(payload.message ?? 'Passordet er oppdatert.');
        setStage('success');
        return;
      }
      const errPayload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
      setErrorMessage(errPayload?.message ?? 'Kunne ikke oppdatere passord. Prøv igjen.');
      setStage('form');
    } catch {
      setErrorMessage('Nettverksfeil — prøv igjen.');
      setStage('form');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b1220', color: '#e2e8f0', display: 'grid', placeItems: 'center', p: 3 }}>
      <Container maxWidth="sm">
        <Box
          sx={{
            p: 4,
            borderRadius: 3,
            bgcolor: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(148,163,184,0.2)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2.4 }}>
            <LockIcon sx={{ color: '#22d3ee', fontSize: 28 }} />
            <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 800 }}>
              Tilbakestill passord
            </Typography>
          </Stack>

          {stage === 'verifying' ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={32} sx={{ color: '#22d3ee' }} />
              <Typography sx={{ mt: 1.4, color: 'rgba(226,232,240,0.65)' }}>
                Sjekker lenken …
              </Typography>
            </Stack>
          ) : null}

          {stage === 'error' ? (
            <>
              <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239,68,68,0.1)' }}>
                {errorMessage}
              </Alert>
              <Button
                component={WouterLink}
                href="/login"
                fullWidth
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: '#22d3ee',
                  color: '#0b1226',
                  '&:hover': { bgcolor: '#06b6d4' },
                }}
              >
                Tilbake til innlogging
              </Button>
            </>
          ) : null}

          {(stage === 'form' || stage === 'submitting') ? (
            <Stack spacing={2}>
              <Typography sx={{ color: 'rgba(226,232,240,0.72)' }}>
                Sett nytt passord for <strong>{email}</strong>.
              </Typography>
              <TextField
                label="Nytt passord (min. 8 tegn)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                fullWidth
                sx={textFieldSx}
              />
              <TextField
                label="Bekreft passord"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                fullWidth
                sx={textFieldSx}
              />
              {errorMessage ? (
                <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.1)' }}>
                  {errorMessage}
                </Alert>
              ) : null}
              <Button
                onClick={() => void handleSubmit()}
                disabled={stage === 'submitting' || !password || !passwordConfirm}
                variant="contained"
                fullWidth
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1.2,
                  bgcolor: '#22d3ee',
                  color: '#0b1226',
                  '&:hover': { bgcolor: '#06b6d4' },
                }}
              >
                {stage === 'submitting' ? 'Oppdaterer …' : 'Sett nytt passord'}
              </Button>
            </Stack>
          ) : null}

          {stage === 'success' ? (
            <Stack spacing={2.2} alignItems="center">
              <CheckIcon sx={{ color: '#34d399', fontSize: 56 }} />
              <Typography sx={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center' }}>
                Passordet er oppdatert
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.72)', textAlign: 'center' }}>
                {successMessage}
              </Typography>
              <Button
                component={WouterLink}
                href="/login"
                fullWidth
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: '#22d3ee',
                  color: '#0b1226',
                  '&:hover': { bgcolor: '#06b6d4' },
                }}
              >
                Logg inn
              </Button>
            </Stack>
          ) : null}
        </Box>
      </Container>
    </Box>
  );
}

const textFieldSx = {
  '& .MuiInputBase-input': { color: '#f8fafc' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
} as const;
