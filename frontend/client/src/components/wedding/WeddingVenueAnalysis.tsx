/**
 * CreatorHub Norge - Wedding Venue Analysis
 * Specialized analysis for wedding venues with photography and planning features
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Paper,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Favorite,
  PhotoCamera,
  Accessible,
  DirectionsCar,
  Public,
  Terrain,
  Warning,
  Info,
  Close,
  Map,
  Schedule,
  Group,
  Restaurant,
  MusicNote,
  LocalFlorist,
} from '@mui/icons-material';
import { useExternalData } from '../../services/ExternalDataService';
import { useGoogleMaps } from '../../services/GoogleMapsService';
import PropertyAnalysisModal from '../property/PropertyAnalysisModal';

interface WeddingVenueAnalysisProps {
  venueAddress: string;
  weddingDate?: string;
  guestCount?: number;
  onAnalysisComplete?: (analysis: any) => void;
}

interface WeddingPlanningData {
  ceremonySpots: Array<{
    location: string;
    capacity: number;
    weatherProtection: boolean;
    accessibility: string;
    photographyScore: number;
}>;
  receptionAreas: Array<{
    location: string;
    capacity: number;
    indoor: boolean;
    cateringAccess: boolean;
}>;
  photographyLocations: Array<{
    spot: string;
    timeOfDay: string;
    weatherDependency: string;
    guestAccess: boolean;
}>;
  guestServices: {
    parking: {
      available: boolean;
      capacity: number;
      distance: number;
  };
    transport: {
      publicTransport: string[];
      taxiAccess: boolean;
      shuttleService: boolean;
  };
    accessibility: {
      wheelchairAccess: boolean;
      elderlyFriendly: boolean;
      childrenFriendly: boolean;
  };
};
  weatherConsiderations: {
    backupPlan: boolean;
    indoorOptions: string[];
    weatherDependency: string;
};
}

export default function WeddingVenueAnalysis({
  venueAddress,
  weddingDate,
  guestCount = 100,
  onAnalysisComplete
}: WeddingVenueAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [weddingPlanning, setWeddingPlanning] = useState<WeddingPlanningData | null>(null);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  const { 
    getKartverketAddress, 
    getKartverketProperty, 
    analyzeProperty,
    getCurrentWeather,
    getWeatherForecast
} = useExternalData();

  const { createWeddingVenueMap } = useGoogleMaps();

  useEffect(() => {
    if (venueAddress) {
      analyzeWeddingVenue();
  }
}, [venueAddress, weddingDate, guestCount]);

  const analyzeWeddingVenue = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get venue address and property data
      const addressData = await getKartverketAddress(venueAddress);
      const propertyData = await getKartverketProperty(addressData.propertyId!);
      const propertyAnalysis = await analyzeProperty(addressData.propertyId!);

      setVenue(propertyData);
      setAnalysis(propertyAnalysis);

      // Generate wedding-specific planning data
      const weddingData = generateWeddingPlanningData(propertyData, propertyAnalysis);
      setWeddingPlanning(weddingData);

      // Get weather data if wedding date is provided
      if (weddingDate) {
        const weatherData = await getCurrentWeather({ location: venueAddress });
        const forecastData = await getWeatherForecast({ location: venueAddress });
        
        // Update wedding planning with weather considerations
        weddingData.weatherConsiderations = {
          ...weddingData.weatherConsiderations,
          currentWeather: weatherData,
          forecast: forecastData
      };
    }

      onAnalysisComplete?.({
        venue: propertyData,
        analysis: propertyAnalysis,
        weddingPlanning: weddingData
    });

  } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze wedding venue');
  } finally {
      setLoading(false);
  }
};

  const generateWeddingPlanningData = (venue: any, analysis: any): WeddingPlanningData => {
    return {
      ceremonySpots: [
        {
          location: 'Main Ceremony Area',
          capacity: Math.min(guestCount, Math.floor(venue.area / 2)),
          weatherProtection: analysis.weatherExposure.windExposure === 'low',
          accessibility: analysis.accessAnalysis.accessibility,
          photographyScore: 8
      },
        {
          location: 'Garden Ceremony',
          capacity: Math.min(guestCount, Math.floor(venue.area / 3)),
          weatherProtection: false,
          accessibility: 'limited',
          photographyScore: 9
      }
      ],
      receptionAreas: [
        {
          location: 'Main Reception Hall',
          capacity: Math.min(guestCount, Math.floor(venue.area / 1.5)),
          indoor: true,
          cateringAccess: true
      },
        {
          location: 'Outdoor Terrace',
          capacity: Math.min(guestCount, Math.floor(venue.area / 2)),
          indoor: false,
          cateringAccess: true
      }
      ],
      photographyLocations: analysis.photographySpots.map((spot: any, index: number) => ({
        spot: spot.description,
        timeOfDay: analysis.weatherExposure.sunExposure,
        weatherDependency: analysis.weatherExposure.windExposure,
        guestAccess: spot.accessibility === 'easy'
    })),
      guestServices: {
        parking: {
          available: analysis.accessAnalysis.parkingAvailable,
          capacity: analysis.accessAnalysis.parkingAvailable ? guestCount : 0,
          distance: analysis.accessAnalysis.walkingDistance
      },
        transport: {
          publicTransport: analysis.accessAnalysis.publicTransport,
          taxiAccess: true,
          shuttleService: analysis.accessAnalysis.publicTransport.length > 0
      },
        accessibility: {
          wheelchairAccess: analysis.accessAnalysis.accessibility === 'wheelchair-accessible',
          elderlyFriendly: analysis.accessAnalysis.walkingDistance < 200,
          childrenFriendly: analysis.accessAnalysis.accessibility !== 'not-accessible'
      }
    },
      weatherConsiderations: {
        backupPlan: venue.buildingInfo?.totalArea > 100,
        indoorOptions: venue.buildingInfo ? ['Main Hall','Reception Area'] : [],
        weatherDependency: analysis.weatherExposure.windExposure
    }
  };
};

  const getCapacityColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio > 0.9) return 'error';
    if (ratio > 0.7) return 'warning';
    return 'success';
};

  const getAccessibilityIcon = (accessibility: string) => {
    switch (accessibility) {
      case 'wheelchair-accessible': return <Accessible color="success" />;
      case 'limited': return <Warning color="warning" />;
      case 'not-accessible': return <Warning color="error" />;
      default: return <Info color="info" />;
  }
};

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Analyzing wedding venue...</Typography>
      </Box>
    );
}

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
}

  if (!venue || !analysis || !weddingPlanning) {
    return null;
}

  return (
    <Box sx={{ p: 2 }}>
      {/* Venue Header */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" gutterBottom>
              💒 {venue.address}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                icon={<Group />} 
                label={`Capacity: ${guestCount} guests`} 
                color={getCapacityColor(guestCount, Math.floor(venue.area / 1.5))}
              />
              <Chip 
                icon={<Terrain />} 
                label={`${venue.area} m²`} 
                size="small" 
              />
              <Chip 
                icon={<LocationOn />} 
                label={venue.municipality} 
                size="small" 
              />
              {weddingDate && (
                <Chip 
                  icon={<Schedule />} 
                  label={new Date(weddingDate).toLocaleDateString()} 
                  size="small" 
                  color="primary"
                />
              )}
            </Box>
          </Box>
          <Button 
            variant="outlined" 
            startIcon={<Map />}
            onClick={() => setShowDetailedAnalysis(true)}
          >
            Detailed Analysis
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Ceremony Planning */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💒 Ceremony Planning
              </Typography>
              <List>
                {weddingPlanning.ceremonySpots.map((spot, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Favorite color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={spot.location}
                      secondary={
                        <Box>
                          <Chip 
                            label={`${spot.capacity} guests`} 
                            size="small" 
                            color={getCapacityColor(guestCount, spot.capacity)}
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={spot.weatherProtection ? 'Weather Protected' : 'Outdoor'} 
                            size="small" 
                            color={spot.weatherProtection ? 'success' : 'warning'}
                            sx={{ mr: 1 }}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            {getAccessibilityIcon(spot.accessibility)}
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              {spot.accessibility}
                            </Typography>
                          </Box>
                        </Box>
                    }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Reception Areas */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🍽️ Reception Areas
              </Typography>
              <List>
                {weddingPlanning.receptionAreas.map((area, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Restaurant color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={area.location}
                      secondary={
                        <Box>
                          <Chip 
                            label={`${area.capacity} guests`} 
                            size="small" 
                            color={getCapacityColor(guestCount, area.capacity)}
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={area.indoor ? 'Indoor' : 'Outdoor'} 
                            size="small" 
                            color={area.indoor ? 'success' : 'warning'}
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={area.cateringAccess ? 'Catering Access' : 'Limited Access'} 
                            size="small" 
                            color={area.cateringAccess ? 'success' : 'warning'}
                          />
                        </Box>
                    }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Photography Locations */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📸 Photography Locations
              </Typography>
              <List>
                {weddingPlanning.photographyLocations.map((location, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <PhotoCamera color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={location.spot}
                      secondary={
                        <Box>
                          <Chip 
                            label={`Best: ${location.timeOfDay}`} 
                            size="small" 
                            color="info"
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={location.guestAccess ? 'Guest Access' : 'Limited Access'} 
                            size="small" 
                            color={location.guestAccess ? 'success' : 'warning'}
                          />
                        </Box>
                    }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Guest Services */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🚗 Guest Services
              </Typography>
              
              {/* Parking */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <DirectionsCar sx={{ mr: 1 }} />
                  <Typography variant="subtitle2">Parking</Typography>
                </Box>
                <Chip 
                  label={weddingPlanning.guestServices.parking.available ? 'Available' : 'Not Available'} 
                  color={weddingPlanning.guestServices.parking.available ? 'success' : 'error'}
                  size="small"
                />
                {weddingPlanning.guestServices.parking.available && (
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    {weddingPlanning.guestServices.parking.distance}m walk
                  </Typography>
                )}
              </Box>

              {/* Transport */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Public sx={{ mr: 1 }} />
                  <Typography variant="subtitle2">Public Transport</Typography>
                </Box>
                {weddingPlanning.guestServices.transport.publicTransport.length > 0 ? (
                  <Box>
                    {weddingPlanning.guestServices.transport.publicTransport.map((transport, index) => (
                      <Chip 
                        key={index}
                        label={transport} 
                        size="small" 
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No public transport available
                  </Typography>
                )}
              </Box>

              {/* Accessibility */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Accessibility
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    label="Wheelchair Access" 
                    size="small" 
                    color={weddingPlanning.guestServices.accessibility.wheelchairAccess ? 'success' : 'error'}
                  />
                  <Chip 
                    label="Elderly Friendly" 
                    size="small" 
                    color={weddingPlanning.guestServices.accessibility.elderlyFriendly ? 'success' : 'warning'}
                  />
                  <Chip 
                    label="Children Friendly" 
                    size="small" 
                    color={weddingPlanning.guestServices.accessibility.childrenFriendly ? 'success' : 'warning'}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Weather Considerations */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🌤️ Weather Considerations
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Warning sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Backup Plan</Typography>
                  </Box>
                  <Chip 
                    label={weddingPlanning.weatherConsiderations.backupPlan ? 'Available' : 'Limited'} 
                    color={weddingPlanning.weatherConsiderations.backupPlan ? 'success' : 'warning'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Info sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Indoor Options</Typography>
                  </Box>
                  {weddingPlanning.weatherConsiderations.indoorOptions.length > 0 ? (
                    <Box>
                      {weddingPlanning.weatherConsiderations.indoorOptions.map((option, index) => (
                        <Chip 
                          key={index}
                          label={option} 
                          size="small" 
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      No indoor options available
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Terrain sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Weather Dependency</Typography>
                  </Box>
                  <Chip 
                    label={weddingPlanning.weatherConsiderations.weatherDependency} 
                    color={weddingPlanning.weatherConsiderations.weatherDependency === 'low' ? 'success' : 'warning'}
                    size="small"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Analysis Modal */}
      <PropertyAnalysisModal
        open={showDetailedAnalysis}
        onClose={() => setShowDetailedAnalysis(false)}
        propertyId={venue.propertyId}
        title="Wedding Venue Detailed Analysis"
      />
    </Box>
  );
}






