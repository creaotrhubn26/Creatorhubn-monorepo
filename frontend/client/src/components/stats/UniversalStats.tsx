import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Typography,
} from '@mui/material';
import {
  Assessment,
  AttachMoney,
  Group,
  LibraryMusic,
  PhotoCamera,
  Star,
  Store,
  TrendingDown,
  TrendingUp,
  Videocam,
  Visibility,
} from '@mui/icons-material';

type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor';

interface StatsProps {
  profession: Profession;
  userId?: string;
}

type StatFormat = 'number' | 'currency' | 'percentage' | 'rating';

interface StatConfig {
  key: string;
  label: string;
  format: StatFormat;
  icon: React.ElementType;
  color: string;
}

interface StatSource {
  current?: number;
  previous?: number;
}

type StatsApiResponse = Record<string, StatSource> & {
  totalRevenue?: StatSource;
  activeClients?: StatSource;
  avgProjectValue?: StatSource;
};

type GoalsApiResponse = Record<string, number | undefined>;

interface RenderStat extends StatConfig {
  value: number;
  previousValue: number;
  target?: number;
  trend: { percentage: number; isPositive: boolean };
}

const professionStatsConfig: Record<Profession, { color: string; stats: StatConfig[] }> = {
  photographer: {
    color: '#ff8c00',
    stats: [
      { key: 'activeProjects', label: 'Aktive Prosjekter', icon: PhotoCamera, format: 'number', color: '#ff8c00' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newClients', label: 'Nye Kunder', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#f59e0b' },
      { key: 'completedShoots', label: 'Fullførte Oppdrag', icon: PhotoCamera, format: 'number', color: '#8b5cf6' },
      { key: 'portfolioViews', label: 'Portfolio Visninger', icon: Visibility, format: 'number', color: '#64748b' },
    ],
  },
  videographer: {
    color: '#ef4444',
    stats: [
      { key: 'activeProjects', label: 'Aktive Prosjekter', icon: Videocam, format: 'number', color: '#ef4444' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newClients', label: 'Nye Kunder', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#f59e0b' },
      { key: 'videoHours', label: 'Timer Produsert', icon: Videocam, format: 'number', color: '#8b5cf6' },
      { key: 'portfolioViews', label: 'Portfolio Visninger', icon: Visibility, format: 'number', color: '#64748b' },
    ],
  },
  music_producer: {
    color: '#8e24aa',
    stats: [
      { key: 'activeTracks', label: 'Aktive Spor', icon: LibraryMusic, format: 'number', color: '#8e24aa' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newArtists', label: 'Nye Artister', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#f59e0b' },
      { key: 'releasedTracks', label: 'Utgitte Spor', icon: LibraryMusic, format: 'number', color: '#8b5cf6' },
      { key: 'streamingPlays', label: 'Streaming Avspillinger', icon: Visibility, format: 'number', color: '#64748b' },
    ],
  },
  vendor: {
    color: '#0284c7',
    stats: [
      { key: 'activeProducts', label: 'Aktive Produkter', icon: Store, format: 'number', color: '#0284c7' },
      { key: 'monthlyRevenue', label: 'Månedens Inntekt', icon: AttachMoney, format: 'currency', color: '#4caf50' },
      { key: 'newCustomers', label: 'Nye Kunder', icon: Group, format: 'number', color: '#2196f3' },
      { key: 'avgRating', label: 'Gj.snitt Vurdering', icon: Star, format: 'rating', color: '#f59e0b' },
      { key: 'ordersCompleted', label: 'Fullførte Bestillinger', icon: Store, format: 'number', color: '#8b5cf6' },
      { key: 'inventoryTurnover', label: 'Lageromsetning', icon: Assessment, format: 'percentage', color: '#64748b' },
    ],
  },
};

const formatValue = (value: number, format: StatFormat): string => {
  switch (format) {
    case 'currency':
      return `${value.toLocaleString('no-NO')} kr`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'rating':
      return `${value.toFixed(1)}/5.0`;
    case 'number':
    default:
      return value.toLocaleString('no-NO');
  }
};

const calculateTrend = (current: number, previous: number): { percentage: number; isPositive: boolean } => {
  if (previous <= 0) {
    return { percentage: 0, isPositive: true };
  }
  const change = ((current - previous) / previous) * 100;
  return { percentage: Math.abs(change), isPositive: change >= 0 };
};

export default function UniversalStats({ profession, userId }: StatsProps): React.ReactElement {
  const config = professionStatsConfig[profession];

  const { data: statsData = {}, isLoading } = useQuery<StatsApiResponse>({
    queryKey: ['/api/stats', profession, userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/stats/${profession}?userId=${userId ?? 'guest'}`);
      return (response as StatsApiResponse) ?? {};
    },
    enabled: Boolean(profession),
  });

  const { data: goalsData = {} } = useQuery<GoalsApiResponse>({
    queryKey: ['/api/goals', profession, userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/goals/${profession}?userId=${userId ?? 'guest'}`);
      return (response as GoalsApiResponse) ?? {};
    },
    enabled: Boolean(profession),
  });

  const stats = useMemo<RenderStat[]>(() => {
    return config.stats.map((statConfig) => {
      const source = statsData[statConfig.key] ?? {};
      const value = source.current ?? 0;
      const previousValue = source.previous ?? 0;
      return {
        ...statConfig,
        value,
        previousValue,
        target: goalsData[statConfig.key],
        trend: calculateTrend(value, previousValue),
      };
    });
  }, [config.stats, goalsData, statsData]);

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Statistikk
        </Typography>
        <Grid container spacing={2}>
          {config.stats.map((stat) => (
            <Grid item xs={12} md={6} lg={4} key={stat.key}>
              <Card variant="outlined">
                <CardContent>
                  <LinearProgress />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Assessment sx={{ mr: 1.5, color: config.color }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: config.color }}>
          Statistikk & Ytelse
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          const progressValue =
            stat.target && stat.target > 0 ? Math.min(100, (stat.value / stat.target) * 100) : null;

          return (
            <Grid item xs={12} md={6} lg={4} key={stat.key}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: `${stat.color}20`, color: stat.color }}>
                      <IconComponent fontSize="small" />
                    </Avatar>
                    {stat.previousValue > 0 ? (
                      <Chip
                        size="small"
                        icon={stat.trend.isPositive ? <TrendingUp /> : <TrendingDown />}
                        label={`${stat.trend.isPositive ? '+' : '-'}${stat.trend.percentage.toFixed(1)}%`}
                        color={stat.trend.isPositive ? 'success' : 'error'}
                        variant="outlined"
                      />
                    ) : null}
                  </Box>

                  <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>
                    {formatValue(stat.value, stat.format)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {stat.label}
                  </Typography>

                  {progressValue !== null ? (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Mål: {formatValue(stat.target ?? 0, stat.format)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {progressValue.toFixed(0)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progressValue}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: `${stat.color}20`,
                          '& .MuiLinearProgress-bar': { bgcolor: stat.color },
                        }}
                      />
                    </Box>
                  ) : null}

                  {stat.previousValue > 0 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Forrige periode: {formatValue(stat.previousValue, stat.format)}
                    </Typography>
                  ) : null}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Card variant="outlined" sx={{ bgcolor: `${config.color}10`, borderColor: `${config.color}50` }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: config.color, mb: 1.5 }}>
              Ytelsessammendrag
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Total aktiv omsetning
                </Typography>
                <Typography variant="h6" sx={{ color: config.color }}>
                  {formatValue(statsData.totalRevenue?.current ?? 0, 'currency')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Aktive klienter/kunder
                </Typography>
                <Typography variant="h6" sx={{ color: config.color }}>
                  {(statsData.activeClients?.current ?? 0).toLocaleString('no-NO')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Gj.snitt prosjektverdi
                </Typography>
                <Typography variant="h6" sx={{ color: config.color }}>
                  {formatValue(statsData.avgProjectValue?.current ?? 0, 'currency')}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
