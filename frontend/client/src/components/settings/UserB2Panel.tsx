// UserB2Panel — "Mitt B2-arkiv" for vanlige CreatorHub-brukere.
// Settings-seksjon som lar brukeren bla i, laste opp, laste ned
// og slette filer i sin egen Backblaze B2-bucket. Surface'r også
// totalstørrelse, filtelling og estimert månedlig kostnad så det
// blir helt tydelig hvor mye man bruker.
//
// Backend (annen agent leverer):
//   GET    /api/user/b2-credentials
//   GET    /api/user/b2-credentials/files?limit=&offset=&source=&search=
//   GET    /api/user/b2-credentials/stats
//   POST   /api/user/b2-credentials/download-url   { fileKey } → { downloadUrl }
//   DELETE /api/user/b2-credentials/files?fileKey=...
//   POST   /api/user/b2-credentials/upload-url     { fileName, contentType } → { uploadUrl, fileKey }
//   POST   /api/user/b2-credentials/sync
//   POST   /api/user/b2-credentials                (oppdater)
//   DELETE /api/user/b2-credentials                (slett)

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Storage,
  CloudUpload,
  CloudDownload,
  DeleteOutline,
  Sync,
  Cloud,
  Search,
  Settings as SettingsIcon,
  LinkOff,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ───────────────────────────── Typer ─────────────────────────────

interface B2CredentialsStatus {
  exists: boolean;
  bucketName?: string | null;
  isVerified?: boolean;
  region?: string | null;
  lastSyncedAt?: string | null;
  createdAt?: string | null;
}

interface B2File {
  fileKey: string;
  fileName: string;
  size: number;
  source?: string | null;
  uploadedAt?: string | null;
  contentType?: string | null;
}

interface B2FilesResponse {
  files: B2File[];
  total: number;
}

interface B2Stats {
  totalFiles: number;
  totalBytes: number;
  estimatedMonthlyCostUsd: number;
  lastSyncedAt?: string | null;
  bySource?: Record<string, { files: number; bytes: number }>;
}

interface B2RegionOption {
  value: string;
  label: string;
}

const B2_REGION_OPTIONS: B2RegionOption[] = [
  { value: 'us-west-001', label: 'US West (us-west-001)' },
  { value: 'us-east-005', label: 'US East (us-east-005)' },
  { value: 'eu-central-003', label: 'EU Central (eu-central-003)' },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Alle kilder' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'post-agent', label: 'Post Agent' },
  { value: 'role-room', label: 'Role Room' },
  { value: 'direct', label: 'Direkte' },
];

const PANEL_SX = {
  bgcolor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(8px)',
  color: '#fff',
  borderRadius: 2,
} as const;

const DEFAULT_PAGE_SIZE = 25;

// ───────────────────────── Hjelpere ─────────────────────────────

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const decimals = value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Aldri';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Ukjent';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'Akkurat nå';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} min siden`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} t siden`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} dager siden`;
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatIsoShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceColor(source: string | null | undefined): {
  bg: string;
  fg: string;
  label: string;
} {
  switch ((source || '').toLowerCase()) {
    case 'gallery':
      return { bg: 'rgba(59,130,246,0.18)', fg: '#60a5fa', label: 'Gallery' };
    case 'post-agent':
    case 'post_agent':
    case 'postagent':
      return { bg: 'rgba(168,85,247,0.18)', fg: '#c084fc', label: 'Post Agent' };
    case 'role-room':
    case 'role_room':
    case 'roleroom':
      return { bg: 'rgba(236,72,153,0.18)', fg: '#f472b6', label: 'Role Room' };
    case 'direct':
    case 'manual':
      return { bg: 'rgba(16,185,129,0.18)', fg: '#34d399', label: 'Direkte' };
    default:
      return { bg: 'rgba(148,163,184,0.18)', fg: '#cbd5e1', label: source || 'Ukjent' };
  }
}

// ───────────────────── Credentials-dialog ───────────────────────

interface CredentialsDialogProps {
  open: boolean;
  mode: 'create' | 'update';
  onClose: () => void;
  onSaved: () => void;
}

function CredentialsDialog({ open, mode, onClose, onSaved }: CredentialsDialogProps) {
  const { toast } = useToast();
  const [keyId, setKeyId] = useState('');
  const [appKey, setAppKey] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [region, setRegion] = useState<string>('eu-central-003');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    keyId.trim().length >= 8 && appKey.trim().length >= 16 && bucketName.trim().length > 0;

  const reset = () => {
    setKeyId('');
    setAppKey('');
    setBucketName('');
    setRegion('eu-central-003');
    setError(null);
    setSaving(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/api/user/b2-credentials', {
        method: 'POST',
        body: JSON.stringify({
          keyId: keyId.trim(),
          appKey: appKey.trim(),
          bucketName: bucketName.trim(),
          region,
        }),
      });
      toast({
        title: mode === 'create' ? 'B2-konto koblet til' : 'B2-credentials oppdatert',
        description: 'Du kan nå bla i og laste opp filer.',
      });
      reset();
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lagring feilet';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Koble til Backblaze B2' : 'Oppdater B2-credentials'}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Lim inn application key og bucket fra Backblaze. Nøklene lagres kryptert
          server-side og brukes kun til ditt eget arkiv.
        </DialogContentText>
        <Stack spacing={2}>
          <TextField
            label="Key ID"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            fullWidth
            autoComplete="off"
            spellCheck={false}
          />
          <TextField
            label="Application Key"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            fullWidth
            autoComplete="off"
            spellCheck={false}
            type="password"
          />
          <TextField
            label="Bucket-navn"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            fullWidth
            autoComplete="off"
            spellCheck={false}
          />
          <FormControl fullWidth>
            <InputLabel>Region</InputLabel>
            <Select
              label="Region"
              value={region}
              onChange={(e) => setRegion(String(e.target.value))}
            >
              {B2_REGION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Avbryt
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!canSave || saving}
          startIcon={saving ? <CircularProgress size={16} /> : <Cloud />}
        >
          {saving ? 'Lagrer…' : mode === 'create' ? 'Koble til' : 'Oppdater'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ───────────────────────── Upload-dialog ────────────────────────

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function UploadDialog({ open, onClose, onComplete }: UploadDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setProgress(0);
    setUploading(false);
    setError(null);
    dragCounter.current = 0;
    setIsDragOver(false);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const onSelectFile = (f: File | null) => {
    setFile(f);
    setError(null);
    setProgress(0);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelectFile(dropped);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragOver(false);
  };

  const uploadXhr = (uploadUrl: string, blob: File): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      if (blob.type) xhr.setRequestHeader('Content-Type', blob.type);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Opplasting feilet (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Nettverksfeil under opplasting'));
      xhr.onabort = () => reject(new Error('Opplasting avbrutt'));
      xhr.send(blob);
    });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const signed = await apiRequest('/api/user/b2-credentials/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        }),
      });
      const uploadUrl = signed?.uploadUrl ?? signed?.url;
      if (!uploadUrl) throw new Error('Ingen signed upload-URL fra serveren');
      await uploadXhr(uploadUrl, file);
      toast({
        title: 'Filen er lastet opp',
        description: `${file.name} ble lagret i ditt B2-arkiv.`,
      });
      reset();
      onComplete();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Opplasting feilet';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Last opp ny fil</DialogTitle>
      <DialogContent>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
        />
        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            mt: 1,
            p: 3,
            textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer',
            border: '2px dashed',
            borderColor: isDragOver ? 'primary.main' : 'rgba(148,163,184,0.4)',
            borderRadius: 2,
            bgcolor: isDragOver ? 'rgba(59,130,246,0.06)' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <CloudUpload sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1">
            {file ? file.name : 'Dra en fil hit eller klikk for å velge'}
          </Typography>
          {file && (
            <Typography variant="caption" color="text.secondary">
              {formatBytes(file.size)} · {file.type || 'ukjent type'}
            </Typography>
          )}
        </Box>
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary">
              {progress}%
            </Typography>
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Avbryt
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={!file || uploading}
          startIcon={uploading ? <CircularProgress size={16} /> : <CloudUpload />}
        >
          {uploading ? 'Laster opp…' : 'Last opp'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ────────────────────────── Hovedpanel ──────────────────────────

export default function UserB2Panel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [credentialsDialogMode, setCredentialsDialogMode] = useState<'create' | 'update'>('create');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<B2File | null>(null);
  const [confirmDisconnectStep, setConfirmDisconnectStep] = useState<0 | 1 | 2>(0);

  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

  // ─── Status ────────────────────────────────────────────────────
  const {
    data: credentials,
    isLoading: credentialsLoading,
    refetch: refetchCredentials,
  } = useQuery<B2CredentialsStatus>({
    queryKey: ['/api/user/b2-credentials'],
    queryFn: () => apiRequest('/api/user/b2-credentials'),
  });

  const credentialsExist = !!credentials?.exists;

  // ─── Stats ─────────────────────────────────────────────────────
  const { data: stats, refetch: refetchStats } = useQuery<B2Stats>({
    queryKey: ['/api/user/b2-credentials/stats'],
    queryFn: () => apiRequest('/api/user/b2-credentials/stats'),
    enabled: credentialsExist,
  });

  // ─── Files ─────────────────────────────────────────────────────
  const filesQueryKey = useMemo(
    () => ['/api/user/b2-credentials/files', { search, source, page, rowsPerPage }] as const,
    [search, source, page, rowsPerPage],
  );

  const {
    data: filesData,
    isFetching: filesLoading,
    refetch: refetchFiles,
  } = useQuery<B2FilesResponse>({
    queryKey: filesQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(rowsPerPage));
      params.set('offset', String(page * rowsPerPage));
      if (source && source !== 'all') params.set('source', source);
      if (search.trim()) params.set('search', search.trim());
      return apiRequest(`/api/user/b2-credentials/files?${params.toString()}`);
    },
    enabled: credentialsExist,
  });

  const files: B2File[] = filesData?.files ?? [];
  const totalFiles = filesData?.total ?? files.length;

  // ─── Mutations ─────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: () => apiRequest('/api/user/b2-credentials/sync', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Sync startet', description: 'Vi henter siste status fra B2.' });
      refetchStats();
      refetchFiles();
      refetchCredentials();
    },
    onError: (err) => {
      toast({
        title: 'Sync feilet',
        description: err instanceof Error ? err.message : 'Ukjent feil',
        variant: 'destructive',
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (fileKey: string) =>
      apiRequest('/api/user/b2-credentials/download-url', {
        method: 'POST',
        body: JSON.stringify({ fileKey }),
      }),
    onSuccess: (data: { downloadUrl?: string; url?: string }) => {
      const url = data?.downloadUrl ?? data?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast({
          title: 'Ingen lenke',
          description: 'Serveren returnerte ikke en download-URL.',
          variant: 'destructive',
        });
      }
    },
    onError: (err) => {
      toast({
        title: 'Nedlasting feilet',
        description: err instanceof Error ? err.message : 'Ukjent feil',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fileKey: string) =>
      apiRequest(`/api/user/b2-credentials/files?fileKey=${encodeURIComponent(fileKey)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast({ title: 'Fil slettet', description: 'Filen er permanent fjernet.' });
      setConfirmDelete(null);
      refetchFiles();
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['/api/user/b2-credentials/stats'] });
    },
    onError: (err) => {
      toast({
        title: 'Sletting feilet',
        description: err instanceof Error ? err.message : 'Ukjent feil',
        variant: 'destructive',
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('/api/user/b2-credentials', { method: 'DELETE' }),
    onSuccess: () => {
      toast({
        title: 'B2-tilkobling fjernet',
        description: 'Du kan koble til på nytt når som helst.',
      });
      setConfirmDisconnectStep(0);
      queryClient.invalidateQueries({ queryKey: ['/api/user/b2-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/b2-credentials/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/b2-credentials/files'] });
      refetchCredentials();
    },
    onError: (err) => {
      toast({
        title: 'Frakobling feilet',
        description: err instanceof Error ? err.message : 'Ukjent feil',
        variant: 'destructive',
      });
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────
  const handleOpenCreate = useCallback(() => {
    setCredentialsDialogMode('create');
    setCredentialsDialogOpen(true);
  }, []);

  const handleOpenUpdate = useCallback(() => {
    setCredentialsDialogMode('update');
    setCredentialsDialogOpen(true);
  }, []);

  const handleSavedCredentials = useCallback(() => {
    refetchCredentials();
    refetchStats();
    refetchFiles();
  }, [refetchCredentials, refetchStats, refetchFiles]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPage(0);
    setSearch(e.target.value);
  };

  const handleSourceChange = (value: string) => {
    setPage(0);
    setSource(value);
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <Paper sx={{ ...PANEL_SX, p: { xs: 2, md: 3 } }} data-testid="user-b2-panel">
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Storage sx={{ color: '#60a5fa' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
              Mitt B2-arkiv
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Backblaze B2 — du eier originalene
            </Typography>
          </Box>
        </Stack>
        {credentialsExist && (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Sync nå">
              <span>
                <IconButton
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  sx={{ color: '#fff' }}
                  aria-label="Sync"
                >
                  {syncMutation.isPending ? <CircularProgress size={18} /> : <Sync />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      {credentialsLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!credentialsLoading && !credentialsExist && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={handleOpenCreate} variant="outlined">
              Sett opp nå
            </Button>
          }
          sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#dbeafe', border: '1px solid rgba(59,130,246,0.3)' }}
        >
          Du har ikke koblet til B2 ennå. Koble til Backblaze så får du et eget
          arkiv med originalfilene dine.
        </Alert>
      )}

      {!credentialsLoading && credentialsExist && (
        <>
          {/* KPI-rad */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ mb: 2 }}
            data-testid="user-b2-kpi-row"
          >
            <KpiCell label="Totalt antall filer" value={(stats?.totalFiles ?? 0).toLocaleString('nb-NO')} />
            <KpiCell label="Total størrelse" value={formatBytes(stats?.totalBytes ?? 0)} />
            <KpiCell
              label="Estimert månedlig kost"
              value={`$${(stats?.estimatedMonthlyCostUsd ?? 0).toFixed(2)}`}
              hint="Backblaze B2"
            />
          </Stack>

          {/* Statusbar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ mb: 2 }}
          >
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Sist synket: {stats?.lastSyncedAt ? formatIsoShort(stats.lastSyncedAt) : credentials?.lastSyncedAt ? formatIsoShort(credentials.lastSyncedAt) : 'Aldri'}
            </Typography>
            <Button
              size="small"
              startIcon={syncMutation.isPending ? <CircularProgress size={14} /> : <Sync />}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              sx={{ color: '#60a5fa' }}
            >
              Sync nå
            </Button>
            {credentials?.bucketName && (
              <Chip
                size="small"
                label={`Bucket: ${credentials.bucketName}`}
                sx={{
                  bgcolor: 'rgba(148,163,184,0.15)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(148,163,184,0.3)',
                }}
              />
            )}
            {credentials?.isVerified === false && (
              <Chip
                size="small"
                label="Ikke verifisert"
                sx={{
                  bgcolor: 'rgba(251,146,60,0.18)',
                  color: '#fed7aa',
                  border: '1px solid rgba(251,146,60,0.35)',
                }}
              />
            )}
          </Stack>

          {/* Filterbar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            <TextField
              size="small"
              placeholder="Søk filnavn…"
              value={search}
              onChange={handleSearchChange}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-root': {
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.04)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.18)',
                },
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={source}
                onChange={(e) => handleSourceChange(String(e.target.value))}
                sx={{
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  '.MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.18)',
                  },
                  '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
                }}
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Fil-liste */}
          <TableContainer
            sx={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 1.5,
              maxHeight: 480,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellSx}>Filnavn</TableCell>
                  <TableCell sx={headerCellSx}>Kilde</TableCell>
                  <TableCell sx={headerCellSx} align="right">
                    Størrelse
                  </TableCell>
                  <TableCell sx={headerCellSx}>Opplastet</TableCell>
                  <TableCell sx={headerCellSx} align="right">
                    Handlinger
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filesLoading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={bodyCellSx}>
                      <CircularProgress size={20} />
                    </TableCell>
                  </TableRow>
                )}
                {!filesLoading && files.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={bodyCellSx}>
                      <Typography variant="body2" color="rgba(255,255,255,0.6)">
                        Ingen filer matcher filterne.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!filesLoading &&
                  files.map((f) => {
                    const badge = sourceColor(f.source);
                    return (
                      <TableRow key={f.fileKey} hover>
                        <TableCell sx={bodyCellSx}>
                          <Tooltip title={f.fileKey}>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#fff',
                                maxWidth: 320,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {f.fileName}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={bodyCellSx}>
                          <Chip
                            size="small"
                            label={badge.label}
                            sx={{
                              bgcolor: badge.bg,
                              color: badge.fg,
                              border: `1px solid ${badge.fg}30`,
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={bodyCellSx} align="right">
                          {formatBytes(f.size)}
                        </TableCell>
                        <TableCell sx={bodyCellSx}>{formatIsoShort(f.uploadedAt)}</TableCell>
                        <TableCell sx={bodyCellSx} align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Last ned">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => downloadMutation.mutate(f.fileKey)}
                                  disabled={downloadMutation.isPending}
                                  sx={{ color: '#60a5fa' }}
                                  aria-label={`Last ned ${f.fileName}`}
                                >
                                  <CloudDownload fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Slett">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => setConfirmDelete(f)}
                                  sx={{ color: '#f87171' }}
                                  aria-label={`Slett ${f.fileName}`}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ mt: 1 }}
          >
            <TablePagination
              component="div"
              count={totalFiles}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Per side"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}–${to} av ${count !== -1 ? count : `mer enn ${to}`}`
              }
              sx={{
                color: 'rgba(255,255,255,0.8)',
                '.MuiTablePagination-selectIcon': { color: 'rgba(255,255,255,0.6)' },
              }}
            />
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setUploadDialogOpen(true)}
              sx={{ mt: { xs: 1, sm: 0 } }}
            >
              Last opp ny fil
            </Button>
          </Stack>

          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.12)' }} />

          {/* Bunn — credentials-håndtering */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="flex-end"
          >
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={handleOpenUpdate}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Oppdater credentials
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LinkOff />}
              onClick={() => setConfirmDisconnectStep(1)}
            >
              Koble fra B2
            </Button>
          </Stack>
        </>
      )}

      {/* ─── Dialoger ─── */}
      <CredentialsDialog
        open={credentialsDialogOpen}
        mode={credentialsDialogMode}
        onClose={() => setCredentialsDialogOpen(false)}
        onSaved={handleSavedCredentials}
      />
      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onComplete={() => {
          refetchFiles();
          refetchStats();
        }}
      />

      {/* Slett-confirm */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Slette fra B2?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Denne handlingen er permanent. Filen{' '}
            <strong>{confirmDelete?.fileName}</strong> fjernes fra ditt B2-arkiv
            og kan ikke gjenopprettes.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={deleteMutation.isPending}>
            Avbryt
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} /> : <DeleteOutline />}
            onClick={() => {
              if (confirmDelete) deleteMutation.mutate(confirmDelete.fileKey);
            }}
          >
            Slett permanent
          </Button>
        </DialogActions>
      </Dialog>

      {/* Frakobling-confirm (to-trinns) */}
      <Dialog
        open={confirmDisconnectStep > 0}
        onClose={() => setConfirmDisconnectStep(0)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {confirmDisconnectStep === 1 ? 'Koble fra B2?' : 'Helt sikker?'}
        </DialogTitle>
        <DialogContent>
          {confirmDisconnectStep === 1 ? (
            <DialogContentText>
              CreatorHub vil ikke lenger kunne lese fra eller skrive til ditt
              B2-arkiv. Selve filene blir liggende hos Backblaze.
            </DialogContentText>
          ) : (
            <DialogContentText>
              Bekreft en gang til — vi sletter credentials og du må sette dem
              opp på nytt for å komme tilbake til filene fra CreatorHub.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDisconnectStep(0)}
            disabled={disconnectMutation.isPending}
          >
            Avbryt
          </Button>
          {confirmDisconnectStep === 1 ? (
            <Button color="error" onClick={() => setConfirmDisconnectStep(2)}>
              Fortsett
            </Button>
          ) : (
            <Button
              color="error"
              variant="contained"
              disabled={disconnectMutation.isPending}
              startIcon={
                disconnectMutation.isPending ? <CircularProgress size={16} /> : <LinkOff />
              }
              onClick={() => disconnectMutation.mutate()}
            >
              Koble fra
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// ─────────────────────── Lokale småkomponenter ──────────────────

interface KpiCellProps {
  label: string;
  value: string;
  hint?: string;
}

function KpiCell({ label, value, hint }: KpiCellProps) {
  return (
    <Box
      sx={{
        flex: 1,
        p: 2,
        borderRadius: 1.5,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mt: 0.5 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

const headerCellSx = {
  color: 'rgba(255,255,255,0.75)',
  fontWeight: 700,
  bgcolor: 'rgba(15,23,42,0.95)',
  borderBottom: '1px solid rgba(255,255,255,0.15)',
} as const;

const bodyCellSx = {
  color: 'rgba(255,255,255,0.9)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
} as const;
