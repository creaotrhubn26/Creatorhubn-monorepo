/**
 * WorkflowAutomationDashboard Component
 * Workflow automation dashboard with management and monitoring
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Divider,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Badge,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepButton,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Add,
  Remove,
  Settings,
  Refresh,
  CheckCircle,
  Error,
  Info,
  Warning,
  Download,
  Upload,
  Code,
  Palette,
  Api,
  Build,
  FilterList,
  Search,
  Sort,
  ViewList,
  ViewModule,
  ViewComfy,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ExpandMore,
  ExpandLess,
  Flag,
  Public,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Queue,
  BarChart,
  PieChart,
  ShowChart,
  Memory,
  Speed as Speed,
  Storage,
  Security,
  Lock,
  Visibility,
  VisibilityOff,
  Edit,
  Delete,
  MoreVert,
  Star,
  StarBorder,
  Favorite,
  FavoriteBorder,
  Schedule,
  Timer,
  Event,
  Timeline,
  AccountTree as FlowChart,
  AccountTree,
  Hub,
  Share,
  Link,
  GetApp,
  Publish,
  CloudUpload,
  CloudDownload,
  CloudSync as CloudSyncIcon,
  CloudQueue,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  CloudSync as CloudSyncIcon2,
  CloudQueue as CloudQueueIcon,
  CloudDone as CloudDoneIcon2,
  CloudOff as CloudOffIcon2,
} from '@mui/icons-material';
import { useWorkflowAutomation, UseWorkflowAutomationOptions } from '../../../hooks/useWorkflowAutomation';
import { WorkflowConfig, Workflow, WorkflowTemplate } from '../../../utils/workflowAutomationManager';

interface WorkflowAutomationDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showTemplates?: boolean;
  showWorkflows?: boolean;
  showExecution?: boolean;
  showScheduling?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onTemplatesClick?: () => void;
  onWorkflowsClick?: () => void;
  onExecutionClick?: () => void;
  onSchedulingClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const WorkflowAutomationDashboard: React.FC<WorkflowAutomationDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showTemplates = true,
  showWorkflows = true,
  showExecution = true,
  showScheduling = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onTemplatesClick,
  onWorkflowsClick,
  onExecutionClick,
  onSchedulingClick,
  className,
  style
}) => {
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showWorkflowsDialog, setShowWorkflowsDialog] = useState(false);
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const [showSchedulingDialog, setShowSchedulingDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  // Workflow automation options
  const workflowOptions: UseWorkflowAutomationOptions = useMemo(() => ({
    onWorkflowCreated: (_data: { workflow: Workflow }) => {
      setPage(0);
  },
    onWorkflowDeleted: (_data: { workflow: Workflow }) => {
      setPage(0);
  },
    onWorkflowExecuted: (_data: { workflow: Workflow }) => {
      setPage(0);
  },
    onWorkflowPaused: (_data: { workflow: Workflow }) => {
      setSelectedWorkflow(_data.workflow);
  },
    onWorkflowResumed: (_data: { workflow: Workflow }) => {
      setSelectedWorkflow(_data.workflow);
  },
    onWorkflowStopped: (_data: { workflow: Workflow }) => {
      setPage(0);
  },
    onWorkflowCompleted: (_data: { workflow: Workflow }) => {
      setFilterType('all');
      setPage(0);
  },
    onWorkflowFailed: (data: { workflow: Workflow; error: string }) => {
      console.error('Workflow failed:', data.error);
  },
    onTemplateCreated: (_data: { template: WorkflowTemplate }) => {
      setPage(0);
  },
    onTemplateDeleted: (_data: { template: WorkflowTemplate }) => {
      setPage(0);
  },
    onError: (error: string) => {
      console.error('Workflow automation error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use workflow automation hook
  const {
    createWorkflow,
    deleteWorkflow,
    executeWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    stopWorkflow,
    createTemplate,
    deleteTemplate,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    workflows,
    templates,
    activeWorkflows,
    runningWorkflows,
    pausedWorkflows,
    errorWorkflows,
    completedWorkflows,
    totalWorkflows,
    totalTemplates,
    activeWorkflowsCount,
    runningWorkflowsCount,
    pausedWorkflowsCount,
    errorWorkflowsCount,
    completedWorkflowsCount,
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageExecutionTime,
    averageMemoryUsage,
    averageCpuUsage,
    totalErrors,
    totalRetries
} = useWorkflowAutomation(workflowOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle management click
  const handleManagementClick = useCallback(() => {
    if (onManagementClick) {
      onManagementClick();
  } else {
      setShowManagementDialog(true);
  }
}, [onManagementClick]);

  // Handle monitoring click
  const handleMonitoringClick = useCallback(() => {
    if (onMonitoringClick) {
      onMonitoringClick();
  } else {
      setShowMonitoringDialog(true);
  }
}, [onMonitoringClick]);

  // Handle templates click
  const handleTemplatesClick = useCallback(() => {
    if (onTemplatesClick) {
      onTemplatesClick();
  } else {
      setShowTemplatesDialog(true);
  }
}, [onTemplatesClick]);

  // Handle workflows click
  const handleWorkflowsClick = useCallback(() => {
    if (onWorkflowsClick) {
      onWorkflowsClick();
  } else {
      setShowWorkflowsDialog(true);
  }
}, [onWorkflowsClick]);

  // Handle execution click
  const handleExecutionClick = useCallback(() => {
    if (onExecutionClick) {
      onExecutionClick();
  } else {
      setShowExecutionDialog(true);
  }
}, [onExecutionClick]);

  // Handle scheduling click
  const handleSchedulingClick = useCallback(() => {
    if (onSchedulingClick) {
      onSchedulingClick();
  } else {
      setShowSchedulingDialog(true);
  }
}, [onSchedulingClick]);

  // Handle create workflow
  const handleCreateWorkflow = useCallback(async () => {
    try {
      const workflowData: Partial<Workflow> = {
        name: 'Sample Workflow',
        description: 'A sample workflow for testing',
        category: 'automation',
        type: 'sequential',
        priority:  0,
        triggers:  [],
        conditions:  [],
        actions:  [],
        variables: {},
        config: {}
    };
      await createWorkflow(workflowData);
  } catch (error) {
      console.error('Failed to create workflow:', error);
  }
}, [createWorkflow]);

  // Handle create template
  const handleCreateTemplate = useCallback(async () => {
    try {
      const templateData: Partial<WorkflowTemplate> = {
        name: 'Sample Template',
        description: 'A sample template for testing',
        category: 'automation',
        type: 'sequential',
        tags: ['sample', 'test'],
        author: 'Sample Author',
        license: 'MI',
        workflow: {},
        variables: {},
        config: {}
    };
      await createTemplate(templateData);
  } catch (error) {
      console.error('Failed to create template:', error);
  }
}, [createTemplate]);

  // Handle delete workflow
  const handleDeleteWorkflow = useCallback(async (workflowId: string) => {
    try {
      await deleteWorkflow(workflowId);
} catch (error) {
      console.error('Failed to delete workflow:', error);
  }
}, [deleteWorkflow]);

  // Handle execute workflow
  const handleExecuteWorkflow = useCallback(async (workflowId: string) => {
    try {
      await executeWorkflow(workflowId);
} catch (error) {
      console.error('Failed to execute workflow:', error);
  }
}, [executeWorkflow]);

  // Handle pause workflow
  const handlePauseWorkflow = useCallback(async (workflowId: string) => {
    try {
      await pauseWorkflow(workflowId);
} catch (error) {
      console.error('Failed to pause workflow:', error);
  }
}, [pauseWorkflow]);

  // Handle resume workflow
  const handleResumeWorkflow = useCallback(async (workflowId: string) => {
    try {
      await resumeWorkflow(workflowId);
} catch (error) {
      console.error('Failed to resume workflow:', error);
  }
}, [resumeWorkflow]);

  // Handle stop workflow
  const handleStopWorkflow = useCallback(async (workflowId: string) => {
    try {
      await stopWorkflow(workflowId);
} catch (error) {
      console.error('Failed to stop workflow:', error);
  }
}, [stopWorkflow]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return theming.getThemedIcon('play');
    return theming.getThemedIcon('warning');
}, [hasError, isInitialized, isEnabled]);

  const statusChipIcon = useMemo(() => {
    const icon = getStatusIcon();
    return React.isValidElement(icon) ? icon : <PlayArrow />;
  }, [getStatusIcon]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Active';
    return 'Disabled';
}, [hasError, isInitialized, isEnabled]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,  };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`Workflows: ${getStatusText()}`}>
      <Chip
        icon={statusChipIcon}
        label={totalWorkflows}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowWorkflowDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ p: 1, minWidth: 200,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowWorkflowDialog(true)}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {totalWorkflows} workflows
          </Typography>
          {runningWorkflowsCount > 0 && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {runningWorkflowsCount} running
            </Typography>
          )}
          {errorWorkflowsCount > 0 && (
            <Typography variant="caption" color="error.main" sx={{ ml:  1 }}>
              {errorWorkflowsCount} errors
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ p: 2, minWidth: 300,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <PlayArrow color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Workflows
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateWorkflow}
            variant="outlined"
            size="small"
          >
            Create
          </Button>
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Workflows
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalWorkflows}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Running
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {runningWorkflowsCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Errors
              </Typography>
              <Typography variant="h4" color={errorWorkflowsCount > 0 ? 'error' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                {errorWorkflowsCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon()}
                <Typography variant="body2" color={getStatusColor() + '.main'}>
                  {getStatusText()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {totalExecutions > 0 && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Total executions: {totalExecutions} times
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Workflow Dialog */}
      <Dialog open={showWorkflowDialog} onClose={() => setShowWorkflowDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('play')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Workflow Automation Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Workflows" />
            <Tab label="Templates" />
            <Tab label="Execution" />
            <Tab label="Scheduling" />
            <Tab label="Monitoring" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Workflows
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalWorkflows}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Running
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {runningWorkflowsCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Errors
                    </Typography>
                    <Typography variant="h4" color={errorWorkflowsCount > 0 ? 'error' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                      {errorWorkflowsCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon()}
                      <Typography variant="body2" color={getStatusColor() + '.main'}>
                        {getStatusText()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Workflow Management
              </Typography>
              <List>
                {workflows.map((workflow) => (
                  <ListItem key={workflow.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {theming.getThemedIcon('play')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={workflow.name}
                      secondary={`${workflow.category} • ${workflow.status} • ${workflow.version}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => handleExecuteWorkflow(workflow.id)}
                          disabled={workflow.status === 'running'}
                          startIcon={theming.getThemedIcon('play')}
                        >
                          Execute
                        </Button>
                        <Button
                          onClick={() => handlePauseWorkflow(workflow.id)}
                          disabled={workflow.status !== 'running'}
                          startIcon={theming.getThemedIcon('pause')}
                        >
                          Pause
                        </Button>
                        <Button
                          onClick={() => handleStopWorkflow(workflow.id)}
                          disabled={workflow.status === 'inactive'}
                          startIcon={theming.getThemedIcon('stop')}
                        >
                          Stop
                        </Button>
                        <Button
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                          startIcon={theming.getThemedIcon('delete')}
                          color="error"
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Template Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total templates: {totalTemplates}
              </Typography>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Execution Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Executions
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {totalExecutions}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Successful
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                        {successfulExecutions}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Failed
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                        {failedExecutions}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Execution Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageExecutionTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Scheduling
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Schedule management and monitoring
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Memory Usage
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageMemoryUsage.toFixed(2)}MB
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg CPU Usage
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageCpuUsage.toFixed(2)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Errors
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                        {totalErrors}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Retries
                      </Typography>
                      <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                        {totalRetries}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowWorkflowDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateWorkflow}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            Create Workflow
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Workflow Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableWorkflows}
                    onChange={(e) => updateConfig({ enableWorkflows: e.target.checked })}
                  />
              }
                label="Enable Workflows"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTemplates}
                    onChange={(e) => updateConfig({ enableTemplates: e.target.checked })}
                  />
              }
                label="Enable Templates"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAutomation}
                    onChange={(e) => updateConfig({ enableAutomation: e.target.checked })}
                  />
              }
                label="Enable Automation"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableScheduling}
                    onChange={(e) => updateConfig({ enableScheduling: e.target.checked })}
                  />
              }
                label="Enable Scheduling"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTriggers}
                    onChange={(e) => updateConfig({ enableTriggers: e.target.checked })}
                  />
              }
                label="Enable Triggers"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableConditions}
                    onChange={(e) => updateConfig({ enableConditions: e.target.checked })}
                  />
              }
                label="Enable Conditions"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableActions}
                    onChange={(e) => updateConfig({ enableActions: e.target.checked })}
                  />
              }
                label="Enable Actions"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableValidation}
                    onChange={(e) => updateConfig({ enableValidation: e.target.checked })}
                  />
              }
                label="Enable Validation"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCaching}
                    onChange={(e) => updateConfig({ enableCaching: e.target.checked })}
                  />
              }
                label="Enable Caching"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableLogging}
                    onChange={(e) => updateConfig({ enableLogging: e.target.checked })}
                  />
              }
                label="Enable Logging"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableMetrics}
                    onChange={(e) => updateConfig({ enableMetrics: e.target.checked })}
                  />
                }
                label="Enable Metrics"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

WorkflowAutomationDashboard.displayName ='WorkflowAutomationDashboard';

export default WorkflowAutomationDashboard;



