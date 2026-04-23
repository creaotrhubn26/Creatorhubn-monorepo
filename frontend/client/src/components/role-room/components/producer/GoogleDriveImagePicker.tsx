import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  CloudDownload as CloudDownloadIcon,
  CheckCircle as CheckCircleIcon,
  PlayCircleFilled as PlayCircleFilledIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomDriveImage,
} from '../../services/roleRoomAgentService';

export type DriveMediaKind = 'image' | 'video' | 'media';

type PickedMedia = { dataUrl: string; name: string; fileId: string; mimeType: string };

type GoogleDriveImagePickerProps = {
  open: boolean;
  aspect?: '4:5' | '1:1' | '9:16';
  onClose: () => void;
  /** What the picker should list and validate. Default 'image'. */
  kind?: DriveMediaKind;
  /** When set, the picker enters multi-select mode: user ticks 2-max
   *  items and confirms; the min/max gate the confirm button. */
  multiSelect?: { min: number; max: number };
  /** Single-item callback — called when the picker isn't in multi-select mode. */
  onPick?: (image: PickedMedia) => void;
  /** Multi-item callback — called in multi-select mode with the full
   *  imported batch. */
  onPickMultiple?: (images: PickedMedia[]) => void;
};

export default function GoogleDriveImagePicker({
  open,
  onClose,
  kind = 'image',
  multiSelect,
  onPick,
  onPickMultiple,
}: GoogleDriveImagePickerProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [files, setFiles] = useState<RoleRoomDriveImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isMulti = Boolean(multiSelect);
  const minPick = multiSelect?.min ?? 1;
  const maxPick = multiSelect?.max ?? 1;
  const selectionOk = selectedIds.length >= minPick && selectedIds.length <= maxPick;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQuery('');
    setNotConnected(false);
    setSelectedIds([]);
    void loadFiles('');
  }, [open, kind]);

  const loadFiles = async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await roleRoomAgentService.listDriveImages(searchQuery, kind);
      if (result.notConnected) {
        setNotConnected(true);
        setFiles([]);
        return;
      }
      setNotConnected(false);
      setFiles(result.files);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke hente Google Drive-filer.');
    } finally {
      setLoading(false);
    }
  };

  const debouncedQuery = useDebounced(query, 400);
  useEffect(() => {
    if (!open) return;
    void loadFiles(debouncedQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, open]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= maxPick) {
        // At cap — replace the oldest so the user can fine-tune their
        // final selection without having to uncheck first.
        return [...current.slice(1), id];
      }
      return [...current, id];
    });
  };

  const handlePick = async (file: RoleRoomDriveImage) => {
    if (isMulti) {
      toggleSelected(file.id);
      return;
    }
    setImportingId(file.id);
    setError(null);
    try {
      const imported = await roleRoomAgentService.importDriveImage(file.id);
      onPick?.({
        dataUrl: imported.dataUrl,
        name: imported.name || file.name,
        fileId: file.id,
        mimeType: imported.mimeType || file.mimeType,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke importere filen fra Drive.');
    } finally {
      setImportingId(null);
    }
  };

  const handleConfirmMulti = async () => {
    if (!selectionOk || !onPickMultiple) return;
    setBulkImporting(true);
    setError(null);
    try {
      const picked: PickedMedia[] = [];
      for (const id of selectedIds) {
        const file = files.find((f) => f.id === id);
        if (!file) continue;
        const imported = await roleRoomAgentService.importDriveImage(file.id);
        picked.push({
          dataUrl: imported.dataUrl,
          name: imported.name || file.name,
          fileId: file.id,
          mimeType: imported.mimeType || file.mimeType,
        });
      }
      onPickMultiple(picked);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke importere ett eller flere filer.');
    } finally {
      setBulkImporting(false);
    }
  };

  const headerTitle = kind === 'video'
    ? 'Velg video fra Google Drive'
    : kind === 'media'
      ? 'Velg bilde eller video fra Google Drive'
      : 'Velg bilde fra Google Drive';
  const headerSubtitle = isMulti
    ? `Velg ${minPick === maxPick ? `${minPick}` : `${minPick}-${maxPick}`} filer (${selectedIds.length} valgt).`
    : 'Henter filer fra kontoen som er koblet til prosjektet.';
  const header = useMemo(
    () => (
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack spacing={0.2}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.02rem' }}>
            {headerTitle}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.64)', fontSize: '0.82rem' }}>
            {headerSubtitle}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} aria-label="Lukk" sx={{ color: 'rgba(226,232,240,0.75)' }}>
          <CloseIcon />
        </IconButton>
      </Stack>
    ),
    [onClose, headerTitle, headerSubtitle],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          bgcolor: '#0b1220',
          color: '#e2e8f0',
          border: '1px solid rgba(148,163,184,0.18)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ px: 2.2, pt: 2, pb: 0.8, bgcolor: 'transparent' }}>{header}</DialogTitle>
      <DialogContent sx={{ px: 2.2, pb: 2 }}>
        <Stack spacing={1.4}>
          <TextField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søk i Drive (navn, tagger, foldere)"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.55)' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-root': {
                color: '#e2e8f0',
                bgcolor: 'rgba(15,23,42,0.55)',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(148,163,184,0.22)',
              },
              '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#22d3ee',
              },
            }}
          />

          {notConnected ? (
            <Alert
              severity="warning"
              sx={{
                bgcolor: 'rgba(234,179,8,0.08)',
                color: '#fde68a',
                border: '1px solid rgba(234,179,8,0.25)',
              }}
            >
              Google Drive er ikke koblet til denne brukeren. Koble til workspace-kontoen fra innstillinger før du henter bilder.
            </Alert>
          ) : null}

          {error ? (
            <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca' }}>
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} sx={{ color: '#22d3ee' }} />
            </Stack>
          ) : files.length === 0 && !notConnected ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.62)', textAlign: 'center', py: 3 }}>
              Fant ingen bilder for søket.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                gap: 1.2,
                maxHeight: 420,
                overflowY: 'auto',
                pr: 0.5,
              }}
            >
              {files.map((file) => {
                const isImporting = importingId === file.id;
                const isSelected = selectedIds.includes(file.id);
                const isVideoFile = (file.mimeType || '').startsWith('video/');
                return (
                  <Box
                    key={file.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Velg fil ${file.name}`}
                    aria-pressed={isMulti ? isSelected : undefined}
                    onClick={() => (isImporting || bulkImporting ? null : handlePick(file))}
                    onKeyDown={(event) => {
                      if (isImporting || bulkImporting) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handlePick(file);
                      }
                    }}
                    sx={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: 'rgba(15,23,42,0.7)',
                      border: `1px solid ${isSelected ? '#22d3ee' : 'rgba(148,163,184,0.16)'}`,
                      cursor: isImporting || bulkImporting ? 'wait' : 'pointer',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      boxShadow: isSelected ? '0 6px 18px rgba(34,211,238,0.28)' : 'none',
                      '&:hover': isImporting || bulkImporting
                        ? undefined
                        : {
                            transform: 'translateY(-1px)',
                            borderColor: '#22d3ee',
                            boxShadow: '0 6px 18px rgba(34,211,238,0.18)',
                          },
                    }}
                  >
                    {file.thumbnailLink ? (
                      <Box
                        component="img"
                        src={file.thumbnailLink}
                        alt={file.name}
                        referrerPolicy="no-referrer"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{ width: '100%', height: '100%', color: 'rgba(226,232,240,0.5)' }}
                      >
                        {isVideoFile ? <PlayCircleFilledIcon fontSize="large" /> : <CloudDownloadIcon />}
                      </Stack>
                    )}
                    {isVideoFile ? (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.4,
                          px: 0.8,
                          py: 0.2,
                          borderRadius: 1,
                          bgcolor: 'rgba(15,23,42,0.82)',
                          color: '#fff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                        }}
                      >
                        <PlayCircleFilledIcon sx={{ fontSize: '0.9rem' }} />
                        VIDEO
                      </Box>
                    ) : null}
                    {isMulti && isSelected ? (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          bgcolor: '#22d3ee',
                          color: '#082f49',
                          borderRadius: '50%',
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          boxShadow: '0 4px 10px rgba(34,211,238,0.35)',
                        }}
                        aria-hidden
                      >
                        {selectedIds.indexOf(file.id) + 1}
                      </Box>
                    ) : null}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        p: 0.8,
                        background:
                          'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)',
                      }}
                    >
                      <Typography
                        sx={{
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {file.name}
                      </Typography>
                    </Box>
                    {isImporting ? (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(15,23,42,0.72)',
                          backdropFilter: 'blur(2px)',
                        }}
                      >
                        <CircularProgress size={22} sx={{ color: '#22d3ee' }} />
                      </Stack>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.2, pb: 1.8, justifyContent: isMulti ? 'space-between' : 'flex-end' }}>
        <Button
          onClick={onClose}
          disabled={bulkImporting}
          sx={{ textTransform: 'none', color: 'rgba(226,232,240,0.72)' }}
        >
          Lukk
        </Button>
        {isMulti ? (
          <Button
            variant="contained"
            onClick={handleConfirmMulti}
            disabled={!selectionOk || bulkImporting}
            startIcon={
              bulkImporting ? (
                <CircularProgress size={16} sx={{ color: '#082f49' }} />
              ) : (
                <CheckCircleIcon />
              )
            }
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#22d3ee',
              color: '#082f49',
              '&:hover': { bgcolor: '#06b6d4' },
              '&.Mui-disabled': { bgcolor: 'rgba(34,211,238,0.25)', color: 'rgba(8,47,73,0.6)' },
            }}
          >
            {bulkImporting
              ? `Importerer ${selectedIds.length}…`
              : `Bruk ${selectedIds.length}${minPick !== maxPick ? `/${maxPick}` : ''} valgte`}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
