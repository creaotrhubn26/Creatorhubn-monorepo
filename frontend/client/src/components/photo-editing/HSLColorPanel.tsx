/**
 * HSL COLOR PANEL
 * Lightroom-style HSL adjustments for 8 color channels
 * Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ExpandMore, Refresh, Palette } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export interface HSLAdjustments {
  red: { hue: number; saturation: number; luminance: number };
  orange: { hue: number; saturation: number; luminance: number };
  yellow: { hue: number; saturation: number; luminance: number };
  green: { hue: number; saturation: number; luminance: number };
  aqua: { hue: number; saturation: number; luminance: number };
  blue: { hue: number; saturation: number; luminance: number };
  purple: { hue: number; saturation: number; luminance: number };
  magenta: { hue: number; saturation: number; luminance: number };
}

interface HSLColorPanelProps {
  onHSLChange?: (adjustments: HSLAdjustments) => void;
  initialAdjustments?: Partial<HSLAdjustments>;
}

const COLOR_CHANNELS = [
  { key: 'red' as const, name: 'Red', color: '#ff4444' },
  { key: 'orange' as const, name: 'Orange', color: '#ff8844' },
  { key: 'yellow' as const, name: 'Yellow', color: '#ffdd44' },
  { key: 'green' as const, name: 'Green', color: '#44ff44' },
  { key: 'aqua' as const, name: 'Aqua', color: '#44ffdd' },
  { key: 'blue' as const, name: 'Blue', color: '#4444ff' },
  { key: 'purple' as const, name: 'Purple', color: '#8844ff' },
  { key: 'magenta' as const, name: 'Magenta', color: '#ff44dd' },
];

export default function HSLColorPanel({
  onHSLChange,
  initialAdjustments,
}: HSLColorPanelProps) {
  const theming = useTheming('photographer');
  const [adjustments, setAdjustments] = useState<HSLAdjustments>(() => {
    const defaultAdj: HSLAdjustments = {
      red: { hue: 0, saturation: 0, luminance: 0 },
      orange: { hue: 0, saturation: 0, luminance: 0 },
      yellow: { hue: 0, saturation: 0, luminance: 0 },
      green: { hue: 0, saturation: 0, luminance: 0 },
      aqua: { hue: 0, saturation: 0, luminance: 0 },
      blue: { hue: 0, saturation: 0, luminance: 0 },
      purple: { hue: 0, saturation: 0, luminance: 0 },
      magenta: { hue: 0, saturation: 0, luminance: 0 },
    };

    if (initialAdjustments) {
      Object.keys(initialAdjustments).forEach((key) => {
        const k = key as keyof HSLAdjustments;
        if (initialAdjustments[k]) {
          defaultAdj[k] = { ...defaultAdj[k], ...initialAdjustments[k] };
        }
      });
    }

    return defaultAdj;
  });

  const [expandedChannels, setExpandedChannels] = useState<string[]>(['red','orange','yellow']);

  const handleAdjustmentChange = useCallback(
    (
      color: keyof HSLAdjustments,
      property: 'hue' | 'saturation' | 'luminance',
      value: number
    ) => {
      setAdjustments((prev) => {
        const updated = {
          ...prev,
          [color]: {
            ...prev[color],
            [property]: value,
          },
        };
        onHSLChange?.(updated);
        return updated;
      });
    },
    [onHSLChange]
  );

  const handleReset = useCallback((color?: keyof HSLAdjustments) => {
    if (color) {
      setAdjustments((prev) => {
        const updated = {
          ...prev,
          [color]: { hue: 0, saturation: 0, luminance: 0 },
        };
        onHSLChange?.(updated);
        return updated;
      });
    } else {
      const reset: HSLAdjustments = {
        red: { hue: 0, saturation: 0, luminance: 0 },
        orange: { hue: 0, saturation: 0, luminance: 0 },
        yellow: { hue: 0, saturation: 0, luminance: 0 },
        green: { hue: 0, saturation: 0, luminance: 0 },
        aqua: { hue: 0, saturation: 0, luminance: 0 },
        blue: { hue: 0, saturation: 0, luminance: 0 },
        purple: { hue: 0, saturation: 0, luminance: 0 },
        magenta: { hue: 0, saturation: 0, luminance: 0 },
      };
      setAdjustments(reset);
      onHSLChange?.(reset);
    }
  }, [onHSLChange]);

  const hasAdjustments = (color: keyof HSLAdjustments): boolean => {
    const adj = adjustments[color];
    return adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0;
  };

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Palette />
            HSL / Color
          </Typography>
          <Tooltip title="Reset All">
            <IconButton size="small" onClick={() => handleReset()}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Adjust individual color channels for precise color control
        </Typography>

        {COLOR_CHANNELS.map((channel) => {
          const colorKey = channel.key;
          const adj = adjustments[colorKey];
          const hasChanges = hasAdjustments(colorKey);

          return (
            <Accordion
              key={colorKey}
              expanded={expandedChannels.includes(colorKey)}
              onChange={(_, isExpanded) => {
                if (isExpanded) {
                  setExpandedChannels([...expandedChannels, colorKey]);
                } else {
                  setExpandedChannels(expandedChannels.filter((c) => c !== colorKey));
                }
              }}
              sx={{
                borderLeft: hasChanges ? `3px solid ${channel.color}` : '3px solid transparent'}}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: channel.color,
                      border: '2px solid #fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'}}
                  />
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {channel.name}
                  </Typography>
                  {hasChanges && (
                    <Chip
                      label={`H:${adj.hue} S:${adj.saturation} L:${adj.luminance}`}
                      size="small"
                      sx={{ bgcolor: channel.color, color: 'white', fontSize: '10px' }}
                    />
                  )}
                  <Tooltip title="Reset">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReset(colorKey);
                      }}
                      disabled={!hasChanges}
                    >
                      <Refresh fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  {/* Hue */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Hue</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {adj.hue > 0 ? '+' : ','}{adj.hue}
                      </Typography>
                    </Box>
                    <Slider
                      value={adj.hue}
                      onChange={(_, value) =>
                        handleAdjustmentChange(colorKey, 'hue', value as number)
                      }
                      min={-100}
                      max={100}
                      step={1}
                      marks={[
                        { value: -100, label: '-100' },
                        { value: 0, label: '0' },
                        { value: 100, label: '+100' },
                      ]}
                      sx={{
                        color: channel.color,
                        '& .MuiSlider-thumb': {
                          bgcolor: channel.color,
                        }
                      }}
                    />
                  </Box>

                  {/* Saturation */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Saturation</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {adj.saturation > 0 ? '+' : ','}{adj.saturation}
                      </Typography>
                    </Box>
                    <Slider
                      value={adj.saturation}
                      onChange={(_, value) =>
                        handleAdjustmentChange(colorKey, 'saturation', value as number)
                      }
                      min={-100}
                      max={100}
                      step={1}
                      marks={[
                        { value: -100, label: '-100' },
                        { value: 0, label: '0' },
                        { value: 100, label: '+100' },
                      ]}
                      sx={{
                        color: channel.color,
                        '& .MuiSlider-thumb': {
                          bgcolor: channel.color,
                        }
                      }}
                    />
                  </Box>

                  {/* Luminance */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Luminance</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {adj.luminance > 0 ? '+' : ', '}{adj.luminance}
                      </Typography>
                    </Box>
                    <Slider
                      value={adj.luminance}
                      onChange={(_, value) =>
                        handleAdjustmentChange(colorKey, 'luminance', value as number)
                      }
                      min={-100}
                      max={100}
                      step={1}
                      marks={[
                        { value: -100, label: '-100' },
                        { value: 0, label: '0' },
                        { value: 100, label: '+100' },
                      ]}
                      sx={{
                        color: channel.color,
                        '& .MuiSlider-thumb': {
                          bgcolor: channel.color,
                        }
                      }}
                    />
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          Tip: Use HSL to fine-tune specific colors without affecting others. Perfect for skin tones, skies, and selective color adjustments.
        </Typography>
      </Stack>
    </Paper>
  );
}

