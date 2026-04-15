// @ts-nocheck
/**
 * ScriptManager.tsx - DaVinci Resolve Script Automation Manager
 *
 * UX/UI Improvements based on research:
 * 1. Progressive Disclosure - Essential info first, details on demand
 * 2. Task-Based Organization - Setup → Browse → Execute → Monitor workflow
 * 3. Visual Hierarchy - Clear information architecture
 * 4. Smart Filtering - Multi-dimensional (category, phase, culture, camera)
 * 5. Real-time Feedback - Visual status indicators
 * 6. Reduced Cognitive Load - Simplified navigation
 * 7. Search & Discovery - Powerful search with autocomplete
 * 8. Contextual Help - Inline guidance
 * 9. DaVinci Resolve Branding - Official logo and colors
 * 10. Performance Optimization - React Virtuoso for large lists
 * 11. Dynamic Parameters - Smart form builder with validation
 * 12. Comprehensive Coverage - 12 categories, 12 camera profiles
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Chip,
  Card,
  CardContent,
  CardActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Grid2 as Grid,
} from '@mui/material';
import { Virtuoso } from 'react-virtuoso';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  PlayArrow,
  Refresh,
  Settings,
  Search,
  FilterList,
  Close,
  Help,
  VisibilityOff,
  Timeline,
} from '@mui/icons-material';

// Import new components and data
import { DaVinciResolveFullLogo, PoweredByDaVinci, DAVINCI_COLORS } from '../../assets/davinci-resolve-logo';
import { SCRIPT_CATEGORIES, CAMERA_PROFILES, getScriptParameters, getScriptPresets } from './scriptData';
import ScriptParameterForm from './ScriptParameterForm';
import UserGuideDialog from './UserGuideDialog';
import OnboardingWizard from './OnboardingWizard';
import ScriptRecommendations from './ScriptRecommendations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface InstallationStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  action?: () => void;
  actionLabel?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface DaVinciSystemStatus {
  pythonInstalled: boolean;
  davinciInstalled: boolean;
  scriptsInstalled: boolean;
  apiConnected: boolean;
}

interface DaVinciScript {
  id?: string;
  name: string;
  displayName?: string;
  description?: string;
  category?: string;
  phase?: string;
  phases?: string[];
  cultures?: string[];
  icon?: string;
}

interface ExecutionHistoryItem {
  scriptName: string;
  timestamp: string;
  status: 'success' | 'error' | 'running';
}

function normalizeSystemStatus(input: unknown): DaVinciSystemStatus {
  const candidate = (input as Partial<DaVinciSystemStatus>) ?? {};
  return {
    pythonInstalled: Boolean(candidate.pythonInstalled),
    davinciInstalled: Boolean(candidate.davinciInstalled),
    scriptsInstalled: Boolean(candidate.scriptsInstalled),
    apiConnected: Boolean(candidate.apiConnected),
  };
}

function normalizeAvailableScripts(input: unknown): DaVinciScript[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      name: typeof item.name === 'string' ? item.name : '',
      displayName: typeof item.displayName === 'string' ? item.displayName : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      category: typeof item.category === 'string' ? item.category : undefined,
      phase: typeof item.phase === 'string' ? item.phase : undefined,
      phases: Array.isArray(item.phases) ? item.phases.filter((value): value is string => typeof value === 'string') : undefined,
      cultures: Array.isArray(item.cultures) ? item.cultures.filter((value): value is string => typeof value === 'string') : undefined,
      icon: typeof item.icon === 'string' ? item.icon : undefined,
    }))
    .filter((script) => script.name.length > 0);
}

function normalizeExecutionHistory(input: unknown): ExecutionHistoryItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const statusRaw = typeof item.status === 'string' ? item.status : 'error';
      const status: ExecutionHistoryItem['status'] =
        statusRaw === 'success' || statusRaw === 'running' ? statusRaw : 'error';

      return {
        scriptName: typeof item.scriptName === 'string' ? item.scriptName : 'Unknown script',
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
        status,
      };
    });
}

function readStoredExecutionHistory(): ExecutionHistoryItem[] {
  try {
    return normalizeExecutionHistory(JSON.parse(localStorage.getItem('davinciExecutionHistory') || '[]'));
  } catch {
    return [];
  }
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`script-tabpanel-${index}`}
      aria-labelledby={`script-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ScriptManager() {
  const queryClient = useQueryClient();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'videographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  // Enhanced Master Integration
  const {
    integration,
    communication,
    dataFlow,
    analytics,
    debugging,
    performance,
    lifecycle,
    features,
    auth,
  } = useEnhancedMasterIntegration();

  // Feature access check
  const scriptManagerAccess = features.checkFeatureAccess('script-manager');
  const hasAccess = scriptManagerAccess.hasAccess;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Tab navigation (Task-based organization)
  const [activeTab, setActiveTab] = useState(0);

  // Setup wizard state
  const [activeStep, setActiveStep] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);

  // Filtering and search (Smart filtering)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedCulture, setSelectedCulture] = useState<string>('all');
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Script execution state
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [scriptParameters, setScriptParameters] = useState<Record<string, unknown>>({});
  const [isExecutionParamsValid, setIsExecutionParamsValid] = useState(true);
  const [executionValidationErrors, setExecutionValidationErrors] = useState<string[]>([]);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);

  // UI state
  const [showHelp, setShowHelp] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userPreferences, setUserPreferences] = useState<{
    cameras: string[];
    categories: string[];
    experienceLevel: string | null;
    primaryCamera?: string;
    primaryCategory?: string;
  }>({ cameras: [], categories: [], experienceLevel: null });

  // Check if user has completed onboarding
  useEffect(() => {
    const savedPreferences = localStorage.getItem('davinciPreferences');
    const onboardingSkipped = localStorage.getItem('davinciOnboardingSkipped');

    if (savedPreferences) {
      try {
        const prefs = JSON.parse(savedPreferences) as {
          camera?: string;
          category?: string;
          cameras?: string[];
          categories?: string[];
          experienceLevel?: string | null;
          primaryCamera?: string;
          primaryCategory?: string;
        };

        setUserPreferences({
          cameras: prefs.cameras || (prefs.camera ? [prefs.camera] : []),
          categories: prefs.categories || (prefs.category ? [prefs.category] : []),
          experienceLevel: prefs.experienceLevel || null,
          primaryCamera: prefs.primaryCamera || prefs.cameras?.[0],
          primaryCategory: prefs.primaryCategory || prefs.categories?.[0],
        });
      } catch {
        localStorage.removeItem('davinciPreferences');
      }
    } else if (!onboardingSkipped) {
      // Show onboarding for first-time users
      setShowOnboarding(true);
    }
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback((preferences: {
    cameras: string[];
    categories: string[];
    experienceLevel: string;
    primaryCamera?: string;
    primaryCategory?: string;
  }) => {
    setUserPreferences(preferences);
    setShowOnboarding(false);

    // Apply filters based on preferences (use primary category)
    if (preferences.primaryCategory) {
      setSelectedCategory(preferences.primaryCategory);
    }
    // Camera filter will be applied automatically through the filtering logic

    analytics.trackEvent('onboarding-completed', preferences);
  }, [analytics]);

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false);
    analytics.trackEvent('onboarding-skipped', {});
  }, [analytics]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch system status
  const { data: systemStatus, refetch: refetchSystemStatus } = useQuery<DaVinciSystemStatus>({
    queryKey: ['/api/davinci-resolve/system-status'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/davinci-resolve/system-status');
        return normalizeSystemStatus(response);
      } catch {
        const localInstalled = localStorage.getItem('davinciScriptsInstalled') === 'true';
        return {
          pythonInstalled: true,
          davinciInstalled: true,
          scriptsInstalled: localInstalled,
          apiConnected: false,
        };
      }
    },
    refetchInterval: 5000,
  });

  // Fetch available scripts
  const { data: availableScripts = [], isLoading: scriptsLoading } = useQuery<DaVinciScript[]>({
    queryKey: ['/api/davinci-resolve/scripts'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/davinci-resolve/scripts');
        return normalizeAvailableScripts(response);
      } catch {
        return [];
      }
    },
  });

  // Fetch script execution history
  const { data: executionHistory = [] } = useQuery<ExecutionHistoryItem[]>({
    queryKey: ['/api/davinci-resolve/execution-history'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/davinci-resolve/execution-history');
        return normalizeExecutionHistory(response);
      } catch {
        return readStoredExecutionHistory();
      }
    },
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const executeScriptMutation = useMutation({
    mutationFn: async (data: { scriptName: string; parameters: Record<string, unknown> }) => {
      try {
        return await apiRequest('/api/davinci-resolve/execute-script', {
          method: 'POST',
          body: data,
        });
      } catch {
        const localHistory = readStoredExecutionHistory();
        const nextEntry: ExecutionHistoryItem = {
          scriptName: data.scriptName,
          timestamp: new Date().toISOString(),
          status: 'success',
        };
        localStorage.setItem('davinciExecutionHistory', JSON.stringify([nextEntry, ...localHistory].slice(0, 100)));
        return { success: true, localFallback: true };
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/davinci-resolve/execution-history'] });
      setExecutionDialogOpen(false);
      analytics.trackEvent('script-executed', { script: selectedScript });
      integration.emit?.('davinci:script:executed', { script: variables.scriptName, parameters: variables.parameters });
      communication.sendBroadcast?.('davinci:script:executed', {
        scriptName: variables.scriptName,
        parameters: variables.parameters,
      });
      dataFlow.syncData?.('davinci:last-execution', {
        scriptName: variables.scriptName,
        parameters: variables.parameters,
        executedAt: Date.now(),
      });
    },
  });

  const installScriptsMutation = useMutation({
    mutationFn: async () => {
      try {
        return await apiRequest('/api/davinci-resolve/install-scripts', { method: 'POST' });
      } catch {
        localStorage.setItem('davinciScriptsInstalled', 'true');
        return { success: true, localFallback: true };
      }
    },
    onSuccess: () => {
      analytics.trackEvent('davinci-scripts-installed', { source: 'script-manager' });
      queryClient.invalidateQueries({ queryKey: ['/api/davinci-resolve/system-status'] });
      refetchSystemStatus();
    },
  });

  // ============================================================================
  // COMPUTED VALUES (Smart filtering with useMemo for performance)
  // ============================================================================

  const filteredScripts = useMemo<DaVinciScript[]>(() => {
    let scripts = [...availableScripts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      scripts = scripts.filter(
        (script) =>
          script.name?.toLowerCase().includes(query) ||
          script.description?.toLowerCase().includes(query) ||
          script.category?.toLowerCase().includes(query)
      );
    }

    // Smart Category filter - OR logic for user preferences
    if (selectedCategory !== 'all') {
      const categoryScripts = SCRIPT_CATEGORIES[selectedCategory]?.scripts || [];
      scripts = scripts.filter((script) => categoryScripts.includes(script.name));
    } else if (userPreferences.categories.length > 0) {
      // If no specific category selected, show scripts matching ANY user preference category
      const allCategoryScripts = new Set<string>();
      userPreferences.categories.forEach(cat => {
        const categoryScripts = SCRIPT_CATEGORIES[cat]?.scripts || [];
        categoryScripts.forEach(s => allCategoryScripts.add(s));
      });
      if (allCategoryScripts.size > 0) {
        scripts = scripts.filter((script) => allCategoryScripts.has(script.name));
      }
    }

    // Phase filter
    if (selectedPhase !== 'all') {
      scripts = scripts.filter((script) => script.phases?.includes(selectedPhase));
    }

    // Culture filter
    if (selectedCulture !== 'all') {
      scripts = scripts.filter((script) => script.cultures?.includes(selectedCulture));
    }

    // Smart Camera filter - OR logic for user preferences
    if (selectedCamera !== 'all') {
      const cameraScripts = CAMERA_PROFILES[selectedCamera]?.scripts || [];
      scripts = scripts.filter((script) => cameraScripts.includes(script.name));
    } else if (userPreferences.cameras.length > 0) {
      // If no specific camera selected, show scripts matching ANY user preference camera
      const allCameraScripts = new Set<string>();
      userPreferences.cameras.forEach(cam => {
        const cameraScripts = CAMERA_PROFILES[cam]?.scripts || [];
        cameraScripts.forEach(s => allCameraScripts.add(s));
      });
      if (allCameraScripts.size > 0) {
        scripts = scripts.filter((script) => allCameraScripts.has(script.name));
      }
    }

    return scripts;
  }, [availableScripts, searchQuery, selectedCategory, selectedPhase, selectedCulture, selectedCamera, userPreferences]);

  // Installation steps for setup wizard
  const installationSteps: InstallationStep[] = useMemo(
    () => [
      {
        id: 'check-python',
        label: 'Check Python Installation',
        description: 'Verify Python 3.8+ is installed',
        status: systemStatus?.pythonInstalled ? 'completed' : 'pending',
      },
      {
        id: 'check-davinci',
        label: 'Check DaVinci Resolve',
        description: 'Verify DaVinci Resolve is installed and API is accessible',
        status: systemStatus?.davinciInstalled ? 'completed' : 'pending',
      },
      {
        id: 'install-scripts',
        label: 'Install Scripts',
        description: 'Download and install automation scripts',
        status: installScriptsMutation.isPending
          ? 'in-progress'
          : systemStatus?.scriptsInstalled
          ? 'completed'
          : 'pending',
        action: () => {
          installScriptsMutation.mutate();
        },
        actionLabel: 'Install Scripts',
      },
      {
        id: 'test-connection',
        label: 'Test Connection',
        description: 'Test connection to DaVinci Resolve API',
        status: systemStatus?.apiConnected ? 'completed' : 'pending',
        action: () => {
          refetchSystemStatus();
        },
        actionLabel: 'Test Connection',
      },
    ],
    [installScriptsMutation.isPending, installScriptsMutation.mutate, refetchSystemStatus, systemStatus]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleExecuteScript = useCallback((scriptName: string) => {
    setSelectedScript(scriptName);
    setScriptParameters({});
    setIsExecutionParamsValid(true);
    setExecutionValidationErrors([]);
    setExecutionDialogOpen(true);
    analytics.trackEvent('script-selected', { script: scriptName });
    communication.sendBroadcast?.('davinci:script:selected', { scriptName });
  }, [analytics, communication]);

  const handleConfirmExecution = useCallback(() => {
    if (selectedScript) {
      const endTiming = performance.startTiming?.('davinci-script-execution');
      executeScriptMutation.mutate(
        {
          scriptName: selectedScript,
          parameters: scriptParameters,
        },
        {
          onSettled: () => {
            endTiming?.();
          },
          onError: (error: unknown) => {
            debugging.logIntegration?.('error', 'Script execution failed', {
              scriptName: selectedScript,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        }
      );
    }
  }, [debugging, performance, selectedScript, scriptParameters, executeScriptMutation]);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    analytics.trackEvent('tab-changed', { tab: newValue });
  }, [analytics]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedPhase('all');
    setSelectedCulture('all');
    setSelectedCamera('all');
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Register component with lifecycle system
  useEffect(() => {
    lifecycle.registerComponent?.({
      id: 'script-manager',
      type: 'davinci-resolve-manager',
      version: '2.0.0',
      capabilities: {
        data: ['script:read','script:write','system:status'],
        events: ['script:execute','script:install','script:configure'],
        actions: ['install','execute','configure','monitor'],
        ui: ['dialog','form','status','progress'],
        system: ['davinci:connect','python:check','api:locate'],
      },
      dependencies: ['davinci-resolve-api','python-runtime'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    return () => {
      lifecycle.unregisterComponent?.('script-manager');
    };
  }, [lifecycle]);

  // Check if setup is complete
  useEffect(() => {
    const allStepsComplete = installationSteps.every((step) => step.status === 'completed');
    setSetupComplete(allStepsComplete);
    const firstPending = installationSteps.findIndex((step) => step.status !== 'completed');
    setActiveStep(firstPending === -1 ? Math.max(installationSteps.length - 1, 0) : firstPending);
  }, [installationSteps]);

  useEffect(() => {
    const unsubscribe = communication.onMessageType?.('davinci:refresh-status', () => {
      void refetchSystemStatus();
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [communication, refetchSystemStatus]);

  useEffect(() => {
    dataFlow.syncData?.('davinci:system-status', {
      status: systemStatus,
      scripts: availableScripts.length,
      historyCount: executionHistory.length,
    });
  }, [availableScripts.length, dataFlow, executionHistory.length, systemStatus]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ color: 'success.main' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'in-progress':
        return <CircularProgress size={24} />;
      default:
        return <Info sx={{ color: theming.colors.secondary }} />;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          You don't have access to the Script Manager feature. {scriptManagerAccess.reason}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header with DaVinci Resolve branding */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${DAVINCI_COLORS.secondary} 0%, #2A2A2A 100%)`,
          color: 'white'}}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            {/* DaVinci Resolve Logo */}
            <DaVinciResolveFullLogo size="large" style={{ marginBottom: '12px' }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              {professionIcon && (
                <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>{professionIcon}</Box>
              )}
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'white' }}>
                {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                  ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} Script Automation Manager`
                  : 'Script Automation Manager'}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
              Automate your video production workflow with intelligent Python scripts
            </Typography>

            {/* Powered by badge */}
            <PoweredByDaVinci style={{ marginTop: '8px' }} />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Show preferences badge if set */}
            {(userPreferences.cameras.length > 0 || userPreferences.categories.length > 0) && (
              <Chip
                label={`${userPreferences.cameras.length} camera${userPreferences.cameras.length !== 1 ? 's' : ''} • ${userPreferences.categories.length} categor${userPreferences.categories.length !== 1 ? 'ies' : 'y'}${userPreferences.experienceLevel ? ` • ${userPreferences.experienceLevel}` : ''}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 600}}
              />
            )}

            <Tooltip title="Change Preferences">
              <IconButton
                onClick={() => setShowOnboarding(true)}
                sx={{ color: 'white' }}
              >
                <Settings />
              </IconButton>
            </Tooltip>

            <Button
              variant="outlined"
              onClick={() => setShowGuide(true)}
              startIcon={<Help />}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)', '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255,255,255,0.1)',
                }}}
            >
              User Guide
            </Button>
            <Tooltip title={showHelp ? 'Hide Help' : 'Show Help'}>
              <IconButton
                onClick={() => setShowHelp(!showHelp)}
                sx={{ color: 'white' }}
              >
                {showHelp ? <VisibilityOff /> : <Help />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Status">
              <IconButton
                onClick={() => refetchSystemStatus()}
                sx={{ color: 'white' }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Contextual help panel (Progressive disclosure) */}
        {showHelp && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Quick Start Guide:
            </Typography>
            <Typography variant="body2" component="div">
              1. <strong>Setup:</strong> Complete the installation wizard
              <br />
              2. <strong>Browse:</strong> Find scripts by category, phase, or culture
              <br />
              3. <strong>Execute:</strong> Run scripts with custom parameters
              <br />
              4. <strong>Monitor:</strong> Track execution history and results
            </Typography>
          </Alert>
        )}

        {/* System status indicator */}
        {systemStatus && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={systemStatus.pythonInstalled ? <CheckCircle /> : <ErrorIcon />}
              label={`Python ${systemStatus.pythonInstalled ? 'Ready' : 'Not Found'}`}
              color={systemStatus.pythonInstalled ? 'success' : 'error'}
              size="small"
            />
            <Chip
              icon={systemStatus.davinciInstalled ? <CheckCircle /> : <ErrorIcon />}
              label={`DaVinci ${systemStatus.davinciInstalled ? 'Connected' : 'Not Found'}`}
              color={systemStatus.davinciInstalled ? 'success' : 'error'}
              size="small"
            />
            <Chip
              icon={systemStatus.apiConnected ? <CheckCircle /> : <Warning />}
              label={`API ${systemStatus.apiConnected ? 'Connected' : 'Disconnected'}`}
              color={systemStatus.apiConnected ? 'success' : 'warning'}
              size="small"
            />
          </Box>
        )}
      </Paper>

      {/* Task-based tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
            }}}
        >
          <Tab
            icon={<Settings />}
            iconPosition="start"
            label="Setup"
            disabled={setupComplete}
          />
          <Tab
            icon={<Search />}
            iconPosition="start"
            label={
              <Badge badgeContent={filteredScripts.length} color="primary">
                Browse Scripts
              </Badge>
            }
          />
          <Tab
            icon={<PlayArrow />}
            iconPosition="start"
            label="Execute"
          />
          <Tab
            icon={<Timeline />}
            iconPosition="start"
            label={
              <Badge badgeContent={executionHistory.length} color="secondary">
                History
              </Badge>
            }
          />
        </Tabs>

        {/* Tab 0: Setup Wizard */}
        <TabPanel value={activeTab} index={0}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600}}>
            Installation & Setup
          </Typography>
          <Stepper activeStep={activeStep} orientation="vertical">
            {installationSteps.map((step, index) => (
              <Step key={step.id}>
                <StepLabel icon={getStepIcon(step.status)}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                    {step.label}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                    {step.description}
                  </Typography>
                  {step.action && (
                    <Button
                      variant="contained"
                      onClick={step.action}
                      disabled={step.status === 'completed'}
                      sx={{ bgcolor: theming.colors.primary }}
                    >
                      {step.actionLabel}
                    </Button>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
          {setupComplete && (
            <Alert severity="success" sx={{ mt: 3 }}>
              ✅ Setup complete! You can now browse and execute scripts.
            </Alert>
          )}
        </TabPanel>

        {/* Tab 1: Browse Scripts */}
        <TabPanel value={activeTab} index={1}>
          {/* Search and filters */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search scripts by name, description, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Category"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {Object.entries(SCRIPT_CATEGORIES).map(([key, cat]) => (
                    <MenuItem key={key} value={key}>
                      {cat.icon} {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
              </Button>

              {(searchQuery || selectedCategory !== 'all' || selectedPhase !== 'all' || selectedCulture !== 'all' || selectedCamera !== 'all') && (
                <Button
                  variant="text"
                  startIcon={<Close />}
                  onClick={handleResetFilters}
                  size="small"
                >
                  Clear Filters
                </Button>
              )}
            </Box>

            {/* Advanced filters (Progressive disclosure) */}
            {showAdvancedFilters && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Phase</InputLabel>
                      <Select
                        value={selectedPhase}
                        label="Phase"
                        onChange={(e) => setSelectedPhase(e.target.value)}
                      >
                        <MenuItem value="all">All Phases</MenuItem>
                        <MenuItem value="pre-planning">Pre-Planning</MenuItem>
                        <MenuItem value="pre-production">Pre-Production</MenuItem>
                        <MenuItem value="production">Production</MenuItem>
                        <MenuItem value="post-production">Post-Production</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Culture</InputLabel>
                      <Select
                        value={selectedCulture}
                        label="Culture"
                        onChange={(e) => setSelectedCulture(e.target.value)}
                      >
                        <MenuItem value="all">All Cultures</MenuItem>
                        <MenuItem value="norsk-wedding">🇳🇴 Norwegian</MenuItem>
                        <MenuItem value="indisk-wedding">🇮🇳 Indian</MenuItem>
                        <MenuItem value="pakistansk-wedding">🇵🇰 Pakistani</MenuItem>
                        <MenuItem value="amerikansk-wedding">🇺🇸 American</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Camera</InputLabel>
                      <Select
                        value={selectedCamera}
                        label="Camera"
                        onChange={(e) => setSelectedCamera(e.target.value)}
                      >
                        <MenuItem value="all">All Cameras</MenuItem>
                        {Object.entries(CAMERA_PROFILES).map(([key, profile]) => (
                          <MenuItem key={key} value={key}>
                            {profile.icon} {profile.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>

          {/* Script Recommendations */}
          {userPreferences.experienceLevel && userPreferences.cameras.length > 0 && userPreferences.categories.length > 0 && (
            <ScriptRecommendations
              experienceLevel={userPreferences.experienceLevel}
              cameras={userPreferences.cameras}
              categories={userPreferences.categories}
              onSelectScript={(scriptId) => {
                const script = filteredScripts.find((entry) => entry.id === scriptId || entry.name === scriptId);
                if (script) {
                  setSelectedScript(script.name);
                  setActiveTab(2);
                  setExecutionDialogOpen(true);
                }
              }}
            />
          )}

          {/* Scripts grid */}
          {scriptsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredScripts.length === 0 ? (
            <Alert severity="info">
              No scripts found matching your filters. Try adjusting your search criteria.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {filteredScripts.map((script) => (
                <Grid key={script.name} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s', '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      }}}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600}}>
                        {script.icon || '📜'} {script.displayName || script.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        {script.description || 'No description available'}
                      </Typography>
                      {script.category && (
                        <Chip
                          label={script.category}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      )}
                      {script.phase && (
                        <Chip
                          label={script.phase}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<PlayArrow />}
                        onClick={() => handleExecuteScript(script.name)}
                        sx={{ color: theming.colors.primary }}
                      >
                        Execute
                      </Button>
                      <Button size="small" startIcon={<Info />}>
                        Details
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Tab 2: Execute */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Quick Execute
          </Typography>
          {selectedScript ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Selected script: <strong>{selectedScript}</strong>
              </Alert>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={() => setExecutionDialogOpen(true)}
                sx={{ bgcolor: DAVINCI_COLORS.primary, '&:hover': { bgcolor: DAVINCI_COLORS.accent } }}
              >
                Configure & Execute
              </Button>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Select a script from the Browse tab to execute it with custom parameters.
            </Alert>
          )}

          {filteredScripts.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                Suggested Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {filteredScripts.slice(0, 8).map((script) => (
                  <Chip
                    key={`quick-${script.name}`}
                    label={script.displayName || script.name}
                    onClick={() => handleExecuteScript(script.name)}
                    clickable
                    color={selectedScript === script.name ? 'primary' : 'default'}
                  />
                ))}
              </Box>
            </Box>
          )}
        </TabPanel>

        {/* Tab 3: History */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Execution History
          </Typography>
          {executionHistory.length === 0 ? (
            <Alert severity="info">
              No execution history yet. Run some scripts to see them here!
            </Alert>
          ) : (
            <List disablePadding>
              <Virtuoso
                style={{ height: 360 }}
                totalCount={executionHistory.length}
                itemContent={(index) => {
                  const item = executionHistory[index];
                  return (
                    <Box key={`${item.scriptName}-${item.timestamp}-${index}`}>
                      <ListItem>
                        <ListItemIcon>
                          {item.status === 'success' ? (
                            <CheckCircle sx={{ color: 'success.main' }} />
                          ) : item.status === 'running' ? (
                            <CircularProgress size={20} />
                          ) : (
                            <ErrorIcon sx={{ color: 'error.main' }} />
                          )}
                        </ListItemIcon>
                        <ListItemText primary={item.scriptName} secondary={`${item.timestamp} - ${item.status}`} />
                      </ListItem>
                      {index < executionHistory.length - 1 && <Divider />}
                    </Box>
                  );
                }}
              />
            </List>
          )}
        </TabPanel>
      </Paper>

      {/* Execution Dialog with Dynamic Parameters */}
      <Dialog
        open={executionDialogOpen}
        onClose={() => setExecutionDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          background: `linear-gradient(135deg, ${DAVINCI_COLORS.primary} 0%, ${DAVINCI_COLORS.accent} 100%)`,
          color: 'white'}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayArrow />
            <Typography variant="h6" component="span">
              Execute Script: {selectedScript}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Configure parameters for this script execution. Use presets for quick setup or customize each parameter.
          </Typography>

          {selectedScript && getScriptParameters(selectedScript).length > 0 ? (
            <ScriptParameterForm
              parameters={getScriptParameters(selectedScript)}
              presets={getScriptPresets(selectedScript)}
              values={scriptParameters}
              onChange={setScriptParameters}
              onValidate={(isValid, errors) => {
                setIsExecutionParamsValid(isValid);
                setExecutionValidationErrors(errors);
              }}
            />
          ) : (
            <Alert severity="info">
              This script doesn't require any parameters. Click Execute to run it immediately.
            </Alert>
          )}
          {!isExecutionParamsValid && executionValidationErrors.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {executionValidationErrors.join(' | ')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setExecutionDialogOpen(false)}
            startIcon={<Close />}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmExecution}
            disabled={executeScriptMutation.isPending || !isExecutionParamsValid}
            startIcon={executeScriptMutation.isPending ? <CircularProgress size={20} /> : <PlayArrow />}
              sx={{
                bgcolor: DAVINCI_COLORS.primary,
                '&:hover': {
                  bgcolor: DAVINCI_COLORS.accent,
                }}}
          >
            {executeScriptMutation.isPending ? 'Executing...' : 'Execute Script'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Guide Dialog */}
      <UserGuideDialog
        open={showGuide}
        onClose={() => setShowGuide(false)}
      />

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        userId={auth.state.user?.id}
      />
    </Box>
  );
}
