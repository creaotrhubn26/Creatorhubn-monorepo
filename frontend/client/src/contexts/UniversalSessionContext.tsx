import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SessionWarning {
  show: boolean;
  timeRemaining: number; // seconds
  warningTime: number; // when warning was shown
}

interface UniversalSessionContextType {
  isAuthenticated: boolean;
  sessionExpiry: number | null;
  sessionWarning: SessionWarning;
  timeUntilExpiry: number;
  renewSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  dismissWarning: () => void;
  extendSession: () => Promise<boolean>;
}

const UniversalSessionContext = createContext<UniversalSessionContextType | undefined>(undefined);

export function UniversalSessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionWarning, setSessionWarning] = useState<SessionWarning>({
    show: false,
    timeRemaining: 0,
    warningTime: 0,
});
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number>(0);

  // Query for session status - DISABLED: Auto-authenticated
  // Authentication disabled - use mock data
  const sessionData = {
    authenticated: true,
    expiry: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 24 hours from now
  };
  const isLoading = false;
  const refetch = async () => ({ data: sessionData });

  const isAuthenticated = true;
  const sessionExpiry = sessionData.expiry;

  // Calculate time until expiry and show warnings
  useEffect(() => {
    if (!sessionExpiry || !isAuthenticated) {
      setTimeUntilExpiry(0);
      setSessionWarning({ show: false, timeRemaining: 0, warningTime: 0 });
      return;
  }

    const interval = setInterval(() => {
      const now = Date.now();
      const expiry = new Date(sessionExpiry).getTime();
      const remaining = Math.max(0, expiry - now);
      const remainingSeconds = Math.floor(remaining / 1000);

      setTimeUntilExpiry(remainingSeconds);

      // Show warning 30 minutes (1800 seconds) before expiry
      const warningThreshold = 30 * 60; // 30 minutes
      const shouldShowWarning = remainingSeconds <= warningThreshold && remainingSeconds > 0;

      if (shouldShowWarning && !sessionWarning.show) {
        setSessionWarning({
          show: true,
          timeRemaining: remainingSeconds,
          warningTime: now,
      });
    }

      // Auto-logout if session expired
      if (remainingSeconds <= 0 && isAuthenticated) {
        logout();
    }
  }, 1000);

    return () => clearInterval(interval);
}, [sessionExpiry, isAuthenticated, sessionWarning.show]);

  const renewSession = useCallback(async (): Promise<boolean> => {
    // Authentication disabled - session renewal not needed
    setSessionWarning({ show: false, timeRemaining: 0, warningTime: 0 });
    return true;
  }, []);

  const extendSession = useCallback(async (): Promise<boolean> => {
    // Authentication disabled - session extension not needed
    setSessionWarning({ show: false, timeRemaining: 0, warningTime: 0 });
    console.log('✅ Session extended successfully');
    return true;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // Authentication disabled - logout not needed
    queryClient.clear();
    setSessionWarning({ show: false, timeRemaining: 0, warningTime: 0 });
    window.location.href = '/';
  }, [queryClient]);

  const dismissWarning = useCallback(() => {
    setSessionWarning((prev) => ({ ...prev, show: false }));
}, []);

  const contextValue: UniversalSessionContextType = {
    isAuthenticated,
    sessionExpiry,
    sessionWarning,
    timeUntilExpiry,
    renewSession,
    logout,
    dismissWarning,
    extendSession,
};

  return (
    <UniversalSessionContext.Provider value={contextValue}>
      {children}
    </UniversalSessionContext.Provider>
  );
}

export function useUniversalSession() {
  const context = useContext(UniversalSessionContext);
  if (context === undefined) {
    throw new Error('useUniversalSession must be used within a UniversalSessionProvider');
}
  return context;
}
