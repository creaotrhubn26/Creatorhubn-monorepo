/**
 * AIIntegrationDashboard Component
 * AI integration dashboard with management and monitoring
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
  Psychology,
  Add,
  Remove,
  PlayArrow,
  Pause,
  Stop,
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
  SmartToy,
  AutoAwesome,
  Lightbulb,
  Insights,
  TrendingUp,
  Analytics,
  Assessment,
  DataUsage,
  Functions,
  IntegrationInstructions as Integration,
  Extension,
  ExtensionOff,
  ExtensionOutlined,
  ExtensionRounded,
  ExtensionSharp,
  ExtensionTwoTone,
} from '@mui/icons-material';
import Grid from '@mui/material/Grid2';
import { useAIIntegration, UseAIIntegrationOptions } from '../../../hooks/useAIIntegration';
import { AIConfig, AIPrompt, AIResponse, AIContext, AILearning, AIOptimization } from '../../../utils/aiIntegrationManager';

interface AIIntegrationDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showPrompts?: boolean;
  showResponses?: boolean;
  showContexts?: boolean;
  showLearning?: boolean;
  showOptimizations?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onPromptsClick?: () => void;
  onResponsesClick?: () => void;
  onContextsClick?: () => void;
  onLearningClick?: () => void;
  onOptimizationsClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const AIIntegrationDashboard: React.FC<AIIntegrationDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showPrompts = true,
  showResponses = true,
  showContexts = true,
  showLearning = true,
  showOptimizations = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onPromptsClick,
  onResponsesClick,
  onContextsClick,
  onLearningClick,
  onOptimizationsClick,
  className,
  style
}) => {
  const [showAIDialog, setShowAIDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showPromptsDialog, setShowPromptsDialog] = useState(false);
  const [showResponsesDialog, setShowResponsesDialog] = useState(false);
  const [showContextsDialog, setShowContextsDialog] = useState(false);
  const [showLearningDialog, setShowLearningDialog] = useState(false);
  const [showOptimizationsDialog, setShowOptimizationsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPrompt | null>(null);

  // AI integration options
  const aiOptions: UseAIIntegrationOptions = useMemo(() => ({
    onPromptCreated: (_data: { prompt: AIPrompt }) => {
      setPage(0);
  },
    onPromptExecuted: (_data: { prompt: AIPrompt; response: AIResponse }) => {
      setPage(0);
  },
    onPromptExecutionFailed: (data: { prompt: AIPrompt; response: AIResponse; error: string }) => {
      console.error('Prompt execution failed: ', data.error);
  },
    onContextCreated: (_data: { context: AIContext }) => {
      setPage(0);
  },
    onLearningCreated: (_data: { learning: AILearning }) => {
      setPage(0);
  },
    onOptimizationCreated: (_data: { optimization: AIOptimization }) => {
      setPage(0);
  },
    onError: (error: string) => {
      console.error('AI integration error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use AI integration hook
  const {
    createPrompt,
    executePrompt,
    createContext,
    createLearning,
    createOptimization,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    prompts,
    responses,
    contexts,
    learning,
    optimizations,
    totalPrompts,
    totalResponses,
    totalContexts,
    totalLearning,
    totalOptimizations,
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageExecutionTime,
    averageMemoryUsage,
    averageAccuracy,
    averageConfidence,
    totalTokens,
    totalCost,
    totalErrors
} = useAIIntegration(aiOptions);

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

  // Handle prompts click
  const handlePromptsClick = useCallback(() => {
    if (onPromptsClick) {
      onPromptsClick();
  } else {
      setShowPromptsDialog(true);
  }
}, [onPromptsClick]);

  // Handle responses click
  const handleResponsesClick = useCallback(() => {
    if (onResponsesClick) {
      onResponsesClick();
  } else {
      setShowResponsesDialog(true);
  }
}, [onResponsesClick]);

  // Handle contexts click
  const handleContextsClick = useCallback(() => {
    if (onContextsClick) {
      onContextsClick();
  } else {
      setShowContextsDialog(true);
  }
}, [onContextsClick]);

  // Handle learning click
  const handleLearningClick = useCallback(() => {
    if (onLearningClick) {
      onLearningClick();
  } else {
      setShowLearningDialog(true);
  }
}, [onLearningClick]);

  // Handle optimizations click
  const handleOptimizationsClick = useCallback(() => {
    if (onOptimizationsClick) {
      onOptimizationsClick();
  } else {
      setShowOptimizationsDialog(true);
  }
}, [onOptimizationsClick]);

  // Handle create prompt
  const handleCreatePrompt = useCallback(async () => {
    try {
      const promptData: Partial<AIPrompt> = {
        name: 'Sample Prompt',
        description: 'A sample prompt for testing',
        category: 'content',
        type: 'text',
        template: 'Generate content, for: {input}',
        variables: { input: 'sample'},
        context:  [],
        examples:  [],
        config: {},
    };
      await createPrompt(promptData);
  } catch (error) {
      console.error('Failed to create prompt:', error);
  }
}, [createPrompt]);

  // Handle create context
  const handleCreateContext = useCallback(async () => {
    try {
      const contextData: Partial<AIContext> = {
        name: 'Sample Context',
        description: 'A sample context for testing',
        type: 'user',
        data: { userId: 'sample'},
        config: {},
    };
      await createContext(contextData);
  } catch (error) {
      console.error('Failed to create context:', error);
  }
}, [createContext]);

  // Handle create learning
  const handleCreateLearning = useCallback(async () => {
    try {
      const learningData: Partial<AILearning> = {
        name: 'Sample Learning',
        description: 'A sample learning model for testing',
        type: 'supervised',
        data:  [],
        model: 'default',
        parameters: {},
        config: {},
    };
      await createLearning(learningData);
  } catch (error) {
      console.error('Failed to create learning:', error);
  }
}, [createLearning]);

  // Handle create optimization
  const handleCreateOptimization = useCallback(async () => {
    try {
      const optimizationData: Partial<AIOptimization> = {
        name: 'Sample Optimization',
        description: 'A sample optimization for testing',
        type: 'prompt',
        target: 'accuracy',
        parameters: {},
        results: {},
        config: {},
    };
      await createOptimization(optimizationData);
  } catch (error) {
      console.error('Failed to create optimization:', error);
  }
}, [createOptimization]);

  // Handle execute prompt
  const handleExecutePrompt = useCallback(async (promptId: string, input: string) => {
    try {
      await executePrompt(promptId, input);
  } catch (error) {
      console.error('Failed to execute prompt:', error);
  }
}, [executePrompt]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback((): React.ReactElement => {
    if (hasError) {
      return <Error color="error" fontSize="small" />;
    }
    if (!isInitialized) {
      return <CircularProgress size={16} />;
    }
    if (isEnabled) {
      return <Psychology color="success" fontSize="small" />;
    }
    return <Warning color="warning" fontSize="small" />;
  }, [hasError, isInitialized, isEnabled]);

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
      zIndex: 1000};

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)'};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)'};
      default: return { ...baseStyles, top:  16, right: 16};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`AI: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalPrompts}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowAIDialog(true)}
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
          <IconButton size="small" onClick={() => setShowAIDialog(true)}>
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
            {totalPrompts} prompts
          </Typography>
          {totalExecutions > 0 && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {totalExecutions} executions
            </Typography>
          )}
          {totalErrors > 0 && (
            <Typography variant="caption" color="error.main" sx={{ ml:  1 }}>
              {totalErrors} errors
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
          <Psychology color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            AI Integration
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreatePrompt}
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
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Prompts
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalPrompts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Executions
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalExecutions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Accuracy
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {averageAccuracy.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
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
      
      {totalCost > 0 && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Total cost: ${totalCost.toFixed()}
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

      {/* AI Dialog */}
      <Dialog open={showAIDialog} onClose={() => setShowAIDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Psychology />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>AI Integration Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Prompts" />
            <Tab label="Responses" />
            <Tab label="Contexts" />
            <Tab label="Learning" />
            <Tab label="Optimizations" />
            <Tab label="Monitoring" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Prompts
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalPrompts}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Executions
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalExecutions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Accuracy
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {averageAccuracy.toFixed(1)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
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
                Prompt Management
              </Typography>
              <List>
                {prompts.map((prompt) => (
                  <ListItem key={prompt.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Psychology />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={prompt.name}
                      secondary={`${prompt.category} • ${prompt.type} • ${prompt.metadata.usageCount} uses`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => handleExecutePrompt(prompt.id, 'sample input')}
                          startIcon={theming.getThemedIcon('play')}
                        >
                          Execute
                        </Button>
                        <Button
                          onClick={() => setSelectedPrompt(prompt)}
                          startIcon={theming.getThemedIcon('edit')}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {/* Handle delete */}}
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
                Response Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total responses: {totalResponses}
              </Typography>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Context Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total contexts: {totalContexts}
              </Typography>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Learning Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total learning models: {totalLearning}
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Optimization Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total optimizations: {totalOptimizations}
              </Typography>
            </Box>
          )}
          
          {activeTab === 6 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
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
                
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
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
                
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Tokens
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {totalTokens.toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Cost
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                        ${totalCost.toFixed(4)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowAIDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreatePrompt}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            Create Prompt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>AI Integration Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAI}
                    onChange={(e) => updateConfig({ enableAI: e.target.checked })}
                  />
              }
                label="Enable AI Integration"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePrompts}
                    onChange={(e) => updateConfig({ enablePrompts: e.target.checked })}
                  />
              }
                label="Enable Prompts"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableResponses}
                    onChange={(e) => updateConfig({ enableResponses: e.target.checked })}
                  />
              }
                label="Enable Responses"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableContext}
                    onChange={(e) => updateConfig({ enableContext: e.target.checked })}
                  />
              }
                label="Enable Context"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableLearning}
                    onChange={(e) => updateConfig({ enableLearning: e.target.checked })}
                  />
              }
                label="Enable Learning"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableOptimization}
                    onChange={(e) => updateConfig({ enableOptimization: e.target.checked })}
                  />
              }
                label="Enable Optimization"
              />
            </Grid>
            
            <Grid size={12}>
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
            
            <Grid size={12}>
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
            
            <Grid size={12}>
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

AIIntegrationDashboard.displayName ='AIIntegrationDashboard';

export default AIIntegrationDashboard;



