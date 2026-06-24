// @ts-nocheck
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  ArrowOutward,
  AttachMoney,
  CreditCard,
  ReceiptLong,
  Replay,
  WarningAmber,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { usePlatformPricing } from '@/services/PlatformPricingService';

interface BillingManagementPanelProps {
  onOpenPriceManagement?: () => void;
}

interface InvoiceRow {
  id: string;
  customerName?: string;
  customerEmail?: string;
  planId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  createdAt?: string;
}

interface CouponRow {
  id: string;
  code?: string;
  name?: string;
  discountType?: string;
  discountValue?: number;
  currency?: string;
  active?: boolean;
  expiresAt?: string;
}

interface PaymentMethodRow {
  id: string | number;
  user_email?: string;
  first_name?: string;
  last_name?: string;
  payment_type?: string;
  last_four?: string;
  is_default?: boolean;
}

interface RefundRequestRow {
  id: string | number;
  user_email?: string;
  first_name?: string;
  last_name?: string;
  amount?: number;
  status?: string;
  reason?: string;
  requested_at?: string;
}

interface OptionalResult<T> {
  data: T;
  available: boolean;
}

const surfaceSx = {
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.12)',
  bgcolor: 'rgba(255,255,255,0.04)',
  boxShadow: '0 18px 60px rgba(15, 23, 42, 0.06)',
};

const insetSx = {
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.12)',
  bgcolor: 'rgba(255,255,255,0.03)',
};

const metricToneMap = {
  teal: {
    bg: 'linear-gradient(180deg, rgba(236,255,252,0.98) 0%, rgba(247,255,254,0.98) 100%)',
    border: 'rgba(13, 148, 136, 0.18)',
    icon: '#0f766e',
    value: '#0f766e',
  },
  blue: {
    bg: 'linear-gradient(180deg, rgba(239,246,255,0.98) 0%, rgba(248,251,255,0.98) 100%)',
    border: 'rgba(37, 99, 235, 0.16)',
    icon: '#2563eb',
    value: '#1d4ed8',
  },
  amber: {
    bg: 'linear-gradient(180deg, rgba(255,247,237,0.98) 0%, rgba(255,251,245,0.98) 100%)',
    border: 'rgba(234, 88, 12, 0.16)',
    icon: '#c2410c',
    value: '#c2410c',
  },
  violet: {
    bg: 'linear-gradient(180deg, rgba(245,243,255,0.98) 0%, rgba(250,248,255,0.98) 100%)',
    border: 'rgba(124, 58, 237, 0.16)',
    icon: '#7c3aed',
    value: '#6d28d9',
  },
} as const;

function isIgnorableAdminError(error: unknown): boolean {
  const record = typeof error === 'object' && error !== null
    ? (error as { status?: unknown; message?: unknown })
    : null;
  const status = typeof record?.status === 'number' ? record.status : undefined;
  const message = String(record?.message ?? error ?? '');

  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404')
  );
}

async function fetchOptionalAdminData<T>(url: string, fallback: T): Promise<OptionalResult<T>> {
  try {
    const data = await apiRequest(url);
    return { data, available: true };
  } catch (error) {
    if (!isIgnorableAdminError(error)) {
      console.warn(`[BillingManagementPanel] Optional admin endpoint failed: ${url}`, error);
    }
    return { data: fallback, available: false };
  }
}

function asArray<T>(value: unknown, nestedKey?: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (
    nestedKey &&
    value &&
    typeof value === 'object' &&
    Array.isArray((value as Record<string, unknown>)[nestedKey])
  ) {
    return (value as Record<string, unknown>)[nestedKey] as T[];
  }
  if (
    nestedKey &&
    value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).data &&
    typeof (value as Record<string, unknown>).data === 'object' &&
    Array.isArray(((value as Record<string, unknown>).data as Record<string, unknown>)[nestedKey])
  ) {
    return (((value as Record<string, unknown>).data as Record<string, unknown>)[nestedKey] as T[]);
  }
  return [];
}

function formatDate(value?: string): string {
  if (!value) return 'Ikke tilgjengelig';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ikke tilgjengelig';
  return date.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(value: number | undefined, currency: string | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Ikke tilgjengelig';
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: currency || 'NOK',
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'paid':
      return 'Betalt';
    case 'pending':
      return 'Venter';
    case 'overdue':
      return 'Forfalt';
    case 'approved':
      return 'Godkjent';
    case 'rejected':
      return 'Avvist';
    default:
      return status || 'Ukjent';
  }
}

function getStatusColor(status?: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'paid':
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'overdue':
    case 'rejected':
      return 'error';
    default:
      return 'default';
  }
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: keyof typeof metricToneMap;
}) {
  const palette = metricToneMap[tone];

  return (
    <Box
      sx={{
        ...surfaceSx,
        background: palette.bg,
        borderColor: palette.border,
        p: 2.5,
        minHeight: 164,
        display: 'grid',
        alignContent: 'space-between',
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '14px',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'rgba(255,255,255,0.72)',
          color: palette.icon,
          border: `1px solid ${palette.border}`,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '2rem', lineHeight: 1.1, fontWeight: 700, color: palette.value }}>
          {value}
        </Typography>
        <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,0.6)' }}>{label}</Typography>
      </Box>
    </Box>
  );
}

export default function BillingManagementPanel({
  onOpenPriceManagement,
}: BillingManagementPanelProps) {
  const { subscriptionPlans, isLoading: pricingLoading, formatPrice } = usePlatformPricing();

  const invoicesQuery = useQuery({
    queryKey: ['/api/admin/billing/invoices', 'safe'],
    queryFn: () => fetchOptionalAdminData('/api/admin/billing/invoices', { invoices: [] }),
    staleTime: 60_000,
    retry: false,
  });

  const couponsQuery = useQuery({
    queryKey: ['/api/admin/billing/coupons', 'safe'],
    queryFn: () => fetchOptionalAdminData('/api/admin/billing/coupons', { coupons: [] }),
    staleTime: 60_000,
    retry: false,
  });

  const paymentMethodsQuery = useQuery({
    queryKey: ['/api/admin/payment-methods', 'safe'],
    queryFn: () => fetchOptionalAdminData('/api/admin/payment-methods', { paymentMethods: [] }),
    staleTime: 60_000,
    retry: false,
  });

  const refundRequestsQuery = useQuery({
    queryKey: ['/api/admin/refund-requests', 'safe'],
    queryFn: () => fetchOptionalAdminData('/api/admin/refund-requests', { refundRequests: [] }),
    staleTime: 60_000,
    retry: false,
  });

  const invoices = useMemo(
    () => asArray<InvoiceRow>(invoicesQuery.data?.data, 'invoices'),
    [invoicesQuery.data],
  );
  const coupons = useMemo(
    () => asArray<CouponRow>(couponsQuery.data?.data, 'coupons'),
    [couponsQuery.data],
  );
  const paymentMethods = useMemo(
    () => asArray<PaymentMethodRow>(paymentMethodsQuery.data?.data, 'paymentMethods'),
    [paymentMethodsQuery.data],
  );
  const refundRequests = useMemo(
    () => asArray<RefundRequestRow>(refundRequestsQuery.data?.data, 'refundRequests'),
    [refundRequestsQuery.data],
  );

  const selfServePlans = useMemo(
    () =>
      subscriptionPlans.filter(
        (plan) => plan.isActive !== false && !plan.contactSalesOnly && (plan.monthlyPrice ?? plan.price) > 0,
      ),
    [subscriptionPlans],
  );
  const monthlyEntryPrice = useMemo(() => {
    const values = selfServePlans
      .map((plan) => plan.monthlyPrice ?? plan.price)
      .filter((value) => typeof value === 'number' && value > 0);
    return values.length > 0 ? Math.min(...values) : null;
  }, [selfServePlans]);
  const pendingRefunds = useMemo(
    () => refundRequests.filter((request) => request.status === 'pending'),
    [refundRequests],
  );
  const activeCoupons = useMemo(
    () => coupons.filter((coupon) => coupon.active !== false),
    [coupons],
  );
  const defaultPaymentMethods = useMemo(
    () => paymentMethods.filter((method) => Boolean(method.is_default)),
    [paymentMethods],
  );

  const availableFeedCount = [
    invoicesQuery.data?.available,
    couponsQuery.data?.available,
    paymentMethodsQuery.data?.available,
    refundRequestsQuery.data?.available,
  ].filter(Boolean).length;

  const isLoading =
    pricingLoading &&
    invoicesQuery.isLoading &&
    couponsQuery.isLoading &&
    paymentMethodsQuery.isLoading &&
    refundRequestsQuery.isLoading;

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box
        sx={{
          ...surfaceSx,
          p: { xs: 2.25, md: 3 },
          background:
            'radial-gradient(circle at top right, rgba(191,219,254,0.32), transparent 38%), radial-gradient(circle at bottom left, rgba(254,215,170,0.24), transparent 36%), #f7f4ef',
        }}
      >
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2.5} justifyContent="space-between">
          <Box sx={{ maxWidth: 760 }}>
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#335c85',
              }}
            >
              CreatorHub Finance
            </Typography>
            <Typography sx={{ mt: 1, fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 700, color: '#ffffff' }}>
              Økonomi
            </Typography>
            <Typography sx={{ mt: 1.1, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 700 }}>
              Følg fakturering, betalingsmetoder, refusjoner og kuponger i en roligere arbeidsflate.
              Prisendringer gjøres i egen prisstyring, mens denne siden skal gi Daniel rask operativ kontroll.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
              <Chip label={`${selfServePlans.length} planer i salg`} sx={{ bgcolor: 'rgba(255,255,255,0.78)' }} />
              <Chip label={`${pendingRefunds.length} refusjoner venter`} sx={{ bgcolor: 'rgba(255,255,255,0.78)' }} />
              <Chip label={`${defaultPaymentMethods.length} standardkort registrert`} sx={{ bgcolor: 'rgba(255,255,255,0.78)' }} />
              <Chip label={`${availableFeedCount}/4 økonomifeeds live`} sx={{ bgcolor: 'rgba(255,255,255,0.78)' }} />
            </Stack>
          </Box>

          <Box
            sx={{
              minWidth: { xl: 320 },
              width: { xs: '100%', xl: 360 },
              display: 'grid',
              gap: 1.25,
            }}
          >
            <Box sx={{ ...insetSx, px: 1.75, py: 1.5, bgcolor: 'rgba(255,255,255,0.72)' }}>
              <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                Økonomi akkurat nå
              </Typography>
              <Typography sx={{ mt: 0.6, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                Fakturaer, kuponger og betalingsmetoder lastes uten å knekke hele adminen hvis et endpoint mangler.
              </Typography>
            </Box>
            <Box sx={{ ...insetSx, px: 1.75, py: 1.5, bgcolor: 'rgba(255,255,255,0.72)' }}>
              <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                Prisstyring
              </Typography>
              <Typography sx={{ mt: 0.6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                Offentlige planer, årspriser og CreatorHub-mailer styres i egen flate, så økonomi kan holde fokus på drift.
              </Typography>
              <Button
                variant="outlined"
                endIcon={<ArrowOutward />}
                onClick={onOpenPriceManagement}
                sx={{
                  mt: 1.4,
                  borderColor: 'rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.82)',
                  bgcolor: 'rgba(255,255,255,0.06)',
                }}
              >
                Åpne prisstyring
              </Button>
            </Box>
          </Box>
        </Stack>
      </Box>

      {isLoading ? (
        <Alert severity="info">Laster økonomi...</Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            tone="teal"
            icon={<AttachMoney sx={{ fontSize: 28 }} />}
            label="Laveste inngangspris"
            value={monthlyEntryPrice != null ? formatPrice(monthlyEntryPrice, 'NOK') : 'Ikke satt'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            tone="blue"
            icon={<ReceiptLong sx={{ fontSize: 28 }} />}
            label="Fakturaer i feeden"
            value={invoices.length}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            tone="amber"
            icon={<Replay sx={{ fontSize: 28 }} />}
            label="Refusjoner som venter"
            value={pendingRefunds.length}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            tone="violet"
            icon={<CreditCard sx={{ fontSize: 28 }} />}
            label="Registrerte betalingsmetoder"
            value={paymentMethods.length}
          />
        </Grid>
      </Grid>

      {availableFeedCount < 4 ? (
        <Alert
          severity="info"
          sx={{ borderRadius: '18px' }}
          icon={<WarningAmber />}
        >
          Noen økonomiendepunkter er ikke tilgjengelige i dette miljøet ennå. Flaten forblir lesbar og viser det som faktisk er publisert, i stedet for å knekke hele fanen.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Paper sx={{ ...surfaceSx, overflow: 'hidden' }}>
            <Box sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                Siste fakturaer
              </Typography>
              <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.6)' }}>
                En kompakt oversikt over nylige fakturaer. Status vises selv om resten av økonomifeedene er delvis utilgjengelige.
              </Typography>
            </Box>
            {invoices.length === 0 ? (
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                <Alert severity="info" sx={{ borderRadius: '18px' }}>
                  Ingen fakturaer tilgjengelig ennå.
                </Alert>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Kunde</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell>Beløp</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Dato</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.slice(0, 6).map((invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                            {invoice.customerName || 'Ukjent kunde'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {invoice.customerEmail || 'Ingen e-post'}
                          </Typography>
                        </TableCell>
                        <TableCell>{invoice.planId || 'Ikke satt'}</TableCell>
                        <TableCell>{formatAmount(invoice.amount, invoice.currency)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={getStatusLabel(invoice.status)}
                            color={getStatusColor(invoice.status)}
                          />
                        </TableCell>
                        <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <Paper sx={{ ...surfaceSx, p: 2.5 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              Refusjoner som trenger oppfølging
            </Typography>
            <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.6)' }}>
              Denne listen fokuserer bare på de sakene Daniel må se på først.
            </Typography>
            <Divider sx={{ my: 2 }} />
            {pendingRefunds.length === 0 ? (
              <Alert severity="success" sx={{ borderRadius: '18px' }}>
                Ingen ventende refusjoner akkurat nå.
              </Alert>
            ) : (
              <List sx={{ p: 0 }}>
                {pendingRefunds.slice(0, 5).map((request, index) => (
                  <ListItem
                    key={String(request.id)}
                    sx={{
                      px: 0,
                      py: 1.25,
                      borderTop: index === 0 ? 'none' : '1px solid rgba(17,24,39,0.08)',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                            {request.first_name || request.last_name
                              ? `${request.first_name || ''} ${request.last_name || ''}`.trim()
                              : request.user_email || 'Ukjent bruker'}
                          </Typography>
                          <Chip
                            size="small"
                            color={getStatusColor(request.status)}
                            label={getStatusLabel(request.status)}
                          />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {request.user_email || 'Ingen e-post'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatAmount(request.amount, 'NOK')} · {formatDate(request.requested_at)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.reason || 'Ingen grunn oppgitt'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <Paper sx={{ ...surfaceSx, p: 2.5 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              Betalingsmetoder
            </Typography>
            <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.6)' }}>
              Oversikt over registrerte betalingsmetoder uten å dykke ned i en egen tabellstruktur.
            </Typography>
            <Divider sx={{ my: 2 }} />
            {paymentMethods.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: '18px' }}>
                Ingen betalingsmetoder tilgjengelig ennå.
              </Alert>
            ) : (
              <List sx={{ p: 0 }}>
                {paymentMethods.slice(0, 6).map((method, index) => (
                  <ListItem
                    key={String(method.id)}
                    sx={{
                      px: 0,
                      py: 1.25,
                      borderTop: index === 0 ? 'none' : '1px solid rgba(17,24,39,0.08)',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                            {method.first_name || method.last_name
                              ? `${method.first_name || ''} ${method.last_name || ''}`.trim()
                              : method.user_email || 'Ukjent bruker'}
                          </Typography>
                          {method.is_default ? (
                            <Chip size="small" color="success" label="Standard" />
                          ) : null}
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {method.user_email || 'Ingen e-post'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(method.payment_type || 'Kort').toUpperCase()} · •••• {method.last_four || '----'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <Paper sx={{ ...surfaceSx, p: 2.5 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              Kuponger og kommersielle spor
            </Typography>
            <Typography sx={{ mt: 0.5, color: 'rgba(255,255,255,0.6)' }}>
              Aktiv rabattbruk bør være enkel å lese, mens selve planene holdes samlet i prisstyring.
            </Typography>
            <Divider sx={{ my: 2 }} />
            {activeCoupons.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: '18px', mb: 2 }}>
                Ingen aktive kuponger tilgjengelig.
              </Alert>
            ) : (
              <List sx={{ p: 0, mb: 1.5 }}>
                {activeCoupons.slice(0, 5).map((coupon, index) => (
                  <ListItem
                    key={coupon.id}
                    sx={{
                      px: 0,
                      py: 1.25,
                      borderTop: index === 0 ? 'none' : '1px solid rgba(17,24,39,0.08)',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                            {coupon.name || coupon.code || 'Kupong'}
                          </Typography>
                          <Chip size="small" color="success" label="Aktiv" />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {coupon.code || 'Ingen kode'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {coupon.discountType === 'percentage'
                              ? `${coupon.discountValue || 0}% rabatt`
                              : formatAmount(coupon.discountValue, coupon.currency)}
                            {' · '}
                            Utløper {formatDate(coupon.expiresAt)}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <Box sx={{ ...insetSx, p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                    Vil du endre priser eller planinnhold?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gå til prisstyring for offentlig visning, årspriser, feature-tekst og CreatorHub-mailer.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={onOpenPriceManagement}
                  endIcon={<ArrowOutward />}
                  sx={{
                    bgcolor: '#111827',
                    '&:hover': { bgcolor: '#0f172a' },
                    borderRadius: '999px',
                    px: 2,
                  }}
                >
                  Åpne prisstyring
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
    </ThemeProvider>
  );
}
