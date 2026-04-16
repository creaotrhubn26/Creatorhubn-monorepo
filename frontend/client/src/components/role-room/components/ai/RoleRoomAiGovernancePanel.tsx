// @ts-nocheck
/**
 * RoleRoomAiGovernancePanel — admin-only DPO-facing overview.
 *
 * Three tabs:
 *  - Oversikt: active consents, 24 h call summary, model/project rollups.
 *  - Samtykker: consent list (active by default; toggle to include revoked).
 *  - Auditlogg: audit rows (filter by project + status).
 *
 * Endpoints are admin-gated on the backend; returning empty results when
 * the caller is not an admin is the expected "access denied" UX here.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import {
  fetchAiGovernanceAudit,
  fetchAiGovernanceConsents,
  fetchAiGovernanceOverview,
  type AiGovernanceAuditRow,
  type AiGovernanceConsent,
  type AiGovernanceOverview,
} from '../../services/roleRoomAiGovernanceApi';

type GovernanceTab = 'overview' | 'consents' | 'audit';

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export const RoleRoomAiGovernancePanel: React.FC = () => {
  const [tab, setTab] = useState<GovernanceTab>('overview');
  const [overview, setOverview] = useState<AiGovernanceOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [consents, setConsents] = useState<AiGovernanceConsent[]>([]);
  const [consentsLoading, setConsentsLoading] = useState(false);
  const [includeRevoked, setIncludeRevoked] = useState(false);

  const [audit, setAudit] = useState<AiGovernanceAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditProjectFilter, setAuditProjectFilter] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('');

  useEffect(() => {
    if (tab !== 'overview') return;
    let cancelled = false;
    setOverviewLoading(true);
    fetchAiGovernanceOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'consents') return;
    let cancelled = false;
    setConsentsLoading(true);
    fetchAiGovernanceConsents({ includeRevoked, limit: 200 })
      .then((rows) => {
        if (!cancelled) setConsents(rows);
      })
      .finally(() => {
        if (!cancelled) setConsentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, includeRevoked]);

  const refreshAudit = () => {
    let cancelled = false;
    setAuditLoading(true);
    fetchAiGovernanceAudit({
      projectId: auditProjectFilter.trim() || undefined,
      status: auditStatusFilter.trim() || undefined,
      limit: 200,
    })
      .then((rows) => {
        if (!cancelled) setAudit(rows);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (tab !== 'audit') return;
    const cancel = refreshAudit();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const cacheHitRate = useMemo(() => {
    if (!overview) return null;
    const total = overview.calls24h.total;
    if (total === 0) return null;
    return Math.round((overview.calls24h.cacheHits / total) * 100);
  }, [overview]);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            The Role Room — AI Governance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Oversikt for DPO / administrator. Alt leses — ingen endringer gjøres herfra.
          </Typography>
        </Box>

        <Tabs value={tab} onChange={(_, next) => setTab(next as GovernanceTab)}>
          <Tab value="overview" label="Oversikt" />
          <Tab value="consents" label="Samtykker" />
          <Tab value="audit" label="Auditlogg" />
        </Tabs>

        {tab === 'overview' ? (
          <Box>
            {overviewLoading ? <LinearProgress /> : null}
            {!overview ? (
              <Alert severity="info">Ingen data tilgjengelig ennå.</Alert>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                  <KpiCard label="Aktive samtykker" value={overview.activeConsents} />
                  <KpiCard label="Kall siste 24 t" value={overview.calls24h.total} />
                  <KpiCard
                    label="OK / feil / blokkert"
                    value={`${overview.calls24h.ok} / ${overview.calls24h.errored} / ${
                      overview.calls24h.blocked_by_consent + overview.calls24h.blocked_by_rate_limit
                    }`}
                  />
                  <KpiCard
                    label="Cache-hit rate"
                    value={cacheHitRate != null ? `${cacheHitRate}%` : '—'}
                  />
                  <KpiCard
                    label="Prompt / completion tokens"
                    value={`${overview.calls24h.promptTokens} / ${overview.calls24h.completionTokens}`}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="overline" color="text.secondary" fontWeight={700}>
                      Topp prosjekter (24 t)
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Prosjekt</TableCell>
                            <TableCell align="right">Kall</TableCell>
                            <TableCell align="right">Cache</TableCell>
                            <TableCell align="right">Prompt tok</TableCell>
                            <TableCell align="right">Completion tok</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {overview.callsByProject24h.map((row) => (
                            <TableRow key={row.projectId}>
                              <TableCell sx={{ maxWidth: 180 }}>
                                <Typography variant="caption" noWrap>{row.projectId}</Typography>
                              </TableCell>
                              <TableCell align="right">{row.calls}</TableCell>
                              <TableCell align="right">{row.cacheHits}</TableCell>
                              <TableCell align="right">{row.promptTokens}</TableCell>
                              <TableCell align="right">{row.completionTokens}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="overline" color="text.secondary" fontWeight={700}>
                      Modellfordeling (24 t)
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {overview.callsByModel24h.map((row) => (
                        <Chip
                          key={row.model}
                          label={`${row.model} — ${row.calls}`}
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Stack>

                    {overview.topErrors24h.length > 0 ? (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="overline" color="text.secondary" fontWeight={700}>
                          Topp feil (24 t)
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                          {overview.topErrors24h.map((row, idx) => (
                            <Chip
                              key={idx}
                              label={`${row.errorCode ?? 'ukjent'} — ${row.count}`}
                              variant="outlined"
                              size="small"
                              color="error"
                            />
                          ))}
                        </Stack>
                      </Box>
                    ) : null}
                  </Box>
                </Stack>
              </Stack>
            )}
          </Box>
        ) : null}

        {tab === 'consents' ? (
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={includeRevoked}
                  onChange={(event) => setIncludeRevoked(event.target.checked)}
                />
              }
              label="Inkluder tilbaketrukne"
            />
            {consentsLoading ? <LinearProgress /> : null}
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Prosjekt</TableCell>
                    <TableCell>Bruker</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Prosessor</TableCell>
                    <TableCell>Gitt</TableCell>
                    <TableCell>Tilbaketrukket</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {consents.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 180 }}>
                          {row.projectId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 160 }}>
                          {row.userId}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.scope}</TableCell>
                      <TableCell>{row.processor}</TableCell>
                      <TableCell>{formatDate(row.grantedAt)}</TableCell>
                      <TableCell>{row.revokedAt ? formatDate(row.revokedAt) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : null}

        {tab === 'audit' ? (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                label="Prosjekt-id"
                size="small"
                value={auditProjectFilter}
                onChange={(event) => setAuditProjectFilter(event.target.value)}
              />
              <TextField
                label="Status"
                size="small"
                placeholder="ok / error / blocked_by_consent"
                value={auditStatusFilter}
                onChange={(event) => setAuditStatusFilter(event.target.value)}
              />
              <Button onClick={refreshAudit} variant="outlined" size="small">
                Oppdater
              </Button>
            </Stack>
            {auditLoading ? <LinearProgress /> : null}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tid</TableCell>
                    <TableCell>Prosjekt</TableCell>
                    <TableCell>Modell</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Tokens</TableCell>
                    <TableCell>Felt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {audit.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography variant="caption">{formatDate(row.created_at)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 160 }}>
                          {row.project_id}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.model}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status}
                          color={row.status === 'ok' ? 'success' : row.status === 'error' ? 'error' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {row.prompt_tokens ?? '—'} / {row.completion_tokens ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.25} flexWrap="wrap" useFlexGap>
                          {(row.field_categories ?? []).map((cat) => (
                            <Chip key={cat} label={cat} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
};

const KpiCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.5,
      minWidth: 160,
      flex: { xs: '1 1 45%', md: '0 0 auto' },
    }}
  >
    <Typography variant="overline" color="text.secondary" fontWeight={700}>
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={700}>
      {value}
    </Typography>
  </Paper>
);

export default RoleRoomAiGovernancePanel;
