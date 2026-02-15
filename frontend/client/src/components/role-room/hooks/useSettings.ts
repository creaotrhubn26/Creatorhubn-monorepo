import { useState, useCallback } from 'react';

export interface Settings {
  theme: 'dark' | 'light';
  language: 'nb' | 'en';
  currency: 'NOK' | 'USD' | 'EUR';
  dateFormat: 'dd.MM.yyyy' | 'MM/dd/yyyy';
  notifications: boolean;
}

const defaultSettings: Settings = {
  theme: 'dark',
  language: 'nb',
  currency: 'NOK',
  dateFormat: 'dd.MM.yyyy',
  notifications: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const getSetting = useCallback(<K extends keyof Settings>(key: K): Settings[K] => {
    return settings[key];
  }, [settings]);

  const getProfessionDefaults = useCallback((profession: string): Partial<Settings> => {
    return defaultSettings;
  }, []);

  const mergeWithDefaults = useCallback((customSettings: Partial<Settings>): Settings => {
    return { ...defaultSettings, ...customSettings };
  }, []);

  return { settings, updateSetting, getSetting, getProfessionDefaults, mergeWithDefaults };
}

export default useSettings;
