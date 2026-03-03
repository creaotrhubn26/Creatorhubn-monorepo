import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddCircleOutline,
  Delete,
  Memory,
  Search,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { CameraSearchResult } from '@shared/camera-database-schema';

interface CameraSelectionStepProps {
  onCamerasSelected: (cameras: CameraSearchResult[]) => void;
  selectedCameras: CameraSearchResult[];
  profession: string;
}

function extractCameraResults(payload: unknown): CameraSearchResult[] {
  if (Array.isArray(payload)) {
    return payload as CameraSearchResult[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: CameraSearchResult[] }).data;
  }

  return [];
}

function professionLabel(profession: string): string {
  switch (profession) {
    case 'photographer':
    case 'fotograf':
      return 'fotograf';
    case 'videographer':
    case 'videograf':
      return 'videograf';
    case 'music_producer':
    case 'musikkprodusent':
      return 'musikkprodusent';
    default:
      return profession;
  }
}

export function CameraSelectionStep({
  onCamerasSelected,
  selectedCameras,
  profession,
}: CameraSelectionStepProps) {
  const [query, setQuery] = useState('');
  const [pendingCamera, setPendingCamera] = useState<CameraSearchResult | null>(null);

  const { data: cameraResults = [], isLoading } = useQuery({
    queryKey: ['/api/cameras/search', query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const response = await apiRequest(
        `/api/cameras/search?q=${encodeURIComponent(query.trim())}&limit=25`,
      );
      return extractCameraResults(response);
    },
  });

  const selectedIds = useMemo(() => new Set(selectedCameras.map((camera) => camera.id)), [selectedCameras]);

  const handleConfirmAdd = () => {
    if (!pendingCamera) {
      return;
    }

    if (!selectedIds.has(pendingCamera.id)) {
      onCamerasSelected([...selectedCameras, pendingCamera]);
    }

    setPendingCamera(null);
    setQuery('');
  };

  const handleRemoveCamera = (cameraId: string) => {
    onCamerasSelected(selectedCameras.filter((camera) => camera.id !== cameraId));
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Søk etter kamera-modellene du bruker som {professionLabel(profession)}. Dette styrer presets,
        filoppsett og minnekort-workflow.
      </Typography>

      <TextField
        fullWidth
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Søk kamera (f.eks. Sony A7S, Canon R5, BMPCC...)"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {selectedCameras.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Valgte kameraer ({selectedCameras.length})
          </Typography>
          <List dense disablePadding>
            {selectedCameras.map((camera) => (
              <ListItem key={camera.id} divider>
                <ListItemText
                  primary={camera.fullName}
                  secondary={
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                      {camera.supportedMemoryCardTypes.map((cardType) => (
                        <Chip
                          key={`${camera.id}-${cardType}`}
                          label={cardType}
                          size="small"
                          icon={<Memory fontSize="small" />}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    color="error"
                    onClick={() => handleRemoveCamera(camera.id)}
                    aria-label={`Remove ${camera.fullName}`}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {query.trim().length < 2 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          Skriv minst 2 tegn for å søke i kameradatabasen.
        </Alert>
      ) : (
        <Paper variant="outlined" sx={{ mt: 2, p: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">Søkeresultater</Typography>
            {isLoading && <CircularProgress size={18} />}
          </Box>

          {!isLoading && cameraResults.length === 0 ? (
            <Alert severity="warning">Ingen kamera funnet for "{query}".</Alert>
          ) : (
            <List dense disablePadding>
              {cameraResults.map((camera) => {
                const alreadySelected = selectedIds.has(camera.id);

                return (
                  <ListItem key={camera.id} divider>
                    <ListItemText
                      primary={camera.fullName}
                      secondary={camera.category || 'Kamera'}
                    />
                    <Button
                      size="small"
                      variant={alreadySelected ? 'outlined' : 'contained'}
                      color={alreadySelected ? 'inherit' : 'primary'}
                      disabled={alreadySelected}
                      startIcon={<AddCircleOutline fontSize="small" />}
                      onClick={() => setPendingCamera(camera)}
                    >
                      {alreadySelected ? 'Valgt' : 'Legg til'}
                    </Button>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>
      )}

      <Dialog open={Boolean(pendingCamera)} onClose={() => setPendingCamera(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til kamera</DialogTitle>
        <DialogContent>
          <Typography>
            Vil du legge til <strong>{pendingCamera?.fullName}</strong> i prosjektoppsettet?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingCamera(null)}>Avbryt</Button>
          <Button onClick={handleConfirmAdd} variant="contained">
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
