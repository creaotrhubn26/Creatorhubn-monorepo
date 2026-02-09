import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Stack,
  CircularProgress
} from '@mui/material';
import { Notifications, NotificationsActive, Refresh } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface AnalyticsDashboardProps {
  profession?: string;
}

interface AnalyticsSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalRevenue: number;
  totalClients: number;
  averageProjectValue: number;
  lastUpdated: string;
}

export default function AnalyticsDashboard({ profession }: AnalyticsDashboardProps = {}) {
  const { communication, dataFlow, componentRegistry, features, analytics } =
    useEnhancedMasterIntegration();

  const { user } = useAuth();
  const userProfession = profession || user?.profession || 'photographer';
  const userId = user?.id || user?.sub || '';

  const theming = useTheming(userProfession);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);

  const { pushEnabled, isSupported } = usePushNotifications(userId);
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const featureStates = useMemo(
    () => [
      { key: 'analytics-dashboard', label: 'Dashboard', enabled: features.checkFeatureAccess('analytics-dashboard') },
      { key: 'analytics', label: 'Analytics', enabled: features.checkFeatureAccess('analytics') },
      { key: 'reporting', label: 'Rapportering', enabled: features.checkFeatureAccess('reporting') },
      { key: 'business-intelligence', label: 'BI', enabled: features.checkFeatureAccess('business-intelligence') },
      { key: 'data-visualization', label: 'Visualisering', enabled: features.checkFeatureAccess('data-visualization') },
      { key: 'metrics-tracking', label: 'Metrikk', enabled: features.checkFeatureAccess('metrics-tracking') },
      { key: 'performance-monitoring', label: 'Ytelse', enabled: features.checkFeatureAccess('performance-monitoring') },
      { key: 'user-engagement', label: 'Engasjement', enabled: features.checkFeatureAccess('user-engagement') }
    ],
    [features]
  );

  const {
    data: summary,
    isLoading,
    refetch
  } = useQuery<AnalyticsSummary>({
    queryKey: ['/api/analytics/summary', { profession: userProfession, userId }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/summary?profession=${encodeURIComponent(userProfession)}&userId=${encodeURIComponent(
          userId
        )}`
      ),
    enabled: Boolean(userId)
  });

  useEffect(() => {
    const metadataId = 'analytics-dashboard';
    const nodeIds: string[] = [];

    communication.registerComponent(metadataId, 'dashboard', [
      'data:read',
      'data:write',
      'event:emit',
      'event:listen',
      'ui:update',
      'analytics:track',
      'metrics:manage',
      'reporting:manage'
    ]);

    componentRegistry.registerComponent({
      id: metadataId,
      name: 'Analytics Dashboard',
      type: 'dashboard',
      category: 'analytics',
      profession: userProfession,
      capabilities: ['data:analyze', 'metrics:track', 'reporting:export'],
      dependencies: [],
      props: ['profession'],
      events: ['data:sync'],
      dataKeys: ['analytics-summary']
    });

    nodeIds.push(
      dataFlow.registerNode({
        type: 'source',
        componentId: metadataId,
        dataKey: 'analytics-summary',
        transform: (data) => ({ ...data, lastUpdated: new Date().toISOString() })
      })
    );

    analytics.trackEvent('analytics-dashboard.opened', {
      profession: userProfession,
      userId
    });

    return () => {
      communication.unregisterComponent(metadataId);
      componentRegistry.unregisterComponent(metadataId);
      nodeIds.forEach((id) => dataFlow.unregisterNode(id));
    };
  }, [analytics, communication, componentRegistry, dataFlow, userId, userProfession]);

  useEffect(() => {
    if (summary) {
      dataFlow.syncData('analytics-summary', summary);
    }
  }, [dataFlow, summary]);

  useEffect(() => {
    const unsubscribe = communication.onMessage((message) => {
      if (message.type === 'data:sync' && message.data?.dataKey === 'analytics-summary') {
        analytics.trackEvent('analytics-dashboard.synced', {
          profession: userProfession,
          userId
        });
      }
    });

    return unsubscribe;
  }, [analytics, communication, userId, userProfession]);

  const featureAnalytics = features.getFeatureAnalytics();
  const featureCoverage = featureAnalytics.totalFeatures
    ? Math.round(featureAnalytics.featureAdoptionRate * 100)
    : 0;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          {professionConfig
            ? `${professionConfig.displayName} - Analyse Dashboard`
            : 'Analyse Dashboard'}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Oppdater oversikt">
            <IconButton onClick={() => refetch()} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          {isSupported && (
            <Tooltip title="Push-varsler innstillinger">
              <IconButton
                onClick={() => setPushSettingsOpen(true)}
                color={pushEnabled ? 'primary' : 'default'}
              >
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {professionConfig && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Ytelsesanalyse og statistikk for {professionConfig.displayName.toLowerCase()}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Features: {featureAnalytics.enabledFeatures}/{featureAnalytics.totalFeatures}
        </Typography>
        <Chip
          label={`${featureCoverage}%`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '10px', height: 18 }}
        />
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Laster dashboard-data...</Typography>
        </Box>
      )}
      {professionsLoading && <Typography variant="body2">Laster profesjonsdata...</Typography>}

      {summary && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {[
            { label: 'Prosjekter', value: summary.totalProjects },
            { label: 'Aktive', value: summary.activeProjects },
            { label: 'Fullfort', value: summary.completedProjects },
            { label: 'Omsetning', value: summary.totalRevenue.toLocaleString('nb-NO') },
            { label: 'Klienter', value: summary.totalClients },
            { label: 'Snittverdi', value: summary.averageProjectValue.toLocaleString('nb-NO') }
          ].map((metric) => (
            <Grid item xs={12} sm={6} md={4} key={metric.label}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    {metric.label}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.5 }}>
                    {metric.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Funksjonsdekning
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
          {featureStates.map((feature) => (
            <Chip
              key={feature.key}
              label={feature.label}
              color={feature.enabled ? 'success' : 'default'}
              variant={feature.enabled ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Stack>
      </Box>

      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}