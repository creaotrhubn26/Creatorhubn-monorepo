/**
 * LiveSetDitPanel.tsx
 *
 * On-set DIT-backup-management. Tre seksjoner:
 *   1. Destinasjoner   = hvor backup går (Primary RAID, Offsite, etc.)
 *   2. Helper-tokens   = auth for CLI-helper på DIT-station
 *   3. Backup-jobs     = real-time fremdrift fra CLI-helperen
 *
 * Rendres som et Drawer fra LiveSetMode footer-baren når
 * DIT-cellen klikkes. Bruker /api/dit/* endpoints (auth via
 * eksisterende admin-session).
 *
 * CLI-helper-instruksjoner finnes i tools/dit-helper/README.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface DitDestination {
  id: string;
  destination_type: string;
  label: string;
  path?: string;
  storage_type: string;
  priority: number;
  status: string;
}

interface DitHelperToken {
  id: string;
  label: string;
  station_name?: string;
  last_used_at?: string;
  expires_at?: string;
  created_at?: string;
  revoked_at?: string;
}

interface DitBackupJob {
  id: string;
  destination_id: string;
  take_id?: string;
  source_path: string;
  source_size_bytes?: number;
  source_hash?: string;
  dest_hash?: string;
  status: string;
  bytes_copied: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  helper_hostname?: string;
}

const DEST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  original: { label: 'Original', color: '#94a3b8' },
  primary: { label: 'Primary', color: '#22d3ee' },
  secondary: { label: 'Secondary', color: '#a78bfa' },
  offsite: { label: 'Offsite', color: '#f59e0b' },
  archive: { label: 'Archive', color: '#10b981' },
};

const JOB_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  queued: { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1' },
  copying: { bg: 'rgba(96,165,250,0.16)', fg: '#bfdbfe' },
  verifying: { bg: 'rgba(251,191,36,0.16)', fg: '#fcd34d' },
  verified: { bg: 'rgba(34,197,94,0.16)', fg: '#86efac' },
  failed: { bg: 'rgba(239,68,68,0.16)', fg: '#fca5a5' },
  skipped: { bg: 'rgba(148,163,184,0.10)', fg: 'rgba(203,213,225,0.65)' },
};

function formatBytes(b?: number): string {
  if (!b || !Number.isFinite(b)) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export interface LiveSetDitPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export default function LiveSetDitPanel({ open, onClose, projectId }: LiveSetDitPanelProps) {
  const [section, setSection] = useState<'jobs' | 'destinations' | 'tokens'>('jobs');
  const [destinations, setDestinations] = useState<DitDestination[]>([]);
  const [tokens, setTokens] = useState<DitHelperToken[]>([]);
  const [jobs, setJobs] = useState<DitBackupJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; expires_at: string } | null>(null);
  const [copyConfirm, setCopyConfirm] = useState(false);

  const loadAll = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/dit/projects/${projectId}/destinations`, { credentials: 'same-origin' }).then((r) => r.ok ? r.json() : { destinations: [] }),
      fetch(`/api/dit/projects/${projectId}/helper-tokens`, { credentials: 'same-origin' }).then((r) => r.ok ? r.json() : { tokens: [] }),
      fetch(`/api/dit/projects/${projectId}/jobs?limit=100`, { credentials: 'same-origin' }).then((r) => r.ok ? r.json() : { jobs: [] }),
    ])
      .then(([d, t, j]) => {
        setDestinations(Array.isArray(d?.destinations) ? d.destinations : []);
        setTokens(Array.isArray(t?.tokens) ? t.tokens : []);
        setJobs(Array.isArray(j?.jobs) ? j.jobs : []);
      })
      .catch(() => {
        // Defensiv — la states være tomme
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    loadAll();
    // Auto-refresh hvert 5s mens drawer er åpent — viser real-time
    // fremdrift fra CLI-helperen
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, [open, loadAll]);

  const generateToken = async () => {
    const label = window.prompt('Token-label (f.eks. "DIT-Mac-Studio-A"):');
    if (!label) return;
    const stationName = window.prompt('Station-name (valgfri, f.eks. macbook-pro-dit-3):') || undefined;
    try {
      const res = await fetch(`/api/dit/projects/${projectId}/helper-tokens`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, station_name: stationName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setNewToken({ token: data.token, expires_at: data.expires_at });
      loadAll();
    } catch (err) {
      window.alert(`Kunne ikke generere token: ${(err as Error).message}`);
    }
  };

  const revokeToken = async (id: string) => {
    if (!window.confirm('Tilbakekall dette tokenet? CLI-er som bruker det vil miste tilgang umiddelbart.')) return;
    try {
      const res = await fetch(`/api/dit/helper-tokens/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadAll();
    } catch (err) {
      window.alert(`Feil: ${(err as Error).message}`);
    }
  };

  const copyTokenToClipboard = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken.token);
      setCopyConfirm(true);
      setTimeout(() => setCopyConfirm(false), 1500);
    } catch {
      window.prompt('Kopiér manuelt:', newToken.token);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 560 },
          bgcolor: 'rgba(7,10,20,0.98)',
          color: '#e2e8f0',
          backgroundImage: 'none',
          borderLeft: '1px solid rgba(148,163,184,0.16)',
        },
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ p: 2, borderBottom: '1px solid rgba(148,163,184,0.16)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>
          DIT Backup
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(203,213,225,0.85)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Tabs
        value={section}
        onChange={(_e, v: 'jobs' | 'destinations' | 'tokens') => setSection(v)}
        variant="fullWidth"
        sx={{
          borderBottom: '1px solid rgba(148,163,184,0.16)',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: 'rgba(226,232,240,0.78)', minHeight: 40, fontSize: '0.84rem' },
          '& .Mui-selected': { color: '#f8fafc' },
          '& .MuiTabs-indicator': { backgroundColor: '#22d3ee' },
        }}
      >
        <Tab value="jobs" label={`Jobs (${jobs.length})`} />
        <Tab value="destinations" label={`Destinasjoner (${destinations.length})`} />
        <Tab value="tokens" label={`Tokens (${tokens.filter((t) => !t.revoked_at).length})`} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading && jobs.length === 0 && destinations.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
        ) : null}

        {/* ── JOBS-vy ──────────────────────────────────────────────── */}
        {section === 'jobs' ? (
          jobs.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
              Ingen backup-jobs ennå. Start CLI-helperen på DIT-station for å begynne å motta jobs.
              Se <code>tools/dit-helper/README.md</code> for setup-guide.
            </Alert>
          ) : (
            <Stack spacing={0.8}>
              {jobs.map((j) => {
                const dest = destinations.find((d) => d.id === j.destination_id);
                const destType = dest?.destination_type ?? 'unknown';
                const destMeta = DEST_TYPE_LABELS[destType] ?? { label: destType, color: '#94a3b8' };
                const statusMeta = JOB_STATUS_COLORS[j.status] ?? JOB_STATUS_COLORS.queued;
                const progress = j.source_size_bytes && j.bytes_copied
                  ? Math.min(100, (j.bytes_copied / j.source_size_bytes) * 100)
                  : 0;
                return (
                  <Box
                    key={j.id}
                    sx={{
                      p: 1.2, borderRadius: 1.5,
                      border: '1px solid rgba(148,163,184,0.14)',
                      bgcolor: 'rgba(2,6,23,0.42)',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Chip size="small" label={destMeta.label} sx={{ bgcolor: `${destMeta.color}26`, color: destMeta.color, fontWeight: 700, height: 20 }} />
                      <Chip size="small" label={j.status} sx={{ bgcolor: statusMeta.bg, color: statusMeta.fg, fontWeight: 700, height: 20 }} />
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                        {formatBytes(j.bytes_copied)} / {formatBytes(j.source_size_bytes)}
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.source_path}
                    </Typography>
                    {(j.status === 'copying' || j.status === 'verifying') && progress > 0 ? (
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          mt: 0.8,
                          height: 4,
                          borderRadius: 1,
                          bgcolor: 'rgba(148,163,184,0.12)',
                          '& .MuiLinearProgress-bar': { bgcolor: destMeta.color },
                        }}
                      />
                    ) : null}
                    {j.source_hash && j.dest_hash ? (
                      <Stack direction="row" spacing={1} sx={{ mt: 0.6 }}>
                        <Typography sx={{ color: 'rgba(148,163,184,0.65)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                          src: {j.source_hash.slice(0, 16)}
                        </Typography>
                        <Typography sx={{
                          color: j.source_hash === j.dest_hash ? '#86efac' : '#fca5a5',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                        }}>
                          {j.source_hash === j.dest_hash ? '✓ match' : '✗ mismatch'}
                        </Typography>
                      </Stack>
                    ) : null}
                    {j.error_message ? (
                      <Typography sx={{ color: '#fca5a5', fontSize: '0.74rem', mt: 0.5 }}>
                        ⚠ {j.error_message}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>
          )
        ) : null}

        {/* ── DESTINATIONS-vy ──────────────────────────────────────── */}
        {section === 'destinations' ? (
          destinations.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
              Ingen destinasjoner konfigurert. Opprett via API:<br/>
              <code style={{ fontSize: 11 }}>POST /api/dit/destinations</code> med project_id, destination_type, label, path
            </Alert>
          ) : (
            <Stack spacing={0.8}>
              {destinations.map((d) => {
                const meta = DEST_TYPE_LABELS[d.destination_type] ?? { label: d.destination_type, color: '#94a3b8' };
                return (
                  <Box key={d.id} sx={{ p: 1.2, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.14)', bgcolor: 'rgba(2,6,23,0.42)' }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip size="small" label={meta.label} sx={{ bgcolor: `${meta.color}26`, color: meta.color, fontWeight: 700, height: 20 }} />
                      <Chip size="small" label={d.storage_type} sx={{ bgcolor: 'rgba(148,163,184,0.10)', color: '#cbd5e1', fontWeight: 600, height: 20 }} />
                      <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem', flex: 1 }}>{d.label}</Typography>
                      <Chip size="small" label={d.status} sx={{ bgcolor: d.status === 'active' ? 'rgba(34,197,94,0.16)' : 'rgba(148,163,184,0.16)', color: d.status === 'active' ? '#86efac' : '#cbd5e1', height: 20 }} />
                    </Stack>
                    {d.path ? (
                      <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.78rem', fontFamily: 'monospace', mt: 0.5 }}>
                        {d.path}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>
          )
        ) : null}

        {/* ── TOKENS-vy ──────────────────────────────────────────── */}
        {section === 'tokens' ? (
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.82rem' }}>
                Helper-tokens lar CLI-en på DIT-station rapportere status. Token vises kun EN gang ved generering.
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={generateToken} sx={{ color: '#22d3ee', textTransform: 'none', flexShrink: 0 }}>
                Generér
              </Button>
            </Stack>

            {newToken ? (
              <Box sx={{ p: 1.5, borderRadius: 1.5, border: '2px solid #fbbf24', bgcolor: 'rgba(251,191,36,0.08)' }}>
                <Typography sx={{ color: '#fcd34d', fontWeight: 700, fontSize: '0.82rem', mb: 1 }}>
                  ⚠ Kopiér nå — vises ikke igjen
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    color: '#f8fafc',
                    p: 1,
                    bgcolor: 'rgba(0,0,0,0.42)',
                    borderRadius: 1,
                    overflow: 'auto',
                    whiteSpace: 'nowrap',
                  }}>
                    {newToken.token}
                  </Typography>
                  <Button
                    size="small"
                    onClick={copyTokenToClipboard}
                    startIcon={<ContentCopyIcon />}
                    sx={{ color: copyConfirm ? '#86efac' : '#fcd34d', textTransform: 'none' }}
                  >
                    {copyConfirm ? 'Kopiert!' : 'Kopiér'}
                  </Button>
                </Stack>
                <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', mt: 1 }}>
                  Utløper: {new Date(newToken.expires_at).toLocaleString('nb-NO')}
                </Typography>
                <Button size="small" onClick={() => setNewToken(null)} sx={{ mt: 1, color: 'rgba(203,213,225,0.7)', textTransform: 'none' }}>
                  Lukk
                </Button>
              </Box>
            ) : null}

            {tokens.length === 0 ? (
              <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
                Ingen tokens ennå. Klikk "Generér" for å lage første token til DIT-station.
              </Alert>
            ) : (
              <Stack spacing={0.6}>
                {tokens.map((t) => {
                  const isRevoked = !!t.revoked_at;
                  const isExpired = t.expires_at && new Date(t.expires_at) < new Date();
                  const isActive = !isRevoked && !isExpired;
                  return (
                    <Box key={t.id} sx={{
                      p: 1.2, borderRadius: 1.5,
                      border: '1px solid rgba(148,163,184,0.14)',
                      bgcolor: 'rgba(2,6,23,0.42)',
                      opacity: isActive ? 1 : 0.55,
                    }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip size="small" label={isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'} sx={{
                          bgcolor: isActive ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.16)',
                          color: isActive ? '#86efac' : '#fca5a5',
                          fontWeight: 700, height: 20,
                        }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.86rem' }}>{t.label}</Typography>
                          <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.7rem' }}>
                            {t.station_name ?? '—'} · sist brukt: {t.last_used_at ? new Date(t.last_used_at).toLocaleString('nb-NO') : 'aldri'}
                          </Typography>
                        </Box>
                        {isActive ? (
                          <Button size="small" onClick={() => revokeToken(t.id)} sx={{ color: '#fca5a5', textTransform: 'none', fontSize: '0.74rem' }}>
                            Tilbakekall
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Stack>
        ) : null}
      </Box>

      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(148,163,184,0.16)', bgcolor: 'rgba(0,0,0,0.32)' }}>
        <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.74rem', textAlign: 'center' }}>
          Native CLI-helper:{' '}
          <Box component="span" sx={{ fontFamily: 'monospace', color: '#22d3ee' }}>
            npx @theroleroom/dit-helper init
          </Box>
        </Typography>
      </Box>
    </Drawer>
  );
}
