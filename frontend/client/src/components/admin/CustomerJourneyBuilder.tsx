/**
 * Customer Journey Builder Component
 * Profesjon-tilpasset journey creation med AI-generert innhold
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
// import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Paper,
  Divider,
  Alert,
  Snackbar,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tooltip,
  Avatar,
  Badge
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Save,
  PlayArrow,
  Visibility,
  DragIndicator,
  Psychology,
  SmartToy,
  AutoFixHigh,
  Insights,
  ExpandMore,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Business,
  Timeline,
  TrendingUp,
  Quiz,
  Calculate,
  VideoLibrary,
  Animation,
  Settings,
  Preview,
  Publish,
  Analytics,
  ContentCopy,
  Download,
  ViewColumn,
  DonutLarge,
  Timeline as TimelineIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { apiRequest } from '../../lib/queryClient';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import NotesSidebar from '../notes/NotesSidebar';
import NoteEditor from '../notes/NoteEditor';
import NotePreview from '../notes/NotePreview';
import AIUtilitiesPanel from '../notes/AIUtilitiesPanel';
import { useAutosave } from '../notes/hooks/useAutosave';
import ReactFlow, { Node, Edge, Connection, Background, Controls, MiniMap, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import 'quill/dist/quill.snow.css';

// 🆕 Enhanced Building Blocks System - Core Structure

// Stage Types (Framework of the Journey)
type StageType = 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'advocacy';

interface JourneyStage {
  id: string;
  type: StageType;
  name: string;
  customName?: string;
  color: string;
  icon: string;
  order: number;
  description: string;
  goals?: string[];
  metrics?: {
    conversionRate?: number;
    dropoffRate?: number;
    avgTimeSpent?: number;
};
}

// Touchpoint Types
type TouchpointType = 'social_ad' | 'website' | 'email' | 'video' | 'landing_page' | 
                      'store_visit' | 'phone_call' | 'chat' | 'webinar' | 'content' | 
                      'referral' | 'event' | 'demo' | 'trial' | 'onboarding';

interface Touchpoint {
  id: string;
  type: TouchpointType;
  name: string;
  stageId: string;
  description: string;
  media?: {
    type: 'image' | 'video' | 'link' | 'document';
    url: string;
    thumbnail?: string;
};
  cta?: {
    text: string;
    url: string;
    action: string;
};
  linkedData?: {
    campaignUrl?: string;
    videoFileId?: string;
    crmEntryId?: string;
    analyticsId?: string;
};
  notes?: string[];
  order: number;
  estimatedDuration?: number;
  conversionRate?: number;
  aiSuggestions?: {
    messageType?: 'emotional' | 'rational' | 'urgency' | 'social_proof';
    recommendedContent?: string;
    predictedConversion?: number;
};
}

// Persona Types
interface CustomerPersona {
  id: string;
  name: string;
  avatar?: string;
  imageUrl?: string;
  demographics: {
    age?: string;
    location?: string;
    occupation?: string;
    income?: string;
};
  psychographics: {
    motivations: string[];
    painPoints: string[];
    goals: string[];
    frustrations: string[];
    values: string[];
};
  behavior: {
    preferredChannels: string[];
    buyingTriggers: string[];
    decisionFactors: string[];
  };
  aiGenerated?: boolean;
  customFields?: Record<string, string>;
}

// Journey Visualization Types
type VisualizationType = 'timeline' | 'funnel' | 'circular' | 'matrix';

// Enhanced Journey Step (Building Block)
interface JourneyStepConfig {
  aiGenerated?: boolean;
  generatedAt?: string;
  metrics?: Record<string, number>;
  callToAction?: string;
  imageUrl?: string;
  componentId?: string;
  componentType?: string;
  estimatedDuration?: number;
  conversionGoal?: string;
  targetAudience?: string[];
  // 🆕 New building block properties
  stageId?: string;
  touchpointIds?: string[];
  personaId?: string;
  inlineComments?: {
    id: string;
    author: string;
    text: string;
    timestamp: number;
  }[];
}

interface JourneyStep {
  id: string;
  stepOrder: number;
  stepType: string;
  title: string;
  content: string;
  componentConfig: JourneyStepConfig;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Enhanced Journey Template with Building Blocks
interface JourneyTemplate {
  id?: string;
  name: string;
  description: string;
  profession: string;
  packageType: string;
  status: 'draft' | 'active' | 'archived' | 'published';
  steps: JourneyStep[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  estimatedCompletionTime?: number;
  conversionRate?: number;
  usageCount?: number;
  
  // 🆕 Building Blocks System
  stages: JourneyStage[];
  touchpoints: Touchpoint[];
  personas: CustomerPersona[];
  visualizationType: VisualizationType;
  activePersonaId?: string;
  templateType?: 'ecommerce' | 'wedding' | 'b2b' | 'saas' | 'service' | 'custom';
  
  // Advanced Features
  dynamicLinks: {
    [touchpointId: string]: {
      url: string;
      type: string;
      metadata: Record<string, any>;
    };
  };
  
  aiInsights?: {
    predictedConversionPath: string[];
    optimizationSuggestions: string[];
    personaRecommendations: string[];
    lastUpdated: string;
  };
  
  // 🔗 Bi-Directional Sync
  linkedNoteId?: string;
  isTemplate?: boolean;
  templateCategory?: 'marketing' | 'sales' | 'onboarding' | 'retention' | 'custom';
  abTestVariantId?: string;
  abTestBaselineId?: string;
}

interface InteractiveComponent {
  id: string;
  componentType: string;
  name: string;
  description: string;
  profession?: string;
  category: string;
  previewImage?: string;
  estimatedDuration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

// Pre-built Templates
interface JourneyTemplatePreset {
  id: string;
  name: string;
  description: string;
  type: 'ecommerce' | 'wedding' | 'b2b' | 'saas' | 'service' | 'custom';
  stages: Partial<JourneyStage>[];
  touchpoints: Partial<Touchpoint>[];
  personas: Partial<CustomerPersona>[];
  icon: string;
  color: string;
}

interface CustomerJourneyBuilderProps {
  selectedProfession?: string;
}

export default function CustomerJourneyBuilder({ selectedProfession = 'photographer,' }: CustomerJourneyBuilderProps) {
  const queryClient = useQueryClient();
  
  // 🆕 Enhanced Master Integration
  const {
    integration,
    communication,
    dataFlow,
    componentRegistry,
    analytics,
    debugging,
    performance,
    lifecycle,
    features,
    auth
} = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester,');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<JourneyTemplate | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStep, setEditingStep] = useState<JourneyStep | null>(null);
  const [aiGeneration, setAiGeneration] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Enhanced state management
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPackage, setFilterPackage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'usage'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const [componentAnalytics, setComponentAnalytics] = useState({
    totalJourneys: 0,
    activeJourneys: 0,
    avgConversion: 0,
    totalSteps: 0
});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });

  // 🆕 Notes Integration
  const [journeyNotes, setJourneyNotes] = useState('');
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // 🆕 Journey Map Visualizer
  const [visualizationMode, setVisualizationMode] = useState<'timeline' | 'funnel' | 'circular'>('timeline');

  // 🆕 Visual Preview Mode (React Flow)
  const [visualPreviewMode, setVisualPreviewMode] = useState(false);
  const [reactFlowNodes, setReactFlowNodes] = useState<Node[]>([]);
  const [reactFlowEdges, setReactFlowEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // 🆕 Component Registration & Cross-Component Communication
  useEffect(() => {
    const componentId = `customer-journey-builder-${selectedProfession}`;
    
    lifecycle.registerComponent({
      id: componentId,
      type: 'customer-journey-builder',
      version: '2.0.0',
      capabilities: {
        data: ['journey-templates','components','analytics'],
        events: ['journey-created','journey-updated','ai-generated'],
        actions: ['create-journey','update-journey','generate-ai-content'],
        ui: ['search','filter','sort','preview'],
        system: ['performance-monitor','analytics-track']
    },
      dependencies: ['theming','react-query','material-ui'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
    }
  });

    analytics.trackEvent('component_mounted', { 
      componentId, 
      profession: selectedProfession,
      timestamp: Date.now()
  });
    
    // 🚀 Listen for "Create Journey from Note" events
    const unsubscribeJourneyFromNote = communication.onMessageType('create-journey-from-note', (message: any) => {
      const { noteId, noteTitle, journeyStructure, userId: noteUserId } = message.data;
      
      debugging.logIntegration('info, ','Received journey creation request from note', {
        noteTitle,
        noteId,
        userId: noteUserId
      });
      
      // 🎯 Create journey from AI-extracted structure with bi-directional link
      const newJourney: JourneyTemplate = {
        name: noteTitle || 'Journey from Note',
        description: journeyStructure.description || 'Created from CreatorHub Notes',
        profession: selectedProfession,
        packageType: journeyStructure.packageType || 'creator_premium',
        status: 'draft',
        steps: journeyStructure.steps || [],
        stages: journeyStructure.stages || [...defaultStages],
        touchpoints: journeyStructure.touchpoints || [],
        personas: journeyStructure.personas || [],
        visualizationType: 'timeline',
        dynamicLinks: {},
        tags: ['from-note', ...(journeyStructure.tags || [])],
        linkedNoteId: noteId // 🔗 Link back to source note
      };
      
      setTemplateForm(newJourney);
      setOpenDialog(true);
      
      // Show success notification
      setTimeout(() => {
        setSnackbar({ open: true, message: `✨ Journey "${noteTitle}" created from your note! 🔗 Linked to note - edits will sync automatically.`, severity: 'success' });
      }, 500);
      
      // 🎯 Track event
      analytics.trackEvent('journey_created_from_note', {
        noteTitle,
        noteId,
        stagesCount: newJourney.stages.length,
        touchpointsCount: newJourney.touchpoints.length,
        linked: true
      });
    });

    return () => {
      lifecycle.unregisterComponent(componentId);
      analytics.trackEvent('component_unmounted', { componentId });
      unsubscribeJourneyFromNote();
  };
}, [selectedProfession, lifecycle, analytics, communication, debugging]);

  // 🆕 Performance Monitoring for Operations
  const trackOperation = useCallback((operation: string, data?: any) => {
    const endTiming = performance.startTiming(`journey-${operation}`);
    analytics.trackEvent(`journey_${operation}`, data);
    return endTiming;
}, [performance, analytics]);

  // 🆕 Feature Access Control
  const canUseAI = features.checkFeatureAccess('ai-generation', auth.state.user?.role).hasAccess;
  const canExportJourneys = features.checkFeatureAccess('export-journeys', auth.state.user?.role).hasAccess;
  const canDeleteJourneys = features.checkFeatureAccess('delete-journeys', auth.state.user?.role).hasAccess;

  // 🆕 Default Journey Stages (The Framework)
  const defaultStages: JourneyStage[] = [
    {
      id: 'stage_awareness',
      type: 'awareness',
      name: 'Awareness',
      color: '#3b82f6',
      icon: 'visibility',
      order: 1,
      description: 'Customer becomes aware of your brand or solution',
      goals: ['Build brand recognition','Generate interest']
  },
    {
      id: 'stage_consideration',
      type: 'consideration',
      name: 'Consideration',
      color: '#8b5cf6',
      icon: 'search',
      order: 2,
      description: 'Customer evaluates options and compares solutions',
      goals: ['Educate prospects','Build trust','Differentiate from competitors']
  },
    {
      id: 'stage_decision',
      type: 'decision',
      name: 'Decision',
      color: '#f59e0b',
      icon: 'psychology',
      order: 3,
      description: 'Customer is ready to make a purchase decision',
      goals: ['Remove objections','Provide proof','Create urgency']
  },
    {
      id: 'stage_purchase',
      type: 'purchase',
      name: 'Purchase',
      color: '#10b981',
      icon: 'shopping_cart',
      order: 4,
      description: 'Customer completes the transaction',
      goals: ['Simplify checkout','Reduce friction','Confirm value']
  },
    {
      id: 'stage_retention',
      type: 'retention',
      name: 'Retention',
      color: '#06b6d4',
      icon: 'favorite',
      order: 5,
      description: 'Keep customers engaged and satisfied',
      goals: ['Deliver value','Build loyalty','Encourage repeat purchases']
  },
    {
      id: 'stage_advocacy',
      type: 'advocacy',
      name: 'Advocacy',
      color: '#ec4899',
      icon: 'campaign',
      order: 6,
      description: 'Turn customers into brand advocates',
      goals: ['Generate referrals','Collect testimonials','Build community']
  }
  ];

  // 🆕 Pre-built Journey Templates
  const journeyPresets: JourneyTemplatePreset[] = [
    {
      id: 'preset_creatorhub_platform',
      name: 'CreatorHub Platform',
      description: 'Fra Kaos Til Kontroll: 10+ verktøy → 1 verktøy. Spar 10 timer/uke + 1,218 kr/måned.',
      type: 'saas',
      icon: 'dashboard',
      color: '#ff8c00',
      stages: [
        { id: 'stage_1', type: 'awareness', name: 'Problem', customName: 'Kaos', color: '#ef4444', icon: 'error_outline', order: 1, description: 'Drukner i Excel/Gmail', goals: ['Gjenkjennelse','Validering'], metrics: { conversionRate: 40 } },
        { id: 'stage_2', type: 'awareness', name: 'Løsning', customName: 'Oppdagelse', color: '#ff8c00', icon: 'lightbulb_outline', order: 2, description: 'Finner CreatorHub', goals: ['10→1 verktøy','15→5 timer','1,717→499 kr'], metrics: { conversionRate: 50 } },
        { id: 'stage_3', type: 'consideration', name: 'Tillit', customName: 'Bevis', color: '#10b981', icon: 'verified_user', order: 3, description: 'Ser det fungerer', goals: ['847 creators','Case studies','Demo'], metrics: { conversionRate: 60 } },
        { id: 'stage_4', type: 'decision', name: 'Test', customName: '30 dager', color: '#3b82f6', icon: 'science', order: 4, description: 'Gratis test', goals: ['Første prosjekt','Google sync','3+ features'], metrics: { conversionRate: 85 } },
        { id: 'stage_5', type: 'purchase', name: 'Verdi', customName: 'Konkret bevis', color: '#8b5cf6', icon: 'auto_graph', order: 5, description: 'Ser besparelser', goals: ['Dashboard: Timer spart','Daglig bruk','5+ features'], metrics: { conversionRate: 70 } },
        { id: 'stage_6', type: 'purchase', name: 'Kjøp', customName: 'Oppgrader', color: '#ec4899', icon: 'credit_card', order: 6, description: 'Premium 499 kr', goals: ['ROI klar','Urgency','Rabatt'], metrics: { conversionRate: 22 } },
        { id: 'stage_7', type: 'retention', name: 'Elsker', customName: 'Power user', color: '#06b6d4', icon: 'favorite', order: 7, description: 'Daglig bruk', goals: ['10+ features','Community'], metrics: { conversionRate: 92 } },
        { id: 'stage_8', type: 'advocacy', name: 'Ambassador', customName: 'Evangelist', color: '#f59e0b', icon: 'campaign', order: 8, description: 'Anbefaler', goals: ['Referrals','Testimonial'], metrics: { conversionRate: 35 } }
      ],
      touchpoints: [
        { type: 'social_ad', name: "🎬 'Kjenner Du Deg Igjen?'", stageId: 'stage_1', order: 1, description: '30-sek: Drukner i tabs', estimatedDuration: 30, conversionRate: 5.2 },
        { type: 'content', name: '📊 FØR vs ETTER', stageId: 'stage_2', order: 2, description: '10 verktøy → 1', estimatedDuration: 120, conversionRate: 18.5 },
        { type: 'content', name: "💰 'Hvor Mye Kan DU Spare?'", stageId: 'stage_2', order: 3, description: 'ROI calculator', estimatedDuration: 180, conversionRate: 32.5 },
        { type: 'video', name: "📸 'Fra 20 Til 50 Bryllup'", stageId: 'stage_3', order: 4, description: 'Case study video', estimatedDuration: 360, conversionRate: 28.3 },
        { type: 'content', name: '⭐ 847 Creators, 4.8/5', stageId: 'stage_3', order: 5, description: 'Testimonial wall', estimatedDuration: 240, conversionRate: 35.7 },
        { type: 'demo', name: '🎮 Test Uten Å Registrere', stageId: 'stage_3', order: 6, description: 'Interactive sandbox', estimatedDuration: 600, conversionRate: 52.3 },
        { type: 'trial', name: '👋 3 Min Til WOW-Moment', stageId: 'stage_4', order: 7, description: 'Onboarding wizard', estimatedDuration: 180, conversionRate: 92.5 },
        { type: 'content', name: '📊 Du Har Spart [X] Timer', stageId: 'stage_5', order: 8, description: 'Value dashboard', estimatedDuration: 120, conversionRate: 65.3 },
        { type: 'email', name: '📧 Day 7: Spart 6 Timer!', stageId: 'stage_5', order: 9, description: 'Value reminder', estimatedDuration: 120, conversionRate: 58.5 },
        { type: 'email', name: '📧 Day 14: 40% Rabatt NÅ', stageId: 'stage_5', order: 10, description: 'Early bird', estimatedDuration: 150, conversionRate: 45.8 },
        { type: 'phone_call', name: '📞 Day 21: Personal Call', stageId: 'stage_5', order: 11, description: 'High-value only', estimatedDuration: 1800, conversionRate: 82.5 },
        { type: 'email', name: '📧 Day 27: Mist Ikke 14k kr', stageId: 'stage_6', order: 12, description: 'Loss aversion', estimatedDuration: 120, conversionRate: 52.0 },
        { type: 'email', name: '📧 Day 29: SISTE DAG', stageId: 'stage_6', order: 13, description: 'Final offer', estimatedDuration: 90, conversionRate: 71.2 },
        { type: 'onboarding', name: '🎉 Velkommen!', stageId: 'stage_6', order: 14, description: 'Premium welcome', estimatedDuration: 240, conversionRate: 100 },
        { type: 'referral', name: '🎁 Henvis = Gratis', stageId: 'stage_8', order: 15, description: 'Referral program', estimatedDuration: 120, conversionRate: 32.5 }
      ],
      personas: [
        {
          name: 'Maria - Bryllupsfotograf Bergen',
          demographics: { age: '29', location: 'Bergen', occupation: 'Fotograf', income: '320k kr/år' },
          psychographics: {
            motivations: ['Doble inntekt','Spare tid','Slutte stress'],
            painPoints: ['15 timer/uke admin','Redd for å miste filer','Klienter spør konstant'],
            goals: ['5 timer/uke admin','Automatisk backup','Client portal'],
            frustrations: ['Excel kaotisk','Drive uorganisert','Gmail chaos'],
            values: ['Enkelhet','Pålitelighet','Norsk']
          },
          behavior: {
            preferredChannels: ['Instagram','Facebook','Email'],
            buyingTriggers: ['Testimonials','10 timer/uke spart','30 dager gratis'],
            decisionFactors: ['Hvor lett?','Verdt 499 kr?','Får hjelp?']
          }
        }
      ]
    },
    {
      id: 'preset_seo_service',
      name: 'SEO Automation Service Journey',
      description: 'Complete journey for selling Professional SEO to Norwegian creators',
      type: 'saas',
      icon: 'search',
      color: '#3b82f6',
      stages: [
        { id: 'stage_awareness', type: 'awareness', name: 'Oppdagelse', customName: 'Oppdager SEO-problem', color: '#3b82f6', icon: 'visibility', order: 1, description: 'Blir klar over at de mangler Google-synlighet', goals: ['Skape bevissthet','Vise viktighet','Introdusere løsning'], metrics: { conversionRate: 45, dropoffRate: 55, avgTimeSpent: 120 } },
        { id: 'stage_consideration', type: 'consideration', name: 'Vurdering', customName: 'Sammenligner løsninger', color: '#8b5cf6', icon: 'search', order: 2, description: 'Sammenligner DIY vs konsulent vs CreatorHub', goals: ['Vise beste alternativ','Demonstrere ROI','Bygge tillit'], metrics: { conversionRate: 65, dropoffRate: 35, avgTimeSpent: 300 } },
        { id: 'stage_decision', type: 'decision', name: 'Beslutning', customName: 'Klar for test', color: '#f59e0b', icon: 'psychology', order: 3, description: 'Klar til å starte gratis test', goals: ['Fjerne tvil','Fremheve 14-dagers test','Skape urgency'], metrics: { conversionRate: 80, dropoffRate: 20, avgTimeSpent: 180 } },
        { id: 'stage_trial', type: 'purchase', name: 'Gratis Test', customName: '14-dagers test', color: '#10b981', icon: 'assignment', order: 4, description: 'Tester systemet gratis', goals: ['Gjennomføre første optimalisering','WOW-effekt (45→98)','Bygge vane'], metrics: { conversionRate: 90, dropoffRate: 10, avgTimeSpent: 600 } },
        { id: 'stage_purchase', type: 'purchase', name: 'Konvertering', customName: 'Oppgraderer til betalt', color: '#ec4899', icon: 'shopping_cart', order: 5, description: 'Oppgraderer til Pro (299 kr/mnd)', goals: ['Konvertere trial','Fremheve verdi','Tilby rabatt'], metrics: { conversionRate: 15, dropoffRate: 85, avgTimeSpent: 120 } },
        { id: 'stage_retention', type: 'retention', name: 'Beholde', customName: 'Fornøyd kunde', color: '#06b6d4', icon: 'favorite', order: 6, description: 'Bruker aktivt hver måned', goals: ['Månedlig bruk','Månedlige rapporter','Nye funksjoner'], metrics: { conversionRate: 95, dropoffRate: 5, avgTimeSpent: 900 } },
        { id: 'stage_advocacy', type: 'advocacy', name: 'Anbefaling', customName: 'Aktiv ambassador', color: '#f59e0b', icon: 'campaign', order: 7, description: 'Anbefaler til andre', goals: ['Testimonials','Referral program','Sosial deling'], metrics: { conversionRate: 25, dropoffRate: 0, avgTimeSpent: 300 } }
      ],
      touchpoints: [
        { type: 'social_ad', name: '📱 Instagram/Facebook Annonse', stageId: 'stage_awareness', order: 1, description: 'Før/etter Google-søkeresultater', estimatedDuration: 30, conversionRate: 3.5, aiSuggestions: { messageType: 'emotional', recommendedContent: 'Stjerner ⭐⭐⭐⭐⭐ vs ingen stjerner', predictedConversion: 3.5 } },
        { type: 'content', name: "📝 Blog: 'Hvorfor Vises Ikke Min Bedrift?'", stageId: 'stage_awareness', order: 2, description: 'SEO-optimalisert bloggpost', estimatedDuration: 45, conversionRate: 8.2 },
        { type: 'landing_page', name: '🎯 SEO Services Landing Page', stageId: 'stage_consideration', order: 3, description: 'Fordeler, pricing, case studies', estimatedDuration: 180, conversionRate: 35 },
        { type: 'video', name: '🎥 3-Minutters Demo Video', stageId: 'stage_consideration', order: 4, description: 'Full SEO-optimalisering demo', estimatedDuration: 180, conversionRate: 52 },
        { type: 'webinar', name: "📚 Webinar: 'SEO Masterclass'", stageId: 'stage_consideration', order: 5, description: 'Live webinar med Q&A', estimatedDuration: 3600, conversionRate: 68 },
        { type: 'email', name: '📧 Personal FOMO Email', stageId: 'stage_decision', order: 6, description: 'FOMO-email som trigger beslutning', estimatedDuration: 120, conversionRate: 42, aiSuggestions: { messageType: 'urgency', recommendedContent: 'DU mister kunder (ikke sosial)', predictedConversion: 42 } },
        { type: 'trial', name: '✨ Interactive Tutorial', stageId: 'stage_trial', order: 7, description: '6-step tutorial med WOW-effekt', estimatedDuration: 180, conversionRate: 90 },
        { type: 'email', name: "📧 Day 7: 'Hvordan Går Det?'", stageId: 'stage_trial', order: 8, description: 'Midtveis check-in', estimatedDuration: 60, conversionRate: 25 },
        { type: 'email', name: '📧 Day 12: ⏰ 2 Dager + 20% Rabatt', stageId: 'stage_decision', order: 9, description: 'Urgency email', estimatedDuration: 90, conversionRate: 58 },
        { type: 'email', name: '📧 Day 14: 🔥 SISTE SJANSE', stageId: 'stage_purchase', order: 10, description: 'Maksimal urgency', estimatedDuration: 45, conversionRate: 72 },
        { type: 'onboarding', name: "🎉 Welcome: 'Velkommen til Pro!'", stageId: 'stage_purchase', order: 11, description: 'Quick wins guide', estimatedDuration: 120, conversionRate: 100 },
        { type: 'email', name: '📧 Monthly SEO Report', stageId: 'stage_retention', order: 12, description: 'Automatisert månedlig rapport', estimatedDuration: 300, conversionRate: 95 },
        { type: 'referral', name: '🎁 Referral: Del og Få Gratis', stageId: 'stage_advocacy', order: 13, description: 'Begge får 1 måned gratis', estimatedDuration: 60, conversionRate: 18 },
        { type: 'chat', name: '💬 In-App Support Chat', stageId: 'stage_retention', order: 14, description: 'Live support for Pro users', estimatedDuration: 300, conversionRate: 88 },
        { type: 'event', name: '📸 Case Study Request', stageId: 'stage_advocacy', order: 15, description: 'Bli vår suksesshistorie', estimatedDuration: 1800, conversionRate: 12 }
      ],
      personas: [
        {
          name: 'Lars - Bryllupsfotograf i Oslo',
          demographics: { age: '32 år', location: 'Oslo, Norge', occupation: 'Bryllupsfotograf', income: '450,000-650,000 kr/år' },
          psychographics: {
            motivations: ['Flere bookinger','Google-synlighet','Profesjonell profil','Spare tid'],
            painPoints: ['Vises ikke på Google','Ingen stjerner ⭐','SEO for teknisk','Har ikke tid','Konsulenter for dyre'],
            goals: ['Topp 3 på Google','Stjerner i søk','5-10 flere henvendelser/måned','<30 min/måned på SEO'],
            frustrations: ['Google Business forvirrende','Schema.org teknisk','Redd for å ødelegge nettside'],
            values: ['Enkelhet','Tidsbesparing','Profesjonalitet','Resultater']
          },
          behavior: {
            preferredChannels: ['Instagram','Email','Google','Facebook'],
            buyingTriggers: ['Før/etter-eksempler','Testimonials','Gratis test','Tidsbesparing','Kostnadsbesparelse'],
            decisionFactors: ['Hvor enkelt?','Funker det?','Hva koster det?','Kan jeg stoppe?','Får jeg hjelp?']
          }
        },
        {
          name: 'Ingrid - Videograf i Bergen',
          demographics: { age: '28 år', location: 'Bergen, Norge', occupation: 'Videograf', income: '380,000-550,000 kr/år' },
          psychographics: {
            motivations: ['Flere bedriftskunder','Corporate video synlighet','Profesjonell tilstedeværelse'],
            painPoints: ['Portfolio vises ikke','Konkurrerer mot større','Mangler tid','Video-SEO ukjent'],
            goals: ['3-5 bedriftskunder/kvartal','Topp 5 Google','Video-thumbnails i søk'],
            frustrations: ['DIY for komplisert','SEO-ekspert dyrt','Usikker på hva som fungerer'],
            values: ['Kvalitet','Autentisitet','Effektivitet']
          },
          behavior: {
            preferredChannels: ['LinkedIn','Instagram','Email','Vimeo'],
            buyingTriggers: ['B2B case studies','ROI-kalkulator','Video testimonials','Gratis test'],
            decisionFactors: ['Virker for videografer?','Video-thumbnails?','Pris vs verdi?','Kan kansellere?']
          }
        }
      ]
    },
    {
      id: 'preset_ecommerce',
      name: 'E-commerce Customer Journey',
      description: 'Complete journey for online store customers',
      type: 'ecommerce',
      icon: 'shopping_bag',
      color: '#10b981',
      stages: defaultStages,
      touchpoints: [
        { type: 'social_ad', name: 'Instagram Ad', stageId: 'stage_awareness', order: 1 },
        { type: 'landing_page', name: 'Product Landing Page', stageId: 'stage_consideration', order: 2 },
        { type: 'email', name: 'Abandoned Cart Email', stageId: 'stage_decision', order: 3 },
        { type: 'website', name: 'Checkout Page', stageId: 'stage_purchase', order: 4 },
        { type: 'email', name: 'Thank You & Onboarding', stageId: 'stage_retention', order: 5 },
        { type: 'referral', name: 'Referral Program', stageId: 'stage_advocacy', order: 6 }
      ],
      personas: [
        {
          name: 'Sarah - The Busy Professional',
          demographics: { age: '30-40', occupation: 'Marketing Manager' },
          psychographics: {
            motivations: ['Convenience','Quality','Time-saving'],
            painPoints: ['Too busy to shop in-store','Wants fast delivery'],
            goals: ['Find quality products quickly','Easy checkout'],
            frustrations: ['Complicated checkout','Slow shipping'],
            values: ['Efficiency','Quality','Reliability']
        },
          behavior: {
            preferredChannels: ['Instagram','Email'],
            buyingTriggers: ['Limited time offers','Social proof'],
            decisionFactors: ['Reviews','Fast shipping','Return policy']
        }
      }
      ]
  },
    {
      id: 'preset_wedding',
      name: 'Wedding Client Journey',
      description: 'Journey for wedding photographers/planners',
      type: 'wedding',
      icon: 'favorite',
      color: '#ec4899',
      stages: defaultStages,
      touchpoints: [
        { type: 'social_ad', name: 'Pinterest/Instagram Portfolio', stageId: 'stage_awareness', order: 1 },
        { type: 'website', name: 'Portfolio Website Visit', stageId: 'stage_consideration', order: 2 },
        { type: 'phone_call', name: 'Initial Consultation Call', stageId: 'stage_decision', order: 3 },
        { type: 'demo', name: 'In-Person Meeting', stageId: 'stage_decision', order: 4 },
        { type: 'email', name: 'Contract & Booking', stageId: 'stage_purchase', order: 5 },
        { type: 'email', name: 'Pre-Wedding Planning', stageId: 'stage_retention', order: 6 },
        { type: 'referral', name: 'Testimonial & Referral Request', stageId: 'stage_advocacy', order: 7 }
      ],
      personas: [
        {
          name: 'Emily & Jake - The Engaged Couple',
          demographics: { age: '25-35', occupation: 'Young Professionals' },
          psychographics: {
            motivations: ['Capture memories','Impress guests','Quality photos'],
            painPoints: ['Overwhelmed by options','Budget concerns','Trust issues'],
            goals: ['Find the perfect photographer','Stay within budget'],
            frustrations: ['Hidden fees','Poor communication','Generic portfolios'],
            values: ['Authenticity','Creativity','Professionalism']
        },
          behavior: {
            preferredChannels: ['Instagram','Pinterest','Google'],
            buyingTriggers: ['Emotional connection','Portfolio quality','Personal recommendations'],
            decisionFactors: ['Style match','Pricing','Personality fit']
        }
      }
      ]
  },
    {
      id: 'preset_b2b',
      name: 'B2B Lead Nurturing',
      description: 'Journey for B2B sales and lead generation',
      type: 'b2b',
      icon: 'business',
      color: '#3b82f6',
      stages: defaultStages,
      touchpoints: [
        { type: 'content', name: 'Blog Post / SEO', stageId: 'stage_awareness', order: 1 },
        { type: 'webinar', name: 'Educational Webinar', stageId: 'stage_consideration', order: 2 },
        { type: 'email', name: 'Case Study Email Series', stageId: 'stage_consideration', order: 3 },
        { type: 'demo', name: 'Live Product Demo', stageId: 'stage_decision', order: 4 },
        { type: 'trial', name: 'Free Trial', stageId: 'stage_decision', order: 5 },
        { type: 'phone_call', name: 'Sales Call', stageId: 'stage_purchase', order: 6 },
        { type: 'onboarding', name: 'Customer Onboarding', stageId: 'stage_retention', order: 7 },
        { type: 'referral', name: 'Partner Program', stageId: 'stage_advocacy', order: 8 }
      ],
      personas: [
        {
          name: 'Michael - The IT Decision Maker',
          demographics: { age: '40-55', occupation: 'CTO / IT Director' },
          psychographics: {
            motivations: ['Efficiency','ROI','Team productivity'],
            painPoints: ['Legacy systems','Budget constraints','Risk aversion'],
            goals: ['Modernize operations','Reduce costs','Improve security'],
            frustrations: ['Vendor lock-in','Hidden costs','Poor support'],
            values: ['Reliability','Scalability','Support quality']
        },
          behavior: {
            preferredChannels: ['LinkedIn','Email','Industry events'],
            buyingTriggers: ['Peer recommendations','ROI proof','Security certifications'],
            decisionFactors: ['Total cost of ownership','Integration capabilities','Vendor reputation']
        }
      }
      ]
  }
  ];

  const [templateForm, setTemplateForm] = useState<JourneyTemplate>({
    name: '',
    description: '',
    profession: selectedProfession,
    packageType: 'creator_premium',
    status: 'draft',
    steps: [],
    // 🆕 Initialize building blocks
    stages: [...defaultStages],
    touchpoints: [],
    personas: [],
    visualizationType: 'timeline',
    dynamicLinks: {}
});

  // 🆕 Auto-save notes when templateForm or journeyNotes changes
  useAutosave(
    async () => {
      if (templateForm.id && journeyNotes) {
        setIsSavingNotes(true);
        try {
          const headers = await auth.getAuthHeader();
          await apiRequest(`/api/admin/customer-journey/templates/${templateForm.id}/notes`, {
            method: 'POST',
            headers: {
              ...headers, , 'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: journeyNotes })
        });
      } finally {
          setIsSavingNotes(false);
      }
    }
  },
    [journeyNotes, templateForm.id],
    2000
  );

  // ✅ Fetch journey templates
  const { data: journeyTemplates = [], isLoading } = useQuery({
    queryKey: ['/api/admin/customer-journey/templates', selectedProfession],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/customer-journey/templates?profession=${selectedProfession}`, { headers });
    },
});

  // ✅ Fetch available components
  const { data: availableComponents = [] } = useQuery({
    queryKey: ['/api/admin/customer-journey/components', selectedProfession],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/customer-journey/components?profession=${selectedProfession}`, { headers });
    },
});

  // ✅ Profession configuration (memoized for performance)
  const professionConfig = useMemo(() => ({
    photographer: {
      icon: <PhotoCamera />,
      color: '#ff8c00',
      displayName: getProfessionDisplayName('photographer'),
      packages: [
        { key: 'creator_premium', name: 'Creator Premium', features: 17 },
        { key: 'creator_standard', name: 'Creator Standard', features: 12 },
        { key: 'creator_basic', name: 'Creator Basic', features: 8 }
      ]
    },
    videographer: {
      icon: <Videocam />,
      color: '#e74c3c',
      displayName: getProfessionDisplayName('videographer'),
      packages: [
        { key: 'creator_premium', name: 'Creator Premium', features: 17 },
        { key: 'creator_standard', name: 'Creator Standard', features: 12 },
        { key: 'creator_basic', name: 'Creator Basic', features: 8 }
      ]
    },
    musicproducer: {
      icon: <LibraryMusic />,
      color: '#9b59b6',
      displayName: getProfessionDisplayName('music_producer'),
      packages: [
        { key: 'creator_premium', name: 'Creator Premium', features: 17 },
        { key: 'creator_standard', name: 'Creator Standard', features: 12 },
        { key: 'creator_basic', name: 'Creator Basic', features: 8 }
      ]
    },
    vendor: {
      icon: <Business />,
      color: '#27ae60',
      displayName: getProfessionDisplayName('vendor'),
      packages: [
        { key: 'creator_premium', name: 'Creator Premium', features: 17 },
        { key: 'creator_standard', name: 'Creator Standard', features: 12 },
        { key: 'creator_basic', name: 'Creator Basic', features: 8 }
      ]
  }
  }), []);

  // ✅ Component type configuration (memoized for performance)
  const componentTypes = useMemo(() => ({
    video_player: { icon: theming.getThemedIcon('videoLibrary'), color: '#f44336', name: 'Video Player' },
    ai_animation: { icon: <Animation />, color: '#9c27b0', name: 'AI Animasjon' },
    calculator: { icon: <Calculate />, color: '#3f51b5', name: 'Kalkulator' },
    quiz: { icon: theming.getThemedIcon('quiz'), color: '#ff9800', name: 'Quiz' },
    interactive_demo: { icon: <Settings />, color: '#4caf50', name: 'Interaktiv Demo' },
    roi_calculator: { icon: theming.getThemedIcon('trendingUp'), color: '#2196f3', name: 'ROI Kalkulator' },
    success_story: { icon: theming.getThemedIcon('timeline'), color: '#607d8b', name: 'Suksesshistorie' },
    ai_welcome_video: { icon: theming.getThemedIcon('smartToy'), color: '#795548', name: 'AI Velkomstvideo' }
  }), [theming]);

  // 🆕 Generate React Flow nodes and edges from journey steps
  useEffect(() => {
    if (templateForm.steps.length === 0) {
      setReactFlowNodes([]);
      setReactFlowEdges([]);
      return;
    }

    const nodes: Node[] = templateForm.steps.map((step, index) => {
      const typeConfig = componentTypes[step.stepType as keyof typeof componentTypes];
      const stage = templateForm.stages.find(s => s.id === step.componentConfig?.stageId);
      
      return {
        id: step.id,
        type: 'default',
        position: { x: index * 300, y: 0 },
        data: {
          label: (
            <Box sx={{ p: 2, minWidth: 250, maxWidth: 250 }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ bgcolor: typeConfig?.color, width: 32, height: 32 }}>
                    {typeConfig?.icon}
                  </Avatar>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {step.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {step.content.substring(0, 80)}...
                </Typography>
                {stage && (
                  <Chip
                    label={stage.customName || stage.name}
                    size="small"
                    sx={{ bgcolor: stage.color, color: 'white', fontSize: '0.65rem' }}
                  />
                )}
                {step.componentConfig?.aiGenerated && (
                  <Chip
                    label="AI Generated"
                    size="small"
                    color="success"
                    icon={<SmartToy />}
                    sx={{ fontSize: '0.65rem' }}
                  />
                )}
              </Stack>
            </Box>
          ),
          step
        },
        style: {
          background: 'white',
          border: `2px solid ${typeConfig?.color || '#ccc'}`,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: 280
        }
      };
    });

    const edges: Edge[] = templateForm.steps.map((step, index) => {
      if (index === templateForm.steps.length - 1) return null;
      
      return {
        id: `edge-${step.id}-${templateForm.steps[index + 1].id}`,
        source: step.id,
        target: templateForm.steps[index + 1].id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6'
        }
      };
    }).filter(Boolean) as Edge[];

    setReactFlowNodes(nodes);
    setReactFlowEdges(edges);
  }, [templateForm.steps, templateForm.stages, componentTypes]);

  // ✅ Enhanced Save template mutation with integration tracking
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: JourneyTemplate) => {
      const endTiming = trackOperation('save-template', {
        templateId: template.id,
        stepCount: template.steps.length,
        profession: template.profession
    });

      const method = template.id ? 'PUT' : 'POST';
      const url = template.id
        ? `/api/admin/customer-journey/templates/${template.id}`
        : '/api/admin/customer-journey/templates';

      const headers = await auth.getAuthHeader();
      const result = await apiRequest(url, {
        method,
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify(template)
      });
      endTiming();
      
      return result;
  },
    onSuccess: (data, template) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/customer-journey/templates'] });
      setOpenDialog(false);
      setSelectedTemplate(null);
      
      // 🆕 Integration Events
      communication.sendMessage({
        type: 'journey-saved',
        from: 'customer-journey-builder',
        to: 'all',
        priority: 'medium' as const,
        data: {
          templateId: template.id || data.id,
          profession: template.profession,
          stepCount: template.steps.length,
          timestamp: Date.now()
      }
    });
      
      // 🚀 Also send to Notes for auto-documentation and bi-directional sync
      communication.sendBroadcast('journey-saved-for-note', {
        journeyId: template.id || data.id,
        journeyName: template.name,
        journeyDescription: template.description,
        stageCount: template.stages?.length || 0,
        touchpointCount: template.touchpoints?.length || 0,
        personaCount: template.personas?.length || 0,
        profession: template.profession,
        linkedNoteId: template.linkedNoteId, // 🔗 For bi-directional sync
        fullJourneyData: template // 🔗 Full data for note update
      }, 'low');
      
      analytics.trackEvent('journey_saved_success', {
        templateId: template.id || data.id,
        profession: template.profession,
        stepCount: template.steps.length
    });
      
      features.trackFeatureUsage('journey-management','save-template', {
        profession: template.profession,
        stepCount: template.steps.length
    });
  },
    onError: (error, template) => {
      analytics.trackEvent('journey_save_failed', {
        templateId: template.id,
        error: error.message,
        profession: template.profession
    });
  }
});

  // ✅ Enhanced AI content mutation with feature access control
  const generateAIContentMutation = useMutation({
    mutationFn: async (params: {
      profession: string;
      packageType: string;
      componentType: string;
      aiProvider?: string;
  }) => {
      // 🆕 Feature Access Check
      if (!canUseAI) {
        throw new Error('AI generation is not available for your role');
    }
      
      const endTiming = trackOperation('ai-generate-content', params);

      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/ai/journey/generate-content', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      endTiming();
      
      // 🆕 Track AI usage
      features.trackFeatureUsage('ai-generation','generate-content', {
        componentType: params.componentType,
        profession: params.profession,
        provider: params.aiProvider
    });
      
      return result;
  },
    onSuccess: (data, variables) => {
      console.log('✅ AI content generated: ', data);
      // Add generated content as new step
      const newStep: JourneyStep = {
        id: `step_${Date.now()}`,
        stepOrder: templateForm.steps.length + 1,
        stepType: variables.componentType,
        title: data.title || `${variables.componentType} Step`,
        content: data.content || '',
        componentConfig: {
          aiGenerated: true,
          generatedAt: new Date().toISOString(),
          metrics: data.metrics,
          callToAction: data.callToAction,
          imageUrl: data.imageUrl
      },
        isActive: true
    };
      
      setTemplateForm(prev => ({
        ...prev,
        steps: [...prev.steps, newStep]
    }));
  }
});

  // ✅ Handle drag and drop
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(templateForm.steps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update step orders
    const updatedSteps = items.map((step, index) => ({
      ...step,
      stepOrder: index + 1
  }));

    setTemplateForm(prev => ({ ...prev, steps: updatedSteps }));
};

  // ✅ Generate AI content for specific component
  const generateAIContent = useCallback(async (componentType: string) => {
    setAiGeneration(true);
    try {
      await generateAIContentMutation.mutateAsync({
        profession: templateForm.profession,
        packageType: templateForm.packageType,
        componentType,
        aiProvider: 'openai'
    });
  } catch (error) {
      console.error('❌ AI generation failed: ', error);
  } finally {
      setAiGeneration(false);
  }
}, [templateForm.profession, templateForm.packageType, generateAIContentMutation]);

  // 🤖 AI Journey Analysis - Suggest Improvements
  const analyzeJourneyMutation = useMutation({
    mutationFn: async (journey: JourneyTemplate) => {
      if (!canUseAI) {
        throw new Error('AI analysis is not available for your role');
      }
      
      const endTiming = trackOperation('ai-analyze-journey', {
        journeyId: journey.id,
        stageCount: journey.stages.length
      });

      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/ai/journey/analyze', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          journey,
          profession: journey.profession,
          packageType: journey.packageType
        })
      });

      endTiming();
      
      features.trackFeatureUsage('ai-analysis','analyze-journey', {
        journeyId: journey.id,
        profession: journey.profession
      });
      
      return result;
    },
    onSuccess: (data, journey) => {
      // Update journey with AI insights
      setTemplateForm(prev => ({
        ...prev,
        aiInsights: {
          predictedConversionPath: data.predictedPath || [],
          optimizationSuggestions: data.suggestions || [],
          personaRecommendations: data.personaRecommendations || [],
          lastUpdated: new Date().toISOString()
        }
      }));
      
      analytics.trackEvent('journey_analyzed', {
        journeyId: journey.id,
        suggestionsCount: data.suggestions?.length || 0
      });
    }
  });

  // ✅ Add component to journey
  const addComponent = (component: InteractiveComponent) => {
    const newStep: JourneyStep = {
      id: `step_${Date.now()}`,
      stepOrder: templateForm.steps.length + 1,
      stepType: component.componentType,
      title: component.name,
      content: component.description,
      componentConfig: {
        componentId: component.id,
        componentType: component.componentType,
        estimatedDuration: component.estimatedDuration || 5,
        targetAudience: []
    },
      isActive: true,
      createdAt: new Date().toISOString()
  };

    setTemplateForm(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
      estimatedCompletionTime: (prev.estimatedCompletionTime || 0) + (component.estimatedDuration || 5)
  }));
};

  // 🆕 Enhanced Utility Functions with Integration
  const duplicateTemplate = (template: JourneyTemplate) => {
    const endTiming = trackOperation('duplicate-template', { 
      originalId: template.id, 
      profession: template.profession 
  });
    
    const duplicated: JourneyTemplate = {
      ...template,
      id: undefined,
      name: `${template.name} (Copy)`,
      status: 'draft',
      createdAt: new Date().toISOString()
  };
    
    setTemplateForm(duplicated);
    setOpenDialog(true);
    
    // 🆕 Track duplication
    analytics.trackEvent('journey_duplicated', {
      originalId: template.id,
      profession: template.profession,
      stepCount: template.steps.length
  });
    
    features.trackFeatureUsage('journey-management','duplicate-template', {
      profession: template.profession
  });
    
    endTiming();
};

  const exportJourney = (template: JourneyTemplate) => {
    if (!canExportJourneys) {
      console.warn('Export feature not available for your role');
      return;
  }
    
    const endTiming = trackOperation('export-journey', { 
      templateId: template.id,
      profession: template.profession 
  });
    
    // Create exportable JSON
    const exportData = {
      ...template,
      exportedAt: new Date().toISOString(),
      exportedBy: auth.state.user?.email || 'unknown'
  };
    
    // Download as JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_journey.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    analytics.trackEvent('journey_exported', {
      templateId: template.id,
      profession: template.profession
  });
    
    features.trackFeatureUsage('export-journeys','export-template', {
      profession: template.profession
  });
    
    endTiming();
};

  const deleteStep = (stepId: string) => {
    setTemplateForm(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId).map((step, index) => ({
        ...step,
        stepOrder: index + 1
    }))
  }));
};

  const toggleStepActive = (stepId: string) => {
    setTemplateForm(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId ? { ...step, isActive: !step.isActive } : step
      )
  }));
};

  // 📚 Save Journey as Reusable Template
  const saveAsTemplateMutation = useMutation({
    mutationFn: async (params: { 
      journey: JourneyTemplate; 
      templateName: string;
      category: 'marketing' | 'sales' | 'onboarding' | 'retention' | 'custom';
    }) => {
      const endTiming = trackOperation('save-as-template', {
        journeyId: params.journey.id,
        category: params.category
      });
      
      const templateJourney: JourneyTemplate = {
        ...params.journey,
        id: undefined, // Remove ID to create new template
        name: params.templateName,
        isTemplate: true,
        templateCategory: params.category,
        status: 'draft',
        linkedNoteId: undefined, // Templates don't link to notes
        abTestVariantId: undefined,
        abTestBaselineId: undefined,
        tags: [...(params.journey.tags || [])'template', params.category],
        createdAt: new Date().toISOString()
      };
      
      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/admin/customer-journey/templates', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateJourney)
      });

      endTiming();
      
      features.trackFeatureUsage('journey-templates','save-template', {
        category: params.category,
        stageCount: params.journey.stages.length
      });
      
      return result;
    },
    onSuccess: (data, params) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/customer-journey/templates'] });
      
      analytics.trackEvent('template_created', {
        templateId: data.id,
        category: params.category,
        profession: params.journey.profession
      });
      
      setSnackbar({ open: true, message: `✅ Template "${params.templateName}" saved! You can now reuse this journey for similar projects.`, severity: 'success' });
    }
  });
  
  // 🧪 Create A/B Test Variant
  const createABTestMutation = useMutation({
    mutationFn: async (baseJourney: JourneyTemplate) => {
      const endTiming = trackOperation('create-ab-test', {
        baselineId: baseJourney.id
      });
      
      const variantJourney: JourneyTemplate = {
        ...baseJourney,
        id: undefined,
        name: `${baseJourney.name} (Variant)`,
        status: 'draft',
        abTestBaselineId: baseJourney.id,
        tags: [...(baseJourney.tags || [])'ab-test','variant'],
        createdAt: new Date().toISOString()
      };
      
      const headers = await auth.getAuthHeader();
      const result = await apiRequest('/api/admin/customer-journey/templates', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify(variantJourney)
      });

      endTiming();
      
      features.trackFeatureUsage('ab-testing','create-variant', {
        baselineId: baseJourney.id
      });
      
      return result;
    },
    onSuccess: async (data, baseJourney) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/customer-journey/templates'] });

      // Also update baseline to link to variant
      const headers = await auth.getAuthHeader();
      apiRequest(`/api/admin/customer-journey/templates/${baseJourney.id}`, {
        method: 'PATCH',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({ abTestVariantId: data.id })
      });
      
      analytics.trackEvent('ab_test_created', {
        baselineId: baseJourney.id,
        variantId: data.id
      });
      
      setTemplateForm(data);
      setOpenDialog(true);
      
      setSnackbar({ open: true, message: `🧪 A/B Test Variant Created! Modify this variant and compare performance with the baseline.`, severity: 'success' });
    }
  });

  // 🆕 Computed values
  const filteredTemplates = React.useMemo(() => {
    let filtered = journeyTemplates.filter((template: JourneyTemplate) => {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || template.status === filterStatus;
      const matchesPackage = filterPackage === 'all' || template.packageType === filterPackage;
      return matchesSearch && matchesStatus && matchesPackage;
  });

    // Sort
    filtered.sort((a: JourneyTemplate, b: JourneyTemplate) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.updatedAt || b.createdAt || 0).getTime() - 
                 new Date(a.updatedAt || a.createdAt || 0).getTime();
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        default:
          return 0;
    }
  });

    return filtered;
}, [journeyTemplates, searchQuery, filterStatus, filterPackage, sortBy]);

  // ✅ Render component library
  const renderComponentLibrary = () => (
    <Grid container spacing={2}>
      {availableComponents.map((component: InteractiveComponent) => {
        const typeConfig = componentTypes[component.componentType as keyof typeof componentTypes];
        
        return (
          <Grid xs={12} sm={6} md={4} key={component.id}>
            <Card 
              sx={{ 
                cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                border: '1px solid',
                borderColor: 'divider'
            }}
              onClick={() => addComponent(component)}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Avatar sx={{ bgcolor: typeConfig?.color, width: 32, height: 32 }}>
                    {typeConfig?.icon}
                  </Avatar>
                  <Typography variant="subtitle2">
                    {component.name}
                  </Typography>
                </Stack>
                
                <Typography variant="body2" color="text.secondary">
                  {component.description}
                </Typography>
                
                <Stack direction="row" spacing={1} mt={1}>
                  <Chip 
                    size="small" 
                    label={component.category}
                    color="primary"
                    variant="outlined"
                  />
                  {component.profession && (
                    <Chip 
                      size="small" 
                      label={professionConfig[component.profession as keyof typeof professionConfig]?.displayName}
                      color="secondary"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
    })}
    </Grid>
  );

  // 🆕 Journey Map Visualizer Components
  const renderTimelineVisualization = () => (
    <Box sx={{ width: '100%', overflowX: 'auto', py: 2 }}>
      <Stack direction="row" spacing={2}, sx={{ minWidth: 'max-content', px: 1 }}>
        {templateForm.stages.map((stage, index) => (
          <Card
            key={stage.id}
            sx={{
              minWidth: 280,
              maxWidth: 280,
              bgcolor: stage.color,
              color: 'white',
              boxShadow: 3,
              transition: 'all 0.3s','&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: 6
              }
            }}
          >
            <CardContent>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight="bold">
                    {stage.customName || stage.name}
                  </Typography>
                  <Chip 
                    label={`#${index + 1}`} 
                    size="small" 
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                </Box>
                
                <Divider sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Conversion Rate
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stage.metrics?.conversionRate ?? 0}%
                  </Typography>
                </Box>
                
                {stage.metrics?.dropoffRate && (
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Drop-off Rate
                    </Typography>
                    <Typography variant="h6" color="error.light">
                      {stage.metrics.dropoffRate}%
                    </Typography>
                  </Box>
                )}
                
                {stage.goals && stage.goals.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 0.5 }}>
                      Goals:
                    </Typography>
                    {stage.goals.slice(0, 2).map((goal, idx) => (
                      <Chip
                        key={idx}
                        label={goal}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontSize: '0.7rem',
                          height: 20,
                          mr: 0.5,
                          mb: 0.5
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );

  const renderFunnelVisualization = () => {
    const maxConversion = Math.max(...templateForm.stages.map(s => s.metrics?.conversionRate ?? 0));
    
    return (
      <Box sx={{ width: '100%', py: 2 }}>
        <Stack spacing={2}>
          {templateForm.stages.map((stage, index) => {
            const conversionRate = stage.metrics?.conversionRate ?? 0;
            const widthPercent = maxConversion > 0 ? (conversionRate / maxConversion) * 100 : 0;
            
            return (
              <Box key={stage.id}>
                <Stack direction="row" alignItems="center" spacing={2} mb={1}>
                  <Box sx={{ minWidth: 120 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {stage.customName || stage.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Stage {index + 1}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    <Paper
                      sx={{
                        height: 60,
                        bgcolor: stage.color,
                        position: 'relative',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s','&:hover': {
                          transform: 'scale(1.02)',
                          boxShadow: 4
                        }
                      }}
                      style={{ width: `${widthPercent}%` }}
                    >
                      <Typography variant="h5" fontWeight="bold" sx={{ color: 'white' }}>
                        {conversionRate}%
                      </Typography>
                    </Paper>
                  </Box>
                  
                  <Box sx={{ minWidth: 100, textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      {stage.metrics?.dropoffRate ? `-${stage.metrics.dropoffRate}%` : 'N/A'}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>
    );
  };

  const renderCircularVisualization = () => {
    // Create a simple circular visualization using CSS
    const totalStages = templateForm.stages.length;
    const angleStep = 360 / totalStages;
    
    return (
      <Box sx={{ width: '100%', py: 4, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ position: 'relative', width: 500, height: 500 }}>
          {/* Center circle */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 120,
              height: 120,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              boxShadow: 4
            }}
          >
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
              Journey
            </Typography>
          </Box>
          
          {/* Stage circles */}
          {templateForm.stages.map((stage, index) => {
            const angle = (index * angleStep) * (Math.PI / 180);
            const radius = 180;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            return (
              <Box
                key={stage.id}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  bgcolor: stage.color,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 3,
                  transition: 'all 0.3s',
                  cursor: 'pointer','&:hover': {
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1.15)`,
                    boxShadow: 6,
                    zIndex: 5,
                  }
                }}
              >
                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', px: 1 }}>
                  {stage.customName || stage.name}
                </Typography>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {stage.metrics?.conversionRate ?? 0}%
                </Typography>
              </Box>
            );
          })}
          
          {/* Connection lines */}
          {templateForm.stages.map((_, index) => {
            const angle = (index * angleStep) * (Math.PI / 180);
            const radius = 180;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            return (
              <Box
                key={`line-${index}`}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: Math.sqrt(x * x + y * y) - 50,
                  height: 2,
                  bgcolor: 'primary.light',
                  opacity: 0.3,
                  transformOrigin: '0 50%',
                  transform: `translate(50px, -1px) rotate(${Math.atan2(y, x) * (180 / Math.PI)}deg)`,
                  zIndex: 1}}
              />
            );
          })}
        </Box>
      </Box>
    );
  };

  // ✅ Render journey steps
  const renderJourneySteps = () => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="journey-steps">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {templateForm.steps.map((step, index) => {
              const typeConfig = componentTypes[step.stepType as keyof typeof componentTypes];
              
              return (
                <Draggable key={step.id} draggableId={step.id} index={index}>
                  {(provided, snapshot) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{ 
                        mb: 2,
                        opacity: snapshot.isDragging ? 0.8 : 1,
                        transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                        ...theming.getThemedCardSx()
                    }}
                    >
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <div {...provided.dragHandleProps}>
                            <DragIndicator color="action" />
                          </div>
                          
                          <Avatar sx={{ bgcolor: typeConfig?.color }}>
                            {typeConfig?.icon}
                          </Avatar>
                          
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                              {step.stepOrder}. {step.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {step.content.substring(0, 100)}...
                            </Typography>
                          </Box>
                          
                          <Stack direction="row" spacing={1}>
                            {step.componentConfig?.aiGenerated && (
                              <Chip 
                                size="small" 
                                icon={<SmartToy />}
                                label="AI-generert"
                                color="success"
                              />
                            )}
                            
                            <IconButton 
                              size="small"
                              onClick={() => setEditingStep(step)}
                            >
                              {theming.getThemedIcon('edit')}
                            </IconButton>
                            
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setTemplateForm(prev => ({
                                  ...prev,
                                  steps: prev.steps.filter(s => s.id !== step.id)
                              }));
                            }}
                            >
                              {theming.getThemedIcon('delete')}
                            </IconButton>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </Draggable>
              );
          })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  return (
    <Box>
      {/* ✅ Enhanced Header with Analytics */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
            Customer Journey Builder
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Lag personaliserte customer journeys for {professionConfig[selectedProfession as keyof typeof professionConfig]?.displayName}
          </Typography>
          
          {/* Quick Stats */}
          <Stack direction="row" spacing={2} mt={1}>
            <Chip 
              icon={<Timeline />}
              label={`${filteredTemplates.length} Journeys`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip 
              icon={<PlayArrow />}
              label={`${filteredTemplates.filter((t: JourneyTemplate) => t.status === 'active').length} Active`}
              size="small"
              color="success"
              variant="outlined"
            />
            <Chip 
              icon={<Insights />}
              label={`Ø ${Math.round(filteredTemplates.reduce((acc: number, t: JourneyTemplate) => acc + (t.steps?.length || 0), 0) / Math.max(filteredTemplates.length, 1))} steps`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Stack>
        </Box>
        
        <Stack direction="row" spacing={1}>
          <Button 
            variant="outlined"
            startIcon={<Preview />}
            onClick={() => setPreviewMode(!previewMode)}
          >
            Preview Mode
          </Button>
          <Button 
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            onClick={() => {
              setTemplateForm({
                name: '',
                description: '',
                profession: selectedProfession,
                packageType: 'creator_premium',
                status: 'draft',
                steps: [],
                createdAt: new Date().toISOString(),
                stages: [...defaultStages],
                touchpoints: [],
                personas: [],
                visualizationType: 'timeline',
                dynamicLinks: {}
            });
              setSelectedTemplate(null);
              setOpenDialog(true);
          }}
          >
            Ny Journey
          </Button>
        </Stack>
      </Stack>

      {/* 🆕 Enhanced Toolbar with Search & Filters */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Søk etter journeys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flexGrow: 1 }}
              InputProps={{
                startAdornment: theming.getThemedIcon('search')
            }}
            />
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="published">Published</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Pakke</InputLabel>
              <Select
                value={filterPackage}
                onChange={(e) => setFilterPackage(e.target.value)}
                label="Pakke"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="creator_premium">Premium</MenuItem>
                <MenuItem value="creator_standard">Standard</MenuItem>
                <MenuItem value="creator_basic">Basic</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sorter</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                label="Sorter"
              >
                <MenuItem value="date">Nyeste først</MenuItem>
                <MenuItem value="name">Navn A-Å</MenuItem>
                <MenuItem value="usage">Mest brukt</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title={viewMode === 'grid' ? 'List visning' : 'Grid visning'}>
              <IconButton onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                {viewMode === 'grid' ? theming.getThemedIcon('viewList') : theming.getThemedIcon('viewGrid')}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* ✅ Tabs */}
      <Tabs value={currentTab} onChange={(_, value) => setCurrentTab(value)}, sx={{ mb: 3 }}>
        <Tab icon={<Timeline />} label="Journey Oversikt" />
        <Tab icon={<Psychology />} label="Komponenter" />
        <Tab icon={<Analytics />} label="Statistikk" />
        <Tab icon={<Edit />} label="Notater & AI" />
        <Tab icon={<AutoFixHigh />} label="Presets" />
        <Tab icon={<Save />} label="Mine Maler" />
        <Tab icon={<Quiz />} label="A/B Tests" />
      </Tabs>

      {/* ✅ Tab Content */}
      {currentTab === 0 && (
        <Grid container spacing={3}>
          {journeyTemplates.map((template: JourneyTemplate) => (
            <Grid xs={12} md={6} lg={4} key={template.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    {professionConfig[template.profession as keyof typeof professionConfig]?.icon}
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{template.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {template.description}
                      </Typography>
                    </Box>
                  </Stack>
                  
                  {/* 🆕 Compact Stage Visualization */}
                  {template.stages && template.stages.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Journey Stages:
                      </Typography>
                      <Stack direction="row" spacing={0.5}, sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {template.stages.slice(0, 6).map((stage) => (
                          <Chip
                            key={stage.id}
                            label={`${stage.customName || stage.name}: ${stage.metrics?.conversionRate ?? 0}%`}
                            size="small"
                            sx={{
                              bgcolor: stage.color,
                              color: 'white',
                              fontSize: '0.7rem',
                              height: 20, '& .MuiChip-label': {
                                px: 0.5
                              }
                            }}
                          />
                        ))}
                        {template.stages.length > 6 && (
                          <Chip
                            label={`+${template.stages.length - 6} more`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        )}
                      </Stack>
                    </Box>
                  )}
                  
                  <Stack direction="row" spacing={1} mb={2}>
                    <Chip 
                      size="small" 
                      label={template.packageType}
                      color="primary"
                    />
                    <Chip 
                      size="small" 
                      label={`${template.steps.length} steg`}
                      color="secondary"
                    />
                    <Chip 
                      size="small" 
                      label={template.status}
                      color={template.status === 'active' ? 'success' : 'default'}
                    />
                  </Stack>
                  
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      size="small"
                      startIcon={theming.getThemedIcon('edit')}
                      onClick={() => {
                        trackOperation('edit-template', { templateId: template.id });
                        setSelectedTemplate(template);
                        setTemplateForm(template);
                        setOpenDialog(true);
                    }}
                    >
                      Rediger
                    </Button>
                    <Button
                      size="small"
                      startIcon={theming.getThemedIcon('visibility')}
                      onClick={() => {
                        trackOperation('preview-template', { templateId: template.id });
                        setPreviewMode(true);
                    }}
                    >
                      Forhåndsvis
                    </Button>
                    <Button
                      size="small"
                      startIcon={theming.getThemedIcon('content_copy')}
                      onClick={() => duplicateTemplate(template)}
                    >
                      Dupliser
                    </Button>
                    {canExportJourneys && (
                      <Button
                        size="small"
                        startIcon={theming.getThemedIcon('download')}
                        onClick={() => exportJourney(template)}
                      >
                        Eksporter
                      </Button>
                    )}
                    <Button
                      size="small"
                      startIcon={<AutoFixHigh />}
                      onClick={() => {
                        setTemplateForm(template);
                        analyzeJourneyMutation.mutate(template);
                      }}
                      disabled={!canUseAI || analyzeJourneyMutation.isPending}
                      color="secondary"
                    >
                      AI Analyse
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Save />}
                      onClick={() => {
                        const templateName = prompt('Template navn:', `${template.name} Template`);
                        if (templateName) {
                          const category = prompt('Kategori (marketing/sales/onboarding/retention/custom):', 'marketing') as any;
                          saveAsTemplateMutation.mutate({
                            journey: template,
                            templateName,
                            category: category || 'custom'
                          });
                        }
                      }}
                      color="info"
                    >
                      Lagre Mal
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Quiz />}
                      onClick={() => createABTestMutation.mutate(template)}
                      color="warning"
                    >
                      A/B Test
                    </Button>
                    {canDeleteJourneys && (
                      <Button
                        size="small"
                        startIcon={theming.getThemedIcon('delete')}
                        color="error"
                        onClick={() => {
                          trackOperation('delete-template', { templateId: template.id });
                          // TODO: Implement delete functionality
                      }}
                      >
                        Slett
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {currentTab === 1 && renderComponentLibrary()}

      {/* 🆕 My Templates Library Tab */}
      {currentTab === 5 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            📚 Mine Lagrede Maler
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Gjenbrukbare journey-maler du har lagret
          </Typography>
          
          <Grid container spacing={3}>
            {journeyTemplates
              .filter((t: JourneyTemplate) => t.isTemplate === true)
              .map((template: JourneyTemplate) => (
                <Grid xs={12} md={6} lg={4} key={template.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer','&:hover': { 
                        transform: 'translateY(-4px)',
                        boxShadow: 4 
                      },
                      transition: 'all 0.3s ease',
                      ...theming.getThemedCardSx()
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                        <Avatar sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                          <Save />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {template.name}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={template.templateCategory || 'custom'}
                            color="info"
                          />
                        </Box>
                      </Stack>
                      
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {template.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} mb={2}>
                        <Chip size="small" label={`${template.stages.length} stages`} />
                        <Chip size="small" label={`${template.touchpoints.length} touchpoints`} />
                        <Chip size="small" label={`${template.personas.length} personas`} />
                      </Stack>
                      
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<ContentCopy />}
                        onClick={() => {
                          const newJourney: JourneyTemplate = {
                            ...template,
                            id: undefined,
                            name: `${template.name} (Copy)`,
                            status: 'draft',
                            isTemplate: false,
                            createdAt: new Date().toISOString()
                          };
                          setTemplateForm(newJourney);
                          setOpenDialog(true);
                          
                          analytics.trackEvent('template_used', {
                            templateId: template.id,
                            category: template.templateCategory
                          });
                        }}
                      >
                        Bruk Denne Malen
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            
            {journeyTemplates.filter((t: JourneyTemplate) => t.isTemplate === true).length === 0 && (
              <Grid xs={12}>
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    📚 Ingen lagrede maler ennå
                  </Typography>
                  <Typography variant="body2">
                    Opprett en journey og klikk "Lagre Mal" for å gjenbruke den senere.
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </Box>
      )}
      
      {/* 🧪 A/B Testing Tab */}
      {currentTab === 6 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🧪 A/B Test Sammenligning
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Sammenlign ytelsen til ulike journey-varianter
          </Typography>
          
          <Grid container spacing={3}>
            {journeyTemplates
              .filter((t: JourneyTemplate) => t.abTestBaselineId || t.abTestVariantId)
              .map((template: JourneyTemplate) => {
                const isBaseline = !!template.abTestVariantId;
                const linkedId = isBaseline ? template.abTestVariantId : template.abTestBaselineId;
                const linkedTemplate = journeyTemplates.find((t: JourneyTemplate) => t.id === linkedId);
                
                return (
                  <Grid xs={12} key={template.id}>
                    <Paper sx={{ p: 3 }}>
                      <Stack direction="row" spacing={3} alignItems="stretch">
                        {/* Baseline */}
                        <Box sx={{ flex: 1, borderRight: '2px dashed', borderColor: 'divider', pr: 2 }}>
                          <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Chip label={isBaseline ? "Baseline" : "Variant"} color="primary" />
                              <Typography variant="h6">{template.name}</Typography>
                            </Stack>
                            
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Stages:</Typography>
                                <Typography variant="body2" fontWeight="bold">{template.stages.length}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Touchpoints:</Typography>
                                <Typography variant="body2" fontWeight="bold">{template.touchpoints.length}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Conversion Rate:</Typography>
                                <Typography variant="body2" fontWeight="bold" color="success.main">
                                  {template.conversionRate || 0}%
                                </Typography>
                              </Box>
                            </Stack>
                            
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Edit />}
                              onClick={() => {
                                setTemplateForm(template);
                                setOpenDialog(true);
                              }}
                            >
                              Rediger
                            </Button>
                          </Stack>
                        </Box>
                        
                        {/* Variant */}
                        {linkedTemplate && (
                          <Box sx={{ flex: 1, pl: 2 }}>
                            <Stack spacing={2}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Chip label={isBaseline ? "Variant" : "Baseline"} color="secondary" />
                                <Typography variant="h6">{linkedTemplate.name}</Typography>
                              </Stack>
                              
                              <Stack spacing={1}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="body2">Stages:</Typography>
                                  <Typography variant="body2" fontWeight="bold">{linkedTemplate.stages.length}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="body2">Touchpoints:</Typography>
                                  <Typography variant="body2" fontWeight="bold">{linkedTemplate.touchpoints.length}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="body2">Conversion Rate:</Typography>
                                  <Typography variant="body2" fontWeight="bold" color="success.main">
                                    {linkedTemplate.conversionRate || 0}%
                                  </Typography>
                                </Box>
                              </Stack>
                              
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Edit />}
                                onClick={() => {
                                  setTemplateForm(linkedTemplate);
                                  setOpenDialog(true);
                                }}
                              >
                                Rediger
                              </Button>
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                      
                      {/* Winner Badge */}
                      {linkedTemplate && template.conversionRate && linkedTemplate.conversionRate && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Alert 
                            severity={template.conversionRate > linkedTemplate.conversionRate ? "success" : "info"}
                            icon={<TrendingUp />}
                          >
                            <Typography variant="subtitle2">
                              {template.conversionRate > linkedTemplate.conversionRate 
                                ? `🏆 ${isBaseline ? 'Baseline' : 'Variant'} vinner med ${((template.conversionRate / linkedTemplate.conversionRate - 1) * 100).toFixed(1)}% høyere konvertering`
                                : `🏆 ${isBaseline ? 'Variant' : 'Baseline'} vinner med ${((linkedTemplate.conversionRate / template.conversionRate - 1) * 100).toFixed(1)}% høyere konvertering`
                              }
                            </Typography>
                          </Alert>
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                );
              })}
            
            {journeyTemplates.filter((t: JourneyTemplate) => t.abTestBaselineId || t.abTestVariantId).length === 0 && (
              <Grid xs={12}>
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    🧪 Ingen A/B tester ennå
                  </Typography>
                  <Typography variant="body2">
                    Opprett en A/B test fra en eksisterende journey for å sammenligne varianter.
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* 🆕 Preset Templates Tab */}
      {currentTab === 4 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🎯 Ferdiglagde Journey-Maler
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Start med profesjonelle maler og tilpass til ditt behov
          </Typography>
          
          <Grid container spacing={3}>
            {journeyPresets.map((preset) => (
              <Grid xs={12} md={6} lg={4} key={preset.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer','&:hover': { 
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                      borderColor: preset.color
                    },
                    transition: 'all 0.3s ease',
                    border: '2px solid',
                    borderColor: 'divider',
                    ...theming.getThemedCardSx()
                  }}
                  onClick={() => {
                    // Load preset as new template
                    const newTemplate: JourneyTemplate = {
                      name: preset.name,
                      description: preset.description,
                      profession: selectedProfession,
                      packageType: 'creator_premium',
                      status: 'draft',
                      steps: [],
                      stages: preset.stages.map(s => ({
                        ...s,
                        id: s.id || `stage_${Date.now()}_${Math.random()}`,
                        type: s.type as StageType,
                        name: s.name || ', ',
                        color: s.color || '#3b82f6',
                        icon: s.icon || 'visibility',
                        order: s.order || 0,
                        description: s.description || ', ',
                        goals: s.goals || [],
                        metrics: s.metrics
                      })),
                      touchpoints: preset.touchpoints.map((t, idx) => ({
                        id: `touchpoint_${Date.now()}_${idx}`,
                        type: t.type as TouchpointType,
                        name: t.name || ', ',
                        stageId: t.stageId || ', ',
                        description: t.description || ', ',
                        order: t.order || idx + 1,
                        estimatedDuration: t.estimatedDuration,
                        conversionRate: t.conversionRate,
                        aiSuggestions: t.aiSuggestions
                      })),
                      personas: preset.personas.map((p, idx) => ({
                        id: `persona_${Date.now()}_${idx}`,
                        name: p.name || ', ',
                        demographics: p.demographics || {},
                        psychographics: p.psychographics || { motivations: [], painPoints: [], goals: [], frustrations: [], values: [] },
                        behavior: p.behavior || { preferredChannels: [], buyingTriggers: [], decisionFactors: [] }
                      })),
                      visualizationType: 'timeline',
                      templateType: preset.type,
                      dynamicLinks: {}
                    };
                    
                    setTemplateForm(newTemplate);
                    setOpenDialog(true);
                    
                    analytics.trackEvent('preset_template_selected', {
                      presetId: preset.id,
                      presetType: preset.type,
                      profession: selectedProfession
                    });
                  }}
                >
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                      <Avatar 
                        sx={{ 
                          bgcolor: preset.color, 
                          width: 56, 
                          height: 56,
                          fontSize: '28px'
                        }}
                      >
                        {preset.icon === 'dashboard' ? '🎯' :
                         preset.icon === 'search' ? '🔍' : 
                         preset.icon === 'shopping_bag' ? '🛍️' : 
                         preset.icon === 'favorite' ? '💕' : 
                         preset.icon === 'business' ? '💼' : '✨'}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {preset.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {preset.description}
                        </Typography>
                      </Box>
                    </Stack>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Stages:
                        </Typography>
                        <Chip 
                          size="small" 
                          label={`${preset.stages.length} steg`}
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>
                      
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Touchpoints:
                        </Typography>
                        <Chip 
                          size="small" 
                          label={`${preset.touchpoints.length} kontaktpunkter`}
                          color="secondary"
                          variant="outlined"
                        />
                      </Stack>
                      
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Personas:
                        </Typography>
                        <Chip 
                          size="small" 
                          label={`${preset.personas.length} personas`}
                          color="success"
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                    
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<Add />}
                      sx={{ mt: 2, bgcolor: preset.color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Same logic as card click
                      }}
                    >
                      Bruk Denne Malen
                    </Button>
                    
                    {preset.id === 'preset_creatorhub_platform' && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        <strong>🎯 HOVEDPRODUKT!</strong>
                        <br />
                        22% konverteringsrate • 3M kr ARR Year 1
                      </Alert>
                    )}
                    
                    {preset.id === 'preset_seo_service' && (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        <strong>⭐ Anbefalt for SEO-lansering!</strong>
                        <br />
                        15% konverteringsrate • 1.5M kr ARR Year 1
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          <Box sx={{ mt: 4 }}>
            <Alert severity="info">
              <Typography variant="subtitle2" gutterBottom>
                💡 <strong>Tips:</strong> Hvordan bruke maler
              </Typography>
              <Typography variant="body2">
                1. Klikk på en mal for å laste den inn<br />
                2. Tilpass stages, touchpoints, og personas til ditt behov<br />
                3. Legg til dine egne komponenter fra "Komponenter"-fanen<br />
                4. Lagre som din egen journey-template<br />
                5. Aktiver og spor ytelsen i "Statistikk"-fanen
              </Typography>
            </Alert>
          </Box>
        </Box>
      )}

      {/* 🆕 Notes & AI Tab */}
      {currentTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            📝 Journey Notater & AI-Verktøy
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Ta notater om din customer journey strategi og bruk AI-verktøy for å forbedre innholdet
          </Typography>
          
          <Grid container spacing={2}>
            {/* Rich Text Editor */}
            <Grid xs={12} md={8}>
              <Paper sx={{ p: 2, minHeight: '500px' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" sx={{ color: theming.colors.primary }}>
                    Notater for {templateForm.name || 'Ny Journey'}
                  </Typography>
                  {isSavingNotes && (
                    <Chip 
                      size="small" 
                      label="Lagrer..." 
                      icon={<Save />}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Stack>
                
                <NoteEditor 
                  value={journeyNotes}
                  onChange={(content: string) => setJourneyNotes(content)}
                  placeholder="Skriv notater om strategien, målgruppen, viktige touchpoints, etc..."
                />
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  💡 <strong>Tips:</strong> Dokumenter hvorfor du valgte disse stegene, 
                  hvilke målgrupper de treffer, og forventet konverteringsrate.
                </Alert>
              </Paper>
            </Grid>
            
            {/* AI Utilities Panel */}
            <Grid xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ color: theming.colors.primary }}>
                  🤖 AI-Verktøy
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Bruk AI for å forbedre notatene dine
                </Typography>
                
                <AIUtilitiesPanel 
                  loading={aiGeneration}
                  onSummarize={() => {
                    console.log('Summarize notes:', journeyNotes);
                    // TODO: Implement AI summarization
                }}
                  onImproveTone={() => {
                    console.log('Improve tone:', journeyNotes);
                    // TODO: Implement tone improvement
                }}
                  onCreateOutline={() => {
                    console.log('Create outline:', journeyNotes);
                    // TODO: Implement outline creation
                }}
                />
                
                <Divider sx={{ my: 2 }} />
                
                {/* Quick Actions */}
                <Typography variant="subtitle2" gutterBottom>
                  Hurtighandlinger
                </Typography>
                <Stack spacing={1}>
                  <Button
                    size="small"
                    fullWidth
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={() => {
                      navigator.clipboard.writeText(journeyNotes);
                      console.log('Copied to clipboard');
                  }}
                  >
                    Kopier notater
                  </Button>
                  <Button
                    size="small"
                    fullWidth
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={() => {
                      const blob = new Blob([journeyNotes], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${templateForm.name || 'journey'}_notes.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                  }}
                  >
                    Last ned HTML
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {currentTab === 2 && (
        <Grid container spacing={3}>
          {/* 🆕 Enhanced Analytics Dashboard */}
          <Grid xs={12}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Customer Journey Analytics
            </Typography>
          </Grid>
          
          {/* Performance Metrics */}
          <Grid xs={12} md={6} lg={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Timeline />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                      {componentAnalytics.totalJourneys}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Journeys
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid xs={12} md={6} lg={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <PlayArrow />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                      {componentAnalytics.activeJourneys}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Journeys
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid xs={12} md={6} lg={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <TrendingUp />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                      {componentAnalytics.avgConversion}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Conversion
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid xs={12} md={6} lg={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <Analytics />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                      {componentAnalytics.totalSteps}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Steps
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Integration Health */}
          <Grid xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Integration Health & Performance
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Component Performance
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Render Count:</Typography>
                        <Typography variant="body2" color="primary">
                          {performance.getPerformanceMetrics()['render_customer-journey-builder']?.length || 0}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Avg Render Time:</Typography>
                        <Typography variant="body2" color="primary">
                          {(() => {
                            const metrics = performance.getPerformanceMetrics()['render_customer-journey-builder'] || [];
                            return metrics.length > 0 ? (metrics.reduce((a: number, b: number) => a + b, 0) / metrics.length).toFixed(2) : '0';
                        })()}ms
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  
                  <Grid xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Feature Usage
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">AI Generation:</Typography>
                        <Typography variant="body2" color={canUseAI ? 'success.main' : 'error.main'}>
                          {canUseAI ? 'Enabled' : 'Disabled'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Export Feature:</Typography>
                        <Typography variant="body2" color={canExportJourneys ? 'success.main' : 'error.main'}>
                          {canExportJourneys ? 'Enabled' : 'Disabled'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          
          {/* User Authentication Status */}
          <Grid xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Authentication Status
                </Typography>
                
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: auth.state.isAuthenticated ? 'success.main' : 'error.main' }}>
                    {auth.state.isAuthenticated ? '✓' : '✗'}
                  </Avatar>
                  <Box>
                    <Typography variant="body1">
                      {auth.state.isAuthenticated 
                        ? `Logged in as ${auth.state.user?.name || 'Unknown User'}`
                        : 'Not authenticated'
                    }
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Role: {auth.state.user?.role || 'unknown'} | 
                      Email: {auth.state.user?.email || 'unknown'}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ✅ Journey Editor Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="lg"
        fullWidth
      >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {selectedTemplate ? 'Rediger Customer Journey' : 'Ny Customer Journey'}
          </Typography>
          
          {/* 🆕 Global AI Generation Indicator */}
          {aiGeneration && (
            <Tooltip title="AI genererer innhold...">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={24} thickness={4} />
                <Typography variant="caption" color="text.secondary">
                  AI genererer...
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Stack>
      </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={3}>
            {/* 🆕 Stage Visualization Panel */}
            <Grid xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  📊 Journey Stages Overview
                </Typography>
                <Stack direction="row" spacing={2}, sx={{ mt: 2, overflowX: 'auto', pb: 1 }}>
                  {templateForm.stages.map((stage) => (
                    <Paper 
                      key={stage.id} 
                      sx={{
                        p: 2, 
                        bgcolor: stage.color, 
                        color: 'white',
                        flex: 1, 
                        minWidth: 150,
                        textAlign: 'center', 
                        borderRadius: 2,
                        boxShadow: 2,
                        transition: 'transform 0.2s', '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4
                        }
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        {stage.customName || stage.name}
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        {stage.metrics?.conversionRate ?? 0}%
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Conversion Rate
                      </Typography>
                      {stage.goals && stage.goals.length > 0 && (
                        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                          <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                            {stage.goals[0]}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {/* Basic Info */}
            <Grid xs={12} md={6}>
              <TextField
                fullWidth
                label="Journey Navn"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                margin="normal"
              />
              
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beskrivelse"
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                margin="normal"
              />
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Pakke Type</InputLabel>
                <Select
                  value={templateForm.packageType}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, packageType: e.target.value }))}
                >
                  {professionConfig[selectedProfession as keyof typeof professionConfig]?.packages.map(pkg => (
                    <MenuItem key={pkg.key} value={pkg.key}>
                      {pkg.name} ({pkg.features} funksjoner)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {/* AI Generation Panel with Feature Access Control */}
            <Grid xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'background.default', position: 'relative' }}>
                {/* 🆕 AI Generation Progress Indicator */}
                {aiGeneration && (
                  <Box sx={{ position: 'absolute', right: 16, top: 16 }}>
                    <Tooltip title="AI genererer innhold...">
                      <CircularProgress size={32} thickness={4} />
                    </Tooltip>
                  </Box>
                )}
                
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  <SmartToy sx={{ mr: 1, verticalAlign: 'bottom' }} />
                  AI-Generert Innhold
                </Typography>
                
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Generer profesjon-spesifikt innhold for Customer Journey
                </Typography>
                
                {/* 🆕 AI Generation Status Alert */}
                {aiGeneration && (
                  <Alert 
                    severity="info" 
                    icon={<CircularProgress size={20} />}
                    sx={{ mb: 2 }}
                  >
                    <Typography variant="body2" fontWeight="bold">
                      AI genererer innhold...
                    </Typography>
                    <Typography variant="caption">
                      Dette kan ta 10-30 sekunder. Vennligst vent.
                    </Typography>
                  </Alert>
                )}
                
                {canUseAI ? (
                  <Stack spacing={1}>
                    {Object.entries(componentTypes).map(([type, config]) => (
                      <Button
                        key={type}
                        fullWidth
                        variant="outlined"
                        startIcon={config.icon}
                        disabled={aiGeneration}
                        onClick={() => generateAIContent(type)}
                        sx={{ position: 'relative' }}
                      >
                        Generer {config.name}
                        {aiGeneration && (
                          <CircularProgress 
                            size={16} 
                            sx={{ 
                              ml: 1,
                              position: 'absolute',
                              right: 8
                            }} 
                          />
                        )}
                      </Button>
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    AI-generering er ikke tilgjengelig for din rolle. 
                    Kontakt administrator for tilgang.
                  </Alert>
                )}
                
                {/* 🆕 AI Usage Stats */}
                <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    AI-generering er aktivert for {auth.state.user?.role || 'unknown'} rolle
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            
            {/* 🆕 Journey Map Visualizer */}
            <Grid xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    🗺️ Journey Map Visualizer
                  </Typography>
                  
                  {/* Visualization Mode Selector */}
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Timeline View">
                      <IconButton
                        color={visualizationMode === 'timeline' ? 'primary' : 'default'}
                        onClick={() => setVisualizationMode('timeline')}
                        size="small"
                      >
                        <TimelineIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Funnel View">
                      <IconButton
                        color={visualizationMode === 'funnel' ? 'primary' : 'default'}
                        onClick={() => setVisualizationMode('funnel')}
                        size="small"
                      >
                        <ViewColumn />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Circular View">
                      <IconButton
                        color={visualizationMode === 'circular' ? 'primary' : 'default'}
                        onClick={() => setVisualizationMode('circular')}
                        size="small"
                      >
                        <DonutLarge />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
                
                {/* Render selected visualization */}
                {visualizationMode === 'timeline' && renderTimelineVisualization()}
                {visualizationMode === 'funnel' && renderFunnelVisualization()}
                {visualizationMode === 'circular' && renderCircularVisualization()}
              </Paper>
            </Grid>

            {/* 🤖 AI Insights Panel */}
            {templateForm.aiInsights && (
              <Grid xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main' }}>
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Psychology sx={{ color: 'success.main' }} />
                      <Typography variant="h6" sx={{ color: 'success.dark' }}>
                        🤖 AI Insights & Recommendations
                      </Typography>
                      <Chip 
                        size="small" 
                        label={`Updated ${new Date(templateForm.aiInsights.lastUpdated).toLocaleTimeString()}`}
                        variant="outlined"
                        color="success"
                      />
                    </Stack>
                    
                    {/* Optimization Suggestions */}
                    {templateForm.aiInsights.optimizationSuggestions.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          🎯 Optimization Suggestions:
                        </Typography>
                        <Stack spacing={1}>
                          {templateForm.aiInsights.optimizationSuggestions.map((suggestion, idx) => (
                            <Alert key={idx} severity="warning" variant="outlined">
                              {suggestion}
                            </Alert>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    
                    {/* Predicted Conversion Path */}
                    {templateForm.aiInsights.predictedConversionPath.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          📊 Predicted Best Path:
                        </Typography>
                        <Stack direction="row" spacing={1}, sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {templateForm.aiInsights.predictedConversionPath.map((stage, idx) => (
                            <Chip
                              key={idx}
                              label={stage}
                              color="success"
                              icon={<TrendingUp />}
                              size="small"
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                    
                    {/* Persona Recommendations */}
                    {templateForm.aiInsights.personaRecommendations.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          👥 Persona Recommendations:
                        </Typography>
                        <Stack spacing={1}>
                          {templateForm.aiInsights.personaRecommendations.map((rec, idx) => (
                            <Alert key={idx} severity="info" variant="outlined">
                              {rec}
                            </Alert>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              </Grid>
            )}

            {/* Journey Steps */}
            <Grid xs={12}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Journey Steg ({templateForm.steps.length})
                </Typography>
                
                {/* 🆕 Visual Preview Mode Toggle */}
                {templateForm.steps.length > 0 && (
                  <Tooltip title={visualPreviewMode ? "Liste visning" : "Visual Preview"}>
                    <Button
                      variant={visualPreviewMode ? "contained" : "outlined"}
                      size="small"
                      startIcon={visualPreviewMode ? <Visibility /> : <Preview />}
                      onClick={() => setVisualPreviewMode(!visualPreviewMode)}
                    >
                      {visualPreviewMode ? "Liste Visning" : "Visual Preview"}
                    </Button>
                  </Tooltip>
                )}
              </Stack>
              
              {templateForm.steps.length === 0 ? (
                <Alert severity="info">
                  Ingen steg ennå. Bruk AI-generering eller dra komponenter hit for å starte.
                </Alert>
              ) : visualPreviewMode ? (
                // 🆕 Visual Preview Mode with React Flow
                <Box sx={{ width: '100%', height: 600, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  <ReactFlow
                    nodes={reactFlowNodes}
                    edges={reactFlowEdges}
                    onNodeClick={(_event: React.MouseEvent, node: Node) => setSelectedNode(node)}
                    onNodesChange={(_changes: any) => {
                      // Handle node position changes if needed
                    }}
                    onEdgesChange={(_changes: any) => {
                      // Handle edge changes if needed
                    }}
                    fitView
                    attributionPosition="bottom-left"
                  >
                    <Background color="#f0f0f0" gap={16} />
                    <Controls />
                    <MiniMap 
                      nodeColor={(node: Node) => {
                        const step = node.data?.step as JourneyStep | undefined;
                        const typeConfig = step ? componentTypes[step.stepType as keyof typeof componentTypes] : null;
                        return typeConfig?.color || '#ccc';
                      }}
                      style={{ backgroundColor: '#f8f9fa' }}
                    />
                  </ReactFlow>
                  
                  {/* Selected Node Details */}
                  {selectedNode && (
                    <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Selected Step Details
                        </Typography>
                        <IconButton size="small" onClick={() => setSelectedNode(null)}>
                          <CloseIcon />
                        </IconButton>
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      {selectedNode.data?.step && (
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            <strong>Title:</strong> {(selectedNode.data.step as JourneyStep).title}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Content:</strong> {(selectedNode.data.step as JourneyStep).content}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Step Type:</strong> {(selectedNode.data.step as JourneyStep).stepType}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Order:</strong> {(selectedNode.data.step as JourneyStep).stepOrder}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  )}
                </Box>
              ) : (
                renderJourneySteps()
              )}
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            startIcon={theming.getThemedIcon('save')}
            onClick={() => saveTemplateMutation.mutate(templateForm)}
            disabled={!templateForm.name || saveTemplateMutation.isPending}
          >
            {saveTemplateMutation.isPending ? 'Lagrer...' : 'Lagre Journey'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}