/**
 * CreatorHub Norge - Subscriber Statistics Panel
 * Shows subscriber counts broken down by package/plan
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Stack,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MoneyIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useDemoMode, useDemoModeApi } from '@/contexts/DemoModeContext';
import { mockFetch } from '@/api/mockGooglePayApi';

interface SubscriberStats {
  totalSubscribers: number;
  activeSubscribers: number;
  trialSubscribers: number;
  cancelledSubscribers: number;
  packageBreakdown: {
    [packageId: string]: {
      name: string;
      price: number;
      currency: string;
      interval: string;
      subscribers: number;
      revenue: number;
      growth: number;
};
};
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  conversionRate: number;
  lastUpdated: string;
}

interface SubscriberStatsPanelProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export default function SubscriberStatsPanel({ 
  compact = false, 
  showDetails = false,
  className 
}: SubscriberStatsPanelProps) {
  const { auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const { isDemoMode } = useDemoMode();
  
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  // Mock subscriber data for development
  const mockSubscriberStats: SubscriberStats = {
    totalSubscribers: 16,
    activeSubscribers: 12,
    trialSubscribers:  8,
    cancelledSubscribers:  6,
    packageBreakdown: {
      'basic-plan': {
        name: 'Basic Plan',
        price:  99,
        currency: 'NO',
        interval: 'month',
        subscribers:  45,
        revenue: 445,
        growth: 12.5,
    }, 'pro-plan': {
        name: 'Professional Plan',
        price: 29,
        currency: 'NO',
        interval: 'month',
        subscribers:  78,
        revenue: 2332,
        growth: 8.3,
    }, 'enterprise-plan': {
        name: 'Enterprise Plan',
        price: 99,
        currency: 'NO',
        interval: 'month',
        subscribers:  19,
        revenue: 1891,
        growth: 15.2,
    },
  },
    monthlyRecurringRevenue: 4678,
    averageRevenuePerUser: 299.3,
    churnRate: 2.1,
    conversionRate: 18.5,
    lastUpdated: new Date().toISOString()
  };

  // Fetch subscriber statistics with demo mode support
  const { data: subscriberStats, isLoading, refetch, error } = useDemoModeApi(
    ['/api/admin/subscriber-stats,'],
    async () => {
      const authHeader = await auth.getAuthHeader();
      const response = await fetch('/api/admin/subscriber-stats', {
        headers: {
          ...authHeader, 'Content-Type': 'application/json',
      },
    });
      
      if (response.status === 401) {
        throw new Error('Authentication required - please log in');
    }
      if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions');
    }
      if (!response.ok) {
        throw new Error(`Subscriber stats fetch failed: ${response.status} ${response.statusText}`);
    }
      
      return response.json();
  },
    mockSubscriberStats,
    {
      enabled: !!auth,
      refetchInterval: 3000, // Update every 30 seconds
      retry: (failureCount: number, error: any) => {
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
    }
        return failureCount < 3;
    },
  }
  );

  const handleRefresh = async () => {
    try {
      await refetch();
      setLastChecked(new Date());
  } catch (error) {
      console.error('Error refreshing subscriber stats: ', error);
  }
};

  const getGrowthColor = (growth: number) => {
    if (growth > 10) return 'success';
    if (growth > 5) return 'warning';
    return 'error';
};

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUpIcon sx={{ fontSize: 16 }} />;
    return <WarningIcon sx={{ fontSize: 16 }} />;
  };

  if (compact) {
    return (
      <Card className={className} sx={{ p: 2,...theming.getThemedCardSx() }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PeopleIcon sx={{ color: '#4caf50' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              {(subscriberStats as SubscriberStats)?.totalSubscribers || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Abonnenter
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="body2" color="text.secondary">
              {(subscriberStats as SubscriberStats)?.monthlyRecurringRevenue?.toLocaleString('nb-NO') || 0} NOK
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Månedlig inntekt
            </Typography>
          </Box>
        </Stack>
      </Card>
    );
}

  if (isLoading) {
    return (
      <Card className={className} sx={{ p: 3,...theming.getThemedCardSx() }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Laster abonnentstatistikk...
          </Typography>
        </Box>
      </Card>
    );
}

  if (error) {
    return (
      <Card className={className} sx={{ p: 3,...theming.getThemedCardSx() }}>
        <Alert severity="error">
          <Typography variant="body2">
            <strong>Feil ved lasting av abonnentstatistikk: </strong> {error.message}
          </Typography>
        </Alert>
      </Card>
    );
}

  const stats: SubscriberStats = (subscriberStats as SubscriberStats) || mockSubscriberStats;

  return (
    <Card className={className} sx={{ p: 3, borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', ...theming.getThemedCardSx() }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PeopleIcon sx={{ fontSize: 32, color: '#4caf50' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              Abonnentstatistikk
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sist oppdatert: {lastChecked.toLocaleTimeString(', ')}
            </Typography>
          </Box>
        </Stack>
        <Tooltip title="Oppdater statistikk">
          <IconButton onClick={handleRefresh} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Overview Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2, bgcolor: '#e8f5e8', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
              <PeopleIcon sx={{ fontSize: 32, color: '#4caf50', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 600}}>
                {stats.totalSubscribers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale abonnenter
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2, bgcolor: '#e3f2fd', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
              <CheckIcon sx={{ fontSize: 32, color: '#2196f3', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#2196f3' }}>
                {stats.activeSubscribers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive abonnenter
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2, bgcolor: '#fff3e0', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
              <PersonIcon sx={{ fontSize: 32, color: '#ff9800', mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {stats.trialSubscribers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Prøveabonnenter
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', p: 2, bgcolor: '#fce4ec', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
              <MoneyIcon sx={{ fontSize: 32, color: '#e91e63', mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {stats.monthlyRecurringRevenue.toLocaleString('nb-NO')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                NOK/måned
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Package Breakdown Table */}
      {showDetails && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <BusinessIcon />
            Pakkefordeling
          </Typography>
          
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Pakke</strong></TableCell>
                  <TableCell align="right"><strong>Pris</strong></TableCell>
                  <TableCell align="right"><strong>Abonnenter</strong></TableCell>
                  <TableCell align="right"><strong>Inntekt</strong></TableCell>
                  <TableCell align="right"><strong>Vekst</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(stats.packageBreakdown).map(([packageId, pkg]: [string, any]) => (
                  <TableRow key={packageId}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>
                          {pkg.name}
                        </Typography>
                        <Chip
                          label={pkg.interval}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        {pkg.price} {pkg.currency}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Badge badgeContent={pkg.subscribers} color="primary">
                        <GroupIcon />
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4caf50' }}>
                        {pkg.revenue.toLocaleString('nb-NO')} NOK
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
                        {getGrowthIcon(pkg.growth)}
                        <Chip
                          label={`${pkg.growth > 0 ? '+' : ', '}${pkg.growth}%`}
                          size="small"
                          color={getGrowthColor(pkg.growth) as any}
                          variant="outlined"
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Additional Metrics */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card sx={{ p: 2, textAlign: 'center', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                  Gjennomsnittlig inntekt per bruker
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                  {stats.averageRevenuePerUser.toLocaleString('nb-NO')} NOK
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ p: 2, textAlign: 'center', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                  Churn rate
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                  {stats.churnRate}%
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ p: 2, textAlign:'center', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                  Konverteringsrate
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                  {stats.conversionRate}%
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {isDemoMode && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Demo-modus: </strong> Viser mock data for abonnentstatistikk
          </Typography>
        </Alert>
      )}
    </Card>
  );
}
