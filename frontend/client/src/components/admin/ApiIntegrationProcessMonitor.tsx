/**
 * CreatorHub Norge - API Integration Process Monitor
 * Visual monitor for 10-step API integration lifecycle + developer flow.
 */

import React, { useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Api as ApiIcon,
  Build as BuildIcon,
  HealthAndSafety as HealthIcon,
  Map as MapIcon,
  Router as ProxyIcon,
  Visibility as VisibilityIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Shield as ShieldIcon,
  Analytics as AnalyticsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Code as CodeIcon,
  Science as ScienceIcon,
  AutoAwesome as AutoIcon,
  Sync as SyncIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Timeline as TimelineIcon,
  CloudDone as CloudDoneIcon,
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { useTheming } from '../../utils/theming-helper';
import { AdminButton, StatusChip, useIsMobile } from './design-system';

type StepStatus = 'pending' | 'active' | 'completed' | 'error';
type ProcessStatus = 'initializing' | 'processing' | 'completed' | 'failed';

interface IntegrationStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  details: string[];
  apiCalls: string[];
  duration?: number;
}

interface ApiIntegrationProcess {
  service: string;
  totalSteps: number;
  currentStep: number;
  status: ProcessStatus;
  startTime: string;
  steps: IntegrationStep[];
  devSteps: IntegrationStep[];
}

interface StepTemplate {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
  apiCalls: string[];
}

const STANDARD_STEP_TEMPLATES: StepTemplate[] = [
  {
    id: 1,
    title: 'API Key Registration',
    description: 'Register and validate API keys for the selected provider.',
    icon: <ApiIcon />,
    details: [
      'API key validated and encrypted',
      'Provider config persisted',
      'Permissions and scopes verified',
    ],
    apiCalls: ['POST /api/admin/integrations/keys'],
  },
  {
    id: 2,
    title: 'Service Health Check',
    description: 'Probe connectivity and health for provider endpoints.',
    icon: <HealthIcon />,
    details: [
      'Connectivity checks passed',
      'Health endpoint validated',
      'Latency sampled',
    ],
    apiCalls: ['GET /api/admin/integrations/health/:service'],
  },
  {
    id: 3,
    title: 'Route Mapping',
    description: 'Map provider routes and normalize payload contracts.',
    icon: <MapIcon />,
    details: [
      'Inbound/outbound route map generated',
      'Schema compatibility validated',
      'Fallback route policy attached',
    ],
    apiCalls: ['POST /api/admin/integrations/routes/sync'],
  },
  {
    id: 4,
    title: 'Universal API Proxy',
    description: 'Enable proxy routes for frontend/backend integration.',
    icon: <ProxyIcon />,
    details: [
      'Proxy handlers registered',
      'Request/response transformations active',
      'Error mapping enabled',
    ],
    apiCalls: ['POST /api/integrations/:service/proxy/activate'],
  },
  {
    id: 5,
    title: 'Auto Discovery',
    description: 'Discover capabilities and feature toggles from provider.',
    icon: <VisibilityIcon />,
    details: [
      'Provider capabilities fetched',
      'Feature metadata normalized',
      'Compatibility mode assigned',
    ],
    apiCalls: ['GET /api/admin/integrations/:service/capabilities'],
  },
  {
    id: 6,
    title: 'Feature Availability',
    description: 'Wire feature access rules into the UI runtime.',
    icon: <BuildIcon />,
    details: [
      'Feature gate mappings loaded',
      'UI conditionals applied',
      'Progressive enhancement enabled',
    ],
    apiCalls: ['GET /api/integrations/features'],
  },
  {
    id: 7,
    title: 'Testing & Verification',
    description: 'Run provider-specific contract and behavior tests.',
    icon: <SecurityIcon />,
    details: [
      'Contract test suite executed',
      'Response payloads validated',
      'Error scenarios covered',
    ],
    apiCalls: ['POST /api/integrations/test-suite'],
  },
  {
    id: 8,
    title: 'Automatic Activation',
    description: 'Activate integration runtime without service restart.',
    icon: <SpeedIcon />,
    details: [
      'Zero-downtime activation confirmed',
      'Hot reload applied',
      'Runtime service registry updated',
    ],
    apiCalls: ['POST /api/admin/integrations/refresh'],
  },
  {
    id: 9,
    title: 'Security & Scaling',
    description: 'Enable production controls (limits, audit, safeguards).',
    icon: <ShieldIcon />,
    details: [
      'Rate limiting configured',
      'Audit logging enabled',
      'Security checks completed',
    ],
    apiCalls: ['GET /api/admin/security/audit'],
  },
  {
    id: 10,
    title: 'Business Intelligence',
    description: 'Attach analytics and integration performance monitoring.',
    icon: <AnalyticsIcon />,
    details: [
      'Usage events tracked',
      'Cost metrics enabled',
      'Performance telemetry online',
    ],
    apiCalls: ['GET /api/admin/analytics/integrations'],
  },
];

const DEVELOPER_STEP_TEMPLATES: StepTemplate[] = [
  {
    id: 11,
    title: 'Frontend Component Wiring',
    description: 'Connect provider UI and state hooks into dashboard surface.',
    icon: <CodeIcon />,
    details: [
      'Component props mapped',
      'Feature flags wired',
      'Error boundaries validated',
    ],
    apiCalls: ['client/src/components/admin/*'],
  },
  {
    id: 12,
    title: 'Proxy Contract Test',
    description: 'Validate proxy behavior against target provider contracts.',
    icon: <ScienceIcon />,
    details: [
      'Request transforms tested',
      'Response schema assertions passed',
      'Retry policies verified',
    ],
    apiCalls: ['POST /api/integrations/:service/test'],
  },
  {
    id: 13,
    title: 'Code Generation Sync',
    description: 'Sync generated clients/types with integration templates.',
    icon: <AutoIcon />,
    details: [
      'TypeScript contracts generated',
      'Runtime client regenerated',
      'Compatibility checks completed',
    ],
    apiCalls: ['POST /api/admin/integrations/templates/sync'],
  },
  {
    id: 14,
    title: 'WireMock / CI Sync',
    description: 'Keep mock server and CI scenarios aligned with provider.',
    icon: <SyncIcon />,
    details: [
      'Mock endpoints aligned',
      'Regression scenarios exported',
      'CI test matrix updated',
    ],
    apiCalls: ['POST /api/admin/integrations/mock/sync'],
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toProcessStatus = (value: unknown): ProcessStatus => {
  if (value === 'initializing' || value === 'processing' || value === 'completed' || value === 'failed') {
    return value;
  }
  return 'initializing';
};

const toStepStatus = (value: unknown): StepStatus | null => {
  if (value === 'pending' || value === 'active' || value === 'completed' || value === 'error') {
    return value;
  }
  return null;
};

const getDefaultStepStatus = (
  stepId: number,
  currentStep: number,
  processStatus: ProcessStatus,
): StepStatus => {
  if (stepId < currentStep) {
    return 'completed';
  }
  if (stepId === currentStep) {
    if (processStatus === 'failed') {
      return 'error';
    }
    if (processStatus === 'completed') {
      return 'completed';
    }
    return 'active';
  }
  if (processStatus === 'completed') {
    return 'completed';
  }
  return 'pending';
};

const coerceStep = (
  template: StepTemplate,
  currentStep: number,
  processStatus: ProcessStatus,
  sourceCandidate?: unknown,
): IntegrationStep => {
  const candidate = isRecord(sourceCandidate) ? sourceCandidate : null;
  const candidateStatus = toStepStatus(candidate?.status);
  const details =
    Array.isArray(candidate?.details) && candidate.details.every((item) => typeof item === 'string')
      ? candidate.details
      : template.details;
  const apiCalls =
    Array.isArray(candidate?.apiCalls) && candidate.apiCalls.every((item) => typeof item === 'string')
      ? candidate.apiCalls
      : template.apiCalls;

  return {
    ...template,
    status: candidateStatus ?? getDefaultStepStatus(template.id, currentStep, processStatus),
    details,
    apiCalls,
    duration: typeof candidate?.duration === 'number' ? candidate.duration : undefined,
  };
};

const buildFallbackProcess = (service: string): ApiIntegrationProcess => {
  const processStatus: ProcessStatus = 'initializing';
  const currentStep = 1;
  return {
    service,
    totalSteps: STANDARD_STEP_TEMPLATES.length,
    currentStep,
    status: processStatus,
    startTime: new Date().toISOString(),
    steps: STANDARD_STEP_TEMPLATES.map((step) => coerceStep(step, currentStep, processStatus)),
    devSteps: DEVELOPER_STEP_TEMPLATES.map((step) => ({ ...coerceStep(step, 0, 'initializing'), status: 'pending' })),
  };
};

const normalizeProcessPayload = (payload: unknown, service: string): ApiIntegrationProcess => {
  const fallback = buildFallbackProcess(service);
  if (!isRecord(payload)) {
    return fallback;
  }

  const rawTotal = typeof payload.totalSteps === 'number' ? payload.totalSteps : fallback.totalSteps;
  const totalSteps = Math.max(rawTotal, fallback.totalSteps);
  const rawCurrentStep = typeof payload.currentStep === 'number' ? payload.currentStep : 1;
  const currentStep = Math.min(Math.max(rawCurrentStep, 1), totalSteps);
  const processStatus = toProcessStatus(payload.status);
  const startTime = typeof payload.startTime === 'string' ? payload.startTime : fallback.startTime;

  const serverSteps = Array.isArray(payload.steps) ? payload.steps : [];
  const serverDevSteps = Array.isArray(payload.devSteps) ? payload.devSteps : [];

  const steps = STANDARD_STEP_TEMPLATES.map((template) => {
    const serverStep = serverSteps.find((step) => isRecord(step) && step.id === template.id);
    return coerceStep(template, currentStep, processStatus, serverStep);
  });

  const devSteps = DEVELOPER_STEP_TEMPLATES.map((template) => {
    const serverStep = serverDevSteps.find((step) => isRecord(step) && step.id === template.id);
    return coerceStep(template, currentStep, processStatus, serverStep);
  });

  return {
    service: typeof payload.service === 'string' ? payload.service : service,
    totalSteps,
    currentStep,
    status: processStatus,
    startTime,
    steps,
    devSteps,
  };
};

const normalizeOverviewPayload = (payload: unknown, service: string): ApiIntegrationProcess => {
  if (isRecord(payload) && isRecord(payload[service])) {
    return normalizeProcessPayload(payload[service], service);
  }
  return buildFallbackProcess(service);
};

export function ApiIntegrationProcessMonitor({ service }: { service?: string }) {
  const targetService = (service || 'pexels').toLowerCase();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useTheming();

  const [showDevSteps, setShowDevSteps] = useState(false);
  const [realTimeUpdate, setRealTimeUpdate] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [selectedStep, setSelectedStep] = useState<IntegrationStep | null>(null);

  const processQuery = useQuery({
    queryKey: ['/api/admin/integrations/process-monitor', targetService],
    queryFn: async (): Promise<ApiIntegrationProcess> => {
      const candidateEndpoints = [
        `/api/admin/integrations/${targetService}/process`,
        `/api/admin/integrations/${targetService}/status`,
        `/api/integrations/${targetService}/status`,
      ];

      for (const endpoint of candidateEndpoints) {
        try {
          const payload = await apiRequest(endpoint);
          return normalizeProcessPayload(payload, targetService);
        } catch {
          // Try next endpoint.
        }
      }

      try {
        const overview = await apiRequest('/api/admin/integrations/status');
        return normalizeOverviewPayload(overview, targetService);
      } catch {
        return buildFallbackProcess(targetService);
      }
    },
    staleTime: 2_000,
    refetchInterval: realTimeUpdate ? 5_000 : false,
  });

  const currentProcess = processQuery.data ?? buildFallbackProcess(targetService);

  const progressPercentage = useMemo(() => {
    if (!currentProcess.totalSteps) {
      return 0;
    }
    return Math.round((currentProcess.currentStep / currentProcess.totalSteps) * 100);
  }, [currentProcess.currentStep, currentProcess.totalSteps]);

  const refreshProcess = async () => {
    await processQuery.refetch();
    await queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations/status'] });
  };

  const startIntegrationMutation = useMutation({
    mutationFn: async () => {
      try {
        return await apiRequest(`/api/admin/integrations/${targetService}/start`, {
          method: 'POST',
          body: { service: targetService },
        });
      } catch {
        return apiRequest('/api/admin/integrations/refresh', {
          method: 'POST',
          body: { service: targetService },
        });
      }
    },
    onSuccess: async () => {
      toast({
        title: 'Integration started',
        description: `${targetService.toUpperCase()} process has been restarted.`,
        variant: 'success',
      });
      await refreshProcess();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Could not start integration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const runTestsMutation = useMutation({
    mutationFn: async () => {
      try {
        return await apiRequest(`/api/integrations/${targetService}/test`, { method: 'POST' });
      } catch {
        return apiRequest(`/api/integrations/${targetService}/test`);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Integration tests executed',
        description: `Tests for ${targetService.toUpperCase()} completed.`,
        variant: 'success',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Integration tests failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/integrations/refresh', {
        method: 'POST',
        body: { service: targetService },
      });
    },
    onSuccess: async () => {
      toast({
        title: 'Integration refreshed',
        description: `${targetService.toUpperCase()} refreshed successfully.`,
        variant: 'success',
      });
      await refreshProcess();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Refresh failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const getStepIcon = (step: IntegrationStep) => {
    if (step.status === 'completed') {
      return <CheckCircleIcon color="success" />;
    }
    if (step.status === 'error') {
      return <ErrorIcon color="error" />;
    }
    if (step.status === 'active') {
      return <CircularStepPulse icon={step.icon} />;
    }
    return step.icon;
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Card elevation={2} sx={theme.getThemedCardSx()}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon aria-hidden sx={{ color: theme.colors.primary }} />
                API Integration Process Monitor
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Service: <strong>{targetService.toUpperCase()}</strong>
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    checked={showDevSteps}
                    onChange={(event) => setShowDevSteps(event.target.checked)}
                  />
                }
                label="Developer steps"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={realTimeUpdate}
                    onChange={(event) => setRealTimeUpdate(event.target.checked)}
                  />
                }
                label="Live updates"
              />
            </Stack>
          </Stack>

          <Alert severity={currentProcess.status === 'failed' ? 'error' : 'info'} sx={{ mb: 2 }}>
            <Typography variant="body2">
              Status: <strong>{currentProcess.status.toUpperCase()}</strong> | Step{' '}
              <strong>
                {currentProcess.currentStep}/{currentProcess.totalSteps}
              </strong>
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{ mt: 1.5, height: 8, borderRadius: 5 }}
            />
          </Alert>

          {processQuery.isError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Could not load live process data. Showing resilient fallback process model.
            </Alert>
          )}

          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Mandatory Fullstack Protocol (10 steps)
          </Typography>
          <Stepper orientation="vertical">
            {currentProcess.steps.map((step) => (
              <Step key={step.id} active={step.status === 'active'} completed={step.status === 'completed'} expanded>
                <StepLabel icon={getStepIcon(step)}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle1">{step.title}</Typography>
                    <StatusChip
                      label={step.status.toUpperCase()}
                      tone={
                        step.status === 'completed'
                          ? 'success'
                          : step.status === 'active'
                            ? 'brand'
                            : step.status === 'error'
                              ? 'error'
                              : 'neutral'
                      }
                    />
                  </Stack>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {step.description}
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Button size="small" onClick={() => setSelectedStep(step)}>
                      View details
                    </Button>
                    <Tooltip title={expandedStep === step.id ? 'Hide step details' : 'Expand step details'}>
                      <IconButton
                        size="small"
                        aria-label={expandedStep === step.id ? 'Skjul trinndetaljer' : 'Vis trinndetaljer'}
                        onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                      >
                        {expandedStep === step.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Collapse in={expandedStep === step.id}>
                    <Box sx={{ mt: 1, pl: 2, borderLeft: '2px solid', borderColor: 'primary.light' }}>
                      <List dense>
                        {step.details.map((detail) => (
                          <ListItem key={`${step.id}-${detail}`} disableGutters>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                            </ListItemIcon>
                            <ListItemText primary={detail} />
                          </ListItem>
                        ))}
                      </List>
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                        {step.apiCalls.map((apiCall) => (
                          <Chip key={`${step.id}-${apiCall}`} label={apiCall} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                  </Collapse>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          <Collapse in={showDevSteps}>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              Developer Workflow (4 steps)
            </Typography>
            <Stepper orientation="vertical">
              {currentProcess.devSteps.map((step) => (
                <Step key={step.id} active={step.status === 'active'} completed={step.status === 'completed'} expanded>
                  <StepLabel icon={getStepIcon(step)}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">{step.title}</Typography>
                      <Chip size="small" color="secondary" label="DEVELOPER" />
                    </Stack>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {step.description}
                    </Typography>
                    <List dense>
                      {step.details.map((detail) => (
                        <ListItem key={`${step.id}-${detail}`} disableGutters>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <CodeIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                          </ListItemIcon>
                          <ListItemText primary={detail} />
                        </ListItem>
                      ))}
                    </List>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Collapse>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" gutterBottom>
            Quick actions for {targetService.toUpperCase()}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <AdminButton
              tone="secondary"
              startIcon={<RefreshIcon />}
              onClick={() => startIntegrationMutation.mutate()}
              loading={startIntegrationMutation.isPending}
            >
              Restart process
            </AdminButton>
            <AdminButton
              tone="secondary"
              startIcon={<ScienceIcon />}
              onClick={() => runTestsMutation.mutate()}
              loading={runTestsMutation.isPending}
            >
              Run tests
            </AdminButton>
            <AdminButton
              tone="secondary"
              startIcon={<CloudDoneIcon />}
              onClick={() => refreshMutation.mutate()}
              loading={refreshMutation.isPending}
            >
              Refresh integration
            </AdminButton>
            <AdminButton
              tone="ghost"
              startIcon={realTimeUpdate ? <StopIcon /> : <PlayIcon />}
              onClick={() => setRealTimeUpdate((value) => !value)}
            >
              {realTimeUpdate ? 'Pause live' : 'Resume live'}
            </AdminButton>
          </Stack>

          {processQuery.isLoading && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Loading integration process data...
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedStep)} onClose={() => setSelectedStep(null)} fullScreen={useIsMobile()} fullWidth maxWidth="md">
        <DialogTitle>{selectedStep?.title ?? 'Step details'}</DialogTitle>
        <DialogContent dividers>
          {selectedStep && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {selectedStep.description}
              </Typography>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Checklist
                </Typography>
                <List dense>
                  {selectedStep.details.map((detail) => (
                    <ListItem key={`dialog-${selectedStep.id}-${detail}`} disableGutters>
                      <ListItemText primary={detail} />
                    </ListItem>
                  ))}
                </List>
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Endpoints
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {selectedStep.apiCalls.map((apiCall) => (
                    <Chip key={`dialog-${selectedStep.id}-${apiCall}`} label={apiCall} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setSelectedStep(null)}>Close</AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CircularStepPulse({ icon }: { icon: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'pulse-step 1.4s ease-in-out infinite',
        '@keyframes pulse-step': {
          '0%': { opacity: 0.6, transform: 'scale(0.96)' },
          '50%': { opacity: 1, transform: 'scale(1.08)' },
          '100%': { opacity: 0.6, transform: 'scale(0.96)' },
        },
      }}
    >
      {icon}
    </Box>
  );
}

export default ApiIntegrationProcessMonitor;
