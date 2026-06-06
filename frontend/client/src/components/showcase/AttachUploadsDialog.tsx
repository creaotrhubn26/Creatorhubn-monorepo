/**
 * AttachUploadsDialog — picker som lar fotograf legge til allerede
 * opplastede chunked-uploads i et eksisterende klient-galleri.
 *
 * Fil-lista hentes paginert fra GET /api/photographer/chunked-uploads
 * med søk + filter (krypterte/bilder/video). Multi-select med
 * checkbox-grid. Submit kaller
 * POST /api/photographer/galleries/:galleryId/attach-uploads.
 *
 * Brukes fra ClientGalleriesManager — knapp "Legg til fra opplastinger"
 * per galleri-rad.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Snackbar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Lock as LockIcon,
  Image as ImageIcon,
  Movie as MovieIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface UploadFile {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  size: number;
  createdAt: string;
  encryptedAtRest: boolean;
  storageBackend: string | null;
  isVideo: boolean;
}

interface UploadsResponse {
  success: boolean;
  files: UploadFile[];
  nextCursor: string | null;
}

interface AttachResponse {
  success: boolean;
  added: number;
  skipped: number;
  imageIds: string[];
  skippedFileIds: string[];
}

export interface AttachUploadsDialogProps {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  galleryTitle?: string | null;
  onSuccess?: (added: number) => void;
}

type FileFilter = 'all' | 'images' | 'videos' | 'encrypted';

const formatBytes = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const fileIcon = (file: UploadFile) => {
  if (file.isVideo) return <MovieIcon fontSize="small" />;
  if (file.mimeType?.startsWith('image/')) return <ImageIcon fontSize="small" />;
  return <FileIcon fontSize="small" />;
};

export const AttachUploadsDialog: React.FC<AttachUploadsDialogProps> = ({
  open,
  onClose,
  galleryId,
  galleryTitle,
  onSuccess,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FileFilter>('all');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<AttachResponse | null>(null);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; msg: string } | null>(null);

  // Debounce-lyttende søk
  const [searchDebounced, setSearchDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (searchDebounced) params.set('search', searchDebounced);
      if (filter === 'images') params.set('mimePrefix', 'image/');
      else if (filter === 'videos') params.set('mimePrefix', 'video/');
      else if (filter === 'encrypted') params.set('encryptedOnly', 'true');
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '50');
      return params.toString();
    },
    [searchDebounced, filter],
  );

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNextCursor(null);
    try {
      const qs = buildQuery();
      const data = (await apiRequest(
        `/api/photographer/chunked-uploads?${qs}`,
      )) as UploadsResponse;
      setFiles(data.files || []);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const fetchMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const qs = buildQuery(nextCursor);
      const data = (await apiRequest(
        `/api/photographer/chunked-uploads?${qs}`,
      )) as UploadsResponse;
      setFiles((prev) => [...prev, ...(data.files || [])]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, nextCursor, loadingMore]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setSubmitResult(null);
    void fetchInitial();
  }, [open, fetchInitial]);

  const toggleFile = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = files.map((f) => f.fileId);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const allVisibleSelected = useMemo(
    () => files.length > 0 && files.every((f) => selectedIds.has(f.fileId)),
    [files, selectedIds],
  );

  const submit = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = (await apiRequest(
        `/api/photographer/galleries/${encodeURIComponent(galleryId)}/attach-uploads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: Array.from(selectedIds) }),
        },
      )) as AttachResponse;
      setSubmitResult(data);
      if (data.added > 0) {
        setToast({
          severity: 'success',
          msg: `${data.added} fil(er) lagt til i galleriet${data.skipped > 0 ? ` (${data.skipped} hoppet over)` : ''}.`,
        });
        onSuccess?.(data.added);
      } else {
        setToast({
          severity: 'error',
          msg: `Ingen filer ble lagt til (${data.skipped} hoppet over).`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setToast({ severity: 'error', msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(15,23,42,0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Legg til fra opplastinger
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                {galleryTitle ? `Galleri: ${galleryTitle}` : `Galleri-id: ${galleryId}`}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Søk + filter */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="stretch">
            <TextField
              fullWidth
              size="small"
              placeholder="Søk på filnavn…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                sx: { color: '#fff' },
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.23)' },
                '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
              }}
            />
            <ToggleButtonGroup
              value={filter}
              exclusive
              size="small"
              onChange={(_, v) => v && setFilter(v as FileFilter)}
            >
              <ToggleButton value="all">Alle</ToggleButton>
              <ToggleButton value="images">Bilder</ToggleButton>
              <ToggleButton value="videos">Video</ToggleButton>
              <ToggleButton value="encrypted">Kryptert</ToggleButton>
            </ToggleButtonGroup>
            <IconButton onClick={() => void fetchInitial()} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Stack>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Header med count + select-all */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {files.length} fil(er) vist · {selectedIds.size} valgt
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && files.some((f) => selectedIds.has(f.fileId))}
                  onChange={toggleAllVisible}
                  disabled={files.length === 0}
                />
              }
              label={<Typography variant="caption">Velg alle synlige</Typography>}
            />
          </Stack>

          {/* Fil-liste */}
          <Box
            sx={{
              minHeight: 320,
              maxHeight: 480,
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 1,
            }}
          >
            {loading && files.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : files.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Ingen opplastinger matcher dine filtre.
                </Typography>
              </Box>
            ) : (
              <>
                {files.map((file) => {
                  const isSelected = selectedIds.has(file.fileId);
                  return (
                    <Box
                      key={file.fileId}
                      onClick={() => toggleFile(file.fileId)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.25,
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        bgcolor: isSelected ? 'rgba(139,92,246,0.18)' : 'transparent',
                        '&:hover': { bgcolor: isSelected ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)' },
                      }}
                    >
                      <Checkbox size="small" checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={() => toggleFile(file.fileId)} sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#fff' } }} />
                      <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>{fileIcon(file)}</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={file.fileName}
                        >
                          {file.fileName}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {formatBytes(file.size)} · {formatDate(file.createdAt)}
                          </Typography>
                          {file.encryptedAtRest && (
                            <Chip
                              icon={<LockIcon sx={{ fontSize: 12 }} />}
                              label="Kryptert"
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#dcfce7', color: '#166534' }}
                            />
                          )}
                          {file.isVideo && (
                            <Chip
                              label="Stream"
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#dbeafe', color: '#1e40af' }}
                            />
                          )}
                        </Stack>
                      </Box>
                    </Box>
                  );
                })}
                {nextCursor && (
                  <Box sx={{ p: 1.5, textAlign: 'center' }}>
                    <Button
                      size="small"
                      onClick={() => void fetchMore()}
                      disabled={loadingMore}
                      startIcon={loadingMore ? <CircularProgress size={14} /> : undefined}
                    >
                      {loadingMore ? 'Henter…' : 'Hent flere'}
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Submit-progress */}
          {submitting && <LinearProgress />}

          {/* Resultat av siste submit */}
          {submitResult && (
            <Alert
              severity={submitResult.added > 0 ? 'success' : 'warning'}
              icon={submitResult.added > 0 ? <CheckIcon /> : undefined}
            >
              {submitResult.added > 0
                ? `${submitResult.added} fil(er) lagt til.`
                : 'Ingen filer lagt til.'}
              {submitResult.skipped > 0 ? ` ${submitResult.skipped} hoppet over.` : null}
            </Alert>
          )}

          {/* Info-boks */}
          <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
            Krypterte filer dekrypteres on-the-fly når kunden åpner galleri-lenken — de ser
            vanlige bilder, men filene er aldri ukrypterte på serveren. Video-filer i
            Cloudflare Stream blir tilgjengelig som streaming-preview (kan ikke lastes ned
            som fil).
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Lukk
          </Button>
          <Button
            variant="contained"
            onClick={() => void submit()}
            disabled={selectedIds.size === 0 || submitting}
          >
            {submitting
              ? 'Legger til…'
              : `Legg til ${selectedIds.size > 0 ? selectedIds.size : ''} fil${selectedIds.size === 1 ? '' : 'er'}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
};

export default AttachUploadsDialog;
