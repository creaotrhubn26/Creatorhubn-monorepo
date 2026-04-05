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

// Error boundary for lazy components
class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Failed to load lazy component:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
            <Typography sx={{ color: '#f59e0b' }}>Unable to load animation</Typography>
          </Box>
        )
      );
    }
    return this.props.children;
  }
}

// Lazy load Three.js animation component with better error handling
const CommunityNetworkAnimation = React.lazy(() =>
  import('./CommunityNetworkAnimation').catch(() => ({
    default: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography sx={{ color: '#f59e0b', fontSize: '0.875rem' }}>
          Animation unavailable
        </Typography>
      </Box>
    ),
  }))
);

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
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import { getPublicSocialProfiles } from '@/lib/publicBrandLinks';

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

const COMMUNITY_SHELL_BACKGROUND = `
  radial-gradient(circle at top right, rgba(245, 166, 35, 0.14), transparent 28%),
  radial-gradient(circle at bottom left, rgba(88, 122, 168, 0.18), transparent 32%),
  linear-gradient(180deg, #05070b 0%, #091019 52%, #06080c 100%)
`;
const COMMUNITY_PANEL_BACKGROUND =
  'linear-gradient(180deg, rgba(13, 18, 27, 0.94), rgba(8, 12, 18, 0.94))';
const COMMUNITY_PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.08)';
const COMMUNITY_PANEL_SHADOW = '0 24px 60px rgba(0, 0, 0, 0.36)';
const COMMUNITY_TEXT_PRIMARY = 'rgba(248, 241, 231, 0.94)';
const COMMUNITY_TEXT_MUTED = 'rgba(248, 241, 231, 0.68)';
const COMMUNITY_ACCENT = '#f5a623';
const COMMUNITY_PROFILE_STORAGE_KEY = 'creatorhub-community-onboarding-profile-v1';
const ONBOARDING_INTEREST_OPTIONS = [
  'Lys',
  'Redigering',
  'Regi',
  'Lyd',
  'Storytelling',
  'Produksjon',
];
const ONBOARDING_GOAL_OPTIONS = [
  'Få raskere svar',
  'Finne samarbeid',
  'Lære av Academy',
  'Bygge fagprofil',
];
const ONBOARDING_FIRST_ACTIONS = [
  'Post et introinnlegg',
  'Svar på et åpent spørsmål',
  'Diskuter en Academy-leksjon',
];
const creatorhubSocialLinks = getPublicSocialProfiles('creatorhub');

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
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [firstAction, setFirstAction] = useState<string>('');
  const [profileLoaded, setProfileLoaded] = useState(false);

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

  const persistCommunityProfile = useCallback((next: {
    interests?: string[];
    goals?: string[];
    firstAction?: string;
  }) => {
    if (typeof window === 'undefined') return;
    const payload = {
      interests: next.interests ?? selectedInterests,
      goals: next.goals ?? selectedGoals,
      firstAction: next.firstAction ?? firstAction,
    };
    window.localStorage.setItem(COMMUNITY_PROFILE_STORAGE_KEY, JSON.stringify(payload));
  }, [firstAction, selectedGoals, selectedInterests]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(COMMUNITY_PROFILE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSelectedInterests(Array.isArray(parsed?.interests) ? parsed.interests : []);
      setSelectedGoals(Array.isArray(parsed?.goals) ? parsed.goals : []);
      setFirstAction(typeof parsed?.firstAction === 'string' ? parsed.firstAction : '');
    } catch (error) {
      console.error('Error loading community onboarding profile:', error);
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    persistCommunityProfile({});
  }, [selectedInterests, selectedGoals, firstAction, persistCommunityProfile, profileLoaded]);

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
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COMMUNITY_SHELL_BACKGROUND,
          px: 2,
        }}
      >
        <Box
          sx={{
            width: 'min(560px, 100%)',
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            background: COMMUNITY_PANEL_BACKGROUND,
            border: COMMUNITY_PANEL_BORDER,
            boxShadow: COMMUNITY_PANEL_SHADOW,
            backdropFilter: 'blur(18px)',
          }}
        >
          <LinearProgress
            sx={{
              height: 8,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                background: 'linear-gradient(90deg, #f5a623 0%, #ffcd73 100%)',
              },
            }}
          />
          <Typography
            variant="body1"
            sx={{ mt: 2, textAlign: 'center', color: COMMUNITY_TEXT_MUTED }}
          >
            Laster velkomstopplevelse...
          </Typography>
        </Box>
      </Box>
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
          background: COMMUNITY_SHELL_BACKGROUND,
          py: { xs: 3, md: 5 },
        }}
      >
        <Container maxWidth="xl">
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
              <Chip
                label="CreatorHub Community"
                size="small"
                sx={{
                  mb: 1.5,
                  bgcolor: 'rgba(245, 166, 35, 0.14)',
                  color: COMMUNITY_ACCENT,
                  border: '1px solid rgba(245, 166, 35, 0.22)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              />
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  color: COMMUNITY_TEXT_PRIMARY,
                  mb: 1.5,
                  fontSize: { xs: '2.15rem', md: '3.1rem' },
                  letterSpacing: '-0.02em',
                  maxWidth: '12ch',
                }}
              >
                {onboardingConfig.welcome_title}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: COMMUNITY_TEXT_MUTED,
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
                borderColor: 'rgba(245, 166, 35, 0.28)',
                color: COMMUNITY_TEXT_PRIMARY,
                textTransform: 'none',
                px: 3,
                py: 1,
                borderRadius: 999,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.03)',
                '&:hover': {
                  borderColor: 'rgba(245, 166, 35, 0.42)',
                  bgcolor: 'rgba(245, 166, 35, 0.12)',
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
              borderRadius: 4,
              boxShadow: COMMUNITY_PANEL_SHADOW,
              border: COMMUNITY_PANEL_BORDER,
              background: COMMUNITY_PANEL_BACKGROUND,
              overflow: 'hidden',
              backdropFilter: 'blur(18px)',
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
                      background: 'linear-gradient(135deg, #f5a623 0%, #ffd27d 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 10px 24px rgba(245, 166, 35, 0.28)',
                    }}
                  >
                    <CheckCircle sx={{ color: '#05070b', fontSize: 24 }} />
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: COMMUNITY_TEXT_PRIMARY,
                    }}
                  >
                    Fremdrift
                  </Typography>
                </Box>
                <Chip
                  label={`${completedSteps.size} / ${onboardingConfig.steps.length} fullført`}
                  sx={{
                    bgcolor: 'rgba(245, 166, 35, 0.14)',
                    color: COMMUNITY_ACCENT,
                    fontWeight: 600,
                    px: 1,
                    border: '1px solid rgba(245, 166, 35, 0.18)',
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
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 6,
                      background: 'linear-gradient(90deg, #f5a623 0%, #ffd27d 100%)',
                      boxShadow: '0 2px 10px rgba(245, 166, 35, 0.3)',
                    },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: -24,
                    color: COMMUNITY_TEXT_MUTED,
                    fontWeight: 600,
                  }}
                >
                  {Math.round(progress)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card
            sx={{
              mb: 4,
              borderRadius: 4,
              boxShadow: COMMUNITY_PANEL_SHADOW,
              border: COMMUNITY_PANEL_BORDER,
              background: COMMUNITY_PANEL_BACKGROUND,
              overflow: 'hidden',
              backdropFilter: 'blur(18px)',
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' },
                  gap: 3,
                }}
              >
                <Box>
                  <Typography variant="h5" sx={{ color: COMMUNITY_TEXT_PRIMARY, fontWeight: 700 }}>
                    Sett opp din community-profil
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.7, color: COMMUNITY_TEXT_MUTED, maxWidth: 620 }}>
                    Velg interesser og ønsket første handling. Disse valgene brukes til å prioritere hjemflaten når du kommer inn i community som {getProfessionDisplayName(profession)}.
                  </Typography>

                  <Typography variant="subtitle2" sx={{ mt: 2.2, mb: 1, color: COMMUNITY_TEXT_PRIMARY }}>
                    Hva vil du se mer av?
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {ONBOARDING_INTEREST_OPTIONS.map((interest) => {
                      const selected = selectedInterests.includes(interest);
                      return (
                        <Button
                          key={interest}
                          variant={selected ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() =>
                            setSelectedInterests((prev) =>
                              prev.includes(interest)
                                ? prev.filter((item) => item !== interest)
                                : [...prev, interest].slice(-4),
                            )
                          }
                          sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            bgcolor: selected ? COMMUNITY_ACCENT : 'transparent',
                            color: selected ? '#05070b' : COMMUNITY_TEXT_PRIMARY,
                            borderColor: selected ? 'transparent' : 'rgba(255,255,255,0.12)',
                            '&:hover': {
                              bgcolor: selected ? '#ffcd73' : 'rgba(245, 166, 35, 0.08)',
                              borderColor: 'rgba(245, 166, 35, 0.24)',
                            },
                          }}
                        >
                          {interest}
                        </Button>
                      );
                    })}
                  </Stack>

                  <Typography variant="subtitle2" sx={{ mt: 2.2, mb: 1, color: COMMUNITY_TEXT_PRIMARY }}>
                    Hva er viktigst for deg nå?
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {ONBOARDING_GOAL_OPTIONS.map((goal) => {
                      const selected = selectedGoals.includes(goal);
                      return (
                        <Button
                          key={goal}
                          variant={selected ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() =>
                            setSelectedGoals((prev) =>
                              prev.includes(goal)
                                ? prev.filter((item) => item !== goal)
                                : [...prev, goal].slice(-3),
                            )
                          }
                          sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            bgcolor: selected ? 'rgba(245, 166, 35, 0.14)' : 'transparent',
                            color: COMMUNITY_TEXT_PRIMARY,
                            borderColor: selected ? 'rgba(245, 166, 35, 0.24)' : 'rgba(255,255,255,0.12)',
                          }}
                        >
                          {goal}
                        </Button>
                      );
                    })}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: COMMUNITY_TEXT_PRIMARY, fontWeight: 700 }}>
                    Første handling i community
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.6, color: COMMUNITY_TEXT_MUTED }}>
                    Velg én ting vi skal hjelpe deg i gang med på hjemskjermen.
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {ONBOARDING_FIRST_ACTIONS.map((action) => {
                      const selected = firstAction === action;
                      return (
                        <Button
                          key={action}
                          variant={selected ? 'contained' : 'outlined'}
                          onClick={() => setFirstAction(action)}
                          sx={{
                            justifyContent: 'flex-start',
                            borderRadius: 3,
                            px: 1.5,
                            py: 1.2,
                            textTransform: 'none',
                            bgcolor: selected ? COMMUNITY_ACCENT : 'transparent',
                            color: selected ? '#05070b' : COMMUNITY_TEXT_PRIMARY,
                            borderColor: selected ? 'transparent' : 'rgba(255,255,255,0.12)',
                          }}
                        >
                          {action}
                        </Button>
                      );
                    })}
                  </Stack>
                  <Box
                    sx={{
                      mt: 2,
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: 'rgba(245, 166, 35, 0.08)',
                      border: '1px solid rgba(245, 166, 35, 0.14)',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: COMMUNITY_TEXT_MUTED }}>
                      Profilen din styrer hvilke kort, spørsmål og Academy-koblinger som løftes frem først på hjemflaten.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Welcome Video (if configured) */}
          {onboardingConfig.welcome_video_url && (
            <Card
              sx={{
                mb: 4,
                borderRadius: 4,
                overflow: 'hidden',
                background:
                  'linear-gradient(135deg, rgba(20, 28, 40, 0.98) 0%, rgba(11, 16, 25, 0.96) 70%)',
                boxShadow: COMMUNITY_PANEL_SHADOW,
                border: COMMUNITY_PANEL_BORDER,
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
                      bgcolor: 'rgba(245, 166, 35, 0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(245, 166, 35, 0.18)',
                    }}
                  >
                    <VideoLibrary sx={{ fontSize: 32, color: COMMUNITY_ACCENT }} />
                  </Box>
                  <Box>
                    <Typography
                      variant="h5"
                      sx={{
                        color: COMMUNITY_TEXT_PRIMARY,
                        fontWeight: 700,
                        mb: 0.5,
                      }}
                    >
                      Velkomsthilsen
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: COMMUNITY_TEXT_MUTED,
                        fontSize: '0.95rem',
                      }}
                    >
                      Se denne korte videoen for å komme i gang
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
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
              <Box
                sx={{
                  p: { xs: 2.5, md: 3.5 },
                  borderRadius: 4,
                  background: COMMUNITY_PANEL_BACKGROUND,
                  border: COMMUNITY_PANEL_BORDER,
                  boxShadow: COMMUNITY_PANEL_SHADOW,
                  backdropFilter: 'blur(18px)',
                }}
              >
                <Typography
                  variant="h5"
                  sx={{ color: COMMUNITY_TEXT_PRIMARY, fontWeight: 700, mb: 1 }}
                >
                  Slik kommer du i gang
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: COMMUNITY_TEXT_MUTED, mb: 3 }}
                >
                  Følg stegene i rekkefølge for å åpne community med samme arbeidsflyt som i Academy.
                </Typography>
                <Stepper
                  activeStep={activeStep}
                  orientation="vertical"
                  sx={{
                    '& .MuiStepConnector-line': {
                      borderColor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
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
              </Box>

              {/* Enhanced Completion Card */}
              {allStepsCompleted && (
                <Card
                  sx={{
                    mt: 4,
                    textAlign: 'center',
                    borderRadius: 4,
                    background:
                      'linear-gradient(135deg, rgba(36, 27, 10, 0.98) 0%, rgba(18, 15, 11, 0.98) 100%)',
                    boxShadow: COMMUNITY_PANEL_SHADOW,
                    border: COMMUNITY_PANEL_BORDER,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background:
                        'radial-gradient(circle at 30% 50%, rgba(245, 166, 35, 0.18) 0%, transparent 55%)',
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 4, md: 6 }, position: 'relative', zIndex: 1 }}>
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        bgcolor: 'rgba(245, 166, 35, 0.14)',
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
                        border: '1px solid rgba(245, 166, 35, 0.2)',
                      }}
                    >
                      <EmojiEvents sx={{ fontSize: 60, color: COMMUNITY_ACCENT }} />
                    </Box>
                    <Typography
                      variant="h4"
                      sx={{
                        color: COMMUNITY_TEXT_PRIMARY,
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
                        borderRadius: 999,
                        bgcolor: COMMUNITY_ACCENT,
                        color: '#05070b',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        textTransform: 'none',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                        '&:hover': {
                          bgcolor: '#ffcd73',
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

          <Box
            sx={{
              mt: 3,
              p: { xs: 2, md: 2.4 },
              borderRadius: 4,
              background:
                'linear-gradient(135deg, rgba(36, 27, 10, 0.92) 0%, rgba(18, 15, 11, 0.94) 100%)',
              boxShadow: COMMUNITY_PANEL_SHADOW,
              border: COMMUNITY_PANEL_BORDER,
            }}
          >
            <PublicSocialLinks
              label="Sosiale medier"
              body="Følg CreatorHub for community-nyheter, nye initiativer og oppdateringer fra økosystemet."
              links={creatorhubSocialLinks}
              tone="creatorhub"
            />
          </Box>

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
