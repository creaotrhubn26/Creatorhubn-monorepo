/**
 * RoleRoomBillingAlertsPanel — admin ser Stripe-sync-feil og kan markere
 * som løst etter å ha rettet Stripe-state manuelt.
 *
 * Brukes når soft-delete eller reactivate ikke fikk oppdatert Stripe-
 * quantity (f.eks. Stripe nede, subscription cancelled mid-flight,
 * config-feil). Admin må da reagere så vi ikke fakturerer feil.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import { CheckCircle, OpenInNew, PlayArrow, Refresh, Sync } from '@mui/icons-material';

interface BillingAlert {
  id: number;
  projectId: string;
  projectName: string | null;
  ownerUserId: string;
  ownerEmail: string | null;
  actorUserId: string;
  actorEmail: string | null;
  kind: string;
  detail: string;
  stripeSubscriptionId: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolvedByEmail: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${url}: ${res.status} ${detail || res.statusText}`.trim());
  }
  return (await res.json()) as T;
}

const KIND_LABELS: Record<string, string> = {
  stripe_sync_failed: 'Stripe-sync feilet',
  missing_subscription_item: 'Subscription mangler items',
  no_active_subscription: 'Ingen aktiv subscription',
};

export function RoleRoomBillingAlertsPanel() {
  const [alerts, setAlerts] = useState<BillingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);

  const [resolveTarget, setResolveTarget] = useState<BillingAlert | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [retrying, setRetrying] = useState<number | null>(null);
  const [retryResult, setRetryResult] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState<'dry' | 'apply' | null>(null);
  const [reconcileSummary, setReconcileSummary] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await jsonRequest<{ alerts: BillingAlert[] }>(
        `/api/admin-room/role-room/billing-alerts?status=${showResolved ? 'all' : 'unresolved'}`,
      );
      setAlerts(data.alerts);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [showResolved]);

  const handleReconcile = async (mode: 'dry' | 'apply') => {
    if (mode === 'apply' && !confirm('Kjør reconciliation med apply=true — dette vil oppdatere Stripe-quantity for ALLE drift som finnes. Sikker?')) return;
    setReconciling(mode); setError(null); setReconcileSummary(null);
    try {
      const data = await jsonRequest<{
        scannedOwners: number; driftCount: number;
        totalDriftMagnitude: number; mode: string;
      }>(
        `/api/admin-room/role-room/reconcile-seats?apply=${mode === 'apply'}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setReconcileSummary(
        `Reconciliation ${data.mode}: skannet ${data.scannedOwners} eiere, fant ${data.driftCount} med drift (total magnitude ${data.totalDriftMagnitude} seats).`,
      );
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setReconciling(null);
    }
  };

  const handleRetrySync = async (alert: BillingAlert) => {
    setRetrying(alert.id); setError(null); setRetryResult(null);
    try {
      const data = await jsonRequest<{
        ok: boolean; reason?: string;
        previousQuantity?: number; newQuantity?: number;
      }>(
        `/api/admin-room/role-room/billing-alerts/${alert.id}/retry-sync`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      if (data.ok) {
        setRetryResult(
          `Sync OK — Stripe-quantity ${data.previousQuantity} → ${data.newQuantity}. Alert er auto-løst.`,
        );
        await load();
      } else {
        setError(`Retry feilet: ${data.reason ?? 'ukjent'}. Alerten forblir åpen.`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRetrying(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setResolving(resolveTarget.id);
    setError(null);
    try {
      await jsonRequest(
        `/api/admin-room/role-room/billing-alerts/${resolveTarget.id}/resolve`,
        { method: 'POST', body: JSON.stringify({ note: resolveNote }) },
      );
      setResolveTarget(null); setResolveNote('');
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setResolving(null);
    }
  };

  const unresolvedCount = alerts.filter(a => !a.resolvedAt).length;

  return (
    <Box sx={{ p: 3, overflow: 'auto', flex: 1, color: 'rgba(255,255,255,0.87)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Billing-alerts</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Stripe-sync-feil fra Role Room seat-management. Disse må håndteres
            manuelt så ikke kunder over- eller underfaktureres.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<Sync />} onClick={() => void handleReconcile('dry')}
                  disabled={reconciling != null}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {reconciling === 'dry' ? 'Sjekker …' : 'Reconcile (dry-run)'}
          </Button>
          <Button startIcon={<Sync />} onClick={() => void handleReconcile('apply')}
                  disabled={reconciling != null}
                  variant="outlined"
                  sx={{ color: '#fca5a5', borderColor: 'rgba(252,165,165,0.4)' }}>
            {reconciling === 'apply' ? 'Bumper …' : 'Reconcile + apply'}
          </Button>
          <Button startIcon={<Refresh />} onClick={load} disabled={loading}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Oppdater
          </Button>
          <Button onClick={() => setShowResolved(s => !s)}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {showResolved ? 'Skjul løste' : 'Vis løste også'}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {retryResult && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRetryResult(null)}>{retryResult}</Alert>}
      {reconcileSummary && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setReconcileSummary(null)}>{reconcileSummary}</Alert>}

      {!loading && alerts.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255,255,255,0.5)' }}>
          <CheckCircle sx={{ fontSize: 48, opacity: 0.3 }} />
          <Typography sx={{ mt: 1 }}>Ingen åpne alerts</Typography>
          <Typography variant="caption">
            Når Stripe-sync feiler vil incidents dukke opp her med full kontekst.
          </Typography>
        </Box>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Stack spacing={1.5}>
        {alerts.map((alert) => (
          <Box key={alert.id}
               sx={{ p: 2, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2,
                       background: alert.resolvedAt ? 'rgba(74,212,138,0.05)' : 'rgba(239,79,111,0.05)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <Chip
                    label={alert.resolvedAt ? 'Løst' : 'Åpen'}
                    size="small"
                    color={alert.resolvedAt ? 'success' : 'error'}
                    sx={{ height: 20, fontSize: 11 }}
                  />
                  <Chip
                    label={KIND_LABELS[alert.kind] ?? alert.kind}
                    size="small" variant="outlined"
                    sx={{ height: 20, fontSize: 11, color: 'rgba(255,255,255,0.7)',
                            borderColor: 'rgba(255,255,255,0.2)' }}
                  />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    {new Date(alert.createdAt).toLocaleString('nb-NO')}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', wordBreak: 'break-word' }}>
                  {alert.detail}
                </Typography>
              </Box>
              {!alert.resolvedAt && (
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button size="small" variant="contained" startIcon={<PlayArrow />}
                          disabled={retrying === alert.id || resolving === alert.id}
                          onClick={() => void handleRetrySync(alert)}>
                    {retrying === alert.id ? 'Sync …' : 'Prøv sync på nytt'}
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<CheckCircle />}
                          disabled={resolving === alert.id || retrying === alert.id}
                          onClick={() => { setResolveTarget(alert); setResolveNote(''); }}>
                    Marker manuelt løst
                  </Button>
                </Stack>
              )}
            </Stack>
            <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              <span>
                Prosjekt: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{alert.projectName ?? alert.projectId}</strong>
              </span>
              <span>
                Eier (kunden): <strong style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {alert.ownerEmail ?? alert.ownerUserId.slice(0, 12) + '…'}
                </strong>
              </span>
              {alert.actorEmail && alert.actorEmail !== alert.ownerEmail && (
                <span>
                  Utløst av: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{alert.actorEmail}</strong>
                </span>
              )}
              {alert.stripeSubscriptionId && (
                <span>
                  Sub: <code>{alert.stripeSubscriptionId.slice(0, 14)}…</code>{' '}
                  <IconButton size="small"
                              href={`https://dashboard.stripe.com/subscriptions/${alert.stripeSubscriptionId}`}
                              target="_blank" rel="noopener noreferrer"
                              sx={{ p: 0.25, color: 'inherit' }}>
                    <OpenInNew sx={{ fontSize: 12 }} />
                  </IconButton>
                </span>
              )}
            </Stack>
            {alert.resolvedAt && alert.resolutionNote && (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  Løst av {alert.resolvedByEmail ?? alert.resolvedByUserId?.slice(0, 12) + '…'}
                  {' — '}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  {alert.resolutionNote}
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Stack>

      {!loading && unresolvedCount > 0 && (
        <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'rgba(255,255,255,0.5)' }}>
          {unresolvedCount} åpne {unresolvedCount === 1 ? 'alert' : 'alerts'} totalt.
          Sjekk Stripe Dashboard for full subscription-state før du markerer som løst.
        </Typography>
      )}

      <Dialog open={!!resolveTarget} onClose={() => setResolveTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Marker alert som løst</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Bekreft at Stripe-state nå stemmer med ønsket seat-quantity.
            Notatet vises i admin-loggen.
          </Typography>
          <TextField
            fullWidth multiline rows={3}
            label="Notat (valgfritt)"
            placeholder="F.eks. 'Sjekket Stripe — quantity nå 4 som forventet. Sync-feil var nettverks-glitch.'"
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveTarget(null)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void handleResolve()}
                  disabled={resolving != null}>
            Marker som løst
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RoleRoomBillingAlertsPanel;
