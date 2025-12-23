import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  InputAdornment,
  Link
} from '@mui/material';
import {
  Key,
  Launch,
  Event,
  AccessTime,
  Info,
  CheckCircle
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface WeddingTimelineClientAccessProps {
  onAccessGranted?: (accessData: any) => void;
  // Integration props
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  userId?: string
}

export default function WeddingTimelineClientAccess({ 
  onAccessGranted,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  userId
}: WeddingTimelineClientAccessProps) {
  const [accessCode, setAccessCode] = useState('');
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer,');
  const [validating, setValidating] = useState(false);
  const [accessData, setAccessData] = useState<any>(null);
  const [error, setError] = useState('');

  const validateAccessCode = async () => {
    if (!accessCode.trim()) {
      setError('Vennligst skriv inn tilgangskode');
      return;
  }

    setValidating(true);
    setError(', ');

    try {
      const response = await apiRequest(`/api/wedding/timeline/access/${accessCode.trim()}`);
      setAccessData(response);
      onAccessGranted?.(response);
  } catch (err: any) {
      if (err.message.includes('404')) {
        setError('Ugyldig tilgangskode. Sjekk koden og prøv igjen.');
  } else if (err.message.includes('403')) {
        setError('Tilgang ikke aktivert. Kontakt fotografen din.');
    } else {
        setError('Kunne ikke validere tilgangskode. Prøv igjen senere.');
    }
      setAccessData(null);
  } finally {
      setValidating(false);
  }
};

  const openClientInterface = () => {
    if (accessData?.timelineId && accessCode) {
      // Open client interface in new tab
      const clientUrl = `/wedding-timeline/client/${accessCode}`;
      window.open(clientUrl, '_blank');
  }
};

  return (
    <Box sx={{ p:  3, maxWidth: 60, mx: 'auto'}}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        <Event sx={{ fontSize: 40, color: theming.colors.primary, mr: 2 }} />
        <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
          Bryllupstidslinje - Klienttilgang
        </Typography>
      </Box>
      
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, textAlign: 'center' }}>
        Skriv inn tilgangskoden du fikk fra fotografen din for å se bryllupstidslinjen
      </Typography>

      <Card sx={{ mb: 3, boxShadow: 3, ...theming.getThemedCardSx() }}>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Tilgangskode"
                placeholder="f.eks. 123456"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ', ').substring(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && validateAccessCode()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Key sx={{ color: theming.colors.primary }} />
                    </InputAdornment>
                  )}}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: theming.colors.primary,
                    }
                  }, '& .MuiInputLabel-root.Mui-focused': {
                    color: theming.colors.primary,
                  }
                }}
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={validateAccessCode}
                disabled={!accessCode.trim() || validating}
                sx={theming.getThemedButtonSx()}
              >
                {validating ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                    Validerer...
                  </>
                ) : (
                  <>
                    <Key sx={{ mr: 1 }} />
                    Valider Tilgangskode
                  </>
                )}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb:  3 }}>
          {error}
        </Alert>
      )}

      {accessData && (
        <Card sx={{ mb: 3, boxShadow: 3, border: `2px solid ${theming.colors.success}`, ...theming.getThemedCardSx() }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircle sx={{ color: theming.colors.success, mr: 1, fontSize: 28 }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                Tilgang Godkjent!
              </Typography>
            </Box>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12 }} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Event sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Bryllup: </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600}}>
                  {accessData.coupleName || 'Bryllup'}
                </Typography>
              </Grid>
              
              <Grid size={{ xs: 12 }} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AccessTime sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Dato: </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600}}>
                  {accessData.weddingDate ? new Date(accessData.weddingDate).toLocaleDateString('no-NO') : 'Ikke satt'}
                </Typography>
              </Grid>
              
              {accessData.venue && (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Info sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Lokasjon: </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 600}}>
                    {accessData.venue}
                  </Typography>
                </Grid>
              )}
              
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Fotograf: </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600}}>
                  {accessData.photographerName || 'Ikke spesifisert'}
                </Typography>
              </Grid>
            </Grid>

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={openClientInterface}
              sx={theming.getThemedButtonSx()}
            >
              <Launch sx={{ mr: 1 }} />
              Åpne Bryllupstidslinje
            </Button>
          </CardContent>
        </Card>
      )}

      <Paper sx={{ p: 3, bgcolor: 'rgba(23, 30, 99, 0.05)', border: '1px solid rgba(23, 30, 99, 0.2)', ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <Info sx={{ mr: 1, color: theming.colors.primary }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', fontWeight: 600}}>
            Tips for bryllupsparet:
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          • Tilgangskoden består av 6 siffer<br/>
          • Du kan følge tidslinjen live på bryllupsdagen<br/>
          • Kontakt fotografen din hvis koden ikke fungerer<br/>
          • Bokmerk siden for enkel tilgang senere
        </Typography>
      </Paper>
    </Box>
  );
}