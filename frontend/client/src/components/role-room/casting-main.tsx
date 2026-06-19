import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CircularProgress, CssBaseline, Typography } from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CastingPlannerPanel } from './components/CastingPlannerPanel';
import { CastingLandingPage } from './components/CastingLandingPage';
import TheRoleRoomLanding from '@/pages/theroleroom-landing';
import LeadgridLanding from '@/pages/leadgrid-landing';
import LeadgridPersonvern from '@/pages/leadgrid-personvern';
import LeadgridSuperadminPage from '@/pages/leadgrid-superadmin';
import LeadgridClientPortalPage from '@/pages/leadgrid-client-portal';
import LeadgridPartnerApplicationPage from '@/pages/leadgrid-partner-application';
import LeadgridDevelopersPage from '@/pages/leadgrid-developers';
import LeadgridDeveloperApplicationPage from '@/pages/leadgrid-developer-application';
import BlogIndexPage from '@/pages/blog-index';
import BlogPostPage from '@/pages/blog-post';
import AgencyLandingPage from '@/pages/agency-landing';
import AgencyFAQPage from '@/pages/agency-faq';
import PitchDeckPage from '@/pages/pitch-deck';
import RoleRoomEducationPartnershipPage from './components/RoleRoomEducationPartnershipPage';
import TalentPortalView from './components/TalentPortalView';
import AgencyPortalView from './components/AgencyPortalView';
import TalentsApp, {
  parseTalentsAppPage,
  isPartnerInviteAcceptPath, PartnerInviteAcceptPage,
  isTalentProposalAcceptPath, TalentProposalAcceptPage,
} from './talents-app/TalentsApp';
import CompetitorComparisonPage, { parseCompetitorFromPath } from './components/CompetitorComparisonPage';
import StudentSEOPage, { parseStudentPageFromPath } from './components/StudentSEOPage';
import PressKitPage, { parsePressKitFromPath } from './components/PressKitPage';
import MarketingPageRouter from '@/components/admin/content-marketing/MarketingPageRouter';
import { parseMarketingPagePath } from '@/components/admin/content-marketing/marketingPagesConfig';
import { PublicBriefDetail, PublicBriefIndex, parsePublicBriefPath } from '@/components/admin/content-marketing/PublicBriefPage';
import ClientWorkspaceShell from './components/client-workspace/ClientWorkspaceShell';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useAriaHiddenFocusFix } from '@/hooks/useAriaHiddenFocusFix';
import { detectLocale } from './cms/useLocale';
import { ToastProvider } from './components/ToastStack';
import authSessionService from './services/authSessionService';
import { clientInvitesApi, googleWorkspaceApi } from './services/castingApiService';
import { EnhancedMasterIntegrationProvider } from '@/integration/EnhancedMasterIntegrationProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { parseTalentPortalIntentFromWindow } from './utils/talentPortal';
import { isRoleRoomEducationPathname } from './utils/runtime';
import { syncSiteSeo } from '@/lib/siteSeo';
import { trackMarketingPageView } from '@/lib/marketingPixelsRuntime';
import RoleRoomUXLayer from './shared/RoleRoomUXLayer';
import { getActiveProfessionMode } from './config/professionMode';
import {
  Search as SearchTourIcon,
  HelpOutline as HelpTourIcon,
  EmojiPeople as WelcomeIcon,
  Theaters as CastingIcon,
} from '@mui/icons-material';
// Super Admin: alltid-tilgjengelig kontrollflate for daniel@creatorhubn.com.
// Mountes på toppen av Role Room-shellen så det er synlig SELV når et
// prosjekt er åpent. /admin-room-ruten åpner AdminRoom direkte uten å
// gå via dashboard-subtab (som var begravd bak email-gate + project-state).
import SuperAdminOverlay from './components/admin/SuperAdminOverlay';
import SuperAdminAdminRoomShell, {
  isSuperAdminAdminRoomPath,
} from './components/admin/SuperAdminAdminRoomShell';

const castingQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ROLE_ROOM_DOCUMENT_TITLE = 'The Role Room - CreatorHub';
const ROLE_ROOM_FAVICON_URL = '/TheRoleRoom_App_Logo.png';

function upsertHeadLink(rel: string, href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const existingLink = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (existingLink) {
    if (rel !== 'apple-touch-icon') {
      existingLink.type = href.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    } else {
      existingLink.removeAttribute('type');
    }
    existingLink.href = href;
    return;
  }

  const link = document.createElement('link');
  link.rel = rel;
  if (rel !== 'apple-touch-icon') {
    link.type = href.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  }
  link.href = href;
  document.head.appendChild(link);
}

function CastingStandaloneAppContent() {
  // Detekter locale fra /en/-prefix og strip det før path-parsing.
  // Kanonisk innhold på /<path>, oversatt på /en/<path>.
  const localeCtx = useMemo(() => {
    if (typeof window === 'undefined') {
      return { locale: 'no' as const, pathname: '/', fullPath: '/' };
    }
    return detectLocale(window.location.pathname);
  }, []);

  const isEducationPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    // Pass strippet pathname så `/en/utdanningsinstitusjon` matches
    return isRoleRoomEducationPathname(localeCtx.pathname, window.location);
  }, [localeCtx.pathname]);

  // Super Admin-rute: /admin-room mountes som egen toplevel-flate. Detekteres
  // her — ikke i RoleRoomDashboardPanel — for å bypasse email-gate-bug og
  // project-room-auto-restore. Bare daniel@creatorhubn.com slipper gjennom
  // (verifisert i SuperAdminAdminRoomShell selv).
  const isAdminRoomPath = useMemo(() => isSuperAdminAdminRoomPath(), [localeCtx.pathname]);

  // Public SEO-landingssider — detekteres før auth-gate slik at
  // Googlebot kan indeksere innholdet uten login.
  const competitorKey = useMemo(
    () => parseCompetitorFromPath(localeCtx.pathname),
    [localeCtx.pathname],
  );

  const studentPageKey = useMemo(
    () => parseStudentPageFromPath(localeCtx.pathname),
    [localeCtx.pathname],
  );

  const isPressKitPath = useMemo(
    () => parsePressKitFromPath(localeCtx.pathname),
    [localeCtx.pathname],
  );

  const marketingPageKey = useMemo(
    () => parseMarketingPagePath(localeCtx.pathname),
    [localeCtx.pathname],
  );

  const briefRoute = useMemo(
    () => parsePublicBriefPath(localeCtx.pathname),
    [localeCtx.pathname],
  );

  // Klient-flate: /client/workspace/:projectId — kuratert 5-tabs-shell
  // (Økonomi, Godkjenning, Brief, Roller, Plan) for client_reviewer-rollen.
  // Producer kan også åpne med ?preview=true for å se sin egen klient-flate.
  const clientWorkspaceProjectId = useMemo(() => {
    const match = localeCtx.pathname.match(/^\/client\/workspace\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [localeCtx.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    syncSiteSeo({
      hostname: window.location.hostname,
      pathname: window.location.pathname,
    });

    trackMarketingPageView(window.location.pathname);
  }, [isEducationPath, competitorKey, studentPageKey, isPressKitPath]);

  if (isAdminRoomPath) {
    return <SuperAdminAdminRoomShell />;
  }

  // Leadgrid landing-side + personvern (offentlige sider — krever ikke auth).
  // Personvern må komme før hoved-landing-en pga prefix-match.
  if (localeCtx.pathname === '/leadgrid/personvern'
      || localeCtx.pathname === '/leadgrid/personvern/') {
    return <LeadgridPersonvern />;
  }
  if (localeCtx.pathname === '/leadgrid' || localeCtx.pathname === '/leadgrid/') {
    return <LeadgridLanding />;
  }
  if (localeCtx.pathname === '/superadmin' || localeCtx.pathname === '/superadmin/') {
    return <LeadgridSuperadminPage />;
  }
  // Leadgrid klient-portal: /c/{token} (offentlig, ingen TRR-konto kreves)
  if (/^\/c\/[A-Za-z0-9_-]+\/?$/.test(localeCtx.pathname)) {
    return <LeadgridClientPortalPage />;
  }
  // Org-side partnerskap (org-admin søker)
  if (localeCtx.pathname === '/leadgrid/innstillinger/partnerskap' ||
      localeCtx.pathname === '/leadgrid/innstillinger/partnerskap/') {
    return <LeadgridPartnerApplicationPage />;
  }
  // Developer-docs (public)
  if (localeCtx.pathname === '/leadgrid/utviklere' ||
      localeCtx.pathname === '/leadgrid/utviklere/') {
    return <LeadgridDevelopersPage />;
  }
  // Utvikler-søknadsskjema (public)
  if (localeCtx.pathname === '/leadgrid/utviklere/soknad' ||
      localeCtx.pathname === '/leadgrid/utviklere/soknad/') {
    return <LeadgridDeveloperApplicationPage />;
  }

  if (competitorKey) {
    return <CompetitorComparisonPage competitor={competitorKey} locale={localeCtx.locale} />;
  }

  if (studentPageKey) {
    return <StudentSEOPage pageKey={studentPageKey} locale={localeCtx.locale} />;
  }

  if (isPressKitPath) {
    return <PressKitPage locale={localeCtx.locale} />;
  }

  if (marketingPageKey) {
    return <MarketingPageRouter pageKey={marketingPageKey} />;
  }

  if (briefRoute) {
    return briefRoute.kind === 'index'
      ? <PublicBriefIndex />
      : <PublicBriefDetail slug={briefRoute.slug} />;
  }

  if (clientWorkspaceProjectId) {
    return <ClientWorkspaceShell projectId={clientWorkspaceProjectId} />;
  }

  if (isEducationPath) {
    return <RoleRoomEducationPartnershipPage locale={localeCtx.locale} />;
  }

  // Public marketing/SEO landing pages (agency, FAQ, pitch, blog). These live in
  // pages/ but were only routed in App.tsx — which never loads on dedicated
  // Role Room hosts (theroleroom.com) — so the footer/nav links were dead.
  // Route them here, before the auth-gated fallback.
  {
    const publicPath = localeCtx.pathname.replace(/\/+$/, '') || '/';
    if (publicPath === '/for-byraer' || publicPath === '/for-byråer' || publicPath === '/agencies') {
      return <AgencyLandingPage />;
    }
    if (publicPath === '/faq') {
      return <AgencyFAQPage />;
    }
    if (publicPath === '/pitch') {
      return <PitchDeckPage />;
    }
    if (publicPath === '/blog') {
      return <BlogIndexPage />;
    }
    if (/^\/blog\/[^/]+$/.test(publicPath)) {
      return <BlogPostPage />;
    }
  }

  return <CastingStandaloneRuntimeContent />;
}

function CastingStandaloneRuntimeContent() {
  // Check if user is logged in - determines which view to show
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  // Presence-heartbeat: pinger /api/presence/heartbeat hvert 30s mens innlogget
  usePresenceHeartbeat(isAuthenticated);
  // Global aria-hidden-fokus-fiks for MUI v6.1-modaler — fjerner konsoll-
  // warningen "Blocked aria-hidden on an element because its descendant
  // retained focus" ved å blur-e fokuserte elementer som ender under et
  // aria-hidden-tre.
  useAriaHiddenFocusFix(true);
  const [processingGoogleLogin, setProcessingGoogleLogin] = useState(false);
  const [processingClientInviteLogin, setProcessingClientInviteLogin] = useState(false);
  const handledGoogleTransferRef = useRef<string | null>(null);
  const handledClientInviteTransferRef = useRef<string | null>(null);

  const guestMode = false;

  useEffect(() => {
    let isMounted = true;
    const getCleanGoogleIntentUrl = () => {
      if (typeof window === 'undefined') {
        return null;
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('rrGoogleStatus');
      url.searchParams.delete('rrGoogleTransfer');
      url.searchParams.delete('rrGoogleMode');
      url.searchParams.delete('rrGoogleMessage');
      url.searchParams.delete('rrGoogleTempToken');
      return `${url.pathname}${url.search}${url.hash}`;
    };
    const clearGoogleIntentFromUrl = () => {
      if (typeof window === 'undefined') {
        return;
      }
      const cleanUrl = getCleanGoogleIntentUrl();
      if (!cleanUrl) {
        return;
      }
      window.history.replaceState({}, document.title, cleanUrl);
    };
    const getCleanClientInviteUrl = () => {
      if (typeof window === 'undefined') {
        return null;
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('rrClientInviteStatus');
      url.searchParams.delete('rrClientInviteTransfer');
      url.searchParams.delete('rrClientInviteMessage');
      return `${url.pathname}${url.search}${url.hash}`;
    };
    const clearClientInviteIntentFromUrl = () => {
      if (typeof window === 'undefined') {
        return;
      }
      const cleanUrl = getCleanClientInviteUrl();
      if (!cleanUrl) {
        return;
      }
      window.history.replaceState({}, document.title, cleanUrl);
    };

    const bootstrapAuthState = async () => {
      const session = await authSessionService.loadSession();
      if (!isMounted) return;

      const params = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
      const googleStatus = params.get('rrGoogleStatus');
      const googleTransferId = params.get('rrGoogleTransfer');
      const googleMode = params.get('rrGoogleMode');
      const clientInviteStatus = params.get('rrClientInviteStatus');
      const clientInviteTransferId = params.get('rrClientInviteTransfer');

      // Sikkerhetsfix (#1): Google-callback kan returnere needs_2fa hvis
      // brukeren har TOTP aktivert. Da bærer URL-en en rrGoogleTempToken
      // som vi sender til /api/auth/login/complete-2fa sammen med koden
      // brukeren oppgir. Bygger en enkel prompt — full LoginDialog-
      // integrasjon kan komme senere; det viktige er at bypassen er
      // stengt på backend, og UX-en gir brukeren en vei videre.
      if (googleStatus === 'needs_2fa') {
        const tempToken = params.get('rrGoogleTempToken');
        if (tempToken) {
          const code = window.prompt(
            '2FA er aktivert på kontoen din. Skriv inn 6-sifret kode fra Authenticator-appen for å fullføre Google-innloggingen.',
          );
          if (code && code.trim().length >= 6) {
            try {
              const response = await fetch('/api/auth/login/complete-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken, code: code.trim() }),
              });
              const payload = await response.json().catch(() => null) as {
                success?: boolean;
                token?: string;
                user?: any;
                message?: string;
              } | null;
              if (response.ok && payload?.success && payload.token && payload.user) {
                await authSessionService.applyRoleRoomLogin(
                  {
                    id: payload.user.id,
                    email: payload.user.email,
                    role: payload.user.role,
                    display_name: payload.user.display_name ?? payload.user.name,
                    name: payload.user.name,
                    loginAs: payload.user.loginAs,
                    requestedRole: payload.user.requestedRole ?? null,
                  },
                  payload.token,
                );
                clearGoogleIntentFromUrl();
                setIsAuthenticated(true);
                setAuthResolved(true);
                return;
              }
              window.alert(payload?.message ?? 'Feil 2FA-kode. Prøv å logge inn på nytt.');
            } catch {
              window.alert('Nettverksfeil ved 2FA-verifisering. Prøv å logge inn på nytt.');
            }
          }
        }
        clearGoogleIntentFromUrl();
        // Fall gjennom så standard authResolved-state settes
      }

      if (googleStatus === 'success' && googleMode === 'login' && googleTransferId) {
        const transferKey = `${googleMode}:${googleTransferId}`;
        if (handledGoogleTransferRef.current !== transferKey) {
          handledGoogleTransferRef.current = transferKey;
          setProcessingGoogleLogin(true);
          try {
            const transfer = await googleWorkspaceApi.getOauthSessionResult(googleTransferId);
            if (!isMounted) return;

            if (transfer.mode === 'login' && transfer.user && transfer.sessionToken) {
              await authSessionService.applyRoleRoomLogin(
                {
                  id: transfer.user.id,
                  email: transfer.user.email,
                  role: transfer.user.role,
                  display_name: transfer.user.display_name,
                  name: transfer.user.name,
                  loginAs: transfer.user.loginAs,
                  requestedRole: transfer.user.requestedRole ?? null,
                },
                transfer.sessionToken,
              );
              if (!isMounted) return;
              try {
                sessionStorage.removeItem('role-room-commercial-draft-v1');
              } catch {
                // Ignore storage cleanup failures.
              }
              clearGoogleIntentFromUrl();
              setIsAuthenticated(true);
              setProcessingGoogleLogin(false);
              setAuthResolved(true);
              return;
            }
          } catch (error) {
            console.error('[CastingStandaloneApp] Failed to complete Google login redirect', error);
          } finally {
            if (isMounted) {
              clearGoogleIntentFromUrl();
              setProcessingGoogleLogin(false);
            }
          }
        }
      }

      if (clientInviteStatus === 'success' && clientInviteTransferId) {
        if (handledClientInviteTransferRef.current !== clientInviteTransferId) {
          handledClientInviteTransferRef.current = clientInviteTransferId;
          setProcessingClientInviteLogin(true);
          try {
            const transfer = await clientInvitesApi.getSessionResult(clientInviteTransferId);
            if (!isMounted) return;

            if (transfer.user && transfer.sessionToken) {
              await authSessionService.applyRoleRoomLogin(
                {
                  id: transfer.user.id,
                  email: transfer.user.email,
                  role: transfer.user.role,
                  display_name: transfer.user.display_name,
                  name: transfer.user.name,
                  loginAs: transfer.user.loginAs,
                  requestedRole: transfer.user.requestedRole ?? null,
                },
                transfer.sessionToken,
              );
              if (!isMounted) return;
              clearClientInviteIntentFromUrl();
              setIsAuthenticated(true);
              setProcessingClientInviteLogin(false);
              setAuthResolved(true);
              return;
            }
          } catch (error) {
            console.error('[CastingStandaloneApp] Failed to complete client invite redirect', error);
          } finally {
            if (isMounted) {
              clearClientInviteIntentFromUrl();
              setProcessingClientInviteLogin(false);
            }
          }
        }
      }

      setIsAuthenticated(!!session.adminUser);
      setAuthResolved(true);
    };

    void bootstrapAuthState();
    const handleUpdate = () => {
      const session = authSessionService.getSessionSync();
      setIsAuthenticated(!!session.adminUser);
      setAuthResolved(true);
    };
    window.addEventListener('auth-session-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('auth-session-updated', handleUpdate);
    };
  }, []);

  const handleReturnToLanding = useCallback(async () => {
    try {
      sessionStorage.removeItem('rrg');
    } catch {
      // Ignore session cleanup failures.
    }

    try {
      localStorage.removeItem('creatorhub_auth_user');
      localStorage.removeItem('creatorhub_auth_token');
    } catch {
      // Ignore storage cleanup failures.
    }

    await authSessionService.clearSession();

    setIsAuthenticated(false);
    setAuthResolved(true);
    setProcessingGoogleLogin(false);
    setProcessingClientInviteLogin(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('guest');
      url.searchParams.delete('bypass');
      url.searchParams.delete('rrGoogleStatus');
      url.searchParams.delete('rrGoogleTransfer');
      url.searchParams.delete('rrGoogleMode');
      url.searchParams.delete('rrGoogleMessage');
      url.searchParams.delete('rrGoogleTempToken');
      url.searchParams.delete('rrClientInviteStatus');
      url.searchParams.delete('rrClientInviteTransfer');
      url.searchParams.delete('rrClientInviteMessage');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const handleEnter = () => {
    // Reload the page to check authentication state
    window.location.reload();
  };

  const talentPortalIntent = useMemo(
    () => parseTalentPortalIntentFromWindow(),
    [],
  );
  const sessionAdminUser = authSessionService.getSessionSync().adminUser;
  const normalizedRole = String(sessionAdminUser?.role || '').trim().toLowerCase();
  const normalizedRequestedRole = String(sessionAdminUser?.requestedRole || '').trim().toLowerCase();
  const talentsAppPage = useMemo(() => parseTalentsAppPage(), []);
  const isInviteAcceptPath = useMemo(() => isPartnerInviteAcceptPath(), []);
  const isProposalAcceptPath = useMemo(() => isTalentProposalAcceptPath(), []);
  const shouldRenderTalentsApp = !guestMode && talentsAppPage !== null && !isInviteAcceptPath && !isProposalAcceptPath;
  const shouldRenderAgencyPortal = !guestMode && !shouldRenderTalentsApp && normalizedRole === 'agency';
  const shouldRenderTalentPortal = !guestMode && !shouldRenderTalentsApp && !shouldRenderAgencyPortal && (
    Boolean(talentPortalIntent)
    || normalizedRole === 'talent'
    || normalizedRequestedRole === 'talent'
  );

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
      {/*
        Super Admin-overlay: alltid-tilgjengelig kontroll for daniel@creatorhubn.com.
        Komponenten self-gater på email — andre brukere får null tilbake og
        ingen DOM-fotavtrykk. FAB er nederst-venstre (?-knapp er nederst-høyre i
        RoleRoomUXLayer, så de kolliderer ikke). Cmd/Ctrl + Shift + A toggler.
        URL ?super=1 eller /super-admin åpner overlayen direkte.
      */}
      <SuperAdminOverlay />

      {!authResolved || processingGoogleLogin || processingClientInviteLogin ? (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            color: 'rgba(255,255,255,0.84)',
            bgcolor: '#050816',
          }}
        >
          <CircularProgress size={30} sx={{ color: '#8b5cf6' }} />
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {processingGoogleLogin
              ? 'Fullfører Google-innlogging…'
              : processingClientInviteLogin
                ? 'Åpner klienttilgang…'
                : 'Laster Role Room…'}
          </Typography>
        </Box>
      ) : isInviteAcceptPath ? (
          <PartnerInviteAcceptPage />
        ) : isProposalAcceptPath ? (
          <TalentProposalAcceptPage />
        ) : !isAuthenticated ? (
          // 2026-06-07: theroleroom.com/ for unauth-brukere viser TheRoleRoom-
          // Landing (operativsystem-positionering per produktdok). Den gamle
          // CastingLandingPage er beholdt importert som backup; kan
          // gjeninnsettes hvis CMS-redigerbar landing trengs.
          <TheRoleRoomLanding onEnter={handleEnter} />
        ) : shouldRenderTalentsApp ? (
          <ToastProvider position="bottom-right">
            <TalentsApp initialPage={talentsAppPage ?? undefined} />
          </ToastProvider>
        ) : (
          <ToastProvider position="bottom-right">
            <RoleRoomUXLayer
              workspaceId={
                shouldRenderAgencyPortal
                  ? 'agency-portal-v1'
                  : shouldRenderTalentPortal
                    ? 'talent-portal-v1'
                    : 'casting-planner-v1'
              }
              mode={getActiveProfessionMode()}
              onSwitchMode={(newMode) => {
                const url = new URL(window.location.href);
                url.searchParams.set('mode', newMode);
                window.location.href = url.toString();
              }}
              supportEmail="support@theroleroom.com"
              whatsNewMode={getActiveProfessionMode()}
              whatsNewTitle="Hva er nytt i The Role Room"
              tourSteps={
                shouldRenderTalentPortal
                  ? [
                      {
                        title: 'Velkommen til Talentportalen',
                        body: 'Her bygger du din profil og søker på casting-roller. Vi viser deg det viktigste først.',
                        icon: <WelcomeIcon />,
                      },
                      {
                        title: 'Søk overalt med Cmd+K',
                        body: 'Trykk ⌘K for å hoppe direkte til en seksjon — profil, audition, kalender.',
                        icon: <SearchTourIcon />,
                      },
                      {
                        title: 'Hjelp er alltid synlig',
                        body: '?-knappen nederst-høyre har snarveier og support. Trykk ? for å åpne.',
                        icon: <HelpTourIcon />,
                      },
                    ]
                  : [
                      {
                        title: 'Velkommen til Casting Planner',
                        body: 'Her organiserer du roller, kandidater og audition-prosesser. Vi tar deg gjennom 3 viktige snarveier.',
                        icon: <CastingIcon />,
                      },
                      {
                        title: 'Søk overalt med Cmd+K',
                        body: 'Trykk ⌘K for å finne roller, kandidater eller audition-runder direkte.',
                        icon: <SearchTourIcon />,
                      },
                      {
                        title: 'Hjelp er alltid synlig',
                        body: '?-knappen nederst-høyre har snarveier og support. Trykk ? for å åpne.',
                        icon: <HelpTourIcon />,
                      },
                    ]
              }
            >
              {shouldRenderAgencyPortal ? (
                <AgencyPortalView
                  onClose={() => {
                    void handleReturnToLanding();
                  }}
                />
              ) : shouldRenderTalentPortal ? (
                <TalentPortalView
                  intent={talentPortalIntent}
                  onClose={() => {
                    void handleReturnToLanding();
                  }}
                />
              ) : (
                <CastingPlannerPanel
                  onClose={() => {
                    void handleReturnToLanding();
                  }}
                  isFullscreen={true}
                  onToggleFullscreen={() => {
                    // Not applicable in standalone mode - already fullscreen
                    console.log('Fullscreen toggle not available in standalone mode');
                  }}
                  isStandalone={true}
                  isGuestMode={false}
                />
              )}
            </RoleRoomUXLayer>
          </ToastProvider>
        )}
    </Box>
  );
}

export default function CastingStandaloneApp() {
  useEffect(() => {
    try {
      localStorage.setItem('casting-theme-mode', 'dark');
    } catch {
      // Ignore storage persistence failures.
    }
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = 'dark';
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.title = ROLE_ROOM_DOCUMENT_TITLE;
    upsertHeadLink('icon', ROLE_ROOM_FAVICON_URL);
    upsertHeadLink('shortcut icon', ROLE_ROOM_FAVICON_URL);
    upsertHeadLink('apple-touch-icon', ROLE_ROOM_FAVICON_URL);
  }, []);

  const muiTheme = useMemo(() => createTheme({
    palette: { mode: 'dark', primary: { main: '#1976d2' }, secondary: { main: '#dc004e' } },
    shape: { borderRadius: 8 },
  }), []);

  return (
    <QueryClientProvider client={castingQueryClient}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        <AuthProvider>
          <EnhancedMasterIntegrationProvider>
            <CastingStandaloneAppContent />
          </EnhancedMasterIntegrationProvider>
        </AuthProvider>
      </MuiThemeProvider>
    </QueryClientProvider>
  );
}

const container = document.getElementById('casting-root');
if (container) {
  const root = createRoot(container);
  root.render(<CastingStandaloneApp />);
}
