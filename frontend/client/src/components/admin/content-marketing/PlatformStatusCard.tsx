import { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  platformStatusApi,
  type PlatformStatusResponse,
  type ProviderHealth,
} from '../../../services/adminRoomApi';

/**
 * Plattform-status-kort — én sentral oversikt over alle eksterne tjenester
 * (Render, Neon, Vercel, Stripe, Anthropic) + aktive innloggede Role Room-
 * brukere. Refresher hvert 30. sekund. Hver leverandør har klikk-til-dashboard.
 */

const HEALTH_COLORS: Record<ProviderHealth, string> = {
  ok: '#22c55e',
  warning: '#fbbf24',
  error: '#ef4444',
  unconfigured: '#64748b',
};

const HEALTH_LABELS: Record<ProviderHealth, string> = {
  ok: 'OK',
  warning: 'Advarsel',
  error: 'Feil',
  unconfigured: 'Mangler config',
};

function relativeMinutes(minutes: number): string {
  if (minutes < 1) return 'akkurat nå';
  if (minutes < 60) return `${minutes}m siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}t siden`;
  return `${Math.round(hours / 24)}d siden`;
}

export function PlatformStatusCard() {
  const [data, setData] = useState<PlatformStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await platformStatusApi.fetch();
      setData(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: 'rgba(15,23,42,0.5)',
        border: '1px solid rgba(148,163,184,0.14)',
        mb: 3,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
            Plattform-status — alt på ett sted
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem' }}>
            Sanntid fra Render, Neon, Vercel, Stripe, Anthropic + aktive Role Room-brukere.
            {data?.checkedAt ? ` Oppdatert ${new Date(data.checkedAt).toLocaleTimeString('nb-NO')}.` : ''}
          </Typography>
        </Box>
        <Tooltip title="Hent på nytt">
          <IconButton onClick={refresh} disabled={loading} size="small">
            <RefreshIcon sx={{ color: '#c4b5fd' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {error ? (
        <Typography sx={{ color: '#fca5a5', fontSize: '0.85rem', mb: 1.5 }}>
          {error}
        </Typography>
      ) : null}

      {data ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(5, 1fr)' },
              gap: 1.25,
              mb: 2,
            }}
          >
            {(Array.isArray(data.providers) ? data.providers : []).map((p) => (
              <Box
                key={p.provider}
                component="a"
                href={p.dashboardUrl}
                target="_blank"
                rel="noreferrer noopener"
                sx={{
                  display: 'block',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: `${HEALTH_COLORS[p.health]}10`,
                  border: `1px solid ${HEALTH_COLORS[p.health]}40`,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: `${HEALTH_COLORS[p.health]}1c`, transform: 'translateY(-1px)' },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: HEALTH_COLORS[p.health], boxShadow: `0 0 8px ${HEALTH_COLORS[p.health]}80` }} />
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', flex: 1 }}>
                    {p.provider}
                  </Typography>
                  <OpenInNewIcon sx={{ color: 'rgba(203,213,225,0.5)', fontSize: '0.85rem' }} />
                </Stack>
                <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.74rem', lineHeight: 1.4, mb: 0.5 }}>
                  {p.message}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                  {Object.entries(p.metrics).slice(0, 4).map(([k, v]) => (
                    <Chip
                      key={k}
                      label={`${k}: ${v}`}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(148,163,184,0.12)',
                        color: 'rgba(203,213,225,0.85)',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        height: 18,
                      }}
                    />
                  ))}
                </Stack>
                <Typography sx={{ color: HEALTH_COLORS[p.health], fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, mt: 0.5 }}>
                  {HEALTH_LABELS[p.health]}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: data.presence.activeNow > 0 ? '#22c55e' : '#64748b',
                    boxShadow: data.presence.activeNow > 0 ? '0 0 10px #22c55e80' : 'none',
                    animation: data.presence.activeNow > 0 ? 'pulse 2s infinite' : 'none',
                  }}
                />
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                  {data.presence.activeNow} pålogget nå
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.78rem' }}>
                  · {data.presence.activeLast24h} aktive siste 24t · {data.presence.activeLast7d} siste 7d · {data.presence.totalRoleRoomUsers} totalt
                </Typography>
              </Stack>
              <Chip
                label="Live heartbeat · 30s ping · 90s window"
                size="small"
                sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: '#bbf7d0', fontSize: '0.68rem', fontWeight: 600 }}
              />
            </Stack>
            {(Array.isArray(data.presence?.recentUsers) ? data.presence.recentUsers : []).length > 0 ? (
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                {(Array.isArray(data.presence?.recentUsers) ? data.presence.recentUsers : []).map((user) => {
                  const initials = (user.name || user.email || '?')
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0]?.toUpperCase() ?? '')
                    .join('') || '?';
                  const isActive = user.minutesAgo < 2 && !user.isIdle;
                  const isRecentlyIdle = user.isIdle && user.minutesAgo < 30;
                  const tooltipParts = [
                    user.name ?? user.email ?? user.id,
                    user.profession,
                    user.currentRoute ? `på ${user.currentRoute}` : null,
                    user.userAgentShort,
                    user.isIdle ? '⏸️ idle' : null,
                    `sist ${relativeMinutes(user.minutesAgo)}`,
                  ].filter(Boolean).join(' · ');
                  return (
                    <Tooltip
                      key={user.id}
                      title={tooltipParts}
                    >
                      <Box sx={{ position: 'relative' }}>
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            bgcolor: isActive ? 'rgba(34,197,94,0.25)' : isRecentlyIdle ? 'rgba(251,191,36,0.18)' : 'rgba(148,163,184,0.2)',
                            color: isActive ? '#bbf7d0' : isRecentlyIdle ? '#fde68a' : '#cbd5e1',
                            border: `2px solid ${isActive ? '#22c55e' : isRecentlyIdle ? '#fbbf24' : 'rgba(148,163,184,0.3)'}`,
                          }}
                        >
                          {initials}
                        </Avatar>
                        {isActive || isRecentlyIdle ? (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: -1,
                              right: -1,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: isActive ? '#22c55e' : '#fbbf24',
                              border: '2px solid #0a0a0f',
                            }}
                          />
                        ) : null}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Stack>
            ) : (
              <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.78rem' }}>
                Ingen brukere med registrert innlogging enda.
              </Typography>
            )}
          </Box>
        </>
      ) : (
        <Typography sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 3, fontSize: '0.88rem' }}>
          Henter status …
        </Typography>
      )}
    </Box>
  );
}

export default PlatformStatusCard;
