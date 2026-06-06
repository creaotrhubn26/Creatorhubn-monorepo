/**
 * TalentProposalAcceptPage.tsx
 *
 * Phase 7.5 — skuespilleren mottar lenke fra Stella, åpner den, ser hvem
 * som foreslår + hva de ber om, og bestemmer Accept/Decline.
 *
 * URL: /talents/registry-invite?token=<token>
 *
 * Inget av talents data deles før hen klikker Aksepter. Dette er
 * GDPR-essensen av reverse-consent.
 */

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ShieldIcon from '@mui/icons-material/Shield';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type TalentProposalDetail,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

const SCOPE_LABELS: Record<string, string> = {
  basic_profile: 'Basis-profil (navn, by, bio)',
  media_portfolio: 'Media (headshot, showreel, CV)',
  contact_info: 'Kontaktinfo (e-post, telefon)',
  demographics: 'Demografi (alder, kjønn, høyde, etc.)',
  availability: 'Tilgjengelighet (når du kan jobbe)',
  audition_invitations: 'Audition-invitasjoner direkte fra dem',
  self_tape_review: 'Self-tape-vurdering',
  full_profile: 'Full profil-tilgang',
  workshop_access: 'Workshops',
};

const PARTNER_TYPE_LABELS: Record<string, string> = {
  stella_casting: 'Casting-byrå',
  skuespillersenter: 'Skuespillersenter',
  production_company: 'Produksjonsselskap',
  caster_individual: 'Individuell caster',
  workshop_provider: 'Workshop-arrangør',
};

export default function TalentProposalAcceptPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);
  const [proposal, setProposal] = useState<TalentProposalDetail | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  const reload = useCallback(async () => {
    if (!token) { setError('Mangler invitasjons-token'); setLoading(false); return; }
    const result = await roleRoomTalentsService.lookupTalentProposal(token);
    setLoading(false);
    if ('error' in result) { setError(result.error); return; }
    setProposal(result.proposal);
    setExpired(Boolean(result.expired));
  }, [token]);

  useEffect(() => { void reload(); }, [reload]);

  const handleAccept = async () => {
    if (!token) return;
    setBusy(true); setError(null);
    const result = await roleRoomTalentsService.acceptTalentProposal(token);
    setBusy(false);
    if (!result.ok) { setError(result.error || 'Klarte ikke å akseptere'); return; }
    setDone('accepted');
    setTimeout(() => { window.location.href = '/talents/profil'; }, 2500);
  };

  const handleDecline = async () => {
    if (!token) return;
    if (!window.confirm('Avslå dette forslaget? Du kan ikke endre det etterpå.')) return;
    setBusy(true); setError(null);
    const result = await roleRoomTalentsService.declineTalentProposal(token);
    setBusy(false);
    if (!result.ok) { setError(result.error || 'Kunne ikke avslå'); return; }
    setDone('declined');
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: palette.bgRoot }}>
        <CircularProgress sx={{ color: palette.accentBright }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: palette.bgRoot, p: 3 }}>
      <Box sx={{ maxWidth: 580, width: '100%', bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.lg, p: 4 }}>
        {error ? (
          <Stack spacing={2}>
            <Alert severity="error">{error}</Alert>
            <Button href="/talents" sx={{ textTransform: 'none', color: palette.accentBright, alignSelf: 'flex-start' }}>
              Gå til The Role Room Talents
            </Button>
          </Stack>
        ) : done === 'accepted' ? (
          <Stack spacing={2} alignItems="center">
            <CheckCircleIcon sx={{ color: palette.success, fontSize: 56 }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.3rem', textAlign: 'center' }}>
              Du er lagt til!
            </Typography>
            <Typography sx={{ color: palette.textSecondary, textAlign: 'center', lineHeight: 1.6 }}>
              {proposal?.agency_name} har nå tilgang til de delene av profilen din du godkjente. Du kan trekke tilgangen når som helst fra Partnere-fanen.
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>Tar deg til profilen din…</Typography>
          </Stack>
        ) : done === 'declined' ? (
          <Stack spacing={2} alignItems="center">
            <CloseIcon sx={{ color: palette.textMuted, fontSize: 56 }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.3rem' }}>Forslag avslått</Typography>
            <Typography sx={{ color: palette.textSecondary, textAlign: 'center' }}>
              Ingen data ble delt med {proposal?.agency_name}. Du kan trygt lukke denne siden.
            </Typography>
          </Stack>
        ) : expired ? (
          <Stack spacing={2}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.3rem' }}>Forslaget er utløpt</Typography>
            <Typography sx={{ color: palette.textSecondary }}>
              Be {proposal?.agency_name} om å sende et nytt forslag hvis du fortsatt er interessert.
            </Typography>
          </Stack>
        ) : proposal ? (
          <Stack spacing={2.4}>
            <Box>
              <Typography sx={{ color: palette.accentBright, fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', mb: 1 }}>
                Forslag fra et casting-byrå
              </Typography>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 0.6 }}>
                <Typography sx={{ color: palette.textPrimary, fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.25 }}>
                  {proposal.agency_name}
                </Typography>
                {proposal.agency_verified ? (
                  <VerifiedIcon sx={{ color: palette.accentBright, fontSize: 22 }} titleAccess="Verifisert" />
                ) : null}
              </Stack>
              <Chip
                label={PARTNER_TYPE_LABELS[proposal.agency_type] ?? proposal.agency_type}
                size="small"
                sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: palette.accentBright, fontWeight: 600 }}
              />
              {proposal.agency_about ? (
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.9rem', mt: 1.4, lineHeight: 1.55 }}>
                  {proposal.agency_about}
                </Typography>
              ) : null}
            </Box>

            <Alert
              severity="info"
              icon={<ShieldIcon />}
              sx={{
                bgcolor: 'rgba(168,85,247,0.10)',
                color: palette.textPrimary,
                border: `1px solid ${palette.borderStrong}`,
                '& .MuiAlert-icon': { color: palette.accentBright },
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', mb: 0.4 }}>Du eier dette valget</Typography>
              <Typography sx={{ fontSize: '0.84rem', color: palette.textSecondary }}>
                Hvis du <strong>aksepterer</strong>, opprettes en talent-profil for deg og {proposal.agency_name} får tilgangen under. Du kan trekke tilgangen når som helst.<br />
                Hvis du <strong>avslår</strong>, deles ingenting og forslaget forsvinner.
              </Typography>
            </Alert>

            {proposal.personal_message ? (
              <Box sx={{ p: 1.6, bgcolor: palette.bgCardElevated, borderLeft: `3px solid ${palette.accent}`, borderRadius: '0 8px 8px 0' }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mb: 0.4 }}>Personlig melding:</Typography>
                <Typography sx={{ color: palette.textSecondary, fontStyle: 'italic', fontSize: '0.9rem' }}>
                  «{proposal.personal_message}»
                </Typography>
              </Box>
            ) : null}

            {proposal.context_role ? (
              <Box sx={{ p: 1.6, bgcolor: palette.bgCardElevated, borderRadius: radius.sm, border: `1px solid ${palette.borderSubtle}` }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mb: 0.4 }}>Rolle/produksjon:</Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '0.88rem' }}>{proposal.context_role}</Typography>
              </Box>
            ) : null}

            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>
                Hvis du aksepterer, får {proposal.agency_name} tilgang til:
              </Typography>
              <Stack spacing={0.8}>
                {proposal.requested_scopes.map((s) => (
                  <Stack key={s} direction="row" spacing={1} alignItems="center">
                    <CheckCircleIcon sx={{ color: palette.success, fontSize: 16 }} />
                    <Typography sx={{ color: palette.textPrimary, fontSize: '0.88rem' }}>{SCOPE_LABELS[s] ?? s}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
              <Button
                onClick={() => void handleAccept()}
                disabled={busy}
                startIcon={busy ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                sx={{
                  textTransform: 'none', fontWeight: 700, fontSize: '0.95rem',
                  px: 3, py: 1.2, borderRadius: radius.sm,
                  background: palette.accentGradient, color: '#fff', flexGrow: 1,
                }}
              >
                Aksepter — del de delene over
              </Button>
              <Button
                onClick={() => void handleDecline()}
                disabled={busy}
                sx={{
                  textTransform: 'none', fontWeight: 600,
                  color: palette.textMuted, px: 2,
                  border: `1px solid ${palette.borderSubtle}`,
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.08)', color: '#f87171' },
                }}
              >
                Avslå
              </Button>
            </Stack>

            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', textAlign: 'center' }}>
              Du må være logget inn for å akseptere. Hvis du ikke har konto, opprett en først.
            </Typography>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
