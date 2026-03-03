import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

interface SmartRouterProps {
  children: React.ReactNode;
}

type DashboardRole =
  | 'couple'
  | 'photographer'
  | 'videographer'
  | 'music_producer'
  | 'partner'
  | 'admin'
  | 'vendor'
  | 'enterprise';

const DASHBOARD_MAP: Record<DashboardRole, string> = {
  couple: '/couple-dashboard',
  photographer: '/photographer-dashboard',
  videographer: '/videographer-dashboard',
  music_producer: '/music-producer-dashboard',
  partner: '/partner-dashboard',
  admin: '/admin-dashboard',
  vendor: '/vendor-dashboard',
  enterprise: '/admin-dashboard',
};

function normalizeRole(value: unknown): DashboardRole | null {
  if (typeof value !== 'string') {
    return null;
  }
  const role = value.trim().toLowerCase().replace(/-/g, '_');
  if (role in DASHBOARD_MAP) {
    return role as DashboardRole;
  }
  return null;
}

async function readServerSelectedRole(): Promise<DashboardRole | null> {
  try {
    const response = await fetch('/api/user/kv/selectedRole', { credentials: 'include' });
    if (!response.ok) {
      return null;
    }
    const payload: unknown = await response.json();
    if (typeof payload === 'string') {
      return normalizeRole(payload);
    }
    if (typeof payload === 'object' && payload !== null) {
      const container = payload as { value?: unknown; data?: unknown };
      return normalizeRole(container.value ?? container.data);
    }
  } catch {
    // Ignore read errors.
  }
  return null;
}

async function clearServerSelectedRole(): Promise<void> {
  try {
    await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: 'selectedRole', value: null }),
    });
  } catch {
    // Best-effort cleanup only.
  }
}

async function shouldAutoRedirectToDashboard(): Promise<boolean> {
  try {
    const response = await fetch('/api/user/ui-preferences', { credentials: 'include' });
    if (response.ok) {
      const payload: unknown = await response.json();
      if (typeof payload === 'object' && payload !== null) {
        const candidate = payload as { autoRedirectToDashboard?: unknown };
        if (typeof candidate.autoRedirectToDashboard === 'boolean') {
          return candidate.autoRedirectToDashboard;
        }
      }
    }
  } catch {
    // Fallback to local preference below.
  }
  return localStorage.getItem('autoRedirectToDashboard') === 'true';
}

function getUserRole(user: unknown): DashboardRole | null {
  if (typeof user !== 'object' || user === null) {
    return null;
  }
  const candidate = user as { userType?: unknown; role?: unknown; profession?: unknown };
  return (
    normalizeRole(candidate.userType) ??
    normalizeRole(candidate.role) ??
    normalizeRole(candidate.profession)
  );
}

export default function SmartRouter({ children }: SmartRouterProps) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [authChangeTrigger, setAuthChangeTrigger] = useState(0);

  const resolvedUserRole = useMemo(() => getUserRole(user), [user]);

  useEffect(() => {
    const handleAuthChanged = () => setAuthChangeTrigger((prev) => prev + 1);
    window.addEventListener('auth-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-changed', handleAuthChanged);
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated || !user || location !== '/') {
      return;
    }

    let cancelled = false;
    const runRedirect = async () => {
      const serverRole = await readServerSelectedRole();
      const localRole = normalizeRole(localStorage.getItem('selectedRole'));
      const selectedRole = serverRole ?? localRole;

      if (selectedRole) {
        await clearServerSelectedRole();
        localStorage.removeItem('selectedRole');
        if (!cancelled) {
          navigate(DASHBOARD_MAP[selectedRole]);
        }
        return;
      }

      const autoRedirect = await shouldAutoRedirectToDashboard();
      if (!autoRedirect || cancelled || !resolvedUserRole) {
        return;
      }

      navigate(DASHBOARD_MAP[resolvedUserRole]);
    };

    void runRedirect();
    return () => {
      cancelled = true;
    };
  }, [authChangeTrigger, isAuthenticated, isLoading, location, navigate, resolvedUserRole, user]);

  return <>{children}</>;
}

