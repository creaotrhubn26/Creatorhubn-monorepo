// @ts-nocheck
/**
 * photographer-wedding-walkthrough.tsx — Slice 9X.36
 *
 * Pre-bryllup sjekkliste. Stine går hit uka før bryllup for å sikre at:
 *   - Lokasjoner er kjent (adresse + venue-info fra katalogen)
 *   - Timeline er ferdig (events med location)
 *   - VIP-kontakter har telefon
 *   - Bilen er registrert, kjøregodtg. estimert
 *   - Værvarsel hentet fra yr.no (api.met.no) for bryllup-dato
 *   - Manuelle ting: batterier ladet, minnekort formatert, utstyr pakket
 *
 * Progress-bar viser klart-prosent. Kritiske issues fremheves rødt.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'wouter';
import {
  Container,
  Box,
  Stack,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as OkIcon,
  Warning as WarnIcon,
  Error as FailIcon,
  RadioButtonUnchecked as PendingIcon,
  RemoveCircleOutline as NaIcon,
  Refresh as RefreshIcon,
  OpenInNew as ExternalIcon,
  AutoAwesome as AutoIcon,
  TouchApp as ManualIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import PlanBManager from '@/components/wedding/PlanBManager';
import WeddingNotificationLog from '@/components/wedding/WeddingNotificationLog';
import { useWeddingWebSocket } from '@/hooks/useWeddingWebSocket';
import Snackbar from '@mui/material/Snackbar';

interface CheckItem {
  key: string;
  label: string;
  description?: string;
  status: 'ok' | 'warn' | 'fail' | 'done' | 'pending' | 'na';
  detail?: string;
  actionLink?: string;
  actionLabel?: string;
}

interface WalkthroughResponse {
  weddingId: string;
  readyPct: number;
  criticalIssues: number;
  autoChecks: CheckItem[];
  manualChecks: CheckItem[];
}

const statusIcon = (status: CheckItem['status']) => {
  switch (status) {
    case 'ok':
    case 'done':
      return <OkIcon sx={{ color: 'success.main' }} />;
    case 'warn':
      return <WarnIcon sx={{ color: 'warning.main' }} />;
    case 'fail':
      return <FailIcon sx={{ color: 'error.main' }} />;
    case 'na':
      return <NaIcon sx={{ color: 'text.disabled' }} />;
    default:
      return <PendingIcon sx={{ color: 'text.disabled' }} />;
  }
};

const PhotographerWeddingWalkthrough: React.FC = () => {
  const params = useParams<{ weddingId: string }>();
  const weddingId = params.weddingId;
  const [data, setData] = useState<WalkthroughResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [planBLocations, setPlanBLocations] = useState<any[]>([]);
  const [snack, setSnack] = useState<string | null>(null);

  // Slice 9X.39 — auto-reload + snackbar når plan B endres av motparten
  const wsUserId = typeof window !== 'undefined' ? (localStorage.getItem('userId') || '') : '';
  useWeddingWebSocket({
    weddingId: weddingId || '',
    userId: wsUserId,
    enabled: !!weddingId && !!wsUserId,
    onEvent: (evt) => {
      if (evt.type === 'plan_b_activated') {
        setSnack(`Plan B aktivert: ${evt.payload?.altLabel || 'ny lokasjon'}`);
        reload();
      } else if (evt.type === 'plan_b_deactivated') {
        setSnack('Plan B avbrutt — tilbake til primær lokasjon');
        reload();
      }
    },
  });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [walk, locs]: any[] = await Promise.all([
        apiRequest(`/api/wedding/${weddingId}/walkthrough`),
        apiRequest(`/api/wedding/${weddingId}/locations-with-alternatives`).catch(() => ({ locations: [] })),
      ]);
      setData(walk);
      const weatherSensitive = (locs?.locations || []).filter((l: any) => l.weatherDependent);
      setPlanBLocations(weatherSensitive);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste sjekkliste');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [weddingId]);

  const toggleManual = async (item: CheckItem) => {
    const nextStatus = item.status === 'done' ? 'pending' : 'done';
    setSavingKey(item.key);
    try {
      await apiRequest(`/api/wedding/${weddingId}/walkthrough/${item.key}`, {
        method: 'POST',
        body: { status: nextStatus },
      });
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const manualChecks = prev.manualChecks.map((m) =>
          m.key === item.key ? { ...m, status: nextStatus as any } : m,
        );
        const all = [...prev.autoChecks, ...manualChecks];
        const okCount = all.filter((c) => c.status === 'ok' || c.status === 'done' || c.status === 'na').length;
        return { ...prev, manualChecks, readyPct: Math.round((okCount / all.length) * 100) };
      });
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke lagre');
    } finally {
      setSavingKey(null);
    }
  };

  const markNa = async (item: CheckItem) => {
    setSavingKey(item.key);
    try {
      await apiRequest(`/api/wedding/${weddingId}/walkthrough/${item.key}`, {
        method: 'POST',
        body: { status: 'na' },
      });
      reload();
    } finally {
      setSavingKey(null);
    }
  };

  const renderCheck = (item: CheckItem, kind: 'auto' | 'manual') => {
    const isInteractive = kind === 'manual';
    return (
      <Paper
        key={item.key}
        variant="outlined"
        sx={{
          p: 2,
          mb: 1,
          borderLeft: 4,
          borderLeftColor:
            item.status === 'ok' || item.status === 'done'
              ? 'success.main'
              : item.status === 'warn'
                ? 'warning.main'
                : item.status === 'fail'
                  ? 'error.main'
                  : 'divider',
          cursor: isInteractive ? 'pointer' : 'default',
          opacity: item.status === 'na' ? 0.6 : 1,
        }}
        onClick={isInteractive ? () => toggleManual(item) : undefined}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ flexShrink: 0 }}>
            {savingKey === item.key ? <CircularProgress size={20} /> : statusIcon(item.status)}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle2" sx={{ textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
                {item.label}
              </Typography>
              {kind === 'auto' && <Chip size="small" label="Auto" icon={<AutoIcon fontSize="small" />} variant="outlined" />}
              {kind === 'manual' && <Chip size="small" label="Manuell" icon={<ManualIcon fontSize="small" />} variant="outlined" />}
            </Stack>
            {item.description && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {item.description}
              </Typography>
            )}
            {item.detail && (
              <Typography
                variant="caption"
                color={item.status === 'fail' ? 'error.main' : item.status === 'warn' ? 'warning.main' : 'text.secondary'}
                sx={{ display: 'block', mt: 0.25 }}
              >
                {item.detail}
              </Typography>
            )}
          </Box>
          {item.actionLink && (
            <Tooltip title={item.actionLabel || 'Åpne'}>
              <IconButton
                size="small"
                href={item.actionLink}
                target={item.actionLink.startsWith('http') ? '_blank' : undefined}
                rel="noopener"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isInteractive && item.status !== 'na' && (
            <Tooltip title="Ikke relevant for dette bryllupet">
              <Button
                size="small"
                color="inherit"
                onClick={(e) => { e.stopPropagation(); markNa(item); }}
              >
                N/A
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Paper>
    );
  };

  if (loading) {
    return (
      <Container sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Ukjent feil'}</Alert>
      </Container>
    );
  }

  const readyColor = data.readyPct === 100 ? 'success' : data.criticalIssues > 0 ? 'error' : 'warning';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Pre-bryllup walkthrough</Typography>
        <Button startIcon={<RefreshIcon />} onClick={reload}>Oppdater</Button>
      </Stack>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Klargjøring</Typography>
          <Typography variant="h6" color={`${readyColor}.main`}>
            {data.readyPct}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={data.readyPct}
          color={readyColor as any}
          sx={{ height: 10, borderRadius: 5 }}
        />
        {data.criticalIssues > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>{data.criticalIssues}</strong> kritisk{data.criticalIssues === 1 ? 'e' : 'e'} sak{data.criticalIssues === 1 ? '' : 'er'} må løses før bryllupet.
          </Alert>
        )}
      </Paper>

      {/* Slice 9X.37 — Plan B-styring inline når værsensitive lokasjoner finnes */}
      {planBLocations.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderLeft: 4, borderLeftColor: 'warning.main' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Plan B for værsensitive lokasjoner</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Aktiver plan B her hvis yr.no melder regn. Alle timeline-events flyttes automatisk.
          </Typography>
          <Stack spacing={1.5}>
            {planBLocations.map((loc) => (
              <Box key={loc.id}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {loc.label} {loc.address && <span style={{ color: '#888', fontWeight: 400 }}>· {loc.address}</span>}
                </Typography>
                <PlanBManager
                  weddingId={weddingId}
                  primaryLocationId={loc.id}
                  alternatives={loc.alternatives || []}
                  onChanged={reload}
                />
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      <Typography variant="h6" sx={{ mb: 1.5, mt: 2 }}>Auto-sjekker</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Beregnes fra eksisterende data (lokasjoner, timeline, kontakter, bil, kjøregodtg., yr.no).
      </Typography>
      {data.autoChecks.map((c) => renderCheck(c, 'auto'))}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 1.5 }}>Manuelle sjekker</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Trykk på en rad for å markere ferdig. N/A hvis det ikke gjelder.
      </Typography>
      {data.manualChecks.map((c) => renderCheck(c, 'manual'))}

      {/* Slice 9X.38 — Varslingslogg */}
      <Box sx={{ mt: 3 }}>
        <WeddingNotificationLog weddingId={weddingId} />
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={6000}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Container>
  );
};

export default PhotographerWeddingWalkthrough;
