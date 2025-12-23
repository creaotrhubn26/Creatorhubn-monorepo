import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Stack,
  Tabs,
  Tab,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
} from '@mui/material';
import {
  Palette,
  Typography as TypographyIcon,
  Image,
  Code,
  Settings,
  Preview,
  Save,
  Refresh,
  Upload,
  Download,
} from '@mui/icons-material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

export interface ThemeConfig {
  id: string;
  name: string;
  colors: ColorPalette;
  typography: TypographyConfig;
  spacing: SpacingConfig;
  borderRadius: BorderRadiusConfig;
  shadows: ShadowConfig
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    disabled: string;
};
  divider: string
}

export interface TypographyConfig {
  fontFamily: string;
  fontSize: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
    body1: number;
    body2: number;
    caption: number;
};
  fontWeight: 
    light: number;
    regular: number;
    medium: number;
    bold: number;
};
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
};
}

export interface SpacingConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number
}

export interface BorderRadiusConfig {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number
}

export interface ShadowConfig {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string
}

export interface BrandingConfig {
  logo: string;
  favicon: string;
  companyName: string;
  tagline: string;
  customCSS: string;
  customJS: string
}

export interface WhiteLabelConfig {
  enabled: boolean;
  domain: string;
  customDomain: string;
  removeCreatorHubBranding: boolean;
  customFooter: string;
  customHeader: string;
  customFavicon: string
}

interface CustomizationSystemProps {
  theme: ThemeConfig;
  branding: BrandingConfig;
  whiteLabel: WhiteLabelConfig;
  onThemeChange: (theme: ThemeConfig) => void;
  onBrandingChange: (branding: BrandingConfig) => void;
  onWhiteLabelChange: (whiteLabel: WhiteLabelConfig) => void;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (config: any) => void
}

export default function CustomizationSystem({
  theme,
  branding,
  whiteLabel,
  onThemeChange,
  onBrandingChange,
  onWhiteLabelChange,
  onSave,
  onReset,
  onExport,
  onImport,
}: CustomizationSystemProps) {
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showPreview, setShowPreview] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleThemeChange = useCallback((updates: Partial<ThemeConfig>) => {
    onThemeChange({ ...theme, ...updates });
}, [theme, onThemeChange]);

  const handleBrandingChange = useCallback((updates: Partial<BrandingConfig>) => {
    onBrandingChange({ ...branding, ...updates });
}, [branding, onBrandingChange]);

  const handleWhiteLabelChange = useCallback((updates: Partial<WhiteLabelConfig>) => {
    onWhiteLabelChange({ ...whiteLabel, ...updates });
}, [whiteLabel, onWhiteLabelChange]);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          onImport(config);
          setShowImportDialog(false);
    } catch (error) {
          console.error('Failed to import configuration: ', error);
      }
    };
      reader.readAsText(file);
  }
};

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Customization</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<CREATOR_HUB_ICONS.visibility />}
              onClick={() => setShowPreview(true)}
            >
              Preview
            </Button>
            <Button
              size="small"
              startIcon={<CREATOR_HUB_ICONS.download />}
              onClick={onExport}
            >
              Export
            </Button>
            <Button
              size="small"
              startIcon={<CREATOR_HUB_ICONS.upload />}
              onClick={() => setShowImportDialog(true)}
            >
              Import
            </Button>
            <Button
              size="small"
              startIcon={<CREATOR_HUB_ICONS.refresh />}
              onClick={onReset}
            >
              Reset
            </Button>
            <Button variant="contained"
              size="small"
              startIcon={<CREATOR_HUB_ICONS.save sx={theming.getThemedButtonSx()} />}
              onClick={onSave}
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={theming.getThemedCardSx()}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab icon={<CREATOR_HUB_ICONS.palette />} label="Theme" />
          <Tab icon={<CREATOR_HUB_ICONS.typography />} label="Typography" />
          <Tab icon={<CREATOR_HUB_ICONS.image />} label="Branding" />
          <Tab icon={<CREATOR_HUB_ICONS.code />} label="Custom Code" />
          <Tab icon={<CREATOR_HUB_ICONS.settings />} label="White Label" />
        </Tabs>

        <Box sx={{ p:  3 }}>
          {activeTab === 0 && <ThemeEditor theme={theme} onChange={handleThemeChange} />}
          {activeTab === 1 && <TypographyEditor theme={theme} onChange={handleThemeChange} />}
          {activeTab === 2 && <BrandingEditor branding={branding} onChange={handleBrandingChange} />}
          {activeTab === 3 && <CustomCodeEditor branding={branding} onChange={handleBrandingChange} />}
          {activeTab === 4 && <WhiteLabelEditor whiteLabel={whiteLabel} onChange={handleWhiteLabelChange} />}
        </Box>
      </Paper>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Theme Preview</DialogTitle>
        <DialogContent>
          <ThemePreview theme={theme} branding={branding} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)}>
        <DialogTitle>Import Configuration</DialogTitle>
        <DialogContent>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ marginTop: 16}}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Theme Editor Component
interface ThemeEditorProps {
  theme: ThemeConfig;
  onChange: (updates: Partial<ThemeConfig>) => void
}

function ThemeEditor({ theme, onChange }: ThemeEditorProps) {
  const handleColorChange = (colorKey: keyof ColorPalette, value: string) => {
    onChange({
      colors: { ...theme.colors, [colorKey]: value }
  });
};

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Color Palette
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(theme.colors).map(([key, value]) => (
          <Grid item xs={12} sm={6} md={4} key={key}>
            <Box>
              <Typography variant="body2" gutterBottom>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width:  40,
                    height:  40,
                    backgroundColor: value,
                    border: '1px solid #ccc',
                    borderRadius:  1}}
                />
                <TextField
                  size="small"
                  value={value}
                  onChange={(e) => handleColorChange(key as keyof ColorPalette, e.target.value)}
                  sx={{ flex:  1 }}
                />
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my:  3 }} />

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Spacing
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(theme.spacing).map(([key, value]) => (
          <Grid item xs={6} sm={4} key={key}>
            <Box>
              <Typography variant="body2" gutterBottom>
                {key.toUpperCase()}
              </Typography>
              <Slider
                value={value}
                onChange={(_, newValue) => onChange({
                  spacing: { ...theme.spacing, [key]: newValue as number }
              })}
                min={0}
                max={32}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my:  3 }} />

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Border Radius
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(theme.borderRadius).map(([key, value]) => (
          <Grid item xs={6} sm={4} key={key}>
            <Box>
              <Typography variant="body2" gutterBottom>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <Slider
                value={value}
                onChange={(_, newValue) => onChange({
                  borderRadius: { ...theme.borderRadius, [key]: newValue as number }
              })}
                min={0}
                max={24}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// Typography Editor Component
interface TypographyEditorProps {
  theme: ThemeConfig;
  onChange: (updates: Partial<ThemeConfig>) => void
}

function TypographyEditor({ theme, onChange }: TypographyEditorProps) {
  const handleFontFamilyChange = (value: string) => {
    onChange({
      typography: { ...theme.typography, fontFamily: value }
  });
};

  const handleFontSizeChange = (key: keyof ThemeConfig['typography']['fontSize']value: number) => {
    onChange({
      typography: {
        ...theme.typography,
        fontSize: { ...theme.typography.fontSize, [key]: value }
    }
  });
};

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Font Family
      </Typography>
      <FormControl fullWidth sx={{ mb:  3 }}>
        <InputLabel>Font Family</InputLabel>
        <Select
          value={theme.typography.fontFamily}
          label="Font Family"
          onChange={(e) => handleFontFamilyChange(e.target.value)}
        >
          <MenuItem value="Roboto, sans-serif">Roboto</MenuItem>
          <MenuItem value="Inter, sans-serif">Inter</MenuItem>
          <MenuItem value="Open Sans, sans-serif">Open Sans</MenuItem>
          <MenuItem value="Lato, sans-serif">Lato</MenuItem>
          <MenuItem value="Montserrat, sans-serif">Montserrat</MenuItem>
          <MenuItem value="Poppins, sans-serif">Poppins</MenuItem>
        </Select>
      </FormControl>

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Font Sizes
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(theme.typography.fontSize).map(([key, value]) => (
          <Grid item xs={6} sm={4} key={key}>
            <Box>
              <Typography variant="body2" gutterBottom>
                {key.toUpperCase()}
              </Typography>
              <Slider
                value={value}
                onChange={(_, newValue) => handleFontSizeChange(key as keyof ThemeConfig['typography'],['fontSize'], newValue as number)}
                min={8}
                max={48}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// Branding Editor Component
interface BrandingEditorProps {
  branding: BrandingConfig;
  onChange: (updates: Partial<BrandingConfig>) => void
}

function BrandingEditor({ branding, onChange }: BrandingEditorProps) {
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Company Branding
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Company Name"
            value={branding.companyName}
            onChange={(e) => onChange({ companyName: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Tagline"
            value={branding.tagline}
            onChange={(e) => onChange({ tagline: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Logo URL"
            value={branding.logo}
            onChange={(e) => onChange({ logo: e.target.value })}
            helperText="Enter the URL of your logo image"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Favicon URL"
            value={branding.favicon}
            onChange={(e) => onChange({ favicon: e.target.value })}
            helperText="Enter the URL of your favicon (16x16 or 32x32 pixels)"
          />
        </Grid>
      </Grid>
    </Box>
  );
}

// Custom Code Editor Component
interface CustomCodeEditorProps {
  branding: BrandingConfig;
  onChange: (updates: Partial<BrandingConfig>) => void
}

function CustomCodeEditor({ branding, onChange }: CustomCodeEditorProps) {
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Custom CSS
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={8}
        value={branding.customCSS}
        onChange={(e) => onChange({ customCSS: e.target.value })}
        placeholder="/* Enter your custom CSS here */"
        sx={{ fontFamily: 'monospace', mb:  3 }}
      />

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Custom JavaScript
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={8}
        value={branding.customJS}
        onChange={(e) => onChange({ customJS: e.target.value })}
        placeholder="// Enter your custom JavaScript here"
        sx={{ fontFamily: 'monospace'}}
      />
    </Box>
  );
}

// White Label Editor Component
interface WhiteLabelEditorProps {
  whiteLabel: WhiteLabelConfig;
  onChange: (updates: Partial<WhiteLabelConfig>) => void
}

function WhiteLabelEditor({ whiteLabel, onChange }: WhiteLabelEditorProps) {
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        White Label Configuration
      </Typography>
      
      <FormControlLabel
        control={
          <Switch
            checked={whiteLabel.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
      }
        label="Enable White Label"
        sx={{ mb:  2 }}
      />

      {whiteLabel.enabled && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Custom Domain"
              value={whiteLabel.customDomain}
              onChange={(e) => onChange({ customDomain: e.target.value })}
              placeholder="docs.yourcompany.com"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Favicon URL"
              value={whiteLabel.customFavicon}
              onChange={(e) => onChange({ customFavicon: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={whiteLabel.removeCreatorHubBranding}
                  onChange={(e) => onChange({ removeCreatorHubBranding: e.target.checked })}
                />
            }
              label="Remove CreatorHub Branding"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Custom Footer"
              value={whiteLabel.customFooter}
              onChange={(e) => onChange({ customFooter: e.target.value })}
              placeholder="Enter custom footer content"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Custom Header"
              value={whiteLabel.customHeader}
              onChange={(e) => onChange({ customHeader: e.target.value })}
              placeholder="Enter custom header content"
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

// Theme Preview Component
interface ThemePreviewProps {
  theme: ThemeConfig;
  branding: BrandingConfig
}

function ThemePreview({ theme, branding }: ThemePreviewProps) {
  return (
    <Box sx={{ p:  3, bgcolor: theme.colors.background }}>
      <Typography variant="h1" sx={{ color: theme.colors.text.primary, mb:  2, color: theming.colors.primary }}>
        {branding.companyName || 'Your Company'}
      </Typography>
      <Typography variant="h6" sx={{ color: theme.colors.text.secondary, mb:  3, color: theming.colors.primary }}>
        {branding.tagline ||'Your tagline here'}
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2, bgcolor: theme.colors.surface ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h5" gutterBottom sx={{ color: theme.colors.primary, color: theming.colors.primary }}>
          Sample Content
        </Typography>
        <Typography variant="body1" sx={{ color: theme.colors.text.primary, mb:  2 }}>
          This is a preview of how your content will look with the selected theme.
        </Typography>
        <Button variant="contained" sx={{ bgcolor: theme.colors.primary, mr:  1 ,  ...theming.getThemedButtonSx() }}>
          Primary Button
        </Button>
        <Button variant="outlined" sx={{ borderColor: theme.colors.primary, color: theme.colors.primary }}>
          Secondary Button
        </Button>
      </Paper>
    </Box>
  );
}
