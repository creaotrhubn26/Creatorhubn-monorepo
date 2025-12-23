/**
 * Advanced Light Control Panel
 * 
 * Comprehensive controls for individual lights:
 * - Power on/off
 * - Intensity (0-100%)
 * - Color temperature (2700K-6500K)
 * - Color picker
 * - Beam angle
 * - Focus/edge
 * - Position (X/Y/Z)
 * - Rotation (aim at subject)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Switch,
  Slider,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  Stack,
  FormControlLabel,
  InputAdornment,
} from '@mui/material';
import {
  PowerSettingsNew as PowerIcon,
  Brightness6 as BrightnessIcon,
  Thermostat as TempIcon,
  CenterFocusStrong as FocusIcon,
  MyLocation as AimIcon,
  Save as SaveIcon,
  Restore as LoadIcon,
} from '@mui/icons-material';
import { photometricUnitsService } from '@/core/services/photometricUnitsService';
import { LightQualityPanel } from './LightQualityPanel';

interface AdvancedLightControlPanelProps {
  lightNode: any;
  onUpdate: (updates: any) => void;
}

export function AdvancedLightControlPanel({ lightNode, onUpdate }: AdvancedLightControlPanelProps) {
  const [isOn, setIsOn] = useState(true);
  const [intensity, setIntensity] = useState(100);
  const [cct, setCct] = useState(5600);
  const [beam, setBeam] = useState(60);
  const [focus, setFocus] = useState(0.5);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

  // Initialize from light node
  useEffect(() => {
    if (!lightNode?.light) return;
    
    setIsOn(lightNode.visible !== false);
    setIntensity((lightNode.light.power || 0.5) * 100);
    setCct(lightNode.light.cct || 5600);
    setBeam(lightNode.light.beam || 60);
    setFocus(lightNode.light.focus || 0.5);
    
    if (lightNode.transform?.position) {
      const [x, y, z] = lightNode.transform.position;
      setPosition({ x, y, z });
    }
    
    if (lightNode.transform?.rotation) {
      const [x, y, z] = lightNode.transform.rotation;
      setRotation({ x, y, z });
    }
  }, [lightNode?.id]);

  const handlePowerToggle = () => {
    const newIsOn = !isOn;
    setIsOn(newIsOn);
    onUpdate({ visible: newIsOn });
  };

  const handleIntensityChange = (_: any, value: number | number[]) => {
    const newIntensity = value as number;
    setIntensity(newIntensity);
    onUpdate({ light: { ...lightNode.light, power: newIntensity / 100 } });
  };

  const handleCctChange = (_: any, value: number | number[]) => {
    const newCct = value as number;
    setCct(newCct);
    onUpdate({ light: { ...lightNode.light, cct: newCct } });
  };

  const handleBeamChange = (_: any, value: number | number[]) => {
    const newBeam = value as number;
    setBeam(newBeam);
    onUpdate({ light: { ...lightNode.light, beam: newBeam } });
  };

  const handleFocusChange = (_: any, value: number | number[]) => {
    const newFocus = value as number;
    setFocus(newFocus);
    onUpdate({ light: { ...lightNode.light, focus: newFocus } });
  };

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newPosition = { ...position, [axis]: value };
    setPosition(newPosition);
    onUpdate({
      transform: {
        ...lightNode.transform,
        position: [newPosition.x, newPosition.y, newPosition.z],
      },
    });
  };

  const handleAimAtSubject = () => {
    // Calculate rotation to aim at origin (subject position)
    const [x, y, z] = lightNode.transform.position;
    const angleY = Math.atan2(x, z) * (180 / Math.PI);
    const distance = Math.sqrt(x * x + z * z);
    const angleX = -Math.atan2(y, distance) * (180 / Math.PI);
    
    const newRotation = { x: angleX, y: angleY, z: 0 };
    setRotation(newRotation);
    onUpdate({
      transform: {
        ...lightNode.transform,
        rotation: [newRotation.x, newRotation.y, newRotation.z],
      },
    });
  };

  const calculateDistance = () => {
    const [x, y, z] = lightNode.transform.position;
    return Math.sqrt(x * x + y * y + z * z).toFixed(2);
  };

  const getCctColor = (cct: number) => {
    if (cct < 3000) return '#FFA500'; // Warm orange
    if (cct < 4000) return '#FFD700'; // Warm yellow
    if (cct < 5000) return '#FFFACD'; // Neutral warm
    if (cct < 6000) return '#FFFFFF'; // Neutral
    return '#E0F0FF'; // Cool blue
  };

  // Calculate precise photometric values
  const photometrics = useMemo(() => {
    const subjectPosition: [number, number, number] = [0, 0, 0];
    const surfaceNormal: [number, number, number] = [0, 1, 0];

    const lightProps = {
      power: intensity / 100,
      wattage: 500, // Assume 500W light
      efficacy: 80, // LED efficacy
      position: lightNode.transform.position,
      beamAngle: beam,
    };

    return photometricUnitsService.calculatePhotometrics(
      lightProps,
      subjectPosition,
      surfaceNormal
    );
  }, [intensity, beam, lightNode.transform.position]);

  return (
    <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
        🎛️ Light Controls
      </Typography>

      {/* Power Toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PowerIcon sx={{ color: isOn ? '#4CAF50' : '#9E9E9E' }} />
          <Typography variant="body2">Power</Typography>
        </Box>
        <FormControlLabel
          control={<Switch checked={isOn} onChange={handlePowerToggle} />}
          label={isOn ? 'ON' : 'OFF'}
          sx={{ m: 0 }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Intensity */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BrightnessIcon fontSize="small" />
            <Typography variant="body2">Intensity</Typography>
          </Box>
          <Chip label={`${intensity}%`} size="small" sx={{ height: 20, fontSize: 11 }} />
        </Box>
        <Slider
          value={intensity}
          onChange={handleIntensityChange}
          min={0}
          max={100}
          disabled={!isOn}
          sx={{ color: isOn ? '#2196F3' : '#9E9E9E' }}
        />

        {/* Photometric Units Display */}
        <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Stack direction="row" spacing={2} sx={{ fontSize: 11 }}>
            <Tooltip title="Illuminance at subject (lux)">
              <Typography variant="caption" sx={{ fontWeight: 600}}>
                {photometrics.illuminance.toFixed(0)} lx
              </Typography>
            </Tooltip>
            <Tooltip title="Illuminance in foot-candles">
              <Typography variant="caption">
                {photometrics.footCandles.toFixed(1)} fc
              </Typography>
            </Tooltip>
            <Tooltip title="Luminous intensity (candelas)">
              <Typography variant="caption">
                {(photometrics.luminousIntensity / 1000).toFixed(1)}k cd
              </Typography>
            </Tooltip>
          </Stack>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 0.5 }}>
            Distance: {calculateDistance()}m • {photometrics.luminousFlux.toFixed(0)} lumens
          </Typography>
        </Box>
      </Box>

      {/* Color Temperature */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TempIcon fontSize="small" />
            <Typography variant="body2">Color Temperature</Typography>
          </Box>
          <Chip
            label={`${cct}K`}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              bgcolor: getCctColor(cct),
              color: cct > 5000 ? '#000' : '#fff'}}
          />
        </Box>
        <Slider
          value={cct}
          onChange={handleCctChange}
          min={2700}
          max={6500}
          step={100}
          disabled={!isOn}
          sx={{
            '& .MuiSlider-thumb': {
              bgcolor: getCctColor(cct),
            }, '& .MuiSlider-track': {
              background: `linear-gradient(to right, #FFA500, #FFD700, #FFFFFF, #E0F0FF)`,
            }}}
        />
      </Box>

      {/* Beam Angle */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FocusIcon fontSize="small" />
            <Typography variant="body2">Beam Angle</Typography>
          </Box>
          <Chip label={`${beam}°`} size="small" sx={{ height: 20, fontSize: 11 }} />
        </Box>
        <Slider
          value={beam}
          onChange={handleBeamChange}
          min={10}
          max={120}
          disabled={!isOn}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Spot
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Flood
          </Typography>
        </Box>
      </Box>

      {/* Focus/Edge */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Edge Softness</Typography>
          <Chip label={focus < 0.3 ? 'Hard' : focus < 0.7 ? 'Medium' : 'Soft'} size="small" sx={{ height: 20, fontSize: 11 }} />
        </Box>
        <Slider
          value={focus}
          onChange={handleFocusChange}
          min={0}
          max={1}
          step={0.1}
          disabled={!isOn}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Position Controls */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Position
        </Typography>
        <Stack spacing={1}>
          <TextField
            label="X"
            type="number"
            size="small"
            value={position.x.toFixed(2)}
            onChange={(e) => handlePositionChange('x', parseFloat(e.target.value))}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              }}}
          />
          <TextField
            label="Y (Height)"
            type="number"
            size="small"
            value={position.y.toFixed(2)}
            onChange={(e) => handlePositionChange('y', parseFloat(e.target.value))}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              }}}
          />
          <TextField
            label="Z"
            type="number"
            size="small"
            value={position.z.toFixed(2)}
            onChange={(e) => handlePositionChange('z', parseFloat(e.target.value))}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              }}}
          />
        </Stack>
      </Box>

      {/* Distance Display */}
      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#F3F4F6', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Distance from subject
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600}}>
          {calculateDistance()} m
        </Typography>
      </Box>

      {/* Aim at Subject Button */}
      <Button
        variant="outlined"
        startIcon={<AimIcon />}
        onClick={handleAimAtSubject}
        fullWidth
        sx={{ mb: 2, textTransform: 'none' }}
      >
        Aim at Subject
      </Button>

      <Divider sx={{ my: 2 }} />

      {/* Light Quality Metrics */}
      <LightQualityPanel cct={cct} lightType="led-warm" />

      <Divider sx={{ my: 2 }} />

      {/* Quick Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip title="Save preset">
          <IconButton size="small" sx={{ border: '1px solid #e0e0e0' }}>
            <SaveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Load preset">
          <IconButton size="small" sx={{ border: '1px solid #e0e0e0' }}>
            <LoadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

