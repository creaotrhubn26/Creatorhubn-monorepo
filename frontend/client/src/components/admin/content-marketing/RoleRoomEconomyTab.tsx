import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RestoreIcon from '@mui/icons-material/Restore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SyncIcon from '@mui/icons-material/Sync';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import {
  AreaChart, Area, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from 'recharts';
import {
  roleRoomEconomyApi,
  platformFixedCostsApi,
  PLATFORM_COST_CATEGORY_LABELS,
  PLATFORM_COST_ALLOCATION_LABELS,
  type PlatformCostAllocation,
  type PlatformCostCategory,
  type PlatformFixedCost,
  type PlatformFixedCostInput,
  type RoleRoomEconomyAggregate,
  type RoleRoomSubscriber,
  type RoleRoomSubscriberDetail,
  type RoleRoomTimeseriesPoint,
} from '../../../services/adminRoomApi';
import PlatformStatusCard from './PlatformStatusCard';
import MigrationsCard from './MigrationsCard';
import RoleRoomBillingHealthCard from './RoleRoomBillingHealthCard';

/**
 * Role Room økonomi-tab — Stripe-subscribers, kostnads-margin og plattform-kostnader
 * i én sammenhengende admin-flate (kun produkteier).
 *
 * Stadie A: subscribers-tabell + filter
 * Stadie B: per-bruker detalj-drawer med invoices, AI-bruk og payment methods
 * Stadie C: aggregert KPI + 12-mnd MRR/kost-tidsserie + plattform-kostnader CRUD
 * Actions: pause / resume / cancel (soft+immediate) / reactivate Stripe-subs
 */

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  trialing: '#fbbf24',
  past_due: '#f97316',
  canceled: '#94a3b8',
  unpaid: '#ef4444',
  paused: '#a78bfa',
  incomplete: '#64748b',
  incomplete_expired: '#475569',
  no_subscription: '#64748b',
};

const usd = (n: number) => `$${(n ?? 0).toLocaleString('nb-NO', { maximumFractionDigits: 2 })}`;
const usdCents = (n: number) => n < 0.5 ? `$${(n * 100).toFixed(1)}¢` : usd(n);
const nok = (n: number) => `${(n ?? 0).toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr`;
const pct = (n: number | null | undefined, digits = 1) => n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(digits)}%`;

export function RoleRoomEconomyTab() {
  const [aggregate, setAggregate] = useState<RoleRoomEconomyAggregate | null>(null);
  const [timeseries, setTimeseries] = useState<RoleRoomTimeseriesPoint[]>([]);
  const [subscribers, setSubscribers] = useState<RoleRoomSubscriber[]>([]);
  const [fixedCosts, setFixedCosts] = useState<PlatformFixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<RoleRoomSubscriberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMenuFor, setActionMenuFor] = useState<{ subscriptionId: string; anchor: HTMLElement } | null>(null);
  const [costDialog, setCostDialog] = useState<{ open: boolean; initial: PlatformFixedCost | null }>({ open: false, initial: null });
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'pause' | 'resume' | 'cancel' | 'cancel_immediate' | 'reactivate'; subscriptionId: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agg, ts, subs, costs] = await Promise.all([
        roleRoomEconomyApi.aggregate(),
        roleRoomEconomyApi.timeseries(),
        roleRoomEconomyApi.subscribers(),
        platformFixedCostsApi.list().catch(() => []),
      ]);
      setAggregate(agg);
      setTimeseries(ts.months);
      setSubscribers(subs.items);
      setFixedCosts(costs);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente Stripe + DB-data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredSubscribers = useMemo(() => {
    if (statusFilter === 'all') return subscribers;
    return subscribers.filter((s) => s.status === statusFilter);
  }, [subscribers, statusFilter]);

  async function loadDetail(userId: string) {
    setDetailUserId(userId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const data = await roleRoomEconomyApi.subscriber(userId);
      setDetailData(data);
    } catch (err) {
      setError((err as Error).message);
      setDetailUserId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function executeAction(kind: 'pause' | 'resume' | 'cancel' | 'cancel_immediate' | 'reactivate', subscriptionId: string) {
    try {
      switch (kind) {
        case 'pause': await roleRoomEconomyApi.pauseSubscription(subscriptionId); break;
        case 'resume': await roleRoomEconomyApi.resumeSubscription(subscriptionId); break;
        case 'cancel': await roleRoomEconomyApi.cancelSubscription(subscriptionId, { immediate: false }); break;
        case 'cancel_immediate': await roleRoomEconomyApi.cancelSubscription(subscriptionId, { immediate: true }); break;
        case 'reactivate': await roleRoomEconomyApi.reactivateSubscription(subscriptionId); break;
      }
      setSnackbar(`Subscription ${kind === 'pause' ? 'pauset' : kind === 'resume' ? 'gjenopptatt' : kind === 'cancel' ? 'kanselleres ved periode-slutt' : kind === 'cancel_immediate' ? 'kansellert umiddelbart' : 'reaktivert'}`);
      await refresh();
      if (detailUserId) await loadDetail(detailUserId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}

      <PlatformStatusCard />
      <MigrationsCard />
      <RoleRoomBillingHealthCard />

      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
            Role Room økonomi — Stripe, kostnader, margin
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.88rem' }}>
            Full P&L for theroleroom.com: revenue fra Stripe, AI-tokens fra Claude, hosting og
            allokert andel av plattform-kostnader (Vercel, Render, Claude Pro Max, etc.).
          </Typography>
        </Box>
        <Button variant="outlined" onClick={refresh} disabled={loading} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {loading ? 'Henter …' : 'Oppdater'}
        </Button>
      </Stack>

      {/* ── KPI ────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(6, 1fr)' }, gap: 1.5, mb: 3 }}>
        <Kpi label="MRR" valueMain={aggregate ? usd(aggregate.mrrUsd) : '—'} valueSub={aggregate ? nok(aggregate.mrrNok) : ''} accent="#22c55e" />
        <Kpi label="ARR" valueMain={aggregate ? usd(aggregate.arrUsd) : '—'} valueSub={aggregate ? nok(aggregate.arrNok) : ''} accent="#06b6d4" />
        <Kpi label="Aktive" valueMain={String(aggregate?.activeCount ?? 0)} valueSub={`+${aggregate?.trialingCount ?? 0} trial`} accent="#a78bfa" />
        <Kpi label="Churn 30d" valueMain={pct(aggregate?.churnRatePct, 1)} valueSub={`${aggregate?.canceledLast30d ?? 0} kansellert`} accent={(aggregate?.churnRatePct ?? 0) > 5 ? '#ef4444' : '#fbbf24'} />
        <Kpi label="Total kost 30d" valueMain={aggregate ? usd(aggregate.totalCostUsd30d) : '—'} valueSub={aggregate ? `AI ${usdCents(aggregate.aiCostUsd30d)} + Plf ${usdCents(aggregate.platformFixedCostsUsd30d)}` : ''} accent="#f97316" />
        <Kpi label="Margin" valueMain={pct(aggregate?.marginPct, 1)} valueSub={aggregate ? usd(aggregate.marginUsd30d) : ''} accent={(aggregate?.marginPct ?? 0) >= 50 ? '#22c55e' : (aggregate?.marginPct ?? 0) >= 0 ? '#fbbf24' : '#ef4444'} />
      </Box>

      {/* ── Tidsserie ────────────────────────────────────────── */}
      <Paper sx={{ p: 2.5, bgcolor: 'rgba(15,23,42,0.5)', mb: 3 }}>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', mb: 1.5 }}>
          MRR + AI-kost siste 12 måneder
        </Typography>
        <Box sx={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="monthLabel" stroke="rgba(226,232,240,0.7)" fontSize={11} />
              <YAxis stroke="rgba(226,232,240,0.7)" fontSize={11} tickFormatter={(v) => usdCents(v)} />
              <RTooltip
                contentStyle={{ backgroundColor: 'rgba(2,6,23,0.95)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 6 }}
                labelStyle={{ color: '#fff' }}
                formatter={(value) => usd(Number(value))}
              />
              <Legend wrapperStyle={{ color: 'rgba(226,232,240,0.85)' }} />
              <Area type="monotone" dataKey="mrrUsd" name="MRR" stroke="#22c55e" fill="url(#mrrGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="aiCostUsd" name="AI-kost" stroke="#f97316" fill="url(#costGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ height: 200, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="monthLabel" stroke="rgba(226,232,240,0.7)" fontSize={11} />
              <YAxis stroke="rgba(226,232,240,0.7)" fontSize={11} />
              <RTooltip
                contentStyle={{ backgroundColor: 'rgba(2,6,23,0.95)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 6 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: 'rgba(226,232,240,0.85)' }} />
              <Bar dataKey="newCount" name="Nye" fill="#22c55e" />
              <Bar dataKey="churnCount" name="Churn" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Paper>

      {/* ── Plattform-kostnader ──────────────────────────────── */}
      <Paper sx={{ p: 2.5, bgcolor: 'rgba(15,23,42,0.5)', mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
              Plattform-kostnader
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem' }}>
              Faste månedlige kostnader for verktøy CreatorHub bruker (Claude Pro Max, Vercel, Render, etc).
              Allokert andel trekkes fra Role Room-margin.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <ButtonGroup size="small" variant="outlined">
              <Button
                startIcon={<CloudSyncIcon fontSize="small" />}
                onClick={async () => {
                  try {
                    const r = await platformFixedCostsApi.refreshRender();
                    setSnackbar(`Render: ${r.created} nye, ${r.updated} oppdatert (${r.total} tjenester)`);
                    await refresh();
                  } catch (err) { setError((err as Error).message); }
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Render
              </Button>
              <Button
                startIcon={<SyncIcon fontSize="small" />}
                onClick={async () => {
                  try {
                    const r = await platformFixedCostsApi.refreshNeon();
                    setSnackbar(`Neon: ${r.created} nye, ${r.updated} oppdatert (${r.total} prosjekter)`);
                    await refresh();
                  } catch (err) { setError((err as Error).message); }
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Neon
              </Button>
              <Button
                startIcon={<SyncIcon fontSize="small" />}
                onClick={async () => {
                  try {
                    const r = await platformFixedCostsApi.refreshVercel();
                    setSnackbar(`Vercel: ${r.created} nye, ${r.updated} oppdatert (${r.total} prosjekter)`);
                    await refresh();
                  } catch (err) { setError((err as Error).message); }
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Vercel
              </Button>
            </ButtonGroup>
            <Button
              size="small"
              variant="outlined"
              onClick={async () => {
                const presets: PlatformFixedCostInput[] = [
                  { name: 'Claude Max 20x', vendor: 'Anthropic', category: 'ai', amountUsdMonthly: 200, allocationMethod: 'total_platform', roleRoomSharePct: 25, billingInterval: 'monthly', active: true, notes: 'Daniels personlige Claude Max 20x ($200/mnd per Anthropic-prisliste 2026). Justér share-% basert på hvor mye Claude-tid som brukes mot Role Room vs. andre produkter.' },
                  { name: 'Vercel Pro', vendor: 'Vercel', category: 'hosting', amountUsdMonthly: 20, allocationMethod: 'total_platform', roleRoomSharePct: 30, billingInterval: 'monthly', active: true, notes: 'Frontend hosting (creatorhub-frontend). Pro starter på $20/seat/mnd + usage-overage — sjekk faktisk faktura på vercel.com/account/billing.' },
                  { name: 'Render — backend (Standard)', vendor: 'Render', category: 'hosting', amountUsdMonthly: 25, allocationMethod: 'total_platform', roleRoomSharePct: 40, billingInterval: 'monthly', active: true, notes: 'Web service srv-d47s5lur433s739mr9j0 — Standard plan ($25/mnd). Deler backend mellom RR / CreatorHub / Post Agent.' },
                  { name: 'Render — creatorhub-backend (Starter)', vendor: 'Render', category: 'hosting', amountUsdMonthly: 7, allocationMethod: 'total_platform', roleRoomSharePct: 30, billingInterval: 'monthly', active: true, notes: 'Web service — Starter plan ($7/mnd).' },
                  { name: 'Render — gfpgan-runner (Standard)', vendor: 'Render', category: 'hosting', amountUsdMonthly: 25, allocationMethod: 'total_platform', roleRoomSharePct: 5, billingInterval: 'monthly', active: true, notes: 'AI image-processing runner — Standard plan ($25/mnd). Hovedsakelig CreatorHub Photo Enhancer, lav RR-share.' },
                  { name: 'Render — tidum-backend (Starter)', vendor: 'Render', category: 'hosting', amountUsdMonthly: 7, allocationMethod: 'total_platform', roleRoomSharePct: 0, billingInterval: 'monthly', active: true, notes: 'Tidum-spesifikk backend — ikke Role Room. Lar stå med 0% share.' },
                  { name: 'Render — Redis (Starter)', vendor: 'Render', category: 'database', amountUsdMonthly: 10, allocationMethod: 'total_platform', roleRoomSharePct: 30, billingInterval: 'monthly', active: true, notes: 'Redis Key-Value Starter ($10/mnd). Cache + sessions delt.' },
                  { name: 'Render — Postgres tidum-db (Basic 256MB)', vendor: 'Render', category: 'database', amountUsdMonthly: 10, allocationMethod: 'total_platform', roleRoomSharePct: 0, billingInterval: 'monthly', active: true, notes: 'Postgres Basic 256MB + 15GB disk (~$10/mnd). Tidum-spesifikk, 0% RR.' },
                  { name: 'Neon — creatorhubn.com', vendor: 'Neon', category: 'database', amountUsdMonthly: 19, allocationMethod: 'total_platform', roleRoomSharePct: 40, billingInterval: 'monthly', active: true, notes: 'pg17, autoscale 0.25-8 CU, ~300 CU-hours/mnd. Antar Launch-plan ($19) — bytt til Scale ($69) hvis du går over 300h. Sjekk console.neon.tech/app/billing.' },
                  { name: 'Google Workspace Business Plus', vendor: 'Google', category: 'email', amountUsdMonthly: 22, allocationMethod: 'total_platform', roleRoomSharePct: 25, billingInterval: 'monthly', active: true, notes: '~€21.10/bruker/mnd i Norge. Multipliser med antall seats.' },
                  { name: 'Stripe (per-transaksjon)', vendor: 'Stripe', category: 'other', amountUsdMonthly: 0, allocationMethod: 'role_room_only', roleRoomSharePct: 100, billingInterval: 'monthly', active: false, notes: '1.4% + 1.80 kr per Stripe-betaling fra EU-kort. Variabel — la stå aktiv=AV til du har faktisk MRR å multiplisere med.' },
                  { name: 'Cloudflare', vendor: 'Cloudflare', category: 'cdn', amountUsdMonthly: 0, allocationMethod: 'total_platform', roleRoomSharePct: 30, billingInterval: 'monthly', active: false, notes: 'DNS/WAF/edge. Aktiver hvis du har Pro/Business-plan ($20-200/mnd).' },
                ];
                if (!window.confirm(`Legge til ${presets.length} standard-rader basert på faktisk infrastruktur (Claude $200, Vercel, 6× Render-tjenester, Neon, Google Workspace, Stripe, Cloudflare)? Du editerer priser/share% etterpå.`)) return;
                try {
                  for (const preset of presets) {
                    await platformFixedCostsApi.create(preset);
                  }
                  setSnackbar(`${presets.length} standard-rader lagt til — editér priser per rad`);
                  await refresh();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 700, color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.5)' }}
            >
              Seed standard-rader
            </Button>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setCostDialog({ open: true, initial: null })} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
              Ny kostnad
            </Button>
          </Stack>
        </Stack>

        {aggregate ? (
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 2 }}>
            <Chip label={`Allokert Role Room: ${usd(aggregate.platformFixedCostsUsd30d)}/mnd`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#fca5a5', fontWeight: 700 }} />
            <Chip label={`Total plattform: ${usd(aggregate.platformFixedCostsTotalMonthlyUsd)}/mnd`} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.2)', color: '#cbd5e1', fontWeight: 700 }} />
            {Object.entries(aggregate.fixedCostsByCategoryUsd).map(([cat, amount]) => (
              <Chip key={cat} label={`${PLATFORM_COST_CATEGORY_LABELS[cat as PlatformCostCategory] ?? cat}: ${usd(amount)}`} size="small" sx={{ bgcolor: 'rgba(167,139,250,0.15)', color: '#c4b5fd', fontWeight: 600, fontSize: '0.72rem' }} />
            ))}
          </Stack>
        ) : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Tjeneste</TableCell>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Kategori</TableCell>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Allokering</TableCell>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>USD/mnd</TableCell>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Aktiv</TableCell>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700, width: 110 }}>—</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fixedCosts.length === 0 ? (
                <TableRow><TableCell colSpan={6} sx={{ color: 'rgba(203,213,225,0.55)', textAlign: 'center', py: 3 }}>Ingen plattform-kostnader registrert. Legg til Claude Pro Max, Vercel Pro, Render osv.</TableCell></TableRow>
              ) : fixedCosts.map((cost) => (
                <TableRow key={cost.id} hover>
                  <TableCell sx={{ color: '#fff' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{cost.name}</Typography>
                    {cost.vendor ? <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.74rem' }}>{cost.vendor}</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>{PLATFORM_COST_CATEGORY_LABELS[cost.category]}</TableCell>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>
                    {PLATFORM_COST_ALLOCATION_LABELS[cost.allocation_method].split(' (')[0]}
                    {cost.allocation_method === 'total_platform' ? <Typography component="span" sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem', ml: 0.5 }}>({cost.role_room_share_pct}%)</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>
                    {usd(Number(cost.amount_usd_monthly))}
                    {cost.billing_interval === 'yearly' ? <Typography component="span" sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.7rem', ml: 0.5 }}>(årlig faktura)</Typography> : null}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={cost.active ? 'Aktiv' : 'Pauset'} sx={{ bgcolor: cost.active ? 'rgba(34,197,94,0.18)' : 'rgba(148,163,184,0.2)', color: cost.active ? '#bbf7d0' : '#cbd5e1', fontWeight: 700 }} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => setCostDialog({ open: true, initial: cost })}><EditOutlinedIcon fontSize="small" sx={{ color: '#c4b5fd' }} /></IconButton>
                      <IconButton size="small" onClick={async () => {
                        if (!window.confirm(`Slette ${cost.name}?`)) return;
                        try { await platformFixedCostsApi.remove(cost.id); await refresh(); } catch (e) { setError((e as Error).message); }
                      }}><DeleteOutlineIcon fontSize="small" sx={{ color: 'rgba(248,113,113,0.85)' }} /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Subscribers ──────────────────────────────────────── */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
          Subscribers ({filteredSubscribers.length})
        </Typography>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(String(e.target.value))}>
            <MenuItem value="all">Alle statuser</MenuItem>
            <MenuItem value="active">Aktive</MenuItem>
            <MenuItem value="trialing">Trial</MenuItem>
            <MenuItem value="past_due">Past due</MenuItem>
            <MenuItem value="canceled">Kansellert</MenuItem>
            <MenuItem value="paused">Pauset</MenuItem>
            <MenuItem value="unpaid">Ubetalt</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <TableContainer component={Paper} sx={{ bgcolor: 'rgba(15,23,42,0.5)' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Kunde</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Plan</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>MRR-bidrag</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>AI-kost 30d</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Margin %</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700, width: 140 }}>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} sx={{ color: 'rgba(226,232,240,0.6)', textAlign: 'center', py: 4 }}>Henter fra Stripe …</TableCell></TableRow>
            ) : filteredSubscribers.length === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: 'rgba(226,232,240,0.6)', textAlign: 'center', py: 4 }}>Ingen subscribers matcher filteret.</TableCell></TableRow>
            ) : (
              filteredSubscribers.map((row) => (
                <TableRow key={`${row.customerId}-${row.subscriptionId ?? 'none'}`} hover>
                  <TableCell sx={{ color: '#fff' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                      {row.customerName || row.firstName || row.customerEmail || row.customerId.slice(0, 12)}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.74rem' }}>
                      {row.customerEmail}{row.profession ? ` · ${row.profession}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status}
                      sx={{ bgcolor: `${STATUS_COLORS[row.status] ?? '#64748b'}22`, color: STATUS_COLORS[row.status] ?? '#cbd5e1', fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>
                    {row.planNickname ?? '—'}
                    {row.interval ? <Typography component="span" sx={{ color: 'rgba(203,213,225,0.5)', fontSize: '0.7rem', ml: 0.5 }}>/{row.interval}</Typography> : null}
                  </TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>{usd(row.monthlyContributionUsd)}</TableCell>
                  <TableCell sx={{ color: row.aiCostUsd30d > row.monthlyContributionUsd ? '#fca5a5' : 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>{usdCents(row.aiCostUsd30d)}</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem', color: (row.marginPct ?? 0) >= 50 ? '#22c55e' : (row.marginPct ?? 0) >= 0 ? '#fbbf24' : '#ef4444' }}>
                    {pct(row.marginPct)}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {row.userId ? (
                        <Tooltip title="Detalj-visning">
                          <IconButton size="small" onClick={() => loadDetail(row.userId!)}><OpenInNewIcon fontSize="small" sx={{ color: '#7dd3fc' }} /></IconButton>
                        </Tooltip>
                      ) : null}
                      {row.subscriptionId ? (
                        <Tooltip title="Stripe-handlinger">
                          <IconButton size="small" onClick={(e) => setActionMenuFor({ subscriptionId: row.subscriptionId!, anchor: e.currentTarget })}>
                            <MoreVertIcon fontSize="small" sx={{ color: '#c4b5fd' }} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        open={actionMenuFor !== null}
        anchorEl={actionMenuFor?.anchor}
        onClose={() => setActionMenuFor(null)}
      >
        <MenuItem onClick={() => { if (actionMenuFor) setConfirmAction({ kind: 'pause', subscriptionId: actionMenuFor.subscriptionId }); setActionMenuFor(null); }}>
          <PauseCircleIcon fontSize="small" sx={{ mr: 1 }} /> Pause innkreving
        </MenuItem>
        <MenuItem onClick={() => { if (actionMenuFor) setConfirmAction({ kind: 'resume', subscriptionId: actionMenuFor.subscriptionId }); setActionMenuFor(null); }}>
          <PlayCircleIcon fontSize="small" sx={{ mr: 1 }} /> Gjenoppta
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { if (actionMenuFor) setConfirmAction({ kind: 'cancel', subscriptionId: actionMenuFor.subscriptionId }); setActionMenuFor(null); }}>
          <CancelIcon fontSize="small" sx={{ mr: 1, color: '#fbbf24' }} /> Kanseller ved periode-slutt
        </MenuItem>
        <MenuItem onClick={() => { if (actionMenuFor) setConfirmAction({ kind: 'cancel_immediate', subscriptionId: actionMenuFor.subscriptionId }); setActionMenuFor(null); }}>
          <CancelIcon fontSize="small" sx={{ mr: 1, color: '#ef4444' }} /> Kanseller umiddelbart
        </MenuItem>
        <MenuItem onClick={() => { if (actionMenuFor) setConfirmAction({ kind: 'reactivate', subscriptionId: actionMenuFor.subscriptionId }); setActionMenuFor(null); }}>
          <RestoreIcon fontSize="small" sx={{ mr: 1, color: '#22c55e' }} /> Reaktiver
        </MenuItem>
      </Menu>

      <Dialog open={confirmAction !== null} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Bekreft handling</DialogTitle>
        <DialogContent>
          <Typography>
            {confirmAction?.kind === 'pause' && 'Pause innkreving — Stripe vil ikke fakturere før gjenopptatt.'}
            {confirmAction?.kind === 'resume' && 'Gjenoppta innkreving — neste faktura kjører som normalt.'}
            {confirmAction?.kind === 'cancel' && 'Kunden beholder tilgang ut perioden, fornyes ikke etterpå.'}
            {confirmAction?.kind === 'cancel_immediate' && 'IRREVERSIBELT — subscription kanselleres umiddelbart. Ingen refund.'}
            {confirmAction?.kind === 'reactivate' && 'Fjerner cancel-at-period-end — subscription fornyes som normalt.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Avbryt</Button>
          <Button
            variant="contained"
            color={confirmAction?.kind === 'cancel_immediate' ? 'error' : 'primary'}
            onClick={async () => {
              if (!confirmAction) return;
              const action = confirmAction;
              setConfirmAction(null);
              await executeAction(action.kind, action.subscriptionId);
            }}
          >
            Bekreft
          </Button>
        </DialogActions>
      </Dialog>

      <SubscriberDetailDialog
        open={detailUserId !== null}
        loading={detailLoading}
        data={detailData}
        onClose={() => { setDetailUserId(null); setDetailData(null); }}
      />

      <PlatformCostDialog
        open={costDialog.open}
        initial={costDialog.initial}
        onClose={() => setCostDialog({ open: false, initial: null })}
        onSaved={async () => { setCostDialog({ open: false, initial: null }); await refresh(); }}
      />

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

function Kpi({ label, valueMain, valueSub, accent }: { label: string; valueMain: string; valueSub?: string; accent: string }) {
  return (
    <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: `${accent}10`, border: `1px solid ${accent}30` }}>
      <Typography sx={{ color: accent, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ color: '#fff', fontSize: { xs: '1.15rem', md: '1.45rem' }, fontWeight: 800, lineHeight: 1.1 }}>{valueMain}</Typography>
      {valueSub ? <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.74rem', mt: 0.5 }}>{valueSub}</Typography> : null}
    </Box>
  );
}

function SubscriberDetailDialog({ open, loading, data, onClose }: { open: boolean; loading: boolean; data: RoleRoomSubscriberDetail | null; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {data ? `${data.user.first_name ?? ''} ${data.user.last_name ?? ''}`.trim() || data.user.email : 'Henter…'}
          </Typography>
          {data ? <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.78rem' }}>{data.user.email} · {data.user.profession ?? 'ingen profession'}</Typography> : null}
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {loading || !data ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.6)', textAlign: 'center', py: 6 }}>Henter Stripe + AI-bruk …</Typography>
        ) : (
          <Stack spacing={2.5} sx={{ pt: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
              <Kpi label="MRR-bidrag" valueMain={usd(data.economy.monthlyContributionUsd)} accent="#22c55e" />
              <Kpi label="Lifetime" valueMain={usd(data.economy.lifetimeRevenueUsd)} accent="#06b6d4" />
              <Kpi label="AI-kost 30d" valueMain={usdCents(data.economy.aiCostUsd30d)} valueSub={`${data.economy.aiUsageByDay.length} aktive dager`} accent="#f97316" />
              <Kpi label="Margin" valueMain={pct(data.economy.marginPct)} valueSub={usd(data.economy.marginUsd30d)} accent={(data.economy.marginPct ?? 0) >= 0 ? '#22c55e' : '#ef4444'} />
            </Box>

            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1, fontSize: '0.9rem' }}>Subscriptions ({data.subscriptions.length})</Typography>
              {data.subscriptions.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.82rem' }}>Ingen subscription i Stripe.</Typography> : data.subscriptions.map((sub) => (
                <Box key={sub.id} sx={{ p: 1.5, mb: 1, borderRadius: 1, border: '1px solid rgba(148,163,184,0.14)', bgcolor: 'rgba(15,23,42,0.4)' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Chip size="small" label={sub.status} sx={{ bgcolor: `${STATUS_COLORS[sub.status] ?? '#64748b'}22`, color: STATUS_COLORS[sub.status] ?? '#cbd5e1', fontWeight: 700, fontSize: '0.7rem' }} />
                    <Typography sx={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600 }}>{sub.priceNickname ?? sub.id.slice(0, 16)}</Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.82rem' }}>{usd(sub.priceUsd)}/{sub.interval}</Typography>
                    {sub.cancelAtPeriodEnd ? <Chip size="small" label="cancels @ period end" sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fde68a', fontWeight: 700, fontSize: '0.68rem' }} /> : null}
                  </Stack>
                  {sub.currentPeriodEnd ? <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.74rem', mt: 0.5 }}>Neste fornyelse: {new Date(sub.currentPeriodEnd).toLocaleString('nb-NO')}</Typography> : null}
                </Box>
              ))}
            </Box>

            {data.upcomingInvoice ? (
              <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid rgba(34,197,94,0.3)', bgcolor: 'rgba(34,197,94,0.06)' }}>
                <Typography sx={{ color: '#bbf7d0', fontWeight: 700, fontSize: '0.85rem' }}>Kommende faktura</Typography>
                <Typography sx={{ color: '#fff', fontSize: '0.92rem' }}>{usd(data.upcomingInvoice.total)} {data.upcomingInvoice.periodEnd ? `· ${new Date(data.upcomingInvoice.periodEnd).toLocaleDateString('nb-NO')}` : ''}</Typography>
              </Box>
            ) : null}

            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1, fontSize: '0.9rem' }}>AI-kost siste 30d per feature</Typography>
              {data.economy.aiUsageByFeature.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.82rem' }}>Ingen AI-bruk registrert.</Typography> : (
                <TableContainer>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>Feature</TableCell>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>Antall</TableCell>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>Kost</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {data.economy.aiUsageByFeature.map((f) => (
                        <TableRow key={f.feature}>
                          <TableCell sx={{ color: '#fff', fontSize: '0.82rem' }}>{f.feature}</TableCell>
                          <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>{f.call_count}</TableCell>
                          <TableCell sx={{ color: '#fff', fontSize: '0.82rem' }}>{usdCents(Number(f.cost_usd))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>

            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1, fontSize: '0.9rem' }}>Siste fakturaer ({data.invoices.length})</Typography>
              {data.invoices.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.82rem' }}>Ingen fakturaer.</Typography> : (
                <TableContainer>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>Dato</TableCell>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>Nummer</TableCell>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>Status</TableCell>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>Beløp</TableCell>
                      <TableCell sx={{ color: 'rgba(226,232,240,0.85)' }}>—</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {data.invoices.slice(0, 8).map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.78rem' }}>{new Date(inv.created).toLocaleDateString('nb-NO')}</TableCell>
                          <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.78rem' }}>{inv.number ?? inv.id.slice(0, 12)}</TableCell>
                          <TableCell><Chip size="small" label={inv.status ?? '—'} sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: '#cbd5e1', fontWeight: 700, fontSize: '0.68rem' }} /></TableCell>
                          <TableCell sx={{ color: '#fff', fontSize: '0.82rem' }}>{usd(inv.amountPaid)}</TableCell>
                          <TableCell>
                            {inv.hostedInvoiceUrl ? <IconButton size="small" component="a" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer"><OpenInNewIcon fontSize="small" sx={{ color: '#7dd3fc' }} /></IconButton> : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>

            {data.paymentMethods.length > 0 ? (
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1, fontSize: '0.9rem' }}>Betalingsmetoder</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                  {data.paymentMethods.map((pm) => (
                    <Chip key={pm.id} label={`${pm.brand?.toUpperCase()} •• ${pm.last4} · ${pm.expMonth}/${String(pm.expYear).slice(2)}`} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.15)', color: '#cbd5e1', fontWeight: 600 }} />
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlatformCostDialog({ open, initial, onClose, onSaved }: { open: boolean; initial: PlatformFixedCost | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PlatformFixedCostInput>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        vendor: initial.vendor,
        category: initial.category,
        amountUsdMonthly: Number(initial.amount_usd_monthly),
        amountNativeMonthly: initial.amount_native_monthly ? Number(initial.amount_native_monthly) : null,
        nativeCurrency: initial.native_currency,
        allocationMethod: initial.allocation_method,
        roleRoomSharePct: Number(initial.role_room_share_pct),
        billingInterval: initial.billing_interval,
        active: initial.active,
        startsOn: initial.starts_on,
        endsOn: initial.ends_on,
        notes: initial.notes,
      });
    } else {
      setForm({ category: 'hosting', allocationMethod: 'total_platform', roleRoomSharePct: 25, billingInterval: 'monthly', active: true });
    }
    setError(null);
  }, [open, initial]);

  async function handleSave() {
    if (!form.name?.trim()) { setError('Navn er påkrevd'); return; }
    if (form.amountUsdMonthly == null || form.amountUsdMonthly < 0) { setError('Beløp er påkrevd'); return; }
    setSaving(true); setError(null);
    try {
      if (initial) await platformFixedCostsApi.patch(initial.id, form);
      else await platformFixedCostsApi.create(form);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{initial ? 'Rediger plattform-kostnad' : 'Ny plattform-kostnad'}</span>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label='Tjeneste (f.eks. "Claude Pro Max", "Vercel Pro")' size="small" fullWidth value={form.name ?? ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="Leverandør" size="small" sx={{ flex: 1 }} value={form.vendor ?? ''} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} />
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Kategori</InputLabel>
              <Select label="Kategori" value={form.category ?? 'other'} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as PlatformCostCategory }))}>
                {(Object.keys(PLATFORM_COST_CATEGORY_LABELS) as PlatformCostCategory[]).map((c) => <MenuItem key={c} value={c}>{PLATFORM_COST_CATEGORY_LABELS[c]}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="USD/mnd" size="small" type="number" sx={{ flex: 1 }} value={form.amountUsdMonthly ?? ''} onChange={(e) => setForm((p) => ({ ...p, amountUsdMonthly: e.target.value === '' ? undefined : Number.parseFloat(e.target.value) }))} />
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Faktureringsperiode</InputLabel>
              <Select label="Faktureringsperiode" value={form.billingInterval ?? 'monthly'} onChange={(e) => setForm((p) => ({ ...p, billingInterval: e.target.value as 'monthly' | 'yearly' | 'one_time' }))}>
                <MenuItem value="monthly">Månedlig</MenuItem>
                <MenuItem value="yearly">Årlig (oppgi månedsekvivalent)</MenuItem>
                <MenuItem value="one_time">Engangs</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel>Allokering</InputLabel>
            <Select label="Allokering" value={form.allocationMethod ?? 'total_platform'} onChange={(e) => setForm((p) => ({ ...p, allocationMethod: e.target.value as PlatformCostAllocation }))}>
              {(Object.keys(PLATFORM_COST_ALLOCATION_LABELS) as PlatformCostAllocation[]).map((a) => <MenuItem key={a} value={a}>{PLATFORM_COST_ALLOCATION_LABELS[a]}</MenuItem>)}
            </Select>
          </FormControl>
          {form.allocationMethod === 'total_platform' ? (
            <TextField
              label="Role Room-andel (%)"
              size="small"
              type="number"
              fullWidth
              value={form.roleRoomSharePct ?? 25}
              onChange={(e) => setForm((p) => ({ ...p, roleRoomSharePct: Number.parseFloat(e.target.value) }))}
              helperText="Hvor stor % av kostnaden belastes Role Room (vs. NextRole, Academy, etc.)"
            />
          ) : null}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.active ?? true} onChange={(_e, checked) => setForm((p) => ({ ...p, active: checked }))} />
            <Typography sx={{ fontSize: '0.85rem' }}>Aktiv (trekkes fra margin)</Typography>
          </Stack>
          <TextField label="Notater" size="small" multiline minRows={2} fullWidth value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Avbryt</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          {saving ? 'Lagrer…' : initial ? 'Lagre endringer' : 'Opprett'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RoleRoomEconomyTab;
