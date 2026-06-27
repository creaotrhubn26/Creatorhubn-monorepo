/**
 * B2ArchiveTab — Creatorhub admin-dashboard for selskap-eid Backblaze B2-bucket
 * (creatorhubn-archive-prod). Snakker mot /api/admin/b2-archive/*.
 *
 * Tilgang: admin-only via backend requireAdminSession-middleware.
 * Tab vises i AdminDashboard.tsx ved siden av andre system-faner.
 *
 * NB: The Role Room får sin egen separate bucket — den UI'en blir liggende
 * i pages/AdminRoom.tsx med egen env-vars-set (ikke implementert enda).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Chip,
  IconButton,
  LinearProgress,
  Link,
  Stack,
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
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { apiRequest } from '@/lib/queryClient';
import { formatBytes } from '@/lib/utils';
import {
  AdminCard,
  AdminButton,
  StatusChip,
  AdminTableContainer,
} from './design-system';

interface HealthResponse {
  connected: boolean;
  configured: boolean;
  bucketName?: string;
  region?: string;
  endpoint?: string;
  error?: string;
}

interface UsageResponse {
  bytes: number;
  files: number;
  computedAt: string;
  cached: boolean;
}

interface FileItem {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
}

interface FilesResponse {
  files: FileItem[];
  truncated: boolean;
  nextContinuationToken?: string;
  keyCount: number;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function B2ArchiveTab(): JSX.Element {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [truncated, setTruncated] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const data = await apiRequest('/api/admin/b2-archive/health');
      setHealth(data);
    } catch (e: any) {
      setError(`Health-feil: ${e.message}`);
    }
  }, []);

  const loadUsage = useCallback(async (force = false) => {
    setRefreshingUsage(true);
    try {
      const data = await apiRequest(
        `/api/admin/b2-archive/usage${force ? '?force=1' : ''}`,
      );
      setUsage(data);
    } catch (e: any) {
      setError(`Usage-feil: ${e.message}`);
    } finally {
      setRefreshingUsage(false);
    }
  }, []);

  const loadFiles = useCallback(
    async (resetPagination = true) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (prefix) params.set('prefix', prefix);
        if (!resetPagination && continuationToken) {
          params.set('continuationToken', continuationToken);
        }
        const data: FilesResponse = await apiRequest(
          `/api/admin/b2-archive/files?${params.toString()}`,
        );
        const nextFiles = Array.isArray(data.files) ? data.files : [];
        setFiles((prev) => (resetPagination ? nextFiles : [...prev, ...nextFiles]));
        setTruncated(data.truncated);
        setContinuationToken(data.nextContinuationToken);
      } catch (e: any) {
        setError(`Listing-feil: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [prefix, continuationToken],
  );

  useEffect(() => {
    void loadHealth();
    void loadUsage();
    void loadFiles(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchPrefix = useCallback(() => {
    setContinuationToken(undefined);
    void loadFiles(true);
  }, [loadFiles]);

  const handleDownload = useCallback(async (key: string) => {
    try {
      const data = await apiRequest(
        `/api/admin/b2-archive/download-url?key=${encodeURIComponent(key)}`,
      );
      window.open(data.downloadUrl, '_blank');
    } catch (e: any) {
      setError(`Download-feil: ${e.message}`);
    }
  }, []);

  const handleDelete = useCallback(
    async (key: string) => {
      if (!window.confirm(`Slette ${key}? Kan ikke angres.`)) return;
      try {
        await apiRequest(`/api/admin/b2-archive/files/${encodeURIComponent(key)}`, {
          method: 'DELETE',
        });
        setInfo(`Slettet ${key}`);
        await Promise.all([loadFiles(true), loadUsage(true)]);
      } catch (e: any) {
        setError(`Delete-feil: ${e.message}`);
      }
    },
    [loadFiles, loadUsage],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = '';

      const key = prefix ? `${prefix.replace(/\/$/, '')}/${file.name}` : file.name;
      setUploading(true);
      setError(null);
      setInfo(null);
      try {
        const presign = await apiRequest('/api/admin/b2-archive/upload-url', {
          method: 'POST',
          body: {
            key,
            contentType: file.type || 'application/octet-stream',
            expiresIn: 3600,
          },
        });

        const putResp = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putResp.ok) {
          throw new Error(`B2 PUT feilet: ${putResp.status} ${putResp.statusText}`);
        }

        setInfo(`Lastet opp ${file.name} (${formatBytes(file.size)})`);
        await Promise.all([loadFiles(true), loadUsage(true)]);
      } catch (e: any) {
        setError(`Upload-feil: ${e.message}`);
      } finally {
        setUploading(false);
      }
    },
    [prefix, loadFiles, loadUsage],
  );

  const prefixCrumbs = useMemo(() => {
    if (!prefix) return [];
    const parts = prefix.replace(/\/$/, '').split('/');
    return parts.map((part, idx) => ({
      label: part,
      target: parts.slice(0, idx + 1).join('/') + '/',
    }));
  }, [prefix]);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          B2-arkiv (Creatorhub AS)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Selskap-eid Backblaze B2-bucket for offsite-arkiv, DB-backup og intern-medier.
          The Role Room får egen separat bucket.
        </Typography>
      </Box>

      <Stack spacing={2}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {info && (
          <Alert severity="success" onClose={() => setInfo(null)}>
            {info}
          </Alert>
        )}

        <AdminCard>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {health?.connected ? (
                <StatusChip tone="success" label="Tilkoblet" />
              ) : health?.configured ? (
                <StatusChip tone="warning" label="Konfigurert, ikke tilkoblet" />
              ) : (
                <StatusChip tone="error" label="Ikke konfigurert" />
              )}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {health?.bucketName || 'Ukjent bucket'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {health?.region || ''} {health?.error ? `· ${health.error}` : ''}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => void loadHealth()} size="small" aria-label="Oppdater tilkoblingsstatus">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>
        </AdminCard>

        <AdminCard>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Bruk
              </Typography>
              {refreshingUsage ? (
                <LinearProgress sx={{ mt: 1, width: 200, maxWidth: '100%' }} />
              ) : (
                <Stack direction="row" spacing={3} alignItems="baseline" sx={{ mt: 0.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {usage ? formatBytes(usage.bytes) : '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {usage ? `${usage.files.toLocaleString('nb-NO')} filer` : ''}
                  </Typography>
                  {usage?.cached && <Chip size="small" label="cached" variant="outlined" />}
                </Stack>
              )}
            </Box>
            <AdminButton
              tone="ghost"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => void loadUsage(true)}
              disabled={refreshingUsage}
            >
              Beregn på nytt
            </AdminButton>
          </Stack>
        </AdminCard>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Prefiks"
            placeholder="db-backups/ eller la stå tom"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchPrefix()}
            sx={{ minWidth: 280 }}
          />
          <AdminButton tone="secondary" onClick={handleSearchPrefix} disabled={loading}>
            Vis
          </AdminButton>
          <Box sx={{ flex: 1 }} />
          <input ref={fileInputRef} type="file" hidden onChange={handleFileSelected} />
          <AdminButton
            tone="primary"
            loading={uploading}
            startIcon={<CloudUploadIcon />}
            onClick={handleUploadClick}
            disabled={uploading || !health?.connected}
          >
            {uploading ? 'Laster opp…' : 'Last opp fil'}
          </AdminButton>
        </Stack>

        {prefixCrumbs.length > 0 && (
          <Breadcrumbs>
            <Link
              component="button"
              underline="hover"
              onClick={() => {
                setPrefix('');
                setContinuationToken(undefined);
                void loadFiles(true);
              }}
            >
              (root)
            </Link>
            {prefixCrumbs.map((crumb) => (
              <Link
                key={crumb.target}
                component="button"
                underline="hover"
                onClick={() => {
                  setPrefix(crumb.target);
                  setContinuationToken(undefined);
                  void loadFiles(true);
                }}
              >
                {crumb.label}
              </Link>
            ))}
          </Breadcrumbs>
        )}

        <AdminCard disablePadding>
          {loading && <LinearProgress />}
          <AdminTableContainer ariaLabel="B2-arkivfiler">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Filsti</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Størrelse
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Endret</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Handling
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                      <Stack alignItems="center" spacing={1}>
                        <FolderOpenIcon sx={{ fontSize: 32, opacity: 0.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          Ingen filer{prefix ? ` under "${prefix}"` : ' i bucket'} enda
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
                {files.map((file) => (
                  <TableRow key={file.key}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {file.key}
                    </TableCell>
                    <TableCell align="right">{formatBytes(file.size)}</TableCell>
                    <TableCell>{formatDate(file.lastModified)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Last ned">
                        <IconButton size="small" onClick={() => void handleDownload(file.key)} aria-label="Last ned">
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton size="small" onClick={() => void handleDelete(file.key)} color="error" aria-label="Slett">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableContainer>
          {truncated && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <AdminButton tone="secondary" onClick={() => void loadFiles(false)} disabled={loading} size="small">
                Last neste 100 →
              </AdminButton>
            </Box>
          )}
        </AdminCard>
      </Stack>
    </Box>
  );
}
