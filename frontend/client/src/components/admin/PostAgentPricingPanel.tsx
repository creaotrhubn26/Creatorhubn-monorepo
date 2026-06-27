/**
 * Admin pricing panel for The Role Room Post Agent.
 *
 * Reads Stripe products + prices via /api/post-agent/billing/admin/prices,
 * lets admin update monthly/yearly base prices, and triggers a re-seed
 * when needed. Embedded inside PriceManagementDashboard as tab #5.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { AdminCard, AdminButton, StatusChip, AdminLoading, adminTokens } from './design-system';

interface StripePrice {
  id: string;
  product: string;
  unit_amount: number | null; // in øre
  currency: string;
  recurring?: { interval?: string };
  nickname?: string;
  active: boolean;
  metadata?: Record<string, string>;
}

interface StripeProductSnapshot {
  product: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
  } | null;
  prices: StripePrice[];
  envVars: {
    STRIPE_PRODUCT_POST_AGENT?: string;
    STRIPE_PRICE_POST_AGENT_MONTHLY?: string;
    STRIPE_PRICE_POST_AGENT_YEARLY?: string;
  };
  mode: 'live' | 'test' | 'unknown';
  usageMetrics?: {
    activeSubscriptions: number;
    tokensThisMonth: number;
    revenueThisMonthNok: number;
  };
}

interface Props {
  theming: { colors: { primary: string } };
  priceManagementSurfaceSx?: object;
}

function getBearer(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem('creatorhub_auth_token') ||
    window.localStorage.getItem('role_room_auth_token') ||
    null
  );
}

export function PostAgentPricingPanel({ theming, priceManagementSurfaceSx }: Props) {
  const [data, setData] = useState<StripeProductSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Local edit state for prices (in NOK, whole-kroner). Persisted to Stripe on Save.
  const [monthlyNok, setMonthlyNok] = useState<number>(299);
  const [yearlyNok, setYearlyNok] = useState<number>(2990);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bearer = getBearer();
      const res = await fetch('/api/post-agent/billing/admin/prices', {
        credentials: 'include',
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      });
      if (res.status === 403) {
        setError('Admin-tilgang kreves for å se Post Agent-priser.');
        return;
      }
      if (res.status === 503) {
        const body = await res.json();
        setError(body.detail || 'Stripe er ikke konfigurert på backend.');
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setError(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        return;
      }
      const json = (await res.json()) as StripeProductSnapshot;
      if (!Array.isArray(json.prices)) json.prices = [];
      setData(json);
      // Sync local form-state from server
      const monthlyPrice = json.prices.find((p) => p.recurring?.interval === 'month' && p.active);
      const yearlyPrice = json.prices.find((p) => p.recurring?.interval === 'year' && p.active);
      if (monthlyPrice?.unit_amount != null) setMonthlyNok(monthlyPrice.unit_amount / 100);
      if (yearlyPrice?.unit_amount != null) setYearlyNok(yearlyPrice.unit_amount / 100);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const bearer = getBearer();
      const res = await fetch('/api/post-agent/billing/admin/prices', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({
          monthlyNok,
          yearlyNok,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail || body.error || `HTTP ${res.status}`);
        setSnackbar({ open: true, message: 'Lagring feilet', severity: 'error' });
        return;
      }
      setSnackbar({ open: true, message: 'Priser oppdatert i Stripe', severity: 'success' });
      await load();
    } catch (e) {
      setError(String(e));
      setSnackbar({ open: true, message: 'Nettverksfeil', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [monthlyNok, yearlyNok, load]);

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3, borderRadius: '16px' }}>
        <strong>Post Agent</strong> er tillegget for DaVinci Resolve-automatisering. Brukere
        legger det til på et eksisterende Role Room-abonnement via{' '}
        <code>theroleroom.com/billing/post-agent</code>. AI-forbruk (Claude API-kall) faktureres separat.
      </Alert>

      {loading && <AdminLoading />}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {data && !loading && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={priceManagementSurfaceSx}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                    <MoneyIcon sx={{ mr: 1 }} />
                    Base-priser (eks. MVA)
                    <StatusChip
                      label={data.mode.toUpperCase()}
                      tone={data.mode === 'live' ? 'success' : 'warning'}
                      sx={{ ml: 2 }}
                    />
                  </Typography>

                  {!data.product && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Ingen Post Agent-produkt i Stripe ennå. Kjør seed-scriptet via Render Shell:
                      <pre style={{ marginTop: 8, fontSize: 11 }}>
                        cd backend && npx tsx scripts/seed-post-agent-stripe-product.ts
                      </pre>
                    </Alert>
                  )}

                  <TextField
                    fullWidth
                    label="Månedlig pris (NOK)"
                    type="number"
                    value={monthlyNok}
                    onChange={(e) => setMonthlyNok(Number(e.target.value))}
                    sx={{ mb: 2 }}
                    InputProps={{ inputProps: { min: 0, step: 10 } }}
                  />

                  <TextField
                    fullWidth
                    label="Årlig pris (NOK)"
                    type="number"
                    value={yearlyNok}
                    onChange={(e) => setYearlyNok(Number(e.target.value))}
                    sx={{ mb: 2 }}
                    InputProps={{ inputProps: { min: 0, step: 100 } }}
                    helperText={`Tilsvarer ${(yearlyNok / 12).toFixed(0)} NOK/mnd · ${
                      ((1 - yearlyNok / 12 / monthlyNok) * 100).toFixed(0)
                    }% rabatt vs månedlig`}
                  />

                  <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                    <AdminButton
                      tone="primary"
                      loading={saving}
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={saving || !data.product}
                    >
                      {saving ? 'Lagrer…' : 'Lagre i Stripe'}
                    </AdminButton>
                    <AdminButton
                      tone="secondary"
                      startIcon={<RefreshIcon />}
                      onClick={load}
                      disabled={loading}
                    >
                      Last på nytt
                    </AdminButton>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <AdminCard title="Aktive abonnementer" sx={priceManagementSurfaceSx}>
                  {data.usageMetrics ? (
                    <>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                        {data.usageMetrics.activeSubscriptions}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        brukere
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 2 }}>
                        Måneds-tokens: <strong>{data.usageMetrics.tokensThisMonth.toLocaleString()}</strong>
                      </Typography>
                      <Typography variant="body2">
                        Måneds-inntekt (base): <strong>{data.usageMetrics.revenueThisMonthNok.toLocaleString()} NOK</strong>
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Statistikk ikke tilgjengelig.
                    </Typography>
                  )}
              </AdminCard>
            </Grid>
          </Grid>

          <AdminCard title="Stripe konfigurasjon" sx={priceManagementSurfaceSx}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Product ID</Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {data.product?.id || data.envVars.STRIPE_PRODUCT_POST_AGENT || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Monthly price ID</Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {data.envVars.STRIPE_PRICE_POST_AGENT_MONTHLY || '— (sett env-var)'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Yearly price ID</Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {data.envVars.STRIPE_PRICE_POST_AGENT_YEARLY || '— (sett env-var)'}
                  </Typography>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Aktive priser i Stripe ({data.prices.length})</Typography>
                  {data.prices.map((p) => (
                    <Box key={p.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                      <code style={{ fontSize: 11 }}>{p.id}</code>
                      <StatusChip tone="neutral" label={`${(p.unit_amount ?? 0) / 100} ${p.currency.toUpperCase()}/${p.recurring?.interval}`} />
                      {!p.active && <StatusChip tone="neutral" label="archived" />}
                    </Box>
                  ))}
                </Box>
              </Stack>
          </AdminCard>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
