/**
 * CustomerSuccessSnapshotCard.tsx
 *
 * Admin-Overblikk-kort som lar manuelt trigge en CS-snapshot-jobb mot alle
 * aktive subscriptions. Snapshot beregner health-score, oppdaterer renewal-
 * pipeline og logger interactions. Vanligvis kjørt av GitHub Actions cron,
 * men admin kan tvinge en kjøring her.
 *
 * Backend: POST /api/admin-room/customer-success/snapshot-all
 * (krever admin-session ELLER x-cron-trigger-token)
 */

import React, { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Snackbar, Stack, Typography,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  PlayArrow as RunIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

interface SnapshotResult {
  processed: number;
  healthChanged: number;
  atRisk: number;
  durationMs: number;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rr_bearer') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CustomerSuccessSnapshotCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SnapshotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true); setError(null);
    const t0 = performance.now();
    try {
      const r = await fetch('/api/admin-room/customer-success/snapshot-all', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error ?? `HTTP ${r.status}`);
        setSnack(`Snapshot feilet: ${body.error ?? r.status}`);
      } else {
        const durationMs = Math.round(performance.now() - t0);
        setResult({
          processed: body.processed ?? 0,
          healthChanged: body.healthChanged ?? 0,
          atRisk: body.atRisk ?? 0,
          durationMs,
        });
        setSnack(`CS-snapshot OK · ${body.processed ?? 0} kunder · ${body.atRisk ?? 0} at-risk`);
      }
    } catch (e) {
      setError(String(e));
      setSnack(`Snapshot feilet: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card sx={{
      bgcolor: 'rgba(96, 165, 250, 0.05)',
      border: '1px solid rgba(96, 165, 250, 0.2)',
    }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InsightsIcon sx={{ color: '#60a5fa' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Customer Success-snapshot
            </Typography>
          </Stack>
          <Chip
            icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
            label="Cron: 08:00 daglig"
            size="small"
            sx={{ bgcolor: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }}
          />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Beregner health-score, oppdaterer renewal-pipeline og logger interactions
          for alle aktive abonnementer. Brukes når man vil tvinge en oppdatering
          utenom daglig cron (f.eks. etter et stort prisendring eller masse-onboarding).
        </Typography>

        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>Snapshot kjørt</strong> ({(result.durationMs / 1000).toFixed(1)}s).
            <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
              {result.processed} kunder behandlet · {result.healthChanged} fikk endret
              health-score · <strong>{result.atRisk} at-risk</strong> krever oppfølging.
            </Box>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        <Button
          variant="contained" onClick={handleRun} disabled={running}
          startIcon={running ? <CircularProgress size={14} /> : <RunIcon />}
          sx={{ bgcolor: '#60a5fa', color: '#0a0a0f', '&:hover': { bgcolor: '#3b82f6' } }}
        >
          {running ? 'Kjører snapshot…' : 'Kjør CS-snapshot nå'}
        </Button>
      </CardContent>
      <Snackbar
        open={!!snack} autoHideDuration={6000}
        onClose={() => setSnack(null)} message={snack}
      />
    </Card>
  );
}
