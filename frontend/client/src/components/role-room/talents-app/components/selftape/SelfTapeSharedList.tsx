/**
 * SelfTapeSharedList — talentens "Mine delte self-tapes"-oversikt.
 *
 * Brukes i ProfilePage / AuditPage. Viser per submission:
 *  - hvem som har tilgang
 *  - status (sendt / sett / shortlistet / revokert)
 *  - view_count + last_viewed_at
 *  - knapper for å revoke eller åpne private lenke
 *
 * Bygd over /api/role-room/talents/selftapes/shared.
 */
import {
  Alert, Box, Button, CircularProgress, Stack, Tooltip, Typography,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { useCallback, useEffect, useState } from 'react';

import { palette, radius } from '../../theme';
import {
  externalProviderLabel,
  listSharedSubmissions,
  publicSelftapeUrl,
  revokeSubmission,
  type SelftapeSharedItem,
} from '../../../services/roleRoomSelfTapesService';

export default function SelfTapeSharedList() {
  const [shared, setShared] = useState<SelftapeSharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { shared } = await listSharedSubmissions();
      setShared(shared);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å hente delinger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRevoke = async (item: SelftapeSharedItem) => {
    const reason = window.prompt(
      `Trekk tilbake tilgangen til ${labelFor(item)}?\n\nValgfri begrunnelse:`,
      '',
    );
    if (reason === null) return;
    setBusyId(item.id);
    try {
      await revokeSubmission(item.id, reason || undefined);
      setInfo('Tilgangen er trukket tilbake. Det kan ta noen sekunder før byrået ser endringen.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å revoke');
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyLink = async (item: SelftapeSharedItem) => {
    if (!item.private_token) return;
    try {
      await navigator.clipboard.writeText(publicSelftapeUrl(item.private_token));
      setInfo('Lenken er kopiert til utklippstavlen');
    } catch {
      setInfo('Kunne ikke kopiere — bruk Ctrl+C manuelt');
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={22} sx={{ color: palette.accentBright }} />
      </Box>
    );
  }

  if (shared.length === 0) {
    return (
      <Box
        sx={{
          bgcolor: palette.bgCard,
          border: `1px dashed ${palette.borderSubtle}`,
          borderRadius: radius.lg,
          p: 3,
          textAlign: 'center',
        }}
      >
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 0.6 }}>
          Du har ikke delt noen self-tapes ennå
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
          Når du sender en self-tape til byrå eller rolle, vises de her med revoke-knapp.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.4}>
      {info ? <Alert severity="info" onClose={() => setInfo(null)}>{info}</Alert> : null}
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {shared.map((s) => {
        const Icon = iconFor(s.target_type);
        const isRevoked = s.status === 'revoked' || !!s.revoked_at;
        return (
          <Box
            key={s.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr auto' },
              gap: 1.6,
              alignItems: 'center',
              p: 2,
              bgcolor: palette.bgCard,
              border: `1px solid ${isRevoked ? palette.borderSubtle : palette.border}`,
              borderRadius: radius.lg,
              opacity: isRevoked ? 0.66 : 1,
            }}
          >
            {/* Thumbnail */}
            <Box
              sx={{
                width: 96,
                aspectRatio: '16 / 9',
                bgcolor: '#000',
                borderRadius: radius.sm,
                backgroundImage: s.thumbnail_url ? `url(${s.thumbnail_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.7rem',
              }}
            >
              {!s.thumbnail_url ? `Take ${s.take_number ?? '?'}` : null}
            </Box>

            {/* Tekst */}
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4 }}>
                <Icon sx={{ color: palette.accentBright, fontSize: 16 }} />
                <Typography sx={{ fontWeight: 700, color: palette.textPrimary }} noWrap>
                  {labelFor(s)}
                </Typography>
                <StatusChip status={s.status} />
              </Stack>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                {s.selftape_project_name}
                {s.source_provider && s.source_provider !== 'cloudflare_stream'
                  ? ` · ${externalProviderLabel(s.source_provider)}`
                  : ''}
              </Typography>
              <Stack direction="row" spacing={2.4} sx={{ mt: 0.6, flexWrap: 'wrap', gap: 1 }}>
                <Metric Icon={VisibilityOutlinedIcon} label={`${s.view_count} ${s.view_count === 1 ? 'visning' : 'visninger'}`} />
                {s.last_viewed_at ? (
                  <Metric label={`Sist sett ${formatWhen(s.last_viewed_at)}`} />
                ) : null}
                {s.status === 'shortlisted' ? (
                  <Metric Icon={StarRateRoundedIcon} label="Shortlistet" color="#fbbf24" />
                ) : null}
                {isRevoked ? (
                  <Metric
                    Icon={BlockOutlinedIcon}
                    label={`Revokert ${s.revoked_at ? formatWhen(s.revoked_at) : ''}`}
                    color="#f87171"
                  />
                ) : null}
              </Stack>
              {s.revoke_reason ? (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.4, fontStyle: 'italic' }}>
                  Begrunnelse: {s.revoke_reason}
                </Typography>
              ) : null}
            </Box>

            {/* Actions */}
            <Stack spacing={0.8} sx={{ minWidth: 140 }}>
              {s.target_type === 'private_link' && s.private_token && !isRevoked ? (
                <Tooltip title="Kopier lenke">
                  <Button
                    onClick={() => handleCopyLink(s)}
                    startIcon={<ContentCopyOutlinedIcon />}
                    size="small"
                    sx={{
                      textTransform: 'none',
                      color: palette.accentBright,
                      borderRadius: radius.sm,
                      fontSize: '0.78rem',
                    }}
                  >
                    Kopier
                  </Button>
                </Tooltip>
              ) : null}
              {!isRevoked ? (
                <Button
                  onClick={() => handleRevoke(s)}
                  disabled={busyId === s.id}
                  startIcon={<BlockOutlinedIcon />}
                  size="small"
                  sx={{
                    textTransform: 'none',
                    color: '#f87171',
                    border: `1px solid rgba(248,113,113,0.32)`,
                    borderRadius: radius.sm,
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    '&:hover': { bgcolor: 'rgba(248,113,113,0.08)' },
                  }}
                >
                  {busyId === s.id ? 'Revoker …' : 'Trekk tilbake'}
                </Button>
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

function iconFor(t: string) {
  if (t === 'agency_direct') return BusinessOutlinedIcon;
  if (t === 'private_link') return LinkOutlinedIcon;
  return RecordVoiceOverOutlinedIcon;
}

function labelFor(s: SelftapeSharedItem): string {
  if (s.target_type === 'agency_direct') return s.agency_name ?? 'Byrå';
  if (s.target_type === 'private_link') return 'Privat lenke';
  return s.casting_project_name
    ? `${s.casting_project_name}${s.casting_role_name ? ` · ${s.casting_role_name}` : ''}`
    : 'Rolle-spesifikk';
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    draft:       { bg: 'rgba(255,255,255,0.08)', fg: '#94a3b8', label: 'Kladd' },
    ready:       { bg: 'rgba(168,85,247,0.18)', fg: '#c084fc', label: 'Klar' },
    submitted:   { bg: 'rgba(168,85,247,0.18)', fg: '#c084fc', label: 'Sendt' },
    viewed:      { bg: 'rgba(96,165,250,0.18)', fg: '#60a5fa', label: 'Sett' },
    shortlisted: { bg: 'rgba(251,191,36,0.18)', fg: '#fbbf24', label: 'Shortlistet' },
    passed:      { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', label: 'Forbigått' },
    revoked:     { bg: 'rgba(248,113,113,0.18)', fg: '#f87171', label: 'Revokert' },
  };
  const tone = map[status] ?? { bg: 'rgba(255,255,255,0.08)', fg: '#94a3b8', label: status };
  return (
    <Box
      sx={{
        bgcolor: tone.bg,
        color: tone.fg,
        fontWeight: 700,
        fontSize: '0.7rem',
        px: 1,
        py: 0.2,
        borderRadius: 999,
      }}
    >
      {tone.label}
    </Box>
  );
}

function Metric({
  Icon, label, color,
}: {
  Icon?: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  label: string;
  color?: string;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.4}>
      {Icon ? <Icon sx={{ color: color ?? palette.textMuted, fontSize: 12 }} /> : null}
      <Typography sx={{ color: color ?? palette.textMuted, fontSize: '0.78rem' }}>
        {label}
      </Typography>
    </Stack>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'akkurat nå';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min siden`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} t siden`;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}
