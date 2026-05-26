import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography, Alert } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

/**
 * Gjenbrukbar newsletter-signup-blokk for Norwegian Casting Brief.
 * Brukes inline i landing-sider, content-artikler og rapporter.
 *
 * Bruker mock-submit til /api/newsletter/role-room — endepunkt skal
 * implementeres som proxy mot Beehiiv API når valgt provider er klar.
 */
export interface NewsletterSignupBlockProps {
  /** Overskrift over feltet — overrider default. */
  heading?: string;
  /** Forklaringstekst under heading. */
  body?: string;
  /** Etikett på CTA-knappen. */
  ctaLabel?: string;
  /** Hvor signups skal POSTes — default /api/newsletter/role-room. */
  endpoint?: string;
  /** Kompakt variant uten heading/body — for inline-bruk i flyt-tekst. */
  compact?: boolean;
  /** Hvor brukeren kom fra — sendes til backend for source-tracking. */
  source?: string;
}

const DEFAULT_HEADING = 'Få Norwegian Casting Brief hver fredag';
const DEFAULT_BODY =
  'Ukentlig oppsummering for casting-folk, regissører og produsenter — data fra norsk produksjon, ett kvalifisert casting-tips og én juridisk endring du må vite om. Ingen spam, du kan melde deg av når som helst.';

export function NewsletterSignupBlock({
  heading = DEFAULT_HEADING,
  body = DEFAULT_BODY,
  ctaLabel = 'Meld meg på',
  endpoint = '/api/newsletter/role-room',
  compact = false,
  source = 'unknown',
}: NewsletterSignupBlockProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Skriv inn en gyldig e-postadresse.');
      setState('error');
      return;
    }
    setState('submitting');
    setErrorMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.message || 'Påmeldingen feilet. Prøv igjen om litt.');
      }
      setState('success');
      setEmail('');
    } catch (err) {
      setErrorMessage((err as Error).message);
      setState('error');
    }
  }

  return (
    <Box
      component="aside"
      aria-label="Påmelding til Norwegian Casting Brief"
      data-testid="role-room-newsletter-signup"
      sx={{
        p: compact ? 2 : { xs: 2.5, md: 3.5 },
        borderRadius: 3,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(139,92,246,0.28)',
        backdropFilter: 'blur(12px)',
        maxWidth: 620,
        mx: 'auto',
      }}
    >
      {!compact ? (
        <>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
            <MailOutlineIcon sx={{ color: '#a78bfa' }} fontSize="small" />
            <Typography
              component="h3"
              sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', md: '1.1rem' } }}
            >
              {heading}
            </Typography>
          </Stack>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: { xs: '0.85rem', md: '0.92rem' },
              lineHeight: 1.55,
              mb: 2,
            }}
          >
            {body}
          </Typography>
        </>
      ) : null}

      {state === 'success' ? (
        <Alert
          severity="success"
          sx={{
            bgcolor: 'rgba(34,197,94,0.12)',
            color: '#bbf7d0',
            border: '1px solid rgba(34,197,94,0.35)',
          }}
        >
          Takk! Du får første utgave kommende fredag. Sjekk innboksen for bekreftelse.
        </Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems="stretch">
            <TextField
              type="email"
              label="E-post"
              autoComplete="email"
              inputMode="email"
              fullWidth
              required
              size="small"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={state === 'submitting'}
              error={state === 'error'}
              helperText={state === 'error' ? errorMessage : ' '}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(2,6,23,0.6)',
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(148,163,184,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(167,139,250,0.6)' },
                },
                '& label': { color: 'rgba(226,232,240,0.7)' },
                '& .MuiFormHelperText-root': { color: 'rgba(248,113,113,0.85)' },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={state === 'submitting'}
              data-testid="role-room-newsletter-submit"
              sx={{
                px: 3,
                py: 1.1,
                minHeight: 44,
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                whiteSpace: 'nowrap',
              }}
            >
              {state === 'submitting' ? 'Sender…' : ctaLabel}
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default NewsletterSignupBlock;
