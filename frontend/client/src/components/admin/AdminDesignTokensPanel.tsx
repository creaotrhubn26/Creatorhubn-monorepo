// @ts-nocheck
/**
 * AdminDesignTokensPanel — Slice 9X.73
 *
 * Visual CMS-flate for å redigere design-tokens som styrer hele
 * dashboardet. Endringer trer i kraft for alle brukere innen 60 sek
 * (cache-TTL i useDashboardTokens). Ingen kode-deploy nødvendig.
 *
 * Backend: GET/PUT /api/admin/design-tokens
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton,
  TextField, Slider, MenuItem, Select, FormControl, InputLabel,
  Alert, Divider, Avatar, Chip, alpha,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Save as SaveIcon,
  RestoreOutlined as ResetIcon,
  Refresh as RefreshIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { tokens as defaultTokens, gradient } from '@/utils/dashboard-design-tokens';

interface DesignTokens {
  accentColor?: string;
  accentColorSecondary?: string;
  textPrimary?: string;
  textSecondary?: string;
  radiusMd?: number;
  radiusLg?: string;
  fontDisplay?: string;
}

const FONT_OPTIONS = [
  '"Space Grotesk", sans-serif',
  '"Inter", -apple-system, sans-serif',
  '"Manrope", sans-serif',
  '"Plus Jakarta Sans", sans-serif',
  '"DM Sans", sans-serif',
  'system-ui, sans-serif',
];

const PRESET_ACCENTS = [
  { name: 'Foto orange', value: '#ffba6c' },
  { name: 'Music blå', value: '#1976d2' },
  { name: 'Video rød', value: '#e74c3c' },
  { name: 'Vendor grønn', value: '#27ae60' },
  { name: 'Enterprise lilla', value: '#6c3483' },
];

const AdminDesignTokensPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DesignTokens>({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-design-tokens-edit'],
    queryFn: async () => {
      const res = await apiRequest('/api/admin/design-tokens');
      return (res?.data || {}) as DesignTokens;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: DesignTokens) =>
      apiRequest('/api/admin/design-tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-design-tokens-edit'] });
      queryClient.invalidateQueries({ queryKey: ['admin-design-tokens'] }); // useDashboardTokens
      setDirty(false);
    },
  });

  const update = (key: keyof DesignTokens, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const resetToDefaults = () => {
    setForm({
      accentColor: '',
      accentColorSecondary: '',
      textPrimary: '',
      textSecondary: '',
      radiusMd: undefined,
      radiusLg: '',
      fontDisplay: '',
    });
    setDirty(true);
  };

  // Live preview-tokens (merger med default akkurat som useDashboardTokens)
  const previewAccent = form.accentColor || '#ffba6c';
  const previewTextPrimary = form.textPrimary || defaultTokens.text.primary;
  const previewFont = form.fontDisplay || defaultTokens.font.display;
  const previewRadius = form.radiusLg || defaultTokens.radius.lg;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: alpha('#7c3aed', 0.15), color: '#c084fc' }}>
            <PaletteIcon />
          </Avatar>
          <Box>
            <Typography variant="overline" sx={{ color: '#c084fc', letterSpacing: '0.14em' }}>
              Visual CMS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
              Design-tokens
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ResetIcon />} onClick={resetToDefaults} disabled={!dirty}>
            Tilbakestill
          </Button>
          <IconButton onClick={() => refetch()}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained" startIcon={<SaveIcon />}
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            {saveMutation.isPending ? 'Lagrer…' : 'Lagre & publiser'}
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Endringer du gjør her overstyrer profesjons-spesifikke farger og brukes for ALLE brukere.
        Tomme felter faller tilbake til defaults (profesjons-color + hardkodede verdier).
        Lagring tar effekt innen 60 sek (cache).
      </Alert>

      {saveMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Design-tokens lagret og publisert til alle brukere.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Venstre: redigering */}
        <Stack spacing={2}>
          {/* Accent-farger */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Hoved-accent (overstyrer profesjons-color)
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Accent-farge (hex)" size="small" fullWidth
                  value={form.accentColor || ''}
                  onChange={(e) => update('accentColor', e.target.value)}
                  placeholder="#ffba6c"
                  InputProps={{
                    startAdornment: (
                      <Box sx={{
                        width: 28, height: 28, borderRadius: 1, mr: 1,
                        bgcolor: form.accentColor || '#ffba6c',
                        border: '1px solid #e0e0e0',
                      }} />
                    ),
                  }}
                />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {PRESET_ACCENTS.map((p) => (
                    <Chip
                      key={p.value}
                      label={p.name} size="small"
                      onClick={() => update('accentColor', p.value)}
                      sx={{
                        bgcolor: p.value,
                        color: '#fff',
                        fontWeight: 600,
                        '&:hover': { bgcolor: alpha(p.value, 0.85) },
                      }}
                    />
                  ))}
                </Stack>
                <TextField
                  label="Sekundær accent (valgfri)" size="small" fullWidth
                  value={form.accentColorSecondary || ''}
                  onChange={(e) => update('accentColorSecondary', e.target.value)}
                  placeholder="(tom = ikke i bruk)"
                  InputProps={{
                    startAdornment: form.accentColorSecondary ? (
                      <Box sx={{
                        width: 28, height: 28, borderRadius: 1, mr: 1,
                        bgcolor: form.accentColorSecondary,
                        border: '1px solid #e0e0e0',
                      }} />
                    ) : null,
                  }}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Tekstfarger */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Tekstfarger på dark bakgrunn
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Primær tekst" size="small" fullWidth
                  value={form.textPrimary || ''}
                  onChange={(e) => update('textPrimary', e.target.value)}
                  placeholder={defaultTokens.text.primary}
                  helperText={`Default: ${defaultTokens.text.primary}`}
                />
                <TextField
                  label="Sekundær tekst" size="small" fullWidth
                  value={form.textSecondary || ''}
                  onChange={(e) => update('textSecondary', e.target.value)}
                  placeholder={defaultTokens.text.secondary}
                  helperText={`Default: ${defaultTokens.text.secondary}`}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Border-radius */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Border-radius (avrunding)
              </Typography>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Medium-kort: {form.radiusMd ?? defaultTokens.radius.md}px
                  </Typography>
                  <Slider
                    value={form.radiusMd ?? defaultTokens.radius.md as number}
                    onChange={(_, v) => update('radiusMd', v as number)}
                    min={0} max={32} step={1}
                    marks={[{ value: 0, label: '0' }, { value: 16, label: '16' }, { value: 32, label: '32' }]}
                  />
                </Box>
                <TextField
                  label="Stor-kort (dialog, hero)" size="small"
                  value={form.radiusLg || ''}
                  onChange={(e) => update('radiusLg', e.target.value)}
                  placeholder={defaultTokens.radius.lg}
                  helperText={`Default: ${defaultTokens.radius.lg}`}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Typografi */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Typografi
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>Overskrift-font</InputLabel>
                <Select
                  label="Overskrift-font"
                  value={form.fontDisplay || ''}
                  onChange={(e) => update('fontDisplay', e.target.value as string)}
                >
                  <MenuItem value=""><em>Default (Space Grotesk)</em></MenuItem>
                  {FONT_OPTIONS.map((f) => (
                    <MenuItem key={f} value={f}>{f.split(',')[0].replace(/"/g, '')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Stack>

        {/* Høyre: live preview */}
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <PreviewIcon sx={{ color: '#c084fc' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Live preview
                </Typography>
              </Stack>

              {/* Simulert dashboard-kort */}
              <Box sx={{
                p: 3,
                borderRadius: previewRadius,
                background: gradient.dashboardSurface(previewAccent),
                color: previewTextPrimary,
                border: `1px solid ${alpha(previewAccent, 0.18)}`,
                boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
                fontFamily: previewFont,
              }}>
                <Typography variant="overline" sx={{ color: previewAccent, letterSpacing: '0.18em' }}>
                  Forhåndsvisning
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: previewFont, mb: 1 }}>
                  Velkommen tilbake, Stine
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(246,242,234,0.72)', mb: 3 }}>
                  Du har 3 nye forespørsler og 5 ventende leveringer.
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    sx={{
                      borderRadius: '999px', px: 2.5, py: 1,
                      bgcolor: previewAccent, color: '#150d05',
                      fontWeight: 700, textTransform: 'none',
                      '&:hover': { bgcolor: alpha(previewAccent, 0.88) },
                    }}
                  >
                    Ny booking
                  </Button>
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: '999px', px: 2.5, py: 1,
                      borderColor: alpha(previewAccent, 0.32),
                      color: previewTextPrimary,
                      textTransform: 'none', fontWeight: 700,
                      '&:hover': { borderColor: previewAccent, bgcolor: alpha(previewAccent, 0.08) },
                    }}
                  >
                    Se kalender
                  </Button>
                </Stack>
              </Box>

              {/* Inline kort */}
              <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                {['Stats 1', 'Stats 2'].map((label) => (
                  <Box key={label} sx={{
                    p: 2, borderRadius: (form.radiusMd ?? defaultTokens.radius.md) / 8 + 'rem',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${alpha(previewAccent, 0.18)}`,
                    color: previewTextPrimary,
                  }}>
                    <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)' }}>
                      {label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: previewAccent, fontFamily: previewFont }}>
                      12.345
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Resolveringsrekkefølge
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  1. CMS-overrides (denne flaten) — har høyeste prioritet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  2. Profesjons-color fra <code>useProfessionConfigs</code>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  3. Hardkodede defaults i <code>dashboard-design-tokens.ts</code>
                </Typography>
              </Stack>
              {data?.updatedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  Sist endret: {new Date(data.updatedAt).toLocaleString('nb-NO')}
                  {data.updatedBy && ` av ${data.updatedBy}`}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
};

export default AdminDesignTokensPanel;
