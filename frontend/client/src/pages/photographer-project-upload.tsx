// Slice 9X.16 — batch foto-upload UI for fotograf-prosjekt.
// Drag-drop + queue + progress per fil. Bruker eksisterende
// capture multipart-upload-endepunkter via captureUpload-helper.
//
// Stine åpner /photographer/projects/:id/upload, drar inn 50 RAW-filer,
// ser progress per fil, og kan navigere bort underveis (uploads
// fortsetter i bakgrunnen via in-memory queue).

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  Box, Typography, Paper, Stack, Button, IconButton, LinearProgress,
  Alert, Chip, CircularProgress, Snackbar, Divider, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  ArrowBack, CloudUpload, Image, CheckCircle, Error as ErrorIcon,
  Clear, Folder, OpenInNew,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import {
  uploadFileToSession,
  type UploadProgress,
  type ExtractedExif,
} from '@/lib/captureUpload';

interface UploadSessionResponse {
  session: {
    id: string;
    name: string;
    status: string;
    startsAt: string;
    createdAt: string;
  };
  assetCount: number;
}

interface QueueItem {
  id: string;
  file: File;
  progress: UploadProgress;
  error: string | null;
  assetId: string | null;
  exif?: ExtractedExif | null;
  tags?: string[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PhotographerProjectUpload() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [, navigate] = useLocation();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery<UploadSessionResponse>({
    queryKey: [`/api/photographer/projects/${projectId}/upload-session`],
    queryFn: () => apiRequest(`/api/photographer/projects/${projectId}/upload-session`),
    enabled: !!projectId,
  });

  const sessionId = data?.session.id;

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const startUpload = useCallback(async (item: QueueItem) => {
    if (!sessionId) return;
    try {
      const result = await uploadFileToSession({
        sessionId,
        file: item.file,
        onProgress: (p) => updateItem(item.id, { progress: p }),
      });
      updateItem(item.id, {
        assetId: result.assetId,
        error: null,
        exif: result.exif,
        tags: result.tags,
      });
    } catch (err: any) {
      let msg = String(err?.message || 'Ukjent feil');
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.message || parsed.error || msg;
      } catch { /* not JSON */ }
      updateItem(item.id, { error: msg, progress: { ...item.progress, phase: 'error' } });
    }
  }, [sessionId, updateItem]);

  const addFiles = useCallback((files: FileList | File[]) => {
    if (!sessionId) {
      setSnackbar({ msg: 'Upload-session ikke klar ennå. Vent et øyeblikk.', severity: 'info' });
      return;
    }
    const list = Array.from(files);
    if (list.length === 0) return;

    const newItems: QueueItem[] = list.map((file) => ({
      id: genId(),
      file,
      progress: { bytesUploaded: 0, totalBytes: file.size, pct: 0, phase: 'registering' },
      error: null,
      assetId: null,
    }));
    setQueue((q) => [...newItems, ...q]);

    // Kjør 2 parallelt for å ikke kvele server, men ikke serielt heller
    let inFlight = 0;
    const MAX_PARALLEL = 2;
    let idx = 0;
    const next = async () => {
      while (idx < newItems.length && inFlight < MAX_PARALLEL) {
        const item = newItems[idx++];
        inFlight++;
        startUpload(item).finally(() => {
          inFlight--;
          void next();
        });
      }
    };
    void next();
  }, [sessionId, startUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  }, [addFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  }, []);

  const removeItem = useCallback((id: string) => {
    setQueue((q) => q.filter((item) => item.id !== id));
  }, []);

  const stats = useMemo(() => {
    const total = queue.length;
    const done = queue.filter((q) => q.progress.phase === 'done').length;
    const failed = queue.filter((q) => q.progress.phase === 'error').length;
    const inProgress = queue.filter(
      (q) => q.progress.phase !== 'done' && q.progress.phase !== 'error',
    ).length;
    const totalBytes = queue.reduce((sum, q) => sum + q.progress.totalBytes, 0);
    const uploadedBytes = queue.reduce((sum, q) => sum + q.progress.bytesUploaded, 0);
    return { total, done, failed, inProgress, totalBytes, uploadedBytes };
  }, [queue]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`/photographer/projects/${projectId}`)}>
          Tilbake
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>Kunne ikke laste upload-session.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(`/photographer/projects/${projectId}`)}>
          <ArrowBack />
        </IconButton>
        <CloudUpload color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5">Last opp bilder</Typography>
          <Typography variant="caption" color="text.secondary">
            Capture-session: {data.session.name}
            {data.assetCount > 0 && ` · ${data.assetCount} bilder lastet opp tidligere`}
          </Typography>
        </Box>
      </Stack>

      <Paper
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        sx={{
          p: 6,
          mb: 3,
          textAlign: 'center',
          border: 3,
          borderStyle: 'dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUpload sx={{ fontSize: 64, color: isDragging ? 'primary.main' : 'action.disabled', mb: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          {isDragging ? 'Slipp filene her' : 'Dra og slipp filer her'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          eller klikk for å bla. JPG, PNG, RAW, TIFF.
        </Typography>
        <Button variant="contained" startIcon={<Image />}>
          Velg filer
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.rw2,.orf"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </Paper>

      {queue.length > 0 && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
            <Paper sx={{ p: 1.5, minWidth: 120 }}>
              <Typography variant="caption" color="text.secondary">Totalt</Typography>
              <Typography variant="h6">{stats.total}</Typography>
            </Paper>
            <Paper sx={{ p: 1.5, minWidth: 120 }}>
              <Typography variant="caption" color="text.secondary">Ferdig</Typography>
              <Typography variant="h6" color="success.main">{stats.done}</Typography>
            </Paper>
            <Paper sx={{ p: 1.5, minWidth: 120 }}>
              <Typography variant="caption" color="text.secondary">Pågår</Typography>
              <Typography variant="h6" color="primary.main">{stats.inProgress}</Typography>
            </Paper>
            {stats.failed > 0 && (
              <Paper sx={{ p: 1.5, minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary">Feilet</Typography>
                <Typography variant="h6" color="error.main">{stats.failed}</Typography>
              </Paper>
            )}
            <Paper sx={{ p: 1.5, minWidth: 200, flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Total: {formatBytes(stats.uploadedBytes)} / {formatBytes(stats.totalBytes)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={stats.totalBytes > 0 ? (stats.uploadedBytes / stats.totalBytes) * 100 : 0}
                sx={{ mt: 0.5, height: 8, borderRadius: 1 }}
              />
            </Paper>
          </Stack>

          {stats.done > 0 && stats.inProgress === 0 && (
            <Alert
              severity="success"
              sx={{ mb: 2 }}
              action={
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Folder />}
                  onClick={() => navigate(`/photographer/projects/${projectId}`)}
                >
                  Tilbake til prosjekt
                </Button>
              }
            >
              {stats.done} bilder lastet opp! Du kan publisere til klient-galleri fra prosjekt-detalj.
            </Alert>
          )}

          <Paper>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fil</TableCell>
                    <TableCell align="right">Størrelse</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell align="right">Status</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queue.map((item) => {
                    const isDone = item.progress.phase === 'done';
                    const isError = item.progress.phase === 'error';
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            {item.file.name}
                          </Typography>
                          {item.exif && (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5, gap: 0.25 }}>
                              {item.exif.cameraModel && (
                                <Chip
                                  size="small"
                                  label={item.exif.cameraModel}
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              )}
                              {item.exif.focalLength != null && (
                                <Chip
                                  size="small"
                                  label={`${Math.round(item.exif.focalLength)}mm`}
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              )}
                              {item.exif.aperture != null && (
                                <Chip
                                  size="small"
                                  label={`f/${item.exif.aperture}`}
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              )}
                              {item.exif.iso != null && (
                                <Chip
                                  size="small"
                                  label={`ISO ${item.exif.iso}`}
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              )}
                              {item.exif.shutterSpeed && (
                                <Chip
                                  size="small"
                                  label={item.exif.shutterSpeed}
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              )}
                              {item.exif.gpsLat != null && (
                                <Chip
                                  size="small"
                                  label="GPS"
                                  variant="outlined"
                                  color="success"
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              )}
                            </Stack>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {formatBytes(item.file.size)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 200 }}>
                          <LinearProgress
                            variant="determinate"
                            value={item.progress.pct}
                            color={isError ? 'error' : isDone ? 'success' : 'primary'}
                            sx={{ height: 6, borderRadius: 1 }}
                          />
                          {item.error && (
                            <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                              {item.error}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {isDone ? (
                            <Chip size="small" color="success" icon={<CheckCircle />} label="Ferdig" />
                          ) : isError ? (
                            <Chip size="small" color="error" icon={<ErrorIcon />} label="Feil" />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {item.progress.phase} {item.progress.pct}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {(isDone || isError) && (
                            <IconButton size="small" onClick={() => removeItem(item.id)}>
                              <Clear fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4500}
        onClose={() => setSnackbar(null)}
      >
        <Alert
          severity={snackbar?.severity ?? 'info'}
          onClose={() => setSnackbar(null)}
          sx={{ width: '100%' }}
        >
          {snackbar?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
