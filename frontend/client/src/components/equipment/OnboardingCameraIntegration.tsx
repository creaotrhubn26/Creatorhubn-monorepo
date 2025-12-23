import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Button,
  Grid,
  Avatar,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  CameraAlt,
  CheckCircle,
  Upload,
  Build
} from '@mui/icons-material';
import { apiRequest } from '../../lib/queryClient';

interface OnboardingCameraIntegrationProps {
  userId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  selectedCameras: Array<{
    brand: string;
    model: string;
    serialNumber?: string;
    sensorSize?: string;
    megapixels?: number;
    videoCapability?: string;
    lensMount?: string;
    maxIso?: number;
    weatherSealed?: boolean;
    imageStabilization?: boolean;
    firmwareVersion?: string;
}>;
  onComplete?: () => void;
}

const PROFESSION_COLORS = {
  photographer: '#FF6B30',
  videographer: '#9C27B0',
  music_producer: '#FF5720',
  vendor: '#2196F3', 
};

const OnboardingCameraIntegration: React.FC<OnboardingCameraIntegrationProps> = ({
  userd,
  profession,
  selectedCameras,
  onComplete
}) => {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const professionColor = PROFESSION_COLORS[profession];

  const importCamerasMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/equipment/import-cameras,', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify({
          userd,
          profession,
          cameras: selectedCameras
    })
    });
  },
    onSuccess: () => {
      // Invalidate equipment queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/user', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/firmware-updates', userId] });
      onComplete?.();
  }
});

  if (!selectedCameras.length) {
    return (
      <Alert severity="info" sx={{ m:  2 }}>
        Ingen kameraer valgt i onboarding. Du kan legge til utstyr senere i utstyrsadministrasjonen.
      </Alert>
    );
}

  return (
    <Box sx={{ p:  3, maxWidth: 80, mx: 'auto'}}>
      <Box sx={{ textAlign: 'center', mb:  4 }}>
        <Avatar sx={{ 
          bgcolor: professionColor,
          width:  64,
          height:  64,
          mx: 'auto',
          mb: 2 }}>
          <Build sx={{ fontSize: '2rem'}} />
        </Avatar>
        <Typography variant="h4" sx={{  mb: 2, color: professionColor  }}>
          Importer Kameraer til Utstyrsadministrasjon
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Vi kan automatisk importere kameraene du valgte i onboarding til din utstyrsadministrasjon.
          Dette gir deg tilgang til firmware-overvåking og utstyrssporing.
        </Typography>
      </Box>

      {/* Camera Preview */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h6" sx={{  mb: 2, color: professionColor  }}>
          Kameraer som importeres: </Typography>
        <Grid container spacing={2}>
          {selectedCameras.map((camera, index) => (
            <Grid size={{ xs: 12 }} sm={6} md={4} key={index}>
              <MuiCard sx={{ 
                border: `2px solid ${professionColor}20`,
                transition: 'all 0.3s ease', '&:hover': {
                  boxShadow:  4,
                  transform: 'translateY(-2px)'
            }
            }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                    <Avatar sx={{ bgcolor: professionColor, mr:  2 }}>
                      <CameraAlt />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{  fontSize: '1rem' }}>
                        {camera.brand} {camera.model}
                      </Typography>
                      {camera.serialNumber && (
                        <Typography variant="body2" color="text.secondary">
                          SN: {camera.serialNumber}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  2 }}>
                    {camera.sensorSize && (
                      <Chip label={camera.sensorSize} size="small" variant="outlined" />
                    )}
                    {camera.megapixels && (
                      <Chip label={`${camera.megapixels}MP`} size="small" variant="outlined" />
                    )}
                    {camera.videoCapability && (
                      <Chip label={camera.videoCapability} size="small" variant="outlined" />
                    )}
                  </Box>

                  {camera.firmwareVersion && (
                    <Box sx={{ 
                      bgcolor: 'grey.10', 
                      p: 1, borderRadius:  1,
                      textAlign: 'center'
                }}>
                      <Typography variant="body2" color="text.secondary">
                        Firmware: v{camera.firmwareVersion}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </MuiCard>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Benefits */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h6" sx={{  mb: 2, color: professionColor  }}>
          Hva får du med utstyrsadministrasjon: </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={6}>
            <Alert severity="success" sx={{ height: '100%'}}>
              <Typography variant="subtitle2" sx={{ mb:  1 }}>
                <CheckCircle sx={{ mr: 1, verticalAlign: 'middle'}} />
                Automatisk Firmware-overvåking
              </Typography>
              <Typography variant="body2">
                Få varsler når nye firmware-oppdateringer er tilgjengelige fra {profession === 'photographer' ? 'Canon, Nikon, Sony og andre' : 'produsenter'}.
              </Typography>
            </Alert>
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <Alert severity="info" sx={{ height: '100%'}}>
              <Typography variant="subtitle2" sx={{ mb:  1 }}>
                <Build sx={{ mr: 1, verticalAlign: 'middle'}} />
                Vedlikeholdssporing
              </Typography>
              <Typography variant="body2">
                Hold oversikt over service, reparasjoner og utstyrets tilstand.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ textAlign: 'center'}}>
        {importCamerasMutation.isSuccess ? (
          <Alert severity="success" sx={{ mb:  2 }}>
            <Typography variant="h6" sx={{  mb:  1  }}>
              <CheckCircle sx={{ mr: 1, verticalAlign: 'middle'}} />
              Kameraer importert!
            </Typography>
            <Typography>
              Dine kameraer er nå tilgjengelige i utstyrsadministrasjonen. 
              Vi sjekker automatisk for firmware-oppdateringer.
            </Typography>
          </Alert>
        ) : (
          <Button variant="contained"
            size="large"
            startIcon={importCamerasMutation.isPending ? <CircularProgress size={20} sx={theming.getThemedButtonSx()}> : theming.getThemedIcon('upload')}
            onClick={() => importCamerasMutation.mutate()}
            disabled={importCamerasMutation.isPending}
            sx={{ 
              bgcolor: professionColor'&:hover': {
                bgcolor: professionColor,
                opacity: 0.9 },
              mb:  2,
              px:  4,
              py: 1.5 }}
          >
            {importCamerasMutation.isPending ? 'Importerer...' : 'Importer til Utstyrsadministrasjon'}
          </Button>
        )}

        {importCamerasMutation.isError && (
          <Alert severity="error" sx={{ mt:  2 }}>
            Det oppstod en feil under import. Prøv igjen eller kontakt support.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt:  2 }}>
          Du kan alltid legge til mer utstyr senere eller redigere eksisterende utstyr 
          i utstyrsadministrasjonen.
        </Typography>
      </Box>
    </Box>
  );
};

export default OnboardingCameraIntegration;