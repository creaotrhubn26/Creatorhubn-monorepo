/**
 * Theme/Style Nodes
 * Nodes for theme management, responsive design, and styling
 */

import React, { memo, useState } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Slider,
  IconButton,
  Popover,
} from '@mui/material';
import {
  Palette,
  DarkMode,
  LightMode,
  Devices,
  FormatSize,
  SpaceBar,
  Gradient,
  BorderAll,
  Opacity,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

// Theme Variable Node
export const ThemeVariableNode = memo(function ThemeVariableNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  const [colorPickerAnchor, setColorPickerAnchor] = useState<HTMLElement | null>(null);

  return (
    <BaseNode
      config={{
        ...config,
        name: 'Theme Variable',
        color: '#ff5722',
        icon: <Palette sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Variable Type</InputLabel>
            <Select
              value={data.type || 'color'}
              onChange={(e) => onChange('type', e.target.value)}
              label="Variable Type"
            >
              <MenuItem value="color">Color</MenuItem>
              <MenuItem value="spacing">Spacing</MenuItem>
              <MenuItem value="fontSize">Font Size</MenuItem>
              <MenuItem value="fontFamily">Font Family</MenuItem>
              <MenuItem value="borderRadius">Border Radius</MenuItem>
              <MenuItem value="shadow">Shadow</MenuItem>
              <MenuItem value="custom">Custom CSS Variable</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Variable Name"
            value={data.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="--primary-color, theme.palette.primary"
            sx={{ mb: 1 }}
          />

          {data.type === 'color' && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Box
                onClick={(e) => setColorPickerAnchor(e.currentTarget)}
                sx={{
                  width: 40,
                  height: 30,
                  borderRadius: 1,
                  bgcolor: data.value || '#ff6b00',
                  border: '2px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                }}
              />
              <TextField
                size="small"
                value={data.value || '#ff6b00'}
                onChange={(e) => onChange('value', e.target.value)}
                sx={{ flex: 1 }}
              />
              <Popover
                open={Boolean(colorPickerAnchor)}
                anchorEl={colorPickerAnchor}
                onClose={() => setColorPickerAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <Box sx={{ p: 2 }}>
                  <input
                    type="color"
                    value={data.value || '#ff6b00'}
                    onChange={(e) => onChange('value', e.target.value)}
                    style={{ width: 200, height: 150, border: 'none' }}
                  />
                </Box>
              </Popover>
            </Box>
          )}

          {data.type === 'spacing' && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="rgba(255,255,255,0.5)">
                {data.value || 8}px
              </Typography>
              <Slider
                value={data.value || 8}
                onChange={(_, value) => onChange('value', value)}
                min={0}
                max={64}
                sx={{ color: '#ff5722' }}
              />
            </Box>
          )}

          {data.type === 'fontSize' && (
            <TextField
              fullWidth
              size="small"
              label="Font Size"
              value={data.value || '16px'}
              onChange={(e) => onChange('value', e.target.value)}
              placeholder="16px, 1rem, 1.5em"
            />
          )}

          {data.type === 'fontFamily' && (
            <FormControl fullWidth size="small">
              <InputLabel>Font Family</InputLabel>
              <Select
                value={data.value || 'Inter'}
                onChange={(e) => onChange('value', e.target.value)}
                label="Font Family"
              >
                <MenuItem value="Inter">Inter</MenuItem>
                <MenuItem value="Roboto">Roboto</MenuItem>
                <MenuItem value="Open Sans">Open Sans</MenuItem>
                <MenuItem value="Montserrat">Montserrat</MenuItem>
                <MenuItem value="Poppins">Poppins</MenuItem>
                <MenuItem value="system-ui">System UI</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      )}
      {...props}
    />
  );
});

// Dark Mode Node
export const DarkModeNode = memo(function DarkModeNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Dark Mode',
        color: '#ff5722',
        icon: <DarkMode sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Mode Source</InputLabel>
            <Select
              value={data.source || 'system'}
              onChange={(e) => onChange('source', e.target.value)}
              label="Mode Source"
            >
              <MenuItem value="system">System Preference</MenuItem>
              <MenuItem value="localStorage">Local Storage</MenuItem>
              <MenuItem value="context">Theme Context</MenuItem>
              <MenuItem value="manual">Manual Control</MenuItem>
            </Select>
          </FormControl>

          {data.source === 'localStorage' && (
            <TextField
              fullWidth
              size="small"
              label="Storage Key"
              value={data.storageKey || 'theme-mode'}
              onChange={(e) => onChange('storageKey', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={data.defaultDark || false}
                onChange={(e) => onChange('defaultDark', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Default to dark</Typography>}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              size="small"
              icon={<LightMode sx={{ fontSize: 14 }} />}
              label="Light"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            />
            <Chip
              size="small"
              icon={<DarkMode sx={{ fontSize: 14 }} />}
              label="Dark"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Responsive Node
export const ResponsiveNode = memo(function ResponsiveNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Responsive',
        color: '#ff5722',
        icon: <Devices sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Breakpoint</InputLabel>
            <Select
              value={data.breakpoint || 'md'}
              onChange={(e) => onChange('breakpoint', e.target.value)}
              label="Breakpoint"
            >
              <MenuItem value="xs">xs (0-599px)</MenuItem>
              <MenuItem value="sm">sm (600-899px)</MenuItem>
              <MenuItem value="md">md (900-1199px)</MenuItem>
              <MenuItem value="lg">lg (1200-1535px)</MenuItem>
              <MenuItem value="xl">xl (1536px+)</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          {data.breakpoint === 'custom' && (
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                type="number"
                label="Min Width"
                value={data.minWidth || ''}
                onChange={(e) => onChange('minWidth', e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                type="number"
                label="Max Width"
                value={data.maxWidth || ''}
                onChange={(e) => onChange('maxWidth', e.target.value)}
                sx={{ flex: 1 }}
              />
            </Stack>
          )}

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Comparison</InputLabel>
            <Select
              value={data.comparison || 'up'}
              onChange={(e) => onChange('comparison', e.target.value)}
              label="Comparison"
            >
              <MenuItem value="up">Up (min-width)</MenuItem>
              <MenuItem value="down">Down (max-width)</MenuItem>
              <MenuItem value="only">Only (exact range)</MenuItem>
              <MenuItem value="between">Between</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Outputs true when viewport matches
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// CSS Variable Node
export const CSSVariableNode = memo(function CSSVariableNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'CSS Variable',
        color: '#ff5722',
        icon: <BorderAll sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Variable Name"
            value={data.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="--my-variable"
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Value"
            value={data.value || ''}
            onChange={(e) => onChange('value', e.target.value)}
            placeholder="#ff6b00, 16px, 1rem"
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small">
            <InputLabel>Scope</InputLabel>
            <Select
              value={data.scope || ':root'}
              onChange={(e) => onChange('scope', e.target.value)}
              label="Scope"
            >
              <MenuItem value=":root">:root (global)</MenuItem>
              <MenuItem value="component">Component</MenuItem>
              <MenuItem value="custom">Custom selector</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
      {...props}
    />
  );
});

// Gradient Node
export const GradientNode = memo(function GradientNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Gradient',
        color: '#ff5722',
        icon: <Gradient sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={data.type || 'linear'}
              onChange={(e) => onChange('type', e.target.value)}
              label="Type"
            >
              <MenuItem value="linear">Linear</MenuItem>
              <MenuItem value="radial">Radial</MenuItem>
              <MenuItem value="conic">Conic</MenuItem>
            </Select>
          </FormControl>

          {data.type === 'linear' && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="rgba(255,255,255,0.5)">
                Direction: {data.direction || 90}°
              </Typography>
              <Slider
                value={data.direction || 90}
                onChange={(_, value) => onChange('direction', value)}
                min={0}
                max={360}
                sx={{ color: '#ff5722' }}
              />
            </Box>
          )}

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="rgba(255,255,255,0.5)">Start</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <input
                  type="color"
                  value={data.startColor || '#ff6b00'}
                  onChange={(e) => onChange('startColor', e.target.value)}
                  style={{ width: 30, height: 24, border: 'none', borderRadius: 4 }}
                />
                <TextField
                  size="small"
                  value={data.startColor || '#ff6b00'}
                  onChange={(e) => onChange('startColor', e.target.value)}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="rgba(255,255,255,0.5)">End</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <input
                  type="color"
                  value={data.endColor || '#e55a00'}
                  onChange={(e) => onChange('endColor', e.target.value)}
                  style={{ width: 30, height: 24, border: 'none', borderRadius: 4 }}
                />
                <TextField
                  size="small"
                  value={data.endColor || '#e55a00'}
                  onChange={(e) => onChange('endColor', e.target.value)}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>
          </Stack>

          <Box
            sx={{
              height: 30,
              borderRadius: 1,
              background: `linear-gradient(${data.direction || 90}deg, ${data.startColor || '#ff6b00'}, ${data.endColor || '#e55a00'})`,
            }}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Opacity Node
export const OpacityNode = memo(function OpacityNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Opacity',
        color: '#ff5722',
        icon: <Opacity sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Opacity: {((data.value || 1) * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={data.value || 1}
            onChange={(_, value) => onChange('value', value)}
            min={0}
            max={1}
            step={0.01}
            sx={{ color: '#ff5722' }}
          />

          <Stack direction="row" spacing={0.5}>
            {[0, 0.25, 0.5, 0.75, 1].map((val) => (
              <Chip
                key={val}
                size="small"
                label={`${val * 100}%`}
                onClick={() => onChange('value', val)}
                variant={data.value === val ? 'filled' : 'outlined'}
                sx={{ bgcolor: data.value === val ? 'rgba(255,87,34,0.2)' : 'transparent', borderColor: '#ff5722', color: '#ff5722' }}
              />
            ))}
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Spacing Node
export const SpacingNode = memo(function SpacingNode({
  config,
  onDataChange,
  ...props
}: {
  config: NodeConfig;
  onDataChange?: (key: string, value: unknown) => void;
  [key: string]: unknown;
}) {
  return (
    <BaseNode
      config={{
        ...config,
        name: 'Spacing',
        color: '#ff5722',
        icon: <SpaceBar sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Property</InputLabel>
            <Select
              value={data.property || 'margin'}
              onChange={(e) => onChange('property', e.target.value)}
              label="Property"
            >
              <MenuItem value="margin">Margin</MenuItem>
              <MenuItem value="padding">Padding</MenuItem>
              <MenuItem value="gap">Gap</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              size="small"
              type="number"
              label="Top"
              value={data.top ?? ''}
              onChange={(e) => onChange('top', e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label="Right"
              value={data.right ?? ''}
              onChange={(e) => onChange('right', e.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="number"
              label="Bottom"
              value={data.bottom ?? ''}
              onChange={(e) => onChange('bottom', e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label="Left"
              value={data.left ?? ''}
              onChange={(e) => onChange('left', e.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>

          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Unit</InputLabel>
            <Select
              value={data.unit || 'px'}
              onChange={(e) => onChange('unit', e.target.value)}
              label="Unit"
            >
              <MenuItem value="px">px</MenuItem>
              <MenuItem value="rem">rem</MenuItem>
              <MenuItem value="em">em</MenuItem>
              <MenuItem value="%">%</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions
export const THEME_NODE_DEFINITIONS = [
  {
    type: 'ThemeVariableNode',
    name: 'Theme Variable',
    category: 'theme',
    description: 'Access theme variables',
    icon: <Palette />,
    color: '#ff5722',
    inputs: [],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'any' as const },
    ],
    defaultData: { type: 'color', name: '', value: '#ff6b00' },
    component: ThemeVariableNode,
  },
  {
    type: 'DarkModeNode',
    name: 'Dark Mode',
    category: 'theme',
    description: 'Dark/light mode detection',
    icon: <DarkMode />,
    color: '#ff5722',
    inputs: [
      { id: 'toggle', name: 'toggle', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'isDark', name: 'isDark', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'mode', name: 'mode', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { source: 'system', defaultDark: false },
    component: DarkModeNode,
  },
  {
    type: 'ResponsiveNode',
    name: 'Responsive',
    category: 'theme',
    description: 'Responsive breakpoint detection',
    icon: <Devices />,
    color: '#ff5722',
    inputs: [],
    outputs: [
      { id: 'matches', name: 'matches', type: 'output' as const, dataType: 'boolean' as const },
      { id: 'breakpoint', name: 'breakpoint', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { breakpoint: 'md', comparison: 'up' },
    component: ResponsiveNode,
  },
  {
    type: 'CSSVariableNode',
    name: 'CSS Variable',
    category: 'theme',
    description: 'Set CSS custom properties',
    icon: <BorderAll />,
    color: '#ff5722',
    inputs: [
      { id: 'value', name: 'value', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'css', name: 'css', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { name: '', value: '', scope: ':root' },
    component: CSSVariableNode,
  },
  {
    type: 'GradientNode',
    name: 'Gradient',
    category: 'theme',
    description: 'Create CSS gradients',
    icon: <Gradient />,
    color: '#ff5722',
    inputs: [],
    outputs: [
      { id: 'gradient', name: 'gradient', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { type: 'linear', direction: 90, startColor: '#ff6b00', endColor: '#e55a00' },
    component: GradientNode,
  },
  {
    type: 'OpacityNode',
    name: 'Opacity',
    category: 'theme',
    description: 'Opacity value control',
    icon: <Opacity />,
    color: '#ff5722',
    inputs: [
      { id: 'input', name: 'input', type: 'input' as const, dataType: 'number' as const },
    ],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'number' as const },
    ],
    defaultData: { value: 1 },
    component: OpacityNode,
  },
  {
    type: 'SpacingNode',
    name: 'Spacing',
    category: 'theme',
    description: 'Margin/padding/gap values',
    icon: <SpaceBar />,
    color: '#ff5722',
    inputs: [],
    outputs: [
      { id: 'style', name: 'style', type: 'output' as const, dataType: 'object' as const },
      { id: 'css', name: 'css', type: 'output' as const, dataType: 'string' as const },
    ],
    defaultData: { property: 'margin', unit: 'px' },
    component: SpacingNode,
  },
];

export default THEME_NODE_DEFINITIONS;

