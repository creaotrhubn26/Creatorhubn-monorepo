// @ts-nocheck
/**
 * AdminPaymentStatusCard — Slice 9X.70
 *
 * Viser status på Stripe + nylige betalingshendelser i admin-dashboardet.
 * Daniel ser med en gang om betalinger går gjennom eller om noe er stuck.
 *
 * Backend: /api/admin/marketplace/stripe-status
 */

import React from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  alpha,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  CheckCircle as OkIcon,
  Cancel as FailIcon,
  Refresh as RefreshIcon,
  Replay as RefundIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { paymentEvents } from '@/utils/creatorhub-events';

const fmtKr = (n: number) =>
  `${Math.round(n).toLocaleString('nb-NO')} kr`;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'nå';
  if (diffMin < 60) return `${diffMin} min siden`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)} t siden`;
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
};

const EVENT_LABEL: Record<string, string> = {
  'invoice.paid': 'Faktura betalt',
  'invoice.payment_failed': 'Faktura feilet',
  'charge.succeeded': 'Kortbetaling ok',
  'charge.failed': 'Kortbetaling feilet',
  'charge.refunded': 'Refundert',
  'customer.subscription.created': 'Nytt abonnement',
  'customer.subscription.updated': 'Abonnement oppdatert',
  'customer.subscription.deleted': 'Abonnement avsluttet',
};

const AdminPaymentStatusCard: React.FC = () => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-stripe-status'],
    queryFn: async () => {
      paymentEvents.statusViewed();
      return apiRequest('/api/admin/stripe/payment-status');
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <ThemeProvider theme={adminDarkTheme}>
        <Card>
          <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </CardContent>
        </Card>
      </ThemeProvider>
    );
  }

  if (!data) {
    return (
      <ThemeProvider theme={adminDarkTheme}>
        <Card>
          <CardContent>
            <Alert severity="warning">Kunne ikke laste Stripe-status.</Alert>
          </CardContent>
        </Card>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha('#635bff', 0.1), color: '#635bff' }}>
              <PaymentIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Stripe-status & betalinger
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  size="small"
                  icon={data.configured ? <OkIcon fontSize="small" /> : <FailIcon fontSize="small" />}
                  label={data.configured ? 'Stripe konfigurert' : 'Mangler STRIPE_SECRET_KEY'}
                  color={data.configured ? 'success' : 'error'}
                />
                <Chip
                  size="small"
                  icon={data.webhookConfigured ? <OkIcon fontSize="small" /> : <FailIcon fontSize="small" />}
                  label={data.webhookConfigured ? 'Webhook ok' : 'Webhook mangler'}
                  color={data.webhookConfigured ? 'success' : 'warning'}
                />
              </Stack>
            </Box>
          </Stack>
          <IconButton size="small" onClick={() => { paymentEvents.statusRefreshed(); refetch(); }} disabled={isFetching}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>

        {!data.configured && data.message && (
          <Alert severity="warning" sx={{ mb: 2 }}>{data.message}</Alert>
        )}
        {data.error && (
          <Alert severity="error" sx={{ mb: 2 }}>Stripe API-feil: {data.error}</Alert>
        )}

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.5, mb: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#10b981', 0.08), border: '1px solid', borderColor: alpha('#10b981', 0.2) }}>
            <Typography variant="caption" color="text.secondary">Siste 24t</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
              {fmtKr(data.recentRevenue?.last24h || 0)}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#3b82f6', 0.08), border: '1px solid', borderColor: alpha('#3b82f6', 0.2) }}>
            <Typography variant="caption" color="text.secondary">Siste 7 dager</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#60a5fa' }}>
              {fmtKr(data.recentRevenue?.last7d || 0)}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#8b5cf6', 0.08), border: '1px solid', borderColor: alpha('#8b5cf6', 0.2) }}>
            <Typography variant="caption" color="text.secondary">Siste 30 dager</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#c084fc' }}>
              {fmtKr(data.recentRevenue?.last30d || 0)}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#f59e0b', 0.08), border: '1px solid', borderColor: alpha('#f59e0b', 0.2) }}>
            <Typography variant="caption" color="text.secondary">Aktive abonnement</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#d97706' }}>
              {data.activeSubscriptions ?? '—'}
            </Typography>
          </Box>
        </Box>

        {/* Counts */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Chip
            icon={<OkIcon />}
            label={`${data.counts?.succeeded ?? 0} vellykkede`}
            color="success" variant="outlined" size="small"
          />
          <Chip
            icon={<FailIcon />}
            label={`${data.counts?.failed ?? 0} feilet`}
            color={data.counts?.failed > 0 ? 'error' : 'default'} variant="outlined" size="small"
          />
          <Chip
            icon={<RefundIcon />}
            label={`${data.counts?.refunded ?? 0} refundert`}
            color="warning" variant="outlined" size="small"
          />
        </Stack>

        <Divider sx={{ mb: 1.5 }} />

        {/* Recent events */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Siste hendelser
        </Typography>
        {(Array.isArray(data.events) ? data.events : []).length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Ingen nylige Stripe-hendelser registrert.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 0.5 }}>Type</TableCell>
                <TableCell align="right" sx={{ py: 0.5 }}>Beløp</TableCell>
                <TableCell align="right" sx={{ py: 0.5 }}>Tid</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.events.slice(0, 8).map((ev: any) => (
                <TableRow key={ev.id} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 0.75 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {ev.status === 'success' && <OkIcon sx={{ color: '#10b981', fontSize: 16 }} />}
                      {ev.status === 'failed' && <FailIcon sx={{ color: '#ef4444', fontSize: 16 }} />}
                      {ev.status === 'refunded' && <RefundIcon sx={{ color: '#f59e0b', fontSize: 16 }} />}
                      <Typography variant="caption">
                        {EVENT_LABEL[ev.type] || ev.type}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {ev.amount > 0 ? fmtKr(ev.amount) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {fmtTime(ev.createdAt)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    </ThemeProvider>
  );
};

export default AdminPaymentStatusCard;
