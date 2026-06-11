/**
 * RoleRoomStoragePanel.tsx
 *
 * L3c — Storage-oversikt UI per profil.
 *
 * Bestemor-vennlig UX:
 *   - "Du har brukt 423 MB av 1 GB" (én tydelig progress-bar)
 *   - Last opp-knapp + dra-og-slipp
 *   - Liste over filer (siste 50) med nedlasting + slett
 *   - Tydelig melding hvis quota nådd: "Du har brukt opp 1 GB. Slett filer eller oppgrader."
 */

import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const palette = {
  bg: '#150b2e',
  bgSubtle: 'rgba(168,85,247,0.04)',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#c084fc',
  accentBright: '#a855f7',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
};

interface Stats {
  userId: string;
  tier: 'free' | 'paid' | 'byo';
  usedBytes: number;
  quotaBytes: number | null;
  fileCount: number;
  percentageUsed: number;
}

interface FileRow {
  id: string;
  displayName: string;
  sizeBytes: number;
  contentType: string | null;
  sourceModule: string | null;
  uploadedAt: string;
  projectId: string | null;
  sceneId: string | null;
  attachedToEntityType: string | null;
  attachedToEntityId: string | null;
  attachmentNote: string | null;
}

interface PerProjectRow {
  projectId: string | null;
  projectName: string | null;
  fileCount: number;
  totalBytes: number;
}

interface ByoStatus {
  connected: boolean;
  bucketName: string | null;
  region: string | null;
  migration: null | {
    id: string;
    direction: 'to_byo' | 'from_byo';
    status: 'queued' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled';
    totalFiles: number;
    totalBytes: number;
    filesCompleted: number;
    filesFailed: number;
    bytesCompleted: number;
    statusMessage: string | null;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'akkurat nå';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} d siden`;
  return new Date(iso).toLocaleDateString('nb-NO');
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rr_bearer') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function RoleRoomStoragePanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // L4 — per-prosjekt-tab
  const [viewMode, setViewMode] = useState<'all' | 'per-project'>('all');
  const [perProject, setPerProject] = useState<PerProjectRow[]>([]);

  // BYO B2 state
  const [byo, setByo] = useState<ByoStatus | null>(null);
  const [byoDialogOpen, setByoDialogOpen] = useState(false);
  const [byoForm, setByoForm] = useState({ keyId: '', applicationKey: '', bucketName: '', region: 'us-west-001' });
  const [byoSaving, setByoSaving] = useState(false);
  const [byoError, setByoError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  const refresh = async () => {
    setError(null);
    try {
      const [statsRes, filesRes, byoRes, perProjectRes] = await Promise.all([
        fetch('/api/role-room/storage/stats', { headers: authHeaders() }),
        fetch('/api/role-room/storage/files?limit=50', { headers: authHeaders() }),
        fetch('/api/role-room/storage/byo/status', { headers: authHeaders() }),
        fetch('/api/role-room/storage/per-project', { headers: authHeaders() }),
      ]);
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      } else if (statsRes.status === 401) {
        setError('Logg inn for å se lagringen.');
      }
      if (filesRes.ok) {
        const f = await filesRes.json();
        setFiles(f.files ?? []);
      }
      if (byoRes.ok) {
        const b = await byoRes.json();
        setByo(b);
      }
      if (perProjectRes.ok) {
        const p = await perProjectRes.json();
        setPerProject(p.projects ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Poll BYO migration progress when running
  useEffect(() => {
    if (byo?.migration?.status === 'running' || byo?.migration?.status === 'queued') {
      const id = setInterval(() => { refresh(); }, 2000);
      return () => clearInterval(id);
    }
  }, [byo?.migration?.status]);

  const handleByoConnect = async () => {
    setByoSaving(true);
    setByoError(null);
    try {
      const r = await fetch('/api/role-room/storage/byo/connect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(byoForm),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setByoError(body.error ?? `HTTP ${r.status}`);
      } else {
        setByoDialogOpen(false);
        await refresh();
      }
    } finally {
      setByoSaving(false);
    }
  };

  const handleByoDisconnect = async () => {
    if (!confirm('Koble fra din egen B2? Filene blir igjen på din egen B2 — du kan koble til igjen senere.')) return;
    await fetch('/api/role-room/storage/byo', { method: 'DELETE', headers: authHeaders() });
    await refresh();
  };

  const handleByoMigrate = async () => {
    if (!confirm('Starte migrasjon av alle filer fra admin-B2 til din egen B2?')) return;
    setMigrating(true);
    try {
      const r = await fetch('/api/role-room/storage/byo/migrate', {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `Migrasjon kunne ikke startes (HTTP ${r.status})`);
      } else {
        await refresh();
      }
    } finally {
      setMigrating(false);
    }
  };

  const handleFiles = async (selected: FileList | File[] | null) => {
    if (!selected || selected.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(selected)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('sourceModule', 'manual-upload');
        const r = await fetch('/api/role-room/storage/upload', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: fd,
        });
        if (r.status === 507) {
          const body = await r.json();
          setError(body.detail ?? 'Kvoten er nådd.');
          break;
        }
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setError(body.detail ?? `Opplasting feilet (HTTP ${r.status})`);
          break;
        }
      }
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Slette filen permanent?')) return;
    try {
      const r = await fetch(`/api/role-room/storage/files/${fileId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (r.ok) await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDownload = (fileId: string) => {
    // Backend redirector til signed B2-URL
    const token = localStorage.getItem('rr_bearer');
    const url = `/api/role-room/storage/files/${fileId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    window.location.href = url;
  };

  if (loading) {
    return (
      <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: palette.accent }} />
        </CardContent>
      </Card>
    );
  }

  const quotaLabel = stats?.quotaBytes
    ? `${formatBytes(stats.usedBytes)} av ${formatBytes(stats.quotaBytes)}`
    : `${formatBytes(stats?.usedBytes ?? 0)} (ubegrenset — BYO)`;
  const pct = stats?.percentageUsed ?? 0;
  const barColor = pct >= 90 ? palette.danger : pct >= 75 ? palette.warning : palette.accent;
  const isFull = pct >= 100;

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.4 }}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.4, bgcolor: 'rgba(168,85,247,0.12)',
              border: `1px solid ${palette.borderStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <StorageOutlinedIcon sx={{ color: palette.accent, fontSize: 22 }} />
            </Box>
            <Stack>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: palette.textPrimary }}>
                Lagring
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                Self-tapes, decks, postere og dokumenter du har lastet opp
              </Typography>
            </Stack>
          </Stack>
          <Tooltip title="Oppdater">
            <IconButton onClick={refresh} size="small" sx={{ color: palette.textSecondary }}>
              <RefreshOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {error && (
          <Alert severity={isFull ? 'warning' : 'error'} sx={{ mb: 2, fontSize: '0.86rem' }}>
            {error}
          </Alert>
        )}

        {/* Quota-progress */}
        <Box sx={{
          p: 2.4, borderRadius: 1.6,
          bgcolor: palette.bgSubtle,
          border: `1px solid ${palette.border}`,
          mb: 2.4,
        }}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.2 }}>
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1 }}>
              {quotaLabel}
            </Typography>
            <Chip
              label={stats?.tier === 'free' ? 'GRATIS · 1 GB' : stats?.tier === 'paid' ? 'BETALT' : 'BYO B2'}
              size="small"
              sx={{
                bgcolor: 'rgba(168,85,247,0.18)', color: palette.accent,
                fontWeight: 700, fontSize: '0.72rem',
              }}
            />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, pct)}
            sx={{
              height: 10, borderRadius: 5,
              bgcolor: 'rgba(168,85,247,0.10)',
              '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 5 },
            }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8 }}>
            <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted }}>
              {stats?.fileCount ?? 0} filer
            </Typography>
            <Typography sx={{ fontSize: '0.76rem', color: barColor, fontWeight: 600 }}>
              {pct}% brukt
            </Typography>
          </Stack>
        </Box>

        {/* Last opp */}
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          sx={{
            p: 2.4, mb: 2.4,
            borderRadius: 1.6,
            border: `2px dashed ${dragging ? palette.accent : palette.border}`,
            bgcolor: dragging ? 'rgba(168,85,247,0.10)' : 'transparent',
            textAlign: 'center',
            cursor: isFull ? 'not-allowed' : 'pointer',
            opacity: isFull ? 0.5 : 1,
            transition: 'all 120ms ease',
          }}
          onClick={() => !isFull && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
            disabled={isFull}
          />
          {uploading ? (
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.4}>
              <CircularProgress size={20} sx={{ color: palette.accent }} />
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
                Laster opp …
              </Typography>
            </Stack>
          ) : (
            <Stack alignItems="center" spacing={1}>
              <CloudUploadOutlinedIcon sx={{ color: palette.accent, fontSize: 36 }} />
              <Typography sx={{ fontWeight: 700, color: palette.textPrimary, fontSize: '0.96rem' }}>
                {isFull ? 'Kvoten er nådd' : 'Dra hit eller klikk for å laste opp'}
              </Typography>
              {!isFull && (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                  Maks 500 MB per fil
                </Typography>
              )}
            </Stack>
          )}
        </Box>

        {/* Tab: Alle filer | Per prosjekt */}
        <Tabs
          value={viewMode}
          onChange={(_, v) => setViewMode(v as 'all' | 'per-project')}
          sx={{
            mb: 1.4, minHeight: 34,
            '& .MuiTab-root': {
              color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700,
              textTransform: 'none', minHeight: 34, p: '6px 12px',
            },
            '& .Mui-selected': { color: `${palette.accent} !important` },
            '& .MuiTabs-indicator': { bgcolor: palette.accent },
          }}
        >
          <Tab label={`Alle filer (${files.length})`} value="all" />
          <Tab label={`Per prosjekt (${perProject.length})`} value="per-project" />
        </Tabs>

        {/* Fil-liste — Alle filer */}
        {viewMode === 'all' && (
          files.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.86rem' }}>
              Ingen filer ennå. Last opp en self-tape, deck eller poster for å komme i gang.
            </Alert>
          ) : (
            <Stack spacing={0.8}>
              {files.map((f) => (
                <Box key={f.id} sx={{
                  p: 1.4, borderRadius: 1.2,
                  bgcolor: palette.bgSubtle,
                  border: `1px solid ${palette.border}`,
                  display: 'flex', alignItems: 'center', gap: 1.4,
                }}>
                  <InsertDriveFileOutlinedIcon sx={{ color: palette.textMuted, fontSize: 22 }} />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: '0.88rem', fontWeight: 600, color: palette.textPrimary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {f.displayName}
                    </Typography>
                    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                        {formatBytes(f.sizeBytes)} · {formatRelative(f.uploadedAt)}
                      </Typography>
                      {f.attachedToEntityType && (
                        <Chip
                          label={`${f.attachedToEntityType}${f.attachmentNote ? ` · ${f.attachmentNote.slice(0, 30)}` : ''}`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(168,85,247,0.18)', color: palette.accent,
                            fontSize: '0.66rem', height: 18, fontWeight: 600,
                          }}
                        />
                      )}
                      {!f.attachedToEntityType && f.sourceModule && (
                        <Chip
                          label={f.sourceModule}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(139,126,196,0.18)', color: palette.textMuted,
                            fontSize: '0.66rem', height: 18, fontWeight: 600,
                          }}
                        />
                      )}
                    </Stack>
                  </Stack>
                  <Tooltip title="Last ned">
                    <IconButton size="small" onClick={() => handleDownload(f.id)} sx={{ color: palette.textSecondary }}>
                      <DownloadOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Slett">
                    <IconButton size="small" onClick={() => handleDelete(f.id)} sx={{ color: palette.danger }}>
                      <DeleteOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          )
        )}

        {/* Per prosjekt */}
        {viewMode === 'per-project' && (
          perProject.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.86rem' }}>
              Ingen filer er knyttet til prosjekter ennå. Når du laster opp fra en storyboard-,
              role- eller research-view, blir filen automatisk koblet til riktig prosjekt.
            </Alert>
          ) : (
            <Stack spacing={0.8}>
              {perProject.map((p) => (
                <Box key={p.projectId ?? 'none'} sx={{
                  p: 1.4, borderRadius: 1.2,
                  bgcolor: palette.bgSubtle,
                  border: `1px solid ${palette.border}`,
                  display: 'flex', alignItems: 'center', gap: 1.4,
                }}>
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: palette.textPrimary }}>
                      {p.projectName ?? (p.projectId ? '(slettet prosjekt)' : 'Ikke knyttet til prosjekt')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted }}>
                      {p.fileCount} {p.fileCount === 1 ? 'fil' : 'filer'} · {formatBytes(p.totalBytes)}
                    </Typography>
                  </Stack>
                  <Chip
                    label={formatBytes(p.totalBytes)}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(168,85,247,0.18)', color: palette.accent,
                      fontWeight: 700, fontSize: '0.72rem',
                    }}
                  />
                </Box>
              ))}
            </Stack>
          )
        )}

        {isFull && stats?.tier === 'free' && (
          <Alert severity="warning" sx={{ mt: 2, fontSize: '0.86rem' }}>
            Du har brukt opp gratis-grensen på 1 GB. Slett filer for å frigjøre plass,
            eller koble din egen Backblaze B2 (BYO) for ubegrenset plass på din egen
            konto. Betalt 10 GB-tier kommer snart.
          </Alert>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* BYO B2 — "Bring Your Own Backblaze"                          */}
        {/* ──────────────────────────────────────────────────────────── */}
        <Box sx={{
          mt: 3, p: 2.4, borderRadius: 1.6,
          bgcolor: palette.bgSubtle,
          border: `1px solid ${palette.border}`,
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <LinkOutlinedIcon sx={{ color: palette.accent, fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.96rem', color: palette.textPrimary }}>
                Din egen Backblaze B2
              </Typography>
              {byo?.connected && (
                <Chip
                  icon={<CheckCircleOutlineIcon sx={{ color: `${palette.success} !important`, fontSize: 14 }} />}
                  label="TILKOBLET"
                  size="small"
                  sx={{
                    bgcolor: `${palette.success}33`, color: palette.success,
                    fontWeight: 700, fontSize: '0.68rem',
                  }}
                />
              )}
            </Stack>
            {byo?.connected ? (
              <Button
                size="small" variant="text"
                onClick={handleByoDisconnect}
                startIcon={<LinkOffOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{ color: palette.textSecondary, fontSize: '0.78rem' }}
              >
                Koble fra
              </Button>
            ) : (
              <Button
                size="small" variant="contained"
                onClick={() => { setByoError(null); setByoDialogOpen(true); }}
                startIcon={<LinkOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{ bgcolor: palette.accentBright, fontWeight: 700, fontSize: '0.78rem',
                  '&:hover': { bgcolor: palette.accent } }}
              >
                Koble til
              </Button>
            )}
          </Stack>

          <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary, mb: byo?.connected ? 1.4 : 0 }}>
            {byo?.connected
              ? `Bucket: ${byo.bucketName} · ${byo.region}. Alle nye filer går til din egen B2 — du betaler Backblaze direkte.`
              : 'Koble din egen Backblaze B2-konto for ubegrenset plass. Vi krypterer key-ID + key med din personlige nøkkel og lagrer aldri klartekst. Du betaler Backblaze direkte (≈ $6/TB/måned).'
            }
          </Typography>

          {byo?.connected && !byo.migration && (
            <Button
              size="small" variant="outlined"
              onClick={handleByoMigrate}
              disabled={migrating || stats?.fileCount === 0}
              startIcon={<SwapHorizOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{
                color: palette.accent, borderColor: palette.borderStrong,
                fontWeight: 700, fontSize: '0.78rem',
                '&:hover': { borderColor: palette.accent, bgcolor: 'rgba(168,85,247,0.06)' },
              }}
            >
              {stats?.fileCount === 0
                ? 'Ingen filer å migrere'
                : `Migrer ${stats?.fileCount ?? 0} filer (${formatBytes(stats?.usedBytes ?? 0)}) til din B2`
              }
            </Button>
          )}

          {byo?.migration && (
            <Box sx={{ mt: 1.4 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: palette.textPrimary }}>
                  Migrasjon: {byo.migration.filesCompleted} / {byo.migration.totalFiles} filer
                </Typography>
                <Chip
                  label={byo.migration.status.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: byo.migration.status === 'completed' ? `${palette.success}33`
                      : byo.migration.status === 'failed' ? `${palette.danger}33`
                      : byo.migration.status === 'partial' ? `${palette.warning}33`
                      : `${palette.accent}33`,
                    color: byo.migration.status === 'completed' ? palette.success
                      : byo.migration.status === 'failed' ? palette.danger
                      : byo.migration.status === 'partial' ? palette.warning
                      : palette.accent,
                    fontWeight: 700, fontSize: '0.68rem',
                  }}
                />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={byo.migration.totalBytes > 0
                  ? Math.min(100, Math.round((byo.migration.bytesCompleted / byo.migration.totalBytes) * 100))
                  : (byo.migration.status === 'completed' ? 100 : 0)
                }
                sx={{
                  height: 6, borderRadius: 3,
                  bgcolor: 'rgba(168,85,247,0.10)',
                  '& .MuiLinearProgress-bar': { bgcolor: palette.accent, borderRadius: 3 },
                }}
              />
              {byo.migration.statusMessage && (
                <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted, mt: 0.6 }}>
                  {byo.migration.statusMessage}
                </Typography>
              )}
              {byo.migration.filesFailed > 0 && (
                <Typography sx={{ fontSize: '0.74rem', color: palette.danger, mt: 0.4 }}>
                  {byo.migration.filesFailed} filer feilet — se /admin for detaljer
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </CardContent>

      {/* BYO connect-dialog */}
      <Dialog open={byoDialogOpen} onClose={() => setByoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Koble til din egen Backblaze B2</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
              Opprett en application-key i Backblaze med tilgang KUN til den spesifikke bucket-en
              du vil bruke. Vi krypterer nøklene med din personlige nøkkel og dekrypterer kun
              ved opplastinger/nedlastinger.
            </Alert>
            <TextField
              label="Bucket-navn"
              value={byoForm.bucketName}
              onChange={(e) => setByoForm({ ...byoForm, bucketName: e.target.value })}
              size="small" fullWidth required
            />
            <TextField
              label="Application Key ID"
              value={byoForm.keyId}
              onChange={(e) => setByoForm({ ...byoForm, keyId: e.target.value })}
              size="small" fullWidth required
            />
            <TextField
              label="Application Key (hemmelig)"
              type="password"
              value={byoForm.applicationKey}
              onChange={(e) => setByoForm({ ...byoForm, applicationKey: e.target.value })}
              size="small" fullWidth required
            />
            <TextField
              label="Region"
              value={byoForm.region}
              onChange={(e) => setByoForm({ ...byoForm, region: e.target.value })}
              size="small" fullWidth
              helperText="F.eks. us-west-001 (Sacramento), eu-central-003 (Amsterdam)"
            />
            {byoError && (
              <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
                Validering feilet: {byoError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setByoDialogOpen(false)} sx={{ color: palette.textSecondary }}>
            Avbryt
          </Button>
          <Button
            onClick={handleByoConnect}
            variant="contained"
            disabled={byoSaving || !byoForm.bucketName || !byoForm.keyId || !byoForm.applicationKey}
            startIcon={byoSaving ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: palette.accentBright, fontWeight: 700,
              '&:hover': { bgcolor: palette.accent } }}
          >
            Test + lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
