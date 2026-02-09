import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import UniversalChatWidget from './UniversalChatWidget';
import { CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';

interface GlobalChatProviderProps {
  children: React.ReactNode
}

/**
 * GlobalChatProvider - Makes chat widget available on all pages when user is logged in
 * 
 * Features: * - Only renders when user is authenticated
 * - Provides chat widget with user context
 * - Positioned as floating widget that doesn't interfere with page content
 * - Includes ticket creation functionality
 * - Maintains chat state across page navigation
 */
export default function GlobalChatProvider({ children }: GlobalChatProviderProps) {
  const { user, isAuthenticated } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');

  // Don't render chat widget if user is not authenticated
  if (!isAuthenticated || !user) {
    return <>{children}</>;
}

  // Determine profession based on user data or default to photographer
  const getUserProfession = () => {
    // If user has a profession field, use it
    if ((user as any)?.profession) {
      return (user as any).profession;
  }
    
    // Default profession based on user type or email domain
    if (user.isAdmin) {
      return 'photographer'; // Admin users default to photographer
  }
    
    // You could add logic here to determine profession based on: // - User preferences
    // - Email domain
    // - Previous activity
    // - User settings
    
    return'photographer'; // Default fallback
};

  return (
    <>
      {children}
      
      {/* Global Chat Widget - Available on all pages */}
      <CommunicationStatusProvider>
        <UniversalChatWidget 
          profession={getUserProfession()}
          userEmail={user.email}
          userId={user.id}
          isOpen={false} // Start closed, user can open it
          // Additional props for global context
          onNotificationCreate={(notification) => {
            console.log('Global chat notification created:', notification);
            // You could integrate with a global notification system here
        }}
        />
      </CommunicationStatusProvider>
    </>
  );
}


