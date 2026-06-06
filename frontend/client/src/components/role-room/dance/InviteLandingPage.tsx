/**
 * InviteLandingPage — 2-stegs magic-link + PIN-bekreftelse for dans-team-invite.
 *
 * GDPR/sikkerhet:
 *   • Public lookup viser kun maskert e-post + rolle-label (full e-post
 *     avsløres aldri til en utenforstående som klikker en delt lenke)
 *   • PIN sendes til invited_email — bekrefter at den som klikker faktisk
 *     har tilgang til den e-posten. Hindrer link-deling/forwarding.
 *   • PIN er 6 sifre, gyldig 15 min, max 3 forsøk → låses
 *   • Aksept logger IP + user-agent for audit (GDPR Art. 30)
 *   • Eksplisitt consent-tekst om databehandling
 *
 * Flyt:
 *   Steg 1: Vis info → "Send PIN til <maskert e-post>" → request-pin
 *   Steg 2: Vis PIN-input + navn-felt + GDPR-consent → accept-with-pin
 *   Suksess: lagre session-token i localStorage, redirect til workspace
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Stack,
  Alert,
  Paper,
  TextField,
  Checkbox,
  FormControlLabel,
  Link,
} from '@mui/material';
import {
  GroupsOutlined as TeamIcon,
  MailOutlineOutlined as MailIcon,
  LockOutlined as LockIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import * as svc from './danceTeamService';
import type { InvitePublicInfo } from './danceTeamService';

const PURPLE_BRIGHT = danceFlowColors.lavenderDark;
const PURPLE_DEEP   = '#4c1d95';
const PURPLE_LIGHT  = danceFlowColors.lavender;
const TEXT_DIM      = 'rgba(229,231,235,0.78)';
const TEXT_MUTED    = 'rgba(229,231,235,0.55)';
const PANEL_BORDER  = 'rgba(167,139,250,0.18)';

interface Props {
  token: string;
}

type Step = 'loading' | 'review' | 'pin-entry' | 'accepting' | 'done' | 'error';

export const InviteLandingPage: React.FC<Props> = ({ token }) => {
  const [, navigate] = useLocation();
  const [step, setStep] = React.useState<Step>('loading');
  const [info, setInfo] = React.useState<InvitePublicInfo | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [pinRequesting, setPinRequesting] = React.useState(false);
  const [pinThrottledUntil, setPinThrottledUntil] = React.useState<number | null>(null);

  // Steg 1: Last invite-info ved mount
  React.useEffect(() => {
    void (async () => {
      try {
        const i = await svc.getInvitePublicInfo(token);
        setInfo(i);
        setStep('review');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const friendly = errorLabel(msg) ?? 'Kunne ikke hente invitasjon';
        setError(friendly);
        setStep('error');
      }
    })();
  }, [token]);

  // Throttle countdown (visuelt — backend håndhever uansett)
  const [throttleSec, setThrottleSec] = React.useState(0);
  React.useEffect(() => {
    if (!pinThrottledUntil) { setThrottleSec(0); return; }
    const tick = () => {
      const sec = Math.max(0, Math.ceil((pinThrottledUntil - Date.now()) / 1000));
      setThrottleSec(sec);
      if (sec === 0) setPinThrottledUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pinThrottledUntil]);

  const requestPin = async () => {
    setError(null);
    setPinRequesting(true);
    try {
      await svc.requestPinForInvite(token);
      setStep('pin-entry');
    } catch (e) {
      const err = e as Error & { status?: number; payload?: { throttledUntil?: string } };
      if (err.status === 429 && err.payload?.throttledUntil) {
        setPinThrottledUntil(new Date(err.payload.throttledUntil).getTime());
        setError('Vent litt før du ber om ny PIN.');
        setStep('pin-entry');
      } else {
        setError(errorLabel(err.message) ?? 'Kunne ikke sende PIN');
      }
    } finally {
      setPinRequesting(false);
    }
  };

  const submitPin = async () => {
    if (!consent) {
      setError('Du må samtykke til databehandlingen for å fortsette.');
      return;
    }
    setError(null);
    setStep('accepting');
    try {
      const r = await svc.acceptInviteWithPin(token, pin.trim(), fullName.trim());
      // Lagre session-token slik at vi er innlogget
      localStorage.setItem('authToken', r.sessionToken);
      sessionStorage.setItem('authToken', r.sessionToken);
      setStep('done');
      setTimeout(() => {
        navigate(`/?mode=dance_studio&team=${encodeURIComponent(r.teamOrganizationId)}`);
      }, 1400);
    } catch (e) {
      const err = e as Error & { status?: number };
      const reason = err.message;
      if (reason === 'pin_invalid') {
        setError('Feil PIN. Sjekk e-posten og prøv igjen.');
      } else if (reason === 'pin_expired') {
        setError('PIN-en har utløpt. Be om en ny.');
      } else if (reason === 'pin_locked') {
        setError('Maks antall forsøk overskredet. Be Studio-eier sende ny invitasjon.');
      } else {
        setError(errorLabel(reason) ?? 'Kunne ikke akseptere');
      }
      setStep('pin-entry');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  if (step === 'loading') {
    return <Layout><CircularProgress sx={{ color: PURPLE_LIGHT }} /></Layout>;
  }

  if (step === 'error' || !info) {
    return (
      <Layout>
        <Alert severity="error" sx={{ width: '100%' }}>
          {error ?? 'Invitasjonen finnes ikke eller er utløpt.'}
        </Alert>
      </Layout>
    );
  }

  if (step === 'done') {
    return (
      <Layout>
        <Stack alignItems="center" spacing={2}>
          <TeamIcon sx={{ fontSize: 56, color: PURPLE_LIGHT }} />
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'rgba(237,233,254,0.95)' }}>
            Velkommen til teamet!
          </Typography>
          <Typography sx={{ fontSize: 13, color: TEXT_DIM }}>Tar deg til workspace…</Typography>
        </Stack>
      </Layout>
    );
  }

  if (step === 'accepting') {
    return (
      <Layout>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress sx={{ color: PURPLE_LIGHT }} />
          <Typography sx={{ fontSize: 13, color: TEXT_DIM }}>Bekrefter PIN og setter opp konto…</Typography>
        </Stack>
      </Layout>
    );
  }

  // ─── Steg 1: Review-skjerm ──────────────────────────────────────────
  if (step === 'review') {
    return (
      <Layout>
        <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', maxWidth: 460 }}>
          <TeamIcon sx={{ fontSize: 48, color: PURPLE_LIGHT }} />
          <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
            DANSESTUDIO · INVITASJON
          </Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'rgba(237,233,254,0.95)', lineHeight: 1.2 }}>
            Du er invitert
          </Typography>
          <Typography sx={{ fontSize: 14, color: TEXT_DIM }}>
            som <Box component="span" sx={{ color: PURPLE_LIGHT, fontWeight: 700 }}>{info.invitedRoleLabel}</Box> i et dansestudio på CreatorHub.
          </Typography>

          <Box sx={{ width: '100%', mt: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(139,92,246,0.06)', border: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <MailIcon sx={{ color: PURPLE_LIGHT, fontSize: 22 }} />
            <Box sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontSize: 12, color: TEXT_MUTED, letterSpacing: 0.5 }}>SENDES TIL</Typography>
              <Typography sx={{ fontSize: 14, color: 'rgba(237,233,254,0.92)', fontVariantNumeric: 'tabular-nums' }}>
                {info.invitedEmailMasked}
              </Typography>
            </Box>
          </Box>

          {error ? <Alert severity="warning" sx={{ width: '100%' }}>{error}</Alert> : null}

          <Button
            variant="contained"
            size="large"
            onClick={requestPin}
            disabled={pinRequesting || throttleSec > 0}
            startIcon={pinRequesting ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <MailIcon />}
            sx={{
              mt: 1,
              bgcolor: PURPLE_BRIGHT,
              '&:hover': { bgcolor: PURPLE_DEEP },
              textTransform: 'none',
              fontWeight: 700,
              px: 4, py: 1.25,
            }}
          >
            {throttleSec > 0
              ? `Vent ${throttleSec}s…`
              : pinRequesting
                ? 'Sender…'
                : 'Send PIN til min e-post'}
          </Button>

          <Typography sx={{ fontSize: 11, color: TEXT_MUTED, mt: 2 }}>
            For å beskytte invitasjonen, sender vi en 6-sifret PIN til e-postadressen
            som ble invitert. Du må bekrefte PIN-en før du kan bli medlem.
          </Typography>
        </Stack>
      </Layout>
    );
  }

  // ─── Steg 2: PIN-entry ──────────────────────────────────────────────
  return (
    <Layout>
      <Stack spacing={2.5} sx={{ maxWidth: 440, width: '100%' }}>
        <Stack alignItems="center" spacing={1}>
          <LockIcon sx={{ fontSize: 40, color: PURPLE_LIGHT }} />
          <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
            BEKREFT MED PIN
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'rgba(237,233,254,0.95)', textAlign: 'center', lineHeight: 1.3 }}>
            Sjekk e-posten din
          </Typography>
          <Typography sx={{ fontSize: 12, color: TEXT_DIM, textAlign: 'center' }}>
            Vi har sendt en 6-sifret PIN til <strong>{info.invitedEmailMasked}</strong>.
          </Typography>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <TextField
          label="6-sifret PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          fullWidth
          autoFocus
          inputMode="numeric"
          inputProps={{ maxLength: 6, style: { fontSize: 26, letterSpacing: 8, textAlign: 'center', fontFamily: 'monospace' } }}
          sx={{ '& .MuiInputLabel-root, & .MuiOutlinedInput-root': { color: 'rgba(237,233,254,0.9)' } }}
        />

        <TextField
          label="Fullt navn"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          fullWidth
          placeholder="Slik vil teamet ditt se navnet ditt"
          sx={{ '& .MuiInputLabel-root, & .MuiOutlinedInput-root': { color: 'rgba(237,233,254,0.9)' } }}
        />

        {/* GDPR consent */}
        <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(139,92,246,0.04)', border: `1px solid ${PANEL_BORDER}` }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                size="small"
                sx={{ color: PURPLE_LIGHT, '&.Mui-checked': { color: PURPLE_BRIGHT } }}
              />
            }
            label={
              <Typography sx={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>
                Jeg samtykker til at CreatorHub oppretter en konto med min e-post,
                lagrer mitt navn og logger IP-adressen min ved aksept. Data
                behandles iht. {' '}
                <Link href="/privacy" target="_blank" sx={{ color: PURPLE_LIGHT }}>personvernerklæringen</Link>.
              </Typography>
            }
            sx={{ alignItems: 'flex-start', m: 0, '& .MuiFormControlLabel-label': { mt: 0.25 } }}
          />
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={submitPin}
          disabled={pin.length !== 6 || fullName.trim().length < 2 || !consent}
          sx={{
            bgcolor: PURPLE_BRIGHT,
            '&:hover': { bgcolor: PURPLE_DEEP },
            textTransform: 'none',
            fontWeight: 700,
            py: 1.25,
          }}
        >
          Bekreft og bli medlem
        </Button>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: 11, color: TEXT_MUTED }}>
            PIN gjelder i 15 minutter
          </Typography>
          <Button
            size="small"
            onClick={requestPin}
            disabled={pinRequesting || throttleSec > 0}
            sx={{ textTransform: 'none', color: PURPLE_LIGHT, fontSize: 12 }}
          >
            {throttleSec > 0 ? `Send ny om ${throttleSec}s` : 'Send ny PIN'}
          </Button>
        </Stack>
      </Stack>
    </Layout>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(76,29,149,0.18) 0%, #0a0a0a 70%)',
      p: 3,
    }}
  >
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'rgba(15,12,28,0.78)',
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 3,
        p: { xs: 3, md: 5 },
        maxWidth: 560,
        width: '100%',
        backdropFilter: 'blur(12px)',
      }}
    >
      {children}
    </Paper>
  </Box>
);

function errorLabel(reason: string | undefined): string | null {
  switch (reason) {
    case 'not_found':       return 'Invitasjonen finnes ikke.';
    case 'expired':         return 'Invitasjonen har utløpt. Be om ny fra Studio-eieren.';
    case 'revoked':         return 'Invitasjonen er trukket tilbake.';
    case 'already_accepted':return 'Denne invitasjonen er allerede akseptert.';
    case 'pin_locked':      return 'For mange feil PIN-forsøk — kontakt Studio-eieren for ny invitasjon.';
    case 'mailer_not_configured': return 'E-posttjenesten er ikke tilgjengelig for øyeblikket. Prøv igjen senere.';
    case 'rate_limited':    return 'Du må vente litt før du ber om ny PIN.';
    case 'pin_not_requested': return 'Be om PIN først.';
    default: return null;
  }
}

export default InviteLandingPage;
