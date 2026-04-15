// @ts-nocheck
/**
 * CreatorHub Norge - Pricing Dashboard Widget
 * Shows pricing overview across all dashboard types
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  LocalOffer as PriceIcon,
  TrendingUp as TrendingUpIcon,
  Inventory as PackageIcon,
  AttachMoney as MoneyIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Add as AddIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';

interface PricingDashboardWidgetProps {
  userId: string;
  profession: string;
  variant?: 'overview' | 'detailed' | 'compact';
  onManagePricing?: () => void
}

export default function PricingDashboardWidget({
  userId,
  profession,
  variant = 'overview',
  onManagePricing
}: PricingDashboardWidgetProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor, isLoading: professionsLoading } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  // Fetch pricing overview data
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/pricing/services', userId],
    queryFn: () => apiRequest(`/api/pricing/services/${userId}`)
});

  const { data: packages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ['/api/pricing/packages', userId],
    queryFn: () => apiRequest(`/api/pricing/packages/${userId}`)
});

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/pricing/categories', userId],
    queryFn: () => apiRequest(`/api/pricing/categories/${userId}`)
});

  const isLoading = servicesLoading || packagesLoading || categoriesLoading;

  // Calculate statistics
  const stats = {
    totalServices: services.length,
    visibleServices: services.filter((s: any) => s.is_visible).length,
    totalPackages: packages.length,
    visiblePackages: packages.filter((p: any) => p.is_visible).length,
    averageServicePrice: services.length > 0 
      ? services.reduce((sum: number, s: any) => sum + parseFloat(s.base_price), 0) / services.length 
      : 0,
    totalPackageValue: packages.reduce((sum: number, p: any) => sum + parseFloat(p.total_price), 0),
    activeCategories: categories.filter((c: any) => c.is_active).length
};

  // Get profession-specific insights using dynamic configuration
  const getProfessionInsights = () => {
    // Use profession config or fall back to hardcoded logic for backward compatibility
    if (professionConfig?.features?.pricing) {
      return {
        popularServices: services.slice(0, 3),
        recommendations: [
          `Legg til pakkepriser for ${professionConfig.displayName.toLowerCase()}`,
          'Tilby rabatter til stamkunder',
          `Opprett spesialpriser for ${professionConfig.primaryServices?.[0] || 'tjenester'}`
        ]
    };
  }

    // Dynamic fallback logic with profession-aware recommendations
    const { getProfessionDisplayName, getAllProfessionTypes } = useDynamicProfessions();
    const displayName = getProfessionDisplayName(profession);

    const professionInsightsMap: Record<string, any> = {
      photographer: {
        keywords: ['bryllup','portrett','familie'],
        recommendations: [
          'Legg til pakkepriser for bryllup','Tilby rabatt for familiebilder','Opprett sesongpriser for utendørsfotografering'
        ]
    },
      videographer: {
        keywords: ['bryllup','bedrift','drone'],
        recommendations: [
          'Tilby pakkepriser for event-video','Legg til drone-tillegg','Opprett redigeringstjenester'
        ]
    },
      music_producer: {
        keywords: ['mixing','mastering','opptak'],
        recommendations: [
          'Tilby pakkepriser for EP/album','Legg til instrumentopptak','Opprett rush-tjenester'
        ]
      },
      vendor: {
        keywords: ['produkt','utstyr','levering'],
        recommendations: [
          'Organiser produkter i kategorier','Tilby bulkrabatter','Opprett hurtiglevering'
        ]
      }
    };

    const insights = professionInsightsMap[profession] || {
      keywords: [],
      recommendations: [
        'Organiser tjenestene i kategorier','Legg til pakkepriser', 'Tilby kunderabatter'
      ]
    };

    return {
      popularServices: insights.keywords.length > 0
        ? services.filter((s: any) =>
            insights.keywords.some((keyword: string) =>
              s.service_name.toLowerCase().includes(keyword)
            )
          ).slice(0, 3)
        : services.slice(0, 3),
      recommendations: insights.recommendations
    };
  };

  const insights = getProfessionInsights();

  if (isLoading) {
    return (
      <Card sx={{ ...theming.getThemedCardSx(), p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt:  2 }}>Laster prisdata...</Typography>
      </Card>
    );
}

  if (variant === 'compact') {
    return (
      <Card sx={{
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(25, 107, 53, 0.2)',
        ...theming.getThemedCardSx()
      }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              {professionIcon && (
                <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                  {professionIcon}
                </Box>
              )}
              <PriceIcon />
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Priser`
                : 'Priser'}
            </Typography>
            <IconButton size="small" onClick={onManagePricing}>
              <EditIcon />
            </IconButton>
          </Box>
          
          <Grid container spacing={2} sx={{ mb:  2 }}>
            <Grid size={{ xs:  6 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {stats.visibleServices}
                </Typography>
                <Typography variant="caption">Synlige tjenester</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs:  6 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {stats.visiblePackages}
                </Typography>
                <Typography variant="caption">Aktive pakker</Typography>
              </Box>
            </Grid>
          </Grid>
          
          {stats.averageServicePrice > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center'}}>
              Gjennomsnittspris: {Math.round(stats.averageServicePrice).toLocaleString('')} NOK
            </Typography>
          )}
        </CardContent>
      </Card>
    );
}

  return (
    <Box>
      {/* Statistics Overview */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            color: 'white',
            ...theming.getThemedCardSx()
          }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <PriceIcon sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats.totalServices}</Typography>
              <Typography variant="body2">Tjenester totalt</Typography>
              <Typography variant="caption">
                {stats.visibleServices} synlige
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            background: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
            color: 'white',
            ...theming.getThemedCardSx()
          }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <PackageIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats.totalPackages}</Typography>
              <Typography variant="body2">Pakker totalt</Typography>
              <Typography variant="caption">
                {stats.visiblePackages} synlige
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
            color: 'white',
            ...theming.getThemedCardSx()
          }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <MoneyIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {Math.round(stats.averageServicePrice).toLocaleString('no-NO')}
              </Typography>
              <Typography variant="body2">Gjennomsnittspris</Typography>
              <Typography variant="caption">NOK per tjeneste</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{
            background: 'linear-gradient(135deg, #9c27b0 0%, #e91e63 100%)',
            color: 'white',
            ...theming.getThemedCardSx()
          }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <TrendingUpIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {Math.round(stats.totalPackageValue).toLocaleString('no-NO')}
              </Typography>
              <Typography variant="body2">Total pakkeverdi</Typography>
              <Typography variant="caption">NOK</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Popular Services */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(25, 107, 53, 0.2)',
            height: '100%',
            ...theming.getThemedCardSx()
          }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <PriceIcon />
                Populære tjenester
              </Typography>
              
              {insights.popularServices.length > 0 ? (
                <List>
                  {insights.popularServices.map((service: any, index: number) => (
                    <React.Fragment key={service.d}>
                      <ListItem sx={{ px:  0 }}>
                        <ListItemIcon>
                          <Chip
                            label={`#${index + 1}`}
                            size="small"
                            sx={{ 
                              bgcolor: '#ff6b30',
                              color: 'white',
                              minWidth: '24px'
                        }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={service.service_name}
                          secondary={`${service.base_price} NOK ${service.unit ? `per ${service.unit}` : ', '}`}
                        />
                        <Box sx={{ display: 'flex', gap:  1 }}>
                          <Tooltip title={service.is_visible ? 'Synlig' : 'Skjult'}>
                            <IconButton size="small">
                              {service.is_visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItem>
                      {index < insights.popularServices.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  Ingen tjenester opprettet ennå. Legg til dine første tjenester for å komme i gang.
                </Alert>
              )}
              
              <Box sx={{ mt: 2, display: 'flex', gap:  1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onManagePricing}
                  sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
                >
                  Administrer tjenester
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Pricing Recommendations */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(25, 107, 53, 0.2)',
            height: '100%',
            ...theming.getThemedCardSx()
          }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <TrendingUpIcon />
                Anbefalinger
              </Typography>

              <List>
                {insights.recommendations.map((recommendation: string, index: number) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#ff6b35'
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText primary={recommendation} />
                    </ListItem>
                    {index < insights.recommendations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={onManagePricing}
                  sx={{
                    background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'
                  }}
                >
                  Forbedre priser
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{
        mt: 3,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(25, 107, 53, 0.2)',
        ...theming.getThemedCardSx()
      }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
            Hurtighandlinger
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={onManagePricing}
                sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
              >
                Ny tjeneste
              </Button>
            </Grid>
            <Grid size={{ xs: 12 }} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PackageIcon />}
                onClick={onManagePricing}
                sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
              >
                Ny pakke
              </Button>
            </Grid>
            <Grid size={{ xs: 12 }} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CalculateIcon />}
                sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
              >
                Priskalulator
              </Button>
            </Grid>
            <Grid size={{ xs: 12 }} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={onManagePricing}
                sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
              >
                Innstillinger
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
