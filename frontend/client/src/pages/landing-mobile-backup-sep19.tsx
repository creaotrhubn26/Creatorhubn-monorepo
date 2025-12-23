import React from 'react';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
// import { CREATOR_HUB_BRANDING } from '../../constants/CreatorHubBranding';

// PERFORMANCE: Asset preloading for critical resources
const preloadCriticalAssets = () => {
  if (typeof document !== 'undefined') {
    // Preload critical fonts and images
    const preloadLinks = [
      { rel: 'preload', href: '/creatorhub-logo-amber.svg', as: 'image' },
      {
        rel: 'preload',
        href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
        as: 'style',
      },
    ];

    preloadLinks.forEach((link) => {
      const existingLink = document.querySelector(`link[href="${link.href}"]`);
      if (!existingLink) {
        const linkElement = document.createElement('link');
        Object.assign(linkElement, link);
        document.head.appendChild(linkElement);
      }
    });
  }
};

// PERFORMANCE: Execute preloading immediately
preloadCriticalAssets();

// PERFORMANCE: Optimized animations for 60fps performance
const globalStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) translateZ(0); }
    50% { transform: translateY(-15px) translateZ(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  /* PERFORMANCE: Critical CSS for above-the-fold content */
  .critical-load-priority {
    will-change: transform, opacity;
    backface-visibility: hidden;
    perspective: 1000px;
  }
  
  /* PERFORMANCE: GPU acceleration for animations */
  .gpu-accelerated {
    transform: translateZ(0);
    will-change: transform;
  }
  
  /* PERFORMANCE: Optimized glassmorphism for mobile */
  .mobile-optimized-glass {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transform: translateZ(0);
  }
  
  /* ACCESSIBILITY: Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .gpu-accelerated {
      animation: none;
      transform: none;
    }
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// GLASSMORPHISM DESIGN KONSISTENS PROTOKOLL - Standardiserte verdier
const GLASSMORPHISM_CONSTANTS = {
  // Standardiserte blur values (kun disse tillatt)
  BLUR_LIGHT: 'blur(10px)',
  BLUR_MEDIUM: 'blur(15px)',

  // Standardiserte transparency levels (kun disse tillatt)
  ALPHA_LIGHT: 0.1,
  ALPHA_MEDIUM: 0.15,
  ALPHA_STRONG: 0.3,

  // Standardiserte border styling (uniform)
  BORDER_STANDARD: '1px solid rgba(255,140,0,0.3)',

  // Standardiserte box-shadow med amber theme
  BOX_SHADOW_LIGHT: '0 8px 32px rgba(255,140,0,0.15)',
  BOX_SHADOW_MEDIUM: '0 15px 35px rgba(255,140,0,0.15)',
  BOX_SHADOW_STRONG: '0 32px 64px rgba(255,140,0,0.15)',
};

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('landing-styles')) {
  const style = document.createElement('style');
  style.id = 'landing-styles';
  style.textContent = globalStyles;
  document.head.appendChild(style);
}
import { useLocation } from 'wouter';
import {
  Box,
  Container,
  Typography,
  Button,
  Card as MuiCard,
  CardContent,
  Stack,
  Paper,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Grid,
} from '@mui/material';
// Import all icons from Material UI since CreatorHubIcons doesn't export these simple names
import { 
  Home,
  VideoLibrary,
  LibraryMusic,
  Business,
  CheckCircle,
  Group,
  Inventory,
  PhotoCamera,
  Person,
  Science,
  MenuBook,
  Email,
  Phone,
  LocationOn,
  Menu,
  Close,
  Dashboard,
  Settings,
  Help,
  Info,
  ArrowForward,
  AutoAwesome,
  Login,
  Store,
} from '@mui/icons-material';
// PERFORMANCE: Lazy load non-critical components for faster initial load
const LoginModal = React.lazy(() => import('@/components/auth/LoginModal'));
const InviteRequestForm = React.lazy(() => import('@/components/InviteRequestForm'));
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
const LandingMobile: React.FC = () => {
  console.log('🔍 LandingMobile backup component rendering...');
  const [, setLocation] = useLocation();

  // PERFORMANCE: SEO optimization with meta tags
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      // Set language for accessibility
      document.documentElement.lang = 'nb-NO';
      // Update meta tags for optimal SEO
      document.title = 'CreatorHub Norge - Profesjonell Kreativ Plattform for Norske Fotografer';

      // Update or create meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute(
        'content',
        'Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter. Strømlinjeforme arbeidsflyt, forbedre samarbeid og lever skreddersydde opplevelser.',
      );

      // Add Open Graph tags for social media sharing
      const ogTags = [
        {
          property: 'og:title',
          content: 'CreatorHub Norge - Profesjonell Kreativ Plattform',
        },
        {
          property: 'og:description',
          content:
            'Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: window.location.href },
      ];

      ogTags.forEach((tag) => {
        let metaTag = document.querySelector(`meta[property="${tag.property}"]`);
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute('property', tag.property);
          document.head.appendChild(metaTag);
        }
        metaTag.setAttribute('content', tag.content);
      });
    }
  }, []);
  // EKSISTERENDE FUNKSJONS INTEGRASJON PROTOKOLL - Sentralisert modal state management
  const [modalState, setModalState] = React.useState({
    showSidebar: false,
    showRoleSelector: false,
    showLoginModal: false,
    showInviteRequest: false,
    selectedRole: '',
  });

  // Comprehensive modal cleanup function med state consistency
  const resetAllModals = React.useCallback(() => {
    setModalState({
      showSidebar: false,
      showRoleSelector: false,
      showLoginModal: false,
      showInviteRequest: false,
      selectedRole: '',
    });
    console.log('All modals reset to closed state');
  }, []);

  // Listen for billing and feature updates from unified workflow
  React.useEffect(() => {
    const handleWorkflowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BILLING_UPDATE') {
        console.log('💰 Billing Update Received:', event.data);
        // Update landing page stats or UI based on billing events
        // This could trigger a re-render of stats or show notifications
      }

      if (event.data?.type === 'FEATURE_UPDATE') {
        console.log('🔧 Feature Update Received:', event.data);
        // Update landing page features based on feature toggles
        // This could show/hide features or update descriptions
      }
    };

    window.addEventListener('message', handleWorkflowMessage);
    return () => window.removeEventListener('message', handleWorkflowMessage);
  }, []);

  // Escape key handler for consistent modal behavior
  React.useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close modals in priority order (most specific first)
        if (modalState.showInviteRequest) {
          setModalState((prev) => ({
            ...prev,
            showInviteRequest: false,
            selectedRole: '',
          }));
        } else if (modalState.showRoleSelector) {
          setModalState((prev) => ({
            ...prev,
            showRoleSelector: false,
            selectedRole: '',
          }));
        } else if (modalState.showLoginModal) {
          setModalState((prev) => ({ ...prev, showLoginModal: false }));
        } else if (modalState.showSidebar) {
          setModalState((prev) => ({ ...prev, showSidebar: false }));
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [modalState]);

  // Navigation cleanup with consistent state management
  const handleNavigationCleanup = React.useCallback(
    (path: string) => {
      setLocation(path);
      resetAllModals(); // Comprehensive cleanup when navigating
      console.log(`Navigation to ${path} with modal cleanup`);
    },
    [setLocation, resetAllModals],
  );

  // PERFORMANCE: Optimized user data fetching with aggressive caching
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['/api/auth/current-user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/current-user', { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - reduce unnecessary refetches
    gcTime: 10 * 60 * 1000, // 10 minutes cache (replaces cacheTime in v5)
  });

  const isAuthenticated = !!currentUser;
  const userProfession = (currentUser as any)?.profession || (currentUser as any)?.userType;
  const isAdmin =
    (currentUser as any)?.email === 'daniel@creatorhubn.com' || (currentUser as any)?.isAdmin;

  // ROLLE BASERT TILGANGSKONTROLL PROTOKOLL - Enhanced access control med fallbacks
  const canAccessProfession = (profession: string) => {
    try {
      // Comprehensive admin privileges med audit logging
      if (isAdmin) {
        console.log(
          `Admin Access: ${(currentUser as any)?.email} accessing ${profession} dashboard`,
        );
        // Future: Send audit log to backend
        return true;
      }

      // Graceful handling av loading states
      if (userLoading) {
        console.log(`User loading - denying access to ${profession} temporarily`);
        return false;
      }

      // Reliable userProfession detection med fallbacks
      const detectedProfession =
        userProfession ||
        (currentUser as any)?.profession ||
        (currentUser as any)?.userType ||
        'unknown';

      // Comprehensive fallback profession assignment
      if (detectedProfession === 'unknown' && isAuthenticated) {
        console.warn(
          `Unknown profession for user ${(currentUser as any)?.email} - denying access to ${profession}`,
        );
        return false;
      }

      // Standard profession matching
      const hasAccess = detectedProfession === profession;

      if (hasAccess) {
        console.log(`Profession access granted: ${detectedProfession} -> ${profession}`);
      } else {
        console.log(`❌ Profession access denied: ${detectedProfession} ≠ ${profession}`);
      }

      return hasAccess;
    } catch (error) {
      // Graceful error handling med fallback to deny
      console.error(`🚨 Error in canAccessProfession(${profession}):`, error);
      return false;
    }
  };

  const handleNavigation = (path: string) => {
    handleNavigationCleanup(path);
  };

  const handleGetStarted = () => {
    setModalState((prev) => ({ ...prev, showRoleSelector: true }));
    console.log('Role selector opened');
  };

  const handleLogin = () => {
    setModalState((prev) => ({ ...prev, showLoginModal: true }));
    console.log('Login modal opened');
  };

  const handleJoinAsProfessional = () => {
    setModalState((prev) => ({ ...prev, showRoleSelector: true }));
    console.log('Professional signup flow started');
  };

  const handleVendorNetwork = () => {
    setModalState((prev) => ({
      ...prev,
      selectedRole: 'vendor',
      showInviteRequest: true,
      showRoleSelector: false,
    }));
    console.log('Vendor network invite request opened');
  };

  const handleRoleSelection = (role: string) => {
    setModalState((prev) => ({
      ...prev,
      selectedRole: role,
      showRoleSelector: false,
      showInviteRequest: true,
    }));
    console.log(`Role selected: ${role} - moving to invite request`);

    // Trigger unified workflow events for role selection
    // This will be handled by the parent component that has access to unified workflow
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'ROLE_SELECTED',
          data: {
            role: role,
            timestamp: new Date().toISOString(),
            source: 'landing_mobile',
          },
        },
        '*',
      );
    }
  };

  const handleCloseModals = () => {
    resetAllModals();
  };

  console.log('🔍 LandingMobile backup returning JSX...');
  return (
    <Box
      className="critical-load-priority" // 🚀 PERFORMANCE: Above-the-fold priority
      sx={{
        minHeight: '100vh',
        background: `
          linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, #f59e0b 100%),
          radial-gradient(circle at 20% 80%, rgba(255,140,0,0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255,179,71,0.25) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(255,140,0,0.2) 0%, transparent 50%)
        `,
        position: 'relative',
        overflow: 'hidden',
        pb: 12,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(45deg, transparent 30%, rgba(255,140,0,0.1) 50%, transparent 70%)',
          zIndex: 1,
          pointerEvents: 'none',
        },
      }}
    >
      {/* Floating background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '15%',
          width: '300px',
          height: '300px',
          background: `
          radial-gradient(circle, rgba(255,140,0,0.4) 0%, rgba(255,179,71,0.2) 40%, transparent 70%)
        `,
          borderRadius: '50%',
          filter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
          animation: 'float 8s ease-in-out infinite',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          right: '10%',
          width: '250px',
          height: '250px',
          background: `
          radial-gradient(circle, rgba(255,140,0,0.35) 0%, rgba(255,179,71,0.2) 40%, transparent 70%)
        `,
          borderRadius: '50%',
          filter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
          animation: 'float 6s ease-in-out infinite reverse',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          background: `rgba(255,255,255,${GLASSMORPHISM_CONSTANTS.ALPHA_STRONG})`,
          backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_LIGHT,
          borderBottom: GLASSMORPHISM_CONSTANTS.BORDER_STANDARD,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_LIGHT,
        }}
      >
        <Container maxWidth="sm">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: 2,
            }}
          >
            {/* Centered logo */}
            <Box>
              <a
                href="https://creatorhubn.com"
                style={{
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <img
                  src="/creatorhub-logo-amber.svg"
                  alt="CreatorHub Norge"
                  style={{
                    width: '300px',
                    height: 'auto',
                    filter: 'drop-shadow(0 4px 8px rgba(255,140,0,0.2))',
                  }}
                />
              </a>
            </Box>
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="sm" sx={{ py: 1 }}>
        {/* Main Landing Card */}
        <MuiCard
          sx={{
            mb: 1.5,
            borderRadius: '16px',
            background: `rgba(255,255,255,${GLASSMORPHISM_CONSTANTS.ALPHA_LIGHT})`,
            backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
            border: GLASSMORPHISM_CONSTANTS.BORDER_STANDARD,
            boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            {/* Orange Badge */}
            <Box
              sx={{
                display: 'inline-block',
                backgroundColor: `rgba(255,140,0,${GLASSMORPHISM_CONSTANTS.ALPHA_MEDIUM})`,
                borderRadius: '50px',
                px: 2,
                py: 0.5,
                mb: 1,
                border: GLASSMORPHISM_CONSTANTS.BORDER_STANDARD,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#d97706',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                }}
              >
                CreatorHub Norge - Profesjonell Kreativ Plattform
              </Typography>
            </Box>

            {/* Main Title */}
            <Typography
              variant="h4"
              sx={{
                fontWeight: 'bold',
                color: '#1f2937',
                mb: 0.5,
                lineHeight: 1.1,
                fontSize: { xs: '20px', sm: '24px' },
              }}
            >
              Profesjonell Kreativ
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 'bold',
                color: '#d97706',
                mb: 1,
                fontSize: { xs: '20px', sm: '24px' },
              }}
            >
              Plattform
            </Typography>

            {/* Description */}
            <Typography
              variant="body1"
              sx={{
                color: '#374151',
                mb: 1.5,
                lineHeight: 1.4,
                fontSize: '14px',
              }}
            >
              Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer,
              videografer og musikkprodusenter.
            </Typography>

            {/* Action Buttons */}
            <Stack spacing={1}>
              <Button
                variant="contained"
                size="large"
                className="gpu-accelerated" // 🚀 PERFORMANCE: GPU acceleration for smooth interactions
                sx={{
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  py: 1.5,
                  px: 3,
                  minHeight: '48px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(255,140,0,0.3)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: '#e67c00',
                    transform: 'translateY(-1px) translateZ(0)', // 🚀 GPU optimized
                    boxShadow: '0 6px 16px rgba(255,140,0,0.4)',
                  },
                  '&:active': {
                    transform: 'translateY(0) translateZ(0)', // 🚀 GPU optimized
                    boxShadow: '0 2px 8px rgba(255,140,0,0.3)',
                  },
                }}
                onClick={handleGetStarted}
              >
                <ArrowForward sx={{ mr: 1 }} />
                Kom i Gang
              </Button>

              <Button
                variant="contained"
                size="large"
                onClick={handleLogin}
                sx={{
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  py: 1.5,
                  px: 3,
                  minHeight: '48px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(255,140,0,0.3)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: '#e67c00',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 16px rgba(255,140,0,0.4)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 2px 8px rgba(255,140,0,0.3)',
                  },
                }}
              >
                <Login sx={{ mr: 1 }} />
                Logg Inn
              </Button>
            </Stack>
          </CardContent>
        </MuiCard>

        {/* Fotograf Card */}
        <MuiCard
          sx={{
            mb: 1,
            borderRadius: '12px',
            background: `rgba(255,255,255,${GLASSMORPHISM_CONSTANTS.ALPHA_LIGHT})`,
            backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
            border: GLASSMORPHISM_CONSTANTS.BORDER_STANDARD,
            boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <CardContent sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'rgba(76,175,80,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(76,175,80,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                }}
              >
                <PhotoCamera sx={{ color: '#2e7d32', fontSize: 16 }} />
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}
              >
                Fotograf
              </Typography>
            </Box>

            <Stack spacing={0.5}>
              {[
                'Bildeadministrasjon',
                'Klientgallerier',
                'Bryllupsportefølje',
                'Utstyrstyring',
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ color: '#2e7d32', fontSize: 16, mr: 1.5 }} />
                  <Typography variant="body2" sx={{ color: '#374151', fontSize: '14px' }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </MuiCard>

        {/* Videografi Card */}
        <MuiCard
          sx={{
            mb: 1,
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(33,150,243,0.3)',
            boxShadow: '0 10px 25px rgba(33,150,243,0.1)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <CardContent sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'rgba(33,150,243,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(33,150,243,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                }}
              >
                <VideoLibrary sx={{ color: '#1565c0', fontSize: 16 }} />
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}
              >
                Videografi
              </Typography>
            </Box>

            <Stack spacing={0.5}>
              {[
                'Produksjonsplanlegging',
                'Post-produksjon',
                'Klientgjennomgang',
                'Videoleveranse',
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ color: '#1565c0', fontSize: 16, mr: 1.5 }} />
                  <Typography variant="body2" sx={{ color: '#374151', fontSize: '14px' }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </MuiCard>

        {/* Musikk Produksjon Card */}
        <MuiCard
          sx={{
            mb: 1,
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(156,39,176,0.3)',
            boxShadow: '0 10px 25px rgba(156,39,176,0.1)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <CardContent sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'rgba(156,39,176,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(156,39,176,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                }}
              >
                <LibraryMusic sx={{ color: '#7b1fa2', fontSize: 16 }} />
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}
              >
                Musikk Produksjon
              </Typography>
            </Box>

            <Stack spacing={0.5}>
              {[
                'Studioopptak',
                'Miksing og mastering',
                'Artistsamarbeid',
                'Rettighetsadministrasjon',
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ color: '#7b1fa2', fontSize: 16, mr: 1.5 }} />
                  <Typography variant="body2" sx={{ color: '#374151', fontSize: '14px' }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Stack>

            {/* Action Button */}
            <Button
              variant="contained"
              fullWidth
              onClick={handleJoinAsProfessional}
              sx={{
                mt: 1.5,
                backgroundColor: '#ff6b35',
                color: 'white',
                py: 1.2,
                px: 2,
                minHeight: '44px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 'bold',
                textTransform: 'none',
                boxShadow: '0 3px 10px rgba(255,140,0,0.3)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#e67c00',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 5px 14px rgba(255,140,0,0.4)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: '0 2px 6px rgba(255,140,0,0.3)',
                },
              }}
            >
              <Group sx={{ mr: 1 }} />
              Bli Med Som Kreativ Profesjonell
            </Button>
          </CardContent>
        </MuiCard>

        {/* Leverandørnettverk Card */}
        <MuiCard
          sx={{
            mb: 1,
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(255,140,0,0.3)',
            boxShadow: '0 10px 25px rgba(255,140,0,0.1)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'rgba(255,140,0,0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,140,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
              }}
            >
              <Group sx={{ color: '#d97706', fontSize: 20 }} />
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                color: '#1f2937',
                mb: 1,
                fontSize: '14px',
              }}
            >
              Leverandørnettverk
            </Typography>

            <Typography variant="body2" sx={{ color: '#374151', mb: 1.5, fontSize: '12px' }}>
              Komplett leverandørnettverk for norske kreative profesjonelle
            </Typography>

            <Stack spacing={0.5} sx={{ textAlign: 'left', mb: 1.5 }}>
              {['Produktkatalog', 'Salgsverktøy', 'Kundeadministrasjon', 'Analysedata'].map(
                (item, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ color: '#ff6b35', fontSize: 14, mr: 1 }} />
                    <Typography variant="body2" sx={{ color: '#374151', fontSize: '12px' }}>
                      {item}
                    </Typography>
                  </Box>
                ),
              )}
            </Stack>

            <Button
              variant="contained"
              fullWidth
              onClick={handleVendorNetwork}
              sx={{
                backgroundColor: '#ff6b35',
                color: 'white',
                py: 1.2,
                px: 2,
                minHeight: '44px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'none',
                boxShadow: '0 3px 10px rgba(255,140,0,0.3)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#e67c00',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 5px 14px rgba(255,140,0,0.4)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: '0 2px 6px rgba(255,140,0,0.3)',
                },
              }}
            >
              <Store sx={{ mr: 1 }} />
              Leverandørnettverk
            </Button>
          </CardContent>
        </MuiCard>

        {/* Enhanced Hva er CreatorHub Norge? Card */}
        <Box sx={{ position: 'relative', mb: 3 }}>
          {/* Floating background elements */}
          <Box
            sx={{
              position: 'absolute',
              top: -15,
              left: -15,
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, rgba(255,140,0,0.1), transparent)',
              animation: 'float 6s ease-in-out infinite',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -10,
              right: -10,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, rgba(76,175,80,0.1), transparent)',
              animation: 'float 8s ease-in-out infinite reverse',
            }}
          />

          <MuiCard
            sx={{
              borderRadius: '20px',
              background:
                'linear-gradient(135deg, rgba(255,140,0,0.02) 0%, rgba(255,248,235,0.8) 50%, rgba(255,140,0,0.05) 100%)',
              border: '2px solid rgba(255,140,0,0.15)',
              boxShadow: '0 15px 35px rgba(255,140,0,0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top decorative accent */}
            <Box
              sx={{
                height: '6px',
                background: `linear-gradient(90deg, ${'#ff6b35'}, #ffb347, ${'#ff6b35'})`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s ease-in-out infinite',
              }}
            />

            <CardContent sx={{ p: 4, position: 'relative' }}>
              {/* Enhanced Header */}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,140,0,0.1)',
                    borderRadius: '50px',
                    px: 3,
                    py: 1,
                    mb: 2,
                    border: '1px solid rgba(255,140,0,0.2)',
                  }}
                >
                  <AutoAwesome sx={{ color: '#ff6b35', fontSize: 16, mr: 1 }} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#ff6b35',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    NORGES KREATIVE PLATTFORM
                  </Typography>
                </Box>

                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 'bold',
                    background: `linear-gradient(45deg, ${'#ff6b35'}, #e67c00)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2,
                    fontSize: '1.4rem',
                  }}
                >
                  Hva er CreatorHub Norge?
                </Typography>
              </Box>

              <Typography
                variant="body1"
                sx={{
                  color: '#1f2937',
                  mb: 3,
                  lineHeight: 1.7,
                  fontSize: '15px',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                Norges mest avanserte kreative plattform for profesjonelle fotografer, videografer
                og musikkprodusenter.
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: '#374151',
                  mb: 4,
                  lineHeight: 1.6,
                  textAlign: 'center',
                }}
              >
                Vi tilbyr en komplett løsning for prosjektadministrasjon, klienthåndtering og
                kreative verktøy.
              </Typography>

              {/* Enhanced Feature List */}
              <Stack spacing={2.5} sx={{ mb: 4 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,140,0,0.03)',
                    borderRadius: '12px',
                    p: 1.5,
                    border: '1px solid rgba(255,140,0,0.1)',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,140,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <CheckCircle sx={{ color: '#ff6b35', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#1f2937', fontWeight: 'medium' }}>
                    Profesjonell prosjektadministrasjon
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(76,175,80,0.03)',
                    borderRadius: '12px',
                    p: 1.5,
                    border: '1px solid rgba(76,175,80,0.1)',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(76,175,80,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <CheckCircle sx={{ color: '#4caf50', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#333', fontWeight: 'medium' }}>
                    Avanserte kreative verktøy
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(33,150,243,0.03)',
                    borderRadius: '12px',
                    p: 1.5,
                    border: '1px solid rgba(33,150,243,0.1)',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(33,150,243,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <CheckCircle sx={{ color: '#2196f3', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#333', fontWeight: 'medium' }}>
                    Klientgallerier og leveranse
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(156,39,176,0.03)',
                    borderRadius: '12px',
                    p: 1.5,
                    border: '1px solid rgba(156,39,176,0.1)',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(156,39,176,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                    }}
                  >
                    <CheckCircle sx={{ color: '#9c27b0', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#1f2937', fontWeight: 'medium' }}>
                    Norsk leverandørnettverk
                  </Typography>
                </Box>
              </Stack>

              {/* Enhanced Les Mer Om Oss Button */}
              <Button
                variant="contained"
                fullWidth
                onClick={() => handleNavigation('/about')}
                sx={{
                  background: `linear-gradient(45deg, ${'#ff6b35'}, #e67c00)`,
                  color: 'white',
                  py: 1.8,
                  px: 3,
                  minHeight: '56px',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  boxShadow: '0 8px 20px rgba(255,140,0,0.25)',
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #e67c00, #d97706)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 30px rgba(255,140,0,0.35)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 4px 15px rgba(255,140,0,0.25)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    transition: 'left 0.5s',
                  },
                  '&:hover::before': {
                    left: '100%',
                  },
                }}
              >
                <MenuBook sx={{ mr: 1.5, fontSize: 20 }} />
                Les Mer Om Oss
              </Button>
            </CardContent>
          </MuiCard>
        </Box>
      </Container>

      {/* Compact Professional Features Footer */}
      <Container maxWidth="sm" sx={{ py: 1, pb: 6 }}>
        {/* Features Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            mb: 2,
          }}
        >
          {/* Klient Samarbeid */}
          <MuiCard
            sx={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: '12px',
              boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,193,7,0.2)',
            }}
          >
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255,193,7,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1,
                  }}
                >
                  <Group sx={{ color: '#ffc107', fontSize: 14 }} />
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: '#1f2937',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                >
                  Klient Samarbeid
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#6b7280',
                  fontSize: '10px',
                  display: 'block',
                }}
              >
                Klientgallerier • Kommentarer • Godkjenning
              </Typography>
            </CardContent>
          </MuiCard>

          {/* Digital Asset Management */}
          <MuiCard
            sx={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: '12px',
              boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
              border: '1px solid rgba(33,150,243,0.2)',
            }}
          >
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '6px',
                    backgroundColor: 'rgba(33,150,243,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1,
                  }}
                >
                  <PhotoCamera sx={{ color: '#2196f3', fontSize: 14 }} />
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: '#1f2937',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                >
                  Asset Management
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#6b7280',
                  fontSize: '10px',
                  display: 'block',
                }}
              >
                Metadata • Versjonskontroll • Backup
              </Typography>
            </CardContent>
          </MuiCard>

          {/* Kontraktadministrasjon */}
          <MuiCard
            sx={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: '12px',
              boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
              border: '1px solid rgba(156,39,176,0.2)',
            }}
          >
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '6px',
                    backgroundColor: 'rgba(156,39,176,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1,
                  }}
                >
                  <Business sx={{ color: '#9c27b0', fontSize: 14 }} />
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: '#1f2937',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                >
                  Kontrakter
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#6b7280',
                  fontSize: '10px',
                  display: 'block',
                }}
              >
                Bryllup • Bedrift • Rettigheter
              </Typography>
            </CardContent>
          </MuiCard>

          {/* Forretningsstyring */}
          <MuiCard
            sx={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: '12px',
              boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,152,0,0.2)',
            }}
          >
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255,152,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1,
                  }}
                >
                  <AutoAwesome sx={{ color: '#ff9800', fontSize: 14 }} />
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: '#1f2937',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                >
                  Forretning
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#6b7280',
                  fontSize: '10px',
                  display: 'block',
                }}
              >
                Fakturering • MVA • Analyse
              </Typography>
            </CardContent>
          </MuiCard>
        </Box>

        {/* Utstyrsadministrasjon - Full width */}
        <MuiCard
          sx={{
            mb: 1.5,
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: '12px',
            boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
            border: '1px solid rgba(76,175,80,0.2)',
          }}
        >
          <CardContent sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '6px',
                  backgroundColor: 'rgba(76,175,80,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1,
                }}
              >
                <Inventory sx={{ color: '#4caf50', fontSize: 14 }} />
              </Box>
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: '#1f2937',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                >
                  Utstyrsadministrasjon
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#6b7280',
                    fontSize: '10px',
                  }}
                >
                  Database • Vedlikehold • Forsikring
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </MuiCard>

        {/* Compact Contact Footer */}
        <Box
          sx={{
            textAlign: 'center',
            py: 1,
            borderTop: '1px solid rgba(255,140,0,0.1)',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#6b7280',
              fontSize: '10px',
              mb: 0.25,
            }}
          >
            © 2025 CreatorHub Norge
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#6b7280',
              fontSize: '9px',
            }}
          >
            kontakt@creatorhubn.no • +47 97 95 92 94
          </Typography>
        </Box>
      </Container>

      {/* Bottom Navigation */}
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: 0,
          backgroundColor: 'rgba(255,140,0,0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            py: 1,
            px: 2,
          }}
        >
          {/* Hjem knapp - alltid synlig */}
          <Button
            onClick={() => handleNavigation('/')}
            aria-label="Gå til hjemmeside"
            sx={{
              backgroundColor: 'transparent',
              color: 'white',
              borderRadius: '12px',
              minWidth: '60px',
              minHeight: '48px',
              py: 0.5,
              px: 1,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.1)',
                transform: 'translateY(-1px)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Home sx={{ fontSize: 20, mb: 0.25 }} />
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontSize: '10px',
                  fontWeight: 'medium',
                }}
              >
                Hjem
              </Typography>
            </Box>
          </Button>

          {/* Fotograf knapp - kun for fotografer og admin */}
          {isAuthenticated && canAccessProfession('photographer') && (
            <Button
              onClick={() => handleNavigation('/photographer-dashboard-material')}
              aria-label="Fotograf dashboard"
              sx={{
                backgroundColor: 'transparent',
                color: 'white',
                borderRadius: '12px',
                minWidth: '60px',
                minHeight: '48px',
                py: 0.5,
                px: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <PhotoCamera sx={{ fontSize: 20, mb: 0.25 }} />
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 'medium',
                  }}
                >
                  Foto
                </Typography>
              </Box>
            </Button>
          )}

          {/* Videograf knapp - kun for videografer og admin */}
          {isAuthenticated && canAccessProfession('videographer') && (
            <Button
              onClick={() => handleNavigation('/videographer-dashboard')}
              aria-label="Videograf dashboard"
              sx={{
                backgroundColor: 'transparent',
                color: 'white',
                borderRadius: '12px',
                minWidth: '60px',
                minHeight: '48px',
                py: 0.5,
                px: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <VideoLibrary sx={{ fontSize: 20, mb: 0.25 }} />
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 'medium',
                  }}
                >
                  Video
                </Typography>
              </Box>
            </Button>
          )}

          {/* Musikk knapp - kun for musikk produsenter og admin */}
          {isAuthenticated && canAccessProfession('music_producer') && (
            <Button
              onClick={() => handleNavigation('/music-producer-dashboard')}
              aria-label="Musikk produsent dashboard"
              sx={{
                backgroundColor: 'transparent',
                color: 'white',
                borderRadius: '12px',
                minWidth: '60px',
                minHeight: '48px',
                py: 0.5,
                px: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <LibraryMusic sx={{ fontSize: 20, mb: 0.25 }} />
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 'medium',
                  }}
                >
                  Musikk
                </Typography>
              </Box>
            </Button>
          )}

          {/* Vendor knapp - kun for vendors og admin */}
          {isAuthenticated && canAccessProfession('vendor') && (
            <Button
              onClick={() => handleNavigation('/vendor-dashboard')}
              aria-label="Vendor dashboard"
              sx={{
                backgroundColor: 'transparent',
                color: 'white',
                borderRadius: '12px',
                minWidth: '60px',
                minHeight: '48px',
                py: 0.5,
                px: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Business sx={{ fontSize: 20, mb: 0.25 }} />
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 'medium',
                  }}
                >
                  Vendor
                </Typography>
              </Box>
            </Button>
          )}

          <Button
            onClick={() => setModalState((prev) => ({ ...prev, showSidebar: true }))}
            aria-label="Åpne meny"
            sx={{
              backgroundColor: 'transparent',
              color: 'white',
              borderRadius: '12px',
              minWidth: '60px',
              minHeight: '48px',
              py: 0.5,
              px: 1,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.1)',
                transform: 'translateY(-1px)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Menu sx={{ fontSize: 20, mb: 0.25 }} />
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontSize: '10px',
                  fontWeight: 'medium',
                }}
              >
                Meny
              </Typography>
            </Box>
          </Button>
        </Box>
      </Paper>

      {/* Sidebar Drawer */}
      <Drawer
        anchor="right"
        open={modalState.showSidebar}
        onClose={() => setModalState((prev) => ({ ...prev, showSidebar: false }))}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            backgroundColor: 'rgba(255,140,0,0.98)',
            backdropFilter: 'blur(10px)',
            color: 'white',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
              CreatorHub Norge
            </Typography>
            <IconButton
              onClick={() => setModalState((prev) => ({ ...prev, showSidebar: false }))}
              sx={{ color: 'white' }}
            >
              <Close />
            </IconButton>
          </Box>

          <List>
            {!isAuthenticated && (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => setModalState((prev) => ({ ...prev, showLoginModal: true }))}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon>
                    <Person sx={{ color: 'white' }} />
                  </ListItemIcon>
                  <ListItemText primary="Logg inn" />
                </ListItemButton>
              </ListItem>
            )}

            {/* Main Dashboards - kun for autentiserte brukere */}
            {isAuthenticated && canAccessProfession('photographer') && (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/photographer-dashboard-material')}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon>
                    <PhotoCamera sx={{ color: 'white' }} />
                  </ListItemIcon>
                  <ListItemText primary="Fotograf Dashboard" />
                </ListItemButton>
              </ListItem>
            )}

            {isAuthenticated && canAccessProfession('videographer') && (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/videographer-dashboard')}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon>
                    <VideoLibrary sx={{ color: 'white' }} />
                  </ListItemIcon>
                  <ListItemText primary="Videograf Dashboard" />
                </ListItemButton>
              </ListItem>
            )}

            {isAuthenticated && canAccessProfession('music_producer') && (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/music-producer-dashboard')}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon>
                    <LibraryMusic sx={{ color: 'white' }} />
                  </ListItemIcon>
                  <ListItemText primary="Musikk Dashboard" />
                </ListItemButton>
              </ListItem>
            )}

            {isAuthenticated && canAccessProfession('vendor') && (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/vendor-dashboard')}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon>
                    <Business sx={{ color: 'white' }} />
                  </ListItemIcon>
                  <ListItemText primary="Leverandør Dashboard" />
                </ListItemButton>
              </ListItem>
            )}

            {/* Admin Dashboard - kun for admin */}
            {isAuthenticated && isAdmin && (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/admin')}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <ListItemIcon>
                    <Dashboard sx={{ color: 'white' }} />
                  </ListItemIcon>
                  <ListItemText primary="Admin Dashboard" />
                </ListItemButton>
              </ListItem>
            )}

            {isAuthenticated && (
              <Divider sx={{ my: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            )}

            {/* Creative Tools - kun for autentiserte brukere */}
            {isAuthenticated && (
              <>
                <Typography
                  variant="subtitle2"
                  sx={{
                    px: 2,
                    mb: 1,
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 'medium',
                  }}
                >
                  Kreative verktøy
                </Typography>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/photo-showcase')}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <PhotoCamera sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText primary="Fotogalleri" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/video-showcase')}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <VideoLibrary sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText primary="Videobibliotek" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/equipment-rental')}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <Inventory sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText primary="Utstyrsutleie" />
                  </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />

                {/* Academy & Learning */}
                <Typography
                  variant="subtitle2"
                  sx={{
                    px: 2,
                    mb: 1,
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 'medium',
                  }}
                >
                  Læring og hjelp
                </Typography>

                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/academy')}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <MenuBook sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText primary="CreatorHub Academy" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/help')}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <Help sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText primary="Hjelpeguider" />
                  </ListItemButton>
                </ListItem>

                <Divider sx={{ my: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />

                {/* Settings */}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/settings')}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <Settings sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText primary="Innstillinger" />
                  </ListItemButton>
                </ListItem>
              </>
            )}

            <Divider sx={{ my: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />

            {/* Information - alltid synlig */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => handleNavigation('/about-us')}
                sx={{
                  borderRadius: '8px',
                  mb: 0.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <ListItemIcon>
                  <Info sx={{ color: 'white' }} />
                </ListItemIcon>
                <ListItemText primary="Om Oss" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Enhanced Role Selector Modal */}
      <Dialog
        open={modalState.showRoleSelector}
        onClose={handleCloseModals}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,248,235,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 64px rgba(255,140,0,0.2), 0 0 0 1px rgba(255,140,0,0.1)',
            border: '2px solid rgba(255,140,0,0.15)',
            overflow: 'hidden',
          },
        }}
      >
        {/* Decorative header gradient */}
        <Box
          sx={{
            height: '8px',
            background: `linear-gradient(90deg, ${'#ff6b35'}, #ffb347, #ffd700, #ffb347, ${'#ff6b35'})`,
            backgroundSize: '400% 100%',
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        />

        <DialogTitle
          sx={{
            textAlign: 'center',
            py: 4,
            background: `linear-gradient(135deg, ${'#ff6b35'}, #e67c00)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '28px',
            fontWeight: 'bold',
            position: 'relative',
          }}
        >
          <AutoAwesome sx={{ color: '#ff6b35', fontSize: 32, mb: 1, display: 'block' }} />
          Velg din kreative rolle
          <Typography
            variant="body2"
            sx={{
              color: '#6b7280',
              fontWeight: 'normal',
              mt: 1,
              WebkitTextFillColor: '#6b7280',
            }}
          >
            Start din profesjonelle reise med CreatorHub Norge
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 4, pb: 4 }}>
          {/* Professional Role Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 3,
              mt: 2,
            }}
          >
            {[
              {
                role: 'photographer',
                label: 'Fotograf',
                icon: <PhotoCamera sx={{ fontSize: 32 }} />,
                color: '#2e7d32',
                description: 'Bryllup, portrett, events og mer',
                gradient:
                  'linear-gradient(135deg, rgba(46,125,50,0.1) 0%, rgba(76,175,80,0.05) 100%)',
              },
              {
                role: 'videographer',
                label: 'Videograf',
                icon: <VideoLibrary sx={{ fontSize: 32 }} />,
                color: '#1565c0',
                description: 'Produksjon, redigering og levering',
                gradient:
                  'linear-gradient(135deg, rgba(21,101,192,0.1) 0%, rgba(33,150,243,0.05) 100%)',
              },
              {
                role: 'music_producer',
                label: 'Musikk Produsent',
                icon: <LibraryMusic sx={{ fontSize: 32 }} />,
                color: '#7b1fa2',
                description: 'Opptak, miksing og mastering',
                gradient:
                  'linear-gradient(135deg, rgba(123,31,162,0.1) 0%, rgba(156,39,176,0.05) 100%)',
              },
              {
                role: 'vendor',
                label: 'Leverandør',
                icon: <Business sx={{ fontSize: 32 }} />,
                color: '#d97706',
                description: 'Utstyr, tjenester og produkter',
                gradient:
                  'linear-gradient(135deg, rgba(217,119,6,0.1) 0%, rgba(255,140,0,0.05) 100%)',
              },
              {
                role: 'prototype_tester',
                label: 'Prototype Tester',
                icon: <Science sx={{ fontSize: 32 }} />,
                color: '#e65100',
                description: 'Test nye funksjoner og verktøy',
                gradient:
                  'linear-gradient(135deg, rgba(230,81,0,0.1) 0%, rgba(255,87,34,0.05) 100%)',
              },
            ].map((item) => (
              <MuiCard
                key={item.role}
                onClick={() => handleRoleSelection(item.role)}
                sx={{
                  p: 3,
                  borderRadius: '20px',
                  background: item.gradient,
                  border: `2px solid ${item.color}20`,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gridColumn: item.role === 'prototype_tester' ? { xs: '1', sm: '1 / -1' } : 'auto',
                  maxWidth: item.role === 'prototype_tester' ? '300px' : 'auto',
                  mx: item.role === 'prototype_tester' ? 'auto' : 'initial',
                  '&:hover': {
                    transform: 'translateY(-8px) scale(1.02)',
                    boxShadow: `0 20px 40px ${item.color}20, 0 0 0 1px ${item.color}40`,
                    background: `linear-gradient(135deg, ${item.color}15 0%, ${item.color}08 100%)`,
                    '& .role-icon': {
                      transform: 'scale(1.1) rotate(5deg)',
                      color: item.color,
                    },
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(90deg, transparent, ${item.color}10, transparent)`,
                    transition: 'left 0.5s ease-in-out',
                  },
                  '&:hover::before': {
                    left: '100%',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '16px',
                    background: `${item.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    border: `1px solid ${item.color}30`,
                  }}
                >
                  <Box
                    className="role-icon"
                    sx={{
                      color: item.color,
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </Box>
                </Box>

                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    color: '#1f2937',
                    mb: 1,
                    fontSize: '18px',
                  }}
                >
                  {item.label}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: '#6b7280',
                    fontSize: '14px',
                    lineHeight: 1.4,
                  }}
                >
                  {item.description}
                </Typography>
              </MuiCard>
            ))}
          </Box>

          {/* Call to action */}
          <Box
            sx={{
              textAlign: 'center',
              mt: 4,
              pt: 3,
              borderTop: '1px solid rgba(255,140,0,0.2)',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: '#6b7280',
                mb: 2,
                fontSize: '14px',
              }}
            >
              Få tilgang til profesjonelle verktøy, prosjektadministrasjon og leverandørnettverk
            </Typography>
            <Button
              variant="outlined"
              onClick={handleCloseModals}
              sx={{
                borderColor: '#d1d5db',
                color: '#6b7280',
                borderRadius: '12px',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#9ca3af',
                  backgroundColor: 'rgba(107,114,128,0.05)',
                },
              }}
            >
              Avbryt
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Login Modal - Lazy loaded */}
      {modalState.showLoginModal && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <LoginModal
            open={modalState.showLoginModal}
            onClose={() => setModalState((prev) => ({ ...prev, showLoginModal: false }))}
          />
        </React.Suspense>
      )}

      {/* Invite Request Modal */}
      <Dialog
        open={modalState.showInviteRequest}
        onClose={handleCloseModals}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {modalState.showInviteRequest && (
            <React.Suspense fallback={<div>Loading...</div>}>
              <InviteRequestForm
                isOpen={modalState.showInviteRequest}
                onClose={handleCloseModals}
                selectedRole={modalState.selectedRole}
                onSuccess={handleCloseModals}
                onCancel={handleCloseModals}
              />
            </React.Suspense>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

// Export directly without wrapper for testing
export default LandingMobile;
