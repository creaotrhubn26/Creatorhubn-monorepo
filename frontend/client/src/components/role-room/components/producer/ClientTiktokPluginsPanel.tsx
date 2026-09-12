/**
 * ClientTiktokPluginsPanel.tsx
 *
 * Bestemor-vennlig: "Koble klientens nettside til TikTok så annonser
 * kan sende folk rett til kassa".
 *
 * Backend:
 *   GET  /api/admin-room/agent/ads/tiktok/plugins?advertiserId=X
 *   POST /api/admin-room/agent/ads/configs/:id/tiktok/install-plugin
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Select, Stack, TextField, Typography,
} from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const palette = {
  bg: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  tiktok: '#ff0050',
};

const PLUGIN_TYPE_LABEL: Record<string, string> = {
  WEBSITE: 'Nettside',
  SHOPIFY: 'Shopify-butikk',
  WOOCOMMERCE: 'WooCommerce-butikk',
  MAGENTO: 'Magento-butikk',
  BIGCOMMERCE: 'BigCommerce-butikk',
};

export default function ClientTiktokPluginsPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [pluginType, setPluginType] = useState('WEBSITE');
  const [pluginName, setPluginName] = useState('');
  const [domain, setDomain] = useState('');
  const [installing, setInstalling] = useState(false);

  const effectiveConfigId = isOwnAccount ? 'self' : configId;

  useEffect(() => {
    if (advertiserId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.config?.tiktok_advertiser_id) setAdvertiserId(d.config.tiktok_advertiser_id);
        if (d?.config?.client_website_url && !domain) setDomain(d.config.client_website_url.replace(/^https?:\/\//, '').replace(/\/+$/, ''));
        if (d?.config?.client_name && !pluginName) setPluginName(d.config.client_name);
      })
      .catch(() => {});
  }, [configId, advertiserId, isOwnAccount, domain, pluginName]);

  const load = async () => {
    if (!advertiserId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/tiktok/plugins?advertiserId=${advertiserId}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Henting feilet');
      setPlugins(d.plugins ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
    } finally {
      setLoading(false);
    }
  };

  const install = async () => {
    if (!advertiserId || !pluginName || !domain) return;
    setInstalling(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/install-plugin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ advertiserId, pluginType, pluginName, domain }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Install feilet');
      setInstallOpen(false);
      setTimeout(load, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install feilet');
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => { if (advertiserId) load(); /* eslint-disable-next-line */ }, [advertiserId]);

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <StorefrontOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Koblede nettsider og butikker
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Disse er koblet til TikTok så annonser kan sende folk rett til kassa.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        <Box sx={{
          bgcolor: 'rgba(255,0,80,0.06)',
          border: `1px solid rgba(255,0,80,0.20)`,
          borderRadius: 1.6,
          p: 2.2,
          mb: 2,
        }}>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
            {plugins.length}
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
            {plugins.length === 0 ? 'ingen nettsider koblet ennå' : plugins.length === 1 ? 'nettside koblet' : 'nettsider koblet'}
          </Typography>
        </Box>

        <Button
          onClick={() => setInstallOpen(true)}
          disabled={!advertiserId}
          startIcon={<AddCircleOutlineOutlinedIcon />}
          sx={{
            background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
            color: '#fff', textTransform: 'none', fontWeight: 700, fontSize: '1rem',
            px: 4, py: 1.4, borderRadius: 1.6,
            '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
          }}
        >
          Koble en nettside
        </Button>

        {plugins.length > 0 ? (
          <Stack spacing={1.2} sx={{ mt: 2.4 }}>
            {plugins.map((p, i) => (
              <Box key={p.plugin_id ?? p.tiktok_plugin_id ?? i} sx={{
                bgcolor: 'rgba(168,85,247,0.04)',
                border: `1px solid ${palette.border}`,
                borderRadius: 1.4,
                p: 1.6,
              }}>
                <Stack direction="row" alignItems="center" spacing={1.6}>
                  <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 22 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem' }}>
                      {p.plugin_name ?? p.name ?? 'Ukjent'}
                    </Typography>
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                      {p.domain ?? ''} · {PLUGIN_TYPE_LABEL[(p.plugin_type ?? '').toUpperCase()] ?? p.plugin_type}
                    </Typography>
                  </Box>
                  <Chip
                    label="KOBLET"
                    size="small"
                    sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700 }}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : null}
      </CardContent>

      <Dialog open={installOpen} onClose={() => setInstallOpen(false)} PaperProps={{ sx: { bgcolor: palette.bg, color: palette.textPrimary } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Koble en nettside til TikTok</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography sx={{ color: palette.textPrimary, fontSize: '0.86rem', fontWeight: 700, mb: 0.6 }}>
                Hva slags nettside?
              </Typography>
              <Select size="small" value={pluginType} onChange={(e) => setPluginType(e.target.value)} fullWidth sx={{ color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}>
                <MenuItem value="WEBSITE">Vanlig nettside</MenuItem>
                <MenuItem value="SHOPIFY">Shopify-butikk</MenuItem>
                <MenuItem value="WOOCOMMERCE">WooCommerce-butikk</MenuItem>
                <MenuItem value="MAGENTO">Magento-butikk</MenuItem>
                <MenuItem value="BIGCOMMERCE">BigCommerce-butikk</MenuItem>
              </Select>
            </Box>
            <TextField size="small" label="Navn på koblingen" value={pluginName} onChange={(e) => setPluginName(e.target.value)} InputProps={{ sx: { color: palette.textPrimary } }} InputLabelProps={{ sx: { color: palette.textMuted } }} />
            <TextField size="small" label="Domene (uten https://)" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" InputProps={{ sx: { color: palette.textPrimary } }} InputLabelProps={{ sx: { color: palette.textMuted } }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstallOpen(false)} sx={{ color: palette.textMuted, textTransform: 'none' }}>Avbryt</Button>
          <Button
            onClick={install}
            disabled={!pluginName || !domain || installing}
            startIcon={installing ? <CircularProgress size={16} /> : null}
            sx={{ background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)', color: '#fff', textTransform: 'none', fontWeight: 700, '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' } }}
          >
            {installing ? 'Kobler…' : 'Koble til TikTok'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
