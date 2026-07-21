/**
 * LeadgridPricingConfigPanel.tsx
 *
 * Super-admin-editor for Leadgrid offentlig pris-config (én sannhetskilde).
 * Redigerer tiers + tilleggsmoduler (Dørsalg/Kvalitet/Go) + bundle og lagrer
 * til PUT /api/leadgrid/pricing-config. Endringene slår DIREKTE gjennom på
 * leadgrid.no (landing leser GET /api/leadgrid/pricing-config).
 *
 * Speiler PricingConfig i backend/server/leadgrid-pricing-config-routes.ts.
 * Mountes som tab i PriceManagementDashboard.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardContent, Checkbox, Divider,
  FormControlLabel, Grid, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import {
  Public as PublicIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { AdminButton, AdminLoading, AdminError, useIsMobile } from './design-system';

interface PricingTier {
  key: string; name: string; price: number; tagline: string;
  priceNote: string; popular: boolean; cta: string; features: string[];
}
interface PricingModule {
  key: string; title: string; desc: string;
  priceSoloPro: number; priceAgency: number; accent: string; active: boolean;
}
interface PricingConfig {
  tiers: PricingTier[];
  modules: PricingModule[];
  bundle: { active: boolean; priceAgency: number; label: string };
}

function bearer(): string {
  return typeof window !== 'undefined' && localStorage.getItem('rr_bearer')
    ? `Bearer ${localStorage.getItem('rr_bearer')}` : '';
}

export default function LeadgridPricingConfigPanel() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchConfig = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/leadgrid/pricing-config', { credentials: 'include' });
      if (!r.ok) { setError(`HTTP ${r.status}`); return; }
      setConfig(await r.json());
      setDirty(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const patchTier = (i: number, patch: Partial<PricingTier>) => {
    setConfig((c) => c && ({ ...c, tiers: c.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
    setDirty(true);
  };
  const patchModule = (i: number, patch: Partial<PricingModule>) => {
    setConfig((c) => c && ({ ...c, modules: c.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
    setDirty(true);
  };
  const patchBundle = (patch: Partial<PricingConfig['bundle']>) => {
    setConfig((c) => c && ({ ...c, bundle: { ...c.bundle, ...patch } }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;
    // Rens: dropp tomme feature-linjer før lagring.
    const clean: PricingConfig = {
      ...config,
      tiers: config.tiers.map((t) => ({ ...t, features: t.features.filter((f) => f.trim() !== '') })),
    };
    setSaving(true);
    try {
      const r = await fetch('/api/leadgrid/pricing-config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: bearer() },
        body: JSON.stringify({ config: clean }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSnackbar(`Feil: ${body.error || `HTTP ${r.status}`}`);
      } else {
        setSnackbar('Lagret — endringene er nå live på leadgrid.no');
        setConfig(clean);
        setDirty(false);
      }
    } catch (e) {
      setSnackbar(`Feil: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoading />;
  if (error || !config) return <AdminError message={error ?? 'Ingen data'} onRetry={fetchConfig} />;

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PublicIcon aria-hidden sx={{ color: '#a78bfa' }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            Leadgrid — Offentlig prising
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <AdminButton tone="ghost" startIcon={<RefreshIcon />} onClick={fetchConfig} size="small">
            Hent på nytt
          </AdminButton>
          <AdminButton
            tone="primary" startIcon={<SaveIcon />}
            onClick={handleSave} loading={saving} disabled={saving || !dirty}
          >
            {dirty ? 'Lagre endringer' : 'Lagret'}
          </AdminButton>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2.5 }}>
        Dette styrer <strong>prisene og tilleggsmodulene på leadgrid.no direkte</strong>. Landingssiden
        leser samme config — endringer her vises på nettsiden uten ny utrulling (kan ta opptil ~60 sek pga. caching).
      </Alert>

      {/* Tiers */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mb: 1 }}>
        Planer
      </Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        {config.tiers.map((t, i) => (
          <Card key={t.key} sx={{ border: '1px solid rgba(167,139,250,0.25)' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t.name || t.key}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  <code>{t.key}</code>
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Navn" value={t.name}
                    onChange={(e) => patchTier(i, { name: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" label="Pris (kr/mnd)" type="number" value={t.price}
                    onChange={(e) => patchTier(i, { price: Number(e.target.value) })} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" label="CTA-knapp" value={t.cta}
                    onChange={(e) => patchTier(i, { cta: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Tagline" value={t.tagline}
                    onChange={(e) => patchTier(i, { tagline: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Pris-notat (under prisen)" value={t.priceNote}
                    onChange={(e) => patchTier(i, { priceNote: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" multiline minRows={3}
                    label="Punkter (én per linje)"
                    value={t.features.join('\n')}
                    onChange={(e) => patchTier(i, { features: e.target.value.split('\n') })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Checkbox checked={t.popular} onChange={(e) => patchTier(i, { popular: e.target.checked })} />}
                    label='Marker som «Mest populær»'
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Moduler */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mb: 1 }}>
        Tilleggsmoduler
      </Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        {config.modules.map((m, i) => (
          <Card key={m.key} sx={{ border: `1px solid ${m.accent}44`, opacity: m.active ? 1 : 0.55 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: m.accent }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{m.title || m.key}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}><code>{m.key}</code></Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Tittel" value={m.title}
                    onChange={(e) => patchModule(i, { title: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" label="Pris Solo Pro (kr/mnd)" type="number" value={m.priceSoloPro}
                    onChange={(e) => patchModule(i, { priceSoloPro: Number(e.target.value) })} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" label="Pris Agency (kr/mnd)" type="number" value={m.priceAgency}
                    onChange={(e) => patchModule(i, { priceAgency: Number(e.target.value) })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" multiline minRows={2} label="Beskrivelse" value={m.desc}
                    onChange={(e) => patchModule(i, { desc: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField fullWidth size="small" label="Aksentfarge (hex)" value={m.accent}
                    onChange={(e) => patchModule(i, { accent: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={8}>
                  <FormControlLabel
                    control={<Checkbox checked={m.active} onChange={(e) => patchModule(i, { active: e.target.checked })} />}
                    label="Vis på nettsiden"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Bundle */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mb: 1 }}>
        Pakke (bundle)
      </Typography>
      <Card sx={{ border: '1px solid rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={7}>
              <TextField fullWidth size="small" label="Tekst" value={config.bundle.label}
                onChange={(e) => patchBundle({ label: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Pris Agency (kr/mnd)" type="number" value={config.bundle.priceAgency}
                onChange={(e) => patchBundle({ priceAgency: Number(e.target.value) })} />
            </Grid>
            <Grid item xs={6} sm={2}>
              <FormControlLabel
                control={<Checkbox checked={config.bundle.active} onChange={(e) => patchBundle({ active: e.target.checked })} />}
                label="Vis"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Divider sx={{ my: 2.5 }} />
      <Stack direction="row" justifyContent="flex-end">
        <AdminButton
          tone="primary" startIcon={<SaveIcon />}
          onClick={handleSave} loading={saving} disabled={saving || !dirty}
        >
          {dirty ? 'Lagre endringer' : 'Lagret'}
        </AdminButton>
      </Stack>

      <Snackbar open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
