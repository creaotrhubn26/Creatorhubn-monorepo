import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
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
  TextField
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
  History
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
      name: '🚀 Komplett Fotografprosess',
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
      name: '💒 Bryllupsdagprosess',
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
      name: '👥 Klient Onboarding',
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
      name: '🎬 Komplett Videoproduksjon',
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
      name: '💒 Bryllupsvideo Produksjon',
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
      name: '🎵 Komplett Musikkproduksjon',
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
      name: '🎤 Demo Produksjon',
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
      name: '📦 Ordre Fullføring',
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

  // Theming system
  const theming = useTheming(profession);
  const [workflowName, setWorkflowName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [runningWorkflows, setRunningWorkflows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const { auth } = useEnhancedMasterIntegration();

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

  const saveWorkflow = () => {
    if (currentWorkflow.length > 0 && workflowName.trim()) {
      const newWorkflow: CustomWorkflow = {
        id: `workflow-${Date.now()}`,
        name: workflowName,
        steps: currentWorkflow,
        profession,
        isRunning: false
};
      setWorkflows([...workflows, newWorkflow]);
      setCurrentWorkflow([]);
      setWorkflowName(', ');
      setIsBuilding(false);
      setShowSaveDialog(false);
}
};

  const executeWorkflow = async (workflowId: string) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    setRunningWorkflows((prev) => new Set(prev).add(workflowId));

    // Execute each step sequentially
    for (const step of workflow.steps) {
      try {
        const authHeaders = await auth.getAuthHeader();
        const response = await apiRequest('/api/workflow/execute', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            action: step.action.id,
            params: step.params || {},
            profession,
            timestamp: Date.now(),
          }),
        });

        const result = await response.json();
        console.log(`✅ Workflow step completed: ${step.action.name}`, result);

        // Small delay between steps
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Workflow step failed: ${step.action.name}`, error);
      }
    }

    setRunningWorkflows((prev) => {
      const updated = new Set(prev);
      updated.delete(workflowId);
      return updated;
    });
  };

  const deleteWorkflow = (workflowId: string) => {
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
}
};

  const restoreWorkflow = (workflowId: string) => {
    const workflowToRestore = archivedWorkflows.find(w => w.id === workflowId);
    if (workflowToRestore) {
      // Remove archive properties and restore
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { archivedAt, archivedReason, ...restoredWorkflow } = workflowToRestore;
      setWorkflows([...workflows, restoredWorkflow]);
      setArchivedWorkflows(archivedWorkflows.filter(w => w.id !== workflowId));
    }
  };

  const permanentDelete = (workflowId: string) => {
    setArchivedWorkflows(archivedWorkflows.filter(w => w.id !== workflowId));
};

  return (
    <Box sx={{ p:  3, maxHeight: '80vh', overflow: 'auto'}}>
      <Typography variant="h4" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  2  }}>
        <AutoAwesome sx={{ color: '#32cd32'}} />
        Smart Arbeidsflyt
      </Typography>
      
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb:  2 }}>
        Automatiser hele fotografprosessen med ett klikk
      </Typography>

      {/* Archive/Active Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} aria-label="workflow tabs">
          <Tab label={`Aktive Workflows (${workflows.length})`} value="active" />
          <Tab label={`Arkiv (${archivedWorkflows.length})`} value="archived" />
        </Tabs>
      </Box>

      {/* Feature explanation for photographers */}
      {profession === 'photographer' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>🚀 Komplett Fotografprosess: </strong> Last opp bilder → Velg prosjektmappe → CreatorHub Photo Enhancer → Automatisk culling → Opprett showcase → Send e-post til klient
          </Typography>
          <Typography variant="body2">
            <strong>Tidsbesparelse:</strong> Fra 3-4 timer manuelt arbeid til 15 minutter automatisk prosessering!
          </Typography>
        </Alert>
      )}

      {/* Action Buttons */}
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
        <Card sx={{ mt: 3, ...theming.getThemedCardSx() }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
              Aktive Workflows ({workflows.length})
            </Typography>

            {workflows.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'grey.50' }}>
                <AutoAwesome sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                  Ingen aktive workflows
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bygg din egen workflow eller bruk forhåndsdefinerte maler
                </Typography>
              </Paper>
            ) : (
              workflows.map((workflow) => (
                <Paper key={workflow.id} sx={{ p: 2, mb: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {workflow.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {workflow.steps.length} steg
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Badge
                        badgeContent={workflow.steps.length}
                        color="primary"
                        invisible={!runningWorkflows.has(workflow.id)}
                      >
                        <Button
                          variant="contained"
                          startIcon={runningWorkflows.has(workflow.id) ? theming.getThemedIcon('stop') : theming.getThemedIcon('play')}
                          onClick={() => executeWorkflow(workflow.id)}
                          disabled={runningWorkflows.has(workflow.id)}
                          size="small"
                          sx={theming.getThemedButtonSx()}
                        >
                          {runningWorkflows.has(workflow.id) ? 'Kjører...' : 'Start'}
                        </Button>
                      </Badge>

                      <Tooltip title="Arkiver workflow">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => deleteWorkflow(workflow.id)}
                        >
                          <Archive />
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
                          backgroundColor: `${step.action.color}10`,
                          color: step.action.color
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
    </Box>
);
};

export default SmartWorkflowBuilder;