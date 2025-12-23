/**
 * ACES Panel Component
 * 
 * UI for controlling ACES (Academy Color Encoding System) color management
 * with professional presets and configuration options.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  Divider,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { acesService, type ACESConfig, type ACESColorSpace, type ACESLMTPreset } from '../../core/services/acesService';

interface ACESPanelProps {
  enabled: boolean;
  config: ACESConfig;
  onEnabledChange: (enabled: boolean) => void;
  onConfigChange: (config: ACESConfig) => void;
}

export const ACESPanel: React.FC<ACESPanelProps> = ({
  enabled,
  config,
  onEnabledChange,
  onConfigChange,
}) => {
  const [lmtPresets] = useState<ACESLMTPreset[]>(acesService.getLMTPresets());

  const handleReset = () => {
    onConfigChange(acesService.DEFAULT_CONFIG);
  };

  const updateConfig = (updates: Partial<ACESConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const colorSpaces: ACESColorSpace[] = ['ACES2065-1','ACEScg','ACEScct','sRGB','Rec709','Rec2020','DCI-P3'];

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">ACES Color Management</Typography>
          <Chip label="v1.3" size="small" color="primary" />
        </Box>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />}
          label="Enable"
        />
      </Box>

      {enabled && (
        <>
          {/* Color Space Configuration */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Color Space Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Input Color Space</InputLabel>
                  <Select
                    value={config.inputColorSpace}
                    label="Input Color Space"
                    onChange={(e) => updateConfig({ inputColorSpace: e.target.value as ACESColorSpace })}
                  >
                    {colorSpaces.map((space) => (
                      <MenuItem key={space} value={space}>
                        {space}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>Output Color Space</InputLabel>
                  <Select
                    value={config.outputColorSpace}
                    label="Output Color Space"
                    onChange={(e) => updateConfig({ outputColorSpace: e.target.value as ACESColorSpace })}
                  >
                    {colorSpaces.map((space) => (
                      <MenuItem key={space} value={space}>
                        {space}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Transform Configuration */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Transform Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableRRT}
                      onChange={(e) => updateConfig({ enableRRT: e.target.checked })}
                    />
                  }
                  label="Enable RRT (Reference Rendering Transform)"
                />

                {config.enableRRT && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.useFullRRT}
                        onChange={(e) => updateConfig({ useFullRRT: e.target.checked })}
                      />
                    }
                    label="Use Full RRT (Glow + Red Modifier + Global Desaturation)"
                    sx={{ ml: 2 }}
                  />
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableLMT}
                      onChange={(e) => updateConfig({ enableLMT: e.target.checked })}
                    />
                  }
                  label="Enable LMT (Look Modification Transform)"
                />

                {config.enableLMT && (
                  <FormControl fullWidth size="small">
                    <InputLabel>LMT Preset</InputLabel>
                    <Select
                      value={config.lmtPreset || 'neutral'}
                      label="LMT Preset"
                      onChange={(e) => updateConfig({ lmtPreset: e.target.value })}
                    >
                      {lmtPresets.map((preset) => (
                        <MenuItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {config.lmtPreset && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        {lmtPresets.find(p => p.id === config.lmtPreset)?.description}
                      </Typography>
                    )}
                  </FormControl>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Exposure & Gamma */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Exposure & Gamma</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption">
                    Exposure: {config.exposure.toFixed(2)} EV
                  </Typography>
                  <Slider
                    value={config.exposure}
                    onChange={(_, v) => updateConfig({ exposure: v as number })}
                    min={-5}
                    max={5}
                    step={0.1}
                    size="small"
                    marks={[
                      { value: -5, label: '-5' },
                      { value: 0, label: '0' },
                      { value: 5, label: '+5' },
                    ]}
                  />
                </Box>

                <Box>
                  <Typography variant="caption">
                    Gamma: {config.gamma.toFixed(2)}
                  </Typography>
                  <Slider
                    value={config.gamma}
                    onChange={(_, v) => updateConfig({ gamma: v as number })}
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    size="small"
                    marks={[
                      { value: 0.5, label: '0.5' },
                      { value: 1.0, label: '1.0' },
                      { value: 2.5, label: '2.5' },
                    ]}
                  />
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Reset to default">
              <IconButton onClick={handleReset} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              ACES v1.3 (AMPAS)
            </Typography>
          </Stack>

          {/* Info */}
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <InfoIcon fontSize="small" color="info" />
              <Box>
                <Typography variant="caption" display="block">
                  <strong>ACES Pipeline:</strong> IDT → LMT → RRT → ODT
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Industry-standard color management used by all major Hollywood studios.
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  <strong>Color Spaces:</strong>
                </Typography>
                <Typography variant="caption" display="block">
                  • ACES2065-1: Scene-referred, linear (archival)
                </Typography>
                <Typography variant="caption" display="block">
                  • ACEScg: CG working space, linear
                </Typography>
                <Typography variant="caption" display="block">
                  • ACEScct: Color grading space, logarithmic
                </Typography>
                <Typography variant="caption" display="block">
                  • sRGB/Rec709: Display-referred (web/HDTV)
                </Typography>
                <Typography variant="caption" display="block">
                  • Rec2020: Wide gamut (HDR/UHD)
                </Typography>
                <Typography variant="caption" display="block">
                  • DCI-P3: Digital cinema
                </Typography>
              </Box>
            </Stack>
          </Box>
        </>
      )}
    </Box>
  );
};

