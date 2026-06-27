// @ts-nocheck
/**
 * AdminConfigStatusCard — Slice 9X.58
 *
 * Liten admin-card som polles ved mount og viser tilstanden til Stripe,
 * Gmail, og DB-schema. Hjelper Daniel verifisere produksjons-config
 * uten å åpne Render dashboard.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  CheckCircle as OkIcon,
  Cancel as MissingIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Settings as ConfigIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { StatusChip } from './design-system';

interface ConfigCheck {
  status: 'ready' | 'partial' | 'broken';
  checks: {
    stripe: {
      secretKey: boolean;
      webhookSecret: boolean;
      enterprisePriceMonthly: boolean;
      enterprisePriceYearly: boolean;
    };
    mail: { gmailUser: boolean; gmailPass: boolean };
    ai: { anthropic: boolean };
    schema: Record<string, boolean>;
  };
  missing: Array<{ key: string; severity: 'critical' | 'warning'; message: string }>;
  checkedAt: string;
}

const STATUS_LABEL: Record<string, { label: string; color: 'success' | 'warning' | 'error' }> = {
  ready: { label: 'Produksjons-klar', color: 'success' },
  partial: { label: 'Fungerer, men noen advarsler', color: 'warning' },
  broken: { label: 'Kritiske mangler', color: 'error' },
};

const AdminConfigStatusCard: React.FC = () => {
  const [data, setData] = useState<ConfigCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r: any = await apiRequest('/api/admin/config-check');
      setData(r);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke hente config-status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) {
    return (
      <ThemeProvider theme={adminDarkTheme}>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">Sjekker produksjons-config…</Typography>
          </CardContent>
        </Card>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }} action={
        <IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton>
      }>{error}</Alert>
    );
  }

  if (!data) return null;

  const statusInfo = STATUS_LABEL[data.status];
  const criticalMissing = data.missing.filter((m) => m.severity === 'critical');
  const warningMissing = data.missing.filter((m) => m.severity === 'warning');

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Card variant="outlined" sx={{ mb: 2, borderColor: statusInfo.color === 'success' ? 'success.main' : statusInfo.color === 'error' ? 'error.main' : 'warning.main' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ConfigIcon color={statusInfo.color} />
            <Typography variant="h6">Produksjons-config</Typography>
            <StatusChip tone={statusInfo.color} label={statusInfo.label} />
          </Stack>
          <IconButton size="small" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Stack>

        {data.status === 'ready' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Alle kritiske env-variabler og tabeller er på plass. Tester→Enterprise-flowen er klar til bruk.
          </Alert>
        )}

        {criticalMissing.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Kritisk — må fikses</Typography>
            <List dense disablePadding>
              {criticalMissing.map((m) => (
                <ListItem key={m.key} sx={{ py: 0.25, px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}><MissingIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{m.key}</Typography>}
                    secondary={m.message}
                  />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        {warningMissing.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Advarsler</Typography>
            <List dense disablePadding>
              {warningMissing.map((m) => (
                <ListItem key={m.key} sx={{ py: 0.25, px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}><WarningIcon fontSize="small" color="warning" /></ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{m.key}</Typography>}
                    secondary={m.message}
                  />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <ConfigGroup title="Stripe" items={[
            { label: 'Secret key', ok: data.checks.stripe.secretKey },
            { label: 'Webhook secret', ok: data.checks.stripe.webhookSecret },
            { label: 'Enterprise price (mnd)', ok: data.checks.stripe.enterprisePriceMonthly },
            { label: 'Enterprise price (år)', ok: data.checks.stripe.enterprisePriceYearly },
          ]} />
          <ConfigGroup title="E-post (Gmail)" items={[
            { label: 'GMAIL_USER', ok: data.checks.mail.gmailUser },
            { label: 'GMAIL_APP_PASSWORD', ok: data.checks.mail.gmailPass },
          ]} />
          <ConfigGroup title="AI" items={[
            { label: 'ANTHROPIC_API_KEY', ok: data.checks.ai.anthropic },
          ]} />
          <ConfigGroup title="DB-tabeller" items={Object.entries(data.checks.schema).map(([k, v]) => ({
            label: k,
            ok: !!v,
          }))} />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Sjekket: {new Date(data.checkedAt).toLocaleString('nb-NO')}
        </Typography>
      </CardContent>
    </Card>
    </ThemeProvider>
  );
};

const ConfigGroup: React.FC<{ title: string; items: Array<{ label: string; ok: boolean }> }> = ({ title, items }) => (
  <Box>
    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{title}</Typography>
    <Stack spacing={0.25}>
      {items.map((item) => (
        <Stack key={item.label} direction="row" spacing={1} alignItems="center">
          {item.ok ? (
            <OkIcon fontSize="small" sx={{ color: 'success.main', fontSize: 16 }} />
          ) : (
            <MissingIcon fontSize="small" sx={{ color: 'error.main', fontSize: 16 }} />
          )}
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{item.label}</Typography>
        </Stack>
      ))}
    </Stack>
  </Box>
);

export default AdminConfigStatusCard;
