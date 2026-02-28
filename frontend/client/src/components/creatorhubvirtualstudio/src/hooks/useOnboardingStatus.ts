import { useState, useEffect } from 'react';

interface OnboardingPreferences {
  autoSave: boolean;
  cloudSync: boolean;
  analytics: boolean;
  completedAt: string;
}

export const useOnboardingStatus = () => {
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Server-first load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/kv/virtualStudio_onboardingCompleted', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (mounted) setIsCompleted(v === 'true' || v === true);
      } catch {
        const completed = localStorage.getItem('virtualStudio_onboardingCompleted');
        if (mounted) setIsCompleted(completed === 'true');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [preferences, setPreferences] = useState<OnboardingPreferences | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/kv/virtualStudio_preferences', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (mounted && v) setPreferences(v as OnboardingPreferences);
      } catch {
        const stored = localStorage.getItem('virtualStudio_preferences');
        if (mounted && stored) setPreferences(JSON.parse(stored));
      }
    })();
    return () => { mounted = false; };
  }, []);

  const markComplete = () => {
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'virtualStudio_onboardingCompleted', value: 'true' })
    }).catch(() => {});
    localStorage.setItem('virtualStudio_onboardingCompleted', 'true');
    setIsCompleted(true);
  };

  const resetOnboarding = () => {
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'virtualStudio_onboardingCompleted', value: 'false' })
    }).catch(() => {});
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'virtualStudio_preferences', value: null })
    }).catch(() => {});
    localStorage.removeItem('virtualStudio_onboardingCompleted');
    localStorage.removeItem('virtualStudio_preferences');
    setIsCompleted(false);
    setPreferences(null);
  };

  const updatePreferences = (newPreferences: Partial<OnboardingPreferences>) => {
    const updated = {
      ...preferences,
      ...newPreferences,
    } as OnboardingPreferences;

    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'virtualStudio_preferences', value: updated })
    }).catch(() => {});
    localStorage.setItem('virtualStudio_preferences', JSON.stringify(updated));
    setPreferences(updated);
  };

  // Listen for changes to localStorage from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'virtualStudio_onboardingCompleted') {
        setIsCompleted(e.newValue === 'true');
      } else if (e.key ==='virtualStudio_preferences' && e.newValue) {
        setPreferences(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    isCompleted,
    preferences,
    markComplete,
    resetOnboarding,
    updatePreferences,
  };
};
