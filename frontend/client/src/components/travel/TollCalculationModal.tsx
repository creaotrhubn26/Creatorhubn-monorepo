/**
 * CreatorHub Norge - Toll Calculation Modal
 * Bompengeberegning med ekte norske bomstasjoner
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useExternalData } from '../../services/ExternalDataService';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControlLabel,
  Checkbox,
  Divider
} from '@mui/material';
import {
  Route as RouteIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  AccessTime as TimeIcon,
  Speed as SpeedIcon,
  DirectionsCar as CarIcon,
  ElectricCar as ElectricCarIcon,
  Navigation as NavigationIcon
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface TollCalculationModalProps {
  open: boolean;
  onClose: () => void;
  onCalculationComplete?: (result: any) => void;
  initialFrom?: string;
  initialTo?: string;
  vehicleData?: any
}

const TollCalculationModal: React.FC<TollCalculationModalProps> = ({
  open,
  onClose,
  onCalculationComplete,
  initialFrom = '',
  initialTo = '',
  vehicleData
}) => {
  // Theming system
  const theming = useTheming('photographer');
  const { user } = useAuth();
  const { calculateTollCosts } = useExternalData();
  
  const [fromAddress, setFromAddress] = useState(initialFrom);
  const [toAddress, setToAddress] = useState(initialTo);
  const [includeReturn, setIncludeReturn] = useState(false);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    if (!fromAddress.trim() || !toAddress.trim()) {
      setError('Vennligst fyll ut både fra- og til-adresse');
      return;
  }

    setLoading(true);
    setError(null);
    setCalculationResult(null);

    try {
      const vehicleType = vehicleData?.fuelType?.toLowerCase().includes('elektrisk') ? 'electric_car' : 'car';
      const result = await calculateTollCosts(fromAddress.trim(), toAddress.trim(), vehicleType);
      
      setCalculationResult(result);
      if (onCalculationComplete) {
        onCalculationComplete({
          success: true,
          calculation: result
      });
    }
  } catch (error: any) {
      setError('Feil ved bompengeberegning: ' + error.message);
  } finally {
      setLoading(false);
  }
};


  const handleUseResult = () => {
    if (calculationResult && onCalculationComplete) {
      onCalculationComplete({
        success: true,
        calculation: calculationResult
  });
  }
    handleClose();
};

  const handleClose = () => {
    setFromAddress(initialFrom);
    setToAddress(initialTo);
    setIncludeReturn(false);
    setCalculationResult(null);
    setError(null);
    onClose();
};

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('nb-N', {
      style: 'currency',
      currency: 'NO',
      minimumFractionDigits:  0,
      maximumFractionDigits: 0
}).format(amount);
};

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
      }
    }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <RouteIcon color="primary" />
          <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
            Bompengeberegning - Norske bomstasjoner
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }} md={6}>
            <TextField
              fullWidth
              label="Fra adresse"
              placeholder="Oslo sentrum"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              InputProps={{
                startAdornment: <LocationIcon sx={{ mr: 1, color: 'success.main' }} />
            }}
            />
          </Grid>
          
          <Grid size={{ xs: 12 }} md={6}>
            <TextField
              fullWidth
              label="Til adresse"
              placeholder="Bergen sentrum"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              InputProps={{
                startAdornment: <LocationIcon sx={{ mr: 1, color: 'error.main' }} />
            }}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeReturn}
                  onChange={(e) => setIncludeReturn(e.target.checked)}
                />
            }
              label="Inkluder retur-reise"
            />
          </Grid>

          {vehicleData && (
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined" sx={{ bgcolor: 'background.paper' ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={{ py:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Valgt kjøretøy
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                    {vehicleData.fuelType?.toLowerCase().includes('elektrisk') ? (
                      <ElectricCarIcon color="success" />
                    ) : (
                      <CarIcon color="primary" />
                    )}
                    <Typography variant="body2">
                      {vehicleData.registration} - {vehicleData.make} {vehicleData.model}
                    </Typography>
                    <Chip 
                      label={vehicleData.fuelType}
                      size="small" 
                      color={vehicleData.fuelType?.toLowerCase().includes('elektrisk') ? 'success' : 'default'}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Button variant="contained"
              onClick={handleCalculate}
              disabled={loading || !fromAddress.trim() || !toAddress.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <NavigationIcon />}
              fullWidth
              size="large"
            >
              {loading ? 'Beregner...' : 'Beregn bompenger'}
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt:  2 }}>
            {error}
          </Alert>
        )}

        {calculationResult && (
          <Card sx={{ mt:  3, border: '2px solid', borderColor: 'success.main' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap:  1, color: theming.colors.primary }}>
                <MoneyIcon color="success" />
                Bompengeberegning komplett
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs:  6 }} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main" sx={{ ...{}, color: theming.colors.primary }}>
                      {formatPrice(calculationResult.totalTolls)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Totale bompenger
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid size={{ xs:  6 }} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="text.primary" sx={{ ...{}, color: theming.colors.primary }}>
                      {calculationResult.totalDistance} km
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total distanse
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs:  6 }} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="text.primary" sx={{ ...{}, color: theming.colors.primary }}>
                      {Math.round(calculationResult.estimatedTime / 60)} t
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Kjøretid
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs:  6 }} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="text.primary" sx={{ ...{}, color: theming.colors.primary }}>
                      {calculationResult.tollStations?.length || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Bomstasjoner
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {calculationResult.tollStations && calculationResult.tollStations.length > 0 && (
                <>
                  <Divider sx={{ my:  2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Bomstasjoner på ruten: </Typography>
                  <List dense>
                    {calculationResult.tollStations.map((station: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <RouteIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={station.name}
                          secondary={`${formatPrice(station.price)} - ${station.location}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {calculationResult.route && (
                <>
                  <Divider sx={{ my:  2 }} />
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Rute: </strong> {calculationResult.route}
                    </Typography>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Alert severity="info" sx={{ mt:  2 }}>
          <Typography variant="body2">
            <strong>Bompengeberegning inkluderer: </strong><br />
            • Ekte norske bomstasjoner og priser (2025)<br />
            • Automatisk ruteberegning med GPS-koordinater<br />
            • Elbil-rabatter der tilgjengelig<br />
            • Retur-reise beregning<br />
            • Intelligent fallback når AutoSync API ikke er tilgjengelig
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Avbryt
        </Button>
        {calculationResult && (
          <Button variant="contained"
            onClick={handleUseResult}
            startIcon={<MoneyIcon />}
          >
            Bruk denne beregningen
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TollCalculationModal;