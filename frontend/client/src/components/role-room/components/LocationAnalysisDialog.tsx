import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Flight as FlightIcon,
  WbSunny as SunIcon,
  Accessible as AccessibleIcon,
  LocalParking as ParkingIcon,
  DirectionsBus as BusIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  Navigation as NavigationIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import { Location } from '../models/casting';
import { externalDataService } from '@/services/ExternalDataService';

interface LocationAnalysisDialogProps {
  open: boolean;
  location: Location | null;
  onClose: () => void;
  onAnalysisComplete?: (analysis: Location['propertyAnalysis']) => void;
}

// Helper function to open maps navigation
const openMapsNavigation = (lat: number, lng: number) => {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}`;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  if (isIOS) {
    window.open(appleMapsUrl, '_blank');
  } else if (isAndroid) {
    window.open(`google.navigation:q=${lat},${lng}`, '_blank');
  } else {
    window.open(googleMapsUrl, '_blank');
  }
};

// Reusable Parking/Charging Spot List Item Component
interface SpotListItemProps {
  spot: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
    distance: number;
    spaces?: number;
  };
  variant?: 'default' | 'ev';
  spaceLabel?: string;
  index: number;
}

const SpotListItem = memo(({ spot, variant = 'default', spaceLabel, index }: SpotListItemProps) => {
  const bgColor = variant === 'ev' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)';
  const borderColor = variant === 'ev' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)';
  const hoverBgColor = variant === 'ev' ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)';
  const hoverBorderColor = variant === 'ev' ? 'rgba(16,185,129,0.4)' : 'rgba(16,185,129,0.3)';
  
  const handleClick = useCallback(() => {
    openMapsNavigation(spot.coordinates.lat, spot.coordinates.lng);
  }, [spot.coordinates.lat, spot.coordinates.lng]);

  return (
    <ListItem
      key={index}
      sx={{
        p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
        mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
        borderRadius: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
        bgcolor: bgColor,
        border: `1px solid ${borderColor}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: hoverBgColor,
          borderColor: hoverBorderColor,
          transform: 'translateX(4px)',
        },
      }}
      onClick={handleClick}
    >
      <ListItemIcon sx={{ minWidth: { xs: 40, sm: 44, md: 42, lg: 48, xl: 52 } }}>
        <Box sx={{ 
          width: { xs: 36, sm: 40, md: 38, lg: 44, xl: 48 }, 
          height: { xs: 36, sm: 40, md: 38, lg: 44, xl: 48 }, 
          borderRadius: '50%', 
          bgcolor: 'rgba(16,185,129,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <NavigationIcon sx={{ color: '#10b981', fontSize: { xs: '1.2rem', sm: '1.3rem', md: '1.25rem', lg: '1.4rem', xl: '1.5rem' } }} />
        </Box>
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
            {spot.name}
          </Typography>
        }
        secondary={
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
              {spot.address}
            </Typography>
            <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                label={`${spot.distance} m unna`}
                size="small"
                sx={{
                  bgcolor: variant === 'ev' ? 'rgba(16,185,129,0.2)' : 'rgba(0,212,255,0.2)',
                  color: variant === 'ev' ? '#10b981' : '#00d4ff',
                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                  height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                  '& .MuiChip-label': {
                    px: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                  },
                }}
              />
              {spot.spaces && spaceLabel && (
                <Chip
                  label={spaceLabel}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(16,185,129,0.2)',
                    color: '#10b981',
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                    height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                    '& .MuiChip-label': {
                      px: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                    },
                  }}
                />
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, ml: 'auto' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                  Trykk for navigering
                </Typography>
                <OpenInNewIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.9rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }} />
              </Box>
            </Box>
          </Box>
        }
        secondaryTypographyProps={{ component: 'div' }}
      />
    </ListItem>
  );
});

SpotListItem.displayName = 'SpotListItem';

export function LocationAnalysisDialog({ open, location, onClose, onAnalysisComplete }: LocationAnalysisDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Location['propertyAnalysis'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedForLocation, setHasLoadedForLocation] = useState<string | null>(null);

  const loadAnalysisForProperty = useCallback(async (propertyId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const propertyAnalysis = await externalDataService.analyzeProperty(propertyId);
      
      const analysisData: Location['propertyAnalysis'] = {
        photographySpots: propertyAnalysis.photographySpots,
        droneRestrictions: propertyAnalysis.droneRestrictions,
        weatherExposure: propertyAnalysis.weatherExposure,
        accessAnalysis: propertyAnalysis.accessAnalysis,
      };
      
      setAnalysis(analysisData);
      if (onAnalysisComplete) {
        onAnalysisComplete(analysisData);
      }
    } catch (err) {
      console.error('Error loading property analysis:', err);
      setError('Kunne ikke laste lokasjonsanalyse');
    } finally {
      setLoading(false);
    }
  }, [onAnalysisComplete]);

  const loadPropertyFromAddress = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const addressData = await externalDataService.getKartverketAddress(address);
      if (addressData.propertyId) {
        await loadAnalysisForProperty(addressData.propertyId);
      } else {
        setError('Kunne ikke finne lokasjons-ID for denne adressen');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading property from address:', err);
      setError('Kunne ikke laste lokasjonsdata');
      setLoading(false);
    }
  }, [loadAnalysisForProperty]);

  // Load analysis when dialog opens - use stable location identifier to prevent repeated loads
  useEffect(() => {
    if (!open) {
      // Reset loaded state when dialog closes
      setHasLoadedForLocation(null);
      return;
    }
    
    const locationKey = location?.propertyId || location?.address || null;
    
    // Skip if already loaded for this location
    if (!locationKey || hasLoadedForLocation === locationKey) {
      return;
    }
    
    // Mark as loading for this location
    setHasLoadedForLocation(locationKey);
    
    if (location?.propertyId) {
      loadAnalysisForProperty(location.propertyId);
    } else if (location?.address) {
      loadPropertyFromAddress(location.address);
    }
  }, [open, location?.propertyId, location?.address, hasLoadedForLocation, loadAnalysisForProperty, loadPropertyFromAddress]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    const locationKey = location?.propertyId || location?.address || null;
    if (locationKey) {
      setHasLoadedForLocation(null); // Reset to allow reload
      if (location?.propertyId) {
        loadAnalysisForProperty(location.propertyId);
        setHasLoadedForLocation(locationKey);
      } else if (location?.address) {
        loadPropertyFromAddress(location.address);
        setHasLoadedForLocation(locationKey);
      }
    }
  }, [location?.propertyId, location?.address, loadAnalysisForProperty, loadPropertyFromAddress]);

  const handleClose = useCallback(() => {
    setAnalysis(null);
    setError(null);
    onClose();
  }, [onClose]);

  // Memoize computed values
  const hasAnalysisData = useMemo(() => analysis !== null, [analysis]);
  const photographySpotsCount = useMemo(() => analysis?.photographySpots.length || 0, [analysis?.photographySpots.length]);

  if (!location) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: '#1c2128',
          color: '#fff',
          borderRadius: { xs: 0, sm: 2 },
          maxHeight: { xs: '100%', sm: '90vh' },
          maxWidth: { xs: '100%', sm: '95vw', md: '90vw', lg: '85vw', xl: '80vw' },
          m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 4 },
        },
      }}
    >
      <DialogTitle 
        sx={{ 
          color: '#fff', 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
          py: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
            <LocationIcon sx={{ color: '#00d4ff', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.175rem', lg: '1.375rem', xl: '1.5rem' } }}>
                Lokasjonsanalyse
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                {location.name}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={handleClose} 
            sx={{ 
              color: 'rgba(255,255,255,0.87)',
              minWidth: 44,
              minHeight: 44,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
            aria-label="Lukk dialog"
          >
            <CloseIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ 
        pt: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 }, 
        px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
        pb: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 },
        bgcolor: '#1c2128',
        color: '#fff',
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: { xs: 6, sm: 8, md: 7, lg: 9, xl: 12 } }}>
            <CircularProgress sx={{ color: '#00d4ff', mb: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 }, fontSize: { xs: 48, sm: 56, md: 52, lg: 64, xl: 80 } }} size={56} />
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }}>
              Analyserer lokasjon...
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center', maxWidth: { xs: '100%', sm: 400, md: 450, lg: 500, xl: 600 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
              Henter informasjon om fotografispotter, drone-restriksjoner, værforhold og tilgang
            </Typography>
          </Box>
        ) : error ? (
          <Alert 
            severity="error" 
            icon={<CancelIcon />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={handleRefresh}
                startIcon={<RefreshIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                sx={{ 
                  color: '#ef4444', 
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  minHeight: 44,
                }}
              >
                Prøv igjen
              </Button>
            }
            sx={{ 
              bgcolor: 'rgba(239,68,68,0.15)', 
              color: '#ef4444', 
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 2,
              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
              '& .MuiAlert-icon': {
                color: '#ef4444',
                fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
              },
            }}
          >
            <Typography variant="body1" sx={{ color: '#ef4444', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }}>
              Kunne ikke laste analyse
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
              {error}
            </Typography>
          </Alert>
        ) : hasAnalysisData ? (
          <Stack spacing={{ xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }}>
            {/* Photography Spots */}
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: 'rgba(0,212,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CameraIcon sx={{ color: '#00d4ff', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      Fotografispotter
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      {photographySpotsCount} spot{photographySpotsCount !== 1 ? 'ter' : ''} identifisert
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Grid container spacing={{ xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }}>
                  {analysis?.photographySpots.map((spot, idx) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                      <Card sx={{ 
                        bgcolor: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 2,
                        height: '100%',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.08)',
                          borderColor: 'rgba(0,212,255,0.3)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        },
                      }}>
                        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 } }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1rem', md: '0.975rem', lg: '1.05rem', xl: '1.125rem' } }}>
                              Spot {idx + 1}
                            </Typography>
                            <Chip
                              label={spot.accessibility === 'easy' ? 'Enkel' : spot.accessibility === 'moderate' ? 'Moderat' : 'Vanskelig'}
                              size="small"
                              sx={{
                                bgcolor: spot.accessibility === 'easy' ? 'rgba(16,185,129,0.2)' : spot.accessibility === 'moderate' ? 'rgba(255,184,0,0.2)' : 'rgba(239,68,68,0.2)',
                                color: spot.accessibility === 'easy' ? '#10b981' : spot.accessibility === 'moderate' ? '#ffb800' : '#ef4444',
                                fontWeight: 600,
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                border: `1px solid ${spot.accessibility === 'easy' ? 'rgba(16,185,129,0.4)' : spot.accessibility === 'moderate' ? 'rgba(255,184,0,0.4)' : 'rgba(239,68,68,0.4)'}`,
                              }}
                            />
                          </Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, lineHeight: 1.6, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                            {spot.description}
                          </Typography>
                          {spot.restrictions.length > 0 && (
                            <Box sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                                Restriksjoner
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                                {spot.restrictions.map((restriction, rIdx) => (
                                  <Chip
                                    key={rIdx}
                                    label={restriction}
                                    size="small"
                                    sx={{
                                      bgcolor: 'rgba(255,184,0,0.15)',
                                      color: '#ffb800',
                                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                      height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                      border: '1px solid rgba(255,184,0,0.3)',
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          <Box sx={{ 
                            mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                            pt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                          }}>
                            <LocationIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, color: 'rgba(255,255,255,0.87)' }} />
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                              {spot.coordinates.lat.toFixed(6)}, {spot.coordinates.lng.toFixed(6)}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            {/* Drone Restrictions */}
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: analysis?.droneRestrictions.allowed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FlightIcon sx={{ color: analysis?.droneRestrictions.allowed ? '#10b981' : '#ef4444', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      Drone-restriksjoner
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      Luftfart og sikkerhetsregler
                    </Typography>
                  </Box>
                  <Chip
                    icon={analysis?.droneRestrictions.allowed ? <CheckCircleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                    label={analysis?.droneRestrictions.allowed ? 'Tillatt' : 'Ikke tillatt'}
                    sx={{
                      bgcolor: analysis?.droneRestrictions.allowed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                      color: analysis?.droneRestrictions.allowed ? '#10b981' : '#ef4444',
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      height: { xs: 28, sm: 32, md: 30, lg: 34, xl: 40 },
                      border: `1px solid ${analysis?.droneRestrictions.allowed ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      '& .MuiChip-icon': {
                        color: analysis?.droneRestrictions.allowed ? '#10b981' : '#ef4444',
                      },
                    }}
                  />
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Stack spacing={{ xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }}>
                  {analysis?.droneRestrictions.maxAltitude && (
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(0,212,255,0.1)',
                      border: '1px solid rgba(0,212,255,0.2)',
                    }}>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' }, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Maksimal høyde
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#00d4ff', fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.375rem', lg: '1.625rem', xl: '2rem' } }}>
                        {analysis.droneRestrictions.maxAltitude} meter
                      </Typography>
                    </Box>
                  )}
                  {(analysis?.droneRestrictions.restrictions.length ?? 0) > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#fff', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.95rem', md: '0.9125rem', lg: '0.975rem', xl: '1.125rem' } }}>
                        Restriksjoner
                      </Typography>
                      <Stack spacing={{ xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }}>
                        {analysis?.droneRestrictions.restrictions.map((restriction, idx) => (
                          <Box 
                            key={idx}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'flex-start', 
                              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              bgcolor: 'rgba(255,184,0,0.08)',
                              border: '1px solid rgba(255,184,0,0.2)',
                            }}
                          >
                            <CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 }, color: '#ffb800', mt: 0.25, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                              {restriction}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {(analysis?.droneRestrictions.noFlyZones.length ?? 0) > 0 && (
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                      <Typography variant="subtitle2" sx={{ color: '#ef4444', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                        No-fly soner
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                        {analysis?.droneRestrictions.noFlyZones.length} son{analysis?.droneRestrictions.noFlyZones.length !== 1 ? 'er' : ''} identifisert i området
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Weather Exposure */}
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: 'rgba(255,184,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <SunIcon sx={{ color: '#ffb800', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      Vær-eksponering
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      Vind, sol og beskyttelsesmuligheter
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Grid container spacing={{ xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }} sx={{ mb: (analysis?.weatherExposure.shelterOptions?.length || 0) > 0 ? { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } : 0 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      height: '100%',
                    }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                        Vind-eksponering
                      </Typography>
                      <Chip
                        label={analysis?.weatherExposure.windExposure === 'low' ? 'Lav' : analysis?.weatherExposure.windExposure === 'moderate' ? 'Moderat' : 'Høy'}
                        sx={{
                          bgcolor: analysis?.weatherExposure.windExposure === 'low' ? 'rgba(16,185,129,0.2)' : analysis?.weatherExposure.windExposure === 'moderate' ? 'rgba(255,184,0,0.2)' : 'rgba(239,68,68,0.2)',
                          color: analysis?.weatherExposure.windExposure === 'low' ? '#10b981' : analysis?.weatherExposure.windExposure === 'moderate' ? '#ffb800' : '#ef4444',
                          fontWeight: 600,
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                          height: { xs: 28, sm: 32, md: 30, lg: 34, xl: 40 },
                          border: `1px solid ${analysis?.weatherExposure.windExposure === 'low' ? 'rgba(16,185,129,0.4)' : analysis?.weatherExposure.windExposure === 'moderate' ? 'rgba(255,184,0,0.4)' : 'rgba(239,68,68,0.4)'}`,
                          mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        }}
                      />
                      {analysis?.weatherExposure.windSpeedKmh !== undefined && (
                        <Box sx={{ mt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                            Vindhastighet: <strong>{analysis.weatherExposure.windSpeedKmh.toFixed(1)} km/h</strong>
                            {analysis.weatherExposure.windSpeed !== undefined && (
                              <span style={{ color: 'rgba(255,255,255,0.87)' }}> ({analysis.weatherExposure.windSpeed.toFixed(1)} m/s)</span>
                            )}
                          </Typography>
                          {analysis.weatherExposure.windDirection !== undefined && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontStyle: 'italic' }}>
                              Vindretning: {Math.round(analysis.weatherExposure.windDirection)}°
                            </Typography>
                          )}
                        </Box>
                      )}
                      {analysis?.weatherExposure.droneSafety && (
                        <Box sx={{ 
                          mt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, 
                          pt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, 
                          borderTop: '1px solid rgba(255,255,255,0.1)',
                        }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' }, letterSpacing: '0.5px' }}>
                            Drone-sikkerhet
                          </Typography>
                          <Chip
                            label={analysis.weatherExposure.droneSafety}
                            size="small"
                            sx={{
                              bgcolor: analysis.weatherExposure.droneSafety === 'Trygt' ? 'rgba(16,185,129,0.2)' : 
                                       analysis.weatherExposure.droneSafety === 'Vanskelig' ? 'rgba(255,184,0,0.2)' : 
                                       'rgba(239,68,68,0.2)',
                              color: analysis.weatherExposure.droneSafety === 'Trygt' ? '#10b981' : 
                                      analysis.weatherExposure.droneSafety === 'Vanskelig' ? '#ffb800' : 
                                      '#ef4444',
                              fontWeight: 600,
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                              border: `1px solid ${analysis.weatherExposure.droneSafety === 'Trygt' ? 'rgba(16,185,129,0.4)' : 
                                       analysis.weatherExposure.droneSafety === 'Vanskelig' ? 'rgba(255,184,0,0.4)' : 
                                       'rgba(239,68,68,0.4)'}`,
                              mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                            }}
                          />
                          {analysis.weatherExposure.droneSafetyDescription && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontStyle: 'italic' }}>
                              {analysis.weatherExposure.droneSafetyDescription}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      height: '100%',
                    }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                        Sol-eksponering
                      </Typography>
                      <Chip
                        label={analysis?.weatherExposure.sunExposure === 'morning' ? 'Morgen' : analysis?.weatherExposure.sunExposure === 'afternoon' ? 'Ettermiddag' : 'Hele dagen'}
                        sx={{
                          bgcolor: 'rgba(0,212,255,0.2)',
                          color: '#00d4ff',
                          fontWeight: 600,
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                          height: { xs: 28, sm: 32, md: 30, lg: 34, xl: 40 },
                          border: '1px solid rgba(0,212,255,0.4)',
                          mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        }}
                      />
                      {(analysis?.weatherExposure.sunrise || analysis?.weatherExposure.sunset) && (
                        <Box sx={{ mt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                          {analysis.weatherExposure.sunrise && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                              Soloppgang: <strong>{analysis.weatherExposure.sunrise}</strong>
                            </Typography>
                          )}
                          {analysis.weatherExposure.sunset && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              Solnedgang: <strong>{analysis.weatherExposure.sunset}</strong>
                            </Typography>
                          )}
                          {analysis.weatherExposure.daylightHours !== undefined && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontStyle: 'italic' }}>
                              {analysis.weatherExposure.daylightHours.toFixed(1)} timer dagslys
                            </Typography>
                          )}
                        </Box>
                      )}
                      {analysis?.weatherExposure.sunDescription && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontStyle: 'italic' }}>
                          {analysis.weatherExposure.sunDescription}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
                {(analysis?.weatherExposure.shelterOptions?.length || 0) > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#fff', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.95rem', md: '0.9125rem', lg: '0.975rem', xl: '1.125rem' } }}>
                      Beskyttelsesmuligheter
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                      {analysis?.weatherExposure.shelterOptions.map((option, idx) => (
                        <Chip
                          key={idx}
                          label={option}
                          size="small"
                          icon={<InfoIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                          sx={{
                            bgcolor: 'rgba(16,185,129,0.15)',
                            color: '#10b981',
                            fontWeight: 500,
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                            height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                            border: '1px solid rgba(16,185,129,0.3)',
                            '& .MuiChip-icon': {
                              color: '#10b981',
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Access Analysis */}
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: 'rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <AccessibleIcon sx={{ color: '#10b981', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      Tilgangsanalyse
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      Parkering, tilgjengelighet og transport
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Grid container spacing={{ xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }}>
                  {analysis?.accessAnalysis.parkingSpots && analysis.accessAnalysis.parkingSpots.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ 
                        p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                          <Box sx={{ 
                            width: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            height: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(16,185,129,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <ParkingIcon sx={{ color: '#10b981', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                              Parkeringssteder
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                              {analysis.accessAnalysis.parkingSpots.length} parkeringssted{analysis.accessAnalysis.parkingSpots.length !== 1 ? 'er' : ''} i nærheten
                            </Typography>
                          </Box>
                        </Box>
                        <List sx={{ ml: { xs: 0, sm: 7, md: 6.5, lg: 7, xl: 8 }, p: 0 }}>
                          {analysis.accessAnalysis.parkingSpots.map((spot, idx) => (
                            <SpotListItem
                              key={idx}
                              spot={spot}
                              variant="default"
                              spaceLabel={spot.spaces ? `${spot.spaces} plasser` : undefined}
                              index={idx}
                            />
                          ))}
                        </List>
                      </Box>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ 
                      p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                    }}>
                      <Box sx={{ 
                        width: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                        height: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                        borderRadius: '50%', 
                        bgcolor: analysis?.accessAnalysis.accessibility === 'wheelchair-accessible' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <AccessibleIcon sx={{ color: analysis?.accessAnalysis.accessibility === 'wheelchair-accessible' ? '#10b981' : '#ef4444', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                          Tilgjengelighet
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                          {analysis?.accessAnalysis.accessibility === 'wheelchair-accessible' ? 'Rullestol-tilgjengelig' :
                            analysis?.accessAnalysis.accessibility === 'limited' ? 'Begrenset' : 'Ikke tilgjengelig'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  {(analysis?.accessAnalysis.publicTransport?.length || 0) > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ 
                        p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                          <Box sx={{ 
                            width: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            height: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(0,212,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <BusIcon sx={{ color: '#00d4ff', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                              Kollektivtransport
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                              {analysis?.accessAnalysis.publicTransport.length} linj{analysis?.accessAnalysis.publicTransport.length !== 1 ? 'er' : 'e'} tilgjengelig
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, ml: { xs: 0, sm: 7, md: 6.5, lg: 7, xl: 8 } }}>
                          {analysis?.accessAnalysis.publicTransport.map((transport, idx) => (
                            <Chip
                              key={idx}
                              label={transport}
                              size="small"
                              icon={<BusIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                              sx={{
                                bgcolor: 'rgba(0,212,255,0.2)',
                                color: '#00d4ff',
                                fontWeight: 500,
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                border: '1px solid rgba(0,212,255,0.3)',
                                '& .MuiChip-icon': {
                                  color: '#00d4ff',
                                },
                              }}
                            />
                          ))}
                        </Box>
                        {(analysis?.accessAnalysis.walkingDistance || 0) > 0 && (
                          <Box sx={{ mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, ml: { xs: 0, sm: 7, md: 6.5, lg: 7, xl: 8 } }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                              Gangeavstand til nærmeste stopp: <strong>{analysis?.accessAnalysis.walkingDistance} meter</strong>
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  )}
                  {(analysis?.accessAnalysis.evParking || analysis?.accessAnalysis.evCharging) && (
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ 
                        p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.2)',
                      }}>
                        <Typography variant="subtitle2" sx={{ color: '#10b981', fontWeight: 600, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                          <Box sx={{ 
                            width: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 }, 
                            height: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 }, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(16,185,129,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Box sx={{ 
                              width: { xs: 16, sm: 18, md: 17, lg: 20, xl: 24 }, 
                              height: { xs: 16, sm: 18, md: 17, lg: 20, xl: 24 }, 
                              borderRadius: '50%', 
                              bgcolor: '#10b981',
                              border: '2px solid #10b981',
                            }} />
                          </Box>
                          Elbilparkering & Lading
                        </Typography>
                        <Stack spacing={{ xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }}>
                          {analysis?.accessAnalysis.evParking && (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, flexWrap: 'wrap' }}>
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                                  Elbilparkering
                                </Typography>
                                <Chip
                                  label={`${analysis?.accessAnalysis.evParking?.distance} m unna`}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(16,185,129,0.2)',
                                    color: '#10b981',
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                    height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                                    border: '1px solid rgba(16,185,129,0.3)',
                                  }}
                                />
                              </Box>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, mb: (analysis?.accessAnalysis.evParkingSpots?.length || 0) > 0 ? { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } : 0 }}>
                                {analysis?.accessAnalysis.evParking?.description}
                              </Typography>
                              {(analysis?.accessAnalysis.evParkingSpots?.length || 0) > 0 && (
                                <List sx={{ p: 0, mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                                  {analysis?.accessAnalysis.evParkingSpots?.map((spot, idx) => (
                                    <SpotListItem
                                      key={idx}
                                      spot={spot}
                                      variant="ev"
                                      spaceLabel={spot.spaces ? `${spot.spaces} elbilplasser` : undefined}
                                      index={idx}
                                    />
                                  ))}
                                </List>
                              )}
                            </Box>
                          )}
                          {analysis?.accessAnalysis.evCharging && (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, flexWrap: 'wrap' }}>
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                                  Ladestasjon
                                </Typography>
                                <Chip
                                  label={`${analysis?.accessAnalysis.evCharging?.distance} m unna`}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(16,185,129,0.2)',
                                    color: '#10b981',
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                    height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                                    border: '1px solid rgba(16,185,129,0.3)',
                                  }}
                                />
                              </Box>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, mb: (analysis?.accessAnalysis.evChargingSpots?.length || 0) > 0 ? { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } : 0 }}>
                                {analysis?.accessAnalysis.evCharging?.description}
                              </Typography>
                              {(analysis?.accessAnalysis.evChargingSpots?.length || 0) > 0 && (
                                <List sx={{ p: 0, mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                                  {analysis?.accessAnalysis.evChargingSpots?.map((spot, idx) => (
                                    <SpotListItem
                                      key={idx}
                                      spot={spot}
                                      variant="ev"
                                      spaceLabel={spot.spaces ? `${spot.spaces} ladeplass${spot.spaces !== 1 ? 'er' : ''}` : undefined}
                                      index={idx}
                                    />
                                  ))}
                                </List>
                              )}
                            </Box>
                          )}
                        </Stack>
                      </Box>
                    </Grid>
                  )}
                  {(analysis?.accessAnalysis.walkingDistance || 0) > 0 && (analysis?.accessAnalysis.publicTransport?.length || 0) === 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ 
                        p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                          Gangeavstand til nærmeste stopp: <strong>{analysis?.accessAnalysis.walkingDistance} meter</strong>
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center', py: { xs: 6, sm: 8, md: 7, lg: 9, xl: 12 } }}>
            <Box sx={{ 
              width: { xs: 80, sm: 90, md: 85, lg: 100, xl: 120 }, 
              height: { xs: 80, sm: 90, md: 85, lg: 100, xl: 120 }, 
              borderRadius: '50%', 
              bgcolor: 'rgba(0,212,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 },
            }}>
              <LocationIcon sx={{ color: '#00d4ff', fontSize: { xs: '2.5rem', sm: '3rem', md: '2.75rem', lg: '3.5rem', xl: '4rem' } }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.375rem', lg: '1.625rem', xl: '2rem' } }}>
              Ingen analyse tilgjengelig
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 }, maxWidth: { xs: '100%', sm: 400, md: 450, lg: 500, xl: 600 }, mx: 'auto', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
              Start en analyse for å få informasjon om fotografispotter, drone-restriksjoner, værforhold og tilgang for denne lokasjonen.
            </Typography>
            <Button
              variant="contained"
              onClick={handleRefresh}
              sx={{
                bgcolor: '#00d4ff',
                color: '#000',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 4, sm: 4.5, md: 4.25, lg: 5, xl: 6 },
                py: { xs: 1.5, sm: 1.75, md: 1.625, lg: 2, xl: 2.5 },
                borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                minHeight: 44,
                '&:hover': { bgcolor: '#00b8e6' },
              }}
            >
              Start analyse
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ 
        borderTop: '1px solid rgba(255,255,255,0.1)', 
        p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
        px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
        gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
        bgcolor: '#1c2128',
      }}>
        <Button 
          onClick={handleClose} 
          variant="outlined"
          sx={{ 
            color: 'rgba(255,255,255,0.87)',
            borderColor: 'rgba(255,255,255,0.2)',
            fontWeight: 600,
            fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
            px: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 },
            py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
            minHeight: 44,
            '&:hover': { 
              bgcolor: 'rgba(255,255,255,0.1)',
              borderColor: 'rgba(255,255,255,0.3)',
            },
          }}
        >
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
}
