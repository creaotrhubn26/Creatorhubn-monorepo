// @ts-nocheck
/**
 * AdminStorageStatusPanel
 *
 * Lagringsbildet på ett sted.
 *
 * Delene har eksistert en stund — nøkkelroller, bøtte-klasser,
 * produksjonsregnskap, egress, kostmodell — men bare som data ingen så.
 * Rolle- og bøtte-diagnosen sto i oppstartsloggen, som er nøyaktig det
 * stedet en halvferdig utrulling blir usynlig etter første omstart.
 *
 * Panelet svarer på tre ting:
 *   1. Er sikkerheten faktisk rullet ut, eller deler alt fortsatt én
 *      nøkkel og én bøtte?
 *   2. Hvem bruker plassen, og hva koster de oss?
 *   3. Nærmer noen seg egress-grensen, der kostnaden hopper?
 *
 * All tallbehandling ligger i storageStatusAdapter, som er testet. Her
 * er det bare tegning.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ThemeProvider,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  VpnKey as KeyIcon,
  CloudDownload as EgressIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { adminDarkTheme } from './adminDarkTheme';
import { StatusChip } from './design-system';
import {
  egressRows,
  formatBytes,
  formatNok,
  keyRoleRows,
  productionRows,
  rolloutView,
} from '@/services/storageStatusAdapter';

const SEVERITY_TONE = {
  ok: 'success',
  partial: 'warning',
  not_configured: 'neutral',
} as const;

const ROW_TONE = { ok: 'success', warn: 'warning', over: 'error' } as const;
const KEY_TONE = { scoped: 'success', shared: 'warning', missing: 'neutral' } as const;

export const AdminStorageStatusPanel: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [productions, setProductions] = useState<any>(null);
  const [egress, setEgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallelt: de tre endepunktene er uavhengige, og seriell henting
      // ville gjort panelet tregere uten å gi noe igjen.
      const [o, p, e] = await Promise.all([
        apiRequest('/api/admin/storage-status/overview'),
        apiRequest('/api/admin/storage-status/productions?limit=25'),
        apiRequest('/api/admin/storage-status/egress?days=30&limit=25'),
      ]);
      setOverview(o);
      setProductions(p);
      setEgress(e);
    } catch (err: any) {
      setError(err?.message || 'Kunne ikke hente lagringsstatus');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) {
    return (
      <ThemeProvider theme={adminDarkTheme}>
        <Card>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2">Henter lagringsstatus…</Typography>
            </Stack>
          </CardContent>
        </Card>
      </ThemeProvider>
    );
  }

  const rollout = overview ? rolloutView(overview.rollout) : null;
  const roles = overview ? keyRoleRows(overview.keyRoles) : [];
  const prodRows = productions ? productionRows(productions.productions) : [];
  const egRows = egress ? egressRows(egress.accounts) : [];

  return (
    <ThemeProvider theme={adminDarkTheme}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <StorageIcon fontSize="small" />
          <Typography variant="h6" sx={{ flex: 1 }}>
            Lagringsstatus
          </Typography>
          <IconButton size="small" onClick={() => void load()} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {/* ── Utrulling ────────────────────────────────────────────── */}
        {rollout && (
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <KeyIcon fontSize="small" />
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  {rollout.headline}
                </Typography>
                <StatusChip
                  tone={SEVERITY_TONE[rollout.severity]}
                  label={rollout.severity === 'ok' ? 'Fullført' : 'Gjenstår'}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {rollout.detail}
              </Typography>
              {rollout.outstanding.length > 0 && (
                <Box mt={1}>
                  {rollout.outstanding.map((line) => (
                    <Stack key={line} direction="row" spacing={1} alignItems="flex-start">
                      <WarningIcon fontSize="small" color="warning" />
                      <Typography variant="body2">{line}</Typography>
                    </Stack>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Nøkkelroller ─────────────────────────────────────────── */}
        {roles.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" mb={1}>
                Nøkkelroller
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Rolle</TableCell>
                    <TableCell>Tilgang</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Nøkkel</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.role}>
                      <TableCell>
                        <Tooltip title={r.purpose}>
                          <span>{r.role}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {r.capabilities}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <StatusChip tone={KEY_TONE[r.status]} label={r.statusLabel} />
                          {r.action && (
                            <Typography variant="caption" color="text.secondary">
                              {r.action}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {r.keyHint}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── Forbruk og kost ──────────────────────────────────────── */}
        {overview && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" mb={1}>
                Forbruk
              </Typography>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Metric label="Totalt" value={formatBytes(overview.usage.totalBytes)} />
                <Metric label="Produksjoner" value={String(overview.usage.productionCount)} />
                <Metric label="B2" value={formatBytes(overview.usage.byBackend.b2)} />
                <Metric label="R2" value={formatBytes(overview.usage.byBackend.r2)} />
                <Metric
                  label="Stream"
                  value={formatBytes(overview.usage.byBackend.cloudflare_stream)}
                />
                <Metric
                  label="Kost/mnd"
                  value={formatNok(overview.cost.costNok)}
                  hint="Vår kostnad. Inntekten ligger i Stripe og er ikke koblet inn her."
                />
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ── Produksjoner ─────────────────────────────────────────── */}
        {prodRows.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" mb={1}>
                Største produksjoner
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Produksjon</TableCell>
                    <TableCell align="right">Størrelse</TableCell>
                    <TableCell align="right">Andel</TableCell>
                    <TableCell align="right">Filer</TableCell>
                    <TableCell align="right">Kost/mnd</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prodRows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <span>{p.name}</span>
                          {p.streamHeavy && (
                            <Tooltip title="Mesteparten ligger i Cloudflare Stream, som prises per minutt — dyrere enn størrelsen tilsier.">
                              <StatusChip tone="warning" label="Stream" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{p.size}</TableCell>
                      <TableCell align="right">{p.share}</TableCell>
                      <TableCell align="right">{p.files}</TableCell>
                      <TableCell align="right">{p.cost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── Egress ───────────────────────────────────────────────── */}
        {egress && (
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <EgressIcon fontSize="small" />
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  Egress siste {egress.days} dager
                </Typography>
                {egress.approachingLimit > 0 && (
                  <StatusChip
                    tone="warning"
                    label={`${egress.approachingLimit} nær grensen`}
                  />
                )}
              </Stack>
              <Alert severity="info" sx={{ mb: 1 }}>
                Tallene er estimater. Nedlastingene går rett fra objektlageret til
                klienten, så vi ser aldri bytene — bare at en signert URL ble
                utstedt. Leverandørens fakturarapport er fasit for totalen.
              </Alert>
              {egRows.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Ingen registrert egress i perioden.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Konto</TableCell>
                      <TableCell align="right">Lagret</TableCell>
                      <TableCell align="right">Hentet</TableCell>
                      <TableCell align="right">Gratis</TableCell>
                      <TableCell align="right">Brukt</TableCell>
                      <TableCell align="right">Over</TableCell>
                      <TableCell align="right">Kost</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {egRows.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{e.who}</span>
                            {e.severity !== 'ok' && (
                              <StatusChip
                                tone={ROW_TONE[e.severity]}
                                label={e.severity === 'over' ? 'Over kvote' : 'Nær kvote'}
                              />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{e.stored}</TableCell>
                        <TableCell align="right">{e.egress}</TableCell>
                        <TableCell align="right">{e.allowance}</TableCell>
                        <TableCell align="right">{e.used}</TableCell>
                        <TableCell align="right">{e.overage}</TableCell>
                        <TableCell align="right">{e.cost}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </Stack>
    </ThemeProvider>
  );
};

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({
  label,
  value,
  hint,
}) => {
  const body = (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
  return hint ? <Tooltip title={hint}>{body}</Tooltip> : body;
};

export default AdminStorageStatusPanel;
