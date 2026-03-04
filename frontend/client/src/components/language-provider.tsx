import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'no' | 'en';

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
}

const STORAGE_KEY = 'creatorhub_language';
const DEFAULT_LANGUAGE: AppLanguage = 'no';

const normalizeLanguage = (value: string | null | undefined): AppLanguage => {
  if (!value) return DEFAULT_LANGUAGE;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'no' || normalized.startsWith('no-') || normalized.startsWith('nb') || normalized.startsWith('nn')) {
    return 'no';
  }
  return DEFAULT_LANGUAGE;
};

const getInitialLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    // Ignore localStorage read errors.
  }

  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return normalizeLanguage(navigator.language);
  }

  return DEFAULT_LANGUAGE;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, language);
      } catch {
        // Ignore localStorage write errors.
      }
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'no' ? 'nb-NO' : 'en-US';
      document.documentElement.setAttribute('data-language', language);
    }
  }, [language]);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(normalizeLanguage(nextLanguage));
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
