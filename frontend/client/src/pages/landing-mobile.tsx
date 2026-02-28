import React from 'react';
import { useTheming } from '../utils/theming-helper';
import GdprNotice from '@/components/common/GdprNotice';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';

// PERFORMANCE: Asset preloading for critical resources
const preloadCriticalAssets = () => {
  if (typeof document !== 'undefined') {
    // Preload critical image assets
    const preloadLinks = [
      { rel: 'preload', href: '/creatorhub-logo-amber.svg', as: 'image' },
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
    0%, 100% { transform: translateY(0px) translateZ(0) }
    50% { transform: translateY(-15px) translateZ(0) }
}
  @keyframes shimmer {
    0% { background-position: -200% 0 }
    100% { background-position: 200% 0 }
}
    @keyframes pulseGlow {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255, 140, 0, 0)); opacity: 0.9; }
      50% { transform: scale(1.05); filter: drop-shadow(0 0 20px rgba(255, 140, 0, 0.45)); opacity: 1; }
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
  .video-loading-logo {
    animation: pulseGlow 2.4s ease-in-out infinite;
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
    .video-loading-logo {
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
  BOX_SHADOW_LIGHT: '0 2px 8px rgba(0,0,0,0.08)',
  BOX_SHADOW_MEDIUM: '0 4px 16px rgba(0,0,0,0.12)',
  BOX_SHADOW_STRONG: '0 8px 32px rgba(255,140,0,0.16), 0 4px 12px rgba(0,0,0,0.08)',
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
  DialogActions,
  Grid2,
} from '@mui/material';
import {
  Home,
  VideoLibrary,
  LibraryMusic,
  Business,
  CheckCircle,
  Group,
  Inventory,
  CameraAlt,
  AutoAwesome,
  Person,
  Science,
  Article,
  Menu,
  Close,
  Dashboard,
  Settings,
  Help,
  Info,
  KeyboardArrowRight,
  AccountCircle,
  Store,
  Security,
  RocketLaunch,
  Adjust,
  PhotoCamera,
  Work,
  ArrowForward,
  PlayArrow,
  Assessment,
  MenuBook,
  Email,
  Phone,
  LocationOn,
  Login,
  School,
  People,
} from '@mui/icons-material';
import { Chip } from '@mui/material';
// PERFORMANCE: Lazy load non-critical components for faster initial load
const LoginModal = React.lazy(() => import('@/components/auth/LoginModal'));
const InviteRequestForm = React.lazy(() => import('@/components/InviteRequestForm'));
const UniversalOnboarding = React.lazy(() => import('@/components/UniversalOnboarding'));
const SubscriptionSelectionFlow = React.lazy(() => import('@/components/subscription/SubscriptionSelectionFlow'));
// const SentryTestComponent = React.lazy(() => import('@/components/test/SentryTestComponent'));
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from "@/lib/queryClient";
import { Grid } from '@mui/material';
import { PrototypeTesterIcon } from '@/components/icons/PrototypeTesterIcon';
import { usePublishedPageCustomizations } from '@/hooks/usePageCustomizations';

// Type for auth status response
interface AuthStatusResponse {
  authenticated: boolean;
  user?: {
    id?: number;
    email?: string;
    profession?: string;
    userType?: string;
    isAdmin?: boolean;
  };
}

// DynamicPlatformStats component for real-time platform statistics
const DynamicPlatformStats: React.FC = () => {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/platform/stats"],
    queryFn: () => apiRequest("/api/platform/stats"),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Don't render anything while loading or if no data
  if (isLoading || error || !stats?.showStats) {
    return null;
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k+";
    }
    return num.toString() + "+";
  };

  return (
    <Grid container spacing={2} sx={{ mt: 2 }}>
      <Grid item xs={4}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h6"
            sx={{ color: "#ff8c00", fontWeight: "bold" }}
          >
            {formatNumber(stats.users.active)}
          </Typography>
          <Typography variant="caption" sx={{ color: "#374151", fontSize: '10px' }}>
            Aktive Brukere
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={4}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h6"
            sx={{ color: "#ff8c00", fontWeight: "bold" }}
          >
            {formatNumber(stats.projects.completed)}
          </Typography>
          <Typography variant="caption" sx={{ color: "#374151", fontSize: '10px' }}>
            Prosjekter
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={4}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h6"
            sx={{ color: "#ff8c00", fontWeight: "bold" }}
          >
            {stats.satisfaction.percentage}%
          </Typography>
          <Typography variant="caption" sx={{ color: "#374151", fontSize: '10px' }}>
            Tilfredshet
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

// CreatorHubLogoIcon component
const CreatorHubLogoIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    viewBox="0 0 40 40"
    width={size}
    height={size}
    style={{ display: 'block' }}
  >
    <defs>
      <linearGradient id="btnLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    {/* Background circle */}
    <circle cx="20" cy="20" r="18" fill="url(#btnLogoGrad)" />
    {/* Creative Tools Icon */}
    <g transform="translate(8, 8)">
      {/* Central Pencil */}
      <path d="M12 4 L12 18 L10 20 L8 18 L8 16 L6 16 L6 6 L8 4 Z" fill="white" opacity="0.95"/>
      <polygon points="8,4 10,2 12,4" fill="rgba(255,255,255,0.7)"/>
      {/* Camera - top right */}
      <circle cx="18" cy="7" r="3" fill="white" opacity="0.9"/>
      <rect x="17" y="6" width="2" height="2" rx="0.3" fill="url(#btnLogoGrad)"/>
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
      <circle cx="4" cy="16" r="0.8" fill="url(#btnLogoGrad)"/>
      <circle cx="6" cy="16" r="0.8" fill="#f59e0b"/>
      <circle cx="5" cy="18" r="0.8" fill="#ea580c"/>
      <line x1="8" y1="15" x2="8" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8"/>
    </g>
  </svg>
);

interface LandingPartnerCustomization {
  enabled?: boolean;
  title?: string;
  description?: string;
  logoUrl?: string;
  ctaLabel?: string;
  dialogTitle?: string;
  dialogBody?: string;
  dialogBullets?: string | string[];
}

interface LandingVideoCustomization {
  enabled?: boolean;
  showEmbeddedVideo?: boolean;
  title?: string;
  description?: string;
  videoUrl?: string;
  posterUrl?: string;
  autoPlay?: boolean;
  loop?: boolean;
  showControls?: boolean;
  showLoadingLogo?: boolean;
}

interface LandingCinematicCustomization {
  enabled?: boolean;
  contrast?: number;
  saturate?: number;
  overlayTopOpacity?: number;
  overlayBottomOpacity?: number;
  glowWarmOpacity?: number;
  glowCoolOpacity?: number;
}

interface LandingCustomizationProps {
  partnerSection?: LandingPartnerCustomization;
  videoSection?: LandingVideoCustomization;
  cinematic?: LandingCinematicCustomization;
}

const LandingMobile: React.FC<LandingCustomizationProps> = ({
  partnerSection,
  videoSection,
  cinematic,
}) => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { profession } = useProfessionAdapter();

  // Theming system - use dynamic profession
  const _theming = useTheming(profession || 'photographer');
  const defaultVideoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  const defaultPoster = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='%23fff7ed'/><stop offset='100%' stop-color='%23ffedd5'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/><rect x='80' y='80' width='1120' height='560' fill='none' stroke='%23fdba74' stroke-width='6' rx='24'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial' font-size='48' letter-spacing='2'>VIDEO%20POSTER</text></svg>";
  const { data: pageCustomizations } = usePublishedPageCustomizations('landing-mobile');
  const pageSections = pageCustomizations?.sections || {};

  const defaultHeroSection = {
    badgeLabel: 'CreatorHub Norge - Profesjonell Kreativ Plattform',
    titleLineOne: 'Profesjonell Kreativ',
    titleLineTwo: 'Plattform',
    subtitle:
      'Alt-i-ett plattform for kreative i Norge. StoryArc Studio, Academy, Community, og sømløse integrasjoner. Alt du trenger for å vokse.',
    primaryCtaLabel: 'Bli med i CreatorHub',
    secondaryCtaLabel: 'Logg inn',
  };
  const heroSection = { ...defaultHeroSection, ...(pageSections.hero || {}) };

  const defaultFeatures = {
    badgeLabel: 'Plattformen for de kreative',
    title: 'Hvorfor',
    highlight: 'CreatorHub Norge',
    subtitle: 'Alt du trenger for å drive en profesjonell kreativ virksomhet i Norge',
    items: [
      {
        title: 'Prosjektadministrasjon',
        description: 'Effektiv prosjektstyring med intelligente løsninger for planlegging, produksjon og post-produksjon.',
      },
      {
        title: 'StoryArc Studio',
        description: 'Profesjonell videoredigering som analyserer innholdet ditt og genererer story arcs automatisk.',
      },
      {
        title: 'Integrasjoner',
        description: 'Sømløs integrasjon med verktøyene du bruker. Google Workspace, DaVinci Resolve, Final Cut Pro, Premiere Pro.',
      },
      {
        title: 'Academy & Community',
        description: 'Lær nye ferdigheter med kurs og tutorials. Koble deg til andre kreative i vårt community.',
      },
    ],
  };
  const featuresSection = { ...defaultFeatures, ...(pageSections.features || {}) };

  const defaultCta = {
    titlePrefix: 'Klar til å',
    highlight: 'revolutjonere',
    titleSuffix: 'din kreative virksomhet?',
    subtitle:
      'Bli med i CreatorHub Norge i dag og opplev forskjellen profesjonelle verktøy kan gjøre.',
    ctaLabel: 'Bli en del av CreatorHub Norge',
  };
  const ctaSection = { ...defaultCta, ...(pageSections.cta || {}) };

  const defaultFooter = {
    content:
      'Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter.',
    contactEmail: 'daniel@creatorhubn.com',
    contactPhone: '+47 97 95 92 94',
    contactLocation: 'Norge',
    privacyLabel: 'Personvern & GDPR',
    items: [
      { title: 'Hjem', description: '/' },
      { title: 'Om Oss', description: '/about-us' },
      { title: 'Logg Inn', description: 'login' },
      { title: 'Kom i Gang', description: 'cta' },
    ],
  };
  const footerSection = { ...defaultFooter, ...(pageSections.footer || {}) };

  const featureItems = Array.isArray(featuresSection.items) && featuresSection.items.length > 0
    ? featuresSection.items
    : defaultFeatures.items;
  const footerLinks = Array.isArray(footerSection.items) && footerSection.items.length > 0
    ? footerSection.items
    : defaultFooter.items;

  const videoOverrides = { ...(pageSections.video || {}), ...(videoSection || {}) };
  const partnerOverrides = { ...(pageSections.partner || {}), ...(partnerSection || {}) };
  const cinematicOverrides = { ...(pageSections.cinematic || {}), ...(cinematic || {}) };
  const videoConfig = {
    enabled: videoOverrides.enabled ?? true,
    showEmbeddedVideo: videoOverrides.showEmbeddedVideo ?? true,
    title: videoOverrides.title || "Use case-video kommer her",
    description:
      videoOverrides.description ||
      "Plassholder for video som viser samarbeid, flyt og resultater.",
    videoUrl: videoOverrides.videoUrl || defaultVideoUrl,
    posterUrl: videoOverrides.posterUrl || defaultPoster,
    autoPlay: videoOverrides.autoPlay ?? true,
    loop: videoOverrides.loop ?? true,
    showControls: videoOverrides.showControls ?? true,
    showLoadingLogo: videoOverrides.showLoadingLogo ?? true,
  };
  const partnerConfig = {
    enabled: partnerOverrides.enabled ?? true,
    title: partnerOverrides.title || "Samarbeidspartner",
    description:
      partnerOverrides.description ||
      "Evendi gir brudeparene flyt og forutsigbarhet. CreatorHub Norge sørger for at du leverer med profesjonalitet og lønnsomhet.",
    logoUrl: partnerOverrides.logoUrl || "/evendi-logo.png",
    ctaLabel: partnerOverrides.ctaLabel || "Les mer om samarbeidet",
    dialogTitle: partnerOverrides.dialogTitle || "Samarbeid med Evendi",
    dialogBody:
      partnerOverrides.dialogBody ||
      "Evendi samler brudepar og leverandører i en premium bryllupsreise. Vi kobler deg inn med profesjonell prosjektstyring, trygg kommunikasjon og en tydelig leveranseflyt.\n\nSamarbeidet betyr flere kvalifiserte oppdrag, bedre kontroll og en opplevelse som skiller deg ut i markedet.",
    dialogBullets:
      partnerOverrides.dialogBullets ||
      "Flere premium leads\nRyddigere samarbeid\nHøyere kundetilfredshet",
  };
  const cinematicConfig = {
    enabled: cinematicOverrides.enabled ?? true,
    contrast: cinematicOverrides.contrast ?? 1.08,
    saturate: cinematicOverrides.saturate ?? 1.1,
    overlayTopOpacity: cinematicOverrides.overlayTopOpacity ?? 0.5,
    overlayBottomOpacity: cinematicOverrides.overlayBottomOpacity ?? 0.6,
    glowWarmOpacity: cinematicOverrides.glowWarmOpacity ?? 0.22,
    glowCoolOpacity: cinematicOverrides.glowCoolOpacity ?? 0.12,
  };
  const [isVideoReady, setIsVideoReady] = React.useState(false);

  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  // Fetch dynamic professions from wizard
  const { data: dynamicProfessions, isLoading: _professionsLoading } = useQuery({
    queryKey: ['/api/professions/all'],
    queryFn: () => apiRequest('/api/professions/all'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1 });
  
  // Merge dynamic professions with static fallback
  const allProfessions = React.useMemo(() => {
    const staticProfessions = [
      { role: 'photographer', label: getProfessionDisplayName('photographer'), icon: <CameraAlt sx={{ fontSize: 32}} />, color: '#2e7d32', description: 'Bryllup, portrett, events og mer', gradient: 'linear-gradient(135deg, rgba(46,125,50,0.1) 0%, rgba(46,125,50,0.05) 100%)', isStatic: false },
      { role: 'videographer', label: getProfessionDisplayName('videographer'), icon: <VideoLibrary sx={{ fontSize: 32}} />, color: '#1565c0', description: 'Produksjon, redigering og levering', gradient: 'linear-gradient(135deg, rgba(21,101,192,0.1) 0%, rgba(21,101,192,0.05) 100%)', isStatic: false },
      { role: 'music_producer', label: getProfessionDisplayName('music_producer'), icon: <LibraryMusic sx={{ fontSize: 32}} />, color: '#7b1fa2', description: 'Opptak, miksing og mastering', gradient: 'linear-gradient(135deg, rgba(123,31,162,0.1) 0%, rgba(123,31,162,0.05) 100%)', isStatic: false },
      { role: 'vendor', label: getProfessionDisplayName('vendor'), icon: <Business sx={{ fontSize: 32}} />, color: '#ff8c00', description: 'Utstyr, tjenester og produkter', gradient: 'linear-gradient(135deg, rgba(255,140,0,0.1) 0%, rgba(255,140,0,0.05) 100%)', isStatic: false },
      { role: 'enterprise', label: 'Enterprise Team', icon: <Group sx={{ fontSize: 32}} />, color: '#6c3483', description: 'Kombiner foto og video i ett team-dashbord', gradient: 'linear-gradient(135deg, rgba(108,52,131,0.1) 0%, rgba(108,52,131,0.05) 100%)', isStatic: false, badge: <Box component="span" sx={{ display: 'inline-flex', gap: 0.5, ml: 1 }}><CameraAlt sx={{ fontSize: 14 }} /><VideoLibrary sx={{ fontSize: 14 }} /></Box> }
    ];
    
    // Prototype Tester - ALWAYS included as meta-profession (admin-controlled)
    const prototypeTester = { 
      role: 'prototype_tester', 
      label: 'Prototype Tester', 
      icon: <PrototypeTesterIcon size={32} />, 
      color: '#8b5cf6', 
      description: 'Test nye funksjoner (Krever admin-godkjenning)', 
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
      isStatic: true, // Always available
      requiresApproval: true // Special access
    };
    
    if (dynamicProfessions?.professions && dynamicProfessions.professions.length > 0) {
      console.log('Mobile landing using dynamic professions: ', dynamicProfessions.professions.length);
      console.log('Prototype Tester kept as static meta-profession');
      
      // Map dynamic professions to landing page format
      const mapped = dynamicProfessions.professions.map((prof: any) => {
        const color = prof.color || '#2196f3';
        return {
          role: prof.professionId,
          label: prof.displayName || prof.professionId,
          icon: <Work sx={{ fontSize: 32}} />,
          color: color,
          description: prof.description || 'Wizard-created profession',
          gradient: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
          isDynamic: true,
          isStatic: false
        };
      });
      
      // ALWAYS append Prototype Tester at the end
      return [...mapped, prototypeTester];
    }
    
    // Fallback: static professions + prototype tester
    return [...staticProfessions, prototypeTester];
  }, [dynamicProfessions]);

  // Google Workspace dialog state
  const [googleWorkspaceDialogOpen, setGoogleWorkspaceDialogOpen] = React.useState(false);

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
        'content','Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter. Strømlinjeforme arbeidsflyt, forbedre samarbeid og lever skreddersydde opplevelser.'
    );

      // Add Open Graph tags for social media sharing
      const ogTags = [
        {
          property: 'og:title',
          content: 'CreatorHub Norge - Profesjonell Kreativ Plattform',
    },
        {
          property: 'og:description',
          content: 'Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter.',
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
    showSubscriptionSelection: false,
    showLoginModal: false,
    showInviteRequest: false,
    showOnboarding: false,
    showPartnerDialog: false,
    selectedRole: '',
    selectedPlan: null as any,
  });

  // Comprehensive modal cleanup function med state consistency
  const resetAllModals = React.useCallback(() => {
    setModalState({
      showSidebar: false,
      showRoleSelector: false,
      showSubscriptionSelection: false,
      showLoginModal: false,
      showInviteRequest: false,
      showOnboarding: false,
      showPartnerDialog: false,
      selectedRole: ', ',
      selectedPlan: null,
    });
    console.log('All modals reset to closed state');
  }, []);

  // Listen for billing and feature updates from unified workflow
  React.useEffect(() => {
    const handleWorkflowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BILLING_UPDATE') {
        console.log('Billing Update Received:', event.data);
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
            selectedRole: ', ',
      }));
    } else if (modalState.showRoleSelector) {
          setModalState((prev) => ({
            ...prev,
            showRoleSelector: false,
            selectedRole: ', ',
      }));
    } else if (modalState.showLoginModal) {
          setModalState((prev) => ({ ...prev, showLoginModal: false }));
    } else if (modalState.showSidebar) {
          setModalState((prev) => ({ ...prev, showSidebar: false }));
        } else if (modalState.showPartnerDialog) {
          setModalState((prev) => ({ ...prev, showPartnerDialog: false }));
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

  // PERFORMANCE: User data - DISABLED: Auto-authenticated
  // Authentication disabled - use mock data
  const authData = {
    authenticated: true,
    user: {
      id: 'local-user',
      email: 'user@local.dev',
      name: 'Local User',
      profession: 'photographer',
      userType: 'photographer',
      isAdmin: true
    }
  };
  const userLoading = false;

  const isAuthenticated = true;
  const currentUser = authData.user;
  const userProfession = currentUser?.profession || currentUser?.userType;
  const isAdmin = true;

  // Listen for 'auth-changed' event from LoginModal
  React.useEffect(() => {
    const handleAuthChanged = () => {
      console.log('Auth state changed, refetching user data...');
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-changed', handleAuthChanged);
  }, [queryClient]);

  // Check onboarding status after login
  React.useEffect(() => {
    if (isAuthenticated && currentUser) {
      (async () => {
        try {
          // Check onboarding status
          const response = await fetch('/api/user/onboarding-status', {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Onboarding status:', data);

            if (data.needsOnboarding) {
              console.log('User needs onboarding - showing UniversalOnboarding');
              setModalState((prev) => ({ ...prev, showOnboarding: true }));
            }
          }
        } catch (error) {
          console.error('Failed to check onboarding status:', error);
        }
      })();
    }
  }, [isAuthenticated, currentUser]);

  // ROLLE BASERT TILGANGSKONTROLL PROTOKOLL - Enhanced access control med fallbacks
  const canAccessProfession = (profession: string) => {
    try {
      // Comprehensive admin privileges med audit logging
      if (isAdmin) {
        console.log(`Admin Access: ${(currentUser as any)?.email} accessing ${profession} dashboard`);
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
        userProfession || (currentUser as any)?.profession || (currentUser as any)?.userType || 'unknown';

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
        console.log(`Profession access denied: ${detectedProfession} != ${profession}`);
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

  // OPTION 1: Separate buttons for new vs existing users

  // For new users - opens role selector to choose profession
  const handleGetStarted = () => {
    console.log('New user signup flow - opening role selector');
    setModalState((prev) => ({ ...prev, showRoleSelector: true }));
  };

  // For existing users - opens login modal directly
  const handleLogin = () => {
    console.log('Existing user login - opening login modal');
    setModalState((prev) => ({ ...prev, showLoginModal: true }));
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
      showSubscriptionSelection: true, // Show subscription selection after role
}));
    console.log(`Role selected: ${role} - moving to subscription selection`);

    // Trigger unified workflow events for role selection
    // This will be handled by the parent component that has access to unified workflow
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ROLE_SELECTED',
        data: {
          role: role,
          timestamp: new Date().toISOString(),
          source: 'landing_mobile'
  }
  }, '*');
}
};

  const handleSubscriptionSelection = (plan: any) => {
    // All plans (including enterprise) go directly to InviteRequestForm
    // Enterprise team size selection is now handled inside the form
    setModalState((prev) => ({
      ...prev,
      selectedPlan: plan,
      showSubscriptionSelection: false,
      showInviteRequest: true,
    }));
    console.log(`Subscription selected: ${plan?.name} - moving to invite request`);
  };

  const handleCloseModals = () => {
    resetAllModals();
  };

  return (
    <Box
      className="critical-load-priority" // PERFORMANCE: Above-the-fold priority
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
        pb: 12, '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent 30%, rgba(255,140,0,0.1) 50%, transparent 70%)',
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
          top:  0,
          zIndex: 10,
          boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_LIGHT,
    }}
      >
        <Container maxWidth="sm">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py:  2,
        }}
          >
            {/* Centered logo */}
            <Box>
              <Box
                component="a"
                href="https://creatorhubn.com"
                sx={{
                  textDecoration: 'none',
                  cursor: 'pointer',
                  display: 'inline-block'
                }}
              >
                <Box
                  component="img"
                  src="/creatorhub-logo-amber.svg"
                  alt="CreatorHub Norge"
                  sx={{
                    width: '300px',
                    height: 'auto',
                    filter: 'drop-shadow(0 4px 8px rgba(255,140,0,0.2))',
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="sm" sx={{ py:  1 }}>
        {/* Sentry Test Component - For Testing Error Tracking - DISABLED */}
        {/* <React.Suspense fallback={<div>Loading...</div>}>
          <SentryTestComponent />
        </React.Suspense> */}

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
          <CardContent sx={{ p: 2, textAlign: 'center'}}>
            {/* Orange Badge */}
            <Box
              sx={{
                display: 'inline-block',
                backgroundColor: `rgba(255,140,0,${GLASSMORPHISM_CONSTANTS.ALPHA_MEDIUM})`,
                borderRadius: '50px',
                px:  2,
                py: 0.5,
                mb:  1,
                border: GLASSMORPHISM_CONSTANTS.BORDER_STANDARD,
          }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#6b7280',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
            }}
              >
                {heroSection.badgeLabel || defaultHeroSection.badgeLabel}
              </Typography>
            </Box>

            {/* Main Title */}
            <Typography variant="h4"
              sx={{
                fontWeight: 'bold',
                color: '#6b7280',
                mb: 0.5,
                lineHeight: 1.1,
                fontSize: { xs: '20px', sm: '24px' },
          }}
            >
              {heroSection.titleLineOne || defaultHeroSection.titleLineOne}
            </Typography>
            <Typography variant="h4"
              sx={{
                fontWeight: 'bold',
                color: '#6b7280',
                mb:  1,
                fontSize: { xs: '20px', sm: '24px' },
          }}
            >
              {heroSection.titleLineTwo || defaultHeroSection.titleLineTwo}
            </Typography>

            {/* Description */}
            <Typography
              variant="body1"
              sx={{
                color: '#374151',
                mb: 2,
                lineHeight: 1.6,
                fontSize: '14px',
          }}
            >
              {heroSection.subtitle || heroSection.content || defaultHeroSection.subtitle}
            </Typography>

            {/* Dynamic Key Stats - Only shown when 350+ users */}
            <DynamicPlatformStats />

            {/* Action Buttons */}
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Button variant="contained"
                size="large"
                className="gpu-accelerated" // PERFORMANCE: GPU acceleration for smooth interactions
                sx={{
                  background: "linear-gradient(135deg, #ff8c00 0%, #f59e0b 100%)",
                  color: 'white',
                  py: 1.5,
                  px:  3,
                  minHeight: '48px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  boxShadow: '0 8px 24px rgba(255,140,0,0.35), 0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: "linear-gradient(135deg, #e67c00 0%, #d97706 100%)",
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: '0 16px 40px rgba(255,140,0,0.45), 0 4px 12px rgba(0,0,0,0.15)',
                  },
                  '&:active': {
                    transform: 'translateY(-2px) scale(0.98)',
                  },
                }}
                onClick={handleGetStarted}
                startIcon={<RocketLaunch sx={{ fontSize: 18 }} />}
              >
                {heroSection.primaryCtaLabel || defaultHeroSection.primaryCtaLabel}
              </Button>

              <Button
                variant="outlined"
                size="large"
                onClick={handleLogin}
                className="gpu-accelerated"
                startIcon={<Login sx={{ fontSize: 18 }} />}
                sx={{
                  borderColor: "#ff8c00",
                  color: "#ff8c00",
                  py: 1.5,
                  px: 3,
                  minHeight: '48px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  borderWidth: "2px",
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    borderColor: "#e67c00",
                    backgroundColor: "rgba(255,140,0,0.08)",
                    borderWidth: "2px",
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(255,140,0,0.2)',
                  },
                  '&:active': {
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {heroSection.secondaryCtaLabel || defaultHeroSection.secondaryCtaLabel}
              </Button>
            </Stack>
          </CardContent>
        </MuiCard>

        {/* Fotograf Card */}
        <MuiCard
          sx={{
            mb:  1,
            borderRadius: '12px',
            background: `rgba(255,255,255,${GLASSMORPHISM_CONSTANTS.ALPHA_LIGHT})`,
            backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
            border: GLASSMORPHISM_CONSTANTS.BORDER_STANDARD,
            boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
            position: 'relative',
            zIndex: 2,
      }}
        >
          <CardContent sx={{ p: 1.5}}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
              <Box
                sx={{
                  width:  32,
                  height:  32,
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
                <CameraAlt sx={{ color: '#2e7d32', fontSize: 16}} />
              </Box>
              <Typography variant="h6"
                sx={{ fontWeight: 'bold', color: '#6b7280', fontSize: '14px'}}
              >
                {getProfessionDisplayName('photographer')}
              </Typography>
            </Box>

            <Stack spacing={0.5}>
              {[
                'Bildeadministrasjon','Klientgallerier','Bryllupsportefølje','Utstyrstyring',
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ color: '#2e7d32', fontSize: 16, mr: 1.5 }} />
                  <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '14px' }}>
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
                <VideoLibrary sx={{ color: '#6b7280', fontSize: 16 }} />
              </Box>
              <Typography variant="h6"
                sx={{ fontWeight: 'bold', color: '#6b7280', fontSize: '14px' }}
              >
                {getProfessionDisplayName('videographer')}
              </Typography>
            </Box>

            <Stack spacing={0.5}>
              {[
                'Produksjonsplanlegging','Post-produksjon','Klientgjennomgang','Videoleveranse',
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ color: '#6b7280', fontSize: 16, mr: 1.5 }} />
                  <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '14px' }}>
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
                  border: '1px solid rgba(123,31,162,0.3)',
              boxShadow: '0 10px 25px rgba(123,31,162,0.1)',
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
                  background: 'rgba(123,31,162,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(123,31,162,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                }}
              >
                <LibraryMusic sx={{ color: '#6b7280', fontSize: 16 }} />
              </Box>
              <Typography variant="h6"
                sx={{ fontWeight: 'bold', color: '#6b7280', fontSize: '14px' }}
              >
                Musikk Produksjon
              </Typography>
            </Box>

            <Stack spacing={0.5}>
              {[
                'Studioopptak','Miksing og mastering','Artistsamarbeid','Rettighetsadministrasjon',
              ].map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ color: '#6b7280', fontSize: 16, mr: 1.5 }} />
                  <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '14px' }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Stack>

            {/* Action Button */}
            <Button variant="contained"
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
                transition: 'all 0.2s ease-in-out','&:hover': {
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
              <Group sx={{ color: '#6b7280', fontSize: 20 }} />
            </Box>

            <Typography variant="h6"
              sx={{
                fontWeight: 'bold',
                color: '#6b7280',
                mb: 1,
                fontSize: '14px',
              }}
            >
              Leverandørnettverk
            </Typography>

            <Typography variant="body2" sx={{ color: '#6b7280', mb: 1.5, fontSize: '12px' }}>
              Komplett leverandørnettverk for norske kreative profesjonelle
            </Typography>

            <Stack spacing={0.5} sx={{ textAlign: 'left', mb: 1.5 }}>
              {['Produktkatalog','Salgsverktøy','Kundeadministrasjon','Analysedata'].map(
                (item, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ color: '#ff6b35', fontSize: 14, mr: 1 }} />
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                      {item}
                    </Typography>
                  </Box>
                ),
              )}
            </Stack>

            <Button variant="contained"
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
                transition: 'all 0.2s ease-in-out','&:hover': {
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
              top: -5,
              left: -5,
              width:  60,
              height:  60,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, rgba(255,140,0,0.1), transparent)',
              animation: 'float 6s ease-in-out infinite',
        }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -0,
              right: -0,
              width:  40,
              height:  40,
              borderRadius: '50%',
              background: 'linear-gradient(45deg, rgba(76,175,80,0.1), transparent)',
              animation: 'float 8s ease-in-out infinite reverse',
        }}
          />

          <MuiCard
            sx={{
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(255,140,0,0.02) 0%, rgba(255,248,235,0.8) 50%, rgba(255,140,0,0.05) 100%)',
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

            <CardContent sx={{ p:  4, position: 'relative'}}>
              {/* Enhanced Header */}
              <Box sx={{ textAlign: 'center', mb:  4 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,140,0,0.1)',
                    borderRadius: '50px',
                    px:  3,
                    py:  1,
                    mb:  2,
                    border: '1px solid rgba(255,140,0,0.2)',
              }}
                >
                  <AutoAwesome sx={{ color: '#ff6b35', fontSize:  16, mr:  1 }} />
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

                <Typography variant="h5"
                  sx={{
                    fontWeight: 'bold',
                    background: `linear-gradient(45deg, ${'#ff6b35'}, #e67c00)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb:  2,
                    fontSize: '1.4rem',
              }}
                >
                  Hva er CreatorHub Norge?
                </Typography>
              </Box>

              <Typography
                variant="body1"
                sx={{
                  color: '#6b7280',
                  mb:  3,
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
                  color: '#6b7280',
                  mb:  4,
                  lineHeight: 1.6,
                  textAlign: 'center',
            }}
              >
                Vi tilbyr en komplett løsning for prosjektadministrasjon, klienthåndtering og
                kreative verktøy.
              </Typography>

              {/* Enhanced Feature List */}
              <Stack spacing={2.5} sx={{ mb:  4 }}>
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
                      width:  36,
                      height:  36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,140,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr:  2,
                }}
                  >
                    <CheckCircle sx={{ color: '#ff6b35', fontSize: 18}} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: 'medium'}}>
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
                      width:  36,
                      height:  36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(76,175,80,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr:  2,
                }}
                  >
                    <CheckCircle sx={{ color: '#4caf50', fontSize: 18}} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#33', fontWeight: 'medium'}}>
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
                      width:  36,
                      height:  36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(33,150,243,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr:  2,
                }}
                  >
                    <CheckCircle sx={{ color: '#6b7280', fontSize: 18}} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#33', fontWeight: 'medium'}}>
                    Klientgallerier og leveranse
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(123,31,162,0.03)',
                    borderRadius: '12px',
                    p: 1.5,
                    border: '1px solid rgba(123,31,162,0.1)',
              }}
                >
                  <Box
                    sx={{
                      width:  36,
                      height:  36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(123,31,162,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr:  2,
                }}
                  >
                    <CheckCircle sx={{ color: '#6b7280', fontSize: 18}} />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: 'medium'}}>
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
                  boxShadow: '0 8px 20px rgba(25,140,0,0.25)',
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                  overflow: 'hidden','&:hover': {
                    background: 'linear-gradient(45deg, #e67c00, #d97706)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 30px rgba(255,140,0,0.35)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 4px 15px rgba(25,140,0,0.25)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    transition: 'left 0.5s',
                  },
                  '&:hover::before': {
                    left: '100%',
                  },
                }}
              >
                <Article sx={{ mr: 1.5, fontSize: 20 }} />
                Les Mer Om Oss
              </Button>
            </CardContent>
          </MuiCard>
        </Box>
      </Container>

      {/* Features Section - Desktop content in mobile card format */}
      <Container maxWidth="sm" sx={{ py: 1 }}>
        <Box sx={{ mt: 4, mb: 3 }}>
          {/* Section Header */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            {/* Decorative Badge */}
            <Box 
              sx={{ 
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 0.75,
                mb: 2,
                borderRadius: "50px",
                background: "linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(234,88,12,0.1) 100%)",
                border: "1px solid rgba(251,146,60,0.3)",
              }}
            >
              <Box 
                sx={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: "50%", 
                  background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
                  animation: "pulse 2s ease-in-out infinite",
                }} 
              />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 600, 
                  color: "#ea580c",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: "0.7rem",
                }}
              >
                Plattformen for de kreative
              </Typography>
            </Box>

            {/* Main Heading */}
            <Typography 
              component="h2"
              variant="h5"
              sx={{ 
                fontWeight: 800, 
                color: "#1f2937", 
                mb: 1.5,
                fontSize: "1.5rem",
                lineHeight: 1.2,
              }}
            >
              Hvorfor{" "}
              <Box 
                component="span" 
                sx={{ 
                  background: "linear-gradient(135deg, #fb923c 0%, #ea580c 50%, #c2410c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                CreatorHub Norge
              </Box>
              ?
            </Typography>

            {/* Subtitle */}
            <Typography 
              variant="body2"
              sx={{ 
                color: "#6b7280", 
                lineHeight: 1.6, 
                fontWeight: 400,
                fontSize: "0.875rem",
              }}
            >
              Alt du trenger for å drive en profesjonell kreativ virksomhet i Norge
            </Typography>
          </Box>

          {/* Features as vertical card stack */}
          <Stack spacing={1.5}>
            {/* Card 1 - Prosjektadministrasjon */}
            <MuiCard
              className="card-shine"
              sx={{
                borderRadius: "20px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 100%)",
                border: "1px solid rgba(255,140,0,0.15)",
                boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_STRONG,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ 
                    width: 60, height: 60, borderRadius: "16px", flexShrink: 0,
                    background: "linear-gradient(135deg, #ff8c00 0%, #f59e0b 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(255,140,0,0.35)",
                  }}>
                    <Assessment sx={{ fontSize: 28, color: "white" }} />
                  </Box>
                  <Box>
                    <Typography component="h3" variant="h6" sx={{ fontWeight: "bold", color: "#1f2937", mb: 1 }}>
                      Prosjektadministrasjon
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#4b5563", lineHeight: 1.6, fontSize: '0.875rem' }}>
                      Effektiv prosjektstyring med intelligente løsninger for planlegging, produksjon og post-produksjon.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </MuiCard>

            {/* Card 2 - StoryArc Studio (Featured) */}
            <MuiCard
              className="card-shine"
              sx={{
                borderRadius: "20px",
                background: "linear-gradient(145deg, #ff8c00 0%, #f59e0b 40%, #d97706 100%)",
                boxShadow: "0 12px 36px rgba(255,140,0,0.3)",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "translateY(-4px) scale(1.01)",
                  boxShadow: "0 16px 44px rgba(255,140,0,0.4)",
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ 
                  width: 56, height: 56, borderRadius: "14px", 
                  overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 2,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                  backgroundColor: 'rgba(255,255,255,0.2)',
                }}>
                  <VideoLibrary sx={{ fontSize: 32, color: "white" }} />
                </Box>
                <Typography component="h3" variant="h6" sx={{ fontWeight: "bold", color: "white", mb: 1.5 }}>
                  StoryArc Studio
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.95)", lineHeight: 1.6, mb: 2, fontSize: '0.875rem' }}>
                  Profesjonell videoredigering som analyserer innholdet ditt og genererer story arcs automatisk.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.75 }}>
                  <Chip label="Auto-analyse" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)", fontSize: '0.7rem' }} />
                  <Chip label="Smart redigering" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)", fontSize: '0.7rem' }} />
                  <Chip label="NLE-eksport" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)", fontSize: '0.7rem' }} />
                </Stack>
              </CardContent>
            </MuiCard>

            {/* Card 3 - Integrasjoner */}
            <MuiCard
              className="card-shine"
              sx={{
                borderRadius: "20px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(254,243,199,0.95) 100%)",
                border: "1px solid rgba(255,140,0,0.12)",
                boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_STRONG,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ 
                  width: 56, height: 56, borderRadius: "14px", 
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 2,
                  boxShadow: "0 6px 20px rgba(245,158,11,0.3)",
                }}>
                  <Settings sx={{ fontSize: 28, color: "white" }} />
                </Box>
                <Typography component="h3" variant="h6" sx={{ fontWeight: "bold", color: "#1f2937", mb: 1 }}>
                  Integrasjoner
                </Typography>
                <Typography variant="body2" sx={{ color: "#4b5563", lineHeight: 1.6, fontSize: '0.875rem' }}>
                  Sømløs integrasjon med verktøyene du bruker. Google Workspace, DaVinci Resolve, Final Cut Pro, Premiere Pro.
                </Typography>
              </CardContent>
            </MuiCard>

            {/* Card 4 - Academy & Community */}
            <MuiCard
              className="card-shine"
              sx={{
                borderRadius: "20px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,251,235,0.95) 100%)",
                border: "1px solid rgba(255,140,0,0.12)",
                boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_STRONG,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ 
                  width: 56, height: 56, borderRadius: "14px", 
                  background: "linear-gradient(135deg, #ea580c 0%, #d97706 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 2,
                  boxShadow: "0 6px 20px rgba(234,88,12,0.3)",
                }}>
                  <Group sx={{ fontSize: 28, color: "white" }} />
                </Box>
                <Typography component="h3" variant="h6" sx={{ fontWeight: "bold", color: "#1f2937", mb: 1 }}>
                  Academy & Community
                </Typography>
                <Typography variant="body2" sx={{ color: "#4b5563", lineHeight: 1.6, fontSize: '0.875rem' }}>
                  Lær nye ferdigheter med kurs og tutorials. Koble deg til andre kreative i vårt community.
                </Typography>
              </CardContent>
            </MuiCard>
          </Stack>
        </Box>
      </Container>

      {partnerConfig.enabled && (
        <Container maxWidth="sm" sx={{ py: 2 }}>
          <MuiCard
            className="fade-in-animation"
            sx={{
              mt: 3,
              mb: 2,
              textAlign: "center",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 60%, rgba(254,243,199,0.9) 100%)",
              border: "1px solid rgba(255,140,0,0.18)",
              borderRadius: "24px",
              p: 3,
              boxShadow: "0 20px 48px rgba(255,140,0,0.12), 0 8px 18px rgba(0,0,0,0.08)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Typography
              variant="overline"
              sx={{ letterSpacing: 2, color: "#c2410c", fontWeight: 700 }}
            >
              {partnerConfig.title}
            </Typography>
            <Box
              component="img"
              src={partnerConfig.logoUrl}
              alt="Evendi"
              loading="lazy"
              sx={{
                width: "180px",
                height: "auto",
                my: 2,
                mx: "auto",
                display: "block",
                filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.08))",
              }}
            />
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: "#1f2937", mb: 1 }}
            >
              Premium bryllupsopplevelser - sammen
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "#4b5563", lineHeight: 1.7, mb: 2 }}
            >
              {partnerConfig.description}
            </Typography>
            <Button
              variant="contained"
              size="large"
              sx={{
                background:
                  "linear-gradient(135deg, #ff8c00 0%, #f59e0b 50%, #d97706 100%)",
                color: "white",
                py: 1.4,
                px: 4,
                minHeight: "48px",
                borderRadius: "14px",
                fontSize: "14px",
                fontWeight: "bold",
                textTransform: "none",
                boxShadow: "0 10px 24px rgba(255,140,0,0.4)",
              }}
              onClick={() =>
                setModalState((prev) => ({ ...prev, showPartnerDialog: true }))
              }
              endIcon={<Info sx={{ fontSize: 18 }} />}
            >
              {partnerConfig.ctaLabel}
            </Button>
          </MuiCard>
        </Container>
      )}

      {videoConfig.enabled && (
        <Container maxWidth="sm" sx={{ py: 1 }}>
          <MuiCard
            className="fade-in-animation"
            sx={{
              mt: 3,
              mb: 2,
              textAlign: "left",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,248,235,0.94) 100%)",
              border: "1px solid rgba(255,140,0,0.18)",
              borderRadius: "24px",
              p: 3,
              boxShadow: "0 20px 48px rgba(255,140,0,0.12), 0 8px 18px rgba(0,0,0,0.08)",
            }}
          >
            <Typography
              variant="overline"
              sx={{ letterSpacing: 2, color: "#c2410c", fontWeight: 700 }}
            >
              Video
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: "#1f2937", mb: 1 }}
            >
              {videoConfig.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "#4b5563", lineHeight: 1.7, mb: 2 }}
            >
              {videoConfig.description}
            </Typography>
            <Box
              sx={{
                position: "relative",
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid rgba(255,140,0,0.28)",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.3)",
                background: cinematicConfig.enabled
                  ? "linear-gradient(135deg, rgba(20, 20, 30, 0.85), rgba(255,140,0,0.12))"
                  : "linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,255,255,0.9))",
                "&::before": cinematicConfig.enabled
                  ? {
                      content: '""',
                      position: "absolute",
                      inset: 0,
                      background: `radial-gradient(circle at 30% 20%, rgba(255,186,120,${cinematicConfig.glowWarmOpacity}), transparent 55%), radial-gradient(circle at 70% 80%, rgba(14, 165, 233, ${cinematicConfig.glowCoolOpacity}), transparent 55%)`,
                      zIndex: 1,
                      pointerEvents: "none",
                    }
                  : undefined,
                "&::after": cinematicConfig.enabled
                  ? {
                      content: '""',
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(to bottom, rgba(0,0,0,${cinematicConfig.overlayTopOpacity}) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 78%, rgba(0,0,0,${cinematicConfig.overlayBottomOpacity}) 100%)`,
                      zIndex: 2,
                      pointerEvents: "none",
                    }
                  : undefined,
              }}
            >
              <Box sx={{ position: "relative", pt: "56.25%" }}>
                {videoConfig.showEmbeddedVideo ? (
                  <Box
                    component="video"
                    src={videoConfig.videoUrl}
                    poster={videoConfig.posterUrl}
                    muted
                    playsInline
                    autoPlay={videoConfig.autoPlay}
                    loop={videoConfig.loop}
                    controls={videoConfig.showControls}
                    preload="metadata"
                    onLoadStart={() => setIsVideoReady(false)}
                    onCanPlay={() => setIsVideoReady(true)}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      backgroundColor: "#0b0b0f",
                      filter: cinematicConfig.enabled
                        ? `contrast(${cinematicConfig.contrast}) saturate(${cinematicConfig.saturate})`
                        : "none",
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1.5,
                      textAlign: "center",
                      p: 2,
                      backgroundImage: `url("${videoConfig.posterUrl}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: "18px",
                        background: "rgba(255,255,255,0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 10px 22px rgba(255,140,0,0.35)",
                        border: "1px solid rgba(255,140,0,0.2)",
                      }}
                    >
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: "14px",
                          background:
                            "linear-gradient(135deg, #ff8c00 0%, #d97706 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PlayArrow sx={{ fontSize: 26, color: "white" }} />
                      </Box>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1f2937" }}>
                      Se videoen her
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>
                      16:9 format
                    </Typography>
                  </Box>
                )}
                {videoConfig.showEmbeddedVideo && !isVideoReady && videoConfig.showLoadingLogo && (
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 1,
                      textAlign: "center",
                      zIndex: 3,
                      background:
                        "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.75))",
                      color: "white",
                    }}
                  >
                    <Box className="video-loading-logo">
                      <CreatorHubLogoIcon size={56} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      Laster video
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mt: 1.5 }}>
              Innholdet styres fra admin via Visual Editor.
            </Typography>
          </MuiCard>
        </Container>
      )}

      {/* Call to Action Section - Desktop content in mobile card format */}
      <Container maxWidth="sm" sx={{ py: 1 }}>
        <MuiCard
          className="fade-in-animation"
          sx={{
            mt: 4,
            mb: 3,
            textAlign: "center",
            background: `linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 50%, rgba(254,243,199,0.9) 100%)`,
            backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
            border: "1px solid rgba(255,140,0,0.2)",
            borderRadius: "24px",
            p: 4,
            boxShadow: "0 24px 60px rgba(255,140,0,0.15), 0 8px 24px rgba(0,0,0,0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Simplified CreatorHub Logo */}
          <Box 
            sx={{ 
              position: "relative",
              width: 80,
              height: 80,
              mx: "auto",
              mb: 3,
              zIndex: 1,
            }}
          >
            <CreatorHubLogoIcon size={80} />
          </Box>

          {/* Main Heading */}
          <Typography variant="h5"
            sx={{ 
              fontWeight: 800, 
              color: "#1f2937", 
              mb: 2,
              position: "relative",
              zIndex: 1,
              fontSize: "1.5rem",
              lineHeight: 1.2,
            }}
          >
            Klar til å{" "}
            <Box 
              component="span" 
              sx={{ 
                background: "linear-gradient(135deg, #fb923c 0%, #ea580c 50%, #c2410c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              revolutjonere
            </Box>
            {" "}din kreative virksomhet?
          </Typography>

          {/* Subtitle */}
          <Typography variant="body2"
            sx={{ 
              color: "#6b7280", 
              mb: 3, 
              lineHeight: 1.6,
              position: "relative",
              zIndex: 1,
              fontWeight: 400,
              fontSize: "0.875rem",
            }}
          >
            Bli med i{" "}
            <Box component="span" sx={{ fontWeight: 600, color: "#374151" }}>
              CreatorHub Norge
            </Box>
            {" "}i dag og opplev forskjellen profesjonelle verktøy kan gjøre.
          </Typography>

          {/* CTA Button */}
          <Button variant="contained"
            size="large"
            className="gpu-accelerated btn-glow"
            sx={{
              background: "linear-gradient(135deg, #ff8c00 0%, #f59e0b 50%, #d97706 100%)",
              color: "white",
              py: 2,
              px: 5,
              minHeight: "56px",
              borderRadius: "16px",
              fontSize: "16px",
              fontWeight: "bold",
              textTransform: "none",
              boxShadow: "0 10px 28px rgba(255,140,0,0.4), 0 4px 12px rgba(0,0,0,0.1)",
              position: "relative",
              zIndex: 1,
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                background: "linear-gradient(135deg, #e67c00 0%, #d97706 50%, #c2410c 100%)",
                transform: "translateY(-4px) scale(1.02)",
                boxShadow: "0 16px 40px rgba(255,140,0,0.5), 0 8px 20px rgba(0,0,0,0.15)",
              },
              "&:active": {
                transform: "translateY(-2px) scale(0.98)",
              },
            }}
            onClick={handleGetStarted}
            startIcon={<CreatorHubLogoIcon size={22} />}
            endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
          >
            Bli en del av CreatorHub Norge
          </Button>
        </MuiCard>
      </Container>

      {/* Footer Section - Desktop content in mobile Stack format */}
      <Box
        component="footer"
        sx={{
          background: `rgba(31,41,55,0.95)`,
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(255,140,0,0.2)",
          color: "white",
          py: 4,
          mt: 4,
        }}
      >
        <Container maxWidth="sm">
          <Stack spacing={4}>
            {/* Company Info */}
            <Box>
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Box
                  component="img"
                  src="/creatorhub-logo-amber.svg"
                  alt="CreatorHub Norge"
                  sx={{
                    width: "200px",
                    height: "auto",
                    filter: "brightness(1.2)",
                    mx: 'auto',
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2, lineHeight: 1.6, textAlign: 'center', fontSize: '0.875rem' }}>
                Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter.
              </Typography>
            </Box>

            {/* Quick Links */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2, color: "#ff8c00", fontSize: '1rem' }}>
                Navigasjon
              </Typography>
              <Stack spacing={1}>
                {[
                  { label: "Hjem", path: "/" },
                  { label: "Om Oss", path: "/about-us" },
                  { label: "Logg Inn", action: handleLogin },
                  { label: "Kom i Gang", action: handleGetStarted },
                ].map((link, index) => (
                  <Button
                    key={index}
                    variant="text"
                    onClick={link.action || (() => handleNavigation(link.path || "/"))}
                    sx={{
                      color: "rgba(255,255,255,0.7)",
                      textTransform: "none",
                      justifyContent: "flex-start",
                      fontSize: "14px",
                      px: 0,
                      "&:hover": {
                        color: "#ff8c00",
                        backgroundColor: "transparent",
                      },
                    }}
                  >
                    {link.label}
                  </Button>
                ))}
              </Stack>
            </Box>

            {/* Professions */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2, color: "#ff8c00", fontSize: '1rem' }}>
                Profesjoner
              </Typography>
              <Stack spacing={1}>
                {[
                  { label: getProfessionDisplayName('photographer'), icon: <PhotoCamera fontSize="small" /> },
                  { label: getProfessionDisplayName('videographer'), icon: <VideoLibrary fontSize="small" /> },
                  { label: getProfessionDisplayName('music_producer'), icon: <LibraryMusic fontSize="small" /> },
                  { label: "Leverandør", icon: <Business fontSize="small" /> },
                ].map((profession, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: "14px",
                    }}
                  >
                    <Box sx={{ mr: 1, color: "#ff8c00" }}>{profession.icon}</Box>
                    <Typography variant="body2">{profession.label}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Contact & Legal */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2, color: "#ff8c00", fontSize: '1rem' }}>
                Kontakt
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
                  <Email fontSize="small" sx={{ mr: 1, color: "#ff8c00" }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>daniel@creatorhubn.com</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
                  <Phone fontSize="small" sx={{ mr: 1, color: "#ff8c00" }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>+47 97 95 92 94</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
                  <LocationOn fontSize="small" sx={{ mr: 1, color: "#ff8c00" }} />
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Norge</Typography>
                </Box>
                <Divider sx={{ my: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
                <Button
                  variant="text"
                  onClick={() => handleNavigation("/privacy-policy")}
                  sx={{
                    color: "rgba(255,255,255,0.7)",
                    textTransform: "none",
                    justifyContent: "flex-start",
                    fontSize: "14px",
                    px: 0,
                    "&:hover": {
                      color: "#ff8c00",
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  Personvern & GDPR
                </Button>
              </Stack>
            </Box>

            {/* Bottom Bar */}
            <Divider sx={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", textAlign: "center", fontSize: '0.75rem' }}>
                © {new Date().getFullYear()} CreatorHub Norge. Alle rettigheter reservert.
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="text"
                  size="small"
                  onClick={() => handleNavigation("/privacy-policy")}
                  sx={{
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "none",
                    fontSize: "11px",
                    "&:hover": {
                      color: "#ff8c00",
                    },
                  }}
                >
                  Personvernerklæring
                </Button>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.3)", fontSize: '0.75rem' }}>
                  •
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => handleNavigation("/terms-and-conditions")}
                  sx={{
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "none",
                    fontSize: "11px",
                    "&:hover": {
                      color: "#ff8c00",
                    },
                  }}
                >
                  Vilkår & Betingelser
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Bottom Navigation */}
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom:  0,
          left:  0,
          right:  0,
          borderRadius:  0,
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
            py:  1,
            px:  2,
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
              transition: 'all 0.2s ease-in-out','&:hover': {
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
                transition: 'all 0.2s ease-in-out','&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <CameraAlt sx={{ fontSize: 20, mb: 0.25 }} />
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
                transition: 'all 0.2s ease-in-out','&:hover': {
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
                transition: 'all 0.2s ease-in-out','&:hover': {
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
                transition: 'all 0.2s ease-in-out','&:hover': {
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
              transition: 'all 0.2s ease-in-out','&:hover': {
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
        <Box sx={{ p:  2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb:  2,
        }}
          >
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white'}}>
              CreatorHub Norge
            </Typography>
            <IconButton
              onClick={() => setModalState((prev) => ({ ...prev, showSidebar: false }))}
              sx={{ color: 'white'}}
            >
              <Close />
            </IconButton>
          </Box>

          <List>
            {!isAuthenticated && (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => setModalState(prev => ({ ...prev, showLoginModal: true }))}
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
                  onClick={() => {
                    setModalState((prev) => ({ ...prev, showSidebar: false }));
                    handleNavigation('/photographer-dashboard-material');
                  }}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon>
                    <CameraAlt sx={{ color: 'white' }} />
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
                  onClick={() => {
                    setModalState((prev) => ({ ...prev, showSidebar: false }));
                    handleNavigation('/music-producer-dashboard');
                  }}
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
                  onClick={() => {
                    setModalState((prev) => ({ ...prev, showSidebar: false }));
                    handleNavigation('/admin');
                  }}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    backgroundColor: 'rgba(255,255,255,0.1)','&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
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
                    onClick={() => {
                      setModalState((prev) => ({ ...prev, showSidebar: false }));
                      handleNavigation('/photo-showcase');
                    }}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <CameraAlt sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText primary="Fotogalleri" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setModalState((prev) => ({ ...prev, showSidebar: false }));
                      handleNavigation('/video-showcase');
                    }}
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
                    onClick={() => {
                      setModalState((prev) => ({ ...prev, showSidebar: false }));
                      handleNavigation('/equipment-rental');
                    }}
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
                    onClick={() => {
                      setModalState((prev) => ({ ...prev, showSidebar: false }));
                      handleNavigation('/academy');
                    }}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.5,
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <Article sx={{ color: 'white' }} />
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

                {/* Settings - Only for authenticated users */}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      setModalState((prev) => ({ ...prev, showSidebar: false }));
                      handleNavigation('/settings');
                    }}
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

            {/* Google Workspace Integration - Always visible */}
            <Typography
              variant="subtitle2"
              sx={{
                px: 2,
                mb: 1,
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 'medium',
              }}
            >
              Integrasjoner
            </Typography>

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  setGoogleWorkspaceDialogOpen(true);
                  setModalState((prev) => ({ ...prev, showSidebar: false }));
                }}
                sx={{
                  borderRadius: '8px',
                  mb: 0.5,
                  backgroundColor: 'rgba(66,133,244,0.15)','&:hover': { backgroundColor: 'rgba(66,133,244,0.25)' },
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '4px',
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary="Google Workspace"
                  secondary={
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Full integrasjon
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>

            <Divider sx={{ my: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />

            {/* Information - alltid synlig */}
            <Typography
              variant="subtitle2"
              sx={{
                px: 2,
                mb: 1,
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 'medium',
              }}
            >
              Information
            </Typography>

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

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  setModalState((prev) => ({ ...prev, showSidebar: false }));
                  handleNavigation('/privacy-policy');
                }}
                sx={{
                  borderRadius: '8px',
                  mb: 0.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <ListItemIcon>
                  <Security sx={{ color: 'white' }} />
                </ListItemIcon>
                <ListItemText
                  primary="Personvernerklæring"
                  secondary={
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      GDPR & Cookies
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => handleNavigation('/terms-and-conditions')}
                sx={{
                  borderRadius: '8px',
                  mb: 0.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <ListItemIcon>
                  <Article sx={{ color: 'white' }} />
                </ListItemIcon>
                <ListItemText
                  primary="Vilkår & Betingelser"
                  secondary={
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Juridiske vilkår
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Partner Dialog */}
      <Dialog
        open={modalState.showPartnerDialog}
        onClose={() => setModalState((prev) => ({ ...prev, showPartnerDialog: false }))}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.98)',
              boxShadow: '0 20px 50px rgba(17, 24, 39, 0.2)',
              border: '1px solid rgba(255,140,0,0.2)',
            },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 800, color: '#111827' }}>
            {partnerConfig.dialogTitle}
          </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
              {partnerConfig.dialogBody
                .split('\n\n')
                .filter(Boolean)
                .map((paragraph, index) => (
                  <Typography key={index} sx={{ color: '#374151', lineHeight: 1.7 }}>
                    {paragraph}
                  </Typography>
                ))}
            <Box
              sx={{
                p: 2,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,200,80,0.16))',
                border: '1px solid rgba(255,140,0,0.2)',
              }}
            >
              <Typography sx={{ fontWeight: 700, color: '#9a3412', mb: 1 }}>
                Kort sagt:
              </Typography>
                <Box component="ul" sx={{ pl: 3, m: 0, color: '#4b5563' }}>
                  {(Array.isArray(partnerConfig.dialogBullets)
                    ? partnerConfig.dialogBullets
                    : partnerConfig.dialogBullets.split('\n')
                  )
                    .filter(Boolean)
                    .map((bullet) => (
                      <Box component="li" key={bullet} sx={{ lineHeight: 1.6 }}>
                        {bullet}
                      </Box>
                    ))}
                </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="text"
            onClick={() => setModalState((prev) => ({ ...prev, showPartnerDialog: false }))}
            sx={{ textTransform: 'none', color: '#6b7280' }}
          >
            Lukk
          </Button>
          <Button
            variant="contained"
            onClick={handleGetStarted}
            sx={{
              textTransform: 'none',
              background: 'linear-gradient(135deg, #ff8c00 0%, #f59e0b 50%, #d97706 100%)',
              px: 3,
              fontWeight: 700,
            }}
          >
            Kom i gang
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Role Selector Modal */}
      <Dialog
        open={modalState.showRoleSelector}
        onClose={handleCloseModals}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '24px',
              background: 'rgba(26, 26, 46, 0.92)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              overflow: 'visible'
            }
          }
        }}
      >
        {/* Header with Logo and Title */}
        <Box sx={{ 
          p: 3,
          pb: 2,
          position: 'relative',
          textAlign: 'center',
          borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
        }}>
          {/* Close Button */}
          <IconButton
            onClick={handleCloseModals}
            sx={{ 
              position: 'absolute',
              top: 12,
              right: 12,
              color: 'rgba(255, 255, 255, 0.5)',
              '&:hover': {
                color: '#f59e0b',
                bgcolor: 'rgba(245, 158, 11, 0.1)',
              },
            }}
          >
            <Close />
          </IconButton>

          {/* CreatorHub Logo */}
          <Box
            component="img"
            src="/creatorhub-logo-amber.svg"
            alt="CreatorHub"
            sx={{
              width: 500,
              height: 'auto',
              objectFit: 'contain',
              mb: 2,
            }}
          />

          {/* Title */}
          <Typography 
            variant="h5" 
            sx={{
              fontWeight: 700,
              color: '#fff',
              mb: 0.5,
            }}
          >
            Velg din kreative rolle
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            Start din profesjonelle reise med CreatorHub Norge
          </Typography>
        </Box>

        <DialogContent sx={{ p: 3, pt: 2 }}>
          {/* Professional Role Cards - Now Dynamic! */}
          <Stack spacing={2}>
            {allProfessions.map((item) => (
              <MuiCard
                key={item.role}
                onClick={() => handleRoleSelection(item.role)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    border: `1px solid ${item.color}80`,
                    background: `${item.color}15`,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px ${item.color}40`,
                  },
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '14px',
                    background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}dd 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    mx: 'auto',
                    mb: 2,
                    boxShadow: `0 6px 20px ${item.color}60`,
                  }}>
                    {item.icon}
                  </Box>

                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    color: '#fff',
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {item.label}
                    {(item as any).badge && (
                      <Box sx={{ ml: 1, display: 'inline-flex', gap: 0.3, color: 'rgba(255,255,255,0.7)' }}>
                        {(item as any).badge}
                      </Box>
                    )}
                  </Typography>

                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    lineHeight: 1.6,
                  }}>
                    {item.description}
                  </Typography>
                </CardContent>
              </MuiCard>
            ))}
          </Stack>

        </DialogContent>

        {/* Footer */}
        <Box sx={{ 
          p: 2,
          pt: 1,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <Typography variant="caption" sx={{ 
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            display: 'block',
            lineHeight: 1.6,
          }}>
            Ved å velge en rolle godtar du våre{' '}
            <Box
              component="a"
              href="/terms-and-conditions"
              sx={{
                color: '#f59e0b',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              vilkår
            </Box>
            {' '}og{' '}
            <Box
              component="a"
              href="/privacy-policy"
              sx={{
                color: '#f59e0b',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              personvernregler
            </Box>
            .
          </Typography>
        </Box>
      </Dialog>

      {/* Subscription Selection Modal */}
      {modalState.showSubscriptionSelection && (() => {
        // Find the selected profession to get icon and color
        const selectedProfession = allProfessions.find(p => p.role === modalState.selectedRole);
        const professionColor = selectedProfession?.color || '#f59e0b';
        const professionIcon = selectedProfession?.icon || <AccountCircle sx={{ fontSize: 28 }} />;
        const professionLabel = selectedProfession?.label || modalState.selectedRole;

        return (
          <Dialog
            open={modalState.showSubscriptionSelection}
            onClose={handleCloseModals}
            maxWidth="lg"
            fullWidth
            slotProps={{
              paper: {
                sx: {
                  borderRadius: '24px',
                  background: 'rgba(26, 26, 46, 0.92)',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  overflow: 'visible'
                }
              }
            }}
          >
            {/* Header with Logo and Profession Info */}
            <Box sx={{ 
              p: 3,
              pb: 2,
              position: 'relative',
              textAlign: 'center',
              borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
            }}>
              {/* Close Button */}
              <IconButton
                onClick={handleCloseModals}
                sx={{ 
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  color: 'rgba(255, 255, 255, 0.5)',
                  '&:hover': {
                    color: '#f59e0b',
                    bgcolor: 'rgba(245, 158, 11, 0.1)',
                  },
                }}
              >
                <Close />
              </IconButton>

              {/* CreatorHub Logo */}
              <Box
                component="img"
                src="/creatorhub-logo-amber.svg"
                alt="CreatorHub"
                sx={{
                  width: 500,
                  height: 'auto',
                  objectFit: 'contain',
                  mb: 3,
                }}
              />

              {/* Main Title with Profession Icon */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: 2,
                mb: 2,
              }}>
                {/* Profession Icon Badge */}
                <Box sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '18px',
                  background: `linear-gradient(135deg, ${professionColor} 0%, ${professionColor}dd 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: `0 8px 24px ${professionColor}60, 0 0 0 4px ${professionColor}20`,
                  border: `2px solid ${professionColor}80`,
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: -2,
                    borderRadius: '20px',
                    padding: '2px',
                    background: `linear-gradient(135deg, ${professionColor}80, ${professionColor}40)`,
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  },
                }}>
                  {React.cloneElement(professionIcon as React.ReactElement, { sx: { fontSize: 36 } })}
                </Box>

                {/* Title Section */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4" 
                    sx={{
                      fontWeight: 800,
                      color: '#fff',
                      mb: 1,
                      fontSize: { xs: '1.5rem', sm: '1.75rem' },
                      lineHeight: 1.2,
                    }}
                  >
                    Velg din abonnementsplan
                  </Typography>
                  
                  {/* Profession Label with Decorative Elements */}
                  <Box sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2.5,
                    py: 1,
                    borderRadius: '20px',
                    background: `linear-gradient(135deg, ${professionColor}25 0%, ${professionColor}15 100%)`,
                    border: `1.5px solid ${professionColor}50`,
                    backdropFilter: 'blur(10px)',
                    boxShadow: `0 4px 16px ${professionColor}30`,
                  }}>
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                      mr: 0.5,
                    }}>
                      For
                    </Typography>
                    <Typography variant="h6" sx={{ 
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '1rem',
                      background: `linear-gradient(135deg, #fff 0%, ${professionColor}dd 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      {professionLabel}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <DialogContent sx={{ p: 3, pt: 2 }}>
              <React.Suspense fallback={<div>Loading...</div>}>
                <SubscriptionSelectionFlow
                  profession={modalState.selectedRole}
                  onComplete={handleSubscriptionSelection}
                  onBack={handleCloseModals}
                />
              </React.Suspense>
            </DialogContent>
          </Dialog>
        );
      })()}

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
                selectedPlan={modalState.selectedPlan}
                onSuccess={handleCloseModals}
                onCancel={handleCloseModals}
              />
            </React.Suspense>
          )}
        </DialogContent>
      </Dialog>

      {/* Universal Onboarding Modal */}
      {modalState.showOnboarding && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <UniversalOnboarding
            isOpen={modalState.showOnboarding}
            onClose={() => {
              setModalState((prev) => ({ ...prev, showOnboarding: false }));
              // Refresh auth state after onboarding
              queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
            }}
            profession={currentUser?.userType || 'photographer'}
          />
        </React.Suspense>
      )}

      {/* GDPR Cookie Consent Banner */}
      <GdprNotice position="bottom" />

      {/* Google Workspace Information Dialog */}
      <Dialog
        open={googleWorkspaceDialogOpen}
        onClose={() => setGoogleWorkspaceDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.2)',
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 1,
            background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
            color: 'white',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Google Logo */}
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Hvorfor Google Workspace?
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                CreatorHub Norge's strategiske valg
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.6 }}>
              CreatorHub Norge har valgt Google Workspace som vår primære
              forretningsplattform fordi den gir norske kreative fagfolk den
              mest sømløse, sikre og produktive arbeidsflyten.
            </Typography>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ color: '#34A853', fontSize: 24, mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                  Sikkerhet og Pålitelighet
                </Typography>
              </Box>
              <List>
                {[
                  'Enterprise-grade sikkerhet med 99.9% oppetid','Automatisk kryptering av alle filer og kommunikasjon','GDPR-kompatibel databehandling for norske brukere',
                ].map((item, index) => (
                  <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                    <ListItemIcon>
                      <CheckCircle sx={{ color: '#34A853', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item}
                      slotProps={{
                        primary: {
                          sx: { fontSize: '0.9rem', color: '#374151' },
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <RocketLaunch sx={{ color: '#4285F4', fontSize: 24, mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                  Teknisk Integrasjon
                </Typography>
              </Box>
              <List>
                {[
                  'Gmail API: Automatisert e-postkommunikasjon','Google Drive API: Sømløs filsynkronisering','Calendar API: Integrert bookingsystem', 'Docs & Sheets API: Automatisk rapportgenerering',
                ].map((item, index) => (
                  <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                    <ListItemIcon>
                      <CheckCircle sx={{ color: '#4285F4', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item}
                      slotProps={{
                        primary: {
                          sx: { fontSize: '0.9rem', color: '#374151' },
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Adjust sx={{ color: '#FF6F00', fontSize: 24, mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                  Fordeler for Kreative Fagfolk
                </Typography>
              </Box>
              <Grid2 container spacing={2}>
                <Grid2 size={12}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <PhotoCamera sx={{ color: '#2e7d32', fontSize: 32, mb: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                      {getProfessionDisplayName('photographer')}er
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      Automatisk backup og deling av gallerier
                    </Typography>
                  </Box>
                </Grid2>
                <Grid2 size={12}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <VideoLibrary sx={{ color: '#1565c0', fontSize: 32, mb: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                      Videografer
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      Høyhastighets filoverføring og samarbeid
                    </Typography>
                  </Box>
                </Grid2>
                <Grid2 size={12}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <LibraryMusic sx={{ color: '#7b1fa2', fontSize: 32, mb: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                      Musikprodusenter
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      Sikker lagring og distribusjon
                    </Typography>
                  </Box>
                </Grid2>
              </Grid2>
            </Box>

            <Box
              sx={{
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                borderRadius: '12px',
                p: 3,
                textAlign: 'center',
              }}
            >
              <Typography variant="body2" sx={{ color: '#374151', mb: 2 }}>
                Vår integrasjon med Google Workspace er ikke bare en teknisk
                løsning - det er fundamentet som gjør det mulig for norske
                kreative profesjonelle å fokusere på det de gjør best: skape
                fantastisk innhold.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                href="https://workspace.google.com/integrations/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  borderColor: '#4285F4',
                  color: '#4285F4',
                  fontSize: '12px',
                    textTransform: 'none', '&:hover': {
                    borderColor: '#3367D6',
                    backgroundColor: 'rgba(66,133,244,0.1)',
                  },
                }}
              >
                Les mer på Google's offisielle side
              </Button>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setGoogleWorkspaceDialogOpen(false)}
            variant="contained"
            fullWidth
            sx={{
              background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
              color: 'white',
              fontWeight: 'bold', '&:hover': {
                background:'linear-gradient(135deg, #3367D6 0%, #2e7d32 100%)',
              },
            }}
          >
            Forstått
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
);
};

// Wrap with Visual Editor for customization support
export default withVisualEditor(LandingMobile, {
  componentId: 'landing-mobile',
  componentName: 'Landing Mobile',
  category: 'landing',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});
