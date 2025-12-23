/**
 * CreatorHub Norge Community - Landing Page
 * 
 * Welcome page for users entering the community for the first time
 * Shows onboarding flow with videos, guides, and feature discovery
 */

import React, { useState, useEffect, Suspense } from 'react';
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
  Avatar,
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
  Lock,
  ExpandMore,
  Event,
  CalendarMonth,
  LibraryBooks,
  Handshake,
  SupportAgent,
  LocalOffer,
  Email,
  Phone,
  LocationOn,
} from '@mui/icons-material';
import { useLocation } from 'wouter';

// Lazy load Three.js animation component
const CommunityNetworkAnimation = React.lazy(() => import('./CommunityNetworkAnimation'));

// CreatorHub Logo Icon Component for buttons (matching landing-desktop)
const CreatorHubLogoIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    viewBox="0 0 40 40"
    width={size}
    height={size}
    style={{ display: 'block' }}
  >
    <defs>
      <linearGradient id="communityBtnLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    {/* Background circle */}
    <circle cx="20" cy="20" r="18" fill="url(#communityBtnLogoGrad)" />
    {/* Creative Tools Icon */}
    <g transform="translate(8, 8)">
      {/* Central Pencil */}
      <path d="M12 4 L12 18 L10 20 L8 18 L8 16 L6 16 L6 6 L8 4 Z" fill="white" opacity="0.95"/>
      <polygon points="8,4 10,2 12,4" fill="rgba(255,255,255,0.7)"/>
      {/* Camera - top right */}
      <circle cx="18" cy="7" r="3" fill="white" opacity="0.9"/>
      <rect x="17" y="6" width="2" height="2" rx="0.3" fill="url(#communityBtnLogoGrad)"/>
      <line x1="12" y1="8" x2="15" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Video - top left */}
      <polygon points="5,7 2,5 2,9" fill="white" opacity="0.9"/>
      <line x1="8" y1="8" x2="5" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Music - bottom right */}
      <circle cx="18" cy="17" r="2" fill="white" opacity="0.9"/>
      <rect x="18" y="14" width="1" height="3" fill="white" opacity="0.9"/>
      <line x1="12" y1="15" x2="16" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Palette - bottom left */}
      <circle cx="5" cy="17" r="3" fill="white" opacity="0.9"/>
      <circle cx="4" cy="16" r="0.8" fill="url(#communityBtnLogoGrad)"/>
      <circle cx="6" cy="16" r="0.8" fill="#f59e0b"/>
      <circle cx="5" cy="18" r="0.8" fill="#ea580c"/>
      <line x1="8" y1="15" x2="8" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8"/>
    </g>
  </svg>
);
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import { GdprNotice } from '@/components/common/GdprNotice';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

// Lazy load LoginModal for performance
const LoginModal = React.lazy(() => import('@/components/auth/LoginModal'));

// Lazy load CommunityPage for preview mode
const CommunityPage = React.lazy(() => import('./CommunityPage'));
import { CommunityDMProvider } from './CommunityDMProvider';

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
  onComplete: () => void;
  onSkip: () => void;
}

function CommunityLandingPageComponent({
  userId,
  profession,
  onComplete,
  onSkip,
}: CommunityLandingPageProps) {
  const { user } = useEnhancedMasterIntegration();
  const { getProfessionDisplayName } = useDynamicProfessions();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [onboardingConfig, setOnboardingConfig] = useState<OnboardingConfig | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showVideo, setShowVideo] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  useEffect(() => {
    fetchOnboardingConfig();
  }, [profession]);

  const fetchOnboardingConfig = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/community/onboarding/${profession}`, {
        method: 'GET',
      }) as { success: boolean; config: OnboardingConfig };

      if (response.success && response.config) {
        setOnboardingConfig(response.config);
      }
    } catch (error) {
      console.error('Error fetching onboarding config: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = (stepIndex: number) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepIndex);
    setCompletedSteps(newCompleted);

    // Auto-advance to next step
    if (stepIndex < (onboardingConfig?.steps.length || 0) - 1) {
      setActiveStep(stepIndex + 1);
    }
  };

  const handleComplete = async () => {
    try {
      // Mark onboarding as complete
      await apiRequest('/api/community/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          profession,
        }),
      });

      onComplete();
    } catch (error) {
      console.error('Error completing onboarding: ', error);
      onComplete(); // Still proceed even if API fails
    }
  };

  const getVideoEmbedUrl = (url: string): string => {
    // Convert YouTube/Vimeo URLs to embed format
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com')) {
      const videoId = url.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  const renderStepContent = (step: OnboardingStep) => {
    switch (step.content_type) {
      case 'video':
        return (
          <Box sx={{ mt: 2 }}>
            <Box
              sx={{
                position: 'relative',
                paddingBottom: '56.25%', // 16:9 aspect ratio
                height: 0,
                overflow: 'hidden',
                borderRadius: 2,
                bgcolor: 'black'}}
            >
              <iframe
                src={getVideoEmbedUrl(step.content.video_url)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none'}}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Box>
          </Box>
        );

      case 'checklist':
        return (
          <Box sx={{ mt: 2 }}>
            {step.content.items?.map((item: string, index: number) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CheckCircle color="success" fontSize="small" />
                <Typography variant="body2">{item}</Typography>
              </Box>
            ))}
          </Box>
        );

      case 'text':
      default:
        return (
          <Typography variant="body1" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
            {step.content.text || step.description}
          </Typography>
        );
    }
  };

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
      <Box
        sx={{
          minHeight: '100vh',
          background: '#1a1a2e',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background pattern */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(rgba(245, 158, 11, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245, 158, 11, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            zIndex: 0,
          }}
        />

        {/* Header/Navigation */}
        <Box
          component="header"
          sx={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: { xs: 3, md: 6 },
            py: 3,
          }}
        >
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/creatorhub-community-icon.svg"
              alt="CreatorHub Community"
              sx={{
                height: 44,
                width: 44,
              }}
            />
            <Box>
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.05em',
                  lineHeight: 1.2,
                }}
              >
                CreatorHub
              </Typography>
              <Typography
                sx={{
                  color: '#f59e0b',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                Community
              </Typography>
            </Box>
          </Box>

          {/* Nav Buttons */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              gap: 2,
              alignItems: 'center',
            }}
          >
            {/* Academy Button */}
            <Button
              variant="text"
              onClick={() => handleNavigation('/academy')}
              startIcon={<School sx={{ fontSize: 18 }} />}
              sx={{
                color: '#fff',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 600,
                px: 2,
                py: 0.75,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(234,88,12,0.1) 100%)',
                border: '1px solid rgba(251,146,60,0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '& .MuiButton-startIcon': {
                  color: '#f59e0b',
                },
                '&:hover': {
                  background: 'linear-gradient(135deg, rgba(251,146,60,0.25) 0%, rgba(234,88,12,0.2) 100%)',
                  border: '1px solid rgba(251,146,60,0.5)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(251,146,60,0.3)',
                },
              }}
            >
              Academy
            </Button>

            {/* CreatorHub Norge Button */}
            <Button
              variant="text"
              onClick={() => handleNavigation('/')}
              startIcon={<Home sx={{ fontSize: 18 }} />}
              sx={{
                color: '#fff',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 600,
                px: 2,
                py: 0.75,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                border: '1px solid rgba(168,85,247,0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '& .MuiButton-startIcon': {
                  color: '#a855f7',
                },
                '&:hover': {
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(139,92,246,0.2) 100%)',
                  border: '1px solid rgba(168,85,247,0.5)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
                },
              }}
            >
              CreatorHub Norge
            </Button>
          </Box>

          {/* Login Button - matching landing-desktop */}
          <Button
            variant="outlined"
            onClick={handleOpenLogin}
            aria-label="Logg inn på din konto"
            startIcon={<Login sx={{ fontSize: 18 }} />}
            sx={{
              borderColor: '#ff8c00',
              color: '#ff8c00',
              px: 3,
              py: 1,
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                borderColor: '#e67c00',
                backgroundColor: 'rgba(255,140,0,0.15)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(255,140,0,0.3)',
              },
              '&:focus': {
                outline: '2px solid #ff8c00',
                outlineOffset: '2px',
              },
            }}
          >
            Logg Inn
          </Button>

          {/* TEMPORARY: Preview button to enter community without login */}
          <Button
            variant="contained"
            onClick={() => setShowPreview(true)}
            aria-label="Preview community (temporary)"
            startIcon={<Forum sx={{ fontSize: 18 }} />}
            sx={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              px: 3,
              py: 1,
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669, #047857)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
              },
            }}
          >
            Preview Community
          </Button>
        </Box>

        {/* Main Content - Split Layout */}
        <Container
          maxWidth="xl"
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            minHeight: 'calc(100vh - 100px)',
            px: { xs: 3, md: 6 },
          }}
        >
          <Grid container spacing={4} alignItems="center">
            {/* Left Side - Text Content */}
            <Grid item xs={12} md={6}>
              <Box sx={{ maxWidth: 520 }}>
                {/* Main Headline */}
                <Typography
                  variant="h1"
                  sx={{
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
                    lineHeight: 1.1,
                    mb: 3,
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Creators,<br />
                  <Box component="span" sx={{ color: '#f59e0b' }}>
                    samles her
                  </Box>
                </Typography>

                {/* Description */}
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '1.05rem',
                    lineHeight: 1.7,
                    mb: 4,
                    maxWidth: 400,
                  }}
                >
                  Et engasjerende fellesskap for norske creators. 
                  Ha det gøy mens du jobber, finn nye samarbeidspartnere 
                  og delta i daglige utfordringer.
                </Typography>

                {/* CTA Button - How to get access */}
                <Button
                  variant="contained"
                  onClick={() => setShowAccessDialog(true)}
                  aria-label="Hvordan få tilgang til Community"
                  startIcon={<HelpOutline sx={{ fontSize: 22 }} />}
                  sx={{
                    backgroundColor: '#ff8c00',
                    color: 'white',
                    px: 4,
                    py: 1.5,
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    textTransform: 'none',
                    boxShadow: '0 4px 12px rgba(255,140,0,0.3)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      backgroundColor: '#e67c00',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(255,140,0,0.4)',
                    },
                    '&:focus': {
                      outline: '2px solid #ffffff',
                      outlineOffset: '2px',
                    },
                  }}
                >
                  Hvordan få tilgang?
                </Button>
              </Box>
            </Grid>

            {/* Right Side - Circular Image */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {/* Outer decorative ring */}
                <Box
                  sx={{
                    position: 'absolute',
                    width: { xs: 300, sm: 380, md: 420 },
                    height: { xs: 300, sm: 380, md: 420 },
                    borderRadius: '50%',
                    border: '1px dashed rgba(245, 158, 11, 0.3)',
                    animation: 'spin 60s linear infinite',
                    '@keyframes spin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                  }}
                />

                {/* Inner decorative ring */}
                <Box
                  sx={{
                    position: 'absolute',
                    width: { xs: 260, sm: 340, md: 380 },
                    height: { xs: 260, sm: 340, md: 380 },
                    borderRadius: '50%',
                    border: '2px solid rgba(245, 158, 11, 0.2)',
                  }}
                />

                {/* Three.js Community Network Animation */}
                <Box
                  sx={{
                    width: { xs: 280, sm: 340, md: 380 },
                    height: { xs: 280, sm: 340, md: 380 },
                    borderRadius: '50%',
                    border: '3px solid #f59e0b',
                    overflow: 'hidden',
                    position: 'relative',
                    bgcolor: '#1a1a2e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 60px rgba(245, 158, 11, 0.3), inset 0 0 30px rgba(245, 158, 11, 0.1)',
                  }}
                >
                  <Suspense
                    fallback={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CircularProgress sx={{ color: '#f59e0b' }} />
                      </Box>
                    }
                  >
                    <CommunityNetworkAnimation width={360} height={360} />
                  </Suspense>

                  {/* Rotating text around circle */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -30,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: '#1a1a2e',
                      px: 2,
                      py: 0.5,
                      borderRadius: 2,
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      zIndex: 10,
                    }}
                  >
                    <PlayCircle sx={{ color: '#f59e0b', fontSize: 16 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                      BLI MED NÅ
                    </Typography>
                  </Box>
                </Box>

                {/* Decorative asterisk */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: { xs: 20, md: 60 },
                    right: { xs: 20, md: 60 },
                    color: '#f59e0b',
                    fontSize: { xs: 40, md: 50 },
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                      '50%': { transform: 'scale(1.1)', opacity: 0.8 },
                    },
                  }}
                >
                  ✳
                </Box>

                {/* Small decorative triangle */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: { xs: 40, md: 80 },
                    right: { xs: 60, md: 120 },
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderBottom: '14px solid rgba(255, 255, 255, 0.3)',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>

        {/* ============================================ */}
        {/* SECTION: Community Features Bento Grid */}
        {/* ============================================ */}
        <Box
          sx={{
            py: { xs: 8, md: 12 },
            px: { xs: 2, md: 4 },
            bgcolor: '#12121f',
            position: 'relative',
          }}
        >
          <Container maxWidth="lg">
            {/* Section Header */}
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography
                sx={{
                  color: '#f59e0b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  mb: 2,
                }}
              >
                Hva vi tilbyr
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: { xs: '2rem', md: '2.75rem' },
                  mb: 2,
                }}
              >
                Alt du trenger i{' '}
                <Box component="span" sx={{ color: '#f59e0b' }}>
                  ett fellesskap
                </Box>
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '1.1rem',
                  maxWidth: 600,
                  mx: 'auto',
                }}
              >
                CreatorHub Community gir deg tilgang til ressurser, nettverk og støtte for å vokse som kreativ.
              </Typography>
            </Box>

            {/* Bento Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gridTemplateRows: { xs: 'auto', md: 'auto auto' },
                gap: 3,
              }}
            >
              {/* Card 1 - Diskusjoner (Large - spans 2 cols) */}
              <Card
                sx={{
                  gridColumn: { xs: '1', md: '1 / 3' },
                  gridRow: { xs: 'auto', md: '1' },
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 20px 40px rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
                      }}
                    >
                      <Forum sx={{ fontSize: 36, color: 'white' }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                        Diskusjoner
                      </Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}>
                        Delta i engasjerende samtaler med andre kreative. Still spørsmål, del erfaringer og få verdifulle tilbakemeldinger fra fellesskapet.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Card 2 - Ressursbibliotek (Featured - tall card) */}
              <Card
                sx={{
                  gridColumn: { xs: '1', md: '3' },
                  gridRow: { xs: 'auto', md: '1 / 3' },
                  borderRadius: '24px',
                  background: 'linear-gradient(145deg, #f59e0b 0%, #d97706 40%, #b45309 100%)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-6px) scale(1.01)',
                    boxShadow: '0 20px 50px rgba(245, 158, 11, 0.35)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 4 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '16px',
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                    }}
                  >
                    <LibraryBooks sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
                    Ressursbibliotek
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.7, mb: 3, flex: 1 }}>
                    Få tilgang til eksklusive guider, maler, presets og tutorials. Alt du trenger for å ta prosjektene dine til neste nivå.
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                    <Chip label="Guider" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                    <Chip label="Maler" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                    <Chip label="Presets" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                  </Stack>
                </CardContent>
              </Card>

              {/* Card 3 - Nettverksbygging */}
              <Card
                sx={{
                  gridColumn: { xs: '1', md: '1' },
                  gridRow: { xs: 'auto', md: '2' },
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.08) 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 16px 32px rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)',
                    }}
                  >
                    <Handshake sx={{ fontSize: 28, color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                    Nettverksbygging
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Finn samarbeidspartnere, mentorer og nye venner i bransjen.
                  </Typography>
                </CardContent>
              </Card>

              {/* Card 4 - Hjelp og Støtte */}
              <Card
                sx={{
                  gridColumn: { xs: '1', md: '2' },
                  gridRow: { xs: 'auto', md: '2' },
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.08) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 16px 32px rgba(34, 197, 94, 0.2)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)',
                    }}
                  >
                    <SupportAgent sx={{ fontSize: 28, color: 'white' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                    Hjelp og Støtte
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Få svar på spørsmål og hjelp fra erfarne medlemmer i fellesskapet.
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Additional Features Row */}
            <Grid container spacing={3} sx={{ mt: 3 }}>
              {/* Utfordringer */}
              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(219, 39, 119, 0.06) 100%)',
                    border: '1px solid rgba(236, 72, 153, 0.2)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 28px rgba(236, 72, 153, 0.2)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <EmojiEvents sx={{ fontSize: 24, color: 'white' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                          Kreative Utfordringer
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                          Delta i ukentlige utfordringer og vis frem dine ferdigheter
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Eksklusive Tilbud */}
              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.06) 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 28px rgba(59, 130, 246, 0.2)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LocalOffer sx={{ fontSize: 24, color: 'white' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                          Eksklusive Tilbud
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                          Få rabatter og spesialtilbud fra våre partnere
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ============================================ */}
        {/* SECTION: Upcoming Events */}
        {/* ============================================ */}
        <Box
          sx={{
            py: { xs: 8, md: 10 },
            px: { xs: 2, md: 4 },
            bgcolor: '#1a1a2e',
            position: 'relative',
          }}
        >
          <Container maxWidth="lg">
            {/* Section Header */}
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography
                sx={{
                  color: '#f59e0b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  mb: 2,
                }}
              >
                Kommende Aktiviteter
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                  mb: 2,
                }}
              >
                Events og Utfordringer
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '1.05rem',
                  maxWidth: 500,
                  mx: 'auto',
                }}
              >
                Hold deg oppdatert på hva som skjer i fellesskapet
              </Typography>
            </Box>

            {/* Events Grid */}
            <Grid container spacing={3}>
              {/* Event 1 */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    borderRadius: '20px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: 'rgba(245, 158, 11, 0.15)',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        mb: 2,
                      }}
                    >
                      <CalendarMonth sx={{ fontSize: 16, color: '#f59e0b' }} />
                      <Typography sx={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>
                        20. Jan 2025
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                      Kreativ Utfordring: Portrettfotografering
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', mb: 2 }}>
                      Ukens tema er kreative portretter med naturlig lys. Del dine beste bilder!
                    </Typography>
                    <Button
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{
                        color: '#f59e0b',
                        textTransform: 'none',
                        p: 0,
                        '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                      }}
                    >
                      Lær mer
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              {/* Event 2 */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    borderRadius: '20px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: 'rgba(139, 92, 246, 0.15)',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        mb: 2,
                      }}
                    >
                      <Event sx={{ fontSize: 16, color: '#8b5cf6' }} />
                      <Typography sx={{ color: '#8b5cf6', fontSize: '0.8rem', fontWeight: 600 }}>
                        25. Jan 2025
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                      Workshop: Fargegradering for Video
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', mb: 2 }}>
                      Lær profesjonelle teknikker for fargegradering i DaVinci Resolve.
                    </Typography>
                    <Button
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{
                        color: '#8b5cf6',
                        textTransform: 'none',
                        p: 0,
                        '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                      }}
                    >
                      Meld deg på
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              {/* Event 3 */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    borderRadius: '20px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: 'rgba(34, 197, 94, 0.15)',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        mb: 2,
                      }}
                    >
                      <Group sx={{ fontSize: 16, color: '#22c55e' }} />
                      <Typography sx={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600 }}>
                        30. Jan 2025
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                      Virtuelt Meetup: Nettverkskveld
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', mb: 2 }}>
                      Bli kjent med andre kreative i en uformell online samling.
                    </Typography>
                    <Button
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{
                        color: '#22c55e',
                        textTransform: 'none',
                        p: 0,
                        '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                      }}
                    >
                      Delta gratis
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* ============================================ */}
        {/* SECTION: FAQ */}
        {/* ============================================ */}
        <Box
          sx={{
            py: { xs: 8, md: 10 },
            px: { xs: 2, md: 4 },
            bgcolor: '#12121f',
            position: 'relative',
          }}
        >
          <Container maxWidth="md">
            {/* Section Header */}
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography
                sx={{
                  color: '#f59e0b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  mb: 2,
                }}
              >
                Ofte Stilte Spørsmål
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                }}
              >
                Har du spørsmål?
              </Typography>
            </Box>

            {/* FAQ Accordion */}
            <Box>
              <Accordion
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px !important',
                  mb: 2,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    bgcolor: 'rgba(245, 158, 11, 0.05)',
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
                  sx={{ px: 3, py: 1 }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                    Hva er CreatorHub Community?
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}>
                    CreatorHub Community er et eksklusivt fellesskap for norske fotografer, videografer og musikkprodusenter. Her kan du dele arbeid, få tilbakemeldinger, finne samarbeidspartnere og lære fra andre i bransjen.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px !important',
                  mb: 2,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    bgcolor: 'rgba(245, 158, 11, 0.05)',
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
                  sx={{ px: 3, py: 1 }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                    Hvordan blir jeg medlem?
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}>
                    For å bli medlem av Community må du først bli CreatorHub Norge-medlem. Besøk creatorhubn.com for å opprette en konto. Når du er registrert, får du automatisk tilgang til fellesskapet.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px !important',
                  mb: 2,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    bgcolor: 'rgba(245, 158, 11, 0.05)',
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
                  sx={{ px: 3, py: 1 }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                    Er det gratis å delta?
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}>
                    Community er inkludert i CreatorHub Norge-medlemskapet. Det finnes ulike medlemskapsnivåer med forskjellige fordeler. Sjekk våre priser på hovedsiden for mer informasjon.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px !important',
                  mb: 2,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    bgcolor: 'rgba(245, 158, 11, 0.05)',
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
                  sx={{ px: 3, py: 1 }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                    Hvilke profesjoner er velkommen?
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}>
                    Vi ønsker velkommen fotografer, videografer, musikkprodusenter og alle andre kreative yrkesutøvere i Norge. Uansett om du er profesjonell eller hobbyist, er du velkommen i vårt fellesskap.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px !important',
                  mb: 2,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    bgcolor: 'rgba(245, 158, 11, 0.05)',
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
                  sx={{ px: 3, py: 1 }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                    Hvordan kan jeg bidra til fellesskapet?
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.7 }}>
                    Du kan bidra ved å dele ditt arbeid, gi konstruktive tilbakemeldinger til andre, delta i diskusjoner, dele tips og erfaringer, og være en positiv stemme i fellesskapet. Jo mer du engasjerer deg, jo mer får du igjen!
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Box>
          </Container>
        </Box>

        {/* ============================================ */}
        {/* SECTION: Footer */}
        {/* ============================================ */}
        <Box
          component="footer"
          sx={{
            bgcolor: '#0d0d18',
            borderTop: '1px solid rgba(245, 158, 11, 0.2)',
            py: 6,
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={4}>
              {/* Company Info */}
              <Grid item xs={12} md={4}>
                <Box sx={{ mb: 2 }}>
                  <Box
                    component="img"
                    src="/creatorhub-logo-amber.svg"
                    alt="CreatorHub Norge"
                    sx={{
                      width: 180,
                      height: 'auto',
                      filter: 'brightness(1.1)',
                    }}
                  />
                </Box>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2, lineHeight: 1.7, fontSize: '0.9rem' }}>
                  CreatorHub Community er et fellesskap for norske fotografer, videografer og musikkprodusenter.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <IconButton
                    size="small"
                    sx={{
                      color: '#f59e0b',
                      '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.1)' },
                    }}
                    aria-label="Facebook"
                  >
                    <Group fontSize="small" />
                  </IconButton>
                </Stack>
              </Grid>

              {/* Quick Links */}
              <Grid item xs={12} md={2}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f59e0b', fontSize: '1rem' }}>
                  Navigasjon
                </Typography>
                <Stack spacing={1}>
                  {[
                    { label: 'Hjem', path: '/' },
                    { label: 'Academy', path: '/academy' },
                    { label: 'CreatorHub Norge', path: '/' },
                    { label: 'Om Oss', path: '/about' },
                  ].map((link, index) => (
                    <Button
                      key={index}
                      variant="text"
                      onClick={() => handleNavigation(link.path)}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        textTransform: 'none',
                        justifyContent: 'flex-start',
                        fontSize: '0.9rem',
                        px: 0,
                        minWidth: 0,
                        '&:hover': {
                          color: '#f59e0b',
                          bgcolor: 'transparent',
                        },
                      }}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Stack>
              </Grid>

              {/* Community Links */}
              <Grid item xs={12} md={3}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f59e0b', fontSize: '1rem' }}>
                  Community
                </Typography>
                <Stack spacing={1}>
                  {[
                    { label: 'Forum', icon: <Forum fontSize="small" /> },
                    { label: 'Ressurser', icon: <LibraryBooks fontSize="small" /> },
                    { label: 'Events', icon: <Event fontSize="small" /> },
                    { label: 'Hjelp', icon: <HelpOutline fontSize="small" /> },
                  ].map((item, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        '&:hover': { color: '#f59e0b' },
                      }}
                    >
                      <Box sx={{ mr: 1, color: '#f59e0b', display: 'flex' }}>{item.icon}</Box>
                      <Typography variant="body2">{item.label}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Grid>

              {/* Contact */}
              <Grid item xs={12} md={3}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f59e0b', fontSize: '1rem' }}>
                  Kontakt
                </Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                    <Email fontSize="small" sx={{ mr: 1, color: '#f59e0b' }} />
                    <Typography variant="body2">kontakt@creatorhubn.com</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                    <LocationOn fontSize="small" sx={{ mr: 1, color: '#f59e0b' }} />
                    <Typography variant="body2">Norge</Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>

            {/* Bottom Bar */}
            <Divider sx={{ my: 4, bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center' }}>
                © {new Date().getFullYear()} CreatorHub Norge. Alle rettigheter reservert.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => handleNavigation('/about')}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.4)',
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Personvernerklæring
                </Button>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.2)' }}>
                  •
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => handleNavigation('/about')}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.4)',
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Vilkår & Betingelser
                </Button>
              </Stack>
            </Box>
          </Container>
        </Box>

        {/* GDPR Notice */}
        <GdprNotice position="bottom" />

        {/* Access Information Dialog */}
        <Dialog
          open={showAccessDialog}
          onClose={() => setShowAccessDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: '#1a1a2e',
              backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 3,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
            },
          }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
              pb: 2.5,
              pt: 2,
            }}
          >
            <Box
              component="img"
              src="/creatorhub-logo-amber.svg"
              alt="CreatorHub"
              sx={{
                width: 90,
                height: 90,
                objectFit: 'contain',
              }}
            />
            <Box>
              <Typography
                variant="h5"
                sx={{
                  color: '#fff',
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                Få tilgang til Community
              </Typography>
              <Typography
                sx={{
                  color: '#f59e0b',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  mt: 0.5,
                }}
              >
                CreatorHub Norge
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ py: 3 }}>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '1.05rem',
                lineHeight: 1.7,
                mb: 3,
              }}
            >
              CreatorHub Community er et eksklusivt fellesskap for medlemmer av CreatorHub Norge.
            </Typography>

            <Typography
              sx={{
                color: '#f59e0b',
                fontWeight: 600,
                fontSize: '1rem',
                mb: 2,
              }}
            >
              Som medlem får du tilgang til:
            </Typography>

            <Box sx={{ mb: 3 }}>
              {[
                'Diskusjoner med andre kreative',
                'Deling av tips og erfaringer',
                'Nettverksbygging',
                'Eksklusive ressurser og guider',
              ].map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 1.5,
                  }}
                >
                  <CheckCircle sx={{ color: '#f59e0b', fontSize: 20 }} />
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                bgcolor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 2,
                p: 2,
                mt: 2,
              }}
            >
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 1 }}>
                <strong>Er du allerede medlem?</strong> Logg inn for å få tilgang.
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                Ikke medlem ennå? Besøk{' '}
                <Box
                  component="a"
                  href="https://creatorhubn.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: '#f59e0b',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  creatorhubn.com
                </Box>
                {' '}for å bli med.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions
            sx={{
              borderTop: '1px solid rgba(245, 158, 11, 0.2)',
              px: 3,
              py: 2,
              gap: 2,
            }}
          >
            <Button
              onClick={() => setShowAccessDialog(false)}
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Lukk
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setShowAccessDialog(false);
                handleOpenLogin();
              }}
              startIcon={<Login />}
              sx={{
                bgcolor: '#f59e0b',
                color: '#1a1a2e',
                fontWeight: 600,
                px: 3,
                '&:hover': {
                  bgcolor: '#fbbf24',
                },
              }}
            >
              Logg Inn
            </Button>
          </DialogActions>
        </Dialog>

        {/* Login Modal */}
        {showLoginModal && (
          <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
              <CircularProgress sx={{ color: '#f59e0b' }} />
            </Box>
          }>
            <LoginModal
              open={showLoginModal}
              onClose={handleCloseLogin}
              context="community"
            />
          </Suspense>
        )}
      </Box>
    );
  }

  const progress = (completedSteps.size / onboardingConfig.steps.length) * 100;
  const allStepsCompleted = completedSteps.size === onboardingConfig.steps.length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header with Skip Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {onboardingConfig.welcome_title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {onboardingConfig.welcome_message}
          </Typography>
        </Box>
        <Button variant="outlined" onClick={onSkip} startIcon={<Close />}>
          Hopp over
        </Button>
      </Box>

      {/* Progress Bar */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            Fremdrift
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {completedSteps.size} / {onboardingConfig.steps.length} fullført
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 1 }} />
      </Paper>

      {/* Welcome Video (if configured) */}
      {onboardingConfig.welcome_video_url && (
        <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <VideoLibrary sx={{ fontSize: 40, color: 'white' }} />
              <Box>
                <Typography variant="h6" sx={{ color: 'white' }}>
                  Velkomsthilsen
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Se denne korte videoen for å komme i gang
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                position: 'relative',
                paddingBottom: '56.25%',
                height: 0,
                overflow: 'hidden',
                borderRadius: 2,
                bgcolor: 'black'}}
            >
              <iframe
                src={getVideoEmbedUrl(onboardingConfig.welcome_video_url)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none'}}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Steps */}
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {onboardingConfig.steps.map((step, index) => (
              <Step key={step.id} completed={completedSteps.has(index)}>
                <StepLabel>
                  <Typography variant="h6">{step.title}</Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {step.description}
                  </Typography>

                  {renderStepContent(step)}

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={() => handleStepComplete(index)}
                      disabled={completedSteps.has(index)}
                      startIcon={completedSteps.has(index) ? <CheckCircle /> : <ArrowForward />}
                    >
                      {completedSteps.has(index) ? 'Fullført' : 'Neste'}
                    </Button>
                    {index > 0 && (
                      <Button onClick={() => setActiveStep(index - 1)}>Tilbake</Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {/* Completion Card */}
          {allStepsCompleted && (
            <Paper sx={{ p: 4, mt: 4, textAlign: 'center', bgcolor: 'success.light' }}>
              <EmojiEvents sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                {onboardingConfig.completion_message}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleComplete}
                startIcon={<ArrowForward />}
                sx={{ mt: 2 }}
              >
                {onboardingConfig.completion_cta_text}
              </Button>
            </Paper>
          )}
        </Grid>

        {/* Sidebar - Community Highlights */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 20 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Hva venter deg
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Forum color="primary" />
                  <Box>
                    <Typography variant="subtitle2">Diskusjoner</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Få råd fra erfarne creators
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Lightbulb color="primary" />
                  <Box>
                    <Typography variant="subtitle2">Deling av kunnskap</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Del dine egne tips og triks
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <EmojiEvents color="primary" />
                  <Box>
                    <Typography variant="subtitle2">Badges & Belønninger</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Tjen badges ved å være aktiv
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display:'flex', gap: 2 }}>
                  <Group color="primary" />
                  <Box>
                    <Typography variant="subtitle2">Nettverk</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Koble deg til andre creators
                    </Typography>
                  </Box>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary">
                Bli med i {getProfessionDisplayName(profession)} gruppen og få tilgang til eksklusive kanaler!
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* GDPR Cookie Consent Banner */}
      <GdprNotice position="bottom" />
    </Container>
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
