import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  LinearProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Store,
  ShoppingCart,
  Warning,
  TrendingUp,
  TrendingDown,
  Refresh,
  Inventory,
  LocalShipping,
  AttachMoney,
  Visibility,
  CheckCircle,
  Schedule,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorQuickStatsProps {
  vendorType: string;
  vendorName: string;
  userId: string;
  onStatClick?: (statKey: string) => void;
}

interface StatData {
  label: string;
  value: number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  alert?: boolean;
  alertMessage?: string;
  trend?: 'up' | 'down' | 'neutral';
  clickable?: boolean;
  key: string;
}

export default function VendorQuickStats({
  vendorType,
  vendorName,
  userId,
  onStatClick
}: VendorQuickStatsProps) {
  const theme = useTheme();
  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch vendor stats
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['/api/vendor-stats', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-stats/${vendorType}/${vendorName}/${userId}`),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const getStatCards = (): StatData[] => {
    const cards: StatData[] = [
      {
        key: 'products',
        label: 'Totale Produkter',
        value: stats?.totalProducts || 0,
        change: stats?.productsChange || 0,
        changeLabel: 'denne uken',
        icon: <Store />,
        color: vendorConfig?.color || '#2196f3',
        bgColor: alpha(vendorConfig?.color || '#2196f3', 0.1),
        trend: stats?.productsChange > 0 ? 'up' : stats?.productsChange < 0 ? 'down' : 'neutral',
        clickable: true
      },
      {
        key: 'pending_orders',
        label: 'Ventende Ordre',
        value: stats?.pendingOrders || 0,
        icon: <ShoppingCart />,
        color: stats?.pendingOrders > 0 ? '#ff9800' : '#4caf50',
        bgColor: alpha(stats?.pendingOrders > 0 ? '#ff9800' : '#4caf50', 0.1),
        alert: stats?.pendingOrders > 5,
        alertMessage: stats?.pendingOrders > 5 ? `${stats.pendingOrders} ordre venter på behandling` : undefined,
        clickable: true
      },
      {
        key: 'low_stock',
        label: 'Lavt Lager',
        value: stats?.lowStockCount || 0,
        icon: <Warning />,
        color: stats?.lowStockCount > 0 ? '#f44336' : '#4caf50',
        bgColor: alpha(stats?.lowStockCount > 0 ? '#f44336' : '#4caf50', 0.1),
        alert: stats?.lowStockCount > 0,
        alertMessage: stats?.lowStockCount > 0 ? `${stats.lowStockCount} produkter under minimumsnivå` : undefined,
        clickable: true
      },
      {
        key: 'revenue',
        label: 'Omsetning (30d)',
        value: stats?.revenue30d || 0,
        change: stats?.revenueChange || 0,
        changeLabel: 'vs forrige måned',
        icon: <AttachMoney />,
        color: '#4caf50',
        bgColor: alpha('#4caf50', 0.1),
        trend: stats?.revenueChange > 0 ? 'up' : stats?.revenueChange < 0 ? 'down' : 'neutral',
        clickable: true
      }
    ];

    // Add vendor-type-specific stats
    if (vendorConfig?.supportedFeatures.physical_shipping) {
      cards.push({
        key: 'shipped_orders',
        label: 'Sendt i dag',
        value: stats?.shippedToday || 0,
        icon: <LocalShipping />,
        color: '#9c27b0',
        bgColor: alpha('#9c27b0', 0.1),
        clickable: true
      });
    }

    if (vendorConfig?.supportedFeatures.digital_delivery) {
      cards.push({
        key: 'downloads',
        label: 'Nedlastinger (30d)',
        value: stats?.downloads30d || 0,
        change: stats?.downloadsChange || 0,
        changeLabel: 'vs forrige måned',
        icon: <Visibility />,
        color: '#00bcd4',
        bgColor: alpha('#00bcd4', 0.1),
        trend: stats?.downloadsChange > 0 ? 'up' : 'neutral',
        clickable: true
      });
    }

    if (vendorConfig?.supportedFeatures.showcase) {
      cards.push({
        key: 'showcase_views',
        label: 'Showcase Visninger',
        value: stats?.showcaseViews || 0,
        change: stats?.showcaseViewsChange || 0,
        changeLabel: 'denne uken',
        icon: <Visibility />,
        color: '#673ab7',
        bgColor: alpha('#673ab7', 0.1),
        trend: stats?.showcaseViewsChange > 0 ? 'up' : 'neutral',
        clickable: true
      });
    }

    return cards;
  };

  const statCards = getStatCards();

  const handleStatClick = (statKey: string) => {
    if (onStatClick) {
      onStatClick(statKey);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>Laster statistikk...</Typography>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Rask statistikk oversikt">
      {/* Header with refresh button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          📊 Oversikt
        </Typography>
        <IconButton 
          onClick={() => refetch()} 
          size="small"
          aria-label="Oppdater statistikk"
          title="Oppdater statistikk"
          sx={{
            minWidth: 48,
            minHeight: 48,
            '&:focus-visible': {
              outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
              outlineOffset: '2px'
            }
          }}
        >
          <Refresh aria-hidden="true" />
        </IconButton>
      </Box>
      
      {/* Screen reader status for stats update */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      >
        {!isLoading && `Statistikk oppdatert. ${statCards.length} statistikk kort tilgjengelig.`}
      </div>

      {/* Stats Grid */}
      <Grid container spacing={2}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={4} key={stat.key}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                component={stat.clickable ? 'button' : 'div'}
                role={stat.clickable ? 'button' : undefined}
                tabIndex={stat.clickable ? 0 : undefined}
                aria-label={stat.clickable ? `${stat.label}: ${stat.value}${stat.alertMessage ? `. ${stat.alertMessage}` : ''}. Klikk for detaljer.` : undefined}
                sx={{
                  height: '100%',
                  cursor: stat.clickable ? 'pointer' : 'default',
                  transition: 'all 0.3s',
                  border: stat.alert ? `2px solid ${stat.color}` : `1px solid ${theme.palette.divider}`,
                  textAlign: 'left',
                  width: '100%',
                  padding: 0,
                  backgroundColor: 'background.paper',
                  // WCAG 2.2: Focus indicator
                  '&:focus-visible': stat.clickable ? {
                    outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                    outlineOffset: '2px'
                  } : {},
                  '&:hover': stat.clickable ? {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  } : {}
                }}
                onClick={() => stat.clickable && handleStatClick(stat.key)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (stat.clickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleStatClick(stat.key);
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Avatar
                      aria-hidden="true"
                      sx={{
                        bgcolor: stat.bgColor,
                        color: stat.color,
                        width: 48,
                        height: 48
                      }}
                    >
                      {React.cloneElement(stat.icon as React.ReactElement, { 'aria-hidden': 'true' })}
                    </Avatar>
                    {stat.alert && (
                      <Chip
                        icon={<Warning aria-hidden="true" />}
                        label="!"
                        size="small"
                        aria-label={`Advarsel: ${stat.alertMessage}`}
                        sx={{
                          bgcolor: alpha(stat.color, 0.2),
                          color: stat.color,
                          fontWeight: 600
                        }}
                      />
                    )}
                  </Box>

                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: stat.color }}>
                    {stat.key === 'revenue' ? `${stat.value.toLocaleString()} kr` : stat.value.toLocaleString()}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {stat.label}
                  </Typography>

                  {stat.change !== undefined && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} role="status" aria-label={`Endring: ${stat.change > 0 ? 'Opp' : stat.change < 0 ? 'Ned' : 'Ingen endring'} ${stat.change}% ${stat.changeLabel}`}>
                      {stat.trend === 'up' && <TrendingUp sx={{ fontSize: 16, color: '#4caf50' }} aria-hidden="true" />}
                      {stat.trend === 'down' && <TrendingDown sx={{ fontSize: 16, color: '#f44336' }} aria-hidden="true" />}
                      <Typography
                        variant="caption"
                        sx={{
                          color: stat.trend === 'up' ? '#4caf50' : stat.trend === 'down' ? '#f44336' : 'text.secondary',
                          fontWeight: 600
                        }}
                        aria-hidden="true"
                      >
                        {stat.change > 0 ? '+' : ','}{stat.change}% {stat.changeLabel}
                      </Typography>
                    </Box>
                  )}

                  {stat.alertMessage && (
                    <Box
                      role="alert"
                      aria-live="polite"
                      sx={{
                        mt: 1.5,
                        p: 1,
                        bgcolor: alpha(stat.color, 0.1),
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}
                    >
                      <ErrorIcon sx={{ fontSize: 16, color: stat.color }} aria-hidden="true" />
                      <Typography variant="caption" sx={{ color: stat.color, fontWeight: 500 }}>
                        {stat.alertMessage}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity Summary */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <Card sx={{ mt: 3 }} component="section" aria-labelledby="recent-activity-heading">
          <CardContent>
            <Typography 
              id="recent-activity-heading"
              variant="subtitle1" 
              component="h3"
              sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Schedule aria-hidden="true" /> Siste aktivitet
            </Typography>
            <Box 
              component="ul" 
              role="list"
              aria-label="Liste over siste aktiviteter"
              sx={{ display: 'flex', flexDirection: 'column', gap: 1, listStyle: 'none', padding: 0, margin: 0 }}
            >
              {stats.recentActivity.slice(0, 5).map((activity: any, index: number) => (
                <Box
                  component="li"
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {activity.type === 'order' && <ShoppingCart sx={{ fontSize: 18, color: '#ff9800' }} aria-label="Ordre" />}
                    {activity.type === 'product' && <Store sx={{ fontSize: 18, color: '#2196f3' }} aria-label="Produkt" />}
                    {activity.type === 'stock' && <Inventory sx={{ fontSize: 18, color: '#f44336' }} aria-label="Lager" />}
                    <Typography variant="body2">{activity.message}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" aria-label={`Tid: ${activity.timestamp}`}>
                    {activity.timestamp}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}


