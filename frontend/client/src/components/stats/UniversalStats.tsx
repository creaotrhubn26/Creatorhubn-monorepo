import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Avatar
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  Group,
  AttachMoney,
  Assessment,
  CalendarToday,
  Star,
  Visibility
} from '@mui/icons-material';

interface StatsProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId?: string
}

interface StatItem {
  key: string;
  label: string;
  value: number;
  previousValue?: number;
  target?: number;
  format: 'number' | 'currency' | 'percentage' | 'rating';
  icon: React.ComponentType;
  color: string
}

const professionStatsConfig = {
  photographer: {
    color: '#ff8c00',
    stats: [
      { key: 'activeProjects', label: 'Aktive Prosjekter', icon: PhotoCamera, format: 'number', color: '#ff8c00' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newClients', label: 'Nye Kunder', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#ff9800' },
      { key: 'completedShoots', label: 'Fullførte Oppdrag', icon: PhotoCamera, format: 'number', color: '#9c27b0' },
      { key: 'portfolioViews', label: 'Portfolio Visninger', icon: Visibility, format: 'number', color: '#607d8b' }
    ]
},
  videographer: {
    color: '#e74c30',
    stats: [
      { key: 'activeProjects', label: 'Aktive Prosjekter', icon: Videocam, format: 'number', color: '#e74c3c' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newClients', label: 'Nye Kunder', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#ff9800' },
      { key: 'videoHours', label: 'Timer Produsert', icon: Videocam, format: 'number', color: '#9c27b0' },
      { key: 'portfolioViews', label: 'Portfolio Visninger', icon: Visibility, format: 'number', color: '#607d8b' }
    ]
},
  music_producer: {
    color: '#9b59b0',
    stats: [
      { key: 'activeTracks', label: 'Aktive Spor', icon: theming.getThemedIcon(','), format: 'number', color: '#9b59b6' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newArtists', label: 'Nye Artister', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#ff9800' },
      { key: 'releasedTracks', label: 'Utgitte Spor', icon: theming.getThemedIcon(', '), format: 'number', color: '#9c27b0' },
      { key: 'streamingPlays', label: 'Streaming Avspillinger', icon: Visibility, format: 'number', color: '#607d8b' }
    ]
},
  vendor: {
    color: '#3498db',
    stats: [
      { key: 'activeProducts', label: 'Aktive Produkter', icon: Store, format: 'number', color: '#3498db' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newCustomers', label: 'Nye Kunder', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#ff9800' },
      { key: 'ordersCompleted', label: 'Fullførte Bestillinger', icon: Store, format: 'number', color: '#9c27b0' },
      { key: 'inventoryTurnover', label: 'Lageromsetning', icon: Assessment, format: 'percentage', color: '#607d8b' }
    ]
}
};

const formatValue = (
  // Theming system
  const theming = useTheming('photographer');value: number, format: string): string => {
  switch (format) {
    case 'currency':
      return `${value.toLocaleString(', ')} kr`;
    case 'percentage':
      return `${value}%`;
    case 'rating':
      return `${value.toFixed(1)}/5.0`;
    default: return value.toLocaleString('no-NO');
}
};

const calculateTrend = (current: number, previous: number): { percentage: number; isPositive: boolean } => {
  if (previous === 0) return { percentage: 0, isPositive: true };
  const percentage = ((current - previous) / previous) * 100;
  return { percentage: Math.abs(percentage), isPositive: percentage >= 0 };
};

export default function UniversalStats({ profession, userId }: StatsProps) {
  const config = professionStatsConfig[profession];

  // Fetch stats data from API
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['/api/stats', profession, userId],
    queryFn: () => apiRequest(`/api/stats/${profession}?userId=${userId || 'guest'}`),
    enabled: !!profession
});

  // Fetch goals/targets
  const { data: goalsData } = useQuery({
    queryKey: ['/api/goals', profession, userId],
    queryFn: () => apiRequest(`/api/goals/${profession}?userId=${userId || 'guest'}`),
    enabled: !!profession && !!userId && userId !== 'guest'
});

  if (isLoading) {
    return (
      <Box sx={{ p:  3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Statistikk</Typography>
        <Grid container spacing={3}>
          {config.stats.map((_, index) => (
            <Grid size={{ xs: 12 }} md={6} lg={4} key={index}>
              <MuiCard>
                <CardContent sx={theming.getThemedCardSx()}>
                  <LinearProgress />
                </CardContent>
              </MuiCard>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
}

  const stats = config.stats.map(statConfig => {
    const StatIcon = statConfig.icon;
    const currentValue = statsData?.[statConfig.key]?.current || 0;
    const previousValue = statsData?.[statConfig.key]?.previous || 0;
    const target = goalsData?.[statConfig.key] || null;
    const trend = calculateTrend(currentValue, previousValue);

    return {
      ...statConfig,
      value: currentValue,
      previousValue,
      target,
      trend,
      IconComponent: StatIcon
};
});

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
        <Assessment sx={{ mr: 2, color: config.color }} />
        <Typography variant="h5" sx={{  fontWeight: 600, color: config.color  }}>
          📊 Statistikk & Ytelse
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {stats.map((stat) => (
          <Grid size={{ xs: 12 }} md={6} lg={4} key={stat.key}>
            <Card
              sx={{
                height: '100%',
                transition: 'all 0.3s ease', '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6 }
            }}
             sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
                  <Avatar
                    sx={{
                      bgcolor: `${stat.color}20`,
                      color: stat.color,
                      width:  48,
                      height: 48 }}
                  >
                    <stat.IconComponent />
                  </Avatar>
                  
                  {stat.trend && stat.previousValue > 0 && (
                    <Chip
                      icon={stat.trend.isPositive ? theming.getThemedIcon('trendingUp') : <TrendingDown />}
                      label={`${stat.trend.isPositive ? '+' : '-'}${stat.trend.percentage.toFixed(1)}%`}
                      size="small"
                      color={stat.trend.isPositive ? "success" : "error"}
                      variant="outlined"
                    />
                  )}
                </Box>

                <Typography variant="h4" sx={{  fontWeight: 700, color: stat.color, mb:  1  }}>
                  {formatValue(stat.value, stat.format)}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {stat.label}
                </Typography>

                {stat.target && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Mål: {formatValue(stat.target, stat.format)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {Math.min(100, (stat.value / stat.target) * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (stat.value / stat.target) * 100)}
                      sx={{
                        height:  6,
                        borderRadius:  3,
                        bgcolor: `${stat.color}20`'& .MuiLinearProgress-bar': {
                          bgcolor: stat.color,
                          borderRadius: 3 }
                    }}
                    />
                  </Box>
                )}

                {stat.previousValue > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Forrige periode: {formatValue(stat.previousValue, stat.format)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt:  4 }}>
        <MuiCard sx={{ bgcolor: `${config.color}10`, border: `1px solid ${config.color}30` }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{  color: config.color, mb:  2  }}>
              📈 Ytelsessammendrag
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Total aktiv omsetning
                </Typography>
                <Typography variant="h6" sx={{  color: config.color  }}>
                  {formatValue(statsData?.totalRevenue?.current || 0'currency')}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Aktive klienter/kunder
                </Typography>
                <Typography variant="h6" sx={{  color: config.color  }}>
                  {statsData?.activeClients?.current || 0}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Gjennomsnittlig prosjektverdi
                </Typography>
                <Typography variant="h6" sx={{  color: config.color  }}>
                  {formatValue(statsData?.avgProjectValue?.current || 0'currency')}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </MuiCard>
      </Box>
    </Box>
  );
}