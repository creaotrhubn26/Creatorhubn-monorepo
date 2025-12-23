import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Divider
} from '@mui/material';
import {
  Feedback,
  Close,
  Send,
  BugReport,
  Lightbulb,
  ThumbUp,
  Comment,
  Screenshot,
  Mic,
  MicOff,
  Star,
  Psychology,
  AutoAwesome,
  TrendingUp,
  AccessTime
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
  const [isOpen, setIsOpen] = useState(false);
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
    if (currentTab) contextInfo.push(`Current tab: ${currentTb}`);
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

  if (!isFloating) {
    // Embedded version for inline use
    return (
      <MuiCard sx={{ mb: 3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap: 1  }}>
            <Feedback color="primary" />
            Gi tilbakemelding på denne funksjonen
          </Typography>
          <Button variant="contained" 
            onClick={() => {
              logPrototypeInteraction('Feedback Dialog Opened', { 
                trigger: 'embedded_button',
                component,
                profession 
            });
              setIsOpen(true);
          }}
            sx={{
              background: 'linear-gradient(135deg, #2196F3, #21CBF3)', '&:hover': { background: 'linear-gradient(135deg, #1976D2, #2196F3)' }
          }}
          >
            Åpne tilbakemeldingsskjema
          </Button>
        </CardContent>
      </MuiCard>
    );
}

  return (
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
              profession,
              hasIntelligentPrompt: showIntelligentPrompt
            });
            setIsOpen(true);
          }}
        >
          {showIntelligentPrompt ? theming.getThemedIcon('autoAwesome') : <Feedback />}
        </Fab>
      </Tooltip>

      {/* Feedback Dialog */}
      <Dialog
        open={isOpen}
        onClose={() => {
          logPrototypeInteraction('Feedback Dialog Closed', { 
            reason: 'dialog_close_button'
      });
          setIsOpen(false);
      }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
            backgroundImage: 'none',
            borderRadius:  2,
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(25, 255, 255, 0.1)'
        }
      }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,flex:  1 }}>
            {selectedFeedbackType && (
              <selectedFeedbackType.icon sx={{ color: selectedFeedbackType.color }} />
            )}
            <Typography variant="h6" sx={{  fontWeight: 600, color: '#2196F3'  }}>
              CreatorHub Norge - Prototype Feedback
            </Typography>
          </Box>
          <IconButton onClick={() => {
            logPrototypeInteraction('Feedback Dialog Closed', { 
              reason: 'close_icon_button'
        });
            setIsOpen(false);
        }}>
            {theming.getThemedIcon('close')}
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt:  2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Din tilbakemelding hjelper oss å forbedre CreatorHub Norge for {profession}s.
              {component && ` Du gir feedback på: ${component}`}
            </Typography>
          </Alert>

          {submitFeedbackMutation.isPending && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          <Grid container spacing={3}>
            {/* Feedback Type Selection */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Type tilbakemelding
              </Typography>
              <Grid container spacing={1}>
                {feedbackTypes.map((type) => (
                  <Grid key={type.value}>
                    <Tooltip title={type.description}>
                      <Chip
                        icon={<type.icon />}
                        label={type.label}
                        variant={formData.feedbackType === type.value ? "filled" : "outlined"}
                        onClick={() => setFormData(prev => ({ ...prev, feedbackType: type.value as any }))}
                        sx={{
                          backgroundColor: formData.feedbackType === type.value ? type.color : 'transparent',
                          color: formData.feedbackType === type.value ? 'white' : type.color,
                          borderColor: type.color, '&:hover': {
                            backgroundColor: type.color,
                            color: 'white'
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
              <TextField
                fullWidth
                label="Tittel på tilbakemelding"
                value={formData.title || ', '}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="F.eks: Dashboard laster sakte, eller Trenger bedre navigasjon..."
                required
                error={submitFeedbackMutation.isError && !formData.title?.trim()}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Detaljert beskrivelse"
                value={formData.description || ', '}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beskriv problemet eller forslaget detaljert. Hva forventet du? Hva skjedde faktisk?"
                required
                error={submitFeedbackMutation.isError && !formData.description?.trim()}
              />
            </Grid>

            {/* Rating */}
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                Hvor fornøyd er du med denne funksjonen? ({formData.rating}/5)
              </Typography>
              <Rating
                value={formData.rating || 5}
                onChange={(_, value) => {
                  logPrototypeInteraction('Feedback Rating Changed', {
                    from: formData.rating,
                    to: value || 5 });
                  setFormData(prev => ({ ...prev, rating: value || 5 }));
              }}
                size="large"
              />
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
              <Typography variant="subtitle2" gutterBottom>
                📷 Legg ved screenshot (valgfritt)
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
                <Box sx={{ mt:  2 }}>
                  <Typography variant="caption" color="success.main">
                    ✅ Screenshot valgt: {screenshotFiles[0].name}
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* Tags */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Relevante områder (valgfritt)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1,maxHeight: 10, overflowY: 'auto' }}>
                {availableTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    variant={formData.tags?.includes(tag) ? "filled" : "outlined"}
                    onClick={() => handleTagToggle(tag)}
                    size="small"
                    color="primary"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Grid>

            {/* Component/Page */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Side/Komponent (valgfritt)"
                value={formData.component || ', '}
                onChange={(e) => setFormData(prev => ({ ...prev, component: e.target.value }))}
                placeholder="F.eks: Dashboard oversikt, Project creation, Settings..."
                size="small"
              />
            </Grid>

            {/* User Information Display - Always Required */}
            <Grid item xs={12}>
              <Alert severity="info" sx={{ bgcolor: 'rgba(25, 140, 0, 0.1)', border: '1px solid rgba(25, 140, 0, 0.3)' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  📝 Tilbakemelding sendes fra: {userEmail || currentUser?.email || 'Ikke pålogget'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Alle tilbakemeldinger krever brukeridentifikasjon for bedre oppfølging.
                </Typography>
              </Alert>
            </Grid>
          </Grid>

          {submitFeedbackMutation.isError && (
            <Alert severity="error" sx={{ mt:  2 }}>
              Kunne ikke sende tilbakemelding. Vennligst sjekk at alle påkrevde felt er fylt ut.
            </Alert>
          )}

          {submitFeedbackMutation.isSuccess && (
            <Alert severity="success" sx={{ mt:  2 }}>
              Takk for tilbakemeldingen! Vi setter pris på dine innspill.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px:  3, pb:  3 }}>
          <Button onClick={() => setIsOpen(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            onClick={handleSubmit}
            disabled={!formData.title?.trim() || !formData.description?.trim() || submitFeedbackMutation.isPending}
            startIcon={<Send />}
            sx={{
              background: 'linear-gradient(135deg, #2196F3, #21CBF3)', '&:hover': { background: 'linear-gradient(135deg, #1976D2, #2196F3)' }
          }}
          >
            {submitFeedbackMutation.isPending ? 'Sender...' : 'Send tilbakemelding'}
          </Button>
        </DialogActions>
      </Dialog>

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