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
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomDriveImage,
} from '../../services/roleRoomAgentService';

type GoogleDriveImagePickerProps = {
  open: boolean;
  aspect?: '4:5' | '1:1' | '9:16';
  onClose: () => void;
  onPick: (image: { dataUrl: string; name: string; fileId: string; mimeType: string }) => void;
};

export default function GoogleDriveImagePicker({ open, onClose, onPick }: GoogleDriveImagePickerProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [files, setFiles] = useState<RoleRoomDriveImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQuery('');
    setNotConnected(false);
    void loadFiles('');
  }, [open]);

  const loadFiles = async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await roleRoomAgentService.listDriveImages(searchQuery);
      if (result.notConnected) {
        setNotConnected(true);
        setFiles([]);
        return;
      }
      setNotConnected(false);
      setFiles(result.files);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke hente Google Drive-bilder.');
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

  const handlePick = async (file: RoleRoomDriveImage) => {
    setImportingId(file.id);
    setError(null);
    try {
      const imported = await roleRoomAgentService.importDriveImage(file.id);
      onPick({
        dataUrl: imported.dataUrl,
        name: imported.name || file.name,
        fileId: file.id,
        mimeType: imported.mimeType || file.mimeType,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke importere bildet fra Drive.');
    } finally {
      setImportingId(null);
    }
  };

  const header = useMemo(
    () => (
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack spacing={0.2}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.02rem' }}>
            Velg bilde fra Google Drive
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.64)', fontSize: '0.82rem' }}>
            Henter bilder fra kontoen som er koblet til prosjektet.
          </Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'rgba(226,232,240,0.75)' }}>
          <CloseIcon />
        </IconButton>
      </Stack>
    ),
    [onClose],
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
                return (
                  <Box
                    key={file.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Velg bilde ${file.name}`}
                    onClick={() => (isImporting ? null : handlePick(file))}
                    onKeyDown={(event) => {
                      if (isImporting) return;
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
                      border: '1px solid rgba(148,163,184,0.16)',
                      cursor: isImporting ? 'wait' : 'pointer',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      '&:hover': isImporting
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
                        <CloudDownloadIcon />
                      </Stack>
                    )}
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
      <DialogActions sx={{ px: 2.2, pb: 1.8 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: 'rgba(226,232,240,0.72)' }}>
          Lukk
        </Button>
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
