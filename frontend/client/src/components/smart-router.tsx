import { useTheming } from '../utils/theming-helper';
import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from "react";
import { useLocation } from "wouter";

interface SmartRouterProps { 
  children: React.ReactNode; 
}

export default function SmartRouter({ children }: SmartRouterProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  // Database connection for SmartRouter
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateSmartRouter = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/component/update', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  }
});

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [authChangedTrigger, setAuthChangedTrigger] = React.useState(0);

  // Listen for 'auth-changed' event from LoginModal
  useEffect(() => {
    const handleAuthChanged = () => {
      console.log('🔔 Auth changed event received in SmartRouter');
      setAuthChangedTrigger(prev => prev + 1);
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-changed', handleAuthChanged);
  }, []);

  useEffect(() => { // Only run after loading is complete
    if (authLoading) return;

    // If user is authenticated and on landing page, check for stored role or user type
    if (isAuthenticated && user && location === "/") {
      // Check for stored role preference from OAuth flow (server-first)
      (async () => {
        try {
          const r = await fetch('/api/user/kv/selectedRole', { credentials: 'include' });
          const j = r.ok ? await r.json().catch(() => null) : null;
          const serverRole = j && typeof j === 'object' && 'value' in j ? j.value : (j?.data ?? j);
          const storedRole = serverRole ?? localStorage.getItem('selectedRole');

          if (storedRole) {
            console.log('Redirecting authenticated user to dashboard based on stored role: ', storedRole);
            // Clean up both locations
            fetch('/api/user/kv', {
              method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
              body: JSON.stringify({ key: 'selectedRole', value: null })
            }).catch(() => {});
            localStorage.removeItem('selectedRole');
            navigateToDashboard(storedRole);
            return;
          }
        } catch {}

        // Check user preference for auto-redirect
        const checkAutoRedirect = async () => {
          try {
            // Check server preference first
            const prefResponse = await fetch('/api/user/ui-preferences', { credentials: 'include' });
            let autoRedirect = false;

            if (prefResponse.ok) {
              const prefData = await prefResponse.json();
              autoRedirect = prefData.autoRedirectToDashboard ?? false;
            }

            // Fallback to localStorage
            if (!autoRedirect) {
              const localPref = localStorage.getItem('autoRedirectToDashboard');
              autoRedirect = localPref === 'true';
            }

            return autoRedirect;
          } catch {
            // Fallback to localStorage on error
            return localStorage.getItem('autoRedirectToDashboard') === 'true';
          }
        };

        if ((user as any).userType && (user as any).userType !== "guest") {
          const shouldAutoRedirect = await checkAutoRedirect();

          if (shouldAutoRedirect) {
            console.log('🔄 Auto-redirecting authenticated user to dashboard based on user type: ', (user as any).userType);
            navigateToDashboard((user as any).userType);
          } else {
            console.log('⏸️ Auto-redirect disabled - user stays on landing page');
          }
        }
      })();
    }
  }
}, [isAuthenticated, authLoading, user, location, navigate, authChangedTrigger]);

  const navigateToDashboard = (userType: string) => { 
    const dashboardMap: { [key: string]: string } = { 
      couple: "/couple-dashboard",
      photographer: "/photographer-dashboard", 
      videographer: "/videographer-dashboard",
      music_producer: "/music-producer-dashboard",
      partner: "/partner-dashboard",
      admin: "/admin-dashboard" 
};
    const dashboardUrl = dashboardMap[userType] ||"/photographer-dashboard";
    navigate(dashboardUrl);
};
  return <>{children}</>;
}