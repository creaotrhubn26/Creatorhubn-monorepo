/**
 * TalentSignupPage.tsx
 *
 * Åpen selvregistrering for skuespillere. Uten denne finnes ingen vei inn:
 * invite-requests krever organisasjonsnummer, og både byrå-forslag og
 * skole-claim krever en konto som ikke kunne opprettes.
 *
 * URL: /talents/registrer?retur=<relativ sti>
 *
 * To steg i samme skjema: e-post → kode sendt → kode + navn + passord.
 * Ved suksess lagres sesjonen og brukeren sendes til retur-adressen (satt av
 * byrå-forslag og skole-claim), ellers til /talents.
 */

import {
  Alert,
  Box,
  Button,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShieldIcon from '@mui/icons-material/Shield';
import { useCallback, useMemo, useState } from 'react';

import authSessionService from '../../services/authSessionService';
import { palette, radius } from '../theme';

/** GDPR art. 13: hva profilen er, og at ingen ser den før talenten deler den.
 *  Samme informasjon som ROLE_ROOM_TALENTS_INFO gir i skole-pipelinen. */
const INFO_POINTS = [
  'Profilen din er et utkast som er USYNLIG for byråer og casting til du selv gir samtykke — per byrå.',
  'Du styrer nøyaktig hva som deles: basis-profil, media, kontaktinfo, demografi eller tilgjengelighet.',
  'Du kan trekke et samtykke, eller slette profilen, når som helst.',
];

const ERROR_TEXT: Record<string, string> = {
  invalid_email: 'Skriv inn en gyldig e-postadresse.',
  too_many_requests: 'For mange forsøk. Vent litt og prøv igjen.',
  captcha_failed: 'Vi klarte ikke å bekrefte at du er et menneske. Last siden på nytt.',
  invalid_code: 'Koden er feil eller utløpt. Be om en ny.',
  weak_password: 'Passordet må være minst 8 tegn.',
  missing_name: 'Skriv inn navnet ditt.',
  account_exists: 'Det finnes allerede en konto på denne e-posten. Logg inn i stedet.',
  email_not_configured: 'E-postutsending er ikke satt opp. Kontakt support@theroleroom.com.',
  email_send_failed: 'Vi klarte ikke å sende koden akkurat nå. Prøv igjen om et par minutter.',
  code_send_failed: 'Vi klarte ikke å sende koden. Prøv igjen.',
  signup_failed: 'Registreringen kunne ikke fullføres. Prøv igjen.',
};

/** Retur-adressen kommer fra URL-en og må aldri kunne peke ut av appen. */
function safeReturnPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: palette.textPrimary,
    bgcolor: palette.bgCardElevated,
    '& fieldset': { borderColor: palette.border },
    '&:hover fieldset': { borderColor: palette.borderStrong },
  },
  '& .MuiInputLabel-root': { color: palette.textMuted },
};

export default function TalentSignupPage() {
  const returnPath = useMemo(
    () => safeReturnPath(new URLSearchParams(window.location.search).get('retur')),
    [],
  );

  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const showError = useCallback((payload: unknown, fallback: string) => {
    const key = typeof payload === 'string' ? payload : '';
    setError(ERROR_TEXT[key] ?? fallback);
  }, []);

  const requestCode = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/role-room/talents/signup/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        showError(payload?.error, 'Vi klarte ikke å sende koden. Prøv igjen.');
        return;
      }
      setStep('verify');
    } catch {
      setError('Nettverksfeil. Sjekk tilkoblingen og prøv igjen.');
    } finally {
      setBusy(false);
    }
  }, [email, showError]);

  const submitSignup = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/role-room/talents/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        showError(payload?.error, 'Registreringen kunne ikke fullføres. Prøv igjen.');
        return;
      }

      await authSessionService.applyRoleRoomLogin(
        {
          id: payload.user.id,
          email: payload.user.email,
          role: payload.user.role,
          display_name: payload.user.display_name,
          name: payload.user.name,
        },
        payload.sessionToken,
      );
      setDone(true);
      window.setTimeout(() => {
        window.location.href = returnPath ?? '/talents';
      }, 1200);
    } catch {
      setError('Nettverksfeil. Sjekk tilkoblingen og prøv igjen.');
    } finally {
      setBusy(false);
    }
  }, [code, displayName, email, password, returnPath, showError]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: palette.bgRoot,
        p: 3,
      }}
    >
      <Box
        sx={{
          maxWidth: 520,
          width: '100%',
          bgcolor: palette.bgCard,
          border: `1px solid ${palette.border}`,
          borderRadius: radius.lg,
          p: 4,
        }}
      >
        {done ? (
          <Stack spacing={2} alignItems="center">
            <CheckCircleIcon sx={{ color: palette.success, fontSize: 56 }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.3rem' }}>
              Kontoen din er opprettet
            </Typography>
            <Typography sx={{ color: palette.textSecondary, textAlign: 'center' }}>
              {returnPath
                ? 'Tar deg tilbake for å fullføre…'
                : 'Tar deg til profilen din…'}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2.6}>
            <Box>
              <Typography
                sx={{
                  color: palette.accentBright,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  mb: 1,
                }}
              >
                The Role Room Talents
              </Typography>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.5rem' }}>
                Opprett skuespillerprofil
              </Typography>
              <Typography sx={{ color: palette.textSecondary, mt: 1, lineHeight: 1.6 }}>
                Gratis for skuespillere. Du trenger ikke organisasjonsnummer eller å bli invitert.
              </Typography>
            </Box>

            <Box
              sx={{
                bgcolor: palette.bgCardElevated,
                border: `1px solid ${palette.borderSubtle}`,
                borderRadius: radius.md,
                p: 2,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <ShieldIcon sx={{ color: palette.accentBright, fontSize: 18 }} />
                <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
                  Du bestemmer hvem som ser deg
                </Typography>
              </Stack>
              <Stack component="ul" spacing={0.6} sx={{ m: 0, pl: 2.4 }}>
                {INFO_POINTS.map((point) => (
                  <Typography
                    key={point}
                    component="li"
                    sx={{ color: palette.textSecondary, fontSize: '0.86rem', lineHeight: 1.55 }}
                  >
                    {point}
                  </Typography>
                ))}
              </Stack>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            {step === 'email' ? (
              <Stack spacing={2}>
                <TextField
                  label="E-post"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  fullWidth
                  sx={fieldSx}
                  autoComplete="email"
                />
                <Button
                  variant="contained"
                  disabled={busy || !email.trim()}
                  onClick={() => void requestCode()}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    background: palette.accentGradient,
                    py: 1.2,
                  }}
                >
                  {busy ? 'Sender kode…' : 'Send bekreftelseskode'}
                </Button>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                  Har du konto allerede?{' '}
                  <MuiLink href="/login" sx={{ color: palette.accentBright }}>
                    Logg inn
                  </MuiLink>
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.9rem' }}>
                  Vi har sendt en 6-sifret kode til {email.trim().toLowerCase()}. Koden er gyldig i
                  10 minutter.
                </Typography>
                <TextField
                  label="Bekreftelseskode"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  fullWidth
                  sx={fieldSx}
                  inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                  autoComplete="one-time-code"
                />
                <TextField
                  label="Navnet ditt"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  fullWidth
                  sx={fieldSx}
                  autoComplete="name"
                />
                <TextField
                  label="Passord (minst 8 tegn)"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  fullWidth
                  sx={fieldSx}
                  autoComplete="new-password"
                />
                <Button
                  variant="contained"
                  disabled={busy || !code.trim() || !displayName.trim() || password.length < 8}
                  onClick={() => void submitSignup()}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    background: palette.accentGradient,
                    py: 1.2,
                  }}
                >
                  {busy ? 'Oppretter konto…' : 'Opprett konto'}
                </Button>
                <Button
                  onClick={() => void requestCode()}
                  disabled={busy}
                  sx={{ textTransform: 'none', color: palette.accentBright, alignSelf: 'flex-start' }}
                >
                  Send koden på nytt
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
