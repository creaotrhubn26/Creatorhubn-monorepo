import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, PhotoCamera as PhotoCameraIcon } from '@mui/icons-material';

type CameraType = 'DSLR' | 'Mirrorless' | 'Medium Format' | 'Film';

interface CameraOption {
  id: string;
  brand: string;
  model: string;
  type: CameraType;
  priceNok: number;
  features: string[];
  recommended: boolean;
}

const CAMERA_OPTIONS: CameraOption[] = [
  {
    id: 'nikon-z8',
    brand: 'Nikon',
    model: 'Z8',
    type: 'Mirrorless',
    priceNok: 51990,
    features: ['45.7MP', '8K video', 'Dual card slots', 'Weather sealed'],
    recommended: true,
  },
  {
    id: 'canon-r6ii',
    brand: 'Canon',
    model: 'EOS R6 Mark II',
    type: 'Mirrorless',
    priceNok: 33990,
    features: ['24.2MP', '4K60', 'IBIS', 'Dual pixel AF'],
    recommended: true,
  },
  {
    id: 'sony-a7rv',
    brand: 'Sony',
    model: 'A7R V',
    type: 'Mirrorless',
    priceNok: 47990,
    features: ['61MP', '8K output', 'AI AF', 'Pixel-shift'],
    recommended: false,
  },
  {
    id: 'canon-5d4',
    brand: 'Canon',
    model: '5D Mark IV',
    type: 'DSLR',
    priceNok: 24990,
    features: ['30.4MP', 'Dual pixel AF', 'CF + SD', 'Robust body'],
    recommended: false,
  },
];

export default function CameraSelectionTest() {
  const [budgetNok, setBudgetNok] = useState<number>(50_000);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const filteredCameras = useMemo(
    () => CAMERA_OPTIONS.filter((camera) => camera.priceNok <= budgetNok),
    [budgetNok],
  );

  const selectedCamera = useMemo(
    () => filteredCameras.find((camera) => camera.id === selectedCameraId) ?? null,
    [filteredCameras, selectedCameraId],
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <PhotoCameraIcon color="primary" />
        <Typography variant="h5">Kamera-utvalgstest</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Velg budsjett for a filtrere kameraer som passer din produksjonsflyt.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Filter
              </Typography>

              <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                <InputLabel>Budsjett</InputLabel>
                <Select
                  label="Budsjett"
                  value={String(budgetNok)}
                  onChange={(event) => setBudgetNok(Number(event.target.value))}
                >
                  <MenuItem value="25000">25 000 NOK</MenuItem>
                  <MenuItem value="35000">35 000 NOK</MenuItem>
                  <MenuItem value="50000">50 000 NOK</MenuItem>
                  <MenuItem value="70000">70 000 NOK</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="body2">Treff: {filteredCameras.length}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Grid container spacing={1.5}>
            {filteredCameras.map((camera) => (
              <Grid item xs={12} sm={6} key={camera.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: selectedCameraId === camera.id ? 'primary.main' : 'divider',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 3 },
                  }}
                  onClick={() => setSelectedCameraId(camera.id)}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {camera.brand} {camera.model}
                      </Typography>
                      {camera.recommended && <Chip size="small" color="success" label="Anbefalt" icon={<CheckCircleIcon />} />}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {camera.type} · {camera.priceNok.toLocaleString('nb-NO')} NOK
                    </Typography>

                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {camera.features.map((feature) => (
                        <Chip key={`${camera.id}-${feature}`} label={feature} size="small" variant="outlined" />
                      ))}
                    </Stack>

                    {selectedCameraId === camera.id && (
                      <Button sx={{ mt: 1.25 }} fullWidth variant="contained">
                        Valgt
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {selectedCamera && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700}>
              Valgt kamera: {selectedCamera.brand} {selectedCamera.model}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Dette valget matcher budsjettgrensen og gir tilgang til funksjonene: {selectedCamera.features.join(', ')}.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
