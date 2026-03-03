/**
 * CreatorHub Norge - Memoized Status Cards
 * Performance-optimized status display components
 */

import React, { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Api as ApiIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

export interface OverviewUsage {
  totalApiCalls?: number;
  activeIntegrations?: number;
  errorRate?: number;
  averageResponseTime?: number;
}

export interface EnvironmentStatus {
  environment?: string;
  healthChecks?: {
    database?: boolean;
    cache?: boolean;
    externalApis?: boolean;
  };
  uptime?: number;
  version?: string;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
}

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

const StatusCard = memo<StatusCardProps>(
  ({ title, value, subtitle, trend, trendValue, color = 'primary', icon, loading = false, onRefresh, action }) => {
    const trendIcon =
      trend === 'up' ? (
        <TrendingUpIcon color="success" fontSize="small" />
      ) : trend === 'down' ? (
        <TrendingDownIcon color="error" fontSize="small" />
      ) : trend === 'flat' ? (
        <TrendingFlatIcon color="info" fontSize="small" />
      ) : null;

    return (
      <Card elevation={2} sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {icon}
              <Typography variant="h6" color="text.secondary" noWrap>
                {title}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
              <Typography variant="h4" color={`${color}.main`} fontWeight={700}>
                {value}
              </Typography>
            )}

            {trendIcon && trendValue && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {trendIcon}
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
  },
);

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

  const errorRate = data?.errorRate ?? 0;
  const responseTime = data?.averageResponseTime ?? 0;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
      <StatusCard
        title="API-kall totalt"
        value={loading ? 0 : data?.totalApiCalls?.toLocaleString('nb-NO') ?? '0'}
        subtitle="I denne måneden"
        icon={<ApiIcon />}
        color="primary"
        loading={loading}
        onRefresh={onRefresh}
      />

      <StatusCard
        title="Aktive integrasjoner"
        value={loading ? 0 : data?.activeIntegrations ?? 0}
        subtitle="Konfigurerte tjenester"
        icon={<SecurityIcon />}
        color="success"
        loading={loading}
        onRefresh={onRefresh}
      />

      <StatusCard
        title="Feilrate"
        value={loading ? '0%' : `${errorRate.toFixed(1)}%`}
        subtitle="Siste 24 timer"
        trend={errorRate > 5 ? 'up' : errorRate < 1 ? 'down' : 'flat'}
        trendValue={`${errorRate.toFixed(1)}%`}
        icon={<SpeedIcon />}
        color={errorRate > 5 ? 'error' : 'success'}
        loading={loading}
        onRefresh={onRefresh}
      />

      <StatusCard
        title="Responstid"
        value={loading ? '0ms' : `${responseTime}ms`}
        subtitle="Gjennomsnitt"
        trend={responseTime > 1000 ? 'up' : 'down'}
        trendValue={`${responseTime}ms`}
        icon={<StorageIcon />}
        color={responseTime > 1000 ? 'warning' : 'success'}
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
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Miljøhelse</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={data?.environment ?? 'unknown'}
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
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <StackHealthChecks data={data} />
        )}
      </CardContent>
    </Card>
  );
});

EnvironmentHealth.displayName = 'EnvironmentHealth';

function StackHealthChecks({ data }: { data: EnvironmentStatus | null }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="body2" gutterBottom>
          Database tilkobling
        </Typography>
        <LinearProgress variant="determinate" value={data?.healthChecks?.database ? 100 : 0} color={data?.healthChecks?.database ? 'success' : 'error'} />
      </Box>

      <Box>
        <Typography variant="body2" gutterBottom>
          Cache system
        </Typography>
        <LinearProgress variant="determinate" value={data?.healthChecks?.cache ? 100 : 0} color={data?.healthChecks?.cache ? 'success' : 'error'} />
      </Box>

      <Box>
        <Typography variant="body2" gutterBottom>
          Eksterne API-er
        </Typography>
        <LinearProgress variant="determinate" value={data?.healthChecks?.externalApis ? 100 : 0} color={data?.healthChecks?.externalApis ? 'success' : 'error'} />
      </Box>

      <Typography variant="caption" color="text.secondary">
        Oppetid: {data?.uptime ?? 0}% | Versjon: {data?.version ?? 'Ukjent'}
      </Typography>
    </Box>
  );
}

interface ServiceHealthListProps {
  services: ServiceHealth[];
  loading?: boolean;
  onRefresh?: () => void;
  onTestService?: (service: string) => void;
}

export const ServiceHealthList = memo<ServiceHealthListProps>(({ services, loading, onRefresh, onTestService }) => {
  if (!services.length && !loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Ingen tjenester overvåket
      </Typography>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Tjenestehelse</Typography>
          {onRefresh && (
            <IconButton size="small" onClick={onRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {services.map((service) => (
              <Box
                key={service.service}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {service.service}
                  </Typography>
                  <Chip
                    label={service.status}
                    size="small"
                    color={
                      service.status === 'healthy' ? 'success' : service.status === 'degraded' ? 'warning' : 'error'
                    }
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {service.responseTime}ms
                  </Typography>
                  {onTestService && (
                    <IconButton size="small" onClick={() => onTestService(service.service)}>
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

ServiceHealthList.displayName = 'ServiceHealthList';

export default StatusCard;
