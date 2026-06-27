/**
 * LeadMapPricingPanel.tsx
 *
 * Admin pricing panel for The Role Room Lead Map (3 tier: discover/pro/agency).
 *
 * Henter Stripe-produkter + priser via /api/admin/lead-map/pricing.
 * Lar admin oppdatere NOK-priser — backend lager ny Stripe-pris,
 * arkiverer gammel, auto-oppdaterer Render env-var.
 *
 * Mountes som tab #6 i PriceManagementDashboard.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardContent,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  TrendingUp as TrendingIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { AdminButton, StatusChip, AdminLoading, AdminError } from './design-system';

interface StripePrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring?: { interval?: string };
  nickname?: string;
  active: boolean;
  metadata?: Record<string, string>;
}

interface StripeProduct {
  id: string; name: string; description: string | null; active: boolean;
}

interface TierData {
  tier: 'discover' | 'pro' | 'agency';
  envKey: string;
  envValue: string | null;
  price: StripePrice | null;
  product: StripeProduct | null;
}

interface PricingResponse {
  mode: 'live' | 'test';
  envVars: Record<string, string | undefined>;
  tiers: TierData[];
  usageMetrics?: {
    activeEntitlements?: number;
    trialEntitlements?: number;
    revenueMonthlyNok?: number;
    tableDoesNotExistYet?: boolean;
  };
}

const TIER_DEFAULT_NOK: Record<TierData['tier'], number> = {
  discover: 299, pro: 599, agency: 1490,
};

const TIER_LABELS: Record<TierData['tier'], { label: string; color: string }> = {
  discover: { label: 'Discover', color: '#60a5fa' },
  pro: { label: 'Pro', color: '#a78bfa' },
  agency: { label: 'Agency', color: '#fbbf24' },
};

export default function LeadMapPricingPanel() {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<TierData['tier'] | null>(null);
  const [editNok, setEditNok] = useState('');
  const [autoUpdateEnv, setAutoUpdateEnv] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const fetchPricing = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/admin/lead-map/pricing', {
        credentials: 'include',
        headers: {
          Authorization: typeof window !== 'undefined' && localStorage.getItem('rr_bearer')
            ? `Bearer ${localStorage.getItem('rr_bearer')}` : '',
        },
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  const handleSave = async () => {
    if (!editingTier) return;
    const nok = Number(editNok);
    if (!Number.isFinite(nok) || nok < 0 || nok > 1_000_000) {
      setSnackbar('Ugyldig pris — må være mellom 0 og 1 000 000 NOK');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/lead-map/pricing/update', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: typeof window !== 'undefined' && localStorage.getItem('rr_bearer')
            ? `Bearer ${localStorage.getItem('rr_bearer')}` : '',
        },
        body: JSON.stringify({ tier: editingTier, priceNok: nok, autoUpdateEnv }),
      });
      const body = await r.json();
      if (!r.ok) {
        setSnackbar(`Feil: ${body.error || `HTTP ${r.status}`}`);
      } else {
        setSnackbar(body.note ?? `Pris oppdatert: ${editingTier} → ${nok} kr/mnd`);
        setEditingTier(null);
        await fetchPricing();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLoading />;
  }

  if (error || !data) {
    return <AdminError message={error ?? 'Ingen data'} onRetry={fetchPricing} />;
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <MoneyIcon aria-hidden sx={{ color: '#fbbf24' }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            Lead Map — Prising
          </Typography>
          <StatusChip
            tone={data.mode === 'live' ? 'error' : 'neutral'}
            label={data.mode === 'live' ? 'LIVE Stripe' : 'TEST Stripe'}
          />
        </Stack>
        <AdminButton tone="ghost" startIcon={<RefreshIcon />} onClick={fetchPricing} size="small">
          Oppdater
        </AdminButton>
      </Stack>

      {/* Usage metrics */}
      {data.usageMetrics && !data.usageMetrics.tableDoesNotExistYet && (
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Aktive abonnementer</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#34d399' }}>
                {data.usageMetrics.activeEntitlements ?? 0}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>I trial</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#60a5fa' }}>
                {data.usageMetrics.trialEntitlements ?? 0}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>MRR (NOK)</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#fbbf24' }}>
                <TrendingIcon aria-hidden sx={{ fontSize: 24, mr: 0.5, verticalAlign: 'middle' }} />
                {(data.usageMetrics.revenueMonthlyNok ?? 0).toLocaleString('nb-NO')}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Tier-kort */}
      <Stack spacing={2}>
        {(Array.isArray(data.tiers) ? data.tiers : []).map((t) => {
          const meta = TIER_LABELS[t.tier];
          const currentNok = t.price?.unit_amount ? t.price.unit_amount / 100 : null;
          const isPlaceholder = !t.envValue || t.envValue.includes('PLACEHOLDER');
          return (
            <Card key={t.tier} sx={{ border: `2px solid ${meta.color}33` }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
                  <Stack direction="row" alignItems="center" spacing={1.4}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: 1,
                      bgcolor: `${meta.color}22`, border: `1px solid ${meta.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MoneyIcon aria-hidden sx={{ color: meta.color }} />
                    </Box>
                    <Stack>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
                        Lead Map {meta.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Tier: <code>{t.tier}</code>
                      </Typography>
                    </Stack>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {currentNok !== null ? (
                      <Typography variant="h4" sx={{ fontWeight: 800, color: meta.color }}>
                        {currentNok.toLocaleString('nb-NO')} kr<Box component="span" sx={{ fontSize: '0.6em', color: 'text.secondary' }}>/mnd</Box>
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="error">Ingen pris satt</Typography>
                    )}
                    <AdminButton
                      tone="secondary" size="small"
                      startIcon={<EditIcon />}
                      onClick={() => {
                        setEditingTier(t.tier);
                        setEditNok(String(currentNok ?? TIER_DEFAULT_NOK[t.tier]));
                      }}
                    >
                      Endre pris
                    </AdminButton>
                  </Stack>
                </Stack>

                {isPlaceholder && (
                  <Alert severity="warning" sx={{ mb: 1, fontSize: '0.8rem' }}>
                    <WarningIcon aria-hidden sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    Placeholder-pris ({t.envValue}). Endre prisen for å opprette ekte Stripe-pris.
                  </Alert>
                )}

                <Divider sx={{ my: 1 }} />
                <Stack direction="row" spacing={2} sx={{ fontSize: '0.78rem' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Stripe Price ID</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {t.price?.id ?? <em style={{ color: '#aaa' }}>—</em>}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Stripe Product</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                      {t.product?.name ?? <em style={{ color: '#aaa' }}>—</em>}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Render env-var</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {t.envKey}
                    </Typography>
                  </Box>
                  {t.price && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Status</Typography>
                      <StatusChip
                        tone={t.price.active ? 'success' : 'neutral'}
                        label={t.price.active ? 'Active' : 'Inactive'}
                      />
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Edit-dialog */}
      <Dialog open={!!editingTier} onClose={() => setEditingTier(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Endre pris — Lead Map {editingTier && TIER_LABELS[editingTier].label}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            Stripe-priser er <strong>immutable</strong>. Vi lager ny pris-objekt i Stripe og
            arkiverer det gamle. Eksisterende abonnementer fortsetter på den gamle prisen
            til neste renewal. Nye Checkout-sessions bruker den nye prisen.
          </Alert>
          <TextField
            fullWidth size="medium"
            label="Ny pris (NOK / mnd)"
            type="number"
            value={editNok}
            onChange={(e) => setEditNok(e.target.value)}
            InputProps={{ endAdornment: <Typography color="text.secondary">kr/mnd</Typography> }}
            autoFocus
          />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <input
              type="checkbox" checked={autoUpdateEnv}
              onChange={(e) => setAutoUpdateEnv(e.target.checked)}
              id="autoUpdateEnv"
            />
            <label htmlFor="autoUpdateEnv">
              <Typography variant="body2">
                Auto-oppdater Render env-var (krever RENDER_API_KEY + RENDER_SERVICE_ID)
              </Typography>
            </label>
          </Stack>
          {!autoUpdateEnv && (
            <Alert severity="warning" sx={{ mt: 1, fontSize: '0.8rem' }}>
              Du må manuelt sette ny price-ID på Render etter at den er opprettet.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setEditingTier(null)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary" onClick={handleSave} loading={saving} disabled={saving}
            startIcon={<SaveIcon />}
          >
            Opprett ny pris
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar} autoHideDuration={6000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}
