/**
 * CreatorHub Norge - Deployment Pipeline
 * Advanced deployment management with blue-green deployment and rollback capabilities
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Grid,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CloudUpload as DeployIcon,
  History as RollbackIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Storage as DatabaseIcon,
  MonitorHeart as MonitorIcon,
  Code as CodeIcon,
  BugReport as TestIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { AdminCard, AdminButton, StatusChip, AdminTableContainer, adminTokens } from './design-system';

interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  logs?: string[];
  errorMessage?: string;
}

interface Deployment {
  id: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolling_back';
  startTime: string;
  endTime?: string;
  duration?: number;
  initiatedBy: string;
  commitHash: string;
  steps: DeploymentStep[];
  rollbackAvailable: boolean;
  healthChecksPassed: boolean;
}

interface EnvironmentHealth {
  environment: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  uptime: number;
  responseTime: number;
  errorRate: number;
  lastHealthCheck: string;
  services: {
    database: 'healthy' | 'warning' | 'critical';
    apis: 'healthy' | 'warning' | 'critical';
    frontend: 'healthy' | 'warning' | 'critical';
  };
}

interface DeploymentsResponse {
  deployments: Deployment[];
}

interface DeploymentHealthResponse {
  environments: EnvironmentHealth[];
}

export default function DeploymentPipeline() {
  const { toast } = useToast();

  // Theming system
  const theming = useTheming('prototype_tester');
  const queryClient = useQueryClient();

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // State management
  const [selectedEnvironment, setSelectedEnvironment] = useState('staging');
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);

  // Fetch data
  const fetchWithAuth = async (url: string) => {
    const headers = await auth.getAuthHeader();
    return apiRequest(url, { headers });
  };

  // Fetch deployments
  const { data: deploymentsData, isLoading: deploymentsLoading } = useQuery<DeploymentsResponse>({
    queryKey: ['/api/admin/deployment/history', ],
    queryFn: () => fetchWithAuth('/api/admin/deployment/history'),
    staleTime: 1000,
    refetchInterval: 5000 // Refresh every 5 seconds for real-time updates
});

  // Fetch environment health
  const { data: healthData, isLoading: healthLoading } = useQuery<DeploymentHealthResponse>({
    queryKey: ['/api/admin/deployment/health', ],
    queryFn: () => fetchWithAuth('/api/admin/deployment/health'),
    staleTime: 1000,
    refetchInterval: 10000 // Refresh every 10 seconds
});

  // Use real data from APIs - no mock data

  // Start deployment mutation
  const startDeploymentMutation = useMutation({
    mutationFn: async ({ environment, version }: { environment: string; version: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/deployment/start', {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ environment, version })
    });
  },
    onSuccess: () => {
      setDeploymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deployment/history']});
      toast({
        title: "Deployment startet",
        description: "Deployment pipeline er i gang",
    });
  },
    onError: () => {
      toast({
        title: "Deployment feilet",
        description: "Kunne ikke starte deployment",
        variant: "destructive",
    });
  }
});

  // Rollback deployment mutation
  const rollbackMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/deployment/${deploymentId}/rollback`, {
        headers,
        method: 'POST'
  });
  },
    onSuccess: () => {
      setRollbackDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deployment/history', ]});
      toast({
        title: "Rollback startet",
        description: "Rollback til forrige versjon er i gang",
    });
  },
    onError: () => {
      toast({
        title: "Rollback feilet",
        description: "Kunne ikke starte rollback",
        variant: "destructive",
    });
  }
});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      case 'pending': return 'default';
      case 'rolling_back': return 'warning';
      default: return 'default';
}
};

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      case 'offline': return 'default';
      default: return 'default';
}
};

  const getStepIcon = (stepId: string) => {
    switch (stepId) {
      case 'pre-deploy-tests': return <TestIcon />;
      case 'database-migration': return <DatabaseIcon />;
      case 'build-deploy': return <CodeIcon />;
      case 'health-checks': return <MonitorIcon />;
      default: return <PlayIcon />;
}
};

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
};

  return (
    <Box sx={{ p: { xs: 2, sm:  3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{  color: adminTokens.color.brand, fontWeight: 600}}>
          🚀 Deployment Pipeline
        </Typography>
        <Box sx={{ display: 'flex', gap:  2 }}>
          <AdminButton
            tone="ghost"
            startIcon={<RefreshIcon />}
            onClick={() => queryClient.invalidateQueries()}
          >
            Oppdater
          </AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<DeployIcon />}
            onClick={() => setDeploymentDialogOpen(true)}
          >
            Ny Deployment
          </AdminButton>
        </Box>
      </Box>

      {(deploymentsLoading || healthLoading) && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Environment Health Status */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        {(Array.isArray(healthData?.environments) ? healthData.environments : []).map((health) => (
          <Grid item xs={12} md={4} key={health.environment}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                  <Typography variant="h6" sx={{  flex: 1, textTransform: 'capitalize' }}>
                    {health.environment}
                  </Typography>
                  <Chip 
                    label={health.status}
                    color={getHealthStatusColor(health.status) as any}
                    size="small"
                  />
                </Box>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Uptime</Typography>
                    <Typography variant="h6" sx={{ color: health.uptime > 99 ? '#4caf50' : '#ff9800' }}>
                      {health.uptime}%
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Response</Typography>
                    <Typography variant="h6" sx={{  color: health.responseTime < 200 ? '#4caf50' : '#ff9800' }}>
                      {health.responseTime}ms
                    </Typography>
                  </Grid>
                </Grid>

                <Box sx={{ mt:  2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                    Services
                  </Typography>
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <Chip 
                      label="DB" 
                      size="small" 
                      color={getHealthStatusColor(health.services.database) as any}
                    />
                    <Chip 
                      label="API" 
                      size="small" 
                      color={getHealthStatusColor(health.services.apis) as any}
                    />
                    <Chip 
                      label="Frontend" 
                      size="small" 
                      color={getHealthStatusColor(health.services.frontend) as any}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Deployments */}
      <AdminCard title="📊 Recent Deployments" disablePadding sx={{ mb: 4, ...theming.getThemedCardSx() }}>
          <AdminTableContainer ariaLabel="Nylige deployments">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Version</TableCell>
                  <TableCell>Environment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Initiated By</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(deploymentsData?.deployments) ? deploymentsData.deployments : []).map((deployment) => (
                  <TableRow key={deployment.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {deployment.version}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {deployment.commitHash}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={deployment.environment}
                        size="small"
                        color={deployment.environment === 'production' ? 'error' : 'primary'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Chip 
                          label={deployment.status}
                          color={getStatusColor(deployment.status) as any}
                          size="small"
                        />
                        {deployment.status === 'running' && (
                          <LinearProgress 
                            sx={{ width:  60, height:  4 }}
                            variant="indeterminate"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(deployment.startTime).toLocaleString('no-NO')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {deployment.duration ? formatDuration(deployment.duration) : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {deployment.initiatedBy}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap:  1 }}>
                        {deployment.rollbackAvailable && (
                          <Tooltip title="Rollback">
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setSelectedDeployment(deployment.id);
                                setRollbackDialogOpen(true);
                            }}
                            >
                              <RollbackIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small"
                            onClick={() => setSelectedDeployment(deployment.id)}
                          >
                            <TimelineIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableContainer>
        </AdminCard>

      {/* Deployment Steps Timeline */}
      {selectedDeployment && (
        <Card sx={{ mb: 4, ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{  mb:  3  }}>
              📋 Deployment Steps - {(Array.isArray(deploymentsData?.deployments) ? deploymentsData.deployments : []).find(d => d.id === selectedDeployment)?.version}
            </Typography>
            
            <Stepper orientation="vertical">
              {((Array.isArray(deploymentsData?.deployments) ? deploymentsData.deployments : []).find(d => d.id === selectedDeployment)?.steps || []).map((step) => (
                <Step key={step.id} active={step.status !== 'pending'} completed={step.status === 'completed'}>
                  <StepLabel 
                    error={step.status === 'failed'}
                    icon={getStepIcon(step.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                      <Typography variant="body1" fontWeight={600}>
                        {step.name}
                      </Typography>
                      <Chip 
                        label={step.status}
                        color={getStatusColor(step.status) as any}
                        size="small"
                      />
                      {step.duration && (
                        <Typography variant="caption" color="text.secondary">
                          {formatDuration(step.duration)}
                        </Typography>
                      )}
                    </Box>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                      {step.description}
                    </Typography>
                    {step.errorMessage && (
                      <Alert severity="error" sx={{ mt:  1 }}>
                        {step.errorMessage}
                      </Alert>
                    )}
                    {step.logs && step.logs.length > 0 && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f0', borderRadius:  1 }}>
                        <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace'}}>
                          {step.logs.join('\n')}
                        </Typography>
                      </Box>
                    )}
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      )}

      {/* New Deployment Dialog */}
      <Dialog 
        open={deploymentDialogOpen}
        onClose={() => setDeploymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DeployIcon sx={{ color: adminTokens.color.brand }} />
            Start New Deployment
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Environment</InputLabel>
                <Select
                  value={selectedEnvironment}
                  onChange={(e) => setSelectedEnvironment(e.target.value)}
                  label="Environment"
                >
                  <MenuItem value="development">Development</MenuItem>
                  <MenuItem value="staging">Staging</MenuItem>
                  <MenuItem value="production">Production</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                Deployment vil automatisk kjøre alle nødvendige tester og health checks.
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setDeploymentDialogOpen(false)}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={() => startDeploymentMutation.mutate({
              environment: selectedEnvironment,
              version: 'v4.1.2'
        })}
            loading={startDeploymentMutation.isPending}
            disabled={startDeploymentMutation.isPending}
          >
            {startDeploymentMutation.isPending ? 'Starter...' : 'Start Deployment'}
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* Rollback Dialog */}
      <Dialog 
        open={rollbackDialogOpen}
        onClose={() => setRollbackDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <RollbackIcon sx={{ color: adminTokens.color.error }} />
            Rollback Deployment
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb:  2 }}>
            Dette vil rulle tilbake til forrige stabile versjon. Handlingen kan ikke angres.
          </Alert>
          <Typography variant="body1">
            Er du sikker på at du vil rulle tilbake deployment{''}
            <strong>{(Array.isArray(deploymentsData?.deployments) ? deploymentsData.deployments : []).find(d => d.id === selectedDeployment)?.version}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setRollbackDialogOpen(false)}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="danger"
            onClick={() => selectedDeployment && rollbackMutation.mutate(selectedDeployment)}
            loading={rollbackMutation.isPending}
            disabled={rollbackMutation.isPending}
          >
            {rollbackMutation.isPending ? 'Ruller tilbake...' : 'Rollback'}
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
