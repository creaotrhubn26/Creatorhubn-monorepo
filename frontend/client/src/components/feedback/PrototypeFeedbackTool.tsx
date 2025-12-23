/**
 * PrototypeFeedbackTool - Enhanced Prototype Testing Feedback System
 * 
 * Features:
 * 1. Screenshot capture with annotation
 * 2. Audio recording with transcription
 * 3. Video/screen recording
 * 4. Context auto-detection (browser, performance, errors, journey)
 * 5. AI-powered title/tag suggestions
 * 6. Feedback history with status tracking
 * 7. Quick feedback mode (emoji reactions)
 * 8. Element targeting (click to highlight)
 * 9. Offline support with sync queue
 * 10. Analytics dashboard with gamification
 * 11. Keyboard shortcuts (Ctrl+Shift+F)
 * 12. Mobile/tablet optimized
 */

import { useTheming } from '../../utils/theming-helper';
import { useAuth } from '../../hooks/useAuth';
import React, { useState, useEffect, useRef } from 'react';

// Import profession system hooks and utilities
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Box,
  Typography,
  Button,
  TextField,
  Rating,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Fab,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid,
  Alert,
  LinearProgress,
  Badge,
  Tooltip,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Paper,
  useMediaQuery,
  useTheme,
  Autocomplete,
} from '@mui/material';
import {
  Feedback,
  Close,
  Send,
  BugReport,
  Lightbulb,
  ThumbDown,
  Comment,
  Screenshot,
  Mic,
  MicOff,
  CheckCircle,
  History,
  EmojiEvents,
  Leaderboard,
  Psychology,
  MyLocation,
  Videocam,
  VideocamOff,
  Edit,
  ThumbUp,
  SentimentVeryDissatisfied,
  SentimentDissatisfied,
  SentimentNeutral,
  SentimentSatisfied,
  SentimentVerySatisfied,
  Info,
  CloudUpload,
  WifiOff,
  Star,
  TrendingUp,
  LocalFireDepartment,
  MilitaryTech,
} from '@mui/icons-material';
import { PrototypeTesterIcon } from '../icons/PrototypeTesterIcon';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useSnackbar } from 'notistack';

// Import services
import {
  screenshotService,
  audioRecordingService,
  videoRecordingService,
  contextDetectionService,
  ScreenshotResult,
  AudioRecordingResult,
  VideoRecordingResult,
  FeedbackContext,
} from './services/feedbackCaptureService';
import { feedbackAIService, TagSuggestion, TitleSuggestion, FeedbackTemplate } from './services/feedbackAIService';
import { feedbackHistoryService, FeedbackItem } from './services/feedbackHistoryService';
import { elementTargetingService, TargetedElement } from './services/elementTargetingService';
import { feedbackAnalyticsService, TesterStats, LeaderboardEntry } from './services/feedbackAnalyticsService';

// ============================================================================
// Types
// ============================================================================

interface FeedbackData {
  id?: string;
  userId: string;
  profession: string;
  feedbackType: 'bug' | 'feature' | 'usability' | 'general';
  title: string;
  description: string;
  rating: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  screenshot?: string;
  audioRecording?: string;
  videoRecording?: string;
  targetedElement?: TargetedElement;
  context?: FeedbackContext;
  tags: string[];
  isAnonymous: boolean;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
}

interface PrototypeFeedbackToolProps {
  profession?: string;
  component?: string;
  visible?: boolean;
  onClose?: () => void;
  forceShow?: boolean;
  /** Enable community-specific context awareness */
  communityContext?: boolean;
  /** Current community component name for auto-tagging */
  communityComponent?: keyof typeof communityComponentContext;
}

type TabValue = 'form' | 'history' | 'analytics' | 'quick';

// ============================================================================
// Constants
// ============================================================================

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', icon: BugReport, color: '#f44336' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: '#ff9800' },
  { value: 'usability', label: 'Usability Issue', icon: ThumbDown, color: '#9c27b0' },
  { value: 'general', label: 'General Feedback', icon: Comment, color: '#2196f3' },
];

const priorityLevels = [
  { value: 'low', label: 'Low', color: '#4caf50' },
  { value: 'medium', label: 'Medium', color: '#ff9800' },
  { value: 'high', label: 'High', color: '#f44336' },
  { value: 'critical', label: 'Critical', color: '#9c27b0' },
];

const quickReactions = [
  { value: 1, icon: SentimentVeryDissatisfied, label: 'Very Unhappy', color: '#f44336' },
  { value: 2, icon: SentimentDissatisfied, label: 'Unhappy', color: '#ff9800' },
  { value: 3, icon: SentimentNeutral, label: 'Neutral', color: '#ffc107' },
  { value: 4, icon: SentimentSatisfied, label: 'Happy', color: '#8bc34a' },
  { value: 5, icon: SentimentVerySatisfied, label: 'Very Happy', color: '#4caf50' },
];

const availableTags = [
  'UI/UX', 'Performance', 'Navigation', 'Mobile', 'Desktop', 'Google Drive', 'Tutorial', 'Dashboard', 'Project Management', 'Camera Detection', 'Equipment', 'Client Management', 'Settings', 'Virtual Studio', '3D Rendering', 'Lighting', 'Animation', 'Export',
];

// Community-specific tags for context-aware feedback
const communityTags = [
  'Community', 'Chat', 'Messaging', 'Direct Messages', 'Channels', 'Threads', 'Reactions', 'Mentions', 
  'Badges', 'Gamification', 'Voting', 'Polls', 'Mentor', 'Questions', 'Search', 'Notifications',
  'User Profile', 'Block/Mute', 'File Sharing', 'Pinned Messages', 'Onboarding', 'Reports',
];

// Community component context mapping
const communityComponentContext: Record<string, { name: string; description: string; suggestedTags: string[] }> = {
  'CommunityPage': { 
    name: 'Community Hub', 
    description: 'Main community page with channels and messaging',
    suggestedTags: ['Community', 'Chat', 'Channels', 'Navigation']
  },
  'CommunityHub': { 
    name: 'Community Hub', 
    description: 'Community hub overview',
    suggestedTags: ['Community', 'Navigation', 'UI/UX']
  },
  'VotingBoard': { 
    name: 'Voting & Polls', 
    description: 'Community voting and polling system',
    suggestedTags: ['Voting', 'Polls', 'Community']
  },
  'MentorDashboard': { 
    name: 'Mentor Dashboard', 
    description: 'Mentor management and Q&A system',
    suggestedTags: ['Mentor', 'Questions', 'Community']
  },
  'UserProfileModal': { 
    name: 'User Profile', 
    description: 'User profile viewing and actions',
    suggestedTags: ['User Profile', 'Community', 'Block/Mute']
  },
  'CommunityNotificationFeed': { 
    name: 'Notification Feed', 
    description: 'Community notifications and alerts',
    suggestedTags: ['Notifications', 'Community', 'UI/UX']
  },
  'BadgeNotification': { 
    name: 'Badge Notifications', 
    description: 'Gamification badge awards',
    suggestedTags: ['Badges', 'Gamification', 'Notifications']
  },
  'ThreadViewDialog': { 
    name: 'Thread View', 
    description: 'Message thread viewing',
    suggestedTags: ['Threads', 'Chat', 'Community']
  },
  'AdvancedSearchDialog': { 
    name: 'Advanced Search', 
    description: 'Community search functionality',
    suggestedTags: ['Search', 'Community', 'Navigation']
  },
  'CommunityFileAttachment': { 
    name: 'File Attachments', 
    description: 'File sharing in community',
    suggestedTags: ['File Sharing', 'Community', 'UI/UX']
  },
  'PinnedMessagesBar': { 
    name: 'Pinned Messages', 
    description: 'Pinned message management',
    suggestedTags: ['Pinned Messages', 'Chat', 'Community']
  },
  'ShareToCommunityDialog': { 
    name: 'Share to Community', 
    description: 'Content sharing dialog',
    suggestedTags: ['File Sharing', 'Community', 'UI/UX']
  },
  'WelcomeOnboardingDialog': { 
    name: 'Welcome Onboarding', 
    description: 'New user onboarding flow',
    suggestedTags: ['Onboarding', 'Community', 'UI/UX']
  },
  'ReportDialog': { 
    name: 'Report Content', 
    description: 'Content reporting system',
    suggestedTags: ['Reports', 'Community', 'Moderation']
  },
  'BecomeMentorDialog': { 
    name: 'Become a Mentor', 
    description: 'Mentor application flow',
    suggestedTags: ['Mentor', 'Community', 'Onboarding']
  },
};

// Helper to detect if we're in community context
const detectCommunityContext = (componentName?: string): boolean => {
  if (componentName && communityComponentContext[componentName]) return true;
  
  // Check URL for community paths
  const currentPath = window.location.pathname.toLowerCase();
  return currentPath.includes('community') || 
         currentPath.includes('chat') || 
         currentPath.includes('messaging');
};

// ============================================================================
// Main Component
// ============================================================================

export default function PrototypeFeedbackTool({
  profession: professionProp,
  component,
  visible = false,
  onClose,
  forceShow = false,
  communityContext = false,
  communityComponent,
}: PrototypeFeedbackToolProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Use dynamic profession system
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  
  // Use profession configs hook for additional profession data
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  
  // Use profession adapter for profession-specific adapters
  const professionAdapter = useProfessionAdapter();
  
  // Get current profession (from prop or dynamic system)
  const currentUserProfession = professionAdapter.profession || professionProp || 'photographer';
  const profession = currentUserProfession;
  
  // Get profession icon
  const professionIcon = getProfessionIcon(profession);
  
  // Get profession config
  const professionConfig = professionConfigs?.[profession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[profession] || professionConfig;
  
  // Get profession color from dynamic system
  const professionColor = getUserProfessionColor(profession) || '#FF6B35';

  // Auth check
  const { user, isPrototypeTester, isAdmin } = useAuth();
  const theming = useTheming(profession);

  // State
  const [isOpen, setIsOpen] = useState(visible);
  const [activeTab, setActiveTab] = useState<TabValue>('form');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Community context detection
  const isCommunityContext = communityContext || detectCommunityContext(component);
  const communityComponentInfo = communityComponent ? communityComponentContext[communityComponent] : 
    (component && communityComponentContext[component as keyof typeof communityComponentContext]) || null;
  
  // Combined tags based on context
  const contextualTags = isCommunityContext 
    ? [...availableTags, ...communityTags] 
    : availableTags;

  // Recording states
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [audioRecording, setAudioRecording] = useState<AudioRecordingResult | null>(null);
  const [videoRecording, setVideoRecording] = useState<VideoRecordingResult | null>(null);
  const [screenshot, setScreenshot] = useState<ScreenshotResult | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Element targeting
  const [, setIsTargeting] = useState(false);
  const [targetedElement, setTargetedElement] = useState<TargetedElement | null>(null);

  // AI suggestions
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestion[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([]);
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);

  // Context
  const [capturedContext, setCapturedContext] = useState<FeedbackContext | null>(null);

  // Draft
  const [draftId] = useState(`draft_${Date.now()}`);
  const [hasDraft, setHasDraft] = useState(false);

  // Form data
  const [formData, setFormData] = useState<Partial<FeedbackData>>({
    userId: user?.id || 'anonymous',
    profession,
    feedbackType: 'general',
    title: '',
    description: '',
    rating: 5,
    priority: 'medium',
    component: component || '',
    tags: [],
    isAnonymous: false,
    status: 'open',
  });

  // Refs
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Don't render if not a prototype tester
  const shouldShow = forceShow || isPrototypeTester || isAdmin;
  if (!shouldShow) return null;

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  // Update userId when user changes
  useEffect(() => {
    if (user?.id) {
      setFormData(prev => ({ ...prev, userId: user.id }));
    }
  }, [user?.id]);

  // Auto-add community context tags when in community mode
  useEffect(() => {
    if (isCommunityContext && communityComponentInfo && isOpen) {
      setFormData(prev => {
        const existingTags = prev.tags || [];
        const newTags = communityComponentInfo.suggestedTags.filter(t => !existingTags.includes(t));
        if (newTags.length > 0) {
          return {
            ...prev,
            component: prev.component || communityComponentInfo.name,
            tags: [...existingTags, ...newTags],
          };
        }
        return prev;
      });
    }
  }, [isCommunityContext, communityComponentInfo, isOpen]);

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcut (Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check for existing draft
  useEffect(() => {
    const latestDraft = feedbackHistoryService.getLatestDraft();
    if (latestDraft && latestDraft.data.title) {
      setHasDraft(true);
    }
  }, []);

  // Auto-save draft (debounced)
  useEffect(() => {
    if (formData.title || formData.description) {
      const timeout = setTimeout(() => {
        feedbackHistoryService.saveDraft(draftId, formData as any, true);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [formData, draftId]);

  // Get templates when feedback type changes
  useEffect(() => {
    const typeTemplates = feedbackAIService.getTemplates(formData.feedbackType || 'general');
    setTemplates(typeTemplates);
  }, [formData.feedbackType]);

  // AI suggestions when description changes
  useEffect(() => {
    if (formData.description && formData.description.length > 20) {
      const tags = feedbackAIService.suggestTags(formData.description);
      setTagSuggestions(tags.slice(0, 5));

      const titles = feedbackAIService.suggestTitles(formData.description, formData.feedbackType || 'general');
      setTitleSuggestions(titles);

      // Auto-suggest priority
      const suggestedPriority = feedbackAIService.suggestPriority(formData.description, formData.feedbackType || 'general');
      if (suggestedPriority !== formData.priority) {
        // Don't auto-change, just show suggestion
      }
    }
  }, [formData.description, formData.feedbackType]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedback: Partial<FeedbackData>) => {
      if (!isOnline) {
        // Queue for offline
        feedbackHistoryService.queueForOffline(feedback as any);
        return { offline: true };
      }

      return apiRequest('/api/prototype/feedback', {
        method: 'POST',
        body: JSON.stringify({
          ...feedback,
          context: capturedContext,
          targetedElement,
          createdAt: new Date().toISOString(),
        }),
      });
    },
    onSuccess: () => {
      // Reset form
      setFormData({
        userId: user?.id || 'anonymous',
        profession,
        feedbackType: 'general',
        title: ', ',
        description: ', ',
        rating: 5,
        priority: 'medium',
        component: component || '',
        tags: [],
        isAnonymous: false,
        status: 'open',
      });

      // Clear captures
      setScreenshot(null);
      setAudioRecording(null);
      setVideoRecording(null);
      setTargetedElement(null);
      setCapturedContext(null);

      // Delete draft
      feedbackHistoryService.deleteDraft(draftId);
      setHasDraft(false);

      setIsOpen(false);
      
      // Show success notification using notistack
      enqueueSnackbar(
        isOnline ? 'Thank you! Your feedback has been submitted. ✅' : 'Feedback queued - will sync when online 📤',
        { 
          variant: 'success',
          autoHideDuration: 4000,
        }
      );

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/prototype/feedback'] });
    },
  });

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  // Query existing feedback for this component (for showing similar issues)
  useQuery<FeedbackItem[]>({
    queryKey: ['/api/prototype/feedback', component],
    queryFn: () => apiRequest(`/api/prototype/feedback?component=${component}`),
    enabled: !!component && isOpen,
  });

  const { data: userHistory = [] } = useQuery<FeedbackItem[]>({
    queryKey: ['/api/prototype/feedback/user', user?.id],
    queryFn: () => feedbackHistoryService.fetchHistory(user?.id || ''),
    enabled: !!user?.id && isOpen && activeTab === 'history',
  });

  const { data: testerStats } = useQuery<TesterStats>({
    queryKey: ['/api/prototype/analytics/stats', user?.id],
    queryFn: () => feedbackAnalyticsService.fetchStats(user?.id || ''),
    enabled: !!user?.id && isOpen && activeTab === 'analytics',
  });

  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/prototype/analytics/leaderboard'],
    queryFn: () => feedbackAnalyticsService.fetchLeaderboard('all', 10),
    enabled: isOpen && activeTab === 'analytics',
  });

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleSubmit = () => {
    if (!formData.title?.trim() || !formData.description?.trim()) return;
    submitFeedbackMutation.mutate(formData);
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = formData.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setFormData(prev => ({ ...prev, tags: newTags }));
  };

  const handleScreenshot = async () => {
    try {
      setIsOpen(false); // Hide dialog temporarily
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for dialog to hide

      const result = await screenshotService.capture();
      setScreenshot(result);

      setIsOpen(true); // Show dialog again
    } catch (error) {
      console.error('Screenshot failed: ', error);
      setIsOpen(true);
    }
  };

  const handleStartAudioRecording = async () => {
    try {
      await audioRecordingService.start();
      setIsRecordingAudio(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Audio recording failed:', error);
    }
  };

  const handleStopAudioRecording = async () => {
    try {
      const result = await audioRecordingService.stop();
      setAudioRecording(result);
      setIsRecordingAudio(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    } catch (error) {
      console.error('Stop audio recording failed:', error);
    }
  };

  const handleStartVideoRecording = async () => {
    try {
      await videoRecordingService.startScreenRecording({ audio: true });
      setIsRecordingVideo(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Video recording failed:', error);
    }
  };

  const handleStopVideoRecording = async () => {
    try {
      const result = await videoRecordingService.stop();
      if (result) {
        setVideoRecording(result);
      }
      setIsRecordingVideo(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    } catch (error) {
      console.error('Stop video recording failed:', error);
    }
  };

  const handleStartTargeting = () => {
    setIsOpen(false);
    setIsTargeting(true);

    elementTargetingService.startHighlightMode((element) => {
      setTargetedElement(element);
      setIsTargeting(false);
      setIsOpen(true);
    });
  };

  const handleCaptureContext = () => {
    const context = contextDetectionService.getFullContext();
    setCapturedContext(context);
  };

  const handleLoadDraft = () => {
    const draft = feedbackHistoryService.getLatestDraft();
    if (draft) {
      setFormData(prev => ({ ...prev, ...draft.data }));
      setHasDraft(false);
    }
  };

  const handleApplyTemplate = (template: FeedbackTemplate) => {
    const { title, description, tags } = feedbackAIService.applyTemplate(template);
    setFormData(prev => ({ ...prev, title, description, tags }));
  };

  const handleQuickReaction = async (rating: number) => {
    const quickFeedback: Partial<FeedbackData> = {
      userId: user?.id || 'anonymous',
      profession,
      feedbackType: 'general',
      title: `Quick Feedback: ${quickReactions.find(r => r.value === rating)?.label}`,
      description: `Quick reaction feedback from ${component || 'Unknown Component'}`,
      rating,
      priority: 'low',
      component: component || ', ',
      tags: [],
      isAnonymous: false,
      status: 'open',
    };

    submitFeedbackMutation.mutate(quickFeedback);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --------------------------------------------------------------------------
  // Render Helpers
  // --------------------------------------------------------------------------

  const renderFormTab = () => (
    <Box sx={{ p: 2 }}>
      {/* Draft Alert */}
      {hasDraft && (
        <Alert
          severity="info"
          action={
            <Button size="small" onClick={handleLoadDraft}>
              Load Draft
            </Button>
          }
          sx={{ mb: 2 }}
        >
          You have an unsaved draft
        </Alert>
      )}

      {submitFeedbackMutation.isPending && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={2}>
        {/* Feedback Type */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Feedback Type
          </Typography>
          <Grid container spacing={1}>
            {feedbackTypes.map(type => (
              <Grid item xs={6} sm={3} key={type.value}>
                <Chip
                  icon={<type.icon />}
                  label={type.label}
                  variant={formData.feedbackType === type.value ? 'filled' : 'outlined'}
                  onClick={() => setFormData(prev => ({ ...prev, feedbackType: type.value as any }))}
                  sx={{
                    width: '100%',
                    backgroundColor: formData.feedbackType === type.value ? type.color : 'transparent',
                    color: formData.feedbackType === type.value ? 'white' : type.color,
                    borderColor: type.color,
                    '&:hover': { backgroundColor: type.color, color: 'white' }
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Templates */}
        {templates.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Templates
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {templates.map(template => (
                <Chip
                  key={template.id}
                  label={template.title.replace('[', ', ').replace(']','...')}
                  size="small"
                  variant="outlined"
                  onClick={() => handleApplyTemplate(template)}
                />
              ))}
            </Box>
          </Grid>
        )}

        {/* Title with AI suggestions */}
        <Grid item xs={12}>
          <Autocomplete
            freeSolo
            options={titleSuggestions.map(s => s.title)}
            value={formData.title || ', '}
            onInputChange={(_, value) => setFormData(prev => ({ ...prev, title: value }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Title"
                placeholder="Briefly describe the issue or suggestion..."
                required
                InputProps={{
                  ...params.InputProps,
                  endAdornment: titleSuggestions.length > 0 ? (
                    <Tooltip title="AI suggestions available">
                      <Psychology sx={{ color: 'primary.main', mr: 1 }} />
                    </Tooltip>
                  ) : null}}
              />
            )}
          />
        </Grid>

        {/* Description */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Detailed Description"
            value={formData.description || ''}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the issue, what you expected, and what actually happened..."
            required
          />
        </Grid>

        {/* AI Tag Suggestions */}
        {tagSuggestions.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Psychology fontSize="small" /> Suggested tags:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              {tagSuggestions.map(suggestion => (
                <Chip
                  key={suggestion.tag}
                  label={suggestion.tag}
                  size="small"
                  variant={formData.tags?.includes(suggestion.tag) ? 'filled' : 'outlined'}
                  onClick={() => handleTagToggle(suggestion.tag)}
                  color="primary"
                />
              ))}
            </Box>
          </Grid>
        )}

        {/* Rating & Priority */}
        <Grid item xs={12} sm={6}>
          <Typography variant="subtitle2" gutterBottom>
            Satisfaction
          </Typography>
          <Rating
            value={formData.rating || 5}
            onChange={(_, value) => setFormData(prev => ({ ...prev, rating: value || 5 }))}
            size="large"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.priority || 'medium'}
              onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
              label="Priority"
            >
              {priorityLevels.map(level => (
                <MenuItem key={level.value} value={level.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: level.color }} />
                    {level.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Media Capture */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Attachments
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant={screenshot ? 'contained' : 'outlined'}
              startIcon={<Screenshot />}
              onClick={handleScreenshot}
              size="small"
              color={screenshot ? 'success' : 'primary'}
            >
              {screenshot ? 'Screenshot Captured' : 'Screenshot'}
            </Button>

            <Button
              variant={isRecordingAudio || audioRecording ? 'contained' : 'outlined'}
              startIcon={isRecordingAudio ? <MicOff /> : <Mic />}
              onClick={isRecordingAudio ? handleStopAudioRecording : handleStartAudioRecording}
              size="small"
              color={isRecordingAudio ? 'error' : audioRecording ? 'success' : 'primary'}
            >
              {isRecordingAudio ? `Stop (${formatTime(recordingTime)})` : audioRecording ? 'Audio Recorded' : 'Record Audio'}
            </Button>

            <Button
              variant={isRecordingVideo || videoRecording ? 'contained' : 'outlined'}
              startIcon={isRecordingVideo ? <VideocamOff /> : <Videocam />}
              onClick={isRecordingVideo ? handleStopVideoRecording : handleStartVideoRecording}
              size="small"
              color={isRecordingVideo ? 'error' : videoRecording ? 'success' : 'primary'}
            >
              {isRecordingVideo ? `Stop (${formatTime(recordingTime)})` : videoRecording ? 'Video Recorded' : 'Screen Record'}
            </Button>

            <Button
              variant={targetedElement ? 'contained' : 'outlined'}
              startIcon={<MyLocation />}
              onClick={handleStartTargeting}
              size="small"
              color={targetedElement ? 'success' : 'primary'}
            >
              {targetedElement ? 'Element Selected' : 'Target Element'}
            </Button>
          </Box>
        </Grid>

        {/* Context Capture */}
        <Grid item xs={12}>
          <Button
            variant={capturedContext ? 'contained' : 'outlined'}
            startIcon={<Info />}
            onClick={handleCaptureContext}
            size="small"
            color={capturedContext ? 'success' : 'primary'}
          >
            {capturedContext ? 'Context Captured' : 'Capture Browser Context'}
          </Button>
          {capturedContext && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({capturedContext.consoleErrors.length} errors, {capturedContext.userJourney.length} actions)
            </Typography>
          )}
        </Grid>

        {/* Advanced Options */}
        <Grid item xs={12}>
          <FormControlLabel
            control={<Switch checked={showAdvanced} onChange={e => setShowAdvanced(e.target.checked)} />}
            label="Show advanced options"
          />
        </Grid>

        <Grid item xs={12}>
          <Collapse in={showAdvanced}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Tags {isCommunityContext && <Chip label="Community" size="small" color="secondary" sx={{ ml: 1 }} />}
                </Typography>
                {/* Community-specific suggested tags */}
                {communityComponentInfo && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Suggested for {communityComponentInfo.name}:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {communityComponentInfo.suggestedTags.map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          variant={formData.tags?.includes(tag) ? 'filled' : 'outlined'}
                          onClick={() => handleTagToggle(tag)}
                          size="small"
                          color="secondary"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {contextualTags.map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      variant={formData.tags?.includes(tag) ? 'filled' : 'outlined'}
                      onClick={() => handleTagToggle(tag)}
                      size="small"
                      color={communityTags.includes(tag) ? 'secondary' : 'primary'}
                    />
                  ))}
                </Box>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Component/Page"
                  value={formData.component || ''}
                  onChange={e => setFormData(prev => ({ ...prev, component: e.target.value }))}
                  size="small"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isAnonymous || false}
                      onChange={e => setFormData(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                    />
                  }
                  label="Send anonymously"
                />
              </Grid>
            </Grid>
          </Collapse>
        </Grid>
      </Grid>
    </Box>
  );

  const renderHistoryTab = () => (
    <Box sx={{ p: 2 }}>
      {userHistory.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <History sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography color="text.secondary">No feedback history yet</Typography>
        </Box>
      ) : (
        <List>
          {userHistory.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <Divider />}
              <ListItem>
                <ListItemIcon>
                  {item.feedbackType === 'bug' && <BugReport color="error" />}
                  {item.feedbackType === 'feature' && <Lightbulb color="warning" />}
                  {item.feedbackType === 'usability' && <ThumbDown color="secondary" />}
                  {item.feedbackType === 'general' && <Comment color="primary" />}
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  secondary={
                    <Box component="span">
                      <Typography variant="caption" color="text.secondary">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Typography>
                      <Chip
                        label={item.status}
                        size="small"
                        color={
                          item.status === 'resolved' ? 'success' :
                          item.status === 'in_progress' ? 'warning' :
                          item.status === 'closed' ? 'default' : 'info'
                        }
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  const renderAnalyticsTab = () => {
    const stats = testerStats || feedbackAnalyticsService.getDefaultStats();
    const xp = feedbackAnalyticsService.calculateXP(stats);
    const level = feedbackAnalyticsService.getLevel(xp);
    const levelProgress = feedbackAnalyticsService.getLevelProgress(xp);
    const badges = feedbackAnalyticsService.getUnlockedBadges(stats);
    const nextBadges = feedbackAnalyticsService.getNextBadges(stats, 3);

    return (
      <Box sx={{ p: 2 }}>
        {/* Level Card */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: level.color + '20', border: `1px solid ${level.color}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: level.color, width: 56, height: 56 }}>
              <MilitaryTech sx={{ fontSize: 32 }} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ color: level.color }}>
                Level {level.level}: {level.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={levelProgress}
                  sx={{ flex: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption">{feedbackAnalyticsService.formatXP(xp)} XP</Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Stats Grid */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{stats.totalFeedback}</Typography>
              <Typography variant="caption" color="text.secondary">Total Feedback</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">{stats.resolvedIssues}</Typography>
              <Typography variant="caption" color="text.secondary">Resolved</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                <LocalFireDepartment color="error" />
                <Typography variant="h4" color="error.main">{stats.consecutiveDays}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Day Streak</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">{badges.length}</Typography>
              <Typography variant="caption" color="text.secondary">Badges</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Badges */}
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEvents /> Badges ({badges.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {badges.slice(0, 8).map(badge => (
            <Tooltip key={badge.id} title={badge.description}>
              <Chip
                label={badge.name}
                size="small"
                sx={{
                  bgcolor: feedbackAnalyticsService.getTierColor(badge.tier),
                  color: 'white'}}
              />
            </Tooltip>
          ))}
        </Box>

        {/* Next Badges */}
        {nextBadges.length > 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Next Badges
            </Typography>
            <List dense>
              {nextBadges.map(badge => (
                <ListItem key={badge.id}>
                  <ListItemText
                    primary={badge.name}
                    secondary={`${badge.current}/${badge.requirement} - ${badge.description}`}
                  />
                  <ListItemSecondaryAction>
                    <CircularProgress
                      variant="determinate"
                      value={badge.progress}
                      size={24}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}

        {/* Leaderboard */}
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Leaderboard /> Leaderboard
        </Typography>
        <List dense>
          {leaderboard.slice(0, 5).map(entry => (
            <ListItem key={entry.userId}>
              <ListItemIcon>
                {entry.rank === 1 ? <EmojiEvents sx={{ color: '#ffd700' }} /> :
                 entry.rank === 2 ? <MilitaryTech sx={{ color: '#c0c0c0' }} /> :
                 entry.rank === 3 ? <Star sx={{ color: '#cd7f32' }} /> :
                 <Typography sx={{ width: 24, textAlign: 'center' }}>#{entry.rank}</Typography>}
              </ListItemIcon>
              <ListItemText
                primary={entry.username}
                secondary={`Level ${entry.level} - ${entry.feedbackCount} feedback`}
              />
              <Typography variant="caption" color="text.secondary">
                {feedbackAnalyticsService.formatXP(entry.xp)} XP
              </Typography>
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  const renderQuickTab = () => (
    <Box sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Quick Reaction
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        How do you feel about {component || 'this feature'}?
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        {quickReactions.map(reaction => (
          <Tooltip key={reaction.value} title={reaction.label}>
            <IconButton
              onClick={() => handleQuickReaction(reaction.value)}
              sx={{
                bgcolor: reaction.color + '20','&:hover': { bgcolor: reaction.color + '40' }}}
            >
              <reaction.icon sx={{ fontSize: 40, color: reaction.color }} />
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="body2" color="text.secondary">
        Or provide detailed feedback in the Form tab
      </Typography>
    </Box>
  );

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  const selectedFeedbackType = feedbackTypes.find(t => t.value === formData.feedbackType);
  const offlineQueue = feedbackHistoryService.getOfflineQueue();

  return (
    <>
      {/* Floating Feedback Button */}
      <Tooltip
        title={
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600}}>Prototype Feedback</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {user?.email || 'Prototype Tester'}
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              Ctrl+Shift+F to open
            </Typography>
          </Box>
        }
        placement="left"
      >
        <Badge
          badgeContent={
            !isOnline ? (
              <WifiOff sx={{ fontSize: 12 }} />
            ) : offlineQueue.length > 0 ? (
              offlineQueue.length
            ) : (
              <PrototypeTesterIcon size={12} animated={false} />
            )
          }
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            zIndex: 140,
            '& .MuiBadge-badge': {
              backgroundColor: !isOnline ? '#f44336' : offlineQueue.length > 0 ? '#ff9800' : '#9c27b0',
              color: 'white',
              border: '2px solid #1a1a1a',
            }
          }}
        >
          <Fab
            className="prototype-feedback-tool"
            sx={{
              backgroundColor: 'rgba(156, 39, 176, 0.9)',
              backdropFilter: 'blur(10px)',
              '&:hover': { backgroundColor: 'rgba(156, 39, 176, 1)', transform: 'scale(1.1)' },
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 20px rgba(156, 39, 176, 0.4)'
            }}
            onClick={() => setIsOpen(true)}
            size="medium"
          >
            <Feedback />
          </Fab>
        </Badge>
      </Tooltip>

      {/* Main Dialog */}
      <Dialog
        open={isOpen}
        onClose={() => { setIsOpen(false); onClose?.(); }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
            backgroundImage: 'none',
            borderRadius: isMobile ? 0 : 2,
            maxHeight: isMobile ? '100%' : '90vh',
          }}}
      >
        {/* Header */}
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center', mr: 0.5 }}>
                {professionIcon}
              </Box>
            )}
            {selectedFeedbackType && <selectedFeedbackType.icon sx={{ color: selectedFeedbackType.color }} />}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                  ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Prototype Feedback`
                  : 'Prototype Feedback'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PrototypeTesterIcon size={14} animated={false} />
                {user?.email || 'Prototype Tester'}
                {!isOnline && (
                  <Chip
                    icon={<WifiOff sx={{ fontSize: 14 }} />}
                    label="Offline"
                    size="small"
                    color="error"
                    sx={{ ml: 1, height: 20 }}
                  />
                )}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setIsOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          centered
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="form" label="Form" icon={<Edit />} iconPosition="start" />
          <Tab value="quick" label="Quick" icon={<ThumbUp />} iconPosition="start" />
          <Tab value="history" label="History" icon={<History />} iconPosition="start" />
          <Tab value="analytics" label="Stats" icon={<TrendingUp />} iconPosition="start" />
        </Tabs>

        {/* Content */}
        <DialogContent sx={{ p: 0 }}>
          {activeTab === 'form' && renderFormTab()}
          {activeTab === 'quick' && renderQuickTab()}
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
        </DialogContent>

        {/* Actions (only for form tab) */}
        {activeTab === 'form' && (
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!formData.title?.trim() || !formData.description?.trim() || submitFeedbackMutation.isPending}
              startIcon={isOnline ? <Send /> : <CloudUpload />}
              sx={{
                background: 'linear-gradient(135deg, #9c27b0, #e91e63)',
                '&:hover': { background: 'linear-gradient(135deg, #7b1fa2, #c2185b)' }
              }}
            >
              {isOnline ? 'Submit Feedback' : 'Queue for Later'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}
