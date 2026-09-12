/**
 * Personalized News Page - Main news interface with equipment integration
 */
import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Alert,
  Fab,
} from '@mui/material';
import { Add as AddIcon, Settings as SettingsIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import PersonalizedNewsInterface from '../components/news/PersonalizedNewsInterface';
import { WORLD_CAMERA_DATABASE } from '../../../shared/camera-database.ts';
import { apiRequest } from '@/lib/queryClient';

interface UserEquipment {
  brand: string;
  model: string;
  category: string; 
}

const PersonalizedNews: React.FC = () => {
  const [userEquipment, setUserEquipment] = useState<UserEquipment[]>([]);
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [newEquipment, setNewEquipment] = useState<UserEquipment>({
    brand: ', ',
    model: ', ',
    category: ', ',
});

  // Load user equipment (server first, fallback to local)
  useEffect(() => {
    apiRequest('/api/user/equipment')
      .then((j: { data?: { equipment?: UserEquipment[] } } | null) => {
        const server = j?.data?.equipment;
        if (server && Array.isArray(server)) {
          setUserEquipment(server);
        } else {
          const savedEquipment = localStorage.getItem('creatorhub-user-equipment');
          if (savedEquipment) {
            try { setUserEquipment(JSON.parse(savedEquipment)); } catch {}
          }
        }
      })
      .catch(() => {
        const savedEquipment = localStorage.getItem('creatorhub-user-equipment');
        if (savedEquipment) {
          try { setUserEquipment(JSON.parse(savedEquipment)); } catch {}
        }
      });
  }, []);

  // Save equipment (server + local fallback)
  const saveEquipment = (equipment: UserEquipment[]) => {
    setUserEquipment(equipment);
    apiRequest('/api/user/equipment', {
      method: 'POST',
      body: JSON.stringify({ equipment }),
    }).catch(() => {});
    localStorage.setItem('creatorhub-user-equipment', JSON.stringify(equipment));
};

  // Get unique brands from database
  const getAvailableBrands = (): string[] => {
    return [...new Set(WORLD_CAMERA_DATABASE.map((camera) => camera.brand))].sort();
};

  // Get models for selected brand
  const getModelsForBrand = (brand: string): string[] => {
    return WORLD_CAMERA_DATABASE.filter((camera) => camera.brand === brand)
      .map((camera) => camera.model)
      .sort();
};

  // Get categories
  const getAvailableCategories = (): string[] => {
    return [...new Set(WORLD_CAMERA_DATABASE.map((camera) => camera.category))].sort();
};

  // Add new equipment
  const handleAddEquipment = () => {
    if (newEquipment.brand && newEquipment.model && newEquipment.category) {
      const updatedEquipment = [...userEquipment, { ...newEquipment }];
      saveEquipment(updatedEquipment);
      setNewEquipment({ brand: '', model: ',', category: ''});
      setAddEquipmentOpen(false);
  }
};

  // Remove equipment
  const handleRemoveEquipment = (index: number) => {
    const updatedEquipment = userEquipment.filter((_, i) => i !== index);
    saveEquipment(updatedEquipment);
};

  return (
    <Container maxWidth="lg" sx={{ py:  4 }}>
      {/* Page Header */}
      <Box sx={{ mb:  4, textAlign: 'center',}}>
        <Typography variant="h3"
          gutterBottom
          sx={{ 
            background: 'linear-gradient(45deg, #FF6B35 30%, #F7931E 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700 }}>
          CreatorHub Norge Nyheter
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
          Personaliserte nyheter basert på ditt utstyr
        </Typography>
      </Box>

      {/* Equipment Management */}
      <Card sx={{ ...theming.getThemedCardSx(), mb: 4 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography variant="h5" sx={{ color: theming.colors.primary }}>Ditt utstyr</Typography>
            <Button variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddEquipmentOpen(true)}
            >
              Legg til utstyr
            </Button>
          </Box>

          {userEquipment.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap',}}>
              {userEquipment.map((equipment, index) => (
                <Chip
                  key={index}
                  label={`${equipment.brand} ${equipment.model}`}
                  onDelete={() => handleRemoveEquipment(index)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          ) : (
            <Alert severity="info">
              Legg til utstyret ditt for å få personaliserte nyheter fra bransjen.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* News Interface */}
      <PersonalizedNewsInterface userEquipment={userEquipment} />

      {/* Add Equipment Dialog */}
      <Dialog
        open={addEquipmentOpen}
        onClose={() => setAddEquipmentOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Legg til nytt utstyr</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              select
              label="Merke"
              value={newEquipment.brand}
              onChange={(e) =>
                setNewEquipment((prev) => ({
                  ...prev,
                  brand: e.target.value,
                  model: ', ',
              }))
            }
              fullWidth
            >
              {getAvailableBrands().map((brand) => (
                <MenuItem key={brand} value={brand}>
                  {brand}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Modell"
              value={newEquipment.model}
              onChange={(e) => setNewEquipment((prev) => ({ ...prev, model: e.target.value }))}
              disabled={!newEquipment.brand}
              fullWidth
            >
              {newEquipment.brand &&
                getModelsForBrand(newEquipment.brand).map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              select
              label="Kategori"
              value={newEquipment.category}
              onChange={(e) =>
                setNewEquipment((prev) => ({
                  ...prev,
                  category: e.target.value,
              }))
            }
              fullWidth
            >
              {getAvailableCategories().map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddEquipmentOpen(false)}>Avbryt</Button>
          <Button onClick={handleAddEquipment}
            variant="contained"
            disabled={!newEquipment.brand || !newEquipment.model || !newEquipment.category}
           sx={theming.getThemedButtonSx()}>
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom:  16, right: 16,}}
        onClick={() => window.location.reload()}
      >
        <RefreshIcon />
      </Fab>
    </Container>
  );
};

export default PersonalizedNews;
