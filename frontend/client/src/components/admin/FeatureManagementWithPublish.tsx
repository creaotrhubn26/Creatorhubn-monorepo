import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Badge,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  type ChipProps,
} from '@mui/material';
import {
  Publish,
  Undo,
  History,
  Compare,
  Emergency,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  Refresh,
  CloudUpload,
  CloudDownload,
  Timeline,
  Settings,
  Visibility,
  VisibilityOff,
  Search as SearchIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { AdminButton, AdminTableContainer, useIsMobile } from './design-system';

interface FeatureFlag {
  id: string;
  featureName: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  environment: 'staging' | 'production';
  publishedAt: string;
  publishedBy: string;
  version: number;
  metadata: any;
}

interface PublishHistory {
  version: number;
  publishedAt: string;
  publishedBy: string;
  flagCount: number;
  metadata: any;
}

interface EnvironmentDiff {
  featureName: string;
  staging: { enabled: boolean; rolloutPercentage: number };
  production: { enabled: boolean; rolloutPercentage: number };
  status: 'new_in_staging' | 'missing_in_staging' | 'different' | 'same';
}

interface FeatureFlagsResponse {
  flags: FeatureFlag[];
}

interface HistoryResponse {
  history: PublishHistory[];
}

interface EnvironmentDiffResponse {
  summary?: {
    newInStaging: number;
    missingInStaging: number;
    different: number;
    same: number;
  };
  diff: EnvironmentDiff[];
}

export default function FeatureManagementWithPublish() {
  const [tabValue, setTabValue] = useState(0);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<'staging' | 'production'>('staging');
  const [publishMetadata, setPublishMetadata] = useState('');
  const [revertReason, setRevertReason] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [search, setSearch] = useState('');

  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const isMobile = useIsMobile();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Fetch current feature flags for staging
  const { data: stagingFlags, isLoading: stagingLoading } = useQuery<FeatureFlagsResponse>({
    queryKey: ['/api/feature-flags/status/staging'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/status/staging', { headers });
    },
    refetchInterval: 3000, // Refresh every 30 seconds
});

  // Fetch current feature flags for production
  const { data: productionFlags, isLoading: productionLoading } = useQuery<FeatureFlagsResponse>({
    queryKey: ['/api/feature-flags/status/production', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/status/production', { headers });
    },
    refetchInterval: 3000,
});

  // Fetch publish history
  const { data: stagingHistory } = useQuery<HistoryResponse>({
    queryKey: ['/api/feature-flags/history/staging', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/history/staging', { headers });
    },
});

  const { data: productionHistory } = useQuery<HistoryResponse>({
    queryKey: ['/api/feature-flags/history/production', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/history/production', { headers });
    },
});

  // Fetch environment differences
  const { data: environmentDiff } = useQuery<EnvironmentDiffResponse>({
    queryKey: ['/api/feature-flags/diff/staging-production', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/diff/staging-production', { headers });
    },
});

  // Publish to staging mutation
  const publishToStaging = useMutation({
    mutationFn: async (data: { featureFlags: any[]; publishedBy: string; metadata: any }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/publish/staging', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/status/staging', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/history/staging', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/diff/staging-production', ],});
      setPublishDialogOpen(false);
  },
});

  // Promote to production mutation
  const promoteToProduction = useMutation({
    mutationFn: async (data: { publishedBy: string; metadata: any }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/promote/production', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/status/production', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/history/production', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/diff/staging-production', ],});
  },
});

  // Revert mutation
  const revertFlags = useMutation({
    mutationFn: async (data: { environment: string; publishedBy: string; revertToVersion?: number }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/feature-flags/revert/${data.environment}`, {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/status/staging', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/status/production', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/history/staging', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/history/production', ],});
      setRevertDialogOpen(false);
  },
});

  // Emergency rollback mutation
  const emergencyRollback = useMutation({
    mutationFn: async (data: { publishedBy: string; reason: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/feature-flags/emergency-rollback', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/status/production', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags/history/production', ],});
      setEmergencyDialogOpen(false);
  },
});

  const handlePublishToStaging = () => {
    const currentFlags = Array.isArray(stagingFlags?.flags) ? stagingFlags.flags : [];
    publishToStaging.mutate({
      featureFlags: currentFlags,
      publishedBy: 'admin', // In real app, get from auth context
      metadata: { notes: publishMetadata, timestamp: new Date().toISOString() },
  });
};

  const handlePromoteToProduction = () => {
    promoteToProduction.mutate({
      publishedBy: 'admin',
      metadata: { notes: publishMetadata, timestamp: new Date().toISOString() },
  });
};

  const handleRevert = () => {
    revertFlags.mutate({
      environment: selectedEnvironment,
      publishedBy: 'admin',
      revertToVersion: undefined, // Revert to previous version
  });
};

  const handleEmergencyRollback = () => {
    emergencyRollback.mutate({
      publishedBy: 'admin',
      reason: emergencyReason,
  });
};

  const getStatusColor = (status: EnvironmentDiff['status']): ChipProps['color'] => {
    switch (status) {
      case 'new_in_staging': return 'success';
      case 'missing_in_staging': return 'error';
      case 'different': return 'warning';
      case 'same': return 'default';
      default: return 'default';
}
};

  const getStatusIcon = (status: EnvironmentDiff['status']) => {
    switch (status) {
      case 'new_in_staging': return <CheckCircle />;
      case 'missing_in_staging': return <Error />;
      case 'different': return <Warning />;
      case 'same': return <Info />;
      default: return <Info />;
  }
};

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" component="h2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {theming.getThemedIcon('settings')}
        Feature Flag Management & Deployment
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
        Manage feature flags across staging and production environments with publish/revert capabilities.
      </Typography>

      {/* Action Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <AdminButton tone="primary"
          startIcon={<Publish />}
          onClick={() => setPublishDialogOpen(true)}
          disabled={publishToStaging.isPending}
        >
          Publish to Staging
        </AdminButton>
        <AdminButton tone="primary"
          startIcon={theming.getThemedIcon('cloudUpload')}
          onClick={handlePromoteToProduction}
          loading={promoteToProduction.isPending}
          disabled={promoteToProduction.isPending || !stagingFlags?.flags?.length}
        >
          Promote to Production
        </AdminButton>
        <AdminButton
          tone="ghost"
          startIcon={theming.getThemedIcon('undo')}
          onClick={() => setRevertDialogOpen(true)}
          disabled={revertFlags.isPending}
        >
          Revert
        </AdminButton>
        <AdminButton
          tone="danger"
          startIcon={<Emergency />}
          onClick={() => setEmergencyDialogOpen(true)}
          disabled={emergencyRollback.isPending}
        >
          Emergency Rollback
        </AdminButton>
        <AdminButton
          tone="ghost"
          startIcon={theming.getThemedIcon('refresh')}
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/feature-flags'] });
          }}
        >
          Refresh
        </AdminButton>
      </Box>

      {/* Environment Status Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
                <Typography variant="h6" component="h3" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <CloudUpload color="primary" aria-hidden="true" />
                  Staging Environment
                </Typography>
                <Chip label="Latest" color="primary" size="small" />
              </Box>
              {stagingLoading ? (
                <LinearProgress />
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                    {stagingFlags?.flags?.length || 0} feature flags
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last updated: {stagingFlags?.flags?.[0]?.publishedAt ? 
                      new Date(stagingFlags.flags[0].publishedAt).toLocaleString() : 'Never'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
                <Typography variant="h6" component="h3" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                  <CloudDownload color="success" aria-hidden="true" />
                  Production Environment
                </Typography>
                <Chip label="Live" color="success" size="small" />
              </Box>
              {productionLoading ? (
                <LinearProgress />
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                    {productionFlags?.flags?.length || 0} feature flags
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last updated: {productionFlags?.flags?.[0]?.publishedAt ? 
                      new Date(productionFlags.flags[0].publishedAt).toLocaleString() : 'Never'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Card sx={theming.getThemedCardSx()}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider'}}
        >
          <Tab label="Environment Comparison" icon={<Compare />} />
          <Tab label="Publish History" icon={<History />} />
          <Tab label="Feature Flags" icon={<Settings />} />
        </Tabs>

        {/* Environment Comparison Tab */}
        {tabValue === 0 && (
          <Box sx={{ p:  3 }}>
            <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
              Staging vs Production Differences
            </Typography>
            {environmentDiff?.summary && (
              <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`${environmentDiff.summary.newInStaging} new in staging`}
                  color="success"
                  icon={<CheckCircle />}
                />
                <Chip
                  label={`${environmentDiff.summary.missingInStaging} missing in staging`}
                  color="error"
                  icon={<Error />}
                />
                <Chip
                  label={`${environmentDiff.summary.different} different`}
                  color="warning"
                  icon={<Warning />}
                />
                <Chip
                  label={`${environmentDiff.summary.same} same`}
                  color="default"
                  icon={<Info />}
                />
              </Box>
            )}
            <AdminTableContainer ariaLabel="Staging vs Production differences">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Feature Name</TableCell>
                    <TableCell>Staging</TableCell>
                    <TableCell>Production</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(environmentDiff?.diff) ? environmentDiff.diff : []).map((item: EnvironmentDiff) => (
                    <TableRow key={item.featureName}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500}}>
                          {item.featureName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          {item.staging.enabled ? <Visibility color="success" /> : <VisibilityOff color="error" />}
                          <Typography variant="body2">
                            {item.staging.enabled ? 'Enabled' : 'Disabled'} ({item.staging.rolloutPercentage}%)
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          {item.production.enabled ? <Visibility color="success" /> : <VisibilityOff color="error" />}
                          <Typography variant="body2">
                            {item.production.enabled ? 'Enabled' : 'Disabled'} ({item.production.rolloutPercentage}%)
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.status.replace(/_/g, ' ')}
                          color={getStatusColor(item.status)}
                          icon={getStatusIcon(item.status)}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </Box>
        )}

        {/* Publish History Tab */}
        {tabValue === 1 && (
          <Box sx={{ p:  3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
                  Staging History
                </Typography>
                {(Array.isArray(stagingHistory?.history) ? stagingHistory.history : []).map((entry: PublishHistory) => (
                  <Accordion key={entry.version}>
                    <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500}}>
                          Version {entry.version}
                        </Typography>
                        <Chip label={entry.flagCount} size="small" />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(entry.publishedAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" color="text.secondary">
                        Published by: {entry.publishedBy}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Flags: {entry.flagCount}
                      </Typography>
                      {entry.metadata?.notes && (
                        <Typography variant="body2" color="text.secondary">
                          Notes: {entry.metadata.notes}
                        </Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
                  Production History
                </Typography>
                {(Array.isArray(productionHistory?.history) ? productionHistory.history : []).map((entry: PublishHistory) => (
                  <Accordion key={entry.version}>
                    <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500}}>
                          Version {entry.version}
                        </Typography>
                        <Chip label={entry.flagCount} size="small" />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(entry.publishedAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" color="text.secondary">
                        Published by: {entry.publishedBy}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Flags: {entry.flagCount}
                      </Typography>
                      {entry.metadata?.notes && (
                        <Typography variant="body2" color="text.secondary">
                          Notes: {entry.metadata.notes}
                        </Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Feature Flags Tab */}
        {tabValue === 2 && (
          <Box sx={{ p:  3 }}>
            <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
              Current Feature Flags
            </Typography>
            <TextField
              size="small"
              placeholder="Søk i feature flags …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Grid container spacing={2}>
              {(Array.isArray(stagingFlags?.flags) ? stagingFlags.flags : [])
                .filter((flag: FeatureFlag) => flag.featureName.toLowerCase().includes(search.toLowerCase()))
                .map((flag: FeatureFlag) => (
                <Grid item xs={12} sm={6} md={4} key={flag.id}>
                  <Card variant="outlined" sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {flag.featureName}
                        </Typography>
                        <Chip
                          label={flag.isEnabled ? 'Enabled' : 'Disabled'}
                          color={flag.isEnabled ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        Rollout: {flag.rolloutPercentage}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Version {flag.version} • {new Date(flag.publishedAt).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Card>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Publish to Staging</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Publish Notes"
            value={publishMetadata}
            onChange={(e) => setPublishMetadata(e.target.value)}
            sx={{ mt:  2 }}
            placeholder="Describe what changes you're publishing..."
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setPublishDialogOpen(false)}>Cancel</AdminButton>
          <AdminButton tone="primary" onClick={handlePublishToStaging} loading={publishToStaging.isPending} disabled={publishToStaging.isPending}>
            {publishToStaging.isPending ? 'Publishing...' : 'Publish'}
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* Revert Dialog */}
      <Dialog open={revertDialogOpen} onClose={() => setRevertDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Revert Feature Flags</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Environment</InputLabel>
            <Select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value as 'staging' | 'production')}
              aria-label="Miljø"
            >
              <MenuItem value="staging">Staging</MenuItem>
              <MenuItem value="production">Production</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Revert Reason"
            value={revertReason}
            onChange={(e) => setRevertReason(e.target.value)}
            placeholder="Why are you reverting these changes?"
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setRevertDialogOpen(false)}>Cancel</AdminButton>
          <Button onClick={handleRevert} variant="contained" color="warning" disabled={revertFlags.isPending} sx={theming.getThemedButtonSx()}>
            {revertFlags.isPending ? 'Reverting...' : 'Revert'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Emergency Rollback Dialog */}
      <Dialog open={emergencyDialogOpen} onClose={() => setEmergencyDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ color: 'error.main'}}>Emergency Rollback</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb:  2 }}>
            This will immediately revert all production feature flags to the last known safe state.
            Use only in case of critical issues.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Emergency Reason"
            value={emergencyReason}
            onChange={(e) => setEmergencyReason(e.target.value)}
            placeholder="Describe the critical issue requiring emergency rollback..."
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setEmergencyDialogOpen(false)}>Cancel</AdminButton>
          <AdminButton tone="danger" onClick={handleEmergencyRollback} loading={emergencyRollback.isPending} disabled={emergencyRollback.isPending}>
            {emergencyRollback.isPending ? 'Rolling back...' : 'Emergency Rollback'}
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


