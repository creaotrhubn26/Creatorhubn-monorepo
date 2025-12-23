import { useTheming } from '../utils/theming-helper';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import getProfessionIcon from '@/utils/profession-icons';
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { GdprNotice } from "@/components/common/GdprNotice";
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';

// Custom hook for scroll-triggered reveal animations
const useScrollReveal = (options?: IntersectionObserverInit) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if element is already in viewport on mount
    const element = elementRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setIsVisible(true);
        setHasAnimated(true);
        return;
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      },
      {
        threshold: 0.05,
        rootMargin: '50px 0px 50px 0px',
        ...options,
      }
    );

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [hasAnimated, options]);

  return { ref: elementRef, isVisible };
};

// Animated section wrapper component
interface AnimatedSectionProps {
  children: React.ReactNode;
  animation?: 'fadeInUp' | 'slideInLeft' | 'slideInRight' | 'scaleIn';
  delay?: number;
  className?: string;
  sx?: any;
}

const AnimatedSection: React.FC<AnimatedSectionProps> = ({ 
  children, 
  animation = 'fadeInUp',
  delay = 0,
  className,
  sx 
}) => {
  const { ref, isVisible } = useScrollReveal();
  
  // Start with initial visible state to prevent flash of hidden content
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Small delay to allow for proper hydration
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  const getAnimationStyles = () => {
    // If not mounted yet, show content immediately (prevents flash)
    if (!mounted) {
      return { opacity: 1, transform: 'none' };
    }
    
    const baseStyles = {
      fadeInUp: {
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        opacity: isVisible ? 1 : 0,
      },
      slideInLeft: {
        transform: isVisible ? 'translateX(0)' : 'translateX(-30px)',
        opacity: isVisible ? 1 : 0,
      },
      slideInRight: {
        transform: isVisible ? 'translateX(0)' : 'translateX(30px)',
        opacity: isVisible ? 1 : 0,
      },
      scaleIn: {
        transform: isVisible ? 'scale(1)' : 'scale(0.97)',
        opacity: isVisible ? 1 : 0,
      },
    };
    
    return baseStyles[animation];
  };

  return (
    <Box
      ref={ref}
      className={className}
      sx={{
        ...getAnimationStyles(),
        transition: mounted ? `all 0.7s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s` : 'none',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

// User interface definition
interface User {
  email?: string;
  profession?: string;
  userType?: string;
  isAdmin?: boolean;
}
import {
  Box,
  Container,
  Typography,
  Button,
  Card as MuiCard,
  CardContent,
  Stack,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Slider,
  Chip,
  Alert,
} from "@mui/material";
import {
  Home,
  VideoLibrary,
  LibraryMusic,
  Business,
  CheckCircle,
  Group,
  Inventory,
  PhotoCamera,
  AutoAwesome,
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
  CameraAlt,
  Schedule,
  Assessment,
  Security,
  RocketLaunch,
  Adjust,
  Login,
  ArrowForward,
  School,
  People,
  AccountCircle,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Lazy load non-critical components for performance
const LoginModal = React.lazy(() => import("@/components/auth/LoginModal"));
const InviteRequestForm = React.lazy(
  () => import("@/components/InviteRequestForm"),
);
const UniversalOnboarding = React.lazy(
  () => import("@/components/UniversalOnboarding"),
);
const SubscriptionSelectionFlow = React.lazy(
  () => import("@/components/subscription/SubscriptionSelectionFlow"),
);
// SentryTestComponent removed - only for development testing

// Performance optimization - Asset preloading for critical resources
const preloadCriticalAssets = () => {
  if (typeof document !== "undefined") {
    const preloadLinks = [
      { rel: "preload", href: "/creatorhub-logo-amber.svg", as: "image" },
      {
        rel: "preload",
        href: "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap",
        as: "style",
    },
    ];

    preloadLinks.forEach((link) => {
      const existingLink = document.querySelector(`link[href="${link.href}"]`);
      if (!existingLink) {
        const linkElement = document.createElement("link");
        Object.assign(linkElement, link);
        document.head.appendChild(linkElement);
    }
  });
}
};

preloadCriticalAssets();

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
    <Grid container spacing={3} sx={{ mt:  2 }}>
      <Grid item xs={12} md={4}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h4"
            sx={{ color: "#ff8c00", fontWeight: "bold" }}
>
            {formatNumber(stats.users.active)}
          </Typography>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            Aktive Brukere
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={12} md={4}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h4"
            sx={{ color: "#ff8c00", fontWeight: "bold" }}
>
            {formatNumber(stats.projects.completed)}
          </Typography>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            Prosjekter Fullført
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={12} md={4}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h4"
            sx={{ color: "#ff8c00", fontWeight: "bold" }}
>
            {stats.satisfaction.percentage}%
          </Typography>
          <Typography variant="body2" sx={{ color: "#374151" }}>
            Kundetilfredshet
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

// Optimized animations for 60fps performance with modern micro-interactions
const globalStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) translateZ(0) }
    50% { transform: translateY(-20px) translateZ(0) }
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0 }
    100% { background-position: 200% 0 }
  }
  
  @keyframes fadeInUp {
    from { 
      opacity: 0.2; 
      transform: translateY(20px) translateZ(0); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0px) translateZ(0); 
    }
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 20px rgba(255,140,0,0.3); }
    50% { box-shadow: 0 0 40px rgba(255,140,0,0.5); }
  }
  
  @keyframes slideInLeft {
    0% { 
      opacity: 0; 
      transform: translateX(-40px) translateZ(0); 
    }
    100% { 
      opacity: 1; 
      transform: translateX(0) translateZ(0); 
    }
  }
  
  @keyframes slideInRight {
    0% { 
      opacity: 0; 
      transform: translateX(40px) translateZ(0); 
    }
    100% { 
      opacity: 1; 
      transform: translateX(0) translateZ(0); 
    }
  }
  
  @keyframes scaleIn {
    0% { 
      opacity: 0; 
      transform: scale(0.9) translateZ(0); 
    }
    100% { 
      opacity: 1; 
      transform: scale(1) translateZ(0); 
    }
  }
  
  .critical-load-priority {
    will-change: transform, opacity;
    backface-visibility: hidden;
    perspective: 1000px;
  }
  
  .gpu-accelerated {
    transform: translateZ(0);
    will-change: transform;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .gpu-accelerated:hover {
    transform: translateY(-3px) scale(1.02) translateZ(0);
  }
  
  .gpu-accelerated:active {
    transform: translateY(-1px) scale(0.98) translateZ(0);
  }
  
  .desktop-optimized-glass {
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    transform: translateZ(0);
  }
  
  .fade-in-animation {
    animation: fadeInUp 0.8s ease-out;
  }
  
  .staggered-animation {
    opacity: 1;
    animation: fadeInUp 0.8s ease-out both;
  }
  
  .bento-card {
    transform-style: preserve-3d;
    perspective: 1000px;
  }
  
  .bento-card:hover {
    z-index: 2;
  }
  
  /* Button glow effect */
  .btn-glow {
    position: relative;
    overflow: hidden;
  }
  
  .btn-glow::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    transition: width 0.6s ease, height 0.6s ease;
    border-radius: 50%;
  }
  
  .btn-glow:hover::before {
    width: 300px;
    height: 300px;
  }
  
  /* Card shine effect */
  .card-shine {
    position: relative;
    overflow: hidden;
  }
  
  .card-shine::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      to bottom right,
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,0) 40%,
      rgba(255,255,255,0.3) 50%,
      rgba(255,255,255,0) 60%,
      rgba(255,255,255,0) 100%
    );
    transform: rotate(45deg) translateX(-100%);
    transition: transform 0.6s ease;
  }
  
  .card-shine:hover::after {
    transform: rotate(45deg) translateX(100%);
  }
  
  /* Icon bounce */
  .icon-bounce {
    transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  .icon-bounce:hover {
    transform: translateY(-4px) scale(1.1);
  }
  
  @media (prefers-reduced-motion: reduce) {
    .staggered-animation,
    .fade-in-animation,
    .gpu-accelerated,
    .bento-card,
    .btn-glow::before,
    .card-shine::after,
    .icon-bounce {
      animation: none !important;
      transform: none !important;
      transition: none !important;
    }
    .staggered-animation {
      opacity: 1;
    }
  }
  
  .staggered-animation:nth-child(1) { animation-delay: 0.1s }
  .staggered-animation:nth-child(2) { animation-delay: 0.2s }
  .staggered-animation:nth-child(3) { animation-delay: 0.3s }
  .staggered-animation:nth-child(4) { animation-delay: 0.4s }
`;

// CreatorHub Logo Icon Component for buttons
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

// Glassmorphism design constants - Standardized values
const GLASSMORPHISM_CONSTANTS = {
  BLUR_LIGHT: "blur(10px)",
  BLUR_MEDIUM: "blur(15px)",
  BLUR_STRONG: "blur(25px)",

  ALPHA_LIGHT: 0.1,
  ALPHA_MEDIUM: 0.15,
  ALPHA_STRONG: 0.25,

  BORDER_STANDARD: "1px solid rgba(255,140,0,0.2)",

  BOX_SHADOW_LIGHT: "0 4px 16px rgba(255,140,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
  BOX_SHADOW_MEDIUM: "0 8px 24px rgba(255,140,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
  BOX_SHADOW_STRONG: "0 16px 48px rgba(255,140,0,0.16), 0 4px 12px rgba(0,0,0,0.08)",
};

// Inject styles
if (
  typeof document !== "undefined" &&
  !document.getElementById("landing-desktop-styles")
) {
  const style = document.createElement("style");
  style.id = "landing-desktop-styles";
  style.textContent = globalStyles;
  document.head.appendChild(style);
}

const LandingDesktop: React.FC = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  
  // Dynamic profession system
  const { professionConfigs, getUserProfessionColor, getProfessionDisplayName } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const currentProfession = profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Fetch dynamic professions from wizard
  const { data: dynamicProfessions, isLoading: professionsLoading } = useQuery({
    queryKey: ['/api/professions/all'],
    queryFn: () => apiRequest('/api/professions/all'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1
  });
  
  // Merge dynamic professions with static fallback
  const allProfessions = React.useMemo(() => {
    const staticProfessions = [
      { role: 'photographer', label: getProfessionDisplayName('photographer'), icon: <PhotoCamera />, color: '#2e7d32', description: 'Bryllup, portrett, events og mer', isStatic: false },
      { role: 'videographer', label: getProfessionDisplayName('videographer'), icon: <VideoLibrary />, color: '#1565c0', description: 'Produksjon, redigering og levering', isStatic: false },
      { role: 'music_producer', label: getProfessionDisplayName('music_producer'), icon: <LibraryMusic />, color: '#7b1fa2', description: 'Opptak, miksing og mastering', isStatic: false },
      { role: 'vendor', label: getProfessionDisplayName('vendor'), icon: <Business />, color: '#ff8c00', description: 'Utstyr, tjenester og produkter', isStatic: false }
    ];
    
    // Prototype Tester - ALWAYS included as meta-profession (admin-controlled)
    const prototypeTester = { 
      role: 'prototype_tester', 
      label: 'Prototype Tester', 
      icon: <Science />, 
      color: '#e65100', 
      description: 'Test nye funksjoner (Krever admin-godkjenning)',
      isStatic: true, // Always available
      requiresApproval: true // Special access
    };
    
    if (dynamicProfessions?.professions && dynamicProfessions.professions.length > 0) {
      console.log('✅ Using dynamic professions from wizard: ', dynamicProfessions.professions.length);
      console.log('✅ Prototype Tester kept as static meta-profession');
      
      // Map dynamic professions to landing page format
      const mapped = dynamicProfessions.professions.map((prof: any) => ({
        role: prof.professionId,
        label: prof.displayName || prof.professionId,
        icon: <Work />, // Default icon, can be customized
        color: prof.color || '#2196f3',
        description: prof.description || 'Wizard-created profession',
        isDynamic: true,
        isStatic: false
      }));
      
      // ALWAYS append Prototype Tester at the end
      return [...mapped, prototypeTester];
    }
    
    // Fallback: static professions + prototype tester
    return [...staticProfessions, prototypeTester];
  }, [dynamicProfessions]);

  // SEO optimization with meta tags
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = "nb-NO";
      document.title = "CreatorHub Norge - Profesjonell Kreativ Plattform";

      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement("meta");
        metaDescription.setAttribute("name","description");
        document.head.appendChild(metaDescription);
    }
      metaDescription.setAttribute(
        "content","Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter. Strømlinjeforme arbeidsflyt, forbedre samarbeid og lever skreddersydde opplevelser.",
      );

      const ogTags = [
        {
          property: "og:title",
          content: "CreatorHub Norge - Profesjonell Kreativ Plattform",
      },
        {
          property: "og:description",
          content: "Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter.",
      },
        { property: "og:type", content: "website" },
        { property: "og:url", content: window.location.href },
      ];

      ogTags.forEach((tag) => {
        let metaTag = document.querySelector(
          `meta[property="${tag.property}"]`,
        );
        if (!metaTag) {
          metaTag = document.createElement("meta");
          metaTag.setAttribute("property", tag.property);
          document.head.appendChild(metaTag);
      }
        metaTag.setAttribute("content", tag.content);
    });
  }
}, []);

  // Modal state management
  const [modalState, setModalState] = React.useState({
    showSidebar: false,
    showRoleSelector: false,
    showSubscriptionSelection: false,
    showLoginModal: false,
    showInviteRequest: false,
    showOnboarding: false,
    selectedRole: ", ",
    selectedPlan: null as any,
  });

  // Google Workspace dialog state
  const [googleWorkspaceDialogOpen, setGoogleWorkspaceDialogOpen] =
    React.useState(false);

  // Comprehensive modal cleanup function
  const resetAllModals = React.useCallback(() => {
    setModalState({
      showSidebar: false,
      showRoleSelector: false,
      showSubscriptionSelection: false,
      showLoginModal: false,
      showInviteRequest: false,
      showOnboarding: false,
      selectedRole: ", ",
      selectedPlan: null,
    });
  }, []);

  // Escape key handler for consistent modal behavior
  React.useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (modalState.showInviteRequest) {
          setModalState((prev) => ({
            ...prev,
            showInviteRequest: false,
            selectedRole: ", ",
        }));
      } else if (modalState.showRoleSelector) {
          setModalState((prev) => ({
            ...prev,
            showRoleSelector: false,
            selectedRole: ", ",
        }));
      } else if (modalState.showLoginModal) {
          setModalState((prev) => ({ ...prev, showLoginModal: false }));
      } else if (modalState.showSidebar) {
          setModalState((prev) => ({ ...prev, showSidebar: false }));
      }
    }
  };

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
}, [modalState]);

  // Navigation cleanup with consistent state management
  const handleNavigationCleanup = React.useCallback(
    (path: string) => {
      setLocation(path);
      resetAllModals();
},
    [setLocation, resetAllModals],
  );

  // Optimized user data fetching with aggressive caching
  // ✅ FIX #2: Use correct endpoint /api/auth/status
  const { data: authData, isLoading: userLoading } = useQuery({
    queryKey: ["/api/auth/status"],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 100,
    gcTime: 10 * 60 * 100,
});

  const isAuthenticated = authData?.authenticated || false;
  const currentUser = authData?.user;
  const userProfession = currentUser?.profession || currentUser?.userType;
  const isAdmin =
    currentUser?.email === "daniel@creatorhubn.com" || currentUser?.isAdmin;

  // ✅ FIX #1: Listen for 'auth-changed' event from LoginModal
  React.useEffect(() => {
    const handleAuthChanged = () => {
      console.log('🔄 Auth state changed, refetching user data...');
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-changed', handleAuthChanged);
  }, [queryClient]);

  // ✅ Check onboarding status after login
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
            console.log('📋 Onboarding status:', data);

            if (data.needsOnboarding) {
              console.log('🎓 User needs onboarding - showing UniversalOnboarding');
              setModalState((prev) => ({ ...prev, showOnboarding: true }));
            }
          }
        } catch (error) {
          console.error('Failed to check onboarding status:', error);
        }
      })();
    }
  }, [isAuthenticated, currentUser]);

  // Role-based access control
  const canAccessProfession = (profession: string) => {
    try {
      if (isAdmin) {
        console.log(
          `Admin Access: ${currentUser?.email} accessing ${profession} dashboard`,
        );
        return true;
    }

      if (userLoading) {
        return false;
    }

      const detectedProfession =
        userProfession ||
        currentUser?.profession ||
        currentUser?.userType ||
        "unknown";

      if (detectedProfession === "unknown" && isAuthenticated) {
        return false;
    }

      const hasAccess = detectedProfession === profession;
      return hasAccess;
  } catch (error) {
      console.error(`Error in canAccessProfession(${profession}):`, error);
      return false;
  }
};

  const handleNavigation = (path: string) => {
    handleNavigationCleanup(path);
};

  // ✅ OPTION 1: Separate buttons for new vs existing users

  // For new users - opens role selector to choose profession
  const handleGetStarted = () => {
    console.log('🆕 New user signup flow - opening role selector');
    setModalState((prev) => ({ ...prev, showRoleSelector: true }));
};

  // For existing users - opens login modal directly
  const handleLogin = () => {
    console.log('🔐 Existing user login - opening login modal');
    setModalState((prev) => ({ ...prev, showLoginModal: true }));
};

  const handleJoinAsProfessional = () => {
    console.log('👔 Professional signup - opening role selector');
    setModalState((prev) => ({ ...prev, showRoleSelector: true }));
};

  const handleVendorNetwork = () => {
    setModalState((prev) => ({
      ...prev,
      selectedRole: "vendor",
      showInviteRequest: true,
      showRoleSelector: false,
  }));
};

  const handleRoleSelection = (role: string) => {
    setModalState((prev) => ({
      ...prev,
      selectedRole: role,
      showRoleSelector: false,
      showSubscriptionSelection: true, // Show subscription selection after role
  }));
    console.log(`Role selected: ${role} - moving to subscription selection`);
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
      className="critical-load-priority fade-in-animation"
      sx={{
        minHeight: "100vh",
        background: `
          linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, #f59e0b 100%),
          radial-gradient(circle at 20% 80%, rgba(255,140,0,0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255,179,71,0.25) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(255,140,0,0.2) 0%, transparent 50%)
        `,
        position: "relative",
        overflow: "hidden", "&::before": {
          content: '""',
          position: "absolute",
          top:  0,
          left:  0,
          right:  0,
          bottom:  0,
          background: "linear-gradient(45deg, transparent 30%, rgba(255,140,0,0.1) 50%, transparent 70%)",
          zIndex: 1,
          pointerEvents: "none",
      },
    }}
    >
      {/* Desktop-optimized floating background elements */}
      <Box
        sx={{
          position: "absolute",
          top: "15%",
          left: "10%",
          width: "400px",
          height: "400px",
          background: `radial-gradient(circle, rgba(255,140,0,0.4) 0%, rgba(255,179,71,0.2) 40%, transparent 70%)`,
          borderRadius: "50%",
          filter: GLASSMORPHISM_CONSTANTS.BLUR_STRONG,
          animation: "float 12s ease-in-out infinite",
          zIndex: 0,
      }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "10%",
          right: "15%",
          width: "350px",
          height: "350px",
          background: `radial-gradient(circle, rgba(255,140,0,0.35) 0%, rgba(255,179,71,0.2) 40%, transparent 70%)`,
          borderRadius: "50%",
          filter: GLASSMORPHISM_CONSTANTS.BLUR_STRONG,
          animation: "float 8s ease-in-out infinite reverse",
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
          position: "sticky",
          top:  0,
          zIndex: 10,
          boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_LIGHT,
      }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              py:  3,
          }}
          >
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
                  alt="CreatorHub Norge - Profesjonell kreativ plattform for norske fotografer, videografer og musikkprodusenter"
                  sx={{
                    width: "280px",
                    height: "150px",
                    filter: "drop-shadow(0 4px 8px rgba(255,140,0,0.2))",
                  }}
                />
              </Box>
            </Box>

            {/* Desktop Navigation */}
            <Stack direction="row" spacing={2} alignItems="center">
              {isAuthenticated ? (
                <>
                  <Button
                    variant="text"
                    onClick={() => handleNavigation("/about-us")}
                    sx={{
                      color: "#ff8c00",
                      textTransform: "none",
                      fontSize: "15px",
                      fontWeight: "medium",
                      "&:hover": {
                        backgroundColor: "rgba(255,140,0,0.1)",
                      },
                    }}
                  >
                    Om Oss
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => handleNavigation("/dashboard")}
                    aria-label="Gå til dashboard"
                    sx={{
                      borderColor: "#ff8c00",
                      color: "#ff8c00","&:hover": {
                        borderColor: "#e67c00",
                        backgroundColor: "rgba(255,140,0,0.1)",
                    },
                      "&:focus": {
                        outline: "2px solid #ff8c0",
                        outlineOffset: "2px",
                    },
                  }}
                  >
                    Dashboard
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outlined"
                      onClick={() => handleNavigation("/admin")}
                      sx={{
                        borderColor: "#ff8c00",
                        color: "#ff8c00","&:hover": {
                          borderColor: "#e67c00",
                          backgroundColor: "rgba(255,140,0,0.1)",
                      },
                    }}
                    >
                      Admin
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="text"
                    onClick={() => handleNavigation("/academy")}
                    startIcon={<School sx={{ fontSize: 18 }} />}
                    sx={{
                      color: "#1f2937",
                      textTransform: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      px: 2,
                      py: 0.75,
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(234,88,12,0.05) 100%)",
                      border: "1px solid rgba(251,146,60,0.2)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "& .MuiButton-startIcon": {
                        color: "#ea580c",
                      },
                      "&:hover": {
                        background: "linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(234,88,12,0.1) 100%)",
                        border: "1px solid rgba(251,146,60,0.4)",
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(251,146,60,0.2)",
                      },
                    }}
                  >
                    Academy
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => handleNavigation("/community")}
                    startIcon={<People sx={{ fontSize: 18 }} />}
                    sx={{
                      color: "#1f2937",
                      textTransform: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      px: 2,
                      py: 0.75,
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(109,40,217,0.05) 100%)",
                      border: "1px solid rgba(139,92,246,0.2)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "& .MuiButton-startIcon": {
                        color: "#7c3aed",
                      },
                      "&:hover": {
                        background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(109,40,217,0.1) 100%)",
                        border: "1px solid rgba(139,92,246,0.4)",
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(139,92,246,0.2)",
                      },
                    }}
                  >
                    Community
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleLogin}
                    aria-label="Logg inn på din konto"
                    sx={{
                      borderColor: "#ff8c00",
                      color: "#ff8c00",
                      px:  3,
                      py:  1,
                      "&:hover": {
                        borderColor: "#e67c00",
                        backgroundColor: "rgba(255,140,0,0.1)",
                    },
                      "&:focus": {
                        outline: "2px solid #ff8c0",
                        outlineOffset: "2px",
                    },
                  }}
                  startIcon={<Login sx={{ fontSize: 18 }} />}
                  >
                    Logg Inn
                  </Button>
                  <Button variant="contained"
                    onClick={handleGetStarted}
                    className="gpu-accelerated"
                    aria-label="Kom i gang med CreatorHub Norge"
                    sx={{
                      backgroundColor: "#ff8c00",
                      color: "white",
                      px:  4,
                      py: 1.5,
                      borderRadius: "12px",
                      fontSize: "16px",
                      fontWeight: "bold",
                      textTransform: "none",
                      boxShadow: "0 4px 12px rgba(255,140,0,0.3)","&:hover": {
                        backgroundColor: "#e67c00",
                        transform: "translateY(-2px) translateZ(0)",
                        boxShadow: "0 6px 16px rgba(255,140,0,0.4)",
                    },
                      "&:focus": {
                        outline: "2px solid #ffffff",
                        outlineOffset: "2px",
                    },
                  }}
                  startIcon={<CreatorHubLogoIcon size={22} />}
                  >
                    Kom i Gang
                  </Button>
                </>
              )}
            </Stack>
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="lg" sx={{ py:  6 }}>
        <Grid container spacing={4}>
          {/* Hero Section - Left Column */}
          <Grid item xs={12} md={6} className="staggered-animation">
            <Box sx={{ py:  4 }}>
              {/* Orange Badge */}
              {/* Main Hero Title */}
              <Typography variant="h2"
                sx={{
                  fontWeight: "bold",
                  color: "#1f2937",
                  mb:  2,
                  lineHeight: 1.1,
                  fontSize: { md: "48px", lg: "56px" },
              }}
    >
                Profesjonell Kreativ
              </Typography>
              <Typography variant="h2"
                sx={{
                  fontWeight: "bold",
                  background: "linear-gradient(135deg, #ff8c00 0%, #f59e0b 40%, #d97706 70%, #ea580c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  mb:  3,
                  fontSize: { md: "48px", lg: "56px" },
                  display: "inline-block",
              }}
    >
                Plattform
              </Typography>

              {/* Hero Description */}
              <Typography variant="h6"
                sx={{
                  color: "#374151",
                  mb:  4,
                  lineHeight: 1.6,
                  fontSize: "18px",
                  maxWidth: "500px",
              }}
    >
                Alt-i-ett plattform for kreative i Norge. StoryArc Studio,
                Academy, Community, og sømløse integrasjoner.
                Alt du trenger for å vokse.
              </Typography>

              {/* Hero Action Buttons */}
              <Stack direction="row" spacing={3} sx={{ mb:  4 }}>
                <Button variant="contained"
                  size="large"
                  className="gpu-accelerated btn-glow"
                  sx={{
                    background: "linear-gradient(135deg, #ff8c00 0%, #f59e0b 100%)",
                    color: "white",
                    py:  2,
                    px:  5,
                    minHeight: "56px",
                    borderRadius: "16px",
                    fontSize: "18px",
                    fontWeight: "bold",
                    textTransform: "none",
                    boxShadow: "0 8px 24px rgba(255,140,0,0.35), 0 2px 8px rgba(0,0,0,0.1)",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #e67c00 0%, #d97706 100%)",
                      transform: "translateY(-4px) scale(1.02)",
                      boxShadow: "0 16px 40px rgba(255,140,0,0.45), 0 4px 12px rgba(0,0,0,0.15)",
                    },
                    "&:active": {
                      transform: "translateY(-2px) scale(0.98)",
                    },
                }}
                  onClick={handleGetStarted}
                  startIcon={<RocketLaunch sx={{ fontSize: 22 }} />}
                >
                  Bli med i CreatorHub
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleLogin}
                  className="gpu-accelerated"
                  startIcon={<Login sx={{ fontSize: 20 }} />}
                  sx={{
                    borderColor: "#ff8c00",
                    color: "#ff8c00",
                    py:  2,
                    px:  4,
                    minHeight: "56px",
                    borderRadius: "16px",
                    fontSize: "18px",
                    fontWeight: "bold",
                    textTransform: "none",
                    borderWidth: "2px",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      borderColor: "#e67c00",
                      backgroundColor: "rgba(255,140,0,0.08)",
                      borderWidth: "2px",
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 24px rgba(255,140,0,0.2)",
                    },
                    "&:active": {
                      transform: "translateY(-2px)",
                    },
                }}
                >
                  Logg inn
                </Button>
              </Stack>

              {/* Dynamic Key Stats - Only shown when 350+ users */}
              <DynamicPlatformStats />

              {/* Google Workspace Integration */}
              <MuiCard
                className="card-shine"
                sx={{
                  mt: 4,
                  borderRadius: "20px",
                  background: `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.9) 100%)`,
                  backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
                  border: "1px solid rgba(66,133,244,0.15)",
                  boxShadow: "0 4px 20px rgba(66,133,244,0.1), 0 2px 8px rgba(0,0,0,0.04)",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden",
                  "&:hover": {
                    transform: "translateY(-6px) scale(1.01)",
                    boxShadow: "0 16px 48px rgba(66,133,244,0.18), 0 4px 16px rgba(0,0,0,0.08)",
                },
              }}
              >
                <CardContent sx={{ p:  3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb:  2 }}>
                    {/* Official Google Logo */}
                    <Box
                      sx={{
                        width:  48,
                        height:  48,
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.9)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(0,0,0,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mr:  2,
                    }}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        xmlns="http: //www.w3.org/2000/svg"
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
                      <Typography variant="h5"
                        sx={{ fontWeight: "bold", color: "#1f2937", mb: 0.5}}
            >
                        Google Workspace Integration
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280" }}>
                        Full integrasjon med Google's forretningsverktøy
                      </Typography>
                    </Box>
                  </Box>

                  <Grid container spacing={2} sx={{ mb:  2 }}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["Gmail & Calendar","Google Drive Sync"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#4285F4", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["Docs & Sheets API","Automatisk Backup"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#4285F4", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                  </Grid>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", gap:  1 }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setGoogleWorkspaceDialogOpen(true)}
                      sx={{
                        borderColor: "#4285F4",
                        color: "#4285F4",
                        fontSize: "14px",
                        textTransform: "none","&:hover": {
                          borderColor: "#3367D6",
                          backgroundColor: "rgba(6,133,244,0.1)",
                      },
                    }}
                    >
                      Hvorfor Google Workspace?
                    </Button>

                    <Button variant="contained"
                      size="small"
                      href="https: //workspace.google.com/intl/no/"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        background:
                          "linear-gradient(135deg, #4285F4 0%, #34A853 100%)",
                        color: "white",
                        fontSize: "14px",
                        textTransform: "none",
                        boxShadow: "0 4px 12px rgba(6,133,244,0.3)","&:hover": {
                          background: "linear-gradient(135deg, #3367D6 0%, #2e7d32 100%)",
                          boxShadow: "0 6px 16px rgba(6,133,244,0.4)",
                      },
                    }}
                    >
                      Les mer om Google Workspace
                    </Button>
                  </Stack>
                </CardContent>
              </MuiCard>
            </Box>
          </Grid>

          {/* Professional Cards - Right Column */}
          <Grid item xs={12} md={6} sx={{ mt: { xs: 3, md: 6, lg: 1.5 } }}>
            <Stack spacing={4} className="staggered-animation">
              {/* Fotograf Card */}
              <MuiCard
                className="card-shine"
                sx={{
                  borderRadius: "20px",
                  background: `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,253,244,0.9) 100%)`,
                  backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
                  border: "1px solid rgba(46,125,50,0.15)",
                  boxShadow: "0 4px 16px rgba(46,125,50,0.08), 0 1px 4px rgba(0,0,0,0.04)",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden",
                  "&:hover": {
                    transform: "translateY(-6px) scale(1.01)",
                    boxShadow: "0 16px 40px rgba(46,125,50,0.15), 0 4px 12px rgba(0,0,0,0.08)",
                    "& .profession-icon": {
                      transform: "scale(1.1)",
                    },
                },
              }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <Box
                      className="profession-icon"
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mr: 2,
                        boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
                        transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    >
                      <PhotoCamera sx={{ color: "white", fontSize: 26 }} />
                    </Box>
                    <Typography variant="h5"
                      sx={{ fontWeight: "bold", color: "#1f2937" }}
          >
                      {getProfessionDisplayName('photographer')}
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["Showcase Galleri","Klienthåndtering"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#2e7d32", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["Academy","Community"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#2e7d32", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </MuiCard>

              {/* Videografi Card */}
              <MuiCard
                className="card-shine"
                sx={{
                  borderRadius: "20px",
                  background: `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.9) 100%)`,
                  backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
                  border: "1px solid rgba(37,99,235,0.15)",
                  boxShadow: "0 4px 16px rgba(37,99,235,0.08), 0 1px 4px rgba(0,0,0,0.04)",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden",
                  "&:hover": {
                    transform: "translateY(-6px) scale(1.01)",
                    boxShadow: "0 16px 40px rgba(37,99,235,0.15), 0 4px 12px rgba(0,0,0,0.08)",
                    "& .profession-icon": {
                      transform: "scale(1.1)",
                    },
                },
              }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <Box
                      className="profession-icon"
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mr: 2,
                        boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                        transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    >
                      <VideoLibrary sx={{ color: "white", fontSize: 26 }} />
                    </Box>
                    <Typography variant="h5"
                      sx={{ fontWeight: "bold", color: "#1f2937" }}
          >
                      {getProfessionDisplayName('videographer')}
                    </Typography>
                  </Box>

                  <Grid container spacing={5}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["StoryArc Studio","Smart Redigering"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#1565c0", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["NLE-eksport","Academy"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#1565c0", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </MuiCard>

              {/* Musikk Produksjon Card */}
              <MuiCard
                className="card-shine"
                sx={{
                  borderRadius: "20px",
                  background: `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(250,245,255,0.9) 100%)`,
                  backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
                  border: "1px solid rgba(147,51,234,0.15)",
                  boxShadow: "0 4px 16px rgba(147,51,234,0.08), 0 1px 4px rgba(0,0,0,0.04)",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden",
                  "&:hover": {
                    transform: "translateY(-6px) scale(1.01)",
                    boxShadow: "0 16px 40px rgba(147,51,234,0.15), 0 4px 12px rgba(0,0,0,0.08)",
                    "& .profession-icon": {
                      transform: "scale(1.1)",
                    },
                },
              }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <Box
                      className="profession-icon"
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mr: 2,
                        boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
                        transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    >
                      <LibraryMusic sx={{ color: "white", fontSize: 26 }} />
                    </Box>
                    <Typography variant="h5"
                      sx={{ fontWeight: "bold", color: "#1f2937" }}
          >
                      Musikk Produksjon
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["Studioadministrasjon","Klientportal"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#7b1fa2", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {["Academy","Community"].map(
                          (item, index) => (
                            <Box
                              key={index}
                              sx={{ display: "flex", alignItems: "center" }}
                            >
                              <CheckCircle
                                sx={{ color: "#7b1fa2", fontSize:  18, mr: 1.5}}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "#374151" }}
                              >
                                {item}
                              </Typography>
                            </Box>
                          ),
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </MuiCard>
            </Stack>
          </Grid>
        </Grid>

        {/* Features Section */}
        <Box sx={{ mt: 12 }}>
          {/* Section Header with Visual Enhancement */}
          <Box sx={{ textAlign: "center", mb: 6 }}>
            {/* Decorative Badge */}
            <Box 
              sx={{ 
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 2.5,
                py: 1,
                mb: 3,
                borderRadius: "50px",
                background: "linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(234,88,12,0.1) 100%)",
                border: "1px solid rgba(251,146,60,0.3)",
              }}
            >
              <Box 
                sx={{ 
                  width: 8, 
                  height: 8, 
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
                  fontSize: "0.75rem",
                }}
              >
                Plattformen for de kreative
              </Typography>
            </Box>

            {/* Main Heading */}
            <Typography 
              id="features-heading"
              component="h2"
              variant="h3"
              sx={{ 
                fontWeight: 800, 
                color: "#1f2937", 
                mb: 2,
                fontSize: { xs: "2rem", md: "2.75rem" },
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

            {/* Subtitle with Icon Accents */}
            <Typography 
              variant="h6"
              sx={{ 
                color: "#6b7280", 
                maxWidth: "600px", 
                mx: "auto", 
                lineHeight: 1.8, 
                fontWeight: 400,
                fontSize: { xs: "1rem", md: "1.125rem" },
              }}
            >
              Alt du trenger for å drive en profesjonell kreativ virksomhet i Norge
            </Typography>

            {/* Decorative Divider */}
            <Box 
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: 2, 
                mt: 4,
              }}
            >
              <Box sx={{ width: 60, height: 2, background: "linear-gradient(90deg, transparent, rgba(251,146,60,0.5))", borderRadius: 1 }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)", opacity: 0.8 }} />
              <Box sx={{ width: 60, height: 2, background: "linear-gradient(90deg, rgba(251,146,60,0.5), transparent)", borderRadius: 1 }} />
            </Box>
          </Box>

          {/* Bento Grid Layout */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gridTemplateRows: { xs: "auto", md: "auto auto" },
              gap: 3,
            }}
          >
            {/* Card 1 - Prosjektadministrasjon (Large - spans 2 cols) */}
            <MuiCard
              className="card-shine"
              sx={{
                gridColumn: { xs: "1", md: "1 / 3" },
                gridRow: { xs: "auto", md: "1" },
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 100%)",
                border: "1px solid rgba(255,140,0,0.15)",
                boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                overflow: "hidden",
                position: "relative",
                "&:hover": {
                  transform: "translateY(-6px)",
                  boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_STRONG,
                },
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "200px",
                  height: "200px",
                  background: "radial-gradient(circle, rgba(255,140,0,0.08) 0%, transparent 70%)",
                  borderRadius: "50%",
                  transform: "translate(30%, -30%)",
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 5 }, position: "relative", zIndex: 1 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }}>
                  <Box sx={{ 
                    width: 80, height: 80, borderRadius: "20px", flexShrink: 0,
                    background: "linear-gradient(135deg, #ff8c00 0%, #f59e0b 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 12px 32px rgba(255,140,0,0.35)",
                  }}>
                    <Assessment sx={{ fontSize: 40, color: "white" }} />
                  </Box>
                  <Box>
                    <Typography component="h3" variant="h4" sx={{ fontWeight: "bold", color: "#1f2937", mb: 1.5 }}>
                      Prosjektadministrasjon
                    </Typography>
                    <Typography variant="body1" sx={{ color: "#4b5563", lineHeight: 1.8, maxWidth: "500px" }}>
                      Effektiv prosjektstyring med intelligente løsninger for planlegging, produksjon og post-produksjon. Hold oversikt over alle prosjekter på ett sted.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </MuiCard>

            {/* Card 2 - StoryArc Studio (Featured - tall card) */}
            <MuiCard
              className="card-shine"
              sx={{
                gridColumn: { xs: "1", md: "3" },
                gridRow: { xs: "auto", md: "1 / 3" },
                borderRadius: "24px",
                background: "linear-gradient(145deg, #ff8c00 0%, #f59e0b 40%, #d97706 100%)",
                boxShadow: "0 16px 48px rgba(255,140,0,0.3)",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                overflow: "hidden",
                position: "relative",
                "&:hover": {
                  transform: "translateY(-6px) scale(1.01)",
                  boxShadow: "0 20px 56px rgba(255,140,0,0.4)",
                },
                "&::before": {
                  content: '""',
                  position: "absolute",
                  bottom: "-50px",
                  left: "-50px",
                  width: "200px",
                  height: "200px",
                  background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
                  borderRadius: "50%",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  width: "120px",
                  height: "120px",
                  background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
                  borderRadius: "50%",
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 }, height: "100%", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
                <Box sx={{ 
                  width: 72, height: 72, borderRadius: "18px", 
                  overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 3,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}>
                  {/* StoryArc Studio App Icon - Clapperboard */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="72" height="72">
                    <defs>
                      <linearGradient id="gradSASApp" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ff8c00"/>
                        <stop offset="100%" stopColor="#6a00ff"/>
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="220" height="220" rx="44" fill="url(#gradSASApp)"/>
                    <rect x="50" y="100" width="120" height="70" rx="10" fill="#fff"/>
                    <rect x="50" y="70" width="120" height="40" rx="6" fill="#222"/>
                    <line x1="60" y1="85" x2="160" y2="100" stroke="#fff" strokeWidth="6" strokeDasharray="14 14"/>
                    <polygon points="95,115 135,135 95,155" fill="#ff8c00"/>
                  </svg>
                </Box>
                <Typography component="h3" variant="h4" sx={{ fontWeight: "bold", color: "white", mb: 2 }}>
                  StoryArc Studio
                </Typography>
                <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.95)", lineHeight: 1.8, mb: 3, flex: 1 }}>
                  Profesjonell videoredigering som analyserer innholdet ditt og genererer story arcs automatisk. Eksporter til DaVinci Resolve, Final Cut Pro og Premiere.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                  <Chip label="Auto-analyse" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }} />
                  <Chip label="Smart redigering" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }} />
                  <Chip label="NLE-eksport" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }} />
                </Stack>
              </CardContent>
            </MuiCard>

            {/* Card 3 - Integrasjoner */}
            <MuiCard
              className="card-shine"
              sx={{
                gridColumn: { xs: "1", md: "1" },
                gridRow: { xs: "auto", md: "2" },
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(254,243,199,0.95) 100%)",
                border: "1px solid rgba(255,140,0,0.12)",
                boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "translateY(-6px)",
                  boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_STRONG,
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ 
                  width: 64, height: 64, borderRadius: "16px", 
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 3,
                  boxShadow: "0 8px 24px rgba(245,158,11,0.3)",
                }}>
                  <Settings sx={{ fontSize: 32, color: "white" }} />
                </Box>
                <Typography component="h3" variant="h5" sx={{ fontWeight: "bold", color: "#1f2937", mb: 1.5 }}>
                  Integrasjoner
                </Typography>
                <Typography variant="body1" sx={{ color: "#4b5563", lineHeight: 1.7 }}>
                  Sømløs integrasjon med verktøyene du bruker. Google Workspace, DaVinci Resolve, Final Cut Pro, Premiere Pro. Fiken kommer snart.
                </Typography>
              </CardContent>
            </MuiCard>

            {/* Card 4 - Academy & Community */}
            <MuiCard
              className="card-shine"
              sx={{
                gridColumn: { xs: "1", md: "2" },
                gridRow: { xs: "auto", md: "2" },
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,251,235,0.95) 100%)",
                border: "1px solid rgba(255,140,0,0.12)",
                boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_MEDIUM,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "translateY(-6px)",
                  boxShadow: GLASSMORPHISM_CONSTANTS.BOX_SHADOW_STRONG,
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ 
                  width: 64, height: 64, borderRadius: "16px", 
                  background: "linear-gradient(135deg, #ea580c 0%, #d97706 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 3,
                  boxShadow: "0 8px 24px rgba(234,88,12,0.3)",
                }}>
                  <Group sx={{ fontSize: 32, color: "white" }} />
                </Box>
                <Typography component="h3" variant="h5" sx={{ fontWeight: "bold", color: "#1f2937", mb: 1.5 }}>
                  Academy & Community
                </Typography>
                <Typography variant="body1" sx={{ color: "#4b5563", lineHeight: 1.7 }}>
                  Lær nye ferdigheter med kurs og tutorials. Koble deg til andre kreative i vårt community.
                </Typography>
              </CardContent>
            </MuiCard>
          </Box>
        </Box>

        {/* Call to Action Section */}
        <Box
          className="fade-in-animation"
            sx={{
              mt: 12,
              textAlign: "center",
              background: `linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.95) 50%, rgba(254,243,199,0.9) 100%)`,
              backdropFilter: GLASSMORPHISM_CONSTANTS.BLUR_MEDIUM,
              border: "1px solid rgba(255,140,0,0.2)",
              borderRadius: "40px",
              p: { xs: 5, md: 10 },
              boxShadow: "0 32px 80px rgba(255,140,0,0.15), 0 12px 32px rgba(0,0,0,0.08)",
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: "-50%",
                left: "-50%",
                width: "200%",
                height: "200%",
                background: "radial-gradient(circle at 20% 20%, rgba(255,140,0,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(234,88,12,0.08) 0%, transparent 50%)",
                animation: "float 25s ease-in-out infinite",
                pointerEvents: "none",
              },
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "linear-gradient(180deg, transparent 0%, rgba(255,140,0,0.03) 100%)",
                pointerEvents: "none",
              },
            }}
          >
          {/* Animated CreatorHub Logo */}
          <Box 
            sx={{ 
              position: "relative",
              width: 120,
              height: 120,
              mx: "auto",
              mb: 4,
              zIndex: 1,
            }}
          >
            <svg
              viewBox="0 0 120 120"
              width="120"
              height="120"
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* CreatorHub Amber-Orange Gradient */}
                <linearGradient id="ctaLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                {/* Glow filter */}
                <filter id="ctaLogoGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Drop shadow */}
                <filter id="ctaDropShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="1" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.2"/>
                </filter>
              </defs>
              
              {/* Outer rotating ring */}
              <circle
                cx="60"
                cy="60"
                r="55"
                fill="none"
                stroke="rgba(251,146,60,0.15)"
                strokeWidth="1"
                strokeDasharray="10 5"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 60 60"
                  to="360 60 60"
                  dur="40s"
                  repeatCount="indefinite"
                />
              </circle>
              
              {/* Middle pulsing circle */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="rgba(234,88,12,0.2)"
                strokeWidth="1.5"
              >
                <animate
                  attributeName="r"
                  values="43;47;43"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-opacity"
                  values="0.2;0.4;0.2"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
              
              {/* Background circle with glow */}
              <g filter="url(#ctaLogoGlow)">
                <circle
                  cx="60"
                  cy="60"
                  r="36"
                  fill="url(#ctaLogoGradient)"
                >
                  <animate
                    attributeName="r"
                    values="35;37;35"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
              
              {/* CreatorHub Logo Icon - Creative Tools */}
              <g transform="translate(40, 40)" filter="url(#ctaDropShadow)">
                {/* Central Pencil */}
                <path 
                  d="M20 8 L20 32 L17 35 L14 32 L14 30 L11 30 L11 12 L14 8 Z" 
                  fill="white"
                  opacity="0.95"
                >
                  <animate
                    attributeName="opacity"
                    values="0.95;1;0.95"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </path>
                
                {/* Pencil Tip */}
                <polygon points="14,8 17,4 20,8" fill="rgba(255,255,255,0.7)"/>
                
                {/* Camera icon - top right */}
                <g>
                  <circle cx="30" cy="12" r="5" fill="white" opacity="0.9">
                    <animate
                      attributeName="opacity"
                      values="0.9;1;0.9"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <rect x="28" y="10" width="4" height="4" rx="0.5" fill="url(#ctaLogoGradient)"/>
                  <line x1="20" y1="14" x2="25" y2="12" stroke="white" strokeWidth="2" opacity="0.8"/>
                </g>
                
                {/* Video icon - top left */}
                <g>
                  <polygon points="8,12 2,8 2,16" fill="white" opacity="0.9">
                    <animate
                      attributeName="opacity"
                      values="0.9;1;0.9"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </polygon>
                  <line x1="14" y1="14" x2="8" y2="12" stroke="white" strokeWidth="2" opacity="0.8"/>
                </g>
                
                {/* Music Note - bottom right */}
                <g>
                  <circle cx="30" cy="30" r="3" fill="white" opacity="0.9">
                    <animate
                      attributeName="opacity"
                      values="0.9;1;0.9"
                      dur="2.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <rect x="30" y="24" width="1.5" height="6" fill="white" opacity="0.9"/>
                  <path d="M31.5 24 Q35 22 35 26" stroke="white" strokeWidth="1.5" fill="none" opacity="0.9"/>
                  <line x1="20" y1="26" x2="27" y2="30" stroke="white" strokeWidth="2" opacity="0.8"/>
                </g>
                
                {/* Palette - bottom left */}
                <g>
                  <circle cx="8" cy="30" r="5" fill="white" opacity="0.9">
                    <animate
                      attributeName="opacity"
                      values="0.9;1;0.9"
                      dur="2.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx="6" cy="28" r="1.2" fill="url(#ctaLogoGradient)"/>
                  <circle cx="10" cy="28" r="1.2" fill="#f59e0b"/>
                  <circle cx="8" cy="32" r="1.2" fill="#ea580c"/>
                  <line x1="14" y1="26" x2="13" y2="30" stroke="white" strokeWidth="2" opacity="0.8"/>
                </g>
              </g>
              
              {/* Orbiting particles */}
              <circle cx="60" cy="2" r="3" fill="#f59e0b">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 60 60"
                  to="360 60 60"
                  dur="12s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0.5;1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="118" cy="60" r="2.5" fill="#f97316">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="90 60 60"
                  to="450 60 60"
                  dur="18s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="60" cy="118" r="2" fill="#ea580c">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="180 60 60"
                  to="-180 60 60"
                  dur="15s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </Box>

          {/* Main Heading */}
          <Typography variant="h3"
            sx={{ 
              fontWeight: 800, 
              color: "#1f2937", 
              mb: 3,
              position: "relative",
              zIndex: 1,
              fontSize: { xs: "1.75rem", md: "2.5rem" },
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
            <br />
            din kreative virksomhet?
          </Typography>

          {/* Subtitle */}
          <Typography variant="h6"
            sx={{ 
              color: "#6b7280", 
              mb: 5, 
              maxWidth: "550px", 
              mx: "auto",
              lineHeight: 1.8,
              position: "relative",
              zIndex: 1,
              fontWeight: 400,
              fontSize: { xs: "1rem", md: "1.125rem" },
            }}
          >
            Bli med i{" "}
            <Box component="span" sx={{ fontWeight: 600, color: "#374151" }}>
              CreatorHub Norge
            </Box>
            {" "}i dag og opplev forskjellen profesjonelle verktøy kan gjøre.
          </Typography>

          {/* Decorative line */}
          <Box 
            sx={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: 2, 
              mb: 5,
              position: "relative",
              zIndex: 1,
            }}
          >
            <Box sx={{ width: 80, height: 2, background: "linear-gradient(90deg, transparent, rgba(251,146,60,0.4))", borderRadius: 1 }} />
            <Box sx={{ 
              width: 12, 
              height: 12, 
              borderRadius: "50%", 
              background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
              boxShadow: "0 0 16px rgba(251,146,60,0.4)",
            }} />
            <Box sx={{ width: 80, height: 2, background: "linear-gradient(90deg, rgba(251,146,60,0.4), transparent)", borderRadius: 1 }} />
          </Box>

          {/* CTA Button */}
          <Button variant="contained"
            size="large"
            className="gpu-accelerated btn-glow"
            sx={{
              background: "linear-gradient(135deg, #ff8c00 0%, #f59e0b 50%, #d97706 100%)",
              color: "white",
              py: 2.5,
              px: 7,
              minHeight: "68px",
              borderRadius: "20px",
              fontSize: "20px",
              fontWeight: "bold",
              textTransform: "none",
              boxShadow: "0 12px 32px rgba(255,140,0,0.4), 0 4px 12px rgba(0,0,0,0.1)",
              position: "relative",
              zIndex: 1,
              overflow: "hidden",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                background: "linear-gradient(135deg, #e67c00 0%, #d97706 50%, #c2410c 100%)",
                transform: "translateY(-6px) scale(1.03)",
                boxShadow: "0 20px 48px rgba(255,140,0,0.5), 0 8px 20px rgba(0,0,0,0.15)",
              },
              "&:active": {
                transform: "translateY(-2px) scale(0.98)",
              },
            }}
            onClick={handleGetStarted}
            startIcon={<CreatorHubLogoIcon size={28} />}
            endIcon={<ArrowForward sx={{ fontSize: 20 }} />}
          >
            Bli en del av CreatorHub Norge
          </Button>
        </Box>
      </Container>

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
                  }}>
                    {item.label}
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

      {/* Login Modal */}
      {modalState.showLoginModal && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <LoginModal
            open={modalState.showLoginModal}
            onClose={handleCloseModals}
          />
        </React.Suspense>
      )}

      {/* Invite Request Modal */}
      {modalState.showInviteRequest && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <InviteRequestForm
            isOpen={modalState.showInviteRequest}
            onClose={handleCloseModals}
            selectedRole={modalState.selectedRole}
            selectedPlan={modalState.selectedPlan}
          />
        </React.Suspense>
      )}

      {/* Universal Onboarding Modal */}
      {modalState.showOnboarding && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <UniversalOnboarding
            isOpen={modalState.showOnboarding}
            onClose={() => {
              setModalState((prev) => ({ ...prev, showOnboarding: false }));
              // Refresh auth state after onboarding
              queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
            }}
            profession={currentUser?.userType ||'photographer'}
          />
        </React.Suspense>
      )}

      {/* GDPR Cookie Consent Banner */}
      <GdprNotice position="bottom" />

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          background: `rgba(31,41,55,0.95)`,
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(255,140,0,0.2)",
          color: "white",
          py: 6,
          mt: 8,
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
                    width: "250px",
                    height: "200px",
                    filter: "brightness(1.2)",
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2, lineHeight: 1.6 }}>
                Profesjonell prosjektadministrasjon og kreative verktøy for norske fotografer, videografer og musikkprodusenter.
              </Typography>
              <Stack direction="row" spacing={1}>
                <IconButton
                  size="small"
                  sx={{
                    color: "#ff8c00","&:hover": { backgroundColor: "rgba(255,140,0,0.1)" },
                  }}
                  aria-label="Facebook"
                >
                  <Info fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  sx={{
                    color: "#ff8c00","&:hover": { backgroundColor: "rgba(255,140,0,0.1)" },
                  }}
                  aria-label="LinkedIn"
                >
                  <Business fontSize="small" />
                </IconButton>
              </Stack>
            </Grid>

            {/* Quick Links */}
            <Grid item xs={12} md={2}>
              <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2, color: "#ff8c00" }}>
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
            </Grid>

            {/* Professions */}
            <Grid item xs={12} md={3}>
              <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2, color: "#ff8c00" }}>
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
            </Grid>

            {/* Contact & Legal */}
            <Grid item xs={12} md={3}>
              <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2, color: "#ff8c00" }}>
                Kontakt
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
                  <Email fontSize="small" sx={{ mr: 1, color: "#ff8c00" }} />
                  <Typography variant="body2">daniel@creatorhubn.com</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
                  <Phone fontSize="small" sx={{ mr: 1, color: "#ff8c00" }} />
                  <Typography variant="body2">+47 97 95 92 94</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
                  <LocationOn fontSize="small" sx={{ mr: 1, color: "#ff8c00" }} />
                  <Typography variant="body2">Norge</Typography>
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
            </Grid>
          </Grid>

          {/* Bottom Bar */}
          <Divider sx={{ my: 4, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              © {new Date().getFullYear()} CreatorHub Norge. Alle rettigheter reservert.
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="text"
                size="small"
                onClick={() => handleNavigation("/privacy-policy")}
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "none",
                  fontSize: "12px","&:hover": {
                    color: "#ff8c00",
                  },
                }}
              >
                Personvernerklæring
              </Button>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.3)" }}>
                •
              </Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => handleNavigation("/terms-and-conditions")}
                sx={{
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "none",
                  fontSize: "12px","&:hover": {
                    color: "#ff8c00",
                  },
                }}
              >
                Vilkår & Betingelser
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Google Workspace Information Dialog */}
      <Dialog
        open={googleWorkspaceDialogOpen}
        onClose={() => setGoogleWorkspaceDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          "& .MuiDialog-paper": {
            borderRadius: "16px",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.2)",
        },
      }}
      >
        <DialogTitle
          sx={{
            pb:  1,
            background: "linear-gradient(135deg, #4285F4 0%, #34A853 100%)",
            color: "white",
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
        }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {/* Google Logo */}
            <Box
              sx={{
                width:  40,
                height:  40,
                borderRadius: "8px",
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mr:  2,
            }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                xmlns="http: //www.w3.org/2000/svg"
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
              <Typography variant="h5" sx={{ fontWeight: "bold", mb: 0.5 }}>
                Hvorfor Google Workspace?
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9}}>
                CreatorHub Norge's strategiske valg
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p:  4 }}>
          <Stack spacing={3}>
            <Typography
              variant="body1"
              sx={{ color: "#374151", lineHeight: 1.6}}
            >
              CreatorHub Norge har valgt Google Workspace som vår primære
              forretningsplattform fordi den gir norske kreative fagfolk den
              mest sømløse, sikre og produktive arbeidsflyten.
            </Typography>

            <Box>
              <Box sx={{ display: "flex", alignItems: "center", mb:  2 }}>
                <Security sx={{ color: "#34A853", fontSize:  24, mr: 1.5}} />
                <Typography variant="h6"
                  sx={{ fontWeight: "bold", color: "#1f2937,",}}
      >
                  Sikkerhet og Pålitelighet
                </Typography>
              </Box>
              <List>
                {[
                  "Enterprise-grade sikkerhet med 99.9% oppetid","Automatisk kryptering av alle filer og kommunikasjon","GDPR-kompatibel databehandling for norske brukere",
                ].map((item, index) => (
                  <ListItem key={index} sx={{ py: 0.5,px:  0 }}>
                    <ListItemIcon>
                      <CheckCircle sx={{ color: "#34A853", fontSize: 20}} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item}
                      primaryTypographyProps={{
                        fontSize: "0.9rem",
                        color: "#374151",
                    }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box>
              <Box sx={{ display: "flex", alignItems: "center", mb:  2 }}>
                <RocketLaunch
                  sx={{ color: "#4285F4", fontSize:  24, mr: 1.5}}
                />
                <Typography variant="h6"
                  sx={{ fontWeight: "bold", color: "#1f2937,",}}
      >
                  Teknisk Integrasjon
                </Typography>
              </Box>
              <List>
                {[
                  "Gmail API: Automatisert e-postkommunikasjon","Google Drive API: Sømløs filsynkronisering","Calendar API: Integrert bookingsystem","Docs & Sheets API: Automatisk rapportgenerering",
                ].map((item, index) => (
                  <ListItem key={index} sx={{ py: 0.5,px:  0 }}>
                    <ListItemIcon>
                      <CheckCircle sx={{ color: "#4285F4", fontSize: 20}} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item}
                      primaryTypographyProps={{
                        fontSize: "0.9rem",
                        color: "#374151",
                    }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box>
              <Box sx={{ display: "flex", alignItems: "center", mb:  2 }}>
                <Adjust sx={{ color: "#FF6F00", fontSize:  24, mr: 1.5}} />
                <Typography variant="h6"
                  sx={{ fontWeight: "bold", color: "#1f2937,",}}
      >
                  Fordeler for Kreative Fagfolk
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: "center", p:  2 }}>
                    <PhotoCamera
                      sx={{ color: "#2e7d32", fontSize:  32, mb:  1 }}
                    />
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: "bold", color: "#1f2937,",}}
                    >
                      {getProfessionDisplayName('photographer')}er
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>
                      Automatisk backup og deling av gallerier
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: "center", p:  2 }}>
                    <VideoLibrary
                      sx={{ color: "#1565c0", fontSize:  32, mb:  1 }}
                    />
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: "bold", color: "#1f2937",}}
                    >
                      Videografer
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>
                      Høyhastighets filoverføring og samarbeid
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: "center", p:  2 }}>
                    <LibraryMusic
                      sx={{ color: "#7b1fa2", fontSize:  32, mb:  1 }}
                    />
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: "bold", color: "#1f2937",}}
                    >
                      Musikprodusenter
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#6b7280" }}>
                      Sikker lagring og distribusjon
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Box
              sx={{
                background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
                borderRadius: "12px",
                p:  3,
                textAlign: "center",
            }}
            >
              <Typography variant="body2" sx={{ color: "#374151", mb:  2 }}>
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
                  borderColor: "#4285F4",
                  color: "#4285F4",
                  fontSize: "12px",
                  textTransform: "none","&:hover": {
                    borderColor: "#3367D6",
                    backgroundColor: "rgba(6,133,244,0.1)",
                },
              }}
              >
                Les mer på Google's offisielle side
              </Button>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p:  3, pt:  0 }}>
          <Button
            onClick={() => setGoogleWorkspaceDialogOpen(false)}
            variant="contained"
            sx={{
              background: "linear-gradient(135deg, #4285F4 0%, #34A853 100%)",
              color: "white",
              fontWeight: "bold", "&:hover": {
                background: "linear-gradient(135deg, #3367D6 0%, #2e7d32 100%)",
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
export default withVisualEditor(LandingDesktop, {
  componentId: 'landing-desktop',
  componentName: 'Landing Desktop',
  category: 'landing',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});
