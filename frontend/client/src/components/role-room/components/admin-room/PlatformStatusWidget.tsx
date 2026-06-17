/**
 * PlatformStatusWidget — health-glimt på Render / Neon / Vercel / Stripe / Anthropic
 * + live user-presence. Brukes i DashboardTab i AdminRoom.
 *
 * Backend: GET /api/admin-room/platform-status
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import authSessionService from '../../services/authSessionService';

type Health = 'ok' | 'warning' | 'error' | 'unconfigured';

interface ProviderStatus {
  name: string;
  health: Health;
  detail?: string;
  message?: string;
}

interface PresenceInfo {
  activeUsers?: number;
  signinsLast24h?: number;
}

interface PlatformStatusResponse {
  overall: Health;
  summary: { okCount: number; warningCount: number; errorCount: number; unconfiguredCount: number };
  providers: ProviderStatus[];
  presence: PresenceInfo;
  checkedAt: string;
}

function healthIcon(health: Health) {
  switch (health) {
    case 'ok':
      return <CheckCircleOutlineIcon fontSize="small" sx={{ color: '#34d399' }} />;
    case 'warning':
      return <WarningAmberIcon fontSize="small" sx={{ color: '#fbbf24' }} />;
    case 'error':
      return <ErrorOutlineIcon fontSize="small" sx={{ color: '#f87171' }} />;
    default:
      return <HelpOutlineIcon fontSize="small" sx={{ color: 'rgba(203,213,225,0.5)' }} />;
  }
}

function healthLabel(health: Health): string {
  switch (health) {
    case 'ok': return 'OK';
    case 'warning': return 'Advarsel';
    case 'error': return 'Feil';
    default: return 'Ikke konfigurert';
  }
}

export function PlatformStatusWidget(): JSX.Element {
  const [status, setStatus] = useState<PlatformStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin-room/platform-status', {
        headers: authSessionService.getAuthHeadersSync(),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as PlatformStatusResponse;
      setStatus(data);
    } catch (e: any) {
      setError(e.message || 'Klarte ikke å hente status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overallTone =
    status?.overall === 'error'
      ? { bg: 'rgba(248,113,113,0.14)', fg: '#fca5a5', border: 'rgba(248,113,113,0.34)' }
      : status?.overall === 'warning'
        ? { bg: 'rgba(251,191,36,0.12)', fg: '#fbbf24', border: 'rgba(251,191,36,0.32)' }
        : { bg: 'rgba(52,211,153,0.10)', fg: '#34d399', border: 'rgba(52,211,153,0.28)' };

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: `1px solid ${status ? overallTone.border : 'rgba(148,163,184,0.18)'}`,
        background: status ? overallTone.bg : 'rgba(15,23,42,0.42)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ color: '#fff', fontWeight: 800 }}>Plattform-status</Typography>
          {status && (
            <Chip
              size="small"
              icon={healthIcon(status.overall)}
              label={healthLabel(status.overall)}
              sx={{ background: 'transparent', color: overallTone.fg, fontWeight: 700 }}
            />
          )}
        </Stack>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void load()} disabled={loading} sx={{ color: '#fff' }}>
            {loading ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1, bgcolor: 'rgba(248,113,113,0.08)' }}>
          {error}
        </Alert>
      )}

      {status && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 0.8, mb: 1 }}>
            {status.providers.map((p) => (
              <Stack
                key={p.name}
                direction="row"
                alignItems="center"
                spacing={0.8}
                sx={{
                  p: 0.8,
                  borderRadius: 1,
                  background: 'rgba(15,23,42,0.32)',
                  border: '1px solid rgba(148,163,184,0.10)',
                }}
              >
                {healthIcon(p.health)}
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.1 }}>
                    {p.name}
                  </Typography>
                  {(p.detail || p.message) && (
                    <Typography
                      sx={{
                        color: 'rgba(203,213,225,0.7)',
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.detail || p.message}
                    </Typography>
                  )}
                </Box>
              </Stack>
            ))}
          </Box>

          <Stack direction="row" spacing={2} sx={{ pt: 1, borderTop: '1px solid rgba(148,163,184,0.10)' }}>
            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.78rem' }}>
              {status.summary.okCount} OK · {status.summary.warningCount} advarsler · {status.summary.errorCount} feil
              {status.summary.unconfiguredCount > 0 ? ` · ${status.summary.unconfiguredCount} ukonfigurert` : ''}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {status.presence.activeUsers !== undefined && (
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.78rem' }}>
                {status.presence.activeUsers} aktive nå
                {status.presence.signinsLast24h !== undefined ? ` · ${status.presence.signinsLast24h} pålogginger 24t` : ''}
              </Typography>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
}

export default PlatformStatusWidget;
