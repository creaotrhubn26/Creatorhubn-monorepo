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

  // Query for session status
  const {
    data: sessionData,
    isLoading,
    refetch,
} = useQuery({
    queryKey: ['/api/auth/session-status'],
    queryFn: async () => {
      const response = await fetch('/api/auth/session-status');
      if (!response.ok) {
        if (response.status === 401) {
          return { authenticated: false, expiry: null };
      }
        throw new Error('Failed to fetch session status');
    }
      return response.json();
  },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 30, // Check every 30 seconds
    refetchOnWindowFocus: true,
});

  const isAuthenticated = sessionData?.authenticated || false;
  const sessionExpiry = sessionData?.expiry || null;

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
    try {
      const response = await fetch('/api/auth/renew-session', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
    });

      if (response.ok) {
        await refetch();
        setSessionWarning({ show: false, timeRemaining: 0, warningTime: 0 });
        return true;
    }
      return false;
  } catch (error) {
      console.error('Session renewal failed: ', error);
      return false;
  }
}, [refetch]);

  const extendSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/extend-session', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
    });

      if (response.ok) {
        await refetch();
        setSessionWarning({ show: false, timeRemaining: 0, warningTime: 0 });

        // Show success notification
        console.log('✅ Session extended successfully');
        return true;
    }
      return false;
  } catch (error) {
      console.error('Session extension failed:', error);
      return false;
  }
}, [refetch]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      queryClient.clear();
      setSessionWarning({ show: false, timeRemaining: 0, warningTime: 0 });

      // Redirect to login or home page
      window.location.href = '/';
  } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect even if logout API fails
      window.location.href ='/';
  }
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
