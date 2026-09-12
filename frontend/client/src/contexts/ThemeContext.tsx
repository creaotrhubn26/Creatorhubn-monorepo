// @ts-nocheck
/**
 * Theme Context - Centralized theme and styling management
 * Provides consistent theming across the application
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createTheme,
  type Theme,
  ThemeProvider as MuiThemeProvider,
} from '@mui/material/styles';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

interface ProfessionTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

interface ShowcaseTheme {
  cardStyle: 'elevated' | 'outlined' | 'filled';
  gridSpacing: number;
  imageAspectRatio: 'square' | 'landscape' | 'portrait' | 'auto';
}

interface ProjectCreationTheme {
  stepIndicatorStyle: 'dots' | 'numbers' | 'lines';
  formLayout: 'single' | 'two-column' | 'three-column';
}

interface DashboardTheme {
  layout: 'grid' | 'list' | 'compact';
  sidebarWidth: number;
}

export interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: number;
  spacing: number;
  professionThemes: {
    photographer: ProfessionTheme;
    videographer: ProfessionTheme;
    music_producer: ProfessionTheme;
    vendor: ProfessionTheme;
  };
  componentThemes: {
    showcase: ShowcaseTheme;
    projectCreation: ProjectCreationTheme;
    dashboard: DashboardTheme;
  };
}

type ProfessionKey = keyof ThemeConfig['professionThemes'];
type ComponentKey = keyof ThemeConfig['componentThemes'];

type ThemeConfigUpdate = Partial<
  Omit<ThemeConfig, 'professionThemes' | 'componentThemes'>
> & {
  professionThemes?: Partial<
    Record<ProfessionKey, Partial<ThemeConfig['professionThemes'][ProfessionKey]>>
  >;
  componentThemes?: Partial<
    Record<ComponentKey, Partial<ThemeConfig['componentThemes'][ComponentKey]>>
  >;
};

export interface ThemeContextType {
  theme: Theme;
  themeConfig: ThemeConfig;
  setThemeConfig: (config: Partial<ThemeConfig>) => void;
  toggleMode: () => void;
  setMode: (mode: 'light' | 'dark' | 'auto') => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setAccentColor: (color: string) => void;
  setProfessionTheme: (profession: string, theme: Partial<ProfessionTheme>) => void;
  getProfessionTheme: (profession: string) => ProfessionTheme;
  setComponentTheme: (component: string, theme: Record<string, unknown>) => void;
  getComponentTheme: (component: string) =>
    | ShowcaseTheme
    | ProjectCreationTheme
    | DashboardTheme;
  getColorPalette: (baseColor: string) => {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  getContrastColor: (backgroundColor: string) => string;
  getAccessibleColor: (foreground: string, background: string) => string;
  saveTheme: () => void;
  loadTheme: () => void;
  resetTheme: () => void;
  isDarkMode: boolean;
  isSystemTheme: boolean;
}

const defaultThemeConfig: ThemeConfig = {
  mode: 'auto',
  primaryColor: '#1976d2',
  secondaryColor: '#dc004e',
  accentColor: '#ff6b35',
  backgroundColor: '#ffffff',
  surfaceColor: '#f5f5f5',
  textColor: '#212121',
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  borderRadius: 8,
  spacing: 8,
  professionThemes: {
    photographer: {
      primaryColor: '#1976d2',
      secondaryColor: '#dc004e',
      accentColor: '#ff6b35',
    },
    videographer: {
      primaryColor: '#9c27b0',
      secondaryColor: '#e91e63',
      accentColor: '#ff5722',
    },
    music_producer: {
      primaryColor: '#4caf50',
      secondaryColor: '#ff9800',
      accentColor: '#f44336',
    },
    vendor: {
      primaryColor: '#607d8b',
      secondaryColor: '#795548',
      accentColor: '#ffc107',
    },
  },
  componentThemes: {
    showcase: {
      cardStyle: 'elevated',
      gridSpacing: 16,
      imageAspectRatio: 'square',
    },
    projectCreation: {
      stepIndicatorStyle: 'dots',
      formLayout: 'two-column',
    },
    dashboard: {
      layout: 'grid',
      sidebarWidth: 280,
    },
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeHex = (value: string, fallback: string): string => {
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [r, g, b] = normalized.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
};

const readNumber = (
  source: Record<string, unknown>,
  key: string,
  fallback: number
): number => {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const readString = (
  source: Record<string, unknown>,
  key: string,
  fallback: string
): string => {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

const toThemeConfigUpdate = (input: unknown): ThemeConfigUpdate | null => {
  if (!isRecord(input)) {
    return null;
  }

  const update: ThemeConfigUpdate = {};

  if (input.mode === 'light' || input.mode === 'dark' || input.mode === 'auto') {
    update.mode = input.mode;
  }

  update.primaryColor = normalizeHex(
    readString(input, 'primaryColor', defaultThemeConfig.primaryColor),
    defaultThemeConfig.primaryColor
  );
  update.secondaryColor = normalizeHex(
    readString(input, 'secondaryColor', defaultThemeConfig.secondaryColor),
    defaultThemeConfig.secondaryColor
  );
  update.accentColor = normalizeHex(
    readString(input, 'accentColor', defaultThemeConfig.accentColor),
    defaultThemeConfig.accentColor
  );
  update.backgroundColor = normalizeHex(
    readString(input, 'backgroundColor', defaultThemeConfig.backgroundColor),
    defaultThemeConfig.backgroundColor
  );
  update.surfaceColor = normalizeHex(
    readString(input, 'surfaceColor', defaultThemeConfig.surfaceColor),
    defaultThemeConfig.surfaceColor
  );
  update.textColor = normalizeHex(
    readString(input, 'textColor', defaultThemeConfig.textColor),
    defaultThemeConfig.textColor
  );
  update.fontFamily = readString(input, 'fontFamily', defaultThemeConfig.fontFamily);
  update.borderRadius = clamp(
    readNumber(input, 'borderRadius', defaultThemeConfig.borderRadius),
    0,
    32
  );
  update.spacing = clamp(readNumber(input, 'spacing', defaultThemeConfig.spacing), 4, 16);

  const professionThemesRaw = isRecord(input.professionThemes)
    ? input.professionThemes
    : null;

  if (professionThemesRaw) {
    const professionThemes: ThemeConfigUpdate['professionThemes'] = {};
    (Object.keys(defaultThemeConfig.professionThemes) as ProfessionKey[]).forEach(
      (key) => {
        const rawTheme = professionThemesRaw[key];
        if (!isRecord(rawTheme)) {
          return;
        }
        professionThemes[key] = {
          primaryColor: normalizeHex(
            readString(rawTheme, 'primaryColor', defaultThemeConfig.professionThemes[key].primaryColor),
            defaultThemeConfig.professionThemes[key].primaryColor
          ),
          secondaryColor: normalizeHex(
            readString(rawTheme, 'secondaryColor', defaultThemeConfig.professionThemes[key].secondaryColor),
            defaultThemeConfig.professionThemes[key].secondaryColor
          ),
          accentColor: normalizeHex(
            readString(rawTheme, 'accentColor', defaultThemeConfig.professionThemes[key].accentColor),
            defaultThemeConfig.professionThemes[key].accentColor
          ),
        };
      }
    );
    update.professionThemes = professionThemes;
  }

  const componentThemesRaw = isRecord(input.componentThemes)
    ? input.componentThemes
    : null;

  if (componentThemesRaw) {
    const componentThemes: ThemeConfigUpdate['componentThemes'] = {};

    const showcaseRaw = componentThemesRaw.showcase;
    if (isRecord(showcaseRaw)) {
      componentThemes.showcase = {
        cardStyle:
          showcaseRaw.cardStyle === 'outlined' || showcaseRaw.cardStyle === 'filled'
            ? showcaseRaw.cardStyle
            : 'elevated',
        gridSpacing: clamp(
          readNumber(showcaseRaw, 'gridSpacing', defaultThemeConfig.componentThemes.showcase.gridSpacing),
          4,
          48
        ),
        imageAspectRatio:
          showcaseRaw.imageAspectRatio === 'landscape' ||
          showcaseRaw.imageAspectRatio === 'portrait' ||
          showcaseRaw.imageAspectRatio === 'auto'
            ? showcaseRaw.imageAspectRatio
            : 'square',
      };
    }

    const projectCreationRaw = componentThemesRaw.projectCreation;
    if (isRecord(projectCreationRaw)) {
      componentThemes.projectCreation = {
        stepIndicatorStyle:
          projectCreationRaw.stepIndicatorStyle === 'numbers' ||
          projectCreationRaw.stepIndicatorStyle === 'lines'
            ? projectCreationRaw.stepIndicatorStyle
            : 'dots',
        formLayout:
          projectCreationRaw.formLayout === 'single' ||
          projectCreationRaw.formLayout === 'three-column'
            ? projectCreationRaw.formLayout
            : 'two-column',
      };
    }

    const dashboardRaw = componentThemesRaw.dashboard;
    if (isRecord(dashboardRaw)) {
      componentThemes.dashboard = {
        layout:
          dashboardRaw.layout === 'list' || dashboardRaw.layout === 'compact'
            ? dashboardRaw.layout
            : 'grid',
        sidebarWidth: clamp(
          readNumber(dashboardRaw, 'sidebarWidth', defaultThemeConfig.componentThemes.dashboard.sidebarWidth),
          200,
          420
        ),
      };
    }

    update.componentThemes = componentThemes;
  }

  return update;
};

const mergeThemeConfig = (
  base: ThemeConfig,
  update: ThemeConfigUpdate
): ThemeConfig => ({
  ...base,
  ...update,
  professionThemes: {
    photographer: {
      ...base.professionThemes.photographer,
      ...(update.professionThemes?.photographer ?? {}),
    },
    videographer: {
      ...base.professionThemes.videographer,
      ...(update.professionThemes?.videographer ?? {}),
    },
    music_producer: {
      ...base.professionThemes.music_producer,
      ...(update.professionThemes?.music_producer ?? {}),
    },
    vendor: {
      ...base.professionThemes.vendor,
      ...(update.professionThemes?.vendor ?? {}),
    },
  },
  componentThemes: {
    showcase: {
      ...base.componentThemes.showcase,
      ...(update.componentThemes?.showcase ?? {}),
    },
    projectCreation: {
      ...base.componentThemes.projectCreation,
      ...(update.componentThemes?.projectCreation ?? {}),
    },
    dashboard: {
      ...base.componentThemes.dashboard,
      ...(update.componentThemes?.dashboard ?? {}),
    },
  },
});

const getProfessionKey = (user: unknown): ProfessionKey => {
  if (!isRecord(user)) {
    return 'photographer';
  }
  const profession = user.profession;
  if (typeof profession !== 'string') {
    return 'photographer';
  }
  if (
    profession === 'photographer' ||
    profession === 'videographer' ||
    profession === 'music_producer' ||
    profession === 'vendor'
  ) {
    return profession;
  }
  return 'photographer';
};

const generateColorPalette = (baseColor: string) => {
  const hex = normalizeHex(baseColor, '#1976d2').replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  const shade = (factor: number) => {
    const nr = clamp(Math.round(r * factor), 0, 255);
    const ng = clamp(Math.round(g * factor), 0, 255);
    const nb = clamp(Math.round(b * factor), 0, 255);
    return `#${nr.toString(16).padStart(2, '0')}${ng
      .toString(16)
      .padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  };

  return {
    50: shade(1.25),
    100: shade(1.15),
    200: shade(1.05),
    300: shade(0.95),
    400: shade(0.85),
    500: normalizeHex(baseColor, '#1976d2'),
    600: shade(0.75),
    700: shade(0.65),
    800: shade(0.55),
    900: shade(0.45),
  };
};

const getRelativeLuminance = (hexColor: string): number => {
  const hex = normalizeHex(hexColor, '#000000').replace('#', '');
  const channels = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const getContrastRatio = (foreground: string, background: string): number => {
  const l1 = getRelativeLuminance(foreground);
  const l2 = getRelativeLuminance(background);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [themeConfig, setThemeConfigState] = useState<ThemeConfig>(defaultThemeConfig);
  // Slice 9X.72 — default DARK matcher dashboard-mui-theme. Bruker-preferanse
  // fra /api/user/ui-preferences overstyrer senere ved load.
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSystemTheme, setIsSystemTheme] = useState(false);

  const loadTheme = useCallback(() => {
    const applyUpdate = (rawConfig: unknown) => {
      const parsed = toThemeConfigUpdate(rawConfig);
      if (!parsed) {
        return false;
      }
      setThemeConfigState((previous) => mergeThemeConfig(previous, parsed));
      return true;
    };

    apiRequest('/api/user/ui-preferences')
      .then((payload: { data?: { theme_config?: unknown } } | null) => {
        const remoteConfig = payload?.data?.theme_config;
        if (applyUpdate(remoteConfig)) {
          return;
        }

        const saved = localStorage.getItem('theme-config');
        if (!saved) {
          return;
        }
        try {
          applyUpdate(JSON.parse(saved));
        } catch {
          // Ignore invalid local theme JSON
        }
      })
      .catch(() => {
        const saved = localStorage.getItem('theme-config');
        if (!saved) {
          return;
        }
        try {
          applyUpdate(JSON.parse(saved));
        } catch {
          // Ignore invalid local theme JSON
        }
      });
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    if (themeConfig.mode !== 'auto') {
      setIsDarkMode(themeConfig.mode === 'dark');
      setIsSystemTheme(false);
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDarkMode(event.matches);
      setIsSystemTheme(true);
    };

    setIsDarkMode(mediaQuery.matches);
    setIsSystemTheme(true);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [themeConfig.mode]);

  const theme = useMemo(() => {
    const professionKey = getProfessionKey(user);
    const professionTheme =
      themeConfig.professionThemes[professionKey] ??
      defaultThemeConfig.professionThemes.photographer;

    const primaryColor = professionTheme.primaryColor || themeConfig.primaryColor;
    const secondaryColor = professionTheme.secondaryColor || themeConfig.secondaryColor;

    return createTheme({
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: {
          main: primaryColor,
          light: generateColorPalette(primaryColor)[300],
          dark: generateColorPalette(primaryColor)[700],
        },
        secondary: {
          main: secondaryColor,
          light: generateColorPalette(secondaryColor)[300],
          dark: generateColorPalette(secondaryColor)[700],
        },
        error: { main: '#f44336' },
        warning: { main: '#ff9800' },
        info: { main: '#2196f3' },
        success: { main: '#4caf50' },
        background: {
          default: isDarkMode ? '#121212' : themeConfig.backgroundColor,
          paper: isDarkMode ? '#1e1e1e' : themeConfig.surfaceColor,
        },
        text: {
          primary: isDarkMode ? '#ffffff' : themeConfig.textColor,
          secondary: isDarkMode ? '#b3b3b3' : '#666666',
        },
      },
      typography: {
        fontFamily: themeConfig.fontFamily,
      },
      shape: {
        borderRadius: themeConfig.borderRadius,
      },
      spacing: themeConfig.spacing,
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: themeConfig.borderRadius,
              textTransform: 'none',
              fontWeight: 500,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: themeConfig.borderRadius * 1.5,
            },
          },
        },
      },
    });
  }, [themeConfig, isDarkMode, user]);

  const setThemeConfig = useCallback((config: Partial<ThemeConfig>) => {
    const parsed = toThemeConfigUpdate(config);
    if (!parsed) {
      return;
    }
    setThemeConfigState((previous) => mergeThemeConfig(previous, parsed));
  }, []);

  const toggleMode = useCallback(() => {
    setThemeConfig({ mode: isDarkMode ? 'light' : 'dark' });
  }, [isDarkMode, setThemeConfig]);

  const setMode = useCallback(
    (mode: 'light' | 'dark' | 'auto') => {
      setThemeConfig({ mode });
    },
    [setThemeConfig]
  );

  const setPrimaryColor = useCallback(
    (color: string) => {
      setThemeConfig({ primaryColor: color });
    },
    [setThemeConfig]
  );

  const setSecondaryColor = useCallback(
    (color: string) => {
      setThemeConfig({ secondaryColor: color });
    },
    [setThemeConfig]
  );

  const setAccentColor = useCallback(
    (color: string) => {
      setThemeConfig({ accentColor: color });
    },
    [setThemeConfig]
  );

  const setProfessionTheme = useCallback(
    (profession: string, professionTheme: Partial<ProfessionTheme>) => {
      const key = getProfessionKey({ profession });
      setThemeConfig({
        professionThemes: {
          [key]: professionTheme,
        },
      });
    },
    [setThemeConfig]
  );

  const getProfessionTheme = useCallback(
    (profession: string): ProfessionTheme => {
      const key = getProfessionKey({ profession });
      return (
        themeConfig.professionThemes[key] ?? defaultThemeConfig.professionThemes.photographer
      );
    },
    [themeConfig.professionThemes]
  );

  const setComponentTheme = useCallback(
    (component: string, componentTheme: Record<string, unknown>) => {
      const componentKey: ComponentKey =
        component === 'showcase' || component === 'projectCreation' || component === 'dashboard'
          ? component
          : 'dashboard';

      setThemeConfig({
        componentThemes: {
          [componentKey]: componentTheme,
        },
      });
    },
    [setThemeConfig]
  );

  const getComponentTheme = useCallback(
    (component: string) => {
      const componentKey: ComponentKey =
        component === 'showcase' || component === 'projectCreation' || component === 'dashboard'
          ? component
          : 'dashboard';
      return (
        themeConfig.componentThemes[componentKey] ??
        defaultThemeConfig.componentThemes.dashboard
      );
    },
    [themeConfig.componentThemes]
  );

  const getColorPalette = useCallback((baseColor: string) => {
    return generateColorPalette(baseColor);
  }, []);

  const getContrastColor = useCallback((backgroundColor: string) => {
    const contrastAgainstBlack = getContrastRatio('#000000', backgroundColor);
    const contrastAgainstWhite = getContrastRatio('#ffffff', backgroundColor);
    return contrastAgainstBlack >= contrastAgainstWhite ? '#000000' : '#ffffff';
  }, []);

  const getAccessibleColor = useCallback(
    (foreground: string, background: string) => {
      return getContrastRatio(foreground, background) >= 4.5
        ? foreground
        : getContrastColor(background);
    },
    [getContrastColor]
  );

  const saveTheme = useCallback(() => {
    apiRequest('/api/user/ui-preferences', {
      method: 'POST',
      body: JSON.stringify({ themeConfig }),
    }).catch(() => {
      // Ignore network save failure; local persistence remains active.
    });

    localStorage.setItem('theme-config', JSON.stringify(themeConfig));
  }, [themeConfig]);

  const resetTheme = useCallback(() => {
    setThemeConfigState(defaultThemeConfig);
    localStorage.removeItem('theme-config');
  }, []);

  const contextValue: ThemeContextType = {
    theme,
    themeConfig,
    setThemeConfig,
    toggleMode,
    setMode,
    setPrimaryColor,
    setSecondaryColor,
    setAccentColor,
    setProfessionTheme,
    getProfessionTheme,
    setComponentTheme,
    getComponentTheme,
    getColorPalette,
    getContrastColor,
    getAccessibleColor,
    saveTheme,
    loadTheme,
    resetTheme,
    isDarkMode,
    isSystemTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context) {
    return context;
  }

  // Slice 9X.72 — fallback når ingen ThemeProvider er montert.
  // Default DARK matcher dashboard-mui-theme.
  const defaultTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: { main: defaultThemeConfig.primaryColor },
      secondary: { main: defaultThemeConfig.secondaryColor },
      background: {
        default: '#0a0807',
        paper: 'rgba(255,255,255,0.04)',
      },
      text: {
        primary: '#fff5e8',
        secondary: 'rgba(246,242,234,0.72)',
      },
    },
  });

  return {
    theme: defaultTheme,
    themeConfig: defaultThemeConfig,
    setThemeConfig: () => undefined,
    toggleMode: () => undefined,
    setMode: () => undefined,
    setPrimaryColor: () => undefined,
    setSecondaryColor: () => undefined,
    setAccentColor: () => undefined,
    setProfessionTheme: () => undefined,
    getProfessionTheme: (profession: string) => {
      const key = getProfessionKey({ profession });
      return defaultThemeConfig.professionThemes[key];
    },
    setComponentTheme: () => undefined,
    getComponentTheme: (component: string) => {
      const componentKey: ComponentKey =
        component === 'showcase' || component === 'projectCreation' || component === 'dashboard'
          ? component
          : 'dashboard';
      return defaultThemeConfig.componentThemes[componentKey];
    },
    getColorPalette: generateColorPalette,
    getContrastColor: () => '#000000',
    getAccessibleColor: () => '#000000',
    saveTheme: () => undefined,
    loadTheme: () => undefined,
    resetTheme: () => undefined,
    isDarkMode: false,
    isSystemTheme: false,
  };
};

export default ThemeContext;
