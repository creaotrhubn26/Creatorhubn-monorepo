import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
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
  Alert,
  Rating,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Paper,
  InputAdornment,
  Autocomplete,
  Tooltip as MuiTooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  CircularProgress,
  LinearProgress,
  Avatar,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  BugReport,
  Lightbulb,
  ThumbUp,
  Comment,
  Psychology,
  Edit,
  Error as ErrorIcon,
  Person,
  Email,
  OpenInNew,
  Star,
  Category,
  Search,
  Sort,
  GetApp,
  Clear,
  People,
  Screenshot as Screenshot,
  Mic,
  Videocam,
  DeviceHub,
  Speed as Speed,
  MyLocation,
  Timeline,
  EmojiEvents,
  ExpandMore,
} from '@mui/icons-material';
import { PrototypeTesterIcon } from '../icons/PrototypeTesterIcon';
import { apiRequest, isApiEndpointMissing } from '@/lib/queryClient';
import { AdminButton } from './design-system';
import FeedbackConversation from '../universal/editing-marketplace/FeedbackConversation';
import RichTextEditor from '../RichTextEditor';
import 'quill/dist/quill.snow.css';

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  coverage?: number
}

interface ValidationRequest {
  sentAt: string;
  expiresAt: string;
  validationUrl: string
}

interface UserResponse {
  validatedAt: string;
  userConfirmed: boolean;
  userComments: string;
  userRating: number
}

interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  totalEndpoints: number;
  successfulEndpoints: number;
  failedEndpoints: number;
  averageResponseTime: number;
  checks: Array<{
    endpoint: string;
    status: number;
    responseTime: number;
    success: boolean;
    error?: string;
}>;
}

interface HealthCheckResult {
  endpoint: string;
  statusChange: number;
  responseTimeChange: number
}

interface FeedbackVerification {
  automatedTests: {
    status: 'pending' | 'running' | 'passed' | 'failed';
    testResults: TestResult[];
    coverage: number;
};
  regressionTests: {
    status: 'pending' | 'running' | 'passed' | 'failed';
    affectedComponents: string[];
    testResults: TestResult[];
};
  userValidation: {
    status: 'pending' | 'sent' | 'validated' | 'failed';
    validationRequest?: ValidationRequest;
    userResponse?: UserResponse;
};
  systemHealth: {
    preDeployment: SystemHealthStatus;
    postDeployment: SystemHealthStatus;
    healthCheckResults: HealthCheckResult[];
};
}

// Browser context from feedbackCaptureService
interface BrowserContext {
  userAgent: string;
  platform: string;
  language: string;
  viewport: { width: number; height: number };
  screenSize: { width: number; height: number };
  devicePixelRatio: number;
  colorDepth: number;
  timezone: string;
  online: boolean;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  touchSupported: boolean;
  webGL: string | null;
}

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  memoryUsage: number | null;
  fps: number;
}

interface ConsoleError {
  message: string;
  source: string;
  lineno: number;
  colno: number;
  timestamp: number;
  stack?: string;
}

interface UserJourneyStep {
  type: 'navigation' | 'click' | 'input' | 'scroll' | 'error';
  target?: string;
  value?: string;
  url: string;
  timestamp: number;
}

interface FeedbackContext {
  browser: BrowserContext;
  performance: PerformanceMetrics;
  consoleErrors: ConsoleError[];
  userJourney: UserJourneyStep[];
  currentUrl: string;
  currentComponent: string | null;
  sessionDuration: number;
}

interface TargetedElement {
  selector: string;
  xpath: string;
  tagName: string;
  id: string | null;
  className: string;
  textContent: string;
  rect: { top: number; left: number; width: number; height: number };
  computedStyle: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontFamily: string;
  };
  attributes: Record<string, string>;
  parentChain: string[];
}

interface AudioRecording {
  blob?: string; // base64 or URL
  duration: number;
  mimeType: string;
  timestamp: number;
  transcription?: string;
}

interface VideoRecording {
  blob?: string; // base64 or URL
  duration: number;
  mimeType: string;
  width: number;
  height: number;
  timestamp: number;
}

// Improvement D — AI-temaklynging: Claude grupperer åpen feedback i temaer.
interface ClusterTheme {
  theme: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  feedbackIds: string[];
  suggestedAction: string;
}

interface FeedbackItem {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  profession: string;
  dashboardType: string;
  feedbackType: 'bug' | 'feature' | 'usability' | 'general' | 'ui_ux';
  title: string;
  description: string;
  rating: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  tags: string[];
  isAnonymous: boolean;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  adminNotes?: string;
  screenshotUrl?: string;
  verification?: FeedbackVerification;
  // New fields from enhanced PrototypeFeedbackTool
  context?: FeedbackContext;
  targetedElement?: TargetedElement;
  audioRecording?: AudioRecording;
  videoRecording?: VideoRecording;
  // Gamification data
  testerXP?: number;
  testerLevel?: number;
  testerBadges?: string[];
}

// Type-safe icon mapping
const feedbackTypeIcons: Record<string, React.ComponentType<any>> = {
  bug: BugReport,
  feature: Lightbulb,
  usability: ThumbUp,
  ui_ux: Psychology,
  general: Comment
};

// These will be replaced by theme colors in the component
const getFeedbackTypeColors = (theme: any) => ({
  bug: theme?.error || '#f44336',
  feature: theme?.warning || '#ff9800',
  usability: theme?.success || '#4caf50',
  ui_ux: theme?.purple || '#9c27b0',
  general: theme?.info || '#2196f3'
});

const getPriorityColors = (theme: any) => ({
  low: theme?.success || '#4caf50',
  medium: theme?.warning || '#ff9800',
  high: theme?.error || '#f44336',
  critical: theme?.purple || '#9c27b0'
});

const getStatusColors = (theme: any) => ({
  open: theme?.info || '#2196f3',
  in_progress: theme?.warning || '#ff9800',
  resolved: theme?.success || '#4caf50',
  closed: theme?.grey || '#757575'
});

const normalizeFeedbackItems = (value: unknown): FeedbackItem[] => {
  if (Array.isArray(value)) {
    return value as FeedbackItem[];
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as { feedback?: unknown; data?: unknown };

    if (Array.isArray(record.feedback)) {
      return record.feedback as FeedbackItem[];
    }

    if (Array.isArray(record.data)) {
      return record.data as FeedbackItem[];
    }
  }

  return [];
};

// Enhanced type definitions
interface UnifiedWorkflowEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  [key: string]: unknown;
}

interface PrototypeFeedbackPanelProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: UnifiedWorkflowEvent) => void;
  onProjectUpdate?: (project: UnifiedWorkflowEvent) => void;
  onWorklogCreate?: (worklog: UnifiedWorkflowEvent) => void;
  onClientSelect?: (client: UnifiedWorkflowEvent) => void;
  onClientUpdate?: (client: UnifiedWorkflowEvent) => void;
  onShowcaseCreate?: (showcase: UnifiedWorkflowEvent) => void;
  onFileUpload?: (file: UnifiedWorkflowEvent) => void;
  onFileDownload?: (file: UnifiedWorkflowEvent) => void;
  selectedProject?: UnifiedWorkflowEvent;
  onProjectSelect?: (project: UnifiedWorkflowEvent) => void;
  selectedClient?: UnifiedWorkflowEvent;
  onSettingsUpdate?: (settings: UnifiedWorkflowEvent) => void;
  onNotificationCreate?: (notification: UnifiedWorkflowEvent) => void;
}

type SortField = 'createdAt' | 'priority' | 'rating' | 'status';
type SortOrder = 'asc' | 'desc';
type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export default function PrototypeFeedbackPanel({
  onClientUpdate,
  onNotificationCreate
}: PrototypeFeedbackPanelProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<FeedbackStatus>('open');
  const [adminNotes, setAdminNotes] = useState('');
  
  // Search, filter, and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus[]>([]);
  const [filterPriority, setFilterPriority] = useState<FeedbackPriority[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterProfession, setFilterProfession] = useState<string[]>([]); // NEW: Profession filter
  const [groupByProfession, setGroupByProfession] = useState(false); // NEW: Group by profession toggle
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const queryClient = useQueryClient();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Enhanced Master Integration for advanced features
  const { analytics, performance, debugging, lifecycle, auth } = useEnhancedMasterIntegration();

  // Component registration for system-wide integration
  useEffect(() => {
    const endTiming = performance.startTiming('prototype_feedback_panel_init, ');
    
    lifecycle.registerComponent({
      id: 'prototype-feedback-panel',
      type: 'admin-panel',
      version: '2.0.0',
      capabilities: {
        data: ['feedback:read','feedback:write','feedback:export'],
        events: ['feedback:created','feedback:updated','feedback:deleted'],
        actions: ['filter','sort','group','export','update-status'],
        ui: ['search','filter-controls','profession-grouping'],
        system: ['real-time-updates','websocket-integration']
      },
      dependencies: ['query-client','theming-system','auth-system'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0 }
    });

    analytics.trackEvent('prototype_feedback_panel_mounted', {
      filterStatus: filterStatus.length,
      filterPriority: filterPriority.length,
      filterProfession: filterProfession.length,
      groupByProfession,
      totalFeedback: feedbackItems.length
    });

    debugging.logIntegration('info', 'PrototypeFeedbackPanel initialized with enhanced features', {
      professionFilterEnabled: true,
      groupingEnabled: true,
      searchEnabled: true,
      exportEnabled: true
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('prototype-feedback-panel');
    };
  }, []);

  // Use theme-aware colors
  const themeColors = useMemo(() => ({
    primary: '#ff8c00',
    secondary: theming.colors.secondary || '#ffa726',
    error: '#f44336',
    warning: '#ff9800',
    success: '#4caf50',
    info: '#2196f3',
    purple: '#9c27b0',
    grey: '#757575'
  }), [theming.colors]);

  // Dynamic color mappings based on theme
  const feedbackTypeColors = useMemo(() => getFeedbackTypeColors(themeColors), [themeColors]);
  const priorityColors = useMemo(() => getPriorityColors(themeColors), [themeColors]);
  const statusColors = useMemo(() => getStatusColors(themeColors), [themeColors]);

  // Fetch all prototype feedback - SANNTID for øyeblikkelig visning av nye tilbakemeldinger
  const { data: feedbackList = [], isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ['/api/prototype-testing/feedback'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      try {
        const response = await apiRequest('/api/prototype-testing/feedback', { headers });
        return normalizeFeedbackItems(response);
      } catch (queryError) {
        if (isApiEndpointMissing(queryError)) {
          console.debug('PrototypeFeedbackPanel: feedback endpoint unavailable, using empty fallback.');
          return [];
        }
        throw queryError;
      }
    },
    refetchInterval: 30000,
    staleTime: 15000,
    retry: false,
    placeholderData: [],
  });
  const feedbackItems = useMemo(() => normalizeFeedbackItems(feedbackList), [feedbackList]);

  // Update feedback status mutation
  // Improvement D — AI-temaanalyse av åpen feedback.
  const clusterMutation = useMutation<
    { clusters: ClusterTheme[]; degraded?: boolean; message?: string; count: number },
    Error
  >({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/prototype-testing/cluster', {
        headers: { ...headers, 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ limit: 200 }),
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/prototype-testing/feedback/${id}`, {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'PUT',
        body: JSON.stringify({ status, adminNotes })
    });
  },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prototype-testing/feedback'] });
      setStatusDialogOpen(false);
      setSelectedFeedback(null);
      
      // Trigger unified workflow events
      if (onNotificationCreate) {
        onNotificationCreate({
          id: `feedback_status_updated_${Date.now()}`,
          type: 'feedback_status_updated',
          title: 'Feedback Status Updated',
          message: `Feedback status changed to ${variables.status}`,
          priority: 'medium',
          timestamp: new Date().toISOString(),
          source: 'prototype_feedback_panel'
    });
    }
      
      if (onClientUpdate && selectedFeedback) {
        onClientUpdate({
          id: selectedFeedback.userId,
          type: 'client_update',
          timestamp: new Date().toISOString(),
          source: 'prototype_feedback_panel',
          email: selectedFeedback.userEmail,
          name: selectedFeedback.userName,
          userType: 'prototype_tester',
          feedbackStatus: variables.status,
          lastActivity: new Date().toISOString()
    });
    }
  }
});

  const handleStatusUpdate = useCallback(() => {
    if (selectedFeedback && newStatus) {
      const endTiming = performance.startTiming('feedback_status_update');
      
      analytics.trackEvent('feedback_status_changed', {
        feedbackId: selectedFeedback.id,
        oldStatus: selectedFeedback.status,
        newStatus,
        profession: selectedFeedback.profession,
        hasAdminNotes: !!adminNotes
      });
      
      updateStatusMutation.mutate({
        id: selectedFeedback.id,
        status: newStatus,
        adminNotes
      });
      
      endTiming();
    }
  }, [selectedFeedback, newStatus, adminNotes, updateStatusMutation, analytics, performance]);

  // ✅ CreatorHub-inspirert Rich Text Editor konfigurasjon
  const quillModules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold','italic','underline','strike'],
        ['blockquote','code-block'],
        [{ 'list':'ordered' }, { 'list' : 'bullet' }],
        [{ 'indent':'-1' }, { 'indent' : '+1' }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link','image'],
        ['clean']
      ]
    }
  };

  const quillFormats = [
    'header','bold','italic','underline','strike','blockquote','code-block','list','bullet','indent','size','color','background','align','link','image'
  ];

  // ✅ Forhåndsdefinerte notattekster for rask bruk
  const adminNoteTemplates = [
    {
      label: 'Problembeskrivelse',
      content: '<h3>Problembeskrivelse:</h3><p>[Beskriv problemet detaljert]</p><h3>Planlagt løsning:</h3><p>[Hvordan problemet skal løses]</p><h3>Estimert, tid:</h3><p>[Forventet tid for løsning]</p>'
},
    {
      label: 'Forbedring implementert', 
      content: '<h3>Forbedring implementert ✅</h3><p><strong>Dato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Endringer:</strong></p><ul><li>[Endre 1]</li><li>[Endring 2]</li></ul><p><strong>Testing:</strong> [Testet og verifisert]</p>'
},
    {
      label: 'Behov for mer informasjon',
      content: '<h3>Trenger mer informasjon ℹ️</h3><p><strong>Spørsmål til, bruker:</strong></p><ol><li>[Spørsmål 1]</li><li>[Spørsmål 2]</li></ol><p><strong>Kontaktinfo:</strong> [E-post/telefon]</p>'
},
    {
      label: 'Lukket - Løst',
      content: '<h3>Tilbakemelding løst ✅</h3><p><strong>Løsningsdato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Implementerte løsninger:</strong></p><p>[Detaljert beskrivelse av løsningen]</p><p><strong>Oppfølging:</strong> [Ingen ytterligere handling nødvendig]</p>'
}
  ];

  // Verification status helper
  const getVerificationStatus = useCallback((feedback: FeedbackItem): 'pending' | 'verified' | 'failed' | 'in-progress' => {
    if (!feedback.verification) return 'pending';
    
    const { automatedTests, regressionTests, userValidation } = feedback.verification;
    
    // Check if all verification steps are complete and passed
    if (automatedTests.status === 'passed' && 
        regressionTests.status === 'passed' && 
        userValidation.status === 'validated') {
      return 'verified';
  }
    
    // Check if any step failed
    if (automatedTests.status === 'failed' || 
        regressionTests.status === 'failed' || 
        userValidation.status === 'failed') {
      return 'failed';
  }
    
    // Check if any step is in progress
    if (automatedTests.status === 'running' || 
        regressionTests.status === 'running' || 
        userValidation.status === 'sent') {
      return 'in-progress';
  }
    
    return 'pending';
  }, []);

  // Filtered and sorted feedback with performance optimization
  const filteredAndSortedFeedback = useMemo(() => {
    let filtered = [...feedbackItems];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(f => 
        f.title.toLowerCase().includes(search) ||
        f.description.toLowerCase().includes(search) ||
        f.userName?.toLowerCase().includes(search) ||
        f.userEmail?.toLowerCase().includes(search) ||
        f.component?.toLowerCase().includes(search)
      );
    }
    
    // Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter(f => filterStatus.includes(f.status));
    }
    
    // Priority filter
    if (filterPriority.length > 0) {
      filtered = filtered.filter(f => filterPriority.includes(f.priority));
    }
    
    // Type filter
    if (filterType.length > 0) {
      filtered = filtered.filter(f => filterType.includes(f.feedbackType));
    }
    
    // Profession filter
    if (filterProfession.length > 0) {
      filtered = filtered.filter(f => filterProfession.includes(f.profession));
    }
    
    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'priority': {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        }
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'status': {
          const statusOrder = { open: 1, in_progress: 2, resolved: 3, closed: 4 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [feedbackItems, searchTerm, filterStatus, filterPriority, filterType, filterProfession, sortBy, sortOrder]);

  // Group feedback by profession if enabled
  const groupedByProfession = useMemo(() => {
    if (!groupByProfession) return null;

    const groups: Record<string, FeedbackItem[]> = {};
    filteredAndSortedFeedback.forEach(feedback => {
      const profession = feedback.profession || 'other';
      if (!groups[profession]) {
        groups[profession] = [];
      }
      groups[profession].push(feedback);
    });

    return groups;
  }, [groupByProfession, filteredAndSortedFeedback]);

  // Get unique professions for filter
  const availableProfessions = useMemo(() => {
    const professions = new Set(feedbackItems.map(f => f.profession));
    return Array.from(professions).sort();
  }, [feedbackItems]);

  // Profession branding from centralized theming helper - SINGLE SOURCE OF TRUTH
  const professionConfig = theming.professionConfig;

  // Calculate stats with memoization
  const stats = useMemo(() => ({
    total: feedbackItems.length,
    open: feedbackItems.filter(f => f.status === 'open').length,
    in_progress: feedbackItems.filter(f => f.status === 'in_progress').length,
    resolved: feedbackItems.filter(f => f.status === 'resolved').length,
    critical: feedbackItems.filter(f => f.priority === 'critical').length,
    high: feedbackItems.filter(f => f.priority === 'high').length,
    verified: feedbackItems.filter(f => getVerificationStatus(f) === 'verified').length,
    failed: feedbackItems.filter(f => getVerificationStatus(f) === 'failed').length,
    avgRating: feedbackItems.length > 0
      ? feedbackItems.reduce((sum, f) => sum + f.rating, 0) / feedbackItems.length
      : 0,
  }), [feedbackItems, getVerificationStatus]);

  // Export to CSV functionality with analytics tracking
  const exportToCSV = useCallback(() => {
    const endTiming = performance.startTiming('feedback_export_csv');

    const headers = ['Date','User','Email','Title','Type','Priority','Status','Rating','Component','Description','Profession'];
    const rows = filteredAndSortedFeedback.map(f => [
      new Date(f.createdAt).toLocaleString('no-NO'),
      f.userName || f.userId,
      f.userEmail || '',
      f.title,
      f.feedbackType,
      f.priority,
      f.status,
      f.rating.toString(),
      f.component || '',
      f.description,
      f.profession || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prototype-feedback-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    endTiming();
    
    analytics.trackEvent('feedback_exported', {
      format: 'csv',
      rowCount: filteredAndSortedFeedback.length,
      filters: {
        search: searchTerm,
        status: filterStatus,
        priority: filterPriority,
        profession: filterProfession
      },
      timestamp: Date.now()
    });
    
    debugging.logIntegration('info','Feedback exported to CSV', {
      rowCount: filteredAndSortedFeedback.length
    });
  }, [filteredAndSortedFeedback, analytics, performance, debugging, searchTerm, filterStatus, filterPriority, filterProfession]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterStatus([]);
    setFilterPriority([]);
    setFilterType([]);
    setFilterProfession([]);
    setGroupByProfession(false);
    setSortBy('createdAt');
    setSortOrder('desc');
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ color: themeColors.primary, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PrototypeTesterIcon size={32} /> Prototype Feedback Management
        </Typography>
        <Alert severity="info">Laster prototype feedback...</Alert>
      </Box>
    );
}

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ color: '#ff8c00', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <PrototypeTesterIcon size={32} /> Prototype Feedback Management
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Administrer tilbakemeldinger fra prototype testere for kontinuerlig forbedring av plattformen.
      </Typography>

      {/* Improvement D — AI-temaanalyse */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Psychology sx={{ color: '#ff8c00' }} />
            <Typography sx={{ fontWeight: 600 }}>AI-temaanalyse</Typography>
            <Typography variant="caption" color="text.secondary">
              — grupper åpen feedback i temaer med foreslåtte tiltak
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <AdminButton
            tone="primary"
            loading={clusterMutation.isPending}
            startIcon={<Psychology />}
            onClick={() => clusterMutation.mutate()}
            sx={{ mb: 2 }}
          >
            {clusterMutation.isPending ? 'Analyserer…' : 'Analyser temaer'}
          </AdminButton>

          {clusterMutation.isError ? (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              Klynging feilet: {clusterMutation.error?.message || 'ukjent feil'}
            </Typography>
          ) : null}

          {clusterMutation.data?.degraded ? (
            <Typography variant="body2" color="text.secondary">
              {clusterMutation.data.message}
            </Typography>
          ) : null}

          {clusterMutation.data && !clusterMutation.data.degraded ? (
            (clusterMutation.data.clusters?.length ?? 0) === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {clusterMutation.data.message || 'Ingen temaer funnet.'}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="caption" color="text.secondary">
                  {clusterMutation.data.count} tilbakemeldinger analysert → {clusterMutation.data.clusters.length} temaer
                </Typography>
                {clusterMutation.data.clusters.map((c, i) => {
                  const sevColor =
                    c.severity === 'critical'
                      ? 'error'
                      : c.severity === 'high'
                        ? 'warning'
                        : c.severity === 'medium'
                          ? 'info'
                          : 'default';
                  return (
                    <Paper key={`${c.theme}-${i}`} variant="outlined" sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Chip size="small" color={sevColor as any} label={c.severity} />
                        <Typography sx={{ fontWeight: 600 }}>{c.theme}</Typography>
                        <Chip size="small" variant="outlined" label={`${c.count ?? c.feedbackIds?.length ?? 0} saker`} />
                      </Box>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>{c.summary}</Typography>
                      {c.suggestedAction ? (
                        <Typography variant="body2" color="success.main">
                          → {c.suggestedAction}
                        </Typography>
                      ) : null}
                    </Paper>
                  );
                })}
              </Stack>
            )
          ) : null}
        </AccordionDetails>
      </Accordion>

      {/* Search, Filter, and Sort Controls */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Søk i tilbakemeldinger..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#ff8c00' }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          {/* Status Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <Autocomplete
              multiple
              size="small"
              options={['open','in_progress','resolved','closed'] as FeedbackStatus[]}
              value={filterStatus}
              onChange={(_, newValue) => setFilterStatus(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Status" placeholder="Filtrer status" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                ))
              }
            />
          </Grid>

          {/* Priority Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <Autocomplete
              multiple
              size="small"
              options={['critical','high','medium','low'] as FeedbackPriority[]}
              value={filterPriority}
              onChange={(_, newValue) => setFilterPriority(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Prioritet" placeholder="Filtrer prioritet" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                ))
              }
            />
          </Grid>

          {/* Profession Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <Autocomplete
              multiple
              size="small"
              options={availableProfessions}
              value={filterProfession}
              onChange={(_, newValue) => {
                setFilterProfession(newValue);
                analytics.trackEvent('profession_filter_changed', {
                  professions: newValue,
                  count: newValue.length
                });
              }}
              renderInput={(params) => (
                <TextField {...params} label="Profesjon" placeholder="Filtrer profesjon" />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {professionConfig[option]?.emoji || '🔧'} {professionConfig[option]?.label || option}
                </Box>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip 
                    {...getTagProps({ index })} 
                    key={option} 
                    label={`${professionConfig[option]?.emoji || '🔧'} ${professionConfig[option]?.label || option}`} 
                    size="small"
                    sx={{ bgcolor: professionConfig[option]?.color, color: 'white' }}
                  />
                ))
              }
            />
          </Grid>

          {/* Sort */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Sorter etter</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                label="Sorter etter"
                startAdornment={<Sort sx={{ ml: 1, mr: -0.5, color: '#ff8c00' }} />}
              >
                <MenuItem value="createdAt">Dato</MenuItem>
                <MenuItem value="priority">Prioritet</MenuItem>
                <MenuItem value="rating">Rating</MenuItem>
                <MenuItem value="status">Status</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Sort Order */}
          <Grid item xs={12} sm={6} md={1}>
            <MuiTooltip title={sortOrder === 'asc' ? 'Stigende' : 'Synkende'}>
              <IconButton 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: '#ff8c00',
                  color: 'white', '&:hover': { bgcolor: '#e67e00' }
                }}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </IconButton>
            </MuiTooltip>
          </Grid>

          {/* Actions */}
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <MuiTooltip title={groupByProfession ? "Vis som liste" : "Grupper etter profesjon"}>
                <IconButton 
                  onClick={() => {
                    const newValue = !groupByProfession;
                    setGroupByProfession(newValue);
                    analytics.trackEvent('profession_grouping_toggled', {
                      enabled: newValue,
                      professionCount: availableProfessions.length
                    });
                  }}
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: groupByProfession ? '#ff8c00' : 'transparent',
                    color: groupByProfession ? 'white' : '#ff8c00','&:hover': { 
                      bgcolor: groupByProfession ? '#e67e00' : 'rgba(255, 140, 0, 0.1)'
                    }
                  }}
                >
                  <People />
                </IconButton>
              </MuiTooltip>
              <MuiTooltip title="Eksporter til CSV">
                <IconButton 
                  onClick={exportToCSV}
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    color: '#4caf50'
                  }}
                >
                  <GetApp />
                </IconButton>
              </MuiTooltip>
              {(searchTerm || filterStatus.length > 0 || filterPriority.length > 0 || filterProfession.length > 0) && (
                <MuiTooltip title="Nullstill filtre">
                  <IconButton 
                    onClick={clearFilters}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'divider',
                      color: '#f44336'
                    }}
                  >
                    <Clear />
                  </IconButton>
                </MuiTooltip>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Active Filters Display */}
        {(searchTerm || filterStatus.length > 0 || filterPriority.length > 0 || filterType.length > 0 || filterProfession.length > 0) && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Aktive filtre:
            </Typography>
            {searchTerm && (
              <Chip 
                label={`Søk: "${searchTerm}"`} 
                size="small" 
                onDelete={() => setSearchTerm('')}
                sx={{ bgcolor: '#ff8c00', color: 'white' }}
              />
            )}
            {filterStatus.map(status => (
              <Chip 
                key={status} 
                label={`Status: ${status}`} 
                size="small" 
                onDelete={() => setFilterStatus(filterStatus.filter(s => s !== status))}
              />
            ))}
            {filterPriority.map(priority => (
              <Chip 
                key={priority} 
                label={`Prioritet: ${priority}`} 
                size="small" 
                onDelete={() => setFilterPriority(filterPriority.filter(p => p !== priority))}
              />
            ))}
            {filterProfession.map(profession => (
              <Chip 
                key={profession} 
                label={`${professionConfig[profession]?.emoji || '🔧'} ${professionConfig[profession]?.label || profession}`} 
                size="small" 
                onDelete={() => setFilterProfession(filterProfession.filter(p => p !== profession))}
                sx={{ bgcolor: professionConfig[profession]?.color, color: 'white' }}
              />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Viser {filteredAndSortedFeedback.length} av {feedbackItems.length}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ color: 'white', textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
                {stats.total}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total tilbakemeldinger
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              ...theming.getThemedCardSx(),
              background: 'linear-gradient(135deg, #FF9800 0%, #FFB74D 100%)'}}
          >
            <CardContent sx={{ color: 'white', textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
                {stats.open + stats.in_progress}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Aktive saker
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              ...theming.getThemedCardSx(),
              background: 'linear-gradient(135deg, #F44336 0%, #EF5350 100%)'}}
          >

            <CardContent sx={{ color: 'white', textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
                {stats.critical + stats.high}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Høy/Kritisk prioritet
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)', ...theming.getThemedCardSx() }}>
            <CardContent sx={{ color: 'white', textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
                {stats.verified}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ✅ Verifisert
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            sx={{
              ...theming.getThemedCardSx(),
              background: 'linear-gradient(135deg, #9C27B0 0%, #BA68C8 100%)'}}
          >
            <CardContent sx={{ color: 'white', textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
                {stats.failed}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ❌ Feilet verifisering
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Profession Breakdown */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: themeColors.primary }}>
          <People /> 
          Fordeling per profesjon
        </Typography>
        <Grid container spacing={2}>
          {availableProfessions.map(profession => {
            const count = feedbackItems.filter(f => f.profession === profession).length;
            const config = professionConfig[profession] || professionConfig.other;
            return (
              <Grid item xs={6} sm={4} md={2.4} key={profession}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: filterProfession.includes(profession) ? config.color : 'transparent',
                    transition: 'all 0.2s','&:hover': {
                      borderColor: config.color,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${config.color}40`
                    }
                  }}
                  onClick={() => {
                    const isAdding = !filterProfession.includes(profession);
                    if (filterProfession.includes(profession)) {
                      setFilterProfession(filterProfession.filter(p => p !== profession));
                    } else {
                      setFilterProfession([...filterProfession, profession]);
                    }
                    
                    analytics.trackEvent('profession_card_clicked', {
                      profession,
                      action: isAdding ? 'add_filter' : 'remove_filter',
                      totalFilteredProfessions: isAdding ? filterProfession.length + 1 : filterProfession.length - 1 });
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2 }}>
                    <Box sx={{ mb: 0.5 }}>
                      {React.createElement(config.icon, { 
                        sx: { fontSize: 48, color: config.color } 
                      })}
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: config.color, mb: 0.5 }}>
                      {count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {config.label}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Feedback List */}
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: themeColors.primary }}>
            <Comment sx={{ mr: 1 }} />
            Alle tilbakemeldinger
            <Badge badgeContent={stats.open} color="primary" sx={{ ml: 1 }} />
          </Typography>

          {feedbackItems.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Ingen tilbakemeldinger mottatt ennå. Prototype testere kan sende tilbakemeldinger via dashboard.
            </Alert>
          ) : filteredAndSortedFeedback.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Ingen tilbakemeldinger matcher de valgte filtrene. Prøv å justere søket eller filtrene.
            </Alert>
          ) : groupByProfession && groupedByProfession ? (
            // Grouped by profession view
            <Box>
              {Object.entries(groupedByProfession).map(([profession, items]) => {
                const config = professionConfig[profession] || professionConfig.other;
                return (
                  <Box key={profession} sx={{ mb: 3 }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2, 
                        p: 2, 
                        borderRadius: 2,
                        bgcolor: `${config.color}10`,
                        border: `2px solid ${config.color}`,
                        mb: 2 }}
                    >
                      {React.createElement(config.icon, { 
                        sx: { fontSize: 40, color: config.color } 
                      })}
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: config.color }}>
                          {config.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {items.length} tilbakemelding{items.length !== 1 ? 'er' : ''}
                        </Typography>
                      </Box>
                    </Box>
                    <List>
                      {items.map((feedback, index) => {
                        const FeedbackIcon = feedbackTypeIcons[feedback.feedbackType] || Comment;
                        const verificationStatus = getVerificationStatus(feedback);
                        const verificationLabel = verificationStatus === 'verified' ? '✅ Verified' :
                                                 verificationStatus === 'failed' ? '❌ Failed' :
                                                 verificationStatus === 'in-progress' ? '🔄 Verifying' : '⏳ Pending';
                        const verificationColor = verificationStatus === 'verified' ? '#4caf50' :
                                                 verificationStatus === 'failed' ? '#f44336' :
                                                 verificationStatus === 'in-progress' ? '#ff9800' : '#757575';
                        return (
                          <React.Fragment key={feedback.id}>
                            <ListItem
                              sx={{
                                bgcolor: feedback.priority === 'critical' ? 'rgba(2, 4, 4, 675, 4, 0.05)' :
                                        feedback.priority === 'high' ? 'rgba(255, 152, 0, 0.05)' : 'transparent',
                                borderRadius: 1,
                                mb: 1,
                                borderLeft: `4px solid ${config.color}`
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                      <FeedbackIcon 
                                        sx={{ 
                                          color: feedbackTypeColors[feedback.feedbackType],
                                          fontSize: 24 }}
                                      />
                                      <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                        {feedback.title}
                                      </Typography>
                                      <Chip
                                        label={feedback.priority}
                                        size="small"
                                        sx={{
                                          bgcolor: priorityColors[feedback.priority],
                                          color: 'white',
                                          fontWeight: 'bold'
                                        }}
                                      />
                                      <Chip
                                        label={feedback.status}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          borderColor: statusColors[feedback.status],
                                          color: statusColors[feedback.status]
                                        }}
                                      />
                                      <Chip
                                        label={verificationLabel}
                                        size="small"
                                        sx={{
                                          bgcolor: verificationColor,
                                          color: 'white',
                                          fontWeight: 'bold'
                                        }}
                                      />
                                    </Box>
                                  </Box>
                                }
                                secondary={
                                  <Box>
                                    <Typography variant="body2" color="text.secondary">
                                      {feedback.description}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                                      {feedback.userName || feedback.userEmail || feedback.userId} • {new Date(feedback.createdAt).toLocaleString('no-NO')}
                                    </Typography>
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <IconButton 
                                    onClick={() => {
                                      setSelectedFeedback(feedback);
                                      setDetailDialogOpen(true);
                                    }}
                                    sx={{ bgcolor: 'primary.main', color: 'white','&:hover': { bgcolor: 'primary.dark' } }}
                                  >
                                    <OpenInNew />
                                  </IconButton>
                                  <IconButton
                                    onClick={() => {
                                      setSelectedFeedback(feedback);
                                      setNewStatus(feedback.status);
                                      setStatusDialogOpen(true);
                                    }}
                                    sx={{ color: '#ff8c00' }}
                                  >
                                    {theming.getThemedIcon('edit')}
                                  </IconButton>
                                </Box>
                              </ListItemSecondaryAction>
                            </ListItem>
                            {index < items.length - 1 && <Divider sx={{ my: 1 }} />}
                          </React.Fragment>
                        );
                      })}
                    </List>
                  </Box>
                );
              })}
            </Box>
          ) : (
            // Regular list view
            <List>
              {filteredAndSortedFeedback.map((feedback, index) => {
                const FeedbackIcon = feedbackTypeIcons[feedback.feedbackType] || Comment; // ✅ FALLBACK: Forhindrer undefined error
                const verificationStatus = getVerificationStatus(feedback);
                const verificationLabel = verificationStatus === 'verified' ? '✅ Verified' :
                                         verificationStatus === 'failed' ? '❌ Failed' :
                                         verificationStatus === 'in-progress' ? '🔄 Verifying' : '⏳ Pending';
                const verificationColor = verificationStatus === 'verified' ? '#4caf50' :
                                         verificationStatus === 'failed' ? '#f44336' :
                                         verificationStatus === 'in-progress' ? '#ff9800' : '#757575';
                return (
                  <React.Fragment key={feedback.id}>
                    <ListItem
                      sx={{
                        bgcolor: feedback.priority === 'critical' ? 'rgba(2, 4, 4, 675, 4, 0.05)' :
                                feedback.priority === 'high' ? 'rgba(255, 152, 0, 0.05)' : 'transparent',
                        borderRadius: 1,
                        mb: 1 }}
                    >
                      <ListItemText
                        primary={
                          <Box>
                            {/* User Information - Prominent Display */}
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 1,
                              mb: 1,
                              p: 1,
                              bgcolor: 'rgba(255, 140, 0, 0.1)',
                              borderRadius: 1,
                              border: '1px solid rgba(255, 140, 0, 0.3)'
                          }}>
                              <Person sx={{ color: '#ff8c00', fontSize: 18 }} />
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00' }}>
                                {feedback.userName || feedback.userEmail || feedback.userId}
                              </Typography>
                              {/* Profession Badge */}
                              <Chip
                                label={`${professionConfig[feedback.profession]?.emoji || '🔧'} ${professionConfig[feedback.profession]?.label || feedback.profession}`}
                                size="small"
                                sx={{
                                  bgcolor: professionConfig[feedback.profession]?.color,
                                  color: 'white',
                                  fontWeight: 'bold',
                                  height: 20,
                                  fontSize: '0.7rem'
                                }}
                              />
                              {feedback.userEmail && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Email sx={{ color: '#757575', fontSize: 14 }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {feedback.userEmail}
                                  </Typography>
                                </Box>
                              )}
                            </Box>

                            {/* Feedback Title and Status */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <FeedbackIcon 
                                sx={{ 
                                  color: feedbackTypeColors[feedback.feedbackType],
                                  fontSize: 32 // ✅ STØRRE IKON som ønsket
                            }}
                              />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                {feedback.title}
                              </Typography>
                              <Chip
                                label={feedback.priority}
                                size="small"
                                sx={{
                                  bgcolor: priorityColors[feedback.priority],
                                  color: 'white',
                                  fontWeight: 'bold'
                            }}
                              />
                              <Chip
                                label={feedback.status}
                                size="small"
                                variant="outlined"
                                sx={{
                                  borderColor: statusColors[feedback.status],
                                  color: statusColors[feedback.status]
                            }}
                              />
                              {/* NEW: Verification Status */}
                              <Chip
                                label={verificationLabel}
                                size="small"
                                sx={{
                                  bgcolor: verificationColor,
                                  color: 'white',
                                  fontWeight: 'bold'
                                }}
                              />
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {feedback.description}
                            </Typography>
                            
                            {/* Media Attachments Indicators */}
                            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                              {feedback.screenshotUrl && (
                                <Chip 
                                  icon={<Screenshot />} 
                                  label="Screenshot" 
                                  size="small" 
                                  color="primary"
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(feedback.screenshotUrl, '_blank');
                                  }}
                                />
                              )}
                              {feedback.audioRecording && (
                                <Chip 
                                  icon={<Mic />} 
                                  label={`Audio ${Math.round((feedback.audioRecording.duration || 0) / 1000)}s`}
                                  size="small" 
                                  color="secondary"
                                  variant="outlined"
                                />
                              )}
                              {feedback.videoRecording && (
                                <Chip 
                                  icon={<Videocam />} 
                                  label={`Video ${Math.round((feedback.videoRecording.duration || 0) / 1000)}s`}
                                  size="small" 
                                  color="error"
                                  variant="outlined"
                                />
                              )}
                              {feedback.targetedElement && (
                                <Chip 
                                  icon={<MyLocation />} 
                                  label={feedback.targetedElement.tagName}
                                  size="small" 
                                  color="info"
                                  variant="outlined"
                                />
                              )}
                              {feedback.context && (
                                <MuiTooltip title={`${feedback.context.consoleErrors?.length || 0} errors, ${feedback.context.userJourney?.length || 0} actions`}>
                                  <Chip 
                                    icon={<DeviceHub />} 
                                    label="Context"
                                    size="small" 
                                    color={feedback.context.consoleErrors?.length ? 'warning' : 'success'}
                                    variant="outlined"
                                  />
                                </MuiTooltip>
                              )}
                              {feedback.testerLevel && (
                                <Chip 
                                  icon={<EmojiEvents />} 
                                  label={`Lvl ${feedback.testerLevel}`}
                                  size="small" 
                                  sx={{ bgcolor: '#9c27b0', color: 'white' }}
                                />
                              )}
                            </Box>
                            
                            {/* Screenshot Display */}
                            {feedback.screenshotUrl && (
                              <Box sx={{ mb: 2 }}>
                                <Box
                                  component="img"
                                  src={feedback.screenshotUrl}
                                  alt="Screenshot fra prototype tester"
                                  sx={{
                                    maxWidth: '100%',
                                    maxHeight: 200,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => window.open(feedback.screenshotUrl, '_blank')}
                                />
                              </Box>
                            )}
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                              <Typography variant="caption">
                                📊 {feedback.profession} • {feedback.component || 'Generell'}
                              </Typography>
                              <Rating value={feedback.rating} readOnly size="small" />
                              <Typography variant="caption">
                                🕒 {new Date(feedback.createdAt).toLocaleString('no-NO')}
                              </Typography>
                              {feedback.tags.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  {feedback.tags.slice(0, 3).map(tag => (
                                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                                  ))}
                                  {feedback.tags.length > 3 && (
                                    <Chip label={`+${feedback.tags.length - 3}`} size="small" variant="outlined" />
                                  )}
                                </Box>
                              )}
                            </Box>

                            {/* NEW: Verification Details */}
                            {feedback.verification && (
                              <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255, 140, 0, 0.05)', borderRadius: 1, border: '1px solid rgba(255, 140, 0, 0.2)' }}>
                                <Typography variant="subtitle2" gutterBottom sx={{ color: '#ff8c00', fontWeight: 600}}>
                                  🔍 Verification Status: </Typography>
                                
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                  <Chip
                                    label={`Automated Tests: ${feedback.verification?.automatedTests?.status || 'N/A'}`}
                                    size="small"
                                    sx={{
                                      bgcolor: feedback.verification?.automatedTests?.status === 'passed' ? '#4caf50' : 
                                               feedback.verification?.automatedTests?.status === 'failed' ? '#f44336' : '#757575',
                                      color: 'white'
                                }}
                                  />
                                  <Chip
                                    label={`Regression Tests: ${feedback.verification?.regressionTests?.status || 'N/A'}`}
                                    size="small"
                                    sx={{
                                      bgcolor: feedback.verification?.regressionTests?.status === 'passed' ? '#4caf50' : 
                                               feedback.verification?.regressionTests?.status === 'failed' ? '#f44336' : '#757575',
                                      color: 'white'
                                }}
                                  />
                                  <Chip
                                    label={`User Validation: ${feedback.verification?.userValidation?.status || 'N/A'}`}
                                    size="small"
                                    sx={{
                                      bgcolor: feedback.verification?.userValidation?.status === 'validated' ? '#4caf50' : 
                                               feedback.verification?.userValidation?.status === 'failed' ? '#f44336' : '#757575',
                                      color: 'white'
                                }}
                                  />
                                </Box>
                                
                                {/* Test Coverage */}
                                {(feedback.verification?.automatedTests?.coverage ?? 0) > 0 && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    Test Coverage: {feedback.verification?.automatedTests?.coverage}%
                                  </Typography>
                                )}
                                
                                {/* User Rating */}
                                {feedback.verification?.userValidation?.userResponse?.userRating && (
                                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      User Rating: </Typography>
                                    <Rating
                                      value={feedback.verification.userValidation.userResponse.userRating}
                                      readOnly
                                      size="small"
                                    />
                                  </Box>
                                )}

                                {/* User Comments */}
                                {feedback.verification?.userValidation?.userResponse?.userComments && (
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                                    "{feedback.verification.userValidation.userResponse.userComments}"
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                      }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {/* ✅ Se detaljer knapp */}
                          <IconButton 
                            aria-label="se detaljer"
                            onClick={() => {
                              setSelectedFeedback(feedback);
                              setDetailDialogOpen(true);
                          }}
                            sx={{ 
                              bgcolor: 'primary.main',
                              color: 'white','&:hover': { bgcolor: 'primary.dark' }
                          }}
                          >
                            <OpenInNew />
                          </IconButton>
                          {/* Status redigering */}
                          <IconButton
                            onClick={() => {
                              setSelectedFeedback(feedback);
                              setNewStatus(feedback.status);
                              setStatusDialogOpen(true);
                          }}
                            sx={{ color: '#ff8c00' }}
                          >
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < filteredAndSortedFeedback.length - 1 && <Divider sx={{ my: 1 }} />}
                  </React.Fragment>
                );
            })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Oppdater tilbakemelding status
        </DialogTitle>
        <DialogContent>
          {selectedFeedback && (
            <Box sx={{ mt: 2 }}>
              {/* User Information in Dialog */}
              <Box sx={{ 
                p: 2,
                bgcolor: 'rgba(255, 140, 0, 0.1)', 
                borderRadius: 1,
                mb: 3,
                border: '1px solid rgba(255, 140, 0, 0.3)'
            }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#ff8c00', mb: 1 }}>
                  📝 Tilbakemelding fra: </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Person sx={{ color: '#ff8c00' }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600}}>
                      {selectedFeedback.userName || selectedFeedback.userEmail || selectedFeedback.userId}
                    </Typography>
                    {selectedFeedback.userEmail && (
                      <Typography variant="body2" color="text.secondary">
                        📧 {selectedFeedback.userEmail}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      ID: {selectedFeedback.userId}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                {selectedFeedback.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {selectedFeedback.description}
              </Typography>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as FeedbackStatus)}
                  label="Status"
                >
                  <MenuItem value="open">Åpen</MenuItem>
                  <MenuItem value="in_progress">Under arbeid</MenuItem>
                  <MenuItem value="resolved">Løst</MenuItem>
                  <MenuItem value="closed">Lukket</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Edit sx={{ fontSize: 20 }} />
                  Admin notater (Rich Text)
                </Typography>
                
                {/* ✅ Rask mal-knapper inspirert av CreatorHub stil */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1,
                  mb: 2,
                  flexWrap: 'wrap',
                  p: 1,
                  bgcolor: 'grey.50',
                  borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ alignSelf: 'center', mr: 1, fontWeight: 600}}>
                    Maler: </Typography>
                  {adminNoteTemplates.map((template, index) => (
                    <Button
                      key={index}
                      size="small"
                      variant="outlined"
                      onClick={() => setAdminNotes(template.content)}
                      sx={{ 
                        fontSize: '11px',
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5 }}
                    >
                      {template.label}
                    </Button>
                  ))}
                </Box>

                <Box sx={{
                  '& .ql-editor': {
                    minHeight: '150px',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }, '& .ql-toolbar': {
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px'
                  }, '& .ql-container': {
                    borderBottomLeftRadius: '4px',
                    borderBottomRightRadius: '4px'
                  }
                }}>
                  <RichTextEditor
                    theme="snow"
                    value={adminNotes}
                    onChange={setAdminNotes}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Skriv detaljerte admin notater her... Bruk malene ovenfor for rask start, eller skriv egne notater med full formatering."
                  />
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                  💡 Tips: Bruk malene for konsistent dokumentasjon. Rich text editor støtter formatering, lister, lenker og mer.
                </Typography>
              </Box>

              {/* Trådet samtale — admin svarer testeren direkte i tråden */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#ff8c00' }}>
                  💬 Samtale med testeren
                </Typography>
                <FeedbackConversation feedbackId={selectedFeedback.id} locale="no" viewer="admin" />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setStatusDialogOpen(false)}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="primary"
            loading={updateStatusMutation.isPending}
            onClick={handleStatusUpdate}
            disabled={updateStatusMutation.isPending || !newStatus}
          >
            {updateStatusMutation.isPending ? 'Oppdaterer...' : 'Oppdater'}
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* ✅ NY: Detaljert Feedback Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
    }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Comment sx={{ fontSize: 28 }} />
            <Typography variant="h6" sx={{ color: themeColors.primary }}>
              Detaljert Feedback Visning
            </Typography>
          </Box>
          <IconButton
            onClick={() => setDetailDialogOpen(false)}
            sx={{ color: 'white' }}
          >
            {theming.getThemedIcon('close')}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedFeedback && (
            <Box>
              {/* Bruker informasjon - Prominent */}
              <Card sx={{ mb: 3, bgcolor: 'rgba(255, 140, 0, 0.05)', ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Person sx={{ fontSize: 32, color: '#ff8c00' }} />
                    <Box>
                      <Typography variant="h6" sx={{ color: '#ff8c00' }}>
                        {selectedFeedback.userName || selectedFeedback.userEmail || selectedFeedback.userId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedFeedback.userEmail && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {theming.getThemedIcon('email')} {selectedFeedback.userEmail}
                          </Box>
                        )}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip icon={<Category />} label={`${selectedFeedback.profession} - ${selectedFeedback.dashboardType}`} />
                    <Chip label={new Date(selectedFeedback.createdAt).toLocaleDateString('no-NO')} />
                  </Box>
                </CardContent>
              </Card>

              {/* Feedback detaljer */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        {(() => {
                          const FeedbackIcon = feedbackTypeIcons[selectedFeedback.feedbackType] || Comment;
                          return (
                            <FeedbackIcon 
                              sx={{ 
                                fontSize: 48, 
                                color: feedbackTypeColors[selectedFeedback.feedbackType] 
                          }}
                            />
                          );
                      })()}
                        <Box>
                          <Typography variant="h4" gutterBottom sx={{ color: themeColors.primary }}>
                            {selectedFeedback.title}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                              label={selectedFeedback.feedbackType}
                              sx={{ 
                                bgcolor: feedbackTypeColors[selectedFeedback.feedbackType],
                                color: 'white'
                          }}
                            />
                            <Chip
                              label={selectedFeedback.priority}
                              sx={{ 
                                bgcolor: priorityColors[selectedFeedback.priority],
                                color: 'white'
                          }}
                            />
                            <Chip
                              label={selectedFeedback.status}
                              variant="outlined"
                              sx={{ 
                                borderColor: statusColors[selectedFeedback.status],
                                color: statusColors[selectedFeedback.status]
                          }}
                            />
                          </Box>
                        </Box>
                      </Box>

                      <Divider sx={{ mb: 3 }} />

                      <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                        Beskrivelse
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
                        {selectedFeedback.description}
                      </Typography>

                      {selectedFeedback.component && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                            Berørt komponent
                          </Typography>
                          <Chip 
                            label={selectedFeedback.component}
                            variant="outlined" 
                            sx={{ fontSize: '0.9rem', p: 1 }}
                          />
                        </Box>
                      )}

                      {selectedFeedback.tags.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                            Tags
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {selectedFeedback.tags.map(tag => (
                              <Chip key={tag} label={tag} variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                        <Star sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Rating & Info
                      </Typography>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Bruker rating
                        </Typography>
                        <Rating value={selectedFeedback.rating} readOnly size="large" />
                        <Typography variant="h6" sx={{ mt: 1, color: themeColors.primary }}>
                          {selectedFeedback.rating}/5
                        </Typography>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Anonymt
                      </Typography>
                      <Typography variant="body1">
                        {selectedFeedback.isAnonymous ? 'Ja' : 'Nei'}
                      </Typography>
                    </CardContent>
                  </Card>

                  {/* Screenshot hvis tilgjengelig */}
                  {selectedFeedback.screenshotUrl && (
                    <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                          <Screenshot sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Screenshot
                        </Typography>
                        <Box
                          component="img"
                          src={selectedFeedback.screenshotUrl}
                          alt="Screenshot fra prototype tester"
                          sx={{
                            width: '100%',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: 'pointer'
                          }}
                          onClick={() => window.open(selectedFeedback.screenshotUrl, '_blank')}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Klikk for å åpne i full størrelse
                        </Typography>
                      </CardContent>
                    </Card>
                  )}

                  {/* Audio Recording */}
                  {selectedFeedback.audioRecording && (
                    <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                          <Mic sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Audio Recording
                        </Typography>
                        {selectedFeedback.audioRecording.blob && (
                          <audio controls style={{ width: '100%' }}>
                            <source src={selectedFeedback.audioRecording.blob} type={selectedFeedback.audioRecording.mimeType} />
                          </audio>
                        )}
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip size="small" label={`Duration: ${Math.round(selectedFeedback.audioRecording.duration / 1000)}s`} />
                          <Chip size="small" label={selectedFeedback.audioRecording.mimeType} />
                        </Box>
                        {selectedFeedback.audioRecording.transcription && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">Transcription:</Typography>
                            <Typography variant="body2">
                              {selectedFeedback.audioRecording.transcription}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Video Recording */}
                  {selectedFeedback.videoRecording && (
                    <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                          <Videocam sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Screen Recording
                        </Typography>
                        {selectedFeedback.videoRecording.blob && (
                          <video controls style={{ width: '100%', borderRadius: 4 }}>
                            <source src={selectedFeedback.videoRecording.blob} type={selectedFeedback.videoRecording.mimeType} />
                          </video>
                        )}
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip size="small" label={`Duration: ${Math.round(selectedFeedback.videoRecording.duration / 1000)}s`} />
                          <Chip size="small" label={`${selectedFeedback.videoRecording.width}x${selectedFeedback.videoRecording.height}`} />
                        </Box>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tester Gamification Stats */}
                  {(selectedFeedback.testerXP || selectedFeedback.testerLevel) && (
                    <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" gutterBottom sx={{ color: themeColors.primary }}>
                          <EmojiEvents sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Tester Stats
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          {selectedFeedback.testerLevel && (
                            <Box sx={{ textAlign: 'center' }}>
                              <Avatar sx={{ bgcolor: '#9c27b0', width: 48, height: 48, mx: 'auto' }}>
                                {selectedFeedback.testerLevel}
                              </Avatar>
                              <Typography variant="caption">Level</Typography>
                            </Box>
                          )}
                          {selectedFeedback.testerXP && (
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                XP: {selectedFeedback.testerXP.toLocaleString()}
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={Math.min(100, (selectedFeedback.testerXP % 1000) / 10)} 
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                            </Box>
                          )}
                        </Box>
                        {selectedFeedback.testerBadges && selectedFeedback.testerBadges.length > 0 && (
                          <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {selectedFeedback.testerBadges.map(badge => (
                              <Chip key={badge} label={badge} size="small" color="secondary" />
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </Grid>

                {/* Full Width Enhanced Data Section */}
                <Grid item xs={12}>
                  {/* Targeted Element */}
                  {selectedFeedback.targetedElement && (
                    <Accordion sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MyLocation color="primary" />
                          <Typography variant="subtitle1">Targeted Element</Typography>
                          <Chip size="small" label={selectedFeedback.targetedElement.tagName} />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>CSS Selector</Typography>
                            <Paper sx={{ p: 1, bgcolor: 'grey.900', color: 'lightgreen', fontFamily: 'monospace', fontSize: 12, overflow: 'auto' }}>
                              {selectedFeedback.targetedElement.selector}
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>XPath</Typography>
                            <Paper sx={{ p: 1, bgcolor: 'grey.900', color: 'lightblue', fontFamily: 'monospace', fontSize: 12, overflow: 'auto' }}>
                              {selectedFeedback.targetedElement.xpath}
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>Position & Size</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip size="small" label={`Top: ${Math.round(selectedFeedback.targetedElement.rect.top)}px`} />
                              <Chip size="small" label={`Left: ${Math.round(selectedFeedback.targetedElement.rect.left)}px`} />
                              <Chip size="small" label={`${Math.round(selectedFeedback.targetedElement.rect.width)} x ${Math.round(selectedFeedback.targetedElement.rect.height)}`} />
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom>Computed Style</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip size="small" label={`Color: ${selectedFeedback.targetedElement.computedStyle.color}`} />
                              <Chip size="small" label={`BG: ${selectedFeedback.targetedElement.computedStyle.backgroundColor}`} />
                              <Chip size="small" label={selectedFeedback.targetedElement.computedStyle.fontSize} />
                            </Box>
                          </Grid>
                          {selectedFeedback.targetedElement.textContent && (
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" gutterBottom>Text Content</Typography>
                              <Paper sx={{ p: 1, bgcolor: 'grey.100', fontStyle: 'italic' }}>
                                "{selectedFeedback.targetedElement.textContent}"
                              </Paper>
                            </Grid>
                          )}
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom>Parent Chain</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {selectedFeedback.targetedElement.parentChain.map((parent, i) => (
                                <React.Fragment key={i}>
                                  <Chip size="small" variant="outlined" label={parent} />
                                  {i < selectedFeedback.targetedElement!.parentChain.length - 1 && (
                                    <Typography color="text.secondary">&gt;</Typography>
                                  )}
                                </React.Fragment>
                              ))}
                            </Box>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Browser Context */}
                  {selectedFeedback.context && (
                    <Accordion sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DeviceHub color="info" />
                          <Typography variant="subtitle1">Browser Context</Typography>
                          <Chip size="small" label={selectedFeedback.context.browser.platform} />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" gutterBottom>Device Info</Typography>
                            <List dense>
                              <ListItem>
                                <ListItemText primary="Platform" secondary={selectedFeedback.context.browser.platform} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="Viewport" secondary={`${selectedFeedback.context.browser.viewport.width} x ${selectedFeedback.context.browser.viewport.height}`} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="Screen" secondary={`${selectedFeedback.context.browser.screenSize.width} x ${selectedFeedback.context.browser.screenSize.height}`} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="DPR" secondary={selectedFeedback.context.browser.devicePixelRatio} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="Touch" secondary={selectedFeedback.context.browser.touchSupported ? 'Yes' : 'No'} />
                              </ListItem>
                            </List>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" gutterBottom>
                              <Speed sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                              Performance Metrics
                            </Typography>
                            <List dense>
                              <ListItem>
                                <ListItemText primary="Load Time" secondary={`${selectedFeedback.context.performance.loadTime}ms`} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="FCP" secondary={`${Math.round(selectedFeedback.context.performance.firstContentfulPaint)}ms`} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="LCP" secondary={`${Math.round(selectedFeedback.context.performance.largestContentfulPaint)}ms`} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="FPS" secondary={selectedFeedback.context.performance.fps} />
                              </ListItem>
                              {selectedFeedback.context.performance.memoryUsage && (
                                <ListItem>
                                  <ListItemText primary="Memory" secondary={`${Math.round(selectedFeedback.context.performance.memoryUsage / 1024 / 1024)}MB`} />
                                </ListItem>
                              )}
                            </List>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" gutterBottom>Session Info</Typography>
                            <List dense>
                              <ListItem>
                                <ListItemText primary="URL" secondary={selectedFeedback.context.currentUrl} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="Component" secondary={selectedFeedback.context.currentComponent || 'N/A'} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="Session Duration" secondary={`${Math.round(selectedFeedback.context.sessionDuration / 1000 / 60)}min`} />
                              </ListItem>
                              <ListItem>
                                <ListItemText primary="Timezone" secondary={selectedFeedback.context.browser.timezone} />
                              </ListItem>
                            </List>
                          </Grid>
                        </Grid>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          User Agent: {selectedFeedback.context.browser.userAgent}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Console Errors */}
                  {selectedFeedback.context?.consoleErrors && selectedFeedback.context.consoleErrors.length > 0 && (
                    <Accordion sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ErrorIcon color="error" />
                          <Typography variant="subtitle1">Console Errors</Typography>
                          <Chip size="small" color="error" label={selectedFeedback.context.consoleErrors.length} />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense>
                          {selectedFeedback.context.consoleErrors.map((error, i) => (
                            <ListItem key={i} sx={{ bgcolor: 'error.dark', color: 'white', borderRadius: 1, mb: 1 }}>
                              <ListItemText
                                primary={error.message}
                                secondary={
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                    {error.source}:{error.lineno}:{error.colno} - {new Date(error.timestamp).toLocaleTimeString()}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* User Journey */}
                  {selectedFeedback.context?.userJourney && selectedFeedback.context.userJourney.length > 0 && (
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Timeline color="secondary" />
                          <Typography variant="subtitle1">User Journey</Typography>
                          <Chip size="small" label={`${selectedFeedback.context.userJourney.length} steps`} />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                          {selectedFeedback.context.userJourney.slice(-20).map((step, i) => (
                            <ListItem key={i}>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip 
                                      size="small" 
                                      label={step.type}
                                      color={
                                        step.type === 'click' ? 'primary' :
                                        step.type === 'input' ? 'secondary' :
                                        step.type === 'navigation' ? 'info' :
                                        step.type === 'error' ? 'error' : 'default'
                                      }
                                    />
                                    {step.target && <Typography variant="body2">{step.target}</Typography>}
                                  </Box>
                                }
                                secondary={
                                  <Typography variant="caption" color="text.secondary">
                                    {step.value && `"${step.value}" - `}
                                    {new Date(step.timestamp).toLocaleTimeString()}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
          <AdminButton
            tone="ghost"
            onClick={() => setDetailDialogOpen(false)}
          >
            Lukk
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={() => {
              if (selectedFeedback) {
                setDetailDialogOpen(false);
                setNewStatus(selectedFeedback.status);
                setAdminNotes('');
                setStatusDialogOpen(true);
            }
          }}
          >
            Administrer Status & Notater
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
  );
}
