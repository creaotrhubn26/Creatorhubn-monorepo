/**
 * TalentProposalCard — talent-siden av reverse-consent.
 *
 * Viser ett ventende forslag fra et byrå/agentur («FORSLAG FRA AGENTUR»):
 * byrånavn, rolle/produksjon (context_role), hvilke deler av profilen byrået
 * ber om tilgang til (requested_scopes), en samtykke-note, og Godta/Avslå.
 *
 * GDPR-kjernen: ingenting deles før talenten klikker «Godta forslag». Avslag
 * deler ingen data. Hver visning loggføres i audit-trail («hvem har sett meg?»).
 *
 * Backend: GET /api/role-room/talents/me/proposals (liste) +
 * POST .../talent-proposals/:token/{accept,decline} (mig 218 + consent 210).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, Chip, CircularProgress, Alert } from '@mui/material';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import TheaterComedyOutlinedIcon from '@mui/icons-material/TheaterComedyOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import { palette, radius } from '../theme';
import { roleRoomTalentsService, type MyTalentProposal } from '../../services/roleRoomTalentsService';

const SCOPE_LABELS: Record<string, string> = {
  basic_profile: 'Basis-profil (navn, by, bio)',
  media_portfolio: 'Media (headshot, showreel, CV)',
  contact_info: 'Kontaktinfo (e-post, telefon)',
  demographics: 'Demografi (alder, kjønn, høyde)',
  availability: 'Tilgjengelighet',
  audition_invitations: 'Audition-invitasjoner',
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

export interface TalentProposalCardProps {
  proposal: MyTalentProposal;
  /** Kalles etter at forslaget er godtatt/avslått, så lista kan oppdatere seg. */
  onResolved?: (id: string, action: 'accepted' | 'declined') => void;
}

export function TalentProposalCard({ proposal, onResolved }: TalentProposalCardProps): React.ReactElement {
  const [busy, setBusy] = React.useState<'accept' | 'decline' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<'accepted' | 'declined' | null>(null);

  const accept = async (): Promise<void> => {
    setBusy('accept'); setError(null);
    const res = await roleRoomTalentsService.acceptTalentProposal(proposal.token);
    setBusy(null);
    if (!res.ok) { setError(res.error ?? 'Kunne ikke godta forslaget'); return; }
    setDone('accepted');
    onResolved?.(proposal.id, 'accepted');
  };

  const decline = async (): Promise<void> => {
    if (!window.confirm('Avslå dette forslaget? Ingen data deles. Du kan ikke angre.')) return;
    setBusy('decline'); setError(null);
    const res = await roleRoomTalentsService.declineTalentProposal(proposal.token);
    setBusy(null);
    if (!res.ok) { setError(res.error ?? 'Kunne ikke avslå'); return; }
    setDone('declined');
    onResolved?.(proposal.id, 'declined');
  };

  const cardSx = {
    position: 'relative' as const,
    bgcolor: palette.bgCard,
    border: `1px solid ${palette.border}`,
    borderRadius: radius.xl,
    p: { xs: 2.5, md: 3.5 },
    boxShadow: '0 24px 60px rgba(124,58,237,0.25)',
    overflow: 'hidden',
    maxWidth: 640,
  };

  if (done) {
    const ok = done === 'accepted';
    return (
      <Box sx={cardSx} data-testid={`talent-proposal-${proposal.id}`}>
        <Stack alignItems="center" spacing={1.5} sx={{ py: 3, textAlign: 'center' }}>
          {ok
            ? <CheckCircleOutlineIcon sx={{ fontSize: 56, color: palette.success }} />
            : <CloseIcon sx={{ fontSize: 56, color: palette.textMuted }} />}
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: palette.textPrimary }}>
            {ok ? 'Du er lagt til!' : 'Forslag avslått'}
          </Typography>
          <Typography sx={{ fontSize: 14, color: palette.textSecondary, maxWidth: 420 }}>
            {ok
              ? `${proposal.agency_name} har nå tilgang til delene du samtykket til. Du kan trekke tilbake når som helst i Samtykke.`
              : 'Ingen data ble delt. Byrået får ikke se profilen din.'}
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={cardSx} data-testid={`talent-proposal-${proposal.id}`}>
      {/* Brand-rad */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <Box sx={{
          width: 46, height: 46, borderRadius: radius.md, display: 'grid', placeItems: 'center',
          background: palette.accentGradient, fontWeight: 800, fontSize: 22, color: '#fff',
          boxShadow: '0 8px 22px rgba(168,85,247,0.45)',
        }}>R</Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: palette.textPrimary, lineHeight: 1.1 }}>
            THE ROLE ROOM
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: palette.accent }}>
            TALENTS
          </Typography>
        </Box>
      </Stack>

      {/* Badge */}
      <Chip
        icon={<HandshakeOutlinedIcon sx={{ fontSize: 16, color: `${palette.accent} !important` }} />}
        label="FORSLAG FRA AGENTUR"
        sx={{
          bgcolor: 'rgba(168,85,247,0.12)', border: `1px solid ${palette.borderStrong}`,
          color: palette.accent, fontWeight: 800, letterSpacing: '0.12em', fontSize: 12, height: 30, mb: 2,
        }}
      />

      {/* Tittel */}
      <Typography sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 800, color: palette.textPrimary, lineHeight: 1.1, mb: 2.5 }}>
        Et byrå vil <Box component="span" sx={{ color: palette.accentBright }}>foreslå deg</Box> til en rolle
      </Typography>

      {/* Agentur + rolle */}
      <Box sx={{ border: `1px solid ${palette.border}`, borderRadius: radius.lg, p: 2.5, mb: 2 }}>
        <Stack direction="row" spacing={1.75} alignItems="center" sx={{ pb: 2, mb: 2, borderBottom: `1px solid ${palette.borderSubtle}` }}>
          <Box sx={{ width: 44, height: 44, borderRadius: radius.md, display: 'grid', placeItems: 'center', bgcolor: 'rgba(168,85,247,0.10)', border: `1px solid ${palette.border}` }}>
            <ApartmentOutlinedIcon sx={{ color: palette.accent }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: palette.textMuted }}>AGENTUR</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: palette.textPrimary }}>{proposal.agency_name}</Typography>
              {proposal.agency_verified ? <VerifiedOutlinedIcon sx={{ fontSize: 18, color: palette.accentBright }} /> : null}
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
              {PARTNER_TYPE_LABELS[proposal.agency_type] ?? proposal.agency_type}
            </Typography>
          </Box>
        </Stack>

        {proposal.context_role ? (
          <Box sx={{ mb: proposal.requested_scopes.length ? 2 : 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
              <TheaterComedyOutlinedIcon sx={{ fontSize: 16, color: palette.accent }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: palette.textMuted }}>ROLLE / PRODUKSJON</Typography>
            </Stack>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: palette.textPrimary, whiteSpace: 'pre-line' }}>
              {proposal.context_role}
            </Typography>
          </Box>
        ) : null}

        {proposal.requested_scopes.length ? (
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: palette.textMuted, mb: 1 }}>
              HVIS DU GODTAR, FÅR BYRÅET TILGANG TIL
            </Typography>
            <Stack spacing={0.75}>
              {proposal.requested_scopes.map((s) => (
                <Stack key={s} direction="row" spacing={1} alignItems="center">
                  <CheckCircleOutlineIcon sx={{ fontSize: 17, color: palette.accentBright }} />
                  <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>{SCOPE_LABELS[s] ?? s}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Box>

      {/* Samtykke-note */}
      <Stack direction="row" spacing={1.25} sx={{ bgcolor: 'rgba(168,85,247,0.06)', border: `1px solid ${palette.borderSubtle}`, borderRadius: radius.lg, p: 2, mb: 2.5 }}>
        <ShieldOutlinedIcon sx={{ fontSize: 20, color: palette.accent, flex: 'none', mt: 0.25 }} />
        <Typography sx={{ fontSize: 13, color: palette.textSecondary, lineHeight: 1.5 }}>
          <Box component="span" sx={{ fontWeight: 800, color: palette.textPrimary }}>Du bestemmer.</Box>{' '}
          Byrået ser kun det du har samtykket til. Profilen din deles ikke før du godtar — og hver visning
          loggføres i din audit-trail: «hvem har sett meg?».
        </Typography>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {/* Handlinger */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button
          fullWidth variant="contained" disableElevation
          onClick={() => void accept()} disabled={busy !== null}
          startIcon={busy === 'accept' ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <CheckCircleOutlineIcon />}
          data-testid={`talent-proposal-accept-${proposal.id}`}
          sx={{
            py: 1.5, fontSize: 16, fontWeight: 800, textTransform: 'none', borderRadius: radius.lg,
            background: palette.accentGradient, color: '#fff',
            boxShadow: '0 12px 30px rgba(168,85,247,0.4)',
            '&:hover': { background: palette.accentGradient, filter: 'brightness(1.05)' },
          }}
        >
          Godta forslag
        </Button>
        <Button
          fullWidth variant="outlined"
          onClick={() => void decline()} disabled={busy !== null}
          startIcon={busy === 'decline' ? <CircularProgress size={18} /> : <CloseIcon />}
          data-testid={`talent-proposal-decline-${proposal.id}`}
          sx={{
            py: 1.5, fontSize: 16, fontWeight: 700, textTransform: 'none', borderRadius: radius.lg,
            color: palette.textSecondary, borderColor: palette.border,
            '&:hover': { borderColor: palette.borderStrong, bgcolor: 'rgba(168,85,247,0.05)' },
          }}
        >
          Avslå
        </Button>
      </Stack>
    </Box>
  );
}
