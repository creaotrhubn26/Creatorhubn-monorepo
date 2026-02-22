import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid,
  Alert,
  LinearProgress,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';
import {
  Feedback,
  Close,
  Send,
  BugReport,
  Lightbulb,
  ThumbUp,
  Comment,
  Screenshot as Screenshot,
  Mic,
  MicOff,
  Star,
  Psychology,
  AutoAwesome,
  TrendingUp,
  AccessTime,
  Science,
  Edit,
  ChatBubble,
  PhotoCamera,
  LocalOffer,
  LocationOn,
  Person,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useActionTracker } from '@/hooks/useActionTracker';
import { UniversalFileUpload } from '@/components/universal/UniversalFileUpload';
import { ScreenshotCapture } from '@/components/universal/ScreenshotCapture';

// Prototype tester interaction logging - akkurat som Replit console
const logPrototypeInteraction = (action: string, details?: any) => {
  const timestamp = new Date().toISOString().substring(11, 19);
  const message = details ? `${action}: ${JSON.stringify(details)}` : action;

  // Send til backend for fullstendig console logging med PROTOTYPE TESTER IDENTIFIKASJON
  fetch('/api/admin/log-interaction, ', {
    method: 'POST',
    headers: {
      'Content-Type' : 'application/json'
    },
    body: JSON.stringify({
      action: `🧪 PROTOTYPE TESTER: ${message}`,
      details,
      timestamp,
      userType: 'prototype_tester',
      // PROTOTYPE TESTER IDENTIFIKASJON - Tydelig hvem som sender feedback
      prototypeTester: {
        sessionId: `prototype_${Date.now()}`,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    })
  }).catch(() => {}); // Silent fail

  // Also log locally
  console.log(`[${timestamp}] 🧪 PROTOTYPE TESTER: ${message}`);
};

interface FeedbackData {
  id?: string;
  userId: string;
  profession: string;
  dashboardType: string;
  feedbackType: 'bug' | 'feature' | 'usability' | 'general' | 'ui_ux';
  title: string;
  description: string;
  rating: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  screenshotUrl?: string;
  audioRecording?: string;
  tags: string[];
  isAnonymous: boolean;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  // PROTOTYPE TESTER IDENTIFIKASJON - Tydelig hvem som sender feedback
  submittedBy: {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'prototype_tester' | 'admin';
    profilePicture?: string;
};
}

interface UniversalPrototypeFeedbackProps {
  profession?: string;
  dashboardType?: string;
  component?: string;
  isFloating?: boolean;
  open?: boolean;
  currentTab?: string;
  userEmail?: string;
  projectContext?: any;
  equipmentContext?: any;
  onClose?: () => void;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

// Feedback types for different kinds of user input
const feedbackTypes = [
  {
    value: 'bug',
    label: 'Bug/Feil',
    description: 'Rapporter feil eller problemer',
    icon: BugReport,
    color: '#f44336'
},
  {
    value: 'feature',
    label: 'Ønsker',
    description: 'Foreslå ny funksjonalitet',
    icon: Lightbulb,
    color: '#ff9800'
},
  {
    value: 'usability',
    label: 'Brukervennlighet',
    description: 'Forbedringer av brukeropplevelse',
    icon: Psychology,
    color: '#9c27b0'
},
  {
    value: 'ui_ux',
    label: 'Design',
    description: 'Visuell design og layout',
    icon: Star,
    color: '#2196f3'
},
  {
    value: 'general',
    label: 'Generelt',
    description: 'Generelle kommentarer',
    icon: Comment,
    color: '#4caf50'
}
];

const priorityLevels = [
  { value: 'low', label: 'Lav', color: '#4caf50' },
  { value: 'medium', label: 'Medium', color: '#ff9800' },
  { value: 'high', label: 'Hø', color: '#f44336' },
  { value: 'critical', label: 'Kritisk', color: '#9c27b0' }
];

export default function UniversalPrototypeFeedback({
  profession = 'photographer,',
  dashboardType = 'universal',
  component,
  isFloating = true,
  open,
  currentTab,
  userEmail,
  projectContext,
  equipmentContext,
  onClose,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}: UniversalPrototypeFeedbackProps) {
  const [isOpen, setIsOpen] = useState(!isFloating); // Auto-open when embedded
  
  // Use open prop from parent if provided (controlled), otherwise use internal state (uncontrolled)
  const dialogOpen = open ?? isOpen;
  const [isRecording, setIsRecording] = useState(false);
  
  // Action tracking for intelligent context
  const { lastAction, recentActions, generateContextualQuestion } = useActionTracker();
  
  // Theming system
  const theming = useTheming('photographer');
  const [contextualQuestion, setContextualQuestion] = useState<any>(null);
  const [showIntelligentPrompt, setShowIntelligentPrompt] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get current user for context
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
    queryFn: async () => {
      return apiRequest('/api/auth/user');
    },
  });

  const [formData, setFormData] = useState<Partial<FeedbackData>>({
    userId: currentUser?.id || userEmail || 'guest-user',
    userEmail: userEmail || currentUser?.email,
    profession,
    dashboardType,
    feedbackType: 'general',
    title: '',
    description: '',
    rating: 5,
    priority: 'medium',
    component: component || currentTab || '',
    tags: [],
    isAnonymous: false,
    status: 'open'
  });

  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotCaptureOpen, setScreenshotCaptureOpen] = useState(false);

  // Update contextual questions when actions change
  useEffect(() => {
    const question = generateContextualQuestion(profession, dashboardType);
    setContextualQuestion(question);

    // Show intelligent prompt if we have a recent action (last 30 seconds)
    if (lastAction && (Date.now() - lastAction.timestamp) < 30000) {
      setShowIntelligentPrompt(true);
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => setShowIntelligentPrompt(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [lastAction, profession, dashboardType, generateContextualQuestion]);

  // Auto-fill form based on contextual question
  const handleQuickFeedback = (response: string) => {
    logPrototypeInteraction('Quick Feedback Selected', {
      response,
      contextualQuestion: contextualQuestion?.question,
      lastAction: lastAction?.element
});
    
    if (contextualQuestion) {
      setFormData(prev => ({
        ...prev,
        title: contextualQuestion.question,
        description: `Hurtigrespons: ${response}\n\nKontekst: ${lastAction?.element || 'Ukjent handling'}`,
        feedbackType: contextualQuestion.category.includes('bug') ? 'bug' : 
                     contextualQuestion.category.includes('feature') ? 'feature' : 'usability',
        component: lastAction?.element || component || currentTab ||'',
        tags: [contextualQuestion.category, ...(lastAction?.context?.profession ? [lastAction.context.profession] : [])]
    }));
      setIsOpen(true);
      setShowIntelligentPrompt(false);
      
      logPrototypeInteraction('Feedback Dialog Opened via Quick Response', {
        prefilledType: contextualQuestion.category.includes('bug') ? 'bug' : 
                      contextualQuestion.category.includes('feature') ? 'feature' : 'usability'
  });
  }
};

  // Auto-populate context information
  React.useEffect(() => {
    const contextInfo = [];
    if (currentTab) contextInfo.push(`Current tab: ${currentTab}`);
    if (projectContext) contextInfo.push(`Project: ${projectContext.title || 'Unnamed'}`);
    if (equipmentContext) contextInfo.push(`Equipment: ${equipmentContext.type || 'General'}`);
    
    if (contextInfo.length > 0) {
      setFormData(prev => ({
        ...prev,
        component: `${component || currentTab ||''} ${contextInfo.length > 0 ? '(' + contextInfo.join(',') + ')' : ','}`.trim()
    }));
    }
  }, [currentTab, projectContext, equipmentContext, component]);

  // Dynamic tags based on UniversalDashboard features and context
  const getAvailableTags = () => {
    const baseTags = [
      'Dashboard','Navigation','Mobile','Desktop','Performance','Google Drive','Project Management','Client Management','Settings','UI/UX','Accessibility','Norwegian Localization'
    ];

    // Add profession-specific tags
    const professionTags: { [key: string]: string[] } = {
      photographer: ['Camera Equipment','Photo Editing','Wedding Timeline','RAW Processing','Lightroom Integration'],
      videographer: ['Video Editing','Story Arc Studio','DaVinci Resolve','Audio Sync','Timeline Management'],
      music_producer: ['Audio Mixing','Plugin Management','MIDI Controllers','Sample Library','Track Management'],
      vendor: ['Inventory Management','Product Catalog','Order Processing','Vendor Dashboard','Sales Analytics']
    };

    // Add context-specific tags
    const contextTags: string[] = [];
    if (currentTab) contextTags.push(`Tab: ${currentTab}`);
    if (projectContext) contextTags.push('Project Context, ','Project Creation');
    if (equipmentContext) contextTags.push('Equipment Management','Hardware Detection');

    // Add Google integration tags if features are being used
    const googleTags = ['Google Photos','Google Calendar','Google Meet','Google Analytics','Google Search Console'];

    // Add universal features from dashboard
    const universalTags = [
      'CRM System','Sales Management','Communication Hub','Email Designer','Meeting Notes','Notification Center','Smart Workflow','File Management','Business Intelligence','Contract Management','Price Administration','BRREG Integration','Universal Chat','Prototype Testing'
    ];

    return [
      ...baseTags,
      ...(professionTags[profession] || []),
      ...contextTags,
      ...googleTags,
      ...universalTags
    ].sort();
  };

  const [availableTags] = useState(getAvailableTags());

  // Submit feedback mutation using existing API
  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedback: Partial<FeedbackData>) => {
      logPrototypeInteraction('Feedback Submission Started', {
        type: feedback.feedbackType,
        rating: feedback.rating,
        title: feedback.title,
        priority: feedback.priority,
        component: feedback.component,
        profession: feedback.profession
      });

      let screenshotUrl = null;

      // Upload screenshot if provided
      if (screenshotFiles.length > 0) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', screenshotFiles[0]);
        uploadFormData.append('type','prototype-feedback-screenshot');

        const uploadResult = await fetch('/api/files/upload', {
          method: 'POST',
          body: uploadFormData
        });

        if (!uploadResult.ok) {
          throw new Error('Screenshot upload failed');
        }

        const uploadData = await uploadResult.json();
        screenshotUrl = uploadData.url;

        logPrototypeInteraction('Screenshot Uploaded', {
          filename: uploadData.filename,
          size: uploadData.size,
          url: screenshotUrl
        });
      }

      const result = await apiRequest('/api/prototype-testing/feedback', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json'
        },
        body: JSON.stringify({
          ...feedback,
          screenshotUrl,
          createdAt: new Date().toISOString()
        })
      });

      logPrototypeInteraction('Feedback Submission Completed', {
        feedbackId: result.id,
        success: true,
        tags: feedback.tags
      });

      return result;
    },
    onSuccess: (data) => {
      logPrototypeInteraction('Feedback Dialog Closed', {
        reason: 'successful_submission',
        feedbackId: data?.id
      });

      // Reset form
      setFormData({
        userId: currentUser?.id || userEmail || 'guest-user',
        userEmail: userEmail || currentUser?.email,
        profession,
        dashboardType,
        feedbackType: 'general',
        title: '',
        description: ', ',
        rating: 5,
        priority: 'medium',
        component: component || currentTab || ', ',
        tags: [],
        isAnonymous: false,
        status: 'open'
      });
      setIsOpen(false);
      // Call parent close handler if provided
      onClose?.();
    },
    onError: (error) => {
      logPrototypeInteraction('Feedback Submission Failed', {
        error: error.message,
        formData: {
          type: formData.feedbackType,
          rating: formData.rating,
          title: formData.title?.substring(0, 50) + '...'
        }
      });
      console.error('Failed to submit feedback: ', error);
    }
  });

  const handleSubmit = () => {
    logPrototypeInteraction('Feedback Form Submit Attempted', {
      hasTitle: !!formData.title?.trim(),
      hasDescription: !!formData.description?.trim(),
      feedbackType: formData.feedbackType,
      rating: formData.rating
    });

    if (!formData.title?.trim() || !formData.description?.trim()) {
      logPrototypeInteraction('Feedback Form Validation Failed', {
        missingTitle: !formData.title?.trim(),
        missingDescription: !formData.description?.trim()
      });
      return;
    }

    submitFeedbackMutation.mutate(formData);
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = formData.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    setFormData(prev => ({ ...prev, tags: newTags }));
};

  const selectedFeedbackType = feedbackTypes.find(t => t.value === formData.feedbackType);
  const selectedPriority = priorityLevels.find(p => p.value === formData.priority);

  // Render embedded button or floating FAB
  const feedbackTrigger = !isFloating ? (
    // Embedded version - no trigger needed, dialog opens automatically
    null
  ) : (
    <>
      {/* Intelligent Prompt for Recent Actions */}
      {showIntelligentPrompt && contextualQuestion && !isOpen && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 10,
            right: 20,
            width: 300,
            zIndex: 15,
            p: 2,
            background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(33, 203, 243, 0.95))',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            color: 'white',
            ...theming.getThemedCardSx()
          }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AutoAwesome sx={{ fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Smart tilbakemelding
            </Typography>
            <IconButton
              size="small"
              onClick={() => setShowIntelligentPrompt(false)}
              sx={{ ml: 'auto', color: 'white' }}
            >
              <Close sx={{ fontSize: 16}} />
            </IconButton>
          </Box>
          
          <Typography variant="body2" sx={{ mb: 2,opacity: 0.9}}>
            {contextualQuestion.question}
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {contextualQuestion.suggestions.map((suggestion: string, index: number) => (
              <Button key={index}
                size="small"
                variant="contained"
                onClick={() => handleQuickFeedback(suggestion)}
                sx={{
                  bgcolor: 'rgba(25, 255, 255, 0.2)',
                  color: 'white','&:hover': {
                    bgcolor: 'rgba(25, 255, 255, 0.3)' },
                  fontSize: '0.75rem',
                  minWidth: 'auto',
                  px: 1 }}
              >
                {suggestion}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              size="small"
              onClick={() => setIsOpen(true)}
              sx={{ color: 'white', fontSize: '0.75rem' }}
            >
              Detaljert tilbakemelding
            </Button>
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime sx={{ fontSize: 12 }} />
              {lastAction ? Math.round((Date.now() - lastAction.timestamp) / 1000) : 0}s siden
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Prototype Testing Feedback Button - positioned at bottom: 20, right: 10, 70x70px to match SpeedDial and Chat */}
      <Tooltip title={contextualQuestion ? `Smart: ${contextualQuestion.question.substring(0, 50)}...` : "Gi tilbakemelding på prototype"} placement="left">
        <Fab
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 10,
            width: 70,
            height: 70,
            zIndex: 14,
            backgroundColor: showIntelligentPrompt
              ? 'rgba(6, 175, 80, 0.9)'
              : 'rgba(33, 150, 243, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(25, 255, 255, 0.2)','&:hover': {
              backgroundColor: showIntelligentPrompt
                ? 'rgba(6, 175, 80, 1)'
                : 'rgba(33, 150, 243, 1)',
              transform: 'scale(1.1)'
            },
            transition: 'all 0.3s ease',
            // Pulse animation when intelligent prompt is available
            animation: showIntelligentPrompt ? 'pulse 2s infinite' : 'none','@keyframes pulse': {
              '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' }
            }
          }}
          onClick={() => {
            logPrototypeInteraction('Feedback Dialog Opened', {
              trigger: 'floating_fab',
              component,
              profession: typeof profession === 'string' ? profession : profession?.profession || 'unknown',
              hasIntelligentPrompt: showIntelligentPrompt
            });
            setIsOpen(true);
          }}
        >
          {showIntelligentPrompt ? theming.getThemedIcon('autoAwesome') : <Feedback />}
        </Fab>
      </Tooltip>
    </>
  );

  // Return combined view with dialog always available
  return (
    <>
      {feedbackTrigger}

      {/* Feedback Dialog - only render when open in controlled mode or always in uncontrolled mode */}
      {(open !== undefined ? open : true) && (
        <Dialog
          open={dialogOpen}
          onClose={() => {
            logPrototypeInteraction('Feedback Dialog Closed', { 
              reason: 'dialog_close_button'
            });
            if (onClose) {
              onClose();
            } else {
              setIsOpen(false);
            }
          }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 255, 0.98))',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 48px rgba(33, 150, 243, 0.15)',
            border: '1px solid',
            borderColor: 'rgba(33, 150, 243, 0.1)',
            overflow: 'hidden'
        }
      }}
      >
        <DialogTitle 
          sx={{ 
            background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)',
            color: 'white',
            py: 3,
            px: 4,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at top right, rgba(255,255,255,0.2), transparent 50%)',
              pointerEvents: 'none'
            }
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box 
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {selectedFeedbackType ? (
                    <selectedFeedbackType.icon sx={{ fontSize: 28, color: 'white' }} />
                  ) : (
                    <Feedback sx={{ fontSize: 28 }} />
                  )}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Science sx={{ fontSize: 28 }} />
                    Prototype Feedback
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.875rem' }}>
                    CreatorHub Norge - Hjelp oss å forbedre platformen
                  </Typography>
                </Box>
              </Box>
              <IconButton 
                onClick={() => {
                  logPrototypeInteraction('Feedback Dialog Closed', { 
                    reason: 'close_icon_button'
                  });
                  if (onClose) {
                    onClose();
                  } else {
                    setIsOpen(false);
                  }
                }}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(255, 255, 255, 0.15)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.25)',
                    transform: 'rotate(90deg)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                <Close />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 4, bgcolor: 'background.paper' }}>
          <Alert 
            severity="info" 
            sx={{ 
              mb: 4,
              borderRadius: 2,
              bgcolor: 'rgba(33, 150, 243, 0.08)',
              border: '1px solid rgba(33, 150, 243, 0.2)',
              '& .MuiAlert-icon': {
                color: '#2196F3'
              }
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Din tilbakemelding hjelper oss å forbedre CreatorHub Norge for {profession}s.
              {component && (
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                  <LocationOn sx={{ fontSize: 16 }} />
                  Du gir feedback på: <strong>{component}</strong>
                </Box>
              )}
            </Typography>
          </Alert>

          {submitFeedbackMutation.isPending && (
            <Box sx={{ mb: 3 }}>
              <LinearProgress 
                sx={{ 
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'rgba(33, 150, 243, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: 'linear-gradient(90deg, #2196F3, #21CBF3)'
                  }
                }} 
              />
              <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center', color: 'primary.main', fontWeight: 600 }}>
                Sender tilbakemelding...
              </Typography>
            </Box>
          )}

          <Grid container spacing={3}>
            {/* Feedback Type Selection */}
            <Grid item xs={12}>
              <Box sx={{ 
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Type tilbakemelding
                </Typography>
                <Chip label="Påkrevd" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Grid container spacing={1.5}>
                {feedbackTypes.map((type) => (
                  <Grid key={type.value}>
                    <Tooltip title={type.description} arrow placement="top">
                      <Chip
                        icon={<type.icon />}
                        label={type.label}
                        variant={formData.feedbackType === type.value ? "filled" : "outlined"}
                        onClick={() => setFormData(prev => ({ ...prev, feedbackType: type.value as any }))}
                        sx={{
                          backgroundColor: formData.feedbackType === type.value ? type.color : 'transparent',
                          color: formData.feedbackType === type.value ? 'white' : type.color,
                          borderColor: type.color,
                          borderWidth: 2,
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          py: 2.5,
                          px: 2,
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: formData.feedbackType === type.value ? `0 4px 12px ${type.color}40` : 'none',
                          '&:hover': {
                            backgroundColor: type.color,
                            color: 'white',
                            transform: 'translateY(-2px)',
                            boxShadow: `0 6px 16px ${type.color}50`
                          }
                        }}
                      />
                    </Tooltip>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Title */}
            <Grid item xs={12}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Edit sx={{ fontSize: 18 }} />
                  Tittel på tilbakemelding *
                </Typography>
              </Box>
              <TextField
                fullWidth
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="F.eks: Dashboard laster sakte, eller Trenger bedre navigasjon..."
                required
                error={submitFeedbackMutation.isError && !formData.title?.trim()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    '&:hover fieldset': {
                      borderColor: '#2196F3'
                    },
                    '&.Mui-focused fieldset': {
                      borderWidth: 2
                    }
                  }
                }}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ChatBubble sx={{ fontSize: 18 }} />
                  Detaljert beskrivelse *
                </Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beskriv problemet eller forslaget detaljert. Hva forventet du? Hva skjedde faktisk?"
                required
                error={submitFeedbackMutation.isError && !formData.description?.trim()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    '&:hover fieldset': {
                      borderColor: '#2196F3'
                    },
                    '&.Mui-focused fieldset': {
                      borderWidth: 2
                    }
                  }
                }}
              />
            </Grid>

            {/* Rating */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ 
                p: 3, 
                borderRadius: 2, 
                border: '2px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#FFC107',
                  boxShadow: '0 4px 12px rgba(255, 193, 7, 0.15)'
                }
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Star sx={{ fontSize: 18, color: '#FFC107' }} />
                  Hvor fornøyd er du?
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Rating
                    value={formData.rating || 5}
                    onChange={(_, value) => {
                      logPrototypeInteraction('Feedback Rating Changed', {
                        from: formData.rating,
                        to: value || 5 });
                      setFormData(prev => ({ ...prev, rating: value || 5 }));
                  }}
                    size="large"
                    sx={{
                      '& .MuiRating-iconFilled': {
                        color: '#FFC107'
                      },
                      '& .MuiRating-iconHover': {
                        color: '#FFD54F'
                      }
                    }}
                  />
                  <Chip 
                    label={`${formData.rating}/5`}
                    color="warning"
                    sx={{ 
                      fontWeight: 700,
                      fontSize: '0.875rem'
                    }}
                  />
                </Box>
              </Box>
            </Grid>

            {/* Priority */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Prioritet</InputLabel>
                <Select
                  value={formData.priority || 'medium'}
                  onChange={(e) => {
                    logPrototypeInteraction('Feedback Priority Changed', {
                      from: formData.priority,
                      to: e.target.value
                });
                    setFormData(prev => ({ ...prev, priority: e.target.value as any }));
                }}
                  label="Prioritet"
                >
                  {priorityLevels.map((level) => (
                    <MenuItem key={level.value} value={level.value}>
                      <Tooltip title={level.description}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width:  12,
                              height:  12,
                              borderRadius: '50, %',
                              backgroundColor: level.color
                        }}
                          />
                          {level.label}
                        </Box>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Screenshot Upload */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PhotoCamera sx={{ fontSize: 18 }} />
                Legg ved screenshot (valgfritt)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Ta screenshot direkte eller last opp eksisterende bilde
              </Typography>
              
              {/* Screenshot Options */}
              <Box sx={{ display: 'flex', gap: 2,mb: 2,flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<Screenshot />}
                  onClick={() => {
                    setScreenshotCaptureOpen(true);
                    logPrototypeInteraction('Screenshot Capture Opened');
                }}
                  sx={{
                    borderColor: '#ff6b30',
                    color: '#ff6b30','&:hover': {
                      backgroundColor: 'rgba(25, 107, 53, 0.1)',
                      borderColor: '#e55a2b'
                }
                }}
                >
                  Ta Screenshot
                </Button>
                
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  eller
                </Typography>
              </Box>

              <UniversalFileUpload
                onFilesSelected={(files) => {
                  setScreenshotFiles(files);
                  logPrototypeInteraction('Screenshot Selected', {
                    fileCount: files.length,
                    fileName: files[0]?.name
              });
              }}
                maxFiles={1}
                maxFileSizeMB={10}
                allowedTypes="images"
                showFormatInfo={false}
                profession={profession as any}
                enableBackgroundUpload={false}
              />

              {/* Show selected screenshot */}
              {screenshotFiles.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                  <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                    Screenshot valgt: {screenshotFiles[0].name}
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* Tags */}
            <Grid item xs={12}>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocalOffer sx={{ fontSize: 18 }} />
                  Relevante områder (valgfritt)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Velg ett eller flere områder som er relevante for tilbakemeldingen din
                </Typography>
              </Box>
              
              <Box sx={{ 
                p: 3, 
                borderRadius: 2, 
                border: '2px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}>
                {/* Selected Tags Display */}
                {formData.tags && formData.tags.length > 0 && (
                  <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', mb: 1, display: 'block' }}>
                      Valgte områder ({formData.tags.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {formData.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          onDelete={() => handleTagToggle(tag)}
                          color="primary"
                          sx={{ 
                            fontWeight: 600,
                            boxShadow: '0 2px 8px rgba(33, 150, 243, 0.2)'
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Available Tags Grid */}
                <Box sx={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 1.5,
                  maxHeight: 300,
                  overflowY: 'auto',
                  pr: 1,
                  '&::-webkit-scrollbar': {
                    width: '8px'
                  },
                  '&::-webkit-scrollbar-track': {
                    bgcolor: 'grey.100',
                    borderRadius: 4
                  },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: 'grey.400',
                    borderRadius: 4,
                    '&:hover': {
                      bgcolor: 'grey.500'
                    }
                  }
                }}>
                  {availableTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      variant={formData.tags?.includes(tag) ? "filled" : "outlined"}
                      onClick={() => handleTagToggle(tag)}
                      size="medium"
                      color={formData.tags?.includes(tag) ? "primary" : "default"}
                      sx={{ 
                        cursor: 'pointer',
                        fontWeight: formData.tags?.includes(tag) ? 600 : 500,
                        transition: 'all 0.2s ease',
                        justifyContent: 'flex-start',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: formData.tags?.includes(tag) 
                            ? '0 4px 12px rgba(33, 150, 243, 0.3)'
                            : '0 4px 12px rgba(0, 0, 0, 0.1)',
                          borderColor: '#2196F3'
                        },
                        '&:active': {
                          transform: 'translateY(0)'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Grid>

            {/* Component/Page */}
            <Grid item xs={12}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn sx={{ fontSize: 18 }} />
                  Side/Komponent (valgfritt)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Hvilken del av systemet gjelder tilbakemeldingen?
                </Typography>
              </Box>
              <TextField
                fullWidth
                value={formData.component || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, component: e.target.value }))}
                placeholder="F.eks: Dashboard oversikt, Project creation, Settings..."
                size="medium"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    '&:hover fieldset': {
                      borderColor: '#2196F3'
                    },
                    '&.Mui-focused fieldset': {
                      borderWidth: 2
                    }
                  }
                }}
              />
            </Grid>

            {/* User Information Display - Always Required */}
            <Grid item xs={12}>
              <Alert 
                severity="info" 
                sx={{ 
                  bgcolor: 'rgba(33, 150, 243, 0.08)',
                  border: '2px solid rgba(33, 150, 243, 0.2)',
                  borderRadius: 2,
                  '& .MuiAlert-icon': {
                    color: '#2196F3'
                  }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Person sx={{ fontSize: 18 }} />
                  Tilbakemelding sendes fra: {userEmail || currentUser?.email || 'Ikke pålogget'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Alle tilbakemeldinger krever brukeridentifikasjon for bedre oppfølging.
                </Typography>
              </Alert>
            </Grid>
          </Grid>

          {submitFeedbackMutation.isError && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 3,
                borderRadius: 2,
                bgcolor: 'rgba(211, 47, 47, 0.08)',
                border: '2px solid rgba(211, 47, 47, 0.3)',
                '& .MuiAlert-icon': {
                  fontSize: 24
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Error sx={{ fontSize: 18 }} />
                Kunne ikke sende tilbakemelding
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Vennligst sjekk at alle påkrevde felt er fylt ut korrekt.
              </Typography>
            </Alert>
          )}

          {submitFeedbackMutation.isSuccess && (
            <Alert 
              severity="success" 
              sx={{ 
                mt: 3,
                borderRadius: 2,
                bgcolor: 'rgba(46, 125, 50, 0.08)',
                border: '2px solid rgba(46, 125, 50, 0.3)',
                '& .MuiAlert-icon': {
                  fontSize: 24
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircle sx={{ fontSize: 18 }} />
                Takk for tilbakemeldingen!
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Vi setter stor pris på dine innspill og vil se på dette snarest.
              </Typography>
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ 
          px: 4, 
          pb: 4, 
          pt: 3,
          bgcolor: 'grey.50',
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 2
        }}>
          <Button 
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                setIsOpen(false);
              }
            }}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.25,
              fontWeight: 600,
              textTransform: 'none',
              borderColor: 'grey.300',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'grey.400',
                bgcolor: 'grey.100'
              }
            }}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.title?.trim() || !formData.description?.trim() || submitFeedbackMutation.isPending}
            startIcon={<Send />}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.25,
              fontWeight: 700,
              textTransform: 'none',
              color: 'white !important',
              background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)',
              boxShadow: '0 4px 14px rgba(33, 150, 243, 0.35)',
              '& .MuiButton-startIcon': {
                color: 'white'
              },
              '&:hover': {
                background: 'linear-gradient(135deg, #1976D2 0%, #2196F3 100%)',
                boxShadow: '0 6px 20px rgba(33, 150, 243, 0.45)',
                transform: 'translateY(-1px)',
                color: 'white !important'
              },
              '&:active': {
                transform: 'translateY(0)'
              },
              '&.Mui-disabled': {
                background: 'grey.300 !important',
                color: 'grey.500 !important'
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {submitFeedbackMutation.isPending ? 'Sender...' : 'Send tilbakemelding'}
          </Button>
        </DialogActions>
      </Dialog>
      )}

      {/* Screenshot Capture Dialog */}
      <ScreenshotCapture
        open={screenshotCaptureOpen}
        onClose={() => {
          setScreenshotCaptureOpen(false);
          logPrototypeInteraction('Screenshot Capture Closed');
      }}
        onScreenshotTaken={(file) => {
          setScreenshotFiles([file]);
          setScreenshotCaptureOpen(false);
          logPrototypeInteraction('Screenshot Captured via Screen Capture', {
            filename: file.name,
            size: file.size
      });
      }}
      />
    </>
  );
}