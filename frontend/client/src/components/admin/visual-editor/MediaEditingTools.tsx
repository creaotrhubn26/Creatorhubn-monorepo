/**
 * Advanced Media Editing Tools Component
 * Image cropping, SVG editing, font library, icon library, image filters
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  Card,
  CardContent,
  Slider,
  FormControl,
  Select,
  MenuItem,
  Chip,
  Stack,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import {
  Crop,
  Edit,
  FormatPaint,
  Tag,
  FilterList,
  FontDownload,
  Image,
} from '@mui/icons-material';

// Import helper functions separately

interface MediaEditingToolsProps {
  selectedProject?: { id: string; name?: string };
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void;
}

interface GoogleFont {
  family: string;
  category: string;
  variants?: string[];
}

const apiRequest = (url: string, init?: RequestInit): Promise<Response> => {
  return fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
};

export const MediaEditingTools: React.FC<MediaEditingToolsProps> = ({
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // State for various media tools
  const [imageCropOpen, setImageCropOpen] = useState(false);

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('media_editing_tools_render');
    
    lifecycle.registerComponent({
      id: 'MediaEditingTools',
      type: 'media-editing-tools',
      version: '1.0.0',
      capabilities: {
        data: ['image:crop','svg:edit','font:manage','icon:manage','filter:apply'],
        events: ['image:cropped','svg:edited','font:selected','icon:selected'],
        actions: ['image:crop','svg:edit','font:select','icon:select','filter:apply'],
        ui: ['crop:interface','svg:editor','font:library','icon:library'],
        system: ['performance:monitor','analytics:track','debug:log']
      },
      dependencies: ['@mui/material','EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    analytics.trackEvent('media_editing_tools_mounted', {
      componentId: 'MediaEditingTools',
      projectId: selectedProject?.id,
      timestamp: Date.now()
    });

    debugging.logIntegration('info', 'MediaEditingTools component mounted', {
      componentId: 'MediaEditingTools',
      projectId: selectedProject?.id
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('MediaEditingTools');
      analytics.trackEvent('media_editing_tools_unmounted', {
        componentId: 'MediaEditingTools',
        timestamp: Date.now()
      });
    };
  }, [analytics, lifecycle, performance, debugging, selectedProject?.id]);

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  const [svgEditorOpen, setSvgEditorOpen] = useState(false);
  const [fontLibraryOpen, setFontLibraryOpen] = useState(false);
  const [iconLibraryOpen, setIconLibraryOpen] = useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [imageFiltersOpen, setImageFiltersOpen] = useState(false);

  // Asset management state
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [selectedFont, setSelectedFont] = useState<string>('Roboto');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<Record<string, unknown>[]>([]);

  // Font and icon libraries
  const [googleFonts, setGoogleFonts] = useState<GoogleFont[]>([]);
  const [fontWeights] = useState(['300','400','500','600','700']);
  const [fontStyles] = useState(['normal','italic']);

  // Image filter state
  const [imageFilters, setImageFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    opacity: 100 });

  const [imageCrop, setImageCrop] = useState({
    x: 0,
    y: 0,
    width: 100,
    height: 100 });

  const [svgCode, setSvgCode] = useState('');

  // Google Fonts Integration
  const loadGoogleFonts = useCallback(async () => {
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/google/fonts', { headers });

      if (response.ok) {
        const fonts = (await response.json()) as { items?: GoogleFont[] };
        const fontItems = Array.isArray(fonts.items) ? fonts.items : [];
        setGoogleFonts(fontItems);
        
        onNotificationCreate?.({
          id: `google_fonts_loaded_${Date.now()}`,
          type: 'project_updated',
          title: 'Google Fonts Loaded',
          message: `Loaded ${fontItems.length} fonts`,
          priority: 'low',
          source: 'media_editor',
          timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
      console.error('Failed to load Google Fonts: ', error);
  }
}, [onNotificationCreate]);

  // Image cropping functionality
  const handleImageCrop = useCallback((x: number, y: number, width: number, height: number) => {
    setImageCrop({ x, y, width, height });
  }, []);

  const applyImageCrop = useCallback(() => {
    // Implementation would interface with image library
    onNotificationCreate?.({
      id: `image_cropped_${Date.now()}`,
      type: 'image_cropped',
      title: 'Image Cropped',
      message: 'Image criteria applied successfully',
      priority: 'low',
      source: 'media_editor',
      timestamp: new Date().toISOString()
  });
    
    setImageCropOpen(false);
}, [onNotificationCreate]);

  // Image filter functionality
  const applyImageFilter = useCallback((elementId: string, filterType: string, value: number) => {
    setImageFilters(prev => ({
      ...prev,
      [filterType]: value
  }));
    
    // Apply filter to canvas element
    onNotificationCreate?.({
      id: `image_filter_applied_${Date.now()}`,
      type: 'project_updated',
      title: 'Image Filter Applied',
      message: `${filterType} applied with value ${value}`,
      priority: 'low',
      source: 'media_editor',
      timestamp: new Date().toISOString()
  });
}, [onNotificationCreate]);

  const resetImageFilters = useCallback(() => {
    setImageFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      opacity: 100 });
}, []);

  // SVG Editor functionality
  const handleSvgCodeChange = useCallback((value: string) => {
    setSvgCode(value);
}, []);

  const saveSvg = useCallback(async () => {
    try {
      const response = await apiRequest('/api/assets/save-svg', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ svgContent: svgCode })
    });
      
      if (response.ok) {
        onNotificationCreate?.({
          id: `svg_saved_${Date.now()}`,
          type: 'project_updated',
          title: 'SVG Saved',
          message: 'SVG has been saved successfully',
          priority: 'medium',
          source: 'media_editor',
          timestamp: new Date().toISOString()
      });
        setSvgEditorOpen(false);
    }
  } catch (error) {
      console.error('Failed to save SVG:', error);
  }
}, [svgCode, onNotificationCreate]);

  // Font management
  const applyFont = useCallback((fontFamily: string, fontWeight: string, fontStyle: string) => {
    // Apply font to selected elements
    void fontWeight;
    void fontStyle;
    
    onNotificationCreate?.({
      id: `font_applied_${Date.now()}`,
      type: 'project_updated',
      title: 'Font Applied',
      message: `Font ${fontFamily} applied to selected elements`,
      priority: 'medium',
      source: 'media_editor',
      timestamp: new Date().toISOString()
  });
    
    setFontLibraryOpen(false);
}, [onNotificationCreate]);

  const searchAssets = useCallback((query: string) => {
    setAssetSearchQuery(query);
}, []);

  useEffect(() => {
    loadGoogleFonts();
}, [loadGoogleFonts]);

  return (
    <Paper sx={{ p: 3, m: 2, ...theming.getThemedCardSx() }}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        {theming.getThemedIcon('edit')}
        Media Editing Tools
      </Typography>

      <Grid container spacing={2}>
        {/* Image Crop Tool */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <Crop color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Image Crop</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Crop and resize your images
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setImageCropOpen(true)}
              >
                Open Crop Tool
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* SVG Editor */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <Edit color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>SVG Editor</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Edit SVG graphics and vectors
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setSvgEditorOpen(true)}
              >
                Edit SVG
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Font Library */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <FontDownload color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Fonts</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Google Fonts & typography
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setFontLibraryOpen(true)}
              >
                Open Fonts
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Icon Library */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <Tag color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Icons</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Professional icons & symbols
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setIconLibraryOpen(true)}
              >
                Open Icons
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Image Filters */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <FilterList color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Image Filters</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Adjust color, brightness, effects
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setImageFiltersOpen(true)}
              >
                Open Filters
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Asset Library */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <Image color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Asset Library</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                View & manage all assets
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setAssetLibraryOpen(true)}
              >
                View Assets
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Image Crop Dialog */}
      <Dialog
        open={imageCropOpen}
        onClose={() => setImageCropOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Image Crop</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Would contain actual crop controls here - interface to external library */}
            <Box sx={{ 
              border: '2px dashed #ccc', 
              minHeight: 300, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#f9f9f9'
          }}>
              <Typography>Image crop area will be shown here</Typography>
            </Box>
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Width</Typography>
                <TextField 
                  type="number" 
                  fullWidth 
                  value={imageCrop.width}
                  onChange={(e) => handleImageCrop(imageCrop.x, imageCrop.y, parseInt(e.target.value), imageCrop.height)}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Height</Typography>
                <TextField 
                  type="number" 
                  fullWidth 
                  value={imageCrop.height}
                  onChange={(e) => handleImageCrop(imageCrop.x, imageCrop.y, imageCrop.width, parseInt(e.target.value))}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageCropOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={applyImageCrop} sx={theming.getThemedButtonSx()}>Apply Crop</Button>
        </DialogActions>
      </Dialog>

      {/* SVG Editor Dialog */}
      <Dialog
        open={svgEditorOpen}
        onClose={() => setSvgEditorOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>SVG Editor</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={10}
              placeholder="Paste your SVG code here..."
              value={svgCode}
              onChange={(e) => handleSvgCodeChange(e.target.value)}
              sx={{ fontFamily: 'monospace', mb: 2 }}
            />
            
            <Box sx={{ 
              border: '1px solid #ccc', 
              minHeight: 200, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#f9f9f9'
          }}>
              <Typography color="text.secondary">SVG preview will appear here</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSvgEditorOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveSvg} sx={theming.getThemedButtonSx()}>Save SVG</Button>
        </DialogActions>
      </Dialog>

      {/* Font Library Dialog */}
      <Dialog
        open={fontLibraryOpen}
        onClose={() => setFontLibraryOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <FormatPaint />
            Font Library
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {googleFonts.slice(0, 12).map((font, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    border: selectedFont === font.family ? 2 : 1,
                    borderColor: selectedFont === font.family ? 'primary.main' : 'divider',
                    '&:hover': { borderColor: 'primary.main' },
                    ...theming.getThemedCardSx()
                }}
                  onClick={() => setSelectedFont(font.family)}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" 
                      sx={{ 
                        fontFamily: font.family,
                        mb: 1,
                        color: theming.colors.primary
                    }}>
                      {font.family}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {font.category}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFontLibraryOpen(false)}>Cancel</Button>
          <Button variant="contained"
            onClick={() => applyFont(selectedFont, '400','normal')}
            sx={theming.getThemedButtonSx()}
          >
            Apply Font
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Filters Dialog */}
      <Dialog
        open={imageFiltersOpen}
        onClose={() => setImageFiltersOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Image Filters</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Brightness</Typography>
                <Slider
                  min={0}
                  max={200}
                  value={imageFilters.brightness}
                  onChange={(_, value) => applyImageFilter(', ','brightness', value as number)}
                />
                <Typography variant="caption">{imageFilters.brightness}%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Contrast</Typography>
                <Slider
                  min={0}
                  max={200}
                  value={imageFilters.contrast}
                  onChange={(_, value) => applyImageFilter(', ','contrast', value as number)}
                />
                <Typography variant="caption">{imageFilters.contrast}%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Saturation</Typography>
                <Slider
                  min={0}
                  max={200}
                  value={imageFilters.saturation}
                  onChange={(_, value) => applyImageFilter(', ','saturation', value as number)}
                />
                <Typography variant="caption">{imageFilters.saturation}%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Hue</Typography>
                <Slider
                  min={0}
                  max={360}
                  value={imageFilters.hue}
                  onChange={(_, value) => applyImageFilter(', ','hue', value as number)}
                />
                <Typography variant="caption">{imageFilters.hue}°</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Blur</Typography>
                <Slider
                  min={0}
                  max={10}
                  value={imageFilters.blur}
                  onChange={(_, value) => applyImageFilter(', ','blur', value as number)}
                />
                <Typography variant="caption">{imageFilters.blur}px</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Opacity</Typography>
                <Slider
                  min={0}
                  max={100}
                  value={imageFilters.opacity}
                  onChange={(_, value) => applyImageFilter(', ','opacity', value as number)}
                />
                <Typography variant="caption">{imageFilters.opacity}%</Typography>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageFiltersOpen(false)}>Close</Button>
          <Button onClick={resetImageFilters}>Reset</Button>
        </DialogActions>
      </Dialog>

      {/* Asset Library Dialog */}
      <Dialog
        open={assetLibraryOpen}
        onClose={() => setAssetLibraryOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Advanced Asset Library</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Search and Filter */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Search assets..."
                value={assetSearchQuery}
                onChange={(e) => searchAssets(e.target.value)}
                InputProps={{
                  startAdornment: theming.getThemedIcon('search')
              }}
              />
            </Box>

            {/* Categories */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Categories</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {['Images', 'Icons', 'Vectors', 'Fonts', 'Videos', 'Audio'].map((category) => (
                  <Chip
                    key={category}
                    label={category}
                    variant="outlined"
                    onClick={() => {
                      // Filter by category
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Asset Grid - placeholder for real data */}
            <Alert severity="info">
              Asset gallery would be displayed here with search results
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssetLibraryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Icon Library Dialog */}
      <Dialog
        open={iconLibraryOpen}
        onClose={() => setIconLibraryOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Tag />
            Icon Library
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs value={0} sx={{ mb: 2 }}>
            <Tab label="CreatorHub Icons" />
            <Tab label="Material UI Icons" />
            <Tab label="Custom Icons" />
          </Tabs>
          
          {/* Placeholder icon grid */}
          <Grid container spacing={1}>
            {/* Would contain actual icon grid here */}
            {Array.from({ length: 24 }).map((_, index) => (
              <Grid item xs={2} key={index}>
                <Card sx={{ cursor: 'pointer', minHeight: 80, p: 1, ...theming.getThemedCardSx() }}>
                  <CardContent 
                    onClick={() => setSelectedIcon(`icon_${index}`)}
                    sx={{ 
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                    }}
                  >
                    <Box textAlign="center">
                      <Typography variant="caption">Icon {index + 1}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIconLibraryOpen(false)}>Cancel</Button>
          <Button variant="contained"
            disabled={!selectedIcon}
            sx={theming.getThemedButtonSx()}>
            Select Icon
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};


export default MediaEditingTools;
