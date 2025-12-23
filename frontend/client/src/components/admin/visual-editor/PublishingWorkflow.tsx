/**
 * Publishing Workflow System
 * Draft → Preview → Production with Git branch/PR flow + versioning
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
  Stack,
  Badge,
  Avatar,
  Tooltip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Publish,
  Visibility,
  AccountTree,
  Merge,
  Schedule,
  Save
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import { Project } from './VisualEditorContext';

// Types for publishing workflow
interface PublishingEnvironment {
  id: string;
  name: string;
  type: 'draft' | 'preview' | 'staging' | 'production';
  url: string;
  status: 'active' | 'inactive' | 'building' | 'error';
  lastDeployed?: Date;
  version?: string;
  branch?: string;
}

interface PublishingVersion {
  id: string;
  version: string;
  type: 'patch' | 'minor' | 'major';
  description: string;
  createdAt: Date;
  createdBy: string;
  status: 'draft' | 'ready' | 'deployed' | 'archived';
  environments: string[];
  gitCommit?: string;
  gitBranch?: string;
  pullRequest?: string;
  changes: VersionChange[];
}

interface VersionChange {
  type: 'added' | 'modified' | 'removed' | 'moved';
  path: string;
  description: string;
}

interface PublishingWorkflowProps {
  project: Project;
  onVersionCreate: (version: PublishingVersion) => void;
  onDeploy: (version: string, environment: string) => void;
}

export const PublishingWorkflow: React.FC<PublishingWorkflowProps> = ({
  project,
  onVersionCreate,
  onDeploy
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const [activeStep, setActiveStep] = useState(0);
  const [environments, setEnvironments] = useState<PublishingEnvironment[]>([
    {
      id: 'draft',
      name: 'Draft',
      type: 'draft',
      url: 'http://draft.example.com',
      status: 'active'
},
    {
      id: 'preview',
      name: 'Preview',
      type: 'preview',
      url: 'http://preview.example.com',
      status: 'active'
},
    {
      id: 'staging',
      name: 'Staging',
      type: 'staging',
      url: 'http://staging.example.com',
      status: 'active'
},
    {
      id: 'production',
      name: 'Production',
      type: 'production',
      url: 'http://production.example.com',
      status: 'active'
}
  ]);
  
  const [versions, setVersions] = useState<PublishingVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('');
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  
  const [gitSettings, setGitSettings] = useState({
    repository: 'https://github.com/company/project',
    mainBranch: 'main',
    autoCreatePR: true,
    autoMerge: false,
    requireReview: true
});

  // Component registration
  useEffect(() => {
    lifecycle.registerComponent('publishing-workflow', {
      capabilities: [
        'version:create', 'version:deploy', 'git:branch', 'git:pr', 'git:merge', 'deploy:trigger', 'deploy:monitor'
      ],
      metadata: {
        version: '1.0.0',
        environments: environments.map(e => e.id),
        gitRepository: gitSettings.repository
  }
  });

    analytics.trackEvent('publishing_workflow_mounted', {
      projectId: project.id,
      environmentsCount: environments.length,
      versionsCount: versions.length,
      timestamp: Date.now()
});

    return () => {
      lifecycle.unregisterComponent('publishing-workflow');
      analytics.trackEvent('publishing_workflow_unmounted', {
        projectId: project.d,
        timestamp: Date.now()
  });
  };
}, [lifecycle, analytics, project.id, environments.length, versions.length, gitSettings.repository]);

  // Version management
  const createNewVersion = useCallback((type: 'patch' | 'minor' | 'major', description: string) => {
    const endTiming = performance.startTiming('version_create');
    
    const newVersion = incrementVersion(currentVersion, type);
    const version: PublishingVersion = {
      id: `version_${Date.now()}`,
      version: newVersion,
      type,
      description,
      createdAt: new Date(),
      createdBy: 'current-user',
      status: 'draft',
      environments:  [],
      changes: generateVersionChanges(project)
};

    setVersions(prev => [version, ...prev]);
    setCurrentVersion(newVersion);
    onVersionCreate(version);
    
    analytics.trackEvent('version_created', {
      projectId: project.id,
      version: newVersion,
      type,
      timestamp: Date.now()
});
    
    endTiming();
}, [currentVersion, project, onVersionCreate, performance, analytics]);

  const incrementVersion = (version: string, type: 'patch' | 'minor' | 'major'): string => {
    const [major, minor, patch] = version.split('.').map(Number);
    
    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default: return version;
}
};

  const generateVersionChanges = (project: Project): VersionChange[] => {
    const changes: VersionChange[] = [];
    
    // Analyze project changes
    Object.values(project.elements).forEach((element, index) => {
      changes.push({
        type: 'added',
        path: `elements/${element.d}`,
        description: `Added ${element.type} element`
    });
  });
    
    return changes;
};

  // Git operations
  const createGitBranch = useCallback((version: string) => {
    const endTiming = performance.startTiming('git_branch_create');
    
    const branchName = `release/v${version}`;
    
    // Simulate git branch creation
    setTimeout(() => {
      analytics.trackEvent('git_branch_created', {
        projectId: project.id,
        version,
        branchName,
        timestamp: Date.now()
  });
      
      setVersions(prev => prev.map(v => 
        v.version === version 
          ? { ...v, gitBranch: branchName }
          : v
      ));
      
      endTiming();
  }, 1000);
}, [project.id, analytics, performance]);

  const createPullRequest = useCallback((version: string) => {
    const endTiming = performance.startTiming('git_pr_create');
    
    const prNumber = Math.floor(Math.random() * 1000) + 1;
    const prUrl = `${gitSettings.repository}/pull/${prNumber}`;
    
    // Simulate PR creation
    setTimeout(() => {
      analytics.trackEvent('git_pr_created', {
        projectId: project.id,
        version,
        prNumber,
        prUrl,
        timestamp: Date.now()
      });
      
      setVersions(prev => prev.map(v => 
        v.version === version 
          ? { ...v, pullRequest: prUrl, status: 'ready' as const }
          : v
      ));
      
      endTiming();
  }, 1500);
}, [project.id, gitSettings.repository, analytics, performance]);

  // Deployment operations
  const deployToEnvironment = useCallback(async (version: string, environmentId: string) => {
    const endTiming = performance.startTiming('deploy_to_environment');
    setIsDeploying(true);
    setDeploymentProgress(0);
    
    try {
      // Simulate deployment process
      const steps = [
        'Preparing deployment...','Building application...','Running tests...','Deploying to environment...','Verifying deployment...'
      ];
      
      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDeploymentProgress(((i + 1) / steps.length) * 100);
    }
      
      // Update environment status
      setEnvironments(prev => prev.map(env => 
        env.id === environmentId 
          ? { ...env, lastDeployed: new Date(), version, status: 'active' as const }
          : env
      ));
      
      // Update version status
      setVersions(prev => prev.map(v => 
        v.version === version 
          ? { ...v, status: 'deployed' as const, environments: [...v.environments, environmentId] }
          : v
      ));
      
      onDeploy(version, environmentId);
      
      analytics.trackEvent('deployment_completed', {
        projectId: project.id,
        version,
        environment: environmentId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      analytics.trackEvent('deployment_failed', {
        projectId: project.id,
        version,
        environment: environmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
  });
  } finally {
      setIsDeploying(false);
      setDeploymentProgress(0);
      endTiming();
  }
}, [project.id, onDeploy, analytics, performance]);

  // Workflow steps
  const workflowSteps = [
    {
      label: 'Create Version',
      description: 'Create a new version with changes',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Create a new version to capture your changes
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => createNewVersion('patch', 'Bug fixes and minor improvements')}
              >
                Patch (1.0.1)
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => createNewVersion('minor', 'New features and enhancements')}
              >
                Minor (1.1.0)
              </Button>
            </Grid>
            <Grid item xs={4}>
              <Button variant="contained"
                fullWidth
                onClick={() => createNewVersion('major', 'Breaking changes and major updates')}
              >
                Major (2.0.0)
              </Button>
            </Grid>
          </Grid>
        </Box>
      )
  },
    {
      label: 'Git Operations',
      description: 'Create branch and pull request',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Manage Git operations for version control
          </Typography>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              startIcon={<GitBranch />}
              onClick={() => createGitBranch(currentVersion)}
            >
              Create Release Branch
            </Button>
            <Button
              variant="outlined"
              startIcon={<Merge />}
              onClick={() => createPullRequest(currentVersion)}
            >
              Create Pull Request
            </Button>
          </Stack>
        </Box>
      )
  },
    {
      label: 'Deploy to Preview',
      description: 'Deploy to preview environment for testing',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Deploy to preview environment for testing and review
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={() => {
              setSelectedEnvironment('preview');
              setShowDeployDialog(true);
            }}
          >
            Deploy to Preview
          </Button>
        </Box>
      )
  },
    {
      label: 'Deploy to Production',
      description: 'Deploy to production environment',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Deploy to production environment
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will deploy to production. Make sure all tests pass and reviews are approved.
          </Alert>
          <Button variant="contained"
            startIcon={<Publish />}
            onClick={() => {
              setSelectedEnvironment('production');
              setShowDeployDialog(true);
          }}
          >
            Deploy to Production
          </Button>
        </Box>
      )
  }
  ];

  const renderEnvironments = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Environments
      </Typography>
      <Grid container spacing={2}>
        {environments.map((env) => (
          <Grid item xs={12} sm={6} md={3} key={env.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <Avatar sx={{ mr: 1, bgcolor: getEnvironmentColor(env.type, )}}>
                    {getEnvironmentIcon(env.type)}
                  </Avatar>
                  <Typography variant="subtitle2">
                    {env.name}
                  </Typography>
                </Box>
                <Chip 
                  size="small" 
                  label={env.status} 
                  color={getStatusColor(env.status)}
                  sx={{ mb:  1 }}
                />
                <Typography variant="caption" display="block">
                  {env.version || 'No version'}
                </Typography>
                {env.lastDeployed && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Last deployed: {env.lastDeployed.toLocaleDateString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderVersions = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Version History
      </Typography>
      <List>
        {versions.slice(0, 5).map((version) => (
          <ListItem key={version.id} divider>
            <ListItemIcon>
              <Avatar sx={{ bgcolor: getVersionColor(version.type) }}>
                {getVersionIcon(version.type)}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={`v${version.version}`}
              secondary={
                <Box>
                  <Typography variant="body2">{version.description as any}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5}}>
                    <Chip size="small" label={version.type} />
                    <Chip size="small" label={version.status} color={getStatusColor(version.status)} />
                    <Chip size="small" label={`${version.changes.length} changes`} variant="outlined" />
                  </Box>
                </Box>
            }
            />
            <ListItemSecondaryAction>
              <Tooltip title="View Details">
                <IconButton>
                  {theming.getThemedIcon('visibility')}
                </IconButton>
              </Tooltip>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  // Helper functions
  const getEnvironmentColor = (type: PublishingEnvironment['type']) => {
    const colors = {
      draft: '#757575',
      preview: '#2196f3',
      staging: '#ff9800',
      production: '#4caf50'
    };
    return colors[type];
  };

  const getEnvironmentIcon = (type: PublishingEnvironment['type']) => {
    const icons = {
      draft: <Save />,
      preview: <Visibility />,
      staging: <Schedule />,
      production: <Publish />
    };
    return icons[type];
  };

  const getVersionColor = (type: PublishingVersion['type']) => {
    const colors = {
      patch: '#4caf50',
      minor: '#2196f3',
      major: '#f44336'
    };
    return colors[type];
  };

  const getVersionIcon = (type: PublishingVersion['type']) => {
    const icons = {
      patch: 'P',
      minor: 'm',
      major: 'M'
    };
    return icons[type];
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'> = {
      active: 'success',
      inactive: 'default',
      building: 'info',
      error: 'error',
      draft: 'default',
      ready: 'info',
      deployed: 'success',
      archived: 'default'
};
    return colors[status] || 'default';
};

  return (
    <Card sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap: 1, mb: 2  }}>
          <Publish color="primary" />
          Publishing Workflow
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Current Version: <strong>v{currentVersion}</strong>
        </Typography>

        {/* Workflow Stepper */}
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb:  3 }}>
          {workflowSteps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="subtitle2">{step.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.description as any}
                </Typography>
              </StepLabel>
              <StepContent>
                {step.content}
                <Box sx={{ mt:  2 }}>
                  <Button variant="contained"
                    onClick={() => setActiveStep(index + 1)}
                    sx={{ mr:  1 }}
                    disabled={index === workflowSteps.length - 1}
                  >
                    {index === workflowSteps.length - 1 ? 'Finish' : 'Continue'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={() => setActiveStep(index - 1)}
                  >
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        <Divider sx={{ my:  2 }} />

        {/* Environments and Versions */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderEnvironments()}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderVersions()}
          </Grid>
        </Grid>

        {/* Deployment Dialog */}
        <Dialog open={showDeployDialog} onClose={() => setShowDeployDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Deploy v{currentVersion} to {selectedEnvironment}
          </DialogTitle>
          <DialogContent>
            {isDeploying ? (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Deploying to {selectedEnvironment}...
                </Typography>
                <LinearProgress variant="determinate" value={deploymentProgress} sx={{ mt:  2 }} />
                <Typography variant="caption" color="text.secondary">
                  {deploymentProgress.toFixed(0)}% complete
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  This will deploy version {currentVersion} to the {selectedEnvironment} environment.
                </Typography>
                {selectedEnvironment === 'production' && (
                  <Alert severity="warning" sx={{ mt:  2 }}>
                    <Typography variant="body2">
                      Production deployment requires approval. Make sure all tests pass and reviews are completed.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeployDialog(false)} disabled={isDeploying}>
              Cancel
            </Button>
            <Button variant="contained"
              onClick={() => selectedEnvironment && deployToEnvironment(currentVersion, selectedEnvironment)}
              disabled={isDeploying}
            >
              {isDeploying ? 'Deploying...' : 'Deploy'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PublishingWorkflow;

