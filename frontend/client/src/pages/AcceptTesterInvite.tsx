// @ts-nocheck
/**
 * AcceptTesterInvite — landing-side når en prototype-tester klikker på
 * one-time-linken fra invitasjons-eposten.
 *
 * Flyt:
 *  1. Henter invitasjonen via GET /api/role-room/tester-invites/:token
 *  2. Viser hvem som har invitert + hva som skal testes + personlig melding
 *  3. Bruker bekrefter NDA (NdaAgreementCard)
 *  4. Bruker ser system-krav-rapport (SystemRequirementsCheck)
 *  5. Bruker klikker "Bekreft og åpne The Role Room"
 *  6. POST /api/role-room/tester-invites/:token/accept med signaturen
 *  7. Redirect til /role-room
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
  Chip,
} from '@mui/material';
import { useLocation } from 'wouter';
import { NdaAgreementCard, type NdaSignature } from '../components/invite/NdaAgreementCard';
import {
  SystemRequirementsCheck,
  type SystemRequirementsReport,
} from '../components/invite/SystemRequirementsCheck';

interface TesterInvite {
  id: string;
  email: string;
  name: string;
  testingAreas: string[];
  personalMessage: string | null;
  ndaVersion: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt: string | null;
}

function readTokenFromUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get('token') ?? '';
  } catch {
    return '';
  }
}

export default function AcceptTesterInvite() {
  const [, navigate] = useLocation();
  const token = useMemo(() => readTokenFromUrl(), []);

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<TesterInvite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ndaSignature, setNdaSignature] = useState<NdaSignature | null>(null);
  const [systemReport, setSystemReport] = useState<SystemRequirementsReport | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('Manglende token i URL. Be om en ny invitasjons-link.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/role-room/tester-invites/${encodeURIComponent(token)}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Invitasjonen finnes ikke eller er trukket tilbake.');
          }
          throw new Error(`Kunne ikke laste invitasjonen (${response.status})`);
        }
        const data = (await response.json()) as TesterInvite;
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Ukjent feil');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSubmit =
    invite?.status === 'pending'
    && ndaSignature?.agreed === true
    && systemReport != null
    && systemReport.overallSeverity !== 'fail'
    && !submitting;

  const handleAccept = async () => {
    if (!canSubmit || !invite || !ndaSignature) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        `/api/role-room/tester-invites/${encodeURIComponent(token)}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ndaName: ndaSignature.fullName,
            ndaVersion: ndaSignature.ndaVersion,
            systemReport,
          }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `Kunne ikke godta invitasjonen (${response.status})`);
      }
      const data = await response.json();
      setAcceptedAt(data.acceptedAt);
      window.setTimeout(() => navigate('/role-room'), 2500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ukjent feil');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ color: '#b86bff' }} />
        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.7)' }}>
          Laster invitasjon…
        </Typography>
      </Container>
    );
  }

  if (loadError || !invite) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error" variant="outlined">
          {loadError ?? 'Invitasjonen kunne ikke lastes.'}
        </Alert>
      </Container>
    );
  }

  if (invite.status === 'accepted' && !acceptedAt) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="info" variant="outlined">
          Denne invitasjonen er allerede godtatt. Logg inn for å åpne The Role Room.
        </Alert>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/role-room')}>
            Åpne The Role Room
          </Button>
        </Box>
      </Container>
    );
  }

  if (invite.status === 'expired' || invite.status === 'revoked') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning" variant="outlined">
          {invite.status === 'expired'
            ? 'Invitasjonen er utløpt. Ta kontakt med admin for en ny.'
            : 'Invitasjonen er trukket tilbake.'}
        </Alert>
      </Container>
    );
  }

  if (acceptedAt) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="success" variant="outlined">
          Takk! NDA er signert {new Date(acceptedAt).toLocaleString('nb-NO')}.
          Du blir sendt videre til The Role Room…
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Stack spacing={3}>
        <Paper
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            bgcolor: 'rgba(184,107,255,0.06)',
            border: '1px solid rgba(184,107,255,0.32)',
          }}
        >
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            Velkommen som prototype-tester, {invite.name}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', mb: 2 }}>
            Du er invitert til å teste The Role Room. For å åpne tilgang må du
            signere konfidensialitetsavtalen og bekrefte at miljøet ditt støtter
            prototypen.
          </Typography>

          {invite.personalMessage && (
            <Box
              sx={{
                p: 2,
                bgcolor: 'rgba(2,6,15,0.5)',
                borderLeft: '3px solid #b86bff',
                borderRadius: 1,
                mb: 2,
              }}
            >
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mb: 0.5 }}>
                Personlig hilsen fra admin:
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.92)', fontStyle: 'italic' }}>
                «{invite.personalMessage}»
              </Typography>
            </Box>
          )}

          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mb: 0.75 }}>
              Områder du blir bedt om å teste:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {invite.testingAreas.map((area: string) => (
                <Chip
                  key={area}
                  label={area}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(184,107,255,0.18)',
                    color: '#e9d5ff',
                    border: '1px solid rgba(184,107,255,0.4)',
                    fontWeight: 600,
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Paper>

        <NdaAgreementCard
          ndaVersion={invite.ndaVersion}
          defaultFullName={invite.name}
          onSign={setNdaSignature}
        />

        <SystemRequirementsCheck onReport={setSystemReport} />

        {submitError && (
          <Alert severity="error" variant="outlined">{submitError}</Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={handleAccept}
            sx={{
              bgcolor: '#b86bff',
              color: '#0b1120',
              fontWeight: 800,
              px: 4,
              py: 1.5,
              minHeight: 48,
              '&:hover': { bgcolor: '#a855f7' },
              '&:disabled': { bgcolor: 'rgba(184,107,255,0.3)', color: 'rgba(11,17,32,0.7)' },
            }}
          >
            {submitting
              ? 'Sender…'
              : systemReport?.overallSeverity === 'fail'
                ? 'System-krav ikke oppfylt'
                : ndaSignature
                  ? 'Bekreft og åpne The Role Room'
                  : 'Signér NDA først'}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
