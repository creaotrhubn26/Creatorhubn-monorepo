import { useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { roleRoomBillingHealthApi, type RoleRoomBillingHealth, type RoleRoomBillingHealthPriceCheck } from '@/services/adminRoomApi';

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 0.5 }}>
      {ok ? (
        <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18, mt: 0.25 }} />
      ) : (
        <ErrorOutlineIcon sx={{ color: '#f87171', fontSize: 18, mt: 0.25 }} />
      )}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 600 }}>{label}</Typography>
        {detail ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem', mt: 0.25 }}>{detail}</Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function PriceRow({ label, price, mode }: { label: string; price: RoleRoomBillingHealthPriceCheck | null; mode: 'live' | 'test' | 'unknown' }) {
  if (!price) return null;
  if (!price.configured) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 0.5 }}>
        <ErrorOutlineIcon sx={{ color: '#f87171', fontSize: 18, mt: 0.25 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 600 }}>{label}</Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem' }}>
            Pris-ID ikke satt — {mode === 'test' ? 'test-' : ''}checkout vil falle tilbake til price_data ({price.expectedAmountKr} kr).
          </Typography>
        </Box>
      </Stack>
    );
  }
  if (price.exists === false) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 0.5 }}>
        <ErrorOutlineIcon sx={{ color: '#f87171', fontSize: 18, mt: 0.25 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 600 }}>{label}</Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem' }}>
            {price.priceIdPreview} finnes ikke i Stripe — {price.errorMessage || 'ukjent feil'}
          </Typography>
        </Box>
      </Stack>
    );
  }
  const amountOk = price.amountMatchesExpected === true;
  const currencyOk = price.currency === 'nok';
  const intervalOk = price.interval === 'month';
  const activeOk = price.active === true;
  const allOk = amountOk && currencyOk && intervalOk && activeOk;
  const issues: string[] = [];
  if (!amountOk) issues.push(`beløp ${(price.unitAmount ?? 0) / 100} NOK (forventet ${price.expectedAmountKr})`);
  if (!currencyOk) issues.push(`valuta ${price.currency?.toUpperCase() || '?'} (forventet NOK)`);
  if (!intervalOk) issues.push(`interval ${price.interval || '?'} (forventet month)`);
  if (!activeOk) issues.push('ikke aktiv');
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 0.5 }}>
      {allOk ? (
        <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18, mt: 0.25 }} />
      ) : (
        <WarningAmberOutlinedIcon sx={{ color: '#fbbf24', fontSize: 18, mt: 0.25 }} />
      )}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 600 }}>
          {label} — {(price.unitAmount ?? 0) / 100} {price.currency?.toUpperCase()} / {price.interval}
        </Typography>
        <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem' }}>
          {price.priceIdPreview}
          {issues.length > 0 ? ` · ⚠ ${issues.join(', ')}` : ''}
        </Typography>
      </Box>
    </Stack>
  );
}

export function RoleRoomBillingHealthCard() {
  const [data, setData] = useState<RoleRoomBillingHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setLoading(true);
    setError(null);
    try {
      const result = await roleRoomBillingHealthApi.check();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const overallColor =
    data?.overall === 'ok' ? '#34d399' : data?.overall === 'warnings' ? '#fbbf24' : '#f87171';

  return (
    <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.25)' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <HealthAndSafetyOutlinedIcon sx={{ color: '#22d3ee' }} />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>
              Stripe billing-konfig
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem' }}>
              Verifiserer at Stripe-secret, webhook-secret, price-IDs og public-URL er satt riktig.
            </Typography>
          </Box>
        </Stack>
        <Button
          size="small"
          startIcon={loading ? <CircularProgress size={14} sx={{ color: '#22d3ee' }} /> : <RefreshIcon />}
          onClick={runCheck}
          disabled={loading}
          sx={{ textTransform: 'none', color: '#22d3ee', fontWeight: 700, fontSize: '0.84rem' }}
        >
          {loading ? 'Sjekker…' : data ? 'Sjekk på nytt' : 'Kjør sjekk'}
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {data ? (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: `${overallColor}15`, border: `1px solid ${overallColor}40` }}>
            <Chip
              label={data.overall.toUpperCase()}
              size="small"
              sx={{ bgcolor: overallColor, color: '#0a0a0f', fontWeight: 800, fontSize: '0.7rem', height: 22 }}
            />
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 600, flex: 1 }}>
              {data.summary}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem' }}>
              {new Date(data.checkedAt).toLocaleTimeString('nb-NO')}
            </Typography>
          </Stack>

          <Stack divider={<Box sx={{ borderTop: '1px solid rgba(148,163,184,0.1)' }} />}>
            <StatusRow
              label={`Stripe secret key (${data.stripeSecretKey.mode})`}
              ok={data.stripeSecretKey.configured && data.stripeSecretKey.validatedAgainstStripe === true}
              detail={
                !data.stripeSecretKey.configured
                  ? 'Ikke satt'
                  : data.stripeSecretKey.validatedAgainstStripe === false
                    ? `Ugyldig: ${data.stripeSecretKey.errorMessage || 'Stripe avviste'}`
                    : `${data.stripeSecretKey.preview} · validert mot /v1/balance`
              }
            />
            <StatusRow
              label="Webhook secret"
              ok={data.webhookSecret.configured && data.webhookSecret.formatOk}
              detail={
                !data.webhookSecret.configured
                  ? 'Ikke satt'
                  : !data.webhookSecret.formatOk
                    ? 'Mangler whsec_-prefiks'
                    : `${data.webhookSecret.preview} · format OK`
              }
            />
            <PriceRow label="Produksjonsteam-pris (795 kr)" price={data.productionTeamPrice} mode={data.stripeSecretKey.mode} />
            <PriceRow label="Innholdsprodusent-pris (495 kr)" price={data.contentProducerPrice} mode={data.stripeSecretKey.mode} />
            <StatusRow
              label="Public URL"
              ok={data.publicUrl.configured}
              detail={data.publicUrl.value || 'Ikke satt — checkout-return-URL vil feile'}
            />
          </Stack>
        </Box>
      ) : !loading && !error ? (
        <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.84rem' }}>
          Trykk "Kjør sjekk" for å verifisere Stripe-konfigurasjonen.
        </Typography>
      ) : null}
    </Paper>
  );
}

export default RoleRoomBillingHealthCard;
