/**
 * Theme Context - Centralized theme and styling management
 * Provides consistent theming across the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createTheme, Theme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { useAuth } from '../hooks/useAuth';

// Theme configuration interface
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
  // Profession-specific themes
  professionThemes: {
    photographer: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
};
    videographer: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
};
    music_producer: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
};
    vendor: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
};
};
  // Component-specific themes
  componentThemes: {
    showcase: {
      cardStyle: 'elevated' | 'outlined' | 'filled';
      gridSpacing: number;
      imageAspectRatio: 'square' | 'landscape' | 'portrait' | 'auto';
};
    projectCreation: {
      stepIndicatorStyle: 'dots' | 'numbers' | 'lines';
      formLayout: 'single' | 'two-column' | 'three-column';
};
    dashboard: {
      layout: 'grid' | 'list' | 'compact';
      sidebarWidth: number;
};
};
}

// Theme context type
export interface ThemeContextType {
  // Current theme
  theme: Theme;
  themeConfig: ThemeConfig;
  setThemeConfig: (config: Partial<ThemeConfig>) => void;
  
  // Theme operations
  toggleMode: () => void;
  setMode: (mode: 'light' | 'dark' | 'auto') => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setAccentColor: (color: string) => void;
  
  // Profession-specific theming
  setProfessionTheme: (profession: string, theme: any) => void;
  getProfessionTheme: (profession: string) => any;
  
  // Component-specific theming
  setComponentTheme: (component: string, theme: any) => void;
  getComponentTheme: (component: string) => any;
  
  // Theme utilities
  getColorPalette: (baseColor: string) => { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string,};
  getContrastColor: (backgroundColor: string) => string;
  getAccessibleColor: (foreground: string, background: string) => string;
  
  // Theme persistence
  saveTheme: () => void;
  loadTheme: () => void;
  resetTheme: () => void;
  
  // Theme state
  isDarkMode: boolean;
  isSystemTheme: boolean;
}

// Default theme configuration
const defaultThemeConfig: ThemeConfig = {
  mode: 'auto',
  primaryColor: '#1976d2',
  secondaryColor: '#dc004e',
  accentColor: '#ff6b35',
  backgroundColor: '#ffffff',
  surfaceColor: '#f5f5f5',
  textColor: '#212121',
  fontFamily: '"Roboto""Helvetica","Arial", sans-serif',
  borderRadius: 8,
  spacing: 8,
  professionThemes: {
    photographer: {
      primaryColor: '#1976d2',
      secondaryColor: '#dc004e',
      accentColor: '#ff6b35',
  },
    videographer: {
      primaryColor: '#9c27b',
      secondaryColor: '#e91e6',
      accentColor: '#ff572',
  },
    music_producer: {
      primaryColor: '#4caf5',
      secondaryColor: '#ff980',
      accentColor: '#f4433',
  },
    vendor: {
      primaryColor: '#607d8',
      secondaryColor: '#79554',
      accentColor: '#ffc10',
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

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
// Helper function for color palette generation - moved outside component to avoid hoisting issues
const generateColorPalette = (baseColor: string) => {
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const generateShade = (factor: number) => {
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2,'0')}${newB.toString(16).padStart(2,'0')}`;
  };

  return {
    50: generateShade(0.9),
    100: generateShade(0.8),
    200: generateShade(0.7),
    300: generateShade(0.6),
    400: generateShade(0.5),
    500: baseColor,
    600: generateShade(0.4),
    700: generateShade(0.3),
    800: generateShade(0.2),
    900: generateShade(0.1),
  };
};

export const ThemeProvider: React.FC<{ children: ReactNode,}> = ({ children }) => {
  const { user } = useAuth();
  const [themeConfig, setThemeConfigState] = useState<ThemeConfig>(defaultThemeConfig);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSystemTheme, setIsSystemTheme] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    loadTheme();
}, []);

  // Listen for system theme changes
  useEffect(() => {
    if (themeConfig.mode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches);
        setIsSystemTheme(true);
  };

      mediaQuery.addEventListener('change, ', handleChange);
      setIsDarkMode(mediaQuery.matches);
      setIsSystemTheme(true);

      return () => mediaQuery.removeEventListener('change, ', handleChange);
  } else {
      setIsDarkMode(themeConfig.mode === 'dark');
      setIsSystemTheme(false);
  }
}, [themeConfig.mode]);

  // Create MUI theme based on config
  const theme = React.useMemo(() => {
    const currentConfig = themeConfig;
    const profession = (user as any)?.profession || 'photographer';
    const professionTheme = currentConfig.professionThemes[profession as keyof ThemeConfig['professionThemes']];

    return createTheme({
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: {
          main: professionTheme?.primaryColor || currentConfig.primaryColor,
          light: generateColorPalette(professionTheme?.primaryColor || currentConfig.primaryColor)[300],
          dark: generateColorPalette(professionTheme?.primaryColor || currentConfig.primaryColor)[700],
      },
        secondary: {
          main: professionTheme?.secondaryColor || currentConfig.secondaryColor,
          light: generateColorPalette(professionTheme?.secondaryColor || currentConfig.secondaryColor)[300],
          dark: generateColorPalette(professionTheme?.secondaryColor || currentConfig.secondaryColor)[700],
      },
        error: {
          main: '#f44336',
      },
        warning: {
          main: '#ff9800',
      },
        info: {
          main: '#2196f3',
      },
        success: {
          main: '#4caf50',
      },
        background: {
          default: isDarkMode ? '#121212' : currentConfig.backgroundColor,
          paper: isDarkMode ? '#1e1e1e' : currentConfig.surfaceColor,
      },
        text: {
          primary: isDarkMode ? '#ffffff' : currentConfig.textColor,
          secondary: isDarkMode ? '#b3b3b3' : '#66666',
      },
    },
      typography: {
        fontFamily: currentConfig.fontFamily,
        h1: {
          fontSize: '2.5rem',
          fontWeight: 600
      },
        h2: {
          fontSize: '2rem',
          fontWeight: 600
      },
        h3: {
          fontSize: '1.75rem',
          fontWeight: 50,
      },
        h4: {
          fontSize: '1.5rem',
          fontWeight: 50,
      },
        h5: {
          fontSize: '1.25rem',
          fontWeight: 50,
      },
        h6: {
          fontSize: '1rem',
          fontWeight: 50,
      },
    },
      shape: {
        borderRadius: currentConfig.borderRadius,
    },
      spacing: currentConfig.spacing,
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: currentConfig.borderRadius,
              textTransform: 'none',
              fontWeight: 50,
          },
        },
      },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: currentConfig.borderRadius * 1.5,
          },
        },
      },
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: currentConfig.borderRadius,
          },
        },
      },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: currentConfig.borderRadius * 2,
          },
        },
      },
    },
  });
}, [themeConfig, isDarkMode, user]);

  // Set theme config
  const setThemeConfig = useCallback((config: Partial<ThemeConfig>) => {
    setThemeConfigState(prev => ({ ...prev, ...config }));
}, []);

  // Toggle mode
  const toggleMode = useCallback(() => {
    if (themeConfig.mode === 'auto') {
      setThemeConfig({ mode: isDarkMode ? 'light' : 'dark' });
  } else {
      setThemeConfig({ mode: themeConfig.mode === 'light' ? 'dark' : 'light' });
  }
}, [themeConfig.mode, isDarkMode]);

  // Set mode
  const setMode = useCallback((mode: 'light' | 'dark' | 'auto') => {
    setThemeConfig({ mode,});
}, []);

  // Set primary color
  const setPrimaryColor = useCallback((color: string) => {
    setThemeConfig({ primaryColor: color,});
}, []);

  // Set secondary color
  const setSecondaryColor = useCallback((color: string) => {
    setThemeConfig({ secondaryColor: color,});
}, []);

  // Set accent color
  const setAccentColor = useCallback((color: string) => {
    setThemeConfig({ accentColor: color,});
}, []);

  // Set profession theme
  const setProfessionTheme = useCallback((profession: string, theme: any) => {
    setThemeConfig({
      professionThemes: {
        ...themeConfig.professionThemes,
        [profession]: {
          ...themeConfig.professionThemes[profession as keyof typeof themeConfig.professionThemes],
          ...theme,
      },
    },
  });
}, [themeConfig.professionThemes]);

  // Get profession theme
  const getProfessionTheme = useCallback((profession: string) => {
    return themeConfig.professionThemes[profession as keyof typeof themeConfig.professionThemes];
}, [themeConfig.professionThemes]);

  // Set component theme
  const setComponentTheme = useCallback((component: string, theme: any) => {
    setThemeConfig({
      componentThemes: {
        ...themeConfig.componentThemes,
        [component]: {
          ...themeConfig.componentThemes[component as keyof typeof themeConfig.componentThemes],
          ...theme,
      },
    },
  });
}, [themeConfig.componentThemes]);

  // Get component theme
  const getComponentTheme = useCallback((component: string) => {
    return themeConfig.componentThemes[component as keyof typeof themeConfig.componentThemes];
}, [themeConfig.componentThemes]);

  // Get color palette - uses helper function defined outside component
  const getColorPalette = useCallback((baseColor: string) => {
    return generateColorPalette(baseColor);
  }, []);

  // Get contrast color
  const getContrastColor = useCallback((backgroundColor: string) => {
    const hex = backgroundColor.replace(', #, ',', ');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
}, []);

  // Get accessible color
  const getAccessibleColor = useCallback((foreground: string, background: string) => {
    // Simple accessibility check - in a real app, you'd use a library like color2k
    const fg = foreground.replace('#', ', ');
    const bg = background.replace('#', ', ');
    
    const getLuminance = (hex: string) => {
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const [rs, gs, bs] = [rgb].map(c => 
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );
      
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

    const fgLuminance = getLuminance(fg);
    const bgLuminance = getLuminance(bg);
    const contrast = (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);

    return contrast >= 4.5 ? foreground : getContrastColor(background);
}, [getContrastColor]);

  // Save theme (DB + local fallback)
  const saveTheme = useCallback(() => {
    fetch('/api/user/ui-preferences', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ themeConfig: themeConfig }),
    }).catch(() => {});
    localStorage.setItem('theme-config', JSON.stringify(themeConfig));
  }, [themeConfig]);

  // Load theme (DB first, fallback to local)
  const loadTheme = useCallback(() => {
    fetch('/api/user/ui-preferences', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const cfg = j?.data?.theme_config;
        if (cfg) {
          setThemeConfigState(cfg);
          return;
        }
        const saved = localStorage.getItem('theme-config');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setThemeConfigState(parsed);
          } catch (error) {
            console.warn('Failed to load theme config:', error);
          }
        }
      })
      .catch(() => {
        const saved = localStorage.getItem('theme-config');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setThemeConfigState(parsed);
          } catch (error) {
            console.warn('Failed to load theme config:', error);
          }
        }
      });
  }, []);

  // Reset theme
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
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Hook to use theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
}
  return context;
};

export default ThemeContext;

