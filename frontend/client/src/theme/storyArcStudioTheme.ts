import { createTheme } from '@mui/material';

/**
 * Story Arc Studio by CreatorHub Norge Theme System
 * Professional dark video editing interface theme
 * Built exclusively with Material UI components
 */

export const makeStoryArcStudioTheme = (mode: PaletteMode = 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: '#FF8A00', // CreatorHub Norge amber
        light: '#FFA733',
        dark: '#CC6F00',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#7C5CFF', // Violet accent
        light: '#A085FF',
        dark: '#5C3FFF',
        contrastText: '#E6EDF3',
      },
      success: {
        main: '#23C3A6', // Teal success
        light: '#4DD4BD',
        dark: '#1AA085',
        contrastText: '#E6EDF3',
      },
      warning: {
        main: '#F3B562', // Warm amber
        light: '#F6C784',
        dark: '#F0A340',
        contrastText: '#0B0E12',
      },
      error: {
        main: '#FF6B6B', // Soft red
        light: '#FF8E8E',
        dark: '#FF4848',
        contrastText: '#E6EDF3',
      },
      info: {
        main: '#A0E7E5', // Light cyan
        light: '#C2F0EF',
        dark: '#7EDEDA',
        contrastText: '#0B0E12',
      },
      background: {
        default: '#0B0E12', // Editor canvas - ultra dark
        paper: '#11151B', // Panels/cards - dark grey
      },
      divider: 'rgba(255,255,255,0.08)',
      text: {
        primary: '#E6EDF3', // Light text
        secondary: 'rgba(230,237,243,0.7)', // Muted text
        disabled: 'rgba(230,237,243,0.38)', // Disabled text
      },
    },
    typography: {
      fontFamily: '"SF Pro Display","Segoe UI","Roboto","Arial",sans-serif',
      h1: { fontSize: '2.5rem', fontWeight: 700, color: '#E6EDF3' },
      h2: { fontSize: '2rem', fontWeight: 600, color: '#E6EDF3' },
      h3: { fontSize: '1.75rem', fontWeight: 600, color: '#E6EDF3' },
      h4: { fontSize: '1.5rem', fontWeight: 500, color: '#E6EDF3' },
      h5: { fontSize: '1.25rem', fontWeight: 500, color: '#E6EDF3' },
      h6: { fontSize: '1rem', fontWeight: 500, color: '#E6EDF3' },
      body1: { fontSize: '0.875rem', color: '#E6EDF3' },
      body2: { fontSize: '0.75rem', color: 'rgba(230,237,243,0.7)' },
      button: { fontSize: '0.8rem', fontWeight: 500, textTransform: 'none' },
      caption: { fontSize: '0.7rem', color: 'rgba(230,237,243,0.6)' },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: '#11151B',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: 'none',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: '48px !important',
            padding: '0 16px',
            background:
              'linear-gradient(135deg, rgba(255,138,0,0.1) 0%, rgba(124,92,255,0.05) 100%)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: '#11151B',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.05)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 500,
          },
          contained: {
            background: 'linear-gradient(135deg, #FF8A00 0%, #FFA733 100%)',
            boxShadow: '0 2px 8px rgba(255,138,0,0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #E67A00 0%, #FF9520 100%)',
              boxShadow: '0 4px 12px rgba(255,138,0,0.4)',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: '#E6EDF3',
            '&:hover': {
              backgroundColor: 'rgba(255,138,0,0.1)',
              color: '#FF8A00',
            },
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: {
            color: '#FF8A00',
            '& .MuiSlider-track': {
              background: 'linear-gradient(90deg, #FF8A00 0%, #FFA733 100%)',
            },
            '& .MuiSlider-thumb': {
              backgroundColor: '#FF8A00',
              border: '2px solid #0B0E12',
              '&:hover': {
                boxShadow: '0 0 0 8px rgba(255,138,0,0.16)',
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255,138,0,0.1)',
            color: '#FF8A00',
            border: '1px solid rgba(255,138,0,0.3)',
            '& .MuiChip-deleteIcon': {
              color: 'rgba(255,138,0,0.7)',
              '&:hover': { color: '#FF8A00' },
            },
          },
        },
      },
    },
  });

// Story Arc Studio Color System for Component Usage
export const storyArcStudioColors = {
  // Professional video editing accent colors
  accents: {
    primary: '#FF8A00', // CreatorHub Norge amber
    secondary: '#7C5CFF', // Violet accent
    focus: '#FFA733', // Bright amber for focus states
    hover: '#CC6F00', // Darker amber for hover
    playhead: '#FF6B00', // Playhead indicator
    selection: '#FFB366', // Selection highlight
    timeline: '#2A2F37', // Timeline background
    track: '#1E2328', // Track background
},

  // Track color mapping for different content types
  tracks: {
    primary_story: '#FF8A00', // Main story - amber
    b_story: '#7C5CFF', // B-roll - violet
    dialogue: '#23C3A6', // Dialogue - teal
    music: '#F3B562', // Music - warm amber
    sound_effects: '#A0E7E5', // SFX - cyan
    graphics: '#FF6B6B', // Graphics - soft red
    narration: '#9CCAFF', // Narration - light blue
    color_correction: '#4DD4BD', // Color - light teal
},

  // Emotional arc visualization colors
  emotions: {
    joy: '#FFD700', // Gold
    sadness: '#6B73FF', // Blue
    excitement: '#FF4081', // Pink
    calm: '#4CAF50', // Green
    tension: '#FF5722', // Red-orange
    romance: '#E91E63', // Deep pink
},

  // Emotional value intensity colors
  emotionalValues: {
    '-1.0' : '#FF4444', // Very negative (red)
    '-0.5' : '#FF8800', // Negative (orange)
    '0.0' : '#888888', // Neutral (gray)
    '0.5' : '#44AA44', // Positive (green)
    '1.0' : '#4488FF', // Very positive (blue)
},

  // UI state colors
  states: {
    success: '#23C3A6',
    warning: '#F3B562',
    error: '#FF6B6B',
    info: '#A0E7E5',
    disabled: '#666666',
},

  // Background and surface colors
  surfaces: {
    canvas: '#0B0E12', // Ultra dark canvas
    panel: '#11151B', // Dark panels
    card: '#1A1F26', // Cards and containers
    toolbar: '#0F1419', // Toolbars
    modal: '#161B22', // Modal backgrounds
},
};

// Default theme instance
export const storyArcStudioTheme = makeStoryArcStudioTheme();

// Export as legacy name for backward compatibility
export const finalCutProTheme = storyArcStudioTheme;
export const makeFinalCutProTheme = makeStoryArcStudioTheme;
export const finalCutProColors = storyArcStudioColors;
