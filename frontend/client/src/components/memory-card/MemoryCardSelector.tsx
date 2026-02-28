/**
 * CreatorHub Norge - Memory Card Selector for Project Creation
 * Integrerer minnekort valg direkte i prosjektopprettelsen basert på utstyr
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Paper,
  IconButton,
  Stack,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Memory,
  PhotoCamera,
  Storage,
  Check,
} from '@mui/icons-material';
import { 
  WORLD_CAMERA_DATABASE, 
  calculateCapacityEstimates, 
  searchCameras, 
  getCameraByName
} from '../../../../shared/camera-database';

interface MemoryCardConfig {
  capacity: string;
  count: number;
  estimatedPhotos: {
    raw: number;
    craw: number;
};
}

interface MemoryCardSelectorProps {
  equipment?: string;
  profession: 'photographer' | 'videographer';
  onCardsSelected: (cards: MemoryCardConfig[]) => void;
  onCameraChanged?: (camera: string) => void;
  initialCards?: MemoryCardConfig[]
}

// Capacity estimates for different cameras
const CAPACITY_ESTIMATES = {
  'Canon R5': {
    '128GB': { raw: 260, craw: 5200 }, '256GB': { raw: 520, craw: 10400 }, '512GB': { raw: 1040, craw: 20800 }, '1TB': { raw: 2080, craw: 41600 }, '2TB': { raw: 4160, craw: 83200 }
  }, 'Canon R6 Mark II': {
    '128GB': { raw: 320, craw: 6400 }, '256GB': { raw: 640, craw: 12800 }, '512GB': { raw: 1280, craw: 25600 }, '1TB': { raw: 2560, craw: 51200 }, '2TB': { raw: 5120, craw: 102400 }
  }, 'Sony A7R V': {
    '128GB': { raw: 210, craw: 4200 }, '256GB': { raw: 420, craw: 8400 }, '512GB': { raw: 840, craw: 16800 }, '1TB': { raw: 1680, craw: 33600 }, '2TB': { raw: 3360, craw: 67200 }
  }, 'Nikon Z9': {
    '128GB': { raw: 280, craw: 5600 }, '256GB': { raw: 560, craw: 11200 }, '512GB': { raw: 1120, craw: 22400 }, '1TB': { raw: 2240, craw: 44800 }, '2TB': { raw: 4480, craw: 89600 }
  }, 'Sony A7 IV': {
    '128GB': { raw: 380, craw: 7600 }, '256GB': { raw: 760, craw: 15200 }, '512GB': { raw: 1520, craw: 30400 }, '1TB': { raw: 3040, craw: 60800 }, '2TB': { raw: 6080, craw: 121600 }
  }
};

export default function MemoryCardSelector({
  equipment = 'Canon EOS R5',
  profession,
  onCardsSelected,
  onCameraChanged,
  initialCards = []
}: MemoryCardSelectorProps) {
  const [selectedCards, setSelectedCards] = useState<MemoryCardConfig[]>(initialCards);
  const [selectedCamera, setSelectedCamera] = useState<string>(equipment);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [cameraSearch, setCameraSearch] = useState('');
  
  // Get camera specs and calculate estimates
  const cameraSpec = getCameraByName(selectedCamera) || WORLD_CAMERA_DATABASE[0];
  const staticEstimateKey = Object.keys(CAPACITY_ESTIMATES).find((key) =>
    selectedCamera.toLowerCase().includes(key.toLowerCase())
  ) as keyof typeof CAPACITY_ESTIMATES | undefined;
  const estimates = staticEstimateKey
    ? CAPACITY_ESTIMATES[staticEstimateKey]
    : calculateCapacityEstimates(cameraSpec);

  const updateCardCount = (capacity: string, delta: number) => {
    setSelectedCards(prev => {
      const existing = prev.find(card => card.capacity === capacity);
      const newCount = Math.max(0, (existing?.count || 0) + delta);
      
      if (newCount === 0) {
        const updated = prev.filter(card => card.capacity !== capacity);
        onCardsSelected(updated);
        return updated;
    }
      
      const updated = existing
        ? prev.map(card => 
            card.capacity === capacity 
              ? { ...card, count: newCount }
              : card
          )
        : [...prev, {
            capacity,
            count: newCount,
            estimatedPhotos: estimates[capacity as keyof typeof estimates]
      }];
      
      onCardsSelected(updated);
      return updated;
  });
};

  const getCardCount = (capacity: string): number => {
    return selectedCards.find(card => card.capacity === capacity)?.count || 0;
};

  const getTotalEstimate = () => {
    return selectedCards.reduce((total, card) => {
      return total + (card.estimatedPhotos.raw * card.count);
  }, 0);
};

  const getTotalCards = () => {
    return selectedCards.reduce((total, card) => total + card.count, 0);
};

  return (
    <Box>
      <Alert severity="info" sx={{ mb:  3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PhotoCamera fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Valgt kamera: {selectedCamera}
          </Typography>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={theming.getThemedIcon('search')}
            onClick={() => setShowCameraDialog(true)}
          >
            Endre kamera
          </Button>
        </Box>
        <Typography variant="body2">
          {cameraSpec.megapixels}MP • {cameraSpec.averageRawSize}MB per RAW fil • {cameraSpec.cardTypes.join(', ')}
        </Typography>
        <Typography variant="body2">
          Minnekort anbefalinger er optimalisert for{' '}
          {profession === 'videographer' ? 'videoopptak' : 'fotoopptak'} med dette kameraet.
        </Typography>
      </Alert>

      {/* Camera Selection Dialog */}
      <Dialog open={showCameraDialog} onClose={() => setShowCameraDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Velg Kamera fra Verdensdekkende Database</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Søk etter kamera (merke, modell, kategori)"
            value={cameraSearch}
            onChange={(e) => setCameraSearch(e.target.value)}
            sx={{ mb:  2 }}
            placeholder="f.eks. Canon R5, Sony A7, Nikon Z9..."
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            {WORLD_CAMERA_DATABASE.length} kameraer tilgjengelig fra hele verden
          </Typography>
          
          <Box sx={{ maxHeight: 400, overflow: 'auto'}}>
            <List dense>
              {(cameraSearch ? searchCameras(cameraSearch) : WORLD_CAMERA_DATABASE)
                .slice(0, 50) // Limit to first 50 results
                .map((camera) => (
                <ListItemButton
                  key={`${camera.brand}-${camera.model}`}
                  onClick={() => {
                    const cameraName = `${camera.brand} ${camera.model}`;
                    setSelectedCamera(cameraName);
                    onCameraChanged?.(cameraName);
                    setSelectedCards([]); // Reset cards when camera changes
                    setShowCameraDialog(false);
                }}
                  selected={selectedCamera === `${camera.brand} ${camera.model}`}
                >
                  <ListItemText
                    primary={`${camera.brand} ${camera.model}`}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {camera.megapixels}MP • {camera.averageRawSize}MB RAW • {camera.year}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {camera.cardTypes.join(', ')} • {camera.category}
                        </Typography>
                      </Box>
                  }
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCameraDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Memory color="primary" />
        Velg Minnekort for Prosjektet
      </Typography>

      <Grid container spacing={2} sx={{ mb:  3 }}>
        {Object.entries(estimates).map(([capacity, estimate]) => {
          const count = getCardCount(capacity);
          const isSelected = count > 0;
          
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={capacity}>
              <MuiCard 
                sx={{ 
                  height: '100%',
                  border: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'primary.50' : 'background.paper',
                  transition: 'all 0.2', '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 2 }
              }}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Storage color={isSelected ? 'primary' : 'action'} />
                    <Typography variant="h6" color={isSelected ? 'primary' : 'text.primary'} sx={{ color: theming.colors.primary }}>
                      {capacity}
                    </Typography>
                    {isSelected && <Check color="primary" fontSize="small" />}
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    ~{estimate.raw.toLocaleString()} RAW bilder
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                    ~{estimate.craw.toLocaleString()} C-RAW bilder
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <IconButton
                        size="small"
                        onClick={() => updateCardCount(capacity, -1)}
                        disabled={count === 0}
                        color="primary"
                      >
                        {theming.getThemedIcon('remove')}
                      </IconButton>
                      
                      <Chip 
                        label={count}
                        color={count > 0 ? 'primary' : 'default'}
                        sx={{ minWidth: 50}}
                      />
                      
                      <IconButton
                        size="small"
                        onClick={() => updateCardCount(capacity, 1)}
                        color="primary"
                      >
                        {theming.getThemedIcon('add')}
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </MuiCard>
            </Grid>
          );
      })}
      </Grid>

      {selectedCards.length > 0 && (
        <Paper sx={{ p:  3, bgcolor: 'success.5', border: 1, borderColor: 'success.200',  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" sx={{  mb: 2, color: 'success.800' }}>
            📋 Minnekort Sammendrag
          </Typography>
          
          <Grid container spacing={2} sx={{ mb:  2 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Totalt kort: </Typography>
              <Typography variant="h5" color="success.800" sx={{ color: theming.colors.primary }}>
                {getTotalCards()}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Estimerte RAW bilder: </Typography>
              <Typography variant="h5" color="success.800" sx={{ color: theming.colors.primary }}>
                {getTotalEstimate().toLocaleString()}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                Valgte kort: </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap:  1 }}>
                {selectedCards.map(card => (
                  <Chip
                    key={card.capacity}
                    label={`${card.count}x ${card.capacity}`}
                    color="success"
                    size="small"
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>

          <Divider sx={{ my:  2 }} />

          <Alert severity="success" sx={{ bgcolor: 'transparent'}}>
            <Typography variant="body2">
              💡 <strong>Pro Tips: </strong> I post-produksjons fasen vil systemet guide deg gjennom
              en strukturert backup prosess hvor hvert minnekort lastes opp til separate Google Drive mapper
              med full progresjon og sikkerhet.
            </Typography>
          </Alert>
        </Paper>
     )}
    </Box>
  );
}
