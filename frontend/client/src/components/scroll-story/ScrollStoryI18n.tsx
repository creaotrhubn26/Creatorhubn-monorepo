/**
 * ScrollStory Internationalization (i18n) System
 * Provides multi-language support for ScrollStory interface and content
 * Automatically translates UI elements based on selected language
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: { code: 'en', name: 'English', flag: '🇬🇧' },
  no: { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  sv: { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  da: { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
  it: { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  nl: { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  pl: { code: 'pl', name: 'Polski', flag: '🇵🇱' },
};

// Translation keys for ScrollStory UI
const translations = {
  en: {
    // Navigation
    'nav.previous':'Previous','nav.next':'Next','nav.pause':'Pause','nav.resume':'Resume','nav.progress' : 'Progress',

    // Audio
    'audio.play':'Play','audio.pause':'Pause','audio.volume':'Volume','audio.mute':'Mute','audio.unmute':'Unmute','audio.track':'Track','audio.syncWithScroll' : 'Scroll Synced',

    // Settings
    'settings.title':'Settings','settings.privacy':'Privacy & Access','settings.features':'Features','settings.performance':'Performance','settings.analytics':'Analytics & Tracking','settings.language':'Language','settings.comments':'Enable Comments','settings.commentsDesc':'Allow viewers to leave comments on story pages','settings.publicAccess':'Public Access','settings.publicAccessDesc':'Make story visible to anyone with the link','settings.save':'Save Changes','settings.cancel':'Cancel','settings.reset' : 'Reset',

    // Analytics
    'analytics.totalViews':'Total Views','analytics.uniqueVisitors':'Unique Visitors','analytics.completionRate':'Completion Rate','analytics.avgTimeSpent':'Avg. Time Spent','analytics.scrollDepth':'Average Scroll Depth','analytics.bounceRate':'Bounce Rate','analytics.engagementScore':'Engagement Score','analytics.topPages':'Most Viewed Pages','analytics.deviceBreakdown':'Device Breakdown','analytics.mobile':'Mobile','analytics.desktop':'Desktop','analytics.tablet' : 'Tablet',

    // Comments
    'comments.title':'Comments','comments.add':'Add Comment','comments.reply':'Reply','comments.edit':'Edit','comments.delete':'Delete','comments.placeholder':'Write a comment...','comments.empty' : 'No comments yet. Be the first to comment!',

    // Errors
    'error.loading':'Failed to load','error.saving':'Failed to save','error.network' : 'Network error',
  },
  no: {
    // Navigation
    'nav.previous':'Forrige','nav.next':'Neste','nav.pause':'Pause','nav.resume':'Fortsett','nav.progress' : 'Fremdrift',

    // Audio
    'audio.play':'Spill av','audio.pause':'Pause','audio.volume':'Volum','audio.mute':'Demp','audio.unmute':'Fjern demping','audio.track':'Spor','audio.syncWithScroll' : 'Synkronisert med rulling',

    // Settings
    'settings.title':'Innstillinger','settings.privacy':'Personvern og tilgang','settings.features':'Funksjoner','settings.performance':'Ytelse','settings.analytics':'Analyse og sporing','settings.language':'Språk','settings.comments':'Aktiver kommentarer','settings.commentsDesc':'La seere legge igjen kommentarer på historiesider','settings.publicAccess':'Offentlig tilgang','settings.publicAccessDesc':'Gjør historien synlig for alle med lenken','settings.save':'Lagre endringer','settings.cancel':'Avbryt','settings.reset' : 'Tilbakestill',

    // Analytics
    'analytics.totalViews':'Totalt antall visninger','analytics.uniqueVisitors':'Unike besøkende','analytics.completionRate':'Fullføringsgrad','analytics.avgTimeSpent':'Gj.snitt tid brukt','analytics.scrollDepth':'Gjennomsnittlig rulledybde','analytics.bounceRate':'Avvisningsrate','analytics.engagementScore':'Engasjementsscore','analytics.topPages':'Mest viste sider','analytics.deviceBreakdown':'Enhetsfordeling','analytics.mobile':'Mobil','analytics.desktop':'Skrivebord','analytics.tablet' : 'Nettbrett',

    // Comments
    'comments.title':'Kommentarer','comments.add':'Legg til kommentar','comments.reply':'Svar','comments.edit':'Rediger','comments.delete':'Slett','comments.placeholder':'Skriv en kommentar...','comments.empty' : 'Ingen kommentarer ennå. Vær den første til å kommentere!',

    // Errors
    'error.loading':'Kunne ikke laste','error.saving':'Kunne ikke lagre','error.network' : 'Nettverksfeil',
  },
  // Add more languages as needed
};

interface MultilingualContent {
  [languageCode: string]: string;
}

interface ScrollStoryI18nContextType {
  // Interface language (UI elements)
  interfaceLanguage: string;
  setInterfaceLanguage: (lang: string) => void;

  // Content language (story text)
  contentLanguage: string;
  setContentLanguage: (lang: string) => void;

  // Translation functions
  t: (key: string) => string; // Translate UI
  tc: (content: string | MultilingualContent) => string; // Translate content

  // Auto-detection
  autoDetectInterfaceLanguage: boolean;
  setAutoDetectInterfaceLanguage: (enabled: boolean) => void;

  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const ScrollStoryI18nContext = createContext<ScrollStoryI18nContextType | null>(null);

interface ScrollStoryI18nProviderProps {
  children: React.ReactNode;
  defaultLanguage?: string;
  storyId?: string;
}

export function ScrollStoryI18nProvider({
  children,
  defaultLanguage = 'en',
  storyId,
}: ScrollStoryI18nProviderProps) {
  const [interfaceLanguage, setInterfaceLanguageState] = useState(defaultLanguage);
  const [contentLanguage, setContentLanguageState] = useState(defaultLanguage);
  const [autoDetectInterfaceLanguage, setAutoDetectInterfaceLanguage] = useState(true);
  const { analytics } = useEnhancedMasterIntegration();

  // Auto-detect browser language on mount (for interface only)
  useEffect(() => {
    if (autoDetectInterfaceLanguage) {
      const browserLang = navigator.language.split('-')[0];
      if (browserLang in SUPPORTED_LANGUAGES) {
        setInterfaceLanguageState(browserLang);
      }
    }
  }, [autoDetectInterfaceLanguage]);

  // Persist language preferences
  useEffect(() => {
    if (storyId) {
      // Persist server-first
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: `scrollstory_${storyId}_interface_language`, value: interfaceLanguage })
      }).catch(() => {});
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: `scrollstory_${storyId}_content_language`, value: contentLanguage })
      }).catch(() => {});
      // Local fallback
      localStorage.setItem(`scrollstory_${storyId}_interface_language`, interfaceLanguage);
      localStorage.setItem(`scrollstory_${storyId}_content_language`, contentLanguage);
    }
  }, [interfaceLanguage, contentLanguage, storyId]);

  const setInterfaceLanguage = (lang: string) => {
    if (lang in SUPPORTED_LANGUAGES) {
      const oldLang = interfaceLanguage;
      setInterfaceLanguageState(lang);

      // Track interface language change
      analytics.trackEvent('scroll_story_interface_language_changed', {
        storyId,
        fromLanguage: oldLang,
        toLanguage: lang,
      });
    }
  };

  const setContentLanguage = (lang: string) => {
    if (lang in SUPPORTED_LANGUAGES) {
      const oldLang = contentLanguage;
      setContentLanguageState(lang);

      // Track content language change
      analytics.trackEvent('scroll_story_content_language_changed', {
        storyId,
        fromLanguage: oldLang,
        toLanguage: lang,
      });
    }
  };

  // Translate UI text (uses interface language)
  const t = (key: string): string => {
    const langTranslations =
      translations[interfaceLanguage as keyof typeof translations] || translations.en;
    return langTranslations[key as keyof typeof langTranslations] || key;
  };

  // Translate content (uses content language, supports both string and multilingual objects)
  const tc = (content: string | MultilingualContent): string => {
    if (typeof content === 'string') {
      return content;
    }

    // Try content language, fall back to English, then first available
    return content[contentLanguage] || content['en'] || Object.values(content)[0] || ', ';
  };

  const value: ScrollStoryI18nContextType = {
    interfaceLanguage,
    setInterfaceLanguage,
    contentLanguage,
    setContentLanguage,
    t,
    tc,
    autoDetectInterfaceLanguage,
    setAutoDetectInterfaceLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  return (
    <ScrollStoryI18nContext.Provider value={value}>{children}</ScrollStoryI18nContext.Provider>
  );
}

export function useScrollStoryI18n() {
  const context = useContext(ScrollStoryI18nContext);
  if (!context) {
    throw new Error('useScrollStoryI18n must be used within ScrollStoryI18nProvider');
  }
  return context;
}

/**
 * Language Selector Component
 */
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Divider,
} from '@mui/material';

interface LanguageSelectorProps {
  type: 'interface' | 'content' | 'both'; // Which language to control
  compact?: boolean;
}

export function LanguageSelector({ type, compact = false }: LanguageSelectorProps) {
  const {
    interfaceLanguage,
    setInterfaceLanguage,
    contentLanguage,
    setContentLanguage,
    supportedLanguages,
  } = useScrollStoryI18n();

  if (type === 'both') {
    // Show both interface and content language selectors
    return (
      <Box>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Interface Language</InputLabel>
          <Select
            value={interfaceLanguage}
            onChange={(e) => setInterfaceLanguage(e.target.value)}
            label="Interface Language"
          >
            {Object.values(supportedLanguages).map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h6">{lang.flag}</Typography>
                  <Typography>{lang.name}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Content Language</InputLabel>
          <Select
            value={contentLanguage}
            onChange={(e) => setContentLanguage(e.target.value)}
            label="Content Language"
          >
            {Object.values(supportedLanguages).map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h6">{lang.flag}</Typography>
                  <Typography>{lang.name}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  const isInterface = type === 'interface';
  const currentLang = isInterface ? interfaceLanguage : contentLanguage;
  const setLang = isInterface ? setInterfaceLanguage : setContentLanguage;
  const label = isInterface ? 'Interface Language' : 'Content Language';

  if (compact) {
    return (
      <Select
        value={currentLang}
        onChange={(e) => setLang(e.target.value)}
        size="small"
        sx={{ minWidth: 120 }}>
        {Object.values(supportedLanguages).map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </MenuItem>
        ))}
      </Select>
    );
  }

  return (
    <FormControl fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select value={currentLang} onChange={(e) => setLang(e.target.value)} label={label}>
        {Object.values(supportedLanguages).map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6">{lang.flag}</Typography>
              <Typography>{lang.name}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/**
 * USAGE EXAMPLES: *
 * 1. Wrap your ScrollStory with the i18n provider: * <ScrollStoryI18nProvider defaultLanguage="no" storyId="story-123">
 *   <ScrollStory story={story} />
 * </ScrollStoryI18nProvider>
 *
 * 2. Use translations in components: * const { t, tc, interfaceLanguage, contentLanguage } = useScrollStoryI18n();
 *
 * // UI elements use interface language
 * <Button>{t('nav.next')}</Button>  // "Next" or "Neste"
 *
 * 3. Store multilingual content: * const page = {
 *   title: {
 *     en: 'Welcome',
 *     no: 'Velkommen',
 *     de: 'Willkommen'
 *   },
 *   content: {
 *     en: 'This is the story...',
 *     no: 'Dette er historien...',
 *   }
 * };
 *
 * 4. Display translated content (uses content language): * <h1>{tc(page.title)}</h1>
 * <p>{tc(page.content)}</p>
 *
 * 5. Add language selectors: * // Separate controls
 * <LanguageSelector type="interface" />
 * <LanguageSelector type="content" />
 *
 * // Or both together
 * <LanguageSelector type="both" />
 *
 * 6. Change languages programmatically: * const { setInterfaceLanguage, setContentLanguage } = useScrollStoryI18n();
 * setInterfaceLanguage('no');  // UI in Norwegian
 * setContentLanguage('en');     // Content in English
 *
 * EXAMPLE: User in Norway reading English content
 * - Interface language: Norwegian (buttons, labels in Norwegian)
 * - Content language: English (story text in English)
 */
