import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import SupportChatButton from './SupportChatButton';

interface GlobalChatProviderProps {
  children: React.ReactNode
}

/**
 * GlobalChatProvider - Makes chat widget available on all pages when user is logged in
 * 
 * Features:
 * - Only renders when user is authenticated
 * - Provides chat widget with user context
 * - Positioned as floating widget that doesn't interfere with page content
 * - Applies profession-based theming to the widget container
 * - Includes ticket creation functionality
 * - Maintains chat state across page navigation
 */
export default function GlobalChatProvider({ children }: GlobalChatProviderProps) {
  const [location] = useLocation();
  const { user, isAuthenticated, isAdmin } = useAuth();

  // Skjul support-knappen på: / + admin/workspace/dashboards/andre produkter/offentlige flater.
  // Interne redigeringsflater (admin-room, visual-cms-admin, visual-editor-enhanced, evendi,
  // no-code-editoren) er også med — der dukket widgeten opp oppå editor-UI-et (PR #1298).
  const shouldHide = useMemo(() => {
    if (location === '/') return true;
    return /^\/(?:workspace|admin|admin-room|admin-workspace|visual-cms-admin|visual-editor-enhanced|evendi|dashboard|photographer-dashboard-material|videographer-dashboard(?:-material)?|music(?:_|-)producer-dashboard(?:-material)?|vendor-dashboard(?:-material)?|partner|partner-portal|for-byr|privacy-policy|terms-and-conditions|creatorhub-innovasjon|pitch|faq|community|leadgrid|nextrole|showcase|photo-showcase|video-showcase|audio-review|role-room|casting|talents|theroleroom)(?:\/|$)/.test(location);
  }, [location]);

  // Ikke vis for uautentiserte brukere eller admins
  if (!isAuthenticated || !user || isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {!shouldHide && <SupportChatButton />}
    </>
  );
}
