/**
 * DashboardPage.tsx — Hjem-skjerm for talent.
 *
 * Mål: Irlin åpner appen og forstår med én gang:
 *   - Hva hun har gjort
 *   - Hvilke nye partnere har sett henne
 *   - Hva neste steg er (hvis profilen er ufullstendig)
 *
 * Stable: ekte data fra partners-overview; defensive fallback i case
 * migrasjoner mangler.
 */

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import GroupIcon from '@mui/icons-material/Group';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ShieldIcon from '@mui/icons-material/Shield';
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type PartnersOverview,
  type RoleRoomTalent,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';
import type { TalentsAppPage } from '../TalentsAppShell';

interface DashboardPageProps {
  demoMode: boolean;
  onNavigate: (page: TalentsAppPage) => void;
}

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

function calcProfileCompleteness(talent: RoleRoomTalent | null): { score: number; missing: string[] } {
  if (!talent) return { score: 0, missing: ['Opprett profil'] };
  const missing: string[] = [];
  if (!talent.headshot_url) missing.push('Headshot');
  if (!talent.showreel_url) missing.push('Showreel');
  if (!talent.bio || talent.bio.length < 40) missing.push('Bio (min 40 tegn)');
  if (!talent.city) missing.push('By');
  if (!talent.playing_age_min || !talent.playing_age_max) missing.push('Spille-alder');
  if (!Array.isArray(talent.skills) || talent.skills.length === 0) missing.push('Ferdigheter');
  if (!Array.isArray(talent.languages) || talent.languages.length === 0) missing.push('Språk');
  const total = 7;
  const score = Math.round(((total - missing.length) / total) * 100);
  return { score: Math.max(0, score), missing };
}

export default function DashboardPage({ demoMode, onNavigate }: DashboardPageProps) {
  const [talent, setTalent] = useState<RoleRoomTalent | null>(null);
  const [overview, setOverview] = useState<PartnersOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [t, o] = await Promise.all([
        demoMode ? Promise.resolve(null) : roleRoomTalentsService.fetchMyTalent(),
        roleRoomTalentsService.fetchPartnersOverview({ demo: demoMode }),
      ]);
      setTalent(t);
      setOverview(o);
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => { void reload(); }, [reload]);

  const completeness = useMemo(() => calcProfileCompleteness(talent ?? (overview?.talent as RoleRoomTalent | null)), [talent, overview]);
  const recentViews = (overview?.feed ?? []).filter((f) => f.kind === 'access').slice(0, 4);
  const activePartners = overview?.stats?.activePartners ?? 0;

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <CircularProgress size={20} sx={{ color: palette.accentBright }} />
        <Typography sx={{ color: palette.textSecondary }}>Laster inn…</Typography>
      </Box>
    );
  }

  const displayName = talent?.display_name || overview?.talent?.display_name || 'der';
  const firstName = displayName.split(/\s+/)[0];

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15 }}>
            Hei, {firstName} 👋
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem', mt: 0.6 }}>
            {activePartners > 0
              ? `Du har ${activePartners} aktive partnere. Her er hva som skjer.`
              : 'Velkommen til The Role Room Talents.'}
          </Typography>
        </Box>
      </Stack>

      {demoMode ? (
        <Alert
          severity="info"
          sx={{ mb: 3, bgcolor: 'rgba(168,85,247,0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.accentBright } }}
        >
          Du ser demo-data. Klikk <strong>Logg inn</strong> oppe til høyre for å bruke din egen profil.
        </Alert>
      ) : null}

      {/* Profile completeness — hvis ikke 100% */}
      {completeness.score < 100 && !demoMode ? (
        <Box sx={{ ...cardSx, mb: 2.4, borderColor: palette.borderStrong }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Stack spacing={1} sx={{ flexGrow: 1 }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.05rem' }}>
                Profilen din er {completeness.score}% klar
              </Typography>
              <LinearProgress
                variant="determinate"
                value={completeness.score}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(168,85,247,0.12)',
                  '& .MuiLinearProgress-bar': { background: palette.accentGradient },
                }}
              />
              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                {completeness.missing.slice(0, 6).map((m) => (
                  <Chip key={m} label={m} size="small" sx={{
                    bgcolor: 'rgba(245, 158, 11, 0.14)', color: palette.warning,
                    fontWeight: 600, fontSize: '0.72rem', height: 22,
                  }} />
                ))}
              </Stack>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mt: 0.6 }}>
                Partnerne ser bare det du har fylt ut. Mer info = bedre matches.
              </Typography>
            </Stack>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => onNavigate('profiles')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                px: 2.4,
                py: 1.1,
                borderRadius: radius.sm,
                background: palette.accentGradient,
                color: '#fff',
              }}
            >
              Fyll ut profilen
            </Button>
          </Stack>
        </Box>
      ) : null}

      {/* 3 kjapp-kort */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <QuickCard
          Icon={GroupIcon}
          label="Aktive partnere"
          value={String(activePartners)}
          desc="Partnere som har tilgang til profilen din"
          onClick={() => onNavigate('partners')}
          ctaText="Administrer →"
        />
        <QuickCard
          Icon={VisibilityIcon}
          label="Sett av partnere"
          value={String(recentViews.length)}
          desc="Visninger siste 30 dager"
          onClick={() => onNavigate('audit')}
          ctaText="Vis aktivitet →"
        />
        <QuickCard
          Icon={HourglassEmptyIcon}
          label="Ventende invitasjoner"
          value={String(overview?.stats?.pendingRequests ?? 0)}
          desc="Partnere som ikke har svart ennå"
          onClick={() => onNavigate('partners')}
          ctaText="Se alle →"
        />
      </Box>

      {/* Siste aktivitet */}
      <Box sx={cardSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>
            Siste aktivitet
          </Typography>
          <Button
            onClick={() => onNavigate('audit')}
            sx={{ textTransform: 'none', color: palette.accentBright, fontWeight: 600, fontSize: '0.85rem' }}
          >
            Vis alt →
          </Button>
        </Stack>
        {recentViews.length === 0 ? (
          <Typography sx={{ color: palette.textMuted, py: 2 }}>
            Ingen aktivitet ennå. Når en partner ser profilen din, dukker det opp her.
          </Typography>
        ) : (
          <Stack spacing={1.2}>
            {recentViews.map((view) => (
              <Stack
                key={view.id}
                direction="row"
                spacing={1.4}
                alignItems="center"
                sx={{ p: 1.4, borderRadius: radius.sm, bgcolor: palette.bgCardElevated }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(168,85,247,0.18)', color: palette.accentBright }}>
                  <CheckCircleIcon fontSize="small" />
                </Avatar>
                <Stack spacing={0.2} sx={{ flexGrow: 1 }}>
                  <Typography sx={{ color: palette.textPrimary, fontSize: '0.9rem' }}>
                    {view.display_name || 'En partner'} så profilen din.
                  </Typography>
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                    {new Date(view.occurred_at).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      {/* GDPR-trygghet */}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 2.4, color: palette.textMuted, fontSize: '0.82rem' }}>
        <ShieldIcon sx={{ fontSize: 18, color: palette.success }} />
        <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
          Du eier all data. Vi deler ingenting uten ditt eksplisitte samtykke. EU/EEA-lagring.
        </Typography>
      </Stack>
    </Box>
  );
}

interface QuickCardProps {
  Icon: React.ComponentType<{ sx?: object }>;
  label: string;
  value: string;
  desc: string;
  onClick: () => void;
  ctaText: string;
}

function QuickCard({ Icon, label, value, desc, onClick, ctaText }: QuickCardProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        ...cardSx,
        cursor: 'pointer',
        transition: 'all 0.12s',
        '&:hover': { borderColor: palette.borderStrong, transform: 'translateY(-2px)' },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 500, mb: 0.6 }}>{label}</Typography>
          <Typography sx={{ color: palette.textPrimary, fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
        </Box>
        <Box sx={{ width: 36, height: 36, borderRadius: radius.sm, bgcolor: 'rgba(168, 85, 247, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon sx={{ color: palette.accentBright, fontSize: 18 }} />
        </Box>
      </Stack>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 1.4 }}>{desc}</Typography>
      <Typography sx={{ color: palette.accentBright, fontSize: '0.82rem', fontWeight: 600, mt: 1 }}>{ctaText}</Typography>
    </Box>
  );
}
