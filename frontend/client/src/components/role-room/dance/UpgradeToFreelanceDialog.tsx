/**
 * UpgradeToFreelanceDialog — konverterings-dialog for team-medlemmer.
 *
 * Vises ÉN gang per team-medlemskap: når en bruker som ikke er Studio-eier
 * lander i DanceWorkspace etter å ha akseptert en invitasjon. Tilbyr 2 valg:
 *
 *   1. "Få mer med Frilansdanser" — list 4 fordeler, tar dem til /pricing
 *   2. "Fortsett som team-medlem" — neutral, bare lukker
 *
 * Kritisk: ved upgrade BEHOLDER de team-medlemskapet. Frilansdanser-konto
 * er additiv, ikke en erstatning. UX-tone: subtil, informativ — ikke pushy.
 *
 * Når dialogen vises (uansett valg), kalles dismissUpgradeOffer som setter
 * upgrade_offer_seen_at = now() i DB. Dialogen kommer ikke tilbake.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import {
  CloseOutlined as CloseIcon,
  AccessibilityNewOutlined as FreelanceIcon,
  GroupsOutlined as TeamIcon,
  CheckCircleOutlineOutlined as CheckIcon,
} from '@mui/icons-material';
import * as svc from './danceTeamService';
import type { DanceTeamMembershipDetail } from './danceTeamService';

const PURPLE_BRIGHT = danceFlowColors.lavenderDark;
const PURPLE_DEEP   = '#4c1d95';
const PURPLE_LIGHT  = '#a78bfa';
const TEXT_DIM      = 'rgba(229,231,235,0.78)';
const TEXT_MUTED    = 'rgba(229,231,235,0.50)';
const PANEL_BORDER  = 'rgba(167,139,250,0.18)';

interface Props {
  membership: DanceTeamMembershipDetail;
  onClose: () => void;
}

const FREELANCE_BENEFITS: { title: string; detail: string }[] = [
  {
    title: 'Egen reel-portefølje',
    detail: 'Bygg opp din profesjonelle profil utenfor studioet — for auditions og frilans-jobber.',
  },
  {
    title: 'Egne prosjekter og oppdrag',
    detail: 'Logg jobber, kontakter og fakturaer du tar utenfor team-aktivitetene.',
  },
  {
    title: 'NAV- og union-dokumentasjon',
    detail: 'Automatisk timeoversikt for skuda, NoDa og inntektsrapportering.',
  },
  {
    title: 'Tilleggsmoduler etter behov',
    detail: 'Aktiver video-review pro, marketing-pakke eller AI-koreografi når du trenger dem.',
  },
];

export const UpgradeToFreelanceDialog: React.FC<Props> = ({ membership, onClose }) => {
  const [submitting, setSubmitting] = React.useState(false);

  const dismissAndClose = React.useCallback(async () => {
    setSubmitting(true);
    try {
      await svc.dismissUpgradeOffer(membership.member.memberRowId);
    } catch {
      // Best effort — dialogen lukkes uansett
    } finally {
      onClose();
    }
  }, [membership.member.memberRowId, onClose]);

  const upgradeAndNavigate = async () => {
    await dismissAndClose();
    // Routerer til Frilansdanser-pricing
    window.location.href = '/?mode=dance_freelance&tab=pricing';
  };

  const continueAsTeamMember = async () => {
    await dismissAndClose();
  };

  return (
    <Dialog
      open
      onClose={dismissAndClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          bgcolor: '#0f0a1c',
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 3,
          backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(76,29,149,0.18) 0%, transparent 60%)`,
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 3, md: 5 }, position: 'relative' }}>
        <Button
          onClick={dismissAndClose}
          startIcon={<CloseIcon />}
          sx={{
            position: 'absolute', top: 12, right: 12,
            color: TEXT_MUTED, textTransform: 'none', fontSize: 12, minWidth: 0,
          }}
          disabled={submitting}
        >
          Lukk
        </Button>

        <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', mb: 4 }}>
          <Chip
            label={`Du er en del av ${membership.role?.label ?? 'teamet'}`}
            size="small"
            sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontWeight: 600 }}
          />
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 700, color: 'rgba(237,233,254,0.95)', lineHeight: 1.2, maxWidth: 540 }}>
            Vil du også jobbe som frilanser?
          </Typography>
          <Typography sx={{ fontSize: 14, color: TEXT_DIM, maxWidth: 480, lineHeight: 1.55 }}>
            Du kan beholde plassen i teamet ditt og samtidig låse opp en egen
            frilans-profil for jobber utenfor studioet. Dette er additivt —
            du mister ingenting du allerede har.
          </Typography>
        </Stack>

        {/* ── To valg side om side ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>

          {/* Frilansdanser-kortet — anbefalt */}
          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 2.5,
              background: `linear-gradient(135deg, rgba(139,92,246,0.10), rgba(76,29,149,0.06))`,
              border: `1px solid rgba(167,139,250,0.32)`,
              position: 'relative',
            }}
          >
            <Chip
              label="Anbefalt"
              size="small"
              sx={{
                position: 'absolute', top: -10, left: 16,
                bgcolor: PURPLE_BRIGHT, color: '#fff', fontWeight: 700, fontSize: 10, height: 20,
              }}
            />
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <FreelanceIcon sx={{ fontSize: 30, color: PURPLE_LIGHT }} />
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'rgba(237,233,254,0.95)' }}>
                Frilansdanser-konto
              </Typography>
            </Stack>
            <Stack spacing={1.25} sx={{ mb: 3 }}>
              {FREELANCE_BENEFITS.map((b) => (
                <Stack key={b.title} direction="row" spacing={1.25} alignItems="flex-start">
                  <CheckIcon sx={{ fontSize: 18, color: PURPLE_LIGHT, mt: 0.25, flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(237,233,254,0.92)' }}>
                      {b.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.45 }}>
                      {b.detail}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={upgradeAndNavigate}
              disabled={submitting}
              sx={{
                bgcolor: PURPLE_BRIGHT,
                '&:hover': { bgcolor: PURPLE_DEEP },
                textTransform: 'none',
                fontWeight: 700,
                py: 1.25,
              }}
            >
              Se planene
            </Button>
            <Typography sx={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', mt: 1 }}>
              Du blir værende i {membership.team.teamOrganizationId ? 'teamet' : 'studioet'} uansett.
            </Typography>
          </Box>

          {/* Fortsett-som-medlem kortet */}
          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 2.5,
              background: 'rgba(15,12,28,0.42)',
              border: `1px solid ${PANEL_BORDER}`,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <TeamIcon sx={{ fontSize: 30, color: 'rgba(229,231,235,0.7)' }} />
              <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'rgba(237,233,254,0.92)' }}>
                Fortsett som team-medlem
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.55, mb: 3 }}>
              Du er allerede del av <strong>{membership.role?.label ?? 'teamet'}</strong> og
              har tilgang til klasser, øvinger, video-review og andre verktøy
              som studioet har konfigurert for din rolle. Hvis behovene endres,
              kan du oppgradere senere fra workspace-instillinger.
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              size="large"
              onClick={continueAsTeamMember}
              disabled={submitting}
              sx={{
                color: 'rgba(237,233,254,0.85)',
                borderColor: PANEL_BORDER,
                '&:hover': { borderColor: PURPLE_LIGHT, bgcolor: 'rgba(139,92,246,0.06)' },
                textTransform: 'none',
                fontWeight: 600,
                py: 1.25,
              }}
            >
              Til workspace
            </Button>
          </Box>
        </Box>

        <Typography sx={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', mt: 4 }}>
          Du kan alltids endre senere fra menyen øverst — vi spør deg ikke igjen.
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeToFreelanceDialog;
