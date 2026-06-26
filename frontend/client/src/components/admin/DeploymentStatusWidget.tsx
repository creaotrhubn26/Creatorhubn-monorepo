import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  Grid,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CloudUpload,
  CloudDownload,
  CheckCircle,
  Error,
  Warning,
  Refresh,
  Timeline,
  Compare,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface DeploymentStatusWidgetProps {
  onOpenFeatureManagement?: () => void;
}

export default function DeploymentStatusWidget({ onOpenFeatureManagement }: DeploymentStatusWidgetProps) {
  // Theming system
  const theming = useTheming('prototype_tester');
  const { auth } = useEnhancedMasterIntegration();

  // Fetch deployment status
  const { data: stagingStatus, isLoading: stagingLoading } = useQuery({
    queryKey: ['/api/feature-flags/status/staging'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/status/staging', { headers });
    },
    refetchInterval: 30000
});

  const { data: productionStatus, isLoading: productionLoading } = useQuery({
    queryKey: ['/api/feature-flags/status/production'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/status/production', { headers });
    },
    refetchInterval: 30000
});

  const { data: environmentDiff } = useQuery({
    queryKey: ['/api/feature-flags/diff/staging-production'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/diff/staging-production', { headers });
    }
});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new_in_staging': return 'success';
      case 'missing_in_staging': return 'error';
      case 'different': return 'warning';
      case 'same': return 'default';
      default: return 'default';
  }
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new_in_staging': return <CheckCircle />;
      case 'missing_in_staging': return <Error />;
      case 'different': return <Warning />;
      case 'same': return <CheckCircle />;
      default: return <CheckCircle />;
  }
};

  const hasDifferences = environmentDiff?.summary && (
    environmentDiff.summary.newInStaging > 0 ||
    environmentDiff.summary.missingInStaging > 0 ||
    environmentDiff.summary.different > 0
  );

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            {theming.getThemedIcon('timeline')}
            Deployment Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Status">
              <IconButton size="small" onClick={() => window.location.reload()}>
                {theming.getThemedIcon('refresh')}
              </IconButton>
            </Tooltip>
            {onOpenFeatureManagement && (
              <Tooltip title="Open Feature Management">
                <IconButton size="small" onClick={onOpenFeatureManagement}>
                  <Compare />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Environment Status */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                <CloudUpload color="primary" />
                <Typography variant="subtitle2">Staging</Typography>
              </Box>
              {stagingLoading ? (
                <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
              ) : (
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {stagingStatus?.flags?.length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    feature flags
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                <CloudDownload color="success" />
                <Typography variant="subtitle2">Production</Typography>
              </Box>
              {productionLoading ? (
                <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
              ) : (
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {productionStatus?.flags?.length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    feature flags
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Differences Alert */}
        {hasDifferences && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }}
            action={
              onOpenFeatureManagement && (
                <Chip
                  label="Review"
                  size="small"
                  onClick={onOpenFeatureManagement}
                  sx={{ cursor: 'pointer' }}
                />
              )
          }
          >
            <Typography variant="body2">
              {environmentDiff.summary.newInStaging} new, {environmentDiff.summary.different} different, {environmentDiff.summary.missingInStaging} missing
            </Typography>
          </Alert>
        )}

        {/* Recent Changes */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Recent Changes
          </Typography>
          {(Array.isArray(environmentDiff?.diff) ? environmentDiff.diff : []).slice(0, 3).map((item: any, index: number) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                icon={getStatusIcon(item.status)}
                label={item.status.replace('_', ', ')}
                color={getStatusColor(item.status)}
                size="small"
                sx={{ minWidth: 100 }}
              />
              <Typography variant="body2" sx={{ flex: 1, fontSize: '0.75rem' }}>
                {item.featureName}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Quick Actions */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="Staging"
            size="small"
            color="primary"
            variant="outlined"
icon={<CloudUpload />}
          />
          <Chip
            label="Production"
            size="small"
            color="success"
            variant="outlined"
icon={<CloudDownload />}
          />
          {hasDifferences && (
            <Chip
              label="Needs Review"
              size="small"
              color="warning"
icon={<Warning />}
            />
          )}
        </Box>

        {/* Last Updated */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Last updated: {new Date().toLocaleTimeString()}
        </Typography>
      </CardContent>
    </Card>
  );
}



