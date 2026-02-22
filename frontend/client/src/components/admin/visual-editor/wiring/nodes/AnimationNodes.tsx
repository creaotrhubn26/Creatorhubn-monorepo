/**
 * Animation Nodes
 * Nodes for animation triggers, timelines, and transitions
 */

import React, { memo } from 'react';
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
  Slider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  PlayArrow,
  Timeline,
  Animation,
  Tune,
  Speed as Speed,
  Loop,
  Pause,
} from '@mui/icons-material';
import { BaseNode, NodeConfig } from './BaseNode';

// Animation Trigger Node
export const AnimationTriggerNode = memo(function AnimationTriggerNode({
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
        name: 'Animation Trigger',
        color: '#f44336',
        icon: <PlayArrow sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Trigger Type</InputLabel>
            <Select
              value={data.triggerType || 'onMount'}
              onChange={(e) => onChange('triggerType', e.target.value)}
              label="Trigger Type"
            >
              <MenuItem value="onMount">On Mount</MenuItem>
              <MenuItem value="onHover">On Hover</MenuItem>
              <MenuItem value="onClick">On Click</MenuItem>
              <MenuItem value="onScroll">On Scroll (In View)</MenuItem>
              <MenuItem value="manual">Manual Trigger</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            label="Target Selector"
            value={data.target || ''}
            onChange={(e) => onChange('target', e.target.value)}
            placeholder="#element or .class"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.playOnce !== false}
                onChange={(e) => onChange('playOnce', e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Play Once</Typography>}
          />
        </Box>
      )}
      {...props}
    />
  );
});

// Timeline Node
export const TimelineNode = memo(function TimelineNode({
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
        name: 'Timeline',
        color: '#f44336',
        icon: <Timeline sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Duration (ms)"
            value={data.duration || 1000}
            onChange={(e) => onChange('duration', parseInt(e.target.value))}
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            type="number"
            label="Delay (ms)"
            value={data.delay || 0}
            onChange={(e) => onChange('delay', parseInt(e.target.value))}
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Direction</InputLabel>
            <Select
              value={data.direction || 'normal'}
              onChange={(e) => onChange('direction', e.target.value)}
              label="Direction"
            >
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="reverse">Reverse</MenuItem>
              <MenuItem value="alternate">Alternate</MenuItem>
              <MenuItem value="alternate-reverse">Alternate Reverse</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="number"
              label="Iterations"
              value={data.iterations || 1}
              onChange={(e) => onChange('iterations', parseInt(e.target.value))}
              sx={{ flex: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={data.infinite || false}
                  onChange={(e) => onChange('infinite', e.target.checked)}
                  size="small"
                />
              }
              label={<Loop sx={{ fontSize: 16 }} />}
            />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Transition Node
export const TransitionNode = memo(function TransitionNode({
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
        name: 'Transition',
        color: '#f44336',
        icon: <Animation sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Property</InputLabel>
            <Select
              value={data.property || 'all'}
              onChange={(e) => onChange('property', e.target.value)}
              label="Property"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="opacity">Opacity</MenuItem>
              <MenuItem value="transform">Transform</MenuItem>
              <MenuItem value="background">Background</MenuItem>
              <MenuItem value="color">Color</MenuItem>
              <MenuItem value="width">Width</MenuItem>
              <MenuItem value="height">Height</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          {data.property === 'custom' && (
            <TextField
              fullWidth
              size="small"
              label="CSS Property"
              value={data.customProperty || ''}
              onChange={(e) => onChange('customProperty', e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          <TextField
            fullWidth
            size="small"
            type="number"
            label="Duration (ms)"
            value={data.duration || 300}
            onChange={(e) => onChange('duration', parseInt(e.target.value))}
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small">
            <InputLabel>Easing</InputLabel>
            <Select
              value={data.easing || 'ease'}
              onChange={(e) => onChange('easing', e.target.value)}
              label="Easing"
            >
              <MenuItem value="linear">Linear</MenuItem>
              <MenuItem value="ease">Ease</MenuItem>
              <MenuItem value="ease-in">Ease In</MenuItem>
              <MenuItem value="ease-out">Ease Out</MenuItem>
              <MenuItem value="ease-in-out">Ease In Out</MenuItem>
              <MenuItem value="cubic-bezier">Cubic Bezier</MenuItem>
            </Select>
          </FormControl>

          {data.easing === 'cubic-bezier' && (
            <TextField
              fullWidth
              size="small"
              label="Bezier Values"
              value={data.bezier || '0.4, 0, 0.2, 1'}
              onChange={(e) => onChange('bezier', e.target.value)}
              placeholder="0.4, 0, 0.2, 1"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      )}
      {...props}
    />
  );
});

// Spring Animation Node
export const SpringNode = memo(function SpringNode({
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
        name: 'Spring',
        color: '#f44336',
        icon: <Tune sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <Typography variant="caption" color="rgba(255,255,255,0.5)" gutterBottom>
            Stiffness: {data.stiffness || 100}
          </Typography>
          <Slider
            value={data.stiffness || 100}
            onChange={(_, value) => onChange('stiffness', value)}
            min={10}
            max={500}
            sx={{ color: '#f44336', mb: 1 }}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" gutterBottom>
            Damping: {data.damping || 10}
          </Typography>
          <Slider
            value={data.damping || 10}
            onChange={(_, value) => onChange('damping', value)}
            min={1}
            max={50}
            sx={{ color: '#f44336', mb: 1 }}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" gutterBottom>
            Mass: {data.mass || 1}
          </Typography>
          <Slider
            value={data.mass || 1}
            onChange={(_, value) => onChange('mass', value)}
            min={0.1}
            max={10}
            step={0.1}
            sx={{ color: '#f44336' }}
          />

          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Chip size="small" label="bouncy" onClick={() => { onChange('stiffness', 300); onChange('damping', 10); }} sx={{ bgcolor: 'rgba(244,67,54,0.2)', color: '#f44336' }} />
            <Chip size="small" label="stiff" onClick={() => { onChange('stiffness', 500); onChange('damping', 30); }} sx={{ bgcolor: 'rgba(244,67,54,0.2)', color: '#f44336' }} />
            <Chip size="small" label="gentle" onClick={() => { onChange('stiffness', 50); onChange('damping', 15); }} sx={{ bgcolor: 'rgba(244,67,54,0.2)', color: '#f44336' }} />
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Keyframe Node
export const KeyframeNode = memo(function KeyframeNode({
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
        name: 'Keyframe',
        color: '#f44336',
        icon: <Speed sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Keyframe Name"
            value={data.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="fadeIn, slideUp..."
            sx={{ mb: 1 }}
          />

          <TextField
            fullWidth
            size="small"
            label="Keyframes (JSON)"
            value={data.keyframes || ''}
            onChange={(e) => onChange('keyframes', e.target.value)}
            placeholder='{ "0%": {...}, "100%": {...} }'
            multiline
            rows={3}
            sx={{ fontFamily: 'monospace' }}
          />

          <Typography variant="caption" color="rgba(255,255,255,0.5)" sx={{ mt: 1, display: 'block' }}>
            Or use preset:
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
            {['fadeIn', 'fadeOut', 'slideUp', 'slideDown', 'scaleIn', 'bounce', 'shake', 'pulse'].map((preset) => (
              <Chip
                key={preset}
                size="small"
                label={preset}
                onClick={() => onChange('preset', preset)}
                variant={data.preset === preset ? 'filled' : 'outlined'}
                sx={{ bgcolor: data.preset === preset ? 'rgba(244,67,54,0.2)' : 'transparent', borderColor: '#f44336', color: '#f44336', mb: 0.5 }}
              />
            ))}
          </Stack>
        </Box>
      )}
      {...props}
    />
  );
});

// Stagger Node
export const StaggerNode = memo(function StaggerNode({
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
        name: 'Stagger',
        color: '#f44336',
        icon: <Pause sx={{ fontSize: 18 }} />,
      }}
      onDataChange={onDataChange}
      renderContent={(data, onChange) => (
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Stagger Delay (ms)"
            type="number"
            value={data.staggerDelay || 100}
            onChange={(e) => onChange('staggerDelay', parseInt(e.target.value))}
            sx={{ mb: 1 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Direction</InputLabel>
            <Select
              value={data.staggerDirection || 'forward'}
              onChange={(e) => onChange('staggerDirection', e.target.value)}
              label="Direction"
            >
              <MenuItem value="forward">Forward (first to last)</MenuItem>
              <MenuItem value="reverse">Reverse (last to first)</MenuItem>
              <MenuItem value="center">From Center</MenuItem>
              <MenuItem value="edges">From Edges</MenuItem>
              <MenuItem value="random">Random</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Staggers animation across multiple child elements
          </Typography>
        </Box>
      )}
      {...props}
    />
  );
});

// Node definitions for the library
export const ANIMATION_NODE_DEFINITIONS = [
  {
    type: 'AnimationTriggerNode',
    name: 'Animation Trigger',
    category: 'animation',
    description: 'Trigger animations on events',
    icon: <PlayArrow />,
    color: '#f44336',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'start', name: 'start', type: 'output' as const, dataType: 'event' as const },
      { id: 'complete', name: 'complete', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { triggerType: 'onMount', target: '', playOnce: true },
    component: AnimationTriggerNode,
  },
  {
    type: 'TimelineNode',
    name: 'Timeline',
    category: 'animation',
    description: 'Control animation timeline',
    icon: <Timeline />,
    color: '#f44336',
    inputs: [
      { id: 'play', name: 'play', type: 'input' as const, dataType: 'event' as const },
      { id: 'pause', name: 'pause', type: 'input' as const, dataType: 'event' as const },
      { id: 'reset', name: 'reset', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'progress', name: 'progress', type: 'output' as const, dataType: 'number' as const },
      { id: 'complete', name: 'complete', type: 'output' as const, dataType: 'event' as const },
    ],
    defaultData: { duration: 1000, delay: 0, direction: 'normal', iterations: 1, infinite: false },
    component: TimelineNode,
  },
  {
    type: 'TransitionNode',
    name: 'Transition',
    category: 'animation',
    description: 'CSS transitions',
    icon: <Animation />,
    color: '#f44336',
    inputs: [
      { id: 'from', name: 'from', type: 'input' as const, dataType: 'any' as const },
      { id: 'to', name: 'to', type: 'input' as const, dataType: 'any' as const },
    ],
    outputs: [
      { id: 'style', name: 'style', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { property: 'all', duration: 300, easing: 'ease' },
    component: TransitionNode,
  },
  {
    type: 'SpringNode',
    name: 'Spring',
    category: 'animation',
    description: 'Physics-based spring animation',
    icon: <Tune />,
    color: '#f44336',
    inputs: [
      { id: 'from', name: 'from', type: 'input' as const, dataType: 'number' as const },
      { id: 'to', name: 'to', type: 'input' as const, dataType: 'number' as const },
    ],
    outputs: [
      { id: 'value', name: 'value', type: 'output' as const, dataType: 'number' as const },
      { id: 'velocity', name: 'velocity', type: 'output' as const, dataType: 'number' as const },
    ],
    defaultData: { stiffness: 100, damping: 10, mass: 1 },
    component: SpringNode,
  },
  {
    type: 'KeyframeNode',
    name: 'Keyframe',
    category: 'animation',
    description: 'Define keyframe animations',
    icon: <Speed />,
    color: '#f44336',
    inputs: [
      { id: 'trigger', name: 'trigger', type: 'input' as const, dataType: 'event' as const },
    ],
    outputs: [
      { id: 'animation', name: 'animation', type: 'output' as const, dataType: 'object' as const },
    ],
    defaultData: { name: '', keyframes: '', preset: '' },
    component: KeyframeNode,
  },
  {
    type: 'StaggerNode',
    name: 'Stagger',
    category: 'animation',
    description: 'Stagger animations across elements',
    icon: <Pause />,
    color: '#f44336',
    inputs: [
      { id: 'elements', name: 'elements', type: 'input' as const, dataType: 'array' as const },
      { id: 'animation', name: 'animation', type: 'input' as const, dataType: 'object' as const },
    ],
    outputs: [
      { id: 'animations', name: 'animations', type: 'output' as const, dataType: 'array' as const },
    ],
    defaultData: { staggerDelay: 100, staggerDirection: 'forward' },
    component: StaggerNode,
  },
];

export default ANIMATION_NODE_DEFINITIONS;

