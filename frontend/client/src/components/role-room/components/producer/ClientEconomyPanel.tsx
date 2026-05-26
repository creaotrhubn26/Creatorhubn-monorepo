import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { Paid as PaidIcon, AdminPanelSettings as AdminIcon } from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomAdsSpendSummary,
  type RoleRoomApprovalPolicy,
} from '../../services/roleRoomAgentService';
import GrantedAssetsCard from './GrantedAssetsCard';

/**
 * Client-facing economy hub (MedInnova-avtalen §5.3): the simplest possible view
 * of what the agency is spending on the client's behalf and what it costs.
 *   • faktisk annonsekostnad + 20 % påslag per periode
 *   • godkjenningspolicy (kunden bestemmer hvem som godkjenner)
 *   • hvilke sider/kontoer kunden har gitt admin til
 */

const CARD_SX = {
  p: 1.6,
  borderRadius: 2,
  bgcolor: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;
const LABEL = { color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' } as const;
const SUBTLE = { color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' } as const;

const nok = (n: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n || 0);

function lastMonths(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta (Facebook/Instagram)',
  google: 'Google Ads',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

export default function ClientEconomyPanel({
  projectId,
  userRole,
}: {
  projectId: string;
  userRole: string | null;
}) {
  const months = useMemo(() => lastMonths(6), []);
  const [period, setPeriod] = useState(months[0]);
  const [summary, setSummary] = useState<RoleRoomAdsSpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<RoleRoomApprovalPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await roleRoomAgentService.fetchAdsSpendSummary(period);
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setError('Klarte ikke å hente forbruket.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await roleRoomAgentService.fetchApprovalPolicy(projectId);
      if (!cancelled) setPolicy(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const togglePolicy = async (next: boolean) => {
    if (!policy?.canEdit) return;
    setSavingPolicy(true);
    const ok = await roleRoomAgentService.setApprovalPolicy(projectId, next);
    if (ok) setPolicy({ ...policy, requireClientApproval: next });
    setSavingPolicy(false);
  };

  const feeRatePct = summary?.effectiveFeeRate != null ? Math.round(summary.effectiveFeeRate * 100) : 20;
  const platformRows = summary ? Object.entries(summary.perPlatform).filter(([, v]) => Number(v) !== 0) : [];

  return (
    <Stack spacing={1.6} sx={{ p: { xs: 1, sm: 1.5 } }}>
      {/* ── Annonseforbruk + påslag (§5.3) ── */}
      <Stack spacing={1.2} sx={CARD_SX}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <PaidIcon sx={{ fontSize: 20, color: '#86efac' }} />
          <Typography sx={LABEL}>Annonseforbruk</Typography>
          <Box sx={{ flex: 1 }} />
          <FormControl size="small">
            <Select
              value={period}
              onChange={(e) => setPeriod(String(e.target.value))}
              sx={{
                color: '#e2e8f0',
                fontSize: '0.82rem',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
                '.MuiSvgIcon-root': { color: 'rgba(226,232,240,0.6)' },
              }}
            >
              {months.map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Typography sx={SUBTLE}>
          Faktisk annonsekostnad + {feeRatePct}% påslag (eks. mva) — grunnlaget for fakturaen denne perioden.
        </Typography>

        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
            <CircularProgress size={16} sx={{ color: 'rgba(226,232,240,0.6)' }} />
            <Typography sx={SUBTLE}>Henter forbruk …</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : summary ? (
          <Stack spacing={0.5}>
            <Row label="Faktisk annonsekostnad" value={nok(summary.spendNok)} />
            <Row label={`Påslag (${feeRatePct}%)`} value={nok(summary.managementFeeNok)} />
            <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)', my: 0.5 }} />
            <Row label="Sum eks. mva" value={nok(summary.totalClientCostExVatNok)} strong />
            <Row label="Påslag inkl. 25% mva" value={nok(summary.managementFeeInclVatNok)} subtle />

            {platformRows.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography sx={{ ...SUBTLE, mb: 0.5 }}>Påslag per plattform:</Typography>
                {platformRows.map(([platform, fee]) => (
                  <Row
                    key={platform}
                    label={PLATFORM_LABEL[platform] ?? platform}
                    value={nok(Number(fee))}
                    subtle
                  />
                ))}
              </Box>
            )}

            {summary.spendNok === 0 && (
              <Typography sx={{ ...SUBTLE, mt: 0.5 }}>
                Ingen registrert annonsekostnad i denne perioden ennå.
              </Typography>
            )}
          </Stack>
        ) : null}
      </Stack>

      {/* ── Godkjenningspolicy (kunden bestemmer, §5.1) ── */}
      <Stack spacing={1} sx={CARD_SX}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AdminIcon sx={{ fontSize: 20, color: '#93c5fd' }} />
          <Typography sx={LABEL}>Godkjenning av materiell</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Tooltip
            title={
              policy?.canEdit
                ? 'Av: produsenten kan også godkjenne. På: bare du (kunden) godkjenner før publisering.'
                : 'Bare kunden kan endre denne innstillingen.'
            }
          >
            <Box>
              <Switch
                checked={policy?.requireClientApproval ?? true}
                disabled={!policy?.canEdit || savingPolicy}
                onChange={(e) => togglePolicy(e.target.checked)}
              />
            </Box>
          </Tooltip>
          <Box>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
              Krev at kunden godkjenner før publisering
            </Typography>
            <Typography sx={SUBTLE}>
              {policy?.requireClientApproval ?? true
                ? 'På — ingenting publiseres uten din godkjenning (svarer du ikke innen fristen, auto-godkjennes det).'
                : 'Av — produsenten kan også godkjenne og publisere.'}
              {!policy?.canEdit && ' (kun kunden kan endre)'}
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {/* ── Hvilke sider/kontoer kunden har gitt admin til ── */}
      <GrantedAssetsCard />

      {!['client', 'client_reviewer'].includes((userRole ?? '').toLowerCase()) && (
        <Typography sx={{ ...SUBTLE, textAlign: 'center' }}>
          Du ser kundens økonomivisning. Godkjenningspolicy kan kun kunden endre.
        </Typography>
      )}
    </Stack>
  );
}

function Row({
  label,
  value,
  strong,
  subtle,
}: {
  label: string;
  value: string;
  strong?: boolean;
  subtle?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography
        sx={{
          color: subtle ? 'rgba(226,232,240,0.6)' : '#e2e8f0',
          fontSize: subtle ? '0.78rem' : '0.85rem',
          fontWeight: strong ? 800 : 500,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          color: strong ? '#86efac' : subtle ? 'rgba(226,232,240,0.7)' : '#e2e8f0',
          fontSize: strong ? '0.95rem' : '0.85rem',
          fontWeight: strong ? 800 : 600,
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
