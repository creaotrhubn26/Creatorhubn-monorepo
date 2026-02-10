/**
 * Settings Context - Centralized user preferences and application settings
 * Provides consistent settings management across the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

// Settings interface
export interface UserSettings {
  // General settings
  general: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    currency: string;
    notifications: {
      email: boolean;
      push: boolean;
      desktop: boolean;
      sound: boolean;
};
    privacy: {
      profileVisibility: 'public' | 'private' | 'team';
      dataSharing: boolean;
      analytics: boolean;
};
};
  
  // Profession-specific settings
  profession: {
    type: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
    specialties: string[];
    experience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    preferences: {
      defaultProjectType: string;
      defaultPricing: number;
      defaultMeetingDuration: number;
      autoSave: boolean;
      autoBackup: boolean;
};
};
  
  // Showcase settings
  showcase: {
    defaultVisibility: 'private' | 'team' | 'public';
    defaultWatermark: 'none' | 'text' | 'logo' | 'both';
    watermarkText: string;
    watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    watermarkOpacity: number;
    watermarkSize: 'small' | 'medium' | 'large';
    downloadProtection: 'none' | 'password' | 'timelimit';
    clientAccess: 'full' | 'limited' | 'readonly';
    maxSelections: number;
    allowComments: boolean;
    allowFavorites: boolean;
    allowDownload: boolean;
    allowFullscreen: boolean;
    gridColumns: number;
    cardSpacing: 'tight' | 'normal' | 'loose';
    imageAspectRatio: 'square' | 'landscape' | 'portrait' | 'auto';
    showMetadata: boolean;
    showStats: boolean;
    enableSearch: boolean;
    enableFiltering: boolean;
    enableSorting: boolean;
    enableBulkActions: boolean;
    enableRealTimeSync: boolean;
    enableAIAnalysis: boolean;
    enableAutoTagging: boolean;
    enableSmartCollections: boolean;
};
  
  // Project creation settings
  projectCreation: {
    defaultTemplate: string;
    autoCreateWorklog: boolean;
    autoCreateMeeting: boolean;
    autoCreateShowcase: boolean;
    autoCreateWeddingTimeline: boolean;
    defaultMemoryCardLabeling: 'ABCD' | 'EFGH' | 'NUMERIC';
    defaultBackupStrategy: 'automatic' | 'manual' | 'scheduled';
    defaultBackupFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
    enableDraftMode: boolean;
    enableVersionHistory: boolean;
    maxVersions: number;
    autoSaveInterval: number;
};
  
  // Integration settings
  integrations: {
    googleDrive: {
      enabled: boolean;
      autoSync: boolean;
      syncFrequency: 'realtime' | 'hourly' | 'daily';
      defaultFolder: string;
};
    googlePhotos: {
      enabled: boolean;
      autoImport: boolean;
      importFrequency: 'realtime' | 'hourly' | 'daily';
      defaultAlbum: string;
};
    googleChat: {
      enabled: boolean;
      autoNotifications: boolean;
      notificationTypes: string[];
};
    lightroom: {
      enabled: boolean;
      autoExport: boolean;
      exportPresets: string[];
};
    weddingTimeline: {
      enabled: boolean;
      autoCreate: boolean;
      defaultCulture: string;
};
};
  
  // UI/UX settings
  ui: {
    theme: 'light' | 'dark' | 'auto';
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    fontSize: 'small' | 'medium' | 'large';
    density: 'compact' | 'normal' | 'comfortable';
    animations: boolean;
    transitions: boolean;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    dashboardLayout: 'grid' | 'list' | 'compact';
    showTooltips: boolean;
    showKeyboardShortcuts: boolean;
};
  
  // Performance settings
  performance: {
    imageQuality: 'low' | 'medium' | 'high' | 'original';
    thumbnailSize: 'small' | 'medium' | 'large';
    lazyLoading: boolean;
    preloadImages: boolean;
    cacheSize: number;
    maxConcurrentUploads: number;
    maxConcurrentDownloads: number;
    enableCompression: boolean;
    compressionQuality: number;
};
  
  // Security settings
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number;
    passwordExpiry: number;
    loginAttempts: number;
    ipWhitelist: string[];
    dataEncryption: boolean;
    auditLogging: boolean;
};
}

// Settings context type
export interface SettingsContextType {
  // Current settings
  settings: UserSettings;
  setSettings: (settings: Partial<UserSettings>) => void;
  
  // Settings operations
  updateSetting: <K extends keyof UserSettings>(category: K, setting: Partial<UserSettings[K]>) => void;
  getSetting: <K extends keyof UserSettings>(category: K, key: keyof UserSettings[K]) => any;
  resetSettings: () => void;
  resetCategory: (category: keyof UserSettings) => void;
  
  // Settings persistence
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
  exportSettings: () => Promise<string>;
  importSettings: (settingsJson: string) => Promise<void>;
  
  // Settings validation
  validateSettings: (settings: Partial<UserSettings>) => { isValid: boolean; errors: string[] };
  
  // Settings state
  isLoading: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  error: string | null;
  
  // Settings utilities
  getDefaultSettings: () => UserSettings;
  getProfessionDefaults: (profession: string) => Partial<UserSettings>;
  mergeWithDefaults: (settings: Partial<UserSettings>) => UserSettings;
}

// Default settings
const defaultSettings: UserSettings = {
  general: {
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    currency: 'USD',
    notifications: {
      email: true,
      push: true,
      desktop: true,
      sound: true,
  },
    privacy: {
      profileVisibility: 'private',
      dataSharing: false,
      analytics: true,
  },
},
  profession: {
    type: 'photographer',
    specialties: [],
    experience: 'intermediate',
    preferences: {
      defaultProjectType: 'wedding',
      defaultPricing: 0,
      defaultMeetingDuration: 60,
      autoSave: true,
      autoBackup: true,
  },
},
  showcase: {
    defaultVisibility: 'private',
    defaultWatermark: 'none',
    watermarkText: '',
    watermarkPosition: 'bottom-right',
    watermarkOpacity: 0.7,
    watermarkSize: 'medium',
    downloadProtection: 'none',
    clientAccess: 'full',
    maxSelections: 50,
    allowComments: true,
    allowFavorites: true,
    allowDownload: true,
    allowFullscreen: true,
    gridColumns: 4,
    cardSpacing: 'normal',
    imageAspectRatio: 'square',
    showMetadata: true,
    showStats: true,
    enableSearch: true,
    enableFiltering: true,
    enableSorting: true,
    enableBulkActions: true,
    enableRealTimeSync: true,
    enableAIAnalysis: false,
    enableAutoTagging: false,
    enableSmartCollections: false,
},
  projectCreation: {
    defaultTemplate: 'standard',
    autoCreateWorklog: true,
    autoCreateMeeting: true,
    autoCreateShowcase: true,
    autoCreateWeddingTimeline: false,
    defaultMemoryCardLabeling: 'ABCD',
    defaultBackupStrategy: 'automatic',
    defaultBackupFrequency: 'realtime',
    enableDraftMode: true,
    enableVersionHistory: true,
    maxVersions: 10,
    autoSaveInterval: 300000,
},
  integrations: {
    googleDrive: {
      enabled: false,
      autoSync: false,
      syncFrequency: 'daily',
      defaultFolder: '',
  },
    googlePhotos: {
      enabled: false,
      autoImport: false,
      importFrequency: 'daily',
      defaultAlbum: '',
  },
    googleChat: {
      enabled: false,
      autoNotifications: false,
      notificationTypes: ['project_updates','client_messages'],
  },
    lightroom: {
      enabled: false,
      autoExport: false,
      exportPresets: [],
  },
    weddingTimeline: {
      enabled: false,
      autoCreate: false,
      defaultCulture: 'norsk',
  },
},
  ui: {
    theme: 'auto',
    primaryColor: '#1976d2',
    secondaryColor: '#dc004e',
    accentColor: '#ff6b35',
    fontFamily: '"Roboto","Helvetica","Arial", sans-serif',
    fontSize: 'medium',
    density: 'normal',
    animations: true,
    transitions: true,
    sidebarCollapsed: false,
    sidebarWidth: 280,
    dashboardLayout: 'grid',
    showTooltips: true,
    showKeyboardShortcuts: true,
},
  performance: {
    imageQuality: 'high',
    thumbnailSize: 'medium',
    lazyLoading: true,
    preloadImages: false,
    cacheSize: 100,
    maxConcurrentUploads: 3,
    maxConcurrentDownloads: 5,
    enableCompression: true,
    compressionQuality: 85,
},
  security: {
    twoFactorAuth: false,
    sessionTimeout: 3600,
    passwordExpiry: 90,
    loginAttempts: 5,
    ipWhitelist: [],
    dataEncryption: true,
    auditLogging: false,
},
};

// Create context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Settings provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettingsState] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (user) {
      loadSettings();
  }
}, [user]);

  // Set settings
  const setSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
    setIsDirty(true);
}, []);

  // Update specific setting
  const updateSetting = useCallback(<K extends keyof UserSettings>(category: K, setting: Partial<UserSettings[K]>) => {
    setSettingsState(prev => ({
      ...prev,
      [category]: { ...prev[category], ...setting },
  }));
    setIsDirty(true);
}, []);

  // Get specific setting
  const getSetting = useCallback(<K extends keyof UserSettings>(category: K, key: keyof UserSettings[K]) => {
    return settings[category][key];
}, [settings]);

  // Reset all settings
  const resetSettings = useCallback(() => {
    setSettingsState(defaultSettings);
    setIsDirty(true);
}, []);

  // Reset specific category
  const resetCategory = useCallback((category: keyof UserSettings) => {
    setSettingsState(prev => ({
      ...prev,
      [category]: defaultSettings[category],
  }));
    setIsDirty(true);
}, []);

  // Save settings
  const saveSettings = useCallback(async (): Promise<void> => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings, ', {
        method: 'PUT',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user.id}`,
      },
        body: JSON.stringify(settings),
    });

      if (!response.ok) {
        throw new Error('Failed to save settings, ');
    }

      setIsDirty(false);
      setLastSaved(new Date());
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      throw new Error(errorMessage);
  } finally {
      setIsLoading(false);
  }
}, [user, settings]);

  // Load settings
  const loadSettings = useCallback(async (): Promise<void> => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${user.id}`,
      },
    });

      if (response.ok) {
        const userSettings = await response.json();
        setSettingsState(userSettings);
        setIsDirty(false);
        setLastSaved(new Date());
    } else {
        // Use default settings if no saved settings found
        setSettingsState(defaultSettings);
    }
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      // Use default settings on error
      setSettingsState(defaultSettings);
  } finally {
      setIsLoading(false);
  }
}, [user]);

  // Export settings
  const exportSettings = useCallback(async (): Promise<string> => {
    return JSON.stringify(settings, null, 2);
}, [settings]);

  // Import settings
  const importSettings = useCallback(async (settingsJson: string): Promise<void> => {
    try {
      const importedSettings = JSON.parse(settingsJson);
      const validation = validateSettings(importedSettings);
      
      if (!validation.isValid) {
        throw new Error(`Invalid settings: ${validation.errors.join('')}`);
    }

      setSettingsState(importedSettings);
      setIsDirty(true);
  } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import settings';
      setError(errorMessage);
      throw new Error(errorMessage);
  }
}, []);

  // Validate settings
  const validateSettings = useCallback((settingsToValidate: Partial<UserSettings>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate general settings
    if (settingsToValidate.general) {
      if (settingsToValidate.general.language && typeof settingsToValidate.general.language !== 'string') {
        errors.push('Language must be a string');
  }
      if (settingsToValidate.general.timeFormat && !['12h','24h'].includes(settingsToValidate.general.timeFormat)) {
        errors.push('Time format must be 12h or 24h');
    }
  }

    // Validate profession settings
    if (settingsToValidate.profession) {
      if (settingsToValidate.profession.type && !['photographer','videographer','music_producer','vendor'].includes(settingsToValidate.profession.type)) {
        errors.push('Invalid profession type');
    }
      if (settingsToValidate.profession.experience && !['beginner','intermediate','advanced','expert'].includes(settingsToValidate.profession.experience)) {
        errors.push('Invalid experience level');
    }
  }

    // Validate showcase settings
    if (settingsToValidate.showcase) {
      if (settingsToValidate.showcase.defaultVisibility && !['private','team','public'].includes(settingsToValidate.showcase.defaultVisibility)) {
        errors.push('Invalid default visibility');
    }
      if (settingsToValidate.showcase.defaultWatermark && !['none','text','logo','both'].includes(settingsToValidate.showcase.defaultWatermark)) {
        errors.push('Invalid default watermark');
    }
      if (settingsToValidate.showcase.watermarkOpacity && (settingsToValidate.showcase.watermarkOpacity < 0 || settingsToValidate.showcase.watermarkOpacity > 1)) {
        errors.push('Watermark opacity must be between 0 and 1');
    }
  }

    // Validate UI settings
    if (settingsToValidate.ui) {
      if (settingsToValidate.ui.theme && !['light','dark','auto'].includes(settingsToValidate.ui.theme)) {
        errors.push('Invalid theme');
    }
      if (settingsToValidate.ui.fontSize && !['small','medium','large'].includes(settingsToValidate.ui.fontSize)) {
        errors.push('Invalid font size');
    }
  }

    return {
      isValid: errors.length === 0,
      errors,
  };
}, []);

  // Get default settings
  const getDefaultSettings = useCallback((): UserSettings => {
    return defaultSettings;
}, []);

  // Get profession defaults
  const getProfessionDefaults = useCallback((profession: string): Partial<UserSettings> => {
    const professionDefaults: Record<string, Partial<UserSettings>> = {
      photographer: {
        profession: {
          type: 'photographer',
          specialties: ['wedding','portrait','commercial'],
          experience: 'intermediate',
          preferences: {
            defaultProjectType: 'wedding',
            defaultPricing: 2500,
            defaultMeetingDuration: 60,
            autoSave: true,
            autoBackup: true,
        },
      },
        showcase: {
          defaultVisibility: 'private',
          defaultWatermark: 'text',
          watermarkText: '© Photographer Name',
          watermarkPosition: 'bottom-right',
          watermarkOpacity: 0.7,
          watermarkSize: 'medium',
          downloadProtection: 'password',
          clientAccess: 'limited',
          maxSelections: 50,
          allowComments: true,
          allowFavorites: true,
          allowDownload: true,
          allowFullscreen: true,
          gridColumns: 4,
          cardSpacing: 'normal',
          imageAspectRatio: 'square',
          showMetadata: true,
          showStats: true,
          enableSearch: true,
          enableFiltering: true,
          enableSorting: true,
          enableBulkActions: true,
          enableRealTimeSync: true,
          enableAIAnalysis: false,
          enableAutoTagging: false,
          enableSmartCollections: false,
      },
    },
      videographer: {
        profession: {
          type: 'videographer',
          specialties: ['wedding','corporate','commercial'],
          experience: 'intermediate',
          preferences: {
            defaultProjectType: 'wedding',
            defaultPricing: 3500,
            defaultMeetingDuration: 90,
            autoSave: true,
            autoBackup: true,
        },
      },
        showcase: {
          defaultVisibility: 'private',
          defaultWatermark: 'logo',
          watermarkText: ', ',
          watermarkPosition: 'bottom-right',
          watermarkOpacity: 0.8,
          watermarkSize: 'large',
          downloadProtection: 'timelimit',
          clientAccess: 'limited',
          maxSelections: 30,
          allowComments: true,
          allowFavorites: true,
          allowDownload: true,
          allowFullscreen: true,
          gridColumns: 3,
          cardSpacing: 'normal',
          imageAspectRatio: 'landscape',
          showMetadata: true,
          showStats: true,
          enableSearch: true,
          enableFiltering: true,
          enableSorting: true,
          enableBulkActions: true,
          enableRealTimeSync: true,
          enableAIAnalysis: true,
          enableAutoTagging: true,
          enableSmartCollections: true,
      },
    },
      music_producer: {
        profession: {
          type: 'music_producer',
          specialties: ['song','album','soundtrack'],
          experience: 'intermediate',
          preferences: {
            defaultProjectType: 'song',
            defaultPricing: 1500,
            defaultMeetingDuration: 45,
            autoSave: true,
            autoBackup: true,
        },
      },
        showcase: {
          defaultVisibility: 'private',
          defaultWatermark: 'none',
          watermarkText: ', ',
          watermarkPosition: 'center',
          watermarkOpacity: 0.5,
          watermarkSize: 'small',
          downloadProtection: 'password',
          clientAccess: 'readonly',
          maxSelections: 20,
          allowComments: true,
          allowFavorites: false,
          allowDownload: false,
          allowFullscreen: true,
          gridColumns: 2,
          cardSpacing: 'tight',
          imageAspectRatio: 'square',
          showMetadata: true,
          showStats: false,
          enableSearch: true,
          enableFiltering: true,
          enableSorting: true,
          enableBulkActions: false,
          enableRealTimeSync: true,
          enableAIAnalysis: true,
          enableAutoTagging: true,
          enableSmartCollections: true,
      },
    },
      vendor: {
        profession: {
          type: 'vendor',
          specialties: ['catering', 'flowers', 'decorations'],
          experience: 'intermediate',
          preferences: {
            defaultProjectType: 'event',
            defaultPricing: 2000,
            defaultMeetingDuration: 30,
            autoSave: true,
            autoBackup: true,
        },
      },
        showcase: {
          defaultVisibility: 'public',
          defaultWatermark: 'text',
          watermarkText: '© Vendor Name',
          watermarkPosition: 'bottom-right',
          watermarkOpacity: 0.6,
          watermarkSize: 'medium',
          downloadProtection: 'none',
          clientAccess: 'full',
          maxSelections: 100,
          allowComments: true,
          allowFavorites: true,
          allowDownload: true,
          allowFullscreen: true,
          gridColumns: 5,
          cardSpacing: 'loose',
          imageAspectRatio: 'square',
          showMetadata: false,
          showStats: true,
          enableSearch: true,
          enableFiltering: true,
          enableSorting: true,
          enableBulkActions: true,
          enableRealTimeSync: false,
          enableAIAnalysis: false,
          enableAutoTagging: false,
          enableSmartCollections: false,
      },
    },
  };

    return professionDefaults[profession] || {};
}, []);

  // Merge with defaults
  const mergeWithDefaults = useCallback((settingsToMerge: Partial<UserSettings>): UserSettings => {
    const merged = { ...defaultSettings };
    
    Object.keys(settingsToMerge).forEach(category => {
      if (settingsToMerge[category as keyof UserSettings]) {
        merged[category as keyof UserSettings] = {
          ...merged[category as keyof UserSettings],
          ...settingsToMerge[category as keyof UserSettings],
      } as any;
    }
  });

    return merged;
}, []);

  const contextValue: SettingsContextType = {
    settings,
    setSettings,
    updateSetting,
    getSetting,
    resetSettings,
    resetCategory,
    saveSettings,
    loadSettings,
    exportSettings,
    importSettings,
    validateSettings,
    isLoading,
    isDirty,
    lastSaved,
    error,
    getDefaultSettings,
    getProfessionDefaults,
    mergeWithDefaults,
};

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

// Hook to use settings context
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    // Return a safe default context when used outside of SettingsProvider
    // This allows components to work without being wrapped in a provider
    console.warn('useSettings: Component using settings outside of SettingsProvider. Using defaults.');
    return {
      settings: defaultSettings,
      setSettings: () => {},
      updateSetting: () => {},
      getSetting: (category, key) => (defaultSettings as any)[category]?.[key],
      resetSettings: () => {},
      resetCategory: () => {},
      saveSettings: async () => {},
      loadSettings: async () => {},
      exportSettings: async () => JSON.stringify(defaultSettings),
      importSettings: async () => {},
      validateSettings: () => ({ isValid: true, errors: [] }),
      isLoading: false,
      isDirty: false,
      lastSaved: null,
      error: null,
      getDefaultSettings: () => defaultSettings,
      getProfessionDefaults: () => ({}),
      mergeWithDefaults: (settings) => ({ ...defaultSettings, ...settings }) as UserSettings,
    };
  }
  return context;
};

export default SettingsContext;


