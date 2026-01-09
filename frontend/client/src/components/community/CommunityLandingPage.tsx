/**
 * CreatorHub Norge Community - Landing Page
 * 
 * Welcome page for users entering the community for the first time
 * Shows onboarding flow with videos, guides, and feature discovery
 */

import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Chip,
  LinearProgress,
  Stack,
  IconButton,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Group,
  VideoLibrary,
  CheckCircle,
  ArrowForward,
  PlayCircle,
  EmojiEvents,
  Forum,
  Lightbulb,
  Close,
  School,
  Home,
  Login,
  HelpOutline,
  ExpandMore,
  Event as EventIcon,
  CalendarMonth,
  LibraryBooks,
  Handshake,
  SupportAgent,
  LocalOffer,
  Email,
  LocationOn,
} from '@mui/icons-material';
import { useLocation } from 'wouter';

// Lazy load Three.js animation component
const CommunityNetworkAnimation = React.lazy(() => import('./CommunityNetworkAnimation'));

import { apiRequest } from '@/lib/queryClient';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import { GdprNotice } from '@/components/common/GdprNotice';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

// Lazy load LoginModal for performance
const LoginModal = React.lazy(() => import('@/components/auth/LoginModal'));

// Lazy load CommunityPage for preview mode
const CommunityPage = React.lazy(() => import('./CommunityPage'));
import { CommunityDMProvider } from './CommunityDMProvider';

// Import new components and hooks
import { OnboardingErrorBoundary } from './OnboardingErrorBoundary';
import { OnboardingStep } from './OnboardingStep';
import { CommunityHighlightsSidebar } from './CommunityHighlightsSidebar';
import { CommunityLandingFallback } from './CommunityLandingFallback';
import { VideoEmbed } from './VideoEmbed';
import { useProgressPersistence } from './hooks/useProgressPersistence';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useOnboardingAnalytics } from './hooks/useOnboardingAnalytics';
import { useStepValidation } from './hooks/useStepValidation';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content_type: 'text' | 'video' | 'image' | 'checklist';
  content: any;
  position: number;
  is_required: boolean;
}

interface OnboardingConfig {
  id: string;
  profession_type: string;
  welcome_title: string;
  welcome_message: string;
  welcome_video_url: string | null;
  steps: OnboardingStep[];
  completion_message: string;
  completion_cta_text: string;
  completion_cta_url: string;
  is_active: boolean;
}

interface CommunityLandingPageProps {
  userId: string;
  profession: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

function CommunityLandingPageComponent({
  userId,
  profession,
  onComplete,
  onSkip,
}: CommunityLandingPageProps) {
  const { getProfessionDisplayName } = useDynamicProfessions();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [onboardingConfig, setOnboardingConfig] = useState<OnboardingConfig | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize hooks
  const {
    localProgress,
    saveProgress,
    syncProgress,
    loadBackendProgress,
  } = useProgressPersistence({
    userId,
    profession,
    enabled: !!userId && !!profession,
  });

  const analytics = useOnboardingAnalytics(userId, profession);
  const { canProceed } = useStepValidation();

  // Open login modal handler
  const handleOpenLogin = () => {
    setShowLoginModal(true);
  };

  // Close login modal handler
  const handleCloseLogin = () => {
    setShowLoginModal(false);
  };

  // Navigation handler
  const handleNavigation = (path: string) => {
    setLocation(path);
  };

  // Load progress from persistence on mount
  useEffect(() => {
    if (localProgress) {
      setCompletedSteps(new Set(localProgress.completedSteps));
      setActiveStep(localProgress.activeStep);
    }
  }, [localProgress]);

  // Load backend progress on mount
  useEffect(() => {
    if (userId && profession) {
      loadBackendProgress().then((backendProgress) => {
        if (backendProgress) {
          setCompletedSteps(new Set(backendProgress.completedSteps));
          setActiveStep(backendProgress.activeStep);
        }
      });
    }
  }, [userId, profession, loadBackendProgress]);

  useEffect(() => {
    fetchOnboardingConfig();
    analytics.trackOnboardingStart();
  }, [profession]);

  const fetchOnboardingConfig = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/community/onboarding/${profession}`, {
        method: 'GET',
      }) as { success: boolean; config: OnboardingConfig };

      if (response.success && response.config) {
        setOnboardingConfig(response.config);
      } else if (response.success && !response.config) {
        // Config doesn't exist for this profession - this is OK, will show fallback UI
        console.warn(`No onboarding config found for profession: ${profession}`);
        setOnboardingConfig(null);
      } else {
        // API returned success: false
        console.error('Failed to fetch onboarding config - API returned success: false');
        setOnboardingConfig(null);
      }
    } catch (error) {
      console.error('Error fetching onboarding config: ', error);
      // Set to null to show fallback UI
      setOnboardingConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = useCallback((stepIndex: number) => {
    const step = onboardingConfig?.steps[stepIndex];
    if (!step) return;

    // Validate step before completing
    if (!canProceed(step)) {
      return;
    }

    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepIndex);
    setCompletedSteps(newCompleted);

    // Save progress
    const completedArray = Array.from(newCompleted);
    saveProgress(completedArray, stepIndex);
    syncProgress(completedArray, stepIndex);

    // Track analytics
    analytics.trackStepComplete(stepIndex, step.id);

    // Auto-advance to next step
    if (stepIndex < (onboardingConfig?.steps.length || 0) - 1) {
      const nextStep = stepIndex + 1;
      setActiveStep(nextStep);
      analytics.trackStepStart(nextStep, onboardingConfig.steps[nextStep].id);
    }
  }, [onboardingConfig, completedSteps, canProceed, saveProgress, syncProgress, analytics]);

  const handleComplete = useCallback(async () => {
    try {
      // Mark onboarding as complete
      const response = await apiRequest('/api/community/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          profession,
        }),
      }) as { success: boolean; message?: string };

      if (response.success) {
        console.log('Onboarding marked as complete successfully');
        analytics.trackOnboardingComplete(undefined, completedSteps.size);
        if (onComplete) {
          onComplete();
        } else {
          // If no onComplete callback provided, navigate to community page
          setLocation('/community');
        }
      } else {
        console.error('Failed to complete onboarding - API returned success: false');
        // Still proceed to allow user to access community
        analytics.trackOnboardingComplete(undefined, completedSteps.size);
        if (onComplete) {
          onComplete();
        } else {
          // If no onComplete callback provided, navigate to community page
          setLocation('/community');
        }
      }
    } catch (error) {
      console.error('Error completing onboarding: ', error);
      // Still proceed even if API fails - don't block user access
      // The user has completed the steps, so they should be able to proceed
      analytics.trackOnboardingComplete(undefined, completedSteps.size);
      if (onComplete) {
        onComplete();
      } else {
        // If no onComplete callback provided, navigate to community page
        setLocation('/community');
      }
    }
  }, [userId, profession, onComplete, analytics, completedSteps.size, setLocation]);

  // Keyboard navigation handlers
  const handleNext = useCallback(() => {
    if (activeStep < (onboardingConfig?.steps.length || 0) - 1) {
      const nextStepIndex = activeStep + 1;
      setActiveStep(nextStepIndex);
      const nextStep = onboardingConfig?.steps[nextStepIndex];
      if (nextStep) {
        analytics.trackStepStart(nextStepIndex, nextStep.id);
      }
    }
  }, [activeStep, onboardingConfig, analytics]);

  const handlePrevious = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }, [activeStep]);

  const handleSkipWithAnalytics = useCallback(() => {
    analytics.trackOnboardingSkip(activeStep);
    if (onSkip) {
      onSkip();
    } else {
      // If no onSkip callback provided, navigate to community page
      setLocation('/community');
    }
  }, [activeStep, analytics, onSkip, setLocation]);

  // Keyboard navigation
  useKeyboardNavigation({
    activeStep,
    totalSteps: onboardingConfig?.steps.length || 0,
    onNext: handleNext,
    onPrevious: handlePrevious,
    onComplete: handleComplete,
    onSkip: handleSkipWithAnalytics,
    enabled: !!onboardingConfig,
  });

  // Memoize computed values (must be before early returns that use them)
  const progress = useMemo(() => {
    if (!onboardingConfig) return 0;
    return (completedSteps.size / onboardingConfig.steps.length) * 100;
  }, [completedSteps.size, onboardingConfig?.steps.length]);
  
  const allStepsCompleted = useMemo(() => {
    if (!onboardingConfig) return false;
    return completedSteps.size === onboardingConfig.steps.length;
  }, [completedSteps.size, onboardingConfig?.steps.length]);

  // TEMPORARY: Show preview of community without login
  if (showPreview) {
    return (
      <CommunityDMProvider
        currentUserId={userId || 'preview-user'}
        currentUserEmail="preview@creatorhub.no"
        profession={profession || 'photographer'}
      >
        <Box sx={{ position: 'relative' }}>
          {/* Back to Landing button */}
          <Button
            onClick={() => setShowPreview(false)}
            startIcon={<Close />}
            sx={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 9999,
              background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: '8px',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #d97706, #c2410c)',
              },
            }}
          >
            Exit Preview
          </Button>
          <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              <CircularProgress sx={{ color: '#f59e0b' }} />
            </Box>
          }>
            <CommunityPage userId={userId || 'preview-user'} profession={profession || 'photographer'} />
          </Suspense>
        </Box>
      </CommunityDMProvider>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <LinearProgress />
        <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
          Laster velkomstopplevelse...
        </Typography>
      </Container>
    );
  }

  if (!onboardingConfig) {
    // No onboarding configured, show beautiful welcome page matching the design
    return (
      <CommunityLandingFallback
        onOpenLogin={handleOpenLogin}
        onShowPreview={() => setShowPreview(true)}
      />
    );
  }

  // Legacy fallback UI removed - now using CommunityLandingFallback component
  // The large fallback UI has been extracted to CommunityLandingFallback.tsx

  // Main onboarding flow
  return (
    <OnboardingErrorBoundary onRetry={fetchOnboardingConfig}>
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          py: { xs: 3, md: 6 },
        }}
      >
        <Container maxWidth="lg">
          {/* Header with Skip Button */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              mb: 4,
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1.5,
                  fontSize: { xs: '1.75rem', md: '2.5rem' },
                }}
              >
                {onboardingConfig.welcome_title}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '0.95rem', md: '1.1rem' },
                  lineHeight: 1.7,
                  maxWidth: '600px',
                }}
              >
                {onboardingConfig.welcome_message}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={onSkip}
              startIcon={<Close />}
              sx={{
                borderColor: 'rgba(0, 0, 0, 0.23)',
                color: 'text.secondary',
                textTransform: 'none',
                px: 3,
                py: 1,
                borderRadius: 2,
                fontWeight: 600,
                '&:hover': {
                  borderColor: 'error.main',
                  color: 'error.main',
                  bgcolor: 'error.light',
                  borderWidth: 2,
                },
              }}
            >
              Hopp over
            </Button>
          </Box>

          {/* Enhanced Progress Bar */}
          <Card
            sx={{
              mb: 4,
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                    }}
                  >
                    <CheckCircle sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: 'text.primary',
                    }}
                  >
                    Fremdrift
                  </Typography>
                </Box>
                <Chip
                  label={`${completedSteps.size} / ${onboardingConfig.steps.length} fullført`}
                  sx={{
                    bgcolor: 'success.light',
                    color: 'success.dark',
                    fontWeight: 600,
                    px: 1,
                  }}
                />
              </Box>
              <Box sx={{ position: 'relative' }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    bgcolor: 'rgba(0, 0, 0, 0.05)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 6,
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                    },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: -24,
                    color: 'text.secondary',
                    fontWeight: 600,
                  }}
                >
                  {Math.round(progress)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Welcome Video (if configured) */}
          {onboardingConfig.welcome_video_url && (
            <Card
              sx={{
                mb: 4,
                borderRadius: 3,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                border: 'none',
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 2.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <VideoLibrary sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography
                      variant="h5"
                      sx={{
                        color: 'white',
                        fontWeight: 700,
                        mb: 0.5,
                      }}
                    >
                      Velkomsthilsen
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'rgba(255,255,255,0.95)',
                        fontSize: '0.95rem',
                      }}
                    >
                      Se denne korte videoen for å komme i gang
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <VideoEmbed videoUrl={onboardingConfig.welcome_video_url} lazy={false} />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Onboarding Steps */}
          <Grid container spacing={4}>
            <Grid item xs={12} md={8}>
              <Stepper activeStep={activeStep} orientation="vertical">
                {onboardingConfig.steps.map((step, index) => (
                  <OnboardingStep
                    key={step.id}
                    step={step}
                    index={index}
                    isActive={activeStep === index}
                    isCompleted={completedSteps.has(index)}
                    onComplete={() => handleStepComplete(index)}
                    onPrevious={index > 0 ? () => setActiveStep(index - 1) : undefined}
                    showPrevious={index > 0}
                  />
                ))}
              </Stepper>

              {/* Enhanced Completion Card */}
              {allStepsCompleted && (
                <Card
                  sx={{
                    mt: 4,
                    textAlign: 'center',
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                    boxShadow: '0 12px 40px rgba(17, 153, 142, 0.4)',
                    border: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'radial-gradient(circle at 30% 50%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)',
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 4, md: 6 }, position: 'relative', zIndex: 1 }}>
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255, 255, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                        animation: 'pulse 2s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            transform: 'scale(1)',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                          },
                          '50%': {
                            transform: 'scale(1.05)',
                            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
                          },
                        },
                      }}
                    >
                      <EmojiEvents sx={{ fontSize: 60, color: 'white' }} />
                    </Box>
                    <Typography
                      variant="h4"
                      sx={{
                        color: 'white',
                        fontWeight: 800,
                        mb: 2,
                        fontSize: { xs: '1.75rem', md: '2.25rem' },
                        textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      {onboardingConfig.completion_message}
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleComplete}
                      endIcon={<ArrowForward />}
                      sx={{
                        mt: 3,
                        px: 4,
                        py: 1.5,
                        borderRadius: 3,
                        bgcolor: 'white',
                        color: '#11998e',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        textTransform: 'none',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.95)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {onboardingConfig.completion_cta_text}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </Grid>

            {/* Sidebar - Community Highlights */}
            <Grid item xs={12} md={4}>
              <CommunityHighlightsSidebar profession={profession} />
            </Grid>
          </Grid>

          {/* GDPR Cookie Consent Banner */}
          <GdprNotice position="bottom" />
        </Container>
      </Box>
    </OnboardingErrorBoundary>
  );
}

// Wrap with Visual Editor
const CommunityLandingPage = withVisualEditor(CommunityLandingPageComponent, {
  componentId: 'community-landing',
  componentName: 'Community Landing Page',
  category: 'community',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});

export default CommunityLandingPage;
