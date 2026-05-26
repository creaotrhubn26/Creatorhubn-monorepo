import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import CloseIcon from '@mui/icons-material/Close';
import { migrationsApi, type MigrationsState } from '../../../services/adminRoomApi';

/**
 * Migrate-trigger-kort. Lar produkteier kjøre migrate.sh på prod-backend
 * uten å re-deploye eller SSH-e inn. Container booter med SKIP_BOOT_MIGRATE=1
 * for å unngå port-scan-timeout, og denne knappen kjører migrasjoner manuelt
 * når nye migration-filer er deployet.
 */

const STATUS_COLORS: Record<MigrationsState['status'], string> = {
  idle: '#64748b',
  running: '#fbbf24',
  completed: '#22c55e',
  failed: '#ef4444',
};

export function MigrationsCard() {
  const [state, setState] = useState<MigrationsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await migrationsApi.status();
      setState(s);
      if (s.status === 'running' && !pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const next = await migrationsApi.status();
            setState(next);
            if (next.status !== 'running' && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {
            // stille — neste fetchStatus prøver igjen
          }
        }, 2000);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  async function handleRun() {
    if (!window.confirm('Kjøre migrate.sh nå? Idempotent — applied migrations blir skipped.')) return;
    setError(null);
    try {
      const r = await migrationsApi.run();
      setState(r.state);
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          const next = await migrationsApi.status();
          setState(next);
          if (next.status !== 'running' && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }, 2000);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const status = state?.status ?? 'idle';
  const color = STATUS_COLORS[status];
  const pendingCount = state?.pendingCount ?? 0;
  const hasPending = pendingCount > 0 && status !== 'running';

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: hasPending ? 'rgba(251,146,60,0.08)' : `${color}10`,
        border: `1px solid ${hasPending ? 'rgba(251,146,60,0.4)' : `${color}30`}`,
        mb: 2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <StorageIcon sx={{ color, fontSize: '1.1rem' }} />
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
            Database-migrasjoner
          </Typography>
          <Chip
            label={status}
            size="small"
            sx={{ bgcolor: `${color}22`, color, fontWeight: 700, fontSize: '0.68rem', height: 18 }}
          />
          {hasPending ? (
            <Chip
              label={`${pendingCount} nye venter`}
              size="small"
              sx={{ bgcolor: 'rgba(251,146,60,0.22)', color: '#fb923c', fontWeight: 800, fontSize: '0.68rem', height: 18 }}
            />
          ) : null}
        </Stack>
        <Stack direction="row" spacing={1}>
          {state && state.lastLogLines.length > 0 ? (
            <Button
              size="small"
              variant="text"
              onClick={() => setShowLogs(true)}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'rgba(203,213,225,0.7)', fontSize: '0.75rem' }}
            >
              Vis logg ({state.lastLogLines.length})
            </Button>
          ) : null}
          <Button
            size="small"
            variant="contained"
            disabled={status === 'running'}
            onClick={handleRun}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed', fontSize: '0.78rem' }}
          >
            {status === 'running' ? 'Kjører…' : 'Kjør migrasjoner'}
          </Button>
        </Stack>
      </Stack>

      {state ? (
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
          {state.startedAt ? (
            <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.74rem' }}>
              Startet: {new Date(state.startedAt).toLocaleTimeString('nb-NO')}
              {state.triggeredBy ? ` av ${state.triggeredBy}` : ''}
            </Typography>
          ) : null}
          {state.appliedThisRun > 0 ? (
            <Chip label={`${state.appliedThisRun} applied`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#bbf7d0', fontSize: '0.68rem', height: 18, fontWeight: 700 }} />
          ) : null}
          {state.skippedThisRun > 0 ? (
            <Chip label={`${state.skippedThisRun} skipped`} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: '#cbd5e1', fontSize: '0.68rem', height: 18, fontWeight: 700 }} />
          ) : null}
          {state.exitCode !== null ? (
            <Chip
              label={`exit ${state.exitCode}`}
              size="small"
              sx={{
                bgcolor: state.exitCode === 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
                color: state.exitCode === 0 ? '#bbf7d0' : '#fca5a5',
                fontSize: '0.68rem',
                height: 18,
                fontWeight: 700,
              }}
            />
          ) : null}
        </Stack>
      ) : null}

      {error ? <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert> : null}
      {state?.errorMessage ? <Alert severity="error" sx={{ mt: 1 }}>{state.errorMessage}</Alert> : null}

      <Dialog open={showLogs} onClose={() => setShowLogs(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#0a0a0f', color: '#e2e8f0' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Migrate-logg (siste 200 linjer)</Typography>
          <IconButton onClick={() => setShowLogs(false)} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              fontFamily: '"JetBrains Mono", Menlo, monospace',
              fontSize: '0.74rem',
              lineHeight: 1.5,
              color: 'rgba(226,232,240,0.85)',
              bgcolor: '#0a0a0f',
              maxHeight: '70vh',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {state?.lastLogLines.join('\n') || '(ingen logger)'}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default MigrationsCard;
