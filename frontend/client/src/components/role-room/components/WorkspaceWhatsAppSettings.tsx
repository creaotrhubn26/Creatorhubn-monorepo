import { type FC, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  WhatsApp as WhatsAppIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
  LinkOff as LinkOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  roleRoomWhatsAppApi,
  type RoleRoomWhatsAppConfig,
  type RoleRoomWhatsAppHealth,
} from '../services/castingApiService';
import ConnectWhatsAppDialog from './ConnectWhatsAppDialog';

type WorkspaceWhatsAppSettingsProps = {
  orgKey: string | null;
};

function qualityChipColor(rating: string | null): { bg: string; fg: string } {
  switch ((rating || '').toUpperCase()) {
    case 'GREEN':
    case 'HIGH':
      return { bg: 'rgba(34,197,94,0.18)', fg: '#86efac' };
    case 'YELLOW':
    case 'MEDIUM':
      return { bg: 'rgba(250,204,21,0.18)', fg: '#fde047' };
    case 'RED':
    case 'LOW':
    case 'FLAGGED':
      return { bg: 'rgba(248,113,113,0.18)', fg: '#fecaca' };
    default:
      return { bg: 'rgba(148,163,184,0.18)', fg: '#cbd5e1' };
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '—';
  const diffMs = Date.now() - ts;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s siden`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m siden`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}t siden`;
  const day = Math.round(hr / 24);
  return `${day}d siden`;
}

const WorkspaceWhatsAppSettings: FC<WorkspaceWhatsAppSettingsProps> = ({ orgKey }) => {
  const [config, setConfig] = useState<RoleRoomWhatsAppConfig | null>(null);
  const [health, setHealth] = useState<RoleRoomWhatsAppHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!orgKey) {
        setConfig(null);
        setHealth(null);
        return;
      }
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [cfg, hlt] = await Promise.all([
          roleRoomWhatsAppApi.getConfig(orgKey),
          roleRoomWhatsAppApi.getHealth(orgKey),
        ]);
        setConfig(cfg);
        setHealth(hlt);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunne ikke hente WhatsApp-status');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgKey],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const handleDisconnect = async () => {
    if (!orgKey) return;
    if (!window.confirm('Slett WhatsApp-konfigurasjon for denne bedriften? Audition-reminders via WhatsApp slutter å sendes.')) {
      return;
    }
    setDisconnecting(true);
    try {
      await roleRoomWhatsAppApi.deleteConfig(orgKey);
      await load('refresh');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke koble fra');
    } finally {
      setDisconnecting(false);
    }
  };

  if (!orgKey) {
    return (
      <Box sx={{ p: 1.6, borderRadius: 2, border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.06)' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WhatsAppIcon sx={{ color: '#22c55e', fontSize: 18 }} />
          <Typography sx={{ fontWeight: 700 }}>WhatsApp Business</Typography>
        </Stack>
        <Typography sx={{ mt: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
          Bedrifts-konto må være registrert før du kan koble til WhatsApp.
        </Typography>
      </Box>
    );
  }

  const isConnected = Boolean(config?.hasConfig);
  const qualityColors = qualityChipColor(health?.qualityRating ?? null);
  const lastTpl = health?.lastTemplateStatusEvent;

  return (
    <>
      <Box sx={{ p: 1.6, borderRadius: 2, border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.06)' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <WhatsAppIcon sx={{ color: '#22c55e', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700 }}>WhatsApp Business</Typography>
            {isConnected ? (
              <Chip
                size="small"
                icon={<CheckCircleOutlineIcon sx={{ color: '#86efac !important' }} />}
                label="Koblet"
                sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac', fontWeight: 700 }}
              />
            ) : (
              <Chip
                size="small"
                label="Ikke koblet"
                sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: '#cbd5e1' }}
              />
            )}
          </Stack>
          <Tooltip title="Oppdater status">
            <Button
              size="small"
              onClick={() => load('refresh')}
              disabled={refreshing}
              startIcon={refreshing ? <CircularProgress size={12} /> : <RefreshIcon fontSize="small" />}
              sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 0 }}
            >
              {refreshing ? '' : 'Oppdater'}
            </Button>
          </Tooltip>
        </Stack>

        {error ? (
          <Alert severity="error" sx={{ mt: 1.5, bgcolor: 'rgba(248,113,113,0.1)', color: '#fecaca' }}>
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={20} sx={{ color: '#22c55e' }} />
          </Stack>
        ) : isConnected ? (
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
              <Stack spacing={0.4}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Display name
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{config?.displayName ?? '—'}</Typography>
              </Stack>
              <Stack spacing={0.4}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Phone Number ID
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', color: '#bfdbfe' }}>
                  {config?.phoneNumberMasked ?? '—'}
                </Typography>
              </Stack>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, pt: 0.6 }}>
              <Stack spacing={0.4}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Quality rating
                </Typography>
                <Chip
                  size="small"
                  label={health?.qualityRating ?? 'Ukjent'}
                  sx={{ bgcolor: qualityColors.bg, color: qualityColors.fg, alignSelf: 'flex-start', fontWeight: 700 }}
                />
              </Stack>
              <Stack spacing={0.4}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Events siste 24t
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{health?.eventsLast24h ?? 0}</Typography>
              </Stack>
              <Stack spacing={0.4}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Siste event
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>{relativeTime(health?.lastEventAt ?? null)}</Typography>
              </Stack>
            </Box>

            {lastTpl ? (
              <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>
                  Siste template-status: <strong>{lastTpl.templateName ?? '—'}</strong> → <Chip size="small" label={lastTpl.status ?? '?'} sx={{ height: 18, fontSize: '0.65rem', mx: 0.5 }} /> {relativeTime(lastTpl.at)}
                </Typography>
              </Box>
            ) : null}

            {config?.lastValidationError ? (
              <Alert severity="warning" icon={<ErrorOutlineIcon />} sx={{ bgcolor: 'rgba(250,204,21,0.08)', color: '#fde047' }}>
                {config.lastValidationError}
              </Alert>
            ) : null}

            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 0.5 }}>
              <Button
                size="small"
                onClick={() => setDialogOpen(true)}
                sx={{ color: '#86efac' }}
              >
                Oppdater credentials
              </Button>
              <Button
                size="small"
                onClick={handleDisconnect}
                disabled={disconnecting}
                startIcon={disconnecting ? <CircularProgress size={12} /> : <LinkOffIcon fontSize="small" />}
                sx={{ color: '#fecaca' }}
              >
                Koble fra
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1.2} sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>
              Koble bedriftens egen Meta WhatsApp Business-konto for å sende audition-reminders og produksjonsteam-invitasjoner branded med ditt eget display-navn.
            </Typography>
            <Button
              variant="contained"
              onClick={() => setDialogOpen(true)}
              startIcon={<WhatsAppIcon />}
              sx={{ alignSelf: 'flex-start', bgcolor: '#22c55e', color: '#0f1729', fontWeight: 700, '&:hover': { bgcolor: '#34d399' } }}
            >
              Koble til WhatsApp
            </Button>
          </Stack>
        )}
      </Box>

      <ConnectWhatsAppDialog
        open={dialogOpen}
        orgKey={orgKey}
        onClose={() => setDialogOpen(false)}
        onConnected={() => {
          void load('refresh');
        }}
      />
    </>
  );
};

export default WorkspaceWhatsAppSettings;
