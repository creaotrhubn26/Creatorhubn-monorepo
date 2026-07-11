/**
 * IntegrationCenterTab.tsx
 *
 * Admin Integration Center v1 — read-only (docs/integration-audit/07,
 * Implementation Plan steg 6). Leser GET /api/admin/integrations
 * (super_admin-håndhevet server-side) og viser Integration Registry
 * gruppert per kategori: availability/implementation-status, live
 * signal-telling fra normalized_signals, credential-REFERANSER (kun
 * navn — aldri verdier), fallback-kjeder og kvoter.
 *
 * «No Fake Integrations»: statusene kommer rett fra registeret som er
 * verifisert mot faktisk Render-miljø — panelet pynter aldri på dem.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { Refresh as RefreshIcon, Hub as HubIcon } from '@mui/icons-material';

interface IntegrationEntry {
  integrationId: string;
  provider: string;
  displayName: string;
  category: string;
  purpose: string;
  supportedDataTypes: string[];
  authenticationType: string;
  credentialReference: string | null;
  apiBaseUrl: string | null;
  enabled: boolean;
  availabilityStatus: string;
  implementationStatus: string;
  tenantScope: string;
  syncMode: string;
  syncFrequency: string | null;
  quotas: string | null;
  termsStatus: string;
  fallbackIntegrationId: string | null;
  documentationReference: string;
  lastSignalAt: string | null;
  signalCount: number;
}

interface IntegrationsResponse {
  integrations: IntegrationEntry[];
  summary: { total: number; byStatus: Record<string, number> };
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem('creatorhub_auth_token') ?? localStorage.getItem('token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#34d39922', fg: '#34d399' },
  degraded: { bg: '#f59e0b22', fg: '#f59e0b' },
  configured: { bg: '#60a5fa22', fg: '#60a5fa' },
  awaitingApproval: { bg: '#a78bfa22', fg: '#a78bfa' },
  missingCredentials: { bg: '#f8717122', fg: '#f87171' },
  partiallyImplemented: { bg: '#f59e0b22', fg: '#f59e0b' },
  discovered: { bg: '#94a3b822', fg: '#94a3b8' },
  unavailable: { bg: '#f8717122', fg: '#f87171' },
  disabled: { bg: '#94a3b822', fg: '#94a3b8' },
  deprecated: { bg: '#94a3b822', fg: '#94a3b8' },
  rejected: { bg: '#f8717122', fg: '#f87171' },
};

const CATEGORY_LABELS: Record<string, string> = {
  search_demand: 'Search demand & trends',
  owned_marketing: 'Egne markedsføringsdata',
  public_data: 'Offentlige datakilder',
  business_intelligence: 'Business intelligence',
  geo: 'Geodata',
  ai: 'AI-leverandører',
  reviews: 'Anmeldelser',
  crm: 'CRM',
  communication: 'Kommunikasjon',
  infrastructure: 'Infrastruktur',
};

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#94a3b822', fg: '#94a3b8' };
  return (
    <Chip
      label={status}
      size="small"
      sx={{ bgcolor: c.bg, color: c.fg, fontSize: 10, fontWeight: 700, height: 20 }}
    />
  );
}

export default function IntegrationCenterTab() {
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/integrations', {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!r.ok) {
        setError(r.status === 403 ? 'Krever super-admin' : `HTTP ${r.status}`);
        return;
      }
      setData((await r.json()) as IntegrationsResponse);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return <Alert severity="info">Laster Integration Registry …</Alert>;
  }
  if (error) {
    return (
      <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void fetchData()}>Prøv igjen</Button>}>
        {error}
      </Alert>
    );
  }
  if (!data) return null;

  const byCategory = new Map<string, IntegrationEntry[]>();
  for (const e of data.integrations) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <HubIcon sx={{ color: '#a78bfa' }} />
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
            Integration Center
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.85rem' }}>
            {data.summary.total} integrasjoner · registry er sannhetskilden (v1 read-only)
          </Typography>
        </Stack>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => void fetchData()}>
          Oppdater
        </Button>
      </Stack>

      {/* Status-sammendrag */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {Object.entries(data.summary.byStatus)
          .sort((a, b) => b[1] - a[1])
          .map(([status, n]) => (
            <Chip
              key={status}
              label={`${status}: ${n}`}
              size="small"
              sx={{
                bgcolor: (STATUS_COLORS[status] ?? { bg: '#94a3b822' }).bg,
                color: (STATUS_COLORS[status] ?? { fg: '#94a3b8' }).fg,
                fontWeight: 700,
              }}
            />
          ))}
      </Stack>

      {[...byCategory.entries()].map(([category, entries]) => (
        <Box key={category}>
          <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontWeight: 800, fontSize: '0.95rem', mb: 1 }}>
            {CATEGORY_LABELS[category] ?? category} ({entries.length})
          </Typography>
          <TableContainer sx={{ border: '1px solid rgba(148,163,184,0.14)', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.7)' }}>Integrasjon</TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.7)' }}>Tilgjengelighet</TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.7)' }}>Implementasjon</TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.7)' }}>Signaler</TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.7)' }}>Credentials (referanse)</TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.7)' }}>Synk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.integrationId} hover>
                    <TableCell>
                      <Tooltip title={`${e.purpose}${e.quotas ? ` · Kvoter: ${e.quotas}` : ''} · Docs: ${e.documentationReference}`}>
                        <Box>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.85rem' }}>
                            {e.displayName}
                            {!e.enabled && (
                              <Chip label="av" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9 }} />
                            )}
                          </Typography>
                          <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.72rem' }}>
                            {e.provider} · {e.tenantScope === 'shared' ? 'delt' : 'per org'}
                            {e.fallbackIntegrationId ? ` · fallback → ${e.fallbackIntegrationId}` : ''}
                          </Typography>
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell><StatusChip status={e.availabilityStatus} /></TableCell>
                    <TableCell><StatusChip status={e.implementationStatus} /></TableCell>
                    <TableCell>
                      {e.signalCount > 0 ? (
                        <Tooltip title={`Siste signal: ${e.lastSignalAt ? new Date(e.lastSignalAt).toLocaleString('nb-NO') : '—'}`}>
                          <Typography sx={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 700 }}>
                            {e.signalCount.toLocaleString('nb-NO')}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography sx={{ color: 'rgba(148,163,184,0.55)', fontSize: '0.8rem' }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.74rem', maxWidth: 260 }}>
                        {e.credentialReference ?? 'ingen (åpen API)'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.74rem' }}>
                        {e.syncMode}{e.syncFrequency ? ` · ${e.syncFrequency}` : ''}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      <Alert severity="info">
        v1 er read-only — aktivering/deaktivering, credential-endringer og
        fallback-valg gjøres foreløpig via registry-fila
        (backend/server/integrations/integration-registry.ts) og Render-env.
        Skriveoperasjoner kommer i v2 (docs/integration-audit/07).
      </Alert>
    </Stack>
  );
}
