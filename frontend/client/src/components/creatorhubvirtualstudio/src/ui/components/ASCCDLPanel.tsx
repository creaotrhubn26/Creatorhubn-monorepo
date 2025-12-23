/**
 * ASC CDL Panel Component
 * 
 * UI for controlling ASC CDL (American Society of Cinematographers Color Decision List)
 * color grading parameters with professional presets and XML export/import.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import * as THREE from 'three';
import { ascCDLService, type ASCCDLParams, type ASCCDLPreset } from '../../core/services/ascCDLService';

interface ASCCDLPanelProps {
  enabled: boolean;
  params: ASCCDLParams;
  onEnabledChange: (enabled: boolean) => void;
  onParamsChange: (params: ASCCDLParams) => void;
}

export const ASCCDLPanel: React.FC<ASCCDLPanelProps> = ({
  enabled,
  params,
  onEnabledChange,
  onParamsChange,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('neutral');
  const [presets] = useState<ASCCDLPreset[]>(ascCDLService.getPresets());

  // Update params when preset changes
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = ascCDLService.getPresetById(presetId);
    if (preset) {
      onParamsChange(preset.params);
    }
  };

  // Reset to default
  const handleReset = () => {
    setSelectedPreset('neutral, ');
    onParamsChange(ascCDLService.DEFAULT_PARAMS);
  };

  // Export to XML
  const handleExportXML = () => {
    const xml = ascCDLService.exportToXML(params, {
      id: `cdl-${Date.now()}`,
      description: `ASC CDL export from Virtual Studio`,
    });
    
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a,');
    a.href = url;
    a.download = `asc-cdl-${Date.now()}.cdl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON
  const handleExportJSON = () => {
    const json = ascCDLService.exportToJSON(params, {
      id: `cdl-${Date.now()}`,
      description: `ASC CDL export from Virtual Studio`,
    });
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asc-cdl-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import from file
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      let result = null;
      if (file.name.endsWith('.cdl') || file.name.endsWith('.xml')) {
        result = ascCDLService.importFromXML(content);
      } else if (file.name.endsWith('.json')) {
        result = ascCDLService.importFromJSON(content);
      }

      if (result) {
        onParamsChange(result.params);
        setSelectedPreset('custom');
      } else {
        alert('Failed to import CDL file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  // Update individual parameter
  const updateParam = (
    channel: 'slope' | 'offset' | 'power',
    component: 'x' | 'y' | 'z',
    value: number
  ) => {
    const newParams = { ...params };
    newParams[channel] = newParams[channel].clone();
    newParams[channel][component] = value;
    onParamsChange(newParams);
    setSelectedPreset('custom');
  };

  const updateSaturation = (value: number) => {
    onParamsChange({ ...params, saturation: value });
    setSelectedPreset('custom');
  };

  const currentPreset = presets.find(p => p.id === selectedPreset);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">ASC CDL Color Grading</Typography>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />}
          label="Enable"
        />
      </Box>

      {enabled && (
        <>
          {/* Preset Selection */}
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Preset</InputLabel>
              <Select
                value={selectedPreset}
                label="Preset"
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                {presets.map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </MenuItem>
                ))}
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>

            {currentPreset && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {currentPreset.description}
                </Typography>
                {currentPreset.usedIn && (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Used in: {currentPreset.usedIn.join('')}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Slope Controls */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Slope (Gain/Contrast)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="error">Red: {params.slope.x.toFixed(3)}</Typography>
                  <Slider
                    value={params.slope.x}
                    onChange={(_, v) => updateParam('slope','x', v as number)}
                    min={0}
                    max={2}
                    step={0.01}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="success.main">Green: {params.slope.y.toFixed(3)}</Typography>
                  <Slider
                    value={params.slope.y}
                    onChange={(_, v) => updateParam('slope','y', v as number)}
                    min={0}
                    max={2}
                    step={0.01}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="primary">Blue: {params.slope.z.toFixed(3)}</Typography>
                  <Slider
                    value={params.slope.z}
                    onChange={(_, v) => updateParam('slope','z', v as number)}
                    min={0}
                    max={2}
                    step={0.01}
                    size="small"
                  />
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Offset Controls */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Offset (Lift/Brightness)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="error">Red: {params.offset.x.toFixed(3)}</Typography>
                  <Slider
                    value={params.offset.x}
                    onChange={(_, v) => updateParam('offset','x', v as number)}
                    min={-1}
                    max={1}
                    step={0.01}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="success.main">Green: {params.offset.y.toFixed(3)}</Typography>
                  <Slider
                    value={params.offset.y}
                    onChange={(_, v) => updateParam('offset','y', v as number)}
                    min={-1}
                    max={1}
                    step={0.01}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="primary">Blue: {params.offset.z.toFixed(3)}</Typography>
                  <Slider
                    value={params.offset.z}
                    onChange={(_, v) => updateParam('offset','z', v as number)}
                    min={-1}
                    max={1}
                    step={0.01}
                    size="small"
                  />
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Power Controls */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Power (Gamma/Midtones)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="error">Red: {params.power.x.toFixed(3)}</Typography>
                  <Slider
                    value={params.power.x}
                    onChange={(_, v) => updateParam('power', 'x', v as number)}
                    min={0.1}
                    max={4}
                    step={0.01}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="success.main">Green: {params.power.y.toFixed(3)}</Typography>
                  <Slider
                    value={params.power.y}
                    onChange={(_, v) => updateParam('power', 'y', v as number)}
                    min={0.1}
                    max={4}
                    step={0.01}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="primary">Blue: {params.power.z.toFixed(3)}</Typography>
                  <Slider
                    value={params.power.z}
                    onChange={(_, v) => updateParam('power', 'z', v as number)}
                    min={0.1}
                    max={4}
                    step={0.01}
                    size="small"
                  />
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Saturation Control */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Saturation</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                <Typography variant="caption">Saturation: {params.saturation.toFixed(3)}</Typography>
                <Slider
                  value={params.saturation}
                  onChange={(_, v) => updateSaturation(v as number)}
                  min={0}
                  max={2}
                  step={0.01}
                  size="small"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Tooltip title="Reset to default">
              <IconButton onClick={handleReset} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Export to XML (DaVinci Resolve, Premiere Pro)">
              <IconButton onClick={handleExportXML} size="small">
                <DownloadIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Export to JSON">
              <IconButton onClick={handleExportJSON} size="small">
                <DownloadIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Import CDL file">
              <IconButton component="label" size="small">
                <UploadIcon />
                <input
                  type="file"
                  hidden
                  accept=".cdl,.xml,.json"
                  onChange={handleImport}
                />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Info */}
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <InfoIcon fontSize="small" color="info" />
              <Box>
                <Typography variant="caption" display="block">
                  <strong>ASC CDL Formula:</strong> out = (in × slope + offset)^power
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Compatible with DaVinci Resolve, Premiere Pro, Final Cut Pro, and other professional tools.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </>
      )}
    </Box>
  );
};

