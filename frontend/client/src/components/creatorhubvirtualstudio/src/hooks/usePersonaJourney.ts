import { useState, useEffect } from 'react';

export interface PersonaPreferences {
  autoSave: boolean;
  cloudSync: boolean;
  analytics: boolean;
  persona: 'photographer' | 'videographer' | null;
  completedAt: string;
}

export const usePersonaJourney = () => {
  const [preferences, setPreferences] = useState<PersonaPreferences | null>(null);
  const [showJourney, setShowJourney] = useState(false);

  useEffect(() => {
    // Check if user completed onboarding
    const onboardingCompleted = localStorage.getItem('virtualStudio_onboardingCompleted');
    const prefsString = localStorage.getItem('virtualStudio_preferences');

    if (onboardingCompleted === 'true' && prefsString) {
      const prefs = JSON.parse(prefsString) as PersonaPreferences;
      setPreferences(prefs);

      // Check if they've seen the journey
      const journeySeen = localStorage.getItem('virtualStudio_journeySeen');
      if (!journeySeen && prefs.persona) {
        setShowJourney(true);
      }
    }
  }, []);

  const markJourneySeen = () => {
    localStorage.setItem('virtualStudio_journeySeen', 'true');
    setShowJourney(false);
  };

  const resetJourney = () => {
    localStorage.removeItem('virtualStudio_journeySeen');
    setShowJourney(true);
  };

  return {
    preferences,
    showJourney,
    markJourneySeen,
    resetJourney,
    hasPersona: preferences?.persona != null,
  };
};
