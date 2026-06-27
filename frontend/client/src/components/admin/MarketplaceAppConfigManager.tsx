// @ts-nocheck
/**
 * MarketplaceAppConfigManager — Slice 9X.70
 *
 * Admin-UI for å forvalte all marketplace-app-konfig: navn, beskrivelse,
 * priser, abonnements-tiers, anbefalings-regler, logoer, bilder.
 *
 * All data lagres i marketplace_app_config (migration 0127).
 * Endepunkter er definert i marketplace-app-config-routes.ts.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  Card,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Avatar,
  Switch,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Storefront as StoreIcon,
  Image as ImageIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { marketplaceAdminEvents } from '@/utils/creatorhub-events';
import { AdminCard, AdminButton, StatusChip, AdminLoading, AdminEmpty, AdminError, AdminTableContainer, adminTokens, useIsMobile } from './design-system';

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  bestFor: string;
  features: string[];
  recommendedFor?: string[];
  recommendationReason?: string;
  // Stripe-sync (populeres av backend ved lagring/publish)
  stripeProductId?: string;
  stripePriceId?: string;
  stripeAmount?: number;
  stripeInterval?: 'month' | 'year';
  stripeSyncedAt?: string;
  stripeSyncError?: string;
}

interface MarketplaceApp {
  id: string;
  name: string;
  category?: string;
  description?: string;
  longDescription?: string;
  logoSrc?: string;
  logoAlt?: string;
  gradientStart?: string;
  gradientEnd?: string;
  featured?: boolean;
  trending?: boolean;
  ctaLabel?: string;
  rating?: number;
  reviewsCount?: number;
  downloadCount?: number;
  monthlyGrowth?: number;
  pricing?: {
    free?: boolean;
    price?: number;
    currency?: string;
    displayPrice?: string;
    note?: string;
    enterpriseIncluded?: boolean;
  };
  subscriptionTiers?: SubscriptionTier[];
  features?: Array<{ text: string }>;
  mediaGallery?: Array<{ src: string; alt: string; label: string }>;
  displayOrder?: number;
  isActive?: boolean;
}

const PROFESSIONS = [
  'photographer', 'videographer', 'music_producer',
  'vendor', 'enterprise', 'admin', 'education_institution',
];

const emptyApp = (): MarketplaceApp => ({
  id: '',
  name: '',
  category: 'Business',
  description: '',
  longDescription: '',
  gradientStart: '#F59E0B',
  gradientEnd: '#D946EF',
  featured: false,
  trending: false,
  isActive: true,
  displayOrder: 100,
  pricing: { free: false, displayPrice: '' },
  subscriptionTiers: [],
  features: [],
  mediaGallery: [],
});

const MarketplaceAppConfigManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingApp, setEditingApp] = useState<MarketplaceApp | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-marketplace-apps'],
    queryFn: async () => {
      const res = await apiRequest('/api/admin/marketplace/apps');
      return (res?.data || []) as MarketplaceApp[];
    },
  });

  const apps = Array.isArray(data) ? data : [];

  const saveMutation = useMutation({
    mutationFn: async (app: MarketplaceApp) => {
      return apiRequest(`/api/admin/marketplace/apps/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app),
      });
    },
    onSuccess: (_data, app) => {
      const isNew = creating;
      if (isNew) {
        marketplaceAdminEvents.appCreated(app.id);
      } else {
        marketplaceAdminEvents.appUpdated(app.id, app.subscriptionTiers?.length || 0);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-apps'] });
      setEditingApp(null);
      setCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/marketplace/apps/${id}`, { method: 'DELETE' });
    },
    onSuccess: (_data, id) => {
      marketplaceAdminEvents.appDeleted(id);
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-apps'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/marketplace/apps/${id}/publish`, { method: 'POST' });
    },
    onSuccess: (data, id) => {
      const tiers = Array.isArray(data?.data?.subscriptionTiers) ? data.data.subscriptionTiers : [];
      const errored = tiers.filter((t: any) => t.stripeSyncError).length;
      marketplaceAdminEvents.publishedToStripe(id, tiers.length, errored);
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-apps'] });
    },
  });

  // Slice 9X.76 — manuell pris-drift-sjekk
  const driftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/marketplace/stripe-price-drift/check', { method: 'POST' });
    },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Marketplace-apper
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Forvalt all info, priser, abonnements-tiers og bilder for apper i marketplace.
            Endringer trer i kraft umiddelbart for alle brukere.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <AdminButton
            tone="secondary"
            onClick={() => driftMutation.mutate()}
            loading={driftMutation.isPending}
          >
            {driftMutation.isPending ? 'Sjekker…' : 'Sjekk pris-drift'}
          </AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<AddIcon />}
            onClick={() => { setEditingApp(emptyApp()); setCreating(true); }}
          >
            Ny app
          </AdminButton>
        </Stack>
      </Stack>

      {/* Slice 9X.76 — drift-rapport */}
      {driftMutation.isSuccess && driftMutation.data?.report && (
        <Alert
          severity={driftMutation.data.report.driftsFound > 0 ? 'warning' : 'success'}
          sx={{ mb: 2 }}
        >
          {driftMutation.data.report.driftsFound === 0 ? (
            <>Alle {driftMutation.data.report.totalTiers} tiers stemmer med Stripe ✓</>
          ) : (
            <>
              <strong>{driftMutation.data.report.driftsFound} drift(s) oppdaget</strong> av {driftMutation.data.report.totalTiers} tiers sjekket.
              Admin-notifikasjon sendt.
              <ul style={{ margin: '8px 0 0 16px', paddingLeft: 0 }}>
                {(Array.isArray(driftMutation.data.report.drifts) ? driftMutation.data.report.drifts : []).slice(0, 5).map((d: any, idx: number) => (
                  <li key={idx}><strong>{d.appName} / {d.tierName}</strong>: {d.message}</li>
                ))}
                {(Array.isArray(driftMutation.data.report.drifts) ? driftMutation.data.report.drifts.length : 0) > 5 && (
                  <li>... og {driftMutation.data.report.drifts.length - 5} til</li>
                )}
              </ul>
            </>
          )}
        </Alert>
      )}
      {driftMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Drift-sjekk feilet: {(driftMutation.error as any)?.message || 'ukjent feil'}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Klarte ikke å laste apper. Sjekk at backend kjører migrasjon 0127.
        </Alert>
      )}
      {publishMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Publisering til Stripe feilet: {(publishMutation.error as any)?.message || 'ukjent feil'}.
          Sjekk at STRIPE_SECRET_KEY er satt på serveren.
        </Alert>
      )}
      {publishMutation.isSuccess && publishMutation.data?.message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {publishMutation.data.message}
        </Alert>
      )}

      <AdminCard disablePadding>
        <AdminTableContainer ariaLabel="Marketplace-apper">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Logo</TableCell>
              <TableCell>ID / Navn</TableCell>
              <TableCell>Kategori</TableCell>
              <TableCell>Pris</TableCell>
              <TableCell align="center">Tiers</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Laster…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && apps.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Ingen apper konfigurert ennå. Klikk "Ny app" for å legge til den første.
                </TableCell>
              </TableRow>
            )}
            {apps.map((app) => (
              <TableRow key={app.id} sx={{ opacity: app.isActive === false ? 0.5 : 1 }}>
                <TableCell>
                  <Avatar
                    src={app.logoSrc}
                    sx={{
                      width: 40, height: 40,
                      background: `linear-gradient(135deg, ${app.gradientStart || '#888'}, ${app.gradientEnd || '#aaa'})`,
                      color: '#fff',
                    }}
                  >
                    {app.name?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{app.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{app.id}</Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={app.category || '—'} />
                </TableCell>
                <TableCell>
                  {app.pricing?.free ? (
                    <StatusChip tone="success" label="Gratis" />
                  ) : (
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {app.pricing?.displayPrice || (app.pricing?.price ? `${app.pricing.price} ${app.pricing.currency || ''}` : '—')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Chip size="small" label={app.subscriptionTiers?.length || 0} />
                  {/* Stripe-sync-indikator */}
                  {(() => {
                    const tiers = Array.isArray(app.subscriptionTiers) ? app.subscriptionTiers : [];
                    const synced = tiers.filter((t: any) => t.stripeProductId).length;
                    const errored = tiers.filter((t: any) => t.stripeSyncError).length;
                    if (tiers.length === 0) return null;
                    return (
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          size="small"
                          label={errored > 0
                            ? `Stripe: ${synced}/${tiers.length} (${errored} feil)`
                            : `Stripe: ${synced}/${tiers.length}`}
                          color={errored > 0 ? 'error' : (synced === tiers.length ? 'success' : 'warning')}
                          sx={{ fontSize: '0.65rem', height: 18 }}
                        />
                      </Box>
                    );
                  })()}
                </TableCell>
                <TableCell align="center">
                  {app.isActive === false ? (
                    <StatusChip tone="neutral" label="Skjult" />
                  ) : app.featured ? (
                    <StatusChip tone="brand" label="Utvalgt" />
                  ) : (
                    <StatusChip tone="success" label="Aktiv" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => publishMutation.mutate(app.id)}
                    disabled={publishMutation.isPending}
                    sx={{ mr: 0.5, textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    {publishMutation.isPending && publishMutation.variables === app.id ? 'Publiserer…' : 'Publiser → Stripe'}
                  </Button>
                  <IconButton size="small" aria-label="Rediger app" onClick={() => { setEditingApp(app); setCreating(false); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Skjul app fra marketplace"
                    onClick={() => {
                      if (confirm(`Skjul appen "${app.name}" fra marketplace?`)) {
                        deleteMutation.mutate(app.id);
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </AdminTableContainer>
      </AdminCard>

      {editingApp && (
        <MarketplaceAppEditDialog
          app={editingApp}
          isNew={creating}
          onClose={() => { setEditingApp(null); setCreating(false); }}
          onSave={(updated) => saveMutation.mutate(updated)}
          saving={saveMutation.isPending}
        />
      )}
    </Box>
  );
};

// ─── Edit dialog ───────────────────────────────────────────────────
const MarketplaceAppEditDialog: React.FC<{
  app: MarketplaceApp;
  isNew: boolean;
  onClose: () => void;
  onSave: (app: MarketplaceApp) => void;
  saving: boolean;
}> = ({ app, isNew, onClose, onSave, saving }) => {
  const [form, setForm] = useState<MarketplaceApp>(app);

  const updateField = (k: keyof MarketplaceApp, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const updatePricing = (k: string, v: any) =>
    setForm((prev) => ({ ...prev, pricing: { ...(prev.pricing || {}), [k]: v } }));

  const updateTier = (idx: number, patch: Partial<SubscriptionTier>) => {
    setForm((prev) => {
      const tiers = [...(prev.subscriptionTiers || [])];
      tiers[idx] = { ...tiers[idx], ...patch };
      return { ...prev, subscriptionTiers: tiers };
    });
  };

  const addTier = () => {
    setForm((prev) => ({
      ...prev,
      subscriptionTiers: [
        ...(prev.subscriptionTiers || []),
        { id: `tier-${Date.now()}`, name: '', price: '', bestFor: '', features: [], recommendedFor: [], recommendationReason: '' },
      ],
    }));
  };

  const removeTier = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      subscriptionTiers: (prev.subscriptionTiers || []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={useIsMobile()} PaperProps={{ sx: { borderRadius: 3 } }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="overline" color="primary">{isNew ? 'Ny app' : 'Rediger'}</Typography>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>{form.name || 'Ny marketplace-app'}</Typography>
        </Box>
        <IconButton aria-label="Lukk" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          {/* Grunnleggende */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Grunnleggende</Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="ID (unik kortform)" size="small" required fullWidth
                  value={form.id} onChange={(e) => updateField('id', e.target.value)}
                  disabled={!isNew}
                  helperText={isNew ? "F.eks. 'role-room' — kan ikke endres etterpå" : 'Låst etter opprettelse'}
                />
                <TextField
                  label="Navn" size="small" required fullWidth
                  value={form.name} onChange={(e) => updateField('name', e.target.value)}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    label="Kategori" value={form.category || ''}
                    onChange={(e) => updateField('category', e.target.value)}
                  >
                    {['Business', 'Career', 'Showcase', 'Legal', 'Finance', 'Productivity'].map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Rekkefølge" size="small" type="number" sx={{ width: 140 }}
                  value={form.displayOrder ?? 100}
                  onChange={(e) => updateField('displayOrder', Number(e.target.value))}
                />
              </Stack>
              <TextField
                label="Kort beskrivelse" size="small" fullWidth
                value={form.description || ''} onChange={(e) => updateField('description', e.target.value)}
              />
              <TextField
                label="Lang beskrivelse" size="small" fullWidth multiline rows={3}
                value={form.longDescription || ''} onChange={(e) => updateField('longDescription', e.target.value)}
              />
            </Stack>
          </Box>

          <Divider />

          {/* Visuelt */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Visuelt</Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Logo URL" size="small" fullWidth
                  value={form.logoSrc || ''} onChange={(e) => updateField('logoSrc', e.target.value)}
                  placeholder="/TheRoleRoom_App_Logo.png"
                />
                <TextField
                  label="Logo alt-tekst" size="small" fullWidth
                  value={form.logoAlt || ''} onChange={(e) => updateField('logoAlt', e.target.value)}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Gradient start" size="small" fullWidth
                  value={form.gradientStart || ''} onChange={(e) => updateField('gradientStart', e.target.value)}
                  placeholder="#F59E0B"
                  InputProps={{ startAdornment: <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: form.gradientStart, mr: 1 }} /> }}
                />
                <TextField
                  label="Gradient slutt" size="small" fullWidth
                  value={form.gradientEnd || ''} onChange={(e) => updateField('gradientEnd', e.target.value)}
                  placeholder="#D946EF"
                  InputProps={{ startAdornment: <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: form.gradientEnd, mr: 1 }} /> }}
                />
              </Stack>
              <Stack direction="row" spacing={3}>
                <FormControlLabel
                  control={<Switch checked={!!form.featured} onChange={(e) => updateField('featured', e.target.checked)} />}
                  label="Utvalgt"
                />
                <FormControlLabel
                  control={<Switch checked={!!form.trending} onChange={(e) => updateField('trending', e.target.checked)} />}
                  label="Trender"
                />
                <FormControlLabel
                  control={<Switch checked={form.isActive !== false} onChange={(e) => updateField('isActive', e.target.checked)} />}
                  label="Synlig i marketplace"
                />
              </Stack>
            </Stack>
          </Box>

          <Divider />

          {/* Pris */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              <MoneyIcon fontSize="small" aria-hidden sx={{ verticalAlign: 'text-bottom', mr: 0.5 }} />
              Standard-pris (vises som overskrift)
            </Typography>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!form.pricing?.free}
                    onChange={(e) => updatePricing('free', e.target.checked)}
                  />
                }
                label="Gratis"
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Pris (tall)" size="small" type="number" sx={{ width: 140 }}
                  value={form.pricing?.price ?? ''} onChange={(e) => updatePricing('price', Number(e.target.value))}
                  disabled={!!form.pricing?.free}
                />
                <TextField
                  label="Valuta" size="small" sx={{ width: 140 }}
                  value={form.pricing?.currency || ''} onChange={(e) => updatePricing('currency', e.target.value)}
                  placeholder="kr/mnd"
                  disabled={!!form.pricing?.free}
                />
                <TextField
                  label="Visnings-pris (overskriver tall/valuta)" size="small" fullWidth
                  value={form.pricing?.displayPrice || ''} onChange={(e) => updatePricing('displayPrice', e.target.value)}
                  placeholder="Fra 495 kr / mnd eks. mva."
                />
              </Stack>
              <TextField
                label="Pris-notat" size="small" fullWidth multiline rows={2}
                value={form.pricing?.note || ''} onChange={(e) => updatePricing('note', e.target.value)}
                placeholder="F.eks. 'Installeres fra Marketplace. Fanen blir tilgjengelig etter abonnement.'"
              />
            </Stack>
          </Box>

          <Divider />

          {/* Subscription tiers */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Abonnements-tiers
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addTier}>
                Legg til tier
              </Button>
            </Stack>
            <Stack spacing={2}>
              {(Array.isArray(form.subscriptionTiers) ? form.subscriptionTiers : []).length === 0 && (
                <Alert severity="info">
                  Ingen tiers definert. Legg til én eller flere planer (f.eks. "Innholdsprodusent", "Produksjonsteam").
                </Alert>
              )}
              {(Array.isArray(form.subscriptionTiers) ? form.subscriptionTiers : []).map((tier, idx) => (
                <Card key={tier.id || idx} sx={{ p: 2, border: 1, borderColor: 'divider', boxShadow: 'none' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Tier {idx + 1}</Typography>
                      {tier.stripeProductId && (
                        <Chip size="small" label="Synket til Stripe" color="success" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                      {tier.stripeSyncError && (
                        <Chip size="small" label={`Feil: ${tier.stripeSyncError}`} color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                    </Stack>
                    <IconButton size="small" aria-label="Fjern tier" onClick={() => removeTier(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  {tier.stripeProductId && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      Stripe product: <code>{tier.stripeProductId}</code> · price: <code>{tier.stripePriceId}</code>
                    </Typography>
                  )}
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField
                        label="Navn" size="small" fullWidth
                        value={tier.name} onChange={(e) => updateTier(idx, { name: e.target.value })}
                        placeholder="Innholdsprodusent"
                      />
                      <TextField
                        label="Pris" size="small" sx={{ width: 220, maxWidth: '100%' }}
                        value={tier.price} onChange={(e) => updateTier(idx, { price: e.target.value })}
                        placeholder="495 kr / mnd"
                      />
                    </Stack>
                    <TextField
                      label="Hvem dette passer for"
                      size="small" fullWidth multiline rows={2}
                      value={tier.bestFor} onChange={(e) => updateTier(idx, { bestFor: e.target.value })}
                      placeholder="Solo-skaper som lager video- og foto-innhold for kunder."
                    />
                    <TextField
                      label="Funksjoner (en per linje)"
                      size="small" fullWidth multiline rows={4}
                      value={(Array.isArray(tier.features) ? tier.features : []).join('\n')}
                      onChange={(e) => updateTier(idx, { features: e.target.value.split('\n').filter(Boolean) })}
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel>Anbefales til (profesjoner)</InputLabel>
                      <Select
                        label="Anbefales til (profesjoner)" multiple
                        value={tier.recommendedFor || []}
                        onChange={(e) => updateTier(idx, { recommendedFor: e.target.value as string[] })}
                        renderValue={(selected: any) => (selected as string[]).join(', ')}
                      >
                        {PROFESSIONS.map((p) => (
                          <MenuItem key={p} value={p}>{p}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Anbefalings-begrunnelse (vises som forklaring til brukeren)"
                      size="small" fullWidth multiline rows={2}
                      value={tier.recommendationReason || ''}
                      onChange={(e) => updateTier(idx, { recommendationReason: e.target.value })}
                      placeholder="F.eks. 'Du jobber som individuell skaper. Denne planen gir deg brief, storyboard og leveranse-flyt.'"
                    />
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Media gallery */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              <ImageIcon fontSize="small" aria-hidden sx={{ verticalAlign: 'text-bottom', mr: 0.5 }} />
              Bilde-galleri (URL per linje, valgfri label etter "|")
            </Typography>
            <TextField
              fullWidth multiline rows={4} size="small"
              aria-label="Bilde-galleri (URL per linje)"
              value={(Array.isArray(form.mediaGallery) ? form.mediaGallery : []).map((m) => m.label ? `${m.src} | ${m.label}` : m.src).join('\n')}
              onChange={(e) => {
                const parsed = e.target.value.split('\n').filter(Boolean).map((line) => {
                  const [src, label] = line.split('|').map((p) => p.trim());
                  return { src, alt: label || src, label: label || '' };
                });
                updateField('mediaGallery', parsed);
              }}
              placeholder="/marketplace-previews/role-room-team-step.png | Produksjonsteam"
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
        <AdminButton tone="ghost" onClick={onClose}>Avbryt</AdminButton>
        <AdminButton
          tone="primary"
          startIcon={<SaveIcon />}
          loading={saving}
          disabled={!form.id || !form.name || saving}
          onClick={() => onSave(form)}
        >
          {saving ? 'Lagrer…' : 'Lagre'}
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
};

export default MarketplaceAppConfigManager;
