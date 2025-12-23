/**
 * CreatorHub Academy Landing Page
 * WCAG 2.2-compliant landing page with CreatorHub theming integration
 */

import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  Stack,
  IconButton,
  useTheme,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import { Virtuoso } from 'react-virtuoso';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { bounceVariants, hoverLift } from '@/utils/animation-variants';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { CourseCardSkeleton } from '@/components/common/SkeletonLoaders';
import {
  PlayArrow,
  Quiz,
  Edit,
  ViewModule,
  Analytics,
  Security,
  CheckCircle,
  ArrowForward,
  Star,
  School,
  VideoLibrary,
  Assignment,
  Assessment,
  LibraryBooks,
  Groups,
  Message,
  Settings,
  TrendingUp,
  People,
  Schedule,
} from '@mui/icons-material';
import { InstructorIcon, StudentIcon } from '@/components/shared/CreatorHubIcons';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import { usePageCustomizations } from '@/hooks/usePageCustomizations';
import { useTheming } from '../../utils/theming-helper';
import { useAcademy } from '../../contexts/AcademyContext';
import { useDemoMode, useDemoModeData } from '../../contexts/DemoModeContext';
import LoginModal from '@/components/auth/LoginModal';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import AcademyLogo3D from './AcademyLogo3D';

// Real data interfaces
interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface Step {
  title: string;
  description: string;
}

interface Course {
  id: string;
  title: string;
  summary: string;
  lessons: number;
  duration: string;
  instructor: string;
  rating: number;
}

interface PricingPlan {
  name: string;
  price: string;
  popular: boolean;
  features: string[];
}

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  avatar: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface Stat {
  label: string;
  value: string;
}

// Memoized Course Card Component with Framer Motion
const CourseCard = memo(({
  course,
  onClick
}: {
  course: Course;
  onClick: (course: Course) => void;
}) => (
  <m.div
    variants={bounceVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    whileHover={hoverLift}
  >
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.3s ease'}}
      onClick={() => onClick(course)}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {course.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {course.summary}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
          <Chip label={`${course.lessons} lessons`} size="small" />
          <Chip label={course.duration} size="small" />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar sx={{ width: 24, height: 24 }}>
            {course.instructor.charAt(0)}
          </Avatar>
          <Typography variant="caption">{course.instructor}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="body2" color="primary">
            ★ {course.rating}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  </m.div>
));

CourseCard.displayName = 'CourseCard';

function AcademyLandingPage() {
  const _theme = useTheme();
  const theming = useTheming('music_producer');
  const [, setLocation] = useLocation();
  const { analytics, performance, debugging } = useEnhancedMasterIntegration();
  const { state } = useAcademy();
  const { isDemoMode } = useDemoMode();

  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [loading] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Fetch real Academy stats from API
  const { data: academyStats } = useQuery({
    queryKey: ['/api/academy/admin/revenue/overview'],
    queryFn: () => apiRequest('/api/academy/admin/revenue/overview'),
    staleTime: Infinity, // Cache indefinitely
    gcTime: Infinity, // Never garbage collect
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Real data from Academy context
  const realCourses: Course[] = useDemoModeData(
    'courses',
    state.courses.map((course) => ({
      id: course.id,
      title: course.title,
      summary: course.description || 'No description available',
      lessons: course.lessons?.length || 0,
      duration:
        typeof course.duration === 'number'
          ? `${course.duration} min`
          : course.duration || 'Unknown',
      instructor:
        typeof course.instructor === 'object'
          ? course.instructor.name
          : course.instructor || 'CreatorHub Team',
      rating: course.rating || 4.5,
    })),
  );

  // Real Academy stats - only show if thresholds are met
  const totalInstructors = academyStats?.totalInstructors || 0;
  const totalStudents = academyStats?.totalStudents || 0;
  const showInstructorStats = totalInstructors >= 150;
  const showStudentStats = totalStudents >= 300;

  const _realStats: Stat[] = useDemoModeData('stats', [
    { label: 'Learners', value: `${state.enrollments.length}+` },
    { label: 'Lessons Watched', value: `${state.progress.length}+` },
    {
      label: 'Avg. Completion',
      value: `${Math.round(state.progress.reduce((acc, p) => acc + (p.progress || 0), 0) / state.progress.length || 0)}%`,
    },
  ]);

  // Fetch dynamic pricing from API
  const { data: pricingData } = useQuery({
    queryKey: ['/api/academy/pricing'],
    queryFn: () => apiRequest('/api/academy/pricing'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch dynamic testimonials from API
  const { data: testimonialsData } = useQuery({
    queryKey: ['/api/academy/testimonials'],
    queryFn: () => apiRequest('/api/academy/testimonials'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch dynamic FAQ from API
  const { data: faqData } = useQuery({
    queryKey: ['/api/academy/faq'],
    queryFn: () => apiRequest('/api/academy/faq'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch trusted companies (companies with logos that have accessed academy)
  const { data: trustedCompaniesData } = useQuery({
    queryKey: ['/api/academy/trusted-companies'],
    queryFn: () => apiRequest('/api/academy/trusted-companies'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch dynamic community stats
  const { data: communityStatsData } = useQuery({
    queryKey: ['/api/academy/community-stats'],
    queryFn: () => apiRequest('/api/academy/community-stats'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch featured courses dynamically
  const { data: featuredCoursesData } = useQuery({
    queryKey: ['/api/academy/featured-courses'],
    queryFn: () => apiRequest('/api/academy/featured-courses'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch video preview data dynamically
  const { data: videoPreviewData } = useQuery({
    queryKey: ['/api/academy/video-preview'],
    queryFn: () => apiRequest('/api/academy/video-preview'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Real features based on actual capabilities (Norwegian)
  const realFeatures: Feature[] = useDemoModeData('features', [
    {
      title: 'Profesjonell Videospiller',
      description:
        'Kapitler, undertekster, transkripsjoner, hurtigtaster og avspillingskontroller.',
      icon: <PlayArrow />,
      color: 'primary',
    },
    {
      title: 'Interaktive Quizer',
      description: 'Spørsmål i video med karakterretur og elementanalyse for å måle læring.',
      icon: <Quiz />,
      color: 'secondary',
    },
    {
      title: 'Annotasjonsredigering',
      description:
        'Tidsstemplede notater, tegning og gjennomgangsarbeidsflyter for samarbeidende undervisning.',
      icon: <Edit />,
      color: 'success',
    },
    {
      title: 'Moduladministrator',
      description:
        'Opprett moduler/leksjoner, planlegg utgivelser, sett forutsetninger og lokaliser innhold.',
      icon: <ViewModule />,
      color: 'warning',
    },
    {
      title: 'Analyser Som Betyr Noe',
      description: 'Frafalls-varmekart, fullføringsrater, kohortsammenligninger og kvalitetsmålinger.',
      icon: <Analytics />,
      color: 'info',
    },
    {
      title: 'Personvern & Sikkerhet',
      description: 'SSO, rollebasert tilgang, signerte URL-er/DRM, revisjonslogger og GDPR-kontroller.',
      icon: <Security />,
      color: 'error',
    },
  ]);

  const realSteps: Step[] = useDemoModeData('steps', [
    {
      title: 'Lag Kurset Ditt',
      description: 'Last opp videoer, legg til kapitler/undertekster og sett læringsmål.',
    },
    {
      title: 'Publiser & Meld På',
      description: 'Åpne for kohorter med tidsplaner og forutsetninger.',
    },
    {
      title: 'Mål & Forbedre',
      description: 'Spor resultater, finn frafall og iterer innhold.',
    },
  ]);

  // Dynamic pricing from API with fallback
  const realPricing: PricingPlan[] = pricingData?.plans || [];

  // Dynamic testimonials from API
  const realTestimonials: Testimonial[] = testimonialsData?.testimonials || [];

  // Dynamic FAQ from API with fallback
  const realFAQ: FAQItem[] = faqData?.items || [
    {
      question: 'Støtter dere undertekster og transkripsjoner?',
      answer:
        'Ja. Last opp VTT eller auto-generer, gjennomgå og publiser. Transkripsjoner er klikkbare for å søke.',
    },
    {
      question: 'Kan jeg importere eksisterende kurs?',
      answer:
        'Du kan masseimportere via CSV eller SCORM/xAPI-metadata, og koble til videoer fra skylagring.',
    },
    {
      question: 'Hvordan kommer jeg i gang?',
      answer:
        'Registrer deg, opprett ditt første kurs og last opp innhold. Vi guider deg gjennom hele prosessen.',
    },
    {
      question: 'Kan jeg koble til mitt LMS?',
      answer: 'Ja. LTI 1.3 og xAPI/webhooks lar deg starte leksjoner og returnere karakterer.',
    },
  ];

  // Dynamic trusted companies from API (companies with logos that have accessed academy)
  interface TrustedCompany {
    name: string;
    logo?: string;
  }
  const realTrustedBy: TrustedCompany[] = trustedCompaniesData?.companies || [];
  
  // Dynamic community stats from API
  const dynamicCommunityStats = communityStatsData?.stats || null;
  
  // Dynamic featured courses from API
  const dynamicFeaturedCourses: Course[] = featuredCoursesData?.courses || realCourses;

  // Component registration and analytics - runs only once on mount
  useEffect(() => {
    const endTiming = performance.startTiming('academy_landing_page_render');

    analytics.trackEvent('academy_landing_page_viewed', {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      referrer: document.referrer,
    });

    debugging.logIntegration('info', 'AcademyLandingPage mounted', {});

    return () => {
      endTiming();
    };
  }, [analytics, debugging, performance]); // Include stable dependencies
  
  // Memoized quick stats for the hero section
  const quickStats = useMemo(() => [
    { icon: <VideoLibrary color="primary" />, label: 'Video Lessons', count: state.courses.reduce((acc, c) => acc + (c.lessons?.length || 0), 0) },
    { icon: <Assignment color="secondary" />, label: 'Assignments', count: state.progress.length },
    { icon: <Assessment color="success" />, label: 'Assessments', count: Math.floor(state.progress.length * 0.7) },
    { icon: <LibraryBooks color="warning" />, label: 'Resources', count: state.courses.length * 5 },
  ], [state.courses, state.progress]);
  
  // Memoized community stats
  const communityStats = useMemo(() => ({
    groups: Math.floor(totalStudents / 50),
    messages: Math.floor(totalStudents * 3.5),
    instructors: totalInstructors,
    students: totalStudents,
    schedules: state.courses.length * 2,
  }), [totalStudents, totalInstructors, state.courses.length]);
  
  // Callback for handling navigation with tracking - supports both routes and sections
  const handleNavigation = useCallback((target: string) => {
    analytics.trackEvent('navigation_clicked', { target, timestamp: Date.now() });
    
    // If it's a route (starts with /), navigate to that page
    if (target.startsWith('/')) {
      setLocation(target);
    } else {
      // Otherwise, scroll to the section
      const element = document.getElementById(target);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [analytics, setLocation]);

  const handleGetStarted = () => {
    analytics.trackEvent('get_started_clicked', {
      location: 'hero_section',
      timestamp: Date.now(),
    });
    setLoginModalOpen(true);
  };

  const handleSignIn = () => {
    analytics.trackEvent('sign_in_clicked', {
      location: 'header',
      timestamp: Date.now(),
    });
    setLoginModalOpen(true);
  };

  const handleFeatureClick = (feature: string) => {
    analytics.trackEvent('feature_clicked', {
      feature,
      timestamp: Date.now(),
    });
  };

  const handleCourseClick = (courseId: string) => {
    analytics.trackEvent('course_clicked', {
      courseId,
      timestamp: Date.now(),
    });
  };

  const handlePricingClick = (plan: string) => {
    analytics.trackEvent('pricing_plan_clicked', {
      plan,
      timestamp: Date.now(),
    });
  };

  // Show loading state with skeleton placeholders
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          p: 4,
        }}
      >
        <Stack spacing={3} alignItems="center" sx={{ width: '100%', maxWidth: 600 }}>
          <CircularProgress size={60} sx={{ color: theming.colors.primary }} />
          <Typography variant="h6" color="text.secondary">
            Loading Academy Data...
          </Typography>
          
          {/* Skeleton placeholders using the Skeleton component */}
          <Stack spacing={2} sx={{ width: '100%' }}>
            <Skeleton variant="rectangular" width="100%" height={120} sx={{ borderRadius: 2 }} />
            <Stack direction="row" spacing={2}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            </Stack>
            <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 2 }} />
          </Stack>
          
          {/* Quick stats preview during loading */}
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Chip icon={<Star />} label="Top Rated" size="small" />
            <Chip icon={<TrendingUp />} label="Trending" size="small" />
            <Chip icon={<Schedule />} label="New" size="small" />
          </Stack>
        </Stack>
      </Box>
    );
  }
  
  // Render community stats section - uses dynamic data from API
  const stats = dynamicCommunityStats || communityStats;
  const renderCommunityStats = () => (
    <Box sx={{ 
      py: 4, 
      px: 2, 
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,140,0,0.1)',
      borderRadius: '20px', 
      my: 4,
    }}>
      <Typography 
        variant="h5" 
        align="center" 
        gutterBottom 
        sx={{ 
          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Bli med i vårt voksende fellesskap
      </Typography>
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Stack alignItems="center" spacing={1}>
            <Avatar sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', width: 56, height: 56 }}>
              <Groups />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#fff' }}>{stats.groups}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Studiegrupper</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Stack alignItems="center" spacing={1}>
            <Avatar sx={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', width: 56, height: 56 }}>
              <Message />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#fff' }}>{stats.messages}+</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Meldinger</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Stack alignItems="center" spacing={1}>
            <Avatar sx={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', width: 56, height: 56 }}>
              <People />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#fff' }}>{showStudentStats ? stats.students : (stats.students || '300+')}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Studenter</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Stack alignItems="center" spacing={1}>
            <Avatar sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', width: 56, height: 56 }}>
              <School />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#fff' }}>{showInstructorStats ? stats.instructors : (stats.instructors || '150+')}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Instruktører</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Stack alignItems="center" spacing={1}>
            <Avatar sx={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', width: 56, height: 56 }}>
              <Schedule />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#fff' }}>{stats.schedules}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Live økter</Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Stack alignItems="center" spacing={1}>
            <Avatar sx={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', width: 56, height: 56 }}>
              <Settings />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#fff' }}>24/7</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Support</Typography>
          </Stack>
        </Grid>
      </Grid>
      
      {/* Quick navigation using handleNavigation callback */}
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }}>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => handleNavigation('courses')}
          sx={{
            borderColor: 'rgba(255,255,255,0.3)',
            color: '#fff',
            textTransform: 'none',
            '&:hover': {
              borderColor: '#f59e0b',
              background: 'rgba(245,158,11,0.1)',
            },
          }}
        >
          Se kurs
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => handleNavigation('features')}
          sx={{
            borderColor: 'rgba(255,255,255,0.3)',
            color: '#fff',
            textTransform: 'none',
            '&:hover': {
              borderColor: '#f59e0b',
              background: 'rgba(245,158,11,0.1)',
            },
          }}
        >
          Utforsk funksjoner
        </Button>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={() => handleNavigation('testimonials')}
          sx={{
            borderColor: 'rgba(255,255,255,0.3)',
            color: '#fff',
            textTransform: 'none',
            '&:hover': {
              borderColor: '#f59e0b',
              background: 'rgba(245,158,11,0.1)',
            },
          }}
        >
          Les anmeldelser
        </Button>
      </Stack>
      
      {/* Quick stats display */}
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
        {quickStats.map((stat, index) => (
          <Chip 
            key={index}
            icon={stat.icon as React.ReactElement}
            label={`${stat.count} ${stat.label}`}
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              '& .MuiChip-icon': { color: 'rgba(255,255,255,0.7)' },
            }}
          />
        ))}
      </Stack>
    </Box>
  );

  return (
    <ErrorBoundary showDetails={true}>
      <LazyMotion features={domAnimation} strict>
        <Box sx={{ 
          minHeight: '100vh', 
          background: '#0f0f1a',
          position: 'relative',
          overflow: 'hidden',
        }}>
      
      {/* Grid background pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 140, 0, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 140, 0, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      {/* Gradient orbs */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          right: '10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />
      
      {/* Skip Link */}
      <Box
        component="a"
        href="#main"
        sx={{
          position: 'absolute',
          top: -40,
          left: 6,
          zIndex: 100,
          bgcolor: '#1a1a2e',
          color: '#fff',
          px: 2,
          py: 1,
          borderRadius: 1,
          textDecoration: 'none',
          '&:focus': {
            top: 6,
            outline: '2px solid #f59e0b',
            outlineOffset: 2,
          },
        }}
      >
        Skip to content
      </Box>

      {/* Demo Mode Indicator */}
      {isDemoMode && (
        <Box
          sx={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            color: '#fff',
            p: 1,
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          🎯 Demo Mode - Showing sample data
        </Box>
      )}

      {/* Header */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(15, 15, 26, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 140, 0, 0.1)',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <AcademyLogo3D width={280} height={140} />
                <Typography 
                  variant="h4" 
                  sx={{ 
                    mt: 1,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 700,
                    letterSpacing: '-0.5px',
                  }}
                >
                  ACADEMY
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.7rem',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  }}
                >
                  Et produkt av CreatorHub Norge
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
              {/* Site Navigation */}
              <Button 
                onClick={() => handleNavigation('/')}
                sx={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b', background: 'rgba(245,158,11,0.1)' },
                }}
              >
                Hjem
              </Button>
              <Button 
                onClick={() => handleNavigation('/community')}
                sx={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b', background: 'rgba(245,158,11,0.1)' },
                }}
              >
                Community
              </Button>
              
              {/* Page Navigation */}
              <Box sx={{ mx: 1, height: 20, borderLeft: '1px solid rgba(255,255,255,0.2)' }} />
              <Button 
                href="#features"
                sx={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b', background: 'rgba(245,158,11,0.1)' },
                }}
              >
                Funksjoner
              </Button>
              <Button 
                href="#courses"
                sx={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b', background: 'rgba(245,158,11,0.1)' },
                }}
              >
                Kurs
              </Button>
              <Button 
                href="#faq"
                sx={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b', background: 'rgba(245,158,11,0.1)' },
                }}
              >
                Spørsmål
              </Button>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleSignIn}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#f59e0b',
                    background: 'rgba(245,158,11,0.1)',
                  },
                }}
              >
                Logg inn
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleGetStarted}
                sx={{ 
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)',
                  },
                }}
              >
                Kom i gang
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box component="main" id="main" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Hero Section */}
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            py: 8,
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={6} alignItems="center">
              <Grid item xs={12} lg={6}>
                <Chip
                  icon={<CheckCircle sx={{ color: '#10b981' }} />}
                  label="Norges ledende læringsplattform"
                  sx={{ 
                    mb: 3, 
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 600,
                  }}
                />

                <Typography
                  variant="h1"
                  fontWeight="bold"
                  sx={{
                    fontSize: { xs: '2.5rem', md: '3.5rem' },
                    lineHeight: 1.2,
                    mb: 3,
                    color: '#fff',
                  }}
                >
                  CreatorHub Akademiet – Del kunnskapen din med{' '}
                  <Box 
                    component="span" 
                    sx={{ 
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    engasjerende
                  </Box>{' '}
                  videokurs
                </Typography>

                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 4, 
                    maxWidth: '600px',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 400,
                    lineHeight: 1.6,
                  }}
                >
                  Lag profesjonelle kurs med video, quizer og notater. 
                  Følg med på hvordan elevene dine lærer—alt på én plass.
                </Typography>

                <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleGetStarted}
                    sx={{ 
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      color: '#fff',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 4,
                      py: 1.5,
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    Kom i gang
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="large" 
                    href="#features"
                    sx={{
                      borderColor: 'rgba(255,255,255,0.3)',
                      color: '#fff',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 4,
                      py: 1.5,
                      borderRadius: '12px',
                      '&:hover': {
                        borderColor: '#f59e0b',
                        background: 'rgba(245,158,11,0.1)',
                      },
                    }}
                  >
                    Se funksjoner
                  </Button>
                </Stack>

                {/* Trusted Companies - Only show when companies exist */}
                {realTrustedBy.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Brukt av team hos
                  </Typography>
                  {realTrustedBy.map((company, index) => (
                    company.logo ? (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          px: 2,
                          py: 0.5,
                        }}
                      >
                        <img
                          src={company.logo}
                          alt={company.name}
                          style={{
                            height: 24,
                            width: 'auto',
                            objectFit: 'contain',
                            filter: 'brightness(0) invert(1)',
                            opacity: 0.8,
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          {company.name}
                        </Typography>
                      </Box>
                    ) : (
                      <Chip
                        key={index}
                        label={company.name}
                        size="small"
                        variant="outlined"
                        sx={{ 
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: 'rgba(255,255,255,0.7)',
                          background: 'rgba(255,255,255,0.05)',
                        }}
                      />
                    )
                  ))}
                </Box>
                )}
              </Grid>

              {/* 3D Interactive Logo */}
              <Grid item xs={12} lg={6}>
                <Box
                  sx={{
                    borderRadius: '20px',
                    overflow: 'hidden',
                    background: 'rgba(15,15,26,0.8)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,140,0,0.15)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  }}
                >
                  <AcademyLogo3D width={560} height={400} />
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Features Section */}
        <Box id="features" sx={{ py: 6 }}>
          <Container maxWidth="lg">
            <Box sx={{ maxWidth: '600px', mb: 6 }}>
              <Typography 
                variant="h2" 
                fontWeight="bold" 
                gutterBottom
                sx={{ color: '#fff', fontSize: { xs: '1.75rem', md: '2.5rem' } }}
              >
                Alt du trenger for å drive et akademi
              </Typography>
              <Typography 
                variant="h6" 
                sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}
              >
                Bygget på en moderne spiller med transkripsjoner, notater, kapitler, quizer—og en 
                profesjonell moduladministrator.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {realFeatures.map((feature, index) => (
                <Grid item xs={12} sm={6} lg={4} key={index}>
                  <Card
                    sx={{
                      height: '100%',
                      p: 3,
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,140,0,0.1)',
                      borderRadius: '16px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 20px 60px rgba(245,158,11,0.15)',
                        border: '1px solid rgba(255,140,0,0.3)',
                      },
                    }}
                    onClick={() => handleFeatureClick(feature.title)}
                  >
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: '14px',
                          background: `linear-gradient(135deg, ${feature.color === 'primary' ? '#f59e0b' : feature.color === 'secondary' ? '#a855f7' : feature.color === 'success' ? '#10b981' : feature.color === 'warning' ? '#f59e0b' : feature.color === 'info' ? '#3b82f6' : '#ef4444'} 0%, ${feature.color === 'primary' ? '#ea580c' : feature.color === 'secondary' ? '#7c3aed' : feature.color === 'success' ? '#059669' : feature.color === 'warning' ? '#d97706' : feature.color === 'info' ? '#2563eb' : '#dc2626'} 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography 
                          variant="h6" 
                          fontWeight="semibold"
                          sx={{ color: '#fff' }}
                        >
                          {feature.title}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography 
                      variant="body2" 
                      sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}
                    >
                      {feature.description}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* How It Works Section */}
        <Box sx={{ py: 6 }}>
          <Container maxWidth="lg">
            <Typography 
              variant="h2" 
              fontWeight="bold" 
              gutterBottom
              sx={{ color: '#fff', fontSize: { xs: '1.75rem', md: '2.5rem' } }}
            >
              Slik fungerer det
            </Typography>

            <Grid container spacing={4} sx={{ mt: 4 }}>
              {realSteps.map((step, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <Card 
                    sx={{ 
                      p: 4, 
                      height: '100%', 
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,140,0,0.1)',
                      borderRadius: '16px',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography variant="h6" fontWeight="semibold" sx={{ color: '#fff' }}>
                        {step.title}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {step.description}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Courses Section - Only show when courses exist */}
        {dynamicFeaturedCourses.length > 0 && (
        <Box id="courses" sx={{ py: 6 }}>
          <Container maxWidth="lg">
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 6 }}
            >
              <Box>
                <Typography variant="h2" fontWeight="bold" gutterBottom sx={{ color: '#fff', fontSize: { xs: '1.75rem', md: '2.5rem' } }}>
                  Utvalgte kurs
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
                  Video-først leksjoner med transkripsjoner og quizer.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                endIcon={<ArrowForward />}
                sx={{ 
                  display: { xs: 'none', sm: 'flex' },
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#f59e0b',
                    background: 'rgba(245,158,11,0.1)',
                  },
                }}
              >
                Se alle
              </Button>
            </Box>

            <Box sx={{ height: 600 }}>
              {loading ? (
                <Grid container spacing={3}>
                  {[...Array(6)].map((_, i) => (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                      <CourseCardSkeleton />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <AnimatePresence>
                  <Virtuoso
                    style={{ height: '100%' }}
                    data={dynamicFeaturedCourses}
                    itemContent={(index, course) => (
                      <Box sx={{ p: 2 }} key={course.id}>
                        <CourseCard
                          course={course}
                          onClick={() => handleCourseClick(course.id)}
                        />
                      </Box>
                    )}
                  />
                </AnimatePresence>
              )}
            </Box>
          </Container>
        </Box>
        )}

        {/* Stats Section */}
        {(showInstructorStats || showStudentStats || !isDemoMode) && (
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <Grid container spacing={4} justifyContent="center">
                {/* Instructor Stats - Only show if >= 150 */}
                {(showInstructorStats || isDemoMode) && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{
                        p: 4,
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.03)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,140,0,0.1)',
                        borderRadius: '20px',
                        transition: 'all 0.3s',
                        '&:hover': {
                          transform: 'translateY(-8px)',
                          boxShadow: '0 20px 60px rgba(245,158,11,0.15)',
                          border: '1px solid rgba(255,140,0,0.3)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          background: 'rgba(245,158,11,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mx: 'auto',
                          mb: 3,
                        }}
                      >
                        <InstructorIcon sx={{ fontSize: 40, color: '#f59e0b' }} />
                      </Box>
                      <Typography
                        variant="h3"
                        fontWeight="bold"
                        sx={{ 
                          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          mb: 1,
                        }}
                      >
                        {isDemoMode ? '150+' : `${totalInstructors}+`}
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 500 }}>
                        Aktive Instruktører
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
                        Eksperter som deler sin kunnskap
                      </Typography>
                    </Card>
                  </Grid>
                )}

                {/* Student Stats - Only show if >= 300 */}
                {(showStudentStats || isDemoMode) && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{
                        p: 4,
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.03)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(59,130,246,0.1)',
                        borderRadius: '20px',
                        transition: 'all 0.3s',
                        '&:hover': {
                          transform: 'translateY(-8px)',
                          boxShadow: '0 20px 60px rgba(59,130,246,0.15)',
                          border: '1px solid rgba(59,130,246,0.3)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          background: 'rgba(59,130,246,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mx: 'auto',
                          mb: 3,
                        }}
                      >
                        <StudentIcon sx={{ fontSize: 40, color: '#3b82f6' }} />
                      </Box>
                      <Typography variant="h3" fontWeight="bold" sx={{ color: '#3b82f6', mb: 1 }}>
                        {isDemoMode ? '300+' : `${totalStudents}+`}
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 500 }}>
                        Fornøyde Studenter
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
                        Lærer nye ferdigheter hver dag
                      </Typography>
                    </Card>
                  </Grid>
                )}

                {/* Course Stats - Only show when courses exist */}
                {dynamicFeaturedCourses.length > 0 && (
                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(16,185,129,0.1)',
                      borderRadius: '20px',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 20px 60px rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'rgba(16,185,129,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                      }}
                    >
                      <School sx={{ fontSize: 40, color: '#10b981' }} />
                    </Box>
                    <Typography variant="h3" fontWeight="bold" sx={{ color: '#10b981', mb: 1 }}>
                      {academyStats?.activeCourses || dynamicFeaturedCourses.length}+
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 500 }}>
                      Kurs tilgjengelig
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
                      Lær fra de beste
                    </Typography>
                  </Card>
                </Grid>
                )}
              </Grid>
            </Container>
          </Box>
        )}

        {/* Pricing Section - Only show if pricing data is available */}
        {realPricing.length > 0 && (
        <Box id="pricing" sx={{ py: 6 }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography variant="h2" fontWeight="bold" gutterBottom sx={{ color: '#fff', fontSize: { xs: '1.75rem', md: '2.5rem' } }}>
                Våre priser
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
                Velg pakken som passer for deg
              </Typography>
            </Box>

            <Grid container spacing={4}>
              {realPricing.map((plan, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <Card
                    sx={{
                      height: '100%',
                      position: 'relative',
                      p: 4,
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(20px)',
                      borderRadius: '20px',
                      border: plan.popular ? '2px solid #f59e0b' : '1px solid rgba(255,140,0,0.1)',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 20px 60px rgba(245,158,11,0.15)',
                      },
                    }}
                  >
                    {plan.popular && (
                      <Chip
                        label="Populær"
                        sx={{
                          position: 'absolute',
                          top: -12,
                          right: 16,
                          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      />
                    )}

                    <Typography 
                      variant="h6" 
                      fontWeight="semibold" 
                      gutterBottom
                      sx={{ color: '#fff' }}
                    >
                      {plan.name}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 3 }}>
                      <Typography
                        variant="h3"
                        fontWeight="bold"
                        sx={{ 
                          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {plan.price}
                      </Typography>
                      {plan.price !== 'Custom' && plan.price !== 'Tilpasset' && (
                        <Typography variant="body1" sx={{ ml: 1, color: 'rgba(255,255,255,0.5)' }}>
                          /mnd
                        </Typography>
                      )}
                    </Box>

                    <Stack spacing={2} sx={{ mb: 4 }}>
                      {plan.features.map((feature, featureIndex) => (
                        <Stack
                          key={featureIndex}
                          direction="row"
                          spacing={1}
                          alignItems="flex-start"
                        >
                          <CheckCircle sx={{ fontSize: 16, color: '#10b981', mt: 0.5 }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            {feature}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>

                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      onClick={() => handlePricingClick(plan.name)}
                      sx={{
                        background: plan.popular 
                          ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                          : 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': {
                          background: plan.popular 
                            ? 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)'
                            : 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      Velg {plan.name}
                    </Button>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
        )}

        {/* Testimonials Section - Only show if testimonials exist */}
        {realTestimonials.length > 0 && (
        <Box sx={{ py: 6 }}>
          <Container maxWidth="lg">
            <Typography 
              variant="h2" 
              fontWeight="bold" 
              gutterBottom 
              textAlign="center"
              sx={{ color: '#fff', fontSize: { xs: '1.75rem', md: '2.5rem' } }}
            >
              Hva våre brukere sier
            </Typography>

            <Grid container spacing={4} sx={{ mt: 4 }}>
              {realTestimonials.map((testimonial, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <Card 
                    sx={{ 
                      p: 4, 
                      height: '100%', 
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,140,0,0.1)',
                      borderRadius: '20px',
                    }}
                  >
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mb: 3, 
                        fontStyle: 'italic',
                        color: 'rgba(255,255,255,0.8)',
                        lineHeight: 1.6,
                      }}
                    >
                      "{testimonial.quote}"
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar 
                        src={testimonial.avatar}
                        sx={{ 
                          border: '2px solid rgba(245,158,11,0.3)',
                        }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight="semibold" sx={{ color: '#fff' }}>
                          {testimonial.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                          {testimonial.role}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
        )}

        {/* FAQ Section */}
        <Box id="faq" sx={{ py: 6 }}>
          <Container maxWidth="lg">
            <Typography 
              variant="h2" 
              fontWeight="bold" 
              gutterBottom
              sx={{ color: '#fff', mb: 4, fontSize: { xs: '1.75rem', md: '2.5rem' } }}
            >
              Ofte stilte spørsmål
            </Typography>

            <Grid container spacing={3}>
              {realFAQ.map((item, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      p: 3,
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,140,0,0.1)',
                      borderRadius: '16px',
                      transition: 'all 0.3s',
                      '&:hover': { 
                        border: '1px solid rgba(255,140,0,0.3)',
                        background: 'rgba(255,255,255,0.05)',
                      },
                    }}
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography 
                        variant="h6" 
                        fontWeight="semibold"
                        sx={{ color: '#fff', fontSize: '1rem' }}
                      >
                        {item.question}
                      </Typography>
                      <IconButton 
                        size="small"
                        sx={{ 
                          color: '#f59e0b',
                          background: 'rgba(245,158,11,0.1)',
                          '&:hover': { background: 'rgba(245,158,11,0.2)' },
                        }}
                      >
                        {expandedFAQ === index ? '-' : '+'}
                      </IconButton>
                    </Stack>
                    {expandedFAQ === index && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          mt: 2,
                          color: 'rgba(255,255,255,0.7)',
                          lineHeight: 1.6,
                        }}
                      >
                        {item.answer}
                      </Typography>
                    )}
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Final CTA Section */}
        <Box
          sx={{
            py: 6,
            textAlign: 'center',
            background: 'linear-gradient(180deg, transparent 0%, rgba(245,158,11,0.05) 100%)',
          }}
        >
          <Container maxWidth="md">
            <Typography 
              variant="h2" 
              fontWeight="bold" 
              gutterBottom
              sx={{ color: '#fff', fontSize: { xs: '1.75rem', md: '2.5rem' } }}
            >
              Klar til å lansere ditt akademi?
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                mb: 4,
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 400,
              }}
            >
              Publiser din første leksjon i dag.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleGetStarted}
                sx={{ 
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)',
                  },
                }}
              >
                Opprett konto
              </Button>
              <Button 
                variant="outlined" 
                size="large" 
                href="#features"
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  borderRadius: '12px',
                  '&:hover': {
                    borderColor: '#f59e0b',
                    background: 'rgba(245,158,11,0.1)',
                  },
                }}
              >
                Utforsk funksjoner
              </Button>
            </Stack>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Ved å fortsette godtar du våre vilkår og personvern.
            </Typography>
          </Container>
        </Box>
      </Box>

      {/* Community Stats Section - Only show when dynamic stats exist */}
      {dynamicCommunityStats && (
      <Container maxWidth="lg">
        {renderCommunityStats()}
      </Container>
      )}
      
      {/* Login Modal */}
      <LoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />

      {/* Footer */}
      <Box
        component="footer"
        sx={{ 
          background: 'rgba(15, 15, 26, 0.9)',
          borderTop: '1px solid rgba(255,140,0,0.1)',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} sx={{ py: 6 }}>
            <Grid item xs={12} sm={6} lg={3}>
              <Box sx={{ mb: 3 }}>
                <img
                  src="/creatorhub-logo-amber.svg"
                  alt="CreatorHub Academy"
                  style={{ height: 40 }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Video-først læringsplattform for kreative profesjonelle.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <Typography variant="h6" fontWeight="semibold" gutterBottom sx={{ color: '#fff' }}>
                Produkt
              </Typography>
              <Stack spacing={1}>
                <Button 
                  href="#features" 
                  size="small"
                  sx={{ 
                    color: 'rgba(255,255,255,0.6)', 
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Funksjoner
                </Button>
                <Button 
                  href="#pricing" 
                  size="small"
                  sx={{ 
                    color: 'rgba(255,255,255,0.6)', 
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Priser
                </Button>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <Typography variant="h6" fontWeight="semibold" gutterBottom sx={{ color: '#fff' }}>
                Navigasjon
              </Typography>
              <Stack spacing={1}>
                <Button 
                  onClick={() => handleNavigation('/')}
                  size="small"
                  sx={{ 
                    color: 'rgba(255,255,255,0.6)', 
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Hjem
                </Button>
                <Button 
                  onClick={() => handleNavigation('/community')}
                  size="small"
                  sx={{ 
                    color: 'rgba(255,255,255,0.6)', 
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Community
                </Button>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <Typography variant="h6" fontWeight="semibold" gutterBottom sx={{ color: '#fff' }}>
                Selskap
              </Typography>
              <Stack spacing={1}>
                <Button 
                  onClick={() => handleNavigation('/about-us')}
                  size="small"
                  sx={{ 
                    color: 'rgba(255,255,255,0.6)', 
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Om oss
                </Button>
                <Button 
                  size="small"
                  sx={{ 
                    color: 'rgba(255,255,255,0.6)', 
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Kontakt
                </Button>
                <Button 
                  size="small"
                  sx={{ 
                    color: 'rgba(255,255,255,0.6)', 
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    '&:hover': { color: '#f59e0b' },
                  }}
                >
                  Personvern
                </Button>
              </Stack>
            </Grid>
          </Grid>

          <Box sx={{ borderTop: '1px solid rgba(255,140,0,0.1)', py: 3 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              © {new Date().getFullYear()} CreatorHub Academy. Alle rettigheter reservert.
            </Typography>
          </Box>
        </Container>
      </Box>
        </Box>
      </LazyMotion>
    </ErrorBoundary>
  );
}

// Wrap with both Visual Editor and Universal Integration
const AcademyLandingPageWithVisualEditor = withVisualEditor(AcademyLandingPage, {
  componentId: 'academy-landing',
  componentName: 'Academy Landing Page',
  category: 'academy',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});

export default withUniversalIntegration(AcademyLandingPageWithVisualEditor, {
  componentId: 'academy-landing-page',
  componentName: 'Academy Landing Page',
  componentType: 'page',
  componentCategory: 'academy',
  featureIds: ['academy-dashboard', 'course-creation', 'course-analytics', 'video-player'],
});
