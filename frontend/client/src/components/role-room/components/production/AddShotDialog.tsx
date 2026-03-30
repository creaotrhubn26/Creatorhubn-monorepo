// ============================================
// AddShotDialog — FSM-driven extracted component
// ============================================
import { memo, useReducer, useCallback, type ChangeEvent, type FC } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Movie as MovieIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { addShotReducer, type AddShotState, type ShotSearchResult } from '../production/types';
import type { StoryboardSeedCandidate } from '../../services/storyboardLibraryService';

// ---- Props ----

export interface AddShotDialogCreatePayload {
  imageUrl?: string;
  storyboardCandidate?: StoryboardSeedCandidate;
}

interface AddShotDialogProps {
  /** The scene number label (for display) */
  sceneNumber?: number;
  /** Called when the user confirms a shot (with optional image URL) */
  onCreateShot: (payload?: AddShotDialogCreatePayload) => void;
  /** Async search function — returns results for the reference tab */
  onSearch: (query: string) => Promise<ShotSearchResult[]>;
  /** Scene-bound storyboard candidates available for quick shot creation */
  storyboardCandidates?: StoryboardSeedCandidate[];
  /** External open trigger — parent toggles this to open the dialog */
  open: boolean;
  /** Called when dialog is dismissed */
  onClose: () => void;
}

// ---- Component ----

const AddShotDialog: FC<AddShotDialogProps> = memo(function AddShotDialog({
  sceneNumber,
  onCreateShot,
  onSearch,
  storyboardCandidates = [],
  open: externalOpen,
  onClose,
}) {
  const [state, dispatch] = useReducer(addShotReducer, { open: false } as AddShotState);

  // Sync external open trigger → FSM
  // When parent says "open", we transition to chooseMode.
  // When parent says "close", we reset.
  const isOpen = externalOpen && state.open;

  // If parent opens but FSM is closed, auto-open
  if (externalOpen && !state.open) {
    dispatch({ type: 'OPEN' });
  }

  const handleClose = useCallback(() => {
    dispatch({ type: 'CLOSE' });
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'BACK' });
  }, []);

  const handleImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          dispatch({ type: 'SET_IMAGE', url: e.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!state.open || state.step !== 'search' || !state.query.trim()) return;
    dispatch({ type: 'SEARCH_START' });
    try {
      const results = await onSearch(state.query);
      dispatch({ type: 'SEARCH_DONE', results });
    } catch {
      dispatch({ type: 'SEARCH_DONE', results: [] });
    }
  }, [state, onSearch]);

  const handleCreate = useCallback(() => {
    const payload: AddShotDialogCreatePayload = {};
    if (state.open && (state.step === 'upload' || state.step === 'search')) {
      payload.imageUrl = state.selectedImage ?? undefined;
    }
    if (state.open && state.step === 'storyboard') {
      payload.storyboardCandidate = storyboardCandidates.find((candidate) => candidate.id === state.selectedStoryboardId);
      payload.imageUrl = payload.storyboardCandidate?.thumbnailUrl || payload.storyboardCandidate?.imageUrl;
    }
    onCreateShot(payload);
    dispatch({ type: 'CLOSE' });
    onClose();
  }, [state, onCreateShot, onClose, storyboardCandidates]);

  // Derive render vars
  const step = state.open ? state.step : 'chooseMode';
  const selectedImage = state.open && (state.step === 'upload' || state.step === 'search') ? state.selectedImage : null;
  const selectedStoryboardId = state.open && state.step === 'storyboard' ? state.selectedStoryboardId : null;
  const selectedStoryboardCandidate = storyboardCandidates.find((candidate) => candidate.id === selectedStoryboardId) || null;
  const query = state.open && state.step === 'search' ? state.query : '';
  const loading = state.open && state.step === 'search' ? state.loading : false;
  const results = state.open && state.step === 'search' ? state.results : [];

  return (
    <Dialog
      open={isOpen || false}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1f2e',
          border: '1px solid #3b82f6',
          minHeight: step !== 'chooseMode' ? 500 : 'auto',
        },
      }}
    >
      <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #2a3142' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <MovieIcon sx={{ color: '#3b82f6' }} />
            <span>Legg til storyboard shot</span>
          </Stack>
          {step !== 'chooseMode' && (
            <Button
              size="small"
              onClick={handleBack}
              sx={{ color: '#6b7280', fontSize: 11 }}
            >
              ← Tilbake
            </Button>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {step === 'chooseMode' ? (
          /* ---- Mode Selection ---- */
          <Stack spacing={3}>
            <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
              Velg hvordan du vil legge til et shot til scene {sceneNumber}
            </Typography>
            <Stack direction="row" spacing={2}>
              {/* Upload */}
              <Box
                onClick={() => dispatch({ type: 'CHOOSE_UPLOAD' })}
                sx={{
                  flex: 1, p: 4, borderRadius: '12px',
                  bgcolor: 'rgba(59,130,246,0.1)', border: '2px dashed #3b82f6',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.2)', borderStyle: 'solid' },
                }}
              >
                <Box sx={{ width: 64, height: 64, borderRadius: '16px', bgcolor: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff', mb: 1 }}>Last opp eget bilde</Typography>
                <Typography sx={{ fontSize: 12, color: '#6b7280' }}>Last opp storyboard eller referansebilde fra din maskin</Typography>
              </Box>

              {/* Storyboard */}
              {storyboardCandidates.length > 0 && (
                <Box
                  onClick={() => dispatch({ type: 'CHOOSE_STORYBOARD' })}
                  sx={{
                    flex: 1, p: 4, borderRadius: '12px',
                    bgcolor: 'rgba(16,185,129,0.1)', border: '2px dashed #10b981',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(16,185,129,0.2)', borderStyle: 'solid' },
                  }}
                >
                  <Box sx={{ width: 64, height: 64, borderRadius: '16px', bgcolor: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="2"/>
                      <path d="M7 15l3-3 2 2 5-5"/>
                    </svg>
                  </Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff', mb: 1 }}>Velg fra storyboard</Typography>
                  <Typography sx={{ fontSize: 12, color: '#6b7280' }}>
                    {storyboardCandidates.length} scene-knyttede storyboardelementer tilgjengelig
                  </Typography>
                </Box>
              )}

              {/* Reference */}
              <Box
                onClick={() => dispatch({ type: 'CHOOSE_SEARCH' })}
                sx={{
                  flex: 1, p: 4, borderRadius: '12px',
                  bgcolor: 'rgba(139,92,246,0.1)', border: '2px dashed #8b5cf6',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(139,92,246,0.2)', borderStyle: 'solid' },
                }}
              >
                <Box sx={{ width: 64, height: 64, borderRadius: '16px', bgcolor: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff', mb: 1 }}>Søk referanseshots</Typography>
                <Typography sx={{ fontSize: 12, color: '#6b7280' }}>Finn inspirasjon fra Shot.cafe, filmer og bildedatabaser</Typography>
              </Box>
            </Stack>
          </Stack>
        ) : step === 'upload' ? (
          /* ---- Upload Mode ---- */
          <Stack spacing={3}>
            <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>Last opp et bilde for ditt storyboard shot</Typography>
            {selectedImage ? (
              <Box sx={{ textAlign: 'center' }}>
                <Box component="img" src={selectedImage} sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: '12px', border: '2px solid #3b82f6' }} />
                <Button onClick={() => dispatch({ type: 'SET_IMAGE', url: null })} sx={{ mt: 2, color: '#6b7280' }}>Velg annet bilde</Button>
              </Box>
            ) : (
              <Box
                component="label"
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  p: 6, borderRadius: '12px', bgcolor: 'rgba(0,0,0,0.2)', border: '2px dashed #374151',
                  cursor: 'pointer', transition: 'all 0.2s',
                  '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(59,130,246,0.1)' },
                }}
              >
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <Typography sx={{ fontSize: 14, color: '#9ca3af', mt: 2 }}>Klikk for å velge bilde</Typography>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mt: 0.5 }}>Støtter JPG, PNG, WebP</Typography>
              </Box>
            )}
          </Stack>
        ) : step === 'storyboard' ? (
          <Stack spacing={3}>
            <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>
              Velg storyboard-element som allerede er koblet til scenen
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5, maxHeight: 320, overflow: 'auto', p: 0.5 }}>
              {storyboardCandidates.map((candidate) => {
                const active = candidate.id === selectedStoryboardId;
                return (
                  <Box
                    key={candidate.id}
                    onClick={() => dispatch({ type: 'SET_STORYBOARD_SELECTION', id: candidate.id })}
                    sx={{
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: active ? '3px solid #10b981' : '2px solid transparent',
                      bgcolor: active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                      transition: 'all 0.2s',
                      '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 20px rgba(16,185,129,0.18)' },
                    }}
                  >
                    {candidate.thumbnailUrl || candidate.imageUrl ? (
                      <Box component="img" src={candidate.thumbnailUrl || candidate.imageUrl} sx={{ width: '100%', height: 94, objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: '100%', height: 94, bgcolor: 'rgba(16,185,129,0.12)', color: '#6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {candidate.shotNumber}
                      </Box>
                    )}
                    <Box sx={{ p: 1 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={0.5} sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{candidate.shotNumber}</Typography>
                        <Chip size="small" label={candidate.sourceLabel} sx={{ maxWidth: 110 }} />
                      </Stack>
                      <Typography sx={{ fontSize: 12, color: '#fff', fontWeight: 600 }} noWrap>
                        {candidate.description}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.4 }}>
                        {candidate.cameraAngle || 'Eye Level'} · {candidate.movement || 'Static'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            {selectedStoryboardCandidate && (
              <Chip
                label={`Valgt: ${selectedStoryboardCandidate.shotNumber} · ${selectedStoryboardCandidate.description}`}
                sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }}
              />
            )}
          </Stack>
        ) : (
          /* ---- Reference Search Mode ---- */
          <Stack spacing={3}>
            <Typography sx={{ color: '#9ca3af', fontSize: 13 }}>Søk etter referansebilder fra Shot.cafe og andre kilder</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                placeholder="Søk: Blade Runner, cinematographer: Roger Deakins, noir lighting..."
                value={query}
                onChange={(e) => dispatch({ type: 'SET_QUERY', query: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#0d1117', color: '#fff',
                    '& fieldset': { borderColor: '#374151' },
                    '&:hover fieldset': { borderColor: '#8b5cf6' },
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                sx={{ bgcolor: '#8b5cf6', px: 3, '&:hover': { bgcolor: '#7c3aed' } }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Søk'}
              </Button>
            </Stack>

            {/* Quick tags */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {['Blade Runner', 'Noir', 'Golden Hour', 'Silhouette', 'Close-up', 'Wide Shot'].map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onClick={() => dispatch({ type: 'SET_QUERY', query: tag })}
                  sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#a78bfa', '&:hover': { bgcolor: 'rgba(139,92,246,0.3)' } }}
                />
              ))}
            </Stack>

            {/* Results grid */}
            {results.length > 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5, maxHeight: 280, overflow: 'auto', p: 1 }}>
                {results.map((r) => (
                  <Box
                    key={r.id}
                    onClick={() => dispatch({ type: 'SET_IMAGE', url: r.url })}
                    sx={{
                      position: 'relative', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden',
                      cursor: 'pointer', border: selectedImage === r.url ? '3px solid #8b5cf6' : '2px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 20px rgba(139,92,246,0.3)' },
                    }}
                  >
                    <Box component="img" src={r.thumbnailUrl || r.url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {r.film && (
                      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 0.5, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                        <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 500 }}>{r.film}</Typography>
                      </Box>
                    )}
                    {selectedImage === r.url && (
                      <Box sx={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', bgcolor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckIcon sx={{ fontSize: 14, color: '#fff' }} />
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: '#8b5cf6' }} />
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ color: '#9ca3af' }}>Avbryt</Button>
        {step !== 'chooseMode' && (
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={
              (step === 'upload' && !selectedImage)
              || (step === 'storyboard' && !selectedStoryboardCandidate)
            }
            sx={{
              bgcolor: step === 'upload' ? '#3b82f6' : step === 'storyboard' ? '#10b981' : '#8b5cf6',
              '&:hover': { bgcolor: step === 'upload' ? '#2563eb' : step === 'storyboard' ? '#059669' : '#7c3aed' },
              '&.Mui-disabled': { bgcolor: '#374151', color: '#6b7280' },
            }}
          >
            {step === 'storyboard'
              ? 'Legg til fra storyboard'
              : selectedImage
                ? 'Legg til med bilde'
                : 'Legg til uten bilde'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
});

export default AddShotDialog;
