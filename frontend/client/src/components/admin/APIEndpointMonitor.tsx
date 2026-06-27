import { useTheming } from '../../utils/theming-helper';
import React, { useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid2,
  Alert,
  Chip,
  Tooltip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Api,
  Code,
  IntegrationInstructions,
} from '@mui/icons-material';
import {
  AdminButton,
  StatusChip,
  AdminTableContainer,
} from './design-system';

interface EndpointHealthCheck {
  endpoint: string;
  method: string;
  status: 'healthy' | 'degraded' | 'failed';
  responseTime: number;
  statusCode: number;
  error?: string;
  lastChecked: Date;
}

interface APIHealthSummary {
  lastCheck: Date;
  totalEndpoints: number;
  healthyEndpoints: number;
  failedEndpoints: number;
  degradedEndpoints: number;
  criticalFailures: number;
  endpoints: EndpointHealthCheck[];
}
interface RegistryEndpoint {
  path: string;
  method: string;
  description?: string;
  critical?: boolean;
}

const APIEndpointMonitor: React.FC = () => {
  const queryClient = useQueryClient();

  // Enhanced Master Integration
  const { auth, analytics, features } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Hent API endpoint health data
  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
  } = useQuery({
    queryKey: ['/api/admin/api-endpoints/health'],
    refetchInterval: 700000,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/api-endpoints/health', { headers });
    },
  });

  // Hent API endpoint registry
  const { data: registryData, isLoading: registryLoading } = useQuery({
    queryKey: ['/api/admin/api-endpoints/registry'],
    refetchInterval: 3000000,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/api-endpoints/registry', { headers });
    },
  });

  const triggerHealthCheck = async () => {
    try {
      // Track health check trigger
      analytics.trackEvent('api_health_check_triggered', {
        component: 'APIEndpointMonitor',
        timestamp: Date.now(),
      });

      await fetch('/api/admin/api-endpoints/check', {
        headers: {
          'Content-Type' : 'application/json',
        },
        method: 'POST',
      });

      // Invalider cache og hent nye data
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/api-endpoints/health'] });
      }, 2000);

      // Track successful health check
      analytics.trackEvent('api_health_check_success', {
        component: 'APIEndpointMonitor',
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Failed to trigger health check: ', err);

      // Track failed health check
      analytics.trackEvent('api_health_check_failed', {
        component: 'APIEndpointMonitor',
        error: getErrorMessage(err),
        timestamp: Date.now(),
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'degraded':
        return <Warning sx={{ color: '#ff9800' }} />;
      case 'failed':
        return <Error sx={{ color: '#f44336' }} />;
      default:
        return <Error sx={{ color: '#9e9e9e' }} />;
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      core: theming.getThemedIcon('core'),
      admin: theming.getThemedIcon('admin'),
      development: <Code />,
      user: theming.getThemedIcon('user'),
      integration: <IntegrationInstructions />,
    };
    return icons[category] || <Api />;
  };

  const formatResponseTime = (time: number) => {
    if (time < 100) return `${time}ms`;
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const getErrorMessage = (err: unknown): string => {
    if (err && typeof err === 'object' && 'message' in err) return String(err.message);
    if (typeof err === 'string') return err;
    return 'Unknown error';
  };

  // Track component mount and check feature access
  useEffect(() => {
    // Track component mount
    analytics.trackEvent('component_mounted', {
      component: 'APIEndpointMonitor',
      componentType: 'admin-tool',
      timestamp: Date.now(),
    });

    // Check feature access
    const featureAccess = features.checkFeatureAccess('admin-tools', auth.state.user?.role);
    if (!featureAccess.hasAccess) {
      console.warn('API Endpoint Monitor: Feature access denied', featureAccess.reason);
    }

    // Track feature usage
    features.trackFeatureUsage('api-endpoint-monitor','viewed', {
      userId: auth.state.user?.id,
      userRole: auth.state.user?.role,
    });

    return () => {
      // Track component unmount
      analytics.trackEvent('component_unmounted', {
        component: 'APIEndpointMonitor',
        componentType: 'admin-tool',
        timestamp: Date.now(),
      });
    };
  }, [analytics, features, auth.state.user]);

  if (healthLoading || registryLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
          Laster API Endpoint Monitor...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Henter live API endpoint status og registry data...
        </Typography>
      </Box>
    );
  }

  if (healthError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Kunne ikke laste API endpoint data
          </Typography>
          <Typography variant="body2">
            API Endpoint Monitor er ikke tilgjengelig. Sjekk at backend-tjenesten kjører.
          </Typography>
        </Alert>

        <AdminButton
          tone="primary"
          startIcon={theming.getThemedIcon('refresh')}
          onClick={() => queryClient.invalidateQueries()}
          sx={{ mt: 2, ...theming.getThemedButtonSx() }}
        >
          Prøv igjen
        </AdminButton>
      </Box>
    );
  }

  const healthSummary = healthData as APIHealthSummary;
  const healthEndpoints = Array.isArray(healthSummary?.endpoints) ? healthSummary.endpoints : [];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 2, color: theming.colors.primary }}
        >
          <Api sx={{ fontSize: '2rem' }} />
          API Endpoint Monitor
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Sanntids overvåkning av alle API-endepunkter for system-helse og ytelse-tracking
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <AdminButton
            tone="primary"
            startIcon={theming.getThemedIcon('play')}
            onClick={triggerHealthCheck}
            sx={{ ...theming.getThemedButtonSx() }}
          >
            Kjør Health Check
          </AdminButton>

          <Typography variant="body2" color="text.secondary">
            Sist sjekket:{', '}
            {healthSummary?.lastCheck
              ? new Date(healthSummary.lastCheck).toLocaleString('no-NO')
              : 'Aldri'}
          </Typography>
        </Box>
      </Box>

      {/* Health Summary Cards */}
      <Grid2 container spacing={3} sx={{ mb: 4 }}>
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ height: '100%', backgroundColor: '#e8f5e8', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <CheckCircle sx={{ fontSize: 48, color: '#4caf50', mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {healthSummary?.healthyEndpoints ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Healthy Endpoints
              </Typography>
            </CardContent>
          </Card>
        </Grid2>

        {/* Degraded */}
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ height: '100%', backgroundColor: '#fff8e1', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Warning sx={{ fontSize: 48, color: '#ff9800', mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {healthSummary?.degradedEndpoints ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Degraded Endpoints
              </Typography>
            </CardContent>
          </Card>
        </Grid2>

        {/* Failed */}
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ height: '100%', backgroundColor: '#ffebee', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Error sx={{ fontSize: 48, color: '#f44336', mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {healthSummary?.failedEndpoints ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed Endpoints
              </Typography>
            </CardContent>
          </Card>
        </Grid2>

        {/* Total */}
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ height: '100%', backgroundColor: '#e3f2fd', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Api sx={{ fontSize: 48, color: '#60a5fa', mb: 1 }} />
              <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {(healthSummary?.healthyEndpoints ?? 0) +
                  (healthSummary?.degradedEndpoints ?? 0) +
                  (healthSummary?.failedEndpoints ?? 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Endpoints
              </Typography>
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>

      {healthSummary?.criticalFailures > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            ⚠️ {healthSummary.criticalFailures} Kritiske API-feil oppdaget
          </Typography>
          <Typography variant="body2">
            Kritiske API-endepunkter fungerer ikke. Dette kan påvirke kjernefunksjoner i systemet.
            Sjekk detaljert status nedenfor og kontakt systemadministrator.
          </Typography>
        </Alert>
      )}

      {/* API Endpoints by Category */}
      {registryData?.categorizedEndpoints &&
        Object.entries(registryData.categorizedEndpoints).map(([category, endpoints]) => {
          const endpointsArray = Array.isArray(endpoints) ? (endpoints as RegistryEndpoint[]) : [];
          const healthyCount = healthEndpoints.filter(
            (h) =>
              endpointsArray.some((e: RegistryEndpoint) => e.path === h.endpoint) &&
              h.status === 'healthy',
          ).length;

          const failedCount = healthEndpoints.filter(
            (h) =>
              endpointsArray.some((e: RegistryEndpoint) => e.path === h.endpoint) &&
              h.status === 'failed',
          ).length;

          return (
            <Accordion key={category} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getCategoryIcon(category)}
                  <Typography
                    variant="h6"
                    sx={{ textTransform: 'capitalize', color: theming.colors.primary }}
                  >
                    {category} APIs ({endpointsArray.length})
                  </Typography>
                  <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    {healthyCount > 0 && (
                      <StatusChip tone="success" label={`${healthyCount} healthy`} />
                    )}
                    {failedCount > 0 && (
                      <StatusChip tone="error" label={`${failedCount} failed`} />
                    )}
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                <AdminTableContainer ariaLabel={`${category} API-endepunkter`}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Endpoint</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Response Time</TableCell>
                        <TableCell>Status Code</TableCell>
                        <TableCell>Description</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {endpointsArray.map((endpoint: RegistryEndpoint) => {
                        const health = healthEndpoints.find(
                          (h) => h.endpoint === endpoint.path,
                        );
                        return (
                          <TableRow key={`${endpoint.method}-${endpoint.path}`}>
                            <TableCell>
                              <Tooltip title={health?.error || health?.status || 'Unknown'}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  {health ? (
                                    getStatusIcon(health.status)
                                  ) : (
                                    <Error sx={{ color: '#9e9e9e' }} />
                                  )}
                                </Box>
                              </Tooltip>
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {endpoint.path}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Chip
                                size="small"
                                label={endpoint.method}
                                sx={{
                                  backgroundColor:
                                    endpoint.method === 'GET'
                                      ? '#2196f3'
                                      : endpoint.method === 'POST'
                                        ? '#4caf50'
                                        : endpoint.method === 'PUT'
                                          ? '#ff9800'
                                          : endpoint.method === 'DELETE'
                                            ? '#f44336'
                                            : '#9e9e9e',
                                  color: 'white',
                                  fontSize: '0.7rem'}}
                              />
                            </TableCell>

                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: health
                                    ? health.responseTime > 1000
                                      ? '#f44336'
                                      : health.responseTime > 500
                                        ? '#ff9800'
                                        : '#4caf50' : 'inherit'}}
                              >
                                {health ? formatResponseTime(health.responseTime) : '-'}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2">{health?.statusCode ?? '-'}</Typography>
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {endpoint.description}
                                {endpoint.critical && (
                                  <Chip
                                    size="small"
                                    label="Critical"
                                    sx={{
                                      ml: 1,
                                      backgroundColor: '#f44336',
                                      color: 'white',
                                      fontSize:'0.6rem'}}
                                  />
                                )}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </AdminTableContainer>
              </AccordionDetails>
            </Accordion>
          );
        })}
    </Box>
  );
};

export default APIEndpointMonitor;
