import { Suspense, lazy, useEffect, useState } from 'react';
import { Alert, Box, Container } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import BlockRenderer from '../cms/BlockRenderer';
import { useCmsBlocks } from '../cms/useCmsBlocks';
import { useLocale } from '../cms/useLocale';
import LoginDialog from './LoginDialog';
import LandingFAQSection from './LandingFAQSection';
import { ROLE_ROOM_LANDING_CONFIG } from '../config/landing';
import { LandingBackdrop } from './landing-sections/LandingBackdrop';
import { LandingIntro } from './landing-sections/LandingIntro';
import { LandingHero } from './landing-sections/LandingHero';
import { LandingCTA } from './landing-sections/LandingCTA';
import { LandingFooter } from './landing-sections/LandingFooter';
import { LandingStickyCTA } from './landing-sections/LandingStickyCTA';
import { LandingExitIntent } from './landing-sections/LandingExitIntent';

// Tunge under-fold-seksjoner — lazy-load for bedre initial paint + LCP
const LandingFeatures = lazy(() => import('./landing-sections/LandingFeatures'));
const LandingDeviceShowcase = lazy(() => import('./landing-sections/LandingDeviceShowcase'));

interface CastingLandingPageProps {
  onEnter: () => void;
  onGuestEnter?: () => void;
}

/**
 * Public landing-side for The Role Room. Orchestrerer 7 seksjon-
 * komponenter pluss intro/backdrop/sticky CTA/exit-intent.
 *
 * Seksjons-komponenter: LandingBackdrop, LandingIntro, LandingHero,
 * LandingCTA, LandingFeatures (lazy), LandingDeviceShowcase (lazy),
 * LandingFAQSection, LandingFooter.
 *
 * Performance:
 *  - Lazy-load Features + DeviceShowcase (tunge ikoner + mockups under fold)
 *  - Preload hero-logo (eager + fetchpriority high inne i LandingHero)
 *  - React.memo på alle seksjon-komponenter
 *  - useReducedMotion respekteres globalt
 *
 * Conversion:
 *  - LandingStickyCTA dukker opp etter 600px scroll
 *  - LandingExitIntent på mouse-leave-top + Page Visibility
 *  - Microcopy i CTA-er: "Start The Role Room" + "Kom i gang" (sticky)
 */
export function CastingLandingPage({ onEnter, onGuestEnter }: CastingLandingPageProps) {
  const { locale } = useLocale();
  const cmsBlocks = useCmsBlocks('home');
  const shouldReduceMotion = useReducedMotion();

  const introEnabled = ROLE_ROOM_LANDING_CONFIG.intro.enabled;
  const [showIntro, setShowIntro] = useState<boolean>(introEnabled);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginDialogVariant, setLoginDialogVariant] = useState<'landing' | 'admin'>('landing');
  const [googleAuthMessage, setGoogleAuthMessage] = useState<string | null>(null);

  /* skip intro entirely if disabled in role room config, or if user prefers reduced motion */
  useEffect(() => {
    if (!introEnabled || shouldReduceMotion) setShowIntro(false);
  }, [introEnabled, shouldReduceMotion]);

  const handleStartClick = () => {
    setLoginDialogVariant('landing');
    setLoginDialogOpen(true);
  };

  const handleAdminLoginClick = () => {
    setLoginDialogVariant('admin');
    setLoginDialogOpen(true);
  };

  const handleLoginSuccess = () => {
    try {
      window.sessionStorage.removeItem('role-room-commercial-draft-v1');
    } catch {
      // Ignore storage cleanup failures.
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('rrGoogleStatus');
      url.searchParams.delete('rrGoogleMessage');
      url.searchParams.delete('rrGoogleTransfer');
      url.searchParams.delete('rrGoogleMode');
      url.searchParams.delete('rrGoogleTempToken');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
    setGoogleAuthMessage(null);
    setLoginDialogOpen(false);
    setLoginDialogVariant('landing');
    onEnter();
  };

  const handleLoginDialogClose = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('rrGoogleStatus');
      url.searchParams.delete('rrGoogleMessage');
      url.searchParams.delete('rrGoogleTransfer');
      url.searchParams.delete('rrGoogleMode');
      url.searchParams.delete('rrGoogleTempToken');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
    setGoogleAuthMessage(null);
    setLoginDialogOpen(false);
    setLoginDialogVariant('landing');
  };

  // Parse URL-params for OAuth-callbacks / admin-login / checkout-resume
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get('rrGoogleStatus');
    const googleMessage = params.get('rrGoogleMessage');

    if (googleStatus === 'error') {
      setGoogleAuthMessage(googleMessage || 'Google-innloggingen kunne ikke fullføres.');
      setLoginDialogVariant(params.get('rrAdminLogin') ? 'admin' : 'landing');
      setLoginDialogOpen(true);
      return;
    }
    if (params.get('rrAdminLogin')) {
      setLoginDialogVariant('admin');
      setLoginDialogOpen(true);
      return;
    }
    if (params.get('rrCheckout') || params.get('rrActivation')) {
      setLoginDialogVariant('landing');
      setLoginDialogOpen(true);
    }
  }, []);

  // The standalone casting shell sets html/body overflow:hidden.
  // Re-enable vertical scrolling while the landing page is mounted.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverflowY = html.style.overflowY;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverflowY = body.style.overflowY;
    html.style.overflow = 'auto';
    html.style.overflowY = 'auto';
    body.style.overflow = 'auto';
    body.style.overflowY = 'auto';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overflowY = prevHtmlOverflowY;
      body.style.overflow = prevBodyOverflow;
      body.style.overflowY = prevBodyOverflowY;
    };
  }, []);

  // CMS-overridde rendering (when blocks-content er definert i CMS)
  if (cmsBlocks) {
    return (
      <Box
        sx={{ width: '100%', minHeight: '100vh', bgcolor: '#0a0a0f', color: '#e2e8f0' }}
        data-testid="role-room-landing-cms"
      >
        <BlockRenderer blocks={cmsBlocks} locale={locale} />
        <LoginDialog
          key={loginDialogVariant}
          open={loginDialogOpen}
          onClose={handleLoginDialogClose}
          onLoginSuccess={handleLoginSuccess}
          onGuestEnter={loginDialogVariant === 'landing' ? onGuestEnter : undefined}
          isLandingPage={loginDialogVariant === 'landing'}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        bgcolor: '#0a0a0f',
        overflowX: loginDialogOpen ? 'visible' : 'hidden',
        overflowY: loginDialogOpen ? 'visible' : 'auto',
        position: 'relative',
      }}
    >
      <LandingBackdrop />

      {googleAuthMessage ? (
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 3, pt: { xs: 10, md: 12 } }}>
          <Alert
            severity="error"
            onClose={() => setGoogleAuthMessage(null)}
            sx={{
              mb: 3,
              borderRadius: 3,
              bgcolor: 'rgba(17, 24, 39, 0.82)',
              color: '#fff',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              backdropFilter: 'blur(18px)',
              '& .MuiAlert-icon': { color: '#fda4af' },
            }}
          >
            {googleAuthMessage}
          </Alert>
        </Container>
      ) : null}

      <LandingIntro visible={showIntro} onDismiss={() => setShowIntro(false)} />

      <motion.main
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: showIntro ? 0 : 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.3 }}
        style={{ position: 'relative', zIndex: 2 }}
        data-testid="role-room-landing-main"
      >
        <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 6 }, pb: 10 }}>
          <LandingHero introShowing={showIntro} />
          <LandingCTA onStartClick={handleStartClick} onGuestEnter={onGuestEnter} />
          <Suspense fallback={<Box sx={{ minHeight: 400 }} />}>
            <LandingFeatures introShowing={showIntro} />
          </Suspense>
          <Suspense fallback={<Box sx={{ minHeight: 400 }} />}>
            <LandingDeviceShowcase />
          </Suspense>
          <LandingFAQSection />
          <LandingFooter onAdminLoginClick={handleAdminLoginClick} />
        </Container>
      </motion.main>

      <LandingStickyCTA
        onStartClick={handleStartClick}
        visible={!showIntro && !loginDialogOpen}
      />

      <LandingExitIntent
        enabled={!showIntro && !loginDialogOpen}
        onStartClick={handleStartClick}
      />

      <LoginDialog
        key={loginDialogVariant}
        open={loginDialogOpen}
        onClose={handleLoginDialogClose}
        onLoginSuccess={handleLoginSuccess}
        onGuestEnter={loginDialogVariant === 'landing' ? onGuestEnter : undefined}
        isLandingPage={loginDialogVariant === 'landing'}
      />
    </Box>
  );
}

export default CastingLandingPage;
