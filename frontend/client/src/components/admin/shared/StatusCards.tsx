/**
 * CreatorHub Norge - Memoized Status Cards
 * Performance-optimized status display components
 */

import { useTheming } from '../../utils/theming-helper';
import React, { memo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Api as ApiIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import type { OverviewUsage, EnvironmentStatus, ServiceHealth } from '@/types/integrations';

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
  loading?: boolean;
  onRefresh?: () => void;
  action?: React.ReactNode;
}

const StatusCard = memo<StatusCardProps>((
  // Theming system
  const theming = useTheming('prototype_tester');{
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = 'primary',
  icon,
  loading = false,
  onRefresh,
  action
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon color="success" fontSize="small" />;
      case 'down':
        return <TrendingDownIcon color="error" fontSize="small" />;
      case 'flat':
        return <TrendingFlatIcon color="info" fontSize="small" />;
      default: return null;
}
};

  return (
    <Card elevation={2}, sx={{ height: '100%' ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            {icon}
            <Typography variant="h6" color="text.secondary" noWrap sx={{ color: theming.colors.primary }}>
              {title}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            {action}
            {onRefresh && (
              <Tooltip title="Oppdater">
                <IconButton size="small" onClick={onRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Typography variant="h4" color={`${color}.main`} fontWeight="bold" sx={{ color: theming.colors.primary }}>
              {value}
            </Typography>
          )}
          
          {trend && trendValue && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
              {getTrendIcon()}
              <Typography variant="body2" color="text.secondary">
                {trendValue}
              </Typography>
            </Box>
          )}
        </Box>

        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
});

StatusCard.displayName = 'StatusCard';

interface OverviewStatsProps {
  data: OverviewUsage | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export const OverviewStats = memo<OverviewStatsProps>(({ data, loading, onRefresh }) => {
  if (!data && !loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Ingen data tilgjengelig
      </Typography>
    );
}

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap:  2 }}>
      <StatusCard
        title="API-kall totalt"
        value={loading ? 0 : data?.totalApiCalls?.toLocaleString('nb-NO') || '0'}
        subtitle="I denne måneden"
        icon={<ApiIcon />}
        color="primary"
        loading={loading}
        onRefresh={onRefresh}
      />
      
      <StatusCard
        title="Aktive integrasjoner"
        value={loading ? 0 : data?.activeIntegrations || '0'}
        subtitle="Konfigurerte tjenester"
        icon={<SecurityIcon />}
        color="success"
        loading={loading}
        onRefresh={onRefresh}
      />
      
      <StatusCard
        title="Feilrate"
        value={loading ? '0%' : `${(data?.errorRate || 0).toFixed(1)}%`}
        subtitle="Siste 24 timer"
        trend={data?.errorRate && data.errorRate > 5 ? 'up' : data?.errorRate && data.errorRate < 1 ? 'down' : 'flat'}
        trendValue={data?.errorRate ? `${data.errorRate > 5 ? '+' : ', '}${data.errorRate.toFixed(1)}%` : undefined}
        icon={<SpeedIcon />}
        color={data?.errorRate && data.errorRate > 5 ? 'error' : 'success'}
        loading={loading}
        onRefresh={onRefresh}
      />
      
      <StatusCard
        title="Responstid"
        value={loading ? '0ms' : `${data?.averageResponseTime || 0}ms`}
        subtitle="Gjennomsnitt"
        trend={data?.averageResponseTime && data.averageResponseTime > 1000 ? 'up' : 'down'}
        trendValue={data?.averageResponseTime ? `${data.averageResponseTime}ms` : undefined}
        icon={<StorageIcon />}
        color={data?.averageResponseTime && data.averageResponseTime > 1000 ? 'warning' : 'success'}
        loading={loading}
        onRefresh={onRefresh}
      />
    </Box>
  );
});

OverviewStats.displayName = 'OverviewStats';

interface EnvironmentHealthProps {
  data: EnvironmentStatus | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export const EnvironmentHealth = memo<EnvironmentHealthProps>(({ data, loading, onRefresh }) => {
  if (!data && !loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Miljødata ikke tilgjengelig
      </Typography>
    );
}

  return (
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Miljøhelse
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Chip 
              label={data?.environment || 'unknown'}
              color={data?.environment === 'production' ? 'error' : 'info'}
              size="small"
            />
            {onRefresh && (
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py:  4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                Database tilkobling
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={data?.healthChecks?.database ? 100 : 0}
                color={data?.healthChecks?.database ? 'success' : 'error'}
              />
            </Box>
            
            <Box>
              <Typography variant="body2" gutterBottom>
                Cache system
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={data?.healthChecks?.cache ? 100 : 0}
                color={data?.healthChecks?.cache ? 'success' : 'error'}
              />
            </Box>
            
            <Box>
              <Typography variant="body2" gutterBottom>
                Eksterne API-er
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={data?.healthChecks?.externalApis ? 100 : 0}
                color={data?.healthChecks?.externalApis ? 'success' : 'error'}
              />
            </Box>

            <Box sx={{ mt:  1 }}>
              <Typography variant="caption" color="text.secondary">
                Oppetid: {data?.uptime || 0}% | Versjon: {data?.version || 'Ukjent'}
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

EnvironmentHealth.displayName = 'EnvironmentHealth';

interface ServiceHealthListProps {
  services: ServiceHealth[];
  loading?: boolean;
  onRefresh?: () => void;
  onTestService?: (service: string) => void;
}

export const ServiceHealthList = memo<ServiceHealthListProps>(({ 
  services, 
  loading, 
  onRefresh, 
  onTestService 
}) => {
  if (!services.length && !loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Ingen tjenester overvåket
      </Typography>
    );
}

  return (
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Tjenestehelse
          </Typography>
          {onRefresh && (
            <IconButton size="small" onClick={onRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py:  4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
            {services.map((service) => (
              <Box 
                key={service.service}
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  p:  1,
                  border:  1,
                  borderColor: 'divider',
                  borderRadius: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {service.service}
                  </Typography>
                  <Chip 
                    label={service.status}
                    size="small"
                    color={
                      service.status === 'healthy' ? 'success' :
                      service.status === 'degraded' ? 'warning' : 'error'
                  }
                  />
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {service.responseTime}ms
                  </Typography>
                  {onTestService && (
                    <IconButton 
                      size="small" 
                      onClick={() => onTestService(service.service)}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

ServiceHealthList.displayName ='ServiceHealthList';

export default StatusCard;