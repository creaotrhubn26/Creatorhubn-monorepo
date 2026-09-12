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
  Alert, Box,
  Snackbar, Typography,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
} from '@mui/icons-material';
import { AdminCard, AdminButton, StatusChip } from './design-system';

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
    <AdminCard
      title="Customer Success-snapshot"
      action={
        <StatusChip
          tone="info"
          label="Cron: 08:00 daglig"
        />
      }
    >
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

        <AdminButton
          tone="primary" onClick={handleRun} disabled={running}
          loading={running}
          startIcon={<RunIcon />}
        >
          {running ? 'Kjører snapshot…' : 'Kjør CS-snapshot nå'}
        </AdminButton>
      <Snackbar
        open={!!snack} autoHideDuration={6000}
        onClose={() => setSnack(null)} message={snack}
      />
    </AdminCard>
  );
}
