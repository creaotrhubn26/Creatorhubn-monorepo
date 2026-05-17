/**
 * ClientPortalRegisterCard — "Opprett bruker"-banner i toppen av
 * klient-portalen.
 *
 * Magic-link funker fint én gang, men er friksjon andre gang (klienten
 * må finne e-posten på nytt). Denne kortet lar dem sette et passord →
 * deretter kan de logge inn på vanlig /login med samme e-post.
 *
 * Vi sjekker først om e-posten allerede er registrert (har password
 * satt i users-tabellen). Hvis ja: viser bekreftelse + "Logg inn"-CTA.
 * Hvis nei: viser banner med "Opprett bruker"-knapp som ekspanderer
 * passord-form.
 */

import React, { useCallback, useEffect, useState } from 'react';
import authSessionService from '@/components/role-room/services/authSessionService';
import TwoFactorSetup from '@/components/TwoFactorSetup';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Lock as LockIcon,
  Login as LoginIcon,
} from '@mui/icons-material';

export interface ClientPortalRegisterCardProps {
  token: string;
}

const ClientPortalRegisterCard: React.FC<ClientPortalRegisterCardProps> = ({ token }) => {
  const [status, setStatus] = useState<'loading' | 'unregistered' | 'registered' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Email-code-bekreftelse — krever at klient bekrefter epost FØR passord-form
  const [codeStage, setCodeStage] = useState<'idle' | 'sending' | 'awaiting_input' | 'verifying' | 'verified'>('idle');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeMessage, setCodeMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/client/portal/register/status?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
          if (!cancelled) setStatus('error');
          return;
        }
        const payload = await response.json() as { email: string; isRegistered: boolean };
        if (!cancelled) {
          setEmail(payload.email);
          setStatus(payload.isRegistered ? 'registered' : 'unregistered');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSendCode = useCallback(async (): Promise<void> => {
    setCodeMessage(null);
    setCodeStage('sending');
    try {
      const response = await fetch('/api/auth/email-code/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'client_portal_register' }),
      });
      const payload = await response.json().catch(() => null) as { devCode?: string; reason?: string } | null;
      if (!response.ok) {
        setCodeStage('idle');
        setCodeMessage('Kunne ikke sende koden. Prøv igjen om litt.');
        return;
      }
      setCodeStage('awaiting_input');
      // I dev-mode (uten SMTP) eksponerer backend devCode — vis den i UI så
      // utvikleren kan teste flowen lokalt uten Gmail SMTP. Aldri i prod.
      if (payload?.devCode) {
        setCodeMessage(`Dev-mode: koden er ${payload.devCode} (SMTP ikke konfigurert)`);
      } else {
        setCodeMessage(`Vi sendte en 6-sifret kode til ${email}. Sjekk innboksen (og spam).`);
      }
    } catch {
      setCodeStage('idle');
      setCodeMessage('Nettverksfeil — prøv igjen.');
    }
  }, [email]);

  const handleVerifyCode = useCallback(async (): Promise<void> => {
    if (verificationCode.length !== 6) {
      setCodeMessage('Koden må være 6 sifre.');
      return;
    }
    setCodeStage('verifying');
    try {
      const response = await fetch('/api/auth/email-code/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'client_portal_register', code: verificationCode }),
      });
      if (response.ok) {
        setCodeStage('verified');
        setCodeMessage(null);
        return;
      }
      const errPayload = await response.json().catch(() => null) as { error?: string; attemptsRemaining?: number } | null;
      setCodeStage('awaiting_input');
      const reason = errPayload?.error;
      if (reason === 'wrong_code') {
        setCodeMessage(`Feil kode. ${errPayload?.attemptsRemaining ?? 0} forsøk igjen.`);
      } else if (reason === 'max_attempts') {
        setCodeMessage('For mange feil forsøk. Be om en ny kode.');
        setCodeStage('idle');
      } else if (reason === 'expired') {
        setCodeMessage('Koden er utløpt. Be om en ny.');
        setCodeStage('idle');
      } else {
        setCodeMessage('Kunne ikke verifisere koden.');
      }
    } catch {
      setCodeStage('awaiting_input');
      setCodeMessage('Nettverksfeil — prøv igjen.');
    }
  }, [email, verificationCode]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setFormError(null);
    if (password.length < 8) {
      setFormError('Passord må være minst 8 tegn.');
      return;
    }
    if (password !== passwordConfirm) {
      setFormError('Passordene er ikke like.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/client/portal/register?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, fullName: fullName.trim() }),
      });
      if (!response.ok) {
        const errPayload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        setFormError(errPayload?.message ?? errPayload?.error ?? 'Registrering feilet.');
        return;
      }
      const payload = await response.json() as {
        message: string;
        sessionToken?: string;
        user?: { id: number | string; email: string; name: string; role: string; display_name: string };
      };
      // Lagre regular auth-session så klienten kan bruke /api/2fa/* og
      // andre innloggede endpoints uten å måtte logge ut + inn igjen.
      if (payload.sessionToken && payload.user) {
        await authSessionService.setSessionToken(payload.sessionToken);
        await authSessionService.setAdminUser({
          ...payload.user,
          requestedRole: 'user',
        } as any);
        await authSessionService.setCurrentUserId(String(payload.user.id));
      }
      setSuccessMessage(payload.message ?? 'Brukeren er opprettet.');
      setStatus('registered');
      setExpanded(false);
      setPassword('');
      setPasswordConfirm('');
    } finally {
      setSubmitting(false);
    }
  }, [token, password, passwordConfirm, fullName]);

  // 2FA-aktivering for klient — kun synlig etter at bruker er registrert
  // og har en regular session-token (slik at /api/2fa/* fungerer).
  const [show2faSetup, setShow2faSetup] = useState(false);

  if (status === 'loading' || status === 'error') return null;

  if (status === 'registered') {
    return (
      <Box
        sx={{
          p: 1.6,
          borderRadius: 1.5,
          bgcolor: 'rgba(52,211,153,0.08)',
          border: '1px solid rgba(52,211,153,0.25)',
        }}
      >
        <Stack direction="row" spacing={1.4} alignItems="center" flexWrap="wrap" useFlexGap>
          <CheckIcon sx={{ color: '#34d399' }} />
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography sx={{ color: '#f0fdf4', fontSize: '0.92rem', fontWeight: 700 }}>
              Du har en brukerkonto registrert
            </Typography>
            <Typography sx={{ color: 'rgba(220,252,231,0.75)', fontSize: '0.78rem' }}>
              Neste gang kan du logge inn på vanlig måte med <strong>{email}</strong> + passord.
            </Typography>
          </Box>
          <Button
            href="/login"
            startIcon={<LoginIcon />}
            sx={{
              textTransform: 'none',
              color: '#34d399',
              borderColor: 'rgba(52,211,153,0.4)',
              border: '1px solid',
              '&:hover': { bgcolor: 'rgba(52,211,153,0.1)' },
            }}
          >
            Logg inn-side
          </Button>
        </Stack>
        {successMessage ? (
          <Alert severity="success" sx={{ mt: 1.2, bgcolor: 'rgba(52,211,153,0.1)' }}>
            {successMessage}
          </Alert>
        ) : null}

        {/* 2FA-aktivering — kun synlig hvis bruker har session-token nå
            (dvs. nettopp registrert eller har klikket "Aktiver 2FA" i
            denne sesjonen). Klient kan slå på Authenticator-app-2FA
            på samme måte som markedsfører. */}
        {!show2faSetup ? (
          <Box sx={{ mt: 1.6, pt: 1.4, borderTop: '1px solid rgba(52,211,153,0.18)' }}>
            <Stack direction="row" spacing={1.4} alignItems="center" flexWrap="wrap" useFlexGap>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#f0fdf4', mb: 0.2 }}>
                  Vil du gjøre kontoen ekstra sikker?
                </Typography>
                <Typography sx={{ fontSize: '0.76rem', color: 'rgba(220,252,231,0.7)' }}>
                  Med to-faktor (Authenticator-app) må du gi en 6-sifret kode hver gang du logger inn.
                </Typography>
              </Box>
              <Button
                onClick={() => setShow2faSetup(true)}
                size="small"
                variant="outlined"
                sx={{
                  textTransform: 'none',
                  color: '#34d399',
                  borderColor: 'rgba(52,211,153,0.4)',
                  '&:hover': { borderColor: '#34d399', bgcolor: 'rgba(52,211,153,0.08)' },
                }}
              >
                Aktiver 2FA
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ mt: 1.6, pt: 1.4, borderTop: '1px solid rgba(52,211,153,0.18)' }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.2)',
                // TwoFactorSetup-komponenten er bygget for å vises i et
                // light-bakground-card; vi overstyrer noen farger for
                // mørk klient-portal-tema.
                '& .MuiTypography-root': { color: '#f8fafc' },
                '& .MuiAlert-message': { color: '#f8fafc' },
              }}
            >
              <TwoFactorSetup
                userEmail={email}
                onSetupComplete={(ok) => { if (ok) setShow2faSetup(false); }}
              />
              <Button
                onClick={() => setShow2faSetup(false)}
                size="small"
                sx={{ mt: 1.4, textTransform: 'none', color: '#94a3b8' }}
              >
                Lukk
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.8,
        borderRadius: 1.5,
        bgcolor: 'rgba(34,211,238,0.06)',
        border: '1px solid rgba(34,211,238,0.25)',
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="center" flexWrap="wrap" useFlexGap>
        <LockIcon sx={{ color: '#22d3ee' }} />
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ color: '#f8fafc', fontSize: '0.92rem', fontWeight: 700 }}>
            Slipp magic-link neste gang — opprett en bruker
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.8rem' }}>
            Sett et passord for <strong>{email}</strong>, så kan du logge inn på vanlig måte
            uten å finne e-post-lenken på nytt.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => setExpanded((v) => !v)}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#22d3ee',
            color: '#0b1226',
            '&:hover': { bgcolor: '#06b6d4' },
          }}
        >
          {expanded ? 'Skjul' : 'Opprett bruker'}
        </Button>
      </Stack>

      <Collapse in={expanded} timeout="auto">
        <Stack spacing={1.4} sx={{ mt: 1.6 }}>
          {/* Steg 1: bekreft epost med kode */}
          {codeStage !== 'verified' ? (
            <Box
              sx={{
                p: 1.4,
                borderRadius: 1.5,
                bgcolor: 'rgba(96,165,250,0.06)',
                border: '1px solid rgba(96,165,250,0.2)',
              }}
            >
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa', mb: 0.6 }}>
                Steg 1 av 2 — Bekreft e-posten din
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.7)', mb: 1.2 }}>
                Vi sender en 6-sifret kode til {email} så vi vet at det er deg som registrerer brukeren.
              </Typography>
              {codeStage === 'idle' ? (
                <Button
                  onClick={() => void handleSendCode()}
                  variant="outlined"
                  size="small"
                  sx={{
                    textTransform: 'none',
                    color: '#60a5fa',
                    borderColor: 'rgba(96,165,250,0.5)',
                    '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(96,165,250,0.08)' },
                  }}
                >
                  Send bekreftelseskode
                </Button>
              ) : codeStage === 'sending' ? (
                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.6)' }}>
                  Sender …
                </Typography>
              ) : (
                <Stack spacing={1}>
                  <TextField
                    label="6-sifret kode"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: '6px', fontSize: '1.1rem', textAlign: 'center', fontFamily: 'monospace' } }}
                    fullWidth
                    size="small"
                    autoFocus
                    sx={textFieldSx}
                  />
                  <Stack direction="row" spacing={1} justifyContent="space-between">
                    <Button
                      size="small"
                      onClick={() => void handleSendCode()}
                      sx={{ textTransform: 'none', color: '#94a3b8' }}
                    >
                      Send ny kode
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void handleVerifyCode()}
                      disabled={codeStage === 'verifying' || verificationCode.length !== 6}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        bgcolor: '#22d3ee',
                        color: '#0b1226',
                        '&:hover': { bgcolor: '#06b6d4' },
                      }}
                    >
                      {codeStage === 'verifying' ? 'Sjekker …' : 'Verifiser'}
                    </Button>
                  </Stack>
                </Stack>
              )}
              {codeMessage ? (
                <Typography sx={{ mt: 1, fontSize: '0.78rem', color: codeMessage.startsWith('Feil') || codeMessage.includes('utløpt') ? '#f87171' : 'rgba(226,232,240,0.6)' }}>
                  {codeMessage}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 700 }}>
                ✓ E-posten din er bekreftet
              </Typography>
            </Box>
          )}

          {/* Steg 2: sett passord — vises kun når kode er verifisert */}
          {codeStage === 'verified' ? (
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#22d3ee', mt: 0.4 }}>
              Steg 2 av 2 — Sett passord
            </Typography>
          ) : null}
          <TextField
            label="Navn (valgfri)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            fullWidth
            size="small"
            placeholder="Fullt navn"
            disabled={codeStage !== 'verified'}
            sx={textFieldSx}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <TextField
              label="Passord (min. 8 tegn)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              size="small"
              autoComplete="new-password"
              disabled={codeStage !== 'verified'}
              sx={textFieldSx}
            />
            <TextField
              label="Bekreft passord"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              fullWidth
              size="small"
              autoComplete="new-password"
              disabled={codeStage !== 'verified'}
              sx={textFieldSx}
            />
          </Stack>
          {formError ? (
            <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.1)' }}>
              {formError}
            </Alert>
          ) : null}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button
              onClick={() => { setExpanded(false); setFormError(null); }}
              sx={{ textTransform: 'none', color: '#94a3b8' }}
            >
              Avbryt
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting || codeStage !== 'verified' || !password || !passwordConfirm}
              variant="contained"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#22d3ee',
                color: '#0b1226',
                '&:hover': { bgcolor: '#06b6d4' },
              }}
            >
              {submitting ? 'Oppretter…' : 'Opprett bruker'}
            </Button>
          </Stack>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.5)' }}>
            E-posten din ({email}) er låst og kan ikke endres her — den er knyttet til invitasjonen
            fra produsenten.
          </Typography>
        </Stack>
      </Collapse>
    </Box>
  );
};

const textFieldSx = {
  '& .MuiInputBase-input': { color: '#f8fafc' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
} as const;

export default ClientPortalRegisterCard;
