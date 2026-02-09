import { useTheming } from '../../utils/theming-helper';
import React, { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UniversalChatWidget from './UniversalChatWidget';
import { CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';

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
  const { user, isAuthenticated } = useAuth();

  // Determine profession based on user data or default to photographer
  const userProfession = useMemo(() => {
    if (!user) return 'photographer';
    // Check for profession field on user object
    const userRecord = user as Record<string, unknown>;
    if (typeof userRecord.profession === 'string' && userRecord.profession) {
      return userRecord.profession;
    }
    // Admin users default to photographer
    if (user.isAdmin) return 'photographer';
    return 'photographer';
  }, [user]);

  // Theming system — driven by the resolved profession
  const theming = useTheming(userProfession);

  // Notification handler using themed branding
  const handleNotificationCreate = useCallback(
    (notification: Record<string, unknown>) => {
      const professionBranding = theming.getProfessionBranding(userProfession);
      console.log(
        `[${professionBranding.label}] Chat notification:`,
        notification
      );
    },
    [theming, userProfession]
  );

  // Don't render chat widget if user is not authenticated
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  // Build themed container styles using theming colors
  const chatContainerStyle: React.CSSProperties = {
    // Apply a subtle profession-colored glow to the chat widget area
    ['--chat-accent' as string]: theming.colors.primary,
    ['--chat-accent-light' as string]: `${theming.colors.primary}18`,
  };

  return (
    <>
      {children}

      {/* Global Chat Widget - Available on all pages, themed per profession */}
      <div style={chatContainerStyle}>
        <CommunicationStatusProvider>
          <UniversalChatWidget
            profession={userProfession}
            userEmail={user.email}
            userId={user.id}
            isOpen={false}
            onNotificationCreate={handleNotificationCreate}
          />
        </CommunicationStatusProvider>
      </div>
    </>
  );
}


