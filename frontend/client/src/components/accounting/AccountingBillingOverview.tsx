import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  Description,
  Link as LinkIcon,
  ReceiptLong,
  Refresh,
  Sync,
  CheckCircle,
} from '@mui/icons-material';

type AccountingIntegrationStatus = {
  configured?: boolean;
  provider?: 'fiken' | 'tripletex';
  environment?: 'test' | 'production';
  status?: 'connected' | 'disconnected' | 'error';
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  organizationNumber?: string | null;
  businessName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  companyName?: string | null;
  employeeName?: string | null;
  employeeEmail?: string | null;
  invoiceCount?: number;
  lastInvoiceId?: string | null;
  lastInvoiceNumber?: string | null;
  lastInvoiceAt?: string | null;
};

type PaymentHistoryEntry = {
  id: string;
  planName?: string | null;
  planId?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  createdAt?: string | null;
  currentPeriodEnd?: string | null;
  receiptUrl?: string | null;
  invoiceUrl?: string | null;
  refunded?: boolean;
  refundRequestStatus?: 'pending' | 'approved' | 'rejected' | null;
};

type QuoteEntry = {
  id: string;
  quoteNumber: string;
  clientName?: string | null;
  title?: string | null;
  totalAmount?: string | number | null;
  acceptedAt?: string | null;
  accountingProvider?: string | null;
  accountingStatus?: string | null;
  tripletexInvoiceId?: string | null;
  tripletexInvoiceNumber?: string | null;
  tripletexInvoiceStatus?: string | null;
  tripletexInvoiceUrl?: string | null;
  tripletexVoucherId?: string | null;
  tripletexVoucherUrl?: string | null;
};

type SubscriptionStatus = {
  selectedPlan?: string | null;
  planName?: string | null;
  amount?: number | null;
  currency?: string | null;
  nextBillingDate?: string | null;
  accessUntil?: string | null;
};

type AccountingBillingOverviewProps = {
  userId: string;
  accentColor?: string;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatDate(value?: string | null) {
  if (!value) return 'Ikke tilgjengelig';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ikke tilgjengelig';
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatAmount(amount?: number | string | null, currency = 'NOK') {
  const numeric = typeof amount === 'number' ? amount : Number(amount || 0);
  if (!Number.isFinite(numeric)) {
    return `0 ${currency}`;
  }

  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function extractQuotes(payload: unknown): QuoteEntry[] {
  if (Array.isArray(payload)) return payload.filter(isRecord) as QuoteEntry[];
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data.filter(isRecord) as QuoteEntry[];
  }
  if (isRecord(payload) && Array.isArray(payload.quotes)) {
    return payload.quotes.filter(isRecord) as QuoteEntry[];
  }
  return [];
}

function extractPaymentHistory(payload: unknown): PaymentHistoryEntry[] {
  if (isRecord(payload) && Array.isArray(payload.history)) {
    return payload.history.filter(isRecord) as PaymentHistoryEntry[];
  }
  return [];
}

export default function AccountingBillingOverview({
  userId,
  accentColor = '#1976d2',
}: AccountingBillingOverviewProps) {
  const { user } = useAuth();
  const authUser = (user || {}) as Record<string, unknown>;
  const queryClient = useQueryClient();
  const [formState, setFormState] = React.useState({
    businessName: '',
    organizationNumber: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    addressLine1: '',
    postalCode: '',
    city: '',
  });

  const integrationStatusQuery = useQuery({
    queryKey: ['/api/accounting/integration/status', userId],
    queryFn: () => apiRequest(`/api/accounting/integration/status?userId=${encodeURIComponent(userId)}`),
    enabled: Boolean(userId),
    retry: false,
  });

  const paymentHistoryQuery = useQuery({
    queryKey: ['/api/payments/history', userId],
    queryFn: () => apiRequest(`/api/payments/history?userId=${encodeURIComponent(userId)}`),
    enabled: Boolean(userId),
  });

  const subscriptionQuery = useQuery({
    queryKey: ['/api/user/subscription-status', userId],
    queryFn: () => apiRequest(`/api/user/subscription-status?userId=${encodeURIComponent(userId)}`),
    enabled: Boolean(userId),
  });

  const quotesQuery = useQuery({
    queryKey: ['/api/quotes/all', 'accounting', userId],
    queryFn: () => apiRequest(`/api/quotes/all?userId=${encodeURIComponent(userId)}&status=accepted`),
    enabled: Boolean(userId),
  });

  const integrationStatus = (integrationStatusQuery.data || null) as AccountingIntegrationStatus | null;
  const paymentHistory = React.useMemo(
    () => extractPaymentHistory(paymentHistoryQuery.data),
    [paymentHistoryQuery.data],
  );
  const quotes = React.useMemo(
    () => extractQuotes(quotesQuery.data),
    [quotesQuery.data],
  );
  const subscription = (subscriptionQuery.data || null) as SubscriptionStatus | null;

  React.useEffect(() => {
    setFormState((current) => ({
      businessName:
        current.businessName ||
        readString(integrationStatus?.businessName) ||
        readString(subscription?.planName ? authUser.companyName : '') ||
        readString(authUser.companyName),
      organizationNumber:
        current.organizationNumber || readString(integrationStatus?.organizationNumber),
      contactName:
        current.contactName ||
        readString(integrationStatus?.contactName) ||
        [readString(authUser.firstName), readString(authUser.lastName)].filter(Boolean).join(' '),
      contactEmail:
        current.contactEmail ||
        readString(integrationStatus?.contactEmail) ||
        readString(authUser.email),
      contactPhone:
        current.contactPhone || readString(integrationStatus?.contactPhone) || readString(authUser.phone),
      addressLine1:
        current.addressLine1 || readString(integrationStatus?.addressLine1),
      postalCode:
        current.postalCode || readString(integrationStatus?.postalCode),
      city: current.city || readString(integrationStatus?.city),
    }));
  }, [authUser.city, authUser.companyName, authUser.email, authUser.firstName, authUser.lastName, authUser.phone, integrationStatus, subscription]);

  const refreshAll = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/integration/status'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/user/subscription-status'] }),
    ]);
  }, [queryClient]);

  const connectMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/accounting/integration/tripletex/test/connect', {
        method: 'POST',
        body: formState,
      }),
    onSuccess: refreshAll,
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/accounting/integration/tripletex/test/disconnect', {
        method: 'POST',
      }),
    onSuccess: refreshAll,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (quoteId: string) =>
      apiRequest('/api/tripletex/invoices/create', {
        method: 'POST',
        body: { quoteId },
      }),
    onSuccess: refreshAll,
  });

  const acceptedQuotes = React.useMemo(
    () =>
      [...quotes].sort((left, right) => {
        const leftDate = new Date(left.acceptedAt || 0).getTime();
        const rightDate = new Date(right.acceptedAt || 0).getTime();
        return rightDate - leftDate;
      }),
    [quotes],
  );
  const recentPayments = React.useMemo(
    () =>
      [...paymentHistory].sort((left, right) => {
        const leftDate = new Date(left.createdAt || 0).getTime();
        const rightDate = new Date(right.createdAt || 0).getTime();
        return rightDate - leftDate;
      }),
    [paymentHistory],
  );
  const latestPayment = recentPayments[0] || null;
  const documentsReadyCount =
    recentPayments.filter((entry) => entry.receiptUrl || entry.invoiceUrl).length +
    acceptedQuotes.filter((entry) => entry.tripletexInvoiceUrl || entry.tripletexVoucherUrl).length;

  const integrationError = connectMutation.error instanceof Error
    ? connectMutation.error.message
    : integrationStatusQuery.error instanceof Error
      ? integrationStatusQuery.error.message
      : null;

  return (
    <Stack spacing={2.5} sx={{ mt: 3 }}>
      <Card
        sx={{
          borderRadius: 3,
          border: `1px solid ${alpha(accentColor, 0.16)}`,
          background: `linear-gradient(135deg, ${alpha(accentColor, 0.10)} 0%, rgba(255,255,255,0.96) 55%)`,
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalance sx={{ color: accentColor }} />
              Faktura, betaling og regnskapsflyt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Her samler du faktura, betaling, historikk og regnskapsgrunnlag i én arbeidsflyt. Tripletex testmiljø
              brukes for å verifisere løsningen før dere eventuelt aktiverer produksjonsoppsett.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Fakturaer</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{acceptedQuotes.length}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Betalinger</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{recentPayments.length}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Dokumenter klare</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{documentsReadyCount}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Neste trekk</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {integrationStatus?.status === 'connected' ? 'Fakturering' : 'Koble opp'}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, border: '1px solid #e7ecf3' }}>
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Tripletex testmiljø
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Koble opp testmiljøet før dere oppretter fakturautkast og bilag fra CreatorHub.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  color={integrationStatus?.status === 'connected' ? 'success' : integrationStatus?.configured ? 'warning' : 'default'}
                  label={
                    integrationStatus?.status === 'connected'
                      ? 'Tilkoblet'
                      : integrationStatus?.configured
                        ? 'Klar for tilkobling'
                        : 'Mangler backend-nøkler'
                  }
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => refreshAll()}
                >
                  Oppdater
                </Button>
              </Box>
            </Box>

            {!integrationStatus?.configured ? (
              <Alert severity="warning">
                Backend mangler Tripletex test-credentials. Legg inn <code>TRIPLETEX_TEST_CONSUMER_TOKEN</code> og
                <code> TRIPLETEX_TEST_EMPLOYEE_TOKEN</code> før denne koblingen kan verifiseres.
              </Alert>
            ) : null}

            {integrationError ? <Alert severity="error">{integrationError}</Alert> : null}
            {(connectMutation.isPending || integrationStatusQuery.isFetching) ? <LinearProgress /> : null}

            {integrationStatus?.status === 'connected' ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                {[
                  {
                    label: 'Tripletex-selskap',
                    value: integrationStatus.companyName || integrationStatus.businessName || 'Ikke tilgjengelig',
                    note: integrationStatus.organizationNumber || 'Testmiljø',
                  },
                  {
                    label: 'Ansatt / kobling',
                    value: integrationStatus.employeeName || integrationStatus.contactName || 'Ikke tilgjengelig',
                    note: integrationStatus.employeeEmail || integrationStatus.contactEmail || 'Ingen e-post funnet',
                  },
                  {
                    label: 'Opprettede fakturaer',
                    value: String(integrationStatus.invoiceCount || 0),
                    note: integrationStatus.lastInvoiceAt
                      ? `Sist oppdatert ${formatDate(integrationStatus.lastInvoiceAt)}`
                      : 'Ingen fakturaer opprettet ennå',
                  },
                ].map((item) => (
                  <Card key={item.label} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.5 }}>{item.value}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.note}</Typography>
                    </CardContent>
                  </Card>
                ))}
                <Box sx={{ gridColumn: { md: '1 / -1' }, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    Koble fra testmiljø
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Firmanavn"
                  value={formState.businessName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, businessName: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Organisasjonsnummer"
                  value={formState.organizationNumber}
                  onChange={(event) => setFormState((prev) => ({ ...prev, organizationNumber: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Kontaktperson"
                  value={formState.contactName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, contactName: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Kontakt-e-post"
                  value={formState.contactEmail}
                  onChange={(event) => setFormState((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Telefon"
                  value={formState.contactPhone}
                  onChange={(event) => setFormState((prev) => ({ ...prev, contactPhone: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Adresse"
                  value={formState.addressLine1}
                  onChange={(event) => setFormState((prev) => ({ ...prev, addressLine1: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Postnummer"
                  value={formState.postalCode}
                  onChange={(event) => setFormState((prev) => ({ ...prev, postalCode: event.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Poststed"
                  value={formState.city}
                  onChange={(event) => setFormState((prev) => ({ ...prev, city: event.target.value }))}
                  fullWidth
                />
                <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                  <Button
                    variant="contained"
                    startIcon={connectMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Sync />}
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending || !integrationStatus?.configured}
                    sx={{ bgcolor: accentColor, '&:hover': { bgcolor: accentColor } }}
                  >
                    Koble til Tripletex testmiljø
                  </Button>
                </Box>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1.1fr 0.9fr' },
          gap: 2,
        }}
      >
        <Card sx={{ borderRadius: 3, border: '1px solid #e7ecf3' }}>
          <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Description sx={{ color: accentColor }} />
                Faktura
              </Typography>
              {acceptedQuotes.length === 0 ? (
                <Alert severity="info">Ingen godkjente tilbud er klare for fakturering ennå.</Alert>
              ) : (
                acceptedQuotes.slice(0, 6).map((quote) => (
                  <Box key={quote.id} sx={{ p: 2, border: '1px solid #e7ecf3', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {quote.title || quote.quoteNumber}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {quote.clientName || 'Kunde ikke registrert'} · {formatAmount(quote.totalAmount, 'NOK')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Godkjent {formatDate(quote.acceptedAt)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        {quote.tripletexInvoiceId ? (
                          <>
                            <Chip label={`Tripletex ${quote.tripletexInvoiceNumber || quote.tripletexInvoiceId}`} color="success" />
                            {quote.tripletexInvoiceUrl ? (
                              <Button
                                size="small"
                                variant="outlined"
                                component="a"
                                href={quote.tripletexInvoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Faktura-PDF
                              </Button>
                            ) : null}
                            {quote.tripletexVoucherUrl ? (
                              <Button
                                size="small"
                                variant="outlined"
                                component="a"
                                href={quote.tripletexVoucherUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Bilag
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={
                              createInvoiceMutation.isPending || integrationStatus?.status !== 'connected'
                            }
                            onClick={() => createInvoiceMutation.mutate(quote.id)}
                            sx={{ bgcolor: accentColor, '&:hover': { bgcolor: accentColor } }}
                          >
                            Opprett fakturautkast
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, border: '1px solid #e7ecf3' }}>
          <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptLong sx={{ color: accentColor }} />
                Betaling og historikk
              </Typography>
              {subscription ? (
                <Box sx={{ p: 2, border: '1px solid #e7ecf3', borderRadius: 2, bgcolor: alpha(accentColor, 0.03) }}>
                  <Typography variant="caption" color="text.secondary">Aktivt abonnement</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {subscription.planName || subscription.selectedPlan || 'Ikke valgt'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatAmount(subscription.amount, subscription.currency || 'NOK')}
                    {subscription.nextBillingDate ? ` · Neste trekk ${formatDate(subscription.nextBillingDate)}` : ''}
                  </Typography>
                </Box>
              ) : null}
              {latestPayment ? (
                <Box sx={{ p: 2, border: '1px solid #e7ecf3', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Siste betaling</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {latestPayment.planName || latestPayment.planId || 'Betaling'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatAmount(latestPayment.amount, latestPayment.currency || 'NOK')} · {formatDate(latestPayment.createdAt)}
                  </Typography>
                </Box>
              ) : null}
              {recentPayments.length === 0 ? (
                <Alert severity="info">Ingen betalinger registrert ennå.</Alert>
              ) : (
                recentPayments.slice(0, 6).map((payment) => (
                  <Box key={payment.id} sx={{ p: 2, border: '1px solid #e7ecf3', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {payment.planName || payment.planId || 'Betaling'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatAmount(payment.amount, payment.currency || 'NOK')} · {formatDate(payment.createdAt)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
                      {payment.receiptUrl ? (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Kvittering
                        </Button>
                      ) : null}
                      {payment.invoiceUrl ? (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Regnskapsgrunnlag
                        </Button>
                      ) : null}
                      {payment.refundRequestStatus === 'pending' ? (
                        <Chip size="small" color="warning" label="Refundering behandles" />
                      ) : null}
                      {payment.refunded ? <Chip size="small" color="success" label="Refundert" /> : null}
                    </Box>
                  </Box>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ borderRadius: 3, border: '1px solid #e7ecf3' }}>
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ color: accentColor }} />
              Regnskapsgrunnlag
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Når faktura og betaling er registrert, dukker kvittering, faktura-PDF og bilag opp her. Dette gjør det enklere
              å bygge videre mot Fiken eller Tripletex-produksjon senere.
            </Typography>
            {documentsReadyCount === 0 ? (
              <Alert severity="info">Ingen dokumenter er klare ennå. Koble opp Tripletex og opprett første fakturautkast.</Alert>
            ) : (
              <Stack spacing={1.25}>
                {acceptedQuotes
                  .filter((quote) => quote.tripletexInvoiceUrl || quote.tripletexVoucherUrl)
                  .slice(0, 6)
                  .map((quote) => (
                    <Box
                      key={`${quote.id}-docs`}
                      sx={{ p: 2, border: '1px solid #e7ecf3', borderRadius: 2, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {quote.title || quote.quoteNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {quote.tripletexInvoiceNumber ? `Faktura ${quote.tripletexInvoiceNumber}` : 'Fakturautkast'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {quote.tripletexInvoiceUrl ? (
                          <Button size="small" variant="outlined" component="a" href={quote.tripletexInvoiceUrl} target="_blank" rel="noreferrer" startIcon={<LinkIcon />}>
                            Faktura
                          </Button>
                        ) : null}
                        {quote.tripletexVoucherUrl ? (
                          <Button size="small" variant="outlined" component="a" href={quote.tripletexVoucherUrl} target="_blank" rel="noreferrer" startIcon={<LinkIcon />}>
                            Bilag
                          </Button>
                        ) : null}
                      </Box>
                    </Box>
                  ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
