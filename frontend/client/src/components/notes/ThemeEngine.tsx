import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  ColorPicker,
  Palette,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
};
  typography: {
    fontFamily: string;
    fontSize: number;
    fontWeight: umber;
    lineHeight: number;
};
  spacing: {
    unit: number;
    padding: number;
    margin: number;
};
  borderRadius: {
    small: number;
    medium: number;
    large: number;
};
  shadows: {
    light: string;
    medium: string;
    heavy: string;
};
  animations: {
    duration: number;
    easing: string;
    enabled: boolean;
};
}

interface ThemeEngineProps {
  className?: string;
  onThemeChange?: (theme: ThemeConfig) => void;
  onThemeSave?: (theme: ThemeConfig) => void;
  onThemeExport?: (theme: ThemeConfig) => void
}

// Mock data
const defaultThemes: ThemeConfig[] = [
  {
    id: 'default',
    name: 'CreatorHub Default',
    description: 'The default CreatorHub theme with professional colors',
    colors: {
      primary: '#1976d0',
      secondary: '#dc0040',
      background: '#ffffff',
      surface: '#f5f5f0',
      text: '#212120',
      accent: '#ff9800'
},
    typography: {
      fontFamily: 'Roboto, sans-serif',
      fontSize:  14,
      fontWeight: 4,
      lineHeight: 1.5 },
    spacing: {
      unit: 8,
      padding:  16,
      margin: 8 },
    borderRadius: {
      small: 4,
      medium:  8,
      large: 16 },
    shadows: {
      light: '0 1px 3px rgba(0,0,0,0.12)',
      medium: '0 4px 6px rgba(0,0,0,0.16)',
      heavy: '0 10px 20px rgba(0,0,0,0.24)'
  },
    animations: {
      duration: 30,
      easing: 'cubic-bezier(0, .0, 0.2, 1)',
      enabled: true
}
},
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Dark theme for low-light environments',
    colors: {
      primary: '#90caf0',
      secondary: '#f48fb0',
      background: '#121210',
      surface: '#1e1e10',
      text: '#ffffff',
      accent: '#ffb74d'
},
    typography: {
      fontFamily: 'Roboto, sans-serif',
      fontSize:  14,
      fontWeight: 4,
      lineHeight: 1.5 },
    spacing: {
      unit: 8,
      padding:  16,
      margin: 8 },
    borderRadius: {
      small: 4,
      medium:  8,
      large: 16 },
    shadows: {
      light: '0 1px 3px rgba(25,255,255,0.12)',
      medium: '0 4px 6px rgba(25,255,255,0.16)',
      heavy: '0 10px 20px rgba(25,255,255,0.24)'
  },
    animations: {
      duration: 30,
      easing: 'cubic-bezier(0, .0, 0.2, 1)',
      enabled: true
}
},
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and minimal design with subtle colors',
    colors: {
      primary: '#424240',
      secondary: '#757570',
      background: '#fafafa',
      surface: '#ffffff',
      text: '#212120',
      accent: '#9e9e9e'
},
    typography: {
      fontFamily: 'Inter, sans-serif',
      fontSize:  14,
      fontWeight: 3,
      lineHeight: 1.6 },
    spacing: {
      unit: 12,
      padding:  24,
      margin: 12 },
    borderRadius: {
      small: 2,
      medium:  4,
      large: 8 },
    shadows: {
      light: '0 1px 2px rgba(0,0,0,0.05)',
      medium: '0 2px 4px rgba(0,0,0,0.08)',
      heavy: '0 4px 8px rgba(0,0,0,0.12)'
  },
    animations: {
      duration: 20,
      easing: 'ease-out',
      enabled: true
}
}
];

const ThemeEngine: React.FC<ThemeEngineProps> = ({
  className ='',
  onThemeChange,
  onThemeSave,
  onThemeExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig>(defaultThemes[0]);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [customThemes, setCustomThemes] = useState<ThemeConfig[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Handlers
  const handleThemeSelect = useCallback((theme: ThemeConfig) => {
    setSelectedTheme(theme);
    onThemeChange?.(theme);
}, [onThemeChange]);

  const handleThemeEdit = useCallback((theme: ThemeConfig) => {
    setSelectedTheme(theme);
    setIsEditing(true);
    setShowThemeEditor(true);
}, []);

  const handleThemeSave = useCallback(() => {
    const existingIndex = customThemes.findIndex(t => t.id === selectedTheme.id);
    if (existingIndex >= 0) {
      setCustomThemes(prev => prev.map((t, i) => i === existingIndex ? selectedTheme : t));
  } else {
      setCustomThemes(prev => [...prev, selectedTheme]);
  }
    onThemeSave?.(selectedTheme);
    setShowThemeEditor(false);
    setIsEditing(false);
}, [selectedTheme, customThemes, onThemeSave]);

  const handleThemeExport = useCallback(() => {
    onThemeExport?.(selectedTheme);
}, [selectedTheme, onThemeExport]);

  const handleThemeDelete = useCallback((themeId: string) => {
    setCustomThemes(prev => prev.filter(t => t.id !== themeId));
    if (selectedTheme.id === themeId) {
      setSelectedTheme(defaultThemes[0]);
}
}, [selectedTheme]);

  const handleColorChange = useCallback((colorType: keyof ThemeConfig['colors']value: string) => {
    setSelectedTheme(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorType]: value
    }
  }));
}, []);

  const handleTypographyChange = useCallback((property: keyof ThemeConfig['typography']value: any) => {
    setSelectedTheme(prev => ({
      ...prev,
      typography: {
        ...prev.typography,
        [property]: value
    }
  }));
}, []);

  const handleSpacingChange = useCallback((property: keyof ThemeConfig['spacing']value: number) => {
    setSelectedTheme(prev => ({
      ...prev,
      spacing: {
        ...prev.spacing,
        [property]: value
    }
  }));
}, []);

  const handleBorderRadiusChange = useCallback((property: keyof ThemeConfig['borderRadius']value: number) => {
    setSelectedTheme(prev => ({
      ...prev,
      borderRadius: {
        ...prev.borderRadius,
        [property]: value
    }
  }));
}, []);

  const handleAnimationChange = useCallback((property: keyof ThemeConfig['animations']value: any) => {
    setSelectedTheme(prev => ({
      ...prev,
      animations: {
        ...prev.animations,
        [property]: value
    }
  }));
}, []);

  const getThemeIcon = useCallback((themeId: string) => {
    switch (themeId) {
      case 'default': return <CREATOR_HUB_ICONS.palette />;
      case 'dark': return <CREATOR_HUB_ICONS.darkMode />;
      case 'minimal': return <CREATOR_HUB_ICONS.minimize />;
      default: return <CREATOR_HUB_ICONS.settings />;
}
}, []);

  // Memoized data
  const allThemes = useMemo(() => {
    return [...defaultThemes, ...customThemes];
}, [customThemes]);

  const themePreview = useMemo(() => ({
    backgroundColor: selectedTheme.colors.background,
    color: selectedTheme.colors.text,
    fontFamily: selectedTheme.typography.fontFamily,
    fontSize: selectedTheme.typography.fontSize,
    borderRadius: selectedTheme.borderRadius.medium,
    boxShadow: selectedTheme.shadows.medium,
    padding: selectedTheme.spacing.padding,
    margin: selectedTheme.spacing.margin
}), [selectedTheme]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.palette sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Theme Engine</Typography>
              <Typography variant="body2" color="text.secondary">
                Advanced theme customization and management
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedTheme({
                  ...defaultThemes[0],
                  id: `custom-${Date.now()}`,
                  name: 'New Theme',
                  description: 'Custom theme'
            });
                setIsEditing(true);
                setShowThemeEditor(true);
            }}
            >
              New Theme
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.edit sx={theming.getThemedButtonSx()} />}
              onClick={() => handleThemeEdit(selectedTheme)}
            >
              Edit
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Themes" icon={<CREATOR_HUB_ICONS.palette />} />
        <Tab label="Preview" icon={<CREATOR_HUB_ICONS.visibility />} />
        <Tab label="Export" icon={<CREATOR_HUB_ICONS.download />} />
      </Tabs>

      {/* Themes Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {allThemes.map((theme) => (
            <Grid item xs={12} sm={6} md={4} key={theme.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedTheme.id === theme.id ? 2 : 0,
                  borderColor: selectedTheme.id === theme.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleThemeSelect(theme)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getThemeIcon(theme.id)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {theme.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {theme.description}
                      </Typography>
                      
                      {/* Color Preview */}
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Box
                          sx={{
                            width:  20,
                            height:  20,
                            backgroundColor: theme.colors.primary,
                            borderRadius: '50, %',
                            border: '1px solid #ccc'}}
                        />
                        <Box
                          sx={{
                            width:  20,
                            height:  20,
                            backgroundColor: theme.colors.secondary,
                            borderRadius: '50, %',
                            border: '1px solid #ccc'}}
                        />
                        <Box
                          sx={{
                            width:  20,
                            height:  20,
                            backgroundColor: theme.colors.accent,
                            borderRadius: '50, %',
                            border: '1px solid #ccc'}}
                        />
                      </Stack>
                      
                      <Stack direction="row" spacing={1}>
                        <Chip 
                          label={theme.typography.fontFamily}
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={`${theme.typography.fontSize}px`}
                          size="small" 
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Preview Tab */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Theme Preview
          </Typography>
          <Paper 
            elevation={1}
            sx={{ 
              p:  3, 
              mb:  2,
              ...themePreview
          }}
           sx={theming.getThemedCardSx()}>
            <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
              Theme Preview
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              This is how your content will look with the selected theme. 
              The colors, typography, spacing, and other visual elements 
              are applied according to your theme configuration.
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button variant="contained" color="primary" sx={theming.getThemedButtonSx()}>
                Primary Button
              </Button>
              <Button variant="outlined" color="secondary">
                Secondary Button
              </Button>
              <Chip label="Chip" color="primary" />
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Export Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Export Theme
          </Typography>
          <Paper elevation={1} sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Stack spacing={2}>
              <Typography variant="body1">
                Export your theme configuration for sharing or backup.
              </Typography>
              <Button variant="contained"
                startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
                onClick={handleThemeExport}
              >
                Export Theme
              </Button>
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Theme Editor Dialog */}
      <Dialog open={showThemeEditor} onClose={() => setShowThemeEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.settings />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {isEditing ? 'Edit Theme' : 'Create Theme'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  2 }}>
            {/* Basic Info */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Basic Information
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Theme Name"
                  value={selectedTheme.name}
                  onChange={(e) => setSelectedTheme(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Description"
                  value={selectedTheme.description}
                  onChange={(e) => setSelectedTheme(prev => ({ ...prev, description: e.target.value }))}
                  fullWidth
                />
              </Stack>
            </Box>

            {/* Colors */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Colors
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(selectedTheme.colors).map(([key, value]) => (
                  <Grid item xs={6} sm={4} key={key}>
                    <Box>
                      <Typography variant="body2" gutterBottom sx={{ textTransform: 'capitalize'}}>
                        {key}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width:  40,
                            height:  40,
                            backgroundColor: value,
                            borderRadius:  1,
                            border: '1px solid #ccc'}}
                        />
                        <TextField
                          value={value}
                          onChange={(e) => handleColorChange(key as keyof ThemeConfig['colors'], e.target.value)}
                          size="small"
                          fullWidth
                        />
                      </Stack>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Typography */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Typography
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Font Family"
                    value={selectedTheme.typography.fontFamily}
                    onChange={(e) => handleTypographyChange('fontFamily', e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Font Size: {selectedTheme.typography.fontSize}px
                    </Typography>
                    <Slider
                      value={selectedTheme.typography.fontSize}
                      onChange={(_, value) => handleTypographyChange('fontSize', value)}
                      min={10}
                      max={24}
                      step={1}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Font Weight: {selectedTheme.typography.fontWeight}
                    </Typography>
                    <Slider
                      value={selectedTheme.typography.fontWeight}
                      onChange={(_, value) => handleTypographyChange('fontWeight', value)}
                      min={100}
                      max={900}
                      step={100}
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Line Height: {selectedTheme.typography.lineHeight}
                    </Typography>
                    <Slider
                      value={selectedTheme.typography.lineHeight}
                      onChange={(_, value) => handleTypographyChange('lineHeight', value)}
                      min={1}
                      max={2}
                      step={0.1}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Spacing */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Spacing
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Unit: {selectedTheme.spacing.unit}px
                    </Typography>
                    <Slider
                      value={selectedTheme.spacing.unit}
                      onChange={(_, value) => handleSpacingChange('unit', value)}
                      min={4}
                      max={16}
                      step={1}
                    />
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Padding: {selectedTheme.spacing.padding}px
                    </Typography>
                    <Slider
                      value={selectedTheme.spacing.padding}
                      onChange={(_, value) => handleSpacingChange('padding', value)}
                      min={8}
                      max={32}
                      step={2}
                    />
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Margin: {selectedTheme.spacing.margin}px
                    </Typography>
                    <Slider
                      value={selectedTheme.spacing.margin}
                      onChange={(_, value) => handleSpacingChange('margin', value)}
                      min={4}
                      max={24}
                      step={2}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Border Radius */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Border Radius
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Small: {selectedTheme.borderRadius.small}px
                    </Typography>
                    <Slider
                      value={selectedTheme.borderRadius.small}
                      onChange={(_, value) => handleBorderRadiusChange('small', value)}
                      min={0}
                      max={16}
                      step={1}
                    />
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Medium: {selectedTheme.borderRadius.medium}px
                    </Typography>
                    <Slider
                      value={selectedTheme.borderRadius.medium}
                      onChange={(_, value) => handleBorderRadiusChange('medium', value)}
                      min={0}
                      max={24}
                      step={1}
                    />
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Large: {selectedTheme.borderRadius.large}px
                    </Typography>
                    <Slider
                      value={selectedTheme.borderRadius.large}
                      onChange={(_, value) => handleBorderRadiusChange('large', value)}
                      min={0}
                      max={32}
                      step={1}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Animations */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Animations
              </Typography>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedTheme.animations.enabled}
                      onChange={(e) => handleAnimationChange('enabled', e.target.checked)}
                    />
                }
                  label="Enable Animations"
                />
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Duration: {selectedTheme.animations.duration}ms
                  </Typography>
                  <Slider
                    value={selectedTheme.animations.duration}
                    onChange={(_, value) => handleAnimationChange('duration', value)}
                    min={100}
                    max={1000}
                    step={50}
                    disabled={!selectedTheme.animations.enabled}
                  />
                </Box>
                <FormControl fullWidth>
                  <InputLabel>Easing</InputLabel>
                  <Select
                    value={selectedTheme.animations.easing}
                    onChange={(e) => handleAnimationChange('easing', e.target.value)}
                    disabled={!selectedTheme.animations.enabled}
                  >
                    <MenuItem value="ease">Ease</MenuItem>
                    <MenuItem value="ease-in">Ease In</MenuItem>
                    <MenuItem value="ease-out">Ease Out</MenuItem>
                    <MenuItem value="ease-in-out">Ease In Out</MenuItem>
                    <MenuItem value="cubic-bezier(0.40.2, 1)">Material Design</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowThemeEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleThemeSave}
           sx={theming.getThemedButtonSx()}>
            {isEditing ? 'Update' : 'Create'} Theme
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ThemeEngine;

