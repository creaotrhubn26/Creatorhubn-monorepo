/**
 * B2ArchiveTab — Admin Room tab for selskap-eid Backblaze B2-bucket.
 * Snakker mot /api/admin/b2-archive/* (definert i b2-company-archive-routes.ts).
 * Tilgang: kun produkteier (gating ligger i AdminRoom.tsx via email-check).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Link,
  Paper,
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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import authSessionService from '../../services/authSessionService';

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authSessionService.getAuthHeadersSync(),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) detail = body.error;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
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

export function B2ArchiveTab(): JSX.Element {
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
      const data = await fetchJson<HealthResponse>('/api/admin/b2-archive/health');
      setHealth(data);
    } catch (e: any) {
      setError(`Health-feil: ${e.message}`);
    }
  }, []);

  const loadUsage = useCallback(async (force = false) => {
    setRefreshingUsage(true);
    try {
      const data = await fetchJson<UsageResponse>(
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
        if (!resetPagination && continuationToken) params.set('continuationToken', continuationToken);
        const data = await fetchJson<FilesResponse>(
          `/api/admin/b2-archive/files?${params.toString()}`,
        );
        setFiles(resetPagination ? data.files : [...files, ...data.files]);
        setTruncated(data.truncated);
        setContinuationToken(data.nextContinuationToken);
      } catch (e: any) {
        setError(`Listing-feil: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [prefix, continuationToken, files],
  );

  useEffect(() => {
    void loadHealth();
    void loadUsage();
    void loadFiles(true);
    // initial load — eslint disable since deps are intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchPrefix = useCallback(() => {
    setContinuationToken(undefined);
    void loadFiles(true);
  }, [loadFiles]);

  const handleDownload = useCallback(async (key: string) => {
    try {
      const data = await fetchJson<{ downloadUrl: string }>(
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
        await fetchJson(`/api/admin/b2-archive/files/${encodeURIComponent(key)}`, {
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
      event.target.value = ''; // reset for re-upload av samme fil

      const key = prefix ? `${prefix.replace(/\/$/, '')}/${file.name}` : file.name;
      setUploading(true);
      setError(null);
      setInfo(null);
      try {
        // Steg 1: be backend om signed PUT URL
        const presign = await fetchJson<{ uploadUrl: string; key: string }>(
          '/api/admin/b2-archive/upload-url',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key,
              contentType: file.type || 'application/octet-stream',
              expiresIn: 3600,
            }),
          },
        );

        // Steg 2: PUT direkte til B2 (browser → B2, omgår backend)
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

      {/* Health-status */}
      <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {health?.connected ? (
              <Chip
                size="small"
                color="success"
                icon={<CheckCircleOutlineIcon />}
                label="Tilkoblet"
              />
            ) : health?.configured ? (
              <Chip
                size="small"
                color="warning"
                icon={<ErrorOutlineIcon />}
                label="Konfigurert, ikke tilkoblet"
              />
            ) : (
              <Chip
                size="small"
                color="error"
                icon={<ErrorOutlineIcon />}
                label="Ikke konfigurert"
              />
            )}
            <Box>
              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                {health?.bucketName || 'Ukjent bucket'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.7)' }}>
                {health?.region || ''} {health?.error ? `· ${health.error}` : ''}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => void loadHealth()} size="small" sx={{ color: '#fff' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      {/* Usage-widget */}
      <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.7)' }}>
              Bruk
            </Typography>
            {refreshingUsage ? (
              <LinearProgress sx={{ mt: 1, width: 200 }} />
            ) : (
              <Stack direction="row" spacing={3} alignItems="baseline" sx={{ mt: 0.5 }}>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
                  {usage ? formatBytes(usage.bytes) : '—'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.85)' }}>
                  {usage ? `${usage.files.toLocaleString('nb-NO')} filer` : ''}
                </Typography>
                {usage?.cached && (
                  <Chip size="small" label="cached" variant="outlined" sx={{ color: 'rgba(203,213,225,0.6)' }} />
                )}
              </Stack>
            )}
          </Box>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => void loadUsage(true)}
            disabled={refreshingUsage}
            sx={{ color: '#fff' }}
          >
            Beregn på nytt
          </Button>
        </Stack>
      </Paper>

      {/* Prefix-navigering + upload */}
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
        <Button variant="outlined" onClick={handleSearchPrefix} disabled={loading}>
          Vis
        </Button>
        <Box sx={{ flex: 1 }} />
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={handleFileSelected}
        />
        <Button
          variant="contained"
          startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          onClick={handleUploadClick}
          disabled={uploading || !health?.connected}
        >
          {uploading ? 'Laster opp…' : 'Last opp fil'}
        </Button>
      </Stack>

      {prefixCrumbs.length > 0 && (
        <Breadcrumbs sx={{ color: 'rgba(203,213,225,0.85)' }}>
          <Link
            component="button"
            underline="hover"
            onClick={() => {
              setPrefix('');
              setContinuationToken(undefined);
              void loadFiles(true);
            }}
            sx={{ color: 'rgba(203,213,225,0.85)' }}
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
              sx={{ color: 'rgba(203,213,225,0.85)' }}
            >
              {crumb.label}
            </Link>
          ))}
        </Breadcrumbs>
      )}

      {/* File-tabell */}
      <Paper sx={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'rgba(203,213,225,0.8)', fontWeight: 700 }}>Filsti</TableCell>
                <TableCell sx={{ color: 'rgba(203,213,225,0.8)', fontWeight: 700 }} align="right">
                  Størrelse
                </TableCell>
                <TableCell sx={{ color: 'rgba(203,213,225,0.8)', fontWeight: 700 }}>Endret</TableCell>
                <TableCell sx={{ color: 'rgba(203,213,225,0.8)', fontWeight: 700 }} align="right">
                  Handling
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 4 }}>
                    <Stack alignItems="center" spacing={1}>
                      <FolderOpenIcon sx={{ fontSize: 32, opacity: 0.5 }} />
                      <Typography variant="body2">
                        Ingen filer{prefix ? ` under "${prefix}"` : ' i bucket'} enda
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
              {files.map((file) => (
                <TableRow key={file.key}>
                  <TableCell sx={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {file.key}
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.85)' }} align="right">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.7)' }}>
                    {formatDate(file.lastModified)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Last ned">
                      <IconButton size="small" onClick={() => void handleDownload(file.key)} sx={{ color: '#a78bfa' }}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Slett">
                      <IconButton size="small" onClick={() => void handleDelete(file.key)} sx={{ color: '#f87171' }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {truncated && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => void loadFiles(false)}
              disabled={loading}
              size="small"
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              Last neste 100 →
            </Button>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

export default B2ArchiveTab;
