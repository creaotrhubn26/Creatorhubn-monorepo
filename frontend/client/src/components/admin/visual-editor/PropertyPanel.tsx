/**
 * Property Panel Component
 * Right panel for editing element properties
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  Grid,
  Divider,
} from '@mui/material';
import { FormatSize, BorderAll, Layers } from '@mui/icons-material';

interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Record<string, unknown>;
  props: Record<string, unknown>;
}

interface PropertyPanelProps {
  selectedElements: EditorElement[];
  onUpdateElements: (updates: { id: string; styles?: Record<string, unknown>; props?: Record<string, unknown> }[]) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElements,
  onUpdateElements,
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [activeTab, setActiveTab] = useState(0);

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('property_panel_render');

    lifecycle.registerComponent({
      id: 'PropertyPanel,',
      type: 'property-panel',
      version: '1.0.0',
      capabilities: {
        data: ['property:read','property:write','element:update'],
        events: ['property:changed','element:updated','tab:switched'],
        actions: ['property:edit','style:apply','prop:update'],
        ui: ['property:display','form:interact','tab:show'],
        system: ['performance:monitor','analytics:track','debug:log'],
      },
      dependencies: ['@mui/material','EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('property_panel_mounted', {
      componentId: 'PropertyPanel',
      selectedElementsCount: selectedElements.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'PropertyPanel component mounted', {
      componentId: 'PropertyPanel',
      selectedElementsCount: selectedElements.length,
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('PropertyPanel');
      analytics.trackEvent('property_panel_unmounted', {
        componentId: 'PropertyPanel',
        timestamp: Date.now(),
      });
    };
  }, [analytics, lifecycle, performance, debugging, selectedElements.length]);
  
  const handlePropertyUpdate = useCallback((property: string, value: unknown, type: 'style' | 'prop' = 'style') => {
    const updates = selectedElements.map(element => ({
      id: element.id,
      [type]: type === 'style'
        ? { ...element.styles, [property]: value }
        : { ...element.props, [property]: value },
    }));

    onUpdateElements(updates);
  }, [selectedElements, onUpdateElements]);

  const handlePositionUpdate = useCallback((property: 'x' | 'y' | 'width' | 'height', value: number) => {
    const updates = selectedElements.map(element => ({
      id: element.id,
      props: {
        ...element.props,
        [property]: value,
      },
    }));

    onUpdateElements(updates);
  }, [selectedElements, onUpdateElements]);

  // Get common properties across selected elements
  const getCommonProperty = (property: string, type: 'styles' | 'props' = 'styles') => {
    if (selectedElements.length === 0) return '';

    const values = selectedElements.map(el => {
      const obj = type === 'styles' ? el.styles : el.props;
      return obj[property];
    });

    const unique = Array.from(new Set(values));
    return unique.length === 1 ? unique[0] : '';
  };

  const getFirstElement = () => selectedElements[0];

  if (selectedElements.length === 0) {
    return (
      <Paper sx={{ ...theming.getThemedCardSx(), p: 3, height: '100%' }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Properties
        </Typography>
        <Typography color="text.secondary">
          Select an element to edit its properties
        </Typography>
      </Paper>
    );
}

  const isTextElement = getFirstElement()?.type === 'text';
  const isImageElement = getFirstElement()?.type === 'image';

  return (
    <Paper sx={{ height: '100%', overflow: 'auto',  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  p: 2, borderBottom: 1, borderColor: 'divider' }}>
        Properties ({selectedElements.length} selected)
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
        <Tabs value={activeTab} onChange={(_, tab) => setActiveTab(tab)}>
          <Tab label="Style" />
          <Tab label="Content" />
          <Tab label="Layout" />
          <Tab label="Effects" />
        </Tabs>
      </Box>

      {/* Style Tab */}
      {activeTab === 0 && (
        <Box sx={{ p:  2 }}>
          {/* Text Styling */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Box display="flex" alignItems="center" gap={1}>
                <FormatSize />
                <Typography variant="subtitle2">Typography</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Font Family</InputLabel>
                    <Select
                      value={getCommonProperty('fontFamily')}
                      onChange={(e) => handlePropertyUpdate('fontFamily', e.target.value)}
                    >
                      <MenuItem value="Arial, sans-serif">Arial</MenuItem>
                      <MenuItem value="Georgia, serif">Georgia</MenuItem>
                      <MenuItem value="Courier New, monospace">Courier New</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Font Size</InputLabel>
                    <Select
                      value={getCommonProperty('fontSize')}
                      onChange={(e) => handlePropertyUpdate('fontSize', e.target.value)}
                    >
                      <MenuItem value="12px">12px</MenuItem>
                      <MenuItem value="14px">14px</MenuItem>
                      <MenuItem value="16px">16px</MenuItem>
                      <MenuItem value="18px">18px</MenuItem>
                      <MenuItem value="24px">24px</MenuItem>
                      <MenuItem value="32px">32px</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Font Weight</InputLabel>
                    <Select
                      value={getCommonProperty('fontWeight')}
                      onChange={(e) => handlePropertyUpdate('fontWeight', e.target.value)}
                    >
                      <MenuItem value="300">Light</MenuItem>
                      <MenuItem value="400">Normal</MenuItem>
                      <MenuItem value="600">Medium</MenuItem>
                      <MenuItem value="700">Bold</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Colors */}
          <Accordion>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Box display="flex" alignItems="center" gap={1}>
                {theming.getThemedIcon('palette')}
                <Typography variant="subtitle2">Colors</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" gutterBottom>Text Color</Typography>
                  <TextField
                    fullWidth
                    type="color"
                    value={getCommonProperty('color') || '#000000'}
                    onChange={(e) => handlePropertyUpdate('color', e.target.value)}
                    InputProps={{ sx: { height: 40,} }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" gutterBottom>Background</Typography>
                  <TextField
                    fullWidth
                    type="color"
                    value={getCommonProperty('backgroundColor') || '#ffffff'}
                    onChange={(e) => handlePropertyUpdate('backgroundColor', e.target.value)}
                    InputProps={{ sx: { height: 40,} }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Border */}
          <Accordion>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Box display="flex" alignItems="center" gap={1}>
                <BorderAll />
                <Typography variant="subtitle2">Border</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Border Width"
                    type="number"
                    value={getCommonProperty('borderWidth') || 0}
                    onChange={(e) => handlePropertyUpdate('border', `${e.target.value}px solid ${getCommonProperty('borderColor') || '#000000'}`)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="color"
                    label="Border Color"
                    value={getCommonProperty('borderColor') || '#000000'}
                    onChange={(e) => handlePropertyUpdate('border', `${getCommonProperty('borderWidth') || 0}px solid ${e.target.value}`)}
                    InputProps={{ sx: { height: 56,} }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Border Radius"
                    type="number"
                    value={getCommonProperty('borderRadius')?.replace('px',',') || 0}
                    onChange={(e) => handlePropertyUpdate('borderRadius', `${e.target.value}px`)}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Spacing */}
          <Accordion>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Box display="flex" alignItems="center" gap={1}>
                <Layers />
                <Typography variant="subtitle2">Spacing</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Padding"
                    value={getCommonProperty('padding') || ''}
                    onChange={(e) => handlePropertyUpdate('padding', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Margin"
                    value={getCommonProperty('margin') || ''}
                    onChange={(e) => handlePropertyUpdate('margin', e.target.value)}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Content Tab */}
      {activeTab === 1 && (
        <Box sx={{ p:  2 }}>
          {isTextElement && (
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Text Content"
                value={getCommonProperty('text', 'props') || ''}
                onChange={(e) => handlePropertyUpdate('text', e.target.value, 'props')}
              />
            </Box>
          )}

          {isImageElement && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Image Settings</Typography>
              <TextField
                fullWidth
                label="Image URL"
                value={getCommonProperty('src','props') || ', '}
                onChange={(e) => handlePropertyUpdate('src', e.target.value, 'props')}
              />
              <TextField
                fullWidth
                label="Alt Text"
                value={getCommonProperty('alt', 'props') || ''}
                onChange={(e) => handlePropertyUpdate('alt', e.target.value, 'props')}
              />
            </Box>
          )}

          {getFirstElement()?.type === 'button' && (
            <Box>
              <TextField
                fullWidth
                label="Button Text"
                value={getCommonProperty('text', 'props') || ', '}
                onChange={(e) => handlePropertyUpdate('text', e.target.value, 'props')}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Layout Tab */}
      {activeTab === 2 && (
        <Box sx={{ p:  2 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="X Position"
                type="number"
                value={getFirstElement()?.x || 0}
                onChange={(e) => handlePositionUpdate('x', Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Y Position"
                type="number"
                value={getFirstElement()?.y || 0}
                onChange={(e) => handlePositionUpdate('y', Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Width"
                type="number"
                value={getFirstElement()?.width || 100}
                onChange={(e) => handlePositionUpdate('width', Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Height"
                type="number"
                value={getFirstElement()?.height || 30}
                onChange={(e) => handlePositionUpdate('height', Number(e.target.value))}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my:  2 }} />

          <Typography variant="subtitle2" gutterBottom>Transform</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Rotation"
                type="number"
                value={0}
                InputProps={{ endAdornment: 'deg'}}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Scale"
                type="number"
                value={1}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Effects Tab */}
      {activeTab === 3 && (
        <Box sx={{ p:  2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Opacity</Typography>
              <Slider
                value={parseFloat(getCommonProperty('opacity') || '1') * 100}
                onChange={(_, value) => handlePropertyUpdate('opacity', (value as number) / 100)}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Box Shadow</Typography>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="0px 2px 4px rgba(0,0,0,0.1)"
                value={getCommonProperty('boxShadow') || ''}
                onChange={(e) => handlePropertyUpdate('boxShadow', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Text Shadow</Typography>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="1px 1px 2px rgba(0,0,0,0.5)"
                value={getCommonProperty('textShadow') || ''}
                onChange={(e) => handlePropertyUpdate('textShadow', e.target.value)}
              />
            </Grid>
          </Grid>
        </Box>
      )}
    </Paper>
  );
};

export default PropertyPanel;
