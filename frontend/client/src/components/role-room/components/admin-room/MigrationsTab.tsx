/**
 * MigrationsTab — kjør + polle DB-migrasjoner fra Admin Room
 * uten SSH/CLI/redeploy. Backend: /api/admin-room/migrations/{run,status}
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import authSessionService from '../../services/authSessionService';

type MigrationStatus = 'idle' | 'running' | 'completed' | 'failed';

interface MigrationsState {
  status: MigrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  triggeredBy: string | null;
  lastLogLines: string[];
  exitCode: number | null;
  errorMessage: string | null;
  appliedThisRun: number;
  skippedThisRun: number;
  lockHeld: boolean;
  pendingFiles: string[];
  pendingCount: number;
}

const POLL_INTERVAL_MS = 2000;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: { ...authSessionService.getAuthHeadersSync(), ...(init?.headers || {}) },
  });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return (await resp.json()) as T;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusChip(status: MigrationStatus) {
  switch (status) {
    case 'running':
      return <Chip size="small" color="info" icon={<HourglassEmptyIcon />} label="Kjører" />;
    case 'completed':
      return <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Ferdig" />;
    case 'failed':
      return <Chip size="small" color="error" icon={<ErrorOutlineIcon />} label="Feilet" />;
    default:
      return <Chip size="small" variant="outlined" label="Inaktiv" sx={{ color: 'rgba(203,213,225,0.7)' }} />;
  }
}

export function MigrationsTab(): JSX.Element {
  const [state, setState] = useState<MigrationsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<MigrationsState>('/api/admin-room/migrations/status');
      setState(data);
      return data;
    } catch (e: any) {
      setError(e.message || 'Kunne ikke hente status');
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [load]);

  // Auto-poll mens en kjøring pågår
  useEffect(() => {
    if (!state) return;
    if (state.status === 'running' || state.lockHeld) {
      pollTimerRef.current = setTimeout(() => void load(), POLL_INTERVAL_MS);
      return () => {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      };
    }
  }, [state, load]);

  const handleTrigger = useCallback(async () => {
    if (!window.confirm('Kjøre migrasjoner mot produksjons-DB? Operasjonen kan ikke avbrytes underveis.')) return;
    setTriggering(true);
    setError(null);
    try {
      await fetchJson('/api/admin-room/migrations/run', { method: 'POST' });
      await load();
    } catch (e: any) {
      setError(e.message || 'Kunne ikke starte migrate-run');
    } finally {
      setTriggering(false);
    }
  }, [load]);

  if (loading && !state) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
          Migrasjoner
        </Typography>
        <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem' }}>
          Kjør nye DB-migrasjoner uten å SSH-e eller re-deploye.
          Backend spawn-er <code>migrate.sh</code> og poller progress.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            {state && statusChip(state.status)}
            {state && state.pendingCount > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`${state.pendingCount} pending migrasjon${state.pendingCount === 1 ? '' : 'er'}`}
                sx={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.32)' }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => void load()}
              sx={{ color: '#fff' }}
            >
              Oppdater
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={triggering ? <CircularProgress size={14} /> : <PlayArrowIcon />}
              onClick={() => void handleTrigger()}
              disabled={
                triggering ||
                state?.lockHeld ||
                state?.status === 'running' ||
                (state?.pendingCount ?? 0) === 0
              }
            >
              {triggering ? 'Starter…' : 'Kjør migrasjoner'}
            </Button>
          </Stack>
        </Stack>

        {state?.status === 'running' && (
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress />
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Siste kjøring</Typography>
          <Stack spacing={0.6}>
            <Row label="Triggered av" value={state?.triggeredBy ?? '—'} />
            <Row label="Startet" value={formatDate(state?.startedAt ?? null)} />
            <Row label="Ferdig" value={formatDate(state?.finishedAt ?? null)} />
            <Row label="Exit code" value={state?.exitCode === null || state?.exitCode === undefined ? '—' : String(state.exitCode)} />
            <Row label="Appliert" value={String(state?.appliedThisRun ?? 0)} />
            <Row label="Skippet" value={String(state?.skippedThisRun ?? 0)} />
            {state?.errorMessage && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {state.errorMessage}
              </Alert>
            )}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            Pending migrasjoner ({state?.pendingCount ?? 0})
          </Typography>
          {!state?.pendingFiles?.length ? (
            <Typography sx={{ color: 'rgba(203,213,225,0.6)' }}>Ingen ventende migrasjoner.</Typography>
          ) : (
            <Stack spacing={0.4} sx={{ maxHeight: 240, overflow: 'auto' }}>
              {state.pendingFiles.map((f) => (
                <Typography
                  key={f}
                  sx={{ color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.78rem' }}
                >
                  {f}
                </Typography>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      {(state?.lastLogLines?.length ?? 0) > 0 && (
        <Paper sx={{ p: 2, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            Logg ({state?.lastLogLines.length} linjer)
          </Typography>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.76rem',
              color: 'rgba(226,232,240,0.85)',
              maxHeight: 320,
              overflow: 'auto',
              m: 0,
              p: 0,
            }}
          >
            {state?.lastLogLines.join('\n')}
          </Box>
        </Paper>
      )}
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.84rem' }}>{label}</Typography>
      <Typography sx={{ color: '#fff', fontSize: '0.84rem', fontWeight: 600 }}>{value}</Typography>
    </Stack>
  );
}

export default MigrationsTab;
