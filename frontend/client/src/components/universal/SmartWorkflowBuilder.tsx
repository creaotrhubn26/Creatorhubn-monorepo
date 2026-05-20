// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import WorkflowRunHistoryDialog from './WorkflowRunHistoryDialog';
import WorkflowScheduleDialog from './WorkflowScheduleDialog';
import { Snackbar } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid2 as Grid,
  Button,
  Chip,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  TextField,
  alpha,
  LinearProgress,
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  Add,
  PlayArrow,
  Person,
  Folder,
  Cloud,
  Edit,
  Upload,
  Download,
  Share,
  Analytics,
  Schedule,
  Settings,
  AutoAwesome,
  Restore,
  DeleteForever,
  Archive,
  History,
  Speed as Speed,
  TrendingUp,
  CheckCircle,
} from '@mui/icons-material';

interface WorkflowAction {
  id: string;
  name: string;
  icon: React.ReactElement;
  color: string;
  profession?: string;
  category: 'project' | 'client' | 'file' | 'sync' | 'analysis';
}

interface WorkflowStep {
  id: string;
  action: WorkflowAction;
  params?: any;
  order: number
}

interface CustomWorkflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  profession: string;
  isRunning: boolean;
  archivedAt?: string;
  archivedReason?: string
}

// Action buttons for each profession
const allActions: WorkflowAction[] = [
  // Photographer actions
  { id: 'upload-to-drive', name: 'Last opp til Drive', icon: <Upload />, color: '#1976d2', profession: 'photographer', category: 'file'},
  { id: 'select-project-folder', name: 'Velg prosjektmappe', icon: <Folder />, color: '#1976d2', profession: 'photographer', category: 'file'},
  { id: 'creatorhub-enhance', name: 'CreatorHub Photo Enhancer', icon: <AutoAwesome />, color: '#ff6d00', profession: 'photographer', category: 'sync'},
  { id: 'auto-culling', name: 'Automatisk culling', icon: <Analytics />, color: '#9c27b0', profession: 'photographer', category: 'analysis'},
  { id: 'create-showcase', name: 'Opprett showcase', icon: <PhotoCamera />, color: '#d32f2f', profession: 'photographer', category: 'project'},
  { id: 'send-client-email', name: 'Send e-post til klient', icon: <Share />, color: '#388e3c', profession: 'photographer', category: 'client'},
  { id: 'generate-contract', name: 'Generer kontrakt', icon: <Edit />, color: '#795548', profession: 'photographer', category: 'client'},
  { id: 'backup-raw-files', name: 'Backup RAW filer', icon: <Cloud />, color: '#607d8b', profession: 'photographer', category: 'file'},
  { id: 'create-project', name: 'Opprett fotoprosjekt', icon: <Add />, color: '#1976d2', profession: 'photographer', category: 'project'},
  { id: 'create-client', name: 'Ny klient', icon: <Person />, color: '#388e3c', profession: 'photographer', category: 'client'},
  { id: 'lightroom-sync', name: 'Lightroom sync', icon: <Cloud />, color: '#f57c00', profession: 'photographer', category: 'sync'},
  { id: 'equipment-check', name: 'Utstyr oversikt', icon: <Settings />, color: '#607d8b', profession: 'photographer', category: 'analysis'},
  { id: 'send-preview-samples', name: 'Send forhåndsvisning', icon: <Share />, color: '#2196f3', profession: 'photographer', category: 'client'},
  { id: 'schedule-session', name: 'Planlegg fotografering', icon: <Schedule />, color: '#9c27b0', profession: 'photographer', category: 'project'},
  { id: 'equipment-prep', name: 'Utstyr forberedelse', icon: <Settings />, color: '#607d8b', profession: 'photographer', category: 'analysis'},
  { id: 'create-meeting', name: 'Opprett møte', icon: <Schedule />, color: '#1976d2', profession: 'photographer', category: 'client'},
  { id: 'create-worklog', name: 'Opprett worklog', icon: <Edit />, color: '#4caf50', profession: 'photographer', category: 'project'},
  { id: 'view-timeline', name: 'Vis timeline', icon: <Schedule />, color: '#673ab7', profession: 'photographer', category: 'project'},
  { id: 'view-showcase', name: 'Vis showcase', icon: <PhotoCamera />, color: '#e91e63', profession: 'photographer', category: 'project'},

  // Videographer actions
  { id: 'create-video-project', name: 'Opprett videoprosjekt', icon: <Videocam />, color: '#d32f2f', profession: 'videographer', category: 'project'},
  { id: 'import-footage', name: 'Importer opptak', icon: <Download />, color: '#1976d2', profession: 'videographer', category: 'file'},
  { id: 'auto-sync-audio', name: 'Auto-sync lyd', icon: <LibraryMusic />, color: '#ff6d00', profession: 'videographer', category: 'sync'},
  { id: 'video-editor', name: 'Video editor', icon: <Edit />, color: '#f57c00', profession: 'videographer', category: 'sync'},
  { id: 'auto-highlights', name: 'Auto høydepunkter', icon: <AutoAwesome />, color: '#9c27b0', profession: 'videographer', category: 'analysis'},
  { id: 'color-grading', name: 'Color grading', icon: <Edit />, color: '#795548', profession: 'videographer', category: 'sync'},
  { id: 'render-video', name: 'Render video', icon: <PlayArrow />, color: '#388e3c', profession: 'videographer', category: 'file'},
  { id: 'youtube-upload', name: 'YouTube upload', icon: <Upload />, color: '#d32f2f', profession: 'videographer', category: 'file'},
  { id: 'create-trailer', name: 'Lag trailer', icon: <Videocam />, color: '#673ab7', profession: 'videographer', category: 'project'},
  { id: 'backup-project', name: 'Backup prosjekt', icon: <Cloud />, color: '#607d8b', profession: 'videographer', category: 'file'},
  { id: 'create-meeting', name: 'Opprett møte', icon: <Schedule />, color: '#1976d2', profession: 'videographer', category: 'client'},
  { id: 'create-worklog', name: 'Opprett worklog', icon: <Edit />, color: '#4caf50', profession: 'videographer', category: 'project'},
  { id: 'view-timeline', name: 'Vis timeline', icon: <Schedule />, color: '#673ab7', profession: 'videographer', category: 'project'},
  { id: 'view-showcase', name: 'Vis showcase', icon: <Videocam />, color: '#e91e63', profession: 'videographer', category: 'project'},

  // Music producer actions
  { id: 'create-music-project', name: 'Opprett musikkprosjekt', icon: <LibraryMusic />, color: '#9c27b0', profession: 'musicproducer', category: 'project'},
  { id: 'import-stems', name: 'Importer stems', icon: <Download />, color: '#1976d2', profession: 'musicproducer', category: 'file'},
  { id: 'protools-sync', name: 'Pro Tools sync', icon: <Cloud />, color: '#f57c00', profession: 'musicproducer', category: 'sync'},
  { id: 'auto-tune-vocals', name: 'Auto-tune vokal', icon: <AutoAwesome />, color: '#ff6d00', profession: 'musicproducer', category: 'sync'},
  { id: 'sound-library', name: 'Sound library', icon: <Folder />, color: '#795548', profession: 'musicproducer', category: 'file'},
  { id: 'audio-analysis', name: 'Audio analyse', icon: <Analytics />, color: '#388e3c', profession: 'musicproducer', category: 'analysis'},
  { id: 'mix-master', name: 'Mix & Master', icon: <Settings />, color: '#673ab7', profession: 'musicproducer', category: 'sync'},
  { id: 'export-track', name: 'Eksporter track', icon: <Upload />, color: '#d32f2f', profession: 'musicproducer', category: 'file'},
  { id: 'upload-streaming', name: 'Upload til streaming', icon: <Cloud />, color: '#1976d2', profession: 'musicproducer', category: 'file'},
  { id: 'create-demo', name: 'Lag demo', icon: <LibraryMusic />, color: '#e91e63', profession: 'musicproducer', category: 'project'},
  { id: 'create-meeting', name: 'Opprett møte', icon: <Schedule />, color: '#1976d2', profession: 'musicproducer', category: 'client'},
  { id: 'create-worklog', name: 'Opprett worklog', icon: <Edit />, color: '#4caf50', profession: 'musicproducer', category: 'project'},
  { id: 'view-timeline', name: 'Vis timeline', icon: <Schedule />, color: '#673ab7', profession: 'musicproducer', category: 'project'},
  { id: 'view-showcase', name: 'Vis showcase', icon: <LibraryMusic />, color: '#e91e63', profession: 'musicproducer', category: 'project'},

  // Vendor actions
  { id: 'create-order', name: 'Opprett ordre', icon: <Store />, color: '#1976d2', profession: 'vendor', category: 'project'},
  { id: 'inventory-check', name: 'Lager oversikt', icon: <Analytics />, color: '#388e3c', profession: 'vendor', category: 'analysis'},
  { id: 'customer-service', name: 'Kunde service', icon: <Person />, color: '#f57c00', profession: 'vendor', category: 'client'},
  { id: 'generate-report', name: 'Generer rapport', icon: <Analytics />, color: '#9c27b0', profession: 'vendor', category: 'analysis'},
  { id: 'create-meeting', name: 'Opprett møte', icon: <Schedule />, color: '#1976d2', profession: 'vendor', category: 'client'},
  { id: 'create-worklog', name: 'Opprett worklog', icon: <Edit />, color: '#4caf50', profession: 'vendor', category: 'project'},
  { id: 'view-timeline', name: 'Vis timeline', icon: <Schedule />, color: '#673ab7', profession: 'vendor', category: 'project'},
  { id: 'view-showcase', name: 'Vis showcase', icon: <Store />, color: '#e91e63', profession: 'vendor', category: 'project'}
];

// Pre-defined workflow templates for all professions
const predefinedWorkflows: { [profession: string]: CustomWorkflow[] } = {
  photographer: [
    {
      id: 'complete-photo-workflow',
      name: 'Komplett Fotografprosess',
      profession: 'photographer',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'upload-to-drive', name: 'Last opp til Drive', icon: <Upload />, color: '#1976d2', category: 'file' }, order: 0 },
        { id: 'step-2', action: { id: 'select-project-folder', name: 'Velg prosjektmappe', icon: <Folder />, color: '#1976d2', category: 'file' }, order: 1 },
        { id: 'step-3', action: { id: 'creatorhub-enhance', name: 'CreatorHub Photo Enhancer', icon: <AutoAwesome />, color: '#ff6d00', category: 'sync' }, order: 2 },
        { id: 'step-4', action: { id: 'auto-culling', name: 'Automatisk culling', icon: <Analytics />, color: '#9c27b0', category: 'analysis' }, order: 3 },
        { id: 'step-5', action: { id: 'create-showcase', name: 'Opprett showcase', icon: <PhotoCamera />, color: '#d32f2f', category: 'project' }, order: 4 },
        { id: 'step-6', action: { id: 'send-client-email', name: 'Send e-post til klient', icon: <Share />, color: '#388e3c', category: 'client' }, order: 5 }
      ]
    },
    {
      id: 'wedding-day-workflow',
      name: 'Bryllupsdagprosess',
      profession: 'photographer',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'equipment-prep', name: 'Utstyr forberedelse', icon: <Settings />, color: '#607d8b', category: 'analysis' }, order: 0 },
        { id: 'step-2', action: { id: 'schedule-session', name: 'Planlegg fotografering', icon: <Schedule />, color: '#9c27b0', category: 'project' }, order: 1 },
        { id: 'step-3', action: { id: 'backup-raw-files', name: 'Backup RAW filer', icon: <Cloud />, color: '#607d8b', category: 'file' }, order: 2 },
        { id: 'step-4', action: { id: 'send-preview-samples', name: 'Send forhåndsvisning', icon: <Share />, color: '#2196f3', category: 'client' }, order: 3 }
      ]
    },
    {
      id: 'client-onboarding-workflow',
      name: 'Klient Onboarding',
      profession: 'photographer',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'create-client', name: 'Ny klient', icon: <Person />, color: '#388e3c', category: 'client' }, order: 0 },
        { id: 'step-2', action: { id: 'generate-contract', name: 'Generer kontrakt', icon: <Edit />, color: '#795548', category: 'client' }, order: 1 },
        { id: 'step-3', action: { id: 'schedule-session', name: 'Planlegg fotografering', icon: <Schedule />, color: '#9c27b0', category: 'project' }, order: 2 },
        { id: 'step-4', action: { id: 'create-project', name: 'Opprett fotoprosjekt', icon: <Add />, color: '#1976d2', category: 'project' }, order: 3 }
      ]
    }
  ],
  videographer: [
    {
      id: 'complete-video-production',
      name: 'Komplett Videoproduksjon',
      profession: 'videographer',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'import-footage', name: 'Importer opptak', icon: <Download />, color: '#1976d2', category: 'file' }, order: 0 },
        { id: 'step-2', action: { id: 'auto-sync-audio', name: 'Auto-sync lyd', icon: <LibraryMusic />, color: '#ff6d00', category: 'sync' }, order: 1 },
        { id: 'step-3', action: { id: 'auto-highlights', name: 'Auto høydepunkter', icon: <AutoAwesome />, color: '#9c27b0', category: 'analysis' }, order: 2 },
        { id: 'step-4', action: { id: 'color-grading', name: 'Color grading', icon: <Edit />, color: '#795548', category: 'sync' }, order: 3 },
        { id: 'step-5', action: { id: 'render-video', name: 'Render video', icon: <PlayArrow />, color: '#388e3c', category: 'file' }, order: 4 },
        { id: 'step-6', action: { id: 'youtube-upload', name: 'YouTube upload', icon: <Upload />, color: '#d32f2f', category: 'file' }, order: 5 }
      ]
    },
    {
      id: 'wedding-video-workflow',
      name: 'Bryllupsvideo Produksjon',
      profession: 'videographer',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'import-footage', name: 'Importer opptak', icon: <Download />, color: '#1976d2', category: 'file' }, order: 0 },
        { id: 'step-2', action: { id: 'auto-highlights', name: 'Auto høydepunkter', icon: <AutoAwesome />, color: '#9c27b0', category: 'analysis' }, order: 1 },
        { id: 'step-3', action: { id: 'create-trailer', name: 'Lag trailer', icon: <Videocam />, color: '#673ab7', category: 'project' }, order: 2 },
        { id: 'step-4', action: { id: 'backup-project', name: 'Backup prosjekt', icon: <Cloud />, color: '#607d8b', category: 'file' }, order: 3 }
      ]
    }
  ],
  musicproducer: [
    {
      id: 'complete-music-production',
      name: 'Komplett Musikkproduksjon',
      profession: 'musicproducer',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'import-stems', name: 'Importer stems', icon: <Download />, color: '#1976d2', category: 'file' }, order: 0 },
        { id: 'step-2', action: { id: 'auto-tune-vocals', name: 'Auto-tune vokal', icon: <AutoAwesome />, color: '#ff6d00', category: 'sync' }, order: 1 },
        { id: 'step-3', action: { id: 'audio-analysis', name: 'Audio analyse', icon: <Analytics />, color: '#388e3c', category: 'analysis' }, order: 2 },
        { id: 'step-4', action: { id: 'mix-master', name: 'Mix & Master', icon: <Settings />, color: '#673ab7', category: 'sync' }, order: 3 },
        { id: 'step-5', action: { id: 'export-track', name: 'Eksporter track', icon: <Upload />, color: '#d32f2f', category: 'file' }, order: 4 },
        { id: 'step-6', action: { id: 'upload-streaming', name: 'Upload til streaming', icon: <Cloud />, color: '#1976d2', category: 'file' }, order: 5 }
      ]
    },
    {
      id: 'demo-creation-workflow',
      name: 'Demo Produksjon',
      profession: 'musicproducer',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'sound-library', name: 'Sound library', icon: <Folder />, color: '#795548', category: 'file' }, order: 0 },
        { id: 'step-2', action: { id: 'create-demo', name: 'Lag demo', icon: <LibraryMusic />, color: '#e91e63', category: 'project' }, order: 1 },
        { id: 'step-3', action: { id: 'audio-analysis', name: 'Audio analyse', icon: <Analytics />, color: '#388e3c', category: 'analysis' }, order: 2 },
        { id: 'step-4', action: { id: 'export-track', name: 'Eksporter track', icon: <Upload />, color: '#d32f2f', category: 'file' }, order: 3 }
      ]
    }
  ],
  vendor: [
    {
      id: 'order-fulfillment-workflow',
      name: 'Ordre Fullføring',
      profession: 'vendor',
      isRunning: false,
      steps: [
        { id: 'step-1', action: { id: 'create-order', name: 'Ny ordre', icon: <Store />, color: '#1976d2', category: 'project' }, order: 0 },
        { id: 'step-2', action: { id: 'inventory-check', name: 'Lager oversikt', icon: <Analytics />, color: '#388e3c', category: 'analysis' }, order: 1 },
        { id: 'step-3', action: { id: 'customer-service', name: 'Kunde service', icon: <Person />, color: '#f57c00', category: 'client' }, order: 2 },
        { id: 'step-4', action: { id: 'generate-report', name: 'Generer rapport', icon: <Analytics />, color: '#9c27b0', category: 'analysis' }, order: 3 }
      ]
    }
  ]
};

interface SmartWorkflowBuilderProps {
  profession: string;
  onMeetingCreate?: () => void;
  onWorklogCreate?: () => void;
  onProjectCreate?: () => void;
  onTimelineView?: () => void;
  onShowcaseView?: () => void;
}

const SmartWorkflowBuilder: React.FC<SmartWorkflowBuilderProps> = ({
  profession,
  onMeetingCreate,
  onWorklogCreate,
  onProjectCreate,
  onTimelineView,
  onShowcaseView
}) => {
  const [workflows, setWorkflows] = useState<CustomWorkflow[]>(predefinedWorkflows[profession] || []);
  const [archivedWorkflows, setArchivedWorkflows] = useState<CustomWorkflow[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowStep[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Theming system
  const theming = useTheming(profession);
  
  // Profession-specific hooks for dynamic workflow adaptation
  const professionConfigsData = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const { professionConfigs: dynamicProfessionConfigs } = useDynamicProfessions();
  
  // Get profession-specific configuration
  const currentProfessionConfig = professionAdapter.config;
  const professionIcon = getProfessionIcon(profession);
  const dynamicProfessionData = dynamicProfessionConfigs?.[profession];
  
  // Get adapted project types for the profession
  const professionProjectTypes = professionAdapter.getProjectTypes();
  const [workflowName, setWorkflowName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [runningWorkflows, setRunningWorkflows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const { auth, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  const queryClient = useQueryClient();

  // Get user ID for API calls
  const userId = auth?.state?.user?.id || 'anonymous';

  // Load saved workflows from API
  const { data: savedWorkflowsData } = useQuery({
    queryKey: ['orchestration-workflows', userId],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/orchestration/workflows/${userId}`);
        return response?.workflows || [];
      } catch (error) {
        console.warn('Failed to load saved workflows:', error);
        return [];
      }
    },
    staleTime: 30000, // 30 seconds
    enabled: !!userId
  });

  // Merge saved workflows with predefined on load
  useEffect(() => {
    if (savedWorkflowsData && savedWorkflowsData.length > 0) {
      const savedCustom = savedWorkflowsData
        .filter((w: any) => w.workflowType === 'custom')
        .map((w: any) => ({
          id: w.id,
          name: w.workflowName,
          steps: typeof w.steps === 'string' ? JSON.parse(w.steps) : (w.steps || []),
          profession: profession,
          isRunning: false
        }));
      
      // Merge predefined + saved (avoid duplicates by id)
      const predefined = predefinedWorkflows[profession] || [];
      const existingIds = new Set(predefined.map(w => w.id));
      const uniqueSaved = savedCustom.filter((w: CustomWorkflow) => !existingIds.has(w.id));
      setWorkflows([...predefined, ...uniqueSaved]);
    }
  }, [savedWorkflowsData, profession]);

  // Mutation to save workflow to API
  const saveWorkflowMutation = useMutation({
    mutationFn: async (workflow: CustomWorkflow) => {
      return apiRequest(`/api/orchestration/workflows/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workflow.id,
          name: workflow.name,
          workflowName: workflow.name,
          workflowType: 'custom',
          steps: workflow.steps,
          profession: workflow.profession,
          projectId: 'workflow-builder'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration-workflows', userId] });
      setSuccessMessage('Arbeidsflyt lagret!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: () => {
      setErrorMessage('Kunne ikke lagre arbeidsflyt');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  });

  // Mutation to delete workflow from API
  const deleteWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest(`/api/orchestration/workflows/${userId}/${workflowId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration-workflows', userId] });
      setSuccessMessage('Arbeidsflyt slettet!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: () => {
      setErrorMessage('Kunne ikke slette arbeidsflyt');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  });

  // Register component with integration system
  useEffect(() => {
    // Register component with the registry
    componentRegistry.registerComponent({
      id: 'smart-workflow-builder',
      name: 'Smart Workflow Builder',
      type: 'workflow',
      category: 'automation',
      capabilities: ['workflow-execution', 'workflow-creation', 'action-broadcast'],
      profession
    });

    // Register communication channel
    communication.registerComponent('smart-workflow-builder', 'workflow', [
      'workflow-execution', 
      'workflow-creation'
    ]);

    // Set up dataFlow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'smart-workflow-builder',
      dataKey: 'workflows',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'smart-workflow-builder',
      dataKey: 'running-workflows',
    });

    // Listen for workflow trigger requests from other components
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'workflow:trigger' && message.data?.workflowId) {
        executeWorkflow(message.data.workflowId);
      }
    });

    return () => {
      componentRegistry.unregisterComponent('smart-workflow-builder');
      dataFlow.unregisterNode('smart-workflow-builder:workflows');
      dataFlow.unregisterNode('smart-workflow-builder:running-workflows');
      unsubscribe?.();
    };
  }, [profession, workflows, runningWorkflows, componentRegistry, communication, dataFlow]);

  // Broadcast workflow state changes
  const broadcastWorkflowUpdate = useCallback((type: string, data: any) => {
    communication.sendBroadcast('workflow:update', {
      type,
      ...data,
      profession,
      timestamp: Date.now()
    });
    dataFlow.syncData('smart-workflow-builder:workflows', workflows);
  }, [communication, dataFlow, profession, workflows]);

  // Filter actions by profession
  const availableActions = allActions.filter(action => 
    !action.profession || action.profession === profession
);

  // Group actions by category
  const actionsByCategory = availableActions.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
}, {} as Record<string, WorkflowAction[]>);

  const categoryNames = {
    project: 'Prosjekt',
    client: 'Klient', 
    file: 'Filer',
    sync: 'Synkronisering',
    analysis: 'Analyse'
};

  const addActionToWorkflow = (action: WorkflowAction) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}-${Math.random()}`,
      action,
      order: currentWorkflow.length
};
    setCurrentWorkflow([...currentWorkflow, newStep]);
    setIsBuilding(true);
};

  const executeDirectAction = (action: WorkflowAction) => {
    switch (action.id) {
      case 'create-meeting':
        if (onMeetingCreate) {
          onMeetingCreate();
  }
        break;
      case 'create-worklog':
        if (onWorklogCreate) {
          onWorklogCreate();
    }
        break;
      case 'create-project':
        if (onProjectCreate) {
          onProjectCreate();
    }
        break;
      case 'view-timeline':
        if (onTimelineView) {
          onTimelineView();
    }
        break;
      case 'view-showcase':
        if (onShowcaseView) {
          onShowcaseView();
    }
        break;
      default: // For other actions, add to workflow
        addActionToWorkflow(action);
}
};

  const removeStepFromWorkflow = (stepId: string) => {
    setCurrentWorkflow(currentWorkflow.filter(step => step.id !== stepId));
};

  const saveWorkflow = async () => {
    if (currentWorkflow.length > 0 && workflowName.trim()) {
      const newWorkflow: CustomWorkflow = {
        id: `workflow-${Date.now()}`,
        name: workflowName,
        steps: currentWorkflow,
        profession,
        isRunning: false
      };
      
      // Save to local state
      setWorkflows([...workflows, newWorkflow]);
      
      // Persist to database via API
      try {
        await saveWorkflowMutation.mutateAsync(newWorkflow);
      } catch (error) {
        console.warn('Failed to persist workflow to database:', error);
      }
      
      setCurrentWorkflow([]);
      setWorkflowName('');
      setIsBuilding(false);
      setShowSaveDialog(false);
    }
  };

  // Slice 9X.79 — runId-tracking per workflow, polling fra engine
  const [workflowRuns, setWorkflowRuns] = useState<Record<string, { runId: string; stepStatuses: any[] }>>({});
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  // Slice 9X.79 — planleggings-dialog
  const [scheduleDialogForWorkflow, setScheduleDialogForWorkflow] = useState<{ id: string; name: string } | null>(null);

  // Slice 9X.79 — eksisterende planleggings-rader (vises som pille på kortet)
  const { data: schedulesData } = useQuery({
    queryKey: ['workflow-schedules', userId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/${userId}/schedules`),
    enabled: !!userId && userId !== 'anonymous',
  });
  const scheduleByWorkflow = useMemo(() => {
    const map: Record<string, any> = {};
    (schedulesData?.data || []).forEach((s: any) => { map[s.workflow_id] = s; });
    return map;
  }, [schedulesData]);

  // Slice 9X.79 — siste-kjøring per workflow (oversikt på kortet)
  const { data: recentRunsData } = useQuery({
    queryKey: ['workflow-recent-runs', userId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/${userId}/runs?limit=50`),
    enabled: !!userId && userId !== 'anonymous',
    refetchInterval: 15_000,
  });
  const lastRunByWorkflow = useMemo(() => {
    const map: Record<string, any> = {};
    (recentRunsData?.data || []).forEach((r: any) => {
      if (!map[r.workflow_id]) map[r.workflow_id] = r;
    });
    return map;
  }, [recentRunsData]);

  const executeWorkflow = async (workflowId: string) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    setRunningWorkflows((prev) => new Set(prev).add(workflowId));

    // Broadcast workflow start
    broadcastWorkflowUpdate('started', {
      workflowId,
      workflowName: workflow.name,
      totalSteps: workflow.steps.length,
    });

    // Slice 9X.79 — bruk ekte execution-engine istedenfor placeholder-loop
    try {
      const startRes: any = await apiRequest(
        `/api/orchestration/workflows/${userId}/${workflowId}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowName: workflow.name,
            profession,
            steps: workflow.steps.map((s) => ({
              action_id: s.action.id,
              action_name: s.action.name,
            })),
            context: {},
          }),
        },
      );

      if (!startRes?.success || !startRes.runId) {
        throw new Error(startRes?.error || 'start_failed');
      }

      const runId = startRes.runId;
      setWorkflowRuns((prev) => ({ ...prev, [workflowId]: { runId, stepStatuses: [] } }));
      setSnackbar({ msg: `Startet "${workflow.name}" (${workflow.steps.length} steg)`, severity: 'info' });

      // Polling — engine kjører i bakgrunnen, vi henter status hvert 1.5s
      const pollInterval = setInterval(async () => {
        try {
          const status: any = await apiRequest(`/api/orchestration/workflows/runs/${runId}`);
          if (!status?.success) return;
          const run = status.run;
          const steps = status.steps || [];
          setWorkflowRuns((prev) => ({ ...prev, [workflowId]: { runId, stepStatuses: steps } }));

          // Broadcast progressive updates
          steps.forEach((step: any, i: number) => {
            if (step.status === 'completed' || step.status === 'failed') {
              broadcastWorkflowUpdate(step.status === 'completed' ? 'step-completed' : 'step-failed', {
                workflowId,
                stepIndex: i,
                stepName: step.action_name,
                executionMode: step.execution_mode,
              });
            }
          });

          if (['completed', 'failed', 'partial', 'cancelled'].includes(run.status)) {
            clearInterval(pollInterval);
            setRunningWorkflows((prev) => {
              const updated = new Set(prev);
              updated.delete(workflowId);
              return updated;
            });
            const done = steps.filter((s: any) => s.status === 'completed').length;
            const failed = steps.filter((s: any) => s.status === 'failed').length;
            const awaiting = steps.filter((s: any) => s.status === 'awaiting_manual').length;
            if (run.status === 'completed') {
              setSnackbar({ msg: `"${workflow.name}" ferdig — ${done}/${steps.length} steg`, severity: 'success' });
            } else if (run.status === 'failed') {
              setSnackbar({ msg: `"${workflow.name}" feilet (${failed} feilet)`, severity: 'error' });
            } else if (run.status === 'cancelled') {
              // Cancel-knappen viste allerede sin egen snackbar — ikke duplikat
            } else {
              setSnackbar({ msg: `"${workflow.name}" delvis ferdig — ${awaiting} venter manuell`, severity: 'warning' });
            }
            queryClient.invalidateQueries({ queryKey: ['workflow-recent-runs', userId] });
          }
        } catch (err) {
          console.warn('[workflow-poll] feilet:', err);
        }
      }, 1500);

      // Safety: avbryt etter 5 min
      setTimeout(() => {
        clearInterval(pollInterval);
        setRunningWorkflows((prev) => {
          const updated = new Set(prev);
          updated.delete(workflowId);
          return updated;
        });
      }, 5 * 60 * 1000);
      return;
    } catch (error) {
      console.error('❌ Workflow start feilet:', error);
      broadcastWorkflowUpdate('step-failed', {
        workflowId,
        stepIndex: 0,
        stepName: 'Workflow start',
        error: String(error),
      });
    }

    setRunningWorkflows((prev) => {
      const updated = new Set(prev);
      updated.delete(workflowId);
      return updated;
    });
    
    // Broadcast workflow completion
    broadcastWorkflowUpdate('completed', {
      workflowId,
      workflowName: workflow.name
    });
  };

  const deleteWorkflow = async (workflowId: string) => {
    const workflowToDelete = workflows.find(w => w.id === workflowId);
    if (workflowToDelete) {
      // Add to archive with deletion timestamp
      const archivedWorkflow = {
        ...workflowToDelete,
        archivedAt: new Date().toISOString(),
        archivedReason: 'Bruker slettet'
      };
      setArchivedWorkflows([...archivedWorkflows, archivedWorkflow]);
      setWorkflows(workflows.filter(w => w.id !== workflowId));
      
      // Delete from database
      try {
        await deleteWorkflowMutation.mutateAsync(workflowId);
      } catch (error) {
        console.warn('Failed to delete workflow from database:', error);
      }
    }
  };

  const restoreWorkflow = (workflowId: string) => {
    const workflowToRestore = archivedWorkflows.find(w => w.id === workflowId);
    if (workflowToRestore) {
      // Remove archive properties and restore
      const { archivedAt: _archivedAt, archivedReason: _archivedReason, ...restoredWorkflow } = workflowToRestore;
      setWorkflows([...workflows, restoredWorkflow]);
      setArchivedWorkflows(archivedWorkflows.filter(w => w.id !== workflowId));
    }
  };

  const permanentDelete = (workflowId: string) => {
    setArchivedWorkflows(archivedWorkflows.filter(w => w.id !== workflowId));
};

  return (
    <Box sx={{ p:  3, maxHeight: '80vh', overflow: 'auto'}}>
      {/* Success/Error Alerts */}
      {successMessage && (
        <Alert 
          severity="success" 
          onClose={() => setSuccessMessage(null)}
          sx={{ mb: 2 }}
        >
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert 
          severity="error" 
          onClose={() => setErrorMessage(null)}
          sx={{ mb: 2 }}
        >
          {errorMessage}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0 }}>
          {professionIcon || <AutoAwesome sx={{ color: '#32cd32'}} />}
          Smart Arbeidsflyt
          {dynamicProfessionData && (
            <Chip
              label={dynamicProfessionData.displayName}
              size="small"
              sx={{
                backgroundColor: dynamicProfessionData.iconColor + '20',
                color: dynamicProfessionData.iconColor,
                fontWeight: 600,
              }}
            />
          )}
        </Typography>
        {/* Slice 9X.79 — Run-historikk-knapp */}
        <Button
          size="small"
          variant="outlined"
          onClick={() => setShowRunHistory(true)}
          sx={{
            borderRadius: '999px',
            px: 2,
            textTransform: 'none',
            color: '#fff5e8',
            borderColor: 'rgba(255,186,108,0.32)',
            '&:hover': { borderColor: '#ffba6c', bgcolor: 'rgba(255,186,108,0.08)' },
          }}
        >
          Historikk
        </Button>
      </Box>
      
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb:  2 }}>
        Automatiser hele {dynamicProfessionData?.displayName?.toLowerCase() || 'din'}-prosessen med ett klikk
        {professionProjectTypes && professionProjectTypes.length > 0 && (
          <Tooltip title={`Støttede prosjekttyper: ${professionProjectTypes.map(pt => pt.label).join(', ')}`}>
            <Chip 
              label={`${professionProjectTypes.length} prosjekttyper tilgjengelig`}
              size="small"
              sx={{ ml: 2, cursor: 'help' }}
              icon={<CheckCircle />}
            />
          </Tooltip>
        )}
        {professionConfigsData?.professionConfigs && Object.keys(professionConfigsData.professionConfigs).length > 0 && (
          <Tooltip title={`${Object.keys(professionConfigsData.professionConfigs).length} profesjoner konfigurert i systemet`}>
            <Chip 
              label="Multi-profesjon støtte"
              size="small"
              color="success"
              sx={{ ml: 1, cursor: 'help' }}
            />
          </Tooltip>
        )}
      </Typography>

      {/* Archive/Active Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} aria-label="workflow tabs">
          <Tab 
            label={
              <Badge badgeContent={workflows.length} color="primary" max={99}>
                <Box sx={{ px: 1 }}>Aktive Workflows</Box>
              </Badge>
            } 
            value="active" 
          />
          <Tab 
            label={
              <Badge badgeContent={archivedWorkflows.length} color="secondary" max={99}>
                <Box sx={{ px: 1 }}>Arkiv</Box>
              </Badge>
            } 
            value="archived" 
          />
        </Tabs>
      </Box>

      {/* Feature explanation for photographers */}
      {profession === 'photographer' && (
        <Box sx={{ mb: 3 }}>
          <Paper sx={{
            p: 3,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            '&:before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #6366F1 0%, #10B981 100%)',
            }
          }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}>
                <AutoAwesome sx={{ fontSize: 28, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ 
                  fontWeight: 700,
                  mb: 0.5,
                  background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Komplett Fotografprosess
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  AI-drevet automatisering for profesjonelle fotografer
                </Typography>
              </Box>
            </Box>

            {/* Workflow Steps */}
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={1.5}>
                {[
                  { icon: <Upload />, label: 'Last opp bilder', color: '#1976d2' },
                  { icon: <Folder />, label: 'Velg prosjektmappe', color: '#1976d2' },
                  { icon: <AutoAwesome />, label: 'Photo Enhancer', color: '#ff6d00' },
                  { icon: <Analytics />, label: 'Auto culling', color: '#9c27b0' },
                  { icon: <PhotoCamera />, label: 'Opprett showcase', color: '#d32f2f' },
                  { icon: <Share />, label: 'Send til klient', color: '#388e3c' }
                ].map((step, index) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      background: `${step.color}08`,
                      border: `1px solid ${alpha(step.color, 0.2)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: `${step.color}15`,
                        borderColor: alpha(step.color, 0.4),
                        transform: 'translateX(4px)'
                      }
                    }}>
                      <Box sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1.5,
                        background: `${step.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: step.color
                      }}>
                        {React.cloneElement(step.icon, { sx: { fontSize: 18 } })}
                      </Box>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600,
                        color: step.color,
                        fontSize: '0.85rem'
                      }}>
                        {step.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Stats/Benefits */}
            <Box sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              p: 2,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1px solid rgba(76, 175, 80, 0.2)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 200 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4caf50 0%, #10B981 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                }}>
                  <Speed sx={{ fontSize: 20, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#4caf50', lineHeight: 1 }}>
                    75%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    Raskere prosessering
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 200 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2196f3 0%, #6366F1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                }}>
                  <TrendingUp sx={{ fontSize: 20, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196f3', lineHeight: 1 }}>
                    3-4t → 15min
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    Tidsbesparelse
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 200 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff9800 0%, #F59E0B 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                }}>
                  <CheckCircle sx={{ fontSize: 20, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#ff9800', lineHeight: 1 }}>
                    100%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    Automatisert
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Action Buttons */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theming.colors.primary }}>
          Handlinger for {dynamicProfessionData?.displayName || profession}
        </Typography>
        {currentProfessionConfig && currentProfessionConfig.defaultHourlyRate && (
          <Tooltip title={`Standard timesats: ${currentProfessionConfig.defaultHourlyRate} NOK/t`}>
            <Chip 
              label={`${currentProfessionConfig.defaultHourlyRate} NOK/t`} 
              size="small" 
              color="info"
              icon={<Analytics />}
              sx={{ cursor: 'help' }}
            />
          </Tooltip>
        )}
      </Box>
      
      <Grid container spacing={3}>
        {Object.entries(actionsByCategory).map(([category, actions]) => (
          <Grid size={{ xs: 12, md: 6 }} key={category}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  {categoryNames[category as keyof typeof categoryNames]}
                  <Chip size="small" label={actions.length} />
                </Typography>
                <Grid container spacing={1}>
                  {actions.map((action) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={action.id}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={action.icon}
                        onClick={() => executeDirectAction(action)}
                        sx={{
                          borderColor: action.color,
                          color: action.color, '&:hover': {
                            backgroundColor: `${action.color}15`,
                            borderColor: action.color
                          }
                        }}
                      >
                        {action.name}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Current Workflow Builder */}
      {isBuilding && (
        <Card sx={{ mt: 3, ...theming.getThemedCardSx() }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
              Ny Arbeidsflyt ({currentWorkflow.length} steg)
            </Typography>

            {currentWorkflow.length > 0 && (
              <Paper sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {currentWorkflow.map((step, index) => (
                    <Chip
                      key={step.id}
                      icon={step.action.icon}
                      label={`${index + 1}. ${step.action.name}`}
                      onDelete={() => removeStepFromWorkflow(step.id)}
                      sx={{
                        backgroundColor: `${step.action.color}15`,
                        color: step.action.color,
                        '& .MuiChip-deleteIcon': { color: step.action.color }
                      }}
                    />
                  ))}
                </Stack>
              </Paper>
            )}

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                onClick={() => setShowSaveDialog(true)}
                disabled={currentWorkflow.length === 0}
                sx={theming.getThemedButtonSx()}
              >
                Lagre Arbeidsflyt
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setCurrentWorkflow([]);
                  setIsBuilding(false);
                }}
              >
                Avbryt
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Active Workflows Tab */}
      {activeTab === 'active' && (
        <Box sx={{ mt: 3 }}>
          {workflows.length === 0 ? (
            <Paper sx={{ 
              p: 6,
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(16, 185, 129, 0.03) 100%)',
              backdropFilter: 'blur(10px)',
              border: '2px dashed rgba(99, 102, 241, 0.2)',
              borderRadius: 4,
              transition: 'all 0.3s ease'
            }}>
              <AutoAwesome sx={{ 
                fontSize: 64,
                color: '#6366F1',
                mb: 2,
                opacity: 0.6,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)', opacity: 0.6 },
                  '50%': { transform: 'scale(1.1)', opacity: 0.8 }
                }
              }} />
              <Typography variant="h6" sx={{ 
                mb: 1,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Ingen aktive workflows
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Bygg din egen workflow eller bruk forhåndsdefinerte maler
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setIsBuilding(true)}
                sx={{
                  borderColor: '#6366F1',
                  color: '#6366F1',
                  '&:hover': {
                    borderColor: '#6366F1',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)'
                  }
                }}
              >
                Opprett første workflow
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {workflows.map((workflow, _workflowIndex) => (
                <Grid size={{ xs: 12, lg: 6 }} key={workflow.id}>
                  <Card sx={{
                    // Slice 9X.72 — dark theme
                    background: 'linear-gradient(135deg, rgba(255,186,108,0.06) 0%, rgba(15,10,7,0.86) 100%)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,186,108,0.18)',
                    color: '#fff5e8',
                    borderRadius: 3,
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: `0 12px 40px ${alpha('#6366F1', 0.15)}`,
                      borderColor: 'rgba(99, 102, 241, 0.3)'
                    },
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: `linear-gradient(90deg, ${workflow.steps[0]?.action.color || '#6366F1'} 0%, ${workflow.steps[workflow.steps.length - 1]?.action.color || '#10B981'} 100%)`,
                    }
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      {/* Header */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        mb: 2.5
                      }}>
                        <Box sx={{ flex: 1, mr: 2 }}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            mb: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}>
                            {workflow.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              label={`${workflow.steps.length} steg`}
                              sx={{
                                height: 24,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                color: '#6366F1'
                              }}
                            />
                            {runningWorkflows.has(workflow.id) && (
                              <Chip
                                size="small"
                                label="Kjører nå"
                                icon={<PlayArrow sx={{ fontSize: '0.9rem' }} />}
                                sx={{
                                  height: 24,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.1) 100%)',
                                  border: '1px solid rgba(76, 175, 80, 0.3)',
                                  color: '#4caf50',
                                  animation: 'pulse 1.5s ease-in-out infinite'
                                }}
                              />
                            )}
                            {/* Slice 9X.79 — planleggings-pille */}
                            {scheduleByWorkflow[workflow.id]?.enabled && (() => {
                              const sch = scheduleByWorkflow[workflow.id];
                              const dowLabels = ['søn','man','tir','ons','tor','fre','lør'];
                              const when = sch.schedule_type === 'daily'
                                ? `daglig ${String(sch.schedule_hour).padStart(2,'0')}:00`
                                : sch.schedule_type === 'weekly'
                                  ? `${dowLabels[sch.schedule_dow ?? 1]} ${String(sch.schedule_hour).padStart(2,'0')}:00`
                                  : `den ${sch.schedule_dow ?? 1}. ${String(sch.schedule_hour).padStart(2,'0')}:00`;
                              return (
                                <Tooltip title={`Planlagt — neste ${new Date(sch.next_run_at).toLocaleString('nb-NO')}`}>
                                  <Chip
                                    size="small"
                                    icon={<ScheduleIcon sx={{ fontSize: '0.85rem' }} />}
                                    label={when}
                                    onClick={() => setScheduleDialogForWorkflow({ id: workflow.id, name: workflow.name })}
                                    sx={{
                                      height: 24,
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      bgcolor: 'rgba(155,135,245,0.12)',
                                      border: '1px solid rgba(155,135,245,0.32)',
                                      color: '#9b87f5',
                                      '& .MuiChip-icon': { color: '#9b87f5' },
                                    }}
                                  />
                                </Tooltip>
                              );
                            })()}

                            {/* Slice 9X.79 — siste-kjøring-pille */}
                            {!runningWorkflows.has(workflow.id) && lastRunByWorkflow[workflow.id] && (() => {
                              const last = lastRunByWorkflow[workflow.id];
                              const colorMap: Record<string, { c: string; bg: string; bd: string; label: string }> = {
                                completed: { c: '#10b981', bg: 'rgba(16,185,129,0.10)', bd: 'rgba(16,185,129,0.32)', label: '✓ Sist OK' },
                                partial:   { c: '#f59e0b', bg: 'rgba(245,158,11,0.10)', bd: 'rgba(245,158,11,0.32)', label: '⏳ Sist delvis' },
                                failed:    { c: '#ef4444', bg: 'rgba(239,68,68,0.10)', bd: 'rgba(239,68,68,0.32)', label: '✗ Sist feilet' },
                                cancelled: { c: '#6b7280', bg: 'rgba(107,114,128,0.12)', bd: 'rgba(107,114,128,0.32)', label: '⊘ Sist avbrutt' },
                              };
                              const conf = colorMap[last.status] || { c: '#6b7280', bg: 'rgba(107,114,128,0.10)', bd: 'rgba(107,114,128,0.32)', label: last.status };
                              const diffMin = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 60_000);
                              const when = diffMin < 1 ? 'nå' : diffMin < 60 ? `${diffMin}m` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}t` : `${Math.floor(diffMin / 1440)}d`;
                              return (
                                <Tooltip title={`Klikk for å se historikk · ${last.steps_completed}/${last.steps_total} steg · ${when} siden`}>
                                  <Chip
                                    size="small"
                                    onClick={() => setShowRunHistory(true)}
                                    label={`${conf.label} · ${when}`}
                                    sx={{
                                      height: 24,
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      bgcolor: conf.bg,
                                      border: `1px solid ${conf.bd}`,
                                      color: conf.c,
                                      '&:hover': { bgcolor: conf.bg, opacity: 0.85 },
                                    }}
                                  />
                                </Tooltip>
                              );
                            })()}
                          </Box>
                        </Box>

                        <Stack direction="row" spacing={1}>
                          {/* Slice 9X.79 — Stopp-knapp synlig når runet kjører */}
                          {runningWorkflows.has(workflow.id) && workflowRuns[workflow.id]?.runId && (
                            <Tooltip title="Avbryt kjørende workflow (resterende steg blir skipped)">
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={async () => {
                                  const runId = workflowRuns[workflow.id]?.runId;
                                  if (!runId) return;
                                  try {
                                    const res: any = await apiRequest(
                                      `/api/orchestration/workflows/runs/${runId}/cancel`,
                                      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
                                    );
                                    if (res?.success) {
                                      setRunningWorkflows((prev) => {
                                        const next = new Set(prev);
                                        next.delete(workflow.id);
                                        return next;
                                      });
                                      setSnackbar({
                                        msg: res.alreadyDone ? 'Runet var allerede ferdig' : `"${workflow.name}" avbrutt`,
                                        severity: 'warning',
                                      });
                                      queryClient.invalidateQueries({ queryKey: ['workflow-recent-runs', userId] });
                                    }
                                  } catch (e: any) {
                                    setSnackbar({ msg: e?.message || 'Kunne ikke avbryte', severity: 'error' });
                                  }
                                }}
                                sx={{
                                  minWidth: 'auto',
                                  px: 2,
                                  borderColor: '#ef4444',
                                  color: '#ef4444',
                                  '&:hover': { borderColor: '#dc2626', bgcolor: 'rgba(239,68,68,0.08)' },
                                }}
                              >
                                Stopp
                              </Button>
                            </Tooltip>
                          )}

                          <Tooltip title={runningWorkflows.has(workflow.id) ? 'Workflow kjører...' : 'Start workflow'}>
                            <Box>
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<PlayArrow />}
                                onClick={() => executeWorkflow(workflow.id)}
                                disabled={runningWorkflows.has(workflow.id)}
                                sx={{
                                  minWidth: 'auto',
                                  px: 2,
                                  background: runningWorkflows.has(workflow.id) 
                                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.6) 0%, rgba(16, 185, 129, 0.6) 100%)'
                                    : 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                                  boxShadow: runningWorkflows.has(workflow.id) ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
                                  '&:hover': {
                                    background: 'linear-gradient(135deg, #5558E3 0%, #0EA472 100%)',
                                    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
                                  },
                                  '&:disabled': {
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.6) 0%, rgba(16, 185, 129, 0.6) 100%)',
                                    color: 'white'
                                  }
                                }}
                              >
                                {runningWorkflows.has(workflow.id) ? 'Kjører' : 'Start'}
                              </Button>
                            </Box>
                          </Tooltip>

                          {/* Slice 9X.79 — Planlegg-knapp */}
                          <Tooltip title={scheduleByWorkflow[workflow.id] ? 'Endre planlegging' : 'Planlegg automatisk kjøring'}>
                            <IconButton
                              size="small"
                              onClick={() => setScheduleDialogForWorkflow({ id: workflow.id, name: workflow.name })}
                              sx={{
                                color: '#9b87f5',
                                bgcolor: 'rgba(155,135,245,0.10)',
                                border: '1px solid rgba(155,135,245,0.22)',
                                '&:hover': { bgcolor: 'rgba(155,135,245,0.20)' },
                              }}
                            >
                              <ScheduleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Arkiver workflow">
                            <IconButton
                              size="small"
                              onClick={() => deleteWorkflow(workflow.id)}
                              sx={{
                                color: '#F59E0B',
                                bgcolor: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                '&:hover': {
                                  bgcolor: 'rgba(245, 158, 11, 0.2)',
                                  borderColor: 'rgba(245, 158, 11, 0.3)'
                                }
                              }}
                            >
                              <Archive sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>

                      {/* Workflow Steps */}
                      <Box sx={{ 
                        position: 'relative',
                        pl: 2,
                        '&:before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 8,
                          bottom: 8,
                          width: '2px',
                          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.3) 0%, rgba(16, 185, 129, 0.3) 100%)',
                          borderRadius: 1
                        }
                      }}>
                        {workflow.steps.map((step, index) => {
                          // Slice 9X.79 — live status fra engine-polling
                          const run = workflowRuns[workflow.id];
                          const stepStatus = run?.stepStatuses?.[index];
                          const liveStatus = stepStatus?.status;
                          const executionMode = stepStatus?.execution_mode;

                          // Bestem badge basert på status + mode
                          let statusBadge: { label: string; color: string; bg: string } | null = null;
                          if (liveStatus === 'completed') {
                            statusBadge = { label: '✓ Ferdig', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
                          } else if (liveStatus === 'running') {
                            statusBadge = { label: '⏳ Kjører', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
                          } else if (liveStatus === 'failed') {
                            statusBadge = { label: '✗ Feilet', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
                          } else if (liveStatus === 'awaiting_manual') {
                            statusBadge = { label: '👆 Manuelt', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
                          } else if (liveStatus === 'skipped') {
                            statusBadge = { label: '⊘ Hoppet over', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
                          } else if (executionMode === 'auto') {
                            statusBadge = { label: '🤖 Auto', color: '#10b981', bg: 'rgba(16,185,129,0.10)' };
                          } else if (executionMode === 'ai') {
                            statusBadge = { label: '✨ AI', color: '#9b87f5', bg: 'rgba(155,135,245,0.15)' };
                          } else if (executionMode === 'manual') {
                            statusBadge = { label: '👆 Manuelt', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' };
                          }

                          return (
                          <Box
                            key={step.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              mb: index < workflow.steps.length - 1 ? 1.5 : 0,
                              position: 'relative'
                            }}
                          >
                            {/* Step number indicator */}
                            <Box
                              sx={{
                                position: 'absolute',
                                left: -18,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: liveStatus === 'completed'
                                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                  : liveStatus === 'failed'
                                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                    : `linear-gradient(135deg, ${step.action.color} 0%, ${alpha(step.action.color, 0.7)} 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: 'white',
                                boxShadow: `0 2px 8px ${alpha(step.action.color, 0.3)}`,
                                zIndex: 1
                              }}
                            >
                              {liveStatus === 'completed' ? '✓' : liveStatus === 'failed' ? '!' : (index + 1)}
                            </Box>

                            {/* Step content */}
                            <Chip
                              icon={step.action.icon}
                              label={step.action.name}
                              size="small"
                              sx={{
                                flex: 1,
                                height: 32,
                                justifyContent: 'flex-start',
                                backgroundColor: `${step.action.color}08`,
                                border: `1px solid ${alpha(step.action.color, 0.2)}`,
                                color: step.action.color,
                                fontWeight: 500,
                                fontSize: '0.8rem',
                                opacity: liveStatus === 'completed' ? 0.7 : 1,
                                textDecoration: liveStatus === 'completed' ? 'line-through' : 'none',
                                '& .MuiChip-icon': {
                                  color: step.action.color,
                                  fontSize: '1rem'
                                },
                                '&:hover': {
                                  backgroundColor: `${step.action.color}15`,
                                  borderColor: alpha(step.action.color, 0.4)
                                }
                              }}
                            />

                            {/* Slice 9X.79 — execution-mode + live status badge */}
                            {statusBadge && (
                              <Chip
                                label={statusBadge.label}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  bgcolor: statusBadge.bg,
                                  color: statusBadge.color,
                                  border: `1px solid ${alpha(statusBadge.color, 0.32)}`,
                                  flexShrink: 0,
                                }}
                              />
                            )}

                            {/* Slice 9X.79 — actionUrl-knapp (åpne riktig modul) */}
                            {liveStatus === 'awaiting_manual' && stepStatus?.result_data?.actionUrl && (
                              <Button
                                size="small"
                                variant="outlined"
                                href={stepStatus.result_data.actionUrl}
                                sx={{
                                  height: 22,
                                  px: 1,
                                  fontSize: '0.66rem',
                                  textTransform: 'none',
                                  borderColor: '#3b82f6',
                                  color: '#3b82f6',
                                  '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' },
                                }}
                              >
                                Åpne →
                              </Button>
                            )}

                            {/* Manuell bekreft-knapp når awaiting_manual */}
                            {liveStatus === 'awaiting_manual' && run?.runId && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={async () => {
                                  try {
                                    await apiRequest(
                                      `/api/orchestration/workflows/runs/${run.runId}/steps/${index}/confirm`,
                                      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
                                    );
                                  } catch (e) {
                                    console.error('confirm failed:', e);
                                  }
                                }}
                                sx={{
                                  height: 22,
                                  px: 1,
                                  fontSize: '0.66rem',
                                  textTransform: 'none',
                                  borderColor: '#10b981',
                                  color: '#10b981',
                                  '&:hover': { bgcolor: 'rgba(16,185,129,0.08)' },
                                }}
                              >
                                Bekreft fullført
                              </Button>
                            )}

                            {/* Slice 9X.79 — Prøv-igjen-knapp på failed step */}
                            {liveStatus === 'failed' && run?.runId && (
                              <Tooltip title={stepStatus?.error_message || 'Re-kjør dette steget'}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<PlayArrow sx={{ fontSize: '0.85rem !important' }} />}
                                  onClick={async () => {
                                    try {
                                      const res: any = await apiRequest(
                                        `/api/orchestration/workflows/runs/${run.runId}/steps/${index}/retry`,
                                        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
                                      );
                                      if (res?.success) {
                                        setSnackbar({
                                          msg: res.status === 'completed' ? 'Steget gikk gjennom denne gangen' : `Steg-status: ${res.status}`,
                                          severity: res.status === 'completed' ? 'success' : res.status === 'failed' ? 'error' : 'info',
                                        });
                                        queryClient.invalidateQueries({ queryKey: ['workflow-recent-runs', userId] });
                                        // Pull oppdaterte step-statuser inn i live-state slik at badgen oppdateres umiddelbart
                                        try {
                                          const fresh: any = await apiRequest(`/api/orchestration/workflows/runs/${run.runId}`);
                                          if (fresh?.success) {
                                            setWorkflowRuns((prev) => ({
                                              ...prev,
                                              [workflow.id]: { runId: run.runId, stepStatuses: fresh.steps || [] },
                                            }));
                                          }
                                        } catch {
                                          /* graceful — polling tar det etterpå */
                                        }
                                      } else {
                                        setSnackbar({ msg: res?.error || 'Re-kjøring feilet', severity: 'error' });
                                      }
                                    } catch (e: any) {
                                      setSnackbar({ msg: e?.message || 'Re-kjøring feilet', severity: 'error' });
                                    }
                                  }}
                                  sx={{
                                    height: 22,
                                    px: 1,
                                    fontSize: '0.66rem',
                                    textTransform: 'none',
                                    borderColor: '#f59e0b',
                                    color: '#f59e0b',
                                    '&:hover': { bgcolor: 'rgba(245,158,11,0.08)' },
                                  }}
                                >
                                  Prøv igjen
                                </Button>
                              </Tooltip>
                            )}
                          </Box>
                          );
                        })}
                      </Box>

                      {/* Slice 9X.79 — progress + tellere */}
                      {(() => {
                        const run = workflowRuns[workflow.id];
                        if (!run?.stepStatuses?.length) return null;
                        const total = run.stepStatuses.length;
                        const done = run.stepStatuses.filter((s: any) => s.status === 'completed').length;
                        const failed = run.stepStatuses.filter((s: any) => s.status === 'failed').length;
                        const awaiting = run.stepStatuses.filter((s: any) => s.status === 'awaiting_manual').length;
                        const pct = total > 0 ? (done / total) * 100 : 0;
                        return (
                          <Box sx={{ mt: 2 }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)', fontWeight: 700 }}>
                                {done}/{total} fullført
                                {awaiting > 0 && <span style={{ color: '#3b82f6' }}> · {awaiting} venter</span>}
                                {failed > 0 && <span style={{ color: '#ef4444' }}> · {failed} feilet</span>}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.5)' }}>
                                {Math.round(pct)}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                '& .MuiLinearProgress-bar': {
                                  background: failed > 0
                                    ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)'
                                    : 'linear-gradient(90deg, #ffba6c 0%, #10b981 100%)',
                                  borderRadius: 3,
                                },
                              }}
                            />
                          </Box>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Archived Workflows Tab */}
      {activeTab === 'archived' && (
        <Card sx={{ mt: 3, ...theming.getThemedCardSx() }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <History /> Arkiverte Workflows ({archivedWorkflows.length})
            </Typography>

            {archivedWorkflows.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'grey.50' }}>
                <Archive sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                  Ingen arkiverte workflows
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Arkiverte workflows vil vises her og kan gjenopprettes
                </Typography>
              </Paper>
            ) : (
              archivedWorkflows.map((workflow) => (
                <Paper key={workflow.id} sx={{ p: 2, mb: 2, opacity: 0.7, backgroundColor: 'grey.50' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">
                        {workflow.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {workflow.steps.length} steg • Arkivert: {new Date(workflow.archivedAt ||', ').toLocaleDateString('nb-NO')}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Gjenopprett workflow">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => restoreWorkflow(workflow.id)}
                        >
                          <Restore />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett permanent">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => permanentDelete(workflow.id)}
                        >
                          <DeleteForever />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                    {workflow.steps.map((step, index) => (
                      <Chip
                        key={step.id}
                        size="small"
                        icon={step.action.icon}
                        label={`${index + 1}. ${step.action.name}`}
                        sx={{
                          backgroundColor: `${step.action.color}08`,
                          color: step.action.color,
                          opacity: 0.7
                        }}
                      />
                    ))}
                  </Stack>
                </Paper>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)}>
        <DialogTitle>Lagre Arbeidsflyt</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Navn på arbeidsflyt..."
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Avbryt</Button>
          <Button onClick={saveWorkflow} variant="contained" sx={theming.getThemedButtonSx()}>Lagre</Button>
        </DialogActions>
      </Dialog>

      {/* Slice 9X.79 — Run-historikk-dialog */}
      <WorkflowRunHistoryDialog
        open={showRunHistory}
        onClose={() => setShowRunHistory(false)}
        userId={userId || ''}
      />

      {/* Slice 9X.79 — Planleggings-dialog */}
      {scheduleDialogForWorkflow && (
        <WorkflowScheduleDialog
          open={!!scheduleDialogForWorkflow}
          onClose={() => setScheduleDialogForWorkflow(null)}
          userId={userId || ''}
          workflowId={scheduleDialogForWorkflow.id}
          workflowName={scheduleDialogForWorkflow.name}
          profession={profession}
        />
      )}

      {/* Slice 9X.79 — toast/snackbar ved start + ferdig */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={snackbar?.severity === 'success' ? 4000 : 6000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        message={snackbar?.msg}
        ContentProps={{
          sx: {
            bgcolor: snackbar?.severity === 'success' ? 'rgba(16,185,129,0.95)'
              : snackbar?.severity === 'error' ? 'rgba(239,68,68,0.95)'
              : snackbar?.severity === 'warning' ? 'rgba(245,158,11,0.95)'
              : 'rgba(59,130,246,0.95)',
            color: '#fff',
            fontWeight: 600,
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
          },
        }}
      />
    </Box>
);
};

export default SmartWorkflowBuilder;