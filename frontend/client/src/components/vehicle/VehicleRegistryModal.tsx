/**
 * CreatorHub Norge - Vehicle Registry Modal
 * Integrasjon med Statens Vegvesen API for kjøretøyoppslag
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  DirectionsCar as CarIcon,
  ElectricCar as ElectricCarIcon,
  LocalGasStation as FuelIcon,
  Speed as SpeedIcon,
  FitnessCenter as WeightIcon,
  Battery4Bar as BatteryIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface VehicleRegistryModalProps {
  open: boolean;
  onClose: () => void;
  onVehicleSelected?: (vehicle: any) => void;
}

const VehicleRegistryModal: React.FC<VehicleRegistryModalProps> = ({
  open,
  onClose,
  onVehicleSelected
}) => {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer,');
  
  // External data service for vehicle registry
  const { getVehicleData } = useExternalData();

  // Lookup vehicle using ExternalDataService
  const lookupVehicle = async (registration: string) => {
    setSearching(true);
    setError(null);
    setVehicleData(null);
    
    try {
      const vehicleData = await getVehicleData(registration.toUpperCase());
      setVehicleData(vehicleData);
  } catch (error: any) {
      setError('Feil ved oppslag i Vegvesenets register: ' + error.message);
      setVehicleData(null);
  } finally {
      setSearching(false);
  }
};

  const handleSearch = () => {
    if (!registrationNumber.trim()) {
      setError('Vennligst skriv inn registreringsnummer');
      return;
  }

    lookupVehicle(registrationNumber.trim());
};

  const handleUseVehicle = () => {
    if (vehicleData && onVehicleSelected) {
      onVehicleSelected(vehicleData);
  }
    handleClose();
};

  const handleClose = () => {
    setRegistrationNumber(', ');
    setVehicleData(null);
    setError(null);
    setSearching(false);
    onClose();
};

  const formatRegistration = (reg: string) => {
    return reg.replace(/(.{2})(.{5})/, '$1 $2');
};

  const getVehicleIcon = (vehicle: any) => {
    if (vehicle.fuelType?.toLowerCase().includes('elektrisk')) {
      return <ElectricCarIcon sx={{ color: 'success.main' }} />;
  }
    return <CarIcon sx={{ color: 'primary.main' }} />;
};

  const getTaxRateColor = (rate: number) => {
    if (rate <= 3.5) return 'success.main'; // Elbil eller lav sats
    if (rate <= 4.0) return 'warning.main'; // Moderat sats  
    return 'error.main'; // Høy sats
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CarIcon color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Kjøretøyregistrering - Statens Vegvesen API
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Registreringsnummer"
            placeholder="EL95860 eller NF12345"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={handleSearch}
                    disabled={searching || !registrationNumber.trim()}
                  >
                    {searching ? <CircularProgress size={20} /> : <SearchIcon />}
                  </IconButton>
                </InputAdornment>
              )
          }}
            helperText="Skriv inn norsk registreringsnummer (eks: EL95860)"
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon />
              {error}
            </Box>
          </Alert>
        )}

        {vehicleData && (
          <Card sx={{ mb: 3, border: '2px solid', borderColor: 'success.main' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {getVehicleIcon(vehicleData)}
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {formatRegistration(vehicleData.registration)}
                  </Typography>
                  <Chip 
                    icon={<CheckIcon />}
                    label="Vegvesen Verifisert"
                    color="success"
                    size="small"
                  />
                </Box>
                {vehicleData.fuelType?.toLowerCase().includes('elektrisk') && (
                  <Chip 
                    icon={<ElectricCarIcon />}
                    label="⚡ ELBIL" 
                    color="success"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }} md={6}>
                  <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
                    {vehicleData.make} {vehicleData.model}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    {vehicleData.year} • {vehicleData.vehicleType}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12 }} md={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Chip
                      label={`${vehicleData.taxRate} kr/km`}
                      sx={{ 
                        color: getTaxRateColor(vehicleData.taxRate),
                        fontWeight: 'bold',
                        fontSize: '1rem'
                    }}
                    />
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }} md={3}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FuelIcon color="primary" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Drivstoff
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {vehicleData.fuelType}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {vehicleData.weight && (
                      <Grid size={{ xs: 6 }} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WeightIcon color="primary" />
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Egenvekt
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {vehicleData.weight} kg
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    )}

                    {vehicleData.co2Emissions && (
                      <Grid size={{ xs: 6 }} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SpeedIcon color="primary" />
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              CO2 utslipp
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {vehicleData.co2Emissions} g/km
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    )}

                    {vehicleData.electricRange && (
                      <Grid size={{ xs: 6 }} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BatteryIcon color="success" />
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Rekkevidde
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {vehicleData.electricRange} km
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Grid>

                {vehicleData.inspectionDue && (
                  <Grid size={{ xs: 12 }}>
                    <Alert 
                      severity={new Date(vehicleData.inspectionDue) < new Date() ? 'error' : 'info'}
                      sx={{ mt: 1 }}
                    >
                      <Typography variant="body2">
                        <strong>EU-kontroll: </strong> {new Date(vehicleData.inspectionDue).toLocaleDateString('nb-NO')}
                        {new Date(vehicleData.inspectionDue) < new Date() &&' (Utgått!)'}
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        )}

        <Alert severity="info">
          <Typography variant="body2">
            <strong>Integrasjon med Statens Vegvesen: </strong><br />
            • Automatisk henting av kjøretøydata fra offisielt register<br />
            • Riktige skattesatser (3,10 kr/km for elbiler, 4,15 kr/km for fossile)<br />
            • Vekt, forbruk og tekniske data for nøyaktige kostnadsberegninger<br />
            • EU-kontroll status og registreringsdetaljer
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Avbryt
        </Button>
        {vehicleData && (
          <Button variant="contained"
            onClick={handleUseVehicle}
            startIcon={<CheckIcon />}
            sx={theming.getThemedButtonSx()}
          >
            Bruk dette kjøretøyet
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VehicleRegistryModal;