import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/components/language-provider';
import { withVisualEditor } from '@/components/admin/visual-editor/withVisualEditor';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Stack,
  IconButton,
} from '@mui/material';
import {
  PhotoCamera,
  VideoLibrary,
  LibraryMusic,
  Business,
  Email,
  LocationOn,
  Home,
  School,
  Group,
  ArrowForward,
  RocketLaunch as Rocket,
  Security,
  Speed as Speed,
  Support,
  EmojiEvents,
  LinkedIn,
  Instagram,
  CheckCircle,
  IntegrationInstructions,
  Language,
  Verified,
} from '@mui/icons-material';

// Custom hook for scroll-triggered reveal animations
const useScrollReveal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      { threshold: 0.05, rootMargin: '50px 0px 50px 0px' }
    );

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [hasAnimated]);

  return { ref: elementRef, isVisible };
};

// Animated section wrapper
interface AnimatedSectionProps {
  children: React.ReactNode;
  animation?: 'fadeInUp' | 'slideInLeft' | 'slideInRight' | 'scaleIn';
  delay?: number;
}

const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  animation = 'fadeInUp',
  delay = 0,
}) => {
  const { ref, isVisible } = useScrollReveal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const getAnimationStyles = () => {
    if (!mounted) return { opacity: 1, transform: 'none' };

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
      sx={{
        ...getAnimationStyles(),
        transition: mounted ? `all 0.7s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s` : 'none',
      }}
    >
      {children}
    </Box>
  );
};

// CreatorHub Logo Icon Component
const CreatorHubLogoIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} style={{ display: 'block' }}>
    <defs>
      <linearGradient id="aboutLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="18" fill="url(#aboutLogoGrad)" />
    <g transform="translate(8, 8)">
      <path d="M12 4 L12 18 L10 20 L8 18 L8 16 L6 16 L6 6 L8 4 Z" fill="white" opacity="0.95" />
      <polygon points="8,4 10,2 12,4" fill="rgba(255,255,255,0.7)" />
      <circle cx="18" cy="7" r="3" fill="white" opacity="0.9" />
      <rect x="17" y="6" width="2" height="2" rx="0.3" fill="url(#aboutLogoGrad)" />
      <line x1="12" y1="8" x2="15" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8" />
      <polygon points="5,7 2,5 2,9" fill="white" opacity="0.9" />
      <line x1="8" y1="8" x2="5" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8" />
      <circle cx="18" cy="17" r="2" fill="white" opacity="0.9" />
      <rect x="18" y="14" width="1" height="3" fill="white" opacity="0.9" />
      <line x1="12" y1="15" x2="16" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8" />
      <circle cx="5" cy="17" r="3" fill="white" opacity="0.9" />
      <circle cx="4" cy="16" r="0.8" fill="url(#aboutLogoGrad)" />
      <circle cx="6" cy="16" r="0.8" fill="#f59e0b" />
      <circle cx="5" cy="18" r="0.8" fill="#ea580c" />
      <line x1="8" y1="15" x2="8" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8" />
    </g>
  </svg>
);

// Glassmorphism card styles
const glassCardStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 140, 0, 0.15)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 20px 60px rgba(255, 140, 0, 0.15)',
    border: '1px solid rgba(255, 140, 0, 0.3)',
  },
};

function AboutComponent() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();

  const handleNavigation = (path: string) => {
    setLocation(path);
  };

  const texts = {
    title: language === 'no' ? 'Om CreatorHub Norge' : 'About CreatorHub Norge',
    subtitle:
      language === 'no'
        ? 'Alt-i-ett plattform for kreative profesjonelle i Norge'
        : 'All-in-one platform for creative professionals in Norway',
    mission: language === 'no' ? 'Vårt Oppdrag' : 'Our Mission',
    missionText:
      language === 'no'
        ? 'CreatorHub Norge er dedikert til å støtte norske kreative profesjonelle med verktøy, ressurser og fellesskap de trenger for å vokse og lykkes i den digitale tidsalderen.'
        : 'CreatorHub Norge is dedicated to supporting Norwegian creative professionals with the tools, resources, and community they need to grow and succeed in the digital age.',
    services: language === 'no' ? 'For Kreative Profesjonelle' : 'For Creative Professionals',
    team: language === 'no' ? 'Møt Grunnleggeren' : 'Meet the Founder',
    founder: language === 'no' ? 'Grunnlegger og CEO' : 'Founder and CEO',
    company: language === 'no' ? 'Bedriftsinformasjon' : 'Company Information',
    values: language === 'no' ? 'Våre Verdier' : 'Our Values',
    whyCreatorHub: language === 'no' ? 'Hvorfor CreatorHub?' : 'Why CreatorHub?',
    platform: language === 'no' ? 'Plattformen' : 'The Platform',
    integrations: language === 'no' ? 'Integrasjoner' : 'Integrations',
    norwegian: language === 'no' ? 'Tilpasset Norge' : 'Made for Norway',
  };

  // Platform capabilities
  const platformFeatures = [
    {
      title: language === 'no' ? 'Klientportaler' : 'Client Portals',
      description: language === 'no' 
        ? 'Profesjonelle gallerier for bildedeling, utvelgelse og levering til kunder'
        : 'Professional galleries for image sharing, selection and delivery to clients',
    },
    {
      title: language === 'no' ? 'Kontraktshåndtering' : 'Contract Management',
      description: language === 'no'
        ? 'Digitale kontrakter med BankID-signering, maler og automatisk oppfølging'
        : 'Digital contracts with BankID signing, templates and automatic follow-up',
    },
    {
      title: language === 'no' ? 'Prosjektstyring' : 'Project Management',
      description: language === 'no'
        ? 'Komplett oversikt over prosjekter, tidslinjer, oppgaver og milepæler'
        : 'Complete overview of projects, timelines, tasks and milestones',
    },
    {
      title: language === 'no' ? 'Fakturering' : 'Invoicing',
      description: language === 'no'
        ? 'Integrert fakturering med Fiken-synkronisering og automatisk bokføring'
        : 'Integrated invoicing with Fiken sync and automatic accounting',
    },
    {
      title: language === 'no' ? 'Story Arc Studio' : 'Story Arc Studio',
      description: language === 'no'
        ? 'Avansert videoredigering med AI-assistanse, fargegradering og eksport'
        : 'Advanced video editing with AI assistance, color grading and export',
    },
    {
      title: language === 'no' ? 'Virtual Studio' : 'Virtual Studio',
      description: language === 'no'
        ? '3D-studio for produktfotografering med lysoppsett og bakgrunner'
        : '3D studio for product photography with lighting setup and backgrounds',
    },
  ];

  // Integrations
  const integrations = [
    { name: 'Google Drive', description: language === 'no' ? 'Fillagring og synkronisering' : 'File storage and sync' },
    { name: 'Google Calendar', description: language === 'no' ? 'Avtaler og bookinger' : 'Appointments and bookings' },
    { name: 'Fiken', description: language === 'no' ? 'Regnskap og fakturering' : 'Accounting and invoicing' },
    { name: 'BankID', description: language === 'no' ? 'Sikker digital signering' : 'Secure digital signing' },
    { name: 'Vipps', description: language === 'no' ? 'Betalingsløsning (kommer)' : 'Payment solution (coming)' },
  ];

  // Norwegian focus points
  const norwegianFeatures = [
    {
      title: language === 'no' ? 'Norsk Språk' : 'Norwegian Language',
      description: language === 'no' ? 'Hele plattformen er på norsk' : 'The entire platform is in Norwegian',
    },
    {
      title: language === 'no' ? 'Norske Integrasjoner' : 'Norwegian Integrations',
      description: language === 'no' ? 'Fiken, BankID, Vipps og mer' : 'Fiken, BankID, Vipps and more',
    },
    {
      title: language === 'no' ? 'GDPR-Kompatibel' : 'GDPR Compliant',
      description: language === 'no' ? 'Fullt samsvar med personvern' : 'Full privacy compliance',
    },
    {
      title: language === 'no' ? 'Norsk Support' : 'Norwegian Support',
      description: language === 'no' ? 'Hjelp på ditt eget språk' : 'Help in your own language',
    },
  ];

  const services = [
    {
      icon: <PhotoCamera sx={{ fontSize: 48 }} />,
      title: language === 'no' ? 'Fotograf' : 'Photographer',
      description:
        language === 'no'
          ? 'Bildeutvelgelse, kundeproofing og leveringsgallerier. Kontrakter, booking og fakturaintegrasjon.'
          : 'Image culling, client proofing and delivery galleries. Contracts, booking and invoice integration.',
      color: '#2e7d32', // Green - matching landing-desktop
    },
    {
      icon: <VideoLibrary sx={{ fontSize: 48 }} />,
      title: language === 'no' ? 'Videograf' : 'Videographer',
      description:
        language === 'no'
          ? 'Fra pre-produksjon til leveranse. Storyboarding, multikamera-redigering, revisjonshåndtering og klientgjennomgang.'
          : 'From pre-production to delivery. Storyboarding, multi-cam editing, revision management and client review.',
      color: '#1565c0', // Blue - matching landing-desktop
    },
    {
      icon: <LibraryMusic sx={{ fontSize: 48 }} />,
      title: language === 'no' ? 'Musikkprodusent' : 'Music Producer',
      description:
        language === 'no'
          ? 'Opptak, miksing og mastering. Musikkstudioverktøy og distribusjonsløsninger.'
          : 'Recording, mixing and mastering. Music studio tools and distribution solutions.',
      color: '#7b1fa2', // Purple - matching landing-desktop
    },
    {
      icon: <Business sx={{ fontSize: 48 }} />,
      title: language === 'no' ? 'Leverandør' : 'Vendor',
      description:
        language === 'no'
          ? 'Produktkatalog, ordrehåndtering og kundeinnsikt. Digital distribusjon med lisensiering og betalingsløsninger.'
          : 'Product catalog, order management and customer insights. Digital distribution with licensing and payment solutions.',
      color: '#ff8c00', // Orange - matching landing-desktop
    },
  ];

  const values = [
    {
      icon: <Rocket sx={{ fontSize: 36 }} />,
      title: language === 'no' ? 'Innovasjon' : 'Innovation',
      description: language === 'no' ? 'Alltid i forkant av teknologi' : 'Always at the forefront of technology',
    },
    {
      icon: <Security sx={{ fontSize: 36 }} />,
      title: language === 'no' ? 'Sikkerhet' : 'Security',
      description: language === 'no' ? 'Dine data er trygge hos oss' : 'Your data is safe with us',
    },
    {
      icon: <Speed sx={{ fontSize: 36 }} />,
      title: language === 'no' ? 'Effektivitet' : 'Efficiency',
      description: language === 'no' ? 'Spar tid med smarte verktøy' : 'Save time with smart tools',
    },
    {
      icon: <Support sx={{ fontSize: 36 }} />,
      title: language === 'no' ? 'Støtte' : 'Support',
      description: language === 'no' ? 'Norsk support døgnet rundt' : 'Norwegian support around the clock',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#0f0f1a',
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
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Navigation Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(15, 15, 26, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 140, 0, 0.1)',
        }}
      >
        <Container maxWidth="xl">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 2,
            }}
          >
            {/* Logo */}
            <Box
              onClick={() => handleNavigation('/')}
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'scale(1.05)' },
              }}
            >
              <img
                src="/creatorhub-logo-amber.svg"
                alt="CreatorHub Norge"
                style={{ height: 100 }}
              />
            </Box>

            {/* Nav Links */}
            <Stack direction="row" spacing={1}>
              <Button
                variant="text"
                onClick={() => handleNavigation('/')}
                startIcon={<Home sx={{ fontSize: 18 }} />}
                sx={{
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  '&:hover': {
                    background: 'rgba(255, 140, 0, 0.1)',
                    color: '#f59e0b',
                  },
                }}
              >
                Hjem
              </Button>
              <Button
                variant="text"
                onClick={() => handleNavigation('/academy')}
                startIcon={<School sx={{ fontSize: 18 }} />}
                sx={{
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  '&:hover': {
                    background: 'rgba(255, 140, 0, 0.1)',
                    color: '#f59e0b',
                  },
                }}
              >
                Academy
              </Button>
              <Button
                variant="text"
                onClick={() => handleNavigation('/community')}
                startIcon={<Group sx={{ fontSize: 18 }} />}
                sx={{
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  '&:hover': {
                    background: 'rgba(255, 140, 0, 0.1)',
                    color: '#f59e0b',
                  },
                }}
              >
                Community
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, pt: 8, pb: 6 }}>
        <AnimatedSection>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                mb: 3,
                px: 3,
                py: 1,
                borderRadius: '30px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <CreatorHubLogoIcon size={32} />
              <Typography sx={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.9rem' }}>
                Norges Kreative Plattform
              </Typography>
            </Box>

            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', md: '4rem' },
                fontWeight: 800,
                color: '#fff',
                mb: 2,
                lineHeight: 1.1,
              }}
            >
              {texts.title}
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: '1.1rem', md: '1.4rem' },
                color: 'rgba(255, 255, 255, 0.7)',
                maxWidth: 700,
                mx: 'auto',
                lineHeight: 1.6,
              }}
            >
              {texts.subtitle}
            </Typography>
          </Box>
        </AnimatedSection>

        {/* Mission Section */}
        <AnimatedSection delay={0.1}>
          <Box
            sx={{
              ...glassCardStyle,
              p: { xs: 4, md: 6 },
              mb: 6,
              textAlign: 'center',
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.8rem', md: '2.2rem' },
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 3,
              }}
            >
              {texts.mission}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '1rem', md: '1.2rem' },
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: 1.8,
                maxWidth: 800,
                mx: 'auto',
              }}
            >
              {texts.missionText}
            </Typography>
          </Box>
        </AnimatedSection>

        {/* Services Section */}
        <AnimatedSection delay={0.2}>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              mb: 5,
            }}
          >
            {texts.services}
          </Typography>

          <Grid container spacing={3} sx={{ mb: 8 }}>
            {services.map((service, index) => (
              <Grid item xs={12} sm={6} key={index}>
                <AnimatedSection animation="scaleIn" delay={0.1 * index}>
                  <Box
                    sx={{
                      ...glassCardStyle,
                      p: 4,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '20px',
                        background: `linear-gradient(135deg, ${service.color}20, ${service.color}40)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                        color: service.color,
                        border: `1px solid ${service.color}40`,
                      }}
                    >
                      {service.icon}
                    </Box>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: '#fff',
                        mb: 2,
                      }}
                    >
                      {service.title}
                    </Typography>
                    <Typography
                      sx={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        lineHeight: 1.6,
                      }}
                    >
                      {service.description}
                    </Typography>
                  </Box>
                </AnimatedSection>
              </Grid>
            ))}
          </Grid>
        </AnimatedSection>

        {/* Platform Features Section */}
        <AnimatedSection delay={0.25}>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              mb: 2,
            }}
          >
            {texts.platform}
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center',
              mb: 5,
              maxWidth: 700,
              mx: 'auto',
            }}
          >
            {language === 'no'
              ? 'En komplett verktøykasse for å drive en profesjonell kreativ virksomhet'
              : 'A complete toolkit for running a professional creative business'}
          </Typography>

          <Grid container spacing={2} sx={{ mb: 8 }}>
            {platformFeatures.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <AnimatedSection animation="scaleIn" delay={0.05 * index}>
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 140, 0, 0.1)',
                      height: '100%',
                      transition: 'all 0.3s',
                      '&:hover': {
                        background: 'rgba(255, 140, 0, 0.05)',
                        borderColor: 'rgba(255, 140, 0, 0.3)',
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <CheckCircle sx={{ color: '#10b981', fontSize: 24, mt: 0.5 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                          {feature.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                          {feature.description}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </AnimatedSection>
              </Grid>
            ))}
          </Grid>
        </AnimatedSection>

        {/* Integrations Section */}
        <AnimatedSection delay={0.3}>
          <Box
            sx={{
              ...glassCardStyle,
              p: { xs: 4, md: 6 },
              mb: 6,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.8rem', md: '2.2rem' },
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 2,
                textAlign: 'center',
              }}
            >
              {texts.integrations}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                textAlign: 'center',
                mb: 4,
              }}
            >
              {language === 'no'
                ? 'Sømløs integrasjon med verktøyene du allerede bruker'
                : 'Seamless integration with the tools you already use'}
            </Typography>

            <Grid container spacing={3} justifyContent="center">
              {integrations.map((integration, index) => (
                <Grid item xs={6} sm={4} md={2.4} key={index}>
                  <Box
                    sx={{
                      textAlign: 'center',
                      p: 2,
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s',
                      '&:hover': {
                        background: 'rgba(255, 140, 0, 0.1)',
                        borderColor: 'rgba(255, 140, 0, 0.3)',
                      },
                    }}
                  >
                    <IntegrationInstructions sx={{ color: '#f59e0b', fontSize: 32, mb: 1 }} />
                    <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                      {integration.name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>
                      {integration.description}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </AnimatedSection>

        {/* Norwegian Focus Section */}
        <AnimatedSection delay={0.35}>
          <Box
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(0, 82, 147, 0.2), rgba(186, 12, 47, 0.1))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              mb: 8,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Norwegian flag accent */}
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 150,
                height: 150,
                background: 'radial-gradient(circle, rgba(186, 12, 47, 0.3) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.8rem', md: '2.2rem' },
                fontWeight: 700,
                color: '#fff',
                mb: 2,
                textAlign: 'center',
              }}
            >
              {texts.norwegian}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                mb: 4,
                maxWidth: 700,
                mx: 'auto',
              }}
            >
              {language === 'no'
                ? 'Utviklet spesifikt for norske kreative virksomheter med lokale integrasjoner og full GDPR-samsvar'
                : 'Developed specifically for Norwegian creative businesses with local integrations and full GDPR compliance'}
            </Typography>

            <Grid container spacing={3}>
              {norwegianFeatures.map((feature, index) => (
                <Grid item xs={6} md={3} key={index}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      {index === 0 && <Language sx={{ color: '#f59e0b', fontSize: 28 }} />}
                      {index === 1 && <IntegrationInstructions sx={{ color: '#f59e0b', fontSize: 28 }} />}
                      {index === 2 && <Verified sx={{ color: '#10b981', fontSize: 28 }} />}
                      {index === 3 && <Support sx={{ color: '#3b82f6', fontSize: 28 }} />}
                    </Box>
                    <Typography sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                      {feature.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                      {feature.description}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </AnimatedSection>

        {/* Values Section */}
        <AnimatedSection delay={0.3}>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              mb: 5,
            }}
          >
            {texts.values}
          </Typography>

          <Grid container spacing={3} sx={{ mb: 8 }}>
            {values.map((value, index) => (
              <Grid item xs={6} md={3} key={index}>
                <AnimatedSection animation="fadeInUp" delay={0.1 * index}>
                  <Box
                    sx={{
                      textAlign: 'center',
                      p: 3,
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 140, 0, 0.1)',
                      transition: 'all 0.3s',
                      '&:hover': {
                        background: 'rgba(255, 140, 0, 0.05)',
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <Box sx={{ color: '#f59e0b', mb: 2 }}>{value.icon}</Box>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: '#fff',
                        mb: 1,
                        fontSize: '1.1rem',
                      }}
                    >
                      {value.title}
                    </Typography>
                    <Typography
                      sx={{
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {value.description}
                    </Typography>
                  </Box>
                </AnimatedSection>
              </Grid>
            ))}
          </Grid>
        </AnimatedSection>

        {/* Team Section */}
        <AnimatedSection delay={0.4}>
          <Box
            sx={{
              ...glassCardStyle,
              p: { xs: 4, md: 6 },
              mb: 6,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.8rem', md: '2.2rem' },
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 4,
                textAlign: 'center',
              }}
            >
              {texts.team}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 4 }}>
              {/* Profile Image */}
              <Box
                sx={{
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  padding: '4px',
                  flexShrink: 0,
                  boxShadow: '0 0 50px rgba(245, 158, 11, 0.4)',
                  overflow: 'hidden',
                }}
              >
                <Box
                  component="img"
                  src="/assets/daniel-qazi.jpg"
                  alt="Daniel Qazi - Grunnlegger og CEO"
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    objectPosition: '80% 15%',
                    transform: 'scale(1.05)',
                    transition: 'transform 0.3s ease',
                  }}
                />
              </Box>

              <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: '#fff',
                    mb: 1,
                  }}
                >
                  Daniel Qazi
                </Typography>
                <Typography
                  sx={{
                    color: '#f59e0b',
                    fontWeight: 600,
                    mb: 2,
                    fontSize: '1.1rem',
                  }}
                >
                  {texts.founder}
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    lineHeight: 1.8,
                    mb: 3,
                  }}
                >
                  {language === 'no'
                    ? 'Erfaren fotograf og teknologientusiast som driver CreatorHub Norge med en visjon om å styrke det norske kreative miljøet. Med bakgrunn i både kreativt arbeid og teknologi, forstår Daniel de unike utfordringene kreative profesjonelle møter daglig.'
                    : 'Experienced photographer and technology enthusiast driving CreatorHub Norge with a vision to empower the Norwegian creative community. With a background in both creative work and technology, Daniel understands the unique challenges creative professionals face daily.'}
                </Typography>

                <Stack direction="row" spacing={1} justifyContent={{ xs: 'center', md: 'flex-start' }}>
                  <IconButton
                    sx={{
                      color: '#fff',
                      background: 'rgba(255, 255, 255, 0.1)',
                      '&:hover': { background: '#0077b5', transform: 'translateY(-2px)' },
                      transition: 'all 0.3s',
                    }}
                  >
                    <LinkedIn />
                  </IconButton>
                  <IconButton
                    sx={{
                      color: '#fff',
                      background: 'rgba(255, 255, 255, 0.1)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.3s',
                    }}
                  >
                    <Instagram />
                  </IconButton>
                </Stack>
              </Box>
            </Box>
          </Box>
        </AnimatedSection>

        {/* Company Info */}
        <AnimatedSection delay={0.5}>
          <Box
            sx={{
              ...glassCardStyle,
              p: { xs: 4, md: 6 },
              mb: 6,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: { xs: '1.8rem', md: '2.2rem' },
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 4,
                textAlign: 'center',
              }}
            >
              {texts.company}
            </Typography>

            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Business sx={{ color: '#f59e0b', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                      Firmanavn
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>QAZI FOTOREEL</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <EmojiEvents sx={{ color: '#f59e0b', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                      Org.nummer
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>833 038 222</Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Email sx={{ color: '#f59e0b', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                      E-post
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>daniel@creatorhubn.com</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LocationOn sx={{ color: '#f59e0b', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                      Lokasjon
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>Norge 🇳🇴</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </AnimatedSection>

        {/* CTA Section */}
        <AnimatedSection delay={0.6}>
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              px: 4,
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(234, 88, 12, 0.1))',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              mb: 6,
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#fff',
                mb: 2,
              }}
            >
              {language === 'no' ? 'Klar til å bli med?' : 'Ready to join?'}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                mb: 4,
                maxWidth: 500,
                mx: 'auto',
              }}
            >
              {language === 'no'
                ? 'Bli en del av Norges voksende kreative fellesskap i dag.'
                : 'Become part of Norway\'s growing creative community today.'}
            </Typography>
            <Button
              variant="contained"
              onClick={() => handleNavigation('/')}
              endIcon={<ArrowForward />}
              sx={{
                background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                color: '#fff',
                px: 4,
                py: 1.5,
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d97706, #c2410c)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 10px 30px rgba(245, 158, 11, 0.3)',
                },
                transition: 'all 0.3s',
              }}
            >
              {language === 'no' ? 'Kom i gang' : 'Get started'}
            </Button>
          </Box>
        </AnimatedSection>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          borderTop: '1px solid rgba(255, 140, 0, 0.1)',
          py: 4,
          background: 'rgba(0, 0, 0, 0.3)',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <img src="/creatorhub-logo-amber.svg" alt="CreatorHub" style={{ height: 100 }} />
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>
                © 2025 CreatorHub Norge. Alle rettigheter reservert.
              </Typography>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button
                variant="text"
                size="small"
                onClick={() => handleNavigation('/')}
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b' },
                }}
              >
                Hjem
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => handleNavigation('/academy')}
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b' },
                }}
              >
                Academy
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => handleNavigation('/community')}
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'none',
                  '&:hover': { color: '#f59e0b' },
                }}
              >
                Community
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

// Wrap with Visual Editor for customization support
const About = withVisualEditor(AboutComponent, {
  componentId: 'about',
  componentName: 'About Page',
  category: 'company',
  editable: true,
  previewable: true,
  templateable: true,
  propsEditable: true,
});

export default About;
