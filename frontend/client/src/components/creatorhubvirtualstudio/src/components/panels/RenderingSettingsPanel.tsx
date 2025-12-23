/**
 * Rendering Settings Panel
 * 
 * UI for controlling PBR, GI, volumetrics, and other rendering features
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  Slider,
  Stack,
  Divider,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Brightness7 as PBRIcon,
  WbSunny as GIIcon,
  Cloud as VolumeIcon,
  Gradient as ShadowIcon,
  BlurOn as VSMShadowIcon,
  Palette as FalseColorIcon,
  Whatshot as HeatmapIcon,
} from '@mui/icons-material';

interface RenderingSettingsPanelProps {
  pbrEnabled: boolean;
  giEnabled: boolean;
  volumetricsEnabled: boolean;
  softShadowsEnabled: boolean;
  vsmShadowsEnabled?: boolean;
  falseColorEnabled?: boolean;
  falseColorOpacity?: number;
  luminanceHeatmapEnabled?: boolean;
  luminanceHeatmapMin?: number;
  luminanceHeatmapMax?: number;
  luminanceHeatmapOpacity?: number;
  giIntensity: number;
  giBounces: number;
  volumetricQuality: 'fast' | 'quality';
  onTogglePBR: (enabled: boolean) => void;
  onToggleGI: (enabled: boolean) => void;
  onToggleVolumetrics: (enabled: boolean) => void;
  onToggleSoftShadows: (enabled: boolean) => void;
  onToggleVSMShadows?: (enabled: boolean) => void;
  onToggleFalseColor?: (enabled: boolean) => void;
  onFalseColorOpacityChange?: (opacity: number) => void;
  onToggleLuminanceHeatmap?: (enabled: boolean) => void;
  onLuminanceHeatmapRangeChange?: (min: number, max: number) => void;
  onLuminanceHeatmapOpacityChange?: (opacity: number) => void;
  onUpdateGIIntensity: (intensity: number) => void;
  onUpdateGIBounces: (bounces: number) => void;
  onUpdateVolumetricQuality: (quality: 'fast' | 'quality') => void;
}

export const RenderingSettingsPanel: React.FC<RenderingSettingsPanelProps> = ({
  pbrEnabled,
  giEnabled,
  volumetricsEnabled,
  softShadowsEnabled,
  vsmShadowsEnabled = false,
  falseColorEnabled = false,
  falseColorOpacity = 0.8,
  luminanceHeatmapEnabled = false,
  luminanceHeatmapMin = 0.0,
  luminanceHeatmapMax = 1.0,
  luminanceHeatmapOpacity = 0.7,
  giIntensity,
  giBounces,
  volumetricQuality,
  onTogglePBR,
  onToggleGI,
  onToggleVolumetrics,
  onToggleSoftShadows,
  onToggleVSMShadows,
  onToggleFalseColor,
  onFalseColorOpacityChange,
  onToggleLuminanceHeatmap,
  onLuminanceHeatmapRangeChange,
  onLuminanceHeatmapOpacityChange,
  onUpdateGIIntensity,
  onUpdateGIBounces,
  onUpdateVolumetricQuality,
}) => {
  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Stack spacing={3}>
        <Typography variant="h6">Rendering Settings</Typography>

        <Divider />

        {/* PBR Rendering */}
        <Box>
          <FormControlLabel
            control={
              <Switch checked={pbrEnabled} onChange={(e) => onTogglePBR(e.target.checked)} />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PBRIcon />
                <Typography>Physically-Based Rendering</Typography>
                {pbrEnabled && <Chip label="Active" size="small" color="success" />}
              </Box>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
            Cook-Torrance BRDF with GGX distribution
          </Typography>
        </Box>

        <Divider />

        {/* Global Illumination */}
        <Box>
          <FormControlLabel
            control={
              <Switch checked={giEnabled} onChange={(e) => onToggleGI(e.target.checked)} />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GIIcon />
                <Typography>Global Illumination</Typography>
                {giEnabled && <Chip label="Active" size="small" color="success" />}
              </Box>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
            Bounce lighting from floors, walls, and reflectors
          </Typography>

          {giEnabled && (
            <Stack spacing={2} sx={{ mt: 2, ml: 5 }}>
              <Box>
                <Typography variant="caption" gutterBottom>
                  GI Intensity: {(giIntensity * 100).toFixed(0)}%
                </Typography>
                <Tooltip title="Strength of indirect lighting from bounced light" placement="top">
                  <Slider
                    value={giIntensity}
                    onChange={(_, value) => onUpdateGIIntensity(value as number)}
                    min={0}
                    max={1}
                    step={0.1}
                    size="small"
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 0.5, label: '50%' },
                      { value: 1, label: '100%' },
                    ]}
                  />
                </Tooltip>
              </Box>

              <Box>
                <Typography variant="caption" gutterBottom>
                  Bounce Count: {giBounces}
                </Typography>
                <Tooltip title="Number of light bounces to simulate (higher = more realistic but slower)" placement="top">
                  <Slider
                    value={giBounces}
                    onChange={(_, value) => onUpdateGIBounces(value as number)}
                    min={1}
                    max={3}
                    step={1}
                    size="small"
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 1, label: '1' },
                      { value: 2, label: '2' },
                      { value: 3, label: '3' },
                    ]}
                  />
                </Tooltip>
              </Box>
            </Stack>
          )}
        </Box>

        <Divider />

        {/* Volumetric Lighting */}
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={volumetricsEnabled}
                onChange={(e) => onToggleVolumetrics(e.target.checked)}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VolumeIcon />
                <Typography>Volumetric Lighting</Typography>
                {volumetricsEnabled && <Chip label="Active" size="small" color="success" />}
              </Box>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
            Light scattering in fog/atmosphere (god rays)
          </Typography>

          {volumetricsEnabled && (
            <FormControl fullWidth size="small" sx={{ mt: 2, ml: 5 }}>
              <InputLabel>Quality</InputLabel>
              <Select
                value={volumetricQuality}
                label="Quality"
                onChange={(e) => onUpdateVolumetricQuality(e.target.value as  'fast' | 'quality')}
              >
                <MenuItem value="fast">Fast (16 samples)</MenuItem>
                <MenuItem value="quality">Quality (32 samples)</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>

        <Divider />

        {/* Soft Shadows */}
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={softShadowsEnabled}
                onChange={(e) => onToggleSoftShadows(e.target.checked)}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShadowIcon />
                <Typography>Soft Shadows (PCSS)</Typography>
                {softShadowsEnabled && <Chip label="Active" size="small" color="success" />}
              </Box>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
            Contact-hardening shadows with penumbra
          </Typography>
        </Box>

        <Divider />

        {/* VSM Shadows */}
        {onToggleVSMShadows && (
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={vsmShadowsEnabled}
                  onChange={(e) => onToggleVSMShadows(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VSMShadowIcon />
                  <Typography>VSM Shadows</Typography>
                  {vsmShadowsEnabled && <Chip label="Active" size="small" color="success" />}
                </Box>
              }
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
              Variance Shadow Maps - Softer, more realistic shadows (higher performance cost)
            </Typography>
            <Tooltip title="VSM provides smoother shadows but uses more GPU memory" placement="top">
              <Typography variant="caption" color="warning.main" sx={{ ml: 5, display: 'block', mt: 0.5 }}>
                ⚠️ More GPU intensive than PCSS
              </Typography>
            </Tooltip>
          </Box>
        )}

        <Divider />

        {/* False Color Exposure */}
        {onToggleFalseColor && (
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={falseColorEnabled}
                  onChange={(e) => onToggleFalseColor(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FalseColorIcon />
                  <Typography>False Color Exposure</Typography>
                  {falseColorEnabled && <Chip label="Active" size="small" color="success" />}
                </Box>
              }
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
              Visualize exposure zones with color-coded luminance mapping
            </Typography>

            {falseColorEnabled && onFalseColorOpacityChange && (
              <Stack spacing={2} sx={{ mt: 2, ml: 5 }}>
                <Box>
                  <Typography variant="caption" gutterBottom>
                    Opacity: {(falseColorOpacity * 100).toFixed(0)}%
                  </Typography>
                  <Tooltip title="Blend amount of false color overlay" placement="top">
                    <Slider
                      value={falseColorOpacity}
                      onChange={(_, value) => onFalseColorOpacityChange(value as number)}
                      min={0}
                      max={1}
                      step={0.1}
                      size="small"
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                    />
                  </Tooltip>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    <strong>Color Guide:</strong> Blue (underexposed) → Green (correct) → Yellow/Red (overexposed)
                  </Typography>
                </Box>
              </Stack>
            )}
          </Box>
        )}

        <Divider />

        {/* Luminance Heatmap */}
        {onToggleLuminanceHeatmap && (
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={luminanceHeatmapEnabled}
                  onChange={(e) => onToggleLuminanceHeatmap(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HeatmapIcon />
                  <Typography>Luminance Heatmap</Typography>
                  {luminanceHeatmapEnabled && <Chip label="Active" size="small" color="success" />}
                </Box>
              }
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
              Thermal visualization of light intensity distribution
            </Typography>

            {luminanceHeatmapEnabled && (
              <Stack spacing={2} sx={{ mt: 2, ml: 5 }}>
                {onLuminanceHeatmapRangeChange && (
                  <>
                    <Box>
                      <Typography variant="caption" gutterBottom>
                        Min Luminance: {luminanceHeatmapMin.toFixed(2)}
                      </Typography>
                      <Tooltip title="Minimum luminance value for heatmap scale" placement="top">
                        <Slider
                          value={luminanceHeatmapMin}
                          onChange={(_, value) => onLuminanceHeatmapRangeChange(value as number, luminanceHeatmapMax)}
                          min={0}
                          max={1}
                          step={0.01}
                          size="small"
                          valueLabelDisplay="auto"
                        />
                      </Tooltip>
                    </Box>
                    <Box>
                      <Typography variant="caption" gutterBottom>
                        Max Luminance: {luminanceHeatmapMax.toFixed(2)}
                      </Typography>
                      <Tooltip title="Maximum luminance value for heatmap scale" placement="top">
                        <Slider
                          value={luminanceHeatmapMax}
                          onChange={(_, value) => onLuminanceHeatmapRangeChange(luminanceHeatmapMin, value as number)}
                          min={0}
                          max={1}
                          step={0.01}
                          size="small"
                          valueLabelDisplay="auto"
                        />
                      </Tooltip>
                    </Box>
                  </>
                )}
                {onLuminanceHeatmapOpacityChange && (
                  <Box>
                    <Typography variant="caption" gutterBottom>
                      Opacity: {(luminanceHeatmapOpacity * 100).toFixed(0)}%
                    </Typography>
                    <Tooltip title="Blend amount of heatmap overlay" placement="top">
                      <Slider
                        value={luminanceHeatmapOpacity}
                        onChange={(_, value) => onLuminanceHeatmapOpacityChange(value as number)}
                        min={0}
                        max={1}
                        step={0.1}
                        size="small"
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                      />
                    </Tooltip>
                  </Box>
                )}
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    <strong>Color Scale:</strong> Black → Purple → Blue → Cyan → Green → Yellow → Orange → Red → White
                  </Typography>
                </Box>
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

