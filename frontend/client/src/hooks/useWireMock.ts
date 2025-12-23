import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { WireMockTestRunner } from '../utils/wireMockTestRunner';

export interface MockEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  responseStatus: number;
  responseBody: any;
  responseHeaders?: Record<string, string>;
  delay?: number;
  isActive: boolean;
  service: string;
  usageCount: number;
  createdAt: Date;
}

export interface WireMockStatus {
  isEnabled: boolean;
  currentMode: 'production' | 'mock';
  totalEndpoints: number;
  activeEndpoints: number;
  mockServices: string[];
}

export function useWireMock() {
  const [status, setStatus] = useState<WireMockStatus | null>(null);
  const [endpoints, setEndpoints] = useState<MockEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch WireMock status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/wiremock/status');
      if (!response.ok) throw new Error('Failed to fetch WireMock status');
      const data = await response.json();
      setStatus(data);
  } catch (error) {
      console.error('Error fetching WireMock status: ', error);
      toast({
        title: 'WireMock Status Error',
        description: 'Kunne ikke hente WireMock-status',
        variant: 'destructive',
    });
  }
};

  // Fetch all endpoints
  const fetchEndpoints = async () => {
    try {
      const response = await fetch('/api/wiremock/endpoints');
      if (!response.ok) throw new Error('Failed to fetch endpoints');
      const data = await response.json();
      setEndpoints(data.endpoints || []);
  } catch (error) {
      console.error('Error fetching endpoints:', error);
  }
};

  // Enable/disable WireMock
  const toggleWireMock = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/wiremock/toggle', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ enabled }),
    });

      if (!response.ok) throw new Error('Failed to toggle WireMock');

      const data = await response.json();
      setStatus(data.status);

      toast({
        title: enabled ? 'WireMock Aktivert' : 'WireMock Deaktivert',
        description: enabled
          ? 'Mock-tjenester er nå aktive for testing'
          : 'Produksjonsmodus er aktivert',
        variant: enabled ? 'default' : 'destructive',
    });
  } catch (error) {
      console.error('Error toggling WireMock:', error);
      toast({
        title: 'WireMock Toggle Error',
        description: 'Kunne ikke endre WireMock-status',
        variant: 'destructive',
    });
  } finally {
      setIsLoading(false);
  }
};

  // Switch between production and mock mode
  const switchMode = async (mode: 'production' | 'mock') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/wiremock/mode', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ mode }),
    });

      if (!response.ok) throw new Error('Failed to switch mode');

      const data = await response.json();
      setStatus(data.status);

      toast({
        title: `Modus Endret til ${mode === 'mock' ? 'Mock' : 'Produksjon'}`,
        description: mode === 'mock'
            ? 'Alle API-kall bruker nå mock-data'
            : 'Alle API-kall bruker nå ekte tjenester',
        variant: mode === 'mock' ? 'default' : 'destructive',
    });
  } catch (error) {
      console.error('Error switching mode:', error);
      toast({
        title: 'Mode Switch Error',
        description: 'Kunne ikke endre modus',
        variant: 'destructive',
    });
  } finally {
      setIsLoading(false);
  }
};

  // Toggle specific endpoint
  const toggleEndpoint = async (endpointId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/wiremock/endpoints/${endpointId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ isActive }),
    });

      if (!response.ok) throw new Error('Failed to toggle endpoint');

      // Update local state
      setEndpoints((prev) => prev.map((ep) => (ep.id === endpointId ? { ...ep, isActive } : ep)));

      toast({
        title: `Endpoint ${isActive ? 'Aktivert' : 'Deaktivert'}`,
        description: `Mock-endpoint er nå ${isActive ? 'aktiv' : 'inaktiv'}`,
        variant: 'default',
    });
  } catch (error) {
      console.error('Error toggling endpoint:', error);
      toast({
        title: 'Endpoint Toggle Error',
        description: 'Kunne ikke endre endpoint-status',
        variant: 'destructive',
    });
  }
};

  // Test endpoint - Enhanced with WireMockTestRunner
  const testEndpoint = async (endpoint: MockEndpoint) => {
    try {
      // Use enhanced WireMockTestRunner for automatic HAR recording and self-healing
      const result = await WireMockTestRunner.executeTest({
        apiName: endpoint.name,
        endpoint: '/api/wiremock/test',
        method: 'POST',
        body: {
          method: endpoint.method,
          url: endpoint.url,
          endpointId: endpoint.id,
        },
        recordToHAR: true,           // ✅ Automatic HAR recording
        enableSelfHealing: true      // ✅ Automatic self-healing
      });

      toast({
        title: result.success ? '✅ Endpoint Test' : '❌ Endpoint Test',
        description: `${endpoint.name}: ${result.success ? 'Vellykket' : 'Feilet'} (${result.responseTime}ms)`,
        variant: result.success ? 'default' : 'destructive',
      });

      return result;
    } catch (error) {
      console.error('Error testing endpoint:', error);
      toast({
        title: 'Test Error',
        description: 'Kunne ikke teste endpoint',
        variant: 'destructive',
      });
      return { success: false, error: (error as Error).message };
    }
  };

  // Create custom endpoint
  const createEndpoint = async (endpointData: Partial<MockEndpoint>) => {
    try {
      const response = await fetch('/api/wiremock/endpoints', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(endpointData),
    });

      if (!response.ok) throw new Error('Failed to create endpoint');

      const data = await response.json();
      setEndpoints((prev) => [...prev, data.endpoint]);

      toast({
        title: 'Endpoint Opprettet',
        description: `Nytt mock-endpoint: ${endpointData.name}`,
        variant: 'default',
    });

      return data.endpoint;
  } catch (error) {
      console.error('Error creating endpoint:', error);
      toast({
        title: 'Create Error',
        description: 'Kunne ikke opprette endpoint',
        variant:'destructive',
    });
      return null;
  }
};

  // Initialize data
  useEffect(() => {
    fetchStatus();
    fetchEndpoints();
}, []);

  return {
    status,
    endpoints,
    isLoading,
    toggleWireMock,
    switchMode,
    toggleEndpoint,
    testEndpoint,
    createEndpoint,
    refresh: () => {
      fetchStatus();
      fetchEndpoints();
  },
};
}
