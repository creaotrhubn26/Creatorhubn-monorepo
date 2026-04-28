/**
 * InviteLandingPage — public landing for /dance/invite/:token.
 *
 * Slår opp invite via API. Hvis bruker er innlogget → vis "Aksepter"-knapp.
 * Hvis ikke → redirect til /login med returnUrl=/dance/invite/<token> så
 * vi kommer hit igjen etter login. Backend krever auth for både GET og
 * POST på /api/dance/invites/:token, så vi kan ikke vise team-info før
 * brukeren er innlogget.
 */

import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Stack,
  Alert,
  Paper,
} from '@mui/material';
import { GroupsOutlined as TeamIcon } from '@mui/icons-material';
import { useLocation } from 'wouter';
import * as svc from './danceTeamService';
import type { DanceTeamInvite } from './danceTeamService';

const PURPLE_BRIGHT = '#8b5cf6';
const PURPLE_DEEP   = '#4c1d95';
const PURPLE_LIGHT  = '#a78bfa';
const TEXT_DIM      = 'rgba(229,231,235,0.78)';

interface Props {
  token: string;
}

function isLoggedIn(): boolean {
  const t = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  return Boolean(t && t.trim());
}

export const InviteLandingPage: React.FC<Props> = ({ token }) => {
  const [, navigate] = useLocation();
  const [invite, setInvite] = React.useState<DanceTeamInvite | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [accepting, setAccepting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);

  React.useEffect(() => {
    if (!isLoggedIn()) {
      const ret = encodeURIComponent(`/dance/invite/${token}`);
      navigate(`/login?returnTo=${ret}`);
      return;
    }
    void (async () => {
      try {
        const inv = await svc.getInviteByToken(token);
        setInvite(inv);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke hente invitasjon');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const r = await svc.acceptInvite(token);
      setAccepted(true);
      // Redirect til dance workspace etter et kort delay
      setTimeout(() => {
        navigate(`/?mode=dance_studio&team=${encodeURIComponent(r.teamOrganizationId)}`);
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke akseptere invitasjon');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <CenteredPanel><CircularProgress sx={{ color: PURPLE_LIGHT }} /></CenteredPanel>;
  }

  if (error || !invite) {
    return (
      <CenteredPanel>
        <Alert severity="error" sx={{ width: '100%' }}>
          {error ?? 'Invitasjonen finnes ikke eller er utløpt.'}
        </Alert>
      </CenteredPanel>
    );
  }

  if (accepted) {
    return (
      <CenteredPanel>
        <Stack alignItems="center" spacing={2}>
          <TeamIcon sx={{ fontSize: 56, color: PURPLE_LIGHT }} />
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'rgba(237,233,254,0.95)' }}>
            Velkommen til teamet!
          </Typography>
          <Typography sx={{ fontSize: 13, color: TEXT_DIM }}>Tar deg til workspace…</Typography>
        </Stack>
      </CenteredPanel>
    );
  }

  return (
    <CenteredPanel>
      <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', maxWidth: 460 }}>
        <TeamIcon sx={{ fontSize: 48, color: PURPLE_LIGHT }} />
        <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
          DANSESTUDIO · INVITASJON
        </Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'rgba(237,233,254,0.95)', lineHeight: 1.2 }}>
          Du er invitert til å bli med
        </Typography>
        <Typography sx={{ fontSize: 14, color: TEXT_DIM }}>
          som <Box component="span" sx={{ color: PURPLE_LIGHT, fontWeight: 700 }}>{invite.invitedRoleLabel ?? 'medlem'}</Box> i et dansestudio på CreatorHub.
        </Typography>
        <Typography sx={{ fontSize: 12, color: TEXT_DIM }}>
          Invitasjonen er sendt til <strong>{invite.invitedEmail}</strong> og utløper{' '}
          {new Date(invite.expiresAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={accept}
          disabled={accepting}
          sx={{
            mt: 2,
            bgcolor: PURPLE_BRIGHT,
            '&:hover': { bgcolor: PURPLE_DEEP },
            textTransform: 'none',
            fontWeight: 700,
            px: 4,
            py: 1.25,
          }}
        >
          {accepting ? 'Aksepterer…' : 'Aksepter og bli medlem'}
        </Button>
      </Stack>
    </CenteredPanel>
  );
};

const CenteredPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
        border: '1px solid rgba(167,139,250,0.18)',
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

export default InviteLandingPage;
