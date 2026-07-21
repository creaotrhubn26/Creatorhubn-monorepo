/**
 * ControlCenterPanel.tsx
 *
 * CreatorHub Control Center — Fase 1c (byggeplanen): cockpit-flaten som binder
 * seg til Fase 1a+1b-aggregatoren (`/api/control-center/*`). Read-heavy drift-
 * oversikt + tynn handlingsflate (ack/tildel/lukk) over hendelser. Ingen
 * provider-write (flags/rollback = Fase 4).
 *
 * Sub-faner:
 *   - Oversikt     — feilrate-KPI + kilde-status + observability-uttrekk
 *   - Hendelser    — Sentry unresolved + error_log unresolved, med ack-layer
 *   - Helse        — aktive health-prober (API/DB/betaling/frontend/storage…) + oppetid/p95 (Fase 3)
 *   - Deploys      — Render + GitHub Actions + Vercel deploy-tidslinje (read-only)
 *   - Logg         — error_log (backend-feil)
 *
 * Auth: super_admin (håndhevet server-side). apiRequest legger på Bearer +
 * x-user-id fra localStorage.
 */

import * as React from 'react';
import { useState } from 'react';
import {
  Box, Stack, Typography, Chip, Button, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircleOutline as ResolveIcon,
  ReplayCircleFilled as ReopenIcon,
  PersonAddAlt1 as AssignIcon,
  DoneAll as AckIcon,
  OpenInNew as OpenIcon,
  RocketLaunch as DeployIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── Backend-speilende typer ───────────────────────────────────────────────

interface ErrorStats {
  total24h: number;
  unresolvedTotal: number;
  bySource: Array<{ source: string; count: number }>;
  byStatus: Array<{ statusCode: number; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

interface SentryIssue {
  id: string;
  shortId: string | null;
  title: string;
  culprit: string | null;
  level: string | null;
  count: number;
  userCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  permalink: string | null;
}

interface ObservabilityResponse {
  sentryConfigured: boolean;
  errorLog: ErrorStats | null;
  sentry: {
    unresolvedIssues: number;
    events24h: number;
    crashFreeSessionsPct: number | null;
    topIssues: SentryIssue[];
  } | null;
  generatedAt: string;
}

interface IncidentAck {
  incidentId: string;
  source: 'sentry' | 'error_log';
  ackedAt: string | null;
  ackedByUserId: string | null;
  assignedTo: string | null;
  note: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
}

interface Incident {
  incidentId: string;
  source: 'sentry' | 'error_log';
  title: string;
  level: string | null;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  reference: string | null;
  ack: IncidentAck | null;
}

interface IncidentsResponse {
  sentryConfigured: boolean;
  incidents: Incident[];
  generatedAt: string;
}

interface LoggedError {
  id: string;
  level: string;
  source: string;
  statusCode: number | null;
  endpoint: string | null;
  message: string;
  errorName: string | null;
  occurrenceCount: number;
  lastSeenAt: string;
}

interface LogsResponse {
  success: boolean;
  data: LoggedError[];
}

type DeployProvider = 'render' | 'github' | 'vercel';
type DeployStatus = 'live' | 'building' | 'failed' | 'canceled' | 'superseded' | 'unknown';

interface DeployRecord {
  provider: DeployProvider;
  id: string;
  status: DeployStatus;
  rawStatus: string;
  title: string;
  branch: string | null;
  commit: string | null;
  url: string | null;
  author: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}

interface DeploysResponse {
  providers: { render: boolean; github: boolean; vercel: boolean };
  deploys: DeployRecord[];
  anyConfigured: boolean;
  generatedAt: string;
}

type HealthService = 'api' | 'database' | 'payments' | 'frontend' | 'uploads' | 'realtime' | 'workers' | 'ledgerly';
type HealthStatus = 'up' | 'degraded' | 'down' | 'not_configured' | 'unknown';

interface HealthServiceRecord {
  service: HealthService;
  status: HealthStatus;
  latencyMs: number | null;
  detail: string;
  checkedAt: string;
  uptime30d: number | null;
  p95Ms: number | null;
  sampleCount: number;
}

interface HealthResponse {
  services: HealthServiceRecord[];
  overall: HealthStatus;
  generatedAt: string;
}

interface OrgAiSpend {
  organizationId: string | null;
  orgName: string | null;
  planKey: string | null;
  costUsd: number;
  costNok: number;
  calls: number;
  atRisk: boolean;
}

interface AiMarginSummary {
  windowDays: number;
  usdToNok: number;
  alertThresholdNok: number;
  totalCostUsd: number;
  totalCostNok: number;
  totalCalls: number;
  distinctOrgs: number;
  orgsAtRisk: number;
  unattributedCostNok: number;
  generatedAt: string;
}

interface AiMarginResponse {
  summary: AiMarginSummary;
  topConsumers: OrgAiSpend[];
}

interface OrgOverageRow {
  organizationId: string;
  orgName: string | null;
  planId: string | null;
  includedCostNok: number;
  actualCostNok: number;
  overageCostNok: number;
  overageChargeNok: number;
  markup: number;
  stripeCustomerId: string | null;
  needsStripeLink: boolean;
  calls: number;
}

interface AiOverageResponse {
  periodMonth: string;
  usdToNok: number;
  markup: number;
  orgsProcessed: number;
  orgsWithOverage: number;
  totalOverageChargeNok: number;
  orgsMissingStripeLink: number;
  rows: OrgOverageRow[];
  computedAt: string;
}

interface AiBillRow {
  organizationId: string;
  orgName: string | null;
  periodMonth: string;
  overageChargeNok: number;
  meterValue: number;
  stripeCustomerId: string;
  reported: boolean;
  error?: string;
}

interface AiBillResponse {
  enabled: boolean;
  dryRun: boolean;
  meterEventName: string;
  meterUnit: 'nok' | 'oere';
  stripeConfigured: boolean;
  periodMonth: string | null;
  candidates: number;
  reported: number;
  errors: number;
  totalChargeNok: number;
  rows: AiBillRow[];
  ranAt: string;
}

// ─── Hjelpere ──────────────────────────────────────────────────────────────

const POLL_MS = 45_000;

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'nå nettopp';
  if (min < 60) return `for ${min} min siden`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `for ${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  return `for ${days} d siden`;
}

function levelColor(level: string | null): string {
  switch ((level ?? '').toLowerCase()) {
    case 'fatal':
    case 'error': return '#e5484d';
    case 'warning': return '#f5a623';
    case 'info': return '#4c6ef5';
    default: return '#8b8b8b';
  }
}

const SUBTABS = [
  { id: 'overview', label: 'Oversikt' },
  { id: 'incidents', label: 'Hendelser' },
  { id: 'health', label: 'Helse' },
  { id: 'ai-margin', label: 'AI-margin' },
  { id: 'ai-overage', label: 'AI-overage' },
  { id: 'deploys', label: 'Deploys' },
  { id: 'logs', label: 'Logg' },
] as const;
type SubTabId = (typeof SUBTABS)[number]['id'];

const HEALTH_STATUS_META: Record<HealthStatus, { label: string; color: string }> = {
  up: { label: 'Oppe', color: '#3dd68c' },
  degraded: { label: 'Treg', color: '#f5a623' },
  down: { label: 'Nede', color: '#e5484d' },
  not_configured: { label: 'Ikke koblet', color: '#6b6b6b' },
  unknown: { label: 'Ukjent', color: '#8b8b8b' },
};

const HEALTH_SERVICE_LABEL: Record<HealthService, string> = {
  api: 'API',
  database: 'Database',
  payments: 'Betaling',
  frontend: 'Frontend',
  uploads: 'Lagring (B2/R2)',
  realtime: 'Realtime',
  workers: 'Workers',
  ledgerly: 'Ledgerly (regnskap)',
};

const DEPLOY_STATUS_META: Record<DeployStatus, { label: string; color: string }> = {
  live: { label: 'Live', color: '#3dd68c' },
  building: { label: 'Bygger', color: '#4c6ef5' },
  failed: { label: 'Feilet', color: '#e5484d' },
  canceled: { label: 'Avbrutt', color: '#8b8b8b' },
  superseded: { label: 'Erstattet', color: '#6b6b6b' },
  unknown: { label: 'Ukjent', color: '#8b8b8b' },
};

const DEPLOY_PROVIDER_LABEL: Record<DeployProvider, string> = {
  render: 'Render',
  github: 'GitHub',
  vercel: 'Vercel',
};

// ─── KPI-kort ──────────────────────────────────────────────────────────────

const KpiCard: React.FC<{ label: string; value: string; hint?: string; accent?: string }> = ({
  label, value, hint, accent,
}) => (
  <Box
    sx={{
      flex: '1 1 160px', minWidth: 160, p: 2, borderRadius: 2,
      border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)',
    }}
  >
    <Typography sx={{ fontSize: 11, letterSpacing: 1, color: 'text.secondary', textTransform: 'uppercase' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 28, fontWeight: 800, color: accent ?? '#fff', lineHeight: 1.2 }}>
      {value}
    </Typography>
    {hint && <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{hint}</Typography>}
  </Box>
);

// ─── Panel ─────────────────────────────────────────────────────────────────

const ControlCenterPanel: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTabId>('overview');
  const qc = useQueryClient();

  const obs = useQuery<ObservabilityResponse>({
    queryKey: ['/api/control-center/observability'],
    queryFn: () => apiRequest('/api/control-center/observability'),
    refetchInterval: POLL_MS,
  });

  const inc = useQuery<IncidentsResponse>({
    queryKey: ['/api/control-center/incidents'],
    queryFn: () => apiRequest('/api/control-center/incidents'),
    refetchInterval: POLL_MS,
    enabled: subTab === 'incidents' || subTab === 'overview',
  });

  const logs = useQuery<LogsResponse>({
    queryKey: ['/api/control-center/logs'],
    queryFn: () => apiRequest('/api/control-center/logs?hoursAgo=168&limit=200'),
    enabled: subTab === 'logs',
  });

  const deploys = useQuery<DeploysResponse>({
    queryKey: ['/api/control-center/deploys'],
    queryFn: () => apiRequest('/api/control-center/deploys?limit=15'),
    refetchInterval: POLL_MS,
    enabled: subTab === 'deploys',
  });

  const health = useQuery<HealthResponse>({
    queryKey: ['/api/control-center/health'],
    queryFn: () => apiRequest('/api/control-center/health'),
    refetchInterval: POLL_MS,
    enabled: subTab === 'health',
  });

  const aiMargin = useQuery<AiMarginResponse>({
    queryKey: ['/api/control-center/ai-margin'],
    queryFn: () => apiRequest('/api/control-center/ai-margin?windowDays=30&limit=25'),
    refetchInterval: POLL_MS,
    enabled: subTab === 'ai-margin',
  });

  const aiOverage = useQuery<AiOverageResponse>({
    queryKey: ['/api/control-center/ai-overage'],
    queryFn: () => apiRequest('/api/control-center/ai-overage'),
    refetchInterval: POLL_MS,
    enabled: subTab === 'ai-overage',
  });

  const overageCompute = useMutation({
    mutationFn: () =>
      apiRequest('/api/control-center/ai-overage/compute', { method: 'POST', body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['/api/control-center/ai-overage'] }),
  });

  const [billResult, setBillResult] = useState<AiBillResponse | null>(null);
  const overageBill = useMutation<AiBillResponse, Error, { dryRun: boolean }>({
    mutationFn: (vars) =>
      apiRequest('/api/control-center/ai-overage/bill', { method: 'POST', body: { dryRun: vars.dryRun } }),
    onSuccess: (data) => {
      setBillResult(data);
      if (!data.dryRun) void qc.invalidateQueries({ queryKey: ['/api/control-center/ai-overage'] });
    },
  });

  const incidentAction = useMutation({
    mutationFn: (args: { incidentId: string; action: 'ack' | 'resolve' | 'reopen' | 'assign'; assignedTo?: string }) =>
      apiRequest(
        `/api/control-center/incidents/${encodeURIComponent(args.incidentId)}/${args.action}`,
        { method: 'POST', body: args.assignedTo ? { assignedTo: args.assignedTo } : undefined },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['/api/control-center/incidents'] });
      void qc.invalidateQueries({ queryKey: ['/api/control-center/observability'] });
    },
  });

  const sentryConfigured = obs.data?.sentryConfigured ?? false;

  return (
    <Box sx={{ color: '#fff' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>Control Center</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Drift-oversikt · feilrate, hendelser og logg. Kilde: Sentry{sentryConfigured ? '' : ' (ikke koblet)'} + backend error_log.
          </Typography>
        </Box>
        <Button
          size="small" startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
          onClick={() => { void obs.refetch(); void inc.refetch(); void logs.refetch(); void deploys.refetch(); void health.refetch(); void aiMargin.refetch(); void aiOverage.refetch(); }}
          sx={{ textTransform: 'none' }}
        >
          Oppdater
        </Button>
      </Stack>

      {/* Sub-nav */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {SUBTABS.map((t) => (
          <Button
            key={t.id} size="small" onClick={() => setSubTab(t.id)}
            variant={subTab === t.id ? 'contained' : 'text'}
            sx={{ textTransform: 'none', fontWeight: subTab === t.id ? 700 : 500 }}
          >
            {t.label}
            {t.id === 'incidents' && inc.data
              ? ` (${inc.data.incidents.filter((i) => !i.ack?.resolvedAt).length})`
              : ''}
          </Button>
        ))}
      </Stack>

      {!sentryConfigured && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sentry-lese-token er ikke konfigurert (<code>SENTRY_AUTH_TOKEN</code>/<code>SENTRY_ORG</code>/<code>SENTRY_PROJECT</code>).
          Frontend-feil (via Sentry) vises ikke enda — cockpiten viser backend-feil fra <code>error_log</code>.
        </Alert>
      )}

      {subTab === 'overview' && <OverviewSection obs={obs} inc={inc} />}
      {subTab === 'incidents' && (
        <IncidentsSection inc={inc} onAction={(a) => incidentAction.mutate(a)} pending={incidentAction.isPending} />
      )}
      {subTab === 'health' && <HealthSection health={health} />}
      {subTab === 'ai-margin' && <AiMarginSection aiMargin={aiMargin} />}
      {subTab === 'ai-overage' && (
        <AiOverageSection
          aiOverage={aiOverage}
          onCompute={() => overageCompute.mutate()}
          computing={overageCompute.isPending}
          billResult={billResult}
          onBill={(dryRun) => overageBill.mutate({ dryRun })}
          billing={overageBill.isPending}
        />
      )}
      {subTab === 'deploys' && <DeploysSection deploys={deploys} />}
      {subTab === 'logs' && <LogsSection logs={logs} />}
    </Box>
  );
};

// ─── Oversikt ──────────────────────────────────────────────────────────────

const OverviewSection: React.FC<{
  obs: ReturnType<typeof useQuery<ObservabilityResponse>>;
  inc: ReturnType<typeof useQuery<IncidentsResponse>>;
}> = ({ obs, inc }) => {
  if (obs.isLoading) return <Loading />;
  if (obs.isError || !obs.data) return <ErrorLine msg="Kunne ikke hente observability." />;

  const el = obs.data.errorLog;
  const sentry = obs.data.sentry;
  const activeIncidents = inc.data?.incidents.filter((i) => !i.ack?.resolvedAt).length ?? 0;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <KpiCard
          label="Aktive hendelser"
          value={String(activeIncidents)}
          hint="Sentry + error_log, uløste"
          accent={activeIncidents > 0 ? '#e5484d' : '#3dd68c'}
        />
        <KpiCard
          label="Crash-free (24t)"
          value={sentry?.crashFreeSessionsPct != null ? `${sentry.crashFreeSessionsPct}%` : '—'}
          hint={sentry ? 'Sentry sessions' : 'Sentry ikke koblet'}
          accent={sentry?.crashFreeSessionsPct != null && sentry.crashFreeSessionsPct < 99 ? '#f5a623' : undefined}
        />
        <KpiCard
          label="Backend-feil (24t)"
          value={String(el?.total24h ?? 0)}
          hint={`${el?.unresolvedTotal ?? 0} uløste`}
        />
        <KpiCard
          label="Sentry issues"
          value={sentry ? String(sentry.unresolvedIssues) : '—'}
          hint={sentry ? `${sentry.events24h} events 24t` : 'Sentry ikke koblet'}
        />
      </Stack>

      {/* Observability-uttrekk fra error_log */}
      {el && (el.bySource.length > 0 || el.byStatus.length > 0 || el.topEndpoints.length > 0) && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
          <MiniList title="Feil per kilde (24t)" rows={el.bySource.map((r) => [r.source, r.count])} />
          <MiniList title="Feil per status (24t)" rows={el.byStatus.map((r) => [String(r.statusCode), r.count])} />
          <MiniList title="Verste endepunkter (24t)" rows={el.topEndpoints.map((r) => [r.endpoint, r.count])} />
        </Box>
      )}

      {/* Sentry top-issues */}
      {sentry && sentry.topIssues.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Sentry — verste issues (24t)</Typography>
          <Stack spacing={0.5}>
            {sentry.topIssues.map((i) => (
              <Stack key={i.id} direction="row" spacing={1} alignItems="center" sx={{ fontSize: 12 }}>
                <Chip size="small" label={i.level ?? 'issue'} sx={{ bgcolor: levelColor(i.level), color: '#fff', height: 18, fontSize: 10 }} />
                <Typography sx={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{i.count}×</Typography>
                {i.permalink && (
                  <Tooltip title="Åpne i Sentry">
                    <a href={i.permalink} target="_blank" rel="noreferrer" style={{ color: '#4c6ef5', display: 'flex' }}>
                      <OpenIcon sx={{ fontSize: 15 }} />
                    </a>
                  </Tooltip>
                )}
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
        Sist oppdatert {relTime(obs.data.generatedAt)}.
      </Typography>
    </Box>
  );
};

const MiniList: React.FC<{ title: string; rows: Array<[string, number]> }> = ({ title, rows }) => (
  <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
    <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1 }}>{title}</Typography>
    {rows.length === 0 ? (
      <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>Ingen</Typography>
    ) : (
      <Stack spacing={0.5}>
        {rows.map(([k, v]) => (
          <Stack key={k} direction="row" justifyContent="space-between" sx={{ fontSize: 12 }}>
            <Typography sx={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{k}</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{v}</Typography>
          </Stack>
        ))}
      </Stack>
    )}
  </Box>
);

// ─── Hendelser ─────────────────────────────────────────────────────────────

const IncidentsSection: React.FC<{
  inc: ReturnType<typeof useQuery<IncidentsResponse>>;
  onAction: (a: { incidentId: string; action: 'ack' | 'resolve' | 'reopen' | 'assign'; assignedTo?: string }) => void;
  pending: boolean;
}> = ({ inc, onAction, pending }) => {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignVal, setAssignVal] = useState('');

  if (inc.isLoading) return <Loading />;
  if (inc.isError || !inc.data) return <ErrorLine msg="Kunne ikke hente hendelser." />;

  const incidents = inc.data.incidents;
  if (incidents.length === 0) {
    return <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 4, textAlign: 'center' }}>Ingen aktive hendelser 🎉</Typography>;
  }

  return (
    <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.08)' } }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ color: 'text.secondary' }}>Hendelse</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>Kilde</TableCell>
          <TableCell sx={{ color: 'text.secondary' }} align="right">Antall</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>Sist</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>Status</TableCell>
          <TableCell sx={{ color: 'text.secondary' }} align="right">Handling</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {incidents.map((i) => {
          const resolved = !!i.ack?.resolvedAt;
          const acked = !!i.ack?.ackedAt;
          return (
            <TableRow key={i.incidentId} sx={{ opacity: resolved ? 0.5 : 1 }}>
              <TableCell sx={{ maxWidth: 360 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: levelColor(i.level), flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i.title}
                  </Typography>
                  {i.source === 'sentry' && i.reference && (
                    <a href={i.reference} target="_blank" rel="noreferrer" style={{ color: '#4c6ef5', display: 'flex' }}>
                      <OpenIcon sx={{ fontSize: 14 }} />
                    </a>
                  )}
                </Stack>
                {i.ack?.assignedTo && (
                  <Typography sx={{ fontSize: 10.5, color: 'text.disabled' }}>Tildelt: {i.ack.assignedTo}</Typography>
                )}
              </TableCell>
              <TableCell><Chip size="small" label={i.source === 'sentry' ? 'Sentry' : 'Backend'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
              <TableCell align="right" sx={{ fontSize: 12 }}>{i.count}</TableCell>
              <TableCell sx={{ fontSize: 11.5, color: 'text.secondary' }}>{relTime(i.lastSeen)}</TableCell>
              <TableCell>
                {resolved
                  ? <Chip size="small" label="Løst" color="success" sx={{ height: 18, fontSize: 10 }} />
                  : acked
                    ? <Chip size="small" label="Kvittert" color="warning" sx={{ height: 18, fontSize: 10 }} />
                    : <Chip size="small" label="Åpen" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(229,72,77,0.2)', color: '#e5484d' }} />}
              </TableCell>
              <TableCell align="right">
                {assigning === i.incidentId ? (
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                    <TextField
                      size="small" placeholder="e-post/navn" value={assignVal}
                      onChange={(e) => setAssignVal(e.target.value)} sx={{ width: 130, '& input': { fontSize: 11, py: 0.5 } }}
                      autoFocus
                    />
                    <Button
                      size="small" disabled={pending || !assignVal.trim()}
                      onClick={() => { onAction({ incidentId: i.incidentId, action: 'assign', assignedTo: assignVal.trim() }); setAssigning(null); setAssignVal(''); }}
                    >OK</Button>
                    <Button size="small" onClick={() => { setAssigning(null); setAssignVal(''); }}>×</Button>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {!resolved && !acked && (
                      <Tooltip title="Kvitter">
                        <span><Button size="small" disabled={pending} onClick={() => onAction({ incidentId: i.incidentId, action: 'ack' })} sx={{ minWidth: 0, p: 0.5 }}><AckIcon sx={{ fontSize: 16 }} /></Button></span>
                      </Tooltip>
                    )}
                    {!resolved && (
                      <Tooltip title="Tildel">
                        <span><Button size="small" disabled={pending} onClick={() => setAssigning(i.incidentId)} sx={{ minWidth: 0, p: 0.5 }}><AssignIcon sx={{ fontSize: 16 }} /></Button></span>
                      </Tooltip>
                    )}
                    {!resolved ? (
                      <Tooltip title="Lukk">
                        <span><Button size="small" disabled={pending} onClick={() => onAction({ incidentId: i.incidentId, action: 'resolve' })} sx={{ minWidth: 0, p: 0.5, color: '#3dd68c' }}><ResolveIcon sx={{ fontSize: 16 }} /></Button></span>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Gjenåpne">
                        <span><Button size="small" disabled={pending} onClick={() => onAction({ incidentId: i.incidentId, action: 'reopen' })} sx={{ minWidth: 0, p: 0.5 }}><ReopenIcon sx={{ fontSize: 16 }} /></Button></span>
                      </Tooltip>
                    )}
                  </Stack>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

// ─── Logg ──────────────────────────────────────────────────────────────────

const LogsSection: React.FC<{ logs: ReturnType<typeof useQuery<LogsResponse>> }> = ({ logs }) => {
  if (logs.isLoading) return <Loading />;
  if (logs.isError || !logs.data) return <ErrorLine msg="Kunne ikke hente logg." />;
  const rows = logs.data.data;
  if (rows.length === 0) return <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 4, textAlign: 'center' }}>Ingen backend-feil siste 7 dager.</Typography>;

  return (
    <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.08)' } }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ color: 'text.secondary' }}>Nivå</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>Melding</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>Endepunkt</TableCell>
          <TableCell sx={{ color: 'text.secondary' }} align="right">Antall</TableCell>
          <TableCell sx={{ color: 'text.secondary' }}>Sist</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Chip size="small" label={r.level} sx={{ bgcolor: levelColor(r.level), color: '#fff', height: 18, fontSize: 10 }} />
            </TableCell>
            <TableCell sx={{ maxWidth: 420 }}>
              <Typography sx={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.errorName ? `${r.errorName}: ${r.message}` : r.message}
              </Typography>
            </TableCell>
            <TableCell sx={{ fontSize: 11.5, color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.endpoint ?? '—'}{r.statusCode ? ` (${r.statusCode})` : ''}
            </TableCell>
            <TableCell align="right" sx={{ fontSize: 12 }}>{r.occurrenceCount}</TableCell>
            <TableCell sx={{ fontSize: 11.5, color: 'text.secondary' }}>{relTime(r.lastSeenAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// ─── Deploys ─────────────────────────────────────────────────────────────────

// ─── Helse ─────────────────────────────────────────────────────────────────

const HealthSection: React.FC<{ health: ReturnType<typeof useQuery<HealthResponse>> }> = ({ health }) => {
  if (health.isLoading) return <Loading />;
  if (health.isError || !health.data) return <ErrorLine msg="Kunne ikke hente helse-status." />;

  const { services, overall, generatedAt } = health.data;
  const overallMeta = HEALTH_STATUS_META[overall] ?? HEALTH_STATUS_META.unknown;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <KpiCard
          label="Totalstatus"
          value={overallMeta.label}
          hint="Verste av koblede tjenester"
          accent={overallMeta.color}
        />
        <KpiCard
          label="Oppe nå"
          value={`${services.filter((s) => s.status === 'up' || s.status === 'degraded').length}/${services.filter((s) => s.status !== 'not_configured').length}`}
          hint="Svarende tjenester"
        />
      </Stack>

      <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.08)' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: 'text.secondary' }}>Tjeneste</TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>Status</TableCell>
            <TableCell sx={{ color: 'text.secondary' }} align="right">Svartid</TableCell>
            <TableCell sx={{ color: 'text.secondary' }} align="right">Oppetid 30d</TableCell>
            <TableCell sx={{ color: 'text.secondary' }} align="right">p95</TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>Detalj</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {services.map((s) => {
            const meta = HEALTH_STATUS_META[s.status] ?? HEALTH_STATUS_META.unknown;
            return (
              <TableRow key={s.service}>
                <TableCell sx={{ fontSize: 12.5, fontWeight: 600 }}>{HEALTH_SERVICE_LABEL[s.service]}</TableCell>
                <TableCell>
                  <Chip size="small" label={meta.label} sx={{ height: 18, fontSize: 10, bgcolor: meta.color, color: '#fff' }} />
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  {s.latencyMs != null ? `${s.latencyMs} ms` : '—'}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  <Tooltip title={`${s.sampleCount} samples`}>
                    <span>{s.uptime30d != null ? `${s.uptime30d}%` : '—'}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  {s.p95Ms != null ? `${s.p95Ms} ms` : '—'}
                </TableCell>
                <TableCell sx={{ fontSize: 11, color: 'text.disabled', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.detail}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
        Aktive prober (kun lesing) · oppetid/p95 er basert på registrerte samples (akkumuleres mens cockpiten er åpen), ikke syntetisk 24/7. Sist sjekket {relTime(generatedAt)}.
      </Typography>
    </Box>
  );
};

const AiMarginSection: React.FC<{ aiMargin: ReturnType<typeof useQuery<AiMarginResponse>> }> = ({ aiMargin }) => {
  if (aiMargin.isLoading) return <Loading />;
  if (aiMargin.isError || !aiMargin.data) return <ErrorLine msg="Kunne ikke hente AI-margin." />;

  const { summary, topConsumers } = aiMargin.data;
  const nok = (n: number) => `${Math.round(n).toLocaleString('nb-NO')} kr`;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <KpiCard
          label={`AI-kost ${summary.windowDays}d`}
          value={nok(summary.totalCostNok)}
          hint={`${summary.totalCalls.toLocaleString('nb-NO')} kall · ${summary.distinctOrgs} orgs`}
        />
        <KpiCard
          label="Orgs i margin-risiko"
          value={String(summary.orgsAtRisk)}
          hint={`≥ ${nok(summary.alertThresholdNok)}/mnd AI-kost`}
          accent={summary.orgsAtRisk > 0 ? '#e5484d' : '#3dd68c'}
        />
        <KpiCard
          label="Uattribuert"
          value={nok(summary.unattributedCostNok)}
          hint="Kall uten org (multi-org / ikke-backfillet)"
        />
      </Stack>

      {topConsumers.length === 0 ? (
        <Alert severity="info">Ingen AI-kost registrert i vinduet enda (eller <code>ai_usage_log</code> ikke migrert).</Alert>
      ) : (
        <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.08)' } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary' }}>Organisasjon</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Plan</TableCell>
              <TableCell sx={{ color: 'text.secondary' }} align="right">AI-kost {summary.windowDays}d</TableCell>
              <TableCell sx={{ color: 'text.secondary' }} align="right">Kall</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Flagg</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topConsumers.map((o, i) => (
              <TableRow key={o.organizationId ?? `row-${i}`}>
                <TableCell sx={{ fontSize: 12.5, fontWeight: 600 }}>{o.orgName ?? '(ukjent org)'}</TableCell>
                <TableCell sx={{ fontSize: 11.5, color: 'text.secondary' }}>{o.planKey ?? '—'}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: o.atRisk ? '#e5484d' : '#fff' }}>
                  {nok(o.costNok)}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  {o.calls.toLocaleString('nb-NO')}
                </TableCell>
                <TableCell>
                  {o.atRisk
                    ? <Chip size="small" label="Margin-risiko" sx={{ height: 18, fontSize: 10, bgcolor: '#e5484d', color: '#fff' }} />
                    : <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>OK</Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
        Fase A (kun synlighet): faktisk AI-kost fra <code>ai_usage_log</code>, USD→NOK ≈ {summary.usdToNok} (env <code>AI_USD_TO_NOK</code>).
        Ingen håndhevelse/fakturering enda — Fase B = per-plan tak, Fase C = Stripe metered-overage. Sist oppdatert {relTime(summary.generatedAt)}.
      </Typography>
    </Box>
  );
};

const AiOverageSection: React.FC<{
  aiOverage: ReturnType<typeof useQuery<AiOverageResponse>>;
  onCompute: () => void;
  computing: boolean;
  billResult: AiBillResponse | null;
  onBill: (dryRun: boolean) => void;
  billing: boolean;
}> = ({ aiOverage, onCompute, computing, billResult, onBill, billing }) => {
  if (aiOverage.isLoading) return <Loading />;
  if (aiOverage.isError || !aiOverage.data) return <ErrorLine msg="Kunne ikke hente AI-overage." />;

  const d = aiOverage.data;
  const nok = (n: number) => `${Math.round(n).toLocaleString('nb-NO')} kr`;
  const nok2 = (n: number) => `${n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <KpiCard
          label={`Overage ${d.periodMonth.slice(0, 7)}`}
          value={nok(d.totalOverageChargeNok)}
          hint={`${d.orgsWithOverage} av ${d.orgsProcessed} orgs over budsjett · markup ×${d.markup}`}
          accent={d.totalOverageChargeNok > 0 ? '#f5a623' : '#3dd68c'}
        />
        <KpiCard
          label="Mangler Stripe-kobling"
          value={String(d.orgsMissingStripeLink)}
          hint="Overskridelse, men ingen stripe_customer_id (kan ikke faktureres i Fase C)"
          accent={d.orgsMissingStripeLink > 0 ? '#e5484d' : '#3dd68c'}
        />
        <Button
          size="small" variant="outlined" onClick={onCompute} disabled={computing}
          sx={{ textTransform: 'none', alignSelf: 'center' }}
        >
          {computing ? 'Beregner…' : 'Beregn på nytt'}
        </Button>
      </Stack>

      {d.rows.length === 0 ? (
        <Alert severity="info">
          Ingen akkumulering for måneden enda. Trykk «Beregn på nytt» for å aggregere <code>ai_usage_log</code> per org
          (krever at mig <code>333_ai_overage_accrual.sql</code> er kjørt).
        </Alert>
      ) : (
        <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.08)' } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary' }}>Organisasjon</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Plan</TableCell>
              <TableCell sx={{ color: 'text.secondary' }} align="right">Inkludert</TableCell>
              <TableCell sx={{ color: 'text.secondary' }} align="right">Faktisk</TableCell>
              <TableCell sx={{ color: 'text.secondary' }} align="right">Overage (fakt.)</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {d.rows.map((o, i) => (
              <TableRow key={o.organizationId ?? `row-${i}`}>
                <TableCell sx={{ fontSize: 12.5, fontWeight: 600 }}>{o.orgName ?? '(ukjent org)'}</TableCell>
                <TableCell sx={{ fontSize: 11.5, color: 'text.secondary' }}>{o.planId ?? '—'}</TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{nok2(o.includedCostNok)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{nok2(o.actualCostNok)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: o.overageChargeNok > 0 ? '#f5a623' : '#fff' }}>
                  {o.overageChargeNok > 0 ? nok2(o.overageChargeNok) : '—'}
                </TableCell>
                <TableCell>
                  {o.needsStripeLink
                    ? <Chip size="small" label="Mangler Stripe" sx={{ height: 18, fontSize: 10, bgcolor: '#e5484d', color: '#fff' }} />
                    : o.overageChargeNok > 0
                      ? <Chip size="small" label="Klar for Fase C" sx={{ height: 18, fontSize: 10, bgcolor: '#2f6f4f', color: '#fff' }} />
                      : <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>Innenfor</Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── Fase C: Stripe metered-fakturering (den ENESTE delen som flytter penger) ── */}
      <Box sx={{ display: 'grid', gap: 1.5, p: 2, borderRadius: 2, border: '1px solid rgba(245,166,35,0.28)', bgcolor: 'rgba(245,166,35,0.05)' }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Fase C — fakturér overage til Stripe</Typography>
          <Chip
            size="small"
            label={billResult ? (billResult.enabled ? 'Fakturering PÅ' : 'Kun dry-run (env av)') : 'Ukjent status'}
            sx={{ height: 18, fontSize: 10, bgcolor: billResult?.enabled ? '#2f6f4f' : '#555', color: '#fff' }}
          />
        </Stack>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          Rapporterer «Klar for Fase C»-radene som Stripe <code>billing/meter_events</code> og markerer dem <code>billed_at</code> (idempotent).
          Ekte fakturering krever <b>både</b> <code>AI_OVERAGE_BILLING_ENABLED=true</code> i backend-env <b>og</b> at du trykker «Fakturer nå».
          Uten env-flagget er alt dry-run uansett. Kjør alltid forhåndsvisning først.
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            size="small" variant="outlined" onClick={() => onBill(true)} disabled={billing}
            sx={{ textTransform: 'none' }}
          >
            {billing ? 'Kjører…' : 'Forhåndsvis (dry-run)'}
          </Button>
          <Button
            size="small" variant="contained" color="warning" disabled={billing}
            onClick={() => {
              if (window.confirm('Fakturere alle ufakturerte overage-rader til Stripe nå? Dette flytter penger og markerer radene billed_at. Kjør forhåndsvisning først hvis du er usikker.')) {
                onBill(false);
              }
            }}
            sx={{ textTransform: 'none' }}
          >
            {billing ? 'Fakturerer…' : 'Fakturer nå'}
          </Button>
        </Stack>

        {billResult && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                {billResult.dryRun ? 'Dry-run' : 'Ekte fakturering'} · meter <code>{billResult.meterEventName}</code> ({billResult.meterUnit}) ·
                Stripe {billResult.stripeConfigured ? 'konfigurert' : 'IKKE konfigurert'}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                {billResult.candidates} kandidater · {billResult.reported} rapportert · {billResult.errors} feil ·
                sum {nok2(billResult.totalChargeNok)} · {relTime(billResult.ranAt)}
              </Typography>
            </Stack>
            {billResult.rows.length > 0 && (
              <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.08)' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary' }}>Organisasjon</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>Måned</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }} align="right">Beløp</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }} align="right">Meter-verdi</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>Resultat</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {billResult.rows.map((r, i) => (
                    <TableRow key={r.organizationId ?? `bill-${i}`}>
                      <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{r.orgName ?? '(ukjent org)'}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, color: 'text.secondary' }}>{r.periodMonth.slice(0, 7)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: '#f5a623' }}>{nok2(r.overageChargeNok)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{r.meterValue}</TableCell>
                      <TableCell>
                        {r.error
                          ? <Chip size="small" label={r.error.slice(0, 40)} sx={{ height: 18, fontSize: 10, bgcolor: '#e5484d', color: '#fff' }} />
                          : r.reported
                            ? <Chip size="small" label="Rapportert" sx={{ height: 18, fontSize: 10, bgcolor: '#2f6f4f', color: '#fff' }} />
                            : <Chip size="small" label="Forhåndsvist" sx={{ height: 18, fontSize: 10, bgcolor: '#555', color: '#fff' }} />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        )}
      </Box>

      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
        Fase B (regnskap, ingen fakturering): inkludert AI-budsjett per plan (env <code>AI_INCLUDED_BUDGET_NOK_*</code>),
        overskridelse × markup {d.markup} (env <code>AI_OVERAGE_MARKUP</code>), USD→NOK ≈ {d.usdToNok}. Kunder blokkeres aldri.
        Fase C rapporterer «Klar for Fase C»-radene til Stripe metered — bak eksplisitt bekreftelse. Sist beregnet {relTime(d.computedAt)}.
      </Typography>
    </Box>
  );
};

const DeploysSection: React.FC<{ deploys: ReturnType<typeof useQuery<DeploysResponse>> }> = ({ deploys }) => {
  if (deploys.isLoading) return <Loading />;
  if (deploys.isError || !deploys.data) return <ErrorLine msg="Kunne ikke hente deploys." />;

  const { providers, deploys: rows, anyConfigured, generatedAt } = deploys.data;

  if (!anyConfigured) {
    return (
      <Alert severity="info" icon={<DeployIcon fontSize="small" />}>
        Ingen deploy-provider er koblet. Sett <code>RENDER_API_KEY</code>+<code>RENDER_SERVICE_ID</code>,{' '}
        <code>GITHUB_DEPLOY_TOKEN</code>+<code>GITHUB_REPO</code> og/eller{' '}
        <code>VERCEL_API_TOKEN</code>+<code>VERCEL_PROJECT_ID</code> i backend-env for å vise deploy-tidslinjen.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {/* Provider-status-chips */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {(Object.keys(providers) as DeployProvider[]).map((p) => (
          <Chip
            key={p}
            size="small"
            label={`${DEPLOY_PROVIDER_LABEL[p]}: ${providers[p] ? 'koblet' : 'ikke koblet'}`}
            sx={{
              height: 20, fontSize: 10.5,
              bgcolor: providers[p] ? 'rgba(61,214,140,0.15)' : 'rgba(255,255,255,0.05)',
              color: providers[p] ? '#3dd68c' : 'text.disabled',
            }}
          />
        ))}
      </Stack>

      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          Ingen deploys funnet hos de koblede providerne.
        </Typography>
      ) : (
        <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.08)' } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary' }}>Provider</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Deploy</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Gren</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Status</TableCell>
              <TableCell sx={{ color: 'text.secondary' }}>Startet</TableCell>
              <TableCell sx={{ color: 'text.secondary' }} align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => {
              const meta = DEPLOY_STATUS_META[d.status] ?? DEPLOY_STATUS_META.unknown;
              return (
                <TableRow key={`${d.provider}:${d.id}`}>
                  <TableCell>
                    <Chip size="small" label={DEPLOY_PROVIDER_LABEL[d.provider]} sx={{ height: 18, fontSize: 10 }} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography sx={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.title}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: 'text.disabled' }}>
                      {d.commit ? `${d.commit}` : ''}{d.commit && d.author ? ' · ' : ''}{d.author ?? ''}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11.5, color: 'text.secondary', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.branch ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={d.rawStatus}>
                      <Chip size="small" label={meta.label} sx={{ height: 18, fontSize: 10, bgcolor: meta.color, color: '#fff' }} />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11.5, color: 'text.secondary' }}>{relTime(d.createdAt)}</TableCell>
                  <TableCell align="right">
                    {d.url && (
                      <Tooltip title="Åpne hos provider">
                        <a href={d.url} target="_blank" rel="noreferrer" style={{ color: '#4c6ef5', display: 'inline-flex' }}>
                          <OpenIcon sx={{ fontSize: 15 }} />
                        </a>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
        Kun lesing · trigge/rollback kommer i en senere fase. Sist oppdatert {relTime(generatedAt)}.
      </Typography>
    </Box>
  );
};

// ─── Delte små ─────────────────────────────────────────────────────────────

const Loading: React.FC = () => (
  <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress size={26} /></Box>
);
const ErrorLine: React.FC<{ msg: string }> = ({ msg }) => (
  <Alert severity="error" sx={{ my: 2 }}>{msg}</Alert>
);

export default ControlCenterPanel;
