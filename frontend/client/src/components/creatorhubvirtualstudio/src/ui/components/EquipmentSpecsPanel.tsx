/**
 * Equipment Specifications Panel
 * 
 * Displays detailed specifications for selected lighting equipment
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Grid,
  Paper,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Lightbulb as LightIcon,
  Speed as PowerIcon,
  Palette as ColorIcon,
  Straighten as DimensionsIcon,
  AttachMoney as PriceIcon,
  CheckCircle as CompatibleIcon,
} from '@mui/icons-material';
import { equipmentSpecsService, type LightSpecifications } from '@/core/services/equipmentSpecsService';

interface EquipmentSpecsPanelProps {
  lightId?: string;
  modifierId?: string;
}

export function EquipmentSpecsPanel({ lightId, modifierId }: EquipmentSpecsPanelProps) {
  const lightSpecs = lightId ? equipmentSpecsService.getLightSpecs(lightId) : null;
  const modifierSpecs = modifierId ? equipmentSpecsService.getModifierSpecs(modifierId) : null;
  const isCompatible = lightId && modifierId ? equipmentSpecsService.isCompatible(lightId, modifierId) : null;

  if (!lightSpecs && !modifierSpecs) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          Select a light or modifier to view specifications
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LightIcon /> Equipment Specifications
      </Typography>

      {/* Light Specifications */}
      {lightSpecs && (
        <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
            {lightSpecs.brand} {lightSpecs.model}
          </Typography>
          
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip label={lightSpecs.lightType.toUpperCase()} size="small" color="primary" />
            <Chip label={`${lightSpecs.wattage}W`} size="small" />
            <Chip label={`${lightSpecs.cct}K`} size="small" />
          </Stack>

          <Grid container spacing={2}>
            {/* Power Specifications */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                <PowerIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Power
              </Typography>
              <Box sx={{ ml: 2.5 }}>
                <Typography variant="body2">Wattage: {lightSpecs.wattage}W</Typography>
                <Typography variant="body2">Power Draw: {lightSpecs.powerConsumption}W</Typography>
                {lightSpecs.equivalentWattage && (
                  <Typography variant="body2">
                    Equivalent: {lightSpecs.equivalentWattage}W Tungsten
                  </Typography>
                )}
                <Typography variant="body2">Output: {lightSpecs.lightOutput.toLocaleString()} lumens</Typography>
              </Box>
            </Grid>

            {/* Beam Characteristics */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                Beam Pattern
              </Typography>
              <Box sx={{ ml: 2.5 }}>
                <Typography variant="body2">Type: {lightSpecs.beamPattern}</Typography>
                <Typography variant="body2">Beam Angle: {lightSpecs.beamAngle}°</Typography>
                <Typography variant="body2">Field Angle: {lightSpecs.fieldAngle}°</Typography>
                {lightSpecs.dimmingRange && (
                  <Typography variant="body2">
                    Dimming: {lightSpecs.dimmingRange[0]}-{lightSpecs.dimmingRange[1]}%
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Color Accuracy */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                <ColorIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Color Accuracy
              </Typography>
              <Box sx={{ ml: 2.5 }}>
                <Tooltip title="Color Rendering Index - measures color accuracy">
                  <Typography variant="body2">
                    CRI: {lightSpecs.cri} {lightSpecs.cri >= 95 ? '✅ Excellent' : lightSpecs.cri >= 90 ? '✓ Good' : ','}
                  </Typography>
                </Tooltip>
                <Tooltip title="Television Lighting Consistency Index">
                  <Typography variant="body2">
                    TLCI: {lightSpecs.tlci} {lightSpecs.tlci >= 95 ? '✅ Excellent' : lightSpecs.tlci >= 90 ? '✓ Good' : ','}
                  </Typography>
                </Tooltip>
                <Typography variant="body2">CCT: {lightSpecs.cct}K</Typography>
                {lightSpecs.cctRange && (
                  <Typography variant="body2">
                    CCT Range: {lightSpecs.cctRange[0]}-{lightSpecs.cctRange[1]}K
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Physical Specifications */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                <DimensionsIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Physical
              </Typography>
              <Box sx={{ ml: 2.5 }}>
                <Typography variant="body2">
                  Dimensions: {lightSpecs.dimensions.width} × {lightSpecs.dimensions.height} × {lightSpecs.dimensions.depth} cm
                </Typography>
                <Typography variant="body2">Weight: {lightSpecs.weight} kg</Typography>
                <Typography variant="body2">Mount: {lightSpecs.mountType}</Typography>
                {lightSpecs.fanNoise && (
                  <Typography variant="body2">Fan Noise: {lightSpecs.fanNoise} dB</Typography>
                )}
              </Box>
            </Grid>

            {/* Compatibility */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                <CompatibleIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Compatibility
              </Typography>
              <Box sx={{ ml: 2.5 }}>
                <Typography variant="body2" gutterBottom>Compatible Modifiers:</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {lightSpecs.compatibleModifiers.map((mod) => (
                    <Chip key={mod} label={mod} size="small" variant="outlined" />
                  ))}
                </Stack>
                {lightSpecs.wirelessControl && (
                  <Typography variant="body2" sx={{ mt: 1 }}>✓ Wireless Control</Typography>
                )}
                {lightSpecs.dmxChannels && (
                  <Typography variant="body2">DMX: {lightSpecs.dmxChannels} channels</Typography>
                )}
              </Box>
            </Grid>

            {/* Price */}
            {lightSpecs.msrpPrice && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                  <PriceIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  Price
                </Typography>
                <Box sx={{ ml: 2.5 }}>
                  <Typography variant="body2">MSRP: ${lightSpecs.msrpPrice.toLocaleString()}</Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Modifier Specifications */}
      {modifierSpecs && (
        <Paper elevation={1} sx={{ p: 2, bgcolor: '#f8fafc' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
            {modifierSpecs.brand} {modifierSpecs.model}
          </Typography>
          
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip label={modifierSpecs.type} size="small" color="secondary" />
            <Chip label={modifierSpecs.size} size="small" />
            <Chip label={modifierSpecs.shape} size="small" />
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2">Mount: {modifierSpecs.mountType}</Typography>
              <Typography variant="body2">Diffusion Layers: {modifierSpecs.diffusionLayers}</Typography>
              <Typography variant="body2">Power Loss: {modifierSpecs.powerLossStops} stops</Typography>
              <Typography variant="body2">Diffusion Factor: {(modifierSpecs.diffusionFactor * 100).toFixed(0)}%</Typography>
              <Typography variant="body2">Weight: {modifierSpecs.weight} kg</Typography>
              {modifierSpecs.gridIncluded && (
                <Typography variant="body2">✓ Grid Included ({modifierSpecs.gridDegrees}°)</Typography>
              )}
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Compatibility Check */}
      {isCompatible !== null && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: isCompatible ? '#d1fae5' : '#fee2e2', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: isCompatible ? '#065f46' : '#991b1b' }}>
            {isCompatible ? '✅ Compatible' : '❌ Not Compatible'}
          </Typography>
          {isCompatible && lightId && modifierId && (
            <Typography variant="caption" sx={{ color: '#065f46' }}>
              Effective Output: {equipmentSpecsService.calculateEffectiveOutput(lightId, modifierId).toLocaleString()} lumens
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

