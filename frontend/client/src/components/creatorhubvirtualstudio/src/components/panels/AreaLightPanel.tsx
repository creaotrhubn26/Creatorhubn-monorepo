/**
 * Area Light Control Panel
 * 
 * UI for adding and configuring professional area lights
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  Slider,
  TextField,
  IconButton,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Lightbulb as LightIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { AreaLight, AreaLightType } from '../../core/rendering/AreaLight';
import { ALL_LIGHTS, ALL_MODIFIERS } from '../../core/data/EquipmentDatabase';
import * as THREE from 'three';

interface AreaLightPanelProps {
  lights: AreaLight[];
  onAddLight: (light: AreaLight) => void;
  onRemoveLight: (light: AreaLight) => void;
  onUpdateLight: (light: AreaLight) => void;
}

export const AreaLightPanel: React.FC<AreaLightPanelProps> = ({
  lights,
  onAddLight,
  onRemoveLight,
  onUpdateLight,
}) => {
  const [selectedType, setSelectedType] = useState<AreaLightType>('softbox');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [selectedModifier, setSelectedModifier] = useState<string>('');

  const handleAddLight = () => {
    // Get equipment specs if selected
    const equipment = selectedEquipment
      ? ALL_LIGHTS.find((l) => l.id === selectedEquipment)
      : null;

    const modifier = selectedModifier
      ? ALL_MODIFIERS.find((m) => m.id === selectedModifier)
      : null;

    // Create new area light
    const light = new AreaLight({
      type: selectedType,
      width: modifier?.size[0] || 0.6,
      height: modifier?.size[1] || 0.6,
      power: equipment?.power || 300,
      temperature: equipment?.colorTemperature || 5600,
      diffusion: modifier?.diffusion || 0.8,
      grid: false,
      gridAngle: 40,
    });

    // Position light in front of camera
    light.position.set(0, 2, 3);
    light.lookAt(0, 1, 0);

    onAddLight(light);
  };

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightIcon /> Area Lights
        </Typography>

        <Divider />

        {/* Add New Light */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Add New Light
          </Typography>

          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Light Type</InputLabel>
              <Select
                value={selectedType}
                label="Light Type"
                onChange={(e) => setSelectedType(e.target.value as AreaLightType)}
              >
                <MenuItem value="softbox">Softbox</MenuItem>
                <MenuItem value="umbrella">Umbrella</MenuItem>
                <MenuItem value="strip">Strip Light</MenuItem>
                <MenuItem value="ring">Ring Light</MenuItem>
                <MenuItem value="panel">LED Panel</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Equipment</InputLabel>
              <Select
                value={selectedEquipment}
                label="Equipment"
                onChange={(e) => setSelectedEquipment(e.target.value)}
              >
                <MenuItem value="">
                  <em>Generic</em>
                </MenuItem>
                {ALL_LIGHTS.map((light) => (
                  <MenuItem key={light.id} value={light.id}>
                    {light.brand} {light.model} ({light.power}W)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Modifier</InputLabel>
              <Select
                value={selectedModifier}
                label="Modifier"
                onChange={(e) => setSelectedModifier(e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {ALL_MODIFIERS.filter((m) => m.type === selectedType || m.type === 'universal').map(
                  (modifier) => (
                    <MenuItem key={modifier.id} value={modifier.id}>
                      {modifier.name} ({modifier.size[0] * 100}x{modifier.size[1] * 100}cm)
                    </MenuItem>
                  ),
                )}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddLight}
              fullWidth
            >
              Add Light
            </Button>
          </Stack>
        </Box>

        <Divider />

        {/* Light List */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Active Lights ({lights.length})
          </Typography>

          {lights.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No lights added yet
            </Typography>
          ) : (
            <Stack spacing={1}>
              {lights.map((light, index) => (
                <LightItem
                  key={index}
                  light={light}
                  index={index}
                  onRemove={() => onRemoveLight(light)}
                  onUpdate={() => onUpdateLight(light)}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

interface LightItemProps {
  light: AreaLight;
  index: number;
  onRemove: () => void;
  onUpdate: () => void;
}

const LightItem: React.FC<LightItemProps> = ({ light, index, onRemove, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);

  const handlePowerChange = (_: Event, value: number | number[]) => {
    light.config.power = value as number;
    light.updateIntensity();
    onUpdate();
  };

  const handleTemperatureChange = (_: Event, value: number | number[]) => {
    light.config.temperature = value as number;
    light.updateColor();
    onUpdate();
  };

  const handleDiffusionChange = (_: Event, value: number | number[]) => {
    light.config.diffusion = value as number;
    onUpdate();
  };

  const toggleVisibility = () => {
    light.visible = !visible;
    setVisible(!visible);
    onUpdate();
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" fontWeight="medium">
            Light {index + 1} - {light.config.type}
          </Typography>
          <Box>
            <IconButton size="small" onClick={toggleVisibility}>
              {visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={onRemove} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Controls */}
        {expanded && (
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" gutterBottom>
                Power: {light.config.power}W
              </Typography>
              <Tooltip title="Light output power in watts (higher = brighter)" placement="top">
                <Slider
                  value={light.config.power}
                  onChange={handlePowerChange}
                  min={10}
                  max={1000}
                  step={10}
                  size="small"
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}W`}
                />
              </Tooltip>
            </Box>

            <Box>
              <Typography variant="caption" gutterBottom>
                Color Temperature: {light.config.temperature}K
              </Typography>
              <Tooltip title="Light color temperature in Kelvin (2700K=warm, 6500K=cool)" placement="top">
                <Slider
                  value={light.config.temperature}
                  onChange={handleTemperatureChange}
                  min={2700}
                  max={6500}
                  step={100}
                  size="small"
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}K`}
                />
              </Tooltip>
            </Box>

            <Box>
              <Typography variant="caption" gutterBottom>
                Diffusion: {(light.config.diffusion * 100).toFixed(0)}%
              </Typography>
              <Tooltip title="Light diffusion/softness (0%=hard, 100%=soft)" placement="top">
                <Slider
                  value={light.config.diffusion}
                  onChange={handleDiffusionChange}
                  min={0}
                  max={1}
                  step={0.1}
                  size="small"
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                />
              </Tooltip>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={light.config.grid}
                  onChange={(e) => {
                    light.config.grid = e.target.checked;
                    onUpdate();
                  }}
                  size="small"
                />
              }
              label={<Typography variant="caption">Honeycomb Grid</Typography>}
            />
          </Stack>
        )}

        <Button size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide' : 'Show'} Controls
        </Button>
      </Stack>
    </Paper>
  );
};

