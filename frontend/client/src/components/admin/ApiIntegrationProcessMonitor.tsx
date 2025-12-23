/**
 * CreatorHub Norge - API Integration Process Monitor
 * Visuell monitor som viser hele 10-stegs API integration prosessen
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/auth';
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
  Grid,
  IconButton,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';

interface IntegrationStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'completed' | 'error';
  details?: string[];
  duration?: number;
  apiCalls?: string[];
}

interface ApiIntegrationProcess {
  service: string;
  totalSteps: number;
  currentStep: number;
  status: 'initializing' | 'processing' | 'completed' | 'failed';
  startTime: string;
  steps: IntegrationStep[];
  devSteps?: IntegrationStep[];
}

export function ApiIntegrationProcessMonitor({ service }: { service?: string }) {
  // Note: authHeaders would need to be loaded in a useEffect if needed
  // const authHeaders = await auth.getAuthHeader();
  // Standard 10-stegs prosess
  const getStandardSteps = (currentProcess?: ApiIntegrationProcess): IntegrationStep[] => [
    {
      id: 1,
      title: 'API Key Registration',
      description: 'Admin panel registrering av API-nøkkel',
      icon: <ApiIcon />,
      status: currentProcess?.currentStep >= 1 ? 'completed' : 'pending',
      details: [
        'API-nøkkel validert og kryptert', 'Tjeneste-konfigurasjon opprettet','Tilgangspermissions satt',
      ],
      apiCalls: ['POST /api/admin/integrations/keys'],
    },
    {
      id: 4,
      title: 'Universal API Proxy',
      description: 'Frontend API proxy aktivering',
      icon: <ProxyIcon />,
      status: currentProcess?.currentStep >= 5 ? 'completed' : 'pending',
      details: [
        'Proxy routes konfigurert','Request/response mapping','Error handling implementert',
      ],
      apiCalls: ['POST /api/integrations/{service}/*'],
    },
    {
      id: 6,
      title: 'Feature Availability U',
      description: 'Kondisjonell UI logikk implementert',
      icon: <VisibilityIcon />,
      status: currentProcess?.currentStep >= 6 ? 'completed' : 'pending',
      details: [
        'Feature detection aktivert','UI komponenter tilgjengelige','Progressive enhancement',
      ],
      apiCalls: ['GET /api/integrations/features'],
    },
    {
      id: 7,
      title: 'Testing & Verification',
      description: 'API validering og test suite',
      icon: <SecurityIcon />,
      status: currentProcess?.currentStep >= 7 ? 'completed' : 'pending',
      details: ['Integration tests kjørt','API response validation','Error scenarios testet'],
      apiCalls: ['POST /api/integrations/test-suite'],
    },
    {
      id: 8,
      title: 'Automatic Activation',
      description: 'Hot-reload og auto-detection',
      icon: <SpeedIcon />,
      status: currentProcess?.currentStep >= 8 ? 'completed' : 'pending',
      details: [
        'Zero-downtime aktivering','Automatic service discovery','Configuration hot-reload',
      ],
      apiCalls: ['POST /api/admin/integrations/refresh'],
    },
    {
      id: 9,
      title: 'Security & Scaling',
      description: 'Production-ready sikkerhet',
      icon: <ShieldIcon />,
      status: currentProcess?.currentStep >= 9 ? 'completed' : 'pending',
      details: ['Rate limiting aktivert','GDPR compliance sjekket','Audit logging aktivert'],
      apiCalls: ['GET /api/admin/security/audit'],
    },
    {
      id: 10,
      title: 'Business Intelligence',
      description: 'Analytics og monitoring',
      icon: <AnalyticsIcon />,
      status: currentProcess?.currentStep >= 10 ? 'completed' : 'pending',
      details: ['Usage analytics tracking','Cost monitoring aktiv','Performance metrics'],
      apiCalls: ['GET /api/admin/analytics/integrations'],
    },
  ];

  // Developer steps
  const getDeveloperSteps = (): IntegrationStep[] => [
    {
      id: 11,
      title: 'Frontend UI Component',
      description: 'Lag service-spesifikk UI komponent',
      icon: <CodeIcon />,
      status: 'pending',
      details: [
        'React komponent generert','Material UI design system','Type-safe API integration',
      ],
    },
    {
      id: 12,
      title: 'Universal Proxy Test',
      description: 'Verifiser API-kall fungerer',
      icon: <ScienceIcon />,
      status: 'pending',
      details: ['Proxy endpoints testet','Request/response validert','Error handling verifisert'],
    },
    {
      id: 13,
      title: 'Code Generator',
      description: 'Auto-generering av komponenter',
      icon: <AutoIcon />,
      status: 'pending',
      details: ['TypeScript types generert','React hooks generert','API client generert'],
    },
    {
      id: 14,
      title: 'WireMock Sync',
      description: 'Automatisk testing infrastructure',
      icon: <SyncIcon />,
      status: 'pending',
      details: ['Mock server konfigurert','Test scenarios definert','CI/CD pipeline integrert'],
    },
  ];

  const standardSteps = getStandardSteps(
    processData ?? (undefined as unknown as ApiIntegrationProcess),
  );
  const devSteps = getDeveloperSteps();

  return (
    <Box sx={{ width: '100%', maxWidth: 120, mx: 'auto', p: 2 }}>
      <Card elevation={3} sx={theme.getThemedCardSx()}>
        <CardContent sx={theme.getThemedCardSx()}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}
          >
            <Typography
              variant="h5"
              component="h2"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              style={{ color: theme.colors.primary }}
            >
              <TimelineIcon sx={{ color: 'primary.main' }} />
              API Integration Process Monitor
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={showDevSteps ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setShowDevSteps(!showDevSteps)}
              >
                Developer Steps
              </Button>
              <Button
                variant="outlined"
                startIcon={realTimeUpdate ? <StopIcon /> : <PlayIcon />}
                onClick={() => setRealTimeUpdate(!realTimeUpdate)}
              >
                {realTimeUpdate ? 'Pause' : 'Start'} Live Updates
              </Button>
            </Box>
          </Box>

          {service && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle1">
                Monitoring integration for: <strong>{service.toUpperCase()}</strong>
              </Typography>
              {processData && (
                <LinearProgress
                  variant="determinate"
                  value={getProgressPercentage()}
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
              )}
            </Alert>
          )}

          <Typography variant="h6" gutterBottom style={{ color: theme.colors.primary }}>
            MANDATORY FULLSTACK API PROTOCOL (10 Steg)
          </Typography>

          <Stepper orientation="vertical" sx={{ mt: 2 }}>
            {standardSteps.map((step) => (
              <Step key={step.id} active expanded>
                <StepLabel
                  icon={getStepIcon(step)}
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontWeight: tep.status === 'completed' ? 'bold' : 'normal',
                    }}}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1">{step.title}</Typography>
                    <Chip
                      label={step.status.toUpperCase()}
                      size="small"
                      color={
                        step.status === 'completed'
                          ? 'success'
                          : step.status === 'active'
                            ? 'primary'
                            : step.status === 'error'
                              ? 'error' : 'default'
                      }
                    />
                  </Box>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="textSecondary" style={{ mb: 2 }}>
                    {step.description}
                  </Typography>

                  <IconButton
                    size="small"
                    onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  >
                    {expandedStep === step.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>

                  <Collapse in={expandedStep === step.id}>
                    <Box
                      sx={{ mt: 2, pl: 2, borderLeft: '2px solid', borderColor: 'primary.light' }}
                    >
                      {step.details && (
                        <List dense>
                          {step.details.map((detail, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                              </ListItemIcon>
                              <ListItemText primary={detail} />
                            </ListItem>
                          ))}
                        </List>
                      )}

                      {step.apiCalls && (
                        <>
                          <Typography variant="subtitle2" style={{ mt: 2, mb: 1 }}>
                            API Endpoints:{' '}
                          </Typography>
                          {step.apiCalls.map((apiCall, index) => (
                            <Chip
                              key={index}
                              label={apiCall}
                              variant="outlined"
                              size="small"
                              style={{ mr: 1, mb: 1, fontFamily: 'monospace' }}
                            />
                          ))}
                        </>
                      )}
                    </Box>
                  </Collapse>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          <Collapse in={showDevSteps}>
            <Divider style={{ my: 3 }} />
            <Typography variant="h6" gutterBottom style={{ color: theme.colors.primary }}>
              DEVELOPER WORKFLOW (4 Steg)
            </Typography>

            <Stepper orientation="vertical" style={{ mt: 2 }}>
              {devSteps.map((step) => (
                <Step key={step.id} active expanded>
                  <StepLabel icon={step.icon as React.ReactNode}>
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">{step.title}</Typography>
                      <Chip label="DEVELOPER" size="small" color="secondary" />
                    </Box>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="textSecondary">
                      {step.description}
                    </Typography>
                    {step.details && step.details.length > 0 && (
                      <Box
                        sx={{ mt: 2, pl: 2, borderLeft: '2px solid', borderColor: 'primary.light' }}
                      >
                        <Typography
                          variant="subtitle2"
                          style={{ mt: 2, mb: 1, color: theme.colors.primary }}
                        >
                          Details:{' '}
                        </Typography>
                        <List dense sx={{ mt: 1, color: theme.colors.primary }}>
                          {step.details.map((detail, index) => (
                            <ListItem key={index} sx={{ color: theme.colors.primary }}>
                              <ListItemIcon>
                                <CodeIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                              </ListItemIcon>
                              <ListItemText primary={detail} sx={{ color: theme.colors.primary }} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                    {step.apiCalls && step.apiCalls.length > 0 && (
                      <Box
                        sx={{ mt: 2, pl: 2, borderLeft: '2px solid', borderColor: 'primary.light' }}
                      >
                        <Typography
                          variant="subtitle2"
                          style={{ mt: 2, mb: 1, color: theme.colors.primary }}
                        >
                          API Endpoints:{''}
                        </Typography>
                        <List dense sx={{ mt: 1, color: theme.colors.primary }}>
                          {step.apiCalls.map((apiCall, index) => (
                            <ListItem key={index} sx={{ color: theme.colors.primary }}>
                              <ListItemText
                                primary={apiCall}
                                sx={{ color: theme.colors.primary }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Collapse>

          {service && (
            <Box style={{ mt: 3, p: 2, bgcolor: theme.colors.primary, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom style={{ color: theme.colors.primary }}>
                Quick Actions for {service}:
              </Typography>
              <Box
                style={{
                  display: 'flex',
                  gap: 1,
                  flexWrap: 'wrap',
                  color: theme.colors.text.primary}}
              >
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  style={{ color: theme.colors.primary }}
                  onClick={() => startIntegrationMutation.mutate(service)}
                  disabled={startIntegrationMutation.isPending}
                >
                  Restart Process
                </Button>
                <Button
                  size="small"
                  startIcon={<ScienceIcon />}
                  style={{ color: theme.colors.primary }}
                  onClick={() => fetch(`/api/integrations/${service}/test`)}
                >
                  Run Tests
                </Button>
                <Button
                  size="small"
                  startIcon={<AnalyticsIcon />}
                  style={{ color: theme.colors.primary }}
                  onClick={() => window.open(`/admin/analytics/integrations/${service}`, '_blank')}
                >
                  View Analytics
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default ApiIntegrationProcessMonitor;
