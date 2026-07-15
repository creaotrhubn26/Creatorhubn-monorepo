/**
 * CommunityLandingFallback Component
 * 
 * Fallback UI shown when no onboarding config is available
 * Beautiful welcome page matching the design system
 */

import React, { useState, Suspense } from 'react';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
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
  Chip,
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

// Lazy load components with better error handling
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

const LoginModal = React.lazy(() => import('@/components/auth/LoginModal'));
import { GdprNotice } from '@/components/common/GdprNotice';
import { useCommunityLocale } from './communityLocale';

interface CommunityLandingFallbackProps {
  onOpenLogin: () => void;
  onShowPreview: () => void;
}

export const CommunityLandingFallback: React.FC<CommunityLandingFallbackProps> = ({
  onOpenLogin,
  onShowPreview,
}) => {
  const { tt } = useCommunityLocale();
  const [, setLocation] = useLocation();
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleNavigation = (path: string) => {
    setLocation(path);
  };

  const handleOpenLogin = () => {
    setShowLoginModal(true);
    onOpenLogin();
  };

  const handleCloseLogin = () => {
    setShowLoginModal(false);
  };

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

        {/* Login Button */}
        <Button
          variant="outlined"
          onClick={handleOpenLogin}
          aria-label={tt('Logg inn på din konto', 'Log in to your account')}
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
          {tt('Logg Inn', 'Log In')}
        </Button>

        {/* Preview Button */}
        <Button
          variant="contained"
          onClick={onShowPreview}
          aria-label={tt('Forhåndsvis community (midlertidig)', 'Preview community (temporary)')}
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
          {tt('Forhåndsvis Community', 'Preview Community')}
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
                  {tt('samles her', 'gather here')}
                </Box>
              </Typography>

              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1.05rem',
                  lineHeight: 1.7,
                  mb: 4,
                  maxWidth: 400,
                }}
              >
                {tt(
                  'Et engasjerende fellesskap for norske creators. Ha det gøy mens du jobber, finn nye samarbeidspartnere og delta i daglige utfordringer.',
                  'An engaging community for Norwegian creators. Have fun while you work, find new collaborators and take part in daily challenges.'
                )}
              </Typography>

              <Button
                variant="contained"
                onClick={() => setShowAccessDialog(true)}
                aria-label={tt('Hvordan få tilgang til Community', 'How to get access to Community')}
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
                {tt('Hvordan få tilgang?', 'How to get access?')}
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
                <LazyLoadErrorBoundary
                  fallback={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ color: '#f59e0b', fontSize: '0.875rem' }}>
                        {tt('Animasjon utilgjengelig', 'Animation unavailable')}
                      </Typography>
                    </Box>
                  }
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
                </LazyLoadErrorBoundary>

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
                    {tt('BLI MED NÅ', 'JOIN NOW')}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>

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
            src="/creatorhub-icon.png"
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
              {tt('Få tilgang til Community', 'Get access to Community')}
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
            {tt(
              'CreatorHub Community er et eksklusivt fellesskap for medlemmer av CreatorHub Norge.',
              'CreatorHub Community is an exclusive community for members of CreatorHub Norge.'
            )}
          </Typography>

          <Typography
            sx={{
              color: '#f59e0b',
              fontWeight: 600,
              fontSize: '1rem',
              mb: 2,
            }}
          >
            {tt('Som medlem får du tilgang til:', 'As a member you get access to:')}
          </Typography>

          <Box sx={{ mb: 3 }}>
            {[
              tt('Diskusjoner med andre kreative', 'Discussions with other creatives'),
              tt('Deling av tips og erfaringer', 'Sharing tips and experiences'),
              tt('Nettverksbygging', 'Networking'),
              tt('Eksklusive ressurser og guider', 'Exclusive resources and guides'),
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
              <strong>{tt('Er du allerede medlem?', 'Already a member?')}</strong> {tt('Logg inn for å få tilgang.', 'Log in to get access.')}
            </Typography>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
              {tt('Ikke medlem ennå? Besøk', 'Not a member yet? Visit')}{' '}
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
              {' '}{tt('for å bli med.', 'to join.')}
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
            {tt('Lukk', 'Close')}
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
            {tt('Logg Inn', 'Log In')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Login Modal */}
      {showLoginModal && (
        <ErrorBoundary componentName="community-fallback-login-modal">
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
        </ErrorBoundary>
      )}

      {/* GDPR Notice */}
      <GdprNotice position="bottom" />
    </Box>
  );
};

export default CommunityLandingFallback;
