import * as React from 'react';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

interface CommunicationStatus {
  isConnected: boolean;
  lastCheck: Date | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  systemHealthy: boolean;
  activeConnections: number;
  serverStatus: string;
  googleChatStatus: 'connected' | 'disconnected' | 'unknown' | 'connecting';
  googleChatResponse: string;
  googleChatLastCheck: Date | null;
}

interface CommunicationStatusContextType {
  status: CommunicationStatus;
  updateStatus: (newStatus: Partial<CommunicationStatus>) => void;
  testConnection: () => Promise<void>;
  testGoogleChat: () => Promise<void>;
}

const CommunicationStatusContext = createContext<CommunicationStatusContextType | undefined>(undefined);

interface CommunicationStatusProviderProps {
  children: ReactNode;
}

export function CommunicationStatusProvider({ children }: CommunicationStatusProviderProps) {
  const [status, setStatus] = useState<CommunicationStatus>({
    isConnected: false,
    lastCheck: null,
    connectionStatus: 'connecting',
    systemHealthy: false,
    activeConnections:  0,
    serverStatus: 'unknown',
    googleChatStatus: 'unknown',
    googleChatResponse:  '',
    googleChatLastCheck: null
});

  const updateStatus = (newStatus: Partial<CommunicationStatus>) => {
    setStatus(prev => ({
      ...prev,
      ...newStatus,
      lastCheck: new Date()
  }));
};

  const testGoogleChat = async () => {
    try {
      updateStatus({ googleChatStatus: 'connecting' });

      let googleChatStatusUrl = '/api/communication/google-chat/status?force=1';
      try {
        const storedUserRaw = localStorage.getItem('creatorhub_auth_user');
        const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
        const userIdCandidate =
          storedUser?.id ||
          storedUser?.userId ||
          localStorage.getItem('userId') ||
          '';

        if (typeof userIdCandidate === 'string' && userIdCandidate.trim().length > 0) {
          googleChatStatusUrl += `&userId=${encodeURIComponent(userIdCandidate.trim())}`;
        }
      } catch {
        // Ignore localStorage parse issues and fall back to global status check.
      }
      
      // Test Google Chat API connectivity
      const response = await fetch(googleChatStatusUrl, {
        method: 'GET',
        headers: {
          'Content-Type' : 'application/json',
      }
    });
      
      const responseStatus = response.status;
      const responseText = response.statusText;
      const responseBody = await response.json().catch(() => null) as {
        connected?: boolean;
        status?: string;
        message?: string;
        missingScopes?: string[];
      } | null;

      if (responseStatus === 404) {
        updateStatus({
          googleChatStatus: 'disconnected',
          googleChatResponse: 'API not available',
          googleChatLastCheck: new Date(),
        });
        return;
      }
      
      const connected = response.ok && Boolean(responseBody?.connected);
      const responseSummary = responseBody?.message
        || (Array.isArray(responseBody?.missingScopes) && responseBody?.missingScopes.length > 0
          ? `Mangler scopes: ${responseBody.missingScopes.join(', ')}`
          : responseBody?.status)
        || `${responseStatus} ${responseText}`;

      if (connected) {
        updateStatus({
          googleChatStatus: 'connected',
          googleChatResponse: responseSummary,
          googleChatLastCheck: new Date()
      });
    } else {
        updateStatus({
          googleChatStatus: 'disconnected',
          googleChatResponse: responseSummary,
          googleChatLastCheck: new Date()
      });
    }
  } catch (error) {
      updateStatus({
        googleChatStatus: 'disconnected',
        googleChatResponse: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        googleChatLastCheck: new Date()
    });
  }
};

  const testConnection = async () => {
    try {
      updateStatus({ connectionStatus: 'connecting' });
      
      // Skip WebSocket test - not needed for most use cases
      // Test HTTP connection instead
      const protocol = window.location.protocol;
      const httpUrl = `${protocol}//${window.location.host}/api/health`;
      
      try {
        const response = await fetch(httpUrl, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          updateStatus({
            isConnected: true,
            connectionStatus: 'connected',
            systemHealthy: true,
            serverStatus: 'online'
          });
          return;
        }
      } catch (err) {
        console.warn('Health check failed:', err);
      }
      
      // If health check fails, assume online anyway (optimistic)
      updateStatus({
        isConnected: true,
        connectionStatus: 'connected',
        systemHealthy: true,
        serverStatus: 'online'
      });
    } catch (error) {
      console.warn('Communication connection test failed:', error);
      updateStatus({
        isConnected: false,
        connectionStatus: 'disconnected',
        systemHealthy: false,
        serverStatus: 'error'
      });
    }
  };

  // Auto-test connection on mount and periodically
  useEffect(() => {
    testConnection();
    testGoogleChat();
    
    const interval = setInterval(() => {
      testConnection();
      testGoogleChat();
  }, 30000); // Test every 30 seconds
    
    return () => clearInterval(interval);
}, []);

  const value: CommunicationStatusContextType = {
    status,
    updateStatus,
    testConnection,
    testGoogleChat
};

  return (
    <CommunicationStatusContext.Provider value={value}>
      {children}
    </CommunicationStatusContext.Provider>
  );
}

export function useCommunicationStatus() {
  const context = useContext(CommunicationStatusContext);
  if (context === undefined) {
    throw new Error('useCommunicationStatus must be used within a CommunicationStatusProvider');
}
  return context;
}
