/**
 * PartnerInviteAcceptPage.tsx
 *
 * E2E accept-side for partner-invites. Partneren klikker lenken fra
 * invitasjonen → ?token=X → vi viser hva talenten har invitert dem til +
 * en "Aksepter"-knapp. Auth kreves (re-direct til login-flow hvis ikke).
 *
 * URL: /talents/partner-invite?token=<token>
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
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type PartnerInviteDetail,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

const SCOPE_LABELS: Record<string, string> = {
  basic_profile: 'Basis-profil',
  media_portfolio: 'Media (headshot, showreel, CV)',
  contact_info: 'Kontaktinformasjon',
  demographics: 'Demografi',
  availability: 'Tilgjengelighet',
  audition_invitations: 'Audition-invitasjoner',
  self_tape_review: 'Self-tape-vurdering',
  full_profile: 'Full profil-tilgang',
};

const PARTNER_TYPE_LABELS: Record<string, string> = {
  stella_casting: 'Stella Casting',
  skuespillersenter: 'Norsk Skuespillersenter',
  production_company: 'produksjonsselskap',
  caster_individual: 'individuell caster',
  workshop_provider: 'workshop-arrangør',
};

export default function PartnerInviteAcceptPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);
  const [invite, setInvite] = useState<PartnerInviteDetail | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  const reload = useCallback(async () => {
    if (!token) {
      setError('Mangler invitasjons-token');
      setLoading(false);
      return;
    }
    const result = await roleRoomTalentsService.lookupPartnerInvite(token);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setInvite(result.invite);
    setExpired(Boolean(result.expired));
  }, [token]);

  useEffect(() => { void reload(); }, [reload]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    const result = await roleRoomTalentsService.acceptPartnerInvite(token);
    setAccepting(false);
    if (!result.ok) {
      setError(result.error || 'Kunne ikke akseptere invitasjonen');
      return;
    }
    setDone(true);
    // Etter 2 sekunder, send brukeren til agency-dashbord (når det finnes)
    setTimeout(() => {
      window.location.href = '/talents/partners';
    }, 2200);
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
      <Box sx={{ maxWidth: 540, width: '100%', bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.lg, p: 4 }}>
        {error ? (
          <Stack spacing={2}>
            <Alert severity="error">{error}</Alert>
            <Button href="/talents/partners" sx={{ textTransform: 'none', color: palette.accentBright, alignSelf: 'flex-start' }}>
              Gå til partner-portal
            </Button>
          </Stack>
        ) : done ? (
          <Stack spacing={2} alignItems="center">
            <CheckCircleIcon sx={{ color: palette.success, fontSize: 48 }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.3rem' }}>
              Invitasjon akseptert!
            </Typography>
            <Typography sx={{ color: palette.textSecondary, textAlign: 'center' }}>
              Du har nå tilgang til {invite?.talent_name}-profilen. Sender deg videre…
            </Typography>
          </Stack>
        ) : expired ? (
          <Stack spacing={2}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.3rem' }}>
              Invitasjonen er utløpt
            </Typography>
            <Typography sx={{ color: palette.textSecondary }}>
              Be {invite?.talent_name} om å sende en ny invitasjon hvis du fortsatt vil ha tilgang.
            </Typography>
          </Stack>
        ) : invite ? (
          <Stack spacing={2.4}>
            <Box>
              <Typography sx={{ color: palette.accentBright, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', mb: 1 }}>
                Invitasjon fra The Role Room Talents
              </Typography>
              <Typography sx={{ color: palette.textPrimary, fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.25, mb: 1 }}>
                {invite.talent_name} inviterer deg til å se profilen
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.95rem' }}>
                Du blir tilknyttet som {PARTNER_TYPE_LABELS[invite.partner_type] ?? invite.partner_type}. {invite.talent_name} kan trekke tilgangen når som helst.
              </Typography>
            </Box>

            {invite.message ? (
              <Box sx={{ p: 1.6, bgcolor: palette.bgCardElevated, borderLeft: `3px solid ${palette.accent}`, borderRadius: '0 8px 8px 0' }}>
                <Typography sx={{ color: palette.textSecondary, fontStyle: 'italic', fontSize: '0.9rem' }}>
                  «{invite.message}»
                </Typography>
              </Box>
            ) : null}

            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>
                Du får tilgang til:
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {invite.scopes.map((s) => (
                  <Chip
                    key={s}
                    label={SCOPE_LABELS[s] ?? s}
                    sx={{ bgcolor: 'rgba(168, 85, 247, 0.16)', color: palette.accentBright, fontWeight: 600 }}
                  />
                ))}
              </Stack>
            </Box>

            <Stack direction="row" spacing={1.4}>
              <Button
                onClick={() => void handleAccept()}
                disabled={accepting}
                startIcon={accepting ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.95rem', px: 3, py: 1.2, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff', flexGrow: 1 }}
              >
                Aksepter invitasjon
              </Button>
              <Button
                href="/talents/partners"
                sx={{ textTransform: 'none', color: palette.textMuted, px: 2 }}
              >
                Avslå
              </Button>
            </Stack>

            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', textAlign: 'center', mt: 1 }}>
              Du må være logget inn for å akseptere. Hvis du ikke har konto, opprett først.
            </Typography>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
