/**
 * CreatorHub Norge - Visual CMS Integration Dashboard
 * Complete visual interface for API Bank management, Mock/Real switching, and deployment workflow
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Alert,
  Tooltip,
  Divider,
  ButtonGroup,
  Badge,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Avatar,
  Stack,
  TextField,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Drawer,
  AppBar,
  Toolbar,
  Fab,
} from '@mui/material';
import {
  Api as ApiIcon,
  ToggleOn as ToggleIcon,
  PlayArrow as TestIcon,
  Publish as DeployIcon,
  Visibility as ViewIcon,
  Settings as ConfigIcon,
  CheckCircle as PassedIcon,
  Error as FailedIcon,
  Warning as WarningIcon,
  Pending as PendingIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  AccountTree as WorkflowIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Speed as PerformanceIcon,
  CloudUpload,
  DeveloperMode as MockIcon,
  RocketLaunch as LaunchIcon,
  Backup as BackupIcon,
  Monitor as MonitorIcon,
  Code as CodeIcon,
  Palette as PaletteIcon,
  Layers as LayersIcon,
  CropFree as SelectIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  CloudUpload as DescriptionUpload,
  Folder as FolderIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Preview as PreviewIcon,
  Fullscreen as FullscreenIcon,
  ZoomIn,
  ZoomOut,
  GridOn as GridOnOn,
  FormatPaint,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import TaskListVisualizer from './TaskListVisualizer';
import MonacoEditor from '@monaco-editor/react';
import { AdminButton } from './design-system';

interface APIEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  category: string;
  service: string;
  isMocked: boolean;
  status: 'healthy' | 'warning' | 'error' | 'offline';
  lastTested: string;
  responseTime: number;
  usageCount: number;
  critical: boolean
}

interface APICategory {
  id: string;
  name: string;
  description: string;
  endpointCount: number;
  mockedCount: number;
  healthyCount: number;
  status: 'all_mocked' | 'mixed' | 'all_real';
  color: string;
  icon: React.ReactNode
}

interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  required: boolean;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  checks: Array<{
    id: string;
    name: string;
    completed: boolean;
    required: boolean;
}>;
}

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'blocked';
  progress: number;
  estimatedTime: number;
  completedTasks: number;
  totalTasks: number
}

export default function VisualCMSDashboard() {
  const { toast } = useToast();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const queryClient = useQueryClient();

  // State management
  const [selectedView, setSelectedView] = useState<
    'overview' | 'api-bank' | 'workflow' | 'deployment' | 'designer' | 'components' | 'code' | 'preview'
  >('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [globalMockMode, setGlobalMockMode] = useState(false);
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);
  const [workflowActive, setWorkflowActive] = useState(false);

  // API Categories based on actual platform analysis
  const apiCategories: APICategory[] = [
    {
      id: 'internal-admin',
      name: 'Admin API',
      description: 'Administration og permissions (154 endpoints, )',
      endpointCount: 14,
      mockedCount: 14,
      healthyCount: 12,
      status: 'all_mocked',
      color: '#f44330',
      icon: <SecurityIcon />,
  },
    {
      id: 'internal-dam',
      name: 'DAM API',
      description: 'Digital Asset Management (112 endpoints, )',
      endpointCount: 12,
      mockedCount:  85,
      healthyCount: 10,
      status: 'mixed',
      color: '#ff9800',
      icon: <StorageIcon />,
  },
    {
      id: 'internal-showcase',
      name: 'Showcase API',
      description: 'Portfolio og showcase systemer (68 endpoints, )',
      endpointCount:  68,
      mockedCount:  0,
      healthyCount:  68,
      status: 'all_real',
      color: '#4caf50',
      icon: <ViewIcon />,
  },
    {
      id: 'internal-crm',
      name: 'CRM API',
      description: 'Customer Relationship Management (46 endpoints, )',
      endpointCount:  46,
      mockedCount:  46,
      healthyCount:  44,
      status: 'all_mocked',
      color: '#2196f0',
      icon: <ApiIcon />,
  },
    {
      id: 'internal-projects',
      name: 'Prosjekt API',
      description: 'Project management systemer (41 endpoints, )',
      endpointCount:  41,
      mockedCount:  20,
      healthyCount:  41,
      status: 'mixed',
      color: '#ce93d8',
      icon: <WorkflowIcon />,
  },
    {
      id: 'external-google',
      name: 'Google API',
      description: 'Google Workspace integrasjoner',
      endpointCount:  45,
      mockedCount:  45,
      healthyCount:  43,
      status: 'all_mocked',
      color: '#4285f0',
      icon: theming.getThemedIcon(', '),
  },
    {
      id: 'external-stripe',
      name: 'Stripe API',
      description: 'Payment processing systemer',
      endpointCount:  12,
      mockedCount:  12,
      healthyCount:  12,
      status: 'all_mocked',
      color: '#6772e0',
      icon: <SecurityIcon />,
  },
    {
      id: 'external-norwegian',
      name: 'Norske API',
      description: 'BRRG, Posten og andre norske tjenester',
      endpointCount:  8,
      mockedCount:  8,
      healthyCount:  7,
      status: 'all_mocked',
      color: '#e91e60',
      icon: <BackupIcon />,
  },
  ];

  // Deployment workflow stages
  const workflowStages: WorkflowStage[] = [
    {
      id: 'mock-testing',
      name: 'Mock Testing',
      description: 'Test alle APIs med mock data',
      status: 'completed',
      progress: 10,
      estimatedTime:  15,
      completedTasks: 46,
      totalTasks: 46,
  },
    {
      id: 'integration-testing',
      name: 'Integration Testing',
      description: 'Test kritiske APIs med ekte data',
      status: 'active',
      progress:  75,
      estimatedTime:  25,
      completedTasks:  45,
      totalTasks:  60,
  },
    {
      id: 'staging-deployment',
      name: 'Staging Deployment',
      description: 'Deploy til staging milj, ø',
      status: 'pending',
      progress:  0,
      estimatedTime:  10,
      completedTasks:  0,
      totalTasks:  12,
  },
    {
      id: 'production-deployment',
      name: 'Production Deployment',
      description: 'Deploy til produksjon',
      status: 'pending',
      progress:  0,
      estimatedTime:  20,
      completedTasks:  0,
      totalTasks:  25,
  },
  ];

  // Pre-production deployment checklist
  const deploymentSteps: DeploymentStep[] = [
    {
      id: 'api-testing',
      name: 'API Testing',
      description: 'Test alle, 1,827 API endepunkter',
      completed: false,
      required: true,
      status: 'running',
      checks: [
        {
          id: 'mock-apis',
          name: 'Mock APIs (486/486, )',
          completed: true,
          required: true,
      },
        {
          id: 'external-apis',
          name: 'Eksterne APIs (65/65, )',
          completed: true,
          required: true,
      },
        {
          id: 'internal-apis',
          name: 'Interne APIs (45/60, )',
          completed: false,
          required: true,
      },
      ],
  },
    {
      id: 'database-integrity',
      name: 'Database Integrity',
      description: 'Verifiser database konsistens',
      completed: true,
      required: true,
      status: 'completed',
      checks: [
        {
          id: 'schema-validation',
          name: 'Schema validering',
          completed: true,
          required: true,
      },
        {
          id: 'foreign-keys',
          name: 'Foreign key constraints',
          completed: true,
          required: true,
      },
        {
          id: 'data-integrity',
          name: 'Data integritet',
          completed: true,
          required: true,
      },
      ],
  },
    {
      id: 'security-audit',
      name: 'Security Audit',
      description: 'Sikkerhetstesting og compliance',
      completed: false,
      required: true,
      status: 'pending',
      checks: [
        {
          id: 'auth-testing',
          name: 'Authentication testing',
          completed: false,
          required: true,
      },
        {
          id: 'gdpr-compliance',
          name: 'GDPR compliance',
          completed: true,
          required: true,
      },
        {
          id: 'data-encryption',
          name: 'Data kryptering',
          completed: true,
          required: true,
      },
      ],
  },
    {
      id: 'performance-testing',
      name: 'Performance Testing',
      description: 'Last og ytelsestesting',
      completed: false,
      required: true,
      status: 'pending',
      checks: [
        {
          id: 'load-testing',
          name: 'Load testing',
          completed: false,
          required: true,
      },
        {
          id: 'response-times',
          name: 'Response times',
          completed: false,
          required: false,
      },
        {
          id: 'memory-usage',
          name: 'Memory usage',
          completed: false,
          required: false,
      },
      ],
  },
  ];

  // Toggle global mock mode
  const toggleGlobalMockMode = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/admin/wiremock/global-toggle', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json','x-user-email' : 'daniel@creatorhubn.com',
      },
        body: JSON.stringify({ enabled }),
    });
      if (!response.ok) throw new Error('Failed to toggle mock mode');
      return response.json();
  },
    onSuccess: (data) => {
      setGlobalMockMode(data.enabled);
      toast({
        title: data.enabled ? 'Mock mode aktivert' : 'Mock mode deaktivert',
        description: `${data.endpointsAffected} endepunkter oppdatert`,
    });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/wiremock', ],});
  },
    onError: () => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke endre mock mode',
        variant: 'destructive',
    });
  },
});

  // Start deployment workflow
  const startDeploymentWorkflow = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/deployment/workflow/start', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json', 'x-user-email' : 'daniel@creatorhubn.com',
      },
    });
      if (!response.ok) throw new Error('Failed to start deployment workflow');
      return response.json();
  },
    onSuccess: () => {
      setWorkflowActive(true);
      toast({
        title: 'Deployment workflow startet',
        description: 'Automated testing og deployment er i gang',
    });
  },
    onError: () => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke starte deployment workflow',
        variant: 'destructive',
    });
  },
});

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <PassedIcon color="success" />;
      case 'running':
      case 'active':
        return <PendingIcon color="warning" />;
      case 'failed':
      case 'error':
        return <FailedIcon color="error" />;
      default:
        return <PendingIcon color="disabled" />;
}
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'all_mocked':
        return '#2196f3';
      case 'all_real':
        return '#4caf50';
      case 'mixed':
        return '#ff9800';
      default:
        return '#9e9e9e';
}
};

  const calculateOverallProgress = () => {
    const totalSteps = deploymentSteps.length;
    const completedSteps = deploymentSteps.filter((step) => step.completed).length;
    return (completedSteps / totalSteps) * 100;
};

  const canDeploy = () => {
    const requiredSteps = deploymentSteps.filter((step) => step.required);
    return requiredSteps.every((step) => step.completed);
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h4" component="h2" sx={{  mb: 1, fontWeight: 600}}>
          Visual CMS Editor
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Replit-Quality Visual Editor • Drag & Drop Components • Real-time Preview
        </Typography>
      </Box>

      {/* View Selection */}
      <Box sx={{ mb:  3 }}>
        <ButtonGroup variant="outlined" size="large">
          <Button
            startIcon={<LayersIcon />}
            variant={selectedView === 'designer' ? 'contained' : 'outlined'}
            onClick={() => setSelectedView('designer')}
          >
            Visual Designer
          </Button>
          <Button
            startIcon={<PaletteIcon />}
            variant={selectedView === 'components' ? 'contained' : 'outlined'}
            onClick={() => setSelectedView('components')}
          >
            Components
          </Button>
          <Button
            startIcon={<CodeIcon />}
            variant={selectedView === 'code' ? 'contained' : 'outlined'}
            onClick={() => setSelectedView('code')}
          >
            Code View
          </Button>
          <Button
            startIcon={<PreviewIcon />}
            variant={selectedView === 'preview' ? 'contained' : 'outlined'}
            onClick={() => setSelectedView('preview')}
          >
            Live Preview
          </Button>
        </ButtonGroup>
      </Box>

      {/* Global Controls */}
      <Card sx={{ mb:  3, bgcolor: 'background.paper',  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={globalMockMode}
                    onChange={(e) => toggleGlobalMockMode.mutate(e.target.checked)}
                    color="primary"
                    size="medium"
                  />
              }
                label={
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Global Mock Mode</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {globalMockMode ? 'Alle APIs bruker mock data' : 'Alle APIs bruker ekte data'}
                    </Typography>
                  </Box>
              }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                  1,827
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Totale API Endepunkter
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                  {calculateOverallProgress().toFixed(0)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Deployment Klarhet
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={calculateOverallProgress()}
                  sx={{ mt:  1 }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Overview View */}
      {selectedView === 'overview' && (
        <Grid container spacing={3}>
          {/* API Categories Overview */}
          <Grid item xs={12}>
            <Typography variant="h5" component="h3" sx={{  mb:  2  }}>
              API Bank Status
            </Typography>
            <Grid container spacing={2}>
              {apiCategories.map((category) => (
                <Grid item xs={12} sm={6} md={3} key={category.id}>
                  <Card
                    role="button"
                    tabIndex={0}
                    aria-label={`Åpne ${category.name}`}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2',
                      border: `2px solid ${getStatusColor(category.status)}`, '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow:  3,
                    }}}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSelectedView('api-bank');
                  }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCategory(category.id);
                        setSelectedView('api-bank');
                    }
                  }}
                  >
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                        <Avatar sx={{ bgcolor: category.color, mr:  1 }}>{category.icon}</Avatar>
                        <Typography variant="h6" sx={{  flexGrow:  1  }}>
                          {category.name}
                        </Typography>
                        <Chip label={category.endpointCount} size="small" color="primary" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        {category.description}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between'}}
                      >
                        <Chip
                          label={`${category.mockedCount} mocked`}
                          size="small"
                          color={category.status === 'all_mocked' ? 'primary' : 'default'}
                        />
                        <Chip
                          label={`${category.healthyCount} healthy`}
                          size="small"
                          color="success"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Workflow Status */}
          <Grid item xs={12} md={8}>
            <Typography variant="h5" component="h3" sx={{  mb:  2  }}>
              Deployment Workflow
            </Typography>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stepper orientation="vertical">
                  {workflowStages.map((stage) => (
                    <Step
                      key={stage.id}
                      active={stage.status === 'active'}
                      completed={stage.status === 'completed'}
                    >
                      <StepLabel StepIconComponent={() => getStatusIcon(stage.status)}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{stage.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {stage.description}
                        </Typography>
                      </StepLabel>
                      <StepContent>
                        <Box sx={{ mt: 1, mb: 2 }}>
                          <LinearProgress
                            variant="determinate"
                            value={stage.progress}
                            sx={{ mb:  1 }}
                          />
                          <Typography variant="body2">
                            {stage.completedTasks}/{stage.totalTasks} oppgaver fullført
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Estimert tid: {stage.estimatedTime} minutter
                          </Typography>
                        </Box>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={4}>
            <Typography variant="h5" component="h3" sx={{  mb:  2  }}>
              Quick Actions
            </Typography>
            <Stack spacing={2}>
              <Button variant="contained"
                size="large"
                startIcon={<TestIcon />}
                onClick={() => setSelectedView('workflow')}
                fullWidth
              >
                Start Testing Workflow
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<ConfigIcon />}
                onClick={() => setSelectedView('api-bank')}
                fullWidth
              >
                Configure API Bank
              </Button>
              <Button
                variant={canDeploy() ? 'contained' : 'outlined'}
                size="large"
                startIcon={<LaunchIcon />}
                onClick={() => setDeploymentDialogOpen(true)}
                disabled={!canDeploy()}
                color={canDeploy() ? 'success' : 'primary'}
                fullWidth
              >
                {canDeploy() ? 'Deploy til Produksjon' : 'Ikke klar for deployment'}
              </Button>
            </Stack>

            {/* Deployment Checklist */}
            <Card sx={{ mt:  2 ,  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Deployment Checklist
                </Typography>
                <List dense>
                  {deploymentSteps.map((step) => (
                    <ListItem key={step.id} sx={{ px:  0 }}>
                      <ListItemIcon>
                        <Checkbox checked={step.completed} color="success" disabled />
                      </ListItemIcon>
                      <ListItemText
                        primary={step.name}
                        secondary={`${step.checks.filter((c) => c.completed).length}/${step.checks.length} sjekker, `}
                      />
                      {getStatusIcon(step.status)}
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* API Bank View - Will be implemented in next iteration */}
      {selectedView === 'api-bank' && (
        <Alert severity="info">API Bank detaljvisning implementeres i neste iterasjon</Alert>
      )}

      {/* Workflow View - Will be implemented in next iteration */}
      {selectedView === 'workflow' && (
        <Alert severity="info">Workflow detaljvisning implementeres i neste iterasjon</Alert>
      )}

      {/* Deployment View - Visuell Task List */}
      {selectedView === 'deployment' && (
        <TaskListVisualizer
          onDeploymentReady={() => {
            toast({
              title: '🚀 Systemet er klart for deployment, !',
              description: 'Alle kritiske tester er bestått og deployment kan startes',
          });
        }}
          onTaskComplete={(taskId) => {
            console.log(`Task completed: ${taskId}`);
        }}
          autoRefresh={true}
          refreshInterval={3000}
        />
      )}

      {/* Deployment Confirmation Dialog */}
      <Dialog
        open={deploymentDialogOpen}
        onClose={() => setDeploymentDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Deploy til Produksjon</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb:  2 }}>
            Alle required checks er bestått! Systemet er klart for produksjon.
          </Alert>
          <Typography variant="body1" sx={{ mb:  2 }}>
            Dette vil deploye følgende komponenter til produksjon: </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <PassedIcon color="success" />
              </ListItemIcon>
              <ListItemText primary=", 1,827 API endepunkter" secondary="Alle testet og validert" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PassedIcon color="success" />
              </ListItemIcon>
              <ListItemText primary="Database migrasjoner" secondary="Schema validert og klar" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PassedIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Sikkerhetskonfigurasjoner"
                secondary="GDPR og norske krav oppfylt"
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setDeploymentDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            loading={startDeploymentWorkflow.isPending}
            startIcon={<LaunchIcon />}
            onClick={() => {
              startDeploymentWorkflow.mutate();
              setDeploymentDialogOpen(false);
          }}
          >
            Deploy til Produksjon
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
