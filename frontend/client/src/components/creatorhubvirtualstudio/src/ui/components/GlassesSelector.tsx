/**
 * Glasses Selector Component
 * 
 * UI for selecting and customizing glasses for virtual actors.
 * Integrates with GlassesModel for 3D rendering and GlassesReflectionGuide for lighting.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Stack,
  Chip,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore,
  Visibility,
  VisibilityOff,
  Refresh,
  WbSunny,
  RemoveRedEye,
  BlurOn,
} from '@mui/icons-material';
import {
  GlassesOptions,
  GlassesFrameStyle,
  GlassesLensType,
  GlassesFrameMaterial,
  GLASSES_PRESETS,
  getGlassesPresets,
} from '../../core/models/GlassesModel';

interface GlassesSelectorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  options: Partial<GlassesOptions>;
  onOptionsChange: (options: Partial<GlassesOptions>) => void;
  onApplyToActor?: (actorId: string, options: Partial<GlassesOptions>) => void;
  selectedActorId?: string;
}

const FRAME_STYLES: Array<{ value: GlassesFrameStyle; label: string; description: string }> = [
  { value: 'rectangular', label: 'Rectangular', description: 'Classic professional look' },
  { value: 'round', label: 'Round', description: 'Vintage/intellectual style' },
  { value: 'aviator', label: 'Aviator', description: 'Bold, iconic shape' },
  { value: 'cat_eye', label: 'Cat Eye', description: 'Retro feminine style' },
  { value: 'wayfarers', label: 'Wayfarers', description: 'Timeless casual style' },
  { value: 'rimless', label: 'Rimless', description: 'Minimalist, subtle' },
  { value: 'half_rim', label: 'Half Rim', description: 'Semi-rimless professional' },
  { value: 'oversized', label: 'Oversized', description: 'Fashion statement' },
];

const LENS_TYPES: Array<{ value: GlassesLensType; label: string; icon: React.ReactNode }> = [
  { value: 'clear', label: 'Clear', icon: <RemoveRedEye /> },
  { value: 'prescription', label: 'Prescription', icon: <RemoveRedEye /> },
  { value: 'sunglasses', label: 'Sunglasses', icon: <WbSunny /> },
  { value: 'blue_light', label: 'Blue Light', icon: <BlurOn /> },
  { value: 'anti_reflective', label: 'Anti-Reflective', icon: <Visibility /> },
];

const FRAME_MATERIALS: Array<{ value: GlassesFrameMaterial; label: string }> = [
  { value: 'plastic', label: 'Plastic' },
  { value: 'metal', label: 'Metal' },
  { value: 'titanium', label: 'Titanium' },
  { value: 'acetate', label: 'Acetate' },
  { value: 'wood', label: 'Wood' },
];

const FRAME_COLORS = [
  { value: '#1a1a1a', label: 'Black' },
  { value: '#4a3728', label: 'Tortoise' },
  { value: '#8b7355', label: 'Brown' },
  { value: '#c4a35a', label: 'Gold' },
  { value: '#c0c0c0', label: 'Silver' },
  { value: '#3d5a80', label: 'Navy' },
  { value: '#722f37', label: 'Burgundy' },
  { value: '#2e8b57', label: 'Forest' },
  { value: '#ff6b6b', label: 'Red' },
  { value: '#f8f8ff', label: 'Crystal' },
];

const LENS_COLORS = [
  { value: '#1a1a1a', label: 'Black' },
  { value: '#2a2a2a', label: 'Dark Gray' },
  { value: '#4a3728', label: 'Brown' },
  { value: '#1a4a1a', label: 'Green' },
  { value: '#4a1a4a', label: 'Purple' },
  { value: '#ff6b35', label: 'Orange' },
  { value: '#4a6a8a', label: 'Blue' },
  { value: '#ff1493', label: 'Pink' },
  { value: '#ffd700', label: 'Yellow' },
  { value: '#c0c0c0', label: 'Mirror' },
];

export const GlassesSelector: React.FC<GlassesSelectorProps> = ({
  enabled,
  onEnabledChange,
  options,
  onOptionsChange,
  onApplyToActor,
  selectedActorId,
}) => {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const presets = useMemo(() => getGlassesPresets(), []);

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = GLASSES_PRESETS[presetId];
    if (preset) {
      setActivePreset(presetId);
      onOptionsChange(preset);
    }
  }, [onOptionsChange]);

  const handleOptionChange = useCallback(<K extends keyof GlassesOptions>(
    key: K,
    value: GlassesOptions[K]
  ) => {
    setActivePreset(null); // Clear preset when custom changes made
    onOptionsChange({ ...options, [key]: value });
  }, [options, onOptionsChange]);

  const handleReset = useCallback(() => {
    setActivePreset(null);
    onOptionsChange({
      frameStyle: 'rectangular',
      lensType: 'clear',
      frameMaterial: 'plastic',
      frameColor: '#1a1a1a',
    });
  }, [onOptionsChange]);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <RemoveRedEye />
          Glasses / Eyewear
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Reset to defaults">
            <IconButton size="small" onClick={handleReset}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => onEnabledChange(e.target.checked)}
              />
            }
            label={enabled ? 'On' : 'Off'}
            labelPlacement="start"
          />
        </Stack>
      </Stack>

      {!enabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Enable glasses to add eyewear to your virtual actor. This helps test lighting for subjects wearing glasses.
        </Alert>
      )}

      {enabled && (
        <>
          {/* Quick Presets */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Quick Presets
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={1}>
                {presets.map((preset) => (
                  <Grid item xs={6} sm={4} key={preset.id}>
                    <Card
                      sx={{
                        bgcolor: activePreset === preset.id ? 'primary.dark' : 'background.paper',
                        cursor: 'pointer','&:hover': { bgcolor: activePreset === preset.id ? 'primary.dark' : 'action.hover' }}}
                    >
                      <CardActionArea onClick={() => handlePresetSelect(preset.id)}>
                        <CardContent sx={{ p: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                            {preset.name}
                          </Typography>
                          {activePreset === preset.id && (
                            <Chip label="Active" size="small" color="primary" sx={{ ml: 0.5 }} />
                          )}
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          {/* Frame Style */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Frame Style
              </Typography>
              <Chip label={options.frameStyle || 'rectangular'} size="small" sx={{ ml: 1 }} />
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={1}>
                {FRAME_STYLES.map((style) => (
                  <Grid item xs={6} key={style.value}>
                    <Card
                      sx={{
                        bgcolor: options.frameStyle === style.value ? 'primary.dark' : 'background.paper',
                        cursor: 'pointer'}}
                    >
                      <CardActionArea onClick={() => handleOptionChange('frameStyle', style.value)}>
                        <CardContent sx={{ p: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                            {style.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '10px' }}>
                            {style.description}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Lens Type */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Lens Type
              </Typography>
              <Chip label={options.lensType || 'clear'} size="small" sx={{ ml: 1 }} />
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {LENS_TYPES.map((lens) => (
                  <Card
                    key={lens.value}
                    sx={{
                      bgcolor: options.lensType === lens.value ? 'primary.dark' : 'background.paper',
                      cursor: 'pointer'}}
                  >
                    <CardActionArea onClick={() => handleOptionChange('lensType', lens.value)}>
                      <CardContent sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {lens.icon}
                        <Typography variant="body2">{lens.label}</Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                ))}
              </Stack>
              
              {/* Lens color for sunglasses */}
              {options.lensType === 'sunglasses' && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" gutterBottom>Lens Color</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {LENS_COLORS.map((color) => (
                      <Tooltip key={color.value} title={color.label}>
                        <Box
                          onClick={() => handleOptionChange('lensColor', color.value)}
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: color.value,
                            cursor: 'pointer',
                            border: options.lensColor === color.value ? '3px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                            boxShadow: options.lensColor === color.value ? '0 0 0 2px #2196f3' : 'none'}}
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Frame Material & Color */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Frame Appearance
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Material</InputLabel>
                <Select
                  value={options.frameMaterial || 'plastic'}
                  onChange={(e) => handleOptionChange('frameMaterial', e.target.value as GlassesFrameMaterial)}
                  label="Material"
                >
                  {FRAME_MATERIALS.map((mat) => (
                    <MenuItem key={mat.value} value={mat.value}>{mat.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Typography variant="caption" gutterBottom>Frame Color</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {FRAME_COLORS.map((color) => (
                  <Tooltip key={color.value} title={color.label}>
                    <Box
                      onClick={() => handleOptionChange('frameColor', color.value)}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        bgcolor: color.value,
                        cursor: 'pointer',
                        border: options.frameColor === color.value ? '3px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                        boxShadow: options.frameColor === color.value ? '0 0 0 2px #2196f3' : 'none'}}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Frame Dimensions */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                Frame Dimensions
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption">Lens Width: {((options.lensWidth || 0.05) * 100).toFixed(0)}mm</Typography>
                  <Slider
                    value={(options.lensWidth || 0.05) * 100}
                    onChange={(_, v) => handleOptionChange('lensWidth', (v as number) / 100)}
                    min={40}
                    max={70}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${v}mm`}
                  />
                </Box>
                <Box>
                  <Typography variant="caption">Lens Height: {((options.lensHeight || 0.035) * 100).toFixed(0)}mm</Typography>
                  <Slider
                    value={(options.lensHeight || 0.035) * 100}
                    onChange={(_, v) => handleOptionChange('lensHeight', (v as number) / 100)}
                    min={25}
                    max={60}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${v}mm`}
                  />
                </Box>
                <Box>
                  <Typography variant="caption">Bridge Width: {((options.bridgeWidth || 0.018) * 100).toFixed(0)}mm</Typography>
                  <Slider
                    value={(options.bridgeWidth || 0.018) * 100}
                    onChange={(_, v) => handleOptionChange('bridgeWidth', (v as number) / 100)}
                    min={14}
                    max={24}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${v}mm`}
                  />
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Apply Button */}
          {selectedActorId && onApplyToActor && (
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => onApplyToActor(selectedActorId, options)}
            >
              Apply Glasses to Actor
            </Button>
          )}

          {/* Reflection Warning */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Lighting Tip:</strong> Enable the Glasses Reflection Guide in the Guides panel to visualize and avoid unwanted reflections.
            </Typography>
          </Alert>
        </>
      )}
    </Box>
  );
};

export default GlassesSelector;

